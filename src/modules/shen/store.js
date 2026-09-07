import { getPool } from "../../db/pool.js";

const STATUSES = ["待办", "进行中", "已完成"];
const DEFAULT_OWNER = "沈子晗";

export const SQL = {
  createTasks: `CREATE TABLE IF NOT EXISTS shen_tasks (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT '待办',
  owner VARCHAR(64) NOT NULL DEFAULT '沈子晗',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  createBriefs: `CREATE TABLE IF NOT EXISTS shen_briefs (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  text MEDIUMTEXT NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ensureBriefRow: `INSERT IGNORE INTO shen_briefs (id, text) VALUES (1, '')`,
  listTasks: `SELECT id, title, status, owner FROM shen_tasks ORDER BY id ASC`,
  insertTask: `INSERT INTO shen_tasks (title, status, owner) VALUES (?, ?, ?)`,
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

export async function ensureSchema() {
  if (schemaReady) {
    return;
  }
  const db = pool();
  await db.query(SQL.createTasks);
  await db.query(SQL.createBriefs);
  await db.query(SQL.ensureBriefRow);
  schemaReady = true;
}

function mapTask(row) {
  return {
    id: Number(row.id),
    title: row.title,
    status: row.status,
    owner: row.owner
  };
}

export async function listTasks() {
  await ensureSchema();
  const [rows] = await pool().query(SQL.listTasks);
  return rows.map(mapTask);
}

export async function addTask(title) {
  const trimmed = String(title ?? "").trim();
  if (!trimmed) {
    const error = new Error("标题必填");
    error.statusCode = 400;
    throw error;
  }
  await ensureSchema();
  const [result] = await pool().query(SQL.insertTask, [trimmed, "待办", DEFAULT_OWNER]);
  return {
    id: Number(result.insertId),
    title: trimmed,
    status: "待办",
    owner: DEFAULT_OWNER
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
