import { orgPeople, matchPerson, orgBoardName, ORG_BOARDS } from './store.js';
import { loadOrg } from './diary.js';
import { settings, fault, day } from './center-db.js';

export const WORK_ROLES=['总监','经理','主管','运营','运营助理','员工'];
export const roleLevel=role=>({总监:5,经理:4,主管:3,运营:2,运营助理:1,员工:1})[role]||1;
export function normalizedRole(role){
  const value=String(role||'').trim();
  if(value.endsWith('总监'))return '总监';
  if(value.endsWith('经理'))return '经理';
  if(value.endsWith('主管')||value==='主管/储备')return '主管';
  if(['运营','店长'].includes(value))return '运营';
  if(['助理','运营助理'].includes(value))return '运营助理';
  return '员工';
}
const owner=p=>p.employeeNo==='XM001'&&['罗成','管理员'].includes(p.name)||['罗成','luocheng'].includes(p.username)&&['罗成','管理员'].includes(p.name);
const cleanDepartment=p=>!p.department||['其他','未分配'].includes(p.department)?orgBoardName(p.board)||'未归属部门':p.department;
export async function access(user){
  const [listed,bundle,config,matched]=await Promise.all([orgPeople(),loadOrg(),settings(),matchPerson(user)]);
  const people=listed.map(person=>{
    const original=bundle.people.find(p=>String(p.id)===String(person.id))||{};
    const p={...person,id:String(person.id),managerId:String(original.managerId||''),orgRole:person.role,
      role:normalizedRole(config.roleOverrides[person.id]||person.role),department:cleanDepartment(person),boardName:orgBoardName(person.board)||person.board||'未归属板块'};
    // Business director rights do not grant system administrator rights.
    if(owner(p)){p.role='总监';if(p.name==='管理员')p.name='罗成';}
    return p;
  });
  const byId=new Map(people.map(p=>[p.id,p]));
  const named=(name,role)=>{const rows=people.filter(p=>p.name===name&&p.role===role&&p.status!=='离职');return rows.length===1?rows[0]:null;};
  const higher=(p,candidate)=>candidate&&candidate.id!==p.id&&candidate.status!=='离职'&&roleLevel(candidate.role)>roleLevel(p.role);
  for(const p of people){
    let parent=null;const explicit=config.reportingOverrides[p.id];
    if(explicit&&higher(p,byId.get(String(explicit))))parent=byId.get(String(explicit));
    if(!parent&&higher(p,byId.get(String(config.teamOverrides[p.id]||''))))parent=byId.get(String(config.teamOverrides[p.id]));
    if(!parent&&higher(p,named(p.supervisor,'主管')))parent=named(p.supervisor,'主管');
    let original=byId.get(p.managerId);const seen=new Set([p.id]);
    while(!parent&&original&&!seen.has(original.id)){seen.add(original.id);if(higher(p,original))parent=original;original=byId.get(original.managerId);}
    if(!parent&&higher(p,named(p.operator,'运营')))parent=named(p.operator,'运营');
    if(!parent&&higher(p,named(p.lineManager,'经理')))parent=named(p.lineManager,'经理');
    if(!parent&&higher(p,named(p.director,'总监')))parent=named(p.director,'总监');
    p.parentId=parent?.id||'';
  }
  for(const p of people){
    const ancestors=[];let next=byId.get(p.parentId);const seen=new Set([p.id]);
    while(next&&!seen.has(next.id)){seen.add(next.id);ancestors.push(next);next=byId.get(next.parentId);}
    p.ancestorIds=ancestors.map(a=>a.id);p.scopeIds=ancestors.filter(a=>['总监','经理','主管'].includes(a.role)).map(a=>a.id);p.managerIds=ancestors.filter(a=>a.role==='经理').map(a=>a.id);
    const lead=p.role==='主管'?p:ancestors.find(a=>a.role==='主管'),manager=p.role==='经理'?p:ancestors.find(a=>a.role==='经理');
    p.supervisorId=lead?.id||'';p.teamLeaderId=lead?.id||manager?.id||'';p.teamKind=lead?'主管团队':manager?'经理直属团队':'部门';
    p.teamId=p.role==='总监'?'':lead?'team-'+lead.id:manager?'manager-'+manager.id:'department:'+encodeURIComponent(p.board+':'+p.department);
    p.teamName=p.role==='总监'?'公司管理':lead?lead.name+'团队':manager?manager.name+'直属团队':p.department;
  }
  const login=String(user?.username||'').trim(),exact=people.filter(p=>p.username===login),candidates=exact.length?exact:people.filter(p=>p.name===login);
  const legacyOwner=['罗成','luocheng'].includes(login)&&matched&&[matched.username,matched.name,matched.employeeNo].some(v=>['罗成','luocheng','XM001'].includes(v));
  const me=candidates.length===1?candidates[0]:legacyOwner?byId.get(String(matched.id)):null;
  if(!me||me.status==='离职')fault('当前账号未关联在职员工，请先核对组织中心',403);
  const active=people.filter(p=>p.status!=='离职'),ctx={me,people,active,byId,config,bundle,director:me.role==='总监',manager:me.role==='经理',management:['总监','经理','主管'].includes(me.role)};
  ctx.visiblePeople=active.filter(p=>canSeePerson(ctx,p));ctx.boards=ORG_BOARDS.filter(b=>ctx.director||ctx.visiblePeople.some(p=>p.board===b.code));return ctx;
}
export function canSeePerson(ctx,p){return Boolean(p)&&(ctx.director||p.id===ctx.me.id||(ctx.management&&p.ancestorIds.includes(ctx.me.id)));}
export function collaboration(ctx,target){const today=day();return ctx.config.collaborations.some(c=>String(c.operatorId)===ctx.me.id&&String(c.assistantId)===target.id&&c.enabled!==false&&(!c.startOn||c.startOn<=today)&&(!c.endOn||c.endOn>=today));}
export function canAssign(ctx,target){
  if(!target||target.status==='离职'||target.id===ctx.me.id)return false;
  if(ctx.director)return true;
  if(ctx.manager||ctx.me.role==='主管')return roleLevel(target.role)<roleLevel(ctx.me.role)&&canSeePerson(ctx,target);
  return ctx.me.role==='运营'&&target.role==='运营助理'&&collaboration(ctx,target);
}
// Saved scopes remain authoritative after a person changes team or manager.
export function managedRecord(ctx,row){
  if(ctx.director)return true;if(!ctx.management)return false;
  const scope=row.scope_ids??row.scopeIds;if(Array.isArray(scope))return scope.includes(ctx.me.id);
  const team=row.team_id??row.teamId;if(ctx.me.role==='主管')return team===ctx.me.teamId&&Boolean(team);
  return Boolean(team)&&ctx.visiblePeople.some(p=>p.teamId===team);
}
export function recordVisible(ctx,row){return row.personId===ctx.me.id||managedRecord(ctx,row);}
export function taskVisible(ctx,t){return [t.publisher,t.assignee,t.reviewer,...(t.collaborators||[])].includes(ctx.me.id)||managedRecord(ctx,t);}
export function canEditTask(ctx,t){return ctx.director||t.publisher===ctx.me.id||(ctx.manager&&managedRecord(ctx,t)&&['主管','运营','助理','运营助理','员工'].includes(t.publisher_role));}
export function canReviewTask(ctx,t){return ctx.director||(ctx.manager&&managedRecord(ctx,t));}
export function allowedReviewers(ctx,target){
  if(!target)return [];
  if(ctx.director||ctx.manager)return ctx.active.filter(p=>p.id!==target.id&&(p.id===ctx.me.id||(target.ancestorIds.includes(p.id)&&['经理','主管'].includes(p.role)&&roleLevel(p.role)<roleLevel(ctx.me.role))));
  return [ctx.me];
}
export function reviewerOptions(ctx){const ids=new Set([ctx.me.id]);for(const p of ctx.active.filter(p=>canAssign(ctx,p)))for(const r of allowedReviewers(ctx,p))ids.add(r.id);return ctx.active.filter(p=>ids.has(p.id));}
export function scopeSnapshot(p){return {scopeIds:[...p.scopeIds],managerIds:[...p.managerIds],department:p.department,board:p.board,teamLeaderId:p.teamLeaderId,teamKind:p.teamKind};}
export function taskScope(task){return task.team_id?task:{...task,team_id:'',team_name:task.created_at?'团队待确认':'历史任务 · 团队待确认',supervisor_id:'',legacy:!task.created_at};}
