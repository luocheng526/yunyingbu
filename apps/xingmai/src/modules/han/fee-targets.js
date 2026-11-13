/**
 * 韩梦凯实时付费「费比设置」按登录账号落盘，两台电脑同一账号读同一套区间。
 * 优先 MySQL han_fee_targets；没有库时写 /var/lib/mengkai/han-fee-targets.json。
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const CREATE_SQL =
  "CREATE TABLE IF NOT EXISTS han_fee_targets (username VARCHAR(64) NOT NULL, store_name VARCHAR(128) NOT NULL, lo DECIMAL(8,2) NULL, hi DECIMAL(8,2) NULL, updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), PRIMARY KEY (username, store_name)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

export function feeBound(value) {
  if (value == null || value === "") {
    return null;
  }
  const n = Number(String(value).replace(/[%％]/g, ""));
  if (!Number.isFinite(n)) {
    return null;
  }
  return Math.max(0, Math.min(100, n));
}

export function normalizeBounds(raw) {
  if (raw == null || raw === "") {
    return { lo: null, hi: null };
  }
  let lo;
  let hi;
  if (typeof raw === "object") {
    lo = feeBound(raw.lo != null ? raw.lo : raw.min);
    hi = feeBound(raw.hi != null ? raw.hi : raw.max);
  } else {
    lo = feeBound(raw);
    hi = lo;
  }
  if (lo != null && hi != null && lo > hi) {
    return { lo: hi, hi: lo };
  }
  return { lo, hi };
}

export function accountName(user) {
  return String((user && (user.username || user.displayName)) || "").trim();
}

function defaultFilePath() {
  return process.env.HAN_FEE_TARGETS_FILE || "/var/lib/mengkai/han-fee-targets.json";
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

function rowBounds(row) {
  return normalizeBounds({
    lo: row && row.lo != null ? row.lo : row && row.min,
    hi: row && row.hi != null ? row.hi : row && row.max,
  });
}

export function createFeeTargetStore(options = {}) {
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
      return { ...(memory[username] || {}) };
    }
    const pool = await poolFactory();
    if (pool) {
      try {
        await ensureTable(pool);
        const [rows] = await pool.query(
          "SELECT store_name, lo, hi FROM han_fee_targets WHERE username = ?",
          [username],
        );
        const targets = {};
        for (const row of rows || []) {
          const store = String(row.store_name || "").trim();
          if (!store) {
            continue;
          }
          targets[store] = rowBounds(row);
        }
        return targets;
      } catch (err) {
        if (options.fileOnly) {
          throw err;
        }
      }
    }
    return withFile(async () => {
      const data = await readJsonFile(filePath);
      const users = data.users && typeof data.users === "object" ? data.users : {};
      const raw = users[username] && typeof users[username] === "object" ? users[username] : {};
      const targets = {};
      for (const [store, bounds] of Object.entries(raw)) {
        targets[store] = normalizeBounds(bounds);
      }
      return targets;
    });
  }

  async function saveUser(username, targets) {
    const clean = {};
    for (const [store, bounds] of Object.entries(targets || {})) {
      const name = String(store || "").trim();
      if (!name) {
        continue;
      }
      const next = normalizeBounds(bounds);
      if (next.lo == null && next.hi == null) {
        continue;
      }
      clean[name] = next;
    }
    if (memory) {
      memory[username] = clean;
      return clean;
    }
    const pool = await poolFactory();
    if (pool) {
      try {
        await ensureTable(pool);
        await pool.query("DELETE FROM han_fee_targets WHERE username = ?", [username]);
        for (const [store, bounds] of Object.entries(clean)) {
          await pool.query(
            "INSERT INTO han_fee_targets (username, store_name, lo, hi) VALUES (?, ?, ?, ?)",
            [username, store, bounds.lo, bounds.hi],
          );
        }
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
      const current = await loadUser(name);
      const payload = body && typeof body === "object" ? body : {};
      if (payload.targets && typeof payload.targets === "object") {
        if (payload.replace) {
          return saveUser(name, payload.targets);
        }
        const merged = { ...current };
        for (const [store, bounds] of Object.entries(payload.targets)) {
          const next = normalizeBounds(bounds);
          if (next.lo == null && next.hi == null) {
            delete merged[store];
          } else {
            merged[store] = next;
          }
        }
        return saveUser(name, merged);
      }
      const store = String(payload.store || "").trim();
      if (!store) {
        throw httpError(400, "store required");
      }
      const next = normalizeBounds(payload);
      if (next.lo == null && next.hi == null) {
        delete current[store];
      } else {
        current[store] = next;
      }
      return saveUser(name, current);
    },
  };
}

export function attachHanFeeTargets(router, options = {}) {
  const store = options.store || createFeeTargetStore(options);
  const readUser = options.readUser || ((req) => req.user || null);

  router.get("/fee-targets", async (req, res) => {
    try {
      const username = accountName(readUser(req));
      if (!username) {
        res.status(401).json({ ok: false, error: "未登录" });
        return;
      }
      const targets = await store.get(username);
      res.json({ ok: true, username, targets });
    } catch (err) {
      res.status(err.statusCode || 500).json({ ok: false, error: err.message });
    }
  });

  router.put("/fee-targets", async (req, res) => {
    try {
      const username = accountName(readUser(req));
      if (!username) {
        res.status(401).json({ ok: false, error: "未登录" });
        return;
      }
      const targets = await store.put(username, req.body || {});
      res.json({ ok: true, username, targets });
    } catch (err) {
      res.status(err.statusCode || 500).json({ ok: false, error: err.message });
    }
  });

  return router;
}
