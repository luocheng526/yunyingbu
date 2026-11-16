import { Router } from "express";

export const boundRouter = Router();

boundRouter.get("/", (_req, res) => {
  res.json({ ok: true, module: "bound", source: "crawler", erp: false });
});
