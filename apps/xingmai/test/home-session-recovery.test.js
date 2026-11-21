import "./_memory-env.js";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { recoverPasswordSession } from "../src/modules/home/session-recovery.js";
import { recoverBrowserSession } from "../src/modules/home/jingmai-client.js";
import { createLive2Collector } from "../src/modules/home/live2-collect.js";

const jar = value => [{ name: "thor", value }];
const form = { href: "https://passport.shop.jd.com/login/index.action/jdm", accountVisible: true, passwordVisible: true, text: "账号登录 密码登录 短信登录" };
const credentials = { loginName: "fixture", password: "secret-fixture" };

for (const explicitChallenge of [false, true]) {
test(`old post-login read holds can recheck saved credentials but actual challenges stay held (${explicitChallenge})`, async () => {
  let time = Date.parse("2026-11-21T22:00:00+08:00"), pending, reads = 0;
  const reason = explicitChallenge ? "京东要求验证或拒绝自动登录，请在服务器登录窗口处理" : "服务器浏览器已返回京东登录页，请重新登录或完成验证";
  const c = createLive2Collector({ storePath: "", concurrency: 1, clock: () => time, now: () => "2026/11/21 22:16:00",
    published: [{ shop: "A", liveAmount: 72, paidAmount: 4, loginExpired: true, loginNeedsHuman: true,
      loginSessionVersion: "g:1", passwordAttemptedVersion: "g:1", loginFailures: 1,
      loginRetryAt: time + 15 * 60000, offlineReason: reason }],
    loadOrg: async () => [{ store: "A", shopId: "1", enabled: true, login: "fixture", password: "fixture" }],
    listSessions: async () => [{ store: "A", shopId: "1", authState: "login_expired", sessionGen: 1, cookies: jar("saved") }],
    listSamples: async () => [], claimOwner: async () => ({ ok: true }), saveSample: async () => ({ saved: true }),
    markAuth: async () => {}, track: task => { pending = task; }, client: {
      recoverBrowserSession: async (_cookies, _signal, hint) => { reads++; assert.equal(hint.credentials, undefined); return { cookies: jar("verified"), deal: { dealAmount: 100 } }; },
      fetchHome: async (_cookies, _signal, hint) => { assert.equal(hint.browserDeal.dealAmount, 100); return { dealAmount: 100, paidAmount: 5 }; }
    }
  });
  await c.start(""); await pending; assert.equal(reads, 0, "must respect the original cooldown");
  time += 16 * 60000;
  await c.start(""); await pending;
  assert.equal(reads, explicitChallenge ? 0 : 1);
  const row = (await c.board("")).records[0];
  assert.equal(row.loginExpired, explicitChallenge);
  if (!explicitChallenge) assert.equal(row.liveAmount, 100);
});
}

test("a failed metrics read after verified login is not evidence of a human challenge", async () => {
  let pending;
  const c = createLive2Collector({ storePath: "", now: () => "2026/11/21 22:16:00",
    loadOrg: async () => [{ store: "A", shopId: "1", enabled: true, login: "fixture", password: "fixture" }],
    listSessions: async () => [{ store: "A", shopId: "1", authState: "login_expired", sessionGen: 1, cookies: jar("saved") }],
    listSamples: async () => [], claimOwner: async () => ({ ok: true }), markAuth: async () => {}, track: task => { pending = task; },
    client: { recoverBrowserSession: async () => { throw Object.assign(new Error("服务器浏览器已返回京东登录页，请重新登录或完成验证"), { code: "login", loginAttempted: true }); } }
  });
  await c.start(""); await pending;
  const row = (await c.board("")).records[0];
  assert.equal(row.loginExpired, true);
  assert.equal(row.loginNeedsHuman, false);
  assert.equal(row.passwordAttemptedVersion, "g:1");
  assert.ok(row.loginRetryAt > 0);
});

test("ordinary password recovery submits once and waits for verified shop identity", async () => {
  let submitted = 0, verified = 0, reads = 0;
  const cookies = await recoverPasswordSession({
    page: async () => ++reads <= 2 ? form : { href: "https://shop.jd.com/jdm/home" },
    limit: () => "", sleep: async () => {},
    submit: async (name, password) => { assert.equal(name, credentials.loginName); assert.equal(password, credentials.password); submitted++; return true; },
    verifiedSession: async () => ++verified < 2 ? null : jar("fresh")
  }, credentials);
  assert.equal(submitted, 1); assert.equal(verified, 2); assert.equal(cookies[0].value, "fresh");
});

for (const page of [{ ...form, codeVisible: true }, { ...form, text: "请完成安全验证" }, { ...form, text: "登录异常，请联系客服解除" }]) {
  test(`verification is left to the user: ${page.text}`, async () => {
    let submitted = 0;
    await assert.rejects(recoverPasswordSession({ page: async () => page, limit: () => "", sleep: async () => {},
      submit: async () => { submitted++; }, verifiedSession: async () => null }, credentials), e => e.code === "login" && e.needsHuman);
    assert.equal(submitted, 0);
  });
}

test("a challenge after submission stops immediately without a second submission", async () => {
  let submits = 0;
  await assert.rejects(recoverPasswordSession({ page: async () => submits ? { ...form, codeVisible: true } : form,
    limit: () => "", sleep: async () => {}, submit: async () => { submits++; return true; }, verifiedSession: async () => null
  }, credentials), e => e.needsHuman);
  assert.equal(submits, 1);
});

test("credentials never go to an unexpected host; platform limits and aborts stop recovery", async () => {
  const deps = { page: async () => ({ ...form, href: "https://example.org/login" }), limit: () => "", sleep: async () => {},
    submit: async () => assert.fail("must not submit"), verifiedSession: async () => null };
  await assert.rejects(recoverPasswordSession(deps, credentials), e => e.needsHuman);
  await assert.rejects(recoverPasswordSession({ ...deps, limit: () => "京东操作频繁" }, credentials), e => e.code === "platform_limited");
  await assert.rejects(recoverPasswordSession(deps, credentials, AbortSignal.abort()), e => e.code === "timeout");
  await assert.rejects(recoverPasswordSession({ ...deps, allowed: () => false }, credentials), e => e.code === "timeout");
});

test("a human login taking over the shop cancels the queued password submission", async () => {
  let allowed = true, reads = 0, submits = 0;
  await assert.rejects(recoverPasswordSession({
    allowed: () => allowed, limit: () => "", page: async () => ++reads === 1 ? { href: "about:blank" } : form,
    sleep: async () => { allowed = false; }, verifiedSession: async () => null,
    submit: async () => { submits++; return true; }
  }, credentials), e => e.code === "timeout");
  assert.equal(submits, 0);
});

test("working browser sessions never attempt password login; expired ones recollect after verified login", async () => {
  let reads = 0, logins = 0;
  const deps = { readDeal: async (cookies, _signal, hint) => {
    reads++; assert.equal(hint.credentials, undefined);
    if (cookies[0].value === "old") throw Object.assign(new Error("登录页"), { code: "login" });
    return { dealAmount: 88 };
  }, relogin: async () => { logins++; return jar("new"); } };
  await recoverBrowserSession(jar("working"), null, { credentials }, deps);
  assert.equal(logins, 0);
  const old = jar("old"), result = await recoverBrowserSession(old, null, { credentials }, deps);
  assert.equal(logins, 1); assert.equal(reads, 3); assert.equal(result.deal.dealAmount, 88);
  assert.equal(result.cookies[0].value, "new"); assert.equal(old[0].value, "old");
});

for (const code of ["platform_limited", "identity", "network"]) {
  test(`browser ${code} never triggers password login`, async () => {
    await assert.rejects(recoverBrowserSession(jar("old"), null, { credentials }, {
      readDeal: async () => { throw Object.assign(new Error(code), { code }); },
      relogin: async () => assert.fail("must not relogin")
    }), e => e.code === code);
  });
}

test("login cooldowns persist, skip all identity calls, preserve data, and release after human login", async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "home-login-retry-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  let time = Date.parse("2026-11-21T09:00:00+08:00"), pending, mode = "expired", identities = 0, recoveries = 0;
  const sessions = ["A", "B"].map(store => ({ store, authState: "ok", sessionGen: 1, cookies: jar(store) }));
  const deps = { storePath: path.join(dir, "board.json"), clock: () => time, now: () => "2026/11/21 09:00:00",
    loadOrg: async () => ["A", "B"].map(store => ({ store, login: "fixture", password: "secret-fixture", enabled: true })),
    listSessions: async () => sessions, listSamples: async () => [], claimOwner: async () => ({ ok: true }),
    markAuth: async () => {}, saveSample: async () => ({ saved: true }), track: task => { pending = task; },
    client: { fetchAccountIdentity: async cookies => { if(cookies[0].value === "A") identities++; return { shopName: cookies[0].value }; },
      recoverBrowserSession: async (_cookies, _signal, hint) => { recoveries++; assert.ok(hint.credentials);
        if (mode === "challenge") throw Object.assign(new Error("需要验证码"), { code: "login", needsHuman: true, loginAttempted: true });
        return { cookies: jar("A"), deal: { dealAmount: 100 } }; },
      fetchHome: async cookies => {
        if (cookies[0].value === "A" && mode === "expired") throw Object.assign(new Error("返回登录页"), { code: "login" });
        return { dealAmount: 100, paidAmount: 5 };
      }
    }
  };
  let c = createLive2Collector({ ...deps, published: [{ shop: "A", liveAmount: 72, paidAmount: 4, capturedAt: "2026/11/21 08:50:00" }] });
  async function round() { await c.start(""); await pending; return (await c.board("")).records; }
  let rows = await round(), a = rows.find(r => r.shop === "A");
  assert.equal(a.loginRetryAt, time + 15*60000); assert.equal(a.liveAmount, 72);
  assert.equal(a.capturedAt, "2026/11/21 08:50:00"); assert.equal(a.loginFailures, 1);
  time += 10*60000; c = createLive2Collector(deps); rows = await round();
  assert.equal(identities, 1); assert.equal(recoveries, 0); assert.equal(rows.find(r=>r.shop==="B").online, true);
  time += 6*60000; sessions[0].authState = "login_expired"; mode = "challenge";
  rows = await round(); a = rows.find(r => r.shop === "A");
  assert.equal(a.loginNeedsHuman, true); assert.equal(recoveries, 1); assert.equal(a.loginFailures, 2);
  time += 120*60000; c = createLive2Collector(deps); await round(); assert.equal(recoveries, 1);
  sessions[0].sessionGen++; sessions[0].authState = "ok"; mode = "ok";
  rows = await round(); a = rows.find(r => r.shop === "A");
  assert.equal(a.online, true); assert.equal(a.loginNeedsHuman, undefined); assert.equal(a.loginRetryAt, undefined);
  const saved = fs.readFileSync(deps.storePath,"utf8"); assert.ok(!saved.includes("secret-fixture"));
});

test("healthy shops run first and expired shops recover in bounded batches without starvation", async () => {
  let time = Date.parse("2026-11-21T09:00:00+08:00"), pending;
  const firstRoundStarted = time;
  const order = [], names = ["A", "B", "C", "D", "E", "healthy"];
  const sessions = names.map(store => ({ store, sessionGen: 1, authState: store === "healthy" ? "ok" : "login_expired", cookies: jar(store) }));
  const c = createLive2Collector({ storePath: "", concurrency: 1, clock: () => time, now: () => "2026/11/21 09:00:00",
    published: names.map(shop => ({ shop, loginExpired: shop !== "healthy", liveAmount: 50, capturedAt: "2026/11/21 08:50:00" })),
    loadOrg: async () => names.map(store => ({ store, enabled: true, login: "fixture", password: "secret-fixture" })),
    listSessions: async () => sessions, listSamples: async () => [], claimOwner: async () => ({ ok: true }), saveSample: async () => ({ saved: true }),
    track: task => { pending = task; }, client: {
      fetchHome: async () => { time += 30000; order.push("healthy"); return { dealAmount: 100, paidAmount: 10 }; },
      recoverBrowserSession: async (_jar, _signal, expected) => { order.push(expected.store);
        time += 20000;
        throw Object.assign(new Error("需要验证码"), { code: "login", needsHuman: true, loginAttempted: true }); }
    }
  });
  await c.start(""); await pending; assert.deepEqual(order, ["healthy", "A", "B", "C"]);
  const waiting = (await c.board("")).records.find(r=>r.shop==="D");
  assert.match(waiting.offlineReason, /分批恢复/); assert.equal(waiting.liveAmount, 50);
  assert.equal(waiting.loginRetryAt, firstRoundStarted + 10*60000);
  // The scheduler measures ten minutes from round start. Recovery attempts make
  // the first round longer than the next; waiting shops still need their turn.
  time = firstRoundStarted + 10*60000; order.length=0;
  await c.start(""); await pending; assert.deepEqual(order, ["healthy", "D", "E"]);
});

test("newly expired sessions also share the per-round password limit", async () => {
  const names=["A","B","C","D","E"], logins=[];
  const firstRoundStarted = Date.parse("2026-11-21T09:00:00+08:00");
  let time = firstRoundStarted;
  let pending;
  const c=createLive2Collector({storePath:"", concurrency:3, clock:()=>time, now:()=>"2026/11/21 09:00:00",
    loadOrg:async()=>names.map(store=>({store,enabled:true,login:"fixture",password:"fixture"})),
    listSessions:async()=>names.map(store=>({store,authState:"ok",sessionGen:1,cookies:jar(store)})),
    listSamples:async()=>[],claimOwner:async()=>({ok:true}),saveSample:async()=>({saved:true}),track:task=>{pending=task;},
    client:{fetchAccountIdentity:async()=>{throw Object.assign(new Error("expired"),{code:"login"});},
      recoverBrowserSession:(cookies,signal,hint)=>recoverBrowserSession(cookies,signal,hint,{
        readDeal:async()=>{throw Object.assign(new Error("登录页"),{code:"login"});},
        relogin:async(_signal,expected)=>{time+=20000;logins.push(expected.store);throw Object.assign(new Error("需要验证码"),{code:"login",needsHuman:true});}
      }),fetchHome:async()=>assert.fail("no verified session")}
  });
  await c.start("");await pending;
  assert.equal(logins.length,3);
  const rows=(await c.board("")).records;
  assert.equal(rows.filter(r=>r.loginNeedsHuman).length,3);
  assert.equal(rows.filter(r=>/分批恢复/.test(r.offlineReason)).length,2);
  assert.ok(rows.filter(r=>/分批恢复/.test(r.offlineReason)).every(r=>r.loginRetryAt === firstRoundStarted + 10*60000));
  assert.ok(rows.every(r=>r.loginExpired));
});
