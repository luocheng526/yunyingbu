import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const nav = readFileSync(join(root, "public/shared/nav.js"), "utf8");

function sliceFn(name, nextName) {
  const start = nav.indexOf("function " + name);
  const end = nav.indexOf("function " + nextName);
  assert.ok(start >= 0 && end > start, name + " is present");
  return nav.slice(start, end);
}

test("nav keeps 0.1.625 pin and does not use currentUserAsync", () => {
  assert.match(nav, /const ASSET_VER = "0\.1\.625"/);
  assert.doesNotMatch(nav, /currentUserAsync/);
});

test("login notice mask is never mounted", () => {
  assert.match(nav, /0\.1\.656-site-open/);
  assert.match(nav, /function closeNoticePopup\(/);
  assert.match(nav, /function showNoticePopup\(/);
  assert.match(nav, /function watchNoticeMask\(/);
  assert.match(nav, /watchNoticeMask\(\)/);
  assert.match(nav, /function fillNoticeBar\(/);
  assert.match(nav, /getElementById\("xm-notice-bar"\)/);
  assert.doesNotMatch(nav, /asToast/);
  assert.doesNotMatch(nav, /data-xm-toast/);
  assert.doesNotMatch(nav, /function disarmNoticeDialog\(/);
  assert.doesNotMatch(nav, /id="xm-notice-mask"/);
});

test("showNoticePopup only closes an existing mask", () => {
  const body = sliceFn("showNoticePopup", "bootNoticePopup");
  assert.match(body, /closeNoticePopup\(\)/);
  assert.doesNotMatch(body, /document\.createElement/);
  assert.doesNotMatch(body, /appendChild/);
  assert.doesNotMatch(body, /role="dialog"/);
});

test("watchNoticeMask strips leftover masks on every route", () => {
  const body = sliceFn("watchNoticeMask", "showNoticePopup");
  assert.match(body, /closeNoticePopup\(\)/);
  assert.doesNotMatch(body, /isPeopleRoute/);
});

test("parkPeopleHosts keeps people-page by href, not only is-active", () => {
  assert.match(nav, /pane\.getAttribute\("data-xm-href"\) === "\/people"/);
  assert.doesNotMatch(
    nav,
    /const inActive = el\.closest\("\.xm-pane\.is-active"\);\s*if \(onPeople && inActive\)/
  );
});
