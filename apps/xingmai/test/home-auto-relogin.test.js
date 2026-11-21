import "./_memory-env.js";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createLive2Collector, armLive2Schedule } from "../src/modules/home/live2-collect.js";
import { recoverBrowserSession } from "../src/modules/home/jingmai-client.js";
import { recoverPasswordSession } from "../src/modules/home/session-recovery.js";

const jar = value => [{ name: "thor", value }];
const loginError = message => Object.assign(new Error(message || "服务器浏览器已返回京东登录页，请重新登录或完成验证"), { code: "login" });
const form = { href: "https://passport.shop.jd.com/login", accountVisible: true, passwordVisible: true };

function harness(t, extra = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "home-auto-renew-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const state = { time: Date.parse("2026-11-21T09:00:00+08:00"), logins: 0, reads: 0, pending: null,
    session: { store: "A", shopId: "1", sessionGen: 1, authState: "login_expired", cookies: jar("old") } };
  const file = path.join(directory, "board.json");
  const shops = () => [{ store: "A", shopId: "1", enabled: true, login: "fixture", password: "secret-fixture" }];
  const deps = { storePath: file, concurrency: 1, clock: () => state.time,
    now: () => new Date(state.time + 8 * 3600000).toISOString().slice(0, 19).replaceAll("-", "/").replace("T", " "),
    loadOrg: async () => shops(), loadBackgroundOrg: async () => shops(), listSessions: async () => [state.session],
    listSamples: async () => [], claimOwner: async () => ({ ok: true }), saveSample: async () => ({ saved: true }),
    markAuth: async (_store, authState) => { state.session.authState = authState; },
    updateSessionCookies: async (_store, cookies, options) => {
      if (options.sessionVersion !== `g:${state.session.sessionGen}`) return { updated: false, reason: "version" };
      state.session.cookies = cookies.map(c => ({ ...c })); return { updated: true };
    }, track: task => { state.pending = task; },
    client: { recoverBrowserSession: (cookies, signal, hint) => recoverBrowserSession(cookies, signal, hint, {
      readDeal: async cookies => { state.reads++; if (cookies[0]?.value === "old") throw loginError(); return { dealAmount: 100 }; },
      relogin: async () => { state.logins++; return jar("renewed"); }, ...extra.recovery
    }), fetchHome: async () => ({ dealAmount: 100, paidAmount: 5 }), ...extra.client }, ...extra.deps };
  let collector;
  const restart = published => { collector = createLive2Collector({ ...deps, ...(published ? { published } : {}) }); return collector; };
  restart([{ shop: "A", liveAmount: 72, paidAmount: 4, capturedAt: "2026/11/21 08:50:00", loginExpired: true,
    loginSessionVersion: "g:1", passwordAttemptedVersion: "g:1", loginFailures: 1, loginRetryAt: state.time - 1,
    ...extra.row }]);
  return { state, file, deps, restart, current: () => collector, async round() {
    // No logged-in user/browser/API trigger: this is the scheduler's server path.
    await collector.start("", "", true); await state.pending; return collector.published.get("A");
  } };
}

test("a single expired shop with an old attempted marker renews from the background schedule", async t => {
  const h = harness(t);
  let scheduled;
  const schedule = armLive2Schedule({ env: {}, argv: [], gate: {}, hooks: {},
    setTimeout: fn => { scheduled = fn; return { unref() {} }; }, clearTimeout() {},
    startRound: () => h.current().start("", "", true) });
  assert.equal(schedule.started, true);
  await scheduled(); await h.state.pending;
  const row = h.current().published.get("A");
  assert.equal(h.state.logins, 1); assert.equal(row.loginExpired, false);
  assert.equal(row.liveAmount, 100); assert.equal(row.paidAmount, 5);
  assert.equal(h.state.session.cookies[0].value, "renewed");
  assert.equal(row.passwordAttemptedVersion, undefined);
  assert.ok(!fs.readFileSync(h.file, "utf8").includes("secret-fixture"));
});

test("transient password failures retry automatically after a durable cooldown, including restart", async t => {
  let attempts = 0;
  const h = harness(t, { recovery: { relogin: async () => {
    attempts++; const checkpoint = JSON.parse(fs.readFileSync(h.file, "utf8")).records[0];
    assert.ok(checkpoint.loginRetryAt > h.state.time, "persist before password submission");
    if (attempts === 1) throw loginError("自动登录暂未完成，冷却后自动重试");
    return jar("renewed");
  } } });
  let row = await h.round();
  assert.equal(row.liveAmount, 72); assert.equal(row.capturedAt, "2026/11/21 08:50:00");
  assert.equal(row.loginNeedsHuman, false); assert.equal(attempts, 1);
  const until = row.loginRetryAt;
  h.restart(); h.state.time = until - 1; await h.round(); assert.equal(attempts, 1);
  h.restart(); h.state.time = until + 1; row = await h.round();
  assert.equal(attempts, 2); assert.equal(row.loginExpired, false); assert.equal(row.liveAmount, 100);
});

test("verified renewed cookies survive a failed metrics read without publishing invented data", async t => {
  let freshReads = 0;
  const h = harness(t, { recovery: { readDeal: async cookies => {
    if (cookies[0].value === "old" || ++freshReads === 1) throw loginError();
    return { dealAmount: 100 };
  } } });
  let row = await h.round();
  assert.equal(h.state.session.cookies[0].value, "renewed");
  assert.equal(row.liveAmount, 72); assert.equal(row.capturedAt, "2026/11/21 08:50:00");
  h.state.time = row.loginRetryAt + 1; h.restart(); row = await h.round();
  assert.equal(h.state.logins, 1, "reuse saved fresh cookies instead of another login");
  assert.equal(row.loginExpired, false); assert.equal(row.liveAmount, 100);
});

test("watchdog timeout retains the attempt across restart and ignores its late completion", async t => {
  let finish, attempts = 0;
  const h = harness(t, { deps: { shopBudgetMs: 30 }, recovery: { relogin: async () => {
    attempts++; return new Promise(resolve => { finish = resolve; });
  } } });
  let row = await h.round();
  assert.equal(attempts, 1); assert.equal(row.loginExpired, true); assert.ok(row.loginRetryAt > h.state.time);
  h.restart(); await h.round(); assert.equal(attempts, 1);
  finish(jar("late")); await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.state.session.cookies[0].value, "old");
  assert.equal(h.current().published.get("A").liveAmount, 72);
});

test("an explicit challenge remains paused across cooldown and restart", async t => {
  let attempts = 0;
  const h = harness(t, { recovery: { relogin: async () => {
    attempts++; throw Object.assign(loginError("需要验证码"), { needsHuman: true });
  } } });
  const row = await h.round(); assert.equal(row.loginNeedsHuman, true);
  h.state.time += 24 * 3600000; h.restart(); await h.round(); assert.equal(attempts, 1);
});

test("wrong shop identity after password submission holds recovery and preserves the old session", async t => {
  let attempts = 0;
  const h = harness(t, { recovery: { relogin: async () => {
    attempts++; throw Object.assign(new Error("登录店铺与组织中心不一致"), { code: "identity" });
  } } });
  const row = await h.round(); assert.equal(row.loginNeedsHuman, true);
  assert.equal(h.state.session.cookies[0].value, "old"); assert.equal(row.liveAmount, 72);
  h.state.time += 24 * 3600000; h.restart(); await h.round(); assert.equal(attempts, 1);
});

test("repeated transient failures back off to an hour and never become a permanent password lock", async t => {
  let attempts = 0;
  const h = harness(t, { recovery: { relogin: async () => { attempts++; throw loginError("暂时未完成"); } } });
  for (const minutes of [30, 60, 60, 60]) {
    const row = await h.round();
    assert.equal(row.loginRetryAt - h.state.time, minutes * 60000);
    assert.equal(row.loginNeedsHuman, false);
    h.state.time = row.loginRetryAt + 1; h.restart();
  }
  assert.equal(attempts, 4);
});

test("platform restrictions do not turn into password retries", async t => {
  let reads = 0;
  const h = harness(t, { recovery: { readDeal: async () => {
    reads++; throw Object.assign(new Error("京东操作频繁"), { code: "platform_limited" });
  } } });
  let row = await h.round(); assert.equal(row.platformLimited, true); assert.equal(h.state.logins, 0);
  h.restart(); h.state.time = row.platformRetryAt - 1; await h.round(); assert.equal(reads, 1);
  h.state.time++; row = await h.round(); assert.equal(reads, 2); assert.equal(h.state.logins, 0);
});

test("a restriction during login replaces its login cooldown with the durable platform hold", async t => {
  let attempts = 0, limited = false, reads = 0;
  const h = harness(t, { recovery: {
    readDeal: async () => { reads++; if (limited) throw Object.assign(new Error("操作频繁"), { code: "platform_limited" }); throw loginError(); },
    relogin: async () => { attempts++; limited = true; throw Object.assign(new Error("操作频繁"), { code: "platform_limited" }); }
  } });
  let row = await h.round(); assert.equal(row.platformLimited, true); assert.equal(row.loginRetryAt, 0);
  h.state.time = row.platformRetryAt; row = await h.round();
  assert.equal(reads, 2); assert.equal(attempts, 1); assert.equal(row.platformLimited, true);
  assert.equal(row.loginExpired, false);
});

test("slow login pages and incomplete submissions are retryable, not proof of a captcha", async () => {
  let reads = 0, submits = 0;
  const result = await recoverPasswordSession({ page: async () => ++reads < 40 ? { href: "about:blank" } : submits ? { href: "https://shop.jd.com/jdm/home" } : form,
    limit: () => "", sleep: async () => {}, submit: async () => { submits++; return true; }, verifiedSession: async page => page.href.startsWith("https://shop.jd.com/") ? jar("fresh") : null
  }, { loginName: "fixture", password: "fixture" });
  assert.equal(submits, 1); assert.equal(result[0].value, "fresh");
  for (const ready of [false, true]) {
    await assert.rejects(recoverPasswordSession({ page: async () => ready ? form : { href: "about:blank" },
      limit: () => "", sleep: async () => {}, submit: async () => true, verifiedSession: async () => null
    }, { loginName: "fixture", password: "fixture" }), e => e.code === "login" && e.needsHuman === false);
  }
});

test("bulk expiry drains in bounded background batches without blocking healthy shops", async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "home-auto-batch-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const names = ["healthy", ...Array.from({ length: 8 }, (_, i) => `expired-${i}`)];
  const sessions = names.map(store => ({ store, sessionGen: 1, authState: store === "healthy" ? "ok" : "login_expired", cookies: jar(store) }));
  let time = Date.now(), pending; const logins = [], collections = [];
  const c = createLive2Collector({ storePath: path.join(directory, "board.json"), clock: () => time, concurrency: 3,
    loadBackgroundOrg: async () => names.map(store => ({ store, enabled: true, login: "fixture", password: "fixture" })),
    listSessions: async () => sessions, listSamples: async () => [], claimOwner: async () => ({ ok: true }),
    saveSample: async () => ({ saved: true }), markAuth: async (store, authState) => { sessions.find(s => s.store === store).authState = authState; },
    updateSessionCookies: async (store, cookies) => { sessions.find(s => s.store === store).cookies = cookies; return { updated: true }; },
    track: task => { pending = task; }, client: {
      recoverBrowserSession: (cookies, signal, hint) => recoverBrowserSession(cookies, signal, hint, {
        readDeal: async cookies => { if (!cookies[0].value.startsWith("new-")) throw loginError(); return { dealAmount: 100 }; },
        relogin: async (_signal, expected) => { logins.push(expected.store); return jar("new-" + expected.store); }
      }), fetchHome: async (_cookies, _signal, hint) => { collections.push(hint.store); return { dealAmount: 100, paidAmount: 5 }; }
    }
  });
  for (const count of [3, 6, 8]) {
    await c.start("", "", true); await pending;
    assert.equal(logins.length, count); assert.ok(collections.includes("healthy"));
    assert.equal([...c.published.values()].filter(r => r.loginExpired).length, 8 - count);
    time += 10 * 60000;
  }
  assert.equal(new Set(logins).size, 8);
});
