import { dbMode, query } from "../profile/auth.js";

const DEFAULT_OWNER = "韩梦凯";
const STATUSES = ["待办", "进行中", "已完成"];

let seq = 1;
let tasks = [];
let brief = { text: "" };

function cloneTask(task) {
  return { ...task };
}

export function resetHanStore() {
  seq = 1;
  tasks = [];
  brief = { text: "" };
}

export async function hydrateFromMysql() {
  const [taskRows] = await query(
    "SELECT id, title, status, owner, created_at FROM han_tasks ORDER BY id ASC"
  );
  tasks = taskRows.map((row) => ({
    id: String(row.id),
    title: row.title,
    status: row.status,
    owner: row.owner,
    createdAt: row.created_at
  }));
  seq = tasks.reduce((max, task) => Math.max(max, Number(task.id) || 0), 0) + 1;
  const [briefRows] = await query("SELECT text FROM han_brief WHERE id = 1");
  if (briefRows.length) {
    brief = { text: briefRows[0].text == null ? "" : String(briefRows[0].text) };
  } else {
    await query("INSERT INTO han_brief (id, text) VALUES (1, ?)", [brief.text]);
  }
}

export async function listTasks() {
  if (dbMode() === "mysql") {
    const [rows] = await query(
      "SELECT id, title, status, owner, created_at FROM han_tasks ORDER BY id ASC"
    );
    return rows.map((row) => ({
      id: String(row.id),
      title: row.title,
      status: row.status,
      owner: row.owner,
      createdAt: row.created_at
    }));
  }
  return tasks.map(cloneTask);
}

export async function createTask({ title, status, owner } = {}) {
  const trimmed = String(title || "").trim();
  if (!trimmed) {
    const err = new Error("title required");
    err.statusCode = 400;
    throw err;
  }
  const task = {
    id: String(seq++),
    title: trimmed,
    status: STATUSES.includes(status) ? status : "待办",
    owner: owner && String(owner).trim() ? String(owner).trim() : DEFAULT_OWNER,
    createdAt: new Date().toISOString()
  };
  if (dbMode() === "mysql") {
    const [result] = await query(
      "INSERT INTO han_tasks (title, status, owner, created_at) VALUES (?, ?, ?, ?)",
      [task.title, task.status, task.owner, task.createdAt]
    );
    task.id = String(result.insertId);
    return cloneTask(task);
  }
  tasks.push(task);
  return cloneTask(task);
}

export async function getBrief() {
  if (dbMode() === "mysql") {
    const [rows] = await query("SELECT text FROM han_brief WHERE id = 1");
    return { text: rows[0] ? String(rows[0].text || "") : "" };
  }
  return { text: brief.text };
}

export async function setBrief({ text } = {}) {
  const next = { text: text == null ? "" : String(text) };
  if (dbMode() === "mysql") {
    await query(
      "INSERT INTO han_brief (id, text) VALUES (1, ?) ON DUPLICATE KEY UPDATE text = VALUES(text)",
      [next.text]
    );
    return next;
  }
  brief = next;
  return { text: brief.text };
}

export const HAN_DEFAULT_OWNER = DEFAULT_OWNER;
export const HAN_STATUSES = STATUSES;
