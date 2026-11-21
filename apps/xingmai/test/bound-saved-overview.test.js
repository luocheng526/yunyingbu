import test from 'node:test';
import assert from 'node:assert/strict';
import { createSavedOverview, overviewRows, CHANNEL_TABLE_COLUMNS } from '../src/modules/bound/saved-overview.js';
const date = '2026-10-03';
const sheet = (reportId, rows, extra = {}) => ({ reportId, dim: 'all', status: 'done', startOn: date, endOn: date, pageNo: 1, updatedAt: '2026-11-20', payload: { raw: { data: { columnData: rows } } }, ...extra });

test('历史总览保留原渠道合计，店铺明细不混入汇总或其它日期，不改变历史值', async () => {
  const channel = { platform: 'all', date, gmv: '840561', profit: '131090', lstCost: [{ gmv: '999999' }] };
  const sheets = [
    sheet('qdzl_lb', [channel, { platform: 'JD', date, gmv: '829241' }, { platform: 'TM', date: '2026-01', gmv: '1' }]),
    sheet('qdfx_dplb', [{ platform: 'JD', shopId: '16501691', shopName: 'RASW', date, gmv: '23181' },
      { platform: 'JD', shopId: '2', shopName: '店2', date, gmv: '200' },
      { platform: 'JD', shopId: '3', date: '2026-01', gmv: '9999' }, { platform: 'JD', shopId: '2', date, sumLine: true, gmv: '9999' }])
  ];
  const before = JSON.stringify(sheets), requests = [];
  const read = createSavedOverview({ readSheets: async q => { requests.push(q); return sheets; } });
  const result = await read({ from: date, to: date });
  assert.equal(result.records.saved_channels.rows[0].gmv, '840561');
  assert.equal(result.records.saved_channels.rows[0].profit, '131090');
  assert.equal(result.records.saved_channels.rows.length, 2);
  assert.equal(result.records.saved_shops.rows.length, 2);
  assert.deepEqual(result.records.saved_channels.response.payload.data.columnInfo, CHANNEL_TABLE_COLUMNS);
  assert.equal(result.records.saved_groups.status, 'not_saved');
  assert.equal(JSON.stringify(sheets), before);
  assert.deepEqual(requests[0], { reportIds: ['qdzl_lb', 'qdfx_dplb', 'qdzl_fz', 'qdzl_jy', 'qdzl_pl', 'qdzl_rx'], startOn: date, endOn: date, dim: 'all' });
});
test('冲突重复不任选一条，九月以前及无日期的分组包装不冒充数据', async () => {
  let calls = 0;
  const read = createSavedOverview({ readSheets: async () => { calls++; return [
    sheet('qdzl_lb', [{ platform: 'JD', date, gmv: '1' }, { platform: 'JD', date, gmv: '2' }]),
    sheet('qdzl_fz', [{ tableKey: 'ShopGroupOverViewVo', groupId: '1', gmv: '99' }])
  ]; } });
  assert.equal((await read({ from: '2026-08-31' })).statusCode, 400);
  assert.equal(calls, 0);
  const result = await read({ from: date });
  assert.equal(result.records.saved_channels.source.conflictCount, 1);
  assert.deepEqual(result.records.saved_channels.rows, []);
  assert.deepEqual(result.records.saved_groups.rows, []);
  assert.deepEqual(overviewRows({ data: { costDetail: { platform: 'JD', date, gmv: '666' } } }).rows, []);
});

test('店铺分组按groupData和shopGroupInfo匹配，展开shopData，重叠成员不重算金额',async()=>{
  const s=sheet('qdzl_fz',[]);s.payload.raw.data={tableKey:'ShopGroupOverViewVo',columnInfo:[{columnKey:'gmv',columnName:'支付金额(支付)'}],
    groupData:[{groupId:'1',gmv:'100'},{groupId:'2',gmv:'100'}],shopData:[{platform:'JD',shopId:'11',shopName:'店A',gmv:'100'}],
    shopGroupInfo:[{id:1,name:'组A',shopList:[{channel:'JD',shopId:'11'}]},{id:2,name:'组B',shopList:[{channel:'JD',shopId:'11'}]}]};
  const result=await createSavedOverview({readSheets:async()=>[s]})({from:date});
  assert.equal(result.records.saved_groups.rows.length,2);
  assert.equal(result.records.saved_groups.rows[0].shopList[0].shopId,'11');
  assert.equal(result.records.saved_groups.rows[0].gmv,'100');
  assert.equal(result.records.saved_groups.response.payload.data.columnInfo[0].columnName,'店铺分组');
});


test('分组的冲突指标、冲突店铺和重复成员不被悄悄覆盖，明确异日成员不展示',async()=>{
  const s=sheet('qdzl_fz',[]);s.payload.raw.data={tableKey:'ShopGroupOverViewVo',columnInfo:[],
    groupData:[{groupId:'1',gmv:'100'},{groupId:'2',gmv:'200'},{groupId:'2',gmv:'201'}],
    shopData:[{platform:'JD',shopId:'11',gmv:'100'},{platform:'JD',shopId:'11',gmv:'101'},
      {platform:'JD',shopId:'12',gmv:'20',date:'2026-10-04'},{platform:'JD',shopId:'13',gmv:'30',date}],
    shopGroupInfo:[{id:1,name:'组A',shopList:[{channel:'JD',shopId:'11'},{channel:'JD',shopId:'12'},{channel:'JD',shopId:'13'},{channel:'JD',shopId:'13'}]},
      {id:2,name:'组B',shopList:[]}]};
  const result=await createSavedOverview({readSheets:async()=>[s,{...s,pageNo:2}]})({from:date});
  assert.equal(result.records.saved_groups.rows.length,1);
  assert.deepEqual(result.records.saved_groups.rows[0].shopList.map(r=>r.shopId),['13']);
  assert.equal(result.records.saved_groups.rows[0].gmv,'100');
});


test('全账号经营趋势只读原始日报，热销榜不混入汇总、异日或无店铺记录',async()=>{
  const cols=[{columnKey:'date',columnName:'日期'},{columnKey:'gmv',columnName:'支付金额(支付)'}];
  const anchor={platform:'All',date,gmv:'840561'};
  const operating=sheet('qdzl_jy',[]);operating.payload={raw:{data:[{columnInfo:cols,columnData:[anchor]},
    {columnInfo:cols,columnData:[anchor,{platform:'All',date:'2026-10-02',gmv:'700000'},
      {platform:'All',date:'2026-08-31',gmv:'999999'},{platform:'JD',shopId:'11',date,gmv:'999'}]}]}};
  const hot=sheet('qdzl_rx',[{platform:'JD',shopId:'11',goodsId:'101',gmv:'30'},
    {platform:'JD',shopId:'11',goodsId:'102',date:'2026-10-04',gmv:'40'},
    {platform:'JD',shopId:'11',goodsId:'103',sumLine:true,gmv:'50'},
    {platform:'JD',goodsId:'104',gmv:'60'}]);
  const result=await createSavedOverview({readSheets:async()=>[operating,hot]})({from:date});
  assert.equal(result.records.saved_operating.rows[0].gmv,'840561');
  assert.deepEqual(result.records.saved_operating.response.payload.data[1].columnData.map(r=>r.date),[date,'2026-10-02']);
  assert.deepEqual(result.records.saved_hotgoods.rows.map(r=>r.goodsId),['101']);
  assert.equal(result.records.saved_category.status,'not_saved');
});
