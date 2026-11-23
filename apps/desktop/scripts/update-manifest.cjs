// Run after pack:win. The manifest goes through the website release gate;
// upload and verify the matching executable before submitting it.
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {validateManifest} = require('../update-policy.cjs');
const root=path.resolve(__dirname,'..');
const {version}=require('../package.json');
const release=require('../release-notes.json');
if(release.version!==version) throw new Error('Release notes do not match package version');
const filename=`ZhenxuanFuture-${version}-win-x64.exe`;
const bytes=fs.readFileSync(path.join(root,'dist',filename));
if(bytes.subarray(0,2).toString()!=='MZ')throw new Error('Not a Windows executable');
const manifest={schema:1,version,publishedAt:new Date().toISOString(),notes:release.notes,platforms:{'win32-x64':{
  url:`https://github.com/luocheng526/yunyingbu/releases/download/desktop-v${version}/${filename}`,
  size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}}};
validateManifest(manifest);
const destination=path.resolve(root,'../xingmai/public/shared/app/desktop-update.json');
fs.writeFileSync(destination,JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({version,destination,size:bytes.length,sha256:manifest.platforms['win32-x64'].sha256}));
