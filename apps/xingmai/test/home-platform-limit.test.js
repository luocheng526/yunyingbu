import "./_memory-env.js";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { jingmaiAccessLimit } from "../src/modules/home/jingmai.js";
import { fetchHome } from "../src/modules/home/jingmai-client.js";
import { createLive2Collector } from "../src/modules/home/live2-collect.js";

test("only explicit platform limits are classified, never generic 601 or missing data", () => {
  for (const msg of ["非法请求拦截", "操作频繁，请稍后重试"]) assert.ok(jingmaiAccessLimit({ code: 601, msg }));
  assert.ok(jingmaiAccessLimit({ code: 429 }));
  for (const body of [{ code: 200, msg: "操作频繁" }, { code: 601, msg: "其他错误" }, { code: 401 }, { code: 200, data: { value: "-" } }]) {
    assert.equal(jingmaiAccessLimit(body), "");
  }
});

test("browser observer watches only the affected trade and identity APIs and stops cleanly", async () => {
  const source = fs.readFileSync(new URL("../src/modules/home/jingmai-desk.js", import.meta.url), "utf8");
  const code = source.slice(source.indexOf("function watchPlatformLimits"), source.indexOf("function watchVaneIdentity"));
  const ws = new EventTarget();
  const context = vm.createContext({ ws, URL, Buffer, jingmaiAccessLimit, send: async () => ({ body: JSON.stringify({ code: 601, msg: "操作频繁，请稍后重试" }) }) });
  const watch = vm.runInContext(code + "\nwatchPlatformLimits(ws)", context);
  let seq = 0;
  async function response(api, host = "sff.jd.com", status = 200) {
    const requestId = String(++seq);
    ws.dispatchEvent(new MessageEvent("message", { data: JSON.stringify({ method: "Network.responseReceived", params: { requestId, response: { status, url: "https://" + host + "/api?api=" + encodeURIComponent(api) } } }) }));
    ws.dispatchEvent(new MessageEvent("message", { data: JSON.stringify({ method: "Network.loadingFinished", params: { requestId } }) }));
    await Promise.resolve(); await Promise.resolve();
  }
  await response("dsm.jm.data.operationData.findPromoteData");
  await response("dsm.jm.data.operationData.findShopData", "unrelated.example");
  assert.equal(watch.read().deal, ""); assert.equal(watch.read().identity, "");
  await response("dsm.shop.center.pageframe.navigation.NavigationFacade.findShopInfo");
  assert.ok(watch.read().identity); assert.equal(watch.read().deal, "");
  await response("dsm.jm.data.operationData.findShopData", "sff.jd.com", 429);
  assert.ok(watch.read().deal);
  watch.stop();
  const stopped = watch.read();
  await response("dsm.jm.data.operationData.findShopData");
  assert.equal(JSON.stringify(watch.read()), JSON.stringify(stopped));
});

test("a rejected legacy endpoint is tried once; a working authenticated browser path remains usable", async () => {
  let tradeRequests = 0, browserReads = 0;
  const fakeFetch = async url => {
    if (String(url).includes("findShopDataByChannel")) tradeRequests++;
    return new Response(JSON.stringify({ code: 601, msg: "操作频繁，请稍后重试" }));
  };
  const result = await fetchHome([{ name: "thor", value: "test" }], fakeFetch, async () => {
    browserReads++;
    return { dealAmount: 123, orderCount: 1 };
  });
  assert.equal(result.dealAmount, 123);
  assert.equal(tradeRequests, 1); assert.equal(browserReads, 1);
});

test("an explicit browser limit stops the shop without trying advertising or password login", async () => {
  let advertising = 0;
  const fakeFetch = async url => {
    if (String(url).includes("jzt")) advertising++;
    return new Response(JSON.stringify({ code: 601, msg: "操作频繁，请稍后重试" }));
  };
  await assert.rejects(fetchHome([{ name: "thor", value: "test" }], fakeFetch, async () => {
    throw Object.assign(new Error("京东提示操作频繁"), { code: "platform_limited" });
  }), e => e.code === "platform_limited");
  assert.equal(advertising, 0);
});

test("a limited store retains its data and cookies, backs off across restarts, and leaves other stores running", async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "home-platform-hold-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  let time = Date.parse("2026-11-21T01:08:00+08:00"), pending, blocked = true;
  const calls = { A: 0, B: 0 };
  const sessions = ["A", "B"].map(store => ({ store, sessionGen: 1, cookies: [{ name: "thor", value: store }] }));
  const deps = {
    storePath: path.join(dir, "state.json"), concurrency: 1,
    clock: () => time, now: () => new Date(time + 8 * 3600000).toISOString().slice(0, 19).replaceAll("-", "/").replace("T", " "),
    loadOrg: async () => ["A", "B"].map(store => ({ store, enabled: true })),
    listSessions: async () => sessions, listSamples: async () => [],
    claimOwner: async () => ({ ok: true }), saveSample: async () => ({ saved: true }),
    track: task => { pending = task; },
    client: { fetchHome: async jar => {
      const store = jar[0].value; calls[store]++;
      if (store === "A" && blocked) throw Object.assign(new Error("京东提示操作频繁"), { code: "platform_limited" });
      return { dealAmount: 100, paidAmount: 5 };
    } }
  };
  let collector = createLive2Collector({ ...deps, published: [{ shop: "A", liveAmount: 72, paidAmount: 4.2, capturedAt: "2026/11/21 01:00:00" }] });
  async function round() { await collector.start(""); await pending; return (await collector.board("")).records; }
  let rows = await round();
  let a = rows.find(r => r.shop === "A");
  assert.equal(a.liveAmount, 72); assert.equal(a.paidAmount, 4.2);
  assert.equal(a.capturedAt, "2026/11/21 01:00:00"); assert.equal(a.loginExpired, false);
  assert.equal(a.platformRetryAt, time + 20 * 60000); assert.equal(sessions[0].cookies[0].value, "A");
  time += 10 * 60000; await round(); assert.deepEqual(calls, { A: 1, B: 2 });
  collector = createLive2Collector(deps); await round(); assert.deepEqual(calls, { A: 1, B: 3 });
  time += 11 * 60000; rows = await round(); a = rows.find(r => r.shop === "A");
  assert.equal(calls.A, 2); assert.equal(a.platformRetryAt, time + 40 * 60000);
  sessions[0].sessionGen = 2; blocked = false;
  rows = await round(); a = rows.find(r => r.shop === "A");
  assert.equal(calls.A, 3); assert.equal(a.online, true); assert.equal(a.platformLimited, undefined);
});
