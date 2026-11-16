import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import express from "express";
import { NAV_FOOT, NAV_MAIN, navMarkup } from "../src/modules/home/nav-items.js";
import { registerPageRoutes } from "../src/modules/home/pages.js";
import { APP_MODULES, renderAppShell, SHELL_ASSET_VER } from "../src/modules/profile/middleware.js";
import { meetingRouter } from "../src/modules/meeting/router.js";
import { resetMeetingStore } from "../src/modules/meeting/store.js";

const root = dirname(fileURLToPath(import.meta.url));
const luocheng = { username: "罗成", displayName: "罗成" };
const zhang = { username: "张文静", displayName: "张文静" };

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

async function json(base, path, options = {}) {
  const res = await fetch(`${base}${path}`, {
    method: options.method || "GET",
    headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}) },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  return { status: res.status, data: await res.json() };
}

test("侧栏在工作汇报后面挂月度大会，不进底部", () => {
  const hrefs = NAV_MAIN.map((item) => item.href);
  assert.equal(hrefs.includes("/meeting"), true);
  assert.ok(hrefs.indexOf("/meeting") === hrefs.indexOf("/work") + 1);
  assert.ok(hrefs.indexOf("/feedback") === hrefs.indexOf("/meeting") + 1);
  assert.equal(
    NAV_FOOT.some((item) => item.href === "/meeting"),
    false
  );
  const html = navMarkup("/meeting", luocheng);
  const main = html.match(/<nav class="xm-menu xm-menu-main">([\s\S]*?)<\/nav>/)[1];
  const work = main.indexOf("工作汇报");
  const meeting = main.indexOf("月度大会");
  const feedback = main.indexOf("需求与反馈");
  assert.ok(work >= 0 && meeting > work && feedback > meeting);
  assert.equal(html.includes('href="/meeting"'), true);
});

test("壳把 /meeting 交给月度大会模块", () => {
  assert.equal(APP_MODULES["/meeting"], "meeting");
  assert.equal(SHELL_ASSET_VER, "0.1.772-menulite");
  const html = renderAppShell("/meeting", luocheng);
  assert.equal(html.includes("/shared/modules/meeting.js"), true);
  assert.equal(html.includes("月度大会"), true);
});

test("nav.js 把月度大会放进主栏而不是底栏", () => {
  const js = readFileSync(join(root, "../public/shared/nav.js"), "utf8");
  assert.match(js, /0\.1\.772-scroll/);
  assert.match(js, /\{ href: "\/meeting", label: "月度大会" \}/);
  assert.match(js, /"\/meeting": "meeting"/);
  const itemsBlock = js.match(/const items = \[([\s\S]*?)\];/)[1];
  const workAt = itemsBlock.indexOf('href: "/work"');
  const meetingAt = itemsBlock.indexOf('href: "/meeting"');
  const feedbackAt = itemsBlock.indexOf('href: "/feedback"');
  assert.ok(workAt >= 0 && meetingAt > workAt && feedbackAt > meetingAt);
});

test("GET /meeting 走壳而不是占位页", async () => {
  const app = express();
  registerPageRoutes(app);
  const { base, close } = await listen(app);
  try {
    const res = await fetch(`${base}/meeting`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /\/shared\/modules\/meeting\.js/);
    assert.match(html, /月度大会/);
    assert.doesNotMatch(html, /该模块 Agent 尚未交付/);
  } finally {
    await close();
  }
});

test("罗成能保存月度大会模板，其他人只能看", async () => {
  resetMeetingStore();
  const adminApp = express();
  adminApp.use(express.json());
  adminApp.use("/api/meeting", withUser(luocheng), meetingRouter);
  const staffApp = express();
  staffApp.use(express.json());
  staffApp.use("/api/meeting", withUser(zhang), meetingRouter);
  const admin = await listen(adminApp);
  const staff = await listen(staffApp);
  try {
    const empty = await json(admin.base, "/api/meeting?month=2026-11");
    assert.equal(empty.status, 200);
    assert.equal(empty.data.admin, true);
    assert.equal(empty.data.board.month, "2026-11");
    assert.equal(empty.data.board.kpis.length, 5);
    assert.deepEqual(
      empty.data.board.kpis.map((item) => item.label),
      ["奋斗时长", "奋斗排名", "BI利润", "新人介绍", "优秀员工"]
    );

    const saved = await json(admin.base, "/api/meeting", {
      method: "PUT",
      body: {
        month: "2026-11",
        board: {
          kpis: [{ key: "hours", value: "126" }, { key: "profit", value: "88万" }],
          ranks: [{ name: "张文静", hours: "42h", note: "第一" }],
          intros: [{ name: "新人甲", role: "运营", text: "本月入职" }],
          levels: [{ name: "王博", from: "专员", to: "主管", note: "晋升" }],
          goals: [{ name: "团队", text: "利润过线" }],
          stars: [{ name: "张文静", reason: "店铺增长" }]
        }
      }
    });
    assert.equal(saved.status, 200);
    assert.equal(saved.data.board.kpis[0].value, "126");
    assert.equal(saved.data.board.ranks[0].name, "张文静");

    const view = await json(staff.base, "/api/meeting?month=2026-11");
    assert.equal(view.status, 200);
    assert.equal(view.data.admin, false);
    assert.equal(view.data.board.stars[0].name, "张文静");

    const forbidden = await json(staff.base, "/api/meeting", {
      method: "PUT",
      body: { month: "2026-11", board: { kpis: [{ key: "hours", value: "1" }] } }
    });
    assert.equal(forbidden.status, 403);
  } finally {
    await admin.close();
    await staff.close();
  }
});
