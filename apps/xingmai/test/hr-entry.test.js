import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { NAV_FOOT, NAV_MAIN, navMarkup } from "../src/modules/home/nav-items.js";
import { registerPageRoutes } from "../src/modules/home/pages.js";
import { APP_MODULES, renderAppShell } from "../src/modules/profile/middleware.js";

test("foot order is 版本发布中心, 组织中心, 智能人事, 个人中心", () => {
  assert.deepEqual(
    NAV_FOOT.map((item) => item.href),
    ["/releases", "/people", "/hr", "/me"]
  );
  assert.equal(NAV_FOOT[2].label, "智能人事");
  assert.equal(
    NAV_MAIN.some((item) => item.href === "/hr"),
    false
  );
});

test("staff markup order is 版本发布中心, 组织中心, 智能人事, 个人中心", () => {
  const html = navMarkup("/home", { username: "罗成", displayName: "罗成" });
  const foot = html.match(/<nav class="xm-menu xm-menu-foot">([\s\S]*?)<\/nav>/)[1];
  const labels = [...foot.matchAll(/<span>([^<]+)<\/span>/g)].map((m) => m[1]);
  const people = labels.indexOf("组织中心");
  const hr = labels.indexOf("智能人事");
  const releases = labels.indexOf("版本发布中心");
  const me = labels.indexOf("个人中心");
  assert.ok(releases >= 0 && people > releases && hr > people && me > hr);
  assert.equal(foot.includes("面试"), false);
  assert.equal(foot.includes("考勤"), false);
  assert.equal(foot.includes("DINGTALK"), false);
});

test("shell maps /hr to 智能人事", () => {
  assert.equal(APP_MODULES["/hr"], "hr");
  const html = renderAppShell("/hr", { username: "罗成", displayName: "罗成" });
  assert.equal(html.includes("/shared/modules/hr.js"), true);
  assert.equal(html.includes("面试"), false);
});

test("GET /api/hr is mounted and asks for login", async () => {
  const app = express();
  registerPageRoutes(app);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/hr`);
    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), { ok: false, error: "未登录" });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
