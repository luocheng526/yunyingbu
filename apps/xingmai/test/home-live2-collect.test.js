import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import "./_memory-env.js";
import { live2FeeRate } from "../src/modules/home/live2.js";
import { createLive2Collector } from "../src/modules/home/live2-collect.js";

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
        return { dealAmount: 3009, paidAmount: 1841.39, paidRoi: 1.43, paidDeal: 2638 };
      }
    }
  });
  const started = await collector.start("cookie");
  assert.equal(started.records[0].pendingCollect, false);
  assert.equal(started.running, true);
  assert.equal(started.records[0].password, undefined);
  await gate;
  const view = await collector.board("cookie");
  assert.equal(view.runtimeMark, "0.1.1278-live2-login");
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
        return { dealAmount: 100, paidAmount: 25, paidRoi: 2, paidDeal: 50 };
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
        return { dealAmount: 120, paidAmount: 30, paidRoi: 2, paidDeal: 60 };
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

test("a shop without an account is 待接入, and a slow shop keeps today's last success as 待更新", async () => {
  let done;
  const gate = new Promise(function (resolve) {
    done = resolve;
  });
  const collector = createLive2Collector({
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
  assert.equal(started.records.find((row) => row.shop === "慢店").pendingUpdate, undefined);
  await gate;
  const view = await collector.board("");
  const slow = view.records.find((row) => row.shop === "慢店");
  const bare = view.records.find((row) => row.shop === "没账号");
  assert.equal(slow.liveAmount, 10);
  assert.equal(slow.capturedAt, "2026/11/19 10:00:00");
  assert.equal(slow.pendingUpdate, true);
  assert.equal(slow.pendingCollect, false);
  assert.equal(bare.pendingCollect, true);
  assert.equal(bare.liveAmount, null);
});

test("a second start does not collect the same shops again", async () => {
  let logins = 0;
  let done;
  const gate = new Promise(function (resolve) {
    done = resolve;
  });
  const collector = createLive2Collector({
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
      fetchHome: async function (_jar, expected) {
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

test("a new process reads the last published round in one board", async () => {
  const file = path.join(os.tmpdir(), "xingmai-live2-round-" + Date.now() + ".json");
  let done;
  const gate = new Promise(function (resolve) {
    done = resolve;
  });
  const first = createLive2Collector({
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
        return { dealAmount: 120, paidAmount: 30, paidRoi: 2, paidDeal: 60 };
      }
    }
  });
  await first.start("");
  await gate;
  const second = createLive2Collector({
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
