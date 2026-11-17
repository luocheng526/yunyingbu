import { Router } from "express";
import { currentUser } from "../profile/auth.js";
import { bannerNotices, getNotice, listNotices, popupNotice, removeNotice, upsertNotice } from "./store.js";

export const noticesRouter = Router();

function requireUser(req, res) {
  const user = currentUser(req);
  if (!user) {
    res.status(401).json({ ok: false, error: "未登录" });
    return null;
  }
  return user;
}

noticesRouter.get("/", (req, res) => {
  if (!requireUser(req, res)) {
    return;
  }
  res.json(listNotices(req.query || {}));
});

noticesRouter.get("/banner", (req, res) => {
  if (!requireUser(req, res)) {
    return;
  }
  res.json({ ok: true, items: bannerNotices() });
});

noticesRouter.get("/popup", (req, res) => {
  if (!requireUser(req, res)) {
    return;
  }
  const item = popupNotice();
  res.json({ ok: true, item });
});

noticesRouter.get("/:id", (req, res) => {
  if (!requireUser(req, res)) {
    return;
  }
  const item = getNotice(req.params.id);
  if (!item) {
    res.status(404).json({ ok: false, error: "公告不存在" });
    return;
  }
  res.json({ ok: true, item });
});

noticesRouter.post("/", (req, res) => {
  const user = requireUser(req, res);
  if (!user) {
    return;
  }
  const result = upsertNotice({ ...req.body, author: req.body?.author || user.displayName || user.username });
  res.status(result.ok ? 201 : result.statusCode || 400).json(result);
});

noticesRouter.put("/:id", (req, res) => {
  const user = requireUser(req, res);
  if (!user) {
    return;
  }
  if (!getNotice(req.params.id)) {
    res.status(404).json({ ok: false, error: "公告不存在" });
    return;
  }
  const result = upsertNotice({ ...req.body, author: req.body?.author || user.displayName || user.username }, req.params.id);
  res.status(result.ok ? 200 : result.statusCode || 400).json(result);
});

noticesRouter.delete("/:id", (req, res) => {
  if (!requireUser(req, res)) {
    return;
  }
  const result = removeNotice(req.params.id);
  res.status(result.ok ? 200 : result.statusCode || 400).json(result);
});
