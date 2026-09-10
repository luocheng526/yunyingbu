import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const defaultDataFile = path.join(root, "data", "notices.json");

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

function dataFilePath() {
  return process.env.NOTICES_DATA_FILE || defaultDataFile;
}

function nowIso() {
  return new Date().toISOString();
}

export function todayYmd(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseYmd(value) {
  const text = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

export function resolveAlwaysShow(item = {}) {
  if (item.alwaysShow === false || item.alwaysShow === "false") {
    return false;
  }
  if (item.alwaysShow === true || item.alwaysShow === "true") {
    return true;
  }
  const mode = String(item.displayMode || "").trim();
  if (mode === "range") {
    return false;
  }
  if (mode === "always") {
    return true;
  }
  return !parseYmd(item.startOn) && !parseYmd(item.endOn);
}

export function isNoticeShowing(item, today = todayYmd()) {
  if (!item || String(item.status || "active") !== "active") {
    return false;
  }
  if (resolveAlwaysShow(item)) {
    return true;
  }
  const day = parseYmd(today) || todayYmd();
  const start = parseYmd(item.startOn);
  const end = parseYmd(item.endOn);
  if (start && day < start) {
    return false;
  }
  if (end && day > end) {
    return false;
  }
  return true;
}

function displayLabel(item) {
  if (resolveAlwaysShow(item)) {
    return "一直展示";
  }
  const start = parseYmd(item.startOn) || "…";
  const end = parseYmd(item.endOn) || "…";
  return `${start} 至 ${end}`;
}

function blankDoc() {
  return { items: [] };
}

function readDoc() {
  try {
    const raw = fs.readFileSync(dataFilePath(), "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.items)) {
      return parsed;
    }
  } catch (_err) {
    /* seed below */
  }
  const seeded = blankDoc();
  writeDoc(seeded);
  return seeded;
}

function writeDoc(doc) {
  const file = dataFilePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(doc, null, 2) + "\n");
}

export function publicItem(item) {
  const alwaysShow = resolveAlwaysShow(item);
  const startOn = alwaysShow ? "" : parseYmd(item.startOn);
  const endOn = alwaysShow ? "" : parseYmd(item.endOn);
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
    startOn,
    endOn,
    showing: isNoticeShowing(item),
    displayLabel: displayLabel({ ...item, alwaysShow, startOn, endOn }),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

function nextId(_items) {
  return `n-${Date.now().toString(36)}`;
}

function resolveWindow(input = {}, prev) {
  const hasWindow =
    input.alwaysShow != null ||
    input.displayMode != null ||
    input.startOn != null ||
    input.endOn != null;
  const source = hasWindow ? input : prev || input;
  const alwaysShow = resolveAlwaysShow(source);
  if (alwaysShow) {
    return { ok: true, alwaysShow: true, startOn: "", endOn: "" };
  }
  const startOn = parseYmd(source.startOn);
  const endOn = parseYmd(source.endOn);
  if (!startOn || !endOn) {
    return { ok: false, statusCode: 400, error: "请选择展示起止日期" };
  }
  if (startOn > endOn) {
    return { ok: false, statusCode: 400, error: "开始日期不能晚于结束日期" };
  }
  return { ok: true, alwaysShow: false, startOn, endOn };
}

export function listNotices(query = {}) {
  const doc = readDoc();
  let items = doc.items.map(publicItem);
  const status = String(query.status || "").trim();
  const category = String(query.category || "").trim();
  if (status && status !== "all") {
    items = items.filter((item) => item.status === status);
    if (status === "active") {
      items = items.filter((item) => item.showing);
    }
  }
  if (category && category !== "all") {
    items = items.filter((item) => item.category === category);
  }
  items.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  const active = doc.items.filter((item) => isNoticeShowing(item));
  return {
    ok: true,
    items,
    stats: {
      active: active.length,
      unreadWeek: 0,
      receipt: 0
    },
    categories: Object.entries(CATEGORIES).map(([id, label]) => ({ id, label }))
  };
}

export function bannerNotices() {
  const { items } = listNotices({ status: "active" });
  return items.filter((item) => item.banner).slice(0, 5);
}

export function popupNotice() {
  const { items } = listNotices({ status: "active" });
  return items.find((item) => item.popup) || items[0] || null;
}

export function getNotice(id) {
  const key = String(id || "").trim();
  const doc = readDoc();
  const hit = doc.items.find((item) => item.id === key);
  return hit ? publicItem(hit) : null;
}

export function upsertNotice(input = {}, existingId) {
  const title = String(input.title || "").trim();
  if (!title) {
    return { ok: false, statusCode: 400, error: "请填写标题" };
  }
  const doc = readDoc();
  const id = String(existingId || input.id || "").trim() || nextId(doc.items);
  const prev = doc.items.find((item) => item.id === id);
  const window = resolveWindow(input, prev);
  if (!window.ok) {
    return window;
  }
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
    alwaysShow: window.alwaysShow,
    startOn: window.startOn,
    endOn: window.endOn,
    createdAt: prev?.createdAt || nowIso(),
    updatedAt: nowIso()
  };
  if (prev) {
    doc.items = doc.items.map((row) => (row.id === id ? item : row));
  } else {
    doc.items.unshift(item);
  }
  writeDoc(doc);
  return { ok: true, item: publicItem(item) };
}

export function removeNotice(id) {
  const key = String(id || "").trim();
  const doc = readDoc();
  const next = doc.items.filter((item) => item.id !== key);
  if (next.length === doc.items.length) {
    return { ok: false, statusCode: 404, error: "公告不存在" };
  }
  doc.items = next;
  writeDoc(doc);
  return { ok: true };
}
