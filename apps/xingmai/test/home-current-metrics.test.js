import test from "node:test";
import assert from "node:assert/strict";
import { extractShopDeal, shopDealUnavailable } from "../src/modules/home/jingmai.js";

// Shape observed from dsm.jm.data.operationData.findShopData on 2026-11-20/21.
function response(values = ["¥19,863.45", "107", "57"]) {
  return { code: 200, msg: "成功", data: { refreshTime: "2026-11-20 23:46:10", modules: [
    { moduleCode: "deal", moduleName: "交易", indicators: ["OrdAmt", "OrdNum", "OrdCustNum"].map((code, i) => ({ code, value: values[i], rate: "+0.11%", display: true })) },
    { moduleCode: "flow", moduleName: "流量", indicators: [{ code: "UV", value: "942" }, { code: "PV", value: "2,156" }] }
  ] } };
}

test("current Jingmai trade modules retain amounts, counts, refresh time and percent units", () => {
  const result = extractShopDeal(response());
  assert.equal(result.dealAmount, 19863.45);
  assert.equal(result.orderCount, 107);
  assert.equal(result.customerCount, 57);
  assert.equal(result.dealRate, 0.11);
  assert.equal(result.dealRateLabel, "较昨日");
  assert.equal(result.yesterdayAmount, null);
  assert.equal(result.platformUpdatedAt, "2026-11-20 23:46:10");
});

test("confirmed dashes differ from zero, incomplete loading, errors and flow-only data", () => {
  const missing = response(["-", "—", "--"]);
  assert.equal(shopDealUnavailable(missing), true);
  assert.equal(extractShopDeal(missing), null);
  assert.equal(shopDealUnavailable(response(["0", "0", "0"])), false);
  assert.equal(extractShopDeal(response(["¥0.00", "0", "0"])).dealAmount, 0);
  assert.equal(shopDealUnavailable(response([null, null, null])), false);
  assert.equal(shopDealUnavailable(response(["", "", ""])), false);
  assert.equal(shopDealUnavailable({ ...missing, code: 601 }), false);
  assert.equal(extractShopDeal({ ...response(), code: 601 }), null);
  const flowOnly = response(); flowOnly.data.modules.shift();
  assert.equal(shopDealUnavailable(flowOnly), false);
  assert.equal(extractShopDeal(flowOnly), null);
});

test("ambiguous or partial trade groups are never used to bypass the browser fallback", () => {
  const duplicate = response(["-", "-", "-"]);
  duplicate.data.modules.push(structuredClone(duplicate.data.modules[0]));
  assert.equal(shopDealUnavailable(duplicate), false);
  assert.equal(extractShopDeal(duplicate), null);
  const duplicateValue = response();
  duplicateValue.data.modules[0].indicators.push({ code: "OrdAmt", value: "999" });
  assert.equal(extractShopDeal(duplicateValue), null);
  const incomplete = response(["-", "-", "-"]);
  incomplete.data.modules[0].indicators.pop();
  assert.equal(shopDealUnavailable(incomplete), false);
});
