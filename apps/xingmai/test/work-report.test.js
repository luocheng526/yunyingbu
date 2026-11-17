import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import express from "express";
import { NAV_FOOT, NAV_MAIN, navMarkup } from "../src/modules/home/nav-items.js";
import { registerPageRoutes } from "../src/modules/home/pages.js";
import { APP_MODULES, renderAppShell, SHELL_ASSET_VER } from "../src/modules/profile/middleware.js";
import { resetPeopleStore } from "../src/modules/people/store.js";
import { workRouter } from "../src/modules/work/router.js";
import { resetWorkStore } from "../src/modules/work/store.js";

const root = dirname(fileURLToPath(import.meta.url));
const luocheng = { username: "罗成", displayName: "罗成" };
const zhang = { username: "张文静", displayName: "张文静" };
const han = { username: "韩梦凯", displayName: "韩梦凯" };

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

test("侧栏在甄选智能体后面挂工作汇报，不进底部", () => {
  const hrefs = NAV_MAIN.map((item) => item.href);
  assert.equal(hrefs.includes("/work"), true);
  assert.ok(hrefs.indexOf("/work") === hrefs.indexOf("/agents") + 1);
  assert.equal(
    NAV_FOOT.some((item) => item.href === "/work"),
    false
  );
  const html = navMarkup("/work", luocheng);
  const main = html.match(/<nav class="xm-menu xm-menu-main">([\s\S]*?)<\/nav>/)[1];
  const agents = main.indexOf("甄选智能体");
  const work = main.indexOf("工作汇报");
  assert.ok(agents >= 0 && work > agents);
  assert.equal(html.includes('href="/work"'), true);
});

test("壳把 /work 交给工作汇报模块", () => {
  assert.equal(APP_MODULES["/work"], "work");
  assert.equal(SHELL_ASSET_VER, "0.1.784-homeloop");
  const html = renderAppShell("/work", luocheng);
  assert.equal(html.includes("/shared/modules/work.js"), true);
  assert.equal(html.includes("工作汇报"), true);
});

test("nav.js 把工作汇报放进主栏而不是底栏", () => {
  const js = readFileSync(join(root, "../public/shared/nav.js"), "utf8");
  assert.match(js, /0\.1\.772-scroll/);
  assert.match(js, /\{ href: "\/work", label: "工作汇报" \}/);
  assert.match(js, /"\/work": "work"/);
  const itemsBlock = js.match(/const items = \[([\s\S]*?)\];/)[1];
  const agentsAt = itemsBlock.indexOf('href: "/agents"');
  const workAt = itemsBlock.indexOf('href: "/work"');
  const releasesAt = itemsBlock.indexOf('href: "/releases"');
  assert.ok(agentsAt >= 0 && workAt > agentsAt && releasesAt > workAt);
});

test("GET /work 走壳而不是占位页", async () => {
  const app = express();
  registerPageRoutes(app);
  const { base, close } = await listen(app);
  try {
    const res = await fetch(`${base}/work`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /\/shared\/modules\/work\.js/);
    assert.doesNotMatch(html, /该模块 Agent 尚未交付/);
  } finally {
    await close();
  }
});

test("只有运营部人事部技术部要汇报，其他人不用报", async () => {
  resetPeopleStore();
  resetWorkStore();
    const app = express();
    app.use(express.json());
    app.use("/api/work", withUser(luocheng), workRouter);
    const { base, close } = await listen(app);
    try {
      const meta = await json(base, "/api/work");
    assert.equal(meta.status, 200);
    assert.equal(meta.data.isAdmin, true);
    assert.deepEqual(
      meta.data.depts.map((item) => item.name),
      ["运营部", "人事部", "技术部"]
    );

    const bad = await json(base, "/api/work/settings/members", {
      method: "PUT",
      body: { personId: 4, deptCode: "shen" }
    });
    assert.equal(bad.status, 400);
    assert.match(String(bad.data.error), /运营部、人事部、技术部/);

    const assigned = await json(base, "/api/work/settings/members", {
      method: "PUT",
      body: { personId: 4, deptCode: "ops" }
    });
    assert.equal(assigned.status, 200);
    assert.equal(
      assigned.data.members.some((item) => item.personId === 4 && item.deptCode === "ops"),
      true
    );

    const settings = await json(base, "/api/work/settings");
    const zhangRow = settings.data.people.find((item) => item.name === "张文静");
    assert.ok(zhangRow);
    assert.equal(zhangRow.role, "运营");
    assert.equal(zhangRow.center, "沈子晗运营中心");
    assert.ok(String(zhangRow.rights || "").length > 0);
    const shen = settings.data.people.find((item) => item.name === "沈子晗");
    assert.ok(shen);
    assert.equal(shen.rights.includes("等"), true);
  } finally {
    await close();
  }
});

test("罗成配模板后，名单里的人按表填当天事项", async () => {
  resetPeopleStore();
  resetWorkStore();
    const adminApp = express();
    adminApp.use(express.json());
    adminApp.use("/api/work", withUser(luocheng), workRouter);
    const staffApp = express();
    staffApp.use(express.json());
    staffApp.use("/api/work", withUser(zhang), workRouter);
    const otherApp = express();
    otherApp.use(express.json());
    otherApp.use("/api/work", withUser(han), workRouter);
  const admin = await listen(adminApp);
  const staff = await listen(staffApp);
  const other = await listen(otherApp);
  try {
    await json(admin.base, "/api/work/settings/members", {
      method: "PUT",
      body: { personId: 4, deptCode: "ops" }
    });
    const tpl = await json(admin.base, "/api/work/settings/templates", {
      method: "PUT",
      body: {
        personId: 4,
        items: [
          { key: "shop", label: "店铺运营" },
          { key: "ads", label: "推广投放" }
        ]
      }
    });
    assert.equal(tpl.status, 200);
    assert.deepEqual(
      tpl.data.personTemplates["4"].map((item) => item.label),
      ["店铺运营", "推广投放"]
    );

    const today = (await json(staff.base, "/api/work")).data.today;
    const empty = await json(staff.base, `/api/work/report?date=${today}`);
    assert.equal(empty.data.needReport, true);
    assert.equal(empty.data.rows[0].status, "未报");
    assert.deepEqual(
      empty.data.rows[0].items.map((item) => item.label),
      ["店铺运营", "推广投放"]
    );

    const saved = await json(staff.base, "/api/work/report", {
      method: "PUT",
      body: {
        date: today,
        items: [
          { key: "shop", content: "跟了 RASW 家居两场活动" },
          { key: "ads", content: "看了花费，没加预算" }
        ]
      }
    });
    assert.equal(saved.status, 200);
    assert.equal(saved.data.rows[0].status, "已报");
    assert.equal(saved.data.rows[0].items[0].content, "跟了 RASW 家居两场活动");

    const yesterday = "2026-11-15";
    const otherDay = await json(staff.base, `/api/work/report?date=${yesterday}`);
    assert.equal(otherDay.data.rows[0].status, "未报");
    assert.equal(otherDay.data.rows[0].items[0].content, "");

    const skip = await json(other.base, `/api/work/report?date=${today}`);
    assert.equal(skip.data.needReport, false);
    assert.equal(skip.data.rows.length, 0);

    const forbidden = await json(staff.base, "/api/work/settings");
    assert.equal(forbidden.status, 403);

    const board = await json(admin.base, `/api/work/report?date=${today}&dept=ops`);
    assert.equal(board.data.summary.should, 1);
    assert.equal(board.data.summary.done, 1);
    assert.equal(board.data.rows[0].person.name, "张文静");
  } finally {
    await admin.close();
    await staff.close();
    await other.close();
  }
});

test("模块脚本不在 import 时拉长任务", async () => {
  const t0 = Date.now();
  await import("../src/modules/work/router.js");
  assert.ok(Date.now() - t0 < 500);
});
