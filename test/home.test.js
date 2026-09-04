import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createApp } from "../src/app.js";
import { patchAppSource } from "../src/modules/home/patch-app.js";
import { DEMO_INITIAL_PASSWORD, DEMO_USERNAME } from "../src/modules/profile/auth.js";

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

async function loginCookie(base) {
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: DEMO_USERNAME, password: DEMO_INITIAL_PASSWORD })
  });
  return (res.headers.getSetCookie?.() || []).map((part) => part.split(";")[0]).join("; ");
}

async function get(base, pathname, cookie) {
  const res = await fetch(`${base}${pathname}`, {
    headers: cookie ? { Cookie: cookie } : {}
  });
  const text = await res.text();
  return { res, text };
}

test("GET /api/home/summary returns module json", async () => {
  await withServer(async (base) => {
    const cookie = await loginCookie(base);
    const { res, text } = await get(base, "/api/home/summary", cookie);
    assert.equal(res.status, 200);
    assert.deepEqual(JSON.parse(text), { ok: true, module: "home" });
  });
});

test("GET / is the workbench with seven cards and nav labels", async () => {
  await withServer(async (base) => {
    const cookie = await loginCookie(base);
    const { res, text } = await get(base, "/", cookie);
    assert.equal(res.status, 200);
    assert.match(text, /欢迎回到运营部工作台/);
    assert.match(text, /各中心由独立 Agent 维护/);
    assert.equal((text.match(/class="card"/g) || []).length, 7);
    for (const label of NAV_LABELS) {
      assert.match(text, new RegExp(label));
    }
  });
});

test("unfinished module pages return placeholder instead of 500", async () => {
  await withServer(async (base) => {
    const cookie = await loginCookie(base);
    for (const path of ["/data", "/shen", "/han", "/people"]) {
      const { res, text } = await get(base, path, cookie);
      assert.equal(res.status, 200, path);
      assert.match(text, /该模块 Agent 尚未交付/);
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
