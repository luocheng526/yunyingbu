import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { resetPeopleStore, createPerson, patchPerson } from '../src/modules/people/store.js';
import { resetWorkStore } from '../src/modules/work/store.js';
import { resetOrgMemo } from '../src/modules/work/diary.js';
import { resetCenterRecords, day, record, settings, writeRecord } from '../src/modules/work/center-db.js';
import { access, normalizedRole } from '../src/modules/work/center-access.js';
import { publishTask,listTasks,actTask,readTaskFile,resetTaskStore,setTaskNotifier,exportTasks,importTasks } from '../src/modules/work/tasks.js';
import { centerData,saveDaily,saveWork,saveIssue,saveSettings } from '../src/modules/work/center.js';
import { workRouter } from '../src/modules/work/router.js';
const users={director:{username:'罗成'},managerB:{username:'韩梦凯'},manager:{username:'沈子晗'},lead:{username:'杨润泽'},leadB:{username:'高丽男'},op:{username:'张文静'},assistant:{username:'陈明婧'},opB:{username:'郭桂良'},assistantB:{username:'王博'}};
const today=()=>day();
beforeEach(async()=>{
  resetPeopleStore();resetWorkStore();resetOrgMemo();resetCenterRecords();resetTaskStore();setTaskNotifier(async()=>false);
  await patchPerson(3,{name:'罗成',username:'罗成',role:'总监'});
  await patchPerson(11,{role:'主管'});
  await patchPerson(4,{supervisor:'杨润泽'});
  await patchPerson(5,{role:'助理',supervisor:'杨润泽'});
  await patchPerson(6,{supervisor:'高丽男'});
  await patchPerson(7,{role:'助理',supervisor:'高丽男'});
  await saveSettings(users.director,{revision:0,weekdays:[0,1,2,3,4,5,6],deadline:'23:59'});
});
const draft=(overrides={})=>({title:'测试任务',assignee:'5',start_at:today()+'T09:00',due_at:today()+'T23:59',...overrides});
async function create(user=users.manager,overrides={}){const result=await publishTask(user,draft(overrides));assert.equal(result.ok,true,result.error);return result.task;}
async function act(user,task,action,extra={}){const result=await actTask(user,{id:task.id,revision:task.revision,action,note:'验证成果与说明',...extra});assert.equal(result.ok,true,result.error);return result.task;}

test('director, manager and operator assistant remain distinct business roles',async()=>{
  assert.equal((await access(users.director)).me.role,'总监');assert.equal((await access(users.manager)).me.role,'经理');
  assert.equal(normalizedRole('运营助理'),'运营助理');assert.equal(normalizedRole('助理'),'运营助理');
  assert.equal(normalizedRole('人事经理'),'经理');assert.equal(normalizedRole('后端工程师'),'员工');
  assert.equal((await centerData(users.director)).canManage,true);assert.equal((await centerData(users.manager)).canManage,false);
});
test('director sees HR, technical and backend work; managers stay inside reporting scope',async()=>{
  const hr=await createPerson({name:'测试人事主管',username:'qa-hr',role:'人事主管',department:'人事部',board:'hrTech',director:'罗成'});
  const tech=await createPerson({name:'测试技术工程师',username:'qa-tech',role:'技术工程师',department:'技术部',board:'hrTech',director:'罗成'});
  const backend=await createPerson({name:'测试后端工程师',username:'qa-backend',role:'后端工程师',department:'后端部',board:'backend',director:'罗成',managerId:2,lineManager:'韩梦凯'});
  assert.ok(hr.ok&&tech.ok&&backend.ok);resetOrgMemo();
  const ht=await create(users.director,{assignee:String(hr.person.id)}),bt=await create(users.director,{assignee:String(backend.person.id)});
  await saveWork({username:'qa-tech'},{title:'开发事项',date:today()});await saveDaily({username:'qa-hr'},{date:today(),submit:true});
  const all=await centerData(users.director);assert.equal(all.departments.find(d=>d.id==='hrTech').members,2);assert.equal(all.departments.find(d=>d.id==='backend').members,1);
  assert.equal(all.people.find(p=>p.id===String(tech.person.id)).orgRole,'技术工程师');
  const filtered=await centerData(users.director,{board:'hrTech'});assert.deepEqual(filtered.tasks.map(t=>t.id),[ht.id]);assert.equal(filtered.works.length,1);assert.equal(filtered.dailies.length,1);
  const a=await centerData(users.manager),b=await centerData(users.managerB);assert.equal(a.tasks.some(t=>[ht.id,bt.id].includes(t.id)),false);assert.deepEqual(b.tasks.map(t=>t.id),[bt.id]);
  assert.equal((await publishTask(users.manager,draft({assignee:String(hr.person.id)}))).statusCode,403);
  assert.equal((await publishTask(users.manager,draft({assignee:'2'}))).statusCode,403);
  assert.equal(all.options.departments.includes('技术部'),true);
});
test('director tasks reach managers and supervisors without granting core edit permission',async()=>{
  const t=await create(users.director);assert.equal(t.publisher_role,'总监');assert.equal(t.team_id,'team-8');
  assert.equal((await listTasks(users.manager,'all')).rows.length,1);assert.equal((await listTasks(users.lead,'all')).rows.length,1);assert.equal((await listTasks(users.managerB,'all')).rows.length,0);
  assert.equal((await actTask(users.manager,{id:t.id,revision:t.revision,action:'edit',description:'更改总监要求',note:'测试'})).statusCode,403);
  assert.equal((await centerData(users.director)).teams.find(team=>team.id==='team-8').directorPublished,1);
  assert.equal((await create(users.director,{reviewer:'1'})).reviewer,'1');
  assert.equal((await create(users.director,{reviewer:'8'})).reviewer,'8');
  await assert.rejects(()=>saveSettings(users.manager,{revision:1,roleOverrides:{'1':'总监'}}),/只有总监/);
});
test('manager transfer preserves task and daily management snapshots',async()=>{
  const old=await create(users.director);await saveDaily(users.assistant,{date:today(),submit:true});
  await patchPerson(8,{lineManager:'韩梦凯'});
  const fresh=await create(users.director);assert.deepEqual(old.manager_ids,['1']);assert.deepEqual(fresh.manager_ids,['2']);
  assert.deepEqual((await listTasks(users.manager,'all')).rows.map(t=>t.id),[old.id]);assert.deepEqual((await listTasks(users.managerB,'all')).rows.map(t=>t.id),[fresh.id]);
  assert.equal((await centerData(users.manager)).dailies.length,1);assert.equal((await centerData(users.managerB)).dailies.length,0);
});
test('organization assignments supersede stored work overrides and cannot be changed in work settings',async()=>{
  const s=await settings();
  const overrides={roleOverrides:{'5':'经理'},reportingOverrides:{'5':'2'},teamOverrides:{'5':'11'}};
  await writeRecord('settings','settings',{...s,...overrides},s.revision);
  const {me}=await access(users.assistant);
  assert.equal(me.role,'运营助理');
  assert.equal(me.parentName,'杨润泽');
  assert.equal(me.teamId,'team-8');
  const revision=(await settings()).revision;
  for(const [key,value] of Object.entries(overrides)){
    await assert.rejects(()=>saveSettings(users.director,{revision,[key]:value}),/组织中心维护/);
  }
  await saveSettings(users.director,{revision,deadline:'19:00'});
});

test('direct reporting follows organization level columns and skips gaps',async()=>{
  const lead=await createPerson({name:'新团队主管',role:'运营',supervisor:'新团队主管',lineManager:'韩梦凯'});
  await patchPerson(lead.person.id,{operator:''});
  const reserve=await createPerson({name:'新团队储备',role:'储备',reserve:'新团队储备',supervisor:'新团队主管',lineManager:'韩梦凯'});
  const operator=await createPerson({name:'新团队运营',role:'运营',supervisor:'新团队主管',lineManager:'韩梦凯',managerId:2});
  const assistant=await createPerson({name:'新团队助理',role:'助理',operator:'无',reserve:'新团队储备',supervisor:'新团队主管',lineManager:'韩梦凯'});
  const byId=(await access(users.director)).byId;
  assert.equal(byId.get(String(operator.person.id)).parentName,lead.person.name);
  assert.equal(byId.get(String(operator.person.id)).teamName,lead.person.name+'团队');
  assert.equal(byId.get(String(assistant.person.id)).parentName,reserve.person.name);
  assert.equal(byId.get(String(lead.person.id)).role,'主管');
  assert.equal(byId.get(String(lead.person.id)).parentName,'韩梦凯');
  const user={username:lead.person.name};
  const data=await centerData(user);
  assert.equal(data.me.role,'主管');
  assert.equal(data.canPublish,true);
  assert.deepEqual(data.options.assignees.map(p=>p.id).sort(),[reserve,operator,assistant].map(result=>String(result.person.id)).sort());
  const task=await create(user,{assignee:String(operator.person.id)});
  assert.equal(task.publisher_role,'主管');
  assert.equal((await publishTask(user,draft({assignee:'4'}))).statusCode,403);
});
test('manager direct assignment belongs to employee team without increasing supervisor publication',async()=>{
  const t=await create();assert.equal(t.publisher,'1');assert.equal(t.team_id,'team-8');assert.equal(t.reviewer,'1');
  assert.equal((await listTasks(users.lead,'all')).rows.length,1);
  assert.equal((await listTasks(users.leadB,'all')).rows.length,0);
  const data=await centerData(users.manager);const team=data.teams.find(t=>t.id==='team-8');assert.equal(team.selfPublished,0);assert.equal(team.managerPublished,1);assert.equal(team.metrics.total,1);
});
test('supervisor can assign assistant directly but not another team',async()=>{
  const t=await create(users.lead);assert.equal(t.reviewer,'8');
  const bad=await publishTask(users.lead,draft({assignee:'7'}));assert.equal(bad.statusCode,403);
});
test('operator requires explicit current collaboration; assistant cannot publish',async()=>{
  assert.equal((await publishTask(users.op,draft())).statusCode,403);
  const config=await settings();await saveSettings(users.director,{revision:config.revision,collaborations:[{operatorId:'4',assistantId:'5',enabled:true,startOn:today()}]});
  const t=await create(users.op);assert.equal(t.reviewer,'4');assert.equal((await listTasks(users.lead,'all')).rows.length,1);
  assert.equal((await publishTask(users.assistant,draft({assignee:'4'}))).statusCode,403);
  const config2=await settings();await saveSettings(users.director,{revision:config2.revision,collaborations:[{operatorId:'4',assistantId:'5',enabled:false}]});
  assert.equal((await publishTask(users.op,draft())).statusCode,403);
  assert.equal((await listTasks(users.op,'published')).rows.length,1);
});
test('expired and future collaborations do not authorize dispatch',async()=>{
  const s=await settings();await saveSettings(users.director,{revision:s.revision,collaborations:[{operatorId:'4',assistantId:'5',endOn:'2001-01-01'},{operatorId:'4',assistantId:'5',startOn:'2099-01-01'}]});
  assert.equal((await publishTask(users.op,draft())).statusCode,403);
});
test('manager can designate employee supervisor as reviewer; other reviewers rejected',async()=>{
  const t=await create(users.manager,{reviewer:'8'});assert.equal(t.reviewer,'8');
  assert.equal((await publishTask(users.manager,draft({reviewer:'11'}))).statusCode,403);
});
test('submission is pending until designated reviewer accepts; return keeps history',async()=>{
  let t=await create();t=await act(users.assistant,t,'submit');assert.equal(t.status,'待检查');assert.ok(t.first_submitted_at);assert.equal(t.completed_at,undefined);
  assert.equal((await actTask(users.lead,{id:t.id,revision:t.revision,action:'approve'})).statusCode,403);
  await assert.rejects(()=>actTask(users.manager,{id:t.id,revision:t.revision,action:'return',note:''}),/说明或原因/);
  t=await act(users.manager,t,'return');assert.equal(t.status,'进行中');assert.equal(t.return_count,1);assert.equal(t.returned,true);
  t=await act(users.assistant,t,'submit');t=await act(users.manager,t,'approve');assert.equal(t.status,'已完成');assert.ok(t.completed_at);assert.equal(t.events.filter(e=>e.action==='提交检查').length,2);
});
test('parent cannot submit before children accepted and never auto-completes',async()=>{
  let parent=await create(users.manager,{assignee:'8'});let child=await create(users.lead,{parent_id:parent.id});
  assert.equal((await actTask(users.lead,{id:parent.id,revision:parent.revision,action:'submit',note:'完成'})).ok,false);
  child=await act(users.assistant,child,'submit');child=await act(users.lead,child,'approve');
  assert.equal(child.status,'已完成');
  parent=(await listTasks(users.manager,'published')).rows.find(t=>t.id===parent.id);assert.equal(parent.status,'待执行');
  parent=await act(users.lead,parent,'submit');assert.equal(parent.status,'待检查');
  const data=await centerData(users.manager);assert.equal(data.counts.roots,1);assert.equal(data.counts.children,1);
});
test('team reassignment preserves old task snapshot, new tasks follow new team',async()=>{
  const old=await create();await patchPerson(5,{supervisor:'高丽男'});
  const fresh=await create();assert.equal(fresh.team_id,'team-11');assert.equal((await listTasks(users.lead,'all')).rows.find(t=>t.id===old.id).team_id,'team-8');assert.equal((await listTasks(users.leadB,'all')).rows.length,1);
});
test('supervisor cannot edit manager requirements; manager extension keeps old deadline',async()=>{
  let t=await create();assert.equal((await actTask(users.lead,{id:t.id,revision:t.revision,action:'edit',title:'更改',note:'原因'})).statusCode,403);
  const tomorrow=new Date(Date.parse(today())+86400000).toISOString().slice(0,10);t=await act(users.manager,t,'edit',{due_at:tomorrow+'T18:00'});
  assert.equal(t.original_due_at,today()+'T23:59');assert.equal(t.delayed,true);assert.ok(t.events.at(-1).changes.due_at.before);
});
test('concurrent retries use task id and revision to avoid duplicate actions',async()=>{
  const id='dedupe-task-0001';const a=await create(users.manager,{id}),b=await publishTask(users.manager,draft({id}));assert.equal(b.duplicate,true);
  const results=await Promise.all([actTask(users.assistant,{id:a.id,revision:1,action:'start'}),actTask(users.assistant,{id:a.id,revision:1,action:'start'})]);assert.equal(results.filter(r=>r.ok).length,1);assert.equal(results.filter(r=>r.statusCode===409).length,1);
});
test('files respect team visibility and reject unsafe extensions',async()=>{
  const t=await create(users.manager,{files:[{name:'result.txt',data:Buffer.from('work').toString('base64'),mime:'text/plain'}]});
  assert.equal((await readTaskFile(users.lead,t.files[0].id)).ok,true);assert.equal((await readTaskFile(users.leadB,t.files[0].id)).statusCode,404);
  assert.equal((await publishTask(users.manager,draft({files:[{name:'payload.html',data:Buffer.from('<script>').toString('base64')}]}))).ok,false);
});
test('daily snapshot is server generated, versioned and independent from live task',async()=>{
  let t=await create();await saveWork(users.assistant,{title:'主动优化',date:today(),result:'完成一项优化'});
  const r=await saveDaily(users.assistant,{date:today(),submit:true,revision:0,notes:{计划:'明日复盘'},snapshot:{tasks:[{id:'forged'}]}});
  assert.equal(r.snapshot.tasks[0].id,t.id);assert.equal(r.snapshot.work.length,1);assert.equal(r.snapshot.tasks[0].status,'待开始');
  t=await act(users.assistant,t,'submit');assert.equal((await record(r.id)).snapshot.tasks[0].status,'待开始');
  const revised=await saveDaily(users.assistant,{date:today(),submit:true,revision:r.revision,notes:{计划:'新计划'}});assert.equal(revised.history.length,1);assert.equal(revised.snapshot.tasks[0].status,'待验收');
  await assert.rejects(()=>saveDaily(users.assistant,{date:today(),submit:false,revision:revised.revision}),/已正式提交/);
});
test('daily late flag, role requirements and day off use separate task status',async()=>{
  const previous=new Date(Date.parse(today())-86400000).toISOString().slice(0,10);
  const r=await saveDaily(users.assistant,{date:previous,submit:true,revision:0,notes:{}});assert.equal(r.late,true);
  const s=await settings();await saveSettings(users.director,{revision:s.revision,restDays:[today()]});
  const d=await centerData(users.assistant);assert.equal(d.counts.should,0);assert.equal(d.counts.reportRate,null);
});
test('autonomous work does not grant assistant dispatch or expose another team records',async()=>{
  await saveWork(users.assistant,{title:'自主工作',date:today(),result:'结果'});
  assert.equal((await centerData(users.lead)).works.length,1);assert.equal((await centerData(users.leadB)).works.length,0);
  await assert.rejects(()=>saveSettings(users.assistant,{revision:1,roleOverrides:{'5':'经理'}}),/只有/);
});
test('issues support escalation, resolution history and team isolation',async()=>{
  const r=await saveIssue(users.assistant,{title:'需要支持',escalated:true});assert.equal((await centerData(users.manager)).alerts.some(a=>a.type==='issue'),true);
  await assert.rejects(()=>saveIssue(users.leadB,{id:r.id,revision:r.revision,resolution:'越权'}),/没有/);
  const done=await saveIssue(users.lead,{id:r.id,revision:r.revision,resolution:'已协调',status:'已解决'});assert.equal(done.history.length,1);
});
test('unknown username cannot impersonate manager by display name',async()=>{
  await assert.rejects(()=>access({username:'unknown',displayName:'罗成'}),/未关联/);
});
test('team filtering applies to autonomous work, daily reports, issues and timeline',async()=>{
  await create();await create(users.manager,{assignee:'7'});
  await saveWork(users.assistant,{title:'A 组工作',date:today()});await saveWork(users.assistantB,{title:'B 组工作',date:today()});
  await saveDaily(users.assistant,{date:today(),submit:true});await saveDaily(users.assistantB,{date:today(),submit:true});
  await saveIssue(users.assistant,{title:'A 组问题'});await saveIssue(users.assistantB,{title:'B 组问题'});
  const data=await centerData(users.manager,{team:'team-8'});
  assert.equal(data.works.length,1);assert.equal(data.dailies.length,1);assert.equal(data.issues.length,1);
  assert.equal(data.timeline.some(e=>e.title==='B 组工作'),false);assert.equal(data.timeline.filter(e=>e.action==='发布任务').length,1);
});
test('supervisor daily captures team tasks from manager and team work independently',async()=>{
  const t=await create();await saveWork(users.assistant,{title:'团队自主事项',date:today()});
  await saveDaily(users.assistant,{date:today(),submit:true});
  const r=await saveDaily(users.lead,{date:today(),submit:true});
  assert.equal(r.snapshot.tasks.length,0);assert.equal(r.snapshot.team.tasks[0].id,t.id);
  assert.equal(r.snapshot.team.work.length,1);assert.equal(r.snapshot.team.members.find(p=>p.id==='5').submitted,true);
  await act(users.assistant,t,'submit');assert.equal((await record(r.id)).snapshot.team.tasks[0].status,'待开始');
});
test('changing rich task text updates displayed document and keeps earlier audit content',async()=>{
  let t=await create(users.manager,{description_doc:JSON.stringify([{type:'text',text:'原始说明'}])});
  t=await act(users.manager,t,'edit',{description:'更正说明'});
  assert.equal(t.description_doc[0].text,'更正说明');assert.equal(t.events.at(-1).changes.description.beforeDoc[0].text,'原始说明');
});
test('reassigning employee also checks the final reviewer scope',async()=>{
  const t=await create(users.manager,{reviewer:'8'});
  const response=await actTask(users.manager,{id:t.id,revision:t.revision,action:'edit',assignee:'7',note:'跨组重新分派'});
  assert.equal(response.statusCode,403);assert.equal((await listTasks(users.manager,'all')).rows[0].assignee,'5');
});
test('malformed settings are rejected without replacing valid configuration',async()=>{
  const s=await settings();for(const input of [{roleOverrides:null},{taskTemplates:{}},{reportRoles:null},{collaborations:[null]},{reportFields:{主管:'bad'}}])await assert.rejects(()=>saveSettings(users.director,{revision:s.revision,...input}),e=>e.statusCode===400);
  assert.equal((await settings()).revision,s.revision);
});
test('employee detail keeps received and published tasks separate under a person filter',async()=>{
  const received=await create(users.manager,{assignee:'8'}),published=await create(users.lead);
  const d=await centerData(users.manager,{person:'8'});
  assert.deepEqual(d.tasks.map(t=>t.id),[received.id]);assert.deepEqual(d.publishedTasks.map(t=>t.id),[published.id]);
});
test('metrics separate deadline cohort, first submission, accepted submission and review time',async()=>{
  const t=await create();const saved=exportTasks();
  Object.assign(saved.tasks[0],{created_at:'2026-01-01T09:00',start_at:'2026-01-01T09:00',due_at:'2026-01-03T18:00',first_submitted_at:'2026-01-03T17:00',submitted_at:'2026-01-04T10:00',accepted_submission_at:'2026-01-04T10:00',completed_at:'2026-01-04T11:00',status:'已完成',reviewer:'8',events:[{actor:'5',action:'提交检查',at:'2026-01-03T17:00'},{actor:'8',action:'退回修改',at:'2026-01-03T19:00'},{actor:'5',action:'提交检查',at:'2026-01-04T10:00'},{actor:'8',action:'检查通过',at:'2026-01-04T11:00'}]});
  saved.tasks.push({...saved.tasks[0],id:'cancelled-test-01',status:'已取消'});importTasks(saved);
  const d=await centerData(users.manager,{from:'2026-01-03',to:'2026-01-04'});
  assert.equal(d.counts.created,0);assert.equal(d.counts.due,1);assert.equal(d.counts.completed,1);
  assert.equal(d.counts.onTimeSubmissionRate,100);assert.equal(d.counts.validSubmissionRate,0);assert.equal(d.counts.onTimeCompletionRate,0);assert.equal(d.counts.reviewPassRate,50);
  assert.equal(d.teams.find(team=>team.id===t.team_id).timelyReviewRate,100);
});
test('invalid dates and unrelated users are rejected by public routes',async()=>{
  const app=express();app.use(express.json());app.use((req,_res,next)=>{req.user=users.assistant;next();});app.use('/api/work',workRouter);
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  try {const base='http://127.0.0.1:'+server.address().port;
    const response=await fetch(base+'/api/work/center?date=2026-02-31');assert.equal(response.status,400);
    const body=await (await fetch(base+'/api/work/center')).json();assert.equal(body.canManage,false);assert.equal(JSON.stringify(body).includes('password'),false);
    const denied=await fetch(base+'/api/work/center/settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:1})});assert.equal(denied.status,403);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
