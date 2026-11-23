const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {validateManifest,newerVersion,allowedDownloadRedirect,FEED_URL} = require('../update-policy.cjs');
const {UpdateService} = require('../update-service.cjs');
const {makeReplacementConfig} = require('../portable-update.cjs');
const bytes=Buffer.concat([Buffer.from('MZ'),Buffer.alloc(2048,7)]);
function manifest() { return {schema:1,version:'0.2.3',notes:['更新说明 <script> remains text'],platforms:{'win32-x64':{
  url:'https://github.com/luocheng526/yunyingbu/releases/download/desktop-v0.2.3/ZhenxuanFuture-0.2.3-win-x64.exe',
  size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}}}; }
async function service(t,fetch) {
  const cacheDir=await fs.mkdtemp(path.join(os.tmpdir(),'xm-update-test-'));
  t.after(()=>fs.rm(cacheDir,{recursive:true,force:true}));
  return new UpdateService({currentVersion:'0.2.2',supported:true,cacheDir,fetch});
}
test('release ordering handles multi-digit versions and rejects prereleases or malformed manifests',()=>{
  assert.equal(newerVersion('0.2.10','0.2.9'),true);
  assert.equal(newerVersion('0.2.3','0.2.3'),false);
  assert.equal(newerVersion('0.1.99','0.2.3'),false);
  for(const value of ['0.2.4-beta','0.2.3.4','00.2.3','9999999999999999999.0.0']) assert.throws(()=>newerVersion(value,'0.2.3'));
  const bad=manifest();bad.platforms['win32-x64'].url='https://evil.example/update.exe';assert.throws(()=>validateManifest(bad));
  bad.platforms['win32-x64']=manifest().platforms['win32-x64'];bad.platforms['win32-x64'].sha256='bad';assert.throws(()=>validateManifest(bad));
  assert.equal(allowedDownloadRedirect('https://release-assets.githubusercontent.com/a?token=public-download'),true);
  for(const url of ['http://github.com/luocheng526/yunyingbu/releases/download/a','https://github.com/another/repo/releases/download/a','file:///C:/update.exe','https://release-assets.githubusercontent.com.evil.example/a','https://user:pass@objects.githubusercontent.com/a']) assert.equal(allowedDownloadRedirect(url),false);
});
test('checking is deduplicated and never downloads or installs without an explicit action',async t=>{
  let calls=0;
  const updater=await service(t,async(url,options)=>{calls++;assert.ok(url.startsWith(FEED_URL));assert.equal(options.credentials,'omit');return Response.json(manifest());});
  await Promise.all([updater.check(),updater.check(),updater.check()]);
  assert.equal(calls,1);assert.equal(updater.state.status,'available');assert.equal(updater.file,null);
  await updater.check();assert.equal(calls,1);
});
test('same or older published versions never offer a downgrade',async t=>{
  const updater=await service(t,async()=>Response.json(manifest()));updater.state.currentVersion='0.3.0';
  await updater.check();assert.equal(updater.state.status,'current');assert.equal(updater.state.update,null);
});
test('verified download reaches ready and tampering is detected again immediately before installation',async t=>{
  const updater=await service(t,async url=>url.startsWith(FEED_URL)?Response.json(manifest()):new Response(bytes));
  await updater.check();await updater.download();assert.equal(updater.state.status,'ready');assert.equal(updater.state.progress,100);
  const prepared=await updater.verifiedPackage();assert.deepEqual(await fs.readFile(prepared.file),bytes);
  await fs.writeFile(prepared.file,Buffer.concat([Buffer.from('MZ'),Buffer.alloc(2048,5)]));await assert.rejects(()=>updater.verifiedPackage(),/校验失败/);
});
test('hash mismatch, excess bytes and incomplete downloads never leave an installable file',async t=>{
  for(const body of [Buffer.concat([Buffer.from('MZ'),Buffer.alloc(2048,8)]),Buffer.concat([bytes,Buffer.from('extra')]),bytes.subarray(0,100)]) {
    const updater=await service(t,async url=>url.startsWith(FEED_URL)?Response.json(manifest()):new Response(body));
    await updater.check();await updater.download();assert.equal(updater.state.status,'error');assert.equal(updater.file,null);
    assert.deepEqual(await fs.readdir(updater.cacheDir),[]);
  }
});
test('download redirects must stay on the release CDN and never carry authentication',async t=>{
  const calls=[];
  const updater=await service(t,async(url,opts)=>{
    calls.push([url,opts]);
    if(url.startsWith(FEED_URL))return Response.json(manifest());
    if(url.startsWith('https://github.com/'))return new Response(null,{status:302,headers:{location:'https://release-assets.githubusercontent.com/file'}});
    assert.equal(opts.credentials,'omit');assert.equal(opts.headers,undefined);return new Response(bytes);
  });
  await updater.check();await updater.download();assert.equal(updater.state.status,'ready');assert.equal(calls.length,3);
  const blocked=await service(t,async url=>url.startsWith(FEED_URL)?Response.json(manifest()):new Response(null,{status:302,headers:{location:'http://evil.example/update'}}));
  await blocked.check();await blocked.download();assert.equal(blocked.state.status,'error');assert.equal(blocked.file,null);
});
test('cancel interrupts a download, cleans its partial file and allows retry',async t=>{
  let downloadStarted;
  const started=new Promise(resolve=>{downloadStarted=resolve;});
  const updater=await service(t,async(url,opts)=>{
    if(url.startsWith(FEED_URL))return Response.json(manifest());
    downloadStarted();
    return new Response(new ReadableStream({start(controller){controller.enqueue(bytes.subarray(0,50));opts.signal.addEventListener('abort',()=>controller.error(opts.signal.reason),{once:true});}}));
  });
  await updater.check();const downloading=updater.download();await started;updater.cancel();await downloading;
  assert.equal(updater.state.status,'available');assert.equal(updater.file,null);assert.equal(updater.pending,null);
  updater.fetch=async()=>new Response(bytes);await updater.download();assert.equal(updater.state.status,'ready');
});
test('offline checks and unavailable feeds stay recoverable without affecting the running App',async t=>{
  const updater=await service(t,async()=>{throw new Error('network');});
  await updater.check();assert.equal(updater.state.status,'error');assert.equal(updater.state.currentVersion,'0.2.2');
  updater.lastCheck=0;updater.fetch=async()=>new Response('',{status:404});await updater.check();assert.match(updater.state.message,/准备/);
  updater.lastCheck=0;updater.fetch=async()=>Response.json(manifest());await updater.check();assert.equal(updater.state.status,'available');
});
test('update helper cannot receive a staged executable outside its own cache',()=>{
  const cacheDir=path.resolve('fixture-updates'),target=path.resolve('fixture-app.exe');
  assert.throws(()=>makeReplacementConfig({target,staged:path.resolve('outside.exe'),cacheDir,update:validateManifest(manifest())}));
  const config=makeReplacementConfig({target,staged:path.join(cacheDir,'download-one','update.exe'),cacheDir,update:validateManifest(manifest())});
  assert.equal(path.dirname(config.incoming),path.dirname(target));assert.equal(path.dirname(config.backup),path.dirname(target));
});
