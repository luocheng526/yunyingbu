import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createApp } from "../src/app.js";
import { patchAppSource } from "../src/modules/people/patch-app.js";
import { resetPeopleStore } from "../src/modules/people/store.js";

const NAV_LABELS = [
  "首页",
  "数据中心",
  "沈子晗运营中心",
  "韩梦凯运营中心",
  "人员管理",
  "版本发布中心",
  "个人中心"
];

const PRESET = [
  { name: "沈子晗", role: "运营", center: "沈子晗运营中心", status: "在职" },
  { name: "韩梦凯", role: "运营", center: "韩梦凯运营中心", status: "在职" },
  { name: "管理员", role: "管理", center: "人员管理", status: "在职" }
];

test.beforeEach(() => {
  resetPeopleStore();
});

async function withServer(fn) {
  const server = http.createServer(createApp());
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

test("GET /people lists title, table headers and fallback nav", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/people`);
    const text = await res.text();
    assert.equal(res.status, 200);
    assert.match(text, /<title>人员管理<\/title>/);
    assert.match(text, /演示/);
    for (const header of ["姓名", "角色", "所属中心", "状态"]) {
      assert.match(text, new RegExp(header));
    }
    for (const label of NAV_LABELS) {
      assert.match(text, new RegExp(label));
    }
  });
});

test("GET /api/people returns three demo staff", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/people`);
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.demo, true);
    assert.equal(data.people.length, 3);
    for (const expected of PRESET) {
      const found = data.people.find((row) => row.name === expected.name);
      assert.deepEqual(
        {
          name: found.name,
          role: found.role,
          center: found.center,
          status: found.status,
          demo: found.demo
        },
        { ...expected, demo: true }
      );
    }
  });
});

test("POST /api/people appends a staff row", async () => {
  await withServer(async (base) => {
    const body = {
      name: "测试同事",
      role: "运营",
      center: "数据中心",
      status: "在职"
    };
    const created = await fetch(`${base}/api/people`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const createdJson = await created.json();
    assert.equal(created.status, 201);
    assert.equal(createdJson.ok, true);
    assert.equal(createdJson.person.demo, false);
    assert.equal(createdJson.person.name, body.name);

    const listed = await fetch(`${base}/api/people`);
    const listedJson = await listed.json();
    assert.equal(listedJson.people.length, 4);
    assert.ok(listedJson.people.some((row) => row.name === "测试同事" && row.center === "数据中心"));
  });
});

test("POST /api/people rejects missing fields", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/people`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "无中心" })
    });
    const data = await res.json();
    assert.equal(res.status, 400);
    assert.equal(data.ok, false);
  });
});

test("patchAppSource only inserts people router mount", () => {
  const original = `import express from "express";

export function createApp() {
  const app = express();
  app.use(express.json());
  return app;
}
`;
  const patched = patchAppSource(original);
  assert.match(patched, /import \{ peopleRouter \} from "\.\/modules\/people\/router\.js";/);
  assert.match(patched, /app\.use\("\/api\/people", peopleRouter\);\n  return app;/);
  assert.equal(patchAppSource(patched), patched);
});
