import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canAssignPerson, canAssignSiteAcl, personBranch, scopeOf } from "./org-acl.js";
import { listOrgStores } from "./org-board.js";
import { listPeople, orgLineOf } from "./store.js";

export const SITE_MODULES = [
  {
    id: "home",
    name: "首页",
    features: [
      { id: "home.workbench", name: "工作台" },
      { id: "home.realtime", name: "实时店铺" },
      { id: "home.lead", name: "主管/储备" },
      { id: "home.team", name: "更新团队" }
    ]
  },
  {
    id: "data",
    name: "数据中心",
    features: [
      { id: "data.board", name: "看板" },
      { id: "data.export", name: "导出" }
    ]
  },
  {
    id: "shen",
    name: "沈子晗运营中心",
    features: [
      { id: "shen.tasks", name: "任务" },
      { id: "shen.brief", name: "今日简报" }
    ]
  },
  {
    id: "han",
    name: "韩梦凯运营中心",
    features: [
      { id: "han.tasks", name: "任务" },
      { id: "han.brief", name: "今日简报" }
    ]
  },
  {
    id: "shopkeep",
    name: "店铺维护中心",
    features: [
      { id: "shopkeep.list", name: "店铺列表" },
      { id: "shopkeep.log", name: "维护记录" }
    ]
  },
  {
    id: "academy",
    name: "甄选学院",
    features: [
      { id: "academy.courses", name: "课程" },
      { id: "academy.records", name: "学习记录" }
    ]
  },
  {
    id: "agent",
    name: "甄选智能体",
    features: [
      { id: "agent.chat", name: "对话" },
      { id: "agent.query", name: "只读查询" }
    ]
  },
  {
    id: "releases",
    name: "版本发布中心",
    features: [
      { id: "releases.queue", name: "发布队列" },
      { id: "releases.submit", name: "交单" },
      { id: "releases.gate", name: "通过闸门" }
    ]
  },
  {
    id: "people",
    name: "组织中心",
    features: [
      { id: "people.stores", name: "店铺主数据" },
      { id: "people.members", name: "成员管理" },
      { id: "people.rights", name: "责权" },
      { id: "people.acl", name: "权限" },
      { id: "people.logs", name: "改动日志" }
    ]
  },
  {
    id: "notices",
    name: "公告中心",
    features: [
      { id: "notices.all", name: "公告管理" },
      { id: "notices.hr", name: "人事异动" },
      { id: "notices.promotion", name: "员工晋升报" },
      { id: "notices.board", name: "龙虎榜" },
      { id: "notices.values", name: "价值观践行" },
      { id: "notices.daily", name: "日常公告" }
    ]
  },
  {
    id: "profile",
    name: "个人中心",
    features: [
      { id: "profile.info", name: "资料" },
      { id: "profile.password", name: "改密" }
    ]
  }
];

const persistFile = path.join(path.dirname(fileURLToPath(import.meta.url)), "data", "site-acl.json");

let grants = {};
let persistMode = "memory";
let hydrated = false;

function runningUnderNodeTest() {
  return Boolean(process.env.NODE_TEST_CONTEXT) || process.execArgv.includes("--test") || process.argv.includes("--test");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function emptyCap() {
  return { see: false, enter: false, edit: false };
}

export function normalizeCap(input) {
  const edit = Boolean(input && input.edit);
  const enter = Boolean(input && input.enter) || edit;
  const see = Boolean(input && input.see) || enter;
  return { see, enter, edit };
}

function allOn() {
  return { see: true, enter: true, edit: true };
}

function isLuo(name) {
  return String(name || "").includes("罗成");
}

function isLineLeader(name) {
  const raw = String(name || "");
  return raw.includes("沈子晗") || raw.includes("韩梦凯");
}

function snapshotAcl() {
  return { grants };
}

function applyAclSnapshot(data) {
  if (!data || typeof data !== "object" || !data.grants || typeof data.grants !== "object") {
    return false;
  }
  grants = clone(data.grants);
  return true;
}

function readPersistFile() {
  if (runningUnderNodeTest()) {
    return null;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(persistFile, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function writePersistFile() {
  if (runningUnderNodeTest()) {
    return false;
  }
  try {
    fs.mkdirSync(path.dirname(persistFile), { recursive: true });
    fs.writeFileSync(persistFile, JSON.stringify(snapshotAcl()) + "\n", "utf8");
    return true;
  } catch {
    return false;
  }
}

async function mysqlAuth() {
  try {
    const auth = await import("../profile/auth.js");
    if (typeof auth.dbMode === "function" && auth.dbMode() === "mysql" && typeof auth.query === "function") {
      return auth;
    }
  } catch {
    /* local / test has no profile auth */
  }
  return null;
}

async function readMysqlAcl() {
  const auth = await mysqlAuth();
  if (!auth) {
    return null;
  }
  const { query } = auth;
  await query(
    "CREATE TABLE IF NOT EXISTS site_acl_board (id TINYINT NOT NULL PRIMARY KEY, payload LONGTEXT NOT NULL, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)"
  );
  const [rows] = await query("SELECT payload FROM site_acl_board WHERE id = 1");
  const raw = rows && rows[0] ? rows[0].payload : "";
  if (!raw) {
    return null;
  }
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  return parsed && typeof parsed === "object" ? parsed : null;
}

async function writeMysqlAcl() {
  const auth = await mysqlAuth();
  if (!auth) {
    return false;
  }
  const { query } = auth;
  await query(
    "CREATE TABLE IF NOT EXISTS site_acl_board (id TINYINT NOT NULL PRIMARY KEY, payload LONGTEXT NOT NULL, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)"
  );
  await query("INSERT INTO site_acl_board (id, payload) VALUES (1, ?) ON DUPLICATE KEY UPDATE payload = VALUES(payload)", [
    JSON.stringify(snapshotAcl())
  ]);
  return true;
}

export function siteAclPersistMode() {
  return persistMode;
}

export function resetSiteAcl() {
  grants = {};
  persistMode = "memory";
  hydrated = false;
}

export async function hydrateSiteAcl() {
  if (runningUnderNodeTest()) {
    persistMode = "memory";
    hydrated = true;
    return { ok: true, mode: persistMode };
  }
  if (hydrated) {
    return { ok: true, mode: persistMode };
  }
  try {
    const fromMysql = await readMysqlAcl();
    if (applyAclSnapshot(fromMysql)) {
      persistMode = "mysql";
      hydrated = true;
      return { ok: true, mode: persistMode };
    }
  } catch {
    /* fall through */
  }
  if (applyAclSnapshot(readPersistFile())) {
    persistMode = "file";
    hydrated = true;
    return { ok: true, mode: persistMode };
  }
  persistMode = persistMode || "memory";
  hydrated = true;
  return { ok: true, mode: persistMode };
}

export async function persistSiteAcl() {
  if (runningUnderNodeTest()) {
    persistMode = "memory";
    return { ok: true, mode: persistMode };
  }
  try {
    if (await writeMysqlAcl()) {
      persistMode = "mysql";
      writePersistFile();
      return { ok: true, mode: persistMode };
    }
  } catch {
    /* file fallback */
  }
  if (writePersistFile()) {
    persistMode = "file";
    return { ok: true, mode: persistMode };
  }
  persistMode = "memory";
  return { ok: true, mode: persistMode };
}

function blankModules() {
  const modules = {};
  SITE_MODULES.forEach((mod) => {
    const features = {};
    (mod.features || []).forEach((feature) => {
      features[feature.id] = emptyCap();
    });
    modules[mod.id] = { ...emptyCap(), features };
  });
  return modules;
}

function fillModules(source, fallback) {
  const modules = blankModules();
  SITE_MODULES.forEach((mod) => {
    const incoming = source && source[mod.id];
    const base = fallback && fallback[mod.id];
    modules[mod.id] = {
      ...normalizeCap({
        see: Boolean(incoming && incoming.see) || Boolean(base && base.see),
        enter: Boolean(incoming && incoming.enter) || Boolean(base && base.enter),
        edit: Boolean(incoming && incoming.edit) || Boolean(base && base.edit)
      }),
      features: {}
    };
    (mod.features || []).forEach((feature) => {
      const feat = incoming && incoming.features && incoming.features[feature.id];
      const fallbackFeat = base && base.features && base.features[feature.id];
      modules[mod.id].features[feature.id] = normalizeCap({
        see: Boolean(feat && feat.see) || Boolean(fallbackFeat && fallbackFeat.see),
        enter: Boolean(feat && feat.enter) || Boolean(fallbackFeat && fallbackFeat.enter),
        edit: Boolean(feat && feat.edit) || Boolean(fallbackFeat && fallbackFeat.edit)
      });
    });
  });
  return modules;
}

function leaderModules() {
  const modules = blankModules();
  const people = modules.people;
  people.see = true;
  people.enter = true;
  people.edit = true;
  Object.keys(people.features).forEach((id) => {
    people.features[id] = allOn();
  });
  return modules;
}

function maxModules() {
  const modules = blankModules();
  SITE_MODULES.forEach((mod) => {
    modules[mod.id] = { ...allOn(), features: {} };
    (mod.features || []).forEach((feature) => {
      modules[mod.id].features[feature.id] = allOn();
    });
  });
  return modules;
}

function compactModules(modules) {
  const out = {};
  SITE_MODULES.forEach((mod) => {
    const incoming = modules && modules[mod.id];
    if (!incoming) {
      return;
    }
    const features = {};
    (mod.features || []).forEach((feature) => {
      const cap = normalizeCap(incoming.features && incoming.features[feature.id]);
      if (cap.see || cap.enter || cap.edit) {
        features[feature.id] = cap;
      }
    });
    const cap = normalizeCap(incoming);
    if (cap.see || cap.enter || cap.edit || Object.keys(features).length) {
      out[mod.id] = { ...cap, features };
    }
  });
  return out;
}

function compactStores(stores) {
  const out = {};
  Object.entries(stores || {}).forEach(([key, value]) => {
    const cap = normalizeCap(value);
    if (cap.see || cap.enter || cap.edit) {
      out[String(key)] = cap;
    }
  });
  return out;
}

function savedGrant(name) {
  const raw = grants[String(name || "").trim()];
  return raw && typeof raw === "object" ? raw : null;
}

export function isConfigured(name) {
  return Boolean(savedGrant(name));
}

export function effectiveSiteAcl(name, actorStores = []) {
  const who = String(name || "").trim();
  const configured = isConfigured(who);
  const saved = savedGrant(who) || {};
  let modules;
  if (isLuo(who)) {
    modules = maxModules();
  } else if (isLineLeader(who)) {
    modules = fillModules(saved.modules, leaderModules());
  } else {
    modules = fillModules(saved.modules, blankModules());
  }
  const stores = {};
  const storeIds = new Set((actorStores || []).map((store) => String(store.id)));
  Object.keys(saved.stores || {}).forEach((key) => {
    storeIds.add(String(key));
  });
  storeIds.forEach((key) => {
    if (isLuo(who)) {
      stores[key] = allOn();
      return;
    }
    stores[key] = normalizeCap(saved.stores && saved.stores[key]);
  });
  return {
    name: who,
    configured: isLuo(who) ? true : configured,
    implicit: isLuo(who) ? "max" : isLineLeader(who) ? "org" : "",
    modules,
    stores
  };
}

export function featureAllowed(name, featureId, cap, actorStores = []) {
  const sheet = effectiveSiteAcl(name, actorStores);
  for (const mod of SITE_MODULES) {
    if (mod.id === featureId) {
      return Boolean(sheet.modules[mod.id] && sheet.modules[mod.id][cap]);
    }
    const feat = sheet.modules[mod.id] && sheet.modules[mod.id].features[featureId];
    if (feat) {
      return Boolean(feat[cap]);
    }
  }
  return false;
}

export function storeAllowed(name, storeId, cap, actorStores = []) {
  const sheet = effectiveSiteAcl(name, actorStores);
  const hit = sheet.stores[String(storeId)];
  return Boolean(hit && hit[cap]);
}

function presentPerson(person) {
  const line = orgLineOf(person);
  return {
    id: person.id,
    name: person.name,
    role: person.role,
    status: person.status,
    center: person.center,
    lineManager: line.manager || person.lineManager || "",
    supervisor: line.supervisor || "",
    branch: personBranch({ ...person, lineManager: line.manager }),
    configured: isConfigured(person.name)
  };
}

export function listSiteAclPeople(actor) {
  return listPeople()
    .filter((row) => row.status === "在职" && row.name !== "管理员" && row.center !== "人员管理")
    .map(presentPerson)
    .filter((row) => canAssignPerson(actor, row))
    .sort((a, b) => a.name.localeCompare(b.name, "zh"));
}

export function listSiteAclStores(actor) {
  return listOrgStores({}, actor).map((row) => ({
    id: row.id,
    storeName: row.storeName,
    storeId: row.storeId || "",
    merchantId: row.merchantId || "",
    manager: row.manager || "",
    supervisor: row.supervisor || "",
    operator: row.operator || "",
    assistant: row.assistant || "",
    remark: row.remark || ""
  }));
}

export function listSiteAclBoard(actor) {
  const stores = listSiteAclStores(actor);
  const people = listSiteAclPeople(actor);
  const scope = scopeOf(actor);
  return {
    actor,
    canAssign: canAssignSiteAcl(actor),
    scope: scope.key,
    scopeLabel: scope.label,
    persist: persistMode,
    catalog: SITE_MODULES,
    people,
    stores,
    me: effectiveSiteAcl(actor, stores)
  };
}

export function readPersonSiteAcl(actor, name) {
  const who = String(name || "").trim();
  if (!who) {
    return { ok: false, statusCode: 400, error: "请选择人员" };
  }
  const people = listSiteAclPeople(actor);
  const person = people.find((row) => row.name === who) || listPeople().map(presentPerson).find((row) => row.name === who);
  if (!person) {
    return { ok: false, statusCode: 404, error: "成员管理没有这个人" };
  }
  if (!canAssignPerson(actor, person)) {
    return { ok: false, statusCode: 403, error: "只能配自己组的人" };
  }
  const stores = listSiteAclStores(actor);
  return { ok: true, person, sheet: effectiveSiteAcl(who, stores), stores };
}

export async function savePersonSiteAcl(actor, name, input = {}) {
  if (!canAssignSiteAcl(actor)) {
    return { ok: false, statusCode: 403, error: "只有罗成、韩梦凯、沈子晗能配网站权限" };
  }
  const who = String(name || "").trim();
  if (!who) {
    return { ok: false, statusCode: 400, error: "请选择人员" };
  }
  if (isLuo(who) && !isLuo(actor)) {
    return { ok: false, statusCode: 403, error: "不能改罗成的权限" };
  }
  const person = listPeople().map(presentPerson).find((row) => row.name === who);
  if (!person) {
    return { ok: false, statusCode: 404, error: "成员管理没有这个人" };
  }
  if (!canAssignPerson(actor, person)) {
    return { ok: false, statusCode: 403, error: "只能配自己组的人" };
  }
  const scoped = listSiteAclStores(actor);
  const scopedIds = new Set(scoped.map((row) => String(row.id)));
  const previous = savedGrant(who) || { modules: {}, stores: {} };
  const nextStores = { ...(previous.stores || {}) };
  Object.keys(nextStores).forEach((key) => {
    if (scopedIds.has(String(key)) && !(input.stores && Object.prototype.hasOwnProperty.call(input.stores, key))) {
      delete nextStores[key];
    }
  });
  Object.entries(input.stores || {}).forEach(([key, value]) => {
    if (!scopedIds.has(String(key))) {
      return;
    }
    const cap = normalizeCap(value);
    if (cap.see || cap.enter || cap.edit) {
      nextStores[String(key)] = cap;
    } else {
      delete nextStores[String(key)];
    }
  });
  grants[who] = {
    modules: compactModules(input.modules),
    stores: compactStores(nextStores)
  };
  await persistSiteAcl();
  return {
    ok: true,
    person,
    sheet: effectiveSiteAcl(who, scoped),
    persist: persistMode
  };
}
