import { dbMode, ensureDatabase, ensureSchema, getPool, query, setDbMode } from "./modules/profile/auth.js";
import { hydrateFromMysql as hydrateUsers } from "./modules/profile/auth.js";
import { hydrateFromMysql as hydrateHan } from "./modules/han/store.js";
import { hydrateFromMysql as hydrateShen } from "./modules/shen/store.js";
import { hydrateFromMysql as hydratePeople } from "./modules/people/store.js";
import { hydrateFromMysql as hydrateData } from "./modules/data/overview.js";

let nextId = 1;
let notes = [];

function clone(note) {
  return { ...note };
}

export function clearNotes() {
  notes = [];
  nextId = 1;
}

export async function hydrateFromMysql() {
  const [rows] = await query("SELECT id, text, created_at FROM notes ORDER BY id ASC");
  notes = rows.map((row) => ({
    id: Number(row.id),
    text: row.text,
    createdAt: row.created_at
  }));
  nextId = notes.reduce((max, note) => Math.max(max, Number(note.id) || 0), 0) + 1;
}

export function listNotes() {
  return notes.map(clone);
}

export function addNote(text) {
  const trimmed = typeof text === "string" ? text.trim() : "";
  if (!trimmed) {
    throw new Error("Note text is required");
  }
  const note = { id: nextId++, text: trimmed, createdAt: new Date().toISOString() };
  notes.push(note);
  if (dbMode() === "mysql") {
    void query("INSERT INTO notes (text, created_at) VALUES (?, ?)", [note.text, note.createdAt])
      .then(([result]) => {
        if (result && result.insertId) {
          note.id = Number(result.insertId);
        }
      })
      .catch((err) => {
        console.error("notes persist failed", err);
      });
  }
  return clone(note);
}

/** 线上 app.js 仍是 createNotesStore().list() / .create()，缺这个导出会试载失败。 */
export function createNotesStore() {
  return {
    list() {
      return listNotes();
    },
    create(text) {
      return addNote(text);
    }
  };
}

export async function startMysql({ skipCreateDatabase = false } = {}) {
  if (!skipCreateDatabase) {
    await ensureDatabase();
  }
  await ensureSchema();
  setDbMode("mysql");
  await hydrateUsers();
  await hydrateHan();
  await hydrateShen();
  await hydratePeople();
  await hydrateData();
  await hydrateFromMysql();
}
