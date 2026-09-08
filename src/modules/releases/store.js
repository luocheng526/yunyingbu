import { isMysqlConfigured } from "../../db/pool.js";
import { createMemoryStore } from "./store-memory.js";
import { createMysqlStore } from "./store-mysql.js";

export { MODULES, REVIEWER } from "./store-memory.js";

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
