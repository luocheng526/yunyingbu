import "./_memory-env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers";
import { createLive2Collector } from "../src/modules/home/live2-collect.js";
import { ensureCollectSession, getSession, listSamples, listSessions, resetJingmaiStore, saveSession } from "../src/modules/home/jingmai-store.js";

const store = "会话保护测试店";
const stamp = "2026/11/20 18:00:00";
const cookies = (value) => [{ name: "thor", value, domain: ".jd.com", path: "/", secure: true }];
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const metrics = { dealAmount: 100, paidAmount: 10 };

async function seed(value, name = store) {
  return saveSession(name, { cookies: cookies(value), authState: "ok", authMessage: "", enabled: true, shopId: "1" });
}

function harness(client, extra = {}) {
  let task;
  const collector = createLive2Collector({
    storePath: "",
    now: () => stamp,
    loadOrg: async () => [{ store, enabled: true, login: "test", password: "test", shopId: "1" }],
    listSessions,
    listSamples: async () => [],
    track: (value) => { task = value; },
    client,
    ...extra
  });
  return { collector, done: () => task, round: async () => { await collector.start(""); await task; } };
}

for (const state of ["empty", "endpoint-expired"]) {
  test(`collection recovers the verified server browser before password login (${state})`, async () => {
    await resetJingmaiStore();
    if (state === "endpoint-expired") await seed("old-database-session");
    let recovered = 0;
    const run = harness({
      login: async () => assert.fail("background collection must not keep submitting a rejected password request"),
      fetchAccountIdentity: async () => { throw Object.assign(new Error("account endpoint says login"), { code: "login" }); },
      recoverBrowserSession: async (oldJar, signal, expected) => {
        recovered++;
        assert.equal(expected.requireIdentity, true);
        assert.equal(expected.store, store);
        assert.equal(signal.aborted, false);
        assert.equal(oldJar.length, state === "empty" ? 0 : 1);
        return { cookies: cookies("verified-browser-new"), deal: { dealAmount: 100 } };
      },
      fetchHome: async (jar, _signal, expected) => {
        assert.equal(jar[0].value, "verified-browser-new");
        assert.equal(expected.browserDeal.dealAmount, 100);
        return metrics;
      }
    });
    await run.round();
    assert.equal(recovered, 1);
    assert.equal((await getSession(store)).cookies[0].value, "verified-browser-new");
    assert.equal((await run.collector.board("")).records[0].online, true);
  });
}

test("server browser verification waits for the user and never falls through to password retries", async () => {
  await resetJingmaiStore();
  let attempts = 0, time = 0;
  const run = harness({
    login: async () => assert.fail("verification cannot be replaced with password retries"),
    recoverBrowserSession: async () => { attempts++; throw Object.assign(new Error("服务器登录需要验证"), { code: "login" }); },
    fetchHome: async () => assert.fail("no verified login")
  }, { clock: () => time });
  await run.round();
  time += 10 * 60 * 1000;
  await run.round();
  assert.equal(attempts, 1);
  assert.equal((await run.collector.board("")).records[0].loginExpired, true);
});

test("shared merchant accounts require browser shop-ID verification even with a saved session", async () => {
  await resetJingmaiStore();
  await seed("saved");
  let checked = 0;
  const run = harness({
    fetchAccountIdentity: async () => assert.fail("a shared merchant ID cannot establish the shop"),
    recoverBrowserSession: async (_jar, _signal, expected) => {
      checked++;
      assert.equal(expected.shopId, "1");
      assert.equal(expected.ambiguousMerchant, true);
      return { cookies: cookies("verified"), deal: { dealAmount: 100 } };
    },
    fetchHome: async () => metrics
  }, { loadOrg: async () => [{ store, shopId: "1", merchantId: "9", ambiguousMerchant: true, enabled: true }] });
  await run.round();
  assert.equal(checked, 1);
  assert.equal((await run.collector.board("")).records[0].online, true);
});

test("live2 reuses the latest saved session instead of overwriting it with a cached cookie", async () => {
  await resetJingmaiStore();
  await seed("old");
  const used = [];
  const run = harness({ fetchHome: async (jar) => { used.push(jar[0].value); return metrics; } });
  await run.round();
  await seed("human-new");
  await run.round();
  assert.deepEqual(used, ["old", "human-new"]);
  assert.equal((await getSession(store)).cookies[0].value, "human-new");
});

for (const outcome of ["success", "login-error"]) {
  test(`live2 ${outcome} from an older task cannot change a newer human login`, async () => {
    await resetJingmaiStore();
    await seed("old");
    const entered = deferred(), response = deferred();
    const run = harness({ fetchHome: async () => { entered.resolve(); return response.promise; } });
    await run.collector.start("");
    await entered.promise;
    const saved = await seed("human-new");
    if (outcome === "success") response.resolve(metrics);
    else response.reject(Object.assign(new Error("old login expired"), { code: "login" }));
    await run.done();
    const current = await getSession(store);
    assert.equal(current.authState, "ok");
    assert.equal(current.sessionGen, saved.sessionGen);
    assert.equal(current.cookies[0].value, "human-new");
    const board = await run.collector.board("");
    assert.equal(board.loginExpiredShops, 0);
  });
}

for (const outcome of ["success", "login-error"]) {
  test(`live2 cancels timed-out collection and ignores its late ${outcome}`, async () => {
    await resetJingmaiStore();
    await seed("saved");
    const response = deferred();
    let signal;
    const run = harness({ fetchHome: async (_jar, passedSignal) => {
      signal = passedSignal;
      return response.promise;
    } }, { shopBudgetMs: 20 });
    await run.round();
    const before = await getSession(store);
    assert.equal(before.authState, "offline");
    assert.equal(before.cookies[0].value, "saved");
    // The mock deliberately ignores cancellation to exercise late write protection too.
    if (outcome === "success") response.resolve(metrics);
    else response.reject(Object.assign(new Error("late logout"), { code: "login" }));
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(await getSession(store), before);
    assert.equal(signal.aborted, true);
  });
}

test("live2 collects with an existing session even when org credentials are unavailable", async () => {
  await resetJingmaiStore();
  await seed("saved");
  let fetched = 0, logged = 0;
  const run = harness({
    login: async () => { logged += 1; return []; },
    fetchHome: async (jar) => { fetched += 1; assert.equal(jar[0].value, "saved"); return metrics; }
  }, { loadOrg: async () => [{ store, enabled: true, login: "", password: "", shopId: "1" }] });
  await run.round();
  assert.equal(fetched, 1);
  assert.equal(logged, 0);
  assert.equal((await run.collector.board("")).records[0].liveAmount, 100);
});

test("live2 does not attempt password login when saved sessions cannot be read", async () => {
  await resetJingmaiStore();
  await seed("saved");
  let logins = 0;
  const run = harness({ login: async () => { logins += 1; return cookies("unwanted"); } }, {
    listSessions: async () => { throw new Error("store unavailable"); }
  });
  await run.round();
  assert.equal(logins, 0);
  assert.equal((await getSession(store)).cookies[0].value, "saved");
  assert.equal((await getSession(store)).authState, "ok");
});

test("live2 preserves the original login challenge reason and the saved cookies", async () => {
  await resetJingmaiStore();
  await saveSession(store, { cookies: cookies("expired"), authState: "login_expired", enabled: true, shopId: "1" });
  const run = harness({ login: async () => { throw Object.assign(new Error("请先完成滑动验证"), { code: "login" }); } });
  await run.round();
  const current = await getSession(store);
  assert.equal(current.cookies[0].value, "expired");
  assert.equal(current.authMessage, "请先完成滑动验证");
  assert.equal((await run.collector.board("")).records[0].offlineReason, "请先完成滑动验证");
});

test("a transport error during password login does not become login expired", async () => {
  await resetJingmaiStore();
  const run = harness({ login: async () => { throw Object.assign(new Error("登录网络暂不可用"), { code: "network" }); } });
  await run.round();
  const row = (await run.collector.board("")).records[0];
  assert.equal(row.loginExpired, false);
  assert.equal(row.offline, true);
});

test("a queued shop reads a login saved while it waited for a worker", async () => {
  await resetJingmaiStore();
  await seed("first", "第一家");
  await seed("old");
  const entered = deferred(), response = deferred();
  const used = [];
  const run = harness({ fetchHome: async (jar, _signal, expected) => {
    if (expected.store === "第一家") {
      entered.resolve();
      await response.promise;
    } else used.push(jar[0].value);
    return metrics;
  } }, {
    concurrency: 1,
    loadOrg: async () => ["第一家", store].map((name) => ({ store: name, login: "test", password: "test", shopId: "1" }))
  });
  await run.collector.start("");
  await entered.promise;
  await seed("human-new");
  response.resolve();
  await run.done();
  assert.deepEqual(used, ["human-new"]);
});

test("a login response arriving after the deadline does not replace a newer session or start collection", async () => {
  await resetJingmaiStore();
  await saveSession(store, { cookies: cookies("expired"), authState: "login_expired", enabled: true, shopId: "1" });
  const response = deferred();
  let fetches = 0;
  const run = harness({
    login: async () => response.promise,
    fetchHome: async () => { fetches += 1; return metrics; }
  }, { shopBudgetMs: 20 });
  await run.round();
  await seed("human-new");
  response.resolve(cookies("late-password"));
  await new Promise((resolve) => setImmediate(resolve));
  const current = await getSession(store);
  assert.equal(current.authState, "ok");
  assert.equal(current.cookies[0].value, "human-new");
  assert.equal(fetches, 0);
});

test("an expired label is rechecked against JD before asking for a password", async () => {
  await resetJingmaiStore();
  await saveSession(store, { cookies: cookies("still-valid"), authState: "login_expired", enabled: true, shopId: "1" });
  const run = harness({
    fetchAccountIdentity: async () => ({ shopId: "1", shopName: store }),
    login: async () => assert.fail("valid saved login must not be replaced"),
    fetchHome: async () => metrics
  });
  await run.round();
  assert.equal((await getSession(store)).authState, "ok");
  assert.equal((await run.collector.board("")).records[0].online, true);
});

for (const mode of ["wrong-shop", "network"]) {
  test(`identity ${mode} cannot trigger password login or store another shop's data`, async () => {
    await resetJingmaiStore();
    await seed("saved");
    const run = harness({
      fetchAccountIdentity: async () => {
        if (mode === "network") throw Object.assign(new Error("身份核验网络超时"), { code: "network" });
        return { shopId: "another", shopName: "另一家店" };
      },
      login: async () => assert.fail("not an authentication failure"),
      fetchHome: async () => assert.fail("identity must be verified first")
    });
    await run.round();
    const row = (await run.collector.board("")).records[0];
    assert.equal(row.loginExpired, false);
    assert.equal(row.online, false);
    assert.match(row.offlineReason, mode === "network" ? /网络/ : /不一致/);
    assert.equal((await getSession(store)).cookies[0].value, "saved");
    assert.deepEqual(await listSamples("2026-11-20", "2026-11-20"), []);
  });
}

test("login challenges back off and a new human session can collect immediately", async () => {
  await resetJingmaiStore();
  await saveSession(store, { cookies: [], authState: "login_expired", enabled: true, shopId: "1" });
  let time = 0, attempts = 0;
  const run = harness({
    login: async () => { attempts += 1; throw Object.assign(new Error("需要验证码"), { code: "login" }); },
    fetchHome: async () => metrics
  }, { clock: () => time });
  await run.round();
  time += 10 * 60 * 1000;
  await run.round();
  assert.equal(attempts, 1);
  time += 10 * 60 * 1000;
  await run.round();
  assert.equal(attempts, 2);
  await seed("human-new");
  await run.round();
  assert.equal((await run.collector.board("")).records[0].online, true);
  assert.equal(attempts, 2);
});

test("shared collector lock and manual-login window prevent overlapping work", async () => {
  await resetJingmaiStore();
  await seed("saved");
  let human = false, fetches = 0;
  const inflight = new Set([store]);
  const run = harness({ fetchHome: async () => { fetches += 1; return metrics; } }, {
    inflight, humanProtectsShop: () => human
  });
  await run.round();
  assert.equal(fetches, 0);
  inflight.delete(store); human = true;
  await run.round();
  assert.equal(fetches, 0);
  human = false;
  await run.round();
  assert.equal(fetches, 1);
  assert.equal(inflight.size, 0);
});

test("a timed-out job keeps its lock until the late client response settles", async () => {
  await resetJingmaiStore();
  await seed("saved");
  const late = deferred();
  const inflight = new Set();
  let fetches = 0;
  const run = harness({ fetchHome: async () => { fetches += 1; return late.promise; } }, { inflight, shopBudgetMs: 20 });
  await run.round();
  await run.round();
  assert.equal(fetches, 1);
  assert.equal(inflight.has(store), true);
  late.resolve(metrics);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(inflight.has(store), false);
});

test("sample write failure never publishes fresh numbers and the next round recovers", async () => {
  await resetJingmaiStore();
  await seed("saved");
  let broken = true;
  const run = harness({ fetchHome: async () => metrics }, {
    saveSample: async () => { if (broken) throw new Error("storage unavailable"); return { saved: true }; }
  });
  await run.round();
  let row = (await run.collector.board("")).records[0];
  assert.equal(row.liveAmount, null);
  assert.equal(row.online, false);
  assert.match(row.offlineReason, /保存失败/);
  broken = false;
  await run.round();
  row = (await run.collector.board("")).records[0];
  assert.equal(row.liveAmount, 100);
  assert.equal(row.online, true);
});

test("session bootstrap preserves an existing human login and a manual pause", async () => {
  await resetJingmaiStore();
  const empty = await ensureCollectSession(store, "1");
  assert.equal(empty.sessionGen, 0);
  await saveSession(store, { cookies: cookies("human"), enabled: false, shopId: "1" });
  const saved = await getSession(store);
  await ensureCollectSession(store, "wrong-id");
  assert.deepEqual(await getSession(store), saved);
});

for (const savedId of ["1", ""]) {
test(`DSM 601 on identity lookup still collects a store-bound saved session (shop ID ${savedId || "legacy missing"})`, async () => {
  await resetJingmaiStore();
  await saveSession(store, { cookies: cookies("bound"), shopId: savedId, enabled: true, authState: "ok" });
  let fetches = 0;
  const run = harness({
    fetchAccountIdentity: async () => { throw Object.assign(new Error("京麦首页 601 非法请求拦截"), { code: "network" }); },
    login: async () => assert.fail("an intercepted identity endpoint is not a logout"),
    fetchHome: async (jar, _signal, expected) => {
      fetches += 1;
      assert.equal(jar[0].value, "bound");
      assert.equal(expected.store, store);
      assert.equal(expected.shopId, "1");
      return metrics;
    }
  });
  await run.round();
  assert.equal(fetches, 1);
  assert.equal((await run.collector.board("")).records[0].liveAmount, 100);
  assert.equal((await getSession(store)).authState, "ok");
});
}

test("DSM 601 cannot reuse a saved binding to a different shop ID", async () => {
  await resetJingmaiStore();
  await saveSession(store, { cookies: cookies("wrong-shop"), shopId: "other", enabled: true, authState: "ok" });
  const run = harness({
    fetchAccountIdentity: async () => { throw Object.assign(new Error("京麦首页 601 非法请求拦截"), { code: "network" }); },
    login: async () => assert.fail("do not replace the existing login"),
    fetchHome: async () => assert.fail("conflicting shop binding cannot save data")
  });
  await run.round();
  assert.equal((await run.collector.board("")).records[0].online, false);
  assert.deepEqual(await listSamples("2026-11-20", "2026-11-20"), []);
});

test("a rejected automatic login request preserves previous numbers and the saved session", async () => {
  await resetJingmaiStore();
  await seed("saved");
  let failed = false;
  const run = harness({
    fetchAccountIdentity: async () => {
      if (failed) throw Object.assign(new Error("session expired"), { code: "login" });
      return { shopId: "1", shopName: store };
    },
    login: async () => { throw Object.assign(new Error("京麦自动登录请求被拒绝（参数为空或不合法），请使用服务器登录窗口"), { code: "network" }); },
    fetchHome: async () => metrics
  });
  await run.round();
  const before = (await run.collector.board("")).records[0];
  failed = true;
  await run.round();
  const after = (await run.collector.board("")).records[0];
  assert.equal(after.liveAmount, before.liveAmount);
  assert.equal(after.capturedAt, before.capturedAt);
  assert.equal(after.loginExpired, false);
  assert.equal(after.offline, true);
  assert.match(after.offlineReason, /请求被拒绝/);
  assert.equal((await getSession(store)).cookies[0].value, "saved");
});

test("DSM 601 never permits an unverified new password login to save data", async () => {
  await resetJingmaiStore();
  const run = harness({
    login: async () => cookies("new-unverified"),
    fetchAccountIdentity: async () => { throw Object.assign(new Error("京麦首页 601 非法请求拦截"), { code: "network" }); },
    fetchHome: async () => assert.fail("a new login has no trusted shop binding")
  });
  await run.round();
  assert.equal((await run.collector.board("")).records[0].online, false);
  assert.deepEqual((await getSession(store)).cookies, []);
  assert.deepEqual(await listSamples("2026-11-20", "2026-11-20"), []);
});

test("identity service failure preserves the previous numbers and original capture time", async () => {
  await resetJingmaiStore();
  await seed("saved");
  let failed = false;
  const run = harness({
    fetchAccountIdentity: async () => {
      if (failed) throw Object.assign(new Error("身份服务网络故障"), { code: "network" });
      return { shopId: "1", shopName: store };
    },
    fetchHome: async () => metrics
  });
  await run.round();
  const before = (await run.collector.board("")).records[0];
  failed = true;
  await run.round();
  const after = (await run.collector.board("")).records[0];
  assert.equal(after.liveAmount, before.liveAmount);
  assert.equal(after.paidAmount, before.paidAmount);
  assert.equal(after.capturedAt, before.capturedAt);
  assert.equal(after.online, false);
  assert.match(after.offlineReason, /身份服务网络故障/);
});
