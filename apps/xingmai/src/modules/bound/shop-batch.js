import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { SHOP_DAY, validShopDay } from "./shop-day-contract.js";

export const BATCH_DATE = SHOP_DAY.date;
const fatal = new Set(["server_login_required", "login_expired", "login_busy", "session_changed", "login_conflict", "account_disabled", "device_restricted", "identity_changed", "permission_denied", "local_archive_error"]);
const copy = value => JSON.parse(JSON.stringify(value));
const shopKey = scope => scope.platform + ":" + scope.shopId;

// A selection only narrows the upstream account's verified shop list. It never
// grants access to an arbitrary client-supplied shop or changes the collection date.
function resolveSelection(input, previous, shops) {
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some(key => key !== "selection")) return null;
  const selection = Object.hasOwn(input, "selection") ? input.selection : previous?.selection || null;
  if (selection === null) return { selection: null, keys: null };
  if (!selection || typeof selection !== "object" || Array.isArray(selection)
    || Object.keys(selection).some(key => !["label", "shopKeys"].includes(key))
    || typeof selection.label !== "string" || !selection.label.trim() || selection.label.length > 80
    || !Array.isArray(selection.shopKeys) || !selection.shopKeys.length || selection.shopKeys.length > 2000) return null;
  const available = new Set(shops.map(shopKey));
  if (selection.shopKeys.some(key => typeof key !== "string" || !available.has(key))) return null;
  const keys = new Set(selection.shopKeys);
  if (keys.size !== selection.shopKeys.length) return null;
  return { selection: { label: selection.label.trim(), shopKeys: [...keys] }, keys };
}

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
  return invalid || !found.size || found.size > 2000 ? null : [...found.values()];
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
    if (currentJob) {
      run.currentRun = await currentJob.status();
      run.requests += run.currentRun?.requests || 0; run.cached += run.currentRun?.cached || 0;
    }
    return run;
  }
  async function start(input = {}) {
    if (active) return { ok: false, statusCode: 409, reason: "collector_busy" };
    active = true; stopping = false;
    try {
      if (await blocked()) { active = false; return { ok: false, statusCode: 409, reason: "collector_busy" }; }
      const source = await discover();
      if (!source.ok) { active = false; return source; }
      const previous = await read();
      if (previous && previous.owner !== source.owner) { active = false; return { ok: false, statusCode: 409, reason: "identity_changed" }; }
      const picked = resolveSelection(input, previous, source.shops);
      if (!picked) { active = false; return { ok: false, statusCode: 400, reason: "invalid_scope" }; }
      const old = new Map([...(previous?.deferredShops || []), ...(previous?.shops || [])].map(s => [shopKey(s.scope), s]));
      const selected = source.shops.filter(scope => !picked.keys || picked.keys.has(shopKey(scope)));
      const selectedKeys = new Set(selected.map(shopKey));
      const deferred = new Map(old);
      source.shops.forEach(scope => { if (!deferred.has(shopKey(scope))) deferred.set(shopKey(scope), { scope, status: "queued", attempts: 0 }); });
      selectedKeys.forEach(key => deferred.delete(key));
      const shops = selected.map(scope => {
        const prior = old.get(shopKey(scope));
        return prior?.status === "complete" ? { ...prior, scope } : { scope, status: "queued", attempts: prior?.attempts || 0 };
      });
      running = { id: previous?.id || randomUUID(), owner: source.owner, date: BATCH_DATE, status: "running", shops,
        selection: picked.selection, availableTotal: source.shops.length, deferredShops: [...deferred.values()],
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
    scopes: async () => { const run = await status(); return [...(run?.shops || []), ...(run?.deferredShops || [])].map(s => s.scope); } };
}
