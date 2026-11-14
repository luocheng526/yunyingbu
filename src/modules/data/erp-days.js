/**
 * Xingmai ERP shop-day cache. Pulls via existing ./erp.js erpPost,
 * stores one row per shop + Shanghai natural day, reads from MySQL only.
 */

const PAGE_SIZE = 200;
const PAGE_CAP = 40;
const MONEY_KEYS = {
  payAmount: ["payAmount"],
  refundAmount: ["refundAmount"],
  orderCount: ["orderCount"],
  netOrderCount: ["netOrderCount"],
  totalPromotionCost: ["totalPromotionCost", "promotionCost", "adCost"],
  profit: ["profit"],
  invalidAmount: ["invalidAmount", "invalidOrderAmount"],
  netSales: ["netSales", "netSalesAmount"]
};

let injected = {};
let mem = emptyMem();
let jobsStarted = false;
let tickTimer = 0;

function emptyMem() {
  return { rows: new Map(), jobs: new Map() };
}

export function setErpDaysDeps(deps) {
  injected = { ...(deps || {}) };
}

export function resetErpDaysDeps() {
  injected = {};
  mem = emptyMem();
  jobsStarted = false;
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = 0;
  }
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

export function shiftYmd(ymd, days) {
  const parts = String(ymd || "").split("-").map((n) => Number(n));
  const dt = new Date(Date.UTC(parts[0] || 1970, (parts[1] || 1) - 1, parts[2] || 1));
  dt.setUTCDate(dt.getUTCDate() + Number(days || 0));
  return dt.toISOString().slice(0, 10);
}

export function shanghaiYmd(offsetDays = 0, now = new Date()) {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
  return shiftYmd(ymd, offsetDays);
}

export function shanghaiHour(now = new Date()) {
  const part = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    hour: "numeric",
    hourCycle: "h23"
  })
    .formatToParts(now)
    .find((item) => item.type === "hour");
  return Number(part && part.value) || 0;
}

export function ymdList(from, to) {
  const start = String(from || "").slice(0, 10);
  const end = String(to || "").slice(0, 10);
  const out = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) {
    return out;
  }
  let cur = start;
  while (cur <= end) {
    out.push(cur);
    cur = shiftYmd(cur, 1);
  }
  return out;
}

export function lastNDays(n, today = shanghaiYmd(0)) {
  const count = Math.max(0, Number(n) || 0);
  const end = shiftYmd(today, -1);
  const start = shiftYmd(end, -(count - 1));
  return ymdList(start, end);
}

export function daysOfLastMonth(today = shanghaiYmd(0)) {
  const parts = String(today).split("-").map((n) => Number(n));
  const firstThis = `${String(parts[0]).padStart(4, "0")}-${String(parts[1]).padStart(2, "0")}-01`;
  const lastPrev = shiftYmd(firstThis, -1);
  const firstPrev = `${lastPrev.slice(0, 8)}01`;
  return ymdList(firstPrev, lastPrev);
}

export function jobsFor(now = new Date()) {
  const today = shanghaiYmd(0, now);
  const hour = shanghaiHour(now);
  const jobs = [];
  if (hour < 2) {
    return jobs;
  }
  jobs.push({
    kind: "daily",
    days: [shiftYmd(today, -1), shiftYmd(today, -2)]
  });
  if (Number(today.slice(-2)) === 3) {
    jobs.push({ kind: "month", days: daysOfLastMonth(today) });
  }
  return jobs;
}

function dayKey(shopId, shopName, day) {
  return `${String(shopId || "").trim() || "_"}|${String(shopName || "").trim()}|${day}`;
}

function mapShop(row) {
  const pay = firstNum(row, MONEY_KEYS.payAmount);
  const refund = firstNum(row, MONEY_KEYS.refundAmount);
  const mapped = {
    shopId: String(row.shopId ?? row.id ?? "").trim(),
    shopName: String(row.shopName || row.shop || "").trim(),
    operateName: String(row.operateName || row.operatorName || "").trim(),
    payAmount: pay,
    refundAmount: refund,
    orderCount: firstNum(row, MONEY_KEYS.orderCount),
    netOrderCount: firstNum(row, MONEY_KEYS.netOrderCount),
    totalPromotionCost: firstNum(row, MONEY_KEYS.totalPromotionCost),
    profit: firstNum(row, MONEY_KEYS.profit),
    invalidAmount: firstNum(row, MONEY_KEYS.invalidAmount),
    netSales:
      firstNum(row, MONEY_KEYS.netSales) != null
        ? firstNum(row, MONEY_KEYS.netSales)
        : pay != null && refund != null
          ? pay - refund
          : null
  };
  return mapped.shopId || mapped.shopName ? mapped : null;
}

async function loadDb() {
  if (injected.query) {
    return { query: injected.query };
  }
  try {
    const db = await import("../profile/auth.js");
    if (db?.query) {
      return db;
    }
  } catch {
    // local overlay has no profile module
  }
  return null;
}

async function loadErp() {
  if (typeof injected.erpPost === "function") {
    return { erpPost: injected.erpPost };
  }
  try {
    return await import("./erp.js");
  } catch {
    return null;
  }
}

function memUpsert(row) {
  mem.rows.set(dayKey(row.shopId, row.shopName, row.day), { ...row });
}

function memSelect(from, to) {
  return [...mem.rows.values()].filter((row) => row.day >= from && row.day <= to);
}

export async function ensureErpDayTable() {
  const db = await loadDb();
  if (!db?.query) {
    return { ok: true, memory: true };
  }
  await db.query(
    `CREATE TABLE IF NOT EXISTS data_erp_shop_days (
      shop_id VARCHAR(64) NOT NULL DEFAULT '',
      shop_name VARCHAR(191) NOT NULL DEFAULT '',
      day DATE NOT NULL,
      operate_name VARCHAR(128) NOT NULL DEFAULT '',
      pay_amount DOUBLE NULL,
      refund_amount DOUBLE NULL,
      order_count DOUBLE NULL,
      net_order_count DOUBLE NULL,
      total_promotion_cost DOUBLE NULL,
      profit DOUBLE NULL,
      invalid_amount DOUBLE NULL,
      net_sales DOUBLE NULL,
      pulled_at VARCHAR(32) NOT NULL DEFAULT '',
      PRIMARY KEY (shop_id, shop_name, day)
    )`
  );
  await db.query(
    `CREATE TABLE IF NOT EXISTS data_erp_day_jobs (
      job_key VARCHAR(64) NOT NULL PRIMARY KEY,
      stamp VARCHAR(32) NOT NULL,
      finished_at VARCHAR(32) NOT NULL
    )`
  );
  return { ok: true, memory: false };
}

async function jobDone(kind, stamp) {
  const key = `${kind}:${stamp}`;
  if (mem.jobs.has(key)) {
    return true;
  }
  const db = await loadDb();
  if (!db?.query) {
    return false;
  }
  const [rows] = await db.query("SELECT job_key FROM data_erp_day_jobs WHERE job_key = ?", [key]);
  return Boolean(rows && rows.length);
}

async function markJob(kind, stamp) {
  const key = `${kind}:${stamp}`;
  const at = new Date().toISOString();
  mem.jobs.set(key, at);
  const db = await loadDb();
  if (!db?.query) {
    return;
  }
  await db.query(
    `INSERT INTO data_erp_day_jobs (job_key, stamp, finished_at) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE stamp = VALUES(stamp), finished_at = VALUES(finished_at)`,
    [key, stamp, at]
  );
}

export async function fetchShopDayPages(erp, day) {
  const range = { payTimeStart: `${day} 00:00:00`, payTimeEnd: `${day} 23:59:59` };
  const records = [];
  let pageNum = 1;
  for (;;) {
    const page = await erp.erpPost("/product/jd/order/shop/page", {
      pageNum,
      pageSize: PAGE_SIZE,
      shopIds: [],
      orderBy: "payAmount",
      asc: false,
      filters: [],
      ...range
    });
    const rows = (page && (page.records || page.list)) || [];
    for (const row of rows) {
      records.push(row);
    }
    const total = Number((page && (page.total ?? page.totalCount)) || 0);
    if (!rows.length || rows.length < PAGE_SIZE || (total && records.length >= total) || pageNum >= PAGE_CAP) {
      break;
    }
    pageNum += 1;
  }
  return records;
}

export async function pullDay(day, options = {}) {
  const ymd = String(day || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    return { ok: false, error: "bad-day", day: ymd, shops: 0 };
  }
  const erp = options.erp || (await loadErp());
  if (!erp || typeof erp.erpPost !== "function") {
    return { ok: false, error: "erp-missing", day: ymd, shops: 0 };
  }
  await ensureErpDayTable();
  const raw = await fetchShopDayPages(erp, ymd);
  const shops = raw.map(mapShop).filter(Boolean);
  const pulledAt = new Date().toISOString();
  const db = await loadDb();
  const seen = new Set();
  for (const shop of shops) {
    const key = dayKey(shop.shopId, shop.shopName, ymd);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const row = { ...shop, day: ymd, pulledAt };
    memUpsert(row);
    if (db?.query) {
      await db.query(
        `INSERT INTO data_erp_shop_days (
          shop_id, shop_name, day, operate_name, pay_amount, refund_amount, order_count,
          net_order_count, total_promotion_cost, profit, invalid_amount, net_sales, pulled_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          operate_name = VALUES(operate_name),
          pay_amount = VALUES(pay_amount),
          refund_amount = VALUES(refund_amount),
          order_count = VALUES(order_count),
          net_order_count = VALUES(net_order_count),
          total_promotion_cost = VALUES(total_promotion_cost),
          profit = VALUES(profit),
          invalid_amount = VALUES(invalid_amount),
          net_sales = VALUES(net_sales),
          pulled_at = VALUES(pulled_at)`,
        [
          shop.shopId,
          shop.shopName,
          ymd,
          shop.operateName,
          shop.payAmount,
          shop.refundAmount,
          shop.orderCount,
          shop.netOrderCount,
          shop.totalPromotionCost,
          shop.profit,
          shop.invalidAmount,
          shop.netSales,
          pulledAt
        ]
      );
    }
  }
  return { ok: true, day: ymd, shops: seen.size, overwrite: true, source: "xingmai-erp" };
}

export async function pullDays(days, options = {}) {
  const list = [...new Set((days || []).map((d) => String(d).slice(0, 10)))];
  const results = [];
  for (const day of list) {
    results.push(await pullDay(day, options));
  }
  return results;
}

function addShop(map, row) {
  const id = String(row.shopId || "");
  const name = String(row.shopName || "");
  const key = id || name;
  if (!key) {
    return;
  }
  const cur = map.get(key) || {
    shopId: id,
    shopName: name,
    operateName: row.operateName || "",
    payAmount: 0,
    refundAmount: 0,
    orderCount: 0,
    netOrderCount: 0,
    totalPromotionCost: 0,
    profit: 0,
    invalidAmount: 0,
    netSales: 0
  };
  cur.payAmount += Number(row.payAmount) || 0;
  cur.refundAmount += Number(row.refundAmount) || 0;
  cur.orderCount += Number(row.orderCount) || 0;
  cur.netOrderCount += Number(row.netOrderCount) || 0;
  cur.totalPromotionCost += Number(row.totalPromotionCost) || 0;
  cur.profit += Number(row.profit) || 0;
  cur.invalidAmount += Number(row.invalidAmount) || 0;
  cur.netSales += Number(row.netSales) || 0;
  if (!cur.operateName && row.operateName) {
    cur.operateName = row.operateName;
  }
  if (!cur.shopName && name) {
    cur.shopName = name;
  }
  map.set(key, cur);
}

function trendFrom(rows) {
  const byDay = new Map();
  for (const row of rows) {
    const cur = byDay.get(row.day) || { date: row.day, payAmount: 0, orderCount: 0, refundAmount: 0, profit: 0, promotionCost: 0 };
    cur.payAmount += Number(row.payAmount) || 0;
    cur.orderCount += Number(row.orderCount) || 0;
    cur.refundAmount += Number(row.refundAmount) || 0;
    cur.profit += Number(row.profit) || 0;
    cur.promotionCost += Number(row.totalPromotionCost) || 0;
    byDay.set(row.day, cur);
  }
  return [...byDay.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

export async function summarizeDays(query = {}) {
  const from = String(query.from || query.payTimeStart || "").slice(0, 10);
  const to = String(query.to || query.payTimeEnd || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return { ok: false, error: "from/to required", source: "local-erp-days" };
  }
  await ensureErpDayTable();
  const db = await loadDb();
  let rows = memSelect(from, to);
  if (db?.query) {
    const [dbRows] = await db.query(
      `SELECT shop_id AS shopId, shop_name AS shopName, day, operate_name AS operateName,
              pay_amount AS payAmount, refund_amount AS refundAmount, order_count AS orderCount,
              net_order_count AS netOrderCount, total_promotion_cost AS totalPromotionCost,
              profit, invalid_amount AS invalidAmount, net_sales AS netSales
         FROM data_erp_shop_days
        WHERE day >= ? AND day <= ?`,
      [from, to]
    );
    if (Array.isArray(dbRows)) {
      rows = dbRows.map((row) => ({
        ...row,
        day: String(row.day).slice(0, 10)
      }));
    }
  }
  const map = new Map();
  for (const row of rows) {
    addShop(map, row);
  }
  const shops = [...map.values()].sort((a, b) => (b.payAmount || 0) - (a.payAmount || 0));
  const trend = trendFrom(rows);
  const tot = shops.reduce(
    (acc, shop) => {
      acc.payAmount += Number(shop.payAmount) || 0;
      acc.refundAmount += Number(shop.refundAmount) || 0;
      acc.orderCount += Number(shop.orderCount) || 0;
      acc.netOrderCount += Number(shop.netOrderCount) || 0;
      acc.totalPromotionCost += Number(shop.totalPromotionCost) || 0;
      acc.profit += Number(shop.profit) || 0;
      acc.invalidAmount += Number(shop.invalidAmount) || 0;
      acc.netSales += Number(shop.netSales) || 0;
      return acc;
    },
    {
      payAmount: 0,
      refundAmount: 0,
      orderCount: 0,
      netOrderCount: 0,
      totalPromotionCost: 0,
      profit: 0,
      invalidAmount: 0,
      netSales: 0
    }
  );
  tot.refundRate = tot.payAmount ? tot.refundAmount / tot.payAmount : 0;
  tot.promotionRate = tot.payAmount ? tot.totalPromotionCost / tot.payAmount : 0;
  tot.profitRate = tot.payAmount ? tot.profit / tot.payAmount : 0;
  return {
    ok: true,
    source: "local-erp-days",
    liveErp: false,
    from,
    to,
    shopTotal: shops.length,
    shops,
    trend,
    summary: tot,
    cards: [
      { key: "payAmount", label: "支付金额 (支付)", value: tot.payAmount },
      { key: "orderCount", label: "销售单数", value: tot.orderCount },
      { key: "refundAmount", label: "退款金额", value: tot.refundAmount },
      { key: "profit", label: "利润", value: tot.profit }
    ]
  };
}

export async function backfillDays(n = 90, options = {}) {
  const days = lastNDays(n, options.today || shanghaiYmd(0, options.now));
  const results = await pullDays(days, options);
  await markJob("backfill90", "once");
  return { ok: true, days: days.length, results };
}

export async function runScheduled(now = new Date(), options = {}) {
  await ensureErpDayTable();
  const today = shanghaiYmd(0, now);
  if (!(await jobDone("backfill90", "once"))) {
    await backfillDays(90, { ...options, now });
  }
  const planned = jobsFor(now);
  const ran = [];
  for (const job of planned) {
    if (await jobDone(job.kind, today)) {
      continue;
    }
    ran.push({ kind: job.kind, results: await pullDays(job.days, options) });
    await markJob(job.kind, today);
  }
  return { ok: true, today, ran };
}

export function startErpDayJobs() {
  if (jobsStarted) {
    return { skipped: true, reason: "started" };
  }
  if (process.env.NODE_TEST_CONTEXT || process.env.XM_ERP_DAYS_JOBS === "0") {
    return { skipped: true, reason: "test" };
  }
  jobsStarted = true;
  runScheduled().catch(() => {});
  tickTimer = setInterval(() => {
    runScheduled().catch(() => {});
  }, 60 * 1000);
  if (typeof tickTimer.unref === "function") {
    tickTimer.unref();
  }
  return { skipped: false };
}
