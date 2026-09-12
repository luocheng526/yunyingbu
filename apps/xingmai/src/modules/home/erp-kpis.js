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

async function loadErp() {
  try {
    return await import("../data/erp.js");
  } catch {
    return null;
  }
}

export function mapErpKpis(shopPage, trendRows) {
  const records = (shopPage?.records || []).map(publicShopRow).filter(Boolean);
  const trend = Array.isArray(trendRows) ? trendRows : [];
  const extra = {
    netSkuNum: sumField(trend, ["netSkuNum", "netSalesQty"])
  };
  const summary = normalizeSummary(shopPage?.summary || {}, extra);
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
  return { summary, records };
}

export async function getHomeErpKpis(query = {}) {
  const erp = await loadErp();
  if (!erp || typeof erp.erpPost !== "function") {
    return { ok: false, error: "数据中心 ERP 客户端未挂上" };
  }
  const range = payRange(query);
  const [shopPage, trendRows] = await Promise.all([
    erp.erpPost("/product/jd/order/shop/page", {
      pageNum: 1,
      pageSize: 50,
      shopIds: [],
      orderBy: "payAmount",
      asc: false,
      filters: [],
      ...range
    }),
    erp.erpPost("/product/board/salesTrend", {
      startDate: range.payTimeStart,
      endDate: range.payTimeEnd
    }).catch(() => [])
  ]);
  const mapped = mapErpKpis(shopPage, trendRows);
  return {
    ok: true,
    source: "xingmai-erp",
    range,
    summary: mapped.summary,
    records: mapped.records
  };
}
