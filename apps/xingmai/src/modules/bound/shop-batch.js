import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { SHOP_DAY, validShopDay } from "./shop-day-contract.js";

export const BATCH_DATE = SHOP_DAY.date;
const fatal = new Set(["server_login_required", "login_expired", "login_busy", "session_changed", "login_conflict", "account_disabled", "device_restricted", "identity_changed", "permission_denied", "local_archive_error"]);
const copy = value => JSON.parse(JSON.stringify(value));

// The list must come from the current account's official shop selector, never from client-supplied IDs.
export function visibleShops(data) {
  const found = new Map();
  let invalid = false;
  function visit(value, inherited, depth = 0) {
    if (!value || depth > 8) return;
    if (Array.isArray(value)) { value.forEach(v => visit(v, inherited, depth + 1)); return; }
    if (typeof value !== "object") return;
    const platform = value.platform || value.channel || value.channelCode || (Array.isArray(value.shopList) ? value.value : null) || inherited;
    const shopId = value.shopId ?? (inherited && !Array.isArray(value.shopList) ? value.value : null);
    if (shopId != null && String(shopId) !== "") {
      const scope = { platform, shopId: String(shopId), shopName: String(value.shopName || value.name || value.label || shopId), date: BATCH_DATE };
      if (!validShopDay(scope)) { invalid = true; return; }
      found.set(platform + ":" + scope.shopId, scope);
      return;
    }
    for (const key of ["data", "list", "rows", "records", "children", "shops", "shopList", "channelList"]) visit(value[key], platform, depth + 1);
  }
  visit(data);
  return invalid || !found.size || found.size > 500 ? null : [...found.values()];
}

export function createShopBatch({ directory, discover, makeJob, blocked = async () => false }) {
  const path = join(directory, "shop-batch-" + BATCH_DATE + ".json");
  let active = false, stopping = false, currentJob = null, running = null, settled = Promise.resolve();
  async function read() {
    try { return JSON.parse(await readFile(path, "utf8")); }
    catch (error) { if (error.code === "ENOENT") return null; throw error; }
  }
  async function save() {
    running.updatedAt = new Date().toISOString();
    await mkdir(directory, { recursive: true });
    const temp = path + "." + randomUUID() + ".tmp";
    await writeFile(temp, JSON.stringify(running), { mode: 0o600 });
    await rename(temp, path);
  }
  async function status() {
    const run = running ? copy(running) : await read();
    if (!run) return null;
    delete run.owner;
    if (!active && run.status === "running") run.status = "interrupted";
    if (currentJob) run.currentRun = await currentJob.status();
    return run;
  }
  async function start() {
    if (active) return { ok: false, statusCode: 409, reason: "collector_busy" };
    active = true; stopping = false;
    try {
      if (await blocked()) { active = false; return { ok: false, statusCode: 409, reason: "collector_busy" }; }
      const source = await discover();
      if (!source.ok) { active = false; return source; }
      const previous = await read();
      if (previous && previous.owner !== source.owner) { active = false; return { ok: false, statusCode: 409, reason: "identity_changed" }; }
      const old = new Map((previous?.shops || []).map(s => [s.scope.platform + ":" + s.scope.shopId, s]));
      const shops = source.shops.map(scope => {
        const prior = old.get(scope.platform + ":" + scope.shopId);
        return prior?.status === "complete" ? { ...prior, scope } : { scope, status: "queued", attempts: prior?.attempts || 0 };
      });
      running = { id: previous?.id || randomUUID(), owner: source.owner, date: BATCH_DATE, status: "running", shops,
        total: shops.length, done: shops.filter(s => s.status === "complete").length, failed: 0,
        requests: previous?.requests || 0, cached: previous?.cached || 0, startedAt: previous?.startedAt || new Date().toISOString(), resumedAt: new Date().toISOString(), current: null, reason: null };
      await save();
      settled = (async () => {
        let consecutiveFailures = 0;
        try {
          for (const shop of running.shops) {
            if (stopping) { running.status = "paused"; break; }
            if (shop.status === "complete") continue;
            shop.status = "running"; shop.attempts++; running.current = shop.scope; await save();
            currentJob = makeJob(shop.scope, source.owner);
            const started = await currentJob.start();
            const result = started.ok ? await currentJob.wait() : { status: "stopped", done: 0, total: 0, errors: [{ reason: started.reason }] };
            shop.run = result;
            running.requests += result.requests || 0; running.cached += result.cached || 0;
            shop.status = result.status === "complete" ? "complete" : stopping ? "paused" : "failed";
            shop.reason = result.errors?.at(-1)?.reason || (stopping ? "user_paused" : null);
            if (shop.status === "complete") running.done++; else if (shop.status === "failed") running.failed++;
            currentJob = null; await save();
            if (fatal.has(shop.reason)) { running.status = "blocked"; running.reason = shop.reason; break; }
            // A timeout on successive shops usually means an upstream outage. Stop instead of flooding the service.
            consecutiveFailures = ["timeout", "request_failed", "upstream_pending"].includes(shop.reason) ? consecutiveFailures + 1 : 0;
            if (consecutiveFailures >= 3) { running.status = "blocked"; running.reason = "upstream_unavailable"; break; }
          }
          if (running.status === "running") running.status = stopping ? "paused" : running.failed ? "complete_with_errors" : "complete";
        } catch (error) { running.status = "blocked"; running.reason = "local_archive_error"; running.errorCode = error.code || error.name; }
        finally { running.finishedAt = new Date().toISOString(); currentJob = null; try { await save(); } finally { active = false; } }
      })().catch(() => { active = false; });
      return { ok: true, run: await status() };
    } catch (error) { active = false; throw error; }
  }
  return { start, status, busy: () => active, wait: async () => { await settled; return status(); },
    stop: () => { stopping = true; if (currentJob) currentJob.stop(); return { ok: true, stopping: active }; },
    scopes: async () => (await status())?.shops.map(s => s.scope) || [] };
}
