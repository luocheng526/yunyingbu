import { promisify } from 'node:util';
import { Buffer } from 'node:buffer';
import { brotliCompress, gzip, constants } from 'node:zlib';

const br = promisify(brotliCompress), gz = promisify(gzip);

// Keep every row/field. The archive often repeats the entire table in its raw
// response; send it once and restore those aliases in the browser.
export function compactSavedRecord(record) {
  if (!record || !Array.isArray(record.rows)) return record;
  const rowsJson = JSON.stringify(record.rows), rowAliases = [];
  function copy(value, path) {
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) {
      if (value === record.rows || value.length === record.rows.length && JSON.stringify(value) === rowsJson) {
        rowAliases.push(path); return null;
      }
      return value.map((v, i) => copy(v, path.concat(i)));
    }
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, copy(v, path.concat(k))]));
  }
  return { ...record, response: copy(record.response, ['response']), rowAliases };
}

export async function sendSavedJson(req, res, result) {
  // Opt in so old clients and diagnostic APIs retain their original contract.
  if (req.query.wire !== 'compact') return res.status(result.statusCode || 200).json(result);
  const value = { ...result };
  if (value.record) value.record = compactSavedRecord(value.record);
  if (value.records) value.records = Object.fromEntries(Object.entries(value.records).map(([id, records]) => [id, Array.isArray(records) ? records.map(compactSavedRecord) : compactSavedRecord(records)]));
  const json = JSON.stringify(value), encoding = req.acceptsEncodings('br', 'gzip', 'identity');
  res.status(result.statusCode || 200).type('application/json').vary('Accept-Encoding');
  if (Buffer.byteLength(json) < 1024 || !['br', 'gzip'].includes(encoding)) return res.send(json);
  const buffer = encoding === 'br' ? await br(json, { params: { [constants.BROTLI_PARAM_QUALITY]: 4 } }) : await gz(json, { level: 6 });
  res.setHeader('Content-Encoding', encoding);
  return res.send(buffer);
}
