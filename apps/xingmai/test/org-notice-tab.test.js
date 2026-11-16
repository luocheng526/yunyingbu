import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import express from "express";
import { NAV_FOOT, navMarkup } from "../src/modules/home/nav-items.js";
import { registerPageRoutes } from "../src/modules/home/pages.js";

const root = dirname(fileURLToPath(import.meta.url));

test("组织中心 is a foot leaf without 公告中心 submenu", () => {
  const people = NAV_FOOT.find((item) => item.href === "/people");
  assert.ok(people);
  assert.equal(Boolean(people.children && people.children.length), false);
  const html = navMarkup("/people", { username: "罗成", displayName: "罗成" });
  const foot = html.match(/<nav class="xm-menu xm-menu-foot">([\s\S]*?)<\/nav>/)[1];
  assert.equal(foot.includes("公告中心"), false);
  assert.equal(foot.includes('data-xm-group="/people"'), false);
  assert.match(foot, /href="\/people"/);
});

test("people.js keeps 公告中心 as a tab after 改动日志", () => {
  const js = readFileSync(join(root, "../public/shared/modules/people.js"), "utf8");
  const logs = js.indexOf('org-tab-name">改动日志');
  const notices = js.indexOf('org-tab-name">公告中心');
  assert.ok(logs >= 0, "missing 改动日志 tab");
  assert.ok(notices > logs, "公告中心 tab must follow 改动日志");
  assert.match(js, /data-pane="notices"/);
  assert.match(js, /org-notices-root/);
});

test("nav.js no longer nests 公告中心 under 组织中心", () => {
  const js = readFileSync(join(root, "../public/shared/nav.js"), "utf8");
  assert.match(js, /0\.1\.772-work-rpt2/);
  assert.match(js, /\{ href: "\/people", label: "组织中心" \}/);
  assert.doesNotMatch(js, /label: "组织中心", children:/);
  assert.match(js, /normalize\(href\) === "\/notices"/);
});

test("GET /notices redirects into 组织中心 notices pane", async () => {
  const app = express();
  registerPageRoutes(app);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/notices`, { redirect: "manual" });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get("location"), "/people?pane=notices");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
