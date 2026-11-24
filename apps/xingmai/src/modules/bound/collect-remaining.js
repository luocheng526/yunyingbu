/* global AbortSignal */
// Resumable local operator job. The API validates every product against the
// complete archived inventory; this CLI has no upstream cookies or credentials.
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { SHOP_DAY, DAY_REPORTS } from "./shop-day-contract.js";

export async function collectRemaining({ base, directory, fetcher = fetch }) {
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base) || !directory) throw new Error("仅支持本机已配置的店日采集服务");
  const state = await (await fetcher(base + "/api/bound/shop-day")).json();
  if (!state.ok || state.scope.shopId !== SHOP_DAY.shopId || state.scope.date !== SHOP_DAY.date || !state.inventory?.complete) throw new Error("店日商品清单未验证");
  const dir = join(directory, SHOP_DAY.platform, SHOP_DAY.shopId, SHOP_DAY.date);
  const stopPath = join(dir, "stop-remaining.json");
  const id = randomUUID();
  const save = async run => {
    await mkdir(dir, { recursive: true });
    const temp = join(dir, `collection-run.${id}.tmp`);
    await writeFile(temp, JSON.stringify(run, null, 2));
    await rename(temp, join(dir, "collection-run.json"));
  };
  if (state.run) await writeFile(join(dir, `collection-run-${state.run.id}.json`), JSON.stringify(state.run, null, 2));
  const tasks = DAY_REPORTS.filter(r => !r.product && !r.manual && r.id !== "shop_categories").map(r => ({ reportId: r.id, page: 1 }));
  const products = state.inventory.items.slice().sort((a, b) => (b.goodsId === state.selected?.goodsId ? 1 : 0) - (a.goodsId === state.selected?.goodsId ? 1 : 0));
  for (const product of products) for (const report of DAY_REPORTS.filter(r => r.product && !r.manual)) tasks.push({ reportId: report.id, goodsId: product.goodsId, page: 1 });
  const run = { id, scope: SHOP_DAY, owner: "local_cli", status: "collecting", startedAt: new Date().toISOString(), total: tasks.length, done: 0, cached: 0, requests: 0, current: null,
    deferred: [{ reportId: "shop_categories", reason: "requires_selected_category_id" }], errors: [] };
  await save(run);
  try {
    for (let index = 0; index < tasks.length; index++) {
      const stop = await readFile(stopPath, "utf8").then(JSON.parse).catch(e => { if (e.code === "ENOENT") return null; throw e; });
      if (stop?.runId === id) { run.status = "paused"; break; }
      run.current = tasks[index];
      const response = await fetcher(base + "/api/bound/shop-day/collect", { method: "POST", headers: { Origin: base, "Content-Type": "application/json" }, body: JSON.stringify(run.current), signal: AbortSignal.timeout(60000) });
      const result = await response.json();
      if (result.cached) run.cached++;
      else run.requests += result.record?.requestCount || 0;
      if (!response.ok || !result.ok) {
        run.status = "stopped";
        run.errors.push({ task: run.current, reason: result.record?.status || result.reason || "http_error" });
        break;
      }
      run.done++;
      if (result.record.nextPage) { tasks.splice(index + 1, 0, { ...run.current, page: result.record.nextPage }); run.total++; }
      run.updatedAt = new Date().toISOString();
      await save(run);
      if (run.done % 25 === 0) console.log(JSON.stringify({ done: run.done, total: run.total, requests: run.requests, current: run.current }));
    }
    if (run.status === "collecting") run.status = "complete_with_deferred";
  } catch (error) {
    run.status = "stopped";
    run.errors.push({ task: run.current, reason: ["TimeoutError", "AbortError"].includes(error.name) ? "local_request_timeout" : "local_job_error" });
  } finally { run.finishedAt = new Date().toISOString(); await save(run); }
  console.log(JSON.stringify(run));
  return run;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await collectRemaining({ base: `http://127.0.0.1:${process.env.BOUND_PROBE_PORT || "52483"}`, directory: process.env.BOUND_DAY_ARCHIVE_DIR });
}
