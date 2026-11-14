import { Router } from "express";

export const hrRouter = Router();

hrRouter.get("/", (_req, res) => {
  res.json({ ok: true, module: "hr" });
});
