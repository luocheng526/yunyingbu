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
  const ocCss = await fetch(`${base}/releases.css`);
  assert.equal(css.status, 200);
  assert.equal(js.status, 200);
  assert.equal(loginCss.status, 200);
  assert.equal(ocCss.status, 200);
  assert.match(String(js.headers.get("cache-control") || ""), /must-revalidate/);
  const versionedJs = await fetch(`${base}/shared/nav.js?v=0.1.45`);
  assert.match(String(versionedJs.headers.get("cache-control") || ""), /max-age=86400/);
  const cssText = await css.text();
  const jsText = await js.text();
  assert.match(cssText, /cursor-light-3/);
  assert.match(cssText, /cursor-dark-1/);
  assert.match(cssText, /html\[data-theme="dark"\]/);
  assert.match(cssText, /\.xm-shell\.is-pending/);
  assert.match(cssText, /\.xm-sider/);
  assert.match(jsText, /xm-shell-perf 0\.1\.45/);
  assert.match(jsText, /aside class="xm-sider"/);
  const homeHtml = readFileSync(join(root, "public/index.html"), "utf8");
  assert.match(homeHtml, /工作台/);
  assert.doesNotMatch(homeHtml, /aria-label="模块入口"/);
  assert.doesNotMatch(homeHtml, /class="cards"/);
  assert.match(jsText, /function menuHtml\(/);
  assert.match(jsText, /id === "upgrade-mask"/);
  assert.match(jsText, /staleMask\.remove/);
  assert.match(jsText, /document\.documentElement\.appendChild/);
  assert.match(jsText, /function wrapHanFetch\(/);
  assert.match(jsText, /function isAppDest\(/);
  assert.match(jsText, /function warmAppPages\(/);
  assert.match(jsText, /function trackPageTimers\(/);
  assert.match(jsText, /function warmUpstream\(/);
  assert.match(jsText, /AbortController/);
  assert.match(jsText, /new Intl\.DateTimeFormat/);
  assert.match(jsText, /\(function\(\)\{\\n" \+ old\.textContent/);
  assert.doesNotMatch(jsText, /100000/);
  assert.match(jsText, /function applyTheme\(/);
  assert.match(jsText, /id="xm-theme"/);
  assert.match(jsText, /xm-shell/);
  assert.match(jsText, /history\.pushState/);
  assert.match(jsText, /function navigate\(/);
  assert.match(jsText, /MutationObserver/);
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
  assert.match(css, /html\[data-theme="dark"\]/);
  assert.match(html, /login-theme/);
  assert.match(html, /localStorage.getItem\("xm-theme"\)/);
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
  const releasesHtml = await releases.text();
  assert.match(releasesHtml, /\/shared\/nav\.js/);
  assert.match(releasesHtml, /timeZone: "Asia\/Shanghai"/);
  assert.match(releasesHtml, /function formatChinaTime/);
  assert.match(releasesHtml, /xm-china-time 0\.1\.27/);
  assert.match(releasesHtml, /xm-upgrade-mask 0\.1\.45/);
  assert.match(releasesHtml, /id="upgrade-dismiss"/);
  assert.match(releasesHtml, /function pinUpgradeMask\(/);
  assert.match(releasesHtml, /function maskEl\(/);
  assert.match(releasesHtml, /document\.documentElement\.appendChild/);
  assert.match(releasesHtml, /display: flex !important/);
  assert.match(releasesHtml, /#upgrade-mask\.can-close #upgrade-dismiss/);
  assert.match(releasesHtml, /position: absolute/);
  assert.match(releasesHtml, /background: var\(--xm-card/);
  assert.doesNotMatch(releasesHtml, /replace\("Z", " UTC"\)/);
  const ocCss = await fetch(`${base}/releases.css`, { headers: { cookie } });
  assert.equal(ocCss.status, 200);
  const ocText = await ocCss.text();
  assert.match(ocText, /xm-shell-skin 0\.1\.30/);
  assert.match(ocText, /--xm-bg/);
  assert.doesNotMatch(ocText, /#1677ff/);
  assert.doesNotMatch(ocText, /#eef2f6/);
});

test("page renderer injects shared shell onto module html", async () => {
  const { withSharedShell, readThemedHtml } = await import("../src/modules/profile/middleware.js");
  assert.equal(typeof readThemedHtml, "function");
  const pagesSrc = readFileSync(join(root, "src/modules/home/pages.js"), "utf8");
  assert.match(pagesSrc, /readThemedHtml/);
  assert.match(pagesSrc, /typeof profileShell\.readThemedHtml/);
  assert.doesNotMatch(pagesSrc, /import \{[^}]*readThemedHtml/);
  const injected = withSharedShell(
    '<!DOCTYPE html><html><head></head><body class="oc-page"><div class="oc-tab">待上线</div></body></html>'
  );
  assert.match(injected, /\/shared\/layout\.css/);
  assert.match(injected, /\/shared\/nav\.js\?v=0\.1\.45/);
  assert.match(injected, /rel="preload" href="\/shared\/nav\.js\?v=0\.1\.45"/);
  assert.match(injected, /localStorage.getItem\("xm-theme"\)/);
  const login = withSharedShell('<html><head></head><body class="login-page"></body></html>');
  assert.doesNotMatch(login, /\/shared\/nav\.js/);
  assert.match(login, /localStorage.getItem\("xm-theme"\)/);
  const serverJs = readFileSync(join(root, "src/server.js"), "utf8");
  assert.match(serverJs, /keepAliveTimeout = 65_000/);
  assert.match(serverJs, /startMysql/);
  const authSrc = readFileSync(join(root, "src/modules/profile/auth.js"), "utf8");
  assert.match(authSrc, /MYSQL_HOST/);
  assert.match(authSrc, /CREATE TABLE IF NOT EXISTS han_tasks/);
  assert.match(authSrc, /CREATE TABLE IF NOT EXISTS xm_users/);
  assert.match(serverJs, /notes-store\.js/);
  const mid = readFileSync(join(root, "src/modules/profile/middleware.js"), "utf8");
  assert.match(mid, /HTML_CACHE_MS = 60_000/);
  assert.match(mid, /HAN_API_CACHE_MS = 2500/);
  assert.match(mid, /nav\.js\?v=\$\{SHELL_ASSET_VER\}/);
  assert.match(mid, /woff2\?/);
  const authJs = readFileSync(join(root, "src/modules/profile/auth.js"), "utf8");
  assert.match(authJs, /scryptAsync/);
  assert.match(authJs, /async function verifyPassword/);
  assert.match(authJs, /function hashPasswordSync/);
  const meHtml = readFileSync(join(root, "public/me.html"), "utf8");
  assert.match(meHtml, /sessionStorage\.getItem\("xm-me"\)/);
  assert.match(meHtml, /__xmMeAt/);
});
