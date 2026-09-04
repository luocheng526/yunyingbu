import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createApp } from "../src/app.js";
import { patchAppSource } from "../src/modules/profile/patch-app.js";
import { DEMO_INITIAL_PASSWORD, DEMO_USERNAME, resetStoreForTests } from "../src/modules/profile/store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

async function request(base, pathname, { method = "GET", body, cookie } = {}) {
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
    body: body === undefined ? undefined : JSON.stringify(body)
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

async function login(base, password = DEMO_INITIAL_PASSWORD) {
  return request(base, "/api/profile/login", {
    method: "POST",
    body: { username: DEMO_USERNAME, password }
  });
}

test("GET /me is 200 个人中心 with shared nav, not 500", async () => {
  await withServer(async (base) => {
    const { res, text } = await request(base, "/me");
    assert.equal(res.status, 200);
    assert.notEqual(res.status, 500);
    assert.match(text, /<h1>个人中心<\/h1>/);
    assert.match(text, /href="\/shared\/layout\.css"/);
    assert.match(text, /src="\/shared\/nav\.js"/);
    assert.match(text, /href="\/me"[^>]*>个人中心/);
    assert.match(text, />登录</);
    assert.match(text, />保存资料</);
    assert.doesNotMatch(text, /ChangeMe123!/);
  });
});

test("me.html nav copy is 个人中心 → /me", () => {
  const html = fs.readFileSync(path.join(__dirname, "../public/me.html"), "utf8");
  assert.match(html, /<a href="\/me" aria-current="page">个人中心<\/a>/);
  const nav = fs.readFileSync(path.join(__dirname, "../public/shared/nav.js"), "utf8");
  assert.match(nav, /href: "\/me", label: "个人中心"/);
});

test("wrong password cannot log in", async () => {
  await withServer(async (base) => {
    const { res, json } = await login(base, "wrong-password");
    assert.equal(res.status, 401);
    assert.match(json.error, /用户名或密码错误/);
  });
});

test("login, save profile, reject bad password change", async () => {
  await withServer(async (base) => {
    const loggedIn = await login(base);
    assert.equal(loggedIn.res.status, 200);
    assert.equal(loggedIn.json.user.username, DEMO_USERNAME);
    const me = await request(base, "/api/profile/me", { cookie: loggedIn.cookie });
    assert.equal(me.res.status, 200);
    assert.equal(JSON.stringify(me.json).includes("scrypt"), false);

    const saved = await request(base, "/api/profile", {
      method: "PUT",
      cookie: loggedIn.cookie,
      body: { displayName: "罗成（演示）", email: "lc@example.com", phone: "13800000000" }
    });
    assert.equal(saved.res.status, 200);
    assert.equal(saved.json.displayName, "罗成（演示）");

    const wrong = await request(base, "/api/profile/password", {
      method: "POST",
      cookie: loggedIn.cookie,
      body: { currentPassword: "nope", newPassword: "NewPass123!", confirmPassword: "NewPass123!" }
    });
    assert.equal(wrong.res.status, 403);
  });
});

test("patchAppSource only inserts /api/profile mount", () => {
  const original = `import express from "express";
import { attachHome } from "./modules/home/attach.js";

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(express.static(publicDir));
  attachHome(app);
  return app;
}
`;
  const patched = patchAppSource(original);
  assert.match(patched, /import \{ profileRouter \} from "\.\/modules\/profile\/profile-router\.js";/);
  assert.match(patched, /app\.use\("\/api\/profile", profileRouter\);/);
  assert.match(patched, /attachHome\(app\);/);
  assert.match(patched, /app\.use\(express\.json\(\)\);/);
  assert.doesNotMatch(patched, /requireLoginUnlessPublic/);
  assert.equal(patchAppSource(patched), patched);
});
