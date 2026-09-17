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
  success_flag VARCHAR(16) NOT NULL DEFAULT '',
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
  addPaidSuccessColumn: `ALTER TABLE shen_paid_daily ADD COLUMN success_flag VARCHAR(16) NOT NULL DEFAULT ''`,
  upsertPaid: `INSERT INTO shen_paid_daily (seq, store, account_id, day, spend, paid_orders, roi, cvr, cpc, jingmai_gmv, clicks, ctr, total_order_amount, real_fee_ratio, success_flag, source)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
  success_flag = VALUES(success_flag),
  source = VALUES(source),
  ingested_at = CURRENT_TIMESTAMP`,
  listPaid: `SELECT id, seq, store, account_id, day, spend, paid_orders, roi, cvr, cpc, jingmai_gmv, clicks, ctr, total_order_amount, real_fee_ratio, success_flag, source, ingested_at
FROM shen_paid_daily
WHERE (? = 1 OR store = ?) AND day >= ? AND day <= ?
ORDER BY day DESC, id ASC
LIMIT ?`,
  summarizePaid: `SELECT COALESCE(SUM(spend), 0) AS spend, COALESCE(SUM(paid_orders), 0) AS paid_orders, COALESCE(SUM(jingmai_gmv), 0) AS jingmai_gmv, COALESCE(SUM(clicks), 0) AS clicks, COALESCE(SUM(total_order_amount), 0) AS total_order_amount, COUNT(*) AS cnt
FROM shen_paid_daily
WHERE (? = 1 OR store = ?) AND day >= ? AND day <= ?`,
  listPaidLatest: `SELECT p.id, p.seq, p.store, p.account_id, p.day, p.spend, p.paid_orders, p.roi, p.cvr, p.cpc, p.jingmai_gmv, p.clicks, p.ctr, p.total_order_amount, p.real_fee_ratio, p.success_flag, p.source, p.ingested_at
FROM shen_paid_daily p
INNER JOIN (
  SELECT store, MAX(day) AS day
  FROM shen_paid_daily
  WHERE (? = 1 OR store = ?) AND day >= ? AND day <= ?
  GROUP BY store
) latest ON latest.store = p.store AND latest.day = p.day
ORDER BY p.store ASC
LIMIT ?`,
  createRechargeTable: `CREATE TABLE IF NOT EXISTS shen_paid_recharge (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  store VARCHAR(64) NOT NULL,
  account_id VARCHAR(64) NOT NULL DEFAULT '',
  day DATE NOT NULL,
  charged_at VARCHAR(32) NOT NULL DEFAULT '',
  amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  balance DECIMAL(14,2) NOT NULL DEFAULT 0,
  channel VARCHAR(64) NOT NULL DEFAULT '',
  remark VARCHAR(200) NOT NULL DEFAULT '',
  source VARCHAR(64) NOT NULL DEFAULT 'local',
  ingested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_shen_paid_recharge (store, day, charged_at, amount),
  KEY idx_shen_paid_recharge_store_day (store, day)
)`,
  upsertRecharge: `INSERT INTO shen_paid_recharge (store, account_id, day, charged_at, amount, balance, channel, remark, source)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
  account_id = VALUES(account_id),
  balance = VALUES(balance),
  channel = VALUES(channel),
  remark = VALUES(remark),
  source = VALUES(source),
  ingested_at = CURRENT_TIMESTAMP`,
  listRecharge: `SELECT id, store, account_id, day, charged_at, amount, balance, channel, remark, source, ingested_at
FROM shen_paid_recharge
WHERE (? = 1 OR store = ?) AND day >= ? AND day <= ?
ORDER BY day DESC, id DESC
LIMIT ?`,
  createSubaccountTable: `CREATE TABLE IF NOT EXISTS shen_paid_subaccount (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  store VARCHAR(64) NOT NULL,
  account_id VARCHAR(64) NOT NULL DEFAULT '',
  sub_account_id VARCHAR(64) NOT NULL,
  sub_account_name VARCHAR(128) NOT NULL DEFAULT '',
  day DATE NOT NULL,
  balance DECIMAL(14,2) NOT NULL DEFAULT 0,
  remark VARCHAR(200) NOT NULL DEFAULT '',
  spend DECIMAL(14,2) NOT NULL DEFAULT 0,
  roi DECIMAL(12,4) NOT NULL DEFAULT 0,
  paid_orders INT NOT NULL DEFAULT 0,
  total_order_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  clicks INT NOT NULL DEFAULT 0,
  impressions INT NOT NULL DEFAULT 0,
  ctr DECIMAL(12,4) NOT NULL DEFAULT 0,
  cpc DECIMAL(14,4) NOT NULL DEFAULT 0,
  cpm DECIMAL(14,4) NOT NULL DEFAULT 0,
  source VARCHAR(64) NOT NULL DEFAULT 'local',
  ingested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_shen_paid_subaccount (day, account_id, sub_account_id),
  KEY idx_shen_paid_sub_store_day (store, day)
)`,
  upsertSubaccount: `INSERT INTO shen_paid_subaccount (store, account_id, sub_account_id, sub_account_name, day, balance, remark, spend, roi, paid_orders, total_order_amount, clicks, impressions, ctr, cpc, cpm, source)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
  store = VALUES(store),
  sub_account_name = VALUES(sub_account_name),
  balance = VALUES(balance),
  remark = VALUES(remark),
  spend = VALUES(spend),
  roi = VALUES(roi),
  paid_orders = VALUES(paid_orders),
  total_order_amount = VALUES(total_order_amount),
  clicks = VALUES(clicks),
  impressions = VALUES(impressions),
  ctr = VALUES(ctr),
  cpc = VALUES(cpc),
  cpm = VALUES(cpm),
  source = VALUES(source),
  ingested_at = CURRENT_TIMESTAMP`,
  listSubaccount: `SELECT id, store, account_id, sub_account_id, sub_account_name, day, balance, remark, spend, roi, paid_orders, total_order_amount, clicks, impressions, ctr, cpc, cpm, source, ingested_at
FROM shen_paid_subaccount
WHERE (? = 1 OR store = ?) AND day >= ? AND day <= ?
ORDER BY day DESC, sub_account_name ASC, id ASC
LIMIT ?`
};

const MAX_PAID_ROWS = 2000;
const MAX_PAID_LIST = 1000;

let poolOverride = null;
let nextId = 1;
let memoryTasks = [];
let memoryBrief = "";
let nextPaidId = 1;
let memoryPaid = [];
let nextRechargeId = 1;
let memoryRecharge = [];
let nextSubId = 1;
let memorySub = [];

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

function asSuccess(value) {
  if (value == null || value === "") {
    return "";
  }
  if (value === true || value === 1) {
    return "是";
  }
  if (value === false || value === 0) {
    return "否";
  }
  const text = String(value).trim();
  const key = text.toLowerCase();
  if (["1", "true", "yes", "y", "ok", "成功", "是"].includes(key)) {
    return "是";
  }
  if (["0", "false", "no", "n", "失败", "否"].includes(key)) {
    return "否";
  }
  return clipText(text, 16, "是否成功");
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

function rechargeKey(row) {
  return `${row.store}\t${row.day}\t${row.charged_at || row.chargedAt || ""}\t${Number(row.amount) || 0}`;
}

function subKey(row) {
  return `${row.day}\t${row.account_id || row.accountId || ""}\t${row.sub_account_id || row.subAccountId || ""}`;
}

function isLatestView(query) {
  const view = String(query?.view ?? "").trim().toLowerCase();
  const latest = String(query?.latest ?? "").trim();
  return view === "latest" || latest === "1" || latest === "true";
}

function pickLatestPaidRows(rows) {
  const byStore = new Map();
  for (const row of rows) {
    const prev = byStore.get(row.store);
    if (!prev || row.date > prev.date || (row.date === prev.date && row.id > prev.id)) {
      byStore.set(row.store, row);
    }
  }
  return [...byStore.values()].sort((a, b) => a.store.localeCompare(b.store, "zh"));
}

function asOfDay(rows) {
  return rows.reduce((max, row) => (row.date > max ? row.date : max), "");
}

function paidMetrics(rows, totals) {
  const successCount = rows.filter((row) => row.success === "是").length;
  const feeRatio =
    totals.totalOrderAmount > 0
      ? Math.round((totals.spend / totals.totalOrderAmount) * 10000) / 100
      : 0;
  return {
    stores: rows.length,
    successCount,
    failCount: rows.length - successCount,
    feeRatio,
    spend: totals.spend,
    paidOrders: totals.paidOrders,
    jingmaiGmv: totals.jingmaiGmv,
    clicks: totals.clicks,
    totalOrderAmount: totals.totalOrderAmount
  };
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
    success: row.success_flag || row.success || "",
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
    seq: 0,
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
    success: asSuccess(pickField(raw, ["是否成功", "success", "ok", "succeeded"])),
    source: clipText(pickField(raw, ["source", "来源"]) || source, 64, "来源") || "local"
  };
}

function mapRecharge(row) {
  const day = typeof row.day === "string" ? row.day.slice(0, 10) : asDay(row.day, "day");
  return {
    id: Number(row.id),
    store: row.store || "",
    accountId: row.account_id || row.accountId || "",
    date: day,
    chargedAt: row.charged_at || row.chargedAt || "",
    amount: Number(row.amount) || 0,
    balance: Number(row.balance) || 0,
    channel: row.channel || "",
    remark: row.remark || "",
    source: row.source || "local",
    ingestedAt: row.ingested_at || row.ingestedAt || ""
  };
}

function parseRechargeRow(raw, defaultStore, defaultDay, source) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw httpError(400, "充值记录必须是对象");
  }
  const store = clipText(
    pickField(raw, ["店铺名称", "store", "店铺名", "店铺"]) || defaultStore,
    64,
    "店铺名称"
  );
  if (!store) {
    throw httpError(400, "充值记录必须指定店铺名称");
  }
  const dayRaw = pickField(raw, ["date", "day", "日期", "充值日期"]) || defaultDay || todayDay();
  return {
    store,
    accountId: clipText(pickField(raw, ["京准通主账户ID", "accountId", "jztAccountId"]), 64, "京准通主账户ID"),
    day: asDay(dayRaw, "date"),
    chargedAt: clipText(pickField(raw, ["充值时间", "chargedAt", "time"]) || "", 32, "充值时间"),
    amount: asMoney(pickField(raw, ["充值金额", "amount", "金额"]), "充值金额"),
    balance: asMoney(pickField(raw, ["账户余额", "balance", "余额"]), "账户余额"),
    channel: clipText(pickField(raw, ["渠道", "channel"]) || "", 64, "渠道"),
    remark: clipText(pickField(raw, ["备注", "remark", "说明"]) || "", 200, "备注"),
    source: clipText(pickField(raw, ["source", "来源"]) || source, 64, "来源") || "local"
  };
}

function mapSubaccount(row) {
  const day = typeof row.day === "string" ? row.day.slice(0, 10) : asDay(row.day, "day");
  return {
    id: Number(row.id),
    store: row.store || "",
    accountId: row.account_id || row.accountId || "",
    subAccountId: row.sub_account_id || row.subAccountId || "",
    subAccountName: row.sub_account_name || row.subAccountName || "",
    date: day,
    balance: Number(row.balance) || 0,
    remark: row.remark || "",
    spend: Number(row.spend) || 0,
    roi: Number(row.roi) || 0,
    paidOrders: Number(row.paid_orders ?? row.paidOrders) || 0,
    totalOrderAmount: Number(row.total_order_amount ?? row.totalOrderAmount) || 0,
    clicks: Number(row.clicks) || 0,
    impressions: Number(row.impressions) || 0,
    ctr: Number(row.ctr) || 0,
    cpc: Number(row.cpc) || 0,
    cpm: Number(row.cpm) || 0,
    source: row.source || "local",
    ingestedAt: row.ingested_at || row.ingestedAt || ""
  };
}

function parseSubaccountRow(raw, defaultStore, defaultAccountId, defaultDay, source) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw httpError(400, "子账号必须是对象");
  }
  const store = clipText(
    pickField(raw, ["店铺名称", "store", "店铺名", "店铺"]) || defaultStore,
    64,
    "店铺名称"
  );
  const accountId = clipText(
    pickField(raw, ["京准通主账户ID", "accountId", "jztAccountId", "主账户ID"]) || defaultAccountId || store,
    64,
    "京准通主账户ID"
  );
  const subAccountId = clipText(
    pickField(raw, ["子账号ID", "subAccountId", "subId", "账户ID"]),
    64,
    "子账号ID"
  );
  if (!store) {
    throw httpError(400, "子账号必须指定店铺名称");
  }
  if (!subAccountId) {
    throw httpError(400, "子账号必须指定子账号ID");
  }
  const dayRaw = pickField(raw, ["date", "day", "日期"]) || defaultDay || todayDay();
  return {
    store,
    accountId,
    subAccountId,
    subAccountName: clipText(
      pickField(raw, ["子账号名称", "subAccountName", "账户名称", "名称"]) || subAccountId,
      128,
      "子账号名称"
    ),
    day: asDay(dayRaw, "date"),
    balance: asMoney(pickField(raw, ["余额", "balance", "账户余额"]), "余额"),
    remark: clipText(pickField(raw, ["账户备注", "remark", "备注"]) || "", 200, "账户备注"),
    spend: asMoney(pickField(raw, ["京准通花费", "spend", "花费"]), "花费"),
    roi: asRate(pickField(raw, ["京准通付费投产比", "roi", "投产比"]), "投产比"),
    paidOrders: asCount(pickField(raw, ["京准通付费订单数", "paidOrders", "单量", "订单数"]), "单量"),
    totalOrderAmount: asMoney(
      pickField(raw, ["京准通总订单金额", "totalOrderAmount", "订单金额"]),
      "订单金额"
    ),
    clicks: asCount(pickField(raw, ["京准通点击数", "clicks", "点击数"]), "点击数"),
    impressions: asCount(pickField(raw, ["展现数", "impressions", "曝光数"]), "展现数"),
    ctr: asRate(pickField(raw, ["京准通点击率", "ctr", "点击率"]), "点击率"),
    cpc: asRate(pickField(raw, ["京准通平均点击成本", "cpc", "平均点击成本"]), "平均点击成本"),
    cpm: asRate(pickField(raw, ["千次展现成本", "cpm"]), "千次展现成本"),
    source: clipText(pickField(raw, ["source", "来源"]) || source, 64, "来源") || "local"
  };
}

function collectSubaccountRaws(payload, rows) {
  const collected = [];
  const top = payload.subaccounts || payload.子账号 || payload.accounts;
  if (Array.isArray(top)) {
    collected.push(...top);
  }
  for (const row of rows) {
    const nested = row?.子账号 || row?.subaccounts || row?.accounts;
    if (!Array.isArray(nested)) {
      continue;
    }
    for (const item of nested) {
      if (item && typeof item === "object") {
        collected.push({
          店铺名称: item.店铺名称 || item.store || row.店铺名称 || row.store,
          京准通主账户ID: item.京准通主账户ID || item.accountId || row.京准通主账户ID || row.accountId,
          date: item.date || item.day || item.日期 || row.date || row.day || row.日期,
          ...item
        });
      } else {
        collected.push(item);
      }
    }
  }
  return collected;
}

function groupSubaccounts(rows) {
  const byId = new Map();
  for (const row of rows) {
    const key = `${row.accountId}\t${row.subAccountId}`;
    if (!byId.has(key)) {
      byId.set(key, {
        accountId: row.accountId,
        subAccountId: row.subAccountId,
        subAccountName: row.subAccountName,
        store: row.store,
        latest: row,
        days: []
      });
    }
    const group = byId.get(key);
    group.days.push(row);
    if (row.date > group.latest.date || (row.date === group.latest.date && row.id > group.latest.id)) {
      group.latest = row;
      group.subAccountName = row.subAccountName || group.subAccountName;
    }
  }
  const accounts = [...byId.values()].map((group) => {
    group.days.sort((a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1));
    return group;
  });
  accounts.sort((a, b) => String(a.subAccountName || a.subAccountId).localeCompare(String(b.subAccountName || b.subAccountId), "zh"));
  return accounts;
}

function collectRechargeRaws(payload, rows) {
  const collected = [];
  const top = payload.recharges || payload.充值记录;
  if (Array.isArray(top)) {
    collected.push(...top);
  }
  for (const row of rows) {
    const nested = row?.充值记录 || row?.recharges;
    if (Array.isArray(nested)) {
      for (const item of nested) {
        if (item && typeof item === "object" && !item.店铺名称 && !item.store) {
          collected.push({ ...item, 店铺名称: row.店铺名称 || row.store, store: row.store });
        } else {
          collected.push(item);
        }
      }
    }
  }
  return collected;
}

async function persistRecharge(row, ingestedAt) {
  const result = await mysqlQuery(SQL.upsertRecharge, [
    row.store,
    row.accountId,
    row.day,
    row.chargedAt,
    row.amount,
    row.balance,
    row.channel,
    row.remark,
    row.source
  ]);
  if (result) {
    return;
  }
  const mapped = {
    id: nextRechargeId,
    store: row.store,
    account_id: row.accountId,
    day: row.day,
    charged_at: row.chargedAt,
    amount: row.amount,
    balance: row.balance,
    channel: row.channel,
    remark: row.remark,
    source: row.source,
    ingested_at: ingestedAt
  };
  const key = rechargeKey(mapped);
  const existing = memoryRecharge.findIndex((item) => rechargeKey(item) === key);
  if (existing >= 0) {
    mapped.id = memoryRecharge[existing].id;
    memoryRecharge[existing] = mapped;
  } else {
    nextRechargeId += 1;
    memoryRecharge.push(mapped);
  }
}

async function persistSubaccount(row, ingestedAt) {
  const result = await mysqlQuery(SQL.upsertSubaccount, [
    row.store,
    row.accountId,
    row.subAccountId,
    row.subAccountName,
    row.day,
    row.balance,
    row.remark,
    row.spend,
    row.roi,
    row.paidOrders,
    row.totalOrderAmount,
    row.clicks,
    row.impressions,
    row.ctr,
    row.cpc,
    row.cpm,
    row.source
  ]);
  if (result) {
    return;
  }
  const mapped = {
    id: nextSubId,
    store: row.store,
    account_id: row.accountId,
    sub_account_id: row.subAccountId,
    sub_account_name: row.subAccountName,
    day: row.day,
    balance: row.balance,
    remark: row.remark,
    spend: row.spend,
    roi: row.roi,
    paid_orders: row.paidOrders,
    total_order_amount: row.totalOrderAmount,
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    cpc: row.cpc,
    cpm: row.cpm,
    source: row.source,
    ingested_at: ingestedAt
  };
  const key = subKey(mapped);
  const existing = memorySub.findIndex((item) => subKey(item) === key);
  if (existing >= 0) {
    mapped.id = memorySub[existing].id;
    memorySub[existing] = mapped;
  } else {
    nextSubId += 1;
    memorySub.push(mapped);
  }
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
    SQL.addPaidFeeRatioColumn,
    SQL.addPaidSuccessColumn,
    SQL.createRechargeTable,
    SQL.createSubaccountTable
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
  nextRechargeId = 1;
  memoryRecharge = [];
  nextSubId = 1;
  memorySub = [];
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
  const incoming = payload.rows || payload.data || payload.list || [];
  if (!Array.isArray(incoming)) {
    throw httpError(400, "rows 必须是数组");
  }
  const rechargeRaws = collectRechargeRaws(payload, incoming);
  const subRaws = collectSubaccountRaws(payload, incoming);
  if (incoming.length === 0 && rechargeRaws.length === 0 && subRaws.length === 0) {
    throw httpError(400, "rows、子账号或充值记录必填");
  }
  if (incoming.length > MAX_PAID_ROWS) {
    throw httpError(400, `一次最多回传 ${MAX_PAID_ROWS} 行`);
  }
  if (rechargeRaws.length > MAX_PAID_ROWS) {
    throw httpError(400, `一次最多回传 ${MAX_PAID_ROWS} 条充值记录`);
  }
  if (subRaws.length > MAX_PAID_ROWS) {
    throw httpError(400, `一次最多回传 ${MAX_PAID_ROWS} 条子账号`);
  }
  const rows = incoming.map((row) => parsePaidRow(row, defaultStore, defaultDay, source));
  const defaultAccountId = rows[0]?.accountId || "";
  const recharges = rechargeRaws.map((row) => parseRechargeRow(row, defaultStore || rows[0]?.store, defaultDay, source));
  const subaccounts = subRaws.map((row) =>
    parseSubaccountRow(row, defaultStore || rows[0]?.store, defaultAccountId, defaultDay, source)
  );
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
      row.success,
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
      success_flag: row.success,
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
  for (const row of recharges) {
    await persistRecharge(row, ingestedAt);
  }
  for (const row of subaccounts) {
    await persistSubaccount(row, ingestedAt);
  }
  return {
    ok: true,
    store: defaultStore || rows[0]?.store || subaccounts[0]?.store || recharges[0]?.store || "",
    source,
    received: rows.length,
    upserted: rows.length,
    subaccounts: subaccounts.length,
    recharges: recharges.length,
    ingestedAt
  };
}

export async function ingestRecharge(body) {
  const payload = Array.isArray(body) ? { recharges: body } : body;
  if (payload == null || typeof payload !== "object") {
    throw httpError(400, "请求体必须是对象");
  }
  return ingestPaid({
    店铺名称: payload.店铺名称 || payload.store,
    store: payload.store,
    date: payload.date || payload.day || payload.日期,
    source: payload.source || payload.来源,
    rows: [],
    recharges: payload.recharges || payload.充值记录 || payload.list || payload.data || []
  });
}

export async function listPaid(query) {
  const parsed = parsePaidRange(query);
  const latest = isLatestView(query);
  await ensurePaidTable();
  const sql = latest ? SQL.listPaidLatest : SQL.listPaid;
  const result = await mysqlQuery(sql, [
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
      .map(mapPaid);
    if (latest) {
      rows = pickLatestPaidRows(rows);
    }
    rows = rows.slice(0, parsed.limit);
  }
  const totals = summarizePaidRows(rows);
  return {
    ok: true,
    view: latest ? "latest" : "history",
    store: parsed.store,
    from: parsed.from,
    to: parsed.to,
    asOf: asOfDay(rows),
    rows,
    totals,
    metrics: paidMetrics(rows, totals)
  };
}

export async function listRecharge(query) {
  const parsed = parsePaidRange(query);
  await ensurePaidTable();
  const result = await mysqlQuery(SQL.listRecharge, [
    parsed.allStores,
    parsed.store,
    parsed.fromDay,
    parsed.toDay,
    parsed.limit
  ]);
  let rows;
  if (result) {
    rows = result[0].map(mapRecharge);
  } else {
    rows = memoryRecharge
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
        return (b.id || 0) - (a.id || 0);
      })
      .slice(0, parsed.limit)
      .map(mapRecharge);
  }
  const amount = rows.reduce((sum, row) => asMoney(sum + (Number(row.amount) || 0), "充值金额"), 0);
  return {
    ok: true,
    store: parsed.store,
    from: parsed.from,
    to: parsed.to,
    rows,
    totals: { amount, count: rows.length }
  };
}

export async function listSubaccounts(query) {
  const parsed = parsePaidRange({ ...query, limit: query?.limit || 2000 });
  await ensurePaidTable();
  const result = await mysqlQuery(SQL.listSubaccount, [
    parsed.allStores,
    parsed.store,
    parsed.fromDay,
    parsed.toDay,
    parsed.limit
  ]);
  let rows;
  if (result) {
    rows = result[0].map(mapSubaccount);
  } else {
    rows = memorySub
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
        return String(a.sub_account_name || "").localeCompare(String(b.sub_account_name || ""), "zh") || a.id - b.id;
      })
      .slice(0, parsed.limit)
      .map(mapSubaccount);
  }
  const accounts = groupSubaccounts(rows);
  const latest = accounts.map((item) => item.latest);
  const totals = {
    spend: latest.reduce((sum, row) => asMoney(sum + (Number(row.spend) || 0), "花费"), 0),
    paidOrders: latest.reduce((sum, row) => sum + (Number(row.paidOrders) || 0), 0),
    totalOrderAmount: latest.reduce((sum, row) => asMoney(sum + (Number(row.totalOrderAmount) || 0), "订单金额"), 0),
    balance: latest.reduce((sum, row) => asMoney(sum + (Number(row.balance) || 0), "余额"), 0),
    count: accounts.length
  };
  return {
    ok: true,
    store: parsed.store,
    from: parsed.from,
    to: parsed.to,
    asOf: asOfDay(rows),
    rows,
    accounts,
    totals
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
