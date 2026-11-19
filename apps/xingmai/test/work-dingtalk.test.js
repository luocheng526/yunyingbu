import assert from "node:assert/strict";
import test from "node:test";
import { resetPeopleStore } from "../src/modules/people/store.js";
import {
  classifyLeave,
  classifySchedule,
  dingPublic,
  inRemindWindow,
  proposeBinds,
  resetDingStore,
  saveAppConfig,
  saveNotifyWebhook,
  sendTaskNotice,
  setDingTransport,
  shanghaiNow,
  shiftWindow
} from "../src/modules/work/dingtalk.js";
import { diaryObligation, resetDiaryStore, runDiaryReminder, saveDiaryRest, saveDiarySettings, saveDingBinds } from "../src/modules/work/diary.js";
import { resetWorkStore, saveMembers } from "../src/modules/work/store.js";

const luocheng = { username: "罗成", displayName: "罗成" };
const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });

test("应用凭证只保存在服务端，返回值里没有密钥", async () => {
  setDingTransport(async (url) => {
    if (String(url).includes("accessToken")) {
      return { json: async () => ({ accessToken: "token", expireIn: 7200 }) };
    }
    return { json: async () => ({ errcode: 33012, errmsg: "无效的USERID" }) };
  });
  try {
    const saved = await saveAppConfig({ agentId: "10001", clientId: "dingabc123", clientSecret: "secret-value-1" });
    assert.equal(saved.ok, true);
    assert.equal(JSON.stringify(saved).includes("secret-value-1"), false);
    assert.equal(dingPublic().agent, true);
    const rejected = await saveAppConfig({ agentId: "1", clientId: "dingabc123", clientSecret: "secret-value-1" });
    assert.equal(rejected.ok, false);
    const masked = await saveAppConfig({ agentId: "10001", clientId: "dingabc123", clientSecret: "pL83****Ks1Y" });
    assert.equal(masked.ok, false);
    setDingTransport(async () => ({ json: async () => ({ code: "invalidClientIdOrSecret" }) }));
    const rejectedSecret = await saveAppConfig({ agentId: "10001", clientId: "dingabc123", clientSecret: "secret-value-1" });
    assert.equal(rejectedSecret.ok, false);
    assert.equal(rejectedSecret.error, "应用凭证没有通过");
  } finally {
    resetDingStore();
    setDingTransport(globalThis.fetch);
  }
});

test("同一个应用只补 AgentId，另一个应用不会覆盖已有密钥", async () => {
  const prevId = process.env.DINGTALK_CLIENT_ID;
  const prevSecret = process.env.DINGTALK_CLIENT_SECRET;
  process.env.DINGTALK_CLIENT_ID = "dingabc123";
  process.env.DINGTALK_CLIENT_SECRET = "secret-value-1";
  setDingTransport(async (url) => {
    if (String(url).includes("accessToken")) {
      return { json: async () => ({ accessToken: "token", expireIn: 7200 }) };
    }
    return { json: async () => ({ errcode: 33012, errmsg: "无效的USERID" }) };
  });
  try {
    const saved = await saveAppConfig({ agentId: "10001", clientId: "dingabc123" });
    assert.equal(saved.ok, true);
    assert.equal(JSON.stringify(saved).includes("secret-value-1"), false);
    const mismatch = await saveAppConfig({ agentId: "10002", clientId: "dingother999" });
    assert.equal(mismatch.ok, false);
    assert.equal(dingPublic().agent, true);
  } finally {
    if (prevId === undefined) {
      delete process.env.DINGTALK_CLIENT_ID;
    } else {
      process.env.DINGTALK_CLIENT_ID = prevId;
    }
    if (prevSecret === undefined) {
      delete process.env.DINGTALK_CLIENT_SECRET;
    } else {
      process.env.DINGTALK_CLIENT_SECRET = prevSecret;
    }
    resetDingStore();
    setDingTransport(globalThis.fetch);
  }
});

test("排班休息和排班上班按当天班次区分", () => {
  assert.equal(classifySchedule([]), "none");
  assert.equal(classifySchedule([{ is_rest: "Y" }, { is_rest: "Y" }]), "rest");
  assert.equal(classifySchedule([{ is_rest: "N", check_type: "OnDuty" }]), "work");
});

test("整天请假免报，半天假只标记仍要交", () => {
  assert.equal(classifyLeave([{ duration_percent: 100 }]), "full");
  assert.equal(classifyLeave([{ duration_percent: 50 }]), "half");
  const shift = shiftWindow([
    { is_rest: "N", plan_check_time: "2026-11-18 09:00:00" },
    { is_rest: "N", plan_check_time: "2026-11-18 18:00:00" }
  ]);
  const start = Date.parse("2026-11-18T09:00:00+08:00");
  const end = Date.parse("2026-11-18T18:00:00+08:00");
  assert.equal(classifyLeave([{ start_time: start, end_time: end }], shift), "full");
  assert.equal(classifyLeave([{ start_time: start, end_time: start + 4 * 3600 * 1000 }], shift), "half");
});

test("工号一致自动绑定，重名只给出待核对", () => {
  const people = [
    { id: 4, name: "张文静", employeeNo: "SZ002" },
    { id: 8, name: "杨润泽", employeeNo: "NO-MATCH" },
    { id: 9, name: "崔安琪", employeeNo: "" },
    { id: 11, name: "高丽男", employeeNo: "" }
  ];
  const users = [
    { userid: "u4", name: "张文静", jobNumber: "SZ002" },
    { userid: "a", name: "杨润泽", jobNumber: "SZ006" },
    { userid: "b", name: "杨润泽", jobNumber: "OTHER" },
    { userid: "c1", name: "崔安琪", jobNumber: "X1" },
    { userid: "c2", name: "崔安琪", jobNumber: "X2" },
    { userid: "g", name: "高丽男", jobNumber: "" }
  ];
  const rows = proposeBinds(people, users);
  assert.equal(rows[0].confirmed, true);
  assert.equal(rows[0].userid, "u4");
  assert.equal(rows[1].confirmed, false);
  assert.equal(rows[1].match, "重名待核对");
  assert.equal(rows[2].confirmed, false);
  assert.equal(rows[2].candidates.length, 2);
  assert.equal(rows[3].confirmed, true);
  assert.equal(rows[3].match, "姓名");
});

test("钉钉免报、半天假和待核对会写进当天应报状态", async () => {
  resetPeopleStore();
  resetWorkStore();
  const person = { id: 4, role: "运营", name: "张文静" };
  const base = {
    person,
    date: today,
    onRoster: true,
    templateFilled: false,
    templateLabels: [],
    bundle: { shops: [], grants: [] },
    reportsByPerson: new Map()
  };
  const rest = await diaryObligation({
    ...base,
    attendance: new Map([[4, { exempt: true, pending: false, half: false, reason: "钉钉排班休息" }]])
  });
  assert.equal(rest.status, "免报");
  assert.equal(rest.note, "钉钉排班休息");
  const half = await diaryObligation({
    ...base,
    attendance: new Map([[4, { exempt: false, pending: false, half: true, reason: "钉钉半天假，当天仍要交" }]])
  });
  assert.equal(half.status, "未报");
  assert.match(half.note, /半天假/);
  const pending = await diaryObligation({
    ...base,
    attendance: new Map([[4, { exempt: false, pending: true, half: false, reason: "没有排班数据" }]])
  });
  assert.equal(pending.status, "待核对");
  await saveDiaryRest(luocheng, { personId: 4, date: today, rest: true }, true);
  const manual = await diaryObligation({
    ...base,
    attendance: new Map([[4, { exempt: false, pending: true, half: false, reason: "钉钉排班接口失败" }]])
  });
  assert.equal(manual.status, "免报");
  assert.equal(manual.note, "已登记休息");
});

test("同一员工同一天的未交提醒只发一次", async () => {
  resetPeopleStore();
  resetWorkStore();
  resetDingStore();
  process.env.DINGTALK_CLIENT_ID = "test-client";
  process.env.DINGTALK_CLIENT_SECRET = "test-secret";
  process.env.DINGTALK_AGENT_ID = "100";
  process.env.DINGTALK_NOTIFY_WEBHOOK = "https://oapi.dingtalk.com/robot/send?access_token=abcdefghij1234567890";
  const calls = [];
  setDingTransport(async (url, options) => {
    calls.push(String(options?.body || ""));
    if (String(url).includes("accessToken")) {
      return { json: async () => ({ accessToken: "token", expireIn: 7200 }) };
    }
    return { json: async () => ({ errcode: 0, result: {} }) };
  });
  try {
    await saveMembers(luocheng, { personId: 4, deptCode: "ops" });
    const remindAt = shanghaiNow().hm;
    assert.equal(inRemindWindow(remindAt, remindAt), true);
    await saveDiarySettings(luocheng, { delivery: { remind: true, remindAt, useSchedule: false, useLeave: false } }, true);
    await saveDingBinds(luocheng, { binds: [{ personId: 4, userid: "u4" }] }, true);
    const first = await runDiaryReminder(new Date());
    const second = await runDiaryReminder(new Date());
    assert.equal(first.sent, 1);
    assert.equal(second.sent, 0);
    const notices = calls.filter((body) => body.includes("去填日报"));
    assert.equal(notices.length, 1);
    assert.match(notices[0], /@张文静/);
    assert.doesNotMatch(notices[0], /@u4/);
    assert.match(notices[0], /zx\.xingmaierp\.cc\/work/);
  } finally {
    delete process.env.DINGTALK_CLIENT_ID;
    delete process.env.DINGTALK_CLIENT_SECRET;
    delete process.env.DINGTALK_AGENT_ID;
    delete process.env.DINGTALK_NOTIFY_WEBHOOK;
    setDingTransport(globalThis.fetch);
    resetDingStore();
    resetWorkStore();
  }
});

test("通知群地址只收钉钉域名，保存后 @ 走这条地址", async () => {
  resetDingStore();
  delete process.env.DINGTALK_NOTIFY_WEBHOOK;
  const bad = await saveNotifyWebhook("https://example.com/robot/send?access_token=abcdefghij1234567890");
  assert.equal(bad.ok, false);
  const saved = await saveNotifyWebhook("https://oapi.dingtalk.com/robot/send?access_token=abcdefghij1234567890");
  assert.equal(saved.ok, true);
  delete process.env.DINGTALK_NOTIFY_WEBHOOK;
  const called = [];
  setDingTransport(async (url, options) => {
    called.push(String(url));
    const body = JSON.parse(options.body);
    assert.deepEqual(body.at.atUserIds, ["u4"]);
    assert.equal(body.at.isAtAll, false);
    return { json: async () => ({ errcode: 0, errmsg: "ok" }) };
  });
  try {
    const channel = await sendTaskNotice("u4", "新的工作任务", "保存后的通知群。", "https://zx.xingmaierp.cc/work?tab=todo");
    assert.equal(channel, "at");
    assert.equal(called.length, 1);
    assert.match(called[0], /^https:\/\/oapi\.dingtalk\.com\/robot\/send\?/);
  } finally {
    delete process.env.DINGTALK_NOTIFY_WEBHOOK;
    setDingTransport(globalThis.fetch);
    resetDingStore();
  }
});

test("群里 @ 对应的人成功时只发这一条，没有通知群时退回单聊再退回工作通知", async () => {
  resetDingStore();
  process.env.DINGTALK_CLIENT_ID = "dingabc123";
  process.env.DINGTALK_CLIENT_SECRET = "secret-value-1";
  process.env.DINGTALK_AGENT_ID = "100";
  delete process.env.DINGTALK_NOTIFY_WEBHOOK;
  const urls = [];
  setDingTransport(async (url) => {
    urls.push(String(url));
    if (String(url).includes("accessToken")) {
      return { json: async () => ({ accessToken: "token", expireIn: 7200 }) };
    }
    if (String(url).includes("oToMessages")) {
      return { json: async () => ({ code: "invalid.chatbot", message: "无效的机器人" }) };
    }
    return { json: async () => ({ errcode: 0, result: {} }) };
  });
  try {
    const channel = await sendTaskNotice("u4", "新的工作任务", "我的任务「1」，截止 2026-11-17 23:59。", "https://zx.xingmaierp.cc/work?tab=taskMine&task=abc");
    assert.equal(channel, "work");
    assert.equal(urls.some((url) => url.includes("robot/ding/send")), false);
    assert.equal(urls.some((url) => url.includes("oToMessages")), true);
    assert.equal(urls.some((url) => url.includes("asyncsend_v2")), true);
    process.env.DINGTALK_NOTIFY_WEBHOOK = "https://oapi.dingtalk.com/robot/send?access_token=test-token";
    const mentioned = [];
    setDingTransport(async (url, options) => {
      mentioned.push(String(url));
      const body = JSON.parse(options.body);
      assert.equal(body.msgtype, "text");
      assert.deepEqual(body.at.atUserIds, ["u4"]);
      assert.equal(body.at.isAtAll, false);
      assert.match(body.text.content, /@张文静/);
      assert.doesNotMatch(body.text.content, /@u4/);
      assert.match(body.text.content, /工作汇报/);
      assert.match(body.text.content, /tab=taskReview/);
      return { json: async () => ({ errcode: 0, errmsg: "ok" }) };
    });
    const popped = await sendTaskNotice("u4", "新的工作任务", "第二条单独弹窗。", "https://zx.xingmaierp.cc/work?tab=taskReview&task=abc", "去处理", "张文静");
    assert.equal(popped, "at");
    assert.equal(mentioned.length, 1);
    assert.match(mentioned[0], /^https:\/\/oapi\.dingtalk\.com\/robot\/send/);
  } finally {
    delete process.env.DINGTALK_CLIENT_ID;
    delete process.env.DINGTALK_CLIENT_SECRET;
    delete process.env.DINGTALK_AGENT_ID;
    delete process.env.DINGTALK_NOTIFY_WEBHOOK;
    setDingTransport(globalThis.fetch);
    resetDingStore();
  }
});
