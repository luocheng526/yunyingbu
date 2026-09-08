import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createApp } from "../src/app.js";
import { patchAppSource } from "../src/modules/shen/patch-app.js";
import { resetStore } from "../src/modules/shen/store.js";
import { loginCookie } from "./helpers/login-cookie.js";

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
  resetStore();
  const server = http.createServer(createApp());
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

async function request(base, pathname, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.cookie) {
    headers.Cookie = options.cookie;
  }
  const res = await fetch(`${base}${pathname}`, { ...options, headers });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { res, text, json };
}

test("GET /shen is 沈子晗运营中心 with left sidebar and seven nav items", async () => {
  await withServer(async (base) => {
    const cookie = await loginCookie(base);
    const { res, text } = await request(base, "/shen", { cookie });
    assert.equal(res.status, 200);
    assert.match(text, /<title>沈子晗运营中心<\/title>/);
    assert.match(text, /这是沈子晗团队的任务与日报台/);
    assert.match(text, /shared\/nav\.js/);
    assert.match(text, /shared\/layout\.css/);
    assert.match(text, /class="app-shell"/);
    assert.match(text, /class="site-sidebar"/);
    assert.match(text, /<aside class="site-sidebar">/);
    assert.doesNotMatch(text, /<header class="site-header">/);
    assert.match(text, /flex-direction:\s*column/);
    for (const label of NAV_LABELS) {
      assert.match(text, new RegExp(label));
    }
  });
});

test("task CRUD stays in memory across requests", async () => {
  await withServer(async (base) => {
    const cookie = await loginCookie(base);
    const empty = await request(base, "/api/shen/tasks", { cookie });
    assert.equal(empty.res.status, 200);
    assert.deepEqual(empty.json.tasks, []);

    const missing = await request(base, "/api/shen/tasks", {
      cookie,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "   " })
    });
    assert.equal(missing.res.status, 400);

    const created = await request(base, "/api/shen/tasks", {
      cookie,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "跟进今日达人排期" })
    });
    assert.equal(created.res.status, 201);
    assert.equal(created.json.title, "跟进今日达人排期");
    assert.equal(created.json.status, "待办");
    assert.equal(created.json.owner, "沈子晗");

    const listed = await request(base, "/api/shen/tasks", { cookie });
    assert.equal(listed.json.tasks.length, 1);
    assert.equal(listed.json.tasks[0].title, "跟进今日达人排期");
  });
});

test("brief GET/PUT round-trip", async () => {
  await withServer(async (base) => {
    const cookie = await loginCookie(base);
    const initial = await request(base, "/api/shen/brief", { cookie });
    assert.equal(initial.res.status, 200);
    assert.deepEqual(initial.json, { text: "" });

    const saved = await request(base, "/api/shen/brief", {
      cookie,
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "今日完成排期核对。" })
    });
    assert.equal(saved.res.status, 200);
    assert.equal(saved.json.text, "今日完成排期核对。");

    const loaded = await request(base, "/api/shen/brief", { cookie });
    assert.equal(loaded.json.text, "今日完成排期核对。");
  });
});

test("patchAppSource only inserts shen router mount", () => {
  const original = `import express from "express";

export function createApp() {
  const app = express();
  app.use(express.json());
  return app;
}
`;
  const patched = patchAppSource(original);
  assert.match(patched, /import \{ shenRouter \} from "\.\/modules\/shen\/router\.js";/);
  assert.match(patched, /app\.use\("\/api\/shen", shenRouter\);\n  return app;/);
  assert.equal(patchAppSource(patched), patched);
});
