import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { access, canAssign, canEditTask, canReviewTask, allowedReviewers, reviewerOptions, recordVisible, managedRecord, scopeSnapshot, WORK_ROLES, normalizedRole, roleLevel } from './center-access.js';
import { visibleTasks } from './tasks.js';
import { records, record, writeRecord, fault, copy, stamp, day, validDay } from './center-db.js';
import { eligibility } from './center-reporting.js';
import { reminderStatus } from './reminders.js';
import { exportWorkCenter } from './center-export.js';

const MAX_RANGE=366;
const clean=(v,n=4000)=>String(v||'').trim().slice(0,n);
const stateOf=t=>t.status==='待执行'?'待开始':t.status==='待检查'?'待验收':t.status==='已退回'?'进行中':t.status;
const terminal=t=>['已完成','已取消'].includes(t.status);
const time=v=>Date.parse(/Z$|[+-]\d\d:\d\d$/.test(v||'')?v:v+'+08:00');
const localDay=v=>v ? (/Z$/.test(v)?day(new Date(v)):v.slice(0,10)) : '';
const within=(value,from,to)=>value && localDay(value)>=from && localDay(value)<=to;
const rate=(a,b)=>b?Math.round(a/b*1000)/10:null;
function range(query={}) {
  const from=String(query.from||query.date||day()), to=String(query.to||query.date||from);
  if(!validDay(from)||!validDay(to)||from>to||(Date.parse(to)-Date.parse(from))/86400000>MAX_RANGE) fault('日期范围应有效且不超过一年');
  return {from,to};
}
function visibleRecord(ctx,r) {
  return recordVisible(ctx,r);
}
function personSnapshot(p) {return {personId:p.id,personName:p.name,role:p.role,teamId:p.teamId,teamName:p.teamName,supervisorId:p.supervisorId,...scopeSnapshot(p)};}
function actionOptions(ctx,t) {
  const actions=[];
  if(t.assignee===ctx.me.id&&!terminal(t)&&t.status!=='待检查') {
    if(['待执行','已退回'].includes(t.status))actions.push('start');
    actions.push('progress','submit');
  }
  if(t.reviewer===ctx.me.id&&t.status==='待检查')actions.push('approve','return');
  if(canEditTask(ctx,t)&&!terminal(t))actions.push('edit','cancel');
  if((ctx.director||ctx.manager&&managedRecord(ctx,t)||t.assignee===ctx.me.id)&&!terminal(t)&&t.status!=='待检查'&&ctx.active.some(p=>canAssign(ctx,p)))actions.push('split');
  if(canReviewTask(ctx,t)&&t.status==='已完成')actions.push('review');
  if(ctx.director&&!t.team_id)actions.push('confirmTeam');
  return actions;
}
function decorate(ctx,t,now=Date.now()) {
  const overdue=!terminal(t)&&time(t.due_at)<now;
  const reviewHours=t.status==='待检查'&&t.submitted_at?Math.max(0,(now-time(t.submitted_at))/3600000):0;
  return {...t,state:stateOf(t),overdue,reviewHours:Math.floor(reviewHours),reviewLate:reviewHours>ctx.config.reviewHours,
    stale:!terminal(t)&&['紧急','高'].includes(t.priority)&&(now-time(t.updated_at))/3600000>ctx.config.staleHours,
    publisherName:t.publisher_name||ctx.byId.get(t.publisher)?.name||'历史发布人',assigneeName:t.assignee_name||ctx.byId.get(t.assignee)?.name||'历史员工',reviewerName:t.reviewer_name||ctx.byId.get(t.reviewer)?.name||'历史验收人',
    actions:actionOptions(ctx,t)};
}
function stats(tasks,from,to) {
  const active=tasks.filter(t=>t.status!=='已取消');
  const due=active.filter(t=>within(t.due_at,from,to));
  const completed=due.filter(t=>t.status==='已完成'&&localDay(t.completed_at)<=to);
  const submitted=due.filter(t=>t.first_submitted_at&&time(t.first_submitted_at)<=time(t.due_at));
  const accepted=due.filter(t=>t.accepted_submission_at&&time(t.accepted_submission_at)<=time(t.due_at));
  const reviews=active.flatMap(t=>(t.events||[]).filter(e=>within(e.at,from,to)&&['检查通过','退回修改'].includes(e.action)));
  return {total:active.length,roots:active.filter(t=>!t.parent_id).length,children:active.filter(t=>t.parent_id).length,
    created:active.filter(t=>within(t.created_at,from,to)).length,due:due.length,completed:completed.length,
    completedEvents:active.filter(t=>within(t.completed_at,from,to)).length,pending:active.filter(t=>t.status==='待检查').length,
    overdue:active.filter(t=>t.overdue).length,completionRate:rate(completed.length,due.length),onTimeSubmissionRate:rate(submitted.length,due.length),validSubmissionRate:rate(accepted.length,due.length),onTimeCompletionRate:rate(due.filter(t=>t.completed_at&&time(t.completed_at)<=time(t.due_at)).length,due.length),
    overdueRate:rate(due.filter(t=>t.overdue).length,due.length),reviewPassRate:rate(reviews.filter(e=>e.action==='检查通过').length,reviews.length),
    returnCount:active.reduce((n,t)=>n+(t.return_count||0),0)};
}
async function dailyDraft(ctx,allTasks,date,workRows,dailyRows=[],issueRows=[]) {
  const relevant=allTasks.filter(t=>localDay(t.created_at||t.events?.[0]?.at)<=date&&(within(t.created_at,date,date)||within(t.completed_at,date,date)||within(t.submitted_at,date,date)||(t.events||[]).some(e=>within(e.at,date,date))||(!terminal(t)&&localDay(t.start_at)<=date)));
  const snapshot=t=>({id:t.id,title:t.title,status:stateOf(t),publisher:t.publisher,assignee:t.assignee,assigneeName:t.assignee_name||ctx.byId.get(t.assignee)?.name||'',reviewer:t.reviewer,teamId:t.team_id,shopId:t.shop_id||'',shopName:t.shop_name||'',dueAt:t.due_at,progress:t.progress||0,completedAt:t.completed_at||'',submittedAt:t.submitted_at||''});
  const result={tasks:relevant.filter(t=>[t.assignee,t.publisher,t.reviewer].includes(ctx.me.id)).map(snapshot),work:workRows.filter(w=>w.personId===ctx.me.id&&w.date===date).map(copy)};
  if(['经理','主管'].includes(ctx.me.role)) {
    const absence=await eligibility(ctx,date);
    result.team={id:ctx.me.teamId,name:ctx.me.name+'管理范围',tasks:relevant.filter(t=>managedRecord(ctx,t)||t.assignee===ctx.me.id).map(snapshot),
      work:workRows.filter(w=>visibleRecord(ctx,w)&&w.date===date).map(copy),
      issues:issueRows.filter(i=>visibleRecord(ctx,i)&&i.date<=date&&(i.date===date||i.status!=='已解决')).map(copy),
      members:ctx.visiblePeople.map(p=>({id:p.id,name:p.name,required:Boolean(absence.get(p.id)?.required),submitted:Boolean(dailyRows.find(r=>r.personId===p.id&&r.date===date&&r.submittedAt))}))};
  }
  return result;
}
export async function centerData(user,query={}) {
  const {ctx,rows}=await visibleTasks(user); const {from,to}=range(query);
  const [daily,works,issues,notices,absence]=await Promise.all([records('daily'),records('work'),records('issue'),records('notice'),eligibility(ctx,to)]);
  let tasks=rows.map(t=>decorate(ctx,t)).filter(t=>localDay(t.created_at||t.events?.[0]?.at)<=to && (within(t.due_at,from,to)||within(t.created_at||t.events?.[0]?.at,from,to)||within(t.completed_at,from,to)||(!terminal(t)&&localDay(t.start_at)<=to)));
  const relevant=(t,includePerson=true)=>(!query.team||t.team_id===query.team)&&(!includePerson||!query.person||t.assignee===query.person)&&(!query.shop||t.shop_id===query.shop)&&(!query.role||ctx.byId.get(t.assignee)?.role===query.role)&&(!query.department||(t.department||ctx.byId.get(t.assignee)?.department)===query.department)&&(!query.board||(t.board||ctx.byId.get(t.assignee)?.board)===query.board);
  const publishedTasks=query.person?tasks.filter(t=>t.publisher===query.person&&relevant(t,false)):[];
  tasks=tasks.filter(t=>relevant(t));
  const filteredPeople=ctx.visiblePeople.filter(p=>(!query.team||p.teamId===query.team)&&(!query.person||p.id===query.person)&&(!query.role||p.role===query.role)&&(!query.department||p.department===query.department)&&(!query.board||p.board===query.board)&&(!query.shop||p.visibleShops.includes(ctx.bundle.shops.find(s=>String(s.id)===query.shop)?.name)));
  const recordMatches=r=>(!query.team||r.teamId===query.team)&&(!query.person||r.personId===query.person)&&(!query.role||normalizedRole(r.role||ctx.byId.get(r.personId)?.role)===query.role)&&(!query.department||(r.department||ctx.byId.get(r.personId)?.department)===query.department)&&(!query.board||(r.board||ctx.byId.get(r.personId)?.board)===query.board)&&(!query.shop||r.shopId===query.shop||r.snapshot?.tasks?.some(t=>t.shopId===query.shop)||r.taskId&&tasks.some(t=>t.id===r.taskId&&t.shop_id===query.shop));
  const visibleDaily=daily.filter(r=>visibleRecord(ctx,r)&&recordMatches(r)&&r.date>=from&&r.date<=to);
  const visibleWork=works.filter(r=>visibleRecord(ctx,r)&&recordMatches(r)&&r.date>=from&&r.date<=to);
  const visibleIssues=issues.filter(r=>visibleRecord(ctx,r)&&recordMatches(r)&&r.date<=to);
  const people=filteredPeople.map(p=>{
    const own=tasks.filter(t=>t.assignee===p.id), report=daily.find(r=>r.personId===p.id&&r.date===to);
    const obligation=absence.get(p.id)||{required:false,reason:'无需提交'};
    return {...p,metrics:stats(own,from,to),reportStatus:report?.submittedAt?(report.late?'迟交':'已提交'):obligation.required?'未提交':'无需提交',reportReason:obligation.reason,required:obligation.required,
      received:own.length,published:tasks.filter(t=>t.publisher===p.id).length,workCount:visibleWork.filter(w=>w.personId===p.id).length};
  });
  const teamMap=new Map();
  for(const p of people) if(p.teamId&&!teamMap.has(p.teamId)) teamMap.set(p.teamId,{id:p.teamId,name:p.teamName,supervisorId:p.teamLeaderId,kind:p.teamKind,board:p.board,department:p.department});
  for(const t of tasks) if(t.team_id&&!teamMap.has(t.team_id))teamMap.set(t.team_id,{id:t.team_id,name:t.team_name,supervisorId:t.team_leader_id||t.supervisor_id,kind:t.team_kind||'主管团队',board:t.board,department:t.department});
  const teams=[...teamMap.values()].map(team=>{
    const teamTasks=tasks.filter(t=>t.team_id===team.id), members=people.filter(p=>p.teamId===team.id);
    const should=members.filter(p=>p.required).length,done=members.filter(p=>p.required&&['已提交','迟交'].includes(p.reportStatus)).length;
    const events=teamTasks.flatMap(t=>(t.events||[]).filter(e=>within(e.at,from,to)&&e.actor===team.supervisorId));
    const reviews=teamTasks.flatMap(t=>(t.events||[]).flatMap((e,i)=>{
      if(e.actor!==team.supervisorId||!within(e.at,from,to)||!['检查通过','退回修改'].includes(e.action))return [];
      const submitted=t.events.slice(0,i).reverse().find(prior=>prior.action==='提交检查');
      return [{timely:submitted&&(time(e.at)-time(submitted.at))/3600000<=ctx.config.reviewHours}];
    }));
    const reports=visibleDaily.filter(r=>r.personId===team.supervisorId&&r.date===to&&r.submittedAt);
    const ownIssues=visibleIssues.filter(r=>r.teamId===team.id&&r.date>=from&&r.date<=to);
    return {...team,members:members.length,metrics:stats(teamTasks,from,to),selfPublished:teamTasks.filter(t=>t.publisher===team.supervisorId&&within(t.created_at||t.events?.[0]?.at,from,to)).length,
      directorPublished:teamTasks.filter(t=>t.publisher_role==='总监').length,managerPublished:teamTasks.filter(t=>t.publisher_role==='经理').length,operatorPublished:teamTasks.filter(t=>t.publisher_role==='运营').length,
      accepted:events.filter(e=>e.action==='检查通过').length,reviewed:events.filter(e=>['检查通过','退回修改'].includes(e.action)).length,
      timelyReviewRate:rate(reviews.filter(r=>r.timely).length,reviews.length),issueResolutionRate:rate(ownIssues.filter(i=>i.status==='已解决').length,ownIssues.length),
      issues:ownIssues.length,resolved:ownIssues.filter(i=>i.status==='已解决').length,training:visibleWork.filter(w=>w.personId===team.supervisorId&&w.category==='员工培养').length,
      reportRate:rate(done,should),dailyStatus:reports.length?'已提交':members.find(p=>p.id===team.supervisorId)?.reportStatus||'无需提交'};
  });
  const counts=stats(tasks,from,to);counts.should=people.filter(p=>p.required).length;counts.reported=people.filter(p=>p.required&&['已提交','迟交'].includes(p.reportStatus)).length;counts.missing=counts.should-counts.reported;counts.reportRate=rate(counts.reported,counts.should);
  const alerts=[...tasks.filter(t=>t.overdue||t.reviewLate||t.blocked||t.stale).map(t=>({id:t.id,type:'task',title:t.title,person:t.assigneeName,reason:[t.overdue?'任务逾期':'',t.reviewLate?'验收超时 '+t.reviewHours+' 小时':'',t.blocked?'执行有阻碍':'',t.stale?'重点任务长时间未更新':''].filter(Boolean).join(' · ')})),
    ...people.filter(p=>p.required&&p.reportStatus==='未提交'&&Date.now()>time(to+'T'+ctx.config.deadline)).map(p=>({id:p.id,type:'person',title:p.name+' 尚未提交日报',person:p.name,reason:'截止 '+ctx.config.deadline})),
    ...visibleIssues.filter(i=>i.status!=='已解决'&&i.escalated).map(i=>({id:i.id,type:'issue',title:i.title,person:i.personName,reason:'需要上级协调'}))];
  const currentDaily=daily.find(r=>r.personId===ctx.me.id&&r.date===to)||null;
  const draft=await dailyDraft(ctx,rows,to,works,daily,issues);
  const timeline=[...rows.filter(t=>relevant(t,false)).flatMap(t=>(t.events||[]).filter(e=>within(e.at,from,to)&&(!query.person||[t.assignee,t.publisher,t.reviewer,e.actor].includes(query.person))).map(e=>({at:e.at,action:e.action,title:t.title,actor:ctx.byId.get(e.actor)?.name||e.actor_name||'历史员工',taskId:t.id,note:e.note}))),
    ...visibleWork.filter(w=>!query.person||w.personId===query.person).map(w=>({at:w.createdAt,action:'登记自主工作',title:w.title,actor:w.personName,note:w.result})),
    ...visibleDaily.filter(r=>r.submittedAt&&(!query.person||r.personId===query.person)).map(r=>({at:r.submittedAt,action:'提交日报',title:r.date+' 日报',actor:r.personName}))].sort((a,b)=>time(b.at)-time(a.at));
  const trend=[];for(let d=new Date(from+'T00:00:00Z');day(d)<=to;d=new Date(d.getTime()+86400000)) {const date=d.toISOString().slice(0,10);trend.push({date,created:tasks.filter(t=>within(t.created_at,date,date)).length,completed:tasks.filter(t=>within(t.completed_at,date,date)).length});}
  const departments=ctx.boards.filter(b=>!query.board||b.code===query.board).map(b=>{const members=people.filter(p=>p.board===b.code),boardTasks=tasks.filter(t=>(t.board||ctx.byId.get(t.assignee)?.board)===b.code);return {id:b.code,name:b.name,members:members.length,metrics:stats(boardTasks,from,to),reported:members.filter(p=>p.required&&['已提交','迟交'].includes(p.reportStatus)).length,should:members.filter(p=>p.required).length};});
  const managers=ctx.visiblePeople.filter(p=>p.role==='经理').map(p=>{const managedPeople=people.filter(m=>m.id===p.id||m.ancestorIds.includes(p.id)),ownTasks=tasks.filter(t=>t.assignee===p.id||(t.scope_ids?t.scope_ids.includes(p.id):managedPeople.some(m=>m.teamId===t.team_id)));return {id:p.id,name:p.name,members:managedPeople.length,teams:managedPeople.filter(m=>m.role==='主管').length,metrics:stats(ownTasks,from,to),published:tasks.filter(t=>t.publisher===p.id).length,directorPublished:ownTasks.filter(t=>t.publisher_role==='总监').length};});
  const options={roles:WORK_ROLES,boards:ctx.boards.map(b=>({id:b.code,name:b.name})),departments:[...new Set(ctx.visiblePeople.map(p=>p.department).filter(Boolean))],
    people:ctx.visiblePeople.map(p=>({id:p.id,name:p.name,role:p.role,orgRole:p.orgRole,teamId:p.teamId,teamName:p.teamName,parentId:p.parentId,board:p.board,department:p.department})),
    assignees:ctx.active.filter(p=>canAssign(ctx,p)).map(p=>({id:p.id,name:p.name,role:p.role,teamId:p.teamId,teamName:p.teamName,supervisorId:p.supervisorId,shops:p.visibleShops,reviewerIds:allowedReviewers(ctx,p).map(r=>r.id)})),
    reviewers:reviewerOptions(ctx).map(p=>({id:p.id,name:p.name})),shops:ctx.bundle.shops.filter(s=>s.kind!=='店群'&&(ctx.director||ctx.visiblePeople.some(p=>p.visibleShops.includes(s.name)))).map(s=>({id:String(s.id),name:s.name}))};
  return {ok:true,from,to,today:day(),me:{id:ctx.me.id,name:ctx.me.name,role:ctx.me.role,teamId:ctx.me.teamId},counts,teams,departments,managers,people,tasks,publishedTasks,timeline,trend,alerts,works:visibleWork,issues:visibleIssues,dailies:visibleDaily,draft,currentDaily,notices:notices.filter(n=>n.personId===ctx.me.id),options,
    settings:ctx.director?ctx.config:{categories:ctx.config.categories,taskTemplates:ctx.config.taskTemplates,reportFields:ctx.config.reportFields,deadline:ctx.config.deadline,reviewHours:ctx.config.reviewHours},canManage:ctx.director,canViewManagement:ctx.management,canPublish:options.assignees.length>0};
}
export async function saveDaily(user,input) {
  const {ctx,rows}=await visibleTasks(user);const date=clean(input.date,10);
  if(!validDay(date)||date>day())fault('请选择今天或之前的工作日期');
  const id='daily:'+ctx.me.id+':'+date,previous=await record(id);
  const revision=Number(input.revision)||0;if((previous?.revision||0)!==revision)fault('日报已更新，请刷新',409);
  const now=stamp(), submit=input.submit===true, late=Date.now()>time(date+'T'+ctx.config.deadline);
  if(previous?.submittedAt&&!submit)fault('此日报已正式提交，请使用「提交日报」保存新版本');
  if(submit&&late&&!ctx.config.allowLate&&!previous?.submittedAt)fault('当前规则不允许补交');
  const notes={};for(const [k,v]of Object.entries(input.notes||{}).slice(0,30))notes[clean(k,80)]=clean(v);
  const [workRows,dailyRows,issueRows]=await Promise.all([records('work'),records('daily'),records('issue')]);
  const snapshot=await dailyDraft(ctx,rows,date,workRows,dailyRows,issueRows);
  if(submit&&snapshot.team) {const me=snapshot.team.members.find(p=>p.id===ctx.me.id);if(me)me.submitted=true;}
  const history=copy(previous?.history||[]);if(previous)history.push({...previous,history:undefined});
  return writeRecord('daily',id,{...personSnapshot(ctx.me),date,notes,snapshot,createdAt:previous?.createdAt||now,
    submittedAt:previous?.submittedAt||(submit?now:null),late:previous?.submittedAt?previous.late:submit&&late,
    lastSubmittedAt:submit?now:previous?.lastSubmittedAt||null,history},revision);
}
export async function saveWork(user,input) {
  const ctx=await access(user);const title=clean(input.title,200), date=clean(input.date,10);
  if(!title||!validDay(date)||date>day())fault('请填写事项和有效工作日期');
  const id=clean(input.id,80)||randomUUID(),old=await record(id);
  if(old&&(old.kind!=='work'||old.personId!==ctx.me.id))fault('无权修改此工作',403);
  const shopId=clean(input.shopId,80);if(shopId&&!ctx.bundle.shops.some(s=>String(s.id)===shopId&&ctx.me.visibleShops.includes(s.name)))fault('店铺不在本人职责范围内',403);
  const history=copy(old?.history||[]);if(old)history.push({...old,history:undefined});
  return writeRecord('work',id,{...personSnapshot(ctx.me),title,date,content:clean(input.content),result:clean(input.result),category:clean(input.category,80)||'自主工作',shopId,shopName:ctx.bundle.shops.find(s=>String(s.id)===shopId)?.name||'',completedAt:clean(input.completedAt,40),createdAt:old?.createdAt||stamp(),history},Number(input.revision)||0);
}
export async function saveIssue(user,input) {
  const ctx=await access(user);const id=clean(input.id,80)||randomUUID(),old=await record(id);
  if(old) {
    if(old.kind!=='issue'||!visibleRecord(ctx,old))fault('没有这个问题',404);
    if(!ctx.management&&ctx.me.id!==old.personId)fault('无权处理此问题',403);
    if(!clean(input.resolution))fault('请填写处理措施');
    return writeRecord('issue',id,{...old,status:input.status==='已解决'?'已解决':'处理中',resolution:clean(input.resolution),history:[...(old.history||[]),{at:stamp(),actor:ctx.me.id,resolution:clean(input.resolution),status:input.status}]},Number(input.revision)||0);
  }
  if(!clean(input.title))fault('请填写问题标题');
  if(input.taskId) {const {rows}=await visibleTasks(user);if(!rows.some(t=>t.id===input.taskId))fault('无权关联此任务',403);}
  return writeRecord('issue',id,{...personSnapshot(ctx.me),title:clean(input.title,200),date:day(),createdAt:stamp(),taskId:clean(input.taskId,80),description:clean(input.description),impact:clean(input.impact),attempts:clean(input.attempts),assistance:clean(input.assistance),escalated:Boolean(input.escalated),status:'待处理',history:[]});
}
export async function saveSettings(user,input) {
  const ctx=await access(user);if(!ctx.director)fault('只有总监可以修改工作中心全局设置',403);
  const next=copy(ctx.config),allowed=['categories','roleOverrides','teamOverrides','reportingOverrides','collaborations','taskTemplates','reportRoles','reportMembers','weekdays','restDays','deadline','allowLate','reviewHours','staleHours','requiredAttachmentCategories','reportFields','taskReminders','dailyReminders','dueSoonMinutes','repeatReminderAt'];
  for(const key of allowed)if(Object.hasOwn(input,key))next[key]=copy(input[key]);
  for(const key of ['roleOverrides','teamOverrides','reportingOverrides','reportFields'])if(!next[key]||typeof next[key]!=='object'||Array.isArray(next[key]))fault('设置格式不合法：'+key);
  for(const key of ['reportRoles','reportMembers','requiredAttachmentCategories','taskTemplates'])if(!Array.isArray(next[key]))fault('设置格式不合法：'+key);
  if(typeof next.taskReminders!=='boolean'||typeof next.dailyReminders!=='boolean')fault('提醒开关不合法');
  if(!Number.isInteger(next.dueSoonMinutes)||next.dueSoonMinutes<1||next.dueSoonMinutes>1440)fault('到期前提醒应为 1～1440 分钟');
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(next.repeatReminderAt))fault('每日催办时间不合法');
  if(typeof next.allowLate!=='boolean')fault('补交设置不合法');
  if(next.reportRoles.some(r=>![...WORK_ROLES,'助理'].includes(r))||next.reportMembers.some(id=>!ctx.byId.has(String(id))))fault('日报人员或角色不合法');
  if(next.requiredAttachmentCategories.some(c=>!next.categories?.includes(c)))fault('必传附件分类应属于任务分类');
  for(const fields of Object.values(next.reportFields))if(!Array.isArray(fields)||fields.length>30||fields.some(f=>typeof f!=='string'||!f.trim()||f.length>80))fault('日报字段不合法');
  if(next.taskTemplates.length>100||next.taskTemplates.some(t=>!t||typeof t!=='object'||typeof t.title!=='string'||!t.title.trim()||t.title.length>200||['description','criteria'].some(k=>t[k]!=null&&(typeof t[k]!=='string'||t[k].length>4000))))fault('任务模板不合法');
  if(!Array.isArray(next.categories)||!next.categories.length||next.categories.length>50||next.categories.some(c=>typeof c!=='string'||!c.trim()||c.length>60))fault('分类需要 1～50 个有效名称');
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(next.deadline))fault('日报截止时间不合法');
  if(!Array.isArray(next.weekdays)||next.weekdays.some(n=>!Number.isInteger(n)||n<0||n>6))fault('工作日不合法');
  if(!Array.isArray(next.restDays)||next.restDays.some(d=>!validDay(d)))fault('休息日期不合法');
  for(const key of ['reviewHours','staleHours'])if(!(Number(next[key])>0&&Number(next[key])<=720))fault('提醒时长应为 1～720 小时');
  for(const [id,role] of Object.entries(next.roleOverrides))if(!ctx.byId.has(id)||![...WORK_ROLES,'助理'].includes(role))fault('岗位配置不合法');
  for(const [id,parentId]of Object.entries(next.reportingOverrides)){const child=ctx.byId.get(id),parent=ctx.byId.get(String(parentId));if(!child||parentId&&(!parent||parent.status==='离职'||roleLevel(normalizedRole(next.roleOverrides[parentId]||parent.role))<=roleLevel(normalizedRole(next.roleOverrides[id]||child.role))))fault('直属上级必须是在职的更高层级人员');}
  for(const [id,lead]of Object.entries(next.teamOverrides))if(!ctx.byId.has(id)||lead&&((next.roleOverrides[lead]||ctx.byId.get(String(lead))?.role)!=='主管'))fault('团队应关联主管');
  if(!Array.isArray(next.collaborations))fault('协作授权格式不合法');
  for(const c of next.collaborations)if(!c||typeof c!=='object'||(next.roleOverrides[c.operatorId]||ctx.byId.get(String(c.operatorId))?.role)!=='运营'||normalizedRole(next.roleOverrides[c.assistantId]||ctx.byId.get(String(c.assistantId))?.role)!=='运营助理'||(c.startOn&&!validDay(c.startOn))||(c.endOn&&!validDay(c.endOn))||(c.startOn&&c.endOn&&c.startOn>c.endOn))fault('协作授权对象或日期不合法');
  for(const c of next.collaborations) {c.authorizedBy=ctx.me.id;c.updatedAt=stamp();}
  next.history=[...(ctx.config.history||[]),{at:stamp(),actor:ctx.me.id,reason:clean(input.reason,500)||'调整工作设置',before:Object.fromEntries(allowed.map(k=>[k,ctx.config[k]])),after:Object.fromEntries(allowed.map(k=>[k,next[k]]))}];
  return writeRecord('settings','settings',next,Number(input.revision)||0);
}
export const centerRouter=Router();
const wrap=fn=>async(req,res)=>{try {const result=await fn(req,res);if(!res.headersSent)res.json(result);}catch(error){res.status(error.statusCode||500).json({ok:false,error:error.message});}};
centerRouter.get('/',wrap(req=>centerData(req.user,req.query)));
centerRouter.get('/reminders',wrap(async req=>{const ctx=await access(req.user);if(!ctx.director)fault('只有总监可以查看提醒状态',403);return reminderStatus(ctx);}));
centerRouter.get('/tasks/:id',wrap(async req=>{
  const {ctx,rows}=await visibleTasks(req.user);const task=rows.find(t=>t.id===req.params.id);
  if(!task)fault('没有这条任务',404);
  return {ok:true,task:decorate(ctx,task),children:rows.filter(t=>t.parent_id===task.id).map(t=>decorate(ctx,t))};
}));
centerRouter.get('/export',wrap(async(req,res)=>{
  const data=await centerData(req.user,req.query);
  res.set('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.set('Content-Disposition',`attachment; filename="work-center.xlsx"; filename*=UTF-8''${encodeURIComponent('工作统计-'+data.from+'.xlsx')}`);
  res.send(exportWorkCenter(data));
}));
centerRouter.post('/daily',wrap(async req=>({ok:true,record:await saveDaily(req.user,req.body||{})})));
centerRouter.post('/work',wrap(async req=>({ok:true,record:await saveWork(req.user,req.body||{})})));
centerRouter.post('/issue',wrap(async req=>({ok:true,record:await saveIssue(req.user,req.body||{})})));
centerRouter.put('/settings',wrap(async req=>({ok:true,record:await saveSettings(req.user,req.body||{})})));
centerRouter.post('/notices/read',wrap(async req=>{
  const ctx=await access(req.user);const id=clean(req.body.id,120),old=await record(id);
  if(old?.kind!=='notice'||old.personId!==ctx.me.id)fault('没有这条消息',404);
  return {ok:true,record:await writeRecord('notice',id,{...old,readAt:stamp()},old.revision)};
}));
