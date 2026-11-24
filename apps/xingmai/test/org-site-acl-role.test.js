import assert from "node:assert/strict";
import { test } from "node:test";
import { orgRoleOf } from "../src/modules/people/store.js";
import { listSiteAclPeople, readPersonSiteAcl } from "../src/modules/people/site-acl.js";

test("权限成员岗位以花名册中本人所在的岗位列为准", () => {
  for (const [field, expected] of [
    ["director", "总监"],
    ["lineManager", "经理"],
    ["supervisor", "主管"],
    ["reserve", "储备"],
    ["operator", "运营"],
    ["assistant", "助理"]
  ]) {
    const person = {
      name: "测试成员",
      role: expected === "运营" ? "助理" : "运营",
      director: "上级总监",
      lineManager: "上级经理",
      supervisor: "上级主管",
      reserve: "",
      operator: "",
      assistant: "",
      [field]: "测试成员"
    };
    assert.equal(orgRoleOf(person), expected);
  }
});

test("本人未出现在岗位列时保留登记岗位", () => {
  assert.equal(orgRoleOf({
    name: "测试成员",
    role: "运营",
    lineManager: "上级经理",
    supervisor: "上级主管",
    operator: ""
  }), "运营");
});

test("权限成员目录和详情显示相同岗位", () => {
  const person = listSiteAclPeople("罗成").find(row => row.name === "杨润泽");
  assert.equal(person?.role, "主管");
  const result = readPersonSiteAcl("罗成", person.name);
  assert.equal(result.ok, true);
  assert.equal(result.person.role, person.role);
});
