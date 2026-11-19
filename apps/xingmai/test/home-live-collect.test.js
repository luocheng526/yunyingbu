import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Unit tests use the in-process map unless a fake/real pool is injected.
if (process.env.SHEN_JINGMAI_MEMORY == null) {
  process.env.SHEN_JINGMAI_MEMORY = "1";
}
import {
  beijingParts,
  buildLiveView,
  collectAuthDecision,
  collectPinRecords,
  filterPinsBelongingToShop,
  matchCollectIdentity,
  runTick,
  sampleFields,
  shouldCollectShop,
  withDeadline
} from "../src/modules/home/jingmai.js";
import {
  absorbCookies,
  cookieHeader,
  cookieMatchesUrl,
  defaultCookiePath,
  fetchHome,
  parseSetCookieLine
} from "../src/modules/home/jingmai-client.js";
import {
  cookieParams,
  isForbiddenLegacyProfileKey,
  normalizeCookie,
  profileIdentity,
  rememberProfileBinding,
  safeProfileKey
} from "../src/modules/home/jingmai-desk.js";
import {
  classifySessionRecovery,
  getSession,
  listCollectTargets,
  listSessions,
  markAuth,
  resetJingmaiStore,
  saveSample,
  saveSession,
  sessionVersionOf,
  setJingmaiPoolForTests,
  updateSessionCookies
} from "../src/modules/home/jingmai-store.js";

test("paid-only failures do not expire the whole shop login", () => {
  const paid = collectAuthDecision({ code: "paid", message: "京准通没有可用账号 -100 登录失败，请刷新页面重新登录" });
  assert.equal(paid.authState, "offline");
  assert.match(paid.authMessage, /京准通/);
  assert.notEqual(paid.authState, "login_expired");
});

test("timeout keeps the session and only marks collection offline", () => {
  const row = collectAuthDecision({ code: "timeout", message: "采集超时" });
  assert.equal(row.authState, "offline");
  assert.match(row.authMessage, /采集超时/);
});

test("true login failures still expire the session", () => {
  const row = collectAuthDecision({ code: "login", message: "anything" });
  assert.equal(row.authState, "login_expired");
  assert.equal(row.authMessage, "登录已失效，请重新登录");
});

test("a deal sample stays even when paid note is attached", () => {
  const fields = sampleFields({
    dealAmount: 12,
    paidAmount: null,
    paidNote: "京准通没有可用账号 -100"
  });
  assert.equal(fields.dealAmount, 12);
  assert.match(fields.dealNote, /京准通/);
});

test("stale shops keep the last capture time while offline", () => {
  const now = { day: "2026-11-19", stamp: "2026-11-19 09:20:00" };
  const view = buildLiveView({
    now: now,
    shops: [
      {
        store: "DIKTT个护健康旗舰店",
        enabled: true,
        cookies: [{ name: "thor", value: "alive" }],
        authState: "offline",
        authMessage: "京准通没有可用账号 -100",
        linkedAt: "2026-11-19 08:00:00"
      }
    ],
    samples: [
      {
        store: "DIKTT个护健康旗舰店",
        day: "2026-11-19",
        capturedAt: "2026-11-19 08:25:45",
        dealAmount: 1207,
        paidAmount: 279,
        ok: true
      }
    ]
  });
  assert.equal(view.shops[0].offline, true);
  assert.equal(view.shops[0].loginExpired, false);
  assert.equal(view.shops[0].capturedAt, "2026/11/19 08:25:45");
  assert.match(view.shops[0].offlineReason, /京准通/);
});

test("fetchHome keeps deal data when Jingzhuntong pinlist returns -100", async () => {
  const jar = [{ name: "thor", value: "ok" }];
  const fetchImpl = async (url, init) => {
    const href = String(url);
    if (href.includes("jzt.jd.com/custom-report")) {
      return new Response("<html></html>", { status: 200, headers: { "content-type": "text/html" } });
    }
    if (href.includes("pinlist")) {
      return new Response(JSON.stringify({ code: -100, msg: "登录失败，请刷新页面重新登录" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    if (href.includes("realtimeSummary") || href.includes("getSummary")) {
      return new Response(
        JSON.stringify({
          code: 200,
          content: { ordAmt: 88, ordCnt: 2, custCnt: 1 }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }
    if (href.includes("sff.jd.com")) {
      return new Response(JSON.stringify({ code: 200, data: {} }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
  };
  const metrics = await fetchHome(jar, fetchImpl, async () => ({ dealAmount: 88, orderCount: 2, customerCount: 1 }));
  assert.equal(metrics.dealAmount, 88);
  assert.equal(metrics.paidAmount, null);
  assert.match(String(metrics.paidNote || ""), /京准通/);
});

test("beijing clock helper stays available for collector stamps", () => {
  const parts = beijingParts(new Date("2026-11-19T01:00:00Z"));
  assert.equal(parts.day, "2026-11-19");
});

test("withDeadline aborts the in-flight work and does not leave it running", async () => {
  let aborted = false;
  let finishedAfterAbort = false;
  const error = await withDeadline(
    function (signal) {
      return new Promise(function (resolve, reject) {
        signal.addEventListener(
          "abort",
          function () {
            aborted = true;
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
          },
          { once: true }
        );
        setTimeout(function () {
          if (!signal.aborted) {
            finishedAfterAbort = true;
            resolve("late");
          }
        }, 200);
      });
    },
    40,
    "采集超时"
  ).then(
    function () {
      return null;
    },
    function (err) {
      return err;
    }
  );
  assert.equal(error && error.code, "timeout");
  assert.equal(aborted, true);
  await new Promise(function (resolve) {
    setTimeout(resolve, 250);
  });
  assert.equal(finishedAfterAbort, false);
});

test("fetchHome cancels hanging paid and deal requests when the collect signal aborts", async () => {
  let dealAborted = false;
  let paidAborted = false;
  const controller = new AbortController();
  const fetchImpl = async (url, init) => {
    const href = String(url);
    const signal = init && init.signal;
    return await new Promise(function (resolve, reject) {
      const timer = setTimeout(function () {
        resolve(new Response("{}", { status: 200, headers: { "content-type": "application/json" } }));
      }, 5000);
      if (!signal) {
        return;
      }
      signal.addEventListener(
        "abort",
        function () {
          clearTimeout(timer);
          if (href.includes("jzt") || href.includes("pinlist") || href.includes("overview")) {
            paidAborted = true;
          } else {
            dealAborted = true;
          }
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        },
        { once: true }
      );
    });
  };
  const pending = fetchHome([{ name: "thor", value: "ok" }], fetchImpl, null, controller.signal).then(
    function () {
      return null;
    },
    function (err) {
      return err;
    }
  );
  await new Promise(function (resolve) {
    setTimeout(resolve, 30);
  });
  controller.abort();
  const error = await pending;
  assert.equal(error && error.code, "timeout");
  assert.equal(dealAborted || paidAborted, true);
});

test("restart helper keeps the exact sudoers argv and requires verify helpers", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(join(here, "../src/modules/releases/restart.js"), "utf8");
  const spawnMatch = source.match(/spawn\(\s*"\/usr\/bin\/sudo"\s*,\s*\[([\s\S]*?)\]\s*,/);
  assert.ok(spawnMatch, "sudo spawn argv list missing");
  const argv = spawnMatch[1];
  assert.match(argv, /"\/usr\/bin\/systemctl"/);
  assert.match(argv, /"restart"/);
  assert.match(argv, /"mengkai\.service"/);
  assert.doesNotMatch(argv, /no-block/);
  assert.doesNotMatch(argv, /systemd-run/);
  assert.match(source, /dispatched_unverified/);
  assert.match(source, /verifyMengkaiRestart/);
  assert.match(source, /probeMengkaiHealth/);
  assert.doesNotMatch(source, /Treat as scheduled/);
});

test("classifySessionRecovery never auto-enables paused shops and lists empty-jar reauth", () => {
  const split = classifySessionRecovery(
    [
      {
        store: "停用店",
        enabled: false,
        authState: "login_expired",
        cookies: [{ name: "thor", value: "1" }]
      },
      {
        store: "可复核",
        enabled: true,
        authState: "login_expired",
        cookies: [{ name: "thor", value: "1", domain: ".jd.com" }],
        shopId: "1"
      },
      {
        store: "需重登",
        enabled: true,
        authState: "login_expired",
        cookies: [],
        authMessage: "登录已失效，请重新登录",
        shopId: "2"
      },
      {
        store: "在线",
        enabled: true,
        authState: "ok",
        cookies: [{ name: "thor", value: "1" }]
      }
    ],
    new Set()
  );
  assert.equal(split.paused.length, 1);
  assert.equal(split.paused[0].store, "停用店");
  assert.equal(split.recheck.length, 1);
  assert.equal(split.recheck[0].store, "可复核");
  assert.equal(split.needsReauth.length, 1);
  assert.equal(split.needsReauth[0].store, "需重登");
  assert.equal(split.active.length, 1);
});

test("listCollectTargets includes login_expired jars and skips empty jars / paused", async () => {
  await resetJingmaiStore();
  await saveSession("有jar过期", {
    cookies: [{ name: "thor", value: "1" }],
    authState: "login_expired",
    enabled: true,
    shopId: "a"
  });
  await saveSession("空jar过期", {
    cookies: [],
    authState: "login_expired",
    enabled: true,
    shopId: "b"
  });
  await saveSession("人工暂停", {
    cookies: [{ name: "thor", value: "1" }],
    authState: "ok",
    enabled: false,
    shopId: "c"
  });
  const targets = await listCollectTargets();
  const names = targets.map(function (row) {
    return row.store;
  });
  assert.ok(names.includes("有jar过期"));
  assert.ok(!names.includes("空jar过期"));
  assert.ok(!names.includes("人工暂停"));
});

test("listHomeCollectTargets skips Shen-owned shops and keeps manual pause", async () => {
  const {
    listHomeCollectTargets,
    isShenOwnedShop,
    resetJingmaiDeps,
    setJingmaiDeps
  } = await import("../src/modules/home/jingmai-runner.js");
  await resetJingmaiStore();
  resetJingmaiDeps();
  await saveSession("沈店A", {
    cookies: [{ name: "thor", value: "1" }],
    authState: "ok",
    enabled: true,
    shopId: "s1"
  });
  await saveSession("韩店B", {
    cookies: [{ name: "thor", value: "2" }],
    authState: "ok",
    enabled: true,
    shopId: "h1"
  });
  await saveSession("沈店暂停", {
    cookies: [{ name: "thor", value: "3" }],
    authState: "ok",
    enabled: false,
    shopId: "s2"
  });
  assert.equal(isShenOwnedShop({ team: "沈子晗组", manager: "" }), true);
  assert.equal(isShenOwnedShop({ team: "韩梦凯组", manager: "韩梦凯" }), false);
  setJingmaiDeps({
    loadOrg: async () => [
      { store: "沈店A", team: "沈子晗组", manager: "沈子晗", login: "a", password: "a", enabled: true },
      { store: "韩店B", team: "韩梦凯组", manager: "韩梦凯", login: "b", password: "b", enabled: true },
      { store: "沈店暂停", team: "沈子晗组", manager: "沈子晗", login: "c", password: "c", enabled: false }
    ]
  });
  const targets = await listHomeCollectTargets();
  const names = targets.map((row) => row.store);
  assert.deepEqual(names, ["韩店B"]);
  resetJingmaiDeps();
});

test("cookieParams keeps real domain/path/expiry and only defaults legacy name/value jars", () => {
  const full = cookieParams([
    {
      name: "thor",
      value: "abc",
      domain: ".shop.jd.com",
      path: "/jdm",
      expires: 1900000000,
      secure: true,
      httpOnly: true,
      sameSite: "Lax"
    }
  ])[0];
  assert.equal(full.domain, ".shop.jd.com");
  assert.equal(full.path, "/jdm");
  assert.equal(full.expires, 1900000000);
  assert.equal(full.sameSite, "Lax");
  const legacy = cookieParams([{ name: "thor", value: "abc" }])[0];
  assert.equal(legacy.domain, ".jd.com");
  assert.equal(legacy.path, "/");
  assert.equal(normalizeCookie({ name: "x", value: "1", domain: ".jzt.jd.com" }).domain, ".jzt.jd.com");
  // hostOnly must not widen to .jd.com for CDP.
  const hostOnly = cookieParams([
    { name: "sid", value: "test-only", hostOnly: true, host: "passport.jd.com", path: "/" }
  ])[0];
  assert.equal(hostOnly.domain, undefined);
  assert.equal(hostOnly.url, "https://passport.jd.com/");
  assert.equal(hostOnly.path, "/");
  // Non-legacy without domain/host: drop instead of inventing .jd.com.
  assert.equal(cookieParams([{ name: "x", value: "1", path: "/x", secure: true }]).length, 0);
});

test("hostOnly jar survives client absorb → DB → cookieParams for CDP", async () => {
  process.env.SHEN_JINGMAI_MEMORY = "1";
  await resetJingmaiStore();
  const jar = [];
  absorbCookies(
    {
      url: "https://passport.jd.com/login",
      headers: {
        getSetCookie: function () {
          return ["sid=test-only; Path=/; Secure"];
        }
      }
    },
    jar,
    "https://passport.jd.com/login"
  );
  assert.equal(jar[0].hostOnly, true);
  assert.equal(jar[0].host, "passport.jd.com");
  await saveSession("hostOnly店", {
    cookies: jar,
    authState: "ok",
    enabled: true,
    shopId: "42"
  });
  const row = (await listSessions()).find(function (item) {
    return item.store === "hostOnly店";
  });
  assert.equal(row.cookies[0].hostOnly, true);
  assert.equal(row.cookies[0].host, "passport.jd.com");
  const cdp = cookieParams(row.cookies)[0];
  assert.equal(cdp.domain, undefined);
  assert.equal(cdp.url, "https://passport.jd.com/");
  assert.notEqual(cdp.domain, ".jd.com");
  // Direct normalize must keep hostOnly fields (regression for 6b04000 call shape).
  const normalized = normalizeCookie({
    name: "sid",
    value: "test-only",
    hostOnly: true,
    host: "passport.jd.com",
    path: "/"
  });
  assert.equal(normalized.hostOnly, true);
  assert.equal(normalized.host, "passport.jd.com");
  assert.equal(normalized.domain, undefined);
});

test("safeProfileKey no longer collapses RASW* / 飒望* shops into RASW or anon", () => {
  const a = profileIdentity({ store: "RASW家居旗舰店" });
  const b = profileIdentity({ store: "RASW健康电器旗舰店" });
  const c = profileIdentity({ store: "飒望日用旗舰店" });
  const d = profileIdentity({ store: "飒望生活日用旗舰店" });
  assert.notEqual(a.key, b.key);
  assert.notEqual(c.key, d.key);
  assert.match(a.key, /^n_[a-f0-9]{40}$/);
  assert.match(c.key, /^n_[a-f0-9]{40}$/);
  assert.notEqual(a.key, "RASW");
  assert.notEqual(a.key, "anon");
  assert.notEqual(c.key, "anon");
  assert.equal(isForbiddenLegacyProfileKey("anon"), true);
  assert.equal(isForbiddenLegacyProfileKey("RASW"), true);
  assert.equal(isForbiddenLegacyProfileKey(a.key), false);
  // Same shopId → same p_ key regardless of store label.
  const idA = profileIdentity({ store: "RASW家居旗舰店", shopId: "10001" });
  const idB = profileIdentity({ store: "别名", shopId: "10001" });
  assert.equal(idA.key, idB.key);
  assert.match(idA.key, /^p_[a-f0-9]{40}$/);
  assert.notEqual(idA.key, a.key);
  // Binding maps provisional name key → immutable shopId key.
  const root = mkdtempSync(tmpdir() + "/jm-bind-");
  try {
    mkdirSync(join(root, a.key), { recursive: true });
    writeFileSync(join(root, a.key, "marker"), "keep");
    const bound = rememberProfileBinding(
      { store: "RASW家居旗舰店", shopId: "10001", tenant: "xingmai" },
      root
    );
    assert.equal(bound.from, a.key);
    assert.equal(bound.to, idA.key);
    const map = JSON.parse(readFileSync(join(root, ".profile-bindings.json"), "utf8"));
    assert.equal(map[a.key].to, idA.key);
    assert.equal(map[a.key].shopId, "10001");
    assert.ok(existsSync(join(root, idA.key, "marker")) || existsSync(join(root, a.key, "marker")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  assert.equal(safeProfileKey({ store: "DIKTT潮流护理旗舰店" }), profileIdentity({ store: "DIKTT潮流护理旗舰店" }).key);
  assert.notEqual(safeProfileKey({ store: "DIKTT潮流护理旗舰店" }), "DIKTT");
});

test("cookieHeader matches domain/path/secure/expiry and hostOnly exact host", () => {
  const jar = [
    { name: "thor", value: "all", domain: ".jd.com", path: "/", secure: true, expires: 1900000000 },
    { name: "shop_only", value: "1", domain: ".shop.jd.com", path: "/jdm", secure: true, expires: 1900000000 },
    { name: "http_only_path", value: "2", domain: "passport.jd.com", path: "/login", secure: false, expires: 1900000000 },
    { name: "expired", value: "x", domain: ".jd.com", path: "/", secure: true, expires: 1 },
    {
      name: "hostSession",
      value: "test",
      domain: "passport.jd.com",
      path: "/",
      hostOnly: true,
      host: "passport.jd.com"
    }
  ];
  assert.equal(cookieMatchesUrl(jar[1], "https://shop.jd.com/jdm/home"), true);
  assert.equal(cookieMatchesUrl(jar[1], "https://shop.jd.com/other"), false);
  assert.equal(cookieMatchesUrl(jar[0], "http://jd.com/"), false);
  assert.equal(cookieMatchesUrl(jar[3], "https://sz.jd.com/"), false);
  assert.equal(cookieMatchesUrl(jar[4], "https://passport.jd.com/"), true);
  assert.equal(cookieMatchesUrl(jar[4], "https://sub.passport.jd.com/"), false);
  assert.equal(cookieHeader([jar[4]], "https://sub.passport.jd.com/"), "");
  const forShop = cookieHeader(jar, "https://shop.jd.com/jdm/home");
  assert.match(forShop, /thor=all/);
  assert.match(forShop, /shop_only=1/);
  assert.doesNotMatch(forShop, /http_only_path/);
  assert.doesNotMatch(forShop, /expired=/);
  const forPassport = cookieHeader(jar, "https://passport.jd.com/login/index");
  assert.match(forPassport, /thor=all/);
  assert.match(forPassport, /http_only_path=2/);
  assert.doesNotMatch(forPassport, /shop_only/);
  // Unknown-origin cookies must not spray to arbitrary URLs.
  assert.equal(cookieHeader([{ name: "sid", value: "x" }], "https://example.org/"), "");
  assert.equal(defaultCookiePath("/login/index"), "/login");
});

test("Set-Cookie absorb binds hostOnly from response URL; Max-Age overrides Expires", () => {
  const parsed = parseSetCookieLine("thor=keep; Domain=.jd.com; Path=/; Secure; HttpOnly; SameSite=None");
  assert.equal(parsed.name, "thor");
  assert.equal(parsed.domain, ".jd.com");
  assert.equal(parsed.path, "/");
  assert.equal(parsed.secure, true);
  assert.equal(parsed.httpOnly, true);
  const both = parseSetCookieLine(
    "sid=1; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=3600"
  );
  assert.equal(both.expired, undefined);
  assert.ok(both.expires > Math.floor(Date.now() / 1000));
  const jar = [];
  absorbCookies(
    {
      url: "https://passport.jd.com/login",
      headers: {
        getSetCookie: function () {
          return ["sid=test; Path=/; Secure"];
        }
      }
    },
    jar,
    "https://passport.jd.com/login"
  );
  assert.equal(jar[0].name, "sid");
  assert.equal(jar[0].hostOnly, true);
  assert.equal(jar[0].host, "passport.jd.com");
  assert.equal(jar[0].domain, undefined);
  assert.equal(cookieHeader(jar, "https://example.org/"), "");
  assert.equal(cookieHeader(jar, "https://sub.passport.jd.com/"), "");
  assert.match(cookieHeader(jar, "https://passport.jd.com/"), /sid=test/);
  absorbCookies(
    {
      headers: {
        getSetCookie: function () {
          return ["pt_key=one; Domain=.passport.jd.com; Path=/; Max-Age=3600"];
        }
      }
    },
    jar,
    "https://passport.jd.com/"
  );
  assert.equal(jar.find(function (item) { return item.name === "pt_key"; }).domain, ".passport.jd.com");
  absorbCookies(
    {
      headers: {
        getSetCookie: function () {
          return [
            "pt_key=; Domain=.passport.jd.com; Path=/; Max-Age=0",
            "sid=; Path=/; Max-Age=0"
          ];
        }
      }
    },
    jar,
    "https://passport.jd.com/login"
  );
  assert.equal(jar.find(function (item) { return item.name === "pt_key"; }), undefined);
  assert.equal(jar.find(function (item) { return item.name === "sid"; }), undefined);
});

test("JZT pin ownership requires exact shopId; rejects id conflict and brand substring", () => {
  const records = collectPinRecords({
    own: [
      { userId: 11, shopId: "10001", shopName: "RASW家居旗舰店" },
      { userId: 22, shopId: "10002", shopName: "RASW健康电器旗舰店" },
      { pinId: 33, shopName: "无关店" }
    ]
  });
  assert.equal(records.length, 3);
  const mine = filterPinsBelongingToShop(records, { shopId: "10001", store: "RASW家居旗舰店" });
  assert.equal(mine.length, 1);
  assert.equal(mine[0].pinId, 11);
  const none = filterPinsBelongingToShop(records, { shopId: "99999", store: "不存在的店" });
  assert.equal(none.length, 0);
  const conflict = filterPinsBelongingToShop(
    [{ pinId: 22, shopId: "wrong-id", shopName: "RASW", raw: {} }],
    { shopId: "right-id", store: "RASW家居旗舰店" }
  );
  assert.equal(conflict.length, 0);
  const brandOnly = filterPinsBelongingToShop(
    [{ pinId: 9, shopName: "RASW", raw: {} }],
    { shopId: "right-id", store: "RASW家居旗舰店" }
  );
  assert.equal(brandOnly.length, 0);
});

test("fetchHome keeps finished deal when ads hang until abort", async () => {
  const prev = process.env.SHEN_PAID_BUDGET_MS;
  process.env.SHEN_PAID_BUDGET_MS = "40";
  const controller = new AbortController();
  let dealDone = false;
  try {
    const fetchImpl = async (url, init) => {
      const href = String(url);
      if (href.includes("jzt") || href.includes("pinlist") || href.includes("overview") || href.includes("custom-report")) {
        return await new Promise(function (resolve, reject) {
          const timer = setTimeout(function () {
            resolve(new Response(JSON.stringify({ code: 1, data: {} }), { status: 200 }));
          }, 5000);
          if (init && init.signal) {
            init.signal.addEventListener(
              "abort",
              function () {
                clearTimeout(timer);
                reject(Object.assign(new Error("aborted"), { name: "AbortError", code: "timeout" }));
              },
              { once: true }
            );
          }
        });
      }
      if (href.includes("sff.jd.com") || href.includes("realtimeSummary") || href.includes("getSummary")) {
        return new Response(JSON.stringify({ code: 200, content: {} }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      return new Response("{}", { status: 200 });
    };
    const pending = fetchHome(
      [{ name: "thor", value: "ok", domain: ".jd.com", path: "/" }],
      fetchImpl,
      async function () {
        dealDone = true;
        return { dealAmount: 66, orderCount: 3, customerCount: 2 };
      },
      controller.signal,
      { store: "测店", shopId: "1" }
    );
    await new Promise(function (resolve) {
      setTimeout(resolve, 80);
    });
    assert.equal(dealDone, true);
    const metrics = await pending;
    assert.equal(metrics.dealAmount, 66);
    assert.equal(metrics.orderCount, 3);
    assert.match(String(metrics.paidNote || ""), /超时|待核验|京准通/);
  } finally {
    if (prev == null) {
      delete process.env.SHEN_PAID_BUDGET_MS;
    } else {
      process.env.SHEN_PAID_BUDGET_MS = prev;
    }
  }
});

test("runTick/withDeadline persists deal when ads hang past outer deadline; no orphan requests", async () => {
  const prev = process.env.SHEN_PAID_BUDGET_MS;
  // Paid budget longer than outer round — reproduces withDeadline settling before fetchHome returns.
  process.env.SHEN_PAID_BUDGET_MS = "5000";
  let dealFinished = false;
  let sampleReturned = false;
  let roundOver = false;
  let orphan = 0;
  const samples = [];
  const fetchImpl = async (url, init) => {
    if (roundOver) {
      orphan += 1;
    }
    const href = String(url);
    if (href.includes("jzt") || href.includes("pinlist") || href.includes("overview") || href.includes("custom-report")) {
      return await new Promise(function (resolve, reject) {
        const timer = setTimeout(function () {
          resolve(new Response(JSON.stringify({ code: 1, data: {} }), { status: 200 }));
        }, 5000);
        if (init && init.signal) {
          init.signal.addEventListener(
            "abort",
            function () {
              clearTimeout(timer);
              reject(Object.assign(new Error("aborted"), { name: "AbortError", code: "timeout" }));
            },
            { once: true }
          );
        }
      });
    }
    return new Response(JSON.stringify({ code: 200, content: {} }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  };
  try {
    await runTick({
      inflight: new Set(),
      tickLock: { busy: false },
      collectBudgetMs: 200,
      listTargets: async function () {
        return [
          {
            store: "挂广告店",
            enabled: true,
            authState: "ok",
            cookies: [{ name: "thor", value: "1", domain: ".jd.com", path: "/" }],
            shopId: "1",
            linkedAt: "2026-11-19 10:00:00"
          }
        ];
      },
      fetchAccountIdentity: async function () {
        return { shopId: "1", shopName: "挂广告店" };
      },
      fetchHome: function (cookies, signal, expected) {
        return fetchHome(
          cookies,
          fetchImpl,
          async function () {
            dealFinished = true;
            return { dealAmount: 66, orderCount: 3, customerCount: 2 };
          },
          signal,
          expected
        );
      },
      saveSample: async function (sample) {
        samples.push(sample);
        sampleReturned = true;
      },
      markAuth: async function () {},
      now: function () {
        return { day: "2026-11-19", stamp: "2026-11-19 10:00:00" };
      }
    });
  } finally {
    roundOver = true;
    if (prev == null) {
      delete process.env.SHEN_PAID_BUDGET_MS;
    } else {
      process.env.SHEN_PAID_BUDGET_MS = prev;
    }
  }
  await new Promise(function (resolve) {
    setTimeout(resolve, 120);
  });
  assert.equal(dealFinished, true);
  assert.equal(sampleReturned, true);
  assert.ok(
    samples.some(function (row) {
      return row.dealAmount === 66;
    })
  );
  assert.equal(orphan, 0);
});

test("login_expired shops with cookies are still collected; manual pause is not", () => {
  assert.equal(
    shouldCollectShop({
      store: "A",
      enabled: true,
      authState: "login_expired",
      cookies: [{ name: "thor", value: "1" }]
    }),
    true
  );
  assert.equal(
    shouldCollectShop({
      store: "B",
      enabled: false,
      authState: "ok",
      cookies: [{ name: "thor", value: "1" }]
    }),
    false
  );
  assert.equal(
    shouldCollectShop({
      store: "C",
      enabled: true,
      authState: "login_expired",
      cookies: []
    }),
    false
  );
});

test("markAuth login_expired keeps the cookie jar for recheck migration", async () => {
  process.env.SHEN_JINGMAI_MEMORY = "1";
  await resetJingmaiStore();
  await saveSession("复核店", {
    cookies: [{ name: "thor", value: "keep-me", domain: ".jd.com", path: "/" }],
    authState: "ok",
    shopId: "123"
  });
  await markAuth("复核店", "login_expired", "登录已失效，请重新登录");
  const rows = await listSessions();
  const hit = rows.find(function (row) {
    return row.store === "复核店";
  });
  assert.equal(hit.authState, "login_expired");
  assert.equal(hit.cookies.length, 1);
  assert.equal(hit.cookies[0].value, "keep-me");
});

test("readHomeDealNow aborts by killing its own CDP/browser, not only racing the outer promise", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(join(here, "../src/modules/home/jingmai-desk.js"), "utf8");
  const start = source.indexOf("async function readHomeDealNow");
  const end = source.indexOf("export function readHomeDeal", start + 1);
  assert.ok(start > 0 && end > start);
  const chunk = source.slice(start, end);
  assert.match(chunk, /const killOwn = function/);
  assert.match(chunk, /signal\.addEventListener\("abort", onAbort/);
  assert.match(chunk, /discard\(owned\)/);
  assert.match(chunk, /\} finally \{/);
  assert.match(chunk, /killOwn\(\);/);
  assert.match(chunk, /signal\.removeEventListener\("abort", onAbort\)/);
});

test("runTick rechecks login_expired shops that still have cookies", async () => {
  const seen = [];
  await runTick({
    inflight: new Set(),
    tickLock: { busy: false },
    listTargets: async function () {
      return [
        {
          store: "误标店",
          enabled: true,
          authState: "login_expired",
          authMessage: "京准通没有可用账号 -100",
          cookies: [{ name: "thor", value: "1" }],
          shopId: "9"
        },
        {
          store: "人工暂停",
          enabled: false,
          authState: "ok",
          cookies: [{ name: "thor", value: "1" }]
        }
      ];
    },
    recheckJingmai: async function (shop) {
      seen.push("recheck:" + shop.store);
      return true;
    },
    fetchAccountIdentity: async function () {
      return { shopId: "9", shopName: "误标店" };
    },
    fetchHome: async function (cookies, signal, expected) {
      seen.push("fetch:" + expected.store);
      return { dealAmount: 10, paidAmount: 1 };
    },
    saveSample: async function () {},
    markAuth: async function (store, state) {
      seen.push("auth:" + store + ":" + state);
    },
    now: function () {
      return { day: "2026-11-19", stamp: "2026-11-19 10:00:00" };
    }
  });
  assert.deepEqual(seen, ["recheck:误标店", "fetch:误标店", "auth:误标店:ok"]);
});

test("runTick fair schedule: waiting shops do not burn deadline; failures do not block later shops", async () => {
  const lock = { busy: false };
  const inflight = new Set();
  const finished = [];
  const startedAt = {};
  let live = 0;
  let maxLive = 0;
  const shops = [1, 2, 3, 4, 5].map(function (index) {
    return {
      store: "店" + index,
      enabled: true,
      authState: "ok",
      cookies: [{ name: "thor", value: "店" + index, domain: ".jd.com", path: "/" }],
      shopId: String(index),
      sessionGen: 1,
      linkedAt: "2026-11-19 10:00:00"
    };
  });
  await runTick({
    inflight: inflight,
    tickLock: lock,
    collectConcurrency: 2,
    collectBudgetMs: 200,
    listTargets: async function () {
      return shops;
    },
    fetchAccountIdentity: async function (jar) {
      const thor = (jar || []).find(function (item) {
        return item && item.name === "thor";
      });
      const store = thor && thor.value;
      const shop = shops.find(function (row) {
        return row.store === store;
      });
      return { shopId: shop ? shop.shopId : "", shopName: store || "" };
    },
    fetchHome: async function (cookies, signal, expected) {
      startedAt[expected.store] = Date.now();
      live += 1;
      maxLive = Math.max(maxLive, live);
      if (expected.store === "店2") {
        live -= 1;
        throw Object.assign(new Error("boom"), { code: "network" });
      }
      await new Promise(function (resolve, reject) {
        const timer = setTimeout(resolve, 90);
        signal.addEventListener(
          "abort",
          function () {
            clearTimeout(timer);
            reject(Object.assign(new Error("timeout"), { code: "timeout", name: "AbortError" }));
          },
          { once: true }
        );
      });
      live -= 1;
      finished.push(expected.store);
      return { dealAmount: Number(expected.shopId) };
    },
    saveSample: async function () {},
    markAuth: async function () {},
    now: function () {
      return { day: "2026-11-19", stamp: "2026-11-19 10:00:00" };
    }
  });
  assert.ok(maxLive <= 2);
  assert.ok(finished.indexOf("店1") >= 0);
  assert.ok(finished.indexOf("店5") >= 0);
  assert.equal(finished.indexOf("店2"), -1);
  // Shop 5 started only after earlier slots freed — not at t0 with a burned budget.
  assert.ok(startedAt["店5"] - startedAt["店1"] >= 60);
  const stacked = await runTick({
    inflight: inflight,
    tickLock: { busy: true },
    listTargets: async function () {
      return shops;
    },
    fetchHome: async function () {
      return { dealAmount: 1 };
    },
    saveSample: async function () {},
    markAuth: async function () {},
    now: function () {
      return { day: "2026-11-19", stamp: "2026-11-19 10:00:00" };
    }
  });
  assert.equal(stacked.skipped, true);
  assert.equal(stacked.reason, "previous_round_running");
});

test("updateSessionCookies writes jar for next listSessions without unpausing or clearing shopId", async () => {
  process.env.SHEN_JINGMAI_MEMORY = "1";
  await resetJingmaiStore();
  await saveSession("会话店", {
    cookies: [{ name: "thor", value: "old", domain: ".jd.com", path: "/" }],
    authState: "ok",
    enabled: false,
    shopId: "100"
  });
  const before = (await listSessions()).find(function (row) {
    return row.store === "会话店";
  });
  const beforeVersion = "g:" + String(before.sessionGen);
  const refreshed = [
    { name: "thor", value: "new", domain: ".jd.com", path: "/", host: "jd.com", hostOnly: false }
  ];
  const ok = await updateSessionCookies("会话店", refreshed, {
    sessionVersion: beforeVersion,
    expectedShopId: "100",
    identity: { shopId: "100", shopName: "会话店" }
  });
  assert.equal(ok.updated, true);
  const after = (await listSessions()).find(function (row) {
    return row.store === "会话店";
  });
  assert.equal(after.enabled, false);
  assert.equal(after.shopId, "100");
  assert.equal(after.linkedAt, before.linkedAt);
  assert.equal(after.sessionGen, before.sessionGen);
  assert.equal(after.cookies[0].value, "new");
  // Concurrent newer login (sessionGen bumped) must not be overwritten by stale collect.
  await saveSession("会话店", {
    cookies: [{ name: "thor", value: "login-fresh", domain: ".jd.com", path: "/" }],
    authState: "ok",
    enabled: true,
    shopId: "100"
  });
  const newer = (await listSessions()).find(function (row) {
    return row.store === "会话店";
  });
  assert.ok(Number(newer.sessionGen) > Number(before.sessionGen));
  const denied = await updateSessionCookies(
    "会话店",
    [{ name: "thor", value: "stale-collect", domain: ".jd.com", path: "/" }],
    { sessionVersion: beforeVersion, expectedShopId: "100", identity: { shopId: "100", shopName: "会话店" } }
  );
  assert.equal(denied.updated, false);
  assert.equal(denied.reason, "version_conflict");
  const finalRow = (await listSessions()).find(function (row) {
    return row.store === "会话店";
  });
  assert.equal(finalRow.cookies[0].value, "login-fresh");
  assert.equal(finalRow.enabled, true);
});

test("matchCollectIdentity requires shopId match; recheck mismatch keeps old sample", async () => {
  assert.equal(matchCollectIdentity({ shopId: "right-id", store: "RASW家居旗舰店" }, { shopId: "wrong-id", shopName: "RASW" }).ok, false);
  assert.equal(matchCollectIdentity({ shopId: "right-id", store: "A" }, { shopId: "right-id", shopName: "A" }).ok, true);
  assert.equal(matchCollectIdentity({ shopId: "right-id", store: "A" }, { shopId: "", shopName: "" }).ok, false);
  const samples = [];
  const auths = [];
  await runTick({
    inflight: new Set(),
    tickLock: { busy: false },
    listTargets: async function () {
      return [
        {
          store: "串店",
          enabled: true,
          authState: "ok",
          cookies: [{ name: "thor", value: "1", domain: ".jd.com", path: "/" }],
          shopId: "right-id",
          linkedAt: "2026-11-19 10:00:00"
        }
      ];
    },
    fetchAccountIdentity: async function () {
      return { shopId: "wrong-id", shopName: "别的店" };
    },
    fetchHome: async function () {
      return { dealAmount: 99 };
    },
    saveSample: async function (sample) {
      samples.push(sample);
    },
    markAuth: async function (store, state, message) {
      auths.push({ store: store, state: state, message: message });
    },
    now: function () {
      return { day: "2026-11-19", stamp: "2026-11-19 10:00:00" };
    }
  });
  assert.equal(samples.length, 0);
  assert.equal(auths[0].state, "offline");
  assert.match(String(auths[0].message), /身份不符/);
});

function createJingmaiFakePool() {
  const sessions = new Map();
  const samples = [];
  const sqlLog = [];
  function cloneSession(row) {
    return Object.assign({}, row, { cookie_jar: row.cookie_jar });
  }
  async function query(sql, params = []) {
    const text = String(sql).replace(/\s+/g, " ").trim();
    sqlLog.push({ sql: text, params: params.slice() });
    if (/^CREATE TABLE/i.test(text) || /^ALTER TABLE/i.test(text)) {
      return [{ affectedRows: 0 }, undefined];
    }
    if (/^INSERT INTO shen_jingmai_session/i.test(text) && /session_gen = session_gen \+ 1/i.test(text)) {
      const [store, jar, authState, authMessage, enabled, shopId, linkedAt, updatedAt] = params;
      const existing = sessions.get(store);
      if (!existing) {
        sessions.set(store, {
          store: store,
          cookie_jar: jar,
          auth_state: authState,
          auth_message: authMessage,
          enabled_flag: enabled,
          shop_id: shopId,
          linked_at: linkedAt,
          updated_at: updatedAt,
          session_gen: 1
        });
      } else {
        existing.cookie_jar = jar;
        existing.auth_state = authState;
        existing.auth_message = authMessage;
        existing.enabled_flag = enabled;
        if (shopId) {
          existing.shop_id = shopId;
        }
        existing.linked_at = linkedAt;
        existing.updated_at = updatedAt;
        existing.session_gen = (Number(existing.session_gen) || 0) + 1;
      }
      return [{ affectedRows: 1 }, undefined];
    }
    if (/^UPDATE shen_jingmai_session SET cookie_jar/i.test(text)) {
      const [jar, updatedAt, store, gen] = params;
      const row = sessions.get(store);
      if (!row || Number(row.session_gen) !== Number(gen)) {
        return [{ affectedRows: 0 }, undefined];
      }
      row.cookie_jar = jar;
      row.updated_at = updatedAt;
      return [{ affectedRows: 1 }, undefined];
    }
    if (/^UPDATE shen_jingmai_session SET auth_state/i.test(text)) {
      if (/AND session_gen = \?/i.test(text)) {
        const [authState, authMessage, updatedAt, store, gen] = params;
        const row = sessions.get(store);
        if (!row || Number(row.session_gen) !== Number(gen)) {
          return [{ affectedRows: 0 }, undefined];
        }
        row.auth_state = authState;
        row.auth_message = authMessage;
        row.updated_at = updatedAt;
        return [{ affectedRows: 1 }, undefined];
      }
      const [authState, authMessage, updatedAt, store] = params;
      const row = sessions.get(store);
      if (!row) {
        return [{ affectedRows: 0 }, undefined];
      }
      row.auth_state = authState;
      row.auth_message = authMessage;
      row.updated_at = updatedAt;
      return [{ affectedRows: 1 }, undefined];
    }
    if (/^SELECT .+ FROM shen_jingmai_session WHERE store = \?/i.test(text)) {
      const row = sessions.get(params[0]);
      return [row ? [cloneSession(row)] : [], undefined];
    }
    if (/^SELECT .+ FROM shen_jingmai_session ORDER BY store ASC/i.test(text)) {
      return [[...sessions.values()].map(cloneSession).sort(function (a, b) {
        return String(a.store).localeCompare(String(b.store));
      }), undefined];
    }
    if (/^INSERT INTO shen_jingmai_sample/i.test(text)) {
      samples.push({ params: params.slice(), sql: text });
      return [{ affectedRows: 1 }, undefined];
    }
    if (/^SELECT .+ FROM shen_jingmai_sample/i.test(text)) {
      return [[], undefined];
    }
    if (/^INSERT INTO shen_jingmai_session/i.test(text) && /enabled_flag = VALUES\(enabled_flag\)/i.test(text)) {
      const [store, enabled, linkedAt, updatedAt] = params;
      const existing = sessions.get(store);
      if (!existing) {
        sessions.set(store, {
          store: store,
          cookie_jar: "[]",
          auth_state: "unlinked",
          auth_message: "",
          enabled_flag: enabled,
          shop_id: "",
          linked_at: linkedAt,
          updated_at: updatedAt,
          session_gen: 0
        });
      } else {
        existing.enabled_flag = enabled;
        existing.updated_at = updatedAt;
      }
      return [{ affectedRows: 1 }, undefined];
    }
    throw new Error("unexpected SQL: " + text);
  }
  return {
    query: query,
    sqlLog: sqlLog,
    sessions: sessions,
    samples: samples,
    seed: function (row) {
      sessions.set(row.store, Object.assign({ session_gen: 0, shop_id: "", auth_message: "" }, row));
    }
  };
}

test("SQL pool path: atomic session_gen bump + gen0 CAS; process restart does not rewind gen", async () => {
  process.env.SHEN_JINGMAI_MEMORY = "0";
  const pool = createJingmaiFakePool();
  setJingmaiPoolForTests(pool);
  await resetJingmaiStore();
  pool.seed({
    store: "原子店",
    cookie_jar: JSON.stringify([{ name: "thor", value: "old" }]),
    auth_state: "ok",
    auth_message: "",
    enabled_flag: 1,
    shop_id: "7",
    linked_at: "2026-11-19 10:00:00",
    updated_at: "2026-11-19 10:00:00",
    session_gen: 0
  });
  const cas0 = await updateSessionCookies(
    "原子店",
    [{ name: "thor", value: "from-gen0", domain: ".jd.com", path: "/" }],
    { sessionVersion: "g:0", expectedShopId: "7", identity: { shopId: "7", shopName: "原子店" } }
  );
  assert.equal(cas0.updated, true);
  assert.ok(
    pool.sqlLog.some(function (entry) {
      return /session_gen = \?/.test(entry.sql) && entry.params.indexOf(0) >= 0;
    })
  );
  const first = await saveSession("原子店", {
    cookies: [{ name: "thor", value: "login-1" }],
    authState: "ok",
    enabled: true,
    shopId: "7"
  });
  assert.equal(first.sessionGen, 1);
  assert.ok(
    pool.sqlLog.some(function (entry) {
      return /session_gen = session_gen \+ 1/.test(entry.sql);
    })
  );
  // Simulate process restart: drop process mirror, keep DB gen.
  await resetJingmaiStore();
  setJingmaiPoolForTests(pool);
  const afterRestart = await saveSession("原子店", {
    cookies: [{ name: "thor", value: "login-2" }],
    authState: "ok",
    enabled: true,
    shopId: "7"
  });
  assert.equal(afterRestart.sessionGen, 2);
  assert.ok(afterRestart.sessionGen > first.sessionGen);
  const stale = await markAuth("原子店", "login_expired", "旧任务晚失败", { sessionVersion: "g:1" });
  assert.equal(stale.updated, false);
  assert.equal(stale.reason, "version_conflict");
  const live = await getSession("原子店");
  assert.equal(live.authState, "ok");
  assert.equal(live.cookies[0].value, "login-2");
  setJingmaiPoolForTests(null);
  process.env.SHEN_JINGMAI_MEMORY = "1";
  await resetJingmaiStore();
});

test("runTick reloads after slot: pause/relogin while queued; late login_expired cannot overwrite new login", async () => {
  process.env.SHEN_JINGMAI_MEMORY = "1";
  await resetJingmaiStore();
  await saveSession("排队店", {
    cookies: [{ name: "thor", value: "old", domain: ".jd.com", path: "/" }],
    authState: "ok",
    enabled: true,
    shopId: "55"
  });
  const before = await getSession("排队店");
  const liveShops = {
    慢店: {
      store: "慢店",
      enabled: true,
      authState: "ok",
      cookies: [{ name: "thor", value: "slow", domain: ".jd.com", path: "/" }],
      shopId: "54",
      sessionGen: 1
    },
    排队店: Object.assign({}, before)
  };
  const auths = [];
  const samples = [];
  let releaseSlow;
  const slowGate = new Promise(function (resolve) {
    releaseSlow = resolve;
  });
  const tickPromise = runTick({
    inflight: new Set(),
    tickLock: { busy: false },
    collectConcurrency: 1,
    collectBudgetMs: 2000,
    listTargets: async function () {
      return [liveShops["慢店"], liveShops["排队店"]];
    },
    reloadShop: async function (store) {
      return liveShops[store] || null;
    },
    fetchAccountIdentity: async function (jar) {
      const thor = (jar || []).find(function (item) {
        return item && item.name === "thor";
      });
      if (thor && thor.value === "fresh") {
        return { shopId: "55", shopName: "排队店" };
      }
      if (thor && thor.value === "slow") {
        return { shopId: "54", shopName: "慢店" };
      }
      return { shopId: "55", shopName: "排队店" };
    },
    fetchHome: async function (cookies, signal, expected) {
      if (expected.store === "慢店") {
        releaseSlow();
        await new Promise(function (resolve) {
          setTimeout(resolve, 80);
        });
        return { dealAmount: 1 };
      }
      if (expected.store === "排队店") {
        // Should not fetch if paused; if relogin path runs, use fresh jar only.
        assert.equal(cookies[0].value, "fresh");
        return { dealAmount: 8 };
      }
      return { dealAmount: 0 };
    },
    saveSample: async function (sample) {
      samples.push(sample);
    },
    markAuth: async function (store, state, message, opts) {
      auths.push({ store: store, state: state, message: message, opts: opts });
      if (typeof markAuth === "function") {
        await markAuth(store, state, message, opts);
      }
    },
    now: function () {
      return { day: "2026-11-19", stamp: "2026-11-19 11:00:00" };
    }
  });
  await slowGate;
  // While 慢店 holds the only slot, pause then re-login 排队店.
  liveShops["排队店"] = Object.assign({}, liveShops["排队店"], { enabled: false });
  await new Promise(function (resolve) {
    setTimeout(resolve, 20);
  });
  await saveSession("排队店", {
    cookies: [{ name: "thor", value: "fresh", domain: ".jd.com", path: "/" }],
    authState: "ok",
    enabled: true,
    shopId: "55"
  });
  const newer = await getSession("排队店");
  liveShops["排队店"] = Object.assign({}, newer);
  // Late stale failure from an older collect version must not wipe the new login.
  const late = await markAuth("排队店", "login_expired", "旧采集晚失败", {
    sessionVersion: sessionVersionOf(before)
  });
  assert.equal(late.updated, false);
  assert.equal((await getSession("排队店")).authState, "ok");
  assert.equal((await getSession("排队店")).cookies[0].value, "fresh");
  await tickPromise;
  assert.ok(
    samples.every(function (row) {
      return row.store !== "排队店" || row.dealAmount === 8;
    })
  );
});

test("fetchAccountIdentity missing or timeout refuses unknown shop landing", async () => {
  const auths = [];
  await runTick({
    inflight: new Set(),
    tickLock: { busy: false },
    listTargets: async function () {
      return [
        {
          store: "未知店",
          enabled: true,
          authState: "ok",
          cookies: [{ name: "thor", value: "1", domain: ".jd.com", path: "/" }],
          shopId: "",
          sessionGen: 1
        }
      ];
    },
    fetchHome: async function () {
      return { dealAmount: 1 };
    },
    saveSample: async function () {
      assert.fail("must not save without identity");
    },
    markAuth: async function (store, state, message) {
      auths.push({ state: state, message: message });
    },
    now: function () {
      return { day: "2026-11-19", stamp: "2026-11-19 10:00:00" };
    }
  });
  assert.equal(auths[0].state, "offline");
  assert.match(String(auths[0].message), /身份|无法核对/);
  const timed = [];
  await runTick({
    inflight: new Set(),
    tickLock: { busy: false },
    listTargets: async function () {
      return [
        {
          store: "超时店",
          enabled: true,
          authState: "ok",
          cookies: [{ name: "thor", value: "1", domain: ".jd.com", path: "/" }],
          shopId: "88",
          sessionGen: 1
        }
      ];
    },
    fetchAccountIdentity: async function () {
      throw Object.assign(new Error("timeout"), { code: "timeout" });
    },
    fetchHome: async function () {
      return { dealAmount: 1 };
    },
    saveSample: async function () {
      assert.fail("must not save on identity timeout");
    },
    markAuth: async function (store, state, message) {
      timed.push({ state: state, message: message });
    },
    now: function () {
      return { day: "2026-11-19", stamp: "2026-11-19 10:00:00" };
    }
  });
  assert.equal(timed[0].state, "offline");
});
