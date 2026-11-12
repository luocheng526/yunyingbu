import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getHomeLocalPaid,
  rememberLocalPaidDay,
  setLocalPaidSnapPath,
  shanghaiNow,
  shanghaiYmd
} from "../src/modules/home/local-paid.js";
import { homeRouter } from "../src/modules/home/router.js";

const snapDir = mkdtempSync(join(tmpdir(), "home-local-paid-"));
setLocalPaidSnapPath(join(snapDir, "days.json"));

const homeJs = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../public/shared/modules/home.js"),
  "utf8"
);

test("local paid stub is not 星脉 ERP and stamps Shanghai time", () => {
  const data = getHomeLocalPaid();
  assert.equal(data.ok, true);
  assert.equal(data.source, "han-shen-local");
  assert.notEqual(data.source, "xingmai-erp");
  assert.equal(Array.isArray(data.records), true);
  assert.equal(data.records.length, 0);
  assert.equal(Array.isArray(data.yesterday.records), true);
  assert.equal(data.yesterday.records.length, 0);
  assert.match(String(data.updatedAt || ""), /^\d{4}\/\d{1,2}\/\d{1,2} \d{2}:\d{2}:\d{2}$/);
  assert.match(shanghaiNow(), /^\d{4}\/\d{1,2}\/\d{1,2} \d{2}:\d{2}:\d{2}$/);
});

test("homepage local-paid route is mounted", async () => {
  const app = express();
  app.use("/api/home", homeRouter());
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/home/local-paid`);
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.source, "han-shen-local");
    assert.equal(data.records.length, 0);
    assert.equal(data.yesterday.records.length, 0);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});

test("live page keeps 京麦 from ERP and leaves paid for local return", () => {
  assert.match(homeJs, /function fillLocalPaid/);
  assert.match(homeJs, /function pullLocalPaid/);
  assert.match(homeJs, /\/api\/home\/local-paid/);
  assert.match(homeJs, /paidAmount: "—"/);
  assert.match(homeJs, /function liveCardsOf/);
  assert.match(homeJs, /label: "实时付费接入店铺数量"/);
  assert.match(homeJs, /实时付费来自韩梦凯、沈子晗本地机回传，不接星脉/);
  assert.match(homeJs, /if \(stampClock \|\| !state\.liveAt\)/);
  assert.match(homeJs, /timeZone: "Asia\/Shanghai"/);
  assert.doesNotMatch(homeJs, /京麦面板实时金额和实时付费都走星脉 ERP/);
  const pick = (name) => {
    const start = homeJs.indexOf("function " + name);
    assert.notEqual(start, -1, name);
    let depth = 0;
    for (let i = start; i < homeJs.length; i += 1) {
      if (homeJs[i] === "{") depth += 1;
      if (homeJs[i] === "}") {
        depth -= 1;
        if (depth === 0) return homeJs.slice(start, i + 1);
      }
    }
    throw new Error("unclosed " + name);
  };
  const start = homeJs.indexOf("var LIVE_DAY_KEY");
  const end = homeJs.indexOf("function ownerOfShop");
  const fns = new Function(
    pick("asNum") +
      pick("fmtInt") +
      pick("fmtMoney") +
      pick("fmtRate") +
      pick("fmtRoi") +
      pick("trendOf") +
      pick("liveAtText") +
      pick("padHours") +
      pick("shanghaiHour") +
      pick("todayHours") +
      pick("seriesOf") +
      pick("cumHours") +
      pick("blankLive") +
      pick("escapeHtml") +
      pick("sumLocalPaid") +
      homeJs.slice(start, end) +
      "return {fillLocalPaid,emptyLocalPaid,spendChartOf,hourCum};"
  )();
  const live = {
    shops: [{ shop: "A店", liveAmount: "9", paidAmount: "—", roi: "—", paidDeal: "—", feeRate: "—" }],
    cards: [],
    paid: { label: "推广总花费", value: "—" }
  };
  const empty = fns.fillLocalPaid(live, fns.emptyLocalPaid());
  assert.equal(empty.shops[0].paidAmount, "—");
  const filled = fns.fillLocalPaid(live, {
    records: [{ shopName: "A店", paidAmount: 12, paidDeal: 100, feeRate: 0.12 }],
    summary: { spend: 12, paidDeal: 100, feeRate: 0.12 }
  });
  assert.equal(filled.shops[0].paidAmount, "12");
  assert.equal(filled.paid.label, "推广总花费");
  assert.equal(filled.paid.value, "12");
  assert.equal(filled.fee.label, "实时费比");
  assert.equal(filled.fee.value, "12%");
  assert.equal(filled.paid.yestText, "—");
  const withYest = fns.fillLocalPaid(live, {
    records: [{ shopName: "A店", paidAmount: 12, paidDeal: 100, feeRate: 0.12 }],
    yesterday: { records: [{ shopName: "A店", paidAmount: 10, paidDeal: 80 }] }
  });
  assert.equal(withYest.paid.value, "12");
  assert.equal(withYest.paid.yestText, "10");
  assert.equal(Math.round(withYest.paid.delta), 20);
  assert.equal(withYest.fee.yestText, "13%");
  assert.ok(withYest.fee.delta < 0);
  assert.equal(filled.cards.find((card) => card.key === "livePaid").value, "1");
  assert.equal(filled.cards.find((card) => card.key === "ad"), undefined);
  assert.equal(filled.cards.find((card) => card.key === "liveAt").label, "更新时间");
});

test("local paid snap keeps yesterday after the Shanghai day rolls", () => {
  const file = join(snapDir, "roll.json");
  const prev = join(snapDir, "days.json");
  setLocalPaidSnapPath(file);
  rememberLocalPaidDay(
    { records: [{ shopName: "A店", paidAmount: 40, paidDeal: 200 }], hourly: { todaySpend: [1, 2, 3] } },
    "2026-11-11"
  );
  rememberLocalPaidDay(
    { records: [{ shopName: "A店", paidAmount: 30, paidDeal: 180 }], hourly: { todaySpend: [4, 5, 6] } },
    "2026-11-12"
  );
  const data = getHomeLocalPaid();
  if (shanghaiYmd() === "2026-11-12") {
    assert.equal(data.records[0].paidAmount, 30);
    assert.equal(data.yesterday.records[0].paidAmount, 40);
    assert.deepEqual(data.hourly.yesterdaySpend, [1, 2, 3]);
  } else {
    assert.equal(data.yesterday.records[0].paidAmount, 30);
  }
  setLocalPaidSnapPath(prev);
});
