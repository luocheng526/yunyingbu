import { test } from "node:test";
import assert from "node:assert/strict";
import { createReleasesRouter } from "../src/modules/releases/router.js";
import { createStore } from "../src/modules/releases/store.js";
import express from "express";

function appWith(store) {
  const api = express();
  api.use(express.json());
  api.use(
    "/api/releases",
    createReleasesRouter({
      store,
      getUser: () => ({ username: "罗成" }),
      restart: async () => ({ skipped: true, reason: "test" }),
      push: async () => ({ stdout: "pushed-in-test" })
    })
  );
  const server = api.listen(0);
  const { port } = server.address();
  return { server, base: `http://127.0.0.1:${port}` };
}

test("queue lists dialog tickets with summary and priority", async (t) => {
  const store = createStore({ now: () => "2026-09-05T00:00:00.000Z" });
  const { server, base } = appWith(store);
  t.after(() => server.close());
  const res = await fetch(`${base}/api/releases/queue`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.items.length, 2);
  assert.equal(data.items[0].source, "首页导航与工作台");
  assert.ok(data.items[0].summary);
  assert.equal(data.items[0].priority, 1);
  assert.equal(data.items[1].priority, 2);
});

test("move up changes queue order", async (t) => {
  const store = createStore({ now: () => "2026-09-05T00:00:00.000Z" });
  const { server, base } = appWith(store);
  t.after(() => server.close());
  const before = await (await fetch(`${base}/api/releases/queue`)).json();
  const second = before.items[1].id;
  const moved = await fetch(`${base}/api/releases/${second}/move`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ direction: "up" })
  });
  assert.equal(moved.status, 200);
  const after = await (await fetch(`${base}/api/releases/queue`)).json();
  assert.equal(after.items[0].id, second);
});

test("agent POST appears in queue without the webpage form", async (t) => {
  const store = createStore({ now: () => "2026-09-05T00:00:00.000Z" });
  const { server, base } = appWith(store);
  t.after(() => server.close());
  const created = await fetch(`${base}/api/releases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      version: "2.0.0",
      applicant: "沈子晗工作台",
      source: "沈子晗工作台",
      module: "沈子晗",
      summary: "沈子晗运营中心列表页",
      files: ["public/shen.html"],
      acceptance: "打开 /shen",
      restart: false
    })
  });
  assert.equal(created.status, 201);
  const queue = await (await fetch(`${base}/api/releases/queue`)).json();
  assert.equal(queue.items.at(-1).source, "沈子晗工作台");
  assert.equal(queue.items.at(-1).summary, "沈子晗运营中心列表页");
});

test("confirm from the webpage releases the ticket", async (t) => {
  const store = createStore({ now: () => "2026-09-05T00:00:00.000Z" });
  const { server, base } = appWith(store);
  t.after(() => server.close());
  const queue = await (await fetch(`${base}/api/releases/queue`)).json();
  const id = queue.items[0].id;
  const res = await fetch(`${base}/api/releases/${id}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}"
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  const item = store.get(id);
  assert.equal(item.status, "success");
});
