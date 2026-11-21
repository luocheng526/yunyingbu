import { setTimeout } from "node:timers";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { SHOP_DAY, DAY_REPORTS, DAY_EXCLUSIONS, shopDayRequest, validShopDay } from "./shop-day-contract.js";
import { inspectKeyGraph, inspectPeriodRows } from "./four-page-shapes.js";

const good = new Set(["received", "empty"]);
const money = value => typeof value === "number" ? value : typeof value === "string" && /^-?[\d,]+(?:\.\d+)?$/.test(value) ? Number(value.replaceAll(",", "")) : NaN;
const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const normalizedDate = value => typeof value === "string" ? value.replaceAll("/", "-") : "";

export function inspectDayResponse(reportId, response, goodsId, selectors = {}, scope = SHOP_DAY) {
  if (response.blocked) return { status: response.blocked };
  const authBlock = { '-7': 'login_conflict', '9901': 'account_disabled', '1011': 'device_restricted' }[response.payload?.code];
  if (authBlock) return { status: authBlock };
  if (response.httpStatus !== 200 || response.payload?.code !== 0) return {
    status: response.httpStatus === 401 || response.payload?.code === -1 ? "login_expired" : "request_failed"
  };
  const report = DAY_REPORTS.find(item => item.id === reportId);
  if (!report) return { status: "invalid_scope" };
  const data = response.payload.data;
  if (report.shape === "key_graph") {
    const parsed = inspectKeyGraph(data, scope);
    return { ...parsed, ...(good.has(parsed.status) ? { dataHash: digest(parsed.rows), scopeEvidence: "fixed_shop_request_and_no_contradictory_row_identity" } : {}) };
  }
  if (report.shape === "cards") {
    if (!data || !Array.isArray(data.cardInfos) || !Number.isFinite(Number(data.total))) return { status: "schema_unverified" };
    return { status: data.hasNextPage ? "pagination_incomplete" : data.cardInfos.length ? "received" : "empty",
      rows: data.cardInfos, columns: 0, total: Number(data.total), matchedRows: data.cardInfos.length,
      returnedRows: data.cardInfos.length, dataHash: digest(data), pageVerified: false };
  }
  if (report.shape === "dated_rows" && (!Array.isArray(data) || data.some(r => !r || typeof r !== "object" || Array.isArray(r)))) return { status: "schema_unverified" };
  const tables = report.shape === "dated_rows" ? [{ columnData: data, columnInfo: [] }] : report.shape === "series" || report.shape === "tables" ? data
    : report.shape === "promotion" && Array.isArray(data) ? data.map(item => item.extensibleTableWrapper) : [data];
  if (report.shape === "promotion" && Array.isArray(data) && !data.length) return { status: "empty", rows: [], columns: 0, total: 0, matchedRows: 0, returnedRows: 0, dataHash: digest(data), pageVerified: false };
  if (!Array.isArray(tables) || !tables.length || tables.some(table => !table || !Array.isArray(table.columnData) || !Array.isArray(table.columnInfo))) {
    return { status: "schema_unverified" };
  }
  const allRows = tables.flatMap(table => table.columnData);
  // cateAnalysis labels its aggregate row's platform as “合计”. This is a display
  // marker only on that report's sum row; explicit other shop/platform IDs still fail.
  const categoryTotal = row => (["channel_category", "shop_goods_page", "shop_goods_total"].includes(reportId) || report.overview) && row.sumLine === true
    && row.platform === "合计" && (row.shopId == null || row.shopId === "");
  // Explicit contradictory identities invalidate the result, rather than silently filtering other shops.
  if (allRows.some(row => row.shopId != null && String(row.shopId) !== "" && String(row.shopId) !== scope.shopId
    || row.platform && ![scope.platform, "All", "all"].includes(row.platform) && !categoryTotal(row)
    || goodsId && row.goodsId != null && String(row.goodsId) !== "" && String(row.goodsId) !== goodsId)) {
    return { status: "scope_mismatch" };
  }
  if (tables.some(table => table.progress != null && Number(table.progress) < 100)) return { status: "upstream_pending" };
  let rows = ["tables", "promotion"].includes(report.shape) ? allRows : tables.at(-1).columnData;
  if (report.shape === "series" || report.shape === "dated_rows" || report.shape === "dated_table") {
    if (report.shape !== "series" && !rows.length) return { status: "empty", rows: [], columns: tables.at(-1).columnInfo.length, total: 0, matchedRows: 0, returnedRows: 0, dataHash: digest([]), pageVerified: false };
    rows = rows.filter(row => normalizedDate(row.date) === scope.date);
    if (rows.length !== 1) return { status: "date_unverified", returnedRows: tables.at(-1).columnData.length, matchedRows: rows.length };
  } else if (rows.some(row => row.date && normalizedDate(row.date) !== scope.date)) return { status: "date_unverified" };
  const period = report.shape === "period" ? inspectPeriodRows(rows, selectors.trendDays, scope) : {};
  if (period.status) return period;
  const total = data?.total == null ? null : Number(data.total);
  return { status: rows.length ? "received" : "empty", returnedRows: tables.at(-1).columnData.length,
    matchedRows: rows.length, columns: tables.at(-1).columnInfo.length,
    total: Number.isFinite(total) && total >= 0 ? total : null, rows, ...period,
    scopeEvidence: "fixed_shop_request_and_no_contradictory_row_identity",
    pageVerified: false, dataHash: digest(rows),
    ...(reportId === "channel_goods" ? { coverage: "returned_view_only", canRepresentShopTotal: false } : {}) };
}

export function chooseSoldProduct(record, scope = SHOP_DAY) {
  if (record?.reportId !== "channel_goods" || !good.has(record.status)) return null;
  const candidates = record.rows.filter(row => !row.sumLine && String(row.shopId) === scope.shopId
    && row.platform === scope.platform && /^[A-Za-z0-9_-]{1,80}$/.test(String(row.goodsId || "")) && money(row.gmv) > 0);
  candidates.sort((a, b) => money(b.gmv) - money(a.gmv) || String(a.goodsId).localeCompare(String(b.goodsId)));
  const row = candidates[0];
  return row ? { goodsId: String(row.goodsId), goodsName: row.goodsName || "", platform: row.platform,
    shopId: String(row.shopId), date: scope.date, gmv: row.gmv, sales: row.sales ?? null,
    evidence: { reportId: record.reportId, requestHash: record.requestHash, dataHash: record.dataHash },
    reason: "在当日商品表中选支付金额最高且店铺身份明确的一件商品" } : null;
}

// Local disk archive only. Never writes the legacy bound_sheet key lacking shop identity.
export function createShopDayCollector({ directory, request, intervalMs = 1500, scope = SHOP_DAY, retryFailures = false, maxPages = 10 }) {
  if (!validShopDay(scope)) throw new Error("invalid_scope");
  scope = Object.freeze({ ...scope });
  if (!directory || typeof request !== "function") throw new Error("单店采集配置无效");
  const dir = join(directory, scope.platform, scope.shopId, scope.date);
  let busy = false;
  let lastRequest = 0;
  async function read(name) {
    try { return JSON.parse(await readFile(join(dir, name), "utf8")); }
    catch (error) { if (error.code === "ENOENT") return null; throw error; }
  }
  async function save(name, data) {
    await mkdir(dir, { recursive: true });
    const temp = join(dir, `${name}.${randomUUID()}.tmp`);
    await writeFile(temp, JSON.stringify(data, null, 2), { mode: 0o600 });
    await rename(temp, join(dir, name));
    const saved = await read(name);
    if (digest(saved) !== digest(data)) throw new Error("单店原始数据回读不一致");
    return saved;
  }
  async function inventory() {
    const items = [];
    let expected = null;
    for (let page = 1; page <= maxPages; page++) {
      const spec = shopDayRequest({ reportId: "shop_goods_page", page }, scope, maxPages);
      const record = await read(`shop_goods_page-shop-${page}-${digest(spec).slice(0, 12)}.json`);
      if (!record || !good.has(record.status)) return { complete: false, items: [] };
      expected ??= record.total;
      if (record.total !== expected) return { complete: false, items: [] };
      items.push(...record.rows.filter(row => !row.sumLine));
      if (!record.nextPage) break;
    }
    const ids = new Set(items.map(row => String(row.goodsId)));
    if (expected !== items.length || ids.size !== expected || items.some(row => !row.goodsId || String(row.shopId) !== scope.shopId || row.platform !== scope.platform)) return { complete: false, items: [] };
    return { complete: true, items: items.map(row => ({ goodsId: String(row.goodsId), spuid: String(row.spuid || ""), goodsName: row.goodsName || "", gmv: row.gmv, sales: row.sales, categoryPath: row.catePathId || "" })) };
  }
  async function describe(input) {
    if (!input || Object.keys(input).some(key => !["reportId", "page", "goodsId", "cardId", "categoryPath", "planId", "promoteKey", "columnKey", "trendDays"].includes(key))) return null;
    const report = DAY_REPORTS.find(item => item.id === input.reportId);
    if (report?.metric) {
      const graph = await getRecord({ reportId: "key_graph" });
      if (!good.has(graph?.status) || !graph.metricColumns?.some(c => c.columnKey === input.columnKey)) return { blocked: "metric_source_required" };
    }
    if (input.categoryPath !== undefined && (report?.id !== "shop_categories" || typeof input.categoryPath !== "string" || !(await inventory()).items.some(r => r.categoryPath === input.categoryPath))) return null;
    if (input.cardId !== undefined) {
      if (typeof input.cardId !== "string" || !["shop_goods_page", "shop_goods_total", "shop_spu_page", "shop_spu_total"].includes(report?.id)) return null;
      const cards = await getRecord({ reportId: report.id.startsWith("shop_spu_") ? "shop_cards_spu" : "shop_cards_sku" });
      if (!good.has(cards?.status) || !cards.rows.some(card => String(card.id) === input.cardId)) return null;
    }
    if (input.goodsId !== undefined && (!report?.product || typeof input.goodsId !== "string")) return null;
    const selected = report?.product ? input.goodsId ? (await inventory()).items.find(row => row.goodsId === input.goodsId) : await read("selection.json") : null;
    if (input.goodsId && !selected) return null;
    if (report?.product && !selected) return { blocked: "select_product_first" };
    const task = { ...input, ...(selected ? { goodsId: selected.goodsId } : {}) };
    if (report?.manual && report.product) {
      const promotion = await getRecord({ reportId: "product_promotion", goodsId: selected.goodsId });
      if (!good.has(promotion?.status)) return { blocked: "promotion_source_required" };
      const groups = promotion.response?.payload?.data?.filter(g => g.promoteKey && g.promoteKey !== "wxd") || [];
      if (report.id === "product_promotion_trend") {
        task.promoteKeys = [...new Set(groups.map(g => g.promoteKey))].sort();
        if (!task.promoteKeys.length) return { blocked: "no_applicable_promotion_type" };
      } else if (report.id === "product_promotion_plan") {
        if (!groups.some(g => g.promoteKey === input.promoteKey && g.extensibleTableWrapper?.columnData?.some(r => !r.sumLine && String(r.planId) === input.planId))) return null;
      }
    }
    const spec = shopDayRequest(task, scope, maxPages);
    if (!spec) return null;
    const requestHash = digest(spec);
    const name = `${report.id}-${task.goodsId || "shop"}-${input.page || 1}-${requestHash.slice(0, 12)}.json`;
    return { task, spec, requestHash, name, report };
  }
  async function getRecord(input) {
    const d = await describe(input);
    return d && !d.blocked ? read(d.name) : null;
  }
  async function collect(input) {
    const d = await describe(input);
    if (!d || d.blocked) return { ok: false, statusCode: 400, reason: d?.blocked || "invalid_scope" };
    if (d.report.requiresSelection && !input.categoryPath) return { ok: false, statusCode: 400, reason: "category_selection_contract_unverified" };
    if (busy) return { ok: false, statusCode: 409, reason: "collector_busy" };
    busy = true;
    try {
      const previous = await read(d.name);
      // Repeated actions and process restarts reuse success; failures require review, not hidden retries.
      if (previous && (!retryFailures || good.has(previous.status) || !["timeout", "request_failed", "upstream_pending", "collector_busy"].includes(previous.status) || (previous.attempts || 1) >= 3)) return { ok: good.has(previous.status), cached: true, record: previous };
      if ((input.page || 1) > 1) {
        const before = await getRecord({ ...input, page: input.page - 1 });
        if (!before || before.nextPage !== input.page) return { ok: false, statusCode: 400, reason: "invalid_page" };
      }
      const wait = Math.max(0, lastRequest + intervalMs - Date.now());
      if (wait) await new Promise(resolve => setTimeout(resolve, wait));
      const record = { id: randomUUID(), reportId: input.reportId, label: d.report.label, scope,
        goodsId: d.task.goodsId || null, ...(input.cardId ? { cardId: input.cardId } : {}), ...(input.categoryPath ? { categoryPath: input.categoryPath } : {}), ...(input.planId ? { planId: input.planId, promoteKey: input.promoteKey } : {}), page: input.page || 1, request: d.spec, requestHash: d.requestHash,
        ...(input.columnKey ? { columnKey: input.columnKey } : {}), ...(input.trendDays ? { trendDays: input.trendDays } : {}),
        startedAt: new Date().toISOString(), requestCount: 0, attempts: (previous?.attempts || 0) + 1 };
      try {
        lastRequest = Date.now();
        const response = await request(d.task, () => { record.requestCount += 1; });
        // The HTTP transport does not expose cookies/headers. Only report JSON is retained.
        record.response = { httpStatus: response.httpStatus ?? response.status ?? null,
          payload: response.payload ?? null, blocked: response.blocked ?? null,
          relogin: response.relogin ?? null };
        Object.assign(record, inspectDayResponse(input.reportId, response, record.goodsId, input, scope));
        // Missing/expired authentication is a resumable gate, not a durable empty result.
        if (["server_login_required", "login_expired", "login_busy", "session_changed", "login_conflict", "account_disabled", "device_restricted"].includes(record.status)) {
          record.finishedAt = new Date().toISOString();
          // Preserve an actual failed attempt without occupying the successful
          // report's cache key. A new explicit job can resume after the user logs in.
          if (record.requestCount) await save(`auth-attempt-${record.id}.json`, record);
          return { ok: false, record, reason: record.status };
        }
        if (good.has(record.status) && d.report.paged) {
          const received = record.rows.filter(row => !row.sumLine).length;
          const prior = record.page > 1 ? await getRecord({ ...input, page: record.page - 1 }) : null;
          record.accumulatedRows = (prior?.accumulatedRows || 0) + received;
          if (prior?.dataHash === record.dataHash && received) record.status = "pagination_repeated";
          else if (record.total === null) record.status = "pagination_unverified";
          else if (prior && prior.total !== record.total) record.status = "pagination_total_changed";
          else if (record.accumulatedRows > record.total) record.status = "pagination_count_mismatch";
          else if (record.accumulatedRows < record.total) {
            if (!received || record.page >= maxPages) record.status = "pagination_incomplete";
            else record.nextPage = record.page + 1;
          }
          if ((input.reportId === "shop_goods_page" || d.report.identity) && good.has(record.status)) {
            const identities = new Set();
            const pages = [];
            for (let page = 1; page < record.page; page++) pages.push(await getRecord({ ...input, page }));
            pages.push(record);
            for (const r of pages) for (const row of r.rows.filter(row => !row.sumLine)) {
              const identity = row[d.report.identity || "goodsId"];
              const key = JSON.stringify([row.platform, String(row.shopId), String(identity)]);
              if (row.platform !== scope.platform || String(row.shopId) !== scope.shopId || !identity) record.status = "item_identity_unverified";
              else if (identities.has(key)) record.status = "pagination_duplicate_item";
              identities.add(key);
            }
            record.uniqueItems = identities.size;
            if (!good.has(record.status)) delete record.nextPage;
          }
        }
      } catch (error) {
        record.status = ["TimeoutError", "AbortError"].includes(error?.name) ? "timeout" : "request_failed";
      }
      record.finishedAt = new Date().toISOString();
      const saved = await save(d.name, record);
      return { ok: good.has(saved.status), cached: false, record: saved };
    } finally { busy = false; }
  }
  async function selectProduct() {
    if (busy) return { ok: false, statusCode: 409, reason: "collector_busy" };
    const existing = await read("selection.json");
    if (existing) return { ok: true, selected: existing, cached: true };
    const selected = chooseSoldProduct(await getRecord({ reportId: "channel_goods" }), scope);
    if (!selected) return { ok: false, statusCode: 409, reason: "no_verified_sold_product" };
    return { ok: true, selected: await save("selection.json", selected) };
  }
  async function status() {
    const reports = [];
    for (const report of DAY_REPORTS.filter(r => !r.manual)) {
      const pages = [];
      for (let page = 1; page <= (report.paged ? maxPages : 1); page++) {
        const record = await getRecord({ reportId: report.id, page });
        if (!record) break;
        pages.push({ page, status: record.status, matchedRows: record.matchedRows, returnedRows: record.returnedRows,
          columns: record.columns, total: record.total, nextPage: record.nextPage, requestCount: record.requestCount });
        if (!record.nextPage) break;
      }
      reports.push({ id: report.id, label: report.label, product: !!report.product, requiresSelection: report.requiresSelection || null,
        status: pages.length ? pages.at(-1).nextPage ? "pagination_incomplete" : pages.at(-1).status : "not_collected", pages });
    }
    return { ok: true, scope, busy, directory: dir, selected: await read("selection.json"), inventory: await inventory(), reports, exclusions: DAY_EXCLUSIONS, run: await runStatus() };
  }
  async function fourPageStatus() {
    const graph = await getRecord({ reportId: "key_graph" });
    const metrics = good.has(graph?.status) ? graph.metricColumns : [];
    const tasks = [];
    for (const report of DAY_REPORTS.filter(r => r.stage === "four_pages")) {
      const selectors = report.metric ? metrics.map(c => ({ columnKey: c.columnKey })) : report.shape === "period" ? [7, 15].map(trendDays => ({ trendDays })) : [{}];
      for (const selector of selectors) tasks.push({ reportId: report.id, ...selector });
    }
    const reports = [];
    for (const task of tasks) {
      const pages = [];
      for (let page = 1; page <= maxPages; page++) {
        const record = await getRecord({ ...task, page });
        if (!record) break;
        pages.push({ page, status: record.status, nextPage: record.nextPage, total: record.total });
        if (!record.nextPage) break;
      }
      reports.push({ ...task, pages, status: pages.length ? pages.at(-1).nextPage ? "pagination_incomplete" : pages.at(-1).status : "not_collected" });
    }
    return { ok: true, scope, metrics, reports };
  }
  let runActive = false;
  let stopRequested = false;
  async function runStatus() {
    const run = await read("collection-run.json");
    return run?.status === "running" && !runActive ? { ...run, status: "interrupted" } : run;
  }
  async function stopAll() {
    stopRequested = true;
    const run = await runStatus();
    if (run?.owner === "local_cli" && run.status === "collecting") {
      await save("stop-remaining.json", { runId: run.id });
      return { ok: true, stopping: true };
    }
    return { ok: true, stopping: runActive };
  }
  async function startAll() {
    if (runActive || busy) return { ok: false, reason: "collector_busy" };
    const existing = await runStatus();
    if (existing?.owner === "local_cli" && existing.status === "collecting" && Date.now() - Date.parse(existing.updatedAt || existing.startedAt) < 90000) return { ok: false, reason: "collector_busy" };
    const stock = await inventory();
    if (!stock.complete) return { ok: false, reason: "product_inventory_incomplete" };
    const selected = await read("selection.json");
    const products = stock.items.slice().sort((a, b) => (b.goodsId === selected?.goodsId ? 1 : 0) - (a.goodsId === selected?.goodsId ? 1 : 0));
    const tasks = DAY_REPORTS.filter(r => !r.product && !r.requiresSelection && !r.manual).map(r => ({ reportId: r.id, page: 1 }));
    for (const product of products) for (const report of DAY_REPORTS.filter(r => r.product && !r.manual)) tasks.push({ reportId: report.id, goodsId: product.goodsId, page: 1 });
    const run = { id: randomUUID(), scope, status: "running", startedAt: new Date().toISOString(), total: tasks.length, done: 0, cached: 0, requests: 0, current: null, errors: [], deferred: DAY_REPORTS.filter(r => r.requiresSelection).map(r => ({ reportId: r.id, reason: "requires_selected_category_id" })) };
    runActive = true;
    stopRequested = false;
    await save("collection-run.json", run);
    (async () => {
      try {
        for (let index = 0; index < tasks.length; index++) {
          if (stopRequested) { run.status = "paused"; break; }
          run.current = tasks[index];
          const result = await collect(run.current);
          if (result.cached) run.cached++;
          else run.requests += result.record?.requestCount || 0;
          if (!result.ok) {
            run.status = "stopped";
            run.errors.push({ task: run.current, reason: result.record?.status || result.reason });
            break;
          }
          run.done++;
          if (result.record.nextPage) { tasks.splice(index + 1, 0, { ...run.current, page: result.record.nextPage }); run.total++; }
          run.updatedAt = new Date().toISOString();
          await save("collection-run.json", run);
        }
        if (run.status === "running") run.status = run.deferred.length ? "complete_with_deferred" : "complete";
      } catch { run.status = "stopped"; run.errors.push({ reason: "local_archive_error", task: run.current }); }
      finally { run.finishedAt = new Date().toISOString(); await save("collection-run.json", run); runActive = false; }
    })();
    return { ok: true, run };
  }
  return { collect, selectProduct, status, fourPageStatus, getRecord, inventory, startAll, stopAll, runStatus, isBusy: () => busy || runActive };
}
