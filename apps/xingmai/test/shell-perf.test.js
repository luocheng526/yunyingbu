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
  assert.match(html, /\/shared\/nav\.js\?v=0\.1\.42/);
  assert.match(html, /\/shared\/layout\.css\?v=0\.1\.42/);
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
    assert.match(html, /\/shared\/nav\.js\?v=0\.1\.42/);
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
    assert.match(html, /\/shared\/nav\.js\?v=0\.1\.42/);
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
