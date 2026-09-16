import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const homeJs = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../public/shared/modules/home.js"),
  "utf8"
);

test("home allows copying table text and only clears selection while dragging", () => {
  assert.match(homeJs, /0\.1\.612-data-range-blank/);
  assert.match(homeJs, /\.xm-hm-card,\.xm-hm-pop label\{[^}]*user-select:none/);
  assert.match(homeJs, /if \(sortFrom \|\| sortDragging\) \{\s*clearTextSelection\(\);/);
  assert.match(homeJs, /function beginRangeLoad\(\)/);
});
