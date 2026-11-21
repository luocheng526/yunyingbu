/* global Response, URLSearchParams */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { SHOP_DAY, DAY_REPORTS, shopDayRequest } from "../src/modules/bound/shop-day-contract.js";
import { createShopDayCollector, inspectDayResponse, chooseSoldProduct } from "../src/modules/bound/shop-day.js";
import { createLocalProbeApp } from "../src/modules/bound/local-probe.js";
import { resetBoundStore, setBoundFetch } from "../src/modules/bound/store.js";
import { requestShopDayReport, loginWithPassword } from "../src/modules/bound/collect.js";
import { auditDayArchive, inspectPromotionGroup } from "../src/modules/bound/audit-day-archive.js";

const table = (rows, extra = {}) => ({ columnInfo: [{ columnKey: "gmv", columnName: "支付金额(支付)" }], columnData: rows, ...extra });
const success = data => ({ httpStatus: 200, payload: { code: 0, data } });
const sold = { platform: SHOP_DAY.platform, shopId: SHOP_DAY.shopId, goodsId: "item-1", goodsName: "测试商品", gmv: "123.45", sales: 2 };

test("推广核对排除合计行，保留数值序列化尾差，不能吞掉一分钱或未知值", () => {
  const group = { sumCost: 202.23999999999998, extensibleTableWrapper: table([{ cost: '202.24', sumLine: true }, { cost: '202.20' }, { cost: '0.04' }]) };
  assert.deepEqual(inspectPromotionGroup(group), { planSum: '202.24', sourceTotal: 202.23999999999998, delta: '0.00000000000002', status: 'source_number_rounding' });
  assert.equal(inspectPromotionGroup({ ...group, sumCost: 202.25 }).status, 'mismatch');
  assert.equal(inspectPromotionGroup({ ...group, sumCost: '202.23999999999998' }).status, 'mismatch');
  assert.equal(inspectPromotionGroup({ sumCost: 0, extensibleTableWrapper: table([{ cost: '--' }]) }).status, 'mismatch');
});

test("分类卡 ID 必须来自同维度已采卡片，分页和全部合计与未筛选缓存隔离", () => temporary(async directory => {
  const calls = [];
  const collector = createShopDayCollector({ directory, intervalMs: 0, request: async input => {
    calls.push(input);
    if (input.reportId === 'shop_cards_sku') return success({ total: 3, cardInfos: [{ id: 519726, count: '2' }], hasNextPage: false });
    if (input.reportId === 'shop_goods_total') return success(table([{ sumLine: true, gmv: '123' }]));
    if (input.cardId) return success({ ...table([{ ...sold, goodsId: 'card-' + (input.page || 1) }]), total: 2 });
    return success({ ...table([{ ...sold, goodsId: 'unfiltered' }]), total: 1 });
  } });
  assert.equal((await collector.collect({ reportId: 'shop_goods_page', cardId: '519726' })).reason, 'invalid_scope');
  await collector.collect({ reportId: 'shop_cards_sku' });
  for (const input of [
    { reportId: 'shop_goods_page', cardId: '99999' },
    { reportId: 'shop_spu_page', cardId: '519726' },
    { reportId: 'channel_operating', cardId: '519726' },
    { reportId: 'shop_goods_page', cardId: 519726 },
    { reportId: 'shop_goods_page', cardId: '../519726' }
  ]) assert.equal((await collector.collect(input)).reason, 'invalid_scope');
  const unfiltered = await collector.collect({ reportId: 'shop_goods_page' });
  const first = await collector.collect({ reportId: 'shop_goods_page', cardId: '519726' });
  assert.equal(first.record.nextPage, 2);
  assert.notEqual(first.record.requestHash, unfiltered.record.requestHash);
  assert.equal(first.record.request.body.cardId, 519726);
  const second = await collector.collect({ reportId: 'shop_goods_page', cardId: '519726', page: 2 });
  assert.equal(second.ok, true);
  assert.equal(second.record.uniqueItems, 2);
  assert.equal(second.record.accumulatedRows, 2);
  assert.equal(second.record.nextPage, undefined);
  assert.equal((await collector.collect({ reportId: 'shop_goods_page', cardId: '519726', page: 2 })).cached, true);
  const total = await collector.collect({ reportId: 'shop_goods_total', cardId: '519726' });
  assert.equal(total.record.cardId, '519726');
  assert.equal((await collector.getRecord({ reportId: 'shop_goods_page' })).rows[0].goodsId, 'unfiltered');
  assert.equal(calls.length, 5);
}));

test("待核验品类请求不发往旧站，CLI 运行期间不允许启动第二个批次，停止按批次 ID 生效", () => temporary(async directory => {
  let requests = 0;
  const collector = createShopDayCollector({ directory, intervalMs: 0, request: async () => { requests++; return success(table([])); } });
  assert.equal((await collector.collect({ reportId: 'shop_categories' })).reason, 'category_selection_contract_unverified');
  assert.equal(requests, 0);
  const dir = join(directory, SHOP_DAY.platform, SHOP_DAY.shopId, SHOP_DAY.date);
  await mkdir(dir, { recursive: true });
  const run = { id: 'active-cli', owner: 'local_cli', status: 'collecting', updatedAt: new Date().toISOString() };
  await writeFile(join(dir, 'collection-run.json'), JSON.stringify(run));
  assert.equal((await collector.startAll()).reason, 'collector_busy');
  assert.deepEqual(await collector.stopAll(), { ok: true, stopping: true });
  assert.deepEqual(JSON.parse(await readFile(join(dir, 'stop-remaining.json'), 'utf8')), { runId: 'active-cli' });
  assert.deepEqual(await collector.runStatus(), run);
}));

test("离线覆盖审计区分缺采、空表和已采结果，并拒绝被修改的档案", () => temporary(async directory => {
  const collector = createShopDayCollector({ directory, intervalMs: 0, request: async input => {
    const report = DAY_REPORTS.find(r => r.id === input.reportId);
    if (report.shape === 'cards') return success({ total: 1, cardInfos: [], hasNextPage: false });
    if (report.shape === 'promotion') return success([]);
    if (report.shape === 'series') return success([table([{ ...sold, date: '2026/10/03' }])]);
    if (report.shape === 'tables') return success([table([{ hour: '00' }]), table([{ hour: '00' }])]);
    if (input.reportId === 'shop_goods_page') return success({ ...table([sold]), total: 1 });
    if (input.reportId === 'shop_spu_page') return success({ ...table([{ ...sold, spuid: 'spu-1' }]), total: 1 });
    return success({ ...table([]), total: 0 });
  } });
  await collector.collect({ reportId: 'shop_goods_page' });
  assert.equal((await auditDayArchive(directory)).coreReportsArchived, false);
  for (const report of DAY_REPORTS.filter(r => !r.product && !r.requiresSelection)) await collector.collect({ reportId: report.id });
  for (const report of DAY_REPORTS.filter(r => r.product && !r.manual)) await collector.collect({ reportId: report.id, goodsId: sold.goodsId });
  const complete = await auditDayArchive(directory);
  assert.equal(complete.coreReportsArchived, true);
  assert.equal(complete.completeProducts, 1);
  assert.equal(complete.coverageByReport.find(r => r.id === 'product_area').empty, 1);
  assert.equal(complete.uiParityVerified, false);
  const record = await collector.getRecord({ reportId: 'product_overview', goodsId: sold.goodsId });
  record.rows[0].gmv = '999';
  const file = join(directory, SHOP_DAY.platform, SHOP_DAY.shopId, SHOP_DAY.date, `product_overview-${sold.goodsId}-1-${record.requestHash.slice(0, 12)}.json`);
  await writeFile(file, JSON.stringify(record));
  const invalid = await auditDayArchive(directory);
  assert.equal(invalid.coreReportsArchived, false);
  assert.equal(invalid.products[0].reports.find(r => r.id === 'product_overview').status, 'invalid_archive');
}));

test("补充试采的品类、推广类型和计划必须来自本店已采结果，不能注入其他选择器", () => temporary(async directory => {
  const calls = [];
  const collector = createShopDayCollector({ directory, intervalMs: 0, request: async input => {
    calls.push(input);
    if (input.reportId === 'shop_goods_page') return success({ ...table([{ ...sold, catePathId: '737>31479>31486' }]), total: 1 });
    if (input.reportId === 'product_promotion') return success([
      { promoteKey: 'wxd', extensibleTableWrapper: table([{ name: '无效单', invalidCost: '0' }]) },
      { promoteKey: 'JD_KUAICHE', extensibleTableWrapper: table([{ planId: '123', cost: '12' }]) }
    ]);
    if (input.reportId === 'product_promotion_plan') return success([{ date: '2026/10/02', cost: '999' }, { date: '2026/10/03', cost: '12' }]);
    return success({ ...table([{ date: '2026/10/03', cost: '12' }]), total: 1 });
  } });
  await collector.collect({ reportId: 'shop_goods_page' });
  const trendTask = { reportId: 'product_promotion_trend', goodsId: sold.goodsId };
  assert.equal((await collector.collect(trendTask)).reason, 'promotion_source_required');
  await collector.collect({ reportId: 'product_promotion', goodsId: sold.goodsId });
  for (const input of [
    { ...trendTask, promoteKeys: ['OTHER_SHOP'] },
    { reportId: 'product_promotion_plan', goodsId: sold.goodsId, promoteKey: 'JD_KUAICHE', planId: '999' },
    { reportId: 'product_promotion_plan', goodsId: sold.goodsId, promoteKey: 'OTHER', planId: '123' },
    { reportId: 'shop_categories', categoryPath: '999>888' },
    { reportId: 'channel_operating', categoryPath: '737>31479>31486' }
  ]) assert.equal((await collector.collect(input)).reason, 'invalid_scope');
  const trend = await collector.collect(trendTask);
  assert.equal(trend.ok, true);
  assert.deepEqual(trend.record.request.body.promoteKeyList, ['JD_KUAICHE']);
  assert.equal(trend.record.request.path, '/goodsOperation/promoteViewQsCard');
  const plan = await collector.collect({ reportId: 'product_promotion_plan', goodsId: sold.goodsId, promoteKey: 'JD_KUAICHE', planId: '123' });
  assert.equal(plan.ok, true);
  assert.equal(plan.record.request.body.planId, '123');
  assert.deepEqual(plan.record.rows, [{ date: '2026/10/03', cost: '12' }]);
  const category = await collector.collect({ reportId: 'shop_categories', categoryPath: '737>31479>31486' });
  assert.equal(category.ok, true);
  assert.deepEqual(category.record.request.body.filterCondition, [{ name: 'lmidsList', value: JSON.stringify([{ qd: 'JD', list: ['737>31479>31486'] }]) }]);
  assert.equal(calls.length, 5);
}));

test("登录冲突只保留失败证据，不占用成功档案位置，用户重新登录后可显式续采", () => temporary(async directory => {
  let requests = 0;
  const collector = createShopDayCollector({ directory, intervalMs: 0, request: async (_input, onRequest) => {
    onRequest();
    return ++requests === 1 ? { httpStatus: 200, payload: { code: -7 } } : success([table([{ date: '2026/10/03', gmv: '1' }])]);
  } });
  const conflict = await collector.collect({ reportId: 'channel_operating' });
  assert.equal(conflict.record.status, 'login_conflict');
  assert.equal(requests, 1);
  assert.equal(await collector.getRecord({ reportId: 'channel_operating' }), null);
  const evidence = JSON.parse(await readFile(join(directory, SHOP_DAY.platform, SHOP_DAY.shopId, SHOP_DAY.date, `auth-attempt-${conflict.record.id}.json`), 'utf8'));
  assert.equal(evidence.status, 'login_conflict');
  assert.equal((await collector.collect({ reportId: 'channel_operating' })).ok, true);
  assert.equal(requests, 2);
  assert.equal(inspectDayResponse('channel_operating', { httpStatus: 200, payload: { code: 9901 } }).status, 'account_disabled');
  assert.equal(inspectDayResponse('channel_operating', { httpStatus: 200, payload: { code: 1011 } }).status, 'device_restricted');
}));
async function temporary(fn) {
  const directory = await mkdtemp(join(tmpdir(), "bound-shop-day-"));
  try { await fn(directory); }
  finally { assert.equal(dirname(directory), tmpdir()); await rm(directory, { recursive: true, force: true }); }
}

test("单店单日契约拒绝任意地址、日期、店铺和不适用商品请求", () => {
  for (const report of DAY_REPORTS.filter(r => !r.manual)) {
    const spec = shopDayRequest({ reportId: report.id, ...(report.product ? { goodsId: "item-1" } : {}) });
    assert.equal(spec.body.startDate, "2026-10-03");
    assert.equal(spec.body.endDate, "2026-10-03");
    assert.equal(spec.body.shopId || spec.body.shopIds?.[0].shopId || spec.body.shopList?.[0].shopId || spec.body.shopIdList?.[0].shopId, SHOP_DAY.shopId);
    assert.doesNotMatch(spec.path, /export|download|save|update|delete|\/overallSku$|overallChannel/i);
  }
  // The current page imports Jt -> cateAnalysis; SPQJ_SKU uses overallGoodsSku.
  // The legacy catalog confuses the single-product SKU and cross-channel SKU endpoints.
  assert.equal(shopDayRequest({ reportId: "channel_category" }).path, "/v2/channel/cateAnalysis");
  assert.equal(shopDayRequest({ reportId: "product_skus", goodsId: "item-1" }).path, "/v2/goods/overallGoodsSku");
  for (const input of [
    { reportId: "channel_operating", shopId: "other" }, { reportId: "channel_operating", date: "2026-09-01" },
    { reportId: "channel_operating", path: "/auth/logout" }, { reportId: "channel_goods", page: 2 },
    { reportId: "product_overview" }, { reportId: "channel_operating", goodsId: "item-1" },
    { reportId: "channel_labels", page: 11 }, { reportId: "product_overview", goodsId: "../anything" }
  ]) assert.equal(shopDayRequest(input), null);
});

test("日期精确匹配，保留原始多日响应；矛盾的店铺和商品身份不能通过", () => {
  const response = success([table([{}]), table([{ date: "2026/10/02", gmv: 99 }, { date: "2026/10/03", gmv: 123 }])]);
  const result = inspectDayResponse("channel_operating", response);
  assert.equal(result.status, "received");
  assert.equal(result.returnedRows, 2);
  assert.deepEqual(result.rows, [{ date: "2026/10/03", gmv: 123 }]);
  assert.equal(response.payload.data[1].columnData.length, 2);
  assert.equal(inspectDayResponse("channel_goods", success(table([{ ...sold, shopId: "other" }]))).status, "scope_mismatch");
  assert.equal(inspectDayResponse("product_skus", success(table([{ ...sold, goodsId: "other" }])), "item-1").status, "scope_mismatch");
  assert.equal(inspectDayResponse("channel_operating", success([table([]), table([])])).status, "date_unverified");
  assert.equal(inspectDayResponse("channel_goods", success({})).status, "schema_unverified");
  assert.equal(inspectDayResponse("channel_goods", success(table([]))).status, "empty");
});

test("选择有销售且身份明确的一件商品，不能选择汇总或其他店铺", () => {
  const record = { reportId: "channel_goods", status: "received", rows: [
    { ...sold, sumLine: true, gmv: 99999 }, { ...sold, shopId: "other", gmv: 99999 },
    { ...sold, goodsId: "zero", gmv: 0 }, { ...sold, shopId: null, gmv: 99999 }, sold
  ] };
  assert.equal(chooseSoldProduct(record).goodsId, "item-1");
  assert.equal(chooseSoldProduct({ ...record, status: "scope_mismatch" }), null);
});

test("品类合计行的平台展示文字可识别，其他店铺或渠道仍被拒绝", () => {
  const summary = { platform: "合计", sumLine: true, gmv: "123" };
  const detail = { platform: "JD", shopId: SHOP_DAY.shopId, cateId: "1", gmv: "123" };
  assert.equal(inspectDayResponse("channel_category", success(table([summary, detail]))).status, "received");
  for (const altered of [{ ...summary, sumLine: false }, { ...summary, shopId: "other" }, { ...summary, platform: "DY" }]) {
    assert.equal(inspectDayResponse("channel_category", success(table([altered, detail]))).status, "scope_mismatch");
  }
  assert.equal(inspectDayResponse("channel_goods", success(table([summary, detail]))).status, "scope_mismatch");
});

test("原始结果按店铺日期落盘，重启后复用成功结果并固定单商品", async () => temporary(async directory => {
  const calls = [];
  const request = async (input, onRequest) => { calls.push(input); onRequest(); return success(table([sold])); };
  let collector = createShopDayCollector({ directory, request, intervalMs: 0 });
  assert.equal((await collector.collect({ reportId: "product_area" })).reason, "select_product_first");
  const first = await collector.collect({ reportId: "channel_goods" });
  assert.equal(first.record.requestCount, 1);
  assert.equal((await collector.selectProduct()).selected.goodsId, "item-1");
  collector = createShopDayCollector({ directory, request, intervalMs: 0 });
  assert.equal((await collector.collect({ reportId: "channel_goods" })).cached, true);
  assert.equal(calls.length, 1);
  await collector.collect({ reportId: "product_area" });
  assert.equal(calls[1].goodsId, "item-1");
  assert.equal((await collector.collect({ reportId: "product_area", goodsId: "other" })).reason, "invalid_scope");
  const status = await collector.status();
  assert.equal(status.directory, join(directory, "JD", SHOP_DAY.shopId, "2026-10-03"));
  assert.deepEqual((await collector.getRecord({ reportId: "channel_goods" })).response.payload.data.columnData, [sold]);
  assert.match(await readFile(join(status.directory, "selection.json"), "utf8"), /item-1/);
}));

test("分页必须连续，重复页停止，不能把未取完的结果标为完成", async () => temporary(async directory => {
  const collector = createShopDayCollector({ directory, intervalMs: 0, request: async (_input, count) => {
    count(); return success(table([{ flagId: 1 }], { total: 5 }));
  } });
  assert.equal((await collector.collect({ reportId: "channel_labels", page: 2 })).reason, "invalid_page");
  assert.equal((await collector.collect({ reportId: "channel_labels" })).record.nextPage, 2);
  assert.equal((await collector.status()).reports.find(r => r.id === "channel_labels").status, "pagination_incomplete");
  assert.equal((await collector.collect({ reportId: "channel_labels", page: 2 })).record.status, "pagination_repeated");
  assert.equal((await collector.collect({ reportId: "channel_labels", page: 3 })).reason, "invalid_page");
}));

test("全店商品明确限定 shopList，跨页去重后才确认覆盖 total", async () => temporary(async directory => {
  const spec = shopDayRequest({ reportId: "shop_goods_page", page: 2 });
  assert.deepEqual(spec.body.shopList, [{ platform: "JD", shopId: SHOP_DAY.shopId }]);
  assert.equal(spec.body.pageSize, 100);
  assert.equal(spec.body.pageNum, 2);
  assert.equal(spec.access, "sp_zl");
  assert.deepEqual(spec.body.filterCondition, []);
  assert.equal(shopDayRequest({ reportId: "shop_goods_total" }).path, "/v2/goods/overViewPageListSumData");
  const collector = createShopDayCollector({ directory, intervalMs: 0, request: async (input, count) => {
    count(); return success(table([{ ...sold, goodsId: `item-${input.page || 1}` }], { total: 2 }));
  } });
  assert.equal((await collector.collect({ reportId: "shop_goods_page" })).record.nextPage, 2);
  const second = (await collector.collect({ reportId: "shop_goods_page", page: 2 })).record;
  assert.equal(second.status, "received");
  assert.equal(second.uniqueItems, 2);
  assert.equal(second.accumulatedRows, second.total);
  assert.equal(second.nextPage, undefined);
  assert.equal(inspectDayResponse("channel_goods", success(table([sold]))).canRepresentShopTotal, false);
}));

test("分页 total 变化或跨页商品重复时不允许继续扩采", async () => {
  for (const mode of ["changed_total", "duplicate", "overflow"]) await temporary(async directory => {
    const collector = createShopDayCollector({ directory, intervalMs: 0, request: async (input, count) => {
      count(); const page = input.page || 1;
      const rows = [{ ...sold, goodsId: mode === "duplicate" ? "same" : `item-${page}` }];
      if (mode === "duplicate" && page === 2) rows[0].gmv = "456"; // different response hash, same identity
      if (mode === "overflow" && page === 2) rows.push({ ...sold, goodsId: "extra" });
      return success(table(rows, { total: mode === "changed_total" && page === 2 ? 3 : 2 }));
    } });
    await collector.collect({ reportId: "shop_goods_page" });
    const second = (await collector.collect({ reportId: "shop_goods_page", page: 2 })).record;
    assert.equal(second.status, { changed_total: "pagination_total_changed", duplicate: "pagination_duplicate_item", overflow: "pagination_count_mismatch" }[mode]);
    assert.equal(second.nextPage, undefined);
  });
});

test("无会话不发请求，本地新入口继承跨站保护且不接受任意商品", async () => temporary(async directory => {
  resetBoundStore();
  let calls = 0;
  setBoundFetch(async () => { calls++; throw new Error("unexpected"); });
  const server = createLocalProbeApp({ archiveDirectory: directory }).listen(0, "127.0.0.1");
  await new Promise(resolve => server.on("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await requestShopDayReport({ reportId: "channel_goods" })).blocked, "server_login_required");
    assert.equal((await fetch(`${base}/api/bound/shop-day/collect`, { method: "POST", headers: { Origin: "https://foreign.example", "content-type": "application/json" }, body: '{}' })).status, 403);
    const headers = { Origin: base, "content-type": "application/json" };
    const result = await (await fetch(`${base}/api/bound/shop-day/select-product`, { method: "POST", headers, body: JSON.stringify({ goodsId: "other" }) })).json();
    assert.equal(result.reason, "invalid_scope");
    assert.equal((await (await fetch(`${base}/api/bound/shop-day`)).json()).reports.length, DAY_REPORTS.filter(r => !r.manual).length);
    const mark = { keys: ['JD:16501691:goods:10225590259558'], from: '2026-10-03', field: 'tag', value: '本地测试标签' };
    assert.equal((await fetch(base + '/api/bound/shop-day/annotations', { method: 'POST', headers: { ...headers, Origin: 'https://foreign.example' }, body: JSON.stringify(mark) })).status, 403);
    const write = await (await fetch(base + '/api/bound/shop-day/annotations', { method: 'POST', headers, body: JSON.stringify(mark) })).json();
    assert.equal(write.ok, true);
    const read = await (await fetch(base + '/api/bound/shop-day/annotations?from=2026-10-03&keys=' + encodeURIComponent(mark.keys[0]))).json();
    assert.equal(read.marks[mark.keys[0]].tag, '本地测试标签');
    assert.equal((await fetch(base + '/api/bound/shop-day/saved/overview?from=2026-08-31')).status, 400);
    assert.equal((await fetch(base + '/api/bound/shop-day/saved/options')).status, 200);
    assert.equal(calls, 0);
  } finally { await new Promise(resolve => server.close(resolve)); resetBoundStore(); }
}));

test("商品表单请求过期后只重登一次，原店铺日期商品条件原样重放", async () => {
  resetBoundStore();
  const dataCalls = [];
  const json = payload => new Response(JSON.stringify(payload), { headers: { "content-type": "application/json", "set-cookie": "JSESSIONID=test-only; Path=/" } });
  setBoundFetch(async (url, options) => {
    const path = new URL(url).pathname;
    if (path.endsWith("/auth/login")) return json({ code: 0, data: {} });
    if (path.endsWith("/auth/info")) return json({ code: 0, data: { uid: "test-user", verify: true } });
    if (path.endsWith("/auth/getUserInfo")) return json({ code: 0, data: { userInfo: { userId: "test-user" } } });
    assert.ok(path.endsWith("/v2/goods/overallGoodsSku"));
    dataCalls.push(options);
    return json(dataCalls.length === 1 ? { code: -1 } : { code: 0, data: table([sold]) });
  });
  try {
    await loginWithPassword({ userName: "test-user", password: "test-password", autoRelogin: true });
    let count = 0;
    const result = await requestShopDayReport({ reportId: "product_skus", goodsId: "item-1" }, () => count++);
    assert.deepEqual(result.relogin, { attempted: true, succeeded: true });
    assert.equal(count, 2);
    assert.equal(dataCalls[0].body, dataCalls[1].body);
    assert.match(dataCalls[1].headers["Content-Type"], /application\/x-www-form-urlencoded/);
    const body = new URLSearchParams(dataCalls[1].body);
    assert.equal(body.get("shopId"), SHOP_DAY.shopId);
    assert.equal(body.get("goodsId"), "item-1");
    assert.equal(body.get("startDate"), SHOP_DAY.date);
    assert.equal(body.get("endDate"), SHOP_DAY.date);
    assert.equal(body.has("password"), false);
  } finally { resetBoundStore(); }
});

test("补采只接受完整店日商品清单内的商品，并独立保存每件商品结果", async () => temporary(async directory => {
  const calls = [];
  const collector = createShopDayCollector({ directory, intervalMs: 0, request: async (task, count) => {
    calls.push(task); count();
    if (task.reportId === "shop_goods_page") return success(table([sold, { ...sold, goodsId: "item-2" }], { total: 2 }));
    return success(table([{ ...sold, goodsId: task.goodsId }]));
  } });
  assert.equal((await collector.collect({ reportId: "product_skus", goodsId: "item-2" })).reason, "invalid_scope");
  await collector.collect({ reportId: "shop_goods_page" });
  assert.equal((await collector.inventory()).complete, true);
  for (const goodsId of ["item-1", "item-2"]) {
    const result = await collector.collect({ reportId: "product_skus", goodsId });
    assert.equal(result.record.goodsId, goodsId);
    assert.equal((await collector.getRecord({ reportId: "product_skus", goodsId })).rows[0].goodsId, goodsId);
  }
  assert.equal((await collector.collect({ reportId: "product_skus", goodsId: "unlisted" })).reason, "invalid_scope");
  assert.equal((await collector.collect({ reportId: "shop_goods_total", goodsId: "item-1" })).reason, "invalid_scope");
  assert.equal(calls.length, 3);
}));

test("缺少登录可续采，不把未发出的请求永久缓存为失败", async () => temporary(async directory => {
  let ready = false;
  const collector = createShopDayCollector({ directory, intervalMs: 0, request: async (_task, count) => {
    if (!ready) return { blocked: "server_login_required" };
    count(); return success(table([{ ...sold, spuid: "spu-1" }], { total: 1 }));
  } });
  assert.equal((await collector.collect({ reportId: "shop_spu_page" })).record.status, "server_login_required");
  assert.equal(await collector.getRecord({ reportId: "shop_spu_page" }), null);
  ready = true;
  const result = await collector.collect({ reportId: "shop_spu_page" });
  assert.equal(result.record.uniqueItems, 1);
  assert.equal(result.record.status, "received");
}));

test("分类卡片、多表时段与推广计划保留原始结构；未收齐卡片不声明完整", () => {
  assert.equal(inspectDayResponse("shop_cards_sku", success({ total: 170, cardInfos: [{ id: 1, count: 2 }] })).status, "received");
  assert.equal(inspectDayResponse("shop_cards_spu", success({ total: 80, cardInfos: [], hasNextPage: true })).status, "pagination_incomplete");
  assert.equal(inspectDayResponse("product_operation_hour", success([table([{ hour: "1", gmv: "123" }])]), "item-1").rows.length, 1);
  const promotion = [{ promoteKey: "jd", extensibleTableWrapper: table([{ planName: "测试计划", cost: "12.34" }]) }];
  assert.equal(inspectDayResponse("product_promotion", success(promotion), "item-1").status, "received");
  assert.equal(inspectDayResponse("product_promotion", success([]), "item-1").status, "empty");
});
