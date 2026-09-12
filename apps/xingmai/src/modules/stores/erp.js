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
  const ids = shopIdsOf(input);
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

export async function listErpStoreShops() {
  const meta = await listErpShopMeta();
  const records = Object.values(meta.names).map((shop) => ({
    id: shop.id,
    shopName: shop.shopName,
    statusLabel: shop.statusLabel,
    typeLabel: shop.typeLabel
  }));
  return { ok: true, source: "xingmai-erp", total: records.length, records };
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
  const ids = shopIdsOf(input);
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
