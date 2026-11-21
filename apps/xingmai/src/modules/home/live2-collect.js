/**
 * 实时（新版）采集。
 * 组织中心提供账号和密码。每家店在服务器登录后：
 * 京麦经营数据接口取成交金额，京准通 custom-report 当天总览取花费、投产比、总订单金额。
 * 采集失败但登录还在（超时、网络）：会话记 offline，cookie 留下，下一轮继续抓。
 * 登录失效：保留原会话供核验，有账号时静默再登一次；需要验证码就停在失效等人工点。
 * 后台每 10 分钟开一轮；上一轮还在跑时不叠第二轮。
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { jingmaiClient } from "./jingmai-client.js";
import { COLLECTOR_OWNER_HOME, claimCollectorOwner, ensureCollectSession, getSession, listSamples, listSessions, markAuth, saveSample, sessionVersionOf, updateSessionCookies } from "./jingmai-store.js";
import { beijingParts, collectAuthDecision, displayStamp, isMissingDealFieldError, matchCollectIdentity, sampleFields } from "./jingmai.js";
import { homeCollectionGate } from "./jingmai-runner.js";
import { normalizeOrgShops, readServerOrgShops } from "./org-roster.js";
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

export const LIVE2_RUNTIME_MARK = "0.1.1325-home-recovery-batches";
export const LIVE2_INTERVAL_MS = 10 * 60 * 1000;
export const LIVE2_STALE_MS = 15 * 60 * 1000;

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
  return normalizeOrgShops(data.stores || []);
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

function stampMs(stamp) {
  const match = String(stamp || "").match(/(\d{4})[-/](\d{2})[-/](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) {
    return NaN;
  }
  return Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6] || 0)
  );
}

function isFreshStamp(stamp, nowStamp) {
  const sampleMs = stampMs(stamp);
  const nowMs = stampMs(nowStamp);
  if (!Number.isFinite(sampleMs) || !Number.isFinite(nowMs)) {
    return false;
  }
  return nowMs - sampleMs <= LIVE2_STALE_MS;
}

function isLoginExpiredSession(session) {
  if (!session) {
    return false;
  }
  if (/京准通|JZT|-100|广告采集|广告账号|待核验/i.test(String(session.authMessage || ""))) {
    return false;
  }
  return session.authState === "login_expired";
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
  const loginRetries = new Map();
  const clock = deps.clock || Date.now;
  const published = new Map();
  let publishedAt = "";
  let updatedAt = "";
  let timings = emptyTimings();
  let running = false;
  let lastError = "";
  let recoverySlots = 0;
  const loadOrg = deps.loadOrg || readOrgShops;
  const loadBackgroundOrg = deps.loadBackgroundOrg || readServerOrgShops;
  const ensureSession = deps.ensureSession || ensureCollectSession;
  const claimOwner = deps.claimOwner || claimCollectorOwner;
  const persistSample = deps.saveSample || saveSample;
  const inflight = deps.inflight || new Set();
  const humanBlocks = deps.humanProtectsShop || function () { return false; };
  const sessionsOf = deps.listSessions || listSessions;
  const sessionOf = deps.getSession || (deps.listSessions
    ? async function (store) { return (await sessionsOf()).find(function (row) { return row.store === store; }); }
    : getSession);
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

  function applyView(row, nowStamp) {
    const copy = publicRecord(row);
    if (copy.pendingCollect) {
      return copy;
    }
    if (copy.loginExpired) {
      copy.partialData = false;
      copy.online = false;
      copy.offline = false;
      copy.pendingUpdate = false;
      copy.offlineReason = copy.offlineReason || "登录已失效，请重新登录";
      return copy;
    }
    if (copy.dataUnavailable && !copy.offline && isFreshStamp(copy.checkedAt, nowStamp)) {
      copy.online = false;
      copy.offline = false;
      copy.partialData = false;
      copy.pendingUpdate = false;
      return copy;
    }
    if (!isFreshStamp(copy.capturedAt, nowStamp)) {
      copy.partialData = false;
      copy.online = false;
      copy.offline = true;
      copy.pendingUpdate = false;
      copy.offlineReason = copy.offlineReason || "采集已停止";
      return copy;
    }
    if (!copy.offline && (copy.liveAmount == null || copy.paidAmount == null)) {
      copy.online = false;
      copy.partialData = hasNumbers(copy);
      copy.dealFailed = copy.liveAmount == null && copy.paidAmount != null;
      copy.dealReason = copy.dealFailed ? copy.dealReason || "京麦没有返回成交金额" : "";
      copy.adsFailed = copy.liveAmount != null && copy.paidAmount == null;
      copy.adsReason = copy.adsFailed ? copy.adsReason || "京准通没有返回广告金额" : "";
    }
    return copy;
  }

  function rowFor(shop) {
    const savedRow = published.get(shop.store);
    if (!savedRow) {
      return applyView(blankFor(shop), now());
    }
    return applyView(
      Object.assign({}, savedRow, { team: shop.team || savedRow.team, manager: shop.manager || savedRow.manager }),
      now()
    );
  }

  function boardFrom(shops, apiMs) {
    const records = (shops || []).map(rowFor);
    const loginExpiredShops = records.filter(function (row) {
      return row && row.loginExpired;
    }).length;
    return {
      ok: true,
      source: "live2",
      runtimeMark: LIVE2_RUNTIME_MARK,
      running: running,
      lastError: lastError,
      updatedAt: updatedAt,
      publishedAt: publishedAt,
      loginExpiredShops: loginExpiredShops,
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

  function writeOptions(shop, phase) {
    return {
      writer: COLLECTOR_OWNER_HOME,
      expectedShopId: shop.shopId || "",
      sessionVersion: phase.sessionVersion
    };
  }

  function rejectedWrite(result, phase) {
    if (result && result.updated === false && result.reason !== "missing") {
      phase.superseded = true;
      return true;
    }
    return false;
  }

  function inactive(shop, phase) {
    if (humanBlocks(shop.store)) phase.superseded = true;
    return phase.closed || phase.superseded;
  }

  async function persistMetrics(shop, metrics, phase) {
    if (inactive(shop, phase)) return false;
    if (metrics.dealAmount == null && metrics.paidAmount == null) return true;
    const capturedAt = phase.capturedAt || (phase.capturedAt = now());
    let result;
    try {
      result = await persistSample({
        store: shop.store, day: dayOf(capturedAt).replace(/\//g, "-"),
        capturedAt: capturedAt.replace(/\//g, "-"), ok: true, ...sampleFields(metrics)
      }, writeOptions(shop, phase));
    } catch {
      phase.storageError = new Error("采集数据保存失败，等待下一轮重试");
      throw phase.storageError;
    }
    if (result && result.saved === false) {
      phase.superseded = true;
      return false;
    }
    return !inactive(shop, phase);
  }

  async function verifyIdentity(shop, jar, phase, saved) {
    if (!client.fetchAccountIdentity) return;
    if (shop.ambiguousMerchant) {
      throw Object.assign(new Error("商家ID对应多个店铺，需要浏览器核验真实店铺ID"), { code: "identity_missing" });
    }
    let identity;
    try {
      identity = await client.fetchAccountIdentity(jar, undefined, phase.controller.signal);
    } catch (error) {
      // DSM 601 can block the account endpoint while the existing data/browser
      // routes still work. Reuse only an already bound saved session in that case;
      // a new password login must still prove its identity before any write.
      const savedId = String((saved && saved.shopId) || "").trim();
      // Legacy browser-verified sessions can lack shop_id. Their exact full
      // store name is still the durable binding; never accept a conflicting ID.
      const bound = saved && saved.store === shop.store && saved.cookies && saved.cookies.length &&
        (!savedId || [String(shop.shopId || "").trim(), String(shop.merchantId || "").trim()].includes(savedId));
      if (bound && error.code === "network" && /(?:^|\D)601(?:\D|$)/.test(String(error.message || ""))) {
        return;
      }
      throw error;
    }
    const result = matchCollectIdentity({ ...shop, shopName: shop.store }, identity);
    if (!result.ok) {
      throw Object.assign(new Error(result.reason === "identity_missing" ? "未能核验店铺身份" : "登录店铺与组织中心不一致"), { code: result.reason });
    }
  }

  async function keepLogin(shop, jar, phase) {
    if (inactive(shop, phase)) return;
    try {
      const updated = await updateSessionCookies(shop.store, jar, writeOptions(shop, phase));
      if (rejectedWrite(updated, phase) || inactive(shop, phase)) return;
      const marked = await markAuth(shop.store, "ok", "", writeOptions(shop, phase));
      if (rejectedWrite(marked, phase) || inactive(shop, phase)) return;
    } catch {
      /* 这一轮进程里的会话仍然可用 */
    }
    if (!phase.closed && !phase.superseded) {
      jars.set(shop.store, { cookies: jar.slice(), version: phase.sessionVersion });
      loginRetries.delete(shop.store);
    }
  }

  async function markCollectFail(shop, reason, phase, terminal = false) {
    if (humanBlocks(shop.store)) phase.superseded = true;
    if (phase.sessionVersion == null || (phase.closed && !terminal) || phase.superseded) return;
    try {
      const marked = await markAuth(shop.store, "offline", String(reason || "采集超时").slice(0, 200), writeOptions(shop, phase));
      rejectedWrite(marked, phase);
    } catch {
      /* cookie stays; next round still collects */
    }
  }

  async function markExpiredLogin(shop, reason, phase, error = {}) {
    if (inactive(shop, phase)) return;
    jars.delete(shop.store);
    const prior = published.get(shop.store) || {};
    const previous = loginRetries.get(shop.store) || (prior.loginSessionVersion === phase.sessionVersion
      ? { attempts: Number(prior.loginFailures) || 0, version: phase.sessionVersion } : null);
    const attempts = previous && previous.version === phase.sessionVersion ? previous.attempts + 1 : 1;
    loginRetries.set(shop.store, {
      version: phase.sessionVersion, attempts, reason,
      until: error.recoveryDeferred ? phase.nextRecoveryBatchAt
        : clock() + Math.min(60, 15 * 2 ** (attempts - 1)) * 60 * 1000
    });
    phase.loginState = {
      checkedAt: now(), loginSessionVersion: phase.sessionVersion, loginFailures: attempts,
      loginNeedsHuman: error.needsHuman === true || error.loginAttempted === true,
      loginRetryAt: loginRetries.get(shop.store).until,
      platformLimited: false, platformRetryAt: 0,
      ...(error.loginAttempted ? { passwordAttemptedVersion: phase.sessionVersion } : {})
    };
    try {
      const marked = await markAuth(shop.store, "login_expired", reason || "登录已失效，请重新登录", writeOptions(shop, phase));
      rejectedWrite(marked, phase);
    } catch {
      /* board still shows loginExpired from this round */
    }
  }

  async function holdPlatform(shop, phase, previous, error) {
    const prior = previous || {};
    const sameSession = prior.platformSessionVersion === phase.sessionVersion;
    const attempts = (sameSession ? Number(prior.platformFailures) || 0 : 0) + 1;
    const minutes = Math.min(60, 20 * 2 ** (attempts - 1));
    const reason = String(error.message || "京东暂时限制当前请求").slice(0, 120) + "；暂停重试" + minutes + "分钟";
    await markCollectFail(shop, reason, phase);
    if (phase.superseded || phase.closed) return null;
    // Persist the hold with the snapshot so a process restart cannot reset it.
    // A later verified login changes sessionVersion and releases the old hold.
    return { ...prior, shop: shop.store, online: false, offline: true, loginExpired: false,
      pendingCollect: false, pendingUpdate: false, partialData: false, dataUnavailable: false,
      platformLimited: true, platformRetryAt: clock() + minutes * 60000,
      platformFailures: attempts, platformSessionVersion: phase.sessionVersion,
      ...(error.loginAttempted ? { passwordAttemptedVersion: phase.sessionVersion } : {}),
      checkedAt: now(),
      offlineReason: reason };
  }

  function silentLoginFailed(error) {
    const message = String((error && error.message) || "");
    return Boolean(error && (error.code === "login" || /验证码|滑块|安全验证|账号异常|密码不正确/.test(message)));
  }

  async function loginJar(shop) {
    if (!shop.login || !shop.password || !client.login) {
      return null;
    }
    return client.login(shop.login, shop.password);
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

  function keepNumbers(shop, draft, samples) {
    const current = draft.get(shop.store);
    const previous = published.get(shop.store);
    const today = dayOf(now());
    if (current && current.liveAmount != null && dayOf(current.capturedAt) === today) {
      return current;
    }
    if (previous && hasNumbers(previous) && dayOf(previous.capturedAt) === today) {
      return previous;
    }
    const sample = samples && samples.get(shop.store);
    if (sample && dayOf(stampOf(sample.capturedAt)) === today) {
      return rowFromSample(shop, sample);
    }
    return null;
  }

  async function closeSlow(shop, draft, samples, phase) {
    if (phase.superseded) return;
    const stamp = now();
    const kept = keepNumbers(shop, draft, samples);
    if (kept && kept.liveAmount != null && !kept.loginExpired && isFreshStamp(kept.capturedAt, stamp)) {
      const row = publicRecord(Object.assign({}, kept, {
        pendingUpdate: true,
        pendingCollect: false,
        loginExpired: false,
        online: true,
        offline: false
      }));
      draft.set(shop.store, row);
      return row;
    }
    const base = kept ? Object.assign({}, kept) : blankFor(shop);
    const reason = kept && !isFreshStamp(kept.capturedAt, stamp) ? "采集已停止" : "采集超时";
    const row = publicRecord(Object.assign({}, base, {
      pendingUpdate: false,
      pendingCollect: false,
      loginExpired: false,
      online: false,
      offline: true,
      offlineReason: reason
    }));
    await markCollectFail(shop, reason, phase, true);
    if (!phase.superseded) draft.set(shop.store, row);
    return row;
  }

  function markLoggedOut(shop, draft, samples, reason, state = {}) {
    const kept = keepNumbers(shop, draft, samples) || blankFor(shop);
    const retry = Object.fromEntries(["checkedAt", "loginSessionVersion", "loginFailures", "loginNeedsHuman",
      "loginRetryAt", "platformLimited", "platformRetryAt", "passwordAttemptedVersion"]
      .filter(key => key in state).map(key => [key, state[key]]));
    const patched = publicRecord(Object.assign({}, kept, retry, {
      loginExpired: true,
      partialData: false,
      platformLimited: false,
      platformRetryAt: 0,
      online: false,
      pendingUpdate: false,
      pendingCollect: false,
      offline: false,
      offlineReason: reason || "登录已失效，请重新登录"
    }));
    draft.set(shop.store, patched);
    return patched;
  }

  async function collectShop(shop, draft, phase) {
    const base = { ...(draft.get(shop.store) || published.get(shop.store) || blankFor(shop)),
      online: false, pendingCollect: false, pendingUpdate: false, loginExpired: false, offline: false };
    const started = Date.now();
    // Read after obtaining a worker slot: a queued shop may have been re-logged in.
    // A failed read must never be treated as an empty jar and trigger password login.
    const saved = await sessionOf(shop.store) || await ensureSession(shop.store, shop.shopId || "");
    if (phase.closed || (saved && saved.enabled === false)) return null;
    phase.sessionVersion = sessionVersionOf(saved) || "g:0";
    if (inactive(shop, phase)) return null;
    // Check durable holds before identity/network requests. A verified human
    // login changes sessionVersion, so it immediately releases the old hold.
    if (base.loginSessionVersion === phase.sessionVersion &&
      (base.loginNeedsHuman || Number(base.loginRetryAt) > clock())) {
      return { ...base, online: false, offline: false, loginExpired: true, partialData: false };
    }
    if (base.platformLimited && base.platformSessionVersion === phase.sessionVersion && Number(base.platformRetryAt) > clock()) {
      return { ...base, online: false, offline: true, loginExpired: false, partialData: false };
    }
    const expired = isLoginExpiredSession(saved);
    if (expired && client.recoverBrowserSession) {
      if (recoverySlots <= 0) return { ...base, loginExpired: true, online: false, offline: false,
        loginSessionVersion: phase.sessionVersion, loginRetryAt: phase.nextRecoveryBatchAt,
        offlineReason: "登录失效，等待下一轮分批恢复" };
      recoverySlots--;
      phase.recoverySlot = true;
    }
    const claimed = await claimOwner(shop.store, COLLECTOR_OWNER_HOME);
    if (!claimed || !claimed.ok || inactive(shop, phase)) return null;
    const prior = saved && Array.isArray(saved.cookies) ? saved.cookies : [];
    const cached = jars.get(shop.store);
    if (expired || (cached && cached.version !== phase.sessionVersion)) {
      jars.delete(shop.store);
    }
    // Durable state wins over a process cache, including after an external re-login.
    let jar = prior.length && (!expired || client.fetchAccountIdentity) ? prior : (!expired && jars.get(shop.store)?.cookies) || null;
    // The browser must check/recover an expired session even when the legacy
    // account endpoint only returns a tolerated 601 response.
    if (expired && client.recoverBrowserSession) jar = null;
    let verified = false;
    if (jar && client.fetchAccountIdentity) {
      try {
        await verifyIdentity(shop, jar, phase, saved);
        verified = true;
      } catch (error) {
        if (inactive(shop, phase)) return null;
        if (error.code === "platform_limited") return holdPlatform(shop, phase, base, error);
        if (error.code === "login" || (error.code === "identity_missing" && client.recoverBrowserSession)) jar = null;
        else {
          await markCollectFail(shop, error.message, phase);
          const kept = draft.get(shop.store) || published.get(shop.store) || base;
          return { ...kept, pendingCollect: false, pendingUpdate: false, loginExpired: false,
            offline: true, online: false, offlineReason: error.message };
        }
      }
    }
    if (inactive(shop, phase)) return null;
    let logged = Boolean(jar && jar.length);
    if (!logged) {
      const retry = loginRetries.get(shop.store);
      if (retry && retry.version === phase.sessionVersion && retry.until > clock()) {
        return { ...base, pendingCollect: false, loginExpired: true, online: false, offlineReason: retry.reason };
      }
      if (!client.recoverBrowserSession && (!shop.login || !shop.password)) {
        base.pendingCollect = true;
        base.offlineReason = "组织中心还没有填写这家店的账号";
        shop.password = "";
        return base;
      }
      try {
        if (client.recoverBrowserSession) {
          const recovered = await client.recoverBrowserSession(prior, phase.controller.signal, {
            store: shop.store, shopId: shop.shopId, merchantId: shop.merchantId,
            ambiguousMerchant: shop.ambiguousMerchant, requireIdentity: true,
            canRecover: () => !inactive(shop, phase),
            takeReloginSlot: () => {
              if (inactive(shop, phase)) return false;
              if (phase.recoverySlot) return true;
              if (recoverySlots <= 0) return false;
              recoverySlots--;
              phase.recoverySlot = true;
              return true;
            },
            credentials: base.passwordAttemptedVersion !== phase.sessionVersion && shop.login && shop.password
              ? { loginName: shop.login, password: shop.password } : undefined
          });
          jar = recovered.cookies;
          phase.browserDeal = recovered.deal;
          verified = true;
        } else {
          jar = await loginJar(shop);
        }
        if (phase.closed || phase.superseded) return null;
        logged = Boolean(jar && jar.length);
      } catch (error) {
        shop.password = "";
        if (phase.closed || phase.superseded) return null;
        if (error.code === "platform_limited") return holdPlatform(shop, phase, base, error);
        const authFailed = silentLoginFailed(error);
        const reason = String((error && error.message) || "登录没有完成").slice(0, 200);
        if (error.loginAttempted) base.passwordAttemptedVersion = phase.sessionVersion;
        if (authFailed) await markExpiredLogin(shop, reason, phase, error);
        else await markCollectFail(shop, reason, phase);
        base.pendingCollect = false;
        base.loginExpired = authFailed;
        base.offline = !authFailed;
        base.online = false;
        base.offlineReason = reason;
        Object.assign(base, phase.loginState || {});
        return base;
      }
    }
    shop.password = "";
    if (!logged) {
      await markExpiredLogin(shop, "登录没有完成", phase);
      base.pendingCollect = false;
      base.loginExpired = true;
      base.offline = false;
      base.online = false;
      base.offlineReason = "登录没有完成";
      Object.assign(base, phase.loginState || {});
      return base;
    }
    try {
      if (!verified) await verifyIdentity(shop, jar, phase);
      if (inactive(shop, phase)) return null;
      const metrics = await client.fetchHome(jar, phase.controller.signal, {
        store: shop.store,
        shopId: shop.shopId,
        merchantId: shop.merchantId,
        ambiguousMerchant: shop.ambiguousMerchant,
        requireIdentity: true,
        browserDeal: phase.browserDeal,
        shopName: shop.store,
        onDeal: async function (deal) {
          if (phase.closed || phase.superseded) {
            return;
          }
          phase.dealMs += Date.now() - started;
          phase.dealMarked = true;
          if (!await persistMetrics(shop, deal, phase)) return;
          const partial = live2RecordFromMetrics(shop, Object.assign({}, deal), phase.capturedAt);
          partial.pendingCollect = false;
          draft.set(shop.store, publicRecord(partial));
          phase.saveMs += writeStore(file ? file + ".draft" : "", { records: Array.from(draft.values()) });
        }
      });
      if (inactive(shop, phase)) return null;
      if (phase.storageError) throw phase.storageError;
      if (!await persistMetrics(shop, metrics, phase)) return null;
      if (!phase.dealMarked) {
        phase.dealMs += Date.now() - started;
      } else {
        phase.adsMs += Date.now() - started - phase.dealMs;
      }
      const row = live2RecordFromMetrics(shop, metrics, phase.capturedAt);
      if (!row.online && !row.adsFailed) {
        row.offline = true;
        row.offlineReason = row.offlineReason || "京麦没有返回成交金额";
      }
      if (row.online || row.adsFailed || row.dealFailed) {
        row.loginExpired = false;
        row.offline = false;
        row.offlineReason = "";
        await keepLogin(shop, jar, phase);
      } else {
        await markCollectFail(shop, row.offlineReason, phase);
      }
      return row;
    } catch (error) {
      shop.password = "";
      if (phase.closed || phase.superseded) return null;
      const previous = draft.get(shop.store) || published.get(shop.store);
      if (error.code === "platform_limited") return holdPlatform(shop, phase, previous || base, error);
      if (error.code === "data_unavailable") {
        await keepLogin(shop, jar, phase);
        return { ...(previous || base), online: false, offline: false, loginExpired: false,
          pendingCollect: false, pendingUpdate: false, partialData: false, dataUnavailable: true,
          checkedAt: now(), offlineReason: String(error.message || "平台暂未提供数据").slice(0, 200) };
      }
      if (isMissingDealFieldError(error)) {
        const kept = previous ? Object.assign({}, previous) : base;
        kept.pendingCollect = false;
        kept.loginExpired = false;
        kept.offline = false;
        kept.offlineReason = "";
        kept.online = hasNumbers(kept);
        await keepLogin(shop, jar, phase);
        return kept;
      }
      const decision = collectAuthDecision(error);
      if (decision.authState === "login_expired") {
        const reason = String(error.message || decision.authMessage).slice(0, 200);
        await markExpiredLogin(shop, reason, phase, error);
        const failed = previous ? Object.assign({}, previous) : base;
        failed.pendingCollect = false;
        failed.loginExpired = true;
        failed.offline = false;
        failed.online = false;
        failed.pendingUpdate = false;
        failed.offlineReason = reason;
        Object.assign(failed, phase.loginState || {});
        return failed;
      }
      const reason = phase.storageError ? phase.storageError.message : decision.authMessage || String((error && error.message) || "采集超时");
      await markCollectFail(shop, reason, phase);
      const failed = previous ? Object.assign({}, previous) : base;
      failed.pendingCollect = false;
      failed.loginExpired = false;
      failed.offline = true;
      failed.online = false;
      failed.pendingUpdate = false;
      failed.offlineReason = reason;
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

  async function run(shops, only) {
    // Queue capacity is per round. A shop that has not attempted recovery must
    // become eligible at the next scheduled start, not ten minutes after it was
    // skipped near the end of a slower round. Real login failures keep backoff.
    const nextRecoveryBatchAt = clock() + LIVE2_INTERVAL_MS;
    recoverySlots = Math.max(1, Math.floor(Number(deps.recoveryLimit) || 3));
    const targets = (shops || []).filter(function (shop) {
      return shop && shop.store && (!only || shop.store === only);
    }).sort((a, b) => Number(Boolean(published.get(a.store)?.loginExpired)) - Number(Boolean(published.get(b.store)?.loginExpired)));
    const samples = await loadSampleMap();
    adoptSamples(samples);
    const draft = new Map(published);
    const roundStart = Date.now();
    const totals = emptyTimings();
    totals.shops = targets.length;
    let cursor = 0;
    let lastPicked = roundStart;
    async function one(shop) {
      if (inflight.has(shop.store) || humanBlocks(shop.store)) return;
      inflight.add(shop.store);
      const phase = {
        dealMs: 0, adsMs: 0, saveMs: 0, dealMarked: false, closed: false,
        superseded: false, sessionVersion: null, nextRecoveryBatchAt, controller: new globalThis.AbortController()
      };
      const shopStart = Date.now();
      let timer = 0;
      const job = collectShop(shop, draft, phase).then(async function (row) {
        if (!row || phase.closed || phase.superseded) {
          return row;
        }
        if (row && row.pendingCollect) {
          draft.set(shop.store, publicRecord(row));
          return row;
        }
        if (row && row.loginExpired) {
          markLoggedOut(shop, draft, samples, row.offlineReason, row);
          return row;
        }
        if (!hasNumbers(row) && !row.offline && !row.dataUnavailable) {
          await closeSlow(shop, draft, samples, phase);
          return row;
        }
        draft.set(shop.store, publicRecord(row));
        return row;
      });
      // Keep the shared lock until even a cancellation-ignoring client settles.
      job.then(() => inflight.delete(shop.store), () => inflight.delete(shop.store));
      try {
        const timed = await Promise.race([
          job.then(function (row) {
            return { row: row };
          }),
          new Promise(function (resolve) {
            timer = setTimeout(function () {
              // Close writeback before aborting: an abort handler may reject immediately.
              phase.closed = true;
              phase.controller.abort();
              resolve({ timeout: true });
            }, budget);
          })
        ]);
        if (timed.timeout) {
          const elapsed = Date.now() - shopStart;
          if (!phase.dealMarked) {
            phase.dealMs += elapsed;
          } else {
            phase.adsMs += Math.max(0, elapsed - phase.dealMs);
          }
          await closeSlow(shop, draft, samples, phase);
          job.catch(function () {});
        }
      } catch {
        await closeSlow(shop, draft, samples, phase);
      } finally {
        clearTimeout(timer);
        phase.closed = true;
        phase.controller.abort();
        shop.password = "";
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
        await one(shop);
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

  async function start(cookie, only, background = false) {
    if (running) {
      const current = background ? { running: true } : await board(cookie);
      return Object.assign(current, { started: false });
    }
    running = true;
    lastError = "";
    let shops = [];
    try {
      shops = await (background ? loadBackgroundOrg() : loadOrg(cookie));
    } catch (error) {
      running = false;
      throw error;
    }
    const began = Date.now();
    const task = (async function () {
      await run(shops, only);
    })().catch(function () {
      lastError = "采集结果保存失败，等待下一轮重试";
    }).finally(function () {
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
  ...homeCollectionGate(),
  onRoundDone: function (began) {
    if (typeof live2Hooks.onRoundDone === "function") {
      live2Hooks.onRoundDone(began);
    }
  }
});

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
  const startRound = deps.startRound || function () {
    return collector.start("", "", true);
  };
  const readCookie = deps.readCookie || function () { return ""; };
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
