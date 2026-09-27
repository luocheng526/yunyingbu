import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { canSeeStaffNav, navMarkup } from "../src/modules/home/nav-items.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const nav = readFileSync(join(root, "public/shared/nav.js"), "utf8");
const items = readFileSync(join(root, "src/modules/home/nav-items.js"), "utf8");
const pages = readFileSync(join(root, "src/modules/home/pages.js"), "utf8");
const middleware = readFileSync(join(root, "src/modules/profile/middleware.js"), "utf8");

test("shell pin is 0.1.699 and menus stay collapsed by default", () => {
  assert.match(nav, /const ASSET_VER = "0\.1\.699"/);
  assert.match(nav, /0\.1\.699-sider-rules/);
  assert.match(pages, /xm-fast-shell 0\.1\.699/);
  assert.match(middleware, /export const SHELL_ASSET_VER = "0\.1\.699"/);
  assert.match(middleware, /import \{ currentUser, publicProfile \} from "\.\/auth\.js"/);
  assert.match(nav, /group\.classList\.toggle\("is-open", open\)/);
  assert.match(items, /const open = childActive\(item, activeHref\)/);
  assert.doesNotMatch(nav, /openAllMenuGroupsOnce/);
  assert.doesNotMatch(items, /xm-menu-group is-open/);
  assert.doesNotMatch(nav, /currentUserAsync/);
  assert.doesNotMatch(middleware, /currentUserAsync/);
});

test("Shen and Han first paint include 充值规则", () => {
  assert.match(items, /href: "\/shen\/recharge-rules", label: "充值规则"/);
  assert.match(items, /href: "\/han\/recharge-rules", label: "充值规则"/);
  assert.match(nav, /href: "\/shen\/recharge-rules", label: "充值规则"/);
  assert.match(nav, /href: "\/han\/recharge-rules", label: "充值规则"/);
  const me = navMarkup("/me", { username: "罗成" });
  assert.match(me, /href="\/shen\/recharge-rules"/);
  assert.match(me, /href="\/han\/recharge-rules"/);
  assert.match(me, /class="xm-menu-group" data-xm-group="\/shen"/);
  const paid = navMarkup("/shen/paid", { username: "罗成" });
  assert.match(paid, /class="xm-menu-group is-open" data-xm-group="\/shen"/);
  assert.match(paid, /href="\/shen\/recharge-rules"/);
});

test("版本中心 and 组织中心 are only for 罗成 韩梦凯 沈子晗", () => {
  assert.equal(canSeeStaffNav({ username: "罗成" }), true);
  assert.equal(canSeeStaffNav({ username: "韩梦凯" }), true);
  assert.equal(canSeeStaffNav({ username: "沈子晗" }), true);
  assert.equal(canSeeStaffNav("luocheng"), true);
  assert.equal(canSeeStaffNav({ username: "张文静" }), false);
  assert.equal(canSeeStaffNav({ username: "杨润泽" }), false);
  assert.equal(canSeeStaffNav(null), false);
  const boss = navMarkup("/me", { username: "罗成" });
  assert.match(boss, /href="\/releases"/);
  assert.match(boss, /data-xm-group="\/people"/);
  const other = navMarkup("/me", { username: "张文静" });
  assert.doesNotMatch(other, /href="\/releases"/);
  assert.doesNotMatch(other, /data-xm-group="\/people"/);
  assert.match(other, /href="\/me"/);
});
