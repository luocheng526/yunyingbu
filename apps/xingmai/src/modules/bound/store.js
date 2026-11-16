import { dbMode, query } from "../profile/auth.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const NOTE =
  "爬虫，非 ERP。这里只汇总爬虫数据，表目前是空的。不读取、不转发、不展示星脉 ERP、京麦、首页实时、星脉数据中心。爬虫接口以后单独接入。";

const BATCH_COLUMNS = [
  { key: "id", label: "批次" },
  { key: "capturedAt", label: "采集时间" },
  { key: "site", label: "来源站点" },
  { key: "count", label: "条目" },
  { key: "status", label: "状态" },
  { key: "note", label: "说明" }
];

const ROW_COLUMNS = [
  { key: "dimension", label: "维度" },
  { key: "metric", label: "指标" },
  { key: "value", label: "数值" },
  { key: "capturedAt", label: "采集时间" },
  { key: "note", label: "备注" }
];

let ready = false;

export function resetBoundStore() {
  ready = false;
}

export function normalizeFilters(input) {
  const src = input && typeof input === "object" ? input : {};
  let from = DATE_RE.test(String(src.from || "")) ? String(src.from) : "";
  let to = DATE_RE.test(String(src.to || "")) ? String(src.to) : "";
  if (from && to && from > to) {
    const swap = from;
    from = to;
    to = swap;
  }
  return { from, to, q: String(src.q || "").trim().slice(0, 80) };
}

function likePattern(q) {
  return `%${String(q).replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
}

function whereParts(filters, columns) {
  const clauses = [];
  const params = [];
  if (filters.from) {
    clauses.push("LEFT(captured_at, 10) >= ?");
    params.push(filters.from);
  }
  if (filters.to) {
    clauses.push("LEFT(captured_at, 10) <= ?");
    params.push(filters.to);
  }
  if (filters.q) {
    const pattern = likePattern(filters.q);
    clauses.push(`(${columns.map((column) => `${column} LIKE ? ESCAPE '\\\\'`).join(" OR ")})`);
    columns.forEach(() => params.push(pattern));
  }
  const sql = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return { sql, params };
}

export function buildBoard(filters, batches, rows) {
  const batchList = Array.isArray(batches) ? batches : [];
  const rowList = Array.isArray(rows) ? rows : [];
  const latest =
    batchList
      .map((item) => item.capturedAt)
      .filter(Boolean)
      .sort()
      .at(-1) || null;
  return {
    ok: true,
    module: "bound",
    source: "crawler",
    erp: false,
    label: "爬虫，非 ERP",
    connected: false,
    note: NOTE,
    ownedTables: ["bound_batches", "bound_rows"],
    filters,
    kpis: [
      {
        key: "batches",
        label: "采集批次",
        value: batchList.length ? String(batchList.length) : null,
        hint: batchList.length ? "bound_batches" : "待接入"
      },
      {
        key: "rows",
        label: "汇总条目",
        value: rowList.length ? String(rowList.length) : null,
        hint: rowList.length ? "bound_rows" : "待接入"
      },
      {
        key: "latest",
        label: "最近采集",
        value: latest,
        hint: latest ? "爬虫时间" : "待接入"
      },
      { key: "source", label: "数据来源", value: "爬虫，非 ERP", hint: "非 ERP" }
    ],
    tables: [
      { key: "batches", title: "采集批次", columns: BATCH_COLUMNS, rows: batchList },
      { key: "rows", title: "汇总明细", columns: ROW_COLUMNS, rows: rowList }
    ]
  };
}

function mapBatch(row) {
  return {
    id: Number(row.id) || 0,
    capturedAt: String(row.captured_at || ""),
    site: String(row.site || ""),
    count: Number(row.row_count) || 0,
    status: String(row.status || ""),
    note: String(row.note || "")
  };
}

function mapRow(row) {
  return {
    dimension: String(row.dimension || ""),
    metric: String(row.metric || ""),
    value: String(row.value_text || ""),
    capturedAt: String(row.captured_at || ""),
    note: String(row.note || "")
  };
}

async function ensureTables() {
  if (ready) {
    return;
  }
  await query(
    `CREATE TABLE IF NOT EXISTS bound_batches (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      captured_at VARCHAR(32) NOT NULL DEFAULT '',
      site VARCHAR(128) NOT NULL DEFAULT '',
      row_count INT NOT NULL DEFAULT 0,
      status VARCHAR(32) NOT NULL DEFAULT '',
      note VARCHAR(255) NOT NULL DEFAULT '',
      KEY idx_bound_batches_captured (captured_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
  await query(
    `CREATE TABLE IF NOT EXISTS bound_rows (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      batch_id INT NOT NULL DEFAULT 0,
      dimension VARCHAR(128) NOT NULL DEFAULT '',
      metric VARCHAR(128) NOT NULL DEFAULT '',
      value_text VARCHAR(128) NOT NULL DEFAULT '',
      captured_at VARCHAR(32) NOT NULL DEFAULT '',
      note VARCHAR(255) NOT NULL DEFAULT '',
      KEY idx_bound_rows_captured (captured_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
  ready = true;
}

async function selectBatches(filters) {
  const where = whereParts(filters, ["site", "status", "note"]);
  const [rows] = await query(
    `SELECT id, captured_at, site, row_count, status, note
     FROM bound_batches
     ${where.sql}
     ORDER BY captured_at DESC, id DESC
     LIMIT 200`,
    where.params
  );
  return rows.map(mapBatch);
}

async function selectRows(filters) {
  const where = whereParts(filters, ["dimension", "metric", "value_text", "note"]);
  const [rows] = await query(
    `SELECT dimension, metric, value_text, captured_at, note
     FROM bound_rows
     ${where.sql}
     ORDER BY captured_at DESC, id DESC
     LIMIT 200`,
    where.params
  );
  return rows.map(mapRow);
}

export async function readBoard(queryInput) {
  const filters = normalizeFilters(queryInput);
  if (dbMode() !== "mysql") {
    return buildBoard(filters, [], []);
  }
  await ensureTables();
  const [batches, rows] = await Promise.all([selectBatches(filters), selectRows(filters)]);
  return buildBoard(filters, batches, rows);
}
