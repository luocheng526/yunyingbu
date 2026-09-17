import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const js = readFileSync(join(root, "public/shared/modules/people.js"), "utf8");
const css = readFileSync(join(root, "public/people.css"), "utf8");

test("live search waits for IME and restores focus", () => {
  assert.match(js, /0\.1\.658-search-ime/);
  assert.match(js, /insertCompositionText/);
  assert.match(js, /event\.isComposing/);
  assert.match(js, /setTimeout\(function \(\) \{/);
  assert.match(js, /document\.activeElement === input/);
  assert.match(js, /input\.focus\(\)/);
  assert.doesNotMatch(js, /currentUserAsync/);
});

test("leftover notice mask cannot steal people search clicks", () => {
  assert.match(css, /0\.1\.658-search-ime/);
  assert.match(css, /#xm-notice-mask \* \{\s*pointer-events: none !important;/);
  assert.match(css, /#org-q/);
  assert.match(css, /#people-q/);
});
