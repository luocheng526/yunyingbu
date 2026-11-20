import "./_memory-env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { EventEmitter } from "node:events";
import { assertPageShopIdentity, cookieParams, pageShopIdentity, sessionReady } from "../src/modules/home/jingmai-desk.js";
import { fetchHome } from "../src/modules/home/jingmai-client.js";
import { extractShopDeal, homeDealUnavailable, shopDealUnavailable, parseHomeCard } from "../src/modules/home/jingmai.js";
import { live2RecordFromMetrics } from "../src/modules/home/live2.js";
import { normalizeOrgShops } from "../src/modules/home/org-roster.js";
import { patchHomeClientSource } from "../src/modules/home/router.js";
import { claimCollectorOwner, getSession, resetJingmaiStore, saveSession } from "../src/modules/home/jingmai-store.js";
import * as shen from "../src/modules/shen/jingmai-store.js";

const source = readFileSync(new URL("../src/modules/home/jingmai-desk.js", import.meta.url), "utf8");
const extract = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start))).replace(/^export /, "");
const readBrowser = extract("async function readHomeDealNow", "export async function readJztOverview");
const readCookies = extract("async function readCookies", "function hasSession");
const jar = value => [{ name: "thor", value, domain: ".jd.com", path: "/", secure: true }];

async function browserCase({ resident = "resident-new", saved = "database-old", name = "本店旗舰店", pageId = "", merchantId = "", unavailable = false, lateRedirect = false, response = null, limits = {} } = {}) {
  const input = saved ? jar(saved) : [];
  let browserJar = resident ? jar(resident) : [], href = "about:blank";
  const commands = [], cookieReads = [];
  let locationReads = 0;
  const context = vm.createContext({
    input, signal: new AbortController().signal, expected: { store: "本店旗舰店", shopId: "1", requireIdentity: true },
    normalizeDealExpected: x => x, profileIdentity: () => ({ key: "p_1", ephemeral: false }),
    isForbiddenLegacyProfileKey: () => false, launchChrome: async () => ({ ws: {} }), discard: () => {},
    watchVaneIdentity: () => ({ read: () => ({}), stop: () => {} }), watchShopData: () => response ? Promise.resolve(JSON.stringify(response)) : unavailable ? Promise.resolve("") : new Promise(() => {}),
    watchPlatformLimits: () => ({ read: () => limits, stop: () => {} }),
    send: async (_ws, method, params) => {
      commands.push(method);
      if (method === "Network.setCookies") browserJar = params.cookies;
      if (method === "Network.getCookies") { cookieReads.push(params); return { cookies: browserJar }; }
      if (method === "Page.navigate") {
        href = params.url;
        if (href.includes("/jdm/home")) {
          if (!browserJar.length || browserJar[0].value === "expired") href = "https://passport.jd.com/login";
          else browserJar = jar("browser-renewed");
        }
      }
      return {};
    },
    sleepSignal: async () => {}, waitDomContentLoaded: async () => {}, evaluate: async () => {
      locationReads++;
      return lateRedirect && locationReads > 1 ? "https://passport.shop.jd.com/login/index.action/jdm" : href;
    },
    readShopBaseName: async () => name,
    readShopBaseIdentity: async () => ({ shopName: name, shopId: pageId, merchantId }), assertPageShopIdentity, cookieParams,
    normalizeCookie: x => x, hasSession: x => x.some(c => c.name === "thor"),
    parseHomeCard, homeDealUnavailable, shopDealUnavailable, extractShopDeal,
    homeCardText: async () => response ? "正在加载中..." : "经营数据\n成交金额\n" + (unavailable ? "—" : "100") + "\n成交单量\n1\n成交客户数\n1"
  });
  const outcome = vm.runInContext(readCookies + "\n" + readBrowser + "\nreadHomeDealNow(input, signal, expected)", context);
  return { outcome, input, commands, cookieReads };
}

const tradeResponse = value => ({ code: 200, data: { refreshTime: "2026-11-21 00:02:00", modules: [{
  moduleCode: "deal", indicators: ["OrdAmt", "OrdNum", "OrdCustNum"].map(code => ({ code, value }))
}] } });

test("a browser trade limit preserves the old cookie jar and rejects the reading", async () => {
  const r = await browserCase({ pageId: "1", limits: { deal: "京东提示操作频繁" } });
  await assert.rejects(r.outcome, e => e.code === "platform_limited");
  assert.equal(r.input[0].value, "database-old");
});

test("blocked identity lookup is reported only when the required native shop ID is missing", async () => {
  const missing = await browserCase({ limits: { identity: "京东拦截了当前请求" } });
  await assert.rejects(missing.outcome, e => e.code === "platform_limited");
  const verified = await browserCase({ pageId: "1", limits: { identity: "京东拦截了当前请求" } });
  assert.equal((await verified.outcome).dealAmount, 100);
});

for (const value of ["-", "0", "12"]) {
  test(`current trade response ${value} completes without waiting for the 25-second fallback`, { timeout: 1000 }, async () => {
    const ws = new EventTarget(); let cleared = false;
    const body = JSON.stringify(tradeResponse(value));
    const result = vm.runInNewContext(extract("function watchShopData", "let dealQueue") + "\nwatchShopData(ws)", {
      ws, extractShopDeal, shopDealUnavailable, Buffer,
      setTimeout: () => 1, clearTimeout: () => { cleared = true; }, send: async () => ({ body })
    });
    ws.dispatchEvent(new MessageEvent("message", { data: JSON.stringify({ method: "Network.responseReceived", params: {
      requestId: "trade", response: { url: "https://sff.jd.com/api?api=dsm.jm.data.operationData.findShopData" }
    } }) }));
    ws.dispatchEvent(new MessageEvent("message", { data: JSON.stringify({ method: "Network.loadingFinished", params: { requestId: "trade" } }) }));
    assert.equal(await result, body);
    assert.equal(cleared, true);
  });
}

test("a completed unavailable API response verifies shop identity even while the card is loading", async () => {
  const run = await browserCase({ response: tradeResponse("-"), pageId: "1" });
  const result = await run.outcome;
  assert.equal(result.dealUnavailable, true);
  assert.equal(result.dealAmount, null);
  assert.equal(run.input[0].value, "browser-renewed");
  const wrong = await browserCase({ response: tradeResponse("-"), pageId: "2" });
  await assert.rejects(wrong.outcome, e => e.code === "identity");
  assert.equal(wrong.input[0].value, "database-old");
});

test("non-trade responses cannot end the trade wait even with similar metric fields", async () => {
  const ws = new EventTarget(); let expire, reads = 0;
  const result = vm.runInNewContext(extract("function watchShopData", "let dealQueue") + "\nwatchShopData(ws)", {
    ws, extractShopDeal, shopDealUnavailable, Buffer,
    setTimeout: callback => { expire = callback; return 1; }, clearTimeout: () => {},
    send: async () => { reads++; return { body: JSON.stringify(tradeResponse("-")) }; }
  });
  ws.dispatchEvent(new MessageEvent("message", { data: JSON.stringify({ method: "Network.responseReceived", params: {
    requestId: "ads", response: { url: "https://sff.jd.com/api?api=dsm.jm.data.operationData.findPromoteData" }
  } }) }));
  ws.dispatchEvent(new MessageEvent("message", { data: JSON.stringify({ method: "Network.loadingFinished", params: { requestId: "ads" } }) }));
  expire();
  assert.equal(await result, "");
  assert.equal(reads, 0);
});

test("a numeric current API response can be used before the home card renders", async () => {
  const run = await browserCase({ response: tradeResponse("0"), pageId: "1" });
  assert.equal((await run.outcome).dealAmount, 0);
  assert.equal(run.input[0].value, "browser-renewed");
});

for (const saved of ["database-old", ""]) {
  test(`the persistent browser wins and its renewed scoped session is returned (DB ${saved || "empty"})`, async () => {
    const run = await browserCase({ saved });
    assert.equal((await run.outcome).dealAmount, 100);
    assert.equal(run.commands.includes("Network.setCookies"), false);
    assert.equal(run.input[0].value, "browser-renewed");
    assert.ok(run.cookieReads.every(x => x.urls.includes("https://shop.jd.com/jdm/home")));
  });
}

test("an expired browser profile falls back once to a saved human session", async () => {
  const run = await browserCase({ resident: "expired", saved: "human-new" });
  await run.outcome;
  assert.equal(run.commands.filter(x => x === "Network.setCookies").length, 1);
  assert.equal(run.input[0].value, "browser-renewed");
});

test("a late login-page redirect is an authentication failure, not missing sales", async () => {
  const run = await browserCase({ lateRedirect: true });
  await assert.rejects(run.outcome, e => e.code === "login" && /登录页/.test(e.message));
  assert.equal(run.input[0].value, "database-old");
});

test("a verified unavailable sales card renews the session without inventing zero sales", async () => {
  const run = await browserCase({ unavailable: true, pageId: "1" });
  const metrics = await run.outcome;
  assert.equal(metrics.dealAmount, null);
  assert.equal(metrics.dealUnavailable, true);
  assert.match(metrics.dealNote, /暂未提供/);
  assert.equal(run.input[0].value, "browser-renewed");
  assert.equal(homeDealUnavailable("经营数据\n成交金额\n0"), false);
  assert.equal(homeDealUnavailable("登录\n成交金额\n—"), false);
  assert.equal(homeDealUnavailable("经营数据\n成交金额\n—\n成交金额\n100"), false);
});

test("unavailable sales still allow advertising collection", async () => {
  const metrics = await fetchHome(jar("verified"), async url => {
    if (String(url).includes("pinlist")) return new Response(JSON.stringify({ code: 1, data: { own: [{ userId: 1, shopId: "1", shopName: "本店" }] } }));
    if (String(url).includes("summary/overview")) return new Response(JSON.stringify({ code: 1, data: { summary: [{ index: "cost", value: 0 }] } }));
    return new Response("<html></html>");
  }, null, new AbortController().signal, { store: "本店", shopId: "1", browserDeal: { dealAmount: null, dealUnavailable: true, dealNote: "平台暂未提供成交" } });
  assert.equal(metrics.dealAmount, null);
  assert.equal(metrics.paidAmount, 0);
  assert.equal(metrics.dealNote, "平台暂未提供成交");
});

test("a verified session with neither metric reports missing platform data, not logout", async () => {
  await assert.rejects(fetchHome(jar("verified"), async () => new Response(JSON.stringify({ code: -100 })), null,
    new AbortController().signal, { store: "本店", shopId: "1", browserDeal: { dealAmount: null, dealUnavailable: true, dealNote: "平台暂未提供成交" } }),
  e => e.code === "data_unavailable" && /平台暂未提供成交/.test(e.message));
});

test("an already logged-in browser returns verified identity without waiting on the password form", async () => {
  const desk = { store: "旧店名", shopId: "1", ws: {} };
  let reads = 0;
  const context = { desk, ticket: 1, current: desk, openTicket: 1, loginVisible: false, lastLaunchNote: "", LOGIN_SCREEN_MESSAGE: "验证",
    sessionReady, assertPageShopIdentity, readShopBaseIdentity: async () => ({ shopName: "新店名", shopId: "1" }),
    readLoginPage: async () => { reads++; return { href: "https://shop.jd.com/jdm/home" }; }, readCookies: async () => jar("session"),
    sleep: async () => assert.fail("an authenticated home page should not wait for a password form") };
  const result = await vm.runInNewContext(extract("async function verifiedDeskSession", "export async function openDesk") + "\nfinishOpen(desk, 'fixture', 'fixture', ticket, false)", context);
  assert.equal(result.status, "ok");
  assert.equal(result.pageMatch, true);
  assert.equal(reads, 1);
});

test("closing a login panel releases its persistent profile before resolving and never clears cookies", async () => {
  const chrome = new EventEmitter(), commands = [], signals = [];
  chrome.exitCode = null;
  chrome.kill = signal => { signals.push(signal); setTimeout(() => { chrome.exitCode = 0; chrome.emit("exit"); }, 1); };
  const context = vm.createContext({ current: { chrome, persistProfile: true, ws: {}, store: "本店" }, openTicket: 0, readerDesk: null,
    loginVisible: true, shotCache: {}, setTimeout, clearTimeout, deskUsable: () => true,
    send: async (_ws, method) => { commands.push(method); }, removeDeskDir: () => {}, stopCurrent: () => assert.fail("must use graceful close") });
  await vm.runInContext(extract("function discard(desk)", "function closeReader()") + "\n" + extract("export async function closeDesk()", "async function readLoginPage") + "\ncloseDesk()", context);
  assert.equal(context.current, null);
  assert.equal(chrome.exitCode, 0);
  assert.deepEqual(signals, ["SIGTERM"]);
  assert.deepEqual(commands, ["Page.navigate"]);
});

for (const name of ["另一店旗舰店", "本店旗舰店二店", ""]) {
  test(`browser identity ${name || "missing"} cannot renew another shop's session`, async () => {
    const run = await browserCase({ name });
    await assert.rejects(run.outcome, e => e.code === "identity");
    assert.equal(run.input[0].value, "database-old");
  });
}

test("legacy home data reads do not start a second collector outside test mode", async () => {
  const paid = readFileSync(new URL("../src/modules/home/local-paid.js", import.meta.url), "utf8");
  const start = paid.indexOf("export async function pullJingmaiPaid");
  const body = paid.slice(start, paid.indexOf("export async function getHomeLocalPaid", start)).replace("export async", "async");
  let starts = 0;
  await vm.runInNewContext(body + "\npullJingmaiPaid()", {
    process: { env: {}, argv: ["node", "server.js"] }, startJingmaiCollector: () => { starts++; },
    jingmaiLive: async () => ({ shops: [] }), packJingmaiShops: x => x
  });
  assert.equal(starts, 0);
});

test("legacy Shen automatic save cannot overwrite an active home session", async () => {
  await resetJingmaiStore();
  await saveSession("本店", { cookies: jar("human"), enabled: true, authState: "ok" });
  await claimCollectorOwner("本店", "home");
  const previous = globalThis.__homeLive2Started;
  globalThis.__homeLive2Started = true;
  try {
    await shen.saveSession("本店", { cookies: [], authState: "login_expired", enabled: true });
    await shen.markAuth("本店", "offline", "old task");
    assert.deepEqual(await shen.listCollectTargets(), []);
    assert.equal((await getSession("本店")).cookies[0].value, "human");
    assert.equal((await getSession("本店")).authState, "ok");
  } finally {
    if (previous === undefined) delete globalThis.__homeLive2Started;
    else globalThis.__homeLive2Started = previous;
  }
});

test("duplicate merchant IDs require shop-specific evidence without changing org IDs", () => {
  const shops = normalizeOrgShops(["甲旗舰店", "乙旗舰店"].map((storeName, i) => ({ storeName, shopId: String(i + 1), merchantId: "9", statusKey: "operating" })));
  assert.ok(shops.every(x => x.ambiguousMerchant));
  assert.throws(() => assertPageShopIdentity({ ...shops[0], requireIdentity: true }, "", { venderId: "9" }), e => e.code === "identity");
  assert.throws(() => assertPageShopIdentity({ ...shops[0], shopId: "9", requireIdentity: true }, "", { venderId: "9" }), e => e.code === "identity");
});

test("the observed JD shop ID validates an internal label despite the changed official name", () => {
  const actual = pageShopIdentity("ZYUO洗护瑞思拓专卖店", "店铺信息\n商家ID：\n150078094\n店铺ID：\n150078094\n店铺层级：\nL2");
  assert.deepEqual(actual, { shopName: "ZYUO洗护瑞思拓专卖店", shopId: "150078094", merchantId: "150078094" });
  assert.doesNotThrow(() => assertPageShopIdentity({ store: "ZYUO洗护旗舰店", shopId: "150078094", requireIdentity: true }, actual.shopName, actual));
});

test("a browser with the same immutable shop ID can renew a renamed shop", async () => {
  const run = await browserCase({ name: "本店新名称专卖店", pageId: "1" });
  assert.equal((await run.outcome).dealAmount, 100);
  assert.equal(run.input[0].value, "browser-renewed");
});

test("a matching shop name cannot override a conflicting labeled shop ID", async () => {
  const run = await browserCase({ pageId: "2", merchantId: "1" });
  await assert.rejects(run.outcome, e => e.code === "identity");
  assert.equal(run.input[0].value, "database-old");
});

test("shared merchants require the actual shop ID, not the shared merchant number", () => {
  const expected = { store: "旧名称", shopId: "1", merchantId: "9", ambiguousMerchant: true, requireIdentity: true };
  assert.doesNotThrow(() => assertPageShopIdentity(expected, "新名称", pageShopIdentity("新名称", "商家ID：9\n店铺ID：1")));
  assert.throws(() => assertPageShopIdentity(expected, "旧名称", pageShopIdentity("旧名称", "商家ID：9\n店铺ID：2")), e => e.code === "identity");
  assert.throws(() => assertPageShopIdentity(expected, "新名称", pageShopIdentity("新名称", "商家ID：9")), e => e.code === "identity");
});

test("multiple labeled shop IDs are ambiguous and never selected arbitrarily", () => {
  assert.equal(pageShopIdentity("本店", "店铺ID：1\n店铺ID：2").shopId, "");
  assert.throws(() => assertPageShopIdentity({ store: "本店", shopId: "1", requireIdentity: true }, "本店", pageShopIdentity("本店", "店铺ID：1\n店铺ID：2")), e => e.code === "identity");
  assert.equal(pageShopIdentity("本店", "商家ID：1").shopId, "");
  assert.equal(pageShopIdentity("本店", "店铺ID：1\n店铺ID：1").shopId, "1");
});

test("browser recovery reuses its verified deal and sends renewed cookies to ads", async () => {
  const seen = [];
  const metrics = await fetchHome(jar("browser-renewed"), async (url, init) => {
    seen.push(String(url));
    assert.match(init.headers.Cookie || init.headers.cookie || "", /thor=browser-renewed/);
    if (String(url).includes("pinlist")) return new Response(JSON.stringify({ code: 1, data: { own: [{ userId: 1, shopId: "1", shopName: "本店" }] } }));
    if (String(url).includes("summary/overview")) return new Response(JSON.stringify({ code: 1, data: { summary: [{ index: "cost", value: 12 }] } }));
    return new Response("<html></html>");
  }, () => assert.fail("the verified browser card must not be collected twice"), new AbortController().signal,
  { store: "本店", shopId: "1", browserDeal: { dealAmount: 100 } });
  assert.equal(metrics.dealAmount, 100);
  assert.equal(metrics.paidAmount, 12);
  assert.ok(seen.some(x => x.includes("summary/overview")));
  assert.ok(seen.every(x => !/findShopDataByChannel|realtimeSummary/.test(x)));
});

test("a browser identity mismatch cannot become a paid-only success", async t => {
  const retry = process.env.SHEN_DEAL_RETRY_MS;
  process.env.SHEN_DEAL_RETRY_MS = "0";
  t.after(() => { if (retry == null) delete process.env.SHEN_DEAL_RETRY_MS; else process.env.SHEN_DEAL_RETRY_MS = retry; });
  const seen = [];
  await assert.rejects(fetchHome(jar("saved"), async url => {
    seen.push(String(url));
    return new Response(JSON.stringify({ code: 601, msg: "非法请求拦截" }));
  }, async () => { throw Object.assign(new Error("店铺不一致"), { code: "identity" }); }, new AbortController().signal,
  { store: "本店", shopId: "1" }), e => e.code === "identity");
  assert.ok(seen.every(x => !x.includes("jzt.jd.com") && !x.includes("jzt-api.jd.com")));
});

test("persistent Chrome gets a graceful close and cancels the forced-close timer on exit", () => {
  const chrome = new EventEmitter(), signals = [];
  chrome.exitCode = null;
  chrome.kill = signal => signals.push(signal);
  let timeout, cleared = false, removed = false;
  vm.runInNewContext(extract("function discard(desk)", "function closeReader()") + "\ndiscard(desk)", {
    desk: { chrome, persistProfile: true }, current: null, stopCurrent: () => {},
    removeDeskDir: () => { removed = true; },
    setTimeout: fn => { timeout = fn; return { unref() {} }; }, clearTimeout: () => { cleared = true; }
  });
  assert.deepEqual(signals, ["SIGTERM"]);
  assert.equal(typeof timeout, "function");
  chrome.exitCode = 0;
  chrome.emit("exit");
  assert.equal(cleared, true);
  assert.equal(removed, true);
  assert.deepEqual(signals, ["SIGTERM"]);
});

test("a paid-only result is visibly incomplete, with an independent timestamp", () => {
  const row = live2RecordFromMetrics({ store: "本店" }, { paidAmount: 0, dealNote: "成交接口未返回金额" }, "2026/11/20 19:00:00");
  assert.equal(row.online, false);
  assert.equal(row.dealFailed, true);
  assert.equal(row.dealCapturedAt, "");
  assert.equal(row.adsCapturedAt, "2026/11/20 19:00:00");
  const page = patchHomeClientSource(readFileSync(new URL("../public/shared/modules/home.js", import.meta.url), "utf8"));
  const start = page.indexOf("  function liveLinkOf(row) {");
  const fn = page.slice(start, page.indexOf("  function liveShopCellHtml", start));
  assert.equal(vm.runInNewContext(fn + "\nliveLinkOf(row).label", { row, liveScope: "live2" }), "成交异常");
  const unavailable = { ...row, dataUnavailable: true, partialData: false, offline: false, offlineReason: "平台暂未提供数据" };
  assert.equal(vm.runInNewContext(fn + "\nliveLinkOf(row).label", { row: unavailable, liveScope: "live2" }), "平台缺数");
});
