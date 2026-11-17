import { Router } from "express";

export const academyRouter = Router();

academyRouter.get("/", (_req, res) => {
  res.json({ ok: true, module: "甄选商学院", message: "待建设" });
});
