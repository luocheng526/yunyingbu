import { randomUUID } from 'node:crypto';
import { dbMode, query } from '../profile/auth.js';
import { record, writeRecord, ensureCenterSchema } from './center-db.js';
import { dingUserOf, sendTaskNotice } from './dingtalk.js';
const MINUTE = 60000;
const time = value => Date.parse(/Z$|[+-]\d\d:\d\d$/.test(value || '') ? value : value + '+08:00');

const conflict = error => error.statusCode === 409 || ['ER_DUP_ENTRY', 'ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(error.code);

// The site notice doubles as a durable delivery record, retaining attempts and
// a short lease. Optimistic revisions serialize independent worker processes.
export async function deliverNotice(item, { now = new Date(), send = sendTaskNotice, resolveUser = dingUserOf, isCurrent = async () => true } = {}) {
  if (!await isCurrent()) return 'skipped';
  if (dbMode() === 'mysql') {
    await ensureCenterSchema();
    // Materialize the unique row before optimistic claiming. This avoids an
    // absent-row race even under MySQL READ COMMITTED isolation.
    const seed = { ...item, kind: 'notice', revision: 1, deliveryStatus: 'pending', createdAt: now.toISOString(), readAt: null };
    await query('INSERT IGNORE INTO work_center_record (id,kind,revision,body) VALUES (?,?,?,?)', [item.id, 'notice', 1, JSON.stringify(seed)]);
  }
  const at = now.getTime(), old = await record(item.id);
  if (old?.sentAt || time(old?.leaseUntil) > at || time(old?.nextAttemptAt) > at) return 'skipped';
  const lease = randomUUID(), iso = now.toISOString();
  let claimed;
  try {
    claimed = await writeRecord('notice', item.id, { ...old, ...item,
      createdAt: old?.createdAt || iso, readAt: old?.readAt || null,
      deliveryStatus: 'sending', lease, leaseUntil: new Date(at + 2 * MINUTE).toISOString(),
      attempts: (old?.attempts || 0) + 1, lastAttemptAt: iso }, old?.revision || 0);
  } catch (error) {
    if (conflict(error)) return 'skipped';
    throw error;
  }
  let status, patch;
  try {
    const userid = resolveUser(item.personId);
    if (!userid) {
      status = 'blocked'; patch = { lastError: '接收人尚未绑定钉钉', nextAttemptAt: new Date(at + 5 * MINUTE).toISOString() };
    } else if (!await isCurrent()) {
      status = 'cancelled'; patch = { lastError: '', nextAttemptAt: null };
    } else {
      const channel = await send(userid, item.title, item.text, item.url, item.button, item.personName, item.card);
      if (!channel) throw new Error('钉钉未受理');
      status = 'sent'; patch = { channel, sentAt: iso, nextAttemptAt: null, lastError: '' };
    }
  } catch {
    status = 'failed';
    patch = { lastError: '钉钉暂未受理，稍后自动重试', nextAttemptAt: new Date(at + Math.min(30, 2 ** Math.min(claimed.attempts - 1, 5)) * MINUTE).toISOString() };
  }
  // Reading a notice can change its revision during the network call. Merge the
  // delivery result into the latest version without clearing readAt.
  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await record(item.id);
    if (current?.lease !== lease) return status;
    try {
      await writeRecord('notice', item.id, { ...current, ...patch, deliveryStatus: status, leaseUntil: null, lease: null }, current.revision);
      return status;
    } catch (error) { if (!conflict(error) || attempt === 4) throw error; }
  }
}

