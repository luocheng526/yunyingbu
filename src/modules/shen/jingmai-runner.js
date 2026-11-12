import { browserReady, ensureChrome, jingmaiDesk } from "./jingmai-desk.js";
import { jingmaiClient } from "./jingmai-client.js";
import { beijingParts, runTick } from "./jingmai.js";
import { listCollectTargets, listSessions, markAuth, readJingmaiLive, saveSample, saveSession, setRoster } from "./jingmai-store.js";

const INTERVAL_MS = 5 * 60 * 1000;
const inflight = new Set();
const qrPending = new Map();
const passwordPending = new Map();
let loginQueue = [];
let loginCursor = { index: 0, total: 0, store: "" };

const defaultDeps = {
  loadOrg: loadOrgShops,
  client: jingmaiClient,
  desk: jingmaiDesk
};

let deps = defaultDeps;

export function setJingmaiDeps(next) {
  deps = Object.assign({}, defaultDeps, next || {});
}

function wipeQueue() {
  loginQueue.forEach(function (shop) {
    shop.login = "";
    shop.password = "";
  });
  loginQueue = [];
  loginCursor = { index: 0, total: 0, store: "" };
}

export function resetJingmaiDeps() {
  if (deps.desk && deps.desk.reset) {
    deps.desk.reset();
  }
  deps = defaultDeps;
  qrPending.clear();
  for (const pending of passwordPending.values()) {
    pending.password = "";
  }
  passwordPending.clear();
  wipeQueue();
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

function publicState(state) {
  return {
    ok: true,
    store: state.store || loginCursor.store,
    status: state.status,
    message: state.message || "",
    index: state.index || loginCursor.index,
    total: state.total || loginCursor.total
  };
}

async function rememberLogin(store, cookies) {
  await saveSession(store, { cookies: cookies, authState: "ok", authMessage: "", enabled: true });
  try {
    const metrics = await deps.client.fetchHome(cookies);
    const now = beijingParts();
    await saveSample({
      store: store,
      day: now.day,
      capturedAt: now.stamp,
      dealAmount: metrics.dealAmount,
      orderCount: metrics.orderCount,
      customerCount: metrics.customerCount,
      yesterdayAmount: metrics.yesterdayAmount,
      ok: true
    });
  } catch (error) {
    if (error && error.code === "login") {
      await markAuth(store, "login_expired", "登录已失效，请重新登录");
      return false;
    }
  }
  return true;
}

async function startQueued(shop) {
  loginCursor.store = shop.store;
  const opened = await deps.desk.open({ store: shop.store, loginName: shop.login, password: shop.password });
  shop.login = "";
  shop.password = "";
  if (opened.status === "ok") {
    const kept = await rememberLogin(shop.store, opened.cookies || []);
    await deps.desk.close();
    if (!kept) {
      return advanceAfterFailure(shop.store, "登录没有通过，请再试一次");
    }
    return advanceAfterSuccess(shop.store);
  }
  if (opened.status === "verify") {
    return publicState({ status: "screen", store: shop.store, message: "请在下面的服务器画面里完成验证。点画面就是在服务器上操作。" });
  }
  await deps.desk.close();
  if (String(opened.message || "").includes("浏览器")) {
    wipeQueue();
    return publicState({ status: "login", store: shop.store, message: opened.message });
  }
  return advanceAfterFailure(shop.store, opened.message || "登录没有通过，请再试一次");
}

async function advanceAfterSuccess(store) {
  const next = loginQueue.shift();
  if (!next) {
    return publicState({ status: "ok", store: store, message: store + " 已在服务器登录" });
  }
  loginCursor.index += 1;
  return startQueued(next);
}

async function advanceAfterFailure(store, message) {
  await markAuth(store, "login_expired", message);
  const next = loginQueue.shift();
  if (!next) {
    return publicState({ status: "login", store: store, message: message });
  }
  loginCursor.index += 1;
  const started = await startQueued(next);
  if (started.status === "screen") {
    started.message = store + "：" + message;
  }
  return started;
}

async function queueShops(shops) {
  wipeQueue();
  if (deps.desk && deps.desk.close) {
    await deps.desk.close();
  }
  loginQueue = shops.map(function (shop) {
    const copy = { store: shop.store, login: shop.login, password: shop.password };
    shop.login = "";
    shop.password = "";
    return copy;
  });
  loginCursor = { index: 1, total: loginQueue.length, store: "" };
  const first = loginQueue.shift();
  if (!first) {
    return publicState({ status: "done", message: "没有需要登录的店" });
  }
  return startQueued(first);
}

export async function beginRelogin(store, cookie) {
  const name = String(store || "").trim();
  if (!name) {
    const error = new Error("请选择店铺");
    error.statusCode = 400;
    throw error;
  }
  const shops = await deps.loadOrg(cookie || "");
  const shop = shops.find(function (item) {
    return item.store === name;
  });
  if (!shop || shop.enabled === false) {
    return { ok: true, store: name, status: "login", message: "这家店已停用" };
  }
  if (!shop.login || !shop.password) {
    return { ok: true, store: name, status: "login", message: "组织中心还没有填写这家店的账号" };
  }
  const queued = { store: shop.store, login: shop.login, password: shop.password };
  shop.login = "";
  shop.password = "";
  return queueShops([queued]);
}

export async function beginReloginAll(cookie) {
  const shops = await deps.loadOrg(cookie || "");
  const sessions = await listSessions();
  const ready = new Set(
    sessions
      .filter(function (session) {
        return session.authState === "ok" && (session.cookies || []).some(function (item) {
          return item.name === "thor" || item.name === "pt_key";
        });
      })
      .map(function (session) {
        return session.store;
      })
  );
  const pending = shops.filter(function (shop) {
    return shop.enabled !== false && shop.login && shop.password && !ready.has(shop.store);
  });
  shops.forEach(function (shop) {
    if (!pending.includes(shop)) {
      shop.login = "";
      shop.password = "";
    }
  });
  if (!pending.length) {
    return { ok: true, status: "done", message: "需要登录的店都已经在服务器上" };
  }
  return queueShops(pending);
}

export async function reloginState(store) {
  const name = loginCursor.store || String(store || "").trim();
  if (!name) {
    return publicState({ status: "missing", message: "请重新打开登录" });
  }
  const state = await deps.desk.poll(name);
  if (state.status === "ok") {
    const cookies = state.cookies || [];
    const kept = await rememberLogin(name, cookies);
    await deps.desk.close();
    if (!kept) {
      return advanceAfterFailure(name, "登录没有通过，请再试一次");
    }
    return advanceAfterSuccess(name);
  }
  if (state.status === "login") {
    await deps.desk.close();
    return advanceAfterFailure(name, state.message || "登录没有通过，请再试一次");
  }
  if (state.status === "missing") {
    return publicState({ status: "missing", store: name, message: state.message || "请重新打开登录" });
  }
  return publicState({ status: "screen", store: name, message: state.message || "请在下面的服务器画面里完成验证。点画面就是在服务器上操作。" });
}

export async function reloginScreen(store) {
  const name = loginCursor.store || String(store || "").trim();
  return deps.desk.shot(name);
}

export async function reloginInput(body) {
  const name = loginCursor.store || String(body && body.store || "").trim();
  if (!name) {
    return publicState({ status: "missing", message: "请重新打开登录" });
  }
  if (body && body.text) {
    await deps.desk.type(name, body.text);
  }
  if (body && body.x != null && body.y != null) {
    await deps.desk.click(name, Number(body.x), Number(body.y));
  }
  return reloginState(name);
}

export function jingmaiBrowser() {
  return { ok: true, browser: browserReady() };
}

export async function cancelRelogin() {
  wipeQueue();
  if (deps.desk && deps.desk.close) {
    await deps.desk.close();
  }
  return { ok: true };
}

export async function finishRelogin(store, authCode) {
  const name = String(store || "").trim();
  const pending = passwordPending.get(name);
  if (!pending) {
    return { ok: true, store: name, status: "missing", message: "请重新打开登录" };
  }
  const password = pending.password;
  pending.password = "";
  passwordPending.delete(name);
  try {
    const jar = await deps.client.submitPassword({
      jar: pending.jar,
      init: pending.init,
      loginName: pending.loginName,
      password: password,
      authCode: authCode || ""
    });
    const metrics = await deps.client.fetchHome(jar);
    await saveSession(name, { cookies: jar, authState: "ok", authMessage: "", enabled: true });
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
    return { ok: true, store: name, status: "ok" };
  } catch (error) {
    const message = error && error.code === "login" ? error.message : "登录没有通过，请再试一次";
    return { ok: true, store: name, status: "login", message: message };
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
  ensureChrome().catch(function () {});
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
