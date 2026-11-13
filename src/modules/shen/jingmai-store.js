import { getPool } from "../../db/pool.js";
import { beijingParts, buildLiveView, previousDay } from "./jingmai.js";

const CREATE_SESSION = `CREATE TABLE IF NOT EXISTS shen_jingmai_session (
  store VARCHAR(64) NOT NULL PRIMARY KEY,
  cookie_jar MEDIUMTEXT NOT NULL,
  auth_state VARCHAR(32) NOT NULL DEFAULT 'unlinked',
  auth_message VARCHAR(200) NOT NULL DEFAULT '',
  enabled_flag TINYINT NOT NULL DEFAULT 1,
  linked_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

const CREATE_SAMPLE = `CREATE TABLE IF NOT EXISTS shen_jingmai_sample (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  store VARCHAR(64) NOT NULL,
  day DATE NOT NULL,
  captured_at CHAR(19) NOT NULL,
  deal_amount DECIMAL(14,2) NULL,
  order_count INT NULL,
  customer_count INT NULL,
  yesterday_amount DECIMAL(14,2) NULL,
  raw_json TEXT NOT NULL,
  ok_flag TINYINT NOT NULL DEFAULT 1,
  UNIQUE KEY uk_shen_jingmai_sample (store, captured_at),
  KEY idx_shen_jingmai_sample_day (day, store)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

let memoryMode = null;
let ready = false;
const memory = { sessions: new Map(), samples: [] };

function stampNow() {
  return beijingParts().stamp;
}

async function query(sql, params = []) {
  if (memoryMode === true) {
    return null;
  }
  try {
    const pool = getPool();
    const result = await pool.query(sql, params);
    memoryMode = false;
    return result;
  } catch (error) {
    if (error.statusCode === 503 || String(error.message || "").includes("缺少环境变量")) {
      memoryMode = true;
      return null;
    }
    throw error;
  }
}

async function ensure() {
  if (ready || memoryMode === true) {
    ready = true;
    return;
  }
  const created = await query(CREATE_SESSION);
  if (created == null && memoryMode === true) {
    ready = true;
    return;
  }
  await query(CREATE_SAMPLE);
  ready = true;
}

function memorySession(store) {
  return (
    memory.sessions.get(store) || {
      store: store,
      cookies: [],
      authState: "unlinked",
      authMessage: "",
      enabled: true
    }
  );
}

export async function resetJingmaiStore() {
  memory.sessions.clear();
  memory.samples = [];
  memoryMode = null;
  ready = false;
}

export async function saveSession(store, fields) {
  await ensure();
  const current = memoryMode === true ? memorySession(store) : null;
  const cookies = fields.cookies == null ? (current ? current.cookies : []) : fields.cookies;
  const authState = fields.authState || (current ? current.authState : "unlinked");
  const authMessage = fields.authMessage == null ? (current ? current.authMessage : "") : fields.authMessage;
  const enabled = fields.enabled == null ? (current ? current.enabled : true) : Boolean(fields.enabled);
  const row = {
    store: store,
    cookies: cookies || [],
    authState: authState,
    authMessage: String(authMessage || "").slice(0, 200),
    enabled: enabled
  };
  if (memoryMode !== false) {
    memory.sessions.set(store, row);
    if (memoryMode === true) {
      return;
    }
  }
  const result = await query(
    `INSERT INTO shen_jingmai_session (store, cookie_jar, auth_state, auth_message, enabled_flag, linked_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       cookie_jar = VALUES(cookie_jar),
       auth_state = VALUES(auth_state),
       auth_message = VALUES(auth_message),
       enabled_flag = VALUES(enabled_flag),
       updated_at = VALUES(updated_at)`,
    [store, JSON.stringify(row.cookies), row.authState, row.authMessage, row.enabled ? 1 : 0, stampNow(), stampNow()]
  );
  if (result == null) {
    memory.sessions.set(store, row);
  }
}

export async function markAuth(store, authState, authMessage) {
  await ensure();
  const message = String(authMessage || "").slice(0, 200);
  if (memoryMode !== false) {
    const current = memorySession(store);
    current.authState = authState;
    current.authMessage = message;
    if (authState === "login_expired") {
      current.cookies = [];
    }
    memory.sessions.set(store, current);
    if (memoryMode === true) {
      return;
    }
  }
  const result = await query(
    `UPDATE shen_jingmai_session
     SET auth_state = ?, auth_message = ?, cookie_jar = CASE WHEN ? = 'login_expired' THEN '[]' ELSE cookie_jar END, updated_at = ?
     WHERE store = ?`,
    [authState, message, authState, stampNow(), store]
  );
  if (result == null) {
    const current = memorySession(store);
    current.authState = authState;
    current.authMessage = message;
    if (authState === "login_expired") {
      current.cookies = [];
    }
    memory.sessions.set(store, current);
  }
}

export async function setRoster(shops) {
  await ensure();
  for (const shop of shops || []) {
    const name = String(shop.store || "").trim();
    if (!name) {
      continue;
    }
    if (memoryMode !== false) {
      const current = memorySession(name);
      current.enabled = Boolean(shop.enabled);
      current.store = name;
      memory.sessions.set(name, current);
      if (memoryMode === true) {
        continue;
      }
    }
    const result = await query(
      `INSERT INTO shen_jingmai_session (store, cookie_jar, auth_state, auth_message, enabled_flag, linked_at, updated_at)
       VALUES (?, '[]', 'unlinked', '', ?, ?, ?)
       ON DUPLICATE KEY UPDATE enabled_flag = VALUES(enabled_flag), updated_at = VALUES(updated_at)`,
      [name, shop.enabled ? 1 : 0, stampNow(), stampNow()]
    );
    if (result == null) {
      const current = memorySession(name);
      current.enabled = Boolean(shop.enabled);
      memory.sessions.set(name, current);
    }
  }
  return { ok: true };
}

export async function listSessions() {
  await ensure();
  if (memoryMode === true) {
    return [...memory.sessions.values()].map(function (row) {
      return Object.assign({}, row, { cookies: row.cookies.slice() });
    });
  }
  const result = await query(
    `SELECT store, cookie_jar, auth_state, auth_message, enabled_flag FROM shen_jingmai_session ORDER BY store ASC`
  );
  if (result == null) {
    return [...memory.sessions.values()];
  }
  return result[0].map(function (row) {
    let cookies = [];
    try {
      cookies = JSON.parse(row.cookie_jar || "[]");
    } catch {
      cookies = [];
    }
    return {
      store: row.store,
      cookies: Array.isArray(cookies) ? cookies : [],
      authState: row.auth_state,
      authMessage: row.auth_message || "",
      enabled: Number(row.enabled_flag) === 1
    };
  });
}

export async function listCollectTargets() {
  const sessions = await listSessions();
  return sessions.filter(function (session) {
    return session.enabled && session.authState === "ok" && session.cookies && session.cookies.length;
  });
}

export async function saveSample(sample) {
  await ensure();
  const raw = {
    dealAmount: sample.dealAmount == null ? null : sample.dealAmount,
    orderCount: sample.orderCount == null ? null : sample.orderCount,
    customerCount: sample.customerCount == null ? null : sample.customerCount,
    yesterdayAmount: sample.yesterdayAmount == null ? null : sample.yesterdayAmount,
    dealRate: sample.dealRate == null || sample.dealRate === "" ? null : Number(sample.dealRate),
    dealRateLabel: sample.dealRateLabel ? String(sample.dealRateLabel).slice(0, 20) : "",
    platformUpdatedAt: sample.platformUpdatedAt ? String(sample.platformUpdatedAt).slice(0, 19) : "",
    paidAmount: sample.paidAmount == null ? null : sample.paidAmount,
    paidDeal: sample.paidDeal == null ? null : sample.paidDeal,
    paidRoi: sample.paidRoi == null ? null : sample.paidRoi,
    dealNote: sample.dealNote ? String(sample.dealNote).slice(0, 160) : ""
  };
  const row = {
    store: sample.store,
    day: sample.day,
    capturedAt: sample.capturedAt,
    dealAmount: raw.dealAmount,
    orderCount: raw.orderCount,
    customerCount: raw.customerCount,
    yesterdayAmount: raw.yesterdayAmount,
    paidAmount: raw.paidAmount,
    paidDeal: raw.paidDeal,
    paidRoi: raw.paidRoi,
    dealRate: Number.isFinite(raw.dealRate) ? raw.dealRate : null,
    dealRateLabel: raw.dealRateLabel || "",
    platformUpdatedAt: raw.platformUpdatedAt || "",
    ok: sample.ok !== false,
    raw: raw
  };
  let staged = false;
  if (memoryMode !== false) {
    const index = memory.samples.findIndex(function (item) {
      return item.store === row.store && item.capturedAt === row.capturedAt;
    });
    if (index >= 0) {
      memory.samples[index] = row;
    } else {
      memory.samples.push(row);
    }
    staged = true;
    if (memoryMode === true) {
      return;
    }
  }
  const result = await query(
    `INSERT INTO shen_jingmai_sample (store, day, captured_at, deal_amount, order_count, customer_count, yesterday_amount, raw_json, ok_flag)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       deal_amount = VALUES(deal_amount),
       order_count = VALUES(order_count),
       customer_count = VALUES(customer_count),
       yesterday_amount = VALUES(yesterday_amount),
       raw_json = VALUES(raw_json),
       ok_flag = VALUES(ok_flag)`,
    [
      row.store,
      row.day,
      row.capturedAt,
      row.dealAmount,
      row.orderCount,
      row.customerCount,
      row.yesterdayAmount,
      JSON.stringify(raw),
      row.ok ? 1 : 0
    ]
  );
  if (result == null && !staged) {
    memory.samples.push(row);
  }
}

export async function listSamples(fromDay, toDay) {
  await ensure();
  if (memoryMode === true) {
    return memory.samples.filter(function (sample) {
      return sample.day >= fromDay && sample.day <= toDay;
    });
  }
  const result = await query(
    `SELECT store, day, captured_at, deal_amount, order_count, customer_count, yesterday_amount, raw_json, ok_flag
     FROM shen_jingmai_sample
     WHERE day >= ? AND day <= ?
     ORDER BY captured_at ASC`,
    [fromDay, toDay]
  );
  if (result == null) {
    return memory.samples.filter(function (sample) {
      return sample.day >= fromDay && sample.day <= toDay;
    });
  }
  return result[0].map(function (row) {
    const day = row.day instanceof Date ? beijingParts(row.day).day : String(row.day).slice(0, 10);
    let raw = {};
    try {
      raw = JSON.parse(row.raw_json || "{}");
    } catch {
      raw = {};
    }
    return {
      store: row.store,
      day: day,
      capturedAt: row.captured_at,
      dealAmount: row.deal_amount == null ? null : Number(row.deal_amount),
      orderCount: row.order_count == null ? null : Number(row.order_count),
      customerCount: row.customer_count == null ? null : Number(row.customer_count),
      yesterdayAmount: row.yesterday_amount == null ? null : Number(row.yesterday_amount),
      paidAmount: raw.paidAmount == null ? null : Number(raw.paidAmount),
      paidDeal: raw.paidDeal == null ? null : Number(raw.paidDeal),
      paidRoi: raw.paidRoi == null ? null : Number(raw.paidRoi),
      dealNote: raw.dealNote ? String(raw.dealNote).slice(0, 160) : "",
      dealRate: raw.dealRate == null || raw.dealRate === "" || !Number.isFinite(Number(raw.dealRate)) ? null : Number(raw.dealRate),
      dealRateLabel: raw.dealRateLabel ? String(raw.dealRateLabel).slice(0, 20) : "",
      platformUpdatedAt: raw.platformUpdatedAt ? String(raw.platformUpdatedAt).slice(0, 19) : "",
      ok: Number(row.ok_flag) === 1
    };
  });
}

export async function readJingmaiLive(now = beijingParts()) {
  const shops = await listSessions();
  const samples = await listSamples(previousDay(now.day), now.day);
  return buildLiveView({ shops: shops, samples: samples, now: now });
}
