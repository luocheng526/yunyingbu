import { Router } from "express";
import { join } from "node:path";
import { homedir } from "node:os";
import { createShopDayCollector } from "./shop-day.js";
import { createFourPageJob } from "./four-page-job.js";
import { requestShopDayReport, collectionStatus } from "./collect.js";
import { createArchiveImport } from "./archive-import.js";
import { createAnnotations } from "./annotations.js";
import { createSavedOverview } from "./saved-overview.js";
import { createSavedData } from "./saved-data.js";

export function defaultArchiveDirectory() {
  return process.env.BOUND_DAY_ARCHIVE_DIR || (process.platform === "win32"
    ? join(process.env.LOCALAPPDATA || homedir(), "yunyingbu-bound-probe", "archive")
    : join(process.env.XDG_DATA_HOME || join(homedir(), ".local", "share"), "yunyingbu-bound", "archive"));
}

// Mounted behind the module's existing Luo Cheng administrator gate. No raw
// archive directory or upstream URL can be supplied by clients. Saved-data
// GETs accept validated shop/date selectors; collection remains fixed-scope.
export function createShopDayRouter({ directory = defaultArchiveDirectory(), request = requestShopDayReport } = {}) {
  const router = Router();
  const collector = createShopDayCollector({ directory, request });
  const job = createFourPageJob({ directory, collector });
  const annotations = createAnnotations();
  const savedOverview = createSavedOverview();
  const saved = createSavedData({ collector, readRun: () => job.status() });
  const importer = createArchiveImport({ directory, blocked: async () =>
    (await job.status())?.status === "running" || collector.isBusy() });
  router.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    if (collectionStatus().batchEnabled) return res.status(409).json({ ok: false, reason: "pause_legacy_batch_first" });
    if (req.method !== "GET") {
      let sameOrigin = true;
      try { if (req.headers.origin) sameOrigin = new URL(req.headers.origin).host === req.headers.host; } catch { sameOrigin = false; }
      if (!sameOrigin || req.headers["sec-fetch-site"] === "cross-site" || !req.is("application/json")) return res.status(403).json({ ok: false, reason: "same_origin_required" });
      if (req.path !== "/import" && importer.busy()) return res.status(409).json({ ok: false, reason: "archive_import_in_progress" });
    }
    next();
  });
  const route = (method, path, action) => router[method](path, async (req, res) => {
    try { const result = await action(req); res.status(result.statusCode || 200).json(result); }
    catch { res.status(500).json({ ok: false, reason: "archive_unavailable" }); }
  });
  route("get", "/", async () => { const data = await collector.status(); delete data.directory; return { ...data, archiveMode: "single_shop", runtime: "server", fourPageRun: await job.status() }; });
  route("get", "/four-pages", () => collector.fourPageStatus());
  route("get", "/annotations", req => annotations.get(req.query));
  route("post", "/annotations", req => annotations.save(req.body));
  route("get", "/saved/overview", req => savedOverview(req.query));
  route("get", "/saved/options", () => saved.options());
  route("get", "/saved", req => saved.manifest(req.query));
  route("get", "/saved/report", req => saved.record(req.query));
  route("post", "/import", req => importer.accept(req.body));
  route("get", "/report", async req => {
    const input = { reportId: req.query.reportId, page: Number(req.query.page || 1) };
    for (const key of ["goodsId", "cardId", "categoryPath", "planId", "promoteKey", "columnKey"]) if (req.query[key] !== undefined) input[key] = req.query[key];
    if (req.query.trendDays !== undefined) input.trendDays = Number(req.query.trendDays);
    const record = await collector.getRecord(input);
    return { ok: !!record, record, ...(record ? {} : { statusCode: 404 }) };
  });
  route("post", "/collect", async req => (await job.status())?.status === "running" ? { ok: false, statusCode: 409, reason: "collector_busy" } : collector.collect(req.body));
  route("get", "/run", async () => ({ ok: true, run: await job.status() }));
  route("post", "/four-pages/start", req => Object.keys(req.body || {}).length ? { ok: false, statusCode: 400, reason: "invalid_scope" } : job.start());
  route("post", "/stop", req => Object.keys(req.body || {}).length ? { ok: false, statusCode: 400, reason: "invalid_scope" } : job.stop());
  return router;
}
