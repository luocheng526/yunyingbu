import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chinaDay, registrationDay, parseWpsReport, applyWpsPack, readWpsStore } from "../src/modules/home/week-wps.js";
import { readSource, syncWpsOnce } from "../src/modules/home/week-wps-sync.js";
import { buildGrandSummary, sumReportCells } from "../src/modules/home/week-totals.js";

const today = "2026-11-23";
const visibility = { mode: "export-metadata", verified: true, headerRow: 1, columns: [4, 6, 350, 589], rows: [2, 3, 4, 5] };
const cell = (r, c, text) => ({ rowFrom: r, colFrom: c, cellText: text });
const cells = [cell(1, 4, "所属人"), cell(1, 6, "店铺"), cell(1, 350, "11.22"), cell(1, 589, "登记日期"),
  cell(2, 4, "张三"), cell(2, 6, "店铺A"), cell(2, 350, "0"), cell(2, 589, "11.23"),
  cell(3, 6, "店铺B"), cell(3, 350, "900"), cell(3, 589, "11.22"),
  cell(4, 6, "店铺C"), cell(4, 589, "11.23"),
  cell(5, 6, "团队合计"), cell(5, 350, "900"), cell(5, 589, "11.23"),
  cell(6, 6, "隐藏店铺"), cell(6, 350, "99999"), cell(6, 589, "11.23"),
  cell(1, 349, "11.21"), cell(2, 349, "99999")];
const parse = (patch = {}) => parseWpsReport({ cells, visibility, today, team: "shen", sheetName: "近七天业绩", ...patch });
const base = { teams: [{ key: "han" }, { key: "shen" }], dingReady: true };

test("Shanghai day and registration dates are strict, including leap dates", () => {
  assert.equal(chinaDay(new Date("2026-11-22T16:01:00Z")), today);
  for (const d of ["11.23", "11/23", "2026-11-23", "2026年11月23日"]) assert.equal(registrationDay(d, today), today);
  assert.equal(registrationDay("2025-11-23", today), "2025-11-23");
  assert.equal(registrationDay("2.30", today), null);
  assert.equal(registrationDay("2.29", today), null);
  assert.equal(registrationDay("2024.2.29", today), "2024-02-29");
  assert.equal(registrationDay("11.2301", today), null);
});

test("only visible shops registered today enter data, zero stays zero, totals never duplicate", () => {
  const p = parse();
  assert.deepEqual(p.rows.map(r => r.shop), ["店铺A", "店铺C"]);
  assert.equal(p.rows[0].cells.gmv_2026_11_22, undefined);
  assert.equal(p.rows[0].cells["gmv_2026-11-22"], "0");
  assert.equal(p.rows[1].cells["gmv_2026-11-22"], "");
  assert.equal(p.columns.some(c => c.sourceCol === 349), false);
  assert.equal(p.counts.expected, 3);
  assert.equal(p.pending[0].shop, "店铺B");
  assert.equal(p.complete, false);
  assert.equal(p.businessDate, "2026-11-22");
  assert.equal(parse().fingerprint, p.fingerprint);
});

test("missing visibility, duplicate stores, changed headers fail closed", () => {
  assert.throws(() => parse({ visibility: null }), /可见/);
  assert.throws(() => parse({ cells: cells.filter(c => c.colFrom !== 589) }), /表头/);
  assert.throws(() => parse({ cells: [...cells, cell(4, 6, "店铺A")] }), /重复店铺/);
});

test("registration is the last report column; left source summary retains exact display values", () => {
  const p = parse({ visibility: { ...visibility, columns: [0, 1, ...visibility.columns, 596, 601],
    summary: { labelColumn: 0, valueColumn: 1, rows: [2, 3] } },
    cells: [...cells, cell(2, 0, "组业绩："), cell(2, 1, "283663"), cell(3, 0, "转化率"), cell(3, 1, "4.09%"),
      cell(1, 596, "店铺星级"), cell(2, 596, "3.5"), cell(1, 601, "保险截图"), { ...cell(2, 601, ""), isCellPic: true }] });
  assert.equal(p.columns.at(-1).key, "register");
  assert.equal(p.rows[0].cells.stars, undefined);
  assert.equal(p.issues.length, 0);
  assert.deepEqual(p.sourceSummary.map(s => s.value), ["283663", "4.09%"]);
  assert.equal(p.rows[0].cells["gmv_2026-11-22"], "0");
});

test("December metric dates cross year while registration remains January", () => {
  const p = parse({ today: "2027-01-01", cells: [cell(1, 6, "店铺"), cell(1, 350, "12.31"), cell(1, 589, "登记日期"), cell(2, 6, "店铺A"), cell(2, 589, "1.1")] });
  assert.equal(p.businessDate, "2026-12-31");
  assert.equal(p.rows.length, 1);
});

test("both teams must finish; stale snapshots/images block readiness; source formula errors stay visible", () => {
  const one = parse({ visibility: { ...visibility, rows: [2] } });
  const state = { expectedTeams: ["shen", "han"], teams: { shen: one } };
  assert.equal(applyWpsPack(base, state, today).readyToSend, false);
  state.teams.han = { ...one, team: "han" };
  assert.equal(applyWpsPack(base, state, today).readyToSend, false);
  state.teams.han.sourceGroups = {
    noclean: { available: true, cells: { "gmv_2026-11-22": "0" } },
    clean: { available: true, cells: { "gmv_2026-11-22": "0" } }
  };
  const both = applyWpsPack(base, state, today);
  assert.equal(both.readyToSend, true);
  assert.equal(both.teams[0].rows.length, 1);
  assert.equal(both.teams[1].foot[0].cells["gmv_2026-11-22"], 0);
  assert.equal(applyWpsPack(base, state, "2026-11-24").teams[1].rows.length, 0);
  assert.equal(applyWpsPack(base, state, "2026-11-24").readyToSend, false);
  assert.equal(parse({ visibility: { ...visibility, rows: [2], verified: false } }).complete, false);
  const bad = parse({ visibility: { ...visibility, rows: [2] }, cells: [...cells, cell(2, 350, "#DIV/0!")] });
  assert.equal(bad.complete, true);
  assert.equal(bad.issues[0].kind, "formula");
  assert.equal(parse({ cells: [...cells, { ...cell(2, 350, ""), isCellPic: true }] }).issues[0].kind, "image");
});

test("source category totals are separate from shop rows; empty is different from zero", () => {
  const p = parse({ visibility: { ...visibility, footerRows: [27, 28] }, cells: [...cells,
    cell(27, 6, "无清洁统计"), cell(27, 350, "0"), cell(28, 6, "清洁店铺") ] });
  assert.equal(p.rows.length, 2);
  assert.equal(p.counts.expected, 3);
  assert.equal(p.sourceGroups.noclean.available, true);
  assert.equal(p.sourceGroups.clean.available, false);
  assert.equal(p.sourceGroups.noclean.cells["gmv_2026-11-22"], "0");
});

test("grand totals combine teams once and calculate weighted fee ratios", () => {
  const columns = [
    { key: "gmv_2026-11-22", group: "gmv", ymd: "2026-11-22" },
    { key: "fee_2026-11-22", group: "fee" }, { key: "feeRate_2026-11-22", group: "feeRate" },
    { key: "monthSpend" }, { key: "panel" }, { key: "monthFee" },
    { key: "margin", group: "margin" }, { key: "ret15" }, { key: "orders" }
  ];
  const a = { "gmv_2026-11-22": "100", "fee_2026-11-22": "10", "feeRate_2026-11-22": "10%", monthSpend: "50", panel: "1000", margin: "20%", orders: "3" };
  const b = { "gmv_2026-11-22": "900", "fee_2026-11-22": "180", "feeRate_2026-11-22": "20%", monthSpend: "350", panel: "3000", margin: "80%", orders: "7" };
  const teams = [a, b].map((values, i) => ({ key: i ? "shen" : "han", rows: [{ shop: "同名店铺", cells: values }], groupTotalsEligible: true,
    sourceGroups: { noclean: { available: true, cells: values }, clean: { available: true, cells: { "gmv_2026-11-22": "0", "fee_2026-11-22": "0" } } } }));
  const summary = buildGrandSummary(teams, columns, ["han", "shen"], today);
  assert.equal(summary.foot.length, 3);
  const total = summary.foot[0].cells;
  assert.equal(total["gmv_2026-11-22"], 1000);
  assert.equal(total["feeRate_2026-11-22"], "19.00%");
  assert.equal(total.monthFee, "10.00%");
  assert.equal(total.orders, 10);
  assert.equal(total.margin, undefined);
  assert.equal(total.ret15, undefined);
  assert.equal(summary.foot[1].cells["gmv_2026-11-22"], 1000);
  assert.equal(summary.foot[2].cells["feeRate_2026-11-22"], "");
  assert.equal(summary.kpis[0].value, 2);
  assert.equal(summary.complete, true);
  teams[0].groupTotalsEligible = false;
  assert.equal(buildGrandSummary(teams, columns, ["han", "shen"], today).complete, false);
  assert.equal(buildGrandSummary(teams, columns, ["han", "shen"], today).foot[1].cells["gmv_2026-11-22"], 900);
  assert.equal(sumReportCells([], columns)["gmv_2026-11-22"], "");
});

test("only Han supplies cleaning totals; Shen detail belongs entirely to non-cleaning", () => {
  const columns = [
    { key: "gmv_2026-11-22", group: "gmv", ymd: "2026-11-22" },
    { key: "fee_2026-11-22", group: "fee" }, { key: "feeRate_2026-11-22", group: "feeRate" }
  ];
  const values = (gmv, fee) => ({ "gmv_2026-11-22": gmv, "fee_2026-11-22": fee });
  const han = { key: "han", rows: [{ cells: values(100, 20) }], groupTotalsEligible: true,
    sourceGroups: { noclean: { available: true, cells: values(40, 2) }, clean: { available: true, cells: values(60, 18) } } };
  const shen = { key: "shen", rows: [{ cells: values(900, 90) }], groupTotalsEligible: true,
    sourceGroups: { noclean: { available: true, cells: values(9999, 9999) }, clean: { available: true, cells: values(9999, 9999) } } };
  const summary = buildGrandSummary([han, shen], columns, ["han", "shen"], today);
  const [total, noclean, clean] = summary.foot.map(row => row.cells);
  assert.equal(total["gmv_2026-11-22"], 1000);
  assert.equal(noclean["gmv_2026-11-22"], 940);
  assert.equal(clean["gmv_2026-11-22"], 60);
  assert.equal(noclean["gmv_2026-11-22"] + clean["gmv_2026-11-22"], total["gmv_2026-11-22"]);
  assert.equal(noclean["feeRate_2026-11-22"], "9.79%");
  assert.equal(clean["feeRate_2026-11-22"], "30.00%");
  assert.equal(summary.complete, true);

  const pending = buildGrandSummary([{ key: "han", rows: [] }, shen], columns, ["han", "shen"], today);
  assert.equal(pending.foot[0].cells["gmv_2026-11-22"], 900);
  assert.equal(pending.foot[1].cells["gmv_2026-11-22"], 900);
  assert.equal(pending.foot[2].cells["gmv_2026-11-22"], "");
  assert.equal(pending.foot[2].label, "清洁店铺汇总（待韩梦凯组）");
  assert.equal(pending.complete, false);

  const onlyShen = buildGrandSummary([shen], columns, ["shen"], today);
  assert.equal(onlyShen.foot[2].cells["gmv_2026-11-22"], 0);
  assert.equal(onlyShen.complete, true);
  shen.groupTotalsEligible = false;
  const partial = buildGrandSummary([han, shen], columns, ["han", "shen"], today);
  assert.equal(partial.foot[1].cells["gmv_2026-11-22"], 940);
  assert.equal(partial.complete, false);
});

test("API reader requests only configured visible ranges and detects concurrent edits", async () => {
  const requested = [];
  let v = 0;
  const fake = async (_service, action, args) => {
    if (action === "get-file-info") return { version: ++v };
    if (action === "get-sheets-info") return { detail: { sheetsInfo: [{ sheetName: "近七天业绩", sheetId: 14, isVisible: true, rowTo: 41, colTo: 651 }] } };
    requested.push(args.range);
    return { result: "ok", detail: { rangeData: cells.filter(c => c.rowFrom >= args.range.rowFrom && c.rowFrom <= args.range.rowTo && c.colFrom >= args.range.colFrom && c.colFrom <= args.range.colTo) } };
  };
  const source = { url: "https://www.kdocs.cn/l/example", team: "shen", sheetName: "近七天业绩", visibility: { ...visibility, columns: [...visibility.columns, 596] } };
  await assert.rejects(readSource(source, fake, today), /发生修改/);
  assert.ok(requested.length > 0);
  assert.ok(requested.every(r => r.rowTo <= 5 && !(r.colFrom <= 349 && r.colTo >= 349)));
  assert.ok(requested.filter(r => r.rowFrom !== visibility.headerRow).every(r => r.colTo <= 589));
});

test("failed reads preserve last success, repeated sync replaces instead of appending", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "week-wps-test-"));
  const store = path.join(dir, "store.json");
  const config = { store, sources: [{ team: "shen", url: "https://www.kdocs.cn/l/example", sheetName: "近七天业绩", visibility }] };
  const call = async (_s, action, args) => {
    if (action === "get-file-info") return { version: 1 };
    if (action === "get-sheets-info") return { detail: { sheetsInfo: [{ sheetName: "近七天业绩", sheetId: 14, rowTo: 41, colTo: 651 }] } };
    return { result: "ok", detail: { rangeData: cells.filter(c => c.rowFrom >= args.range.rowFrom && c.rowFrom <= args.range.rowTo && c.colFrom >= args.range.colFrom && c.colFrom <= args.range.colTo) } };
  };
  try {
    await syncWpsOnce(config, { call, today });
    const again = await syncWpsOnce(config, { call, today });
    assert.equal(again.teams.shen.rows.length, 2);
    const failed = await syncWpsOnce(config, { call: async () => { throw new Error("授权过期"); }, today });
    assert.equal(failed.teams.shen.rows.length, 2);
    assert.equal(readWpsStore(store).teams.shen.status, "error");
    assert.equal(applyWpsPack(base, failed, today).readyToSend, false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
