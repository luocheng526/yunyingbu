/* global structuredClone, URLSearchParams, Blob, setTimeout */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { createAnnotations } from "../src/modules/bound/annotations.js";
import { publicCatalog } from "../src/modules/bound/catalog.js";
import { createSavedData } from '../src/modules/bound/saved-data.js';
import { compactSavedRecord } from '../src/modules/bound/saved-wire.js';
import { addDays, shanghaiToday } from '../src/modules/bound/time.js';

const source = readFileSync(new URL("../public/shared/modules/bound.js", import.meta.url), "utf8");
const scope = { shopId: "16501691", platform: "JD", shopName: "RASW潮流生活京选菀瑶专卖店", date: "2026-10-03" };
const selected = { goodsId: "10225590259558", goodsName: "测试除螨仪", ...scope };
const columns = ["date", "goodsId", "goodsName", "skuId", "province", "city", "gmv", "netGmv", "tghf", "profit", "sales"]
  .map(key => ({ columnKey: key, columnName: key === "gmv" ? "支付金额(支付)" : key }));
function record(id, rows, page = 1, extra = {}) {
  return { reportId: id, page, scope, goodsId: id.startsWith("product_") ? selected.goodsId : null,
    status: rows.length ? "received" : "empty", rows,
    response: { payload: { data: { columnInfo: columns, columnData: rows } } }, ...extra };
}
function fixture() {
  const goods = Array.from({ length: 170 }, (_, i) => ({ goodsId: String(90000000000000 + i), goodsName: "商品" + i,
    shopId: scope.shopId, gmv: i < 50 ? "100" : "0", tghf: String(i), profit: String(-i), sumLine: false }));
  return {
    channel_operating: [record("channel_operating", [{ date: "2026/10/03", gmv: "23181", netGmv: "20760", tghf: 9606.63, profit: "6395", thtkje: 2370.15, jhpcb: 2640.44, zdyFyAll: "309" }])],
    shop_goods_page: [record("shop_goods_page", [{ sumLine: true, gmv: "23181" }, ...goods.slice(0, 100)], 1, { total: 170 }), record("shop_goods_page", [{ sumLine: true }, ...goods.slice(100)], 2, { total: 170 })],
    shop_goods_total: [record("shop_goods_total", [{ sumLine: true, gmv: "23181", netGmv: "20760", tghf: "9607", profit: "6705", sales: "90" }])],
    channel_goods: [record("channel_goods", [{ sumLine: true, profit: "9879" }, ...goods.slice(0, 50)])],
    channel_labels: [record("channel_labels", [])],
    channel_area: [record("channel_area", [{ province: "河北", city: "--", isProv: true, sumLine: true, gmv: "100" }, { province: "河北", city: "石家庄", gmv: "100" }])],
    product_overview: [record("product_overview", [{ date: "2026/10/03", goodsId: selected.goodsId, goodsName: selected.goodsName, gmv: "4188", netGmv: "2918", tghf: "1663", profit: "770", sales: "12" }])],
    product_skus: [record("product_skus", [{ skuId: selected.goodsId, gmv: "4188", sales: "12" }])],
    product_area: [record("product_area", [{ province: "浙江", isProv: true, sumLine: true, gmv: "100" }, { province: "浙江", city: "杭州", gmv: "100" }])]
  };
}
async function harness({ records = fixture(), failedPage = false, search = "", inventory, products = {}, cardRecords = {}, extras = {}, run, saved, overview, marks = new Map(), annotationFailure = false, storage = new Map(), startAtDefault = false, backfill = null } = {}) {
  const annotationApi = createAnnotations({ read: async keys => keys.filter(k => marks.has(k)).map(k => ({ rowKey:k, ...marks.get(k) })), list: async () => [...marks].map(([rowKey, value]) => ({ rowKey, ...value })), write: async (k,v) => { marks.set(k,v); } });
  const calls = [];
  const downloads = [], blobs = [];
  class LocalURL extends URL {}
  LocalURL.createObjectURL = blob => { blobs.push(blob); return "blob:test"; };
  LocalURL.revokeObjectURL = () => {};
  const root = { innerHTML: "", querySelector: () => null, addEventListener(type, fn) { this[type] = fn; }, removeEventListener() {} };
  const reply = (body, ok = true) => Promise.resolve({ ok, json: async () => structuredClone(body) });
  const manifest = { ok: true, scope, selected, inventory, run, reports: Object.entries(records).map(([id, pages]) => ({ id, label: id, product: id.startsWith("product_"), pages: pages.map(r => ({ page: r.page, status: r.status })) })) };
  const context = vm.createContext({
    window: { location: { hostname: "127.0.0.1", search }, localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) } }, Date, Intl, URL: LocalURL, URLSearchParams, Blob,
    document: { getElementById: () => null, createElement: tag => tag === 'a' ? { click() { downloads.push(this.download); } } : {}, head: { appendChild() {} } },
    setInterval: () => 1, clearInterval() {},
    fetch(url, options = {}) {
      calls.push({ url, options });
      if (url.startsWith('/api/bound/shop-day/goods-backfill')) {
        if (url.endsWith('/stop')) backfill = { ...backfill, status: 'paused' };
        if (url.endsWith('/start')) backfill = { ...backfill, status: 'running' };
        return reply({ ok: true, run: backfill });
      }
      if (url.startsWith("/api/bound/shop-day/annotations")) {
        if (annotationFailure) return reply({ok:false},false);
        const input = options.method === 'POST' ? JSON.parse(options.body) : Object.fromEntries(new URL(url,'http://localhost').searchParams);
        return (options.method === 'POST' ? annotationApi.save(input) : url.includes('/annotations/index?') ? annotationApi.index(input) : annotationApi.get(input)).then(body=>({ok:body.ok,json:async()=>body}));
      }
      if (url === "/api/bound") return reply({ ok: true });
      if (url === "/api/bound/catalog") return reply(publicCatalog());
      if (url === "/api/bound/link") return reply({ phase: "not_logged_in", collection: { batchEnabled: false } });
      if (url === "/api/bound/progress") return reply({ items: [] });
      if (url.startsWith("/api/bound/collect/probe")) return reply({ target: { ...scope, metric: "广告花费" }, targets: [] });
      if (url.startsWith("/api/bound/shop-day/saved/overview?")) { const data = typeof overview === 'function' ? overview(new URL(url, 'http://localhost').searchParams) : overview; return Promise.resolve(data).then(value => value ? reply(value) : reply({}, false)); }
      if (url.startsWith("/api/bound/shop-day/saved/options")) return saved ? reply(saved.options) : reply({}, false);
      if (url.startsWith("/api/bound/shop-day/saved?")) {
        const p = new URL(url, "http://localhost").searchParams;
        return Promise.resolve(saved.manifest(p, manifest)).then(reply);
      }
      if (url.startsWith("/api/bound/shop-day/saved/report?")) {
        const p = new URL(url, "http://localhost").searchParams;
        return Promise.resolve(saved.record(p, records)).then(record => reply({ ok: !!record, record }));
      }
      if (url === "/api/bound/shop-day") return reply(manifest);
      if (url.startsWith("/api/bound/shop-day/report?")) {
        const params = new URL(url, "http://localhost").searchParams;
        const id = params.get("reportId"), page = Number(params.get("page"));
        if (failedPage && id === "shop_goods_page" && page === 2) return reply({}, false);
        const goodsId = params.get("goodsId");
        const cardId = params.get("cardId");
        const extraKey = id + (params.has('columnKey') ? ':' + params.get('columnKey') : params.has('trendDays') ? ':' + params.get('trendDays') : '');
        if (extras[extraKey]) return reply({ ok: true, record: extras[extraKey].find(r => r.page === page) });
        const available = cardId && cardRecords[id + ':' + cardId] ? cardRecords[id + ':' + cardId] : goodsId && goodsId !== selected.goodsId ? products[goodsId]?.[id] || [] : records[id] || [];
        return reply({ ok: true, record: available.find(r => r.page === page) });
      }
      throw new Error("Unexpected request: " + url);
    }
  });
  vm.runInContext(source, context);
  let unmount = context.window.XmModules["/bound"].mount(root);
  const settle = () => new Promise(resolve => setTimeout(resolve, 10));
  const click = async attrs => {
    root.click({ target: { closest: selector => selector === "[data-act]" ? { getAttribute: name => attrs[name] } : null } });
    await settle();
  };
  const change = async (act, value, attrs = {}) => { root.change({ target: { value, checked: attrs.checked, getAttribute: name => name === "data-act" ? act : attrs[name] } }); await settle(); };
  const input = async (act, value) => { root.input({ target: { value, getAttribute: name => name === 'data-act' ? act : null } }); await settle(); };
  await settle();
  if (!startAtDefault && !search) {
    // Tests of a specific archived report navigate explicitly; entry defaults
    // have separate assertions instead of dictating every fixture's scope.
    if (saved) { await change('saved-shop', scope.platform + ':' + scope.shopId); await change('pick-date', scope.date); }
    await click({ 'data-act': 'page', 'data-page': 'channelAnalysis' });
  }
  return { root, calls, click, change, input, blobs, downloads, remount: async () => { unmount(); unmount = context.window.XmModules['/bound'].mount(root); await settle(); } };
}


function savedFixture() {
  const second = { ...scope, shopId: "12345", shopName: "另一家店" };
  function localRecords(p, original) {
    if (p.get("shopId") === scope.shopId && p.get("from") === scope.date && p.get("to") === scope.date) return original;
    const current = { ...(p.get("shopId") === second.shopId ? second : scope), date: p.get("to"), from: p.get("from"), to: p.get("to") };
    if (p.get("to") === "2026-09-01") return {};
    const row = { ...current, date: p.get("to"), gmv: "12345", netGmv: "11000", tghf: "900", profit: "500" };
    const goods = { ...row, goodsId: "99999999", goodsName: "旧库商品", spuid: "88", gmv: "321" };
    const raw = {
      channel_operating: [record("channel_operating", [row], 1, { scope: current })],
      shop_goods_page: [record("shop_goods_page", [goods], 1, { scope: current, total: 1, completeness: "partial" })],
      key_graph: [record("key_graph", [row], 1, { scope: current, metricCards: { gmv: { value: "12345" } }, metricColumns: [columns.find(c => c.columnKey === "gmv")], metricTrend: [] })],
      key_shops: [record("key_shops", [row], 1, { scope: current, columnKey: "gmv" })],
      key_goods: [record("key_goods", [goods], 1, { scope: current, columnKey: "gmv", total: 1, completeness: "partial" })],
      channel_shop_table: [record("channel_shop_table", [row], 1, { scope: current })]
    };
    return raw;
  }
  return {
    options: { ok: true, shops: [scope, second], dates: [scope.date, "2026-11-18"], defaultScope: scope },
    manifest(p, original) {
      const current = { ...(p.get("shopId") === second.shopId ? second : scope), date: p.get("to"), from: p.get("from"), to: p.get("to") };
      const records = localRecords(p, Object.fromEntries(original.reports.map(r => [r.id, r.pages])));
      return { ...original, unified: true, runtime: "server", scope: current, collectionScope: scope,
        reports: Object.entries(records).filter(([id]) => !["key_graph", "key_goods", "key_shops", "channel_shop_table"].includes(id)).map(([id, pages]) => ({ id, pages: pages.map(r => ({page: r.page, status: r.status})) })) };
    },
    record(p, original) { return localRecords(p, original)[p.get("reportId")]?.find(r => r.page === Number(p.get("page"))); }
  };
}

test('四个页面全部店铺使用同一查询范围，关键指标跨店同商品ID仍可展示', async () => {
  const day = scope.date;
  const shops = [{ ...scope }, { ...scope, shopId: '456', shopName: '第二家店' }];
  const rows = shops.map((s, i) => ({ ...s, gmv: (i + 1) * 100, goodsId: '999', goodsName: '同ID商品' }));
  const sheets = ['qdfx_dplb', 'sp_zl_list'].map(reportId => ({ reportId, dim: reportId === 'sp_zl_list' ? 'sku' : 'all', startOn: day, endOn: day, status: 'done', pageNo: 1, payload: { raw: { data: { columnData: rows } } } }));
  const api = createSavedData({ readSheets: async () => sheets, readHeads: async () => sheets, collector: { getRecord: async () => null, status: async () => ({ ok: true, scope, reports: [] }) } });
  const saved = { options: { ok: true, shops, dates: [day], defaultScope: scope }, manifest: p => api.manifest(Object.fromEntries(p)), record: async p => (await api.record(Object.fromEntries(p))).record };
  const overview = { ok: true, scope: { from: day, to: day }, records: { saved_shops: record('saved_shops', rows, 1, { source: {}, scope: { from: day, to: day } }) } };
  const h = await harness({ saved, overview });
  for (const page of ['channelOverview', 'channelAnalysis', 'productOverview', 'channelAnalysisNew']) {
    await h.click({ 'data-act': 'page', 'data-page': page });
    await h.change('saved-shop', '__all__');
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.match(h.root.innerHTML, /value="__all__" selected/);
    if (page === 'channelAnalysis') await h.click({ 'data-act': 'tab', 'data-tab': 'qdfx_dplb' });
    assert.match(h.root.innerHTML, /当前表 2 条/, page);
  }
  assert.equal(h.calls.some(c => /saved\?/.test(c.url) && /shopId=__all__/.test(c.url) && /platform=all/.test(c.url)), true);
});

test('全部店铺临时读取失败后重新选择可恢复，不永久缓存成无数据', async () => {
  let attempts = 0;
  const overview = { ok: true, scope: { from: scope.date, to: scope.date }, records: { saved_shops: record('saved_shops', [{ ...scope, gmv: 10 }], 1, { source: {} }) } };
  const h = await harness({ saved: savedFixture(), overview: () => ++attempts === 1 ? null : overview });
  attempts = 0;
  await h.click({ 'data-act': 'page', 'data-page': 'channelOverview' });
  await h.change('saved-shop', '__all__');
  assert.match(h.root.innerHTML, /全部店铺数据读取失败/);
  await h.change('saved-shop', 'JD:12345');
  await h.change('saved-shop', '__all__');
  assert.match(h.root.innerHTML, /当前表 1 条/);
  assert.equal(attempts, 2);
});

test('每次进入默认渠道总览和最新已存日期，首屏不读取全店档案或其它页签', async () => {
  const saved = savedFixture();
  const latest = '2026-11-18';
  const h = await harness({ saved, startAtDefault: true, overview: p => ({ ok: true, scope: { from: p.get('from'), to: p.get('to') }, records: {} }) });
  assert.match(h.root.innerHTML, /data-page="channelOverview"/);
  assert.match(h.root.innerHTML, /value="__all__" selected/);
  assert.match(h.root.innerHTML, /data-act="pick-date"[^>]*value="2026-11-18"/);
  assert.doesNotMatch(h.root.innerHTML, /data-act="archive-date"/);
  assert.equal(h.calls.some(c => /saved\?|saved\/report\?/.test(c.url)), false);
  const request = h.calls.find(c => c.url.includes('/saved/overview?'));
  const params = new URL(request.url, 'http://localhost').searchParams;
  assert.equal(params.get('from'), latest);
  assert.deepEqual(params.get('reports').split(','), ['saved_channels', 'saved_shops']);
  await h.click({ 'data-act': 'page', 'data-page': 'channelAnalysis' });
  await h.change('pick-date', scope.date);
  await h.remount();
  assert.match(h.root.innerHTML, /data-page="channelOverview"/);
  assert.match(h.root.innerHTML, /data-act="pick-date"[^>]*value="2026-11-18"/);
});

test('渠道总览按需加载页签、复用日期缓存，刷新明确绕过缓存', async () => {
  const overview = p => {
    const sc = { from: p.get('from'), to: p.get('to') };
    return { ok: true, scope: sc, records: Object.fromEntries(p.get('reports').split(',').map(id => [id, record(id, [], 1, { scope: sc, source: {} })])) };
  };
  const h = await harness({ saved: savedFixture(), startAtDefault: true, overview });
  const overviewCalls = () => h.calls.filter(c => c.url.includes('/saved/overview?'));
  assert.equal(overviewCalls().length, 1);
  await h.click({ 'data-act': 'tab', 'data-tab': 'qdzl_pl' });
  assert.equal(new URL(overviewCalls().at(-1).url, 'http://localhost').searchParams.get('reports'), 'saved_category');
  await h.click({ 'data-act': 'tab', 'data-tab': 'qdzl_lb' });
  assert.equal(overviewCalls().length, 2);
  await h.change('pick-date', '2026-11-17');
  assert.equal(overviewCalls().length, 3);
  await h.change('pick-date', '2026-11-18');
  assert.equal(overviewCalls().length, 3);
  assert.equal(h.calls.filter(c => c.url === '/api/bound/link').length, 1);
  await h.click({ 'data-act': 'archive-refresh' });
  assert.equal(new URL(overviewCalls().at(-1).url, 'http://localhost').searchParams.get('refresh'), '1');
});

test('快速切换日期时旧请求较晚返回不会覆盖新日期', async () => {
  let finishOld;
  const h = await harness({ saved: savedFixture(), startAtDefault: true, overview: p => {
    const sc = { from: p.get('from'), to: p.get('to') };
    const data = { ok: true, scope: sc, records: { saved_shops: record('saved_shops', [{ ...scope, date: sc.to, shopName: sc.to === '2026-11-17' ? '新日期店铺' : '旧日期店铺', gmv: 10 }], 1, { scope: sc, source: {}, response: { payload: { data: { columnInfo: [{ columnKey: 'shopName', columnName: '店铺' }] } } } }) } };
    return sc.to === '2026-11-18' ? new Promise(resolve => { finishOld = () => resolve(data); }) : data;
  } });
  await h.change('pick-date', '2026-11-17');
  assert.match(h.root.innerHTML, /新日期店铺/);
  finishOld(); await new Promise(resolve => setTimeout(resolve, 20));
  assert.match(h.root.innerHTML, /新日期店铺/); assert.doesNotMatch(h.root.innerHTML, /旧日期店铺/);
});

test('商品补采显示实际范围进度，暂停与继续保持原店铺日期范围', async () => {
  const h = await harness({ saved: savedFixture(), backfill: { id: 'backfill', status: 'running', from: '2026-09-01', to: '2026-11-18', done: 43, total: 3397, failed: 0, shops: [scope], current: scope } });
  await h.click({ 'data-act': 'page', 'data-page': 'productOverview' });
  assert.match(h.root.innerHTML, /手动补采 · 采集中/); assert.match(h.root.innerHTML, /43\/3397/);
  await h.click({ 'data-act': 'goods-backfill-stop' }); assert.match(h.root.innerHTML, /手动补采 · 已暂停/);
  await h.click({ 'data-act': 'goods-backfill-resume' });
  const start = h.calls.find(c => c.url.endsWith('/goods-backfill/start'));
  assert.deepEqual(JSON.parse(start.options.body), { from: '2026-09-01', to: '2026-11-18', shopKeys: ['JD:' + scope.shopId] });
  assert.match(h.root.innerHTML, /手动补采 · 采集中/);
  const yesterday = addDays(shanghaiToday(), -1);
  await h.change('pick-date', yesterday);
  const last = h.calls.filter(call => call.url.startsWith('/api/bound/shop-day/saved?')).at(-1);
  assert.equal(new URL(last.url, 'http://localhost').searchParams.get('to'), yesterday);
});

test('大表内联读取一次、菜单往返复用、未显示SPU不请求；标记全表一次读取且可保存', async () => {
  const saved = savedFixture();
  const large = Array.from({ length: 1100 }, (_, i) => ({ ...scope, goodsId: String(10000 + i), goodsName: '完整商品' + i, profit: i, gmv: i }));
  const marks = new Map([['bound:v1:JD:' + scope.shopId + ':goods:11099', { tag: '最后一页' }]]);
  saved.manifest = p => {
    const current = { ...scope, from: p.get('from'), to: p.get('to') };
    const records = Object.fromEntries(p.get('reports').split(',').map(id => [id, [compactSavedRecord(record(id, id === 'shop_goods_page' ? large : [{ gmv: 1200 }], 1, { scope: current, total: id === 'shop_goods_page' ? large.length : 1 }))]]));
    return { ok: true, unified: true, scope: current, records, reports: Object.keys(records).map(id => ({ id, pages: [{ page: 1, status: 'received' }] })) };
  };
  const h = await harness({ saved, marks });
  await h.click({ 'data-act': 'page', 'data-page': 'productOverview' });
  assert.match(h.root.innerHTML, /完整商品0/);
  assert.match(h.root.innerHTML, /最后一页/);
  const manifests = () => h.calls.filter(c => c.url.includes('/saved?'));
  const reports = new URL(manifests().at(-1).url, 'http://localhost').searchParams.get('reports');
  assert.equal(reports, 'shop_goods_page,shop_goods_total,shop_cards_sku');
  assert.equal(h.calls.filter(c => /saved\/report.*reportId=shop_goods_page/.test(c.url)).length, 0);
  const before = manifests().length;
  await h.click({ 'data-act': 'page', 'data-page': 'channelAnalysis' });
  await h.click({ 'data-act': 'page', 'data-page': 'productOverview' });
  assert.equal(manifests().length, before);
  assert.equal(h.calls.filter(c => c.url.includes('/annotations/index?') && c.url.includes('from=' + scope.date)).length, 1);
  await h.change('archive-tag-filter', '最后一页');
  assert.match(h.root.innerHTML, /完整商品1099/); assert.doesNotMatch(h.root.innerHTML, />完整商品0</);
  await h.click({ 'data-act': 'archive-select-page' });
  await h.click({ 'data-act': 'archive-annotation-open', 'data-field': 'tag' });
  await h.input('archive-annotation-value', '改后的标签');
  await h.click({ 'data-act': 'archive-annotation-save' });
  assert.equal(marks.get('bound:v1:JD:' + scope.shopId + ':goods:11099').tag, '改后的标签');
  await h.change('archive-tag-filter', '');
  await h.change('q', '完整商品1099');
  await h.click({ 'data-act': 'archive-export' });
  assert.match(await h.blobs.at(-1).text(), /完整商品1099/);
  await h.click({ 'data-act': 'archive-product', 'data-goods-id': '11099' });
  assert.match(manifests().at(-1).url, /product_overview/);
});

test("新页面统一读取旧库：四页、店铺日期、筛选导出都不分入口且不触发采集", async () => {
  const h = await harness({ saved: savedFixture() });
  assert.match(h.root.innerHTML, /23,181/);
  assert.doesNotMatch(h.root.innerHTML, /本次单店数据|服务器历史数据|data-source/);
  await h.change("pick-date", "2026-11-18");
  assert.match(h.root.innerHTML, /12,345/);
  assert.doesNotMatch(h.root.innerHTML, /23,181/);
  await h.change("saved-shop", "JD:12345");
  assert.match(h.root.innerHTML, /另一家店/);
  await h.click({ "data-act": "page", "data-page": "channelOverview" });
  assert.match(h.root.innerHTML, /12,345/);
  await h.click({ "data-act": "page", "data-page": "channelAnalysisNew" });
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.match(h.root.innerHTML, /12,345/);
  assert.match(h.root.innerHTML, /旧库商品/);
  await h.click({ "data-act": "page", "data-page": "productOverview" });
  assert.match(h.root.innerHTML, /旧库商品/);
  assert.match(h.root.innerHTML, /商品分页不完整/);
  assert.doesNotMatch(h.root.innerHTML, /全店商品分页已收齐/);
  await h.change("q", "旧库商品");
  await h.click({ "data-act": "archive-export" });
  assert.match(await h.blobs.at(-1).text(), /旧库商品/);
  await h.change("pick-date", "2026-08-01");
  assert.match(h.root.innerHTML, /2026年9月1日/);
  assert.doesNotMatch(h.root.innerHTML, /旧库商品|12,345/);
  const url = h.calls.filter(c => c.url.startsWith("/api/bound/shop-day/saved?")).at(-1).url;
  assert.match(url, /from=2026-09-01/);
  assert.equal(h.calls.some(c => c.options.method === "POST" || c.url.startsWith("/api/bound/view?")), false);
  await h.click({ "data-act": "page", "data-page": "link" });
  assert.match(h.root.innerHTML, /data-bound-password/);
  assert.doesNotMatch(h.root.innerHTML, /单店四页采集|archive-job-start|archive-job-stop|RASW潮流生活京选菀瑶专卖店 · 2026-10-03/);
});

function periodFixture() {
  const records = fixture();
  const items = [
    { ...selected, spuid: 'spu-1', gmv: '4188', netGmv: '2918', sales: '12', refund: '1270', tghf: '1663', profit: '770', netHpCost: '200' },
    { ...selected, goodsId: '10225590259559', goodsName: '第二件商品', spuid: 'spu-1', gmv: '100', netGmv: '100', sales: '1', refund: '0', tghf: '25', profit: '50', netHpCost: '5' }
  ];
  records.shop_goods_page = [record('shop_goods_page', items, 1, { total: 2 })];
  records.shop_spu_page = [record('shop_spu_page', [{ ...items[0], goodsId: undefined }], 1, { total: 1 })];
  records.shop_spu_total = [record('shop_spu_total', [{ sumLine: true, gmv: '4288' }])];
  const products = {};
  for (const item of items) {
    const daily = Array.from({ length: 30 }, (_, index) => ({ ...item, date: new Date(Date.parse('2026-10-03T00:00:00Z') - index * 86400000).toISOString().slice(0, 10).replaceAll('-', '/'), ...(index ? { gmv: index === 1 ? '0' : String(1000 + index), netGmv: index === 1 ? '-77' : String(900 + index), refund: '77', profit: '-20' } : {}) }));
    const r = record('product_overview', [daily[0]], 1, { goodsId: item.goodsId });
    r.response.payload = { code: 0, data: [{ columnInfo: columns, columnData: [{ gmv: '99999999' }] }, { columnInfo: columns, columnData: daily }] };
    if (item.goodsId === selected.goodsId) records.product_overview = [r];
    else products[item.goodsId] = { product_overview: [r] };
  }
  return { records, products, inventory: { complete: true, items } };
}

test('关键指标使用专用卡片与比较值，点击联动明细，缺采指标不沿用另一指标结果', async () => {
  const graph = record('key_graph', [{ gmv: '23180.55', tghf: '9606.63' }], 1, {
    metricColumns: [{ columnKey: 'gmv', columnName: '支付金额(支付)' }, { columnKey: 'tghf', columnName: '推广花费' }],
    metricCards: { gmv: { value: '23180.55', yoy: null, mom: '0.12' }, tghf: { value: '9606.63', yoy: '0.2', mom: null } },
    metricTrend: [{ date: scope.date, cells: { gmv: { value: '23180.55', lastYearValue: '20000', yoy: null, mom: '0.12' }, tghf: { value: '9606.63', lastYearValue: null } } }]
  });
  const rows = [{ ...selected, goodsName: '指标链接 A', cells: [{ column: 'gmv', value: '123.45' }] }];
  const h = await harness({ extras: { key_graph: [graph], 'key_goods:gmv': [record('key_goods', rows, 1, { columnKey: 'gmv', total: 1 })], 'key_shops:gmv': [record('key_shops', [{ shopName: scope.shopName, gmv: '23180.55' }], 1, { columnKey: 'gmv' })] } });
  await h.click({ 'data-act': 'page', 'data-page': 'channelAnalysisNew' });
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.match(h.root.innerHTML, /23,180.55/);
  assert.match(h.root.innerHTML, /12.00%/);
  assert.match(h.root.innerHTML, /指标链接 A/);
  assert.match(h.root.innerHTML, /去年同期/);
  assert.doesNotMatch(h.root.innerHTML, /支付金额\(支付\)同比/);
  assert.doesNotMatch(h.root.innerHTML, /店铺利润（已扣自定义费用）|data-tab="qd_gjzbfx_qdck"/);
  await h.click({ 'data-act': 'tab', 'data-tab': 'qd_gjzbfx_dpck' });
  assert.match(h.root.innerHTML, /data-key="shopName"[^>]*>店铺/);
  assert.match(h.root.innerHTML, /RASW潮流生活京选菀瑶专卖店/);
  await h.click({ 'data-act': 'tab', 'data-tab': 'qd_gjzbfx_ljck' });
  await h.click({ 'data-act': 'archive-key-metric', 'data-key': 'tghf' });
  assert.doesNotMatch(h.root.innerHTML, /指标链接 A/);
  assert.match(h.root.innerHTML, /这张表尚未采集/);
  assert.ok(h.calls.some(c => c.url.includes('reportId=key_goods') && c.url.includes('columnKey=tghf')));
  await h.click({ 'data-act': 'archive-trend-fold' });
  assert.doesNotMatch(h.root.innerHTML, /<svg viewBox/);
  assert.equal(h.calls.some(c => c.options.method && c.options.method !== 'GET'), false);
});

test('SPU 周期直接展示专用接口数值，缺日不造零，导出和展开保留 SPU 身份', async () => {
  const f = periodFixture(), product = f.records.shop_spu_page[0].rows[0];
  const periods = [{ spuid: product.spuid, rows: [{ date: '2026/10/03', gmv: '4287.68', tghf: '1688.22' }], missingDates: [] }];
  const h = await harness({ ...f, extras: { 'shop_spu_period:7': [record('shop_spu_period', [product], 1, { trendDays: 7, total: 1, periods })] } });
  await h.click({ 'data-act': 'page', 'data-page': 'productOverview' });
  await h.click({ 'data-act': 'chip', 'data-key': 'view', 'data-value': 'period' });
  assert.match(h.root.innerHTML, /4,287.68/);
  assert.equal((h.root.innerHTML.match(/data-period-date=/g) || []).length, 7);
  assert.match(h.root.innerHTML, /未采集/);
  assert.match(h.root.innerHTML, /data-act="archive-gallery-spu" data-spuid="spu-1"/);
  assert.doesNotMatch(h.root.innerHTML, /data-act="archive-product" data-goods-id=""/);
  await h.click({ 'data-act': 'archive-export' });
  const csv = await h.blobs[0].text();
  assert.match(csv, /"spu-1","2026-10-03","已采集"/);
  assert.match(csv, /"4287.68"/);
  assert.match(csv, /"2026-10-02","未采集"/);
});

test('渠道总览明确单店范围，缺少店铺列表时不冒充全账号总览', async () => {
  const h = await harness();
  await h.click({ 'data-act': 'page', 'data-page': 'channelOverview' });
  assert.match(h.root.innerHTML, /当前总览范围/);
  await h.click({ 'data-act': 'tab', 'data-tab': 'qdzl_dp' });
  assert.match(h.root.innerHTML, /这张表尚未采集/);
  assert.equal(h.calls.some(c => c.url.includes('channelOverViewList') || c.options.method === 'POST'), false);
});

test('商品周期复用真实逐日档案，7/15天跨月展开；SPU不由SKU取整值拼凑', async () => {
  const h = await harness(periodFixture());
  await h.click({ 'data-act': 'page', 'data-page': 'productOverview' });
  assert.match(h.root.innerHTML, />周期<\/button>/);
  await h.click({ 'data-act': 'chip', 'data-key': 'view', 'data-value': 'period' });
  assert.match(h.root.innerHTML, /SPU 周期使用独立接口，尚未采集/);
  assert.doesNotMatch(h.root.innerHTML, /data-period-date=/);
  await h.click({ 'data-act': 'dim', 'data-dim': 'sku' });
  assert.equal((h.root.innerHTML.match(/data-period-date=/g) || []).length, 14);
  assert.match(h.root.innerHTML, /rowspan="7"/);
  assert.match(h.root.innerHTML, /2026\/09\/27/);
  assert.doesNotMatch(h.root.innerHTML, /2026\/09\/26|99,999,999|99999999|档案未通过核验/);
  assert.match(h.root.innerHTML, /<b><span class="bd-num ">0<\/span><\/b>/);
  assert.match(h.root.innerHTML, /is-negative/);
  await h.change('archive-period-days', '15');
  assert.equal((h.root.innerHTML.match(/data-period-date=/g) || []).length, 30);
  assert.match(h.root.innerHTML, /rowspan="15"/);
  assert.match(h.root.innerHTML, /2026\/09\/19/);
  await h.change('q', selected.goodsId);
  assert.equal((h.root.innerHTML.match(/data-period-date=/g) || []).length, 15);
  await h.click({ 'data-act': 'archive-export' });
  const csv = await h.blobs[0].text();
  assert.match(csv, /"时间范围","数据状态"/);
  assert.equal(csv.trim().split('\r\n').length, 16);
  assert.match(csv, /"2026-10-02","已采集"/);
  assert.match(h.downloads[0], /period-15-page-1/);
  assert.equal(h.calls.filter(c => c.url.includes('goodsId=10225590259559')).length, 1);
  assert.equal(h.calls.some(c => c.options.method && c.options.method !== 'GET'), false);
  await h.click({ 'data-act': 'archive-product', 'data-goods-id': selected.goodsId, 'data-product-page': 'productOperation' });
  assert.match(h.root.innerHTML, /data-page="productOperation"/);
  assert.doesNotMatch(h.root.innerHTML, /data-period-date=/);
});

test('周期缺日标记未采集，身份冲突、重复日期和锚点金额不符均不展示', async () => {
  for (const scenario of ['missing', 'foreign_product', 'foreign_shop', 'duplicate', 'future', 'anchor', 'invalid_date']) {
    const options = periodFixture();
    const rows = options.records.product_overview[0].response.payload.data[1].columnData;
    if (scenario === 'missing') rows.splice(1, 1);
    if (scenario === 'foreign_product') rows[1].goodsId = 'other';
    if (scenario === 'foreign_shop') rows[1].shopId = 'other';
    if (scenario === 'duplicate') rows[1].date = rows[0].date;
    if (scenario === 'future') rows[1].date = '2026/10/04';
    if (scenario === 'invalid_date') rows[1].date = '2026/09/31';
    if (scenario === 'anchor') { rows[0] = { ...rows[0], gmv: '99999' }; }
    const h = await harness(options);
    await h.click({ 'data-act': 'page', 'data-page': 'productOverview' });
    await h.click({ 'data-act': 'chip', 'data-key': 'dim', 'data-value': 'sku' });
    await h.change('q', selected.goodsId);
    await h.click({ 'data-act': 'chip', 'data-key': 'view', 'data-value': 'period' });
    assert.match(h.root.innerHTML, scenario === 'missing' ? /bd-period-missing">未采集/ : /档案未通过核验，请刷新重试/);
    if (scenario !== 'missing') assert.doesNotMatch(h.root.innerHTML, /bd-period-value/);
    await h.click({ 'data-act': 'archive-export' });
    const csv = await h.blobs[0].text();
    assert.match(csv, scenario === 'missing' ? /"2026-10-02","未采集"/ : /档案未通过核验/);
    await h.change('pick-date', '2026-10-04');
    assert.match(h.root.innerHTML, /当前选择范围未采集/);
    assert.doesNotMatch(h.root.innerHTML, /data-period-date=/);
  }
});

test("本机默认显示已采店日，完整商品分页保留零销量费用，不使用热销前50合计", async () => {
  const h = await harness();
  assert.match(h.root.innerHTML, /data-local-archive="true"/);
  assert.match(h.root.innerHTML, /2026年10月03日|2026年10月3日/);
  for (const value of ["23,181", "20,760", "9,606.63", "6,395"]) assert.ok(h.root.innerHTML.includes(value));
  assert.match(h.root.innerHTML, /已扣自定义费用/);
  assert.doesNotMatch(h.root.innerHTML, /未采完|data-act="panel"|data-act="mark"/);
  await h.click({ "data-act": "page", "data-page": "productOverview" });
  assert.match(h.root.innerHTML, /当前表 170 条/);
  assert.match(h.root.innerHTML, /6,705/);
  assert.doesNotMatch(h.root.innerHTML, /9,879/);
  await h.click({ "data-act": "sort", "data-key": "tghf" });
  assert.match(h.root.innerHTML, /商品169/); // sort all 170, not just the first displayed page
  await h.click({ "data-act": "page-no", "data-delta": "1" });
  assert.match(h.root.innerHTML, /第 2 \/ 4 页/);
  await h.change("q", "90000000000169");
  assert.match(h.root.innerHTML, /当前表 1 条/);
  assert.match(h.root.innerHTML, /90000000000169/); // IDs are text; no separators
  assert.equal(h.calls.some(c => c.options.method && c.options.method !== "GET"), false);
  assert.equal(h.calls.some(c => c.url.startsWith("/api/bound/view")), false);
});

test("未采日期不复用金额，空标签和未采页面不伪装为零", async () => {
  const h = await harness();
  await h.change("pick-date", "2026-10-04");
  assert.match(h.root.innerHTML, /当前选择范围未采集/);
  assert.doesNotMatch(h.root.innerHTML, /23,181|9,606.63|6,395/);
  await h.click({ "data-act": "archive-date" });
  assert.match(h.root.innerHTML, /9,606.63/);
  await h.click({ "data-act": "tab", "data-tab": "qdfx_bqfx" });
  assert.match(h.root.innerHTML, /接口已采集完成，返回 0 条记录/);
  await h.click({ "data-act": "page", "data-page": "productStock" });
  assert.match(h.root.innerHTML, /这个页面本轮尚未采集/);
  assert.doesNotMatch(h.root.innerHTML, /23,181/);
});

test("商品明细按选定商品显示，地域省市分离，时间序列只展示选定日", async () => {
  const records = fixture();
  records.product_overview[0].response.payload.data = [{ columnInfo: columns, columnData: [{ date: "2026/10/02", gmv: "999999" }] }, { columnInfo: columns, columnData: [{ date: "2026/10/02", gmv: "999999" }, ...records.product_overview[0].rows] }];
  const h = await harness({ records });
  await h.click({ "data-act": "page", "data-page": "productPanorama" });
  assert.match(h.root.innerHTML, /商品 ID：10225590259558/);
  assert.match(h.root.innerHTML, /4,188/);
  assert.doesNotMatch(h.root.innerHTML, /999,999|999999|2026\/10\/02/);
  await h.click({ "data-act": "tab", "data-tab": "spqj_sku" });
  assert.match(h.root.innerHTML, /skuId/);
  await h.click({ "data-act": "tab", "data-tab": "spqj_area" });
  assert.match(h.root.innerHTML, /当前表 1 条/);
  assert.doesNotMatch(h.root.innerHTML, /杭州/);
  await h.click({ "data-act": "chip", "data-key": "area", "data-value": "city" });
  assert.match(h.root.innerHTML, /当前表 1 条/);
  assert.match(h.root.innerHTML, /杭州/);
});

test("分页失败或重复商品时不宣称完整，不显示商品汇总卡", async () => {
  for (const duplicate of [false, true]) {
    const records = fixture();
    if (duplicate) records.shop_goods_page[1].rows[1].goodsId = records.shop_goods_page[0].rows[1].goodsId;
    const h = await harness({ records, failedPage: !duplicate });
    await h.click({ "data-act": "page", "data-page": "productOverview" });
    assert.match(h.root.innerHTML, /商品分页不完整/);
    assert.doesNotMatch(h.root.innerHTML, /全店商品分页已收齐|6,705/);
  }
});

test("单笔核验深链仍打开连接旧站，归档读取不要求旧站在线", async () => {
  const h = await harness({ search: "?probeDate=2026-10-03" });
  assert.match(h.root.innerHTML, /data-bound-password/);
  assert.doesNotMatch(h.root.innerHTML, /data-local-archive="true"/);
  await h.click({ "data-act": "page", "data-page": "channelAnalysis" });
  assert.match(h.root.innerHTML, /9,606.63/);
});

test("来源比例大于1仍按比例显示，嵌套费用不覆盖主指标且文本转义", async () => {
  const records = fixture();
  records.channel_operating[0].rows[0].refundRatio = "1.5";
  records.channel_operating[0].rows[0].date = '<img src=x onerror="alert(1)">';
  records.channel_operating[0].rows[0].lstGmv = [{ cost: "9999999" }];
  records.channel_operating[0].response.payload.data.columnInfo = [...columns, { columnKey: "refundRatio", columnName: "退款率(按金额)" }];
  const h = await harness({ records });
  assert.match(h.root.innerHTML, /150.00%/);
  assert.match(h.root.innerHTML, /23,181/);
  assert.doesNotMatch(h.root.innerHTML, /<img src=x/);
  assert.match(h.root.innerHTML, /<summary>[\s\S]*?23,181[\s\S]*?<\/summary>/);
  assert.match(h.root.innerHTML, /来源明细<\/strong>[\s\S]*?<b>9999999<\/b>/);
  assert.match(h.root.innerHTML, /&lt;img/);
});

test("商品表按业务顺序展示图片、上架日期和独立全店汇总，不能把销售件数标为单数", async () => {
  const records = fixture();
  const first = records.shop_goods_page[0].rows[1];
  Object.assign(first, { goodsId: selected.goodsId, spuid: "10035131488857", goodsName: "除螨仪完整标题", sales: "12", onSaleTime: "2026-06-11 14:11:13", goodsUrl: "img11.360buyimg.com/n1/jfs/test.png", refundRatio: "1.2482", tghfXseZb: "393.93" });
  records.shop_goods_page[0].response.payload.data.columnInfo = columns.filter(c => !["sales", "goodsName"].includes(c.columnKey));
  const h = await harness({ records });
  await h.click({ "data-act": "page", "data-page": "productOverview" });
  const header = h.root.innerHTML.match(/<thead>[\s\S]*?<\/thead>/)[0];
  const keys = [...header.matchAll(/data-act="sort" data-key="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(keys.slice(0, 13), ["goodsName", "shopName", "onSaleTime", "gmv", "netGmv", "sales", "refund", "refundRatio", "netHpCost", "netHpCostRatio", "tghf", "tghfXseZb", "profit"]);
  assert.match(header, /销售件数\(支付\)/);
  assert.match(header, /SPU（未采集）/);
  assert.match(h.root.innerHTML, /src="https:\/\/img11\.360buyimg\.com\/n1\/jfs\/test.png"/);
  assert.match(h.root.innerHTML, /referrerpolicy="no-referrer"/);
  assert.match(h.root.innerHTML, /2026\/06\/11/);
  assert.match(h.root.innerHTML, /124.82%/);
  assert.match(h.root.innerHTML, /39,393.00%/);
  assert.match(h.root.innerHTML, /style="width:100%"/);
  assert.match(h.root.innerHTML, /<td>12<\/td>/);
  const summary = () => h.root.innerHTML.match(/<tr class="bd-total" data-product-summary="all">[\s\S]*?<\/tr>/)[0];
  assert.match(summary(), /23,181/);
  assert.match(summary(), /6,705/);
  assert.doesNotMatch(summary(), /5,000|9,879/);
  const before = summary();
  await h.click({ "data-act": "page-no", "data-delta": "1" });
  assert.equal(summary(), before, "the total is not recomputed from the displayed page");
  await h.change("q", "10035131488857");
  assert.match(h.root.innerHTML, /当前表 1 条/);
  assert.equal(summary(), before, "search keeps the explicitly labelled whole-shop total");
  await h.click({ "data-act": "archive-product" });
  assert.match(h.root.innerHTML, /商品 ID：10225590259558/);
  assert.match(h.root.innerHTML, /4,188/);
  assert.equal(h.calls.some(c => c.options.method && c.options.method !== "GET"), false);
});

test("商品图片仅允许已知图片来源，失败时保留占位，商品文本必须转义", async () => {
  const records = fixture();
  const urls = ["javascript:alert(1)", "https://foreign.example/a.png", "https://img11.360buyimg.com.foreign.example/a.png", "https://secret@img11.360buyimg.com/a.png", "http://img11.360buyimg.com/a.png"];
  urls.forEach((goodsUrl, i) => Object.assign(records.shop_goods_page[0].rows[i + 1], { goodsUrl, goodsName: '<img src=x onerror="oops">' }));
  const h = await harness({ records });
  await h.click({ "data-act": "page", "data-page": "productOverview" });
  assert.doesNotMatch(h.root.innerHTML, /<img /);
  assert.match(h.root.innerHTML, /暂无图/);
  assert.match(h.root.innerHTML, /&lt;img/);
  const img = { tagName: "IMG", parentElement: { classList: { contains: name => name === "bd-product-thumb" } } };
  h.root.error({ target: img });
  assert.equal(img.hidden, true);
});

test("SPU 独立汇总可展开到完整商品链接，分类数量不能冒充已核验明细", async () => {
  const records = fixture();
  const goods = records.shop_goods_page.flatMap(r => r.rows).filter(r => !r.sumLine);
  goods.forEach((r, i) => { r.spuid = 'spu-' + (i % 2); });
  records.shop_spu_page = [record('shop_spu_page', [0, 1].map(i => ({ spuid: 'spu-' + i, shopId: scope.shopId, goodsName: 'SPU组' + i, gmv: '1000', profit: '-1' })), 1, { total: 2 })];
  records.shop_spu_total = [record('shop_spu_total', [{ sumLine: true, gmv: '2000', profit: '-2' }])];
  records.shop_cards_spu = [record('shop_cards_spu', [
    { id: 1, cardName: '亏损链接', count: '2', ratio: 1, grow: 0, calculateRule: JSON.stringify([{ columnKey: 'profit', calculation: 'lt', calculatedValue: 0 }]) },
    { id: 2, cardName: '规则缺字段', count: '1', calculateRule: JSON.stringify([{ columnKey: 'missing', calculation: 'gte', calculatedValue: 0 }]) }
  ])];
  const h = await harness({ records });
  await h.click({ 'data-act': 'page', 'data-page': 'productOverview' });
  assert.match(h.root.innerHTML, /当前表 2 条/);
  assert.match(h.root.innerHTML, /2,000/);
  assert.match(h.root.innerHTML, /分类明细待核验/);
  await h.click({ 'data-act': 'expand', 'data-key': 'spu-spu-0' });
  assert.match(h.root.innerHTML, /data-product-id="90000000000168"/);
  assert.doesNotMatch(h.root.innerHTML, /data-product-id="90000000000169"/);
  await h.click({ 'data-act': 'archive-card', 'data-id': '1' });
  assert.match(h.root.innerHTML, /当前表 2 条/);
  await h.click({ 'data-act': 'archive-card', 'data-id': '2' });
  assert.match(h.root.innerHTML, /分类明细尚未核验/);
  assert.doesNotMatch(h.root.innerHTML, /data-product-id=/);
  await h.click({ 'data-act': 'chip', 'data-key': 'dim', 'data-value': 'sku' });
  assert.match(h.root.innerHTML, /当前表 170 条/);
  assert.match(h.root.innerHTML, /23,181/);
});

test("商品切换只读对应商品档案，缺采时不沿用上一件商品金额，刷新保留选择", async () => {
  const records = fixture(), nextId = '90000000000000';
  const inventory = { complete: true, items: [selected, { goodsId: nextId, goodsName: '另一商品' }] };
  const products = { [nextId]: { product_overview: [] } };
  const h = await harness({ records, inventory, products, run: { status: 'collecting', done: 382, total: 1544 } });
  await h.click({ 'data-act': 'page', 'data-page': 'productPanorama' });
  assert.match(h.root.innerHTML, /4,188/);
  await h.change('archive-select-product', nextId);
  assert.match(h.root.innerHTML, /商品 ID：90000000000000/);
  assert.match(h.root.innerHTML, /尚未采集或档案读取失败/);
  assert.doesNotMatch(h.root.innerHTML, /4,188/);
  products[nextId].product_overview.push(record('product_overview', [{ gmv: '888', date: '2026/10/03' }], 1, { goodsId: nextId }));
  await h.click({ 'data-act': 'archive-refresh' });
  assert.match(h.root.innerHTML, /商品 ID：90000000000000/);
  assert.match(h.root.innerHTML, />888</);
  assert.doesNotMatch(h.root.innerHTML, /382 \/ 1544/);
  assert.match(h.root.innerHTML, /查看已保存数据，无需连接旧站/);
  assert.equal(h.calls.some(c => c.options.method && c.options.method !== 'GET'), false);
});

test("运营时段表和图表不拼接，推广类型各用自己的字段与计划名称", async () => {
  const records = fixture();
  const detail = { columnInfo: [{ columnKey: 'hour', columnName: '小时' }, { columnKey: 'gmv', columnName: '支付金额' }], columnData: [{ hour: '00', gmv: '123' }] };
  const chart = { columnInfo: detail.columnInfo, columnData: [{ hour: '00', gmv: '456' }] };
  records.product_operation = [record('product_operation', [{ date: '2026/10/03', gmv: '4188' }])];
  records.product_operation_hour = [record('product_operation_hour', [...detail.columnData, ...chart.columnData], 1, { response: { payload: { data: [detail, chart] } } })];
  const groups = [
    { promoteKey: 'invalid', promoteName: '无效单', sumCost: 0, extensibleTableWrapper: { columnInfo: [{ columnKey: 'invalidCost', columnName: '无效单费用' }], columnData: [{ name: '无效单', invalidCost: '0' }] } },
    { promoteKey: 'jd', promoteName: '京东快车', sumCost: 1663.44, extensibleTableWrapper: { columnInfo: [{ columnKey: 'cost', columnName: '花费' }], columnData: [{ sumLine: true, cost: '1663.44' }, { planName: '计划甲', cost: '1600' }, { planName: '计划乙', cost: '63.44' }] } }
  ];
  records.product_promotion = [record('product_promotion', groups.flatMap(g => g.extensibleTableWrapper.columnData), 1, { response: { payload: { data: groups } } })];
  const h = await harness({ records });
  await h.click({ 'data-act': 'page', 'data-page': 'productOperation' });
  await h.click({ 'data-act': 'tab', 'data-tab': 'spyy_hour' });
  assert.match(h.root.innerHTML, /当前表 1 条/);
  assert.match(h.root.innerHTML, />123</);
  assert.doesNotMatch(h.root.innerHTML, />456</);
  await h.click({ 'data-act': 'tab', 'data-tab': 'spyy_tg' });
  assert.match(h.root.innerHTML, /无效单费用/);
  await h.click({ 'data-act': 'archive-promotion', 'data-key': 'jd' });
  assert.match(h.root.innerHTML, /当前表 2 条/);
  assert.match(h.root.innerHTML, /计划名称/);
  assert.match(h.root.innerHTML, /计划甲/);
  assert.match(h.root.innerHTML, /1,663.44/);
  assert.doesNotMatch(h.root.innerHTML, /无效单费用/);
});

test("筛选、字段设置和导出只使用已采行，导出覆盖所有筛选页并防公式执行", async () => {
  const records = fixture();
  const goods = records.shop_goods_page.flatMap(r => r.rows).filter(r => !r.sumLine);
  goods.forEach((r, i) => { r.catePathName = i % 2 ? '甲' : '乙'; r.hasTask = i % 2; });
  goods[1].goodsName = '=HYPERLINK("https://example.test")';
  const h = await harness({ records });
  await h.click({ 'data-act': 'page', 'data-page': 'productOverview' });
  await h.change('archive-category', '甲');
  await h.change('archive-flag', 'hasTask');
  assert.match(h.root.innerHTML, /当前表 85 条/);
  await h.change('archive-column', '', { 'data-key': 'tghf', checked: false });
  assert.doesNotMatch(h.root.innerHTML.match(/<thead>[\s\S]*?<\/thead>/)[0], /data-key="tghf"/);
  await h.click({ 'data-act': 'archive-export' });
  const csv = await h.blobs[0].text();
  assert.equal(csv.split('\r\n').length, 86);
  assert.match(csv, /'=HYPERLINK/);
  assert.equal(h.downloads[0], '2026-10-03-shop_goods_page-sku.csv');
  assert.equal(h.calls.some(c => c.options.method && c.options.method !== 'GET'), false);
});

test("分类卡优先使用核验过的源明细和独立合计，不用取整利润重新判断成员", async () => {
  const records = fixture();
  const goods = records.shop_goods_page[0].rows.slice(1, 4).map((row, i) => ({ ...row, platform: 'JD', profit: i === 0 ? '0' : i === 1 ? '-1' : '1' }));
  records.shop_goods_page = [record('shop_goods_page', goods, 1, { total: 3 })];
  records.shop_cards_sku = [record('shop_cards_sku', [{ id: 519726, count: '2', cardName: '亏损链接', ratio: 2 / 3, calculateRule: JSON.stringify([{ columnKey: 'profit', calculation: 'lt', calculatedValue: 0 }]) }])];
  const cardRecords = {
    'shop_goods_page:519726': [record('shop_goods_page', goods.slice(0, 2), 1, { cardId: '519726', total: 2 })],
    'shop_goods_total:519726': [record('shop_goods_total', [{ sumLine: true, profit: '-1.15' }], 1, { cardId: '519726' })]
  };
  const h = await harness({ records, cardRecords });
  await h.click({ 'data-act': 'page', 'data-page': 'productOverview' });
  await h.click({ 'data-act': 'archive-card', 'data-id': '519726' });
  assert.match(h.root.innerHTML, /当前表 2 条/);
  assert.match(h.root.innerHTML, /汇总：当前分类全部/);
  assert.match(h.root.innerHTML, /-1.15/);
  assert.match(h.root.innerHTML, /data-product-id="90000000000000"/);
  assert.doesNotMatch(h.root.innerHTML, /分类明细待核验|分类明细尚未核验/);
  assert.match(h.root.innerHTML, /66.67%/);
  assert.equal(h.calls.some(c => c.options.method && c.options.method !== 'GET'), false);
});

test("推广图表使用实际花费列，未知数值显示缺失，不转换为零", async () => {
  const records = fixture();
  const groups = [{ promoteKey: 'jd', promoteName: '京东快车', sumCost: 63.44,
    extensibleTableWrapper: { columnInfo: [{ columnKey: 'cost', columnName: '花费' }], columnData: [{ planName: '计划甲', cost: '63.44' }, { planName: '计划乙', cost: '--' }] } }];
  records.product_promotion = [record('product_promotion', groups[0].extensibleTableWrapper.columnData, 1, { response: { payload: { data: groups } } })];
  const h = await harness({ records });
  await h.click({ 'data-act': 'page', 'data-page': 'productOperation' });
  await h.click({ 'data-act': 'tab', 'data-tab': 'spyy_tg' });
  await h.click({ 'data-act': 'chip', 'data-key': 'view', 'data-value': 'chart' });
  assert.match(h.root.innerHTML, /花费 · 当前页记录/);
  assert.match(h.root.innerHTML, /63.44/);
  assert.match(h.root.innerHTML, /计划乙<\/span><i style="width:0%;"><\/i><b>—<\/b>/);
});


test('店铺表头完整保留27列及顺序；过滤、列移动、刷新偏好不会改写采集值', async () => {
  const storage = new Map();
  const shops = record('channel_shop_table', [{ ...scope, gmv: '23181', tghf: '9607', refundRatio: '0.1022', profit: '6395' }]);
  const args = { extras: { channel_shop_table: [shops] }, storage };
  const h = await harness(args);
  await h.click({ 'data-act': 'page', 'data-page': 'channelOverview' });
  const headers = () => [...h.root.innerHTML.match(/<thead>[\s\S]*?<\/thead>/)[0].matchAll(/data-act="sort" data-key="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(headers(), publicCatalog().shopTableColumns.filter(c => !c.defaultHidden).map(c => c.columnKey));
  assert.equal(headers().length, 26); // The user's selected view hides category ranking.
  await h.click({ 'data-act': 'archive-filter', 'data-key': 'refundRatio' });
  await h.change('archive-filter-op', 'gte');
  await h.change('archive-filter-value', '11');
  assert.match(h.root.innerHTML, /没有匹配的记录/);
  assert.match(h.root.innerHTML, /23,181/); // Cards retain shop/date scope.
  await h.change('archive-filter-value', '10');
  assert.match(h.root.innerHTML, /当前表 1 条/);
  await h.click({ 'data-act': 'archive-columns' });
  await h.change('archive-column', '', { 'data-key': 'wyj', checked: false });
  await h.click({ 'data-act': 'archive-column-move', 'data-key': 'gmv', 'data-delta': '-1' });
  assert.ok(headers().indexOf('gmv') < headers().indexOf('ssxse'));
  assert.equal(headers().includes('wyj'), false);
  const reloaded = await harness(args);
  await reloaded.click({ 'data-act': 'page', 'data-page': 'channelOverview' });
  const header = reloaded.root.innerHTML.match(/<thead>[\s\S]*?<\/thead>/)[0];
  assert.doesNotMatch(header, /data-key="wyj"/);
  assert.match(header, /无效单金额\(标注\)/);
  assert.equal(h.calls.some(c => c.options.method === 'POST'), false);
  assert.equal(shops.rows[0].tghf, '9607');
});

test('店铺周期使用独立日报，重复与缺失日留空，CSV与页面保留相同数值', async () => {
  const records = fixture();
  const r = records.channel_operating[0];
  r.response.payload.data = [r.response.payload.data, { columnInfo: columns, columnData: [
    { ...r.rows[0] }, { date: '2026/10/02', gmv: '88', netGmv: '-5' },
    { date: '2026/10/01', gmv: '90' }, { date: '2026/10/01', gmv: '91' },
    { date: '2026/09/30', shopId: 'wrong', gmv: '999999' },
    { date: '2026/08/31', gmv: '888888' }
  ] }];
  const h = await harness({ records, extras: { channel_shop_table: [record('channel_shop_table', [{ ...scope, gmv: '23181' }])] } });
  await h.click({ 'data-act': 'page', 'data-page': 'channelOverview' });
  await h.click({ 'data-act': 'chip', 'data-key': 'view', 'data-value': 'period' });
  assert.match(h.root.innerHTML, /2026\/10\/02/);
  assert.match(h.root.innerHTML, /未采集/);
  assert.doesNotMatch(h.root.innerHTML, /999,999|888,888/);
  await h.click({ 'data-act': 'archive-export' });
  const csv = await h.blobs.at(-1).text();
  assert.match(csv, /2026-10-02.*已采集.*88/);
  assert.match(csv, /2026-10-01.*未采集/);
  assert.doesNotMatch(csv, /999999|888888/);
  assert.equal(h.calls.some(c => c.options.method === 'POST'), false);
});

test('不同表格的表头筛选互不串用，卡片设置可折叠并刷新恢复', async () => {
  const storage = new Map(), h = await harness({ storage });
  await h.click({ 'data-act': 'archive-filter', 'data-key': 'gmv' });
  await h.change('archive-filter-op', 'gt');
  await h.change('archive-filter-value', '50000');
  assert.match(h.root.innerHTML, /没有匹配的记录/);
  await h.click({ 'data-act': 'page', 'data-page': 'productOverview' });
  assert.match(h.root.innerHTML, /当前表 170 条/);
  await h.click({ 'data-act': 'page', 'data-page': 'channelAnalysis' });
  await h.click({ 'data-act': 'archive-card-settings' });
  await h.change('archive-card-visible', '', { 'data-key': 'zdyFyAll', checked: false });
  const reloaded = await harness({ storage });
  assert.doesNotMatch(reloaded.root.innerHTML, /<article><span>自定义费用/);
  await reloaded.click({ 'data-act': 'archive-metrics-fold' });
  assert.doesNotMatch(reloaded.root.innerHTML, /bd-compact-grid/);
});


test('输入筛选值后直接完成也会应用条件，不依赖浏览器先触发change', async () => {
  const h = await harness();
  await h.click({ 'data-act': 'archive-filter', 'data-key': 'gmv' });
  await h.change('archive-filter-op', 'gt');
  await h.input('archive-filter-value', '50000');
  await h.click({ 'data-act': 'archive-filter-close' });
  assert.match(h.root.innerHTML, /没有匹配的记录/);
  assert.match(h.root.innerHTML, /aria-label="筛选支付金额\(支付\)"/);
  await h.click({ 'data-act': 'archive-filter', 'data-key': 'gmv' });
  await h.click({ 'data-act': 'archive-filter-clear' });
  assert.match(h.root.innerHTML, /当前表 1 条/);
});

test('选中项按实体隔离，可跨页筛选导出；切换店铺日期页签清空选择', async () => {
  const h = await harness();
  await h.click({ 'data-act': 'page', 'data-page': 'productOverview' });
  assert.doesNotMatch(h.root.innerHTML, /默认视窗|个人视窗/);
  await h.change('archive-row-select', '', { 'data-id': 'JD:16501691:goods:90000000000000', checked: true });
  await h.click({ 'data-act': 'page-no', 'data-delta': '1' });
  await h.change('archive-row-select', '', { 'data-id': 'JD:16501691:goods:90000000000050', checked: true });
  assert.match(h.root.innerHTML, /已选 2 项/);
  await h.click({ 'data-act': 'archive-export-selected' });
  const csv = await h.blobs.at(-1).text();
  assert.equal(csv.split('\r\n').length, 3);
  assert.match(csv, /商品0/); assert.match(csv, /商品50/);
  await h.click({ 'data-act': 'archive-only-selected' });
  assert.match(h.root.innerHTML, /当前表 2 条/);
  await h.click({ 'data-act': 'page', 'data-page': 'channelAnalysis' });
  await h.click({ 'data-act': 'tab', 'data-tab': 'qdfx_goods' });
  assert.match(h.root.innerHTML, /已选 0 项/);
  assert.match(h.root.innerHTML, /当前表 170 条/);
  assert.equal(h.calls.some(c => c.options.method === 'POST'), false);
});

test('经营趋势补齐缺失日，不把缺日连成连续实测；比例卡保持接口口径', async () => {
  const records = fixture(), r = records.channel_operating[0];
  r.rows[0].refundRatio = '0.1022'; r.rows[0].realTimeGmv = null;
  r.response.payload.data = [r.response.payload.data, { columnInfo: columns, columnData: [
    { date: '2026/10/01', gmv: '99' }, { ...r.rows[0] }
  ] }];
  const h = await harness({ records });
  assert.match(h.root.innerHTML, /10.22%/);
  assert.match(h.root.innerHTML, /2026-10-02<\/td><td>未采集/);
  assert.match(h.root.innerHTML, /实时销售指数<\/span><strong>—/);
  assert.doesNotMatch(h.root.innerHTML, /默认视窗/);
  await h.click({ 'data-act': 'archive-operating-metric', 'data-key': 'netGmv' });
  assert.match(h.root.innerHTML, /netGmv经营趋势/);
  assert.equal(h.calls.some(c => c.options.method === 'POST'), false);
});

test('渠道详情商品周期读取同店原档案并支持周期导出；有效类目不包含未知值', async () => {
  const records = fixture();
  records.shop_goods_page[0].rows[1].catePathName = '电器>清洁';
  const p = records.shop_goods_page[0].rows[1];
  const extra = record('shop_goods_period', [{ ...p, platform: 'JD' }], 1, { trendDays: 7, total: 1, periods: [{ goodsId: p.goodsId, rows: [{ ...p, date: '2026/10/03', netGmv: '70' }] }] });
  const h = await harness({ records, extras: { 'shop_goods_period:7': [extra] } });
  await h.click({ 'data-act': 'tab', 'data-tab': 'qdfx_goods' });
  await h.change('archive-valid-category', '', { checked: true });
  assert.match(h.root.innerHTML, /当前表 1 条/);
  await h.click({ 'data-act': 'chip', 'data-key': 'view', 'data-value': 'period' });
  assert.match(h.root.innerHTML, /data-period-date="2026-10-03"/);
  await h.click({ 'data-act': 'archive-export' });
  assert.match(await h.blobs.at(-1).text(), /2026-10-03.*已采集/);
  assert.equal(h.calls.some(c => c.options.method === 'POST'), false);
});

test('总览在同一页面展示历史渠道和店铺；渠道筛选、店铺钻取保留范围', async () => {
  const accountScope = { ...scope, shopId: '', platform: 'all', shopName: '全部已存店铺', from: scope.date, to: scope.date };
  const savedRecord = (id, rows, names) => record(id, rows, 1, { scope: accountScope, source: {updatedAt: '2026-11-20'}, response: {payload:{data:{columnInfo:names.map(([columnKey,columnName])=>({columnKey,columnName})),columnData:rows}}} });
  const overview = {ok:true,scope:accountScope,records:{
    saved_channels:savedRecord('saved_channels',[{platform:'all',gmv:'840561'},{platform:'JD',gmv:'829241'},{platform:'TM',gmv:'11320'}],[['platform','渠道'],['gmv','支付金额(支付)']]),
    saved_shops:savedRecord('saved_shops',[{...scope,gmv:'23181'},{shopId:'55',platform:'TM',shopName:'天猫店',gmv:'100'}],[['shopName','店铺'],['platform','渠道'],['gmv','支付金额(支付)']])
  }};
  const h = await harness({saved:savedFixture(),overview});
  await h.click({'data-act':'page','data-page':'channelOverview'});
  await h.change('saved-shop','__all__');
  assert.match(h.root.innerHTML,/渠道列表/); assert.match(h.root.innerHTML,/店铺列表/);
  assert.match(h.root.innerHTML,/840,561/); assert.match(h.root.innerHTML,/当前表 2 条/);
  await h.click({'data-act':'archive-channel-filter','data-platform':'JD'});
  assert.match(h.root.innerHTML,/当前表 1 条/);
  assert.match(h.root.innerHTML,/840,561/);
  await h.click({'data-act':'archive-shop-detail','data-platform':'JD','data-shop-id':scope.shopId});
  assert.match(h.root.innerHTML,/23,181/); assert.doesNotMatch(h.root.innerHTML,/840,561/);
  assert.equal(h.calls.some(c=>c.options.method==='POST'),false);
});

test('批量标签和跟进保存可回读、可筛选；日期目标有达成率且不覆盖采集值', async () => {
  const marks = new Map(), h = await harness({ marks });
  await h.click({'data-act':'page','data-page':'productOverview'});
  const id = 'JD:16501691:goods:90000000000000';
  await h.change('archive-row-select','',{'data-id':id,checked:true});
  await h.click({'data-act':'archive-annotation-open','data-field':'tag'});
  await h.input('archive-annotation-value','重点<店>');
  await h.click({'data-act':'archive-annotation-save'});
  assert.match(h.root.innerHTML,/重点&lt;店&gt;/);
  await h.change('archive-tag-filter','重点<店>');
  assert.match(h.root.innerHTML,/当前表 1 条/);
  await h.click({'data-act':'archive-annotation-open','data-field':'follow'});
  await h.input('archive-annotation-value','明天复查费用');
  await h.click({'data-act':'archive-annotation-save'});
  await h.change('archive-flag','follow');
  assert.match(h.root.innerHTML,/当前表 1 条/);
  await h.click({'data-act':'archive-annotation-open','data-field':'target'});
  await h.change('archive-target-metric','gmv');
  await h.input('archive-annotation-value','200');
  await h.click({'data-act':'archive-annotation-save'});
  assert.match(h.root.innerHTML,/达成率 50.00%/);
  const fresh = await harness({marks});
  await fresh.click({'data-act':'page','data-page':'productOverview'});
  assert.match(fresh.root.innerHTML,/重点&lt;店&gt;/);
  assert.match(fresh.root.innerHTML,/明天复查费用/);
  assert.match(fresh.root.innerHTML,/达成率 50.00%/);
  assert.match(fresh.root.innerHTML,/23,181/);
  assert.equal(h.calls.filter(c=>c.options.method==='POST').every(c=>c.url==='/api/bound/shop-day/annotations'),true);
});

test('标注接口不可用时显示状态并禁止保存，不把本地输入冒充已保存',async()=>{
  const h=await harness({annotationFailure:true});
  await h.click({'data-act':'page','data-page':'productOverview'});
  await h.click({'data-act':'archive-select-page'});
  await h.click({'data-act':'archive-annotation-open','data-field':'tag'});
  assert.match(h.root.innerHTML,/标注服务暂不可用/);
  await h.input('archive-annotation-value','未保存标签');
  await h.click({'data-act':'archive-annotation-save'});
  assert.equal(h.calls.some(c=>c.options.method==='POST'),false);
  assert.doesNotMatch(h.root.innerHTML,/bd-annotation-tag">未保存标签/);
});

test('历史分组可以展开店铺，展开不改变分组合计且能收回',async()=>{
  const sc={...scope,shopId:'',platform:'all',shopName:'全部已存店铺',from:scope.date,to:scope.date};
  const row={groupId:'1',shopName:'组A',platform:'all',gmv:'100',shopList:[{...scope,shopName:'组内店铺',gmv:'99'}]};
  const overview={ok:true,scope:sc,records:{saved_groups:record('saved_groups',[row],1,{scope:sc,response:{payload:{data:{columnInfo:[{columnKey:'shopName',columnName:'店铺分组'},{columnKey:'gmv',columnName:'支付金额(支付)'}],columnData:[row]}}}})}};
  const h=await harness({saved:savedFixture(),overview});
  await h.click({'data-act':'page','data-page':'channelOverview'});
  await h.change('saved-shop','__all__');
  await h.click({'data-act':'tab','data-tab':'qdzl_fz'});
  assert.match(h.root.innerHTML,/组A（1 店）/);
  assert.doesNotMatch(h.root.innerHTML,/组内店铺/);
  await h.click({'data-act':'archive-group-toggle','data-key':'1'});
  assert.match(h.root.innerHTML,/组内店铺/);assert.match(h.root.innerHTML,/当前表 1 条/);
  await h.click({'data-act':'archive-group-toggle','data-key':'1'});
  assert.doesNotMatch(h.root.innerHTML,/组内店铺/);
});


test('历史总览经营趋势和店铺周期使用各自原表，7/15天切换与导出不混店',async()=>{
  const accountScope={...scope,shopId:'',platform:'all',shopName:'全部已存店铺',from:scope.date,to:scope.date};
  const cols=[{columnKey:'shopName',columnName:'店铺'},{columnKey:'gmv',columnName:'支付金额(支付)'}];
  const rec=(id,rows)=>record(id,rows,1,{scope:accountScope,source:{},response:{payload:{data:{columnInfo:cols,columnData:rows}}}});
  const current={...scope,gmv:'23181'}, second={platform:'TM',shopId:'55',shopName:'天猫店',gmv:'100'};
  const op=rec('saved_operating',[{platform:'All',date:scope.date,gmv:'840561'}]);
  op.response.payload.data=[op.response.payload.data,{columnInfo:[{columnKey:'gmv',columnName:'支付金额(支付)'}],columnData:[...op.rows,{platform:'All',date:'2026/10/02',gmv:'700000'}]}];
  const overview={ok:true,scope:accountScope,records:{saved_channels:rec('saved_channels',[{platform:'all',gmv:'840561'}]),
    saved_shops:rec('saved_shops',[current,second]),saved_operating:op,
    saved_shop_period:rec('saved_shop_period',[current,{...current,date:'2026-10-02',gmv:'88'},
      {...second,date:scope.date},{...second,date:'2026-10-02',gmv:'99'}])}};
  const h=await harness({saved:savedFixture(),overview});
  await h.click({'data-act':'page','data-page':'channelOverview'});await h.change('saved-shop','__all__');
  await h.click({'data-act':'chip','data-key':'view','data-value':'period'});
  assert.match(h.root.innerHTML,/7天/);assert.match(h.root.innerHTML,/15天/);assert.match(h.root.innerHTML,/天猫店/);
  await h.click({'data-act':'archive-export'});const csv=await h.blobs.at(-1).text();
  assert.match(csv,/RASW.*2026-10-02.*已采集.*88/);assert.match(csv,/天猫店.*2026-10-02.*已采集.*99/);
  assert.match(csv,/2026-10-01.*未采集/);assert.equal(csv.split('\r\n').length,15);
  await h.click({'data-act':'tab','data-tab':'qdzl_jy'});
  assert.match(h.root.innerHTML,/经营趋势/);assert.match(h.root.innerHTML,/700,000/);assert.match(h.root.innerHTML,/840,561/);
  assert.doesNotMatch(h.root.innerHTML,/视窗/);
});
