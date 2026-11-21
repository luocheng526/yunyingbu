import { SHOP_DAY } from "./shop-day-contract.js";

const safeKey = key => typeof key === "string" && /^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(key) && !["constructor", "prototype", "__proto__"].includes(key);
const day = value => typeof value === "string" ? value.replaceAll("/", "-") : "";
const table = value => value && Array.isArray(value.columnInfo) && Array.isArray(value.columnData);

// BI's key-metric tables use cells, not the ordinary flat goods fields. Preserve
// the raw response and expose each value/comparison without deriving a ratio.
export function metricCells(row) {
  if (!Array.isArray(row?.cells)) return null;
  const values = {};
  for (const cell of row.cells) {
    if (!cell || !safeKey(cell.column) || Object.hasOwn(values, cell.column)) return null;
    values[cell.column] = { value: cell.value ?? null, yoy: cell.yoy ?? null, mom: cell.mom ?? null, lastYearValue: cell.lastYearValue ?? null };
  }
  return values;
}

export function inspectKeyGraph(data, scope = SHOP_DAY) {
  if (!Array.isArray(data) || data.length !== 2 || !data.every(table)) return { status: "schema_unverified" };
  const [cardTable, trendTable] = data;
  if (cardTable.columnData.length !== 1 || !cardTable.columnInfo.length) return { status: "schema_unverified" };
  const columns = cardTable.columnInfo;
  const keys = columns.map(c => c.columnKey);
  if (keys.some(k => !safeKey(k)) || new Set(keys).size !== keys.length) return { status: "schema_unverified" };
  const cards = metricCells(cardTable.columnData[0]);
  if (!cards || keys.some(k => !Object.hasOwn(cards, k))) return { status: "schema_unverified" };
  const trend = [], dates = new Set();
  for (const row of [...cardTable.columnData, ...trendTable.columnData]) {
    if (row.shopId != null && row.shopId !== "" && String(row.shopId) !== scope.shopId || row.platform && ![scope.platform, "all", "All"].includes(row.platform)) return { status: "scope_mismatch" };
  }
  for (const row of trendTable.columnData) {
    const date = day(row.date), cells = metricCells(row);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || date > scope.date || dates.has(date)) return { status: "date_unverified" };
    if (!cells) return { status: "schema_unverified" };
    dates.add(date); trend.push({ date, cells });
  }
  if (!dates.has(scope.date)) return { status: "date_unverified" };
  if (data.some(t => t.progress != null && Number(t.progress) < 100)) return { status: "upstream_pending" };
  return { status: "received", rows: [Object.fromEntries(keys.map(k => [k, cards[k].value]))],
    metricColumns: columns, metricCards: cards, metricTrend: trend, columns: keys.length,
    matchedRows: 1, returnedRows: trend.length, total: null, pageVerified: false };
}

export function inspectPeriodRows(rows, trendDays, scope = SHOP_DAY) {
  if (![7, 15].includes(trendDays)) return { status: "invalid_scope" };
  const end = Date.parse(scope.date + "T00:00:00Z");
  const dates = Array.from({ length: trendDays }, (_, i) => new Date(end - i * 86400000).toISOString().slice(0, 10));
  const periods = [];
  for (const row of rows.filter(r => !r.sumLine)) {
    const list = Array.isArray(row.trendList) ? row.trendList : row.trendList?.columnData;
    if (!Array.isArray(list)) return { status: "schema_unverified" };
    const seen = new Set();
    for (const item of list) {
      if (!item || !dates.includes(day(item.date)) || seen.has(day(item.date))) return { status: "date_unverified" };
      if (item.shopId != null && item.shopId !== "" && String(item.shopId) !== scope.shopId || item.platform && item.platform !== scope.platform || item.goodsId && String(item.goodsId) !== String(row.goodsId) || item.spuid && String(item.spuid) !== String(row.spuid)) return { status: "scope_mismatch" };
      seen.add(day(item.date));
    }
    periods.push({ goodsId: row.goodsId ?? null, spuid: row.spuid ?? null, rows: list, missingDates: dates.filter(d => !seen.has(d)) });
  }
  return { periods, periodDates: dates, periodComplete: periods.every(p => !p.missingDates.length) };
}
