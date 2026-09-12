import { Router } from "express";

export const storesRouter = Router();

storesRouter.get("/", (_req, res) => {
  res.json({ ok: true, module: "店铺维护中心", message: "待建设" });
});
