import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { publicCatalog } from "../src/modules/bound/catalog.js";
import { SHOP_DAY } from "../src/modules/bound/shop-day-contract.js";

test("扫码登录后实际点击开始和暂停会提交任务，重复点击只发一次并显示失败原因", async () => {
  let poll, finish;
  let run = { status: 'interrupted', done: 20, total: 43, failed: 1, requests: 4013, cached: 340,
    selection: { label: '原选定的43店' }, shops: [] };
  const calls = [];
  const root = { innerHTML: '', querySelector: () => null, addEventListener(type, fn) { this[type] = fn; }, removeEventListener() {} };
  const reply = (body, ok = true) => ({ ok, json: async () => body });
  const context = vm.createContext({
    window: { location: { search: '?probeDate=2026-10-03' } }, URLSearchParams: globalThis.URLSearchParams, Intl, Date,
    document: { getElementById: () => null, createElement: () => ({}), head: { appendChild() {} } },
    setInterval: fn => { poll = fn; return 1; }, clearInterval() {},
    fetch: async (url, options = {}) => {
      calls.push({ url, options });
      if (url === '/api/bound') return reply({ ok: true });
      if (url === '/api/bound/catalog') return reply(publicCatalog());
      if (url === '/api/bound/link') return reply({ phase: 'logged_in', provider: 'WECHAT', batchLoginReady: true, collection: {} });
      if (url === '/api/bound/progress') return reply({ items: [] });
      if (url === '/api/bound/shop-day') return reply({ ok: true, runtime: 'server', scope: SHOP_DAY, reports: [] });
      if (url === '/api/bound/shop-day/run') return reply({ ok: true, run: null });
      if (url === '/api/bound/shop-day/batch') return reply({ ok: true, run });
      if (/\/batch\/(start|stop)$/.test(url)) return new Promise(resolve => { finish = resolve; });
      if (url.startsWith('/api/bound/collect/probe')) return reply({ target: { ...SHOP_DAY, metric: 'test' } });
      return reply({}, false);
    }
  });
  vm.runInContext(await readFile(new URL('../public/shared/modules/bound.js', import.meta.url), 'utf8'), context);
  const unmount = context.window.XmModules['/bound'].mount(root);
  try {
    await delay(20);
    const click = act => root.click({ target: { closest: selector => selector === '[data-act]' ? { getAttribute: key => key === 'data-act' ? act : null } : null } });
    const posts = () => calls.filter(call => call.options.method === 'POST');
    assert.match(root.innerHTML, /data-act="batch-start">开始/);
    click('batch-start'); click('batch-start');
    assert.equal(posts().length, 1, '开始按钮必须真正发出一次请求');
    assert.equal(posts()[0].url, '/api/bound/shop-day/batch/start');
    assert.equal(posts()[0].options.body, '{}', '复用服务器原队列，不替换43店范围');
    run = { ...run, status: 'running', failed: 0 };
    finish(reply({ ok: true, run })); await delay(10);
    assert.match(root.innerHTML, /采集中 · 完成 20\/43/);
    assert.match(root.innerHTML, /data-act="batch-start" disabled/);
    assert.match(root.innerHTML, /data-act="batch-stop">暂停/);
    click('batch-stop'); click('batch-stop');
    assert.equal(posts().length, 2);
    assert.equal(posts()[1].url, '/api/bound/shop-day/batch/stop');
    finish(reply({ ok: true, stopping: true })); await delay(10);
    run = { ...run, status: 'paused' }; poll(); await delay(10);
    assert.match(root.innerHTML, /已暂停 · 完成 20\/43/);
    click('batch-start'); finish(reply({ ok: false, reason: 'server_login_required' }, false)); await delay(10);
    assert.match(root.innerHTML, /请先扫码或用账号密码登录/);
    assert.doesNotMatch(root.innerHTML, /采集中 · 完成 20\/43/);
    assert.equal(posts().length, 3);
    assert.ok(posts().every(call => call.url.startsWith('/api/bound/shop-day/batch/')), '点击续采不提交登录或新建单店任务');
  } finally { unmount(); }
});

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
