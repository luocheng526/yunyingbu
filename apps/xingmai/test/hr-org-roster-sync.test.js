import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import express from "express";
import { hrRouter } from "../src/modules/hr/router.js";
import { createStaff, resetHrStore } from "../src/modules/hr/store.js";
import { peopleRouter } from "../src/modules/people/router.js";
import { resetSiteAcl } from "../src/modules/people/site-acl.js";
import { resetPeopleStore } from "../src/modules/people/store.js";

test.beforeEach(() => {
  resetPeopleStore();
  resetSiteAcl();
  resetHrStore();
});

async function openApi(t) {
  const app = express();
  app.use(express.json(), (req, _res, next) => {
    req.user = req.get("x-test-hr")
      ? { username: "人事测试", department: "人事部" }
      : { username: "罗成" };
    next();
  });
  app.use("/api/people", peopleRouter);
  app.use("/api/hr", hrRouter);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return async (path, { method = "GET", body, hrOnly = false, status = 200 } = {}) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...(hrOnly ? { "x-test-hr": "1" } : {}) },
      body: body && JSON.stringify(body)
    });
    const result = await response.json();
    assert.equal(response.status, status, result.error || path);
    return result;
  };
}

test("组织中心新增、调岗、调组、离职和删除后，智能人事读取相同人员", async (t) => {
  const api = await openApi(t);
  const legacy = await createStaff({ name: "同步测试", phone: "13800000000", salary: "保留档案" });
  const { person } = await api("/people", {
    method: "POST", status: 201,
    body: { name: legacy.name, role: "运营", lineManager: "韩梦凯", supervisor: "甲组长" }
  });
  const { staff: [linked] } = await api("/hr/staff?status=在职");
  assert.equal(linked.id, legacy.id);
  assert.equal(linked.orgPersonId, person.id);
  assert.equal(linked.group, "甲组长");
  await api(`/people/${person.id}`, {
    method: "PATCH", body: { name: "改名测试", status: "离职", role: "助理", supervisor: "乙组长" }
  });
  const { staff: [departed] } = await api("/hr/staff?status=离职");
  assert.deepEqual(
    [departed.id, departed.name, departed.position, departed.group, departed.phone, departed.salary],
    [legacy.id, "改名测试", "助理", "乙组长", "13800000000", "保留档案"]
  );
  assert.equal(Object.hasOwn(departed, "password"), false);
  await api("/people/remove", { method: "POST", body: { ids: [person.id] } });
  assert.deepEqual((await api("/hr/staff")).staff, []);
});

test("智能人事新增、分组、离职导入和删除使用组织中心名册", async (t) => {
  const api = await openApi(t);
  const { staff } = await api("/hr/staff", {
    method: "POST", status: 201,
    body: { name: "人事新增", position: "运营", department: "韩梦凯运营中心", group: "甲组长", note: "内部备注" }
  });
  const getMember = async () => (await api("/people")).people.find((person) => person.id === staff.orgPersonId);
  const member = await getMember();
  assert.equal(member.supervisor, "甲组长");
  assert.equal(Object.hasOwn(member, "note"), false);
  assert.notEqual(member.password, "ChangeMe123!");
  await api(`/hr/staff/${staff.id}`, {
    method: "PUT", body: { status: "试用期", group: "乙组长", position: "助理" }
  });
  const changed = await getMember();
  assert.deepEqual([changed.status, changed.supervisor, changed.role], ["在职", "乙组长", "助理"]);
  const imported = await api("/hr/staff/import", {
    method: "POST", body: { departures: true, rows: [{ name: staff.name, leftOn: "2026-11-25" }] }
  });
  assert.deepEqual([imported.added, imported.updated], [0, 1]);
  assert.equal((await getMember()).status, "离职");
  assert.equal((await api("/hr/staff?status=离职")).staff[0].leftOn, "2026-11-25");
  await api(`/hr/staff/${staff.id}`, { method: "DELETE" });
  assert.equal(await getMember(), undefined);
  assert.deepEqual((await api("/hr/staff")).staff, []);
});

test("人事查看权限可维护专属档案，共用字段沿用成员编辑权限", async (t) => {
  const api = await openApi(t);
  await api("/people", { method: "POST", body: { name: "权限测试", status: "在职" }, status: 201 });
  const { staff: [employee] } = await api("/hr/staff", { hrOnly: true });
  await api(`/hr/staff/${employee.id}`, { method: "PUT", body: { note: "人事记录" }, hrOnly: true });
  await api(`/hr/staff/${employee.id}`, {
    method: "PUT", body: { status: "离职", note: "拒绝时不保存" }, hrOnly: true, status: 403
  });
  const { staff: [saved] } = await api("/hr/staff", { hrOnly: true });
  assert.deepEqual([saved.status, saved.note], ["在职", "人事记录"]);
});

test("找不到组织成员的旧档案可核对后纳入，部门中原有分组格式仍可识别", async (t) => {
  const api = await openApi(t);
  const legacy = await createStaff({ name: "旧档案", department: "运营二组（甲组长）", note: "原档案" });
  assert.equal((await api("/hr/staff")).staff[0].needsOrganization, true);
  const { staff } = await api(`/hr/staff/${legacy.id}`, {
    method: "PUT", body: { syncOrganization: true, position: "助理" }
  });
  assert.deepEqual([staff.id, staff.needsOrganization, staff.group, staff.position, staff.note],
    [legacy.id, false, "甲组长", "助理", "原档案"]);
});

test("招聘转入职时两边创建同一人员，重试保留原记录", async (t) => {
  const api = await openApi(t);
  const { recruit } = await api("/hr/recruits", {
    method: "POST", status: 201, body: { name: "招聘测试", position: "运营", recordDate: "2026-11-27" }
  });
  const path = `/hr/recruits/${recruit.id}/join`;
  const { staff } = await api(path, { method: "POST", body: {} });
  assert.equal((await api(path, { method: "POST", body: {} })).already, true);
  const { people } = await api("/people");
  assert.equal(people.filter((person) => person.name === recruit.name).length, 1);
  assert.equal(people.find((person) => person.id === staff.orgPersonId).status, "在职");
  assert.equal((await api("/hr/staff")).staff[0].id, staff.id);
});
