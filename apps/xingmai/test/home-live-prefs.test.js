import assert from "node:assert/strict";
import express from "express";
import { readFileSync } from "node:fs";
import http from "node:http";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  accountName,
  attachHomeLivePrefs,
  createLivePrefStore,
  isEmptyPrefs,
  normalizePrefs,
} from "../src/modules/home/live-prefs.js";

test("prefs keep hide=[] (show every extra column) and clamp widths", () => {
  assert.deepEqual(
    normalizePrefs({
      cols: [20, 240.6, 900],
      headOrder: ["shop", "shop", "liveAmount", "bad key", "feeGoal"],
      headHide: [],
      row: 99,
    }),
    {
      cols: [48, 241, 800],
      headOrder: ["shop", "liveAmount", "feeGoal"],
      headHide: [],
      row: 20,
    },
  );
  assert.equal(isEmptyPrefs(normalizePrefs({})), true);
  assert.equal(isEmptyPrefs(normalizePrefs({ headHide: [] })), false);
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
  attachHomeLivePrefs(router, { store: createLivePrefStore({ memory }) });
  app.use("/api/home", router);
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

test("live table layout stays on the logged-in account", async () => {
  await withApi(async (base) => {
    const empty = await json(base, "/api/home/live-prefs", { user: "罗成" });
    assert.equal(empty.res.status, 200);
    assert.equal(empty.body.empty, true);

    const saved = await json(base, "/api/home/live-prefs", {
      user: "罗成",
      method: "PUT",
      body: {
        cols: [160, 220, 120],
        headOrder: ["rank", "shop", "feeGoal", "liveAmount"],
        headHide: ["roi"],
        row: 12,
      },
    });
    assert.equal(saved.res.status, 200);
    assert.equal(saved.body.username, "罗成");
    assert.deepEqual(saved.body.prefs.cols, [160, 220, 120]);
    assert.deepEqual(saved.body.prefs.headOrder, ["rank", "shop", "feeGoal", "liveAmount"]);
    assert.deepEqual(saved.body.prefs.headHide, ["roi"]);
    assert.equal(saved.body.prefs.row, 12);

    const other = await json(base, "/api/home/live-prefs", { user: "韩梦凯" });
    assert.equal(other.body.empty, true);

    const again = await json(base, "/api/home/live-prefs", { user: "罗成" });
    assert.deepEqual(again.body.prefs.headOrder, ["rank", "shop", "feeGoal", "liveAmount"]);
  });
});

test("home.js keeps account-pref hooks and parseable CSS quotes", () => {
  const homeJs = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../public/shared/modules/home.js"),
    "utf8",
  );
  assert.match(homeJs, /XmLivePref\.load/);
  assert.match(homeJs, /\/api\/home\/live-prefs/);
  assert.match(homeJs, /0\.1\.906-colacct/);
  assert.equal(homeJs.includes("content:''"), false);
});

test("unauthenticated live-prefs is 401", async () => {
  await withApi(async (base) => {
    const got = await json(base, "/api/home/live-prefs");
    assert.equal(got.res.status, 401);
    const put = await json(base, "/api/home/live-prefs", { method: "PUT", body: { row: 8 } });
    assert.equal(put.res.status, 401);
  });
});
