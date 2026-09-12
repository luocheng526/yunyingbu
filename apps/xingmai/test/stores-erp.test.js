import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "../src/app.js";
import { resetStoreForTests } from "../src/modules/profile/auth.js";
import { resetErpCacheForTests, setErpFetchForTests } from "../src/modules/data/erp.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const storesJs = readFileSync(join(root, "public/shared/modules/stores.js"), "utf8");
const storesCss = readFileSync(join(root, "public/stores.css"), "utf8");

const prevToken = process.env.XM_ERP_TOKEN;
const prevBase = process.env.XM_ERP_BASE;
const prevLogin = process.env.XM_ERP_LOGIN;
const prevUser = process.env.XM_ERP_USERNAME;
const prevPass = process.env.XM_ERP_PASSWORD;
const server = createApp().listen(0);
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

beforeEach(() => {
  resetStoreForTests();
  resetErpCacheForTests();
  setErpFetchForTests(null);
  delete process.env.XM_ERP_TOKEN;
  delete process.env.XM_ERP_USERNAME;
  delete process.env.XM_ERP_PASSWORD;
  process.env.XM_ERP_LOGIN = "0";
  process.env.XM_ERP_BASE = "http://erp.test";
});

after(() => {
  setErpFetchForTests(null);
  resetErpCacheForTests();
  restoreEnv("XM_ERP_TOKEN", prevToken);
  restoreEnv("XM_ERP_BASE", prevBase);
  restoreEnv("XM_ERP_LOGIN", prevLogin);
  restoreEnv("XM_ERP_USERNAME", prevUser);
  restoreEnv("XM_ERP_PASSWORD", prevPass);
  server.close();
});

function restoreEnv(name, value) {
  if (value == null) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

async function loginCookie() {
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "luocheng", password: "ChangeMe123!" })
  });
  assert.equal(res.status, 200);
  return String(res.headers.get("set-cookie") || "").split(";")[0];
}

function jsonRes(data, status = 200) {
  return {
    status,
    json: async () => ({ code: 200, data })
  };
}

function mockErp(handler) {
  const calls = [];
  setErpFetchForTests(async (url, options) => {
    const body = options.body ? JSON.parse(options.body) : {};
    calls.push({ url, body, auth: options.headers.Authorization || "" });
    return handler(url, body, options);
  });
  return calls;
}

function shopPage() {
  return jsonRes({
    total: 1,
    totalPages: 1,
    currentPage: 1,
    pageSize: 50,
    records: [
      {
        id: "19852571",
        shopName: "京东家居旗舰店",
        type: 0,
        status: 1,
        authInfo: { appKey: "SECRET", appSecret: "SECRET", accessToken: "SECRET" }
      }
    ]
  });
}

test("stores module mounts four ERP pages with the screenshot titles", () => {
  assert.match(storesJs, /XmModules\["\/stores"\]/);
  assert.match(storesJs, /XmModules\[page\.path\]/);
  assert.match(storesJs, /\/stores\/reviews/);
  assert.match(storesJs, /\/stores\/violations/);
  assert.match(storesJs, /\/stores\/shipping/);
  assert.match(storesJs, /\/stores\/inventory/);
  assert.match(storesJs, /评价管理/);
  assert.match(storesJs, /违规管理/);
  assert.match(storesJs, /发货监控/);
  assert.match(storesJs, /京东库存监控/);
  assert.match(storesJs, /\/api\/stores\/erp\/reviews/);
  assert.match(storesJs, /\/api\/stores\/erp\/violations/);
  assert.match(storesJs, /\/api\/stores\/erp\/shipping/);
  assert.match(storesJs, /\/api\/stores\/erp\/inventory/);
  assert.doesNotMatch(storesJs, /authInfo/);
  assert.doesNotMatch(storesJs, /xingmai110/);
  assert.doesNotMatch(storesJs, /店铺档案/);
  assert.match(storesJs, /stores-board/);
  assert.match(storesCss, /flex-direction: row/);
  assert.match(storesCss, /--xm-primary-soft/);
  assert.doesNotMatch(storesCss, /#f5f5f7/);
  assert.doesNotMatch(storesCss, /grid-template-columns:\s*200px/);
});

test("stores root still reports the module name", async () => {
  const cookie = await loginCookie();
  const res = await fetch(`${base}/api/stores`, { headers: { cookie } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.module, "店铺维护中心");
  assert.equal(body.pages[0].title, "评价管理");
  assert.equal(body.pages[1].title, "违规管理");
  assert.equal(body.pages[2].title, "发货监控");
  assert.equal(body.pages[3].title, "京东库存监控");
});

test("ERP store pages require login", async () => {
  const reviews = await fetch(`${base}/api/stores/erp/reviews`);
  assert.equal(reviews.status, 401);
  const shipping = await fetch(`${base}/api/stores/erp/shipping`);
  assert.equal(shipping.status, 401);
});

test("ERP store pages return 503 when ERP login is disabled and token is missing", async () => {
  const cookie = await loginCookie();
  const res = await fetch(`${base}/api/stores/erp/reviews`, { headers: { cookie } });
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.match(body.error, /XM_ERP_/);
});

test("reviews proxy product page and hide shop auth secrets", async () => {
  process.env.XM_ERP_TOKEN = "test-token";
  const calls = mockErp(async (url) => {
    if (String(url).includes("/jd/shopInfo/page")) {
      return shopPage();
    }
    if (String(url).includes("/jd/product/page")) {
      return jsonRes({
        total: 2,
        totalPages: 1,
        currentPage: 1,
        pageSize: 20,
        records: [
          {
            productId: "1001",
            productName: "差评枕头",
            shopId: "19852571",
            productStatus: 105,
            stockNum: 8,
            oneStarNum: 12,
            salesVolume: 30,
            authInfo: { accessToken: "SECRET" }
          }
        ]
      });
    }
    throw new Error("unexpected " + url);
  });
  const cookie = await loginCookie();
  const res = await fetch(`${base}/api/stores/erp/reviews?shopId=19852571`, { headers: { cookie } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.page, "评价管理");
  assert.equal(body.records[0].productName, "差评枕头");
  assert.equal(body.records[0].shopName, "京东家居旗舰店");
  assert.equal(body.records[0].oneStarNum, 12);
  assert.equal(body.records[0].stockLabel, "低库存");
  assert.equal(body.records[0].authInfo, undefined);
  assert.equal(JSON.stringify(body).includes("SECRET"), false);
  const productCall = calls.find((item) => String(item.url).includes("/jd/product/page"));
  assert.deepEqual(productCall.body.shopIds, [19852571]);
  assert.equal(productCall.body.orderBy, "salesVolume");
  assert.equal(productCall.body.asc, false);
});

test("violations request system-off and deleted goods", async () => {
  process.env.XM_ERP_TOKEN = "test-token";
  const calls = mockErp(async (url) => {
    if (String(url).includes("/jd/shopInfo/page")) {
      return shopPage();
    }
    return jsonRes({
      total: 1,
      totalPages: 1,
      currentPage: 1,
      pageSize: 20,
      records: [{ productId: "9", productName: "违规沙发", shopId: "19852571", productStatus: 103, stockNum: 0 }]
    });
  });
  const cookie = await loginCookie();
  const res = await fetch(`${base}/api/stores/erp/violations`, { headers: { cookie } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.page, "违规管理");
  assert.equal(body.records[0].statusLabel, "系统下架");
  const productCall = calls.find((item) => String(item.url).includes("/jd/product/page"));
  assert.deepEqual(productCall.body.productStatus, [103, 0]);
});

test("shipping monitors waiting and shipped orders", async () => {
  process.env.XM_ERP_TOKEN = "test-token";
  const calls = mockErp(async (url) => {
    if (String(url).includes("/jd/shopInfo/page")) {
      return shopPage();
    }
    return jsonRes({
      total: 2,
      totalPages: 1,
      currentPage: 1,
      pageSize: 20,
      records: [
        {
          orderId: "3388",
          shopId: "19852571",
          orderStatus: 3,
          actualPrice: 99.5,
          payTime: "2026-09-12 10:00:00",
          buyerRemark: "尽快发",
          orderProducts: [{ skuName: "被子", skuNum: 2 }]
        }
      ]
    });
  });
  const cookie = await loginCookie();
  const res = await fetch(`${base}/api/stores/erp/shipping`, { headers: { cookie } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.page, "发货监控");
  assert.equal(body.records[0].statusLabel, "待发货");
  assert.equal(body.records[0].skuCount, 2);
  assert.equal(body.summary.waiting, 1);
  const orderCall = calls.find((item) => String(item.url).includes("/jd/order/page"));
  assert.deepEqual(orderCall.body.orderStatus, [3, 6]);
});

test("inventory flags negative stock as abnormal", async () => {
  process.env.XM_ERP_TOKEN = "test-token";
  mockErp(async (url) => {
    if (String(url).includes("/jd/shopInfo/page")) {
      return shopPage();
    }
    return jsonRes({
      total: 1,
      totalPages: 1,
      currentPage: 1,
      pageSize: 20,
      records: [{ productId: "77", productName: "异常库存", shopId: "19852571", productStatus: 105, stockNum: -3 }]
    });
  });
  const cookie = await loginCookie();
  const res = await fetch(`${base}/api/stores/erp/inventory`, { headers: { cookie } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.page, "京东库存监控");
  assert.equal(body.records[0].stockLabel, "库存异常");
  assert.equal(body.summary.abnormal, 1);
});

test("ERP SQL errors are not leaked to the client", async () => {
  process.env.XM_ERP_TOKEN = "test-token";
  mockErp(async (url) => {
    if (String(url).includes("/jd/shopInfo/page")) {
      return shopPage();
    }
    return {
      status: 200,
      json: async () => ({
        code: 500,
        message: "Error querying database. Unknown column 'oneStarNum' in 'order clause' bad SQL grammar []"
      })
    };
  });
  const cookie = await loginCookie();
  const res = await fetch(`${base}/api/stores/erp/reviews`, { headers: { cookie } });
  assert.equal(res.status, 502);
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.match(body.error, /星脉 ERP 查询失败/);
  assert.doesNotMatch(body.error, /Unknown column/);
  assert.doesNotMatch(body.error, /SQL/);
});

test("shop list strips JD auth tokens", async () => {
  process.env.XM_ERP_TOKEN = "test-token";
  mockErp(async (url) => {
    if (String(url).includes("/jd/shopInfo/page")) {
      return shopPage();
    }
    throw new Error("shops should only read shopInfo");
  });
  const cookie = await loginCookie();
  const res = await fetch(`${base}/api/stores/erp/shops`, { headers: { cookie } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.records[0].shopName, "京东家居旗舰店");
  assert.equal(body.records[0].authInfo, undefined);
  assert.equal(JSON.stringify(body).includes("SECRET"), false);
});
