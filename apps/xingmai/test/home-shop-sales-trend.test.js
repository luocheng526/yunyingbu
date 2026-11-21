import "./_memory-env.js";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { buildShopSalesTrend, createLive2SalesTrends } from "../src/modules/home/live2-sales-trend.js";
import { createLive2Collector } from "../src/modules/home/live2-collect.js";

const now = "2026/11/21 14:32:00";
const record = { shop: "A店", liveAmount: 200, dealCapturedAt: now };
const sample = (day, time, dealAmount, extra = {}) => ({ store: "A店", capturedAt: `${day} ${time}:00`, dealAmount, ok: true, ...extra });
const yesterday = (time, value, extra) => sample("2026-11-20", time, value, extra);

test("comparison uses unrounded same-shop amounts at or before the actual collection time", () => {
  const result = buildShopSalesTrend(record, [yesterday("14:30", 100), yesterday("14:40", 1000), yesterday("23:59", 9999),
    yesterday("14:31", 8888, { store: "B店" }), yesterday("14:32", 5555, { ok: false })], now);
  assert.equal(result.change, 100);
  assert.equal(result.yesterdayAmount, 100);
  assert.equal(result.yesterdaySecond, 14 * 3600 + 30 * 60);
  assert.equal(result.today.at(-1).amount, 200);
  assert.equal(result.yesterday.at(-1).amount, 9999);
  assert.equal(result.yesterday.some(p => p.amount === 8888 || p.amount === 5555), false);
  assert.equal(buildShopSalesTrend({ ...record, liveAmount: 28.01 }, [yesterday("14:30", 14.01)], now).change, (28.01 - 14.01) / 14.01 * 100);
});

test("missing, old, zero, and negative comparisons never fabricate a percentage", () => {
  assert.equal(buildShopSalesTrend(record, [], now).status, "no-baseline");
  assert.equal(buildShopSalesTrend(record, [yesterday("13:00", 100)], now).change, null);
  assert.equal(buildShopSalesTrend(record, [yesterday("14:30", null)], now).yesterdayAmount, null);
  assert.equal(buildShopSalesTrend(record, [yesterday("14:30", 0)], now).status, "zero-baseline");
  assert.equal(buildShopSalesTrend({ ...record, liveAmount: 0 }, [yesterday("14:30", 0)], now).change, 0);
  assert.equal(buildShopSalesTrend({ ...record, liveAmount: 0 }, [yesterday("14:30", 100)], now).change, -100);
  assert.equal(buildShopSalesTrend({ ...record, liveAmount: null }, [yesterday("14:30", 100)], now).status, "no-current");
  assert.equal(buildShopSalesTrend({ ...record, dealCapturedAt: "2026/11/20 14:32:00" }, [], now).todayAmount, null);
});

test("Shanghai midnight uses the previous calendar day and keeps observed gaps", () => {
  const stamp = "2026/12/01 00:10:00";
  const result = buildShopSalesTrend({ ...record, dealCapturedAt: stamp }, [sample("2026-11-30", "00:05", 50),
    sample("2026-11-30", "00:10", 500, { capturedAt: new Date("2026-11-29T16:10:00Z") }),
    sample("2026-11-30", "03:00", 800), sample("2026-12-01", "01:00", 1000)], stamp);
  assert.equal(result.yesterdayDate, "2026-11-30");
  assert.equal(result.yesterdayAmount, 500);
  assert.deepEqual(result.today, [{ second: 600, amount: 200 }]);
  assert.ok(result.yesterday.every(p => p.second > 0));
});

test("shared history cache coalesces concurrent reads, expires, and degrades without losing live values", async () => {
  let reads = 0, clock = 0, fail = false, stamp = now;
  const enrich = createLive2SalesTrends({ now: () => stamp, clock: () => clock, listSamples: async (from, to) => {
    reads++; assert.equal(from, stamp.includes("/22") ? "2026-11-21" : "2026-11-20");
    assert.ok(to > from); if (fail) throw new Error("DB unavailable"); return [yesterday("14:30", 100)];
  } });
  const results = await Promise.all([enrich([record]), enrich([record])]);
  assert.equal(reads, 1); assert.equal(results[0][0].salesTrend.change, 100);
  await enrich([record]); assert.equal(reads, 1);
  clock = 30001; fail = true;
  const failed = await enrich([record]);
  assert.equal(failed[0].liveAmount, 200); assert.equal(failed[0].salesTrend.status, "unavailable");
  fail = false; stamp = "2026/11/22 00:10:00";
  await enrich([record]); assert.equal(reads, 3);
});

test("board exposes trends only for the authorized roster and never starts collection", async () => {
  const collector = createLive2Collector({ now: () => now, storePath: "", published: [record],
    loadOrg: async cookie => { assert.equal(cookie, "authorized"); return [{ store: "A店" }]; },
    listSamples: async () => [yesterday("14:30", 100), yesterday("14:30", 800, { store: "hidden shop" })],
    client: { login: () => assert.fail("read must not login"), fetchHome: () => assert.fail("read must not collect") }
  });
  const board = await collector.board("authorized");
  assert.equal(board.records.length, 1); assert.equal(board.records[0].salesTrend.change, 100);
  assert.equal(JSON.stringify(board).includes("hidden shop"), false);
});

test("frontend renders safe shop names, red/green comparisons, and disconnected missing periods", () => {
  let source = fs.readFileSync(new URL("../public/shared/modules/home.js", import.meta.url), "utf8");
  source = source.replace('  window.XmModules = window.XmModules || {};', '  window.testSales = { salesTrendDelta, live2SalesCellHtml, shopSalesTipHtml, salesTrendSvg };\n  window.XmModules = window.XmModules || {};');
  const context = { window: {}, localStorage: { getItem: () => null }, document: {} };
  vm.runInNewContext(source, context);
  const f = context.window.testSales;
  const trend = buildShopSalesTrend(record, [yesterday("08:00", 10), yesterday("14:30", 100)], now);
  const html = f.shopSalesTipHtml({ ...record, shop: '<img onerror="evil">', salesTrend: trend });
  assert.ok(!html.includes('<img')); assert.ok(html.includes("&lt;img"));
  assert.match(html, /¥200\.00/); assert.match(html, /↑100\.00%/);
  assert.equal(f.salesTrendDelta({ status: "ok", change: -25 }).cls, " is-down");
  assert.match(f.live2SalesCellHtml({ ...record, salesTrend: trend }), /data-shop-sales="A店"/);
  assert.equal((f.salesTrendSvg(trend).match(/<polyline/g) || []).length, 3);
  assert.match(f.salesTrendSvg({ today: [], yesterday: [] }), /暂无成交趋势数据/);
});
