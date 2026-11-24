import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { validShopDay } from './shop-day-contract.js';
import { eachDay, shanghaiToday } from './time.js';

export const GOODS_REPORTS = Object.freeze(['shop_goods_page', 'shop_spu_page', 'shop_goods_total', 'shop_spu_total', 'shop_cards_sku', 'shop_cards_spu']);
export const GOODS_BACKFILL_CONCURRENCY = 4;
const good = value => value && ['received', 'empty'].includes(value.status);
const shopKey = s => s.platform + ':' + s.shopId;
const scopeKey = s => s.date + ':' + shopKey(s);
const fatal = new Set(['server_login_required', 'login_expired', 'login_busy', 'session_changed', 'login_conflict', 'account_disabled', 'device_restricted', 'identity_changed', 'permission_denied', 'local_archive_error']);
const transient = new Set(['timeout', 'request_failed', 'upstream_pending', 'collector_busy']);

export function validGoodsBackfill(input, today = shanghaiToday()) {
  if (!input || Object.keys(input).some(k => !['from', 'to', 'shopKeys'].includes(k))) return false;
  if (![input.from, input.to].every(date => validShopDay({ platform: 'JD', shopId: '1', date })) || input.from > input.to || input.to >= today || Date.parse(input.to) - Date.parse(input.from) > 365 * 86400000) return false;
  return Array.isArray(input.shopKeys) && input.shopKeys.length > 0 && input.shopKeys.length <= 2000 && new Set(input.shopKeys).size === input.shopKeys.length && input.shopKeys.every(k => /^[A-Z]{2,8}:\d{1,24}$/.test(k)) && eachDay(input.from, input.to).length * input.shopKeys.length <= 20000;
}

// Explicit goods-only historical work. Success is indexed only after every SKU
// and SPU page, total and card report has passed the existing archive validator.
export function createGoodsBackfill({ directory, discover, makeCollector, blocked = async () => false, today = shanghaiToday }) {
  const path = join(directory, 'goods-backfill-run.json'), indexPath = join(directory, 'goods-backfill-index.json');
  let active = false, stopping = false, run = null, settled = Promise.resolve(), indexPromise, writes = Promise.resolve(), savedAt = 0;
  async function read(path, fallback) { try { return JSON.parse(await readFile(path, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return fallback; throw error; } }
  async function save(path, data) {
    const text = JSON.stringify(data);
    const task = writes.then(async () => { await mkdir(directory, { recursive: true }); const temp = path + '.' + randomUUID() + '.tmp'; await writeFile(temp, text, { mode: 0o600 }); await rename(temp, path); });
    writes = task.catch(() => {}); return task;
  }
  async function index() {
    if (!indexPromise) indexPromise = read(indexPath, { scopes: [] }).then(data => new Map(data.scopes.filter(validShopDay).map(s => [scopeKey(s), s])));
    return indexPromise;
  }
  async function status() {
    const current = run || await read(path, null);
    if (!current) return null;
    const { owner, ...result } = current; void owner;
    return JSON.parse(JSON.stringify({ ...result, status: !active && current.status === 'running' ? 'interrupted' : current.status }));
  }
  async function progress(force = false) {
    run.updatedAt = new Date().toISOString();
    if (force || Date.now() - savedAt > 2000) { savedAt = Date.now(); await save(path, run); }
  }
  async function plan(input) {
    if (!validGoodsBackfill(input, today())) return { ok: false, statusCode: 400, reason: 'invalid_scope' };
    const source = await discover(); if (!source.ok) return source;
    const available = new Map(source.shops.map(s => [shopKey(s), s]));
    if (input.shopKeys.some(k => !available.has(k))) return { ok: false, statusCode: 400, reason: 'unknown_shop' };
    const shops = input.shopKeys.map(k => available.get(k)), dates = eachDay(input.from, input.to).reverse(), known = await index();
    const tasks = dates.flatMap(date => shops.map(shop => ({ ...shop, date })));
    return { ok: true, source, tasks, known, summary: { from: input.from, to: input.to, shops: shops.map(({ platform, shopId, shopName }) => ({ platform, shopId, shopName })), dates: dates.length, total: tasks.length, indexed: tasks.filter(s => known.has(scopeKey(s))).length, reports: GOODS_REPORTS } };
  }
  async function start(input) {
    if (active) return { ok: false, statusCode: 409, reason: 'collector_busy' };
    active = true;
    try {
      if (await blocked()) { active = false; return { ok: false, statusCode: 409, reason: 'collector_busy' }; }
      const prepared = await plan(input);
      if (!prepared.ok) { active = false; return prepared; }
      const previous = await read(path, null);
      if (previous && previous.owner !== prepared.source.owner) { active = false; return { ok: false, statusCode: 409, reason: 'identity_changed' }; }
      const { source, tasks, known, summary } = prepared;
      run = { id: randomUUID(), owner: source.owner, status: 'running', ...summary, done: summary.indexed, failed: 0, requests: 0, cached: 0, verifiedSku: 0, verifiedSpu: 0, current: null, errors: [], startedAt: new Date().toISOString() };
      stopping = false; await progress(true);
      settled = (async () => {
        let consecutiveFailures = 0;
        try {
          for (const scope of tasks) {
            if (stopping) { run.status = 'paused'; break; }
            if (known.has(scopeKey(scope))) continue;
            run.current = { ...scope, reports: {} }; await progress(true);
            const collector = makeCollector(scope, source.owner), failures = [], counts = {};
            let nextReport = 0;
            async function worker() {
              while (!stopping && !failures.length && nextReport < GOODS_REPORTS.length) {
                const reportId = GOODS_REPORTS[nextReport++], paged = ['shop_goods_page', 'shop_spu_page'].includes(reportId), identity = reportId === 'shop_spu_page' ? 'spuid' : 'goodsId';
                let page = 1, expected = null, count = 0; const seen = new Set();
                for (;;) {
                  if (stopping || failures.length) return;
                  const result = await collector.collect({ reportId, page });
                  if (result.cached) run.cached++; else run.requests += result.record?.requestCount || 0;
                  const record = result.record;
                  if (!result.ok || !good(record)) {
                    failures.push({ reportId, page, reason: record?.status || result.reason || 'report_unavailable',
                      httpStatus: record?.response?.httpStatus ?? null, upstreamCode: record?.response?.payload?.code ?? null });
                    break;
                  }
                  if (paged) {
                    if (expected === null) expected = record.total;
                    if (!Number.isInteger(expected) || expected < 0 || record.total !== expected) { failures.push({ reportId, page, reason: 'pagination_total_changed' }); break; }
                    for (const row of record.rows.filter(r => !r.sumLine)) {
                      const id = row[identity];
                      if (!id || seen.has(String(id)) || row.platform !== scope.platform || String(row.shopId) !== scope.shopId) { failures.push({ reportId, page, reason: 'pagination_identity_mismatch' }); break; }
                      seen.add(String(id)); count++;
                    }
                    if (failures.length) break;
                  }
                  run.current.reports[reportId] = { page, expected, saved: paged ? count : record.rows.length };
                  await progress();
                  if (!record.nextPage) {
                    if (paged && count !== expected) failures.push({ reportId, page, reason: 'pagination_incomplete' });
                    else counts[reportId] = count;
                    break;
                  }
                  if (!paged || record.nextPage !== page + 1 || page >= 200) { failures.push({ reportId, page, reason: 'pagination_incomplete' }); break; }
                  page++;
                }
              }
            }
            // A failed worker never abandons another request's archive write.
            const workers = await Promise.allSettled(Array.from({ length: GOODS_BACKFILL_CONCURRENCY }, () => worker()));
            if (workers.some(r => r.status === 'rejected')) failures.push({ reason: 'local_archive_error' });
            if (stopping) { run.status = 'paused'; await progress(true); break; }
            if (!failures.length && GOODS_REPORTS.every(id => Object.hasOwn(counts, id))) {
              const entry = { ...scope, sku: counts.shop_goods_page, spu: counts.shop_spu_page, verifiedAt: new Date().toISOString() };
              known.set(scopeKey(scope), entry); await save(indexPath, { version: 1, scopes: [...known.values()] });
              run.done++; run.verifiedSku += entry.sku; run.verifiedSpu += entry.spu; consecutiveFailures = 0;
            } else {
              run.failed++; const reason = failures.find(f => fatal.has(f.reason))?.reason || failures[0]?.reason || 'incomplete';
              run.errors.push({ scope, failures }); run.errors = run.errors.slice(-100);
              if (fatal.has(reason)) { run.status = 'blocked'; run.reason = reason; }
              consecutiveFailures = transient.has(reason) ? consecutiveFailures + 1 : 0;
              if (consecutiveFailures >= 3) { run.status = 'blocked'; run.reason = 'upstream_unavailable'; }
            }
            await progress(true);
            if (run.status === 'blocked') break;
          }
          if (run.status === 'running') run.status = run.failed ? 'complete_with_errors' : 'complete';
        } catch (error) { run.status = 'blocked'; run.reason = 'local_archive_error'; run.errorCode = error.code || error.name; }
        finally { run.finishedAt = new Date().toISOString(); try { await progress(true); } finally { active = false; } }
      })().catch(() => { active = false; });
      return { ok: true, run: await status() };
    } catch (error) { active = false; throw error; }
  }
  return { start, status, busy: () => active, wait: async () => { await settled; return status(); }, stop: () => { stopping = true; return { ok: true, stopping: active }; },
    resume: async () => { const previous = await read(path, null); return previous?.status === 'running' ? start({ from: previous.from, to: previous.to, shopKeys: previous.shops.map(shopKey) }) : { ok: true, resumed: false }; },
    plan: async input => { const result = await plan(input); return result.ok ? { ok: true, ...result.summary } : result; },
    scopes: async () => [...(await index()).values()] };
}
