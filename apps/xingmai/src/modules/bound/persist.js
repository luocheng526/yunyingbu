import { dbMode, query } from "../profile/auth.js";

const STATE_SQL = `CREATE TABLE IF NOT EXISTS bound_state (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  payload MEDIUMTEXT NOT NULL,
  updated_at VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

const SHEET_SQL = `CREATE TABLE IF NOT EXISTS bound_sheet (
  report_id VARCHAR(64) NOT NULL,
  dim VARCHAR(16) NOT NULL,
  start_on CHAR(10) NOT NULL,
  end_on CHAR(10) NOT NULL,
  page_no INT NOT NULL,
  status VARCHAR(16) NOT NULL,
  kind VARCHAR(16) NOT NULL,
  total_rows INT NOT NULL DEFAULT 0,
  page_size INT NOT NULL DEFAULT 0,
  attempts INT NOT NULL DEFAULT 0,
  row_count INT NOT NULL DEFAULT 0,
  error_text VARCHAR(500) NOT NULL DEFAULT '',
  payload MEDIUMTEXT NOT NULL,
  updated_at VARCHAR(40) NOT NULL,
  PRIMARY KEY (report_id, dim, start_on, end_on, page_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

const PREF_SQL = `CREATE TABLE IF NOT EXISTS bound_pref (
  pref_key VARCHAR(128) NOT NULL PRIMARY KEY,
  payload MEDIUMTEXT NOT NULL,
  updated_at VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

const MARK_SQL = `CREATE TABLE IF NOT EXISTS bound_mark (
  row_key VARCHAR(191) NOT NULL PRIMARY KEY,
  follow_text VARCHAR(500) NOT NULL DEFAULT '',
  tag_text VARCHAR(128) NOT NULL DEFAULT '',
  target_text VARCHAR(128) NOT NULL DEFAULT '',
  updated_at VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

const MASTER_SQL = `CREATE TABLE IF NOT EXISTS bound_master (
  kind VARCHAR(32) NOT NULL,
  item_key VARCHAR(191) NOT NULL,
  payload MEDIUMTEXT NOT NULL,
  updated_at VARCHAR(40) NOT NULL,
  PRIMARY KEY (kind, item_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

function blank() {
  return {
    state: new Map(),
    sheets: new Map(),
    prefs: new Map(),
    marks: new Map(),
    masters: new Map()
  };
}

let memory = blank();
let ready = false;

export function resetBoundStore() {
  memory = blank();
  ready = false;
}

function stamp() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function sheetKey(row) {
  return [row.reportId, row.dim, row.startOn, row.endOn, row.pageNo].join("|");
}

function parse(text, fallback) {
  try {
    return JSON.parse(text || "");
  } catch {
    return fallback;
  }
}

async function ensure() {
  if (ready || dbMode() !== "mysql") {
    ready = true;
    return;
  }
  await query(STATE_SQL);
  await query(SHEET_SQL);
  await query(PREF_SQL);
  await query(MARK_SQL);
  await query(MASTER_SQL);
  ready = true;
}

export async function readState(id, fallback) {
  await ensure();
  if (dbMode() !== "mysql") {
    return memory.state.has(id) ? memory.state.get(id) : fallback;
  }
  const [rows] = await query("SELECT payload FROM bound_state WHERE id = ?", [id]);
  if (!rows.length) {
    return fallback;
  }
  return parse(rows[0].payload, fallback);
}

export async function writeState(id, value) {
  await ensure();
  const payload = JSON.stringify(value == null ? null : value);
  if (dbMode() !== "mysql") {
    memory.state.set(id, value);
    return;
  }
  await query(
    `INSERT INTO bound_state (id, payload, updated_at) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = VALUES(updated_at)`,
    [id, payload, stamp()]
  );
}

export async function writeSheet(row) {
  await ensure();
  const saved = {
    reportId: String(row.reportId),
    dim: String(row.dim || "all"),
    startOn: String(row.startOn),
    endOn: String(row.endOn),
    pageNo: Number(row.pageNo) || 0,
    status: String(row.status || "done"),
    kind: String(row.kind || "list"),
    totalRows: Number(row.totalRows) || 0,
    pageSize: Number(row.pageSize) || 0,
    attempts: Number(row.attempts) || 0,
    rowCount: Number(row.rowCount) || 0,
    errorText: String(row.errorText || "").slice(0, 500),
    payload: row.payload == null ? {} : row.payload,
    updatedAt: stamp()
  };
  if (dbMode() !== "mysql") {
    memory.sheets.set(sheetKey(saved), saved);
    return saved;
  }
  await query(
    `INSERT INTO bound_sheet
      (report_id, dim, start_on, end_on, page_no, status, kind, total_rows, page_size, attempts, row_count, error_text, payload, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE status = VALUES(status), kind = VALUES(kind), total_rows = VALUES(total_rows),
       page_size = VALUES(page_size), attempts = VALUES(attempts), row_count = VALUES(row_count),
       error_text = VALUES(error_text), payload = VALUES(payload), updated_at = VALUES(updated_at)`,
    [
      saved.reportId,
      saved.dim,
      saved.startOn,
      saved.endOn,
      saved.pageNo,
      saved.status,
      saved.kind,
      saved.totalRows,
      saved.pageSize,
      saved.attempts,
      saved.rowCount,
      saved.errorText,
      JSON.stringify(saved.payload),
      saved.updatedAt
    ]
  );
  return saved;
}

function mapSheet(row) {
  return {
    reportId: row.report_id,
    dim: row.dim,
    startOn: row.start_on,
    endOn: row.end_on,
    pageNo: Number(row.page_no),
    status: row.status,
    kind: row.kind,
    totalRows: Number(row.total_rows) || 0,
    pageSize: Number(row.page_size) || 0,
    attempts: Number(row.attempts) || 0,
    rowCount: Number(row.row_count) || 0,
    errorText: row.error_text || "",
    payload: parse(row.payload, {}),
    updatedAt: row.updated_at
  };
}

export async function listSheetHeads() {
  await ensure();
  if (dbMode() !== "mysql") {
    return [...memory.sheets.values()].map((row) => ({ ...row, payload: undefined }));
  }
  const [found] = await query(
    "SELECT report_id, dim, start_on, end_on, page_no, status, kind, total_rows, page_size, attempts, row_count, error_text, updated_at FROM bound_sheet"
  );
  return found.map((row) => mapSheet({ ...row, payload: "{}" }));
}

function sheetWhere(filter) {
  const where = [];
  const params = [];
  const ids = Array.isArray(filter.reportIds) ? filter.reportIds.filter(Boolean) : [];
  if (ids.length) {
    where.push(`report_id IN (${ids.map(() => "?").join(",")})`);
    params.push(...ids);
  } else if (filter.reportId) {
    where.push("report_id = ?");
    params.push(filter.reportId);
  }
  if (filter.dim) {
    where.push("dim = ?");
    params.push(filter.dim);
  }
  if (filter.from) {
    where.push("end_on >= ?");
    params.push(filter.from);
  }
  if (filter.to) {
    where.push("start_on <= ?");
    params.push(filter.to);
  }
  if (filter.startOn) {
    where.push("start_on = ?");
    params.push(filter.startOn);
  }
  if (filter.endOn) {
    where.push("end_on = ?");
    params.push(filter.endOn);
  }
  return { where, params };
}

function sheetMatches(row, filter) {
  const ids = Array.isArray(filter.reportIds) ? filter.reportIds.filter(Boolean) : [];
  if (ids.length && !ids.includes(row.reportId)) {
    return false;
  }
  if (filter.reportId && row.reportId !== filter.reportId) {
    return false;
  }
  if (filter.dim && row.dim !== filter.dim) {
    return false;
  }
  if (filter.from && row.endOn < filter.from) {
    return false;
  }
  if (filter.to && row.startOn > filter.to) {
    return false;
  }
  if (filter.startOn && row.startOn !== filter.startOn) {
    return false;
  }
  if (filter.endOn && row.endOn !== filter.endOn) {
    return false;
  }
  return true;
}

export async function listSheets(filter = {}) {
  await ensure();
  if (dbMode() !== "mysql") {
    return [...memory.sheets.values()].filter((row) => sheetMatches(row, filter));
  }
  const { where, params } = sheetWhere(filter);
  const [found] = await query(
    `SELECT report_id, dim, start_on, end_on, page_no, status, kind, total_rows, page_size, attempts, row_count, error_text, payload, updated_at FROM bound_sheet${where.length ? ` WHERE ${where.join(" AND ")}` : ""}`,
    params
  );
  return found.map(mapSheet);
}

export async function readPref(key) {
  await ensure();
  if (dbMode() !== "mysql") {
    return memory.prefs.get(key) || null;
  }
  const [rows] = await query("SELECT payload FROM bound_pref WHERE pref_key = ?", [key]);
  return rows.length ? parse(rows[0].payload, null) : null;
}

export async function writePref(key, value) {
  await ensure();
  if (dbMode() !== "mysql") {
    memory.prefs.set(key, value);
    return value;
  }
  await query(
    `INSERT INTO bound_pref (pref_key, payload, updated_at) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = VALUES(updated_at)`,
    [key, JSON.stringify(value), stamp()]
  );
  return value;
}

export async function readMarks(keys) {
  await ensure();
  const wanted = new Set(keys || []);
  let rows;
  if (dbMode() !== "mysql") {
    rows = [...memory.marks.entries()].map(([rowKey, value]) => ({ rowKey, ...value }));
  } else if (!wanted.size) {
    rows = [];
  } else {
    const list = [...wanted];
    const marks = [];
    for (let offset = 0; offset < list.length; offset += 200) {
      const batch = list.slice(offset, offset + 200);
      const [found] = await query(
        "SELECT row_key, follow_text, tag_text, target_text FROM bound_mark WHERE row_key IN (" + batch.map(() => "?").join(",") + ")",
        batch
      );
      found.forEach((row) => {
        marks.push({
          rowKey: row.row_key,
          follow: row.follow_text || "",
          tag: row.tag_text || "",
          target: row.target_text || ""
        });
      });
    }
    return marks;
  }
  return rows.filter((row) => !wanted.size || wanted.has(row.rowKey));
}

export async function writeMark(rowKey, value) {
  await ensure();
  const saved = {
    follow: String(value.follow || "").slice(0, 500),
    tag: String(value.tag || "").slice(0, 128),
    target: String(value.target || "").slice(0, 128)
  };
  if (dbMode() !== "mysql") {
    memory.marks.set(rowKey, saved);
    return saved;
  }
  await query(
    `INSERT INTO bound_mark (row_key, follow_text, tag_text, target_text, updated_at) VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE follow_text = VALUES(follow_text), tag_text = VALUES(tag_text), target_text = VALUES(target_text), updated_at = VALUES(updated_at)`,
    [rowKey, saved.follow, saved.tag, saved.target, stamp()]
  );
  return saved;
}

export async function writeMaster(kind, itemKey, payload) {
  await ensure();
  if (dbMode() !== "mysql") {
    memory.masters.set(`${kind}|${itemKey}`, { kind, itemKey, payload });
    return;
  }
  await query(
    `INSERT INTO bound_master (kind, item_key, payload, updated_at) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = VALUES(updated_at)`,
    [kind, String(itemKey).slice(0, 191), JSON.stringify(payload), stamp()]
  );
}

export async function listMasters(kind) {
  await ensure();
  if (dbMode() !== "mysql") {
    return [...memory.masters.values()].filter((row) => row.kind === kind);
  }
  const [rows] = await query("SELECT kind, item_key, payload FROM bound_master WHERE kind = ?", [kind]);
  return rows.map((row) => ({ kind: row.kind, itemKey: row.item_key, payload: parse(row.payload, {}) }));
}

export async function replaceMasters(kind, items) {
  await ensure();
  if (dbMode() !== "mysql") {
    [...memory.masters.keys()].forEach((key) => {
      if (key.startsWith(`${kind}|`)) {
        memory.masters.delete(key);
      }
    });
  } else {
    await query("DELETE FROM bound_master WHERE kind = ?", [kind]);
  }
  let index = 0;
  for (const item of items) {
    const key = String(item && (item.id || item.goodsId || item.shopId || item.userId || item.permKey) || index);
    await writeMaster(kind, key || String(index), item);
    index += 1;
  }
}
