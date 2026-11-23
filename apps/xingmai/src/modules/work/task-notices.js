import { createHash } from 'node:crypto';
import { noticeCard, cardPlainText } from './notice-cards.js';
import { workLink } from './dingtalk.js';

// Called before committing a task. One event + recipient is one durable notice,
// even when an edit changes several fields or a client repeats its request.
export function taskNoticePlan(action, task, original, event, ctx) {
  const changes = event.changes || {}, targets = new Map();
  const add = (personId, kind, role = '') => {
    personId = String(personId || '');
    if (!personId || personId === String(event.actor) || !ctx.active.some(p => p.id === personId)) return;
    if (!targets.has(personId)) targets.set(personId, { kind, role });
  };
  if (action === 'publish') add(task.assignee, 'assigned');
  if (action === 'start') add(task.publisher, 'started');
  if (action === 'progress') add(task.publisher, task.blocked ? 'blocked' : 'progress');
  if (action === 'submit') add(task.reviewer, original?.submitted_at ? 'resubmitted' : 'submitted');
  if (action === 'return') add(task.assignee, 'returned');
  if (action === 'approve') add(task.assignee, 'approved');
  if (action === 'cancel') { add(task.assignee, 'cancelled'); add(task.reviewer, 'cancelled'); }
  if (action === 'edit') {
    if (changes.assignee) { add(task.assignee, 'reassigned'); add(original.assignee, 'reassigned', 'former'); }
    if (changes.due_at) add(task.assignee, 'rescheduled');
    if (Object.keys(changes).some(k => !['assignee', 'due_at'].includes(k))) add(task.assignee, 'requirements');
    if (changes.reviewer) { add(task.reviewer, 'requirements', 'reviewer'); add(original.reviewer, 'requirements', 'formerReviewer'); }
  }
  return [...targets].map(([personId, { kind, role }]) => {
    const personName = ctx.byId.get(personId)?.name || '';
    const tab = ['submitted', 'resubmitted'].includes(kind) || role === 'reviewer' ? 'taskReview' : personId === task.assignee ? 'taskMine' : 'tasks';
    const url = workLink(tab, role.startsWith('former') ? undefined : task.id);
    const card = noticeCard(kind, { task, original, event, recipientName: personName, role, url });
    return { id: 'event:' + createHash('sha256').update(event.id + ':' + personId).digest('hex'),
      kind: 'notice', revision: 1, eventKind: kind, eventId: event.id, taskId: task.id,
      taskRevision: task.revision, eventAt: event.at, assignee: task.assignee, reviewer: task.reviewer,
      submittedAt: task.submitted_at || '', role, personId, personName, card,
      title: card.title, text: cardPlainText(card), url, button: card.button,
      deliveryStatus: 'pending', createdAt: new Date().toISOString(), readAt: null };
  });
}

export function taskNoticeCurrent(item, task, activeIds, now = new Date()) {
  if (!task || !activeIds.has(String(item.personId))) return false;
  if (now.getTime() - Date.parse(item.createdAt) > 7 * 86400000) return false;
  const kind = item.eventKind, terminal = ['已完成', '已取消'].includes(task.status);
  if (['assigned', 'started', 'progress', 'blocked', 'returned'].includes(kind)) {
    if (terminal || task.assignee !== item.assignee || task.status === '待检查') return false;
    if (kind === 'assigned' && task.status !== '待执行') return false;
    if (kind === 'returned' && !task.returned) return false;
    if (kind === 'blocked' && !task.blocked) return false;
    if (['progress', 'blocked'].includes(kind) && [...task.events].reverse().find(e => e.action === '更新进度')?.id !== item.eventId) return false;
  }
  if (['submitted', 'resubmitted'].includes(kind) && (task.status !== '待检查' || task.reviewer !== item.personId || task.submitted_at !== item.submittedAt || [...task.events].reverse().find(e => e.action === '提交检查')?.id !== item.eventId)) return false;
  if (['reassigned', 'rescheduled', 'requirements'].includes(kind)) {
    if (terminal) return false;
    if (!item.role.startsWith('former') && item.personId !== task.assignee && item.personId !== task.reviewer) return false;
  }
  return true;
}
