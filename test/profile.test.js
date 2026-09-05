import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createApp } from "../src/app.js";
import { DEMO_INITIAL_PASSWORD, DEMO_USERNAME, resetStoreForTests } from "../src/modules/profile/auth.js";
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
