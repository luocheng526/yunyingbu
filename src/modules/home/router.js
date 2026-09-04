import { Router } from "express";

export function homeRouter() {
  const router = Router();
  router.get("/summary", (_req, res) => {
    res.json({ ok: true, module: "home" });
  });
  return router;
}
