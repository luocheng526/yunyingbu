import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const nav = readFileSync(join(root, "public/shared/nav.js"), "utf8");
const pages = readFileSync(join(root, "src/modules/home/pages.js"), "utf8");
const middleware = readFileSync(join(root, "src/modules/profile/middleware.js"), "utf8");

test("shell pair pins 0.1.657 and stays on currentUser", () => {
  assert.match(nav, /const ASSET_VER = "0\.1\.657"/);
  assert.match(nav, /0\.1\.657-shell-bust/);
  assert.match(pages, /xm-fast-shell 0\.1\.657/);
  assert.match(middleware, /export const SHELL_ASSET_VER = "0\.1\.657"/);
  assert.match(middleware, /xm-fast-shell 0\.1\.657/);
  assert.match(middleware, /import \{ currentUser, publicProfile \} from "\.\/auth\.js"/);
  assert.doesNotMatch(nav, /currentUserAsync/);
  assert.doesNotMatch(pages, /currentUserAsync/);
  assert.doesNotMatch(middleware, /currentUserAsync/);
});

test("login notice mask is not created", () => {
  assert.match(nav, /function showNoticePopup\(\) \{\s*closeNoticePopup\(\);/);
  assert.doesNotMatch(nav, /id="xm-notice-mask"/);
});
