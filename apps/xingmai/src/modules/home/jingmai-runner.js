import { browserReady, browserStartFailure, ensureChrome, jingmaiDesk, launchNote, LOGIN_SCREEN_MESSAGE, PAGE_WAIT_MESSAGE } from "./jingmai-desk.js";
import { jingmaiClient } from "./jingmai-client.js";
import { beijingParts, bindDecision, runTick, sampleFields, sessionStillValid, withDeadline } from "./jingmai.js";
import { listCollectTargets, listSessions, markAuth, readJingmaiLive, saveSample, saveSession, setRoster } from "./jingmai-store.js";

const INTERVAL_MS = 5 * 60 * 1000;
let requestOrigin = "";

export function setJingmaiRequestOrigin(origin) {
  requestOrigin = String(origin || "").replace(/\/$/, "");
}
const inflight = new Set();
const qrPending = new Map();
const passwordPending = new Map();
let loginQueue = [];
let loginCursor = { index: 0, total: 0, store: "" };
let loginEpoch = 0;
let openingMark = 0;
const orgCache = new Map();
let refreshing = false;
let recovering = false;
let deskLock = Promise.resolve();

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
  loginCursor = { index: 0, total: 0, store: "", step: "", message: "", failed: false, phase: "idle" };
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
  openingMark = 0;
  orgCache.forEach(function (shop) {
    shop.password = "";
  });
  orgCache.clear();
  refreshing = false;
  recovering = false;
  deskLock = Promise.resolve();
  loginEpoch = 0;
}

function rememberOrg(shops) {
  (shops || []).forEach(function (shop) {
    if (!shop || !shop.store || !shop.login || !shop.password) {
      return;
    }
    orgCache.set(shop.store, {
      store: shop.store,
      enabled: shop.enabled !== false,
        login: shop.login,
        password: shop.password,
        shopId: String(shop.shopId || "")
      });
  });
}

function withDesk(task) {
  const run = deskLock.then(task, task);
  deskLock = run.then(
    function () {},
    function () {}
  );
  return run;
}

function sessionNeedsLogin(session) {
  if (!session || session.enabled === false) {
    return false;
  }
  if (session.authState === "login_expired" || !session.cookies || !session.cookies.length) {
    return true;
  }
  return /登录已失效|请重新登录|未登录|登录失败/.test(String(session.authMessage || ""));
}

export async function loadOrgShops(cookie, fetchImpl = fetch) {
  const origin =
    requestOrigin ||
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
  const mapped = (data.stores || [])
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
      return store.store;
    });
  rememberOrg(mapped);
  return mapped;
}

async function cookiesAlive(cookies) {
  if (!cookies || !cookies.length || !deps.client || !deps.client.fetchHome) {
    return false;
  }
  try {
    await withDeadline(function () {
      return deps.client.fetchHome(cookies);
    }, 12000);
    return true;
  } catch (error) {
    if (error && error.code === "login") {
      return false;
    }
    return false;
  }
}

async function passwordRelogin(shop) {
  if (!shop || !shop.store || !shop.login || !shop.password || !deps.client || !deps.client.login) {
    return false;
  }
  if (inflight.has(shop.store)) {
    return false;
  }
  inflight.add(shop.store);
  try {
    const cookies = await deps.client.login(shop.login, shop.password);
    const kept = await rememberLogin(shop.store, cookies, { shopId: shop.shopId || "", store: shop.store });
    return kept === "saved" || kept === "kept";
  } finally {
    inflight.delete(shop.store);
  }
}

function cachedOrgShop(name) {
  const hit = orgCache.get(name);
  if (!hit || !hit.login || !hit.password) {
    return null;
  }
  return {
    store: hit.store,
    login: hit.login,
    password: hit.password,
    shopId: hit.shopId || "",
    enabled: hit.enabled !== false
  };
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
    await saveSample(Object.assign({ store: shop.store, day: now.day, capturedAt: now.stamp, ok: true }, sampleFields(metrics)));
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
    build: "relogin",
    store: state.store || loginCursor.store,
    status: state.status,
    message: state.message || "",
    step: state.step || loginCursor.step || "",
    shops: state.shops || [],
    index: state.index || loginCursor.index,
    total: state.total || loginCursor.total,
    openingMs: openingMark ? Date.now() - openingMark : 0,
    note: state.note || launchNote() || ""
  };
}

async function rememberLogin(store, cookies, expected) {
  let identity = { shopId: "", shopName: "" };
  try {
    if (deps.client.fetchAccountIdentity) {
      identity = (await deps.client.fetchAccountIdentity(cookies)) || identity;
    }
  } catch (error) {
    if (error && error.code === "login") {
      const sessions = await listSessions();
      const existing = sessions.find(function (item) {
        return item.store === store;
      });
      if (sessionStillValid(existing)) {
        return "kept";
      }
      return "failed";
    }
  }
  const sessions = await listSessions();
  const existing = sessions.find(function (item) {
    return item.store === store;
  });
  const decision = bindDecision(Object.assign({ store: store }, expected || {}), identity, existing);
  if (decision.action === "keep") {
    return "kept";
  }
  if (decision.action === "reject") {
    await saveSession(store, {
      cookies: [],
      authState: "login_expired",
      authMessage: decision.message,
      enabled: true,
      shopId: decision.shopId
    });
    return "failed";
  }
  await saveSession(store, {
    cookies: cookies,
    authState: "ok",
    authMessage: "",
    enabled: true,
    shopId: decision.shopId
  });
  try {
    const metrics = await deps.client.fetchHome(cookies);
    const now = beijingParts();
    await saveSample(Object.assign({ store: store, day: now.day, capturedAt: now.stamp, ok: true }, sampleFields(metrics)));
  } catch {
    /* 一次采集超时或没有成交，保留刚保存的登录 */
  }
  return "saved";
}

function markOpening() {
  if (!openingMark) {
    openingMark = Date.now();
  }
}

function clearOpening() {
  openingMark = 0;
}

function loginInProgress(name) {
  return loginCursor.store === name && loginCursor.failed !== true && (loginCursor.phase === "opening" || loginCursor.phase === "screen");
}

function currentLoginState(fallback) {
  return publicState({
    status: loginCursor.failed ? "failed" : (loginCursor.phase === "screen" ? "screen" : loginCursor.phase || "opening"),
    store: loginCursor.store || fallback || "",
    step: loginCursor.step,
    message: loginCursor.message || "正在启动浏览器"
  });
}

async function startQueued(shop, epoch) {
  if (epoch != null && epoch !== loginEpoch) {
    return currentLoginState(shop.store);
  }
  loginCursor.store = shop.store;
  loginCursor.step = "启动浏览器";
  loginCursor.phase = "opening";
  loginCursor.failed = false;
  loginCursor.startedAt = Date.now();
  markOpening();
  loginCursor.message = "正在启动浏览器";
  let opened;
  const boot = typeof AbortController === "function" ? new AbortController() : null;
  let openTimer = null;
  try {
    const opening = deps.desk.open({
      store: shop.store,
      loginName: shop.login,
      password: shop.password,
      reveal: true,
      signal: boot ? boot.signal : undefined,
      onStep: function (message) {
        if (epoch != null && epoch !== loginEpoch) {
          return;
        }
        loginCursor.step = message.indexOf("启动") >= 0 ? "启动浏览器" : "打开京麦登录页";
        loginCursor.message = message;
      }
    });
    opening.catch(function () {});
    opened = await Promise.race([
      opening,
      new Promise(function (resolve) {
        openTimer = setTimeout(function () {
          try {
            if (boot) {
              boot.abort();
            }
          } catch {
            /* ignore */
          }
          resolve({
            status: "login",
            message: launchNote() || browserStartFailure()
          });
        }, deps.startLimitMs || 12000);
      })
    ]);
  } catch {
    opened = { status: "login", message: launchNote() || "服务器没有打开京麦登录页" };
  } finally {
    clearTimeout(openTimer);
  }
  shop.login = "";
  shop.password = "";
  if (epoch != null && epoch !== loginEpoch) {
    return currentLoginState(shop.store);
  }
  if (opened.status === "ok") {
    await deps.desk.close();
    const kept = await rememberLogin(shop.store, opened.cookies || [], { shopId: shop.shopId || "", store: shop.store });
    if (kept === "kept") {
      return publicState({ status: "done", store: shop.store, message: "这次登录到的不是这家店，原来的会话还在" });
    }
    if (kept !== "saved") {
    loginCursor.failed = true;
    loginCursor.phase = "failed";
    loginCursor.step = "核对店铺身份";
    loginCursor.message = "登录没有通过，请再试一次";
      return publicState({ status: "failed", store: shop.store, step: "核对店铺身份", message: loginCursor.message });
    }
    return publicState({ status: "ok", store: shop.store, message: shop.store + " 已在服务器登录" });
  }
  if (opened.status === "verify") {
    loginCursor.phase = "screen";
    loginCursor.step = "京麦登录页";
    loginCursor.message = opened.message || LOGIN_SCREEN_MESSAGE;
    return publicState({
      status: "screen",
      store: shop.store,
      step: "京麦登录页",
      message: loginCursor.message
    });
  }
  if (deps.desk && deps.desk.close) {
    await deps.desk.close();
  }
  loginCursor.failed = true;
  loginCursor.phase = "failed";
  loginCursor.step = "打开京麦登录页";
  loginCursor.message = opened.message || "服务器没有打开京麦登录页";
  return publicState({ status: "failed", store: shop.store, step: loginCursor.step, message: loginCursor.message });
}

async function advanceAfterSuccess(store) {
  const next = loginQueue.shift();
  if (!next) {
    return publicState({ status: "ok", store: store, message: store + " 已在服务器登录" });
  }
  loginCursor.index += 1;
  return startQueued(next, loginEpoch);
}

async function advanceAfterFailure(store, message) {
  await markAuth(store, "login_expired", message);
  const next = loginQueue.shift();
  if (!next) {
    return publicState({ status: "login", store: store, message: message });
  }
  loginCursor.index += 1;
  const started = await startQueued(next, loginEpoch);
  if (started.status === "screen") {
    started.message = store + "：" + message;
  }
  return started;
}

async function queueShops(shops, epoch) {
  if (epoch != null && epoch !== loginEpoch) {
    return currentLoginState();
  }
  const copies = (shops || []).map(function (shop) {
    const copy = { store: shop.store, login: shop.login, password: shop.password, shopId: shop.shopId || "" };
    shop.login = "";
    shop.password = "";
    return copy;
  });
  loginQueue.forEach(function (shop) {
    shop.login = "";
    shop.password = "";
  });
  loginQueue = copies;
  const first = loginQueue[0];
  loginCursor = {
    index: 1,
    total: loginQueue.length,
    store: first ? first.store : "",
    step: "启动浏览器",
    message: first ? "正在启动浏览器" : "全部店铺已连接",
    failed: false,
    phase: "opening",
    startedAt: Date.now()
  };
  markOpening();
  const next = loginQueue.shift();
  if (!next) {
    return publicState({ status: "done", message: "全部店铺已连接" });
  }
  return startQueued(next, epoch);
}

export async function beginRelogin(store, cookie) {
  const name = String(store || "").trim();
  if (!name) {
    const error = new Error("请选择店铺");
    error.statusCode = 400;
    throw error;
  }
  if (loginInProgress(name)) {
    return currentLoginState(name);
  }
  const epoch = ++loginEpoch;
  loginCursor = {
    index: 1,
    total: 1,
    store: name,
    step: "启动浏览器",
    message: "正在启动浏览器",
    failed: false,
    phase: "opening",
    startedAt: Date.now()
  };
  markOpening();
  loginCursor.step = "重新登录";
  loginCursor.message = "正在重新登录";
  const shops = await deps.loadOrg(cookie || "");
  if (epoch !== loginEpoch) {
    return currentLoginState(name);
  }
  rememberOrg(shops);
  const shop = shops.find(function (item) {
    return item.store === name;
  });
  if (!shop || shop.enabled === false || !shop.login || !shop.password) {
    if (epoch === loginEpoch) {
      loginCursor = { index: 0, total: 0, store: name, step: "", message: "", failed: true, phase: "failed" };
    }
    return {
      ok: true,
      store: name,
      status: "login",
      message: !shop || shop.enabled === false ? "这家店已停用" : "组织中心还没有填写这家店的账号"
    };
  }
  const sessions = await listSessions();
  const existing = sessions.find(function (item) {
    return item.store === name;
  });
  if (sessionStillValid(existing)) {
    const alive = await cookiesAlive(existing.cookies || []);
    if (epoch !== loginEpoch) {
      return currentLoginState(name);
    }
    if (alive) {
      clearOpening();
      loginCursor = { index: 0, total: 0, store: "", step: "", message: "", failed: false, phase: "idle" };
      shop.login = "";
      shop.password = "";
      return { ok: true, status: "done", store: name, message: "「" + name + "」已连接" };
    }
    await markAuth(name, "login_expired", "登录已失效，请重新登录");
  }
  try {
    const renewed = await passwordRelogin({
      store: shop.store,
      login: shop.login,
      password: shop.password,
      shopId: shop.shopId || ""
    });
    if (epoch !== loginEpoch) {
      return currentLoginState(name);
    }
    if (renewed) {
      clearOpening();
      loginCursor = { index: 0, total: 0, store: "", step: "", message: "", failed: false, phase: "idle" };
      shop.login = "";
      shop.password = "";
      return { ok: true, status: "done", store: name, message: "「" + name + "」已重新登录" };
    }
  } catch {
    /* 掉线店先走账号密码；需要验证码时再打开服务器画面 */
  }
  if (epoch !== loginEpoch) {
    return currentLoginState(name);
  }
  const queued = { store: shop.store, login: shop.login, password: shop.password, shopId: shop.shopId || "" };
  shop.login = "";
  shop.password = "";
  const job = queueShops([queued], epoch);
  job.catch(function () {
    if (epoch !== loginEpoch) {
      return;
    }
    loginCursor.failed = true;
    loginCursor.phase = "failed";
    loginCursor.step = "打开京麦登录页";
    loginCursor.message = "服务器没有打开京麦登录页";
  });
  return publicState({
    status: "opening",
    store: name,
    step: "打开京麦登录页",
    message: "正在启动浏览器"
  });
}

export async function beginReloginAll(cookie) {
  const shops = await deps.loadOrg(cookie || "");
  rememberOrg(shops);
  const sessions = await listSessions();
  const byName = new Map(
    sessions.map(function (session) {
      return [session.store, session];
    })
  );
  const pending = [];
  shops.forEach(function (shop) {
    const session = byName.get(shop.store);
    const ready = sessionStillValid(session) && !sessionNeedsLogin(session);
    const needs = shop.enabled !== false && shop.login && shop.password && !ready;
    shop.login = "";
    shop.password = "";
    if (needs) {
      pending.push({ store: shop.store, shopId: shop.shopId || "" });
    }
  });
  if (!pending.length) {
    return { ok: true, status: "done", message: "全部店铺已连接", shops: [] };
  }
  return { ok: true, status: "pick", message: "选择要登录的店铺", shops: pending };
}

export async function recoverDroppedShops(cookie) {
  if (recovering || refreshing || loginInProgress(loginCursor.store)) {
    return { ok: true, status: "running", recovered: 0, total: 0 };
  }
  recovering = true;
  try {
    let shops = [];
    try {
      shops = await deps.loadOrg(cookie || "");
      rememberOrg(shops);
    } catch {
      shops = [...orgCache.values()].map(function (shop) {
        return {
          store: shop.store,
          login: shop.login,
          password: shop.password,
          shopId: shop.shopId || "",
          enabled: shop.enabled !== false
        };
      });
    }
    const sessions = await listSessions();
    const byName = new Map(
      sessions.map(function (session) {
        return [session.store, session];
      })
    );
    const live = await readJingmaiLive();
    const dropped = new Set(
      ((live && live.shops) || [])
        .filter(function (row) {
          return row && (row.offline === true || row.loginExpired === true);
        })
        .map(function (row) {
          return row.shop;
        })
    );
    const targets = [];
    shops.forEach(function (shop) {
      if (!shop || shop.enabled === false || !shop.login || !shop.password || inflight.has(shop.store)) {
        return;
      }
      const session = byName.get(shop.store);
      const needs =
        dropped.has(shop.store) ||
        sessionNeedsLogin(session || { enabled: true, cookies: [], authState: "" }) ||
        (sessionStillValid(session) && session && session.authState === "offline");
      if (!needs) {
        return;
      }
      targets.push({
        store: shop.store,
        login: shop.login,
        password: shop.password,
        shopId: shop.shopId || ""
      });
      shop.login = "";
      shop.password = "";
    });
    const results = [];
    for (let i = 0; i < targets.length; i += 1) {
      const shop = targets[i];
      try {
        const ok = await passwordRelogin(shop);
        results.push({ store: shop.store, status: ok ? "ok" : "login" });
      } catch {
        results.push({ store: shop.store, status: "login" });
      }
      shop.password = "";
    }
    return {
      ok: true,
      recovered: results.filter(function (item) {
        return item.status === "ok";
      }).length,
      total: targets.length,
      results: results
    };
  } finally {
    recovering = false;
  }
}

export async function reloginState(store) {
  const name = loginCursor.store || String(store || "").trim();
  if (!name) {
    return publicState({ status: "missing", message: "请重新打开登录" });
  }
  const idle = !loginCursor.phase || loginCursor.phase === "idle";
  if (loginCursor.failed || loginCursor.phase === "failed") {
    return publicState({ status: "failed", store: name, step: loginCursor.step, message: loginCursor.message || "登录没有打开" });
  }
  if (loginCursor.phase === "opening") {
    markOpening();
  } else if (idle || loginCursor.phase === "failed" || loginCursor.phase === "screen") {
    clearOpening();
  }
  const startLimit = deps.startLimitMs || 12000;
  const openingFor = openingMark ? Date.now() - openingMark : 0;
  if (!idle && loginCursor.phase === "opening" && openingFor > startLimit) {
    let peeked = null;
    try {
      peeked = await Promise.race([
        deps.desk.poll(name),
        new Promise(function (resolve) {
          setTimeout(function () {
            resolve(null);
          }, 800);
        })
      ]);
    } catch {
      peeked = null;
    }
    if (peeked && (peeked.status === "verify" || peeked.status === "screen" || peeked.status === "ok")) {
      /* 浏览器已经开了，交给下面的正常判断 */
    } else {
      const note = (peeked && peeked.message && peeked.message !== "正在启动浏览器" ? peeked.message : "") || launchNote();
      loginEpoch += 1;
      clearOpening();
      loginCursor.failed = true;
      loginCursor.phase = "failed";
      loginCursor.step = "启动浏览器";
      loginCursor.message = note || browserStartFailure();
      if (deps.desk && deps.desk.close) {
        Promise.resolve(deps.desk.close()).catch(function () {});
      }
      return publicState({ status: "failed", store: name, step: "启动浏览器", message: loginCursor.message });
    }
  }
  const state = await deps.desk.poll(name);
  if (idle && (!state || state.status === "opening" || state.status === "missing")) {
    return publicState({ status: "idle", store: name, message: "" });
  }
  if (state.status === "verify" || state.status === "screen") {
    loginCursor.phase = "screen";
    loginCursor.step = "京麦登录页";
    loginCursor.message = state.message || LOGIN_SCREEN_MESSAGE;
    return publicState({
      status: "screen",
      store: name,
      step: "京麦登录页",
      message: loginCursor.message
    });
  }
  if (state.status === "ok") {
    const cookies = state.cookies || [];
    const cached = orgCache.get(name);
    const kept = await rememberLogin(name, cookies, { store: name, shopId: (cached && cached.shopId) || "" });
    await deps.desk.close();
    if (kept === "kept") {
      return publicState({ status: "login", store: name, message: "这次登录到的不是这家店，原来的会话还在" });
    }
    if (kept !== "saved") {
      return publicState({ status: "screen", store: name, message: "登录没有通过，请再试一次" });
    }
    return advanceAfterSuccess(name);
  }
  if (state.status === "missing") {
    return publicState({ status: "missing", store: name, message: state.message || "请重新打开登录" });
  }
  if (state.status === "opening" || loginCursor.phase === "opening") {
    return publicState({
      status: "opening",
      store: name,
      step: "打开京麦登录页",
      message: (state && state.message) || PAGE_WAIT_MESSAGE
    });
  }
  return publicState({
    status: "screen",
    store: name,
    message: state.message || "点一下只会点到服务器上的登录页，这个窗口不会关掉。"
  });
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
    await deps.desk.click(name, Number(body.x), Number(body.y), {
      width: Number(body.imageWidth) || 0,
      height: Number(body.imageHeight) || 0
    });
  }
  const started = Date.now();
  let state = await reloginState(name);
  while (state.status === "screen" && Date.now() - started < 8000) {
    await new Promise(function (resolve) {
      setTimeout(resolve, 400);
    });
    state = await reloginState(name);
  }
  return state;
}

export function jingmaiBrowser() {
  return { ok: true, browser: browserReady() };
}

export async function cancelRelogin() {
  loginEpoch += 1;
  clearOpening();
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
    const kept = await rememberLogin(name, jar, { store: name, shopId: pending.shopId || "" });
    if (kept !== "saved") {
      return { ok: true, store: name, status: "login", message: kept === "kept" ? "这次登录到的不是这家店，原来的会话还在" : "登录没有通过，请再试一次" };
    }
    return { ok: true, store: name, status: "ok" };
  } catch (error) {
    const message = error && error.code === "login" ? error.message : "登录没有通过，请再试一次";
    return { ok: true, store: name, status: "login", message: message };
  }
}

async function silentOne(shop) {
  const opened = await deps.desk.open({ store: shop.store, loginName: shop.login, password: shop.password });
  shop.login = "";
  shop.password = "";
  if (opened.status === "ok") {
    await deps.desk.close();
    const kept = await rememberLogin(shop.store, opened.cookies || [], { shopId: shop.shopId || "", store: shop.store });
    return { store: shop.store, status: kept === "saved" || kept === "kept" ? "ok" : "login" };
  }
  if (deps.desk && deps.desk.close) {
    await deps.desk.close();
  }
  return { store: shop.store, status: opened.status || "login" };
}

async function runSilent(shops) {
  const sessions = await listSessions();
  const byName = new Map(sessions.map(function (session) {
    return [session.store, session];
  }));
  const targets = (shops || []).filter(function (shop) {
    if (!shop || shop.enabled === false || !shop.login || !shop.password || inflight.has(shop.store)) {
      return false;
    }
    return sessionNeedsLogin(byName.get(shop.store) || { enabled: true, cookies: [], authState: "" });
  });
  const results = [];
  for (const shop of targets) {
    const copy = { store: shop.store, enabled: shop.enabled, login: shop.login, password: shop.password };
    results.push(await withDesk(function () {
      return silentOne(copy);
    }));
    copy.password = "";
  }
  return {
    ok: true,
    logged: results.filter(function (item) {
      return item.status === "ok";
    }).length,
    total: targets.length,
    results: results.map(function (item) {
      return { store: item.store, status: item.status };
    })
  };
}

export async function refreshJingmai(cookie) {
  if (refreshing) {
    return { ok: true, status: "running" };
  }
  refreshing = true;
  try {
    const shops = await deps.loadOrg(cookie || "");
    rememberOrg(shops);
    return await runSilent(shops);
  } finally {
    refreshing = false;
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
  try {
    await recoverDroppedShops("");
  } catch (error) {
    console.error("jingmai recover", error && error.code ? error.code : "failed");
  }
}

export function startJingmaiCollector() {
  if (process.argv.includes("--test") || process.env.NODE_TEST_CONTEXT) {
    return;
  }
  if (globalThis.__homeJingmaiStarted) {
    return;
  }
  globalThis.__homeJingmaiStarted = true;
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
