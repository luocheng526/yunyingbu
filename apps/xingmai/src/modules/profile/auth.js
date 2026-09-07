import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { Router } from "express";

export const COOKIE_NAME = "mk_sid";
export const DEMO_USERNAME = "罗成";
export const DEMO_INITIAL_PASSWORD = "ChangeMe123!";

const KEYLEN = 64;
const users = new Map();
const sessions = new Map();

function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEYLEN);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

function verifyPassword(password, stored) {
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
    const actual = scryptSync(password, salt, expected.length);
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
    passwordHash: hashPassword(DEMO_INITIAL_PASSWORD)
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

export function resetStoreForTests() {
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

authRouter.post("/login", (req, res) => {
  const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!username || !password) {
    res.status(401).json({ ok: false, error: "请输入用户名和密码" });
    return;
  }
  const user = resolveUser(username);
  if (!user || !verifyPassword(password, user.passwordHash)) {
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

profileRouter.put("/", (req, res) => {
  const displayName = typeof req.body?.displayName === "string" ? req.body.displayName.trim() : "";
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const phone = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
  req.user.displayName = displayName;
  req.user.email = email;
  req.user.phone = phone;
  sendProfile(res, req.user);
});

profileRouter.post("/password", (req, res) => {
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
  if (!verifyPassword(currentPassword, req.user.passwordHash)) {
    res.status(403).json({ ok: false, error: "当前密码错误" });
    return;
  }
  req.user.passwordHash = hashPassword(newPassword);
  res.json({ ok: true, message: "密码已更新" });
});
