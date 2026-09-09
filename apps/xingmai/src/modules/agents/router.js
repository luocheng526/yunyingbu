import { Router } from "express";
import { currentUser, requireAuth } from "../profile/auth.js";
import { GREETING, phraseWithModel, runDesk } from "./desk.js";
import { defaultModelId, publicModels, resolveModel, stripSecrets } from "./models.js";
import {
  addChatTurn,
  assertChatText,
  createSession,
  getSession,
  getUploadMeta,
  getUploadsForUser,
  listSessions,
  saveUpload
} from "./store.js";
import { resolveViewer, rosterSnapshot } from "./tools.js";

export const agentsRouter = Router();

function sendError(res, err) {
  res.status(err.statusCode || 400).json({ ok: false, error: err.message || "请求失败" });
}

function actor(req) {
  return currentUser(req) || req.user || null;
}

async function parseMultipartFile(req) {
  const ctype = String(req.headers["content-type"] || "");
  const match = ctype.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundary = match && (match[1] || match[2]);
  if (!boundary) {
    throw Object.assign(new Error("无法解析上传"), { statusCode: 400 });
  }
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("latin1");
  const parts = raw.split("--" + boundary);
  for (const part of parts) {
    if (!/filename=/i.test(part)) {
      continue;
    }
    const split = part.indexOf("\r\n\r\n");
    if (split < 0) {
      continue;
    }
    const header = part.slice(0, split);
    let body = part.slice(split + 4);
    if (body.endsWith("\r\n")) {
      body = body.slice(0, -2);
    }
    const filename = (header.match(/filename="([^"]+)"/i) || [])[1] || "file";
    const mime = (header.match(/Content-Type:\s*([^\r\n]+)/i) || [])[1] || "application/octet-stream";
    return { filename, mime, content: Buffer.from(body, "latin1") };
  }
  throw Object.assign(new Error("没有文件"), { statusCode: 400 });
}

agentsRouter.get("/", async (req, res) => {
  const user = actor(req);
  res.json({
    ok: true,
    module: "甄选智能体",
    message: "主脑问答台已就绪",
    models: publicModels(),
    sessions: user ? await listSessions(user.username) : []
  });
});

agentsRouter.get("/models", (_req, res) => {
  const models = publicModels();
  res.json({ ok: true, models });
});

agentsRouter.get("/sessions", requireAuth, async (req, res) => {
  res.json({ ok: true, sessions: await listSessions(req.user.username) });
});

agentsRouter.post("/sessions", requireAuth, async (req, res) => {
  try {
    const model = resolveModel(req.body?.modelId || defaultModelId());
    const created = await createSession(req.user.username, model.id, GREETING);
    res.status(201).json({ ok: true, model: stripSecrets(model), ...created });
  } catch (err) {
    sendError(res, err);
  }
});

agentsRouter.get("/sessions/:id", requireAuth, async (req, res) => {
  try {
    const data = await getSession(req.params.id, req.user.username);
    res.json({ ok: true, ...data });
  } catch (err) {
    sendError(res, err);
  }
});

agentsRouter.post("/uploads", requireAuth, async (req, res) => {
  try {
    const ctype = String(req.headers["content-type"] || "");
    let file;
    if (ctype.includes("multipart/form-data")) {
      file = await parseMultipartFile(req);
    } else {
      const filename = req.body?.filename || req.body?.name || "file";
      const mime = req.body?.mime || req.body?.type || "application/octet-stream";
      const raw = String(req.body?.content || req.body?.data || "");
      file = { filename, mime, content: Buffer.from(raw, "base64") };
    }
    const saved = await saveUpload({
      username: req.user.username,
      filename: file.filename,
      mime: file.mime,
      content: file.content
    });
    res.status(201).json({ ok: true, file: saved });
  } catch (err) {
    sendError(res, err);
  }
});

agentsRouter.get("/uploads/:id", requireAuth, async (req, res) => {
  try {
    const file = await getUploadMeta(req.params.id, req.user.username);
    res.json({ ok: true, file });
  } catch (err) {
    sendError(res, err);
  }
});

agentsRouter.post("/chat", requireAuth, async (req, res) => {
  try {
    const text = assertChatText(req.body?.text);
    const model = resolveModel(req.body?.modelId || defaultModelId());
    const fileIds = Array.isArray(req.body?.fileIds) ? req.body.fileIds : [];
    let sessionId = req.body?.sessionId;
    if (!sessionId) {
      const created = await createSession(req.user.username, model.id, GREETING);
      sessionId = created.session.id;
    }
    await getSession(sessionId, req.user.username);
    const viewer = await resolveViewer(req.user);
    const roster = await rosterSnapshot();
    const files = await getUploadsForUser(fileIds, req.user.username);
    const opened = await getSession(sessionId, req.user.username);
    const desk = await runDesk({
      text,
      viewer,
      history: opened.messages,
      files,
      roster
    });
    const replyText = await phraseWithModel(model, desk);
    const turn = await addChatTurn({
      sessionId,
      username: req.user.username,
      modelId: model.id,
      userText: text,
      fileIds: files.map((item) => item.id),
      replyText,
      sources: desk.sources
    });
    res.status(201).json({
      ok: true,
      model: stripSecrets(model),
      sources: desk.sources,
      gaps: desk.gaps,
      ...turn
    });
  } catch (err) {
    sendError(res, err);
  }
});
