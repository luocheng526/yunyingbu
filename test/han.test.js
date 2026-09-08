import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createApp } from "../src/app.js";
import { createHanStore, HAN_DEFAULT_OWNER } from "../src/modules/han/store.js";
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
    assert.match(html, /选品数据/);
    assert.match(html, /商品数据/);
    assert.match(html, /付费数据/);
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
    const listedTasks = await json(base, "/api/han/tasks");
    assert.equal(listedSel.body.items.length, 1);
    assert.equal(listedProd.body.items.length, 1);
    assert.equal(listedPaid.body.items.length, 1);
    assert.equal(listedTasks.body.tasks.length, 0);
    assert.equal(listedSel.body.items[0].name, "春季防晒衣");
    assert.equal(listedProd.body.items[0].name, "防晒衣-白");
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
  assert.match(sql, /CREATE TABLE IF NOT EXISTS han_paid/);
  assert.doesNotMatch(sql, /CREATE TABLE IF NOT EXISTS users\b/);
  assert.doesNotMatch(sql, /CREATE TABLE IF NOT EXISTS releases\b/);
});
