import { isMysqlConfigured } from "../../db/pool.js";
import { createMemoryStore, MODULES as MEMORY_MODULES } from "./store-memory.js";
import { createMysqlStore } from "./store-mysql.js";

export { REVIEWER } from "./store-memory.js";

// 组织中心 = 人员管理的对话名；后两个是新建对话，交单必须用原名。
export const EXTRA_MODULES = ["甄选商学院", "组织中心", "店铺维护中心", "甄选智能体"];

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
