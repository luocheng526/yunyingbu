import { createHash, randomBytes } from "node:crypto";
import { Buffer } from "node:buffer";
import { URLSearchParams } from "node:url";
import { API_ORIGIN, MASTERS, ORIGIN, PAGE_SIZE, accessCodes, reports } from "./catalog.js";
import { listSheetHeads, readState, replaceMasters, writeMaster, writeSheet, writeState } from "./persist.js";
import { collectScopes, shanghaiToday } from "./time.js";
import { createPasswordAuth } from "./password-login.js";
import { verifyQrIdentity } from "./qr-login.js";
import { passwordLoginHold } from "./login-diagnostics.js";
import { isSingleShopRequest } from "./probe-target.js";
import { shopDayRequest, validShopDay } from "./shop-day-contract.js";
import { visibleShops, BATCH_DATE } from "./shop-batch.js";
import { createRequestPacer } from "./request-pacer.js";
import { GOODS_REPORTS, GOODS_BACKFILL_CONCURRENCY } from './goods-backfill.js';
import { CHANNEL_DAILY_REPORTS } from './daily-channel.js';

const QUIET_MODULES = new Set(["hp", "team"]);
const QUIET_MASTERS = new Set(["goods", "teams", "members"]);

const KNOWN_ACCESS = new Set(accessCodes());
let fetchImpl = globalThis.fetch;
let timer = null;
let busy = false;
let scopedReadBusy = false;
let batchReads = 0, scopedWrites = Promise.resolve(), refreshedSession = null;
const batchPacer = createRequestPacer();
function withScopedWrite(action) {
  const result = scopedWrites.then(action);
  scopedWrites = result.catch(() => {});
  return result;
}
let preferenceWrites = Promise.resolve();
const passwordAuth = createPasswordAuth({ readSession: session, saveSession, request: callUpstream, allowUserOnlyIdentity: () => !collectionStatus().batchEnabled, savePreference: writeAutoReloginPreference });

export function resetPasswordCredentials() { passwordAuth.disableAutoRelogin(); }

function writeAutoReloginPreference(enabled) {
  // Stop immediately, before waiting for storage. Keep this outside session so
  // an in-flight login or collector cannot overwrite a later cancellation.
  if (!enabled) passwordAuth.disableAutoRelogin();
  const write = preferenceWrites.then(() => writeState("password-auto-relogin", enabled));
  preferenceWrites = write.catch(() => {});
  return write;
}

export async function setAutoReloginPreference(input) {
  if (!input || typeof input.enabled !== "boolean" || Object.keys(input).length !== 1) {
    return { ok: false, statusCode: 400, message: "自动重登选项必须为开启或关闭。" };
  }
  await writeAutoReloginPreference(input.enabled);
  return { ok: true, autoReloginEnabled: input.enabled, passwordAuth: passwordAuth.status() };
}

export async function loginWithPassword(input) {
  if (collectionStatus().batchEnabled) {
    return { ok: false, statusCode: 409, message: "账号密码试采阶段请保持批量采集关闭。" };
  }
  const result = await passwordAuth.signIn(input);
  return { ...(await linkStatus()), ...result, passwordAuth: passwordAuth.status() };
}

// Bulk collection must stay off until the single-shop request is verified.
export function collectionStatus() {
  const batchEnabled = process.env.BOUND_COLLECTION_MODE === "batch";
  return {
    mode: batchEnabled ? "batch" : "paused",
    batchEnabled,
    message: batchEnabled ? "" : "批量采集已暂停，先核验单店、单日、单项数据。"
  };
}

export function setBoundFetch(next) {
  fetchImpl = next || globalThis.fetch;
}

export function stopCollectLoop() {
  if (timer) {
    globalThis.clearInterval(timer);
  }
  timer = null;
  busy = false;
}

export function ensureCollectLoop() {
  if (!collectionStatus().batchEnabled || timer || process.env.BOUND_COLLECT_LOOP === "0") {
    return;
  }
  timer = globalThis.setInterval(() => {
    tick().catch(() => {});
  }, 4000);
  if (typeof timer.unref === "function") {
    timer.unref();
  }
}

function blankSession() {
  return {
    phase: "idle",
    provider: "WECHAT",
    deviceId: "",
    cookies: {},
    scene: "",
    qrUrl: "",
    message: "",
    accounts: [],
    loginTicket: "",
    allowed: null,
    userName: ""
  };
}

async function session() {
  const saved = await readState("session", null);
  const next = { ...blankSession(), ...(saved || {}) };
  next.cookies = { ...next.cookies };
  if (!next.deviceId) {
    next.deviceId = randomBytes(16).toString("hex");
    await writeState("session", next);
  }
  return next;
}

async function saveSession(next) {
  await writeState("session", next);
  return next;
}

function absorbCookies(current, response) {
  const lines = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  const single = response.headers.get("set-cookie");
  const all = lines.length ? lines : single ? [single] : [];
  all.forEach((line) => {
    const part = String(line).split(";")[0];
    const index = part.indexOf("=");
    if (index > 0) {
      current.cookies[part.slice(0, index).trim()] = part.slice(index + 1).trim();
    }
  });
}

async function callUpstream(current, spec) {
  const url = new URL(API_ORIGIN + spec.path);
  Object.entries(spec.query || {}).forEach(([key, value]) => {
    if (value != null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  const headers = {
    "X-Requested-With": "XMLHttpRequest",
    Origin: ORIGIN,
    Referer: spec.referer || `${ORIGIN}/login`,
    Accept: "application/json,image/*,*/*"
  };
  const cookie = Object.entries(current.cookies || {}).map(([key, value]) => `${key}=${value}`).join("; ");
  if (cookie) {
    headers.Cookie = cookie;
  }
  if (spec.access) {
    headers["access-code"] = spec.access;
  }
  let body;
  if (spec.method === "form") {
    headers["Content-Type"] = "application/x-www-form-urlencoded;charset=UTF-8";
    body = formBody(spec.body || {});
  } else if (spec.method !== "get") {
    headers["Content-Type"] = "application/json;charset=UTF-8";
    body = JSON.stringify(spec.body || {});
  }
  const response = await fetchImpl(url, {
    method: spec.method === "get" ? "GET" : "POST", headers, body,
    ...(spec.signal ? { signal: spec.signal } : {}),
    ...(spec.redirect ? { redirect: spec.redirect } : {})
  });
  absorbCookies(current, response);
  const retryAfter = response.headers.get("retry-after");
  const retryAfterMs = retryAfter == null ? 0 : /^\d+$/.test(retryAfter) ? Number(retryAfter) * 1000 : Math.max(0, Date.parse(retryAfter) - Date.now());
  const retryHint = Number.isFinite(retryAfterMs) && retryAfterMs > 0 ? { retryAfterMs } : {};
  const type = response.headers.get("content-type") || "";
  if (!type.includes("json")) {
    const buffer = Buffer.from(await response.arrayBuffer());
    return { binary: true, type, buffer, status: response.status, httpStatus: response.status, ...retryHint };
  }
  const payload = await response.json();
  return spec.withHttpStatus ? { httpStatus: response.status, payload, ...retryHint } : payload;
}

// Uses this module's server session only; a login in another browser is not a server login.
export async function requestSingleShopProbe(body, onRequest) {
  if (!isSingleShopRequest(body) || collectionStatus().batchEnabled) return { blocked: "invalid_scope" };
  return requestScopedRead({ method: "json", path: "/v2/channel/shop/operatingData", access: "qd_fx", body,
    referer: `${ORIGIN}/workTable/channelAnalysis` }, onRequest);
}

// Callers supply a report identifier, never an upstream URL or arbitrary request body.
export async function requestShopDayReport(input, onRequest = () => {}) {
  const spec = shopDayRequest(input);
  if (!spec || collectionStatus().batchEnabled) return { blocked: "invalid_scope" };
  return requestScopedRead(spec, onRequest);
}

let batchShops = new Set(), batchOwner = "";
const QR_PROVIDERS = ["FEISHU", "DINGTALK", "QYWX", "WECHAT"];
const verifiedLogin = current => current.provider === "PASSWORD" || (QR_PROVIDERS.includes(current.provider)
  && Boolean(current.authGeneration) && current.qrIdentityGeneration === current.authGeneration);
// Keep the legacy field and hash shape to preserve ownership of existing jobs.
const ownerOf = current => current.passwordIdentity?.userId ? createHash("sha256").update(JSON.stringify(current.passwordIdentity)).digest("hex") : "";
export async function requestVisibleShops({ forDailyPerformance = false } = {}) {
  const current = await session(), owner = ownerOf(current);
  if (collectionStatus().batchEnabled || !owner || !verifiedLogin(current)) return { ok: false, statusCode: 409, reason: "server_login_required" };
  const spec = { method: "get", path: "/v2/channel/getAllChannelList", access: "", referer: ORIGIN + "/workTable/channelOverview" };
  const response = forDailyPerformance
    ? await batchPacer.run(() => requestScopedRead({ ...spec, ownerHash: owner, parallelLimit: GOODS_BACKFILL_CONCURRENCY }))
    : await requestScopedRead(spec);
  if (response.blocked) return { ok: false, statusCode: 409, reason: response.blocked };
  if (response.httpStatus !== 200 || response.payload?.code !== 0) return { ok: false, statusCode: 502, reason: "shop_discovery_failed" };
  if (ownerOf(await session()) !== owner) return { ok: false, statusCode: 409, reason: "identity_changed" };
  const shops = visibleShops(response.payload.data);
  if (!shops) return { ok: false, statusCode: 502, reason: "shop_list_unverified", shape: Array.isArray(response.payload.data) ? { array: true, firstKeys: Object.keys(response.payload.data[0] || {}), firstValue: response.payload.data[0]?.value, childKeys: Object.keys(response.payload.data[0]?.shopList?.[0] || {}) } : { keys: Object.keys(response.payload.data || {}) } };
  batchShops = new Set(shops.map(s => s.platform + ":" + s.shopId)); batchOwner = owner;
  return { ok: true, shops, owner };
}
export async function requestBatchShopDayReport(input, onRequest, scope, owner) {
  if (!validShopDay(scope) || scope.date !== BATCH_DATE || owner !== batchOwner || !batchShops.has(scope.platform + ":" + scope.shopId) || collectionStatus().batchEnabled) return { blocked: "invalid_scope" };
  if (ownerOf(await session()) !== owner) return { blocked: "identity_changed" };
  const spec = shopDayRequest(input, scope, 200);
  if (!spec) return { blocked: "invalid_scope" };
  return batchPacer.run(() => requestScopedRead({ ...spec, ownerHash: owner }, onRequest));
}

export async function requestGoodsBackfillReport(input, onRequest, scope, owner) {
  if (!validShopDay(scope) || scope.date >= shanghaiToday() || !GOODS_REPORTS.includes(input?.reportId) || Object.keys(input).some(k => !['reportId', 'page'].includes(k)) || owner !== batchOwner || !batchShops.has(scope.platform + ':' + scope.shopId) || collectionStatus().batchEnabled) return { blocked: 'invalid_scope' };
  if (ownerOf(await session()) !== owner) return { blocked: 'identity_changed' };
  const spec = shopDayRequest(input, scope, 200);
  if (!spec) return { blocked: 'invalid_scope' };
  return batchPacer.run(() => requestScopedRead({ ...spec, ownerHash: owner, parallelLimit: GOODS_BACKFILL_CONCURRENCY }, onRequest));
}

// The performance sheet shares the backfill's authenticated session and pacing.
export async function requestDailyPerformance(scope, owner) {
  if (!validShopDay(scope) || scope.date >= shanghaiToday() || !owner || owner !== batchOwner ||
    !batchShops.has(scope.platform + ":" + scope.shopId) || collectionStatus().batchEnabled) {
    return { blocked: "invalid_scope" };
  }
  const spec = shopDayRequest({ reportId: "channel_shop_table" }, scope);
  return batchPacer.run(() => requestScopedRead({ ...spec, ownerHash: owner, parallelLimit: GOODS_BACKFILL_CONCURRENCY }));
}

export async function requestChannelDailyReport(reportId, date) {
  if (!CHANNEL_DAILY_REPORTS.includes(reportId) || date >= shanghaiToday() || collectionStatus().batchEnabled) return { blocked: 'invalid_scope' };
  const current = await session();
  const owner = ownerOf(current);
  if (!owner || !verifiedLogin(current)) return { blocked: 'server_login_required' };
  const report = reports().find(item => item.id === reportId);
  const page = reportId === 'qdzl_lb' ? 'channelOverview' : 'channelAnalysis';
  const body = reportBody(report, 'all', { start: date, end: date, daysType: '1' }, 1);
  const result = await batchPacer.run(() => requestScopedRead({
    path: report.path, method: report.method, access: report.access, body, referer: ORIGIN + '/workTable/' + page,
    ownerHash: owner, exclusive: true
  }));
  if (ownerOf(await session()) !== owner) return { blocked: 'identity_changed' };
  if (result.payload?.code === 0) {
    const data = extractList(result.payload.data);
    if (!data.object && data.total > data.rows.length) return { blocked: 'incomplete_report' };
  }
  return result;
}

async function requestScopedRead(spec, onRequest = () => {}) {
  const parallel = Boolean(spec.ownerHash) && !spec.exclusive;
  const limit = parallel ? spec.parallelLimit === GOODS_BACKFILL_CONCURRENCY ? GOODS_BACKFILL_CONCURRENCY : 2 : 1;
  if (scopedReadBusy || batchReads >= limit) return { blocked: "collector_busy" };
  if (parallel) batchReads++; else scopedReadBusy = true;
  try { return await performScopedRead(spec, onRequest); }
  finally { if (parallel) batchReads--; else scopedReadBusy = false; }
}

async function performScopedRead(spec, onRequest) {
  await scopedWrites;
  let current = await session();
  let originalCookies = { ...current.cookies };
  if (spec.ownerHash && ownerOf(current) !== spec.ownerHash) return { blocked: "identity_changed" };
  if (passwordAuth.status().busy) return { blocked: "login_busy" };
  const canRefresh = current.provider === "PASSWORD" && passwordAuth.status().autoReloginReady;
  if (!["logged_in", "collecting"].includes(current.phase) || (!Object.keys(current.cookies || {}).length && !canRefresh)) {
    return { blocked: "server_login_required" };
  }
  if (spec.access && Array.isArray(current.allowed) && !current.allowed.includes(spec.access)) {
    return { blocked: "permission_denied" };
  }
  const send = async () => {
    if (spec.ownerHash && ownerOf(current) !== spec.ownerHash) return { blocked: "identity_changed" };
    if (spec.access && Array.isArray(current.allowed) && !current.allowed.includes(spec.access)) return { blocked: "permission_denied" };
    onRequest();
    return callUpstream(current, {
      ...spec,
      signal: globalThis.AbortSignal.timeout(15000), redirect: "error", withHttpStatus: true
    });
  };
  let result = await send();
  const invalid = value => [-7, 9901, 1011].includes(value.payload?.code);
  const expired = value => value.payload?.code === -1 || value.httpStatus === 401;
  if (!invalid(result) && expired(result) && current.provider === "PASSWORD") {
    const reloginTrigger = { httpStatus: result.httpStatus || result.status || null, upstreamCode: typeof result.payload?.code === "number" ? result.payload.code : null };
    const renewed = await withScopedWrite(async () => {
      const latest = await session();
      if (latest.authGeneration !== current.authGeneration) {
        // A sibling already refreshed this same session. Never sign in twice.
        return refreshedSession?.from === current.authGeneration && refreshedSession.to === latest.authGeneration
          && ownerOf(latest) === ownerOf(current) ? { ok: true } : { ok: false, blocked: "session_changed" };
      }
      if (!passwordAuth.status().autoReloginReady) return { ok: false };
      const reply = await passwordAuth.refresh();
      if (reply.ok) refreshedSession = { from: current.authGeneration, to: (await session()).authGeneration };
      return { ...reply, attempted: true };
    });
    if (renewed.blocked) return { blocked: renewed.blocked };
    if (renewed.attempted || renewed.ok) {
      result.relogin = { attempted: true, succeeded: renewed.ok };
      result.reloginTrigger = reloginTrigger;
    }
    if (renewed.ok) {
      current = await session();
      originalCookies = { ...current.cookies };
      result = { ...(await send()), relogin: { attempted: true, succeeded: true }, reloginTrigger };
    } else if (renewed.attempted) {
      // refresh() has already persisted the failure; do not restore its old cookie.
      return result;
    }
  }
  return withScopedWrite(async () => {
    const latest = await session();
    if (latest.authGeneration !== current.authGeneration) {
      // An authenticated success from before our own refresh is still valid data,
      // but its cookies must never overwrite the renewed session.
      if (!invalid(result) && !expired(result) && refreshedSession?.from === current.authGeneration
        && refreshedSession.to === latest.authGeneration && ownerOf(latest) === ownerOf(current)
        && ["logged_in", "collecting"].includes(latest.phase)) return result;
      return { blocked: "session_changed" };
    }
    if (invalid(result) || expired(result)) {
      passwordAuth.forget();
      await saveSession({ ...latest, authGeneration: randomBytes(16).toString("hex"),
        phase: latest.provider === "PASSWORD" ? "needs_password" : "needs_scan",
        message: invalid(result) ? "旧站登录发生冲突、账号禁用或设备限制，已停止自动重登。" : "服务器会话已失效，请重新登录。" });
    } else {
      const cookies = { ...latest.cookies };
      for (const [key, value] of Object.entries(current.cookies)) if (originalCookies[key] !== value) cookies[key] = value;
      await saveSession({ ...latest, cookies });
    }
    return result;
  });
}

// Only the standalone loopback harness exposes this check. It clears this collector's
// cookie copy, never calls upstream logout or invents an expiry response.
export async function clearProbeSessionCookies() {
  const current = await session();
  if (collectionStatus().batchEnabled || passwordAuth.status().busy || current.phase !== "logged_in"
    || current.provider !== "PASSWORD" || !passwordAuth.status().autoReloginReady) {
    return { ok: false, reason: "relogin_not_ready" };
  }
  await saveSession({ ...current, cookies: {} });
  return { ok: true };
}

function formBody(value) {
  const params = new URLSearchParams();
  Object.entries(value).forEach(([key, item]) => {
    if (item == null) {
      return;
    }
    if (Array.isArray(item)) {
      if (!item.length) {
        params.set(key, "");
      }
      item.forEach((entry, index) => {
        params.set(`${key}[${index}]`, typeof entry === "object" ? JSON.stringify(entry) : String(entry));
      });
      return;
    }
    params.set(key, typeof item === "object" ? JSON.stringify(item) : String(item));
  });
  return params.toString();
}

function authExpired(payload) {
  if (!payload || payload.binary) {
    return false;
  }
  const content = String(payload.content || "");
  return payload.code === -1 || payload.code === -7 || payload.code === 9901 || /未登录|登录状态已过期|请重新登录/.test(content);
}

function denied(payload) {
  return /无权限|没有权限|无权|权限不足/.test(String((payload && (payload.content || payload.message)) || ""));
}

function extractList(data) {
  if (Array.isArray(data)) {
    return { rows: data, total: data.length, object: false };
  }
  if (!data || typeof data !== "object") {
    return { rows: [], total: 0, object: true, raw: data };
  }
  for (const key of ["list", "rows", "records", "columnData", "dataList", "goodsList", "pageList"]) {
    if (Array.isArray(data[key])) {
      const total = Number(data.total ?? data.totalCount ?? data.count ?? data[key].length);
      return { rows: data[key], total: Number.isFinite(total) ? total : data[key].length, object: false };
    }
  }
  if (data.growAnalysis && typeof data.growAnalysis === "object") {
    const inner = extractList(data.growAnalysis);
    if (!inner.object || inner.rows.length) {
      return inner;
    }
  }
  if (data.data && typeof data.data === "object") {
    const inner = extractList(data.data);
    if (!inner.object || inner.rows.length) {
      return inner;
    }
  }
  return { rows: [], total: 0, object: true, raw: data };
}

function collectAccess(node, found) {
  if (typeof node === "string") {
    if (KNOWN_ACCESS.has(node)) {
      found.add(node);
    }
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((item) => collectAccess(item, found));
    return;
  }
  if (node && typeof node === "object") {
    Object.values(node).forEach((item) => collectAccess(item, found));
  }
}

function providerQuery(provider) {
  return provider && provider !== "WECHAT" ? { provider } : {};
}

export async function linkStatus() {
  const current = await session();
  await preferenceWrites;
  const autoReloginEnabled = (await readState("password-auto-relogin", false)) === true;
  const collection = collectionStatus();
  const pausedLogin = !collection.batchEnabled && ["collecting", "logged_in"].includes(current.phase);
  return {
    ok: true,
    module: "bound",
    source: "crawler",
    erp: false,
    phase: pausedLogin ? "logged_in" : current.phase,
    collection,
    provider: current.provider,
    passwordAuth: passwordAuth.status(),
    autoReloginEnabled,
    authFailure: current.authFailure || "",
    authDiagnostic: current.authDiagnostic || null,
    loginRetryAfter: current.loginRetryAfter || null,
    passwordRetryAfter: passwordLoginHold(current)?.until || null,
    batchLoginReady: ["logged_in", "collecting"].includes(current.phase) && Boolean(ownerOf(current)) && verifiedLogin(current),
    deviceId: current.deviceId,
    message: qrClient === "old" && current.provider !== "PASSWORD"
      ? "二维码还在闪。请点浏览器左上角的刷新按钮，重新打开这一页。刷新后请用微信扫这一张，它会停住。"
      : pausedLogin && current.provider !== "PASSWORD" && !verifiedLogin(current) ? collection.message : current.message,
    qrToken: current.scene || "",
    userName: current.userName,
    accounts: current.accounts || [],
    qrReady: Boolean(current.qrUrl),
    cursor: collection.batchEnabled ? current.cursor || null : null
  };
}

export async function startLink(provider) {
  if (passwordAuth.status().busy) return { ...(await linkStatus()), ok: false, message: "正在验证账号密码，请稍候。" };
  passwordAuth.disableAutoRelogin();
  const current = await session();
  current.passwordLoginHold = passwordLoginHold(current);
  current.authGeneration = randomBytes(16).toString("hex");
  current.provider = QR_PROVIDERS.includes(provider) ? provider : "WECHAT";
  current.cookies = {}; current.passwordIdentity = null; current.qrIdentityGeneration = null;
  current.allowed = null; current.userName = "";
  current.scene = ""; current.qrUrl = "";
  current.authFailure = ""; current.authDiagnostic = null; current.loginRetryAfter = null;
  current.phase = "waiting_scan";
  current.message = "正在向旧站官方登录接口取二维码";
  current.accounts = [];
  current.loginTicket = "";
  await saveSession(current);
  let payload;
  try {
    payload = await callUpstream(current, {
      method: "get", path: "/auth/qrcode", redirect: "error", signal: globalThis.AbortSignal.timeout(15000),
      query: { deviceId: current.deviceId, domain: "hejun.ecbis.cn", ...providerQuery(current.provider) }
    });
  } catch { /* An explicit click may retry fetching a QR code; never submit a password. */ }
  if ((await session()).authGeneration !== current.authGeneration) return linkStatus();
  if (!payload || payload.code !== 0 || !payload.data) {
    current.phase = "needs_scan";
    current.message = "官方登录二维码未取得，请稍后点击登录方式重试。采集进度已保留。";
    await saveSession(current);
    return linkStatus();
  }
  current.scene = payload.data.scene || "";
  current.qrUrl = payload.data.url || "";
  current.qrIssuedAt = new Date().toISOString();
  current.qrCheckedAt = "";
  current.message = current.provider === "WECHAT"
    ? "请用已绑定旧站账号的微信扫这一张二维码，并在手机上确认。扫旧站网页上的码不会登录这里。"
    : "请打开下方官方授权页面完成扫码，再回到此页查看登录结果。";
  await saveSession(current);
  return linkStatus();
}

let qrCache = { url: "", type: "", buffer: null };
let qrClient = "";
let pollQueue = Promise.resolve();

export function noteQrClient(query) {
  if (query && Object.prototype.hasOwnProperty.call(query, "ts")) {
    qrClient = "old";
    return;
  }
  if (query && Object.prototype.hasOwnProperty.call(query, "v")) {
    qrClient = "new";
  }
}

export function resetQrClient() {
  qrClient = "";
  pollQueue = Promise.resolve();
}

export async function qrBytes() {
  const current = await session();
  if (!current.qrUrl) {
    return null;
  }
  if (current.provider !== "WECHAT") {
    return { kind: "url", url: current.qrUrl };
  }
  if (qrCache.url === current.qrUrl && qrCache.buffer) {
    return { kind: "image", type: qrCache.type, buffer: qrCache.buffer };
  }
  const response = await fetchImpl(current.qrUrl, {
    signal: globalThis.AbortSignal.timeout(15000),
    headers: {
      Referer: `${ORIGIN}/login`,
      Cookie: Object.entries(current.cookies || {}).map(([key, value]) => `${key}=${value}`).join("; ")
    }
  });
  const type = response.headers.get("content-type") || "image/png";
  const buffer = Buffer.from(await response.arrayBuffer());
  qrCache = { url: current.qrUrl, type, buffer };
  return { kind: "image", type, buffer };
}

async function finishLogin(current, _data, expectedCompany = "") {
  const verified = await verifyQrIdentity(current, callUpstream,
    async () => (await session()).authGeneration === current.authGeneration, expectedCompany);
  if ((await session()).authGeneration !== current.authGeneration) return;
  if (!verified.ok) {
    current.phase = "needs_scan";
    current.scene = "";
    current.qrUrl = "";
    current.loginTicket = "";
    current.accounts = [];
    current.cookies = {}; current.passwordIdentity = null; current.qrIdentityGeneration = null;
    current.authFailure = verified.reason; current.authDiagnostic = verified.diagnostic;
    current.message = verified.message;
    await saveSession(current);
    return;
  }
  current.userName = verified.userName;
  current.passwordIdentity = verified.identity;
  current.qrIdentityGeneration = current.authGeneration;
  current.authFailure = ""; current.authDiagnostic = null; current.loginRetryAfter = null;
  const collection = collectionStatus();
  current.phase = collection.batchEnabled ? "collecting" : "logged_in";
  current.scene = "";
  current.qrUrl = "";
  current.loginTicket = "";
  current.message = collection.batchEnabled
    ? "已登录。按筛选时间整段补采，最近两天不取。页面查询不会再打旧站。"
    : "扫码已登录，账号身份已核验。请点击“开始 / 继续本轮采集”；同一账号可继续原队列，已采数据会复用。会话过期后需重新扫码。";
  current.accounts = [];
  await saveSession(current);
}

const QR_HOLD_MS = 90 * 1000;

function issuedAge(current) {
  const issued = Date.parse(current.qrIssuedAt || "");
  return Number.isFinite(issued) ? Date.now() - issued : 0;
}

async function sessionAlive(current) {
  try {
    const info = await callUpstream(current, { method: "get", path: "/auth/info" });
    return Boolean(info && info.code === 0);
  } catch {
    return true;
  }
}

async function dropLogin(current) {
  current.phase = "needs_scan";
  current.scene = "";
  current.qrUrl = "";
  current.loginTicket = "";
  current.message = "旧站登录已过期。已保留补采进度。请点下面的微信，扫新的一张。";
  await saveSession(current);
}

async function saveUnlessLoggedIn(current) {
  const latest = await session();
  if (latest.authGeneration !== current.authGeneration) return linkStatus();
  if (latest.phase === "collecting" || latest.phase === "logged_in" || latest.phase === "choose_account") {
    return linkStatus();
  }
  if (latest.scene && current.scene && latest.scene !== current.scene) {
    return linkStatus();
  }
  await saveSession(current);
  return linkStatus();
}

async function pollLinkOnce() {
  const current = await session();
  if (!current.scene || (current.phase !== "waiting_scan" && current.phase !== "needs_scan")) {
    return linkStatus();
  }
  if (!current.qrIssuedAt) {
    current.qrIssuedAt = new Date().toISOString();
  }
  let payload;
  try { payload = await callUpstream(current, {
    method: "get", redirect: "error", signal: globalThis.AbortSignal.timeout(15000),
    path: "/auth/checkQrcode",
    query: {
      scene: current.scene,
      domain: "hejun.ecbis.cn",
      deviceId: current.deviceId,
      ...providerQuery(current.provider)
    }
  }); } catch {
    current.message = "暂未取得扫码状态，请稍候。采集进度已保留。";
    return saveUnlessLoggedIn(current);
  }
  if ((await session()).authGeneration !== current.authGeneration) return linkStatus();
  const code = Number(payload && payload.code);
  const content = String((payload && payload.content) || "");
  if (code === 0) {
    const data = payload.data || {};
    if (data.needBind) {
      current.message = data.message || "这个第三方账号还没绑定，请先在旧站用账号绑定后再扫。";
    } else if (data.needSelect && Array.isArray(data.accounts) && data.accounts.length) {
      current.loginTicket = data.loginTicket || "";
      current.accounts = data.accounts;
      if (data.accounts.length === 1) {
        await saveSession(current);
        return pickAccount(data.accounts[0].companyId);
      }
      current.phase = "choose_account";
      current.message = "扫码成功，请选择要进入的企业账号。";
    } else {
      await finishLogin(current, data);
      return linkStatus();
    }
    return saveUnlessLoggedIn(current);
  }
  const shaky = code === -1 || code === -7 || /未登录|登录状态已过期|请重新登录/.test(content);
  if (code === 1000102) {
    const latest = await session();
    if (latest.phase === "collecting" || latest.phase === "logged_in" || latest.phase === "choose_account") {
      return linkStatus();
    }
    current.phase = "waiting_scan";
    current.message = "未扫码。请用微信扫这一张，扫完后在手机上点确认登录。扫旧站网页上的码不会登录这里。";
  } else if (code === 1000104 || code === 1000105 || code === 1000106) {
    current.phase = "waiting_scan";
    current.message = content || "已经扫到了。请在手机上点确认登录。";
  } else if (code === 1000103 || (shaky && issuedAge(current) >= QR_HOLD_MS)) {
    const latest = await session();
    if (latest.phase === "collecting" || latest.phase === "logged_in" || latest.phase === "choose_account") {
      return linkStatus();
    }
    current.scene = "";
    current.qrUrl = "";
    current.phase = "needs_scan";
    current.message = "二维码已过期。请点击下方登录方式重新获取，采集进度已保留。";
    await saveSession(current);
    return linkStatus();
  } else if (shaky) {
    current.phase = "waiting_scan";
    current.message = content || "请用微信扫这一张，扫完后在手机上点确认登录。";
  } else if (code === 1011) {
    current.message = content || `浏览器标识未加入登录管理：${current.deviceId}`;
  } else if (content) {
    current.message = content;
  }
  return saveUnlessLoggedIn(current);
}

export function pollLink() {
  const run = pollQueue.then(pollLinkOnce, pollLinkOnce);
  pollQueue = run.then(() => {}, () => {});
  return run;
}

export async function pickAccount(companyId) {
  if (passwordAuth.status().busy) return { ...(await linkStatus()), ok: false, message: "正在验证账号密码，请稍候。" };
  const current = await session();
  const account = (current.accounts || []).find((item) => String(item.companyId) === String(companyId));
  if (!account || !current.loginTicket) {
    return { ...(await linkStatus()), ok: false, error: "没有可选择的企业账号" };
  }
  // A later company choice supersedes the earlier ticket exchange.
  current.authGeneration = randomBytes(16).toString("hex");
  current.passwordIdentity = null; current.qrIdentityGeneration = null;
  await saveSession(current);
  let payload;
  try { payload = await callUpstream(current, {
    method: "json", redirect: "error", signal: globalThis.AbortSignal.timeout(15000),
    path: "/auth/ticket/login",
    body: {
      loginTicket: current.loginTicket,
      companyId: account.companyId,
      deviceId: current.deviceId,
      agreementStatus: true
    }
  }); } catch { /* Return a bounded failure without leaking the ticket or upstream body. */ }
  if ((await session()).authGeneration !== current.authGeneration) return linkStatus();
  if (!payload || payload.code !== 0) {
    current.message = "企业账号登录未完成，请稍后重新扫码。";
    current.phase = "needs_scan"; current.scene = ""; current.qrUrl = "";
    current.loginTicket = ""; current.accounts = [];
    await saveSession(current);
    return { ...(await linkStatus()), ok: false };
  }
  await finishLogin(current, payload.data || account, account.companyId);
  return linkStatus();
}

async function masterState() {
  return (await readState("masters", {})) || {};
}

function requestMark(report) {
  if (report.id === "qdfx_yj") {
    return "year2";
  }
  if (report.id === "qdzl_yj") {
    return "year";
  }
  if (report.id === "qdzl_pl") {
    return "channelCate";
  }
  if (report.id === "qdzl_rx" || report.id === "qdfx_rx") {
    return "hot2";
  }
  if (report.id === "qdfx_jy") {
    return "shopOp";
  }
  return "q=1";
}

function permanentText(text) {
  return /不能为空|请选择|参数错误|参数不匹配|无权限/.test(String(text || ""));
}

function transientText(text) {
  return /操作失败|请稍后重试|超时|网络|error/i.test(String(text || "")) && !permanentText(text);
}

function updatedAge(row) {
  const raw = String((row && row.updatedAt) || "").replace(" ", "T");
  const updated = Date.parse(raw ? (raw.endsWith("Z") ? raw : `${raw}Z`) : "");
  return Number.isFinite(updated) ? Date.now() - updated : Number.POSITIVE_INFINITY;
}

function failureSettled(report, scope, row) {
  if (!row || row.status !== "failed" || row.attempts < 3) {
    return false;
  }
  const text = String(row.errorText || "");
  if (transientText(text)) {
    return updatedAge(row) < 10 * 60 * 1000;
  }
  return text.startsWith(`${requestMark(report)} daysType=${scope.daysType} `);
}

function thinList(report, dim, first, sheets) {
  if (!first || first.status !== "done") {
    return false;
  }
  if (report.id !== "qdfx_dplb" && report.id !== "qd_gjzbfx_dpck") {
    return false;
  }
  if (String(first.errorText || "").startsWith("thin-ok")) {
    return false;
  }
  if ((first.rowCount || 0) >= 20) {
    return false;
  }
  return sheets.some(
    (row) => row.reportId === report.id && row.dim === dim && row.pageNo === 1 && row.status === "done" && row.rowCount >= 40 && row.startOn !== first.startOn
  );
}

function rawIdentity(raw) {
  if (!raw || typeof raw !== "object") {
    return String(raw);
  }
  const shopId = raw.shopId || raw.shopID || "";
  const goodsId = raw.goodsId || raw.spuid || raw.skuId || raw.hpCode || "";
  const shop = raw.shopName || raw.shop || "";
  const platform = raw.platform || raw.platformName || "";
  const name = raw.channelName || raw.platformName || raw.cateName || raw.goodsName || raw.name || "";
  const sum = raw.sumLine ? "sum" : "";
  return [shopId, goodsId, shop, platform, name, sum].join("|");
}

function dedupeRaw(rows) {
  const seen = new Set();
  return rows.filter((raw) => {
    const id = rawIdentity(raw);
    if (seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
}

function failText(report, scope, message) {
  return `${requestMark(report)} daysType=${scope.daysType} ${String(message || "接口失败")}`.slice(0, 300);
}

function compareYears(scope) {
  const year = Number(String(scope.end || scope.start || "").slice(0, 4));
  const current = Number.isFinite(year) && year >= 2026 ? year : 2026;
  return { prevYear: current - 1, year: current };
}

export function reportBody(report, dim, scope, page) {
  const daysType = String(scope.daysType);
  const dated = {
    startDate: scope.start,
    endDate: scope.end,
    daysType
  };
  if (report.id === "qdzl_yj") {
    return { ...compareYears(scope), compareType: 0, lstChannel: null };
  }
  if (report.id === "qdfx_yj") {
    const years = compareYears(scope);
    return { ...years, compareType: 0, lstChannel: null, queryType: 1, platform: "all", shopId: "" };
  }
  if (report.id === "qdzl_rx" || report.id === "qdfx_rx") {
    const body = { ...dated, queryType: 1, platform: "all", shopId: "", pageNum: Math.max(page, 1), pageSize: PAGE_SIZE };
    if (dim === "spu") {
      body.isSpu = true;
    }
    return body;
  }
  if (report.id === "qdfx_jy" || report.id === "qdzl_jy") {
    return { ...dated, queryType: 1, platform: "all", shopId: "", exportMode: "" };
  }
  return { ...dated, exportMode: "", showTrendView: false };
}

export async function noteWanted(page, report, dim, scope) {
  if (!collectionStatus().batchEnabled) {
    return;
  }
  if (!page || (page.module !== "channel" && page.module !== "goods") || !report || page.local) {
    return;
  }
  const start = String(scope.start || "");
  const end = String(scope.end || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) {
    return;
  }
  const item = { reportId: report.id, dim: dim || "all", start, end, daysType: String(scope.daysType || "custom") };
  const saved = await readState("wanted", []);
  const wanted = Array.isArray(saved) ? saved : [];
  if (wanted.some((row) => row.reportId === item.reportId && row.dim === item.dim && row.start === item.start && row.end === item.end)) {
    return;
  }
  wanted.push(item);
  await writeState("wanted", wanted.slice(-30));
}

function sheetHole(report, dim, scope, sheets) {
  const pages = sheets.filter(
    (row) => row.reportId === report.id && row.dim === dim && row.startOn === scope.start && row.endOn === scope.end
  );
  const first = pages.find((row) => row.pageNo === 1);
  if (!first) {
    return { page: 1, kind: report.kind === "object" ? "object" : "list", attempts: 0, cause: "new" };
  }
  if (first.status === "denied") {
    return null;
  }
  if (first.status === "failed") {
    if (first.attempts >= 3 && failureSettled(report, scope, first)) {
      return null;
    }
    return { page: 1, kind: first.kind || report.kind, attempts: first.attempts >= 3 ? 0 : first.attempts, cause: "retry" };
  }
  if (first.status !== "done") {
    return { page: 1, kind: first.kind || report.kind, attempts: first.attempts, cause: "page" };
  }
  const siblingHasRows = sheets.some(
    (row) => row.reportId === report.id && row.dim === dim && row.pageNo === 1 && row.status === "done" && row.totalRows > 0
  );
  if (scope.start === scope.end && first.kind !== "object" && first.totalRows === 0 && first.rowCount === 0 && siblingHasRows && !String(first.errorText || "").startsWith("empty-ok2")) {
    return { page: 1, kind: "list", attempts: first.attempts, emptyRetry: true, cause: "empty" };
  }
  if (scope.start === scope.end && thinList(report, dim, first, sheets)) {
    return { page: 1, kind: "list", attempts: 0, cause: "retry", thinRetry: true };
  }
  if (first.kind === "object") {
    return null;
  }
  const size = first.pageSize || PAGE_SIZE;
  const need = first.totalRows === 0 ? 1 : Math.ceil(first.totalRows / size);
  for (let page = 2; page <= Math.min(need, 200); page += 1) {
    const found = pages.find((row) => row.pageNo === page);
    if (!found) {
      return { page, kind: "list", attempts: 0, cause: "page" };
    }
    if (found.status === "failed") {
      if (found.attempts >= 3 && failureSettled(report, scope, found)) {
        continue;
      }
      return { page, kind: "list", attempts: found.attempts >= 3 ? 0 : found.attempts, cause: "retry" };
    }
    if (found.status !== "done" && found.status !== "failed") {
      return { page, kind: "list", attempts: found.attempts, cause: "page" };
    }
  }
  if (report.sumPath) {
    const sum = pages.find((row) => row.pageNo === 0);
    if (!sum) {
      return { page: 0, kind: "sum", attempts: 0, cause: "page" };
    }
    if (sum.status === "failed" && sum.attempts < 3) {
      return { page: 0, kind: "sum", attempts: sum.attempts, cause: "page" };
    }
  }
  return null;
}

async function wantedUnit(sheets) {
  const saved = await readState("wanted", []);
  const wanted = Array.isArray(saved) ? saved : [];
  if (!wanted.length) {
    return null;
  }
  const keep = [];
  let chosen = null;
  for (const item of wanted) {
    const report = reports().find((row) => row.id === item.reportId && (row.module === "channel" || row.module === "goods"));
    if (!report) {
      continue;
    }
    const scope = { start: item.start, end: item.end, daysType: item.daysType || "custom" };
    const hole = sheetHole(report, item.dim || "all", scope, sheets);
    if (!hole) {
      continue;
    }
    if (!chosen) {
      chosen = { type: "report", report, dim: item.dim || "all", scope, ...hole };
    }
    keep.push(item);
  }
  if (keep.length !== wanted.length) {
    await writeState("wanted", keep);
  }
  return chosen;
}

async function nextUnit(current) {
  const sheets = await listSheetHeads();
  const queued = await wantedUnit(sheets);
  if (queued) {
    return queued;
  }
  const masters = await masterState();
  for (const master of MASTERS) {
    if (QUIET_MASTERS.has(master.id)) {
      continue;
    }
    const state = masters[master.id] || { status: "missing", page: 1, attempts: 0 };
    if (state.status === "done" || state.status === "failed") {
      continue;
    }
    return { type: "master", master, page: state.page || 1, attempts: state.attempts || 0 };
  }
  const allowed = Array.isArray(current.allowed) ? new Set(current.allowed) : null;
  const scopes = collectScopes(shanghaiToday());
  for (const cause of ["retry", "empty", "page", "new"]) {
    for (const report of reports()) {
      if (QUIET_MODULES.has(report.module)) {
        continue;
      }
      if (allowed && report.access && !allowed.has(report.access)) {
        continue;
      }
      for (const dim of report.dims || ["all"]) {
        for (const scope of scopes) {
          const hole = sheetHole(report, dim, scope, sheets);
          if (hole && hole.cause === cause) {
            return { type: "report", report, dim, scope, ...hole };
          }
        }
      }
    }
  }
  return null;
}

async function rememberMaster(id, patch) {
  const masters = await masterState();
  masters[id] = { ...(masters[id] || {}), ...patch };
  await writeState("masters", masters);
}

async function runMaster(current, unit) {
  const master = unit.master;
  let payload;
  try {
    payload = await callUpstream(current, {
      method: master.method,
      path: master.path,
      access: "",
      query: master.method === "get" ? { pageNum: unit.page, pageSize: PAGE_SIZE, startDate: "2026-09-01", endDate: shanghaiToday() } : {},
      body: master.method === "get" ? null : reportBody(master, "all", { start: "2026-09-01", end: shanghaiToday(), daysType: "custom" }, unit.page)
    });
  } catch (error) {
    await rememberMaster(master.id, { status: unit.attempts + 1 >= 3 ? "failed" : "retry", page: unit.page, attempts: unit.attempts + 1, error: String(error.message || error).slice(0, 300) });
    return;
  }
  if (authExpired(payload) && !(await sessionAlive(current))) {
    await dropLogin(current);
    return;
  }
  if (!payload || payload.code !== 0) {
    await rememberMaster(master.id, {
      status: unit.attempts + 1 >= 3 ? "failed" : "retry",
      attempts: unit.attempts + 1,
      error: String((payload && payload.content) || "资料接口失败").slice(0, 300)
    });
    return;
  }
  const extracted = extractList(payload.data);
  const items = extracted.object ? [extracted.raw || payload.data] : extracted.rows;
  if (unit.page === 1) {
    await replaceMasters(master.id, items.filter(Boolean));
  } else {
    for (const item of items) {
      const key = String((item && (item.id || item.goodsId || item.shopId || item.userId)) || `${master.id}-${unit.page}-${items.indexOf(item)}`);
      await writeMaster(master.id, key, item);
    }
  }
  if (master.id === "perms") {
    const found = new Set();
    collectAccess(payload.data, found);
    current.allowed = found.size ? [...found] : null;
    await saveSession(current);
  }
  const size = PAGE_SIZE;
  const more = !extracted.object && unit.page < 200 && extracted.total > unit.page * size && items.length === size;
  await rememberMaster(master.id, more ? { status: "partial", page: unit.page + 1, attempts: 0 } : { status: "done", page: unit.page, attempts: 0 });
}

async function runReport(current, unit) {
  const report = unit.report;
  const spec = unit.kind === "sum"
    ? { method: report.sumMethod || report.method, path: report.sumPath, access: report.access }
    : { method: report.method, path: report.path, access: report.access };
  const body = reportBody(report, unit.dim, unit.scope, unit.page || 1);
  let payload;
  try {
    payload = await callUpstream(current, { ...spec, body, query: spec.method === "get" ? body : {} });
  } catch (error) {
    await writeSheet({
      reportId: report.id,
      dim: unit.dim,
      startOn: unit.scope.start,
      endOn: unit.scope.end,
      pageNo: unit.page,
      status: "failed",
      kind: unit.kind,
      attempts: unit.attempts + 1,
      errorText: failText(report, unit.scope, error.message || error),
      payload: {}
    });
    return;
  }
  if (authExpired(payload) && !(await sessionAlive(current))) {
    await dropLogin(current);
    return;
  }
  if (denied(payload)) {
    await writeSheet({
      reportId: report.id,
      dim: unit.dim,
      startOn: unit.scope.start,
      endOn: unit.scope.end,
      pageNo: unit.page || 1,
      status: "denied",
      kind: unit.kind,
      attempts: 1,
      errorText: String(payload.content || "没有权限"),
      payload: {}
    });
    return;
  }
  if (!payload || payload.code !== 0) {
    await writeSheet({
      reportId: report.id,
      dim: unit.dim,
      startOn: unit.scope.start,
      endOn: unit.scope.end,
      pageNo: unit.page,
      status: "failed",
      kind: unit.kind,
      attempts: unit.attempts + 1,
      errorText: failText(report, unit.scope, (payload && payload.content) || "接口失败"),
      payload: {}
    });
    return;
  }
  if (unit.kind === "object" || unit.kind === "sum") {
    await writeSheet({
      reportId: report.id,
      dim: unit.dim,
      startOn: unit.scope.start,
      endOn: unit.scope.end,
      pageNo: unit.kind === "sum" ? 0 : 1,
      status: "done",
      kind: unit.kind === "sum" ? "sum" : "object",
      totalRows: 1,
      pageSize: 1,
      attempts: 0,
      rowCount: 1,
      payload: { raw: payload.data }
    });
    return;
  }
  const extracted = extractList(payload.data);
  if (extracted.object) {
    await writeSheet({
      reportId: report.id,
      dim: unit.dim,
      startOn: unit.scope.start,
      endOn: unit.scope.end,
      pageNo: unit.page || 1,
      status: "done",
      kind: "object",
      totalRows: 1,
      pageSize: 1,
      attempts: 0,
      rowCount: 1,
      payload: { raw: extracted.raw, rows: extracted.raw ? [extracted.raw] : [] }
    });
    return;
  }
  const unique = dedupeRaw(extracted.rows);
  const wholeList = unique.length !== PAGE_SIZE;
  let note = "";
  if (unit.emptyRetry && unique.length === 0) {
    note = "empty-ok2";
  } else if (unit.thinRetry && unique.length < 20) {
    note = "thin-ok";
  }
  await writeSheet({
    reportId: report.id,
    dim: unit.dim,
    startOn: unit.scope.start,
    endOn: unit.scope.end,
    pageNo: unit.page,
    status: "done",
    kind: "list",
    totalRows: wholeList ? unique.length : extracted.total,
    pageSize: PAGE_SIZE,
    attempts: 0,
    rowCount: unique.length,
    errorText: note,
    payload: { rows: unique, total: wholeList ? unique.length : extracted.total }
  });
}

export async function tick() {
  const collection = collectionStatus();
  if (!collection.batchEnabled) {
    return { ok: true, skipped: true, reason: "batch_disabled", collection };
  }
  if (busy) {
    return { ok: true, skipped: true };
  }
  busy = true;
  try {
    const current = await session();
    if (current.phase === "waiting_scan") {
      return pollLink();
    }
    if (current.phase !== "collecting" && current.phase !== "logged_in") {
      return { ok: true, idle: true, phase: current.phase };
    }
    const unit = await nextUnit(current);
    if (!unit) {
      current.phase = "logged_in";
      current.message = `已补到 ${shanghaiToday()} 之前能确定的范围。之后按天增量。`;
      await saveSession(current);
      return { ok: true, idle: true, phase: current.phase };
    }
    current.phase = "collecting";
    current.cursor = unit.type === "master"
      ? { id: unit.master.id, label: unit.master.label, page: "基础资料", dim: "all", start: "2026-09-01", end: shanghaiToday(), pageNo: unit.page || 1 }
      : { id: unit.report.id, label: unit.report.label, page: unit.report.pageLabel || "", dim: unit.dim || "all", start: unit.scope.start, end: unit.scope.end, pageNo: unit.page || 1 };
    await saveSession(current);
    if (unit.type === "master") {
      await runMaster(current, unit);
    } else {
      await runReport(current, unit);
    }
    return { ok: true, phase: (await session()).phase, unit: unit.type === "master" ? unit.master.id : unit.report.id };
  } finally {
    busy = false;
  }
}
