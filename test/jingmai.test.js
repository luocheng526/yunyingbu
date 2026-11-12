import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createApp } from "../src/app.js";
import {
  buildLiveView,
  collectPinIds,
  extractPaid,
  extractShopDeal,
  parseHomeCard,
  hoursFromSamples,
  jingmaiError,
  paidQuery,
  parseRealtime,
  runTick
} from "../src/modules/shen/jingmai.js";
import { fetchHome, interpretQrCheck } from "../src/modules/shen/jingmai-client.js";
import { passwordFailureMessage } from "../src/modules/shen/jingmai-client.js";
import { libraryPackageNames, packageFilename, suiteForGlibc } from "../src/modules/shen/jingmai-desk.js";
import { beginRelogin, beginReloginAll, connectJingmai, reloginState, resetJingmaiDeps, setJingmaiDeps } from "../src/modules/shen/jingmai-runner.js";
import { listSessions, readJingmaiLive, resetJingmaiStore, saveSample, saveSession } from "../src/modules/shen/jingmai-store.js";

const now = { day: "2026-11-12", stamp: "2026-11-12 11:05:00", hour: 11, clock: "11:05:00" };

function shop(name) {
  return { store: name, enabled: true, authState: "ok", cookies: [{ name: "thor", value: name }] };
}

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
  assert.equal(view.updatedAt, "2026/11/12 11:05:00");
  assert.equal(view.shops[0].dealAmount, 0);
  assert.equal(view.shops[1].dealAmount, null);
  assert.equal(JSON.stringify(view).includes("thor"), false);
  assert.equal(JSON.stringify(view).includes("secret"), false);
});

test("one slow shop does not block another, and a timeout is not a logout", async () => {
  const saved = [];
  let marked = 0;
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
    markAuth: async () => {
      marked += 1;
    }
  });
  assert.equal(calls, 2);
  assert.deepEqual(saved, ["快店"]);
  assert.equal(marked, 0);
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
  const card = parseHomeCard("经营数据\n成交金额\n¥12,967.90\n较昨日 -27.63%\n成交单量\n42\n成交客户数\n41\n");
  assert.equal(card.dealAmount, 12967.9);
  assert.equal(card.orderCount, 42);
  assert.equal(card.customerCount, 41);
  assert.equal(parseHomeCard("推广数据\n花费 5"), null);
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
