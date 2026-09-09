import { Router } from "express";
import { currentUser } from "../profile/auth.js";
import { catalog, course, listProgress, setProgress } from "./store.js";

export const academyRouter = Router();

function requireUser(req, res) {
  const user = currentUser(req) || req.user;
  if (!user) {
    res.status(401).json({ ok: false, error: "未登录" });
    return null;
  }
  return user;
}

academyRouter.get("/", (req, res) => {
  if (!requireUser(req, res)) {
    return;
  }
  const data = catalog();
  res.json({
    ok: true,
    module: "甄选商学院",
    title: data.title,
    tracks: data.tracks,
    courses: data.courses,
    stats: data.stats
  });
});

academyRouter.get("/courses/:id", (req, res) => {
  if (!requireUser(req, res)) {
    return;
  }
  const item = course(req.params.id);
  if (!item) {
    res.status(404).json({ ok: false, error: "课程不存在" });
    return;
  }
  res.json({ ok: true, course: item });
});

academyRouter.get("/progress", async (req, res) => {
  const user = requireUser(req, res);
  if (!user) {
    return;
  }
  res.json({ ok: true, progress: await listProgress(user.username) });
});

academyRouter.post("/progress", async (req, res) => {
  const user = requireUser(req, res);
  if (!user) {
    return;
  }
  try {
    const row = await setProgress(user.username, req.body || {});
    res.json({ ok: true, progress: row });
  } catch (err) {
    res.status(err.statusCode || 500).json({ ok: false, error: err.message });
  }
});

export default academyRouter;
