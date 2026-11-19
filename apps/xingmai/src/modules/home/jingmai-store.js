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
  collector_owner VARCHAR(16) NOT NULL DEFAULT '',
  collector_lease_until CHAR(19) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

/** Live collect writer. Shen/Han may read; only owner may write cookies/samples. */
export const COLLECTOR_OWNER_HOME = "home";
export const COLLECTOR_OWNER_SHEN = "shen";
/** Lease window so a crashed home worker does not block Shen forever. */
export const COLLECTOR_LEASE_SEC = 15 * 60;
/** Loaded-process marker for release acceptance (status JSON). */
export const HOME_COLLECTOR_RUNTIME_MARK = "0.1.1261-home-atomic-mutex";
/** Human login/roster saves (may run while paused). Collect must not use this. */
export const WRITE_PURPOSE_HUMAN = "human";
/** Background collect writebacks (sample/auth/jar). */
export const WRITE_PURPOSE_COLLECT = "collect";

export function isHumanSessionWrite(fields) {
  if (!fields || typeof fields !== "object") {
    return true;
  }
  if (fields.purpose === WRITE_PURPOSE_COLLECT || fields.collect === true) {
    return false;
  }
  if (fields.purpose === WRITE_PURPOSE_HUMAN || fields.human === true) {
    return true;
  }
  // Default saveSession is human/roster/login; collect uses saveSample/markAuth/updateSessionCookies.
  return true;
}


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
  try {
    await query("ALTER TABLE shen_jingmai_session ADD COLUMN collector_lease_until CHAR(19) NOT NULL DEFAULT ''");
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
      collectorOwner: "",
      collectorLeaseUntil: ""
    }
  );
}

/** Ads/JZT failures must not be treated as Jingmai QR needs. */
export function isAdsOnlyAuthMessage(message) {
  const text = String(message || "");
  if (!text) {
    return false;
  }
  if (/京准通/.test(text) || /JZT/i.test(text) || /-100/.test(text)) {
    return true;
  }
  return false;
}

export function isTimeoutAuthMessage(message) {
  return /采集超时|采集已停止/.test(String(message || ""));
}

/** True Jingmai login/QR need — empty jar or login_expired without ads-only contamination. */
export function needsJingmaiQr(session) {
  if (!session || session.enabled === false) {
    return false;
  }
  const hasJar = Array.isArray(session.cookies) && session.cookies.length > 0;
  if (!hasJar) {
    return session.authState === "login_expired" || session.authState === "unlinked" || !session.authState;
  }
  if (session.authState !== "login_expired") {
    return false;
  }
  if (isAdsOnlyAuthMessage(session.authMessage)) {
    return false;
  }
  return true;
}

function addSecondsToStamp(stamp, seconds) {
  const raw = String(stamp || "").replace("T", " ").slice(0, 19);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ ](\d{2}):(\d{2}):(\d{2})$/);
  if (!match) {
    return raw;
  }
  const utc = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]) - 8,
    Number(match[5]),
    Number(match[6])
  );
  const next = new Date(utc + Number(seconds || 0) * 1000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(next);
  const get = function (type) {
    return (parts.find(function (part) {
      return part.type === type;
    }) || {}).value;
  };
  return get("year") + "-" + get("month") + "-" + get("day") + " " + get("hour") + ":" + get("minute") + ":" + get("second");
}

export function collectorLeaseExpired(session, nowStamp) {
  const until = String((session && session.collectorLeaseUntil) || "").trim();
  if (!until) {
    return true;
  }
  const now = String(nowStamp || stampNow()).slice(0, 19);
  return until <= now;
}

/**
 * Cross-worker write gate (advisory). Collect paths must still use atomic WHERE
 * on the real UPDATE/INSERT — never SELECT then unconditional write.
 * Human login may skip owner/pause; collect must not.
 */
export async function assertCollectorWrite(store, writer, options) {
  const opts = options || {};
  const name = String(store || "").trim();
  if (!name) {
    return { ok: false, reason: "missing_store" };
  }
  const session = await getSession(name);
  if (!session) {
    // First insert / login may create the row.
    return { ok: true, reason: "missing_session_allow_create", owner: "" };
  }
  // Manual pause must invalidate in-flight collect writes (sample/auth/jar).
  if (opts.allowPaused !== true && session.enabled === false) {
    return { ok: false, reason: "manual_pause", owner: String(session.collectorOwner || "") };
  }
  if (opts.skipOwner === true) {
    return { ok: true, reason: "human_skip_owner", owner: String(session.collectorOwner || "") };
  }
  const owner = String(session.collectorOwner || "");
  if (!owner || collectorLeaseExpired(session)) {
    return { ok: true, reason: "unclaimed_or_expired", owner: owner };
  }
  const who = String(writer || "").trim();
  if (who && who === owner) {
    return { ok: true, reason: "owner", owner: owner };
  }
  return { ok: false, reason: "owned_by_other", owner: owner };
}

/** SQL/memory predicate pieces for collect writes (pause + owner/lease + optional gen). */
function collectWriteWhereSql(hasGen) {
  const genClause = hasGen ? "AND session_gen = ?" : "";
  return (
    `WHERE store = ?
       AND enabled_flag = 1
       ${genClause}
       AND (
         collector_owner = ?
         OR collector_owner = ''
         OR collector_lease_until = ''
         OR collector_lease_until <= ?
       )`
  );
}

function memoryCollectWriteOk(session, writer, stamp, sessionVersion) {
  if (!session) {
    return { ok: false, reason: "missing" };
  }
  if (session.enabled === false) {
    return { ok: false, reason: "manual_pause", owner: String(session.collectorOwner || "") };
  }
  const owner = String(session.collectorOwner || "");
  const who = String(writer || "").trim() || COLLECTOR_OWNER_HOME;
  if (owner && owner !== who && !collectorLeaseExpired(session, stamp)) {
    return { ok: false, reason: "owned_by_other", owner: owner };
  }
  if (
    sessionVersion != null &&
    String(sessionVersion) !== "" &&
    sessionVersionOf(session) !== String(sessionVersion)
  ) {
    return { ok: false, reason: "version_conflict", owner: owner };
  }
  return { ok: true, reason: "ok", owner: owner, gen: Number(session.sessionGen) || 0 };
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
    collectorOwner: String(row.collector_owner || ""),
    collectorLeaseUntil: String(row.collector_lease_until || "")
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
      `SELECT store, cookie_jar, auth_state, auth_message, enabled_flag, linked_at, shop_id, session_gen, collector_owner, collector_lease_until
       FROM shen_jingmai_session WHERE store = ? LIMIT 1`,
      [store]
    );
  } catch (error) {
    const message = String((error && (error.sqlMessage || error.message)) || "");
    if (/collector_lease_until|Unknown column/i.test(message)) {
      result = await query(
        `SELECT store, cookie_jar, auth_state, auth_message, enabled_flag, linked_at, shop_id, session_gen, collector_owner
         FROM shen_jingmai_session WHERE store = ? LIMIT 1`,
        [store]
      );
    } else if (/collector_owner|Unknown column/i.test(message)) {
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
  const human = isHumanSessionWrite(fields);
  const writer = fields && fields.writer != null ? fields.writer : COLLECTOR_OWNER_HOME;
  // Human login/roster may save while paused and ignores collect lease.
  // Collect must not call saveSession; it uses saveSample/markAuth/updateSessionCookies.
  if (!human) {
    const gate = await assertCollectorWrite(store, writer, { allowPaused: false });
    if (!gate.ok) {
      return null;
    }
  }
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
    // Human save bumps gen and clears lease so in-flight collect tasks die.
    let collectorOwner =
      fields.collectorOwner == null ? current.collectorOwner || "" : String(fields.collectorOwner || "");
    let collectorLeaseUntil =
      fields.collectorLeaseUntil == null
        ? current.collectorLeaseUntil || ""
        : String(fields.collectorLeaseUntil || "");
    if (human && fields.collectorOwner == null && fields.collectorLeaseUntil == null) {
      collectorOwner = "";
      collectorLeaseUntil = "";
    }
    const row = {
      store: store,
      cookies: cookies || [],
      authState: authState,
      authMessage: String(authMessage || "").slice(0, 200),
      enabled: enabled,
      shopId: shopId,
      linkedAt: stampNow(),
      sessionGen: sessionGen,
      collectorOwner: collectorOwner,
      collectorLeaseUntil: collectorLeaseUntil
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
  const clearLease = human && fields.collectorOwner == null && fields.collectorLeaseUntil == null;

  // Atomic bump: DB owns session_gen so restarts / multi-worker cannot reset or collide.
  // Human path also clears collector lease in the same statement (task generation + invalidate).
  try {
    if (clearLease) {
      await query(
        `INSERT INTO shen_jingmai_session (store, cookie_jar, auth_state, auth_message, enabled_flag, shop_id, linked_at, updated_at, session_gen, collector_owner, collector_lease_until)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, '', '')
         ON DUPLICATE KEY UPDATE
           cookie_jar = VALUES(cookie_jar),
           auth_state = VALUES(auth_state),
           auth_message = VALUES(auth_message),
           enabled_flag = VALUES(enabled_flag),
           shop_id = IF(VALUES(shop_id) = '', shop_id, VALUES(shop_id)),
           linked_at = VALUES(linked_at),
           updated_at = VALUES(updated_at),
           session_gen = session_gen + 1,
           collector_owner = '',
           collector_lease_until = ''`,
        [store, packed, authState, String(authMessage || "").slice(0, 200), enabled ? 1 : 0, shopId, stamp, stamp]
      );
    } else {
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
    }
  } catch (error) {
    const message = String((error && (error.sqlMessage || error.message)) || "");
    if (!/session_gen|collector_owner|collector_lease_until|Unknown column/i.test(message)) {
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
  const writer = opts.writer != null ? opts.writer : COLLECTOR_OWNER_HOME;
  const expectedShopId = String(opts.expectedShopId || "").trim();
  const nextCookies = cookies.map(function (item) {
    return item && typeof item === "object" ? Object.assign({}, item) : item;
  });
  const packed = JSON.stringify(nextCookies);
  const stamp = stampNow();

  if (memoryForced()) {
    const current = memory.sessions.has(store) ? memorySession(store) : null;
    const permit = memoryCollectWriteOk(current, writer, stamp, opts.sessionVersion);
    if (!permit.ok) {
      return { updated: false, reason: permit.reason, owner: permit.owner || "" };
    }
    const rowShopId = String(current.shopId || "").trim();
    if (expectedShopId && rowShopId && expectedShopId !== rowShopId) {
      return { updated: false, reason: "shop_changed" };
    }
    if (opts.identity) {
      const match = matchCollectIdentity({ store: store, shopId: rowShopId || expectedShopId }, opts.identity);
      if (!match.ok) {
        return { updated: false, reason: match.reason };
      }
    }
    current.cookies = nextCookies;
    memory.sessions.set(store, current);
    return { updated: true, reason: "ok" };
  }

  // Advisory identity check only; write itself is atomic on pause+owner+gen.
  const current = await getSession(store);
  if (!current) {
    return { updated: false, reason: "missing" };
  }
  const rowShopId = String(current.shopId || "").trim();
  if (expectedShopId && rowShopId && expectedShopId !== rowShopId) {
    return { updated: false, reason: "shop_changed" };
  }
  if (opts.identity) {
    const match = matchCollectIdentity({ store: store, shopId: rowShopId || expectedShopId }, opts.identity);
    if (!match.ok) {
      return { updated: false, reason: match.reason };
    }
  }

  const parsed = parseSessionVersion(
    opts.sessionVersion != null && String(opts.sessionVersion) !== ""
      ? opts.sessionVersion
      : sessionVersionOf(current)
  );
  const gen = parsed.kind === "gen" ? parsed.gen : Number(current.sessionGen) || 0;
  const who = String(writer || "").trim() || COLLECTOR_OWNER_HOME;
  // Single conditional UPDATE: enabled + gen CAS + owner/lease. No SELECT-then-blind-write.
  const result = await query(
    `UPDATE shen_jingmai_session
     SET cookie_jar = ?, updated_at = ?
     ${collectWriteWhereSql(true)}
       AND (? = '' OR shop_id = '' OR shop_id = ?)`,
    [packed, stamp, store, gen, who, stamp, expectedShopId, expectedShopId]
  );
  const affected = result[0] && typeof result[0].affectedRows === "number" ? result[0].affectedRows : 0;
  if (!affected) {
    const again = await getSession(store);
    if (!again) {
      return { updated: false, reason: "missing" };
    }
    if (again.enabled === false) {
      return { updated: false, reason: "manual_pause", owner: String(again.collectorOwner || "") };
    }
    if (
      opts.sessionVersion != null &&
      String(opts.sessionVersion) !== "" &&
      sessionVersionOf(again) !== String(opts.sessionVersion)
    ) {
      return { updated: false, reason: "version_conflict" };
    }
    const owner = String(again.collectorOwner || "");
    if (owner && owner !== who && !collectorLeaseExpired(again, stamp)) {
      return { updated: false, reason: "owned_by_other", owner: owner };
    }
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
  const writer = opts.writer != null ? opts.writer : COLLECTOR_OWNER_HOME;
  const who = String(writer || "").trim() || COLLECTOR_OWNER_HOME;
  const message = String(authMessage || "").slice(0, 200);
  const stamp = stampNow();
  // Keep cookie jars on login_expired so a controlled Jingmai recheck can run.
  if (memoryForced()) {
    const current = memory.sessions.has(store) ? memorySession(store) : null;
    const permit = memoryCollectWriteOk(current, writer, stamp, opts.sessionVersion);
    if (!permit.ok) {
      return { updated: false, reason: permit.reason, owner: permit.owner || "" };
    }
    current.authState = authState;
    current.authMessage = message;
    memory.sessions.set(store, current);
    return { updated: true, reason: "ok" };
  }

  const hasGen = opts.sessionVersion != null && String(opts.sessionVersion) !== "";
  const parsed = parseSessionVersion(hasGen ? opts.sessionVersion : "");
  let result;
  if (hasGen && parsed.kind === "gen") {
    result = await query(
      `UPDATE shen_jingmai_session
       SET auth_state = ?, auth_message = ?, updated_at = ?
       ${collectWriteWhereSql(true)}`,
      [authState, message, stamp, store, parsed.gen, who, stamp]
    );
  } else {
    // Still atomic on pause + owner/lease even when caller omitted gen.
    result = await query(
      `UPDATE shen_jingmai_session
       SET auth_state = ?, auth_message = ?, updated_at = ?
       ${collectWriteWhereSql(false)}`,
      [authState, message, stamp, store, who, stamp]
    );
  }
  const affected = result[0] && typeof result[0].affectedRows === "number" ? result[0].affectedRows : 0;
  if (!affected) {
    const again = await getSession(store);
    if (!again) {
      return { updated: false, reason: "missing" };
    }
    if (again.enabled === false) {
      return { updated: false, reason: "manual_pause", owner: String(again.collectorOwner || "") };
    }
    if (hasGen && sessionVersionOf(again) !== String(opts.sessionVersion)) {
      return { updated: false, reason: "version_conflict" };
    }
    const owner = String(again.collectorOwner || "");
    if (owner && owner !== who && !collectorLeaseExpired(again, stamp)) {
      return { updated: false, reason: "owned_by_other", owner: owner };
    }
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
      `SELECT store, cookie_jar, auth_state, auth_message, enabled_flag, linked_at, shop_id, session_gen, collector_owner, collector_lease_until FROM shen_jingmai_session ORDER BY store ASC`
    );
  } catch (error) {
    const message = String((error && (error.sqlMessage || error.message)) || "");
    if (/collector_lease_until|Unknown column/i.test(message)) {
      result = await query(
        `SELECT store, cookie_jar, auth_state, auth_message, enabled_flag, linked_at, shop_id, session_gen, collector_owner FROM shen_jingmai_session ORDER BY store ASC`
      );
    } else if (/collector_owner|Unknown column/i.test(message)) {
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
 * Atomic single-owner handoff with lease. Never flips enabled=false (manual pause).
 * Empty owner, same owner, or expired lease can be claimed (failure recovery).
 */
export async function claimCollectorOwner(store, owner = COLLECTOR_OWNER_HOME, options) {
  const name = String(store || "").trim();
  const who = String(owner || COLLECTOR_OWNER_HOME).trim() || COLLECTOR_OWNER_HOME;
  const leaseSec = options && options.leaseSec != null ? Number(options.leaseSec) : COLLECTOR_LEASE_SEC;
  if (!name) {
    return { ok: false, reason: "missing_store" };
  }
  await ensure();
  const stamp = stampNow();
  const leaseUntil = addSecondsToStamp(stamp, leaseSec > 0 ? leaseSec : COLLECTOR_LEASE_SEC);
  if (memoryForced()) {
    const current = memorySession(name);
    if (current.enabled === false) {
      return { ok: false, reason: "manual_pause", owner: current.collectorOwner || "" };
    }
    const prev = String(current.collectorOwner || "");
    if (prev && prev !== who && !collectorLeaseExpired(current, stamp)) {
      return { ok: false, reason: "owned_by_other", owner: prev };
    }
    current.collectorOwner = who;
    current.collectorLeaseUntil = leaseUntil;
    memory.sessions.set(name, current);
    return {
      ok: true,
      reason: prev === who ? "renewed" : prev ? "reclaimed" : "claimed",
      owner: who,
      leaseUntil: leaseUntil
    };
  }
  let result;
  try {
    result = await query(
      `UPDATE shen_jingmai_session
       SET collector_owner = ?, collector_lease_until = ?, updated_at = ?
       WHERE store = ?
         AND enabled_flag = 1
         AND (
           collector_owner = ''
           OR collector_owner = ?
           OR collector_lease_until = ''
           OR collector_lease_until <= ?
         )`,
      [who, leaseUntil, stamp, name, who, stamp]
    );
  } catch (error) {
    const message = String((error && (error.sqlMessage || error.message)) || "");
    if (/collector_lease_until|Unknown column/i.test(message)) {
      try {
        result = await query(
          `UPDATE shen_jingmai_session
           SET collector_owner = ?, updated_at = ?
           WHERE store = ?
             AND enabled_flag = 1
             AND (collector_owner = '' OR collector_owner = ?)`,
          [who, stamp, name, who]
        );
      } catch (inner) {
        if (/collector_owner|Unknown column/i.test(String((inner && (inner.sqlMessage || inner.message)) || ""))) {
          return { ok: true, reason: "column_missing_fail_open", owner: who };
        }
        throw inner;
      }
    } else if (/collector_owner|Unknown column/i.test(message)) {
      return { ok: true, reason: "column_missing_fail_open", owner: who };
    } else {
      throw error;
    }
  }
  const affected = result[0] && typeof result[0].affectedRows === "number" ? result[0].affectedRows : 0;
  if (affected) {
    return { ok: true, reason: "claimed", owner: who, leaseUntil: leaseUntil };
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
  const writer = opts.writer != null ? String(opts.writer) : requireOwner;
  const now = stampNow();
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
    const owner = String(session.collectorOwner || "");
    if (requireOwner && owner && owner !== requireOwner && !collectorLeaseExpired(session, now)) {
      return false;
    }
    if (writer && owner && owner !== writer && !collectorLeaseExpired(session, now)) {
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
    runtimeMark: HOME_COLLECTOR_RUNTIME_MARK,
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
    leaseActive: 0,
    needsQr: [],
    adsFailed: [],
    collectTimeout: []
  };
  sessions.forEach(function (session) {
    if (session.enabled === false) {
      summary.paused += 1;
    } else {
      summary.enabled += 1;
    }
    if (session.cookies && session.cookies.length) {
      summary.withJar += 1;
    }
    if (needsJingmaiQr(session)) {
      summary.needsQr.push({
        store: session.store,
        shopId: session.shopId || "",
        authState: session.authState,
        reason: "jingmai_login"
      });
    } else if (session.enabled !== false && isAdsOnlyAuthMessage(session.authMessage)) {
      summary.adsFailed.push({
        store: session.store,
        shopId: session.shopId || "",
        authState: session.authState,
        reason: String(session.authMessage || "").slice(0, 120)
      });
    } else if (session.enabled !== false && isTimeoutAuthMessage(session.authMessage)) {
      summary.collectTimeout.push({
        store: session.store,
        shopId: session.shopId || "",
        authState: session.authState,
        reason: String(session.authMessage || "").slice(0, 120)
      });
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
    if (owner && !collectorLeaseExpired(session)) {
      summary.leaseActive += 1;
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
  const writer = opts.writer != null ? opts.writer : COLLECTOR_OWNER_HOME;
  const who = String(writer || "").trim() || COLLECTOR_OWNER_HOME;
  const stamp = stampNow();
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
    const current = memory.sessions.has(row.store) ? memorySession(row.store) : null;
    const permit = memoryCollectWriteOk(current, writer, stamp, opts.sessionVersion);
    if (!permit.ok) {
      return { saved: false, reason: permit.reason, owner: permit.owner || "" };
    }
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

  const hasGen = opts.sessionVersion != null && String(opts.sessionVersion) !== "";
  const parsed = parseSessionVersion(hasGen ? opts.sessionVersion : "");
  const run = async function (execQuery) {
    let permit;
    if (hasGen && parsed.kind === "gen") {
      permit = await execQuery(
        `UPDATE shen_jingmai_session
         SET updated_at = ?
         ${collectWriteWhereSql(true)}`,
        [stamp, row.store, parsed.gen, who, stamp]
      );
    } else {
      permit = await execQuery(
        `UPDATE shen_jingmai_session
         SET updated_at = ?
         ${collectWriteWhereSql(false)}`,
        [stamp, row.store, who, stamp]
      );
    }
    const affected = permit[0] && typeof permit[0].affectedRows === "number" ? permit[0].affectedRows : 0;
    if (!affected) {
      return { saved: false, reason: "permit_denied" };
    }
    await execQuery(
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
  };

  const pool = await resolvePool();
  let outcome;
  if (pool && typeof pool.getConnection === "function") {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      outcome = await run(function (sql, params) {
        return conn.query(sql, params);
      });
      if (!outcome.saved) {
        await conn.rollback();
      } else {
        await conn.commit();
      }
    } catch (error) {
      try {
        await conn.rollback();
      } catch {
        /* ignore */
      }
      throw error;
    } finally {
      conn.release();
    }
  } else {
    outcome = await run(query);
  }

  if (!outcome.saved) {
    const again = await getSession(row.store);
    if (!again) {
      return { saved: false, reason: "missing" };
    }
    if (again.enabled === false) {
      return { saved: false, reason: "manual_pause", owner: String(again.collectorOwner || "") };
    }
    if (hasGen && sessionVersionOf(again) !== String(opts.sessionVersion)) {
      return { saved: false, reason: "version_conflict" };
    }
    const owner = String(again.collectorOwner || "");
    if (owner && owner !== who && !collectorLeaseExpired(again, stamp)) {
      return { saved: false, reason: "owned_by_other", owner: owner };
    }
    return { saved: false, reason: hasGen ? "version_conflict" : "owned_by_other", owner: owner };
  }
  return outcome;
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
