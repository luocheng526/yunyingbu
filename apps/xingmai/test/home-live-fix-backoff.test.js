import "./_memory-env.js";
import assert from "node:assert/strict";
import test from "node:test";
import { buildLiveView, collectAuthDecision, runTick } from "../src/modules/home/jingmai.js";
import {
  recoverDroppedShops,
  resetJingmaiDeps,
  setJingmaiDeps
} from "../src/modules/home/jingmai-runner.js";
import { listSessions, resetJingmaiStore, saveSession } from "../src/modules/home/jingmai-store.js";

test("ads-only auth stays logged-in in live view with adsFailed", () => {
  const now = { day: "2026-11-19", stamp: "2026-11-19 10:05:00" };
  const view = buildLiveView({
    now: now,
    shops: [
      {
        store: "广告异常店",
        enabled: true,
        cookies: [{ name: "thor", value: "alive" }],
        authState: "offline",
        authMessage: "京准通没有可用账号 -100",
        linkedAt: "2026-11-19 09:50:00"
      }
    ],
    samples: [
      {
        store: "广告异常店",
        day: "2026-11-19",
        capturedAt: "2026-11-19 10:00:00",
        dealAmount: 500,
        paidAmount: null,
        ok: true
      }
    ]
  });
  assert.equal(view.shops[0].online, true);
  assert.equal(view.shops[0].loginExpired, false);
  assert.equal(view.shops[0].offline, false);
  assert.equal(view.shops[0].adsFailed, true);
  assert.match(view.shops[0].adsReason, /京准通/);
});

test("collectAuthDecision keeps paid/timeout off login_expired", () => {
  assert.equal(collectAuthDecision({ code: "paid", message: "京准通 -100" }).authState, "offline");
  assert.equal(collectAuthDecision({ code: "timeout", message: "采集超时" }).authState, "offline");
  assert.equal(collectAuthDecision({ code: "login", message: "x" }).authState, "login_expired");
});

test("runTick notes fail backoff and skips held shops next round", async () => {
  const noted = [];
  const held = new Set();
  let fetches = 0;
  await runTick({
    inflight: new Set(),
    tickLock: { busy: false },
    collectConcurrency: 1,
    collectBudgetMs: 2000,
    collectBuckets: new Map(),
    backoffHold: function (store) {
      return held.has(store) ? { until: Date.now() + 60000 } : null;
    },
    noteFailBackoff: function (store, kind) {
      noted.push({ store: store, kind: kind });
      held.add(store);
    },
    clearFailBackoff: function () {},
    listTargets: async function () {
      return [
        {
          store: "退避店",
          enabled: true,
          authState: "ok",
          cookies: [{ name: "thor", value: "1", domain: ".jd.com", path: "/" }],
          shopId: "1",
          sessionGen: 1
        }
      ];
    },
    fetchAccountIdentity: async function () {
      return { shopId: "1", shopName: "退避店" };
    },
    fetchHome: async function () {
      fetches += 1;
      const err = new Error("京准通没有可用账号 -100");
      err.code = "paid";
      throw err;
    },
    saveSample: async function () {},
    markAuth: async function () {},
    updateSessionCookies: async function () {},
    now: function () {
      return { day: "2026-11-19", stamp: "2026-11-19 10:00:00" };
    }
  });
  assert.equal(fetches, 1);
  assert.equal(noted[0].kind, "ads");
  await runTick({
    inflight: new Set(),
    tickLock: { busy: false },
    collectConcurrency: 1,
    collectBudgetMs: 2000,
    collectBuckets: new Map(),
    backoffHold: function (store) {
      return held.has(store) ? { until: Date.now() + 60000 } : null;
    },
    noteFailBackoff: function (store, kind) {
      noted.push({ store: store, kind: kind });
    },
    clearFailBackoff: function () {},
    listTargets: async function () {
      return [
        {
          store: "退避店",
          enabled: true,
          authState: "ok",
          cookies: [{ name: "thor", value: "1", domain: ".jd.com", path: "/" }],
          shopId: "1",
          sessionGen: 1
        }
      ];
    },
    fetchAccountIdentity: async function () {
      return { shopId: "1", shopName: "退避店" };
    },
    fetchHome: async function () {
      fetches += 1;
      return { dealAmount: 9 };
    },
    saveSample: async function () {},
    markAuth: async function () {},
    now: function () {
      return { day: "2026-11-19", stamp: "2026-11-19 10:05:00" };
    }
  });
  assert.equal(fetches, 1);
  assert.equal(noted.length, 1);
});

test("recoverDroppedShops skips ads-only sessions and caps attempts", async () => {
  await resetJingmaiStore();
  await saveSession("广告店", {
    cookies: [{ name: "thor", value: "x" }],
    authState: "offline",
    authMessage: "京准通没有可用账号 -100",
    shopId: "9"
  });
  await saveSession("真掉线店", {
    cookies: [],
    authState: "login_expired",
    authMessage: "登录已失效，请重新登录",
    shopId: "8"
  });
  let logins = 0;
  setJingmaiDeps({
    loadOrg: async () => [
      { store: "广告店", enabled: true, login: "a", password: "p", shopId: "9" },
      { store: "真掉线店", enabled: true, login: "b", password: "p", shopId: "8" }
    ],
    client: {
      login: async function () {
        logins += 1;
        return [{ name: "thor", value: "fresh" }];
      },
      fetchAccountIdentity: async function () {
        return { shopId: "8", shopName: "真掉线店" };
      },
      fetchHome: async function () {
        return { dealAmount: 1 };
      }
    },
    desk: {
      open: async function () {
        return { status: "idle" };
      },
      close: async function () {},
      poll: async function () {
        return { status: "idle" };
      }
    }
  });
  try {
    const result = await recoverDroppedShops("cookie");
    assert.equal(logins, 1);
    assert.equal(result.attempted, 1);
    assert.equal(result.recovered, 1);
    const ads = (await listSessions()).find((row) => row.store === "广告店");
    assert.equal(ads.cookies[0].value, "x");
  } finally {
    resetJingmaiDeps();
  }
});
