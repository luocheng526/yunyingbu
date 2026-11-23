import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { PWA_ICONS } from '../src/modules/profile/app-pwa-icons.js';

// Exercise the current production middleware without booting unrelated business stores.
const url = new URL('../src/modules/profile/middleware.js', import.meta.url);
const source = fs.readFileSync(url, 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replace(/export /g, '')
  .replaceAll('import.meta.url', JSON.stringify(url.href));
let authReads = 0;
const context = vm.createContext({ fs, path, zlib, fileURLToPath, Buffer, URL, console,
  APP_ICON_PNG: Buffer.from('legacy'), PWA_ICONS,
  currentUser() { authReads++; return null; }, publicProfile: user => user,
  resolveDesk: user => user, navMarkup: () => '',
});
vm.runInContext(source + '\nthis.api={WEB_MANIFEST,isPublicRequest,requireLoginUnlessPublic};', context);
const api = context.api;
function response() {
  return { statusCode:200, headers:{}, body:null,
    status(value) { this.statusCode=value;return this; },
    setHeader(key,value) { this.headers[key]=value; },
    getHeader(key) { return this.headers[key]; },
    type(value) { this.headers['Content-Type']=value;return this; },
    send(value) { this.body=value;return this; },
  };
}

test('public install manifest works before login and preserves the existing app identity', () => {
  const req = { method:'GET',path:'/manifest.webmanifest',query:{},headers:{} };
  const res = response();
  const before = authReads;
  api.requireLoginUnlessPublic(req,res,() => assert.fail('manifest must be served directly'));
  assert.equal(authReads,before);
  assert.equal(res.statusCode,200);
  assert.match(res.headers['Content-Type'],/manifest\+json/);
  const manifest = JSON.parse(res.body);
  assert.equal(manifest.id,'/home');
  assert.equal(manifest.start_url,'/home?app=glass');
  assert.equal(manifest.scope,'/');
  assert.equal(manifest.display,'standalone');
});

test('installation images are public, correctly sized PNGs and do not change legacy icons', () => {
  for (const size of [192,512]) {
    const dest = `/shared/app/icon-${size}.png`;
    const req = {method:'GET',path:dest,query:{},headers:{}};
    const res = response();
    assert.equal(api.isPublicRequest(req),true);
    api.requireLoginUnlessPublic(req,res,() => assert.fail('icon must be served directly'));
    assert.equal(res.body.subarray(1,4).toString(),'PNG');
    assert.equal(res.body.readUInt32BE(16),size);
    assert.equal(res.body.readUInt32BE(20),size);
  }
  const res = response();
  api.requireLoginUnlessPublic({method:'GET',path:'/apple-touch-icon.png',query:{},headers:{}},res,()=>assert.fail());
  assert.equal(res.body.toString(),'legacy');
});

test('adding app assets does not make business routes or writes public', () => {
  for (const dest of ['/home','/hr','/api/home','/api/people','/api/releases']) {
    assert.equal(api.isPublicRequest({method:'GET',path:dest}),false,dest);
  }
  assert.equal(api.isPublicRequest({method:'POST',path:'/manifest.webmanifest'}),false);
});

test('preview manifest matches the served configuration', () => {
  const local=JSON.parse(fs.readFileSync(new URL('../public/shared/app/manifest.webmanifest',import.meta.url),'utf8'));
  assert.deepEqual(JSON.parse(JSON.stringify(api.WEB_MANIFEST)),local);
});
