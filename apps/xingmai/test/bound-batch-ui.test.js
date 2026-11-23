import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { publicCatalog } from "../src/modules/bound/catalog.js";
import { SHOP_DAY } from "../src/modules/bound/shop-day-contract.js";

test("正在采集的行即时更新，轮询仅请求状态且不覆盖登录输入", async () => {
  let poll, done = 12; const calls = [];
  const root = { innerHTML: '', querySelector: () => null, addEventListener(type, fn) { this[type] = fn; }, removeEventListener() {} };
  const reply = body => ({ ok: true, json: async () => body });
  const context = vm.createContext({
    window: { location: { search: '?probeDate=2026-10-03' } }, URLSearchParams: globalThis.URLSearchParams, Intl, Date,
    document: { getElementById: () => null, createElement: () => ({}), head: { appendChild() {} } },
    setInterval: fn => { poll = fn; return 1; }, clearInterval() {},
    fetch: async url => {
      calls.push(url);
      if (url === '/api/bound') return reply({ ok: true });
      if (url === '/api/bound/catalog') return reply(publicCatalog());
      if (url === '/api/bound/link') return reply({ phase: 'logged_in', collection: {} });
      if (url === '/api/bound/progress') return reply({ items: [] });
      if (url === '/api/bound/shop-day') return reply({ ok: true, runtime: 'server', scope: SHOP_DAY, reports: [] });
      if (url === '/api/bound/shop-day/run') return reply({ ok: true, run: null });
      if (url === '/api/bound/shop-day/batch') return reply({ ok: true, run: {
        status: 'running', done: 0, total: 1, failed: 0, requests: done, cached: 0, current: SHOP_DAY,
        selection: { label: '选定在营店铺' }, shops: [{ scope: SHOP_DAY, status: 'running' }],
        currentRun: { scope: SHOP_DAY, status: 'running', done, total: 150, inFlight: [{ reportId: 'channel_area' }, { reportId: 'channel_hour' }] }
      } });
      if (url.startsWith('/api/bound/collect/probe')) return reply({ target: { ...SHOP_DAY, metric: 'test' } });
      return { ok: false };
    }
  });
  vm.runInContext(await readFile(new URL('../public/shared/modules/bound.js', import.meta.url), 'utf8'), context);
  const unmount = context.window.XmModules['/bound'].mount(root);
  await delay(20);
  assert.match(root.innerHTML, /12\/150 · 正在处理 2 项/);
  assert.match(root.innerHTML, /选定在营店铺/);
  const before = calls.length; done = 17;
  poll(); poll(); await delay(20);
  assert.match(root.innerHTML, /17\/150 · 正在处理 2 项/);
  assert.deepEqual(calls.slice(before).sort(), ['/api/bound/link', '/api/bound/shop-day/batch', '/api/bound/shop-day/run']);
  root.focusin({ target: { closest: () => ({}) } });
  const typing = calls.length; poll(); await delay(10); assert.equal(calls.length, typing);
  unmount(); poll(); await delay(10); assert.equal(root.innerHTML, ''); assert.equal(calls.length, typing);
});
