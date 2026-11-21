import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { visibleShops, createShopBatch } from "../src/modules/bound/shop-batch.js";
import { SHOP_DAY, shopDayRequest, validShopDay } from "../src/modules/bound/shop-day-contract.js";
import { createShopDayCollector, inspectDayResponse } from "../src/modules/bound/shop-day.js";
import { createSavedData } from "../src/modules/bound/saved-data.js";
import { createSavedOverview } from "../src/modules/bound/saved-overview.js";
import { requestVisibleShops, requestBatchShopDayReport, setBoundFetch } from "../src/modules/bound/collect.js";
import { writeState, resetBoundStore } from "../src/modules/bound/persist.js";
const second = { ...SHOP_DAY, shopId: "200", shopName: "第二店" };
const table = rows => ({ columnInfo: [{ columnKey: "gmv", columnName: "支付金额" }], columnData: rows });
const success = data => ({ httpStatus: 200, payload: { code: 0, data } });
const temp = () => mkdtemp(join(tmpdir(), "bound-shop-batch-"));

test("可见店铺只接受来源列表的明确平台和店铺身份；不接受穿越路径或九月以前", () => {
  assert.deepEqual(visibleShops([{ channel: "JD", shopList: [{ shopId: 200, shopName: "第二店" }] }]), [second]);
  assert.deepEqual(visibleShops([{ value: "JD", label: "京东", shopList: [{ value: "200", label: "第二店" }] }]), [second]);
  assert.equal(visibleShops([{ platform: "JD", shopId: "../secret" }]), null);
  assert.equal(visibleShops([{ shopId: "200" }]), null);
  assert.equal(visibleShops([{ value: "JD", shopList: Array.from({ length: 853 }, (_, i) => ({ shopId: String(i + 1), shopName: "店铺" + i })) }]).length, 853);
  assert.equal(validShopDay({ ...second, date: "2026-08-31" }), false);
  assert.equal(shopDayRequest({ reportId: "channel_operating" }, { ...second, date: "2026-02-30" }), null);
});

test("不同店铺请求、响应和缓存隔离；新档案直接进入同一页面和总览店铺表", async () => {
  const directory = await temp();
  try {
    const collectors = new Map(); let calls = 0;
    for (const scope of [SHOP_DAY, second]) {
      const collector = createShopDayCollector({ directory, scope, intervalMs: 0, request: async input => {
        calls++; const body = shopDayRequest(input, scope).body;
        assert.equal(body.shopId, scope.shopId);
        const data = table([{ ...scope, gmv: scope.shopId === second.shopId ? "222" : "111" }]);
        return success(input.reportId === "channel_operating" ? [data, data] : data);
      } });
      collectors.set(scope.shopId, collector);
      assert.equal((await collector.collect({ reportId: "channel_operating" })).ok, true);
      assert.equal((await collector.collect({ reportId: "channel_shop_table" })).ok, true);
    }
    assert.equal((await collectors.get(second.shopId).collect({ reportId: "channel_operating" })).cached, true);
    assert.equal(calls, 4);
    assert.equal(inspectDayResponse("channel_shop_table", success(table([{ ...SHOP_DAY }])), null, {}, second).status, "scope_mismatch");
    const saved = createSavedData({ collector: collectors.get(SHOP_DAY.shopId), scopedCollector: s => collectors.get(s.shopId), readScopes: async () => [second], readSheets: async () => [], readHeads: async () => [] });
    assert.ok((await saved.options()).shops.some(s => s.shopId === second.shopId));
    assert.equal((await saved.record({ ...second, reportId: "channel_operating" })).record.rows[0].gmv, "222");
    const manifest = await saved.manifest(second);
    assert.equal(manifest.scope.shopId, second.shopId);
    assert.equal(manifest.reports.find(r => r.id === "channel_operating").status, "received");
    const overview = createSavedOverview({ readSheets: async () => [], readScopes: async () => [second], readArchived: (scope, input) => collectors.get(scope.shopId).getRecord(input) });
    assert.equal((await overview({ from: second.date })).records.saved_shops.rows[0].gmv, "222");
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("全店队列串行运行，登录冲突立即暂停；重启续采跳过已完成店铺并拒绝换号", async () => {
  const directory = await temp();
  try {
    let owner = "first", conflict = true; const visited = [];
    const config = { directory, discover: async () => ({ ok: true, owner, shops: [SHOP_DAY, second] }), makeJob: scope => {
      visited.push(scope.shopId); let result;
      return { start: async () => ({ ok: true }), status: async () => result, stop() {}, wait: async () => {
        result = conflict && scope.shopId === second.shopId ? { status: "stopped", done: 0, total: 1, errors: [{ reason: "login_conflict" }], requests: 1 } : { status: "complete", done: 1, total: 1, requests: 1 };
        return result;
      } };
    } };
    let batch = createShopBatch(config);
    assert.equal((await batch.start()).ok, true);
    assert.equal((await batch.start()).reason, "collector_busy");
    let state = await batch.wait(); assert.equal(state.status, "blocked"); assert.equal(state.done, 1); assert.equal(state.owner, undefined);
    conflict = false; batch = createShopBatch(config);
    await batch.start(); state = await batch.wait();
    assert.equal(state.status, "complete"); assert.equal(state.done, 2);
    assert.deepEqual(visited, [SHOP_DAY.shopId, second.shopId, second.shopId]);
    owner = "different";
    assert.equal((await batch.start()).reason, "identity_changed");
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("暂停等待当前请求完成，保留待采店铺", async () => {
  const directory = await temp();
  try {
    let release, started; const entered = new Promise(r => { started = r; });
    const batch = createShopBatch({ directory, discover: async () => ({ ok: true, owner: "one", shops: [SHOP_DAY, second] }), makeJob: () => ({
      start: async () => { started(); return { ok: true }; }, status: async () => ({ status: "running" }), stop: () => release(),
      wait: () => new Promise(r => { release = () => r({ status: "stopped", errors: [], done: 1, total: 2 }); })
    }) });
    await batch.start(); await entered; await new Promise(r => globalThis.setImmediate(r)); batch.stop();
    const state = await batch.wait(); assert.equal(state.status, "paused"); assert.equal(state.shops[1].status, "queued");
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("按已核实店铺ID缩小队列，跨重启保留范围，已有其他店铺档案仍可见且恢复全量时不重采", async () => {
  const directory = await temp();
  const third = { ...second, shopId: "300", shopName: "同名旧店" };
  const visited = [];
  const config = { directory, discover: async () => ({ ok: true, owner: "one", shops: [SHOP_DAY, second, third] }), makeJob: scope => ({
    start: async () => { visited.push(scope.shopId); return { ok: true }; }, status: async () => null, stop() {},
    wait: async () => ({ status: "complete", done: 1, total: 1, requests: 1 })
  }) };
  try {
    let batch = createShopBatch(config);
    await batch.start(); await batch.wait();
    const selection = { label: "首页实时（新版）", shopKeys: ["JD:" + second.shopId] };
    assert.equal((await batch.start({ selection })).ok, true);
    let state = await batch.wait();
    assert.equal(state.total, 1); assert.equal(state.done, 1); assert.equal(state.deferredShops.length, 2);
    assert.equal((await batch.scopes()).length, 3);
    assert.equal(visited.length, 3);
    batch = createShopBatch(config);
    await batch.start(); state = await batch.wait();
    assert.deepEqual(state.selection, selection);
    assert.deepEqual(state.shops.map(s => s.scope.shopId), [second.shopId]);
    await batch.start({ selection: null }); state = await batch.wait();
    assert.equal(state.total, 3); assert.equal(state.done, 3); assert.equal(state.deferredShops.length, 0);
    assert.equal(visited.length, 3);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("选定店铺独立采集，未知ID、重复ID、日期和畸形范围不启动任务或改变已存队列", async () => {
  const directory = await temp(); const visited = [];
  try {
    const batch = createShopBatch({ directory, discover: async () => ({ ok: true, owner: "one", shops: [SHOP_DAY, second] }), makeJob: scope => ({
      start: async () => { visited.push(scope.shopId); return { ok: true }; }, status: async () => null, stop() {},
      wait: async () => ({ status: "complete", done: 1, total: 1, requests: 1 })
    }) });
    await batch.start({ selection: { label: "首页实时（新版）", shopKeys: ["JD:200"] } });
    const before = await batch.wait();
    assert.deepEqual(visited, ["200"]);
    for (const input of [[], { date: "2026-08-31" }, { selection: {} }, { selection: { label: "test", shopKeys: [] } },
      { selection: { label: "test", shopKeys: ["JD:999"] } }, { selection: { label: "test", shopKeys: ["JD:200", "JD:200"] } },
      { selection: { label: "test", shopKeys: ["TM:200"] } }, { selection: { label: "test", shopKeys: ["JD:../../secret"] } }]) {
      assert.equal((await batch.start(input)).reason, "invalid_scope");
      assert.deepEqual(await batch.status(), before);
    }
    assert.deepEqual(visited, ["200"]);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("大店采集支持十页以后，分页总数和商品唯一性仍受校验", async () => {
  const directory = await temp();
  try {
    const collector = createShopDayCollector({ directory, scope: second, intervalMs: 0, maxPages: 200, request: async input => success({ ...table([{ ...second, goodsId: String(input.page) }]), total: 11 }) });
    for (let page = 1; page <= 11; page++) assert.equal((await collector.collect({ reportId: "shop_goods_page", page })).ok, true);
    const last = await collector.getRecord({ reportId: "shop_goods_page", page: 11 });
    assert.equal(last.nextPage, undefined); assert.equal(last.uniqueItems, 11);
    assert.equal((await collector.inventory()).complete, true);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("传输层仅接受本次账号可见店铺，拒绝客户端伪造店铺或切换账号", async () => {
  resetBoundStore(); let calls = 0;
  try {
    await writeState("session", { provider: "PASSWORD", phase: "logged_in", cookies: { sid: "test" }, passwordIdentity: { userId: "one", companyId: "company" } });
    setBoundFetch(async () => { calls++; return new globalThis.Response(JSON.stringify({ code: 0, data: [{ channel: "JD", shopList: [{ shopId: "200", shopName: "第二店" }] }] }), { headers: { "content-type": "application/json" } }); });
    const source = await requestVisibleShops(); assert.equal(source.ok, true);
    assert.equal((await requestBatchShopDayReport({ reportId: "channel_operating" }, () => {}, SHOP_DAY, source.owner)).blocked, "invalid_scope");
    assert.equal((await requestBatchShopDayReport({ reportId: "shop_goods_page", page: 11 }, () => {}, second, source.owner)).httpStatus, 200);
    await writeState("session", { provider: "PASSWORD", phase: "logged_in", cookies: { sid: "test" }, passwordIdentity: { userId: "two", companyId: "company" } });
    assert.equal((await requestBatchShopDayReport({ reportId: "channel_operating" }, () => {}, second, source.owner)).blocked, "identity_changed");
    assert.equal(calls, 2);
  } finally { setBoundFetch(); resetBoundStore(); }
});

test("跨平台未返回的指标明确标为不可用，不伪造为零或误判整个指标表失败", () => {
  const metadata = [{ columnKey: "gmv", columnName: "支付金额" }, { columnKey: "hkcb", columnName: "获客成本" }];
  const data = [{ columnInfo: metadata, columnData: [{ cells: [{ column: "gmv", value: "0" }] }] }, { columnInfo: metadata, columnData: [{ date: second.date, cells: [{ column: "gmv", value: "0" }] }] }];
  const parsed = inspectDayResponse("key_graph", success(data), null, {}, second);
  assert.equal(parsed.status, "received");
  assert.equal(parsed.metricColumns.length, 1);
  assert.equal(parsed.unavailableMetrics[0].columnKey, "hkcb");
  assert.equal(parsed.metricCards.hkcb, undefined);
});
