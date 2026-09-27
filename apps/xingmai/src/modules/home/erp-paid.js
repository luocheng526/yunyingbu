const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);

async function fetchAllShopPages(erp, range, pageSize = 200) {
  let pageNum = 1;
  let merged = null;
  const records = [];
  for (;;) {
    const page = await erp.erpPost("/product/jd/order/shop/page", {
      pageNum,
      pageSize,
      shopIds: [],
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

function shopPageMap(shopPage) {
  return {
    summary: (shopPage && shopPage.summary) || {},
    records: (shopPage && shopPage.records) || []
  };
}

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

function shanghaiParts(date = new Date()) {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date);
  return { ymd, time };
}

export function shiftYmd(ymd, days) {
  const parts = String(ymd || "").split("-").map((n) => Number(n));
  const dt = new Date(Date.UTC(parts[0] || 1970, (parts[1] || 1) - 1, parts[2] || 1));
  dt.setUTCDate(dt.getUTCDate() + Number(days || 0));
  return dt.toISOString().slice(0, 10);
}

export function hourlyArray(map) {
  const src = map && typeof map === "object" ? map : {};
  return HOURS.map((hour) => {
    const n = Number(src[hour]);
    return Number.isFinite(n) ? n : 0;
  });
}

function addHourly(left, right) {
  return (left || HOURS.map(() => 0)).map((n, i) => n + (Number(right && right[i]) || 0));
}

function asRows(raw) {
  if (Array.isArray(raw)) {
    return raw;
  }
  if (raw && Array.isArray(raw.records)) {
    return raw.records;
  }
  if (raw && Array.isArray(raw.data)) {
    return raw.data;
  }
  return [];
}

function shopKey(row) {
  return String((row && (row.shopId || row.id)) || "");
}

export function mapErpPaid(shopToday, shopYesterday, realtimeRows) {
  const todayMapped = shopPageMap(shopToday || {});
  const yestMapped = shopPageMap(shopYesterday || {});
  const todayById = {};
  for (const row of todayMapped.records || []) {
    const id = shopKey(row);
    if (id) {
      todayById[id] = row;
    }
  }
  const yestById = {};
  for (const row of yestMapped.records || []) {
    const id = shopKey(row);
    if (id) {
      yestById[id] = row;
    }
  }
  const liveRows = asRows(realtimeRows);
  const seen = new Set();
  const records = [];
  function pushRow(base, shop, yest) {
    const id = shopKey(base) || shopKey(shop) || shopKey(yest);
    if (!id || seen.has(id)) {
      return;
    }
    seen.add(id);
    const pay = firstNum(base, ["todayPayAmount", "payAmount"]) ?? firstNum(shop, ["todayPayAmount", "payAmount"]);
    const promo = firstNum(shop, ["totalPromotionCost", "promotionCost", "adCost"]) ?? firstNum(base, ["totalPromotionCost", "promotionCost"]);
    const yestPay = firstNum(base, ["yesterdayPayAmount"]) ?? firstNum(yest, ["payAmount", "todayPayAmount"]);
    const rate = firstNum(shop, ["promotionRate", "promotionCostRate"]);
    records.push({
      shopId: id,
      shopName: (base && base.shopName) || (shop && shop.shopName) || (yest && yest.shopName) || "",
      operateName: (base && (base.operateName || base.operatorName)) || "",
      todayPayAmount: pay,
      yesterdayPayAmount: yestPay,
      payAmount: pay,
      totalPromotionCost: promo != null ? promo : 0,
      promotionRate: rate != null ? rate : pay ? (promo || 0) / pay : 0,
      profit: firstNum(shop, ["profit"]),
      todayHourlyData: (base && base.todayHourlyData) || (shop && shop.todayHourlyData) || null,
      yesterdayHourlyData: (base && base.yesterdayHourlyData) || (shop && shop.yesterdayHourlyData) || null
    });
  }
  for (const row of liveRows) {
    const id = shopKey(row);
    pushRow(row, todayById[id], yestById[id]);
  }
  for (const row of todayMapped.records || []) {
    pushRow(row, row, yestById[shopKey(row)]);
  }
  let todayPay = 0;
  let todayPromo = 0;
  let yestPay = 0;
  let todayHours = HOURS.map(() => 0);
  let yestHours = HOURS.map(() => 0);
  for (const row of records) {
    todayPay += Number(row.todayPayAmount) || 0;
    todayPromo += Number(row.totalPromotionCost) || 0;
    yestPay += Number(row.yesterdayPayAmount) || 0;
    todayHours = addHourly(todayHours, hourlyArray(row.todayHourlyData));
    yestHours = addHourly(yestHours, hourlyArray(row.yesterdayHourlyData));
  }
  if (!liveRows.length && asNum(todayMapped.summary && todayMapped.summary.payAmount) != null) {
    todayPay = Number(todayMapped.summary.payAmount) || todayPay;
  }
  const summaryPromo = firstNum(todayMapped.summary, ["totalPromotionCost", "promotionCost"]);
  const summary = {
    ...(todayMapped.summary || {}),
    payAmount: todayPay,
    todayPayAmount: todayPay,
    yesterdayPayAmount: yestPay,
    totalPromotionCost: summaryPromo != null ? summaryPromo : todayPromo,
    promotionRate:
      firstNum(todayMapped.summary, ["promotionRate"]) != null
        ? todayMapped.summary.promotionRate
        : todayPay
          ? (summaryPromo != null ? summaryPromo : todayPromo) / todayPay
          : 0
  };
  return {
    summary,
    yesterday: yestMapped.summary || {},
    records,
    hourly: { todayPay: todayHours, yesterdayPay: yestHours }
  };
}

async function loadErp() {
  try {
    return await import("../data/erp.js");
  } catch {
    return null;
  }
}

export async function getHomeErpPaid() {
  const erp = await loadErp();
  if (!erp || typeof erp.erpPost !== "function") {
    return { ok: false, error: "数据中心 ERP 客户端未挂上" };
  }
  const { ymd, time } = shanghaiParts();
  const yesterday = shiftYmd(ymd, -1);
  const range = { payTimeStart: `${ymd} 00:00:00`, payTimeEnd: `${ymd} ${time}` };
  const yesterdayRange = { payTimeStart: `${yesterday} 00:00:00`, payTimeEnd: `${yesterday} 23:59:59` };
  const [shopToday, shopYesterday, realtime] = await Promise.all([
    fetchAllShopPages(erp, range, 200),
    fetchAllShopPages(erp, yesterdayRange, 200),
    erp.erpPost("/product/board/realtimeSalesRevenue", {}).catch(() => [])
  ]);
  const mapped = mapErpPaid(shopToday, shopYesterday, realtime);
  return {
    ok: true,
    source: "xingmai-erp",
    range,
    yesterdayRange,
    summary: mapped.summary,
    yesterday: mapped.yesterday,
    records: mapped.records,
    hourly: mapped.hourly
  };
}
