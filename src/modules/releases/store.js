import { isMysqlConfigured } from "../../db/pool.js";
import { createMemoryStore, MODULES as MEMORY_MODULES } from "./store-memory.js";
import { createMysqlStore } from "./store-mysql.js";

export { REVIEWER } from "./store-memory.js";

export const MODULES = MEMORY_MODULES.includes("甄选商学院")
  ? MEMORY_MODULES
  : [...MEMORY_MODULES, "甄选商学院"];

function asyncWrap(store) {
  const wrapped = {};
  for (const key of Object.keys(store)) {
    const value = store[key];
    if (typeof value !== "function") {
      wrapped[key] = value;
      continue;
    }
    wrapped[key] = async (...args) => value.apply(store, args);
  }
  return wrapped;
}

export function createStore(options = {}) {
  if (options.memory === true || options.pool === null) {
    return asyncWrap(createMemoryStore(options));
  }
  if (options.pool || isMysqlConfigured(options.env || process.env)) {
    return createMysqlStore(options);
  }
  return asyncWrap(createMemoryStore(options));
}
