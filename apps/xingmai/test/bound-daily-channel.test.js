import test from 'node:test';
import assert from 'node:assert/strict';
import { DAILY_REPORTS, collectDailySheet, createDailyReportCollector } from '../src/modules/bound/daily-channel.js';
import { createSavedOverview } from '../src/modules/bound/saved-overview.js';
import { listSheets, resetBoundStore, writeSheet, writeVerifiedDailySheets } from '../src/modules/bound/persist.js';
import { reports } from '../src/modules/bound/catalog.js';
import { setPoolForTests } from '../src/modules/profile/auth.js';

const date = '2026-11-24';
const channelRows = day => [{ platform: 'all', date: day, gmv: '110.12' }, { platform: 'JD', date: day, gmv: '90.34' }];
const shopRows = day => [{ platform: 'JD', shopId: '123', shopName: '示例店铺', date: day, gmv: '90.34' }];
const selection = DAILY_REPORTS.slice(0, 2);
const response = (rows, total, pageSize) => ({ httpStatus: 200, payload: { code: 0, data: { columnData: rows } },
  list: { rows, total, totalKnown: total != null }, pageSize });

test('历史日报计划只使用目录已有的报表和维度', () => {
  const catalog = new Map(reports().map(report => [report.id, report]));
  assert.equal(new Set(DAILY_REPORTS.map(report => report.reportId + ':' + report.dim)).size, 29);
  assert.ok(DAILY_REPORTS.every(report => catalog.get(report.reportId)?.dims.includes(report.dim)));
  assert.equal(DAILY_REPORTS.filter(report => report.snapshot).length, 3);
});

test('渠道和店铺日报保留原值，完成后接着补缺失日期', async () => {
  const saved = [];
  const calls = [];
  const collector = createDailyReportCollector({
    selection,
    today: () => '2026-11-25',
    readHeads: async query => {
      assert.equal(query.from, '2026-11-19');
      assert.equal(query.daily, true);
      return saved;
    },
    request: async ({ reportId }, day) => {
      calls.push([reportId, day]);
      return response(reportId === 'qdzl_lb' ? channelRows(day) : shopRows(day));
    },
    save: async sheets => { saved.push(...sheets); }
  });
  assert.equal(await collector.tick(), true);
  assert.deepEqual(calls, [['qdzl_lb', date], ['qdfx_dplb', date]]);
  const overview = createSavedOverview({ readSheets: async () => saved });
  const result = await overview({ from: date, to: date, reports: 'saved_channels,saved_shops' });
  assert.deepEqual(result.records.saved_channels.rows, channelRows(date));
  assert.deepEqual(result.records.saved_shops.rows, shopRows(date));
  assert.deepEqual((await collector.status()).days[0], { date, required: 2, verified: 2, pending: [] });
  calls.length = 0;
  await collector.tick();
  assert.deepEqual(calls, [['qdzl_lb', '2026-11-23'], ['qdfx_dplb', '2026-11-23']]);
});

test('声明有多页时逐页核对，漏页、重复行或总数变化都不产生档案', async () => {
  const first = shopRows(date);
  const second = [{ ...first[0], shopId: '456' }];
  const report = selection[1];
  const complete = await collectDailySheet(async (_report, _day, page) => response(page === 1 ? first : second, 2, 1), report, date);
  assert.deepEqual(complete.sheets[0].payload.rows, [...first, ...second]);
  assert.equal(complete.sheets[0].errorText, 'daily-verified');
  for (const [page2, reason] of [
    [response([], 2, 1), 'pagination_incomplete'],
    [response(first, 2, 1), 'pagination_identity_mismatch'],
    [response(second, 3, 1), 'pagination_total_changed']
  ]) {
    const result = await collectDailySheet(async (_report, _day, page) => page === 1 ? response(first, 2, 1) : page2, report, date);
    assert.deepEqual(result, { reason });
  }
});

test('上游明确返回空列表会保存，错日期和渠道合计缺失不会保存', async () => {
  const dated = await collectDailySheet(async () => response(shopRows('2026-11-23')), selection[1], date);
  assert.deepEqual(dated, { reason: 'report_date_mismatch' });
  const noTotal = await collectDailySheet(async () => response(channelRows(date).slice(1)), selection[0], date);
  assert.deepEqual(noTotal, { reason: 'invalid_channel_rows' });
  const { sheets } = await collectDailySheet(async () => response([], 0, 50), { reportId: 'qdzl_rx', dim: 'all' }, date);
  const overview = createSavedOverview({ readSheets: async () => sheets });
  assert.equal((await overview({ from: date, reports: 'saved_hotgoods' })).records.saved_hotgoods.status, 'empty');
});

test('足页标记过的档案不与同一日期的旧分页混读', async () => {
  resetBoundStore();
  const rows = Array.from({ length: 101 }, (_, index) => ({ ...shopRows(date)[0], shopId: String(index + 1) }));
  const { sheets } = await collectDailySheet(async () => response(rows), selection[1], date);
  await writeSheet({ ...sheets[0], pageNo: 3, errorText: '', payload: { rows: [{ platform: 'JD', shopId: 'old' }] } });
  await writeVerifiedDailySheets(sheets);
  const saved = await listSheets({ reportId: sheets[0].reportId, startOn: date, endOn: date, dim: 'all' });
  assert.equal(saved.length, 2);
  assert.deepEqual(saved.flatMap(sheet => sheet.payload.rows), rows);
});

test('在线会话失效后保留待采清单，无法回溯的快照只取实际当天', async () => {
  const calls = [];
  const collector = createDailyReportCollector({
    selection: [selection[0], { reportId: 'qdzl_yj', dim: 'all', snapshot: true }],
    today: () => '2026-11-25',
    readHeads: async () => [],
    request: async (report, day) => { calls.push([report.reportId, day]); return { blocked: 'server_login_required' }; },
    save: async () => { assert.fail('no data can be saved'); }
  });
  assert.equal(await collector.tick(), false);
  assert.deepEqual(calls, [['qdzl_lb', date]]);
  const status = await collector.status();
  assert.equal(status.blockedReason, 'server_login_required');
  assert.equal(status.days[0].verified, 0);
  assert.deepEqual(status.days[0].pending.map(report => report.reportId), ['qdzl_lb']);
  assert.equal(status.snapshots.date, '2026-11-25');
  assert.deepEqual(status.snapshots.pending.map(report => report.reportId), ['qdzl_yj']);
});

test('卡住的读取和归档会超时，后续日报仍可核验', async t => {
  const keepAlive = setInterval(() => {}, 1000);
  t.after(() => clearInterval(keepAlive));
  const saved = [], signals = [];
  const breakdown = { reportId: 'qdzl_pl', dim: 'all' };
  const collector = createDailyReportCollector({
    selection: [...selection, breakdown],
    today: () => '2026-11-25',
    requestTimeoutMs: 20,
    storageTimeoutMs: 20,
    readHeads: async () => saved,
    request: async ({ reportId }, day, _page, _size, signal) => {
      if (reportId === 'qdzl_lb') {
        signals.push(signal);
        return new Promise(() => {});
      }
      return response(shopRows(day));
    },
    save: async (sheets, signal) => {
      if (sheets[0].reportId === 'qdfx_dplb') {
        signals.push(signal);
        return new Promise(() => {});
      }
      saved.push(...sheets);
    }
  });
  assert.equal(await collector.tick(), true);
  const status = await collector.status();
  assert.equal(status.running, false);
  assert.equal(status.current, null);
  assert.deepEqual(status.days[0].pending.map(x => x.failure?.reason), ['timeout', 'archive_timeout']);
  assert.equal(status.days[0].verified, 1);
  assert.ok(signals.every(signal => signal.aborted));
});

test('更早日期的首次补采优先于已进入重试的最新日期', async () => {
  const calls = [];
  let time = 0;
  const collector = createDailyReportCollector({
    selection: [selection[0]],
    today: () => '2026-11-21',
    now: () => time,
    readHeads: async () => [],
    request: async (_report, day) => {
      calls.push(day);
      return { httpStatus: 200, payload: { code: 500 } };
    }
  });
  await collector.tick();
  time += 16 * 60000;
  await collector.tick();
  time += 16 * 60000;
  await collector.tick();
  assert.deepEqual(calls, ['2026-11-20', '2026-11-19', '2026-11-20', '2026-11-19']);
});

test('旧站限流期间暂停新请求，恢复后重新处理原任务', async () => {
  let time = 0, calls = 0;
  const collector = createDailyReportCollector({
    selection: [selection[0]],
    today: () => '2026-11-20',
    now: () => time,
    readHeads: async () => [],
    request: async (_report, day) => {
      return ++calls === 1 ? { blocked: 'upstream_cooldown', retryAfterMs: 300000 } : response(channelRows(day));
    },
    save: async () => {}
  });
  assert.equal(await collector.tick(), false);
  assert.equal((await collector.status()).blockedReason, 'upstream_cooldown');
  assert.equal(await collector.tick(), false);
  assert.equal(calls, 1);
  time = 300000;
  assert.equal(await collector.tick(), true);
  assert.equal(calls, 2);
});

test('归档超时时丢弃活动连接，已取消的排队写入释放晚到的连接', async t => {
  t.after(() => { setPoolForTests(null); resetBoundStore(); });
  resetBoundStore();
  const calls = [];
  const acquired = Promise.withResolvers();
  const entered = Promise.withResolvers();
  const connection = {
    beginTransaction: async () => { calls.push('begin'); },
    execute: async () => { calls.push('write'); entered.resolve(); return new Promise(() => {}); },
    commit: async () => { calls.push('commit'); },
    rollback: async () => { calls.push('rollback'); },
    destroy: () => { calls.push('destroy'); },
    release: () => { calls.push('release'); }
  };
  let count = 0;
  setPoolForTests({ query: async () => [], getConnection: () => ++count === 1 ? Promise.resolve(connection) : acquired.promise });
  const first = new AbortController();
  const active = writeVerifiedDailySheets([{ ...selection[0], startOn: date, endOn: date }], first.signal);
  await entered.promise;
  first.abort();
  await assert.rejects(active, { name: 'AbortError' });
  const second = new AbortController();
  const queued = writeVerifiedDailySheets([{ ...selection[0], startOn: date, endOn: date }], second.signal);
  await new Promise(resolve => setImmediate(resolve));
  second.abort();
  await assert.rejects(queued, { name: 'AbortError' });
  acquired.resolve(connection);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, ['begin', 'write', 'destroy', 'release']);
});
