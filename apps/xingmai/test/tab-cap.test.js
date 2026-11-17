import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { SHELL_ASSET_VER } from "../src/modules/profile/middleware.js";

const root = dirname(fileURLToPath(import.meta.url));
const navJs = readFileSync(join(root, "../public/shared/nav.js"), "utf8");
const layoutCss = readFileSync(join(root, "../public/shared/layout.css"), "utf8");
const pagesJs = readFileSync(join(root, "../src/modules/home/pages.js"), "utf8");

const PIN = "/home";
const TEN = [
  "/home",
  "/bound",
  "/data",
  "/shen",
  "/han",
  "/people",
  "/org",
  "/shop",
  "/academy",
  "/agents",
];

function runCapFromNav(hrefs, current, pin = PIN) {
  const match = navJs.match(/function capOpenTabs\(\) \{[\s\S]*?\n  \}/);
  assert.ok(match, "nav.js 里要有 capOpenTabs");
  const dropped = [];
  const openTabs = hrefs.slice();
  const run = new Function(
    "openTabs",
    "current",
    "deskHome",
    "leafRoute",
    "disposePane",
    "MAX_OPEN_TABS",
    `${match[0]}\ncapOpenTabs();\nreturn openTabs;`
  );
  const next = run(
    openTabs,
    current,
    function deskHome() {
      return pin;
    },
    function leafRoute(href) {
      return href;
    },
    function disposePane(href) {
      dropped.push(href);
    },
    10
  );
  return { hrefs: next, dropped };
}

test("顶栏最多 10 个页签，开第 11 个关掉首页后的第一个", () => {
  assert.equal(SHELL_ASSET_VER, "0.1.778-nochild");
  const next = "/work";
  const result = runCapFromNav([...TEN, next], next);
  assert.deepEqual(result.dropped, ["/bound"]);
  assert.equal(result.hrefs.length, 10);
  assert.equal(result.hrefs[0], PIN);
  assert.equal(result.hrefs[1], "/data");
  assert.equal(result.hrefs.at(-1), next);
});

test("再开第 12 个继续关掉首页后的第一个，永远不超过 10 个", () => {
  const first = runCapFromNav([...TEN, "/work"], "/work");
  const second = runCapFromNav([...first.hrefs, "/meeting"], "/meeting");
  assert.deepEqual(second.dropped, ["/data"]);
  assert.equal(second.hrefs.length, 10);
  assert.equal(second.hrefs[0], PIN);
  assert.equal(second.hrefs[1], "/shen");
  assert.equal(second.hrefs.at(-1), "/meeting");
});

test("已经打开过的页签不会挤掉别的页", () => {
  const result = runCapFromNav(TEN, "/org");
  assert.deepEqual(result.dropped, []);
  assert.deepEqual(result.hrefs, TEN);
});

test("恢复超过 10 个时从首页后往前关，当前页和首页都留着", () => {
  const hrefs = [...TEN, "/work", "/meeting", "/feedback"];
  const result = runCapFromNav(hrefs, "/meeting");
  assert.equal(result.hrefs.length, 10);
  assert.ok(result.hrefs.includes(PIN));
  assert.ok(result.hrefs.includes("/meeting"));
  assert.equal(result.hrefs[0], PIN);
  assert.deepEqual(result.dropped, ["/bound", "/data", "/shen"]);
});

test("人事桌面钉住智能人事，关掉它后面的第一个", () => {
  const hrefs = ["/hr", "/people", "/me", "/work", "/meeting", "/feedback", "/data", "/shen", "/han", "/academy", "/agents"];
  const result = runCapFromNav(hrefs, "/agents", "/hr");
  assert.deepEqual(result.dropped, ["/people"]);
  assert.equal(result.hrefs.length, 10);
  assert.equal(result.hrefs[0], "/hr");
  assert.equal(result.hrefs.at(-1), "/agents");
});

test("壳层页签用同一套上限，打开和恢复都会裁", () => {
  assert.match(navJs, /const MAX_OPEN_TABS = 10;/);
  assert.match(navJs, /function capOpenTabs\(\)/);
  assert.match(navJs, /while \(openTabs\.length > MAX_OPEN_TABS\)/);
  assert.match(navJs, /if \(href === pin \|\| href === keep\)/);
  assert.match(navJs, /openTabs\.splice\(dropAt, 1\);\s*disposePane\(drop\);/);
  assert.match(navJs, /capOpenTabs\(\);\s*writeOpenTabs\(\);/);
  assert.match(navJs, /0\.1\.774-tabcap/);
  assert.match(layoutCss, /xm-tab-cap 0\.1\.774-tabcap/);
  assert.match(pagesJs, /xm-fast-shell 0\.1\.778-nochild/);
});
