import { Router } from "express";
import { dbMode, query, requireAuth } from "./auth.js";

const PREFS_SQL = `CREATE TABLE IF NOT EXISTS xm_shell_prefs (
  username VARCHAR(64) NOT NULL PRIMARY KEY,
  theme VARCHAR(16) NOT NULL DEFAULT 'light',
  sider_collapsed TINYINT(1) NOT NULL DEFAULT 0,
  tabs_json TEXT,
  updated_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

const memory = new Map();
let tableReady = false;

export function defaultPrefs() {
  return { theme: "light", siderCollapsed: false, tabs: { hrefs: [], active: "" } };
}

export function resetPrefsForTests() {
  memory.clear();
  tableReady = false;
}

export function normalizePrefs(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const theme = src.theme === "dark" || src.theme === "pink" ? src.theme : "light";
  const siderCollapsed = src.siderCollapsed === true || src.siderCollapsed === 1 || src.siderCollapsed === "1";
  const tabsRaw = src.tabs && typeof src.tabs === "object" ? src.tabs : {};
  const hrefs = Array.isArray(tabsRaw.hrefs)
    ? tabsRaw.hrefs
        .map((item) => String(item || "").trim())
        .filter(Boolean)
        .slice(0, 24)
    : [];
  const active = String(tabsRaw.active || "").trim();
  return { theme, siderCollapsed, tabs: { hrefs, active } };
}

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

async function ensureTable() {
  if (dbMode() !== "mysql" || tableReady) {
    return;
  }
  await query(PREFS_SQL);
  tableReady = true;
}

export async function loadPrefs(username) {
  const name = String(username || "").trim();
  if (!name) {
    return defaultPrefs();
  }
  if (dbMode() !== "mysql") {
    return normalizePrefs(memory.get(name) || defaultPrefs());
  }
  try {
    await ensureTable();
    const [rows] = await query(
      "SELECT theme, sider_collapsed, tabs_json FROM xm_shell_prefs WHERE username = ?",
      [name]
    );
    const row = rows && rows[0];
    if (!row) {
      return defaultPrefs();
    }
    let tabs = { hrefs: [], active: "" };
    try {
      tabs = JSON.parse(row.tabs_json || "{}");
    } catch {
      tabs = { hrefs: [], active: "" };
    }
    return normalizePrefs({
      theme: row.theme,
      siderCollapsed: Number(row.sider_collapsed) === 1,
      tabs
    });
  } catch {
    return normalizePrefs(memory.get(name) || defaultPrefs());
  }
}

export async function savePrefs(username, patch) {
  const name = String(username || "").trim();
  if (!name) {
    return defaultPrefs();
  }
  const current = await loadPrefs(name);
  const incoming = patch && typeof patch === "object" ? patch : {};
  const next = normalizePrefs({
    theme: incoming.theme != null ? incoming.theme : current.theme,
    siderCollapsed: incoming.siderCollapsed != null ? incoming.siderCollapsed : current.siderCollapsed,
    tabs: incoming.tabs != null ? incoming.tabs : current.tabs
  });
  if (dbMode() !== "mysql") {
    memory.set(name, next);
    return next;
  }
  try {
    await ensureTable();
    await query(
      `INSERT INTO xm_shell_prefs (username, theme, sider_collapsed, tabs_json, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         theme = VALUES(theme),
         sider_collapsed = VALUES(sider_collapsed),
         tabs_json = VALUES(tabs_json),
         updated_at = VALUES(updated_at)`,
      [name, next.theme, next.siderCollapsed ? 1 : 0, JSON.stringify(next.tabs), nowSql()]
    );
  } catch {
    memory.set(name, next);
  }
  return next;
}

export const prefsRouter = Router();
prefsRouter.use(requireAuth);

prefsRouter.get("/", async (req, res) => {
  const prefs = await loadPrefs(req.user.username);
  req.user.prefs = prefs;
  res.json({ ok: true, prefs });
});

prefsRouter.put("/", async (req, res) => {
  const prefs = await savePrefs(req.user.username, req.body || {});
  req.user.prefs = prefs;
  res.json({ ok: true, prefs });
});
