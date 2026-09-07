import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { getPool } from "../../db/pool.js";

const DEFAULT_OWNER = "韩梦凯";
const STATUSES = ["待办", "进行中", "已完成"];
const SCHEMA_PATH = fileURLToPath(new URL("./schema.sql", import.meta.url));

function mapTask(row) {
  const created = row.created_at instanceof Date ? row.created_at : new Date(row.created_at);
  return {
    id: String(row.id),
    title: row.title,
    status: row.status,
    owner: row.owner,
    createdAt: created.toISOString(),
  };
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
  };
}

const defaultStore = createHanStore();

export const listTasks = (...args) => defaultStore.listTasks(...args);
export const createTask = (...args) => defaultStore.createTask(...args);
export const getBrief = (...args) => defaultStore.getBrief(...args);
export const setBrief = (...args) => defaultStore.setBrief(...args);

export const HAN_DEFAULT_OWNER = DEFAULT_OWNER;
export const HAN_STATUSES = STATUSES;
