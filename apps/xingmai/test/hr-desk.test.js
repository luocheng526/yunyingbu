import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createApp } from "../src/app.js";
import { addUserForTests, resetStoreForTests } from "../src/modules/profile/auth.js";
import { hrDeskFromOrg as navHrDesk, navMarkup } from "../src/modules/home/nav-items.js";
import { createPerson, resetPeopleStore } from "../src/modules/people/store.js";
import { hrDeskFromOrg, resetWorkStore, saveMembers } from "../src/modules/work/store.js";

const luocheng = { username: "罗成", displayName: "罗成" };

async function login(base, username, password = "ChangeMe123!") {
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  return { status: res.status, data, cookie: String(res.headers.get("set-cookie") || "").split(";")[0] };
}

test("人事部账号登录只进智能人事，侧栏只留智能人事和个人中心", async () => {
  resetStoreForTests();
  resetPeopleStore();
  resetWorkStore();
  addUserForTests({ username: "张文静", displayName: "张文静", password: "ChangeMe123!" });
  await saveMembers(luocheng, { personId: 4, deptCode: "hr" });

  const html = navMarkup("/hr", { username: "张文静", displayName: "张文静", desk: "hr" });
  const labels = [...html.matchAll(/<span>([^<]+)<\/span>/g)].map((item) => item[1]);
  assert.deepEqual(
    labels.filter((item) => item !== "退出登录"),
    ["智能人事", "个人中心"]
  );
  assert.equal(html.includes('href="/home"'), false);
  assert.equal(html.includes('href="/hr"'), true);
  const navSrc = fs.readFileSync(new URL("../public/shared/nav.js", import.meta.url), "utf8");
  assert.match(navSrc, /leafRoute\(current\) === deskHome\(\) && key !== deskHome\(\)/);
  assert.equal(html.includes("数据中心"), false);
  assert.equal(html.includes("星脉数据中心"), false);
  assert.equal(html.includes("边界数据中心"), false);
  assert.equal(html.includes("工作汇报"), false);
  assert.equal(html.includes("需求与反馈"), false);
  assert.equal(html.includes("月度大会"), false);
  assert.equal(html.includes("组织中心"), false);

  const app = createApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  try {
    const staff = await login(base, "罗成");
    assert.equal(staff.data.user.home, "/home");
    assert.equal(staff.data.user.desk, "");
    const staffData = await fetch(`${base}/data`, { headers: { cookie: staff.cookie }, redirect: "manual" });
    assert.equal(staffData.status, 302);
    assert.equal(staffData.headers.get("location"), "/data/overview");

    const hr = await login(base, "张文静");
    assert.equal(hr.status, 200);
    assert.equal(hr.data.user.desk, "hr");
    assert.equal(hr.data.user.home, "/hr");
    const me = await fetch(`${base}/api/auth/me`, { headers: { cookie: hr.cookie } });
    const meBody = await me.json();
    assert.equal(me.status, 200);
    assert.equal(meBody.desk, "hr");
    assert.equal(meBody.home, "/hr");

    const bounced = await fetch(`${base}/data`, { headers: { cookie: hr.cookie }, redirect: "manual" });
    assert.equal(bounced.status, 302);
    assert.equal(bounced.headers.get("location"), "/hr");

    const home = await fetch(`${base}/home`, { headers: { cookie: hr.cookie }, redirect: "manual" });
    assert.equal(home.status, 302);
    assert.equal(home.headers.get("location"), "/hr");

    const work = await fetch(`${base}/work`, { headers: { cookie: hr.cookie }, redirect: "manual" });
    assert.equal(work.status, 302);
    assert.equal(work.headers.get("location"), "/hr");

    const feedback = await fetch(`${base}/feedback`, { headers: { cookie: hr.cookie }, redirect: "manual" });
    assert.equal(feedback.status, 302);
    assert.equal(feedback.headers.get("location"), "/hr");

    const meeting = await fetch(`${base}/meeting`, { headers: { cookie: hr.cookie }, redirect: "manual" });
    assert.equal(meeting.status, 302);
    assert.equal(meeting.headers.get("location"), "/hr");

    const bound = await fetch(`${base}/bound`, { headers: { cookie: hr.cookie }, redirect: "manual" });
    assert.equal(bound.status, 302);
    assert.equal(bound.headers.get("location"), "/hr");

    const page = await fetch(`${base}/hr`, { headers: { cookie: hr.cookie } });
    assert.equal(page.status, 200);
    const body = await page.text();
    assert.match(body, /\/shared\/modules\/hr\.js/);
    assert.match(body, /智能人事/);
    assert.doesNotMatch(body, />首页</);
    assert.doesNotMatch(body, />数据中心</);
    assert.doesNotMatch(body, />星脉数据中心</);
    assert.doesNotMatch(body, />边界数据中心</);
    assert.doesNotMatch(body, />工作汇报</);
    assert.doesNotMatch(body, />需求与反馈</);
    assert.doesNotMatch(body, />月度大会</);
    assert.match(body, />个人中心</);
    assert.match(body, /"desk":"hr"/);

    const loginBounce = await fetch(`${base}/login`, { headers: { cookie: hr.cookie }, redirect: "manual" });
    assert.equal(loginBounce.status, 302);
    assert.equal(loginBounce.headers.get("location"), "/hr");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("账号部门写人事部也会进智能人事台", async () => {
  resetStoreForTests();
  resetPeopleStore();
  resetWorkStore();
  addUserForTests({
    username: "人事专员甲",
    displayName: "人事专员甲",
    password: "ChangeMe123!",
    department: "人事部"
  });
  const app = createApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address();
  try {
    const hr = await login(`http://127.0.0.1:${port}`, "人事专员甲");
    assert.equal(hr.data.user.desk, "hr");
    assert.equal(hr.data.user.home, "/hr");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("罗成全菜单不受人事台影响", () => {
  const html = navMarkup("/home", luocheng);
  assert.match(html, />首页</);
  assert.match(html, />智能人事</);
  assert.match(html, />工作汇报</);
  assert.match(html, />个人中心</);
});

test("组织中心人事和技术部门 board 的人进人事台，下属也进", () => {
  const people = [
    { id: 3, name: "罗成", username: "罗成", board: "ops", department: "人员管理", managerId: null },
    {
      id: 62,
      name: "张璇",
      username: "张璇",
      board: "hrTech",
      department: "其他",
      center: "其他",
      role: "主管",
      managerId: 3
    },
    {
      id: 80,
      name: "人事新人",
      username: "人事新人",
      board: "ops",
      department: "其他",
      center: "其他",
      role: "助理",
      managerId: 62
    },
    {
      id: 4,
      name: "张文静",
      username: "张文静",
      board: "ops",
      department: "沈子晗运营中心",
      center: "沈子晗运营中心",
      role: "运营",
      managerId: 1
    },
    {
      id: 90,
      name: "郝晨淼",
      username: "郝晨淼",
      board: "backend",
      department: "其他",
      center: "其他",
      role: "主管",
      managerId: 3
    }
  ];
  assert.equal(hrDeskFromOrg({ username: "张璇", displayName: "张璇" }, people), "hr");
  assert.equal(hrDeskFromOrg({ username: "人事新人" }, people), "hr");
  assert.equal(hrDeskFromOrg({ username: "张文静" }, people), "");
  assert.equal(hrDeskFromOrg({ username: "郝晨淼" }, people), "");
  assert.equal(hrDeskFromOrg({ username: "罗成" }, people), "");
  assert.equal(hrDeskFromOrg({ username: "韩梦凯" }, people), "");
  assert.equal(hrDeskFromOrg({ username: "沈子晗" }, people), "");
});

test("组织中心花名册写人事部门的账号登录只进智能人事", async () => {
  resetStoreForTests();
  resetPeopleStore();
  resetWorkStore();
  const made = await createPerson({
    name: "李栖彤",
    role: "主管",
    center: "其他",
    department: "人事部门"
  });
  assert.equal(made.ok, true);
  addUserForTests({ username: "李栖彤", displayName: "李栖彤", password: "ChangeMe123!" });

  const app = createApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  try {
    const hr = await login(base, "李栖彤");
    assert.equal(hr.status, 200);
    assert.equal(hr.data.user.desk, "hr");
    assert.equal(hr.data.user.home, "/hr");

    const bounced = await fetch(`${base}/data/overview`, { headers: { cookie: hr.cookie }, redirect: "manual" });
    assert.equal(bounced.status, 302);
    assert.equal(bounced.headers.get("location"), "/hr");

    const page = await fetch(`${base}/hr`, { headers: { cookie: hr.cookie } });
    const body = await page.text();
    assert.equal(page.status, 200);
    assert.match(body, />智能人事</);
    assert.match(body, />个人中心</);
    assert.doesNotMatch(body, />首页</);
    assert.doesNotMatch(body, />星脉数据中心</);
    assert.doesNotMatch(body, />边界数据中心</);
    assert.doesNotMatch(body, />工作汇报</);
    assert.doesNotMatch(body, />组织中心</);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("沈子晗中心运营账号不进人事台", async () => {
  resetStoreForTests();
  resetPeopleStore();
  resetWorkStore();
  addUserForTests({ username: "张文静", displayName: "张文静", password: "ChangeMe123!" });

  const app = createApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address();
  try {
    const ops = await login(`http://127.0.0.1:${port}`, "张文静");
    assert.equal(ops.status, 200);
    assert.equal(ops.data.user.desk, "");
    assert.equal(ops.data.user.home, "/home");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("人事和技术看板的张璇只进智能人事台", () => {
  const people = [
    { id: 62, name: "张璇", username: "张璇", board: "hrTech", department: "其他", center: "其他", role: "主管" }
  ];
  assert.equal(hrDeskFromOrg({ username: "张璇", displayName: "张璇" }, people), "hr");
  assert.equal(navHrDesk({ username: "张璇", displayName: "张璇" }, people), "hr");
  const html = navMarkup("/hr", { username: "张璇", displayName: "张璇", board: "hrTech", desk: "hr" });
  assert.equal(html.includes('href="/home"'), false);
  assert.equal(html.includes('href="/hr"'), true);
  assert.match(html, />智能人事</);
  assert.match(html, />个人中心</);
});

test("组织中心改成人事后，已登录账号马上收掉首页", async () => {
  resetStoreForTests();
  resetPeopleStore();
  resetWorkStore();
  addUserForTests({ username: "张璇", displayName: "张璇", password: "ChangeMe123!" });

  const app = createApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  try {
    const session = await login(base, "张璇");
    assert.equal(session.status, 200);
    assert.equal(session.data.user.desk, "");

    const made = await createPerson({
      name: "张璇",
      role: "主管",
      center: "其他",
      department: "人事部门"
    });
    assert.equal(made.ok, true);

    const me = await fetch(`${base}/api/auth/me`, { headers: { cookie: session.cookie } });
    const meBody = await me.json();
    assert.equal(me.status, 200);
    assert.equal(meBody.desk, "hr");
    assert.equal(meBody.home, "/hr");

    const bounced = await fetch(`${base}/home`, { headers: { cookie: session.cookie }, redirect: "manual" });
    assert.equal(bounced.status, 302);
    assert.equal(bounced.headers.get("location"), "/hr");

    const page = await fetch(`${base}/me`, { headers: { cookie: session.cookie } });
    const html = await page.text();
    assert.equal(page.status, 200);
    assert.match(html, /"desk":"hr"/);
    assert.match(html, />智能人事</);
    assert.match(html, />个人中心</);
    assert.doesNotMatch(html, />首页</);
    assert.doesNotMatch(html, />星脉数据中心</);
    assert.doesNotMatch(html, />工作汇报</);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("壳层会按组织中心权限重画侧栏，不用重新登录", () => {
  const navSrc = fs.readFileSync(new URL("../public/shared/nav.js", import.meta.url), "utf8");
  const authSrc = fs.readFileSync(new URL("../src/modules/profile/auth.js", import.meta.url), "utf8");
  assert.match(navSrc, /function applyScopeUser\(/);
  assert.match(navSrc, /function readScopeMe\(/);
  assert.match(navSrc, /function watchScope\(/);
  assert.match(navSrc, /setInterval\(function \(\) \{/);
  assert.match(navSrc, /2500/);
  assert.match(navSrc, /personLooksHr\(merged\)/);
  assert.match(navSrc, /function paintSider\(/);
  assert.match(authSrc, /export async function resolveDesk\(/);
  assert.match(authSrc, /authRouter\.get\("\/me", async/);
});
