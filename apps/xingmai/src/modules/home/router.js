import { Router } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getHomeErpKpis } from "./erp-kpis.js";
import { getHomeErpPaid } from "./erp-paid.js";
import { HOME_JS_STAMP } from "./asset-ver.js";
import { getHomeLocalPaid, postHomeLocalPaid, pullHanShenPaid, shanghaiYmd, shanghaiNow } from "./local-paid.js";

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

  router.get("/local-paid", async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    try {
      let data = await getHomeLocalPaid(req);
      if (!data || data.ok !== true || !Array.isArray(data.records) || !data.records.length) {
        const ymd = shanghaiYmd();
        const merged = await pullHanShenPaid(req, ymd);
        const from = [];
        if ((merged.records || []).some((row) => String(row.source || "").indexOf("han") !== -1)) {
          from.push("han");
        }
        if ((merged.records || []).some((row) => String(row.source || "").indexOf("shen") !== -1)) {
          from.push("shen");
        }
        const book = (data && data.feeTargets) || {};
        data = {
          ok: true,
          source: "han-shen-local",
          updatedAt: shanghaiNow(),
          summary: merged.summary || {},
          records: (merged.records || []).map((row) => {
            const shop = row && (row.shopName || row.shop);
            const hit = shop ? book[shop] : null;
            if (!hit) {
              return row;
            }
            return {
              ...row,
              feeLo: row.feeLo != null ? row.feeLo : hit.lo,
              feeHi: row.feeHi != null ? row.feeHi : hit.hi
            };
          }),
          yesterday: (data && data.yesterday) || { records: [] },
          hourly: Object.assign({}, (data && data.hourly) || {}, merged.hourly || {}),
          feeTargets: book,
          from
        };
      }
      return res.json(data);
    } catch (err) {
      res.status(502).json({
        ok: false,
        source: "han-shen-local",
        records: [],
        error: err.message || "韩梦凯/沈子晗实时付费汇总失败"
      });
    }
  });

  router.post("/local-paid", (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    try {
      return res.json(postHomeLocalPaid(req.body || {}));
    } catch (err) {
      return res.status(500).json({
        ok: false,
        source: "han-shen-local",
        records: [],
        error: err.message || "实时留底失败"
      });
    }
  });

  router.get("/erp-paid", async (_req, res) => {
    try {
      const data = await getHomeErpPaid();
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
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ ok: true, module: "home", stamp: HOME_JS_STAMP });
  });

  return router;
}
