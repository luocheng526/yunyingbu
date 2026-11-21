import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SHOP_DAY, shopDayRequest } from "../src/modules/bound/shop-day-contract.js";
import { createShopDayCollector, inspectDayResponse } from "../src/modules/bound/shop-day.js";
import { createFourPageJob } from "../src/modules/bound/four-page-job.js";
import { createShopDayRouter } from "../src/modules/bound/shop-day-router.js";
import { boundRouter } from "../src/modules/bound/router.js";
import express from "express";
import { setTimeout as delay } from "node:timers/promises";

const table = rows => ({ columnInfo: [{ columnKey: "gmv", columnName: "支付金额" }], columnData: rows });
const success = data => ({ httpStatus: 200, payload: { code: 0, data } });
const graph = () => [table([{ cells: [{ column: "gmv", value: "23181", yoy: null, mom: "0.12" }] }]), table([{ date: "2026/10/03", cells: [{ column: "gmv", value: "23181", lastYearValue: "20000", mom: "0.12" }] }])];

test("四页试采始终限定单店，关键指标不能退回旧的错误接口", () => {
  for (const id of ["key_graph", "key_shops", "channel_shop_table"]) {
    const spec = shopDayRequest({ reportId: id, ...(id === "key_shops" ? { columnKey: "gmv" } : {}) });
    assert.deepEqual(spec.body.shopIds, [{ channel: "JD", shopId: SHOP_DAY.shopId }]);
    assert.equal(spec.body.startDate, SHOP_DAY.date);
  }
  assert.equal(shopDayRequest({ reportId: "key_shops", columnKey: "gmv" }).path, "/v2/channel/channelAnalysisShopOverview");
  assert.deepEqual(shopDayRequest({ reportId: "key_goods", columnKey: "gmv" }).body.shopList, [{ platform: "JD", shopId: SHOP_DAY.shopId }]);
  assert.equal(shopDayRequest({ reportId: "key_goods", columnKey: "gmv" }).access, "qd_gjzbfx");
  for (const id of ["shop_goods_period", "shop_spu_period"]) {
    assert.equal(shopDayRequest({ reportId: id, trendDays: 7 }).body.trendDays, undefined);
    assert.equal(shopDayRequest({ reportId: id, trendDays: 15 }).body.trendDays, 15);
  }
  for (const input of [{ reportId: "key_graph", shopId: "other" }, { reportId: "key_shops" }, { reportId: "key_goods", columnKey: "../gmv" }, { reportId: "shop_spu_period", trendDays: 30 }, { reportId: "channel_operating", trendDays: 7 }]) assert.equal(shopDayRequest(input), null);
});

test("指标卡和趋势保留来源比较值，拒绝串店、重复日期、缺失指标", () => {
  const parsed = inspectDayResponse("key_graph", success(graph()));
  assert.equal(parsed.status, "received");
  assert.equal(parsed.metricCards.gmv.mom, "0.12");
  assert.equal(parsed.metricTrend[0].cells.gmv.lastYearValue, "20000");
  for (const mutate of [g => { g[1].columnData[0].shopId = "other"; }, g => { g[1].columnData.push(g[1].columnData[0]); }, g => { g[0].columnData[0].cells = []; }, g => { g[1].columnData[0].date = "2026/10/04"; }]) {
    const data = graph(); mutate(data);
    assert.notEqual(inspectDayResponse("key_graph", success(data)).status, "received");
  }
});

test("周期档案保留缺日信息，不将缺日置零或接受其他商品日期", () => {
  const row = { goodsId: "100", shopId: SHOP_DAY.shopId, platform: "JD", trendList: { columnData: [{ date: "2026/10/03", gmv: "10" }] } };
  const parsed = inspectDayResponse("shop_goods_period", success({ ...table([row]), total: 1 }), null, { trendDays: 7 });
  assert.equal(parsed.status, "received");
  assert.equal(parsed.periodComplete, false);
  assert.equal(parsed.periods[0].missingDates.length, 6);
  row.trendList.columnData[0].goodsId = "other";
  assert.equal(inspectDayResponse("shop_goods_period", success(table([row])), null, { trendDays: 7 }).status, "scope_mismatch");
});

test("指标选择必须来自已采元数据，不同指标缓存隔离，原有批次不扩张", async () => {
  const directory = await mkdtemp(join(tmpdir(), "bound-four-"));
  try {
    let calls = 0;
    const collector = createShopDayCollector({ directory, intervalMs: 0, request: async input => {
      calls++;
      return input.reportId === "key_graph" ? success(graph()) : success(table([{ shopId: SHOP_DAY.shopId, platform: "JD", gmv: "23181" }]));
    } });
    assert.equal((await collector.collect({ reportId: "key_shops", columnKey: "gmv" })).reason, "metric_source_required");
    await collector.collect({ reportId: "key_graph" });
    assert.equal((await collector.collect({ reportId: "key_shops", columnKey: "unknown" })).reason, "metric_source_required");
    const result = await collector.collect({ reportId: "key_shops", columnKey: "gmv" });
    assert.equal(result.ok, true); assert.equal(result.record.columnKey, "gmv");
    assert.equal((await collector.collect({ reportId: "key_shops", columnKey: "gmv" })).cached, true);
    assert.equal(calls, 2);
    assert.ok(!(await collector.status()).reports.some(r => r.id === "key_graph"));
    assert.equal((await collector.fourPageStatus()).reports.find(r => r.reportId === "key_shops").status, "received");
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("服务器四页任务遇到登录冲突立即停止，重新启动复用成功项，固定店日不扩历史批次", async () => {
  const directory = await mkdtemp(join(tmpdir(), "bound-job-"));
  try {
    let conflict = true;
    const completed = new Set(), calls = [];
    const collector = { status: async () => ({ busy: false }), runStatus: async () => null, collect: async task => {
      calls.push(task);
      if (conflict && task.reportId === 'shop_goods_total') return { ok: false, record: { status: 'login_conflict', requestCount: 1 } };
      const key = JSON.stringify(task), cached = completed.has(key); completed.add(key);
      return { ok: true, cached, record: { requestCount: cached ? 0 : 1, rows: [], metricColumns: [{ columnKey: 'gmv' }] } };
    } };
    const job = createFourPageJob({ directory, collector });
    const wait = async () => { for (let i = 0; i < 100; i++) { const run = await job.status(); if (run.status !== 'running') return run; await delay(5); } throw new Error('job_timeout'); };
    assert.equal((await job.start()).ok, true);
    assert.equal((await job.start()).reason, 'collector_busy');
    const failed = await wait();
    assert.equal(failed.status, 'stopped'); assert.equal(failed.errors[0].reason, 'login_conflict', JSON.stringify(failed));
    assert.equal(calls.length, 3);
    conflict = false;
    let resumed;
    for (let i = 0; i < 100; i++) { resumed = await job.start(); if (resumed.ok) break; assert.equal(resumed.reason, 'collector_busy'); await delay(5); }
    assert.equal(resumed.ok, true);
    const done = await wait();
    assert.equal(done.status, 'complete', JSON.stringify(done)); assert.equal(done.cached, 2);
    assert.deepEqual(done.scope, SHOP_DAY);
    assert.equal(calls.some(t => t.reportId.startsWith('product_')), false);
    assert.ok(calls.some(t => t.reportId === 'key_goods' && t.columnKey === 'gmv'));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("生产档案接口仅罗成可访问，采集拒绝跨站和任意范围，读取不触发旧站", async () => {
  const directory = await mkdtemp(join(tmpdir(), "bound-route-"));
  let calls = 0;
  const app = express(); app.use(express.json());
  app.use('/restricted', (req, _res, next) => { if (req.headers['x-test-user']) req.user = { username: req.headers['x-test-user'] }; next(); }, boundRouter);
  app.use('/sample', createShopDayRouter({ directory, request: async () => { calls++; return { blocked: 'server_login_required' }; } }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(base + '/restricted/shop-day')).status, 401);
    assert.equal((await fetch(base + '/restricted/shop-day', { headers: { 'x-test-user': 'ordinary' } })).status, 403);
    assert.equal((await fetch(base + '/restricted/client.js?v=qr-still-3')).status, 401);
    const client = await fetch(base + '/restricted/client.js?v=qr-still-3', { headers: { 'x-test-user': 'luocheng' } });
    assert.equal(client.status, 200);
    assert.match(client.headers.get('cache-control'), /no-store/);
    assert.match(await client.text(), /archive-key-metric/);
    const summary = await (await fetch(base + '/sample')).json();
    assert.equal(summary.runtime, 'server'); assert.equal(summary.directory, undefined); assert.deepEqual(summary.scope, SHOP_DAY);
    const options = { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: '{}' };
    assert.equal((await fetch(base + '/sample/collect', { ...options, headers: { ...options.headers, Origin: 'https://other.example' } })).status, 403);
    assert.equal((await fetch(base + '/sample/four-pages/start', { ...options, body: JSON.stringify({ shopId: 'other' }) })).status, 400);
    assert.equal((await fetch(base + '/sample/collect', { ...options, body: JSON.stringify({ reportId: 'key_graph', date: '2026-10-04' }) })).status, 400);
    assert.equal(calls, 0);
  } finally { await new Promise(resolve => server.close(resolve)); await rm(directory, { recursive: true, force: true }); }
});
