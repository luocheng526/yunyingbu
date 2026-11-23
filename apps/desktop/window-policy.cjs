const PRODUCTION_ORIGIN = 'https://zx.xingmaierp.cc';

function centeredBounds(area) {
  // All dimensions are device-independent pixels, including displays with scaling.
  const width = Math.min(1380, Math.floor(area.width * 0.82));
  const height = Math.min(880, Math.floor(area.height * 0.86));
  return {
    x: area.x + Math.floor((area.width - width) / 2),
    y: area.y + Math.floor((area.height - height) / 2),
    width, height,
  };
}

function allowedUrl(value, origin = PRODUCTION_ORIGIN) {
  try { const url = new URL(value); return url.origin === origin && !url.username && !url.password; }
  catch { return false; }
}

function desktopOrigin(packaged, developmentUrl) {
  if (packaged || !developmentUrl) return PRODUCTION_ORIGIN;
  const url = new URL(developmentUrl);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname) || url.username || url.password) {
    throw new Error('Development preview must use a local HTTP server');
  }
  return url.origin;
}

function backgroundFor(platform, release) {
  if (platform === 'darwin') return 'vibrancy';
  if (platform === 'win32' && Number(String(release).split('.')[2]) >= 22621) return 'acrylic';
  return 'solid';
}

module.exports = { PRODUCTION_ORIGIN, centeredBounds, allowedUrl, desktopOrigin, backgroundFor };
