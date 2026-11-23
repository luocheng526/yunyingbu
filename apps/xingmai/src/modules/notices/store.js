import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const dataFile = path.join(root, "data", "notices.json");

const LEVELS = new Set(["normal", "important"]);
const STATUSES = new Set(["active", "done", "draft"]);
const CATEGORIES = {
  general: "公告",
  hr: "人事异动",
  promotion: "晋升报",
  anniversary: "周年庆",
  daily: "日常公告",
  values: "价值观践行",
  board: "龙虎榜"
};

let memoryDoc = blankDoc();
let persistMode = "memory";
let hydrated = false;
let hydratePromise = null;

function runningUnderNodeTest() {
  return Boolean(process.env.NODE_TEST_CONTEXT);
}

function nowIso() {
  return new Date().toISOString();
}

function blankDoc() {
  return { items: [] };
}

export function todayStamp(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
}

export function inDisplayWindow(item, today = todayStamp()) {
  if (!item || item.alwaysShow !== false) {
    return true;
  }
  const start = String(item.startOn || "").trim();
  const end = String(item.endOn || "").trim();
  if (!start && !end) {
    return true;
  }
  if (start && today < start) {
    return false;
  }
  if (end && today > end) {
    return false;
  }
  return true;
}

function displayLabel(item) {
  if (!item || item.alwaysShow !== false) {
    return "一直展示";
  }
  const start = String(item.startOn || "").trim();
  const end = String(item.endOn || "").trim();
  if (!start && !end) {
    return "一直展示";
  }
  return `${start || "…"} 至 ${end || "…"}`;
}

function readFileDoc() {
  try {
    const raw = fs.readFileSync(dataFile, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.items)) {
      return parsed;
    }
  } catch {
    /* seed below */
  }
  return blankDoc();
}

function writeFileDoc(doc) {
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  fs.writeFileSync(dataFile, JSON.stringify(doc, null, 2) + "\n", "utf8");
}

async function mysqlAuth() {
  try {
    const auth = await import("../profile/auth.js");
    if (typeof auth.dbMode === "function" && auth.dbMode() === "mysql" && typeof auth.query === "function") {
      return auth;
    }
  } catch {
    /* local / test has no profile auth */
  }
  return null;
}

async function readMysqlNotices() {
  const auth = await mysqlAuth();
  if (!auth) {
    return null;
  }
  const { query } = auth;
  await query(
    "CREATE TABLE IF NOT EXISTS notices_board (id TINYINT NOT NULL PRIMARY KEY, payload LONGTEXT NOT NULL, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)"
  );
  const [rows] = await query("SELECT payload FROM notices_board WHERE id = 1");
  const raw = rows && rows[0] ? rows[0].payload : "";
  if (!raw) {
    return null;
  }
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  return parsed && Array.isArray(parsed.items) ? parsed : null;
}

async function writeMysqlNotices(doc) {
  const auth = await mysqlAuth();
  if (!auth) {
    return false;
  }
  const { query } = auth;
  const payload = JSON.stringify(doc);
  await query(
    "CREATE TABLE IF NOT EXISTS notices_board (id TINYINT NOT NULL PRIMARY KEY, payload LONGTEXT NOT NULL, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)"
  );
  await query("INSERT INTO notices_board (id, payload) VALUES (1, ?) ON DUPLICATE KEY UPDATE payload = VALUES(payload)", [
    payload
  ]);
  return true;
}

function getDoc() {
  if (!memoryDoc || !Array.isArray(memoryDoc.items)) {
    memoryDoc = blankDoc();
  }
  return memoryDoc;
}

export function noticesPersistMode() {
  return persistMode;
}

export function resetNotices() {
  memoryDoc = blankDoc();
  persistMode = "memory";
  hydrated = true;
  hydratePromise = Promise.resolve({ ok: true, mode: persistMode });
}

export async function hydrateNotices() {
  if (hydrated) {
    return { ok: true, mode: persistMode };
  }
  if (hydratePromise) {
    return hydratePromise;
  }
  hydratePromise = (async () => {
    if (runningUnderNodeTest()) {
      memoryDoc = blankDoc();
      persistMode = "memory";
      hydrated = true;
      return { ok: true, mode: persistMode };
    }
    try {
      const fromMysql = await readMysqlNotices();
      if (fromMysql) {
        memoryDoc = fromMysql;
        persistMode = "mysql";
        hydrated = true;
        return { ok: true, mode: persistMode, items: memoryDoc.items.length };
      }
    } catch (err) {
      console.error("[notices] mysql hydrate failed", err);
    }
    memoryDoc = readFileDoc();
    persistMode = "file";
    hydrated = true;
    return { ok: true, mode: persistMode, items: memoryDoc.items.length };
  })();
  try {
    return await hydratePromise;
  } catch (err) {
    hydratePromise = null;
    throw err;
  }
}

async function persistDoc(doc) {
  memoryDoc = doc;
  if (runningUnderNodeTest()) {
    persistMode = "memory";
    return true;
  }
  try {
    if (await writeMysqlNotices(doc)) {
      persistMode = "mysql";
      return true;
    }
  } catch (err) {
    console.error("[notices] mysql persist failed", err);
  }
  try {
    writeFileDoc(doc);
    persistMode = "file";
    return true;
  } catch (err) {
    console.error("[notices] file persist failed", err);
    persistMode = "memory";
    return false;
  }
}

function publicItem(item) {
  const alwaysShow = item.alwaysShow !== false;
  return {
    id: item.id,
    title: item.title,
    summary: item.summary,
    body: item.body,
    status: item.status,
    level: item.level,
    category: item.category,
    categoryLabel: item.categoryLabel || CATEGORIES[item.category] || "公告",
    author: item.author || "",
    images: Number(item.images) || 0,
    popup: Boolean(item.popup),
    banner: Boolean(item.banner),
    alwaysShow,
    startOn: alwaysShow ? "" : String(item.startOn || ""),
    endOn: alwaysShow ? "" : String(item.endOn || ""),
    displayLabel: displayLabel({ ...item, alwaysShow }),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

function nextId() {
  return `n-${Date.now().toString(36)}`;
}

export function listNotices(query = {}) {
  const doc = getDoc();
  let items = doc.items.map(publicItem);
  const status = String(query.status || "").trim();
  const category = String(query.category || "").trim();
  if (status && status !== "all") {
    items = items.filter((item) => item.status === status);
  }
  if (category && category !== "all") {
    items = items.filter((item) => item.category === category);
  }
  items.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  const active = doc.items.filter((item) => item.status === "active");
  return {
    ok: true,
    items,
    stats: {
      active: active.length,
      unreadWeek: 0,
      receipt: 0
    },
    categories: Object.entries(CATEGORIES).map(([id, label]) => ({ id, label })),
    persist: persistMode
  };
}

export function bannerNotices(today = todayStamp()) {
  return getDoc()
    .items.filter((item) => item.status === "active" && item.banner && inDisplayWindow(item, today))
    .map(publicItem)
    .slice(0, 5);
}

export function selectPopupNotice(items = [], today = todayStamp()) {
  return items.find((item) => item.status === "active" && item.popup === true && inDisplayWindow(item, today)) || null;
}

export function popupNotice(today = todayStamp()) {
  return selectPopupNotice(getDoc().items.map(publicItem), today);
}

export function getNotice(id) {
  const key = String(id || "").trim();
  const hit = getDoc().items.find((item) => item.id === key);
  return hit ? publicItem(hit) : null;
}

export async function upsertNotice(input = {}, existingId) {
  const title = String(input.title || "").trim();
  if (!title) {
    return { ok: false, statusCode: 400, error: "请填写标题" };
  }
  const alwaysShow = input.alwaysShow == null ? (input.displayMode === "range" ? false : true) : Boolean(input.alwaysShow);
  const startOn = alwaysShow ? "" : String(input.startOn || "").trim();
  const endOn = alwaysShow ? "" : String(input.endOn || "").trim();
  if (!alwaysShow && (!startOn || !endOn)) {
    return { ok: false, statusCode: 400, error: "请填写展示起止日期" };
  }
  if (!alwaysShow && startOn > endOn) {
    return { ok: false, statusCode: 400, error: "结束日期不能早于开始日期" };
  }
  await hydrateNotices();
  const doc = getDoc();
  const id = String(existingId || input.id || "").trim() || nextId();
  const prev = doc.items.find((item) => item.id === id);
  const category = CATEGORIES[input.category] ? input.category : prev?.category || "general";
  const item = {
    id,
    title,
    summary: String(input.summary || "").trim(),
    body: String(input.body || "").trim(),
    status: STATUSES.has(input.status) ? input.status : prev?.status || "active",
    level: LEVELS.has(input.level) ? input.level : prev?.level || "normal",
    category,
    categoryLabel: CATEGORIES[category],
    author: String(input.author || prev?.author || "").trim(),
    images: Math.max(0, Number(input.images) || prev?.images || 0),
    popup: input.popup == null ? Boolean(prev?.popup) : Boolean(input.popup),
    banner: input.banner == null ? (prev ? Boolean(prev.banner) : true) : Boolean(input.banner),
    alwaysShow,
    startOn,
    endOn,
    createdAt: prev?.createdAt || nowIso(),
    updatedAt: nowIso()
  };
  if (prev) {
    doc.items = doc.items.map((row) => (row.id === id ? item : row));
  } else {
    doc.items.unshift(item);
  }
  const saved = await persistDoc(doc);
  if (!saved && persistMode === "memory" && !runningUnderNodeTest()) {
    return { ok: false, statusCode: 500, error: "公告写入失败" };
  }
  return { ok: true, item: publicItem(item), persist: persistMode };
}

export async function removeNotice(id) {
  const key = String(id || "").trim();
  await hydrateNotices();
  const doc = getDoc();
  const next = doc.items.filter((item) => item.id !== key);
  if (next.length === doc.items.length) {
    return { ok: false, statusCode: 404, error: "公告不存在" };
  }
  doc.items = next;
  await persistDoc(doc);
  return { ok: true };
}
