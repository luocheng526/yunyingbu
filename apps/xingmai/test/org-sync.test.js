import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { authRouter, currentUser, resolveDesk, publicProfile, resetStoreForTests } from "../src/modules/profile/auth.js";
import { peopleRouter } from "../src/modules/people/router.js";
import { createPerson, patchPerson, listPeople, listShops, listGrants, resetPeopleStore } from "../src/modules/people/store.js";
import { createOrgStore, patchOrgStore, listOrgStores, resetOrgBoard, pinRightsName } from "../src/modules/people/org-board.js";
import { savePersonSiteAcl, effectiveSiteAcl, navVisibility, resetSiteAcl } from "../src/modules/people/site-acl.js";
import { storeScope, checkStoreRequest, filterStorePayload, featureForRequest } from "../src/modules/people/access-policy.js";
import { navMarkup, isHrDesk } from "../src/modules/home/nav-items.js";
import { meetingRouter } from "../src/modules/meeting/router.js";
import { resetMeetingStore } from "../src/modules/meeting/store.js";
import { feedbackRouter } from "../src/modules/feedback/router.js";
import { resetFeedbackStore } from "../src/modules/feedback/store.js";
import { SITE_MODULES, SITE_NAV } from "../src/modules/people/site-acl.js";
import { listRightsBoard } from "../src/modules/people/org-board.js";
import { stateSync } from "../src/modules/people/state-sync.js";

const app = express(); app.use(express.json());
app.use((req, _res, next) => { req.user = currentUser(req); next(); });
app.use("/api/auth", authRouter); app.use("/api/people", peopleRouter);
app.use("/api/meeting", meetingRouter);app.use("/api/feedback", feedbackRouter);
for (const route of SITE_NAV) app.get("/api" + route.href + "/acl-test", (_req,res)=>res.json({ok:true}));
let writes = 0;
app.get("/api/work/report", (_req, res) => res.json({ ok: true }));
app.put("/api/work/report", (_req, res) => { writes++; res.json({ ok: true }); });
app.get("/api/work/settings", (_req, res) => res.json({ ok: true }));
app.get("/work", (_req, res) => res.send("work"));
app.get("/api/home/erp-kpis", (_req, res) => res.json({ records: [{store:'甲店',sales:1},{store:'乙店',sales:99}],totals:{sales:100} }));
const server = app.listen(0); const base = `http://127.0.0.1:${server.address().port}`;
beforeEach(() => { resetStoreForTests(); resetSiteAcl(); resetPeopleStore(); resetOrgBoard(); resetMeetingStore(); resetFeedbackStore(); writes = 0; });
after(() => { resetPeopleStore(); server.close(); });
const cap = (see=true,enter=true,edit=true) => ({see,enter,edit});
const modules = (id, feature, rights=cap()) => ({ [id]: {...rights, features:{[feature]:rights}} });
async function member() { return (await createPerson({ name:"权限成员",username:"member-login",password:"Valid123!",board:"hrTech",supervisor:"权限成员",role:"主管" })).person; }
async function login(username="member-login") { const res=await fetch(base+"/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username,password:username==="罗成"?"ChangeMe123!":"Valid123!"})}); assert.equal(res.status,200); return res.headers.get("set-cookie").split(";")[0]; }
const request=(url,cookie,method="GET",body)=>fetch(base+url,{method,redirect:"manual",headers:{cookie,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});

test("explicit HR account grants override the old HR-only navigation", async()=>{
 const p=await member(); await savePersonSiteAcl("罗成",p.name,{modules:modules("work","work.today")});
 const user={username:p.username,displayName:p.name}; await resolveDesk(user);
 assert.equal(user.desk,"hr"); assert.equal(isHrDesk(user),false);
 const html=navMarkup("/work",user); assert.match(html,/>工作中心</);assert.doesNotMatch(html,/>首页</);
 assert.equal(publicProfile(user).home,"/work");
 const cookie=await login();assert.equal((await request("/work",cookie)).status,200);
});
test("username aliases, rename and account changes keep grants attached to the person",async()=>{
 const p=await member();await savePersonSiteAcl("罗成",p.name,{modules:modules("work","work.today")});
 assert.equal(navVisibility(p.username).paths["/work"].enter,true);
 await patchPerson(p.id,{name:"新姓名",username:"new-login"});
 assert.equal(navVisibility("new-login").paths["/work"].enter,true);
});
test("see, enter and edit are separately enforced with an existing session",async()=>{
 const p=await member(),cookie=await login();
 const save=rights=>savePersonSiteAcl("罗成",p.name,{modules:modules("work","work.today",rights)});
 await save(cap(true,false,false)); assert.equal(navVisibility(p.username).paths["/work"].see,true);
 assert.equal((await request("/work",cookie)).status,302);assert.equal((await request("/api/work/report",cookie)).status,403);
 await save(cap(true,true,false));assert.equal((await request("/api/work/report",cookie)).status,200);
 assert.equal((await request("/api/work/report",cookie,"PUT",{text:"blocked"})).status,403);assert.equal(writes,0);
 await save(cap());assert.equal((await request("/api/work/report",cookie,"PUT",{text:"allowed"})).status,200);assert.equal(writes,1);
 await savePersonSiteAcl("罗成",p.name,{modules:{},stores:{}});
 assert.equal((await request("/api/work/report",cookie)).status,403);
});
test("denied subfeatures remain blocked within an allowed module",async()=>{
 const p=await member();await savePersonSiteAcl("罗成",p.name,{modules:modules("work","work.today")});const cookie=await login();
 assert.equal((await request("/api/work/report",cookie)).status,200);
 assert.equal((await request("/api/work/settings",cookie)).status,403);
});
test("editing responsibility columns updates role, center and profile immediately",async()=>{
 const p=await member();await patchPerson(p.id,{operator:p.name,lineManager:"沈子晗"});
 let row=listPeople().find(x=>x.id===p.id);assert.equal(row.role,"运营");assert.equal(row.supervisor,"");assert.equal(row.center,"沈子晗运营中心");
 await pinRightsName(p.name,"经理");row=listPeople().find(x=>x.id===p.id);assert.equal(row.role,"经理");assert.equal(row.lineManager,p.name);assert.equal(row.operator,"");
 const user={username:p.username,displayName:p.name};await resolveDesk(user);assert.equal(user.role,"经理");
});
test("maintained store assignments replace the obsolete shop grant list",async()=>{
 const p=await member();const other=(await createPerson({name:"接任成员",password:"Valid123!"})).person;
 const result=await createOrgStore({storeName:"甲店",storeId:"shop-a",operator:p.name,remark:"运营中"},"罗成");assert.equal(result.ok,true);
 const id=result.store?.id||result.row?.id;assert.ok(id);
 assert.deepEqual(listPeople().find(x=>x.id===p.id).visibleShops,["甲店"]);
 assert.ok(listShops().some(x=>x.name==="甲店"));assert.ok(listGrants().some(x=>x.personId===p.id&&x.shopName==="甲店"));
 await patchOrgStore(id,{operator:other.name},"罗成");assert.deepEqual(listPeople().find(x=>x.id===p.id).visibleShops,[]);
 assert.deepEqual(listPeople().find(x=>x.id===other.id).visibleShops,["甲店"]);
});
test("store data grants filter lists and prohibit entry, writes and whole-site writes",async()=>{
 const p=await member();await createOrgStore({storeName:"甲店",storeId:"shop-a",operator:p.name,remark:"运营中"},"罗成");await createOrgStore({storeName:"乙店",storeId:"shop-b",operator:p.name,remark:"运营中"},"罗成");
 const a=listOrgStores({},"罗成").find(x=>x.storeName==="甲店");
 await savePersonSiteAcl("罗成",p.name,{modules:modules("home","home.company"),stores:{[a.id]:cap(true,false,false)}});
 // Access restrictions must not rewrite the person's responsibility assignments.
 assert.deepEqual(listPeople().find(x=>x.id===p.id).visibleShops,["甲店","乙店"]);
 assert.deepEqual(listOrgStores({},p.name).map(x=>x.storeName),["甲店","乙店"]);
 const scope=storeScope(p.username);
 assert.equal(checkStoreRequest(scope,"home",{method:"GET",query:{store:"甲店"}}),false);
 assert.equal(checkStoreRequest(scope,"home",{method:"POST",body:{store:"甲店"}}),false);
 assert.equal(checkStoreRequest(scope,"home",{method:"POST",body:{}}),false);
 const data=filterStorePayload({records:[{store:"甲店",sales:1},{store:"乙店",sales:99}],totals:{sales:100}},scope);
 assert.deepEqual(data.records,[{store:"甲店",sales:1}]);assert.equal(data.totals,undefined);
 const cookie=await login();const response=await request("/api/home/erp-kpis",cookie);assert.equal(response.status,200);
 assert.deepEqual((await response.json()).records,[{store:"甲店",sales:1}]);
});
test("copying a sheet and clearing it retain independent permissions",async()=>{
 const a=await member();const b=(await createPerson({name:"复制目标",username:"copy-target",password:"Valid123!"})).person;
 await savePersonSiteAcl("罗成",a.name,{modules:modules("work","work.today")});
 const sheet=effectiveSiteAcl(a.name);await savePersonSiteAcl("罗成",b.name,sheet);
 await savePersonSiteAcl("罗成",a.name,{modules:{},stores:{}});
 assert.equal(effectiveSiteAcl(a.name).modules.work.enter,false);assert.equal(effectiveSiteAcl(b.username).modules.work.enter,true);
});
test("module feature mapping covers cross-module read and write routes",()=>{
 for(const [module,path,expected] of [["shen","/api/shen/paid/recharge-config","shen.recharge"],["han","/api/han/products/1","han.goods"],["hr","/api/hr/staff/1","hr.staff"],["academy","/api/academy/exams/tracks/1/submit","academy.exams"],["bound","/api/bound/export","bound.export"],["people","/api/people/org/rights-board/pin","people.rights"]]) assert.equal(featureForRequest(module,path),expected);
});

test("every configured module blocks an old session after revocation",async()=>{
 const p=await member(),cookie=await login();
 for(const item of SITE_NAV.filter(row=>row.id!=="profile")) {
   const catalog=SITE_MODULES.find(row=>row.id===item.id);
   await savePersonSiteAcl("罗成",p.name,{modules:{[item.id]:{...cap(),features:Object.fromEntries(catalog.features.map(f=>[f.id,cap()]))}}});
   const path="/api"+item.href+"/acl-test";
   // Notices validates the requested item too; nonexistent items are still not accessible.
   const opened=await request(path,cookie);assert.ok([200,404].includes(opened.status),item.id+" granted: "+opened.status);
   await savePersonSiteAcl("罗成",p.name,{modules:{}});
   assert.equal((await request(path,cookie)).status,403,item.id+" revoked");
 }
});

test("monthly meeting grants permit only the selected sections and preserve the rest on save",async()=>{
 const p=await member(),admin=await login("罗成"),cookie=await login();
 await request("/api/meeting",admin,"PUT",{month:"2026-11",board:{intros:[{name:"新人",role:"运营",text:"介绍"}],stars:[{name:"保留员工",reason:"保留表彰"}]}});
 await savePersonSiteAcl("罗成",p.name,{modules:modules("meeting","meeting.people")});
 let data=await (await request("/api/meeting?month=2026-11",cookie)).json();
 assert.equal(data.board.intros.length,1);assert.deepEqual(data.board.stars,[]);
 const changed=await request("/api/meeting",cookie,"PUT",{month:"2026-11",board:{intros:[{name:"新人二",role:"运营",text:"更新"}],stars:[]}});assert.equal(changed.status,200);
 data=await (await request("/api/meeting?month=2026-11",admin)).json();assert.equal(data.board.intros[0].name,"新人二");assert.equal(data.board.stars[0].name,"保留员工");
});

test("HR-board members can use explicitly granted feedback and status transitions are enforced",async()=>{
 const p=await member(),cookie=await login();await savePersonSiteAcl("罗成",p.name,{modules:modules("feedback","feedback.open")});
 const made=await request("/api/feedback/items",cookie,"POST",{kind:"request",title:"测试需求",body:"描述"});assert.equal(made.status,201);
 const id=(await made.json()).item.id;
 assert.equal((await request("/api/feedback/items/"+id,cookie,"PATCH",{status:"closed"})).status,403);
 await savePersonSiteAcl("罗成",p.name,{modules:{feedback:{...cap(),features:{"feedback.open":cap(),"feedback.closed":cap()}}}});
 assert.equal((await request("/api/feedback/items/"+id,cookie,"PATCH",{status:"closed"})).status,200);
});

test("editing roster role after pinning updates the responsibility board",async()=>{
 const p=await member();await pinRightsName(p.name,"经理");await patchPerson(p.id,{role:"运营"});
 assert.equal(listRightsBoard().candidates.find(row=>row.name===p.name).role,"运营");
});

test("a delayed refresh cannot overwrite a newer save",async()=>{
 const sync=stateSync();let release;const delayed=new Promise(resolve=>{release=resolve;});let state="old",disk="old";
 const read=sync.read(async()=>{await delayed;return "old";},value=>{state=value;});
 state="new";await sync.write({value:state},async snapshot=>{disk=snapshot.value;});release();await read;
 assert.equal(state,"new");assert.equal(disk,"new");
});

test("explicit manager revocation overrides legacy organization defaults while owner access remains",async()=>{
 await savePersonSiteAcl("罗成","沈子晗",{modules:{},stores:{}});
 assert.equal(navVisibility("沈子晗").paths["/people"].enter,false);
 assert.equal(navVisibility("罗成").paths["/people"].edit,true);
});

test("session refresh returns the current complete permissions and store changes update its signature",async()=>{
 const p=await member(),cookie=await login();await savePersonSiteAcl("罗成",p.name,{modules:modules("work","work.today")});
 const first=await (await request("/api/auth/me",cookie)).json();assert.equal(first.siteAcl.paths["/work"].enter,true);
 await savePersonSiteAcl("罗成",p.name,{modules:{},stores:{}});
 const next=await (await request("/api/auth/me",cookie)).json();assert.equal(next.siteAcl.paths["/work"].enter,false);
 assert.notDeepEqual(first.siteAcl,next.siteAcl);
});
