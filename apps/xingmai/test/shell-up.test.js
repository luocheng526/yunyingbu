import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { canSeeStaffNav, navMarkup, orgNavFlags } from "../src/modules/home/nav-items.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const nav = readFileSync(join(root, "public/shared/nav.js"), "utf8");
const items = readFileSync(join(root, "src/modules/home/nav-items.js"), "utf8");
const pages = readFileSync(join(root, "src/modules/home/pages.js"), "utf8");
const middleware = readFileSync(join(root, "src/modules/profile/middleware.js"), "utf8");

test("shell pin is 0.1.713 and menus stay collapsed by default", () => {
  assert.match(nav, /const ASSET_VER = "0\.1\.713"/);
  assert.match(nav, /0\.1\.713-org-nav/);
  assert.match(pages, /xm-fast-shell 0\.1\.713/);
  assert.match(middleware, /export const SHELL_ASSET_VER = "0\.1\.713"/);
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

test("Shen and Han centers are org-scoped; the three bosses see both", () => {
  const boss = navMarkup("/me", { username: "罗成" });
  assert.match(boss, /data-xm-group="\/shen"/);
  assert.match(boss, /data-xm-group="\/han"/);
  const hanBoss = navMarkup("/me", { username: "韩梦凯", department: "韩梦凯运营中心" });
  assert.match(hanBoss, /data-xm-group="\/shen"/);
  assert.match(hanBoss, /data-xm-group="\/han"/);
  const shenBoss = navMarkup("/me", { username: "沈子晗", department: "沈子晗运营中心" });
  assert.match(shenBoss, /data-xm-group="\/shen"/);
  assert.match(shenBoss, /data-xm-group="\/han"/);
  const shenOps = navMarkup("/me", { username: "张文静", center: "沈子晗运营中心" });
  assert.match(shenOps, /data-xm-group="\/shen"/);
  assert.doesNotMatch(shenOps, /data-xm-group="\/han"/);
  const hanOps = navMarkup("/me", { username: "林晓彬", center: "韩梦凯运营中心" });
  assert.match(hanOps, /data-xm-group="\/han"/);
  assert.doesNotMatch(hanOps, /data-xm-group="\/shen"/);
  assert.equal(orgNavFlags({ username: "张文静", center: "沈子晗运营中心" }).han, false);
  assert.equal(orgNavFlags({ username: "林晓彬", lineManager: "韩梦凯" }).han, true);
  assert.equal(orgNavFlags({ username: "韩梦凯" }).shen, true);
});
