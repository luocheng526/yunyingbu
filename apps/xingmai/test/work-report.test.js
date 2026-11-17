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
  assert.equal(SHELL_ASSET_VER, "0.1.772-feedback");
  const html = renderAppShell("/work", luocheng);
  assert.equal(html.includes("/shared/modules/work.js"), true);
  assert.equal(html.includes("工作汇报"), true);
});

test("填写日报页用看板，空的时候仍能写下日报", () => {
  const js = readFileSync(join(root, "../public/shared/modules/work.js"), "utf8");
  assert.match(js, /员工日常工作汇报、任务进展与成果沉淀/);
  assert.match(js, /tabBtn\("today", "填写日报"\)/);
  assert.match(js, /今日应提交/);
  assert.match(js, /今日提交率/);
  assert.match(js, /这一天还没有人需要汇报。/);
  assert.match(js, /data-write="today"/);
  assert.match(js, /日报填写说明/);
  assert.match(js, /按罗成配好的模板填/);
  assert.match(js, /function renderDiaryFill\(\)/);
  assert.match(js, /function renderDiarySettings\(\)/);
  assert.match(js, /function renderSummary\(\)/);
  assert.match(js, /function renderDuty\(\)/);
});

test("今天未交时侧栏工作汇报右上角是 1，交了就去掉", () => {
  const js = readFileSync(join(root, "../public/shared/modules/work.js"), "utf8");
  assert.match(js, /function paintNavBadge\(\)/);
  assert.match(js, /a\.xm-menu-item\[href="\/work"\]/);
  assert.match(js, /badge\.textContent = "1"/);
  assert.match(js, /if \(!state\.todoOpen\)/);
  assert.match(js, /\.xm-work-badge\{position:absolute;top:2px;right:8px/);
});

test("nav.js 把工作汇报放进主栏而不是底栏", () => {
  const js = readFileSync(join(root, "../public/shared/nav.js"), "utf8");
  assert.match(js, /0\.1\.772-feedback/);
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
    assert.equal(saved.data.rows[0].items[0].content, "跟了 RASW 家居两场活动");
    assert.equal(saved.data.rows[0].status, "未报");
    assert.equal(saved.data.rows[0].statusNote, "店铺日报未交");

    const diary = await json(staff.base, "/api/work/diary", {
      method: "PUT",
      body: {
        date: today,
        status: "已提交",
        reports: [
          {
            shopId: "1",
            revision: 0,
            items: { 评价数: { count: 2, detail: "回复差评", spus: "SPU1", actions: [], images: [] } },
            extra: [],
            notes: "家居店已看完",
            proofs: {}
          }
        ]
      }
    });
    assert.equal(diary.status, 200);
    const finished = await json(staff.base, `/api/work/report?date=${today}`);
    assert.equal(finished.data.rows[0].status, "已报");

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

test("同一人两家店只计一人，草稿刷新后还在", async () => {
  resetPeopleStore();
  resetWorkStore();
  const adminApp = express();
  adminApp.use(express.json());
  adminApp.use("/api/work", withUser(luocheng), workRouter);
  const wang = { username: "王博", displayName: "王博" };
  const staffApp = express();
  staffApp.use(express.json());
  staffApp.use("/api/work", withUser(wang), workRouter);
  const hanApp = express();
  hanApp.use(express.json());
  hanApp.use("/api/work", withUser(han), workRouter);
  const shenApp = express();
  shenApp.use(express.json());
  shenApp.use("/api/work", withUser({ username: "沈子晗", displayName: "沈子晗" }), workRouter);
  const admin = await listen(adminApp);
  const staff = await listen(staffApp);
  const outsider = await listen(hanApp);
  const leader = await listen(shenApp);
  try {
    await json(admin.base, "/api/work/settings/members", {
      method: "PUT",
      body: { personId: 7, deptCode: "ops" }
    });
    const today = (await json(staff.base, "/api/work")).data.today;
    const shops = await json(staff.base, `/api/work/diary?date=${today}`);
    assert.deepEqual(
      shops.data.shops.map((item) => item.name),
      ["飒望居家旗舰店", "SAWAAG居家布艺旗舰店"]
    );
    const draft = await json(staff.base, "/api/work/diary", {
      method: "PUT",
      body: {
        date: today,
        status: "草稿",
        reports: [
          { shopId: "4", revision: 0, items: { 评价数: { count: 1, detail: "甲店", spus: "", actions: [], images: [] } }, extra: [], notes: "甲", proofs: {} },
          { shopId: "5", revision: 0, items: { 评价数: { count: 2, detail: "乙店", spus: "", actions: [], images: [] } }, extra: [], notes: "乙", proofs: {} }
        ]
      }
    });
    assert.equal(draft.status, 200);
    const again = await json(staff.base, `/api/work/diary?date=${today}`);
    assert.equal(again.data.mine.length, 2);
    assert.equal(again.data.mine.find((row) => row.shopId === "4").items["评价数"].detail, "甲店");
    assert.equal(again.data.mine.find((row) => row.shopId === "5").notes, "乙");

    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    );
    const image = await json(staff.base, "/api/work/diary/image", {
      method: "POST",
      body: { date: today, shopId: "4", fieldKey: "评价数", name: "a.png", mime: "image/png", data: png.toString("base64") }
    });
    assert.equal(image.status, 200);
    const rev4 = again.data.mine.find((row) => row.shopId === "4").revision;
    const rev5 = again.data.mine.find((row) => row.shopId === "5").revision;
    const submitted = await json(staff.base, "/api/work/diary", {
      method: "PUT",
      body: {
        date: today,
        status: "已提交",
        reports: [
          {
            shopId: "4",
            revision: rev4,
            items: { 评价数: { count: 1, detail: "甲店", spus: "", actions: [], images: [{ id: image.data.image.id, name: "a.png" }] } },
            extra: [],
            notes: "甲",
            proofs: {}
          },
          {
            shopId: "5",
            revision: rev5,
            items: { 评价数: { count: 2, detail: "乙店", spus: "", actions: [], images: [] } },
            extra: [],
            notes: "乙",
            proofs: {}
          }
        ]
      }
    });
    assert.equal(submitted.status, 200);
    await json(staff.base, "/api/work/report", {
      method: "PUT",
      body: { date: today, items: [{ key: "shop", content: "两家店都看了" }] }
    });
    const summary = await json(leader.base, `/api/work/diary/summary?from=${today}&to=${today}`);
    assert.equal(summary.data.peopleCount, 1);
    assert.equal(summary.data.shopCount, 2);
    assert.equal(summary.data.reportCount, 2);
    const shot = await json(leader.base, `/api/work/diary/image?id=${image.data.image.id}`);
    assert.equal(shot.status, 200);
    assert.equal(shot.data.mime, "image/png");
    const hidden = await json(outsider.base, `/api/work/diary/summary?from=${today}&to=${today}`);
    assert.equal(hidden.data.reportCount, 0);
    const duty = await json(admin.base, `/api/work/diary/duty?date=${today}`);
    const wangRow = duty.data.rows.find((row) => row.name === "王博");
    assert.equal(wangRow.template, "已填");
    assert.equal(wangRow.diary, "已交");
    assert.equal(wangRow.shops, 2);
    assert.equal(wangRow.status, "已报");
    assert.equal(duty.data.summary.should, duty.data.summary.done);
  } finally {
    await admin.close();
    await staff.close();
    await outsider.close();
    await leader.close();
  }
});

test("人事按模板填报，免报和移出不计入未报", async () => {
  resetPeopleStore();
  resetWorkStore();
  const adminApp = express();
  adminApp.use(express.json());
  adminApp.use("/api/work", withUser(luocheng), workRouter);
  const yang = { username: "杨润泽", displayName: "杨润泽" };
  const staffApp = express();
  staffApp.use(express.json());
  staffApp.use("/api/work", withUser(yang), workRouter);
  const admin = await listen(adminApp);
  const staff = await listen(staffApp);
  try {
    await json(admin.base, "/api/work/settings/members", {
      method: "PUT",
      body: { personId: 8, deptCode: "hr" }
    });
    const today = (await json(staff.base, "/api/work")).data.today;
    const saved = await json(staff.base, "/api/work/report", {
      method: "PUT",
      body: { date: today, items: [{ key: "hire", content: "今天约了两场面试" }] }
    });
    assert.equal(saved.data.rows[0].status, "已报");
    assert.equal(saved.data.rows[0].deptName, "人事部");
    const board = await json(admin.base, `/api/work/report?date=${today}&dept=hr`);
    assert.equal(board.data.summary.should, 1);
    assert.equal(board.data.summary.done, 1);
    assert.equal(board.data.rows[0].person.name, "杨润泽");

    await json(admin.base, "/api/work/diary/rest", {
      method: "PUT",
      body: { date: today, personId: 8, rest: true }
    });
    const exempt = await json(admin.base, `/api/work/report?date=${today}&dept=hr`);
    assert.equal(exempt.data.rows[0].status, "免报");
    assert.equal(exempt.data.summary.should, 0);
    assert.equal(exempt.data.summary.miss, 0);

    await json(admin.base, "/api/work/settings/members", {
      method: "PUT",
      body: { personId: 8, deptCode: "" }
    });
    const removed = await json(admin.base, `/api/work/report?date=${today}&dept=hr`);
    assert.equal(removed.data.summary.should, 0);
    assert.equal(removed.data.rows.length, 0);
    const yesterday = "2026-11-15";
    await json(admin.base, "/api/work/settings/members", {
      method: "PUT",
      body: { personId: 8, deptCode: "hr" }
    });
    const history = await json(staff.base, `/api/work/report?date=${yesterday}`);
    assert.equal(history.data.rows[0].status, "未报");
    assert.equal(history.data.rows[0].items[0].content, "");
  } finally {
    await admin.close();
    await staff.close();
  }
});

test("模块脚本不在 import 时拉长任务", async () => {
  const t0 = Date.now();
  await import("../src/modules/work/router.js");
  assert.ok(Date.now() - t0 < 500);
});
