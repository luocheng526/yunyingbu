import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createApp } from "../src/app.js";
import { resetHanStore } from "../src/modules/han/store.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const server = createApp().listen(0);
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

after(() => server.close());

async function loginCookie() {
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "luocheng", password: "ChangeMe123!" })
  });
  assert.equal(res.status, 200);
  return String(res.headers.get("set-cookie") || "").split(";")[0];
}

test("shell HTML is versioned so browsers drop the old full-reload nav.js", async () => {
  const cookie = await loginCookie();
  const html = await (await fetch(`${base}/data/overview`, { headers: { cookie } })).text();
  assert.match(html, /\/shared\/nav\.js\?v=0\.1\.144/);
  assert.match(html, /\/shared\/layout\.css\?v=0\.1\.144/);
  assert.match(html, /\/apple-touch-icon\.png\?v=0\.1\.144/);
  assert.match(html, /\/shared\/modules\/data\.js/);
  assert.doesNotMatch(html, /\/shared\/modules\/data\.js\?v=/);
  assert.match(html, /xm-tab-close/);
  assert.match(html, /xm-workspace/);
  const js = readFileSync(join(root, "public/shared/nav.js"), "utf8");
  assert.match(js, /history\.pushState/);
  assert.match(js, /function go\(/);
  assert.match(js, /function openTab\(/);
  assert.match(js, /function closeTab\(/);
  assert.match(js, /xm-menu-child/);
  assert.match(js, /function loadModuleScript\(/);
  assert.match(js, /function mountRoute\(/);
  assert.doesNotMatch(js, /function wipePageTimers/);
  assert.doesNotMatch(js, /for \(let i = 1; i <= max/);
  assert.doesNotMatch(js, /100000/);
});

test("sidebar HTML stays fast when the same process is reused", async () => {
  const cookie = await loginCookie();
  const headers = { cookie, Accept: "text/html" };
  await fetch(`${base}/`, { headers });
  const samples = [];
  for (const path of ["/home", "/data/overview", "/shen/product", "/han/selection", "/me", "/han/goods", "/releases", "/academy/courses", "/agents"]) {
    const t0 = performance.now();
    const res = await fetch(`${base}${path}`, { headers });
    const ms = performance.now() - t0;
    assert.equal(res.status, 200);
    samples.push(ms);
    const html = await res.text();
    assert.match(html, /\/shared\/nav\.js\?v=0\.1\.144/);
    assert.match(html, /\/shared\/modules\//);
    assert.match(html, /<span>首页<\/span>/);
  }
  const max = Math.max(...samples);
  assert.ok(max < 250, `slow html fetch ${max.toFixed(1)}ms ${JSON.stringify(samples)}`);
});

test("home page is injected and not served as raw static index", async () => {
  const cookie = await loginCookie();
  for (const dest of ["/", "/index.html"]) {
    const res = await fetch(`${base}${dest}`, { headers: { cookie }, redirect: "manual" });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get("location"), "/home");
  }
});

test("node keep-alive is longer than nginx idle reuse", () => {
  const serverJs = readFileSync(join(root, "src/server.js"), "utf8");
  assert.match(serverJs, /keepAliveTimeout = 65_000/);
  assert.match(serverJs, /headersTimeout = 66_000/);
  assert.match(serverJs, /http\.createServer/);
});

test("Han GET APIs are memoized for 2.5s and dropped after a write", async () => {
  resetHanStore();
  const cookie = await loginCookie();
  const first = await fetch(`${base}/api/han/tasks`, { headers: { cookie } });
  assert.equal(first.status, 200);
  assert.notEqual(String(first.headers.get("x-xm-cache") || ""), "han");
  assert.deepEqual(await first.json(), { ok: true, tasks: [] });
  const second = await fetch(`${base}/api/han/tasks`, { headers: { cookie } });
  assert.equal(second.status, 200);
  assert.equal(second.headers.get("x-xm-cache"), "han");
  assert.deepEqual(await second.json(), { ok: true, tasks: [] });
  const write = await fetch(`${base}/api/han/tasks`, {
    method: "POST",
    headers: { cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ title: "x" })
  });
  assert.equal(write.status, 201);
  const third = await fetch(`${base}/api/han/tasks`, { headers: { cookie } });
  assert.equal(third.status, 200);
  assert.notEqual(String(third.headers.get("x-xm-cache") || ""), "han");
  const thirdBody = await third.json();
  assert.equal(thirdBody.ok, true);
  assert.equal(thirdBody.tasks.length, 1);
  assert.equal(thirdBody.tasks[0].title, "x");
});
