/* global Response, AbortSignal */
import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { boundRouter } from "../src/modules/bound/router.js";
import { resetBoundStore, setBoundFetch } from "../src/modules/bound/store.js";
import { listSheetHeads, readState, writeState } from "../src/modules/bound/persist.js";
import { PROBE_TARGET, runSingleProbe, singleProbeStatus } from "../src/modules/bound/probe.js";

const input = { shopId: PROBE_TARGET.shopId, platform: PROBE_TARGET.platform, date: PROBE_TARGET.date };
const mode = process.env.BOUND_COLLECTION_MODE;
// Synthetic contract fixture, not a real BI response or verified money-field mapping.
const sample = { code: 0, data: [{ aggregate: "do not use" }, {
  columnInfo: [{ field: "date" }, { field: "testPaidValue", title: "支付金额(支付)" }],
  columnData: [{ date: "2026-11-18", testPaidValue: "42.00" }, { date: "2026-11-19", testPaidValue: "3759.12" }]
}] };

test.beforeEach(() => {
  resetBoundStore();
  delete process.env.BOUND_COLLECTION_MODE;
});
test.afterEach(() => {
  resetBoundStore();
  if (mode === undefined) delete process.env.BOUND_COLLECTION_MODE;
  else process.env.BOUND_COLLECTION_MODE = mode;
});

async function login(allowed = ["qd_fx"]) {
  await writeState("session", { phase: "logged_in", deviceId: "test-device", allowed, cookies: { JSESSIONID: "test-cookie-do-not-store-in-probe" } });
}

test("首笔试采拒绝更换店铺、日期、渠道或追加参数，默认未登录不发送请求", async () => {
  let calls = 0;
  setBoundFetch(async () => { calls += 1; throw new Error("unexpected"); });
  for (const wrong of [{}, { ...input, shopId: "" }, { ...input, date: "2026-11-20" }, { ...input, platform: "all" }, { ...input, shopIds: ["1", "2"] }]) {
    assert.equal((await runSingleProbe(wrong)).statusCode, 400);
  }
  const result = await runSingleProbe(input);
  assert.equal(result.record.status, "server_login_required");
  assert.equal(result.record.requestCount, 0);
  assert.equal(calls, 0);
  assert.equal((await singleProbeStatus()).last.id, result.record.id);
});

test("成功请求仅一次且指定单店，独立持久化并回读样本，不猜金额、不污染正式表", async () => {
  await login();
  const calls = [];
  setBoundFetch(async (url, options) => {
    calls.push({ url: String(url), options });
    return new Response(JSON.stringify(sample), { status: 200, headers: { "content-type": "application/json" } });
  });
  const result = await runSingleProbe(input);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://biprodapi.ecbis.cn/prod/v2/channel/shop/operatingData");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.redirect, "error");
  assert.ok(calls[0].options.signal instanceof AbortSignal);
  assert.equal(calls[0].options.headers["access-code"], "qd_fx");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    queryType: 2, platform: "JD", shopId: "16501691", startDate: "2026-11-19", endDate: "2026-11-19", daysType: "1", exportMode: ""
  });
  assert.equal(result.ok, true);
  assert.equal(result.persisted, true);
  assert.equal(result.record.status, "response_received");
  assert.equal(result.record.metricVerified, false);
  assert.equal(result.record.matchedRowCount, 1);
  assert.deepEqual(result.record.sample.row, sample.data[1].columnData[1]);
  assert.equal(result.record.sample.row.testPaidValue, "3759.12");
  assert.deepEqual((await singleProbeStatus()).last, result.record);
  assert.doesNotMatch(JSON.stringify(result), /test-cookie|JSESSIONID/);
  assert.deepEqual(await listSheetHeads(), []);
  assert.equal(await readState("wanted", null), null);
});

test("不同格式、缺少或重复日期行均不确认为成功样本", async () => {
  await login();
  for (const [payload, status] of [
    [{ code: 0, data: { payAmount: 3759 } }, "schema_unverified"],
    [{ code: 0, data: [null, { columnInfo: [], columnData: [{ date: "2026-11-18" }] }] }, "date_unverified"],
    [{ code: 0, data: [null, { columnInfo: [], columnData: [{ date: input.date }, { date: input.date }] }] }, "date_unverified"]
  ]) {
    setBoundFetch(async () => new Response(JSON.stringify(payload), { headers: { "content-type": "application/json" } }));
    const result = await runSingleProbe(input);
    assert.equal(result.ok, false);
    assert.equal(result.record.status, status);
    assert.equal(result.record.sample, undefined);
  }
});

test("超时、HTTP 错误和登录异常都只请求一次，不轮询、不重登、不暴露错误正文", async () => {
  for (const [httpStatus, code, expected] of [[401, 0, "login_expired"], [500, 0, "request_failed"], [200, -1, "login_expired"], [200, -7, "login_conflict"], [200, 9901, "login_conflict"]]) {
    await login();
    let calls = 0;
    setBoundFetch(async () => {
      calls += 1;
      return new Response(JSON.stringify({ code, content: "secret-like-error-value" }), { status: httpStatus, headers: { "content-type": "application/json" } });
    });
    const result = await runSingleProbe(input);
    assert.equal(result.record.status, expected);
    assert.equal(calls, 1);
    assert.doesNotMatch(JSON.stringify(result), /secret-like-error-value/);
  }
  await login();
  let calls = 0;
  setBoundFetch(async () => { calls += 1; const error = new Error("secret-like-error-value"); error.name = "TimeoutError"; throw error; });
  const result = await runSingleProbe(input);
  assert.equal(result.record.status, "timeout");
  assert.equal(calls, 1);
  assert.doesNotMatch(JSON.stringify(result), /secret-like-error-value/);
});

test("禁止权限不足、并发试采和批量模式叠加", async () => {
  await login([]);
  let calls = 0;
  setBoundFetch(async () => { calls += 1; throw new Error("unexpected"); });
  assert.equal((await runSingleProbe(input)).record.status, "permission_denied");
  assert.equal(calls, 0);
  process.env.BOUND_COLLECTION_MODE = "batch";
  assert.equal((await runSingleProbe(input)).statusCode, 409);
  delete process.env.BOUND_COLLECTION_MODE;
  await login();
  let finish;
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  setBoundFetch(() => { calls += 1; started(); return new Promise(resolve => { finish = resolve; }); });
  const pending = runSingleProbe(input);
  await ready;
  assert.equal((await singleProbeStatus()).running, true);
  assert.equal((await runSingleProbe(input)).statusCode, 409);
  finish(new Response(JSON.stringify(sample), { headers: { "content-type": "application/json" } }));
  await pending;
  assert.equal(calls, 1);
  assert.equal((await singleProbeStatus()).running, false);
});

test("试采和样本回读接口只允许边界管理员", async () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { if (req.headers["test-user"]) req.user = { username: req.headers["test-user"] }; next(); });
  app.use("/api/bound", boundRouter);
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.on("listening", resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/bound/collect/probe`;
  try {
    for (const method of ["GET", "POST"]) {
      assert.equal((await fetch(url, { method })).status, 401);
      assert.equal((await fetch(url, { method, headers: { "test-user": "ordinary-user" } })).status, 403);
    }
    const admin = await fetch(url, { headers: { "test-user": "luocheng" } });
    assert.equal(admin.status, 200);
    assert.deepEqual((await admin.json()).target, PROBE_TARGET);
    const attempt = await fetch(url, { method: "POST", headers: { "test-user": "luocheng", "content-type": "application/json" }, body: JSON.stringify(input) });
    assert.equal((await attempt.json()).record.status, "server_login_required");
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test("新增十月三日广告试采只请求该日一笔，保留十一月十九日结果且不猜广告口径", async () => {
  await login();
  const calls = [];
  setBoundFetch(async (_url, options) => {
    const body = JSON.parse(options.body);
    calls.push(body);
    const payload = body.startDate === input.date ? sample : {
      code: 0, data: [{ syntheticSummary: true }, { columnInfo: [], columnData: [
        { date: "2026/10/02", syntheticAdValue: "111" },
        { date: "2026/10/03", syntheticAdValue: "12.34" }
      ] }]
    };
    return new Response(JSON.stringify(payload), { headers: { "content-type": "application/json" } });
  });
  const original = await runSingleProbe(input);
  const ad = await runSingleProbe({ ...input, date: "2026-10-03" });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].startDate, "2026-10-03");
  assert.equal(calls[1].endDate, "2026-10-03");
  assert.equal(calls[1].shopId, input.shopId);
  assert.equal(ad.record.target.metric, "广告花费");
  assert.equal(ad.record.target.pageDisplay, "9,606.63");
  assert.equal(ad.record.target.pageConfirmation.source, "user");
  assert.equal(ad.record.requestCount, 1);
  assert.equal(ad.record.metricVerified, false);
  assert.equal(ad.record.metric, undefined);
  assert.deepEqual(ad.record.sample.summary, { syntheticSummary: true });
  assert.equal(ad.record.sample.row.syntheticAdValue, "12.34");
  assert.equal((await singleProbeStatus("2026-11-19")).last.id, original.record.id);
  assert.equal((await singleProbeStatus("2026-10-03")).last.id, ad.record.id);
  assert.equal((await singleProbeStatus("2026-10-04")).statusCode, 400);
  assert.equal((await runSingleProbe({ ...input, date: "2026-10-04" })).statusCode, 400);
  assert.equal(calls.length, 2);
});
