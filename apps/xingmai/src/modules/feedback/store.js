import { dbMode, query } from "../profile/auth.js";
import { listPeople } from "../people/store.js";

const KINDS = new Set(["request", "feedback"]);
const STATUSES = new Set(["review", "doing", "accept", "closed", "mine", "rejected"]);
const TYPES = new Set(["feature", "suggest", "issue", "other"]);
const PRIORITIES = new Set(["P0", "P1", "P2"]);
const TITLE_MAX = 80;
const BODY_MAX = 2000;
const NOTE_MAX = 500;
const MODULE_MAX = 40;
const SHOT_MAX = 80000;
const SHOT_RE = /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=\s]+$/i;

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
    reqType: item.reqType,
    priority: item.priority,
    moduleName: item.moduleName || "",
    title: item.title,
    body: item.body,
    status: item.status,
    progress: item.progress,
    author: item.author,
    authorName: item.authorName,
    managerName: item.managerName || "",
    note: item.note,
    shot: item.shot || "",
    dueOn: item.dueOn || "",
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
      manager_name VARCHAR(128) NOT NULL DEFAULT '',
      note TEXT NOT NULL,
      shot MEDIUMTEXT NULL,
      created_at VARCHAR(40) NOT NULL,
      updated_at VARCHAR(40) NOT NULL,
      KEY idx_feedback_author (author)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
  await ignoreDuplicate(() =>
    query("ALTER TABLE feedback_items ADD COLUMN manager_name VARCHAR(128) NOT NULL DEFAULT ''")
  );
  await ignoreDuplicate(() => query("ALTER TABLE feedback_items ADD COLUMN shot MEDIUMTEXT NULL"));
  await ignoreDuplicate(() =>
    query("ALTER TABLE feedback_items ADD COLUMN req_type VARCHAR(16) NOT NULL DEFAULT 'feature'")
  );
  await ignoreDuplicate(() =>
    query("ALTER TABLE feedback_items ADD COLUMN priority VARCHAR(8) NOT NULL DEFAULT 'P2'")
  );
  await ignoreDuplicate(() =>
    query("ALTER TABLE feedback_items ADD COLUMN module_name VARCHAR(64) NOT NULL DEFAULT ''")
  );
  await ignoreDuplicate(() => query("ALTER TABLE feedback_items ADD COLUMN progress INT NOT NULL DEFAULT 0"));
  await ignoreDuplicate(() =>
    query("ALTER TABLE feedback_items ADD COLUMN due_on VARCHAR(16) NOT NULL DEFAULT ''")
  );
}

function normalizeStatus(value) {
  const status = text(value);
  if (status === "open" || status === "") {
    return "review";
  }
  return STATUSES.has(status) ? status : "";
}

function defaultProgress(status) {
  if (status === "doing") {
    return 40;
  }
  if (status === "accept") {
    return 80;
  }
  if (status === "closed") {
    return 100;
  }
  return 0;
}

function cleanProgress(value, status) {
  if (value == null || value === "") {
    return defaultProgress(status);
  }
  const progress = Number(value);
  if (!Number.isFinite(progress)) {
    return null;
  }
  return Math.max(0, Math.min(100, Math.round(progress)));
}

function cleanDue(value) {
  const due = text(value);
  if (!due) {
    return "";
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : null;
}

async function ignoreDuplicate(work) {
  try {
    await work();
  } catch (err) {
    const message = String(err && err.message ? err.message : err);
    if (!/Duplicate column|already exists|check that column/i.test(message)) {
      throw err;
    }
  }
}

function cleanShot(value) {
  const shot = String(value || "").replace(/\s+/g, "");
  if (!shot) {
    return "";
  }
  if (!SHOT_RE.test(shot) || shot.length > SHOT_MAX) {
    return null;
  }
  return shot;
}

function rowToItem(row) {
  const kind = KINDS.has(row.kind) ? row.kind : "feedback";
  const status = normalizeStatus(row.status) || "review";
  const reqType = TYPES.has(row.req_type) ? row.req_type : kind === "feedback" ? "issue" : "feature";
  const priority = PRIORITIES.has(row.priority) ? row.priority : "P2";
  const progress = cleanProgress(row.progress, status);
  return {
    id: Number(row.id),
    kind,
    reqType,
    priority,
    moduleName: text(row.module_name).slice(0, MODULE_MAX),
    title: text(row.title),
    body: String(row.body || ""),
    status,
    progress: progress == null ? defaultProgress(status) : progress,
    author: text(row.author),
    authorName: text(row.author_name) || text(row.author),
    managerName: text(row.manager_name),
    note: String(row.note || ""),
    shot: String(row.shot || ""),
    dueOn: cleanDue(row.due_on) || "",
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at)
  };
}

async function hydrateMysql() {
  items.clear();
  const [rows] = await query(
    `SELECT id, kind, title, body, status, author, author_name, manager_name, note, shot,
            req_type, priority, module_name, progress, due_on, created_at, updated_at
     FROM feedback_items`
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

async function managerNameOf(authorName) {
  try {
    const people = await listPeople();
    const person = people.find((item) => text(item.name) === authorName);
    return text(person && person.managerName);
  } catch {
    return "";
  }
}

export async function listItems(user, query) {
  const block = denied(user);
  if (block) {
    return block;
  }
  await readyStore();
  const kind = text(query && query.kind);
  const rawStatus = text(query && query.status);
  const status = rawStatus ? normalizeStatus(rawStatus) : "";
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
  const reqType = TYPES.has(text(body && body.reqType)) ? text(body.reqType) : "";
  let kind = text(body && body.kind);
  if (!KINDS.has(kind)) {
    kind = reqType === "issue" ? "feedback" : reqType ? "request" : "";
  }
  const title = text(body && body.title);
  const detail = text(body && body.body);
  if (!KINDS.has(kind)) {
    return { ok: false, statusCode: 400, error: "请选择需求类型" };
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
  const note = text(body && body.note);
  if (note.length > NOTE_MAX) {
    return { ok: false, statusCode: 400, error: "备注请控制在 500 字内" };
  }
  const shot = cleanShot(body && body.shot);
  if (shot == null) {
    return { ok: false, statusCode: 400, error: "截图太大或格式不对" };
  }
  const priority = PRIORITIES.has(text(body && body.priority)) ? text(body.priority) : "P2";
  const moduleName = text(body && body.moduleName);
  if (moduleName.length > MODULE_MAX) {
    return { ok: false, statusCode: 400, error: "所属模块请控制在 40 字内" };
  }
  const dueOn = cleanDue(body && body.dueOn);
  if (dueOn == null) {
    return { ok: false, statusCode: 400, error: "计划完成请写成日期" };
  }
  const progress = cleanProgress(body && body.progress, "review");
  if (progress == null) {
    return { ok: false, statusCode: 400, error: "进度请填 0 到 100" };
  }
  await readyStore();
  const stamp = nowStamp();
  const item = {
    id: 0,
    kind,
    reqType: reqType || (kind === "feedback" ? "issue" : "feature"),
    priority,
    moduleName,
    title,
    body: detail,
    status: "review",
    progress,
    author: who.author,
    authorName: who.authorName,
    managerName: await managerNameOf(who.authorName),
    note,
    shot,
    dueOn,
    createdAt: stamp,
    updatedAt: stamp
  };
  if (dbMode() === "mysql") {
    const [result] = await query(
      `INSERT INTO feedback_items
        (kind, title, body, status, author, author_name, manager_name, note, shot,
         req_type, priority, module_name, progress, due_on, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.kind,
        item.title,
        item.body,
        item.status,
        item.author,
        item.authorName,
        item.managerName,
        item.note,
        item.shot,
        item.reqType,
        item.priority,
        item.moduleName,
        item.progress,
        item.dueOn,
        item.createdAt,
        item.updatedAt
      ]
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
  const status = normalizeStatus(body && body.status);
  if (!status) {
    return { ok: false, statusCode: 400, error: "请选择待评审、开发中、待验收、已完成、待我处理或驳回" };
  }
  const hasNote = body && Object.prototype.hasOwnProperty.call(body, "note");
  const note = hasNote ? text(body.note) : null;
  if (note != null && note.length > NOTE_MAX) {
    return { ok: false, statusCode: 400, error: "处理说明请控制在 500 字内" };
  }
  const hasProgress = body && Object.prototype.hasOwnProperty.call(body, "progress");
  const progress = hasProgress ? cleanProgress(body.progress, status) : null;
  if (hasProgress && progress == null) {
    return { ok: false, statusCode: 400, error: "进度请填 0 到 100" };
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
    progress: progress == null ? (status === current.status ? current.progress : defaultProgress(status)) : progress,
    note: note == null ? current.note : note,
    updatedAt: stamp
  };
  if (status === "closed") {
    next.progress = 100;
  }
  if (dbMode() === "mysql") {
    await query("UPDATE feedback_items SET status = ?, note = ?, progress = ?, updated_at = ? WHERE id = ?", [
      next.status,
      next.note,
      next.progress,
      next.updatedAt,
      id
    ]);
  }
  items.set(id, next);
  return { ok: true, admin: true, item: cloneItem(next) };
}
