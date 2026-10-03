import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  allowCenterShop,
  canSeeStaffNav,
  centerNameSet,
  dutyNameSet,
  filterCenterPayload,
  navMarkup,
  orgNavFlags,
  shopKey,
  shopNameOf,
  skipCenterFilter
} from "../src/modules/home/nav-items.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const nav = readFileSync(join(root, "public/shared/nav.js"), "utf8");
const items = readFileSync(join(root, "src/modules/home/nav-items.js"), "utf8");
const pages = readFileSync(join(root, "src/modules/home/pages.js"), "utf8");
const middleware = readFileSync(join(root, "src/modules/profile/middleware.js"), "utf8");

test("shell pin is 0.1.762 and menus stay collapsed by default", () => {
  assert.match(nav, /const ASSET_VER = "0\.1\.762"/);
  assert.match(nav, /0\.1\.762-han-paid-click/);
  assert.match(pages, /xm-fast-shell 0\.1\.762/);
  assert.match(middleware, /export const SHELL_ASSET_VER = "0\.1\.762"/);
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

test("Shen and Han shop lists stay on their own org and duty line", () => {
  const stores = [
    { storeName: "RASW家居旗舰店", manager: "沈子晗", reserve: "张文静", operator: "张文静" },
    { storeName: "飒望旗舰店", manager: "沈子晗", supervisor: "杨润泽" },
    { storeName: "ZYUO洗护旗舰店", manager: "韩梦凯", supervisor: "陈晓曼", operator: "陈晓曼" },
    { storeName: "飒望玩具旗舰店", manager: "韩梦凯", operator: "林晓彬" }
  ];
  const people = [
    { name: "张文静", username: "张文静", visibleShops: ["RASW家居旗舰店"] },
    { name: "林晓彬", username: "林晓彬", visibleShops: [] }
  ];
  const shen = centerNameSet(stores, "shen");
  const han = centerNameSet(stores, "han");
  assert.equal(!!shen[shopKey("RASW家居旗舰店")], true);
  assert.equal(!!shen[shopKey("ZYUO洗护旗舰店")], false);
  assert.equal(!!han[shopKey("ZYUO洗护旗舰店")], true);
  assert.equal(allowCenterShop("RASW家居旗舰店", "shen", shen, {}, true), true);
  assert.equal(allowCenterShop("ZYUO洗护旗舰店", "shen", shen, {}, true), false);
  assert.equal(allowCenterShop("ZYUO洗护旗舰店", "han", han, {}, true), true);
  const jingDuty = dutyNameSet({ username: "张文静" }, stores, people);
  assert.equal(allowCenterShop("RASW家居旗舰店", "shen", shen, jingDuty, false), true);
  assert.equal(allowCenterShop("飒望旗舰店", "shen", shen, jingDuty, false), false);
  const linDuty = dutyNameSet({ username: "林晓彬" }, stores, people);
  assert.equal(allowCenterShop("飒望玩具旗舰店", "han", han, linDuty, false), true);
  assert.equal(allowCenterShop("ZYUO洗护旗舰店", "han", han, linDuty, false), false);
  const paid = filterCenterPayload(
    {
      enabledStores: ["RASW家居旗舰店", "ZYUO洗护旗舰店"],
      rows: [{ store: "RASW家居旗舰店" }, { store: "ZYUO洗护旗舰店" }],
      metrics: { stores: 2 }
    },
    (name) => allowCenterShop(name, "shen", shen, {}, true)
  );
  assert.deepEqual(paid.enabledStores, ["RASW家居旗舰店"]);
  assert.equal(paid.rows.length, 1);
  assert.equal(paid.metrics.stores, 1);
  assert.match(nav, /installCenterFetchGuard/);
  assert.match(nav, /window\.XmOrgScope/);
  assert.match(nav, /isCenterUiWorkerView/);
  assert.equal(shopNameOf({ 店铺名称: "帕华汽车用品专营店" }), "帕华汽车用品专营店");
  assert.equal(skipCenterFilter("/api/han/worker", "GET"), true);
  assert.equal(skipCenterFilter("/api/han/worker?view=overview", "GET"), false);
  assert.equal(skipCenterFilter("/api/han/worker?view=rules", "GET"), false);
  assert.equal(skipCenterFilter("/api/han/worker?view=shop&store=ZYUO洗护旗舰店", "GET"), false);
  assert.equal(skipCenterFilter("/api/han/worker?view=history", "GET"), false);
  assert.equal(skipCenterFilter("/api/shen/paid/worker-status", "GET"), true);
  assert.equal(skipCenterFilter("/api/han/worker?view=overview", "POST"), true);
  const overview = filterCenterPayload(
    {
      shops: [
        { store: "ZYUO洗护旗舰店", spend: 10 },
        { store: "RASW家居旗舰店", spend: 8 },
        { store: "帕华汽车用品专营店", spend: 3 }
      ],
      stores: ["ZYUO洗护旗舰店", "RASW家居旗舰店", "帕华汽车用品专营店"],
      shopRuns: [{ store: "ZYUO洗护旗舰店" }, { store: "RASW家居旗舰店" }],
      runs: [{ store: "ZYUO洗护旗舰店" }],
      metrics: { stores: 3, shops: 3, spend: 21 },
      totals: { stores: 3, spend: 21 }
    },
    (name) => allowCenterShop(name, "han", han, {}, true)
  );
  assert.deepEqual(overview.stores, ["ZYUO洗护旗舰店"]);
  assert.equal(overview.shops.length, 1);
  assert.equal(overview.shops[0].store, "ZYUO洗护旗舰店");
  assert.equal(overview.shopRuns.length, 1);
  assert.equal(overview.metrics.stores, 1);
  assert.equal(overview.metrics.spend, 10);
  const denied = filterCenterPayload(
    { store: "RASW家居旗舰店", shop: { store: "RASW家居旗舰店" }, subaccounts: [{ store: "RASW家居旗舰店" }] },
    (name) => allowCenterShop(name, "han", han, {}, true),
    "RASW家居旗舰店"
  );
  assert.equal(denied.forbidden, true);
  assert.equal(denied.store, "");
  assert.deepEqual(denied.subaccounts, []);
});

test("Han 实时付费 sider and top tab both open the page", () => {
  const han = readFileSync(join(root, "public/shared/modules/han.js"), "utf8");
  assert.match(items, /href: "\/han\/paid", label: "实时付费"/);
  assert.doesNotMatch(items, /href: "\/han\/paid", label: "实时付费", attrs: \{ "data-han-center": "center" \}/);
  assert.doesNotMatch(nav, /href: "\/han\/paid", label: "实时付费", attrs: \{ "data-han-center": "center" \}/);
  const paid = navMarkup("/han/paid", { username: "罗成" });
  assert.match(paid, /href="\/han\/paid"/);
  assert.doesNotMatch(paid, /href="\/han\/paid"[^>]*data-han-center="center"/);
  assert.match(han, /function isHanBoardHref/);
  assert.match(han, /path === "\/han\/paid" && !isHanBoardHref\(target\)/);
  assert.match(han, /window\.__xmGo\("\/han\/paid"\)/);
  assert.match(nav, /const shown = pane && pane.classList.contains\("is-active"\) && !pane.hidden/);
  assert.match(han, /if \(menu && href && isHanBoardHref\(href\)\)/);
  assert.doesNotMatch(han, /\/han\/paid\?board=center", "付费中心"/);
});
