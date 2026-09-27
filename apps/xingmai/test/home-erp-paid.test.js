import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { hourlyArray, mapErpPaid, shiftYmd } from "../src/modules/home/erp-paid.js";
import { homeRouter } from "../src/modules/home/router.js";

test("maps ERP realtime sales and shop promo onto homepage live paid fields", () => {
  const shopToday = {
    summary: { payAmount: 400, totalPromotionCost: 80, promotionRate: 0.2, profit: 90 },
    records: [
      { shopId: "1", shopName: "", payAmount: 300, todayPayAmount: 300, totalPromotionCost: 50, promotionRate: 0.16, profit: 70 },
      { shopId: "2", shopName: "", payAmount: 100, todayPayAmount: 100, totalPromotionCost: 30, promotionRate: 0.3, profit: 20 }
    ]
  };
  const shopYest = {
    summary: { payAmount: 500, totalPromotionCost: 200, promotionRate: 0.4 },
    records: [{ shopId: "1", shopName: "昨天店名", payAmount: 400, totalPromotionCost: 160 }]
  };
  const realtime = [
    {
      shopId: "1",
      shopName: "SAWAAG芊灏专卖店",
      operateName: "韩梦凯",
      todayPayAmount: 300,
      yesterdayPayAmount: 180,
      todayHourlyData: { "00:00": 100, "01:00": 200 },
      yesterdayHourlyData: { "00:00": 40, "01:00": 60 }
    },
    {
      shopId: "2",
      shopName: "HYEGIIR医疗保健旗舰店",
      todayPayAmount: 100,
      yesterdayPayAmount: 90,
      todayHourlyData: { "00:00": 10, "01:00": 20 },
      yesterdayHourlyData: { "00:00": 8, "01:00": 12 }
    }
  ];
  const mapped = mapErpPaid(shopToday, shopYest, realtime);
  assert.equal(mapped.records.length, 2);
  assert.equal(mapped.records[0].shopName, "SAWAAG芊灏专卖店");
  assert.equal(mapped.records[0].totalPromotionCost, 50);
  assert.equal(mapped.records[0].todayPayAmount, 300);
  assert.equal(mapped.summary.todayPayAmount, 400);
  assert.equal(mapped.summary.totalPromotionCost, 80);
  assert.equal(mapped.summary.yesterdayPayAmount, 270);
  assert.equal(mapped.yesterday.totalPromotionCost, 200);
  assert.equal(mapped.hourly.todayPay[0], 110);
  assert.equal(mapped.hourly.todayPay[1], 220);
  assert.equal(mapped.hourly.yesterdayPay[0], 48);
});

test("live paid hours keep 24 slots and shift Shanghai ymd", () => {
  const hours = hourlyArray({ "00:00": 5, "10:00": 7 });
  assert.equal(hours.length, 24);
  assert.equal(hours[0], 5);
  assert.equal(hours[10], 7);
  assert.equal(hours[11], 0);
  assert.equal(shiftYmd("2026-09-15", -1), "2026-09-14");
});

test("homepage live paid route is mounted", async () => {
  const app = express();
  app.use("/api/home", homeRouter());
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/home/erp-paid`);
    const data = await res.json();
    assert.equal(res.status === 200 || res.status === 503, true);
    if (res.status === 503) {
      assert.equal(data.ok, false);
    } else {
      assert.equal(data.ok, true);
      assert.equal(data.source, "xingmai-erp");
      assert.ok(data.summary);
      assert.ok(Array.isArray(data.records));
    }
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});
