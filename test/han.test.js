import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createApp } from "../src/app.js";
import { rechargeWindowOpen, shanghaiMinutes } from "../src/modules/han/worker.js";
import { createHanStore, dropProbeTasks, hydrateFromMysql, matchOrgStoresForTeam, mergeTeamShops, buildProductCsv, parseProductCsv, classifyProduct, HAN_DEFAULT_OWNER, HAN_DEFAULT_STORE } from "../src/modules/han/store.js";
import { createHanFakePool } from "./han-fake-pool.js";
import { makeMinimalXlsx, parseOverviewFilename, parseOverviewWorkbook, headerKey, paidHeaderKey, parsePaidWorkbook } from "../src/modules/han/import-file.js";

async function withServer(fn) {
  const hanStore = createHanStore(createHanFakePool());
  const server = http.createServer(createApp({ hanStore }));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  }
}

async function json(base, pathname, options) {
  const res = await fetch(`${base}${pathname}`, options);
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { res, body, text };
}

test("GET /han is 韩梦凯运营中心 with left sidebar shell", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/han`);
    const html = await res.text();
    assert.equal(res.status, 200);
    assert.match(html, /<title>韩梦凯运营中心<\/title>/);
    assert.match(html, /han-nav-group/);
    assert.match(html, /han-nav-arrow/);
    assert.match(html, /attachHanSubmenu/);
    assert.match(html, /xm-sider/);
    assert.match(html, /href="\/han\?sub=selection"/);
    assert.match(html, /href="\/han\?sub=products"/);
    assert.match(html, /href="\/han\?sub=paid"/);
    assert.match(html, /选品数据/);
    assert.match(html, /商品数据/);
    assert.match(html, /付费数据/);
    assert.match(html, /内容先等开发/);
    assert.match(html, /韩梦凯运营中心/);
    assert.match(html, /shared\/layout\.css/);
    assert.match(html, /shared\/nav\.js/);
    assert.match(html, /class="app-shell"/);
    assert.match(html, /id="site-nav"/);
    assert.match(html, /class="site-sidebar"/);
    assert.match(html, /<main class="page">/);
    assert.doesNotMatch(html, /fallback-nav/);
    assert.doesNotMatch(html, /沈子晗团队/);
    const navAt = html.indexOf('id="site-nav"');
    const mainAt = html.indexOf('<main class="page">');
    assert.ok(navAt >= 0 && mainAt > navAt);
    for (const label of [
      "首页",
      "数据中心",
      "沈子晗运营中心",
      "韩梦凯运营中心",
      "人员管理",
      "版本发布中心",
      "个人中心",
    ]) {
      assert.match(html, new RegExp(label));
    }
  });
});

test("GET /han?sub= selection/products/paid serve the same center page", async () => {
  await withServer(async (base) => {
    for (const path of ["/han?sub=selection", "/han?sub=products", "/han?sub=paid"]) {
      const res = await fetch(`${base}${path}`);
      const html = await res.text();
      assert.equal(res.status, 200, path);
      assert.match(html, /内容先等开发/);
      assert.match(html, /han-nav-sub/);
    }
  });
});

test("han tasks default owner is 韩梦凯", async () => {
  await withServer(async (base) => {
    const { res, body } = await json(base, "/api/han/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "跟进渠道报价" }),
    });
    assert.equal(res.status, 201);
    assert.equal(body.ok, true);
    assert.equal(body.task.title, "跟进渠道报价");
    assert.equal(body.task.status, "待办");
    assert.equal(body.task.owner, "韩梦凯");
    assert.equal(HAN_DEFAULT_OWNER, "韩梦凯");

    const listed = await json(base, "/api/han/tasks");
    assert.equal(listed.res.status, 200);
    assert.equal(listed.body.tasks.length, 1);
    assert.equal(listed.body.tasks[0].title, "跟进渠道报价");
  });
});

test("han brief round-trip", async () => {
  await withServer(async (base) => {
    const empty = await json(base, "/api/han/brief");
    assert.equal(empty.body.text, "");
    const saved = await json(base, "/api/han/brief", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "今日完成拜访两家客户" }),
    });
    assert.equal(saved.body.text, "今日完成拜访两家客户");
    const again = await json(base, "/api/han/brief");
    assert.equal(again.body.text, "今日完成拜访两家客户");
  });
});

test("han tasks do not appear on /api/shen/tasks", async () => {
  await withServer(async (base) => {
    const marker = "HAN-ONLY-" + Date.now();
    const created = await json(base, "/api/han/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: marker }),
    });
    assert.equal(created.body.ok, true);

    const shen = await json(base, "/api/shen/tasks");
    if (shen.res.status === 404) {
      return;
    }
    const titles = (shen.body.tasks || shen.body || []).map((t) => t.title);
    assert.equal(titles.includes(marker), false);
  });
});

test("notes demo API still works", async () => {
  await withServer(async (base) => {
    const empty = await json(base, "/api/notes");
    assert.equal(empty.res.status, 200);
    assert.ok(Array.isArray(empty.body));
    const created = await json(base, "/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "keep-notes-demo" }),
    });
    assert.equal(created.res.status, 201);
    assert.equal(created.body.text, "keep-notes-demo");
  });
});

test("han selection / products / paid boards are isolated", async () => {
  await withServer(async (base) => {
    const sel = await json(base, "/api/han/selection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "春季防晒衣", category: "服饰" }),
    });
    assert.equal(sel.res.status, 201);
    assert.equal(sel.body.item.owner, "韩梦凯");
    assert.equal(sel.body.item.status, "观察");

    const prod = await json(base, "/api/han/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "防晒衣-白", sku: "SPF-01", price: "89.9", stock: "12" }),
    });
    assert.equal(prod.res.status, 201);
    assert.equal(prod.body.item.sku, "SPF-01");
    assert.equal(prod.body.item.owner, "韩梦凯");

    const paid = await json(base, "/api/han/paid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: "信息流", amount: "320", spentOn: "2026-09-08" }),
    });
    assert.equal(paid.res.status, 201);
    assert.equal(paid.body.item.channel, "信息流");
    assert.equal(paid.body.item.spentOn, "2026-09-08");

    const listedSel = await json(base, "/api/han/selection");
    const listedProd = await json(base, "/api/han/products");
    const listedPaid = await json(base, "/api/han/paid");
    const train = await json(base, "/api/han/training", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "选品晨会", trainee: "韩梦凯", scheduledOn: "2026-09-10" }),
    });
    assert.equal(train.res.status, 201);
    assert.equal(train.body.item.owner, "韩梦凯");
    assert.equal(train.body.item.status, "待开始");
    assert.equal(train.body.item.title, "选品晨会");

    const listedTasks = await json(base, "/api/han/tasks");
    const listedTrain = await json(base, "/api/han/training");
    assert.equal(listedSel.body.items.length, 1);
    assert.equal(listedProd.body.items.length, 1);
    assert.equal(listedPaid.body.items.length, 1);
    assert.equal(listedTrain.body.items.length, 1);
    assert.equal(listedTasks.body.tasks.length, 0);
    assert.equal(listedSel.body.items[0].name, "春季防晒衣");
    assert.equal(listedProd.body.items[0].name, "防晒衣-白");
    assert.equal(listedSel.body.items[0].store, HAN_DEFAULT_STORE);

    const trend = await json(base, "/api/han/picks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ board: "trend", name: "开学季洗护", extra: "开学季" }),
    });
    const peers = await json(base, "/api/han/picks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ board: "peers", name: "竞品A", extra: "同行旗舰店" }),
    });
    const fresh = await json(base, "/api/han/picks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ board: "new", name: "新品喷雾", extra: "2026-09-12" }),
    });
    assert.equal(trend.body.item.board, "trend");
    assert.equal(peers.body.item.extra, "同行旗舰店");
    assert.equal(fresh.body.item.board, "new");
    const listedTrend = await json(base, "/api/han/picks?board=trend");
    const listedPeers = await json(base, "/api/han/picks?board=peers");
    const listedNew = await json(base, "/api/han/picks?board=new");
    const chosen = await json(base, "/api/han/picks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ board: "chosen", name: "入选喷雾", extra: "2026-09-13" }),
    });
    assert.equal(chosen.body.item.board, "chosen");
    const listedChosen = await json(base, "/api/han/picks?board=chosen");
    assert.equal(listedTrend.body.items.length, 1);
    assert.equal(listedPeers.body.items.length, 1);
    assert.equal(listedNew.body.items.length, 1);
    assert.equal(listedChosen.body.items.length, 1);
    assert.equal(listedSel.body.items.length, 1);
    assert.equal(
      (await json(base, "/api/han/selection")).body.items.some((row) => row.name === "开学季洗护"),
      false,
    );

    const layered = await json(base, "/api/han/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        layer: "头部产品",
        spu: "SPU-HEAD-1",
        firstSku: "SKU-HEAD-1",
        hotSell: "是",
        reviewCount: "120",
        store: "一号店",
      }),
    });
    assert.equal(layered.res.status, 201);
    assert.equal(layered.body.item.layer, "头部产品");
    assert.equal(layered.body.item.spu, "SPU-HEAD-1");
    assert.equal(layered.body.item.firstSku, "SKU-HEAD-1");
    assert.equal(layered.body.item.name, "SPU-HEAD-1");

    const teamA = await json(base, "/api/han/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ layer: "头部产品", spu: "TEAM-A", team: "陈晓曼组" }),
    });
    const teamB = await json(base, "/api/han/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ layer: "头部产品", spu: "TEAM-B", team: "高明阳组" }),
    });
    assert.equal(teamA.body.item.team, "陈晓曼组");
    assert.equal(teamB.body.item.team, "高明阳组");
    const onlyA = await json(base, "/api/han/products?team=" + encodeURIComponent("陈晓曼组"));
    const titlesA = onlyA.body.items.map((row) => row.spu);
    assert.equal(titlesA.includes("TEAM-A"), true);
    assert.equal(titlesA.includes("TEAM-B"), false);

    const shopA = await json(base, "/api/han/shops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team: "陈晓曼组", store: "晓曼一店" }),
    });
    assert.equal(shopA.res.status, 201);
    await json(base, "/api/han/shops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team: "陈晓曼组", store: "晓曼二店" }),
    });
    await json(base, "/api/han/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ layer: "头部产品", spu: "SHOP-1", team: "陈晓曼组", store: "晓曼一店" }),
    });
    const shopList = await json(base, "/api/han/shops?team=" + encodeURIComponent("陈晓曼组"));
    assert.equal(shopList.body.items.length, 2);
    const onlyShop = await json(
      base,
      "/api/han/products?team=" + encodeURIComponent("陈晓曼组") + "&store=" + encodeURIComponent("晓曼一店"),
    );
    assert.equal(onlyShop.body.items.some((row) => row.spu === "SHOP-1"), true);
    assert.equal(onlyShop.body.items.every((row) => row.store === "晓曼一店"), true);

    const csv = buildProductCsv([
      { layer: "测新产品", spu: "CSV-1", firstSku: "SKU-1", listedOn: "2026-09-01" },
      { layer: "头部产品", spu: "CSV-2", remark: "重点" },
    ]);
    const imported = await json(base, "/api/han/products/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team: "陈晓曼组", store: "晓曼一店", csv }),
    });
    assert.equal(imported.res.status, 201);
    assert.equal(imported.body.created.length, 2);
    const exported = await fetch(
      base +
        "/api/han/products.csv?team=" +
        encodeURIComponent("陈晓曼组") +
        "&store=" +
        encodeURIComponent("晓曼一店"),
    );
    const csvText = await exported.text();
    assert.equal(exported.headers.get("content-type").includes("text/csv"), true);
    assert.match(csvText, /CSV-1/);
    assert.match(csvText, /测新产品/);
    const again = await json(
      base,
      "/api/han/products?team=" + encodeURIComponent("陈晓曼组") + "&store=" + encodeURIComponent("晓曼一店"),
    );
    assert.equal(again.body.items.some((row) => row.spu === "CSV-1"), true);

    const raw = await json(base, "/api/han/products/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        team: "陈晓曼组",
        store: "晓曼一店",
        csv:
          "SPU,退货率,推广花费占比,近7天日成交金额,成交转化率,成交单量,评价数\n" +
          "HEAD-AUTO,12%,30%,2500,8%,20,10\n" +
          "TEST-AUTO,,,,,,1\n",
      }),
    });
    assert.equal(raw.body.created.length, 2);
    const head = raw.body.created.find((row) => row.spu === "HEAD-AUTO");
    const testNew = raw.body.created.find((row) => row.spu === "TEST-AUTO");
    assert.equal(head.layer, "头部产品");
    assert.equal(testNew.layer, "测新产品");
    const moved = await json(base, "/api/han/products/" + head.id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ layer: "中部产品", remark: "手调" }),
    });
    assert.equal(moved.body.item.layer, "中部产品");
    assert.equal(moved.body.item.remark, "手调");
  });
});

test("han summary is store + date range totals only", async () => {
  await withServer(async (base) => {
    const today = new Date().toISOString().slice(0, 10);
    await json(base, "/api/han/selection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "店A选品", store: "一号店" }),
    });
    await json(base, "/api/han/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "店A商品", store: "一号店" }),
    });
    await json(base, "/api/han/paid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: "信息流", amount: "80", spentOn: "2026-09-08", store: "一号店" }),
    });
    await json(base, "/api/han/paid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: "搜索", amount: "20", spentOn: "2026-09-08", store: "二号店" }),
    });

    const missing = await json(base, "/api/han/summary");
    assert.equal(missing.res.status, 400);

    const a = await json(base, "/api/han/summary?store=" + encodeURIComponent("一号店") + "&from=2026-09-01&to=" + today);
    assert.equal(a.res.status, 200);
    assert.equal(a.body.ok, true);
    assert.equal(a.body.readOnly, true);
    assert.equal(a.body.store, "一号店");
    assert.equal(a.body.selectionCount, 1);
    assert.equal(a.body.productCount, 1);
    assert.equal(a.body.paidCount, 1);
    assert.equal(String(a.body.paidAmount), "80");
    assert.equal(a.body.items, undefined);
    assert.equal(a.body.tasks, undefined);

    const b = await json(base, "/api/han/summary?store=" + encodeURIComponent("二号店") + "&from=2026-09-01&to=" + today);
    assert.equal(b.body.selectionCount, 0);
    assert.equal(b.body.paidCount, 1);
    assert.equal(String(b.body.paidAmount), "20");

    const outside = await json(base, "/api/han/summary?store=" + encodeURIComponent("一号店") + "&from=2026-08-01&to=2026-08-31");
    assert.equal(outside.body.paidCount, 0);
    assert.equal(outside.body.selectionCount, 0);
  });
});

test("shared han module fills submenu pages", async () => {
  const { readFile } = await import("node:fs/promises");
  const js = await readFile(new URL("../public/shared/modules/han.js", import.meta.url), "utf8");
  assert.match(js, /XmModules\["\/han\/selection"\]/);
  assert.match(js, /XmModules\["\/han\/goods"\]/);
  assert.match(js, /店铺产品分层表/);
  assert.match(js, /han-sheet/);
  assert.match(js, /导入原始数据/);
  assert.match(js, /按本店规则分类/);
  assert.match(js, /本店分类规则/);
  assert.match(js, /\/api\/han\/shop-rules/);
  assert.match(js, /本月任务规划/);
  assert.match(js, /本周任务规划/);
  assert.match(js, /\/api\/han\/shop-plans/);
  assert.match(js, /趋势选品/);
  assert.match(js, /同行竞对/);
  assert.match(js, /初选商品/);
  assert.match(js, /入选商品/);
  assert.doesNotMatch(js, /全新商品/);
  assert.match(js, /\/api\/han\/picks/);
  assert.match(js, /han-layer-pick/);
  assert.match(js, /han-thumb/);
  assert.match(js, /han-thumb-box/);
  assert.match(js, /han-sheet-viewport/);
  assert.match(js, /han-cell-view/);
  assert.match(js, /beginCellEdit/);
  assert.match(js, /han-col-resizer/);
  assert.match(js, /han-sheet-size-reset/);
  assert.match(js, /复位格子/);
  assert.match(js, /han-row-resizer/);
  assert.doesNotMatch(js, /han-sheet-zoom-in/);
  assert.match(js, /han-sheet-pan/);
  assert.match(js, /han-lightbox/);
  assert.match(js, /openHanLightbox/);
  assert.match(js, /han-lightbox-css/);
  assert.match(js, /双击看大图/);
  assert.match(js, /input\.focus\(\)/);
  assert.match(js, /han-img-cell/);
  assert.match(js, /referrerpolicy/);
  assert.match(js, /type="hidden"/);
  assert.doesNotMatch(js, /placeholder="主图链接"/);
  assert.match(js, /id="han-export"/);
  assert.match(js, /\/api\/han\/products\/import/);
  assert.match(js, /\/api\/han\/products\/import-file/);
  assert.match(js, /\.xlsx/);
  assert.match(js, /\/api\/han\/products\.csv/);
  assert.match(js, /头部产品/);
  assert.match(js, /中部产品/);
  assert.match(js, /尾部产品/);
  assert.match(js, /动销产品/);
  assert.match(js, /测新产品/);
  assert.match(js, /待做单产品/);
  assert.match(js, /陈晓曼组/);
  assert.match(js, /高明阳组/);
  assert.match(js, /毛永超组/);
  assert.match(js, /段坤孝组/);
  assert.match(js, /薛双双组/);
  assert.match(js, /韩梦凯组/);
  assert.match(js, /han-tabs/);
  assert.match(js, /\.han-tab\.is-active\{background:#0f766e/);
  assert.match(js, /data-han-tab/);
  assert.match(js, /商品分层/);
  assert.match(js, /全部汇总/);
  assert.match(js, /本组汇总/);
  assert.match(js, /本组产品分层汇总/);
  assert.doesNotMatch(js, /本小组店铺/);
  assert.match(js, /han-store-cell/);
  assert.match(js, /已经分好/);
  assert.doesNotMatch(js, /按统一规则分类/);
  assert.match(js, /function goHanPage/);
  assert.match(js, /window\.__xmGo/);
  assert.match(js, /history\.pushState/);
  assert.match(js, /han-goods-stage/);
  assert.match(js, /is-leave/);
  assert.match(js, /animateGoodsSwap/);
  assert.doesNotMatch(js, /data-xm-group='\/han'\]>\.xm-submenu/);
  assert.doesNotMatch(js, /han-fold-parent/);
  assert.doesNotMatch(js, /goods\.remove\(/);
  assert.match(js, /\/api\/han\/shops/);
  assert.match(js, /组织中心/);
  assert.doesNotMatch(js, /添加店铺/);
  assert.doesNotMatch(js, /han-layer-bar/);
  assert.doesNotMatch(js, /头部产品（高利润）/);
  assert.doesNotMatch(js, /新上架需做单产品/);
  assert.match(js, /XmModules\["\/han\/paid"\]/);
  assert.match(js, /XmModules\["\/han\/paid-center"\]/);
  assert.match(js, /XmModules\["\/han\/recharge-rules"\]/);
  assert.match(js, /实时付费/);
  assert.match(js, /HanCenter\.mount\(root, hanBoard\)/);
  assert.match(js, /20261003-asof/);
  assert.doesNotMatch(js, /id="paid-form"/);
  assert.doesNotMatch(js, /上传抓取表/);
  assert.match(js, /XmModules\["\/han\/training"\]/);
  assert.match(js, /\/api\/han\/selection/);
  assert.match(js, /\/api\/han\/products/);
  assert.match(js, /\/api\/han\/training/);
  assert.match(js, /店/);
  assert.match(js, /培训系统/);
  assert.doesNotMatch(js, /内容待开发/);
});

test("goHanPage switches Han pages through the shell router", () => {
  const calls = [];
  const location = {
    pathname: "/han/selection",
    search: "",
    assign(href) {
      calls.push(["assign", href]);
    },
  };
  const window = {
    __xmGo(href) {
      calls.push(["go", href]);
    },
  };
  function goHanPage(href) {
    const target = String(href || "/han/goods");
    const here = String(location.pathname || "") + String(location.search || "");
    if (here === target || here === target + "/") {
      return;
    }
    if (typeof window.__xmGo === "function" && target.indexOf("?") < 0) {
      window.__xmGo(target);
      return;
    }
    location.assign(target);
  }
  goHanPage("/han/goods");
  assert.deepEqual(calls, [["go", "/han/goods"]]);
  calls.length = 0;
  location.pathname = "/han/goods";
  goHanPage("/han/goods");
  assert.deepEqual(calls, []);
  goHanPage("/han/goods?team=" + encodeURIComponent("陈晓曼组"));
  assert.deepEqual(calls, [["assign", "/han/goods?team=" + encodeURIComponent("陈晓曼组")]]);
});

test("实时付费 second click shows the pane that was left open", async () => {
  const { readFile } = await import("node:fs/promises");
  const { runInNewContext } = await import("node:vm");
  const js = await readFile(new URL("../public/shared/modules/han.js", import.meta.url), "utf8");
  const listeners = [];
  const pane = {
    attrs: {
      "data-xm-mounted": "/han/paid",
      "data-xm-href": "/han/paid",
      "data-han-paid-key": "live::",
    },
    hidden: true,
    classList: {
      set: new Set(),
      add(name) { this.set.add(name); },
      remove(name) { this.set.delete(name); },
      contains(name) { return this.set.has(name); },
      toggle(name, on) { if (on) this.add(name); else this.remove(name); },
    },
    style: { display: "none" },
    innerHTML: '<main class="page han-paid han-live">实时付费正文</main>',
    querySelector(sel) {
      if (sel === ".han-live, .han-rules, .page") {
        return this.innerHTML.includes("han-live") || this.innerHTML.includes('class="page') ? { ok: true } : null;
      }
      return null;
    },
    setAttribute(name, value) { this.attrs[name] = value; },
    getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null; },
  };
  const location = { pathname: "/han/goods", search: "" };
  const calls = [];
  const document = {
    readyState: "complete",
    head: { appendChild() {} },
    documentElement: {},
    getElementById() { return null; },
    createElement() { return { setAttribute() {} }; },
    addEventListener(type, fn) { listeners.push([type, fn]); },
    querySelector(sel) {
      if (sel === "[data-xm-mounted='/han/paid']") return pane;
      return null;
    },
    querySelectorAll() { return []; },
  };
  const sandbox = {
    URLSearchParams,
    setInterval() { return 1; },
    clearInterval() {},
    setTimeout(fn) { fn(); return 1; },
    window: {
      XmModules: {},
      location,
      addEventListener() {},
      __xmGo(href) {
        calls.push(href);
        location.pathname = "/han/paid";
        location.search = "";
        pane.hidden = false;
        pane.style.display = "block";
        pane.classList.add("is-active");
      },
    },
    document,
    location,
    history: {
      pushState(_state, _title, href) {
        calls.push(["push", href]);
        const next = String(href);
        const cut = next.indexOf("?");
        location.pathname = cut < 0 ? next : next.slice(0, cut);
        location.search = cut < 0 ? "" : next.slice(cut);
      },
    },
    fetch() {
      return Promise.resolve({ json: () => Promise.resolve({ ok: true, items: [] }) });
    },
  };
  sandbox.window.document = document;
  runInNewContext(js, sandbox);
  const click = listeners.find((row) => row[0] === "click");
  assert.ok(click);
  const link = {
    attrs: { href: "/han/paid", "data-han-center": "center" },
    getAttribute(name) { return this.attrs[name] || null; },
    closest(sel) {
      if (sel === "a") return this;
      if (String(sel).indexOf("xm-submenu") >= 0) return { className: "xm-submenu" };
      return null;
    },
  };
  click[1]({ target: link, button: 0, preventDefault() {}, stopPropagation() {} });
  assert.deepEqual(calls, ["/han/paid"]);
  assert.equal(pane.hidden, false);
  assert.equal(pane.style.display, "block");
  assert.match(pane.innerHTML, /实时付费正文/);

  pane.attrs["data-han-paid-key"] = "live:" + "陈晓曼组" + ":";
  pane.hidden = false;
  pane.style.display = "block";
  pane.classList.add("is-active");
  location.pathname = "/han/paid";
  location.search = "?team=" + encodeURIComponent("陈晓曼组");
  calls.length = 0;
  click[1]({ target: link, button: 0, preventDefault() {}, stopPropagation() {} });
  assert.deepEqual(calls, [["push", "/han/paid"]]);
  assert.match(pane.innerHTML, /实时付费/);
  assert.doesNotMatch(pane.innerHTML, /实时付费正文/);
  assert.equal(pane.attrs["data-han-paid-key"], "live::");

  pane.attrs["data-han-paid-key"] = "live::";
  pane.innerHTML = '<main class="page han-paid han-live">全部汇总</main>';
  location.pathname = "/han/paid";
  location.search = "";
  calls.length = 0;
  const teamHref = "/han/paid?team=" + encodeURIComponent("陈晓曼组");
  const teamTab = {
    attrs: { href: teamHref, "data-han-tab": teamHref },
    getAttribute(name) { return this.attrs[name] || null; },
    closest(sel) {
      if (sel === "a" || sel === "a[data-han-tab]") return this;
      return null;
    },
  };
  click[1]({ target: teamTab, button: 0, preventDefault() {}, stopPropagation() {} });
  assert.equal(location.pathname, "/han/paid");
  assert.equal(location.search, "?team=" + encodeURIComponent("陈晓曼组"));
  assert.equal(pane.attrs["data-han-paid-key"], "live:" + "陈晓曼组" + ":");
  assert.match(pane.innerHTML, /正在打开/);
  assert.deepEqual(calls, [["push", teamHref]]);
});

test("goods page puts 商品分层 teams on a horizontal tab bar", async () => {
  const { readFile } = await import("node:fs/promises");
  const { runInNewContext } = await import("node:vm");
  const js = await readFile(new URL("../public/shared/modules/han.js", import.meta.url), "utf8");
  const leftover = { id: "han-goods-teams", parentNode: { removeChild() { leftover.gone = true; } } };
  const styles = [];
  function el() {
    return {
      innerHTML: "",
      textContent: "",
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      style: {},
      addEventListener() {},
      removeEventListener() {},
      querySelector() {
        return el();
      },
      querySelectorAll() {
        return [];
      },
      setAttribute() {},
    };
  }
  const root = {
    innerHTML: "",
    querySelector() {
      return el();
    },
    querySelectorAll() {
      return [];
    },
  };
  const document = {
    readyState: "complete",
    head: {
      appendChild(node) {
        styles.push(node);
        return node;
      },
    },
    getElementById(id) {
      if (id === "han-goods-teams") return leftover.gone ? null : leftover;
      return null;
    },
    createElement(tag) {
      return { tagName: tag, id: "", textContent: "" };
    },
    addEventListener() {},
    querySelector() {
      return null;
    },
  };
  const sandbox = {
    URLSearchParams,
    setInterval() {
      return 1;
    },
    clearInterval() {},
    window: {
      XmModules: {},
      location: { pathname: "/han/goods", search: "" },
      addEventListener() {},
    },
    document,
    location: { pathname: "/han/goods", search: "", assign() {} },
    history: { pushState() {} },
    fetch() {
      return Promise.resolve({ json: () => Promise.resolve({ ok: true, items: [] }) });
    },
  };
  sandbox.window.document = document;
  runInNewContext(js, sandbox);
  sandbox.window.XmModules["/han/goods"].mount(root);
  assert.match(root.innerHTML, /class="han-tabs han-tabs-sub"/);
  assert.match(root.innerHTML, /全部汇总/);
  assert.match(root.innerHTML, /已经分好/);
  assert.match(root.innerHTML, /id="han-export"/);
  assert.doesNotMatch(root.innerHTML, /按统一规则分类/);
  assert.match(js, /店铺产品分层汇总/);
  assert.match(root.innerHTML, /陈晓曼组/);
  assert.match(root.innerHTML, /薛双双组/);
  assert.doesNotMatch(root.innerHTML, /本店分类规则/);
  sandbox.window.location.search = "?team=" + encodeURIComponent("陈晓曼组");
  sandbox.location.search = sandbox.window.location.search;
  sandbox.window.XmModules["/han/goods"].mount(root);
  assert.match(root.innerHTML, /已经分好/);
  assert.doesNotMatch(root.innerHTML, /按统一规则分类/);
  assert.doesNotMatch(root.innerHTML, /本小组店铺/);
  assert.doesNotMatch(root.innerHTML, /本店分类规则/);
  assert.doesNotMatch(root.innerHTML, /data-han-tab="\/han\/selection"/);
  assert.equal(leftover.gone, true);
  assert.doesNotMatch(styles[0].textContent, /xm-submenu/);
  sandbox.window.XmModules["/han/selection"].mount(root);
  assert.match(root.innerHTML, /class="han-tabs han-tabs-sub"/);
  assert.match(root.innerHTML, /日常选品/);
  assert.match(root.innerHTML, /趋势选品/);
  assert.match(root.innerHTML, /同行竞对/);
  assert.match(root.innerHTML, /初选商品/);
  assert.match(root.innerHTML, /入选商品/);
});

test("GET /api/han/shops pulls 组织中心 stores for the team", async () => {
  const hanStore = createHanStore(createHanFakePool());
  const app = createApp({ hanStore });
  app.get("/api/people/org/stores", (_req, res) => {
    res.json({
      ok: true,
      stores: [
        { id: 7, lead: "段坤孝", storeName: "段组旗舰店", remark: "运营中" },
        { id: 8, lead: "陈晓曼", storeName: "不该出现", remark: "运营中" },
      ],
    });
  });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  try {
    const listed = await json(base, "/api/han/shops?team=" + encodeURIComponent("段坤孝组"));
    assert.equal(listed.res.status, 200);
    assert.deepEqual(
      listed.body.items.map((row) => row.store),
      ["段组旗舰店"],
    );
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});

test("classifyProduct follows 商品分层规则", () => {
  assert.equal(
    classifyProduct(
      { returnM8: "12%", spendRate: "30%", gmv7d: "2500", convRate: "8%", orders30d: "20" },
      { force: true },
    ),
    "头部产品",
  );
  assert.equal(
    classifyProduct(
      { returnM8: "22%", spendRate: "35%", gmv7d: "1200", convRate: "6%", orders30d: "5" },
      { force: true },
    ),
    "中部产品",
  );
  assert.equal(
    classifyProduct({ returnM8: "27%", orders30d: "8" }, { force: true }),
    "尾部产品",
  );
  assert.equal(classifyProduct({ reviewCount: "2" }, { force: true }), "测新产品");
  assert.equal(classifyProduct({ spu: "NEW" }, { force: true }), "待做单产品");
  assert.equal(
    classifyProduct(
      { returnM8: "12%", spendRate: "30%", gmv7d: "2500", convRate: "8%", orders30d: "20" },
      { force: true, rules: { head: { gmvMin: 9000 } } },
    ),
    "中部产品",
  );
});

test("each shop can save its own classify rules", async () => {
  await withServer(async (base) => {
    const metrics = {
      returnM8: "12%",
      spendRate: "30%",
      gmv7d: "2500",
      convRate: "8%",
      orders30d: "20",
    };
    const def = await json(
      base,
      "/api/han/shop-rules?team=" + encodeURIComponent("陈晓曼组") + "&store=" + encodeURIComponent("一号店"),
    );
    assert.equal(def.body.ok, true);
    assert.equal(def.body.custom, false);
    assert.equal(def.body.rules.head.gmvMin, 2000);

    const saved = await json(base, "/api/han/shop-rules", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        team: "陈晓曼组",
        store: "一号店",
        rules: { head: { gmvMin: 9000 } },
      }),
    });
    assert.equal(saved.body.custom, true);
    assert.equal(saved.body.rules.head.gmvMin, 9000);
    assert.equal(saved.body.rules.head.returnMax, 20);

    const other = await json(
      base,
      "/api/han/shop-rules?team=" + encodeURIComponent("陈晓曼组") + "&store=" + encodeURIComponent("二号店"),
    );
    assert.equal(other.body.custom, false);
    assert.equal(other.body.rules.head.gmvMin, 2000);

    const a = await json(base, "/api/han/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team: "陈晓曼组", store: "一号店", spu: "S-A", ...metrics }),
    });
    const b = await json(base, "/api/han/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team: "陈晓曼组", store: "二号店", spu: "S-B", ...metrics }),
    });
    assert.equal(a.body.item.layer, "中部产品");
    assert.equal(b.body.item.layer, "头部产品");

    const reset = await json(
      base,
      "/api/han/shop-rules?team=" + encodeURIComponent("陈晓曼组") + "&store=" + encodeURIComponent("一号店"),
      { method: "DELETE" },
    );
    assert.equal(reset.body.custom, false);
    assert.equal(reset.body.rules.head.gmvMin, 2000);
  });
});

test("POST /api/han/products/classify unified uses default rules for all shops", async () => {
  await withServer(async (base) => {
    const metrics = {
      returnM8: "12%",
      spendRate: "30%",
      gmv7d: "2500",
      convRate: "8%",
      orders30d: "20",
    };
    await json(base, "/api/han/shop-rules", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        team: "陈晓曼组",
        store: "一号店",
        rules: { head: { gmvMin: 9000 } },
      }),
    });
    const tight = await json(base, "/api/han/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team: "陈晓曼组", store: "一号店", spu: "ALL-A", ...metrics }),
    });
    const loose = await json(base, "/api/han/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team: "高明阳组", store: "阳店", spu: "ALL-B", ...metrics }),
    });
    assert.equal(tight.body.item.layer, "中部产品");
    assert.equal(loose.body.item.layer, "头部产品");

    const listed = await json(base, "/api/han/products");
    assert.equal(listed.body.items.some((row) => row.spu === "ALL-A" && row.store === "一号店"), true);
    assert.equal(listed.body.items.some((row) => row.spu === "ALL-B" && row.store === "阳店"), true);

    const classified = await json(base, "/api/han/products/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unified: true }),
    });
    assert.equal(classified.body.ok, true);
    assert.equal(classified.body.unified, true);
    assert.equal(classified.body.count >= 1, true);
    const after = await json(base, "/api/han/products");
    assert.equal(after.body.items.find((row) => row.spu === "ALL-A").layer, "头部产品");
    assert.equal(after.body.items.find((row) => row.spu === "ALL-B").layer, "头部产品");
  });
});

test("each shop can save month and week task plans", async () => {
  await withServer(async (base) => {
    const empty = await json(
      base,
      "/api/han/shop-plans?team=" + encodeURIComponent("高明阳组") + "&store=" + encodeURIComponent("SAWAAA个护健康旗舰店"),
    );
    assert.equal(empty.body.ok, true);
    assert.deepEqual(empty.body.monthItems, []);
    assert.deepEqual(empty.body.weekItems, []);

    const saved = await json(base, "/api/han/shop-plans", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        team: "高明阳组",
        store: "SAWAAA个护健康旗舰店",
        monthItems: [{ id: "m1", text: "冲头部", done: false }],
        weekItems: [{ id: "w1", text: "测新3个", done: true }],
      }),
    });
    assert.equal(saved.body.monthItems[0].text, "冲头部");
    assert.equal(saved.body.weekItems[0].done, true);

    const other = await json(
      base,
      "/api/han/shop-plans?team=" + encodeURIComponent("高明阳组") + "&store=" + encodeURIComponent("二号店"),
    );
    assert.deepEqual(other.body.monthItems, []);
    assert.deepEqual(other.body.weekItems, []);
  });
});

test("京东商品总览 xlsx maps to classify fields", () => {
  const filename = "商品总览_京东_RASW个护健康旗舰店_2026-08-01_2026-08-31 (1).xlsx";
  const meta = parseOverviewFilename(filename);
  assert.equal(meta.shop, "RASW个护健康旗舰店");
  assert.equal(meta.days, 31);
  const buf = makeMinimalXlsx([
    ["商品总览"],
    ["统计时间：2026-08-01 至 2026-08-31"],
    ["商品名称", "SPU", "成交金额", "成交单量", "成交转化率", "退货率", "推广花费占比", "评价数"],
    ["洗发露", "SPU-A", 62000, 20, "8%", "12%", "30%", 2],
  ]);
  const parsed = parseOverviewWorkbook(buf, filename);
  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0].spu, "SPU-A");
  assert.equal(parsed.items[0].gmv7d, "2000");
  assert.equal(parsed.items[0].orders30d, "20");
  assert.equal(parsed.items[0].convRate, "8%");
  assert.equal(parsed.items[0].returnM8, "12%");
});

test("京东表头带单位也能识别", () => {
  assert.equal(headerKey("成交金额(元)"), "periodGmv");
  assert.equal(headerKey("成交转化率(%)"), "convRate");
  assert.equal(headerKey("SPU编码"), "spu");
  assert.equal(headerKey("成交订单数"), "orders30d");
  const filename = "商品总览_京东_RASW个护健康旗舰店_2026-08-01_2026-08-31.xlsx";
  const buf = makeMinimalXlsx([
    ["商品名称", "SPU编码", "成交金额(元)", "成交订单数", "成交转化率(%)", "退货率(%)", "推广花费占比(%)"],
    ["洗发露", "SPU-A", 62000, 20, "8%", "12%", "30%"],
  ]);
  const parsed = parseOverviewWorkbook(buf, filename);
  assert.equal(parsed.items[0].spu, "SPU-A");
  assert.equal(parsed.items[0].gmv7d, "2000");
  assert.equal(parsed.items[0].orders30d, "20");
});

test("POST /api/han/products/import-file reads 商品总览 xlsx", async () => {
  await withServer(async (base) => {
    const filename = "商品总览_京东_RASW个护健康旗舰店_2026-08-01_2026-08-31.xlsx";
    const buf = makeMinimalXlsx([
      ["商品名称", "SPU", "成交金额", "成交单量", "成交转化率", "退货率", "推广花费占比"],
      ["洗发露", "SPU-A", 62000, 20, "8%", "12%", "30%"],
    ]);
    const res = await fetch(
      `${base}/api/han/products/import-file?team=${encodeURIComponent("高明阳组")}&store=${encodeURIComponent("RASW个护健康旗舰店")}&filename=${encodeURIComponent(filename)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: buf,
      },
    );
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.created[0].layer, "头部产品");
    assert.equal(body.created[0].spu, "SPU-A");
  });
});

test("采集中心付费表头能识别并导入", async () => {
  assert.equal(paidHeaderKey("精准通总花费"), "amount");
  assert.equal(paidHeaderKey("店铺账号"), "store");
  assert.equal(paidHeaderKey("采集时间"), "spentOn");
  const csv = parsePaidWorkbook("店铺,精准通总花费,采集时间\n护肤健康旗舰店,12458.45,2026-09-12\n", "paid.csv");
  assert.equal(csv.items[0].store, "护肤健康旗舰店");
  assert.equal(csv.items[0].channel, "精准通");
  assert.equal(csv.items[0].amount, "12458.45");
  const buf = makeMinimalXlsx([
    ["店铺", "成交金额", "精准通总花费", "采集时间"],
    ["RASW个护健康旗舰店", 0, 12458.45, "2026-09-12"],
  ]);
  const parsed = parsePaidWorkbook(buf, "collector.xlsx");
  assert.equal(parsed.items[0].store, "RASW个护健康旗舰店");
  assert.equal(parsed.items[0].note, "成交金额 0");
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/han/paid/import-file?filename=${encodeURIComponent("collector.xlsx")}`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: buf,
    });
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.created.length, 1);
    assert.equal(body.created[0].store, "RASW个护健康旗舰店");
    const listed = await json(base, "/api/han/paid");
    assert.equal(listed.body.items.length, 1);
    const again = await fetch(`${base}/api/han/paid/import-file?filename=${encodeURIComponent("collector.xlsx")}`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: buf,
    });
    const dup = await again.json();
    assert.equal(dup.created.length, 0);
    assert.equal(dup.skipped, 1);
  });
});

test("product csv round-trips layer columns", () => {
  const csv = buildProductCsv([
    { layer: "头部产品", spu: "A1", firstSku: "S1", remark: "含,逗号" },
  ]);
  const rows = parseProductCsv("\uFEFF" + csv);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].layer, "头部产品");
  assert.equal(rows[0].spu, "A1");
  assert.equal(rows[0].firstSku, "S1");
  assert.equal(rows[0].remark, "含,逗号");
});

test("han shops map 组织中心 lead to 韩梦凯小组", () => {
  const stores = [
    { id: 16, lead: "陈晓曼", storeName: "ZYUO洗护旗舰店", remark: "运营中" },
    { id: 18, lead: "陈晓曼", storeName: "京贝优驱蚊专营店", remark: "运营中" },
    { id: 99, lead: "陈晓曼", storeName: "已关店", remark: "已退店", statusKey: "closed" },
    { id: 26, lead: "毛永超", storeName: "DIKTT家居旗舰店", remark: "运营中" },
    { id: 40, lead: "", storeName: "直管一店", remark: "运营中", chief: "韩梦凯" },
    { id: 41, lead: "韩梦凯", storeName: "直管二店", remark: "运营中" },
    { id: 42, lead: "", storeName: "别人的店", remark: "运营中", chief: "别人" },
  ];
  const xiaoman = matchOrgStoresForTeam(stores, "陈晓曼组");
  assert.deepEqual(
    xiaoman.map((row) => row.store),
    ["ZYUO洗护旗舰店", "京贝优驱蚊专营店"],
  );
  assert.equal(xiaoman.every((row) => row.team === "陈晓曼组" && row.source === "org"), true);
  assert.equal(matchOrgStoresForTeam(stores, "毛永超组").length, 1);
  const direct = matchOrgStoresForTeam(stores, "韩梦凯组");
  assert.deepEqual(
    direct.map((row) => row.store),
    ["直管一店", "直管二店"],
  );
  assert.equal(direct.every((row) => row.team === "韩梦凯组"), true);
  assert.deepEqual(
    mergeTeamShops(xiaoman, [{ store: "ZYUO洗护旗舰店" }, { store: "手工补的店" }]).map((row) => row.store),
    ["ZYUO洗护旗舰店", "京贝优驱蚊专营店", "手工补的店"],
  );
});

test("han store keeps dropProbeTasks and hydrateFromMysql exports", async () => {
  assert.equal(typeof dropProbeTasks, "function");
  assert.equal(typeof hydrateFromMysql, "function");
  const pool = createHanFakePool();
  const dropped = await dropProbeTasks(pool);
  assert.equal(dropped.ok, true);
  const hydrated = await hydrateFromMysql(pool);
  assert.equal(hydrated.ok, true);
});

test("shop 京准通总订单金额 sums subaccount order amounts", async () => {
  await withServer(async (base) => {
    const pushed = await json(base, "/api/han/worker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: [
          { 店铺名称: "订单店", 京准通主账户ID: "300", 花费: 100, 京准通总订单金额: 0 },
          { 店铺名称: "只有店", 京准通主账户ID: "301", 京准通总订单金额: 9000 },
        ],
        subaccounts: [
          { 店铺名称: "订单店", 京准通主账户ID: "300", 子账号ID: "1", 子账号名称: "甲", 订单金额: 608 },
          { 店铺名称: "订单店", 京准通主账户ID: "300", 子账号ID: "2", 子账号名称: "乙", 京准通总订单金额: 229 },
          { 店铺名称: "订单店", 京准通主账户ID: "300", 子账号ID: "3", 子账号名称: "丙", 花费: 10 },
        ],
      }),
    });
    assert.equal(pushed.res.status, 201);
    const overview = await json(base, "/api/han/worker?view=overview");
    const rolled = overview.body.shops.find((row) => row.store === "订单店");
    const shopOnly = overview.body.shops.find((row) => row.store === "只有店");
    assert.equal(rolled.totalOrderAmount, 837);
    assert.equal(shopOnly.totalOrderAmount, 9000);
    const shop = await json(base, "/api/han/worker?view=shop&store=" + encodeURIComponent("订单店"));
    assert.equal(shop.body.shop.totalOrderAmount, 837);
    assert.equal(shop.body.subaccounts.find((row) => row.subAccountName === "甲").totalOrderAmount, 608);
  });
});

test("子账号账户备注由页面保存，回传花费不会覆盖", async () => {
  await withServer(async (base) => {
    const pushed = await json(base, "/api/han/worker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: [{ 店铺名称: "备注店", 京准通主账户ID: "880", 花费: 10 }],
        subaccounts: [
          { 店铺名称: "备注店", 京准通主账户ID: "880", 子账号ID: "881", 子账号名称: "备注甲", 花费: 10, 账户备注: "机器备注" },
        ],
      }),
    });
    assert.equal(pushed.res.status, 201);
    const before = await json(base, "/api/han/worker?view=shop&store=" + encodeURIComponent("备注店"));
    assert.equal(before.body.subaccounts[0].remark, "机器备注");
    const config = await json(base, "/api/han/worker");
    const saved = await json(base, "/api/han/worker", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remark", store: "备注店", subAccountId: "881", remark: "自己的备注" }),
    });
    assert.equal(saved.res.status, 200);
    assert.equal(saved.body.remark, "自己的备注");
    assert.equal(saved.body.version, config.body.version);
    const shop = await json(base, "/api/han/worker?view=shop&store=" + encodeURIComponent("备注店"));
    assert.equal(shop.body.subaccounts[0].remark, "自己的备注");
    const again = await json(base, "/api/han/worker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: [{ 店铺名称: "备注店", 京准通主账户ID: "880", 花费: 22 }],
        subaccounts: [
          { 店铺名称: "备注店", 京准通主账户ID: "880", 子账号ID: "881", 子账号名称: "备注甲", 花费: 22, 账户备注: "机器又写了" },
        ],
      }),
    });
    assert.equal(again.res.status, 201);
    const kept = await json(base, "/api/han/worker?view=shop&store=" + encodeURIComponent("备注店"));
    assert.equal(kept.body.subaccounts[0].remark, "自己的备注");
    assert.equal(kept.body.subaccounts[0].spend, 22);
    const pulled = await json(base, "/api/han/worker?machineId=han-worker-01");
    assert.equal(JSON.stringify(pulled.body).includes("自己的备注"), false);
    const cleared = await json(base, "/api/han/worker", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remark", store: "备注店", subAccountId: "881", remark: "" }),
    });
    assert.equal(cleared.res.status, 200);
    const empty = await json(base, "/api/han/worker?view=shop&store=" + encodeURIComponent("备注店"));
    assert.equal(empty.body.subaccounts[0].remark, "");
    const missing = await json(base, "/api/han/worker", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remark", store: "备注店", subAccountId: "没有", remark: "x" }),
    });
    assert.equal(missing.res.status, 404);
  });
});

test("GET/POST /api/han/worker feeds 付费中心 and 充值规则", async () => {
  await withServer(async (base) => {
    const pushed = await json(base, "/api/han/worker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        capturedAt: "2026-09-25T10:00:00+08:00",
        rows: [{ 店铺名称: "德系甄选好物企官店", 京准通主账户ID: "100", 花费: 800, 成交单量: 20, ROI: 2.4, 余额: 40, 成交金额: 3000 }],
        subaccounts: [
          { 店铺名称: "德系甄选好物企官店", 京准通主账户ID: "100", 子账号ID: "200", 子账号名称: "企官-主投", 花费: 800, ROI: 2.4, 余额: 40, 单量: 20 },
        ],
        recharges: [{ 店铺名称: "德系甄选好物企官店", 子账号ID: "200", 子账号名称: "企官-主投", 金额: 100, 时间: "2026-09-25 09:00", 备注: "一档" }],
      }),
    });
    assert.equal(pushed.res.status, 201);
    assert.equal(pushed.body.received.shops, 1);
    assert.equal(pushed.body.received.subaccounts, 1);

    const overview = await json(base, "/api/han/worker?view=overview");
    assert.equal(overview.body.shops[0].store, "德系甄选好物企官店");
    assert.equal(overview.body.totals.spend, 800);
    assert.equal(overview.body.shops[0].jingmaiGmv, 3000);
    assert.equal(overview.body.metrics.jingmaiGmv, 3000);
    assert.equal(overview.body.metrics.paidOrders, 20);

    const shop = await json(base, "/api/han/worker?view=shop&store=" + encodeURIComponent("德系甄选好物企官店"));
    assert.equal(shop.body.subaccounts[0].subAccountName, "企官-主投");
    assert.equal(shop.body.recharges[0].amount, 100);

    const freshRules = await json(base, "/api/han/worker?view=rules");
    assert.equal(freshRules.body.version, 0);
    assert.equal(freshRules.body.runListSaved, false);
    assert.equal(freshRules.body.rows[0].plannedRoi, 2);
    assert.equal(freshRules.body.rows[0].autoRecharge, true);
    assert.equal(freshRules.body.rows[0].tier1MinSpend, 1);
    assert.equal(freshRules.body.rows[0].tier1MaxSpend, 1000);
    assert.equal(freshRules.body.rows[0].tier1Balance, 100);
    assert.equal(freshRules.body.rows[0].tier1Amount, 100);
    assert.equal(freshRules.body.rows[0].tier2MinSpend, 1000);
    assert.equal(freshRules.body.rows[0].tier2Balance, 50);
    assert.equal(freshRules.body.rows[0].tier2Amount, 150);
    assert.equal(freshRules.body.rows[0].roiRiseAmount, 100);
    assert.equal(freshRules.body.rows[0].noOrderTimes, 3);
    assert.equal(freshRules.body.rows[0].pauseMinutes, 30);
    assert.equal(freshRules.body.shopRuns[0].enabled, true);
    assert.equal(freshRules.body.shopRuns[0].accountId, "100");
    assert.equal(freshRules.body.shopRuns[0].jztCookieStatus, "待录");

    const fresh = await json(base, "/api/han/worker?machineId=han-worker-01");
    const freshSub = fresh.body.shops[0].子账号[0];
    assert.equal(freshSub.计划ROI, 2);
    assert.equal(freshSub.自动充值, true);
    assert.equal(freshSub.第一档花费下限, 1);
    assert.equal(freshSub.第一档花费上限, 1000);
    assert.equal(freshSub.第一档余额阈值, 100);
    assert.equal(freshSub.第一档充值金额, 100);
    assert.equal(freshSub.第二档花费下限, 1000);
    assert.equal(freshSub.第二档余额阈值, 50);
    assert.equal(freshSub.第二档充值金额, 150);
    assert.equal(freshSub.ROI上涨充值金额, 100);
    assert.equal(freshSub.连续充值未增单次数, 3);
    assert.equal(freshSub.暂停分钟数, 30);

    const saved = await json(base, "/api/han/worker", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "rules",
        changeSummary: "保存充值规则",
        rows: [{ store: "德系甄选好物企官店", accountId: "100", subAccountId: "200", plannedRoi: 2.3, autoRecharge: true }],
      }),
    });
    assert.equal(saved.body.ok, true);
    assert.equal(saved.body.version, 1);

    const run = await json(base, "/api/han/worker", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "run", runShops: ["德系甄选好物企官店"], changeSummary: "保存运行状态" }),
    });
    assert.equal(run.body.version, 2);

    const config = await json(base, "/api/han/worker?machineId=han-local");
    assert.equal(config.body.changed, true);
    assert.deepEqual(config.body.runShops, ["100"]);
    assert.equal(config.body.shops[0].店铺名称, "德系甄选好物企官店");
    assert.equal(config.body.shops[0].子账号[0].计划ROI, 2.3);
    assert.equal(config.body.shops[0].子账号[0].自动充值, true);
    assert.equal(config.body.shops[0].子账号[0].第一档充值金额, 100);
    assert.equal(config.body.shops[0].子账号[0].第二档充值金额, 150);

    const same = await json(base, "/api/han/worker?machineId=han-local&sinceVersion=2");
    assert.equal(same.body.changed, false);

    const ack = await json(base, "/api/han/worker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ack", machineId: "han-local", version: 2, status: "success" }),
    });
    assert.equal(ack.body.status, "已同步");
    const syncedPage = await json(base, "/api/han/worker?view=rules");
    assert.equal(syncedPage.body.syncStatus, "已同步");
    assert.equal(syncedPage.body.rows.find((row) => row.subAccountId === "200").syncStatus, "已同步");

    const history = await json(base, "/api/han/worker?view=history");
    assert.equal(history.body.items.some((row) => row.summary === "保存充值规则"), true);

    const same304 = await fetch(base + "/api/han/worker?machineId=han-local&sinceVersion=2&http304=1");
    assert.equal(same304.status, 304);

    const posted = await json(base, "/api/han/worker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: [{ 店铺名称: "德系甄选好物企官店", 京麦成交金额: 3600, 花费: 900, 子账号: [
          { 子账号ID: "200", 子账号名称: "企官-主投", 花费: 900, ROI: 2.5, 余额: 30 },
        ] }],
        充值记录: [
          { 店铺名称: "德系甄选好物企官店", 子账号ID: "200", 充值金额: 100, 充值时间: "2026-09-25 11:00", executionId: "han-1", ruleCode: "tier1", result: "success", configVersion: 2 },
          { 店铺名称: "德系甄选好物企官店", 子账号ID: "200", 充值金额: 100, 充值时间: "2026-09-25 11:00", executionId: "han-1", ruleCode: "tier1", result: "success", configVersion: 2 },
        ],
      }),
    });
    assert.equal(posted.res.status, 201);
    const again = await json(base, "/api/han/worker?view=shop&store=" + encodeURIComponent("德系甄选好物企官店"));
    assert.equal(again.body.shop.gmv, 3600);
    assert.equal(again.body.subaccounts.length, 1);
    assert.equal(again.body.subaccounts[0].spend, 900);
    assert.equal(again.body.recharges.filter((row) => row.executionId === "han-1").length, 1);

    const badId = await json(base, "/api/han/worker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subaccounts: [{ 店铺名称: "德系甄选好物企官店", 子账号ID: "1e+21" }] }),
    });
    assert.equal(badId.res.status, 400);

    const failed = await json(base, "/api/han/worker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ack", machineId: "han-local", version: 2, status: "failed" }),
    });
    assert.equal(failed.body.status, "同步失败");

    const zeroAmounts = await json(base, "/api/han/worker", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "rules",
        rows: [{
          store: "德系甄选好物企官店",
          accountId: "100",
          subAccountId: "200",
          autoRecharge: true,
          plannedRoi: 2,
          tier1Amount: 0,
          tier2Amount: 0,
          roiRiseAmount: 0,
        }],
      }),
    });
    assert.equal(zeroAmounts.res.status, 400);
    const still = await json(base, "/api/han/worker?machineId=han-worker-01&sinceVersion=0");
    assert.equal(still.body.shops[0].子账号[0].第一档充值金额, 100);
    assert.equal(still.body.shops[0].子账号[0].自动充值, true);

    const createdShop = await json(base, "/api/han/worker", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "shop", op: "create", 店铺名称: "新建测试店", 京准通主账户ID: "9001", 执行机: "han-worker-01" }),
    });
    assert.equal(createdShop.body.ok, true);
    const createdSub = await json(base, "/api/han/worker", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sub", op: "create", 京准通主账户ID: "9001", 子账号ID: "9002", 子账号名称: "测试子账号", 自动充值: false, 计划ROI: 2 }),
    });
    assert.equal(createdSub.body.ok, true);
    const withMaster = await json(base, "/api/han/worker?view=rules");
    const added = withMaster.body.rows.find((row) => row.subAccountId === "9002");
    assert.equal(added.autoRecharge, false);
    assert.equal(added.plannedRoi, 2);
    assert.equal(added.tier1Amount, 100);
    const editedRoi = await json(base, "/api/han/worker", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sub", op: "update", 京准通主账户ID: "9001", 子账号ID: "9002", 子账号名称: "测试子账号", 自动充值: false, 计划ROI: "2.1" }),
    });
    assert.equal(editedRoi.body.ok, true);
    const afterRoi = await json(base, "/api/han/worker?view=rules");
    assert.equal(afterRoi.body.rows.find((row) => row.subAccountId === "9002").plannedRoi, 2.1);
    assert.equal(withMaster.body.shopRuns.some((row) => row.accountId === "9001" && row.machineId === "han-worker-01"), true);

    const removed = await json(base, "/api/han/worker", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sub", op: "delete", 京准通主账户ID: "9001", 子账号ID: "9002" }),
    });
    assert.equal(removed.body.ok, true);
    const hidden = await json(base, "/api/han/worker?view=rules");
    assert.equal(hidden.body.rows.find((row) => row.subAccountId === "9002"), undefined);
    const shown = await json(base, "/api/han/worker?view=rules&deleted=1");
    assert.equal(shown.body.rows.find((row) => row.subAccountId === "9002").deleted, true);

    const cookie = await json(base, "/api/han/worker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "status", 京准通主账户ID: "9001", 京准通Cookie状态: "正常", 京麦Cookie状态: "正常", 执行状态: "已停止", 在线状态: "离线" }),
    });
    assert.equal(cookie.body.ok, true);
    const reported = await json(base, "/api/han/worker?view=rules");
    assert.equal(reported.body.shopRuns.find((row) => row.accountId === "9001").jztCookieStatus, "正常");
    const secret = await json(base, "/api/han/worker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "status", 京准通主账户ID: "9001", 京准通Cookie状态: "pt_key=this-is-a-cookie-body-not-a-status" }),
    });
    assert.equal(secret.res.status, 400);
    const snapped = await json(base, "/api/han/worker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: [{ 店铺名称: "新建测试店", 京准通主账户ID: "9001", 花费: 1, 京准通Cookie状态: "正常", 京麦Cookie状态: "过期", 执行状态: "运行中" }] }),
    });
    assert.equal(snapped.res.status, 201);
    const afterSnap = await json(base, "/api/han/worker?view=rules");
    const snappedShop = afterSnap.body.shopRuns.find((row) => row.accountId === "9001");
    assert.equal(snappedShop.jztCookieStatus, "正常");
    assert.equal(snappedShop.jmCookieStatus, "过期");
    assert.equal(snappedShop.runStatus, "运行中");
    const ignored = await json(base, "/api/han/worker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: [{ 店铺名称: "新建测试店", 京准通主账户ID: "9001", 花费: 2, 京准通Cookie状态: "pt_key=not-a-status" }] }),
    });
    assert.equal(ignored.res.status, 201);
    const kept = await json(base, "/api/han/worker?view=rules");
    assert.equal(kept.body.shopRuns.find((row) => row.accountId === "9001").jztCookieStatus, "正常");
    const idle = await json(base, "/api/han/worker?machineId=han-worker-01&sinceVersion=99999");
    assert.equal(idle.body.changed, false);
    assert.equal(idle.body.shops, undefined);
    const beat = await json(base, "/api/han/worker?view=rules");
    const beatShop = beat.body.shopRuns.find((row) => row.accountId === "9001");
    assert.ok(beatShop.heartbeatAt);
    assert.equal(beatShop.workerStatus, "在线");
    assert.equal(beatShop.runStatus, "运行中");
    assert.equal(beatShop.jztCookieStatus, "正常");
  });
});

test("nested shop and subaccount recharge rows show on the shop drill-down", async () => {
  await withServer(async (base) => {
    const pushed = await json(base, "/api/han/worker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        capturedAt: "2026-10-03T18:30:00+08:00",
        rows: [
          {
            店铺名称: "风巢家居专营店",
            京准通主账户ID: "2066787424065384499",
            京准通花费: 100,
            子账号: [
              {
                子账号ID: "206456235676909569",
                子账号名称: "风巢家居专营-博品2",
                花费: 135.97,
                余额: 564.03,
                充值记录: [{ 充值金额: 300, 充值时间: "2026-10-03 12:10", 账户余额: 864.03, ruleCode: "tier1", result: "success" }],
              },
            ],
            充值记录: [{ 充值金额: 500, 充值时间: "2026-10-03 09:00", 账户余额: 1000, 子账号名称: "风巢-创2" }],
          },
        ],
      }),
    });
    assert.equal(pushed.res.status, 201);
    assert.equal(pushed.body.received.recharges, 2);
    assert.equal(pushed.body.received.subaccounts, 1);
    const shop = await json(base, "/api/han/worker?view=shop&store=" + encodeURIComponent("风巢家居专营店"));
    assert.equal(shop.body.subaccounts.length, 1);
    assert.equal(shop.body.recharges.length, 2);
    const nested = shop.body.recharges.find((row) => row.subAccountName === "风巢家居专营-博品2");
    assert.equal(nested.amount, 300);
    assert.equal(nested.subAccountId, "206456235676909569");
    assert.equal(nested.balance, 864.03);
    assert.equal(shop.body.recharges.some((row) => row.amount === 500 && row.subAccountName === "风巢-创2"), true);
  });
});

test("recharge lines are found under other keys and do not treat a subaccount as a recharge", async () => {
  await withServer(async (base) => {
    const pushed = await json(base, "/api/han/worker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        capturedAt: "2026-10-03T19:18:50+08:00",
        rows: [
          {
            店铺名称: "RASW个护电器旗舰店",
            京准通主账户ID: "995225226",
            京准通花费: 6895.61,
            日期: "2026-10-03",
            子账号: [
              {
                子账号ID: "2076865648966938625",
                子账号名称: "RASW个护电器-快4",
                花费: 220,
                余额: 0,
                充值流水: [
                  { 充值金额: "300元", 充值时间: "2026-10-03 18:10", 账户余额: 520, result: "success", ruleCode: "tier1" },
                ],
              },
              {
                子账号ID: "2075537314567860226",
                子账号名称: "RASW个护电器-快6",
                花费: 1300,
                充值纪录: JSON.stringify([
                  { amount: 80, time: "2026-10-03 11:02", balance: 90, 执行结果: "success" },
                ]),
              },
            ],
          },
        ],
        logs: {
          one: { executionId: "exec-rasw-1", 充值金额: 50, 充值时间: "2026-10-03 16:00", 子账号名称: "RASW个护-快13" },
        },
      }),
    });
    assert.equal(pushed.res.status, 201);
    assert.equal(pushed.body.received.subaccounts, 2);
    assert.equal(pushed.body.received.recharges, 3);
    const shop = await json(base, "/api/han/worker?view=shop&store=" + encodeURIComponent("RASW个护电器旗舰店"));
    assert.equal(shop.body.recharges.length, 3);
    const flow = shop.body.recharges.find((row) => row.subAccountName === "RASW个护电器-快4");
    assert.equal(flow.amount, 300);
    assert.equal(flow.subAccountId, "2076865648966938625");
    assert.equal(flow.balance, 520);
    const recorded = shop.body.recharges.find((row) => row.subAccountName === "RASW个护电器-快6");
    assert.equal(recorded.amount, 80);
    const mapped = shop.body.recharges.find((row) => row.executionId === "exec-rasw-1");
    assert.equal(mapped.amount, 50);
    assert.equal(mapped.subAccountName, "RASW个护-快13");
  });
});

test("stopped shops still deliver full subaccount rules and sync only issued rows", async () => {
  await withServer(async (base) => {
    const pushed = await json(base, "/api/han/worker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: [
          { 店铺名称: "松郁", 京准通主账户ID: "88001", 花费: 10 },
          { 店铺名称: "另一家店", 京准通主账户ID: "88002", 花费: 20 },
        ],
        subaccounts: [
          { 店铺名称: "松郁", 京准通主账户ID: "88001", 子账号ID: "88011", 子账号名称: "松郁-主投", 花费: 10, ROI: 1, 余额: 20 },
          { 店铺名称: "另一家店", 京准通主账户ID: "88002", 子账号ID: "88022", 子账号名称: "另一-主投", 花费: 20, ROI: 1, 余额: 20 },
        ],
      }),
    });
    assert.equal(pushed.res.status, 201);

    const stopped = await json(base, "/api/han/worker", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "run", runShops: [], changeSummary: "停止全部店铺" }),
    });
    assert.equal(stopped.body.ok, true);

    const saved = await json(base, "/api/han/worker", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "rules",
        changeSummary: "松郁计划ROI改为2.1",
        rows: [{ store: "松郁", accountId: "88001", subAccountId: "88011", 计划ROI: 2.1, 自动充值: true }],
      }),
    });
    assert.equal(saved.res.status, 200);
    const version = saved.body.version;
    assert.ok(version > stopped.body.version);

    const premature = await json(base, "/api/han/worker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ack", machineId: "han-worker-01", version, status: "success" }),
    });
    assert.equal(premature.body.status, "已同步");
    const beforePull = await json(base, "/api/han/worker?view=rules");
    assert.equal(beforePull.body.rows.find((row) => row.subAccountId === "88011").syncStatus, "待同步");
    assert.equal(beforePull.body.syncStatus, "待同步");

    const config = await json(base, "/api/han/worker?machineId=han-worker-01&sinceVersion=0");
    assert.equal(config.body.changed, true);
    assert.equal(config.body.version, version);
    assert.deepEqual(config.body.runShops, []);
    const song = config.body.shops.find((shop) => shop.店铺名称 === "松郁");
    const other = config.body.shops.find((shop) => shop.店铺名称 === "另一家店");
    assert.ok(song);
    assert.ok(other);
    assert.equal(song.启用, false);
    assert.equal(song.京准通主账户ID, "88001");
    const sub = song.子账号.find((row) => row.子账号ID === "88011");
    assert.equal(sub.子账号名称, "松郁-主投");
    assert.equal(sub.自动充值, true);
    assert.equal(sub.计划ROI, 2.1);
    assert.equal(sub.第一档花费下限, 1);
    assert.equal(sub.第一档花费上限, 1000);
    assert.equal(sub.第一档余额阈值, 100);
    assert.equal(sub.第一档充值金额, 100);
    assert.equal(sub.第二档花费下限, 1000);
    assert.equal(sub.第二档余额阈值, 50);
    assert.equal(sub.第二档充值金额, 150);
    assert.equal(sub.ROI上涨充值金额, 100);
    assert.equal(sub.连续充值未增单次数, 3);
    assert.equal(sub.暂停分钟数, 30);
    assert.equal(other.子账号[0].子账号ID, "88022");
    assert.equal(other.子账号[0].计划ROI, 2);

    const extra = await json(base, "/api/han/worker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subaccounts: [
          { 店铺名称: "松郁", 京准通主账户ID: "88001", 子账号ID: "88011", 子账号名称: "松郁-主投", 花费: 10, ROI: 1, 余额: 20 },
          { 店铺名称: "松郁", 京准通主账户ID: "88001", 子账号ID: "88012", 子账号名称: "松郁-未下发", 花费: 1, ROI: 1, 余额: 1 },
        ],
      }),
    });
    assert.equal(extra.res.status, 201);

    const ack = await json(base, "/api/han/worker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ack", machineId: "han-worker-01", version, status: "success" }),
    });
    assert.equal(ack.body.status, "已同步");
    const rules = await json(base, "/api/han/worker?view=rules");
    assert.equal(rules.body.rows.find((row) => row.subAccountId === "88011").syncStatus, "已同步");
    assert.equal(rules.body.rows.find((row) => row.subAccountId === "88011").plannedRoi, 2.1);
    assert.equal(rules.body.rows.find((row) => row.subAccountId === "88022").syncStatus, "已同步");
    assert.equal(rules.body.rows.find((row) => row.subAccountId === "88012").syncStatus, "待同步");
    assert.equal(rules.body.syncStatus, "待同步");
  });
});

test("running shop still receives an edited ROI on the next pull", async () => {
  await withServer(async (base) => {
    const pushed = await json(base, "/api/han/worker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: [{ 店铺名称: "松郁", 京准通主账户ID: "88001", 花费: 10 }],
        subaccounts: [
          { 店铺名称: "松郁", 京准通主账户ID: "88001", 子账号ID: "88011", 子账号名称: "松郁-主投", 花费: 10, ROI: 1, 余额: 20 },
        ],
      }),
    });
    assert.equal(pushed.res.status, 201);
    const run = await json(base, "/api/han/worker", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "run", runShops: ["松郁"], changeSummary: "开启松郁" }),
    });
    assert.equal(run.body.ok, true);
    const saved = await json(base, "/api/han/worker", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "rules",
        changeSummary: "运行中改计划ROI",
        rows: [{ store: "松郁", accountId: "88001", subAccountId: "88011", 计划ROI: 2.1, 自动充值: true }],
      }),
    });
    assert.equal(saved.res.status, 200);
    assert.ok(saved.body.version > run.body.version);
    const config = await json(base, "/api/han/worker?machineId=han-worker-01");
    assert.deepEqual(config.body.runShops, ["88001"]);
    const shop = config.body.shops.find((item) => item.店铺名称 === "松郁");
    assert.equal(shop.启用, true);
    assert.equal(shop.子账号[0].计划ROI, 2.1);
    assert.match(config.body.note, /不用停店/);
    const typed = await json(base, "/api/han/worker", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sub", op: "update", 京准通主账户ID: "88001", 子账号ID: "88011", 子账号名称: "松郁-主投", 自动充值: true, 计划ROI: "2.6" }),
    });
    assert.equal(typed.body.ok, true);
    const again = await json(base, "/api/han/worker?machineId=han-worker-01");
    assert.deepEqual(again.body.runShops, ["88001"]);
    assert.equal(again.body.shops.find((item) => item.店铺名称 === "松郁").子账号[0].计划ROI, 2.6);
  });
});

test("batch ROI, amount, and paid switch reach the local machine snapshot", async () => {
  await withServer(async (base) => {
    const subId = "1234567890123456789";
    const otherId = "1234567890123456790";
    const pushed = await json(base, "/api/han/worker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: [{ 店铺名称: "松郁汽车用品专营店", 京准通主账户ID: "99920461182", 花费: 10 }],
        subaccounts: [
          { 店铺名称: "松郁汽车用品专营店", 京准通主账户ID: "99920461182", 子账号ID: subId, 子账号名称: "松郁-五七", 花费: 10, ROI: 1, 余额: 20 },
          { 店铺名称: "松郁汽车用品专营店", 京准通主账户ID: "99920461182", 子账号ID: otherId, 子账号名称: "松郁-五八", 花费: 8, ROI: 1, 余额: 20 },
        ],
      }),
    });
    assert.equal(pushed.res.status, 201);

    function ruleRow(id, name, extra) {
      return {
        店铺名称: "松郁汽车用品专营店",
        京准通主账户ID: "99920461182",
        子账号ID: id,
        子账号名称: name,
        自动充值: true,
        计划ROI: 2,
        第一档花费下限: 1,
        第一档花费上限: 1000,
        第一档余额阈值: 100,
        第一档充值金额: 100,
        第二档花费下限: 1000,
        第二档余额阈值: 50,
        第二档充值金额: 150,
        ROI上涨充值金额: 100,
        连续充值未增单次数: 3,
        暂停分钟数: 30,
        ...extra,
      };
    }

    const roi = await json(base, "/api/han/worker", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "rules",
        changeSummary: "批量改ROI",
        rows: [ruleRow(subId, "松郁-五七", { 计划ROI: "2.1" }), ruleRow(otherId, "松郁-五八", { 计划ROI: "2.1" })],
      }),
    });
    assert.equal(roi.res.status, 200);
    const afterRoi = await json(base, "/api/han/worker?machineId=han-worker-01");
    assert.equal(afterRoi.body.fullSnapshot, true);
    assert.equal(afterRoi.body.changeSummary, "批量改ROI");
    assert.deepEqual(afterRoi.body.deletedShopIds, []);
    assert.deepEqual(afterRoi.body.deletedSubAccounts, []);
    const roiShop = afterRoi.body.shops.find((shop) => shop.店铺名称 === "松郁汽车用品专营店");
    assert.equal(roiShop.子账号.find((row) => row.子账号ID === subId).计划ROI, 2.1);
    assert.equal(roiShop.子账号.find((row) => row.子账号ID === otherId).计划ROI, 2.1);
    assert.equal(roiShop.子账号.find((row) => row.子账号ID === subId).第一档充值金额, 100);

    const amount = await json(base, "/api/han/worker", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "rules",
        changeSummary: "批量改一档充值",
        rows: [ruleRow(subId, "松郁-五七", { 计划ROI: "2.1", 第一档充值金额: "80", 第二档充值金额: "220", ROI上涨充值金额: "60" })],
      }),
    });
    assert.equal(amount.res.status, 200);
    const afterAmount = await json(base, "/api/han/worker?machineId=han-worker-01");
    const amountSub = afterAmount.body.shops[0].子账号.find((row) => row.子账号ID === subId);
    const untouched = afterAmount.body.shops[0].子账号.find((row) => row.子账号ID === otherId);
    assert.equal(afterAmount.body.changeSummary, "批量改一档充值");
    assert.equal(amountSub.第一档充值金额, 80);
    assert.equal(amountSub.第二档充值金额, 220);
    assert.equal(amountSub.ROI上涨充值金额, 60);
    assert.equal(amountSub.计划ROI, 2.1);
    assert.equal(amountSub.自动充值, true);
    assert.equal(untouched.第一档充值金额, 100);
    assert.equal(untouched.计划ROI, 2.1);

    const off = await json(base, "/api/han/worker", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "rules",
        changeSummary: "批量关付费",
        rows: [ruleRow(subId, "松郁-五七", { 自动充值: false, 计划ROI: "2.1", 第一档充值金额: "80", 第二档充值金额: "220", ROI上涨充值金额: "60" })],
      }),
    });
    assert.equal(off.res.status, 200);
    const on = await json(base, "/api/han/worker", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "rules",
        changeSummary: "批量开付费",
        rows: [ruleRow(otherId, "松郁-五八", { 自动充值: true, 计划ROI: "3" })],
      }),
    });
    assert.equal(on.res.status, 200);
    const afterSwitch = await json(base, "/api/han/worker?machineId=han-worker-01");
    assert.equal(afterSwitch.body.fullSnapshot, true);
    assert.equal(afterSwitch.body.changeSummary, "批量开付费");
    assert.match(afterSwitch.body.note, /批量改ROI/);
    assert.match(afterSwitch.body.note, /批量关付费/);
    const switched = afterSwitch.body.shops[0].子账号;
    assert.equal(switched.find((row) => row.子账号ID === subId).自动充值, false);
    assert.equal(switched.find((row) => row.子账号ID === subId).计划ROI, 2.1);
    assert.equal(switched.find((row) => row.子账号ID === subId).第一档充值金额, 80);
    assert.equal(switched.find((row) => row.子账号ID === subId).第二档充值金额, 220);
    assert.equal(switched.find((row) => row.子账号ID === subId).ROI上涨充值金额, 60);
    assert.equal(switched.find((row) => row.子账号ID === otherId).自动充值, true);
    assert.equal(switched.find((row) => row.子账号ID === otherId).计划ROI, 3);
    assert.equal(switched.find((row) => row.子账号ID === subId).子账号ID, subId);

    const removed = await json(base, "/api/han/worker", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sub", op: "delete", 京准通主账户ID: "99920461182", 子账号ID: otherId }),
    });
    assert.equal(removed.body.ok, true);
    const afterDelete = await json(base, "/api/han/worker?machineId=han-worker-01");
    assert.equal(afterDelete.body.shops[0].子账号.some((row) => row.子账号ID === otherId), false);
    assert.deepEqual(afterDelete.body.deletedSubAccounts, [{ 京准通主账户ID: "99920461182", 子账号ID: otherId }]);
    const same = await json(base, "/api/han/worker?machineId=han-worker-01&sinceVersion=" + afterDelete.body.version);
    assert.equal(same.body.changed, false);
    assert.equal(same.body.fullSnapshot, undefined);
  });
});

test("recharge window follows Shanghai clock, including overnight", () => {
  assert.equal(rechargeWindowOpen("08:00", "23:00", 8 * 60), true);
  assert.equal(rechargeWindowOpen("08:00", "23:00", 22 * 60 + 59), true);
  assert.equal(rechargeWindowOpen("08:00", "23:00", 23 * 60), false);
  assert.equal(rechargeWindowOpen("08:00", "23:00", 7 * 60 + 59), false);
  assert.equal(rechargeWindowOpen("22:00", "06:00", 23 * 60), true);
  assert.equal(rechargeWindowOpen("22:00", "06:00", 5 * 60), true);
  assert.equal(rechargeWindowOpen("22:00", "06:00", 12 * 60), false);
  assert.equal(rechargeWindowOpen("08:00", "08:00", 8 * 60), null);
  assert.equal(rechargeWindowOpen("", "23:00", 10 * 60), null);
  assert.equal(shanghaiMinutes(new Date("2026-10-03T23:30:00+08:00")), 23 * 60 + 30);
  assert.equal(shanghaiMinutes(new Date("2026-10-03T00:05:00+08:00")), 5);
});

test("scheduled recharge turns off at night and back on in the morning", async () => {
  await withServer(async (base) => {
    const subId = "1234567890123456789";
    const pushed = await json(base, "/api/han/worker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: [{ 店铺名称: "松郁汽车用品专营店", 京准通主账户ID: "99920461182", 花费: 10 }],
        subaccounts: [
          { 店铺名称: "松郁汽车用品专营店", 京准通主账户ID: "99920461182", 子账号ID: subId, 子账号名称: "松郁-五七", 花费: 10, ROI: 1, 余额: 20 },
        ],
      }),
    });
    assert.equal(pushed.res.status, 201);
    const RealDate = Date;
    function useClock(hm) {
      const fixed = new RealDate(`2026-10-03T${hm}:00+08:00`);
      function FakeDate(...args) {
        if (new.target) {
          if (args.length === 0) return new RealDate(fixed.getTime());
          return new RealDate(...args);
        }
        return RealDate();
      }
      FakeDate.prototype = RealDate.prototype;
      FakeDate.now = () => fixed.getTime();
      FakeDate.parse = RealDate.parse;
      FakeDate.UTC = RealDate.UTC;
      globalThis.Date = FakeDate;
    }
    try {
      const row = {
        店铺名称: "松郁汽车用品专营店",
        京准通主账户ID: "99920461182",
        子账号ID: subId,
        子账号名称: "松郁-五七",
        自动充值: true,
        计划ROI: 2,
        第一档花费下限: 1,
        第一档花费上限: 1000,
        第一档余额阈值: 100,
        第一档充值金额: 100,
        第二档花费下限: 1000,
        第二档余额阈值: 50,
        第二档充值金额: 150,
        ROI上涨充值金额: 100,
        连续充值未增单次数: 3,
        暂停分钟数: 30,
        开充值时间: "08:00",
        关充值时间: "23:00",
      };
      const saved = await json(base, "/api/han/worker", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rules", changeSummary: "按时间开关充值 08:00-23:00", rows: [row] }),
      });
      assert.equal(saved.res.status, 200);
      useClock("15:00");
      const day = await json(base, "/api/han/worker?machineId=han-worker-01");
      const daySub = day.body.shops[0].子账号[0];
      assert.equal(daySub.自动充值, true);
      assert.equal(daySub.开充值时间, "08:00");
      assert.equal(daySub.关充值时间, "23:00");
      assert.equal(daySub.运行, true);
      assert.deepEqual(day.body.runShops, ["99920461182"]);
      const quiet = await json(base, "/api/han/worker?machineId=han-worker-01&sinceVersion=" + day.body.version);
      assert.equal(quiet.body.changed, false);
      useClock("23:30");
      const night = await json(base, "/api/han/worker?machineId=han-worker-01&sinceVersion=" + day.body.version);
      assert.equal(night.body.changed, true);
      assert.ok(night.body.version > day.body.version);
      assert.equal(night.body.shops[0].子账号[0].自动充值, false);
      assert.equal(night.body.shops[0].子账号[0].运行, true);
      assert.deepEqual(night.body.runShops, ["99920461182"]);
      assert.match(night.body.changeSummary, /定时关充值/);
      assert.match(night.body.note, /不要充值/);
      const rules = await json(base, "/api/han/worker?view=rules");
      assert.equal(rules.body.rows[0].autoRecharge, false);
      assert.equal(rules.body.rows[0].rechargeStart, "08:00");
      assert.equal(rules.body.rows[0].rechargeEnd, "23:00");
      useClock("08:00");
      const morning = await json(base, "/api/han/worker?machineId=han-worker-01&sinceVersion=" + night.body.version);
      assert.equal(morning.body.changed, true);
      assert.equal(morning.body.shops[0].子账号[0].自动充值, true);
      assert.match(morning.body.changeSummary, /定时开充值/);
      const cleared = await json(base, "/api/han/worker", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rules",
          changeSummary: "批量关付费",
          rows: [{ ...row, 自动充值: false, 开充值时间: "", 关充值时间: "" }],
        }),
      });
      assert.equal(cleared.res.status, 200);
      useClock("15:00");
      const stayed = await json(base, "/api/han/worker?machineId=han-worker-01");
      assert.equal(stayed.body.shops[0].子账号[0].自动充值, false);
      assert.equal(stayed.body.shops[0].子账号[0].开充值时间, "");
      const bad = await json(base, "/api/han/worker", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rules",
          rows: [{ ...row, 开充值时间: "08:00", 关充值时间: "08:00" }],
        }),
      });
      assert.equal(bad.res.status, 400);
      const overnight = await json(base, "/api/han/worker", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rules",
          changeSummary: "按时间开关充值 22:00-06:00",
          rows: [{ ...row, 自动充值: false, 开充值时间: "22:00", 关充值时间: "06:00" }],
        }),
      });
      assert.equal(overnight.res.status, 200);
      useClock("23:00");
      const late = await json(base, "/api/han/worker?view=rules");
      assert.equal(late.body.rows[0].autoRecharge, true);
      useClock("12:00");
      const noon = await json(base, "/api/han/worker?view=rules");
      assert.equal(noon.body.rows[0].autoRecharge, false);
      assert.equal(noon.body.rows[0].rechargeStart, "22:00");
    } finally {
      globalThis.Date = RealDate;
    }
  });
});

test("韩梦凯侧栏包含付费中心和充值规则", async () => {
  const { readFile } = await import("node:fs/promises");
  const nav = await readFile(new URL("../public/shared/nav.js", import.meta.url), "utf8");
  const hanStart = nav.indexOf("const HAN_CHILDREN");
  const hanEnd = nav.indexOf("const ACADEMY_CHILDREN");
  const block = nav.slice(hanStart, hanEnd);
  assert.match(block, /\/han\/paid-center/);
  assert.match(block, /付费中心/);
  assert.match(block, /\/han\/recharge-rules/);
  assert.match(block, /充值规则/);
  assert.match(nav, /"\/han\/paid-center": "han"/);
  assert.match(nav, /"\/han\/recharge-rules": "han"/);
  const han = await readFile(new URL("../public/shared/modules/han.js", import.meta.url), "utf8");
  assert.match(han, /\["\/han\/paid\?board=center", "付费中心", "center"\]/);
  assert.match(han, /\["\/han\/paid\?board=rules", "充值规则", "rules"\]/);
  assert.match(han, /20261003-asof/);
  const center = await readFile(new URL("../public/shared/modules/han-center.js", import.meta.url), "utf8");
  assert.match(center, /两档花费/);
  assert.match(center, /han-rules-text/);
  assert.match(center, /han-rules-cell/);
  assert.match(center, /han-rules-live/);
  assert.match(center, /han-rules-pager/);
  assert.match(center, /data-check-all/);
  assert.match(center, /批量改ROI/);
  assert.match(center, /han-rules-batch-status/);
  assert.match(center, /灰字示例不会保存/);
  assert.match(center, /批量改金额/);
  assert.match(center, /批量开付费/);
  assert.match(center, /按时间开关/);
  assert.match(center, /han-rules-open-at/);
  assert.match(center, /han-rules-close-at/);
  assert.match(center, /取消定时/);
  assert.match(center, /定时充值/);
  assert.match(center, /只跑选中子账号/);
  assert.match(center, /恢复整店跑/);
  assert.match(center, /只跑京麦/);
  assert.match(center, /恢复京准通/);
  assert.match(center, /selectedShopNames/);
  assert.doesNotMatch(center, /han-rules-run-save/);
  assert.match(center, /han-rules-running/);
  assert.match(center, /han-rules-name/);
  assert.match(center, /han-rules-filters/);
  assert.match(center, /refreshShopStatus/);
  assert.match(center, /data-run-label/);
  assert.doesNotMatch(center, /data-field="subAccountName"/);
  assert.doesNotMatch(center, /\["子账号ID", "子账号ID"\]/);
  assert.match(center, /searchTimer/);
  assert.doesNotMatch(center, /han-rules-scroller/);
  assert.match(center, /span\.han-rules-cell/);
  assert.doesNotMatch(center, /button\.han-rules-cell/);
  assert.match(center, /ruleSignature/);
  assert.match(center, /i \+= 30/);
  assert.match(han, /insertAdjacentElement\("afterend"/);
  assert.match(han, /data-xm-group"\) !== "\/han"/);
  assert.doesNotMatch(han, /anchor\.href = "\/han\/paid-center"/);
  assert.match(center, /20261003-asof/);
  assert.match(center, /aria-label="主管分组"/);
  assert.match(center, /han-live-bar/);
  assert.match(center, /han-live-tabs/);
  assert.match(center, /han-live-grid/);
  assert.doesNotMatch(center, /和沈子晗付费中心同一套回传字段/);
  assert.match(center, /han-live-group/);
  assert.doesNotMatch(center, /按主管查看/);
  assert.doesNotMatch(center, /han-live-tools/);
  assert.doesNotMatch(center, /<h1>实时付费<\/h1>/);
  assert.match(center, /京准通花费/);
  assert.match(center, /board === "live"/);
  assert.match(center, /\/api\/han\/shops\?team=/);
  assert.match(center, /han-paid-board/);
  assert.match(center, /京麦成交金额/);
  assert.match(center, /真实费比/);
  assert.match(center, /function feeRatio/);
  assert.match(center, /function salesOf/);
  assert.match(center, /salesOf\(pageRowsNow\)/);
  assert.match(center, /\(n \* 100\)\.toFixed\(2\) \+ "%"/);
  assert.match(center, /feeText\(row\.spend, row\.jingmaiGmv\)/);
  assert.match(center, /feeOf\(pageRowsNow\)/);
  assert.match(center, /责权归属/);
  assert.match(center, /表头设置/);
  assert.match(center, /实时付费接入店铺数量/);
  assert.match(center, /data-sub-sort/);
  assert.match(center, /data-sub-note/);
  assert.match(center, /action: "remark"/);
  assert.match(center, /subSortDir === "desc" \? "asc" : "desc"/);
  assert.match(center, /id="han-sub-table"/);
  assert.match(center, /card\.key === "ad"/);
  assert.match(center, /card\.key === "roi"/);
  assert.match(center, /pageAmount \/ pageSpend\)\.toFixed\(2\)/);
  assert.match(center, /更新于 /);
  assert.match(center, /function clockText/);
  assert.match(center, /推广占比 /);
  assert.doesNotMatch(center, /推广花费 \(支付预估\)/);
  assert.match(center, /付费成交ROI/);
  assert.match(center, /实时付费成交额/);
  assert.match(center, /线：累计（23点=1-23点）/);
  assert.match(center, /线：当天费比/);
  assert.match(center, /id="han-paid-kpis" hidden/);
  assert.match(center, /#han-paid-kpis\[hidden\]\{display:none!important\}/);
  assert.match(center, /#han-paid-board\[hidden\]\{display:none!important\}/);
  assert.match(center, /\/api\/home\/erp-paid/);
  assert.match(center, /function liveScope/);
  assert.match(center, /liveModel\(erpPayload, liveScope\(\)\)/);
  assert.match(center, /function boardShopNames/);
  assert.doesNotMatch(center, /summary\.todayPayAmount/);
  assert.match(han, /params\.get\("liveShop"\)/);
  assert.match(han, /window\.__hanGo = goHanPage/);
});

test("selected subaccounts are the only ones marked running", async () => {
  await withServer(async (base) => {
    const a1 = "1234567890123456789";
    const a2 = "1234567890123456790";
    const b1 = "2234567890123456789";
    const b2 = "2234567890123456790";
    const pushed = await json(base, "/api/han/worker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: [
          { 店铺名称: "甲店", 京准通主账户ID: "10001", 花费: 10 },
          { 店铺名称: "乙店", 京准通主账户ID: "10002", 花费: 8 },
        ],
        subaccounts: [
          { 店铺名称: "甲店", 京准通主账户ID: "10001", 子账号ID: a1, 子账号名称: "甲-一", 花费: 10, ROI: 1, 余额: 20 },
          { 店铺名称: "甲店", 京准通主账户ID: "10001", 子账号ID: a2, 子账号名称: "甲-二", 花费: 8, ROI: 1, 余额: 20 },
          { 店铺名称: "乙店", 京准通主账户ID: "10002", 子账号ID: b1, 子账号名称: "乙-一", 花费: 6, ROI: 1, 余额: 20 },
          { 店铺名称: "乙店", 京准通主账户ID: "10002", 子账号ID: b2, 子账号名称: "乙-二", 花费: 4, ROI: 1, 余额: 20 },
        ],
      }),
    });
    assert.equal(pushed.res.status, 201);

    const stopped = await json(base, "/api/han/worker", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "run", runShops: [], changeSummary: "停止全部店铺" }),
    });
    assert.equal(stopped.body.ok, true);

    const empty = await json(base, "/api/han/worker", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "runSubs", runSubs: [], changeSummary: "只跑选中子账号" }),
    });
    assert.equal(empty.res.status, 400);
    assert.match(empty.body.error, /请先勾选要跑的子账号/);

    const missing = await json(base, "/api/han/worker", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "runSubs",
        runSubs: [{ 店铺名称: "甲店", 京准通主账户ID: "10001", 子账号ID: "999" }],
      }),
    });
    assert.equal(missing.res.status, 400);
    assert.match(missing.body.error, /找不到要跑的子账号/);

    const picked = await json(base, "/api/han/worker", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "runSubs",
        changeSummary: "只跑选中子账号",
        runSubs: [{ 店铺名称: "甲店", 京准通主账户ID: "10001", 子账号ID: a1 }],
      }),
    });
    assert.equal(picked.body.ok, true);

    const config = await json(base, "/api/han/worker?machineId=han-worker-01");
    assert.equal(config.body.runMode, "sub");
    assert.equal(config.body.changeSummary, "只跑选中子账号");
    assert.deepEqual(config.body.runShops, ["10001"]);
    assert.deepEqual(config.body.runSubs, [{ 京准通主账户ID: "10001", 子账号ID: a1 }]);
    const shopA = config.body.shops.find((shop) => shop.店铺名称 === "甲店");
    const shopB = config.body.shops.find((shop) => shop.店铺名称 === "乙店");
    assert.equal(shopA.启用, true);
    assert.equal(shopB.启用, false);
    assert.equal(shopA.子账号.find((row) => row.子账号ID === a1).运行, true);
    assert.equal(shopA.子账号.find((row) => row.子账号ID === a2).运行, false);
    assert.equal(shopB.子账号.every((row) => row.运行 === false), true);
    assert.equal(shopA.子账号.length, 2);
    assert.equal(shopB.子账号.length, 2);
    assert.equal(typeof shopA.子账号.find((row) => row.子账号ID === a1).子账号ID, "string");
    assert.match(config.body.note, /不用停店/);
    assert.match(config.body.note, /runSubs/);

    const rules = await json(base, "/api/han/worker?view=rules");
    assert.equal(rules.body.runSubMode, true);
    assert.equal(rules.body.rows.find((row) => row.subAccountId === a1).subRunning, true);
    assert.equal(rules.body.rows.find((row) => row.subAccountId === a2).subRunning, false);
    assert.equal(rules.body.rows.find((row) => row.subAccountId === b1).subRunning, false);
    assert.equal(rules.body.shopRuns.find((row) => row.store === "甲店").enabled, true);
    assert.equal(rules.body.shopRuns.find((row) => row.store === "乙店").enabled, false);

    const cleared = await json(base, "/api/han/worker", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "runSubs", clear: true, changeSummary: "恢复整店跑" }),
    });
    assert.equal(cleared.body.ok, true);
    const shopMode = await json(base, "/api/han/worker?machineId=han-worker-01");
    assert.equal(shopMode.body.runMode, "shop");
    assert.deepEqual(shopMode.body.runShops, ["10001"]);
    const againA = shopMode.body.shops.find((shop) => shop.店铺名称 === "甲店");
    const againB = shopMode.body.shops.find((shop) => shop.店铺名称 === "乙店");
    assert.equal(againA.子账号.find((row) => row.子账号ID === a1).运行, true);
    assert.equal(againA.子账号.find((row) => row.子账号ID === a2).运行, true);
    assert.equal(againB.启用, false);
    assert.equal(againB.子账号.every((row) => row.运行 === false), true);
    const rulesAgain = await json(base, "/api/han/worker?view=rules");
    assert.equal(rulesAgain.body.runSubMode, false);
    assert.equal(rulesAgain.body.rows.every((row) => row.subRunning === false), true);
  });
});

test("jingmai-only mode keeps the shop list and tells the machine to skip 京准通", async () => {
  await withServer(async (base) => {
    const pushed = await json(base, "/api/han/worker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: [{ 店铺名称: "松郁", 京准通主账户ID: "88001", 京麦成交金额: 3600, 花费: 80 }],
        subaccounts: [
          { 店铺名称: "松郁", 京准通主账户ID: "88001", 子账号ID: "88011", 子账号名称: "松郁-主投", 花费: 80, ROI: 1, 余额: 20 },
        ],
      }),
    });
    assert.equal(pushed.res.status, 201);
    const run = await json(base, "/api/han/worker", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "run", runShops: ["松郁"], changeSummary: "开启松郁" }),
    });
    assert.equal(run.body.ok, true);
    const before = await json(base, "/api/han/worker?machineId=han-worker-01");
    assert.equal(before.body.runScope, "all");
    assert.equal(before.body.只跑京麦, false);
    assert.deepEqual(before.body.runShops, ["88001"]);

    const missing = await json(base, "/api/han/worker", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "jingmai" }),
    });
    assert.equal(missing.res.status, 400);

    const only = await json(base, "/api/han/worker", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "jingmai", enabled: true, changeSummary: "只跑京麦" }),
    });
    assert.equal(only.body.ok, true);
    const config = await json(base, "/api/han/worker?machineId=han-worker-01");
    assert.equal(config.body.runScope, "jingmai");
    assert.equal(config.body.只跑京麦, true);
    assert.equal(config.body.changeSummary, "只跑京麦");
    assert.deepEqual(config.body.runShops, ["88001"]);
    const jingmaiShop = config.body.shops.find((shop) => shop.店铺名称 === "松郁");
    assert.equal(jingmaiShop.子账号.length, 1);
    assert.equal(jingmaiShop.启用, true);
    assert.equal(jingmaiShop.子账号[0].运行, false);
    assert.match(config.body.note, /不用停店/);
    assert.match(config.body.note, /只跑京麦/);
    assert.match(config.body.note, /不要打开京准通/);
    const rules = await json(base, "/api/han/worker?view=rules");
    assert.equal(rules.body.jingmaiOnly, true);
    assert.equal(rules.body.runScope, "jingmai");
    assert.equal(rules.body.shopRuns.find((row) => row.store === "松郁").enabled, true);

    const back = await json(base, "/api/han/worker", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "jingmai", enabled: false, changeSummary: "恢复京准通" }),
    });
    assert.equal(back.body.ok, true);
    const again = await json(base, "/api/han/worker?machineId=han-worker-01");
    assert.equal(again.body.runScope, "all");
    assert.equal(again.body.只跑京麦, false);
    assert.deepEqual(again.body.runShops, ["88001"]);
    assert.equal(again.body.shops.find((shop) => shop.店铺名称 === "松郁").子账号[0].运行, true);

    const stopped = await json(base, "/api/han/worker", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "run", runShops: [], changeSummary: "停止全部店铺" }),
    });
    assert.equal(stopped.body.ok, true);
    const started = await json(base, "/api/han/worker", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "jingmai", enabled: true, changeSummary: "只跑京麦", runShops: ["松郁"] }),
    });
    assert.equal(started.body.ok, true);
    const live = await json(base, "/api/han/worker?machineId=han-worker-01");
    assert.equal(live.body.只跑京麦, true);
    assert.deepEqual(live.body.runShops, ["88001"]);
    assert.equal(live.body.shops.find((shop) => shop.店铺名称 === "松郁").子账号[0].运行, false);
    const startedRules = await json(base, "/api/han/worker?view=rules");
    assert.equal(startedRules.body.shopRuns.find((row) => row.store === "松郁").enabled, true);
  });
});

test("han schema uses prefixed tables", async () => {
  const { readFile } = await import("node:fs/promises");
  const sql = await readFile(new URL("../src/modules/han/schema.sql", import.meta.url), "utf8");
  assert.match(sql, /utf8mb4/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS han_tasks/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS han_brief/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS han_selection/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS han_products/);
  assert.match(sql, /spend_rate/);
  assert.match(sql, /gmv_7d/);
  assert.match(sql, /conv_rate/);
  assert.match(sql, /layer VARCHAR/);
  assert.match(sql, /\bspu VARCHAR/);
  assert.match(sql, /team_name/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS han_team_shops/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS han_shop_rules/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS han_shop_plans/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS han_picks/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS han_paid/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS han_training/);
  assert.match(sql, /store_name/);
  assert.doesNotMatch(sql, /CREATE TABLE IF NOT EXISTS users\b/);
  assert.doesNotMatch(sql, /CREATE TABLE IF NOT EXISTS releases\b/);
});
