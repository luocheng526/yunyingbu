import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "../src/app.js";
import { resetStoreForTests } from "../src/modules/profile/auth.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const appJs = readFileSync(join(root, "src/app.js"), "utf8");
const attachJs = readFileSync(join(root, "src/modules/profile/attach.js"), "utf8");
const loginCss = readFileSync(join(root, "public/login.css"), "utf8");

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

test("app.js keeps login, health, and releases so a thin overwrite cannot ship", async () => {
  assert.match(appJs, /attachProfile/);
  assert.match(appJs, /attachHome/);
  assert.match(appJs, /createReleasesRouter/);
  assert.match(attachJs, /noticesRouter/);
  assert.match(attachJs, /\/api\/notices/);
  assert.match(appJs, /\/api\/health/);
  const health = await fetch(`${base}/api/health`);
  assert.equal(health.status, 200);
  const loginPage = await fetch(`${base}/login`);
  assert.equal(loginPage.status, 200);
});

test("login page is public", async () => {
  const res = await fetch(`${base}/login`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /星脉管理系统/);
  assert.match(html, /<title>星脉甄选运营中心<\/title>/);
  assert.match(html, /rel="icon" type="image\/png" sizes="32x32" href="\/shared\/tab-icon\.png\?v=0\.1\.128"/);
  assert.match(html, /rel="shortcut icon" href="\/favicon\.ico\?v=0\.1\.128"/);
  assert.doesNotMatch(html, /rel="icon"[^>]+href="\/login-logo\.png"/);
  assert.doesNotMatch(html, /href="data:image\/png;base64,/);
  assert.match(html, /ChangeMe123!/);
  assert.match(html, /login\.css\?v=0\.1\.160/);
  assert.match(html, /login-foot-pair/);
  assert.match(html, /DATA · OPERATION · ORGANIZATIONAL · TALENT · GROWTH/);
  assert.match(html, /<small><b>TOGETHER<\/b><b>FOR A BRIGHTER<\/b><b>FUTURE<\/b><\/small>/);
  assert.match(loginCss, /LoginPage 0\.1\.160/);
  assert.match(loginCss, /\.hero-brand\s*\{[^}]*margin-left:\s*0/s);
  assert.match(loginCss, /#ffffff 28%/);
  assert.match(loginCss, /\.login-foot-pair small\s*\{[^}]*white-space:\s*nowrap/s);
  assert.match(loginCss, /transform:\s*scale\(0\.93\)/);
  assert.match(loginCss, /bottom:\s*clamp\(52px,\s*6\.2vh,\s*84px\)/);
  assert.doesNotMatch(html, /\/shared\/nav\.js/);
  assert.doesNotMatch(html, /\/shared\/layout\.css/);
  assert.match(html, /decoding="async"/);
  assert.match(html, /window\.location\.replace\("\/home"\)/);
  assert.doesNotMatch(html, /window\.location\.replace\("\/data"\)/);
});

test("logged-in visit to /login redirects home unless out=1", async () => {
  const res = await login("罗成", "ChangeMe123!");
  assert.equal(res.status, 200);
  const cookie = String(res.headers.get("set-cookie") || "").split(";")[0];
  const bounce = await fetch(`${base}/login`, { headers: { cookie }, redirect: "manual" });
  assert.equal(bounce.status, 302);
  assert.equal(bounce.headers.get("location"), "/home");
  const leaving = await fetch(`${base}/login?out=1`, { headers: { cookie }, redirect: "manual" });
  assert.equal(leaving.status, 200);
  const html = await leaving.text();
  assert.match(html, /星脉管理系统/);
  assert.doesNotMatch(html, /\/shared\/nav\.js/);
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
