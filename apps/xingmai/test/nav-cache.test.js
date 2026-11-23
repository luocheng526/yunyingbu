import {test, after} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {readFileSync} from 'node:fs';
import {renderAppShell, withSharedShell, requireLoginUnlessPublic, injectHtmlShell, SHELL_ASSET_VER} from '../src/modules/profile/middleware.js';

const app=express();
app.use(requireLoginUnlessPublic);
const server=app.listen(0);
const origin=`http://127.0.0.1:${server.address().port}`;
after(()=>server.close());

test('new documents escape the immutable navigation URL while retaining other asset versions',()=>{
  for(const route of ['/home','/work','/me','/data/overview']){
    const html=renderAppShell(route);
    assert.match(html, /<script src="\/shared\/nav\.js" defer/);
    assert.match(html, /rel="preload" href="\/shared\/nav\.js" as="script"/);
    assert.doesNotMatch(html,/\/shared\/nav\.js\?/);
    assert.ok(html.includes('/shared/layout.css?v='+SHELL_ASSET_VER));
  }
  const old='<html><head><link rel="preload" href="/shared/nav.js?v=old" as="script"></head><body><script src="/shared/nav.js?v=old"></script></body></html>';
  const normalized=withSharedShell(old);
  assert.doesNotMatch(normalized,/\/shared\/nav\.js\?/);
  assert.equal((normalized.match(/<script src="\/shared\/nav\.js"/g)||[]).length,1);
  assert.doesNotMatch(withSharedShell(readFileSync(new URL('../public/login.html',import.meta.url),'utf8')),/\/shared\/nav\.js/);
});

test('HTML response injection replaces an already-versioned script URL',()=>{
  const headers=new Map();let body;
  const res={setHeader:(k,v)=>headers.set(k.toLowerCase(),v),getHeader:k=>headers.get(k.toLowerCase()),send:value=>{body=value;},sendFile(){}};
  injectHtmlShell({headers:{}},res,()=>{});
  res.send('<html><head></head><body><script src="/shared/nav.js?v=old"></script></body></html>');
  assert.match(body,/<script src="\/shared\/nav\.js"/);
  assert.doesNotMatch(body,/\/shared\/nav\.js\?/);
  assert.equal(headers.get('cache-control'),'private, no-store');
});

test('navigation is revalidated with or without a version, for GET and HEAD',async()=>{
  for(const url of ['/shared/nav.js','/shared/nav.js?v=0.1.1361-glass-app'])for(const method of ['GET','HEAD']){
    const response=await fetch(origin+url,{method});
    assert.equal(response.status,200);
    assert.equal(response.headers.get('cache-control'),'public, max-age=0, must-revalidate');
    if(method==='GET')assert.match(await response.text(),/href: "\/work", label: "工作中心"/);
  }
});

test('other versioned assets and private account assets retain their cache policy',async()=>{
  for(const [url,expected] of [
    ['/shared/layout.css?v=existing','public, max-age=86400, immutable'],
    ['/shared/modules/work.js?v=existing','public, max-age=86400, immutable'],
    ['/shared/modules/me.js?v=existing','private, no-store'],
    ['/login.css?v=existing','private, no-store'],
  ]){
    const response=await fetch(origin+url);
    assert.equal(response.status,200);
    assert.equal(response.headers.get('cache-control'),expected);
    await response.arrayBuffer();
  }
});
