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
import { saveDingBinds } from "../src/modules/work/diary.js";
import { setDingTransport } from "../src/modules/work/dingtalk.js";
import { setTaskNotifier } from "../src/modules/work/tasks.js";

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
  const work = main.indexOf("工作中心");
  assert.ok(agents >= 0 && work > agents);
  assert.equal(html.includes('href="/work"'), true);
});

test("壳把 /work 交给工作汇报模块", () => {
  assert.equal(APP_MODULES["/work"], "work");
  assert.match(SHELL_ASSET_VER, /^0\.1\./);
  const html = renderAppShell("/work", luocheng);
  assert.equal(html.includes("/shared/modules/work.js"), true);
  assert.equal(html.includes("工作中心"), true);
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
  assert.match(js, /tabBtn\("taskPublish", "发布任务"\)/);
  assert.match(js, /tabBtn\("taskMine", "我的任务", state\.badges\.mine\)/);
  assert.match(js, /tabBtn\("taskReview", "待检查任务", state\.badges\.review\)/);
  assert.match(js, /data-task-host/);
  assert.match(js, /function refreshBadges\(root\)/);
  assert.match(js, /readDeepLink\(\)/);
  const login = readFileSync(join(root, "../public/login.html"), "utf8");
  assert.match(login, /back.indexOf\("\/work"\) === 0/);
  const tasks = readFileSync(join(root, "../public/shared/modules/work-tasks.js"), "utf8");
  assert.match(tasks, /queue === "publish" \? "published"/);
  assert.match(tasks, /优先跟进/);
  assert.match(tasks, /已逾期/);
  assert.match(tasks, /退回必须填写原因|检查意见/);
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
  assert.match(js, /xm-fast-shell/);
  assert.match(js, /\{ href: "\/work", label: "工作中心" \}/);
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

test("部门设置全选默认勾席位为运营和助理的人", async () => {
  const js = readFileSync(join(root, "../public/shared/modules/work.js"), "utf8");
  assert.match(js, /data-assign-defaults/);
  assert.match(js, /席位为运营、助理/);
  const start = js.indexOf("function rosterSeatParts");
  const end = js.indexOf("function rosterPeople");
  const seats = new Function(`${js.slice(start, end)} return { rosterDefaultSeat };`)();
  assert.equal(seats.rosterDefaultSeat({ seat: "运营" }), true);
  assert.equal(seats.rosterDefaultSeat({ seat: "助理" }), true);
  assert.equal(seats.rosterDefaultSeat({ seat: "主管、运营" }), true);
  assert.equal(seats.rosterDefaultSeat({ seat: "经理" }), false);
  assert.equal(seats.rosterDefaultSeat({ seat: "储备", role: "运营" }), false);
  assert.equal(seats.rosterDefaultSeat({ seat: "" }), false);

  resetPeopleStore();
  resetWorkStore();
  const app = express();
  app.use(express.json());
  app.use(withUser(luocheng));
  app.use("/api/work", workRouter);
  const { base, close } = await listen(app);
  try {
    const assigned = await json(base, "/api/work/settings/members", {
      method: "PUT",
      body: {
        members: [
          { personId: 4, deptCode: "ops" },
          { personId: 5, deptCode: "ops" }
        ]
      }
    });
    assert.equal(assigned.status, 200);
    assert.equal(assigned.data.members.filter((item) => item.deptCode === "ops").length, 2);
    const cleared = await json(base, "/api/work/settings/members", {
      method: "PUT",
      body: {
        members: [
          { personId: 4, deptCode: "" },
          { personId: 5, deptCode: "" }
        ]
      }
    });
    assert.equal(cleared.status, 200);
    assert.equal(cleared.data.members.some((item) => item.personId === 4 || item.personId === 5), false);
  } finally {
    await close();
  }
});

test("发布任务页面把组织里的管理员显示成罗成", () => {
  const js = readFileSync(join(root, "../public/shared/modules/work-tasks.js"), "utf8");
  assert.match(js, /person\.name === "管理员" \? "罗成"/);
});

test("发布任务的检查人和执行人里有罗成", async () => {
  resetPeopleStore();
  resetWorkStore();
  const app = express();
  app.use(express.json());
  app.use(withUser(luocheng));
  app.use("/api/work", workRouter);
  const { base, close } = await listen(app);
  try {
    const ctx = await json(base, "/api/work/tasks/context");
    assert.equal(ctx.status, 200);
    const luo = ctx.data.people.find((person) => person.name === "罗成");
    assert.ok(luo);
    assert.equal(ctx.data.people.some((person) => person.name === "管理员"), false);
    const published = await json(base, "/api/work/tasks/publish", {
      method: "POST",
      body: {
        id: "task-luo-review",
        title: "核对名单",
        assignee: "1",
        reviewer: luo.id,
        start_at: "2026-11-17T09:00",
        due_at: "2026-11-17T18:00"
      }
    });
    assert.equal(published.status, 200);
    assert.equal(published.data.task.reviewer, luo.id);
  } finally {
    await close();
  }
});

test("发布、执行、退回、再提交、检查通过走同一条任务", async () => {
  resetPeopleStore();
  resetWorkStore();
  const notices = [];
  setTaskNotifier(async (personId, title, text, url) => {
    notices.push({ personId: String(personId), title, text, url: url || "" });
    return true;
  });
  let current = luocheng;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = current;
    next();
  });
  app.use("/api/work", workRouter);
  const { base, close } = await listen(app);
  const chen = { username: "陈明婧", displayName: "陈明婧" };
  const body = {
    id: "task-role-1",
    title: "核对活动价",
    description: "把今天的活动价整理出来",
    criteria: "表格里每个 SPU 都有价格",
    assignee: "4",
    reviewer: "3",
    start_at: "2026-11-17T09:00",
    due_at: "2026-11-17T18:00",
    files: [{ name: "要求.txt", data: Buffer.from("完成要求附件").toString("base64") }]
  };
  try {
    const same = await json(base, "/api/work/tasks/publish", { method: "POST", body: { ...body, assignee: "4", reviewer: "4" } });
    assert.equal(same.status, 400);
    assert.match(same.data.error, /不同人员/);
    const early = await json(base, "/api/work/tasks/publish", {
      method: "POST",
      body: { ...body, id: "task-role-early", due_at: "2026-11-17T08:00" }
    });
    assert.equal(early.status, 400);
    assert.match(early.data.error, /截止时间不能早于开始时间/);

    const published = await json(base, "/api/work/tasks/publish", { method: "POST", body });
    assert.equal(published.status, 200);
    assert.equal(published.data.task.status, "待执行");
    const again = await json(base, "/api/work/tasks/publish", { method: "POST", body });
    assert.equal(again.status, 200);
    assert.equal(again.data.duplicate, true);
    assert.equal(notices.length, 1);
    assert.equal(notices[0].personId, "4");
    assert.match(notices[0].text, /核对活动价/);
    assert.match(notices[0].text, /2026-11-17 18:00/);
    assert.match(notices[0].url, /tab=taskMine/);
    assert.match(notices[0].url, /task=task-role-1/);
    current = zhang;
    const openBadge = await json(base, "/api/work/badges");
    assert.equal(openBadge.data.mine, 1);
    assert.equal(openBadge.data.review, 0);
    current = luocheng;
    const hanBadge = await json(base, "/api/work/badges");
    assert.equal(hanBadge.data.review, 0);
    current = luocheng;

    current = zhang;
    const mine = await json(base, "/api/work/tasks?queue=mine");
    assert.equal(mine.data.rows.length, 1);
    assert.equal(mine.data.rows[0].title, "核对活动价");
    const started = await json(base, "/api/work/tasks/action", {
      method: "POST",
      body: { id: "task-role-1", revision: 1, action: "start" }
    });
    assert.equal(started.data.task.status, "进行中");
    assert.equal(notices.length, 2);
    assert.equal(notices[1].personId, "3");
    assert.equal(notices[1].title, "任务已开始执行");
    const emptyResult = await json(base, "/api/work/tasks/action", {
      method: "POST",
      body: { id: "task-role-1", revision: 2, action: "submit", note: "  " }
    });
    assert.equal(emptyResult.status, 400);
    const submitted = await json(base, "/api/work/tasks/action", {
      method: "POST",
      body: {
        id: "task-role-1",
        revision: 2,
        action: "submit",
        note: "价格已填完",
        files: [{ name: "结果.txt", data: Buffer.from("执行结果附件").toString("base64") }]
      }
    });
    assert.equal(submitted.data.task.status, "待检查");
    const repeat = await json(base, "/api/work/tasks/action", {
      method: "POST",
      body: { id: "task-role-1", revision: 2, action: "submit", note: "价格已填完" }
    });
    assert.equal(repeat.status, 409);
    assert.match(repeat.data.error, /刷新/);
    assert.equal(notices.length, 3);
    assert.equal(notices[2].personId, "3");
    assert.match(notices[2].url, /tab=taskReview/);
    assert.match(notices[2].text, /截止 2026-11-17 18:00/);
    current = zhang;
    const afterSubmit = await json(base, "/api/work/badges");
    assert.equal(afterSubmit.data.mine, 0);
    current = luocheng;
    const reviewBadge = await json(base, "/api/work/badges");
    assert.equal(reviewBadge.data.review, 1);

    current = luocheng;
    const review = await json(base, "/api/work/tasks?queue=review");
    const waiting = review.data.rows[0];
    assert.equal(waiting.status, "待检查");
    assert.equal(waiting.criteria, "表格里每个 SPU 都有价格");
    assert.match(waiting.events.map((event) => event.note).join("\n"), /价格已填完/);
    assert.equal(waiting.events.some((event) => event.files.some((file) => file.name === "结果.txt")), true);
    const noReason = await json(base, "/api/work/tasks/action", {
      method: "POST",
      body: { id: "task-role-1", revision: waiting.revision, action: "return", note: "" }
    });
    assert.equal(noReason.status, 400);
    assert.match(noReason.data.error, /原因/);
    const returned = await json(base, "/api/work/tasks/action", {
      method: "POST",
      body: { id: "task-role-1", revision: waiting.revision, action: "return", note: "少了两个 SPU" }
    });
    assert.equal(returned.data.task.status, "进行中");
    assert.equal(notices.at(-1).personId, "4");
    assert.match(notices.at(-1).text, /少了两个 SPU/);
    assert.match(notices.at(-1).url, /tab=taskMine/);
    current = zhang;
    const returnedBadge = await json(base, "/api/work/badges");
    assert.equal(returnedBadge.data.mine, 1);
    current = luocheng;
    const returnedReview = await json(base, "/api/work/badges");
    assert.equal(returnedReview.data.review, 0);

    current = zhang;
    const bounced = await json(base, "/api/work/tasks?queue=mine");
    assert.equal(bounced.data.rows[0].status, "进行中");
    assert.match(bounced.data.rows[0].events.map((event) => event.note).join("\n"), /少了两个 SPU/);
    const resubmitted = await json(base, "/api/work/tasks/action", {
      method: "POST",
      body: { id: "task-role-1", revision: bounced.data.rows[0].revision, action: "submit", note: "两个 SPU 已补上" }
    });
    assert.equal(resubmitted.data.task.status, "待检查");

    current = luocheng;
    const pending = await json(base, "/api/work/tasks?queue=review");
    assert.equal(pending.data.rows[0].status, "待检查");
    const approved = await json(base, "/api/work/tasks/action", {
      method: "POST",
      body: { id: "task-role-1", revision: pending.data.rows[0].revision, action: "approve", note: "可以了" }
    });
    assert.equal(approved.data.task.status, "已完成");
    assert.equal(notices.filter((item) => ["任务成果已提交", "修改后的成果已重新提交"].includes(item.title)).length, 2);
    assert.equal(notices.at(-1).title, "任务验收通过");
    assert.equal(notices.at(-1).personId, "4");
    assert.equal(notices.length, 6);
    const handled = pending.data.rows;
    const after = await json(base, "/api/work/tasks?queue=review");
    const done = after.data.rows[0];
    assert.equal(done.status, "已完成");
    assert.equal(handled[0].id, done.id);
    assert.equal(done.events.some((event) => event.actor === "3" && event.action === "检查通过"), true);

    current = zhang;
    const finished = await json(base, "/api/work/tasks?queue=mine");
    assert.equal(finished.data.rows[0].status, "已完成");
    const clearMine = await json(base, "/api/work/badges");
    assert.equal(clearMine.data.mine, 0);
    current = luocheng;
    const clearReview = await json(base, "/api/work/badges");
    assert.equal(clearReview.data.review, 0);
    current = zhang;
    current = luocheng;
    const publishedList = await json(base, "/api/work/tasks?queue=published");
    assert.equal(publishedList.data.rows[0].status, "已完成");
    assert.equal(publishedList.data.rows[0].events[0].action, "发布任务");
    assert.equal(publishedList.data.rows[0].events[0].actor, "3");
    const fileId = publishedList.data.rows[0].files[0].id;
    const file = await json(base, `/api/work/tasks/file?id=${fileId}`);
    assert.equal(Buffer.from(file.data.data, "base64").toString(), "完成要求附件");

    current = chen;
    const hidden = await json(base, `/api/work/tasks/file?id=${fileId}`);
    assert.equal(hidden.status, 404);
    const outsider = await json(base, "/api/work/tasks?queue=mine");
    assert.equal(outsider.data.rows.length, 0);

    current = luocheng;
    const diary = await json(base, "/api/work");
    assert.equal(diary.status, 200);
    assert.equal(diary.data.isAdmin, true);
  } finally {
    resetWorkStore();
    await close();
  }
});

test("任务附件用表单上传，重复发布不新增", async () => {
  resetPeopleStore();
  resetWorkStore();
  const notices = [];
  setTaskNotifier(async (personId) => {
    notices.push(String(personId));
    return true;
  });
  const app = express();
  app.use(express.json());
  app.use("/api/work", withUser(luocheng), workRouter);
  const { base, close } = await listen(app);
  try {
    const form = new FormData();
    form.set("id", "task-form-600e");
    form.set("title", "上传附件的任务");
    form.set("description", "说明");
    form.set("criteria", "要求");
    form.set("assignee", "4");
    form.set("reviewer", "3");
    form.set("start_at", "2026-11-17T09:00");
    form.set("due_at", "2026-11-18T09:00");
    form.append("files", new Blob(["表单附件"]), "brief.txt");
    const first = await fetch(`${base}/api/work/tasks/publish`, { method: "POST", body: form });
    const firstData = await first.json();
    assert.equal(first.status, 200);
    assert.equal(firstData.task.files[0].name, "brief.txt");
    const second = new FormData();
    second.set("id", "task-form-600e");
    second.set("title", "另一条");
    second.set("assignee", "4");
    second.set("reviewer", "3");
    second.set("start_at", "2026-11-17T09:00");
    second.set("due_at", "2026-11-18T09:00");
    const again = await fetch(`${base}/api/work/tasks/publish`, { method: "POST", body: second });
    const againData = await again.json();
    assert.equal(againData.duplicate, true);
    assert.equal(againData.task.title, "上传附件的任务");
    assert.equal(notices.length, 1);
    const list = await json(base, "/api/work/tasks?queue=published");
    assert.equal(list.data.rows.length, 1);
  } finally {
    resetWorkStore();
    await close();
  }
});

test("逾期任务只计一次，新的一条单独提醒，待办排人只提醒一次", async () => {
  resetPeopleStore();
  resetWorkStore();
  const notices = [];
  setTaskNotifier(async (personId, title, text, url) => {
    notices.push({ personId: String(personId), title, text, url: url || "" });
    return true;
  });
  let current = luocheng;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = current;
    next();
  });
  app.use("/api/work", workRouter);
  const { base, close } = await listen(app);
  const late = {
    title: "逾期仍算一条",
    assignee: "4",
    reviewer: "3",
    start_at: "2026-11-01T09:00",
    due_at: "2026-11-02T09:00"
  };
  try {
    await json(base, "/api/work/tasks/publish", { method: "POST", body: { ...late, id: "task-late-1" } });
    await json(base, "/api/work/tasks/publish", { method: "POST", body: { ...late, id: "task-late-2", title: "第二条" } });
    await json(base, "/api/work/tasks/publish", { method: "POST", body: { ...late, id: "task-late-2", title: "第二条重复" } });
    const third = await json(base, "/api/work/tasks/publish", { method: "POST", body: { ...late, id: "task-late-3", title: "第三条" } });
    assert.equal(third.status, 200);
    assert.equal(notices.length, 3);
    assert.equal(notices.filter((item) => item.personId === "4").length, 3);
    current = zhang;
    const badges = await json(base, "/api/work/badges");
    assert.equal(badges.data.mine, 3);
    current = luocheng;
    assert.equal((await json(base, "/api/work/badges")).data.review, 0);
  } finally {
    resetWorkStore();
    await close();
  }

  resetPeopleStore();
  resetWorkStore();
  const { resetDingStore } = await import("../src/modules/work/dingtalk.js");
  resetDingStore();
  process.env.DINGTALK_CLIENT_ID = "test-client";
  process.env.DINGTALK_CLIENT_SECRET = "test-secret";
  process.env.DINGTALK_AGENT_ID = "100";
  const calls = [];
  setDingTransport(async (url, options) => {
    calls.push(String(options?.body || ""));
    if (String(url).includes("accessToken")) {
      return { json: async () => ({ accessToken: "token", expireIn: 7200 }) };
    }
    return { json: async () => ({ errcode: 0, task_id: 123, processQueryKey: "test-process" }) };
  });
  try {
    await saveDingBinds(luocheng, { binds: [{ personId: 4, userid: "u4" }] }, true);
    const { saveMembers } = await import("../src/modules/work/store.js");
    await saveMembers(luocheng, { personId: 4, deptCode: "ops" });
    await saveMembers(luocheng, { personId: 4, deptCode: "ops" });
    const todoNotes = calls.filter((body) => body.includes("待办事项") && body.includes("tab=todo"));
    assert.equal(todoNotes.length, 1);
    assert.match(todoNotes[0], /今天的日报还没提交/);
    const app2 = express();
    app2.use(express.json());
    app2.use("/api/work", withUser(zhang), workRouter);
    const staff = await listen(app2);
    try {
      const badge = await json(staff.base, "/api/work/badges");
      assert.equal(badge.data.todo, 1);
    } finally {
      await staff.close();
    }
  } finally {
    delete process.env.DINGTALK_CLIENT_ID;
    delete process.env.DINGTALK_CLIENT_SECRET;
    delete process.env.DINGTALK_AGENT_ID;
    setDingTransport(globalThis.fetch);
    resetDingStore();
    resetWorkStore();
  }
});

test("模块脚本不在 import 时拉长任务", async () => {
  const t0 = Date.now();
  await import("../src/modules/work/router.js");
  assert.ok(Date.now() - t0 < 500);
});
