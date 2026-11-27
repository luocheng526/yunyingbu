import test from 'node:test';
import assert from 'node:assert/strict';
import { DAILY_REPORTS, collectDailySheet, createDailyReportCollector } from '../src/modules/bound/daily-channel.js';
import { createSavedOverview } from '../src/modules/bound/saved-overview.js';
import { listSheets, resetBoundStore, writeSheet, writeVerifiedDailySheets } from '../src/modules/bound/persist.js';
import { reports } from '../src/modules/bound/catalog.js';

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
