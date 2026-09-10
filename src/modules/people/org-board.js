import { assertCanWrite, canEditStore, rowMatchesScope, scopeOf } from "./org-acl.js";

const STATUSES = {
  operating: "5倍在做",
  idle: "5倍闲置可退店",
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
      merchantId,
      remark: "5倍在做",
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
      merchantId,
      remark: "5倍在做",
      statusKey: "operating",
      updatedOn: "8.12更新",
      closedOn: "",
      login: "jingdong" + merchantId.slice(-3),
      password: "Demo123!",
      demo: true
    });
  }
  rows[rows.length - 1].remark = "5倍闲置可退店";
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

export function resetOrgBoard() {
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
    closed: stores.filter((row) => row.statusKey === "closed").length,
    missingMerchant: stores.filter((row) => !String(row.merchantId || "").trim()).length,
    missingLogin: stores.filter((row) => !String(row.login || "").trim()).length
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
      const blob = [row.storeName, row.merchantId, row.owner, row.lead, row.chief, row.login]
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
  const remark = typeof input.remark === "string" ? input.remark.trim() : previous.remark || "5倍在做";
  let statusKey = typeof input.statusKey === "string" ? input.statusKey.trim() : previous.statusKey || "operating";
  if (remark.includes("已退") || remark === "退店") {
    statusKey = "closed";
  } else if (remark.includes("闲置")) {
    statusKey = "idle";
  } else if (remark.includes("在做") || remark.includes("正常")) {
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
    merchantId: typeof input.merchantId === "string" ? input.merchantId.trim() : previous.merchantId || "",
    remark: remark || STATUSES[statusKey] || "5倍在做",
    statusKey,
    updatedOn: typeof input.updatedOn === "string" ? input.updatedOn.trim() : previous.updatedOn || "",
    closedOn: typeof input.closedOn === "string" ? input.closedOn.trim() : previous.closedOn || "",
    login: typeof input.login === "string" ? input.login.trim() : previous.login || "",
    password: typeof input.password === "string" ? input.password.trim() : previous.password || ""
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
