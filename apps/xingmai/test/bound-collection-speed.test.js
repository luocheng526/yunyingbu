import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createRequestPacer } from "../src/modules/bound/request-pacer.js";
import { createFourPageJob } from "../src/modules/bound/four-page-job.js";
import { createShopDayCollector } from "../src/modules/bound/shop-day.js";
import { createShopBatch } from "../src/modules/bound/shop-batch.js";
import { SHOP_DAY } from "../src/modules/bound/shop-day-contract.js";
import { requestVisibleShops, requestBatchShopDayReport, setBoundFetch, loginWithPassword, resetPasswordCredentials } from "../src/modules/bound/collect.js";
import { readState, writeState, resetBoundStore } from "../src/modules/bound/persist.js";

const temp = () => mkdtemp(join(tmpdir(), "bound-speed-"));
const success = { httpStatus: 200, payload: { code: 0 } };
const latch = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const json = (payload, cookie = "") => new globalThis.Response(JSON.stringify(payload), { headers: { "content-type": "application/json", ...(cookie ? { "set-cookie": cookie } : {}) } });

test("请求启动间隔统一控制，限流按 Retry-After 退避，恢复后逐步提速", async () => {
  let time = 0; const starts = [];
  const pacer = createRequestPacer({ now: () => time, sleep: async ms => { time += ms; } });
  const send = result => pacer.run(async () => { starts.push(time); return result; });
  await send(success); await send(success);
  assert.deepEqual(starts, [0, 750]);
  await send({ httpStatus: 429, retryAfterMs: 30000 }); await send(success);
  assert.equal(starts[3] - starts[2], 30000);
  for (let i = 0; i < 10; i++) await send(success);
  assert.equal(starts.at(-1) - starts.at(-2), 750);
  await assert.rejects(pacer.run(async () => { throw new Error("timeout"); }));
  const failedAt = time; await send(success);
  assert.equal(time - failedAt, 15000);
});

test("日报退避时立即返回，保留旧站要求的等待时间", async () => {
  let time = 0;
  const pacer = createRequestPacer({ now: () => time, sleep: async ms => { time += ms; } });
  await pacer.run(async () => ({ httpStatus: 429, retryAfterMs: 300000 }));
  const send = async () => success;
  assert.deepEqual(await pacer.run(send, { deferCooldown: true }), { blocked: "upstream_cooldown", retryAfterMs: 300000 });
  assert.equal(time, 0);
  time = 300000;
  assert.deepEqual(await pacer.run(send, { deferCooldown: true }), success);
});

test("并行任务保留所有分页、分类卡和指标依赖；复用缓存不增加上游请求", async () => {
  const directory = await temp();
  let inflight = 0, peak = 0, calls = 0;
  const completed = new Set();
  const key = task => JSON.stringify(task);
  const collector = { status: async () => ({ busy: false }), runStatus: async () => null, collect: async task => {
    if (completed.has(key(task))) return { ok: true, cached: true, record: record(task) };
    peak = Math.max(peak, ++inflight); calls++;
    if (task.page) assert.ok(completed.has(key({ ...task, page: task.page - 1 })) || task.page === 2 && completed.has(key(Object.fromEntries(Object.entries(task).filter(([k]) => k !== "page")))));
    if (task.columnKey) assert.ok(completed.has(key({ reportId: "key_graph" })));
    if (task.cardId) assert.ok(completed.has(key({ reportId: task.reportId.startsWith("shop_spu_") ? "shop_cards_spu" : "shop_cards_sku" })));
    await delay(task.reportId === "key_graph" ? 8 : 2);
    inflight--; completed.add(key(task));
    return { ok: true, record: record(task) };
  } };
  function record(task) {
    return { requestCount: 1, rows: task.reportId.startsWith("shop_cards_") ? [{ id: 1 }, { id: 1 }, { id: 2 }] : [],
      metricColumns: [{ columnKey: "gmv" }, { columnKey: "gmv" }, { columnKey: "uv" }],
      ...(task.reportId === "key_goods" && !task.page ? { nextPage: 2 } : {}) };
  }
  try {
    const job = createFourPageJob({ directory, collector, concurrency: 2 });
    await job.start(); const run = await job.wait();
    assert.equal(peak, 2); assert.equal(run.status, "complete");
    assert.equal(run.done, 32); assert.equal(run.total, 32); assert.equal(run.requests, 32);
    await job.start(); const resumed = await job.wait();
    assert.equal(resumed.cached, 32); assert.equal(resumed.requests, 0); assert.equal(calls, 32);
    const saved = JSON.parse(await readFile(join(directory, SHOP_DAY.platform, SHOP_DAY.shopId, SHOP_DAY.date, "four-page-run.json")));
    assert.equal(saved.done, saved.total); assert.deepEqual(saved.inFlight, []);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("暂停排空已发出的两项，显示实时行进度，续采跳过成功项", async () => {
  const directory = await temp(), entered = latch(), release = latch();
  const cached = new Set(); let launched = 0, job;
  const collector = { status: async () => ({ busy: false }), runStatus: async () => null, collect: async task => {
    const key = JSON.stringify(task), hit = cached.has(key);
    if (!hit && ++launched <= 2) { if (launched === 2) entered.resolve(); await release.promise; }
    cached.add(key);
    return { ok: true, cached: hit, record: { requestCount: 1, rows: [], metricColumns: [] } };
  } };
  try {
    const batch = createShopBatch({ directory, discover: async () => ({ ok: true, owner: "owner", shops: [SHOP_DAY] }), makeJob: () => (job = createFourPageJob({ directory, collector, concurrency: 2 })) });
    await batch.start(); await entered.promise;
    const live = await batch.status();
    assert.equal(live.shops[0].run.status, "running"); assert.equal(live.currentRun.inFlight.length, 2);
    batch.stop(); release.resolve();
    const stopped = await batch.wait();
    assert.equal(stopped.status, "paused"); assert.equal(stopped.shops[0].run.done, 2); assert.equal(launched, 2); assert.equal(job.busy(), false);
    await batch.start(); const resumed = await batch.wait();
    assert.equal(resumed.status, "complete"); assert.equal(resumed.shops[0].run.cached, 2); assert.equal(launched, 18);
  } finally { release.resolve(); await rm(directory, { recursive: true, force: true }); }
});

test("并发失败后不启动新任务，登录冲突优先于迟到的一般错误", async () => {
  const directory = await temp(); let calls = 0;
  try {
    const collector = { status: async () => ({ busy: false }), runStatus: async () => null, collect: async () => {
      const n = ++calls; await delay(n === 1 ? 2 : 15);
      return { ok: false, record: { requestCount: 1, status: n === 1 ? "login_conflict" : "request_failed" } };
    } };
    const batch = createShopBatch({ directory, discover: async () => ({ ok: true, owner: "owner", shops: [SHOP_DAY, { ...SHOP_DAY, shopId: "200" }] }), makeJob: scope => createFourPageJob({ directory, scope, collector, concurrency: 2 }) });
    await batch.start(); const stopped = await batch.wait();
    assert.equal(stopped.status, "blocked"); assert.equal(stopped.reason, "login_conflict");
    assert.equal(calls, 2); assert.equal(stopped.shops[1].status, "queued"); assert.equal(stopped.requests, 2);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("实际档案采集器允许两份不同报表同时落盘，重复请求和第三份被拒绝", async () => {
  const directory = await temp(), entered = latch(), release = latch(); let calls = 0;
  try {
    const collector = createShopDayCollector({ directory, concurrency: 2, intervalMs: 0, request: async () => {
      if (++calls === 2) entered.resolve(); await release.promise;
      return { httpStatus: 200, payload: { code: 0, data: { columnInfo: [], columnData: [{ shopId: SHOP_DAY.shopId, platform: SHOP_DAY.platform, gmv: "10" }] } } };
    } });
    const a = collector.collect({ reportId: "channel_area" }), b = collector.collect({ reportId: "channel_hour" });
    await entered.promise;
    assert.equal((await collector.collect({ reportId: "channel_area" })).reason, "collector_busy");
    assert.equal((await collector.collect({ reportId: "channel_shop_table" })).reason, "collector_busy");
    release.resolve(); assert.ok((await Promise.all([a, b])).every(r => r.ok));
    assert.equal((await collector.collect({ reportId: "channel_area" })).cached, true);
    assert.equal(calls, 2); assert.equal(collector.isBusy(), false);
  } finally { release.resolve(); await rm(directory, { recursive: true, force: true }); }
});

async function parallelSessionScenario(mode) {
  resetBoundStore(); resetPasswordCredentials();
  const entered = latch(), release = latch(); let reports = 0, logins = 0;
  setBoundFetch(async url => {
    const path = new URL(url).pathname;
    if (path.endsWith('/auth/login')) { logins++; return json({ code: 0, data: {} }, 'sid=login' + logins); }
    if (path.endsWith('/auth/info')) return json({ code: 0, data: { uid: 'one', verify: true } });
    if (path.endsWith('/auth/getUserInfo')) return json({ code: 0, data: { userInfo: { userId: 'one', companyId: 'company' } } });
    if (path.endsWith('/getAllChannelList')) return json({ code: 0, data: [{ channel: SHOP_DAY.platform, shopList: [SHOP_DAY] }] });
    const n = ++reports;
    if (n <= 2) { if (n === 2) entered.resolve(); await release.promise; }
    if (mode === 'expired' && n <= 2) return json({ code: -1 });
    if (mode === 'conflict' && n === 1) return json({ code: -7 });
    if (mode === 'conflict' && n === 2) await delay(10);
    return json({ code: 0, data: {} }, 'part' + n + '=saved');
  });
  try {
    if (mode === 'expired') assert.equal((await loginWithPassword({ userName: 'test', password: 'test', autoRelogin: true })).ok, true);
    else await writeState('session', { provider: 'PASSWORD', phase: 'logged_in', cookies: { sid: 'test' }, authGeneration: 'start', passwordIdentity: { userId: 'one', companyId: 'company' } });
    const source = await requestVisibleShops();
    const a = requestBatchShopDayReport({ reportId: 'channel_area' }, () => {}, SHOP_DAY, source.owner);
    const b = requestBatchShopDayReport({ reportId: 'channel_hour' }, () => {}, SHOP_DAY, source.owner);
    await entered.promise; release.resolve();
    const results = await Promise.all([a, b]);
    const saved = await readState('session');
    if (mode === 'conflict') {
      assert.equal(results[0].payload.code, -7); assert.equal(results[1].blocked, 'session_changed');
      assert.equal(saved.phase, 'needs_password'); assert.equal(reports, 2);
    } else {
      assert.ok(results.every(r => r.payload?.code === 0), JSON.stringify(results));
      assert.equal(saved.cookies[mode === 'expired' ? 'part3' : 'part1'], 'saved');
      assert.equal(saved.cookies[mode === 'expired' ? 'part4' : 'part2'], 'saved');
      if (mode === 'expired') { assert.equal(logins, 2); assert.equal(reports, 4); assert.equal(saved.cookies.sid, 'login2'); }
    }
  } finally { release.resolve(); setBoundFetch(); resetPasswordCredentials(); resetBoundStore(); }
}
test("并发响应合并不同 Cookie，不互相覆盖", () => parallelSessionScenario('success'));
test("并发过期只重登一次，两份原请求分别重放", () => parallelSessionScenario('expired'));
test("登录冲突后迟到成功不能恢复失效会话", () => parallelSessionScenario('conflict'));
