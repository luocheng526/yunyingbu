/**
 * 首页实时表头宽度 / 拖拽顺序 / 显隐 / 行高按登录账号落盘。
 * 同一账号换电脑读同一套，不再跟浏览器 localStorage 走。
 * 优先 MySQL home_live_prefs；没有库时写 /var/lib/mengkai/home-live-prefs.json。
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const CREATE_SQL =
  "CREATE TABLE IF NOT EXISTS home_live_prefs (username VARCHAR(64) NOT NULL, prefs_json MEDIUMTEXT NOT NULL, updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), PRIMARY KEY (username)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

const COL_KEY_RE = /^[A-Za-z0-9_-]{1,40}$/;

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

export function accountName(user) {
  return String((user && (user.username || user.displayName)) || "").trim();
}

export function normalizeKeys(raw, { allowEmpty = false } = {}) {
  if (!Array.isArray(raw)) {
    return allowEmpty ? [] : null;
  }
  const out = [];
  for (const item of raw) {
    const key = String(item || "").trim();
    if (!COL_KEY_RE.test(key) || out.includes(key)) {
      continue;
    }
    out.push(key);
    if (out.length >= 40) {
      break;
    }
  }
  if (allowEmpty) {
    return out;
  }
  return out.length ? out : null;
}

export function normalizeCols(raw) {
  if (!Array.isArray(raw) || !raw.length) {
    return null;
  }
  return raw.slice(0, 40).map((value) => {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n)) {
      return 48;
    }
    return Math.max(48, Math.min(800, n));
  });
}

export function normalizeRow(raw) {
  if (raw == null || raw === "") {
    return null;
  }
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) {
    return null;
  }
  return Math.max(4, Math.min(20, n));
}

export function normalizePrefs(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const hideRaw = src.headHide;
  return {
    cols: normalizeCols(src.cols),
    headOrder: normalizeKeys(src.headOrder),
    headHide: hideRaw == null ? null : normalizeKeys(hideRaw, { allowEmpty: true }),
    row: normalizeRow(src.row),
  };
}

export function isEmptyPrefs(prefs) {
  if (!prefs || typeof prefs !== "object") {
    return true;
  }
  return (
    !prefs.cols &&
    !prefs.headOrder &&
    prefs.headHide == null &&
    prefs.row == null
  );
}

function defaultFilePath() {
  return process.env.HOME_LIVE_PREFS_FILE || "/var/lib/mengkai/home-live-prefs.json";
}

async function readJsonFile(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    const data = JSON.parse(raw);
    return data && typeof data === "object" ? data : { users: {} };
  } catch (err) {
    if (err && err.code === "ENOENT") {
      return { users: {} };
    }
    return { users: {} };
  }
}

async function writeJsonFile(filePath, data) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(data), "utf8");
}

async function mysqlPool() {
  try {
    const mod = await import("../../db/pool.js");
    return typeof mod.getPool === "function" ? mod.getPool() : null;
  } catch {
    return null;
  }
}

async function ensureTable(pool) {
  await pool.query(CREATE_SQL);
}

export function createLivePrefStore(options = {}) {
  const memory = options.memory || null;
  const filePath = options.filePath || defaultFilePath();
  const poolFactory = options.poolFactory || mysqlPool;
  let fileChain = Promise.resolve();

  async function withFile(fn) {
    const run = fileChain.then(() => fn());
    fileChain = run.catch(() => {});
    return run;
  }

  async function loadUser(username) {
    if (memory) {
      return normalizePrefs(memory[username] || {});
    }
    const pool = await poolFactory();
    if (pool) {
      try {
        await ensureTable(pool);
        const [rows] = await pool.query(
          "SELECT prefs_json FROM home_live_prefs WHERE username = ?",
          [username],
        );
        const raw = rows && rows[0] && rows[0].prefs_json;
        if (raw == null || raw === "") {
          return normalizePrefs({});
        }
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        return normalizePrefs(parsed);
      } catch (err) {
        if (options.fileOnly) {
          throw err;
        }
      }
    }
    return withFile(async () => {
      const data = await readJsonFile(filePath);
      const users = data.users && typeof data.users === "object" ? data.users : {};
      return normalizePrefs(users[username] || {});
    });
  }

  async function saveUser(username, prefs) {
    const clean = normalizePrefs(prefs);
    if (memory) {
      memory[username] = clean;
      return clean;
    }
    const pool = await poolFactory();
    if (pool) {
      try {
        await ensureTable(pool);
        await pool.query(
          "INSERT INTO home_live_prefs (username, prefs_json) VALUES (?, ?) ON DUPLICATE KEY UPDATE prefs_json = VALUES(prefs_json)",
          [username, JSON.stringify(clean)],
        );
        return clean;
      } catch (err) {
        if (options.fileOnly) {
          throw err;
        }
      }
    }
    return withFile(async () => {
      const data = await readJsonFile(filePath);
      if (!data.users || typeof data.users !== "object") {
        data.users = {};
      }
      data.users[username] = clean;
      await writeJsonFile(filePath, data);
      return clean;
    });
  }

  return {
    async get(username) {
      const name = String(username || "").trim();
      if (!name) {
        throw httpError(401, "未登录");
      }
      return loadUser(name);
    },
    async put(username, body) {
      const name = String(username || "").trim();
      if (!name) {
        throw httpError(401, "未登录");
      }
      return saveUser(name, body);
    },
  };
}

export function attachHomeLivePrefs(router, options = {}) {
  const store = options.store || createLivePrefStore(options);
  const readUser = options.readUser || ((req) => req.user || null);

  router.get("/live-prefs", async (req, res) => {
    try {
      const username = accountName(readUser(req));
      if (!username) {
        res.status(401).json({ ok: false, error: "未登录" });
        return;
      }
      const prefs = await store.get(username);
      res.json({ ok: true, username, prefs, empty: isEmptyPrefs(prefs) });
    } catch (err) {
      res.status(err.statusCode || 500).json({ ok: false, error: err.message });
    }
  });

  router.put("/live-prefs", async (req, res) => {
    try {
      const username = accountName(readUser(req));
      if (!username) {
        res.status(401).json({ ok: false, error: "未登录" });
        return;
      }
      const prefs = await store.put(username, req.body || {});
      res.json({ ok: true, username, prefs, empty: isEmptyPrefs(prefs) });
    } catch (err) {
      res.status(err.statusCode || 500).json({ ok: false, error: err.message });
    }
  });

  return router;
}
