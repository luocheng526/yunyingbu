import { createHash } from 'node:crypto';
import { record, writeRecord, fault } from './center-db.js';
import { parseRichContent } from './rich-content.js';

// Immutable bytes live outside business records, so daily snapshots/history only copy small references.
// An image is served only after the caller can read a business record that references it.
export async function saveComposerImages(input, fields, previous = [], owner = '') {
  if (input === undefined) return previous;
  if (!Array.isArray(input) || input.length > 3) fault('每次提交最多添加 3 张图片');
  const allowed = new Set(fields), result = [];
  let size = 0;
  for (const item of input) {
    if (!item || !allowed.has(item.field)) fault('图片所属输入框不合法');
    if (item.id && item.data == null) {
      const old = previous.find(image => image.id === item.id && image.field === item.field);
      if (!old) fault('图片引用无效，请重新添加', 403);
      result.push(old); size += old.size; continue;
    }
    if (typeof item.data !== 'string' || item.data.length > 4 * 1024 * 1024 || !/^[A-Za-z0-9+/]*={0,2}$/.test(item.data)) fault('图片数据不合法或超过 3 MB');
    const bytes = Buffer.from(item.data, 'base64'), mime = String(item.mime || '');
    if (!bytes.length) fault('图片不能为空');
    try { parseRichContent('[{"type":"image","upload":0}]', [{ mime, bytes }], 0); }
    catch { fault('图片格式无效，支持 PNG、JPG、GIF、WebP、BMP'); }
    size += bytes.length;
    if (size > 3 * 1024 * 1024) fault('图片合计最多 3 MB');
    const id = 'compose-image:' + createHash('sha256').update(owner + ':' + mime + ':').update(bytes).digest('hex');
    const image = { id, field: item.field, mime, size: bytes.length, name: String(item.name || '图片').slice(0, 180) };
    // Content-addressed writes make retries idempotent. Failed parent writes cannot expose these bytes.
    if (!await record(id)) {
      try { await writeRecord('compose-image', id, { mime, data: bytes.toString('base64') }); }
      catch (error) { if (error.statusCode !== 409) throw error; }
    }
    result.push(image);
  }
  if (size > 3 * 1024 * 1024) fault('图片合计最多 3 MB');
  return result;
}

export function containsComposerImage(value, id) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value.composerImages) && value.composerImages.some(image => image.id === id)) return true;
  return Object.entries(value).some(([key, child]) => key !== 'composerImages' && child && typeof child === 'object' && containsComposerImage(child, id));
}
