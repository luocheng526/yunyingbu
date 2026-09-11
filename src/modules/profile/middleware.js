import { currentUser } from "./auth.js";

function normalizedPath(req) {
  const raw = String(req.path || "/");
  const trimmed = raw.replace(/\/+$/, "");
  return trimmed || "/";
}

function isSharedAsset(path) {
  return path === "/login.css" || path.startsWith("/shared/");
}

function isApiPath(path) {
  return path.startsWith("/api/");
}

export function isPublicRequest(req) {
  const method = String(req.method || "GET").toUpperCase();
  const path = normalizedPath(req);
  if (method === "GET" || method === "HEAD") {
    if (isSharedAsset(path) || path === "/login" || path === "/api/health") {
      return true;
    }
  }
  if (method === "POST" && (path === "/api/auth/login" || path === "/api/auth/logout")) {
    return true;
  }
  return false;
}

function cacheControlFor(path) {
  if (isApiPath(path)) {
    return "no-store";
  }
  if (isSharedAsset(path)) {
    return "public, max-age=3600";
  }
  return "no-cache";
}

export function applyCachePolicy(req, res, next) {
  const path = normalizedPath(req);
  const wanted = cacheControlFor(path);
  const original = res.setHeader.bind(res);
  res.setHeader = function setHeader(name, value) {
    if (String(name).toLowerCase() === "cache-control") {
      return original.call(res, "Cache-Control", wanted);
    }
    return original.call(res, name, value);
  };
  res.setHeader("Cache-Control", wanted);
  next();
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
  if (isApiPath(normalizedPath(req))) {
    res.status(401).json({ ok: false, error: "未登录" });
    return;
  }
  res.redirect("/login");
}
