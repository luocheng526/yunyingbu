import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { buildShopOverviewHistory } from "../src/modules/home/live2-overview-history.js";
import { createLive2SalesTrends } from "../src/modules/home/live2-sales-trend.js";

const stamp = "2026/11/23 10:35:00";
const record = { shop: "A", liveAmount: 200, paidAmount: 40, capturedAt: stamp };
const sample = (time, dealAmount, paidAmount, extra = {}) => ({ store: "A", capturedAt: `2026-11-22 ${time}`, dealAmount, paidAmount, ok: true, ...extra });
const source = fs.readFileSync(new URL("../public/shared/modules/home.js", import.meta.url), "utf8");
function frontend(filter = {}) {
  const context = { window: {}, document: {}, localStorage: { getItem: () => JSON.stringify(filter) } };
  vm.runInNewContext(source.replace("  window.XmModules = window.XmModules || {};",
    "  window.testCompare = { live2Charts, liveChartHtml, live2HistorySignature };\n  window.XmModules = window.XmModules || {};"), context);
  return context.window.testCompare;
}
const row = (shop, liveAmount, paidAmount, deal, spend, extra = {}) => ({ shop, liveAmount, paidAmount,
  overviewHistory: { comparison: { deal, spend }, today: {}, yesterday: {}, ...extra } });

test("yesterday gaps keep the latest earlier observation and expose its age", () => {
  const h = buildShopOverviewHistory(record, [sample("09:00:00", 30, 10), sample("10:00:00", 100, 25),
    sample("10:36:00", 999, 999), sample("23:59:00", 9999, 9999)], stamp);
  assert.deepEqual(h.comparison, { deal: 100, spend: 25 });
  assert.deepEqual(h.comparisonAgeSeconds, { deal: 2100, spend: 2100 });
  assert.equal(h.yesterday.deal[23], 9999, "full-day chart remains separate from the header comparison");
});

test("fresh points replace older ones independently for each metric; zero is real data", () => {
  const h = buildShopOverviewHistory(record, [sample("10:00:00", 100, 25), sample("10:30:00", 0, null),
    sample("10:31:00", 999, 999, { ok: false }), sample("10:32:00", 888, 888, { store: "B" })], stamp);
  assert.deepEqual(h.comparison, { deal: 0, spend: 25 });
  assert.deepEqual(h.comparisonAgeSeconds, { deal: 300, spend: 2100 });
});

test("each metric uses its own capture time and never a future or wrong-day baseline", () => {
  const h = buildShopOverviewHistory({ ...record, dealCapturedAt: "2026/11/23 09:20:00" },
    [sample("09:00:00", 30, 10), sample("10:00:00", 100, 25)], stamp);
  assert.deepEqual(h.comparison, { deal: 30, spend: 25 });
  assert.equal(buildShopOverviewHistory(record, [sample("10:36:00", 999, 999)], stamp).comparison.deal, null);
  assert.equal(buildShopOverviewHistory({ ...record, capturedAt: "2026/11/22 10:35:00" }, [sample("10:00:00", 100, 25)], stamp).comparison.deal, null);
  const midnight = buildShopOverviewHistory({ ...record, capturedAt: "2026/12/01 00:10:00" },
    [sample("00:05:00", 20, 5, { capturedAt: new Date("2026-11-29T16:05:00Z") })], "2026/12/01 00:10:00");
  assert.equal(midnight.yesterdayDate, "2026-11-30"); assert.equal(midnight.comparison.deal, 20);
});

test("partial shop coverage retains totals and compares the same shops on both sides", () => {
  const f = frontend(), rows = [row("A", 200, 40, 100, 10), row("B", 800, 160, null, 80)];
  const cards = f.live2Charts(rows, rows);
  assert.equal(cards.hero.value, "1,000"); assert.equal(cards.hero.yestText, "100"); assert.equal(cards.hero.delta, 100);
  assert.equal(cards.hero.comparisonCoverage.count, 1); assert.equal(cards.hero.comparisonCoverage.total, 2);
  assert.equal(cards.paid.yestText, "90"); assert.ok(Math.abs(cards.paid.delta - 122.2222222) < 0.0001);
  assert.equal(cards.fee.yestText, "10%"); assert.equal(cards.fee.delta, 100);
  assert.match(f.liveChartHtml(cards.hero, true), /1\/2家/);
  assert.match(f.liveChartHtml(cards.hero, true), /相同1家店铺计算，今日 200/);
  assert.doesNotMatch(f.liveChartHtml(cards.hero, true), /环比 —/);
});

test("fee comparison requires the intersection of both metrics, never mismatched shop sets", () => {
  const f = frontend(), rows = [row("A", 200, 40, 100, null), row("B", 800, 160, null, 80), row("C", 100, 30, 200, 20)];
  const cards = f.live2Charts(rows, rows);
  assert.equal(cards.fee.yestText, "10%"); assert.ok(Math.abs(cards.fee.delta - 200) < 0.0001);
  assert.equal(cards.fee.comparisonCoverage.count, 1);
});

test("older references are clearly labelled; pending shops and filtered-out shops are excluded", () => {
  const f = frontend({ shop: "A" });
  const a = row("A", 200, 40, 100, 25, { comparisonAgeSeconds: { deal: 2100, spend: 300 } });
  const cards = f.live2Charts([a, row("B", 1000, 100, 1, 1)], [a]);
  assert.equal(cards.hero.value, "200"); assert.equal(cards.hero.yestLabel, "昨日参考");
  assert.match(f.liveChartHtml(cards.hero, true), /参考环比/);
  assert.match(cards.hero.comparisonNote, /提前35分钟/); assert.equal(cards.paid.yestLabel, "昨日同段");
  const pending = frontend().live2Charts([a, { ...row("B", 1000, 100, 1, 1), pendingCollect: true }], []);
  assert.equal(pending.hero.value, "200"); assert.equal(pending.hero.comparisonCoverage.total, 1);
});

test("zero and absent baselines never fabricate a percentage or produce Infinity", () => {
  const f = frontend();
  const positive = f.live2Charts([row("A", 200, 40, 0, 0)], []).hero;
  assert.equal(positive.yestText, "0"); assert.match(f.liveChartHtml(positive, true), /环比 昨日为0/);
  const zero = f.live2Charts([row("A", 0, 0, 0, 0)], []).hero;
  assert.equal(zero.delta, 0); assert.match(f.liveChartHtml(zero, true), /环比 0%/);
  const missing = f.live2Charts([row("A", 200, 40, null, null)], []).hero;
  assert.equal(missing.yestText, "待采集"); assert.equal(missing.delta, "");
  assert.match(f.liveChartHtml(missing, true), /等待昨日可比数据/);
  const noDeal = f.live2Charts([row("A", 0, 10, 0, 5)], []).fee;
  assert.equal(noDeal.yestText, "无成交");
  assert.match(f.liveChartHtml(noDeal, true), /今日无成交，暂无法计算/);
});

test("transient history errors preserve saved observations, recover, and never reuse another day's cache", async () => {
  let time = 0, fail = false, now = stamp, reads = 0;
  const enrich = createLive2SalesTrends({ now: () => now, clock: () => time, listSamples: async (from, to) => {
    reads++; assert.equal(to, now.slice(0, 10).replaceAll("/", "-")); assert.notEqual(from, to);
    if (fail) throw new Error("temporary");
    return [sample("10:30:00", reads === 1 ? 100 : 120, 25)];
  } });
  const first = await enrich([record]); assert.equal(first[0].overviewHistory.comparison.deal, 100);
  time = 30001; fail = true;
  const cached = await enrich([record]); assert.equal(cached[0].overviewHistory.comparison.deal, 100);
  assert.equal(cached[0].overviewHistory.historyCached, true);
  assert.match(frontend().live2Charts(cached, []).hero.comparisonNote, /沿用已读取记录/);
  fail = false;
  const fresh = await enrich([record]); assert.equal(fresh[0].overviewHistory.comparison.deal, 120);
  assert.equal(fresh[0].overviewHistory.historyUnavailable, undefined);
  now = "2026/11/24 00:05:00"; fail = true;
  const next = await enrich([{ ...record, capturedAt: now }]);
  assert.equal(next[0].overviewHistory.comparison.deal, null); assert.equal(next[0].overviewHistory.historyCached, false);
});

test("history-only changes are visible even when the collection timestamp has not changed", () => {
  const f = frontend(), a = { publishedAt: stamp, running: false, records: [row("A", 200, 40, null, null)] };
  const b = { ...a, records: [row("A", 200, 40, 100, 25)] };
  assert.notEqual(f.live2HistorySignature(a), f.live2HistorySignature(b));
  assert.equal(f.live2HistorySignature(a), f.live2HistorySignature(JSON.parse(JSON.stringify(a))));
});
