import { listSheetHeads, writeSheet } from './persist.js';
import { overviewRows } from './saved-overview.js';
import { addDays, shanghaiToday } from './time.js';

export const CHANNEL_DAILY_REPORTS = ['qdzl_lb', 'qdfx_dplb'];
const firstDay = '2026-11-19';
const retryDelay = 15 * 60000;
const channels = new Set(['all', 'All', 'JD', 'TM', 'TMALL', 'DY', 'DOUYIN']);

export function channelDailySheet(reportId, date, raw) {
  const { rows } = overviewRows(raw);
  const shopReport = reportId === 'qdfx_dplb';
  const keys = new Set();
  for (const row of rows) {
    if (shopReport && row.sumLine) continue;
    if (String(row.date).replaceAll('/', '-') !== date || row.gmv === '' || !Number.isFinite(Number(row.gmv))) return null;
    const key = shopReport && /^[A-Z]{2,8}$/.test(row.platform) && /^\d{1,24}$/.test(String(row.shopId)) && row.shopName
      ? row.platform + ':' + row.shopId : !shopReport && channels.has(row.platform) && !row.shopId ? row.platform.toLowerCase() : '';
    if (!key || keys.has(key)) return null;
    keys.add(key);
  }
  if (!keys.size || !shopReport && (keys.size < 2 || !keys.has('all'))) return null;
  return { reportId, dim: 'all', startOn: date, endOn: date, pageNo: 1, status: 'done', kind: 'list',
    totalRows: rows.length, rowCount: rows.length, pageSize: rows.length, payload: { raw } };
}

export function createDailyChannelCollector({ request, readHeads = listSheetHeads, save = writeSheet, today = shanghaiToday }) {
  const retryAt = new Map();
  async function tick() {
    const yesterday = addDays(today(), -1);
    if (yesterday < firstDay) return false;
    const heads = await readHeads({ reportIds: CHANNEL_DAILY_REPORTS, dim: 'all', from: firstDay, to: yesterday, daily: true });
    const saved = new Set(heads.filter(row => row.pageNo === 1 && row.status === 'done' && row.rowCount > 0)
      .map(row => row.startOn + ':' + row.reportId));
    const now = Date.now();
    for (const [key, until] of retryAt) if (until <= now) retryAt.delete(key);
    for (let date = yesterday; date >= firstDay; date = addDays(date, -1)) {
      const pending = CHANNEL_DAILY_REPORTS.filter(reportId => {
        const key = date + ':' + reportId;
        return !saved.has(key) && !retryAt.has(key);
      });
      if (!pending.length) continue;
      for (const reportId of pending) {
        let reason = 'request_failed';
        try {
          const result = await request(reportId, date);
          reason = result.blocked || 'invalid_report';
          if (['collector_busy', 'login_busy', 'server_login_required', 'session_changed', 'identity_changed'].includes(reason)) return false;
          const sheet = result.httpStatus === 200 && result.payload?.code === 0
            ? channelDailySheet(reportId, date, result.payload.data) : null;
          if (sheet) {
            reason = 'archive_write_failed';
            await save(sheet);
            continue;
          }
        } catch { /* Leave the previous saved result in place and retry later. */ }
        retryAt.set(date + ':' + reportId, Date.now() + retryDelay);
        console.error('边界渠道日报采集未完成', date, reportId, reason);
      }
      return true;
    }
    return false;
  }
  return { tick };
}

export function startDailyChannelReports({ request, blocked }) {
  const collector = createDailyChannelCollector({ request });
  async function poll() {
    let worked = false;
    try {
      if (!await blocked()) worked = await collector.tick();
    } catch (error) {
      console.error('边界渠道日报检查失败', error.code || error.name);
    } finally {
      globalThis.setTimeout(poll, worked ? 5000 : 60000).unref();
    }
  }
  globalThis.setTimeout(poll, 20000).unref();
}
