import { erpPost, listErpShopMeta } from "../data/erp.js";

export const STORE_PAGES = [
  { id: "reviews", title: "评价管理", path: "/stores/reviews" },
  { id: "violations", title: "违规管理", path: "/stores/violations" },
  { id: "shipping", title: "发货监控", path: "/stores/shipping" },
  { id: "inventory", title: "京东库存监控", path: "/stores/inventory" }
];

export const ORDER_STATUS = {
  3: "待发货",
  4: "异常",
  6: "已发货",
  8: "已完成",
  9: "已取消",
  10: "已锁定"
};

export const PRODUCT_STATUS = {
  0: "删除",
  103: "系统下架",
  104: "下架",
  105: "在售"
};

const LOW_STOCK = 20;
const USER_TTL_MS = 5 * 60 * 1000;
const UNASSIGNED_DUTY = "unassigned";

let userNameCache = { at: 0, names: {} };

function toInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : fallback;
}

function shopIdsOf(input = {}) {
  if (Array.isArray(input.shopIds)) {
    return input.shopIds.map(Number).filter((id) => Number.isFinite(id));
  }
  if (typeof input.shopIds === "string" && input.shopIds.trim()) {
    return input.shopIds
      .split(",")
      .map((item) => Number(item.trim()))
      .filter((id) => Number.isFinite(id));
  }
  if (input.shopId) {
    const id = Number(input.shopId);
    return Number.isFinite(id) ? [id] : [];
  }
  return [];
}

function dutyKeyOf(shop) {
  return shop?.operatorId == null || shop.operatorId === "" ? UNASSIGNED_DUTY : String(shop.operatorId);
}

async function listErpUserNames() {
  const now = Date.now();
  if (userNameCache.names && now - userNameCache.at < USER_TTL_MS) {
    return userNameCache.names;
  }
  try {
    const data = await erpPost("/system/user/list", {});
    const rows = Array.isArray(data) ? data : data?.records || [];
    const names = {};
    for (const row of rows) {
      if (!row || row.id == null || !row.username) {
        continue;
      }
      names[String(row.id)] = String(row.username);
    }
    userNameCache = { at: now, names };
  } catch {
    userNameCache = { at: now, names: userNameCache.names || {} };
  }
  return userNameCache.names;
}

function dutyNameOf(shop, names = {}) {
  const key = dutyKeyOf(shop);
  if (key === UNASSIGNED_DUTY) {
    return "未分配";
  }
  return names[key] || shop.operatorName || `责权${key}`;
}

function publicStoreShop(shop, names = {}) {
  const operatorId = shop?.operatorId == null || shop.operatorId === "" ? "" : String(shop.operatorId);
  return {
    id: shop.id,
    shopName: shop.shopName,
    statusLabel: shop.statusLabel,
    typeLabel: shop.typeLabel,
    operatorId,
    operatorName: dutyNameOf(shop, names)
  };
}

async function resolveShopIds(input = {}) {
  const explicit = shopIdsOf(input);
  if (explicit.length) {
    return { ids: explicit, emptyDuty: false };
  }
  const dutyId = String(input.dutyId || "").trim();
  if (!dutyId) {
    return { ids: [], emptyDuty: false };
  }
  const meta = await listErpShopMeta();
  const ids = Object.values(meta.names)
    .filter((shop) => dutyKeyOf(shop) === dutyId)
    .map((shop) => Number(shop.id))
    .filter((id) => Number.isFinite(id));
  return { ids, emptyDuty: ids.length === 0 };
}

function emptyPage(pageSize = 20) {
  return {
    ok: true,
    source: "xingmai-erp",
    total: 0,
    totalPages: 1,
    currentPage: 1,
    pageSize,
    records: []
  };
}

function statusList(input, key, fallback) {
  const raw = input[key];
  let list = [];
  if (Array.isArray(raw)) {
    list = raw.map(Number).filter((id) => Number.isFinite(id));
  } else if (raw != null && String(raw).trim()) {
    list = String(raw)
      .split(",")
      .map((item) => Number(item.trim()))
      .filter((id) => Number.isFinite(id));
  }
  return list.length ? list : fallback.slice();
}

function pageOf(data) {
  return {
    total: Number(data?.total || 0),
    totalPages: Number(data?.totalPages || 0),
    currentPage: Number(data?.currentPage || 1),
    pageSize: Number(data?.pageSize || 0)
  };
}

function shopName(meta, shopId) {
  const info = meta.names[String(shopId)] || {};
  return info.shopName || "";
}

function publicProduct(row, meta) {
  if (!row || typeof row !== "object") {
    return null;
  }
  const status = Number(row.productStatus);
  const stockNum = Number(row.stockNum);
  const oneStarNum = Number(row.oneStarNum) || 0;
  let stockLabel = "正常";
  if (!Number.isFinite(stockNum)) {
    stockLabel = "未知";
  } else if (stockNum < 0) {
    stockLabel = "库存异常";
  } else if (stockNum <= LOW_STOCK) {
    stockLabel = "低库存";
  }
  return {
    productId: String(row.productId ?? ""),
    productName: row.productName || "",
    shopId: String(row.shopId ?? ""),
    shopName: row.shopName || shopName(meta, row.shopId),
    productStatus: Number.isFinite(status) ? status : null,
    statusLabel: PRODUCT_STATUS[status] || (Number.isFinite(status) ? `状态${status}` : "未知"),
    stockNum: Number.isFinite(stockNum) ? stockNum : null,
    stockLabel,
    oneStarNum,
    salesVolume: row.salesVolume ?? null,
    sevenDaysSalesVolume: row.sevenDaysSalesVolume ?? null,
    jdPrice: row.jdPrice ?? null,
    itemNum: row.itemNum || "",
    onlineTime: row.onlineTime || "",
    offlineTime: row.offlineTime || "",
    syncTime: row.syncTime || ""
  };
}

function publicOrder(row, meta) {
  if (!row || typeof row !== "object") {
    return null;
  }
  const status = Number(row.orderStatus);
  const products = Array.isArray(row.orderProducts) ? row.orderProducts : [];
  return {
    orderId: String(row.orderId ?? ""),
    shopId: String(row.shopId ?? ""),
    shopName: shopName(meta, row.shopId),
    orderStatus: Number.isFinite(status) ? status : null,
    statusLabel: ORDER_STATUS[status] || (Number.isFinite(status) ? `状态${status}` : "未知"),
    actualPrice: row.actualPrice ?? null,
    freightPrice: row.freightPrice ?? null,
    payTime: row.payTime || "",
    buyerRemark: row.buyerRemark || "",
    skuCount: products.reduce((sum, item) => sum + (Number(item?.skuNum) || 0), 0),
    skuName: products.map((item) => item?.skuName).filter(Boolean).join("；")
  };
}

async function productPage(input, extra) {
  const meta = await listErpShopMeta();
  const { ids, emptyDuty } = await resolveShopIds(input);
  if (emptyDuty) {
    return emptyPage(Math.min(toInt(input.pageSize, 20), 50));
  }
  const data = await erpPost("/product/jd/product/page", {
    pageNum: toInt(input.pageNum, 1),
    pageSize: Math.min(toInt(input.pageSize, 20), 50),
    shopIds: ids.length ? ids : undefined,
    shopName: String(input.shopName || input.q || "").trim() || undefined,
    ...extra
  });
  return {
    ok: true,
    source: "xingmai-erp",
    ...pageOf(data),
    records: (data?.records || []).map((row) => publicProduct(row, meta)).filter(Boolean)
  };
}

export function resetStoresDutyCacheForTests() {
  userNameCache = { at: 0, names: {} };
}

export async function listErpStoreShops() {
  const board = await listErpDuties();
  return { ok: true, source: "xingmai-erp", total: board.total, records: board.records };
}

export async function listErpDuties() {
  const meta = await listErpShopMeta();
  const names = await listErpUserNames();
  const records = Object.values(meta.names).map((shop) => publicStoreShop(shop, names));
  const grouped = new Map();
  for (const shop of records) {
    const id = dutyKeyOf(shop);
    if (!grouped.has(id)) {
      grouped.set(id, {
        id,
        name: shop.operatorName || dutyNameOf(shop, names),
        shops: []
      });
    }
    grouped.get(id).shops.push({
      id: shop.id,
      shopName: shop.shopName,
      statusLabel: shop.statusLabel
    });
  }
  const groups = [...grouped.values()].map((group) => {
    group.shops.sort((a, b) => String(a.shopName).localeCompare(String(b.shopName), "zh"));
    return { ...group, shopCount: group.shops.length };
  });
  groups.sort((a, b) => {
    if (a.id === UNASSIGNED_DUTY) {
      return 1;
    }
    if (b.id === UNASSIGNED_DUTY) {
      return -1;
    }
    return b.shopCount - a.shopCount || String(a.name).localeCompare(String(b.name), "zh");
  });
  return {
    ok: true,
    source: "xingmai-erp",
    total: records.length,
    groupCount: groups.length,
    records,
    groups
  };
}

export async function listErpReviews(input = {}) {
  const page = await productPage(input, { orderBy: "salesVolume", asc: false });
  page.records.sort((a, b) => Number(b.oneStarNum || 0) - Number(a.oneStarNum || 0));
  const oneStar = page.records.filter((row) => Number(row.oneStarNum) > 0).length;
  return {
    ...page,
    page: "评价管理",
    summary: {
      total: page.total,
      oneStar,
      listed: page.records.length
    }
  };
}

export async function listErpViolations(input = {}) {
  const statuses = statusList(input, "productStatus", [103, 0]);
  const page = await productPage(input, { productStatus: statuses, orderBy: "syncTime", asc: false });
  const systemOff = page.records.filter((row) => row.productStatus === 103).length;
  const removed = page.records.filter((row) => row.productStatus === 0).length;
  return {
    ...page,
    page: "违规管理",
    summary: {
      total: page.total,
      systemOff,
      removed,
      listed: page.records.length
    }
  };
}

export async function listErpShipping(input = {}) {
  const meta = await listErpShopMeta();
  const { ids, emptyDuty } = await resolveShopIds(input);
  if (emptyDuty) {
    return {
      ...emptyPage(Math.min(toInt(input.pageSize, 20), 50)),
      page: "发货监控",
      summary: { total: 0, waiting: 0, shipped: 0, listed: 0 }
    };
  }
  const statuses = statusList(input, "orderStatus", [3, 6]);
  const data = await erpPost("/product/jd/order/page", {
    pageNum: toInt(input.pageNum, 1),
    pageSize: Math.min(toInt(input.pageSize, 20), 50),
    shopIds: ids.length ? ids : undefined,
    orderStatus: statuses.filter((id) => Number.isFinite(id))
  });
  const records = (data?.records || []).map((row) => publicOrder(row, meta)).filter(Boolean);
  return {
    ok: true,
    source: "xingmai-erp",
    page: "发货监控",
    ...pageOf(data),
    records,
    summary: {
      total: Number(data?.total || 0),
      waiting: records.filter((row) => row.orderStatus === 3).length,
      shipped: records.filter((row) => row.orderStatus === 6).length,
      listed: records.length
    }
  };
}

export async function listErpInventory(input = {}) {
  const page = await productPage(input, { orderBy: "stockNum", asc: true });
  const abnormal = page.records.filter((row) => row.stockLabel === "库存异常").length;
  const low = page.records.filter((row) => row.stockLabel === "低库存").length;
  return {
    ...page,
    page: "京东库存监控",
    summary: {
      total: page.total,
      abnormal,
      low,
      listed: page.records.length
    }
  };
}
