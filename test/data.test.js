import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createApp } from "../src/app.js";
import { getOverview } from "../src/modules/data/overview.js";
import { patchAppSource } from "../src/modules/data/patch-app.js";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const NAV_LABELS = [
  "首页",
  "数据中心",
  "沈子晗运营中心",
  "韩梦凯运营中心",
  "人员管理",
  "版本发布中心",
  "个人中心"
];

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

async function get(base, pathname) {
  const res = await fetch(`${base}${pathname}`);
  const text = await res.text();
  return { res, text };
}

test("GET /api/data/overview returns demo cards and five events", async () => {
  await withServer(async (base) => {
    const { res, text } = await get(base, "/api/data/overview");
    assert.equal(res.status, 200);
    const body = JSON.parse(text);
    const expected = getOverview();
    assert.equal(body.ok, true);
    assert.equal(body.demo, true);
    assert.equal(body.notice, "演示数据");
    assert.equal(body.cards.length, 4);
    assert.deepEqual(
      body.cards.map((c) => c.label),
      ["今日订单", "待处理", "在职人数", "本周发布次数"]
    );
    assert.equal(body.events.length, 5);
    assert.deepEqual(body, expected);
  });
});

test("GET /data is the data center page with title, cards, table, and nav", async () => {
  await withServer(async (base) => {
    const { res, text } = await get(base, "/data");
    assert.equal(res.status, 200);
    assert.match(text, /<h1>数据中心<\/h1>/);
    assert.match(text, /今日订单/);
    assert.match(text, /待处理/);
    assert.match(text, /在职人数/);
    assert.match(text, /本周发布次数/);
    assert.match(text, /演示数据/);
    assert.match(text, /最近数据事件/);
    assert.match(text, /\/api\/data\/overview/);
    assert.match(text, /shared\/layout\.css/);
    assert.match(text, /shared\/nav\.js/);
    for (const label of NAV_LABELS) {
      assert.match(text, new RegExp(label));
    }
  });
});

test("patchAppSource only inserts the data API mount", () => {
  const original = `import express from "express";

export function createApp() {
  const app = express();
  app.use(express.json());
  return app;
}
`;
  const patched = patchAppSource(original);
  assert.match(patched, /import \{ dataRouter \} from "\.\/modules\/data\/router\.js";/);
  assert.match(patched, /app\.use\("\/api\/data", dataRouter\);\n  return app;/);
  assert.equal(patchAppSource(patched), patched);
});

test("apply script never restarts production", () => {
  const source = fs.readFileSync(path.join(repoRoot, "scripts/apply-data-to-mengkai.mjs"), "utf8");
  assert.doesNotMatch(source, /systemctl\s+restart/);
  assert.doesNotMatch(source, /spawnSync/);
  assert.doesNotMatch(source, /docker compose/);
});

test("submit-data-release posts version applicant module summary", async () => {
  const received = [];
  const server = http.createServer((req, res) => {
    if (req.method === "POST" && req.url === "/api/releases") {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        received.push(body);
        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, item: { id: "rel-1", status: "queued", ...body } }));
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const child = spawn(process.execPath, [path.join(repoRoot, "scripts/submit-data-release.mjs")], {
      env: {
        ...process.env,
        RELEASES_API: `http://127.0.0.1:${port}/api/releases`
      }
    });
    const [code] = await Promise.all([
      new Promise((resolve) => child.on("close", resolve))
    ]);
    assert.equal(code, 0);
    assert.equal(received.length, 1);
    assert.equal(received[0].applicant, "数据中心");
    assert.equal(received[0].module, "数据中心");
    assert.equal(received[0].version, "0.1.0-data");
    assert.ok(received[0].summary);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});
