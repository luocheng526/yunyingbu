import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createApp } from "../src/app.js";
import { addUserForTests, resetStoreForTests } from "../src/modules/profile/auth.js";
import { SHELL_ASSET_VER } from "../src/modules/profile/middleware.js";

const layoutCss = readFileSync(new URL("../public/shared/layout.css", import.meta.url), "utf8");
const navSrc = readFileSync(new URL("../public/shared/nav.js", import.meta.url), "utf8");

async function login(base, username, password = "ChangeMe123!") {
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  return { status: res.status, data, cookie: String(res.headers.get("set-cookie") || "").split(";")[0] };
}

test("登录后的业务页铺当前查看者水印，登录页没有", async () => {
  assert.equal(SHELL_ASSET_VER, "0.1.780-marklite");
  assert.match(layoutCss, /xm-watermark 0\.1\.779-watermark/);
  assert.match(layoutCss, /xm-mark-lite 0\.1\.780-marklite/);
  assert.match(layoutCss, /rgba\(140, 140, 140, 0\.28\)/);
  assert.doesNotMatch(layoutCss, /rgba\(89, 89, 89, 0\.34\)/);
  assert.match(layoutCss, /\.xm-watermark \{[\s\S]*pointer-events:\s*none/);
  assert.match(layoutCss, /\.xm-watermark \{[\s\S]*user-select:\s*none/);
  assert.match(layoutCss, /rotate\(-45deg\)/);
  assert.match(navSrc, /function paintWatermark\(/);
  assert.match(navSrc, /function clearWatermark\(/);
  assert.match(navSrc, /甄选：/);
  assert.match(navSrc, /clearWatermark\(\);\s*clearOpenTabs\(\)/);
  assert.doesNotMatch(navSrc, /localStorage\.setItem\("xm-watermark"/);

  resetStoreForTests();
  addUserForTests({ username: "沈子晗", displayName: "沈子晗", password: "ChangeMe123!" });
  const app = createApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  try {
    const guest = await fetch(`${base}/login`);
    const guestHtml = await guest.text();
    assert.equal(guest.status, 200);
    assert.doesNotMatch(guestHtml, /xm-watermark/);

    const luo = await login(base, "罗成");
    assert.equal(luo.status, 200);
    const luoName = luo.data.user.displayName || luo.data.user.username;
    const luoMark = `甄选：${luoName}`;
    const home = await fetch(`${base}/home`, { headers: { cookie: luo.cookie } });
    const homeHtml = await home.text();
    assert.equal(home.status, 200);
    assert.match(homeHtml, new RegExp(`data-xm-watermark="${luoMark}"`));
    assert.match(homeHtml, new RegExp(`id="xm-username"[^>]*>${luoName}<`));
    const marks = homeHtml.match(new RegExp(`<span>${luoMark}</span>`, "g")) || [];
    assert.ok(marks.length >= 80, `watermark cells ${marks.length}`);
    assert.doesNotMatch(homeHtml, /甄选:/);
    assert.doesNotMatch(homeHtml, /甄选：沈子晗/);

    const bound = await fetch(`${base}/bound`, { headers: { cookie: luo.cookie } });
    const boundHtml = await bound.text();
    assert.match(boundHtml, new RegExp(`data-xm-watermark="${luoMark}"`));

    const shen = await login(base, "沈子晗");
    assert.equal(shen.status, 200);
    const shenHome = await fetch(`${base}/home`, { headers: { cookie: shen.cookie } });
    const shenHtml = await shenHome.text();
    assert.match(shenHtml, /data-xm-watermark="甄选：沈子晗"/);
    assert.match(shenHtml, /id="xm-username"[^>]*>沈子晗</);
    assert.doesNotMatch(shenHtml, /甄选：罗成/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
