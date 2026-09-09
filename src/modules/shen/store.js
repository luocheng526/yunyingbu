import { getPool } from "../../db/pool.js";

const STATUSES = ["待办", "进行中", "已完成"];
const DEFAULT_OWNER = "沈子晗";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 366;

export const SQL = {
  createTasks: `CREATE TABLE IF NOT EXISTS shen_tasks (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT '待办',
  owner VARCHAR(64) NOT NULL DEFAULT '沈子晗',
  store VARCHAR(64) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_shen_tasks_store_created (store, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  createBriefs: `CREATE TABLE IF NOT EXISTS shen_briefs (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  text MEDIUMTEXT NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ensureBriefRow: `INSERT IGNORE INTO shen_briefs (id, text) VALUES (1, '')`,
  addStoreColumn: `ALTER TABLE shen_tasks ADD COLUMN store VARCHAR(64) NOT NULL DEFAULT ''`,
  listTasks: `SELECT id, title, status, owner, store, created_at FROM shen_tasks ORDER BY id ASC`,
  insertTask: `INSERT INTO shen_tasks (title, status, owner, store) VALUES (?, ?, ?, ?)`,
  summarizeTasks: `SELECT status, COUNT(*) AS cnt FROM shen_tasks WHERE store = ? AND created_at >= ? AND created_at < ? GROUP BY status`,
  getBrief: `SELECT text FROM shen_briefs WHERE id = 1`,
  setBrief: `UPDATE shen_briefs SET text = ? WHERE id = 1`,
  resetTasks: `DELETE FROM shen_tasks`,
  resetBrief: `UPDATE shen_briefs SET text = '' WHERE id = 1`
};

let poolOverride = null;
let schemaReady = false;

export function setPool(pool) {
  poolOverride = pool;
  schemaReady = false;
}

function pool() {
  return poolOverride || getPool();
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

export async function ensureSchema() {
  if (schemaReady) {
    return;
  }
  const db = pool();
  await db.query(SQL.createTasks);
  await db.query(SQL.createBriefs);
  await db.query(SQL.ensureBriefRow);
  try {
    await db.query(SQL.addStoreColumn);
  } catch (err) {
    if (!isDuplicateColumnError(err)) {
      throw err;
    }
  }
  schemaReady = true;
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
  const toExclusiveDay = nextDay.toISOString().slice(0, 10);
  return {
    store: storeName,
    from: fromDay,
    to: toDay,
    fromAt: `${fromDay} 00:00:00`,
    toExclusiveAt: `${toExclusiveDay} 00:00:00`
  };
}

export async function listTasks() {
  await ensureSchema();
  const [rows] = await pool().query(SQL.listTasks);
  return rows.map(mapTask);
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
  await ensureSchema();
  const [result] = await pool().query(SQL.insertTask, [trimmed, "待办", DEFAULT_OWNER, storeName]);
  return {
    id: Number(result.insertId),
    title: trimmed,
    status: "待办",
    owner: DEFAULT_OWNER,
    store: storeName
  };
}

export async function getStoreSummary({ store, from, to }) {
  const query = parseSummaryQuery({ store, from, to });
  await ensureSchema();
  const [rows] = await pool().query(SQL.summarizeTasks, [query.store, query.fromAt, query.toExclusiveAt]);
  const byStatus = Object.fromEntries(STATUSES.map((status) => [status, 0]));
  let total = 0;
  for (const row of rows) {
    const count = Number(row.cnt) || 0;
    total += count;
    if (Object.prototype.hasOwnProperty.call(byStatus, row.status)) {
      byStatus[row.status] = count;
    }
  }
  return {
    ok: true,
    store: query.store,
    from: query.from,
    to: query.to,
    tasks: { total, byStatus }
  };
}

export async function getBrief() {
  await ensureSchema();
  const [rows] = await pool().query(SQL.getBrief);
  const text = rows[0]?.text ?? "";
  return { text };
}

export async function setBrief(text) {
  await ensureSchema();
  const next = String(text ?? "");
  await pool().query(SQL.setBrief, [next]);
  return { text: next };
}

export async function resetStore() {
  schemaReady = false;
  await ensureSchema();
  await pool().query(SQL.resetTasks);
  await pool().query(SQL.resetBrief);
}

export { STATUSES, DEFAULT_OWNER };
