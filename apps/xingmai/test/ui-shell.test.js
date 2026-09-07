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

test("shared shell assets are public", async () => {
  const css = await fetch(`${base}/shared/layout.css`);
  const js = await fetch(`${base}/shared/nav.js`);
  const loginCss = await fetch(`${base}/login.css`);
  assert.equal(css.status, 200);
  assert.equal(js.status, 200);
  assert.equal(loginCss.status, 200);
  assert.match(String(js.headers.get("cache-control") || ""), /max-age=3600/);
  const cssText = await css.text();
  const jsText = await js.text();
  assert.match(cssText, /cursor-light-3/);
  assert.match(jsText, /xm-shell-always 0\.1\.19/);
  assert.match(jsText, /xm-shell/);
  assert.doesNotMatch(jsText, /xm-sider-collapsed/);
  assert.doesNotMatch(jsText, /link\.rel = "prefetch"/);
  assert.doesNotMatch(jsText, /if \(document\.querySelector\("\.oc-tab/);
});

test("login page uses official https url and cursor light tokens", async () => {
  const res = await fetch(`${base}/login`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /https:\/\/zx\.xingmaierp\.cc\/login/);
  assert.doesNotMatch(html, /:18080/);
  const css = readFileSync(join(root, "public/login.css"), "utf8");
  assert.match(css, /#f7f7f4/);
  assert.match(css, /#14120b/);
});

test("placeholder modules share the same shell assets", async () => {
  const cookieRes = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "luocheng", password: "ChangeMe123!" })
  });
  assert.equal(cookieRes.status, 200);
  const cookie = String(cookieRes.headers.get("set-cookie") || "").split(";")[0];
  const res = await fetch(`${base}/data`, { headers: { cookie } });
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /\/shared\/layout\.css/);
  assert.match(html, /\/shared\/nav\.js/);
  assert.doesNotMatch(html, /site-header/);
  const releases = await fetch(`${base}/releases`, { headers: { cookie } });
  assert.equal(releases.status, 200);
  assert.match(await releases.text(), /\/shared\/nav\.js/);
});

test("page renderer injects shared shell onto module html", async () => {
  const { withSharedShell } = await import("../src/modules/profile/middleware.js");
  const injected = withSharedShell(
    '<!DOCTYPE html><html><head></head><body class="oc-page"><div class="oc-tab">待上线</div></body></html>'
  );
  assert.match(injected, /\/shared\/layout\.css/);
  assert.match(injected, /\/shared\/nav\.js/);
  const login = withSharedShell('<html><body class="login-page"></body></html>');
  assert.doesNotMatch(login, /\/shared\/nav\.js/);
});
