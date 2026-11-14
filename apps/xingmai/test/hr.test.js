import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import test from "node:test";
import { hrRouter } from "../src/modules/hr/router.js";
import {
  HR_SCHEMA,
  createAttendance,
  createInterview,
  createOvertime,
  listAttendance,
  listInterviews,
  listOvertime,
  listTalents,
  listTimeoff,
  resetHrStore
} from "../src/modules/hr/store.js";

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

async function request(server, path, { method = "GET", body, user = true } = {}) {
  const { port } = server.address();
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(user ? { "x-test-user": "luocheng" } : {})
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
    if (req.headers["x-test-user"]) req.user = { username: String(req.headers["x-test-user"]) };
    next();
  });
  app.use("/api/hr", hrRouter);
  return app;
}

test("hr schema stays in hr_ tables", () => {
  assert.equal(HR_SCHEMA.length, 5);
  for (const sql of HR_SCHEMA) {
    assert.match(sql, /CREATE TABLE IF NOT EXISTS hr_/);
    assert.doesNotMatch(sql, /people|han_|shen_/i);
  }
});

test("client mounts one page and five in-page tabs", () => {
  assert.match(client, /XmModules\["\/hr"\]/);
  for (const label of ["面试统计", "考勤", "调休", "人才管理", "加班时长"]) {
    assert.match(client, new RegExp(label));
  }
  assert.equal(client.includes('XmModules["/hr/'), false);
  assert.equal(client.includes("pushState"), false);
  assert.equal(client.includes("location.assign"), false);
  assert.equal(client.includes("location.href"), false);
  assert.match(client, /var\(--xm-/);
  assert.match(client, /data-theme/);
});

test("empty hr lists stay empty", async () => {
  resetHrStore();
  const interviews = await listInterviews({ month: "2026-11" });
  assert.deepEqual(interviews.interviews, []);
  assert.equal(interviews.stats.total, 0);
  assert.equal(interviews.stats.passRate, null);
  assert.deepEqual(interviews.stats.byPosition, []);
  const attendance = await listAttendance({ month: "2026-11" });
  assert.deepEqual(attendance.attendance, []);
  assert.equal(attendance.stats.total, 0);
  const timeoff = await listTimeoff();
  assert.deepEqual(timeoff.timeoff, []);
  assert.equal(timeoff.stats.approvedHours, 0);
  const talents = await listTalents();
  assert.deepEqual(talents.talents, []);
  const overtime = await listOvertime({ month: "2026-11" });
  assert.deepEqual(overtime.overtime, []);
  assert.deepEqual(overtime.stats.byPerson, []);
  assert.equal(overtime.stats.totalHours, 0);
});

test("recorded rows count, and deletes return to empty", async () => {
  resetHrStore();
  await createInterview({
    candidateName: "周宁",
    position: "运营",
    interviewer: "罗成",
    interviewAt: "2026-11-02 10:30",
    result: "通过"
  });
  const listed = await listInterviews({ month: "2026-11" });
  assert.equal(listed.stats.total, 1);
  assert.equal(listed.stats.passed, 1);
  assert.equal(listed.stats.passRate, 1);
  const otherMonth = await listInterviews({ month: "2026-10" });
  assert.equal(otherMonth.stats.total, 0);
  await createAttendance({
    personName: "周宁",
    workDate: "2026-11-03",
    checkIn: "09:00",
    checkOut: "18:00",
    status: "正常"
  });
  await assert.rejects(
    () => createAttendance({ personName: "周宁", workDate: "2026-11-03", status: "迟到" }),
    (err) => err.statusCode === 409
  );
  await createOvertime({ personName: "周宁", workDate: "2026-11-03", hours: 3, reason: "上新" });
  await assert.rejects(
    () => createOvertime({ personName: "周宁", workDate: "2026-11-03", hours: 22 }),
    (err) => err.statusCode === 400
  );
  const overtime = await listOvertime({ month: "2026-11" });
  assert.equal(overtime.stats.totalHours, 3);
  assert.equal(overtime.stats.byPerson[0].personName, "周宁");
});

test("hr api requires login and does not invent rows", async (t) => {
  resetHrStore();
  const server = await listen(appWithUser());
  t.after(() => close(server));
  const anon = await request(server, "/api/hr", { user: false });
  assert.equal(anon.status, 401);
  const meta = await request(server, "/api/hr");
  assert.equal(meta.status, 200);
  assert.deepEqual(meta.data.tabs, ["面试统计", "考勤", "调休", "人才管理", "加班时长"]);
  const empty = await request(server, "/api/hr/interviews?month=2026-11");
  assert.deepEqual(empty.data.interviews, []);
  assert.equal(empty.data.stats.passRate, null);
  const created = await request(server, "/api/hr/talents", {
    method: "POST",
    body: { name: "林可", targetRole: "设计", stage: "储备" }
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.talent.name, "林可");
  const listed = await request(server, "/api/hr/talents");
  assert.equal(listed.data.talents.length, 1);
  const removed = await request(server, `/api/hr/talents/${created.data.talent.id}`, { method: "DELETE" });
  assert.equal(removed.status, 200);
  const again = await request(server, "/api/hr/talents");
  assert.deepEqual(again.data.talents, []);
  assert.equal(again.data.stats.total, 0);
});
