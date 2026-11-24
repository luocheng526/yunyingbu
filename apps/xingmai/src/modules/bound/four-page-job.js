import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { SHOP_DAY } from "./shop-day-contract.js";

// One explicit, resumable shop/day run. Cached successes are never recollected.
export function createFourPageJob({ collector, directory, scope = SHOP_DAY, concurrency = 1 }) {
  if (![1, 2].includes(concurrency)) throw new Error("invalid_concurrency");
  let active = false, stop = false;
  let currentRun = null, settled = Promise.resolve();
  const dir = join(directory, scope.platform, scope.shopId, scope.date);
  const path = join(dir, "four-page-run.json");
  async function save(run) {
    await mkdir(dir, { recursive: true });
    const temp = path + "." + randomUUID() + ".tmp";
    await writeFile(temp, JSON.stringify(run), { mode: 0o600 });
    await rename(temp, path);
  }
  async function status() {
    if (currentRun) return JSON.parse(JSON.stringify(currentRun));
    let run;
    try { run = JSON.parse(await readFile(path, "utf8")); } catch (error) { if (error.code === "ENOENT") return null; throw error; }
    return !active && run.status === "running" ? { ...run, status: "interrupted" } : run;
  }
  async function start() {
    if (active) return { ok: false, statusCode: 409, reason: "collector_busy" };
    active = true;
    try {
      const state = await collector.status(), core = await collector.runStatus();
      if (state.busy || ["running", "collecting"].includes(core?.status)) { active = false; return { ok: false, statusCode: 409, reason: "collector_busy" }; }
    } catch (error) { active = false; throw error; }
    stop = false;
    const tasks = ["channel_operating", "shop_goods_page", "shop_goods_total", "shop_spu_page", "shop_spu_total", "shop_cards_sku", "shop_cards_spu", "channel_category", "channel_labels", "channel_label_sum", "channel_area", "channel_hour", "channel_shop_table", "key_graph"].map(reportId => ({ reportId }));
    for (const reportId of ["shop_goods_period", "shop_spu_period"]) for (const trendDays of [7, 15]) tasks.push({ reportId, trendDays });
    const run = { id: randomUUID(), scope, status: "running", done: 0, total: tasks.length, cached: 0, requests: 0, errors: [], concurrency, inFlight: [], startedAt: new Date().toISOString() };
    try { await save(run); } catch (error) { active = false; throw error; }
    currentRun = run;
    settled = (async () => {
      const pending = new Map();
      const seen = new Set(tasks.map(task => JSON.stringify(task)));
      function enqueue(task) {
        const key = JSON.stringify(task);
        if (!seen.has(key)) { seen.add(key); tasks.push(task); }
      }
      function accept(task, result) {
        if (result.cached) run.cached++; else run.requests += result.record?.requestCount || 0;
        if (!result.ok) {
          run.status = "stopped";
          run.errors.push({ task, reason: result.record?.status || result.reason });
          return;
        }
        run.done++;
        // Dependants are only made runnable after their source is verified and saved.
        if (result.record.nextPage) enqueue({ ...task, page: result.record.nextPage });
        if (task.reportId === "key_graph") for (const metric of result.record.metricColumns) {
          enqueue({ reportId: "key_shops", columnKey: metric.columnKey });
          enqueue({ reportId: "key_goods", columnKey: metric.columnKey });
        }
        if (["shop_cards_sku", "shop_cards_spu"].includes(task.reportId)) {
          const prefix = task.reportId === "shop_cards_sku" ? "shop_goods_" : "shop_spu_";
          for (const card of result.record.rows) {
            if (!/^[1-9]\d{0,15}$/.test(String(card.id)) || !Number.isSafeInteger(Number(card.id))) continue;
            enqueue({ reportId: prefix + "page", cardId: String(card.id) });
            enqueue({ reportId: prefix + "total", cardId: String(card.id) });
          }
        }
        run.total = seen.size;
      }
      try {
        while (tasks.length || pending.size) {
          if (stop) run.status = "stopped";
          while (run.status === "running" && tasks.length && pending.size < concurrency) {
            const task = tasks.shift();
            const promise = Promise.resolve().then(() => collector.collect(task)).then(result => ({ task, result }), error => ({ task, error }));
            pending.set(task, promise);
          }
          if (!pending.size) break;
          run.inFlight = [...pending.keys()]; run.current = run.inFlight[0];
          run.updatedAt = new Date().toISOString(); await save(run);
          const { task, result, error } = await Promise.race(pending.values());
          pending.delete(task);
          if (error) throw error;
          accept(task, result);
          run.inFlight = [...pending.keys()]; run.current = run.inFlight[0] || task;
          run.updatedAt = new Date().toISOString(); await save(run);
        }
        if (run.status === "running") run.status = stop ? "stopped" : "complete";
      } catch (error) { run.status = "stopped"; run.errors.push({ task: run.current, reason: "local_archive_error", code: error.code || error.name }); }
      finally {
        // Stop never abandons a request that is already writing an archive.
        for (const { task, result, error } of await Promise.all(pending.values())) {
          if (error) run.errors.push({ task, reason: "local_archive_error", code: error.code || error.name });
          else accept(task, result);
        }
        run.inFlight = []; run.finishedAt = new Date().toISOString();
        try { await save(run); } finally { active = false; }
      }
    })().catch(() => { active = false; });
    return { ok: true, run: { ...run } };
  }
  return { start, status, busy: () => active, wait: async () => { await settled; return status(); }, stop: () => { stop = true; return { ok: true, stopping: active }; } };
}
