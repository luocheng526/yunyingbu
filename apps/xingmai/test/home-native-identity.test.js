import test from "node:test";
import assert from "node:assert/strict";
import { nativeAccountMerchant, nativeMerchantMatches, watchNativeAccount } from "../src/modules/home/browser-identity.js";
import { normalizeOrgShops } from "../src/modules/home/org-roster.js";
import { loadOrgShops } from "../src/modules/home/jingmai-runner.js";

const payload = (id = "9") => ({ code: 200, data: { venderId: id, currentBelongType: "200",
  belongVos: [{ belongType: 200, belongBizId: id }] } });
test("native identity requires successful current membership and matching merchant fields", () => {
  assert.equal(nativeAccountMerchant(payload()), "9");
  const multiple = payload(); multiple.data.belongVos.unshift({ belongType: 100, belongBizId: "wrong" });
  assert.equal(nativeAccountMerchant(multiple), "9");
  for (const invalid of [null, { ...payload(), code: 601 }, { code: 200, data: { ...payload().data, currentBelongType: undefined } },
    { code: 200, data: { ...payload().data, venderId: "8" } },
    { code: 200, data: { ...payload().data, belongVos: [...payload().data.belongVos, ...payload().data.belongVos] } }]) {
    assert.equal(nativeAccountMerchant(invalid), "");
  }
});

test("merchant-only proof requires a configured unique merchant and no conflicting page identity", () => {
  assert.equal(nativeMerchantMatches({ merchantId: "9" }, {}, "9"), true);
  for (const [expected, page, seen] of [[{}, {}, "9"], [{ merchantId: "9", ambiguousMerchant: true }, {}, "9"],
    [{ merchantId: "9" }, { shopId: "2" }, "9"], [{ merchantId: "9" }, { ambiguousShopId: true }, "9"],
    [{ merchantId: "9" }, {}, "8"]]) assert.equal(nativeMerchantMatches(expected, page, seen), false);
});

test("idle siblings still block merchant-only identity in both background and browser rosters", async () => {
  const rows = [{ storeName: "营业店", merchantId: "9", statusKey: "operating" },
    { storeName: "闲置店", merchantId: "9", statusKey: "idle" }];
  const active = normalizeOrgShops(rows);
  assert.equal(active.length, 1); assert.equal(active[0].ambiguousMerchant, true);
  const interactive = await loadOrgShops("fixture", async () => new Response(JSON.stringify({ stores: rows })));
  assert.ok(interactive.every(row => row.ambiguousMerchant));
});

function observer() {
  const ws = new EventTarget(), bodies = new Map();
  let calls = 0;
  const watch = watchNativeAccount(ws, async (_ws, method, params) => {
    assert.equal(method, "Network.getResponseBody"); calls++;
    return bodies.get(params.requestId);
  });
  const event = (method, params) => ws.dispatchEvent(new MessageEvent("message", { data: JSON.stringify({ method, params }) }));
  const navigate = () => event("Page.frameNavigated", { frame: { id: "main" } });
  const response = async (id, body = payload(), overrides = {}) => {
    bodies.set(id, { body: JSON.stringify(body) });
    event("Network.responseReceived", { requestId: id, frameId: overrides.frameId || "main", response: {
      status: overrides.status || 200, url: overrides.url || "https://sff.jd.com/api?api=dsm.shop.pageframe.navigation.accountFacade.findAccountInfo" } });
    event("Network.loadingFinished", { requestId: id });
    await Promise.resolve(); await Promise.resolve();
  };
  return { watch, navigate, response, event, bodies, calls: () => calls };
}

test("observer accepts only the native account endpoint in the current main document", async () => {
  const o = observer(); o.navigate();
  for (const overrides of [{ frameId: "iframe" }, { url: "https://sff.jd.com.evil.example/api?api=dsm.shop.pageframe.navigation.accountFacade.findAccountInfo" },
    { url: "https://sff.jd.com/api?api=unrelated" }, { status: 429 }]) await o.response("ignored", payload(), overrides);
  assert.equal(o.calls(), 0); assert.equal(o.watch.read(), "");
  await o.response("accepted"); assert.equal(o.watch.read(), "9");
  await o.response("rejected", { code: 601 }); assert.equal(o.watch.read(), "");
  o.watch.stop(); await o.response("stopped"); assert.equal(o.watch.read(), "");
});

test("navigation and newer responses invalidate an older identity response still being read", async () => {
  const o = observer(); o.navigate();
  let finish;
  o.bodies.set("old", new Promise(resolve => { finish = resolve; }));
  o.event("Network.responseReceived", { requestId: "old", frameId: "main", response: { status: 200,
    url: "https://sff.jd.com/api?api=dsm.shop.pageframe.navigation.accountFacade.findAccountInfo" } });
  o.event("Network.loadingFinished", { requestId: "old" });
  o.navigate(); await o.response("new", payload("8"));
  finish({ body: JSON.stringify(payload("9")) });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(o.watch.read(), "8");
  o.navigate(); assert.equal(o.watch.read(), ""); o.watch.stop();
});
