const DEFAULT_BASE = "http://120.24.116.22:9080";
const DEFAULT_USERNAME = "罗成";
const DEFAULT_PASSWORD = "xingmai110";
const REFRESH_SKEW_MS = 5 * 60 * 1000;
const SHOP_ID_TTL_MS = 5 * 60 * 1000;

let testFetch = null;
let shopMetaCache = { at: 0, ids: [], names: {} };
let session = { token: "", expiresAt: 0 };
let loginInFlight = null;
let skipForcedToken = false;

export function setErpFetchForTests(fn) {
  testFetch = fn;
}

export function resetErpCacheForTests() {
  shopMetaCache = { at: 0, ids: [], names: {} };
  session = { token: "", expiresAt: 0 };
  loginInFlight = null;
  skipForcedToken = false;
}

export function erpConfig() {
  const loginOff = String(process.env.XM_ERP_LOGIN || "") === "0";
  return {
    base: String(process.env.XM_ERP_BASE || DEFAULT_BASE).replace(/\/+$/, ""),
    token: String(process.env.XM_ERP_TOKEN || "").trim(),
    username: loginOff ? "" : String(process.env.XM_ERP_USERNAME || DEFAULT_USERNAME).trim(),
    password: loginOff ? "" : String(process.env.XM_ERP_PASSWORD || DEFAULT_PASSWORD)
  };
}

function asError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function requestFetch() {
  return testFetch || fetch;
}

function tokenExpiresAt(token, expireTime) {
  if (expireTime) {
    const raw = String(expireTime).trim();
    const shanghai = Date.parse(raw.includes("T") ? raw : raw.replace(" ", "T") + "+08:00");
    const generic = Date.parse(raw);
    const ms = Number.isFinite(shanghai) ? shanghai : generic;
    if (Number.isFinite(ms)) {
      return ms;
    }
  }
  const parts = String(token || "").split(".");
  if (parts.length >= 2) {
    try {
      const json = Buffer.from(parts[1], "base64url").toString("utf8");
      const payload = JSON.parse(json);
      if (payload.exp) {
        return Number(payload.exp) * 1000;
      }
    } catch {
      /* ignore malformed jwt */
    }
  }
  return Date.now() + 11 * 60 * 60 * 1000;
}

function sessionFresh(now = Date.now()) {
  return Boolean(session.token) && now < session.expiresAt - REFRESH_SKEW_MS;
}

function rememberToken(token, expireTime) {
  session = {
    token: String(token || "").trim(),
    expiresAt: tokenExpiresAt(token, expireTime)
  };
  return session.token;
}

async function loginErp() {
  const { base, username, password } = erpConfig();
  if (!username || !password) {
    throw asError("未配置星脉 ERP 账号（XM_ERP_USERNAME / XM_ERP_PASSWORD）", 503);
  }
  let res;
  try {
    res = await requestFetch()(`${base}/system/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({ username, password })
    });
  } catch (err) {
    throw asError(`星脉 ERP 登录连不上：${err.message}`, 502);
  }
  let payload;
  try {
    payload = await res.json();
  } catch {
    throw asError(`星脉 ERP 登录返回无法解析（HTTP ${res.status}）`, 502);
  }
  const code = Number(payload?.code);
  const token = payload?.data?.token;
  if ((code !== 200 && code !== 0) || !token) {
    throw asError(payload?.message || "星脉 ERP 登录失败", 502);
  }
  skipForcedToken = false;
  return rememberToken(token, payload?.data?.expireTime);
}

export async function getErpToken(options = {}) {
  const force = Boolean(options.force);
  if (!force && sessionFresh()) {
    return session.token;
  }
  const { token } = erpConfig();
  if (!force && token && !skipForcedToken) {
    rememberToken(token);
    if (sessionFresh()) {
      return session.token;
    }
  }
  if (loginInFlight) {
    return loginInFlight;
  }
  loginInFlight = loginErp().finally(() => {
    loginInFlight = null;
  });
  return loginInFlight;
}

function isUnauthorized(res, payload) {
  if (res.status === 401) {
    return true;
  }
  const code = Number(payload?.code);
  if (code === 401) {
    return true;
  }
  const message = String(payload?.message || "");
  return /未登录|token|过期|失效|unauthorized/i.test(message);
}

async function readJson(res) {
  try {
    return await res.json();
  } catch {
    throw asError(`星脉 ERP 返回了无法解析的内容（HTTP ${res.status}）`, 502);
  }
}

export async function erpPost(path, body, options = {}) {
  const retried = Boolean(options.retried);
  const token = await getErpToken({ force: retried });
  if (!token) {
    throw asError("未配置星脉 ERP token（环境变量 XM_ERP_TOKEN）", 503);
  }
  const { base } = erpConfig();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  let res;
  try {
    res = await requestFetch()(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(body || {})
    });
  } catch (err) {
    throw asError(`星脉 ERP 连不上：${err.message}`, 502);
  }
  const payload = await readJson(res);
  if (isUnauthorized(res, payload) && !retried) {
    session = { token: "", expiresAt: 0 };
    skipForcedToken = true;
    return erpPost(path, body, { retried: true });
  }
  const code = Number(payload?.code);
  if (code !== 200 && code !== 0) {
    throw asError(payload?.message || `星脉 ERP 失败（${code || res.status}）`, res.status === 401 ? 401 : 502);
  }
  return payload.data;
}

function toInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : fallback;
}

function publicShop(row) {
  if (!row || typeof row !== "object") {
    return null;
  }
  return {
    id: String(row.id ?? ""),
    shopName: row.shopName || "",
    type: row.type,
    typeLabel: Number(row.type) === 1 ? "自营" : "POP",
    status: row.status,
    statusLabel: Number(row.status) === 1 ? "营业" : "停用",
    introduction: row.introduction || "",
    mainFirstCategoryName: row.mainFirstCategoryName || "",
    mainSecondCategoryName: row.mainSecondCategoryName || "",
    openTime: row.openTime || "",
    operatorId: row.operatorId ?? null,
    assistantId: row.assistantId ?? null,
    selectorId: row.selectorId ?? null
  };
}

function publicGoods(row, names = {}) {
  if (!row || typeof row !== "object") {
    return null;
  }
  const shopId = String(row.shopId ?? "");
  const info = names[shopId] || {};
  return {
    shopId,
    shopName: row.shopName || info.shopName || "",
    productId: String(row.productId ?? ""),
    productName: row.productName || "",
    growthStage: row.growthStage || "",
    orderCount: row.orderCount ?? null,
    skuNum: row.skuNum ?? null,
    payAmount: row.payAmount ?? null,
    netSalesAmount: row.netSalesAmount ?? null,
    profit: row.profit ?? null,
    promotionCost: row.promotionCost ?? null,
    refundRate: row.refundRate ?? null
  };
}

function publicShopStat(row, names = {}) {
  if (!row || typeof row !== "object") {
    return null;
  }
  const shopId = String(row.shopId ?? row.id ?? "");
  const info = names[shopId] || {};
  return {
    shopId,
    shopName: row.shopName || info.shopName || "",
    typeLabel: info.typeLabel || "",
    statusLabel: info.statusLabel || "",
    payAmount: row.payAmount ?? null,
    todayPayAmount: row.todayPayAmount ?? null,
    yesterdayPayAmount: row.yesterdayPayAmount ?? null,
    orderCount: row.orderCount ?? null,
    netOrderCount: row.netOrderCount ?? null,
    profit: row.profit ?? null,
    profitRate: row.profitRate ?? null,
    refundAmount: row.refundAmount ?? null,
    refundRate: row.refundRate ?? null,
    totalPromotionCost: row.totalPromotionCost ?? null,
    promotionRate: row.promotionRate ?? null
  };
}

function publicTrend(row) {
  if (!row || typeof row !== "object") {
    return null;
  }
  return {
    date: row.date || "",
    payAmount: row.payAmount ?? null,
    orderCount: row.orderCount ?? null,
    profit: row.profit ?? null,
    refundAmount: row.refundAmount ?? null,
    promotionCost: row.promotionCost ?? null
  };
}

function hasValue(value) {
  return value !== null && value !== undefined && value !== "";
}

function card(key, label, value, unit) {
  if (!hasValue(value)) {
    return null;
  }
  const n = Number(value);
  return {
    key,
    label,
    value: Number.isFinite(n) ? n : value,
    unit
  };
}

function pageResult(data, mapRow) {
  const records = Array.isArray(data?.records) ? data.records.map(mapRow).filter(Boolean) : [];
  return {
    ok: true,
    source: "xingmai-erp",
    total: Number(data?.total || 0),
    totalPages: Number(data?.totalPages || 0),
    currentPage: Number(data?.currentPage || 1),
    pageSize: Number(data?.pageSize || records.length),
    records
  };
}

export async function listErpShops(input = {}) {
  const data = await erpPost("/product/jd/shopInfo/page", {
    pageNum: toInt(input.pageNum, 1),
    pageSize: Math.min(toInt(input.pageSize, 20), 50),
    shopName: String(input.shopName || "").trim() || undefined,
    shopId: input.shopId ? Number(input.shopId) : undefined
  });
  return pageResult(data, publicShop);
}

export async function listErpShopOptions() {
  const meta = await listErpShopMeta();
  const records = Object.values(meta.names);
  return {
    ok: true,
    source: "xingmai-erp",
    total: records.length,
    totalPages: 1,
    currentPage: 1,
    pageSize: records.length,
    records
  };
}

export async function listErpShopMeta() {
  const now = Date.now();
  if (shopMetaCache.ids.length && now - shopMetaCache.at < SHOP_ID_TTL_MS) {
    return shopMetaCache;
  }
  const ids = [];
  const names = {};
  let pageNum = 1;
  let totalPages = 1;
  do {
    const data = await erpPost("/product/jd/shopInfo/page", { pageNum, pageSize: 50 });
    for (const row of data?.records || []) {
      const mapped = publicShop(row);
      if (!mapped?.id) {
        continue;
      }
      const id = Number(mapped.id);
      if (Number.isFinite(id)) {
        ids.push(id);
      }
      names[mapped.id] = mapped;
    }
    totalPages = Number(data?.totalPages || 1);
    pageNum += 1;
  } while (pageNum <= totalPages && pageNum <= 20);
  shopMetaCache = { at: now, ids, names };
  return shopMetaCache;
}

export async function listErpShopIds() {
  const meta = await listErpShopMeta();
  return meta.ids;
}

function defaultPayRange() {
  const end = new Date();
  const start = new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000);
  const fmt = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  return {
    payTimeStart: `${fmt(start)} 00:00:00`,
    payTimeEnd: `${fmt(end)} 23:59:59`
  };
}

function parseShopIds(input) {
  if (Array.isArray(input.shopIds)) {
    return input.shopIds.map(Number).filter((id) => Number.isFinite(id));
  }
  if (input.shopId) {
    const id = Number(input.shopId);
    return Number.isFinite(id) ? [id] : [];
  }
  if (typeof input.shopIds === "string" && input.shopIds.trim()) {
    return input.shopIds
      .split(",")
      .map((item) => Number(item.trim()))
      .filter((id) => Number.isFinite(id));
  }
  return [];
}

function payRange(input = {}) {
  const range = defaultPayRange();
  return {
    payTimeStart: String(input.payTimeStart || range.payTimeStart),
    payTimeEnd: String(input.payTimeEnd || range.payTimeEnd)
  };
}

async function resolveShopIds(input = {}) {
  const shopIds = parseShopIds(input);
  if (shopIds.length) {
    return shopIds;
  }
  const ids = await listErpShopIds();
  if (!ids.length) {
    throw asError("星脉 ERP 没有可查询的店铺", 502);
  }
  return ids;
}

export async function listErpGoods(input = {}) {
  const shopIds = await resolveShopIds(input);
  const range = payRange(input);
  const meta = await listErpShopMeta();
  const data = await erpPost("/product/jd/order/product/page", {
    pageNum: toInt(input.pageNum, 1),
    pageSize: Math.min(toInt(input.pageSize, 20), 50),
    shopIds,
    orderBy: String(input.orderBy || "payAmount"),
    asc: input.asc === true || input.asc === "true",
    ...range
  });
  return pageResult(data, (row) => publicGoods(row, meta.names));
}

export async function listErpShopStats(input = {}) {
  const range = payRange(input);
  const meta = await listErpShopMeta();
  const data = await erpPost("/product/jd/order/shop/page", {
    pageNum: toInt(input.pageNum, 1),
    pageSize: Math.min(toInt(input.pageSize, 20), 50),
    shopIds: parseShopIds(input),
    shopName: String(input.shopName || "").trim() || undefined,
    orderBy: String(input.orderBy || "payAmount"),
    asc: input.asc === true || input.asc === "true",
    filters: [],
    ...range
  });
  const result = pageResult(data, (row) => publicShopStat(row, meta.names));
  const summary = data?.summary ? publicShopStat(data.summary, meta.names) : null;
  return { ...result, summary };
}

export async function listErpHotGoods(input = {}) {
  const shopIds = await resolveShopIds(input);
  const range = payRange(input);
  const meta = await listErpShopMeta();
  const data = await erpPost("/product/jd/order/product/trend", {
    pageNum: 1,
    pageSize: Math.min(toInt(input.pageSize, 8), 20),
    shopIds,
    orderBy: "payAmount",
    asc: false,
    ...range
  });
  const rows = Array.isArray(data) ? data : data?.records || [];
  return rows.map((row) => publicGoods(row, meta.names)).filter(Boolean);
}

export async function listErpSalesTrend(input = {}) {
  const range = payRange(input);
  const data = await erpPost("/product/board/salesTrend", {
    startDate: range.payTimeStart,
    endDate: range.payTimeEnd
  });
  const rows = Array.isArray(data) ? data : [];
  return rows.map(publicTrend).filter(Boolean);
}

export async function getErpOverview(input = {}) {
  const range = payRange(input);
  const [trend, shops, goods] = await Promise.all([
    listErpSalesTrend(range),
    listErpShopStats({ ...range, pageNum: 1, pageSize: 8 }),
    listErpHotGoods({ ...range, pageSize: 8 })
  ]);
  const summary = shops.summary || {};
  const cards = [
    card("payAmount", "应收金额", summary.payAmount, "元"),
    card("orderCount", "订单数", summary.orderCount, "单"),
    card("profit", "利润", summary.profit, "元"),
    card("refundAmount", "退款金额", summary.refundAmount, "元")
  ].filter(Boolean);
  return {
    ok: true,
    source: "xingmai-erp",
    range,
    cards,
    trend,
    shops: shops.records,
    goods,
    shopTotal: shops.total
  };
}
