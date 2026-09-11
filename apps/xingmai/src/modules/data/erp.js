const DEFAULT_BASE = "http://120.24.116.22:9080";
const DEFAULT_USERNAME = "罗成";
const DEFAULT_PASSWORD = "xingmai110";
const REFRESH_SKEW_MS = 5 * 60 * 1000;
const SHOP_ID_TTL_MS = 5 * 60 * 1000;

let testFetch = null;
let shopIdCache = { at: 0, ids: [] };
let session = { token: "", expiresAt: 0 };
let loginInFlight = null;
let skipForcedToken = false;

export function setErpFetchForTests(fn) {
  testFetch = fn;
}

export function resetErpCacheForTests() {
  shopIdCache = { at: 0, ids: [] };
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

function publicGoods(row) {
  if (!row || typeof row !== "object") {
    return null;
  }
  return {
    shopId: String(row.shopId ?? ""),
    productId: String(row.productId ?? ""),
    productName: row.productName || "",
    growthStage: row.growthStage || "",
    orderCount: row.orderCount ?? 0,
    skuNum: row.skuNum ?? 0,
    payAmount: row.payAmount ?? 0,
    netSalesAmount: row.netSalesAmount ?? 0,
    profit: row.profit ?? 0,
    promotionCost: row.promotionCost ?? 0,
    refundRate: row.refundRate ?? 0
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

export async function listErpShopIds() {
  const now = Date.now();
  if (shopIdCache.ids.length && now - shopIdCache.at < SHOP_ID_TTL_MS) {
    return shopIdCache.ids;
  }
  const ids = [];
  let pageNum = 1;
  let totalPages = 1;
  do {
    const data = await erpPost("/product/jd/shopInfo/page", { pageNum, pageSize: 50 });
    for (const row of data?.records || []) {
      const id = Number(row.id);
      if (Number.isFinite(id)) {
        ids.push(id);
      }
    }
    totalPages = Number(data?.totalPages || 1);
    pageNum += 1;
  } while (pageNum <= totalPages && pageNum <= 20);
  shopIdCache = { at: now, ids };
  return ids;
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

export async function listErpGoods(input = {}) {
  let shopIds = parseShopIds(input);
  if (!shopIds.length) {
    shopIds = await listErpShopIds();
  }
  if (!shopIds.length) {
    throw asError("星脉 ERP 没有可查询的店铺", 502);
  }
  const range = defaultPayRange();
  const data = await erpPost("/product/jd/order/product/page", {
    pageNum: toInt(input.pageNum, 1),
    pageSize: Math.min(toInt(input.pageSize, 20), 50),
    shopIds,
    orderBy: String(input.orderBy || "payAmount"),
    asc: input.asc === true || input.asc === "true",
    payTimeStart: String(input.payTimeStart || range.payTimeStart),
    payTimeEnd: String(input.payTimeEnd || range.payTimeEnd)
  });
  return pageResult(data, publicGoods);
}
