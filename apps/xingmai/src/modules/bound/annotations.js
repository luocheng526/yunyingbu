import { readMarks, writeMark, readBoundMarks } from "./persist.js";
const validKey = key => typeof key === 'string' && /^[A-Z]{2,8}:\d{1,24}:(shop|goods|spu):\d{1,30}$/.test(key);
function range(input) {
  const from = String(input.from || ''), to = String(input.to || from);
  const valid = d => /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(Date.parse(d)) && new Date(d).toISOString().slice(0, 10) === d;
  return valid(from) && valid(to) && from >= '2026-09-01' && to >= from && Date.parse(to) - Date.parse(from) <= 366 * 86400000 ? [from, to] : null;
}
const storageKey = key => 'bound:v1:' + key;
export function createAnnotations({ read = readMarks, write = writeMark, list = readBoundMarks } = {}) {
  let pending = Promise.resolve();
  async function index(input = {}) {
    const days = range(input);
    if (!days) return { ok: false, statusCode: 400, reason: 'invalid_range' };
    const rows = await list(...days), marks = {};
    const suffix = ':target:' + days.join(':');
    for (const row of rows) {
      if (!row.rowKey.startsWith('bound:v1:')) continue;
      const target = row.rowKey.endsWith(suffix);
      const key = row.rowKey.slice(9, target ? -suffix.length : undefined);
      if (!validKey(key)) continue;
      const mark = marks[key] || (marks[key] = { tag: '', follow: '', target: null });
      if (target) { try { mark.target = JSON.parse(row.target || 'null'); } catch { /* Invalid legacy goal stays empty. */ } }
      else { mark.tag = row.tag || ''; mark.follow = row.follow || ''; }
    }
    return { ok: true, marks };
  }
  async function get(input = {}) {
    const keys = Array.isArray(input.keys) ? input.keys : String(input.keys || '').split(',');
    const days = range(input);
    if (!days || !keys.length || keys.length > 100 || keys.some(k => !validKey(k))) return {ok:false,statusCode:400,reason:'invalid_selection'};
    const unique = [...new Set(keys)], suffix = ':target:' + days.join(':');
    const rows = await read(unique.flatMap(k => [storageKey(k), storageKey(k) + suffix]));
    const byKey = new Map(rows.map(r => [r.rowKey, r]));
    return {ok:true,marks:Object.fromEntries(unique.map(key => {
      const mark = byKey.get(storageKey(key)), target = byKey.get(storageKey(key) + suffix);
      let goal = null;
      try { goal = JSON.parse(target?.target || 'null'); } catch { /* old invalid values remain unavailable */ }
      return [key,{tag:mark?.tag || '',follow:mark?.follow || '',target:goal}];
    }))};
  }
  function save(input = {}) {
    const keys = input.keys, days = range(input), field = input.field;
    if (!days || !Array.isArray(keys) || !keys.length || keys.length > 100 || keys.some(k=>!validKey(k)) || !['tag','follow','target'].includes(field)) return Promise.resolve({ok:false,statusCode:400,reason:'invalid_selection'});
    let value = input.value;
    if (field === 'target') {
      if (value !== null && (!value || !/^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(value.metric || '') || ['constructor','prototype'].includes(value.metric) || typeof value.value !== 'number' || !Number.isFinite(value.value) || value.value <= 0 || value.value > 1e12)) return Promise.resolve({ok:false,statusCode:400,reason:'invalid_target'});
      value = value === null ? '' : JSON.stringify({metric:value.metric,value:value.value});
      if (value.length > 128) return Promise.resolve({ok:false,statusCode:400,reason:'invalid_target'});
    } else if (typeof value !== 'string' || value.length > (field === 'tag' ? 128 : 500)) return Promise.resolve({ok:false,statusCode:400,reason:'invalid_value'});
    const task = async () => {
      const ids = [...new Set(keys)].map(key => storageKey(key) + (field === 'target' ? ':target:' + days.join(':') : ''));
      const previous = new Map((await read(ids)).map(r => [r.rowKey, r]));
      for (const id of ids) await write(id, {...previous.get(id),[field]:value});
      return get({keys,...{from:days[0],to:days[1]}});
    };
    const result = pending.then(task);
    pending = result.catch(()=>{});
    return result;
  }
  return {get,save,index};
}
