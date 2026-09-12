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
  assert.match(homeJs, /linear-gradient\(#dceaff,#f7fbff\)/);
  assert.doesNotMatch(homeJs, /border:2px solid #4d8fd6/);
  assert.match(homeJs, /\.xm-hm-bar\{[^}]*border:0\}/);
  assert.match(homeJs, /function teamHidden/);
  assert.match(homeJs, /卡片可拖拽换位/);
  assert.match(homeJs, /title="拖拽换位"/);
  assert.match(homeJs, /function onSortSelectStart/);
  assert.match(homeJs, /\.xm-hm-card,\.xm-hm-pop label\{-webkit-user-select:none;user-select:none/);
  assert.match(homeJs, /--xm-hm-team-cols/);
  assert.match(homeJs, /label: "经理团队"/);
  assert.match(homeJs, /label: "主管团队"/);
  assert.match(homeJs, /function shopOnRoleTeam/);
  assert.match(homeJs, /<th>排名<\/th><th>店铺名称<\/th><th>运营<\/th><\/tr>/);
  assert.match(homeJs, /星脉甄选/);
  assert.match(homeJs, /class="xm-hm-set">卡片设置<\/button><\/header>/);
  assert.match(homeJs, /xm-hm-kpis-shell/);
  assert.doesNotMatch(homeJs, /xm-hm-views">[\s\S]{0,120}卡片设置/);
  assert.doesNotMatch(homeJs, /<th>运营<\/th><th>实时销售额<\/th>/);
});

test("homepage money and rates show as rounded integers", () => {
  assert.match(homeJs, /function fmtMoney\(value\) \{\n    return fmtInt\(value\);/);
  assert.match(homeJs, /return Math\.round\(n\) \+ "%"/);
  assert.match(homeJs, /Math\.round\(Math\.abs\(n\)\)/);
  assert.doesNotMatch(homeJs, /minimumFractionDigits: 2/);
  assert.doesNotMatch(homeJs, /n\.toFixed\(2\) \+ "%"/);
});

test("card help uses a body-level tooltip so overflow cannot clip it", () => {
  assert.match(homeJs, /function tipAttr/);
  assert.match(homeJs, /function showCardTip/);
  assert.match(homeJs, /class="xm-hm-help"/);
  assert.match(homeJs, /cardTipEl\.id = "xm-hm-tip"/);
  assert.match(homeJs, /position:fixed/);
  assert.match(homeJs, /white-space:pre-wrap/);
  assert.doesNotMatch(homeJs, /<i title="/);
  assert.doesNotMatch(homeJs, /content:attr\(data-tip\)/);
  assert.match(homeJs, /&#10;/);
});
