import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import vm from "node:vm";
import express from "express";
import { boundRouter } from "../src/modules/bound/router.js";
import { resetBoundStore, setBoundClock, setBoundFetch, startLink, tick } from "../src/modules/bound/store.js";
import { writeSheet } from "../src/modules/bound/persist.js";
import { publicCatalog } from "../src/modules/bound/catalog.js";

process.env.BOUND_COLLECT_LOOP = "0";

const rootDir = dirname(fileURLToPath(import.meta.url));
const clientPath = join(rootDir, "../public/shared/modules/bound.js");
const routerPath = join(rootDir, "../src/modules/bound/router.js");
const storePath = join(rootDir, "../src/modules/bound/store.js");

function withUser(user) {
  return (req, _res, next) => {
    req.user = user;
    next();
  };
}

async function listen(app) {
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  const { port } = server.address();
  return {
    base: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

function appFor(user) {
  const app = express();
  app.use(express.json());
  app.use(withUser(user));
  app.use("/api/bound", boundRouter);
  return app;
}

test.beforeEach(() => {
  resetBoundStore();
  setBoundClock(() => new Date("2026-11-16T04:00:00Z"));
});

test("功能清单覆盖渠道、商品、团队、我的", () => {
  const catalog = publicCatalog();
  assert.equal(catalog.erp, false);
  assert.deepEqual(catalog.modules.map((item) => item.label), ["渠道", "商品", "货品", "团队", "我的"]);
  const goods = catalog.modules[1].pages.find((page) => page.label === "商品总览");
  assert.deepEqual(goods.tabs.map((tab) => tab.label), ["商品列表", "品类分析", "地域分析", "销售时段分析"]);
  assert.equal(goods.ops.includes("dim"), true);
  assert.equal(goods.ops.includes("views"), true);
  assert.equal(goods.ops.includes("export"), true);
  assert.equal(goods.ops.includes("cards"), true);
  assert.equal(catalog.modules[0].pages.map((page) => page.label).join(","), "渠道总览,渠道详情,关键指标分析");
});

test("GET /api/bound 仍标明爬虫且不是 ERP", async () => {
  const { base, close } = await listen(appFor({ username: "罗成", displayName: "罗成" }));
  try {
    const stamp = await fetch(`${base}/api/bound`);
    assert.equal(stamp.status, 200);
    assert.deepEqual(await stamp.json(), { ok: true, module: "bound", source: "crawler", erp: false });
  } finally {
    await close();
  }
});

test("没采完的范围汇总留空，采完的整月和当前页分开算", async () => {
  await writeSheet({
    reportId: "sp_zl_list",
    dim: "sku",
    startOn: "2026-09-01",
    endOn: "2026-09-30",
    pageNo: 1,
    status: "done",
    kind: "list",
    totalRows: 2,
    pageSize: 50,
    rowCount: 2,
    payload: {
      rows: [
        { goodsId: "a", goodsName: "九月杯", shopName: "甲店", payAmount: 100, visitor: 10 },
        { goodsId: "b", goodsName: "九月灯", shopName: "乙店", payAmount: 40, visitor: 4 }
      ]
    }
  });
  await writeSheet({
    reportId: "sp_zl_list",
    dim: "sku",
    startOn: "2026-09-01",
    endOn: "2026-09-01",
    pageNo: 1,
    status: "done",
    kind: "list",
    totalRows: 1,
    pageSize: 50,
    rowCount: 1,
    payload: { rows: [{ goodsId: "a", goodsName: "日明细", shopName: "甲店", payAmount: 1 }] }
  });
  const { base, close } = await listen(appFor({ username: "罗成" }));
  try {
    const month = await fetch(`${base}/api/bound/view?page=productOverview&tab=sp_zl_list&dim=sku&from=2026-09-01&to=2026-09-30`);
    const monthBody = await month.json();
    assert.equal(monthBody.erp, false);
    assert.equal(monthBody.coverage.status, "ready");
    assert.equal(monthBody.coverage.mode, "month");
    assert.equal(monthBody.allSum.payAmount, 140);
    assert.equal(monthBody.pageSum.payAmount, 140);
    assert.equal(monthBody.rows.some((row) => row.name === "日明细"), false);
    const shop = await fetch(`${base}/api/bound/view?page=productOverview&tab=sp_zl_list&dim=sku&from=2026-09-01&to=2026-09-30&shop=${encodeURIComponent("甲店")}`);
    const shopBody = await shop.json();
    assert.equal(shopBody.allSum.payAmount, 100);
    assert.equal(shopBody.total, 1);
    await writeSheet({
      reportId: "sp_zl_list",
      dim: "sku",
      startOn: "2026-11-01",
      endOn: "2026-11-01",
      pageNo: 1,
      status: "done",
      kind: "list",
      totalRows: 1,
      pageSize: 50,
      rowCount: 1,
      payload: { rows: [{ goodsId: "c", goodsName: "十一月", shopName: "甲店", payAmount: 5 }] }
    });
    const partial = await fetch(`${base}/api/bound/view?page=productOverview&tab=sp_zl_list&dim=sku&from=2026-11-01&to=2026-11-02`);
    const partialBody = await partial.json();
    assert.equal(partialBody.coverage.status, "missing");
    assert.equal(partialBody.allSum, null);
    assert.equal(partialBody.pageSum.payAmount, 5);
    assert.match(partialBody.sumNote, /不会显示成 0/);
    const exported = await fetch(`${base}/api/bound/export?page=productOverview&tab=sp_zl_list&dim=sku&from=2026-11-01&to=2026-11-02`);
    const csv = await exported.text();
    assert.match(csv, /status=missing/);
    assert.match(csv, /十一月/);
    assert.equal(csv.split("十一月").length, 2);
  } finally {
    await close();
  }
});

test("指标、字段、跟进和目标重新打开仍然在", async () => {
  await writeSheet({
    reportId: "sp_zl_list",
    dim: "sku",
    startOn: "2026-11-16",
    endOn: "2026-11-16",
    pageNo: 1,
    status: "done",
    kind: "list",
    totalRows: 1,
    pageSize: 50,
    rowCount: 1,
    payload: { rows: [{ goodsId: "a", goodsName: "九月杯", shopName: "甲店", payAmount: 8 }] }
  });
  const { base, close } = await listen(appFor({ username: "罗成" }));
  try {
    const pref = await fetch(`${base}/api/bound/prefs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: "productOverview", cards: ["payAmount"], columns: ["name", "payAmount"] })
    });
    assert.equal((await pref.json()).ok, true);
    const marked = await fetch(`${base}/api/bound/marks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rowKey: "a", follow: "已跟进", tag: "重点", target: "200" })
    });
    assert.equal((await marked.json()).ok, true);
    const again = await fetch(`${base}/api/bound/view?page=productOverview&tab=sp_zl_list&dim=sku&from=2026-11-16&to=2026-11-16`);
    const body = await again.json();
    assert.deepEqual(body.cards.filter((card) => card.on).map((card) => card.key), ["payAmount"]);
    assert.deepEqual(body.columns.filter((column) => column.on).map((column) => column.key), ["name", "payAmount"]);
    assert.equal(body.rows[0].follow, "已跟进");
    assert.equal(body.rows[0].tag, "重点");
    assert.equal(body.rows[0].target, "200");
  } finally {
    await close();
  }
});

test("人事部打不开，非管理员不能扫码", async () => {
  const hr = await listen(appFor({ username: "人事同事", desk: "hr" }));
  try {
    assert.equal((await fetch(`${hr.base}/api/bound`)).status, 403);
    assert.equal((await fetch(`${hr.base}/api/bound/view`)).status, 403);
    const body = await (await fetch(`${hr.base}/api/bound/link`)).json();
    assert.match(body.error, /智能人事/);
  } finally {
    await hr.close();
  }
  const other = await listen(appFor({ username: "店员" }));
  try {
    assert.equal((await fetch(`${other.base}/api/bound/link`)).status, 403);
    assert.equal((await fetch(`${other.base}/api/bound/view`)).status, 200);
  } finally {
    await other.close();
  }
});

test("扫码后按进度补采，过期保留断点", async () => {
  const calls = [];
  let checks = 0;
  let reports = 0;
  let expired = false;
  setBoundFetch(async (url, options = {}) => {
    const href = String(url);
    calls.push(`${options.method || "GET"} ${href} ${options.body || ""}`);
    const json = (body) => ({
      headers: {
        get(name) {
          return String(name).toLowerCase() === "content-type" ? "application/json" : null;
        },
        getSetCookie() {
          return ["JSESSIONID=test"];
        }
      },
      json: async () => body,
      arrayBuffer: async () => new ArrayBuffer(0)
    });
    if (href.includes("/auth/qrcode")) {
      return json({ code: 0, data: { url: "https://biprodapi.ecbis.cn/prod/auth/showQr?scene=s1", scene: "s1" } });
    }
    if (href.includes("/auth/checkQrcode")) {
      checks += 1;
      return json(checks === 1 ? { code: 1000102, content: "等待" } : { code: 0, data: { nickName: "罗成" } });
    }
    if (href.includes("/v2/channel/channelOverViewList")) {
      reports += 1;
      if (reports === 2) {
        expired = true;
        return json({ code: -1, content: "用户未登录或登录状态已过期" });
      }
    }
    if (expired) {
      return json({ code: -1, content: "用户未登录或登录状态已过期" });
    }
    return json({ code: 0, data: { list: [{ shopName: "甲店", payAmount: 12 }], total: 1 } });
  });
  await startLink("WECHAT");
  await tick();
  let status = await tick();
  assert.equal(status.phase, "collecting");
  for (let index = 0; index < 12; index += 1) {
    status = await tick();
    if (status.phase === "needs_scan") {
      break;
    }
  }
  assert.equal(status.phase, "needs_scan");
  const september = () => calls.filter((line) => line.includes("channelOverViewList") && line.includes("2026-09-01") && line.includes("2026-09-30")).length;
  assert.equal(september(), 1);
  const before = calls.length;
  const paused = await tick();
  assert.equal(paused.phase, "needs_scan");
  assert.equal(calls.length, before);
  expired = false;
  checks = 1;
  await startLink("WECHAT");
  await tick();
  await tick();
  await tick();
  assert.equal(september(), 1);
});

test("页面只请求边界接口，并画出四个模块", async () => {
  const js = readFileSync(clientPath, "utf8");
  const routerSrc = readFileSync(routerPath, "utf8");
  const storeSrc = readFileSync(storePath, "utf8");
  assert.match(js, /爬虫，非 ERP/);
  assert.match(js, /XmModules\["\/bound"\]/);
  assert.doesNotMatch(js, /\/api\/data|\/api\/home|jingmai|hejun\.ecbis|biprodapi/);
  assert.doesNotMatch(routerSrc, /modules\/data|jingmai/);
  assert.doesNotMatch(storeSrc, /modules\/data|jingmai|xingmai-erp/);
  const calls = [];
  const document = {
    getElementById() {
      return null;
    },
    createElement() {
      return { id: "", textContent: "" };
    },
    head: { appendChild() {} }
  };
  const root = {
    html: "",
    set innerHTML(value) {
      this.html = String(value);
    },
    get innerHTML() {
      return this.html;
    },
    addEventListener() {},
    querySelector() {
      return null;
    }
  };
  const context = vm.createContext({
    window: {},
    document,
    URLSearchParams,
    setInterval() {
      return 1;
    },
    clearInterval() {},
    fetch(url) {
      const href = String(url);
      calls.push(href.split("?")[0]);
      if (href.startsWith("/api/bound/view")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            page: { id: "productOverview", label: "商品总览", ops: ["date", "shop", "cards", "dim", "tabs", "search", "expand", "views", "export", "sums"] },
            tab: { id: "sp_zl_list", label: "商品列表" },
            tabs: [{ id: "sp_zl_list", label: "商品列表" }, { id: "sp_zl_cate", label: "品类分析" }],
            range: { from: "2026-11-16", to: "2026-11-16" },
            coverage: { status: "missing", missing: ["2026-11-16"], failed: [] },
            cards: [{ key: "payAmount", label: "支付金额", on: true, value: null }],
            cardStatus: "missing",
            columns: [{ key: "name", label: "商品", on: true }],
            rows: [],
            shops: [],
            pageSum: null,
            allSum: null,
            total: 0,
            pageNo: 1,
            sumNote: "这段还没采完或采集失败，汇总留空，不会显示成 0。"
          })
        });
      }
      if (href.startsWith("/api/bound/catalog")) {
        return Promise.resolve({ ok: true, json: async () => publicCatalog() });
      }
      if (href === "/api/bound") {
        return Promise.resolve({ ok: true, json: async () => ({ ok: true, module: "bound", source: "crawler", erp: false }) });
      }
      if (href.startsWith("/api/bound/link")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ phase: "idle", deviceId: "device-1", message: "" }) });
      }
      return Promise.reject(new Error(href));
    }
  });
  vm.runInContext(js, context);
  const stop = context.window.XmModules["/bound"].mount(root);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.match(root.innerHTML, /爬虫，非 ERP/);
  assert.match(root.innerHTML, /渠道/);
  assert.match(root.innerHTML, /商品总览/);
  assert.match(root.innerHTML, /团队/);
  assert.match(root.innerHTML, /我的/);
  assert.match(root.innerHTML, /SPU/);
  assert.match(root.innerHTML, /SKU/);
  assert.match(root.innerHTML, /列表/);
  assert.match(root.innerHTML, /周期/);
  assert.match(root.innerHTML, /大图/);
  assert.match(root.innerHTML, /导出/);
  assert.match(root.innerHTML, /全部汇总/);
  assert.match(root.innerHTML, /当前页汇总/);
  assert.match(root.innerHTML, /未采完/);
  assert.match(root.innerHTML, /data-bound-erp="false"/);
  assert.equal(calls.includes("/api/bound"), true);
  assert.equal(calls.some((href) => href.startsWith("/api/bound/view")), true);
  assert.equal(calls.some((href) => href.includes("/api/data")), false);
  stop();
  assert.equal(root.innerHTML, "");
});
