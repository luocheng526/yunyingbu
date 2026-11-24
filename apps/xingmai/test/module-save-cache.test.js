import {test, after} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {readFileSync} from 'node:fs';
import {renderAppShell, withSharedShell, requireLoginUnlessPublic} from '../src/modules/profile/middleware.js';

const app=express();app.use(requireLoginUnlessPublic);
const server=app.listen(0,'127.0.0.1');
await new Promise(resolve=>server.on('listening',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
after(()=>server.close());

test('initial module preload and script URLs escape the old immutable cache',()=>{
  for(const route of ['/people','/work','/han/paid','/hr','/meeting','/feedback','/me']){
    const html=renderAppShell(route);
    assert.match(html,/rel="preload" href="\/shared\/modules\/[a-z-]+\.js" as="script"/);
    assert.match(html,/<script src="\/shared\/modules\/[a-z-]+\.js" defer/);
    assert.doesNotMatch(html,/\/shared\/modules\/[^" ]+\.js\?/);
  }
});
test('existing HTML including compound module names gets safe module URLs',()=>{
  const html='<html><head><link rel="preload" href="/shared/modules/people.js?v=old" as="script" /></head><body><script src="/shared/modules/people.js?v=old"></script><script src="/shared/modules/work-center.js?v=old"></script></body></html>';
  const result=withSharedShell(html);
  assert.doesNotMatch(result,/\/shared\/modules\/[^" ]+\.js\?/);
  assert.match(result,/\/shared\/modules\/work-center\.js"/);
});
test('GET and HEAD revalidate current and legacy module URLs, including auxiliary scripts',async()=>{
  for(const name of ['people','work','han','hr','bound','notices','work-center','work-tasks','han-center']){
    for(const suffix of ['', '?v=0.1.1361-glass-app'])for(const method of ['GET','HEAD']){
      const response=await fetch(`${origin}/shared/modules/${name}.js${suffix}`,{method});
      assert.equal(response.status,200,name);
      assert.equal(response.headers.get('cache-control'),'public, max-age=0, must-revalidate',name);
      if(method==='GET')await response.arrayBuffer();
    }
  }
});
test('private account scripts and versioned styles retain their existing policy',async()=>{
  for(const [url,cache] of [['/shared/modules/me.js?v=old','private, no-store'],['/login.css?v=old','private, no-store'],['/shared/layout.css?v=old','public, max-age=86400, immutable']]){
    const response=await fetch(origin+url);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),cache);await response.arrayBuffer();
  }
});
test('lazy companion loaders no longer request fixed-version immutable URLs',()=>{
  for(const file of ['work','han']){
    const source=readFileSync(new URL(`../public/shared/modules/${file}.js`,import.meta.url),'utf8');
    assert.doesNotMatch(source,/script\.src\s*=\s*["']\/shared\/modules\/[^"']+\.js\?v=/);
    assert.doesNotMatch(source,/editor\.src\s*=\s*["']\/shared\/modules\/[^"']+\.js\?v=/);
  }
});
