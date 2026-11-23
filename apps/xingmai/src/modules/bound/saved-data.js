import { createHash } from "node:crypto";
import { SHOP_DAY, DAY_REPORTS } from "./shop-day-contract.js";
import { START_ON } from "./catalog.js";
import { listSheetHeads, listSheets } from "./persist.js";
import { SHOP_TABLE_COLUMNS } from "./table-columns.js";
import { sumSavedRows, reportIdentity, dailyCoverage } from './saved-rollup.js';

const good = r => r && ["received", "empty"].includes(r.status);
const day = value => String(value || "").replaceAll("/", "-");
const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const metricNames = { gmv: "支付金额(支付)", netGmv: "净销售额(支付)", tghf: "推广花费(支付预估)", profit: "利润(支付预估)", refund: "退款金额", thtkje: "退款金额", netHpCost: "净货品成本(支付)", jhpcb: "净货品成本(支付)", ptCost: "平台花费(支付预估)", deliverCost: "发货费用(支付)", zdyFyAll: "自定义费用", sales: "销售件数(支付)" };
const names = { ...metricNames, shopName: "店铺", goodsName: "商品", goodsId: "商品 ID", spuid: "SPU ID", date: "日期", province: "省份", city: "城市", hour: "时段", cateName: "品类", onSaleTime: "上架时间", refundRatio: "退款率(按金额)", netHpCostRatio: "净货品成本占比(支付)", tghfXseZb: "推广花费销售额占比(支付预估)", profitRate: "利润率(支付预估)", catePathName: "品类", otherCost: "其他费用(支付)", invalidGmv: "无效单金额(支付)" };
const mappings = {
  channel_operating: ["qdfx_dplb"], channel_shop_table: ["qdfx_dplb"], key_shops: ["qd_gjzbfx_dpck", "qdfx_dplb"],
  shop_goods_page: ["sp_zl_list"], shop_spu_page: ["sp_zl_list"], key_goods: ["qd_gjzbfx_ljck", "sp_zl_list"],
  channel_goods: ["qdfx_rx", "qdzl_rx"], channel_category: ["qdfx_pl"], channel_labels: ["qdfx_bqfx"],
  channel_area: ["qdfx_area"], channel_hour: ["qdfx_hour"]
};
const sourceIds = [...new Set(Object.values(mappings).flat())];

export function savedScope(query = {}) {
  const all = query.shopId === '__all__' && query.platform === 'all';
  const platform = all ? 'all' : String(query.platform || SHOP_DAY.platform);
  const shopId = all ? '__all__' : String(query.shopId || SHOP_DAY.shopId);
  const from = String(query.from || query.date || SHOP_DAY.date), to = String(query.to || query.date || from);
  const validDay = d => /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(Date.parse(d)) && new Date(d).toISOString().slice(0, 10) === d;
  if ((!all && (!/^[A-Z]{2,8}$/.test(platform) || !/^\d{1,24}$/.test(shopId))) || !validDay(from) || !validDay(to) || from < START_ON || to < from || Date.parse(to) - Date.parse(from) > 366 * 86400000) return null;
  return { platform, shopId, date: to, from, to, shopName: all ? '全部已存店铺' : shopId === SHOP_DAY.shopId && platform === SHOP_DAY.platform ? SHOP_DAY.shopName : shopId };
}

// The old collector stored both flat rows and untouched table wrappers. Walk
// only data containers, never recursively merge scalar values from other rows.
export function legacyRows(payload) {
  const result = [];
  function visit(value, depth = 0) {
    if (!value || depth > 8) return;
    if (Array.isArray(value)) { for (const item of value) visit(item, depth + 1); return; }
    if (typeof value !== "object") return;
    if (value.shopId != null && (value.gmv != null || value.goodsId != null || Array.isArray(value.cells))) { result.push(value); return; }
    for (const key of ["raw", "rows", "list", "records", "data", "columnData", "growAnalysis", "extensibleTableWrapper"]) {
      if (value[key] && typeof value[key] === "object") visit(value[key], depth + 1);
    }
  }
  visit(payload);
  return result;
}

function matches(row, scope, sheet) {
  if (String(row.shopId) !== scope.shopId || row.platform !== scope.platform || row.sumLine === true) return false;
  const date = day(row.date);
  // Missing shop/date identity in old records is not evidence of a match.
  return scope.from === scope.to ? date === scope.date : sheet.startOn === scope.from && sheet.endOn === scope.to && date === `${scope.from}~${scope.to}`;
}

function columns(rows, keys) {
  return (keys || Object.keys(names).filter(key => rows.some(row => row[key] != null))).map(columnKey => ({ columnKey, columnName: names[columnKey] || columnKey }));
}

export function createSavedData({ collector, readSheets = listSheets, readHeads = listSheetHeads, readRun = async () => null, scopedCollector = () => null, readScopes = async () => [] }) {
  let optionsCache;
  const cache = new Map();
  const rollups = new Map();
  async function options() {
    if (optionsCache && Date.now() - optionsCache.at < 30000) return optionsCache.value;
    const heads = await readHeads();
    const dates = [...new Set(heads.filter(r => r.status === "done" && r.startOn === r.endOn && r.startOn >= START_ON && r.reportId === "qdfx_dplb").map(r => r.startOn))].sort();
    const latest = dates.at(-1);
    const sheets = latest ? await readSheets({ reportId: "qdfx_dplb", from: START_ON, to: latest }) : [];
    const shops = new Map([[`${SHOP_DAY.platform}:${SHOP_DAY.shopId}`, { platform: SHOP_DAY.platform, shopId: SHOP_DAY.shopId, shopName: SHOP_DAY.shopName }]]);
    for (const sheet of sheets.filter(s => s.status === "done" && s.startOn >= START_ON && s.startOn === s.endOn).sort((a, b) => a.startOn.localeCompare(b.startOn))) for (const row of legacyRows(sheet.payload)) {
      if (!/^\d{1,24}$/.test(String(row.shopId)) || !/^[A-Z]{2,8}$/.test(row.platform || "") || day(row.date) !== sheet.startOn || !row.shopName || row.sumLine) continue;
      shops.set(`${row.platform}:${row.shopId}`, { platform: row.platform, shopId: String(row.shopId), shopName: String(row.shopName) });
    }
    const archivedScopes = await readScopes();
    for (const scope of archivedScopes) shops.set(scope.platform + ":" + scope.shopId, { platform: scope.platform, shopId: scope.shopId, shopName: scope.shopName });
    const value = { ok: true, shops: [...shops.values()], dates: [...new Set([...dates, SHOP_DAY.date, ...archivedScopes.map(s => s.date)])].sort(), startOn: START_ON, defaultScope: SHOP_DAY };
    optionsCache = { at: Date.now(), value }; return value;
  }
  async function bundle(scope) {
    const key = JSON.stringify([scope.from, scope.to]);
    const old = cache.get(key);
    if (old && Date.now() - old.at < 15000) return old.value;
    const sheets = await readSheets({ reportIds: sourceIds, from: scope.from, to: scope.to });
    const value = sheets.filter(s => s.status === "done" && s.pageNo > 0);
    cache.set(key, { at: Date.now(), value }); if (cache.size > 2) cache.delete(cache.keys().next().value);
    return value;
  }
  async function baseRecord(scope, input) {
    const mapping = mappings[input.reportId];
    if (!mapping || input.page && Number(input.page) !== 1 || ["cardId", "goodsId", "categoryPath", "planId", "promoteKey", "trendDays"].some(k => input[k] != null)) return null;
    const sheets = await bundle(scope);
    for (const sourceId of mapping) {
      const dim = sourceId === "sp_zl_list" ? input.reportId === "shop_spu_page" ? "spu" : "sku" : "all";
      const found = sheets.filter(s => s.reportId === sourceId && s.dim === dim && s.startOn === scope.from && s.endOn === scope.to).sort((a, b) => a.pageNo - b.pageNo);
      const rows = [], seen = new Set();
      for (const sheet of found) for (const original of legacyRows(sheet.payload)) {
        if (!matches(original, scope, sheet)) continue;
        const row = { ...original };
        if (Array.isArray(row.cells)) for (const cell of row.cells) if (/^[A-Za-z][A-Za-z0-9_]*$/.test(cell.column) && !["constructor", "prototype"].includes(cell.column)) row[cell.column] = cell.value;
        const identity = input.reportId === "shop_spu_page" ? row.spuid : ["shop_goods_page", "key_goods", "channel_goods"].includes(input.reportId) ? row.goodsId : row.shopId;
        const key = hash(row);
        if (seen.has(key)) continue;
        if (identity == null) continue;
        seen.add(key); rows.push(row);
      }
      if (!rows.length) continue;
      const shopLevel = ["channel_operating", "channel_shop_table", "key_shops"].includes(input.reportId);
      if (shopLevel && rows.length !== 1) continue;
      if (["shop_goods_page", "key_goods", "channel_goods"].includes(input.reportId) && new Set(rows.map(r => String(r.goodsId))).size !== rows.length) continue;
      if (input.columnKey && !rows.some(row => Object.hasOwn(row, input.columnKey) && row[input.columnKey] != null && typeof row[input.columnKey] !== "object")) continue;
      if (input.reportId === "shop_spu_page" && (rows.some(r => !r.spuid || r.spuid === "--") || new Set(rows.map(r => String(r.spuid))).size !== rows.length)) continue;
      const knownComplete = shopLevel;
      const metadata = input.reportId === "channel_shop_table" ? SHOP_TABLE_COLUMNS : columns(rows, ["key_shops", "key_goods"].includes(input.reportId) && input.columnKey ? [input.reportId === "key_shops" ? "shopName" : "goodsName", input.columnKey] : undefined);
      return { reportId: input.reportId, scope, page: 1, status: "received", rows, dataHash: hash(rows),
        total: rows.length, matchedRows: rows.length, completeness: knownComplete ? "scoped_row" : "partial", ...(input.columnKey ? { columnKey: input.columnKey } : {}),
        source: { kind: "legacy_database", reportId: sourceId, dim, pages: found.map(s => s.pageNo), note: knownComplete ? "已按店铺、平台、日期匹配旧库原始记录" : "旧库已保存的明细，尚不能确认是否包含全部记录" },
        response: { payload: { data: { columnInfo: metadata, columnData: rows } } } };
    }
    return null;
  }
  async function rollup(scope, input) {
    if (!mappings[input.reportId] || input.page !== 1 || ['cardId', 'goodsId', 'categoryPath', 'planId', 'promoteKey', 'trendDays'].some(k => input[k] != null)) return null;
    const cacheKey = JSON.stringify([scope, input]);
    const prior = rollups.get(cacheKey);
    if (prior && Date.now() - prior.at < 15000) return prior.value;
    const work = (async () => {
      const all = scope.shopId === '__all__', entries = new Map(), conflicts = new Set(), metadata = [];
      const sheets = await bundle(scope);
      const identity = row => reportIdentity(input.reportId, row);
      // Lower-priority legacy reports are read first. A report never contributes
      // twice to the same shop/entity/day; contradictory duplicates are omitted.
      for (const sourceId of [...mappings[input.reportId]].reverse()) {
        const sourceRows = new Map(), bad = new Set();
        const dim = sourceId === 'sp_zl_list' ? input.reportId === 'shop_spu_page' ? 'spu' : 'sku' : 'all';
        for (const sheet of sheets.filter(s => s.reportId === sourceId && s.dim === dim && s.startOn === s.endOn && s.startOn >= scope.from && s.endOn <= scope.to)) {
          for (const original of legacyRows(sheet.payload)) {
            if (original.sumLine || !/^\d{1,24}$/.test(String(original.shopId)) || !/^[A-Z]{2,8}$/.test(original.platform || '') || day(original.date) !== sheet.startOn || !all && (String(original.shopId) !== scope.shopId || original.platform !== scope.platform)) continue;
            const row = { ...original, date: sheet.startOn };
            for (const cell of Array.isArray(row.cells) ? row.cells : []) if (/^[A-Za-z][A-Za-z0-9_]*$/.test(cell.column) && !['constructor', 'prototype'].includes(cell.column)) row[cell.column] = cell.value;
            delete row.cells;
            const id = identity(row); if (id == null) continue;
            const key = `${sheet.startOn}:${id}`;
            if (sourceRows.has(key) && hash(sourceRows.get(key)) !== hash(row)) bad.add(key);
            else sourceRows.set(key, row);
          }
        }
        for (const [key, row] of sourceRows) { if (bad.has(key)) { conflicts.add(key); entries.delete(key); } else { entries.set(key, row); conflicts.delete(key); } }
      }
      const scopes = new Map([SHOP_DAY, ...await readScopes()].filter(s => s.date >= scope.from && s.date <= scope.to && (all || s.platform === scope.platform && s.shopId === scope.shopId)).map(s => [[s.platform, s.shopId, s.date].join(':'), s]));
      for (const item of scopes.values()) {
        const reader = item.platform === SHOP_DAY.platform && item.shopId === SHOP_DAY.shopId && item.date === SHOP_DAY.date ? collector : scopedCollector(item);
        if (!reader) continue;
        const first = await reader.getRecord({ ...input, page: 1 });
        if (!good(first)) continue;
        const archivedRows = [...first.rows];
        const paged = DAY_REPORTS.find(r => r.id === input.reportId)?.paged;
        const pageSize = first.pageSize || 100;
        const count = paged && Number.isFinite(Number(first.total)) ? Math.ceil(Number(first.total) / pageSize) : 1;
        for (let page = 2; page <= Math.min(count, 200); page++) {
          const next = await reader.getRecord({ ...input, page });
          if (!good(next)) break;
          archivedRows.push(...next.rows);
        }
        // A verified empty archive supersedes older rows for this shop/day too.
        for (const [key, row] of entries) if (row.date === item.date && row.platform === item.platform && String(row.shopId) === item.shopId) entries.delete(key);
        const table = first.response?.payload?.data;
        metadata.push(...(Array.isArray(table) ? table[0]?.columnInfo || [] : table?.columnInfo || []));
        for (const original of archivedRows) {
          if (original.sumLine || original.date && day(original.date) !== item.date) continue;
          const row = { ...original, platform: item.platform, shopId: item.shopId, shopName: item.shopName, date: item.date };
          for (const cell of Array.isArray(row.cells) ? row.cells : []) if (/^[A-Za-z][A-Za-z0-9_]*$/.test(cell.column) && !['constructor', 'prototype'].includes(cell.column)) row[cell.column] = cell.value;
          delete row.cells;
          const id = identity(row); if (id != null) entries.set(`${item.date}:${id}`, row);
        }
      }
      const daily = [...entries.values()]; if (!daily.length) return null;
      const label = scope.from === scope.to ? scope.to : scope.from + '~' + scope.to;
      let rows = scope.from === scope.to ? daily : sumSavedRows(daily, identity, label);
      if (input.reportId === 'channel_operating' && all) rows = sumSavedRows(daily, () => 'all', label).map(r => ({ ...r, platform: 'all', shopId: '__all__', shopName: scope.shopName }));
      const coverage = dailyCoverage(daily, scope.from, scope.to);
      const partial = !['channel_operating', 'channel_shop_table', 'key_shops'].includes(input.reportId);
      const columnInfo = input.reportId === 'channel_shop_table' ? SHOP_TABLE_COLUMNS : metadata.length ? metadata.filter((c, i) => metadata.findIndex(v => v.columnKey === c.columnKey) === i) : columns(rows);
      const dates = [...new Set(daily.map(row => row.date))];
      const history = { columnInfo, columnData: sumSavedRows(daily, r => r.date, '').map((r, i) => ({ ...r, date: dates[i], ...(all ? { platform: 'all', shopId: '__all__' } : {}) })) };
      const table = { columnInfo, columnData: rows };
      return { reportId: input.reportId, scope, page: 1, status: 'received', rows, total: rows.length, matchedRows: rows.length,
        ...(input.columnKey ? { columnKey: input.columnKey } : {}), completeness: partial ? 'partial' : 'saved_days', coverage,
        source: { kind: 'saved_daily_rollup', conflictCount: conflicts.size, note: `按已保存日报汇总，覆盖 ${coverage.availableDays}/${coverage.expectedDays} 天；缺失日期不计为零，未保存或无法重算的比例留空` },
        response: { payload: { data: input.reportId === 'channel_operating' ? [table, history] : table } } };
    })();
    rollups.set(cacheKey, { at: Date.now(), value: work });
    if (rollups.size > 48) rollups.delete(rollups.keys().next().value);
    try { return await work; } catch (error) { rollups.delete(cacheKey); throw error; }
  }
  async function period(scope, input) {
    if (scope.from !== scope.to || ![7, 15].includes(input.trendDays) || input.page !== 1 || ["cardId", "goodsId", "columnKey", "categoryPath", "planId", "promoteKey"].some(k => input[k] != null)) return null;
    const spu = input.reportId === "shop_spu_period", key = spu ? "spuid" : "goodsId";
    const base = await baseRecord(scope, { reportId: spu ? "shop_spu_page" : "shop_goods_page", page: 1 });
    if (!base) return null;
    const start = new Date(Math.max(Date.parse(START_ON), Date.parse(scope.date) - (input.trendDays - 1) * 86400000)).toISOString().slice(0, 10);
    const sheets = await readSheets({ reportId: "sp_zl_list", dim: spu ? "spu" : "sku", from: start, to: scope.date });
    const days = new Map();
    for (const sheet of sheets.filter(s => s.status === "done" && s.startOn === s.endOn && s.startOn >= start && s.endOn <= scope.date)) {
      for (const row of legacyRows(sheet.payload)) {
        if (!row[key] || !matches(row, { ...scope, date: sheet.startOn, from: sheet.startOn, to: sheet.startOn }, sheet)) continue;
        const id = `${row[key]}:${sheet.startOn}`, previous = days.get(id);
        // Conflicting duplicates (including SKU rows masquerading as SPUs) are not a daily SPU aggregate.
        days.set(id, previous === undefined || previous && hash(previous) === hash(row) ? row : null);
      }
    }
    const periods = base.rows.map(row => ({ [key]: String(row[key]), rows: [...days.entries()].filter(([id, value]) => id.startsWith(`${row[key]}:`) && value).map(([, value]) => value) }));
    return { ...base, reportId: input.reportId, trendDays: input.trendDays, periods, source: { ...base.source, note: "按已保存的同店同商品日报展示周期；缺失日期留空" } };
  }
  async function graph(scope) {
    if (scope.from !== scope.to || scope.shopId === '__all__') {
      const current = await rollup(scope, { reportId: 'channel_operating', page: 1 });
      if (!current) return null;
      const row = current.rows[0], keys = Object.keys(metricNames).filter(k => row[k] != null);
      const cells = r => Object.fromEntries(keys.map(k => [k, { value: r?.[k] ?? null, yoy: null, mom: null, lastYearValue: null }]));
      const history = new Map(current.response.payload.data[1].columnData.map(r => [r.date, r]));
      const metricTrend = [];
      for (let date = scope.from; date <= scope.to; date = new Date(Date.parse(date) + 86400000).toISOString().slice(0, 10)) metricTrend.push({ date, cells: cells(history.get(date)) });
      return { ...current, reportId: 'key_graph', metricColumns: columns([row], keys), metricCards: cells(row), metricTrend };
    }
    const current = await baseRecord(scope, { reportId: "key_shops" });
    if (!current) return null;
    const row = current.rows[0];
    const keys = Object.keys(metricNames).filter(k => row[k] != null && Number.isFinite(Number(row[k])));
    if (!keys.length) return null;
    const start = new Date(Math.max(Date.parse(START_ON), Date.parse(scope.date) - 30 * 86400000)).toISOString().slice(0, 10);
    const sheets = await readSheets({ reportIds: ["qdfx_dplb"], from: start, to: scope.date });
    const daily = new Map();
    for (const sheet of sheets.filter(s => s.status === "done" && s.startOn === s.endOn)) {
      const matchesForDay = legacyRows(sheet.payload).filter(r => matches(r, { ...scope, date: sheet.startOn, from: sheet.startOn, to: sheet.startOn }, sheet));
      if (matchesForDay.length === 1) daily.set(sheet.startOn, matchesForDay[0]);
    }
    const cells = r => Object.fromEntries(keys.map(k => [k, { value: r?.[k] ?? null, yoy: null, mom: null, lastYearValue: null }]));
    const metricTrend = [];
    for (let date = start; date <= scope.date; date = new Date(Date.parse(date) + 86400000).toISOString().slice(0, 10)) metricTrend.push({ date, cells: cells(daily.get(date)) });
    return { ...current, reportId: "key_graph", metricCards: cells(row), metricColumns: columns([row], keys), metricTrend,
      source: { ...current.source, note: "使用已保存的店铺日报；缺失日期及未保存的同比、环比留空" } };
  }
  async function record(query = {}) {
    const scope = savedScope(query); if (!scope) return { ok: false, statusCode: 400, reason: "invalid_scope" };
    const input = { reportId: query.reportId, page: Number(query.page || 1) };
    for (const k of ["goodsId", "cardId", "categoryPath", "planId", "promoteKey", "columnKey"]) if (query[k] != null) input[k] = String(query[k]);
    if (query.trendDays != null) input.trendDays = Number(query.trendDays);
    if (!DAY_REPORTS.some(r => r.id === input.reportId) || !Number.isSafeInteger(input.page) || input.page < 1 || input.columnKey && (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(input.columnKey) || ["constructor", "prototype"].includes(input.columnKey))) return { ok: false, statusCode: 400, reason: "invalid_report" };
    const fixed = scope.platform === SHOP_DAY.platform && scope.shopId === SHOP_DAY.shopId && scope.from === SHOP_DAY.date && scope.to === SHOP_DAY.date;
    const archiveCollector = scope.from === scope.to && scope.shopId !== '__all__' ? fixed ? collector : scopedCollector(scope) : null;
    if (archiveCollector) {
      const existing = await archiveCollector.getRecord(input);
      if (good(existing)) return { ok: true, record: existing };
    }
    let found = /^(shop_goods|shop_spu)_period$/.test(input.reportId) ? await period(scope, input) : input.reportId === "key_graph" && input.page === 1 ? await graph(scope) : scope.shopId === '__all__' ? null : await baseRecord(scope, input);
    if (!found && (scope.from !== scope.to || scope.shopId === '__all__')) found = await rollup(scope, input);
    return found ? { ok: true, record: found } : { ok: false, statusCode: 404, reason: "not_saved" };
  }
  async function manifest(query = {}) {
    const scope = savedScope(query); if (!scope) return { ok: false, statusCode: 400, reason: "invalid_scope" };
    const available = await options();
    const shop = scope.shopId === '__all__' ? scope : available.shops.find(s => s.shopId === scope.shopId && s.platform === scope.platform);
    if (!shop) return { ok: false, statusCode: 400, reason: "unknown_shop" };
    scope.shopName = shop.shopName;
    const fixed = scope.platform === SHOP_DAY.platform && scope.shopId === SHOP_DAY.shopId && scope.from === SHOP_DAY.date && scope.to === SHOP_DAY.date;
    if (fixed) {
      const status = await collector.status(); delete status.directory;
      return { ...status, runtime: "server", unified: true, scope, collectionScope: SHOP_DAY, fourPageRun: await readRun() };
    }
    const archiveCollector = scope.from === scope.to && scope.shopId !== '__all__' ? scopedCollector(scope) : null;
    const archived = archiveCollector ? await archiveCollector.status() : null;
    const reports = [];
    for (const report of DAY_REPORTS.filter(r => !r.manual)) {
      const prior = archived?.reports.find(r => r.id === report.id);
      if (prior?.pages.length) { reports.push(prior); continue; }
      const result = await record({ ...scope, reportId: report.id });
      const r = result.record;
      reports.push({ id: report.id, label: report.label, product: !!report.product, status: r?.status || "not_collected", pages: r ? [{ page: 1, status: r.status, matchedRows: r.rows.length, completeness: r.completeness }] : [] });
    }
    const goods = (await baseRecord(scope, { reportId: "shop_goods_page" }))?.rows || [];
    return { ok: true, runtime: "server", unified: true, scope, collectionScope: SHOP_DAY, selected: null, reports,
      inventory: archived?.inventory.complete ? archived.inventory : { complete: false, items: goods.map(r => ({ goodsId: String(r.goodsId), spuid: String(r.spuid || ""), goodsName: r.goodsName || "", gmv: r.gmv })) }, exclusions: [], run: null };
  }
  return { options, manifest, record };
}
