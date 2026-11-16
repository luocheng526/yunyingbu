import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createApp } from "../src/app.js";
import { addUserForTests, resetStoreForTests } from "../src/modules/profile/auth.js";
import { navMarkup } from "../src/modules/home/nav-items.js";
import { resetPeopleStore } from "../src/modules/people/store.js";
import { resetWorkStore, saveMembers } from "../src/modules/work/store.js";

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
  assert.match(navSrc, /isHrDesk\(\) && leafRoute\(current\) === deskHome\(\) && key !== deskHome\(\)/);
  assert.equal(html.includes("数据中心"), false);
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
    assert.equal(staff.data.user.home, "/data");
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

    const page = await fetch(`${base}/hr`, { headers: { cookie: hr.cookie } });
    assert.equal(page.status, 200);
    const body = await page.text();
    assert.match(body, /\/shared\/modules\/hr\.js/);
    assert.match(body, /智能人事/);
    assert.doesNotMatch(body, />首页</);
    assert.doesNotMatch(body, />数据中心</);
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
