import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getHomeLocalPaid,
  mergeHanShenPaid,
  postHomeLocalPaid,
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

test("local paid stub is not 星脉 ERP and stamps Shanghai time", async () => {
  const data = await getHomeLocalPaid();
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
  assert.match(homeJs, /\/api\/han\/worker\?view=overview/);
  assert.match(homeJs, /\/api\/shen\/paid\?latest=1/);
  assert.match(homeJs, /\/api\/shen\/paid\/jingmai/);
  assert.match(homeJs, /function mergeLivePaid/);
  assert.match(homeJs, /function sortLiveShops/);
  assert.match(homeJs, /sortLiveShops\(feePickShops/);
  assert.match(homeJs, /paidAmount: "—"/);
  assert.match(homeJs, /function liveCardsOf/);
  assert.match(homeJs, /label: "实时付费接入店铺数量"/);
  assert.match(homeJs, /实时只汇总韩梦凯运营中心「实时付费」和沈子晗运营中心「付费中心」/);
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
      pick("hoursHaveNow") +
      pick("shanghaiHour") +
      pick("todayHours") +
      pick("seriesOf") +
      pick("cumHours") +
      pick("payFit") +
      pick("blankLive") +
      pick("escapeHtml") +
      pick("normShopName") +
      pick("normShopId") +
      pick("sumLocalPaid") +
      homeJs.slice(start, end) +
      "return {fillLocalPaid,emptyLocalPaid,spendChartOf,hourCum,payFit};"
  )();
  const live = {
    shops: [{ shop: "A店", liveAmount: "9", paidAmount: "—", roi: "—", paidDeal: "—", feeRate: "—" }],
    cards: [],
    paid: { label: "推广总花费", value: "—" }
  };
  const empty = fns.fillLocalPaid(live, fns.emptyLocalPaid());
  assert.equal(empty.shops[0].paidAmount, "—");
  assert.equal(empty.paid.hours, 24);
  assert.equal(empty.fee.hours, 24);
  assert.equal(empty.paid.delta, "");
  assert.equal(empty.paid.yestText, "—");
  const filled = fns.fillLocalPaid(live, {
    records: [{ shopName: "A店", paidAmount: 12, paidDeal: 100, feeRate: 0.12 }],
    summary: { spend: 12, paidDeal: 100, feeRate: 0.12 }
  });
  assert.equal(filled.shops[0].paidAmount, "12");
  assert.equal(filled.shops[0].roi, "8.33");
  assert.equal(filled.cards.find((card) => card.key === "roi").value, "8.33");
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
  const withGmv = fns.fillLocalPaid(live, {
    records: [{ shopName: "A店", paidAmount: 12, paidDeal: 30, jingmaiGmv: 40, success: "是", accountId: "999" }]
  });
  assert.equal(withGmv.shops[0].liveAmount, "40");
  assert.equal(withGmv.shops[0].jzAccount, "999");
  assert.equal(withGmv.shops[0].paidIn, true);
  const hanShenHero = fns.fillLocalPaid(
    {
      hero: {
        label: "实时总成交金额",
        value: "291,255",
        todayHour: [18, 10, 5, 29],
        yesterdayHour: [20, 12, 8, 40],
        yestText: "381,894"
      },
      shops: [],
      cards: [],
      paid: { label: "推广总花费", value: "—" }
    },
    {
      records: [
        { shopName: "韩店", paidAmount: 104524, paidDeal: 199764, jingmaiGmv: 251945, source: "han" },
        { shopName: "沈店", paidAmount: 65585, paidDeal: 134741, jingmaiGmv: 154648, source: "shen" }
      ],
      yesterday: {
        records: [
          { shopName: "韩店", jingmaiGmv: 240000 },
          { shopName: "沈店", jingmaiGmv: 140000 }
        ]
      }
    }
  );
  assert.equal(hanShenHero.hero.value, "406,593");
  assert.notEqual(hanShenHero.hero.value, "291,255");
  assert.equal(hanShenHero.hero.yestText, "380,000");
  assert.ok(Number(hanShenHero.hero.todayHour[0]) > 18);
  assert.deepEqual(fns.payFit([2, 2], 10), [5, 5]);
  const shaped = fns.fillLocalPaid(
    {
      hero: {
        todayHour: [10, 10, 20],
        yesterdayHour: [8, 8, 8, 8]
      },
      shops: [{ shop: "A店", liveAmount: "40", paidAmount: "—" }],
      cards: [],
      paid: { label: "推广总花费", value: "—" }
    },
    {
      records: [{ shopName: "A店", paidAmount: 12, paidDeal: 40, jingmaiGmv: 40 }],
      yesterday: {
        records: [{ shopName: "A店", paidAmount: 8, paidDeal: 32 }],
        hourly: { todaySpend: [2, 2, 2, 2], todayPay: [8, 8, 8, 8], todayFee: [0.2, 0.2, 0.2, 0.2] }
      }
    }
  );
  assert.ok(shaped.paid.yesterdayHour.length === 0 || shaped.paid.yesterdayHour.length === 24);
  assert.equal(shaped.paid.todayHour.length > 2, true);
  assert.ok(shaped.fee.yesterdayHour.length === 0 || shaped.fee.yesterdayHour.length === 24);
  assert.equal(shaped.paid.yestText, "8");
  assert.match(String(shaped.fee.yestText), /%/);
  const ordered = fns.fillLocalPaid(
    {
      shops: [
        { shop: "低店", liveAmount: "10" },
        { shop: "高店", liveAmount: "90" }
      ],
      cards: [],
      paid: { label: "推广总花费", value: "—" }
    },
    {
      records: [
        { shopName: "低店", paidAmount: 1, paidDeal: 10, jingmaiGmv: 10 },
        { shopName: "高店", paidAmount: 1, paidDeal: 90, jingmaiGmv: 90 },
        { shopName: "空店", paidAmount: 1, paidDeal: 1 },
        { shopName: "中店", paidAmount: 1, paidDeal: 50, jingmaiGmv: 50 }
      ]
    }
  );
  assert.deepEqual(
    ordered.shops.map((row) => row.shop),
    ["高店", "中店", "低店", "空店"]
  );
  const waved = fns.fillLocalPaid(
    {
      shops: [
        { shop: "高费店", liveAmount: "10", payHours: [10, 2, 8, 1], yestPayHours: [4, 12, 4, 8] },
        { shop: "低费店", liveAmount: "10", payHours: [2, 10, 2, 9], yestPayHours: [12, 4, 12, 2] }
      ],
      cards: [],
      paid: { label: "推广总花费", value: "—" },
      hero: { todayHour: [12, 12, 10, 10], yesterdayHour: [16, 16, 16, 10] }
    },
    {
      records: [
        { shopName: "高费店", paidAmount: 6, paidDeal: 10, jingmaiGmv: 10, feeRate: 0.6 },
        { shopName: "低费店", paidAmount: 3, paidDeal: 10, jingmaiGmv: 10, feeRate: 0.3 }
      ],
      yesterday: {
        records: [
          { shopName: "高费店", paidAmount: 5, paidDeal: 10, feeRate: 0.5 },
          { shopName: "低费店", paidAmount: 3, paidDeal: 10, feeRate: 0.3 }
        ],
        hourly: { todayFee: [0.55, 0.35, 0.48, 0.4], todaySpend: [5, 3, 4, 2], todayPay: [16, 16, 16, 10] }
      }
    }
  );
  assert.ok(waved.fee.todayHour[0] !== waved.fee.todayHour[1]);
  assert.ok(waved.fee.yesterdayHour[0] !== waved.fee.yesterdayHour[1]);
  assert.ok(waved.fee.todayHour[0] > 0.4 && waved.fee.todayHour[1] < 0.45);
  assert.equal(waved.fee.yesterdayHour.length, 24);
  assert.match(homeJs, /function mixFeeHours/);
  assert.match(homeJs, /sum\.spend \* \(sY \/ sT\)/);
  assert.match(homeJs, /api\("\/api\/home\/local-paid"/);
  const keptYest = fns.fillLocalPaid(
    {
      hero: { label: "实时总成交金额", value: "100", todayHour: [10, 20], yesterdayHour: [99, 99, 99] },
      shops: [],
      cards: [],
      paid: { label: "推广总花费", value: "—" }
    },
    {
      records: [{ shopName: "A店", paidAmount: 12, paidDeal: 40, jingmaiGmv: 100 }],
      yesterday: {
        records: [{ shopName: "A店", paidAmount: 9, paidDeal: 30, jingmaiGmv: 80 }],
        hourly: { todayPay: [8, 8, 8, 8], todaySpend: [2, 2, 1, 1], todayFee: [0.3, 0.4, 0.5, 0.4] }
      }
    }
  );
  assert.equal(Number(keptYest.hero.yesterdayHour[0].toFixed(2)), 26.67);
  assert.equal(Number(keptYest.paid.yesterdayHour[0].toFixed(1)), 3);
  assert.equal(keptYest.fee.yesterdayHour[0], 0.3);
  const erpYest = fns.fillLocalPaid(
    {
      hero: { label: "实时总成交金额", value: "100", todayHour: [10, 20, 30, 40], yesterdayHour: [8, 16, 24, 32] },
      shops: [{ shop: "A店", liveAmount: "100", payHours: [10, 20, 30, 40], yestPayHours: [8, 16, 24, 32] }],
      cards: [],
      paid: { label: "推广总花费", value: "—" }
    },
    {
      records: [{ shopName: "A店", paidAmount: 10, paidDeal: 40, jingmaiGmv: 100, feeRate: 0.1 }]
    }
  );
  assert.equal(erpYest.hero.yesterdayHour[0], 8);
  assert.equal(erpYest.hero.yesterdayHour.length, 4);
  assert.equal(erpYest.paid.yestText, "—");
  assert.equal(erpYest.paid.yesterdayHour.length, 0);
  assert.match(homeJs, /function hoursHaveNow/);
  const deadPay = [];
  var di;
  for (di = 0; di < 13; di += 1) deadPay.push(null);
  deadPay.push(34460, 122237, 134646);
  while (deadPay.length < 24) deadPay.push(1000);
  const deadSnap = fns.fillLocalPaid(
    {
      hero: {
        label: "实时总成交金额",
        value: "100",
        todayHour: [10, 20, 30, 40],
        yesterdayHour: [8, 16, 24, 32],
        yestText: "80",
        delta: 25
      },
      shops: [{ shop: "A店", liveAmount: "100", payHours: [10, 20, 30, 40], yestPayHours: [8, 16, 24, 32] }],
      cards: [],
      paid: { label: "推广总花费", value: "—" }
    },
    {
      records: [{ shopName: "A店", paidAmount: 10, paidDeal: 40, jingmaiGmv: 100, feeRate: 0.1 }],
      yesterday: {
        records: [{ shopName: "A店", paidAmount: 9, paidDeal: 30, jingmaiGmv: 80, date: "2026-11-12" }],
        hourly: { todayPay: deadPay }
      },
      hourly: { yesterdayPay: deadPay, todayPay: [10, 20, 30, 40] }
    }
  );
  assert.equal(deadSnap.hero.yesterdayHour[0], 8);
  assert.equal(deadSnap.hero.yestText, "80");
  assert.equal(deadSnap.paid.yestText, "9");
  assert.match(homeJs, /function orgStoreForShop/);
  assert.match(homeJs, /row\.formerNames/);
  const renamed = fns.fillLocalPaid(
    {
      shops: [{ shop: "DIKTT欧栩专卖店", shopId: "16091982", liveAmount: "11,624", paidAmount: "—" }],
      cards: [],
      paid: { label: "推广总花费", value: "—" }
    },
    {
      records: [{ shopName: "DIKTT家居旗舰店", paidAmount: 4058, paidDeal: 8000, jingmaiGmv: 13197, feeRate: 0.3 }]
    },
    {
      stores: [{ storeName: "DIKTT家居旗舰店", shopId: "16091982", formerNames: "DIKTT欧栩专卖店" }]
    }
  );
  assert.equal(renamed.shops.length, 1);
  assert.equal(renamed.shops[0].shop, "DIKTT家居旗舰店");
  assert.equal(renamed.shops[0].paidIn, true);
  assert.equal(renamed.shops[0].paidAmount, "4,058");
  const byIdOnly = fns.fillLocalPaid(
    {
      shops: [{ shop: "DIKTT梦幽澜专卖店", shopId: "16098199", liveAmount: "6,531", paidAmount: "—" }],
      cards: [],
      paid: { label: "推广总花费", value: "—" }
    },
    {
      records: [{ shopName: "DIKTT生活电器旗舰店", paidAmount: 2061, paidDeal: 4000, jingmaiGmv: 6531 }]
    },
    {
      stores: [{ storeName: "DIKTT生活电器旗舰店", shopId: "16098199", formerNames: "" }]
    }
  );
  assert.equal(byIdOnly.shops.length, 1);
  assert.equal(byIdOnly.shops[0].shop, "DIKTT生活电器旗舰店");
  assert.equal(byIdOnly.shops[0].paidIn, true);
  const unmatched = fns.fillLocalPaid(
    {
      shops: [{ shop: "DIKTT欧栩专卖店", shopId: "16091982", liveAmount: "11,624", paidAmount: "—" }],
      cards: [],
      paid: { label: "推广总花费", value: "—" }
    },
    {
      records: [{ shopName: "DIKTT家居旗舰店", paidAmount: 4058, paidDeal: 8000 }]
    }
  );
  assert.equal(unmatched.shops[0].shop, "DIKTT欧栩专卖店");
  assert.equal(unmatched.shops[0].paidIn, undefined);
  const noMerchantMix = fns.fillLocalPaid(
    {
      shops: [
        { shop: "RASW环境电器旗舰店", shopId: "39133580", liveAmount: "3,876", paidAmount: "—" },
        { shop: "DIKTT环境电器旗舰店", shopId: "81732029", liveAmount: "997", paidAmount: "—" }
      ],
      cards: [],
      paid: { label: "推广总花费", value: "—" }
    },
    {
      records: [
        { shopName: "RASW环境电器旗舰店", paidAmount: 1978, paidDeal: 3000 },
        { shopName: "DIKTT环境电器旗舰店", paidAmount: 533, paidDeal: 900 }
      ]
    },
    {
      stores: [
        { storeName: "RASW环境电器旗舰店", shopId: "39133580", merchantId: "39133580" },
        { storeName: "DIKTT环境电器旗舰店", shopId: "81732029", merchantId: "39133580" }
      ]
    }
  );
  assert.deepEqual(
    noMerchantMix.shops.map((row) => row.shop + ":" + row.paidAmount),
    ["RASW环境电器旗舰店:1,978", "DIKTT环境电器旗舰店:533"]
  );
  const zeros = Array.from({ length: 24 }, () => 0);
  const zeroToday = fns.fillLocalPaid(
    {
      hero: { value: "100", todayHour: [50, 10, 10, 10], yesterdayHour: [8, 16, 24, 32] },
      shops: [{ shop: "A店", liveAmount: "100", payHours: [50, 10, 10, 10], yestPayHours: [8, 16, 24, 32] }],
      cards: [],
      paid: { label: "推广总花费", value: "—" }
    },
    {
      records: [{ shopName: "A店", paidAmount: 12, paidDeal: 40, jingmaiGmv: 100, feeRate: 0.12 }],
      hourly: {
        todayPay: zeros,
        todaySpend: zeros,
        todayFee: zeros,
        yesterdaySpend: [2, 4, 6, 8],
        yesterdayPay: [8, 16, 24, 32]
      },
      yesterday: {
        records: [{ shopName: "A店", paidAmount: 20, paidDeal: 80, jingmaiGmv: 80 }],
        hourly: { todaySpend: [2, 4, 6, 8], todayPay: [8, 16, 24, 32] }
      }
    }
  );
  assert.ok(zeroToday.paid.todayHour.some((n) => Number(n) > 0));
  assert.equal(Number(zeroToday.paid.todayHour[0].toFixed(1)), 1.2);
  assert.equal(Number(zeroToday.paid.todayHour[1].toFixed(1)), 2.4);
  assert.equal(zeroToday.paid.yesterdayHour[0], 2);
  assert.equal(zeroToday.paid.value, "12");
  assert.notEqual(Number(zeroToday.paid.todayHour[0].toFixed(1)), 7.5);
  const booked = fns.fillLocalPaid(
    {
      shops: [{ shop: "费比店", liveAmount: "9", paidAmount: "—", feeRate: "—" }],
      cards: [],
      paid: { label: "推广总花费", value: "—" }
    },
    {
      records: [{ shopName: "费比店", paidAmount: 12, paidDeal: 40 }],
      feeTargets: { 费比店: { lo: 30, hi: 45 } }
    }
  );
  assert.equal(booked.shops[0].feeLo, 30);
  assert.equal(booked.shops[0].feeHi, 45);
});

test("live shop 状态 follows 10-minute capturedAt", () => {
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
  const fns = new Function(pick("parseLiveAt") + pick("fmtShopAt") + pick("liveLinkOf") + "return {liveLinkOf,fmtShopAt,parseLiveAt};")();
  const fresh = new Date().toISOString();
  const stale = new Date(Date.now() - 11 * 60 * 1000).toISOString();
  const almost = new Date(Date.now() - 9 * 60 * 1000).toISOString();
  assert.equal(fns.liveLinkOf({}).label, "掉线");
  assert.equal(fns.liveLinkOf({ jzOk: "是", online: true }).kind, "off");
  assert.equal(fns.liveLinkOf({ capturedAt: fresh }).kind, "on");
  assert.equal(fns.liveLinkOf({ capturedAt: almost }).kind, "on");
  assert.equal(fns.liveLinkOf({ capturedAt: stale }).kind, "off");
  assert.equal(fns.liveLinkOf({ capturedAt: stale, online: true }).label, "掉线");
  assert.match(fns.fmtShopAt("2026-11-13T09:43:03+08:00"), /^2026\/11\/13 09:43:03$/);
  assert.match(fns.fmtShopAt("2026/11/13 09:43:03"), /^2026\/11\/13 09:43:03$/);
  assert.doesNotMatch(homeJs, /label: "是否回传成功"/);
  assert.match(homeJs, /label: "状态"/);
  assert.doesNotMatch(homeJs, /label: "是否成功"/);
});

test("local paid snap keeps yesterday after the Shanghai day rolls", async () => {
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
  const data = await getHomeLocalPaid();
  if (shanghaiYmd() === "2026-11-12") {
    assert.equal(data.records[0].paidAmount, 30);
    assert.equal(data.yesterday.records[0].paidAmount, 40);
    assert.deepEqual(data.hourly.yesterdaySpend, [1, 2, 3]);
  } else {
    assert.equal(data.yesterday.records[0].paidAmount, 30);
  }
  setLocalPaidSnapPath(prev);
});

test("homepage live paid merges 韩梦凯实时付费 and 沈子晗付费中心 for today", () => {
  const ymd = "2026-11-12";
  const merged = mergeHanShenPaid(
    {
      shops: [
        { store: "韩店", date: ymd, spend: 10, jingmaiGmv: 40, roi: 4, success: "是", accountId: "1", feeLo: 35, feeHi: 40 },
        { store: "旧店", date: "2026-01-01", spend: 99, jingmaiGmv: 99, success: "是" }
      ]
    },
    {
      rows: [
        { store: "沈店", date: ymd, spend: 5, jingmaiGmv: 20, totalOrderAmount: 18, success: "是" },
        { store: "过期沈店", date: "2026-09-19", spend: 8, jingmaiGmv: 8, success: "是" }
      ]
    },
    { shops: [] },
    ymd
  );
  assert.deepEqual(merged.records.map((row) => row.shopName).sort(), ["沈店", "韩店"]);
  assert.equal(merged.summary.spend, 15);
  assert.equal(merged.summary.liveAmount, 60);
  assert.equal(merged.summary.shops, 2);
  assert.equal(merged.records.find((row) => row.shopName === "韩店").feeLo, 35);
  assert.equal(merged.records.find((row) => row.shopName === "韩店").feeHi, 40);
  const liveHan = mergeHanShenPaid(
    { stale: false, shops: [{ store: "韩店", date: ymd, spend: 1, jingmaiGmv: 2, success: "是" }] },
    { rows: [] },
    { shops: [] },
    ymd
  );
  assert.equal(liveHan.records[0].online, true);
  const deadHan = mergeHanShenPaid(
    { stale: true, shops: [{ store: "韩店", date: ymd, spend: 1, jingmaiGmv: 2, success: "是" }] },
    { rows: [] },
    { shops: [] },
    ymd
  );
  assert.equal(deadHan.records[0].online, false);
  const same = mergeHanShenPaid(
    { shops: [{ store: "同店", date: ymd, spend: 3, jingmaiGmv: 9, success: "是" }] },
    { rows: [{ store: "同店", date: ymd, spend: 4, jingmaiGmv: 8, success: "是" }] },
    { shops: [] },
    ymd
  );
  assert.equal(same.records.length, 1);
  assert.equal(same.records[0].source, "han+shen");
  const hours = mergeHanShenPaid(
    { shops: [] },
    { rows: [] },
    {
      shops: [
        {
          shop: "京麦店",
          dealAmount: 100,
          todayHours: [null, null, 40, 70, 100],
          yesterdayHours: [null, 20, 20, 50, 80],
          todayPaidHours: [null, null, 10, 18, 30],
          yesterdayPaidHours: [4, 10, 12, 20, 28]
        }
      ]
    },
    ymd
  );
  assert.deepEqual(hours.hourly.todayPay.slice(0, 5), [0, 0, 40, 30, 30]);
  assert.deepEqual(hours.hourly.yesterdayPay.slice(0, 5), [0, 20, 0, 30, 30]);
  assert.deepEqual(hours.hourly.todaySpend.slice(0, 5), [0, 0, 10, 8, 12]);
  assert.deepEqual(hours.hourly.yesterdaySpend.slice(0, 5), [4, 6, 2, 8, 8]);
  assert.ok(hours.hourly.yesterdaySpend.some((n, i) => i > 0 && n !== hours.hourly.yesterdaySpend[0]));
});

test("local-paid route pulls han and shen siblings", async () => {
  const ymd = shanghaiYmd();
  const app = express();
  app.get("/api/han/worker", (_req, res) => {
    res.json({
      ok: true,
      shops: [{ store: "韩店", date: ymd, spend: 11, jingmaiGmv: 22, success: "是" }]
    });
  });
  app.get("/api/shen/paid", (_req, res) => {
    res.json({
      ok: true,
      rows: [{ store: "沈店", date: ymd, spend: 7, jingmaiGmv: 14, success: "是" }]
    });
  });
  app.get("/api/shen/paid/jingmai", (_req, res) => {
    res.json({ ok: true, shops: [] });
  });
  app.get("/api/han/fee-targets", (_req, res) => {
    res.json({ ok: true, username: "罗成", targets: { 韩店: { lo: 35, hi: 42 } } });
  });
  app.get("/api/shen/paid/fee-targets", (_req, res) => {
    res.json({ ok: true, targets: { 沈店: { lo: 30, hi: 36 } } });
  });
  app.use("/api/home", homeRouter());
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const file = join(snapDir, "merge.json");
  const prev = join(snapDir, "days.json");
  setLocalPaidSnapPath(file);
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/home/local-paid`);
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.source, "han-shen-local");
    assert.deepEqual(data.records.map((row) => row.shopName).sort(), ["沈店", "韩店"]);
    assert.equal(data.summary.spend, 18);
    assert.equal(data.feeTargets["韩店"].lo, 35);
    assert.equal(data.feeTargets["沈店"].hi, 36);
    assert.equal(data.records.find((row) => row.shopName === "韩店").feeLo, 35);
    assert.equal(data.records.find((row) => row.shopName === "沈店").feeHi, 36);
    assert.deepEqual(data.from.sort(), ["han", "shen"]);
  } finally {
    setLocalPaidSnapPath(prev);
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});

test("homepage client mergeLivePaid builds shop rows from 韩/沈 APIs", () => {
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
  const fns = new Function(
    pick("asNum") +
      pick("liveDayOf") +
      pick("liveShopName") +
      pick("liveList") +
      pick("livePaidRow") +
      pick("mergeLivePaid") +
      "return {mergeLivePaid};"
  )();
  const ymd = "2026-11-13";
  const merged = fns.mergeLivePaid(
    {
      ok: true,
      shops: [
        { store: "韩店", date: ymd, spend: 10, jingmaiGmv: 40, capturedAt: "2026-11-13T10:00:00+08:00", accountId: "1" },
        { store: "旧店", date: "2026-01-01", spend: 99, jingmaiGmv: 99 }
      ]
    },
    {
      ok: true,
      data: {
        rows: [{ store: "沈店", date: ymd, spend: 5, jingmaiGmv: 20, totalOrderAmount: 18 }]
      }
    },
    { shops: [{ store: "京麦店", dealAmount: 12 }] },
    ymd
  );
  assert.deepEqual(merged.records.map((row) => row.shopName).sort(), ["京麦店", "沈店", "韩店"]);
  assert.equal(merged.records.find((row) => row.shopName === "韩店").paidAmount, 10);
  assert.equal(merged.records.find((row) => row.shopName === "沈店").paidDeal, 18);
  assert.equal(merged.records.find((row) => row.shopName === "京麦店").liveAmount, 12);
  const keepGmv = fns.mergeLivePaid(
    { shops: [] },
    { rows: [{ store: "RASW家居旗舰店", date: ymd, spend: 500, jingmaiGmv: 154648 }] },
    { shops: [{ store: "RASW家居旗舰店", dealAmount: 11784 }] },
    ymd
  );
  assert.equal(keepGmv.records[0].liveAmount, 154648);
});

test("local-paid pack always has ok and records, never empty object", async () => {
  const data = await getHomeLocalPaid();
  assert.equal(data.ok, true);
  assert.equal(data.source, "han-shen-local");
  assert.equal(Array.isArray(data.records), true);
  assert.doesNotMatch(homeJs, /\/api\/han\/fee-targets/);
  assert.doesNotMatch(homeJs, /\/api\/shen\/fee-targets/);
  assert.match(homeJs, /LIVE_REFRESH_MS = 10 \* 60 \* 1000/);
  assert.match(homeJs, /cache: "no-store"/);
});

test("live day snap rolls today's hours into yesterday for 环比", () => {
  const file = join(snapDir, "keep-yday.json");
  const prev = join(snapDir, "days.json");
  setLocalPaidSnapPath(file);
  rememberLocalPaidDay(
    {
      records: [{ shopName: "A店", paidAmount: 40, liveAmount: 100 }],
      hourly: { todayPay: [4, 5, 6], todaySpend: [1, 2, 3], todayFee: [0.3, 0.4, 0.5] }
    },
    "2026-11-12"
  );
  const posted = postHomeLocalPaid(
    {
      records: [{ shopName: "A店", paidAmount: 30, liveAmount: 80 }],
      hourly: { todayPay: [7, 8, 9], todaySpend: [4, 5, 6], todayFee: [0.2, 0.22, 0.21] }
    },
    "2026-11-13"
  );
  assert.equal(posted.yesterday.records[0].paidAmount, 40);
  assert.deepEqual(posted.hourly.yesterdayPay, [4, 5, 6]);
  assert.deepEqual(posted.hourly.yesterdaySpend, [1, 2, 3]);
  assert.deepEqual(posted.hourly.yesterdayFee, [0.3, 0.4, 0.5]);
  assert.deepEqual(posted.hourly.todayPay, [7, 8, 9]);
  setLocalPaidSnapPath(prev);
});

test("local-paid POST keeps today hours without wiping yesterday", async () => {
  const file = join(snapDir, "post-yday.json");
  const prev = join(snapDir, "days.json");
  setLocalPaidSnapPath(file);
  rememberLocalPaidDay(
    { records: [{ shopName: "A店", paidAmount: 11 }], hourly: { todaySpend: [1, 2, 3] } },
    "2026-11-12"
  );
  const app = express();
  app.use(express.json());
  app.use("/api/home", homeRouter());
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/home/local-paid`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        records: [{ shopName: "A店", paidAmount: 9 }],
        hourly: { todaySpend: [4, 5, 6], todayPay: [7, 8, 9] }
      })
    });
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.ok, true);
    assert.equal(Array.isArray(data.yesterday.records), true);
    if (shanghaiYmd() !== "2026-11-12") {
      assert.equal(data.yesterday.records[0].paidAmount, 11);
      assert.deepEqual(data.hourly.yesterdaySpend, [1, 2, 3]);
    }
    assert.deepEqual(data.hourly.todaySpend, [4, 5, 6]);
  } finally {
    setLocalPaidSnapPath(prev);
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});

test("local-paid POST ignores all-zero today hours", () => {
  const file = join(snapDir, "zero-today.json");
  const prev = join(snapDir, "days.json");
  setLocalPaidSnapPath(file);
  const ymd = shanghaiYmd();
  rememberLocalPaidDay({ hourly: { todaySpend: [4, 5, 6, 7], todayPay: [8, 9, 10, 11] } }, ymd);
  const posted = postHomeLocalPaid(
    { hourly: { todaySpend: Array.from({ length: 24 }, () => 0), todayPay: Array.from({ length: 24 }, () => 0) } },
    ymd
  );
  assert.deepEqual(posted.hourly.todaySpend, [4, 5, 6, 7]);
  assert.deepEqual(posted.hourly.todayPay, [8, 9, 10, 11]);
  setLocalPaidSnapPath(prev);
});

test("zero yesterday hours on the snap do not wipe ERP 成交 or flatten 付费", () => {
  const zeros = Array.from({ length: 24 }, () => 0);
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
  const fns = new Function(
    pick("asNum") +
      pick("fmtInt") +
      pick("fmtMoney") +
      pick("fmtRate") +
      pick("fmtRoi") +
      pick("trendOf") +
      pick("liveAtText") +
      pick("padHours") +
      pick("hoursHaveNow") +
      pick("shanghaiHour") +
      pick("todayHours") +
      pick("seriesOf") +
      pick("cumHours") +
      pick("payFit") +
      pick("blankLive") +
      pick("escapeHtml") +
      pick("normShopName") +
      pick("normShopId") +
      pick("sumLocalPaid") +
      homeJs.slice(homeJs.indexOf("var LIVE_DAY_KEY"), homeJs.indexOf("function ownerOfShop")) +
      "return {fillLocalPaid};"
  )();
  const out = fns.fillLocalPaid(
    {
      hero: {
        label: "实时总成交金额",
        value: "291,255",
        todayHour: [18, 10, 5, 5, 19, 23],
        yesterdayHour: [18, 10, 5, 3, 20, 35, 38],
        yestText: "503,569"
      },
      shops: [{ shop: "A店", liveAmount: "100" }],
      cards: [],
      paid: { label: "推广总花费", value: "—" }
    },
    {
      records: [{ shopName: "A店", paidAmount: 160, paidDeal: 300 }],
      yesterday: { records: [{ shopName: "A店", paidAmount: 135, paidDeal: 280 }] },
      hourly: {
        todayPay: zeros,
        yesterdayPay: zeros,
        todaySpend: [8, 3, 12, 5, 9, 2, 11, 4],
        yesterdaySpend: [4, 6, 2, 8, 8, 3, 10, 1]
      }
    }
  );
  assert.equal(out.hero.yesterdayHour[0], 18);
  assert.equal(out.hero.yesterdayHour.length, 7);
  assert.ok(out.paid.yesterdayHour.length > 2);
  assert.notEqual(out.paid.yesterdayHour[0], out.paid.yesterdayHour[1]);
  assert.notEqual(out.paid.todayHour[0], out.paid.todayHour[2]);
});

test("homepage reads 费比设置 from Han and Shen server APIs, not a local snap", async () => {
  const localPaidJs = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../src/modules/home/local-paid.js"),
    "utf8"
  );
  assert.match(localPaidJs, /\/api\/han\/fee-targets/);
  assert.match(localPaidJs, /\/api\/shen\/paid\/fee-targets/);
  assert.doesNotMatch(homeJs, /\/api\/han\/fee-targets/);
  assert.doesNotMatch(homeJs, /\/api\/shen\/fee-targets/);
  assert.doesNotMatch(homeJs, /feeTargets: scrapedFeeBook\(\)/);
});
