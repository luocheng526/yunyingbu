import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { publicCatalog } from '../src/modules/bound/catalog.js';

test('取消选项单独保存，保留输入，轮询和重新打开页面不重新勾选、不触发登录', async () => {
  let enabled = true, poll, finish, fail = false;
  const calls = [];
  const fields = {
    '[name="bound-auto-relogin"]': { checked: true, getAttribute: key => key === 'data-act' ? 'auto-relogin' : null },
    '[name="bound-password"]': { value: 'test-secret' },
    '[data-auto-relogin-status]': { textContent: '' },
    '[data-act="password-login"]': { disabled: false }
  };
  const root = { innerHTML: '', querySelector: key => fields[key] || null,
    addEventListener(type, fn) { this[type] = fn; }, removeEventListener() {} };
  const reply = body => ({ ok: true, json: async () => body });
  const context = vm.createContext({ window: { location: { search: '?probeDate=2026-10-03' } },
    URLSearchParams: globalThis.URLSearchParams, Intl, Date,
    document: { getElementById: () => null, createElement: () => ({}), head: { appendChild() {} } },
    setInterval: fn => { poll = fn; return 1; }, clearInterval() {},
    fetch: async (url, options = {}) => {
      calls.push({ url, options });
      if (url === '/api/bound') return reply({ ok: true });
      if (url === '/api/bound/catalog') return reply(publicCatalog());
      if (url === '/api/bound/link') return reply({ phase: 'needs_password', collection: {}, autoReloginEnabled: enabled });
      if (url === '/api/bound/progress') return reply({ items: [] });
      if (url === '/api/bound/link/auto-relogin') {
        await new Promise(resolve => { finish = resolve; });
        if (fail) throw new Error('offline');
        enabled = JSON.parse(options.body).enabled;
        return reply({ ok: true, autoReloginEnabled: enabled, passwordAuth: { autoReloginReady: false } });
      }
      if (url.startsWith('/api/bound/collect/probe')) return reply({});
      return { ok: false };
    }
  });
  vm.runInContext(await readFile(new URL('../public/shared/modules/bound.js', import.meta.url), 'utf8'), context);
  let stop = context.window.XmModules['/bound'].mount(root);
  await delay(20);
  const checkbox = () => root.innerHTML.match(/<input name="bound-auto-relogin"[^>]*>/)[0];
  assert.match(checkbox(), / checked/);
  const field = fields['[name="bound-auto-relogin"]']; field.checked = false;
  root.change({ target: field });
  assert.equal(fields['[data-act="password-login"]'].disabled, true);
  const posts = calls.filter(c => c.options.method === 'POST');
  assert.equal(posts.length, 1); assert.equal(posts[0].url, '/api/bound/link/auto-relogin');
  assert.deepEqual(JSON.parse(posts[0].options.body), { enabled: false });
  assert.equal(fields['[name="bound-password"]'].value, 'test-secret');
  // An old poll response still reports true while the preference save is pending.
  poll(); await delay(10); assert.doesNotMatch(checkbox(), / checked/);
  finish(); await delay(10);
  assert.equal(enabled, false);
  assert.match(fields['[data-auto-relogin-status]'].textContent, /已关闭/);
  assert.equal(fields['[data-act="password-login"]'].disabled, false);
  poll(); await delay(10); assert.doesNotMatch(checkbox(), / checked/);
  stop(); stop = context.window.XmModules['/bound'].mount(root);
  await delay(20); assert.doesNotMatch(checkbox(), / checked/);
  assert.equal(calls.filter(c => c.url === '/api/bound/link/password').length, 0);
  fail = true; field.checked = true; root.change({ target: field }); finish(); await delay(10);
  assert.match(fields['[data-auto-relogin-status]'].textContent, /未保存/);
  stop();
});

test('已保存的1000101提示准确原因并展开扫码，刷新不重试；密码提交与旧站去空白规则一致', async () => {
  const calls = [];
  const fields = {
    '[name="bound-user-name"]': { value: ' test-account ' },
    '[name="bound-password"]': { value: ' \tA b+&123\u3000' },
    '[name="bound-auto-relogin"]': { checked: false }
  };
  let link = { phase: 'needs_password', authFailure: 'login_failed', message: '旧的笼统提示', collection: {},
    authDiagnostic: { stage: 'login', httpStatus: 200, upstreamCode: 1000101 } };
  const root = { innerHTML: '', querySelector: key => fields[key] || null,
    addEventListener(type, fn) { this[type] = fn; }, removeEventListener() {} };
  const reply = body => ({ ok: true, json: async () => body });
  const context = vm.createContext({ window: { location: { search: '?probeDate=2026-10-03' } },
    URLSearchParams: globalThis.URLSearchParams, Intl, Date,
    document: { getElementById: () => null, createElement: () => ({}), head: { appendChild() {} } },
    setInterval: () => 1, clearInterval() {},
    fetch: async (url, options = {}) => {
      calls.push({ url, options });
      if (url === '/api/bound') return reply({ ok: true });
      if (url === '/api/bound/catalog') return reply(publicCatalog());
      if (url === '/api/bound/link') return reply(link);
      if (url === '/api/bound/progress') return reply({ items: [] });
      if (url === '/api/bound/link/password') return reply({ ...link, ok: false });
      if (url.startsWith('/api/bound/collect/probe')) return reply({});
      return { ok: false };
    }
  });
  vm.runInContext(await readFile(new URL('../public/shared/modules/bound.js', import.meta.url), 'utf8'), context);
  let stop = context.window.XmModules['/bound'].mount(root);
  await delay(20);
  assert.match(root.innerHTML, /用户名或密码错误/);
  assert.doesNotMatch(root.innerHTML, /旧的笼统提示/);
  assert.match(root.innerHTML, /<details data-bound-qr open>/);
  assert.match(root.innerHTML, /https:\/\/hejun.ecbis.cn\/login/);
  assert.equal(calls.filter(c => c.options.method === 'POST').length, 0);
  const clickLogin = () => root.click({ target: { closest: () => ({ getAttribute: key => key === 'data-act' ? 'password-login' : null }) } });
  clickLogin(); await delay(20);
  const post = calls.find(c => c.options.method === 'POST');
  assert.deepEqual(JSON.parse(post.options.body), { userName: 'test-account', password: 'A b+&123', autoRelogin: false });
  assert.equal(fields['[name="bound-password"]'].value, '');
  fields['[name="bound-password"]'].value = ' \u3000\t';
  clickLogin(); await delay(20);
  assert.equal(calls.filter(c => c.options.method === 'POST').length, 1);
  stop();
  link = { ...link, authFailure: 'login_daily_limit', message: '今日登录失败已达上限', loginRetryAfter: new Date(Date.now() + 60000).toISOString() };
  stop = context.window.XmModules['/bound'].mount(root); await delay(20);
  assert.match(root.innerHTML, /今日登录失败已达上限/);
  assert.match(root.innerHTML, /data-act="password-login" disabled/);
  assert.doesNotMatch(root.innerHTML, /旧站返回“用户名或密码错误”/);
  stop();
});
