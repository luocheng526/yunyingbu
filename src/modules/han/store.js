const DEFAULT_OWNER = "韩梦凯";
const STATUSES = ["待办", "进行中", "已完成"];

let seq = 1;
const tasks = [];
let brief = { text: "" };

export function listTasks() {
  return tasks.map((t) => ({ ...t }));
}

export function createTask({ title, status, owner } = {}) {
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
    createdAt: new Date().toISOString(),
  };
  tasks.push(task);
  return { ...task };
}

export function getBrief() {
  return { text: brief.text };
}

export function setBrief({ text } = {}) {
  brief = { text: text == null ? "" : String(text) };
  return { text: brief.text };
}

export const HAN_DEFAULT_OWNER = DEFAULT_OWNER;
export const HAN_STATUSES = STATUSES;
