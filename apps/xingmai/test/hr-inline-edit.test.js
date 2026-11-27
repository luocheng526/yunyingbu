import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { resetHrStore, createStaff, updateStaff, importStaff, listStaff } from '../src/modules/hr/store.js';
const source = fs.readFileSync(new URL('../public/shared/modules/hr.js', import.meta.url), 'utf8');
function harness(field = 'name', fail = false) {
  let handler, input, calls = [], messages = [], renders = 0;
  const person = { id: 1, name: '甲', jobNumber: '001', status: '离职', leftOn: '2026-01-01', phone: '13800000000' };
  const cell = { innerHTML: 'original', getAttribute: key => ({'data-staff-id':'1','data-staff-inline':field,'data-staff-label':field})[key], appendChild: node => { input = node; } };
  const root = { addEventListener: (name, fn) => { handler = fn; }, contains: () => true };
  const context = { document: { createElement: () => ({style:{}, events:{}, setAttribute(){}, addEventListener(name, fn){this.events[name]=fn;}, focus(){}, select(){}, checkValidity(){return true;}}) }, n:()=>'', S:()=>renders++, u:(root,msg)=>messages.push(msg), o:async(url, options)=>{ calls.push({url,...options}); if(fail) throw Error('拒绝保存'); return {staff:{...person,...options.body}}; } };
  vm.runInNewContext(source.slice(source.indexOf('function bindStaffInline'), source.indexOf('function markStaffInline')),context);
  context.bindStaffInline(root, {view:{staff:[person]}});
  handler({target:{closest: selector => selector === '[data-staff-inline]' ? cell : null}});
  return { input, cell, calls, messages, person, renders:()=>renders };
}
const tick = () => new Promise(resolve=>setImmediate(resolve));
test('inline Enter saves only the edited field and waits for confirmation', async()=>{
  const h=harness(); h.input.value='乙'; h.input.events.keydown({key:'Enter',preventDefault(){}}); h.input.events.blur(); await tick();
  assert.equal(h.calls.length,1); assert.deepEqual(JSON.parse(JSON.stringify(h.calls[0].body)),{replace:false,name:'乙'}); assert.equal(h.person.name,'乙'); assert.equal(h.renders(),1);
});
test('Escape and unchanged blur do not save',()=>{
  for(const key of ['Escape','Enter']) { const h=harness(); h.input.events.keydown({key,preventDefault(){}}); assert.equal(h.calls.length,0); assert.equal(h.cell.innerHTML,'original'); }
});
test('failed save keeps editor and entered value; empty name is rejected',async()=>{
  const h=harness('name',true);h.input.value='乙';h.input.events.blur();await tick();assert.equal(h.input.disabled,false);assert.equal(h.input.value,'乙');assert.equal(h.person.name,'甲');assert.equal(h.renders(),0);
  const empty=harness();empty.input.value=' ';empty.input.events.blur();assert.equal(empty.calls.length,0);
});
test('clearing values and returning to active use explicit clear fields',async()=>{
  const h=harness('jobNumber');h.input.value='';h.input.events.blur();await tick();assert.equal(h.calls[0].body.clearFields[0],'jobNumber');
  const status=harness('status');status.input.value='在职';status.input.events.blur();await tick();assert.equal(status.calls[0].body.clearFields[0],'leftOn');
});
test('staff patch preserves other data and imports retain blank merge behavior',async()=>{
  resetHrStore(); const row=await createStaff({name:'甲',jobNumber:'001',department:'运营部',position:'运营',phone:'13800000000',status:'离职',leftOn:'2026-01-01'});
  const saved=await updateStaff(row.id,{status:'在职',clearFields:['leftOn','jobNumber','name','phone']});
  assert.equal(saved.leftOn,'');assert.equal(saved.jobNumber,'');assert.equal(saved.name,'甲');assert.equal(saved.phone,row.phone);assert.equal(saved.position,'运营');
  await importStaff([{name:'甲',department:'运营部',position:''}]);assert.equal((await listStaff())[0].position,'运营');
});
