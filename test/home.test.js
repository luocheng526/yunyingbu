import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createApp } from "../src/app.js";
import { patchAppSource } from "../src/modules/home/patch-app.js";

const NAV_LABELS = [
  "首页",
  "数据中心",
  "沈子晗运营中心",
  "韩梦凯运营中心",
  "人员管理",
  "版本发布中心",
  "个人中心"
];

async function withServer(fn) {
  const server = http.createServer(createApp());
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

async function get(base, pathname) {
  const res = await fetch(`${base}${pathname}`);
  const text = await res.text();
  return { res, text };
}

test("GET /api/home/summary returns module json", async () => {
  await withServer(async (base) => {
    const { res, text } = await get(base, "/api/home/summary");
    assert.equal(res.status, 200);
    assert.deepEqual(JSON.parse(text), { ok: true, module: "home" });
  });
});

test("GET / is the left-nav dashboard with seven menu labels", async () => {
  await withServer(async (base) => {
    const { res, text } = await get(base, "/");
    assert.equal(res.status, 200);
    assert.match(text, /星脉管理系统/);
    assert.match(text, /趋势看板/);
    assert.match(text, /实时销售指数/);
    assert.match(text, /龙虎榜/);
    assert.match(text, /演示/);
    assert.match(text, /kpi-grid/);
    assert.match(text, /xm-sider/);
    for (const label of NAV_LABELS) {
      assert.match(text, new RegExp(label));
    }
    assert.doesNotMatch(text, /login-page/);
  });
});

test("unfinished module pages return placeholder instead of 500", async () => {
  await withServer(async (base) => {
    for (const path of ["/data", "/shen", "/han", "/people", "/releases", "/me"]) {
      const { res, text } = await get(base, path);
      assert.equal(res.status, 200, path);
      assert.match(text, /星脉管理系统/);
      assert.match(text, /xm-sider/);
      assert.match(text, /shared\/nav\.js/);
      assert.match(text, /shared\/layout\.css/);
      for (const label of NAV_LABELS) {
        assert.match(text, new RegExp(label));
      }
    }
  });
});

test("patchAppSource only inserts home attach lines", () => {
  const original = `import express from "express";

export function createApp() {
  const app = express();
  app.use(express.json());
  return app;
}
`;
  const patched = patchAppSource(original);
  assert.match(patched, /import \{ attachHome \} from "\.\/modules\/home\/attach\.js";/);
  assert.match(patched, /attachHome\(app\);\n  return app;/);
  assert.equal(patchAppSource(patched), patched);
});
