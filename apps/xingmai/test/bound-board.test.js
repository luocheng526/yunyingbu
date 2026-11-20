import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import vm from "node:vm";
import express from "express";
import { boundRouter } from "../src/modules/bound/router.js";
import { pollLink, resetBoundStore, setBoundClock, setBoundFetch, startLink, tick } from "../src/modules/bound/store.js";
import { readState, writeSheet, writeState } from "../src/modules/bound/persist.js";
import { publicCatalog, reports } from "../src/modules/bound/catalog.js";
import { reportBody } from "../src/modules/bound/collect.js";

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

test("菜单只留渠道和我的", () => {
  const catalog = publicCatalog();
  assert.equal(catalog.erp, false);
  assert.deepEqual(catalog.modules.map((item) => item.label), ["渠道", "我的"]);
  assert.equal(catalog.modules[0].pages.map((page) => page.label).join(","), "渠道总览,渠道详情,关键指标分析");
  assert.equal(catalog.modules[1].pages.map((page) => page.label).join(","), "我的项目,个人中心");
  assert.equal(catalog.modules.some((item) => /商品|货品|团队/.test(item.label)), false);
  assert.equal(catalog.modules.some((item) => item.pages.some((page) => /商品|货品|团队|成员档案/.test(page.label))), false);
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
    assert.equal(partialBody.pageSum, null);
    assert.equal(partialBody.rows.length, 0);
    assert.match(partialBody.sumNote, /不会显示成 0/);
    const exported = await fetch(`${base}/api/bound/export?page=productOverview&tab=sp_zl_list&dim=sku&from=2026-11-01&to=2026-11-02`);
    const csv = await exported.text();
    assert.match(csv, /status=missing/);
    assert.doesNotMatch(csv, /十一月/);
    const opened = await fetch(`${base}/api/bound/view?page=productOverview&tab=sp_zl_list&dim=sku`);
    const openedBody = await opened.json();
    assert.equal(openedBody.daysType, "7");
    assert.equal(openedBody.range.from, "2026-11-08");
    assert.equal(openedBody.range.to, "2026-11-14");
    assert.equal(openedBody.coverage.status, "missing");
    assert.equal(openedBody.allSum, null);
    await writeSheet({
      reportId: "sp_zl_list",
      dim: "sku",
      startOn: "2026-10-01",
      endOn: "2026-10-31",
      pageNo: 1,
      status: "done",
      kind: "list",
      totalRows: 1,
      pageSize: 50,
      rowCount: 1,
      payload: { rows: [{ goodsId: "d", goodsName: "十月杯", shopName: "甲店", payAmount: 9 }] }
    });
    const october = await fetch(`${base}/api/bound/view?page=productOverview&tab=sp_zl_list&dim=sku&from=2026-10-01&to=2026-10-31&daysType=month`);
    const octoberBody = await october.json();
    assert.equal(octoberBody.coverage.status, "ready");
    assert.equal(octoberBody.allSum.payAmount, 9);
    assert.equal(octoberBody.rows[0].name, "十月杯");
    await writeSheet({
      reportId: "qdzl_lb",
      dim: "all",
      startOn: "2026-09-01",
      endOn: "2026-09-30",
      pageNo: 1,
      status: "done",
      kind: "list",
      totalRows: 1,
      pageSize: 50,
      rowCount: 1,
      payload: { rows: [{ platform: "TM", payAmount: 20, columnInfo: [{ name: "推广花费(支付预估)" }] }] }
    });
    const named = await fetch(`${base}/api/bound/view?page=channelOverview&tab=qdzl_lb&from=2026-09-01&to=2026-09-30&daysType=month`);
    const namedBody = await named.json();
    assert.equal(namedBody.rows[0].name, "天猫");
    assert.equal(namedBody.allSum.payAmount, 20);
    await writeSheet({
      reportId: "qdzl_lb",
      dim: "all",
      startOn: "2026-11-05",
      endOn: "2026-11-05",
      pageNo: 1,
      status: "done",
      kind: "list",
      totalRows: 2,
      pageSize: 50,
      rowCount: 2,
      payload: {
        rows: [
          { platform: "ALL", payAmount: 10, refund: 2, profit: 3, ssxse: 9 },
          { platform: "JD", payAmount: 7, refund: 1, profit: 2, ssxse: 6 }
        ]
      }
    });
    await writeSheet({
      reportId: "qdzl_lb",
      dim: "all",
      startOn: "2026-11-06",
      endOn: "2026-11-06",
      pageNo: 1,
      status: "done",
      kind: "list",
      totalRows: 2,
      pageSize: 50,
      rowCount: 2,
      payload: {
        rows: [
          { platform: "ALL", payAmount: 5, refund: 1, profit: 1, ssxse: 4 },
          { platform: "JD", payAmount: 4, refund: 1, profit: 1, ssxse: 3 }
        ]
      }
    });
    await writeSheet({
      reportId: "qdfx_dplb",
      dim: "all",
      startOn: "2026-11-05",
      endOn: "2026-11-05",
      pageNo: 1,
      status: "done",
      kind: "list",
      totalRows: 2,
      pageSize: 50,
      rowCount: 2,
      payload: {
        rows: [
          { shopName: "合计", platform: "ALL", sumLine: true, payAmount: 10 },
          { shopId: 7, shopName: "甲店", platform: "JD", payAmount: 6, profit: 1 }
        ]
      }
    });
    await writeSheet({
      reportId: "qdfx_dplb",
      dim: "all",
      startOn: "2026-11-05",
      endOn: "2026-11-05",
      pageNo: 2,
      status: "done",
      kind: "list",
      totalRows: 2,
      pageSize: 50,
      rowCount: 2,
      payload: {
        rows: [
          { shopName: "合计", platform: "ALL", sumLine: true, payAmount: 10 },
          { shopId: 7, shopName: "甲店", platform: "JD", payAmount: 6, profit: 1 }
        ]
      }
    });
    await writeSheet({
      reportId: "qdfx_dplb",
      dim: "all",
      startOn: "2026-11-06",
      endOn: "2026-11-06",
      pageNo: 1,
      status: "done",
      kind: "list",
      totalRows: 2,
      pageSize: 50,
      rowCount: 2,
      payload: {
        rows: [
          { shopName: "合计", platform: "ALL", sumLine: true, payAmount: 4 },
          { shopId: 7, shopName: "甲店", platform: "JD", payAmount: 3, profit: 1 }
        ]
      }
    });
    const stacked = await fetch(`${base}/api/bound/view?page=channelOverview&tab=qdzl_lb&from=2026-11-05&to=2026-11-06&daysType=custom`);
    const stackedBody = await stacked.json();
    assert.equal(stackedBody.coverage.status, "missing");
    assert.equal(stackedBody.total, 0);
    assert.equal(stackedBody.allSum, null);
    await writeSheet({
      reportId: "qdzl_lb",
      dim: "all",
      startOn: "2026-11-05",
      endOn: "2026-11-06",
      pageNo: 1,
      status: "done",
      kind: "list",
      totalRows: 2,
      pageSize: 2,
      rowCount: 2,
      payload: {
        rows: [
          { platform: "ALL", payAmount: 15, refund: 3, profit: 4, ssxse: 13 },
          { platform: "JD", payAmount: 11, refund: 2, profit: 3, ssxse: 9 }
        ]
      }
    });
    await writeSheet({
      reportId: "qdfx_dplb",
      dim: "all",
      startOn: "2026-11-05",
      endOn: "2026-11-06",
      pageNo: 1,
      status: "done",
      kind: "list",
      totalRows: 2,
      pageSize: 2,
      rowCount: 2,
      payload: {
        rows: [
          { shopName: "合计", platform: "ALL", sumLine: true, payAmount: 9 },
          { shopId: 7, shopName: "甲店", platform: "JD", payAmount: 9, profit: 2 }
        ]
      }
    });
    const whole = await fetch(`${base}/api/bound/view?page=channelOverview&tab=qdzl_lb&from=2026-11-05&to=2026-11-06&daysType=custom`);
    const wholeBody = await whole.json();
    assert.equal(wholeBody.coverage.status, "ready");
    assert.equal(wholeBody.total, 2);
    assert.equal(wholeBody.rows.map((row) => row.name).join(","), "全部,京东");
    assert.equal(wholeBody.allSum.payAmount, 15);
    assert.equal(wholeBody.rows[1].metrics.payAmount, 11);
    assert.equal(wholeBody.shopRows.find((row) => row.shop === "甲店").metrics.payAmount, 9);
    const shopScoped = await fetch(`${base}/api/bound/view?page=channelOverview&tab=qdzl_lb&from=2026-11-05&to=2026-11-06&daysType=custom&shop=${encodeURIComponent("甲店")}`);
    const scopedShop = await shopScoped.json();
    assert.equal(scopedShop.rows.map((row) => row.name).join(","), "甲店");
    assert.equal(scopedShop.rows[0].shop, "甲店");
    assert.equal(scopedShop.allSum.payAmount, 9);
  } finally {
    await close();
  }
});

test("指标、字段、跟进和目标重新打开仍然在", async () => {
  await writeSheet({
    reportId: "sp_zl_list",
    dim: "sku",
    startOn: "2026-11-14",
    endOn: "2026-11-14",
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
    const again = await fetch(`${base}/api/bound/view?page=productOverview&tab=sp_zl_list&dim=sku&from=2026-11-14&to=2026-11-14`);
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

test("过期后仍核对页面上的二维码，扫完就登录", async () => {
  resetBoundStore();
  setBoundFetch(async (url) => {
    const href = String(url);
    const json = (body) => ({
      headers: {
        get(name) {
          return String(name).toLowerCase() === "content-type" ? "application/json" : null;
        },
        getSetCookie() {
          return ["JSESSIONID=after-scan"];
        }
      },
      json: async () => body,
      arrayBuffer: async () => new ArrayBuffer(0)
    });
    if (href.includes("/auth/qrcode")) {
      return json({ code: 0, data: { url: "https://biprodapi.ecbis.cn/prod/auth/showQr?scene=s2", scene: "s2" } });
    }
    if (href.includes("/auth/checkQrcode")) {
      return json({ code: 0, data: { nickName: "罗成" } });
    }
    return json({ code: 0, data: {} });
  });
  await startLink("WECHAT");
  const saved = await readState("session");
  saved.phase = "needs_scan";
  saved.message = "旧站登录已过期。已保留补采进度，扫码后从中断处继续。";
  await writeState("session", saved);
  const status = await pollLink();
  assert.equal(status.phase, "collecting");
  assert.match(status.message, /已登录/);
});

test("页面只请求边界接口，并画出四个模块", async () => {
  const js = readFileSync(clientPath, "utf8");
  const routerSrc = readFileSync(routerPath, "utf8");
  const storeSrc = readFileSync(storePath, "utf8");
  assert.match(js, /爬虫，非 ERP/);
  assert.match(js, /最少选择 1 天，最多选择 60 天/);
  assert.match(js, /不把单日相加/);
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
    Date,
    Intl,
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
            page: { id: "channelOverview", label: "渠道总览", ops: ["date", "shop", "cards", "dim", "tabs", "search", "expand", "views", "export", "sums"] },
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
  assert.match(root.innerHTML, /渠道总览/);
  assert.match(root.innerHTML, /渠道详情/);
  assert.match(root.innerHTML, /关键指标分析/);
  assert.match(root.innerHTML, /我的项目/);
  assert.doesNotMatch(root.innerHTML, /data-page="productOverview"|data-page="teamOverview"|data-page="hpOverview"/);
  assert.doesNotMatch(root.innerHTML, /商品总览|商品全景分析|团队总览|成员档案|货品总览/);
  assert.match(root.innerHTML, /SPU/);
  assert.match(root.innerHTML, /SKU/);
  assert.match(root.innerHTML, /列表/);
  assert.match(root.innerHTML, /周期/);
  assert.match(root.innerHTML, /大图/);
  assert.match(root.innerHTML, /导出/);
  assert.match(root.innerHTML, /全部汇总/);
  assert.match(root.innerHTML, /当前页汇总/);
  assert.match(root.innerHTML, /未采完/);
  assert.match(root.innerHTML, /统计时间：2026年11月16日/);
  assert.doesNotMatch(root.innerHTML, /2026年11月16日-/);
  assert.match(root.innerHTML, />7天</);
  assert.match(root.innerHTML, /data-preset="custom"/);
  assert.doesNotMatch(root.innerHTML, /data-act="from"/);
  assert.match(root.innerHTML, /data-bound-erp="false"/);
  assert.equal(calls.includes("/api/bound"), true);
  assert.equal(calls.some((href) => href.startsWith("/api/bound/view")), true);
  assert.equal(calls.some((href) => href.includes("/api/data")), false);
  stop();
  assert.equal(root.innerHTML, "");
});

test("业绩对比按年份请求，品类分析走渠道类目接口", () => {
  const byId = Object.fromEntries(reports().map((item) => [item.id, item]));
  assert.equal(byId.qdzl_pl.path, "/v2/channel/channelCateAnalysis");
  assert.equal(byId.qdfx_yj.path, "/v2/channel/dynamicDetailAnalysis");
  const year = reportBody(byId.qdzl_yj, "all", { start: "2026-11-07", end: "2026-11-07", daysType: 1 }, 1);
  assert.deepEqual(year, { prevYear: 2025, year: 2026, compareType: 0, lstChannel: null });
  const shopYear = reportBody(byId.qdfx_yj, "all", { start: "2026-09-01", end: "2026-09-30", daysType: "month" }, 1);
  assert.equal(shopYear.prevYear, 2025);
  assert.equal(shopYear.year, 2026);
  assert.equal(shopYear.queryType, 1);
  assert.equal(shopYear.platform, "all");
  const hot = reportBody(byId.qdzl_rx, "all", { start: "2026-11-11", end: "2026-11-11", daysType: "1" }, 1);
  assert.equal(hot.queryType, 1);
  assert.equal(hot.platform, "all");
  assert.equal(hot.shopId, "");
  assert.equal(hot.daysType, "1");
  assert.equal("shopList" in hot, false);
  const shopOperate = reportBody(byId.qdfx_jy, "all", { start: "2026-11-16", end: "2026-11-16", daysType: "1" }, 1);
  assert.deepEqual(shopOperate, { startDate: "2026-11-16", endDate: "2026-11-16", daysType: "1", queryType: 1, platform: "all", shopId: "", exportMode: "" });
  const cate = reportBody(byId.qdzl_pl, "all", { start: "2026-11-07", end: "2026-11-07", daysType: "1" }, 1);
  assert.equal(cate.startDate, "2026-11-07");
  assert.equal(cate.daysType, "1");
  assert.equal(cate.exportMode, "");
  assert.equal("shopList" in cate, false);
  assert.equal("pageSize" in cate, false);
});

test("采集进度只数表头，扫码页标出正在采集的表", async () => {
  resetBoundStore();
  await writeState("session", {
    phase: "collecting",
    message: "已登录。从 2026-09-01 按北京时间补采，页面查询不会再打旧站。",
    deviceId: "device-progress",
    cursor: { id: "qdzl_yj", label: "业绩对比", page: "渠道总览", dim: "all", start: "2026-09-01", end: "2026-09-01", pageNo: 1 }
  });
  await writeSheet({
    reportId: "qdzl_lb",
    dim: "all",
    startOn: "2026-09-01",
    endOn: "2026-09-01",
    pageNo: 1,
    status: "done",
    kind: "list",
    totalRows: 1,
    pageSize: 50,
    rowCount: 1,
    payload: { rows: [{ name: "京东", payAmount: 12 }] }
  });
  await writeSheet({
    reportId: "qdzl_yj",
    dim: "all",
    startOn: "2026-09-01",
    endOn: "2026-09-01",
    pageNo: 1,
    status: "failed",
    kind: "list",
    attempts: 3,
    errorText: "q=1 daysType=1 查询参数不匹配",
    payload: {}
  });
  const { base, close } = await listen(appFor({ username: "罗成", displayName: "罗成" }));
  const other = await listen(appFor({ username: "店员", displayName: "店员" }));
  try {
    const body = await (await fetch(`${base}/api/bound/progress`)).json();
    assert.equal(body.erp, false);
    assert.equal(body.source, "crawler");
    assert.equal(body.phase, "collecting");
    assert.equal(body.cursor.id, "qdzl_yj");
    const ready = body.items.find((item) => item.id === "qdzl_lb");
    assert.equal(ready.readyDays, 1);
    assert.equal(ready.status, "partial");
    const failed = body.items.find((item) => item.id === "qdzl_yj");
    assert.equal(failed.readyDays, 0);
    assert.equal(failed.failedDays, 1);
    assert.equal(failed.reason, "查询参数不匹配");
    assert.deepEqual(failed.failedDates, ["2026-09-01"]);
    assert.equal(failed.retries, 3);
    assert.equal(body.items.some((item) => item.status === "pending"), true);
    assert.equal((await fetch(`${other.base}/api/bound/progress`)).status, 403);
  } finally {
    await close();
    await other.close();
  }

  const js = readFileSync(clientPath, "utf8");
  const root = {
    html: "",
    set innerHTML(value) {
      this.html = String(value);
    },
    get innerHTML() {
      return this.html;
    },
    addEventListener(type, fn) {
      if (type === "click") {
        this.onclick = fn;
      }
    },
    removeEventListener() {},
    querySelector() {
      return null;
    }
  };
  const context = vm.createContext({
    window: {},
    Date,
    Intl,
    document: {
      getElementById() {
        return null;
      },
      createElement() {
        return { id: "", textContent: "" };
      },
      head: { appendChild() {} }
    },
    URLSearchParams,
    setInterval() {
      return 1;
    },
    clearInterval() {},
    fetch(url) {
      const href = String(url);
      if (href.startsWith("/api/bound/progress")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            ok: true,
            phase: "collecting",
            startOn: "2026-09-01",
            today: "2026-11-17",
            dayCount: 78,
            total: 2,
            counts: { done: 0, partial: 1, failed: 0, pending: 1 },
            cursor: { id: "qdzl_yj", label: "业绩对比", page: "渠道总览", dim: "all", start: "2026-09-01", end: "2026-09-01" },
            items: [
              { id: "qdzl_lb", dim: "all", page: "渠道总览", tab: "渠道列表", readyDays: 40, failedDays: 0, latest: "2026-10-10", status: "partial" },
              { id: "qdzl_yj", dim: "all", page: "渠道总览", tab: "业绩对比", readyDays: 0, failedDays: 2, latest: "", status: "failed", reason: "查询参数不匹配", retries: 3, failedDates: ["2026-11-11", "2026-11-16"] }
            ]
          })
        });
      }
      if (href.startsWith("/api/bound/view")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            page: { id: "channelOverview", label: "渠道总览", ops: ["date", "tabs"] },
            tab: { id: "qdzl_lb", label: "渠道列表" },
            tabs: [{ id: "qdzl_lb", label: "渠道列表" }],
            range: { from: "2026-11-16", to: "2026-11-16" },
            coverage: { status: "missing", missing: [], failed: [] },
            columns: [],
            rows: [],
            shops: [],
            total: 0,
            pageNo: 1
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
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ phase: "collecting", deviceId: "device-progress", message: "已登录。从 2026-09-01 按北京时间补采，页面查询不会再打旧站。", qrReady: true })
        });
      }
      return Promise.reject(new Error(href));
    }
  });
  vm.runInContext(js, context);
  const stop = context.window.XmModules["/bound"].mount(root);
  await new Promise((resolve) => setTimeout(resolve, 30));
  root.onclick({
    target: {
      closest() {
        return {
          getAttribute(name) {
            if (name === "data-act") {
              return "page";
            }
            if (name === "data-page") {
              return "link";
            }
            return "";
          }
        };
      }
    }
  });
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.match(root.innerHTML, /采集进度/);
  assert.match(root.innerHTML, /正在采集：渠道总览 \/ 业绩对比/);
  assert.match(root.innerHTML, /正在采/);
  assert.match(root.innerHTML, /查询参数不匹配/);
  assert.match(root.innerHTML, /失败 2 天，已重试 3 次：2026-11-11、2026-11-16/);
  assert.match(root.innerHTML, /渠道列表/);
  assert.doesNotMatch(root.innerHTML, /bd-qr/);
  stop();
});

test("日期条的 7 天、30 天截止到昨天，周从周一开始并且不含本周", async () => {
  const js = readFileSync(clientPath, "utf8");
  const calls = [];
  const root = {
    html: "",
    set innerHTML(value) {
      this.html = String(value);
    },
    get innerHTML() {
      return this.html;
    },
    addEventListener(type, fn) {
      if (type === "click") this.onclick = fn;
      if (type === "change") this.onchange = fn;
    },
    removeEventListener() {},
    querySelector() {
      return null;
    }
  };
  function click(act, extra) {
    root.onclick({
      target: {
        closest() {
          return {
            disabled: false,
            getAttribute(name) {
              if (name === "data-act") return act;
              return extra[name] || "";
            }
          };
        }
      }
    });
  }
  const context = vm.createContext({
    window: {},
    Date,
    Intl,
    document: {
      getElementById() {
        return null;
      },
      createElement() {
        return { id: "", textContent: "" };
      },
      head: { appendChild() {} }
    },
    URLSearchParams,
    setInterval() {
      return 1;
    },
    clearInterval() {},
    fetch(url) {
      const href = String(url);
      calls.push(href);
      if (href.startsWith("/api/bound/view")) {
        const query = new URL(href, "http://local").searchParams;
        return Promise.resolve({
          ok: true,
          json: async () => ({
            page: { id: "channelOverview", label: "渠道总览", ops: ["date", "tabs"] },
            tab: { id: "qdzl_lb", label: "渠道列表" },
            tabs: [{ id: "qdzl_lb", label: "渠道列表" }],
            range: { from: query.get("from") || "2026-11-16", to: query.get("to") || "2026-11-16" },
            daysType: query.get("daysType") || "1",
            coverage: { status: "missing", missing: [], failed: [] },
            columns: [{ key: "name", label: "渠道", on: true }],
            rows: [],
            shops: [],
            total: 0,
            pageNo: 1
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
  assert.match(root.innerHTML, /data-preset="date"[^>]*class="is-on"|class="is-on"[^>]*data-preset="date"/);
  assert.match(root.innerHTML, /统计时间：2026年11月16日/);
  assert.doesNotMatch(root.innerHTML, /data-act="range-from"/);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  function addDays(iso, delta) {
    const date = new Date(`${iso}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + delta);
    return date.toISOString().slice(0, 10);
  }
  click("preset", { "data-preset": "day7" });
  await new Promise((resolve) => setTimeout(resolve, 30));
  const seven = calls.filter((href) => href.includes("daysType=7")).pop();
  const sevenQuery = new URL(seven, "http://local").searchParams;
  assert.equal(sevenQuery.get("from"), addDays(today, -8));
  assert.equal(sevenQuery.get("to"), addDays(today, -2));
  assert.match(root.innerHTML, /data-preset="day7"[^>]*class="is-on"|class="is-on"[^>]*data-preset="day7"/);
  assert.match(root.innerHTML, /data-delta="1"[^>]*disabled|disabled[^>]*data-delta="1"/);
  click("preset", { "data-preset": "day30" });
  await new Promise((resolve) => setTimeout(resolve, 30));
  const thirty = calls.filter((href) => href.includes("daysType=30")).pop();
  const thirtyQuery = new URL(thirty, "http://local").searchParams;
  assert.equal(thirtyQuery.get("from"), addDays(today, -31));
  assert.equal(thirtyQuery.get("to"), addDays(today, -2));
  click("preset", { "data-preset": "week" });
  await new Promise((resolve) => setTimeout(resolve, 30));
  const week = calls.filter((href) => href.includes("daysType=week")).pop();
  const weekQuery = new URL(week, "http://local").searchParams;
  const weekStart = new Date(`${weekQuery.get("from")}T12:00:00Z`);
  const weekEnd = new Date(`${weekQuery.get("to")}T12:00:00Z`);
  assert.equal(weekStart.getUTCDay(), 1);
  assert.equal(weekEnd.getUTCDay(), 0);
  assert.equal(weekQuery.get("to") < today, true);
  click("preset", { "data-preset": "month" });
  await new Promise((resolve) => setTimeout(resolve, 30));
  const month = calls.filter((href) => href.includes("daysType=month")).pop();
  const monthQuery = new URL(month, "http://local").searchParams;
  assert.equal(monthQuery.get("from"), `${today.slice(0, 7)}-01`);
  assert.equal(monthQuery.get("to"), addDays(today, -2));
  click("shift", { "data-delta": "-1" });
  await new Promise((resolve) => setTimeout(resolve, 30));
  const previous = calls.filter((href) => href.includes("daysType=month")).pop();
  const previousQuery = new URL(previous, "http://local").searchParams;
  assert.notEqual(previousQuery.get("from"), `${today.slice(0, 7)}-01`);
  assert.equal(previousQuery.get("from").endsWith("-01"), true);
  assert.equal(previousQuery.get("to") < today, true);
  click("preset", { "data-preset": "custom" });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.match(root.innerHTML, /bd-cal-months/);
  assert.match(root.innerHTML, /最少选择 1 天，最多选择 60 天/);
  assert.match(root.innerHTML, /is-from/);
  assert.match(root.innerHTML, /is-to/);
  click("cal-day", { "data-day": "2026-11-01" });
  await new Promise((resolve) => setTimeout(resolve, 20));
  click("cal-day", { "data-day": "2026-11-15" });
  await new Promise((resolve) => setTimeout(resolve, 30));
  const custom = calls.filter((href) => href.includes("daysType=custom")).pop();
  const customQuery = new URL(custom, "http://local").searchParams;
  assert.equal(customQuery.get("from"), "2026-11-01");
  assert.equal(customQuery.get("to"), "2026-11-15");
  click("preset", { "data-preset": "custom" });
  await new Promise((resolve) => setTimeout(resolve, 20));
  const beforeOver = calls.length;
  click("cal-day", { "data-day": "2026-11-01" });
  click("cal-day", { "data-day": "2027-02-15" });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(calls.length, beforeOver);
  click("cal-day", { "data-day": "2026-11-01" });
  await new Promise((resolve) => setTimeout(resolve, 30));
  const oneDay = calls.filter((href) => href.includes("daysType=custom")).pop();
  const oneQuery = new URL(oneDay, "http://local").searchParams;
  assert.equal(oneQuery.get("from"), "2026-11-01");
  assert.equal(oneQuery.get("to"), "2026-11-01");
  click("preset", { "data-preset": "custom" });
  await new Promise((resolve) => setTimeout(resolve, 20));
  click("cal-day", { "data-day": "2026-10-20" });
  click("cal-day", { "data-day": "2026-11-10" });
  await new Promise((resolve) => setTimeout(resolve, 30));
  const cross = calls.filter((href) => href.includes("daysType=custom")).pop();
  const crossQuery = new URL(cross, "http://local").searchParams;
  assert.equal(crossQuery.get("from"), "2026-10-20");
  assert.equal(crossQuery.get("to"), "2026-11-10");
  stop();
});
