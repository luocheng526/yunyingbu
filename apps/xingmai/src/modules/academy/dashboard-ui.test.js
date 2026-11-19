import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const js = await readFile(new URL("../../../public/shared/modules/academy.js", import.meta.url), "utf8");
const css = await readFile(new URL("../../../public/academy.css", import.meta.url), "utf8");
const shellNav = await readFile(new URL("../../../public/shared/nav.js", import.meta.url), "utf8");
const navItems = await readFile(new URL("../home/nav-items.js", import.meta.url), "utf8");
const shellPages = await readFile(new URL("../home/pages.js", import.meta.url), "utf8");
const shellMiddleware = await readFile(new URL("../profile/middleware.js", import.meta.url), "utf8");

test("academy root mounts the complete learning dashboard", () => {
  assert.match(js, /function dashboardPage/);
  assert.match(js, /XmModules\["\/academy"\] = dashboardPage\(\)/);
  assert.match(js, /XmModules\["\/academy\/courses"\] = dashboardPage\(\)/);
  assert.match(js, /XmModules\["\/academy\/courseware"\] = courses/);
  assert.match(js, /甄选商学院/);
  assert.match(js, /在学人数/);
  assert.match(js, /课程总数/);
  assert.match(js, /题库数量/);
  assert.match(js, /本月考试/);
  assert.match(js, /待晋级/);
  assert.match(js, /学习完成率/);
  assert.match(js, /快捷入口/);
  assert.match(js, /推荐课程/);
  assert.match(js, /我的学习/);
  assert.match(js, /运营手册（SOP）/);
  assert.match(js, /运营知识库/);
  assert.match(js, /职级晋升/);
});

test("dashboard controls connect to academy routes and APIs", () => {
  assert.match(js, /data-go="\/academy\/courseware"/);
  assert.match(js, /data-go="\/academy\/exams"/);
  assert.match(js, /data-go="\/academy\/handbook"/);
  assert.match(js, /api\("\/api\/academy"\)/);
  assert.match(js, /api\("\/api\/academy\/courses"\)/);
  assert.match(js, /api\("\/api\/academy\/progress"\)/);
  assert.match(js, /\/api\/academy\/search\?q=/);
  assert.match(js, /data-course-tab/);
  assert.match(js, /window\.history\.pushState/);
});

test("dashboard CSS reproduces the reference hierarchy and responsive layout", () => {
  assert.match(css, /\.academy-page\s*\{[^}]*max-width:\s*none/s);
  assert.match(css, /\.academy-page\s*\{[^}]*width:\s*100%/s);
  assert.match(css, /\.xm-pane\.is-active:has\(\.academy-dashboard\)/);
  assert.match(css, /\.academy-home-grid\s*\{[^}]*flex:\s*1 1 auto/s);
  assert.match(css, /\.academy-library-grid\s*\{[^}]*align-items:\s*stretch/s);
  assert.match(css, /\.academy-dashboard/);
  assert.match(css, /\.academy-home-head/);
  assert.match(css, /\.academy-metrics/);
  assert.match(css, /grid-template-columns:\s*repeat\(6/);
  assert.match(css, /\.academy-hero-row/);
  assert.match(css, /\.academy-quick-grid/);
  assert.match(css, /\.academy-recommend-grid/);
  assert.match(css, /\.academy-library-grid/);
  assert.match(css, /\.academy-learning-body/);
  assert.match(css, /\.academy-levels/);
  assert.match(css, /\.academy-promotion-box/);
  assert.match(css, /@media \(max-width:\s*900px\)/);
  assert.match(css, /@media \(max-width:\s*620px\)/);
});

test("academy is one top-level menu without sidebar children", () => {
  assert.match(shellNav, /\{ href: "\/academy", label: "甄选商学院" \}/);
  assert.doesNotMatch(shellNav, /const ACADEMY_CHILDREN/);
  assert.doesNotMatch(shellNav, /"\/academy": "\/academy\/courses"/);
  assert.match(navItems, /export const ACADEMY_CHILDREN = \[\]/);
  assert.match(navItems, /\{ href: "\/academy", label: "甄选商学院" \}/);
});

test("shell cache pin refreshes the academy menu and module", () => {
  assert.match(shellNav, /xm-fast-shell 0\.1\.147/);
  assert.match(shellPages, /xm-fast-shell 0\.1\.147/);
  assert.match(shellMiddleware, /xm-fast-shell 0\.1\.147/);
  assert.match(shellMiddleware, /SHELL_ASSET_VER = "0\.1\.147"/);
  assert.match(shellMiddleware, /shared\/nav\.js\?v=\$\{SHELL_ASSET_VER\}/);
});
