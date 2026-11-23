import { createHash } from 'node:crypto';
import { dbMode } from '../profile/auth.js';
import { organizationContext } from './center-access.js';
import { record, records, day } from './center-db.js';
import { eligibility } from './center-reporting.js';
import { readyDiary } from './diary.js';
import { dingUserOf, shanghaiNow, workLink } from './dingtalk.js';
import { reminderTasks, retryTaskNotices } from './tasks.js';

import { deliverNotice as deliverReminder } from './notice-delivery.js';
import { noticeCard } from './notice-cards.js';
export { deliverReminder };

const MINUTE = 60000;
const time = value => Date.parse(/Z$|[+-]\d\d:\d\d$/.test(value || '') ? value : value + '+08:00');
const labelTime = value => String(value || '').replace('T', ' ');
const terminal = task => ['已完成', '已取消'].includes(task.status);
const keyOf = parts => 'reminder:' + createHash('sha256').update(JSON.stringify(parts)).digest('hex');

// A deadline change, reassignment or a new review submission starts a new cycle.
export function taskReminderPlan(tasks, ctx, now = new Date()) {
  if (!ctx.config.taskReminders) return [];
  const clock = shanghaiNow(now), at = now.getTime(), result = [];
  const active = new Map(ctx.active.map(p => [String(p.id), p]));
  const append = (task, kind, personId, cycle, title, text, tab) => {
    const person = active.get(String(personId));
    if (!person) return;
    const url = workLink(tab, task.id);
    const card = noticeCard(kind, { task, recipientName: person.name, reviewHours: ctx.config.reviewHours, url });
    result.push({ id: keyOf([kind, task.id, String(personId), cycle]), reminderKind: kind,
      personId: String(personId), personName: person.name, taskId: task.id, title, text,
      url, card, button: card.button });
  };
  for (const task of tasks) {
    if (terminal(task)) continue;
    if (task.status === '待检查') {
      const submitted = task.submitted_at || [...(task.events || [])].reverse().find(e => e.action === '提交检查')?.at;
      const threshold = time(submitted) + Number(ctx.config.reviewHours) * 3600000;
      if (Number.isFinite(threshold) && at >= threshold &&
          (day(new Date(threshold)) === clock.date || clock.hm >= ctx.config.repeatReminderAt)) {
        append(task, 'review_late', task.reviewer, [submitted, ctx.config.reviewHours, clock.date],
          '任务验收超时', `「${task.title}」已提交超过 ${ctx.config.reviewHours} 小时，请及时验收。`, 'taskReview');
      }
      continue; // Execution is finished; awaiting review must not nag the assignee.
    }
    const due = time(task.due_at);
    if (!Number.isFinite(due)) continue;
    if (at < due && at >= due - ctx.config.dueSoonMinutes * MINUTE) {
      append(task, 'task_due', task.assignee, task.due_at, '任务即将到期',
        `「${task.title}」将于 ${labelTime(task.due_at)} 截止，请及时提交成果。`, 'taskMine');
    } else if (at >= due && (day(new Date(due)) === clock.date || clock.hm >= ctx.config.repeatReminderAt)) {
      append(task, 'task_overdue', task.assignee, [task.due_at, clock.date], '任务已逾期',
        `「${task.title}」已超过截止时间 ${labelTime(task.due_at)}，请尽快处理。`, 'taskMine');
    }
  }
  return result;
}

export async function dailyReminderPlan(ctx, now = new Date()) {
  const clock = shanghaiNow(now);
  if (!ctx.config.dailyReminders || clock.hm < ctx.config.deadline) return [];
  const [required, daily] = await Promise.all([eligibility(ctx, clock.date), records('daily')]);
  const submitted = new Set(daily.filter(r => r.date === clock.date && r.submittedAt).map(r => String(r.personId)));
  return ctx.active.filter(p => required.get(p.id)?.required && !submitted.has(p.id)).map(p => {
    const url = new URL(workLink('reports'));
    url.searchParams.set('date', clock.date); url.searchParams.set('compose', '1');
    return { id: keyOf(['daily_missing', p.id, clock.date]), reminderKind: 'daily_missing',
      personId: p.id, personName: p.name, workDate: clock.date,
      title: '今天的日报还没提交', text: `${clock.date} 的日报尚未提交，截止时间为 ${ctx.config.deadline}，请及时提交。`,
      url: url.toString(), button: '去填日报', card: noticeCard('daily_missing', { recipientName: p.name, date: clock.date, deadline: ctx.config.deadline, url: url.toString() }) };
  });
}

let running = null, timer = null;
export function runWorkReminders(now = new Date(), options = {}) {
  if (running) return running;
  running = runCycle(now, options).finally(() => { running = null; });
  return running;
}
async function runCycle(now, options) {
  const started = Date.now();
  const currentTime = () => new Date(now.getTime() + Date.now() - started);
  await readyDiary();
  const ctx = await organizationContext();
  const taskPlan = taskReminderPlan(await reminderTasks(), ctx, now);
  const dailyPlan = await dailyReminderPlan(ctx, now);
  const result = { candidates: taskPlan.length + dailyPlan.length, sent: 0, failed: 0, blocked: 0, skipped: 0, cancelled: 0 };
  for (const item of [...taskPlan, ...dailyPlan]) {
    const isCurrent = async () => {
      if (item.taskId) return taskReminderPlan(await reminderTasks(item.taskId), ctx, currentTime()).some(next => next.id === item.id);
      if (day(currentTime()) !== item.workDate) return false;
      return !(await record(`daily:${item.personId}:${item.workDate}`))?.submittedAt;
    };
    try { result[await deliverReminder(item, { ...options, now: currentTime(), isCurrent })]++; }
    catch { result.failed++; console.error('工作提醒记录失败，将在下一轮重试', item.id); }
  }
  result.events = await retryTaskNotices(ctx, { ...options, now: currentTime() });
  return result;
}

export function startWorkReminders() {
  if (timer) return;
  // Imported before database bootstrap. Never send from preview or test memory stores.
  timer = setInterval(() => {
    if (dbMode() !== 'mysql') return;
    runWorkReminders().catch(() => console.error('工作中心提醒巡检失败，将在下一轮重试'));
  }, 30000);
  timer.unref?.();
}

export async function reminderStatus(ctx) {
  await readyDiary();
  const unbound = ctx.active.filter(p => !dingUserOf(p.id)).map(p => ({ id: p.id, name: p.name }));
  const labels = { sent: '钉钉已受理', failed: '发送失败，自动重试', blocked: '未绑定钉钉', sending: '发送中', cancelled: '已处理，停止提醒' };
  const recent = (await records('notice')).filter(n => n.reminderKind || n.eventKind)
    .sort((a, b) => time(b.lastAttemptAt || b.createdAt) - time(a.lastAttemptAt || a.createdAt)).slice(0, 100)
    .map(n => ({ title: n.title, personName: n.personName, statusLabel: labels[n.deliveryStatus] || '待发送',
      lastAttemptAt: n.lastAttemptAt, createdAt: n.createdAt, attempts: n.attempts, sentAt: n.sentAt, nextAttemptAt: n.nextAttemptAt }));
  return { ok: true, active: ctx.active.length, bound: ctx.active.length - unbound.length, unbound, recent,
    rule: `北京时间：截止前 ${ctx.config.dueSoonMinutes} 分钟提醒；持续逾期 / 验收超时每日 ${ctx.config.repeatReminderAt} 催办；日报 ${ctx.config.deadline} 催交。` };
}
