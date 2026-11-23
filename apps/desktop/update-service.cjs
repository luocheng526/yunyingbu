const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { FEED_URL, newerVersion, validateManifest, allowedDownloadRedirect } = require('./update-policy.cjs');

async function limitedText(response, maxBytes) {
  const chunks = []; let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
    if (bytes > maxBytes) throw new Error('更新信息过大');
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}
async function verifyFile(filename, update) {
  const handle = await fs.open(filename, 'r');
  try {
    if ((await handle.stat()).size !== update.size) throw new Error('更新包大小校验失败，请重新下载');
    const hash = createHash('sha256'); let first = true;
    for await (const chunk of handle.createReadStream({autoClose:false})) {
      if (first && chunk.subarray(0,2).toString() !== 'MZ') throw new Error('更新包格式无效');
      first = false; hash.update(chunk);
    }
    if (hash.digest('hex') !== update.sha256) throw new Error('更新包校验失败，请重新下载');
  } finally { await handle.close(); }
}

class UpdateService {
  constructor({ currentVersion, supported, cacheDir, fetch, onState = () => {}, onError = () => {} }) {
    this.cacheDir = cacheDir; this.fetch = fetch; this.onState = onState; this.onError = onError;
    this.state = { status: supported ? 'idle' : 'unsupported', currentVersion, supported, update: null, progress: 0, message: '', checkedAt: null };
    this.pending = null; this.file = null; this.controller = null; this.lastCheck = 0;
  }
  snapshot() { return structuredClone(this.state); }
  emit(patch) { Object.assign(this.state, patch); this.onState(this.snapshot()); return this.snapshot(); }
  check() {
    if (this.pending) return this.pending;
    if (!this.state.supported || ['ready','installing'].includes(this.state.status) || Date.now() - this.lastCheck < 10000) return Promise.resolve(this.snapshot());
    this.lastCheck = Date.now();
    this.pending = this.checkNow().finally(() => { this.pending = null; });
    return this.pending;
  }
  async checkNow() {
    this.emit({status:'checking',message:''});
    try {
      const response = await this.fetch(FEED_URL + '?t=' + Date.now(), { cache:'no-store', credentials:'omit', redirect:'error', signal:AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error(response.status === 404 ? '更新服务正在准备中，请稍后再试' : '暂时无法检查更新，请稍后重试');
      const update = validateManifest(JSON.parse(await limitedText(response, 65536)));
      const available = newerVersion(update.version, this.state.currentVersion);
      return this.emit({ status:available?'available':'current', update:available?update:null, checkedAt:Date.now(), message:'', progress:0 });
    } catch (error) {
      this.onError(error);
      return this.emit({status:'error',phase:'check',message:/^更新|^暂时/.test(error.message)?error.message:'网络连接失败，请稍后重试'});
    }
  }
  download() {
    if (this.pending) return this.pending;
    if (!this.state.supported || !this.state.update || ['ready','installing'].includes(this.state.status)) return Promise.resolve(this.snapshot());
    this.pending = this.downloadNow().finally(() => { this.pending = null; this.controller = null; });
    return this.pending;
  }
  async downloadNow() {
    const update = this.state.update; let handle, directory;
    this.controller = new AbortController();
    const signal = AbortSignal.any([this.controller.signal, AbortSignal.timeout(15 * 60 * 1000)]);
    this.emit({status:'downloading',phase:'download',message:'',progress:0});
    try {
      let url = update.url, response;
      for (let hops = 0; hops <= 5; hops++) {
        if (!allowedDownloadRedirect(url)) throw new Error('更新包跳转来源不正确');
        response = await this.fetch(url, { credentials:'omit', redirect:'manual', signal });
        if (![301,302,303,307,308].includes(response.status)) break;
        const next = response.headers.get('location'); await response.body?.cancel();
        if (!next) throw new Error('更新下载地址无效');
        url = new URL(next,url).href;
      }
      if (!response?.ok) throw new Error('更新下载失败，请检查网络后重试');
      await fs.mkdir(this.cacheDir,{recursive:true});
      directory = await fs.mkdtemp(path.join(this.cacheDir,'download-'));
      const partial = path.join(directory,'package.partial');
      handle = await fs.open(partial,'wx');
      let received = 0, lastEmit = 0;
      for await (const chunk of response.body) {
        if (signal.aborted) throw signal.reason;
        received += chunk.length;
        if (received > update.size) throw new Error('更新包大小校验失败，请重新下载');
        // FileHandle.write may write fewer bytes than requested.
        let offset = 0;
        while (offset < chunk.length) { const result = await handle.write(chunk,offset,chunk.length-offset); offset += result.bytesWritten; }
        if (Date.now()-lastEmit > 200) { lastEmit = Date.now(); this.emit({progress:Math.min(99,Math.floor(received/update.size*100))}); }
      }
      await handle.close(); handle = null;
      await verifyFile(partial,update);
      this.file = path.join(directory,'update.exe');
      await fs.rename(partial,this.file);
      return this.emit({status:'ready',progress:100,message:''});
    } catch (error) {
      this.onError(error);
      if (handle) await handle.close();
      if (directory) { await fs.rm(path.join(directory,'package.partial'),{force:true}); await fs.rmdir(directory).catch(()=>{}); }
      this.file = null;
      if (this.controller.signal.aborted) return this.emit({status:'available',progress:0,message:'已取消下载'});
      return this.emit({status:'error',phase:'download',progress:0,message:/^更新/.test(error.message)?error.message:'下载中断，请检查网络后重新下载'});
    }
  }
  cancel() { if (this.state.status === 'downloading') this.controller?.abort(); return this.snapshot(); }
  async verifiedPackage() {
    if (this.state.status !== 'ready' || !this.file) throw new Error('请先下载更新');
    await verifyFile(this.file,this.state.update);
    return { file:this.file, update:this.state.update };
  }
}
module.exports = { UpdateService, verifyFile };
