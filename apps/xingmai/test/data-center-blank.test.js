import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const overview = readFileSync(join(root, "public/data-overview.js"), "utf8");
const data = readFileSync(join(root, "public/shared/modules/data.js"), "utf8");

test("overview range change blanks then fetches, interval refresh does not", () => {
  assert.match(overview, /xm-data-overview 0\.1\.626-data-range-blank/);
  assert.match(overview, /function afterPaint\(/);
  assert.match(overview, /function beginRangeLoad\(/);
  assert.match(overview, /function load\(forceBoard, opts\)/);
  assert.match(overview, /const wait = !!\(opts && opts\.wait\)/);
  assert.match(overview, /return afterPaint\(function \(\) \{\s*return load\(true, \{ wait: true \}\)/);
  assert.match(overview, /color:transparent!important/);
  assert.doesNotMatch(overview, /\.is-wait [^{]*\{color:#fff\}/);
  const tick = overview.match(/const boardTick = setInterval\([\s\S]{0,180}?, OV_BOARD_FRESH_MS\)/);
  assert.ok(tick, "boardTick interval exists");
  assert.match(tick[0], /load\(true\)/);
  assert.doesNotMatch(tick[0], /wait:\s*true/);
  assert.match(overview, /beginRangeLoad\(\);\s*return;/);
});

test("data.js isolates panes and cache-busts the overview script", () => {
  assert.match(data, /xm-module-data 0\.1\.626-data-range-blank/);
  assert.match(data, /function resetDataPage\(/);
  assert.match(data, /id="board-' \+\s*kind \+\s*'"/);
  assert.match(data, /data-overview\.js\?v=0\.1\.626-data-range-blank/);
  assert.match(data, /data-shops\.js\?v=0\.1\.626-data-range-blank/);
  assert.match(data, /data-goods\.js\?v=0\.1\.626-data-range-blank/);
  assert.doesNotMatch(data, /restore-v1/);
  assert.doesNotMatch(data, /if \(root && !root\.querySelector\("#board"\)\)/);
});
