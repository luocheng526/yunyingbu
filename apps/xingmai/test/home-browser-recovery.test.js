import "./_memory-env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { EventEmitter } from "node:events";
import { assertPageShopIdentity, cookieParams, pageShopIdentity } from "../src/modules/home/jingmai-desk.js";
import { fetchHome } from "../src/modules/home/jingmai-client.js";
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

async function browserCase({ resident = "resident-new", saved = "database-old", name = "本店旗舰店", pageId = "", merchantId = "" } = {}) {
  const input = saved ? jar(saved) : [];
  let browserJar = resident ? jar(resident) : [], href = "about:blank";
  const commands = [], cookieReads = [];
  const context = vm.createContext({
    input, signal: new AbortController().signal, expected: { store: "本店旗舰店", shopId: "1", requireIdentity: true },
    normalizeDealExpected: x => x, profileIdentity: () => ({ key: "p_1", ephemeral: false }),
    isForbiddenLegacyProfileKey: () => false, launchChrome: async () => ({ ws: {} }), discard: () => {},
    watchVaneIdentity: () => ({ read: () => ({}), stop: () => {} }), watchShopData: () => new Promise(() => {}),
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
    sleepSignal: async () => {}, waitDomContentLoaded: async () => {}, evaluate: async () => href,
    readShopBaseName: async () => name,
    readShopBaseIdentity: async () => ({ shopName: name, shopId: pageId, merchantId }), assertPageShopIdentity, cookieParams,
    normalizeCookie: x => x, hasSession: x => x.some(c => c.name === "thor"),
    parseHomeCard: () => ({ dealAmount: 100 }), homeCardText: async () => "成交金额 100", extractShopDeal: () => null
  });
  const outcome = vm.runInContext(readCookies + "\n" + readBrowser + "\nreadHomeDealNow(input, signal, expected)", context);
  return { outcome, input, commands, cookieReads };
}

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
});
