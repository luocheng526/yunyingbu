import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createApp } from "../src/app.js";
import { createHanStore, dropProbeTasks, hydrateFromMysql, HAN_DEFAULT_OWNER, HAN_DEFAULT_STORE } from "../src/modules/han/store.js";
import { createHanFakePool } from "./han-fake-pool.js";

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
  assert.match(js, /头部产品/);
  assert.match(js, /中部产品/);
  assert.match(js, /尾部产品/);
  assert.match(js, /动销产品/);
  assert.match(js, /测新产品/);
  assert.match(js, /待做单产品/);
  assert.doesNotMatch(js, /han-layer-bar/);
  assert.doesNotMatch(js, /头部产品（高利润）/);
  assert.doesNotMatch(js, /新上架需做单产品/);
  assert.match(js, /XmModules\["\/han\/paid"\]/);
  assert.match(js, /XmModules\["\/han\/training"\]/);
  assert.match(js, /\/api\/han\/selection/);
  assert.match(js, /\/api\/han\/products/);
  assert.match(js, /\/api\/han\/paid/);
  assert.match(js, /\/api\/han\/training/);
  assert.match(js, /店/);
  assert.match(js, /培训系统/);
  assert.doesNotMatch(js, /内容待开发/);
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
  assert.match(sql, /layer VARCHAR/);
  assert.match(sql, /\bspu VARCHAR/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS han_paid/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS han_training/);
  assert.match(sql, /store_name/);
  assert.doesNotMatch(sql, /CREATE TABLE IF NOT EXISTS users\b/);
  assert.doesNotMatch(sql, /CREATE TABLE IF NOT EXISTS releases\b/);
});
