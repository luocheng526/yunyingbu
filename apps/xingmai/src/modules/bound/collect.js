import { randomBytes } from "node:crypto";
import { API_ORIGIN, MASTERS, ORIGIN, PAGE_SIZE, accessCodes, reports } from "./catalog.js";
import { listSheetHeads, readState, replaceMasters, writeMaster, writeSheet, writeState } from "./persist.js";
import { collectScopes, shanghaiToday } from "./time.js";

const KNOWN_ACCESS = new Set(accessCodes());
let fetchImpl = globalThis.fetch;
let timer = null;
let busy = false;

export function setBoundFetch(next) {
  fetchImpl = next || globalThis.fetch;
}

export function stopCollectLoop() {
  if (timer) {
    clearInterval(timer);
  }
  timer = null;
  busy = false;
}

export function ensureCollectLoop() {
  if (timer || process.env.BOUND_COLLECT_LOOP === "0") {
    return;
  }
  // 最近缺的日期优先，每次连续 3 条。旧的失败重试排在后面。
  timer = setInterval(() => {
    tick().catch(() => {});
  }, 1000);
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
    Referer: `${ORIGIN}/login`,
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
  const response = await fetchImpl(url, { method: spec.method === "get" ? "GET" : "POST", headers, body });
  absorbCookies(current, response);
  const type = response.headers.get("content-type") || "";
  if (!type.includes("json")) {
    const buffer = Buffer.from(await response.arrayBuffer());
    return { binary: true, type, buffer, status: response.status };
  }
  return response.json();
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
  return {
    ok: true,
    module: "bound",
    source: "crawler",
    erp: false,
    phase: current.phase,
    provider: current.provider,
    deviceId: current.deviceId,
    message: qrClient === "old"
      ? "二维码还在闪。请点浏览器左上角的刷新按钮，重新打开这一页。刷新后请用微信扫这一张，它会停住。"
      : current.message,
    qrToken: current.scene || "",
    userName: current.userName,
    accounts: current.accounts || [],
    qrReady: Boolean(current.qrUrl),
    cursor: current.cursor || null
  };
}

export async function startLink(provider) {
  const current = await session();
  current.provider = ["FEISHU", "DINGTALK", "QYWX", "WECHAT"].includes(provider) ? provider : "WECHAT";
  current.phase = "waiting_scan";
  current.message = "正在向旧站官方登录接口取二维码";
  current.accounts = [];
  current.loginTicket = "";
  const payload = await callUpstream(current, {
    method: "get",
    path: "/auth/qrcode",
    query: { deviceId: current.deviceId, domain: "hejun.ecbis.cn", ...providerQuery(current.provider) }
  });
  if (!payload || payload.code !== 0 || !payload.data) {
    current.phase = "needs_scan";
    current.message = (payload && payload.content) || "官方登录二维码没有生成";
    await saveSession(current);
    return linkStatus();
  }
  current.scene = payload.data.scene || "";
  current.qrUrl = payload.data.url || "";
  current.qrIssuedAt = new Date().toISOString();
  current.qrCheckedAt = "";
  current.message = "请用微信扫这一张二维码。这一张会保持约一分半，扫旧站网页上的码不会登录这里。";
  await saveSession(current);
  return linkStatus();
}

let qrCache = { url: "", type: "", buffer: null };
let qrClient = "";

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

async function finishLogin(current, data) {
  current.userName = String((data && (data.nickName || data.userName || data.name)) || current.userName || "");
  current.phase = "collecting";
  current.message = "已登录。从 2026-09-01 按北京时间补采，页面查询不会再打旧站。";
  current.accounts = [];
  await saveSession(current);
}

const QR_HOLD_MS = 90 * 1000;

function issuedAge(current) {
  const issued = Date.parse(current.qrIssuedAt || "");
  return Number.isFinite(issued) ? Date.now() - issued : 0;
}

async function saveUnlessLoggedIn(current) {
  const latest = await session();
  if (latest.phase === "collecting" || latest.phase === "choose_account") {
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
  const payload = await callUpstream(current, {
    method: "get",
    path: "/auth/checkQrcode",
    query: {
      scene: current.scene,
      domain: "hejun.ecbis.cn",
      deviceId: current.deviceId,
      ...providerQuery(current.provider)
    }
  });
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
    current.phase = "waiting_scan";
    current.message = "未扫码。请用微信扫这一张，扫完后在手机上点确认登录。扫旧站网页上的码不会登录这里。";
  } else if (code === 1000104 || code === 1000105 || code === 1000106) {
    current.phase = "waiting_scan";
    current.message = content || "已经扫到了。请在手机上点确认登录。";
  } else if (code === 1000103 || (shaky && issuedAge(current) >= QR_HOLD_MS)) {
    current.scene = "";
    current.qrUrl = "";
    current.message = "刚才那张二维码已经失效，正在换一张。";
    await saveSession(current);
    return startLink(current.provider);
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

let pollQueue = Promise.resolve();

export function pollLink() {
  const run = pollQueue.then(pollLinkOnce, pollLinkOnce);
  pollQueue = run.then(() => {}, () => {});
  return run;
}

export async function pickAccount(companyId) {
  const current = await session();
  const account = (current.accounts || []).find((item) => String(item.companyId) === String(companyId)) || current.accounts[0];
  if (!account || !current.loginTicket) {
    return { ...(await linkStatus()), ok: false, error: "没有可选择的企业账号" };
  }
  const payload = await callUpstream(current, {
    method: "json",
    path: "/auth/ticket/login",
    body: {
      loginTicket: current.loginTicket,
      companyId: account.companyId,
      deviceId: current.deviceId,
      agreementStatus: true
    }
  });
  if (!payload || payload.code !== 0) {
    current.message = (payload && payload.content) || "企业账号登录失败";
    await saveSession(current);
    return { ...(await linkStatus()), ok: false };
  }
  await finishLogin(current, payload.data || account);
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

function datedQuery(scope, extra = {}) {
  return {
    startDate: scope.start,
    endDate: scope.end,
    daysType: scope.daysType,
    queryType: 1,
    platform: "all",
    shopId: "",
    ...extra
  };
}

export function reportBody(report, dim, scope, page) {
  if (report.id === "qdzl_yj") {
    return { ...compareYears(scope), compareType: 0, lstChannel: null };
  }
  if (report.id === "qdfx_yj") {
    const years = compareYears(scope);
    return { ...years, compareType: 0, lstChannel: null, queryType: 1, platform: "all", shopId: "" };
  }
  if (report.id === "qdzl_rx" || report.id === "qdfx_rx") {
    const body = datedQuery(scope, { pageNum: Math.max(page, 1), pageSize: PAGE_SIZE });
    if (dim === "spu") {
      body.isSpu = true;
    }
    return body;
  }
  if (report.id === "qdfx_jy") {
    return datedQuery(scope);
  }
  return {
    startDate: scope.start,
    endDate: scope.end,
    daysType: scope.daysType,
    queryType: 1,
    pageNum: Math.max(page, 1),
    pageSize: PAGE_SIZE,
    shopList: [],
    shopId: "",
    filterCondition: [],
    isSpu: dim === "spu",
    isCategory: /cate|品类/.test(report.id),
    platform: ""
  };
}

function sheetHole(report, dim, scope, sheets, indexedPages = null) {
  const pages = indexedPages || sheets.filter(
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

function sheetIndex(sheets) {
  const index = new Map();
  sheets.forEach((row) => {
    const key = `${row.reportId}|${row.dim}|${row.startOn}|${row.endOn}`;
    const pages = index.get(key);
    if (pages) {
      pages.push(row);
    } else {
      index.set(key, [row]);
    }
  });
  return index;
}

function freshScopes(scopes) {
  const days = [];
  const months = [];
  scopes.forEach((scope) => {
    if (scope.start === scope.end) {
      days.push(scope);
    } else {
      months.push(scope);
    }
  });
  days.reverse();
  months.reverse();
  return days.concat(months);
}

async function nextUnit(current) {
  const masters = await masterState();
  for (const master of MASTERS) {
    const state = masters[master.id] || { status: "missing", page: 1, attempts: 0 };
    if (state.status === "done" || state.status === "failed") {
      continue;
    }
    return { type: "master", master, page: state.page || 1, attempts: state.attempts || 0 };
  }
  const allowed = Array.isArray(current.allowed) ? new Set(current.allowed) : null;
  const sheets = await listSheetHeads();
  const indexed = sheetIndex(sheets);
  const scopes = collectScopes(shanghaiToday());
  const passes = [
    { causes: new Set(["new", "page"]), list: freshScopes(scopes) },
    { causes: new Set(["empty"]), list: freshScopes(scopes) },
    { causes: new Set(["retry"]), list: scopes }
  ];
  for (const pass of passes) {
    for (const scope of pass.list) {
      for (const report of reports()) {
        if (allowed && report.access && !allowed.has(report.access)) {
          continue;
        }
        for (const dim of report.dims || ["all"]) {
          const pages = indexed.get(`${report.id}|${dim}|${scope.start}|${scope.end}`) || [];
          const hole = sheetHole(report, dim, scope, sheets, pages);
          if (hole && pass.causes.has(hole.cause)) {
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
  if (authExpired(payload)) {
    current.phase = "needs_scan";
    current.message = "旧站登录已过期。已保留补采进度，扫码后从中断处继续。";
    await saveSession(current);
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
  if (authExpired(payload)) {
    current.phase = "needs_scan";
    current.message = "旧站登录已过期。已保留补采进度，扫码后从中断处继续。";
    await saveSession(current);
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

function cursorOf(unit) {
  if (unit.type === "master") {
    return { id: unit.master.id, label: unit.master.label, page: "基础资料", dim: "all", start: "2026-09-01", end: shanghaiToday(), pageNo: unit.page || 1 };
  }
  return {
    id: unit.report.id,
    label: unit.report.label,
    page: unit.report.pageLabel || "",
    dim: unit.dim || "all",
    start: unit.scope.start,
    end: unit.scope.end,
    pageNo: unit.page || 1
  };
}

async function runUnit(current, unit) {
  current.phase = "collecting";
  current.cursor = cursorOf(unit);
  await saveSession(current);
  if (unit.type === "master") {
    await runMaster(current, unit);
  } else {
    await runReport(current, unit);
  }
}

export async function tick() {
  if (busy) {
    return { ok: true, skipped: true };
  }
  busy = true;
  try {
    let current = await session();
    if (current.phase === "waiting_scan") {
      return pollLink();
    }
    if (current.phase !== "collecting" && current.phase !== "logged_in") {
      return { ok: true, idle: true, phase: current.phase };
    }
    let last = null;
    for (let step = 0; step < 3; step += 1) {
      if (step > 0) {
        current = await session();
        if (current.phase !== "collecting" && current.phase !== "logged_in") {
          break;
        }
      }
      const unit = await nextUnit(current);
      if (!unit) {
        if (!last) {
          current.phase = "logged_in";
          current.message = `已补到 ${shanghaiToday()} 之前能确定的范围。之后按天增量。`;
          await saveSession(current);
          return { ok: true, idle: true, phase: current.phase };
        }
        break;
      }
      await runUnit(current, unit);
      last = unit;
    }
    const phase = (await session()).phase;
    return { ok: true, phase, unit: last.type === "master" ? last.master.id : last.report.id };
  } finally {
    busy = false;
  }
}
