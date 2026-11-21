import './_memory-env.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { beginRelogin, cancelRelogin, homeCollectionGate, humanProtectsShop, reloginState, resetJingmaiDeps, setJingmaiDeps } from '../src/modules/home/jingmai-runner.js';
import { listSessions, resetJingmaiStore, saveSession } from '../src/modules/home/jingmai-store.js';
import { createLive2Collector } from '../src/modules/home/live2-collect.js';

const shop = '交接测试店';
const jar = value => [{ name: 'thor', value }];
const org = [{ store: shop, shopId: '2001', enabled: true, login: 'fixture', password: 'fixture' }];
const settle = () => new Promise(resolve => setImmediate(resolve));

test('verified desk login releases human protection and lets live2 replace the expired row', async t => {
  await resetJingmaiStore();
  t.after(resetJingmaiDeps);
  await saveSession(shop, { cookies: jar('old'), authState: 'login_expired', shopId: '2001' });
  let closed = 0, metricsStarted, releaseMetrics;
  const started = new Promise(resolve => { metricsStarted = resolve; });
  const metrics = new Promise(resolve => { releaseMetrics = resolve; });
  setJingmaiDeps({ loadOrg: async () => org.map(row => ({ ...row })),
    client: { login: async () => { throw Object.assign(new Error('need desk'), { code: 'login' }); },
      fetchAccountIdentity: async () => ({ shopId: '2001', shopName: shop }),
      fetchHome: async () => { metricsStarted(); await metrics; return { dealAmount: 100, paidAmount: 20 }; } },
    desk: { open: async () => ({ status: 'verify' }), close: async () => { closed++; },
      poll: async () => ({ status: 'ok', cookies: jar('fresh'), pageMatch: true }) }
  });
  await beginRelogin(shop, ''); await settle();
  assert.equal(humanProtectsShop(shop), true);
  const completion = reloginState(shop);
  await started;
  const concurrentPoll = reloginState(shop);
  const whileSaving = await Promise.race([concurrentPoll,
    new Promise(resolve => setTimeout(() => resolve({ status: 'duplicate-save-still-pending' }), 100))]);
  releaseMetrics();
  await completion; await concurrentPoll;
  assert.equal(whileSaving.status, 'finishing');
  assert.equal(closed, 1, 'a concurrent poll must not close or save the same login twice');
  assert.equal((await completion).status, 'ok');
  assert.equal(humanProtectsShop(shop), false, 'successful login must stop blocking collection immediately');
  assert.equal((await reloginState(shop)).status, 'ok', 'late polling sees the completed result');
  assert.equal(closed, 1);
  let pending, collected = 0;
  const collector = createLive2Collector({ ...homeCollectionGate(), storePath: '',
    now: () => '2026/11/21 10:00:00', loadOrg: async () => org.map(row => ({ ...row })), listSessions,
    listSamples: async () => [], published: [{ shop, loginExpired: true, loginNeedsHuman: true,
      loginSessionVersion: 'g:1', liveAmount: 1, capturedAt: '2026/11/21 01:00:00' }],
    track: task => { pending = task; }, client: { fetchHome: async () => { collected++; return { dealAmount: 100, paidAmount: 20 }; } }
  });
  await collector.start(''); await pending;
  const row = (await collector.board('')).records[0];
  assert.equal(collected, 1); assert.equal(row.online, true); assert.equal(row.loginExpired, false);
  assert.equal(row.liveAmount, 100);
});

test('login completed while opening also releases the guard without waiting for a poll', async t => {
  await resetJingmaiStore(); t.after(resetJingmaiDeps);
  setJingmaiDeps({ loadOrg: async () => org.map(row => ({ ...row })),
    client: { login: async () => { throw Object.assign(new Error('need desk'), { code: 'login' }); },
      fetchAccountIdentity: async () => ({ shopId: '2001', shopName: shop }), fetchHome: async () => ({ dealAmount: 100 }) },
    desk: { open: async () => ({ status: 'ok', cookies: jar('fresh'), pageMatch: true }), close: async () => {},
      poll: async () => ({ status: 'opening' }) }
  });
  await beginRelogin(shop, ''); await settle(); await settle();
  assert.equal(humanProtectsShop(shop), false);
  assert.equal((await reloginState(shop)).status, 'ok');
});

test('keeping an old session after rejecting a different identity is not a successful login', async t => {
  await resetJingmaiStore(); t.after(resetJingmaiDeps);
  await saveSession(shop, { cookies: jar('old'), authState: 'ok', shopId: '2001' });
  setJingmaiDeps({ client: { fetchAccountIdentity: async () => ({ shopId: '9999', shopName: '别家店' }) },
    desk: { poll: async () => ({ status: 'ok', cookies: jar('wrong') }), close: async () => {} }
  });
  const state = await reloginState(shop);
  assert.equal(state.status, 'failed');
  const saved = (await listSessions()).find(row => row.store === shop);
  assert.equal(saved.cookies[0].value, 'old');
});

test('an old completion cannot release another shop opened during its metric check', async t => {
  await resetJingmaiStore(); t.after(resetJingmaiDeps);
  let metricsStarted, releaseMetrics;
  const started = new Promise(resolve => { metricsStarted = resolve; });
  const metrics = new Promise(resolve => { releaseMetrics = resolve; });
  setJingmaiDeps({ loadOrg: async () => [...org, { ...org[0], store: '新店', shopId: '2002' }].map(row => ({ ...row })),
    client: { login: async () => { throw Object.assign(new Error('need desk'), { code: 'login' }); },
      fetchAccountIdentity: async () => ({ shopId: '2001', shopName: shop }),
      fetchHome: async () => { metricsStarted(); await metrics; return { dealAmount: 100 }; } },
    desk: { open: async () => ({ status: 'verify' }), close: async () => {},
      poll: async name => name === shop ? { status: 'ok', cookies: jar('fresh'), pageMatch: true } : { status: 'verify' } }
  });
  await beginRelogin(shop, ''); await settle();
  const old = reloginState(shop); await started;
  await beginRelogin('新店', ''); await settle();
  releaseMetrics(); await old;
  assert.equal(humanProtectsShop('新店'), true);
  assert.equal((await reloginState('新店')).status, 'screen');
  await cancelRelogin();
});

for (const terminal of ['ok', 'failed']) {
  test(`the login dialog shows saving until confirmation, then handles ${terminal} without a broken screenshot`, async () => {
    const source = readFileSync(new URL('../public/shared/modules/home.js', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
    const extract = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
    let poll, response, html = '', finished = 0, timersCleared = 0;
    const context = vm.createContext({ state: { desk: { open: true, status: 'screen', store: shop } },
      root: { querySelector: () => { throw new Error('must not reload a closing browser screenshot'); } },
      dead: false, deskTimer: 0, deskSeq: 1,
      window: { setInterval: callback => { poll = callback; return 1; }, clearInterval: () => { timersCleared++; } },
      api: async () => response, escapeHtml: value => String(value),
      paint: (_root, state) => { html = context.liveDeskHtml(state); },
      focusDeskCode: () => assert.fail('saving does not show a code field'),
      touchDeskShot: () => assert.fail('saving does not fetch a screenshot'),
      finishDeskLogin: () => { finished++; }
    });
    vm.runInContext(extract('  function liveDeskHtml(', '  /**\n   * 实时（新版）展示适配') + '\n' +
      extract('      function showDesk(', '      function finishDeskLogin(') + '\n' +
      extract('      function applyDesk(', '      var deskSeq = 0;'), context);
    context.applyDesk({ status: 'finishing', needCode: true, store: shop, message: '登录已确认，正在保存会话并恢复采集' });
    assert.match(html, /正在保存会话/); assert.doesNotMatch(html, /<img/);
    assert.equal(context.state.desk.open, true); assert.equal(finished, 0);
    response = { status: terminal, store: shop, message: terminal === 'failed' ? '身份未通过核验' : '登录成功' };
    poll(); await settle();
    if (terminal === 'ok') { assert.equal(context.state.desk, null); assert.equal(finished, 1); }
    else {
      assert.equal(context.state.desk.status, 'failed'); assert.equal(context.state.desk.open, true);
      assert.match(html, /重试本店/); assert.doesNotMatch(html, /<img/); assert.equal(finished, 0);
    }
    assert.ok(timersCleared > 0);
  });
}
