import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const nav = readFileSync(join(root, "public/shared/nav.js"), "utf8");
const items = readFileSync(join(root, "src/modules/home/nav-items.js"), "utf8");
const pages = readFileSync(join(root, "src/modules/home/pages.js"), "utf8");
const middleware = readFileSync(join(root, "src/modules/profile/middleware.js"), "utf8");

test("shell pin is 0.1.692 and stays on currentUser", () => {
  assert.match(nav, /const ASSET_VER = "0\.1\.692"/);
  assert.match(nav, /0\.1\.692-sider-open/);
  assert.match(pages, /xm-fast-shell 0\.1\.692/);
  assert.match(middleware, /export const SHELL_ASSET_VER = "0\.1\.692"/);
  assert.match(middleware, /import \{ currentUser, publicProfile \} from "\.\/auth\.js"/);
  assert.doesNotMatch(nav, /currentUserAsync/);
  assert.doesNotMatch(middleware, /currentUserAsync/);
});

test("submenus start open and stay visible when leaving a group", () => {
  assert.match(items, /class="xm-menu-group is-open"/);
  assert.match(items, /aria-expanded="true"/);
  assert.match(items, /充值规则/);
  assert.match(nav, /xm-menu-group is-open/);
  assert.match(nav, /function openAllMenuGroupsOnce/);
  assert.match(nav, /group\.classList\.add\("is-open"\)/);
  assert.doesNotMatch(nav, /group\.classList\.toggle\("is-open", open\)/);
});
