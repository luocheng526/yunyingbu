import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetPeopleStore } from '../src/modules/people/store.js';
import { setPoolForTests } from '../src/modules/profile/auth.js';
import { resetWorkStore } from '../src/modules/work/store.js';
import { resetOrgMemo } from '../src/modules/work/diary.js';
import { record, records, writeRecord, resetCenterRecords, exportCenterRecords, importCenterRecords } from '../src/modules/work/center-db.js';
import { organizationContext } from '../src/modules/work/center-access.js';
import { saveSettings } from '../src/modules/work/center.js';
import { publishTask, actTask, setTaskNotifier, resetTaskStore, retryTaskNotices, exportTasks, importTasks } from '../src/modules/work/tasks.js';
import { taskReminderPlan, dailyReminderPlan, runWorkReminders, reminderStatus } from '../src/modules/work/reminders.js';
import { NOTICE_TYPES, noticeCard, cardMarkdown } from '../src/modules/work/notice-cards.js';
import { resetDingStore, saveBinds, setDingTransport, sendTaskNotice, popupTo, workLink } from '../src/modules/work/dingtalk.js';

const director = { username: '罗成' }, lead = { username: '杨润泽' }, op = { username: '张文静' };
let calls;
const capture = async (personId, title, text, url, card) => { calls.push({ personId, title, text, url, card }); return 'robot'; };
beforeEach(async () => {
  resetPeopleStore(); resetWorkStore(); resetOrgMemo(); resetTaskStore(); resetCenterRecords(); resetDingStore();
  calls = []; setTaskNotifier(capture);
  await saveSettings(director, { revision: 0, teamOverrides: { '4': '8', '5': '8' }, weekdays: [0,1,2,3,4,5,6], reportMembers: ['4'] });
});
afterEach(() => {
  setPoolForTests(null);
  setDingTransport(); resetDingStore();
  for (const key of ['DINGTALK_CLIENT_ID', 'DINGTALK_CLIENT_SECRET', 'DINGTALK_AGENT_ID', 'DINGTALK_NOTIFY_WEBHOOK']) delete process.env[key];
});
async function create(extra = {}) {
  const result = await publishTask(director, { id: 'notice-test-task', title: '核对活动价', assignee: '4', reviewer: '8',
    start_at: '2026-11-23T09:00', due_at: '2026-11-23T18:00', ...extra });
  assert.equal(result.ok, true, result.error); return result.task;
}
async function act(user, task, action, extra = {}) {
  const result = await actTask(user, { id: task.id, revision: task.revision, action, note: '真实操作说明', ...extra });
  assert.equal(result.ok, true, result.error); return result.task;
}

test('task lifecycle sends all eight execution/review cards to the correct people exactly once', async () => {
  let task = await create();
  await create(); // Duplicate client request.
  task = await act(op, task, 'start');
  task = await act(op, task, 'progress', { progress: 40, note: '已完成价格核对' });
  task = await act(op, task, 'progress', { progress: 60, blocked: true, note: '缺少授权，请协助' });
  task = await act(op, task, 'submit', { note: '完整价格表已上传' });
  task = await act(lead, task, 'return', { note: '请补上两个 SPU' });
  task = await act(op, task, 'submit', { note: '两个 SPU 已补齐' });
  task = await act(lead, task, 'approve', { note: '符合要求' });
  assert.deepEqual(calls.map(c => c.card.kind), ['assigned','started','progress','blocked','submitted','returned','resubmitted','approved']);
  assert.deepEqual(calls.map(c => c.personId), ['4','3','3','3','8','4','8','4']);
  assert.match(calls[3].text, /缺少授权/); assert.match(calls[4].url, /taskReview/);
  assert.equal(calls[5].card.note, '请补上两个 SPU'); assert.equal(calls[7].card.status, '已完成');
  const inbox = await records('notice'); assert.equal(inbox.length, 8); assert.ok(inbox.every(n => n.sentAt && n.deliveryStatus === 'sent'));
  await retryTaskNotices(await organizationContext()); assert.equal(calls.length, 8);
  assert.equal((await actTask(lead, { id: task.id, revision: task.revision - 1, action: 'approve' })).statusCode, 409);
});

test('changes deduplicate recipients, explain old/new values and do not link former owners to inaccessible tasks', async () => {
  let task = await create(); calls = [];
  task = await act(director, task, 'edit', { assignee: '5', due_at: '2026-11-24T18:00', description: '新要求' });
  assert.deepEqual(calls.map(c => [c.personId,c.card.kind]), [['5','reassigned'],['4','reassigned']]);
  assert.equal(calls[1].card.button, '打开工作中心'); assert.equal(new URL(calls[1].url).searchParams.has('task'), false);
  assert.match(calls[0].card.description, /任务说明、截止时间/);
  assert.match(calls[0].text, /张文静.*陈明婧/);
  calls = [];
  task = await act(director, task, 'edit', { due_at: '2026-11-25T18:00' });
  assert.equal(calls[0].card.kind, 'rescheduled'); assert.match(calls[0].text, /2026-11-24 18:00.*2026-11-25 18:00/);
  calls = [];
  task = await act(director, task, 'edit', { criteria: '每行必须有链接', reviewer: '3' });
  assert.deepEqual(calls.map(c => [c.personId,c.card.kind]), [['5','requirements'],['8','requirements']]);
  assert.match(calls[1].card.description, /无需继续验收/);
  calls = [];
  task = await act(director, task, 'cancel', { note: '活动取消' });
  assert.deepEqual(calls.map(c => [c.personId,c.card.kind]), [['5','cancelled']]);
  assert.match(calls[0].text, /活动取消/);
});

test('new reviewer receives changes and cancellation; acting user never receives own notification', async () => {
  let task = await create({ reviewer: '3' }); calls = [];
  task = await act(director, task, 'edit', { reviewer: '8' });
  assert.deepEqual(calls.map(c => c.personId), ['4','8']); assert.match(calls[1].url, /taskReview/);
  calls = [];
  await act(director, task, 'cancel');
  assert.deepEqual(calls.map(c => c.personId), ['4','8']);
});

test('all four scheduled cases use the shared brand card and real task/report facts', async () => {
  const task = await create(), ctx = await organizationContext();
  const at = clock => new Date('2026-11-23T' + clock + ':00+08:00');
  const due = taskReminderPlan([task], ctx, at('17:00'))[0];
  const late = taskReminderPlan([task], ctx, at('18:00'))[0];
  const review = taskReminderPlan([{ ...task, status: '待检查', submitted_at: '2026-11-22T16:00' }], ctx, at('18:00'))[0];
  const daily = (await dailyReminderPlan(ctx, at('18:00'))).find(n => n.personId === '4');
  assert.deepEqual([due,late,review,daily].map(n => n.card.kind), ['task_due','task_overdue','review_late','daily_missing']);
  assert.equal(review.personId, '8'); assert.equal(review.button, '立即验收');
  assert.equal(daily.card.fields[0].value, '2026-11-23'); assert.match(daily.url, /date=2026-11-23&compose=1/);
  for (const n of [due,late,review,daily]) assert.match(cardMarkdown(n.card), /甄选未来 · 工作中心/);
  assert.equal(Object.keys(NOTICE_TYPES).length, 16);
});

test('failed events survive process reload, retry concurrently once and preserve read state', async () => {
  setTaskNotifier(async () => { throw new Error('outage'); });
  await create();
  let inbox = await records('notice'); assert.equal(inbox.length, 1); assert.equal(inbox[0].deliveryStatus, 'failed');
  const snapshot = exportTasks(), noticeSnapshot = exportCenterRecords();
  resetTaskStore(); resetCenterRecords(); importTasks(snapshot); importCenterRecords(noticeSnapshot);
  setTaskNotifier(async (...args) => {
    const row = await record(inbox[0].id); await writeRecord('notice', row.id, { ...row, readAt: 'already-read' }, row.revision);
    return capture(...args);
  });
  const now = new Date(Date.now() + 65000), ctx = await organizationContext();
  await Promise.all([retryTaskNotices(ctx, { now }), retryTaskNotices(ctx, { now })]);
  inbox = await records('notice'); assert.equal(calls.length, 1); assert.equal(inbox.length, 1);
  assert.equal(inbox[0].readAt, 'already-read'); assert.equal(inbox[0].attempts, 2); assert.equal(inbox[0].deliveryStatus, 'sent');
});

test('missing binding remains visible, recovers after binding, and legacy inbox entries are never replayed', async () => {
  setTaskNotifier(null); await create();
  let inbox = await records('notice'); assert.equal(inbox[0].deliveryStatus, 'blocked');
  await writeRecord('notice', 'legacy-notice', { personId: '4', title: '历史消息', createdAt: new Date().toISOString() });
  await saveBinds([{ personId: 4, userid: 'ding-4' }]);
  const ctx = await organizationContext(); let sent = 0;
  await retryTaskNotices(ctx, { now: new Date(Date.now() + 301000), send: async (...args) => { sent++; assert.equal(args[6].kind, 'assigned'); return 'robot'; } });
  assert.equal(sent, 1); assert.equal((await record('legacy-notice')).sentAt, undefined);
  assert.equal((await reminderStatus(ctx)).recent[0].statusLabel, '钉钉已受理');
});

test('scheduler cancels obsolete events after cancellation and still sends the cancellation notice', async () => {
  setTaskNotifier(async () => false); let task = await create();
  task = await act(director, task, 'cancel');
  setTaskNotifier(capture);
  const result = await runWorkReminders(new Date(Date.now() + 65000));
  assert.equal(result.events.cancelled, 1); assert.equal(result.events.sent, 2);
  assert.ok(calls.every(c => c.card.kind === 'cancelled'));
  assert.equal((await records('notice')).find(n => n.eventKind === 'assigned').deliveryStatus, 'cancelled');
});

test('a resubmission in the same minute supersedes the old pending submission notice', async () => {
  let task = await create(); setTaskNotifier(async () => false);
  task = await act(op, task, 'submit'); const first = task.submitted_at;
  task = await act(lead, task, 'return'); task = await act(op, task, 'submit');
  assert.equal(task.submitted_at, first);
  calls = []; setTaskNotifier(capture);
  await retryTaskNotices(await organizationContext(), { now: new Date(Date.now() + 65000) });
  assert.deepEqual(calls.map(c => c.card.kind), ['resubmitted']);
});

test('untrusted text cannot inject links, HTML, other @ recipients or overlong card content', () => {
  const card = noticeCard('blocked', { task: { title: '<img src=x> [假按钮](https://evil.test) @all ' + '长'.repeat(1000), assignee_name: '张文静', progress: 40 },
    event: { note: '故障\n### @all [点击](javascript:alert(1)) ' + '长'.repeat(2000) }, recipientName: '张文静' });
  const text = cardMarkdown(card, 'user-4');
  assert.doesNotMatch(text, /<img|\[假按钮\]\(|\[点击\]\(|@all/); assert.match(text, /@user-4/);
  assert.ok(Buffer.byteLength(text) < 4096); assert.equal((text.match(/@/g) || []).length, 1);
});

test('MySQL task transaction rolls back when its outbox insert fails and never sends before commit', async () => {
  const task = await create(); calls = [];
  const settings = await record('settings');
  const steps = [];
  setPoolForTests({
    query: async (sql, params) => {
      if (sql === 'SELECT body FROM work_report_task') return [[{ body: JSON.stringify(task) }]];
      if (sql.includes('SELECT body FROM work_center_record WHERE id') && params[0] === 'settings') return [[{ body: JSON.stringify(settings) }]];
      return [[]];
    },
    getConnection: async () => ({
      beginTransaction: async () => { steps.push('begin'); },
      query: async (sql, params) => {
        if (sql.includes('FOR UPDATE')) return [[{ body: JSON.stringify(task) }]];
        if (sql.startsWith('INSERT INTO work_report_task ')) { steps.push('task'); assert.equal(JSON.parse(params[1]).status, '进行中'); return [{}]; }
        if (sql.startsWith('INSERT IGNORE INTO work_center_record')) { steps.push('outbox'); throw new Error('outbox insert failed'); }
        throw new Error('Unexpected transaction SQL');
      },
      commit: async () => { steps.push('commit'); }, rollback: async () => { steps.push('rollback'); }, release: () => { steps.push('release'); }
    })
  });
  await assert.rejects(() => actTask(op, { id: task.id, revision: task.revision, action: 'start' }), /outbox insert failed/);
  assert.deepEqual(steps, ['begin','task','outbox','rollback','release']);
  assert.equal(calls.length, 0); assert.equal(exportTasks().tasks[0].status, '待执行');
});

const api = data => ({ ok: true, json: async () => data });
function credentials() {
  process.env.DINGTALK_CLIENT_ID = 'dingtest'; process.env.DINGTALK_CLIENT_SECRET = 'secret-test';
  process.env.DINGTALK_AGENT_ID = '100'; process.env.DINGTALK_NOTIFY_WEBHOOK = 'https://oapi.dingtalk.com/robot/send?access_token=test-token-12345';
}
const sample = () => noticeCard('returned', { task: { title: '核对活动价', due_at: '2026-11-23T18:00', reviewer_name: '杨润泽' },
  recipientName: '张文静', event: { note: '缺少两个 SPU' }, url: workLink('taskMine', 'notice-test-task') });
async function sendSample() { const c = sample(); return sendTaskNotice('ding-4', c.title, '', c.url, c.button, c.recipientName, c); }

test('official work inbox receives the native card without duplicating robot or group messages', async () => {
  credentials(); const sent = [];
  setDingTransport(async (url, options) => { if (url.includes('accessToken')) return api({ accessToken: 'token' }); assert.match(url, /asyncsend_v2/); sent.push(JSON.parse(options.body)); return api({ errcode: 0, task_id: 123 }); });
  assert.equal(await sendSample(), 'work'); assert.equal(sent.length, 1);
  assert.equal(sent[0].msg.msgtype, 'action_card'); assert.equal(sent[0].userid_list, 'ding-4');
  const param = sent[0].msg.action_card; assert.equal(param.single_title, '查看修改要求'); assert.match(param.single_url, /task=notice-test-task/);
  assert.match(param.markdown, /甄选未来 · 工作中心/); assert.match(param.markdown, /缺少两个 SPU/);
});

test('work notification HTTP failure, rejection and missing receipt fall back to a native robot card', async () => {
  for (const response of [{ ok: false, json: async () => ({ errcode: 0, task_id: 123 }) }, api({ errcode: 88 }), api({ errcode: 0 })]) {
    credentials(); const sent = [];
    setDingTransport(async (url, options) => { if (url.includes('accessToken')) return api({ accessToken: 'token' });
      sent.push(JSON.parse(options.body)); return url.includes('asyncsend_v2') ? response : api({ processQueryKey: 'accepted' }); });
    assert.equal(await sendSample(), 'robot'); assert.equal(sent.length, 2);
    assert.equal(sent[0].msg.msgtype, 'action_card'); assert.equal(sent[1].msgKey, 'sampleActionCard');
    assert.equal(JSON.parse(sent[1].msgParam).singleTitle, '查看修改要求');
  }
});

test('test-notification action follows the same official work inbox and reports the actual channel', async () => {
  credentials(); const urls = [];
  setDingTransport(async url => { urls.push(url); return url.includes('accessToken') ? api({ accessToken: 'token' }) : api({ errcode: 0, task_id: 123 }); });
  const result = await popupTo('ding-4', '张文静'); assert.equal(result.ok, true); assert.equal(result.channel, 'work');
  assert.equal(urls.filter(url => !url.includes('accessToken')).length, 1); assert.match(urls.at(-1), /asyncsend_v2/);
  assert.equal((await popupTo('')).ok, false); assert.equal(urls.length, 2);
});

test('robot invalid recipients cannot count as success after work notification rejection', async () => {
  credentials(); let groupCalls = 0;
  setDingTransport(async url => {
    if (url.includes('accessToken')) return api({ accessToken: 'token' });
    if (url.includes('asyncsend_v2')) return api({ errcode: 88 });
    if (url.includes('oToMessages')) return api({ processQueryKey: 'accepted', invalidStaffIdList: ['ding-4'] });
    groupCalls++; return api({ errcode: 0 });
  });
  assert.equal(await sendSample(), 'at'); assert.equal(groupCalls, 1);
});

test('group fallback preserves real targeted @ and formatted content; malformed acknowledgements are failures', async () => {
  credentials(); let group;
  setDingTransport(async (url, options) => {
    if (url.includes('accessToken')) return api({ accessToken: 'token' });
    if (url.includes('/robot/send?')) { group = JSON.parse(options.body); return api({ errcode: 0 }); }
    return api({ code: 'denied', errcode: 88 });
  });
  assert.equal(await sendSample(), 'at'); assert.equal(group.msgtype, 'markdown');
  assert.deepEqual(group.at, { atUserIds: ['ding-4'], isAtAll: false });
  assert.match(group.markdown.text, /@ding-4/); assert.match(group.markdown.text, /\[查看修改要求\]\(https:/);
  for (const payload of [{}, null, { errcode: 310000 }]) {
    setDingTransport(async url => url.includes('accessToken') ? api({ accessToken: 'token' }) : api(payload));
    await assert.rejects(sendSample, /钉钉接口失败/);
  }
});
