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
  assert.match(res.headers.get("set-cookie") || "", /mk_sid=/);
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
