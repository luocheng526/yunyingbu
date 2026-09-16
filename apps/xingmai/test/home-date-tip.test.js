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
  assert.equal(withinDays("2026-09-01", "2026-09-15", 30), true);
});

test("calendar picks a range by clicking start then end", () => {
  assert.match(homeJs, /function applyCalDay/);
  assert.match(homeJs, /function paintCalHover/);
  assert.match(homeJs, /function onCalPointerDown/);
  assert.match(homeJs, /先点开始日期，再点结束日期，最多连续30天/);
  assert.match(homeJs, /calLockAt/);
  assert.match(homeJs, /state\.range = "custom"/);
  assert.doesNotMatch(homeJs, /if \(!calPick\) \{\n            calPick = ymd;\n            calHover = "";\n            renderCal\(\);/);
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
  assert.match(homeJs, /xm-hm-teams-bar"><b>星脉甄选<\/b><span><button type="button" data-show-teams>恢复所有团队的卡片<\/button><button type="button" class="xm-hm-set">卡片设置/);
  assert.match(homeJs, /data-drop-team="/);
  assert.doesNotMatch(homeJs, /data-drop-card="/);
  assert.match(homeJs, /class="xm-hm-drop"/);
  assert.match(homeJs, /title="删除此团队"/);
  assert.doesNotMatch(homeJs, /title="删除此卡片"/);
  assert.match(homeJs, /function teamHeadHtml\(team, simple\)/);
  assert.match(homeJs, /function goneTeams/);
  assert.match(homeJs, /function saveGone/);
  assert.match(homeJs, /data-show-teams[\s\S]{0,180}saveGone\(\[\]\);/);
  assert.doesNotMatch(homeJs, /saveGone\(\[\]\);\n          saveHidden\(\[\]\);/);
  assert.match(homeJs, /data-hide-all/);
  assert.match(homeJs, /全选<\/label>/);
  assert.match(homeJs, /classList\.toggle\("is-chief"/);
  assert.match(homeJs, /function filterOwnChiefs/);
  assert.match(homeJs, /function seesAllChiefs/);
  assert.match(homeJs, /shop\.assistant/);
  assert.match(homeJs, /<th>店铺名称<\/th><\/tr><\/thead><tbody>/);
  assert.doesNotMatch(homeJs, /<th>排名<\/th><th>店铺名称<\/th><\/tr>/);
  assert.match(homeJs, /\.xm-hm-teams \.xm-hm-table\{min-width:760px/);
  assert.match(homeJs, /\.xm-hm\.is-team:not\(\.is-chief\) \.xm-hm-team\{min-width:0;width:100%\}/);
  assert.match(homeJs, /\.xm-hm\.is-team:not\(\.is-chief\) \.xm-hm-teams-grid\{grid-template-columns:repeat\(var\(--xm-hm-team-cols,2\),minmax\(0,1fr\)\);gap:20px\}/);
  assert.doesNotMatch(homeJs, /\.xm-hm\.is-team:not\(\.is-chief\) \.xm-hm-teams-grid\{gap:72px\}/);
  assert.doesNotMatch(homeJs, /\.xm-hm\.is-team:not\(\.is-chief\) \.xm-hm-team\{min-width:760px\}/);
  assert.match(homeJs, /\.xm-hm\.is-team:not\(\.is-chief\) \.xm-hm-team \.xm-hm-panel\{margin-top:48px\}/);
  assert.doesNotMatch(homeJs, /<th class="xm-hm-num">数量<\/th>/);
  assert.match(homeJs, /卡片设置 · /);
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
  assert.match(homeJs, /function viewStore/);
  assert.match(homeJs, /xm-home-" \+ viewKey \+ "-"/);
  assert.match(homeJs, /function orderTeams/);
  assert.match(homeJs, /function saveTeamCols/);
  assert.match(homeJs, /data-name="/);
  assert.match(homeJs, /\.xm-hm-team\{cursor:grab;background:#dceaff;border:1px solid #7ea6dc\}/);
  assert.match(homeJs, /closest\("\.xm-hm-card,\.xm-hm-table"\)/);
  assert.doesNotMatch(homeJs, /卡片可拖拽换位/);
  assert.doesNotMatch(homeJs, /title="拖拽换位"/);
  assert.match(homeJs, /function shopColHit/);
  assert.match(homeJs, /function applyColW/);
  assert.match(homeJs, /function onSortSelectStart/);
  assert.match(homeJs, /\.xm-hm-card,\.xm-hm-pop label\{-webkit-user-select:none;user-select:none/);
  assert.match(homeJs, /\.xm-hm-views button\{[^}]*border-radius:4px/);
  assert.match(homeJs, /\.xm-hm-views button\.is-on\{background:var\(--xm-primary\)/);
  assert.match(homeJs, /\.xm-hm-set\{border:0;background:transparent;color:var\(--xm-primary\)/);
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
  assert.match(homeJs, /\.xm-hm-live\{display:flex;flex-direction:column;gap:20px\}/);
  assert.match(homeJs, /\.xm-hm-live-charts\{display:grid;grid-template-columns:1fr 1fr;gap:20px\}/);
  assert.match(homeJs, /\.xm-hm-live-cards\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\);gap:20px/);
  assert.match(homeJs, /paid: \{ label: "实时费比"/);
  assert.match(homeJs, /key: "livePaid", label: "实时付费金额"/);
  assert.match(homeJs, /\/api\/home\/erp-paid/);
  assert.match(homeJs, /function seriesOf/);
  assert.match(homeJs, /function todayHours/);
  assert.match(homeJs, /function padHours/);
  assert.match(homeJs, /function companySalesHtml/);
  assert.match(homeJs, /function toHalfIncrements/);
  assert.match(homeJs, /function halfTipLabel/);
  assert.match(homeJs, /function halfSalesChart/);
  assert.match(homeJs, /function hoursAttr/);
  assert.match(homeJs, /function lineChartOf/);
  assert.doesNotMatch(homeJs, /function compareBarsHtml/);
  assert.doesNotMatch(homeJs, /function hourFromBarEvent/);
  assert.doesNotMatch(homeJs, /柱：分时金额/);
  assert.doesNotMatch(homeJs, /柱：分时费比/);
  assert.match(homeJs, /线：累计（23点=1-23点）/);
  assert.match(homeJs, /线：当天费比/);
  assert.match(homeJs, /stroke="#91caff"/);
  assert.match(homeJs, /stroke="#ffa39e"/);
  assert.match(homeJs, /\.xm-hm-sales-chart \.xm-hm-line,\.xm-hm-live \.xm-hm-line\{[^}]*height:148px/);
  assert.match(homeJs, /function repeatHours/);
  assert.match(homeJs, /unit: src\.unit \|\| base\.unit/);
  assert.match(homeJs, /lineMode: src\.lineMode \|\| base\.lineMode/);
  assert.match(homeJs, /preserveAspectRatio="none"/);
  assert.match(homeJs, /noDots: true/);
  assert.match(homeJs, /function companySetCards/);
  assert.doesNotMatch(homeJs, /function liveSalesCard/);
  assert.doesNotMatch(homeJs, /LIVE_SALES_KEY = "liveSales"/);
  assert.match(homeJs, /id="xm-hm-sales"/);
  assert.match(homeJs, /#xm-hm-sales"\)\.innerHTML = ""/);
  assert.doesNotMatch(homeJs, /companySalesHtml\(hero\)/);
  assert.match(homeJs, /state\.view === "company" \? companySetCards\(state\.cards\)/);
  assert.match(homeJs, /companyHideKeys\(state\.cards\)/);
  assert.match(homeJs, /\.xm-hm-sales\{display:none/);
  assert.match(homeJs, /state\.view === "live" \|\| state\.view === "company"/);
  assert.match(homeJs, /function cumHours/);
  assert.match(homeJs, /function hourFromEvent/);
  assert.match(homeJs, /function onLineTipMove/);
  assert.match(homeJs, /function lineTipHtml/);
  assert.match(homeJs, /lineTipEl\.id = "xm-hm-line-tip"/);
  assert.match(homeJs, /data-hours="' \+ hours \+ '"/);
  assert.match(homeJs, /yesterday: hasHourly \? cumHours\(yestHour\)/);
  assert.match(homeJs, /today: hasHourly \? cumHours\(todayHour\)/);
  assert.match(homeJs, /<i class="is-today"><\/i>实时/);
  assert.match(homeJs, /hourly\.todayPay/);
  assert.match(homeJs, /hours: hasHourly \? 24 : 0/);
  assert.doesNotMatch(homeJs, /LIVE_CARD_KEYS = \["ad", "profit"/);
  assert.match(homeJs, /data-shop-card=/);
  assert.match(homeJs, /<th>排名<\/th><th>店铺名称<\/th><th>实时销售额/);
  assert.match(homeJs, /<th>运营<\/th><\/tr>/);
  assert.match(homeJs, /<th>排名<\/th><th>店铺名称<\/th>' \+/);
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
  assert.match(homeJs, /class="xm-hm-set" id="xm-hm-set">卡片设置<\/button>/);
  assert.match(homeJs, /xm-hm-kpis-shell/);
  assert.doesNotMatch(homeJs, /xm-hm-views">[\s\S]{0,120}卡片设置/);
  assert.doesNotMatch(homeJs, /<th>运营<\/th><th>实时销售额<\/th>/);
  assert.match(homeJs, /function placeCardPop/);
  assert.match(homeJs, /function visibleSetBtn/);
  assert.match(homeJs, /b\.bottom - p\.top \+ 8/);
  assert.doesNotMatch(homeJs, /\.xm-hm-pop\{position:absolute;top:48px;left:10px/);
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

test("company card settings no longer include 实时销售金额", () => {
  assert.match(homeJs, /function companySetCards\(cards\) \{\n    return arrangeCards\(cards \|\| blankCompanyCards\(\)\);/);
  assert.doesNotMatch(homeJs, /function liveSalesCard/);
  assert.doesNotMatch(homeJs, /LIVE_SALES_KEY/);
  assert.doesNotMatch(homeJs, /COMPANY_CARD_DEFS = \[\n    \{ key: "liveSales"/);
});

test("card settings persist separately for 公司 经理团队 and 主管/储备", () => {
  const start = homeJs.indexOf("var viewKey");
  const end = homeJs.indexOf("function defaultCardKeys");
  const store = {};
  const fns = new Function(
    "localStorage",
    homeJs.slice(start, end) +
      "return {viewStore, hiddenCards, saveHidden, goneTeams, saveGone, set: function (v) { viewKey = v; }};"
  )({
    getItem: (key) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
    setItem: (key, value) => {
      store[key] = String(value);
    }
  });
  fns.set("company");
  assert.equal(fns.viewStore("hide"), "xm-home-hidden-cards");
  assert.equal(fns.viewStore("order"), "xm-home-card-order");
  fns.saveHidden(["payAmount"]);
  fns.set("team");
  assert.equal(fns.viewStore("hide"), "xm-home-team-hide");
  assert.equal(fns.viewStore("order"), "xm-home-team-order");
  assert.deepEqual(fns.hiddenCards(), []);
  fns.saveHidden(["adCost"]);
  fns.saveGone(["沈子晗"]);
  fns.set("chief");
  assert.equal(fns.viewStore("hide"), "xm-home-chief-hide");
  assert.equal(fns.viewStore("order"), "xm-home-chief-order");
  assert.deepEqual(fns.hiddenCards(), []);
  assert.deepEqual(fns.goneTeams(), []);
  fns.saveHidden(["refundRate"]);
  fns.set("company");
  assert.deepEqual(fns.hiddenCards(), ["payAmount"]);
  fns.set("team");
  assert.deepEqual(fns.hiddenCards(), ["adCost"]);
  assert.deepEqual(fns.goneTeams(), ["沈子晗"]);
});

test("chief columns follow every org 主管/储备 supervisor including 经理", () => {
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
    { supervisor: "杨润泽", assistant: "翁琴", operator: "崔安琪" },
    { supervisor: "高丽男", assistant: "陈晓曼", operator: "陈晓曼" },
    { supervisor: "韩梦凯", assistant: "张助理", operator: "张助理", lead: "高丽男" },
    { supervisor: "段坤孝", assistant: "黄欣然", operator: "黄欣然" },
    { supervisor: "陈晓曼", assistant: "潘梦玉", operator: "刘璇" }
  ];
  assert.deepEqual(fns.teamLeadNames(people, shops, "主管"), ["杨润泽", "翁琴", "高丽男", "韩梦凯", "段坤孝", "陈晓曼"]);
  assert.equal(fns.shopOnRoleTeam(shops[0], "杨润泽", "主管"), true);
  assert.equal(fns.shopOnRoleTeam(shops[1], "高丽男", "主管"), true);
  assert.equal(fns.shopOnRoleTeam(shops[2], "高丽男", "主管"), false);
  assert.equal(fns.shopOnRoleTeam(shops[2], "韩梦凯", "主管"), true);
  assert.equal(fns.shopOnRoleTeam(shops[1], "陈晓曼", "主管"), false);
  assert.equal(fns.shopOnRoleTeam(shops[4], "陈晓曼", "主管"), true);
  assert.equal(fns.shopOnRoleTeam(shops[4], "潘梦玉", "主管"), true);
});

test("board has 业绩 and 利润 ladders with 主管 运营 columns and ranks 1-10", () => {
  assert.match(homeJs, /class="xm-hm-ladder-card"/);
  assert.match(homeJs, /\.xm-hm-ladder-head\{display:flex;justify-content:center/);
  assert.match(homeJs, /\.xm-hm-ladder-card\{[^}]*font-size:24px/);
  assert.match(homeJs, /\.xm-hm-podiums\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(homeJs, /function restRows/);
  assert.match(homeJs, /while \(out\.length < 7\)/);
  assert.match(homeJs, /key: "profit"/);
  assert.match(homeJs, /title: "利润排行榜"/);
  assert.match(homeJs, /column\("主管排行榜", "supervisor", "payAmount"\), column\("运营排行榜", "operator", "payAmount"\)/);
  assert.match(homeJs, /column\("主管排行榜", "supervisor", "profit"\), column\("运营排行榜", "operator", "profit"\)/);
  assert.match(homeJs, /function namesFromShopDuty/);
  assert.doesNotMatch(homeJs, /person\.status === "在职" && person\.role === role/);
  assert.doesNotMatch(homeJs, /column\("经理排行榜"/);
  const start = homeJs.indexOf("function standItemHtml");
  const end = homeJs.indexOf("var LIVE_CARD_KEYS");
  const fns = new Function(
    "function escapeHtml(s){return String(s||\"\");}" + homeJs.slice(start, end) + "return {ladderHtml,restRows};"
  )();
  assert.equal(fns.restRows([]).length, 7);
  assert.deepEqual(fns.restRows([{ name: "a" }, { name: "b" }, { name: "c" }, { name: "d" }]).map((row) => row.name), [
    "d", "—", "—", "—", "—", "—", "—"
  ]);
  const html = fns.ladderHtml({
    key: "perf",
    title: "业绩排行榜",
    unit: "支付金额",
    columns: [
      { title: "主管排行榜", rows: [{ name: "杨润泽", amount: "1" }] },
      { title: "运营排行榜", rows: [{ name: "高丽男", amount: "2" }] }
    ]
  });
  assert.match(html, /xm-hm-ladder-card">业绩排行榜</);
  assert.match(html, /主管排行榜/);
  assert.match(html, /运营排行榜/);
  assert.equal(html.includes("经理排行榜"), false);
  assert.equal((html.match(/>04</g) || []).length, 2);
  assert.equal((html.match(/>10</g) || []).length, 2);
});

test("ladder names follow shop supervisor and operator duty not people role", () => {
  const start = homeJs.indexOf("function namesFromShopDuty");
  const end = homeJs.indexOf("function buildLadders");
  const fns = new Function(homeJs.slice(start, end) + "return {namesFromShopDuty};")();
  const shops = [
    { supervisor: "高丽男", operator: "杨禄" },
    { supervisor: "张文静", operator: "崔安琪" },
    { supervisor: "杨润泽", operator: "高丽男" },
    { supervisor: "管理员", operator: "" }
  ];
  assert.deepEqual(fns.namesFromShopDuty(shops, "supervisor"), ["高丽男", "张文静", "杨润泽"]);
  assert.deepEqual(fns.namesFromShopDuty(shops, "operator"), ["杨禄", "崔安琪", "高丽男"]);
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

test("card settings open only from 卡片设置 and close on blank click", () => {
  assert.match(homeJs, /var cardSetOpen = false;/);
  assert.match(homeJs, /function syncCardPop/);
  assert.match(homeJs, /cardSetOpen = !cardSetOpen;/);
  assert.match(homeJs, /cardSetOpen = false;\n      paint\(root, state\)/);
  assert.match(homeJs, /syncCardPop\(root\);/);
  assert.doesNotMatch(homeJs, /pop\.hidden = !pop\.hidden/);
  assert.doesNotMatch(homeJs, /if \(pop && popOpen\) \{\n            pop\.hidden = false;/);
});

test("card settings pop sits under the clicked 卡片设置 button", () => {
  const start = homeJs.indexOf("function visibleSetBtn");
  const end = homeJs.indexOf("function paint");
  assert.ok(start !== -1 && end > start);
  const fns = new Function(homeJs.slice(start, end) + "return {placeCardPop};")();
  const pop = { hidden: false, offsetWidth: 280, style: {} };
  const btn = { getBoundingClientRect: () => ({ bottom: 120, right: 900, top: 100, left: 840 }) };
  const box = { getBoundingClientRect: () => ({ top: 20, left: 200, width: 1000 }) };
  const root = {
    querySelector(sel) {
      if (sel === "#xm-hm-pop") {
        return pop;
      }
      if (sel === "#xm-hm") {
        return box;
      }
      return null;
    }
  };
  fns.placeCardPop(root, btn);
  assert.equal(pop.style.top, "108px");
  assert.equal(pop.style.left, "420px");
});

test("company tab puts a realtime sales row above the KPI cards", () => {
  const start = homeJs.indexOf("function hourX");
  const end = homeJs.indexOf("function liveShopRowHtml");
  const cum = homeJs.slice(homeJs.indexOf("function cumHours"), homeJs.indexOf("function seriesOf"));
  assert.ok(start !== -1 && end > start && cum.indexOf("function cumHours") === 0);
  const fns = new Function(
    "escapeHtml",
    cum + homeJs.slice(start, end) + "return {companySalesHtml, liveChartHtml, compareLineHtml, toHalfIncrements, halfTipLabel};"
  )((value) => String(value == null ? "" : value));
  assert.deepEqual(fns.toHalfIncrements([2, 4]), [1, 1, 2, 2]);
  assert.equal(fns.halfTipLabel(0), "0:30");
  assert.equal(fns.halfTipLabel(1), "1");
  assert.equal(fns.halfTipLabel(14), "7:30");
  assert.equal(fns.halfTipLabel(15), "8");
  const yest = Array.from({ length: 24 }, (_, i) => (i + 1) * 10);
  const today = [10, 30, 60];
  const html = fns.companySalesHtml({
    value: "12,345",
    yesterday: yest,
    today: today,
    yesterdayHour: yest,
    todayHour: today,
    hours: 24
  });
  assert.match(html, /实时销售金额/);
  assert.match(html, />12,345</);
  assert.match(html, /data-hours="24"/);
  assert.doesNotMatch(html, /环比/);
  assert.doesNotMatch(html, /<circle/);
  assert.doesNotMatch(html, /xm-hm-bars/);
  assert.doesNotMatch(html, /xm-hm-col/);
  const red = html.match(/stroke="#ffa39e"[^>]*points="([^"]+)"/);
  const blue = html.match(/stroke="#91caff"[^>]*points="([^"]+)"/);
  assert.ok(red && blue);
  assert.equal(red[1].trim().split(/\s+/).length, 3);
  assert.equal(blue[1].trim().split(/\s+/).length, 24);
  const firstX = Number(blue[1].trim().split(/\s+/)[0].split(",")[0]);
  const lastX = Number(blue[1].trim().split(/\s+/).pop().split(",")[0]);
  assert.ok(firstX < 40);
  assert.ok(lastX > 600);
  assert.match(html, />1<\/text>/);
  assert.match(html, />24<\/text>/);
  assert.match(html, /线：累计（23点=1-23点）/);
  assert.match(html, /preserveAspectRatio="none"/);
  const liveHtml = fns.liveChartHtml({
    label: "实时销售指数",
    value: "12,345",
    delta: 8,
    yesterday: yest,
    today: today,
    yesterdayHour: yest,
    todayHour: today,
    hours: 24
  });
  assert.match(liveHtml, /实时销售指数/);
  assert.match(liveHtml, /data-hours="24"/);
  assert.match(liveHtml, /data-chart="sales"/);
  assert.doesNotMatch(liveHtml, /<circle/);
  assert.doesNotMatch(liveHtml, /xm-hm-col/);
  const liveBlue = liveHtml.match(/stroke="#91caff"[^>]*points="([^"]+)"/);
  const liveRed = liveHtml.match(/stroke="#ffa39e"[^>]*points="([^"]+)"/);
  assert.ok(liveBlue && liveRed);
  assert.equal(liveBlue[1].trim().split(/\s+/).length, 24);
  assert.equal(liveRed[1].trim().split(/\s+/).length, 3);
  const feeHtml = fns.liveChartHtml({
    label: "实时费比",
    value: "12%",
    delta: -1,
    yesterdayHour: Array.from({ length: 24 }, () => 0.1),
    todayHour: [0.2, 0.2, 0.2],
    unit: "rate",
    lineMode: "flat"
  });
  assert.match(feeHtml, /data-chart="fee"/);
  assert.match(feeHtml, /data-unit="rate"/);
  assert.match(feeHtml, /data-hours="24"/);
  assert.match(feeHtml, /线：当天费比/);
  assert.doesNotMatch(feeHtml, /xm-hm-col/);
});

test("live sales chart keeps 24-hour axis and hides future today points", () => {
  const start = homeJs.indexOf("function hourX");
  const end = homeJs.indexOf("function liveChartHtml");
  assert.ok(start !== -1 && end > start);
  const fns = new Function(homeJs.slice(start, end) + "return {compareLineHtml};")();
  const yest = Array.from({ length: 24 }, (_, i) => i + 1);
  const html = fns.compareLineHtml({ yesterday: yest, today: [10, 20, 30], hours: 24 });
  const red = html.match(/stroke="#ffa39e"[^>]*points="([^"]+)"/);
  const blue = html.match(/stroke="#91caff"[^>]*points="([^"]+)"/);
  assert.ok(red && blue);
  assert.equal(red[1].trim().split(/\s+/).length, 3);
  assert.equal(blue[1].trim().split(/\s+/).length, 24);
  assert.match(html, />1<\/text>/);
  assert.match(html, />24<\/text>/);
  const redEnd = Number(red[1].trim().split(/\s+/).pop().split(",")[0]);
  const blueEnd = Number(blue[1].trim().split(/\s+/).pop().split(",")[0]);
  assert.ok(redEnd < blueEnd - 10);
  const plain = fns.compareLineHtml({ yesterday: yest, today: [10, 20, 30], hours: 24, noDots: true });
  assert.doesNotMatch(plain, /<circle/);
  const hourStart = homeJs.indexOf("function shanghaiHour");
  const hourEnd = homeJs.indexOf("function seriesOf");
  const hours = new Function(homeJs.slice(hourStart, hourEnd) + "return {todayHours, padHours, cumHours};")();
  assert.equal(hours.padHours([1, 2], 24).length, 24);
  assert.deepEqual(hours.cumHours([1, 2, 3]), [1, 3, 6]);
  const now = hours.todayHours(Array.from({ length: 24 }, (_, i) => i + 1));
  assert.ok(now.length >= 1 && now.length <= 24);
  const fromEnd = homeJs.indexOf("function compareLineHtml");
  const fromEv = new Function(homeJs.slice(homeJs.indexOf("function hourX"), fromEnd) + "return {hourFromEvent};")();
  const svg = { getBoundingClientRect: () => ({ left: 0, width: 640 }) };
  assert.equal(fromEv.hourFromEvent(svg, { clientX: 10 }, 24), 0);
  assert.equal(fromEv.hourFromEvent(svg, { clientX: 10 + 620 * (7 / 23) }, 24), 7);
});
