import { listLatestSubIdentities, nowShanghai, queryShen, shenHttpError } from "./store.js";

export const DEFAULT_RECHARGE_RULE = {
  autoRecharge: true,
  plannedRoi: 2,
  tier1MinSpend: 1,
  tier1MaxSpend: 1000,
  tier1Balance: 100,
  tier1Amount: 100,
  tier2MinSpend: 1000,
  tier2Balance: 50,
  tier2Amount: 150,
  roiRiseAmount: 100,
  noOrderTimes: 3,
  pauseMinutes: 30,
  shopEnabled: true
};

export const RULE_FIELDS = [
  ["autoRecharge", "自动充值"],
  ["plannedRoi", "计划ROI"],
  ["tier1MinSpend", "第一档花费下限"],
  ["tier1MaxSpend", "第一档花费上限"],
  ["tier1Balance", "第一档余额阈值"],
  ["tier1Amount", "第一档充值金额"],
  ["tier2MinSpend", "第二档花费下限"],
  ["tier2Balance", "第二档余额阈值"],
  ["tier2Amount", "第二档充值金额"],
  ["roiRiseAmount", "ROI上涨充值金额"],
  ["noOrderTimes", "连续充值未增单次数"],
  ["pauseMinutes", "暂停分钟数"],
  ["shopEnabled", "店铺启用"]
];

export const RULE_SQL = {
  createRuleTable: `CREATE TABLE IF NOT EXISTS shen_paid_recharge_rule (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  store VARCHAR(64) NOT NULL,
  account_id VARCHAR(64) NOT NULL DEFAULT '',
  sub_account_id VARCHAR(64) NOT NULL,
  sub_account_name VARCHAR(128) NOT NULL DEFAULT '',
  shop_enabled TINYINT NOT NULL DEFAULT 1,
  auto_recharge TINYINT NOT NULL DEFAULT 1,
  planned_roi DECIMAL(12,4) NOT NULL DEFAULT 0,
  tier1_min DECIMAL(14,2) NOT NULL DEFAULT 1,
  tier1_max DECIMAL(14,2) NOT NULL DEFAULT 1000,
  tier1_balance DECIMAL(14,2) NOT NULL DEFAULT 100,
  tier1_amount DECIMAL(14,2) NOT NULL DEFAULT 100,
  tier2_min DECIMAL(14,2) NOT NULL DEFAULT 1000,
  tier2_balance DECIMAL(14,2) NOT NULL DEFAULT 50,
  tier2_amount DECIMAL(14,2) NOT NULL DEFAULT 150,
  roi_rise_amount DECIMAL(14,2) NOT NULL DEFAULT 100,
  no_order_times INT NOT NULL DEFAULT 3,
  pause_minutes INT NOT NULL DEFAULT 30,
  version INT UNSIGNED NOT NULL DEFAULT 0,
  updated_by VARCHAR(64) NOT NULL DEFAULT '',
  updated_at VARCHAR(40) NOT NULL DEFAULT '',
  UNIQUE KEY uk_shen_paid_recharge_rule (store, account_id, sub_account_id)
)`,
  createMetaTable: `CREATE TABLE IF NOT EXISTS shen_paid_recharge_rule_meta (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  version INT UNSIGNED NOT NULL DEFAULT 0,
  updated_by VARCHAR(64) NOT NULL DEFAULT '',
  updated_at VARCHAR(40) NOT NULL DEFAULT '',
  change_summary VARCHAR(200) NOT NULL DEFAULT ''
)`,
  createHistoryTable: `CREATE TABLE IF NOT EXISTS shen_paid_recharge_rule_history (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  version INT UNSIGNED NOT NULL,
  store VARCHAR(64) NOT NULL,
  account_id VARCHAR(64) NOT NULL DEFAULT '',
  sub_account_id VARCHAR(64) NOT NULL DEFAULT '',
  field_name VARCHAR(64) NOT NULL,
  old_value VARCHAR(128) NOT NULL DEFAULT '',
  new_value VARCHAR(128) NOT NULL DEFAULT '',
  updated_by VARCHAR(64) NOT NULL DEFAULT '',
  updated_at VARCHAR(40) NOT NULL DEFAULT '',
  change_summary VARCHAR(200) NOT NULL DEFAULT '',
  KEY idx_shen_rule_hist_store (store, sub_account_id, version)
)`,
  createOwnerTable: `CREATE TABLE IF NOT EXISTS shen_paid_store_owner (
  username VARCHAR(64) NOT NULL,
  store VARCHAR(64) NOT NULL,
  PRIMARY KEY (username, store)
)`,
  createMachineTable: `CREATE TABLE IF NOT EXISTS shen_paid_recharge_machine (
  machine_id VARCHAR(64) NOT NULL PRIMARY KEY,
  username VARCHAR(64) NOT NULL DEFAULT '',
  role VARCHAR(64) NOT NULL DEFAULT '',
  data_scope VARCHAR(64) NOT NULL DEFAULT '',
  last_version INT UNSIGNED NOT NULL DEFAULT 0,
  status VARCHAR(16) NOT NULL DEFAULT '',
  message VARCHAR(200) NOT NULL DEFAULT '',
  received_at VARCHAR(40) NOT NULL DEFAULT '',
  synced_at VARCHAR(40) NOT NULL DEFAULT ''
)`,
  addMachineRole: `ALTER TABLE shen_paid_recharge_machine ADD COLUMN role VARCHAR(64) NOT NULL DEFAULT ''`,
  addMachineScope: `ALTER TABLE shen_paid_recharge_machine ADD COLUMN data_scope VARCHAR(64) NOT NULL DEFAULT ''`,
  listRules: `SELECT store, account_id, sub_account_id, sub_account_name, shop_enabled, auto_recharge, planned_roi, tier1_min, tier1_max, tier1_balance, tier1_amount, tier2_min, tier2_balance, tier2_amount, roi_rise_amount, no_order_times, pause_minutes, version, updated_by, updated_at
FROM shen_paid_recharge_rule`,
  upsertRule: `INSERT INTO shen_paid_recharge_rule (store, account_id, sub_account_id, sub_account_name, shop_enabled, auto_recharge, planned_roi, tier1_min, tier1_max, tier1_balance, tier1_amount, tier2_min, tier2_balance, tier2_amount, roi_rise_amount, no_order_times, pause_minutes, version, updated_by, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
  sub_account_name = VALUES(sub_account_name),
  shop_enabled = VALUES(shop_enabled),
  auto_recharge = VALUES(auto_recharge),
  planned_roi = VALUES(planned_roi),
  tier1_min = VALUES(tier1_min),
  tier1_max = VALUES(tier1_max),
  tier1_balance = VALUES(tier1_balance),
  tier1_amount = VALUES(tier1_amount),
  tier2_min = VALUES(tier2_min),
  tier2_balance = VALUES(tier2_balance),
  tier2_amount = VALUES(tier2_amount),
  roi_rise_amount = VALUES(roi_rise_amount),
  no_order_times = VALUES(no_order_times),
  pause_minutes = VALUES(pause_minutes),
  version = VALUES(version),
  updated_by = VALUES(updated_by),
  updated_at = VALUES(updated_at)`,
  getMeta: `SELECT version, updated_by, updated_at, change_summary FROM shen_paid_recharge_rule_meta WHERE id = 1`,
  upsertMeta: `INSERT INTO shen_paid_recharge_rule_meta (id, version, updated_by, updated_at, change_summary)
VALUES (1, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE version = VALUES(version), updated_by = VALUES(updated_by), updated_at = VALUES(updated_at), change_summary = VALUES(change_summary)`,
  insertHistory: `INSERT INTO shen_paid_recharge_rule_history (version, store, account_id, sub_account_id, field_name, old_value, new_value, updated_by, updated_at, change_summary)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  listHistory: `SELECT version, store, account_id, sub_account_id, field_name, old_value, new_value, updated_by, updated_at, change_summary
FROM shen_paid_recharge_rule_history
WHERE (? = 1 OR store = ?) AND (? = 1 OR sub_account_id = ?)
ORDER BY id DESC
LIMIT ?`,
  listOwners: `SELECT username, store FROM shen_paid_store_owner`,
  clearOwners: `DELETE FROM shen_paid_store_owner WHERE username = ?`,
  insertOwner: `INSERT INTO shen_paid_store_owner (username, store) VALUES (?, ?)
ON DUPLICATE KEY UPDATE store = VALUES(store)`,
  getMachine: `SELECT machine_id, username, role, data_scope, last_version, status, message, received_at, synced_at FROM shen_paid_recharge_machine WHERE machine_id = ?`,
  listMachines: `SELECT machine_id, username, role, data_scope, last_version, status, message, received_at, synced_at FROM shen_paid_recharge_machine`,
  upsertMachine: `INSERT INTO shen_paid_recharge_machine (machine_id, username, role, data_scope, last_version, status, message, received_at, synced_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
  username = VALUES(username),
  role = VALUES(role),
  data_scope = VALUES(data_scope),
  last_version = VALUES(last_version),
  status = VALUES(status),
  message = VALUES(message),
  received_at = VALUES(received_at),
  synced_at = VALUES(synced_at)`,
  createShopRunTable: `CREATE TABLE IF NOT EXISTS shen_paid_recharge_shop_run (
  store VARCHAR(64) NOT NULL PRIMARY KEY,
  run_enabled TINYINT NOT NULL DEFAULT 0,
  machine_id VARCHAR(64) NOT NULL DEFAULT '',
  updated_by VARCHAR(64) NOT NULL DEFAULT '',
  updated_at VARCHAR(40) NOT NULL DEFAULT ''
)`,
  listShopRuns: `SELECT store, run_enabled, machine_id, updated_by, updated_at FROM shen_paid_recharge_shop_run`,
  upsertShopRun: `INSERT INTO shen_paid_recharge_shop_run (store, run_enabled, machine_id, updated_by, updated_at)
VALUES (?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
  run_enabled = VALUES(run_enabled),
  machine_id = VALUES(machine_id),
  updated_by = VALUES(updated_by),
  updated_at = VALUES(updated_at)`
};

let memoryRules = [];
let memoryMeta = { version: 0, updatedBy: "", updatedAt: "", changeSummary: "" };
let memoryHistory = [];
let memoryOwners = [];
let memoryMachines = [];
let memoryShopRuns = [];
let nextHistoryId = 1;

export function resetRechargeConfig() {
  memoryRules = [];
  memoryMeta = { version: 0, updatedBy: "", updatedAt: "", changeSummary: "" };
  memoryHistory = [];
  memoryOwners = [];
  memoryMachines = [];
  memoryShopRuns = [];
  nextHistoryId = 1;
}

export async function ensureRechargeConfigTables() {
  for (const sql of [
    RULE_SQL.createRuleTable,
    RULE_SQL.createMetaTable,
    RULE_SQL.createHistoryTable,
    RULE_SQL.createOwnerTable,
    RULE_SQL.createMachineTable,
    RULE_SQL.addMachineRole,
    RULE_SQL.addMachineScope,
    RULE_SQL.createShopRunTable
  ]) {
    try {
      await queryShen(sql);
    } catch (err) {
      const code = err?.code || err?.errno;
      const message = String(err?.message || "");
      if (
        code !== "ER_TABLE_EXISTS_ERROR" &&
        code !== 1050 &&
        code !== "ER_DUP_FIELDNAME" &&
        code !== 1060 &&
        !/duplicate column/i.test(message)
      ) {
        throw err;
      }
    }
  }
}

function decodeHeader(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

export function resolveActor(req) {
  const user = req?.user || req?.authUser || req?.session?.user || {};
  const headerUser = decodeHeader(req?.get?.("x-shen-user"));
  const headerRole = decodeHeader(req?.get?.("x-shen-role"));
  const headerScope = decodeHeader(req?.get?.("x-shen-scope"));
  const username = String(user.username || user.displayName || headerUser || "").trim();
  const role = String(user.role || headerRole || "").trim();
  const dataScope = String(user.dataScope || headerScope || "").trim();
  return {
    username,
    displayName: String(user.displayName || username || "").trim(),
    role,
    dataScope
  };
}

export function isAllScope(actor) {
  const role = actor?.role || "";
  const scope = actor?.dataScope || "";
  return role.includes("超级管理员") || scope.includes("全平台");
}

function clip(value, max, label) {
  const text = String(value ?? "").trim();
  if (text.length > max) {
    throw shenHttpError(400, `${label}不能超过 ${max} 个字`);
  }
  return text;
}

export function asIdString(value, label) {
  if (value == null || value === "") {
    return "";
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw shenHttpError(400, `${label}必须是字符串，不能转成浮点数或科学计数法`);
    }
    return String(value);
  }
  const text = String(value).trim();
  if (/[eE]/.test(text) || text.includes(".")) {
    throw shenHttpError(400, `${label}必须是字符串数字，不能带小数或科学计数法`);
  }
  return clip(text, 64, label);
}

function asNonNegNumber(value, label, { integer = false, fallback = 0 } = {}) {
  if (value == null || value === "") {
    return fallback;
  }
  const number = typeof value === "number" ? value : Number(String(value).trim().replace(/,/g, ""));
  if (!Number.isFinite(number)) {
    throw shenHttpError(400, `${label}必须是数字`);
  }
  if (number < 0) {
    throw shenHttpError(400, `${label}不能为负数`);
  }
  return integer ? Math.round(number) : Math.round(number * 10000) / 10000;
}

function asMoneyField(value, label, fallback = 0) {
  return Math.round(asNonNegNumber(value, label, { fallback }) * 100) / 100;
}

function pick(raw, keys) {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(raw, key) && raw[key] !== undefined) {
      return raw[key];
    }
  }
  return undefined;
}

function asBool(value, fallback = true) {
  if (value == null || value === "") {
    return fallback;
  }
  if (value === true || value === 1 || value === "1" || value === "是" || value === "true") {
    return true;
  }
  if (value === false || value === 0 || value === "0" || value === "否" || value === "false") {
    return false;
  }
  return Boolean(value);
}

function mapRule(row) {
  return {
    store: row.store || "",
    accountId: String(row.account_id || row.accountId || ""),
    subAccountId: String(row.sub_account_id || row.subAccountId || ""),
    subAccountName: row.sub_account_name || row.subAccountName || "",
    shopEnabled: Number(row.shop_enabled ?? row.shopEnabled ?? 1) === 1,
    autoRecharge: Number(row.auto_recharge ?? row.autoRecharge ?? 1) === 1,
    plannedRoi: Number(row.planned_roi ?? row.plannedRoi) || 0,
    tier1MinSpend: Number(row.tier1_min ?? row.tier1MinSpend) || 0,
    tier1MaxSpend: Number(row.tier1_max ?? row.tier1MaxSpend) || 0,
    tier1Balance: Number(row.tier1_balance ?? row.tier1Balance) || 0,
    tier1Amount: Number(row.tier1_amount ?? row.tier1Amount) || 0,
    tier2MinSpend: Number(row.tier2_min ?? row.tier2MinSpend) || 0,
    tier2Balance: Number(row.tier2_balance ?? row.tier2Balance) || 0,
    tier2Amount: Number(row.tier2_amount ?? row.tier2Amount) || 0,
    roiRiseAmount: Number(row.roi_rise_amount ?? row.roiRiseAmount) || 0,
    noOrderTimes: Number(row.no_order_times ?? row.noOrderTimes) || 0,
    pauseMinutes: Number(row.pause_minutes ?? row.pauseMinutes) || 0,
    version: Number(row.version) || 0,
    updatedBy: row.updated_by || row.updatedBy || "",
    updatedAt: row.updated_at || row.updatedAt || ""
  };
}

function ruleKey(row) {
  return `${row.store}\t${row.accountId}\t${row.subAccountId}`;
}

function applyDefault(base = {}) {
  return {
    ...DEFAULT_RECHARGE_RULE,
    ...base,
    shopEnabled: base.shopEnabled ?? DEFAULT_RECHARGE_RULE.shopEnabled,
    autoRecharge: base.autoRecharge ?? DEFAULT_RECHARGE_RULE.autoRecharge
  };
}

function validateRule(rule) {
  if (rule.tier1MaxSpend <= rule.tier1MinSpend) {
    throw shenHttpError(400, "第一档花费上限必须大于第一档下限");
  }
  if (rule.tier2MinSpend < rule.tier1MaxSpend) {
    throw shenHttpError(400, "第二档花费下限不能小于第一档花费上限");
  }
  if (rule.autoRecharge && !(Number(rule.plannedRoi) > 0)) {
    throw shenHttpError(400, "自动充值账号的计划ROI必须大于0");
  }
  return rule;
}

function parseRulePatch(raw, current) {
  const next = applyDefault(current);
  next.store = clip(pick(raw, ["店铺名称", "store"]) ?? next.store, 64, "店铺名称");
  next.accountId = asIdString(pick(raw, ["京准通主账户ID", "accountId"]) ?? next.accountId, "京准通主账户ID");
  next.subAccountId = asIdString(pick(raw, ["子账号ID", "subAccountId"]) ?? next.subAccountId, "子账号ID");
  next.subAccountName = clip(pick(raw, ["子账号名称", "subAccountName"]) ?? next.subAccountName, 128, "子账号名称");
  if (!next.store || !next.subAccountId) {
    throw shenHttpError(400, "必须指定店铺名称和子账号ID");
  }
  const patch = String(pick(raw, ["patch", "只改"]) || "").toLowerCase();
  if (pick(raw, ["计划ROI", "plannedRoi"]) !== undefined) {
    next.plannedRoi = asNonNegNumber(pick(raw, ["计划ROI", "plannedRoi"]), "计划ROI");
  }
  if (patch === "roi" || patch === "plannedroi") {
    return validateRule(next);
  }
  if (pick(raw, ["自动充值", "autoRecharge"]) !== undefined) {
    next.autoRecharge = asBool(pick(raw, ["自动充值", "autoRecharge"]), next.autoRecharge);
  }
  if (patch === "auto" || patch === "自动充值") {
    return validateRule(next);
  }
  if (pick(raw, ["启用", "shopEnabled", "店铺启用"]) !== undefined) {
    next.shopEnabled = asBool(pick(raw, ["启用", "shopEnabled", "店铺启用"]), next.shopEnabled);
  }
  next.tier1MinSpend = asMoneyField(pick(raw, ["第一档花费下限", "tier1MinSpend"]) ?? next.tier1MinSpend, "第一档花费下限", 1);
  next.tier1MaxSpend = asMoneyField(pick(raw, ["第一档花费上限", "tier1MaxSpend"]) ?? next.tier1MaxSpend, "第一档花费上限", 1000);
  next.tier1Balance = asMoneyField(pick(raw, ["第一档余额阈值", "tier1Balance"]) ?? next.tier1Balance, "第一档余额阈值", 100);
  next.tier1Amount = asMoneyField(pick(raw, ["第一档充值金额", "tier1Amount"]) ?? next.tier1Amount, "第一档充值金额", 100);
  const tier2MinRaw = pick(raw, ["第二档花费下限", "tier2MinSpend"]);
  next.tier2MinSpend = asMoneyField(tier2MinRaw ?? next.tier1MaxSpend, "第二档花费下限", next.tier1MaxSpend);
  next.tier2Balance = asMoneyField(pick(raw, ["第二档余额阈值", "tier2Balance"]) ?? next.tier2Balance, "第二档余额阈值", 50);
  next.tier2Amount = asMoneyField(pick(raw, ["第二档充值金额", "tier2Amount"]) ?? next.tier2Amount, "第二档充值金额", 150);
  next.roiRiseAmount = asMoneyField(pick(raw, ["ROI上涨充值金额", "roiRiseAmount"]) ?? next.roiRiseAmount, "ROI上涨充值金额", 100);
  next.noOrderTimes = asNonNegNumber(pick(raw, ["连续充值未增单次数", "noOrderTimes"]) ?? next.noOrderTimes, "连续充值未增单次数", {
    integer: true,
    fallback: 3
  });
  next.pauseMinutes = asNonNegNumber(pick(raw, ["暂停分钟数", "pauseMinutes"]) ?? next.pauseMinutes, "暂停分钟数", {
    integer: true,
    fallback: 30
  });
  return validateRule(next);
}

async function loadRules() {
  await ensureRechargeConfigTables();
  const result = await queryShen(RULE_SQL.listRules);
  if (result) {
    return result[0].map(mapRule);
  }
  return memoryRules.map((row) => ({ ...row }));
}

async function loadMeta() {
  await ensureRechargeConfigTables();
  const result = await queryShen(RULE_SQL.getMeta);
  if (result) {
    const row = result[0][0];
    if (!row) {
      return { version: 0, updatedBy: "", updatedAt: "", changeSummary: "" };
    }
    return {
      version: Number(row.version) || 0,
      updatedBy: row.updated_by || "",
      updatedAt: row.updated_at || "",
      changeSummary: row.change_summary || ""
    };
  }
  return { ...memoryMeta };
}

async function loadOwners() {
  await ensureRechargeConfigTables();
  const result = await queryShen(RULE_SQL.listOwners);
  if (result) {
    return result[0].map((row) => ({ username: row.username, store: row.store }));
  }
  return memoryOwners.map((row) => ({ ...row }));
}

async function loadMachines() {
  await ensureRechargeConfigTables();
  const result = await queryShen(RULE_SQL.listMachines);
  if (result) {
    return result[0].map((row) => ({
      machineId: row.machine_id,
      username: row.username,
      role: row.role || "",
      dataScope: row.data_scope || row.dataScope || "",
      lastVersion: Number(row.last_version) || 0,
      status: row.status || "",
      message: row.message || "",
      receivedAt: row.received_at || "",
      syncedAt: row.synced_at || ""
    }));
  }
  return memoryMachines.map((row) => ({ ...row }));
}

function mapShopRun(row) {
  return {
    store: row.store || "",
    enabled: Number(row.run_enabled ?? row.enabled ?? 0) === 1,
    machineId: String(row.machine_id || row.machineId || ""),
    updatedBy: row.updated_by || row.updatedBy || "",
    updatedAt: row.updated_at || row.updatedAt || ""
  };
}

async function loadShopRuns() {
  await ensureRechargeConfigTables();
  const result = await queryShen(RULE_SQL.listShopRuns);
  if (result) {
    return result[0].map(mapShopRun);
  }
  return memoryShopRuns.map((row) => ({ ...row }));
}

async function persistShopRun(row) {
  const result = await queryShen(RULE_SQL.upsertShopRun, [
    row.store,
    row.enabled ? 1 : 0,
    row.machineId || "",
    row.updatedBy || "",
    row.updatedAt || ""
  ]);
  if (result) {
    return;
  }
  const idx = memoryShopRuns.findIndex((item) => item.store === row.store);
  if (idx >= 0) {
    memoryShopRuns[idx] = { ...row };
  } else {
    memoryShopRuns.push({ ...row });
  }
}

function shopRunnable(run, machineId) {
  if (!run || !run.enabled) {
    return false;
  }
  if (!run.machineId) {
    return true;
  }
  return run.machineId === machineId;
}

async function loadPeopleShops(username) {
  try {
    const people = await import("../people/store.js");
    const list =
      (typeof people.listPeople === "function" && (await people.listPeople())) ||
      (typeof people.listMembers === "function" && (await people.listMembers())) ||
      [];
    const row = (list || []).find((item) => item.username === username || item.name === username);
    if (Array.isArray(row?.visibleShops)) {
      return row.visibleShops.map((name) => String(name || "").trim()).filter(Boolean);
    }
  } catch {
    return null;
  }
  return null;
}

export async function listAssignedStores(actor) {
  if (isAllScope(actor)) {
    return null;
  }
  if (!actor?.username) {
    return memoryOwners.length || (await loadOwners()).length ? [] : null;
  }
  const [owners, fromPeople] = await Promise.all([loadOwners(), loadPeopleShops(actor.username)]);
  const names = new Set();
  for (const row of owners) {
    if (row.username === actor.username) {
      names.add(row.store);
    }
  }
  for (const store of fromPeople || []) {
    names.add(store);
  }
  return [...names];
}

function assertStoreAllowed(store, allowed) {
  if (allowed && !allowed.includes(store)) {
    throw shenHttpError(403, `无权操作店铺 ${store}`);
  }
}

function formatValue(key, value) {
  if (key === "autoRecharge" || key === "shopEnabled") {
    return value ? "是" : "否";
  }
  return String(value ?? "");
}

function diffRule(prev, next) {
  const changes = [];
  const baseline = applyDefault(prev || {});
  for (const [key, label] of RULE_FIELDS) {
    const before = baseline[key];
    const after = next[key];
    if (String(before) !== String(after)) {
      changes.push({ field: label, key, oldValue: formatValue(key, before), newValue: formatValue(key, after) });
    }
  }
  return changes;
}

async function persistRule(rule) {
  const result = await queryShen(RULE_SQL.upsertRule, [
    rule.store,
    rule.accountId,
    rule.subAccountId,
    rule.subAccountName,
    rule.shopEnabled ? 1 : 0,
    rule.autoRecharge ? 1 : 0,
    rule.plannedRoi,
    rule.tier1MinSpend,
    rule.tier1MaxSpend,
    rule.tier1Balance,
    rule.tier1Amount,
    rule.tier2MinSpend,
    rule.tier2Balance,
    rule.tier2Amount,
    rule.roiRiseAmount,
    rule.noOrderTimes,
    rule.pauseMinutes,
    rule.version,
    rule.updatedBy,
    rule.updatedAt
  ]);
  if (result) {
    return;
  }
  const idx = memoryRules.findIndex((item) => ruleKey(item) === ruleKey(rule));
  if (idx >= 0) {
    memoryRules[idx] = { ...rule };
  } else {
    memoryRules.push({ ...rule });
  }
}

async function persistMeta(meta) {
  const result = await queryShen(RULE_SQL.upsertMeta, [meta.version, meta.updatedBy, meta.updatedAt, meta.changeSummary]);
  if (result) {
    return;
  }
  memoryMeta = { ...meta };
}

async function persistHistory(row) {
  const result = await queryShen(RULE_SQL.insertHistory, [
    row.version,
    row.store,
    row.accountId,
    row.subAccountId,
    row.field,
    row.oldValue,
    row.newValue,
    row.updatedBy,
    row.updatedAt,
    row.changeSummary
  ]);
  if (result) {
    return;
  }
  nextHistoryId += 1;
  memoryHistory.unshift({ id: nextHistoryId, ...row });
}

function syncStatusFor(version, machines, username, allowed) {
  const related = machines.filter((machine) => {
    if (machine.status !== "success" && machine.status !== "failed") {
      return false;
    }
    if (!allowed || !username) {
      return true;
    }
    return !machine.username || machine.username === username;
  });
  if (!related.length) {
    return { status: "待同步", syncedAt: "" };
  }
  if (related.some((machine) => machine.status === "failed" && machine.lastVersion === version)) {
    const failed = related.find((machine) => machine.status === "failed" && machine.lastVersion === version);
    return { status: "同步失败", syncedAt: failed?.syncedAt || failed?.receivedAt || "" };
  }
  const current = related.filter((machine) => machine.lastVersion >= version && machine.status === "success");
  if (current.length) {
    const latest = current.reduce((max, machine) => (machine.syncedAt > max ? machine.syncedAt : max), "");
    return { status: "已同步", syncedAt: latest };
  }
  return { status: "待同步", syncedAt: related.reduce((max, machine) => (machine.syncedAt > max ? machine.syncedAt : max), "") };
}

function toEditorRow(identity, rule, meta, sync) {
  const current = applyDefault(rule || {});
  return {
    store: identity.store,
    accountId: identity.accountId,
    subAccountId: identity.subAccountId,
    subAccountName: identity.subAccountName || current.subAccountName || "",
    autoRecharge: current.autoRecharge,
    plannedRoi: current.plannedRoi,
    tier1MinSpend: current.tier1MinSpend,
    tier1MaxSpend: current.tier1MaxSpend,
    tier1Balance: current.tier1Balance,
    tier1Amount: current.tier1Amount,
    tier2MinSpend: current.tier2MinSpend,
    tier2Balance: current.tier2Balance,
    tier2Amount: current.tier2Amount,
    roiRiseAmount: current.roiRiseAmount,
    noOrderTimes: current.noOrderTimes,
    pauseMinutes: current.pauseMinutes,
    shopEnabled: current.shopEnabled,
    version: rule?.version || meta.version || 0,
    updatedBy: rule?.updatedBy || "",
    updatedAt: rule?.updatedAt || "",
    syncStatus: sync.status,
    syncedAt: sync.syncedAt
  };
}

function toWorkerSub(row) {
  return {
    子账号ID: String(row.subAccountId || ""),
    子账号名称: row.subAccountName || "",
    自动充值: Boolean(row.autoRecharge),
    计划ROI: Number(row.plannedRoi) || 0,
    第一档花费下限: Number(row.tier1MinSpend) || 0,
    第一档花费上限: Number(row.tier1MaxSpend) || 0,
    第一档余额阈值: Number(row.tier1Balance) || 0,
    第一档充值金额: Number(row.tier1Amount) || 0,
    第二档花费下限: Number(row.tier2MinSpend) || 0,
    第二档余额阈值: Number(row.tier2Balance) || 0,
    第二档充值金额: Number(row.tier2Amount) || 0,
    ROI上涨充值金额: Number(row.roiRiseAmount) || 0,
    连续充值未增单次数: Number(row.noOrderTimes) || 0,
    暂停分钟数: Number(row.pauseMinutes) || 0
  };
}

export async function replaceStoreOwners(username, stores) {
  const name = clip(username, 64, "用户名");
  if (!name) {
    throw shenHttpError(400, "用户名必填");
  }
  if (!Array.isArray(stores)) {
    throw shenHttpError(400, "stores 必须是数组");
  }
  const names = stores.map((item) => clip(typeof item === "string" ? item : item?.store || item?.店铺名称, 64, "店铺名称")).filter(Boolean);
  await ensureRechargeConfigTables();
  const cleared = await queryShen(RULE_SQL.clearOwners, [name]);
  if (cleared) {
    for (const store of names) {
      await queryShen(RULE_SQL.insertOwner, [name, store]);
    }
  } else {
    memoryOwners = memoryOwners.filter((row) => row.username !== name);
    for (const store of names) {
      memoryOwners.push({ username: name, store });
    }
  }
  return { ok: true, username: name, stores: names };
}

export async function listEditorConfig(query, actor) {
  const allowed = await listAssignedStores(actor);
  const storeFilter = clip(query?.store || "", 64, "店铺名称");
  const keyword = String(query?.q || query?.keyword || "").trim();
  const enabledOnly = String(query?.enabled || "") === "1" || query?.enabled === true;
  const [identities, rules, meta, machines, shopRuns] = await Promise.all([
    listLatestSubIdentities(),
    loadRules(),
    loadMeta(),
    loadMachines(),
    loadShopRuns()
  ]);
  const ruleMap = new Map(rules.map((row) => [ruleKey(row), row]));
  const runMap = new Map(shopRuns.map((row) => [row.store, row]));
  const sync = syncStatusFor(meta.version, machines, actor.username, allowed);
  const scopedIdentities = identities.filter((item) => !allowed || allowed.includes(item.store));
  const shops = [...new Set(scopedIdentities.map((item) => item.store))];
  let rows = scopedIdentities
    .filter((item) => !storeFilter || item.store === storeFilter)
    .map((item) => toEditorRow(item, ruleMap.get(`${item.store}\t${item.accountId}\t${item.subAccountId}`), meta, sync))
    .filter((row) => {
      if (enabledOnly && !row.autoRecharge) {
        return false;
      }
      if (!keyword) {
        return true;
      }
      return `${row.subAccountName} ${row.subAccountId}`.includes(keyword);
    });
  const runListSaved = shopRuns.length > 0;
  const shopRunRows = shops.map((name) => {
    const run = runMap.get(name);
    return {
      store: name,
      enabled: runListSaved ? Boolean(run?.enabled) : true,
      machineId: run?.machineId || ""
    };
  });
  return {
    ok: true,
    version: meta.version,
    updatedAt: meta.updatedAt,
    updatedBy: meta.updatedBy,
    changeSummary: meta.changeSummary,
    actor: actor.username,
    scope: allowed ? "assigned" : "all",
    shops,
    runListSaved,
    runShops: shopRunRows.filter((row) => row.enabled).map((row) => row.store),
    shopRuns: shopRunRows,
    machines: machines.map((item) => ({
      machineId: item.machineId,
      username: item.username,
      status: item.status === "success" ? "已同步" : item.status === "failed" ? "同步失败" : "待同步",
      lastVersion: item.lastVersion,
      syncedAt: item.syncedAt || ""
    })),
    defaults: DEFAULT_RECHARGE_RULE,
    syncStatus: sync.status,
    syncedAt: sync.syncedAt,
    rows
  };
}

function isRunPatch(body) {
  const patch = String(body?.patch || "").toLowerCase();
  return patch === "run" || patch === "shops" || patch === "本次执行";
}

export async function saveShopRunList(body, actor) {
  if (!actor?.username) {
    throw shenHttpError(401, "未登录，无法保存要跑的店铺");
  }
  if (body == null || typeof body !== "object") {
    throw shenHttpError(400, "请求体必须是对象");
  }
  const named = body.shopRuns || body.店铺执行 || (Array.isArray(body.rows) && isRunPatch(body) ? body.rows : null);
  const names = body.runShops ?? body.本次执行 ?? body.shops;
  if (!Array.isArray(named) && !Array.isArray(names)) {
    throw shenHttpError(400, "必须指定 runShops 或 shopRuns");
  }
  const allowed = await listAssignedStores(actor);
  const [identities, currentRuns, meta] = await Promise.all([listLatestSubIdentities(), loadShopRuns(), loadMeta()]);
  const known = [
    ...new Set(
      identities
        .map((item) => item.store)
        .filter((store) => !allowed || allowed.includes(store))
    )
  ];
  const nextMap = new Map(known.map((store) => [store, { store, enabled: false, machineId: "" }]));
  if (Array.isArray(names)) {
    if (names.length > 200) {
      throw shenHttpError(400, "本次执行店铺一次最多 200 家");
    }
    for (const item of names) {
      const store = clip(typeof item === "string" ? item : item?.store || item?.店铺名称, 64, "店铺名称");
      if (!store) {
        continue;
      }
      assertStoreAllowed(store, allowed);
      nextMap.set(store, { store, enabled: true, machineId: nextMap.get(store)?.machineId || "" });
    }
  }
  if (Array.isArray(named)) {
    if (named.length > 200) {
      throw shenHttpError(400, "本次执行店铺一次最多 200 家");
    }
    for (const raw of named) {
      const store = clip(pick(raw, ["店铺名称", "store"]) || "", 64, "店铺名称");
      if (!store) {
        continue;
      }
      assertStoreAllowed(store, allowed);
      nextMap.set(store, {
        store,
        enabled: asBool(pick(raw, ["启用", "enabled", "本次执行"]), true),
        machineId: clip(pick(raw, ["执行机", "machineId"]) || "", 64, "执行机")
      });
    }
  }
  const version = meta.version + 1;
  const updatedAt = nowShanghai();
  const updatedBy = actor.displayName || actor.username;
  const changeSummary = clip(body.changeSummary || body.摘要 || "选择本次执行店铺", 200, "变更摘要");
  const prevMap = new Map(currentRuns.map((row) => [row.store, row]));
  const saved = [];
  for (const next of nextMap.values()) {
    const prev = prevMap.get(next.store) || { store: next.store, enabled: false, machineId: "" };
    const row = { ...next, updatedBy, updatedAt };
    await persistShopRun(row);
    if (Boolean(prev.enabled) !== Boolean(next.enabled)) {
      await persistHistory({
        version,
        store: next.store,
        accountId: "",
        subAccountId: "",
        field: "本次执行",
        oldValue: prev.enabled ? "是" : "否",
        newValue: next.enabled ? "是" : "否",
        updatedBy,
        updatedAt,
        changeSummary
      });
    }
    if (String(prev.machineId || "") !== String(next.machineId || "")) {
      await persistHistory({
        version,
        store: next.store,
        accountId: "",
        subAccountId: "",
        field: "执行机",
        oldValue: prev.machineId || "任意机",
        newValue: next.machineId || "任意机",
        updatedBy,
        updatedAt,
        changeSummary
      });
    }
    saved.push(row);
  }
  await persistMeta({ version, updatedBy, updatedAt, changeSummary });
  return {
    ok: true,
    version,
    updatedAt,
    updatedBy,
    changeSummary,
    saved: saved.length,
    runShops: saved.filter((row) => row.enabled).map((row) => row.store)
  };
}

export async function saveEditorConfig(body, actor) {
  if (!actor?.username) {
    throw shenHttpError(401, "未登录，无法保存充值规则");
  }
  if (body == null || typeof body !== "object") {
    throw shenHttpError(400, "请求体必须是对象");
  }
  if (isRunPatch(body) || Array.isArray(body.runShops) || Array.isArray(body.本次执行) || Array.isArray(body.shopRuns)) {
    return saveShopRunList(body, actor);
  }
  const incoming = body.rows || body.子账号 || body.list || [];
  if (!Array.isArray(incoming) || incoming.length === 0) {
    throw shenHttpError(400, "rows 必须是非空数组");
  }
  const patch = String(body.patch || "").toLowerCase();
  const changeSummary = clip(body.changeSummary || body.摘要 || (patch === "roi" ? "批量设置计划ROI" : "保存充值规则"), 200, "变更摘要");
  const allowed = await listAssignedStores(actor);
  const [currentRules, meta] = await Promise.all([loadRules(), loadMeta()]);
  const currentMap = new Map(currentRules.map((row) => [ruleKey(row), row]));
  const version = meta.version + 1;
  const updatedAt = nowShanghai();
  const updatedBy = actor.displayName || actor.username;
  const saved = [];
  for (const raw of incoming) {
    const hinted = {
      store: pick(raw, ["店铺名称", "store"]),
      accountId: asIdString(pick(raw, ["京准通主账户ID", "accountId"]) || "", "京准通主账户ID"),
      subAccountId: asIdString(pick(raw, ["子账号ID", "subAccountId"]) || "", "子账号ID")
    };
    const current = currentMap.get(`${hinted.store || ""}\t${hinted.accountId}\t${hinted.subAccountId}`) || null;
    const parsed = parseRulePatch({ ...raw, patch: raw.patch || patch }, current || { store: hinted.store, accountId: hinted.accountId, subAccountId: hinted.subAccountId });
    assertStoreAllowed(parsed.store, allowed);
    const next = { ...parsed, version, updatedBy, updatedAt };
    const changes = diffRule(current, next);
    await persistRule(next);
    for (const change of changes) {
      await persistHistory({
        version,
        store: next.store,
        accountId: next.accountId,
        subAccountId: next.subAccountId,
        field: change.field,
        oldValue: change.oldValue,
        newValue: change.newValue,
        updatedBy,
        updatedAt,
        changeSummary
      });
    }
    saved.push(next);
  }
  await persistMeta({ version, updatedBy, updatedAt, changeSummary });
  return {
    ok: true,
    version,
    updatedAt,
    updatedBy,
    changeSummary,
    saved: saved.length
  };
}

export async function listRuleHistory(query, actor) {
  const allowed = await listAssignedStores(actor);
  const store = clip(query?.store || "", 64, "店铺名称");
  const subAccountId = asIdString(query?.subAccountId || query?.子账号ID || "", "子账号ID");
  if (store) {
    assertStoreAllowed(store, allowed);
  }
  const limit = Math.min(500, Math.max(1, Number(query?.limit) || 100));
  await ensureRechargeConfigTables();
  const result = await queryShen(RULE_SQL.listHistory, [store ? 0 : 1, store, subAccountId ? 0 : 1, subAccountId, limit]);
  let rows;
  if (result) {
    rows = result[0].map((row) => ({
      version: Number(row.version) || 0,
      store: row.store,
      accountId: String(row.account_id || ""),
      subAccountId: String(row.sub_account_id || ""),
      field: row.field_name,
      oldValue: row.old_value,
      newValue: row.new_value,
      updatedBy: row.updated_by,
      updatedAt: row.updated_at,
      changeSummary: row.change_summary
    }));
  } else {
    rows = memoryHistory
      .filter((row) => (!store || row.store === store) && (!subAccountId || row.subAccountId === subAccountId))
      .slice(0, limit)
      .map((row) => ({ ...row }));
  }
  if (allowed) {
    rows = rows.filter((row) => allowed.includes(row.store));
  }
  return { ok: true, rows };
}

async function persistMachine(machine) {
  const result = await queryShen(RULE_SQL.upsertMachine, [
    machine.machineId,
    machine.username,
    machine.role || "",
    machine.dataScope || "",
    machine.lastVersion,
    machine.status,
    machine.message,
    machine.receivedAt,
    machine.syncedAt
  ]);
  if (result) {
    return;
  }
  const idx = memoryMachines.findIndex((item) => item.machineId === machine.machineId);
  if (idx >= 0) {
    memoryMachines[idx] = { ...machine };
  } else {
    memoryMachines.push({ ...machine });
  }
}

async function bindMachine(machineId, actor) {
  const id = clip(machineId, 64, "machineId");
  if (!id) {
    throw shenHttpError(400, "machineId 必填");
  }
  const machines = await loadMachines();
  const existing = machines.find((item) => item.machineId === id);
  if (existing?.username) {
    return existing;
  }
  const username = actor?.username || "";
  if (!username) {
    throw shenHttpError(400, "工作机尚未绑定执行人");
  }
  const bound = {
    machineId: id,
    username,
    role: actor?.role || existing?.role || "",
    dataScope: actor?.dataScope || existing?.dataScope || "",
    lastVersion: existing?.lastVersion || 0,
    status: existing?.status || "",
    message: existing?.message || "",
    receivedAt: existing?.receivedAt || "",
    syncedAt: existing?.syncedAt || ""
  };
  await persistMachine(bound);
  return bound;
}

export async function pullWorkerConfig(query, actor) {
  const machine = await bindMachine(query?.machineId, actor);
  const machineActor = {
    username: machine.username,
    role: machine.role || "",
    dataScope: machine.dataScope || ""
  };
  const allowed = await listAssignedStores(isAllScope(actor) ? actor : machineActor);
  const sinceVersion = Number(query?.sinceVersion ?? query?.version ?? 0) || 0;
  const [identities, rules, meta, shopRuns] = await Promise.all([
    listLatestSubIdentities(),
    loadRules(),
    loadMeta(),
    loadShopRuns()
  ]);
  if (meta.version > 0 && meta.version <= sinceVersion) {
    return {
      changed: false,
      version: meta.version,
      updatedAt: meta.updatedAt,
      machineId: machine.machineId
    };
  }
  const ruleMap = new Map(rules.map((row) => [ruleKey(row), row]));
  const runMap = new Map(shopRuns.map((row) => [row.store, row]));
  const runListSaved = shopRuns.length > 0;
  const byShop = new Map();
  for (const identity of identities) {
    if (allowed && !allowed.includes(identity.store)) {
      continue;
    }
    const run = runMap.get(identity.store);
    if (runListSaved && !shopRunnable(run, machine.machineId)) {
      continue;
    }
    const rule = applyDefault(ruleMap.get(`${identity.store}\t${identity.accountId}\t${identity.subAccountId}`) || {
      store: identity.store,
      accountId: identity.accountId,
      subAccountId: identity.subAccountId,
      subAccountName: identity.subAccountName
    });
    if (!byShop.has(identity.store)) {
      byShop.set(identity.store, {
        店铺名称: identity.store,
        京准通主账户ID: String(identity.accountId || ""),
        启用: true,
        执行机: run?.machineId || "",
        子账号: []
      });
    }
    const shop = byShop.get(identity.store);
    if (identity.accountId) {
      shop.京准通主账户ID = String(identity.accountId);
    }
    shop.子账号.push(toWorkerSub({ ...rule, ...identity, subAccountName: identity.subAccountName || rule.subAccountName }));
  }
  const shops = [...byShop.values()];
  return {
    changed: true,
    version: meta.version,
    updatedAt: meta.updatedAt,
    machineId: machine.machineId,
    runShops: shops.map((shop) => shop.店铺名称),
    shops
  };
}

export async function ackWorkerConfig(body, actor) {
  if (body == null || typeof body !== "object") {
    throw shenHttpError(400, "请求体必须是对象");
  }
  const machine = await bindMachine(body.machineId, actor);
  const version = asNonNegNumber(body.version, "version", { integer: true, fallback: 0 });
  const status = String(body.status || "").trim().toLowerCase();
  if (status !== "success" && status !== "failed") {
    throw shenHttpError(400, "status 必须是 success 或 failed");
  }
  const receivedAt = clip(body.receivedAt || nowShanghai(), 40, "receivedAt");
  const next = {
    ...machine,
    lastVersion: version,
    status,
    message: clip(body.message || "", 200, "message"),
    receivedAt,
    syncedAt: nowShanghai()
  };
  await persistMachine(next);
  return {
    ok: true,
    machineId: next.machineId,
    version,
    status: status === "success" ? "已同步" : "同步失败",
    syncedAt: next.syncedAt
  };
}
