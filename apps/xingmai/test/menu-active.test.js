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

test("选中菜单用更深的主题色渐变，暗色粉红不盖掉", () => {
  assert.equal(SHELL_ASSET_VER, "0.1.772-navhot");
  assert.match(layoutCss, /xm-nav-hot 0\.1\.772-navhot/);
  assert.match(layoutCss, /--xm-menu-glow:/);
  assert.match(layoutCss, /\.xm-menu-item\.is-active/);
  assert.match(layoutCss, /\.xm-menu-group\.is-current > \.xm-menu-parent/);
  assert.match(layoutCss, /linear-gradient\(135deg, var\(--xm-primary-deep\)/);
  assert.match(layoutCss, /linear-gradient\(180deg, rgba\(255, 255, 255/);
  assert.match(layoutCss, /html\[data-theme="dark"\] \.xm-menu-item\.is-active/);
  assert.match(layoutCss, /html\[data-theme="pink"\]/);
  assert.match(layoutCss, /--xm-primary: #1677ff/);
  assert.match(layoutCss, /--xm-primary: #f8005f/);
  assert.doesNotMatch(
    layoutCss,
    /\.xm-menu-item\.is-active,\s*\.xm-menu-item\[aria-current="page"\] \{\s*background: var\(--xm-primary-soft\)/
  );
  assert.match(navJs, /ASSET_VER = "0\.1\.772-navhot"/);
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

test("人事桌面选中智能人事时仍只有两个入口", () => {
  const html = navMarkup("/hr", { username: "张璇", displayName: "张璇", desk: "hr" });
  const labels = [...html.matchAll(/<span>([^<]+)<\/span>/g)].map((item) => item[1]);
  assert.deepEqual(
    labels.filter((item) => item !== "退出登录"),
    ["智能人事", "个人中心"]
  );
  assert.match(html, /xm-menu-item is-active" href="\/hr"/);
});
