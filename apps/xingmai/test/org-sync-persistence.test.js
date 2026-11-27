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
      } else if (phase === 'delete-race') {
        const {person: assistant} = await people.createPerson({name:'待删除助理',role:'助理'});
        const {person: operator} = await people.createPerson({name:'保留运营',role:'运营',assistant:assistant.name});
        const {person: duplicate} = await people.createPerson({name:'同名成员',board:'hrTech',department:'技术部'});
        const {person: homonym} = await people.createPerson({name:'同名成员',board:'hrTech',department:'人事部'});
        const {person: teammate} = await people.createPerson({name:'保留同名引用',role:'运营',assistant:homonym.name});
        const {person: dependent} = await people.createPerson({name:'保留下属',managerId:assistant.id});
        await org.createOrgStore({storeName:'删除测试店铺',assistant:assistant.name,remark:'运营中'},'罗成');
        assert.equal(operator.assistant, assistant.name);
        assert.equal(teammate.assistant, homonym.name);
        assert.equal(dependent.managerId, assistant.id);
        assert.ok(people.listGrants().some(grant => grant.personId === assistant.id));

        let payload = fs.readFileSync('src/modules/people/data/people-roster.json','utf8');
        let unblockLegacyDelete;
        let markLegacyDeleteStarted;
        const legacyDeleteBlocked = new Promise(resolve => { unblockLegacyDelete = resolve; });
        const legacyDeleteStarted = new Promise(resolve => { markLegacyDeleteStarted = resolve; });
        setPoolForTests({query:async (sql, values) => {
          if (sql.startsWith('SELECT payload FROM people_roster_board')) return [[{payload}]];
          if (sql.startsWith('INSERT INTO people_roster_board')) payload = values[0];
          if (sql.startsWith('DELETE FROM people_grants')) {
            markLegacyDeleteStarted();
            await legacyDeleteBlocked;
          }
          return [[]];
        }});
        setDbMode('mysql');

        const deletion = people.removePeople([assistant.id, duplicate.id]);
        await legacyDeleteStarted;
        try {
          await people.hydratePeopleRoster();
        } finally {
          unblockLegacyDelete();
        }
        assert.equal((await deletion).removed, 2);
        await people.hydratePeopleRoster();
        const roster = people.listPeople();
        assert.ok(!roster.some(row => row.id === assistant.id || row.id === duplicate.id), 'a concurrent read must not restore deleted members');
        assert.ok(!people.listGrants().some(grant => grant.personId === assistant.id));
        assert.equal(roster.find(row => row.id === operator.id).assistant, '');
        assert.equal(roster.find(row => row.id === dependent.id).managerId, null);
        assert.equal(roster.find(row => row.id === teammate.id).assistant, homonym.name);
        assert.ok(roster.some(row => row.id === homonym.id));
      } else if(phase==='empty') {
        fs.writeFileSync('src/modules/people/data/people-roster.json',JSON.stringify({people:[],shops:[],grants:[],loginOverlay:{},nextPersonId:100}));
        fs.writeFileSync('src/modules/people/data/org-stores.json',JSON.stringify({rows:[],rightsPins:{},logs:[],nextId:100}));
      } else if(phase==='read-empty') {
        assert.equal(people.listPeople().length,0);assert.equal(org.listOrgStores({},'罗成').length,0);
      }
    `;
    const env={...process.env};delete env.NODE_TEST_CONTEXT;
    for(const phase of ["write","revoke","read-revoked","database-failure","read-revoked","delete-race","empty","read-empty"]) execFileSync(process.execPath,["--input-type=module","-e",script],{cwd:isolated,env:{...env,ORG_PHASE:phase},timeout:20000,stdio:"pipe"});
  } finally {
    const link=path.join(isolated,"node_modules");if(fs.existsSync(link))fs.unlinkSync(link);
    if(!path.resolve(isolated).startsWith(path.resolve(os.tmpdir())+path.sep))throw new Error("Unexpected test directory");
    fs.rmSync(isolated,{recursive:true,force:true});
  }
});
