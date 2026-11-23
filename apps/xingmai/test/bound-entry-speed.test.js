import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { brotliDecompressSync } from 'node:zlib';
import { compactSavedRecord, sendSavedJson } from '../src/modules/bound/saved-wire.js';
import { createSavedData } from '../src/modules/bound/saved-data.js';
import { createAnnotations } from '../src/modules/bound/annotations.js';
import { SHOP_DAY } from '../src/modules/bound/shop-day-contract.js';

function restore(record) {
  for (const path of record.rowAliases) {
    let parent = record;
    for (const key of path.slice(0, -1)) parent = parent[key];
    parent[path.at(-1)] = record.rows;
  }
  delete record.rowAliases;
  return record;
}

test('compact wire retains every row, null, missing field, identity and history without duplicating tables', async () => {
  const rows = Array.from({ length: 11000 }, (_, i) => ({ goodsId: String(i), shopId: String(i % 56), platform: 'JD', goodsName: '测试商品' + i, gmv: i === 0 ? null : i, ...(i % 2 ? { profit: 0 } : {}) }));
  const record = { rows, total: rows.length, response: { payload: { data: [{ columnData: JSON.parse(JSON.stringify(rows)) }, { columnData: [{ date: '2026-10-01', gmv: 100 }] }] } } };
  const before = JSON.stringify(record), compact = compactSavedRecord(record);
  assert.ok(JSON.stringify(compact).length < before.length * 0.51);
  assert.deepEqual(restore(JSON.parse(JSON.stringify(compact))), record);
  assert.equal(JSON.stringify(record), before);
  const headers = {};
  const response = { status() { return this; }, type() { return this; }, vary() { return this; }, setHeader(k, v) { headers[k] = v; }, send(body) { this.body = body; return this; } };
  await sendSavedJson({ query: { wire: 'compact' }, acceptsEncodings: () => 'br' }, response, { ok: true, records: { shop_goods_page: [record] } });
  assert.equal(headers['Content-Encoding'], 'br');
  assert.ok(Buffer.isBuffer(response.body));
  const decoded = JSON.parse(brotliDecompressSync(response.body));
  assert.deepEqual(restore(decoded.records.shop_goods_page[0]), record);
});

test('selected report bundle reads each archive page once and never scans unrelated inventory', async () => {
  const calls = [];
  const saved = createSavedData({ readHeads: async () => [], readSheets: async () => [], collector: {
    status: async () => { throw Error('full inventory must not run'); },
    getRecord: async input => { calls.push(input); return { ...input, scope: SHOP_DAY, status: 'received', rows: [{ goodsId: String(input.page) }], total: 2, pageSize: 1, nextPage: input.page === 1 ? 2 : null }; }
  } });
  const result = await saved.manifest({ ...SHOP_DAY, include: 'records', reports: 'shop_goods_page' });
  assert.equal(result.ok, true);
  assert.deepEqual(calls.map(r => [r.reportId, r.page]), [['shop_goods_page', 1], ['shop_goods_page', 2]]);
  assert.deepEqual(result.records.shop_goods_page.map(r => r.rows[0].goodsId), ['1', '2']);
});

test('selector requests coalesce and unchanged catalog refresh does not reread historical payloads', async () => {
  let scans = 0, heads = 0;
  const saved = createSavedData({ collector: {}, readScopes: async () => [{ ...SHOP_DAY, date: '2026-11-20' }],
    readHeads: async filter => { heads++; assert.equal(filter.daily, true); return [{ reportId: 'qdfx_dplb', startOn: '2026-11-18', endOn: '2026-11-18', status: 'done', updatedAt: 'v1' }]; },
    readSheets: async () => { scans++; return []; }
  });
  const [a, b] = await Promise.all([saved.options(), saved.options()]);
  assert.equal(a, b); assert.equal(scans, 1); assert.equal(heads, 1);
  assert.equal(a.latestDate, '2026-11-20');
  await saved.options(true); assert.equal(scans, 1); assert.equal(heads, 2);
});

test('one sparse annotation read retains off-page tags and only the selected date target', async () => {
  let reads = 0;
  const key = 'JD:123:goods:99999', other = 'TM:456:shop:456';
  const api = createAnnotations({ list: async (from, to) => { reads++; assert.equal(from, '2026-10-01'); assert.equal(to, '2026-10-31'); return [
    { rowKey: 'bound:v1:' + key, tag: '后页标签', follow: '跟进' },
    { rowKey: 'bound:v1:' + key + ':target:2026-10-01:2026-10-31', target: '{"metric":"gmv","value":100}' },
    { rowKey: 'bound:v1:' + key + ':target:2026-09-01:2026-09-30', target: '{"metric":"gmv","value":999}' },
    { rowKey: 'bound:v1:' + other, tag: '跨平台' }, { rowKey: 'unrelated', tag: 'ignore' }
  ]; } });
  const result = await api.index({ from: '2026-10-01', to: '2026-10-31' });
  assert.equal(reads, 1); assert.equal(Object.keys(result.marks).length, 2);
  assert.deepEqual(result.marks[key], { tag: '后页标签', follow: '跟进', target: { metric: 'gmv', value: 100 } });
  assert.equal((await api.index({ from: '2026-02-30' })).statusCode, 400);
});
