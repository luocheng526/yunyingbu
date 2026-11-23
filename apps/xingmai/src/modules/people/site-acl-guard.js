import { hydrateSiteAcl, moduleIdForPath, navVisibility } from "./site-acl.js";
import { hydratePeopleRoster } from "./store.js";

const SKIP_PREFIX = ["/api/", "/shared/", "/login", "/assets/", "/favicon"];
const FILE_EXT = /\.(js|css|mjs|map|png|jpe?g|gif|svg|ico|webp|woff2?|ttf|json|html)$/i;

function shouldSkip(pathname) {
  const dest = String(pathname || "").replace(/\/+$/, "") || "/";
  if (FILE_EXT.test(dest)) {
    return true;
  }
  return SKIP_PREFIX.some((prefix) => dest === prefix.replace(/\/+$/, "") || dest.startsWith(prefix));
}

async function resolveActor(req) {
  const fromQuery = typeof req.query?.actor === "string" ? req.query.actor.trim() : "";
  const header = typeof req.headers["x-actor"] === "string" ? req.headers["x-actor"].trim() : "";
  if (req.user && req.user.username) {
    return String(req.user.username);
  }
  try {
    const auth = await import("../profile/auth.js");
    if (typeof auth.currentUser === "function") {
      const user = auth.currentUser(req);
      if (user && user.username) {
        return String(user.username);
      }
    }
    return fromQuery || header || "";
  } catch {
    return fromQuery || header || "";
  }
}

export async function siteAclGuard(req, res, next) {
  try {
    if (req.method !== "GET" && req.method !== "HEAD") {
      next();
      return;
    }
    const dest = String(req.path || "").replace(/\/+$/, "") || "/";
    if (shouldSkip(dest)) {
      next();
      return;
    }
    const mod = moduleIdForPath(dest);
    if (!mod || mod === "profile") {
      next();
      return;
    }
    await hydratePeopleRoster();
    await hydrateSiteAcl();
    const actor = await resolveActor(req);
    if (!actor) {
      next();
      return;
    }
    const vis = navVisibility(actor);
    if (!vis.configured) {
      next();
      return;
    }
    if (mod === "people") {
      const peopleCap = vis.paths["/people"] || {};
      const noticesCap = vis.paths["/notices"] || {};
      if (peopleCap.see || peopleCap.enter) {
        next();
        return;
      }
      if (String(req.query?.pane || "") === "notices" && (noticesCap.see || noticesCap.enter)) {
        next();
        return;
      }
      res.redirect(302, "/me");
      return;
    }
    const hrefs = Object.keys(vis.paths || {});
    const hit = hrefs
      .filter((href) => dest === href || dest.startsWith(`${href}/`))
      .sort((a, b) => b.length - a.length)[0];
    const cap = (hit && vis.paths[hit]) || vis.paths[`/${mod}`];
    if (cap && (cap.see || cap.enter)) {
      next();
      return;
    }
    res.redirect(302, "/me");
  } catch {
    next();
  }
}

export function attachSiteAclGuard(app) {
  if (!app || typeof app.use !== "function" || app.__xmSiteAclGuard) {
    return false;
  }
  app.__xmSiteAclGuard = true;
  app.use(siteAclGuard);
  const stack = app._router && app._router.stack;
  if (stack && stack.length > 1) {
    stack.unshift(stack.pop());
  }
  return true;
}
