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
  assert.match(homeJs, /0\.1\.556-home-text-copy/);
  assert.match(homeJs, /\.xm-hm-table th,\.xm-hm \.xm-hm-table td[\s\S]{0,80}user-select:text/);
  assert.match(homeJs, /#xm-hm-kpis \.xm-hm-card,#xm-hm-teams \.xm-hm-card,\.xm-hm-pop label\{[^}]*user-select:none/);
  assert.match(homeJs, /if \(!sortFrom && !sortDragging\) \{\s*return;/);
  assert.match(homeJs, /if \(sortDragging \|\| colDrag\) \{\s*clearTextSelection\(\);/);
  assert.match(homeJs, /if \(sortDragging \|\| colDrag\) \{\s*event\.preventDefault\(\);/);
  assert.doesNotMatch(homeJs, /addEventListener\("contextmenu", onSortSelectStart\)/);
  assert.doesNotMatch(
    homeJs,
    /function onSortSelectStart\(event\) \{\s*var tab = event\.target\.closest/
  );
});
