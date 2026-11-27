import { DAILY_VERIFIED, listSheetHeads, writeVerifiedDailySheets } from './persist.js';
import { overviewRows } from './saved-overview.js';
import { addDays, shanghaiToday } from './time.js';

export const FIRST_DAILY_REPORT_DATE = '2026-11-19';
export const DAILY_REPORTS = Object.freeze([
  ...[
    'qdzl_lb', 'qdfx_dplb', 'qdzl_fz', 'qdzl_jy', 'qdzl_pl', 'qdzl_rx', 'qdzl_bqfx', 'qdzl_zbdrfx',
    'qdfx_jy', 'qdfx_llly', 'qdfx_zbdr', 'qdfx_pl', 'qdfx_bqfx', 'qdfx_rx', 'qdfx_area', 'qdfx_hour',
    'qd_gjzbfx_dpck', 'qd_gjzbfx_qdck', 'spyy_ll', 'spyy_bt', 'spyy_sku', 'spyy_zbdr'
  ].map(reportId => ({ reportId, dim: 'all' })),
  ...['sp_zl_list', 'sp_zl_trend'].flatMap(reportId => ['sku', 'spu'].map(dim => ({ reportId, dim }))),
  ...['qdzl_yj', 'qdfx_yj', 'spqj_kc'].map(reportId => ({ reportId, dim: 'all', snapshot: true }))
]);

const retryDelay = 15 * 60000;
const channelNames = new Set(['all', 'All', 'JD', 'TM', 'TMALL', 'DY', 'DOUYIN']);
const accounts = new Set(['qdzl_lb', 'qdfx_dplb']);
const objectReports = new Set(['qdzl_fz', 'qdzl_jy', 'qdfx_jy']);
const stoppages = new Set(['collector_busy', 'login_busy', 'server_login_required', 'session_changed', 'identity_changed', 'login_conflict', 'login_expired']);
const keyOf = (date, report) => date + ':' + report.reportId + ':' + report.dim;
const dateOf = value => String(value || '').replaceAll('/', '-');
const summaryRow = row => row && (row.sumLine === true || row.sumLine === 1);

function checkChannelRows(reportId, date, raw) {
  const { rows } = overviewRows(raw);
  const shops = reportId === 'qdfx_dplb';
  const keys = new Set();
  for (const row of rows) {
    if (shops && summaryRow(row)) continue;
    if (dateOf(row.date) !== date || row.gmv === '' || !Number.isFinite(Number(row.gmv))) return false;
    const key = shops && /^[A-Z]{2,8}$/.test(row.platform) && /^\d{1,24}$/.test(String(row.shopId)) && row.shopName
      ? row.platform + ':' + row.shopId : !shops && channelNames.has(row.platform) && !row.shopId ? row.platform.toLowerCase() : '';
    if (!key || keys.has(key)) return false;
    keys.add(key);
  }
  return shops ? keys.size > 0 : keys.has('all');
}

function rowIdentity(report, row) {
  if (report.reportId === 'sp_zl_list' || report.reportId === 'sp_zl_trend') {
    const id = report.dim === 'spu' ? row.spuid : row.goodsId;
    return id && row.platform && row.shopId ? [row.platform, row.shopId, id].join(':') : null;
  }
  if (['qdzl_rx', 'qdfx_rx'].includes(report.reportId)) {
    return row.platform && row.shopId && row.goodsId ? [row.platform, row.shopId, row.goodsId].join(':') : null;
  }
  return JSON.stringify(row);
}

export async function collectDailySheet(request, report, date) {
  const rows = [], raw = [], seen = new Set();
  let expected = null, summary = null, columns, pageSize, object = false;
  for (let page = 1; page <= 200; page++) {
    const reply = await request(report, date, page, pageSize);
    if (reply.blocked) return { reason: reply.blocked };
    if (reply.httpStatus !== 200 || reply.payload?.code !== 0) {
      return { reason: 'upstream_rejected', httpStatus: reply.httpStatus, upstreamCode: reply.payload?.code };
    }
    const data = reply.payload.data;
    if (data == null || typeof data !== 'object') return { reason: 'unrecognized_report' };
    raw.push(data);
    const list = reply.list;
    if (list?.object || objectReports.has(report.reportId)) {
      if (page !== 1 || Object.keys(data).length === 0) return { reason: 'unrecognized_report' };
      object = true;
      break;
    }
    if (!Array.isArray(list?.rows)) return { reason: 'unrecognized_report' };
    if (list.invalidTotal) return { reason: 'pagination_total_changed' };
    columns ||= list.columns;
    if (list.totalKnown) {
      if (!Number.isSafeInteger(list.total) || list.total < 0 || expected != null && expected !== list.total) return { reason: 'pagination_total_changed' };
      expected = list.total;
    } else if (expected != null) return { reason: 'pagination_total_changed' };
    const before = rows.length;
    for (const row of list.rows) {
      if (!row || typeof row !== 'object') return { reason: 'unrecognized_report' };
      if (summaryRow(row)) {
        summary ??= row;
        continue;
      }
      if (!report.snapshot && /^\d{4}-\d{2}-\d{2}$/.test(dateOf(row.date)) && dateOf(row.date) !== date) return { reason: 'report_date_mismatch' };
      const key = rowIdentity(report, row);
      if (!key || seen.has(key)) return { reason: 'pagination_identity_mismatch' };
      seen.add(key);
      rows.push(row);
    }
    const added = rows.length - before;
    pageSize ||= reply.pageSize || (expected != null && expected > rows.length ? added : 0);
    if (expected == null ? !pageSize || added < pageSize
      : rows.length === expected || summary && rows.length + 1 === expected && added < pageSize) break;
    if (expected != null && rows.length > expected || !added || page === 200) return { reason: 'pagination_incomplete' };
  }

  const source = raw.length === 1 ? raw[0] : raw;
  if (accounts.has(report.reportId) && !checkChannelRows(report.reportId, date, source)) return { reason: 'invalid_channel_rows' };
  const overview = overviewRows(source);
  if (report.reportId === 'qdzl_fz' && !overview.groups.length) return { reason: 'unrecognized_group_report' };
  if (report.reportId === 'qdzl_fz' && overview.groups.some(row => row.date && dateOf(row.date) !== date)) return { reason: 'report_date_mismatch' };
  if (report.reportId === 'qdzl_jy' && !overview.rows.some(row => dateOf(row.date) === date && !row.shopId && String(row.platform).toLowerCase() === 'all')) return { reason: 'report_date_mismatch' };
  if (summary) rows.unshift(summary);
  const count = object ? Math.max(overview.rows.length, overview.groups.length, 1) : rows.length;
  const base = { reportId: report.reportId, dim: report.dim, startOn: date, endOn: date,
    status: 'done', kind: object ? 'object' : 'list', totalRows: count, errorText: DAILY_VERIFIED };
  if (object) {
    const payload = { raw: source };
    if (accounts.has(report.reportId)) payload.rows = overview.rows;
    else if (Array.isArray(source)) payload.rows = source;
    return { sheets: [{ ...base, pageNo: 1, rowCount: count, pageSize: count, payload }] };
  }
  const archivePageSize = 100;
  const sheets = Array.from({ length: Math.max(1, Math.ceil(count / archivePageSize)) }, (_, index) => {
    const pageRows = rows.slice(index * archivePageSize, (index + 1) * archivePageSize);
    return { ...base, pageNo: index + 1, pageSize: archivePageSize, rowCount: pageRows.length,
      payload: { rows: pageRows, columnInfo: columns, total: count } };
  });
  return { sheets };
}

export function createDailyReportCollector({ request, readHeads = listSheetHeads, save = writeVerifiedDailySheets, today = shanghaiToday, selection = DAILY_REPORTS }) {
  const failures = new Map();
  let running = false, blockedReason = null;
  async function readPlan() {
    const current = today(), through = addDays(current, -1);
    const heads = await readHeads({ reportIds: [...new Set(selection.map(report => report.reportId))], from: FIRST_DAILY_REPORT_DATE, to: current, daily: true });
    const saved = new Set(heads.filter(row => row.pageNo === 1 && row.status === 'done' && row.errorText === DAILY_VERIFIED).map(row => keyOf(row.startOn, row)));
    return { current, through, saved };
  }
  async function status() {
    const { current, through, saved } = await readPlan();
    const days = [];
    const dueReports = selection.filter(report => !report.snapshot);
    function dayStatus(date, reports) {
      const pending = reports.filter(report => !saved.has(keyOf(date, report))).map(({ reportId, dim }) => ({
        reportId, dim, failure: failures.get(keyOf(date, { reportId, dim }))?.failure || null
      }));
      return { date, required: reports.length, verified: reports.length - pending.length, pending };
    }
    for (let date = through; date >= FIRST_DAILY_REPORT_DATE; date = addDays(date, -1)) days.push(dayStatus(date, dueReports));
    return { ok: true, from: FIRST_DAILY_REPORT_DATE, through, running, blockedReason, days,
      snapshots: dayStatus(current, selection.filter(report => report.snapshot)) };
  }
  async function tick() {
    if (running) return false;
    running = true;
    try {
      const { current, through, saved } = await readPlan();
      blockedReason = null;
      const due = (date, reports) => reports.filter(report => {
        const key = keyOf(date, report);
        return !saved.has(key) && !(failures.get(key)?.retryAt > Date.now());
      });
      const dated = selection.filter(report => !report.snapshot);
      for (let date = through; date >= FIRST_DAILY_REPORT_DATE; date = addDays(date, -1)) {
        const jobs = due(date, dated).slice(0, 6);
        if (jobs.length) return await run(date, jobs);
      }
      const snapshots = due(current, selection.filter(report => report.snapshot));
      return snapshots.length ? await run(current, snapshots) : false;
    } finally {
      running = false;
    }
  }
  async function run(date, reports) {
    for (const report of reports) {
      let failure;
      try {
        const result = await collectDailySheet(request, report, date);
        if (stoppages.has(result.reason)) {
          blockedReason = result.reason;
          return false;
        }
        if (result.sheets) {
          await save(result.sheets);
          failures.delete(keyOf(date, report));
          continue;
        }
        failure = result;
      } catch {
        failure = { reason: 'request_or_archive_error' };
      }
      failures.set(keyOf(date, report), { failure, retryAt: Date.now() + retryDelay });
      console.error('边界日报采集未完成', date, report.reportId, report.dim, failure.reason);
    }
    return true;
  }
  return { tick, status };
}

export function startDailyReports(collector, blocked) {
  async function poll() {
    let worked = false;
    try {
      if (!await blocked()) worked = await collector.tick();
    } catch (error) {
      console.error('边界日报检查失败', error.code || error.name);
    } finally {
      globalThis.setTimeout(poll, worked ? 5000 : 60000).unref();
    }
  }
  globalThis.setTimeout(poll, 20000).unref();
}
