import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const homeJs = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../public/shared/modules/home.js"),
  "utf8"
);

function applyCardMove(full, hide, fromKey, toKey, visibleOnly) {
  const seq = visibleOnly ? full.filter((key) => hide.indexOf(key) === -1) : full.slice();
  const from = seq.indexOf(fromKey);
  const to = seq.indexOf(toKey);
  if (from < 0 || to < 0 || from === to) {
    return full;
  }
  seq.splice(from, 1);
  seq.splice(to, 0, fromKey);
  if (!visibleOnly) {
    return seq;
  }
  let i = 0;
  return full.map((key) => (hide.indexOf(key) !== -1 ? key : seq[i++]));
}

test("homepage module persists a shared card order", () => {
  assert.match(homeJs, /xm-home-card-order/);
  assert.match(homeJs, /function viewStore/);
  assert.match(homeJs, /function applyCardMove/);
  assert.match(homeJs, /function onSortDown/);
  assert.match(homeJs, /function onSortSelectStart/);
  assert.match(homeJs, /function clearTextSelection/);
  assert.match(homeJs, /sortDragging = true/);
  assert.match(homeJs, /user-select:none/);
  assert.match(homeJs, /selectstart/);
  assert.doesNotMatch(homeJs, /sortHold && !sortDragging[\s\S]{0,80}sortFrom = ""/);
});

test("visible card drag keeps hidden keys in place", () => {
  assert.deepEqual(applyCardMove(["a", "b", "c", "d"], ["c"], "d", "b", true), ["a", "d", "c", "b"]);
});

test("settings drag reorders the full list", () => {
  assert.deepEqual(applyCardMove(["a", "b", "c"], [], "c", "a", false), ["c", "a", "b"]);
});

function applyLiveCardMove(full, fromKey, toKey) {
  const seq = full.slice();
  const from = seq.indexOf(fromKey);
  const to = seq.indexOf(toKey);
  if (from < 0 || to < 0 || from === to) {
    return seq;
  }
  seq.splice(from, 1);
  seq.splice(to, 0, fromKey);
  return seq;
}

test("live cards persist their own drag order", () => {
  assert.match(homeJs, /xm-home-live-card-order/);
  assert.match(homeJs, /function applyLiveCardMove/);
  assert.match(homeJs, /function saveLiveCardOrder/);
  assert.match(homeJs, /sortLive = !!card\.closest\("\.xm-hm-live-cards"\)/);
  assert.match(homeJs, /saveLiveCardOrder\(applyLiveCardMove/);
  assert.deepEqual(applyLiveCardMove(["ad", "roi", "livePay", "livePaid"], "livePaid", "ad"), [
    "livePaid",
    "ad",
    "roi",
    "livePay"
  ]);
});

test("live shop table can filter by duty team or shop", () => {
  assert.match(homeJs, /xm-home-live-filter/);
  assert.match(homeJs, /function liveFilterHtml/);
  assert.match(homeJs, /function filterLiveShops/);
  assert.match(homeJs, /function dutyTeamList/);
  assert.match(homeJs, /function visibleDutyTeams/);
  assert.match(homeJs, /data-live-filter="pick"/);
  assert.match(homeJs, /店铺列表/);
  assert.match(homeJs, /责权归属/);
  assert.match(homeJs, /xm-hm-live-at">更新时间 /);
  assert.doesNotMatch(homeJs, /liveFilterOption\("", "全选"/);
  assert.match(homeJs, /optgroup label="责权团队"/);
  assert.match(homeJs, /optgroup label="店铺"/);
  assert.match(homeJs, /function parseLiveFilterValue/);
  assert.match(homeJs, /data-refresh-live/);
  assert.match(homeJs, /data-live-heads>表头设置/);
  assert.match(homeJs, /京准通主账户ID/);
  assert.match(homeJs, /function refreshLive/);
  assert.match(homeJs, /xm-hm-live-refresh/);
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
    pick("homeUserName") +
      pick("isHomeBoss") +
      pick("normShopName") +
      pick("liveFilterShopNames") +
      pick("dutyTeamList") +
      pick("visibleDutyTeams") +
      "return {isHomeBoss,visibleDutyTeams};"
  )();
  const state = {
    user: { displayName: "罗成" },
    teams: [{ name: "沈子晗", shops: [{ shop: "A店" }] }, { name: "韩梦凯", shops: [{ shop: "B店" }] }],
    chiefs: [{ name: "毛永超", shops: [{ shop: "C店" }] }]
  };
  assert.equal(fns.isHomeBoss({ displayName: "罗成" }), true);
  assert.equal(fns.isHomeBoss({ displayName: "韩梦凯" }), true);
  assert.equal(fns.isHomeBoss({ displayName: "沈子晗" }), true);
  assert.deepEqual(fns.visibleDutyTeams(state, [{ shop: "A店" }]).map((t) => t.name), ["沈子晗", "韩梦凯", "毛永超"]);
  assert.deepEqual(
    fns.visibleDutyTeams({ ...state, user: { displayName: "王博" } }, [{ shop: "A店" }]).map((t) => t.name),
    ["沈子晗"]
  );
});

test("live page has fee target, warning and update time", () => {
  assert.doesNotMatch(homeJs, /function liveMetaHtml/);
  assert.doesNotMatch(homeJs, /各店费比目标在表头列里单独设置/);
  assert.match(homeJs, /liveFilterHtml\(allShops, state\) \+\s*'<div class="xm-hm-live-charts">/);
  assert.match(homeJs, /function feeWarnText/);
  assert.match(homeJs, /function feeWarnLabel/);
  assert.match(homeJs, /function feeMonitorOf/);
  assert.match(homeJs, /is-fee-cold/);
  assert.match(homeJs, /function saveFeeTargetFor/);
  assert.match(homeJs, /function feeGoalCellHtml/);
  assert.match(homeJs, /data-fee-target/);
  assert.match(homeJs, /data-fee-shop/);
  assert.match(homeJs, /label: "费比目标设置"/);
  assert.match(homeJs, /label: "费比监控"/);
  assert.doesNotMatch(homeJs, /label: "实时利润"/);
  assert.doesNotMatch(homeJs, /label: "实时销售额"/);
  assert.match(homeJs, /label: "京麦面板实时金额"/);
  assert.match(homeJs, /label: "更新时间"/);
  assert.match(homeJs, /function liveTheadHtml/);
  assert.match(homeJs, /费比监控：当前 /);
  assert.match(homeJs, /label: "更新时间"/);
  assert.match(homeJs, /is-warn/);
  assert.match(homeJs, /is-fee-warn/);
});

test("live paid table headers can shrink row spacing", () => {
  assert.match(homeJs, /function liveRowHit/);
  assert.match(homeJs, /function saveLiveRowPad/);
  assert.match(homeJs, /function saveLiveColW/);
  assert.match(homeJs, /xm-home-live-cols/);
  assert.match(homeJs, /--xm-hm-live-row/);
  assert.match(homeJs, /--xm-hm-live-row,10px/);
  assert.match(homeJs, /\.xm-hm-live \.xm-hm-table th\{border-right:1px dashed #c8ced8;text-align:center\}/);
  assert.match(homeJs, /\.xm-hm-live \.xm-hm-table \.xm-hm-num\{text-align:center;white-space:nowrap\}/);
  assert.match(homeJs, /\.xm-hm-table th\{text-align:center/);
  assert.match(homeJs, /\.xm-hm-table thead th\{text-align:center\}/);
  assert.match(homeJs, /function liveTheadHtml/);
  assert.match(homeJs, /\.xm-hm-live \.xm-hm-table th span\{display:block;width:100%;text-align:center\}/);
  assert.match(homeJs, /\.xm-hm-teams \.xm-hm-table th span\{display:block;width:100%;text-align:center\}/);
  assert.match(homeJs, /\.xm-hm-teams \.xm-hm-table th, \.xm-hm-live \.xm-hm-table th/);
});

function applyLiveHeadMove(full, fromKey, toKey) {
  const seq = full.slice();
  const from = seq.indexOf(fromKey);
  const to = seq.indexOf(toKey);
  if (from < 0 || to < 0 || from === to) {
    return seq;
  }
  seq.splice(from, 1);
  seq.splice(to, 0, fromKey);
  return seq;
}

test("live shop rows stay light pink after click until remount", () => {
  assert.match(homeJs, /function markLiveRowPicked/);
  assert.match(homeJs, /function toggleLiveRowPicked/);
  assert.match(homeJs, /function clearLiveRowPicked/);
  assert.match(homeJs, /is-picked/);
  assert.match(homeJs, /#ffe4ec/);
  assert.match(homeJs, /data-live-shop/);
  assert.match(homeJs, /clearLiveRowPicked\(\)/);
  assert.match(homeJs, /liveRow\.classList\.toggle\("is-picked", picked\)/);
  assert.match(homeJs, /nextView !== state.view/);
  assert.match(homeJs, /mount: function \(root\) \{\s*clearLiveRowPicked\(\);/s);
});

test("live shop headers can drag left and right", () => {
  assert.match(homeJs, /xm-home-live-head-order/);
  assert.match(homeJs, /function applyLiveHeadMove/);
  assert.match(homeJs, /function saveLiveHeadOrder/);
  assert.match(homeJs, /data-live-col/);
  assert.match(homeJs, /sortHead/);
  assert.match(homeJs, /function hitLiveHead/);
  assert.match(homeJs, /fromKey === "rank" \|\| toKey === "rank"/);
  assert.match(homeJs, /cellIndex >= cell.parentNode.cells.length - 3/);
  assert.match(homeJs, /function liveFeeHead/);
  assert.match(homeJs, /key === "feeWarn" \|\| key === "feeGoal"/);
  assert.match(homeJs, /table.querySelectorAll \? table.querySelectorAll\("col"\) : \[\]/);
  assert.deepEqual(
    applyLiveHeadMove(["rank", "shop", "liveAmount", "paidAmount"], "paidAmount", "shop"),
    ["rank", "paidAmount", "shop", "liveAmount"]
  );
});
