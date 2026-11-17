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

test("侧栏在工作汇报后面挂需求与反馈，不进底部", () => {
  const hrefs = NAV_MAIN.map((item) => item.href);
  assert.equal(hrefs.includes("/feedback"), true);
  assert.ok(hrefs.indexOf("/feedback") === hrefs.indexOf("/meeting") + 1);
  assert.equal(
    NAV_FOOT.some((item) => item.href === "/feedback"),
    false
  );
  const html = navMarkup("/feedback", luocheng);
  const main = html.match(/<nav class="xm-menu xm-menu-main">([\s\S]*?)<\/nav>/)[1];
  const work = main.indexOf("工作汇报");
  const feedback = main.indexOf("需求与反馈");
  assert.ok(work >= 0 && feedback > work);
  assert.equal(html.includes('href="/feedback"'), true);
  assert.equal(html.includes("需求与反馈"), true);
});

test("壳把 /feedback 交给需求与反馈模块", () => {
  assert.equal(APP_MODULES["/feedback"], "feedback");
  assert.equal(SHELL_ASSET_VER, "0.1.779-watermark");
  const html = renderAppShell("/feedback", luocheng);
  assert.equal(html.includes("/shared/modules/feedback.js"), true);
  assert.equal(html.includes("需求与反馈"), true);
});

test("nav.js 把需求与反馈放进主栏而不是底栏", () => {
  const js = readFileSync(join(root, "../public/shared/nav.js"), "utf8");
  assert.match(js, /0\.1\.772-scroll/);
  assert.match(js, /\{ href: "\/feedback", label: "需求与反馈" \}/);
  assert.match(js, /"\/feedback": "feedback"/);
  const itemsBlock = js.match(/const items = \[([\s\S]*?)\];/)[1];
  const workAt = itemsBlock.indexOf('href: "/work"');
  const feedbackAt = itemsBlock.indexOf('href: "/feedback"');
  const releasesAt = itemsBlock.indexOf('href: "/releases"');
  assert.ok(workAt >= 0 && feedbackAt > workAt && releasesAt > feedbackAt);
});

test("GET /feedback 走壳而不是占位页", async () => {
  const app = express();
  registerPageRoutes(app);
  const { base, close } = await listen(app);
  try {
    const res = await fetch(`${base}/feedback`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /\/shared\/modules\/feedback\.js/);
    assert.match(html, /需求与反馈/);
    assert.doesNotMatch(html, /该模块 Agent 尚未交付/);
  } finally {
    await close();
  }
});

test("GET /api/feedback returns module stub", async () => {
  const app = express();
  registerPageRoutes(app);
  const { base, close } = await listen(app);
  try {
    const res = await fetch(`${base}/api/feedback`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true, module: "feedback" });
  } finally {
    await close();
  }
});
