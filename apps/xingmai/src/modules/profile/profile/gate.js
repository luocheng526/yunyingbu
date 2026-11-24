import { currentUser } from "./session.js";

function normalizedPath(req) {
  const raw = String(req.path || "/");
  const trimmed = raw.replace(/\/+$/, "");
  return trimmed || "/";
}

export function isPublicRequest(req) {
  const method = String(req.method || "GET").toUpperCase();
  const path = normalizedPath(req);
  if (method === "GET" || method === "HEAD") {
    return path === "/login" || path === "/login.html" || path === "/login.css";
  }
  if (method === "POST") {
    return path === "/api/auth/login" || path === "/api/auth/logout";
  }
  return false;
}

export function wantsJson(req) {
  const path = normalizedPath(req);
  if (path.startsWith("/api/")) {
    return true;
  }
  const accept = String(req.headers.accept || "");
  return accept.includes("application/json") && !accept.includes("text/html");
}

export function requireLoginUnlessPublic(req, res, next) {
  if (isPublicRequest(req)) {
    next();
    return;
  }
  const user = currentUser(req);
  if (user) {
    req.user = user;
    next();
    return;
  }
  if (wantsJson(req)) {
    res.status(401).json({ ok: false, error: "未登录" });
    return;
  }
  res.redirect("/login");
}
