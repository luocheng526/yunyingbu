import { isMysqlConfigured } from "../../db/pool.js";
import { createMemoryStore, MODULES as MEMORY_MODULES } from "./store-memory.js";
import { createMysqlStore } from "./store-mysql.js";

export { REVIEWER } from "./store-memory.js";

// 只补模块名。线上 store-memory 可能已有 主框架 等，这里只往名单上追加，不覆盖 router。
export const EXTRA_MODULES = [
  "主框架",
  "人员管理",
  "组织中心",
  "店铺维护中心",
  "甄选商学院",
  "甄选智能体",
  "智能人事"
];

export const MODULES = EXTRA_MODULES.reduce(
  (list, name) => (list.includes(name) ? list : [...list, name]),
  [...MEMORY_MODULES]
);

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
