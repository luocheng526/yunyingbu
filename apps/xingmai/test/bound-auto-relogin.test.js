import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createPasswordAuth } from "../src/modules/bound/password-login.js";
import { boundRouter } from "../src/modules/bound/router.js";
import { linkStatus, loginWithPassword, setAutoReloginPreference, resetBoundStore, setBoundFetch } from "../src/modules/bound/store.js";
import { resetPasswordCredentials } from "../src/modules/bound/collect.js";
import { PROBE_TARGET, runSingleProbe } from "../src/modules/bound/probe.js";
import { readState } from "../src/modules/bound/persist.js";

test("取消选项立即清除服务器凭据，持久化选择；重新勾选不会自动登录", async () => {
  resetBoundStore();
  let calls = 0;
  setBoundFetch(async url => {
    calls++;
    const path = new URL(url).pathname;
    const data = path.endsWith('/auth/info') ? { uid: 'test-user', verify: true }
      : path.endsWith('/auth/getUserInfo') ? { userInfo: { userId: 'test-user', companyId: 'test-company' } } : {};
    return new globalThis.Response(JSON.stringify({ code: path.endsWith('/shop/operatingData') ? -1 : 0, data }),
      { headers: { 'content-type': 'application/json', 'set-cookie': 'sid=test-cookie; Path=/' } });
  });
  try {
    assert.equal((await linkStatus()).autoReloginEnabled, false);
    await loginWithPassword({ userName: 'test-user', password: 'test-secret', autoRelogin: true });
    assert.equal((await linkStatus()).passwordAuth.autoReloginReady, true);
    assert.equal((await linkStatus()).autoReloginEnabled, true);
    const before = calls;
    const result = await setAutoReloginPreference({ enabled: false });
    assert.equal(result.passwordAuth.autoReloginReady, false);
    assert.equal(calls, before);
    assert.equal(await readState('password-auto-relogin'), false);
    resetPasswordCredentials(); // A process restart keeps persisted preferences, never credentials.
    assert.equal((await linkStatus()).autoReloginEnabled, false);
    await setAutoReloginPreference({ enabled: true });
    assert.equal(calls, before);
    assert.equal((await linkStatus()).passwordAuth.autoReloginReady, false);
    await runSingleProbe({ shopId: PROBE_TARGET.shopId, platform: PROBE_TARGET.platform, date: PROBE_TARGET.date });
    assert.equal(calls, before + 1, '会话过期后仅请求报表，不提交重新登录');
    assert.equal((await linkStatus()).passwordAuth.autoReloginReady, false);
  } finally { resetBoundStore(); }
});

test("登录进行中取消后，即使登录成功也不能重新缓存自动重登密码", async () => {
  let saved = { cookies: {}, deviceId: 'test-device' }, finish, started;
  const waiting = new Promise(resolve => { started = resolve; });
  const auth = createPasswordAuth({ readSession: async () => saved, saveSession: async value => { saved = value; },
    request: async (current, spec) => {
      current.cookies.sid = 'test-cookie';
      if (spec.path === '/auth/login') { started(); await new Promise(resolve => { finish = resolve; }); }
      const data = spec.path === '/auth/info' ? { uid: 'one', verify: true }
        : spec.path === '/auth/getUserInfo' ? { userInfo: { userId: 'one', companyId: 'company' } } : {};
      return { httpStatus: 200, payload: { code: 0, data } };
    }
  });
  const login = auth.signIn({ userName: 'one', password: 'test-secret', autoRelogin: true });
  await waiting;
  auth.disableAutoRelogin(); finish();
  assert.equal((await login).ok, true);
  assert.equal(auth.status().autoReloginReady, false);
  assert.equal((await auth.refresh()).reason, 'credentials_unavailable');
  assert.doesNotMatch(JSON.stringify(saved), /test-secret/);
});

test("自动重登等待状态落盘时取消，尚未发送的登录请求必须停止", async () => {
  let saved = { cookies: {}, deviceId: 'test-device' }, calls = 0, hold = false, finish, started;
  const waiting = new Promise(resolve => { started = resolve; });
  const auth = createPasswordAuth({ readSession: async () => saved,
    saveSession: async value => {
      saved = value;
      if (hold && value.phase === 'logging_in') { started(); await new Promise(resolve => { finish = resolve; }); }
    },
    request: async (current, spec) => {
      calls++; current.cookies.sid = 'test-cookie';
      const data = spec.path === '/auth/info' ? { uid: 'one', verify: true }
        : spec.path === '/auth/getUserInfo' ? { userInfo: { userId: 'one', companyId: 'company' } } : {};
      return { httpStatus: 200, payload: { code: 0, data } };
    }
  });
  await auth.signIn({ userName: 'one', password: 'test-secret', autoRelogin: true });
  assert.equal(calls, 3);
  hold = true;
  const refresh = auth.refresh(); await waiting;
  auth.disableAutoRelogin(); finish();
  assert.equal((await refresh).reason, 'auto_relogin_disabled');
  assert.equal(calls, 3); assert.equal(auth.status().autoReloginReady, false);
  assert.equal(saved.phase, 'needs_password');
});

test("设置接口只接受本站管理员的布尔选择，修改和查询均不请求旧站", async () => {
  resetBoundStore();
  let calls = 0;
  setBoundFetch(async () => { calls++; throw new Error('unexpected upstream'); });
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => { if (req.headers['x-test-user']) req.user = { username: req.headers['x-test-user'] }; next(); });
  app.use('/api/bound', boundRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.on('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/bound`;
  const post = (body, headers = {}) => fetch(base + '/link/auto-relogin', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-test-user': 'luocheng', ...headers }, body: JSON.stringify(body)
  });
  try {
    assert.equal((await post({ enabled: false }, { 'x-test-user': '' })).status, 401);
    assert.equal((await post({ enabled: false }, { 'x-test-user': 'other' })).status, 403);
    assert.equal((await post({ enabled: false }, { origin: 'https://other.example' })).status, 403);
    assert.equal((await post({ enabled: false }, { 'sec-fetch-site': 'cross-site' })).status, 403);
    assert.equal((await post({ enabled: false }, { 'content-type': 'text/plain' })).status, 403);
    for (const input of [{ enabled: 'false' }, {}, { enabled: true, password: 'test-secret' }]) {
      assert.equal((await post(input)).status, 400);
    }
    const enabled = await post({ enabled: true }); assert.equal(enabled.status, 200);
    assert.equal((await enabled.json()).autoReloginEnabled, true);
    const disabled = await post({ enabled: false });
    assert.equal(disabled.headers.get('cache-control'), 'no-store');
    assert.equal((await disabled.json()).autoReloginEnabled, false);
    const status = await (await fetch(base + '/link', { headers: { 'x-test-user': 'luocheng' } })).json();
    assert.equal(status.autoReloginEnabled, false); assert.equal(calls, 0);
    const writes = [setAutoReloginPreference({ enabled: true }), setAutoReloginPreference({ enabled: false })];
    await Promise.all(writes);
    assert.equal((await linkStatus()).autoReloginEnabled, false);
  } finally { await new Promise(resolve => server.close(resolve)); resetBoundStore(); }
});
