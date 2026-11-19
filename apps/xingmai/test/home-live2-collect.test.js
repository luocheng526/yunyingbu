import test from "node:test";
import assert from "node:assert/strict";
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
  assert.equal(started.records[0].pendingCollect, true);
  assert.equal(started.records[0].password, undefined);
  await gate;
  const view = await collector.board("cookie");
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
});
