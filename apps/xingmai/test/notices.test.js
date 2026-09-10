import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";

const server = createApp().listen(0);
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

after(() => server.close());

async function login() {
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "luocheng", password: "ChangeMe123!" })
  });
  assert.equal(res.status, 200);
  return String(res.headers.get("set-cookie") || "").split(";")[0];
}

test("notices API lists seed announcements and banner", async () => {
  const cookie = await login();
  const list = await fetch(`${base}/api/notices`, { headers: { cookie } });
  assert.equal(list.status, 200);
  const data = await list.json();
  assert.equal(data.ok, true);
  assert.ok(data.items.some((item) => item.title === "公司周年庆典"));
  const banner = await fetch(`${base}/api/notices/banner`, { headers: { cookie } });
  const bannerData = await banner.json();
  assert.ok(bannerData.items.length >= 1);
  assert.ok(bannerData.items.every((item) => item.level === "normal" || item.level === "important"));
  const popup = await fetch(`${base}/api/notices/popup`, { headers: { cookie } });
  const popupData = await popup.json();
  assert.ok(popupData.item);
});

test("notices page is in the people submenu", async () => {
  const cookie = await login();
  const res = await fetch(`${base}/notices`, { headers: { cookie } });
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /公告中心/);
  assert.match(html, /data-xm-group="\/people"/);
  assert.match(html, /href="\/notices"/);
  assert.match(html, /\/shared\/modules\/notices\.js/);
});
