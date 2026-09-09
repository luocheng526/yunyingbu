import { Router } from "express";
import { currentUser } from "../profile/auth.js";
import { parseMultipart } from "./multipart.js";
import {
  createPptCourse,
  getPptCourse,
  getPptPage,
  mediaType,
  readPptMedia
} from "./ppt-store.js";
import {
  catalog,
  courses,
  doc,
  docs,
  examTrack,
  examTracks,
  frameworkPlan,
  handbook,
  listProgress,
  search,
  setProgress
} from "./store.js";

export const academyRouter = Router();

function requireUser(req, res) {
  const user = currentUser(req) || req.user;
  if (!user) {
    res.status(401).json({ ok: false, error: "未登录" });
    return null;
  }
  return user;
}

function publishedFilter(raw, fallback = true) {
  const value = raw == null ? fallback : raw;
  if (value === "all" || value === "全部") {
    return "all";
  }
  if (value === false || value === "false" || value === "0" || value === "draft" || value === "草稿") {
    return false;
  }
  return true;
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
    schema: data.schema,
    note: data.note,
    categories: data.categories,
    docs: data.docs,
    stats: data.stats
  });
});

academyRouter.get("/plan", (req, res) => {
  if (!requireUser(req, res)) {
    return;
  }
  res.json({ ok: true, module: "甄选商学院", ...frameworkPlan() });
});

function denyOriginal(res) {
  res.status(404).json({ ok: false, error: "不提供原件下载，请在线翻页" });
}

academyRouter.get("/courses", async (req, res) => {
  if (!requireUser(req, res)) {
    return;
  }
  res.json({ ok: true, ...(await courses()) });
});

academyRouter.post("/courses", async (req, res) => {
  const user = requireUser(req, res);
  if (!user) {
    return;
  }
  try {
    const { fields, file } = await parseMultipart(req);
    const course = await createPptCourse({
      title: fields.title,
      category: fields.category,
      published: fields.published,
      file,
      createdBy: user.username
    });
    res.status(201).json({ ok: true, course, download: false });
  } catch (err) {
    res.status(err.statusCode || 500).json({ ok: false, error: err.message });
  }
});

academyRouter.get("/courses/:id/source.pptx", (_req, res) => denyOriginal(res));
academyRouter.get("/courses/:id/source.ppt", (_req, res) => denyOriginal(res));
academyRouter.get("/courses/:id/download", (_req, res) => denyOriginal(res));
academyRouter.get("/courses/:id/file", (_req, res) => denyOriginal(res));
academyRouter.get("/courses/:id/original", (_req, res) => denyOriginal(res));

academyRouter.get("/courses/:id/pages/:index/media/:name", async (req, res) => {
  if (!requireUser(req, res)) {
    return;
  }
  try {
    const course = await getPptCourse(req.params.id, { allowUnpublished: true });
    if (!course) {
      res.status(404).json({ ok: false, error: "课件不存在" });
      return;
    }
    const buf = await readPptMedia(req.params.id, req.params.name);
    res.setHeader("Content-Type", mediaType(req.params.name));
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(buf);
  } catch (err) {
    res.status(err.statusCode || 404).json({ ok: false, error: err.message });
  }
});

academyRouter.get("/courses/:id/pages/:index", async (req, res) => {
  if (!requireUser(req, res)) {
    return;
  }
  const data = await getPptPage(req.params.id, req.params.index);
  if (!data) {
    res.status(404).json({ ok: false, error: "没有这一页" });
    return;
  }
  res.json({ ok: true, download: false, watermark: true, ...data });
});

academyRouter.get("/courses/:id", async (req, res) => {
  if (!requireUser(req, res)) {
    return;
  }
  const course = await getPptCourse(req.params.id, { allowUnpublished: true });
  if (!course) {
    res.status(404).json({ ok: false, error: "课件不存在" });
    return;
  }
  res.json({ ok: true, download: false, watermark: true, course });
});

academyRouter.get("/exams/tracks", (req, res) => {
  if (!requireUser(req, res)) {
    return;
  }
  res.json({ ok: true, tracks: examTracks() });
});

academyRouter.get("/exams/tracks/:id", (req, res) => {
  if (!requireUser(req, res)) {
    return;
  }
  const track = examTrack(req.params.id);
  if (!track) {
    res.status(404).json({ ok: false, error: "没有这一档考试" });
    return;
  }
  res.json({ ok: true, track, paper: { ready: false, questions: [] } });
});

academyRouter.get("/handbook/tree", (req, res) => {
  if (!requireUser(req, res)) {
    return;
  }
  res.json({ ok: true, tree: handbook() });
});

academyRouter.get("/search", (req, res) => {
  if (!requireUser(req, res)) {
    return;
  }
  const q = String(req.query.q || req.query.query || "").trim();
  const hits = search(q, {
    published: publishedFilter(req.query.published, true),
    categoryId: String(req.query.category || req.query.categoryId || "").trim(),
    limit: Number(req.query.limit) || 20
  });
  res.json({
    ok: true,
    schema: ["title", "category", "body", "published"],
    query: q,
    publishedOnly: publishedFilter(req.query.published, true) === true,
    hits
  });
});

academyRouter.get("/docs", (req, res) => {
  if (!requireUser(req, res)) {
    return;
  }
  const published = publishedFilter(req.query.published, true);
  res.json({
    ok: true,
    schema: ["title", "category", "body", "published"],
    docs: docs({
      published,
      categoryId: String(req.query.category || req.query.categoryId || "").trim(),
      includeBody: String(req.query.body || "") === "1"
    })
  });
});

academyRouter.get("/docs/:id", (req, res) => {
  if (!requireUser(req, res)) {
    return;
  }
  const allowUnpublished = String(req.query.draft || "") === "1";
  const item = doc(req.params.id, { allowUnpublished });
  if (!item) {
    res.status(404).json({ ok: false, error: "课件不存在或未发布" });
    return;
  }
  res.json({ ok: true, doc: item });
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
