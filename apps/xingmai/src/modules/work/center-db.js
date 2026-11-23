import { randomUUID } from 'node:crypto';
import { dbMode, getPool, query } from '../profile/auth.js';

const memory = new Map();
let readyPromise;
const tails = new Map();
export const copy = value => structuredClone(value);
export const stamp = () => new Date().toISOString();
export const day = (value = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(value);
export function fault(message, status = 400) { throw Object.assign(new Error(message), { statusCode: status }); }
export function validDay(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value; }
export function serial(key, fn) {
  const pending = (tails.get(key) || Promise.resolve()).then(fn, fn);
  const tail = pending.catch(() => {}); tails.set(key, tail);
  tail.finally(() => { if (tails.get(key) === tail) tails.delete(key); });
  return pending;
}
export async function ensureCenterSchema() {
  if (dbMode() !== 'mysql') return;
  if (!readyPromise) readyPromise = (async () => {
    await query(`CREATE TABLE IF NOT EXISTS work_center_migrations (id VARCHAR(80) PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await query(`CREATE TABLE IF NOT EXISTS work_center_record (id VARCHAR(120) PRIMARY KEY, kind VARCHAR(24) NOT NULL, revision INT NOT NULL, body MEDIUMTEXT NOT NULL, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, INDEX work_center_kind (kind)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await query('INSERT IGNORE INTO work_center_migrations (id) VALUES (?)', ['20261123-work-center-v2']);
  })().catch(error => { readyPromise = null; throw error; });
  return readyPromise;
}
export async function records(kind) {
  await ensureCenterSchema();
  if (dbMode() !== 'mysql') return [...memory.values()].filter(row => row.kind === kind).map(copy);
  const [rows] = await query('SELECT body FROM work_center_record WHERE kind = ?', [kind]);
  return rows.map(row => JSON.parse(row.body));
}
export async function record(id) {
  await ensureCenterSchema();
  if (dbMode() !== 'mysql') return memory.has(id) ? copy(memory.get(id)) : null;
  const [rows] = await query('SELECT body FROM work_center_record WHERE id = ?', [id]);
  return rows.length ? JSON.parse(rows[0].body) : null;
}
export async function writeRecord(kind, id, data, expected = 0) {
  await ensureCenterSchema();
  return serial('record:' + id, async () => {
    if (dbMode() !== 'mysql') {
      const previous = memory.get(id);
      if ((previous?.revision || 0) !== Number(expected)) fault('记录已更新，请刷新后重试', 409);
      const next = { ...copy(data), id, kind, revision: Number(expected) + 1, updatedAt: stamp() };
      memory.set(id, next); return copy(next);
    }
    const conn = await (await getPool()).getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query('SELECT revision FROM work_center_record WHERE id = ? FOR UPDATE', [id]);
      if ((rows[0]?.revision || 0) !== Number(expected)) fault('记录已更新，请刷新后重试', 409);
      const next = { ...copy(data), id, kind, revision: Number(expected) + 1, updatedAt: stamp() };
      await conn.query('INSERT INTO work_center_record (id,kind,revision,body) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE revision=VALUES(revision),body=VALUES(body)', [id, kind, next.revision, JSON.stringify(next)]);
      await conn.commit(); return next;
    } catch (error) { await conn.rollback(); throw error; } finally { conn.release(); }
  });
}
export async function audit(actor, action, before, after, reason = '') {
  return writeRecord('audit', randomUUID(), { actor, action, before, after, reason, at: stamp() });
}
export const DEFAULT_SETTINGS = {
  categories: ['日常工作','商品上架','商品优化','选品测品','付费推广','店铺经营','退货治理','数据分析','人员管理','临时工作','其他'],
  roleOverrides: {}, teamOverrides: {}, reportingOverrides: {}, collaborations: [], taskTemplates: [],
  reportRoles: ['主管','运营','运营助理'], reportMembers: [], weekdays: [1,2,3,4,5], restDays: [],
  deadline: '18:00', allowLate: true, reviewHours: 24, staleHours: 48,
  requiredAttachmentCategories: [],
  reportFields: { 主管: ['团队主要工作','主动发现的问题','已解决问题','未解决问题','员工指导与培养','明日团队计划','需要经理支持'], 运营: ['店铺经营','商品优化','选品测品','推广调整','退货治理','未完成原因','明日计划'], 助理: ['商品上架','主图与详情优化','商品维护','遇到的问题','明日计划'] }
};
export async function settings() {
  const result={...copy(DEFAULT_SETTINGS),...(await record('settings')||{})};
  result.reportRoles=result.reportRoles.map(r=>r==='助理'?'运营助理':r);
  result.reportFields['运营助理'] ||= result.reportFields['助理']||[];
  return result;
}
export function resetCenterRecords() { memory.clear(); readyPromise = null; tails.clear(); }
export function exportCenterRecords() { return [...memory.values()].map(copy); }
export function importCenterRecords(rows) { memory.clear(); for (const row of rows || []) memory.set(row.id, copy(row)); }
