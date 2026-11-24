import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import express from 'express';
import { SITE_MODULES, SITE_NAV, SITE_FEATURE_PATHS, resetSiteAcl, savePersonSiteAcl, effectiveSiteAcl } from '../src/modules/people/site-acl.js';
import { featureForRequest } from '../src/modules/people/access-policy.js';
import { siteAclGuard } from '../src/modules/people/site-acl-guard.js';
import { WORK_FEATURES, migrateWorkCap } from '../src/modules/people/work-permissions.js';
import { resetPeopleStore } from '../src/modules/people/store.js';
import { resetWorkStore } from '../src/modules/work/store.js';
import { resetOrgMemo } from '../src/modules/work/diary.js';
import { resetCenterRecords, day } from '../src/modules/work/center-db.js';
import { centerData, saveDaily, saveWork } from '../src/modules/work/center.js';
import { publishTask, actTask, resetTaskStore, setTaskNotifier } from '../src/modules/work/tasks.js';
import { workRouter } from '../src/modules/work/router.js';
import { filterMeetingBoard, permissionsFor } from '../src/modules/people/feature-policy.js';

const on={see:true,enter:true,edit:true},read={see:true,enter:true,edit:false};
const assistant={username:'陈明婧'}, owner={username:'罗成'}, manager={username:'沈子晗'};
async function grant(name, module, features, cap=on){
  const result=await savePersonSiteAcl('罗成',name,{modules:{[module]:{...cap,catalogVersion:2,features}}});
  assert.equal(result.ok,true,result.error);return result.sheet;
}
beforeEach(()=>{resetPeopleStore();resetWorkStore();resetOrgMemo();resetCenterRecords();resetTaskStore();resetSiteAcl();setTaskNotifier(async()=>false);});
test('all 16 module names and routed feature names agree with navigation',()=>{
  assert.equal(SITE_MODULES.length,16);
  const nav=fs.readFileSync(new URL('../src/modules/home/nav-items.js',import.meta.url),'utf8');
  for(const item of SITE_NAV){const mod=SITE_MODULES.find(m=>m.id===item.id);assert.ok(mod);if(item.id!=='notices')assert.ok(nav.includes(`href: "${item.href}",`)&&nav.includes(`label: "${mod.name}"`),mod.name);}
  for(const [href,id] of Object.entries(SITE_FEATURE_PATHS)){const f=SITE_MODULES.flatMap(m=>m.features).find(f=>f.id===id);assert.ok(f,id);if(!href.startsWith('/academy')&&!href.startsWith('/stores'))assert.ok(nav.includes(`href: "${href}", label: "${f.name}"`),id);}
  assert.deepEqual(WORK_FEATURES.filter(f=>f.tab).map(f=>f.name),['工作总览','人员明细','任务管理','工作汇报','管理看板','任务验收','工作统计','工作设置']);
  assert.equal(SITE_MODULES.find(m=>m.id==='hr').features.length,8);
});
test('legacy work grants migrate without granting unrelated management powers',()=>{
  const migrated=migrateWorkCap({...on,features:{'work.today':read}});
  assert.deepEqual(migrated.features['work.tasks'],read);
  assert.equal(migrated.features['work.publish'].edit,false);
  assert.equal(migrated.features['work.acceptance'].enter,false);
  assert.equal(migrated.features['work.settings'].enter,false);
});
test('saving then revoking a migrated feature does not revive it',async()=>{
  const old=await savePersonSiteAcl('罗成','陈明婧',{modules:{work:{...on,features:{'work.today':on,'work.settings':on}}}});
  const cap=old.sheet.modules.work;cap.features['work.publish']={see:false,enter:false,edit:false};cap.features['work.legacySettings']={see:false,enter:false,edit:false};
  assert.equal((await savePersonSiteAcl('罗成','陈明婧',{modules:{work:cap}})).ok,true);
  const saved=effectiveSiteAcl('陈明婧').modules.work;
  assert.equal(saved.features['work.publish'].enter,false);assert.equal(saved.features['work.legacySettings'].enter,false);assert.equal(saved.features['work.settings'].edit,true);
});
test('task-only permission loads work center without old today permission',async()=>{
  await grant('陈明婧','work',{'work.tasks':read},read);
  const result=await centerData(assistant);assert.equal(result.ok,true);assert.equal(result.permissions['work.tasks'].enter,true);assert.equal(result.permissions['work.reports'].enter,false);assert.deepEqual(result.dailies,[]);assert.equal(result.canPublish,false);
});
test('assistant execution, daily and work record rights are independent',async()=>{
  const task=(await publishTask(owner,{title:'权限回归',assignee:'5',start_at:day()+'T00:00',due_at:day()+'T23:59'})).task;assert.ok(task);
  await grant('陈明婧','work',{'work.tasks':read,'work.execute':on,'work.reports':read});
  const started=await actTask(assistant,{id:task.id,revision:task.revision,action:'start'});assert.equal(started.ok,true,started.error);
  await assert.rejects(saveDaily(assistant,{date:day(),submit:true}),e=>e.statusCode===403);
  await assert.rejects(saveWork(assistant,{date:day(),title:'不允许登记'}),e=>e.statusCode===403);
  assert.equal((await publishTask(assistant,{title:'不允许发布'})).statusCode,403);
});
test('read-only manager cannot publish or approve through direct domain calls',async()=>{
  let task=(await publishTask(owner,{title:'验收检查',assignee:'5',reviewer:'1',start_at:day()+'T00:00',due_at:day()+'T23:59'})).task;
  assert.ok(task);
  task=(await actTask(assistant,{id:task.id,revision:task.revision,action:'submit',note:'已完成'})).task;
  assert.ok(task);
  await grant('沈子晗','work',{'work.tasks':read,'work.acceptance':read},read);
  assert.equal((await publishTask(manager,{title:'不允许发布'})).statusCode,403);
  assert.equal((await actTask(manager,{id:task.id,revision:task.revision,action:'approve'})).statusCode,403);
  await grant('沈子晗','work',{'work.acceptance':on});
  assert.equal((await actTask(manager,{id:task.id,revision:task.revision,action:'approve'})).ok,true);
});
test('legacy submission status does not newly grant approval and salary view needs both old gates',async()=>{
  const old=await savePersonSiteAcl('罗成','陈明婧',{modules:{work:{...on,features:{'work.duty':on}},hr:{...on,features:{'hr.staff':on}}}});
  assert.equal(old.sheet.modules.work.features['work.acceptance'].edit,false);
  assert.equal(old.sheet.modules.hr.features['hr.pay'].enter,false);
});
test('granting only shell entry never exposes the aggregate payload',async()=>{
  await grant('陈明婧','work',{});await assert.rejects(centerData(assistant),e=>e.statusCode===403);
});
test('work settings, execution, report, export and legacy endpoints map separately',()=>{
  for(const [tail,feature] of [['center/work','records'],['center/issue','records'],['center/daily','reports'],['center/settings','settings'],['center/export','export'],['center/notices/read','messages'],['tasks/publish','publish'],['diary/settings','legacyDiary'],['settings/templates','legacySettings']])assert.equal(featureForRequest('work','/api/work/'+tail),'work.'+feature);
  assert.equal(featureForRequest('work','/api/work/center'),'');
});
test('HR and meeting legacy grants migrate and can be revoked independently',async()=>{
  await savePersonSiteAcl('罗成','陈明婧',{modules:{hr:{...on,features:{'hr.staff':read}},meeting:{...on,features:{'meeting.hours':read}}}});
  const sheet=effectiveSiteAcl('陈明婧');assert.equal(sheet.modules.hr.features['hr.org'].enter,true);assert.equal(sheet.modules.meeting.features['meeting.profit'].enter,true);
  await grant('陈明婧','meeting',{'meeting.hours':read});
  const board=filterMeetingBoard({kpis:[{key:'hours'},{key:'profit'}],ranks:[],intros:[],levels:[],goals:['secret'],stars:[]},permissionsFor(assistant,'meeting'));
  assert.deepEqual(board.kpis,[{key:'hours'}]);assert.deepEqual(board.goals,[]);
});
test('HR shared requests allow only their supported features and safe organization edits',()=>{
  assert.deepEqual(featureForRequest('hr','/api/hr/effort'),['hr.overtime','hr.pay']);
  assert.equal(featureForRequest('hr','/api/hr/attendance'),'hr.clock');
  assert.deepEqual(featureForRequest('hr','/api/hr/staff/1',{},'PUT',{department:'技术部',replace:false}),['hr.staff','hr.org']);
  assert.equal(featureForRequest('hr','/api/hr/staff/1',{},'PUT',{department:'技术部',phone:'123',replace:false}),'hr.staff');
});
test('HTTP guard blocks custom-content task mutation and settings, permits only granted functions',async()=>{
  const task=(await publishTask(owner,{title:'HTTP检查',assignee:'5',start_at:day()+'T00:00',due_at:day()+'T23:59'})).task;
  await grant('陈明婧','work',{'work.tasks':read,'work.reports':on});
  const app=express();app.use(express.json());app.use((req,res,next)=>{req.user=assistant;next();});app.use(siteAclGuard);app.use('/api/work',workRouter);
  const server=app.listen(0);await new Promise(resolve=>server.once('listening',resolve));const url='http://127.0.0.1:'+server.address().port;
  try{
    assert.equal((await fetch(url+'/api/work/center')).status,200);
    assert.equal((await fetch(url+'/api/work/center/export')).status,403);
    assert.equal((await fetch(url+'/api/work/center/settings',{method:'PUT',headers:{'Content-Type':'application/vnd.xm-work+json'},body:'{}'})).status,403);
    assert.equal((await fetch(url+'/api/work/tasks/action',{method:'POST',headers:{'Content-Type':'application/vnd.xm-work+json'},body:JSON.stringify({id:task.id,revision:task.revision,action:'start'})})).status,403);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
test('organization-only HR read returns no employee contact or emergency data',async()=>{
  await grant('陈明婧','hr',{'hr.org':read},read);
  const app=express();app.use((req,res,next)=>{req.user=assistant;next();});app.use(siteAclGuard);app.get('/api/hr/staff',(req,res)=>res.json({staff:[{id:1,name:'员工',department:'运营部',position:'运营',status:'在职',phone:'private',emergencyPhone:'private'}]}));
  const server=app.listen(0);await new Promise(resolve=>server.once('listening',resolve));try{const result=await fetch('http://127.0.0.1:'+server.address().port+'/api/hr/staff');assert.equal(result.status,200);const body=await result.json();assert.equal(body.staff[0].name,'员工');assert.equal(body.staff[0].phone,undefined);}finally{await new Promise(resolve=>server.close(resolve));}
});
