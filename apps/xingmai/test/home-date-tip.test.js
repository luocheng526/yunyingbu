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
  assert.match(homeJs, /最多选择 30 天/);
  assert.match(homeJs, /function withinDays/);
  assert.doesNotMatch(homeJs, /<input type="date"/);
});

test("custom range allows 30 inclusive days and rejects 31", () => {
  assert.equal(withinDays("2026-09-01", "2026-09-30", 30), true);
  assert.equal(withinDays("2026-09-01", "2026-10-01", 30), false);
  assert.equal(withinDays("2026-09-11", "2026-09-11", 30), true);
});

test("card help uses data-tip so multiline ERP copy can show", () => {
  assert.match(homeJs, /function tipAttr/);
  assert.match(homeJs, /data-tip="/);
  assert.match(homeJs, /id="xm-hm-tip"/);
  assert.match(homeJs, /white-space:pre-wrap/);
  assert.doesNotMatch(homeJs, /<i title="/);
  assert.match(homeJs, /&#10;/);
});
