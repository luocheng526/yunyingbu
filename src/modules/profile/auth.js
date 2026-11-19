import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { randomBytes, scrypt, scryptSync, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { buildDutyView, registerDuty, resetDutyCatalogForTests } from "./duties.js";

let mysqlLib = null;

async function loadMysql() {
  if (!mysqlLib) {
    mysqlLib = await import("mysql2/promise");
  }
  return mysqlLib.default || mysqlLib;
}

// 学院 / 韩 / 沈 / 人员 / 数据 / 笔记从本文件 import { dbMode, query }。
// 覆盖线上 auth.js 时必须保留这些导出，否则发版试载会 SMOKE_IMPORT_ERROR。
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
  `CREATE TABLE IF NOT EXISTS xm_me_logs (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    username VARCHAR(64) NOT NULL,
    display_name VARCHAR(128) NOT NULL DEFAULT '',
    action VARCHAR(128) NOT NULL,
    detail VARCHAR(500) NOT NULL DEFAULT '',
    ip VARCHAR(64) NOT NULL DEFAULT '',
    created_at BIGINT NOT NULL,
    KEY idx_xm_me_logs_user_time (username, created_at)
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

const scryptAsync = promisify(scrypt);

export const COOKIE_NAME = "mk_sid";
export const DEMO_USERNAME = "罗成";
export const DEMO_INITIAL_PASSWORD = "ChangeMe123!";

const KEYLEN = 64;
const users = new Map();
const sessions = new Map();
const peopleRoster = new Map();
let peopleRowCache = { at: 0, rows: null };
let peopleListLoader = null;

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

function identityDefaults(username, displayName) {
  const isDemo = username === DEMO_USERNAME;
  return {
    title: isDemo ? "系统管理员" : displayName || username,
    subtitle: isDemo ? "运营部 · 平台管理员" : "",
    dataScope: isDemo ? "全平台数据" : "",
    role: isDemo ? "超级管理员" : "",
    badge: isDemo ? "系" : (displayName || username || "系").slice(0, 1),
    department: isDemo ? "星脉集团/河西星脉甄选" : "",
    createdAt: isDemo ? "2026-01-01 00:00:00" : "",
    dutyIds: isDemo ? "*" : []
  };
}

function seed() {
  users.set(DEMO_USERNAME, {
    username: DEMO_USERNAME,
    displayName: "系统管理员",
    email: "luocheng@demo.local",
    phone: "",
    ...identityDefaults(DEMO_USERNAME, "系统管理员"),
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

function peopleKey(username) {
  return String(username || "").trim();
}

export function setPeopleListLoaderForTests(fn) {
  peopleListLoader = typeof fn === "function" ? fn : null;
}

export function setPeopleLoginForTests(rows) {
  peopleRoster.clear();
  for (const row of rows || []) {
    const username = peopleKey(row.username || row.name);
    if (!username) {
      continue;
    }
    peopleRoster.set(username, {
      name: String(row.name || username).trim(),
      username,
      password: String(row.password || ""),
      department: String(row.department || row.center || ""),
      center: String(row.center || ""),
      role: String(row.role || ""),
      status: String(row.status || "在职")
    });
  }
}

function peoplePlainEquals(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  if (!a.length || a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

async function peoplePasswordMatches(password, stored) {
  if (typeof stored !== "string" || !stored) {
    return false;
  }
  if (stored.startsWith("scrypt:")) {
    return verifyPassword(password, stored);
  }
  return peoplePlainEquals(String(password).trim(), stored.trim());
}

function personActive(person) {
  const status = String(person?.status || "在职").trim();
  return !status || status === "在职" || status === "active";
}

function pickPersonRow(rows, username) {
  const list = Array.isArray(rows) ? rows : [];
  const exact = list.find((row) => peopleKey(row.username) === username);
  return exact || list.find((row) => peopleKey(row.name) === username) || null;
}

function parseMaybeJson(value) {
  if (!value) {
    return {};
  }
  if (typeof value === "object" && !Buffer.isBuffer(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return {};
  }
  const text = value.trim();
  if (!text.startsWith("{") && !text.startsWith("[")) {
    return {};
  }
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function normalizePersonRow(row) {
  if (!row || typeof row !== "object") {
    return null;
  }
  const extra = {};
  for (const key of Object.keys(row)) {
    const value = row[key];
    if (typeof value === "string" && value.trim().startsWith("{")) {
      Object.assign(extra, parseMaybeJson(value));
    } else if (value && typeof value === "object" && !Buffer.isBuffer(value) && !Array.isArray(value) && !(value instanceof Date)) {
      if (key === "pack" || key === "bundle" || key === "data" || key === "json" || key === "extra" || key === "payload" || key === "meta") {
        Object.assign(extra, value);
      }
    }
  }
  const merged = { ...extra, ...row };
  const username = peopleKey(merged.username || merged.login || merged.account || merged.name);
  if (!username) {
    return null;
  }
  return {
    name: String(merged.name || username).trim(),
    username,
    password: String(
      merged.password || merged.loginPassword || merged.login_password || merged.pwd || ""
    ),
    department: String(merged.department || merged.center || extra.department || ""),
    center: String(merged.center || ""),
    role: String(merged.role || ""),
    status: String(merged.status || extra.status || "在职")
  };
}

async function loadPeopleRowsFromMysql() {
  if (peopleRowCache.rows && Date.now() - peopleRowCache.at < 15000) {
    return peopleRowCache.rows;
  }
  const out = [];
  const seen = new Set();
  async function takeTable(table) {
    try {
      const [rows] = await query("SELECT * FROM `" + String(table).replace(/`/g, "") + "`");
      for (const row of rows || []) {
        const person = normalizePersonRow(row);
        if (!person) {
          continue;
        }
        const key = person.username + "\0" + person.name;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        out.push(person);
      }
    } catch (err) {
      console.error("people login table failed", table, err && err.code);
    }
  }
  await takeTable("people");
  if (!out.some((row) => row.password)) {
    try {
      const [tables] = await query("SHOW TABLES");
      for (const item of tables || []) {
        const name = String(Object.values(item)[0] || "");
        if (!name || name === "people" || !/people|member|staff|roster/i.test(name)) {
          continue;
        }
        await takeTable(name);
      }
    } catch (err) {
      console.error("people login show tables failed", err && err.code);
    }
  }
  peopleRowCache = { at: Date.now(), rows: out };
  return out;
}

async function listOrgPeople() {
  if (peopleListLoader) {
    try {
      return (await peopleListLoader()) || [];
    } catch {
      return [];
    }
  }
  try {
    const peopleMod = await import("../people/store.js");
    if (typeof peopleMod.listPeople === "function") {
      return peopleMod.listPeople() || [];
    }
  } catch {
    /* this workspace overlay has no people store */
  }
  try {
    const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "../people/data/people-logins.json");
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return Object.values(parsed);
    }
  } catch {
    /* overlay file is optional */
  }
  return [];
}

async function findPeopleCredential(username) {
  const trimmed = peopleKey(username);
  if (!trimmed) {
    return null;
  }
  const aliases =
    trimmed.toLowerCase() === "luocheng" ? [trimmed, DEMO_USERNAME] : [trimmed];
  for (const key of aliases) {
    const hit = peopleRoster.get(key);
    if (hit) {
      return hit;
    }
  }
  try {
    const orgRows = (await listOrgPeople()).map(normalizePersonRow).filter(Boolean);
    for (const key of aliases) {
      const hit = pickPersonRow(orgRows, key);
      if (hit) {
        return hit;
      }
    }
  } catch (err) {
    console.error("people module login lookup failed", err);
  }
  if (dbMode() !== "mysql") {
    return null;
  }
  try {
    const rows = await loadPeopleRowsFromMysql();
    for (const key of aliases) {
      const hit = pickPersonRow(rows, key);
      if (hit) {
        return hit;
      }
    }
    return null;
  } catch (err) {
    console.error("people login lookup failed", err);
    return null;
  }
}

function userFromPeople(person, existing) {
  const username = peopleKey(person.username || person.name);
  const displayName = String(person.name || username).trim();
  return {
    username,
    displayName,
    email: existing?.email || "",
    phone: existing?.phone || "",
    ...identityDefaults(username, displayName),
    department: person.department || person.center || existing?.department || "",
    role: person.role || existing?.role || "",
    passwordHash: existing?.passwordHash || ""
  };
}

async function authenticate(username, password) {
  const existing = resolveUser(username);
  if (existing && (await verifyPassword(password, existing.passwordHash))) {
    return existing;
  }
  const person = await findPeopleCredential(username);
  if (!person || !personActive(person) || !(await peoplePasswordMatches(password, person.password))) {
    return null;
  }
  if (existing && existing.username === DEMO_USERNAME) {
    return existing;
  }
  const user = userFromPeople(person, existing);
  user.passwordHash = await hashPassword(password);
  users.set(user.username, user);
  persistUser(user).catch(function (err) {
    console.error("people login persist failed", err);
  });
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

function rowToUser(row) {
  const displayName = row.display_name;
  return {
    username: row.username,
    displayName,
    email: row.email,
    phone: row.phone,
    passwordHash: row.password_hash,
    ...identityDefaults(row.username, displayName)
  };
}

export async function hydrateFromMysql() {
  const [rows] = await query("SELECT username, display_name, email, phone, password_hash FROM xm_users");
  if (rows.length) {
    users.clear();
    for (const row of rows) {
      users.set(row.username, rowToUser(row));
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
  const [rows] = await query("SELECT sid, username, created_at, expires_at FROM xm_sessions WHERE expires_at >= ?", [
    now
  ]);
  sessions.clear();
  let devices = [];
  try {
    await ensureDeviceTable();
    const [devRows] = await query(
      "SELECT sid, username, ua, ip, device, city, created_at, expires_at FROM xm_me_devices"
    );
    devices = devRows || [];
  } catch (err) {
    console.error("device hydrate failed", err);
  }
  const bySid = new Map(devices.map((row) => [String(row.sid), row]));
  for (const row of rows || []) {
    const extra = bySid.get(String(row.sid)) || {};
    sessions.set(String(row.sid), {
      username: row.username,
      createdAt: Number(row.created_at),
      expiresAt: Number(row.expires_at),
      ua: extra.ua || "",
      ip: extra.ip || "",
      device: extra.device || "",
      city: extra.city || ""
    });
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

const DEVICE_TABLE_SQL = SCHEMA_SQL.find((sql) => sql.includes("xm_me_devices"));
const NOTICE_TABLE_SQL = SCHEMA_SQL.find((sql) => sql.includes("xm_me_notices"));
const profileNotices = [];
let deviceTableReady = false;
let noticeTableReady = false;

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

function parseDevice(ua) {
  const text = String(ua || "");
  let os = "未知系统";
  if (/iPhone/i.test(text)) {
    os = "iPhone";
  } else if (/iPad/i.test(text)) {
    os = "iPad";
  } else if (/Android/i.test(text)) {
    os = "Android";
  } else if (/Mac OS X|Macintosh/i.test(text)) {
    os = "Mac";
  } else if (/Windows/i.test(text)) {
    os = "Windows";
  } else if (/Linux/i.test(text)) {
    os = "Linux";
  }
  let browser = "未知浏览器";
  if (/Edg\//i.test(text)) {
    browser = "Edge";
  } else if (/Chrome\//i.test(text) && !/Edg\//i.test(text)) {
    browser = "Chrome";
  } else if (/Firefox\//i.test(text)) {
    browser = "Firefox";
  } else if (/Safari\//i.test(text) && !/Chrome/i.test(text)) {
    browser = "Safari";
  }
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
    if (!session || session.username !== name) {
      continue;
    }
    if (session.expiresAt && Number(session.expiresAt) < now) {
      continue;
    }
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
  if (dbMode() !== "mysql" || !sid || !session) {
    return;
  }
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
    [
      sid,
      session.username,
      session.ua || "",
      session.ip || "",
      session.device || "",
      session.city || "",
      session.createdAt,
      session.expiresAt
    ]
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
  if (profileNotices.length > 500) {
    profileNotices.length = 500;
  }
  persistNotice(item).catch(function (err) {
    console.error("notice persist failed", err);
  });
  return item;
}

async function persistNotice(item) {
  if (dbMode() !== "mysql") {
    return;
  }
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
    if (item.username === username) {
      item.read = true;
    }
  }
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

const LOG_TABLE_SQL = SCHEMA_SQL.find((sql) => sql.includes("xm_me_logs"));
const profileLogs = [];
let logTableReady = false;

export function isLogAdmin(user) {
  const name = String(user && user.username ? user.username : "").trim();
  return name === DEMO_USERNAME || name.toLowerCase() === "luocheng";
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

function publicLog(entry) {
  return {
    id: entry.id,
    username: entry.username,
    actor: entry.displayName || entry.username,
    action: entry.action,
    detail: entry.detail || "",
    ip: entry.ip || "",
    at: entry.createdAt,
    time: shanghaiTime(entry.createdAt)
  };
}

async function ensureLogTable() {
  if (logTableReady || dbMode() !== "mysql" || !LOG_TABLE_SQL) {
    return;
  }
  await query(LOG_TABLE_SQL);
  logTableReady = true;
}

async function persistLogRow(entry) {
  if (dbMode() !== "mysql") {
    return;
  }
  await ensureLogTable();
  await query(
    `INSERT INTO xm_me_logs (id, username, display_name, action, detail, ip, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [entry.id, entry.username, entry.displayName, entry.action, entry.detail, entry.ip, entry.createdAt]
  );
}

function recordProfileLog(req, user, action, detail) {
  if (!user || !action) {
    return;
  }
  const entry = {
    id: `${Date.now().toString(36)}-${randomBytes(6).toString("hex")}`,
    username: String(user.username || "").trim(),
    displayName: String(user.displayName || user.username || "").trim(),
    action: String(action).slice(0, 128),
    detail: String(detail || "").slice(0, 500),
    ip: requestIp(req),
    createdAt: Date.now()
  };
  if (!entry.username) {
    return;
  }
  profileLogs.unshift(entry);
  if (profileLogs.length > 2000) {
    profileLogs.length = 2000;
  }
  persistLogRow(entry).catch(function (err) {
    console.error("profile log persist failed", err);
  });
}

async function listProfileLogs(viewer, filterUser) {
  const admin = isLogAdmin(viewer);
  const want = admin ? String(filterUser || "").trim() : viewer.username;
  if (dbMode() === "mysql") {
    try {
      await ensureLogTable();
      const sql = want
        ? "SELECT id, username, display_name, action, detail, ip, created_at FROM xm_me_logs WHERE username = ? ORDER BY created_at DESC LIMIT 500"
        : "SELECT id, username, display_name, action, detail, ip, created_at FROM xm_me_logs ORDER BY created_at DESC LIMIT 500";
      const [rows] = await query(sql, want ? [want] : []);
      return (rows || []).map((row) =>
        publicLog({
          id: row.id,
          username: row.username,
          displayName: row.display_name,
          action: row.action,
          detail: row.detail,
          ip: row.ip,
          createdAt: Number(row.created_at)
        })
      );
    } catch (err) {
      console.error("profile log list failed", err);
    }
  }
  let items = profileLogs.slice();
  if (want) {
    items = items.filter((item) => item.username === want);
  }
  return items.slice(0, 500).map(publicLog);
}

const AVATAR_TABLE_SQL = SCHEMA_SQL.find((sql) => sql.includes("xm_me_avatars"));
const AVATAR_MAX = 512 * 1024;
const AVATAR_TYPES = {
  "image/jpeg": true,
  "image/jpg": true,
  "image/png": true,
  "image/gif": true,
  "image/webp": true
};
const avatars = new Map();
let avatarTableReady = false;

function avatarPublicUrl(username) {
  const row = avatars.get(String(username || "").trim());
  if (!row) {
    return "";
  }
  return "/api/profile/avatar?t=" + encodeURIComponent(String(row.updatedAt));
}

async function ensureAvatarTable() {
  if (avatarTableReady || dbMode() !== "mysql" || !AVATAR_TABLE_SQL) {
    return;
  }
  await query(AVATAR_TABLE_SQL);
  avatarTableReady = true;
}

function parseAvatarDataUrl(image) {
  const text = String(image || "").trim();
  const match = text.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) {
    return { ok: false, error: "请上传图片文件" };
  }
  const mime = match[1].toLowerCase() === "image/jpg" ? "image/jpeg" : match[1].toLowerCase();
  if (!AVATAR_TYPES[mime]) {
    return { ok: false, error: "头像仅支持 jpg、png、gif、webp" };
  }
  let body;
  try {
    body = Buffer.from(match[2].replace(/\s+/g, ""), "base64");
  } catch {
    return { ok: false, error: "图片无法读取" };
  }
  if (!body.length) {
    return { ok: false, error: "图片无法读取" };
  }
  if (body.length > AVATAR_MAX) {
    return { ok: false, error: "头像请小于 512KB" };
  }
  return { ok: true, mime, body };
}

async function persistAvatarRow(username, row) {
  if (dbMode() !== "mysql") {
    return;
  }
  await ensureAvatarTable();
  await query(
    `INSERT INTO xm_me_avatars (username, mime, body, updated_at)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       mime = VALUES(mime),
       body = VALUES(body),
       updated_at = VALUES(updated_at)`,
    [username, row.mime, row.body, row.updatedAt]
  );
}

async function saveAvatar(username, image) {
  const parsed = parseAvatarDataUrl(image);
  if (!parsed.ok) {
    return parsed;
  }
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
  if (dbMode() !== "mysql") {
    return;
  }
  await ensureAvatarTable();
  const [rows] = await query("SELECT username, mime, body, updated_at FROM xm_me_avatars");
  avatars.clear();
  for (const row of rows || []) {
    if (!row.username || !row.body) {
      continue;
    }
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
  peopleRoster.clear();
  peopleRowCache = { at: 0, rows: null };
  peopleListLoader = null;
  profileLogs.length = 0;
  logTableReady = false;
  avatars.clear();
  avatarTableReady = false;
  profileNotices.length = 0;
  deviceTableReady = false;
  noticeTableReady = false;
  resetDutyCatalogForTests();
  seed();
}

// 线上 middleware.js 从本文件 import { currentUser, publicProfile, resolveDesk }。
// 覆盖 auth.js 时必须保留 resolveDesk，否则发版试载 SMOKE_IMPORT_ERROR。
export function resolveDesk(user) {
  if (!user) {
    return { desk: "", home: "/home", board: "" };
  }
  const desk = String(user.desk || "").trim();
  const board = String(user.board || user.center || "").trim();
  const home = String(user.home || "").trim() || "/home";
  return { desk, home, board };
}

export function publicProfile(user) {
  if (!user) {
    return null;
  }
  const duties = buildDutyView(user.dutyIds);
  const desk = resolveDesk(user);
  return {
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    phone: user.phone,
    title: user.title || user.displayName || user.username,
    subtitle: user.subtitle || "",
    dataScope: user.dataScope || "",
    role: user.role || "",
    badge: user.badge || (user.displayName || user.username || "系").slice(0, 1),
    department: user.department || identityDefaults(user.username, user.displayName).department,
    createdAt: user.createdAt || identityDefaults(user.username, user.displayName).createdAt,
    grantedCount: duties.grantedCount,
    dutyTotal: duties.total,
    avatarUrl: avatarPublicUrl(user.username),
    desk: desk.desk,
    home: desk.home,
    board: desk.board,
    center: user.center || ""
  };
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
  res.json({ ok: true, ...publicProfile(user) });
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
  const user = await authenticate(username, password);
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
  const meta = {
    username: user.username,
    createdAt,
    expiresAt,
    ua: String((req.headers && req.headers["user-agent"]) || "").slice(0, 512),
    ip: requestIp(req),
    device: parseDevice(req.headers && req.headers["user-agent"]),
    city: requestCity(req)
  };
  sessions.set(sid, meta);
  setSessionCookie(res, req, sid, Math.floor(maxAgeMs / 1000));
  persistSession(sid, user.username, createdAt, expiresAt).catch(function (err) {
    console.error("session persist failed", err);
  });
  persistDevice(sid, meta).catch(function (err) {
    console.error("device persist failed", err);
  });
  if (others.length) {
    addNotice(
      user.username,
      "multi",
      "多客户端登录",
      "本账号已有 " + others.length + " 个在线会话，本次从 " + meta.device + "（" + meta.city + "）登录"
    );
    const otherIps = others.map((item) => item.ip).filter(Boolean);
    if (meta.ip && otherIps.some((ip) => ip && ip !== meta.ip)) {
      addNotice(
        user.username,
        "remote",
        "异地登录",
        "检测到与已有会话不同的登录来源：" + meta.device + " / " + meta.city
      );
    }
  }
  recordProfileLog(req, user, "登录", meta.device + " · " + meta.city + (remember ? " · 保持登录" : ""));
  res.json({ ok: true, remember, user: publicProfile(user) });
});

authRouter.post("/logout", (req, res) => {
  const actor = currentUser(req);
  const sid = parseCookies(req)[COOKIE_NAME];
  if (sid) {
    sessions.delete(sid);
    dropSession(sid).catch(function (err) {
      console.error("session delete failed", err);
    });
  }
  if (actor) {
    recordProfileLog(req, actor, "退出登录", "");
  }
  clearSessionCookie(res, req);
  res.json({ ok: true });
});

authRouter.get("/me", (req, res) => {
  const user = currentUser(req);
  if (!user) {
    res.status(401).json({ ok: false, error: "未登录" });
    return;
  }
  sendProfile(res, user);
});

export const profileRouter = Router();
profileRouter.use(requireAuth);

profileRouter.get("/", (req, res) => {
  sendProfile(res, req.user);
});

profileRouter.get("/duties", (req, res) => {
  const duties = buildDutyView(req.user.dutyIds);
  res.json({ ok: true, ...duties, identity: publicProfile(req.user) });
});

profileRouter.post("/duties", (req, res) => {
  const result = registerDuty(req.body || {});
  if (!result.ok) {
    res.status(400).json(result);
    return;
  }
  const duties = buildDutyView(req.user.dutyIds);
  res.json({ ok: true, item: result.item, updated: result.updated, ...duties });
});

profileRouter.put("/", async (req, res) => {
  const displayName = typeof req.body?.displayName === "string" ? req.body.displayName.trim() : "";
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const phone = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
  const changed = [];
  if (displayName !== req.user.displayName) {
    changed.push("姓名");
  }
  if (email !== req.user.email) {
    changed.push("邮箱");
  }
  if (phone !== req.user.phone) {
    changed.push("联系方式");
  }
  req.user.displayName = displayName;
  req.user.email = email;
  req.user.phone = phone;
  await persistUser(req.user);
  recordProfileLog(req, req.user, "修改资料", changed.length ? "更新了" + changed.join("、") : "保存资料");
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
  if (!(await verifyPassword(currentPassword, req.user.passwordHash))) {
    res.status(403).json({ ok: false, error: "当前密码错误" });
    return;
  }
  req.user.passwordHash = await hashPassword(newPassword);
  await persistUser(req.user);
  recordProfileLog(req, req.user, "修改密码", "已更新登录密码");
  res.json({ ok: true, message: "密码已更新" });
});

profileRouter.get("/logs", async (req, res) => {
  const items = await listProfileLogs(req.user, req.query?.username);
  res.json({
    ok: true,
    scope: isLogAdmin(req.user) ? "all" : "self",
    canDelete: false,
    items
  });
});

profileRouter.post("/logs", (req, res) => {
  const action = typeof req.body?.action === "string" ? req.body.action.trim() : "";
  const allowed = action === "上传头像";
  if (!allowed) {
    res.status(400).json({ ok: false, error: "不支持的操作记录" });
    return;
  }
  recordProfileLog(req, req.user, action, typeof req.body?.detail === "string" ? req.body.detail : "");
  res.json({ ok: true, canDelete: false });
});

profileRouter.delete("/logs", (_req, res) => {
  res.status(403).json({ ok: false, error: "操作日志不可删除" });
});

profileRouter.delete("/logs/:id", (_req, res) => {
  res.status(403).json({ ok: false, error: "操作日志不可删除" });
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
  recordProfileLog(req, req.user, "上传头像", "已保存到服务器");
  res.json({ ok: true, avatarUrl: result.avatarUrl });
});

profileRouter.get("/sessions", (req, res) => {
  const currentSid = parseCookies(req)[COOKIE_NAME] || "";
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
  recordProfileLog(req, req.user, "退出设备", (session.device || "未知设备") + " · " + (session.city || ""));
  res.json({ ok: true });
});

profileRouter.get("/notices", (req, res) => {
  const items = listNotices(req.user.username);
  res.json({
    ok: true,
    unread: items.filter((item) => !item.read).length,
    items
  });
});

profileRouter.post("/notices/read", (req, res) => {
  markNoticesRead(req.user.username);
  res.json({ ok: true, unread: 0 });
});
