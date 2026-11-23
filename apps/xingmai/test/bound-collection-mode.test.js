import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { boundRouter } from "../src/modules/bound/router.js";
import { resetBoundStore, setBoundFetch, setBoundClock, pollLink } from "../src/modules/bound/store.js";
import { collectionStatus, ensureCollectLoop, tick } from "../src/modules/bound/collect.js";
import { readState, writeState, listSheetHeads } from "../src/modules/bound/persist.js";

const previousMode = process.env.BOUND_COLLECTION_MODE;
const previousLoop = process.env.BOUND_COLLECT_LOOP;

test.beforeEach(() => {
  resetBoundStore();
  delete process.env.BOUND_COLLECTION_MODE;
  delete process.env.BOUND_COLLECT_LOOP;
  setBoundClock(() => new Date("2026-11-21T01:00:00Z"));
});

test.afterEach(() => {
  resetBoundStore();
  if (previousMode === undefined) delete process.env.BOUND_COLLECTION_MODE;
  else process.env.BOUND_COLLECTION_MODE = previousMode;
  if (previousLoop === undefined) delete process.env.BOUND_COLLECT_LOOP;
  else process.env.BOUND_COLLECT_LOOP = previousLoop;
});

test("默认、空值或错误配置均不启动定时采集，只有明确 batch 才启用", (t) => {
  let scheduled = 0;
  t.mock.method(globalThis, "setInterval", () => {
    scheduled += 1;
    return { unref() {} };
  });
  for (const value of [undefined, "", "1", "BATCH", "probe"]) {
    if (value === undefined) delete process.env.BOUND_COLLECTION_MODE;
    else process.env.BOUND_COLLECTION_MODE = value;
    ensureCollectLoop();
    assert.equal(collectionStatus().batchEnabled, false);
  }
  assert.equal(scheduled, 0);
  process.env.BOUND_COLLECTION_MODE = "batch";
  process.env.BOUND_COLLECT_LOOP = "0";
  ensureCollectLoop();
  assert.equal(scheduled, 0);
  delete process.env.BOUND_COLLECT_LOOP;
  ensureCollectLoop();
  ensureCollectLoop();
  assert.equal(scheduled, 1);
});

test("默认模式读取页面、手动 tick 均不请求旧站、不修改旧队列或断点", async () => {
  const savedSession = { phase: "collecting", deviceId: "test-device", cursor: { id: "qdfx_jy", label: "经营数据" } };
  const savedQueue = [{ reportId: "qdfx_jy", dim: "all", start: "2026-11-19", end: "2026-11-19", daysType: "1" }];
  await writeState("session", savedSession);
  await writeState("wanted", savedQueue);
  let upstreamCalls = 0;
  setBoundFetch(async () => { upstreamCalls += 1; throw new Error("Unexpected upstream request"); });
  const app = express();
  app.use((req, _res, next) => { req.user = { username: "罗成" }; next(); });
  app.use("/api/bound", boundRouter);
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.on("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/bound`;
  try {
    for (const path of ["/", "/catalog", "/board", "/coverage", "/view?page=channelOverview&tab=qdzl_lb&from=2026-11-19&to=2026-11-19", "/export?page=channelAnalysis&tab=qdfx_jy&from=2026-11-19&to=2026-11-19"]) {
      const response = await fetch(base + path);
      assert.equal(response.status, 200, path);
      await response.text();
    }
    for (const path of ["/link", "/progress"]) {
      const body = await (await fetch(base + path)).json();
      assert.equal(body.phase, "logged_in");
      assert.equal(body.collection.mode, "paused");
      assert.equal(body.cursor, null);
      assert.match(body.message, /批量采集已暂停/);
    }
    const result = await (await fetch(base + "/collect/tick", { method: "POST" })).json();
    assert.equal(result.reason, "batch_disabled");
    assert.equal((await tick()).reason, "batch_disabled");
    assert.equal(upstreamCalls, 0);
    assert.deepEqual(await readState("wanted"), savedQueue);
    assert.deepEqual(await readState("session"), savedSession);
    assert.deepEqual(await listSheetHeads(), []);
    await writeState("wanted", []);
    await fetch(base + "/view?page=channelOverview&tab=qdzl_lb&from=2026-11-18&to=2026-11-18");
    assert.deepEqual(await readState("wanted"), []);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test("默认模式完成登录只标记已登录，不开始批量采集", async () => {
  await writeState("session", { phase: "waiting_scan", deviceId: "test-device", scene: "test-scene", cookies: {} });
  const requests = [];
  setBoundFetch(async url => {
    requests.push(new URL(url).pathname);
    const data = String(url).includes('/auth/info') ? { uid: 'test-user', verify: true }
      : String(url).includes('/auth/getUserInfo') ? { userInfo: { userId: 'test-user', companyId: 'test-company' } } : {};
    return { status: 200, headers: { get: () => "application/json", getSetCookie: () => ['sid=test'] }, json: async () => ({ code: 0, data }) };
  });
  const status = await pollLink();
  assert.equal(status.phase, "logged_in");
  assert.equal((await readState("session")).phase, "logged_in");
  assert.equal(status.collection.batchEnabled, false);
  assert.deepEqual(requests, ["/prod/auth/checkQrcode", "/prod/auth/info", "/prod/auth/getUserInfo"]);
  const before = requests.length;
  await tick();
  assert.equal(requests.length, before);
});
