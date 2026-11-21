import express from "express";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { dbMode } from "../profile/auth.js";
import { boundRouter } from "./router.js";
import { collectionStatus, requestShopDayReport } from "./collect.js";
import { createShopDayCollector } from "./shop-day.js";
import { saveProbeRecord, runSingleProbe } from "./probe.js";
import { findProbeTarget } from "./probe-target.js";

// Standalone, loopback-only diagnostic harness. Never mounted by the production app.
// Reuses the bound module; does not replace the application's shell or authentication.
export function createLocalProbeApp({ archiveDirectory = process.env.BOUND_DAY_ARCHIVE_DIR } = {}) {
  if (dbMode() !== "memory" || collectionStatus().batchEnabled) {
    throw new Error("本地试采只允许内存存储且必须暂停批量采集");
  }
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://img11.360buyimg.com; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const host = req.headers.host || "";
    const origin = `http://${host}`;
    if (req.socket.remoteAddress !== "127.0.0.1" || !/^127\.0\.0\.1:\d+$/.test(host)
      || (req.headers.origin && req.headers.origin !== origin)
      || req.headers["sec-fetch-site"] === "cross-site") {
      return res.status(403).json({ ok: false, message: "仅允许本机试采页面访问。" });
    }
    if (req.method !== "GET" && (req.headers.origin !== origin || !req.is("application/json"))) {
      return res.status(403).json({ ok: false, message: "请从本机试采页面提交。" });
    }
    next();
  });
  app.use(express.json({ limit: "8kb" }));
  if (archiveDirectory) {
    const collector = createShopDayCollector({ directory: archiveDirectory, request: requestShopDayReport });
    app.get("/api/bound/shop-day", async (_req, res, next) => {
      try { res.json(await collector.status()); } catch (error) { next(error); }
    });
    app.get("/api/bound/shop-day/four-pages", async (_req, res, next) => {
      try { res.json(await collector.fourPageStatus()); } catch (error) { next(error); }
    });
    app.get("/api/bound/shop-day/report", async (req, res, next) => {
      try {
        const selectors = Object.fromEntries(["goodsId", "cardId", "categoryPath", "planId", "promoteKey", "columnKey"].filter(key => req.query[key] !== undefined).map(key => [key, req.query[key]]));
        if (req.query.trendDays !== undefined) selectors.trendDays = Number(req.query.trendDays);
        const record = await collector.getRecord({ reportId: req.query.reportId, page: Number(req.query.page || 1), ...selectors });
        res.status(record ? 200 : 404).json({ ok: !!record, record });
      } catch (error) { next(error); }
    });
    app.post("/api/bound/shop-day/collect", async (req, res, next) => {
      try { const result = await collector.collect(req.body); res.status(result.statusCode || 200).json(result); }
      catch (error) { next(error); }
    });
    app.post("/api/bound/shop-day/collect-all", async (req, res, next) => {
      try {
        if (Object.keys(req.body || {}).length) return res.status(400).json({ ok: false, reason: "invalid_scope" });
        res.json(await collector.startAll());
      } catch (error) { next(error); }
    });
    app.get("/api/bound/shop-day/run", async (_req, res, next) => {
      try { res.json({ ok: true, run: await collector.runStatus() }); } catch (error) { next(error); }
    });
    app.post("/api/bound/shop-day/stop", async (req, res, next) => {
      try {
        if (Object.keys(req.body || {}).length) return res.status(400).json({ ok: false, reason: "invalid_scope" });
        res.json(await collector.stopAll());
      } catch (error) { next(error); }
    });
    app.post("/api/bound/shop-day/select-product", async (req, res, next) => {
      try {
        if (Object.keys(req.body || {}).length) return res.status(400).json({ ok: false, reason: "invalid_scope" });
        const result = await collector.selectProduct(); res.status(result.statusCode || 200).json(result);
      } catch (error) { next(error); }
    });
  }
  // Explicit diagnostic only; absent from the production router and normal page polling.
  app.post("/api/bound/collect/probe/relogin-check", async (req, res, next) => {
    try {
      const result = await runSingleProbe(req.body || {}, { clearLocalSession: true });
      res.status(result.statusCode || 200).json(result);
    } catch (error) { next(error); }
  });
  const reads = new Set(["/", "/catalog", "/view", "/link", "/progress", "/collect/probe"]);
  const writes = new Set(["/link/password", "/collect/probe"]);
  app.use("/api/bound", (req, res, next) => {
    if (!(req.method === "GET" && reads.has(req.path)) && !(req.method === "POST" && writes.has(req.path))) {
      return res.status(405).json({ ok: false, message: "本地试采仅开放账号密码登录和指定店铺的单笔请求。" });
    }
    // Local operator only, after loopback/origin checks. No production identity/session is created.
    req.user = { username: "luocheng" };
    next();
  }, boundRouter);
  app.get("/shared/modules/bound.js", (_req, res) => {
    res.sendFile(fileURLToPath(new URL("../../../public/shared/modules/bound.js", import.meta.url)));
  });
  app.get("/bound-local-bootstrap.js", (_req, res) => {
    res.type("js").send('window.XmModules["/bound"].mount(document.getElementById("xm-content"));');
  });
  app.get("/", (_req, res) => res.redirect("/bound"));
  app.get("/bound", (_req, res) => {
    res.type("html").send(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>边界数据中心 · 本机单店数据</title><style>:root{--xm-bg:#f7f7f4;--xm-surface:#fff;--xm-text:#14120b;--xm-muted:#6b7280;--xm-border:#e5e7eb;--xm-primary:#1677ff}body{margin:0;background:var(--xm-bg);color:var(--xm-text);font-family:system-ui,sans-serif}.local-notice{padding:12px 20px;background:#fff;border-bottom:1px solid var(--xm-border);font-size:14px}</style></head><body><div class="local-notice"><strong>边界数据中心 · 本机单店数据</strong> 正在读取采集状态。浏览已保存数据无需登录；同一账号的采集和旧站查看需分开进行。未连接生产数据库。</div><main id="xm-content"></main><script src="/shared/modules/bound.js"></script><script src="/bound-local-bootstrap.js"></script></body></html>`);
  });
  // Express requires four parameters to recognize an error handler.
  // eslint-disable-next-line no-unused-vars
  app.use((_error, _req, res, _next) => {
    res.status(500).json({ ok: false, message: "本地试采请求未完成，请查看页面状态。" });
  });
  return app;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.env.BOUND_COLLECTION_MODE = "paused";
  process.env.BOUND_COLLECT_LOOP = "0";
  // Optional restore of a locally captured diagnostic sample; never restores credentials.
  if (process.env.BOUND_PROBE_RESTORE_PATH) {
    const restored = JSON.parse(await readFile(process.env.BOUND_PROBE_RESTORE_PATH, "utf8"));
    const records = Array.isArray(restored) ? restored : [restored];
    if (records.length > 10) throw new Error("本地核对样本过多");
    for (const record of records) {
      if (!/^[a-f0-9-]{36}$/.test(record?.id || "") || !findProbeTarget(record.target)) {
        throw new Error("本地核对样本范围不符");
      }
      await saveProbeRecord(record);
    }
  }
  const port = Number(process.env.BOUND_PROBE_PORT || 0);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("本地端口无效");
  const server = createLocalProbeApp().listen(port, "127.0.0.1", () => {
    console.log(`BOUND_LOCAL_PROBE_URL=http://127.0.0.1:${server.address().port}/bound`);
  });
}
