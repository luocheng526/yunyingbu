import {
  erpShopIdTokens,
  filterRecordsByShopIds,
  inactiveErpIdsFromStores,
  operatingErpIdsFromStores,
  parseIdList
} from "./org-shop-status.js";

function asNum(value) {
  if (value == null || value === "" || value === "—") {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function firstNum(row, keys) {
  if (!row || typeof row !== "object") {
    return null;
  }
  for (const key of keys) {
    const n = asNum(row[key]);
    if (n != null) {
      return n;
    }
  }
  return null;
}

function sumField(rows, keys) {
  let total = 0;
  let ok = false;
  for (const row of rows || []) {
    const n = firstNum(row, keys);
    if (n != null) {
      total += n;
      ok = true;
    }
  }
  return ok ? total : null;
}

function payRange(query = {}) {
  const start = String(query.payTimeStart || query.from || "").trim();
  const end = String(query.payTimeEnd || query.to || "").trim();
  if (start && end) {
    return {
      payTimeStart: start.includes(" ") ? start : `${start} 00:00:00`,
      payTimeEnd: end.includes(" ") ? end : `${end} 23:59:59`
    };
  }
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
  return { payTimeStart: `${today} 00:00:00`, payTimeEnd: `${today} 23:59:59` };
}

function normalizeSummary(row, extra = {}) {
  const pay = firstNum(row, ["payAmount"]);
  const refund = firstNum(row, ["refundAmount"]);
  const promo = firstNum(row, ["totalPromotionCost", "promotionCost", "adCost"]);
  const orders = firstNum(row, ["orderCount"]);
  const jdOrders = firstNum(row, ["jdStoreOrderCount", "jdWarehouseOrderCount", "jdOrders"]);
  const jdRatio = firstNum(row, ["jdStoreOrderRate", "jdWarehouseRate", "jdRatio"]);
  const summary = {
    payAmount: pay,
    totalPromotionCost: promo,
    promotionRate: firstNum(row, ["promotionRate", "promotionCostRate"]),
    refundAmount: refund,
    refundRate: firstNum(row, ["refundRate"]),
    profit: firstNum(row, ["profit"]),
    profitRate: firstNum(row, ["profitRate"]),
    orderCount: orders,
    netOrderCount: firstNum(row, ["netOrderCount"]),
    platformFee: firstNum(row, ["platformCost", "platformFee"]),
    saleFee: firstNum(row, ["salesCost", "saleFee", "salesFee"]),
    goodsCost: firstNum(row, ["totalProductCost", "goodsCost", "totalGoodsCost"]),
    invalidAmount: firstNum(row, ["invalidAmount", "invalidOrderAmount"]),
    netSales: pay != null && refund != null ? pay - refund : firstNum(row, ["netSales", "netSalesAmount"]),
    jdOrders,
    jdRatio: jdRatio != null ? jdRatio : jdOrders != null && orders ? jdOrders / orders : null,
    netSkuNum: firstNum(row, ["netSkuNum", "netSalesQty"]) ?? extra.netSkuNum ?? null,
    netGoodsCost: firstNum(row, ["totalNetProductCost", "netGoodsCost", "netJxjPurchaseCost"]),
    todayPayAmount: firstNum(row, ["todayPayAmount"]),
    yesterdayPayAmount: firstNum(row, ["yesterdayPayAmount"])
  };
  if (summary.promotionRate == null && pay && promo != null) {
    summary.promotionRate = promo / pay;
  }
  if (summary.profitRate == null && pay && summary.profit != null) {
    summary.profitRate = summary.profit / pay;
  }
  if (summary.refundRate == null && pay && refund != null) {
    summary.refundRate = refund / pay;
  }
  return summary;
}

function publicShopRow(row) {
  if (!row || typeof row !== "object") {
    return null;
  }
  const mapped = normalizeSummary(row);
  mapped.shopId = String(row.shopId ?? row.id ?? "");
  mapped.shopName = row.shopName || "";
  return mapped.shopId || mapped.shopName ? mapped : null;
}

function summaryFromRecords(records, extra = {}) {
  return normalizeSummary(
    {
      payAmount: sumField(records, ["payAmount"]),
      refundAmount: sumField(records, ["refundAmount"]),
      totalPromotionCost: sumField(records, ["totalPromotionCost", "promotionCost", "adCost"]),
      profit: sumField(records, ["profit"]),
      orderCount: sumField(records, ["orderCount"]),
      netOrderCount: sumField(records, ["netOrderCount"]),
      platformCost: sumField(records, ["platformFee", "platformCost"]),
      salesCost: sumField(records, ["saleFee", "salesCost", "salesFee"]),
      totalProductCost: sumField(records, ["goodsCost", "totalProductCost", "totalGoodsCost"]),
      invalidAmount: sumField(records, ["invalidAmount", "invalidOrderAmount"]),
      jdStoreOrderCount: sumField(records, ["jdOrders", "jdStoreOrderCount", "jdWarehouseOrderCount"]),
      totalNetProductCost: sumField(records, ["netGoodsCost", "totalNetProductCost", "netJxjPurchaseCost"]),
      netSkuNum: sumField(records, ["netSkuNum", "netSalesQty"]),
      todayPayAmount: sumField(records, ["todayPayAmount"]),
      yesterdayPayAmount: sumField(records, ["yesterdayPayAmount"])
    },
    extra
  );
}

async function loadErp() {
  try {
    return await import("../data/erp.js");
  } catch {
    return null;
  }
}

async function loadOrgStores() {
  try {
    const board = await import("../people/org-board.js");
    const fns = [
      board.listStores,
      board.listOrgStores,
      board.getStores,
      board.readStores,
      board.allStores,
      board.storesForStats
    ];
    for (const fn of fns) {
      if (typeof fn !== "function") {
        continue;
      }
      const out = await fn();
      if (Array.isArray(out)) {
        return out;
      }
      if (out && Array.isArray(out.stores)) {
        return out.stores;
      }
    }
  } catch {
    /* org-board only exists on the live server */
  }
  return [];
}

export function mapErpKpis(shopPage, trendRows, options = {}) {
  let records = (shopPage?.records || []).map(publicShopRow).filter(Boolean);
  const allow = options.allowIds instanceof Set ? options.allowIds : new Set(options.allowIds || []);
  const deny = options.denyIds instanceof Set ? options.denyIds : new Set(options.denyIds || []);
  const filtered = allow.size > 0 || deny.size > 0;
  if (filtered) {
    records = filterRecordsByShopIds(records, allow, deny);
  }
  const trend = Array.isArray(trendRows) ? trendRows : [];
  const extra = {
    netSkuNum: sumField(trend, ["netSkuNum", "netSalesQty"])
  };
  const summary = filtered
    ? summaryFromRecords(records, extra)
    : normalizeSummary(shopPage?.summary || {}, extra);
  if (!filtered) {
    if (summary.totalPromotionCost == null) {
      summary.totalPromotionCost = sumField(trend, ["promotionCost", "totalPromotionCost"]);
    }
    if (summary.platformFee == null) {
      summary.platformFee = sumField(trend, ["platformCost", "platformFee"]);
    }
    if (summary.saleFee == null) {
      summary.saleFee = sumField(trend, ["salesCost", "saleFee"]);
    }
    if (summary.goodsCost == null) {
      summary.goodsCost = sumField(trend, ["totalProductCost", "goodsCost"]);
    }
    if (summary.invalidAmount == null) {
      summary.invalidAmount = sumField(trend, ["invalidAmount"]);
    }
    if (summary.jdOrders == null) {
      summary.jdOrders = sumField(trend, ["jdStoreOrderCount", "jdOrders"]);
    }
    if (summary.netGoodsCost == null) {
      summary.netGoodsCost = sumField(trend, ["totalNetProductCost", "netGoodsCost", "netJxjPurchaseCost"]);
    }
    if (summary.netSkuNum == null) {
      summary.netSkuNum = extra.netSkuNum;
    }
    if (summary.jdRatio == null && summary.jdOrders != null && summary.orderCount) {
      summary.jdRatio = summary.jdOrders / summary.orderCount;
    }
  }
  return { summary, records, filtered };
}

export async function fetchAllShopPages(erp, range, pageSize = 200, shopIds = []) {
  let pageNum = 1;
  let merged = null;
  const records = [];
  const ids = Array.isArray(shopIds) ? shopIds : [];
  for (;;) {
    const page = await erp.erpPost("/product/jd/order/shop/page", {
      pageNum,
      pageSize,
      shopIds: erpShopIdTokens(ids),
      orderBy: "payAmount",
      asc: false,
      filters: [],
      ...range
    });
    if (!merged) {
      merged = page || {};
    }
    const rows = (page && (page.records || page.list)) || [];
    for (const row of rows) {
      records.push(row);
    }
    const total = Number((page && (page.total ?? page.totalCount)) || 0);
    if (!rows.length || rows.length < pageSize || (total && records.length >= total) || pageNum >= 20) {
      break;
    }
    pageNum += 1;
  }
  return { ...(merged || {}), records };
}

export async function resolveErpShopScope(query = {}, stores = null) {
  const requested = parseIdList(query, "shopIds");
  const excluded = new Set(parseIdList(query, "excludeShopIds"));
  const orgStores = stores == null ? await loadOrgStores() : stores;
  for (const id of inactiveErpIdsFromStores(orgStores)) {
    excluded.add(id);
  }
  const operating = operatingErpIdsFromStores(orgStores);
  let allow = requested.slice();
  if (!allow.length && operating.length) {
    allow = operating;
  }
  allow = allow.filter((id) => !excluded.has(id));
  return {
    allowIds: new Set(allow),
    denyIds: excluded,
    skipErp: requested.length > 0 && allow.length === 0
      ? true
      : !requested.length && orgStores.length > 0 && operating.length === 0
  };
}

export async function getHomeErpKpis(query = {}) {
  const range = payRange(query);
  const scope = await resolveErpShopScope(query);
  if (scope.skipErp) {
    return {
      ok: true,
      source: "xingmai-erp",
      range,
      summary: normalizeSummary({}),
      records: [],
      skippedErp: true
    };
  }
  const erp = await loadErp();
  if (!erp || typeof erp.erpPost !== "function") {
    return { ok: false, error: "数据中心 ERP 客户端未挂上" };
  }
  const shopIds = [...scope.allowIds];
  const filtered = shopIds.length > 0 || scope.denyIds.size > 0;
  const shopPage = await fetchAllShopPages(erp, range, 200, shopIds);
  const trendRows = filtered
    ? []
    : await erp
        .erpPost("/product/board/salesTrend", {
          startDate: range.payTimeStart,
          endDate: range.payTimeEnd
        })
        .catch(() => []);
  const mapped = mapErpKpis(shopPage, trendRows, {
    allowIds: scope.allowIds,
    denyIds: scope.denyIds
  });
  return {
    ok: true,
    source: "xingmai-erp",
    range,
    summary: mapped.summary,
    records: mapped.records,
    skippedErp: false
  };
}
