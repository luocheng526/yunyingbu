const FEED_URL = 'https://zx.xingmaierp.cc/shared/app/desktop-update.json';
const DOWNLOAD_ROOT = 'https://github.com/luocheng526/yunyingbu/releases/download/';
const MAX_DOWNLOAD = 350 * 1024 * 1024;

function versionParts(value) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) throw new Error('更新版本号无效');
  const parts = value.split('.').map(Number);
  if (parts.some(n => !Number.isSafeInteger(n))) throw new Error('更新版本号无效');
  return parts;
}
function newerVersion(next, current) {
  const a = versionParts(next), b = versionParts(current);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}
function validateManifest(manifest) {
  if (!manifest || manifest.schema !== 1) throw new Error('更新信息格式无效');
  versionParts(manifest.version);
  const artifact = manifest.platforms?.['win32-x64'];
  const expected = DOWNLOAD_ROOT + `desktop-v${manifest.version}/ZhenxuanFuture-${manifest.version}-win-x64.exe`;
  if (!artifact || artifact.url !== expected) throw new Error('更新包来源不正确');
  if (!/^[a-f0-9]{64}$/.test(artifact.sha256)) throw new Error('更新包校验信息无效');
  if (!Number.isSafeInteger(artifact.size) || artifact.size < 1024 || artifact.size > MAX_DOWNLOAD) throw new Error('更新包大小无效');
  if (!Array.isArray(manifest.notes) || manifest.notes.length > 20 || manifest.notes.some(n => typeof n !== 'string' || n.length > 500)) throw new Error('更新说明格式无效');
  return { version: manifest.version, notes: manifest.notes, publishedAt: String(manifest.publishedAt || '').slice(0,40), ...artifact };
}
function allowedDownloadRedirect(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password && !u.port &&
      (u.hostname === 'release-assets.githubusercontent.com' || u.hostname === 'objects.githubusercontent.com' ||
       (u.hostname === 'github.com' && u.pathname.startsWith('/luocheng526/yunyingbu/releases/download/')));
  } catch { return false; }
}
module.exports = { FEED_URL, MAX_DOWNLOAD, newerVersion, validateManifest, allowedDownloadRedirect };
