import { createSession, destroySession, findUser, getSession } from "./store.js";

export const COOKIE_NAME = "mk_sid";

export function parseCookies(req) {
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

export function readSessionId(req) {
  return parseCookies(req)[COOKIE_NAME] || "";
}

export function setSessionCookie(res, sid) {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=${encodeURIComponent(sid)}; HttpOnly; Path=/; SameSite=Lax`);
}

export function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}

export function issueSession(username) {
  return createSession(username);
}

export function currentUser(req) {
  const sid = readSessionId(req);
  const session = getSession(sid);
  if (!session) {
    return null;
  }
  return findUser(session.username);
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

export function logoutRequest(req, res) {
  destroySession(readSessionId(req));
  clearSessionCookie(res);
}
