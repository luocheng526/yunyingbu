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
  resetBrief: `UPDATE shen_brief SET text = '' WHERE id = 1`
};

let poolOverride = null;
let nextId = 1;
let memoryTasks = [];
let memoryBrief = "";

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

export function resetStore() {
  nextId = 1;
  memoryTasks = [];
  memoryBrief = "";
}

export async function hydrateFromMysql() {
  await ensureStoreColumns();
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

export { STATUSES, DEFAULT_OWNER };
