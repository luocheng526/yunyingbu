import { Router } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getHomeErpKpis } from "./erp-kpis.js";

const homeJsPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../public/shared/modules/home.js"
);

export function homeRouter() {
  const router = Router();

  router.get("/client.js", (_req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    res.type("application/javascript");
    res.sendFile(homeJsPath);
  });

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
