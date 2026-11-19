/**
 * 实时（新版）采集。
 * 组织中心提供账号和密码。每家店在服务器登录后：
 * 京麦经营数据接口取成交金额，京准通 custom-report 当天总览取花费、投产比、总订单金额。
 * 不写旧京麦会话表，不启动旧采集循环。
 */
import { jingmaiClient } from "./jingmai-client.js";
import { listSessions } from "./jingmai-store.js";
import { beijingParts, displayStamp } from "./jingmai.js";
import { blankLive2Record, live2RecordFromMetrics } from "./live2.js";

const CONCURRENCY = 2;
export const LIVE2_RUNTIME_MARK = "0.1.1277-live2-login";

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
        shopId: String(store.shopId || store.storeId || "").trim()
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

export function createLive2Collector(deps = {}) {
  const jars = new Map();
  const samples = new Map();
  let running = false;
  let updatedAt = "";
  const loadOrg = deps.loadOrg || readOrgShops;
  const sessionsOf = deps.listSessions || listSessions;
  const client = deps.client || jingmaiClient;
  const now = deps.now || stampNow;

  function boardFrom(shops) {
    const records = (shops || []).map(function (shop) {
      const saved = samples.get(shop.store);
      if (!saved) {
        return blankLive2Record(shop);
      }
      return publicRecord(Object.assign({}, saved, { team: shop.team || saved.team, manager: shop.manager || saved.manager }));
    });
    return {
      ok: true,
      source: "live2",
      runtimeMark: LIVE2_RUNTIME_MARK,
      running: running,
      updatedAt: updatedAt,
      records: records
    };
  }

  async function board(cookie) {
    const shops = await loadOrg(cookie);
    shops.forEach(function (shop) {
      shop.password = "";
    });
    return boardFrom(shops);
  }

  async function loginJar(shop) {
    if (!shop.login || !shop.password || !client.login) {
      return null;
    }
    const jar = await client.login(shop.login, shop.password);
    if (jar && jar.length) {
      jars.set(shop.store, jar.slice());
    }
    return jar;
  }

  async function collectShop(shop, known) {
    const secret = shop.password;
    const base = blankLive2Record(shop);
    if (!shop.login || !secret) {
      base.offlineReason = "组织中心还没有填写这家店的账号";
      shop.password = "";
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
        shopName: shop.store
      });
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
              shopName: shop.store
            });
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
      const previous = samples.get(shop.store);
      const failed = previous ? Object.assign({}, previous) : base;
      failed.pendingCollect = false;
      failed.loginExpired = Boolean(error && error.code === "login");
      failed.offline = !failed.loginExpired;
      failed.online = failed.loginExpired ? false : Boolean(previous && previous.online);
      failed.offlineReason = String((error && error.message) || "采集没有完成");
      return failed;
    }
  }

  async function run(shops, only, known) {
    const targets = (shops || []).filter(function (shop) {
      return shop && shop.store && (!only || shop.store === only);
    });
    let cursor = 0;
    async function worker() {
      while (cursor < targets.length) {
        const index = cursor;
        cursor += 1;
        const shop = targets[index];
        const row = await collectShop(shop, known);
        shop.password = "";
        samples.set(shop.store, publicRecord(row));
        if (row.capturedAt) {
          updatedAt = row.capturedAt;
        }
      }
    }
    const width = Math.max(1, Math.min(CONCURRENCY, targets.length));
    await Promise.all(Array.from({ length: width }, function () { return worker(); }));
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
    const task = run(shops, only, known).finally(function () {
      shops.forEach(function (shop) {
        shop.password = "";
      });
      running = false;
    });
    if (deps.track) {
      deps.track(task);
    }
    const view = boardFrom(shops);
    view.running = true;
    view.started = true;
    return view;
  }

  return { board, start, samples };
}

const collector = createLive2Collector();

export function getLive2Board(cookie) {
  return collector.board(cookie);
}

export function startLive2Round(cookie, store) {
  return collector.start(cookie, store ? String(store).trim() : "");
}
