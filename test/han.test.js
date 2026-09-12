import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createApp } from "../src/app.js";
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
  assert.match(js, /data-han-tab/);
  assert.match(js, /商品分层/);
  assert.match(js, /全部汇总/);
  assert.match(js, /本组汇总/);
  assert.match(js, /本组产品分层汇总/);
  assert.doesNotMatch(js, /本小组店铺/);
  assert.match(js, /han-store-cell/);
  assert.match(js, /unified: true/);
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
  assert.match(js, /han-paid-board/);
  assert.match(js, /han-paid-summary/);
  assert.match(js, /han-paid-group/);
  assert.match(js, /实时指标/);
  assert.match(js, /实时对比/);
  assert.match(js, /实时付费金额/);
  assert.match(js, /id="paid-form"/);
  assert.match(js, /XmModules\["\/han\/training"\]/);
  assert.match(js, /\/api\/han\/selection/);
  assert.match(js, /\/api\/han\/products/);
  assert.match(js, /\/api\/han\/paid/);
  assert.match(js, /\/api\/han\/paid\/import-file/);
  assert.match(js, /上传抓取表/);
  assert.match(js, /id="han-paid-import"/);
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
  assert.match(root.innerHTML, /汇总六个小组/);
  assert.match(root.innerHTML, /按统一规则分类/);
  assert.match(js, /店铺产品分层汇总/);
  assert.match(root.innerHTML, /陈晓曼组/);
  assert.match(root.innerHTML, /薛双双组/);
  assert.doesNotMatch(root.innerHTML, /本店分类规则/);
  sandbox.window.location.search = "?team=" + encodeURIComponent("陈晓曼组");
  sandbox.location.search = sandbox.window.location.search;
  sandbox.window.XmModules["/han/goods"].mount(root);
  assert.match(root.innerHTML, /全部店铺的分层/);
  assert.match(root.innerHTML, /按统一规则分类/);
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
