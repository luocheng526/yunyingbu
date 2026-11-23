import { orgPeople, matchPerson } from './store.js';
import { loadOrg } from './diary.js';
import { settings, fault, day } from './center-db.js';

export function normalizedRole(role) {
  if (['经理','总监'].includes(role)) return '经理';
  if (['主管','主管/储备'].includes(role)) return '主管';
  if (['运营','店长'].includes(role)) return '运营';
  if (['助理','运营助理'].includes(role)) return '助理';
  return '员工';
}
export async function access(user) {
  const [listed, bundle, config, matched] = await Promise.all([orgPeople(), loadOrg(), settings(), matchPerson(user)]);
  const people = listed.map(person => {
    const original = bundle.people.find(p => Number(p.id) === Number(person.id)) || {};
    return { ...person, id: String(person.id), managerId: String(original.managerId || ''), role: config.roleOverrides[person.id] || normalizedRole(person.role), orgRole: person.role };
  });
  const byId = new Map(people.map(p => [p.id, p]));
  for (const person of people) {
    let lead = null;
    const override = config.teamOverrides[person.id];
    if (override) lead = byId.get(String(override));
    if (!lead && person.role === '主管') lead = person;
    if (!lead && person.supervisor) {
      const names = people.filter(p => p.name === person.supervisor && p.role === '主管');
      if (names.length === 1) lead = names[0];
    }
    let parent = byId.get(person.managerId); const seen = new Set([person.id]);
    while (!lead && parent && !seen.has(parent.id)) {
      seen.add(parent.id); if (parent.role === '主管') lead = parent;
      parent = byId.get(parent.managerId);
    }
    person.teamId = lead ? 'team-' + lead.id : '';
    person.teamName = lead ? lead.name + '团队' : '未关联团队';
    person.supervisorId = lead?.id || '';
  }
  const login = String(user?.username || '').trim();
  const exact = people.filter(p => p.username === login);
  const candidates = exact.length ? exact : people.filter(p => p.name === login);
  const legacyAdmin = ['罗成','luocheng'].includes(login) && matched && [matched.username, matched.name, matched.employeeNo].some(v => ['罗成','luocheng','XM001'].includes(v));
  const me = candidates.length === 1 ? candidates[0] : legacyAdmin ? byId.get(String(matched.id)) : null;
  if (!me || me.status === '离职') fault('当前账号未关联在职员工，请先核对组织中心', 403);
  // Compatibility with the existing work administrator, without granting system admin rights.
  if (legacyAdmin) { me.role = '经理'; if(me.name==='管理员') me.name='罗成'; }
  const active = people.filter(p => p.status !== '离职');
  const ctx = { me, people, active, byId, config, bundle, manager: me.role === '经理' };
  ctx.visiblePeople = active.filter(p => canSeePerson(ctx, p));
  return ctx;
}
export function canSeePerson(ctx, person) {
  return ctx.manager || person.id === ctx.me.id || (ctx.me.role === '主管' && Boolean(ctx.me.teamId) && person.teamId === ctx.me.teamId);
}
export function collaboration(ctx, target) {
  const today = day();
  return ctx.config.collaborations.some(c => String(c.operatorId) === ctx.me.id && String(c.assistantId) === target.id && c.enabled !== false && (!c.startOn || c.startOn <= today) && (!c.endOn || c.endOn >= today));
}
export function canAssign(ctx, target) {
  if (!target || target.status === '离职') return false;
  if (ctx.manager) return target.id !== ctx.me.id;
  if (ctx.me.role === '主管') return ['运营','助理'].includes(target.role) && Boolean(ctx.me.teamId) && target.teamId === ctx.me.teamId;
  return ctx.me.role === '运营' && target.role === '助理' && collaboration(ctx, target);
}
export function taskVisible(ctx, task) {
  return ctx.manager || [task.publisher, task.assignee, task.reviewer, ...(task.collaborators || [])].includes(ctx.me.id)
    || (ctx.me.role === '主管' && task.team_id === ctx.me.teamId && Boolean(ctx.me.teamId));
}
export function canEditTask(ctx, task) { return ctx.manager || task.publisher === ctx.me.id; }
export function allowedReviewers(ctx, target) {
  if (!target) return [];
  if (ctx.manager) return ctx.active.filter(p => p.id !== target.id && (p.id === ctx.me.id || p.id === target.supervisorId));
  return [ctx.me];
}
export function taskScope(task) {
  // Old tasks do not have a reliable historical team; keep them explicit until reviewed.
  return task.team_id ? task : { ...task, team_id: '', team_name: '历史任务 · 团队待确认', supervisor_id: '', legacy: true };
}
