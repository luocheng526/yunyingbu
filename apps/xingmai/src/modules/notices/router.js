import { Router } from "express";
import { permissionsFor, noticeFeature } from "../people/feature-policy.js";
import {
  bannerNotices,
  getNotice,
  hydrateNotices,
  listNotices,
  popupNotice,
  removeNotice,
  upsertNotice
} from "./store.js";

export const noticesRouter = Router();

noticesRouter.use(async (req, res, next) => {
  try {
    if (["/banner", "/popup"].includes(req.path)) return next();
    const user = await resolveUser(req);
    const policy = permissionsFor(user, "notices");
    if (!policy.configured) return next();
    await hydrateNotices();
    const write = !["GET", "HEAD"].includes(req.method);
    const right = write ? "edit" : "enter";
    const existing = req.path !== "/" ? getNotice(req.path.slice(1)) : null;
    const permitted = category => policy.can("all", right) || policy.can(noticeFeature(category), right);
    if (!policy.any(right) || (existing && !permitted(existing.category)) || (write && !permitted(req.body?.category || existing?.category))) return res.status(403).json({ ok: false, error: "未授予此公告分类的权限" });
    const json = res.json.bind(res);
    res.json = body => {
      if (Array.isArray(body?.items)) {
        body = { ...body, items: body.items.filter(item => permitted(item.category)) };
        if (body.stats) body.stats = { ...body.stats, active: body.items.filter(item => item.status === "active").length };
        if (body.categories) body.categories = body.categories.filter(item => permitted(item.id));
      }
      return json(body);
    };
    next();
  } catch (err) { next(err); }
});

const mountedOn = new WeakSet();

async function resolveUser(req) {
  if (req.user && req.user.username) {
    return req.user;
  }
  try {
    const auth = await import("../profile/auth.js");
    if (typeof auth.currentUser === "function") {
      const user = auth.currentUser(req);
      if (user && user.username) {
        return user;
      }
      return null;
    }
  } catch {
    /* local repo has no profile/auth.js */
  }
  return { username: "罗成", displayName: "罗成" };
}

async function requireUser(req, res) {
  const user = await resolveUser(req);
  if (!user) {
    res.status(401).json({ ok: false, error: "未登录" });
    return null;
  }
  return user;
}

export function attachNoticesBeside(app, peoplePath = "/api/people") {
  if (!app || typeof app.use !== "function") {
    return false;
  }
  if (mountedOn.has(app)) {
    return true;
  }
  const trimmed = String(peoplePath || "").replace(/\/+$/, "");
  const noticesPath = trimmed.endsWith("/people") ? `${trimmed.slice(0, -"/people".length)}/notices` : "/api/notices";
  mountedOn.add(app);
  app.use(noticesPath, noticesRouter);
  hydrateNotices().catch((err) => {
    console.error("[notices] hydrate failed", err);
  });
  return true;
}

export function attachNotices(app) {
  return attachNoticesBeside(app, "/api/people");
}

noticesRouter.get("/", async (req, res) => {
  if (!(await requireUser(req, res))) {
    return;
  }
  await hydrateNotices();
  res.json(listNotices(req.query || {}));
});

noticesRouter.get("/banner", async (req, res) => {
  if (!(await requireUser(req, res))) {
    return;
  }
  await hydrateNotices();
  res.json({ ok: true, items: bannerNotices() });
});

noticesRouter.get("/popup", async (req, res) => {
  if (!(await requireUser(req, res))) {
    return;
  }
  await hydrateNotices();
  res.json({ ok: true, item: popupNotice() });
});

noticesRouter.get("/:id", async (req, res) => {
  if (!(await requireUser(req, res))) {
    return;
  }
  await hydrateNotices();
  const item = getNotice(req.params.id);
  if (!item) {
    res.status(404).json({ ok: false, error: "公告不存在" });
    return;
  }
  res.json({ ok: true, item });
});

noticesRouter.post("/", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) {
    return;
  }
  try {
    const result = await upsertNotice({ ...req.body, author: req.body?.author || user.displayName || user.username });
    res.status(result.ok ? 201 : result.statusCode || 400).json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || "保存失败" });
  }
});

noticesRouter.put("/:id", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) {
    return;
  }
  await hydrateNotices();
  if (!getNotice(req.params.id)) {
    res.status(404).json({ ok: false, error: "公告不存在" });
    return;
  }
  try {
    const result = await upsertNotice(
      { ...req.body, author: req.body?.author || user.displayName || user.username },
      req.params.id
    );
    res.status(result.ok ? 200 : result.statusCode || 400).json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || "保存失败" });
  }
});

noticesRouter.delete("/:id", async (req, res) => {
  if (!(await requireUser(req, res))) {
    return;
  }
  const result = await removeNotice(req.params.id);
  res.status(result.ok ? 200 : result.statusCode || 400).json(result);
});
