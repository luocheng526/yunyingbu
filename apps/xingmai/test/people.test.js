import { describe, test, after } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";
import { startMysql } from "../src/notes-store.js";
import { setPoolForTests, setDbMode, resetStoreForTests } from "../src/modules/profile/auth.js";
import { createMemoryPool } from "./helpers/memory-mysql.js";
import { resetPeopleStore } from "../src/modules/people/store.js";

const server = createApp().listen(0);
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

after(() => {
  resetPeopleStore();
  resetStoreForTests();
  server.close();
});

async function loginCookie() {
  resetPeopleStore();
  resetStoreForTests();
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "luocheng", password: "ChangeMe123!" })
  });
  assert.equal(res.status, 200);
  return String(res.headers.get("set-cookie") || "").split(";")[0];
}

async function staffLogin(username, password) {
  return fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
}

describe("组织中心登录绑定", { concurrency: 1 }, () => {
  test("沈子晗花名册种子含人和店，一人多店是多条管辖", async () => {
    const cookie = await loginCookie();
    const headers = { cookie, "Content-Type": "application/json" };
    const roster = await (await fetch(`${base}/api/people`, { headers })).json();
    assert.equal(roster.ok, true);
    assert.equal(roster.demo, false);
    assert.equal(roster.people.every((person) => person.demo === false), true);
    const names = roster.people.map((person) => person.name);
    assert.ok(names.includes("张文静"));
    assert.ok(names.includes("王博"));
    assert.ok(names.includes("杨润泽"));
    assert.ok(names.includes("郭哲宁"));
    assert.ok(names.includes("秦怡硕"));
    const wang = roster.people.find((person) => person.name === "王博");
    assert.equal(wang.visibleShops.includes("飒望居家旗舰店"), true);
    assert.equal(wang.visibleShops.includes("SAWAAG居家布艺旗舰店"), true);
    const shen = roster.people.find((person) => person.name === "沈子晗");
    assert.equal(shen.role, "经理");
    assert.ok(shen.visibleShops.includes("RASW家居旗舰店"));

    const shops = await (await fetch(`${base}/api/people/shops`, { headers })).json();
    assert.equal(shops.shops.filter((shop) => shop.kind === "店铺").length, 15);
    assert.ok(shops.shops.some((shop) => shop.name === "沈子晗包" && shop.kind === "店群"));
    assert.ok(shops.shops.some((shop) => shop.name === "杨润泽包"));

    const grants = await (await fetch(`${base}/api/people/grants`, { headers })).json();
    const wangGrants = grants.grants.filter((grant) => grant.personName === "王博" && grant.active);
    assert.equal(wangGrants.length, 2);
  });

  test("离职当天收权，对账能看出缺口", async () => {
    const cookie = await loginCookie();
    const headers = { cookie, "Content-Type": "application/json" };
    const roster = await (await fetch(`${base}/api/people`, { headers })).json();
    const person = roster.people.find((item) => item.name === "张文静");
    const patched = await fetch(`${base}/api/people/${person.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "离职" })
    });
    assert.equal(patched.status, 200);
    const grants = await (await fetch(`${base}/api/people/grants`, { headers })).json();
    assert.equal(
      grants.grants.filter((grant) => grant.personName === "张文静").every((grant) => grant.active === false),
      true
    );
    const check = await (await fetch(`${base}/api/people/reconcile`, { headers })).json();
    assert.equal(check.employedNoGrant.some((item) => item.name === "韩梦凯"), true);
    assert.equal(check.employedNoGrant.some((item) => item.name === "张文静"), false);
  });

  test("mysql hydrate 补上沈组种子且能继续新增", async () => {
    resetPeopleStore();
    resetStoreForTests();
    setPoolForTests(createMemoryPool());
    await startMysql({ skipCreateDatabase: true });
    const cookieRes = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "罗成", password: "ChangeMe123!" })
    });
    const cookie = String(cookieRes.headers.get("set-cookie") || "").split(";")[0];
    const headers = { cookie, "Content-Type": "application/json" };
    const roster = await (await fetch(`${base}/api/people`, { headers })).json();
    assert.ok(roster.people.some((person) => person.name === "崔安琪"));
    const created = await fetch(`${base}/api/people`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "试点同事", role: "运营", center: "沈子晗运营中心" })
    });
    assert.equal(created.status, 201);
    const shop = await fetch(`${base}/api/people/shops`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "试点店", kind: "店铺", pack: "沈子晗包" })
    });
    assert.equal(shop.status, 201);
    const shopBody = await shop.json();
    const personBody = await created.json();
    const grant = await fetch(`${base}/api/people/grants`, {
      method: "POST",
      headers,
      body: JSON.stringify({ personId: personBody.person.id, shopId: shopBody.shop.id, role: "运营" })
    });
    assert.equal(grant.status, 201);
    await startMysql({ skipCreateDatabase: true });
    const again = await (await fetch(`${base}/api/people`, { headers })).json();
    assert.equal(again.people.some((person) => person.name === "试点同事"), true);
    resetStoreForTests();
    setDbMode("memory");
  });

  test("没打开花名册也能用姓名和初始密码登录", async () => {
    await loginCookie();
    const staff = await staffLogin("王博", "zhenxuan123");
    assert.equal(staff.status, 200);
  });

  test("在职人员用姓名和初始密码登录，离职或删除后不能登录", async () => {
    const adminCookie = await loginCookie();
    const headers = { cookie: adminCookie, "Content-Type": "application/json" };
    const roster = await (await fetch(`${base}/api/people`, { headers })).json();
    const person = roster.people.find((item) => item.name === "张文静");
    assert.equal(person.loginEnabled, true);
    assert.equal(person.loginUsername, "张文静");

    const staff = await staffLogin("张文静", "zhenxuan123");
    assert.equal(staff.status, 200);
    const staffCookie = String(staff.headers.get("set-cookie") || "").split(";")[0];

    const forbidden = await fetch(`${base}/api/people/${person.id}/password`, {
      method: "POST",
      headers: { cookie: staffCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword: "hacked123" })
    });
    assert.equal(forbidden.status, 403);

    const left = await fetch(`${base}/api/people/${person.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "离职" })
    });
    assert.equal(left.status, 200);
    const leftLogin = await staffLogin("张文静", "zhenxuan123");
    assert.equal(leftLogin.status, 401);
    const leftMe = await fetch(`${base}/api/auth/me`, { headers: { cookie: staffCookie } });
    assert.equal(leftMe.status, 401);

    const back = await fetch(`${base}/api/people/${person.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "在职" })
    });
    assert.equal(back.status, 200);
    const rejoin = await staffLogin("张文静", "zhenxuan123");
    assert.equal(rejoin.status, 200);

    const created = await fetch(`${base}/api/people`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "试点登录", role: "运营", center: "沈子晗运营中心" })
    });
    assert.equal(created.status, 201);
    const createdBody = await created.json();
    const fresh = await staffLogin("试点登录", "zhenxuan123");
    assert.equal(fresh.status, 200);

    const reset = await fetch(`${base}/api/people/${createdBody.person.id}/password`, {
      method: "POST",
      headers,
      body: JSON.stringify({ newPassword: "newpass12" })
    });
    assert.equal(reset.status, 200);
    const oldPwd = await staffLogin("试点登录", "zhenxuan123");
    assert.equal(oldPwd.status, 401);
    const newPwd = await staffLogin("试点登录", "newpass12");
    assert.equal(newPwd.status, 200);
    const newCookie = String(newPwd.headers.get("set-cookie") || "").split(";")[0];

    const removed = await fetch(`${base}/api/people/${createdBody.person.id}`, {
      method: "DELETE",
      headers
    });
    assert.equal(removed.status, 200);
    const gone = await staffLogin("试点登录", "newpass12");
    assert.equal(gone.status, 401);
    const goneMe = await fetch(`${base}/api/auth/me`, { headers: { cookie: newCookie } });
    assert.equal(goneMe.status, 401);

    const dup = await fetch(`${base}/api/people`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "张文静", role: "运营", center: "沈子晗运营中心" })
    });
    assert.equal(dup.status, 409);
  });
});
