import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import { boundRouter } from '../src/modules/bound/router.js';
import { createShopBatch } from '../src/modules/bound/shop-batch.js';
import { SHOP_DAY } from '../src/modules/bound/shop-day-contract.js';
import { startLink, pollLink, pickAccount, loginWithPassword, linkStatus, setBoundFetch, resetBoundStore } from '../src/modules/bound/store.js';
import { requestVisibleShops, requestBatchShopDayReport } from '../src/modules/bound/collect.js';
import { readState, writeState } from '../src/modules/bound/persist.js';

const creds = { userName: 'test-account', password: 'test-secret', autoRelogin: false };
const shops = Array.from({ length: 44 }, (_, i) => ({ ...SHOP_DAY, shopId: String(100 + i), shopName: '测试店' + i }));
const previousMode = process.env.BOUND_COLLECTION_MODE;
test.beforeEach(() => { resetBoundStore(); delete process.env.BOUND_COLLECTION_MODE; });
test.afterEach(() => { resetBoundStore(); if (previousMode === undefined) delete process.env.BOUND_COLLECTION_MODE; else process.env.BOUND_COLLECTION_MODE = previousMode; });

function upstream(config = {}) {
  const calls = [];
  const json = (payload, cookie = true, status = 200) => new globalThis.Response(JSON.stringify(payload), { status,
    headers: { 'content-type': 'application/json', ...(cookie ? { 'set-cookie': 'sid=test-session; Path=/' } : {}) } });
  setBoundFetch(async (url, options = {}) => {
    const path = new URL(url).pathname; calls.push({ path, options });
    if (path.endsWith('/auth/login')) return json(config.loginFailure || { code: 0, data: {} });
    if (path.endsWith('/auth/qrcode')) return json({ code: 0, data: { scene: 'scene-' + calls.length, url: 'https://example.test/official-qr' } }, config.cookies !== false);
    if (path.endsWith('/auth/checkQrcode')) return json(config.scanReply || { code: 0, data: {} }, config.cookies !== false);
    if (path.endsWith('/auth/ticket/login')) return json({ code: 0, data: {} }, config.cookies !== false);
    if (path.endsWith('/auth/info')) return json({ code: 0, data: { uid: config.uid || 'one', verify: config.verify !== false } }, config.cookies !== false);
    if (path.endsWith('/auth/getUserInfo')) {
      if (config.waitProfile) await config.waitProfile();
      return json(config.profileFailure || { code: 0, data: { userInfo: { userId: config.user || 'one', companyID: config.company || 'company', nickName: '扫码用户' } } }, config.cookies !== false);
    }
    if (path.endsWith('/getAllChannelList')) return json({ code: 0, data: [{ channel: 'JD', shopList: shops }] });
    return json(config.expired ? { code: -1 } : { code: 0, data: [] });
  });
  return calls;
}

test('密码会话切换扫码后保留原队列43家范围和断点，成功店不重采，不提交密码重登', async () => {
  const config = {}, calls = upstream(config), directory = await mkdtemp(join(tmpdir(), 'bound-qr-resume-'));
  try {
    await loginWithPassword(creds);
    const original = await requestVisibleShops();
    let stopSecond = true; const visits = [];
    const batch = createShopBatch({ directory, discover: requestVisibleShops, makeJob: scope => ({
      start: async () => ({ ok: true }), status: async () => null, stop() {}, wait: async () => {
        visits.push(scope.shopId);
        return scope.shopId === shops[1].shopId && stopSecond
          ? { status: 'stopped', done: 0, total: 1, requests: 1, errors: [{ reason: 'login_expired' }] }
          : { status: 'complete', done: 1, total: 1, requests: 1, errors: [] };
      }
    }) });
    await batch.start({ selection: { label: '原43家店', shopKeys: shops.slice(0, 43).map(s => 'JD:' + s.shopId) } });
    assert.equal((await batch.wait()).done, 1);
    await startLink('WECHAT');
    assert.equal((await readState('session')).passwordIdentity, null);
    const scanned = await pollLink();
    assert.equal(scanned.phase, 'logged_in'); assert.equal(scanned.batchLoginReady, true);
    assert.equal(scanned.passwordAuth.autoReloginReady, false);
    const renewed = await requestVisibleShops(); assert.equal(renewed.owner, original.owner);
    stopSecond = false;
    await batch.start(); const done = await batch.wait();
    assert.equal(done.status, 'complete'); assert.equal(done.total, 43); assert.equal(done.done, 43);
    assert.equal(visits.filter(id => id === shops[0].shopId).length, 1);
    assert.ok(!visits.includes(shops[43].shopId));
    assert.equal((await requestBatchShopDayReport({ reportId: 'channel_operating' }, () => {}, shops[1], renewed.owner)).httpStatus, 200);
    config.expired = true;
    await requestBatchShopDayReport({ reportId: 'channel_operating' }, () => {}, shops[1], renewed.owner);
    assert.equal((await linkStatus()).phase, 'needs_scan');
    const before = calls.length;
    await pollLink(); await requestVisibleShops();
    assert.equal(calls.length, before, '过期不会自动换码或提交密码登录');
    assert.equal(calls.filter(c => c.path.endsWith('/auth/login')).length, 1);
    for (const field of ['user', 'company']) {
      config.expired = false; config[field] = 'different';
      if (field === 'user') config.uid = 'different';
      await startLink('WECHAT'); await pollLink();
      assert.equal((await batch.start()).reason, 'identity_changed');
      assert.equal((await batch.status()).done, 43);
      delete config[field]; delete config.uid;
    }
  } finally { assert.ok(directory.startsWith(join(tmpdir(), 'bound-qr-resume-'))); await rm(directory, { recursive: true, force: true }); }
});

test('扫码必须验证会话Cookie、uid及用户资料；旧扫码会话不能沿用残留密码身份', async () => {
  for (const config of [{ verify: false }, { cookies: false }, { user: 'other' }, { profileFailure: { code: -1, content: 'test-secret' } }]) {
    resetBoundStore(); const calls = upstream(config);
    await startLink('WECHAT'); const result = await pollLink();
    assert.equal(result.phase, 'needs_scan'); assert.equal(result.batchLoginReady, false);
    const before = calls.length;
    assert.equal((await requestVisibleShops()).reason, 'server_login_required');
    await pollLink(); assert.equal(calls.length, before);
    assert.equal((await readState('session')).passwordIdentity, null);
    assert.doesNotMatch(JSON.stringify(result), /test-secret|test-session/);
  }
  await writeState('session', { provider: 'WECHAT', phase: 'logged_in', cookies: { sid: 'old' }, passwordIdentity: { userId: 'one', companyId: 'company' } });
  assert.equal((await requestVisibleShops()).reason, 'server_login_required');
});

test('选企业必须来自扫码候选项，最终资料必须对应所选企业', async () => {
  const config = { scanReply: { code: 0, data: { needSelect: true, loginTicket: 'test-ticket', accounts: [{ companyId: 'company', companyName: '甲' }, { companyId: 'second', companyName: '乙' }] } } };
  const calls = upstream(config);
  await startLink('WECHAT'); assert.equal((await pollLink()).phase, 'choose_account');
  const before = calls.length;
  assert.equal((await pickAccount('unlisted')).ok, false); assert.equal(calls.length, before);
  assert.equal((await pickAccount('second')).phase, 'needs_scan');
  assert.equal((await linkStatus()).batchLoginReady, false);
  await startLink('WECHAT'); await pollLink();
  assert.equal((await pickAccount('company')).phase, 'logged_in');
  assert.equal((await requestVisibleShops()).ok, true);
});

test('扫码不会解除已知的密码登录日限额；二维码过期后等待用户主动换码', async () => {
  const config = { loginFailure: { code: 1001, content: '手机号登录今日失败次数已达上限，请明天再试' } }, calls = upstream(config);
  await loginWithPassword(creds);
  const until = (await linkStatus()).loginRetryAfter;
  await startLink('WECHAT'); await pollLink();
  assert.equal((await linkStatus()).passwordRetryAfter, until);
  const before = calls.length;
  assert.equal((await loginWithPassword(creds)).reason, 'login_daily_limit');
  assert.equal(calls.length, before);
  assert.equal((await linkStatus()).phase, 'logged_in');
  config.scanReply = { code: 1000103 };
  await startLink('WECHAT'); await pollLink();
  assert.equal((await linkStatus()).phase, 'needs_scan');
  const expired = calls.length; await pollLink(); await pollLink();
  assert.equal(calls.length, expired);
});

test('扫码身份验证的迟到响应不能覆盖后来成功的密码会话', async () => {
  let release, entered; const waiting = new Promise(resolve => { entered = resolve; });
  const config = { waitProfile: () => { entered(); return new Promise(resolve => { release = resolve; }); } };
  upstream(config); await startLink('WECHAT');
  const pending = pollLink(); await waiting;
  config.waitProfile = null;
  await loginWithPassword({ ...creds, userName: 'new-account' }); release(); await pending;
  const result = await linkStatus();
  assert.equal(result.provider, 'PASSWORD'); assert.equal(result.userName, 'new-account');
  assert.equal((await readState('session')).qrIdentityGeneration, null);
});

test('二维码获取或轮询异常不会抛出未处理异常，也不会提交密码登录', async () => {
  let calls = 0;
  setBoundFetch(async () => { calls++; throw new Error('test-ticket-secret'); });
  const failed = await startLink('WECHAT');
  assert.equal(failed.phase, 'needs_scan'); assert.equal(failed.qrReady, false);
  await pollLink(); assert.equal(calls, 1);
  assert.doesNotMatch(JSON.stringify(failed), /test-ticket-secret/);
  await writeState('session', { provider: 'WECHAT', phase: 'waiting_scan', scene: 'pending', cookies: {}, authGeneration: 'qr-generation' });
  assert.equal((await pollLink()).phase, 'waiting_scan');
  assert.equal(calls, 2);
});

test('非微信扫码显示官方HTTPS授权链接，管理员之外不能获取，图片失败返回受控错误', async () => {
  const app = express();
  app.use((req, _res, next) => { if (req.headers['x-test-user']) req.user = { username: req.headers['x-test-user'] }; next(); });
  app.use('/api/bound', boundRouter);
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.on('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/bound/link/qr?open=1`;
  try {
    await writeState('session', { provider: 'FEISHU', phase: 'waiting_scan', qrUrl: 'https://example.test/official-authorize', cookies: {} });
    assert.equal((await fetch(url, { redirect: 'manual' })).status, 401);
    const response = await fetch(url, { headers: { 'x-test-user': 'luocheng' }, redirect: 'manual' });
    assert.equal(response.status, 302); assert.equal(response.headers.get('location'), 'https://example.test/official-authorize');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    await writeState('session', { provider: 'FEISHU', qrUrl: 'javascript:invalid', cookies: {} });
    assert.equal((await fetch(url, { headers: { 'x-test-user': 'luocheng' }, redirect: 'manual' })).status, 400);
    await writeState('session', { provider: 'WECHAT', qrUrl: 'https://example.test/missing-qr', cookies: {} });
    setBoundFetch(async () => { throw new Error('upstream-secret'); });
    const image = await fetch(url, { headers: { 'x-test-user': 'luocheng' } });
    assert.equal(image.status, 502); assert.doesNotMatch(await image.text(), /upstream-secret/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
