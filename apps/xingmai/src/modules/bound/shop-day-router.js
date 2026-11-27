import { dailyGoodsCoverage, startDailyGoods } from "./daily-goods.js";
import { createDailyReportCollector, startDailyReports } from './daily-channel.js';
import { Router } from "express";
import { join } from "node:path";
import { homedir } from "node:os";
import { createShopDayCollector } from "./shop-day.js";
import { createFourPageJob } from "./four-page-job.js";
import { requestShopDayReport, linkStatus, collectionStatus, requestVisibleShops, requestBatchShopDayReport, requestGoodsBackfillReport, requestDailyReport } from "./collect.js";
import { createArchiveImport } from "./archive-import.js";
import { createAnnotations } from "./annotations.js";
import { createSavedOverview } from "./saved-overview.js";
import { createShopBatch } from "./shop-batch.js";
import { createSavedData } from "./saved-data.js";
import { sendSavedJson } from './saved-wire.js';
import { createGoodsBackfill, GOODS_BACKFILL_CONCURRENCY } from './goods-backfill.js';

export function defaultArchiveDirectory() {
  return process.env.BOUND_DAY_ARCHIVE_DIR || (process.platform === "win32"
    ? join(process.env.LOCALAPPDATA || homedir(), "yunyingbu-bound-probe", "archive")
    : join(process.env.XDG_DATA_HOME || join(homedir(), ".local", "share"), "yunyingbu-bound", "archive"));
}

// Mounted behind the module's existing Luo Cheng administrator gate. No raw
// archive directory or upstream URL can be supplied by clients. Saved-data
// GETs accept validated selectors. Historical goods jobs require an explicit
// date range and a selection from the current BI account's verified shops.
export function createShopDayRouter({ directory = defaultArchiveDirectory(), request = requestShopDayReport, discover = requestVisibleShops, batchRequest = requestBatchShopDayReport, backfillRequest = requestGoodsBackfillReport } = {}) {
  const router = Router();
  const collector = createShopDayCollector({ directory, request });
  const job = createFourPageJob({ directory, collector });
  const readers = new Map();
  function scopedCollector(scope) {
    const key = [scope.platform, scope.shopId, scope.date].join(":");
    if (!readers.has(key)) {
      if (readers.size >= 100) readers.delete(readers.keys().next().value);
      readers.set(key, createShopDayCollector({ directory, scope, maxPages: 200, request: async () => ({ blocked: "read_only" }) }));
    }
    return readers.get(key);
  }
  const batch = createShopBatch({ directory, discover: async () => {
    const source = await discover();
    if (!source.ok) return source;
    const known = new Set((await saved.options()).shops.map(s => s.platform + ":" + s.shopId));
    const rank = s => s.platform === "JD" && s.shopId === "16501691" ? 2 : known.has(s.platform + ":" + s.shopId) ? 1 : 0;
    source.shops.sort((a, b) => rank(b) - rank(a));
    return source;
  },
    blocked: async () => collector.isBusy() || job.busy() || importer.busy() || goodsBackfill.busy(),
    makeJob: (scope, owner) => createFourPageJob({ directory, scope, concurrency: 2, collector: createShopDayCollector({ directory, scope, concurrency: 2, intervalMs: 0, retryFailures: true, maxPages: 200,
      request: (input, onRequest) => batchRequest(input, onRequest, scope, owner) }) }) });
  const goodsBackfill = createGoodsBackfill({ directory, discover,
    blocked: async () => collectionStatus().batchEnabled || collector.isBusy() || job.busy() || importer.busy() || batch.busy(),
    makeCollector: (scope, owner, freshGoods) => createShopDayCollector({ directory, scope, freshGoods, maxPages: 200, concurrency: GOODS_BACKFILL_CONCURRENCY, intervalMs: 0, retryFailures: true,
      request: (input, onRequest) => backfillRequest(input, onRequest, scope, owner) }) });
  const readScopes = async () => [...await batch.scopes(), ...await goodsBackfill.scopes()];
  const annotations = createAnnotations();
  const savedOverview = createSavedOverview({ readScopes: () => batch.scopes(), readArchived: (scope, input) => scopedCollector(scope).getRecord(input) });
  const saved = createSavedData({ collector, readRun: () => job.status(), scopedCollector, readScopes });
  // Warm only the local saved-data selector catalog; never contact BI.
  void saved.options().catch(() => {});
  const importer = createArchiveImport({ directory, blocked: async () =>
    batch.busy() || job.busy() || collector.isBusy() || goodsBackfill.busy() });
  const daily = createDailyReportCollector({ request: requestDailyReport });
  void goodsBackfill.resume().catch(() => {});
  if (process.env.NODE_ENV === 'production' && !process.env.NODE_TEST_CONTEXT && !process.env.MENGKAI_SMOKE_LIVE) {
    startDailyGoods(goodsBackfill, linkStatus);
    startDailyReports(daily, () => collectionStatus().batchEnabled || goodsBackfill.busy() || batch.busy() || importer.busy() || job.busy() || collector.isBusy());
  }
  router.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    if (collectionStatus().batchEnabled) return res.status(409).json({ ok: false, reason: "pause_legacy_batch_first" });
    if (req.method !== "GET") {
      let sameOrigin = true;
      try { if (req.headers.origin) sameOrigin = new URL(req.headers.origin).host === req.headers.host; } catch { sameOrigin = false; }
      if (!sameOrigin || req.headers["sec-fetch-site"] === "cross-site" || !req.is("application/json")) return res.status(403).json({ ok: false, reason: "same_origin_required" });
      if (req.path !== "/import" && importer.busy()) return res.status(409).json({ ok: false, reason: "archive_import_in_progress" });
    }
    if (req.method !== "GET" && batch.busy() && ["/collect", "/four-pages/start", "/import"].includes(req.path)) return res.status(409).json({ ok: false, reason: "collector_busy" });
    if (req.method !== 'GET' && goodsBackfill.busy() && ['/collect', '/four-pages/start', '/import', '/batch/start'].includes(req.path)) return res.status(409).json({ ok: false, reason: 'collector_busy' });
    next();
  });
  const route = (method, path, action) => router[method](path, async (req, res) => {
    try { const result = await action(req); await sendSavedJson(req, res, result); }
    catch { res.status(500).json({ ok: false, reason: "archive_unavailable" }); }
  });
  route("get", "/", async () => { const data = await collector.status(); delete data.directory; return { ...data, archiveMode: "single_shop", runtime: "server", fourPageRun: await job.status() }; });
  route("get", "/four-pages", () => collector.fourPageStatus());
  route("get", "/annotations", req => annotations.get(req.query));
  route('get', '/annotations/index', req => annotations.index(req.query));
  route("post", "/annotations", req => annotations.save(req.body));
  route("get", "/saved/overview", req => savedOverview(req.query));
  route("get", "/saved/options", req => saved.options(req.query.refresh === '1'));
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
  route("post", "/collect", async req => job.busy() ? { ok: false, statusCode: 409, reason: "collector_busy" } : collector.collect(req.body));
  route("get", "/batch", async () => ({ ok: true, run: await batch.status() }));
  route('get', '/goods-backfill', async () => ({ ok: true, run: await goodsBackfill.status() }));
  route('get', '/daily-reports', async () => {
    const [result, scopes] = await Promise.all([daily.status(), goodsBackfill.scopes()]);
    const goodsForDate = dailyGoodsCoverage(scopes);
    return { ...result, days: result.days.map(day => {
      const goods = goodsForDate(day.date);
      return { ...day, goods, complete: day.verified === day.required && goods.verified === goods.required };
    }) };
  });
  route('post', '/goods-backfill/plan', req => goodsBackfill.plan(req.body));
  route('post', '/goods-backfill/start', req => goodsBackfill.start(req.body));
  route('post', '/goods-backfill/stop', req => Object.keys(req.body || {}).length ? { ok: false, statusCode: 400, reason: 'invalid_scope' } : goodsBackfill.stop());
  route("post", "/batch/start", req => batch.start(req.body || {}));
  route("post", "/batch/stop", req => Object.keys(req.body || {}).length ? { ok: false, statusCode: 400, reason: "invalid_scope" } : batch.stop());
  route("get", "/run", async () => ({ ok: true, run: await job.status() }));
  route("post", "/four-pages/start", req => Object.keys(req.body || {}).length ? { ok: false, statusCode: 400, reason: "invalid_scope" } : job.start());
  route("post", "/stop", req => Object.keys(req.body || {}).length ? { ok: false, statusCode: 400, reason: "invalid_scope" } : job.stop());
  return router;
}
