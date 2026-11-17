import { dbMode, query } from "../profile/auth.js";

export const PLATFORMS = ["京东", "天猫", "抖音", "拼多多", "其他"];
export const STORE_STATUSES = ["正常", "维护中", "停用"];
export const RECORD_KINDS = ["日常巡检", "账号密码", "资质证照", "活动报名", "纠纷处理", "其他"];
export const RECORD_STATUSES = ["待处理", "进行中", "已完成"];

const STORE_SELECT =
  "SELECT id, name, platform, shop_code, status, owner, pack, note, created_at, updated_at FROM stores_archives ORDER BY id ASC";
const RECORD_SELECT =
  "SELECT id, store_id, kind, happened_on, content, operator, status, created_at, updated_at FROM stores_records ORDER BY id DESC";

const CREATE_ARCHIVES = `CREATE TABLE IF NOT EXISTS stores_archives (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  platform VARCHAR(32) NOT NULL,
  shop_code VARCHAR(64) NOT NULL DEFAULT '',
  status VARCHAR(16) NOT NULL,
  owner VARCHAR(64) NOT NULL DEFAULT '',
  pack VARCHAR(64) NOT NULL DEFAULT '',
  note VARCHAR(500) NOT NULL DEFAULT '',
  created_at VARCHAR(32) NOT NULL,
  updated_at VARCHAR(32) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

const CREATE_RECORDS = `CREATE TABLE IF NOT EXISTS stores_records (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  store_id INT NOT NULL,
  kind VARCHAR(32) NOT NULL,
  happened_on VARCHAR(16) NOT NULL,
  content VARCHAR(1000) NOT NULL,
  operator VARCHAR(64) NOT NULL DEFAULT '',
  status VARCHAR(16) NOT NULL,
  created_at VARCHAR(32) NOT NULL,
  updated_at VARCHAR(32) NOT NULL,
  INDEX idx_stores_records_store (store_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

let schemaReady = false;
let nextStoreId = 1;
let nextRecordId = 1;
let stores = [];
let records = [];

export function resetStoresStore() {
  schemaReady = false;
  nextStoreId = 1;
  nextRecordId = 1;
  stores = [];
  records = [];
}

function nowStamp() {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Shanghai" }).replace(" ", "T");
}

export function todayShanghai() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
}

function fail(statusCode, error) {
  return { ok: false, statusCode, error };
}

function trim(value, max) {
  const text = String(value ?? "").trim();
  return max ? text.slice(0, max) : text;
}

function storeFromRow(row) {
  return {
    id: Number(row.id),
    name: row.name,
    platform: row.platform,
    shopCode: row.shop_code == null ? "" : String(row.shop_code),
    status: row.status,
    owner: row.owner == null ? "" : String(row.owner),
    pack: row.pack == null ? "" : String(row.pack),
    note: row.note == null ? "" : String(row.note),
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || ""
  };
}

function recordFromRow(row) {
  return {
    id: Number(row.id),
    storeId: Number(row.store_id),
    kind: row.kind,
    happenedOn: row.happened_on || "",
    content: row.content == null ? "" : String(row.content),
    operator: row.operator == null ? "" : String(row.operator),
    status: row.status,
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || ""
  };
}

function cloneStore(store) {
  return { ...store, id: Number(store.id) };
}

function cloneRecord(record) {
  return { ...record, id: Number(record.id), storeId: Number(record.storeId) };
}

function parseStoreBody(body, existing) {
  const name = trim(body.name, 128);
  const platform = trim(body.platform, 32) || existing?.platform || "京东";
  const shopCode = trim(body.shopCode ?? body.shop_code, 64);
  const status = trim(body.status, 16) || existing?.status || "正常";
  const owner = trim(body.owner, 64);
  const pack = trim(body.pack, 64);
  const note = trim(body.note, 500);
  if (!name) {
    return fail(400, "店铺名称必填");
  }
  if (!PLATFORMS.includes(platform)) {
    return fail(400, "平台不在允许列表中");
  }
  if (!STORE_STATUSES.includes(status)) {
    return fail(400, "店铺状态不在允许列表中");
  }
  return {
    ok: true,
    store: {
      name,
      platform,
      shopCode,
      status,
      owner,
      pack,
      note
    }
  };
}

function parseRecordBody(body, existing) {
  const storeId = Number(body.storeId ?? body.store_id ?? existing?.storeId);
  const kind = trim(body.kind, 32) || existing?.kind || "日常巡检";
  const happenedOn = trim(body.happenedOn ?? body.happened_on, 16) || existing?.happenedOn || todayShanghai();
  const content = trim(body.content, 1000);
  const operator = trim(body.operator, 64);
  const status = trim(body.status, 16) || existing?.status || "待处理";
  if (!Number.isInteger(storeId) || storeId <= 0) {
    return fail(400, "必须选择店铺");
  }
  if (!RECORD_KINDS.includes(kind)) {
    return fail(400, "维护类型不在允许列表中");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(happenedOn)) {
    return fail(400, "日期格式应为 YYYY-MM-DD");
  }
  if (!content) {
    return fail(400, "维护内容必填");
  }
  if (!RECORD_STATUSES.includes(status)) {
    return fail(400, "记录状态不在允许列表中");
  }
  return {
    ok: true,
    record: { storeId, kind, happenedOn, content, operator, status }
  };
}

export async function ensureStoresSchema() {
  if (dbMode() !== "mysql" || schemaReady) {
    return;
  }
  await query(CREATE_ARCHIVES);
  await query(CREATE_RECORDS);
  schemaReady = true;
}

async function loadStores() {
  if (dbMode() === "mysql") {
    await ensureStoresSchema();
    const [rows] = await query(STORE_SELECT);
    return rows.map(storeFromRow);
  }
  return stores.map(cloneStore);
}

async function loadRecords() {
  if (dbMode() === "mysql") {
    await ensureStoresSchema();
    const [rows] = await query(RECORD_SELECT);
    return rows.map(recordFromRow);
  }
  return records.map(cloneRecord).sort((a, b) => b.id - a.id);
}

function findStore(list, id) {
  return list.find((item) => Number(item.id) === Number(id)) || null;
}

function findRecord(list, id) {
  return list.find((item) => Number(item.id) === Number(id)) || null;
}

function shopCodeTaken(list, shopCode, exceptId) {
  if (!shopCode) {
    return false;
  }
  return list.some((item) => item.shopCode === shopCode && Number(item.id) !== Number(exceptId || 0));
}

export function summarize(storeList, recordList) {
  const openRecords = recordList.filter((item) => item.status !== "已完成").length;
  return {
    total: storeList.length,
    normal: storeList.filter((item) => item.status === "正常").length,
    maintaining: storeList.filter((item) => item.status === "维护中").length,
    stopped: storeList.filter((item) => item.status === "停用").length,
    records: recordList.length,
    openRecords
  };
}

export async function snapshot() {
  const storeList = await loadStores();
  const recordList = await loadRecords();
  return {
    stores: storeList,
    records: recordList,
    platforms: PLATFORMS,
    storeStatuses: STORE_STATUSES,
    recordKinds: RECORD_KINDS,
    recordStatuses: RECORD_STATUSES,
    summary: summarize(storeList, recordList)
  };
}

export async function createStore(body) {
  const parsed = parseStoreBody(body || {}, null);
  if (!parsed.ok) {
    return parsed;
  }
  const list = await loadStores();
  if (shopCodeTaken(list, parsed.store.shopCode, 0)) {
    return fail(409, "同一店铺ID已有档案，请改原档案或换ID");
  }
  const stamp = nowStamp();
  const store = { ...parsed.store, createdAt: stamp, updatedAt: stamp };
  if (dbMode() === "mysql") {
    await ensureStoresSchema();
    const [result] = await query(
      "INSERT INTO stores_archives (name, platform, shop_code, status, owner, pack, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        store.name,
        store.platform,
        store.shopCode,
        store.status,
        store.owner,
        store.pack,
        store.note,
        store.createdAt,
        store.updatedAt
      ]
    );
    store.id = Number(result.insertId);
    return { ok: true, store };
  }
  store.id = nextStoreId;
  nextStoreId += 1;
  stores.push(store);
  return { ok: true, store: cloneStore(store) };
}

export async function updateStore(id, body) {
  const list = await loadStores();
  const existing = findStore(list, id);
  if (!existing) {
    return fail(404, "店铺档案不存在");
  }
  const parsed = parseStoreBody({ ...existing, ...(body || {}) }, existing);
  if (!parsed.ok) {
    return parsed;
  }
  if (shopCodeTaken(list, parsed.store.shopCode, existing.id)) {
    return fail(409, "同一店铺ID已有档案，请改原档案或换ID");
  }
  const store = { ...existing, ...parsed.store, updatedAt: nowStamp() };
  if (dbMode() === "mysql") {
    await ensureStoresSchema();
    await query(
      "UPDATE stores_archives SET name = ?, platform = ?, shop_code = ?, status = ?, owner = ?, pack = ?, note = ?, updated_at = ? WHERE id = ?",
      [
        store.name,
        store.platform,
        store.shopCode,
        store.status,
        store.owner,
        store.pack,
        store.note,
        store.updatedAt,
        store.id
      ]
    );
    return { ok: true, store };
  }
  const index = stores.findIndex((item) => Number(item.id) === Number(id));
  stores[index] = store;
  return { ok: true, store: cloneStore(store) };
}

export async function deleteStore(id) {
  const list = await loadStores();
  const existing = findStore(list, id);
  if (!existing) {
    return fail(404, "店铺档案不存在");
  }
  if (dbMode() === "mysql") {
    await ensureStoresSchema();
    await query("DELETE FROM stores_records WHERE store_id = ?", [existing.id]);
    await query("DELETE FROM stores_archives WHERE id = ?", [existing.id]);
    return { ok: true, id: existing.id };
  }
  stores = stores.filter((item) => Number(item.id) !== Number(id));
  records = records.filter((item) => Number(item.storeId) !== Number(id));
  return { ok: true, id: existing.id };
}

export async function createRecord(body) {
  const parsed = parseRecordBody(body || {}, null);
  if (!parsed.ok) {
    return parsed;
  }
  const storeList = await loadStores();
  if (!findStore(storeList, parsed.record.storeId)) {
    return fail(400, "店铺档案不存在");
  }
  const stamp = nowStamp();
  const record = { ...parsed.record, createdAt: stamp, updatedAt: stamp };
  if (dbMode() === "mysql") {
    await ensureStoresSchema();
    const [result] = await query(
      "INSERT INTO stores_records (store_id, kind, happened_on, content, operator, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        record.storeId,
        record.kind,
        record.happenedOn,
        record.content,
        record.operator,
        record.status,
        record.createdAt,
        record.updatedAt
      ]
    );
    record.id = Number(result.insertId);
    return { ok: true, record };
  }
  record.id = nextRecordId;
  nextRecordId += 1;
  records.push(record);
  return { ok: true, record: cloneRecord(record) };
}

export async function updateRecord(id, body) {
  const list = await loadRecords();
  const existing = findRecord(list, id);
  if (!existing) {
    return fail(404, "维护记录不存在");
  }
  const parsed = parseRecordBody({ ...existing, ...(body || {}) }, existing);
  if (!parsed.ok) {
    return parsed;
  }
  const storeList = await loadStores();
  if (!findStore(storeList, parsed.record.storeId)) {
    return fail(400, "店铺档案不存在");
  }
  const record = { ...existing, ...parsed.record, updatedAt: nowStamp() };
  if (dbMode() === "mysql") {
    await ensureStoresSchema();
    await query(
      "UPDATE stores_records SET store_id = ?, kind = ?, happened_on = ?, content = ?, operator = ?, status = ?, updated_at = ? WHERE id = ?",
      [
        record.storeId,
        record.kind,
        record.happenedOn,
        record.content,
        record.operator,
        record.status,
        record.updatedAt,
        record.id
      ]
    );
    return { ok: true, record };
  }
  const index = records.findIndex((item) => Number(item.id) === Number(id));
  records[index] = record;
  return { ok: true, record: cloneRecord(record) };
}

export async function deleteRecord(id) {
  const list = await loadRecords();
  const existing = findRecord(list, id);
  if (!existing) {
    return fail(404, "维护记录不存在");
  }
  if (dbMode() === "mysql") {
    await ensureStoresSchema();
    await query("DELETE FROM stores_records WHERE id = ?", [existing.id]);
    return { ok: true, id: existing.id };
  }
  records = records.filter((item) => Number(item.id) !== Number(id));
  return { ok: true, id: existing.id };
}
