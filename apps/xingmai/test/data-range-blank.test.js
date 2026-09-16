import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const homeJs = readFileSync(join(root, "public/shared/modules/home.js"), "utf8");
const dataJs = readFileSync(join(root, "public/shared/modules/data.js"), "utf8");
const overviewJs = readFileSync(join(root, "public/data-overview.js"), "utf8");
const shopsJs = readFileSync(join(root, "public/data-shops.js"), "utf8");
const goodsJs = readFileSync(join(root, "public/data-goods.js"), "utf8");
const css = readFileSync(join(root, "public/data-pages.css"), "utf8");

test("range change blanks numbers on home overview shops and goods", () => {
  assert.match(homeJs, /0\.1\.607-data-range-blank/);
  assert.match(overviewJs, /0\.1\.607-data-range-blank/);
  assert.match(shopsJs, /0\.1\.607-data-range-blank/);
  assert.match(goodsJs, /0\.1\.607-data-range-blank/);
  assert.match(dataJs, /0\.1\.607-data-range-blank/);
  assert.match(homeJs, /function beginRangeLoad\(\)/);
  assert.match(overviewJs, /function beginRangeLoad\(\)/);
  assert.match(shopsJs, /function beginRangeLoad\(\)/);
  assert.match(goodsJs, /function beginRangeLoad\(\)/);
  assert.match(homeJs, /function setWait\(on\)/);
  assert.match(overviewJs, /function setWait\(on\)/);
  assert.match(shopsJs, /function setWait\(on\)/);
  assert.match(goodsJs, /function setWait\(on\)/);
});

test("range pills and custom dates call beginRangeLoad not a silent refresh", () => {
  assert.match(homeJs, /state\.range = range\.getAttribute\("data-range"\);[\s\S]{0,180}beginRangeLoad\(\)/);
  assert.match(homeJs, /state\.range = "custom";[\s\S]{0,80}beginRangeLoad\(\)/);
  assert.match(overviewJs, /state\.range = next;[\s\S]{0,120}beginRangeLoad\(\)/);
  assert.match(overviewJs, /hideCalPop\(\);\s*beginRangeLoad\(\);/);
  assert.match(shopsJs, /state\.range = rangeBtn\.getAttribute\("data-range"\);\s*beginRangeLoad\(\);/);
  assert.match(goodsJs, /state\.range = rangeBtn\.getAttribute\("data-range"\);\s*state\.page = 1;\s*beginRangeLoad\(\);/);
  assert.match(goodsJs, /function blankGoods\(\)/);
  assert.match(goodsJs, /const bodyRows = shown\.length \? \[sumRow\(shown\)\]\.concat\(shown\) : \[\];/);
});

test("interval refresh does not blank old numbers", () => {
  assert.match(overviewJs, /const boardTick = setInterval\(function \(\) \{\s*if \(!dead\) \{\s*load\(true\);/);
  assert.match(shopsJs, /const boardTick = setInterval\(function \(\) \{\s*if \(!dead\) \{\s*load\(true\);/);
  assert.match(homeJs, /poll = window\.setInterval\(function \(\) \{\s*if \(state\.view === "live" \|\| state\.view === "company"\) \{\s*pullLive\(\);/);
  assert.match(overviewJs, /if \(wait\) \{\s*setWait\(true\);/);
  assert.match(shopsJs, /\} else if \(wait\) \{\s*setWait\(true\);/);
});

test("waiting numbers are transparent so old values do not linger", () => {
  assert.match(css, /color: transparent !important;/);
  assert.match(css, /\.data-overview-root\.is-wait \.ch-card \.value/);
  assert.match(css, /\.data-overview-root\.is-wait \.ch-table td/);
  assert.match(css, /\.data-overview-root\.is-wait \.gd-card \.value/);
  assert.match(homeJs, /\.xm-hm\.is-wait \.xm-hm-value/);
});
