import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const homeJs = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../public/shared/modules/home.js"),
  "utf8"
);

function applyCardMove(full, hide, fromKey, toKey, visibleOnly) {
  const seq = visibleOnly ? full.filter((key) => hide.indexOf(key) === -1) : full.slice();
  const from = seq.indexOf(fromKey);
  const to = seq.indexOf(toKey);
  if (from < 0 || to < 0 || from === to) {
    return full;
  }
  seq.splice(from, 1);
  seq.splice(to, 0, fromKey);
  if (!visibleOnly) {
    return seq;
  }
  let i = 0;
  return full.map((key) => (hide.indexOf(key) !== -1 ? key : seq[i++]));
}

test("homepage module persists a shared card order", () => {
  assert.match(homeJs, /xm-home-card-order/);
  assert.match(homeJs, /function applyCardMove/);
  assert.match(homeJs, /function onSortDown/);
  assert.match(homeJs, /function onSortMenu/);
  assert.match(homeJs, /sortDragging = true/);
  assert.doesNotMatch(homeJs, /sortHold && !sortDragging[\s\S]{0,80}sortFrom = ""/);
});

test("visible card drag keeps hidden keys in place", () => {
  assert.deepEqual(applyCardMove(["a", "b", "c", "d"], ["c"], "d", "b", true), ["a", "d", "c", "b"]);
});

test("settings drag reorders the full list", () => {
  assert.deepEqual(applyCardMove(["a", "b", "c"], [], "c", "a", false), ["c", "a", "b"]);
});
