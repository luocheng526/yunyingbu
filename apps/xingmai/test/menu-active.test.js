import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { navMarkup } from "../src/modules/home/nav-items.js";
import { SHELL_ASSET_VER } from "../src/modules/profile/middleware.js";

const root = dirname(fileURLToPath(import.meta.url));
const layoutCss = readFileSync(join(root, "../public/shared/layout.css"), "utf8");
const navJs = readFileSync(join(root, "../public/shared/nav.js"), "utf8");
const luocheng = { username: "罗成", displayName: "罗成" };

test("选中菜单用浅色渐变，不要投影，暗色粉红不盖掉", () => {
  assert.equal(SHELL_ASSET_VER, "0.1.773-tabkeep");
  assert.match(layoutCss, /xm-menu-lite 0\.1\.772-menulite/);
  assert.match(layoutCss, /\.xm-menu-item\.is-active/);
  assert.match(layoutCss, /\.xm-menu-group\.is-current > \.xm-menu-parent/);
  assert.match(layoutCss, /linear-gradient\([\s\S]*color-mix\(in srgb, var\(--xm-primary\)/);
  assert.doesNotMatch(layoutCss, /--xm-menu-glow:/);
  assert.doesNotMatch(layoutCss, /0 8px 18px/);
  assert.match(layoutCss, /html\[data-theme="dark"\] \.xm-menu-item\.is-active/);
  assert.match(layoutCss, /html\[data-theme="pink"\]/);
  assert.match(layoutCss, /--xm-primary: #1677ff/);
  assert.match(layoutCss, /--xm-primary: #f8005f/);
  assert.match(navJs, /ASSET_VER = "0\.1\.773-tabkeep"/);
  assert.match(navJs, /is-open is-current/);
  assert.match(navJs, /xm-menu-item xm-menu-parent' \+[\s\S]*is-active/);
});

test("点数据总揽时一级星脉数据中心和当前子项都标成选中", () => {
  const html = navMarkup("/data/overview", luocheng);
  assert.match(html, /xm-menu-group is-open is-current" data-xm-group="\/data"/);
  assert.match(html, /xm-menu-item xm-menu-parent is-active"/);
  assert.match(html, /星脉数据中心/);
  assert.match(html, /xm-menu-item xm-menu-child is-active" href="\/data\/overview"/);
  assert.match(html, /数据总揽/);
  assert.doesNotMatch(html, /xm-menu-group is-open is-current" data-xm-group="\/shen"/);
  const home = navMarkup("/home", luocheng);
  assert.match(home, /xm-menu-item is-active" href="\/home"/);
  assert.doesNotMatch(home, /xm-menu-group is-open is-current" data-xm-group="\/data"/);
});

test("顶栏页签是独立表头，不贴蓝线，电脑上不出现空白菜单按钮", () => {
  assert.match(layoutCss, /xm-notice-head 0\.1\.772-notice/);
  assert.match(layoutCss, /xm-tabs-keep 0\.1\.773-tabkeep/);
  assert.match(layoutCss, /\.xm-phone-menu,\s*\.xm-phone-mask \{\s*display:\s*none/);
  assert.match(layoutCss, /\.xm-topbar \{[\s\S]*align-items:\s*center/);
  assert.match(layoutCss, /\.xm-tabs \{[\s\S]*align-items:\s*center/);
  assert.doesNotMatch(layoutCss, /\.xm-tabs \{[\s\S]*align-items:\s*flex-end/);
  assert.match(layoutCss, /\.xm-tab \{[\s\S]*border-radius:\s*4px;/);
  assert.match(layoutCss, /\.xm-tab-close \{[\s\S]*appearance:\s*none/);
  assert.match(layoutCss, /\.xm-tab-close \{[\s\S]*opacity:\s*0\.45/);
  assert.match(layoutCss, /\.xm-tab\.is-pinned \.xm-tab-close/);
  assert.doesNotMatch(layoutCss, /\.xm-tab\.is-active::after/);
});

test("组织中心藏页签时壳层仍强制显示首页等页签", () => {
  assert.match(layoutCss, /\.xm-tabs \{[\s\S]*display:\s*flex\s*!important/);
  assert.match(layoutCss, /\.xm-topbar > \.xm-tabs\[hidden\] \{[\s\S]*display:\s*flex\s*!important/);
  assert.match(
    layoutCss,
    /html body:has\(\.xm-shell\) \.xm-topbar > \.xm-tabs\[hidden\] \{[\s\S]*display:\s*flex\s*!important/
  );
  assert.match(navJs, /setProperty\("display", "flex", "important"\)/);
  assert.match(navJs, /data-people-hid/);
  assert.match(navJs, /\.xm-topbar>\.xm-tabs\[hidden\]\{display:flex!important/);
});

test("顶栏下面有公告栏，重要公告是红字", () => {
  assert.match(layoutCss, /\.xm-notice-bar \{[\s\S]*background:\s*var\(--xm-primary-soft\)/);
  assert.match(layoutCss, /\.xm-notice-kicker \{[\s\S]*color:\s*var\(--xm-primary\)/);
  assert.match(layoutCss, /\.xm-notice-link\.is-important \{[\s\S]*color:\s*#cf1322/);
  assert.match(layoutCss, /\.xm-notice-more \{[\s\S]*color:\s*var\(--xm-primary\)/);
  assert.match(navJs, /全部公告/);
  assert.match(navJs, /function showNoticePopup\(item\)/);
  assert.match(navJs, /xm-notice-pop-open/);
  assert.doesNotMatch(navJs, /new MutationObserver\(function \(\) \{\s*closeNoticePopup\(\)/);
});

test("人事桌面选中智能人事时仍只有两个入口", () => {
  const html = navMarkup("/hr", { username: "张璇", displayName: "张璇", desk: "hr" });
  const labels = [...html.matchAll(/<span>([^<]+)<\/span>/g)].map((item) => item[1]);
  assert.deepEqual(
    labels.filter((item) => item !== "退出登录"),
    ["智能人事", "个人中心"]
  );
  assert.match(html, /xm-menu-item is-active" href="\/hr"/);
});
