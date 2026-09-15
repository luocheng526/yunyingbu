const STATUSES = ["待办", "进行中", "已完成"];
const DEFAULT_OWNER = "沈子晗";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 366;

export const SQL = {
  addStoreColumn: `ALTER TABLE shen_tasks ADD COLUMN store VARCHAR(64) NOT NULL DEFAULT ''`,
  addCreatedAtColumn: `ALTER TABLE shen_tasks ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`,
  listTasks: `SELECT id, title, status, owner, store FROM shen_tasks ORDER BY id ASC`,
  insertTask: `INSERT INTO shen_tasks (title, status, owner, store) VALUES (?, ?, ?, ?)`,
  summarizeTasks: `SELECT status, COUNT(*) AS cnt FROM shen_tasks WHERE store = ? AND created_at >= ? AND created_at < ? GROUP BY status`,
  getBrief: `SELECT text FROM shen_brief WHERE id = 1`,
  setBrief: `INSERT INTO shen_brief (id, text) VALUES (1, ?) ON DUPLICATE KEY UPDATE text = VALUES(text)`,
  resetTasks: `DELETE FROM shen_tasks`,
  resetBrief: `UPDATE shen_brief SET text = '' WHERE id = 1`,
  createPaidTable: `CREATE TABLE IF NOT EXISTS shen_paid_daily (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  seq INT UNSIGNED NOT NULL DEFAULT 0,
  store VARCHAR(64) NOT NULL,
  account_id VARCHAR(64) NOT NULL DEFAULT '',
  day DATE NOT NULL,
  spend DECIMAL(14,2) NOT NULL DEFAULT 0,
  paid_orders INT NOT NULL DEFAULT 0,
  roi DECIMAL(12,4) NOT NULL DEFAULT 0,
  cvr DECIMAL(12,4) NOT NULL DEFAULT 0,
  cpc DECIMAL(14,4) NOT NULL DEFAULT 0,
  jingmai_gmv DECIMAL(14,2) NOT NULL DEFAULT 0,
  clicks INT NOT NULL DEFAULT 0,
  ctr DECIMAL(12,4) NOT NULL DEFAULT 0,
  total_order_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  real_fee_ratio DECIMAL(12,4) NOT NULL DEFAULT 0,
  source VARCHAR(64) NOT NULL DEFAULT 'local',
  ingested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_shen_paid_daily (store, day),
  KEY idx_shen_paid_daily_day (day)
)`,
  addPaidAccountColumn: `ALTER TABLE shen_paid_daily ADD COLUMN account_id VARCHAR(64) NOT NULL DEFAULT ''`,
  addPaidOrdersColumn: `ALTER TABLE shen_paid_daily ADD COLUMN paid_orders INT NOT NULL DEFAULT 0`,
  addPaidJingmaiColumn: `ALTER TABLE shen_paid_daily ADD COLUMN jingmai_gmv DECIMAL(14,2) NOT NULL DEFAULT 0`,
  addPaidTotalOrderColumn: `ALTER TABLE shen_paid_daily ADD COLUMN total_order_amount DECIMAL(14,2) NOT NULL DEFAULT 0`,
  addPaidFeeRatioColumn: `ALTER TABLE shen_paid_daily ADD COLUMN real_fee_ratio DECIMAL(12,4) NOT NULL DEFAULT 0`,
  upsertPaid: `INSERT INTO shen_paid_daily (seq, store, account_id, day, spend, paid_orders, roi, cvr, cpc, jingmai_gmv, clicks, ctr, total_order_amount, real_fee_ratio, source)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
  seq = VALUES(seq),
  account_id = VALUES(account_id),
  spend = VALUES(spend),
  paid_orders = VALUES(paid_orders),
  roi = VALUES(roi),
  cvr = VALUES(cvr),
  cpc = VALUES(cpc),
  jingmai_gmv = VALUES(jingmai_gmv),
  clicks = VALUES(clicks),
  ctr = VALUES(ctr),
  total_order_amount = VALUES(total_order_amount),
  real_fee_ratio = VALUES(real_fee_ratio),
  source = VALUES(source),
  ingested_at = CURRENT_TIMESTAMP`,
  listPaid: `SELECT id, seq, store, account_id, day, spend, paid_orders, roi, cvr, cpc, jingmai_gmv, clicks, ctr, total_order_amount, real_fee_ratio, source, ingested_at
FROM shen_paid_daily
WHERE (? = 1 OR store = ?) AND day >= ? AND day <= ?
ORDER BY day DESC, seq ASC, id ASC
LIMIT ?`,
  summarizePaid: `SELECT COALESCE(SUM(spend), 0) AS spend, COALESCE(SUM(paid_orders), 0) AS paid_orders, COALESCE(SUM(jingmai_gmv), 0) AS jingmai_gmv, COALESCE(SUM(clicks), 0) AS clicks, COALESCE(SUM(total_order_amount), 0) AS total_order_amount, COUNT(*) AS cnt
FROM shen_paid_daily
WHERE (? = 1 OR store = ?) AND day >= ? AND day <= ?`
};

const MAX_PAID_ROWS = 2000;
const MAX_PAID_LIST = 1000;

let poolOverride = null;
let nextId = 1;
let memoryTasks = [];
let memoryBrief = "";
let nextPaidId = 1;
let memoryPaid = [];

export function setPool(pool) {
  poolOverride = pool;
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function isDuplicateColumnError(err) {
  const code = err?.code || err?.errno;
  const message = String(err?.message || "");
  return code === "ER_DUP_FIELDNAME" || code === 1060 || /duplicate column/i.test(message);
}

function mapTask(row) {
  return {
    id: Number(row.id),
    title: row.title,
    status: row.status,
    owner: row.owner,
    store: row.store || ""
  };
}

async function loadAuth() {
  try {
    return await import("../profile/auth.js");
  } catch {
    return null;
  }
}

async function mysqlQuery(sql, params = []) {
  if (poolOverride) {
    return poolOverride.query(sql, params);
  }
  const auth = await loadAuth();
  if (auth?.dbMode?.() === "mysql" && typeof auth.query === "function") {
    return auth.query(sql, params);
  }
  return null;
}

async function ensureStoreColumns() {
  for (const sql of [SQL.addStoreColumn, SQL.addCreatedAtColumn]) {
    try {
      const result = await mysqlQuery(sql);
      if (!result && !poolOverride) {
        return;
      }
    } catch (err) {
      if (!isDuplicateColumnError(err)) {
        throw err;
      }
    }
  }
}

export function parseSummaryQuery({ store, from, to }) {
  const storeName = String(store ?? "").trim();
  if (!storeName) {
    throw httpError(400, "必须指定店");
  }
  const fromDay = String(from ?? "").trim();
  const toDay = String(to ?? "").trim();
  if (!fromDay || !toDay) {
    throw httpError(400, "必须指定时间范围 from、to");
  }
  if (!DATE_RE.test(fromDay) || !DATE_RE.test(toDay)) {
    throw httpError(400, "from、to 必须是 YYYY-MM-DD");
  }
  if (fromDay > toDay) {
    throw httpError(400, "from 不能晚于 to");
  }
  const start = new Date(`${fromDay}T00:00:00Z`);
  const end = new Date(`${toDay}T00:00:00Z`);
  const days = Math.round((end - start) / 86400000) + 1;
  if (days > MAX_RANGE_DAYS) {
    throw httpError(400, `时间范围不能超过 ${MAX_RANGE_DAYS} 天`);
  }
  const nextDay = new Date(end);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  return {
    store: storeName,
    from: fromDay,
    to: toDay,
    fromAt: `${fromDay} 00:00:00`,
    toExclusiveAt: `${nextDay.toISOString().slice(0, 10)} 00:00:00`
  };
}

function summarizeRows(rows) {
  const byStatus = Object.fromEntries(STATUSES.map((status) => [status, 0]));
  let total = 0;
  for (const row of rows) {
    const count = Number(row.cnt) || 0;
    total += count;
    if (Object.prototype.hasOwnProperty.call(byStatus, row.status)) {
      byStatus[row.status] = count;
    }
  }
  return { total, byStatus };
}

function clipText(value, max, label) {
  const text = String(value ?? "").trim();
  if (text.length > max) {
    throw httpError(400, `${label}不能超过 ${max} 个字`);
  }
  return text;
}

function asDay(value, label = "date") {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const text = String(value ?? "").trim();
  const day = DATE_RE.test(text) ? text : text.slice(0, 10);
  if (!DATE_RE.test(day)) {
    throw httpError(400, `${label} 必须是 YYYY-MM-DD`);
  }
  return day;
}

function toFiniteNumber(value) {
  if (value == null || value === "") {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : NaN;
  }
  const text = String(value).trim().replace(/,/g, "").replace(/%/g, "");
  if (!text) {
    return null;
  }
  return Number(text);
}

function asMoney(value, label) {
  const number = toFiniteNumber(value);
  if (number == null) {
    return 0;
  }
  if (!Number.isFinite(number) || number < 0) {
    throw httpError(400, `${label}必须是大于等于 0 的数字`);
  }
  return Math.round(number * 100) / 100;
}

function asCount(value, label) {
  const number = toFiniteNumber(value);
  if (number == null) {
    return 0;
  }
  if (!Number.isFinite(number) || number < 0) {
    throw httpError(400, `${label}必须是大于等于 0 的数字`);
  }
  return Math.round(number);
}

function asRate(value, label) {
  const number = toFiniteNumber(value);
  if (number == null) {
    return 0;
  }
  if (!Number.isFinite(number) || number < 0) {
    throw httpError(400, `${label}必须是大于等于 0 的数字`);
  }
  return Math.round(number * 10000) / 10000;
}

function pickField(raw, keys) {
  for (const key of keys) {
    if (raw[key] != null && raw[key] !== "") {
      return raw[key];
    }
  }
  return undefined;
}

function todayDay() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
}

function paidKey(row) {
  return `${row.store}\t${row.day}`;
}

function mapPaid(row) {
  const day = typeof row.day === "string" ? row.day.slice(0, 10) : asDay(row.day, "day");
  return {
    id: Number(row.id),
    seq: Number(row.seq) || 0,
    store: row.store || "",
    accountId: row.account_id || row.accountId || "",
    date: day,
    spend: Number(row.spend) || 0,
    paidOrders: Number(row.paid_orders ?? row.paidOrders) || 0,
    roi: Number(row.roi) || 0,
    cvr: Number(row.cvr) || 0,
    cpc: Number(row.cpc) || 0,
    jingmaiGmv: Number(row.jingmai_gmv ?? row.jingmaiGmv) || 0,
    clicks: Number(row.clicks) || 0,
    ctr: Number(row.ctr) || 0,
    totalOrderAmount: Number(row.total_order_amount ?? row.totalOrderAmount) || 0,
    realFeeRatio: Number(row.real_fee_ratio ?? row.realFeeRatio) || 0,
    source: row.source || "local",
    ingestedAt: row.ingested_at || row.ingestedAt || ""
  };
}

function parsePaidRange({ store, from, to, limit }) {
  const storeName = String(store ?? "").trim();
  const fromRaw = String(from ?? "").trim();
  const toRaw = String(to ?? "").trim();
  if ((fromRaw && !toRaw) || (!fromRaw && toRaw)) {
    throw httpError(400, "from、to 必须成对出现");
  }
  let fromDay = "0000-01-01";
  let toDay = "9999-12-31";
  if (fromRaw || toRaw) {
    const parsed = parseSummaryQuery({
      store: storeName || "全部",
      from: fromRaw,
      to: toRaw
    });
    fromDay = parsed.from;
    toDay = parsed.to;
  }
  const rawLimit = limit == null || limit === "" ? 200 : Number(limit);
  if (!Number.isFinite(rawLimit) || rawLimit < 1) {
    throw httpError(400, "limit 必须是正整数");
  }
  return {
    store: storeName,
    allStores: storeName ? 0 : 1,
    from: fromRaw ? fromDay : "",
    to: toRaw ? toDay : "",
    fromDay,
    toDay,
    limit: Math.min(Math.round(rawLimit), MAX_PAID_LIST)
  };
}

function parsePaidRow(raw, defaultStore, defaultDay, source) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw httpError(400, "rows 里必须是对象");
  }
  const store = clipText(
    pickField(raw, ["店铺名称", "store", "店铺名", "店铺"]) || defaultStore,
    64,
    "店铺名称"
  );
  if (!store) {
    throw httpError(400, "必须指定店铺名称");
  }
  const dayRaw = pickField(raw, ["date", "day", "日期"]) || defaultDay || todayDay();
  return {
    seq: asCount(pickField(raw, ["表格行号", "seq", "序列号"]), "表格行号"),
    store,
    accountId: clipText(pickField(raw, ["京准通主账户ID", "accountId", "jztAccountId"]), 64, "京准通主账户ID"),
    day: asDay(dayRaw, "date"),
    spend: asMoney(pickField(raw, ["京准通花费", "spend", "花费"]), "京准通花费"),
    paidOrders: asCount(pickField(raw, ["京准通付费订单数", "paidOrders"]), "京准通付费订单数"),
    roi: asRate(pickField(raw, ["京准通付费投产比", "roi", "投产比"]), "京准通付费投产比"),
    cvr: asRate(pickField(raw, ["京准通付费转化率", "cvr", "转化率"]), "京准通付费转化率"),
    cpc: asRate(pickField(raw, ["京准通平均点击成本", "cpc", "平均点击成本"]), "京准通平均点击成本"),
    jingmaiGmv: asMoney(pickField(raw, ["京麦成交金额", "jingmaiGmv"]), "京麦成交金额"),
    clicks: asCount(pickField(raw, ["京准通点击数", "clicks", "点击数"]), "京准通点击数"),
    ctr: asRate(pickField(raw, ["京准通点击率", "ctr", "点击率"]), "京准通点击率"),
    totalOrderAmount: asMoney(pickField(raw, ["京准通总订单金额", "totalOrderAmount"]), "京准通总订单金额"),
    realFeeRatio: asRate(pickField(raw, ["真实费比", "realFeeRatio"]), "真实费比"),
    source: clipText(pickField(raw, ["source", "来源"]) || source, 64, "来源") || "local"
  };
}

async function ensurePaidTable() {
  const created = await mysqlQuery(SQL.createPaidTable);
  if (!created && !poolOverride) {
    return;
  }
  for (const sql of [
    SQL.addPaidAccountColumn,
    SQL.addPaidOrdersColumn,
    SQL.addPaidJingmaiColumn,
    SQL.addPaidTotalOrderColumn,
    SQL.addPaidFeeRatioColumn
  ]) {
    try {
      await mysqlQuery(sql);
    } catch (err) {
      if (!isDuplicateColumnError(err)) {
        throw err;
      }
    }
  }
}

export function resetStore() {
  nextId = 1;
  memoryTasks = [];
  memoryBrief = "";
  nextPaidId = 1;
  memoryPaid = [];
}

export async function hydrateFromMysql() {
  await ensureStoreColumns();
  await ensurePaidTable();
  const listed = await mysqlQuery(SQL.listTasks);
  if (!listed) {
    return;
  }
  const [taskRows] = listed;
  memoryTasks = taskRows.map(mapTask);
  nextId = memoryTasks.reduce((max, task) => Math.max(max, Number(task.id) || 0), 0) + 1;
  const briefResult = await mysqlQuery(SQL.getBrief);
  const briefRows = briefResult?.[0] || [];
  if (briefRows.length) {
    memoryBrief = briefRows[0].text == null ? "" : String(briefRows[0].text);
  } else {
    await mysqlQuery(SQL.setBrief, [memoryBrief]);
  }
}

export async function listTasks() {
  await ensureStoreColumns();
  const result = await mysqlQuery(SQL.listTasks);
  if (result) {
    return result[0].map(mapTask);
  }
  return memoryTasks.map((task) => ({ ...task }));
}

export async function addTask(title, store) {
  const trimmed = String(title ?? "").trim();
  if (!trimmed) {
    throw httpError(400, "标题必填");
  }
  const storeName = String(store ?? "").trim();
  if (!storeName) {
    throw httpError(400, "必须指定店");
  }
  const task = {
    id: nextId,
    title: trimmed,
    status: "待办",
    owner: DEFAULT_OWNER,
    store: storeName
  };
  await ensureStoreColumns();
  const result = await mysqlQuery(SQL.insertTask, [task.title, task.status, task.owner, task.store]);
  if (result) {
    task.id = Number(result[0].insertId);
    return { ...task };
  }
  nextId += 1;
  memoryTasks.push({ ...task, created_at: "2026-09-09 12:00:00" });
  return { ...task };
}

export async function getStoreSummary({ store, from, to }) {
  const parsed = parseSummaryQuery({ store, from, to });
  await ensureStoreColumns();
  const result = await mysqlQuery(SQL.summarizeTasks, [parsed.store, parsed.fromAt, parsed.toExclusiveAt]);
  let rows;
  if (result) {
    rows = result[0];
  } else {
    const counts = new Map();
    for (const task of memoryTasks) {
      if (task.store !== parsed.store) {
        continue;
      }
      const created = task.created_at || "";
      if (created && (created < parsed.fromAt || created >= parsed.toExclusiveAt)) {
        continue;
      }
      counts.set(task.status, (counts.get(task.status) || 0) + 1);
    }
    rows = [...counts.entries()].map(([status, cnt]) => ({ status, cnt }));
  }
  return {
    ok: true,
    store: parsed.store,
    from: parsed.from,
    to: parsed.to,
    tasks: summarizeRows(rows)
  };
}

export async function getBrief() {
  const result = await mysqlQuery(SQL.getBrief);
  if (result) {
    const rows = result[0];
    return { text: rows[0] ? String(rows[0].text || "") : "" };
  }
  return { text: memoryBrief };
}

export async function setBrief(text) {
  const next = String(text ?? "");
  const result = await mysqlQuery(SQL.setBrief, [next]);
  if (result) {
    return { text: next };
  }
  memoryBrief = next;
  return { text: memoryBrief };
}

function summarizePaidRows(rows) {
  const totals = { spend: 0, paidOrders: 0, jingmaiGmv: 0, clicks: 0, totalOrderAmount: 0, count: rows.length };
  for (const row of rows) {
    totals.spend = asMoney(totals.spend + (Number(row.spend) || 0), "京准通花费");
    totals.paidOrders += Number(row.paidOrders ?? row.paid_orders) || 0;
    totals.jingmaiGmv = asMoney(
      totals.jingmaiGmv + (Number(row.jingmaiGmv ?? row.jingmai_gmv) || 0),
      "京麦成交金额"
    );
    totals.clicks += Number(row.clicks) || 0;
    totals.totalOrderAmount = asMoney(
      totals.totalOrderAmount + (Number(row.totalOrderAmount ?? row.total_order_amount) || 0),
      "京准通总订单金额"
    );
  }
  return totals;
}

export async function ingestPaid(body) {
  const payload = Array.isArray(body) ? { rows: body } : body;
  if (payload == null || typeof payload !== "object") {
    throw httpError(400, "请求体必须是对象");
  }
  const defaultStore = clipText(pickField(payload, ["店铺名称", "store", "店铺名"]) || "", 64, "店铺名称");
  const defaultDayRaw = pickField(payload, ["date", "day", "日期"]);
  const defaultDay = defaultDayRaw ? asDay(defaultDayRaw, "date") : "";
  const source = clipText(pickField(payload, ["source", "来源"]) || "local", 64, "来源") || "local";
  const incoming = payload.rows || payload.data || payload.list;
  if (!Array.isArray(incoming) || incoming.length === 0) {
    throw httpError(400, "rows 必填");
  }
  if (incoming.length > MAX_PAID_ROWS) {
    throw httpError(400, `一次最多回传 ${MAX_PAID_ROWS} 行`);
  }
  const rows = incoming.map((row, index) => {
    const parsed = parsePaidRow(row, defaultStore, defaultDay, source);
    if (!parsed.seq) {
      parsed.seq = index + 1;
    }
    return parsed;
  });
  await ensurePaidTable();
  const ingestedAt = new Date().toISOString().slice(0, 19).replace("T", " ");
  for (const row of rows) {
    const result = await mysqlQuery(SQL.upsertPaid, [
      row.seq,
      row.store,
      row.accountId,
      row.day,
      row.spend,
      row.paidOrders,
      row.roi,
      row.cvr,
      row.cpc,
      row.jingmaiGmv,
      row.clicks,
      row.ctr,
      row.totalOrderAmount,
      row.realFeeRatio,
      row.source
    ]);
    if (result) {
      continue;
    }
    const mapped = {
      id: nextPaidId,
      seq: row.seq,
      store: row.store,
      account_id: row.accountId,
      day: row.day,
      spend: row.spend,
      paid_orders: row.paidOrders,
      roi: row.roi,
      cvr: row.cvr,
      cpc: row.cpc,
      jingmai_gmv: row.jingmaiGmv,
      clicks: row.clicks,
      ctr: row.ctr,
      total_order_amount: row.totalOrderAmount,
      real_fee_ratio: row.realFeeRatio,
      source: row.source,
      ingested_at: ingestedAt
    };
    const key = paidKey(mapped);
    const existing = memoryPaid.findIndex((item) => paidKey(item) === key);
    if (existing >= 0) {
      mapped.id = memoryPaid[existing].id;
      memoryPaid[existing] = mapped;
    } else {
      nextPaidId += 1;
      memoryPaid.push(mapped);
    }
  }
  return {
    ok: true,
    store: defaultStore || rows[0].store,
    source,
    received: rows.length,
    upserted: rows.length,
    ingestedAt
  };
}

export async function listPaid(query) {
  const parsed = parsePaidRange(query);
  await ensurePaidTable();
  const result = await mysqlQuery(SQL.listPaid, [
    parsed.allStores,
    parsed.store,
    parsed.fromDay,
    parsed.toDay,
    parsed.limit
  ]);
  let rows;
  if (result) {
    rows = result[0].map(mapPaid);
  } else {
    rows = memoryPaid
      .filter((row) => {
        if (!parsed.allStores && row.store !== parsed.store) {
          return false;
        }
        return row.day >= parsed.fromDay && row.day <= parsed.toDay;
      })
      .sort((a, b) => {
        if (a.day !== b.day) {
          return a.day < b.day ? 1 : -1;
        }
        return (a.seq || 0) - (b.seq || 0) || a.id - b.id;
      })
      .slice(0, parsed.limit)
      .map(mapPaid);
  }
  return {
    ok: true,
    store: parsed.store,
    from: parsed.from,
    to: parsed.to,
    rows,
    totals: summarizePaidRows(rows)
  };
}

export async function getPaidSummary(query) {
  const parsed = parsePaidRange({ ...query, limit: 1 });
  await ensurePaidTable();
  const result = await mysqlQuery(SQL.summarizePaid, [
    parsed.allStores,
    parsed.store,
    parsed.fromDay,
    parsed.toDay
  ]);
  let totals;
  if (result) {
    const row = result[0][0] || {};
    totals = {
      spend: Number(row.spend) || 0,
      paidOrders: Number(row.paid_orders) || 0,
      jingmaiGmv: Number(row.jingmai_gmv) || 0,
      clicks: Number(row.clicks) || 0,
      totalOrderAmount: Number(row.total_order_amount) || 0,
      count: Number(row.cnt) || 0
    };
  } else {
    const rows = memoryPaid.filter((row) => {
      if (!parsed.allStores && row.store !== parsed.store) {
        return false;
      }
      return row.day >= parsed.fromDay && row.day <= parsed.toDay;
    });
    totals = summarizePaidRows(rows);
  }
  return {
    ok: true,
    store: parsed.store,
    from: parsed.from,
    to: parsed.to,
    paid: totals
  };
}

export { STATUSES, DEFAULT_OWNER, MAX_PAID_ROWS };
