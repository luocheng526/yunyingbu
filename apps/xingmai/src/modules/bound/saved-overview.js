import { createHash } from "node:crypto";
import { listSheets } from "./persist.js";
import { SHOP_TABLE_COLUMNS } from "./table-columns.js";
import { sumSavedRows, dailyCoverage } from './saved-rollup.js';

export const CHANNEL_TABLE_COLUMNS = [
  ['platform', '渠道'], ['ssxse', '实时销售额(支付)'], ['gmv', '支付金额(支付)'], ['invalidGmv', '无效单金额(标注)'],
  ['netGmv', '净销售额(支付)'], ['sales', '销售件数(支付)'], ['refund', '退款金额'], ['yfhTkl', '已发货退款率(按金额)'],
  ['refundRatio', '退款率(按金额)'], ['netHpCost', '净货品成本(支付)'], ['netHpCostRatio', '净货品成本占比(支付)'],
  ['tghf', '推广花费(支付预估)'], ['tghfXseZb', '推广花费销售额占比(支付预估)'], ['profit', '利润(支付预估)'],
  ['gxh_59276bdb52297387', '大毛利率'], ['gxh_5c0f6bdb52297387', '小毛利率'],
  ['gxh_5c0f6bdb52296da6ff08652f4ed898844f30ff09', '小毛利润(支付预估)'],
  ['saleCost', '销售费用(支付预估)'], ['fhSaleCost', '销售费用(发货预估)'], ['deliverCost', '发货费用(支付)'],
  ['ptCost', '平台花费(支付预估)'], ['profitRate', '利润率(支付预估)'], ['leaders', '负责人']
].map(([columnKey, columnName]) => ({ columnKey, columnName, styleRule: JSON.stringify({ isNumberCell: !['platform', 'leaders'].includes(columnKey), renderAttr: { formatType: /率|占比/.test(columnName) ? 'percent' : 'number' } }) }));

const hash = row => createHash('sha256').update(JSON.stringify(row)).digest('hex');
const day = value => String(value || '').replaceAll('/', '-');
const validDay = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
function unambiguous(rows, identity) {
  const result = new Map(), conflicts = new Set();
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const id = identity(row);
    if (!id) continue;
    if (result.has(id) && hash(result.get(id)) !== hash(row)) conflicts.add(id);
    else result.set(id, row);
  }
  conflicts.forEach(id => result.delete(id));
  return result;
}
// Follow only known table wrappers. Never flatten nested costs, sums or unrelated objects.
export function overviewRows(payload) {
  const rows = [], columns = [], groups = [];
  function visit(value, depth = 0) {
    if (!value || depth > 8) return;
    if (Array.isArray(value)) { value.forEach(v => visit(v, depth + 1)); return; }
    if (typeof value !== 'object') return;
    if (value.tableKey === 'ShopGroupOverViewVo' && Array.isArray(value.shopData) && Array.isArray(value.groupData) && Array.isArray(value.shopGroupInfo)) {
      const shops = unambiguous(value.shopData, r => /^[A-Z]{2,8}$/.test(r.platform || '') && /^\d{1,24}$/.test(String(r.shopId)) && !r.sumLine ? r.platform + ':' + r.shopId : null);
      const metrics = unambiguous(value.groupData, r => r.groupId != null ? String(r.groupId) : null);
      const definitions = unambiguous(value.shopGroupInfo, r => r.id != null ? String(r.id) : null);
      for (const info of definitions.values()) {
        const metric = metrics.get(String(info.id));
        if (!metric || metric.gmv == null || !info.name || !Array.isArray(info.shopList)) continue;
        groups.push({ ...metric, sumLine: false, groupId: String(info.id), shopName: String(info.name), groupName: String(info.name), platform: 'all',
          shopList: [...new Set(info.shopList.filter(s => s && typeof s === 'object').map(s => (s.channel || s.platform) + ':' + s.shopId))].map(id => shops.get(id)).filter(Boolean) });
      }
    }
    if (value.gmv != null && (value.platform != null || value.shopId != null || value.groupId != null)) { rows.push(value); return; }
    if (Array.isArray(value.columnInfo)) columns.push(...value.columnInfo.filter(c => c && typeof c.columnKey === 'string' && typeof c.columnName === 'string'));
    for (const key of ['raw', 'data', 'rows', 'list', 'records', 'columnData', 'extensibleTableWrapper']) visit(value[key], depth + 1);
  }
  visit(payload);
  return { rows, columns, groups };
}
export function createSavedOverview({ readSheets = listSheets, readScopes = async () => [], readArchived = async () => null, includePeriod = true } = {}) {
  return async function read(query = {}) {
    const from = String(query.from || ''), to = String(query.to || from);
    if (!validDay(from) || !validDay(to) || from < '2026-09-01' || to < from || Date.parse(to) - Date.parse(from) > 366 * 86400000) return { ok: false, statusCode: 400, reason: 'invalid_range' };
    const scope = { from, to, date: to, platform: 'all', shopId: '', shopName: '全部已存店铺' };
    const raw = await readSheets({ reportIds: ['qdzl_lb', 'qdfx_dplb', 'qdzl_fz', 'qdzl_jy', 'qdzl_pl', 'qdzl_rx'], startOn: from, endOn: to, dim: 'all' });
    const sheets = raw.filter(s => s.status === 'done' && s.startOn === from && s.endOn === to && s.dim === 'all' && s.pageNo > 0);
    function report(sourceId, reportId, kind, defaultColumns) {
      const selected = sheets.filter(s => s.reportId === sourceId).sort((a, b) => a.pageNo - b.pageNo);
      const rows = new Map(), conflicting = new Set(), metadata = [];
      for (const sheet of selected) {
        const found = overviewRows(sheet.payload); metadata.push(...found.columns);
        for (const row of kind === 'group' ? found.groups : found.rows) {
          if (!['group', 'category', 'goods'].includes(kind) || row.date != null) { if (day(row.date) !== (from === to ? to : from + '~' + to)) continue; }
          if (kind === 'shop' && (!/^\d{1,24}$/.test(String(row.shopId)) || !/^[A-Z]{2,8}$/.test(row.platform || '') || row.sumLine)) continue;
          if (kind === 'channel' && (!['all', 'All', 'JD', 'TM', 'TMALL', 'DY', 'DOUYIN'].includes(row.platform) || row.shopId)) continue;
          if (kind === 'group' && (!row.groupId || !row.groupName)) continue;
          if (kind === 'goods' && (row.sumLine || !/^\d{1,30}$/.test(String(row.goodsId)) || !/^\d{1,24}$/.test(String(row.shopId)) || !/^[A-Z]{2,8}$/.test(row.platform || ''))) continue;
          if (kind === 'category' && (row.sumLine || row.cateId == null || !row.cateName)) continue;
          if (kind === 'operating' && (row.shopId || String(row.platform).toLowerCase() !== 'all' || row.sumLine)) continue;
          const id = kind === 'shop' ? row.platform + ':' + row.shopId : kind === 'group' ? String(row.groupId) : kind === 'goods' ? [row.platform, row.shopId, row.goodsId].join(':') : kind === 'category' ? [row.platform, row.cateId].join(':') : String(row.platform).toLowerCase() === 'all' ? 'all' : row.platform;
          if (rows.has(id) && hash(rows.get(id)) !== hash(row)) conflicting.add(id);
          else rows.set(id, row);
        }
      }
      conflicting.forEach(id => rows.delete(id));
      const result = [...rows.values()].map(row => kind === 'group' ? { ...row, shopList: row.shopList.filter(shop => shop.date == null || day(shop.date) === (from === to ? to : from + '~' + to)) } : row);
      const uniqueColumns = metadata.filter((c, i) => metadata.findIndex(o => o.columnKey === c.columnKey) === i);
      const columnInfo = defaultColumns || (kind === 'group' ? [{columnKey:'shopName',columnName:'店铺分组'}, ...uniqueColumns.filter(c => c.columnKey !== 'shopName')] : uniqueColumns);
      const responseData = { columnInfo, columnData: result };
      if (kind === 'operating') {
        const daily = unambiguous(selected.flatMap(s => overviewRows(s.payload).rows).filter(r => !r.shopId && !r.sumLine && String(r.platform).toLowerCase() === 'all' && validDay(day(r.date)) && day(r.date) >= '2026-09-01' && day(r.date) <= to), r => day(r.date));
        responseData.history = { columnInfo, columnData: [...daily.values()] };
      }
      return { reportId, page: 1, scope, rows: result, status: result.length ? 'received' : 'not_saved',
        source: { kind: 'legacy_database', reportId: sourceId, updatedAt: selected.map(s => s.updatedAt || '').sort().at(-1) || null, conflictCount: conflicting.size, note: '历史采集值；旧站后续重算可能变化' },
        response: { payload: { data: kind === 'operating' ? [responseData, responseData.history] : responseData } } };
    }
    const periodStart = new Date(Math.max(Date.parse('2026-09-01'), Date.parse(to) - 14 * 86400000)).toISOString().slice(0, 10);
    const dailySheets = includePeriod && from === to ? await readSheets({ reportId: 'qdfx_dplb', dim: 'all', from: periodStart, to }) : [];
    const periodRows = unambiguous(dailySheets.filter(s => s.status === 'done' && s.dim === 'all' && s.pageNo > 0 && s.startOn === s.endOn && validDay(s.startOn) && s.startOn >= periodStart && s.endOn <= to).flatMap(s => overviewRows(s.payload).rows.filter(r => day(r.date) === s.startOn && !r.sumLine && /^[A-Z]{2,8}$/.test(r.platform || '') && /^\d{1,24}$/.test(String(r.shopId)))), r => [r.platform, r.shopId, day(r.date)].join(':'));
    const shopReport = report('qdfx_dplb', 'saved_shops', 'shop', SHOP_TABLE_COLUMNS);
    const combined = new Map(shopReport.rows.map(row => [row.platform + ':' + row.shopId, row]));
    let archiveCount = 0;
    if (from === to) for (const item of (await readScopes()).filter(s => s.date === to)) {
      const archived = await readArchived(item, { reportId: 'channel_shop_table' });
      if (archived?.status !== 'received') continue;
      for (const row of archived.rows.filter(r => !r.sumLine && r.platform === item.platform && String(r.shopId) === item.shopId)) {
        combined.set(item.platform + ':' + item.shopId, row); archiveCount++;
      }
    }
    if (archiveCount) {
      shopReport.rows = [...combined.values()]; shopReport.status = 'received';
      shopReport.source = { ...shopReport.source, kind: 'saved_data', archivedShops: archiveCount, note: '已完成补采的店铺使用新档案，其余保留历史采集；渠道合计仍取独立汇总接口原值' };
      shopReport.response.payload.data.columnData = shopReport.rows;
    }
    const result = { ok: true, scope, records: {
      saved_channels: report('qdzl_lb', 'saved_channels', 'channel', CHANNEL_TABLE_COLUMNS),
      saved_shops: shopReport,
      saved_groups: report('qdzl_fz', 'saved_groups', 'group'),
      saved_operating: report('qdzl_jy', 'saved_operating', 'operating'),
      saved_category: report('qdzl_pl', 'saved_category', 'category'),
      saved_hotgoods: report('qdzl_rx', 'saved_hotgoods', 'goods'),
      saved_shop_period: { reportId: 'saved_shop_period', scope, page: 1, status: periodRows.size ? 'received' : 'not_saved', rows: [...periodRows.values()], source: { kind: 'legacy_database', reportId: 'qdfx_dplb', note: '已保存店铺日报；缺失日留空' } }
    } };
    if (from !== to) {
      const dailySheets = (await readSheets({ reportIds: ['qdzl_lb', 'qdfx_dplb', 'qdzl_fz', 'qdzl_jy', 'qdzl_pl', 'qdzl_rx'], from, to, dim: 'all' })).filter(s => s.startOn === s.endOn && s.startOn >= from && s.endOn <= to);
      const scopes = (await readScopes()).filter(s => s.date >= from && s.date <= to);
      const dates = [...new Set([...dailySheets.map(s => s.startOn), ...scopes.map(s => s.date)])].sort();
      const collected = [];
      for (const date of dates) {
        const daily = createSavedOverview({ readSheets: async () => dailySheets.filter(s => s.startOn === date), readScopes: async () => scopes.filter(s => s.date === date), readArchived, includePeriod: false });
        collected.push(await daily({ from: date, to: date }));
      }
      for (const [id, report] of Object.entries(result.records)) {
        if (report.status === 'received') continue; // Exact source totals retain priority.
        const parts = collected.map(r => r.records[id]).filter(r => r.rows.length);
        const dailyRows = parts.flatMap(r => r.rows.map(row => ({ ...row, date: r.scope.date })));
        if (!dailyRows.length) continue;
        const identity = row => id === 'saved_groups' ? row.groupId : id === 'saved_category' ? [row.platform, row.cateId].join(':') : id === 'saved_hotgoods' ? [row.platform, row.shopId, row.goodsId].join(':') : id === 'saved_shops' ? [row.platform, row.shopId].join(':') : String(row.platform).toLowerCase();
        const rows = sumSavedRows(dailyRows, identity, from + '~' + to);
        if (id === 'saved_groups') for (const row of rows) row.shopList = sumSavedRows(dailyRows.filter(r => r.groupId === row.groupId).flatMap(r => r.shopList || []), r => r.platform + ':' + r.shopId, from + '~' + to);
        const coverage = dailyCoverage(dailyRows, from, to);
        Object.assign(report, { rows, status: 'received', coverage, source: { kind: 'saved_daily_rollup', note: `按已保存日报汇总，覆盖 ${coverage.availableDays}/${coverage.expectedDays} 天；缺失日期不计为零` } });
        const firstData = parts[0].response?.payload?.data;
        const columnInfo = (Array.isArray(firstData) ? firstData[0] : firstData)?.columnInfo || [];
        const table = { columnInfo, columnData: rows };
        report.response = { payload: { data: id === 'saved_operating' ? [table, { columnInfo, columnData: dailyRows }] : table } };
      }
    }
    return result;
  };
}
