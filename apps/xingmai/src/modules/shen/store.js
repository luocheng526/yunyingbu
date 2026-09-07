import { dbMode, query } from "../profile/auth.js";

const STATUSES = ["待办", "进行中", "已完成"];
const DEFAULT_OWNER = "沈子晗";

let nextId = 1;
let tasks = [];
let briefText = "";

export function resetStore() {
  nextId = 1;
  tasks = [];
  briefText = "";
}

export async function hydrateFromMysql() {
  const [taskRows] = await query("SELECT id, title, status, owner FROM shen_tasks ORDER BY id ASC");
  tasks = taskRows.map((row) => ({
    id: Number(row.id),
    title: row.title,
    status: row.status,
    owner: row.owner
  }));
  nextId = tasks.reduce((max, task) => Math.max(max, Number(task.id) || 0), 0) + 1;
  const [briefRows] = await query("SELECT text FROM shen_brief WHERE id = 1");
  if (briefRows.length) {
    briefText = briefRows[0].text == null ? "" : String(briefRows[0].text);
  } else {
    await query("INSERT INTO shen_brief (id, text) VALUES (1, ?)", [briefText]);
  }
}

export async function listTasks() {
  if (dbMode() === "mysql") {
    const [rows] = await query("SELECT id, title, status, owner FROM shen_tasks ORDER BY id ASC");
    return rows.map((row) => ({
      id: Number(row.id),
      title: row.title,
      status: row.status,
      owner: row.owner
    }));
  }
  return tasks.map((task) => ({ ...task }));
}

export async function addTask(title) {
  const trimmed = String(title ?? "").trim();
  if (!trimmed) {
    const error = new Error("标题必填");
    error.statusCode = 400;
    throw error;
  }
  const task = {
    id: nextId,
    title: trimmed,
    status: "待办",
    owner: DEFAULT_OWNER
  };
  if (dbMode() === "mysql") {
    const [result] = await query("INSERT INTO shen_tasks (title, status, owner) VALUES (?, ?, ?)", [
      task.title,
      task.status,
      task.owner
    ]);
    task.id = Number(result.insertId);
    return { ...task };
  }
  nextId += 1;
  tasks.push(task);
  return { ...task };
}

export async function getBrief() {
  if (dbMode() === "mysql") {
    const [rows] = await query("SELECT text FROM shen_brief WHERE id = 1");
    return { text: rows[0] ? String(rows[0].text || "") : "" };
  }
  return { text: briefText };
}

export async function setBrief(text) {
  const next = String(text ?? "");
  if (dbMode() === "mysql") {
    await query(
      "INSERT INTO shen_brief (id, text) VALUES (1, ?) ON DUPLICATE KEY UPDATE text = VALUES(text)",
      [next]
    );
    return { text: next };
  }
  briefText = next;
  return { text: briefText };
}

export { STATUSES, DEFAULT_OWNER };
