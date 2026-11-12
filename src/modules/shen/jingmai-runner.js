import { jingmaiClient } from "./jingmai-client.js";
import { beijingParts, runTick } from "./jingmai.js";
import { listCollectTargets, markAuth, readJingmaiLive, saveSample, saveSession, setRoster } from "./jingmai-store.js";

const INTERVAL_MS = 5 * 60 * 1000;
const inflight = new Set();
const qrPending = new Map();

const defaultDeps = {
  loadOrg: loadOrgShops,
  client: jingmaiClient
};

let deps = defaultDeps;

export function setJingmaiDeps(next) {
  deps = Object.assign({}, defaultDeps, next || {});
}

export function resetJingmaiDeps() {
  deps = defaultDeps;
  qrPending.clear();
}

export async function loadOrgShops(cookie, fetchImpl = fetch) {
  const origin = process.env.SHEN_INTERNAL_ORIGIN || "http://127.0.0.1:" + (process.env.PORT || 3000);
  const response = await fetchImpl(origin + "/api/people/org/stores?team=" + encodeURIComponent("沈子晗组"), {
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
    .filter(function (store) {
      return store && (store.team === "沈子晗组" || store.manager === "沈子晗");
    })
    .map(function (store) {
      return {
        store: String(store.storeName || "").trim(),
        enabled: store.statusKey === "operating" || (store.statusKey == null && store.remark === "运营中"),
        login: String(store.login || ""),
        password: String(store.password || "")
      };
    })
    .filter(function (store) {
      return store.store;
    });
}

async function connectOne(shop) {
  if (!shop.enabled) {
    await setRoster([{ store: shop.store, enabled: false }]);
    return { store: shop.store, skipped: true };
  }
  if (!shop.login || !shop.password) {
    return { store: shop.store, ok: false, auth: false, message: "未填写登录账号" };
  }
  if (inflight.has(shop.store)) {
    return { store: shop.store, ok: false, auth: false, message: "这家店正在采集" };
  }
  inflight.add(shop.store);
  try {
    const cookies = await deps.client.login(shop.login, shop.password);
    const metrics = await deps.client.fetchHome(cookies);
    await saveSession(shop.store, { cookies: cookies, authState: "ok", authMessage: "", enabled: true });
    const now = beijingParts();
    await saveSample({
      store: shop.store,
      day: now.day,
      capturedAt: now.stamp,
      dealAmount: metrics.dealAmount,
      orderCount: metrics.orderCount,
      customerCount: metrics.customerCount,
      yesterdayAmount: metrics.yesterdayAmount,
      ok: true
    });
    return { store: shop.store, ok: true };
  } catch (error) {
    if (error && error.code === "login") {
      await saveSession(shop.store, {
        cookies: [],
        authState: "login_expired",
        authMessage: "登录已失效，请重新登录",
        enabled: true
      });
      return { store: shop.store, ok: false, auth: true, message: "登录已失效，请重新登录" };
    }
    return { store: shop.store, ok: false, auth: false, message: "连接超时，请稍后再试" };
  } finally {
    shop.login = "";
    shop.password = "";
    inflight.delete(shop.store);
  }
}

export async function connectJingmai({ cookie }) {
  const shops = await deps.loadOrg(cookie);
  const results = await Promise.all(shops.map(connectOne));
  const linked = results.filter(function (item) {
    return item.ok;
  }).length;
  const relogin = results.filter(function (item) {
    return item.auth;
  }).length;
  return { ok: true, linked: linked, relogin: relogin, results: results };
}

export async function updateJingmaiRoster(body) {
  const shops = Array.isArray(body && body.shops) ? body.shops : [];
  await setRoster(
    shops.map(function (shop) {
      return { store: shop.store || shop.storeName, enabled: Boolean(shop.enabled) };
    })
  );
  return { ok: true };
}

export async function jingmaiLive() {
  return readJingmaiLive();
}

export async function beginRelogin(store) {
  const name = String(store || "").trim();
  if (!name) {
    const error = new Error("请选择店铺");
    error.statusCode = 400;
    throw error;
  }
  const started = await deps.client.startQr();
  qrPending.set(name, { uuid: started.uuid, jar: started.jar });
  return { ok: true, store: name, status: "waiting", image: started.image };
}

export async function pollRelogin(store) {
  const name = String(store || "").trim();
  const pending = qrPending.get(name);
  if (!pending) {
    return { ok: true, store: name, status: "missing" };
  }
  const polled = await deps.client.pollQr(pending);
  pending.jar = polled.jar;
  if (polled.status === "expired" || polled.status === "cancelled") {
    qrPending.delete(name);
    return { ok: true, store: name, status: polled.status };
  }
  if (polled.status !== "ok") {
    return { ok: true, store: name, status: polled.status };
  }
  try {
    const metrics = await deps.client.fetchHome(polled.jar);
    await saveSession(name, { cookies: polled.jar, authState: "ok", authMessage: "", enabled: true });
    const now = beijingParts();
    await saveSample({
      store: name,
      day: now.day,
      capturedAt: now.stamp,
      dealAmount: metrics.dealAmount,
      orderCount: metrics.orderCount,
      customerCount: metrics.customerCount,
      yesterdayAmount: metrics.yesterdayAmount,
      ok: true
    });
    qrPending.delete(name);
    return { ok: true, store: name, status: "ok" };
  } catch (error) {
    if (error && error.code === "login") {
      return { ok: true, store: name, status: "login", message: "扫码未完成，请用这家店的京麦再扫一次" };
    }
    return { ok: true, store: name, status: "waiting" };
  }
}

export async function jingmaiTick() {
  await runTick({
    inflight: inflight,
    listTargets: listCollectTargets,
    fetchHome: function (cookies) {
      return deps.client.fetchHome(cookies);
    },
    saveSample: saveSample,
    markAuth: markAuth,
    now: beijingParts
  });
}

export function startJingmaiCollector() {
  if (process.argv.includes("--test")) {
    return;
  }
  if (globalThis.__shenJingmaiStarted) {
    return;
  }
  globalThis.__shenJingmaiStarted = true;
  const timer = setInterval(function () {
    jingmaiTick().catch(function (error) {
      console.error("jingmai tick", error && error.code ? error.code : "failed");
    });
  }, INTERVAL_MS);
  if (typeof timer.unref === "function") {
    timer.unref();
  }
  const boot = setTimeout(function () {
    jingmaiTick().catch(function (error) {
      console.error("jingmai boot", error && error.code ? error.code : "failed");
    });
  }, 8000);
  if (typeof boot.unref === "function") {
    boot.unref();
  }
}
