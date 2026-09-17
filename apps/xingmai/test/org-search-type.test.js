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

test("login notice is not created or kept on /people", () => {
  assert.match(nav, /0\.1\.654-org-mask-off/);
  assert.match(nav, /function isPeopleRoute\(/);
  assert.match(nav, /function closeNoticePopup\(/);
  assert.match(nav, /function relaxNoticeForPeople\(/);
  assert.match(nav, /function watchNoticeMask\(/);
  assert.match(nav, /watchNoticeMask\(\)/);
  assert.match(nav, /relaxNoticeForPeople\(\)/);
  assert.match(nav, /function fillNoticeBar\(/);
  assert.match(nav, /id="xm-notice-bar"|getElementById\("xm-notice-bar"\)/);
  assert.doesNotMatch(nav, /asToast/);
  assert.doesNotMatch(nav, /data-xm-toast/);
  assert.doesNotMatch(nav, /function disarmNoticeDialog\(/);
  assert.doesNotMatch(nav, /function ensureNoticeToastCss\(/);
});

test("showNoticePopup returns before creating a mask on /people", () => {
  const body = sliceFn("showNoticePopup", "bootNoticePopup");
  const returnIdx = body.search(/if \(isPeopleRoute\(\)\) \{\s*return;/);
  const createIdx = body.indexOf('document.createElement("div")');
  assert.ok(returnIdx >= 0, "early-return on people route");
  assert.ok(createIdx > returnIdx, "mask is created only after the people early-return");
  assert.match(body, /role="dialog" aria-modal="true"/);
});

test("relaxNoticeForPeople removes an existing mask", () => {
  const body = sliceFn("relaxNoticeForPeople", "watchNoticeMask");
  assert.match(body, /if \(!isPeopleRoute\(\)\) \{\s*return;/);
  assert.match(body, /closeNoticePopup\(\)/);
  assert.doesNotMatch(body, /disarmNoticeDialog/);
});

test("parkPeopleHosts keeps people-page by href, not only is-active", () => {
  assert.match(nav, /pane\.getAttribute\("data-xm-href"\) === "\/people"/);
  assert.doesNotMatch(
    nav,
    /const inActive = el\.closest\("\.xm-pane\.is-active"\);\s*if \(onPeople && inActive\)/
  );
});
