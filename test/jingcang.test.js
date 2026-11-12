import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import test from "node:test";
import { createApp } from "../src/app.js";
import { JINGCANG_TEST_STORE, loadJingcang, parseStockPage, resetJingcangJob, setJingcangHooks, stockQuery } from "../src/modules/shen/jingcang.js";
import { listSessions, resetJingmaiStore, saveSession } from "../src/modules/shen/jingmai-store.js";

const SECRET = "shop-session-value";

function stockRow(sku, warehouses) {
  return {
    skuInfo: {
      skuId: sku,
      spuId: "100290230908",
      skuName: "RASW【德国】婴儿理发器超静音自动吸发",
      logo: "jfs/t1/example.jpg",
      itemNum: "RXF-T",
      skuStatusName: "在售"
    },
    showLabels: [{ code: "label_isJDexpress", name: "京东物流" }],
    stockDetails: warehouses
  };
}

function house(name, qty) {
  return { warehouse: { sName: name, sid: name.length }, stockNum: { availableStock: qty, totalStock: qty + 4 } };
}

function page(rows, total) {
  return { code: 200, totalNum: total, data: rows };
}

function jsonResponse(body, status) {
  return {
    status: status || 200,
    headers: { get: function () { return ""; } },
    text: async function () { return JSON.stringify(body); }
  };
}

test("stock rows keep each warehouse quantity and drop 全国仓", () => {
  const parsed = parseStockPage(page([
    stockRow("1023541407306", [
      house("商家全国仓", 99999),
      house("无锡常温C平台仓13号库-CHN", 36),
      house("廊坊常温C平台仓5号库-CHN", 11),
      house("北京常温C平台仓55号库-CHN", 0)
    ])
  ], 1));
  assert.equal(parsed.stock, true);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].sku, "1023541407306");
  assert.equal(parsed.rows[0].spu, "100290230908");
  assert.equal(parsed.rows[0].image, "https://img10.360buyimg.com/n4/jfs/t1/example.jpg");
  assert.deepEqual(parsed.rows[0].warehouses.map(function (item) { return item.qty; }), [36, 11, 0]);
  assert.equal(JSON.stringify(parsed).includes("全国仓"), false);
  assert.equal(JSON.stringify(parsed).includes("99999"), false);
});

test("only 京东物流 tagged skus are returned", async () => {
  await resetJingmaiStore();
  await saveSession(JINGCANG_TEST_STORE, { cookies: [{ name: "thor", value: SECRET }], authState: "ok", enabled: true });
  const plain = stockRow("1023541407307", [house("北京常温C平台仓55号库-CHN", 4)]);
  delete plain.showLabels;
  const result = await loadJingcang(JINGCANG_TEST_STORE, {
    fetchImpl: async function () {
      return jsonResponse(page([
        stockRow("10235451473396", [house("无锡常温C平台仓13号库-CHN", 36), house("商家全国仓", 99999)]),
        plain
      ], 2));
    },
    readShopStock: async function () {
      return [];
    }
  });
  assert.equal(result.ok, true);
  assert.equal(result.count, 1);
  assert.equal(result.rows[0].sku, "10235451473396");
  assert.equal(result.rows[0].warehouses.length, 1);
  assert.equal(JSON.stringify(result).includes("全国仓"), false);
  await resetJingmaiStore();
});

test("a nested DSM payload still lists the sku", () => {
  const parsed = parseStockPage({ code: 200, data: page([stockRow("1023541407306", [house("北京常温C平台仓55号库-CHN", 45)])], 1) });
  assert.equal(parsed.rows[0].warehouses[0].kind, "京东仓");
  assert.equal(parsed.rows[0].warehouses[0].qty, 45);
});

test("RASW stock pages through every sku and never returns the cookie", async () => {
  await resetJingmaiStore();
  await saveSession(JINGCANG_TEST_STORE, { cookies: [{ name: "thor", value: SECRET }], authState: "ok", enabled: true });
  const calls = [];
  const fetchImpl = async function (url, options) {
    calls.push({ url: url, body: JSON.parse(options.body), cookie: options.headers.cookie });
    const pageNo = calls.length;
    if (pageNo === 1) {
      return jsonResponse(page([stockRow("1023541407306", [house("无锡常温C平台仓13号库-CHN", 36)])], 2));
    }
    return jsonResponse(page([stockRow("1023541407307", [house("廊坊常温C平台仓5号库-CHN", 11)])], 2));
  };
  let browser = 0;
  const result = await loadJingcang(JINGCANG_TEST_STORE, {
    fetchImpl: fetchImpl,
    readShopStock: async function () {
      browser += 1;
      return [];
    }
  });
  assert.equal(result.ok, true);
  assert.equal(result.count, 2);
  assert.equal(result.truncated, false);
  assert.equal(result.source, "dsm");
  assert.equal(browser, 0);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].body.request.data.pageNo, 1);
  assert.equal(stockQuery(1, 50).request.source, "pc");
  assert.match(calls[0].url, /queryStockByPage/);
  assert.equal(calls[0].cookie.includes(SECRET), true);
  assert.equal(JSON.stringify(result).includes(SECRET), false);
  assert.equal(JSON.stringify(result).includes("cookie"), false);
  const again = await listSessions();
  assert.equal(again.find(function (item) { return item.store === JINGCANG_TEST_STORE; }).authState, "ok");
  await resetJingmaiStore();
});

test("a login failure does not open the browser or mark the shop logged out", async () => {
  await resetJingmaiStore();
  await saveSession(JINGCANG_TEST_STORE, { cookies: [{ name: "thor", value: SECRET }], authState: "ok", enabled: true });
  let browser = 0;
  const result = await loadJingcang(JINGCANG_TEST_STORE, {
    fetchImpl: async function () {
      return jsonResponse({ code: 1001, msg: "未登录" }, 200);
    },
    readShopStock: async function () {
      browser += 1;
      return [];
    }
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /登录已失效/);
  assert.equal(browser, 0);
  assert.equal(JSON.stringify(result).includes(SECRET), false);
  const sessions = await listSessions();
  assert.equal(sessions.find(function (item) { return item.store === JINGCANG_TEST_STORE; }).cookies[0].value, SECRET);
  await resetJingmaiStore();
});

test("an unsigned DSM reply falls back to the inventory page", async () => {
  await resetJingmaiStore();
  await saveSession(JINGCANG_TEST_STORE, { cookies: [{ name: "thor", value: SECRET }], authState: "ok", enabled: true });
  const result = await loadJingcang(JINGCANG_TEST_STORE, {
    fetchImpl: async function () {
      return jsonResponse({ code: 200, data: { freeBrand: true } });
    },
    readShopStock: async function (jar) {
      assert.equal(JSON.stringify(jar).includes(SECRET), true);
      return [JSON.stringify(page([stockRow("1023541407306", [house("北京常温C平台仓55号库-CHN", 45), house("商家全国仓", 99999)])], 1))];
    }
  });
  assert.equal(result.ok, true);
  assert.equal(result.source, "page");
  assert.equal(result.rows[0].sku, "1023541407306");
  assert.equal(result.rows[0].warehouses.length, 1);
  assert.equal(JSON.stringify(result).includes("全国仓"), false);
  assert.equal(JSON.stringify(result).includes(SECRET), false);
  await resetJingmaiStore();
});

test("GET /api/shen/jingcang only serves the one test shop", async () => {
  await resetJingmaiStore();
  resetJingcangJob();
  setJingcangHooks({
    fetchImpl: async function () {
      return jsonResponse(page([stockRow("1023541407306", [house("无锡常温C平台仓13号库-CHN", 36)])], 1));
    },
    readShopStock: async function () {
      return [];
    }
  });
  await saveSession(JINGCANG_TEST_STORE, { cookies: [{ name: "thor", value: SECRET }], authState: "ok", enabled: true });
  const app = createApp();
  const server = http.createServer(app);
  await new Promise(function (resolve) { server.listen(0, "127.0.0.1", resolve); });
  const base = "http://127.0.0.1:" + server.address().port;
  try {
    const ok = await fetch(base + "/api/shen/jingcang?store=" + encodeURIComponent(JINGCANG_TEST_STORE));
    const text = await ok.text();
    assert.equal(ok.status, 200);
    assert.equal(text.includes(SECRET), false);
    assert.equal(text.includes("全国仓"), false);
    const body = JSON.parse(text);
    assert.equal(body.count, 1);
    assert.equal(body.rows[0].warehouses[0].qty, 36);
    const other = await fetch(base + "/api/shen/jingcang?store=" + encodeURIComponent("RASW家居旗舰店"));
    assert.equal(other.status, 400);
  } finally {
    setJingcangHooks(null);
    resetJingcangJob();
    await resetJingmaiStore();
    await new Promise(function (resolve) { server.close(resolve); });
  }
});

test("jingcang sku rows stay visible when the product title is not a shop name", () => {
  const source = fs.readFileSync(new URL("../public/shared/nav.js", import.meta.url), "utf8");
  const shopNameOf = source.slice(source.indexOf("function shopNameOf"), source.indexOf("function queryValue"));
  const keepCenterRow = source.slice(source.indexOf("function keepCenterRow"), source.indexOf("const SHOP_LIST_KEYS"));
  const scope = new Function(`${shopNameOf}\n${keepCenterRow}\nreturn keepCenterRow;`)();
  const allow = function (name) {
    return name === "RASW潮流生活旗舰店";
  };
  assert.equal(
    scope({ name: "RASW【德国】婴儿理发器超静音自动吸发", sku: "10235451473396", warehouses: [{ name: "无锡常温C平台仓13号库-CHN", qty: 36 }] }, allow),
    true
  );
  assert.equal(scope({ store: "别的店铺" }, allow), false);
  assert.equal(scope({ store: "RASW潮流生活旗舰店" }, allow), true);
});
