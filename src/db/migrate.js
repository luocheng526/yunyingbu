import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPool } from "./pool.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultDir = path.join(here, "migrations");

export async function runMigrations({ pool, dir } = {}) {
  const db = pool || getPool();
  const folder = dir || defaultDir;
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      applied_at DATETIME(3) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  const files = fs
    .readdirSync(folder)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const name of files) {
    const [existing] = await db.query("SELECT id FROM schema_migrations WHERE id = ?", [name]);
    if (existing.length) {
      continue;
    }
    const sql = fs.readFileSync(path.join(folder, name), "utf8");
    const statements = sql
      .split(/;\s*$/m)
      .map((part) => part.trim())
      .filter(Boolean);
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      for (const statement of statements) {
        await conn.query(statement);
      }
      await conn.query("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)", [
        name,
        new Date()
      ]);
      await conn.commit();
      console.info("[mysql] migration applied", name);
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
}
