import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGoodsBackfill, validGoodsBackfill, GOODS_REPORTS, GOODS_BACKFILL_CONCURRENCY } from '../src/modules/bound/goods-backfill.js';
import { createShopDayCollector } from '../src/modules/bound/shop-day.js';
import { SHOP_DAY, shopDayRequest } from '../src/modules/bound/shop-day-contract.js';
import { createSavedData } from '../src/modules/bound/saved-data.js';
import { requestVisibleShops, requestGoodsBackfillReport, requestBatchShopDayReport, setBoundFetch } from '../src/modules/bound/collect.js';
import { writeState, resetBoundStore } from '../src/modules/bound/persist.js';
const today = () => '2026-11-23', selection = { from: '2026-10-03', to: '2026-10-04', shopKeys: ['JD:' + SHOP_DAY.shopId] };
const table = rows => ({ columnInfo: [{ columnKey: 'gmv', columnName: '支付金额' }], columnData: rows });
const success = data => ({ httpStatus: 200, payload: { code: 0, data } });
async function temporary(work) { const directory = await mkdtemp(join(tmpdir(), 'bound-goods-backfill-')); try { await work(directory); } finally { await rm(directory, { recursive: true, force: true }); } }
function fixtures(directory, beforeResponse = async () => {}) {
  const calls = []; let owner = 'one', fail = false;
  const config = { directory, today, discover: async () => ({ ok: true, owner, shops: [SHOP_DAY] }), makeCollector: scope => createShopDayCollector({ directory, scope, concurrency: GOODS_BACKFILL_CONCURRENCY, intervalMs: 0, maxPages: 200, retryFailures: true, request: async input => {
    calls.push({ scope, input });
    await beforeResponse(input);
    if (fail) return { blocked: 'login_conflict' };
    const spec = shopDayRequest(input, scope, 200);
    if (input.reportId.endsWith('_page')) {
      assert.equal(spec.body.pageNum, input.page); assert.equal(spec.body.shopList[0].shopId, scope.shopId); assert.equal(spec.body.startDate, scope.date);
      const sku = input.reportId === 'shop_goods_page', total = sku ? 101 : 2;
      const rows = Array.from({ length: Math.max(0, Math.min(100, total - (input.page - 1) * 100)) }, (_, i) => ({ ...scope, [sku ? 'goodsId' : 'spuid']: String((input.page - 1) * 100 + i + 1), gmv: 1 }));
      return success({ ...table([{ sumLine: true, gmv: total }, ...rows]), total });
    }
    if (input.reportId.startsWith('shop_cards')) return success({ total: 0, cardInfos: [], hasNextPage: false });
    return success(table([{ sumLine: true, gmv: 101 }]));
  } }) };
  return { config, calls, owner: value => { owner = value; }, fail: value => { fail = value; } };
}

test('historical goods scope is explicit, bounded, and never includes today or arbitrary shops', async () => temporary(async directory => {
  for (const input of [{}, { ...selection, shopKeys: [] }, { ...selection, from: '2026-08-31' }, { ...selection, to: '2026-11-23' }, { ...selection, from: '2026-02-30' }, { ...selection, extra: true }, { ...selection, shopKeys: ['JD:1','JD:1'] }]) assert.equal(validGoodsBackfill(input, today()), false);
  const job = createGoodsBackfill(fixtures(directory).config);
  assert.equal((await job.start({ ...selection, shopKeys: ['JD:999'] })).reason, 'unknown_shop');
  assert.equal(await job.status(), null);
  const plan = await job.plan(selection); assert.equal(plan.total, 2); assert.equal(plan.indexed, 0); assert.equal(plan.owner, undefined); assert.equal(plan.tasks, undefined);
}));

test('backfill starts newest first, preserves successful archives, verifies all pages, and serves new dates', async () => temporary(async directory => {
  const f = fixtures(directory);
  const existing = f.config.makeCollector(SHOP_DAY);
  await existing.collect({ reportId: 'shop_goods_page', page: 1 });
  const filesBefore = f.calls.length;
  const job = createGoodsBackfill(f.config);
  assert.equal((await job.start(selection)).ok, true);
  const run = await job.wait(); assert.equal(run.status, 'complete'); assert.equal(run.done, 2); assert.equal(run.failed, 0);
  assert.equal(run.verifiedSku, 202); assert.equal(run.verifiedSpu, 4); assert.equal(run.cached, 1);
  assert.equal(f.calls[filesBefore].scope.date, '2026-10-04');
  assert.equal(f.calls.filter(c => c.scope.date === SHOP_DAY.date && c.input.reportId === 'shop_goods_page' && c.input.page === 1).length, 1);
  const scopes = await job.scopes(); assert.equal(scopes.length, 2);
  const saved = createSavedData({ collector: existing, scopedCollector: s => f.config.makeCollector(s), readScopes: () => job.scopes(), readHeads: async () => [], readSheets: async () => [] });
  assert.equal((await saved.options()).latestDate, '2026-10-04');
  const record = (await saved.record({ ...SHOP_DAY, date: '2026-10-04', reportId: 'shop_goods_page' })).record;
  assert.equal(record.total, 101); assert.equal(record.nextPage, 2);
  const before = f.calls.length;
  const reloaded = createGoodsBackfill(f.config); await reloaded.start(selection);
  assert.equal((await reloaded.wait()).done, 2); assert.equal(f.calls.length, before);
  f.owner('two'); assert.equal((await reloaded.start(selection)).reason, 'identity_changed');
}));

test('login conflict halts immediately without indexing incomplete scopes; user can resume after login', async () => temporary(async directory => {
  const f = fixtures(directory); f.fail(true); const job = createGoodsBackfill(f.config);
  await job.start(selection); const state = await job.wait(); assert.equal(state.status, 'blocked'); assert.equal(state.reason, 'login_conflict');
  assert.equal((await job.scopes()).length, 0); assert.ok(f.calls.length <= GOODS_BACKFILL_CONCURRENCY);
  f.fail(false); await job.start(selection); assert.equal((await job.wait()).status, 'complete');
}));

test('duplicate/missing pages cannot become a completed scope even when a reader claims received', async () => temporary(async directory => {
  const job = createGoodsBackfill({ directory, today, discover: async () => ({ ok: true, owner: 'one', shops: [SHOP_DAY] }), makeCollector: scope => ({ collect: async ({ reportId, page }) => ({ ok: true, record: { status: 'received', scope, reportId, page, total: 3, rows: [{ ...scope, goodsId: '1', spuid: '1' }], nextPage: reportId.endsWith('_page') && page === 1 ? 2 : null } }) }) });
  await job.start(selection); const state = await job.wait(); assert.equal(state.status, 'complete_with_errors'); assert.equal(state.done, 0); assert.equal((await job.scopes()).length, 0);
  assert.equal(state.errors[0].failures[0].reason, 'pagination_identity_mismatch');
}));

test('restart resumes only a previously running job and retains its explicit shop/date selection', async () => temporary(async directory => {
  const f = fixtures(directory), path = join(directory, 'goods-backfill-run.json');
  await writeFile(path, JSON.stringify({ ...selection, status: 'running', owner: 'one', shops: [SHOP_DAY] }));
  const job = createGoodsBackfill(f.config); await job.resume(); assert.equal((await job.wait()).done, 2);
  const written = JSON.parse(await readFile(path)); written.status = 'paused'; await writeFile(path, JSON.stringify(written));
  assert.equal((await createGoodsBackfill(f.config).resume()).resumed, false);
}));

test('pause waits for in-flight writes and never indexes a half-finished shop/day', async () => temporary(async directory => {
  let release, entered;
  const started = new Promise(resolve => { entered = resolve; });
  const pending = new Promise(resolve => { release = resolve; });
  const job = createGoodsBackfill({ directory, today, discover: async () => ({ ok: true, owner: 'one', shops: [SHOP_DAY] }), makeCollector: scope => ({ collect: async ({ reportId, page }) => {
    entered(); await pending;
    return { ok: true, record: { status: 'empty', reportId, page, scope, rows: [], total: 0 } };
  } }) });
  await job.start(selection); await started; job.stop();
  assert.equal(job.busy(), true); release();
  assert.equal((await job.wait()).status, 'paused'); assert.equal((await job.scopes()).length, 0);
}));

test('historical transport keeps the old fixed-day contract closed and allows only verified goods requests', async () => {
  resetBoundStore(); let calls = 0;
  try {
    await writeState('session', { provider: 'PASSWORD', phase: 'logged_in', cookies: { sid: 'test' }, passwordIdentity: { userId: 'one', companyId: 'company' } });
    setBoundFetch(async () => { calls++; return new globalThis.Response(JSON.stringify({ code: 0, data: [{ channel: 'JD', shopList: [{ shopId: SHOP_DAY.shopId, shopName: SHOP_DAY.shopName }] }] }), { headers: { 'content-type': 'application/json' } }); });
    const source = await requestVisibleShops(), scope = { ...SHOP_DAY, date: '2026-11-18' };
    assert.equal((await requestBatchShopDayReport({ reportId: 'shop_goods_page' }, () => {}, scope, source.owner)).blocked, 'invalid_scope');
    for (const input of [{ reportId: 'channel_operating' }, { reportId: GOODS_REPORTS[0], cardId: '1' }]) assert.equal((await requestGoodsBackfillReport(input, () => {}, scope, source.owner)).blocked, 'invalid_scope');
    assert.equal((await requestGoodsBackfillReport({ reportId: 'shop_goods_page', page: 11 }, () => {}, scope, source.owner)).httpStatus, 200);
    assert.equal(calls, 2);
  } finally { setBoundFetch(); resetBoundStore(); }
});

test('four independent reports overlap while each paginated report stays ordered and fully verified', async () => temporary(async directory => {
  let active = 0, peak = 0, release;
  const firstWave = new Promise(resolve => { release = resolve; });
  const f = fixtures(directory, async () => {
    peak = Math.max(peak, ++active);
    if (active === 4) release();
    await firstWave; active--;
  });
  const job = createGoodsBackfill(f.config);
  await job.start({ ...selection, from: selection.to });
  const run = await job.wait();
  assert.equal(peak, 4); assert.equal(run.status, 'complete'); assert.equal(run.done, 1);
  assert.equal(run.verifiedSku, 101); assert.equal(run.verifiedSpu, 2);
  assert.deepEqual(f.calls.filter(c => c.input.reportId === 'shop_goods_page').map(c => c.input.page), [1, 2]);
}));

test('historical transport admits four paced requests and refuses a fifth while they are in flight', async () => {
  resetBoundStore(); let count = 0, release, entered, pendingRequests = [];
  const pending = new Promise(resolve => { release = resolve; });
  const fourEntered = new Promise(resolve => { entered = resolve; });
  try {
    await writeState('session', { provider: 'PASSWORD', phase: 'logged_in', cookies: { sid: 'test' }, passwordIdentity: { userId: 'one', companyId: 'company' } });
    setBoundFetch(async url => {
      if (String(url).includes('getAllChannelList')) return new globalThis.Response(JSON.stringify({ code: 0, data: [{ channel: 'JD', shopList: [{ shopId: SHOP_DAY.shopId, shopName: SHOP_DAY.shopName }] }] }), { headers: { 'content-type': 'application/json' } });
      if (++count === 4) entered();
      await pending;
      return new globalThis.Response(JSON.stringify({ code: 0, data: [] }), { headers: { 'content-type': 'application/json' } });
    });
    const source = await requestVisibleShops(), scope = { ...SHOP_DAY, date: '2026-11-18' };
    assert.equal(source.ok, true);
    pendingRequests = Array.from({ length: 5 }, (_, index) => requestGoodsBackfillReport({ reportId: GOODS_REPORTS[index], page: 1 }, () => {}, scope, source.owner));
    await fourEntered;
    assert.equal((await pendingRequests[4]).blocked, 'collector_busy');
    assert.equal(count, 4);
    release();
    assert.ok((await Promise.all(pendingRequests.slice(0, 4))).every(r => r.httpStatus === 200));
  } finally { release(); await Promise.allSettled(pendingRequests); setBoundFetch(); resetBoundStore(); }
});

test('failed request diagnostics retain status codes without exposing the raw response', async () => temporary(async directory => {
  const job = createGoodsBackfill({ directory, today, discover: async () => ({ ok: true, owner: 'one', shops: [SHOP_DAY] }), makeCollector: () => ({ collect: async () => ({ ok: false, record: { status: 'request_failed', response: { httpStatus: 429, payload: { code: 1005, message: 'private source details' } } } }) }) });
  await job.start({ ...selection, from: selection.to });
  const run = await job.wait();
  assert.equal(run.done, 0); assert.equal(run.failed, 1);
  assert.ok(run.errors[0].failures.every(f => f.httpStatus === 429 && f.upstreamCode === 1005));
  assert.ok(!JSON.stringify(run).includes('private source details'));
}));

test('SKU and SPU cards sharing an endpoint are collected serially without skipping either report', async () => temporary(async directory => {
  const cards = [], scope = { ...SHOP_DAY, date: selection.to };
  const f = fixtures(directory, async input => {
    if (input.reportId === 'shop_cards_sku') cards.push('sku');
    if (input.reportId === 'shop_cards_spu') {
      const sku = await f.config.makeCollector(scope).getRecord({ reportId: 'shop_cards_sku', page: 1 });
      assert.equal(sku.status, 'empty');
      cards.push('spu');
    }
  });
  const job = createGoodsBackfill(f.config);
  await job.start({ ...selection, from: selection.to });
  const run = await job.wait();
  assert.equal(run.status, 'complete'); assert.equal(run.done, 1);
  assert.deepEqual(cards, ['sku', 'spu']);
}));
