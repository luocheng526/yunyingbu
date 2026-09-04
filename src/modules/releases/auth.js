import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const COOKIE_NAME = "mk_sid";

const profileSessionPath = fileURLToPath(new URL("../profile/session.js", import.meta.url));

let profileCurrentUser = undefined;
let profileImport = null;

function loadProfileCurrentUser() {
  if (profileCurrentUser !== undefined) {
    return Promise.resolve(profileCurrentUser);
  }
  if (!existsSync(profileSessionPath)) {
    return Promise.resolve(null);
  }
  if (!profileImport) {
    profileImport = import("../profile/session.js")
      .then((mod) => {
        profileCurrentUser = typeof mod.currentUser === "function" ? mod.currentUser : null;
        return profileCurrentUser;
      })
      .catch(() => {
        profileCurrentUser = null;
        profileImport = null;
        return null;
      });
  }
  return profileImport;
}

export async function resolveUser(req, options = {}) {
  if (Object.prototype.hasOwnProperty.call(options, "getUser")) {
    return options.getUser(req) || null;
  }
  const currentUser = await loadProfileCurrentUser();
  if (typeof currentUser !== "function") {
    return null;
  }
  return currentUser(req) || null;
}

export function requireReleasesAuth(options = {}) {
  return async function requireReleasesAuthMiddleware(req, res, next) {
    const user = await resolveUser(req, options);
    if (!user) {
      res.status(401).json({ ok: false, error: "未登录" });
      return;
    }
    req.user = user;
    next();
  };
}

function isReleasesPage(req) {
  const method = String(req.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    return false;
  }
  const path = String(req.path || "/").replace(/\/+$/, "") || "/";
  return path === "/releases" || path === "/releases.html";
}

export function releasesPageGate(options = {}) {
  return async function releasesPageGateMiddleware(req, res, next) {
    if (!isReleasesPage(req)) {
      next();
      return;
    }
    const user = await resolveUser(req, options);
    if (user) {
      next();
      return;
    }
    res.redirect("/login");
  };
}
