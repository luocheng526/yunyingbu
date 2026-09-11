import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "../src/app.js";
import { resetStoreForTests } from "../src/modules/profile/auth.js";
import { resetErpCacheForTests, setErpFetchForTests } from "../src/modules/data/erp.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataJs = readFileSync(join(root, "public/shared/modules/data.js"), "utf8");

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

test("data module mounts shop and goods pages against ERP proxies", () => {
  assert.match(dataJs, /XmModules\["\/data\/overview"\]/);
  assert.match(dataJs, /XmModules\["\/data\/shops"\]/);
  assert.match(dataJs, /XmModules\["\/data\/goods"\]/);
  assert.match(dataJs, /\/api\/data\/overview/);
  assert.match(dataJs, /\/api\/data\/shops/);
  assert.match(dataJs, /\/api\/data\/goods/);
  assert.match(dataJs, /\/api\/data\/shop-options/);
  assert.match(dataJs, /\/api\/data\/groups/);
  assert.match(dataJs, /\/api\/data\/categories/);
  assert.match(dataJs, /\/api\/data\/compare/);
  assert.match(dataJs, /内容待开发/);
  assert.match(dataJs, /今日订单/);
  assert.match(dataJs, /待处理/);
  assert.match(dataJs, /在职人数/);
  assert.match(dataJs, /本周发布次数/);
  assert.match(dataJs, /最近数据事件/);
  assert.match(dataJs, /<th>店铺<\/th><th>类型<\/th><th>状态<\/th><th>类目<\/th><th>简介<\/th><th>开店时间<\/th>/);
  assert.match(dataJs, /<th>商品<\/th><th>店铺<\/th><th>订单<\/th><th>应收<\/th><th>净销售<\/th><th>利润<\/th><th>推广<\/th>/);
  assert.doesNotMatch(dataJs, /<th>今日<\/th>/);
  assert.doesNotMatch(dataJs, /todayPayAmount/);
  assert.doesNotMatch(dataJs, /热销商品/);
  assert.doesNotMatch(dataJs, /店铺排行/);
  assert.doesNotMatch(dataJs, /品类走势/);
  assert.doesNotMatch(dataJs, /销售趋势/);
  assert.doesNotMatch(dataJs, /趋势看板/);
  assert.doesNotMatch(dataJs, /龙虎榜/);
  assert.doesNotMatch(dataJs, /<th>推广<\/th><th>退款率<\/th>/);
  assert.doesNotMatch(dataJs, /authInfo/);
  assert.doesNotMatch(dataJs, /XM_ERP_TOKEN/);
  assert.doesNotMatch(dataJs, /xingmai110/);
});

test("shops and goods require login", async () => {
  const shops = await fetch(`${base}/api/data/shops`);
  assert.equal(shops.status, 401);
  const goods = await fetch(`${base}/api/data/goods`);
  assert.equal(goods.status, 401);
});

test("shops return 503 when ERP login is disabled and token is missing", async () => {
  const cookie = await loginCookie();
  const res = await fetch(`${base}/api/data/shops`, { headers: { cookie } });
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.match(body.error, /XM_ERP_/);
});

function mockErp(handler) {
  const calls = [];
  setErpFetchForTests(async (url, options) => {
    const body = options.body ? JSON.parse(options.body) : {};
    calls.push({ url, body, auth: options.headers.Authorization || "" });
    return handler(url, body, options);
  });
  return calls;
}

test("shops return directory fields and strip JD auth secrets", async () => {
  process.env.XM_ERP_TOKEN = "test-token";
  const calls = mockErp(async (url) => {
    if (String(url).includes("/jd/shopInfo/page")) {
      return {
        status: 200,
        json: async () => ({
          code: 200,
          data: {
            total: 1,
            totalPages: 1,
            currentPage: 1,
            pageSize: 50,
            records: [
              {
                id: "12286853",
                shopName: "飒望苒鸥专卖店",
                type: 0,
                status: 1,
                authInfo: { appKey: "SECRET", appSecret: "SECRET", accessToken: "SECRET" }
              }
            ]
          }
        })
      };
    }
    return {
      status: 200,
      json: async () => ({
        code: 200,
        data: {
          total: 1,
          totalPages: 1,
          currentPage: 1,
          pageSize: 20,
          summary: { payAmount: 100, orderCount: 2, profit: 10, refundAmount: 1 },
          records: [{ shopId: "12286853", payAmount: 100, orderCount: 2, profit: 10, refundRate: 0.1 }]
        }
      })
    };
  });
  const cookie = await loginCookie();
  const res = await fetch(`${base}/api/data/shops`, { headers: { cookie } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.records[0].shopName, "飒望苒鸥专卖店");
  assert.equal(body.records[0].typeLabel, "POP");
  assert.equal(body.records[0].statusLabel, "营业");
  assert.equal(body.records[0].payAmount, undefined);
  assert.equal(body.records[0].authInfo, undefined);
  assert.equal(JSON.stringify(body).includes("SECRET"), false);
  assert.equal(calls.every((item) => String(item.url).includes("/jd/shopInfo/page")), true);
});

test("shop options return every shop from the directory cache", async () => {
  process.env.XM_ERP_TOKEN = "test-token";
  mockErp(async (url) => {
    if (String(url).includes("/jd/shopInfo/page")) {
      return {
        status: 200,
        json: async () => ({
          code: 200,
          data: {
            total: 2,
            totalPages: 1,
            currentPage: 1,
            pageSize: 50,
            records: [
              { id: "1", shopName: "甲店", type: 0, status: 1 },
              { id: "2", shopName: "乙店", type: 0, status: 1 }
            ]
          }
        })
      };
    }
    throw new Error("shop-options should only read shopInfo");
  });
  const cookie = await loginCookie();
  const res = await fetch(`${base}/api/data/shop-options`, { headers: { cookie } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.total, 2);
  assert.equal(body.records.length, 2);
  assert.equal(body.records[0].shopName, "甲店");
});

test("goods load all shop ids when none are selected", async () => {
  process.env.XM_ERP_TOKEN = "test-token";
  process.env.XM_ERP_BASE = "http://erp.test";
  const calls = [];
  setErpFetchForTests(async (url, options) => {
    const body = JSON.parse(options.body);
    calls.push({ url, body });
    if (String(url).includes("/jd/shopInfo/page")) {
      return {
        status: 200,
        json: async () => ({
          code: 200,
          data: {
            total: 1,
            totalPages: 1,
            currentPage: 1,
            pageSize: 50,
            records: [{ id: "19852571", shopName: "示例店" }]
          }
        })
      };
    }
    return {
      status: 200,
      json: async () => ({
        code: 200,
        data: {
          total: 1,
          totalPages: 1,
          currentPage: 1,
          pageSize: 20,
          records: [
            {
              shopId: "19852571",
              productId: "10032803848911",
              productName: "剃须刀",
              payAmount: 100,
              netSalesAmount: 80,
              profit: 10,
              promotionCost: 5,
              orderCount: 3
            }
          ]
        }
      })
    };
  });
  const cookie = await loginCookie();
  const res = await fetch(`${base}/api/data/goods`, { headers: { cookie } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.records[0].productName, "剃须刀");
  assert.equal(body.records[0].payAmount, 100);
  assert.equal(calls[0].url, "http://erp.test/product/jd/shopInfo/page");
  assert.equal(calls[1].url, "http://erp.test/product/jd/order/product/page");
  assert.deepEqual(calls[1].body.shopIds, [19852571]);
});

test("logs into ERP and retries once after an expired token", async () => {
  delete process.env.XM_ERP_LOGIN;
  process.env.XM_ERP_USERNAME = "罗成";
  process.env.XM_ERP_PASSWORD = "xingmai110";
  const calls = [];
  setErpFetchForTests(async (url, options) => {
    const body = options.body ? JSON.parse(options.body) : {};
    calls.push({ url, body, auth: options.headers.Authorization || "" });
    if (String(url).includes("/system/auth/login")) {
      assert.equal(body.username, "罗成");
      assert.equal(body.password, "xingmai110");
      return {
        status: 200,
        json: async () => ({
          code: 200,
          message: "登录成功！",
          data: { token: `fresh-token-${calls.length}`, expireTime: "2099-01-01 00:00:00" }
        })
      };
    }
    if ((options.headers.Authorization || "").includes("fresh-token-1")) {
      return {
        status: 401,
        json: async () => ({ code: 401, message: "token已过期" })
      };
    }
    return {
      status: 200,
      json: async () => ({
        code: 200,
        data: {
          total: 1,
          totalPages: 1,
          currentPage: 1,
          pageSize: 20,
          records: [{ id: "1", shopName: "续期后的店", type: 0, status: 1 }]
        }
      })
    };
  });
  const cookie = await loginCookie();
  const first = await fetch(`${base}/api/data/shops`, { headers: { cookie } });
  assert.equal(first.status, 200);
  assert.equal((await first.json()).records[0].shopName, "续期后的店");
  const again = await fetch(`${base}/api/data/shops`, { headers: { cookie } });
  assert.equal(again.status, 200);
  const loginCalls = calls.filter((item) => String(item.url).includes("/auth/login"));
  const shopInfoCalls = calls.filter((item) => String(item.url).includes("/shopInfo/page"));
  assert.equal(loginCalls.length, 2);
  assert.equal(shopInfoCalls[0].auth, "Bearer fresh-token-1");
  assert.equal(shopInfoCalls.at(-1).auth, "Bearer fresh-token-3");
});

test("overview maps trend, shop rank and hot goods", async () => {
  process.env.XM_ERP_TOKEN = "test-token";
  mockErp(async (url) => {
    if (String(url).includes("/board/salesTrend")) {
      return {
        status: 200,
        json: async () => ({
          code: 200,
          data: [
            { date: "2026-09-10", payAmount: 10, orderCount: 1, profit: 2, refundAmount: 1, promotionCost: 3 }
          ]
        })
      };
    }
    if (String(url).includes("/jd/shopInfo/page")) {
      return {
        status: 200,
        json: async () => ({
          code: 200,
          data: {
            total: 1,
            totalPages: 1,
            records: [{ id: "1", shopName: "示例店", type: 0, status: 1 }]
          }
        })
      };
    }
    if (String(url).includes("/jd/order/shop/page")) {
      return {
        status: 200,
        json: async () => ({
          code: 200,
          data: {
            total: 1,
            totalPages: 1,
            currentPage: 1,
            pageSize: 8,
            summary: { payAmount: 88, orderCount: 9, profit: 7, refundAmount: 3 },
            records: [{ shopId: "1", payAmount: 88, orderCount: 9, profit: 7 }]
          }
        })
      };
    }
    return {
      status: 200,
      json: async () => ({
        code: 200,
        data: [{ shopId: "1", productId: "9", productName: "热销刀", payAmount: 50 }]
      })
    };
  });
  const cookie = await loginCookie();
  const res = await fetch(`${base}/api/data/overview`, { headers: { cookie } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.source, "xingmai-erp");
  assert.equal(body.cards[0].label, "应收金额");
  assert.equal(body.cards[0].value, 88);
  assert.equal(body.trend[0].date, "2026-09-10");
  assert.equal(body.shops[0].shopName, "示例店");
  assert.equal(body.goods[0].productName, "热销刀");
  assert.equal(body.events, undefined);
});

test("channel groups, categories and compare map ERP boards", async () => {
  process.env.XM_ERP_TOKEN = "test-token";
  mockErp(async (url) => {
    if (String(url).includes("/channel/group/list")) {
      return {
        status: 200,
        json: async () => ({
          code: 200,
          data: [{ id: 3, name: "家居包", details: [{ shopId: "1", shopName: "示例店" }] }]
        })
      };
    }
    if (String(url).includes("/channel/category/trend")) {
      return {
        status: 200,
        json: async () => ({
          code: 200,
          data: [{ date: "2026-09-01", payAmount: 20, orderCount: 2, profit: 1, refundAmount: 0 }]
        })
      };
    }
    if (String(url).includes("/channel/category/list")) {
      return {
        status: 200,
        json: async () => ({
          code: 200,
          data: [{ thirdCategoryId: "34706", categoryName: "记忆枕", payAmount: 99, orderCount: 4, profit: 8, refundRate: 0.1 }]
        })
      };
    }
    return {
      status: 200,
      json: async () => ({
        code: 200,
        data: [{ yearMonth: "2026-08", payAmount: 50, netAmount: 40, profit: 5, refundAmount: 2, promotionCost: 3, profitRate: 0.1 }]
      })
    };
  });
  const cookie = await loginCookie();
  const groups = await fetch(`${base}/api/data/groups`, { headers: { cookie } });
  assert.equal(groups.status, 200);
  assert.equal((await groups.json()).records[0].name, "家居包");
  const categories = await fetch(`${base}/api/data/categories`, { headers: { cookie } });
  assert.equal(categories.status, 200);
  const categoryBody = await categories.json();
  assert.equal(categoryBody.records[0].categoryName, "记忆枕");
  assert.equal(categoryBody.trend[0].date, "2026-09-01");
  const compare = await fetch(`${base}/api/data/compare`, { headers: { cookie } });
  assert.equal(compare.status, 200);
  assert.equal((await compare.json()).records[0].yearMonth, "2026-08");
});
