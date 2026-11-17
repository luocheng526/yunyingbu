import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import express from "express";
import { NAV_FOOT, NAV_MAIN, navMarkup } from "../src/modules/home/nav-items.js";
import { registerPageRoutes } from "../src/modules/home/pages.js";
import { APP_MODULES, renderAppShell, SHELL_ASSET_VER } from "../src/modules/profile/middleware.js";

const root = dirname(fileURLToPath(import.meta.url));
const luocheng = { username: "罗成", displayName: "罗成" };

function withUser(user) {
  return (req, _res, next) => {
    req.user = user;
    next();
  };
}

async function listen(app) {
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address();
  return {
    base: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

test("侧栏在首页和星脉数据中心之间挂边界数据中心", () => {
  const hrefs = NAV_MAIN.map((item) => item.href);
  assert.equal(hrefs.includes("/bound"), true);
  assert.ok(hrefs.indexOf("/bound") === hrefs.indexOf("/home") + 1);
  assert.ok(hrefs.indexOf("/data") === hrefs.indexOf("/bound") + 1);
  assert.equal(
    NAV_FOOT.some((item) => item.href === "/bound"),
    false
  );
  const data = NAV_MAIN.find((item) => item.href === "/data");
  assert.equal(data.label, "星脉数据中心");
  const bound = NAV_MAIN.find((item) => item.href === "/bound");
  assert.equal(bound.label, "边界数据中心");
  assert.equal(Boolean(bound.children), false);
  const html = navMarkup("/bound", luocheng);
  const main = html.match(/<nav class="xm-menu xm-menu-main">([\s\S]*?)<\/nav>/)[1];
  const home = main.indexOf("首页");
  const border = main.indexOf("边界数据中心");
  const xingmai = main.indexOf("星脉数据中心");
  assert.ok(home >= 0 && border > home && xingmai > border);
  assert.equal(html.includes('href="/bound"'), true);
  assert.equal(html.includes(">数据中心<"), false);
});

test("壳把 /bound 交给边界数据中心模块", () => {
  assert.equal(APP_MODULES["/bound"], "bound");
  assert.equal(SHELL_ASSET_VER, "0.1.787-acadleaf");
  const html = renderAppShell("/bound", luocheng);
  assert.equal(html.includes("/shared/modules/bound.js"), true);
  assert.equal(html.includes("边界数据中心"), true);
});

test("nav.js 把边界数据中心放在星脉数据中心上面", () => {
  const js = readFileSync(join(root, "../public/shared/nav.js"), "utf8");
  assert.match(js, /0\.1\.772-scroll/);
  assert.match(js, /\{ href: "\/bound", label: "边界数据中心" \}/);
  assert.match(js, /\{ href: "\/data", label: "星脉数据中心"/);
  assert.match(js, /"\/bound": "bound"/);
  const itemsBlock = js.match(/const items = \[([\s\S]*?)\];/)[1];
  const homeAt = itemsBlock.indexOf('href: "/home"');
  const boundAt = itemsBlock.indexOf('href: "/bound"');
  const dataAt = itemsBlock.indexOf('href: "/data"');
  assert.ok(homeAt >= 0 && boundAt > homeAt && dataAt > boundAt);
});

test("GET /bound 走壳，接口标明爬虫非 ERP", async () => {
  const app = express();
  app.use(withUser(luocheng));
  registerPageRoutes(app);
  const { base, close } = await listen(app);
  try {
    const page = await fetch(`${base}/bound`);
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.match(html, /\/shared\/modules\/bound\.js/);
    assert.match(html, /边界数据中心/);
    assert.match(html, /星脉数据中心/);
    assert.doesNotMatch(html, /该模块 Agent 尚未交付/);
    const api = await fetch(`${base}/api/bound`);
    assert.equal(api.status, 200);
    assert.deepEqual(await api.json(), { ok: true, module: "bound", source: "crawler", erp: false });
  } finally {
    await close();
  }
});
