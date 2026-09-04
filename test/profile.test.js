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

async function request(base, pathname, { method = "GET", body, cookie, redirect = "follow" } = {}) {
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

async function login(base, password = DEMO_INITIAL_PASSWORD, remember = false) {
  return request(base, "/api/auth/login", {
    method: "POST",
    body: { username: DEMO_USERNAME, password, remember }
  });
}

test("login page matches 星脉管理系统 card layout and never embeds the password", () => {
  const html = fs.readFileSync(path.join(__dirname, "../public/login.html"), "utf8");
  const css = fs.readFileSync(path.join(__dirname, "../public/login.css"), "utf8");
  assert.match(html, /星脉管理系统/);
  assert.match(html, /记住密码/);
  assert.match(html, /login-submit/);
  assert.match(html, /toggle-password/);
  assert.match(html, /xingmai\.rememberUsername/);
  assert.doesNotMatch(html, /localStorage\.setItem\([^)]*password/i);
  assert.doesNotMatch(html, /ChangeMe123!/);
  assert.match(css, /login-card/);
  assert.match(css, /#e60012/);
  assert.match(css, /blur\(/);
});

test("me page is settings only, not a second login form", () => {
  const html = fs.readFileSync(path.join(__dirname, "../public/me.html"), "utf8");
  assert.match(html, /<h1>个人中心<\/h1>/);
  assert.match(html, />保存资料</);
  assert.match(html, />修改密码</);
  assert.match(html, />退出登录</);
  assert.doesNotMatch(html, /id="login-form"/);
  assert.doesNotMatch(html, /ChangeMe123!/);
});

test("unauthenticated HTML routes redirect to /login", async () => {
  await withServer(async (base) => {
    for (const pathName of ["/", "/me", "/data", "/people", "/releases"]) {
      const { res } = await request(base, pathName, { redirect: "manual" });
      assert.equal(res.status, 302, pathName);
      assert.equal(res.headers.get("location"), "/login", pathName);
    }
  });
});

test("login page and login.css are public", async () => {
  await withServer(async (base) => {
    const page = await request(base, "/login", { redirect: "manual" });
    assert.equal(page.res.status, 200);
    assert.match(page.text, /星脉管理系统/);
    assert.match(page.text, /login-card/);
    assert.match(page.text, /记住密码/);
    const css = await request(base, "/login.css");
    assert.equal(css.res.status, 200);
    assert.match(css.text, /\.login-submit/);
  });
});

test("unauthenticated APIs return 401 JSON except login and logout", async () => {
  await withServer(async (base) => {
    assert.equal((await request(base, "/api/auth/me")).res.status, 401);
    assert.equal((await request(base, "/api/profile")).res.status, 401);
    const logout = await request(base, "/api/auth/logout", { method: "POST" });
    assert.equal(logout.res.status, 200);
  });
});

test("罗成 with wrong password cannot log in", async () => {
  await withServer(async (base) => {
    const { res, json } = await login(base, "wrong-password");
    assert.equal(res.status, 401);
    assert.match(json.error, /用户名或密码错误/);
  });
});

test("罗成 logs in, session can load profile, hash is never returned", async () => {
  await withServer(async (base) => {
    const loggedIn = await login(base, DEMO_INITIAL_PASSWORD, true);
    assert.equal(loggedIn.res.status, 200);
    assert.equal(loggedIn.json.user.username, "罗成");
    assert.ok(loggedIn.cookie.includes("mk_sid="));
    const me = await request(base, "/api/auth/me", { cookie: loggedIn.cookie });
    assert.equal(me.res.status, 200);
    assert.equal(me.json.username, "罗成");
    assert.equal(JSON.stringify(me.json).includes("password"), false);
    assert.equal(JSON.stringify(me.json).includes("scrypt"), false);
    const home = await request(base, "/", { cookie: loggedIn.cookie, redirect: "manual" });
    assert.notEqual(home.res.status, 302);
  });
});

test("can update display name and change password as 罗成", async () => {
  await withServer(async (base) => {
    const loggedIn = await login(base);
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
      body: { currentPassword: "not-the-password", newPassword: "NewPass123!", confirmPassword: "NewPass123!" }
    });
    assert.equal(wrong.res.status, 403);

    const changed = await request(base, "/api/profile/password", {
      method: "POST",
      cookie: loggedIn.cookie,
      body: { currentPassword: DEMO_INITIAL_PASSWORD, newPassword: "NewPass123!", confirmPassword: "NewPass123!" }
    });
    assert.equal(changed.res.status, 200);

    const mePage = await request(base, "/me", { cookie: loggedIn.cookie });
    assert.equal(mePage.res.status, 200);
    assert.match(mePage.text, /个人中心/);

    await request(base, "/api/auth/logout", { method: "POST", cookie: loggedIn.cookie });
    const afterLogout = await request(base, "/me", { cookie: loggedIn.cookie, redirect: "manual" });
    assert.equal(afterLogout.res.status, 302);
    assert.equal(afterLogout.res.headers.get("location"), "/login");
    assert.equal((await login(base, DEMO_INITIAL_PASSWORD)).res.status, 401);
    assert.equal((await login(base, "NewPass123!")).res.status, 200);
  });
});

test("patchAppSource inserts gate, /login, and API mounts", () => {
  const original = `import express from "express";
import path from "node:path";

const publicDir = "/tmp/public";

export function createApp() {
  const app = express();
  app.use(express.json());
  return app;
}
`;
  const patched = patchAppSource(original);
  assert.match(patched, /import \{ requireLoginUnlessPublic \} from "\.\/modules\/profile\/gate\.js";/);
  assert.match(patched, /app\.use\(requireLoginUnlessPublic\);/);
  assert.match(patched, /app\.get\("\/login"/);
  assert.match(patched, /app\.use\("\/api\/auth", authRouter\);/);
  assert.match(patched, /app\.use\("\/api\/profile", profileRouter\);/);
  assert.equal(patchAppSource(patched), patched);
});
