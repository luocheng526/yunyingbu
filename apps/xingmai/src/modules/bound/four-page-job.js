import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { SHOP_DAY } from "./shop-day-contract.js";

// One explicit, resumable shop/day run. Cached successes are never recollected.
export function createFourPageJob({ collector, directory }) {
  let active = false, stop = false;
  let currentRun = null;
  const dir = join(directory, SHOP_DAY.platform, SHOP_DAY.shopId, SHOP_DAY.date);
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
    const run = { id: randomUUID(), scope: SHOP_DAY, status: "running", done: 0, total: tasks.length, cached: 0, requests: 0, errors: [], startedAt: new Date().toISOString() };
    try { await save(run); } catch (error) { active = false; throw error; }
    currentRun = run;
    void (async () => {
      try {
        for (let index = 0; index < tasks.length; index++) {
          if (stop) { run.status = "stopped"; break; }
          run.current = tasks[index]; run.updatedAt = new Date().toISOString(); await save(run);
          const result = await collector.collect(run.current);
          if (result.cached) run.cached++; else run.requests += result.record?.requestCount || 0;
          if (!result.ok) { run.status = "stopped"; run.errors.push({ task: run.current, reason: result.record?.status || result.reason }); break; }
          run.done++;
          if (result.record.nextPage) tasks.splice(index + 1, 0, { ...run.current, page: result.record.nextPage });
          if (run.current.reportId === "key_graph") for (const metric of result.record.metricColumns) {
            tasks.push({ reportId: "key_shops", columnKey: metric.columnKey }, { reportId: "key_goods", columnKey: metric.columnKey });
          }
          if (["shop_cards_sku", "shop_cards_spu"].includes(run.current.reportId)) {
            const prefix = run.current.reportId === "shop_cards_sku" ? "shop_goods_" : "shop_spu_";
            for (const card of result.record.rows) {
              if (!/^[1-9]\d{0,15}$/.test(String(card.id)) || !Number.isSafeInteger(Number(card.id))) continue;
              tasks.push({ reportId: prefix + "page", cardId: String(card.id) }, { reportId: prefix + "total", cardId: String(card.id) });
            }
          }
          run.total = tasks.length; run.updatedAt = new Date().toISOString(); await save(run);
        }
        if (run.status === "running") run.status = "complete";
      } catch (error) { run.status = "stopped"; run.errors.push({ task: run.current, reason: "local_archive_error", code: error.code || error.name }); }
      finally { run.finishedAt = new Date().toISOString(); try { await save(run); } finally { active = false; } }
    })().catch(() => { active = false; });
    return { ok: true, run: { ...run } };
  }
  return { start, status, stop: () => { stop = true; return { ok: true, stopping: active }; } };
}
