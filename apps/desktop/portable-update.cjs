const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const exec = promisify(execFile);

// All paths originate in the main process. No shell interpolation of paths,
// release notes or renderer input; JSON is passed as base64 data.
function replacementScript(config) {
  const data = Buffer.from(JSON.stringify(config),'utf8').toString('base64');
  return `$ErrorActionPreference = 'Stop'
$cfg = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${data}')) | ConvertFrom-Json
$target = [IO.Path]::GetFullPath($cfg.target)
$staged = [IO.Path]::GetFullPath($cfg.staged)
$incoming = [IO.Path]::GetFullPath($cfg.incoming)
$backup = [IO.Path]::GetFullPath($cfg.backup)
$movedOld = $false
$installed = $false
$parentExited = $false
function Write-Result($status, $message, $detail) {
  $result = @{ status=$status; message=$message; version=$cfg.version; detail=$detail } | ConvertTo-Json -Compress
  [IO.File]::WriteAllText($cfg.report, $result, (New-Object Text.UTF8Encoding($false)))
}
function Verify-Package($file) {
  if ((Get-Item -LiteralPath $file).Length -ne $cfg.size) { throw 'Package size mismatch' }
  $stream = [IO.File]::OpenRead($file)
  $hasher = [Security.Cryptography.SHA256]::Create()
  try { $digest = [BitConverter]::ToString($hasher.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() }
  finally { $stream.Dispose(); $hasher.Dispose() }
  if ($digest -ne $cfg.sha256) { throw 'Package hash mismatch' }
}
try {
  if (-not [IO.Path]::IsPathRooted($cfg.target) -or -not [IO.Path]::IsPathRooted($cfg.staged) -or $target -eq $staged -or [IO.Path]::GetExtension($target) -ne '.exe') { throw 'Invalid target path' }
  $cachePrefix = [IO.Path]::GetFullPath($cfg.cacheDir).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
  if (-not $staged.StartsWith($cachePrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Package outside update cache' }
  $targetDir = [IO.Path]::GetDirectoryName($target)
  if ([IO.Path]::GetDirectoryName($incoming) -ne $targetDir -or [IO.Path]::GetDirectoryName($backup) -ne $targetDir) { throw 'Replacement path outside target directory' }
  if (-not (Test-Path -LiteralPath $target -PathType Leaf) -or (Test-Path -LiteralPath $incoming) -or (Test-Path -LiteralPath $backup)) { throw 'Invalid replacement files' }
  Verify-Package $staged
  Copy-Item -LiteralPath $staged -Destination $incoming
  Verify-Package $incoming
  [IO.File]::WriteAllText($cfg.ready, 'ready')
  $parent = Get-Process -Id $cfg.pid -ErrorAction SilentlyContinue
  if ($parent) { Wait-Process -Id $cfg.pid -Timeout 120 -ErrorAction Stop }
  $parentExited = $true
  # The portable launcher can hold the outer EXE briefly after Electron exits.
  for ($attempt=0; $attempt -lt 60; $attempt++) {
    try { Move-Item -LiteralPath $target -Destination $backup; $movedOld = $true; break }
    catch { if ($attempt -eq 59) { throw }; Start-Sleep -Milliseconds 500 }
  }
  Move-Item -LiteralPath $incoming -Destination $target
  $installed = $true
  Verify-Package $target
  Write-Result 'installed' ''
  # This is the employee's interactive App, so the new window stays visible.
  Start-Process -FilePath $target -WorkingDirectory $targetDir
  Remove-Item -LiteralPath $backup -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $staged -Force -ErrorAction SilentlyContinue
} catch {
  try {
    if ($installed -and (Test-Path -LiteralPath $target)) { Remove-Item -LiteralPath $target -Force }
    if ($movedOld -and (Test-Path -LiteralPath $backup)) { Move-Item -LiteralPath $backup -Destination $target }
    Write-Result 'error' '更新未完成，已保留原版本。请重试，或从原网站下载新版。' $_.Exception.Message
    if ($parentExited -and (Test-Path -LiteralPath $target)) { Start-Process -FilePath $target -WorkingDirectory ([IO.Path]::GetDirectoryName($target)) }
  } catch { Write-Result 'error' '更新未完成，请从原网站重新下载 App。原文件备份仍保留在同一目录。' }
} finally {
  if (Test-Path -LiteralPath $incoming) { Remove-Item -LiteralPath $incoming -Force -ErrorAction SilentlyContinue }
}
`;
}

function makeReplacementConfig({target,staged,update,cacheDir,pid=process.pid}) {
  if (!path.isAbsolute(target) || !path.isAbsolute(staged) || path.extname(target).toLowerCase() !== '.exe') throw new Error('无法确定免安装 App 的原文件位置');
  const cache = path.resolve(cacheDir), relative = path.relative(cache,path.resolve(staged));
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('更新包路径无效');
  target = path.resolve(target); staged = path.resolve(staged);
  const id = randomUUID();
  return {target,staged,pid,cacheDir:cache,version:update.version,size:update.size,sha256:update.sha256,
    incoming:target+'.incoming-'+id,backup:target+'.previous-'+id,
    ready:path.join(path.dirname(staged),'helper-ready-'+id),report:path.join(cache,'last-result.json')};
}
async function startReplacement(options) {
  const config = makeReplacementConfig(options);
  const command = Buffer.from(replacementScript(config),'utf16le').toString('base64');
  const env = {...process.env};
  for (const key of Object.keys(env)) if (key.startsWith('PORTABLE_') || key === 'ELECTRON_RUN_AS_NODE') delete env[key];
  const exe = path.join(process.env.SystemRoot || 'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
  // A short-lived Windows broker starts an independent hidden process. Direct
  // DETACHED_PROCESS PowerShell may exit before executing, while an ordinary
  // child may be terminated with its parent/job during an App restart.
  const commandFile=path.join(path.dirname(config.ready),'command-'+path.basename(config.ready)+'.txt');
  await fs.writeFile(commandFile,command,{flag:'wx'});
  const data=Buffer.from(JSON.stringify({exe,commandFile}),'utf8').toString('base64');
  const broker=`$ErrorActionPreference='Stop'; $data=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${data}'))|ConvertFrom-Json; $job=Start-Process -FilePath $data.exe -ArgumentList @('-NoLogo','-NoProfile','-NonInteractive','-WindowStyle','Hidden','-EncodedCommand',([IO.File]::ReadAllText($data.commandFile))) -WindowStyle Hidden -PassThru; [Console]::WriteLine($job.Id)`;
  const {stdout}=await exec(exe,['-NoLogo','-NoProfile','-NonInteractive','-WindowStyle','Hidden','-EncodedCommand',Buffer.from(broker,'utf16le').toString('base64')],{windowsHide:true,env,timeout:15000});
  const helperPid=Number(stdout.trim());
  if(!Number.isSafeInteger(helperPid)||helperPid<=0)throw new Error('无法启动更新程序，请稍后重试');
  const running=()=>{try{process.kill(helperPid,0);return true;}catch{return false;}};
  const cancel=()=>{try{process.kill(helperPid);}catch{};fs.rm(config.incoming,{force:true}).catch(()=>{});};
  for (let i=0;i<600;i++) {
    try { if (await fs.readFile(config.ready,'utf8') === 'ready') return {config,cancel}; } catch {}
    if (!running()) break;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  // Never leave a delayed helper waiting to install after reporting failure.
  if(running()) cancel();
  throw new Error('无法准备更新，请确认 App 所在文件夹可写，或从原网站下载新版');
}
module.exports = { replacementScript, makeReplacementConfig, startReplacement };
