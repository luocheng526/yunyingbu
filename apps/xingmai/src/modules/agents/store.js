import { dbMode, query } from "../profile/auth.js";
import { defaultModelId } from "./models.js";

const MAX_TEXT = 2000;
const MAX_TITLE = 40;
const MAX_UPLOAD = 1.5 * 1024 * 1024;

let sessions = [];
let messages = [];
let uploads = [];
let nextSessionId = 1;
let nextMessageId = 1;
let nextUploadId = 1;
let schemaReady = false;

function nowStamp() {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Shanghai" });
}

export function fail(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function resetAgentsStore() {
  sessions = [];
  messages = [];
  uploads = [];
  nextSessionId = 1;
  nextMessageId = 1;
  nextUploadId = 1;
  schemaReady = false;
}

async function ignoreSchemaNoise(work) {
  try {
    await work();
  } catch (err) {
    const message = String(err && err.message ? err.message : err);
    if (!/Duplicate column|Duplicate key|already exists|Unknown column|Unknown table|check that it exists/i.test(message)) {
      throw err;
    }
  }
}

export async function ensureAgentsSchema() {
  if (dbMode() !== "mysql" || schemaReady) {
    return;
  }
  await query(
    "CREATE TABLE IF NOT EXISTS agents_sessions (id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, username VARCHAR(64) NOT NULL, model_id VARCHAR(64) NOT NULL, title VARCHAR(128) NOT NULL, created_at VARCHAR(32) NOT NULL, updated_at VARCHAR(32) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
  );
  await query(
    "CREATE TABLE IF NOT EXISTS agents_messages (id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, session_id INT NOT NULL, role VARCHAR(16) NOT NULL, text TEXT NOT NULL, file_ids VARCHAR(255) NOT NULL DEFAULT '[]', model_id VARCHAR(64) NOT NULL DEFAULT '', sources VARCHAR(255) NOT NULL DEFAULT '[]', created_at VARCHAR(32) NOT NULL, KEY session_id (session_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
  );
  await query(
    "CREATE TABLE IF NOT EXISTS agents_uploads (id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, username VARCHAR(64) NOT NULL, filename VARCHAR(255) NOT NULL, mime VARCHAR(128) NOT NULL, size INT NOT NULL, content LONGBLOB NOT NULL, created_at VARCHAR(32) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
  );
  // rel-167 建的是 agents_threads + agents_messages.thread_id。CREATE IF NOT EXISTS 不会改旧表，线上会报 Unknown column session_id。
  await ignoreSchemaNoise(() =>
    query("ALTER TABLE agents_messages ADD COLUMN session_id INT NOT NULL DEFAULT 0")
  );
  await ignoreSchemaNoise(() =>
    query("ALTER TABLE agents_messages ADD COLUMN file_ids VARCHAR(255) NOT NULL DEFAULT '[]'")
  );
  await ignoreSchemaNoise(() =>
    query("ALTER TABLE agents_messages ADD COLUMN model_id VARCHAR(64) NOT NULL DEFAULT ''")
  );
  await ignoreSchemaNoise(() =>
    query("ALTER TABLE agents_messages ADD COLUMN sources VARCHAR(255) NOT NULL DEFAULT '[]'")
  );
  await ignoreSchemaNoise(() => query("ALTER TABLE agents_messages ADD KEY session_id (session_id)"));
  await ignoreSchemaNoise(() =>
    query("UPDATE agents_messages SET session_id = thread_id WHERE session_id = 0 AND thread_id IS NOT NULL")
  );
  await ignoreSchemaNoise(() =>
    query(
      "INSERT INTO agents_sessions (id, username, model_id, title, created_at, updated_at) SELECT id, '', 'desk', title, created_at, updated_at FROM agents_threads WHERE id NOT IN (SELECT id FROM agents_sessions)"
    )
  );
  schemaReady = true;
}

function parseJsonList(raw) {
  try {
    const value = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function cloneSession(session, preview) {
  return {
    id: Number(session.id),
    username: session.username,
    modelId: session.modelId,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    preview: preview || ""
  };
}

function cloneMessage(message) {
  return {
    id: Number(message.id),
    sessionId: Number(message.sessionId),
    role: message.role,
    text: message.text,
    fileIds: Array.isArray(message.fileIds) ? message.fileIds.map(Number) : [],
    modelId: message.modelId || "",
    sources: Array.isArray(message.sources) ? message.sources : [],
    createdAt: message.createdAt
  };
}

function publicUpload(row) {
  return {
    id: Number(row.id),
    filename: row.filename,
    mime: row.mime,
    size: Number(row.size),
    createdAt: row.createdAt
  };
}

function previewOf(sessionId, rows) {
  const last = rows.filter((row) => Number(row.sessionId) === Number(sessionId)).at(-1);
  if (!last || !last.text) {
    return "";
  }
  const text = String(last.text).replace(/\s+/g, " ").trim();
  return text.length > 80 ? text.slice(0, 80) + "…" : text;
}

function titleFromText(text) {
  const trimmed = String(text || "").replace(/\s+/g, " ").trim();
  if (!trimmed) {
    return "主脑问答 · 新会话";
  }
  return trimmed.length > MAX_TITLE ? trimmed.slice(0, MAX_TITLE) + "…" : trimmed;
}

function sessionFromRow(row) {
  return {
    id: Number(row.id),
    username: row.username,
    modelId: row.model_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function messageFromRow(row) {
  return {
    id: Number(row.id),
    sessionId: Number(row.session_id),
    role: row.role,
    text: row.text,
    fileIds: parseJsonList(row.file_ids).map(Number),
    modelId: row.model_id || "",
    sources: parseJsonList(row.sources),
    createdAt: row.created_at
  };
}

export async function listSessions(username) {
  await ensureAgentsSchema();
  const owner = String(username || "");
  if (dbMode() === "mysql") {
    const [rows] = await query(
      "SELECT id, username, model_id, title, created_at, updated_at FROM agents_sessions WHERE username = ? ORDER BY updated_at DESC, id DESC",
      [owner]
    );
    const [msgs] = await query(
      "SELECT id, session_id, role, text, file_ids, model_id, sources, created_at FROM agents_messages ORDER BY id ASC"
    );
    const mapped = msgs.map(messageFromRow);
    return rows.map((row) => cloneSession(sessionFromRow(row), previewOf(row.id, mapped)));
  }
  return sessions
    .filter((item) => item.username === owner)
    .slice()
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)) || b.id - a.id)
    .map((item) => cloneSession(item, previewOf(item.id, messages)));
}

export async function getSession(id, username) {
  await ensureAgentsSchema();
  const sessionId = Number(id);
  if (!Number.isInteger(sessionId) || sessionId < 1) {
    throw fail(400, "会话不存在");
  }
  let session;
  let rows;
  if (dbMode() === "mysql") {
    const [found] = await query(
      "SELECT id, username, model_id, title, created_at, updated_at FROM agents_sessions WHERE id = ?",
      [sessionId]
    );
    if (!found.length) {
      throw fail(404, "会话不存在");
    }
    session = sessionFromRow(found[0]);
    const [msgRows] = await query(
      "SELECT id, session_id, role, text, file_ids, model_id, sources, created_at FROM agents_messages WHERE session_id = ? ORDER BY id ASC",
      [sessionId]
    );
    rows = msgRows.map(messageFromRow);
  } else {
    session = sessions.find((item) => item.id === sessionId);
    if (!session) {
      throw fail(404, "会话不存在");
    }
    rows = messages.filter((item) => item.sessionId === sessionId);
  }
  if (username && session.username !== username) {
    throw fail(403, "无权查看他人会话");
  }
  return {
    session: cloneSession(session, previewOf(sessionId, rows)),
    messages: rows.map(cloneMessage)
  };
}

export async function createSession(username, modelId, greeting) {
  await ensureAgentsSchema();
  const stamp = nowStamp();
  const title = "主脑问答 · 新会话";
  const owner = String(username || "");
  const model = String(modelId || defaultModelId());
  let session;
  if (dbMode() === "mysql") {
    const [result] = await query(
      "INSERT INTO agents_sessions (username, model_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      [owner, model, title, stamp, stamp]
    );
    session = {
      id: Number(result.insertId),
      username: owner,
      modelId: model,
      title,
      createdAt: stamp,
      updatedAt: stamp
    };
  } else {
    session = {
      id: nextSessionId,
      username: owner,
      modelId: model,
      title,
      createdAt: stamp,
      updatedAt: stamp
    };
    nextSessionId += 1;
    sessions.push(session);
  }
  const hello = greeting
    ? await insertMessage({
        sessionId: session.id,
        role: "assistant",
        text: greeting,
        fileIds: [],
        modelId: model,
        sources: ["本模块纪律"],
        createdAt: stamp
      })
    : null;
  return {
    session: cloneSession(session, hello ? hello.text : ""),
    messages: hello ? [cloneMessage(hello)] : []
  };
}

async function insertMessage(row) {
  if (dbMode() === "mysql") {
    const [result] = await query(
      "INSERT INTO agents_messages (session_id, role, text, file_ids, model_id, sources, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        row.sessionId,
        row.role,
        row.text,
        JSON.stringify(row.fileIds || []),
        row.modelId || "",
        JSON.stringify(row.sources || []),
        row.createdAt
      ]
    );
    return { ...row, id: Number(result.insertId) };
  }
  const message = { ...row, id: nextMessageId };
  nextMessageId += 1;
  messages.push(message);
  return { ...message };
}

async function touchSession(sessionId, title, modelId, stamp) {
  if (dbMode() === "mysql") {
    await query("UPDATE agents_sessions SET title = ?, model_id = ?, updated_at = ? WHERE id = ?", [
      title,
      modelId,
      stamp,
      sessionId
    ]);
    return;
  }
  const session = sessions.find((item) => item.id === sessionId);
  if (session) {
    session.title = title;
    session.modelId = modelId;
    session.updatedAt = stamp;
  }
}

export async function addChatTurn({ sessionId, username, modelId, userText, fileIds, replyText, sources }) {
  const current = await getSession(sessionId, username);
  const stamp = nowStamp();
  const model = String(modelId || current.session.modelId || defaultModelId());
  const ids = Array.isArray(fileIds) ? fileIds.map(Number).filter((item) => item > 0) : [];
  const userMessage = await insertMessage({
    sessionId: current.session.id,
    role: "user",
    text: userText,
    fileIds: ids,
    modelId: model,
    sources: [],
    createdAt: stamp
  });
  const replyStamp = nowStamp();
  const reply = await insertMessage({
    sessionId: current.session.id,
    role: "assistant",
    text: replyText,
    fileIds: [],
    modelId: model,
    sources: sources || [],
    createdAt: replyStamp
  });
  const nextTitle = current.messages.some((item) => item.role === "user")
    ? current.session.title
    : titleFromText(userText);
  await touchSession(current.session.id, nextTitle, model, replyStamp);
  return {
    session: {
      ...current.session,
      title: nextTitle,
      modelId: model,
      updatedAt: replyStamp,
      preview: replyText
    },
    message: cloneMessage(userMessage),
    reply: cloneMessage(reply)
  };
}

export function assertChatText(text) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) {
    throw fail(400, "请输入内容");
  }
  if (trimmed.length > MAX_TEXT) {
    throw fail(400, "内容过长");
  }
  return trimmed;
}

export async function saveUpload({ username, filename, mime, content }) {
  await ensureAgentsSchema();
  const buf = Buffer.isBuffer(content) ? content : Buffer.from(content || "");
  if (!buf.length) {
    throw fail(400, "文件是空的");
  }
  if (buf.length > MAX_UPLOAD) {
    throw fail(400, "文件太大");
  }
  const stamp = nowStamp();
  const owner = String(username || "");
  const name = String(filename || "file").slice(0, 180);
  const type = String(mime || "application/octet-stream").slice(0, 120);
  if (dbMode() === "mysql") {
    const [result] = await query(
      "INSERT INTO agents_uploads (username, filename, mime, size, content, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [owner, name, type, buf.length, buf, stamp]
    );
    return publicUpload({
      id: Number(result.insertId),
      filename: name,
      mime: type,
      size: buf.length,
      createdAt: stamp
    });
  }
  const row = {
    id: nextUploadId,
    username: owner,
    filename: name,
    mime: type,
    size: buf.length,
    content: buf,
    createdAt: stamp
  };
  nextUploadId += 1;
  uploads.push(row);
  return publicUpload(row);
}

export async function getUploadsForUser(ids, username) {
  await ensureAgentsSchema();
  const wanted = (Array.isArray(ids) ? ids : []).map(Number).filter((item) => item > 0);
  if (!wanted.length) {
    return [];
  }
  if (dbMode() === "mysql") {
    const [rows] = await query(
      `SELECT id, username, filename, mime, size, content, created_at FROM agents_uploads WHERE id IN (${wanted
        .map(() => "?")
        .join(",")})`,
      wanted
    );
    return rows
      .filter((row) => row.username === username)
      .map((row) => ({
        ...publicUpload({ ...row, createdAt: row.created_at }),
        content: row.content
      }));
  }
  return uploads
    .filter((row) => wanted.includes(row.id) && row.username === username)
    .map((row) => ({ ...publicUpload(row), content: row.content }));
}

export async function getUploadMeta(id, username) {
  const rows = await getUploadsForUser([id], username);
  if (!rows.length) {
    throw fail(404, "文件不存在");
  }
  const row = rows[0];
  return { id: row.id, filename: row.filename, mime: row.mime, size: row.size, createdAt: row.createdAt };
}
