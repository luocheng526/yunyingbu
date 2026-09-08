import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";
import { resetStoreForTests } from "../src/modules/profile/auth.js";

const server = createApp().listen(0);
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

beforeEach(() => resetStoreForTests());
after(() => server.close());

async function login(username, password) {
  return fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
}

test("login page is public", async () => {
  const res = await fetch(`${base}/login`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /星脉管理系统/);
  assert.match(html, /ChangeMe123!/);
});

test("demo user can log in", async () => {
  const res = await login("罗成", "ChangeMe123!");
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.user.username, "罗成");
  const cookie = res.headers.get("set-cookie") || "";
  assert.match(cookie, /mk_sid=/);
  assert.match(cookie, /Max-Age=604800/);
});

test("remember login stretches the cookie to 30 days", async () => {
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-Proto": "https" },
    body: JSON.stringify({ username: "罗成", password: "ChangeMe123!", remember: true })
  });
  assert.equal(res.status, 200);
  const cookie = res.headers.get("set-cookie") || "";
  assert.match(cookie, /Max-Age=2592000/);
  assert.match(cookie, /Secure/);
});

test("luocheng alias can log in", async () => {
  const res = await login("luocheng", "ChangeMe123!");
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.user.username, "罗成");
});

test("wrong password is rejected", async () => {
  const res = await login("罗成", "wrong");
  assert.equal(res.status, 401);
});

test("login and password change stay async so scrypt does not block the event loop", async () => {
  const res = await login("罗成", "ChangeMe123!");
  assert.equal(res.status, 200);
  const cookie = String(res.headers.get("set-cookie") || "").split(";")[0];
  const change = await fetch(`${base}/api/profile/password`, {
    method: "POST",
    headers: { cookie, "Content-Type": "application/json" },
    body: JSON.stringify({
      currentPassword: "ChangeMe123!",
      newPassword: "Changed456!",
      confirmPassword: "Changed456!"
    })
  });
  assert.equal(change.status, 200);
  const denied = await login("罗成", "ChangeMe123!");
  assert.equal(denied.status, 401);
  const next = await login("罗成", "Changed456!");
  assert.equal(next.status, 200);
});

test("logout returns immediately and clears the session cookie", async () => {
  const res = await login("罗成", "ChangeMe123!");
  assert.equal(res.status, 200);
  const cookie = String(res.headers.get("set-cookie") || "").split(";")[0];
  const started = Date.now();
  const out = await fetch(`${base}/api/auth/logout`, {
    method: "POST",
    headers: { cookie, Accept: "application/json" }
  });
  assert.equal(out.status, 200);
  assert.equal((await out.json()).ok, true);
  assert.ok(Date.now() - started < 200);
  assert.match(String(out.headers.get("set-cookie") || ""), /Max-Age=0/);
  const me = await fetch(`${base}/api/auth/me`, { headers: { cookie } });
  assert.equal(me.status, 401);
});
