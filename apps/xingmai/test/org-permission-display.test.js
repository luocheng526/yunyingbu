import {test,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {authRouter,currentUser,resetStoreForTests} from '../src/modules/profile/auth.js';
import {peopleRouter} from '../src/modules/people/router.js';
import {resetPeopleStore,patchPerson,createPerson,listPeople} from '../src/modules/people/store.js';
import {resetOrgBoard,createOrgStore,listOrgStores,patchOrgStore,importOrgStores} from '../src/modules/people/org-board.js';
import {resetSiteAcl,savePersonSiteAcl,canonicalActor,effectiveSiteAcl,listSiteAclBoard,SITE_MODULES} from '../src/modules/people/site-acl.js';
import {canAssignSiteAcl,canEditRoster} from '../src/modules/people/org-acl.js';
import {storeScope} from '../src/modules/people/access-policy.js';
const app=express();app.use(express.json());app.use((req,res,next)=>{req.user=currentUser(req);next()});app.use('/api/auth',authRouter);app.use('/api/people',peopleRouter);
const server=app.listen(0);const base=`http://127.0.0.1:${server.address().port}`;
after(()=>server.close());
const cap={see:true,enter:true,edit:true};const readonly={see:true,enter:true,edit:false};
const grant=(rights=cap)=>({people:{...rights,features:{'people.stores':rights,'people.acl':rights,'people.members':rights}}});
beforeEach(async()=>{resetStoreForTests();resetSiteAcl();resetPeopleStore();resetOrgBoard();await patchPerson(3,{username:'罗成'});});
async function member(){return (await createPerson({name:'郝晨淼',username:'hao',password:'Valid123!',board:'hrTech',role:'主管',supervisor:'郝晨淼',lineManager:'罗成'})).person;}
async function login(username='罗成',password='ChangeMe123!'){const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];}
const get=async(route,cookie)=>{const r=await fetch(base+route,{headers:{cookie}});assert.equal(r.status,200,route);return r.json();};
async function addStores(){for(const [name,manager,operator] of [['甲店','沈子晗','甲运营'],['乙店','韩梦凯','乙运营']]){assert.equal((await createOrgStore({storeName:name,storeId:name,manager,operator},'罗成')).ok,true);}return listOrgStores({},'罗成');}
test('production administrator roster alias preserves full ACL and member directory',async()=>{
 await member();const stores=await addStores();assert.equal(listPeople().find(p=>p.id===3).name,'管理员');
 for(const alias of ['罗成','luocheng','管理员']){assert.equal(canonicalActor(alias),'罗成');assert.ok(canAssignSiteAcl(alias));assert.ok(canEditRoster(alias));const sheet=effectiveSiteAcl(alias,stores);assert.equal(sheet.implicit,'max');for(const mod of SITE_MODULES){assert.equal(sheet.modules[mod.id].edit,true);for(const feature of mod.features)assert.equal(sheet.modules[mod.id].features[feature.id].edit,true);}assert.ok(listSiteAclBoard(alias).people.some(p=>p.name==='郝晨淼'));assert.ok(Object.values(sheet.stores).every(c=>c.edit));}
});
test('existing administrator session returns full permissions on auth/me and both organization endpoints',async()=>{
 const cookie=await login();await member();await addStores();const me=await get('/api/auth/me',cookie);assert.equal(me.siteAcl.configured,true);assert.ok(Object.values(me.siteAcl.modules).every(c=>c.edit));
 const board=await get('/api/people/org/site-acl',cookie);assert.equal(board.actor,'罗成');assert.equal(board.canAssign,true);assert.ok(board.people.length>0);
 const mine=await get('/api/people/org/site-acl/me',cookie);assert.equal(mine.me.implicit,'max');assert.ok(mine.me.modules.people.features['people.acl'].edit);
});
test('explicit master-data permission shows cross-team stores without assigning operational ownership',async()=>{
 const p=await member();const stores=await addStores();const before=listPeople().find(x=>x.id===p.id).visibleShops;await savePersonSiteAcl('罗成',p.name,{modules:grant(),stores:{}});
 const cookie=await login('hao','Valid123!');const data=await get('/api/people/org/stores',cookie);assert.equal(data.stores.length,stores.length);assert.equal(data.scope,'all');assert.equal(data.canCreate,true);assert.ok(data.stores.every(s=>s.canEdit));assert.deepEqual(listPeople().find(x=>x.id===p.id).visibleShops,before);
 assert.equal((await get('/api/people/org/summary',cookie)).summary.listed,stores.length);assert.equal(listSiteAclBoard(p.name).stores.length,stores.length);
 // Organization access must not grant sales/operational data access.
 const scope=storeScope(p.name);assert.equal(scope.full('see'),false);assert.ok(stores.every(s=>!scope.cap(s).see));
});
test('master-data edit works across teams, and import updates rather than duplicates',async()=>{
 const p=await member();await addStores();await savePersonSiteAcl('罗成',p.name,{modules:grant()});const row=listOrgStores({},p.name).find(s=>s.storeName==='甲店');assert.ok(row);
 assert.equal((await patchOrgStore(row.id,{remark:'更新备注'},p.name)).ok,true);
 const imported=await importOrgStores([{storeName:'甲店',storeId:'甲店',operator:'甲运营',manager:'沈子晗',remark:'导入更新'}],p.name);assert.equal(imported.updated,1);assert.equal(imported.created,0);assert.deepEqual(imported.failed,[]);
});
test('read-only master-data access lists stores but blocks edits and creation',async()=>{
 const p=await member();const stores=await addStores();await savePersonSiteAcl('罗成',p.name,{modules:grant(readonly)});const cookie=await login('hao','Valid123!');const data=await get('/api/people/org/stores',cookie);assert.equal(data.stores.length,stores.length);assert.equal(data.canCreate,false);assert.ok(data.stores.every(s=>!s.canEdit));
 const r=await fetch(base+'/api/people/org/stores/'+stores[0].id,{method:'PATCH',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify({remark:'denied'})});assert.equal(r.status,403);assert.equal((await patchOrgStore(stores[0].id,{remark:'denied'},p.name)).statusCode,403);
});
test('revoking master-data authorization removes cross-team visibility in the same session',async()=>{
 const p=await member();await addStores();await savePersonSiteAcl('罗成',p.name,{modules:grant()});const cookie=await login('hao','Valid123!');assert.ok((await get('/api/people/org/stores',cookie)).stores.length>0);await savePersonSiteAcl('罗成',p.name,{modules:{},stores:{}});assert.equal((await get('/api/people/org/stores',cookie)).stores.length,0);
});
test('unconfigured members and line leaders retain their responsibility scope',async()=>{
 const p=await member();await addStores();assert.equal(listOrgStores({},p.name).length,0);const rows=listOrgStores({},'沈子晗');assert.ok(rows.length>0);assert.ok(rows.every(s=>[s.manager,s.chief,s.director,s.supervisor].join(' ').includes('沈子晗')));assert.equal(canAssignSiteAcl(p.name),false);
});
