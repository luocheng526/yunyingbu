import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { getPool } from "../../db/pool.js";

const DEFAULT_OWNER = "韩梦凯";
const STATUSES = ["待办", "进行中", "已完成"];
const SELECTION_STATUSES = ["观察", "入选", "淘汰"];
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

function mapTask(row) {
  return {
    id: String(row.id),
    title: row.title,
    status: row.status,
    owner: row.owner,
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
        "SELECT id, title, status, owner, created_at FROM han_tasks ORDER BY id ASC",
      );
      return rows.map(mapTask);
    },

    async createTask({ title, status, owner } = {}) {
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
        "INSERT INTO han_tasks (title, status, owner) VALUES (?, ?, ?)",
        [trimmed, st, ow],
      );
      const [rows] = await db().query(
        "SELECT id, title, status, owner, created_at FROM han_tasks WHERE id = ?",
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
        "SELECT id, name, category, note, status, owner, created_at FROM han_selection ORDER BY id ASC",
      );
      return rows.map(mapSelection);
    },

    async createSelection({ name, category, note, status, owner } = {}) {
      await ensure();
      const trimmed = String(name || "").trim();
      if (!trimmed) {
        const err = new Error("name required");
        err.statusCode = 400;
        throw err;
      }
      const st = SELECTION_STATUSES.includes(status) ? status : "观察";
      const [result] = await db().query(
        "INSERT INTO han_selection (name, category, note, status, owner) VALUES (?, ?, ?, ?, ?)",
        [trimmed, String(category || "").trim(), String(note || "").trim(), st, ownerOrDefault(owner)],
      );
      const [rows] = await db().query(
        "SELECT id, name, category, note, status, owner, created_at FROM han_selection WHERE id = ?",
        [result.insertId],
      );
      return mapSelection(rows[0]);
    },

    async listProducts() {
      await ensure();
      const [rows] = await db().query(
        "SELECT id, name, sku, price, stock, owner, created_at FROM han_products ORDER BY id ASC",
      );
      return rows.map(mapProduct);
    },

    async createProduct({ name, sku, price, stock, owner } = {}) {
      await ensure();
      const trimmed = String(name || "").trim();
      if (!trimmed) {
        const err = new Error("name required");
        err.statusCode = 400;
        throw err;
      }
      const [result] = await db().query(
        "INSERT INTO han_products (name, sku, price, stock, owner) VALUES (?, ?, ?, ?, ?)",
        [trimmed, String(sku || "").trim(), optionalNumber(price), optionalNumber(stock), ownerOrDefault(owner)],
      );
      const [rows] = await db().query(
        "SELECT id, name, sku, price, stock, owner, created_at FROM han_products WHERE id = ?",
        [result.insertId],
      );
      return mapProduct(rows[0]);
    },

    async listPaid() {
      await ensure();
      const [rows] = await db().query(
        "SELECT id, channel, amount, spent_on, note, owner, created_at FROM han_paid ORDER BY id ASC",
      );
      return rows.map(mapPaid);
    },

    async createPaid({ channel, amount, spentOn, note, owner } = {}) {
      await ensure();
      const trimmed = String(channel || "").trim();
      if (!trimmed) {
        const err = new Error("channel required");
        err.statusCode = 400;
        throw err;
      }
      const [result] = await db().query(
        "INSERT INTO han_paid (channel, amount, spent_on, note, owner) VALUES (?, ?, ?, ?, ?)",
        [trimmed, optionalNumber(amount), optionalDate(spentOn), String(note || "").trim(), ownerOrDefault(owner)],
      );
      const [rows] = await db().query(
        "SELECT id, channel, amount, spent_on, note, owner, created_at FROM han_paid WHERE id = ?",
        [result.insertId],
      );
      return mapPaid(rows[0]);
    },
  };
}

const defaultStore = createHanStore();

export const listTasks = (...args) => defaultStore.listTasks(...args);
export const createTask = (...args) => defaultStore.createTask(...args);
export const getBrief = (...args) => defaultStore.getBrief(...args);
export const setBrief = (...args) => defaultStore.setBrief(...args);

export const HAN_DEFAULT_OWNER = DEFAULT_OWNER;
export const HAN_STATUSES = STATUSES;
export const HAN_SELECTION_STATUSES = SELECTION_STATUSES;
