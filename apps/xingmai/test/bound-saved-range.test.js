import test from 'node:test';
import assert from 'node:assert/strict';
import { createSavedData } from '../src/modules/bound/saved-data.js';
import { createSavedOverview } from '../src/modules/bound/saved-overview.js';
import { sumSavedRows } from '../src/modules/bound/saved-rollup.js';

const shop = { platform: 'JD', shopId: '123', shopName: '店一' };
const from = '2026-10-01', to = '2026-10-03';
const sheet = (reportId, date, rows, dim = 'all') => ({ reportId, dim, startOn: date, endOn: date, status: 'done', pageNo: 1, payload: { raw: { data: { columnData: rows } } } });
const row = (date, gmv, extra = {}) => ({ ...shop, date, gmv, refund: gmv / 10, tghf: gmv / 5, profit: gmv / 2, ...extra });
function fixture(sheets, archives = []) {
  const calls = [];
  const readSheets = async q => { calls.push(q); return sheets.filter(s => (!q.reportId || s.reportId === q.reportId) && (!q.reportIds || q.reportIds.includes(s.reportId)) && (!q.dim || s.dim === q.dim) && (!q.startOn || s.startOn === q.startOn) && (!q.endOn || s.endOn === q.endOn) && (!q.from || s.endOn >= q.from) && (!q.to || s.startOn <= q.to)); };
  const reader = scope => ({ getRecord: async input => archives.find(r => r.scope.date === scope.date && r.scope.shopId === scope.shopId && r.reportId === input.reportId && r.page === input.page) || null });
  const saved = createSavedData({ readSheets, readHeads: async () => sheets, readScopes: async () => archives.map(r => r.scope), collector: reader({}), scopedCollector: reader });
  return { saved, calls, overview: createSavedOverview({ readSheets }) };
}

test('四页面的日报按范围汇总，7天、30天、周、月无需重复采集', async () => {
  const data = [sheet('qdfx_dplb', from, [row(from, 100)]), sheet('qdfx_dplb', to, [row(to, 300)]),
    sheet('sp_zl_list', from, [row(from, 20, { goodsId: '90', spuid: '8' })], 'sku'), sheet('sp_zl_list', to, [row(to, 40, { goodsId: '90', spuid: '8' })], 'sku')];
  const { saved } = fixture(data);
  for (const [start, end] of [[from, to], [from, '2026-10-07'], [from, '2026-10-30'], [from, '2026-10-31']]) {
    for (const reportId of ['channel_shop_table', 'channel_operating', 'key_shops', 'shop_goods_page', 'key_goods']) {
      const result = await saved.record({ ...shop, from: start, to: end, reportId, ...(/key_/.test(reportId) ? { columnKey: 'gmv' } : {}) });
      assert.equal(result.ok, true, reportId);
      assert.equal(result.record.rows[0].gmv, /goods/.test(reportId) ? 60 : 400);
      assert.equal(result.record.coverage.availableDays, 2);
      assert.equal(result.record.rows[0].refundRatio, 0.1);
    }
  }
});

test('全部店铺保留平台店铺商品复合身份，不合并同商品ID的不同店铺', async () => {
  const data = [sheet('qdfx_dplb', from, [row(from, 100), row(from, 200, { shopId: '456' })]),
    sheet('sp_zl_list', from, [row(from, 10, { goodsId: '90' }), row(from, 20, { shopId: '456', goodsId: '90' })], 'sku')];
  const { saved } = fixture(data);
  const query = { platform: 'all', shopId: '__all__', from, to: from };
  const shops = (await saved.record({ ...query, reportId: 'channel_shop_table' })).record;
  const goods = (await saved.record({ ...query, reportId: 'key_goods', columnKey: 'gmv' })).record;
  assert.equal(shops.rows.length, 2); assert.equal(goods.rows.length, 2);
  assert.equal((await saved.record({ ...query, reportId: 'channel_operating' })).record.rows[0].gmv, 300);
  assert.equal((await saved.manifest(query)).ok, true);
});

test('日报重复不翻倍，冲突不任选一条，独立整段原值优先', async () => {
  const a = row(from, 100);
  const { saved } = fixture([sheet('qdfx_dplb', from, [a, a]), sheet('qdfx_dplb', to, [row(to, 300), row(to, 301)])]);
  const result = await saved.record({ ...shop, from, to, reportId: 'channel_shop_table' });
  assert.equal(result.record.rows[0].gmv, 100); assert.equal(result.record.source.conflictCount, 1);
  const exact = { ...sheet('qdfx_dplb', from, [row(from + '~' + to, 405)]), endOn: to };
  const second = fixture([sheet('qdfx_dplb', from, [a]), exact]);
  assert.equal((await second.saved.record({ ...shop, from, to, reportId: 'channel_shop_table' })).record.rows[0].gmv, 405);
});

test('补采档案按天替换旧值，商品完整读取后续分页，缺日不补零', async () => {
  const archives = [{ scope: { ...shop, date: from }, reportId: 'channel_shop_table', status: 'received', page: 1, rows: [row(from, 101.25)] },
    ...[1, 2].map(page => ({ scope: { ...shop, date: from }, reportId: 'shop_goods_page', status: 'received', page, pageSize: 1, total: 2, rows: [row(from, page * 10, { goodsId: String(page) })] }))];
  const { saved } = fixture([sheet('qdfx_dplb', from, [row(from, 100)])], archives);
  const result = await saved.record({ ...shop, from, to, reportId: 'channel_shop_table' });
  assert.equal(result.record.rows[0].gmv, 101.25); assert.equal(result.record.coverage.missingDays, 2);
  assert.equal((await saved.record({ ...shop, from, to, reportId: 'shop_goods_page' })).record.rows.length, 2);
});

test('渠道总览按独立渠道日报汇总，不能用不完整店铺表替代渠道金额', async () => {
  const { overview } = fixture([sheet('qdzl_lb', from, [{ platform: 'all', date: from, gmv: 1000 }]), sheet('qdzl_lb', to, [{ platform: 'all', date: to, gmv: 2000 }]), sheet('qdfx_dplb', from, [row(from, 10)]), sheet('qdfx_dplb', to, [row(to, 20)])]);
  const result = await overview({ from, to });
  assert.equal(result.records.saved_channels.rows[0].gmv, 3000);
  assert.equal(result.records.saved_shops.rows[0].gmv, 30);
  assert.equal(result.records.saved_channels.coverage.missingDays, 1);
});

test('未知比例、排名和实时数不累加，缺字段不当零；趋势仅反映实际保存日期', async () => {
  const values = sumSavedRows([{ gmv: 100, refund: 10, tghf: 10, profitRate: .3, ssxse: 99, netGmv: 80 }, { gmv: 300, refund: 60, tghf: 60, profitRate: .5, ssxse: 200 }], () => 'one', from + '~' + to)[0];
  assert.equal(values.gmv, 400); assert.equal(values.refundRatio, .175);
  assert.equal(values.profitRate, undefined); assert.equal(values.ssxse, undefined); assert.equal(values.netGmv, undefined);
  const { saved } = fixture([sheet('qdfx_dplb', from, [row(from, 100)]), sheet('qdfx_dplb', to, [row(to, 300)])]);
  const result = await saved.record({ ...shop, from, to, reportId: 'key_graph' });
  assert.equal(result.record.metricCards.gmv.value, 400);
  assert.deepEqual(result.record.metricTrend.map(r => r.date), [from, '2026-10-02', to]);
  assert.equal(result.record.metricTrend[1].cells.gmv.value, null);
});

test('五项缺失比例按汇总金额重算，净销售额与支付金额分母不可混用', () => {
  const smallProfit = 'gxh_5c0f6bdb52296da6ff08652f4ed898844f30ff09';
  const rows = [
    { gmv: 100, netGmv: 80, netHpCost: 20, profit: 10, [smallProfit]: 12, wfhTkl: .99, lstRefund: [{ code: 'wfhRefund', originCost: '5.25', cost: '5' }, { code: 'fhthRefund', originCost: '90' }] },
    { gmv: 300, netGmv: 150, netHpCost: 30, profit: -5, [smallProfit]: 15, wfhTkl: .99, lstRefund: [{ code: 'wfhRefund', originCost: '30.75' }] }
  ];
  const before = JSON.stringify(rows);
  const sum = sumSavedRows(rows, () => 'shop', from + '~' + to)[0];
  assert.equal(sum.wfhTkl, 36 / 400);
  assert.equal(sum.netHpCostRatio, 50 / 230);
  assert.equal(sum.profitRate, 5 / 230);
  assert.equal(sum.gxh_59276bdb52297387, 5 / 400);
  assert.equal(sum.gxh_5c0f6bdb52297387, 27 / 400);
  assert.equal(JSON.stringify(rows), before);
  assert.equal(sumSavedRows([sum], () => 'shop', to)[0].wfhTkl, sum.wfhTkl);
});

test('旧扁平日报未存退款明细时按GMV加权已存未发货退款率，有明确零时保留零', () => {
  const sum = sumSavedRows([{ gmv: 100, wfhTkl: .1 }, { gmv: 300, wfhTkl: .3 }], () => 'shop', to)[0];
  assert.equal(sum.wfhTkl, .25);
  const zero = sumSavedRows([{ gmv: 100, lstRefund: [{ code: 'fhthRefund', originCost: '20' }], netGmv: 80, netHpCost: 0, profit: 0, gxh_5c0f6bdb52296da6ff08652f4ed898844f30ff09: 0 }], () => 'shop', to)[0];
  for (const key of ['wfhTkl', 'netHpCostRatio', 'profitRate', 'gxh_59276bdb52297387', 'gxh_5c0f6bdb52297387']) assert.equal(zero[key], 0, key);
});

test('零分母、缺失金额和非法值不生成比例，负净销售额保留实际符号', () => {
  const zero = sumSavedRows([{ gmv: 0, netGmv: 0, netHpCost: 0, profit: -9, wfhRefund: 0 }], () => 'shop', to)[0];
  for (const key of ['wfhTkl', 'netHpCostRatio', 'profitRate', 'gxh_59276bdb52297387', 'gxh_5c0f6bdb52297387']) assert.equal(zero[key], undefined);
  const missing = sumSavedRows([{ gmv: 100, netGmv: 100, profit: 10, netHpCost: 20 }, { gmv: 200, netGmv: 200, netHpCost: false, profit: '--' }], () => 'shop', to)[0];
  assert.equal(missing.profitRate, undefined); assert.equal(missing.netHpCostRatio, undefined); assert.equal(missing.wfhTkl, undefined);
  const negative = sumSavedRows([{ gmv: 10, netGmv: -20, profit: -5, netHpCost: -3 }], () => 'shop', to)[0];
  assert.equal(negative.profitRate, .25); assert.equal(negative.gxh_59276bdb52297387, -.5); assert.equal(negative.netHpCostRatio, .15);
});

test('单店、全部店铺及渠道总览使用同一套比例汇总', async () => {
  const extra = { netGmv: 80, netHpCost: 20, profit: 10, gxh_5c0f6bdb52296da6ff08652f4ed898844f30ff09: 12, lstRefund: [{ code: 'wfhRefund', originCost: '5' }] };
  const data = [sheet('qdfx_dplb', from, [row(from, 100, extra)]), sheet('qdfx_dplb', to, [row(to, 100, extra)])];
  const { saved, overview } = fixture(data);
  const expected = [await saved.record({ ...shop, from, to, reportId: 'channel_shop_table' }), await saved.record({ platform: 'all', shopId: '__all__', from, to, reportId: 'channel_shop_table' })].map(r => r.record.rows[0]);
  expected.push((await overview({ from, to })).records.saved_shops.rows[0]);
  for (const sum of expected) {
    assert.equal(sum.wfhTkl, .05); assert.equal(sum.netHpCostRatio, .25); assert.equal(sum.profitRate, .125);
    assert.equal(sum.gxh_59276bdb52297387, .1); assert.equal(sum.gxh_5c0f6bdb52297387, .12);
  }
});
