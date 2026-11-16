import { dbMode, query } from "../profile/auth.js";

const KINDS = new Set(["request", "feedback"]);
const STATUSES = new Set(["open", "doing", "closed"]);
const TITLE_MAX = 80;
const BODY_MAX = 2000;
const NOTE_MAX = 500;

let ready = false;
let seq = 0;
const items = new Map();

function nowStamp() {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Shanghai", hour12: false }).replace("T", " ").slice(0, 19);
}

function text(value) {
  return String(value == null ? "" : value).trim();
}

function namesOf(user) {
  if (!user) {
    return [];
  }
  if (typeof user === "string") {
    return [user.trim()].filter(Boolean);
  }
  return [user.username, user.displayName, user.name]
    .map((value) => text(value))
    .filter(Boolean);
}

export function isFeedbackAdmin(user) {
  return namesOf(user).some((name) => name === "罗成" || name.toLowerCase() === "luocheng");
}

function denied(user) {
  if (!user) {
    return { ok: false, statusCode: 401, error: "未登录" };
  }
  if (!isFeedbackAdmin(user) && text(user.desk) === "hr") {
    return { ok: false, statusCode: 403, error: "人事账号只使用智能人事和个人中心" };
  }
  return null;
}

function actor(user) {
  const author = text(user.username || user.name || user.displayName);
  const authorName = text(user.displayName || user.username || user.name) || author;
  return { author, authorName };
}

function owns(item, user) {
  return namesOf(user).includes(item.author);
}

function cloneItem(item) {
  return {
    id: item.id,
    kind: item.kind,
    title: item.title,
    body: item.body,
    status: item.status,
    author: item.author,
    authorName: item.authorName,
    note: item.note,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

function visibleItems(user) {
  const list = [...items.values()];
  const mine = isFeedbackAdmin(user) ? list : list.filter((item) => owns(item, user));
  mine.sort((a, b) => {
    if (a.updatedAt !== b.updatedAt) {
      return a.updatedAt < b.updatedAt ? 1 : -1;
    }
    return b.id - a.id;
  });
  return mine;
}

export function resetFeedbackStore() {
  ready = false;
  seq = 0;
  items.clear();
}

async function ensureTables() {
  await query(
    `CREATE TABLE IF NOT EXISTS feedback_items (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      kind VARCHAR(16) NOT NULL,
      title VARCHAR(200) NOT NULL,
      body TEXT NOT NULL,
      status VARCHAR(16) NOT NULL,
      author VARCHAR(64) NOT NULL,
      author_name VARCHAR(128) NOT NULL,
      note TEXT NOT NULL,
      created_at VARCHAR(40) NOT NULL,
      updated_at VARCHAR(40) NOT NULL,
      KEY idx_feedback_author (author)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
}

function rowToItem(row) {
  const kind = KINDS.has(row.kind) ? row.kind : "feedback";
  const status = STATUSES.has(row.status) ? row.status : "open";
  return {
    id: Number(row.id),
    kind,
    title: text(row.title),
    body: String(row.body || ""),
    status,
    author: text(row.author),
    authorName: text(row.author_name) || text(row.author),
    note: String(row.note || ""),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at)
  };
}

async function hydrateMysql() {
  items.clear();
  const [rows] = await query(
    "SELECT id, kind, title, body, status, author, author_name, note, created_at, updated_at FROM feedback_items"
  );
  let max = 0;
  for (const row of rows) {
    const item = rowToItem(row);
    if (!item.id) {
      continue;
    }
    items.set(item.id, item);
    if (item.id > max) {
      max = item.id;
    }
  }
  seq = max;
}

async function readyStore() {
  if (ready) {
    return;
  }
  if (dbMode() === "mysql") {
    await ensureTables();
    await hydrateMysql();
  }
  ready = true;
}

function nextId() {
  seq += 1;
  return seq;
}

export async function listItems(user, query) {
  const block = denied(user);
  if (block) {
    return block;
  }
  await readyStore();
  const kind = text(query && query.kind);
  const status = text(query && query.status);
  const itemsOut = visibleItems(user)
    .filter((item) => !kind || item.kind === kind)
    .filter((item) => !status || item.status === status)
    .map(cloneItem);
  return { ok: true, admin: isFeedbackAdmin(user), items: itemsOut };
}

export async function createItem(user, body) {
  const block = denied(user);
  if (block) {
    return block;
  }
  const kind = text(body && body.kind);
  const title = text(body && body.title);
  const detail = text(body && body.body);
  if (!KINDS.has(kind)) {
    return { ok: false, statusCode: 400, error: "请选择需求或反馈" };
  }
  if (!title) {
    return { ok: false, statusCode: 400, error: "请填写标题" };
  }
  if (title.length > TITLE_MAX) {
    return { ok: false, statusCode: 400, error: "标题请控制在 80 字内" };
  }
  if (!detail) {
    return { ok: false, statusCode: 400, error: "请填写内容" };
  }
  if (detail.length > BODY_MAX) {
    return { ok: false, statusCode: 400, error: "内容请控制在 2000 字内" };
  }
  const who = actor(user);
  if (!who.author) {
    return { ok: false, statusCode: 400, error: "无法识别提交人" };
  }
  await readyStore();
  const stamp = nowStamp();
  const item = {
    id: 0,
    kind,
    title,
    body: detail,
    status: "open",
    author: who.author,
    authorName: who.authorName,
    note: "",
    createdAt: stamp,
    updatedAt: stamp
  };
  if (dbMode() === "mysql") {
    const [result] = await query(
      `INSERT INTO feedback_items
        (kind, title, body, status, author, author_name, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [item.kind, item.title, item.body, item.status, item.author, item.authorName, item.note, item.createdAt, item.updatedAt]
    );
    item.id = Number(result.insertId);
    if (item.id > seq) {
      seq = item.id;
    }
  } else {
    item.id = nextId();
  }
  items.set(item.id, item);
  return { ok: true, admin: isFeedbackAdmin(user), item: cloneItem(item) };
}

export async function updateItem(user, rawId, body) {
  const block = denied(user);
  if (block) {
    return block;
  }
  if (!isFeedbackAdmin(user)) {
    return { ok: false, statusCode: 403, error: "只有罗成能处理或关闭" };
  }
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, statusCode: 400, error: "记录不存在" };
  }
  const status = text(body && body.status);
  if (!STATUSES.has(status)) {
    return { ok: false, statusCode: 400, error: "请选择待处理、处理中或已关闭" };
  }
  const hasNote = body && Object.prototype.hasOwnProperty.call(body, "note");
  const note = hasNote ? text(body.note) : null;
  if (note != null && note.length > NOTE_MAX) {
    return { ok: false, statusCode: 400, error: "处理说明请控制在 500 字内" };
  }
  await readyStore();
  const current = items.get(id);
  if (!current) {
    return { ok: false, statusCode: 404, error: "记录不存在" };
  }
  const stamp = nowStamp();
  const next = {
    ...current,
    status,
    note: note == null ? current.note : note,
    updatedAt: stamp
  };
  if (dbMode() === "mysql") {
    await query("UPDATE feedback_items SET status = ?, note = ?, updated_at = ? WHERE id = ?", [
      next.status,
      next.note,
      next.updatedAt,
      id
    ]);
  }
  items.set(id, next);
  return { ok: true, admin: true, item: cloneItem(next) };
}
