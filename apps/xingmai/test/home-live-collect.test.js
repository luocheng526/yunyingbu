import test from "node:test";
import assert from "node:assert/strict";
import { collectAuthDecision, sampleFields, buildLiveView, beijingParts } from "../src/modules/home/jingmai.js";
import { fetchHome } from "../src/modules/home/jingmai-client.js";

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
