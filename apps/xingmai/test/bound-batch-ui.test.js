import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { URLSearchParams } from 'node:url';
import { publicCatalog } from '../src/modules/bound/catalog.js';

const source = await readFile(new URL('../public/shared/modules/bound.js', import.meta.url), 'utf8');
const shop = { platform: 'JD', shopId: '123', shopName: '测试店铺' };
const firstRun = { id: 'one', from: '2026-11-24', to: '2026-11-26', status: 'running', done: 5, total: 129,
  failed: 1, shops: [shop], current: { ...shop, date: '2026-11-24' },
  errors: [{ scope: { ...shop, date: '2026-11-25' }, failures: [{ reason: 'pagination_incomplete' }] }] };
const reply = (body, ok = true) => ({ ok, json: async () => body });

async function harness(initialRun) {
  let run = initialRun, poll, finish, coverage;
  const calls = [];
  const root = { innerHTML: '', querySelector: () => null,
    addEventListener(type, fn) { this[type] = fn; }, removeEventListener() {} };
  const context = vm.createContext({
    window: { location: { search: '?probeDate=2026-10-03' } }, URLSearchParams, Intl, Date,
    document: { getElementById: () => null, createElement: () => ({}), head: { appendChild() {} } },
    setInterval: fn => { poll = fn; return 1; }, clearInterval() {},
    fetch: async (url, options = {}) => {
      calls.push({ url, options });
      if (url === '/api/bound') return reply({ ok: true });
      if (url === '/api/bound/catalog') return reply(publicCatalog());
      if (url === '/api/bound/link') return reply({ phase: 'logged_in', batchLoginReady: true, collection: {}, message: '请点击“开始 / 继续本轮采集”' });
      if (url === '/api/bound/shop-day/goods-backfill') return run === undefined ? reply({}, false) : reply({ ok: true, run });
      if (url === '/api/bound/shop-day/daily-reports') return coverage ? reply(coverage) : reply({}, false);
      if (/\/goods-backfill\/(start|stop)$/.test(url)) return new Promise(resolve => { finish = resolve; });
      return reply({}, false);
    }
  });
  vm.runInContext(source, context);
  const stop = context.window.XmModules['/bound'].mount(root);
  await delay(20);
  return { root, calls, stop, setRun(value) { run = value; }, setCoverage(value) { coverage = value; }, finish: response => finish(response),
    async refresh() { poll(); poll(); await delay(20); },
    click: act => root.click({ target: { closest: selector => selector === '[data-act]' ? { getAttribute: key => key === 'data-act' ? act : null } : null } }) };
}

test('采集页显示规则和最新自动任务，旧面板和接口不再由页面调用', async () => {
  const h = await harness({ ...firstRun, automatic: true });
  try {
    assert.match(h.root.innerHTML, /商品采集规则与进度/);
    assert.match(h.root.innerHTML, /43 家指定京东店铺.*11 月 19 日.*补到昨天/);
    assert.match(h.root.innerHTML, /业务日期后第二天零点.*停机漏掉的回查/);
    assert.match(h.root.innerHTML, /SKU、SPU.*全部核验通过/);
    assert.match(h.root.innerHTML, /自动采集 · 采集中.*已核验 5\/129/);
    assert.match(h.root.innerHTML, /当前店铺：测试店铺 · 2026-11-24/);
    assert.match(h.root.innerHTML, /商品分页尚未收齐/);
    assert.doesNotMatch(h.root.innerHTML, /2026-10-03|多店四页采集|单店试采|继续本轮采集|data-act="goods-backfill-/);
    const before = h.calls.length;
    h.root.focusin({ target: { closest: () => ({}) } });
    h.setRun({ ...firstRun, automatic: true, done: 13 });
    await h.refresh();
    assert.deepEqual(h.calls.slice(before).map(call => call.url).sort(), ['/api/bound/shop-day/daily-reports', '/api/bound/shop-day/goods-backfill']);
    // The real DOM is patched in place when the login fields are focused.
    h.root.focusout({ relatedTarget: null });
    h.setRun({ ...firstRun, automatic: true, done: 14 });
    await h.refresh();
    assert.match(h.root.innerHTML, /已核验 14\/129/);
    assert.ok(h.calls.every(call => !/\/shop-day\/(batch|run)|\/collect\/probe|\/api\/bound\/progress/.test(call.url)));
  } finally { h.stop(); }
});

test('日报和商品都核齐时才标记当天已采齐', async () => {
  const h = await harness(null);
  try {
    const day = { date: '2026-11-26', verified: 24, required: 26, goods: { verified: 43, required: 43 }, complete: false };
    h.setCoverage({ ok: true, days: [day] });
    await h.refresh();
    assert.match(h.root.innerHTML, /2026-11-26 · 日报已核验 24\/26 项 · 商品已核验 43\/43 家 · 待补齐/);
    assert.doesNotMatch(h.root.innerHTML, /已采齐/);
    h.setCoverage({ ok: true, days: [{ ...day, verified: 26, complete: true }] });
    await h.refresh();
    assert.match(h.root.innerHTML, /2026-11-26 · 日报已核验 26\/26 项 · 商品已核验 43\/43 家 · 已采齐/);
  } finally { h.stop(); }
});

test('没有任务或进度暂时不可用时规则依然可读', async () => {
  const h = await harness(null);
  try {
    assert.match(h.root.innerHTML, /暂无商品采集任务记录/);
    h.setRun(undefined);
    await h.refresh();
    assert.match(h.root.innerHTML, /暂时读不到采集进度/);
    assert.match(h.root.innerHTML, /商品采集规则与进度/);
  } finally { h.stop(); }
});

test('正在运行的手动商品补采可以暂停和继续，重复点击不会重发', async () => {
  const h = await harness({ ...firstRun, automatic: false });
  const posts = () => h.calls.filter(call => call.options.method === 'POST');
  try {
    assert.match(h.root.innerHTML, /手动补采 · 采集中/);
    h.click('goods-backfill-stop'); h.click('goods-backfill-stop');
    assert.equal(posts().length, 1);
    assert.equal(posts()[0].url, '/api/bound/shop-day/goods-backfill/stop');
    h.setRun({ ...firstRun, automatic: false, status: 'paused' });
    h.finish(reply({ ok: true, stopping: true })); await delay(20);
    assert.match(h.root.innerHTML, /手动补采 · 已暂停/);
    h.click('goods-backfill-resume');
    assert.equal(posts()[1].url, '/api/bound/shop-day/goods-backfill/start');
    assert.deepEqual(JSON.parse(posts()[1].options.body), { from: firstRun.from, to: firstRun.to, shopKeys: ['JD:123'] });
    h.finish(reply({ ok: false, reason: 'server_login_required' }, false)); await delay(20);
    assert.match(h.root.innerHTML, /补采操作未完成：请先连接旧站/);
  } finally { h.stop(); }
});
