const STATUSES = ["待办", "进行中", "已完成"];
const DEFAULT_OWNER = "沈子晗";

let nextId = 1;
let tasks = [];
let briefText = "";

export function listTasks() {
  return tasks.map((task) => ({ ...task }));
}

export function addTask(title) {
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
  nextId += 1;
  tasks.push(task);
  return { ...task };
}

export function getBrief() {
  return { text: briefText };
}

export function setBrief(text) {
  briefText = String(text ?? "");
  return { text: briefText };
}

export function resetStore() {
  nextId = 1;
  tasks = [];
  briefText = "";
}

export { STATUSES, DEFAULT_OWNER };
