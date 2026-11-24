import { hydrateSiteAcl, moduleIdForPath, navVisibility, canonicalActor, effectiveSiteAcl } from "./site-acl.js";
import { hydratePeopleRoster } from "./store.js";
import { hydrateOrgStores } from "./org-board.js";
import { featureForRequest, storeScope, checkStoreRequest, protectStoreResponse } from "./access-policy.js";

const SKIP_PREFIX = ["/shared/", "/login", "/assets/", "/favicon"];
const FILE_EXT = /\.(js|css|mjs|map|png|jpe?g|gif|svg|ico|webp|woff2?|ttf)$/i;

function shouldSkip(pathname) {
  const dest = String(pathname || "").replace(/\/+$/, "") || "/";
  if (FILE_EXT.test(dest)) {
    return true;
  }
  return SKIP_PREFIX.some((prefix) => dest === prefix.replace(/\/+$/, "") || dest.startsWith(prefix));
}

async function resolveActor(req) {
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
    return "";
  } catch {
    return "";
  }
}

export async function siteAclGuard(req, res, next) {
  try {
    const dest = String(req.path || "").replace(/\/+$/, "") || "/";
    const api = dest.startsWith("/api/");
    const read = req.method === "GET" || req.method === "HEAD";
    // Shared shell metadata is needed even when the organization editor is hidden.
    const shared = read && ["/api/people", "/api/people/org/stores", "/api/people/org/summary", "/api/people/org/site-acl/me", "/api/notices/banner", "/api/notices/popup"].includes(dest);
    if (shared || (read && /\.(?:js|css)$/.test(dest)) || (!api && shouldSkip(dest))) {
      next();
      return;
    }
    const route = (api ? dest.slice(4) : dest).replace(/^\/people\/notices/, "/notices");
    const mod = route.startsWith("/profile") ? "profile" : moduleIdForPath(route);
    if (!mod || (!api && mod === "profile") || (api && mod === "profile" && read)) {
      next();
      return;
    }
    await hydratePeopleRoster();
    await hydrateOrgStores();
    await hydrateSiteAcl();
    const actor = canonicalActor(await resolveActor(req));
    if (!actor) {
      next();
      return;
    }
    const vis = navVisibility(actor);
    if (!vis.configured) {
      next();
      return;
    }
    if (api) {
      const sheet = effectiveSiteAcl(actor);
      const required = read ? "enter" : "edit";
      const cap = sheet.modules[mod];
      const feature = featureForRequest(mod, dest, req.query || {}, req.method, req.body || {});
      if (!cap?.[required] || (feature && !(Array.isArray(feature) ? feature : [feature]).some(id => cap.features?.[id]?.[required]))) {
        res.status(403).json({ ok: false, error: "组织中心未授予此操作权限", code: "SITE_ACL_DENIED" });
        return;
      }
      const scope = storeScope(actor);
      res.set("Cache-Control", "private, no-store");
      if (!checkStoreRequest(scope, mod, req)) {
        res.status(403).json({ ok: false, error: "组织中心未授予此店铺的数据操作权限", code: "STORE_ACL_DENIED" });
        return;
      }
      protectStoreResponse(res, mod, scope, dest);
      if (mod === 'hr' && read && dest === '/api/hr/staff' && !cap.features?.['hr.staff']?.enter) {
        const json = res.json.bind(res);
        res.json = body => json(Array.isArray(body?.staff) ? {...body, staff:body.staff.map(person=>Object.fromEntries(['id','name','department','position','status'].map(key=>[key,person[key]])))} : body);
      }
      next();
      return;
    }
    if (mod === "people") {
      const peopleCap = vis.paths["/people"] || {};
      const noticesCap = vis.paths["/notices"] || {};
      if (peopleCap.enter) {
        next();
        return;
      }
      if (String(req.query?.pane || "") === "notices" && noticesCap.enter) {
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
    if (cap && cap.enter) {
      next();
      return;
    }
    res.redirect(302, "/me");
  } catch {
    res.status(503).json({ ok: false, error: "权限同步暂时不可用，请稍后重试" });
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
    const guard = stack.pop();
    const login = stack.findIndex(layer => layer.name === "requireLoginUnlessPublic");
    const parser = stack.findIndex(layer => layer.name === "jsonParser");
    stack.splice(login >= 0 ? login + 1 : parser >= 0 ? parser + 1 : 2, 0, guard);
  }
  return true;
}
