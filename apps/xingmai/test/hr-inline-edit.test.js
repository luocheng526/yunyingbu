import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { resetHrStore, createStaff, updateStaff, importStaff, listStaff } from '../src/modules/hr/store.js';
const source = fs.readFileSync(new URL('../public/shared/modules/hr.js', import.meta.url), 'utf8');
function harness(field = 'name', fail = false, data = {}) {
  let handler, input, calls = [], messages = [], renders = 0;
  const person = { id: 1, name: '甲', jobNumber: '001', status: '离职', leftOn: '2026-01-01', phone: '13800000000', tenureMonths: null, ...data };
  const cell = { innerHTML: 'original', getAttribute: key => ({'data-staff-id':'1','data-staff-inline':field,'data-staff-label':field})[key], appendChild: node => { input = node; } };
  const root = { addEventListener: (name, fn) => { handler = fn; }, contains: () => true };
  const context = { document: { createElement: () => ({style:{}, events:{}, setAttribute(){}, addEventListener(name, fn){this.events[name]=fn;}, focus(){}, select(){}, checkValidity(){return true;}}) }, n:()=>'', staffTenureMonths:()=>12, r:()=> '2026-11-27', S:()=>renders++, u:(root,msg)=>messages.push(msg), o:async(url, options)=>{ calls.push({url,...options}); if(fail) throw Error('拒绝保存'); const staff={...person,...options.body}; if(field==='tenureMonths') staff.tenureMonths=options.body.tenureMonths===''?null:Number(options.body.tenureMonths); return {staff}; } };
  vm.runInNewContext(source.slice(source.indexOf('const staffRosterColumns'), source.indexOf('function markStaffInline')),context);
  context.bindStaffInline(root, {view:{staff:[person]}});
  handler({preventDefault(){},target:{closest: selector => selector === '[data-staff-inline]' ? cell : null}});
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
  const saved=await updateStaff(row.id,{status:'在职',clearFields:['leftOn','jobNumber','name']});
  assert.equal(saved.leftOn,'');assert.equal(saved.jobNumber,'');assert.equal(saved.name,'甲');assert.equal(saved.phone,row.phone);assert.equal(saved.position,'运营');
  await importStaff([{name:'甲',department:'运营部',position:''}]);assert.equal((await listStaff())[0].position,'运营');
});

test('在职资料和离职导入共用同一份员工档案', async () => {
  resetHrStore();
  await importStaff([{
    name: '模板测试', department: '运营部', status: '试用', age: 0, idNumber: '001234567890123456',
    regularizedOn: '2027-02-01', graduatedOn: '2024-06', maritalStatus: '未婚', school: '测试院校',
    emergencyPhone: '012345678', contractSigned: '是', laborContractSigned: '否'
  }]);
  const [active] = await listStaff({ status: '在职' });
  assert.equal(active.employmentStage, '试用期');
  assert.equal(active.age, 0);
  assert.equal(active.idNumber, '001234567890123456');
  assert.equal(active.graduatedOn, '2024-06');
  assert.equal(active.emergencyPhone, '012345678');
  assert.equal(active.contractSigned, '是');
  assert.equal(active.laborContractSigned, '否');
  await importStaff([{ name: active.name, department: active.department, leftOn: '2027-04-10', status: '在职' }],
    '', { departures: true });
  const [departed] = await listStaff({ status: '离职' });
  assert.equal(departed.id, active.id);
  assert.equal(departed.leftOn, '2027-04-10');
  assert.equal(departed.school, '测试院校');
  const cleared = await updateStaff(departed.id, { clearFields: ['school', 'emergencyPhone', 'age'] });
  assert.equal(cleared.school ?? '', '');
  assert.equal(cleared.emergencyPhone, '');
  assert.equal(cleared.age, null);
});

test('发现无效的花名册行时先报出表格行号', async () => {
  resetHrStore();
  await assert.rejects(importStaff([
    { name: '第一人' },
    { name: '第二人', age: '-1', sourceRow: '甄选第 4 行' }
  ]), /甄选第 4 行.*年龄/);
  assert.deepEqual(await listStaff(), []);
});

test('职级、司龄和合同到期日独立保存，原有编辑表单不会清除它们', async () => {
  resetHrStore();
  const row = await createStaff({ name: '甲', joinedOn: '2024-06-01' });
  await updateStaff(row.id, { jobLevel: 'P3', tenureMonths: 0, contractEndsOn: '2028-02-29' });
  await updateStaff(row.id, { name: '乙', joinedOn: row.joinedOn }, '', { replace: true });
  const [saved] = await listStaff();
  assert.equal(saved.name, '乙');
  assert.equal(saved.jobLevel, 'P3');
  assert.equal(saved.tenureMonths, 0);
  assert.equal(saved.contractEndsOn, '2028-02-29');
  const cleared = await updateStaff(row.id, { clearFields: ['jobLevel', 'tenureMonths', 'contractEndsOn'] });
  assert.equal(cleared.jobLevel, '');
  assert.equal(cleared.tenureMonths, null);
  assert.equal(cleared.contractEndsOn, '');
  assert.equal(cleared.joinedOn, row.joinedOn);
  await assert.rejects(updateStaff(row.id, { tenureMonths: '1.5' }), /整数月数/);
  await assert.rejects(updateStaff(row.id, { contractEndsOn: '2027-02-29' }), /有效的合同到期日/);
});

test('内联编辑能确认零个月司龄及恢复自动计算', async () => {
  const h = harness('tenureMonths');
  assert.equal(h.input.type, 'number');
  h.input.value = '0';
  h.input.events.blur();
  await tick();
  assert.equal(h.person.tenureMonths, 0);
  const automatic = harness('tenureMonths', false, { tenureMonths: 0 });
  automatic.input.value = '';
  automatic.input.events.blur();
  await tick();
  assert.equal(automatic.person.tenureMonths, null);
  assert.deepEqual(Array.from(automatic.calls[0].body.clearFields), ['tenureMonths']);
  assert.equal(h.renders(), 1);
  assert.equal(harness('contractEndsOn').input.type, 'date');
});
