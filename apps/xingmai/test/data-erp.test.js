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
const server = createApp().listen(0);
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

beforeEach(() => {
  resetStoreForTests();
  resetErpCacheForTests();
  setErpFetchForTests(null);
  delete process.env.XM_ERP_TOKEN;
  delete process.env.XM_ERP_BASE;
});

after(() => {
  setErpFetchForTests(null);
  resetErpCacheForTests();
  if (prevToken == null) {
    delete process.env.XM_ERP_TOKEN;
  } else {
    process.env.XM_ERP_TOKEN = prevToken;
  }
  if (prevBase == null) {
    delete process.env.XM_ERP_BASE;
  } else {
    process.env.XM_ERP_BASE = prevBase;
  }
  server.close();
});

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
  assert.match(dataJs, /XmModules\["\/data\/shops"\]/);
  assert.match(dataJs, /XmModules\["\/data\/goods"\]/);
  assert.match(dataJs, /\/api\/data\/shops/);
  assert.match(dataJs, /\/api\/data\/goods/);
  assert.match(dataJs, /内容待开发/);
  assert.doesNotMatch(dataJs, /authInfo/);
  assert.doesNotMatch(dataJs, /XM_ERP_TOKEN/);
});

test("shops and goods require login", async () => {
  const shops = await fetch(`${base}/api/data/shops`);
  assert.equal(shops.status, 401);
  const goods = await fetch(`${base}/api/data/goods`);
  assert.equal(goods.status, 401);
});

test("shops return 503 when ERP token is missing", async () => {
  const cookie = await loginCookie();
  const res = await fetch(`${base}/api/data/shops`, { headers: { cookie } });
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.match(body.error, /XM_ERP_TOKEN/);
});

test("shops proxy strips JD auth secrets", async () => {
  process.env.XM_ERP_TOKEN = "test-token";
  process.env.XM_ERP_BASE = "http://erp.test";
  const calls = [];
  setErpFetchForTests(async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body), auth: options.headers.Authorization });
    return {
      status: 200,
      json: async () => ({
        code: 200,
        message: "操作成功",
        data: {
          total: 1,
          totalPages: 1,
          currentPage: 1,
          pageSize: 20,
          records: [
            {
              id: "12286853",
              shopName: "飒望苒鸥专卖店",
              type: 0,
              status: 1,
              introduction: "家居日用",
              mainFirstCategoryName: "床上用品",
              mainSecondCategoryName: "枕头",
              openTime: "2022-09-02 17:54:01",
              authInfo: { appKey: "SECRET", appSecret: "SECRET", accessToken: "SECRET" }
            }
          ]
        }
      })
    };
  });
  const cookie = await loginCookie();
  const res = await fetch(`${base}/api/data/shops?shopName=飒望`, { headers: { cookie } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.total, 1);
  assert.equal(body.records[0].shopName, "飒望苒鸥专卖店");
  assert.equal(body.records[0].typeLabel, "POP");
  assert.equal(body.records[0].authInfo, undefined);
  assert.equal(JSON.stringify(body).includes("SECRET"), false);
  assert.equal(calls[0].url, "http://erp.test/product/jd/shopInfo/page");
  assert.equal(calls[0].auth, "Bearer test-token");
  assert.equal(calls[0].body.shopName, "飒望");
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
