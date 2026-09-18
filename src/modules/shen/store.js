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
  sub_account_id VARCHAR(64) NOT NULL DEFAULT '',
  sub_account_name VARCHAR(128) NOT NULL DEFAULT '',
  day DATE NOT NULL,
  charged_at VARCHAR(40) NOT NULL DEFAULT '',
  amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  balance DECIMAL(14,2) NOT NULL DEFAULT 0,
  channel VARCHAR(64) NOT NULL DEFAULT '',
  remark VARCHAR(200) NOT NULL DEFAULT '',
  source VARCHAR(64) NOT NULL DEFAULT 'local',
  ingested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_shen_paid_recharge (store, day, charged_at, amount),
  KEY idx_shen_paid_recharge_store_day (store, day)
)`,
  widenPaidRechargeChargedAt: `ALTER TABLE shen_paid_recharge MODIFY charged_at VARCHAR(40) NOT NULL DEFAULT ''`,
  addPaidRechargeSubIdColumn: `ALTER TABLE shen_paid_recharge ADD COLUMN sub_account_id VARCHAR(64) NOT NULL DEFAULT ''`,
  addPaidRechargeSubNameColumn: `ALTER TABLE shen_paid_recharge ADD COLUMN sub_account_name VARCHAR(128) NOT NULL DEFAULT ''`,
  upsertRecharge: `INSERT INTO shen_paid_recharge (store, account_id, sub_account_id, sub_account_name, day, charged_at, amount, balance, channel, remark, source, config_version, rule_code, planned_roi, exec_spend, exec_roi, exec_paid_orders, result_flag, execution_id)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
  account_id = VALUES(account_id),
  sub_account_id = VALUES(sub_account_id),
  sub_account_name = VALUES(sub_account_name),
  balance = VALUES(balance),
  channel = VALUES(channel),
  remark = VALUES(remark),
  source = VALUES(source),
  config_version = VALUES(config_version),
  rule_code = VALUES(rule_code),
  planned_roi = VALUES(planned_roi),
  exec_spend = VALUES(exec_spend),
  exec_roi = VALUES(exec_roi),
  exec_paid_orders = VALUES(exec_paid_orders),
  result_flag = VALUES(result_flag),
  execution_id = VALUES(execution_id),
  ingested_at = CURRENT_TIMESTAMP`,
  listRecharge: `SELECT id, store, account_id, sub_account_id, sub_account_name, day, charged_at, amount, balance, channel, remark, source, ingested_at, config_version, rule_code, planned_roi, exec_spend, exec_roi, exec_paid_orders, result_flag, execution_id
FROM shen_paid_recharge
WHERE (? = 1 OR store = ?) AND day >= ? AND day <= ?
ORDER BY day DESC, id DESC
LIMIT ?`,
  addPaidRechargeConfigVersion: `ALTER TABLE shen_paid_recharge ADD COLUMN config_version INT UNSIGNED NOT NULL DEFAULT 0`,
  addPaidRechargeRuleCode: `ALTER TABLE shen_paid_recharge ADD COLUMN rule_code VARCHAR(32) NOT NULL DEFAULT ''`,
  addPaidRechargePlannedRoi: `ALTER TABLE shen_paid_recharge ADD COLUMN planned_roi DECIMAL(12,4) NOT NULL DEFAULT 0`,
  addPaidRechargeExecSpend: `ALTER TABLE shen_paid_recharge ADD COLUMN exec_spend DECIMAL(14,2) NOT NULL DEFAULT 0`,
  addPaidRechargeExecRoi: `ALTER TABLE shen_paid_recharge ADD COLUMN exec_roi DECIMAL(12,4) NOT NULL DEFAULT 0`,
  addPaidRechargeExecOrders: `ALTER TABLE shen_paid_recharge ADD COLUMN exec_paid_orders INT NOT NULL DEFAULT 0`,
  addPaidRechargeResult: `ALTER TABLE shen_paid_recharge ADD COLUMN result_flag VARCHAR(32) NOT NULL DEFAULT ''`,
  addPaidRechargeExecutionId: `ALTER TABLE shen_paid_recharge ADD COLUMN execution_id VARCHAR(64) NULL DEFAULT NULL`,
  addPaidRechargeExecutionUnique: `ALTER TABLE shen_paid_recharge ADD UNIQUE KEY uk_shen_paid_recharge_exec (execution_id)`,
  listSubaccountIdentities: `SELECT s.store, s.account_id, s.sub_account_id, s.sub_account_name
FROM shen_paid_subaccount s
INNER JOIN (
  SELECT store, account_id, sub_account_id, MAX(id) AS id
  FROM shen_paid_subaccount
  GROUP BY store, account_id, sub_account_id
) latest ON latest.id = s.id
ORDER BY s.store ASC, s.sub_account_name ASC, s.sub_account_id ASC`,
  createEnabledStoreTable: `CREATE TABLE IF NOT EXISTS shen_paid_enabled_store (
  store VARCHAR(64) NOT NULL PRIMARY KEY,
  source VARCHAR(64) NOT NULL DEFAULT 'local',
  ingested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)`,
  clearEnabledStores: `DELETE FROM shen_paid_enabled_store`,
  insertEnabledStore: `INSERT INTO shen_paid_enabled_store (store, source) VALUES (?, ?)
ON DUPLICATE KEY UPDATE source = VALUES(source), ingested_at = CURRENT_TIMESTAMP`,
  listEnabledStores: `SELECT store FROM shen_paid_enabled_store ORDER BY store ASC`,
  createSubaccountTable: `CREATE TABLE IF NOT EXISTS shen_paid_subaccount (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  store VARCHAR(64) NOT NULL,
  account_id VARCHAR(64) NOT NULL DEFAULT '',
  sub_account_id VARCHAR(64) NOT NULL,
  sub_account_name VARCHAR(128) NOT NULL DEFAULT '',
  day DATE NOT NULL,
  captured_at VARCHAR(40) NOT NULL DEFAULT '',
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
  UNIQUE KEY uk_shen_paid_subaccount (day, account_id, sub_account_id, captured_at),
  KEY idx_shen_paid_sub_store_day (store, day)
)`,
  addPaidSubCapturedAtColumn: `ALTER TABLE shen_paid_subaccount ADD COLUMN captured_at VARCHAR(40) NOT NULL DEFAULT ''`,
  dropPaidSubUnique: `ALTER TABLE shen_paid_subaccount DROP INDEX uk_shen_paid_subaccount`,
  addPaidSubUniqueWithCaptured: `ALTER TABLE shen_paid_subaccount ADD UNIQUE KEY uk_shen_paid_subaccount (day, account_id, sub_account_id, captured_at)`,
  upsertSubaccount: `INSERT INTO shen_paid_subaccount (store, account_id, sub_account_id, sub_account_name, day, captured_at, balance, remark, spend, roi, paid_orders, total_order_amount, clicks, impressions, ctr, cpc, cpm, source)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
  listSubaccount: `SELECT id, store, account_id, sub_account_id, sub_account_name, day, captured_at, balance, remark, spend, roi, paid_orders, total_order_amount, clicks, impressions, ctr, cpc, cpm, source, ingested_at
FROM shen_paid_subaccount
WHERE (? = 1 OR store = ?) AND day >= ? AND day <= ?
ORDER BY day DESC, captured_at DESC, id DESC
LIMIT ?`
};

const MAX_PAID_ROWS = 2000;
const MAX_PAID_LIST = 1000;
const MAX_ENABLED_STORES = 200;

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
let memoryEnabled = [];

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

function isIgnorableSchemaError(err) {
  if (isDuplicateColumnError(err)) {
    return true;
  }
  const code = err?.code || err?.errno;
  const message = String(err?.message || "");
  return (
    code === "ER_CANT_DROP_FIELD_OR_KEY" ||
    code === 1091 ||
    code === "ER_DUP_KEYNAME" ||
    code === 1061 ||
    /can't drop/i.test(message) ||
    /duplicate key name/i.test(message)
  );
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

function shanghaiDay(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
  }
  const text = String(value ?? "").trim();
  if (DATE_RE.test(text)) {
    return text;
  }
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
  }
  const day = text.slice(0, 10);
  return DATE_RE.test(day) ? day : "";
}

function asDay(value, label = "date") {
  const day = shanghaiDay(value);
  if (!DATE_RE.test(day)) {
    throw httpError(400, `${label} 必须是 YYYY-MM-DD`);
  }
  return day;
}

function mapDay(value) {
  const day = shanghaiDay(value);
  return DATE_RE.test(day) ? day : "";
}

function shanghaiDateTime(value) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(value);
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}+08:00`;
}

function normalizeChargedAt(value) {
  const text = String(value ?? "").trim();
  if (!text) {
    return "";
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return clipText(text, 40, "充值时间");
  }
  return clipText(shanghaiDateTime(parsed), 40, "充值时间");
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
  if (["1", "true", "yes", "y", "ok", "成功", "是", "采集成功"].includes(key)) {
    return "是";
  }
  if (["0", "false", "no", "n", "失败", "否", "采集失败"].includes(key)) {
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
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  for (const key of keys) {
    if (raw[key] != null && raw[key] !== "") {
      return raw[key];
    }
  }
  return undefined;
}

function compactKey(value) {
  return String(value ?? "").replace(/\s+/g, "");
}

function pickLooseField(raw, keys, accept) {
  const direct = pickField(raw, keys);
  if (direct != null && direct !== "") {
    return direct;
  }
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  for (const [key, value] of Object.entries(raw)) {
    if (value == null || value === "") {
      continue;
    }
    const compact = compactKey(key);
    if (keys.some((item) => compactKey(item) === compact) || (accept && accept(compact))) {
      return value;
    }
  }
  return undefined;
}

function isMainAccountKey(compact) {
  return /主账户|主帐号|jztAccountId|^accountId$/i.test(compact);
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
  return `${row.day}\t${row.account_id || row.accountId || ""}\t${row.sub_account_id || row.subAccountId || ""}\t${
    row.captured_at || row.capturedAt || ""
  }`;
}

function isLatestView(query) {
  const view = String(query?.view ?? "").trim().toLowerCase();
  const latest = String(query?.latest ?? "").trim();
  return view === "latest" || latest === "1" || latest === "true";
}

function isAllStoreScope(query) {
  const scope = String(query?.scope ?? "").trim().toLowerCase();
  const enabled = String(query?.enabled ?? "").trim().toLowerCase();
  return scope === "all" || scope === "history" || enabled === "0" || enabled === "false";
}

function parseEnabledStores(payload) {
  const keys = ["启用店铺", "enabledStores", "启用店铺名单", "店铺名单"];
  let raw;
  let found = false;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      raw = payload[key];
      found = true;
      break;
    }
  }
  if (!found) {
    return null;
  }
  if (!Array.isArray(raw)) {
    throw httpError(400, "启用店铺必须是字符串数组");
  }
  if (raw.length > MAX_ENABLED_STORES) {
    throw httpError(400, `启用店铺一次最多 ${MAX_ENABLED_STORES} 家`);
  }
  const names = [];
  const seen = new Set();
  for (const item of raw) {
    const name = clipText(
      item && typeof item === "object" && !Array.isArray(item)
        ? pickField(item, ["店铺名称", "store", "店铺名", "店铺"])
        : item,
      64,
      "启用店铺"
    );
    if (!name || seen.has(name)) {
      continue;
    }
    seen.add(name);
    names.push(name);
  }
  return names;
}

async function loadEnabledStoreNames() {
  const result = await mysqlQuery(SQL.listEnabledStores);
  if (result) {
    return result[0].map((row) => String(row.store || "").trim()).filter(Boolean);
  }
  return [...memoryEnabled];
}

async function replaceEnabledStores(names, source) {
  const result = await mysqlQuery(SQL.clearEnabledStores);
  if (result) {
    for (const name of names) {
      await mysqlQuery(SQL.insertEnabledStore, [name, source]);
    }
    return names;
  }
  memoryEnabled = [...names];
  return names;
}

const HIDDEN_PAID_OVERVIEW_STORES = new Set(["RASW潮流生活京选菀瑶专卖店"]);

function applyEnabledStoreFilter(rows, roster, { store, allScope }) {
  if (store || allScope || !roster.length) {
    return rows;
  }
  const allow = new Set(roster);
  return rows.filter((row) => allow.has(row.store));
}

function applyHiddenOverviewStores(rows, { store }) {
  if (store) {
    return rows;
  }
  return rows.filter((row) => !HIDDEN_PAID_OVERVIEW_STORES.has(row.store));
}

function applyLatestAsOfFilter(rows, { store, latest }) {
  if (!latest || store || !rows.length) {
    return rows;
  }
  const asOf = asOfDay(rows);
  return rows.filter((row) => row.date === asOf);
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
  const day = mapDay(row.day);
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
    success: asSuccess(row.success_flag || row.success || ""),
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
  const day = mapDay(row.day);
  return {
    id: Number(row.id),
    store: row.store || "",
    accountId: row.account_id || row.accountId || "",
    subAccountId: row.sub_account_id || row.subAccountId || "",
    subAccountName: row.sub_account_name || row.subAccountName || "",
    date: day,
    chargedAt: row.charged_at || row.chargedAt || "",
    amount: Number(row.amount) || 0,
    balance: Number(row.balance) || 0,
    channel: row.channel || "",
    remark: row.remark || "",
    source: row.source || "local",
    ingestedAt: row.ingested_at || row.ingestedAt || "",
    configVersion: Number(row.config_version ?? row.configVersion) || 0,
    ruleCode: row.rule_code || row.ruleCode || "",
    plannedRoi: Number(row.planned_roi ?? row.plannedRoi) || 0,
    execSpend: Number(row.exec_spend ?? row.execSpend) || 0,
    execRoi: Number(row.exec_roi ?? row.execRoi) || 0,
    execPaidOrders: Number(row.exec_paid_orders ?? row.execPaidOrders) || 0,
    result: row.result_flag || row.result || "",
    executionId: row.execution_id || row.executionId || ""
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
  const chargedAt = normalizeChargedAt(pickField(raw, ["充值时间", "chargedAt", "time"]) || "");
  const chargedDay = chargedAt ? shanghaiDay(chargedAt) : "";
  const dayRaw =
    (DATE_RE.test(chargedDay) ? chargedDay : "") ||
    pickField(raw, ["date", "day", "日期", "充值日期"]) ||
    defaultDay ||
    todayDay();
  return {
    store,
    accountId: clipText(pickField(raw, ["京准通主账户ID", "accountId", "jztAccountId"]), 64, "京准通主账户ID"),
    subAccountId: clipText(
      pickLooseField(raw, ["子账号ID", "子帐号ID", "子账户ID", "充值子账号ID", "目标子账号ID", "subAccountId", "subId"], (key) => {
        return !isMainAccountKey(key) && /^(子账号|子帐号|子账户)ID$|^subAccountId$|^subId$/i.test(key);
      }),
      64,
      "子账号ID"
    ),
    subAccountName: clipText(
      pickLooseField(
        raw,
        ["子账号名称", "子帐号名称", "子账户名称", "充值子账号名称", "目标子账号名称", "subAccountName"],
        (key) => !isMainAccountKey(key) && /^(子账号|子帐号|子账户)名称$|^subAccountName$/i.test(key)
      ),
      128,
      "子账号名称"
    ),
    day: asDay(dayRaw, "date"),
    chargedAt,
    amount: asMoney(pickField(raw, ["充值金额", "amount", "金额"]), "充值金额"),
    balance: asMoney(pickField(raw, ["账户余额", "balance", "余额"]), "账户余额"),
    channel: clipText(pickField(raw, ["渠道", "channel"]) || "", 64, "渠道"),
    remark: clipText(pickField(raw, ["备注", "remark", "说明"]) || "", 200, "备注"),
    source: clipText(pickField(raw, ["source", "来源"]) || source, 64, "来源") || "local",
    configVersion: asCount(pickField(raw, ["configVersion", "配置版本"]) || 0, "配置版本"),
    ruleCode: clipText(pickField(raw, ["ruleCode", "命中规则", "规则"]) || "", 32, "命中规则"),
    plannedRoi: asRate(pickField(raw, ["plannedRoi", "当时计划ROI", "计划ROI"]) || 0, "当时计划ROI"),
    execSpend: asMoney(pickField(raw, ["execSpend", "当时花费", "京准通花费"]) || 0, "当时花费"),
    execRoi: asRate(pickField(raw, ["execRoi", "当时ROI", "京准通付费投产比"]) || 0, "当时ROI"),
    execPaidOrders: asCount(pickField(raw, ["execPaidOrders", "当时单量", "京准通付费订单数"]) || 0, "当时单量"),
    result: clipText(pickField(raw, ["result", "执行结果", "resultFlag"]) || "", 32, "执行结果"),
    executionId: asExecutionId(pickField(raw, ["executionId", "执行编号", "唯一执行编号"]))
  };
}

function asExecutionId(value) {
  if (value == null || value === "") {
    return "";
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      throw httpError(400, "executionId 必须是字符串，不能用科学计数法");
    }
    return String(value);
  }
  const text = String(value).trim();
  if (/^[+-]?\d+(\.\d+)?[eE][+-]?\d+$/.test(text)) {
    throw httpError(400, "executionId 不能使用科学计数法");
  }
  return clipText(text, 64, "executionId");
}

function mapSubaccount(row) {
  const day = mapDay(row.day);
  return {
    id: Number(row.id),
    store: row.store || "",
    accountId: row.account_id || row.accountId || "",
    subAccountId: row.sub_account_id || row.subAccountId || "",
    subAccountName: row.sub_account_name || row.subAccountName || "",
    date: day,
    capturedAt: row.captured_at || row.capturedAt || "",
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

function parseSubaccountRow(raw, defaultStore, defaultAccountId, defaultDay, source, defaultCaptured) {
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
  const capturedAt =
    normalizeChargedAt(pickField(raw, ["抓取时间", "capturedAt", "采集时间", "scrapeAt"]) || "") ||
    defaultCaptured ||
    shanghaiDateTime(new Date());
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
    capturedAt,
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
          抓取时间: item.抓取时间 || item.capturedAt || row.抓取时间 || row.capturedAt,
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
    const newer =
      row.date > group.latest.date ||
      (row.date === group.latest.date &&
        (row.capturedAt || "") > (group.latest.capturedAt || "")) ||
      (row.date === group.latest.date &&
        (row.capturedAt || "") === (group.latest.capturedAt || "") &&
        row.id > group.latest.id);
    if (newer) {
      group.latest = row;
      group.subAccountName = row.subAccountName || group.subAccountName;
    }
  }
  const accounts = [...byId.values()].map((group) => {
    group.days.sort((a, b) => {
      if (a.date !== b.date) {
        return a.date < b.date ? 1 : -1;
      }
      if ((a.capturedAt || "") !== (b.capturedAt || "")) {
        return (a.capturedAt || "") < (b.capturedAt || "") ? 1 : -1;
      }
      return b.id - a.id;
    });
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
  const executionId = row.executionId || null;
  const result = await mysqlQuery(SQL.upsertRecharge, [
    row.store,
    row.accountId,
    row.subAccountId,
    row.subAccountName,
    row.day,
    row.chargedAt,
    row.amount,
    row.balance,
    row.channel,
    row.remark,
    row.source,
    row.configVersion || 0,
    row.ruleCode || "",
    row.plannedRoi || 0,
    row.execSpend || 0,
    row.execRoi || 0,
    row.execPaidOrders || 0,
    row.result || "",
    executionId
  ]);
  if (result) {
    return;
  }
  const mapped = {
    id: nextRechargeId,
    store: row.store,
    account_id: row.accountId,
    sub_account_id: row.subAccountId,
    sub_account_name: row.subAccountName,
    day: row.day,
    charged_at: row.chargedAt,
    amount: row.amount,
    balance: row.balance,
    channel: row.channel,
    remark: row.remark,
    source: row.source,
    ingested_at: ingestedAt,
    config_version: row.configVersion || 0,
    rule_code: row.ruleCode || "",
    planned_roi: row.plannedRoi || 0,
    exec_spend: row.execSpend || 0,
    exec_roi: row.execRoi || 0,
    exec_paid_orders: row.execPaidOrders || 0,
    result_flag: row.result || "",
    execution_id: row.executionId || ""
  };
  const byExec = mapped.execution_id
    ? memoryRecharge.findIndex((item) => item.execution_id && item.execution_id === mapped.execution_id)
    : -1;
  const existing = byExec >= 0 ? byExec : memoryRecharge.findIndex((item) => rechargeKey(item) === rechargeKey(mapped));
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
    row.capturedAt,
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
    captured_at: row.capturedAt,
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
    SQL.widenPaidRechargeChargedAt,
    SQL.addPaidRechargeSubIdColumn,
    SQL.addPaidRechargeSubNameColumn,
    SQL.createSubaccountTable,
    SQL.addPaidSubCapturedAtColumn,
    SQL.dropPaidSubUnique,
    SQL.addPaidSubUniqueWithCaptured,
    SQL.createEnabledStoreTable,
    SQL.addPaidRechargeConfigVersion,
    SQL.addPaidRechargeRuleCode,
    SQL.addPaidRechargePlannedRoi,
    SQL.addPaidRechargeExecSpend,
    SQL.addPaidRechargeExecRoi,
    SQL.addPaidRechargeExecOrders,
    SQL.addPaidRechargeResult,
    SQL.addPaidRechargeExecutionId,
    SQL.addPaidRechargeExecutionUnique
  ]) {
    try {
      await mysqlQuery(sql);
    } catch (err) {
      if (!isIgnorableSchemaError(err)) {
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
  memoryEnabled = [];
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
  const enabledStores = parseEnabledStores(payload);
  if (incoming.length === 0 && rechargeRaws.length === 0 && subRaws.length === 0 && enabledStores == null) {
    throw httpError(400, "rows、子账号、充值记录或启用店铺必填");
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
  const now = new Date();
  const batchCaptured =
    normalizeChargedAt(pickField(payload, ["抓取时间", "capturedAt", "采集时间"]) || "") ||
    `${shanghaiDateTime(now).replace("+08:00", "")}.${String(now.getMilliseconds()).padStart(3, "0")}+08:00`;
  const recharges = rechargeRaws.map((row) => parseRechargeRow(row, defaultStore || rows[0]?.store, defaultDay, source));
  const subaccounts = subRaws.map((row) =>
    parseSubaccountRow(row, defaultStore || rows[0]?.store, defaultAccountId, defaultDay, source, batchCaptured)
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
  if (enabledStores) {
    await replaceEnabledStores(enabledStores, source);
  }
  const roster = enabledStores || (await loadEnabledStoreNames());
  const counts = {
    rows: rows.length,
    subaccounts: subaccounts.length,
    recharges: recharges.length,
    enabledStores: enabledStores ? enabledStores.length : 0
  };
  return {
    ok: true,
    store: defaultStore || rows[0]?.store || subaccounts[0]?.store || recharges[0]?.store || "",
    source,
    received: counts,
    upserted: counts,
    enabledStores: roster,
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
  const roster = await loadEnabledStoreNames();
  const allScope = isAllStoreScope(query);
  rows = applyEnabledStoreFilter(rows, roster, { store: parsed.store, allScope });
  rows = applyHiddenOverviewStores(rows, { store: parsed.store });
  rows = applyLatestAsOfFilter(rows, { store: parsed.store, latest });
  const totals = summarizePaidRows(rows);
  return {
    ok: true,
    view: latest ? "latest" : "history",
    scope: parsed.store ? "store" : allScope || !roster.length ? "all" : "enabled",
    store: parsed.store,
    from: parsed.from,
    to: parsed.to,
    asOf: asOfDay(rows),
    enabledStores: roster,
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
  const roster = await loadEnabledStoreNames();
  const allScope = isAllStoreScope(query);
  if (!parsed.store && roster.length && !allScope) {
    const listed = await listPaid({ ...query, limit: MAX_PAID_LIST, view: query?.view, latest: query?.latest });
    return {
      ok: true,
      store: parsed.store,
      from: parsed.from,
      to: parsed.to,
      scope: "enabled",
      enabledStores: roster,
      paid: listed.totals
    };
  }
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
    scope: parsed.store ? "store" : "all",
    enabledStores: roster,
    paid: totals
  };
}

export async function listLatestSubIdentities() {
  await ensurePaidTable();
  const result = await mysqlQuery(SQL.listSubaccountIdentities);
  if (result) {
    return result[0].map((row) => ({
      store: row.store || "",
      accountId: String(row.account_id || row.accountId || ""),
      subAccountId: String(row.sub_account_id || row.subAccountId || ""),
      subAccountName: row.sub_account_name || row.subAccountName || ""
    }));
  }
  const latest = new Map();
  for (const row of memorySub) {
    const key = `${row.store}\t${row.account_id}\t${row.sub_account_id}`;
    const prev = latest.get(key);
    if (!prev || Number(row.id) > Number(prev.id)) {
      latest.set(key, row);
    }
  }
  return [...latest.values()]
    .sort((a, b) => a.store.localeCompare(b.store, "zh") || String(a.sub_account_name).localeCompare(String(b.sub_account_name), "zh"))
    .map((row) => ({
      store: row.store || "",
      accountId: String(row.account_id || ""),
      subAccountId: String(row.sub_account_id || ""),
      subAccountName: row.sub_account_name || ""
    }));
}

export function queryShen(sql, params = []) {
  return mysqlQuery(sql, params);
}

export function shenHttpError(statusCode, message) {
  return httpError(statusCode, message);
}

export function nowShanghai() {
  return shanghaiDateTime(new Date());
}

export { STATUSES, DEFAULT_OWNER, MAX_PAID_ROWS };
