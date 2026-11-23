import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { workRouter } from '../src/modules/work/router.js';
import { resetPeopleStore } from '../src/modules/people/store.js';
import { resetWorkStore } from '../src/modules/work/store.js';
import { resetOrgMemo } from '../src/modules/work/diary.js';
import { resetCenterRecords, day, record, exportCenterRecords, importCenterRecords, settings } from '../src/modules/work/center-db.js';
import { saveWork, saveDaily, saveIssue, saveSettings, centerData, readComposerImage } from '../src/modules/work/center.js';
import { publishTask, actTask, resetTaskStore, setTaskNotifier } from '../src/modules/work/tasks.js';
const director={username:'罗成'},manager={username:'沈子晗'},lead={username:'杨润泽'},assistant={username:'陈明婧'},outsider={username:'王博'};
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const image=field=>({field,mime:'image/png',name:'测试.png',data:png});
beforeEach(async()=>{resetPeopleStore();resetWorkStore();resetOrgMemo();resetCenterRecords();resetTaskStore();setTaskNotifier(async()=>false);await saveSettings(director,{revision:0,roleOverrides:{'11':'主管','5':'助理','7':'助理'},teamOverrides:{'4':'8','5':'8','6':'11','7':'11'},weekdays:[0,1,2,3,4,5,6]});});
test('work images survive reload, edits and snapshots without copying image bytes into business records',async()=>{
  const w=await saveWork(assistant,{title:'工作图文',date:day(),content:'内容',result:'成果',composerImages:[image('content'),image('result')]});
  assert.equal(w.composerImages.length,2);assert.ok(!JSON.stringify(w).includes(png));
  importCenterRecords(exportCenterRecords());
  assert.equal((await readComposerImage(lead,w.composerImages[0].id,w.id)).data,png);
  await assert.rejects(()=>readComposerImage(outsider,w.composerImages[0].id,w.id),/没有这张图片/);
  const edited=await saveWork(assistant,{id:w.id,revision:w.revision,title:w.title,date:day(),composerImages:[]});
  assert.equal(edited.composerImages.length,0);assert.equal(edited.history[0].composerImages.length,2);
  assert.equal((await readComposerImage(assistant,w.composerImages[0].id,w.id)).data,png);
});
test('daily drafts and submitted histories keep images for dynamic report fields',async()=>{
  let daily=await saveDaily(assistant,{date:day(),notes:{'今日工作':'中文'},composerImages:[image('今日工作')]});
  daily=await saveDaily(assistant,{date:day(),revision:daily.revision,submit:true,notes:{'今日工作':'已完成'},composerImages:daily.composerImages});
  assert.equal(daily.history[0].composerImages[0].id,daily.composerImages[0].id);
  const data=await centerData(lead);assert.equal(data.dailies[0].composerImages.length,1);
  await assert.rejects(()=>readComposerImage(outsider,daily.composerImages[0].id,daily.id),/没有这张图片/);
});
test('issue handling preserves original screenshots and resolution history',async()=>{
  let issue=await saveIssue(assistant,{title:'问题',description:'说明',composerImages:[image('description')]});
  issue=await saveIssue(lead,{id:issue.id,revision:issue.revision,resolution:'处理完成',status:'已解决',composerImages:[image('resolution')]});
  assert.deepEqual(issue.composerImages.map(i=>i.field),['description','resolution']);
  assert.equal(issue.history[0].composerImages.length,1);
  await assert.rejects(()=>saveIssue(outsider,{id:issue.id,revision:issue.revision,resolution:'越权',composerImages:[image('resolution')]}),/没有这个问题/);
});
test('task progress and acceptance images follow existing task access',async()=>{
  let result=await publishTask(manager,{title:'测试任务',assignee:'5',start_at:day()+'T09:00',due_at:day()+'T23:59'});assert.equal(result.ok,true,result.error);
  let task=result.task;
  result=await actTask(assistant,{id:task.id,revision:task.revision,action:'progress',progress:25,note:'进度',composerImages:[image('note')]});assert.equal(result.ok,true,result.error);task=result.task;
  assert.equal((await readComposerImage(lead,task.events.at(-1).composerImages[0].id,null,task.id)).data,png);
  await assert.rejects(()=>readComposerImage(outsider,task.events.at(-1).composerImages[0].id,null,task.id),/没有这张图片/);
  result=await actTask(assistant,{id:task.id,revision:task.revision,action:'submit',note:'完成',composerImages:[image('note')]});assert.equal(result.ok,true,result.error);task=result.task;
  result=await actTask(manager,{id:task.id,revision:task.revision,action:'approve',note:'通过',composerImages:[image('note')]});assert.equal(result.ok,true,result.error);assert.equal(result.task.events.at(-1).composerImages.length,1);
});
test('task template images are readable by members but settings reason images remain director-only',async()=>{
  const config=await settings();const saved=await saveSettings(director,{revision:config.revision,taskTemplates:[{title:'带图模板',description:'说明',composerImages:[image('description')]}],reason:'调整',composerImages:[{...image('reason'),data:Buffer.concat([Buffer.from(png,'base64'),Buffer.from([0])]).toString('base64')}]});
  const id=saved.taskTemplates[0].composerImages[0].id;
  assert.equal((await readComposerImage(assistant,id,'settings')).data,png);
  const privateId=saved.history.at(-1).composerImages[0].id;
  await assert.rejects(()=>readComposerImage(assistant,privateId,'settings'),/没有这张图片/);
  assert.ok((await readComposerImage(director,privateId,'settings')).data);
  // Different bytes distinguish the private audit image from the public template image.
  assert.equal(saved.history.at(-1).composerImages[0].field,'reason');
  await assert.rejects(()=>saveSettings(assistant,{revision:saved.revision,composerImages:[]}),/只有总监/);
});
test('invalid MIME, foreign references, unknown fields and oversize images do not create parent records',async()=>{
  const base={id:'invalid-image-work',title:'test',date:day()};
  for(const images of [[{...image('content'),mime:'image/svg+xml'}],[{...image('content'),data:'AAAA'}],[{id:'foreign',field:'content'}],[image('unknown')],Array.from({length:4},()=>image('content')),[{...image('content'),data:'A'.repeat(4*1024*1024+4)}]]) {
    await assert.rejects(()=>saveWork(assistant,{...base,composerImages:images}));assert.equal(await record(base.id),null);
  }
});
test('module image requests above the global JSON limit are parsed and persist behind existing authentication',async()=>{
  const app=express();app.use(express.json());app.use((req,_res,next)=>{req.user=assistant;next();});app.use('/api/work',workRouter);
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  try {
    const data=Buffer.concat([Buffer.from(png,'base64'),Buffer.alloc(180000)]).toString('base64');
    const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/work/center/work',{method:'POST',headers:{'Content-Type':'application/vnd.xm-work+json'},body:JSON.stringify({title:'大图验收',date:day(),composerImages:[{...image('content'),data}]})});
    assert.equal(response.status,200);const saved=await response.json();assert.equal(saved.record.composerImages[0].size,Buffer.from(data,'base64').length);
  } finally {await new Promise(resolve=>server.close(resolve));}
});
