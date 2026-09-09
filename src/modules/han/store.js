import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { getPool } from "../../db/pool.js";

const DEFAULT_OWNER = "韩梦凯";
const DEFAULT_STORE = "韩梦凯店";
const STATUSES = ["待办", "进行中", "已完成"];
const SELECTION_STATUSES = ["观察", "入选", "淘汰"];
const TRAINING_STATUSES = ["待开始", "进行中", "已完成"];
const SCHEMA_PATH = fileURLToPath(new URL("./schema.sql", import.meta.url));

function toIso(value) {
  if (!value) {
    return "";
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return new Date(value).toISOString();
}

function toDateOnly(value) {
  if (!value) {
    return "";
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  const text = String(value);
  return text.slice(0, 10);
}

function ownerOrDefault(owner) {
  return owner && String(owner).trim() ? String(owner).trim() : DEFAULT_OWNER;
}

function storeOrDefault(store) {
  return store && String(store).trim() ? String(store).trim() : DEFAULT_STORE;
}

function nextDay(yyyyMmDd) {
  const d = new Date(`${yyyyMmDd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function mapTask(row) {
  return {
    id: String(row.id),
    title: row.title,
    status: row.status,
    owner: row.owner,
    store: row.store_name || DEFAULT_STORE,
    createdAt: toIso(row.created_at),
  };
}

function mapSelection(row) {
  return {
    id: String(row.id),
    name: row.name,
    category: row.category || "",
    note: row.note || "",
    status: row.status,
    owner: row.owner,
    store: row.store_name || DEFAULT_STORE,
    createdAt: toIso(row.created_at),
  };
}

function mapProduct(row) {
  return {
    id: String(row.id),
    name: row.name,
    sku: row.sku || "",
    price: row.price == null ? "" : String(row.price),
    stock: row.stock == null ? "" : String(row.stock),
    owner: row.owner,
    store: row.store_name || DEFAULT_STORE,
    createdAt: toIso(row.created_at),
  };
}

function mapPaid(row) {
  return {
    id: String(row.id),
    channel: row.channel,
    amount: row.amount == null ? "" : String(row.amount),
    spentOn: toDateOnly(row.spent_on),
    note: row.note || "",
    owner: row.owner,
    store: row.store_name || DEFAULT_STORE,
    createdAt: toIso(row.created_at),
  };
}

function mapTraining(row) {
  return {
    id: String(row.id),
    title: row.title,
    trainee: row.trainee || "",
    scheduledOn: toDateOnly(row.scheduled_on),
    status: row.status,
    note: row.note || "",
    owner: row.owner,
    store: row.store_name || DEFAULT_STORE,
    createdAt: toIso(row.created_at),
  };
}

function optionalNumber(value) {
  if (value == null || value === "") {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function optionalDate(value) {
  if (!value) {
    return null;
  }
  const text = String(value).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function requireStoreRange({ store, from, to }) {
  const shop = String(store || "").trim();
  const start = optionalDate(from);
  const end = optionalDate(to);
  if (!shop) {
    const err = new Error("store required");
    err.statusCode = 400;
    throw err;
  }
  if (!start || !end) {
    const err = new Error("from and to required (YYYY-MM-DD)");
    err.statusCode = 400;
    throw err;
  }
  if (start > end) {
    const err = new Error("from must be on or before to");
    err.statusCode = 400;
    throw err;
  }
  return { shop, start, end, until: nextDay(end) };
}

function splitSql(sql) {
  return sql
    .split(/;\s*(?:\n|$)/)
    .map((chunk) =>
      chunk
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter(Boolean);
}

export function createHanStore(poolOrFactory = getPool) {
  const db = () => (typeof poolOrFactory === "function" ? poolOrFactory() : poolOrFactory);
  let ready = null;

  async function ensure() {
    if (!ready) {
      ready = (async () => {
        const sql = await readFile(SCHEMA_PATH, "utf8");
        const pool = db();
        for (const stmt of splitSql(sql)) {
          await pool.query(stmt);
        }
        for (const table of ["han_tasks", "han_selection", "han_products", "han_paid", "han_training"]) {
          try {
            await pool.query(
              `ALTER TABLE ${table} ADD COLUMN store_name VARCHAR(128) NOT NULL DEFAULT '韩梦凯店'`,
            );
          } catch (err) {
            if (!err || (err.code !== "ER_DUP_FIELDNAME" && err.errno !== 1060)) {
              throw err;
            }
          }
        }
      })();
    }
    try {
      await ready;
    } catch (err) {
      ready = null;
      throw err;
    }
  }

  return {
    async listTasks() {
      await ensure();
      const [rows] = await db().query(
        "SELECT id, title, status, owner, store_name, created_at FROM han_tasks ORDER BY id ASC",
      );
      return rows.map(mapTask);
    },

    async createTask({ title, status, owner, store } = {}) {
      await ensure();
      const trimmed = String(title || "").trim();
      if (!trimmed) {
        const err = new Error("title required");
        err.statusCode = 400;
        throw err;
      }
      const st = STATUSES.includes(status) ? status : "待办";
      const ow = owner && String(owner).trim() ? String(owner).trim() : DEFAULT_OWNER;
      const [result] = await db().query(
        "INSERT INTO han_tasks (title, status, owner, store_name) VALUES (?, ?, ?, ?)",
        [trimmed, st, ow, storeOrDefault(store)],
      );
      const [rows] = await db().query(
        "SELECT id, title, status, owner, store_name, created_at FROM han_tasks WHERE id = ?",
        [result.insertId],
      );
      return mapTask(rows[0]);
    },

    async getBrief() {
      await ensure();
      const [rows] = await db().query("SELECT text FROM han_brief WHERE id = 1");
      return { text: rows[0] ? String(rows[0].text ?? "") : "" };
    },

    async setBrief({ text } = {}) {
      await ensure();
      const value = text == null ? "" : String(text);
      await db().query(
        "INSERT INTO han_brief (id, text) VALUES (1, ?) ON DUPLICATE KEY UPDATE text = VALUES(text)",
        [value],
      );
      return { text: value };
    },

    async listSelection() {
      await ensure();
      const [rows] = await db().query(
        "SELECT id, name, category, note, status, owner, store_name, created_at FROM han_selection ORDER BY id ASC",
      );
      return rows.map(mapSelection);
    },

    async createSelection({ name, category, note, status, owner, store } = {}) {
      await ensure();
      const trimmed = String(name || "").trim();
      if (!trimmed) {
        const err = new Error("name required");
        err.statusCode = 400;
        throw err;
      }
      const st = SELECTION_STATUSES.includes(status) ? status : "观察";
      const [result] = await db().query(
        "INSERT INTO han_selection (name, category, note, status, owner, store_name) VALUES (?, ?, ?, ?, ?, ?)",
        [trimmed, String(category || "").trim(), String(note || "").trim(), st, ownerOrDefault(owner), storeOrDefault(store)],
      );
      const [rows] = await db().query(
        "SELECT id, name, category, note, status, owner, store_name, created_at FROM han_selection WHERE id = ?",
        [result.insertId],
      );
      return mapSelection(rows[0]);
    },

    async listProducts() {
      await ensure();
      const [rows] = await db().query(
        "SELECT id, name, sku, price, stock, owner, store_name, created_at FROM han_products ORDER BY id ASC",
      );
      return rows.map(mapProduct);
    },

    async createProduct({ name, sku, price, stock, owner, store } = {}) {
      await ensure();
      const trimmed = String(name || "").trim();
      if (!trimmed) {
        const err = new Error("name required");
        err.statusCode = 400;
        throw err;
      }
      const [result] = await db().query(
        "INSERT INTO han_products (name, sku, price, stock, owner, store_name) VALUES (?, ?, ?, ?, ?, ?)",
        [trimmed, String(sku || "").trim(), optionalNumber(price), optionalNumber(stock), ownerOrDefault(owner), storeOrDefault(store)],
      );
      const [rows] = await db().query(
        "SELECT id, name, sku, price, stock, owner, store_name, created_at FROM han_products WHERE id = ?",
        [result.insertId],
      );
      return mapProduct(rows[0]);
    },

    async listPaid() {
      await ensure();
      const [rows] = await db().query(
        "SELECT id, channel, amount, spent_on, note, owner, store_name, created_at FROM han_paid ORDER BY id ASC",
      );
      return rows.map(mapPaid);
    },

    async createPaid({ channel, amount, spentOn, note, owner, store } = {}) {
      await ensure();
      const trimmed = String(channel || "").trim();
      if (!trimmed) {
        const err = new Error("channel required");
        err.statusCode = 400;
        throw err;
      }
      const [result] = await db().query(
        "INSERT INTO han_paid (channel, amount, spent_on, note, owner, store_name) VALUES (?, ?, ?, ?, ?, ?)",
        [trimmed, optionalNumber(amount), optionalDate(spentOn), String(note || "").trim(), ownerOrDefault(owner), storeOrDefault(store)],
      );
      const [rows] = await db().query(
        "SELECT id, channel, amount, spent_on, note, owner, store_name, created_at FROM han_paid WHERE id = ?",
        [result.insertId],
      );
      return mapPaid(rows[0]);
    },

    async listTraining() {
      await ensure();
      const [rows] = await db().query(
        "SELECT id, title, trainee, scheduled_on, status, note, owner, store_name, created_at FROM han_training ORDER BY id ASC",
      );
      return rows.map(mapTraining);
    },

    async createTraining({ title, trainee, scheduledOn, status, note, owner, store } = {}) {
      await ensure();
      const trimmed = String(title || "").trim();
      if (!trimmed) {
        const err = new Error("title required");
        err.statusCode = 400;
        throw err;
      }
      const st = TRAINING_STATUSES.includes(status) ? status : "待开始";
      const [result] = await db().query(
        "INSERT INTO han_training (title, trainee, scheduled_on, status, note, owner, store_name) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          trimmed,
          String(trainee || "").trim(),
          optionalDate(scheduledOn),
          st,
          String(note || "").trim(),
          ownerOrDefault(owner),
          storeOrDefault(store),
        ],
      );
      const [rows] = await db().query(
        "SELECT id, title, trainee, scheduled_on, status, note, owner, store_name, created_at FROM han_training WHERE id = ?",
        [result.insertId],
      );
      return mapTraining(rows[0]);
    },

    async listSummary({ store, from, to } = {}) {
      await ensure();
      const { shop, start, end, until } = requireStoreRange({ store, from, to });
      const pool = db();
      const range = [shop, start, until];
      const [[sel]] = await pool.query(
        "SELECT COUNT(*) AS n FROM han_selection WHERE store_name = ? AND created_at >= ? AND created_at < ?",
        range,
      );
      const [[prod]] = await pool.query(
        "SELECT COUNT(*) AS n FROM han_products WHERE store_name = ? AND created_at >= ? AND created_at < ?",
        range,
      );
      const [[paid]] = await pool.query(
        "SELECT COUNT(*) AS n, COALESCE(SUM(amount), 0) AS amount FROM han_paid WHERE store_name = ? AND COALESCE(spent_on, DATE(created_at)) >= ? AND COALESCE(spent_on, DATE(created_at)) < ?",
        range,
      );
      const [[train]] = await pool.query(
        "SELECT COUNT(*) AS n FROM han_training WHERE store_name = ? AND COALESCE(scheduled_on, DATE(created_at)) >= ? AND COALESCE(scheduled_on, DATE(created_at)) < ?",
        range,
      );
      const [[tasks]] = await pool.query(
        "SELECT COUNT(*) AS n FROM han_tasks WHERE store_name = ? AND created_at >= ? AND created_at < ?",
        range,
      );
      return {
        store: shop,
        from: start,
        to: end,
        readOnly: true,
        selectionCount: Number(sel?.n || 0),
        productCount: Number(prod?.n || 0),
        paidCount: Number(paid?.n || 0),
        paidAmount: String(paid?.amount ?? 0),
        trainingCount: Number(train?.n || 0),
        taskCount: Number(tasks?.n || 0),
      };
    },
  };
}

const defaultStore = createHanStore();

export const listTasks = (...args) => defaultStore.listTasks(...args);
export const createTask = (...args) => defaultStore.createTask(...args);
export const getBrief = (...args) => defaultStore.getBrief(...args);
export const setBrief = (...args) => defaultStore.setBrief(...args);

export async function hydrateFromMysql(poolOrFactory = getPool) {
  const store = poolOrFactory === getPool ? defaultStore : createHanStore(poolOrFactory);
  await store.listTasks();
  await store.getBrief();
  return { ok: true };
}

export async function dropProbeTasks(poolOrFactory = getPool) {
  const db = typeof poolOrFactory === "function" ? poolOrFactory() : poolOrFactory;
  try {
    const [result] = await db.query(
      "DELETE FROM han_tasks WHERE title LIKE ? OR title LIKE ?",
      ["%[probe]%", "HAN-ONLY-%"],
    );
    return { ok: true, deleted: Number(result.affectedRows || 0) };
  } catch (err) {
    if (err && (err.code === "ER_NO_SUCH_TABLE" || err.code === "MYSQL_NOT_CONFIGURED")) {
      return { ok: true, deleted: 0 };
    }
    throw err;
  }
}

export const HAN_DEFAULT_OWNER = DEFAULT_OWNER;
export const HAN_DEFAULT_STORE = DEFAULT_STORE;
export const HAN_STATUSES = STATUSES;
export const HAN_SELECTION_STATUSES = SELECTION_STATUSES;
export const HAN_TRAINING_STATUSES = TRAINING_STATUSES;
