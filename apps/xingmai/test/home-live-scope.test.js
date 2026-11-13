import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const homeJs = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../public/shared/modules/home.js"),
  "utf8"
);

function pick(name) {
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
}

test("paint keeps the DOM board node when building the filtered live board", () => {
  assert.match(homeJs, /var liveBoard = liveBoardOf\(state\)/);
  assert.doesNotMatch(homeJs, /var board = liveBoardOf\(state\)/);
  assert.match(homeJs, /board\.setAttribute\("data-hm-js"/);
});

test("罗成 韩梦凯 沈子晗 see all live shops; others stay on duty shops", () => {
  const fns = new Function(
    pick("homeUserName") +
      pick("isHomeBoss") +
      pick("seesAllLiveShops") +
      pick("liveDutyKeys") +
      "return {seesAllLiveShops,liveDutyKeys};"
  )();
  assert.equal(fns.seesAllLiveShops({ displayName: "罗成" }), true);
  assert.equal(fns.seesAllLiveShops({ displayName: "韩梦凯" }), true);
  assert.equal(fns.seesAllLiveShops({ displayName: "沈子晗" }), true);
  assert.equal(fns.seesAllLiveShops({ displayName: "高传颖" }), false);
  assert.equal(fns.liveDutyKeys({ user: { displayName: "罗成" }, dutyReady: true, dutyKeys: { "name:a": true } }), null);
  assert.equal(fns.liveDutyKeys({ user: { displayName: "韩梦凯" }, dutyReady: true, dutyKeys: { "name:b店": true } }), null);
  assert.equal(fns.liveDutyKeys({ user: { displayName: "沈子晗" }, dutyReady: true, dutyKeys: null }), null);
  assert.deepEqual(
    fns.liveDutyKeys({ user: { displayName: "高传颖" }, dutyReady: true, dutyKeys: { "name:b店": true } }),
    { "name:b店": true }
  );
});

test("live pick keys keep 责权归属 and intersect team or shop", () => {
  const fns = new Function(
    pick("homeUserName") +
      pick("normShopName") +
      pick("dutyTeamList") +
      pick("shopsInDutyTeam") +
      pick("livePickKeys") +
      "return {livePickKeys};"
  )();
  const state = {
    user: { displayName: "韩梦凯" },
    teams: [
      { name: "沈子晗", shops: [{ shop: "A店" }] },
      { name: "韩梦凯", shops: [{ shop: "B店" }, { shop: "C店" }] }
    ],
    chiefs: []
  };
  const duty = { "name:b店": true, "name:c店": true };
  assert.deepEqual(fns.livePickKeys(state, duty, { team: "", shop: "" }), duty);
  assert.deepEqual(fns.livePickKeys(state, null, { team: "", shop: "" }), null);
  assert.deepEqual(fns.livePickKeys(state, duty, { team: "韩梦凯", shop: "" }), {
    "name:b店": true,
    "name:c店": true
  });
  assert.deepEqual(fns.livePickKeys(state, duty, { team: "沈子晗", shop: "" }), {});
  assert.deepEqual(fns.livePickKeys(state, duty, { team: "", shop: "B店" }), { "name:b店": true });
});

test("charts cards and shop rows use the same filtered live board", () => {
  const start = homeJs.indexOf("function payOfRow");
  const end = homeJs.indexOf("function ownerOfShop");
  const sumAdd = homeJs.match(/var SUM_ADD = (\[[^\]]+\]);/);
  assert.ok(sumAdd, "SUM_ADD");
  const fns = new Function(
    pick("asNum") +
      pick("fmtInt") +
      pick("fmtMoney") +
      pick("fmtRate") +
      pick("fmtRoi") +
      pick("trendOf") +
      pick("sumField") +
      pick("withRates") +
      "var SUM_ADD = " +
      sumAdd[1] +
      ";" +
      pick("sumPack") +
      pick("summaryFrom") +
      pick("recordOnDuty") +
      pick("scopeRecords") +
      pick("scopePack") +
      pick("homeUserName") +
      pick("normShopName") +
      pick("normShopId") +
      pick("dutyTeamList") +
      pick("shopsInDutyTeam") +
      pick("livePickKeys") +
      pick("isHomeBoss") +
      pick("seesAllLiveShops") +
      pick("liveDutyKeys") +
      pick("blankLive") +
      pick("escapeHtml") +
      pick("padHours") +
      pick("shanghaiHour") +
      pick("todayHours") +
      pick("seriesOf") +
      pick("cumHours") +
      pick("payFit") +
      pick("liveAtText") +
      pick("sumLocalPaid") +
      pick("spendChartOf") +
      pick("feeChartOf") +
      pick("liveCardsOf") +
      pick("emptyLocalPaid") +
      pick("scopeLocalPaid") +
      pick("localShopPaid") +
      pick("liveBoardOf") +
      homeJs.slice(start, end) +
      "function erpRecordId(){return \"\";} function filterLiveShops(shops){return shops||[];}" +
      "return {liveBoardOf,payOfPack,fillLocalPaid};"
  )();
  const records = [
    { shopName: "A店", todayPayAmount: 100 },
    { shopName: "B店", todayPayAmount: 40 },
    { shopName: "C店", todayPayAmount: 10 }
  ];
  const packs = {
    today: { records: records, summary: { payAmount: 999 } },
    yest: { records: [], summary: { payAmount: 80 } },
    snap: { records: records, summary: { payAmount: 999 } }
  };
  const state = {
    user: { displayName: "罗成" },
    dutyReady: true,
    livePacks: packs,
    localPaid: {
      records: [
        { shopName: "A店", paidAmount: 20, paidDeal: 80 },
        { shopName: "B店", paidAmount: 5, paidDeal: 15 }
      ]
    },
    teams: [
      { name: "沈子晗", shops: [{ shop: "A店" }] },
      { name: "韩梦凯", shops: [{ shop: "B店" }, { shop: "C店" }] }
    ]
  };
  const all = fns.liveBoardOf(state, null, { team: "", shop: "" });
  assert.equal(all.live.hero.value, "150");
  assert.equal(all.shops.length, 3);
  const hanAll = fns.liveBoardOf(
    { ...state, user: { displayName: "韩梦凯" }, dutyKeys: { "name:b店": true } },
    undefined,
    { team: "", shop: "" }
  );
  assert.equal(hanAll.shops.length, 3);
  const gaoOwn = fns.liveBoardOf(
    { ...state, user: { displayName: "高传颖" }, dutyKeys: { "name:b店": true } },
    undefined,
    { team: "", shop: "" }
  );
  assert.deepEqual(gaoOwn.shops.map((row) => row.shop), ["B店"]);
  assert.equal(all.live.cards.find((card) => card.key === "livePaid").value, "2");
  assert.equal(all.live.hero.label, "实时总成交金额");
  assert.equal(all.live.paid.label, "推广总花费");
  assert.equal(all.live.paid.value, "25");
  assert.equal(all.live.fee.label, "实时费比");
  assert.equal(all.live.fee.value, "26%");
  assert.equal(all.live.hero.yestText, "80");
  assert.equal(all.live.cards.find((card) => card.key === "ad"), undefined);
  const team = fns.liveBoardOf(state, null, { team: "韩梦凯", shop: "" });
  assert.equal(team.live.hero.value, "50");
  assert.deepEqual(team.shops.map((row) => row.shop), ["B店", "C店"]);
  assert.equal(team.live.cards.find((card) => card.key === "livePaid").value, "1");
  assert.equal(team.live.paid.value, "5");
  const shop = fns.liveBoardOf(state, null, { team: "", shop: "A店" });
  assert.equal(shop.live.hero.value, "100");
  assert.equal(shop.shops.length, 1);
  assert.equal(shop.shops[0].shop, "A店");
  assert.equal(shop.live.cards.find((card) => card.key === "livePay").value, "80");
});

test("live shop table defaults to 实时成交金额 descending", () => {
  assert.match(homeJs, /function sortLiveShops/);
  assert.match(homeJs, /sortLiveShops\(feePickShops/);
  const fns = new Function(pick("asNum") + pick("sortLiveShops") + "return {sortLiveShops};")();
  assert.deepEqual(
    fns
      .sortLiveShops([
        { shop: "低店", liveAmount: "8,088" },
        { shop: "空店", liveAmount: "—" },
        { shop: "高店", liveAmount: "14,202" },
        { shop: "中店", liveAmount: "10,471" }
      ])
      .map((row) => row.shop),
    ["高店", "中店", "低店", "空店"]
  );
});

test("live table can search shops, filter 掉线, and hide idle org shops", () => {
  assert.match(homeJs, /liveSearchHtml\(\) \+\s*'<div class="xm-hm-panel">/);
  assert.match(homeJs, /liveChipHtml\("link", "off", "掉线"/);
  assert.doesNotMatch(homeJs, /liveChipHtml\("jzOk"/);
  assert.match(homeJs, /liveChipHtml\("paid", "no", "未接入店铺"/);
  const store = {};
  const fns = new Function(
    "localStorage",
    pick("normShopName") +
      pick("parseLiveAt") +
      pick("liveLinkOf") +
      pick("liveFilter") +
      pick("shopsInDutyTeam") +
      pick("filterLiveShops") +
      pick("shopNotOperating") +
      pick("orgIdleNames") +
      pick("dutyShopsFrom") +
      "return {filterLiveShops,shopNotOperating,orgIdleNames,dutyShopsFrom,liveLinkOf};"
  )({
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key, value) {
      store[key] = String(value);
    }
  });
  const now = new Date().toISOString();
  const old = new Date(Date.now() - 11 * 60 * 1000).toISOString();
  const rows = [
    { shop: "在线店", capturedAt: now, paidIn: true },
    { shop: "掉线店", capturedAt: old, paidIn: true },
    { shop: "闲置店", capturedAt: now, paidIn: true },
    { shop: "未接入店", capturedAt: now }
  ];
  store["xm-home-live-filter"] = JSON.stringify({ link: "off" });
  assert.deepEqual(
    fns.filterLiveShops(rows, {}).map((row) => row.shop),
    ["掉线店"]
  );
  store["xm-home-live-filter"] = JSON.stringify({ q: "在线" });
  assert.deepEqual(
    fns.filterLiveShops(rows, {}).map((row) => row.shop),
    ["在线店"]
  );
  const org = {
    stores: [
      { storeName: "在线店", statusKey: "operating" },
      { storeName: "掉线店", statusKey: "operating" },
      { storeName: "闲置店", statusKey: "idle" }
    ]
  };
  assert.equal(fns.shopNotOperating({ statusKey: "idle" }), true);
  assert.equal(fns.shopNotOperating({ statusKey: "operating" }), false);
  store["xm-home-live-filter"] = JSON.stringify({});
  assert.deepEqual(
    fns.filterLiveShops(rows, { orgIdle: fns.orgIdleNames(org) }).map((row) => row.shop),
    ["在线店", "掉线店"]
  );
  store["xm-home-live-filter"] = JSON.stringify({ paid: "no" });
  assert.deepEqual(
    fns.filterLiveShops(rows, { orgIdle: fns.orgIdleNames(org) }).map((row) => row.shop),
    ["未接入店"]
  );
  assert.deepEqual(
    fns.dutyShopsFrom(org).map((row) => row.storeName),
    ["在线店", "掉线店"]
  );
});
