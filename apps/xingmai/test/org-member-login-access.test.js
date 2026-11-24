import {test,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {authRouter,currentUser,resetStoreForTests} from '../src/modules/profile/auth.js';
import {peopleRouter} from '../src/modules/people/router.js';
import {resetPeopleStore,patchPerson,createPerson,listPeople} from '../src/modules/people/store.js';
import {resetOrgBoard} from '../src/modules/people/org-board.js';
import {resetSiteAcl,savePersonSiteAcl} from '../src/modules/people/site-acl.js';
import {canSeeLogin,canEditLogin} from '../src/modules/people/org-acl.js';
const app=express();app.use(express.json());app.use((req,res,next)=>{req.user=currentUser(req);next()});app.use('/api/auth',authRouter);app.use('/api/people',peopleRouter);
const server=app.listen(0),base=`http://127.0.0.1:${server.address().port}`;after(()=>server.close());
const full={see:true,enter:true,edit:true},read={see:true,enter:true,edit:false};
let hao,target;
beforeEach(async()=>{resetStoreForTests();resetSiteAcl();resetPeopleStore();resetOrgBoard();await patchPerson(3,{username:'罗成'});hao=(await createPerson({name:'郝晨淼',username:'hao',password:'Valid123!',role:'主管',board:'hrTech'})).person;target=(await createPerson({name:'跨组成员',username:'member',password:'Old123!',lineManager:'沈子晗'})).person;});
const grant=rights=>savePersonSiteAcl('罗成',hao.name,{modules:{people:{...rights,features:{'people.members':rights}}}});
const request=(url,cookie,method='GET',body)=>fetch(base+url,{method,headers:{cookie,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
async function login(){const r=await request('/api/auth/login','','POST',{username:'hao',password:'Valid123!'});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];}
async function listed(cookie){const r=await request('/api/people',cookie);assert.equal(r.status,200);return (await r.json()).people;}
test('explicit member permissions reveal account fields and allow cross-team edits and login',async()=>{
 await grant(full);const cookie=await login();const row=(await listed(cookie)).find(p=>p.id===target.id);assert.equal(row.username,'member');assert.equal(row.password,'Old123!');assert.ok(row.canSeeLogin&&row.canEditLogin);
 const r=await request('/api/people/'+target.id,cookie,'PATCH',{username:'updated-member',password:'New123!'});assert.equal(r.status,200);
 const signin=await request('/api/auth/login','','POST',{username:'updated-member',password:'New123!'});assert.equal(signin.status,200);
});
test('read-only member permission shows credentials while denying single and batch writes',async()=>{
 await grant(read);const cookie=await login();const row=(await listed(cookie)).find(p=>p.id===target.id);assert.ok(row.canSeeLogin);assert.equal(row.canEditLogin,false);assert.equal(row.password,'Old123!');
 for(const [url,body]of [['/api/people/'+target.id,{password:'No123!'}],['/api/people/passwords',{ids:[target.id],password:'No123!'}]])assert.equal((await request(url,cookie,'PATCH',body)).status,403);
 assert.equal(listPeople().find(p=>p.id===target.id).password,'Old123!');
});
test('bulk password changes honor explicit member edit permissions',async()=>{
 await grant(full);const cookie=await login();const r=await request('/api/people/passwords',cookie,'PATCH',{ids:[target.id],password:'Batch123!'});assert.equal(r.status,200);assert.equal(listPeople().find(p=>p.id===target.id).password,'Batch123!');
});
test('revocation hides other credentials and blocks writes in the same session',async()=>{
 await grant(full);const cookie=await login();await grant({see:false,enter:false,edit:false});const row=(await listed(cookie)).find(p=>p.id===target.id);assert.equal(row.username,'');assert.equal(row.password,'');assert.equal(row.canSeeLogin,false);assert.equal(row.canEditLogin,false);assert.equal((await request('/api/people/'+target.id,cookie,'PATCH',{password:'No123!'})).status,403);
});
test('store-only access cannot reveal credentials and legacy team boundaries remain',async()=>{
 assert.equal(canSeeLogin(hao.name,target),false);assert.equal(canEditLogin(hao.name,target),false);assert.equal(canSeeLogin('沈子晗',target),true);assert.equal(canSeeLogin('韩梦凯',target),false);
 await savePersonSiteAcl('罗成',hao.name,{modules:{people:{...full,features:{'people.stores':full}}}});assert.equal(canSeeLogin(hao.name,target),false);assert.equal(canEditLogin(hao.name,target),false);
});
test('delegated member access does not expose or modify administrator credentials',async()=>{
 await grant(full);const cookie=await login();const admin=(await listed(cookie)).find(p=>p.id===3);assert.equal(admin.username,'');assert.equal(admin.password,'');assert.equal(admin.canEditLogin,false);assert.equal((await request('/api/people/3',cookie,'PATCH',{password:'No123!'})).status,403);
 const original=listPeople().find(p=>p.id===3).password;await request('/api/people/passwords',cookie,'PATCH',{ids:[3,target.id],password:'Batch123!'});assert.equal(listPeople().find(p=>p.id===3).password,original);assert.equal(listPeople().find(p=>p.id===target.id).password,'Batch123!');assert.ok(canEditLogin('罗成',listPeople().find(p=>p.id===3)));
});
