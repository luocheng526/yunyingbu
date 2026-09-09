import { Router } from "express";
import { addMessage, createThread, getThread, listCatalog, listThreads } from "./store.js";

export const agentsRouter = Router();

function sendError(res, err) {
  res.status(err.statusCode || 400).json({ ok: false, error: err.message || "请求失败" });
}

agentsRouter.get("/", async (_req, res) => {
  res.json({
    ok: true,
    module: "甄选智能体",
    message: "工作台已就绪",
    agents: listCatalog(),
    threads: await listThreads()
  });
});

agentsRouter.get("/catalog", (_req, res) => {
  res.json({ ok: true, agents: listCatalog() });
});

agentsRouter.get("/threads", async (_req, res) => {
  res.json({ ok: true, threads: await listThreads() });
});

agentsRouter.post("/threads", async (req, res) => {
  try {
    const created = await createThread(req.body?.agentId);
    res.status(201).json({ ok: true, ...created });
  } catch (err) {
    sendError(res, err);
  }
});

agentsRouter.get("/threads/:id", async (req, res) => {
  try {
    const data = await getThread(req.params.id);
    res.json({ ok: true, ...data });
  } catch (err) {
    sendError(res, err);
  }
});

agentsRouter.post("/threads/:id/messages", async (req, res) => {
  try {
    const data = await addMessage(req.params.id, req.body?.text);
    res.status(201).json({ ok: true, ...data });
  } catch (err) {
    sendError(res, err);
  }
});
