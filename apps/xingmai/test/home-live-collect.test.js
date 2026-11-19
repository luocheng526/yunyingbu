import test from "node:test";
import assert from "node:assert/strict";
import { collectAuthDecision, sampleFields, buildLiveView, beijingParts, withDeadline, shouldCollectShop, runTick } from "../src/modules/home/jingmai.js";
import { fetchHome, parseSetCookieLine, absorbCookies } from "../src/modules/home/jingmai-client.js";
import { cookieParams, normalizeCookie, safeProfileKey } from "../src/modules/home/jingmai-desk.js";
import {
  markAuth,
  resetJingmaiStore,
  saveSession,
  listSessions,
  listCollectTargets,
  classifySessionRecovery
} from "../src/modules/home/jingmai-store.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

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
  assert.equal(safeProfileKey("DIKTT潮流护理旗舰店"), "DIKTT");
  assert.equal(safeProfileKey("12345"), "12345");
});

test("Set-Cookie absorb keeps domain/path attributes for migration", () => {
  const parsed = parseSetCookieLine("thor=keep; Domain=.jd.com; Path=/; Secure; HttpOnly; SameSite=None");
  assert.equal(parsed.name, "thor");
  assert.equal(parsed.domain, ".jd.com");
  assert.equal(parsed.path, "/");
  assert.equal(parsed.secure, true);
  assert.equal(parsed.httpOnly, true);
  const jar = [];
  absorbCookies(
    {
      headers: {
        getSetCookie: function () {
          return ["pt_key=one; Domain=.passport.jd.com; Path=/; Max-Age=3600"];
        }
      }
    },
    jar
  );
  assert.equal(jar[0].domain, ".passport.jd.com");
  assert.ok(jar[0].expires > Math.floor(Date.now() / 1000));
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

test("runTick rechecks login_expired shops that still have cookies", async () => {
  const seen = [];
  await runTick({
    inflight: new Set(),
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
