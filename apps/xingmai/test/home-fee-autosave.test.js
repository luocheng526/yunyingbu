import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../public/shared/modules/home.js", import.meta.url), "utf8");
const factory = vm.runInNewContext("(" + source.slice(source.indexOf("  function createFeeGoalSync("), source.indexOf("  function rememberFeeGoals(")) + ")");
const clone = value => JSON.parse(JSON.stringify(value));
function setup({ goals = {}, legacy = {}, storage = new Map(), request } = {}) {
  let state, next = 0;
  const timers = new Map();
  const posts = [];
  const sync = factory({
    storage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    setTimeout: (fn, delay) => { const id = ++next; timers.set(id, { fn, delay }); return id; },
    clearTimeout: id => timers.delete(id),
    changed: (book, message, failed) => { state = { book: clone(book), message, failed }; },
    legacy: () => clone(legacy),
    request: async body => {
      if (body) posts.push(clone(body));
      if (request) return request(body);
      if (body && !(body.onlyIfMissing && Object.hasOwn(goals, body.shop))) goals[body.shop] = { set: true, lo: body.lo, hi: body.hi };
      return { ok: true, goals: clone(goals) };
    }
  });
  return { sync, posts, storage, goals, state: () => state, tick: async () => {
    const [id, task] = [...timers].sort((a, b) => a[1].delay - b[1].delay)[0] || [];
    if (!task) return;
    timers.delete(id); await task.fn();
  } };
}
test("typing automatically saves after the debounce without blur", async () => {
  const h = setup(); await h.sync.start();
  h.sync.edit("A", 35, 42); h.sync.edit("A", 36, 42);
  assert.equal(h.posts.length, 0); await h.tick();
  assert.equal(h.posts.length, 1); assert.equal(h.goals.A.lo, 36);
  assert.match(h.state().message, /已保存到服务器/);
});
test("an older response never replaces a newer edit and shops save serially", async () => {
  let release;
  const goals = {};
  const h = setup({ request: async body => {
    if (body) { await new Promise(resolve => { release = resolve; }); goals[body.shop] = { set: true, lo: body.lo, hi: body.hi }; }
    return { ok: true, goals: clone(goals) };
  } });
  await h.sync.start(); h.sync.edit("A", 30, 40);
  const first = h.sync.flush(); h.sync.edit("A", 35, 45); h.sync.edit("B", 20, 30);
  release(); await first; assert.equal(h.state().book.A.lo, 35); assert.equal(h.state().book.B.lo, 20);
  const second = h.sync.flush(); release(); await second;
  const third = h.sync.flush(); release(); await third;
  assert.deepEqual(h.posts.map(p => [p.shop, p.lo]), [["A", 30], ["A", 35], ["B", 20]]);
});
test("failed saves remain pending and automatically retry", async () => {
  let fail = true;
  const h = setup({ request: async body => {
    if (body && fail) throw new Error("offline");
    return { ok: true, goals: body ? { A: { set: true, lo: body.lo, hi: body.hi } } : {} };
  } });
  await h.sync.start(); h.sync.edit("A", 35, 42); await h.tick();
  assert.equal(h.state().failed, true); assert.match(h.state().message, /尚未保存/);
  assert.equal(JSON.parse(h.storage.get("xm-home-fee-pending-v1")).A.lo, 35);
  fail = false; await h.tick();
  assert.equal(h.state().failed, false); assert.deepEqual(JSON.parse(h.storage.get("xm-home-fee-pending-v1")), {});
});
test("refresh recovers an unsaved edit after closing the page", async () => {
  const storage = new Map(); const first = setup({ storage }); await first.sync.start(); first.sync.edit("A", 32, 38);
  const second = setup({ storage }); await second.sync.start(); await second.tick();
  assert.equal(second.goals.A.lo, 32);
});
test("legacy values fill only missing shops and cannot resurrect cleared settings", async () => {
  const goals = { A: { set: true, lo: 35, hi: 42 }, B: { set: true, lo: null, hi: null } };
  const h = setup({ goals, legacy: { A: { lo: 1, hi: 2 }, B: { lo: 3, hi: 4 }, C: { lo: 30, hi: 40 } } });
  await h.sync.start(); await h.tick();
  assert.deepEqual(h.posts.map(p => p.shop), ["C"]); assert.equal(h.posts[0].onlyIfMissing, true);
  assert.equal(goals.A.lo, 35); assert.equal(goals.B.lo, null);
});
test("legacy import loses to a server edit made after the initial read", async () => {
  const h = setup({ legacy: { A: { lo: 30, hi: 40 } } });
  await h.sync.start(); h.goals.A = { set: true, lo: 50, hi: 60 }; await h.tick();
  assert.equal(h.state().book.A.lo, 50);
});
test("another computer reads saved and cleared values without local storage", async () => {
  const goals = {}; const a = setup({ goals }); await a.sync.start(); a.sync.edit("A", 35, 42); await a.tick();
  const b = setup({ goals }); await b.sync.start(); assert.equal(b.state().book.A.lo, 35);
  a.sync.edit("A", null, null); await a.tick(); await b.sync.refresh();
  assert.deepEqual(b.state().book.A, { set: true, lo: null, hi: null });
});
test("failed initial read does not import stale browser settings", async () => {
  let fail = true;
  const h = setup({ legacy: { A: { lo: 30, hi: 40 } }, request: async () => fail ? null : { ok: true, goals: { A: { set: true, lo: 50, hi: 60 } } } });
  await h.sync.start(); assert.equal(h.posts.length, 0); assert.equal(h.state().failed, true);
  fail = false; await h.tick(); assert.equal(h.posts.length, 0); assert.equal(h.state().book.A.lo, 50);
});
test("leaving the module flushes a pending change immediately", async () => {
  const h = setup(); await h.sync.start(); h.sync.edit("A", 35, 42); h.sync.edit("B", 32, 38); h.sync.stop();
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.equal(h.goals.A.lo, 35); assert.equal(h.goals.B.lo, 32);
});
