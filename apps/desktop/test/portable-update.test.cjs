const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {execFile,spawn} = require('node:child_process');
const {promisify} = require('node:util');
const {startReplacement} = require('../portable-update.cjs');
const exec=promisify(execFile);
const powershell=path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
const run=script=>exec(powershell,['-NoProfile','-NonInteractive','-WindowStyle','Hidden','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:true,timeout:30000});
async function compile(filename,marker) {
  const data=Buffer.from(JSON.stringify({filename,marker})).toString('base64');
  await run(`$ErrorActionPreference='Stop'; $cfg=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${data}'))|ConvertFrom-Json
$source='public class UpdateProbe { public static void Main() { System.IO.File.WriteAllText(System.IO.Path.Combine(System.AppDomain.CurrentDomain.BaseDirectory, "'+$cfg.marker+'"), "started"); } }'
Add-Type -TypeDefinition $source -OutputAssembly $cfg.filename -OutputType WindowsApplication`);
}
test('Windows replacement handles Chinese/quoted paths, waits for exit, and restores the old executable if launching fails',{skip:process.platform!=='win32',timeout:60000},async t=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),"xm-update-中文 '$-"));
  t.after(async()=>{assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));await fs.rm(directory,{recursive:true,force:true});});
  const original=path.join(directory,'old.exe'),next=path.join(directory,'new.exe');
  await compile(original,'old-started');await compile(next,'new-started');
  const target=path.join(directory,"甄选未来 '$ App.exe"),cacheDir=path.join(directory,'cache');
  await fs.mkdir(cacheDir);const staged=path.join(cacheDir,'update.exe');
  for(const valid of [true,false]) {
    await fs.copyFile(original,target);
    const bytes=valid?await fs.readFile(next):Buffer.concat([Buffer.from('MZ'),Buffer.alloc(2048,6)]);
    await fs.writeFile(staged,bytes);
    const parent=spawn(process.execPath,['-e','setTimeout(()=>{},2500)'],{windowsHide:true,stdio:'ignore'});
    const update={version:'0.2.3',size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
    const started=Date.now();
    const {config}=await startReplacement({target,staged,update,cacheDir,pid:parent.pid});
    for(let i=0;i<120;i++) {
      try{const result=JSON.parse(await fs.readFile(config.report,'utf8'));if(result.status===(valid?'installed':'error'))break;}catch{}
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    const result=JSON.parse(await fs.readFile(config.report,'utf8'));
    assert.ok(Date.now()-started>=2000,'helper must wait for the running App: '+JSON.stringify(result));
    assert.equal(result.status,valid?'installed':'error');
    assert.deepEqual(await fs.readFile(target),valid?bytes:await fs.readFile(original));
    const marker=path.join(directory,valid?'new-started':'old-started');
    for(let i=0;i<30;i++){try{await fs.access(marker);break;}catch{await new Promise(resolve=>setTimeout(resolve,100));}}
    assert.equal(await fs.readFile(marker,'utf8'),'started');
    await assert.rejects(fs.access(config.backup));await assert.rejects(fs.access(config.incoming));
    await fs.rm(config.report,{force:true});
  }
});
