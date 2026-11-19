import { getPool as authGetPool } from "../profile/auth.js";
import { beijingParts, buildLiveView, matchCollectIdentity, previousDay } from "./jingmai.js";
import { isForbiddenLegacyProfileKey, profileIdentity } from "./jingmai-desk.js";

const CREATE_SESSION = `CREATE TABLE IF NOT EXISTS shen_jingmai_session (
  store VARCHAR(64) NOT NULL PRIMARY KEY,
  cookie_jar MEDIUMTEXT NOT NULL,
  auth_state VARCHAR(32) NOT NULL DEFAULT 'unlinked',
  auth_message VARCHAR(200) NOT NULL DEFAULT '',
  enabled_flag TINYINT NOT NULL DEFAULT 1,
  shop_id VARCHAR(32) NOT NULL DEFAULT '',
  linked_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  session_gen INT NOT NULL DEFAULT 0,
  collector_owner VARCHAR(16) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

/** Live collect writer. Shen/Han may read; only owner may write cookies/samples. */
export const COLLECTOR_OWNER_HOME = "home";
export const COLLECTOR_OWNER_SHEN = "shen";

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

let injectedPool = null;
let ready = false;
const memory = { sessions: new Map(), samples: [] };

function stampNow() {
  return beijingParts().stamp;
}

function memoryForced() {
  // Injected pool always wins (SQL path for fake/real pools in tests).
  if (injectedPool) {
    return false;
  }
  // Explicit opt-in for unit tests. Production leaves this unset and uses auth.getPool().
  if (process.env.SHEN_JINGMAI_MEMORY === "1") {
    return true;
  }
  if (process.env.SHEN_JINGMAI_MEMORY === "0") {
    return false;
  }
  return false;
}

/**
 * Production uses profile/auth getPool. Tests may inject a fake pool.
 * Explicit SHEN_JINGMAI_MEMORY=1 keeps the in-process map for unit tests.
 * Module-miss / SQL errors never silently flip to permanent memory.
 */
export function setJingmaiPoolForTests(pool) {
  injectedPool = pool || null;
  ready = false;
}

async function resolvePool() {
  if (injectedPool) {
    return injectedPool;
  }
  return authGetPool();
}

async function query(sql, params = []) {
  if (memoryForced()) {
    return null;
  }
  const pool = await resolvePool();
  return pool.query(sql, params);
}

async function ensure() {
  if (ready) {
    return;
  }
  if (memoryForced()) {
    ready = true;
    return;
  }
  await query(CREATE_SESSION);
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
  try {
    await query("ALTER TABLE shen_jingmai_session ADD COLUMN collector_owner VARCHAR(16) NOT NULL DEFAULT ''");
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
      sessionGen: 0,
      collectorOwner: ""
    }
  );
}

export function sessionVersionOf(row) {
  if (!row) {
    return "";
  }
  if (row.sessionGen != null && row.sessionGen !== "") {
    return "g:" + String(Number(row.sessionGen) || 0);
  }
  return String(row.linkedAt || "");
}

function parseSessionVersion(version) {
  const text = String(version || "");
  const match = text.match(/^g:(\d+)$/);
  if (match) {
    return { kind: "gen", gen: Number(match[1]) };
  }
  if (text) {
    return { kind: "linked", linkedAt: text };
  }
  return { kind: "none" };
}

function mapDbSession(row) {
  let cookies = [];
  try {
    cookies = JSON.parse(row.cookie_jar || "[]");
  } catch {
    cookies = [];
  }
  const linkedAt = row.linked_at instanceof Date ? beijingParts(row.linked_at).stamp : String(row.linked_at || "");
  return {
    store: row.store,
    cookies: Array.isArray(cookies) ? cookies : [],
    authState: row.auth_state,
    authMessage: row.auth_message || "",
    enabled: Number(row.enabled_flag) === 1,
    shopId: String(row.shop_id || ""),
    linkedAt: linkedAt,
    sessionGen: Number(row.session_gen) || 0,
    collectorOwner: String(row.collector_owner || "")
  };
}

export async function resetJingmaiStore() {
  memory.sessions.clear();
  memory.samples = [];
  ready = false;
}

export async function getSession(store) {
  await ensure();
  if (memoryForced()) {
    if (!memory.sessions.has(store)) {
      return null;
    }
    const row = memory.sessions.get(store);
    return Object.assign({}, row, { cookies: row.cookies.slice() });
  }
  let result;
  try {
    result = await query(
      `SELECT store, cookie_jar, auth_state, auth_message, enabled_flag, linked_at, shop_id, session_gen, collector_owner
       FROM shen_jingmai_session WHERE store = ? LIMIT 1`,
      [store]
    );
  } catch (error) {
    const message = String((error && (error.sqlMessage || error.message)) || "");
    if (/collector_owner|Unknown column/i.test(message)) {
      result = await query(
        `SELECT store, cookie_jar, auth_state, auth_message, enabled_flag, linked_at, shop_id, session_gen
         FROM shen_jingmai_session WHERE store = ? LIMIT 1`,
        [store]
      );
    } else if (/session_gen|Unknown column/i.test(message)) {
      result = await query(
        `SELECT store, cookie_jar, auth_state, auth_message, enabled_flag, linked_at, shop_id
         FROM shen_jingmai_session WHERE store = ? LIMIT 1`,
        [store]
      );
    } else {
      throw error;
    }
  }
  const rows = result && result[0] ? result[0] : [];
  if (!rows.length) {
    return null;
  }
  return mapDbSession(rows[0]);
}

export async function saveSession(store, fields) {
  await ensure();
  if (memoryForced()) {
    const current = memorySession(store);
    const cookies = fields.cookies == null ? current.cookies : fields.cookies;
    const authState = fields.authState || current.authState || "unlinked";
    const authMessage = fields.authMessage == null ? current.authMessage : fields.authMessage;
    const enabled = fields.enabled == null ? current.enabled : Boolean(fields.enabled);
    const shopId = String(fields.shopId == null ? current.shopId || "" : fields.shopId)
      .trim()
      .slice(0, 32);
    const sessionGen = (Number(current.sessionGen) || 0) + 1;
    const collectorOwner =
      fields.collectorOwner == null ? current.collectorOwner || "" : String(fields.collectorOwner || "");
    const row = {
      store: store,
      cookies: cookies || [],
      authState: authState,
      authMessage: String(authMessage || "").slice(0, 200),
      enabled: enabled,
      shopId: shopId,
      linkedAt: stampNow(),
      sessionGen: sessionGen,
      collectorOwner: collectorOwner
    };
    memory.sessions.set(store, row);
    return row;
  }

  const current = await getSession(store);
  const cookies = fields.cookies == null ? (current ? current.cookies : []) : fields.cookies;
  const authState = fields.authState || (current ? current.authState : "unlinked");
  const authMessage = fields.authMessage == null ? (current ? current.authMessage : "") : fields.authMessage;
  const enabled = fields.enabled == null ? (current ? current.enabled : true) : Boolean(fields.enabled);
  const shopId = String(fields.shopId == null ? (current && current.shopId) || "" : fields.shopId)
    .trim()
    .slice(0, 32);
  const stamp = stampNow();
  const packed = JSON.stringify(cookies || []);

  // Atomic bump: DB owns session_gen so restarts / multi-worker cannot reset or collide.
  try {
    await query(
      `INSERT INTO shen_jingmai_session (store, cookie_jar, auth_state, auth_message, enabled_flag, shop_id, linked_at, updated_at, session_gen)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
         cookie_jar = VALUES(cookie_jar),
         auth_state = VALUES(auth_state),
         auth_message = VALUES(auth_message),
         enabled_flag = VALUES(enabled_flag),
         shop_id = IF(VALUES(shop_id) = '', shop_id, VALUES(shop_id)),
         linked_at = VALUES(linked_at),
         updated_at = VALUES(updated_at),
         session_gen = session_gen + 1`,
      [store, packed, authState, String(authMessage || "").slice(0, 200), enabled ? 1 : 0, shopId, stamp, stamp]
    );
  } catch (error) {
    const message = String((error && (error.sqlMessage || error.message)) || "");
    if (!/session_gen|Unknown column/i.test(message)) {
      throw error;
    }
    await query(
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
      [store, packed, authState, String(authMessage || "").slice(0, 200), enabled ? 1 : 0, shopId, stamp, stamp]
    );
  }

  const saved = await getSession(store);
  if (saved) {
    // Mirror for same-process callers; gen comes from DB readback.
    memory.sessions.set(store, Object.assign({}, saved, { cookies: saved.cookies.slice() }));
  }
  return saved;
}

/**
 * Targeted cookie jar refresh after a collect round.
 * - Never flips enabled (manual pause stays paused)
 * - Never clears/overwrites shop_id with empty
 * - sessionVersion must still match (gen CAS includes gen=0)
 * - optional identity must match the row's shop
 */
export async function updateSessionCookies(store, cookies, options) {
  const opts = options || {};
  await ensure();
  if (!Array.isArray(cookies)) {
    return { updated: false, reason: "invalid_jar" };
  }
  const current = await getSession(store);
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

  if (memoryForced()) {
    const row = memorySession(store);
    row.cookies = nextCookies;
    memory.sessions.set(store, row);
    return { updated: true, reason: "ok" };
  }

  const parsed = parseSessionVersion(opts.sessionVersion != null ? opts.sessionVersion : sessionVersionOf(current));
  const gen = parsed.kind === "gen" ? parsed.gen : Number(current.sessionGen) || 0;
  // Always CAS on session_gen (including 0). Do not fall back to second-precision linked_at alone.
  const result = await query(
    `UPDATE shen_jingmai_session
     SET cookie_jar = ?, updated_at = ?
     WHERE store = ?
       AND session_gen = ?
       AND (? = '' OR shop_id = '' OR shop_id = ?)`,
    [packed, stampNow(), store, gen, expectedShopId, expectedShopId]
  );
  const affected = result[0] && typeof result[0].affectedRows === "number" ? result[0].affectedRows : 0;
  if (!affected) {
    return { updated: false, reason: "version_conflict" };
  }
  if (memory.sessions.has(store)) {
    const cached = memory.sessions.get(store);
    cached.cookies = nextCookies;
  }
  return { updated: true, reason: "ok" };
}

export async function markAuth(store, authState, authMessage, options) {
  const opts = options || {};
  await ensure();
  const message = String(authMessage || "").slice(0, 200);
  // Keep cookie jars on login_expired so a controlled Jingmai recheck can run.
  if (memoryForced()) {
    const current = memorySession(store);
    if (
      opts.sessionVersion != null &&
      String(opts.sessionVersion) !== "" &&
      sessionVersionOf(current) !== String(opts.sessionVersion)
    ) {
      return { updated: false, reason: "version_conflict" };
    }
    current.authState = authState;
    current.authMessage = message;
    memory.sessions.set(store, current);
    return { updated: true, reason: "ok" };
  }

  const current = await getSession(store);
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
  const parsed = parseSessionVersion(opts.sessionVersion != null ? opts.sessionVersion : sessionVersionOf(current));
  const gen = parsed.kind === "gen" ? parsed.gen : Number(current.sessionGen) || 0;
  let result;
  if (opts.sessionVersion != null && String(opts.sessionVersion) !== "") {
    result = await query(
      `UPDATE shen_jingmai_session
       SET auth_state = ?, auth_message = ?, updated_at = ?
       WHERE store = ? AND session_gen = ?`,
      [authState, message, stampNow(), store, gen]
    );
  } else {
    result = await query(
      `UPDATE shen_jingmai_session
       SET auth_state = ?, auth_message = ?, updated_at = ?
       WHERE store = ?`,
      [authState, message, stampNow(), store]
    );
  }
  const affected = result[0] && typeof result[0].affectedRows === "number" ? result[0].affectedRows : 0;
  if (!affected) {
    return { updated: false, reason: "version_conflict" };
  }
  if (memory.sessions.has(store)) {
    const cached = memory.sessions.get(store);
    cached.authState = authState;
    cached.authMessage = message;
  }
  return { updated: true, reason: "ok" };
}

export async function setRoster(shops) {
  await ensure();
  for (const shop of shops || []) {
    const name = String(shop.store || "").trim();
    if (!name) {
      continue;
    }
    if (memoryForced()) {
      const current = memorySession(name);
      current.enabled = Boolean(shop.enabled);
      current.store = name;
      memory.sessions.set(name, current);
      continue;
    }
    await query(
      `INSERT INTO shen_jingmai_session (store, cookie_jar, auth_state, auth_message, enabled_flag, linked_at, updated_at, session_gen)
       VALUES (?, '[]', 'unlinked', '', ?, ?, ?, 0)
       ON DUPLICATE KEY UPDATE enabled_flag = VALUES(enabled_flag), updated_at = VALUES(updated_at)`,
      [name, shop.enabled ? 1 : 0, stampNow(), stampNow()]
    );
  }
  return { ok: true };
}

export async function listSessions() {
  await ensure();
  if (memoryForced()) {
    return [...memory.sessions.values()].map(function (row) {
      return Object.assign({}, row, { cookies: row.cookies.slice() });
    });
  }
  let result;
  try {
    result = await query(
      `SELECT store, cookie_jar, auth_state, auth_message, enabled_flag, linked_at, shop_id, session_gen, collector_owner FROM shen_jingmai_session ORDER BY store ASC`
    );
  } catch (error) {
    const message = String((error && (error.sqlMessage || error.message)) || "");
    if (/collector_owner|Unknown column/i.test(message)) {
      result = await query(
        `SELECT store, cookie_jar, auth_state, auth_message, enabled_flag, linked_at, shop_id, session_gen FROM shen_jingmai_session ORDER BY store ASC`
      );
    } else if (/session_gen|Unknown column/i.test(message)) {
      result = await query(
        `SELECT store, cookie_jar, auth_state, auth_message, enabled_flag, linked_at, shop_id FROM shen_jingmai_session ORDER BY store ASC`
      );
    } else if (/shop_id|Unknown column/i.test(message)) {
      result = await query(
        `SELECT store, cookie_jar, auth_state, auth_message, enabled_flag, linked_at FROM shen_jingmai_session ORDER BY store ASC`
      );
    } else {
      throw error;
    }
  }
  return (result[0] || []).map(mapDbSession);
}

/**
 * Atomic single-owner handoff. Never flips enabled=false (manual pause).
 * Empty owner or same owner can be claimed; another owner blocks until released.
 */
export async function claimCollectorOwner(store, owner = COLLECTOR_OWNER_HOME) {
  const name = String(store || "").trim();
  const who = String(owner || COLLECTOR_OWNER_HOME).trim() || COLLECTOR_OWNER_HOME;
  if (!name) {
    return { ok: false, reason: "missing_store" };
  }
  await ensure();
  if (memoryForced()) {
    const current = memorySession(name);
    if (current.enabled === false) {
      return { ok: false, reason: "manual_pause", owner: current.collectorOwner || "" };
    }
    const prev = String(current.collectorOwner || "");
    if (prev && prev !== who) {
      return { ok: false, reason: "owned_by_other", owner: prev };
    }
    current.collectorOwner = who;
    memory.sessions.set(name, current);
    return { ok: true, reason: prev === who ? "already" : "claimed", owner: who };
  }
  const stamp = stampNow();
  let result;
  try {
    result = await query(
      `UPDATE shen_jingmai_session
       SET collector_owner = ?, updated_at = ?
       WHERE store = ?
         AND enabled_flag = 1
         AND (collector_owner = '' OR collector_owner = ?)`,
      [who, stamp, name, who]
    );
  } catch (error) {
    const message = String((error && (error.sqlMessage || error.message)) || "");
    if (/collector_owner|Unknown column/i.test(message)) {
      return { ok: true, reason: "column_missing_fail_open", owner: who };
    }
    throw error;
  }
  const affected = result[0] && typeof result[0].affectedRows === "number" ? result[0].affectedRows : 0;
  if (affected) {
    return { ok: true, reason: "claimed", owner: who };
  }
  const session = await getSession(name);
  if (!session) {
    return { ok: false, reason: "missing_session" };
  }
  if (session.enabled === false) {
    return { ok: false, reason: "manual_pause", owner: session.collectorOwner || "" };
  }
  return { ok: false, reason: "owned_by_other", owner: session.collectorOwner || "" };
}

export async function listCollectTargets(options) {
  const opts = options && typeof options === "object" ? options : {};
  const requireOwner = opts.requireOwner != null ? String(opts.requireOwner) : "";
  const sessions = await listSessions();
  const seenShop = new Set();
  return sessions.filter(function (session) {
    if (!session.enabled) {
      return false;
    }
    if (!session.cookies || !session.cookies.length) {
      return false;
    }
    if (session.authState !== "ok" && session.authState !== "offline" && session.authState !== "login_expired") {
      return false;
    }
    if (requireOwner && String(session.collectorOwner || "") !== requireOwner) {
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

/** Counts for ops evidence — never returns cookie jars. */
export async function collectStatusSummary() {
  const sessions = await listSessions();
  const summary = {
    ok: true,
    collectorOwnerDefault: COLLECTOR_OWNER_HOME,
    total: sessions.length,
    enabled: 0,
    paused: 0,
    withJar: 0,
    authOk: 0,
    loginExpired: 0,
    offline: 0,
    ownerHome: 0,
    ownerShen: 0,
    ownerEmpty: 0,
    ownerOther: 0,
    needsQr: []
  };
  sessions.forEach(function (session) {
    if (session.enabled === false) {
      summary.paused += 1;
    } else {
      summary.enabled += 1;
    }
    if (session.cookies && session.cookies.length) {
      summary.withJar += 1;
    } else if (session.enabled !== false) {
      summary.needsQr.push({ store: session.store, shopId: session.shopId || "", authState: session.authState });
    }
    if (session.authState === "ok") {
      summary.authOk += 1;
    } else if (session.authState === "login_expired") {
      summary.loginExpired += 1;
    } else if (session.authState === "offline") {
      summary.offline += 1;
    }
    const owner = String(session.collectorOwner || "");
    if (owner === COLLECTOR_OWNER_HOME) {
      summary.ownerHome += 1;
    } else if (owner === COLLECTOR_OWNER_SHEN) {
      summary.ownerShen += 1;
    } else if (!owner) {
      summary.ownerEmpty += 1;
    } else {
      summary.ownerOther += 1;
    }
  });
  return summary;
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
    const stable = profileIdentity({ store: session.store, shopId: session.shopId || "" });
    const provisional = session.shopId ? profileIdentity({ store: session.store, shopId: "" }) : null;
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

export async function saveSample(sample, options) {
  const opts = options || {};
  await ensure();
  if (opts.sessionVersion != null && String(opts.sessionVersion) !== "") {
    const current = await getSession(sample.store);
    if (!current || sessionVersionOf(current) !== String(opts.sessionVersion)) {
      return { saved: false, reason: "version_conflict" };
    }
  }
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
  if (memoryForced()) {
    const index = memory.samples.findIndex(function (item) {
      return item.store === row.store && item.capturedAt === row.capturedAt;
    });
    if (index >= 0) {
      memory.samples[index] = row;
    } else {
      memory.samples.push(row);
    }
    return { saved: true, reason: "ok" };
  }
  await query(
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
  return { saved: true, reason: "ok" };
}

export async function listSamples(fromDay, toDay) {
  await ensure();
  if (memoryForced()) {
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
  return (result[0] || []).map(function (row) {
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
