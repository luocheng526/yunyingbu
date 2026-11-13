import { Router } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { attachHomeLivePrefs } from "./live-prefs.js";

const homeJsPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../public/shared/modules/home.js"
);

async function loadHomeMod(name) {
  return import(`./${name}.js`);
}

export function homeRouter() {
  const router = Router();
  attachHomeLivePrefs(router);

  router.get("/client.js", (_req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    res.type("application/javascript");
    res.sendFile(homeJsPath);
  });

  router.get("/erp-kpis", async (req, res) => {
    try {
      const mod = await loadHomeMod("erp-kpis");
      const data = await mod.getHomeErpKpis(req.query || {});
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

  router.get("/local-paid", async (_req, res) => {
    try {
      const mod = await loadHomeMod("local-paid");
      return res.json(mod.getHomeLocalPaid());
    } catch (err) {
      return res.status(Number(err.statusCode) || 502).json({
        ok: false,
        error: err.message || "本地实时付费调用失败"
      });
    }
  });

  router.get("/erp-paid", async (_req, res) => {
    try {
      const mod = await loadHomeMod("erp-paid");
      const data = await mod.getHomeErpPaid();
      if (!data.ok) {
        return res.status(503).json(data);
      }
      return res.json(data);
    } catch (err) {
      return res.status(Number(err.statusCode) || 502).json({
        ok: false,
        error: err.message || "星脉 ERP 实时付费调用失败"
      });
    }
  });

  router.get("/summary", (_req, res) => {
    res.json({ ok: true, module: "home" });
  });

  return router;
}
