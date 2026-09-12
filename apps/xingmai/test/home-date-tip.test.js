import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const homeJs = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../public/shared/modules/home.js"),
  "utf8"
);

function withinDays(from, to, maxInclusive) {
  const parseYmd = (ymd) => {
    const p = String(ymd || "").split("-");
    return Date.UTC(Number(p[0]) || 1970, (Number(p[1]) || 1) - 1, Number(p[2]) || 1);
  };
  return Math.abs(parseYmd(to) - parseYmd(from)) / 86400000 + 1 <= (maxInclusive || 30);
}

test("homepage opens a custom calendar instead of native date inputs", () => {
  assert.match(homeJs, /id="xm-hm-dates"/);
  assert.match(homeJs, /id="xm-hm-cal"/);
  assert.match(homeJs, /id="xm-hm-date-clear"/);
  assert.match(homeJs, /最多选择30天/);
  assert.match(homeJs, /function withinDays/);
  assert.match(homeJs, /function formatDashDate/);
  assert.match(homeJs, /data-cal-nav="-12"/);
  assert.doesNotMatch(homeJs, /<input type="date"/);
});

test("custom range allows 30 inclusive days and rejects 31", () => {
  assert.equal(withinDays("2026-09-01", "2026-09-30", 30), true);
  assert.equal(withinDays("2026-09-01", "2026-10-01", 30), false);
  assert.equal(withinDays("2026-09-11", "2026-09-11", 30), true);
});

test("team KPIs resolve ERP shop id from storeId or shop-options name", () => {
  assert.match(homeJs, /function resolveErpId/);
  assert.match(homeJs, /function mapByShopName/);
  assert.match(homeJs, /function normShopName/);
  assert.match(homeJs, /shop\.manager/);
});

test("team view links to data overview and packs KPIs four-by-four", () => {
  assert.match(homeJs, /function teamBlockHtml/);
  assert.doesNotMatch(homeJs, /打开数据总览/);
  assert.doesNotMatch(homeJs, /打开运营中心/);
  assert.match(homeJs, /\.xm-hm-team-kpis\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(homeJs, /\.xm-hm\.is-chief \.xm-hm-team-kpis\{grid-template-columns:1fr/);
  assert.doesNotMatch(homeJs, /\.xm-hm\.is-chief \.xm-hm-card\{aspect-ratio:1\/1/);
  assert.match(homeJs, /xm-hm-teams-bar"><b>星脉甄选<\/b><button type="button" class="xm-hm-set">卡片设置/);
  assert.match(homeJs, /classList\.toggle\("is-chief"/);
  assert.match(homeJs, /function filterOwnChiefs/);
  assert.match(homeJs, /function seesAllChiefs/);
  assert.match(homeJs, /shop\.assistant/);
  assert.match(homeJs, /<th class="xm-hm-num">数量<\/th>/);
  assert.match(homeJs, /\.xm-hm\.is-chief \.xm-hm-teams \.xm-hm-table\{min-width:0/);
  assert.match(homeJs, /\.xm-hm-teams \.xm-hm-table th,\.xm-hm-teams \.xm-hm-table td\{border:0;overflow:hidden;text-overflow:ellipsis;box-sizing:border-box;text-align:center\}/);
  assert.match(homeJs, /\.xm-hm-teams \.xm-hm-table \.xm-hm-num\{text-align:center/);
  assert.match(homeJs, /\.xm-hm-sort-h\{display:inline-flex;align-items:center;justify-content:center/);
  assert.match(homeJs, /\.xm-hm-teams \.xm-hm-table th\{border-right:1px dashed #c8ced8\}/);
  assert.doesNotMatch(homeJs, /\.xm-hm-teams \.xm-hm-table th,\.xm-hm-teams \.xm-hm-table td\{border:0;border-right:1px dashed/);
  assert.match(homeJs, /function colKey/);
  assert.match(homeJs, /function restoreShopColW/);
  assert.match(homeJs, /table\.style\.width = table\.style\.minWidth = table\.style\.maxWidth = sum/);
  assert.match(homeJs, /cell\.style\.width = cell\.style\.minWidth = cell\.style\.maxWidth = cw/);
  assert.match(homeJs, /linear-gradient\(#dceaff,#f7fbff\)/);
  assert.doesNotMatch(homeJs, /border:2px solid #4d8fd6/);
  assert.match(homeJs, /\.xm-hm-bar\{[^}]*border:0\}/);
  assert.match(homeJs, /function teamHidden/);
  assert.doesNotMatch(homeJs, /卡片可拖拽换位/);
  assert.doesNotMatch(homeJs, /title="拖拽换位"/);
  assert.match(homeJs, /function shopColHit/);
  assert.match(homeJs, /function applyColW/);
  assert.match(homeJs, /function onSortSelectStart/);
  assert.match(homeJs, /\.xm-hm-card,\.xm-hm-pop label\{-webkit-user-select:none;user-select:none/);
  assert.match(homeJs, /\.xm-hm-views button,\.xm-hm-set\{[^}]*-webkit-user-select:none;user-select:none/);
  assert.match(homeJs, /closest\("\.xm-hm-views button,\.xm-hm-ranges button,\.xm-hm-set,\.xm-hm-dates"\)/);
  assert.match(homeJs, /--xm-hm-team-cols/);
  assert.match(homeJs, /label: "经理团队"/);
  assert.match(homeJs, /label: "主管\/储备"/);
  assert.doesNotMatch(homeJs, /label: "主管看板"/);
  assert.doesNotMatch(homeJs, /label: "主管团队"/);
  assert.match(homeJs, /label: "昨天"/);
  assert.match(homeJs, /label: "本月"/);
  assert.doesNotMatch(homeJs, /label: "近3天"/);
  assert.doesNotMatch(homeJs, /label: "近7天"/);
  assert.doesNotMatch(homeJs, /label: "近15天"/);
  assert.doesNotMatch(homeJs, /label: "近30天"/);
  assert.match(homeJs, /label: "净货品成本占比 \(支付\)"/);
  assert.match(homeJs, /field: "netGoodsRate"/);
  assert.match(homeJs, /function shopOnRoleTeam/);
  assert.match(homeJs, /function shopMetricsFrom/);
  assert.match(homeJs, /function shopCols/);
  assert.match(homeJs, /SHOP_CARD_KEYS = \["adRatio", "profit", "grossMargin", "refundRate", "netGoodsCost"\]/);
  assert.match(homeJs, /LIVE_CARD_KEYS = \["ad", "roi", "livePay", "livePaid"\]/);
  assert.match(homeJs, /\.xm-hm-live-cards\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(homeJs, /paid: \{ label: "实时费比"/);
  assert.match(homeJs, /key: "livePaid", label: "实时付费金额"/);
  assert.doesNotMatch(homeJs, /LIVE_CARD_KEYS = \["ad", "profit"/);
  assert.match(homeJs, /data-shop-card=/);
  assert.match(homeJs, /<th>排名<\/th><th>店铺名称<\/th>/);
  assert.match(homeJs, /<th>运营<\/th><\/tr>/);
  assert.match(homeJs, /function sortedShops/);
  assert.match(homeJs, /function shopColHead/);
  assert.match(homeJs, /data-shop-sort=/);
  assert.match(homeJs, /data-dir="asc"/);
  assert.match(homeJs, /data-dir="desc"/);
  assert.match(homeJs, /aria-label="升序"/);
  assert.match(homeJs, /aria-label="降序"/);
  assert.doesNotMatch(homeJs, /data-shop-pad/);
  assert.doesNotMatch(homeJs, /行距/);
  assert.doesNotMatch(homeJs, /--xm-hm-row-pad/);
  assert.doesNotMatch(homeJs, /#5b9bd5/);
  assert.match(homeJs, /border-right:1px dashed #c8ced8/);
  assert.match(homeJs, /星脉甄选/);
  assert.doesNotMatch(homeJs, /class="xm-hm-set">卡片设置<\/button><\/header>/);
  assert.match(homeJs, /class="xm-hm-set" id="xm-hm-set">卡片设置<\/button><\/div>/);
  assert.match(homeJs, /xm-hm-kpis-shell/);
  assert.doesNotMatch(homeJs, /xm-hm-views">[\s\S]{0,120}卡片设置/);
  assert.doesNotMatch(homeJs, /<th>运营<\/th><th>实时销售额<\/th>/);
});

test("shop column drag locks every column and only changes the grabbed one", () => {
  const start = homeJs.indexOf("var shopColW");
  const end = homeJs.indexOf("function metricSortNum");
  assert.ok(start !== -1 && end > start);
  const fns = new Function(homeJs.slice(start, end) + "return {applyColW};")();
  const cell = (w) => ({ offsetWidth: w, style: {} });
  const widths = [40, 120, 80, 70, 70, 70, 80, 60];
  const table = {
    rows: [{ cells: widths.map(cell) }, { cells: widths.map(cell) }],
    style: {},
    closest: () => ({ getAttribute: () => "沈子晗" })
  };
  fns.applyColW(table, 2, 160, 1);
  assert.equal(table.rows[0].cells[2].style.width, "160px");
  assert.equal(table.rows[0].cells[1].style.width, "120px");
  assert.equal(table.rows[0].cells[3].style.maxWidth, "70px");
  assert.equal(table.rows[1].cells[2].style.minWidth, "160px");
  assert.equal(table.style.width, "670px");
  assert.equal(table.style.maxWidth, "670px");
});

test("homepage money and rates show as rounded integers", () => {
  assert.match(homeJs, /function fmtMoney\(value\) \{\n    return fmtInt\(value\);/);
  assert.match(homeJs, /return Math\.round\(n\) \+ "%"/);
  assert.match(homeJs, /Math\.round\(Math\.abs\(n\)\)/);
  assert.doesNotMatch(homeJs, /minimumFractionDigits: 2/);
  assert.doesNotMatch(homeJs, /n\.toFixed\(2\) \+ "%"/);
});

test("duty shop rows sort by metric arrows and keep empty values last", () => {
  const pick = (name) => {
    const start = homeJs.indexOf("function " + name);
    assert.notEqual(start, -1, name);
    let depth = 0;
    for (let i = start; i < homeJs.length; i += 1) {
      if (homeJs[i] === "{") depth += 1;
      if (homeJs[i] === "}") {
        depth -= 1;
        if (depth === 0) return homeJs.slice(start, i + 1);
      }
    }
    throw new Error("unclosed " + name);
  };
  const fns = new Function(
    pick("asNum") + pick("metricSortNum") + pick("sortedShops") + ";return {sortedShops};"
  )();
  const rows = [
    { shop: "A", metrics: { profit: "10" }, _pay: 3 },
    { shop: "B", metrics: { profit: "—" }, _pay: 9 },
    { shop: "C", metrics: { profit: "41,004" }, _pay: 1 },
    { shop: "D", metrics: { profit: "2%" }, _pay: 8 }
  ];
  assert.deepEqual(
    fns.sortedShops(rows, { key: "profit", dir: "asc" }).map((row) => row.shop),
    ["D", "A", "C", "B"]
  );
  assert.deepEqual(
    fns.sortedShops(rows, { key: "profit", dir: "desc" }).map((row) => row.shop),
    ["C", "A", "D", "B"]
  );
});

test("chief board keeps admins on all columns and others on their own duty", () => {
  const pick = (name) => {
    const start = homeJs.indexOf("function " + name);
    assert.notEqual(start, -1, name);
    let depth = 0;
    for (let i = start; i < homeJs.length; i += 1) {
      if (homeJs[i] === "{") depth += 1;
      if (homeJs[i] === "}") {
        depth -= 1;
        if (depth === 0) return homeJs.slice(start, i + 1);
      }
    }
    throw new Error("unclosed " + name);
  };
  const fns = new Function(
    pick("seesAllChiefs") + pick("filterOwnChiefs") + ";return {filterOwnChiefs, seesAllChiefs};"
  )();
  const teams = [{ name: "杨润泽" }, { name: "陈晓曼" }, { name: "翁琴" }];
  assert.equal(fns.seesAllChiefs({ role: "超级管理员", dataScope: "全平台数据" }), true);
  assert.equal(fns.seesAllChiefs({ role: "主管", displayName: "杨润泽" }), false);
  assert.deepEqual(
    fns.filterOwnChiefs(teams, { role: "超级管理员" }).map((row) => row.name),
    ["杨润泽", "陈晓曼", "翁琴"]
  );
  assert.deepEqual(
    fns.filterOwnChiefs(teams, { displayName: "杨润泽", role: "主管" }).map((row) => row.name),
    ["杨润泽"]
  );
});

test("chief columns keep 主管/储备 duty and drop 运营 助理 经理", () => {
  const start = homeJs.indexOf("function teamPredicate");
  const end = homeJs.indexOf("function buildTeams");
  const fns = new Function(homeJs.slice(start, end) + "return {teamLeadNames, shopOnRoleTeam};")();
  const people = [
    { name: "杨润泽", role: "主管", status: "在职" },
    { name: "翁琴", role: "储备", status: "在职" },
    { name: "高丽男", role: "运营", status: "在职" },
    { name: "韩梦凯", role: "经理", status: "在职" },
    { name: "张助理", role: "助理", status: "在职" }
  ];
  const shops = [
    { supervisor: "杨润泽", assistant: "翁琴" },
    { supervisor: "高丽男", assistant: "陈晓曼" },
    { supervisor: "韩梦凯", assistant: "张助理", lead: "高丽男" }
  ];
  assert.deepEqual(fns.teamLeadNames(people, shops, "主管"), ["杨润泽", "翁琴", "陈晓曼"]);
  assert.equal(fns.shopOnRoleTeam(shops[0], "杨润泽", "主管"), true);
  assert.equal(fns.shopOnRoleTeam(shops[2], "高丽男", "主管"), false);
});

test("card help uses a body-level tooltip so overflow cannot clip it", () => {
  assert.match(homeJs, /function tipAttr/);
  assert.match(homeJs, /function showCardTip/);
  assert.match(homeJs, /class="xm-hm-help"/);
  assert.match(homeJs, />!<\/button>/);
  assert.doesNotMatch(homeJs, />i<\/button>/);
  assert.match(homeJs, /function helpFromEvent/);
  assert.match(homeJs, /event\.target\.closest\("\.xm-hm-help"\)/);
  assert.doesNotMatch(homeJs, /closest\("\.xm-hm-card-head"\)/);
  assert.doesNotMatch(homeJs, /inset:-14px/);
  assert.match(homeJs, /cardTipEl\.id = "xm-hm-tip"/);
  assert.match(homeJs, /position:fixed/);
  assert.match(homeJs, /white-space:pre-wrap/);
  assert.doesNotMatch(homeJs, /<i title="/);
  assert.doesNotMatch(homeJs, /content:attr\(data-tip\)/);
  assert.match(homeJs, /&#10;/);
});
