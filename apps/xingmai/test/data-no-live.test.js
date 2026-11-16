import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import express from "express";
import { DATA_CHILDREN, HAN_CHILDREN, navMarkup } from "../src/modules/home/nav-items.js";
import { registerPageRoutes } from "../src/modules/home/pages.js";
import { APP_MODULES, SHELL_ASSET_VER } from "../src/modules/profile/middleware.js";

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

test("数据中心侧栏只留总揽店铺商品，实时付费不进数据中心", () => {
  assert.deepEqual(
    DATA_CHILDREN.map((item) => item.href),
    ["/data/overview", "/data/shops", "/data/goods"]
  );
  assert.equal(
    DATA_CHILDREN.some((item) => item.href === "/data/paid" || item.label === "实时付费"),
    false
  );
  assert.equal(
    HAN_CHILDREN.some((item) => item.href === "/han/paid" && item.label === "实时付费"),
    true
  );
  const html = navMarkup("/data/overview", luocheng);
  const dataSub = html.match(/data-xm-group="\/data"[\s\S]*?<div class="xm-submenu">([\s\S]*?)<\/div>/);
  assert.ok(dataSub);
  assert.match(dataSub[1], /数据总揽/);
  assert.match(dataSub[1], /店铺数据/);
  assert.match(dataSub[1], /商品数据/);
  assert.doesNotMatch(dataSub[1], /实时付费/);
  assert.doesNotMatch(dataSub[1], /\/data\/paid/);
  const homeHtml = navMarkup("/home", luocheng);
  assert.match(homeHtml, /href="\/home"/);
});

test("首页仍有实时页签，旧 /data/paid 跳回首页", async () => {
  assert.equal(SHELL_ASSET_VER, "0.1.772-navhot");
  assert.equal(APP_MODULES["/home"], "home");
  const homeJs = readFileSync(join(root, "../public/shared/modules/home.js"), "utf8");
  assert.match(homeJs, /\{ key: "live", label: "实时" \}/);
  const navJs = readFileSync(join(root, "../public/shared/nav.js"), "utf8");
  assert.match(navJs, /0\.1\.772-scroll/);
  assert.match(navJs, /"\/data\/paid": "\/home"/);
  const dataKids = navJs.match(/const DATA_CHILDREN = \[([\s\S]*?)\];/)[1];
  assert.doesNotMatch(dataKids, /\/data\/paid/);
  assert.doesNotMatch(dataKids, /实时付费/);
  const hanKids = navJs.match(/const HAN_CHILDREN = \[([\s\S]*?)\];/)[1];
  assert.match(hanKids, /href: "\/han\/paid", label: "实时付费"/);

  const app = express();
  app.use(withUser(luocheng));
  registerPageRoutes(app);
  const { base, close } = await listen(app);
  try {
    const paid = await fetch(`${base}/data/paid`, { redirect: "manual" });
    assert.equal(paid.status, 302);
    assert.equal(paid.headers.get("location"), "/home");
    const home = await fetch(`${base}/home`);
    assert.equal(home.status, 200);
    const html = await home.text();
    const dataSub = html.match(/data-xm-group="\/data"[\s\S]*?<div class="xm-submenu">([\s\S]*?)<\/div>/);
    assert.ok(dataSub);
    assert.doesNotMatch(dataSub[1], /实时付费/);
    assert.match(html, /\/shared\/modules\/home\.js/);
  } finally {
    await close();
  }
});
