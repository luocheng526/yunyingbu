/* global Response, AbortSignal, URLSearchParams, Buffer */
import assert from "node:assert/strict";
import { createDecipheriv } from "node:crypto";
import test from "node:test";
import express from "express";
import { boundRouter } from "../src/modules/bound/router.js";
import { loginWithPassword, linkStatus, resetBoundStore, setBoundFetch, startLink, pollLink } from "../src/modules/bound/store.js";
import { readState } from "../src/modules/bound/persist.js";
import { PROBE_TARGET, runSingleProbe } from "../src/modules/bound/probe.js";
import { passwordIdentity } from "../src/modules/bound/password-login.js";
import { requestSingleShopProbe } from "../src/modules/bound/collect.js";

const credentials = { userName: "test-account", password: "test-secret-password", autoRelogin: true };
const input = { shopId: PROBE_TARGET.shopId, platform: PROBE_TARGET.platform, date: PROBE_TARGET.date };
const info = { code: 0, data: { userInfo: { userId: "test-user", companyId: "test-company" } } };
const sessionInfo = { code: 0, data: { uid: "test-user", verify: true } };
const data = { code: 0, data: [null, { columnInfo: [], columnData: [{ date: input.date, syntheticPaid: "3759.12" }] }] };
const json = (payload, status = 200) => new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json", "set-cookie": "JSESSIONID=test-session; Path=/; Secure; HttpOnly" } });
const previousMode = process.env.BOUND_COLLECTION_MODE;

test.beforeEach(() => { resetBoundStore(); delete process.env.BOUND_COLLECTION_MODE; });
test.afterEach(() => { resetBoundStore(); if (previousMode === undefined) delete process.env.BOUND_COLLECTION_MODE; else process.env.BOUND_COLLECTION_MODE = previousMode; });

function setup(handler = () => json(data)) {
  const calls = [];
  setBoundFetch(async (url, options) => {
    const path = new URL(url).pathname;
    calls.push({ path, options });
    if (path.endsWith("/auth/login")) return json({ code: 0, data: { token: "test-token" } });
    if (path.endsWith("/auth/info")) return json(sessionInfo);
    if (path.endsWith("/auth/getUserInfo")) return json(info);
    return handler(path, options);
  });
  return calls;
}

test("账号密码按官方表单编码提交，验证会话后启用重登，密码不入库也不回传", async () => {
  const calls = setup();
  const result = await loginWithPassword(credentials);
  assert.equal(result.ok, true);
  assert.equal(result.phase, "logged_in");
  assert.equal(result.passwordAuth.autoReloginReady, true);
  assert.equal(result.passwordAuth.busy, false);
  assert.deepEqual(calls.map(call => call.path), ["/prod/auth/login", "/prod/auth/info", "/prod/auth/getUserInfo"]);
  const options = calls[0].options;
  assert.match(options.headers["Content-Type"], /x-www-form-urlencoded/);
  assert.equal(options.redirect, "error");
  assert.ok(options.signal instanceof AbortSignal);
  const body = new URLSearchParams(options.body);
  assert.equal(body.get("userName"), credentials.userName);
  assert.equal(body.get("domain"), "hejun.ecbis.cn");
  assert.notEqual(body.get("password"), credentials.password);
  const decipher = createDecipheriv("aes-128-ecb", Buffer.from("xishuiwangluoMDF"), null);
  assert.equal(Buffer.concat([decipher.update(Buffer.from(body.get("password"), "base64")), decipher.final()]).toString("utf8"), credentials.password);
  const saved = await readState("session");
  assert.equal(saved.provider, "PASSWORD");
  assert.deepEqual(saved.passwordIdentity, { userId: "test-user", companyId: "test-company" });
  assert.doesNotMatch(JSON.stringify(saved), /test-secret-password/);
  assert.doesNotMatch(JSON.stringify(result), /test-secret-password|test-session|test-token/);
  resetBoundStore();
  assert.equal((await linkStatus()).passwordAuth.autoReloginReady, false);
});

test("正常过期只重新登录一次并补发同一请求，记录实际请求次数", async () => {
  let count = 0;
  const calls = setup(() => json(++count === 1 ? { code: -1 } : data));
  await loginWithPassword(credentials);
  const result = await runSingleProbe(input);
  assert.equal(result.record.status, "response_received");
  assert.equal(result.record.requestCount, 2);
  assert.deepEqual(result.record.relogin, { attempted: true, succeeded: true });
  assert.equal(calls.filter(call => call.path.endsWith("/auth/login")).length, 2);
  const reports = calls.filter(call => call.path.endsWith("/shop/operatingData"));
  assert.equal(reports[0].options.body, reports[1].options.body);
  assert.equal(result.record.metricVerified, false);
});

test("异地登录和账号禁用不重登；重登后再次过期也立即停止", async () => {
  for (const code of [-7, 9901, 1011, -1]) {
    resetBoundStore();
    const calls = setup(() => json({ code }));
    await loginWithPassword(credentials);
    const result = await runSingleProbe(input);
    assert.equal(result.record.requestCount, code === -1 ? 2 : 1);
    assert.equal(calls.filter(call => call.path.endsWith("/auth/login")).length, code === -1 ? 2 : 1);
    assert.equal((await linkStatus()).passwordAuth.autoReloginReady, false);
    assert.equal((await linkStatus()).phase, "needs_password");
    const before = calls.length;
    assert.equal((await runSingleProbe(input)).record.requestCount, 0);
    assert.equal(calls.length, before);
  }
});

test("关闭自动重登不缓存密码；缺企业标识仅启用固定店铺的用户校验", async () => {
  const calls = setup(() => json({ code: -1 }));
  await loginWithPassword({ ...credentials, autoRelogin: false });
  await runSingleProbe(input);
  assert.equal(calls.filter(call => call.path.endsWith("/auth/login")).length, 1);
  resetBoundStore();
  setBoundFetch(async url => {
    const path = new URL(url).pathname;
    if (path.endsWith("/auth/info")) return json(sessionInfo);
    return json(path.endsWith("/auth/getUserInfo") ? { code: 0, data: { userInfo: { userId: "test-user" } } } : { code: 0, data: {} });
  });
  const result = await loginWithPassword(credentials);
  assert.equal(result.ok, true);
  assert.equal(result.passwordAuth.autoReloginReady, true);
  assert.equal(result.passwordAuth.identityScope, "user_and_fixed_shop");
  assert.match(result.message, /固定店铺/);
});

test("缺企业标识时仅重登同一用户，传输层也拒绝更换店铺或扩大日期", async () => {
  for (const changeUser of [false, true]) {
    resetBoundStore();
    let logins = 0;
    let reports = 0;
    setBoundFetch(async url => {
      const path = new URL(url).pathname;
      if (path.endsWith("/auth/login")) { logins += 1; return json({ code: 0, data: {} }); }
      const userId = changeUser && logins === 2 ? "changed-user" : "test-user";
      if (path.endsWith("/auth/info")) return json({ code: 0, data: { uid: userId, verify: true } });
      if (path.endsWith("/auth/getUserInfo")) return json({ code: 0, data: { userInfo: { userId } } });
      return json(++reports === 1 ? { code: -1 } : data);
    });
    await loginWithPassword(credentials);
    const body = { queryType: 2, platform: input.platform, shopId: input.shopId, startDate: input.date, endDate: input.date, daysType: "1", exportMode: "" };
    for (const bad of [{ ...body, shopId: "other" }, { ...body, startDate: "2026-11-01" }, { ...body, queryType: 1 }]) {
      assert.equal((await requestSingleShopProbe(bad, () => assert.fail("must not send"))).blocked, "invalid_scope");
    }
    assert.equal(reports, 0);
    const result = await runSingleProbe(input);
    assert.equal(logins, 2);
    assert.equal(reports, changeUser ? 1 : 2);
    assert.equal(result.record.relogin.succeeded, !changeUser);
    if (changeUser) assert.equal((await linkStatus()).passwordAuth.autoReloginReady, false);
  }
});

test("自动重登失败或身份发生变化时不补发数据请求", async () => {
  for (const changedIdentity of [false, true]) {
    resetBoundStore();
    let logins = 0;
    let reports = 0;
    setBoundFetch(async url => {
      const path = new URL(url).pathname;
      if (path.endsWith("/auth/login")) {
        logins += 1;
        return json(!changedIdentity && logins === 2 ? { code: 1001, content: credentials.password } : { code: 0, data: {} });
      }
      if (path.endsWith("/auth/info")) return json(sessionInfo);
      if (path.endsWith("/auth/getUserInfo")) return json(logins === 2 ? { code: 0, data: { userInfo: { userId: "test-user", companyId: "other" } } } : info);
      reports += 1;
      return json({ code: -1 });
    });
    await loginWithPassword(credentials);
    const result = await runSingleProbe(input);
    assert.equal(reports, 1);
    assert.equal(result.record.relogin.succeeded, false);
    const status = await linkStatus();
    assert.equal(status.passwordAuth.autoReloginReady, false);
    assert.equal(status.phase, "needs_password");
    assert.doesNotMatch(JSON.stringify(status), /test-secret-password/);
  }
});

test("错误密码、设备限制、超时和会话验证失败均停止，不回显上游错误", async () => {
  for (const code of [-7, 9901, 1011, 1001]) {
    let calls = 0;
    setBoundFetch(async () => { calls += 1; return json({ code, content: credentials.password }); });
    const result = await loginWithPassword(credentials);
    assert.equal(result.ok, false);
    assert.equal(calls, 1);
    assert.doesNotMatch(JSON.stringify(result), /test-secret-password/);
  }
  setBoundFetch(async url => json({ code: new URL(url).pathname.endsWith("/auth/info") ? -1 : 0, data: {} }));
  assert.equal((await loginWithPassword(credentials)).reason, "session_unverified");
  setBoundFetch(async () => { const error = new Error(credentials.password); error.name = "TimeoutError"; throw error; });
  const timedOut = await loginWithPassword(credentials);
  assert.equal(timedOut.ok, false);
  assert.doesNotMatch(JSON.stringify(timedOut), /test-secret-password/);
  setBoundFetch(async () => { throw new Error("must not request"); });
  assert.equal((await loginWithPassword({ ...credentials, password: "" })).statusCode, 400);
});

test("试采期间手动切换登录，旧响应不被采用", async () => {
  let finish;
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  setup(() => { started(); return new Promise(resolve => { finish = resolve; }); });
  await loginWithPassword(credentials);
  const pending = runSingleProbe(input);
  await ready;
  await loginWithPassword({ ...credentials, userName: "second-test-account" });
  finish(json(data));
  const result = await pending;
  assert.equal(result.record.status, "session_changed");
  assert.equal(result.record.sample, undefined);
});

test("旧二维码的迟到响应不能覆盖账号密码登录", async () => {
  let finish;
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  setBoundFetch(async url => {
    if (String(url).includes("/auth/qrcode")) return json({ code: 0, data: { scene: "old-scene", url: "https://example.invalid/qr" } });
    if (String(url).includes("/auth/checkQrcode")) { started(); return new Promise(resolve => { finish = resolve; }); }
    const path = new URL(url).pathname;
    if (path.endsWith("/auth/info")) return json(sessionInfo);
    return json(path.endsWith("/auth/getUserInfo") ? info : { code: 0, data: {} });
  });
  await startLink("WECHAT");
  const pending = pollLink();
  await ready;
  await loginWithPassword(credentials);
  finish(json({ code: 0, data: {} }));
  await pending;
  const status = await linkStatus();
  assert.equal(status.provider, "PASSWORD");
  assert.equal(status.userName, credentials.userName);
  assert.equal(status.passwordAuth.autoReloginReady, true);
});

test("密码接口只允许边界管理员且响应禁止缓存", async () => {
  const calls = setup();
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { if (req.headers["test-user"]) req.user = { username: req.headers["test-user"] }; next(); });
  app.use("/api/bound", boundRouter);
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.on("listening", resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/bound/link/password`;
  try {
    const options = { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(credentials) };
    assert.equal((await fetch(url, options)).status, 401);
    assert.equal((await fetch(url, { ...options, headers: { ...options.headers, "test-user": "ordinary" } })).status, 403);
    assert.equal(calls.length, 0);
    const response = await fetch(url, { ...options, headers: { ...options.headers, "test-user": "luocheng" } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal((await response.json()).ok, true);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test("会话校验和用户资料分开核实，企业标识按官方规则读取", async () => {
  for (const user of [
    { userId: "test-user", companyId: "company-one" },
    { userId: "test-user", companyID: "company-two" },
    { userId: "test-user", primaryAccount: "primary-test-account" }
  ]) {
    setBoundFetch(async url => {
      const path = new URL(url).pathname;
      if (path.endsWith("/auth/info")) return json(sessionInfo);
      return json(path.endsWith("/auth/getUserInfo") ? { code: 0, data: { userInfo: user } } : { code: 0, data: {} });
    });
    const result = await loginWithPassword(credentials);
    assert.equal(result.ok, true);
    assert.equal(result.passwordAuth.autoReloginReady, true);
    assert.deepEqual((await readState("session")).passwordIdentity, passwordIdentity(user));
  }
  setBoundFetch(async url => json(new URL(url).pathname.endsWith("/auth/info") ? { code: 0, data: { uid: "test-user", verify: false } } : { code: 0, data: {} }));
  assert.equal((await loginWithPassword(credentials)).reason, "session_unverified");
  setBoundFetch(async url => {
    const path = new URL(url).pathname;
    if (path.endsWith("/auth/info")) return json({ code: 0, data: { uid: "other", verify: true } });
    return json(path.endsWith("/auth/getUserInfo") ? info : { code: 0, data: {} });
  });
  assert.equal((await loginWithPassword(credentials)).reason, "identity_changed");
});
