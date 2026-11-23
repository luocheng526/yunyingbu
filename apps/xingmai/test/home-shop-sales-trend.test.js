import "./_memory-env.js";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { buildShopSalesTrend, createLive2SalesTrends, jingmaiSalesCompare } from "../src/modules/home/live2-sales-trend.js";
import { createLive2Collector } from "../src/modules/home/live2-collect.js";
import { live2RecordFromMetrics } from "../src/modules/home/live2.js";
import { extractShopDeal, parseHomeCard } from "../src/modules/home/jingmai.js";

const now = "2026/11/21 14:32:00";
const record = { shop: "A店", liveAmount: 13000, dealRate: 30, dealCapturedAt: now };
const sample = (time, dealAmount, dealRate, extra = {}) => ({ store: "A店", capturedAt: `2026-11-21 ${time}:00`, dealAmount, dealRate, ok: true, ...extra });

test("13000 and Jingmai +30% derive 10000 with no yesterday collection", () => {
  const result = buildShopSalesTrend(record, [], now);
  assert.equal(result.change, 30); assert.equal(result.yesterdayAmount, 10000);
  assert.equal(result.status, "ok"); assert.equal(result.yesterdayEstimated, true);
  assert.equal(result.yesterdaySecond, result.comparedSecond);
  assert.deepEqual(result.yesterday, [{ second: 52320, amount: 10000 }]);
  const conflict = buildShopSalesTrend(record, [sample("14:32", 500, 0, { capturedAt: "2026-11-20 14:32:00" })], now);
  assert.equal(conflict.yesterdayAmount, 10000, "yesterday snapshots cannot override the platform");
  assert.equal(jingmaiSalesCompare(13000, { dealRate: 30, yesterdayAmount: 9000 }).yesterday, 10000);
});

test("each blue point uses its own observation's rate, never today's final rate", () => {
  const result = buildShopSalesTrend(record, [sample("08:00", 1100, 10), sample("10:00", 3000, -40), sample("12:00", 7500, 50),
    sample("15:00", 15000, 30), sample("09:00", 9999, 0, { store: "B店" }), sample("11:00", 9999, 0, { ok: false })], now);
  assert.deepEqual(result.yesterday.map(p => p.amount), [1100 / 1.1, 5000, 5000, 10000]);
  assert.ok(result.today.every(p => p.second <= 52320)); assert.equal(result.today.length, 4);
});

test("screenshot 2724 and -34.60% retain platform precision and signs", () => {
  const metrics = extractShopDeal({ code: 200, data: { modules: [{ moduleCode: "deal", indicators: [
    { code: "OrdAmt", value: "¥2,724.00", rate: "-34.60%" }, { code: "OrdNum", value: "8", rate: "-38.46%" }, { code: "OrdCustNum", value: "8", rate: "-38.46%" }
  ] }] } });
  const row = live2RecordFromMetrics({ store: "A店" }, metrics, now);
  const trend = buildShopSalesTrend(row, [], now);
  assert.equal(row.dealRate, -34.6); assert.equal(trend.change, -34.6); assert.equal(trend.yesterdayAmount.toFixed(2), "4165.14");
  assert.equal(buildShopSalesTrend({ ...record, dealRate: 0.11 }, [], now).change, 0.11, "normalized small percentages are not multiplied again");
  const card = parseHomeCard("经营数据\n成交金额\n¥13,000.00\n较昨日 +30.00%\n成交单量\n8\n成交客户数\n8");
  assert.equal(buildShopSalesTrend(live2RecordFromMetrics({ store: "A店" }, card, now), [], now).yesterdayAmount, 10000);
});

test("old snapshots recover comparisons only from the exact same saved reading", () => {
  const legacy = { ...record }; delete legacy.dealRate;
  assert.equal(buildShopSalesTrend(legacy, [sample("14:32", 13000, 30)], now).yesterdayAmount, 10000);
  for (const rows of [[sample("14:31", 13000, 30)], [sample("14:32", 9999, 30)], [sample("14:32", 13000, 30, { store: "B店" })]]) {
    const trend = buildShopSalesTrend(legacy, rows, now);
    assert.equal(trend.change, null); assert.equal(trend.status, "no-platform-compare");
  }
});

test("missing platform data, zero bases and -100% stay truthful and finite", () => {
  assert.equal(jingmaiSalesCompare(100, {}).status, "no-platform-compare");
  assert.equal(jingmaiSalesCompare(100, { yesterdayAmount: 0 }).status, "zero-baseline");
  assert.equal(jingmaiSalesCompare(0, { dealRate: 0 }).yesterday, 0);
  assert.equal(jingmaiSalesCompare(0, { dealRate: -100 }).change, -100);
  assert.equal(jingmaiSalesCompare(0, { dealRate: -100 }).yesterday, null);
  assert.equal(jingmaiSalesCompare(0, { dealRate: -100, yesterdayAmount: 999 }).yesterday, 999);
  assert.equal(jingmaiSalesCompare(100, { dealRate: -100 }).status, "invalid-platform-compare");
  assert.equal(jingmaiSalesCompare(100, { dealRate: -101 }).status, "invalid-platform-compare");
  assert.equal(jingmaiSalesCompare(100, { dealRate: Infinity }).status, "no-platform-compare");
  assert.equal(jingmaiSalesCompare(100, { yesterdayAmount: 200 }).change, -50);
  assert.equal(buildShopSalesTrend({ ...record, liveAmount: null }, [], now).status, "no-current");
  assert.equal(buildShopSalesTrend({ ...record, dealCapturedAt: "2026/11/20 14:32:00" }, [], now).todayAmount, null);
});

test("Shanghai midnight and Date timestamps keep today's pairs on the right date", () => {
  const stamp = "2026/12/01 00:10:00";
  const result = buildShopSalesTrend({ ...record, dealCapturedAt: stamp }, [sample("00:05", 500, -50, { capturedAt: new Date("2026-11-30T16:05:00Z") }),
    sample("01:00", 9999, 0, { capturedAt: "2026-12-01 01:00:00" }), sample("00:05", 9999, 0, { capturedAt: "2026-11-30 00:05:00" })], stamp);
  assert.equal(result.yesterdayDate, "2026-11-30");
  assert.deepEqual(result.today, [{ second: 300, amount: 500 }, { second: 600, amount: 13000 }]);
  assert.deepEqual(result.yesterday, [{ second: 300, amount: 1000 }, { second: 600, amount: 10000 }]);
});

test("cache loads yesterday and today and history failure preserves current platform comparison", async () => {
  let reads = 0, clock = 0, fail = false, stamp = now;
  const enrich = createLive2SalesTrends({ now: () => stamp, clock: () => clock, listSamples: async (from, to) => {
    reads++; assert.equal(to, stamp.includes("/22") ? "2026-11-22" : "2026-11-21");
    assert.equal(from, stamp.includes("/22") ? "2026-11-21" : "2026-11-20");
    if (fail) throw new Error("DB unavailable"); return [sample("12:00", 1000, 25)];
  } });
  const results = await Promise.all([enrich([record]), enrich([record])]);
  assert.equal(reads, 1); assert.equal(results[0][0].salesTrend.change, 30);
  await enrich([record]); assert.equal(reads, 1);
  clock = 30001; fail = true;
  const failed = await enrich([record]);
  assert.equal(failed[0].salesTrend.yesterdayAmount, 10000);
  assert.equal(failed[0].salesTrend.status, "ok"); assert.equal(failed[0].salesTrend.historyUnavailable, true);
  fail = false; stamp = "2026/11/22 00:10:00";
  await enrich([record]); assert.equal(reads, 3);
});

test("board exposes only roster shops without starting collection", async () => {
  const collector = createLive2Collector({ now: () => now, storePath: "", published: [record],
    loadOrg: async cookie => { assert.equal(cookie, "authorized"); return [{ store: "A店" }]; },
    listSamples: async () => [sample("12:00", 100, 20), sample("12:00", 800, 30, { store: "hidden shop" })],
    client: { login: () => assert.fail("read must not login"), fetchHome: () => assert.fail("read must not collect") }
  });
  const board = await collector.board("authorized");
  assert.equal(board.records.length, 1); assert.equal(board.records[0].salesTrend.change, 30);
  assert.equal(JSON.stringify(board).includes("hidden shop"), false);
});

test("collection and sample recovery retain platform comparison through partial ad failure", async () => {
  let task; const saved = [];
  const deps = { now: () => now, storePath: "", ensureSession: async () => null, claimOwner: async () => ({ ok: true }),
    loadOrg: async () => [{ store: "A店", login: "fixture", password: "fixture" }], listSessions: async () => [],
    listSamples: async () => saved, saveSample: async row => { saved.push(row); return { saved: true }; }, track: value => { task = value; },
    client: { login: async () => [{ name: "thor", value: "fixture" }], fetchHome: async (_jar, _signal, options) => {
      const metrics = { dealAmount: 13000, dealRate: 30, dealRateLabel: "较昨日", platformUpdatedAt: now, paidNote: "广告暂不可用" };
      await options.onDeal(metrics); return metrics;
    } }
  };
  const collector = createLive2Collector(deps);
  await collector.start("fixture"); await task;
  const board = await collector.board("fixture");
  assert.equal(board.records[0].dealRate, 30); assert.equal(board.records[0].salesTrend.yesterdayAmount, 10000);
  assert.equal(board.records[0].adsFailed, true); assert.equal(saved[0].dealRate, 30);
  const recovered = createLive2Collector({ ...deps, client: { ...deps.client, fetchHome: async () => { throw new Error("offline"); } } });
  await recovered.start("fixture"); await task;
  const after = await recovered.board("fixture");
  assert.equal(after.records[0].dealRate, 30); assert.equal(after.records[0].salesTrend.yesterdayAmount, 10000);
});

test("frontend shows platform percentage, estimated baseline, escaped names and missing-platform states", () => {
  let source = fs.readFileSync(new URL("../public/shared/modules/home.js", import.meta.url), "utf8");
  source = source.replace('  window.XmModules = window.XmModules || {};', '  window.testSales = { salesTrendDelta, live2SalesCellHtml, shopSalesTipHtml, salesTrendSvg };\n  window.XmModules = window.XmModules || {};');
  const context = { window: {}, localStorage: { getItem: () => null }, document: {} };
  vm.runInNewContext(source, context); const f = context.window.testSales;
  const trend = buildShopSalesTrend(record, [sample("08:00", 100, 0), sample("14:32", 13000, 30)], now);
  const html = f.shopSalesTipHtml({ ...record, shop: '<img onerror="evil">', salesTrend: trend });
  assert.ok(!html.includes('<img')); assert.ok(html.includes("&lt;img"));
  assert.match(html, /¥13,000\.00/); assert.match(html, /↑30\.00%/); assert.match(html, /≈ ¥10,000\.00/); assert.match(html, /京麦较昨日/);
  assert.equal(f.salesTrendDelta({ status: "rate-only", change: -100 }).text, "↓100.00%");
  assert.equal(f.salesTrendDelta({ status: "no-platform-compare" }).text, "京麦未返回对比");
  assert.match(f.live2SalesCellHtml({ ...record, salesTrend: trend }), /data-shop-sales="A店"/);
  assert.equal((f.salesTrendSvg(trend).match(/<polyline/g) || []).length, 4);
  assert.match(f.salesTrendSvg({ today: [], yesterday: [] }), /暂无成交趋势数据/);
});
