import { Router } from "express";
import { currentUser } from "../profile/auth.js";
import {
  addHandbookBranch,
  addHandbookImage,
  getHandbookSection,
  handbookMediaType,
  moveHandbookNode,
  readHandbookMedia,
  saveHandbookSection
} from "./handbook-store.js";
import { appendHandbookLog, listHandbookLogs } from "./log-store.js";
import { canEditHandbook, seatsUserCanGrade } from "./framework.js";
import { isRawUpload, parseMultipart, readRawBody } from "./multipart.js";
import {
  examAccept,
  getExamPaper,
  gradeExamAttempt,
  gradeExamPaper,
  importExamPaper,
  listExamAttempts
} from "./exam-store.js";
import {
  createPptCourse,
  getPptCourse,
  getPptPage,
  listPptPages,
  mediaType,
  readPptMedia,
  receivePptChunk
} from "./ppt-store.js";
import {
  catalog,
  courses,
  doc,
  docs,
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

function requireHandbookEditor(req, res) {
  const user = requireUser(req, res);
  if (!user) {
    return null;
  }
  if (!canEditHandbook(user)) {
    res.status(403).json({ ok: false, error: "手册由罗成、沈子晗、韩梦凯双击修改" });
    return null;
  }
  return user;
}

function actorOf(user) {
  return {
    actor: user.username,
    actorName: user.displayName || user.username
  };
}

academyRouter.get("/courses", async (req, res) => {
  if (!requireUser(req, res)) {
    return;
  }
  res.json({ ok: true, ...(await courses()) });
});

async function pptUploadPayload(req) {
  if (isRawUpload(req)) {
    const title = String(req.query.title || "").trim();
    const category = String(req.query.category || "").trim();
    const published = String(req.query.published || "1");
    const filename = String(req.query.filename || "course.pptx").trim() || "course.pptx";
    const buffer = await readRawBody(req);
    return {
      title,
      category,
      published,
      file: {
        field: "file",
        filename,
        type: "application/octet-stream",
        buffer
      }
    };
  }
  const { fields, file } = await parseMultipart(req);
  return {
    title: fields.title,
    category: fields.category,
    published: fields.published,
    file
  };
}

async function logCourseUpload(user, course) {
  await appendHandbookLog({
    ...actorOf(user),
    action: "上传课件",
    sectionId: course && course.id,
    sectionTitle: course && course.title,
    detail: course && course.originalName ? course.originalName : "PPTX"
  });
}

academyRouter.post("/courses/chunk", async (req, res) => {
  const user = requireUser(req, res);
  if (!user) {
    return;
  }
  try {
    const buffer = await readRawBody(req, { maxBytes: 128 * 1024 });
    const result = await receivePptChunk({
      uploadId: req.query.uploadId,
      index: req.query.index,
      total: req.query.total,
      size: req.query.size,
      title: req.query.title,
      category: req.query.category,
      published: req.query.published,
      filename: req.query.filename,
      buffer,
      createdBy: user.username
    });
    if (result.pending) {
      res.json({ ok: true, pending: true, received: result.received, total: result.total });
      return;
    }
    await logCourseUpload(user, result.course);
    res.status(201).json({ ok: true, course: result.course, download: false });
  } catch (err) {
    res.status(err.statusCode || 500).json({ ok: false, error: err.message });
  }
});

academyRouter.post("/courses", async (req, res) => {
  const user = requireUser(req, res);
  if (!user) {
    return;
  }
  try {
    const payload = await pptUploadPayload(req);
    const course = await createPptCourse({
      title: payload.title,
      category: payload.category,
      published: payload.published,
      file: payload.file,
      createdBy: user.username
    });
    await logCourseUpload(user, course);
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
  const packed = await listPptPages(req.params.id);
  if (!packed) {
    res.status(404).json({ ok: false, error: "课件不存在" });
    return;
  }
  res.json({
    ok: true,
    download: false,
    watermark: true,
    course: packed,
    pages: packed.pages || [],
    renderError: packed.renderError || ""
  });
});

function denyExamOriginal(res) {
  res.status(404).json({ ok: false, error: "不提供考试原件下载，请在线作答" });
}

academyRouter.get("/exams/tracks", async (req, res) => {
  if (!requireUser(req, res)) {
    return;
  }
  res.json({ ok: true, accept: examAccept(), tracks: await examTracks() });
});

academyRouter.post("/exams/papers", async (req, res) => {
  const user = requireUser(req, res);
  if (!user) {
    return;
  }
  try {
    const { fields, file } = await parseMultipart(req);
    const data = await importExamPaper({
      trackId: fields.trackId || fields.track,
      file,
      createdBy: user.username
    });
    res.status(201).json({ ok: true, download: false, ...data });
    await appendHandbookLog({
      actor: user.username,
      actorName: user.displayName || user.username,
      action: "导入考试",
      sectionId: data.track && data.track.id,
      sectionTitle: data.track && data.track.name,
      detail: data.paper && data.paper.questionCount ? data.paper.questionCount + " 题" : ""
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ ok: false, error: err.message });
  }
});

academyRouter.get("/exams/tracks/:id/source", (_req, res) => denyExamOriginal(res));
academyRouter.get("/exams/tracks/:id/source.xlsx", (_req, res) => denyExamOriginal(res));
academyRouter.get("/exams/tracks/:id/download", (_req, res) => denyExamOriginal(res));
academyRouter.get("/exams/tracks/:id/file", (_req, res) => denyExamOriginal(res));

academyRouter.post("/exams/tracks/:id/submit", async (req, res) => {
  const user = requireUser(req, res);
  if (!user) {
    return;
  }
  try {
    const result = await gradeExamPaper(req.params.id, (req.body || {}).answers, user);
    res.json({ ok: true, result });
  } catch (err) {
    res.status(err.statusCode || 500).json({ ok: false, error: err.message });
  }
});

academyRouter.get("/exams/attempts", async (req, res) => {
  const user = requireUser(req, res);
  if (!user) {
    return;
  }
  try {
    const trackId = String(req.query.trackId || req.query.track || "");
    const items = await listExamAttempts(user, { trackId });
    const gradeSeats = trackId ? await seatsUserCanGrade(user, trackId) : [];
    res.json({ ok: true, gradeSeats, items });
  } catch (err) {
    res.status(err.statusCode || 500).json({ ok: false, error: err.message });
  }
});

academyRouter.post("/exams/attempts/:id/grade", async (req, res) => {
  const user = requireUser(req, res);
  if (!user) {
    return;
  }
  try {
    const data = await gradeExamAttempt(req.params.id, {
      user,
      seat: (req.body || {}).seat,
      scores: (req.body || {}).scores,
      comment: (req.body || {}).comment
    });
    res.json({ ok: true, ...data });
  } catch (err) {
    res.status(err.statusCode || 500).json({ ok: false, error: err.message });
  }
});

academyRouter.get("/exams/tracks/:id", async (req, res) => {
  const user = requireUser(req, res);
  if (!user) {
    return;
  }
  const packed = await getExamPaper(req.params.id, { includeAnswers: false });
  if (!packed) {
    res.status(404).json({ ok: false, error: "没有这一档考试" });
    return;
  }
  const gradeSeats = await seatsUserCanGrade(user, packed.track);
  res.json({
    ok: true,
    accept: examAccept(),
    download: false,
    track: packed.track,
    paper: packed.paper,
    gradeSeats
  });
});

academyRouter.get("/handbook/tree", async (req, res) => {
  const user = requireUser(req, res);
  if (!user) {
    return;
  }
  res.json({
    ok: true,
    editors: ["罗成", "沈子晗", "韩梦凯"],
    canEdit: canEditHandbook(user),
    tree: await handbook()
  });
});

academyRouter.get("/logs", async (req, res) => {
  if (!requireUser(req, res)) {
    return;
  }
  res.json({ ok: true, items: await listHandbookLogs(120) });
});

academyRouter.get("/handbook/media/:name", async (req, res) => {
  if (!requireUser(req, res)) {
    return;
  }
  try {
    const buf = await readHandbookMedia(req.params.name);
    res.setHeader("Content-Type", handbookMediaType(req.params.name));
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Cache-Control", "private, no-store");
    res.send(buf);
  } catch (err) {
    res.status(err.statusCode || 404).json({ ok: false, error: err.message });
  }
});

academyRouter.get("/handbook/sections/:id", async (req, res) => {
  if (!requireUser(req, res)) {
    return;
  }
  const section = await getHandbookSection(req.params.id);
  if (!section) {
    res.status(404).json({ ok: false, error: "没有这一节" });
    return;
  }
  res.json({ ok: true, section });
});

academyRouter.post("/handbook/sections/:id", async (req, res) => {
  const user = requireHandbookEditor(req, res);
  if (!user) {
    return;
  }
  try {
    const section = await saveHandbookSection(req.params.id, req.body || {});
    await appendHandbookLog({
      ...actorOf(user),
      action: "改正文",
      sectionId: section.id,
      sectionTitle: section.title,
      detail: String((req.body || {}).title || section.title)
    });
    res.json({ ok: true, section });
  } catch (err) {
    res.status(err.statusCode || 500).json({ ok: false, error: err.message });
  }
});

academyRouter.post("/handbook/sections/:id/images", async (req, res) => {
  const user = requireHandbookEditor(req, res);
  if (!user) {
    return;
  }
  try {
    const { file } = await parseMultipart(req, { maxBytes: 5 * 1024 * 1024 });
    const section = await addHandbookImage(req.params.id, file);
    await appendHandbookLog({
      ...actorOf(user),
      action: "插图",
      sectionId: section.id,
      sectionTitle: section.title,
      detail: file && file.filename ? file.filename : "图片"
    });
    res.status(201).json({ ok: true, section });
  } catch (err) {
    res.status(err.statusCode || 500).json({ ok: false, error: err.message });
  }
});

academyRouter.post("/handbook/branches", async (req, res) => {
  const user = requireHandbookEditor(req, res);
  if (!user) {
    return;
  }
  try {
    const section = await addHandbookBranch({
      parentId: (req.body || {}).parentId,
      title: (req.body || {}).title
    });
    await appendHandbookLog({
      ...actorOf(user),
      action: "加分支",
      sectionId: section.id,
      sectionTitle: section.title,
      detail: "挂在 " + String((req.body || {}).parentId || "")
    });
    res.status(201).json({ ok: true, section, tree: await handbook() });
  } catch (err) {
    res.status(err.statusCode || 500).json({ ok: false, error: err.message });
  }
});

academyRouter.post("/handbook/reorder", async (req, res) => {
  const user = requireHandbookEditor(req, res);
  if (!user) {
    return;
  }
  try {
    const tree = await moveHandbookNode({
      id: (req.body || {}).id,
      beforeId: (req.body || {}).beforeId,
      parentId: (req.body || {}).parentId
    });
    await appendHandbookLog({
      ...actorOf(user),
      action: "调顺序",
      sectionId: String((req.body || {}).id || ""),
      sectionTitle: "",
      detail: "拖拽菜单"
    });
    res.json({ ok: true, tree });
  } catch (err) {
    res.status(err.statusCode || 500).json({ ok: false, error: err.message });
  }
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
