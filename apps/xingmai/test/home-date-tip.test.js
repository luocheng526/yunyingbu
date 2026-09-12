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

test("team view pairs the same KPI left and right for comparison", () => {
  assert.match(homeJs, /function teamsCompareHtml/);
  assert.match(homeJs, /function teamHeadHtml/);
  assert.match(homeJs, /function teamShopsHtml/);
  assert.doesNotMatch(homeJs, /function teamBlockHtml/);
  assert.match(homeJs, /\.xm-hm-teams\{display:grid;grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/);
  assert.doesNotMatch(homeJs, /@media \(max-width:900px\)\{\.xm-hm-teams\{grid-template-columns:1fr\}/);
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
