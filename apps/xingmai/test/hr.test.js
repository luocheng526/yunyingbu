import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import express from "express";
import test from "node:test";
import { createDingClient } from "../src/modules/hr/dingtalk.js";
import { hrRouter, shouldStartHrJobs } from "../src/modules/hr/router.js";
import { ackFor, interestingEvent } from "../src/modules/hr/stream.js";
import {
  HR_SCHEMA,
  listLeaves,
  listLinks,
  listRecruits,
  listOvertime,
  listPunches,
  listQuotas,
  replaceDayPunches,
  resetHrStore,
  saveDingUsers,
  saveLinks,
  upsertLink
} from "../src/modules/hr/store.js";
import {
  boardPack,
  buildBoard,
  effortFromPunches,
  effortHours,
  canSeeHr,
  effortReport,
  matchRoster,
  publicPerson,
  punchesFromDing,
  pullDay,
  pullLeaves,
  pullLate,
  refreshBoardDay,
  readStoredBoard,
  saveBoardSnapshot,
  reconcileMonth,
  rowsForDay,
  runDaily,
  daysOfMonth,
  previousMonth,
  shouldPullYesterday,
  shouldReconcileMonth,
  teamOf
} from "../src/modules/hr/sync.js";

for (const key of ["DINGTALK_CORP_ID", "DINGTALK_CLIENT_ID", "DINGTALK_CLIENT_SECRET"]) {
  delete process.env[key];
}

const root = dirname(fileURLToPath(import.meta.url));
const client = readFileSync(join(root, "../public/shared/modules/hr.js"), "utf8");

function listen(app) {
  return new Promise((resolve) => {
    const server = createServer(app);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

async function request(server, path, { method = "GET", body, user = true, dept = "" } = {}) {
  const { port } = server.address();
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(user ? { "x-test-user": user === true ? "luocheng" : String(user) } : {}),
      ...(dept ? { "x-test-dept": dept } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json();
  return { status: res.status, data };
}

function appWithUser() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (req.headers["x-test-user"]) {
      const name = String(req.headers["x-test-user"]);
      const presets = {
        tech: { username: "tech", displayName: "郝晨淼", department: "技术部" },
        hr: { username: "hr", displayName: "张璇", department: "人事部" },
        other: { username: "other", displayName: "丙", department: "运营一组" }
      };
      req.user = presets[name] || { username: name, displayName: name === "luocheng" ? "罗成" : name };
    }
    next();
  });
  app.use("/api/hr", hrRouter);
  return app;
}

function jsonResponse(body) {
  return {
    ok: true,
    json: async () => body
  };
}

test("hr schema stays in hr_ tables", () => {
  assert.equal(HR_SCHEMA.length, 13);
  for (const sql of HR_SCHEMA) {
    assert.match(sql, /CREATE TABLE IF NOT EXISTS hr_/);
    assert.doesNotMatch(sql, /people|han_|shen_/i);
  }
});

test("client mounts one page and five in-page tabs", () => {
  assert.match(client, /XmModules\["\/hr"\]/);
  const labels = ["数据看板", "奋斗时长", "招聘中心", "员工花名册"];
  let from = 0;
  for (const label of labels) {
    const at = client.indexOf(`label: "${label}"`);
    assert.ok(at > from, label);
    from = at;
  }
  assert.equal(client.includes("面试统计"), false);
  assert.equal(client.includes("人才管理"), false);
  assert.equal(client.includes("加班时长"), false);
  assert.equal(client.includes('XmModules["/hr/'), false);
  assert.equal(client.includes("pushState"), false);
  assert.equal(client.includes("location.assign"), false);
  assert.equal(client.includes("location.href"), false);
  assert.equal(client.includes("password"), false);
  assert.equal(client.includes("DINGTALK_"), false);
  assert.match(client, /var\(--xm-/);
  assert.match(client, /data-theme/);
  assert.match(client, /\/api\/people/);
  assert.match(client, /钉钉还没配置/);
  assert.match(client, /每天 10 点保存前一天/);
  assert.match(client, /state\.boards/);
  assert.match(client, /刷新数据/);
  assert.match(client, /data-updated/);
  assert.match(client, /data-act="refresh-board"/);
  assert.match(client, /data-kpi/);
  assert.match(client, /迟到明细/);
  assert.match(client, /data-punch-list/);
  assert.match(client, /data-kpi-table/);
  assert.match(client, /甄选员工详细名单/);
  assert.match(client, /data-staff-search/);
  assert.match(client, /data-staff-pick/);
  assert.match(client, /data-staff-field/);
  const boardTitles = ["甄选运营团队看板", "后端团队看板", "总看板"];
  let titleAt = 0;
  for (const title of boardTitles) {
    const at = client.indexOf(title);
    assert.ok(at > titleAt, title);
    titleAt = at;
  }
  assert.equal(client.includes('class="hr-title"'), false);
  assert.equal(client.includes("每天一张"), false);
});

test("browser script survives the release import check", async () => {
  await import(pathToFileURL(join(root, "../public/shared/modules/hr.js")).href);
});

test("smoke import does not stay alive when DingTalk env is present", async () => {
  assert.equal(shouldStartHrJobs(), false);
  const { spawn } = await import("node:child_process");
  const appRoot = join(root, "..");
  const code = `
process.env.DINGTALK_CORP_ID = "corp";
process.env.DINGTALK_CLIENT_ID = "app";
process.env.DINGTALK_CLIENT_SECRET = "secret";
process.env.MENGKAI_SMOKE_LIVE = ${JSON.stringify(appRoot)};
await import(${JSON.stringify(pathToFileURL(join(appRoot, "src/modules/hr/router.js")).href)});
console.log("SMOKE_OK");
`;
  const child = spawn(process.execPath, ["--input-type=module", "-e", code], { stdio: ["ignore", "pipe", "pipe"] });
  const out = await new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`smoke import hung: ${stderr}`));
    }, 4000);
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("exit", (status) => {
      clearTimeout(timer);
      resolve({ status, stdout, stderr });
    });
  });
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /SMOKE_OK/);
});

test("mapping uses job number or phone and skips ambiguous names", () => {
  const people = [
    { id: 1, name: "同名", status: "在职", employeeNo: "A1", phone: "" },
    { id: 2, name: "同名", status: "在职", employeeNo: "", phone: "13800000000" },
    { id: 3, name: "同名", status: "在职", employeeNo: "", phone: "" },
    { id: 4, name: "离职人", status: "离职", employeeNo: "A4", phone: "" },
    { id: 5, name: "重号", status: "在职", employeeNo: "A1", phone: "" }
  ];
  const users = [
    { userId: "u1", jobNumber: "A1", mobile: "" },
    { userId: "u2", jobNumber: "", mobile: "+86 138 0000 0000" }
  ];
  const matched = matchRoster(people, users);
  assert.deepEqual(matched.links.map((row) => row.personId), [2]);
  assert.equal(matched.links[0].matchBy, "phone");
  assert.equal(matched.links[0].dingtalkUserId, "u2");
  assert.ok(matched.skipped.some((row) => row.personId === 3 && row.reason.includes("没有工号")));
  assert.ok(matched.skipped.filter((row) => row.reason.includes("同一个钉钉用户")).length >= 2);
  assert.equal(matched.skipped.some((row) => row.personId === 4), false);
});

test("public person drops anything except the roster fields", () => {
  const view = publicPerson({ id: 9, name: "甲", status: "在职", employeeNo: "E9", phone: "13900000000", department: "运营", password: "hidden", username: "jia" });
  assert.deepEqual(Object.keys(view).sort(), ["assistant", "board", "center", "department", "director", "employeeNo", "id", "lineManager", "name", "operator", "phone", "reserve", "role", "status", "supervisor"]);
  assert.equal(JSON.stringify(view).includes("hidden"), false);
});

test("NotSigned does not invent a clock time", () => {
  const links = new Map([["u2", { personId: 2 }]]);
  const rows = punchesFromDing([
    { id: "on", userId: "u2", checkType: "OnDuty", timeResult: "Normal", userCheckTime: Date.parse("2026-11-15T01:02:00Z"), baseCheckTime: 1 },
    { id: "off", userId: "u2", checkType: "OffDuty", timeResult: "NotSigned", baseCheckTime: Date.parse("2026-11-15T10:00:00Z") }
  ], links, "2026-11-15");
  assert.equal(rows[0].checkAt, "2026-11-15 09:02");
  assert.equal(rows[0].label, "正常");
  assert.equal(rows[1].checkAt, "");
  assert.equal(rows[1].label, "未打卡");
});

test("yesterday is saved once after 10:00 and last month is checked on the 1st", () => {
  assert.equal(shouldPullYesterday({ hour: 9 }, null, "2026-11-15"), false);
  assert.equal(shouldPullYesterday({ hour: 10 }, null, "2026-11-15"), true);
  assert.equal(shouldPullYesterday({ hour: 12 }, { ok: true, workDate: "2026-11-15" }, "2026-11-15"), false);
  assert.equal(shouldPullYesterday({ hour: 12 }, { ok: true, workDate: "2026-11-14" }, "2026-11-15"), true);
  assert.equal(previousMonth("2026-11-01"), "2026-10");
  assert.equal(previousMonth("2026-01-01"), "2025-12");
  assert.equal(daysOfMonth("2026-02").length, 28);
  assert.equal(shouldReconcileMonth({ day: 1, hour: 9 }, null, "2026-11-01"), false);
  assert.equal(shouldReconcileMonth({ day: 1, hour: 10 }, null, "2026-11-01"), true);
  assert.equal(shouldReconcileMonth({ day: 2, hour: 10 }, null, "2026-11-02"), false);
  assert.equal(shouldReconcileMonth({ day: 1, hour: 11 }, { ok: true, workDate: "2026-10" }, "2026-11-01"), false);
  const rows = rowsForDay(
    [{ userId: "a", userName: "甲", department: "运营二区", jobNumber: "" }],
    [{ dingtalkUserId: "a", workDate: "2026-11-16", userName: "", department: "", checkAt: "2026-11-16 09:01", timeResult: "Normal", checkType: "OnDuty" }],
    "2026-11-16"
  );
  assert.equal(rows[0].userName, "甲");
  assert.equal(rows[0].department, "运营二区");
});

test("ops board counts 运营 人事 技术, backend skips 综合部, total is the sum", () => {
  assert.equal(teamOf("运营二区（沈子晗）"), "ops");
  assert.equal(teamOf("人事部"), "ops");
  assert.equal(teamOf("技术部"), "ops");
  assert.equal(teamOf("综合部"), "skip");
  assert.equal(teamOf("工商部"), "backend");
  assert.equal(teamOf("客服部"), "backend");
  const users = [
    { userId: "a", department: "运营二区（沈子晗）" },
    { userId: "b", department: "人事部" },
    { userId: "c", department: "技术部" },
    { userId: "d", department: "工商部" },
    { userId: "e", department: "综合部" }
  ];
  const punches = users.map((user) => ({
    dingtalkUserId: user.userId,
    workDate: "2026-11-16",
    checkAt: "2026-11-16 09:00",
    timeResult: "Normal",
    checkType: "OnDuty"
  }));
  const packs = boardPack({ date: "2026-11-16", users, punches, leaves: [], dates: ["2026-11-16"] });
  assert.deepEqual(packs.map((item) => item.title), ["甄选运营团队看板", "后端团队看板", "总看板"]);
  assert.equal(packs[0].board.staff, 3);
  assert.equal(packs[0].board.punched, 3);
  assert.equal(packs[1].board.staff, 1);
  assert.equal(packs[1].board.departments[0].name, "工商部");
  assert.equal(packs[2].board.staff, 4);
  assert.equal(packs[0].punches.some((row) => row.department === "综合部"), false);
  assert.equal(packs[2].punches.some((row) => row.department === "综合部"), false);
});

test("effort hours start after 18:00 and only count 运营 departments", () => {
  assert.equal(effortHours("2026-11-16", "2026-11-16 17:50"), 0);
  assert.equal(effortHours("2026-11-16", "2026-11-16 18:00"), 0);
  assert.equal(effortHours("2026-11-16", "2026-11-16 20:30"), 2.5);
  assert.equal(effortHours("2026-11-16", "2026-11-17 00:30"), 6.5);
  const people = effortFromPunches([
    { dingtalkUserId: "a", userName: "甲", department: "运营二区（沈子晗）", workDate: "2026-11-16", checkType: "OffDuty", checkAt: "2026-11-16 20:30" },
    { dingtalkUserId: "a", userName: "甲", department: "运营二区（沈子晗）", workDate: "2026-11-16", checkType: "OffDuty", checkAt: "2026-11-16 21:00" },
    { dingtalkUserId: "a", userName: "甲", department: "运营二区（沈子晗）", workDate: "2026-11-17", checkType: "OffDuty", checkAt: "2026-11-17 19:00" },
    { dingtalkUserId: "b", userName: "乙", department: "人事部", workDate: "2026-11-16", checkType: "OffDuty", checkAt: "2026-11-16 21:00" },
    { dingtalkUserId: "c", userName: "丙", department: "工商部", workDate: "2026-11-16", checkType: "OffDuty", checkAt: "2026-11-16 22:00" }
  ], "2026-11");
  assert.equal(people.length, 1);
  assert.equal(people[0].name, "甲");
  assert.equal(people[0].hours, 4);
  assert.deepEqual(people[0].days.map((day) => day.date), ["2026-11-16", "2026-11-17"]);
  assert.equal(people[0].days[0].offAt, "2026-11-16 21:00");
  assert.equal(people[0].days[0].hours, 3);
});

test("effort report ranks roles, averages teams, and lists who is not aligned", () => {
  const report = effortReport({
    month: "2026-11",
    users: [
      { userId: "u1", userName: "甲", department: "运营一组", jobNumber: "A1" },
      { userId: "u2", userName: "乙", department: "运营一组", jobNumber: "" },
      { userId: "u3", userName: "丙", department: "人事部", jobNumber: "" }
    ],
    punches: [
      { dingtalkUserId: "u1", userName: "甲", department: "运营一组", workDate: "2026-11-16", checkType: "OffDuty", checkAt: "2026-11-16 20:30" },
      { dingtalkUserId: "u2", userName: "乙", department: "运营一组", workDate: "2026-11-16", checkType: "OffDuty", checkAt: "2026-11-16 19:00" }
    ],
    people: [
      { id: 1, name: "甲", role: "助理", status: "在职", department: "沈子晗运营中心", employeeNo: "A1", password: "hidden" },
      { id: 2, name: "丁", role: "运营", status: "在职", department: "韩梦凯运营中心", employeeNo: "" }
    ],
    links: []
  });
  assert.equal(JSON.stringify(report).includes("hidden"), false);
  assert.equal(report.participants, 2);
  assert.equal(report.roster, 2);
  assert.equal(report.hours, 3.5);
  assert.equal(report.average, 1.8);
  assert.equal(report.teams[0].name, "运营一组");
  assert.equal(report.teams[0].average, 1.8);
  assert.deepEqual(report.ranks[0].rows.map((row) => row.name), ["甲"]);
  assert.deepEqual(report.ranks[1].rows.map((row) => row.name), ["丁"]);
  assert.equal(report.watch.dingMiss[0].name, "乙");
  assert.equal(report.watch.orgMiss[0].name, "丁");
  assert.equal(report.watch.conflict, true);
});

test("assistant and operator ranks follow the org personnel columns", () => {
  const report = effortReport({
    month: "2026-11",
    users: [
      { userId: "u1", userName: "郭想", department: "运营二组（毛永超）", jobNumber: "" },
      { userId: "u2", userName: "崔天昊", department: "运营二组（毛永超）", jobNumber: "" },
      { userId: "u3", userName: "毛永超", department: "运营二组（毛永超）", jobNumber: "" }
    ],
    punches: [
      { dingtalkUserId: "u1", userName: "郭想", department: "运营二组（毛永超）", workDate: "2026-11-16", checkType: "OffDuty", checkAt: "2026-11-16 21:00" },
      { dingtalkUserId: "u2", userName: "崔天昊", department: "运营二组（毛永超）", workDate: "2026-11-16", checkType: "OffDuty", checkAt: "2026-11-16 20:00" }
    ],
    people: [
      { id: 1, name: "郭想", role: "运营", status: "在职", board: "ops", center: "韩梦凯运营中心", department: "韩梦凯运营中心", supervisor: "毛永超", operator: "无", assistant: "郭想" },
      { id: 2, name: "崔天昊", role: "运营", status: "在职", board: "ops", center: "韩梦凯运营中心", department: "韩梦凯运营中心", supervisor: "毛永超", operator: "崔天昊", assistant: "无" },
      { id: 3, name: "毛永超", role: "运营", status: "在职", board: "ops", center: "韩梦凯运营中心", department: "韩梦凯运营中心", supervisor: "毛永超", operator: "毛永超", assistant: "" },
      { id: 4, name: "孙广泽", role: "运营", status: "在职", board: "ops", center: "韩梦凯运营中心", department: "韩梦凯运营中心", supervisor: "高明阳", operator: "杨顺", assistant: "孙广泽" },
      { id: 5, name: "张璇", role: "主管", status: "在职", board: "hrTech", center: "其他", department: "其他", supervisor: "张璇", operator: "", assistant: "" }
    ],
    links: []
  });
  assert.deepEqual(report.ranks[0].rows.map((row) => row.name), ["郭想", "孙广泽"]);
  assert.equal(report.ranks[0].rows[1].department, "韩梦凯运营中心");
  assert.deepEqual(report.ranks[1].rows.map((row) => row.name), ["崔天昊", "毛永超"]);
  assert.deepEqual(report.ranks[2].rows.map((row) => row.name), ["毛永超"]);
  assert.equal(report.people.find((row) => row.name === "郭想").role, "助理");
  assert.equal(report.ranks.some((rank) => rank.rows.some((row) => row.name === "张璇")), false);
});

test("a manual alignment stays when the daily match is rewritten", async () => {
  resetHrStore();
  await upsertLink({ personId: 9, dingtalkUserId: "keep" });
  await saveLinks([
    { personId: 9, dingtalkUserId: "other", matchBy: "job_number", employeeNo: "A9" },
    { personId: 8, dingtalkUserId: "new", matchBy: "phone", employeeNo: "" }
  ], { keepManual: true });
  const links = await listLinks();
  assert.deepEqual(links.map((link) => [link.personId, link.dingtalkUserId, link.matchBy]), [
    [9, "keep", "manual"],
    [8, "new", "phone"]
  ]);
});

test("attendance board counts staff, punches, late arrivals, leave, and departments", () => {
  const board = buildBoard({
    date: "2026-11-16",
    users: [
      { userId: "a", department: "运营部" },
      { userId: "b", department: "运营部" },
      { userId: "c", department: "产品部" }
    ],
    punches: [
      { dingtalkUserId: "a", workDate: "2026-11-16", timeResult: "Late", checkAt: "2026-11-16 09:20" },
      { dingtalkUserId: "b", workDate: "2026-11-16", timeResult: "Normal", checkAt: "2026-11-16 09:00" },
      { dingtalkUserId: "c", workDate: "2026-11-16", timeResult: "NotSigned", checkAt: "" }
    ],
    leaves: [{ dingtalkUserId: "c", startAt: "2026-11-16 09:00", endAt: "2026-11-16 18:00" }]
  });
  assert.equal(board.staff, 3);
  assert.equal(board.expected, 2);
  assert.equal(board.punched, 2);
  assert.equal(board.late, 1);
  assert.equal(board.leave, 1);
  assert.equal(board.departments[0].name, "运营部");
  assert.equal(board.departments[0].count, 2);
  assert.equal(board.departments.find((row) => row.name === "产品部").leave, 1);
});

test("a punch is stored even when the person is not on the org roster", async () => {
  resetHrStore();
  const fake = {
    configured: () => true,
    async listUsers() {
      return [{ userId: "ding-9", name: "丁", jobNumber: "SZ099", mobile: "13900000000" }];
    },
    async listAttendance() {
      return [{ id: "r9", userId: "ding-9", checkType: "OnDuty", timeResult: "Late", userCheckTime: Date.parse("2026-11-13T01:20:00Z") }];
    }
  };
  const pulled = await pullDay("2026-11-13", { client: fake });
  assert.equal(pulled.users, 1);
  const rows = await listPunches({ date: "2026-11-13" });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].personId, 0);
  assert.equal(rows[0].userName, "丁");
  assert.equal(rows[0].jobNumber, "SZ099");
  assert.equal(rows[0].checkAt, "2026-11-13 09:20");
  assert.equal(JSON.stringify(rows).includes("13900000000"), false);
});

test("the board keeps the saved day instead of rebuilding it", async () => {
  resetHrStore();
  await saveDingUsers([{ userId: "u1", userName: "甲", jobNumber: "A1", department: "运营一组" }]);
  await replaceDayPunches("2020-11-15", ["u1"], [{
    dingtalkUserId: "u1",
    userName: "甲",
    department: "运营一组",
    jobNumber: "A1",
    workDate: "2020-11-15",
    checkType: "OnDuty",
    timeResult: "Late",
    label: "迟到",
    checkAt: "2020-11-15 09:20",
    recordId: "r1"
  }]);
  const first = await readStoredBoard("2020-11-15");
  assert.equal(first.saved, true);
  assert.equal(first.boards[0].board.punched, 1);
  assert.equal(first.boards[0].board.late, 1);
  assert.equal(first.days.length, 7);
  await replaceDayPunches("2020-11-15", ["u1"], []);
  const second = await readStoredBoard("2020-11-15");
  assert.equal(second.boards[0].board.punched, 1);
  assert.equal(second.boards[0].board.late, 1);
});

test("the monthly check overwrites a stored day with the ding result", async () => {
  resetHrStore();
  await saveDingUsers([{ userId: "u1", userName: "甲", jobNumber: "A1", department: "运营一组" }]);
  await replaceDayPunches("2026-02-02", ["u1"], [{
    dingtalkUserId: "u1",
    userName: "甲",
    department: "运营一组",
    jobNumber: "A1",
    workDate: "2026-02-02",
    checkType: "OnDuty",
    timeResult: "Late",
    label: "迟到",
    checkAt: "2026-02-02 09:40",
    recordId: "old"
  }]);
  const fake = {
    configured: () => true,
    async listUsers() {
      return [{ userId: "u1", name: "甲", jobNumber: "A1", department: "运营一组" }];
    },
    async listAttendance(_ids, day) {
      if (day !== "2026-02-02") return [];
      return [{ id: "new", userId: "u1", checkType: "OnDuty", timeResult: "Normal", userCheckTime: Date.parse("2026-02-02T01:00:00Z") }];
    }
  };
  const result = await reconcileMonth("2026-02", fake);
  assert.equal(result.configured, true);
  assert.equal(result.failed, 0);
  assert.equal(result.days, 28);
  const rows = await listPunches({ date: "2026-02-02" });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].timeResult, "Normal");
  const board = await readStoredBoard("2026-02-02");
  assert.equal(board.boards[0].board.late, 0);
  assert.equal(board.boards[0].board.punched, 1);
});

test("late results come from the attendance day, not only the raw punch", async () => {
  resetHrStore();
  await saveDingUsers([{ userId: "u1", userName: "甲", jobNumber: "A1", department: "运营一组" }]);
  await replaceDayPunches("2020-11-15", ["u1"], [{
    dingtalkUserId: "u1",
    userName: "甲",
    department: "运营一组",
    jobNumber: "A1",
    workDate: "2020-11-15",
    checkType: "OnDuty",
    timeResult: "Normal",
    label: "正常",
    checkAt: "2020-11-15 09:25",
    recordId: "p1"
  }]);
  const found = await pullLate("2020-11-15", {
    configured: () => true,
    async listUpdatedata() {
      return [{
        check_type: "OnDuty",
        time_result: "Late",
        plan_check_time: Date.parse("2020-11-15T01:00:00Z"),
        user_check_time: Date.parse("2020-11-15T01:25:00Z")
      }];
    }
  });
  assert.equal(found.length, 1);
  assert.equal(found[0].minutes, 25);
  assert.equal(found[0].label, "迟到");
  const punches = await listPunches({ date: "2020-11-15" });
  assert.equal(punches[0].timeResult, "Late");
  assert.equal(punches[0].lateMinutes, 25);
  await saveBoardSnapshot("2020-11-15");
  const board = await readStoredBoard("2020-11-15");
  assert.equal(board.boards[0].board.late, 1);
  assert.equal(board.boards[0].roster.filter((row) => row.late).length, 1);
  assert.equal(board.boards[0].roster.find((row) => row.late).name, "甲");
});

test("refreshing a day pulls punches and leave and stamps the time", async () => {
  resetHrStore();
  const fake = {
    configured: () => true,
    async listUsers() {
      return [{ userId: "u1", name: "甲", jobNumber: "A1", department: "运营一组" }];
    },
    async listAttendance() {
      return [{ id: "p1", userId: "u1", checkType: "OnDuty", timeResult: "Normal", userCheckTime: Date.parse("2020-11-15T01:00:00Z") }];
    },
    async listLeaveStatus() {
      return [{
        userid: "u1",
        leave_code: "sick",
        start_time: Date.parse("2020-11-15T00:00:00Z"),
        end_time: Date.parse("2020-11-15T10:00:00Z"),
        duration_percent: 100
      }];
    },
    async listVacationTypes() {
      return [{ leave_code: "sick", leave_name: "病假" }];
    },
    async listVacationQuota() {
      return [];
    }
  };
  const result = await refreshBoardDay("2020-11-15", fake);
  assert.equal(result.configured, true);
  assert.equal(result.workDate, "2020-11-15");
  assert.match(result.updatedAt, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  assert.equal(result.punches > 0, true);
  assert.equal(result.leaveCount, 1);
  const board = await readStoredBoard("2020-11-15");
  assert.equal(board.updatedAt, result.updatedAt);
  assert.equal(board.boards[0].board.punched, 1);
  assert.equal(board.boards[0].board.leave, 1);
});

test("leave is counted from ding users when nobody is aligned", async () => {
  resetHrStore();
  await saveDingUsers([{ userId: "u-leave", userName: "乙", jobNumber: "", department: "运营一组" }]);
  await saveBoardSnapshot("2020-11-15");
  assert.equal((await readStoredBoard("2020-11-15")).boards[0].board.leave, 0);
  const fake = {
    configured: () => true,
    async listLeaveStatus() {
      return [{
        userid: "u-leave",
        leave_code: "sick",
        start_time: Date.parse("2020-11-15T00:00:00Z"),
        end_time: Date.parse("2020-11-15T10:00:00Z"),
        duration_percent: 100
      }];
    },
    async listVacationTypes() {
      return [{ leave_code: "sick", leave_name: "病假" }, { leave_code: "comp", leave_name: "调休" }];
    },
    async listVacationQuota() {
      return [];
    }
  };
  const pulled = await pullLeaves("2020-11-15", "2020-11-15", fake);
  assert.equal(pulled.leaves.length, 1);
  assert.equal(pulled.leaves[0].leaveName, "病假");
  assert.equal((await listLinks()).length, 0);
  await saveBoardSnapshot("2020-11-15");
  const board = await readStoredBoard("2020-11-15");
  assert.equal(board.boards[0].board.leave, 1);
  assert.equal(board.boards[0].board.expected, 0);
});

test("unconfigured daily pull writes nothing", async () => {
  resetHrStore();
  const result = await runDaily("2026-11-15");
  assert.equal(result.configured, false);
  assert.deepEqual(await listPunches({ date: "2026-11-15" }), []);
  assert.deepEqual(await listLinks(), []);
  assert.deepEqual(await listOvertime({ month: "2026-11" }), []);
  assert.deepEqual(await listQuotas(), []);
});

test("a successful pull keeps the same person and day, and an error keeps the old row", async () => {
  resetHrStore();
  const roster = [{ id: 7, name: "甲", status: "在职", employeeNo: "E001", phone: "", department: "运营" }];
  const fake = {
    configured: () => true,
    async listUsers() {
      return [{ userId: "ding-1", mobile: "", jobNumber: "E001" }];
    },
    async listAttendance() {
      return [
        { id: "r1", userId: "ding-1", checkType: "OnDuty", timeResult: "Normal", userCheckTime: Date.parse("2026-11-15T01:00:00Z") },
        { id: "r2", userId: "ding-1", checkType: "OffDuty", timeResult: "NotSigned", baseCheckTime: Date.parse("2026-11-15T10:00:00Z") }
      ];
    },
    async listLeaveStatus() {
      return [
        {
          userid: "ding-1",
          leave_code: "comp",
          start_time: Date.parse("2026-11-15T01:00:00Z"),
          end_time: Date.parse("2026-11-15T10:00:00Z"),
          duration_percent: 100
        },
        {
          userid: "ding-1",
          leave_code: "annual",
          start_time: Date.parse("2026-11-15T01:00:00Z"),
          end_time: Date.parse("2026-11-15T10:00:00Z"),
          duration_percent: 100
        }
      ];
    },
    async listVacationTypes() {
      return [{ leave_code: "comp", leave_name: "调休" }, { leave_code: "annual", leave_name: "年假" }];
    },
    async listVacationQuota(_op, code) {
      if (code !== "comp") return [{ userid: "ding-1", quota_num_per_hour: 40, used_num_per_hour: 0 }];
      return [{ userid: "ding-1", quota_num_per_hour: 8, used_num_per_hour: 1 }];
    },
    async listOvertimeHours() {
      return [{ column_vals: [{ value: "2.5" }] }];
    }
  };
  const { alignRoster, pullLeaveAndOvertime } = await import("../src/modules/hr/sync.js");
  const pulled = await alignRoster(fake, roster);
  assert.equal(pulled.links.length, 1);
  await pullDay("2026-11-15", { client: fake });
  const punches = await listPunches({ date: "2026-11-15" });
  assert.equal(punches.length, 2);
  assert.equal(punches.every((row) => row.personId === 7), true);
  assert.equal(punches[0].jobNumber, "E001");
  assert.equal(punches.find((row) => row.checkType === "OnDuty").checkAt, "2026-11-15 09:00");
  assert.equal(punches.find((row) => row.checkType === "OffDuty").checkAt, "");
  await pullLeaveAndOvertime("2026-11-15", fake);
  const leaves = await listLeaves();
  assert.equal(leaves.length, 2);
  assert.equal(leaves.some((row) => row.leaveName === "调休"), true);
  assert.equal(leaves.some((row) => row.leaveName === "年假"), true);
  assert.equal(leaves.every((row) => row.dingtalkUserId === "ding-1"), true);
  const quotas = await listQuotas();
  assert.equal(quotas.length, 1);
  assert.equal(quotas[0].leaveName, "调休");
  assert.equal(quotas[0].balanceHours, 7);
  const overtime = await listOvertime({ month: "2026-11" });
  assert.equal(overtime[0].hours, 2.5);
  assert.equal(overtime[0].personId, 7);

  const failing = {
    configured: () => true,
    async listAttendance() {
      throw Object.assign(new Error("钉钉接口没有返回数据"), { statusCode: 502 });
    }
  };
  await assert.rejects(() => pullDay("2026-11-15", { client: failing }));
  assert.equal((await listPunches({ date: "2026-11-15" })).length, 2);
});

test("ding client asks the official attendance api with isI18n false", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) });
    if (String(url).includes("/oauth2/")) return jsonResponse({ accessToken: "test-token", expireIn: 7200 });
    if (String(url).includes("/department/listsub")) return jsonResponse({ errcode: 0, result: [] });
    if (String(url).includes("/user/list")) {
      return jsonResponse({ errcode: 0, result: { list: [{ userid: "u", mobile: "13900001111", job_number: "J1", name: "不保留" }], has_more: false } });
    }
    if (String(url).includes("/attendance/list")) return jsonResponse({ errcode: 0, recordresult: [], hasMore: false });
    return jsonResponse({ errcode: 0, result: {} });
  };
  const ding = createDingClient({
    env: { DINGTALK_CORP_ID: "corp", DINGTALK_CLIENT_ID: "app", DINGTALK_CLIENT_SECRET: "secret" },
    fetchImpl
  });
  const users = await ding.listUsers();
  assert.deepEqual(users, [{ userId: "u", name: "不保留", mobile: "13900001111", jobNumber: "J1", department: "" }]);
  await ding.listAttendance(["u"], "2026-11-15");
  const attendance = calls.find((call) => call.url.includes("/attendance/list"));
  assert.equal(attendance.body.isI18n, false);
  assert.deepEqual(attendance.body.userIdList, ["u"]);
  assert.equal(attendance.url.includes("oapi.dingtalk.com"), true);
});

test("stream ack answers ping and only pulls finished attendance approvals", () => {
  const ping = ackFor({ type: "SYSTEM", headers: { topic: "ping", messageId: "m1" }, data: JSON.stringify({ opaque: "abc" }) });
  assert.equal(JSON.parse(ping.data).opaque, "abc");
  const event = ackFor({ type: "EVENT", headers: { topic: "*", messageId: "m2" }, data: "{}" });
  assert.equal(JSON.parse(event.data).status, "SUCCESS");
  assert.equal(ackFor({ type: "SYSTEM", headers: { topic: "disconnect", messageId: "m3" } }), null);
  const punch = interestingEvent({
    type: "EVENT",
    headers: { eventType: "attendance_check_record", eventCorpId: "corp" },
    data: JSON.stringify({ dataList: [{ userId: "u2", checkTime: 1 }] })
  }, "corp");
  assert.deepEqual(punch.userIds, ["u2"]);
  const otherCorp = interestingEvent({
    type: "EVENT",
    headers: { eventType: "attendance_check_record", eventCorpId: "other" },
    data: JSON.stringify({ dataList: [{ userId: "u2" }] })
  }, "corp");
  assert.equal(otherCorp, null);
  const agreed = interestingEvent({
    type: "EVENT",
    headers: { eventType: "bpms_instance_change", eventCorpId: "corp" },
    data: JSON.stringify({ type: "finish", result: "agree", bizCategoryId: "attendance.batchovertime", staffId: "u9", title: "加班 3 小时" })
  }, "corp");
  assert.deepEqual(agreed, { kind: "approval", userIds: ["u9"] });
  const started = interestingEvent({
    type: "EVENT",
    headers: { eventType: "bpms_instance_change" },
    data: JSON.stringify({ type: "start", result: "agree", bizCategoryId: "attendance.leave", staffId: "u9" })
  }, "");
  assert.equal(started, null);
});

test("only named leaders and hr or tech departments can open hr", () => {
  assert.equal(canSeeHr({ username: "luocheng", displayName: "罗成" }), true);
  assert.equal(canSeeHr({ displayName: "韩梦凯" }), true);
  assert.equal(canSeeHr({ displayName: "沈子晗" }), true);
  assert.equal(canSeeHr({ displayName: "甲", department: "技术部" }), true);
  assert.equal(canSeeHr({ displayName: "乙" }, [], [{ userName: "乙", department: "人事部" }]), true);
  assert.equal(canSeeHr({ displayName: "丙", department: "运营一组" }), false);
});

test("roster keeps ops punch staff and can be imported or marked left", async () => {
  resetHrStore();
  await replaceDayPunches("2026-11-16", ["u1", "u2"], [
    { dingtalkUserId: "u1", userName: "甲", jobNumber: "A1", department: "运营一组", checkType: "OnDuty", timeResult: "Normal", checkAt: "2026-11-16 09:00", recordId: "1" },
    { dingtalkUserId: "u2", userName: "乙", jobNumber: "B1", department: "技术部", checkType: "OnDuty", timeResult: "Normal", checkAt: "2026-11-16 09:00", recordId: "2" }
  ]);
  const server = await listen(appWithUser());
  try {
    const synced = await request(server, "/api/hr/staff/sync", { method: "POST", body: {} });
    assert.equal(synced.status, 200);
    assert.equal(synced.data.added, 1);
    const created = await request(server, "/api/hr/staff", {
      method: "POST",
      body: { name: "丙", department: "运营二组", status: "在职", phone: "13800002222" }
    });
    assert.equal(created.status, 201);
    const imported = await request(server, "/api/hr/staff/import", {
      method: "POST",
      body: { rows: [{ name: "甲", jobNumber: "A1", education: "本科", status: "离职", leftOn: "2026-11-16" }] }
    });
    assert.equal(imported.data.added, 0);
    assert.equal(imported.data.updated, 1);
    const again = await request(server, "/api/hr/staff/sync", { method: "POST", body: {} });
    assert.equal(again.data.added, 0);
    const left = await request(server, "/api/hr/staff?status=" + encodeURIComponent("离职"));
    assert.equal(left.data.staff.length, 1);
    assert.equal(left.data.staff[0].name, "甲");
    assert.equal(left.data.staff[0].education, "本科");
    assert.equal(left.data.staff[0].leftOn, "2026-11-16");
    const all = await request(server, "/api/hr/staff");
    assert.equal(all.data.staff.length, 2);
    assert.equal(JSON.stringify(all.data).includes("password"), false);
    const row = left.data.staff[0];
    const edited = await request(server, "/api/hr/staff/" + row.id, {
      method: "PUT",
      body: {
        name: row.name,
        gender: "女",
        jobNumber: row.jobNumber,
        department: row.department,
        position: "运营",
        phone: "13800003333",
        joinedOn: "2026-11-01",
        leftOn: row.leftOn,
        status: "离职",
        hometown: "天津",
        education: row.education,
        emergencyName: "张三",
        emergencyPhone: "13900004444",
        note: "手工修改",
        dingtalkUserId: row.dingtalkUserId,
        replace: true
      }
    });
    assert.equal(edited.status, 200);
    assert.equal(edited.data.staff.position, "运营");
    assert.equal(edited.data.staff.hometown, "天津");
    assert.equal(edited.data.staff.note, "手工修改");
    assert.equal(edited.data.staff.dingtalkUserId, "u1");
  } finally {
    await close(server);
  }
});

test("registering a hire copies them onto the active roster once", async () => {
  resetHrStore();
  const server = await listen(appWithUser());
  try {
    const created = await request(server, "/api/hr/recruits", {
      method: "POST",
      body: {
        name: "谷凤晴",
        gender: "女",
        position: "运营经理",
        expectedJoin: "2026-11-16",
        phone: "15622535135",
        hometown: "天津市宁河区",
        channel: "BOSS",
        inviter: "李栖彤",
        note: "无",
        recordDate: "2026-11-16"
      }
    });
    assert.equal(created.status, 201);
    const month = await request(server, "/api/hr/recruits?month=2026-11");
    assert.equal(month.data.recruits.length, 1);
    assert.equal(month.data.recruits[0].joined, false);
    const other = await request(server, "/api/hr/recruits?month=2026-10");
    assert.equal(other.data.recruits.length, 0);
    const joined = await request(server, `/api/hr/recruits/${created.data.recruit.id}/join`, { method: "POST", body: {} });
    assert.equal(joined.status, 200);
    assert.equal(joined.data.recruit.joined, true);
    assert.equal(joined.data.staff.status, "在职");
    assert.equal(joined.data.staff.name, "谷凤晴");
    assert.equal(joined.data.staff.position, "运营经理");
    assert.equal(joined.data.staff.joinedOn, "2026-11-16");
    const again = await request(server, `/api/hr/recruits/${created.data.recruit.id}/join`, { method: "POST", body: {} });
    assert.equal(again.data.already, true);
    const roster = await request(server, "/api/hr/staff?status=" + encodeURIComponent("在职"));
    assert.equal(roster.data.staff.filter((row) => row.name === "谷凤晴").length, 1);
  } finally {
    await close(server);
  }
});

test("http keeps attendance read-only and interviews in this module", async () => {
  resetHrStore();
  await saveLinks([]);
  await replaceDayPunches("2026-11-15", [1], []);
  const server = await listen(appWithUser());
  try {
    const denied = await request(server, "/api/hr", { user: false });
    assert.equal(denied.status, 401);
    const hidden = await request(server, "/api/hr", { user: "other" });
    assert.equal(hidden.status, 403);
    const tech = await request(server, "/api/hr/access", { user: "tech" });
    assert.equal(tech.status, 200);
    assert.equal(tech.data.allowed, true);
    const hr = await request(server, "/api/hr/access", { user: "hr" });
    assert.equal(hr.data.allowed, true);
    const home = await request(server, "/api/hr");
    assert.equal(home.status, 200);
    assert.deepEqual(home.data.tabs, ["数据看板", "奋斗时长", "招聘中心", "员工花名册"]);
    const effort = await request(server, "/api/hr/effort?month=2026-11");
    assert.equal(effort.data.hours, 0);
    assert.equal(Array.isArray(effort.data.people), true);
    assert.equal(Array.isArray(effort.data.watch.orgMiss), true);
    assert.equal(JSON.stringify(effort.data).includes("password"), false);
    assert.deepEqual(effort.data.ranks.map((rank) => rank.title), ["助理排行", "运营排行", "主管/储备/经理排行"]);
    const linked = await request(server, "/api/hr/links", { method: "POST", body: { personId: 5, dingtalkUserId: "u9" } });
    assert.equal(linked.status, 201);
    assert.equal((await listLinks())[0].matchBy, "manual");
    const cleared = await request(server, "/api/hr/links/5", { method: "DELETE" });
    assert.equal(cleared.status, 200);
    assert.deepEqual(await listLinks(), []);
    assert.equal(home.data.module, "hr");
    const status = await request(server, "/api/hr/status");
    assert.equal(status.data.configured, false);
    assert.equal(JSON.stringify(status.data).includes("secret"), false);
    const empty = await request(server, "/api/hr/attendance?month=2026-11");
    assert.deepEqual(empty.data.punches, []);
    const board = await request(server, "/api/hr/board?date=2026-11-16");
    assert.equal(board.data.board.staff, 0);
    assert.equal(board.data.board.leave, 0);
    assert.equal(board.data.days.length, 7);
    assert.equal(client.includes("入职审批"), false);
    assert.match(client, /今日应到人数|应到人数/);
    assert.match(client, /部门人数/);
    const synced = await request(server, "/api/hr/sync", { method: "POST" });
    assert.equal(synced.data.configured, false);
    const created = await request(server, "/api/hr/recruits", {
      method: "POST",
      body: {
        name: "周周",
        gender: "女",
        position: "运营",
        expectedJoin: "2026-12-01",
        phone: "13800001111",
        hometown: "安徽",
        channel: "BOSS",
        inviter: "李四",
        note: "下午联系",
        detail: "可尽快到岗",
        recordDate: "2026-11-16"
      }
    });
    assert.equal(created.status, 201);
    const listed = await listRecruits();
    assert.equal(listed.length, 1);
    assert.equal(listed[0].name, "周周");
    assert.equal(listed[0].gender, "女");
    assert.equal(listed[0].expectedJoin, "2026-12-01");
    assert.equal(listed[0].hometown, "安徽");
    assert.equal(listed[0].inviter, "李四");
    assert.equal(listed[0].detail, "可尽快到岗");
    assert.equal(listed[0].recordDate, "2026-11-16");
    const onboard = await request(server, "/api/hr/onboards", {
      method: "POST",
      body: { name: "周周", gender: "女", department: "运营一组", position: "运营", joinedOn: "2026-11-16", phone: "13800001111" }
    });
    assert.equal(onboard.status, 201);
    assert.equal(onboard.data.onboard.department, "运营一组");
    const badGender = await request(server, "/api/hr/recruits", { method: "POST", body: { name: "甲", gender: "未知" } });
    assert.equal(badGender.status, 400);
    const removed = await request(server, `/api/hr/recruits/${created.data.recruit.id}`, { method: "DELETE" });
    assert.equal(removed.status, 200);
    assert.deepEqual(await listRecruits(), []);
    const talent = await request(server, "/api/hr/talents", {
      method: "POST",
      body: { name: "钱钱", phone: "13900002222", stage: "储备" }
    });
    assert.equal(talent.status, 201);
    const gone = await request(server, `/api/hr/talents/${talent.data.talent.id}`, { method: "DELETE" });
    assert.equal(gone.status, 200);
  } finally {
    await close(server);
  }
});
