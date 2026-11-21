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
import { patchHomeClientSource } from "../src/modules/home/router.js";
import { getSession, listSessions, resetJingmaiStore, saveSession, sessionVersionOf } from "../src/modules/home/jingmai-store.js";

test("the served homepage labels a deferred store as platform-limited without a relogin button", () => {
  const page = patchHomeClientSource(fs.readFileSync(new URL("../public/shared/modules/home.js", import.meta.url), "utf8"));
  function pick(name) {
    const start = page.indexOf("  function " + name + "(");
    assert.ok(start >= 0);
    return page.slice(start, page.indexOf("\n  function ", start + 1));
  }
  const context = vm.createContext({
    liveScope: "live2", fmtMoney: String, fmtRate: String, asNum: Number,
    feeMonitorOf: () => ({}), escapeHtml: String,
    pack: { records: [{ shop: "A", platformLimited: true, offline: true, offlineReason: "京东提示操作频繁；暂停重试20分钟", dealReason: "旧的成交错误" }] }
  });
  const html = vm.runInContext(pick("applyLive2Pack") + pick("liveLinkOf") + pick("liveShopCellHtml") +
    '\nconst row=applyLive2Pack([{shop:"A"}],pack)[0];liveShopCellHtml({key:"liveOn"},row,0);', context);
  assert.match(html, /平台限制/); assert.match(html, /暂停重试20分钟/);
  assert.doesNotMatch(html, /data-live-login|重新登录|掉线|旧的成交错误/);
  assert.equal(vm.runInContext('liveLinkOf({...row,loginExpired:true}).kind', context), "off");
});

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

for (const outcome of ["success", "platform_limited", "identity", "login", "network"]) {
  test(`after cooldown a limited shop verifies its native browser before legacy requests (${outcome})`, async () => {
    await resetJingmaiStore();
    const cookies = value => [{ name: "thor", value, domain: ".jd.com", path: "/" }];
    for (const store of ["A", "B"]) await saveSession(store, { cookies: cookies(store), authState: "ok", enabled: true, shopId: store });
    const version = sessionVersionOf(await getSession("A"));
    let time = 1000, pending, recoveries = 0;
    const requests = [];
    const collector = createLive2Collector({
      storePath: "", concurrency: 1, clock: () => time, now: () => "2026/11/21 11:34:00",
      published: [{ shop: "A", platformLimited: true, platformSessionVersion: version, platformRetryAt: 2000,
        platformFailures: 3, liveAmount: 72, paidAmount: 4, capturedAt: "2026/11/21 11:30:00" }],
      loadOrg: async () => ["A", "B"].map(store => ({ store, shopId: store, enabled: true, login: "fixture", password: "secret-fixture" })),
      listSessions, listSamples: async () => [], track: task => { pending = task; },
      client: {
        fetchAccountIdentity: async jar => { requests.push("identity:" + jar[0].value); return { shopId: jar[0].value }; },
        recoverBrowserSession: async (jar, signal, expected) => {
          recoveries++;
          assert.equal(jar[0].value, "A"); assert.equal(signal.aborted, false);
          assert.equal(expected.requireIdentity, true); assert.equal(expected.shopId, "A");
          if (outcome !== "success") throw Object.assign(new Error(outcome === "login" ? "京东要求安全验证" : outcome), { code: outcome, needsHuman: outcome === "login" });
          return { cookies: cookies("A-renewed"), deal: { dealAmount: 100 } };
        },
        fetchHome: async (jar, _signal, expected) => {
          requests.push("metrics:" + jar[0].value);
          if (expected.store === "A") { assert.equal(jar[0].value, "A-renewed"); assert.equal(expected.browserDeal.dealAmount, 100); }
          else assert.equal(expected.browserDeal, undefined);
          return { dealAmount: 100, paidAmount: 5 };
        }
      }
    });
    const round = async () => { await collector.start(""); await pending; return (await collector.board("")).records; };
    await round();
    assert.equal(recoveries, 0); assert.deepEqual(requests, ["identity:B", "metrics:B"]);
    time = 2000; requests.length = 0;
    const rows = await round(), a = rows.find(row => row.shop === "A");
    assert.equal(recoveries, 1);
    assert.ok(!requests.includes("identity:A"));
    assert.equal(rows.find(row => row.shop === "B").online, true);
    if (outcome === "success") {
      assert.equal(a.online, true); assert.equal(a.platformLimited, undefined);
      assert.equal(a.liveAmount, 100); assert.equal((await getSession("A")).cookies[0].value, "A-renewed");
    } else {
      assert.ok(!requests.some(value => value.startsWith("metrics:A")));
      assert.equal(a.liveAmount, 72); assert.equal((await getSession("A")).cookies[0].value, "A");
      if (outcome === "platform_limited") { assert.equal(a.platformLimited, true); assert.equal(a.platformRetryAt, time + 60 * 60000); }
      else { assert.equal(a.platformLimited, false); assert.equal(a.loginExpired, outcome === "login"); }
      if (outcome === "network") {
        requests.length = 0; time += 10 * 60000;
        await round();
        assert.equal(recoveries, 2);
        assert.ok(!requests.includes("identity:A"), "a transient browser failure must not resume rejected legacy preflights");
      }
    }
  });
}

for (const learnFrom of ["cooldown", "native_identity"]) {
test(`verified browser route survives later rounds, restart, midnight and ads errors (${learnFrom})`, async t => {
  await resetJingmaiStore();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "home-native-route-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const cookies = value => [{ name: "thor", value, domain: ".jd.com", path: "/" }];
  for (const store of ["A", "B"]) await saveSession(store, { cookies: cookies(store), authState: "ok", enabled: true, shopId: store });
  const version = sessionVersionOf(await getSession("A"));
  let time = Date.parse("2026-11-21T13:14:00+08:00"), pending, browserReads = 0, expectPreferred = true, blocked = false, sampleAvailable = false, adsFail = false;
  const stamp = () => new Date(time + 8 * 3600000).toISOString().slice(0, 19).replaceAll("-", "/").replace("T", " ");
  const calls = [];
  const deps = {
    storePath: path.join(dir, "state.json"), concurrency: 1, clock: () => time, now: stamp,
    loadOrg: async () => ["A", "B"].map(store => ({ store, shopId: store, enabled: true })),
    listSessions, listSamples: async () => sampleAvailable ? [{ store: "A", capturedAt: stamp(), ok: true, dealAmount: 999, paidAmount: 5 }] : [], track: task => { pending = task; },
    client: {
      fetchAccountIdentity: async jar => { const store = jar[0].value[0]; calls.push("identity:" + store); return { shopId: store }; },
      recoverBrowserSession: async (_jar, _signal, expected) => {
        calls.push("browser:" + expected.store); browserReads++;
        assert.equal(expected.requireIdentity, true);
        if (blocked) throw Object.assign(new Error("京东提示操作频繁"), { code: "platform_limited", platformLimitSource: "browser_trade" });
        return { cookies: cookies("A-renewed"), deal: { dealAmount: 100 + browserReads } };
      },
      fetchHome: async (_jar, _signal, expected) => {
        calls.push("metrics:" + expected.store);
        if (expected.store === "A" && expectPreferred && !(learnFrom === "native_identity" && browserReads === 0)) assert.equal(expected.browserDeal.dealAmount, 100 + browserReads);
        else assert.equal(expected.browserDeal, undefined);
        return { dealAmount: expected.browserDeal?.dealAmount || 100,
          ...(expected.store === "A" && learnFrom === "native_identity" ? { preferNativeCollection: true } : {}),
          paidAmount: expected.store === "A" && adsFail ? null : 5,
          ...(expected.store === "A" && adsFail ? { paidError: "广告暂不可用" } : {}) };
      }
    }
  };
  let collector = createLive2Collector({ ...deps, published: learnFrom === "cooldown" ? [{ shop: "A", platformLimited: true,
    platformSessionVersion: version, platformFailures: 1, platformRetryAt: time }] : [] });
  const round = async () => { calls.length = 0; await collector.start(""); await pending; return (await collector.board("")).records; };
  for (let i = 0; i < 3; i++) {
    if (i === 2) { time += 24 * 3600000; sampleAvailable = true; collector = createLive2Collector(deps); }
    const rows = await round();
    assert.deepEqual(calls, [i === 0 && learnFrom === "native_identity" ? "identity:A" : "browser:A", "metrics:A", "identity:B", "metrics:B"], "success must not send the next round back to the rejected legacy path");
    assert.equal(rows.find(r => r.shop === "A").liveAmount, 100 + browserReads);
    assert.equal(rows.find(r => r.shop === "A").platformLimited, undefined);
    time += 10 * 60000;
  }
  adsFail = true;
  const partial = (await round()).find(r => r.shop === "A");
  assert.equal(partial.adsFailed, true);
  assert.deepEqual(calls, ["browser:A", "metrics:A", "identity:B", "metrics:B"]);
  adsFail = false; time += 10 * 60000;
  collector = createLive2Collector(deps);
  await round();
  assert.deepEqual(calls, ["browser:A", "metrics:A", "identity:B", "metrics:B"], "an advertising failure must not discard the verified trade route");
  blocked = true;
  let rows = await round();
  assert.equal(rows.find(r => r.shop === "A").platformLimited, true);
  assert.equal(rows.find(r => r.shop === "A").platformLimitSource, "browser_trade");
  assert.deepEqual(calls, ["browser:A", "identity:B", "metrics:B"], "an actual browser limit still stops the shop");
  time += 10 * 60000;
  collector = createLive2Collector(deps);
  await round();
  assert.deepEqual(calls, ["identity:B", "metrics:B"], "the persisted route must never bypass cooldown");
  // An explicitly saved new login is a different session, not the old preference.
  await saveSession("A", { cookies: cookies("A-new-login"), authState: "ok", enabled: true, shopId: "A" });
  blocked = false; expectPreferred = false;
  rows = await round();
  assert.deepEqual(calls, ["identity:A", "metrics:A", "identity:B", "metrics:B"]);
  assert.equal(rows.find(r => r.shop === "A").online, true);
});
}
