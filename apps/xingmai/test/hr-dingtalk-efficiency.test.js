import test from "node:test";
import assert from "node:assert/strict";
import { createDingClient } from "../src/modules/hr/dingtalk.js";
import { startDingStream } from "../src/modules/hr/stream.js";
import { pullLeaves } from "../src/modules/hr/sync.js";
import { listLeaves, listQuotas, replaceLeavesInRange, replaceQuotas, resetHrStore, saveDingUsers } from "../src/modules/hr/store.js";

test("定向审批同步只拉相关员工，保留其他员工请假和已存调休余额", async () => {
  resetHrStore();
  const day = "2026-11-27";
  const startAt = day + " 09:00";
  const endAt = day + " 18:00";
  await saveDingUsers([{ userId: "first" }, { userId: "second" }]);
  await replaceLeavesInRange(["first", "second"], startAt, endAt, [
    { dingtalkUserId: "first", startAt, endAt, recordKey: "old-first" },
    { dingtalkUserId: "second", startAt, endAt, recordKey: "other-employee" }
  ]);
  await replaceQuotas([{ personId: 2, leaveCode: "comp", leaveName: "调休", balanceHours: 12 }]);
  const calls = [];
  const client = {
    configured: () => true,
    async listLeaveStatus(userIds) {
      calls.push(["leave", userIds]);
      return userIds.includes("first") ? [{
        userid: "first", leave_code: "comp",
        start_time: Date.parse(day + "T09:00+08:00"), end_time: Date.parse(day + "T18:00+08:00")
      }] : [];
    },
    async listVacationTypes(userId) {
      calls.push(["types", userId]);
      return [{ leave_code: "comp", leave_name: "调休" }];
    },
    async listVacationQuota(_operator, _code, userIds) {
      calls.push(["quota", userIds]);
      return [];
    }
  };

  await pullLeaves(day, day, client, { userIds: ["first", "unknown"] });
  assert.deepEqual(calls, [["leave", ["first"]], ["types", "first"]]);
  const leaves = await listLeaves();
  assert.equal(leaves.find((row) => row.dingtalkUserId === "first").leaveName, "调休");
  assert.equal(leaves.find((row) => row.dingtalkUserId === "second").recordKey, "other-employee");
  assert.equal((await listQuotas())[0].balanceHours, 12);
  await pullLeaves(day, day, client, { userIds: ["unknown"] });
  await pullLeaves(day, day, client);
  assert.deepEqual(calls.slice(2), [["leave", ["first", "second"]], ["quota", ["first", "second"]]]);
});

test("暂停时考勤请求和 Stream 连接均不会访问钉钉", async (t) => {
  const old = process.env.DINGTALK_CALLS;
  process.env.DINGTALK_CALLS = "off";
  t.after(() => {
    if (old === undefined) delete process.env.DINGTALK_CALLS;
    else process.env.DINGTALK_CALLS = old;
  });
  const fetchImpl = () => assert.fail("暂停期间发生外部请求");
  const client = createDingClient({
    env: { DINGTALK_CALLS: "off", DINGTALK_CORP_ID: "test", DINGTALK_CLIENT_ID: "test", DINGTALK_CLIENT_SECRET: "test" },
    fetchImpl
  });
  assert.equal(client.configured(), true);
  assert.deepEqual(startDingStream({ client, fetchImpl }), { started: false });
  await assert.rejects(client.listLeaveStatus(["first"], 1, 2), { paused: true });
});
