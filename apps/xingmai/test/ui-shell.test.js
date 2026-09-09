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
  const versionedJs = await fetch(`${base}/shared/nav.js?v=0.1.108`);
  assert.match(String(versionedJs.headers.get("cache-control") || ""), /max-age=86400/);
  const logo = await fetch(`${base}/shared/xingmai-logo.png`);
  assert.equal(logo.status, 200);
  const logoBytes = Buffer.from(await logo.arrayBuffer());
  assert.equal(logoBytes.subarray(0, 4).toString("binary"), "\x89PNG");
  const tabLogo = await fetch(`${base}/tab-logo.png`);
  assert.equal(tabLogo.status, 200);
  const tabBytes = Buffer.from(await tabLogo.arrayBuffer());
  assert.equal(tabBytes.subarray(0, 4).toString("binary"), "\x89PNG");
  const tabSvg = await fetch(`${base}/tab-logo.svg`);
  assert.equal(tabSvg.status, 200);
  assert.match(await tabSvg.text(), /<svg[\s>]/);
  const cssText = await css.text();
  const jsText = await js.text();
  assert.doesNotMatch(jsText, /xm-shell-modules/);
  assert.doesNotMatch(jsText.slice(0, 80), /0\.1\.67/);
  assert.match(cssText, /\.xm-sider/);
  assert.match(cssText, /\.xm-brand/);
  assert.match(cssText, /--xm-primary: #1677ff/);
  assert.match(cssText, /background: var\(--xm-primary\)/);
  assert.match(cssText, /html\[data-theme="dark"\]/);
  assert.match(cssText, /html\[data-theme="pink"\]/);
  assert.match(cssText, /#f8005f/);
  assert.match(cssText, /#14120b/);
  assert.match(cssText, /#f7f7f4/);
  assert.match(cssText, /\.kicker \{\s*display: none;/);
  assert.match(jsText, /<svg viewBox="0 0 24 24"/);
  assert.match(jsText, /login-logo\.png/);
  assert.match(jsText, /xingmai-logo\.png/);
  assert.match(jsText, /xm-fast-shell 0\.1\.112/);
  assert.match(jsText, /data-xm-style/);
  assert.match(jsText, /甄选粉/);
  assert.match(jsText, /setInterval\(tickClock, 1000\)/);
  assert.match(jsText, /星脉甄选运营中心/);
  assert.doesNotMatch(jsText, /labelOf\(current\) \+ " · 星脉甄选"/);
  assert.match(jsText, /\/login\?out=1/);
  assert.match(jsText, /href="\/me"/);
  assert.match(jsText, /id="xm-date"/);
  assert.match(jsText, /id="xm-refresh"/);
  assert.match(jsText, /展开侧栏/);
  assert.match(cssText, /xm-sider-narrow 0\.1\.112/);
  assert.match(cssText, /\.xm-menu-parent/);
  assert.match(cssText, /\.xm-submenu/);
  assert.match(cssText, /--xm-sider-w: 200px/);
  assert.doesNotMatch(cssText, /html\.xm-collapsed \.xm-collapse \{\s*display: none/);
  assert.match(jsText, /XmModules/);
  assert.match(jsText, /data-xm-mounted/);
  assert.match(jsText, /__xmBootUser/);
  assert.doesNotMatch(jsText, /rel=["']prefetch["']/);
  assert.doesNotMatch(jsText, /ROUTES\.forEach/);
  assert.doesNotMatch(jsText, /菜单标签">项目<|>项目<\/p>/);
  assert.doesNotMatch(jsText, /xm-menu-label">项目/);
  assert.match(jsText, /退出登录/);
  assert.match(jsText, /v0\.4\.17/);
  assert.match(jsText, /数据总揽/);
  assert.match(jsText, /店铺数据/);
  assert.match(jsText, /选品中心/);
  assert.match(jsText, /商品成长/);
  assert.match(jsText, /任务管理/);
  assert.match(jsText, /选品数据/);
  assert.match(jsText, /商品数据/);
  assert.match(jsText, /实时付费/);
  assert.match(jsText, /培训系统/);
  assert.match(jsText, /xm-menu-parent/);
  assert.match(jsText, /label: \"首页\"/);
  assert.match(jsText, /href: \"\/home\"/);
  assert.match(jsText, /组织中心/);
  assert.doesNotMatch(jsText, /<span>人员管理<\/span>/);
  assert.match(jsText, /甄选商学院/);
  assert.match(jsText, /培训课程/);
  assert.match(jsText, /培训考试/);
  assert.match(jsText, /运营手册/);
  assert.match(jsText, /甄选智能体/);
  assert.match(jsText, /版本发布中心/);
  assert.match(jsText, /个人中心/);
  assert.match(jsText, /data-xm-queue-badge/);
  assert.match(jsText, /\/api\/releases\/queue/);
  assert.match(cssText, /\.xm-queue-badge/);
  assert.match(cssText, /#ff4d4f/);
  assert.match(jsText, /items\.slice\(0, 6\)/);
  assert.doesNotMatch(jsText, /items\.slice\(0, 5\)/);
  const itemsBlock = jsText.match(/const items = \[([\s\S]*?)\];/)[1];
  const homeAt = itemsBlock.indexOf('href: "/home"');
  const dataAt = itemsBlock.indexOf('href: "/data"');
  const peopleAt = itemsBlock.indexOf('href: "/people"');
  const releasesAt = itemsBlock.indexOf('href: "/releases"');
  const meAt = itemsBlock.indexOf('href: "/me"');
  const academyAt = itemsBlock.indexOf('href: "/academy"');
  const agentsAt = itemsBlock.indexOf('href: "/agents"');
  assert.ok(homeAt > -1 && dataAt > homeAt);
  assert.ok(academyAt > -1 && agentsAt > academyAt && releasesAt > agentsAt);
  assert.ok(releasesAt > -1 && peopleAt > releasesAt && meAt > peopleAt);
  assert.doesNotMatch(jsText, /id="xm-theme"/);
  assert.doesNotMatch(jsText, />暗色</);
  assert.doesNotMatch(jsText, /id="xm-logout">退出</);
  const homeHtml = readFileSync(join(root, "public/index.html"), "utf8");
  assert.match(homeHtml, /星脉甄选/);
  assert.doesNotMatch(homeHtml, /xm-menu-label">项目/);
  assert.doesNotMatch(homeHtml, />项目</);
  assert.match(homeHtml, /退出登录/);
  assert.match(homeHtml, /v0\.4\.5/);
  // leftover index.html is unused; live sider 首页 is /home, not this file
  assert.match(homeHtml, /<svg viewBox="0 0 24 24"/);
  assert.doesNotMatch(homeHtml, /aria-label="模块入口"/);
  assert.doesNotMatch(homeHtml, /class="cards"/);
  assert.doesNotMatch(homeHtml, />退出</);
  assert.doesNotMatch(homeHtml, />暗色</);
  assert.doesNotMatch(homeHtml, /rel="prefetch"/);
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
  assert.doesNotMatch(html, /\/shared\/nav\.js/);
  assert.doesNotMatch(html, /\/shared\/layout\.css/);
});

test("home page html is the xingmai sider template", async () => {
  const cookieRes = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "luocheng", password: "ChangeMe123!" })
  });
  assert.equal(cookieRes.status, 200);
  const cookie = String(cookieRes.headers.get("set-cookie") || "").split(";")[0];
  const bounce = await fetch(`${base}/`, { headers: { cookie }, redirect: "manual" });
  assert.equal(bounce.status, 302);
  assert.equal(bounce.headers.get("location"), "/data");
  const dataBounce = await fetch(`${base}/data`, { headers: { cookie }, redirect: "manual" });
  assert.equal(dataBounce.status, 302);
  assert.equal(dataBounce.headers.get("location"), "/data/overview");
  const res = await fetch(`${base}/data/overview`, { headers: { cookie } });
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /xingmai-logo\.png/);
  assert.doesNotMatch(html, /xm-menu-label">项目/);
  assert.doesNotMatch(html, />项目</);
  assert.match(html, /<span>首页<\/span>/);
  assert.match(html, /href="\/home"/);
  const homePage = await fetch(`${base}/home`, { headers: { cookie } });
  assert.equal(homePage.status, 200);
  const homePageHtml = await homePage.text();
  assert.match(homePageHtml, /\/shared\/modules\/home\.js/);
  assert.match(homePageHtml, /<span>首页<\/span>/);
  assert.match(html, /退出登录/);
  assert.match(html, /v0\.4\.17/);
  assert.match(html, /甄选商学院/);
  assert.match(html, /培训课程/);
  assert.match(html, /培训考试/);
  assert.match(html, /运营手册/);
  assert.match(html, /甄选智能体/);
  assert.match(html, /数据总揽/);
  assert.match(html, /店铺数据/);
  assert.match(html, /选品中心/);
  assert.match(html, /商品成长/);
  assert.match(html, /任务管理/);
  assert.match(html, /选品数据/);
  assert.match(html, /商品数据/);
  assert.match(html, /实时付费/);
  assert.match(html, /培训系统/);
  assert.match(html, /xm-menu-parent/);
  assert.match(html, /xm-caret/);
  assert.match(html, /\/shared\/nav\.js\?v=0\.1\.112/);
  assert.match(html, /data-xm-style="pink"/);
  assert.match(html, /aria-label="页面风格"/);
  assert.match(html, /data-xm-queue-badge/);
  assert.match(html, /__xmBootUser/);
  assert.match(html, /login-logo\.png/);
  assert.match(html, /id="xm-date"/);
  assert.match(html, /id="xm-refresh"/);
  assert.match(html, /href="\/me"/);
  assert.match(html, /<svg viewBox="0 0 24 24"/);
  assert.doesNotMatch(html, /id="xm-theme"/);
  assert.match(html, /xm-app-shell/);
  assert.match(html, /<title>星脉甄选运营中心<\/title>/);
  assert.doesNotMatch(html, /<title>数据中心 · 星脉甄选<\/title>/);
  assert.match(html, /rel="icon" type="image\/png" href="data:image\/png;base64,/);
  assert.doesNotMatch(html, /rel="icon"[^>]+href="\/login-logo\.png"/);
});

test("韩梦凯运营中心 expands four placeholder children", async () => {
  const cookieRes = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "luocheng", password: "ChangeMe123!" })
  });
  assert.equal(cookieRes.status, 200);
  const cookie = String(cookieRes.headers.get("set-cookie") || "").split(";")[0];
  const bounce = await fetch(`${base}/han`, { headers: { cookie }, redirect: "manual" });
  assert.equal(bounce.status, 302);
  assert.equal(bounce.headers.get("location"), "/han/selection");
  const res = await fetch(`${base}/han/selection`, { headers: { cookie } });
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /xm-menu-group is-open/);
  assert.match(html, /选品数据/);
  assert.match(html, /商品数据/);
  assert.match(html, /实时付费/);
  assert.match(html, /培训系统/);
  assert.match(html, /\/shared\/modules\/han\.js/);
  assert.match(html, /<title>星脉甄选运营中心<\/title>/);
  const paid = await fetch(`${base}/han/paid`, { headers: { cookie } });
  assert.equal(paid.status, 200);
  const hanMod = readFileSync(join(root, "public/shared/modules/han.js"), "utf8");
  assert.match(hanMod, /内容待开发/);
  assert.match(hanMod, /XmModules\["\/han\/training"\]/);
});

test("沈子晗运营中心 expands five placeholder children", async () => {
  const cookieRes = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "luocheng", password: "ChangeMe123!" })
  });
  assert.equal(cookieRes.status, 200);
  const cookie = String(cookieRes.headers.get("set-cookie") || "").split(";")[0];
  const bounce = await fetch(`${base}/shen`, { headers: { cookie }, redirect: "manual" });
  assert.equal(bounce.status, 302);
  assert.equal(bounce.headers.get("location"), "/shen/selection");
  const res = await fetch(`${base}/shen/selection`, { headers: { cookie } });
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /data-xm-group="\/shen"/);
  assert.match(html, /xm-menu-group is-open/);
  assert.match(html, /选品中心/);
  assert.match(html, /商品成长/);
  assert.match(html, /实时付费/);
  assert.match(html, /培训系统/);
  assert.match(html, /任务管理/);
  assert.match(html, /\/shared\/modules\/shen\.js/);
  assert.match(html, /<title>星脉甄选运营中心<\/title>/);
  const growth = await fetch(`${base}/shen/growth`, { headers: { cookie } });
  assert.equal(growth.status, 200);
  const tasks = await fetch(`${base}/shen/tasks`, { headers: { cookie } });
  assert.equal(tasks.status, 200);
  const shenMod = readFileSync(join(root, "public/shared/modules/shen.js"), "utf8");
  assert.match(shenMod, /内容待开发/);
  assert.match(shenMod, /XmModules\["\/shen\/selection"\]/);
  assert.match(shenMod, /XmModules\["\/shen\/growth"\]/);
  assert.match(shenMod, /XmModules\["\/shen\/paid"\]/);
  assert.match(shenMod, /XmModules\["\/shen\/training"\]/);
  assert.match(shenMod, /XmModules\["\/shen\/tasks"\]/);
});

test("数据中心 expands four placeholder children", async () => {
  const cookieRes = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "luocheng", password: "ChangeMe123!" })
  });
  assert.equal(cookieRes.status, 200);
  const cookie = String(cookieRes.headers.get("set-cookie") || "").split(";")[0];
  const bounce = await fetch(`${base}/data`, { headers: { cookie }, redirect: "manual" });
  assert.equal(bounce.status, 302);
  assert.equal(bounce.headers.get("location"), "/data/overview");
  const slash = await fetch(`${base}/data/`, { headers: { cookie }, redirect: "manual" });
  assert.equal(slash.status, 302);
  assert.equal(slash.headers.get("location"), "/data/overview");
  const res = await fetch(`${base}/data/overview`, { headers: { cookie } });
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /data-xm-group="\/data"/);
  assert.match(html, /xm-menu-group is-open/);
  assert.match(html, /数据总揽/);
  assert.match(html, /店铺数据/);
  assert.match(html, /商品数据/);
  assert.match(html, /实时付费/);
  assert.match(html, /\/shared\/modules\/data\.js/);
  assert.match(html, /<title>星脉甄选运营中心<\/title>/);
  const shops = await fetch(`${base}/data/shops`, { headers: { cookie } });
  assert.equal(shops.status, 200);
  const paid = await fetch(`${base}/data/paid`, { headers: { cookie } });
  assert.equal(paid.status, 200);
  const dataMod = readFileSync(join(root, "public/shared/modules/data.js"), "utf8");
  assert.match(dataMod, /内容待开发/);
  assert.match(dataMod, /XmModules\["\/data\/overview"\]/);
  assert.match(dataMod, /XmModules\["\/data\/shops"\]/);
  assert.match(dataMod, /XmModules\["\/data\/goods"\]/);
  assert.match(dataMod, /XmModules\["\/data\/paid"\]/);
});

test("甄选商学院 expands three children and 甄选智能体 stays a leaf", async () => {
  const cookieRes = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "luocheng", password: "ChangeMe123!" })
  });
  assert.equal(cookieRes.status, 200);
  const cookie = String(cookieRes.headers.get("set-cookie") || "").split(";")[0];
  const academyBounce = await fetch(`${base}/academy`, { headers: { cookie }, redirect: "manual" });
  assert.equal(academyBounce.status, 302);
  assert.equal(academyBounce.headers.get("location"), "/academy/courses");
  const academy = await fetch(`${base}/academy/courses`, { headers: { cookie } });
  assert.equal(academy.status, 200);
  const academyHtml = await academy.text();
  assert.match(academyHtml, /甄选商学院/);
  assert.match(academyHtml, /培训课程/);
  assert.match(academyHtml, /培训考试/);
  assert.match(academyHtml, /运营手册/);
  assert.match(academyHtml, /href="\/academy\/courses"/);
  assert.match(academyHtml, /href="\/academy\/exams"/);
  assert.match(academyHtml, /href="\/academy\/handbook"/);
  assert.match(academyHtml, /甄选智能体/);
  assert.match(academyHtml, /组织中心/);
  assert.doesNotMatch(academyHtml, /<span>人员管理<\/span>/);
  const mainNav = academyHtml.match(/<nav class="xm-menu xm-menu-main">[\s\S]*?<\/nav>/)[0];
  const footNav = academyHtml.match(/<nav class="xm-menu xm-menu-foot">[\s\S]*?<\/nav>/)[0];
  assert.doesNotMatch(mainNav, /组织中心/);
  assert.doesNotMatch(mainNav, /href="\/people"/);
  assert.match(mainNav, /data-xm-group="\/academy"/);
  assert.ok(footNav.indexOf('href="/releases"') < footNav.indexOf('href="/people"'));
  assert.ok(footNav.indexOf('href="/people"') < footNav.indexOf('href="/me"'));
  assert.ok(footNav.indexOf('href="/me"') < footNav.indexOf("退出登录"));
  assert.match(academyHtml, /\/shared\/modules\/academy\.js/);
  assert.match(academyHtml, /id="xm-content"/);
  assert.match(academyHtml, /<title>星脉甄选运营中心<\/title>/);
  assert.match(academyHtml, /<span>首页<\/span>/);
  const exams = await fetch(`${base}/academy/exams`, { headers: { cookie } });
  assert.equal(exams.status, 200);
  const handbook = await fetch(`${base}/academy/handbook`, { headers: { cookie } });
  assert.equal(handbook.status, 200);
  const agents = await fetch(`${base}/agents`, { headers: { cookie } });
  assert.equal(agents.status, 200);
  const agentsHtml = await agents.text();
  assert.match(agentsHtml, /\/shared\/modules\/agents\.js/);
  assert.match(agentsHtml, /甄选智能体/);
  const academyMod = readFileSync(join(root, "public/shared/modules/academy.js"), "utf8");
  const agentsMod = readFileSync(join(root, "public/shared/modules/agents.js"), "utf8");
  assert.match(academyMod, /XmModules\["\/academy"\]/);
  assert.match(academyMod, /XmModules\["\/academy\/courses"\]/);
  assert.match(academyMod, /XmModules\["\/academy\/exams"\]/);
  assert.match(academyMod, /XmModules\["\/academy\/handbook"\]/);
  assert.match(agentsMod, /XmModules\["\/agents"\]/);
  const academyApi = await fetch(`${base}/api/academy`, { headers: { cookie } });
  assert.equal(academyApi.status, 200);
  assert.equal((await academyApi.json()).module, "甄选商学院");
  const agentsApi = await fetch(`${base}/api/agents`, { headers: { cookie } });
  assert.equal(agentsApi.status, 200);
  assert.equal((await agentsApi.json()).module, "甄选智能体");
});

test("版本发布中心 sider shows a queue badge hooked to pending tickets", async () => {
  const cookieRes = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "luocheng", password: "ChangeMe123!" })
  });
  assert.equal(cookieRes.status, 200);
  const cookie = String(cookieRes.headers.get("set-cookie") || "").split(";")[0];
  const page = await fetch(`${base}/people`, { headers: { cookie } });
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /href="\/releases"/);
  assert.match(html, /data-xm-queue-badge/);
  assert.match(html, /版本发布中心/);
  assert.doesNotMatch(html, /\/shared\/nav\.js">版本发布中心/);
  const queue = await fetch(`${base}/api/releases/queue`, { headers: { cookie } });
  assert.equal(queue.status, 200);
  const body = await queue.json();
  assert.equal(body.ok, true);
  assert.ok(Array.isArray(body.items));
  const login = await fetch(`${base}/login`);
  const loginHtml = await login.text();
  assert.doesNotMatch(loginHtml, /data-xm-queue-badge/);
  assert.doesNotMatch(loginHtml, /\/shared\/nav\.js/);
  assert.match(html, /组织中心/);
  assert.doesNotMatch(html, /<span>人员管理<\/span>/);
});

test("placeholder modules share the same shell assets", async () => {
  const cookieRes = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "luocheng", password: "ChangeMe123!" })
  });
  assert.equal(cookieRes.status, 200);
  const cookie = String(cookieRes.headers.get("set-cookie") || "").split(";")[0];
  const res = await fetch(`${base}/data/overview`, { headers: { cookie } });
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /\/shared\/layout\.css/);
  assert.match(html, /\/shared\/nav\.js/);
  assert.doesNotMatch(html, /site-header/);
  assert.match(html, /\/shared\/modules\/data\.js/);
  assert.match(html, /id="xm-content"/);
  assert.doesNotMatch(html, /今日订单/);
  const releases = await fetch(`${base}/releases`, { headers: { cookie } });
  assert.equal(releases.status, 200);
  const releasesHtml = await releases.text();
  assert.match(releasesHtml, /\/shared\/nav\.js/);
  assert.match(releasesHtml, /\/shared\/modules\/releases\.js/);
  assert.match(releasesHtml, /xm-app-shell/);
  const releasesMod = readFileSync(join(root, "public/shared/modules/releases.js"), "utf8");
  assert.match(releasesMod, /timeZone: "Asia\/Shanghai"/);
  assert.match(releasesMod, /function formatChinaTime/);
  assert.match(releasesMod, /xm-china-time 0\.1\.27/);
  assert.match(releasesMod, /xm-upgrade-mask 0\.1\.45/);
  assert.match(releasesMod, /id="upgrade-dismiss"/);
  assert.match(releasesMod, /function pinUpgradeMask\(/);
  assert.match(releasesMod, /function maskEl\(/);
  assert.match(releasesMod, /document\.documentElement\.appendChild/);
  assert.match(releasesMod, /display: flex !important/);
  assert.match(releasesMod, /#upgrade-mask\.can-close #upgrade-dismiss/);
  assert.match(releasesMod, /position: absolute/);
  assert.match(releasesMod, /background: var\(--xm-card/);
  assert.doesNotMatch(releasesMod, /replace\("Z", " UTC"\)/);
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
  assert.match(pagesSrc, /renderAppShell/);
  assert.match(pagesSrc, /typeof profileShell\.renderAppShell/);
  assert.doesNotMatch(pagesSrc, /import \{[^}]*readThemedHtml/);
  const injected = withSharedShell(
    '<!DOCTYPE html><html><head></head><body class="oc-page"><div class="oc-tab">待上线</div></body></html>'
  );
  assert.match(injected, /\/shared\/layout\.css/);
  assert.match(injected, /\/shared\/nav\.js\?v=0\.1\.112/);
  assert.match(injected, /rel="preload" href="\/shared\/nav\.js\?v=0\.1\.112"/);
  assert.match(injected, /localStorage.getItem\("xm-theme"\)/);
  const login = withSharedShell('<html><head></head><body class="login-page"></body></html>');
  assert.doesNotMatch(login, /\/shared\/nav\.js/);
  assert.match(login, /localStorage.getItem\("xm-theme"\)/);
  const realLogin = withSharedShell(readFileSync(join(root, "public/login.html"), "utf8"));
  assert.doesNotMatch(realLogin, /\/shared\/nav\.js/);
  assert.doesNotMatch(realLogin, /\/shared\/layout\.css/);
  const themedLogin = readThemedHtml(join(root, "public/login.html"));
  assert.doesNotMatch(themedLogin, /\/shared\/nav\.js/);
  assert.doesNotMatch(themedLogin, /\/shared\/layout\.css/);
  const serverJs = readFileSync(join(root, "src/server.js"), "utf8");
  assert.match(serverJs, /keepAliveTimeout = 65_000/);
  assert.match(serverJs, /startMysql/);
  const notesSrc = readFileSync(join(root, "src/notes-store.js"), "utf8");
  assert.match(notesSrc, /export function createNotesStore/);
  const authSrc = readFileSync(join(root, "src/modules/profile/auth.js"), "utf8");
  assert.match(authSrc, /MYSQL_HOST/);
  assert.match(authSrc, /CREATE TABLE IF NOT EXISTS han_tasks/);
  assert.match(authSrc, /CREATE TABLE IF NOT EXISTS xm_users/);
  assert.match(serverJs, /notes-store\.js/);
  const mid = readFileSync(join(root, "src/modules/profile/middleware.js"), "utf8");
  assert.match(mid, /HTML_CACHE_MS = 60_000/);
  assert.match(mid, /HAN_API_CACHE_MS = 2500/);
  assert.match(mid, /\/api\/data\/overview/);
  assert.match(mid, /\/api\/releases\/queue/);
  assert.match(mid, /shared\/modules\//);
  assert.match(mid, /nav\.js\?v=\$\{SHELL_ASSET_VER\}/);
  assert.match(mid, /woff2\?/);
  const authJs = readFileSync(join(root, "src/modules/profile/auth.js"), "utf8");
  assert.match(authJs, /scryptAsync/);
  assert.match(authJs, /async function verifyPassword/);
  assert.match(authJs, /function hashPasswordSync/);
  assert.match(authJs, /dropSession\(sid\)\.catch/);
  assert.doesNotMatch(authJs, /await dropSession/);
  assert.match(authJs, /persistSession\([\s\S]*\)\.catch/);
  assert.doesNotMatch(authJs, /await persistSession/);
  assert.match(authJs, /connectTimeout: 2000/);
  const meHtml = readFileSync(join(root, "public/me.html"), "utf8");
  assert.match(meHtml, /sessionStorage\.getItem\("xm-me"\)/);
  assert.match(meHtml, /__xmMeAt/);
  const meMod = readFileSync(join(root, "public/shared/modules/me.js"), "utf8");
  assert.match(meMod, /sessionStorage\.getItem\("xm-me"\)/);
  assert.match(meMod, /__xmMeAt/);
  const homeMod = readFileSync(join(root, "public/shared/modules/home.js"), "utf8");
  assert.match(homeMod, /功能待开发/);
  assert.match(homeMod, /XmModules\["\/home"\]/);
  const { renderAppShell } = await import("../src/modules/profile/middleware.js");
  const shell = renderAppShell("/data", { username: "罗成", displayName: "罗成" });
  assert.match(shell, /rel="icon" type="image\/png" href="data:image\/png;base64,/);
  assert.match(shell, /<title>星脉甄选运营中心<\/title>/);
  assert.match(shell, /xm-app-shell/);
  assert.match(shell, /\/shared\/modules\/data\.js\?v=0\.1\.112/);
  assert.match(shell, /data-xm-style="pink"/);
  assert.match(shell, /<span>首页<\/span>/);
  assert.match(shell, /href="\/home"/);
  assert.match(shell, /id="xm-content"/);
  assert.match(shell, /id="xm-date"/);
  assert.match(shell, /id="xm-refresh"/);
  assert.match(shell, /href="\/me"/);
  assert.match(shell, /XmModules/);
  assert.doesNotMatch(shell, /\/shared\/modules\/releases\.js/);
  assert.doesNotMatch(shell, /\/shared\/modules\/home\.js/);
  assert.doesNotMatch(shell, /releases\.css/);
  assert.match(shell, /__xmBootUser/);
  assert.doesNotMatch(shell, /今日订单/);
  const versionedMod = await fetch(`${base}/shared/modules/home.js?v=0.1.108`);
  assert.match(String(versionedMod.headers.get("cache-control") || ""), /max-age=86400/);
});
