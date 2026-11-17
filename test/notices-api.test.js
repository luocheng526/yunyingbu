import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import express from "express";
import { createApp } from "../src/app.js";
import { peopleRouter } from "../src/modules/people/router.js";
import { inDisplayWindow, resetNotices, selectPopupNotice, todayStamp } from "../src/modules/notices/store.js";

const here = path.dirname(fileURLToPath(import.meta.url));

test.beforeEach(() => {
  resetNotices();
});

async function withApp(app, fn) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

async function withServer(fn) {
  await withApp(createApp(), fn);
}

test("always-on notices stay in the homepage window; dated ones expire", () => {
  const today = "2026-11-16";
  assert.equal(inDisplayWindow({ alwaysShow: true }, today), true);
  assert.equal(inDisplayWindow({ banner: true }, today), true);
  assert.equal(inDisplayWindow({ alwaysShow: false, startOn: "2026-11-01", endOn: "2026-11-30" }, today), true);
  assert.equal(inDisplayWindow({ alwaysShow: false, startOn: "2026-01-01", endOn: "2026-01-02" }, today), false);
  assert.equal(inDisplayWindow({ alwaysShow: false, startOn: "2099-01-01", endOn: "2099-12-31" }, today), false);
});

test("dated popup notices do not open outside their window", () => {
  const selected = selectPopupNotice(
    [{ id: "old", status: "active", popup: true, alwaysShow: false, startOn: "2020-01-01", endOn: "2020-01-02" }],
    "2026-11-16"
  );
  assert.equal(selected, null);
});

test("POST /api/notices saves and banner lists always-show items", async () => {
  await withServer(async (base) => {
    const created = await fetch(`${base}/api/notices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "好人好事",
        summary: "首页展示",
        body: "正文",
        category: "general",
        level: "normal",
        popup: false,
        banner: true,
        alwaysShow: true,
        status: "active"
      })
    });
    const createdJson = await created.json();
    assert.equal(created.status, 201, JSON.stringify(createdJson));
    assert.equal(createdJson.ok, true);
    assert.equal(createdJson.item.title, "好人好事");
    assert.equal(createdJson.item.alwaysShow, true);
    assert.equal(createdJson.item.displayLabel, "一直展示");
    assert.equal(createdJson.item.banner, true);

    const listed = await fetch(`${base}/api/notices`);
    const listedJson = await listed.json();
    assert.equal(listed.status, 200);
    assert.equal(listedJson.ok, true);
    assert.equal(listedJson.stats.active, 1);
    assert.equal(listedJson.items[0].title, "好人好事");

    const banner = await fetch(`${base}/api/notices/banner`);
    const bannerJson = await banner.json();
    assert.equal(banner.status, 200, JSON.stringify(bannerJson));
    assert.equal(bannerJson.ok, true);
    assert.equal(bannerJson.items.length, 1);
    assert.equal(bannerJson.items[0].title, "好人好事");

    const viaPeople = await fetch(`${base}/api/people/notices/banner`);
    const viaPeopleJson = await viaPeople.json();
    assert.equal(viaPeople.status, 200);
    assert.equal(viaPeopleJson.items[0].title, "好人好事");
  });
});

test("dated notices stay off the homepage banner outside the window", async () => {
  await withServer(async (base) => {
    const created = await fetch(`${base}/api/notices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "过期公告",
        banner: true,
        alwaysShow: false,
        startOn: "2020-01-01",
        endOn: "2020-01-02",
        status: "active"
      })
    });
    assert.equal(created.status, 201);
    const banner = await fetch(`${base}/api/notices/banner`);
    const bannerJson = await banner.json();
    assert.equal(bannerJson.items.some((item) => item.title === "过期公告"), false);
  });
});

test("mounting peopleRouter on a nested /api still exposes /api/notices", async () => {
  const app = express();
  app.use(express.json());
  const api = express.Router();
  api.use("/people", peopleRouter);
  app.use("/api", api);
  await withApp(app, async (base) => {
    const created = await fetch(`${base}/api/notices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "嵌套挂载", banner: true, alwaysShow: true, status: "active" })
    });
    assert.equal(created.status, 201, await created.text());
    const banner = await fetch(`${base}/api/notices/banner`);
    const bannerJson = await banner.json();
    assert.equal(banner.status, 200);
    assert.equal(bannerJson.items.some((item) => item.title === "嵌套挂载"), true);
    const people = await fetch(`${base}/api/people`);
    assert.equal(people.status, 200);
  });
});

test("notices router does not static-import missing profile/auth.js", () => {
  const source = fs.readFileSync(path.join(here, "../src/modules/notices/router.js"), "utf8");
  assert.doesNotMatch(source, /^import .*profile\/auth\.js/m);
  assert.match(source, /await import\("\.\.\/profile\/auth\.js"\)/);
});

test("Shanghai calendar stamp is YYYY-MM-DD", () => {
  assert.match(todayStamp(new Date("2026-11-16T16:00:00.000Z")), /^\d{4}-\d{2}-\d{2}$/);
});
