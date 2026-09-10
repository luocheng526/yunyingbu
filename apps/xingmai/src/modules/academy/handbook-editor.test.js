import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { createApp } from "../../app.js";
import { resetStoreForTests } from "../profile/auth.js";
import { resetHandbookForTests } from "./handbook-store.js";
import { resetHandbookLogsForTests } from "./log-store.js";

const server = createApp().listen(0);
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;
const js = await readFile(new URL("../../../public/shared/modules/academy.js", import.meta.url), "utf8");
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

before(async () => {
  resetStoreForTests();
  await resetHandbookForTests();
  await resetHandbookLogsForTests();
});

after(async () => {
  await resetHandbookForTests();
  await resetHandbookLogsForTests();
  await new Promise((resolve) => server.close(resolve));
});

async function loginCookie() {
  resetStoreForTests();
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "罗成", password: "ChangeMe123!" })
  });
  assert.equal(res.status, 200);
  return String(res.headers.get("set-cookie") || "").split(";")[0];
}

function imageForm(id) {
  const boundary = "----XmHand7e72";
  const head = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="dot.png"\r\nContent-Type: image/png\r\n\r\n`;
  return {
    body: Buffer.concat([Buffer.from(head), png, Buffer.from(`\r\n--${boundary}--\r\n`)]),
    type: `multipart/form-data; boundary=${boundary}`
  };
}

test("academy.js opens the handbook editor", () => {
  assert.match(js, /\/api\/academy\/handbook\/sections\//);
  assert.match(js, /添加子菜单/);
  assert.match(js, /academy-tree-add/);
  assert.match(js, /handbook\/reorder/);
  assert.match(js, /draggable/);
  assert.match(js, /draggable=\"true\"/);
  assert.match(js, /星脉甄选商学院/);
  assert.match(js, /academy-console/);
  assert.match(js, /插入图片/);
  assert.match(js, /academy-tab/);
  assert.match(js, /双击/);
  assert.match(js, /stripLogMenu/);
  assert.doesNotMatch(js, /data-academy-logs/);
  assert.doesNotMatch(js, /XmModules\["\/academy\/logs"\]/);
  assert.doesNotMatch(js, /文档编辑区（下一步）/);
  assert.doesNotMatch(js, /第 1 步/);
  assert.doesNotMatch(js, /第 4 步/);
});

test("plan is live; write body, add branch, insert image", async () => {
  const cookie = await loginCookie();
  await resetHandbookForTests();
  await resetHandbookLogsForTests();
  const headers = { cookie, Accept: "application/json" };
  const plan = await (await fetch(`${base}/api/academy/plan`, { headers })).json();
  assert.equal(plan.ready, true);
  const tree = await (await fetch(`${base}/api/academy/handbook/tree`, { headers })).json();
  assert.ok(tree.tree.some((n) => n.title === "选品与商品" && n.children.length));
  const saved = await fetch(`${base}/api/academy/handbook/sections/goods-title`, {
    method: "POST",
    headers: { cookie, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ title: "标题与类目", body: "标题前 30 字放核心卖点。" })
  });
  assert.equal(saved.status, 200);
  const section = (await saved.json()).section;
  assert.match(section.body, /核心卖点/);
  const branchRes = await fetch(`${base}/api/academy/handbook/branches`, {
    method: "POST",
    headers: { cookie, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ parentId: "goods-title", title: "测款第一周" })
  });
  assert.equal(branchRes.status, 201);
  const branch = await branchRes.json();
  assert.equal(branch.section.title, "测款第一周");
  const packed = imageForm(section.id);
  const imgRes = await fetch(`${base}/api/academy/handbook/sections/goods-title/images`, {
    method: "POST",
    headers: { cookie, Accept: "application/json", "Content-Type": packed.type },
    body: packed.body
  });
  assert.equal(imgRes.status, 201);
  const withImg = await imgRes.json();
  assert.equal(withImg.section.images.length, 1);
  const media = await fetch(`${base}${withImg.section.images[0].url}`, { headers: { cookie } });
  assert.equal(media.status, 200);
  assert.match(media.headers.get("content-type") || "", /image\/png/);
  const again = await (await fetch(`${base}/api/academy/handbook/tree`, { headers })).json();
  const goods = again.tree.find((n) => n.id === "goods");
  const titleNode = goods.children.find((n) => n.id === "goods-title");
  assert.equal(titleNode.hasBody, true);
  assert.ok(titleNode.children.some((n) => n.title === "测款第一周"));
  const sub = await fetch(`${base}/api/academy/handbook/branches`, {
    method: "POST",
    headers: { cookie, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ parentId: "goods", title: "新品日历" })
  });
  assert.equal(sub.status, 201);
  const group = await fetch(`${base}/api/academy/handbook/branches`, {
    method: "POST",
    headers: { cookie, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ parentId: "", title: "客服话术" })
  });
  assert.equal(group.status, 201);
  const afterAdd = await (await fetch(`${base}/api/academy/handbook/tree`, { headers })).json();
  assert.ok(afterAdd.tree.find((n) => n.id === "goods").children.some((n) => n.title === "新品日历"));
  assert.ok(afterAdd.tree.some((n) => n.title === "客服话术"));
  const moved = await fetch(`${base}/api/academy/handbook/reorder`, {
    method: "POST",
    headers: { cookie, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ id: "goods-test", beforeId: "goods-title" })
  });
  assert.equal(moved.status, 200);
  const afterMove = await (await fetch(`${base}/api/academy/handbook/tree`, { headers })).json();
  const goodsKids = afterMove.tree.find((n) => n.id === "goods").children.map((n) => n.id);
  assert.ok(goodsKids.indexOf("goods-test") < goodsKids.indexOf("goods-title"));
  const logs = await (await fetch(`${base}/api/academy/logs`, { headers })).json();
  assert.ok(logs.items.some((item) => item.actor === "罗成" && item.action === "改正文"));
  assert.ok(logs.items.some((item) => item.action === "加分支"));
  assert.ok(logs.items.some((item) => item.action === "插图"));
  assert.ok(logs.items.some((item) => item.action === "调顺序"));
});
