import test from 'node:test';
import assert from 'node:assert/strict';
import { channelDailySheet, createDailyChannelCollector } from '../src/modules/bound/daily-channel.js';
import { createSavedOverview } from '../src/modules/bound/saved-overview.js';

const date = '2026-11-24';
const channelRows = day => [{ platform: 'all', date: day, gmv: '110.12' }, { platform: 'JD', date: day, gmv: '90.34' }];
const shopRows = day => [{ platform: 'JD', shopId: '123', shopName: '示例店铺', date: day, gmv: '90.34' }];

test('渠道和店铺日报使用原报表数值，可由渠道总览读取', async () => {
  const saved = [];
  const calls = [];
  const collector = createDailyChannelCollector({
    today: () => '2026-11-25',
    readHeads: async query => {
      assert.equal(query.from, '2026-11-19');
      assert.equal(query.to, date);
      assert.equal(query.daily, true);
      return saved;
    },
    request: async (reportId, day) => {
      calls.push([reportId, day]);
      const columnData = reportId === 'qdzl_lb' ? channelRows(day) : shopRows(day);
      return { httpStatus: 200, payload: { code: 0, data: { columnData } } };
    },
    save: async sheet => { saved.push(sheet); }
  });
  assert.equal(await collector.tick(), true);
  assert.deepEqual(calls, [['qdzl_lb', date], ['qdfx_dplb', date]]);
  const overview = createSavedOverview({ readSheets: async () => saved });
  const response = await overview({ from: date, to: date, reports: 'saved_channels,saved_shops' });
  assert.deepEqual(response.records.saved_channels.rows, channelRows(date));
  assert.deepEqual(response.records.saved_shops.rows, shopRows(date));
  calls.length = 0;
  await collector.tick();
  assert.deepEqual(calls, [['qdzl_lb', '2026-11-23'], ['qdfx_dplb', '2026-11-23']]);
});

test('拒绝跑错日期、重复身份和缺失全渠道合计的上游日报', () => {
  const channel = channelRows(date);
  const shops = shopRows(date);
  assert.equal(channelDailySheet('qdzl_lb', date, channel.slice(1)), null);
  assert.equal(channelDailySheet('qdfx_dplb', date, [...shops, ...shops]), null);
  assert.equal(channelDailySheet('qdfx_dplb', date, shopRows('2026-11-23')), null);
  assert.equal(channelDailySheet('qdfx_dplb', date, [{ ...shops[0], gmv: null }]), null);
});

test('旧站未连接时不继续请求或写入报表', async () => {
  let calls = 0;
  const collector = createDailyChannelCollector({
    today: () => '2026-11-25',
    readHeads: async () => [],
    request: async () => { calls++; return { blocked: 'server_login_required' }; },
    save: async () => { assert.fail('no data can be saved'); }
  });
  assert.equal(await collector.tick(), false);
  assert.equal(calls, 1);
});
