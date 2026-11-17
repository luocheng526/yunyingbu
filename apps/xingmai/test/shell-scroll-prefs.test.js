import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createApp } from "../src/app.js";
import { addUserForTests, resetStoreForTests } from "../src/modules/profile/auth.js";
import { SHELL_ASSET_VER } from "../src/modules/profile/middleware.js";
import { resetPrefsForTests } from "../src/modules/profile/prefs.js";

const layoutCss = fs.readFileSync(new URL("../public/shared/layout.css", import.meta.url), "utf8");
const navSrc = fs.readFileSync(new URL("../public/shared/nav.js", import.meta.url), "utf8");
const peopleSrc = fs.readFileSync(new URL("../public/shared/modules/people.js", import.meta.url), "utf8");

async function login(base, username, password = "ChangeMe123!") {
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  return { status: res.status, data, cookie: String(res.headers.get("set-cookie") || "").split(";")[0] };
}

test("壳层工作区是唯一滚轮，不靠首页是否挂载", () => {
  assert.equal(SHELL_ASSET_VER, "0.1.785-mever");
  assert.match(layoutCss, /\.xm-workspace\s*\{/);
  assert.match(layoutCss, /\.xm-workspace > \.xm-pane\.is-active/);
  assert.match(layoutCss, /overflow:\s*auto/);
  assert.match(layoutCss, /\.xm-shell \{[\s\S]*overflow:\s*hidden/);
  assert.match(layoutCss, /\.xm-main \{[\s\S]*min-height:\s*0/);
  assert.match(navSrc, /\/api\/auth\/prefs/);
  assert.match(navSrc, /bootPrefs\(\)\.theme/);
  assert.doesNotMatch(navSrc, /localStorage\.setItem\("xm-theme"/);
  assert.doesNotMatch(navSrc, /localStorage\.setItem\("xm-sider-collapsed"/);
  assert.doesNotMatch(navSrc, /localStorage\.getItem\("xm-open-tabs"/);
});

test("组织中心表格由工作区滚，不改 people.js", () => {
  assert.match(layoutCss, /xm-org-scroll 0\.1\.772-orgscroll/);
  assert.match(
    layoutCss,
    /html body:has\(\.xm-shell\):has\(\.people-page\) \.xm-main \{[\s\S]*overflow-y:\s*hidden\s*!important/
  );
  assert.match(
    layoutCss,
    /html body:has\(\.xm-shell\):has\(\.people-page\) \.xm-workspace \{[\s\S]*overflow-y:\s*auto\s*!important/
  );
  assert.match(navSrc, /id = "xm-org-scroll-css"/);
  assert.match(navSrc, /wrap\.scrollTop \+= event\.deltaY/);
  assert.match(navSrc, /ASSET_VER = "0\.1\.785-mever"/);
  assert.match(peopleSrc, /overflow-y:auto!important/);
  assert.match(peopleSrc, /#xm-content:has\(\.people-page\)\{flex:0 0 auto;height:auto;overflow:visible!important/);
  assert.match(peopleSrc, /\.org-table-wrap\{overflow:visible!important/);
});

test("蓝夜粉、侧栏、页签跟账号走服务器，换人不会带走", async () => {
  resetStoreForTests();
  resetPrefsForTests();
  addUserForTests({ username: "张璇", displayName: "张璇", password: "ChangeMe123!" });

  const app = createApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  try {
    const staff = await login(base, "罗成");
    assert.equal(staff.status, 200);
    const saved = await fetch(`${base}/api/auth/prefs`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie: staff.cookie },
      body: JSON.stringify({
        theme: "pink",
        siderCollapsed: true,
        tabs: { hrefs: ["/home", "/data/overview"], active: "/home" }
      })
    });
    const savedBody = await saved.json();
    assert.equal(saved.status, 200);
    assert.equal(savedBody.prefs.theme, "pink");
    assert.equal(savedBody.prefs.siderCollapsed, true);
    assert.deepEqual(savedBody.prefs.tabs.hrefs, ["/home", "/data/overview"]);

    const other = await login(base, "张璇");
    const otherPrefs = await fetch(`${base}/api/auth/prefs`, { headers: { cookie: other.cookie } });
    const otherBody = await otherPrefs.json();
    assert.equal(otherPrefs.status, 200);
    assert.equal(otherBody.prefs.theme, "light");
    assert.equal(otherBody.prefs.siderCollapsed, false);
    assert.deepEqual(otherBody.prefs.tabs.hrefs, []);

    const staffPage = await fetch(`${base}/home`, { headers: { cookie: staff.cookie } });
    const staffHtml = await staffPage.text();
    assert.equal(staffPage.status, 200);
    assert.match(staffHtml, /"theme":"pink"/);
    assert.match(staffHtml, /"siderCollapsed":true/);
    assert.match(staffHtml, /class="xm-workspace"/);
    assert.match(staffHtml, /id="xm-content"/);

    const peoplePage = await fetch(`${base}/people`, { headers: { cookie: staff.cookie } });
    const peopleHtml = await peoplePage.text();
    assert.equal(peoplePage.status, 200);
    assert.match(peopleHtml, /layout\.css\?v=0\.1\.785-mever/);
    assert.match(peopleHtml, /nav\.js\?v=0\.1\.785-mever/);
    assert.match(peopleHtml, /class="xm-workspace"/);

    const hrPage = await fetch(`${base}/hr`, { headers: { cookie: other.cookie } });
    const hrHtml = await hrPage.text();
    assert.equal(hrPage.status, 200);
    assert.match(hrHtml, /"theme":"light"/);
    assert.doesNotMatch(hrHtml, /"theme":"pink"/);
    assert.match(hrHtml, /class="xm-workspace"/);
    assert.match(hrHtml, /xm-content xm-pane is-active/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
