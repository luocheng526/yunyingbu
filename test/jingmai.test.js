import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createApp } from "../src/app.js";
import {
  buildLiveView,
  collectPinIds,
  alignOnlineDealSeries,
  fiveMinuteStamp,
  sharedFiveMinuteStamp,
  dealPointsFromSamples,
  extractPaid,
  extractShopDeal,
  parseHomeCard,
  resolveDealCompare,
  sumDealCompare,
  hoursFromSamples,
  jingmaiError,
  paidQuery,
  parseRealtime,
  runTick
} from "../src/modules/shen/jingmai.js";
import { fetchHome, interpretQrCheck } from "../src/modules/shen/jingmai-client.js";
import { passwordFailureMessage } from "../src/modules/shen/jingmai-client.js";
import { libraryPackageNames, loginScreenState, packageFilename, suiteForGlibc } from "../src/modules/shen/jingmai-desk.js";
import { beginRelogin, beginReloginAll, connectJingmai, reloginState, resetJingmaiDeps, setJingmaiDeps } from "../src/modules/shen/jingmai-runner.js";
import { listCollectTargets, listSessions, readJingmaiLive, resetJingmaiStore, saveSample, saveSession } from "../src/modules/shen/jingmai-store.js";

const now = { day: "2026-11-12", stamp: "2026-11-12 11:05:00", hour: 11, clock: "11:05:00" };

function shop(name) {
  return { store: name, enabled: true, authState: "ok", cookies: [{ name: "thor", value: name }] };
}

test("a login page that still has the account box stays on screen", () => {
  assert.equal(loginScreenState("登录异常 忘记密码", true).status, "verify");
  assert.equal(loginScreenState("登录异常 忘记密码", true).message, "");
  assert.equal(loginScreenState("登录异常，请稍后再试", false).status, "verify");
  assert.match(loginScreenState("登录异常，请稍后再试", false).message, /请过一会儿再试/);
  assert.equal(loginScreenState("账号或密码不正确", true).status, "login");
});

test("chrome library map names libatk and skips libc", () => {
  assert.deepEqual(libraryPackageNames("libatk-1.0.so.0"), ["libatk1.0-0t64", "libatk1.0-0"]);
  assert.deepEqual(libraryPackageNames("libc.so.6"), []);
  assert.deepEqual(libraryPackageNames("libwayland-server.so.0"), ["libwayland-server0"]);
  assert.deepEqual(libraryPackageNames("libxcb-dri3.so.0"), ["libxcb-dri3-0"]);
  const index = "Package: libatk1.0-0\nFilename: pool/old/libatk.deb\n\nPackage: libatk1.0-0t64\nFilename: pool/main/a/at-spi2-core/libatk1.0-0t64_2.52.0-1build1_amd64.deb\n\n";
  assert.equal(packageFilename(index, "libatk1.0-0t64"), "pool/main/a/at-spi2-core/libatk1.0-0t64_2.52.0-1build1_amd64.deb");
  assert.equal(packageFilename(index, "libatk1.0-0"), "pool/old/libatk.deb");
  assert.equal(packageFilename(index, "missing"), "");
  assert.equal(suiteForGlibc("2.39"), "noble");
  assert.equal(suiteForGlibc("2.35"), "jammy");
  assert.equal(suiteForGlibc("2.36"), "jammy");
  assert.equal(suiteForGlibc("2.31"), "focal");
});

test("realtime parser keeps a real zero and treats login failure separately from timeout", () => {
  const metrics = parseRealtime(200, JSON.stringify({ content: { OrdAmt: { value: 0, preValue: 12 }, OrdNum: 0, OrdCustNum: 3 } }), "");
  assert.equal(metrics.dealAmount, 0);
  assert.equal(metrics.orderCount, 0);
  assert.equal(metrics.customerCount, 3);
  assert.equal(metrics.yesterdayAmount, 12);
  assert.throws(() => parseRealtime(401, "no", ""), (error) => error.code === "login");
  assert.throws(() => parseRealtime(200, "<html>请登录</html>", ""), (error) => error.code === "login");
  assert.throws(() => parseRealtime(500, "<html>busy</html>", ""), (error) => error.code === "network");
  const timeout = jingmaiError("timeout", "采集超时");
  assert.equal(timeout.code, "timeout");
});

test("homepage deal and jingzhuntong paid fields stay separate", () => {
  const deal = extractShopDeal({
    data: {
      channelData: {
        indicatorList: [
          { code: "3009", name: "成交总金额", todayNum: "12,967.90", yesterdayNum: "17,920.00" },
          { code: "3001", name: "成交总单量", todayNum: 42 },
          { code: "3008", name: "成交客户数", todayNum: "41" },
          { code: "3010", name: "PC成交金额", todayNum: "100.00" }
        ]
      }
    }
  });
  assert.equal(deal.dealAmount, 12967.9);
  assert.equal(deal.orderCount, 42);
  assert.equal(deal.customerCount, 41);
  assert.equal(deal.yesterdayAmount, 17920);
  const paid = extractPaid({
    summary: [
      { index: "cost", value: 6507.32 },
      { index: "totalOrderSum", value: 11968 },
      { index: "ROI", value: 2.17 }
    ]
  });
  assert.equal(paid.paidAmount, 6507.32);
  assert.equal(paid.paidDeal, 11968);
  assert.equal(paid.paidRoi, 2.17);
  assert.notEqual(paid.paidRoi, paid.paidDeal / paid.paidAmount);
  const query = paidQuery("2026-11-12", [101, 102]);
  assert.deepEqual(query.businessType, [-4, 256]);
  assert.equal(query.clickOrOrderDay, 15);
  assert.equal(query.clickOrOrderCaliber, 0);
  assert.equal(query.isGift, 0);
  assert.equal(query.orderStatusCategory, 1);
  assert.equal(query.startDate, "2026-11-12");
  assert.deepEqual(collectPinIds({ own: [{ userId: 7 }, { userId: "8" }], value: [{ userId: 7 }] }, { value: [{ userId: 9 }] }), [7, 8, 9]);
});

test("paid numbers count as a successful collection when deal is still empty", () => {
  const view = buildLiveView({
    now: now,
    shops: [{ store: "甲店", enabled: true, authState: "ok", cookies: [{ name: "thor", value: "secret" }] }],
    samples: [
      {
        store: "甲店",
        day: "2026-11-12",
        capturedAt: "2026-11-12 13:08:00",
        dealAmount: null,
        paidAmount: 0,
        paidDeal: 11968,
        paidRoi: 2.17,
        ok: true
      }
    ]
  });
  assert.equal(view.successShops, 1);
  assert.equal(view.shops[0].dealAmount, null);
  assert.equal(view.shops[0].paidAmount, 0);
  assert.equal(view.shops[0].paidRoi, 2.17);
  assert.equal(view.shops[0].online, false);
  assert.equal(view.shops[0].offline, true);
  assert.match(view.shops[0].offlineReason, /没有成交字段/);
  assert.equal(JSON.stringify(view).includes("secret"), false);
});

test("missing hours stay empty and a collected zero is kept", () => {
  const hours = hoursFromSamples(
    [
      { store: "甲店", day: "2026-11-12", capturedAt: "2026-11-12 10:05:00", dealAmount: 0, ok: true },
      { store: "甲店", day: "2026-11-12", capturedAt: "2026-11-12 10:20:00", dealAmount: 8, ok: true }
    ],
    "2026-11-12"
  );
  assert.equal(hours[9], null);
  assert.equal(hours[10], 8);
  assert.equal(hours[11], null);
  assert.equal(hours.filter((value) => value === 0).length, 0);
  const paid = hoursFromSamples(
    [
      { store: "甲店", day: "2026-11-12", capturedAt: "2026-11-12 09:10:00", paidAmount: 120, dealAmount: 400, ok: true },
      { store: "甲店", day: "2026-11-12", capturedAt: "2026-11-12 09:40:00", paidAmount: 180, dealAmount: 500, ok: true }
    ],
    "2026-11-12",
    "paidAmount"
  );
  assert.equal(paid[9], 180);
  assert.equal(paid[10], null);
});

test("live view counts successful shops and does not expose cookies", () => {
  const view = buildLiveView({
    now: now,
    shops: [
      { store: "甲店", enabled: true, authState: "ok", cookies: [{ name: "thor", value: "secret" }] },
      { store: "乙店", enabled: true, authState: "login_expired", cookies: [] },
      { store: "闲置店", enabled: false, authState: "ok", cookies: [{ name: "thor", value: "other" }] }
    ],
    samples: [
      {
        store: "甲店",
        day: "2026-11-12",
        capturedAt: "2026-11-12 11:05:00",
        dealAmount: 0,
        orderCount: 0,
        customerCount: 1,
        yesterdayAmount: null,
        ok: true
      }
    ]
  });
  assert.equal(view.successShops, 1);
  assert.equal(view.enabledShops, 2);
  assert.equal(view.loginExpiredShops, 1);
  assert.equal(view.shops[0].online, true);
  assert.equal(view.shops[0].offline, false);
  assert.equal(view.shops[1].online, false);
  assert.equal(view.shops[1].offline, false);
  assert.equal(view.shops[1].loginExpired, true);
  assert.equal(view.updatedAt, "2026/11/12 11:05:00");
  assert.equal(view.shops[0].dealAmount, 0);
  assert.equal(view.shops[1].dealAmount, null);
  assert.equal(JSON.stringify(view).includes("thor"), false);
  assert.equal(JSON.stringify(view).includes("secret"), false);
});

test("one slow shop does not block another, and a timeout shows offline without clearing the login", async () => {
  const saved = [];
  const marked = [];
  let calls = 0;
  await runTick({
    inflight: new Set(),
    now: () => now,
    listTargets: async () => [shop("慢店"), shop("快店")],
    fetchHome: async (cookies) => {
      calls += 1;
      if (cookies[0].value === "慢店") {
        await new Promise((resolve) => setTimeout(resolve, 40));
        throw jingmaiError("timeout", "采集超时");
      }
      return { dealAmount: 5, orderCount: 1, customerCount: 1, yesterdayAmount: 4 };
    },
    saveSample: async (sample) => {
      saved.push(sample.store);
    },
    markAuth: async (store, state, message) => {
      marked.push([store, state, message]);
    }
  });
  assert.equal(calls, 2);
  assert.deepEqual(saved, ["快店"]);
  assert.deepEqual(marked, [["慢店", "offline", "采集超时"]]);
});

test("a missing deal field shows offline and a later deal clears it", async () => {
  const marked = [];
  await runTick({
    inflight: new Set(),
    now: () => now,
    listTargets: async () => [shop("缺字段店")],
    fetchHome: async () => ({ dealAmount: null, paidAmount: 12, dealNote: "京麦首页没有成交字段" }),
    saveSample: async () => {},
    markAuth: async (store, state, message) => {
      marked.push([store, state, message]);
    }
  });
  assert.deepEqual(marked, [["缺字段店", "offline", "京麦首页没有成交字段"]]);
  marked.length = 0;
  await runTick({
    inflight: new Set(),
    now: () => now,
    listTargets: async () => [{ store: "缺字段店", enabled: true, authState: "offline", cookies: [{ name: "thor", value: "x" }] }],
    fetchHome: async () => ({ dealAmount: 8, orderCount: 1, customerCount: 1 }),
    saveSample: async () => {},
    markAuth: async (store, state, message) => {
      marked.push([store, state, message]);
    }
  });
  assert.deepEqual(marked, [["缺字段店", "ok", ""]]);
});

test("a stopped collector shows offline while the saved session stays", () => {
  const view = buildLiveView({
    now: { day: "2026-11-14", stamp: "2026-11-14 09:19:00", hour: 9, clock: "09:19:00" },
    shops: [{ store: "甲店", enabled: true, authState: "ok", authMessage: "", cookies: [{ name: "thor", value: "secret" }] }],
    samples: [
      {
        store: "甲店",
        day: "2026-11-13",
        capturedAt: "2026-11-13 18:00:00",
        dealAmount: 1516.59,
        paidAmount: 80,
        ok: true
      }
    ]
  });
  assert.equal(view.shops[0].online, false);
  assert.equal(view.shops[0].offline, true);
  assert.equal(view.shops[0].loginExpired, false);
  assert.equal(view.shops[0].offlineReason, "采集已停止");
  assert.equal(view.shops[0].dealAmount, null);
});

test("the same shop is not queued twice", async () => {
  let calls = 0;
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  const inflight = new Set();
  const deps = {
    inflight: inflight,
    now: () => now,
    listTargets: async () => [shop("甲店")],
    fetchHome: () => {
      calls += 1;
      return pending;
    },
    saveSample: async () => {},
    markAuth: async () => {}
  };
  const first = runTick(deps);
  const second = runTick(deps);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 1);
  release({ dealAmount: 1, orderCount: 1, customerCount: 1, yesterdayAmount: null });
  await first;
  await second;
});

test("disabled shops are not collected and a dead login is marked", async () => {
  const calls = [];
  const marked = [];
  await runTick({
    inflight: new Set(),
    now: () => now,
    listTargets: async () => [
      { store: "停用店", enabled: false, authState: "ok", cookies: [{ name: "thor", value: "x" }] },
      { store: "掉线店", enabled: true, authState: "ok", cookies: [{ name: "thor", value: "y" }] }
    ],
    fetchHome: async (cookies) => {
      calls.push(cookies[0].value);
      throw jingmaiError("login", "登录已失效，请重新登录");
    },
    saveSample: async () => {
      throw new Error("should not save");
    },
    markAuth: async (store, state) => {
      marked.push(store + ":" + state);
    }
  });
  assert.deepEqual(calls, ["y"]);
  assert.deepEqual(marked, ["掉线店:login_expired"]);
});

test("connect uses org accounts without returning the password", async () => {
  await resetJingmaiStore();
  const seen = [];
  setJingmaiDeps({
    loadOrg: async () => [
      { store: "甲店", enabled: true, login: "seller", password: "secret-pass" },
      { store: "闲置店", enabled: false, login: "idle", password: "secret-pass" }
    ],
    client: {
      login: async (login) => {
        seen.push(login);
        return [{ name: "thor", value: "jar-" + login }];
      },
      fetchHome: async () => ({ dealAmount: 10, orderCount: 2, customerCount: 2, yesterdayAmount: 9 })
    }
  });
  try {
    const result = await connectJingmai({ cookie: "mk_sid=test" });
    assert.equal(result.linked, 1);
    assert.deepEqual(seen, ["seller"]);
    assert.equal(JSON.stringify(result).includes("secret-pass"), false);
    const sessions = await listSessions();
    const linked = sessions.find((item) => item.store === "甲店");
    assert.equal(linked.authState, "ok");
    assert.equal(linked.cookies[0].value, "jar-seller");
    const idle = sessions.find((item) => item.store === "闲置店");
    assert.equal(idle.enabled, false);
    const live = await readJingmaiLive(now);
    assert.equal(live.shops.find((item) => item.shop === "甲店").dealAmount, 10);
    assert.equal(JSON.stringify(live).includes("secret-pass"), false);
    assert.equal(JSON.stringify(live).includes("jar-seller"), false);
  } finally {
    resetJingmaiDeps();
    await resetJingmaiStore();
  }
});

test("offline shops stay in the collector and a dead login does not", async () => {
  await resetJingmaiStore();
  await saveSession("在线店", { cookies: [{ name: "thor", value: "a" }], authState: "ok", enabled: true });
  await saveSession("超时店", { cookies: [{ name: "thor", value: "b" }], authState: "offline", authMessage: "采集超时", enabled: true });
  await saveSession("失效店", { cookies: [{ name: "thor", value: "c" }], authState: "login_expired", enabled: true });
  try {
    const names = (await listCollectTargets()).map(function (row) {
      return row.store;
    });
    assert.equal(names.includes("在线店"), true);
    assert.equal(names.includes("超时店"), true);
    assert.equal(names.includes("失效店"), false);
    const timed = (await listSessions()).find(function (row) {
      return row.store === "超时店";
    });
    assert.equal(timed.cookies[0].value, "b");
  } finally {
    await resetJingmaiStore();
  }
});

test("connect timeout does not mark the shop logged out", async () => {
  await resetJingmaiStore();
  await saveSession("甲店", {
    cookies: [{ name: "thor", value: "keep" }],
    authState: "ok",
    authMessage: "",
    enabled: true
  });
  setJingmaiDeps({
    loadOrg: async () => [{ store: "甲店", enabled: true, login: "seller", password: "secret-pass" }],
    client: {
      login: async () => {
        throw jingmaiError("timeout", "采集超时");
      },
      fetchHome: async () => {
        throw new Error("should not fetch");
      }
    }
  });
  try {
    const result = await connectJingmai({ cookie: "mk_sid=test" });
    assert.equal(result.results[0].auth, false);
    assert.equal(result.results[0].message, "连接超时，请稍后再试");
    const sessions = await listSessions();
    assert.equal(sessions[0].authState, "ok");
    assert.equal(sessions[0].cookies[0].value, "keep");
  } finally {
    resetJingmaiDeps();
    await resetJingmaiStore();
  }
});

test("jingmai rejection keeps the server screen open", async () => {
  await resetJingmaiStore();
  let closed = 0;
  setJingmaiDeps({
    loadOrg: async () => [{ store: "甲店", enabled: true, login: "acct", password: "secret-pass" }],
    client: { fetchHome: async () => ({ dealAmount: 1, orderCount: 1, customerCount: 1, yesterdayAmount: null }) },
    desk: {
      open: async () => ({ status: "verify", message: "京麦拒绝了这次服务器登录，请过一会儿再试" }),
      poll: async () => ({ status: "verify", message: "京麦拒绝了这次服务器登录，请过一会儿再试" }),
      shot: async () => Buffer.from([1, 2, 3]),
      click: async () => {},
      type: async () => {},
      close: async () => {
        closed += 1;
      },
      reset() {}
    }
  });
  try {
    const opened = await beginRelogin("甲店", "mk_sid=test");
    assert.equal(opened.status, "screen");
    assert.match(opened.message, /请过一会儿再试/);
    const afterOpen = closed;
    const waiting = await reloginState("甲店");
    assert.equal(waiting.status, "screen");
    assert.equal(closed, afterOpen);
    const live = await readJingmaiLive();
    assert.equal(live.shops.some((item) => item.loginExpired), false);
  } finally {
    resetJingmaiDeps();
    await resetJingmaiStore();
  }
});

test("server login keeps the password and session off the response", async () => {
  assert.equal(passwordFailureMessage({ data: { emptyAuthcode: true } }), "请先完成滑动验证");
  assert.equal(passwordFailureMessage({ code: 0, data: { failCode: 2 } }), "账号或密码不正确");
  assert.equal(interpretQrCheck({ resultInfo: { result: { state: "11" } } }), "expired");
  await resetJingmaiStore();
  let seenPassword = "";
  let polls = 0;
  setJingmaiDeps({
    loadOrg: async () => [{ store: "甲店", enabled: true, login: "seller", password: "secret-pass" }],
    client: {
      fetchHome: async () => ({ dealAmount: 0, orderCount: 1, customerCount: 1, yesterdayAmount: null })
    },
    desk: {
      open: async ({ password }) => {
        seenPassword = password;
        return { status: "verify" };
      },
      poll: async () => {
        polls += 1;
        if (polls < 2) {
          return { status: "verify", message: "" };
        }
        return { status: "ok", cookies: [{ name: "thor", value: "hidden-jar" }] };
      },
      shot: async () => Buffer.from([1, 2, 3]),
      click: async () => {},
      type: async () => {},
      close: async () => {},
      reset() {}
    }
  });
  try {
    const opened = await beginRelogin("甲店", "mk_sid=test");
    assert.equal(opened.status, "screen");
    assert.equal(seenPassword, "secret-pass");
    assert.equal(JSON.stringify(opened).includes("secret-pass"), false);
    assert.equal(JSON.stringify(opened).includes("hidden-jar"), false);
    const waiting = await reloginState("甲店");
    assert.equal(waiting.status, "screen");
    const done = await reloginState("甲店");
    assert.equal(done.status, "ok");
    assert.equal(JSON.stringify(done).includes("secret-pass"), false);
    assert.equal(JSON.stringify(done).includes("hidden-jar"), false);
    const live = await readJingmaiLive();
    const shop = live.shops.find((item) => item.shop === "甲店");
    assert.equal(shop.dealAmount, 0);
    assert.equal(shop.loginExpired, false);
  } finally {
    resetJingmaiDeps();
    await resetJingmaiStore();
  }
});

test("server login walks every shop and skips one that is already in", async () => {
  await resetJingmaiStore();
  await saveSession("已登录店", {
    cookies: [{ name: "thor", value: "keep" }],
    authState: "ok",
    authMessage: "",
    enabled: true
  });
  const seen = [];
  setJingmaiDeps({
    loadOrg: async () => [
      { store: "已登录店", enabled: true, login: "old", password: "secret-old" },
      { store: "乙店", enabled: true, login: "next", password: "secret-next" }
    ],
    client: {
      fetchHome: async () => ({ dealAmount: 12, orderCount: 1, customerCount: 1, yesterdayAmount: null })
    },
    desk: {
      open: async ({ store, password }) => {
        seen.push(store + ":" + password);
        return { status: "ok", cookies: [{ name: "thor", value: "hidden-jar" }] };
      },
      poll: async () => ({ status: "missing" }),
      shot: async () => null,
      click: async () => {},
      type: async () => {},
      close: async () => {},
      reset() {}
    }
  });
  try {
    const opened = await beginReloginAll("mk_sid=test");
    assert.equal(opened.status, "ok");
    assert.deepEqual(seen, ["乙店:secret-next"]);
    assert.equal(JSON.stringify(opened).includes("secret-next"), false);
    assert.equal(JSON.stringify(opened).includes("hidden-jar"), false);
  } finally {
    resetJingmaiDeps();
    await resetJingmaiStore();
  }
});

test("jingmai route returns collected deals and hides the session", async () => {
  await resetJingmaiStore();
  await saveSession("甲店", {
    cookies: [{ name: "thor", value: "hidden" }],
    authState: "ok",
    authMessage: "",
    enabled: true
  });
  await saveSample({
    store: "甲店",
    day: "2026-11-12",
    capturedAt: "2026-11-12 11:05:00",
    dealAmount: 0,
    orderCount: 0,
    customerCount: 4,
    yesterdayAmount: null,
    ok: true
  });
  const server = http.createServer(createApp());
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/shen/paid/jingmai`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.source, "shen-jingmai");
    const shop = body.shops.find((item) => item.shop === "甲店");
    assert.equal(shop.dealAmount, 0);
    assert.equal(shop.orderCount, 0);
    assert.equal(JSON.stringify(body).includes("hidden"), false);
    assert.equal(shop.dealNote || "", "");
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await resetJingmaiStore();
  }
});

function jsonReply(body, status = 200) {
  return {
    status: status,
    headers: { get: () => "" },
    text: async () => (typeof body === "string" ? body : JSON.stringify(body))
  };
}

test("homepage card text keeps today's deal amount", () => {
  const card = parseHomeCard("经营数据\n成交金额\n¥12,967.90\n较昨日 -27.63%\n成交单量\n42\n较昨日 +9%\n成交客户数\n41\n");
  assert.equal(card.dealAmount, 12967.9);
  assert.equal(card.orderCount, 42);
  assert.equal(card.customerCount, 41);
  assert.equal(card.dealRate, -27.63);
  assert.equal(card.dealRateLabel, "较昨日");
  assert.equal(card.yesterdayAmount, null);
  assert.equal(parseHomeCard("推广数据\n花费 5"), null);
});

test("deal compare uses the jingmai card amount and signed rate", () => {
  const card = parseHomeCard(
    "经营数据\n成交金额\n¥1,516.59\n较昨日 +45.46%\n成交单量\n13\n较昨日 +33.33%\n更新时间：2026/11/13 11:04:00"
  );
  assert.equal(card.dealRate, 45.46);
  assert.equal(card.dealRateLabel, "较昨日");
  assert.equal(card.platformUpdatedAt, "2026-11-13 11:04:00");
  const samePeriod = parseHomeCard("经营数据\n成交金额\n¥10\n较昨日同时段 -20%\n成交单量\n1");
  assert.equal(samePeriod.dealRateLabel, "较昨日同时段");
  assert.equal(samePeriod.dealRate, -20);
  const raised = resolveDealCompare({ dealAmount: 1516.59, dealRate: 45.46, dealRateLabel: "较昨日" });
  assert.equal(raised.rate, 45.46);
  assert.equal(raised.estimated, true);
  assert.ok(Math.abs(raised.yesterday - 1516.59 / 1.4546) < 1e-9);
  const dropped = resolveDealCompare({ dealAmount: 80, dealRate: -20, dealRateLabel: "较昨日" });
  assert.equal(dropped.yesterday, 100);
  const wiped = resolveDealCompare({ dealAmount: 0, dealRate: -100, dealRateLabel: "较昨日" });
  assert.equal(wiped.rate, -100);
  assert.equal(wiped.yesterday, null);
  assert.equal(wiped.comparable, false);
  const missing = resolveDealCompare({ dealAmount: 10, dealRate: null, yesterdayAmount: null });
  assert.equal(missing.rate, null);
  assert.equal(missing.comparable, false);
  const original = resolveDealCompare({ dealAmount: 1516.59, yesterdayAmount: 1042.62, dealRate: 45.46, dealRateLabel: "较昨日" });
  assert.equal(original.yesterday, 1042.62);
  assert.equal(original.estimated, false);
  const summed = sumDealCompare([
    { today: 100, yesterday: 50, comparable: true, estimated: true, label: "较昨日" },
    { today: 100, yesterday: 200, comparable: true, estimated: true, label: "较昨日" },
    { today: 50, yesterday: null, comparable: false, estimated: false, label: "" }
  ]);
  assert.equal(summed.today, 250);
  assert.equal(summed.cohortToday, 200);
  assert.equal(summed.cohortYesterday, 250);
  assert.ok(Math.abs(summed.rate - -20) < 1e-9);
  assert.equal(summed.comparable, 2);
  assert.equal(summed.total, 3);
  const flat = sumDealCompare([{ today: 20, yesterday: 0, comparable: true, label: "较昨日" }]);
  assert.equal(flat.rate, null);
  assert.equal(flat.today, 20);
});

test("each collection keeps its own comparison and gaps stay empty", () => {
  const points = dealPointsFromSamples(
    [
      { day: "2026-11-13", capturedAt: "2026-11-13 10:02:00", dealAmount: 100, dealRate: 0, ok: true },
      { day: "2026-11-13", capturedAt: "2026-11-13 10:04:00", dealAmount: 110, dealRate: 10, ok: true },
      { day: "2026-11-13", capturedAt: "2026-11-13 12:10:00", dealAmount: 200, yesterdayAmount: 100, ok: true },
      { day: "2026-11-12", capturedAt: "2026-11-12 10:04:00", dealAmount: 1, dealRate: 90, ok: true }
    ],
    "2026-11-13"
  );
  assert.equal(points.length, 2);
  assert.equal(points[0].slot, "10:00");
  assert.equal(points[0].today, 110);
  assert.ok(Math.abs(points[0].yesterday - 100) < 1e-9);
  assert.equal(points[0].estimated, true);
  assert.equal(points[1].slot, "12:10");
  assert.equal(points[1].yesterday, 100);
  assert.equal(points[1].estimated, false);
  assert.equal(points.some((point) => point.slot === "11:00"), false);
  const view = buildLiveView({
    now: { day: "2026-11-13", stamp: "2026-11-13 11:07:00", hour: 11, clock: "11:07:00" },
    shops: [{ store: "RASW潮流生活旗舰店", enabled: true, authState: "ok", cookies: [{ name: "thor", value: "secret" }] }],
    samples: [
      { store: "RASW潮流生活旗舰店", day: "2026-11-12", capturedAt: "2026-11-12 11:07:00", dealAmount: 999, ok: true },
      {
        store: "RASW潮流生活旗舰店",
        day: "2026-11-13",
        capturedAt: "2026-11-13 11:07:00",
        dealAmount: 1516.59,
        dealRate: 45.46,
        dealRateLabel: "较昨日",
        paidAmount: 919.81,
        ok: true
      }
    ]
  });
  const shop = view.shops[0];
  assert.equal(shop.dealAmount, 1516.59);
  assert.equal(shop.dealRate, 45.46);
  assert.notEqual(shop.yesterdayAmount, 999);
  assert.equal(shop.yesterdayEstimated, true);
  assert.equal(shop.paidAmount, 919.81);
  assert.equal(shop.paidRate, undefined);
  const paid = extractPaid({ summary: [{ index: "cost", value: 100, rate: 45.46 }] });
  assert.equal(paid.paidAmount, 100);
  assert.equal(paid.dealRate, undefined);
});

test("shop update times share one five-minute slot", () => {
  assert.equal(fiveMinuteStamp("2026/11/13 13:02:03"), "2026/11/13 13:00");
  assert.equal(fiveMinuteStamp("2026/11/13 13:06:55"), "2026/11/13 13:05");
  assert.equal(fiveMinuteStamp("2026/11/13 13:11:36"), "2026/11/13 13:10");
  assert.equal(fiveMinuteStamp("2026-11-13 13:00:00"), "2026/11/13 13:00");
  assert.equal(
    sharedFiveMinuteStamp(["2026/11/13 13:02:03", "2026/11/13 13:06:55", "2026/11/13 13:11:36"]),
    "2026/11/13 13:10"
  );
});

test("chart slots keep every online shop instead of the shops captured in that minute", () => {
  const series = alignOnlineDealSeries([
    {
      online: true,
      dealPoints: [
        { index: 154, slot: "12:50", today: 100, yesterday: 80, comparable: true, estimated: true, label: "较昨日" },
        { index: 156, slot: "13:00", today: 130, yesterday: 100, comparable: true, estimated: true, label: "较昨日" }
      ]
    },
    {
      online: true,
      dealPoints: [{ index: 155, slot: "12:55", today: 50, yesterday: 40, comparable: true, estimated: false, label: "较昨日" }]
    },
    { online: true, dealPoints: [] },
    { online: false, dealPoints: [{ index: 154, slot: "12:50", today: 999, yesterday: 1, comparable: true, label: "较昨日" }] }
  ]);
  assert.deepEqual(series.map((point) => point.slot), ["12:50", "12:55", "13:00"]);
  assert.equal(series[0].n, 1);
  assert.equal(series[0].total, 3);
  assert.equal(series[1].n, 2);
  assert.equal(series[1].today, 150);
  assert.equal(series[2].n, 2);
  assert.equal(series[2].today, 180);
  assert.equal(series[2].total, 3);
  assert.equal(series.some((point) => point.today === 999), false);
});

test("deal card is read from the layer that contains channel data", () => {
  const metrics = extractShopDeal({
    code: 200,
    data: {
      freeBrand: false,
      channelData: {
        indicatorList: [{ code: "3009", name: "成交总金额", todayNum: "12,967.90", yesterdayNum: "17920" }]
      },
      data: { freeBrand: false }
    }
  });
  assert.equal(metrics.dealAmount, 12967.9);
  assert.equal(metrics.yesterdayAmount, 17920);
});

test("a busy homepage retries and then reads the deal card", async () => {
  const previous = process.env.SHEN_DEAL_RETRY_MS;
  process.env.SHEN_DEAL_RETRY_MS = "0";
  let shopCalls = 0;
  try {
    const result = await fetchHome([{ name: "thor", value: "hidden-jar" }], async (url) => {
      if (String(url).includes("findAccountInfo")) {
        return jsonReply({ code: 200, data: { currentBelongType: 200, belongVos: [{ belongType: 200, businessFieldCode: "omni" }] } });
      }
      if (String(url).includes("findShopDataByChannel")) {
        shopCalls += 1;
        if (shopCalls < 3) {
          return jsonReply({ code: 601, msg: "操作频繁，请稍后重试" });
        }
        return jsonReply({
          code: "200",
          data: { channelData: { indicatorList: [{ code: "3009", name: "成交总金额", todayNum: "8,614.12", yesterdayNum: "1000" }] } }
        });
      }
      if (String(url).includes("pinlist")) {
        return jsonReply({ code: 1, data: { own: [{ userId: 7 }] } });
      }
      if (String(url).includes("summary/overview")) {
        return jsonReply({ code: 1, data: { summary: [{ index: "cost", value: "10" }, { index: "totalOrderSum", value: "20" }, { index: "ROI", value: "2" }] } });
      }
      return jsonReply("<html>busy</html>");
    });
    assert.equal(result.dealAmount, 8614.12);
    assert.equal(result.paidAmount, 10);
    assert.equal(shopCalls, 3);
  } finally {
    if (previous == null) {
      delete process.env.SHEN_DEAL_RETRY_MS;
    } else {
      process.env.SHEN_DEAL_RETRY_MS = previous;
    }
  }
});

test("a hung deal request releases the queue for the next shop", async () => {
  const previousGate = process.env.SHEN_DEAL_GATE_MS;
  const previousRetry = process.env.SHEN_DEAL_RETRY_MS;
  process.env.SHEN_DEAL_GATE_MS = "30";
  process.env.SHEN_DEAL_RETRY_MS = "0";
  const first = fetchHome([{ name: "thor", value: "stuck" }], function () {
    return new Promise(function () {});
  });
  first.catch(function () {});
  await new Promise(function (resolve) {
    setTimeout(resolve, 15);
  });
  try {
    const result = await fetchHome([{ name: "thor", value: "next" }], async function (url) {
      if (String(url).includes("findShopDataByChannel")) {
        return jsonReply({
          code: "200",
          data: { channelData: { indicatorList: [{ code: "3009", name: "成交金额", todayNum: "5" }] } }
        });
      }
      if (String(url).includes("pinlist")) {
        return jsonReply({ code: 1, data: { own: [{ userId: 1 }] } });
      }
      if (String(url).includes("summary/overview")) {
        return jsonReply({ code: 1, data: { summary: [{ index: "cost", value: "1" }, { index: "totalOrderSum", value: "2" }, { index: "ROI", value: "2" }] } });
      }
      return jsonReply({ code: 200, data: {} });
    });
    assert.equal(result.dealAmount, 5);
  } finally {
    if (previousGate == null) {
      delete process.env.SHEN_DEAL_GATE_MS;
    } else {
      process.env.SHEN_DEAL_GATE_MS = previousGate;
    }
    if (previousRetry == null) {
      delete process.env.SHEN_DEAL_RETRY_MS;
    } else {
      process.env.SHEN_DEAL_RETRY_MS = previousRetry;
    }
  }
});

test("homepage deal uses the shop card and keeps the gateway reason when it fails", async () => {
  const result = await fetchHome([{ name: "thor", value: "hidden-jar" }], async (url) => {
    if (String(url).includes("findAccountInfo")) {
      return jsonReply({
        code: 200,
        data: { currentBelongType: 200, belongVos: [{ belongType: 200, businessFieldCode: "omni" }] }
      });
    }
    if (String(url).includes("findShopDataByChannel")) {
      return jsonReply({
        code: "200",
        data: {
          channelData: {
            indicatorList: [{ code: "3009", name: "成交总金额", todayNum: "1,234.50", yesterdayNum: "1000" }]
          }
        }
      });
    }
    if (String(url).includes("pinlist")) {
      return jsonReply({ code: 1, data: { own: [{ userId: 7 }] } });
    }
    if (String(url).includes("summary/overview")) {
      return jsonReply({
        code: 1,
        data: { summary: [{ index: "cost", value: "10" }, { index: "totalOrderSum", value: "20" }, { index: "ROI", value: "2" }] }
      });
    }
    return jsonReply("<html>busy</html>");
  });
  assert.equal(result.dealAmount, 1234.5);
  assert.equal(result.paidAmount, 10);
  assert.equal(result.paidRoi, 2);
  assert.equal(result.dealNote || "", "");

  const failed = await fetchHome([{ name: "thor", value: "hidden-jar" }], async (url) => {
    if (String(url).includes("findAccountInfo") || String(url).includes("findShopDataByChannel")) {
      return jsonReply({ code: 321, msg: "appId同源限制 cookie=thor" });
    }
    if (String(url).includes("pinlist")) {
      return jsonReply({ code: 1, data: { own: [{ userId: 7 }] } });
    }
    if (String(url).includes("summary/overview")) {
      return jsonReply({ code: 1, data: { summary: [{ index: "cost", value: "11" }] } });
    }
    return jsonReply("<html>未登录</html>");
  });
  assert.equal(failed.dealAmount, null);
  assert.equal(failed.paidAmount, 11);
  assert.equal(String(failed.dealNote).includes("321"), true);
  assert.equal(String(failed.dealNote).includes("thor"), false);
  assert.equal(String(failed.dealNote).includes("cookie"), false);
});
