import { readFileSync } from "node:fs";
import { browserReady, browserStartFailure, ensureChrome, jingmaiDesk, launchNote, LOGIN_SCREEN_MESSAGE, PAGE_WAIT_MESSAGE } from "./jingmai-desk.js";
import { jingmaiClient } from "./jingmai-client.js";
import {
  beijingParts,
  bindDecision,
  matchCollectIdentity,
  sameShop,
  runTick,
  sampleFields,
  sessionStillValid,
  withDeadline
} from "./jingmai.js";
import {
  claimCollectorOwner,
  COLLECTOR_OWNER_HOME,
  collectStatusSummary,
  isAdsOnlyAuthMessage,
  listCollectTargets,
  listSessions,
  markAuth,
  readJingmaiLive,
  saveSample,
  saveSession,
  sessionVersionOf,
  setRoster,
  updateSessionCookies
} from "./jingmai-store.js";

const INTERVAL_MS = 10 * 60 * 1000;
let requestOrigin = "";

export function setJingmaiRequestOrigin(origin) {
  requestOrigin = String(origin || "").replace(/\/$/, "");
}
const inflight = new Set();
export function homeCollectionGate() {
  return { inflight, humanProtectsShop };
}
const qrPending = new Map();
const passwordPending = new Map();
let loginQueue = [];
let loginCursor = { index: 0, total: 0, store: "" };
let loginEpoch = 0;
let openingMark = 0;
const orgCache = new Map();
/** store → { store, team, manager, enabled } for ownership (no secrets). */
const orgMeta = new Map();
/** store → 5-minute collect bucket id (old-site dedupe). */
const collectBuckets = new Map();
/** store → { until, failures, kind } limited retry / recover backoff. */
const failBackoff = new Map();
let refreshing = false;
let recovering = false;
let deskLock = Promise.resolve();

const BACKOFF_MS = {
  login: [15 * 60 * 1000, 30 * 60 * 1000, 60 * 60 * 1000],
  ads: [10 * 60 * 1000, 20 * 60 * 1000, 40 * 60 * 1000],
  timeout: [5 * 60 * 1000, 10 * 60 * 1000, 20 * 60 * 1000],
  recover: [20 * 60 * 1000, 40 * 60 * 1000, 90 * 60 * 1000]
};

function backoffHold(store) {
  const row = failBackoff.get(String(store || "").trim());
  return row && Number(row.until) > Date.now() ? row : null;
}

function noteFailBackoff(store, kind) {
  const name = String(store || "").trim();
  if (!name) {
    return;
  }
  const key = BACKOFF_MS[kind] ? kind : "timeout";
  const prev = failBackoff.get(name) || { failures: 0, kind: key };
  const failures = Math.min(20, Number(prev.failures || 0) + 1);
  const ladder = BACKOFF_MS[key] || BACKOFF_MS.timeout;
  const delay = ladder[Math.min(failures - 1, ladder.length - 1)];
  failBackoff.set(name, { until: Date.now() + delay, failures: failures, kind: key });
}

function clearFailBackoff(store) {
  failBackoff.delete(String(store || "").trim());
}

const defaultDeps = {
  loadOrg: loadOrgShops,
  client: jingmaiClient,
  desk: jingmaiDesk
};

/**
 * Live Jingmai collection owner is always home (shared service).
 * 沈子晗/韩梦凯 modules stay intact and may keep reading the same DB tables;
 * they must not remain long-term writers. Org team labels are metadata only.
 */
export const JINGMAI_COLLECTOR_OWNER = "home";

export function isShenTeamShop(shop) {
  const text = `${(shop && shop.team) || ""}${(shop && shop.manager) || ""}`;
  return text.includes("沈子晗");
}

/** @deprecated use isShenTeamShop — team label ≠ collector owner */
export function isShenOwnedShop(shop) {
  return isShenTeamShop(shop);
}

function rememberOrgMeta(shops) {
  (shops || []).forEach(function (shop) {
    if (!shop || !shop.store) {
      return;
    }
    orgMeta.set(shop.store, {
      store: shop.store,
      team: String(shop.team || ""),
      manager: String(shop.manager || ""),
      enabled: shop.enabled !== false
    });
  });
}

export function shenTeamStoreSet(shops) {
  const rows = Array.isArray(shops) && shops.length ? shops : [...orgMeta.values()];
  const owned = new Set();
  rows.forEach(function (shop) {
    if (shop && shop.store && isShenTeamShop(shop)) {
      owned.add(shop.store);
    }
  });
  return owned;
}

/** @deprecated use shenTeamStoreSet */
export function shenOwnedStoreSet(shops) {
  return shenTeamStoreSet(shops);
}

/**
 * Home is the sole collect writer. Atomically claim collector_owner=home per shop
 * before listing targets. Manual pause stays excluded. Shen/Han keep reading same tables.
 * Does not call /api/shen/paid or /api/han for collection.
 */
export async function listHomeCollectTargets() {
  const candidates = await listCollectTargets();
  const claimed = [];
  for (let i = 0; i < candidates.length; i += 1) {
    const session = candidates[i];
    const result = await claimCollectorOwner(session.store, COLLECTOR_OWNER_HOME);
    if (result && result.ok) {
      session.collectorOwner = COLLECTOR_OWNER_HOME;
      claimed.push(withMerchant(session));
    }
  }
  return claimed;
}

export async function jingmaiCollectStatus() {
  return collectStatusSummary();
}

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
  orgMeta.clear();
  collectBuckets.clear();
  failBackoff.clear();
  refreshing = false;
  recovering = false;
  deskLock = Promise.resolve();
  loginEpoch = 0;
}

let orgIdentityMap = null;

function orgIdentityFor(store) {
  const name = String(store || "").trim();
  if (!name) {
    return null;
  }
  if (!orgIdentityMap) {
    orgIdentityMap = new Map();
    try {
      const file = new URL("../people/data/org-stores.json", import.meta.url);
      const data = JSON.parse(readFileSync(file, "utf8"));
      const rows = Array.isArray(data) ? data : data.stores || [];
      rows.forEach(function (row) {
        const storeName = String((row && (row.storeName || row.store)) || "").trim();
        if (!storeName) {
          return;
        }
        orgIdentityMap.set(storeName, {
          shopId: String((row && (row.shopId || row.storeId)) || "").trim(),
          merchantId: String((row && row.merchantId) || "").trim()
        });
      });
    } catch {
      orgIdentityMap = new Map();
    }
  }
  return orgIdentityMap.get(name) || null;
}

function withMerchant(shop) {
  if (!shop || !shop.store) {
    return shop;
  }
  const cached = orgCache.get(shop.store);
  const filed = orgIdentityFor(shop.store);
  if (!shop.shopId) {
    shop.shopId = String((cached && cached.shopId) || (filed && filed.shopId) || "");
  }
  if (!shop.merchantId) {
    shop.merchantId = String((cached && cached.merchantId) || (filed && filed.merchantId) || "");
  }
  return shop;
}

function rememberOrg(shops) {
  rememberOrgMeta(shops);
  (shops || []).forEach(function (shop) {
    if (!shop || !shop.store || !shop.login || !shop.password) {
      return;
    }
    orgCache.set(shop.store, {
      store: shop.store,
      enabled: shop.enabled !== false,
      login: shop.login,
      password: shop.password,
      shopId: String(shop.shopId || ""),
      merchantId: String(shop.merchantId || ""),
      team: String(shop.team || ""),
      manager: String(shop.manager || "")
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
  const message = String(session.authMessage || "");
  // Ads/JZT gaps (including legacy "登录已失效；京准通-100" composites) are NOT Jingmai logout.
  if (isAdsOnlyAuthMessage(message)) {
    return false;
  }
  if (!session.cookies || !session.cookies.length) {
    return true;
  }
  return session.authState === "login_expired";
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
        shopId: String(store.shopId || store.storeId || "").trim(),
        merchantId: String(store.merchantId || "").trim()
      };
    })
    .filter(function (store) {
      return store.store;
    });
  rememberOrg(mapped);
  return mapped;
}

async function cookiesAlive(cookies, expected) {
  if (!cookies || !cookies.length || !deps.client) {
    return false;
  }
  const want = expected || {};
  try {
    if (deps.client.fetchAccountIdentity) {
      const identity = await withDeadline(function (signal) {
        return deps.client.fetchAccountIdentity(cookies, undefined, signal);
      }, 12000);
      const match = matchCollectIdentity(
        { store: want.store || "", shopId: want.shopId || "", merchantId: want.merchantId || "" },
        identity || { shopId: "", shopName: "" }
      );
      if (!match.ok) {
        return false;
      }
      return true;
    }
    if (!deps.client.fetchHome) {
      return false;
    }
    await withDeadline(function (signal) {
      return deps.client.fetchHome(cookies, signal, {
        store: want.store || "",
        shopId: want.shopId || ""
      });
    }, 12000);
    return true;
  } catch (error) {
    if (error && (error.code === "login" || error.code === "identity")) {
      return false;
    }
    return false;
  }
}

async function passwordRelogin(shop) {
  shop = withMerchant(shop);
  if (!shop || !shop.store || !shop.login || !shop.password || !deps.client || !deps.client.login) {
    return false;
  }
  if (inflight.has(shop.store)) {
    return false;
  }
  // Callers that own the desk (beginRelogin) already set loginCursor; do not treat that as a block.
  // Auto recover passes sessionVersion + pre-checks humanProtectsShop / loginInProgress before call.
  const expectVersion = shop.sessionVersion || "";
  const abandonIfHuman =
    shop.respectHuman === true
      ? function () {
          return humanProtectsShop(shop.store);
        }
      : function () {
          return false;
        };
  inflight.add(shop.store);
  try {
    if (abandonIfHuman()) {
      return false;
    }
    if (expectVersion) {
      const sessions = await listSessions();
      const current = sessions.find(function (item) {
        return item.store === shop.store;
      });
      if (sessionVersionOf(current) !== expectVersion) {
        return false;
      }
    }
    const cookies = await deps.client.login(shop.login, shop.password);
    if (abandonIfHuman()) {
      return false;
    }
    if (expectVersion) {
      const sessions = await listSessions();
      const current = sessions.find(function (item) {
        return item.store === shop.store;
      });
      if (sessionVersionOf(current) !== expectVersion) {
        return false;
      }
    }
    const kept = await rememberLogin(shop.store, cookies, {
      shopId: shop.shopId || "",
      merchantId: shop.merchantId || "",
      store: shop.store
    });
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
    merchantId: hit.merchantId || "",
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
    const expected = { store: shop.store, shopId: shop.shopId || "", merchantId: shop.merchantId || "" };
    let identity = { shopId: "", shopName: "" };
    if (deps.client.fetchAccountIdentity) {
      identity = (await deps.client.fetchAccountIdentity(cookies)) || identity;
      const match = matchCollectIdentity(expected, identity);
      if (!match.ok) {
        const who = identity.shopName || identity.shopId || "另一家店";
        return {
          store: shop.store,
          ok: false,
          auth: false,
          message: "身份不符：登录到的是「" + who + "」，不是这家店"
        };
      }
    }
    const metrics = await deps.client.fetchHome(cookies, undefined, expected);
    await saveSession(shop.store, {
      cookies: cookies,
      authState: "ok",
      authMessage: "",
      enabled: true,
      shopId: String(shop.shopId || identity.shopId || "").trim()
    });
    const now = beijingParts();
    await saveSample(
      Object.assign({ store: shop.store, day: now.day, capturedAt: now.stamp, ok: true }, sampleFields(metrics)),
      { writer: COLLECTOR_OWNER_HOME }
    );
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
    if (error && error.code === "identity") {
      return {
        store: shop.store,
        ok: false,
        auth: false,
        message: String(error.message || "身份不符").slice(0, 120)
      };
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
  const finished = state.status === "ok" || state.status === "done" || state.status === "failed";
  if (finished) {
    loginCursor.needCode = false;
  }
  const needCode = !finished && (state.needCode === true || state.status === "code" || loginCursor.needCode === true);
  return {
    ok: true,
    build: "livefix",
    store: state.store || loginCursor.store,
    status: state.status,
    message: state.message || "",
    step: state.step || loginCursor.step || "",
    shops: state.shops || [],
    index: state.index || loginCursor.index,
    total: state.total || loginCursor.total,
    openingMs: openingMark ? Date.now() - openingMark : 0,
    note: state.note || launchNote() || "",
    needCode: needCode
  };
}

async function rememberLogin(store, cookies, expected) {
  let identity = { shopId: "", shopName: "" };
  const pageMatch = Boolean(expected && expected.pageMatch);
  try {
    if (deps.client.fetchAccountIdentity) {
      identity = (await deps.client.fetchAccountIdentity(cookies)) || identity;
    }
  } catch (error) {
    if (error && error.code === "login" && !pageMatch) {
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
  const wanted = Object.assign({ store: store }, expected || {});
  if (pageMatch || sameShop(wanted, identity)) {
    const shopId = String((wanted.shopId || identity.shopId) || "").trim();
    await saveSession(store, {
      cookies: cookies,
      authState: "ok",
      authMessage: "",
      enabled: true,
      shopId: shopId
    });
    try {
      const metrics = await deps.client.fetchHome(cookies, undefined, {
        store: store,
        shopId: shopId,
        merchantId: String((wanted && wanted.merchantId) || ""),
        shopName: store
      });
      const now = beijingParts();
      await saveSample(
        Object.assign({ store: store, day: now.day, capturedAt: now.stamp, ok: true }, sampleFields(metrics)),
        { writer: COLLECTOR_OWNER_HOME }
      );
    } catch (error) {
      if (error && error.code === "identity") {
        await markAuth(store, "offline", String(error.message || "身份不符").slice(0, 200), {
          writer: COLLECTOR_OWNER_HOME
        });
        return "failed";
      }
      /* 一次采集超时或没有成交，保留刚保存的登录 */
    }
    return "saved";
  }
  const decision = bindDecision(wanted, identity, existing);
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
    const metrics = await deps.client.fetchHome(cookies, undefined, {
      store: store,
      shopId: decision.shopId || (expected && expected.shopId) || ""
    });
    const now = beijingParts();
    await saveSample(
      Object.assign({ store: store, day: now.day, capturedAt: now.stamp, ok: true }, sampleFields(metrics)),
      { writer: COLLECTOR_OWNER_HOME }
    );
  } catch (error) {
    if (error && error.code === "identity") {
      await markAuth(store, "offline", String(error.message || "身份不符").slice(0, 200), {
        writer: COLLECTOR_OWNER_HOME
      });
      return "failed";
    }
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
      shopId: shop.shopId || "",
      loginName: shop.login,
      password: shop.password,
      reveal: true,
      manual: shop.manual === true,
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
        }, shop.manual === true ? 30000 : (deps.startLimitMs || 25000));
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
    const kept = await rememberLogin(shop.store, opened.cookies || [], {
      shopId: shop.shopId || "",
      merchantId: shop.merchantId || "",
      store: shop.store
    });
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
    return publicState({ status: "ok", store: shop.store, message: shop.store + " 登录成功" });
  }
  if (opened.status === "code" || opened.needCode) {
    loginCursor.phase = "screen";
    loginCursor.needCode = true;
    loginCursor.step = "验证码";
    loginCursor.message = opened.message || "验证码已发送，请输入后自动登录";
    return publicState({
      status: "code",
      store: shop.store,
      step: "验证码",
      message: loginCursor.message,
      needCode: true
    });
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
  if (opened && opened.humanBusy) {
    return publicState({
      status: "screen",
      store: shop.store,
      step: "京麦登录页",
      message: "登录窗口正开着"
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
    return publicState({ status: "ok", store: store, message: store + " 登录成功" });
  }
  loginCursor.index += 1;
  return startQueued(next, loginEpoch);
}

async function advanceAfterFailure(store, message) {
  await markAuth(store, "login_expired", message, { writer: COLLECTOR_OWNER_HOME });
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
    const copy = {
      store: shop.store,
      login: shop.login,
      password: shop.password,
      shopId: shop.shopId || "",
      merchantId: shop.merchantId || "",
      manual: shop.manual === true
    };
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

export async function beginRelogin(store, cookie, options) {
  const name = String(store || "").trim();
  if (!name) {
    const error = new Error("请选择店铺");
    error.statusCode = 400;
    throw error;
  }
  if (loginInProgress(name)) {
    return currentLoginState(name);
  }
  const manual = Boolean(options && options.manual);
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
    const alive = await cookiesAlive(existing.cookies || [], withMerchant({
      store: name,
      shopId: (existing && existing.shopId) || (shop && shop.shopId) || "",
      merchantId: shop && shop.merchantId
    }));
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
    await markAuth(name, "login_expired", "登录已失效，请重新登录", { writer: COLLECTOR_OWNER_HOME });
  }
  try {
    const renewed = await passwordRelogin({
      store: shop.store,
      login: shop.login,
      password: shop.password,
      shopId: shop.shopId || "",
      merchantId: shop.merchantId || ""
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
    /* 点重新登录也先走账号密码；需要验证码时再打开服务器画面 */
  }
  if (epoch !== loginEpoch) {
    return currentLoginState(name);
  }
  const queued = {
    store: shop.store,
    login: shop.login,
    password: shop.password,
    shopId: shop.shopId || "",
    merchantId: shop.merchantId || "",
    // live2 点重新登录也会自动点立即登录；需要滑块时画面留着等人拖。
    manual: false
  };
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
          enabled: shop.enabled !== false,
          team: shop.team || "",
          manager: shop.manager || ""
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
          // Ads-only / timeout offline must not enter password recover.
          if (!row) {
            return false;
          }
          if (row.loginExpired === true && !isAdsOnlyAuthMessage(row.offlineReason || row.adsReason || "")) {
            return true;
          }
          return false;
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
      if (humanProtectsShop(shop.store)) {
        return;
      }
      if (backoffHold(shop.store)) {
        return;
      }
      const session = byName.get(shop.store);
      if (session && isAdsOnlyAuthMessage(session.authMessage)) {
        return;
      }
      // Only true Jingmai login gaps — not ads/timeout offline.
      const needs = dropped.has(shop.store) || sessionNeedsLogin(session || { enabled: true, cookies: [], authState: "" });
      if (!needs) {
        return;
      }
      targets.push({
        store: shop.store,
        login: shop.login,
        password: shop.password,
        shopId: shop.shopId || "",
        sessionVersion: sessionVersionOf(session)
      });
      shop.login = "";
      shop.password = "";
    });
    const results = [];
    // Password recover is HTTP only and does not open the desk. Try every expired shop.
    const maxRecover = targets.length;
    for (let i = 0; i < targets.length && results.length < maxRecover; i += 1) {
      const shop = targets[i];
      if (humanProtectsShop(shop.store) || inflight.has(shop.store)) {
        continue;
      }
      const claimed = await claimCollectorOwner(shop.store, COLLECTOR_OWNER_HOME);
      if (!claimed || !claimed.ok) {
        results.push({ store: shop.store, status: "busy", reason: claimed && claimed.reason });
        continue;
      }
      try {
        const ok = await passwordRelogin(Object.assign({}, shop, { respectHuman: true }));
        if (ok) {
          clearFailBackoff(shop.store);
          results.push({ store: shop.store, status: "ok" });
        } else {
          noteFailBackoff(shop.store, "recover");
          results.push({ store: shop.store, status: "login" });
        }
      } catch {
        noteFailBackoff(shop.store, "recover");
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
      attempted: results.length,
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
    if (peeked && (peeked.status === "verify" || peeked.status === "screen" || peeked.status === "code" || peeked.status === "ok" || peeked.needCode)) {
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
  if (state.status === "code" || state.needCode) {
    loginCursor.phase = "screen";
    loginCursor.needCode = true;
    loginCursor.step = "验证码";
    loginCursor.message = state.message || "验证码已发送，请输入后自动登录";
    return publicState({
      status: "code",
      store: name,
      step: "验证码",
      message: loginCursor.message,
      needCode: true
    });
  }
  if (state.status === "verify" || state.status === "screen") {
    loginCursor.phase = "screen";
    loginCursor.step = "京麦登录页";
    const kept = /点登录|账号和密码|验证码/.test(String(loginCursor.message || "")) ? loginCursor.message : "";
    loginCursor.message = kept || state.message || LOGIN_SCREEN_MESSAGE;
    return publicState({
      status: "screen",
      store: name,
      step: "京麦登录页",
      message: loginCursor.message,
      needCode: /验证码/.test(String(loginCursor.message || ""))
    });
  }
  if (state.status === "ok") {
    const cookies = state.cookies || [];
    const cached = orgCache.get(name);
    const kept = await rememberLogin(name, cookies, {
      store: name,
      shopId: (cached && cached.shopId) || "",
      merchantId: (cached && cached.merchantId) || "",
      pageMatch: state.pageMatch === true
    });
    if (kept === "kept") {
      return publicState({ status: "login", store: name, message: "这次登录到的不是这家店，原来的会话还在" });
    }
    if (kept !== "saved") {
      const inside = /shop\.jd\.com/i.test(String(state.href || ""));
      return publicState({
        status: "screen",
        store: name,
        message: inside ? "已经进到商家后台，请看画面确认是不是这家店" : "登录没有通过，请再试一次"
      });
    }
    if (deps.desk && deps.desk.close) {
      await deps.desk.close();
    }
    return advanceAfterSuccess(name);
  }
  if (state.status === "missing") {
    return publicState({ status: "missing", store: name, message: state.message || "请重新打开登录" });
  }
  if (state.status === "opening" && loginCursor.phase === "screen") {
    const kept = /点登录|账号和密码|正在登录/.test(String(loginCursor.message || ""))
      ? loginCursor.message
      : "正在登录，请看下面的画面";
    loginCursor.message = kept;
    return publicState({
      status: "screen",
      store: name,
      step: "京麦登录页",
      message: kept
    });
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
  const typed = Boolean(body && String(body.text || "").trim());
  const waitMs = typed ? 4000 : 1200;
  while (Date.now() - started < waitMs) {
    if (state.status === "ok" || state.status === "done" || state.status === "failed" || state.status === "login") {
      break;
    }
    if (!typed && state.status !== "screen" && state.status !== "opening") {
      break;
    }
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
    const kept = await rememberLogin(name, jar, withMerchant({ store: name, shopId: pending.shopId || "", merchantId: pending.merchantId || "" }));
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
  const opened = await deps.desk.open({
    store: shop.store,
    shopId: shop.shopId || "",
    loginName: shop.login,
    password: shop.password
  });
  shop.login = "";
  shop.password = "";
  if (opened && opened.humanBusy) {
    return { store: shop.store, status: "busy" };
  }
  if (opened.status === "ok") {
    await deps.desk.close();
    const kept = await rememberLogin(shop.store, opened.cookies || [], withMerchant({
      shopId: shop.shopId || "",
      merchantId: shop.merchantId || "",
      store: shop.store
    }));
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
    const copy = withMerchant({
      store: shop.store,
      enabled: shop.enabled,
      login: shop.login,
      password: shop.password,
      shopId: shop.shopId || "",
      merchantId: shop.merchantId || ""
    });
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

const tickLock = { busy: false };

/** Old-site: human login window — background must not navigate that shop for 120s. */
export function humanProtectsShop(store) {
  const name = String(store || "").trim();
  if (!name) {
    return false;
  }
  if (loginInProgress(name)) {
    return true;
  }
  if (loginCursor.store === name && loginCursor.startedAt) {
    const age = Date.now() - Number(loginCursor.startedAt || 0);
    if (age >= 0 && age < 120000) {
      return true;
    }
  }
  return false;
}

export async function jingmaiTick() {
  try {
    await recoverDroppedShops("");
  } catch (error) {
    console.error("jingmai recover", error && error.code ? error.code : "failed");
  }
  await runTick({
    inflight: inflight,
    tickLock: tickLock,
    collectConcurrency: 3,
    collectBudgetMs: 85000,
    collectBuckets: collectBuckets,
    backoffHold: backoffHold,
    noteFailBackoff: noteFailBackoff,
    clearFailBackoff: clearFailBackoff,
    humanProtectsShop: humanProtectsShop,
    // Sole writer: home collector (shared tables). Shen/Han UI may still read the same store.
    listTargets: listHomeCollectTargets,
    fetchHome: function (cookies, signal, expected) {
      return deps.client.fetchHome(cookies, signal, expected);
    },
    fetchAccountIdentity: async function (cookies, signal) {
      if (!deps.client || !deps.client.fetchAccountIdentity) {
        return { shopId: "", shopName: "" };
      }
      return deps.client.fetchAccountIdentity(cookies, undefined, signal);
    },
    updateSessionCookies: updateSessionCookies,
    reloadShop: async function (store) {
      const rows = await listSessions();
      const row = rows.find(function (item) {
        return item.store === store;
      });
      return row ? withMerchant(row) : null;
    },
    recheckJingmai: async function (shop, signal) {
      if (!shop || !shop.cookies || !shop.cookies.length || !deps.client) {
        return false;
      }
      try {
        if (!deps.client.fetchAccountIdentity) {
          return false;
        }
        const identity = await deps.client.fetchAccountIdentity(shop.cookies, undefined, signal);
        const known = withMerchant(shop);
        const match = matchCollectIdentity(
          { store: known.store, shopId: known.shopId || "", merchantId: known.merchantId || "" },
          identity || { shopId: "", shopName: "" }
        );
        // Historical cross-shop profiles must match shopId; mismatch keeps old data.
        return match.ok === true;
      } catch (error) {
        if (error && error.code === "login") {
          return false;
        }
        // Timeout / missing identity: never treat recheck as alive.
        return false;
      }
    },
    saveSample: saveSample,
    markAuth: markAuth,
    now: beijingParts
  });
}

export function startJingmaiCollector() {
  if (globalThis.__homeLive2Started) return;
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
