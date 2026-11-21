import assert from "node:assert/strict";
import test from "node:test";
import { SHOP_DAY, shopDayRequest } from "../src/modules/bound/shop-day-contract.js";
import { decimalSum, decimalSubtract, roundedInteger, reconcileShopDay } from "../src/modules/bound/reconcile-shop-day.js";

const part = (code, amount) => ({ code, name: code, cost: amount, originCost: amount });
const item = (goodsId, promotion, refund) => ({ goodsId, shopId: SHOP_DAY.shopId, platform: "JD", sales: goodsId === "one" ? "1" : "0",
  lstGmv: goodsId === "one" ? [part("normal", "100")] : [],
  lstTghf: [part("ad", promotion)], lstSaleCost: [part("tghf", promotion)], lstRefund: [part("refund", refund)] });
const record = (reportId, rows, extra = {}) => ({ id: reportId, reportId, scope: SHOP_DAY, status: "received", page: 1,
  request: shopDayRequest({ reportId, page: extra.page || 1 }), rows, ...extra });
function fixture() {
  const one = item("one", "10", "0"), two = item("two", "5", "3");
  const all = { sumLine: true, gmv: "100", netGmv: "97", profit: "54",
    lstGmv: [part("normal", "100")], lstRefund: [part("refund", "3")],
    lstNetHpCost: [part("cost", "20")], lstSaleCost: [part("tghf", "15"), part("platform", "2")],
    lstDeliverCost: [part("freight", "5")] };
  return {
    operating: record("channel_operating", [{ netGmv: "97", profit: "52", tghf: 15, thtkje: 3,
      lstOtherCost: [part("other", "1.25")], lstZdyFyAll: [part("custom", "2.125")] }]),
    hotGoods: record("channel_goods", [{ sumLine: true, lstSaleCost: [part("tghf", "10")], lstRefund: [part("refund", "0")] }, one]),
    fullPages: [record("shop_goods_page", [one], { total: 2, nextPage: 2 }), record("shop_goods_page", [two], { total: 2, page: 2 })],
    fullTotal: record("shop_goods_total", [all])
  };
}

test("对账使用十进制原始精度，不用浮点误差或空值补零", () => {
  assert.equal(decimalSum(["0.1", "0.2"]), "0.3");
  assert.equal(decimalSum(["249.12", "60.202"]), "309.322");
  assert.equal(decimalSubtract("9606.63", "7183.66"), "2422.97");
  assert.equal(decimalSubtract("6704.805", "309.322"), "6395.483");
  assert.equal(roundedInteger("6704.805"), "6705");
  assert.equal(roundedInteger("6395.483"), "6395");
  for (const unknown of [null, undefined, "--", "", Infinity]) assert.equal(decimalSum(["1", unknown]), null);
});

test("补齐无销售商品的广告与退款后闭合，再用自定义费用解释利润显示差异", () => {
  const input = fixture();
  const original = JSON.stringify(input);
  const result = reconcileShopDay(input);
  assert.equal(result.status, "reconciled_for_this_shop_day");
  assert.equal(result.readyForShopAggregation, true);
  assert.equal(result.readyForHistoricalBatch, false);
  assert.deepEqual(result.omitted.goodsIds, ["two"]);
  assert.equal(result.omitted.sales, "0");
  assert.equal(result.promotion.omitted, "5");
  assert.equal(result.refund.omitted, "3");
  assert.equal(result.profit.beforeCustom, "53.75");
  assert.equal(result.profit.afterCustom, "51.625");
  assert.equal(result.profit.resolved, true);
  assert.equal(JSON.stringify(input), original, "原始金额和响应不被改写");
});

test("缺页、重复商品、跨店请求与未解释的金额差异都不能通过", () => {
  for (const mutate of [
    data => data.fullPages.pop(),
    data => { data.fullPages[1].rows[0].goodsId = "one"; },
    data => { data.fullPages[1].request.body.shopList[0].shopId = "other"; },
    data => { data.fullTotal.rows[0].profit = "999"; },
    data => { delete data.operating.rows[0].lstZdyFyAll; },
    data => { data.fullPages[1].rows[0].lstSaleCost[0].originCost = null; }
  ]) {
    const data = fixture(); mutate(data);
    assert.equal(reconcileShopDay(data).readyForShopAggregation, false);
  }
});
