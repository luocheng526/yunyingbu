import assert from "node:assert/strict";
import test from "node:test";
import { detailRows, groupOf, headline, qtyAt, shopSummary, shortHouse } from "../public/jingcang-preview/logic.js";

const stores = [
  { storeName: "甲店", supervisor: "张文静", reserve: "" },
  { storeName: "乙店", supervisor: "", reserve: "张文静" },
  { storeName: "丙店", supervisor: "杨润泽", reserve: "" },
  { storeName: "丁店", supervisor: "", reserve: "" }
];

test("groups come from supervisor, then reserve, otherwise 未分组", () => {
  assert.equal(groupOf(stores[0]), "张文静组");
  assert.equal(groupOf(stores[1]), "张文静组");
  assert.equal(groupOf(stores[2]), "杨润泽组");
  assert.equal(groupOf(stores[3]), "未分组");
  assert.equal(shortHouse("北京常温C平台仓55号库-CHN"), "北京55");
});

test("a missing warehouse stays unknown and an explicit zero is out of stock", () => {
  const row = { warehouses: [{ name: "北京常温C平台仓55号库-CHN", qty: 0 }, { name: "无锡常温C平台仓13号库-CHN", qty: 4 }] };
  assert.equal(qtyAt(row, "北京常温C平台仓55号库-CHN"), 0);
  assert.equal(qtyAt(row, "肇庆常温C平台仓5号库-CHN"), null);
  const collected = {
    丙店: {
      capturedAt: "2026-11-12 22:26:36",
      rows: [
        { name: "剃须刀", sku: "1", spu: "9", code: "A", warehouses: row.warehouses },
        { name: "枕头", sku: "2", spu: "8", code: "B", warehouses: [{ name: "无锡常温C平台仓13号库-CHN", qty: 3 }] }
      ]
    }
  };
  const out = detailRows(stores, collected, {
    group: "杨润泽组",
    house: "北京常温C平台仓55号库-CHN",
    mode: "out",
    threshold: 5
  });
  assert.deepEqual(out.map((item) => item.sku), ["1"]);
  const low = detailRows(stores, collected, {
    group: "杨润泽组",
    house: "无锡常温C平台仓13号库-CHN",
    mode: "low",
    threshold: 3
  });
  assert.deepEqual(low.map((item) => item.sku), ["2"]);
});

test("two shops in one group do not invent stock, and totals are not added across shops", () => {
  const lines = detailRows(stores, {}, { group: "张文静组", picked: ["甲店", "乙店"], query: "1" });
  assert.equal(lines.length, 0);
  const summary = shopSummary(stores, {}, { group: "张文静组", picked: ["甲店", "乙店"] });
  assert.deepEqual(summary.map((item) => item.state), ["待采集", "待采集"]);
  assert.equal(headline(summary).total, null);
  assert.equal(headline(summary).waiting, 2);
});
