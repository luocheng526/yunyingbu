import assert from "node:assert/strict";
import test from "node:test";
import { createSavedData, legacyRows, savedScope } from "../src/modules/bound/saved-data.js";
import { SHOP_DAY } from "../src/modules/bound/shop-day-contract.js";
import { SHOP_TABLE_COLUMNS } from "../src/modules/bound/table-columns.js";

const date = "2026-11-18";
const scope = { ...SHOP_DAY, date, from: date, to: date };
const row = (extra = {}) => ({ shopId: SHOP_DAY.shopId, shopName: SHOP_DAY.shopName, platform: "JD", date, gmv: "23181", netGmv: "20760", tghf: "9607", profit: "6395", ...extra });
const sheet = (reportId, rows, extra = {}) => ({ reportId, dim: "all", startOn: date, endOn: date, pageNo: 1, status: "done", payload: { raw: { data: { columnInfo: [], columnData: rows } } }, ...extra });

test('旧库店铺表保留旧站完整表头，未保存的字段留空而不是补零', async () => {
  const { saved } = setup([sheet('qdfx_dplb', [row({ invalidGmv: '51', wyj: '0' })])]);
  const result = await saved.record({ ...scope, reportId: 'channel_shop_table' });
  assert.deepEqual(result.record.response.payload.data.columnInfo, SHOP_TABLE_COLUMNS);
  assert.equal(result.record.rows[0].invalidGmv, '51');
  assert.equal(result.record.rows[0].wyj, '0');
  assert.equal(result.record.rows[0].leaders, undefined);
});
function setup(sheets, verified = null) {
  const queries = [];
  const saved = createSavedData({
    collector: { getRecord: async () => verified, status: async () => ({ ok: true, scope: SHOP_DAY, directory: "/private/archive", reports: [] }) },
    readHeads: async () => sheets,
    readSheets: async filter => {
      queries.push(filter);
      return sheets.filter(s => (!filter.reportId || s.reportId === filter.reportId) && (!filter.reportIds || filter.reportIds.includes(s.reportId)) && (!filter.dim || s.dim === filter.dim)
        && (!filter.startOn || s.startOn === filter.startOn) && (!filter.endOn || s.endOn === filter.endOn) && (!filter.from || s.endOn >= filter.from) && (!filter.to || s.startOn <= filter.to));
    }
  });
  return { saved, queries };
}

test("旧库的同平台同店同日行直接适配新页，不能把嵌套对象或跨年汇总串入", async () => {
  const payload = sheet("qdfx_dplb", [row(), row({ shopId: "2", gmv: "777" }), row({ platform: "TM", gmv: "888" }), row({ date: "2026-01", gmv: "999" }), row({ date: undefined }), row({ sumLine: true })]);
  payload.payload.raw.secretWrapper = { date, shopId: SHOP_DAY.shopId, gmv: "666" };
  const before = JSON.stringify(payload);
  const { saved } = setup([payload]);
  const result = await saved.record({ ...scope, reportId: "channel_operating" });
  assert.equal(result.ok, true); assert.equal(result.record.rows.length, 1);
  assert.equal(result.record.rows[0].gmv, "23181"); assert.equal(result.record.rows[0].tghf, "9607");
  assert.equal(result.record.source.kind, "legacy_database");
  assert.equal(JSON.stringify(payload), before);
  assert.equal(legacyRows({ raw: { total: { shopId: SHOP_DAY.shopId, gmv: "666" } } }).length, 0);
});

test("已核验档案优先，不被旧库取整值覆盖；固定档案不暴露服务器路径", async () => {
  const verified = { reportId: "channel_operating", scope: SHOP_DAY, status: "received", rows: [row({ date: SHOP_DAY.date, tghf: 9606.63 })] };
  const { saved, queries } = setup([sheet("qdfx_dplb", [row({ date: SHOP_DAY.date })], { startOn: SHOP_DAY.date, endOn: SHOP_DAY.date })], verified);
  assert.equal((await saved.record({ ...SHOP_DAY, reportId: "channel_operating" })).record, verified);
  assert.equal(queries.length, 0);
  assert.equal(Object.hasOwn(await saved.manifest(SHOP_DAY), "directory"), false);
});

test("店铺选择涵盖九月以来已保存店铺，新旧数据只有同一个清单", async () => {
  const older = "2026-09-01";
  const { saved } = setup([sheet("qdfx_dplb", [row()]), sheet("qdfx_dplb", [row({ shopId: "123", shopName: "曾经采集的店", date: older })], { startOn: older, endOn: older }), sheet("qdfx_dplb", [row({ shopId: "999", date: "2026-08-31" })], { startOn: "2026-08-31", endOn: "2026-08-31" })]);
  const options = await saved.options();
  assert.equal(options.shops.some(s => s.shopId === "123"), true);
  assert.equal(options.shops.some(s => s.shopId === "999"), false);
  assert.equal(options.dates.includes("2026-08-31"), false);
  const manifest = await saved.manifest({ ...scope, shopId: "123", from: older, to: older });
  assert.equal(manifest.scope.shopName, "曾经采集的店");
  assert.equal(manifest.collectionScope.shopId, SHOP_DAY.shopId);
});

test("旧商品列表去重但不冒充全量；缺商品身份及重复SPU不伪造合计", async () => {
  const goods = row({ goodsId: "123", goodsName: "旧商品", spuid: "66", gmv: "10" });
  const { saved } = setup([sheet("sp_zl_list", [goods, goods, row()], { dim: "sku" }), sheet("sp_zl_list", [goods, { ...goods, goodsId: "124", gmv: "20" }], { dim: "spu" })]);
  const sku = await saved.record({ ...scope, reportId: "shop_goods_page" });
  assert.equal(sku.record.rows.length, 1); assert.equal(sku.record.completeness, "partial");
  assert.equal((await saved.record({ ...scope, reportId: "shop_goods_total" })).statusCode, 404);
  assert.equal((await saved.record({ ...scope, reportId: "shop_spu_page" })).statusCode, 404);
  assert.equal((await saved.record({ ...scope, reportId: "shop_goods_page", cardId: "fake" })).statusCode, 404);
});

test("关键指标趋势保留缺日，不从其他店铺或日期填值，也不伪造同比环比", async () => {
  const { saved } = setup([sheet("qdfx_dplb", [row()]), sheet("qdfx_dplb", [row({ shopId: "2", date: "2026-11-17" })], { startOn: "2026-11-17", endOn: "2026-11-17" })]);
  const result = await saved.record({ ...scope, reportId: "key_graph" });
  assert.equal(result.record.metricCards.gmv.value, "23181");
  assert.equal(result.record.metricCards.gmv.mom, null);
  assert.equal(result.record.metricTrend.find(r => r.date === "2026-11-17").cells.gmv.value, null);
  assert.equal((await saved.record({ ...scope, reportId: "key_shops", columnKey: "unknown" })).statusCode, 404);
});

test("商品周期复用已保存日报，九月以前与混入店铺均不读取，缺失日保持空", async () => {
  const day1 = "2026-09-02", day0 = "2026-09-01";
  const goods = row({ goodsId: "123", spuid: "66", date: day1, gmv: "10" });
  const { saved, queries } = setup([sheet("sp_zl_list", [goods], { dim: "sku", startOn: day1, endOn: day1 }), sheet("sp_zl_list", [{ ...goods, shopId: "999", date: day0, gmv: "999" }], { dim: "sku", startOn: day0, endOn: day0 })]);
  const result = await saved.record({ ...SHOP_DAY, date: day1, reportId: "shop_goods_period", trendDays: 7 });
  assert.equal(result.record.periods[0].rows.length, 1);
  assert.equal(result.record.periods[0].rows[0].gmv, "10");
  assert.equal(queries.some(q => q.from === "2026-09-01"), true);
  assert.equal(queries.some(q => q.from && q.from < "2026-09-01"), false);
});

test("范围和报告选择器严格校验，不扩大采集权限或匹配缺少身份的记录", async () => {
  const { saved } = setup([]);
  for (const query of [{ date: "2026-08-31" }, { date: "2026-09-31" }, { shopId: "../" }, { platform: "JD OR 1=1" }]) assert.equal(savedScope(query), null);
  assert.equal((await saved.record({ ...scope, reportId: "key_shops", columnKey: "__proto__" })).statusCode, 400);
  assert.equal((await saved.record({ ...scope, reportId: "channel_operating" })).statusCode, 404);
  assert.equal((await saved.manifest({ ...scope, shopId: "999" })).statusCode, 400);
});
