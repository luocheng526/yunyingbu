import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { publicCatalog } from '../src/modules/bound/catalog.js';

test('扫码区域保持展开、相同二维码复用图片，防止重复提交，完成后提示续采', async () => {
  let poll, finish, reused = 0;
  let link = { ok: true, provider: 'WECHAT', phase: 'idle', collection: {} };
  const calls = [];
  const root = { innerHTML: '', querySelector(selector) {
    if (selector !== '.bd-qr') return null;
    const src = this.innerHTML.match(/class="bd-qr"[^>]*src="([^"]+)"/)?.[1];
    return src ? { src, replaceWith(old) { assert.equal(old.src, src); reused++; } } : null;
  }, addEventListener(type, fn) { this[type] = fn; }, removeEventListener() {} };
  const reply = body => ({ ok: true, json: async () => body });
  const context = vm.createContext({
    window: { location: { search: '?probeDate=2026-10-03' } }, URLSearchParams: globalThis.URLSearchParams, Date, Intl,
    document: { getElementById: () => null, createElement: () => ({}), head: { appendChild() {} } },
    setInterval: fn => { poll = fn; return 1; }, clearInterval() {},
    fetch: async (url, options = {}) => {
      calls.push({ url, options });
      if (url === '/api/bound') return reply({ ok: true });
      if (url === '/api/bound/catalog') return reply(publicCatalog());
      if (url === '/api/bound/link') return reply(link);
      if (url === '/api/bound/progress') return reply({ items: [] });
      if (url === '/api/bound/link/start') return new Promise(resolve => { finish = () => {
        link = { ...link, provider: JSON.parse(options.body).provider, phase: 'waiting_scan', qrReady: true, qrToken: 'stable-scene' }; resolve(reply(link));
      }; });
      if (url.startsWith('/api/bound/collect/probe')) return reply({});
      return { ok: false };
    }
  });
  vm.runInContext(await readFile(new URL('../public/shared/modules/bound.js', import.meta.url), 'utf8'), context);
  const stop = context.window.XmModules['/bound'].mount(root); await delay(20);
  const click = attrs => root.click({ target: { closest: () => ({ getAttribute: key => attrs[key] }) } });
  root.toggle({ target: { open: true, getAttribute: key => key === 'data-bound-qr' ? '' : null } });
  poll(); await delay(10); assert.match(root.innerHTML, /<details data-bound-qr open>/);
  click({ 'data-act': 'scan', 'data-provider': 'WECHAT' });
  click({ 'data-act': 'scan', 'data-provider': 'WECHAT' });
  assert.equal(calls.filter(c => c.url === '/api/bound/link/start').length, 1);
  finish(); await delay(10);
  assert.match(root.innerHTML, /\/api\/bound\/link\/qr\?v=stable-scene/);
  assert.doesNotMatch(root.innerHTML, /\/link\/qr\?ts=/);
  poll(); await delay(10); assert.match(root.innerHTML, /<details data-bound-qr open>/);
  assert.ok(reused > 0, '轮询复用同一张图片节点');
  link = { ...link, qrReady: false, phase: 'logged_in', batchLoginReady: true, message: '扫码已登录，请点击开始 / 继续本轮采集' };
  poll(); await delay(10);
  assert.match(root.innerHTML, /扫码已登录，请点击开始 \/ 继续本轮采集/);
  assert.equal(calls.filter(c => c.url === '/api/bound/shop-day/batch/start').length, 0);
  assert.equal(calls.filter(c => c.url === '/api/bound/link/password').length, 0);
  click({ 'data-act': 'scan', 'data-provider': 'FEISHU' }); finish(); await delay(10);
  assert.match(root.innerHTML, /href="\/api\/bound\/link\/qr\?open=1"/);
  assert.doesNotMatch(root.innerHTML, /class="bd-qr"/);
  stop();
});
