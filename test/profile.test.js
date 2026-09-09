import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createApp } from "../src/app.js";
import {
  DEMO_INITIAL_PASSWORD,
  DEMO_USERNAME,
  dbMode,
  query,
  resetStoreForTests
} from "../src/modules/profile/auth.js";
import { patchAppSource } from "../src/modules/profile/patch-app.js";

test.beforeEach(() => {
  resetStoreForTests();
});

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

function cookieHeader(res) {
  const raw = res.headers.getSetCookie?.() || [];
  return raw.map((part) => part.split(";")[0]).join("; ");
}

async function request(base, pathname, { method = "GET", body, cookie, redirect = "manual" } = {}) {
  const headers = {};
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (cookie) {
    headers.Cookie = cookie;
  }
  const res = await fetch(`${base}${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { res, text, json, cookie: cookieHeader(res) };
}

test("auth.js exports dbMode() and query for academy and other stores", () => {
  assert.equal(typeof dbMode, "function");
  assert.equal(dbMode(), "memory");
  assert.equal(typeof query, "function");
});

test("GET /shared assets are public and cacheable; APIs are not cached", async () => {
  await withServer(async (base) => {
    const css = await request(base, "/shared/layout.css");
    assert.equal(css.res.status, 200);
    assert.match(String(css.res.headers.get("cache-control")), /max-age=3600/);
    const js = await request(base, "/shared/nav.js");
    assert.equal(js.res.status, 200);
    assert.match(String(js.res.headers.get("cache-control")), /max-age=3600/);
    const api = await request(base, "/api/auth/me", { redirect: "follow" });
    assert.equal(api.res.status, 401);
    assert.match(String(api.res.headers.get("cache-control")), /no-store/);
  });
});

test("unauthenticated / and /me redirect to /login", async () => {
  await withServer(async (base) => {
    for (const pathName of ["/", "/me"]) {
      const { res } = await request(base, pathName);
      assert.equal(res.status, 302, pathName);
      assert.equal(res.headers.get("location"), "/login", pathName);
    }
  });
});

test("GET /login is 200 星脉管理系统", async () => {
  await withServer(async (base) => {
    const { res, text } = await request(base, "/login");
    assert.equal(res.status, 200);
    assert.match(text, /星脉管理系统/);
    assert.match(text, /记住密码/);
  });
});

test("login 罗成 sets cookie; GET /api/auth/me 200; wrong password 401", async () => {
  await withServer(async (base) => {
    const bad = await request(base, "/api/auth/login", {
      method: "POST",
      body: { username: DEMO_USERNAME, password: "bad" },
      redirect: "follow"
    });
    assert.equal(bad.res.status, 401);

    const ok = await request(base, "/api/auth/login", {
      method: "POST",
      body: { username: DEMO_USERNAME, password: DEMO_INITIAL_PASSWORD },
      redirect: "follow"
    });
    assert.equal(ok.res.status, 200);
    assert.match(ok.cookie, /mk_sid=/);
    const me = await request(base, "/api/auth/me", { cookie: ok.cookie, redirect: "follow" });
    assert.equal(me.res.status, 200);
    assert.equal(me.json.username, "罗成");
    assert.equal(JSON.stringify(me.json).includes("scrypt"), false);

    const page = await request(base, "/me", { cookie: ok.cookie, redirect: "follow" });
    assert.equal(page.res.status, 200);
    assert.match(page.text, /个人中心/);
    assert.match(page.text, /shared\/layout\.css/);
    assert.match(page.text, /shared\/nav\.js/);
    assert.match(page.text, /<aside class="site-sidebar">/);
    assert.match(page.text, /<main class="page">/);
    assert.match(page.text, /我的责权清单/);
    assert.match(page.text, /修改密码/);
    assert.match(page.text, /退出登录/);
    assert.match(page.text, /logout-panel/);
    assert.doesNotMatch(page.text, /<header class="site-header">/);

    const moduleJs = await request(base, "/shared/modules/me.js", { redirect: "follow" });
    assert.equal(moduleJs.res.status, 200);
    assert.match(moduleJs.text, /XmModules\["\/me"\]/);
    assert.match(moduleJs.text, /我的责权清单/);
    assert.match(moduleJs.text, /\/api\/profile\/duties/);
    assert.match(moduleJs.text, /退出登录/);
    assert.match(moduleJs.text, /me-logout-panel/);
    assert.match(moduleJs.text, /\/api\/auth\/logout/);
  });
});

test("duty catalog lists granted items and can register a new duty", async () => {
  await withServer(async (base) => {
    const ok = await request(base, "/api/auth/login", {
      method: "POST",
      body: { username: DEMO_USERNAME, password: DEMO_INITIAL_PASSWORD },
      redirect: "follow"
    });
    const duties = await request(base, "/api/profile/duties", { cookie: ok.cookie, redirect: "follow" });
    assert.equal(duties.res.status, 200);
    assert.ok(duties.json.grantedCount > 0);
    const names = duties.json.groups.map((group) => group.name);
    assert.deepEqual(names, [
      "数据中心",
      "沈子晗运营中心",
      "韩梦凯运营中心",
      "甄选商学院",
      "甄选智能体",
      "版本发布中心",
      "组织中心",
      "个人中心"
    ]);
    assert.equal(duties.json.identity.username, "罗成");
    const before = duties.json.total;
    const added = await request(base, "/api/profile/duties", {
      method: "POST",
      cookie: ok.cookie,
      redirect: "follow",
      body: { id: "agents.future", group: "甄选智能体", label: "进入未来能力" }
    });
    assert.equal(added.res.status, 200);
    assert.equal(added.json.total, before + 1);
    assert.ok(added.json.groups.some((group) => group.items.some((item) => item.id === "agents.future")));
  });
});

test("patchAppSource only inserts attachProfile after json()", () => {
  const original = `import express from "express";
import { attachHome } from "./modules/home/attach.js";

export function createApp() {
  const app = express();
  app.use(express.json());
  attachHome(app);
  return app;
}
`;
  const patched = patchAppSource(original);
  assert.match(patched, /import \{ attachProfile \} from "\.\/modules\/profile\/attach\.js";/);
  assert.match(patched, /app\.use\(express\.json\(\)\);\n  attachProfile\(app\);/);
  assert.match(patched, /attachHome\(app\);/);
  assert.equal(patchAppSource(patched), patched);
});
