import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnnotations } from '../src/modules/bound/annotations.js';
const key='JD:16501691:goods:10225590259558', from='2026-10-03';
function setup() { const db=new Map();return {db,api:createAnnotations({read:async keys=>keys.filter(k=>db.has(k)).map(k=>({rowKey:k,...db.get(k)})),write:async(k,v)=>{db.set(k,v);}})}; }
test('标签和跟进并发更新不互相覆盖；目标按日期范围独立回读',async()=>{
  const {api}=setup();
  await Promise.all([api.save({keys:[key],from,field:'tag',value:'重点'}),api.save({keys:[key],from,field:'follow',value:'周一复查'})]);
  await api.save({keys:[key],from,field:'target',value:{metric:'gmv',value:5000}});
  const a=(await api.get({keys:[key],from})).marks[key];
  assert.equal(a.tag,'重点');assert.equal(a.follow,'周一复查');assert.deepEqual(a.target,{metric:'gmv',value:5000});
  const b=(await api.get({keys:[key],from:'2026-10-04'})).marks[key];assert.equal(b.target,null);assert.equal(b.tag,'重点');
  await api.save({keys:[key],from,field:'tag',value:''});
  assert.equal((await api.get({keys:[key],from})).marks[key].follow,'周一复查');
});
test('拒绝行号、未知身份、越界日期及非法目标，空选择不能扫出全部标注',async()=>{
  const {api,db}=setup();
  for (const input of [{keys:[],from},{keys:['0'],from},{keys:[key],from:'2026-08-31'},{keys:[key],from:'2026-02-30'}]) assert.equal((await api.get(input)).statusCode,400);
  for (const value of [{metric:'gmv',value:NaN},{metric:'gmv',value:-1},{metric:'__proto__',value:10}]) assert.equal((await api.save({keys:[key],from,field:'target',value})).statusCode,400);
  assert.equal((await api.save({keys:[key],from,field:'follow',value:'x'.repeat(501)})).statusCode,400);assert.equal(db.size,0);
});
