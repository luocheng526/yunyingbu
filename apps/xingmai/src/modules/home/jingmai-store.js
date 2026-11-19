import { beijingParts, buildLiveView, matchCollectIdentity, previousDay } from "./jingmai.js";
import { isForbiddenLegacyProfileKey, profileIdentity } from "./jingmai-desk.js";

async function getPool() {
  try {
    const mod = await import("../../db/pool.js");
    return mod.getPool();
  } catch (error) {
    if (error && (error.statusCode === 503 || String(error.message || "").includes("缺少环境变量"))) {
      throw error;
    }
    const missing = new Error("缺少环境变量");
    missing.statusCode = 503;
    throw missing;
  }
}

const CREATE_SESSION = `CREATE TABLE IF NOT EXISTS shen_jingmai_session (
  store VARCHAR(64) NOT NULL PRIMARY KEY,
  cookie_jar MEDIUMTEXT NOT NULL,
  auth_state VARCHAR(32) NOT NULL DEFAULT 'unlinked',
  auth_message VARCHAR(200) NOT NULL DEFAULT '',
  enabled_flag TINYINT NOT NULL DEFAULT 1,
  shop_id VARCHAR(32) NOT NULL DEFAULT '',
  linked_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  session_gen INT NOT NULL DEFAULT 0
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
    const pool = await getPool();
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
  try {
    await query("ALTER TABLE shen_jingmai_session ADD COLUMN shop_id VARCHAR(32) NOT NULL DEFAULT ''");
  } catch (error) {
    const message = String((error && (error.sqlMessage || error.message)) || "");
    if (!/duplicate|exists/i.test(message)) {
      throw error;
    }
  }
  try {
    await query("ALTER TABLE shen_jingmai_session ADD COLUMN session_gen INT NOT NULL DEFAULT 0");
  } catch (error) {
    const message = String((error && (error.sqlMessage || error.message)) || "");
    if (!/duplicate|exists/i.test(message)) {
      throw error;
    }
  }
  ready = true;
}

function memorySession(store) {
  return (
    memory.sessions.get(store) || {
      store: store,
      cookies: [],
      authState: "unlinked",
      authMessage: "",
      enabled: true,
      shopId: "",
      linkedAt: "",
      sessionGen: 0
    }
  );
}

function sessionVersionOf(row) {
  if (!row) {
    return "";
  }
  if (row.sessionGen != null && Number(row.sessionGen) > 0) {
    return "g:" + String(row.sessionGen);
  }
  return String(row.linkedAt || "");
}

export async function resetJingmaiStore() {
  memory.sessions.clear();
  memory.samples = [];
  memoryMode = null;
  ready = false;
}

export async function saveSession(store, fields) {
  await ensure();
  // Prefer in-memory row when present so sessionGen stays monotonic across DB/memory fallbacks.
  const current = memory.sessions.has(store)
    ? memory.sessions.get(store)
    : memoryMode === true
      ? memorySession(store)
      : null;
  const cookies = fields.cookies == null ? (current ? current.cookies : []) : fields.cookies;
  const authState = fields.authState || (current ? current.authState : "unlinked");
  const authMessage = fields.authMessage == null ? (current ? current.authMessage : "") : fields.authMessage;
  const enabled = fields.enabled == null ? (current ? current.enabled : true) : Boolean(fields.enabled);
  const shopId = String(fields.shopId == null ? (current && current.shopId) || "" : fields.shopId).trim().slice(0, 32);
  const sessionGen = (current && Number(current.sessionGen) > 0 ? Number(current.sessionGen) : 0) + 1;
  const row = {
    store: store,
    cookies: cookies || [],
    authState: authState,
    authMessage: String(authMessage || "").slice(0, 200),
    enabled: enabled,
    shopId: shopId,
    linkedAt: stampNow(),
    sessionGen: sessionGen
  };
  if (memoryMode !== false) {
    memory.sessions.set(store, row);
    if (memoryMode === true) {
      return;
    }
  }
  const stamp = stampNow();
  const packed = JSON.stringify(row.cookies);
  let result;
  try {
    result = await query(
      `INSERT INTO shen_jingmai_session (store, cookie_jar, auth_state, auth_message, enabled_flag, shop_id, linked_at, updated_at, session_gen)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         cookie_jar = VALUES(cookie_jar),
         auth_state = VALUES(auth_state),
         auth_message = VALUES(auth_message),
         enabled_flag = VALUES(enabled_flag),
         shop_id = IF(VALUES(shop_id) = '', shop_id, VALUES(shop_id)),
         linked_at = VALUES(linked_at),
         updated_at = VALUES(updated_at),
         session_gen = VALUES(session_gen)`,
      [store, packed, row.authState, row.authMessage, row.enabled ? 1 : 0, row.shopId, stamp, stamp, sessionGen]
    );
  } catch (error) {
    const message = String((error && (error.sqlMessage || error.message)) || "");
    if (/session_gen|Unknown column/i.test(message)) {
      try {
        result = await query(
          `INSERT INTO shen_jingmai_session (store, cookie_jar, auth_state, auth_message, enabled_flag, shop_id, linked_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             cookie_jar = VALUES(cookie_jar),
             auth_state = VALUES(auth_state),
             auth_message = VALUES(auth_message),
             enabled_flag = VALUES(enabled_flag),
             shop_id = IF(VALUES(shop_id) = '', shop_id, VALUES(shop_id)),
             linked_at = VALUES(linked_at),
             updated_at = VALUES(updated_at)`,
          [store, packed, row.authState, row.authMessage, row.enabled ? 1 : 0, row.shopId, stamp, stamp]
        );
      } catch (inner) {
        const innerMessage = String((inner && (inner.sqlMessage || inner.message)) || "");
        if (!/shop_id|Unknown column/i.test(innerMessage)) {
          throw inner;
        }
        result = await query(
          `INSERT INTO shen_jingmai_session (store, cookie_jar, auth_state, auth_message, enabled_flag, linked_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             cookie_jar = VALUES(cookie_jar),
             auth_state = VALUES(auth_state),
             auth_message = VALUES(auth_message),
             enabled_flag = VALUES(enabled_flag),
             linked_at = VALUES(linked_at),
             updated_at = VALUES(updated_at)`,
          [store, packed, row.authState, row.authMessage, row.enabled ? 1 : 0, stamp, stamp]
        );
      }
    } else if (/shop_id|Unknown column/i.test(message)) {
      result = await query(
        `INSERT INTO shen_jingmai_session (store, cookie_jar, auth_state, auth_message, enabled_flag, linked_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           cookie_jar = VALUES(cookie_jar),
           auth_state = VALUES(auth_state),
           auth_message = VALUES(auth_message),
           enabled_flag = VALUES(enabled_flag),
           linked_at = VALUES(linked_at),
           updated_at = VALUES(updated_at)`,
        [store, packed, row.authState, row.authMessage, row.enabled ? 1 : 0, stamp, stamp]
      );
    } else {
      throw error;
    }
  }
  if (result == null) {
    memory.sessions.set(store, row);
  } else {
    // Keep gen in process memory so same-second logins still conflict with stale collects.
    memory.sessions.set(store, row);
  }
}

/**
 * Targeted cookie jar refresh after a collect round.
 * - Never flips enabled (manual pause stays paused)
 * - Never clears/overwrites shop_id with empty
 * - sessionVersion (g:N / linkedAt) must still match or the write is skipped (newer login wins)
 * - optional identity must match the row's shop
 */
export async function updateSessionCookies(store, cookies, options) {
  const opts = options || {};
  await ensure();
  if (!Array.isArray(cookies)) {
    return { updated: false, reason: "invalid_jar" };
  }
  const rows = await listSessions();
  const current = rows.find(function (row) {
    return row.store === store;
  });
  if (!current) {
    return { updated: false, reason: "missing" };
  }
  if (
    opts.sessionVersion != null &&
    String(opts.sessionVersion) !== "" &&
    sessionVersionOf(current) !== String(opts.sessionVersion)
  ) {
    return { updated: false, reason: "version_conflict" };
  }
  const rowShopId = String(current.shopId || "").trim();
  const expectedShopId = String(opts.expectedShopId || "").trim();
  if (expectedShopId && rowShopId && expectedShopId !== rowShopId) {
    return { updated: false, reason: "shop_changed" };
  }
  if (opts.identity) {
    const match = matchCollectIdentity({ store: store, shopId: rowShopId || expectedShopId }, opts.identity);
    if (!match.ok) {
      return { updated: false, reason: match.reason };
    }
  }
  const nextCookies = cookies.map(function (item) {
    return item && typeof item === "object" ? Object.assign({}, item) : item;
  });
  const packed = JSON.stringify(nextCookies);
  if (memoryMode === true) {
    const row = memorySession(store);
    const keptEnabled = row.enabled;
    const keptShopId = row.shopId;
    const keptLinked = row.linkedAt;
    const keptGen = row.sessionGen;
    row.cookies = nextCookies;
    row.enabled = keptEnabled;
    row.shopId = keptShopId;
    row.linkedAt = keptLinked;
    row.sessionGen = keptGen;
    memory.sessions.set(store, row);
    return { updated: true, reason: "ok" };
  }
  const gen = Number(current.sessionGen) || 0;
  let result;
  if (gen > 0) {
    result = await query(
      `UPDATE shen_jingmai_session
       SET cookie_jar = ?, updated_at = ?
       WHERE store = ?
         AND session_gen = ?
         AND (? = '' OR shop_id = '' OR shop_id = ?)`,
      [packed, stampNow(), store, gen, expectedShopId, expectedShopId]
    );
  } else {
    const version = String(opts.sessionVersion || current.linkedAt || "");
    result = await query(
      `UPDATE shen_jingmai_session
       SET cookie_jar = ?, updated_at = ?
       WHERE store = ?
         AND CAST(linked_at AS CHAR) = ?
         AND (? = '' OR shop_id = '' OR shop_id = ?)`,
      [packed, stampNow(), store, version, expectedShopId, expectedShopId]
    );
  }
  if (result == null) {
    const row = memorySession(store);
    if (
      opts.sessionVersion != null &&
      String(opts.sessionVersion) !== "" &&
      sessionVersionOf(row) !== String(opts.sessionVersion)
    ) {
      return { updated: false, reason: "version_conflict" };
    }
    const keptEnabled = row.enabled;
    const keptShopId = row.shopId;
    const keptLinked = row.linkedAt;
    const keptGen = row.sessionGen;
    row.cookies = nextCookies;
    row.enabled = keptEnabled;
    row.shopId = keptShopId;
    row.linkedAt = keptLinked;
    row.sessionGen = keptGen;
    memory.sessions.set(store, row);
    return { updated: true, reason: "ok" };
  }
  const affected = result[0] && typeof result[0].affectedRows === "number" ? result[0].affectedRows : 1;
  if (!affected) {
    return { updated: false, reason: "version_conflict" };
  }
  // Mirror jar into process memory without bumping sessionGen / linkedAt / enabled.
  if (memory.sessions.has(store)) {
    const cached = memory.sessions.get(store);
    cached.cookies = nextCookies;
  }
  return { updated: true, reason: "ok" };
}

export { sessionVersionOf };

export async function markAuth(store, authState, authMessage) {
  await ensure();
  const message = String(authMessage || "").slice(0, 200);
  // Keep cookie jars on login_expired so a controlled Jingmai recheck can run.
  // Do not wipe historical sessions that were mis-labeled by ad-channel errors.
  if (memoryMode !== false) {
    const current = memorySession(store);
    current.authState = authState;
    current.authMessage = message;
    memory.sessions.set(store, current);
    if (memoryMode === true) {
      return;
    }
  }
  const result = await query(
    `UPDATE shen_jingmai_session
     SET auth_state = ?, auth_message = ?, updated_at = ?
     WHERE store = ?`,
    [authState, message, stampNow(), store]
  );
  if (result == null) {
    const current = memorySession(store);
    current.authState = authState;
    current.authMessage = message;
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
  let result;
  try {
    result = await query(
      `SELECT store, cookie_jar, auth_state, auth_message, enabled_flag, linked_at, shop_id, session_gen FROM shen_jingmai_session ORDER BY store ASC`
    );
  } catch (error) {
    const message = String((error && (error.sqlMessage || error.message)) || "");
    if (/session_gen|Unknown column/i.test(message)) {
      try {
        result = await query(
          `SELECT store, cookie_jar, auth_state, auth_message, enabled_flag, linked_at, shop_id FROM shen_jingmai_session ORDER BY store ASC`
        );
      } catch (inner) {
        const innerMessage = String((inner && (inner.sqlMessage || inner.message)) || "");
        if (!/shop_id|Unknown column/i.test(innerMessage)) {
          throw inner;
        }
        result = await query(
          `SELECT store, cookie_jar, auth_state, auth_message, enabled_flag, linked_at FROM shen_jingmai_session ORDER BY store ASC`
        );
      }
    } else if (/shop_id|Unknown column/i.test(message)) {
      result = await query(
        `SELECT store, cookie_jar, auth_state, auth_message, enabled_flag, linked_at FROM shen_jingmai_session ORDER BY store ASC`
      );
    } else {
      throw error;
    }
  }
  if (result == null) {
    return [...memory.sessions.values()].map(function (row) {
      return Object.assign({}, row, { cookies: row.cookies.slice() });
    });
  }
  return result[0].map(function (row) {
    let cookies = [];
    try {
      cookies = JSON.parse(row.cookie_jar || "[]");
    } catch {
      cookies = [];
    }
    const linkedAt = row.linked_at instanceof Date ? beijingParts(row.linked_at).stamp : String(row.linked_at || "");
    const sessionGen = Number(row.session_gen) || (memory.sessions.has(row.store) ? Number(memory.sessions.get(row.store).sessionGen) || 0 : 0);
    return {
      store: row.store,
      cookies: Array.isArray(cookies) ? cookies : [],
      authState: row.auth_state,
      authMessage: row.auth_message || "",
      enabled: Number(row.enabled_flag) === 1,
      shopId: String(row.shop_id || ""),
      linkedAt: linkedAt,
      sessionGen: sessionGen
    };
  });
}

export async function listCollectTargets() {
  const sessions = await listSessions();
  const seenShop = new Set();
  return sessions.filter(function (session) {
    // Manual pause never auto-enables.
    if (!session.enabled) {
      return false;
    }
    if (!session.cookies || !session.cookies.length) {
      return false;
    }
    // login_expired with a surviving jar gets a controlled recheck (do not skip forever).
    if (session.authState !== "ok" && session.authState !== "offline" && session.authState !== "login_expired") {
      return false;
    }
    if (session.shopId && seenShop.has(session.shopId)) {
      return false;
    }
    if (session.shopId) {
      seenShop.add(session.shopId);
    }
    return true;
  });
}

/**
 * Split sessions after historical markAuth(login_expired) wiped jars.
 * profileKeys: optional Set of profileIdentity().key strings that still exist on disk.
 * Never promotes enabled=false (manual pause). Never treats legacy anon/RASW dirs as recovery.
 */
export function classifySessionRecovery(sessions, profileKeys) {
  const profiles = profileKeys instanceof Set ? profileKeys : new Set(profileKeys || []);
  const recheck = [];
  const needsReauth = [];
  const paused = [];
  const active = [];
  (sessions || []).forEach(function (session) {
    if (!session || !session.store) {
      return;
    }
    if (session.enabled === false) {
      paused.push({ store: session.store, shopId: session.shopId || "", reason: "manual_pause" });
      return;
    }
    const hasJar = Array.isArray(session.cookies) && session.cookies.length > 0;
    // Prefer shopId digest; fall back to name digest. Never the old strip-ASCII / anon / RASW keys.
    const stable = profileIdentity({ store: session.store, shopId: session.shopId || "" });
    const provisional = session.shopId
      ? profileIdentity({ store: session.store, shopId: "" })
      : null;
    const hasProfile =
      (stable.key && !isForbiddenLegacyProfileKey(stable.key) && profiles.has(stable.key)) ||
      (provisional &&
        provisional.key &&
        !isForbiddenLegacyProfileKey(provisional.key) &&
        profiles.has(provisional.key));
    const expiredLike =
      session.authState === "login_expired" ||
      session.authState === "unlinked" ||
      /登录已失效|未登录京麦/.test(String(session.authMessage || ""));
    if (session.authState === "ok" && hasJar) {
      active.push({ store: session.store, shopId: session.shopId || "" });
      return;
    }
    if (session.authState === "offline" && hasJar) {
      recheck.push({
        store: session.store,
        shopId: session.shopId || "",
        reason: "offline_with_jar",
        authMessage: String(session.authMessage || "").slice(0, 120)
      });
      return;
    }
    if (expiredLike && (hasJar || hasProfile)) {
      recheck.push({
        store: session.store,
        shopId: session.shopId || "",
        reason: hasJar ? "expired_with_jar" : "expired_with_profile",
        authMessage: String(session.authMessage || "").slice(0, 120)
      });
      return;
    }
    if (expiredLike || !hasJar) {
      needsReauth.push({
        store: session.store,
        shopId: session.shopId || "",
        reason: hasProfile ? "empty_jar_but_profile_unchecked" : "empty_jar_no_backup",
        authState: session.authState || "",
        authMessage: String(session.authMessage || "").slice(0, 120)
      });
    }
  });
  return { recheck: recheck, needsReauth: needsReauth, paused: paused, active: active };
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
