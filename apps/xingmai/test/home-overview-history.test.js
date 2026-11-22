import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { buildShopOverviewHistory } from "../src/modules/home/live2-overview-history.js";
import { createLive2SalesTrends } from "../src/modules/home/live2-sales-trend.js";

const now = "2026/11/22 16:30:00";
const record = { shop: "A", liveAmount: 100, paidAmount: 20, dealCapturedAt: "2026/11/22 16:20:00", adsCapturedAt: "2026/11/22 16:25:00" };
const sample = (capturedAt, dealAmount, paidAmount, extra = {}) => ({ store: "A", capturedAt, dealAmount, paidAmount, ...extra });
const samples = [sample("2026/11/22 00:20:00", 10, 2), sample("2026/11/22 01:30:00", 0, 0),
  sample("2026/11/22 00:10:00", 8, 1), sample("2026/11/22 16:40:00", 999, 999),
  sample("2026/11/21 16:10:00", 80, 16), sample("2026/11/21 16:28:00", 95, 19),
  sample("2026/11/21 23:50:00", 300, 50), sample("2026/11/22 02:10:00", 999, 999, { ok: false }),
  sample("2026/11/22 03:10:00", 999, 999, { store: "B" })];

test("saved hourly observations preserve midnight, real zeroes and gaps without future or other-shop data", () => {
  const h = buildShopOverviewHistory(record, samples, now);
  assert.equal(h.today.deal[0], 10); assert.equal(h.today.deal[1], 0);
  assert.equal(h.today.deal[2], null); assert.equal(h.today.deal[3], null);
  assert.equal(h.today.deal[16], 100); assert.equal(h.today.spend[16], 20);
  assert.equal(h.today.deal[17], null); assert.equal(h.yesterday.deal[23], 300);
  assert.deepEqual(h.comparison, { deal: 80, spend: 16 });
});

test("midnight rollover never relabels old record amounts as today's readings", () => {
  const h = buildShopOverviewHistory(record, samples, "2026/11/23 00:02:00");
  assert.ok(h.today.deal.every(x => x === null));
  assert.equal(h.yesterday.deal[0], 10); assert.equal(h.comparison.deal, null);
});

test("incomplete metrics do not erase valid observations or fill missing ad history", () => {
  const h = buildShopOverviewHistory({ ...record, paidAmount: null }, [sample("2026/11/22 00:10:00", 5, null), sample("2026/11/22 00:20:00", null, null)], now);
  assert.equal(h.today.deal[0], 5); assert.equal(h.today.spend[0], null);
  assert.equal(h.comparison.spend, null);
});

test("history reads both days once per cache window, and failures remain explicit without breaking live numbers", async () => {
  let reads = 0, tick = 0;
  const enrich = createLive2SalesTrends({ now: () => now, clock: () => tick, listSamples: async (from, to) => {
    reads++; assert.equal(from, "2026-11-21"); assert.equal(to, "2026-11-22");
    return samples;
  } });
  const [a, b] = await Promise.all([enrich([record]), enrich([record])]);
  assert.equal(reads, 1); assert.deepEqual(a, b); assert.equal(a[0].overviewHistory.today.deal[0], 10);
  assert.equal(a[0].salesTrend.today.at(-1).amount, 100);
  assert.ok(a[0].salesTrend.today.every(point => point.second <= 16 * 3600 + 20 * 60), "yesterday's late samples must not enter today's shop hover");
  tick = 30000; await enrich([record]); assert.equal(reads, 2);
  const broken = createLive2SalesTrends({ now: () => now, listSamples: async () => { throw Error("database offline"); } });
  const [row] = await broken([record]); assert.equal(row.liveAmount, 100);
  assert.equal(row.overviewHistory.historyUnavailable, true);
  assert.equal(row.overviewHistory.today.deal[0], null); assert.equal(row.overviewHistory.today.deal[16], 100);
});

const source = fs.readFileSync(new URL("../public/shared/modules/home.js", import.meta.url), "utf8");
function fn(name) {
  const start = source.indexOf("  function " + name + "(");
  assert.ok(start >= 0, name);
  const end = source.indexOf("\n  function ", start + 1);
  return source.slice(start, end < 0 ? source.length : end);
}
function browser(cache = {}) {
  const context = { Intl, Date, window: {}, selected: {}, localStorage: {
    getItem: key => cache[key] || null, setItem() { throw Error("charts must not write browser history"); }
  } };
  vm.createContext(context);
  vm.runInContext(["asNum", "fmtInt", "fmtMoney", "fmtRate", "live2Sums", "trendOf", "live2HistoryTotals", "live2YesterdayTotal", "live2Charts",
    "lineChartOf", "hourX", "compareLineHtml", "escapeHtml", "hourlyRange", "salesTrendMoney", "hourlyCompareTipHtml"].map(fn).join("\n") +
    "\nfunction liveFilter(){return selected;}\n", context);
  return context;
}
const chartRows = [
  { ...record, overviewHistory: buildShopOverviewHistory(record, samples, now) },
  { shop: "B", liveAmount: 900, paidAmount: 180, overviewHistory: buildShopOverviewHistory({ shop: "B", liveAmount: 900, paidAmount: 180,
    capturedAt: "2026/11/22 16:25:00" }, [sample("2026/11/22 01:20:00", 5, 1, { store: "B" })], now) }
];

test("a fresh computer and one with stale browser history draw identical server history", () => {
  const fresh = browser(), old = browser({ "xm-home-live2-yday": JSON.stringify({ today: { jingmaiAt: [999999] } }) });
  const a = fresh.live2Charts(chartRows, chartRows), b = old.live2Charts(chartRows, chartRows);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.equal(a.hero.today[0], 10); assert.equal(a.hero.today[1], 5); assert.equal(a.hero.today[2], null);
  assert.equal(a.hero.coverage.today[0], 1); assert.equal(a.hero.coverage.total, 2);
  assert.equal(a.hero.yestText, "—", "incomplete same-time comparison must not masquerade as a total");
  assert.equal(a.hero.delta, "");
  const text = fresh.hourlyCompareTipHtml(0, null, 10, { coverage: a.hero.coverage });
  assert.match(text, /今天已采集 1\/2 家/);
});

test("team or single-shop history sums the selected shops' actual readings instead of scaling company totals", () => {
  const ctx = browser(); ctx.selected = { shop: "B" };
  const chart = ctx.live2Charts(chartRows, [chartRows[1]]);
  assert.equal(chart.hero.today[0], null); assert.equal(chart.hero.today[1], 5);
  assert.equal(chart.hero.today[16], 900); assert.equal(chart.hero.coverage.total, 1);
  const totals = ctx.live2HistoryTotals([{ overviewHistory: { today: { deal: [10, 0], spend: [null, 1] } } },
    { overviewHistory: { today: { deal: [null, 10], spend: [5, 1] } } }], "today");
  assert.equal(totals.fee[0], null, "fee must compare the same shops");
  assert.equal(totals.fee[1], 0.2);
});

test("chart and hover use identical cumulative values, real zeroes and gaps without invented connecting lines", () => {
  const ctx = browser(); const chart = { serverHistory: true, yesterday: [], today: [0, 10, null, 20, 25] };
  const line = ctx.lineChartOf(chart), html = ctx.compareLineHtml(line);
  assert.equal(JSON.stringify(line.today), JSON.stringify(chart.today));
  assert.equal((html.match(/<polyline/g) || []).length, 2);
  assert.doesNotMatch(html, /NaN/);
  const legacy = ctx.compareLineHtml({ yesterday: [1, 2], today: [2, 3] });
  assert.match(legacy, /stroke="#91caff"/); assert.match(legacy, /stroke="#ffa39e"/);
  assert.equal((legacy.match(/<polyline/g) || []).length, 2);
  assert.doesNotThrow(() => ctx.compareLineHtml());
});

test("unavailable history is explicit while the current total is still usable", () => {
  const ctx = browser();
  const chart = ctx.live2Charts([{ ...record, overviewHistory: { ...buildShopOverviewHistory(record, [], now), historyUnavailable: true } }]);
  assert.equal(chart.hero.value, "100");
  assert.equal(chart.hero.historyUnavailable, true);
  assert.equal(chart.hero.today[0], null);
});
