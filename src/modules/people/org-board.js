import { assertCanWrite, canEditStore, rowMatchesScope, scopeOf } from "./org-acl.js";
import { listPeople } from "./store.js";

const STATUSES = {
  operating: "运营中",
  idle: "闲置中",
  closing: "退店中",
  closed: "已退店"
};

function clone(row) {
  return { ...row };
}

function seedRows() {
  const shen = [
    ["沈子晗", "张文静", "RASW家居旗舰店", "11001001"],
    ["沈子晗", "陈明婧", "RASW生活电器旗舰店", "11001002"],
    ["沈子晗", "郭桂良", "RASW健康电器旗舰店", "11001003"],
    ["沈子晗", "王博", "飒望居家旗舰店", "11001004"],
    ["沈子晗", "王博", "SAWAAG居家布艺旗舰店", "11001005"],
    ["杨润泽", "杨润泽", "RASW居家旗舰店", "11001006"],
    ["杨润泽", "崔安琪", "飒望家居日用旗舰店", "11001007"],
    ["杨润泽", "杨润泽", "飒望旗舰店", "11001008"],
    ["杨润泽", "郭哲宁", "RASW潮流生活旗舰店", "11001009"],
    ["沈子晗", "高丽男", "HYEGIIR健康器械旗舰店", "11001010"],
    ["沈子晗", "栗静萱", "DIKTT个护健康旗舰店", "11001011"],
    ["沈子晗", "杨禄", "HYEGIIR医疗保健旗舰店", "11001012"],
    ["沈子晗", "张鹏", "HYEGIIR养生器械旗舰店", "11001013"],
    ["沈子晗", "王梓萱", "MGXEK旗舰店", "11001014"],
    ["沈子晗", "秦怡硕", "SAWAAG生活日用旗舰店", "11001015"]
  ];
  const han = [
    ["陈晓曼", "陈晓曼", "ZYUO洗护旗舰店", "150078094"],
    ["高明阳", "高明阳", "SAWAA个护健康旗舰店", "150078095"]
  ];
  let id = 1;
  const rows = [];
  for (const [lead, owner, storeName, merchantId] of shen) {
    rows.push({
      id: id++,
      team: "沈子晗组",
      chief: "沈子晗组",
      lead,
      owner,
      storeName,
      storeId: "",
      merchantId,
      remark: "运营中",
      statusKey: "operating",
      updatedOn: "9.8更新",
      closedOn: "",
      login: "demo_" + merchantId.slice(-4),
      password: "Demo123!",
      demo: true
    });
  }
  for (const [lead, owner, storeName, merchantId] of han) {
    rows.push({
      id: id++,
      team: "精铺组 韩梦凯",
      chief: "精铺组 韩梦凯",
      lead,
      owner,
      storeName,
      storeId: "",
      merchantId,
      remark: "运营中",
      statusKey: "operating",
      updatedOn: "8.12更新",
      closedOn: "",
      login: "jingdong" + merchantId.slice(-3),
      password: "Demo123!",
      demo: true
    });
  }
  rows[rows.length - 1].remark = "闲置中";
  rows[rows.length - 1].statusKey = "idle";
  return { nextId: id, rows };
}

let seeded = seedRows();
let rows = seeded.rows;
let nextId = seeded.nextId;
let logs = [
  {
    id: 1,
    at: "2026-09-09 13:00:00",
    actor: "组织中心",
    action: "预置",
    detail: "从花名册试点店铺生成演示行，标演示。智能体只读。"
  }
];
let logId = 2;

function addLog(action, detail) {
  logs.unshift({
    id: logId++,
    at: new Date().toISOString().slice(0, 19).replace("T", " "),
    actor: "组织中心",
    action,
    detail
  });
  logs = logs.slice(0, 80);
}

export const RIGHTS_ROLES = ["总监", "经理", "主管", "储备", "运营", "助理"];
const DEFAULT_PINS = { 罗成: "总监", 沈子晗: "经理", 韩梦凯: "经理" };
let rightsPins = { ...DEFAULT_PINS };

function mapBoardRole(role) {
  const raw = String(role || "").trim();
  if (raw === "店长") {
    return "运营";
  }
  if (RIGHTS_ROLES.includes(raw)) {
    return raw;
  }
  return "";
}

function namesFromStore(row) {
  const names = [];
  [row.lead, row.owner].forEach((value) => {
    const name = String(value || "").trim();
    if (name) {
      names.push(name);
    }
  });
  const chief = String(row.chief || row.team || "");
  if (chief.includes("沈子晗")) {
    names.push("沈子晗");
  }
  if (chief.includes("韩梦凯")) {
    names.push("韩梦凯");
  }
  if (chief.includes("罗成")) {
    names.push("罗成");
  }
  return names;
}

function storeCountOf(name, stores) {
  return stores.filter((row) => namesFromStore(row).includes(name)).length;
}

function collectRoster() {
  return listPeople().filter((row) => row.status === "在职" && row.center !== "人员管理" && row.name !== "管理员");
}

export function listRightsBoard() {
  const stores = rows.map(clone);
  const roster = collectRoster();
  const names = new Set(Object.keys(rightsPins));
  stores.forEach((row) => {
    namesFromStore(row).forEach((name) => names.add(name));
  });
  const byName = {};
  roster.forEach((row) => {
    byName[row.name] = row;
  });
  const columns = {};
  RIGHTS_ROLES.forEach((role) => {
    columns[role] = [];
  });
  names.forEach((name) => {
    const person = byName[name];
    const role = rightsPins[name] || mapBoardRole(person && person.role) || "运营";
    columns[role].push({
      name,
      role,
      id: person ? person.id : null,
      stores: storeCountOf(name, stores)
    });
  });
  RIGHTS_ROLES.forEach((role) => {
    columns[role].sort((a, b) => a.name.localeCompare(b.name, "zh"));
  });
  const candidates = [...new Set([...names, ...roster.map((row) => row.name)])]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "zh"))
    .map((name) => ({
      name,
      role: rightsPins[name] || mapBoardRole(byName[name] && byName[name].role) || "运营"
    }));
  return {
    ok: true,
    roles: RIGHTS_ROLES,
    columns: RIGHTS_ROLES.map((role) => ({ role, people: columns[role] })),
    candidates
  };
}

export function pinRightsName(name, role) {
  const who = String(name || "").trim();
  const next = String(role || "").trim();
  if (!who) {
    return { ok: false, statusCode: 400, error: "请填写姓名" };
  }
  if (!RIGHTS_ROLES.includes(next)) {
    return { ok: false, statusCode: 400, error: "职位不在责权栏中" };
  }
  rightsPins[who] = next;
  addLog("指定责权", who + " → " + next);
  return listRightsBoard();
}

export function unpinRightsName(name) {
  const who = String(name || "").trim();
  if (!who) {
    return { ok: false, statusCode: 400, error: "请填写姓名" };
  }
  delete rightsPins[who];
  if (DEFAULT_PINS[who]) {
    rightsPins[who] = DEFAULT_PINS[who];
  }
  addLog("取消指定", who);
  return listRightsBoard();
}

export function resetOrgBoard() {
  rightsPins = { ...DEFAULT_PINS };
  seeded = seedRows();
  rows = seeded.rows;
  nextId = seeded.nextId;
  logId = 2;
  logs = [
    {
      id: 1,
      at: "2026-09-09 13:00:00",
      actor: "组织中心",
      action: "预置",
      detail: "从花名册试点店铺生成演示行，标演示。智能体只读。"
    }
  ];
}

export function listTeams() {
  return ["沈子晗组", "精铺组 韩梦凯"];
}

export function summarizeOrg(actor) {
  const stores = listOrgStores({}, actor);
  return {
    total: stores.length,
    operating: stores.filter((row) => row.statusKey === "operating").length,
    idle: stores.filter((row) => row.statusKey === "idle").length,
    closing: stores.filter((row) => row.statusKey === "closing").length,
    closed: stores.filter((row) => row.statusKey === "closed").length,
    missingStoreId: stores.filter((row) => !String(row.storeId || "").trim()).length,
    missingMerchant: stores.filter((row) => !String(row.merchantId || "").trim()).length,
    missingLogin: stores.filter((row) => !String(row.login || "").trim()).length,
    missingPassword: stores.filter((row) => !String(row.password || "").trim()).length,
    missingOwner: stores.filter((row) => !String(row.owner || "").trim()).length
  };
}

export function listOrgStores(query = {}, actor) {
  const team = typeof query.team === "string" ? query.team.trim() : "";
  const status = typeof query.status === "string" ? query.status.trim() : "";
  const q = typeof query.q === "string" ? query.q.trim().toLowerCase() : "";
  const scope = scopeOf(actor);
  return rows
    .filter((row) => rowMatchesScope(row, scope))
    .filter((row) => (team ? row.team === team : true))
    .filter((row) => (status ? row.statusKey === status : true))
    .filter((row) => {
      if (!q) {
        return true;
      }
      const blob = [row.storeName, row.storeId, row.merchantId, row.owner, row.lead, row.chief, row.login]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    })
    .map((row) => ({ ...clone(row), canEdit: canEditStore(actor, row) }));
}

export function listOrgLogs() {
  return logs.map((item) => ({ ...item }));
}

function normalize(input, previous = {}) {
  const remark = typeof input.remark === "string" ? input.remark.trim() : previous.remark || "运营中";
  let statusKey = typeof input.statusKey === "string" ? input.statusKey.trim() : previous.statusKey || "operating";
  if (remark.includes("已退")) {
    statusKey = "closed";
  } else if (remark.includes("退店")) {
    statusKey = "closing";
  } else if (remark.includes("闲置")) {
    statusKey = "idle";
  } else if (remark.includes("运营") || remark.includes("在做") || remark.includes("正常")) {
    statusKey = "operating";
  }
  const chief = typeof input.chief === "string" ? input.chief.trim() : previous.chief || "";
  const team = typeof input.team === "string" && input.team.trim() ? input.team.trim() : chief;
  return {
    team,
    chief,
    lead: typeof input.lead === "string" ? input.lead.trim() : previous.lead || "",
    owner: typeof input.owner === "string" ? input.owner.trim() : previous.owner || "",
    storeName: typeof input.storeName === "string" ? input.storeName.trim() : previous.storeName || "",
    storeId: typeof input.storeId === "string" ? input.storeId.trim() : previous.storeId || "",
    merchantId: typeof input.merchantId === "string" ? input.merchantId.trim() : previous.merchantId || "",
    remark: remark || STATUSES[statusKey] || "运营中",
    statusKey,
    updatedOn: typeof input.updatedOn === "string" ? input.updatedOn.trim() : previous.updatedOn || "",
    closedOn: typeof input.closedOn === "string" ? input.closedOn.trim() : previous.closedOn || "",
    login: typeof input.login === "string" ? input.login.trim() : previous.login || "",
    password: typeof input.password === "string" ? input.password.trim() : previous.password || ""
  };
}

export const STORE_IMPORT_HEADERS = [
  "总负责人",
  "小组负责人",
  "店铺所属人员",
  "店铺名称",
  "店铺ID",
  "商家id",
  "店铺情况备注",
  "更新时间",
  "退店时间",
  "登录主账号",
  "密码"
];

const HEADER_TO_FIELD = {
  总负责人: "chief",
  小组负责人: "lead",
  店铺所属人员: "owner",
  店铺名称: "storeName",
  店铺ID: "storeId",
  店铺id: "storeId",
  商家id: "merchantId",
  商家ID: "merchantId",
  店铺情况备注: "remark",
  更新时间: "updatedOn",
  退店时间: "closedOn",
  登录主账号: "login",
  密码: "password"
};

function findExistingStore(input) {
  const storeId = String(input.storeId || "").trim();
  if (storeId) {
    const byStoreId = rows.find((row) => String(row.storeId || "").trim() === storeId);
    if (byStoreId) {
      return byStoreId;
    }
  }
  const merchantId = String(input.merchantId || "").trim();
  if (merchantId) {
    const byMerchant = rows.find((row) => String(row.merchantId || "").trim() === merchantId);
    if (byMerchant) {
      return byMerchant;
    }
  }
  const storeName = String(input.storeName || "").trim();
  const owner = String(input.owner || "").trim();
  if (!storeName || !owner) {
    return null;
  }
  return (
    rows.find(
      (row) => String(row.storeName || "").trim() === storeName && String(row.owner || "").trim() === owner
    ) || null
  );
}

export function mapImportRow(raw = {}) {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const next = {};
  for (const [key, value] of Object.entries(raw)) {
    const field = HEADER_TO_FIELD[String(key).trim()] || (["chief", "lead", "owner", "storeName", "storeId", "merchantId", "remark", "updatedOn", "closedOn", "login", "password"].includes(key) ? key : "");
    if (field) {
      next[field] = value;
    }
  }
  return next;
}

export function importOrgStores(items, actor) {
  const list = Array.isArray(items) ? items : [];
  const created = [];
  const updated = [];
  const failed = [];
  list.forEach((raw, index) => {
    const input = mapImportRow(raw);
    const line = index + 2;
    if (!String(input.storeName || "").trim() || !String(input.owner || "").trim()) {
      failed.push({ line, error: "店铺名称、店铺所属人员为必填" });
      return;
    }
    const existing = findExistingStore(input);
    const result = existing ? patchOrgStore(existing.id, input, actor) : createOrgStore(input, actor);
    if (!result.ok) {
      failed.push({ line, error: result.error || "导入失败", storeName: input.storeName });
      return;
    }
    if (existing) {
      updated.push(result.store);
    } else {
      created.push(result.store);
    }
  });
  addLog("导入", `新增${created.length}条，更新${updated.length}条，失败${failed.length}条`);
  return {
    ok: true,
    created: created.length,
    updated: updated.length,
    failed,
    stores: [...created, ...updated]
  };
}

export function createOrgStore(input, actor) {
  const next = normalize(input || {});
  if (!next.storeName || !next.owner) {
    return { ok: false, statusCode: 400, error: "店铺名称、店铺所属人员为必填" };
  }
  const allowed = assertCanWrite(actor, next);
  if (!allowed.ok) {
    return allowed;
  }
  const row = { id: nextId++, demo: false, ...next };
  rows.push(row);
  addLog("新增", row.storeName + " / " + row.owner);
  return { ok: true, store: { ...clone(row), canEdit: true } };
}

export function patchOrgStore(id, input, actor) {
  const found = rows.find((row) => row.id === Number(id));
  if (!found) {
    return { ok: false, statusCode: 404, error: "店铺行不存在" };
  }
  const next = normalize(input || {}, found);
  const allowed = assertCanWrite(actor, found, next);
  if (!allowed.ok) {
    return allowed;
  }
  Object.assign(found, next);
  addLog("修改", found.storeName + " / " + found.owner);
  return { ok: true, store: { ...clone(found), canEdit: true } };
}

export function removeOrgStore(id, actor) {
  const index = rows.findIndex((row) => row.id === Number(id));
  if (index < 0) {
    return { ok: false, statusCode: 404, error: "店铺行不存在" };
  }
  const allowed = assertCanWrite(actor, rows[index]);
  if (!allowed.ok) {
    return allowed;
  }
  const [removed] = rows.splice(index, 1);
  addLog("移除", removed.storeName);
  return { ok: true, store: clone(removed) };
}
