import "./_memory-env.js";
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { beijingParts, collectPinRecords, paidQuery, pinsForJztTotalSpend, pinsForLoggedInShop, readJztPaidScopes } from "../src/modules/home/jingmai.js";
import { readJztTotalSpend } from "../src/modules/home/jingmai-client.js";
import { createWeekJztReader, readWeekJztSpend } from "../src/modules/home/week-jzt.js";
import { registerWeekManagement } from "../src/modules/home/week-management.js";
import { homeCollectionGate } from "../src/modules/home/jingmai-runner.js";
import { listSessions, resetJingmaiStore, saveSession } from "../src/modules/home/jingmai-store.js";
import { createLive2Collector } from "../src/modules/home/live2-collect.js";

const store = "RASW潮流生活旗舰店";
const date = "2026-11-24";
const shop = { store, shopId: "123" };

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

test("total spend sends the requested day and only accounts verified for the shop", async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    if (url.includes("/user/pinlist?")) {
      return Response.json({ code: 1, data: [
        { pinId: 11, shopId: shop.shopId },
        { pinId: 22, shopId: "222", shopName: store },
        { pinId: 33, shopName: "RASW other" }
      ] });
    }
    if (url.includes("/auth/pinlist?")) return Response.json({ code: 1, data: [{ pinId: 11, shopId: shop.shopId }] });
    if (url.includes("/v2/summary/overview?")) {
      requests.push(JSON.parse(options.body));
      return Response.json({ code: 1, data: { summary: [
        { index: "cost", value: requests.length === 1 ? 0 : null },
        { index: "totalOrderSum", value: 2392 }
      ] } });
    }
    return new Response("");
  };
  assert.equal(await readJztTotalSpend([], shop, date, undefined, fetchImpl), 0);
  assert.equal(requests[0].startDate, date);
  assert.equal(requests[0].endDate, date);
  assert.deepEqual(requests[0].pinIdList, [11]);
  assert.deepEqual(requests[0].businessType, [-5]);
  assert.equal(requests[0].basicRange, 1);
  assert.equal("marketingObjectives" in requests[0], false);
  assert.deepEqual(paidQuery(date, [11]).businessType, [-4, 256]);
  assert.equal(paidQuery(date, [11]).basicRange, 0);
  await assert.rejects(readJztTotalSpend([], shop, date, undefined, fetchImpl), /未返回总花费/);
});

test("total spend includes JD's own account groups for a verified shop without using other authorizations", async () => {
  const expected = { ...shop, verifiedShopSession: true };
  const user = { own: [{ userId: 11, userDisplayName: "主推广账号" }], value: [{ userId: 12 }] };
  const auth = { value: [
    { userId: 21, userDisplayName: "RASW另一个店铺" },
    { userId: 22, shopId: shop.shopId },
    { userId: 23, shopId: "999", shopName: store }
  ] };
  const fetchImpl = async (url, options) => {
    if (url.includes("/user/pinlist?")) return Response.json({ code: 1, data: user });
    if (url.includes("/auth/pinlist?")) return Response.json({ code: 1, data: auth });
    if (url.includes("/summary/overview?")) {
      const ids = JSON.parse(options.body).pinIdList;
      assert.deepEqual(ids.sort((a, b) => a - b), [11, 12, 22]);
      return Response.json({ code: 1, data: { summary: [{ index: "cost", value: 7935.32 }] } });
    }
    return new Response("");
  };
  assert.equal(await readJztTotalSpend([], expected, date, undefined, fetchImpl), 7935.32);

  assert.deepEqual(pinsForJztTotalSpend(user, auth, shop).map(row => row.pinId), [22]);
  const conflicting = { ...user, value: [{ userId: 12, shopId: "999" }] };
  assert.deepEqual(pinsForJztTotalSpend(conflicting, auth, expected).map(row => row.pinId), [22]);
});

test("homepage uses the 35 verified shop accounts in both reports even when the ad-account nicknames differ", async () => {
  const expected = { store: "HYEGIIR健康器械旗舰店", shopId: "123", verifiedShopSession: true };
  const user = {
    own: Array.from({ length: 21 }, (_, i) => ({ userId: i + 1, name: "HYEGIIR健康器械投放" + (i + 1) })),
    value: Array.from({ length: 14 }, (_, i) => ({ userId: i + 22, name: "运营小组" + (i + 1) }))
  };
  const auth = { value: [{ userId: 100, name: "代运营其他店" }] };
  assert.equal(pinsForLoggedInShop(collectPinRecords(user, auth), expected).length, 21);

  const day = beijingParts().day;
  const metrics = await readJztPaidScopes(user, auth, expected, day, { includeTotalSpend: true }, (query, total) => {
    assert.deepEqual(query.pinIdList, Array.from({ length: 35 }, (_, i) => i + 1));
    assert.equal(query.startDate, day);
    assert.equal(query.endDate, day);
    assert.equal(query.basicRange, 1);
    assert.deepEqual(query.businessType, total ? [-5] : [-4, 256]);
    return { code: 1, data: { summary: total
      ? [{ index: "cost", value: 8400 }]
      : [{ index: "cost", value: 8389.27 }, { index: "ROI", value: 3.02 }, { index: "totalOrderSum", value: 25340 }]
    } };
  });
  assert.equal(metrics.totalSpend, 8400);
  assert.equal(metrics.paidAmount, 8389.27);
  assert.equal(metrics.paidDeal, 25340);
  assert.equal(metrics.paidRoi, 3.02);
  assert.equal(metrics.adsAccountCount, 35);
  assert.equal(metrics.adsReportCapturedAt.slice(0, 10).replaceAll("/", "-"), day);
});

test("history respects existing locks and holds its lock until interrupted transport settles", async () => {
  const inflight = new Set([store]);
  const gate = { inflight, humanProtectsShop: () => false };
  const session = { ...shop, enabled: true, authState: "ok", sessionGen: 1, cookies: [{ name: "fixture", value: "original" }] };
  const started = deferred();
  const cancelled = deferred();
  const drained = deferred();
  let attempts = 0;
  const reader = createWeekJztReader({
    gate, today: () => date, sessionOf: async () => session,
    readSpend: async (jar, identity, day, signal) => {
      attempts++;
      assert.deepEqual(identity, { ...shop, verifiedShopSession: true });
      assert.equal(day, date);
      jar[0].value = "refreshed in copy";
      if (attempts === 1) {
        signal.addEventListener("abort", cancelled.resolve, { once: true });
        started.resolve();
        await drained.promise;
      }
      return 1002;
    }
  });

  await assert.rejects(reader.read(store, date), { statusCode: 409 });
  assert.equal(attempts, 0);
  inflight.delete(store);

  const historical = assert.rejects(reader.read(store, date), { statusCode: 409 });
  await started.promise;
  const yielding = reader.interrupt(store);
  await cancelled.promise;
  assert.equal(inflight.has(store), true);
  drained.resolve();
  await Promise.all([yielding, historical]);
  assert.equal(inflight.has(store), false);

  const { checkedAt, ...result } = await reader.read(store, date);
  assert.deepEqual(result, { store, date, spend: 1002 });
  assert.ok(Number.isFinite(Date.parse(checkedAt)));
  assert.equal(session.cookies[0].value, "original");
  assert.equal(inflight.has(store), false);
  await assert.rejects(reader.read(store, "2026-11-27"), { statusCode: 400 });
});



test("the administrator audit route only returns the selected store's total spend and timestamp", async t => {
  const app = express();
  app.use(express.json());
  const router = express.Router();
  let reads = 0;
  registerWeekManagement(router, {
    getUser: req => req.get("x-test-role") ? { role: req.get("x-test-role") } : null,
    schedule: {},
    readJztSpend: async (name, day) => {
      reads++;
      assert.equal(name, store);
      assert.equal(day, date);
      return { store, date, spend: 1002, checkedAt: "2026-11-24T06:05:01.000Z" };
    }
  });
  app.use("/api/home", router);
  const server = await new Promise(resolve => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  t.after(() => new Promise(resolve => server.close(resolve)));

  const url = "http://127.0.0.1:" + server.address().port + "/api/home/jzt-spend-audit";
  const request = (headers = {}) => fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ store, date })
  });
  assert.equal((await request()).status, 401);
  assert.equal((await request({ "x-test-role": "staff" })).status, 403);
  const admin = { "x-test-role": "admin" };
  assert.equal((await request({ ...admin, "sec-fetch-site": "cross-site" })).status, 403);
  const response = await request(admin);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, store, date, spend: 1002, checkedAt: "2026-11-24T06:05:01.000Z" });
  assert.equal(reads, 1);
});



test("a real-time round preempts a delayed historical request on the shared store lock", { timeout: 2500 }, async t => {
  await resetJingmaiStore();
  await saveSession(store, { shopId: shop.shopId, enabled: true, authState: "ok",
    cookies: [{ name: "fixture", value: "saved", domain: ".jd.com", path: "/" }] });

  const originalFetch = globalThis.fetch;
  const started = deferred();
  const interrupted = deferred();
  const drained = deferred();
  t.after(() => {
    drained.resolve();
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async (url, options) => {
    if (url.includes("/user/pinlist?")) return Response.json({ code: 1, data: [{ pinId: 11, shopId: shop.shopId }] });
    if (url.includes("/auth/pinlist?")) return Response.json({ code: 1, data: [] });
    if (url.includes("/v2/summary/overview?")) {
      options.signal.addEventListener("abort", interrupted.resolve, { once: true });
      started.resolve();
      await drained.promise;
      return Response.json({ code: 1, data: { summary: [{ index: "cost", value: 1002 }] } });
    }
    return new Response("");
  };

  let liveFetches = 0;
  let round;
  const collector = createLive2Collector({
    ...homeCollectionGate(), storePath: "", listSessions, listSamples: async () => [],
    loadOrg: async () => [{ ...shop, enabled: true }],
    client: { fetchHome: async () => { liveFetches++; return { dealAmount: 100, paidAmount: 6, totalSpend: 10 }; } },
    track: task => { round = task; }
  });

  const historical = assert.rejects(readWeekJztSpend(store, beijingParts().day), { statusCode: 409 });
  await started.promise;
  await collector.start("");
  await interrupted.promise;
  assert.equal(liveFetches, 0);
  drained.resolve();
  await Promise.all([historical, round]);
  assert.equal(liveFetches, 1);
  assert.equal((await collector.board("")).records[0].paidAmount, 10);
});
