import assert from "node:assert/strict";
import express from "express";
import http from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  accountName,
  attachHanFeeTargets,
  createFeeTargetStore,
  normalizeBounds,
} from "../src/modules/han/fee-targets.js";

test("fee bounds swap when lo is above hi", () => {
  assert.deepEqual(normalizeBounds({ lo: 40, hi: 30 }), { lo: 30, hi: 40 });
  assert.deepEqual(normalizeBounds("35%"), { lo: 35, hi: 35 });
  assert.deepEqual(normalizeBounds({ min: 10, max: 20 }), { lo: 10, hi: 20 });
});

test("account name follows username then displayName", () => {
  assert.equal(accountName({ username: "罗成", displayName: "别名" }), "罗成");
  assert.equal(accountName({ displayName: "韩梦凯" }), "韩梦凯");
  assert.equal(accountName(null), "");
});

async function withApi(fn) {
  const memory = {};
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const raw = String(req.headers["x-user"] || "");
    const name = raw ? decodeURIComponent(raw) : "";
    req.user = name ? { username: name } : null;
    next();
  });
  const router = express.Router();
  attachHanFeeTargets(router, { store: createFeeTargetStore({ memory }) });
  app.use("/api/han", router);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  try {
    await fn(base, memory);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

async function json(base, path, { user, method, body } = {}) {
  const res = await fetch(`${base}${path}`, {
    method: method || "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(user ? { "x-user": encodeURIComponent(user) } : {}),
    },
    body: body == null ? undefined : JSON.stringify(body),
  });
  return { res, body: await res.json() };
}

test("fee targets stay on the logged-in account, not the other account", async () => {
  await withApi(async (base) => {
    const empty = await json(base, "/api/han/fee-targets", { user: "罗成" });
    assert.equal(empty.res.status, 200);
    assert.deepEqual(empty.body.targets, {});

    const saved = await json(base, "/api/han/fee-targets", {
      user: "罗成",
      method: "PUT",
      body: { store: "DKTT清洗生活旗舰店", lo: 30, hi: 35 },
    });
    assert.equal(saved.res.status, 200);
    assert.equal(saved.body.username, "罗成");
    assert.deepEqual(saved.body.targets["DKTT清洗生活旗舰店"], { lo: 30, hi: 35 });

    const other = await json(base, "/api/han/fee-targets", { user: "韩梦凯" });
    assert.deepEqual(other.body.targets, {});

    const again = await json(base, "/api/han/fee-targets", { user: "罗成" });
    assert.deepEqual(again.body.targets["DKTT清洗生活旗舰店"], { lo: 30, hi: 35 });
  });
});

test("unauthenticated fee-target reads are 401", async () => {
  await withApi(async (base) => {
    const res = await json(base, "/api/han/fee-targets");
    assert.equal(res.res.status, 401);
    assert.equal(res.body.ok, false);
  });
});

test("replace uploads a whole browser map onto the account", async () => {
  await withApi(async (base) => {
    const saved = await json(base, "/api/han/fee-targets", {
      user: "罗成",
      method: "PUT",
      body: {
        replace: true,
        targets: {
          DKTT清洗生活旗舰店: { lo: 28, hi: 32 },
          京点优智居专营店: { lo: 40, hi: 45 },
        },
      },
    });
    assert.equal(Object.keys(saved.body.targets).length, 2);
    const read = await json(base, "/api/han/fee-targets", { user: "罗成" });
    assert.deepEqual(read.body.targets["京点优智居专营店"], { lo: 40, hi: 45 });
  });
});

test("file store keeps the same account map across reloads", async () => {
  const dir = await mkdtemp(join(tmpdir(), "han-fee-"));
  const filePath = join(dir, "han-fee-targets.json");
  try {
    const first = createFeeTargetStore({ filePath, poolFactory: async () => null });
    await first.put("罗成", { store: "飒望玩具专营店", lo: 18, hi: 22 });
    const second = createFeeTargetStore({ filePath, poolFactory: async () => null });
    const targets = await second.get("罗成");
    assert.deepEqual(targets["飒望玩具专营店"], { lo: 18, hi: 22 });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
