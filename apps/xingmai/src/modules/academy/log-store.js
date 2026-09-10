import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { dbMode, query } from "../profile/auth.js";

const ROOT = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(ROOT, "data", "handbook");
const LOG_FILE = join(DATA_DIR, "logs.json");
const MAX_LOGS = 400;

let memoryLogs = [];

function nowIso() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

async function ensureTable() {
  if (dbMode() !== "mysql") {
    return;
  }
  await query(`
    CREATE TABLE IF NOT EXISTS academy_handbook_logs (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      at VARCHAR(32) NOT NULL,
      actor VARCHAR(64) NOT NULL,
      actor_name VARCHAR(128) NOT NULL,
      action VARCHAR(64) NOT NULL,
      section_id VARCHAR(64) NOT NULL DEFAULT '',
      section_title VARCHAR(160) NOT NULL DEFAULT '',
      detail VARCHAR(500) NOT NULL DEFAULT ''
    )
  `);
}

async function loadFileLogs() {
  try {
    const raw = await readFile(LOG_FILE, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return [];
  }
}

async function saveFileLogs(items) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(LOG_FILE, JSON.stringify({ items }, null, 2));
}

export async function appendHandbookLog({ actor, actorName, action, sectionId, sectionTitle, detail } = {}) {
  const item = {
    at: nowIso(),
    actor: String(actor || "").slice(0, 64),
    actorName: String(actorName || actor || "").slice(0, 128),
    action: String(action || "改手册").slice(0, 64),
    sectionId: String(sectionId || "").slice(0, 64),
    sectionTitle: String(sectionTitle || "").slice(0, 160),
    detail: String(detail || "").slice(0, 500)
  };
  if (dbMode() === "mysql") {
    await ensureTable();
    await query(
      `INSERT INTO academy_handbook_logs (at, actor, actor_name, action, section_id, section_title, detail)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [item.at, item.actor, item.actorName, item.action, item.sectionId, item.sectionTitle, item.detail]
    );
    return item;
  }
  memoryLogs = [item, ...memoryLogs].slice(0, MAX_LOGS);
  const disk = [item, ...(await loadFileLogs())].slice(0, MAX_LOGS);
  await saveFileLogs(disk);
  return item;
}

export async function listHandbookLogs(limit = 100) {
  const take = Math.min(200, Math.max(1, Number(limit) || 100));
  if (dbMode() === "mysql") {
    await ensureTable();
    const [rows] = await query(
      `SELECT at, actor, actor_name AS actorName, action, section_id AS sectionId,
              section_title AS sectionTitle, detail
       FROM academy_handbook_logs
       ORDER BY id DESC
       LIMIT ?`,
      [take]
    );
    return Array.isArray(rows) ? rows : [];
  }
  if (memoryLogs.length) {
    return memoryLogs.slice(0, take);
  }
  const disk = await loadFileLogs();
  memoryLogs = disk.slice(0, MAX_LOGS);
  return memoryLogs.slice(0, take);
}

export async function resetHandbookLogsForTests() {
  memoryLogs = [];
  await rm(LOG_FILE, { force: true });
}
