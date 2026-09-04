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
  return request(base, "/api/auth/login", {
    method: "POST",
    body: { username: DEMO_USERNAME, password }
  });
}

test("GET /me is 个人中心 with login and settings controls, no password secrets", () => {
  const html = fs.readFileSync(path.join(__dirname, "../public/me.html"), "utf8");
  assert.match(html, /<h1>个人中心<\/h1>/);
  assert.match(html, />登录</);
  assert.match(html, />保存资料</);
  assert.match(html, />修改密码</);
  assert.match(html, />退出登录</);
  assert.match(html, /演示环境/);
  assert.match(html, /href="\/shared\/layout\.css"/);
  assert.match(html, /src="\/shared\/nav\.js"/);
  assert.match(html, />首页</);
  assert.match(html, />数据中心</);
  assert.match(html, />沈子晗运营中心</);
  assert.match(html, />韩梦凯运营中心</);
  assert.match(html, />人员管理</);
  assert.match(html, />版本发布中心</);
  assert.doesNotMatch(html, /ChangeMe123!/);
  assert.doesNotMatch(html, /passwordHash/);
  assert.doesNotMatch(html, /scrypt:/);
});

test("wrong password cannot log in", async () => {
  await withServer(async (base) => {
    const { res, json } = await login(base, "wrong-password");
    assert.equal(res.status, 401);
    assert.equal(json.ok, false);
    assert.match(json.error, /用户名或密码错误/);
  });
});

test("login then GET me and GET profile never return password hash", async () => {
  await withServer(async (base) => {
    const loggedIn = await login(base);
    assert.equal(loggedIn.res.status, 200);
    assert.ok(loggedIn.cookie.includes("mk_sid="));
    const me = await request(base, "/api/auth/me", { cookie: loggedIn.cookie });
    assert.equal(me.res.status, 200);
    assert.equal(me.json.username, "admin");
    assert.equal(JSON.stringify(me.json).includes("password"), false);
    assert.equal(JSON.stringify(me.json).includes("scrypt"), false);
    const profile = await request(base, "/api/profile", { cookie: loggedIn.cookie });
    assert.equal(profile.res.status, 200);
    assert.equal(profile.json.username, "admin");
  });
});

test("unauthenticated me and profile are 401", async () => {
  await withServer(async (base) => {
    assert.equal((await request(base, "/api/auth/me")).res.status, 401);
    assert.equal((await request(base, "/api/profile")).res.status, 401);
  });
});

test("can update display name and it persists until process reset", async () => {
  await withServer(async (base) => {
    const loggedIn = await login(base);
    const saved = await request(base, "/api/profile", {
      method: "PUT",
      cookie: loggedIn.cookie,
      body: { displayName: "梦凯", email: "mk@example.com", phone: "13800000000" }
    });
    assert.equal(saved.res.status, 200);
    assert.equal(saved.json.displayName, "梦凯");
    const again = await request(base, "/api/auth/me", { cookie: loggedIn.cookie });
    assert.equal(again.json.displayName, "梦凯");
    assert.equal(again.json.email, "mk@example.com");
    assert.equal(again.json.phone, "13800000000");
  });
});

test("password change validation and wrong current password", async () => {
  await withServer(async (base) => {
    const loggedIn = await login(base);
    const mismatch = await request(base, "/api/profile/password", {
      method: "POST",
      cookie: loggedIn.cookie,
      body: { currentPassword: DEMO_INITIAL_PASSWORD, newPassword: "NewPass123!", confirmPassword: "OtherPass123!" }
    });
    assert.equal(mismatch.res.status, 400);
    assert.match(mismatch.json.error, /两次新密码不一致/);

    const short = await request(base, "/api/profile/password", {
      method: "POST",
      cookie: loggedIn.cookie,
      body: { currentPassword: DEMO_INITIAL_PASSWORD, newPassword: "short", confirmPassword: "short" }
    });
    assert.equal(short.res.status, 400);
    assert.match(short.json.error, /至少 8 位/);

    const same = await request(base, "/api/profile/password", {
      method: "POST",
      cookie: loggedIn.cookie,
      body: {
        currentPassword: DEMO_INITIAL_PASSWORD,
        newPassword: DEMO_INITIAL_PASSWORD,
        confirmPassword: DEMO_INITIAL_PASSWORD
      }
    });
    assert.equal(same.res.status, 400);
    assert.match(same.json.error, /不能与当前密码相同/);

    const wrong = await request(base, "/api/profile/password", {
      method: "POST",
      cookie: loggedIn.cookie,
      body: { currentPassword: "not-the-password", newPassword: "NewPass123!", confirmPassword: "NewPass123!" }
    });
    assert.equal(wrong.res.status, 403);
    assert.match(wrong.json.error, /当前密码错误/);
  });
});

test("after password change old password fails and new password works", async () => {
  await withServer(async (base) => {
    const loggedIn = await login(base);
    const changed = await request(base, "/api/profile/password", {
      method: "POST",
      cookie: loggedIn.cookie,
      body: { currentPassword: DEMO_INITIAL_PASSWORD, newPassword: "NewPass123!", confirmPassword: "NewPass123!" }
    });
    assert.equal(changed.res.status, 200);
    await request(base, "/api/auth/logout", { method: "POST", cookie: loggedIn.cookie });
    const oldLogin = await login(base, DEMO_INITIAL_PASSWORD);
    assert.equal(oldLogin.res.status, 401);
    const newLogin = await login(base, "NewPass123!");
    assert.equal(newLogin.res.status, 200);
  });
});

test("logout clears session", async () => {
  await withServer(async (base) => {
    const loggedIn = await login(base);
    await request(base, "/api/auth/logout", { method: "POST", cookie: loggedIn.cookie });
    const me = await request(base, "/api/auth/me", { cookie: loggedIn.cookie });
    assert.equal(me.res.status, 401);
  });
});

test("GET /me serves the personal center page", async () => {
  await withServer(async (base) => {
    const { res, text } = await request(base, "/me");
    assert.equal(res.status, 200);
    assert.match(text, /个人中心/);
  });
});

test("patchAppSource only inserts auth and profile mounts", () => {
  const original = `import express from "express";

export function createApp() {
  const app = express();
  app.use(express.json());
  return app;
}
`;
  const patched = patchAppSource(original);
  assert.match(patched, /import \{ authRouter \} from "\.\/modules\/profile\/auth-router\.js";/);
  assert.match(patched, /import \{ profileRouter \} from "\.\/modules\/profile\/profile-router\.js";/);
  assert.match(patched, /app\.use\("\/api\/auth", authRouter\);/);
  assert.match(patched, /app\.use\("\/api\/profile", profileRouter\);/);
  assert.equal(patchAppSource(patched), patched);
});
