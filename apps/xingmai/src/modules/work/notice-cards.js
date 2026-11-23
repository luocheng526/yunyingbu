// One content model for the site inbox, DingTalk robot and work notifications.
export const NOTICE_TYPES = Object.freeze({
  assigned: ['任务执行', '待执行', '你有一项新任务', '查看任务', 'blue'],
  started: ['任务执行', '进行中', '任务已开始执行', '查看进展', 'blue'],
  progress: ['任务执行', '进行中', '任务进度已更新', '查看进展', 'blue'],
  blocked: ['任务执行', '需要支持', '任务执行遇到阻碍', '查看问题', 'orange'],
  task_due: ['定时催办', '即将到期', '任务即将到期', '提交成果', 'orange'],
  task_overdue: ['定时催办', '已逾期', '任务已逾期，请尽快处理', '处理任务', 'red'],
  review_late: ['定时催办', '验收超时', '有一项成果等待你验收', '立即验收', 'orange'],
  daily_missing: ['定时催办', '待提交', '今天的日报还没提交', '去填日报', 'orange'],
  submitted: ['成果验收', '待验收', '任务成果已提交', '立即验收', 'blue'],
  returned: ['成果验收', '待修改', '任务已退回，请修改', '查看修改要求', 'orange'],
  resubmitted: ['成果验收', '再次待验收', '修改后的成果已重新提交', '再次验收', 'blue'],
  approved: ['成果验收', '已完成', '任务验收通过', '查看成果', 'green'],
  reassigned: ['任务变更', '负责人变更', '任务负责人已调整', '查看任务', 'blue'],
  rescheduled: ['任务变更', '时间变更', '任务截止时间已调整', '查看新安排', 'orange'],
  requirements: ['任务变更', '要求变更', '任务要求已更新', '查看变更', 'blue'],
  cancelled: ['任务变更', '已取消', '任务已取消', '查看任务', 'gray']
});

const clean = (value, max = 120) => {
  const text = String(value ?? '').replace(/\p{Cc}/gu, ' ').replace(/\s+/g, ' ').trim();
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
};
export const noticeTime = value => clean(value, 19).replace('T', ' ');
const field = (label, value) => ({ label, value: clean(value, 100) });
const changeLabels = { title: '标题', description: '任务说明', criteria: '验收要求', priority: '优先级', reviewer: '验收人', assignee: '负责人', due_at: '截止时间' };

export function noticeCard(kind, { task = {}, original = {}, event = {}, recipientName = '', role = '', date = '', deadline = '', reviewHours = '', url = '' } = {}) {
  const spec = NOTICE_TYPES[kind];
  if (!spec) throw new Error('未知工作通知类型');
  const [category, status, title, button, tone] = spec;
  const card = { kind, category, status, title, button, tone, url, recipientName: clean(recipientName, 24),
    taskTitle: clean(task.title, 160), fields: [], noteLabel: '', note: '', description: '', footer: '工作汇报 · 点击下方入口处理' };
  const add = (label, value) => { if (value !== undefined && value !== null && value !== '') card.fields.push(field(label, value)); };
  if (kind === 'daily_missing') {
    card.description = '请记录今天的工作进展与明日安排。';
    add('日报日期', date); add('提交时间', deadline); add('提交状态', '尚未提交');
    return card;
  }
  if (kind === 'reassigned') {
    add('原负责人', original.assignee_name); add('新负责人', task.assignee_name);
    card.description = role === 'former' ? '此任务已转交他人，你无需继续执行。' : '请按最新分工查看任务并安排执行。';
    if (role === 'former') card.button = '打开工作中心';
  } else if (kind === 'rescheduled') {
    add('原截止', noticeTime(original.due_at)); add('新截止', noticeTime(task.due_at));
  } else if (kind === 'requirements') {
    add('变更项目', Object.keys(event.changes || {}).map(key => changeLabels[key]).filter(Boolean).join('、'));
    if (event.changes?.reviewer) { add('原验收人', original.reviewer_name); add('新验收人', task.reviewer_name); }
    if (role === 'formerReviewer') { card.description = '验收人已调整，你无需继续验收。'; card.button = '打开工作中心'; }
  } else {
    add(kind === 'assigned' ? '发布人' : kind === 'approved' || kind === 'returned' ? '验收人' : '负责人',
      kind === 'assigned' ? task.publisher_name : kind === 'approved' || kind === 'returned' ? task.reviewer_name : task.assignee_name);
    if (['progress', 'blocked'].includes(kind)) add('当前进度', `${Number(task.progress) || 0}%`);
    if (['submitted', 'resubmitted', 'review_late'].includes(kind)) add('提交时间', noticeTime(task.submitted_at));
    if (kind === 'review_late') add('验收时限', `${reviewHours} 小时`);
    if (kind === 'approved') add('完成时间', noticeTime(task.completed_at));
  }
  if (!['rescheduled', 'approved', 'cancelled'].includes(kind)) add('截止', noticeTime(task.due_at));
  if (kind === 'assigned') add('优先级', task.priority || '普通');
  if (kind === 'cancelled') { add('操作人', event.actor_name); card.description = '无需继续执行或验收此任务。'; }
  if (kind === 'task_due') card.description = '请在截止前提交成果。';
  if (kind === 'task_overdue') card.description = '请尽快提交成果；如有阻碍，请更新进度说明。';
  const label = { returned: '修改要求', blocked: '遇到的问题', submitted: '成果说明', resubmitted: '修改说明', approved: '验收反馈', progress: '进度说明', reassigned: '调整原因', rescheduled: '调整原因', requirements: '变更说明', cancelled: '取消原因' }[kind];
  if (label && event.note) { card.noteLabel = label; card.note = clean(event.note, 200); }
  if (event.changes?.assignee && Object.keys(event.changes).length > 1) card.description += ' 同时调整了' + Object.keys(event.changes).filter(k => k !== 'assignee').map(k => changeLabels[k]).filter(Boolean).join('、') + '。';
  return card;
}

// User content never becomes Markdown links, HTML or extra @ mentions.
const md = (value, max = 80) => clean(value, max).replace(/&/g, '＆').replace(/</g, '＜').replace(/>/g, '＞').replace(/@/g, '＠').replace(/([\\`*_{}[\]()#+.!|~-])/g, '\\$1');
export function cardMarkdown(card, mentionId = '') {
  const who = mentionId ? `@${String(mentionId).replace(/[^\w.-]/g, '')}` : card.recipientName ? `@${md(card.recipientName, 24)}` : '';
  return [
    '#### 甄选未来 · 工作中心',
    `${md(card.category || '工作通知', 12)} · **${md(card.status || '请查看', 12)}**`,
    `### ${md(card.title, 40)}`,
    who,
    card.taskTitle ? `**${md(card.taskTitle, 64)}**` : '',
    ...((card.fields || []).slice(0, 5).map(f => `> ${md(f.label, 10)}：${md(f.value, 48)}`)),
    card.description ? md(card.description, 90) : '',
    card.note ? `**${md(card.noteLabel || '说明', 10)}**\n\n${md(card.note, 90)}` : '',
    '工作汇报 · 详情以工作中心当前记录为准'
  ].filter(Boolean).join('\n\n');
}
export function cardPlainText(card) {
  return [card.taskTitle, card.description, ...card.fields.map(f => `${f.label} ${f.value}`), card.noteLabel, card.note].filter(Boolean).join(' · ');
}
export function legacyCard(title, text, url, button, name) {
  return { title: clean(title, 64), recipientName: clean(name, 24), category: '工作通知', status: '请查看',
    taskTitle: '', fields: [], note: clean(text, 200), noteLabel: '通知内容', url, button };
}
