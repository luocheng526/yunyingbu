import test from "node:test";
import assert from "node:assert/strict";
import { fetchAllShopPages, mapErpKpis } from "../src/modules/home/erp-kpis.js";

test("maps Xingmai shop summary onto homepage company fields", () => {
  const shopPage = {
    summary: {
      payAmount: 855933.41,
      refundAmount: 206561.69,
      profit: 414158.46,
      orderCount: 3241,
      totalPromotionCost: 362476.05,
      promotionRate: 0.4234862733,
      platformCost: 47718.34,
      salesCost: 410194.39,
      totalProductCost: 21827.6,
      invalidAmount: 266.0,
      jdStoreOrderCount: 2218,
      jdStoreOrderRate: 0.68435668,
      totalNetProductCost: 21791.6
    },
    records: [{ shopId: "25014981", shopName: "HYEGIIR医疗保健旗舰店", payAmount: 85607.81, totalPromotionCost: 32250.35 }]
  };
  const trend = [{ date: "2026-09-11", netSkuNum: 3762, promotionCost: 362476.05 }];
  const mapped = mapErpKpis(shopPage, trend);
  assert.equal(mapped.summary.payAmount, 855933.41);
  assert.equal(mapped.summary.totalPromotionCost, 362476.05);
  assert.equal(mapped.summary.platformFee, 47718.34);
  assert.equal(mapped.summary.saleFee, 410194.39);
  assert.equal(mapped.summary.goodsCost, 21827.6);
  assert.equal(mapped.summary.invalidAmount, 266.0);
  assert.equal(mapped.summary.jdOrders, 2218);
  assert.equal(mapped.summary.jdRatio, 0.68435668);
  assert.equal(mapped.summary.netSkuNum, 3762);
  assert.equal(mapped.summary.netGoodsCost, 21791.6);
  assert.equal(Math.round(mapped.summary.netSales * 100) / 100, 649371.72);
  assert.equal(mapped.records[0].shopId, "25014981");
});

test("ERP shop pages keep fetching until the last short page", async () => {
  const calls = [];
  const erp = {
    async erpPost(path, body) {
      calls.push({ path, pageNum: body.pageNum, pageSize: body.pageSize });
      if (body.pageNum === 1) {
        return { total: 3, records: [{ shopId: "1" }, { shopId: "2" }] };
      }
      return { total: 3, records: [{ shopId: "3" }] };
    }
  };
  const page = await fetchAllShopPages(erp, { payTimeStart: "2026-09-11 00:00:00", payTimeEnd: "2026-09-11 23:59:59" }, 2);
  assert.equal(page.records.length, 3);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].pageSize, 2);
});
