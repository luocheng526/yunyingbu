import { Router } from "express";

export const agentsRouter = Router();

agentsRouter.get("/", (_req, res) => {
  res.json({ ok: true, module: "甄选智能体", message: "待建设" });
});
