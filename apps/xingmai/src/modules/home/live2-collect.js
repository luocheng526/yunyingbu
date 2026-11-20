/**
 * 实时（新版）采集。
 * 组织中心提供账号和密码。每家店在服务器登录后：
 * 京麦经营数据接口取成交金额，京准通 custom-report 当天总览取花费、投产比、总订单金额。
 * 不写旧京麦会话表。后台每 5 分钟开一轮；上一轮还在跑时不叠第二轮。
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { jingmaiClient } from "./jingmai-client.js";
import { listSamples, listSessions } from "./jingmai-store.js";
import { beijingParts, displayStamp } from "./jingmai.js";
import { blankLive2Record, live2RecordFromMetrics } from "./live2.js";

function workerCount() {
  const value = Number(process.env.LIVE2_CONCURRENCY);
  // 京麦成交门闩最多 3 路。再高只会在门闩里排队。
  return Number.isFinite(value) && value >= 1 ? Math.min(6, Math.floor(value)) : 3;
}

function shopBudgetMs() {
  const value = Number(process.env.LIVE2_SHOP_MS);
  // 京麦接口遇到 601 会重试，然后用已经登录的会话读首页。25 秒会在这一步之前被掐掉。
  return Number.isFinite(value) && value >= 1000 ? value : 90000;
}

export const LIVE2_RUNTIME_MARK = "0.1.1278-live2-login";
export const LIVE2_INTERVAL_MS = 5 * 60 * 1000;

function stampNow() {
  return displayStamp(beijingParts().stamp);
}

async function readOrgShops(cookie, fetchImpl = fetch) {
  const origin =
    process.env.HOME_INTERNAL_ORIGIN ||
    process.env.SHEN_INTERNAL_ORIGIN ||
    "http://127.0.0.1:" + (process.env.PORT || 3000);
  const response = await fetchImpl(origin + "/api/people/org/stores", {
    headers: { cookie: cookie || "", accept: "application/json" }
  });
  if (response.status === 401) {
    const error = new Error("请先登录运营中心");
    error.statusCode = 401;
    throw error;
  }
  if (!response.ok) {
    const error = new Error("无法读取组织中心店铺");
    error.statusCode = 502;
    throw error;
  }
  const data = await response.json();
  return (data.stores || [])
    .map(function (store) {
      return {
        store: String(store.storeName || "").trim(),
        team: String((store && store.team) || ""),
        manager: String((store && store.manager) || ""),
        enabled: store.statusKey === "operating" || (store.statusKey == null && store.remark === "运营中"),
        login: String(store.login || ""),
        password: String(store.password || ""),
        shopId: String(store.shopId || store.storeId || "").trim(),
        merchantId: String(store.merchantId || "").trim()
      };
    })
    .filter(function (store) {
      return store.store && store.enabled !== false;
    });
}

function publicRecord(row) {
  const copy = Object.assign({}, row);
  delete copy.login;
  delete copy.password;
  return copy;
}

function defaultStorePath() {
  const env = String(process.env.HOME_LIVE2_STORE || "").trim();
  if (env) {
    return env;
  }
  const root = String(process.env.MENGKAI_LIVE_ROOT || "").trim();
  if (root) {
    return path.join(root, "data", "home-live2.json");
  }
  if (fs.existsSync("/opt/mengkai/src")) {
    return "/opt/mengkai/data/home-live2.json";
  }
  return path.join(os.tmpdir(), "xingmai-home-live2.json");
}

function dayOf(stamp) {
  return String(stamp || "").replace(/-/g, "/").slice(0, 10);
}

function hasNumbers(row) {
  return Boolean(row && (row.liveAmount != null || row.paidAmount != null));
}

function readStore(file) {
  if (!file) {
    return null;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    return raw && typeof raw === "object" ? raw : null;
  } catch {
    return null;
  }
}

function writeStore(file, payload) {
  if (!file) {
    return 0;
  }
  const started = Date.now();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(payload));
  fs.renameSync(tmp, file);
  return Date.now() - started;
}

export function createLive2Collector(deps = {}) {
  const jars = new Map();
  const published = new Map();
  let publishedAt = "";
  let updatedAt = "";
  let timings = emptyTimings();
  let running = false;
  const loadOrg = deps.loadOrg || readOrgShops;
  const sessionsOf = deps.listSessions || listSessions;
  const samplesOf = deps.listSamples || listSamples;
  const client = deps.client || jingmaiClient;
  const now = deps.now || stampNow;
  const file = deps.storePath === undefined ? defaultStorePath() : String(deps.storePath || "");
  const budget = deps.shopBudgetMs == null ? shopBudgetMs() : Number(deps.shopBudgetMs);
  const widthOf = deps.concurrency == null ? workerCount : function () { return deps.concurrency; };

  function emptyTimings() {
    return {
      shops: 0,
      queueMs: 0,
      dealMs: 0,
      adsMs: 0,
      saveMs: 0,
      roundMs: 0,
      apiMs: 0,
      concurrency: 0,
      slowest: ""
    };
  }

  function remember(list) {
    (list || []).forEach(function (row) {
      const name = String((row && (row.shop || row.store)) || "").trim();
      if (name) {
        published.set(name, publicRecord(Object.assign({}, row, { shop: name })));
      }
    });
  }

  const saved = readStore(file);
  if (saved) {
    publishedAt = String(saved.publishedAt || "");
    updatedAt = String(saved.updatedAt || "");
    timings = Object.assign(emptyTimings(), saved.timings || {});
    remember(saved.records);
  }
  remember(deps.published);

  function blankFor(shop) {
    const row = blankLive2Record(shop);
    // 待接入只表示组织中心没有账号。有账号但还没有数，格子留空。
    if (shop.login || shop.password) {
      row.pendingCollect = false;
    }
    return row;
  }

  function rowFor(shop) {
    const savedRow = published.get(shop.store);
    if (!savedRow) {
      return blankFor(shop);
    }
    return publicRecord(Object.assign({}, savedRow, { team: shop.team || savedRow.team, manager: shop.manager || savedRow.manager }));
  }

  function boardFrom(shops, apiMs) {
    const records = (shops || []).map(rowFor);
    return {
      ok: true,
      source: "live2",
      runtimeMark: LIVE2_RUNTIME_MARK,
      running: running,
      updatedAt: updatedAt,
      publishedAt: publishedAt,
      timings: Object.assign({}, timings, { apiMs: apiMs || 0 }),
      records: records
    };
  }

  async function board(cookie) {
    const started = Date.now();
    const shops = await loadOrg(cookie);
    shops.forEach(function (shop) {
      shop.password = "";
    });
    return boardFrom(shops, Date.now() - started);
  }

  async function loginJar(shop) {
    if (!shop.login || !shop.password) {
      return null;
    }
    let jar = null;
    if (client.openPassword && client.submitPassword) {
      const opened = await client.openPassword();
      jar = await client.submitPassword({
        jar: opened.jar,
        init: opened.init,
        loginName: shop.login,
        password: shop.password,
        authCode: ""
      });
    } else if (client.login) {
      jar = await client.login(shop.login, shop.password);
    }
    if (jar && jar.length) {
      jars.set(shop.store, jar.slice());
    }
    return jar;
  }

  function stampOf(value) {
    if (!value) {
      return "";
    }
    if (value instanceof Date) {
      return displayStamp(beijingParts(value).stamp);
    }
    return displayStamp(String(value).trim().replace("T", " ").slice(0, 19));
  }

  function rowFromSample(shop, sample) {
    const row = live2RecordFromMetrics(shop, {
      dealAmount: sample.dealAmount,
      paidAmount: sample.paidAmount,
      paidRoi: sample.paidRoi,
      paidDeal: sample.paidDeal
    }, stampOf(sample.capturedAt));
    row.pendingUpdate = true;
    row.pendingCollect = false;
    row.offline = false;
    row.offlineReason = "";
    return publicRecord(row);
  }

  async function loadSampleMap() {
    const map = new Map();
    try {
      const day = beijingParts().day;
      const rows = await samplesOf(day, day);
      const today = dayOf(now());
      (rows || []).forEach(function (sample) {
        const name = String((sample && sample.store) || "").trim();
        const at = stampOf(sample && sample.capturedAt);
        if (!name || !sample || sample.ok === false || dayOf(at) !== today) {
          return;
        }
        if (sample.dealAmount == null && sample.paidAmount == null) {
          return;
        }
        const prev = map.get(name);
        if (!prev || at >= stampOf(prev.capturedAt)) {
          map.set(name, sample);
        }
      });
    } catch {
      /* 没有样本时继续读京麦 */
    }
    return map;
  }

  function adoptSamples(samples) {
    let changed = false;
    const today = dayOf(now());
    samples.forEach(function (sample, name) {
      const current = published.get(name);
      const at = stampOf(sample.capturedAt);
      if (current && hasNumbers(current) && dayOf(current.capturedAt) === today && !current.pendingUpdate) {
        return;
      }
      if (current && hasNumbers(current) && dayOf(current.capturedAt) === today && String(current.capturedAt) >= at) {
        return;
      }
      published.set(name, rowFromSample({
        store: name,
        team: current && current.team,
        manager: current && current.manager
      }, sample));
      changed = true;
    });
    if (!changed) {
      return;
    }
    updatedAt = now();
    publishedAt = updatedAt;
    writeStore(file, {
      publishedAt: publishedAt,
      updatedAt: updatedAt,
      timings: timings,
      records: Array.from(published.values())
    });
  }

  function closeSlow(shop, draft, samples) {
    const current = draft.get(shop.store);
    const previous = published.get(shop.store);
    const today = dayOf(now());
    if (current && current.liveAmount != null && dayOf(current.capturedAt) === today) {
      const row = publicRecord(Object.assign({}, current, { pendingUpdate: true, pendingCollect: false }));
      draft.set(shop.store, row);
      return row;
    }
    if (previous && hasNumbers(previous) && dayOf(previous.capturedAt) === today) {
      const row = publicRecord(Object.assign({}, previous, { pendingUpdate: true, pendingCollect: false }));
      draft.set(shop.store, row);
      return row;
    }
    const sample = samples && samples.get(shop.store);
    if (sample && dayOf(stampOf(sample.capturedAt)) === today) {
      const row = rowFromSample(shop, sample);
      draft.set(shop.store, row);
      return row;
    }
    const blank = blankFor(shop);
    blank.pendingCollect = !(shop.login || shop.password);
    draft.set(shop.store, publicRecord(blank));
    return blank;
  }

  function markLoggedOut(shop, draft, samples, reason) {
    const kept = closeSlow(shop, draft, samples);
    const patched = publicRecord(Object.assign({}, kept, {
      loginExpired: true,
      online: false,
      pendingUpdate: false,
      pendingCollect: false,
      offline: false,
      offlineReason: reason || "登录已失效，请重新登录"
    }));
    draft.set(shop.store, patched);
    return patched;
  }

  async function collectShop(shop, known, draft, phase) {
    const secret = shop.password;
    const base = blankFor(shop);
    const started = Date.now();
    if (!shop.login || !secret) {
      base.offlineReason = "组织中心还没有填写这家店的账号";
      shop.password = "";
      return base;
    }
    const saved = known.get(shop.store);
    if (saved && saved.authState === "login_expired") {
      shop.password = "";
      base.loginExpired = true;
      base.pendingCollect = false;
      base.offlineReason = "登录已失效，请重新登录";
      return base;
    }
    let jar = jars.get(shop.store) || null;
    if (!jar || !jar.length) {
      const saved = known.get(shop.store);
      jar = saved && saved.cookies && saved.cookies.length ? saved.cookies : null;
    }
    let logged = Boolean(jar && jar.length);
    if (!logged) {
      try {
        jar = await loginJar(shop);
        logged = Boolean(jar && jar.length);
      } catch (error) {
        shop.password = "";
        base.pendingCollect = false;
        base.loginExpired = true;
        base.offlineReason = String((error && error.message) || "登录没有完成");
        return base;
      }
    }
    shop.password = "";
    if (!logged) {
      base.pendingCollect = false;
      base.loginExpired = true;
      base.offlineReason = "登录没有完成";
      return base;
    }
    try {
      const metrics = await client.fetchHome(jar, {
        store: shop.store,
        shopId: shop.shopId,
        merchantId: shop.merchantId,
        shopName: shop.store,
        onDeal: function (deal) {
          if (phase.closed) {
            return;
          }
          phase.dealMs += Date.now() - started;
          phase.dealMarked = true;
          const partial = live2RecordFromMetrics(shop, Object.assign({}, deal), now());
          partial.pendingCollect = false;
          draft.set(shop.store, publicRecord(partial));
          phase.saveMs += writeStore(file ? file + ".draft" : "", { records: Array.from(draft.values()) });
        }
      });
      if (!phase.dealMarked) {
        phase.dealMs += Date.now() - started;
      } else {
        phase.adsMs += Date.now() - started - phase.dealMs;
      }
      const row = live2RecordFromMetrics(shop, metrics, now());
      if (!row.online && !row.adsFailed) {
        row.offline = true;
        row.offlineReason = row.offlineReason || "京麦没有返回成交金额";
      }
      return row;
    } catch (error) {
      if (error && error.code === "login") {
        try {
          shop.password = secret;
          jar = await loginJar(shop);
          shop.password = "";
          if (jar && jar.length) {
            const metrics = await client.fetchHome(jar, {
              store: shop.store,
              shopId: shop.shopId,
              merchantId: shop.merchantId,
              shopName: shop.store
            });
            if (!phase.dealMarked) {
              phase.dealMs += Date.now() - started;
            }
            return live2RecordFromMetrics(shop, metrics, now());
          }
        } catch (again) {
          shop.password = "";
          base.pendingCollect = false;
          base.loginExpired = true;
          base.offlineReason = String((again && again.message) || "登录已失效，请重新登录");
          return base;
        }
      }
      shop.password = "";
      const previous = draft.get(shop.store) || published.get(shop.store);
      const failed = previous ? Object.assign({}, previous) : base;
      failed.pendingCollect = false;
      failed.loginExpired = Boolean(error && error.code === "login");
      failed.offline = !failed.loginExpired;
      failed.online = failed.loginExpired ? false : Boolean(previous && previous.online);
      failed.offlineReason = String((error && error.message) || "采集没有完成");
      return failed;
    }
  }

  function publish(draft, nextTimings) {
    const started = Date.now();
    published.clear();
    draft.forEach(function (row, name) {
      published.set(name, publicRecord(row));
    });
    updatedAt = now();
    publishedAt = updatedAt;
    const saveMs = writeStore(file, {
      publishedAt: publishedAt,
      updatedAt: updatedAt,
      timings: nextTimings,
      records: Array.from(published.values())
    });
    nextTimings.saveMs += saveMs + (Date.now() - started - saveMs);
    timings = nextTimings;
    if (file) {
      try {
        fs.unlinkSync(file + ".draft");
      } catch {
        /* no draft */
      }
    }
  }

  function slowestOf(totals, shops) {
    const n = Math.max(1, shops);
    const parts = [
      ["queue", totals.queueMs],
      ["deal", totals.dealMs / n],
      ["ads", totals.adsMs / n],
      ["save", totals.saveMs]
    ];
    parts.sort(function (a, b) {
      return b[1] - a[1];
    });
    return parts[0][0];
  }

  async function run(shops, only, known) {
    const targets = (shops || []).filter(function (shop) {
      return shop && shop.store && (!only || shop.store === only);
    });
    const samples = await loadSampleMap();
    adoptSamples(samples);
    const draft = new Map(published);
    const roundStart = Date.now();
    const totals = emptyTimings();
    totals.shops = targets.length;
    let cursor = 0;
    let lastPicked = roundStart;
    async function one(shop) {
      const phase = { dealMs: 0, adsMs: 0, saveMs: 0, dealMarked: false, closed: false };
      const shopStart = Date.now();
      let timer = 0;
      let late = false;
      const job = collectShop(shop, known, draft, phase).then(function (row) {
        if (late || phase.closed) {
          return row;
        }
        if (row && row.loginExpired) {
          markLoggedOut(shop, draft, samples, row.offlineReason);
          return row;
        }
        if (!hasNumbers(row)) {
          closeSlow(shop, draft, samples);
          return row;
        }
        draft.set(shop.store, publicRecord(row));
        return row;
      });
      const timed = await Promise.race([
        job.then(function (row) {
          return { row: row };
        }),
        new Promise(function (resolve) {
          timer = setTimeout(function () {
            resolve({ timeout: true });
          }, budget);
        })
      ]);
      clearTimeout(timer);
      shop.password = "";
      if (timed.timeout) {
        late = true;
        phase.closed = true;
        const elapsed = Date.now() - shopStart;
        if (!phase.dealMarked) {
          phase.dealMs += elapsed;
        } else {
          phase.adsMs += Math.max(0, elapsed - phase.dealMs);
        }
        closeSlow(shop, draft, samples);
        job.catch(function () {});
      }
      totals.dealMs += phase.dealMs;
      totals.adsMs += phase.adsMs;
      totals.saveMs += phase.saveMs;
    }
    async function worker() {
      while (cursor < targets.length) {
        const index = cursor;
        cursor += 1;
        const shop = targets[index];
        lastPicked = Date.now();
        try {
          await one(shop);
        } catch {
          closeSlow(shop, draft, samples);
        }
      }
    }
    const width = Math.max(1, Math.min(widthOf(), targets.length || 1));
    totals.concurrency = width;
    await Promise.all(Array.from({ length: width }, function () { return worker(); }));
    totals.queueMs = lastPicked - roundStart;
    totals.roundMs = Date.now() - roundStart;
    totals.slowest = slowestOf(totals, targets.length);
    publish(draft, totals);
  }

  async function start(cookie, only) {
    if (running) {
      const current = await board(cookie);
      return Object.assign(current, { started: false });
    }
    running = true;
    let shops = [];
    try {
      shops = await loadOrg(cookie);
    } catch (error) {
      running = false;
      throw error;
    }
    const began = Date.now();
    const task = (async function () {
      let known = new Map();
      try {
        const sessions = await sessionsOf();
        (sessions || []).forEach(function (session) {
          if (session && session.store) {
            known.set(session.store, session);
          }
        });
      } catch {
        known = new Map();
      }
      await run(shops, only, known);
    })().finally(function () {
      shops.forEach(function (shop) {
        shop.password = "";
      });
      running = false;
      if (typeof deps.onRoundDone === "function") {
        deps.onRoundDone(began);
      }
    });
    if (deps.track) {
      deps.track(task);
    }
    const view = boardFrom(shops);
    view.running = true;
    view.started = true;
    return view;
  }

  return { board, start, published };
}

const live2Hooks = { onRoundDone: null };
const collector = createLive2Collector({
  onRoundDone: function (began) {
    if (typeof live2Hooks.onRoundDone === "function") {
      live2Hooks.onRoundDone(began);
    }
  }
});

let scheduleCookie = "";

function cookiePath() {
  const store = defaultStorePath();
  if (!store) {
    return "";
  }
  return store + ".cookie";
}

export function noteLive2Cookie(cookie) {
  const value = String(cookie || "").trim();
  if (!value) {
    return;
  }
  scheduleCookie = value;
  const file = cookiePath();
  if (!file) {
    return;
  }
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, value, { mode: 0o600 });
  } catch {
    /* 内存里的登录态仍可供这一轮进程使用 */
  }
}

function loadScheduleCookie() {
  if (scheduleCookie) {
    return scheduleCookie;
  }
  const file = cookiePath();
  if (!file) {
    return "";
  }
  try {
    scheduleCookie = String(fs.readFileSync(file, "utf8") || "").trim();
  } catch {
    scheduleCookie = "";
  }
  return scheduleCookie;
}

export function armLive2Schedule(deps = {}) {
  const env = deps.env || process.env;
  const argv = deps.argv || process.argv;
  if (argv.includes("--test") || env.NODE_TEST_CONTEXT || env.MENGKAI_SMOKE_LIVE) {
    return { started: false };
  }
  const gate = deps.gate || globalThis;
  if (gate.__homeLive2Started) {
    return { started: false };
  }
  gate.__homeLive2Started = true;
  const startRound = deps.startRound || function (cookie) {
    return collector.start(cookie);
  };
  const readCookie = deps.readCookie || loadScheduleCookie;
  const setTimer = deps.setTimeout || setTimeout;
  const clearTimer = deps.clearTimeout || clearTimeout;
  const hooks = deps.hooks || live2Hooks;
  let timer = 0;

  function plan(began) {
    if (timer) {
      clearTimer(timer);
    }
    const origin = Number(began) || Date.now();
    const wait = Math.max(0, LIVE2_INTERVAL_MS - (Date.now() - origin));
    timer = setTimer(run, wait);
    if (timer && typeof timer.unref === "function") {
      timer.unref();
    }
  }

  async function run() {
    const begun = Date.now();
    const cookie = readCookie();
    if (!cookie) {
      plan(begun);
      return;
    }
    try {
      const view = await startRound(cookie);
      if (view && view.started === true) {
        return;
      }
      if (view && view.started === false) {
        return;
      }
      plan(begun);
    } catch (error) {
      console.error("live2 tick", error && error.statusCode ? error.statusCode : "failed");
      plan(begun);
    }
  }

  hooks.onRoundDone = function (began) {
    plan(began || Date.now());
  };
  const bootMs = deps.bootMs == null ? 8000 : deps.bootMs;
  const boot = setTimer(run, bootMs);
  if (boot && typeof boot.unref === "function") {
    boot.unref();
  }
  return { started: true };
}

export function getLive2Board(cookie) {
  return collector.board(cookie);
}

export function startLive2Round(cookie, store) {
  return collector.start(cookie, store ? String(store).trim() : "");
}

export function startLive2Collector() {
  return armLive2Schedule();
}
