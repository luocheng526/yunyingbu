import { listLatestSubIdentities, nowShanghai, queryShen, shenHttpError } from "./store.js";

export const HEARTBEAT_STALE_MS = 5 * 60 * 1000;
export const COOKIE_STATUSES = ["待录", "正常", "过期", "身份不符"];
export const EXEC_STATUSES = ["运行中", "已停止", "等待Cookie", "异常"];

export const MASTER_SQL = {
  createShopTable: `CREATE TABLE IF NOT EXISTS shen_paid_shop_master (
  account_id VARCHAR(64) NOT NULL PRIMARY KEY,
  store VARCHAR(64) NOT NULL,
  machine_id VARCHAR(64) NOT NULL DEFAULT '',
  deleted TINYINT NOT NULL DEFAULT 0,
  updated_by VARCHAR(64) NOT NULL DEFAULT '',
  updated_at VARCHAR(40) NOT NULL DEFAULT ''
)`,
  createSubTable: `CREATE TABLE IF NOT EXISTS shen_paid_sub_master (
  account_id VARCHAR(64) NOT NULL,
  sub_account_id VARCHAR(64) NOT NULL,
  store VARCHAR(64) NOT NULL DEFAULT '',
  sub_account_name VARCHAR(128) NOT NULL DEFAULT '',
  deleted TINYINT NOT NULL DEFAULT 0,
  updated_by VARCHAR(64) NOT NULL DEFAULT '',
  updated_at VARCHAR(40) NOT NULL DEFAULT '',
  PRIMARY KEY (account_id, sub_account_id)
)`,
  createStatusTable: `CREATE TABLE IF NOT EXISTS shen_paid_shop_status (
  account_id VARCHAR(64) NOT NULL PRIMARY KEY,
  machine_id VARCHAR(64) NOT NULL DEFAULT '',
  jzt_cookie_status VARCHAR(16) NOT NULL DEFAULT '待录',
  jzt_cookie_updated_at VARCHAR(40) NOT NULL DEFAULT '',
  jm_cookie_status VARCHAR(16) NOT NULL DEFAULT '待录',
  jm_cookie_updated_at VARCHAR(40) NOT NULL DEFAULT '',
  run_status VARCHAR(16) NOT NULL DEFAULT '已停止',
  last_error VARCHAR(200) NOT NULL DEFAULT '',
  heartbeat_at VARCHAR(40) NOT NULL DEFAULT '',
  worker_status VARCHAR(16) NOT NULL DEFAULT '',
  config_version INT UNSIGNED NOT NULL DEFAULT 0
)`,
  listShops: `SELECT account_id, store, machine_id, deleted, updated_by, updated_at FROM shen_paid_shop_master`,
  upsertShop: `INSERT INTO shen_paid_shop_master (account_id, store, machine_id, deleted, updated_by, updated_at)
VALUES (?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
  store = VALUES(store),
  machine_id = VALUES(machine_id),
  deleted = VALUES(deleted),
  updated_by = VALUES(updated_by),
  updated_at = VALUES(updated_at)`,
  listSubs: `SELECT account_id, sub_account_id, store, sub_account_name, deleted, updated_by, updated_at FROM shen_paid_sub_master`,
  upsertSub: `INSERT INTO shen_paid_sub_master (account_id, sub_account_id, store, sub_account_name, deleted, updated_by, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
  store = VALUES(store),
  sub_account_name = VALUES(sub_account_name),
  deleted = VALUES(deleted),
  updated_by = VALUES(updated_by),
  updated_at = VALUES(updated_at)`,
  listStatuses: `SELECT account_id, machine_id, jzt_cookie_status, jzt_cookie_updated_at, jm_cookie_status, jm_cookie_updated_at, run_status, last_error, heartbeat_at, worker_status, config_version FROM shen_paid_shop_status`,
  upsertStatus: `INSERT INTO shen_paid_shop_status (account_id, machine_id, jzt_cookie_status, jzt_cookie_updated_at, jm_cookie_status, jm_cookie_updated_at, run_status, last_error, heartbeat_at, worker_status, config_version)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
  machine_id = VALUES(machine_id),
  jzt_cookie_status = VALUES(jzt_cookie_status),
  jzt_cookie_updated_at = VALUES(jzt_cookie_updated_at),
  jm_cookie_status = VALUES(jm_cookie_status),
  jm_cookie_updated_at = VALUES(jm_cookie_updated_at),
  run_status = VALUES(run_status),
  last_error = VALUES(last_error),
  heartbeat_at = VALUES(heartbeat_at),
  worker_status = VALUES(worker_status),
  config_version = VALUES(config_version)`
};

let memoryShops = [];
let memorySubs = [];
let memoryStatuses = [];

export function resetMaster() {
  memoryShops = [];
  memorySubs = [];
  memoryStatuses = [];
}

export async function ensureMasterTables() {
  for (const sql of [MASTER_SQL.createShopTable, MASTER_SQL.createSubTable, MASTER_SQL.createStatusTable]) {
    try {
      await queryShen(sql);
    } catch (err) {
      const code = err?.code || err?.errno;
      const message = String(err?.message || "");
      if (code !== "ER_TABLE_EXISTS_ERROR" && code !== 1050 && !/already exists/i.test(message)) {
        throw err;
      }
    }
  }
}

function clip(value, max, label) {
  const text = String(value ?? "").trim();
  if (text.length > max) {
    throw shenHttpError(400, `${label}不能超过 ${max} 个字`);
  }
  return text;
}

function asId(value, label) {
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

function assertNoCookieBody(body) {
  if (!body || typeof body !== "object") {
    return;
  }
  const dump = JSON.stringify(body);
  if (/(^|[,{])\s*"(cookie|Cookie|set-cookie|pin|thor|unb|pt_key|京准通Cookie|京麦Cookie)"\s*:\s*"(?![待录正常过期身份不符])[^"]{20,}/.test(dump)) {
    throw shenHttpError(400, "网站不接收 Cookie 正文");
  }
  if (/Cookie=|Set-Cookie|; *pin=|; *thor=/i.test(dump) && dump.length > 180) {
    throw shenHttpError(400, "网站不接收 Cookie 正文");
  }
}

function mapShop(row) {
  return {
    accountId: String(row.account_id || row.accountId || ""),
    store: row.store || "",
    machineId: String(row.machine_id || row.machineId || ""),
    deleted: Number(row.deleted) === 1,
    updatedBy: row.updated_by || row.updatedBy || "",
    updatedAt: row.updated_at || row.updatedAt || ""
  };
}

function mapSub(row) {
  return {
    accountId: String(row.account_id || row.accountId || ""),
    subAccountId: String(row.sub_account_id || row.subAccountId || ""),
    store: row.store || "",
    subAccountName: row.sub_account_name || row.subAccountName || "",
    deleted: Number(row.deleted) === 1,
    updatedBy: row.updated_by || row.updatedBy || "",
    updatedAt: row.updated_at || row.updatedAt || ""
  };
}

function mapStatus(row) {
  return {
    accountId: String(row.account_id || row.accountId || ""),
    machineId: String(row.machine_id || row.machineId || ""),
    jztCookieStatus: row.jzt_cookie_status || row.jztCookieStatus || "待录",
    jztCookieUpdatedAt: row.jzt_cookie_updated_at || row.jztCookieUpdatedAt || "",
    jmCookieStatus: row.jm_cookie_status || row.jmCookieStatus || "待录",
    jmCookieUpdatedAt: row.jm_cookie_updated_at || row.jmCookieUpdatedAt || "",
    runStatus: row.run_status || row.runStatus || "已停止",
    lastError: row.last_error || row.lastError || "",
    heartbeatAt: row.heartbeat_at || row.heartbeatAt || "",
    workerStatus: row.worker_status || row.workerStatus || "",
    configVersion: Number(row.config_version || row.configVersion) || 0
  };
}

export async function loadMasterShops() {
  await ensureMasterTables();
  const result = await queryShen(MASTER_SQL.listShops);
  if (result) {
    return result[0].map(mapShop);
  }
  return memoryShops.map((row) => ({ ...row }));
}

export async function loadMasterSubs() {
  await ensureMasterTables();
  const result = await queryShen(MASTER_SQL.listSubs);
  if (result) {
    return result[0].map(mapSub);
  }
  return memorySubs.map((row) => ({ ...row }));
}

export async function loadShopStatuses() {
  await ensureMasterTables();
  const result = await queryShen(MASTER_SQL.listStatuses);
  if (result) {
    return result[0].map(mapStatus);
  }
  return memoryStatuses.map((row) => ({ ...row }));
}

async function persistShop(row) {
  const result = await queryShen(MASTER_SQL.upsertShop, [
    row.accountId,
    row.store,
    row.machineId || "",
    row.deleted ? 1 : 0,
    row.updatedBy || "",
    row.updatedAt || ""
  ]);
  if (result) {
    return;
  }
  const idx = memoryShops.findIndex((item) => item.accountId === row.accountId);
  if (idx >= 0) {
    memoryShops[idx] = { ...row };
  } else {
    memoryShops.push({ ...row });
  }
}

async function persistSub(row) {
  const result = await queryShen(MASTER_SQL.upsertSub, [
    row.accountId,
    row.subAccountId,
    row.store || "",
    row.subAccountName || "",
    row.deleted ? 1 : 0,
    row.updatedBy || "",
    row.updatedAt || ""
  ]);
  if (result) {
    return;
  }
  const idx = memorySubs.findIndex((item) => item.accountId === row.accountId && item.subAccountId === row.subAccountId);
  if (idx >= 0) {
    memorySubs[idx] = { ...row };
  } else {
    memorySubs.push({ ...row });
  }
}

async function persistStatus(row) {
  const result = await queryShen(MASTER_SQL.upsertStatus, [
    row.accountId,
    row.machineId || "",
    row.jztCookieStatus || "待录",
    row.jztCookieUpdatedAt || "",
    row.jmCookieStatus || "待录",
    row.jmCookieUpdatedAt || "",
    row.runStatus || "已停止",
    row.lastError || "",
    row.heartbeatAt || "",
    row.workerStatus || "",
    row.configVersion || 0
  ]);
  if (result) {
    return;
  }
  const idx = memoryStatuses.findIndex((item) => item.accountId === row.accountId);
  if (idx >= 0) {
    memoryStatuses[idx] = { ...row };
  } else {
    memoryStatuses.push({ ...row });
  }
}

export async function seedMasterFromIdentities() {
  const [shops, identities] = await Promise.all([loadMasterShops(), listLatestSubIdentities()]);
  if (shops.length) {
    return { shops, subs: await loadMasterSubs() };
  }
  const seen = new Set();
  for (const item of identities) {
    const accountId = String(item.accountId || "").trim();
    const store = String(item.store || "").trim();
    if (!accountId || !store || seen.has(accountId)) {
      continue;
    }
    seen.add(accountId);
    await persistShop({
      accountId,
      store,
      machineId: "",
      deleted: false,
      updatedBy: "迁移",
      updatedAt: nowShanghai()
    });
  }
  const subSeen = new Set();
  for (const item of identities) {
    const accountId = String(item.accountId || "").trim();
    const subAccountId = String(item.subAccountId || "").trim();
    const key = `${accountId}\t${subAccountId}`;
    if (!accountId || !subAccountId || subSeen.has(key)) {
      continue;
    }
    subSeen.add(key);
    await persistSub({
      accountId,
      subAccountId,
      store: item.store || "",
      subAccountName: item.subAccountName || "",
      deleted: false,
      updatedBy: "迁移",
      updatedAt: nowShanghai()
    });
  }
  return { shops: await loadMasterShops(), subs: await loadMasterSubs() };
}

export function shopHeartbeatView(status, nowMs = Date.now()) {
  const row = status || {};
  const heartbeatAt = row.heartbeatAt || "";
  const stamp = heartbeatAt ? Date.parse(heartbeatAt) : 0;
  const stale = !stamp || nowMs - stamp > HEARTBEAT_STALE_MS;
  return {
    jztCookieStatus: row.jztCookieStatus || "待录",
    jztCookieUpdatedAt: row.jztCookieUpdatedAt || "",
    jmCookieStatus: row.jmCookieStatus || "待录",
    jmCookieUpdatedAt: row.jmCookieUpdatedAt || "",
    runStatus: stale && row.runStatus === "运行中" ? "已停止" : row.runStatus || "已停止",
    lastError: row.lastError || "",
    heartbeatAt,
    workerOnline: !stale && (row.workerStatus === "online" || row.workerStatus === "在线"),
    workerStatus: stale ? "离线" : row.workerStatus === "online" || row.workerStatus === "在线" ? "在线" : row.workerStatus || "离线"
  };
}

export function findShop(shops, raw) {
  const accountId = asId(pick(raw, ["京准通主账户ID", "accountId", "主账户ID"]) || "", "京准通主账户ID");
  const store = clip(pick(raw, ["店铺名称", "store"]) || "", 64, "店铺名称");
  if (accountId) {
    const byId = shops.find((item) => item.accountId === accountId);
    if (byId) {
      return byId;
    }
  }
  if (store) {
    return shops.find((item) => item.store === store && !item.deleted) || shops.find((item) => item.store === store) || null;
  }
  return null;
}

export async function applyShopPatch(body, actor) {
  assertNoCookieBody(body);
  const action = String(body?.action || body?.操作 || "create").toLowerCase();
  const raw = body?.shop || body?.店铺 || body;
  const shops = await loadMasterShops();
  const updatedAt = nowShanghai();
  const updatedBy = actor.displayName || actor.username;
  if (action === "create" || action === "add" || action === "新增") {
    const accountId = asId(pick(raw, ["京准通主账户ID", "accountId"]) || "", "京准通主账户ID");
    const store = clip(pick(raw, ["店铺名称", "store"]) || "", 64, "店铺名称");
    const machineId = clip(pick(raw, ["执行机", "machineId"]) || "", 64, "执行机");
    if (!accountId || !store) {
      throw shenHttpError(400, "新增店铺必须填写店铺名称和京准通主账户ID");
    }
    const exists = shops.find((item) => item.accountId === accountId);
    if (exists && !exists.deleted) {
      throw shenHttpError(409, "该京准通主账户ID已存在");
    }
    if (shops.some((item) => item.store === store && item.accountId !== accountId && !item.deleted)) {
      throw shenHttpError(409, "该店铺名称已被其他主账户使用");
    }
    const shop = { accountId, store, machineId, deleted: false, updatedBy, updatedAt };
    await persistShop(shop);
    return {
      action: "create",
      shop,
      histories: [
        { store, accountId, subAccountId: "", field: "店铺主档", oldValue: exists ? "已删除" : "", newValue: "已新增" }
      ]
    };
  }
  const current = findShop(shops, raw);
  if (!current) {
    throw shenHttpError(404, "店铺不存在");
  }
  if (action === "delete" || action === "remove" || action === "删除") {
    const shop = { ...current, deleted: true, updatedBy, updatedAt };
    await persistShop(shop);
    return {
      action: "delete",
      shop,
      histories: [{ store: current.store, accountId: current.accountId, subAccountId: "", field: "店铺主档", oldValue: "在用", newValue: "已删除" }]
    };
  }
  if (action === "restore" || action === "恢复") {
    const shop = { ...current, deleted: false, updatedBy, updatedAt };
    await persistShop(shop);
    return {
      action: "restore",
      shop,
      histories: [{ store: current.store, accountId: current.accountId, subAccountId: "", field: "店铺主档", oldValue: "已删除", newValue: "已恢复" }]
    };
  }
  if (pick(raw, ["京准通主账户ID", "accountId"]) && asId(pick(raw, ["京准通主账户ID", "accountId"]), "京准通主账户ID") !== current.accountId) {
    throw shenHttpError(400, "主账户ID不可直接修改，请删除旧店后创建新店");
  }
  const store = clip(pick(raw, ["店铺名称", "store"]) ?? current.store, 64, "店铺名称");
  if (store !== current.store && shops.some((item) => item.store === store && item.accountId !== current.accountId && !item.deleted)) {
    throw shenHttpError(409, "该店铺名称已被其他主账户使用");
  }
  const machineId = clip(pick(raw, ["执行机", "machineId"]) ?? current.machineId, 64, "执行机");
  const shop = { ...current, store, machineId, updatedBy, updatedAt };
  await persistShop(shop);
  if (store !== current.store) {
    const subs = await loadMasterSubs();
    for (const sub of subs.filter((item) => item.accountId === current.accountId)) {
      await persistSub({ ...sub, store, updatedBy, updatedAt });
    }
  }
  const histories = [];
  if (store !== current.store) {
    histories.push({ store, accountId: current.accountId, subAccountId: "", field: "店铺名称", oldValue: current.store, newValue: store });
  }
  if (machineId !== current.machineId) {
    histories.push({
      store,
      accountId: current.accountId,
      subAccountId: "",
      field: "执行机",
      oldValue: current.machineId || "任意机",
      newValue: machineId || "任意机"
    });
  }
  return { action: "update", shop, histories };
}

export async function applySubPatch(body, actor) {
  assertNoCookieBody(body);
  const action = String(body?.action || body?.操作 || "create").toLowerCase();
  const raw = body?.sub || body?.子账号 || body;
  const [shops, subs] = await Promise.all([loadMasterShops(), loadMasterSubs()]);
  const shop = findShop(shops, raw);
  if (!shop || shop.deleted) {
    throw shenHttpError(404, "先有未删除的店铺才能维护子账号");
  }
  const accountId = shop.accountId;
  const subAccountId = asId(pick(raw, ["子账号ID", "subAccountId"]) || "", "子账号ID");
  if (!subAccountId) {
    throw shenHttpError(400, "必须指定子账号ID");
  }
  const current = subs.find((item) => item.accountId === accountId && item.subAccountId === subAccountId) || null;
  const updatedAt = nowShanghai();
  const updatedBy = actor.displayName || actor.username;
  if (action === "create" || action === "add" || action === "新增") {
    if (current && !current.deleted) {
      throw shenHttpError(409, "该子账号已存在");
    }
    const sub = {
      accountId,
      subAccountId,
      store: shop.store,
      subAccountName: clip(pick(raw, ["子账号名称", "subAccountName"]) || "", 128, "子账号名称"),
      deleted: false,
      updatedBy,
      updatedAt
    };
    await persistSub(sub);
    return {
      action: "create",
      shop,
      sub,
      histories: [
        { store: shop.store, accountId, subAccountId, field: "子账号主档", oldValue: current ? "已删除" : "", newValue: "已新增" }
      ]
    };
  }
  if (!current) {
    throw shenHttpError(404, "子账号不存在");
  }
  if (action === "delete" || action === "remove" || action === "删除") {
    const sub = { ...current, deleted: true, updatedBy, updatedAt };
    await persistSub(sub);
    return {
      action: "delete",
      shop,
      sub,
      histories: [{ store: shop.store, accountId, subAccountId, field: "子账号主档", oldValue: "在用", newValue: "已删除" }]
    };
  }
  if (action === "restore" || action === "恢复") {
    const sub = { ...current, deleted: false, store: shop.store, updatedBy, updatedAt };
    await persistSub(sub);
    return {
      action: "restore",
      shop,
      sub,
      histories: [{ store: shop.store, accountId, subAccountId, field: "子账号主档", oldValue: "已删除", newValue: "已恢复" }]
    };
  }
  const sub = {
    ...current,
    store: shop.store,
    subAccountName: clip(pick(raw, ["子账号名称", "subAccountName"]) ?? current.subAccountName, 128, "子账号名称"),
    updatedBy,
    updatedAt
  };
  await persistSub(sub);
  const histories = [];
  if (sub.subAccountName !== current.subAccountName) {
    histories.push({
      store: shop.store,
      accountId,
      subAccountId,
      field: "子账号名称",
      oldValue: current.subAccountName,
      newValue: sub.subAccountName
    });
  }
  return { action: "update", shop, sub, histories };
}

function asCookieStatus(value, label) {
  const text = clip(value || "待录", 16, label) || "待录";
  if (!COOKIE_STATUSES.includes(text)) {
    throw shenHttpError(400, `${label}只能是待录/正常/过期/身份不符`);
  }
  return text;
}

function asExecStatus(value) {
  const text = clip(value || "已停止", 16, "执行状态") || "已停止";
  if (!EXEC_STATUSES.includes(text)) {
    throw shenHttpError(400, "执行状态只能是运行中/已停止/等待Cookie/异常");
  }
  return text;
}

export async function applyWorkerStatus(body, actor) {
  assertNoCookieBody(body);
  if (!body || typeof body !== "object") {
    throw shenHttpError(400, "请求体必须是对象");
  }
  const machineId = clip(body.machineId || "", 64, "machineId");
  if (!machineId) {
    throw shenHttpError(400, "machineId 必填");
  }
  const heartbeatAt = clip(body.heartbeatAt || nowShanghai(), 40, "heartbeatAt");
  const workerStatus = clip(body.workerStatus || "online", 16, "workerStatus") || "online";
  const configVersion = Number(body.configVersion || 0) || 0;
  const rows = Array.isArray(body.shops) ? body.shops : [];
  if (rows.length > 200) {
    throw shenHttpError(400, "状态一次最多 200 家店");
  }
  const current = await loadShopStatuses();
  const map = new Map(current.map((row) => [row.accountId, row]));
  const saved = [];
  for (const raw of rows) {
    const accountId = asId(pick(raw, ["京准通主账户ID", "accountId"]) || "", "京准通主账户ID");
    if (!accountId) {
      continue;
    }
    const prev = map.get(accountId) || { accountId };
    const next = {
      accountId,
      machineId,
      jztCookieStatus: asCookieStatus(pick(raw, ["京准通Cookie状态", "jztCookieStatus"]) ?? prev.jztCookieStatus, "京准通Cookie状态"),
      jztCookieUpdatedAt: clip(pick(raw, ["京准通Cookie更新时间", "jztCookieUpdatedAt"]) ?? prev.jztCookieUpdatedAt ?? "", 40, "京准通Cookie更新时间"),
      jmCookieStatus: asCookieStatus(pick(raw, ["京麦Cookie状态", "jmCookieStatus"]) ?? prev.jmCookieStatus, "京麦Cookie状态"),
      jmCookieUpdatedAt: clip(pick(raw, ["京麦Cookie更新时间", "jmCookieUpdatedAt"]) ?? prev.jmCookieUpdatedAt ?? "", 40, "京麦Cookie更新时间"),
      runStatus: asExecStatus(pick(raw, ["执行状态", "runStatus"]) ?? prev.runStatus),
      lastError: clip(pick(raw, ["最后错误", "lastError"]) ?? prev.lastError ?? "", 200, "最后错误"),
      heartbeatAt,
      workerStatus,
      configVersion
    };
    await persistStatus(next);
    saved.push(shopHeartbeatView(next));
    saved[saved.length - 1].accountId = accountId;
  }
  return {
    ok: true,
    machineId,
    heartbeatAt,
    workerStatus: workerStatus === "offline" || workerStatus === "离线" ? "离线" : "在线",
    configVersion,
    actor: actor?.username || "",
    saved: saved.length,
    shops: saved
  };
}
