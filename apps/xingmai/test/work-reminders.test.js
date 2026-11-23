import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { resetPeopleStore } from '../src/modules/people/store.js';
import { resetWorkStore, getSettings } from '../src/modules/work/store.js';
import { resetOrgMemo, saveDiaryRest } from '../src/modules/work/diary.js';
import { resetCenterRecords, record, records, writeRecord, exportCenterRecords, importCenterRecords, DEFAULT_SETTINGS } from '../src/modules/work/center-db.js';
import { organizationContext } from '../src/modules/work/center-access.js';
import { resetTaskStore, importTasks, setTaskNotifier } from '../src/modules/work/tasks.js';
import { saveSettings, saveDaily, centerData } from '../src/modules/work/center.js';
import { saveBinds, resetDingStore, setDingTransport } from '../src/modules/work/dingtalk.js';
import { taskReminderPlan, dailyReminderPlan, deliverReminder, runWorkReminders, reminderStatus } from '../src/modules/work/reminders.js';
import { workRouter } from '../src/modules/work/router.js';

const director = { username: '罗成' }, operator = { username: '张文静' };
const at = value => new Date('2026-11-23T' + value + '+08:00');
const context = overrides => ({ active: [{ id: '4', name: '执行人' }, { id: '8', name: '验收人' }], config: { ...DEFAULT_SETTINGS, ...overrides } });
const task = extra => ({ id: 'reminder-task-1', title: '验证任务', assignee: '4', reviewer: '8', status: '进行中', due_at: '2026-11-23T18:00', ...extra });
const item = extra => ({ id: 'reminder:test', reminderKind: 'task_due', personId: '4', personName: '张文静', title: '即将截止', text: '测试提醒', url: 'https://zx.xingmaierp.cc/work', ...extra });

beforeEach(async () => {
  resetPeopleStore(); resetWorkStore(); resetOrgMemo(); resetCenterRecords(); resetTaskStore(); resetDingStore();
  setTaskNotifier(async () => false);
  await saveBinds([{ personId: 4, userid: 'ding-test-4' }, { personId: 8, userid: 'ding-test-8' }]);
});

test('due, overdue and next-day reminders respect Shanghai boundaries and terminal states', () => {
  const ctx = context();
  assert.equal(taskReminderPlan([task()], ctx, at('16:59')).length, 0);
  const due = taskReminderPlan([task()], ctx, at('17:00'))[0];
  assert.equal(due.reminderKind, 'task_due'); assert.equal(due.personId, '4');
  assert.equal(taskReminderPlan([task()], ctx, at('18:00'))[0].reminderKind, 'task_overdue');
  assert.equal(taskReminderPlan([task({ status: '已完成' }), task({ status: '已取消' })], ctx, at('19:00')).length, 0);
  assert.equal(taskReminderPlan([task()], ctx, new Date('2026-11-24T08:59+08:00')).length, 0);
  const tomorrow = taskReminderPlan([task()], ctx, new Date('2026-11-24T09:00+08:00'))[0];
  assert.notEqual(tomorrow.id, taskReminderPlan([task()], ctx, at('18:00'))[0].id);
});

test('pending review notifies reviewer at review threshold, including legacy submission events', () => {
  const pending = task({ status: '待检查', submitted_at: '2026-11-22T18:00' });
  assert.equal(taskReminderPlan([pending], context(), at('17:59')).length, 0);
  const notices = taskReminderPlan([pending], context(), at('18:00'));
  assert.equal(notices.length, 1); assert.equal(notices[0].personId, '8');
  assert.equal(notices[0].reminderKind, 'review_late'); assert.match(notices[0].url, /tab=taskReview/);
  assert.equal(taskReminderPlan([task({ status: '待检查', events: [{ action: '提交检查', at: '2026-11-22T18:00' }] })], context(), at('18:00')).length, 1);
  assert.equal(taskReminderPlan([task({ status: '待检查' })], context(), at('18:00')).length, 0);
});

test('config switches, inactive recipients, invalid dates and changed deadlines are honored', () => {
  assert.equal(taskReminderPlan([task()], context({ taskReminders: false }), at('17:00')).length, 0);
  assert.equal(taskReminderPlan([task({ assignee: 'departed' }), task({ due_at: '' })], context(), at('17:00')).length, 0);
  assert.equal(taskReminderPlan([task()], context({ dueSoonMinutes: 30 }), at('17:00')).length, 0);
  const first = taskReminderPlan([task()], context(), at('17:30'))[0];
  const second = taskReminderPlan([task({ due_at: '2026-11-23T18:30' })], context(), at('17:30'))[0];
  assert.notEqual(first.id, second.id);
  assert.notEqual(first.id, taskReminderPlan([task({ assignee: '8' })], context(), at('17:30'))[0].id);
});

test('new daily roster works when legacy roster is empty; drafts do not count as submission', async () => {
  assert.equal((await getSettings(director)).members.length, 0);
  await saveSettings(director, { revision: 0, reportMembers: ['4'], weekdays: [0,1,2,3,4,5,6], deadline: '18:00' });
  const ctx = await organizationContext();
  assert.equal((await dailyReminderPlan(ctx, at('17:59'))).length, 0);
  const missing = await dailyReminderPlan(ctx, at('18:40')); // catches missed startup window
  assert.equal(missing.length, 1); assert.equal(missing[0].personId, '4');
  assert.match(missing[0].url, /tab=reports/); assert.match(missing[0].url, /date=2026-11-23/);
  await saveDaily(operator, { date: '2026-11-23', submit: false });
  assert.equal((await dailyReminderPlan(ctx, at('19:00'))).length, 1);
  await saveDaily(operator, { date: '2026-11-23', submit: true, revision: 1 });
  assert.equal((await dailyReminderPlan(ctx, at('19:00'))).length, 0);
});

test('daily reminder eligibility exactly matches work center, excludes rest days and manual exemption', async () => {
  await saveSettings(director, { revision: 0, reportMembers: ['4','8'], weekdays: [0,1,2,3,4,5,6] });
  await saveDiaryRest(director, { personId: 8, date: '2026-11-23', rest: true }, true);
  const ctx = await organizationContext(), plan = await dailyReminderPlan(ctx, at('18:00'));
  const page = await centerData(director, { date: '2026-11-23' });
  assert.deepEqual(plan.map(p => p.personId), page.people.filter(p => p.required && p.reportStatus === '未提交').map(p => p.id));
  assert.deepEqual(plan.map(p => p.personId), ['4']);
  assert.equal((await dailyReminderPlan({ ...ctx, config: { ...ctx.config, restDays: ['2026-11-23'] } }, at('18:00'))).length, 0);
  assert.equal((await dailyReminderPlan({ ...ctx, config: { ...ctx.config, weekdays: [] } }, at('18:00'))).length, 0);
  assert.equal((await dailyReminderPlan({ ...ctx, config: { ...ctx.config, dailyReminders: false } }, at('18:00'))).length, 0);
});

test('concurrent workers claim one delivery; durable sent record survives process-state reload', async () => {
  let sent = 0;
  const send = async () => { sent++; await new Promise(resolve => setTimeout(resolve, 10)); return 'at'; };
  await Promise.all([deliverReminder(item(), { now: at('17:00'), send }), deliverReminder(item(), { now: at('17:00'), send })]);
  assert.equal(sent, 1); assert.equal((await records('notice')).length, 1);
  const persisted = exportCenterRecords(); resetCenterRecords(); importCenterRecords(persisted);
  assert.equal(await deliverReminder(item(), { now: at('17:30'), send }), 'skipped'); assert.equal(sent, 1);
});

test('transient failure is persisted, backed off and retried without duplicating site notices', async () => {
  let calls = 0;
  const send = async () => { if (++calls === 1) throw new Error('temporary'); return 'work'; };
  assert.equal(await deliverReminder(item(), { now: at('17:00'), send }), 'failed');
  assert.equal(await deliverReminder(item(), { now: at('17:00:30'), send }), 'skipped');
  assert.equal(await deliverReminder(item(), { now: at('17:01'), send }), 'sent');
  assert.equal(calls, 2); const row = await record(item().id);
  assert.equal(row.attempts, 2); assert.equal(row.lastError, ''); assert.equal(row.channel, 'work');
  assert.equal((await records('notice')).length, 1);
});

test('missing binding is visible and recovers once bound, never counts as sent', async () => {
  const notice = item({ personId: '5', personName: '未绑定人员' }); let sends = 0;
  const send = async () => { sends++; return 'robot'; };
  assert.equal(await deliverReminder(notice, { now: at('18:00'), send }), 'blocked');
  assert.equal(sends, 0); assert.equal((await record(notice.id)).sentAt, undefined);
  await saveBinds([{ personId: 5, userid: 'newly-bound' }]);
  assert.equal(await deliverReminder(notice, { now: at('18:05'), send }), 'sent'); assert.equal(sends, 1);
});

test('expired lease recovers after crash; unread/read actions do not lose delivery results', async () => {
  await writeRecord('notice', item().id, { ...item(), lease: 'old-process', leaseUntil: at('17:02').toISOString(), attempts: 1 }, 0);
  let calls = 0;
  const send = async () => { calls++; const row = await record(item().id); await writeRecord('notice', row.id, { ...row, readAt: 'read-now' }, row.revision); return 'at'; };
  assert.equal(await deliverReminder(item(), { now: at('17:01'), send }), 'skipped');
  assert.equal(await deliverReminder(item(), { now: at('17:03'), send }), 'sent');
  const row = await record(item().id); assert.equal(calls, 1); assert.equal(row.readAt, 'read-now'); assert.ok(row.sentAt);
});

test('completion during queue processing cancels send; stale failure does not retry after completion', async () => {
  let calls = 0, checks = 0;
  assert.equal(await deliverReminder(item(), { now: at('17:00'), send: async () => { calls++; }, isCurrent: async () => ++checks === 1 }), 'cancelled');
  assert.equal(calls, 0);
  importTasks({ tasks: [task()] });
  await saveSettings(director, { revision: 0, dailyReminders: false });
  const first = await runWorkReminders(at('17:00'), { send: async () => { throw new Error('unavailable'); } });
  assert.equal(first.failed, 1);
  importTasks({ tasks: [task({ status: '已完成' })] });
  const next = await runWorkReminders(at('17:05'), { send: async () => { calls++; return 'at'; } });
  assert.equal(next.candidates, 0); assert.equal(calls, 0);
});

test('scheduler uses new daily records and DingTalk transport and does not send duplicate legacy reminders', async () => {
  await saveSettings(director, { revision: 0, reportMembers: ['4'], weekdays: [0,1,2,3,4,5,6] });
  process.env.DINGTALK_NOTIFY_WEBHOOK = 'https://oapi.dingtalk.com/robot/send?access_token=test-token-12345';
  const sent = [];
  setDingTransport(async (_url, options) => { sent.push(JSON.parse(options.body)); return { json: async () => ({ errcode: 0 }) }; });
  try {
    assert.equal((await runWorkReminders(at('18:30'))).sent, 1);
    assert.equal((await runWorkReminders(at('18:31'))).sent, 0);
    assert.equal(sent.length, 1); assert.deepEqual(sent[0].at.atUserIds, ['ding-test-4']);
    assert.match(sent[0].markdown.text, /tab=reports/);
    const status = await reminderStatus(await organizationContext()); assert.equal(status.recent[0].statusLabel, '钉钉已受理');
  } finally { delete process.env.DINGTALK_NOTIFY_WEBHOOK; setDingTransport(); }
});

test('new reminder rules validate input and status endpoint requires director rights', async () => {
  for (const bad of [{ dueSoonMinutes: 0 }, { dueSoonMinutes: 1.5 }, { repeatReminderAt: '25:00' }, { taskReminders: 'yes' }, { dailyReminders: null }]) {
    await assert.rejects(() => saveSettings(director, { revision: 0, ...bad }), /提醒|催办/);
  }
  await saveSettings(director, { revision: 0, taskReminders: false, dailyReminders: false, dueSoonMinutes: 120, repeatReminderAt: '10:00' });
  const ctx = await organizationContext(); assert.equal(ctx.config.taskReminders, false); assert.equal(ctx.config.dueSoonMinutes, 120);
  const app = express(); app.use((req, _res, next) => { req.user = { username: req.headers['x-test-user'] || '张文静' }; next(); }); app.use('/work', workRouter);
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  try {
    const url = `http://127.0.0.1:${server.address().port}/work/center/reminders`;
    assert.equal((await fetch(url)).status, 403);
    const response = await fetch(url, { headers: { 'x-test-user': 'luocheng' } });
    assert.equal(response.status, 200); assert.ok((await response.json()).unbound.length);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
