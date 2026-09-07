import { promisify } from "node:util";
import { randomBytes, scrypt, scryptSync, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import mysql from "mysql2/promise";

// xm-mysql 0.1.50  连接池放进已有 auth.js。线上不能新建目录，只能改已有文件。

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

export function getPool() {
  if (!pool) {
    const cfg = mysqlConfig();
    pool = mysql.createPool({
      ...cfg,
      waitForConnections: true,
      connectionLimit: 10,
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
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
];

export async function ensureDatabase() {
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

export async function ensureSchema(target = getPool()) {
  for (const sql of SCHEMA_SQL) {
    await target.query(sql);
  }
}

export async function query(sql, params = []) {
  return getPool().query(sql, params);
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
    return;
  }
  for (const user of users.values()) {
    await persistUser(user);
  }
}

export function resetStoreForTests() {
  setPoolForTests(null);
  setDbMode("memory");
  users.clear();
  sessions.clear();
  seed();
}

export function publicProfile(user) {
  if (!user) {
    return null;
  }
  return {
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    phone: user.phone
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
  return users.get(session.username) ?? null;
}

function setSessionCookie(res, sid) {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=${encodeURIComponent(sid)}; HttpOnly; Path=/; SameSite=Lax`);
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}

function sendProfile(res, user) {
  const profile = publicProfile(user);
  res.json({
    ok: true,
    username: profile.username,
    displayName: profile.displayName,
    email: profile.email,
    phone: profile.phone
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
  const user = resolveUser(username);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    res.status(401).json({ ok: false, error: "用户名或密码错误" });
    return;
  }
  const sid = `${Date.now().toString(36)}-${randomBytes(12).toString("hex")}`;
  sessions.set(sid, { username: user.username, createdAt: Date.now() });
  setSessionCookie(res, sid);
  res.json({ ok: true, remember: Boolean(req.body?.remember), user: publicProfile(user) });
});

authRouter.post("/logout", (req, res) => {
  const sid = parseCookies(req)[COOKIE_NAME];
  if (sid) {
    sessions.delete(sid);
  }
  clearSessionCookie(res);
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
  if (!(await verifyPassword(currentPassword, req.user.passwordHash))) {
    res.status(403).json({ ok: false, error: "当前密码错误" });
    return;
  }
  req.user.passwordHash = await hashPassword(newPassword);
  await persistUser(req.user);
  res.json({ ok: true, message: "密码已更新" });
});
