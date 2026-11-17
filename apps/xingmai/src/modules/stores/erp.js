import { erpPost, listErpShopMeta } from "../data/erp.js";
import { callJd, parseSkuSearch, readJdWarehouseStock, readPartitionLines, resetJdStockForTests } from "./jd-stock.js";

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
const AUTH_TTL_MS = 5 * 60 * 1000;
const UNASSIGNED_DUTY = "unassigned";

let userNameCache = { at: 0, names: {} };
let shopAuthCache = { at: 0, map: {} };

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
  shopAuthCache = { at: 0, map: {} };
  resetJdStockForTests();
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

async function loadShopAuthMap() {
  const now = Date.now();
  if (Object.keys(shopAuthCache.map).length && now - shopAuthCache.at < AUTH_TTL_MS) {
    return shopAuthCache.map;
  }
  const map = {};
  let pageNum = 1;
  let totalPages = 1;
  do {
    const data = await erpPost("/product/jd/shopInfo/page", { pageNum, pageSize: 50 });
    for (const row of data?.records || []) {
      const auth = row?.authInfo;
      if (!row?.id || !auth?.appKey || !auth?.appSecret || !auth?.accessToken) {
        continue;
      }
      map[String(row.id)] = {
        appKey: auth.appKey,
        appSecret: auth.appSecret,
        accessToken: auth.accessToken
      };
    }
    totalPages = Number(data?.totalPages || 1);
    pageNum += 1;
  } while (pageNum <= totalPages && pageNum <= 20);
  shopAuthCache = { at: now, map };
  return map;
}

async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      out[index] = await fn(items[index], index);
    }
  }
  const size = Math.min(Math.max(limit, 1), items.length || 1);
  await Promise.all(Array.from({ length: items.length ? size : 0 }, () => worker()));
  return out;
}

const SHOPS_PER_PAGE = 4;
const EXPRESS_PER_SHOP = 6;
const STOCK_CHECK_CAP = 16;
const SKU_SEARCH_FIELD = "skuId,wareId,skuName,stockNum,features";

async function searchJdSkuPage(auth, pageNo) {
  const payload = await callJd(auth, "jingdong.sku.read.searchSkuList", {
    pageNo,
    pageSize: 20,
    field: SKU_SEARCH_FIELD
  });
  return parseSkuSearch(payload);
}

async function expressSkusAtTail(auth) {
  const first = await searchJdSkuPage(auth, 1);
  const pages = [];
  if (first.lastPage <= 2) {
    pages.push(first.skus);
  }
  const targets = [];
  if (first.lastPage > 1) {
    targets.push(first.lastPage);
  }
  if (first.lastPage > 2) {
    targets.push(first.lastPage - 1);
  }
  const rest = await mapPool(targets, 2, async (pageNo) => (await searchJdSkuPage(auth, pageNo)).skus);
  const seen = new Set();
  const skus = [];
  for (const row of [...pages.flat(), ...rest.flat()]) {
    if (!row?.skuId || seen.has(row.skuId)) {
      continue;
    }
    seen.add(row.skuId);
    skus.push(row);
    if (skus.length >= EXPRESS_PER_SHOP) {
      break;
    }
  }
  return skus;
}

function inventoryResult(records, extra) {
  const usable = records.reduce((sum, row) => sum + row.usableNum, 0);
  const low = records.filter((row) => row.stockLabel === "低库存" || row.stockLabel === "库存异常").length;
  return {
    ok: true,
    source: "jingdong-partition-stock",
    page: "京东库存监控",
    records,
    summary: {
      jd: records.length,
      usable,
      low,
      droppedNational: extra.droppedNational || 0,
      failed: extra.failed || 0,
      listed: records.length
    },
    total: extra.total ?? records.length,
    totalPages: extra.totalPages || 1,
    currentPage: extra.currentPage || 1,
    pageSize: extra.pageSize || records.length
  };
}

async function linesForSkus(skus, authFor, meta, readLines) {
  const groups = await mapPool(skus, 4, async (sku) => {
    const shopId = String(sku.shopId ?? "");
    const auth = authFor(shopId);
    if (!auth || !sku.skuId) {
      return { lines: [], droppedNational: 0, failed: 0 };
    }
    try {
      const stock = await readLines(auth, sku.skuId);
      return {
        droppedNational: stock.droppedNational,
        failed: 0,
        lines: stock.lines.map((line) => ({
          ...line,
          productId: String(sku.productId || sku.wareId || ""),
          productName: sku.productName || sku.skuName || "",
          skuId: String(sku.skuId),
          shopId,
          shopName: shopName(meta, shopId)
        }))
      };
    } catch {
      return { lines: [], droppedNational: 0, failed: 1 };
    }
  });
  return {
    droppedNational: groups.reduce((sum, group) => sum + group.droppedNational, 0),
    failed: groups.reduce((sum, group) => sum + group.failed, 0),
    records: groups
      .flatMap((group) => group.lines)
      .sort((a, b) => a.usableNum - b.usableNum || String(a.skuId).localeCompare(String(b.skuId)))
  };
}

export async function listErpInventory(input = {}) {
  const meta = await listErpShopMeta();
  const { ids, emptyDuty } = await resolveShopIds(input);
  const pageSize = Math.min(toInt(input.pageSize, 20), 20);
  if (emptyDuty) {
    return inventoryResult([], { total: 0, totalPages: 1, currentPage: 1, pageSize, droppedNational: 0, failed: 0 });
  }
  const keyword = String(input.skuName || input.productName || "").trim();
  const authMap = await loadShopAuthMap();
  if (keyword) {
    const data = await erpPost("/product/jd/product/sku/page", {
      pageNum: toInt(input.pageNum, 1),
      pageSize,
      shopIds: ids.length ? ids : undefined,
      skuName: keyword
    });
    const listed = await linesForSkus(data?.records || [], (shopId) => authMap[shopId], meta, readJdWarehouseStock);
    return {
      ...inventoryResult(listed.records, {
        ...pageOf(data),
        droppedNational: listed.droppedNational,
        failed: listed.failed
      })
    };
  }
  const shopIds = (ids.length ? ids.map(String) : Object.keys(authMap)).filter((id) => authMap[id]);
  const pageNum = toInt(input.pageNum, 1);
  const shopPages = Math.max(1, Math.ceil(shopIds.length / SHOPS_PER_PAGE));
  const windowIds = ids.length === 1 ? shopIds : shopIds.slice((pageNum - 1) * SHOPS_PER_PAGE, pageNum * SHOPS_PER_PAGE);
  const grouped = await mapPool(windowIds, 3, async (shopId) => {
    try {
      const skus = await expressSkusAtTail(authMap[shopId]);
      return skus.map((sku) => ({ ...sku, shopId }));
    } catch {
      return [];
    }
  });
  const listed = await linesForSkus(grouped.flat().slice(0, STOCK_CHECK_CAP), (shopId) => authMap[shopId], meta, readPartitionLines);
  return inventoryResult(listed.records, {
    total: listed.records.length,
    totalPages: ids.length === 1 ? 1 : shopPages,
    currentPage: ids.length === 1 ? 1 : Math.min(pageNum, shopPages),
    pageSize: SHOPS_PER_PAGE,
    droppedNational: listed.droppedNational,
    failed: listed.failed
  });
}
