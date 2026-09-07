import { ensureDatabase, ensureSchema, getPool, setDbMode } from "./pool.js";
import { hydrateFromMysql as hydrateUsers } from "../modules/profile/auth.js";
import { hydrateFromMysql as hydrateHan } from "../modules/han/store.js";
import { hydrateFromMysql as hydrateShen } from "../modules/shen/store.js";
import { hydrateFromMysql as hydratePeople } from "../modules/people/store.js";
import { hydrateFromMysql as hydrateData } from "../modules/data/overview.js";
import { hydrateFromMysql as hydrateNotes } from "../notes-store.js";

export async function startMysql({ skipCreateDatabase = false } = {}) {
  if (!skipCreateDatabase) {
    await ensureDatabase();
  }
  await ensureSchema(getPool());
  setDbMode("mysql");
  await hydrateUsers();
  await hydrateHan();
  await hydrateShen();
  await hydratePeople();
  await hydrateData();
  await hydrateNotes();
}
