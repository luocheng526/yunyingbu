import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Buffer } from "node:buffer";
import { createHmac } from "node:crypto";
import express from "express";
import { createDingService, validateDingWebhook, dingUserIds } from "../src/modules/home/week-ding.js";
import { registerWeekManagement } from "../src/modules/home/week-management.js";
import { listWeekHistory, reportRevision, readWeekHistory } from "../src/modules/home/week-history.js";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==", "base64");
const hook = "https://oapi.dingtalk.com/robot/send?access_token=HOOKSECRET";
const notice = { source: "manual", name: "测试应用", clientId: "testClient", clientSecret: "PRIVATESECRET", agentId: "123456", userIds: "employee2,employee1,employee2", makeDefault: true };
const existing = { clientId: "existingClient", clientSecret: "EXISTINGSECRET", agentId: "6789" };
const response = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
async function isolated(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "week-ding-")); process.env.HOME_WEEK_DATA_DIR = dir;
  try { await fn(dir); } finally { delete process.env.HOME_WEEK_DATA_DIR; fs.rmSync(dir, { recursive: true, force: true }); }
}
async function setup(service) {
  await service.save("group", { name: "业绩群", webhook: hook, secret: "SECtestsign", keyword: "业绩" });
  await service.save("notice", notice);
  await service.save("bot", { source: "notice", userIds: "employee3", robotCode: "robot123" });
}
const target = async (service, channel) => service.target(channel, (await service.publicConfig()).revision);

test("three configurations persist encrypted, preserve blank secrets and reuse existing app without leaking credentials", () => isolated(async dir => {
  let calls = 0;
  const options = { loadExisting: async () => existing, legacyWebhook: () => "", fetcher: async () => { calls++; return response({ accessToken: "NEVER-EXPOSE-THIS" }); } };
  const service = createDingService(options);
  await setup(service);
  const publicData = await service.publicConfig();
  assert.ok(publicData.group.ready && publicData.notice.ready && publicData.bot.ready);
  assert.equal(publicData.defaultChannel, "notice");
  assert.deepEqual(publicData.notice.userIds, ["employee2", "employee1"]);
  assert.deepEqual(publicData.bot.userIds, ["employee3"]);
  assert.equal(calls, 0);
  const serialized = JSON.stringify(publicData) + fs.readFileSync(path.join(dir, "ding-config.json"), "utf8");
  for (const secret of ["HOOKSECRET", "PRIVATESECRET", "EXISTINGSECRET", "SECtestsign"]) assert.ok(!serialized.includes(secret));
  assert.equal(fs.readFileSync(path.join(dir, "ding-config.key")).length, 32);
  const reloaded = createDingService(options);
  await reloaded.save("notice", { ...notice, clientSecret: "" });
  assert.equal((await target(reloaded, "notice")).config.clientSecret, notice.clientSecret);
  await assert.rejects(reloaded.save("notice", { ...notice, clientId: "different", clientSecret: "" }), /同时填写/);
  await assert.rejects(reloaded.save("__proto__", {}), /发送方式/);
  await assert.rejects(reloaded.target("bot", "outdated"), /配置已变化/);
  await reloaded.save("notice", { source: "existing", agentId: "", userIds: "employee4" });
  assert.equal((await target(reloaded, "notice")).config.agentId, "6789");
  assert.equal((await target(reloaded, "bot")).config.clientId, "existingClient");
  assert.ok((await reloaded.check("notice")).ok); assert.equal(calls, 1);
  await reloaded.check("group"); assert.equal(calls, 1);
  assert.throws(() => validateDingWebhook("https://oapi.dingtalk.com.evil/robot/send?access_token=x"));
  assert.throws(() => validateDingWebhook("https://user@oapi.dingtalk.com/robot/send?access_token=x"));
  assert.throws(() => dingUserIds(Array.from({ length: 21 }, (_, n) => `u${n}`)));
  const encrypted = JSON.parse(fs.readFileSync(path.join(dir, "ding-config.json"), "utf8")); encrypted.tag = Buffer.alloc(16).toString("base64");
  fs.writeFileSync(path.join(dir, "ding-config.json"), JSON.stringify(encrypted));
  await assert.rejects(reloaded.publicConfig(), /加密密钥备份/);
}));

test("group uses signed markdown; notice and bot upload original PNG and target only their own users", () => isolated(async () => {
  const calls = [];
  const service = createDingService({ loadExisting: async () => ({}), legacyWebhook: () => "", fetcher: async (url, options) => {
    calls.push({ url: new URL(url), options });
    if (url.includes("oauth2")) return response({ accessToken: "access123" });
    if (url.includes("media/upload")) {
      assert.equal(options.body.get("media").type, "image/png");
      assert.deepEqual(Buffer.from(await options.body.get("media").arrayBuffer()), png);
      return response({ errcode: 0, media_id: "@media123" });
    }
    if (url.includes("asyncsend_v2")) return response({ errcode: 0, task_id: 123 });
    if (url.includes("batchSend")) return response({ processQueryKey: "receipt123" });
    return response({ errcode: 0 });
  } });
  await setup(service);
  const send = async channel => service.send({ target: await target(service, channel), image: png, title: "日报", text: "每日业绩", picUrl: "https://report.example/a.png" });
  assert.equal((await send("group")).status, "sent");
  const group = calls.at(-1), stamp = group.url.searchParams.get("timestamp");
  assert.equal(group.url.searchParams.get("sign"), createHmac("sha256", "SECtestsign").update(`${stamp}\nSECtestsign`).digest("base64"));
  assert.ok(JSON.parse(group.options.body).markdown.text.includes("业绩 · 日报"));
  assert.equal((await send("notice")).status, "accepted");
  const work = JSON.parse(calls.at(-1).options.body);
  assert.deepEqual(work, { agent_id: 123456, userid_list: "employee2,employee1", to_all_user: false, msg: { msgtype: "image", image: { media_id: "@media123" } } });
  assert.equal((await send("bot")).status, "accepted");
  const bot = JSON.parse(calls.at(-1).options.body);
  assert.deepEqual(bot.userIds, ["employee3"]); assert.equal(bot.robotCode, "robot123");
  assert.equal(bot.msgKey, "sampleImageMsg"); assert.deepEqual(JSON.parse(bot.msgParam), { photoURL: "@media123" });
  assert.equal(calls.at(-1).options.headers["x-acs-dingtalk-access-token"], "access123");
  assert.equal(calls.length, 7);
}));

test("dispatch does not fall back to other channels and distinguishes pre-send failure, uncertain result and partial acceptance", () => isolated(async () => {
  let mode = "authFail", sends = 0;
  const service = createDingService({ loadExisting: async () => ({}), legacyWebhook: () => "", fetcher: async url => {
    if (url.includes("oauth2")) return mode === "authFail" ? response({ code: "InvalidApp", message: "sensitive-details" }, 400) : response({ accessToken: "token" });
    if (url.includes("media/upload")) return mode === "uploadFail" ? response({ errcode: 40005 }) : response({ errcode: 0, media_id: "@image" });
    sends++;
    if (mode === "timeout") throw new Error("https://secret-token");
    if (mode === "server") return response({ code: "InternalError" }, 500);
    if (mode === "reject") return response({ errcode: 40002 });
    if (mode === "partial") return response({ processQueryKey: "receipt", invalidStaffIdList: ["employee3"] });
    return response({});
  } });
  await setup(service); const t = await target(service, "bot");
  const send = () => service.send({ target: t, image: png });
  const failed = await send(); assert.equal(failed.definiteFailure, true); assert.ok(!JSON.stringify(failed).includes("sensitive-details"));
  mode = "uploadFail"; assert.equal((await send()).definiteFailure, true); assert.equal(sends, 0);
  mode = "timeout"; assert.equal((await send()).definiteFailure, false);
  mode = "server"; assert.equal((await send()).definiteFailure, false);
  mode = "reject"; assert.equal((await send()).definiteFailure, true);
  mode = "empty"; assert.equal((await send()).ok, false);
  mode = "partial"; const partial = await send(); assert.equal(partial.status, "partial"); assert.deepEqual(partial.rejected, ["employee3"]);
  assert.equal(sends, 5);
}));

test("HTTP config is admin-only; sends archive separately by destination, gate stale settings and deduplicate accepted submissions", () => isolated(async () => {
  let sends = 0;
  const service = createDingService({ loadExisting: async () => ({}), legacyWebhook: () => "", fetcher: async url => {
    if (url.includes("oauth2")) return response({ accessToken: "secret" });
    if (url.includes("media/upload")) return response({ errcode: 0, media_id: "@image" });
    sends++;
    return response(url.includes("asyncsend_v2") ? { errcode: 0, task_id: 42 } : url.includes("batchSend") ? { processQueryKey: "r42" } : { errcode: 0 });
  } });
  const pack = { title: "test", ymd: "2026-11-23", columns: [{ key: "shop", label: "店铺" }], teams: [{ key: "han", label: "韩梦凯", rows: [], foot: [] }] };
  const app = express(), router = express.Router(); app.use(express.json());
  registerWeekManagement(router, { ding: service, getUser: req => req.get("x-user") ? { username: req.get("x-user") } : null, getPack: async () => pack });
  app.use("/api/home", router);
  const server = await new Promise(resolve => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}/api/home`;
  const call = (url, body, headers = {}) => fetch(base + url, { method: body === undefined ? "GET" : "POST", headers: { "x-user": "luocheng", "Content-Type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  try {
    assert.equal((await call("/week-ding/config", undefined, { "x-user": "" })).status, 401);
    assert.equal((await call("/week-ding/config", undefined, { "x-user": "employee" })).status, 403);
    assert.equal((await call("/week-ding/config/group", { webhook: hook }, { Origin: "null" })).status, 403);
    for (const [channel, input] of [["group", { webhook: hook }], ["notice", notice], ["bot", { source: "notice", userIds: "employee3" }]]) assert.equal((await call(`/week-ding/config/${channel}`, input)).status, 200);
    assert.equal(sends, 0);
    let revision = (await (await call("/week-ding/config")).json()).config.revision;
    const send = channel => fetch(base + "/week-send", { method: "POST", headers: { "x-user": "luocheng", "Content-Type": "application/octet-stream", "X-Week-Revision": reportRevision(pack), "X-Week-Ding-Channel": channel, "X-Week-Ding-Revision": revision }, body: png }).then(r => r.json());
    const group = await send("group"), work = await send("notice"), bot = await send("bot");
    assert.equal(group.sent, true); assert.equal(work.accepted, true); assert.equal(work.sent, false); assert.equal(bot.accepted, true);
    assert.equal(listWeekHistory().length, 3); assert.equal(sends, 3);
    assert.equal(readWeekHistory(work.historyId).meta.receipt, "42");
    assert.equal((await send("notice")).duplicate, true); assert.equal(sends, 3);
    await call("/week-ding/config/notice", { ...notice, userIds: "employee8", clientSecret: "" });
    assert.equal((await send("notice")).ok, false); assert.equal(sends, 3);
    revision = (await service.publicConfig()).revision;
    assert.equal((await send("notice")).accepted, true); assert.equal(sends, 4);
    assert.equal(listWeekHistory().length, 4);
  } finally { await new Promise(resolve => server.close(resolve)); }
}));
