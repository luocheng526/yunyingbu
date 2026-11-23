import test from "node:test";
import assert from "node:assert/strict";
import { createPasswordAuth } from "../src/modules/bound/password-login.js";
import { classifyLoginFailure, loginDiagnostic, nextShanghaiDay } from "../src/modules/bound/login-diagnostics.js";

test("识别旧站今日失败上限，跨进程保留冷却，次日只在显式操作时再试", async () => {
  let time = Date.parse("2026-11-23T01:50:00Z"), calls = 0, saved = { cookies: {}, deviceId: "test-device" };
  const input = { userName: "test-account", password: "test-secret", autoRelogin: true };
  const config = { now: () => time, readSession: async () => saved, saveSession: async value => { saved = value; }, request: async () => {
    calls++;
    return { httpStatus: 200, payload: { code: 1001, content: "手机号登录今日失败次数已达上限，请明天再试" } };
  } };
  let auth = createPasswordAuth(config);
  const first = await auth.signIn(input);
  assert.equal(first.reason, "login_daily_limit"); assert.equal(calls, 1);
  assert.equal(first.loginRetryAfter, "2026-11-23T16:00:00.000Z");
  assert.equal(saved.authDiagnostic.httpStatus, 200); assert.equal(saved.authDiagnostic.upstreamCode, 1001);
  assert.equal(auth.status().autoReloginReady, false);
  auth = createPasswordAuth(config);
  assert.equal((await auth.signIn(input)).statusCode, 429); assert.equal(calls, 1);
  assert.equal((await auth.refresh()).reason, "credentials_unavailable"); assert.equal(calls, 1);
  time = Date.parse(first.loginRetryAfter);
  assert.equal(calls, 1, "冷却到期不自动发起登录");
  await auth.signIn(input); assert.equal(calls, 2);
  assert.doesNotMatch(JSON.stringify(saved), /test-secret/);
});

test("传输错误和账号限制分开说明，不把上游正文或密码带入诊断", () => {
  const cases = [
    [{ httpStatus: 429, payload: {} }, "login_rate_limited"],
    [{ httpStatus: 503, payload: {} }, "login_service_unavailable"],
    [{ httpStatus: 403, binary: true }, "login_response_invalid"],
    [{ httpStatus: 200, payload: { code: -7 } }, "login_conflict"],
    [{ httpStatus: 200, payload: { code: 9901 } }, "account_disabled"],
    [{ httpStatus: 200, payload: { code: "1011" } }, "device_restricted"],
    [{ httpStatus: 200, payload: { code: 0, data: { needSelect: true } } }, "company_selection_required"],
    [{ httpStatus: 200, payload: { code: 1001, content: "test-secret", message: "<script>secret-token</script>" } }, "login_failed"]
  ];
  for (const [response, reason] of cases) {
    const result = classifyLoginFailure(response);
    assert.equal(result.reason, reason);
    assert.doesNotMatch(JSON.stringify({ result, diagnostic: loginDiagnostic("login", response) }), /test-secret|secret-token|<script>/);
  }
  assert.equal(loginDiagnostic("login", { payload: { code: "test-secret" } }).upstreamCode, null);
  const timeout = Object.assign(new Error("test-secret"), { name: "TimeoutError" });
  assert.deepEqual(loginDiagnostic("profile", null, timeout).errorType, "timeout");
  assert.doesNotMatch(JSON.stringify(loginDiagnostic("profile", null, timeout)), /test-secret/);
});

test("诊断标注失败阶段，重新登录成功后清除旧故障信息", async () => {
  let phase = "session", saved = { cookies: {}, deviceId: "test-device" };
  const auth = createPasswordAuth({ readSession: async () => saved, saveSession: async value => { saved = value; }, request: async (current, spec) => {
    current.cookies.sid = "test-cookie";
    if (spec.path === "/auth/login") return { httpStatus: 200, payload: { code: 0, data: {} } };
    if (spec.path === "/auth/info") return { httpStatus: phase === "session" ? 503 : 200, payload: { code: 0, data: { uid: "one", verify: true } } };
    return { httpStatus: 200, payload: { code: 0, data: { userInfo: { userId: "one", companyId: "company" } } } };
  } });
  const input = { userName: "one", password: "test-secret", autoRelogin: false };
  const failed = await auth.signIn(input);
  assert.equal(failed.diagnostic.stage, "session"); assert.equal(failed.diagnostic.httpStatus, 503);
  phase = "success"; assert.equal((await auth.signIn(input)).ok, true);
  assert.equal(saved.authDiagnostic, null); assert.equal(saved.loginRetryAfter, null); assert.equal(saved.authFailure, "");
});

test("北京时间日界线跨月与跨年正确，不使用服务器本地时区", () => {
  assert.equal(nextShanghaiDay(Date.parse("2026-11-30T15:59:59Z")), "2026-11-30T16:00:00.000Z");
  assert.equal(nextShanghaiDay(Date.parse("2026-11-30T16:00:00Z")), "2026-12-01T16:00:00.000Z");
  assert.equal(nextShanghaiDay(Date.parse("2026-12-31T15:59:59Z")), "2026-12-31T16:00:00.000Z");
});
