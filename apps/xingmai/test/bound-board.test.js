import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import vm from "node:vm";
import express from "express";
import { boundRouter } from "../src/modules/bound/router.js";
import { buildBoard, normalizeFilters } from "../src/modules/bound/store.js";

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

test("筛选只接受日期和短关键词", () => {
  assert.deepEqual(normalizeFilters({ from: "2026-11-02", to: "2026-11-01", q: "  站点  " }), {
    from: "2026-11-01",
    to: "2026-11-02",
    q: "站点"
  });
  assert.deepEqual(normalizeFilters({ from: "昨天", to: "2026-1-1", q: "x".repeat(120) }), {
    from: "",
    to: "",
    q: "x".repeat(80)
  });
});

test("空汇总标明爬虫且不是 ERP", () => {
  const board = buildBoard({ from: "", to: "", q: "" }, [], []);
  assert.equal(board.erp, false);
  assert.equal(board.source, "crawler");
  assert.equal(board.label, "爬虫，非 ERP");
  assert.equal(board.connected, false);
  assert.deepEqual(board.ownedTables, ["bound_batches", "bound_rows"]);
  assert.equal(board.tables.every((table) => table.rows.length === 0), true);
  assert.equal(board.kpis.find((item) => item.key === "batches").value, null);
  assert.match(board.note, /不读取、不转发、不展示/);
});

test("GET /api/bound 仍是爬虫标记，汇总台为空", async () => {
  const app = express();
  app.use(withUser({ username: "罗成", displayName: "罗成" }));
  app.use("/api/bound", boundRouter);
  const { base, close } = await listen(app);
  try {
    const stamp = await fetch(`${base}/api/bound`);
    assert.equal(stamp.status, 200);
    assert.deepEqual(await stamp.json(), { ok: true, module: "bound", source: "crawler", erp: false });
    const board = await fetch(`${base}/api/bound/board?from=2026-11-01&to=2026-11-16&q=店铺`);
    assert.equal(board.status, 200);
    const body = await board.json();
    assert.equal(body.erp, false);
    assert.equal(body.source, "crawler");
    assert.equal(body.label, "爬虫，非 ERP");
    assert.equal(body.connected, false);
    assert.deepEqual(body.filters, { from: "2026-11-01", to: "2026-11-16", q: "店铺" });
    assert.equal(body.tables.every((table) => table.rows.length === 0), true);
  } finally {
    await close();
  }
});

test("人事部账号打不开边界接口", async () => {
  const app = express();
  app.use(withUser({ username: "人事同事", desk: "hr" }));
  app.use("/api/bound", boundRouter);
  const { base, close } = await listen(app);
  try {
    const stamp = await fetch(`${base}/api/bound`);
    assert.equal(stamp.status, 403);
    const board = await fetch(`${base}/api/bound/board`);
    assert.equal(board.status, 403);
    const body = await board.json();
    assert.equal(body.erp, false);
    assert.match(body.error, /智能人事/);
  } finally {
    await close();
  }
});

test("页面只请求边界接口，并画出空汇总台", async () => {
  const js = readFileSync(clientPath, "utf8");
  const routerSrc = readFileSync(routerPath, "utf8");
  const storeSrc = readFileSync(storePath, "utf8");
  assert.match(js, /爬虫，非 ERP/);
  assert.match(js, /XmModules\["\/bound"\]/);
  assert.match(js, /暂无爬虫数据/);
  assert.doesNotMatch(js, /\/api\/data|\/api\/home|\/api\/shen|\/api\/han|jingmai/);
  assert.doesNotMatch(routerSrc, /modules\/data|modules\/shen|modules\/han|from \"\.\.\/home\/router|data\.js/);
  assert.doesNotMatch(storeSrc, /modules\/data|modules\/shen|modules\/han|\/api\/data|jingmai/);
  assert.match(storeSrc, /bound_batches/);
  assert.match(storeSrc, /bound_rows/);

  const calls = [];
  const styles = [];
  const document = {
    getElementById(id) {
      return styles.find((item) => item.id === id) || null;
    },
    createElement() {
      return { id: "", textContent: "" };
    },
    head: {
      appendChild(node) {
        styles.push(node);
      }
    }
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
    removeEventListener() {},
    querySelector() {
      return null;
    },
    contains() {
      return false;
    }
  };
  const context = vm.createContext({
    window: {},
    document,
    URLSearchParams,
    fetch(url) {
      const href = String(url);
      calls.push(href);
      if (href.startsWith("/api/bound/board")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => buildBoard({ from: "", to: "", q: "" }, [], [])
        });
      }
      if (href === "/api/bound") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ ok: true, module: "bound", source: "crawler", erp: false })
        });
      }
      return Promise.reject(new Error(href));
    }
  });
  vm.runInContext(js, context);
  const stop = context.window.XmModules["/bound"].mount(root);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.match(root.innerHTML, /边界数据中心/);
  assert.match(root.innerHTML, /爬虫，非 ERP/);
  assert.match(root.innerHTML, /暂无爬虫数据/);
  assert.match(root.innerHTML, /data-bound-erp="false"/);
  assert.equal(root.innerHTML.includes('type="date"'), true);
  assert.deepEqual(calls, ["/api/bound", "/api/bound/board"]);
  stop();
  assert.equal(root.innerHTML, "");
});
