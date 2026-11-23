import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { patchExpiredShopLogin, patchLive2OfflineRelogin } from "../src/modules/home/router.js";

const homeJs = readFileSync(new URL("../public/shared/modules/home.js", import.meta.url), "utf8");

test("实时 has one entry after 近七天业绩汇总 and uses live2", () => {
  const views = homeJs.slice(homeJs.indexOf("var VIEWS"), homeJs.indexOf("var OVERVIEW_PANES"));
  assert.match(views, /key: "week", label: "近七天业绩汇总" \},\s*\{ key: "live2", label: "实时" \}/);
  assert.doesNotMatch(views, /key: "live"|实时（新版）/);
  assert.match(homeJs, /live2: true/);
  assert.match(homeJs, /function adaptLive2Shops/);
  assert.match(homeJs, /xm-home-live2-/);
  assert.match(homeJs, /采集功能待接入/);
  assert.match(homeJs, /实时费比 =（实时付费金额 \/ 实时成交金额）× 100%/);
  assert.match(homeJs, /data-connect-live2/);
  assert.match(homeJs, /data-refresh-live2/);
  assert.match(homeJs, /pendingCollect/);
  assert.match(homeJs, /待接入/);
  assert.match(homeJs, /待更新/);
  assert.match(homeJs, /家需要重新登录/);
  assert.match(homeJs, /重新登录<\/button>/);
  const oldClient =
    "      if (link.kind === \"stale\") {\n" +
    "        return '<td class=\"xm-hm-num is-fee-warm\" title=\"这一轮到截止时间还没采完，沿用今天最近一次成功的数据\">' + escapeHtml(link.label) + \"</td>\";\n" +
    "      }\n" +
    "          var name = String((row && (row.shop || row.shopName)) || \"\").trim();\n" +
    "          if (!name || row.online === true) {\n" +
    "            return;\n" +
    "          }\n" +
    "          if (row.offline === true || row.loginExpired === true || !row.capturedAt) {\n" +
    "            allowed[name] = true;\n" +
    "          }";
  const patched = patchExpiredShopLogin(oldClient);
  assert.match(patched, /待更新<\/button>/);
  assert.match(patched, /row\.pendingUpdate === true/);
  assert.equal(patchExpiredShopLogin(homeJs), homeJs);
  assert.equal(patchLive2OfflineRelogin(homeJs), homeJs);
  const oldLive2 = [
    "  function liveLinkOf(row) {",
    "    if (row && row.pendingUpdate) {",
    "      return { label: \"待更新\", kind: \"stale\" };",
    "    }",
    "    if (row && row.pendingCollect) {",
    "      return { label: \"待接入\", kind: \"wait\" };",
    "    }",
    "    if (row && row.online === true) {",
    "      if (row.adsFailed === true) {",
    "        return { label: \"在线·广告异常\", kind: \"ads\" };",
    "      }",
    "      return { label: \"在线\", kind: \"on\" };",
    "    }",
    "    if (row && row.loginExpired === true) {",
    "      return { label: \"掉线\", kind: \"off\" };",
    "    }",
    "    if (row && row.adsFailed === true) {",
    "      return { label: \"广告异常\", kind: \"ads\" };",
    "    }",
    "    if (row && row.offline === true) {",
    "      return { label: \"采集异常\", kind: \"warn\" };",
    "    }",
    "    return { label: \"\", kind: \"\" };",
    "  }",
    "      if (link.kind === \"off\") {",
    "        return (",
    "          '<td class=\"xm-hm-num is-fee-hot\"><button type=\"button\" class=\"xm-hm-login-link\" data-live-login=\"' +",
    "          escapeHtml(shop) +",
    "          '\"' +",
    "          (row && row.offlineReason ? ' title=\"' + escapeHtml(row.offlineReason) + '\"' : \"\") +",
    "          \">掉线</button></td>\"",
    "        );",
    "      }",
    "  function live2FilterHtml(allShops, state) {",
    "'<span class=\"xm-hm-live-at\">更新时间 ' + escapeHtml(updatedAt || \"—\") + \"</span>\" +",
    "      '<button type=\"button\" class=\"xm-hm-live-heads\" data-live-heads>表头设置</button>' +",
    "\".xm-hm-login-link{border:0;background:transparent;padding:0;color:#e23b3b;font:inherit;font-weight:700;cursor:pointer;text-decoration:underline}\" +",
    "      \".xm-hm-login-link.is-wait{color:#2f6fed}\" +"
  ].join("\n");
  const live2Patched = patchLive2OfflineRelogin(oldLive2);
  assert.match(live2Patched, /重新登录<\/button>/);
  assert.match(live2Patched, /家需要重新登录/);
  assert.match(live2Patched, /function live2NeedHtml/);
  assert.match(homeJs, /data-live-login="'\s*\+\s*escapeHtml\(shop\)\s*\+\s*'" title="登录已失效，或这一轮没采完。点开后账号和密码会填好，登录由你来点">待更新<\/button>/);
  assert.match(homeJs, /publishedAt === pack\.publishedAt/);
  assert.match(homeJs, /xm-hm-login-link is-wait[\s\S]{0,180}待接入<\/button>/);
  assert.match(homeJs, /manual: state\.view === "live2"/);
  assert.match(homeJs, /账号和密码已经填好，请在画面里点登录/);
  assert.match(homeJs, /启动浏览器\/\.test\(String\(next\.message \|\| ""\)\) && keptMessage/);
  const panel = homeJs.slice(homeJs.indexOf("function live2PanelHtml"), homeJs.indexOf("function paint"));
  assert.match(panel, /liveDeskHtml\(state\)/);
  assert.match(panel, /live2Charts\(packed, scoped\)/);
  assert.match(panel, /live2Cards\(scoped, shops/);
  assert.match(homeJs, /function live2FilterHtml[\s\S]{0,280}visibleDutyTeams\(state, allShops\)/);
  assert.match(homeJs, /xm-home-live2-yday/);
  assert.match(homeJs, /function live2Charts/);
});

test("opening 实时（新版） does not call old collect or login endpoints", () => {
  const start = homeJs.indexOf("function refreshLive2");
  const end = homeJs.indexOf("function pullLive");
  const body = homeJs.slice(start, end);
  assert.equal(start > 0, true);
  assert.match(body, /\/api\/people\/org\/stores/);
  assert.match(body, /\/api\/home\/live2/);
  assert.doesNotMatch(body, /local-paid|live-login|jingmai|erp-paid|\/api\/shen\/paid|\/api\/han\/paid/);
  const mount = homeJs.slice(homeJs.lastIndexOf("pullBoard();"));
  assert.match(mount, /state\.view === "live2"[\s\S]*refreshLive2\(\)[\s\S]*pullLive\(\)/);
  assert.match(homeJs, /if \(state\.view === "live" \|\| state\.view === "company"\) \{\s*pullLive\(\);\s*\}/);
  assert.match(homeJs, /if \(state\.view === "live2"\) \{\s*watchLive2\(\);\s*\}/);
  assert.match(homeJs, /function watchLive2\(\) \{\s*api\("\/api\/home\/live2\?_=" \+ Date\.now\(\)\)\.then\(takeLive2\);\s*\}/);
  const boot = homeJs.slice(homeJs.lastIndexOf("pullBoard();"), homeJs.lastIndexOf("poll = window.setInterval"));
  assert.match(boot, /state\.view === "live2"/);
  assert.match(boot, /refreshLive2\(\)/);
  assert.match(boot, /pullLive\(\)/);
  assert.doesNotMatch(boot, /view === "live2"[\s\S]{0,40}pullLive\(/);
});

test("selecting a team or a shop changes the live2 totals", () => {
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
  const store = {};
  global.localStorage = {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key, value) {
      store[key] = String(value);
    }
  };
  const fns = new Function(
    "liveScope",
    pick("normShopName") +
      pick("dutyTeamList") +
      pick("shopsInDutyTeam") +
      pick("liveFilter") +
      pick("live2ScopeShops") +
      pick("asNum") +
      pick("live2Sums") +
      pick("padHours") +
      pick("shanghaiHour") +
      pick("scaleHourList") +
      pick("scaleLive2Day") +
      "return {live2ScopeShops, live2Sums, scaleLive2Day, shanghaiHour};"
  )("live2");
  const state = {
    teams: [{ name: "韩梦凯", shops: [{ shop: "B店" }, { shop: "C店" }] }],
    chiefs: [{ name: "精铺组 韩梦凯", shops: [{ shop: "B店" }] }],
    orgIdle: {}
  };
  const shops = [
    { shop: "A店", liveAmount: "100", paidAmount: "10", paidDeal: "40", pendingCollect: false },
    { shop: "B店", liveAmount: "50", paidAmount: "20", paidDeal: "30", pendingCollect: false },
    { shop: "C店", liveAmount: "25", paidAmount: "5", paidDeal: "8", pendingCollect: false }
  ];
  localStorage.setItem("xm-home-live2-filter", JSON.stringify({ team: "韩梦凯", shop: "" }));
  const teamShops = fns.live2ScopeShops(shops, state).map((row) => row.shop);
  assert.deepEqual(teamShops, ["B店", "C店"]);
  assert.equal(fns.live2Sums(fns.live2ScopeShops(shops, state)).deal, 75);
  assert.equal(fns.live2Sums(fns.live2ScopeShops(shops, state)).paidDeal, 38);
  localStorage.setItem("xm-home-live2-filter", JSON.stringify({ team: "精铺组 韩梦凯", shop: "" }));
  assert.deepEqual(
    fns.live2ScopeShops(shops, state).map((row) => row.shop),
    ["B店"]
  );
  localStorage.setItem("xm-home-live2-filter", JSON.stringify({ team: "", shop: "A店" }));
  const one = fns.live2Sums(fns.live2ScopeShops(shops, state));
  assert.equal(one.deal, 100);
  assert.equal(one.spend, 10);
  const all = fns.live2Sums(shops);
  const hour = fns.shanghaiHour();
  const scaled = fns.scaleLive2Day(
    { jingmaiAt: [200, 300], spendAt: [20, 40] },
    one.deal / all.deal,
    one.spend / all.spend,
    one
  );
  assert.equal(scaled.jingmaiAt[hour], 100);
  assert.equal(scaled.spendAt[hour], 10);
  assert.ok(scaled.jingmaiAt[0] < all.deal);
});
