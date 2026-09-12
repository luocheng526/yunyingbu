import { Router } from "express";
import { getHomeErpKpis } from "./erp-kpis.js";

export function homeRouter() {
  const router = Router();

  router.get("/erp-kpis", async (req, res) => {
    try {
      const data = await getHomeErpKpis(req.query || {});
      if (!data.ok) {
        return res.status(503).json(data);
      }
      return res.json(data);
    } catch (err) {
      return res.status(Number(err.statusCode) || 502).json({
        ok: false,
        error: err.message || "星脉 ERP 调用失败"
      });
    }
  });

  router.get("/summary", (_req, res) => {
    res.json({ ok: true, module: "home" });
  });

  return router;
}
