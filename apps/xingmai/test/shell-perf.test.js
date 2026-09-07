import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createApp } from "../src/app.js";

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
  const html = await (await fetch(`${base}/data`, { headers: { cookie } })).text();
  assert.match(html, /\/shared\/nav\.js\?v=0\.1\.44/);
  assert.match(html, /\/shared\/layout\.css\?v=0\.1\.44/);
  const js = readFileSync(join(root, "public/shared/nav.js"), "utf8");
  assert.match(js, /history\.pushState/);
  assert.match(js, /function wipePageTimers/);
  assert.doesNotMatch(js, /for \(let i = 1; i <= max/);
  assert.doesNotMatch(js, /100000/);
});

test("sidebar HTML stays fast when the same process is reused", async () => {
  const cookie = await loginCookie();
  const headers = { cookie, Accept: "text/html" };
  await fetch(`${base}/`, { headers });
  const samples = [];
  for (const path of ["/han", "/data", "/me", "/han", "/releases"]) {
    const t0 = performance.now();
    const res = await fetch(`${base}${path}`, { headers });
    const ms = performance.now() - t0;
    assert.equal(res.status, 200);
    samples.push(ms);
    const html = await res.text();
    assert.match(html, /\/shared\/nav\.js\?v=0\.1\.44/);
  }
  const max = Math.max(...samples);
  assert.ok(max < 250, `slow html fetch ${max.toFixed(1)}ms ${JSON.stringify(samples)}`);
});

test("home page is injected and not served as raw static index", async () => {
  const cookie = await loginCookie();
  for (const dest of ["/", "/index.html"]) {
    const res = await fetch(`${base}${dest}`, { headers: { cookie } });
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /\/shared\/nav\.js\?v=0\.1\.44/);
    assert.match(html, /localStorage.getItem\("xm-theme"\)/);
    assert.match(html, /工作台/);
  }
});

test("node keep-alive is longer than nginx idle reuse", () => {
  const serverJs = readFileSync(join(root, "src/server.js"), "utf8");
  assert.match(serverJs, /keepAliveTimeout = 65_000/);
  assert.match(serverJs, /headersTimeout = 66_000/);
  assert.match(serverJs, /http\.createServer/);
});

test("Han GET APIs are memoized for 2.5s and dropped after a write", async () => {
  const app = createApp();
  let hits = 0;
  app.get("/api/han/tasks", (_req, res) => {
    hits += 1;
    res.json({ ok: true, tasks: [], n: hits });
  });
  app.get("/api/han/brief", (_req, res) => {
    res.json({ ok: true, brief: "ok" });
  });
  app.post("/api/han/tasks", (_req, res) => {
    res.json({ ok: true });
  });
  const extra = app.listen(0);
  const extraBase = `http://127.0.0.1:${extra.address().port}`;
  try {
    const cookieRes = await fetch(`${extraBase}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "luocheng", password: "ChangeMe123!" })
    });
    assert.equal(cookieRes.status, 200);
    const cookie = String(cookieRes.headers.get("set-cookie") || "").split(";")[0];
    const first = await fetch(`${extraBase}/api/han/tasks`, { headers: { cookie } });
    assert.equal(first.status, 200);
    assert.notEqual(String(first.headers.get("x-xm-cache") || ""), "han");
    assert.deepEqual(await first.json(), { ok: true, tasks: [], n: 1 });
    const second = await fetch(`${extraBase}/api/han/tasks`, { headers: { cookie } });
    assert.equal(second.status, 200);
    assert.equal(second.headers.get("x-xm-cache"), "han");
    assert.deepEqual(await second.json(), { ok: true, tasks: [], n: 1 });
    assert.equal(hits, 1);
    const write = await fetch(`${extraBase}/api/han/tasks`, {
      method: "POST",
      headers: { cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ title: "x" })
    });
    assert.equal(write.status, 200);
    const third = await fetch(`${extraBase}/api/han/tasks`, { headers: { cookie } });
    assert.equal(third.status, 200);
    assert.notEqual(String(third.headers.get("x-xm-cache") || ""), "han");
    assert.deepEqual(await third.json(), { ok: true, tasks: [], n: 2 });
    assert.equal(hits, 2);
  } finally {
    extra.close();
  }
});
