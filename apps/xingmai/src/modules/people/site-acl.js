import { stateSync } from "./state-sync.js";
const sync = stateSync();
import fs from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canAssignPerson, canAssignSiteAcl, personBranch, scopeOf, registerOrganizationPermissions } from "./org-acl.js";
import { listOrgStores } from "./org-board.js";
import { listPeople, orgLineOf } from "./store.js";

export const SITE_MODULES = [
  {
    id: "home",
    name: "首页",
    features: [
      { id: "home.company", name: "数据总揽" },
      { id: "home.workbench", name: "团队概括" },
      { id: "home.realtime", name: "实时" },
      { id: "home.week", name: "近七天业绩汇总" },
      { id: "home.lead", name: "主管/储备" },
      { id: "home.board", name: "排行榜" },
      { id: "home.team", name: "更新团队" }
    ]
  },
  {
    id: "bound",
    name: "边界数据中心",
    features: [
      { id: "bound.board", name: "工作台" },
      { id: "bound.link", name: "扫码连接" },
      { id: "bound.cards", name: "指标设置" },
      { id: "bound.export", name: "导出" }
    ]
  },
  {
    id: "data",
    name: "星脉数据中心",
    features: [
      { id: "data.overview", name: "数据总揽" },
      { id: "data.shops", name: "店铺数据" },
      { id: "data.goods", name: "商品数据" }
    ]
  },
  {
    id: "shen",
    name: "沈子晗运营中心",
    features: [
      { id: "shen.jingcang", name: "京仓管理" },
      { id: "shen.product", name: "产品中心" },
      { id: "shen.paid", name: "付费中心" },
      { id: "shen.recharge", name: "充值规则" },
      { id: "shen.training", name: "培训系统" },
      { id: "shen.tasks", name: "任务管理" }
    ]
  },
  {
    id: "han",
    name: "韩梦凯运营中心",
    features: [
      { id: "han.selection", name: "选品数据" },
      { id: "han.goods", name: "商品数据" },
      { id: "han.paid", name: "实时付费" },
      { id: "han.recharge", name: "充值规则" },
      { id: "han.training", name: "培训系统" }
    ]
  },
  {
    id: "shopkeep",
    name: "店铺维护中心",
    features: [
      { id: "shopkeep.reviews", name: "评价管理" },
      { id: "shopkeep.violations", name: "违规管理" },
      { id: "shopkeep.shipping", name: "发货监控" },
      { id: "shopkeep.stock", name: "京东库存监控" }
    ]
  },
  {
    id: "academy",
    name: "甄选商学院",
    features: [
      { id: "academy.courses", name: "培训课程" },
      { id: "academy.exams", name: "培训考试" },
      { id: "academy.handbook", name: "运营手册" }
    ]
  },
  {
    id: "agent",
    name: "甄选智能体",
    features: [
      { id: "agent.chat", name: "主脑问答台" },
      { id: "agent.connect", name: "模型接入" },
      { id: "agent.history", name: "历史会话" }
    ]
  },
  {
    id: "work",
    name: "工作汇报",
    features: [
      { id: "work.today", name: "今天工作汇报" },
      { id: "work.summary", name: "工作汇总" },
      { id: "work.duty", name: "提交情况" },
      { id: "work.settings", name: "部门设置" },
      { id: "work.diary", name: "日报设置" }
    ]
  },
  {
    id: "meeting",
    name: "月度大会",
    features: [
      { id: "meeting.hours", name: "奋斗时长" },
      { id: "meeting.rank", name: "奋斗排名" },
      { id: "meeting.people", name: "新人介绍" },
      { id: "meeting.levels", name: "职级调整" },
      { id: "meeting.stars", name: "优秀员工" }
    ]
  },
  {
    id: "feedback",
    name: "需求与反馈",
    features: [
      { id: "feedback.open", name: "需求与任务" },
      { id: "feedback.doing", name: "开发中任务" },
      { id: "feedback.closed", name: "已完成任务" },
      { id: "feedback.reject", name: "需求驳回" }
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
      { id: "people.logs", name: "改动日志" },
      { id: "people.notices", name: "公告中心" }
    ]
  },
  {
    id: "hr",
    name: "智能人事",
    features: [
      { id: "hr.attendance", name: "数据看板" },
      { id: "hr.overtime", name: "奋斗时长" },
      { id: "hr.recruit", name: "招聘中心" },
      { id: "hr.staff", name: "员工花名册" }
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

export const SITE_NAV = [
  { id: "home", href: "/home" },
  { id: "bound", href: "/bound" },
  { id: "data", href: "/data" },
  { id: "shen", href: "/shen" },
  { id: "han", href: "/han" },
  { id: "shopkeep", href: "/stores" },
  { id: "academy", href: "/academy" },
  { id: "agent", href: "/agents" },
  { id: "work", href: "/work" },
  { id: "meeting", href: "/meeting" },
  { id: "feedback", href: "/feedback" },
  { id: "releases", href: "/releases" },
  { id: "people", href: "/people" },
  { id: "hr", href: "/hr" },
  { id: "notices", href: "/notices" },
  { id: "profile", href: "/me" }
];

export function moduleIdForPath(pathname) {
  const raw = String(pathname || "/")
    .split("?")[0]
    .replace(/\/index\.html$/i, "")
    .replace(/\.html$/i, "")
    .replace(/\/+$/, "") || "/";
  if (raw === "/" ) {
    return "home";
  }
  const ranked = SITE_NAV.slice().sort((a, b) => b.href.length - a.href.length);
  const hit = ranked.find((row) => raw === row.href || raw.startsWith(`${row.href}/`));
  return hit ? hit.id : "";
}

export function navVisibility(name) {
  const who = String(name || "").trim();
  const sheet = effectiveSiteAcl(who);
  const configured = Boolean(sheet.configured);
  const paths = {};
  SITE_NAV.forEach((row) => {
    const always = row.id === "profile";
    const cap = (sheet.modules && sheet.modules[row.id]) || emptyCap();
    paths[row.href] = {
      see: always || Boolean(cap.see),
      enter: always || Boolean(cap.enter),
      edit: Boolean(cap.edit)
    };
  });
  Object.entries(SITE_FEATURE_PATHS).forEach(([href, feature]) => {
    const mod = feature.split(".")[0];
    const parent = sheet.modules[mod] || emptyCap();
    const cap = parent.features?.[feature] || emptyCap();
    paths[href] = { see: parent.see && cap.see, enter: parent.enter && cap.enter, edit: parent.edit && cap.edit };
  });
  const fields = ["id", "name", "username", "role", "status", "board", "center", "department", "director", "lineManager", "supervisor", "reserve", "operator", "assistant", "visibleShops"];
  const organization = listPeople().map(person => fields.map(key => person[key] ?? ""));
  const revision = createHash("sha256").update(JSON.stringify(organization)).digest("hex").slice(0, 20);
  return { configured, persist: persistMode, revision, paths, modules: sheet.modules, stores: sheet.stores, catalog: SITE_MODULES };
}

export const SITE_FEATURE_PATHS = {
  "/data/overview": "data.overview", "/data/shops": "data.shops", "/data/goods": "data.goods",
  "/shen/jingcang": "shen.jingcang", "/shen/product": "shen.product", "/shen/paid": "shen.paid",
  "/shen/recharge-rules": "shen.recharge", "/shen/training": "shen.training", "/shen/tasks": "shen.tasks",
  "/han/selection": "han.selection", "/han/goods": "han.goods", "/han/paid": "han.paid",
  "/han/recharge-rules": "han.recharge", "/han/training": "han.training",
  "/academy/courses": "academy.courses", "/academy/exams": "academy.exams", "/academy/handbook": "academy.handbook"
};

export function canonicalPerson(value) {
  const key = String(value || "").trim();
  const rows = listPeople();
  const exact = rows.filter(person => String(person.username || person.name).trim() === key);
  return exact.length === 1 ? exact[0] : rows.find(person => person.name === key) || null;
}
export function canonicalActor(value) {
  const key = String(value || "").trim();
  // Reserved administrator identities must not be replaced by the legacy
  // roster display name (username 罗成, name 管理员).
  if (["罗成", "luocheng", "管理员"].includes(key)) return "罗成";
  return canonicalPerson(key)?.name || key;
}

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
  return ["罗成", "luocheng"].includes(String(name || "").trim());
}

function isLineLeader(name) {
  const raw = String(name || "");
  return ["沈子晗", "韩梦凯"].includes(raw);
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

function writePersistFile(snapshot = snapshotAcl()) {
  if (runningUnderNodeTest()) {
    return false;
  }
  try {
    fs.mkdirSync(path.dirname(persistFile), { recursive: true });
    fs.writeFileSync(persistFile, JSON.stringify(snapshot) + "\n", "utf8");
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

async function writeMysqlAcl(snapshot) {
  const auth = await mysqlAuth();
  if (!auth) {
    return false;
  }
  const { query } = auth;
  await query(
    "CREATE TABLE IF NOT EXISTS site_acl_board (id TINYINT NOT NULL PRIMARY KEY, payload LONGTEXT NOT NULL, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)"
  );
  await query("INSERT INTO site_acl_board (id, payload) VALUES (1, ?) ON DUPLICATE KEY UPDATE payload = VALUES(payload)", [
    JSON.stringify(snapshot)
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
  if (runningUnderNodeTest()) return { ok: true, mode: persistMode };
  await sync.read(async () => {
    const mysql = await mysqlAuth();
    if (mysql) {
      // A database failure must not revive stale file permissions.
      const data = await readMysqlAcl();
      if (data) return { data, mode: "mysql" };
    }
    return { data: readPersistFile(), mode: "file" };
  }, result => { if (applyAclSnapshot(result.data)) persistMode = result.mode; });
  return { ok: true, mode: persistMode };
}

export async function persistSiteAcl() {
  if (runningUnderNodeTest()) return { ok: true, mode: persistMode };
  return sync.write(snapshotAcl(), async snapshot => {
    try {
      if (await writeMysqlAcl(snapshot)) {
        persistMode = "mysql"; writePersistFile(snapshot);
        return { ok: true, mode: persistMode };
      }
    } catch { throw Object.assign(new Error("组织中心保存失败，数据库未确认写入"), { statusCode: 503 }); }
    if (writePersistFile(snapshot)) {
      persistMode = "file"; return { ok: true, mode: persistMode };
    }
    throw Object.assign(new Error("组织中心保存失败，无法持久化"), { statusCode: 503 });
  });
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
  const person = canonicalPerson(name);
  const raw = (person && (grants[`person:${person.id}`] || grants[person.name] || grants[person.username])) || grants[String(name || "").trim()];
  return raw && typeof raw === "object" ? raw : null;
}

export function isConfigured(name) {
  return Boolean(savedGrant(name));
}

export function effectiveSiteAcl(name, actorStores = []) {
  const who = canonicalActor(name);
  const configured = isConfigured(who);
  const saved = savedGrant(who) || {};
  let modules;
  if (isLuo(who)) {
    modules = maxModules();
  } else if (isLineLeader(who) && !configured) {
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
    implicit: isLuo(who) ? "max" : isLineLeader(who) && !configured ? "org" : "",
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
      return Boolean(sheet.modules[mod.id][cap] && feat[cap]);
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
  grants[`person:${person.id}`] = {
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

export async function preservePersonAcl(person) {
  await hydrateSiteAcl();
  const saved = savedGrant(person.username || person.name);
  if (saved && !grants[`person:${person.id}`]) {
    grants[`person:${person.id}`] = clone(saved);
    await persistSiteAcl();
  }
}

registerOrganizationPermissions({ canonicalActor, featureAllowed, isConfigured, storeAllowed });
