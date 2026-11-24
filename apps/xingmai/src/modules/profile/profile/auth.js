import { promisify } from "node:util";
import { createHash, randomBytes, scrypt, scryptSync, timingSafeEqual } from "node:crypto";
import { Router } from "express";

let mysqlLib = null;

async function loadMysql() {
  if (!mysqlLib) {
    mysqlLib = await import("mysql2/promise");
  }
  return mysqlLib.default || mysqlLib;
}

// xm-mysql 0.1.50  连接池放进已有 auth.js。线上不能新建目录，只能改已有文件。
// xm-session-persist 0.1.52  登录态写入 xm_sessions，重启后 Cookie 仍有效。

let pool = null;
let mode = "memory";

export function dbMode() {
  return mode;
}

export function setDbMode(next) {
  mode = next === "mysql" ? "mysql" : "memory";
}

export function mysqlConfig() {
  const socketPath = String(process.env.MYSQL_SOCKET || "").trim();
  const database = String(process.env.MYSQL_DATABASE || "xingmai").trim() || "xingmai";
  const user = String(process.env.MYSQL_USER || "root").trim() || "root";
  const password = process.env.MYSQL_PASSWORD == null ? "" : String(process.env.MYSQL_PASSWORD);
  const base = {
    user,
    password,
    charset: "utf8mb4",
    timezone: "local"
  };
  if (socketPath) {
    return { ...base, socketPath, database };
  }
  return {
    ...base,
    host: String(process.env.MYSQL_HOST || "127.0.0.1").trim() || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    database
  };
}

export function setPoolForTests(next) {
  pool = next;
  mode = next ? "mysql" : "memory";
}

export async function getPool() {
  if (!pool) {
    const mysql = await loadMysql();
    const cfg = mysqlConfig();
    pool = mysql.createPool({
      ...cfg,
      waitForConnections: true,
      connectionLimit: 10,
      connectTimeout: 2000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      namedPlaceholders: false
    });
  }
  return pool;
}

export const SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS xm_users (
    username VARCHAR(64) NOT NULL PRIMARY KEY,
    display_name VARCHAR(128) NOT NULL,
    email VARCHAR(255) NOT NULL DEFAULT '',
    phone VARCHAR(64) NOT NULL DEFAULT '',
    password_hash VARCHAR(512) NOT NULL,
    updated_at DATETIME NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS han_tasks (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    status VARCHAR(32) NOT NULL,
    owner VARCHAR(64) NOT NULL,
    created_at VARCHAR(64) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS han_brief (
    id TINYINT NOT NULL PRIMARY KEY,
    text MEDIUMTEXT NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS shen_tasks (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    status VARCHAR(32) NOT NULL,
    owner VARCHAR(64) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS shen_brief (
    id TINYINT NOT NULL PRIMARY KEY,
    text MEDIUMTEXT NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS people (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    role VARCHAR(64) NOT NULL,
    center VARCHAR(128) NOT NULL,
    status VARCHAR(16) NOT NULL,
    demo TINYINT NOT NULL DEFAULT 0
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS data_cards (
    card_key VARCHAR(64) NOT NULL PRIMARY KEY,
    label VARCHAR(128) NOT NULL,
    value INT NOT NULL,
    unit VARCHAR(16) NOT NULL,
    sort_n INT NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS data_events (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    event_time VARCHAR(32) NOT NULL,
    event_type VARCHAR(32) NOT NULL,
    summary VARCHAR(500) NOT NULL,
    sort_n INT NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS notes (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    text TEXT NOT NULL,
    created_at VARCHAR(64) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS xm_sessions (
    sid VARCHAR(128) NOT NULL PRIMARY KEY,
    username VARCHAR(64) NOT NULL,
    created_at BIGINT NOT NULL,
    expires_at BIGINT NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS xm_me_avatars (
    username VARCHAR(64) NOT NULL PRIMARY KEY,
    mime VARCHAR(64) NOT NULL,
    body LONGBLOB NOT NULL,
    updated_at BIGINT NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS xm_me_devices (
    sid VARCHAR(128) NOT NULL PRIMARY KEY,
    username VARCHAR(64) NOT NULL,
    ua VARCHAR(512) NOT NULL DEFAULT '',
    ip VARCHAR(64) NOT NULL DEFAULT '',
    device VARCHAR(128) NOT NULL DEFAULT '',
    city VARCHAR(64) NOT NULL DEFAULT '',
    created_at BIGINT NOT NULL,
    expires_at BIGINT NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS xm_me_notices (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    username VARCHAR(64) NOT NULL,
    kind VARCHAR(32) NOT NULL,
    title VARCHAR(128) NOT NULL,
    detail VARCHAR(500) NOT NULL DEFAULT '',
    created_at BIGINT NOT NULL,
    read_flag TINYINT NOT NULL DEFAULT 0
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS release_tickets (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    version VARCHAR(128) NOT NULL,
    applicant VARCHAR(128) NOT NULL DEFAULT '',
    source VARCHAR(128) NOT NULL DEFAULT '',
    module VARCHAR(128) NOT NULL DEFAULT '',
    summary TEXT NOT NULL,
    files MEDIUMTEXT NOT NULL,
    acceptance TEXT NOT NULL,
    restart TINYINT NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL,
    priority INT NOT NULL DEFAULT 0,
    demo TINYINT NOT NULL DEFAULT 0,
    submitted_at DATETIME NOT NULL,
    reviewer VARCHAR(128) NULL,
    reviewed_at DATETIME NULL,
    reject_reason TEXT NULL,
    publish_started_at DATETIME NULL,
    publish_finished_at DATETIME NULL,
    log MEDIUMTEXT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
];

const SESSION_MS_DEFAULT = 7 * 24 * 60 * 60 * 1000;
const SESSION_MS_REMEMBER = 30 * 24 * 60 * 60 * 1000;

export async function ensureDatabase() {
  const mysql = await loadMysql();
  const cfg = mysqlConfig();
  const { database, ...admin } = cfg;
  const conn = await mysql.createConnection(admin);
  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${database.replace(/`/g, "")}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await conn.end();
  }
}

export async function ensureSchema(target) {
  const db = target || (await getPool());
  for (const sql of SCHEMA_SQL) {
    await db.query(sql);
  }
}

export async function query(sql, params = []) {
  const db = await getPool();
  return db.query(sql, params);
}

// xm-async-scrypt 0.1.43  启动仍同步播种；登录/改密走异步，避免堵住事件循环。
const scryptAsync = promisify(scrypt);

export const COOKIE_NAME = "mk_sid";
export const DEMO_USERNAME = "罗成";
export const DEMO_INITIAL_PASSWORD = "ChangeMe123!";

const KEYLEN = 64;
const users = new Map();
const sessions = new Map();

function hashPasswordSync(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEYLEN);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, KEYLEN);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

async function verifyPassword(password, stored) {
  if (typeof password !== "string" || typeof stored !== "string") {
    return false;
  }
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") {
    return false;
  }
  try {
    const salt = Buffer.from(parts[1], "hex");
    const expected = Buffer.from(parts[2], "hex");
    if (!salt.length || !expected.length) {
      return false;
    }
    const actual = await scryptAsync(password, salt, expected.length);
    if (actual.length !== expected.length) {
      return false;
    }
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function seed() {
  users.set(DEMO_USERNAME, {
    username: DEMO_USERNAME,
    displayName: "罗成",
    email: "luocheng@demo.local",
    phone: "",
    passwordHash: hashPasswordSync(DEMO_INITIAL_PASSWORD)
  });
}

function resolveUser(username) {
  const trimmed = username.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed === DEMO_USERNAME || trimmed.toLowerCase() === "luocheng") {
    return users.get(DEMO_USERNAME) ?? null;
  }
  return users.get(trimmed) ?? null;
}

// Organization credentials are authoritative for real roster members. Read the
// persisted roster on every login so resets, imports and another process's edits
// take effect without restarting or accepting an obsolete xm_users password.
async function rosterCredential(username) {
  if (username === DEMO_USERNAME || username.toLowerCase() === "luocheng") return null;
  const roster = await import("../people/store.js");
  await roster.hydratePeopleRoster();
  const people = roster.listPeople().filter((person) => !person.demo);
  const matches = people.filter((person) => String(person.username || person.name).trim() === username);
  if (matches.length > 1) return { blocked: true };
  if (matches.length === 1) return { person: matches[0], roster };
  const previous = resolveUser(username);
  // A renamed roster account must not fall back to its old authentication row.
  if (previous && people.some((person) => person.name === previous.displayName)) return { blocked: true };
  return null;
}

function matchesRosterPassword(password, person) {
  if (!person || person.status !== "在职" || !person.password) return false;
  const digest = (value) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(password), digest(String(person.password)));
}

async function authenticateUser(username, password) {
  const credential = await rosterCredential(username);
  const existing = resolveUser(username);
  if (!credential) return existing && await verifyPassword(password, existing.passwordHash) ? existing : null;
  if (credential.blocked || !matchesRosterPassword(password, credential.person)) return null;
  const person = credential.person;
  const user = {
    ...(existing || {}),
    username,
    displayName: existing?.displayName || person.name,
    email: existing?.email || "",
    phone: existing?.phone || "",
    department: person.department || "",
    center: person.center || "",
    passwordHash: existing && await verifyPassword(password, existing.passwordHash)
      ? existing.passwordHash : await hashPassword(password)
  };
  // Publish the in-process account only after durable authentication storage succeeds.
  await persistUser(user);
  users.set(username, user);
  return user;
}

seed();

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

export async function persistUser(user) {
  if (dbMode() !== "mysql" || !user) {
    return;
  }
  await query(
    `INSERT INTO xm_users (username, display_name, email, phone, password_hash, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       display_name = VALUES(display_name),
       email = VALUES(email),
       phone = VALUES(phone),
       password_hash = VALUES(password_hash),
       updated_at = VALUES(updated_at)`,
    [user.username, user.displayName, user.email, user.phone, user.passwordHash, nowSql()]
  );
}

export async function hydrateFromMysql() {
  const [rows] = await query(
    "SELECT username, display_name, email, phone, password_hash FROM xm_users"
  );
  if (rows.length) {
    users.clear();
    for (const row of rows) {
      users.set(row.username, {
        username: row.username,
        displayName: row.display_name,
        email: row.email,
        phone: row.phone,
        passwordHash: row.password_hash
      });
    }
    if (!users.has(DEMO_USERNAME)) {
      seed();
      await persistUser(users.get(DEMO_USERNAME));
    }
    try {
      await hydrateSessionsFromMysql();
    } catch (err) {
      console.error("session hydrate failed", err);
    }
    try {
      await hydrateAvatarsFromMysql();
    } catch (err) {
      console.error("avatar hydrate failed", err);
    }
    return;
  }
  for (const user of users.values()) {
    await persistUser(user);
  }
  try {
    await hydrateSessionsFromMysql();
  } catch (err) {
    console.error("session hydrate failed", err);
  }
  try {
    await hydrateAvatarsFromMysql();
  } catch (err) {
    console.error("avatar hydrate failed", err);
  }
}

async function hydrateSessionsFromMysql() {
  if (dbMode() !== "mysql") {
    return;
  }
  const now = Date.now();
  await query("DELETE FROM xm_sessions WHERE expires_at < ?", [now]);
  await query(
    "DELETE FROM xm_sessions WHERE sid NOT IN (SELECT sid FROM (SELECT sid FROM xm_sessions ORDER BY expires_at DESC LIMIT 8) keep)"
  );
  const [rows] = await query(
    "SELECT sid, username, created_at, expires_at FROM xm_sessions WHERE expires_at >= ?",
    [now]
  );
  sessions.clear();
  for (const row of rows || []) {
    sessions.set(String(row.sid), {
      username: row.username,
      createdAt: Number(row.created_at),
      expiresAt: Number(row.expires_at)
    });
  }
  try {
    await ensureDeviceTable();
    const [devices] = await query(
      "SELECT sid, ua, ip, device, city FROM xm_me_devices WHERE expires_at >= ?",
      [now]
    );
    for (const row of devices || []) {
      const session = sessions.get(String(row.sid));
      if (!session) continue;
      session.ua = row.ua || "";
      session.ip = row.ip || "";
      session.device = row.device || "";
      session.city = row.city || "";
    }
  } catch (err) {
    console.error("device hydrate failed", err);
  }
}

async function persistSession(sid, username, createdAt, expiresAt) {
  if (dbMode() !== "mysql") {
    return;
  }
  await query(
    `INSERT INTO xm_sessions (sid, username, created_at, expires_at)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       username = VALUES(username),
       created_at = VALUES(created_at),
       expires_at = VALUES(expires_at)`,
    [sid, username, createdAt, expiresAt]
  );
}

async function dropSession(sid) {
  if (dbMode() !== "mysql" || !sid) {
    return;
  }
  await query("DELETE FROM xm_sessions WHERE sid = ?", [sid]);
  try {
    await ensureDeviceTable();
    await query("DELETE FROM xm_me_devices WHERE sid = ?", [sid]);
  } catch (err) {
    console.error("device delete failed", err);
  }
}

const DEVICE_TABLE_SQL = SCHEMA_SQL.find((sql) => sql.includes("xm_me_devices"));
const NOTICE_TABLE_SQL = SCHEMA_SQL.find((sql) => sql.includes("xm_me_notices"));
const AVATAR_TABLE_SQL = SCHEMA_SQL.find((sql) => sql.includes("xm_me_avatars"));
const profileNotices = [];
const avatars = new Map();
let deviceTableReady = false;
let noticeTableReady = false;
let avatarTableReady = false;
const AVATAR_MAX = 512 * 1024;
const AVATAR_TYPES = {
  "image/jpeg": true,
  "image/jpg": true,
  "image/png": true,
  "image/gif": true,
  "image/webp": true
};

async function ensureDeviceTable() {
  if (deviceTableReady || dbMode() !== "mysql" || !DEVICE_TABLE_SQL) {
    return;
  }
  await query(DEVICE_TABLE_SQL);
  deviceTableReady = true;
}

async function ensureNoticeTable() {
  if (noticeTableReady || dbMode() !== "mysql" || !NOTICE_TABLE_SQL) {
    return;
  }
  await query(NOTICE_TABLE_SQL);
  noticeTableReady = true;
}

async function ensureAvatarTable() {
  if (avatarTableReady || dbMode() !== "mysql" || !AVATAR_TABLE_SQL) {
    return;
  }
  await query(AVATAR_TABLE_SQL);
  avatarTableReady = true;
}

function requestIp(req) {
  const forwarded = String((req && req.headers && req.headers["x-forwarded-for"]) || "")
    .split(",")[0]
    .trim();
  if (forwarded) {
    return forwarded.slice(0, 64);
  }
  const addr = req && req.socket && req.socket.remoteAddress;
  return String(addr || "").slice(0, 64);
}

function shanghaiTime(ms) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  })
    .format(new Date(ms))
    .replace(/\//g, "-");
}

function parseDevice(ua) {
  const text = String(ua || "");
  let os = "未知系统";
  if (/iPhone/i.test(text)) os = "iPhone";
  else if (/iPad/i.test(text)) os = "iPad";
  else if (/Android/i.test(text)) os = "Android";
  else if (/Mac OS X|Macintosh/i.test(text)) os = "Mac";
  else if (/Windows/i.test(text)) os = "Windows";
  else if (/Linux/i.test(text)) os = "Linux";
  let browser = "未知浏览器";
  if (/Edg\//i.test(text)) browser = "Edge";
  else if (/Chrome\//i.test(text) && !/Edg\//i.test(text)) browser = "Chrome";
  else if (/Firefox\//i.test(text)) browser = "Firefox";
  else if (/Safari\//i.test(text) && !/Chrome/i.test(text)) browser = "Safari";
  return os + " · " + browser;
}

function requestCity(req) {
  const headers = (req && req.headers) || {};
  const raw = headers["cf-ipcity"] || headers["x-appengine-city"] || headers["x-geo-city"] || "";
  const city = String(raw).trim();
  if (city && city !== "XX") {
    try {
      return decodeURIComponent(city).slice(0, 64);
    } catch {
      return city.slice(0, 64);
    }
  }
  const ip = requestIp(req);
  if (!ip || ip === "::1" || ip.startsWith("127.") || ip.includes("127.0.0.1")) {
    return "本机";
  }
  return ip;
}

function liveSessionsFor(username) {
  const now = Date.now();
  const name = String(username || "");
  const out = [];
  for (const [sid, session] of sessions.entries()) {
    if (!session || session.username !== name) continue;
    if (session.expiresAt && Number(session.expiresAt) < now) continue;
    out.push({ sid, ...session });
  }
  out.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  return out;
}

function publicSession(session, currentSid) {
  return {
    sid: session.sid,
    device: session.device || "未知设备",
    city: session.city || session.ip || "未知地点",
    ip: session.ip || "",
    time: shanghaiTime(Number(session.createdAt) || Date.now()),
    current: session.sid === currentSid,
    kind: /iPhone|Android|iPad/i.test(String(session.device || "")) ? "phone" : "monitor"
  };
}

async function persistDevice(sid, session) {
  if (dbMode() !== "mysql" || !sid || !session) return;
  await ensureDeviceTable();
  await query(
    `INSERT INTO xm_me_devices (sid, username, ua, ip, device, city, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       username = VALUES(username),
       ua = VALUES(ua),
       ip = VALUES(ip),
       device = VALUES(device),
       city = VALUES(city),
       created_at = VALUES(created_at),
       expires_at = VALUES(expires_at)`,
    [sid, session.username, session.ua || "", session.ip || "", session.device || "", session.city || "", session.createdAt, session.expiresAt]
  );
}

function addNotice(username, kind, title, detail) {
  const item = {
    id: `${Date.now().toString(36)}-${randomBytes(6).toString("hex")}`,
    username,
    kind,
    title,
    detail: String(detail || "").slice(0, 500),
    createdAt: Date.now(),
    read: false
  };
  profileNotices.unshift(item);
  if (profileNotices.length > 500) profileNotices.length = 500;
  persistNotice(item).catch(function (err) {
    console.error("notice persist failed", err);
  });
  return item;
}

async function persistNotice(item) {
  if (dbMode() !== "mysql") return;
  await ensureNoticeTable();
  await query(
    `INSERT INTO xm_me_notices (id, username, kind, title, detail, created_at, read_flag)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [item.id, item.username, item.kind, item.title, item.detail, item.createdAt, item.read ? 1 : 0]
  );
}

function listNotices(username) {
  return profileNotices
    .filter((item) => item.username === username)
    .slice(0, 100)
    .map((item) => ({
      id: item.id,
      kind: item.kind,
      title: item.title,
      detail: item.detail,
      time: shanghaiTime(item.createdAt),
      at: item.createdAt,
      read: Boolean(item.read)
    }));
}

function markNoticesRead(username) {
  for (const item of profileNotices) {
    if (item.username === username) item.read = true;
  }
}

function avatarPublicUrl(username) {
  const row = avatars.get(String(username || "").trim());
  if (!row) return "";
  return "/api/profile/avatar?t=" + encodeURIComponent(String(row.updatedAt));
}

function parseAvatarDataUrl(image) {
  const text = String(image || "").trim();
  const match = text.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) return { ok: false, error: "请上传图片文件" };
  const mime = match[1].toLowerCase() === "image/jpg" ? "image/jpeg" : match[1].toLowerCase();
  if (!AVATAR_TYPES[mime]) return { ok: false, error: "头像仅支持 jpg、png、gif、webp" };
  let body;
  try {
    body = Buffer.from(match[2].replace(/\s+/g, ""), "base64");
  } catch {
    return { ok: false, error: "图片无法读取" };
  }
  if (!body.length) return { ok: false, error: "图片无法读取" };
  if (body.length > AVATAR_MAX) return { ok: false, error: "头像请小于 512KB" };
  return { ok: true, mime, body };
}

async function persistAvatarRow(username, row) {
  if (dbMode() !== "mysql") return;
  await ensureAvatarTable();
  await query(
    `INSERT INTO xm_me_avatars (username, mime, body, updated_at)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE mime = VALUES(mime), body = VALUES(body), updated_at = VALUES(updated_at)`,
    [username, row.mime, row.body, row.updatedAt]
  );
}

async function clearAvatar(username) {
  avatars.delete(username);
  if (dbMode() !== "mysql") {
    return { ok: true, avatarUrl: "" };
  }
  try {
    await ensureAvatarTable();
    await query("DELETE FROM xm_me_avatars WHERE username = ?", [username]);
  } catch (err) {
    console.error("avatar clear failed", err);
  }
  return { ok: true, avatarUrl: "" };
}

async function saveAvatar(username, image) {
  if (!String(image || "").trim()) {
    return clearAvatar(username);
  }
  const parsed = parseAvatarDataUrl(image);
  if (!parsed.ok) return parsed;
  const row = { mime: parsed.mime, body: parsed.body, updatedAt: Date.now() };
  avatars.set(username, row);
  try {
    await persistAvatarRow(username, row);
  } catch (err) {
    console.error("avatar persist failed", err);
  }
  return { ok: true, avatarUrl: avatarPublicUrl(username) };
}

async function hydrateAvatarsFromMysql() {
  if (dbMode() !== "mysql") return;
  await ensureAvatarTable();
  const [rows] = await query("SELECT username, mime, body, updated_at FROM xm_me_avatars");
  avatars.clear();
  for (const row of rows || []) {
    if (!row.username || !row.body) continue;
    avatars.set(row.username, {
      mime: row.mime || "image/jpeg",
      body: Buffer.isBuffer(row.body) ? row.body : Buffer.from(row.body),
      updatedAt: Number(row.updated_at) || Date.now()
    });
  }
}


export function resetStoreForTests() {
  setPoolForTests(null);
  setDbMode("memory");
  users.clear();
  sessions.clear();
  avatars.clear();
  profileNotices.length = 0;
  deviceTableReady = false;
  noticeTableReady = false;
  avatarTableReady = false;
  seed();
}

export function addUserForTests(input = {}) {
  const username = String(input.username || "").trim();
  if (!username) {
    return null;
  }
  const user = {
    username,
    displayName: String(input.displayName || username).trim() || username,
    email: String(input.email || "").trim(),
    phone: String(input.phone || "").trim(),
    department: String(input.department || "").trim(),
    center: String(input.center || "").trim(),
    passwordHash: hashPasswordSync(String(input.password || DEMO_INITIAL_PASSWORD))
  };
  users.set(username, user);
  return user;
}

export function publicProfile(user) {
  if (!user) {
    return null;
  }
  const desk = String(user.desk || "");
  return {
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    phone: user.phone,
    desk,
    home: desk === "hr" ? "/hr" : "/home",
    board: String(user.board || ""),
    department: String(user.department || ""),
    center: String(user.center || ""),
    role: String(user.role || ""),
    visibleShops: Array.isArray(user.visibleShops) ? user.visibleShops.map((item) => String(item)) : [],
    avatarUrl: avatarPublicUrl(user.username)
  };
}

async function mergePeopleBoard(people) {
  if (dbMode() !== "mysql") {
    return Array.isArray(people) ? people : [];
  }
  const list = Array.isArray(people) ? people : [];
  const tries = [
    "SELECT id, name, username, board, role, center, department, manager_id FROM people",
    "SELECT id, username, board, manager_id FROM people"
  ];
  for (const sql of tries) {
    try {
      const [rows] = await query(sql);
      const extra = new Map(
        (rows || []).map((row) => [
          Number(row.id),
          {
            username: String(row.username || "").trim(),
            board: String(row.board || "").trim(),
            name: String(row.name || "").trim(),
            role: String(row.role || "").trim(),
            center: String(row.center || "").trim(),
            department: String(row.department || "").trim(),
            managerId: row.manager_id == null || row.manager_id === "" ? null : Number(row.manager_id)
          }
        ])
      );
      return list.map((person) => {
        const patch = extra.get(Number(person.id)) || {};
        return {
          ...person,
          username: person.username || patch.username || "",
          board: person.board || patch.board || "",
          role: person.role || patch.role || "",
          center: person.center || patch.center || "",
          department: person.department || patch.department || "",
          managerId: person.managerId != null ? person.managerId : patch.managerId
        };
      });
    } catch {
      /* 组织中心表字段因版本不同，换一条 SQL */
    }
  }
  return list;
}

export async function resolveDesk(user) {
  if (!user) {
    return "";
  }
  try {
    const { canSeeStaffNav, hrDeskFromOrg } = await import("../home/nav-items.js");
    if (canSeeStaffNav(user)) {
      user.desk = "";
      return "";
    }
    let people = [];
    try {
      const { listPeople } = await import("../people/store.js");
      people = await listPeople();
    } catch {
      people = [];
    }
    people = await mergePeopleBoard(people);
    let fromWork = "";
    try {
      const work = await import("../work/store.js");
      if (typeof work.deskOf === "function") {
        fromWork = String((await work.deskOf(user)) || "");
      }
    } catch {
      fromWork = "";
    }
    const fromOrg = hrDeskFromOrg(user, people);
    const desk = fromWork === "hr" || fromOrg === "hr" ? "hr" : "";
    user.desk = desk;
    const aliases = [user.username, user.displayName, user.name]
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    const me =
      people.find(
        (person) => aliases.includes(String(person.username || "")) || aliases.includes(String(person.name || ""))
      ) || null;
    if (me) {
      user.board = String(me.board || user.board || "");
      user.department = String(me.department || user.department || "");
      user.center = String(me.center || user.center || "");
      user.role = String(me.role || user.role || "");
      user.visibleShops = Array.isArray(me.visibleShops) ? me.visibleShops.map((item) => String(item)) : [];
    }
    return desk;
  } catch {
    user.desk = user.desk || "";
    return String(user.desk || "");
  }
}

function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) {
    return out;
  }
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) {
      continue;
    }
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}

export function currentUser(req) {
  const sid = parseCookies(req)[COOKIE_NAME];
  const session = sid ? sessions.get(sid) : null;
  if (!session) {
    return null;
  }
  if (session.expiresAt && Number(session.expiresAt) < Date.now()) {
    sessions.delete(sid);
    return null;
  }
  return users.get(session.username) ?? null;
}

function cookieSecure(req) {
  const proto = String(req.headers["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  return proto === "https" || req.secure === true;
}

function setSessionCookie(res, req, sid, maxAgeSec) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(sid)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${Math.max(1, Number(maxAgeSec) || 0)}`
  ];
  if (cookieSecure(req)) {
    parts.push("Secure");
  }
  res.setHeader("Set-Cookie", parts.join("; "));
}

function clearSessionCookie(res, req) {
  const parts = [`${COOKIE_NAME}=`, "HttpOnly", "Path=/", "SameSite=Lax", "Max-Age=0"];
  if (req && cookieSecure(req)) {
    parts.push("Secure");
  }
  res.setHeader("Set-Cookie", parts.join("; "));
}

function sendProfile(res, user) {
  const profile = publicProfile(user);
  res.json({
    ok: true,
    username: profile.username,
    displayName: profile.displayName,
    email: profile.email,
    phone: profile.phone,
    desk: profile.desk,
    home: profile.home,
    avatarUrl: profile.avatarUrl
  });
}

export function requireAuth(req, res, next) {
  const user = currentUser(req);
  if (!user) {
    res.status(401).json({ ok: false, error: "未登录" });
    return;
  }
  req.user = user;
  next();
}

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!username || !password) {
    res.status(401).json({ ok: false, error: "请输入用户名和密码" });
    return;
  }
  let user;
  try {
    user = await authenticateUser(username, password);
  } catch {
    res.status(503).json({ ok: false, error: "账号同步暂时失败，请稍后重试" });
    return;
  }
  if (!user) {
    res.status(401).json({ ok: false, error: "用户名或密码错误" });
    return;
  }
  const sid = `${Date.now().toString(36)}-${randomBytes(12).toString("hex")}`;
  const createdAt = Date.now();
  const remember = Boolean(req.body?.remember);
  const maxAgeMs = remember ? SESSION_MS_REMEMBER : SESSION_MS_DEFAULT;
  const expiresAt = createdAt + maxAgeMs;
  const others = liveSessionsFor(user.username);
  const session = {
    username: user.username,
    createdAt,
    expiresAt,
    ua: String((req.headers && req.headers["user-agent"]) || "").slice(0, 512),
    ip: requestIp(req),
    device: parseDevice(req.headers && req.headers["user-agent"]),
    city: requestCity(req)
  };
  sessions.set(sid, session);
  setSessionCookie(res, req, sid, Math.floor(maxAgeMs / 1000));
  persistSession(sid, user.username, createdAt, expiresAt).catch(function (err) {
    console.error("session persist failed", err);
  });
  persistDevice(sid, session).catch(function (err) {
    console.error("device persist failed", err);
  });
  if (others.length) {
    addNotice(
      user.username,
      "multi",
      "多客户端登录",
      "本账号已有 " + others.length + " 个在线会话，本次从 " + session.device + "（" + session.city + "）登录"
    );
    const otherIps = others.map((item) => item.ip).filter(Boolean);
    if (session.ip && otherIps.some((ip) => ip && ip !== session.ip)) {
      addNotice(user.username, "remote", "异地登录", "检测到与已有会话不同的登录来源：" + session.device + " / " + session.city);
    }
  }
  await resolveDesk(user);
  res.json({ ok: true, remember, user: publicProfile(user) });
});

authRouter.post("/logout", (req, res) => {
  const sid = parseCookies(req)[COOKIE_NAME];
  if (sid) {
    sessions.delete(sid);
    dropSession(sid).catch(function (err) {
      console.error("session delete failed", err);
    });
  }
  clearSessionCookie(res, req);
  res.json({ ok: true });
});

authRouter.get("/me", async (req, res) => {
  const user = currentUser(req);
  if (!user) {
    res.status(401).json({ ok: false, error: "未登录" });
    return;
  }
  await resolveDesk(user);
  sendProfile(res, user);
});

export const profileRouter = Router();
profileRouter.use(requireAuth);

profileRouter.get("/", (req, res) => {
  sendProfile(res, req.user);
});

profileRouter.put("/", async (req, res) => {
  const displayName = typeof req.body?.displayName === "string" ? req.body.displayName.trim() : "";
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const phone = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
  req.user.displayName = displayName;
  req.user.email = email;
  req.user.phone = phone;
  await persistUser(req.user);
  sendProfile(res, req.user);
});

profileRouter.post("/password", async (req, res) => {
  const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
  const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
  const confirmPassword = typeof req.body?.confirmPassword === "string" ? req.body.confirmPassword : "";

  if (!currentPassword || !newPassword || !confirmPassword) {
    res.status(400).json({ ok: false, error: "请填写当前密码、新密码和确认新密码" });
    return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ ok: false, error: "新密码至少 8 位" });
    return;
  }
  if (newPassword !== confirmPassword) {
    res.status(400).json({ ok: false, error: "两次新密码不一致" });
    return;
  }
  if (newPassword === currentPassword) {
    res.status(400).json({ ok: false, error: "新密码不能与当前密码相同" });
    return;
  }
  let credential;
  try {
    credential = await rosterCredential(req.user.username);
  } catch {
    res.status(503).json({ ok: false, error: "账号同步暂时失败，请稍后重试" });
    return;
  }
  const currentMatches = credential
    ? !credential.blocked && matchesRosterPassword(currentPassword, credential.person)
    : await verifyPassword(currentPassword, req.user.passwordHash);
  if (!currentMatches) {
    res.status(403).json({ ok: false, error: "当前密码错误" });
    return;
  }
  // Keep personal-center changes in the same source used by organization login.
  // The roster's password format trims surrounding whitespace.
  if (credential && newPassword !== newPassword.trim()) {
    res.status(400).json({ ok: false, error: "密码首尾不能包含空格" });
    return;
  }
  if (newPassword.length > 128) {
    res.status(400).json({ ok: false, error: "密码不能超过 128 位" });
    return;
  }
  const updated = { ...req.user, passwordHash: await hashPassword(newPassword) };
  try {
    await persistUser(updated);
    if (credential) {
      const result = await credential.roster.patchPerson(credential.person.id, { password: newPassword });
      if (!result.ok) throw new Error("roster password update failed");
    }
  } catch {
    res.status(503).json({ ok: false, error: "密码同步失败，请稍后重试" });
    return;
  }
  Object.assign(req.user, updated);
  users.set(updated.username, req.user);
  res.json({ ok: true, message: "密码已更新" });
});

profileRouter.get("/avatar", (req, res) => {
  const row = avatars.get(req.user.username);
  if (!row) {
    res.status(404).json({ ok: false, error: "暂无头像" });
    return;
  }
  res.setHeader("Content-Type", row.mime);
  res.setHeader("Cache-Control", "private, max-age=60");
  res.send(row.body);
});

profileRouter.post("/avatar", async (req, res) => {
  const result = await saveAvatar(req.user.username, req.body?.image);
  if (!result.ok) {
    res.status(400).json(result);
    return;
  }
  res.json({ ok: true, avatarUrl: result.avatarUrl });
});

profileRouter.get("/sessions", (req, res) => {
  const currentSid = parseCookies(req)[COOKIE_NAME] || "";
  if (currentSid) {
    let session = sessions.get(currentSid);
    if (!session || session.username !== req.user.username) {
      session = {
        username: req.user.username,
        createdAt: Date.now(),
        expiresAt: Date.now() + SESSION_MS_DEFAULT,
        ua: "",
        ip: "",
        device: "",
        city: ""
      };
      sessions.set(currentSid, session);
    }
    if (!session.device || !session.ip) {
      session.ua = String((req.headers && req.headers["user-agent"]) || session.ua || "");
      session.ip = requestIp(req) || session.ip || "";
      session.device = parseDevice(session.ua);
      session.city = requestCity(req);
      persistDevice(currentSid, session).catch(function (err) {
        console.error("device backfill failed", err);
      });
    }
  }
  const items = liveSessionsFor(req.user.username).map((item) => publicSession(item, currentSid));
  res.json({ ok: true, currentSid, items });
});

profileRouter.delete("/sessions/:sid", (req, res) => {
  const currentSid = parseCookies(req)[COOKIE_NAME] || "";
  const sid = String(req.params.sid || "");
  if (!sid) {
    res.status(400).json({ ok: false, error: "缺少会话" });
    return;
  }
  if (sid === currentSid) {
    res.status(400).json({ ok: false, error: "不能退出当前设备" });
    return;
  }
  const session = sessions.get(sid);
  if (!session || session.username !== req.user.username) {
    res.status(404).json({ ok: false, error: "会话不存在" });
    return;
  }
  sessions.delete(sid);
  dropSession(sid).catch(function (err) {
    console.error("session delete failed", err);
  });
  res.json({ ok: true });
});

profileRouter.get("/notices", (req, res) => {
  const items = listNotices(req.user.username);
  res.json({ ok: true, unread: items.filter((item) => !item.read).length, items });
});

profileRouter.post("/notices/read", (req, res) => {
  markNoticesRead(req.user.username);
  res.json({ ok: true, unread: 0 });
});
