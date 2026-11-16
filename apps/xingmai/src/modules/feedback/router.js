import { Router } from "express";

export const feedbackRouter = Router();

feedbackRouter.get("/", (_req, res) => {
  res.json({ ok: true, module: "feedback" });
});
