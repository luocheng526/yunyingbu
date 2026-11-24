import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

test("organization assignments, grants, revocation and empty snapshots survive separate processes", () => {
  const app = fileURLToPath(new URL("../", import.meta.url));
  const isolated = fs.mkdtempSync(path.join(os.tmpdir(), "xm-org-sync-"));
  try {
    fs.writeFileSync(path.join(isolated, "package.json"), '{"type":"module"}');
    fs.symlinkSync(fs.realpathSync(path.join(app,"node_modules")),path.join(isolated,"node_modules"),"junction");
    for(const module of ["people","profile"]) {
      const dest=path.join(isolated,"src/modules",module);fs.mkdirSync(dest,{recursive:true});
      for(const file of fs.readdirSync(path.join(app,"src/modules",module))) if(file.endsWith(".js")) fs.copyFileSync(path.join(app,"src/modules",module,file),path.join(dest,file));
    }
    const script = `
      import assert from 'node:assert/strict';import fs from 'node:fs';
      import * as people from './src/modules/people/store.js';
      import * as org from './src/modules/people/org-board.js';
      import * as acl from './src/modules/people/site-acl.js';
      import { setPoolForTests,setDbMode } from './src/modules/profile/auth.js';
      const cap={see:true,enter:true,edit:true};
      await people.hydratePeopleRoster();await org.hydrateOrgStores();await acl.hydrateSiteAcl();
      const phase=process.env.ORG_PHASE;
      if(phase==='write') {
        const {person}=await people.createPerson({name:'持久化成员',username:'persist-person',password:'Test123!',role:'主管'});
        await org.pinRightsName(person.name,'经理');
        await org.createOrgStore({storeName:'持久化店铺',operator:person.name,remark:'运营中'},'罗成');
        await acl.savePersonSiteAcl('罗成',person.name,{modules:{work:{...cap,features:{'work.today':cap}}}});
      } else if(phase==='revoke') {
        assert.equal(acl.navVisibility('persist-person').paths['/work'].enter,true);
        assert.equal(people.listPeople().find(p=>p.username==='persist-person').role,'经理');
        assert.ok(people.listPeople().find(p=>p.username==='persist-person').visibleShops.includes('持久化店铺'));
        await acl.savePersonSiteAcl('罗成','持久化成员',{modules:{},stores:{}});
      } else if(phase==='read-revoked') {
        assert.equal(acl.navVisibility('persist-person').paths['/work'].enter,false);
      } else if(phase==='database-failure') {
        setPoolForTests({query:async()=>{throw new Error('unavailable')}});setDbMode('mysql');
        await assert.rejects(acl.savePersonSiteAcl('罗成','持久化成员',{modules:{work:{...cap,features:{'work.today':cap}}}}));
        await assert.rejects(acl.hydrateSiteAcl());
        await assert.rejects(org.hydrateOrgStores());
        await assert.rejects(people.hydratePeopleRoster());
      } else if(phase==='empty') {
        fs.writeFileSync('src/modules/people/data/people-roster.json',JSON.stringify({people:[],shops:[],grants:[],loginOverlay:{},nextPersonId:100}));
        fs.writeFileSync('src/modules/people/data/org-stores.json',JSON.stringify({rows:[],rightsPins:{},logs:[],nextId:100}));
      } else if(phase==='read-empty') {
        assert.equal(people.listPeople().length,0);assert.equal(org.listOrgStores({},'罗成').length,0);
      }
    `;
    const env={...process.env};delete env.NODE_TEST_CONTEXT;
    for(const phase of ["write","revoke","read-revoked","database-failure","read-revoked","empty","read-empty"]) execFileSync(process.execPath,["--input-type=module","-e",script],{cwd:isolated,env:{...env,ORG_PHASE:phase},timeout:20000,stdio:"pipe"});
  } finally {
    const link=path.join(isolated,"node_modules");if(fs.existsSync(link))fs.unlinkSync(link);
    if(!path.resolve(isolated).startsWith(path.resolve(os.tmpdir())+path.sep))throw new Error("Unexpected test directory");
    fs.rmSync(isolated,{recursive:true,force:true});
  }
});
