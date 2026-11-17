import { erpPost, listErpShopMeta } from "../data/erp.js";
import {
  callJd,
  groupSkuInventory,
  parseSkuSearch,
  readJdWarehouseStock,
  readPartitionLines,
  resetJdStockForTests,
  shortWarehouseName,
  warehouseNameMap
} from "./jd-stock.js";

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
  inventoryScan = null;
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

const SKU_PAGE_SIZE = 20;
const SCAN_TTL_MS = 10 * 60 * 1000;
const SCAN_WAIT_MS = 10000;
const MAX_SKU_PAGES = 800;
const SKU_SEARCH_FIELD = "skuId,wareId,skuName,stockNum,features";

let inventoryScan = null;

async function searchJdSkuPage(auth, pageNo) {
  const payload = await callJd(auth, "jingdong.sku.read.searchSkuList", {
    pageNo,
    pageSize: SKU_PAGE_SIZE,
    field: SKU_SEARCH_FIELD
  });
  return parseSkuSearch(payload);
}

function inventoryResult(records, extra) {
  const summaryRows = extra.summaryRows || records;
  const usable = summaryRows.reduce((sum, row) => sum + row.usableNum, 0);
  const low = summaryRows.filter((row) => row.stockLabel === "低库存" || row.stockLabel === "库存异常").length;
  return {
    ok: true,
    source: "jingdong-partition-stock",
    page: "京东库存监控",
    records,
    summary: {
      jd: summaryRows.length,
      usable,
      low,
      droppedNational: extra.droppedNational || 0,
      failed: extra.failed || 0,
      listed: records.length
    },
    total: extra.total ?? summaryRows.length,
    totalPages: extra.totalPages || 1,
    currentPage: extra.currentPage || 1,
    pageSize: extra.pageSize || records.length,
    scanning: Boolean(extra.scanning),
    pagesRead: extra.pagesRead || 0,
    pagesTotal: extra.pagesTotal || 0,
    shopsDone: extra.shopsDone || 0,
    shopsTotal: extra.shopsTotal || 0
  };
}

async function linesForSkus(skus, authFor, meta, readLines) {
  const groups = await mapPool(skus, 2, async (sku) => {
    const shopId = String(sku.shopId ?? "");
    const auth = authFor(shopId);
    if (!auth || !sku.skuId) {
      return { lines: [], droppedNational: 0, failed: 0 };
    }
    try {
      let stock;
      try {
        stock = await readLines(auth, sku.skuId);
      } catch {
        stock = await readLines(auth, sku.skuId);
      }
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
  const records = groups.flatMap((group) => group.lines);
  const namesByShop = new Map();
  await mapPool([...new Set(records.map((line) => line.shopId))], 3, async (shopId) => {
    const auth = authFor(shopId);
    namesByShop.set(shopId, auth ? await warehouseNameMap(auth) : {});
  });
  for (const line of records) {
    const full = namesByShop.get(line.shopId)?.[line.warehouseId] || line.warehouseName;
    line.warehouseFullName = full;
    line.warehouseName = shortWarehouseName(full, line.warehouseId);
  }
  return {
    droppedNational: groups.reduce((sum, group) => sum + group.droppedNational, 0),
    failed: groups.reduce((sum, group) => sum + group.failed, 0),
    records
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function searchJdSkuPageRetry(auth, pageNo) {
  try {
    return await searchJdSkuPage(auth, pageNo);
  } catch {
    await delay(400);
    return searchJdSkuPage(auth, pageNo);
  }
}

async function ingestExpressSkus(scan, skus, shopId, authMap, meta) {
  const fresh = [];
  for (const sku of skus) {
    const skuId = String(sku?.skuId || "");
    if (!skuId || scan.seen.has(skuId)) {
      continue;
    }
    scan.seen.add(skuId);
    fresh.push({ ...sku, shopId });
  }
  if (!fresh.length || scan.generation !== inventoryScan?.generation) {
    return;
  }
  const listed = await linesForSkus(fresh, (id) => authMap[id], meta, readPartitionLines);
  if (scan.generation !== inventoryScan?.generation) {
    return;
  }
  scan.droppedNational += listed.droppedNational;
  scan.failed += listed.failed;
  scan.records.push(...listed.records);
  scan.records.sort((a, b) => a.usableNum - b.usableNum || String(a.skuId).localeCompare(String(b.skuId)));
}

async function readShopSkuPages(scan, shopId, authMap, meta) {
  const auth = authMap[shopId];
  if (!auth) {
    return;
  }
  const first = await searchJdSkuPageRetry(auth, 1);
  if (scan.generation !== inventoryScan?.generation) {
    return;
  }
  const lastPage = Math.min(Math.max(first.lastPage, 1), MAX_SKU_PAGES);
  scan.pagesTotal += lastPage;
  scan.pagesRead += 1;
  if (first.lastPage > MAX_SKU_PAGES) {
    scan.failed += 1;
  }
  await ingestExpressSkus(scan, first.skus, shopId, authMap, meta);
  if (lastPage <= 1) {
    return;
  }
  const pageNos = [];
  for (let pageNo = lastPage; pageNo >= 2; pageNo -= 1) {
    pageNos.push(pageNo);
  }
  await mapPool(pageNos, 2, async (pageNo) => {
    if (scan.generation !== inventoryScan?.generation) {
      return;
    }
    try {
      const page = await searchJdSkuPageRetry(auth, pageNo);
      await ingestExpressSkus(scan, page.skus, shopId, authMap, meta);
    } catch {
      scan.failed += 1;
    } finally {
      if (scan.generation === inventoryScan?.generation) {
        scan.pagesRead += 1;
      }
    }
  });
}

async function runInventoryScan(scan, authMap, meta) {
  try {
    await mapPool(scan.shopIds, 2, async (shopId) => {
      if (scan.generation !== inventoryScan?.generation) {
        return;
      }
      try {
        await readShopSkuPages(scan, shopId, authMap, meta);
      } catch {
        scan.failed += 1;
      } finally {
        if (scan.generation === inventoryScan?.generation) {
          scan.shopsDone += 1;
        }
      }
    });
  } finally {
    if (scan.generation === inventoryScan?.generation) {
      scan.running = false;
      scan.done = true;
      scan.at = Date.now();
    }
  }
}

function ensureInventoryScan(shopIds, authMap, meta) {
  const key = shopIds.join(",");
  const now = Date.now();
  if (
    inventoryScan &&
    inventoryScan.key === key &&
    (inventoryScan.running || (inventoryScan.done && now - inventoryScan.at < SCAN_TTL_MS))
  ) {
    return inventoryScan;
  }
  const scan = {
    key,
    shopIds,
    generation: (inventoryScan?.generation || 0) + 1,
    running: true,
    done: false,
    at: 0,
    records: [],
    seen: new Set(),
    droppedNational: 0,
    failed: 0,
    pagesRead: 0,
    pagesTotal: 0,
    shopsDone: 0,
    shopsTotal: shopIds.length
  };
  inventoryScan = scan;
  scan.promise = runInventoryScan(scan, authMap, meta).catch(() => {});
  return scan;
}

async function waitForFirstRows(scan) {
  if (scan.done || scan.records.length > 0 || scan.waiting) {
    return;
  }
  scan.waiting = true;
  const start = Date.now();
  try {
    while (!scan.done && scan.records.length === 0 && Date.now() - start < SCAN_WAIT_MS) {
      await Promise.race([scan.promise, delay(200)]);
    }
  } finally {
    scan.waiting = false;
  }
}

function inventoryPage(scan, input) {
  const grouped = groupSkuInventory(scan.records);
  const pageSize = Math.min(toInt(input.pageSize, 20), 50);
  const total = grouped.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const currentPage = Math.min(toInt(input.pageNum, 1), totalPages);
  const start = (currentPage - 1) * pageSize;
  return inventoryResult(grouped.slice(start, start + pageSize), {
    summaryRows: grouped,
    total,
    totalPages,
    currentPage,
    pageSize,
    droppedNational: scan.droppedNational,
    failed: scan.failed,
    scanning: !scan.done,
    pagesRead: scan.pagesRead,
    pagesTotal: scan.pagesTotal,
    shopsDone: scan.shopsDone,
    shopsTotal: scan.shopsTotal
  });
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
    const grouped = groupSkuInventory(listed.records);
    return inventoryResult(grouped, {
      ...pageOf(data),
      summaryRows: grouped,
      total: grouped.length,
      droppedNational: listed.droppedNational,
      failed: listed.failed
    });
  }
  const shopIds = (ids.length ? ids.map(String) : Object.keys(authMap))
    .filter((id) => authMap[id])
    .sort((a, b) => Number(a) - Number(b));
  const scan = ensureInventoryScan(shopIds, authMap, meta);
  await waitForFirstRows(scan);
  return inventoryPage(scan, input);
}
