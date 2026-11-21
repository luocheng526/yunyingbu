/* global Response */
import assert from "node:assert/strict";
import test from "node:test";
import { request } from "node:http";
import { createLocalProbeApp } from "../src/modules/bound/local-probe.js";
import { resetBoundStore, setBoundFetch } from "../src/modules/bound/store.js";
import { PROBE_TARGET } from "../src/modules/bound/probe.js";

test("本机试采隔离生产存储和批量入口，拒绝跨站密码提交", async () => {
  const previous = process.env.BOUND_COLLECTION_MODE;
  delete process.env.BOUND_COLLECTION_MODE;
  resetBoundStore();
  let requests = 0;
  setBoundFetch(async () => { requests += 1; throw new Error("No upstream request expected"); });
  const server = createLocalProbeApp().listen(0, "127.0.0.1");
  await new Promise(resolve => server.on("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const page = await fetch(`${base}/bound`);
    const html = await page.text();
    assert.match(html, /边界数据中心 · 本机单店数据/);
    assert.match(html, /浏览已保存数据无需登录/);
    assert.equal(page.headers.get("cache-control"), "no-store");
    assert.match(page.headers.get("content-security-policy"), /img-src 'self' data: https:\/\/img11\.360buyimg\.com;/);
    assert.match(page.headers.get("content-security-policy"), /connect-src 'self';/);
    const script = await fetch(`${base}/shared/modules/bound.js`);
    assert.equal(script.status, 200);
    assert.match(await script.text(), /XmModules\["\/bound"\]/);
    const wrongHostStatus = await new Promise((resolve, reject) => {
      const req = request(`${base}/api/bound/link`, { headers: { Host: "foreign.example:1234" } }, res => { res.resume(); resolve(res.statusCode); });
      req.on("error", reject);
      req.end();
    });
    assert.equal(wrongHostStatus, 403);
    assert.equal((await fetch(`${base}/api/bound/link`, { headers: { Origin: "https://foreign.example" } })).status, 403);
    for (const origin of ["", "https://foreign.example"]) {
      const response = await fetch(`${base}/api/bound/link/password`, { method: "POST", headers: { "content-type": "application/json", ...(origin ? { Origin: origin } : {}) }, body: "{}" });
      assert.equal(response.status, 403);
    }
    const headers = { Origin: base, "content-type": "application/json" };
    assert.equal((await fetch(`${base}/api/bound/collect/probe/relogin-check`, { method: "POST", headers: { ...headers, Origin: "https://foreign.example" }, body: "{}" })).status, 403);
    assert.equal((await fetch(`${base}/api/bound/collect/tick`, { method: "POST", headers, body: "{}" })).status, 405);
    assert.equal((await fetch(`${base}/api/bound/link/password`, { method: "POST", headers, body: "{}" })).status, 400);
    const status = await (await fetch(`${base}/api/bound/link`)).json();
    assert.equal(status.collection.batchEnabled, false);
    assert.equal(status.phase, "idle");
    assert.equal(requests, 0);
    process.env.BOUND_COLLECTION_MODE = "batch";
    assert.throws(createLocalProbeApp, /暂停批量采集/);
  } finally {
    await new Promise(resolve => server.close(resolve));
    resetBoundStore();
    if (previous === undefined) delete process.env.BOUND_COLLECTION_MODE;
    else process.env.BOUND_COLLECTION_MODE = previous;
  }
});

test("本机失效演练走无 Cookie 请求、重登和原请求补发，不调用旧站退出接口", async () => {
  const previous = process.env.BOUND_COLLECTION_MODE;
  delete process.env.BOUND_COLLECTION_MODE;
  resetBoundStore();
  const calls = [];
  const json = payload => new Response(JSON.stringify(payload), { headers: { "content-type": "application/json", "set-cookie": "JSESSIONID=test-session; Path=/" } });
  setBoundFetch(async (url, options) => {
    const path = new URL(url).pathname;
    calls.push({ path, options });
    if (path.endsWith("/auth/login")) return json({ code: 0, data: {} });
    if (path.endsWith("/auth/info")) return json({ code: 0, data: { uid: "test-user", verify: true } });
    if (path.endsWith("/auth/getUserInfo")) return json({ code: 0, data: { userInfo: { userId: "test-user" } } });
    assert.ok(path.endsWith("/shop/operatingData"));
    return json(options.headers.Cookie ? { code: 0, data: [null, { columnInfo: [], columnData: [{ date: PROBE_TARGET.date }] }] } : { code: -1 });
  });
  const server = createLocalProbeApp().listen(0, "127.0.0.1");
  await new Promise(resolve => server.on("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { Origin: base, "content-type": "application/json" };
  const input = { shopId: PROBE_TARGET.shopId, platform: PROBE_TARGET.platform, date: PROBE_TARGET.date };
  try {
    const notReady = await (await fetch(`${base}/api/bound/collect/probe/relogin-check`, { method: "POST", headers, body: JSON.stringify(input) })).json();
    assert.equal(notReady.record.status, "relogin_not_ready");
    assert.equal(calls.length, 0);
    const login = await (await fetch(`${base}/api/bound/link/password`, { method: "POST", headers, body: JSON.stringify({ userName: "test-user", password: "test-password", autoRelogin: true }) })).json();
    assert.equal(login.passwordAuth.autoReloginReady, true);
    const result = await (await fetch(`${base}/api/bound/collect/probe/relogin-check`, { method: "POST", headers, body: JSON.stringify(input) })).json();
    assert.equal(result.record.validationMode, "local_cookie_loss");
    assert.equal(result.record.requestCount, 2);
    assert.deepEqual(result.record.relogin, { attempted: true, succeeded: true });
    assert.deepEqual(result.record.reloginTrigger, { httpStatus: 200, upstreamCode: -1 });
    const dataCalls = calls.filter(call => call.path.endsWith("/shop/operatingData"));
    assert.equal(dataCalls[0].options.headers.Cookie, undefined);
    assert.match(dataCalls[1].options.headers.Cookie, /JSESSIONID=/);
    assert.equal(dataCalls[0].options.body, dataCalls[1].options.body);
    assert.equal(calls.filter(call => call.path.endsWith("/auth/login")).length, 2);
    assert.equal(calls.some(call => call.path.endsWith("/auth/logout")), false);
  } finally {
    await new Promise(resolve => server.close(resolve));
    resetBoundStore();
    if (previous === undefined) delete process.env.BOUND_COLLECTION_MODE;
    else process.env.BOUND_COLLECTION_MODE = previous;
  }
});
