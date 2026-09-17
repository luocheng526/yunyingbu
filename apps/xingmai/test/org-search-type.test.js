import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const nav = readFileSync(join(root, "public/shared/nav.js"), "utf8");

test("nav keeps 0.1.625 pin and does not use currentUserAsync", () => {
  assert.match(nav, /const ASSET_VER = "0\.1\.625"/);
  assert.doesNotMatch(nav, /currentUserAsync/);
});

test("login notice on /people is a toast, not a modal dialog", () => {
  assert.match(nav, /0\.1\.651-org-search-type/);
  assert.match(nav, /function isPeopleRoute\(/);
  assert.match(nav, /function disarmNoticeDialog\(/);
  assert.match(nav, /function relaxNoticeForPeople\(/);
  assert.match(nav, /function watchNoticeMask\(/);
  assert.match(nav, /data-xm-toast/);
  assert.match(nav, /pointer-events:none!important/);
  assert.match(nav, /asToast \? "" : ' role="dialog" aria-modal="true"'/);
  assert.match(nav, /dialog\.removeAttribute\("role"\)/);
  assert.match(nav, /watchNoticeMask\(\)/);
  assert.match(nav, /relaxNoticeForPeople\(\)/);
});

test("parkPeopleHosts keeps people-page by href, not only is-active", () => {
  assert.match(nav, /pane\.getAttribute\("data-xm-href"\) === "\/people"/);
  assert.doesNotMatch(
    nav,
    /const inActive = el\.closest\("\.xm-pane\.is-active"\);\s*if \(onPeople && inActive\)/
  );
});
