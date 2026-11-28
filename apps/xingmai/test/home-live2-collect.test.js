import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import "./_memory-env.js";
import { live2FeeRate } from "../src/modules/home/live2.js";
import { armLive2Schedule, createLive2Collector, LIVE2_INTERVAL_MS, LIVE2_RUNTIME_MARK, LIVE2_STALE_MS } from "../src/modules/home/live2-collect.js";

test("实时费比 is 付费金额 divided by 成交金额", () => {
  assert.equal(Math.round(live2FeeRate(1841.39, 3009) * 100), 61);
  assert.equal(live2FeeRate(0, 3009), 0);
  assert.equal(live2FeeRate(100, 0), null);
  assert.equal(live2FeeRate(null, 3009), null);
});

test("a shop logs in on the server and maps 京麦成交 plus 京准通花费、投产比、总订单金额", async () => {
  let logins = 0;
  let done;
  const gate = new Promise(function (resolve) {
    done = resolve;
  });
  const collector = createLive2Collector({
    ensureSession: async () => null,
    claimOwner: async () => ({ ok: true }),
    saveSample: async () => ({ saved: true }),
    loadOrg: async function () {
      return [
        {
          store: "RASW旗舰店",
          team: "韩梦凯",
          manager: "韩梦凯",
          enabled: true,
          login: "rasw",
          password: "secret",
          shopId: "1"
        }
      ];
    },
    listSessions: async function () {
      return [];
    },
    now: function () {
      return "2026/11/19 14:43:00";
    },
    storePath: "",
    track: function (task) {
      task.then(done, done);
    },
    client: {
      login: async function (user, password) {
        logins += 1;
        assert.equal(user, "rasw");
        assert.equal(password, "secret");
        return [{ name: "thor", value: "1" }];
      },
      fetchHome: async function () {
        return { dealAmount: 3009, paidAmount: 1000, totalSpend: 1841.39, paidRoi: 1.43, paidDeal: 2638 };
      }
    }
  });
  const started = await collector.start("cookie");
  assert.equal(started.records[0].pendingCollect, false);
  assert.equal(started.running, true);
  assert.equal(started.records[0].password, undefined);
  await gate;
  const view = await collector.board("cookie");
  assert.equal(view.runtimeMark, LIVE2_RUNTIME_MARK);
  assert.equal(logins, 1);
  assert.equal(view.running, false);
  assert.equal(view.records[0].liveAmount, 3009);
  assert.equal(view.records[0].paidAmount, 1841.39);
  assert.equal(view.records[0].roi, 1.43);
  assert.equal(view.records[0].paidDeal, 2638);
  assert.equal(Math.round(view.records[0].feeRate * 100), 61);
  assert.equal(view.records[0].capturedAt, "2026/11/19 14:43:00");
  assert.equal(view.records[0].online, true);
});

test("an existing server session is read and not written back", async () => {
  let logins = 0;
  let done;
  const gate = new Promise(function (resolve) {
    done = resolve;
  });
  const collector = createLive2Collector({
    ensureSession: async () => null,
    claimOwner: async () => ({ ok: true }),
    saveSample: async () => ({ saved: true }),
    loadOrg: async function () {
      return [{ store: "A店", enabled: true, login: "a", password: "b", shopId: "9" }];
    },
    listSessions: async function () {
      return [{ store: "A店", cookies: [{ name: "thor", value: "old" }] }];
    },
    now: function () {
      return "2026/11/19 14:43:00";
    },
    storePath: "",
    track: function (task) {
      task.then(done, done);
    },
    client: {
      login: async function () {
        logins += 1;
        return [{ name: "thor", value: "new" }];
      },
      fetchHome: async function (jar) {
        assert.equal(jar[0].value, "old");
        return { dealAmount: 100, paidAmount: 10, totalSpend: 25, paidRoi: 2, paidDeal: 50 };
      }
    }
  });
  await collector.start("");
  await gate;
  const view = await collector.board("");
  assert.equal(logins, 0);
  assert.equal(view.records[0].feeRate, 0.25);
  assert.equal(view.records[0].paidDeal, 50);
  assert.ok(view.timings.roundMs >= 0);
  assert.ok(view.timings.dealMs >= 0);
});

test("opening the board keeps the last published round until the new round finishes", async () => {
  let release;
  const hold = new Promise(function (resolve) {
    release = resolve;
  });
  let done;
  const gate = new Promise(function (resolve) {
    done = resolve;
  });
  const collector = createLive2Collector({
    ensureSession: async () => null,
    claimOwner: async () => ({ ok: true }),
    saveSample: async () => ({ saved: true }),
    storePath: "",
    published: [{ shop: "A店", liveAmount: 80, paidAmount: 20, capturedAt: "2026/11/19 09:00:00", online: true, pendingCollect: false }],
    loadOrg: async function () {
      return [{ store: "A店", enabled: true, login: "a", password: "b", shopId: "1" }];
    },
    listSessions: async function () {
      return [];
    },
    now: function () {
      return "2026/11/19 19:20:00";
    },
    track: function (task) {
      task.then(done, done);
    },
    client: {
      login: async function () {
        return [{ name: "thor", value: "1" }];
      },
      fetchHome: async function () {
        await hold;
        return { dealAmount: 120, paidAmount: 30, totalSpend: 30, paidRoi: 2, paidDeal: 60 };
      }
    }
  });
  const started = await collector.start("");
  assert.equal(started.records[0].liveAmount, 80);
  assert.equal(started.running, true);
  const mid = await collector.board("");
  assert.equal(mid.records[0].liveAmount, 80);
  assert.equal(mid.running, true);
  release();
  await gate;
  const doneView = await collector.board("");
  assert.equal(doneView.running, false);
  assert.equal(doneView.records[0].liveAmount, 120);
  assert.equal(doneView.publishedAt, "2026/11/19 19:20:00");
});

test("a shop without an account is 待接入, and a slow shop older than 15 minutes is 掉线 采集已停止", async () => {
  let done;
  const gate = new Promise(function (resolve) {
    done = resolve;
  });
  const collector = createLive2Collector({
    ensureSession: async () => null,
    claimOwner: async () => ({ ok: true }),
    saveSample: async () => ({ saved: true }),
    storePath: "",
    shopBudgetMs: 30,
    published: [{ shop: "慢店", liveAmount: 10, paidAmount: 4, capturedAt: "2026/11/19 10:00:00", online: true, pendingCollect: false }],
    loadOrg: async function () {
      return [
        { store: "慢店", enabled: true, login: "a", password: "b", shopId: "1" },
        { store: "没账号", enabled: true, login: "", password: "" }
      ];
    },
    listSessions: async function () {
      return [];
    },
    now: function () {
      return "2026/11/19 19:20:00";
    },
    track: function (task) {
      task.then(done, done);
    },
    client: {
      login: async function () {
        return [{ name: "thor", value: "1" }];
      },
      fetchHome: function () {
        return new Promise(function () {});
      }
    }
  });
  const started = await collector.start("");
  assert.equal(started.records.find((row) => row.shop === "没账号").pendingCollect, true);
  assert.equal(Boolean(started.records.find((row) => row.shop === "慢店").pendingUpdate), false);
  await gate;
  const view = await collector.board("");
  const slow = view.records.find((row) => row.shop === "慢店");
  const bare = view.records.find((row) => row.shop === "没账号");
  assert.equal(slow.liveAmount, 10);
  assert.equal(slow.capturedAt, "2026/11/19 10:00:00");
  assert.equal(slow.loginExpired, false);
  assert.equal(slow.offline, true);
  assert.equal(slow.offlineReason, "采集已停止");
  assert.equal(slow.pendingCollect, false);
  assert.equal(bare.pendingCollect, true);
  assert.equal(bare.liveAmount, null);
});

test("登录失效的店跳过旧会话，有账号时静默再登一次就能继续抓", async () => {
  let logins = 0;
  const fetched = [];
  let done;
  const gate = new Promise(function (resolve) {
    done = resolve;
  });
  const collector = createLive2Collector({
    ensureSession: async () => null,
    claimOwner: async () => ({ ok: true }),
    saveSample: async () => ({ saved: true }),
    storePath: "",
    published: [{
      shop: "过期店",
      liveAmount: 10,
      paidAmount: 4,
      capturedAt: "2026/11/20 11:35:00",
      online: false,
      loginExpired: true,
      pendingCollect: false
    }],
    loadOrg: async function () {
      return [{ store: "过期店", enabled: true, login: "a", password: "b", shopId: "1" }];
    },
    listSessions: async function () {
      return [{ store: "过期店", authState: "login_expired", cookies: [{ name: "thor", value: "old" }] }];
    },
    now: function () {
      return "2026/11/20 11:40:00";
    },
    track: function (task) {
      task.then(done, done);
    },
    client: {
      login: async function () {
        logins += 1;
        return [{ name: "thor", value: "new" }];
      },
      fetchHome: async function (jar) {
        fetched.push(jar[0].value);
        return { dealAmount: 99, paidAmount: 9, totalSpend: 9, paidRoi: 1, paidDeal: 9 };
      }
    }
  });
  await collector.start("");
  await gate;
  const view = await collector.board("");
  const row = view.records.find((item) => item.shop === "过期店");
  assert.equal(logins, 1);
  assert.deepEqual(fetched, ["new"]);
  assert.equal(row.liveAmount, 99);
  assert.equal(Boolean(row.loginExpired), false);
  assert.equal(row.online, true);
});

test("静默登录遇到验证码就停在失效，不打开窗口也不抓数", async () => {
  let logins = 0;
  let fetched = 0;
  let done;
  const gate = new Promise(function (resolve) {
    done = resolve;
  });
  const collector = createLive2Collector({
    ensureSession: async () => null,
    claimOwner: async () => ({ ok: true }),
    saveSample: async () => ({ saved: true }),
    storePath: "",
    published: [{
      shop: "验证店",
      liveAmount: 10,
      paidAmount: 4,
      capturedAt: "2026/11/20 11:35:00",
      online: false,
      loginExpired: true,
      pendingCollect: false
    }],
    loadOrg: async function () {
      return [{ store: "验证店", enabled: true, login: "a", password: "b", shopId: "1" }];
    },
    listSessions: async function () {
      return [{ store: "验证店", authState: "login_expired", cookies: [] }];
    },
    now: function () {
      return "2026/11/20 11:40:00";
    },
    track: function (task) {
      task.then(done, done);
    },
    client: {
      login: async function () {
        logins += 1;
        const error = new Error("登录已失效，请重新登录");
        error.code = "login";
        throw error;
      },
      fetchHome: async function () {
        fetched += 1;
        return { dealAmount: 99 };
      }
    }
  });
  await collector.start("");
  await gate;
  const view = await collector.board("");
  const row = view.records.find((item) => item.shop === "验证店");
  assert.equal(logins, 1);
  assert.equal(fetched, 0);
  assert.equal(row.loginExpired, true);
  assert.equal(row.online, false);
  assert.equal(row.offline, false);
  assert.equal(view.loginExpiredShops, 1);
});

test("京麦超时保留会话并标掉线，最近一次有效数据超过 15 分钟则原因是采集已停止", async () => {
  assert.equal(LIVE2_STALE_MS, 15 * 60 * 1000);
  let done;
  const gate = new Promise(function (resolve) {
    done = resolve;
  });
  const collector = createLive2Collector({
    ensureSession: async () => null,
    claimOwner: async () => ({ ok: true }),
    saveSample: async () => ({ saved: true }),
    storePath: "",
    shopBudgetMs: 30,
    published: [{
      shop: "超时店",
      liveAmount: 20,
      paidAmount: 4,
      capturedAt: "2026/11/20 11:20:00",
      online: true,
      pendingCollect: false
    }],
    loadOrg: async function () {
      return [{ store: "超时店", enabled: true, login: "a", password: "b", shopId: "1" }];
    },
    listSessions: async function () {
      return [{ store: "超时店", authState: "ok", cookies: [{ name: "thor", value: "keep" }] }];
    },
    now: function () {
      return "2026/11/20 11:40:00";
    },
    track: function (task) {
      task.then(done, done);
    },
    client: {
      login: async function () {
        throw new Error("should not login");
      },
      fetchHome: function () {
        return new Promise(function () {});
      }
    }
  });
  await collector.start("");
  await gate;
  const view = await collector.board("");
  const row = view.records[0];
  assert.equal(row.liveAmount, 20);
  assert.equal(row.loginExpired, false);
  assert.equal(row.offline, true);
  assert.equal(row.offlineReason, "采集已停止");
});

test("成交金额是空的且报错没有成交字段时不按掉线算", async () => {
  let done;
  const gate = new Promise(function (resolve) {
    done = resolve;
  });
  const collector = createLive2Collector({
    ensureSession: async () => null,
    claimOwner: async () => ({ ok: true }),
    saveSample: async () => ({ saved: true }),
    storePath: "",
    published: [{
      shop: "空成交店",
      liveAmount: null,
      paidAmount: 1,
      spendScope: "jzt-total",
      adsCapturedAt: "2026/11/20 11:38:00",
      capturedAt: "2026/11/20 11:38:00",
      online: true,
      pendingCollect: false
    }],
    loadOrg: async function () {
      return [{ store: "空成交店", enabled: true, login: "a", password: "b", shopId: "1" }];
    },
    listSessions: async function () {
      return [{ store: "空成交店", authState: "ok", cookies: [{ name: "thor", value: "keep" }] }];
    },
    now: function () {
      return "2026/11/20 11:40:00";
    },
    track: function (task) {
      task.then(done, done);
    },
    client: {
      login: async function () {
        throw new Error("should not login");
      },
      fetchHome: async function () {
        const error = new Error("京麦首页没有成交字段");
        error.code = "network";
        throw error;
      }
    }
  });
  await collector.start("");
  await gate;
  const view = await collector.board("");
  const row = view.records[0];
  assert.equal(row.online, false);
  assert.equal(row.dealFailed, true);
  assert.equal(row.partialData, true);
  assert.equal(row.offline, false);
  assert.equal(row.loginExpired, false);
  assert.equal(row.offlineReason, "");
});

test("a second start does not collect the same shops again", async () => {
  let logins = 0;
  let done;
  const gate = new Promise(function (resolve) {
    done = resolve;
  });
  const collector = createLive2Collector({
    ensureSession: async () => null,
    claimOwner: async () => ({ ok: true }),
    saveSample: async () => ({ saved: true }),
    storePath: "",
    loadOrg: async function () {
      return [{ store: "A店", enabled: true, login: "a", password: "b", shopId: "1" }];
    },
    listSessions: async function () {
      return [];
    },
    now: function () {
      return "2026/11/19 19:20:00";
    },
    track: function (task) {
      task.then(done, done);
    },
    client: {
      login: async function () {
        logins += 1;
        return [{ name: "thor", value: "1" }];
      },
      fetchHome: async function () {
        return { dealAmount: 5, paidAmount: 1, paidRoi: 1, paidDeal: 2 };
      }
    }
  });
  await collector.start("");
  const again = await collector.start("");
  assert.equal(again.started, false);
  await gate;
  assert.equal(logins, 1);
});

test("成交金额先入库，广告超过截止时间后仍保留这笔成交并标待更新", async () => {
  let done;
  const gate = new Promise(function (resolve) {
    done = resolve;
  });
  let releaseAds;
  const adsHold = new Promise(function (resolve) {
    releaseAds = resolve;
  });
  const collector = createLive2Collector({
    ensureSession: async () => null,
    claimOwner: async () => ({ ok: true }),
    saveSample: async () => ({ saved: true }),
    storePath: "",
    shopBudgetMs: 200,
    loadOrg: async function () {
      return [{ store: "A店", enabled: true, login: "a", password: "b", shopId: "1" }];
    },
    listSessions: async function () {
      return [];
    },
    now: function () {
      return "2026/11/19 19:20:00";
    },
    track: function (task) {
      task.then(done, done);
    },
    client: {
      login: async function () {
        return [{ name: "thor", value: "1" }];
      },
      fetchHome: async function (_jar, _signal, expected) {
        await expected.onDeal({ dealAmount: 88 });
        await adsHold;
        await new Promise(function (resolve) {
          setTimeout(resolve, 500);
        });
        return { dealAmount: 88, paidAmount: 9, paidRoi: 2, paidDeal: 40 };
      }
    }
  });
  const opened = await collector.start("");
  assert.equal(opened.records[0].liveAmount, null);
  await gate;
  const view = await collector.board("");
  assert.equal(view.running, false);
  assert.equal(view.records[0].liveAmount, 88);
  assert.equal(view.records[0].paidAmount, null);
  assert.equal(view.records[0].pendingUpdate, true);
  assert.equal(view.records[0].capturedAt, "2026/11/19 19:20:00");
  releaseAds();
});

test("a shop that times out keeps today's saved server reading instead of a blank row", async () => {
  let done;
  const gate = new Promise(function (resolve) {
    done = resolve;
  });
  const collector = createLive2Collector({
    ensureSession: async () => null,
    claimOwner: async () => ({ ok: true }),
    saveSample: async () => ({ saved: true }),
    storePath: "",
    shopBudgetMs: 40,
    loadOrg: async function () {
      return [{ store: "DIKTT生活电器旗舰店", enabled: true, login: "a", password: "b", shopId: "1" }];
    },
    listSessions: async function () {
      return [{ store: "DIKTT生活电器旗舰店", cookies: [{ name: "thor", value: "1" }] }];
    },
    listSamples: async function () {
      return [{
        store: "DIKTT生活电器旗舰店",
        capturedAt: "2026-11-19 17:22:59",
        dealAmount: 5958.55,
        paidAmount: null,
        ok: true
      }];
    },
    now: function () {
      return "2026/11/19 20:42:16";
    },
    track: function (task) {
      task.then(done, done);
    },
    client: {
      fetchHome: function () {
        return new Promise(function () {});
      }
    }
  });
  await collector.start("");
  await gate;
  const view = await collector.board("");
  const row = view.records[0];
  assert.equal(row.liveAmount, 5958.55);
  assert.equal(row.capturedAt, "2026/11/19 17:22:59");
  assert.equal(row.offline, true);
  assert.equal(row.loginExpired, false);
  assert.equal(row.offlineReason, "采集已停止");
  assert.equal(row.pendingCollect, false);
});

test("a new process reads the last published round in one board", async () => {
  const file = path.join(os.tmpdir(), "xingmai-live2-round-" + Date.now() + ".json");
  let done;
  const gate = new Promise(function (resolve) {
    done = resolve;
  });
  const first = createLive2Collector({
    ensureSession: async () => null,
    claimOwner: async () => ({ ok: true }),
    saveSample: async () => ({ saved: true }),
    storePath: file,
    loadOrg: async function () {
      return [{ store: "A店", enabled: true, login: "a", password: "b", shopId: "1", team: "甲组" }];
    },
    listSessions: async function () {
      return [];
    },
    now: function () {
      return "2026/11/19 19:20:00";
    },
    track: function (task) {
      task.then(done, done);
    },
    client: {
      login: async function () {
        return [{ name: "thor", value: "1" }];
      },
      fetchHome: async function () {
        return { dealAmount: 120, paidAmount: 30, totalSpend: 30, paidRoi: 2, paidDeal: 60 };
      }
    }
  });
  await first.start("");
  await gate;
  const second = createLive2Collector({
    ensureSession: async () => null,
    claimOwner: async () => ({ ok: true }),
    saveSample: async () => ({ saved: true }),
    storePath: file,
    loadOrg: async function () {
      return [{ store: "A店", enabled: true, login: "a", password: "b", shopId: "1", team: "甲组" }];
    },
    listSessions: async function () {
      return [];
    },
    now: function () {
      return "2026/11/19 19:30:00";
    }
  });
  const view = await second.board("");
  assert.equal(view.running, false);
  assert.equal(view.records.length, 1);
  assert.equal(view.records[0].liveAmount, 120);
  assert.equal(view.records[0].paidAmount, 30);
  assert.equal(view.publishedAt, "2026/11/19 19:20:00");
  fs.rmSync(file, { force: true });
});

test("live2 schedule starts without a saved browser login", () => {
  const waits = [];
  let starts = 0;
  const armed = armLive2Schedule({
    env: {},
    argv: [],
    gate: {},
    hooks: {},
    bootMs: 0,
    readCookie: function () {
      return "";
    },
    setTimeout: function (fn, ms) {
      waits.push(ms);
      if (waits.length === 1) {
        fn();
      }
      return waits.length;
    },
    clearTimeout: function () {},
    startRound: function () {
      starts += 1;
      return Promise.resolve({ started: true });
    }
  });
  assert.equal(armed.started, true);
  assert.equal(starts, 1);
  assert.equal(LIVE2_INTERVAL_MS, 10 * 60 * 1000);
  assert.deepEqual(waits, [0]);
});

test("single-shop refreshes preserve the next full collection deadline", () => {
  const timers = [], cleared = [], hooks = {};
  armLive2Schedule({ env: {}, argv: [], gate: {}, hooks,
    setTimeout: (fn, ms) => { const timer = { fn, ms }; timers.push(timer); return timer; },
    clearTimeout: timer => cleared.push(timer), startRound: async () => ({ started: true }) });
  hooks.onRoundDone(Date.now(), "");
  const fullTimer = timers.at(-1), count = timers.length, clears = cleared.length;
  for (const shop of ["A", "B", "C"]) hooks.onRoundDone(Date.now(), shop);
  assert.equal(timers.length, count);
  assert.equal(timers.at(-1), fullTimer);
  assert.equal(cleared.length, clears);
  assert.ok(fullTimer.ms > LIVE2_INTERVAL_MS - 1000);
});

for (const finishDuringStart of [false, true]) {
  test(`a due full round waits for one-shop completion without losing its timer (race=${finishDuringStart})`, async () => {
    const timers = [], hooks = {};
    let busy = true, starts = 0;
    armLive2Schedule({ env: {}, argv: [], gate: {}, hooks, bootMs: 0,
      setTimeout: (fn, ms) => { const timer = { fn, ms }; timers.push(timer); return timer; },
      clearTimeout: () => {}, startRound: async () => {
        starts++;
        if (busy) {
          if (finishDuringStart) { busy = false; hooks.onRoundDone(Date.now(), "A"); }
          return { started: false, running: true };
        }
        return { started: true, running: true };
      } });
    await timers[0].fn();
    if (!finishDuringStart) { busy = false; hooks.onRoundDone(Date.now(), "A"); }
    assert.equal(timers.at(-1).ms, 0);
    assert.equal(timers.length, 2);
    await timers.at(-1).fn();
    assert.equal(starts, 2);
    hooks.onRoundDone(Date.now(), "");
    assert.ok(timers.at(-1).ms > LIVE2_INTERVAL_MS - 1000);
  });
}

test("collector completion identifies single-shop jobs separately from full rounds", async () => {
  let pending;
  const scopes = [];
  const collector = createLive2Collector({ storePath: "", loadOrg: async () => [],
    listSessions: async () => [], listSamples: async () => [],
    onRoundDone: (_began, only) => scopes.push(only), track: task => { pending = task; } });
  await collector.start("", "A"); await pending;
  await collector.start("", ""); await pending;
  assert.deepEqual(scopes, ["A", ""]);
});

test("live2 schedule starts one round and does not stack a second while it runs", async () => {
  const waits = [];
  const cookies = [];
  let release;
  const hold = new Promise(function (resolve) {
    release = resolve;
  });
  let running = false;
  let rounds = 0;
  const hooks = {};
  let booted = false;
  let markDone;
  const done = new Promise(function (resolve) {
    markDone = resolve;
  });
  const armed = armLive2Schedule({
    env: {},
    argv: [],
    gate: {},
    hooks,
    bootMs: 0,
    readCookie: function () {
      return "xm=kept";
    },
    setTimeout: function (fn, ms) {
      waits.push(ms);
      if (!booted && ms === 0) {
        booted = true;
        fn();
      }
      return waits.length;
    },
    clearTimeout: function () {},
    startRound: async function (cookie) {
      cookies.push(cookie);
      if (running) {
        return { started: false, running: true };
      }
      running = true;
      rounds += 1;
      await hold;
      running = false;
      hooks.onRoundDone(Date.now() - 12 * 60 * 1000);
      markDone();
      return { started: true, running: true };
    }
  });
  assert.equal(armed.started, true);
  assert.equal(rounds, 1);
  assert.deepEqual(cookies, ["xm=kept"]);
  release();
  await done;
  assert.equal(rounds, 1);
  assert.ok(waits.filter(function (ms) { return ms === 0; }).length >= 2);
});
