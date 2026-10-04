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

test("罗成 sees all live shops; 韩梦凯 and 沈子晗 stay on duty shops", () => {
  const fns = new Function(
    pick("homeUserName") +
      pick("seesAllLiveShops") +
      pick("liveDutyKeys") +
      "return {seesAllLiveShops,liveDutyKeys};"
  )();
  assert.equal(fns.seesAllLiveShops({ displayName: "罗成" }), true);
  assert.equal(fns.seesAllLiveShops({ displayName: "韩梦凯" }), false);
  assert.equal(fns.seesAllLiveShops({ displayName: "沈子晗" }), false);
  assert.equal(fns.liveDutyKeys({ user: { displayName: "罗成" }, dutyReady: true, dutyKeys: { "name:a": true } }), null);
  assert.deepEqual(
    fns.liveDutyKeys({ user: { displayName: "韩梦凯" }, dutyReady: true, dutyKeys: { "name:b店": true } }),
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
      pick("seesAllLiveShops") +
      pick("liveDutyKeys") +
      pick("blankLive") +
      pick("escapeHtml") +
      pick("padHours") +
      pick("shanghaiHour") +
      pick("todayHours") +
      pick("seriesOf") +
      pick("cumHours") +
      pick("sumLocalPaid") +
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
  assert.equal(all.live.cards.find((card) => card.key === "livePaid").value, "2");
  assert.equal(all.live.cards.find((card) => card.key === "ad").value, "25");
  const team = fns.liveBoardOf(state, null, { team: "韩梦凯", shop: "" });
  assert.equal(team.live.hero.value, "50");
  assert.deepEqual(team.shops.map((row) => row.shop), ["B店", "C店"]);
  assert.equal(team.live.cards.find((card) => card.key === "livePaid").value, "1");
  assert.equal(team.live.cards.find((card) => card.key === "ad").value, "5");
  const shop = fns.liveBoardOf(state, null, { team: "", shop: "A店" });
  assert.equal(shop.live.hero.value, "100");
  assert.equal(shop.shops.length, 1);
  assert.equal(shop.shops[0].shop, "A店");
  assert.equal(shop.live.cards.find((card) => card.key === "livePay").value, "80");
});
