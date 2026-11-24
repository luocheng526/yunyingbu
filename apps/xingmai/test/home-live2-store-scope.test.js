import test from "node:test";
import assert from "node:assert/strict";
import { checkStoreRequest, protectStoreResponse } from "../src/modules/people/access-policy.js";

const existing = { storeName: "医疗器械旗舰店" };
const renamed = { storeName: "官方旗舰店" };
const currentRecord = { shop: existing.storeName, liveAmount: 120, overviewHistory: { today: { deal: [120] } } };
const renamedRecord = { shop: renamed.storeName, liveAmount: 90 };
const payload = { ok: true, records: [currentRecord, renamedRecord] };

function shopScope(granted) {
  const byKey = new Map([
    ["医疗器械旗舰", [existing, renamed]],
    ["官方旗舰", [renamed]]
  ]);
  return {
    configured: true,
    all: [existing, renamed],
    byKey,
    full: () => false,
    cap: row => ({ see: row === granted }),
    can: (key, right) => {
      const matches = byKey.get(String(key).replace(/旗舰店$/, "旗舰"));
      return right === "see" && Boolean(matches?.length && matches.every(row => row === granted));
    }
  };
}

function responseFor(pathname, scope) {
  const res = { statusCode: 200, set() {}, get() {}, json: body => body, send: body => body };
  protectStoreResponse(res, "home", scope, pathname);
  return res.json(payload).records;
}

test("live2 uses current organization shop names for the response scope", () => {
  const scope = shopScope(existing);
  assert.deepEqual(responseFor("/api/home/live2", scope), [currentRecord]);
  assert.deepEqual(responseFor("/api/home/live2", shopScope(renamed)), [renamedRecord]);
  assert.deepEqual(responseFor("/api/home/live2", shopScope(null)), []);
  assert.deepEqual(responseFor("/api/home/local-paid", scope), []);
  assert.equal(checkStoreRequest(scope, "home", { method: "POST", body: { store: existing.storeName } }), false);
  scope.all.push({ storeName: existing.storeName });
  assert.deepEqual(responseFor("/api/home/live2", scope), []);
});
