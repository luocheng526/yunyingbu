import { assertCanImportRow, assertCanWrite, canEditStore, groupIdOf, normalizeGroupId, rowMatchesScope, scopeOf } from "./org-acl.js";
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

function inferManagerName(...parts) {
  const blob = parts.map((item) => String(item || "")).join(" ");
  if (blob.includes("韩梦凯")) {
    return "韩梦凯";
  }
  if (blob.includes("沈子晗")) {
    return "沈子晗";
  }
  return "";
}

function teamLabelOf(manager) {
  if (String(manager).includes("韩梦凯")) {
    return "精铺组 韩梦凯";
  }
  if (String(manager).includes("沈子晗")) {
    return "沈子晗组";
  }
  return String(manager || "").trim();
}

function rosterRoleOf(name) {
  if (name === "罗成") {
    return "总监";
  }
  if (name === "沈子晗" || name === "韩梦凯") {
    return "经理";
  }
  const hit = listPeople().find((row) => row.name === name);
  return hit ? String(hit.role || "") : "";
}

function syncStoreRoles(input = {}, previous = {}) {
  const take = (key) => {
    if (typeof input[key] === "string") {
      return input[key].trim();
    }
    return String(previous[key] || "").trim();
  };
  const director = take("director") || "罗成";
  const manager = take("manager") || inferManagerName(take("chief"), take("lead"), take("owner"), take("operator"), previous.team);
  const lead = take("lead");
  let supervisor = take("supervisor");
  let operator = take("operator") || take("owner");
  let assistant = take("assistant");
  if (!supervisor && lead && lead !== manager && lead !== director) {
    const role = rosterRoleOf(lead);
    if (role === "主管" || role === "储备") {
      supervisor = lead;
    } else if (role === "助理" && !assistant) {
      assistant = lead;
    } else if (!role && lead !== operator) {
      supervisor = lead;
    }
  }
  const team = teamLabelOf(manager) || take("team") || take("chief");
  const next = {
    director,
    manager,
    supervisor,
    operator,
    assistant,
    team,
    chief: team,
    lead: supervisor || lead || manager,
    owner: operator,
    groupId: normalizeGroupId(take("groupId"))
  };
  next.groupId = next.groupId || groupIdOf(next);
  return next;
}

export function importStamp(now = new Date()) {
  return now.getMonth() + 1 + "." + now.getDate() + "更新";
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
    const roles = syncStoreRoles({ chief: "沈子晗组", lead, owner, manager: "沈子晗", director: "罗成" });
    rows.push({
      id: id++,
      ...roles,
      groupId: groupIdOf(roles),
      shopId: "",
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
    const roles = syncStoreRoles({ chief: "精铺组 韩梦凯", lead, owner, manager: "韩梦凯", director: "罗成" });
    rows.push({
      id: id++,
      ...roles,
      groupId: groupIdOf(roles),
      shopId: "",
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
  [row.director, row.manager, row.supervisor, row.operator, row.assistant, row.lead, row.owner].forEach((value) => {
    const name = String(value || "").trim();
    if (name) {
      names.push(name);
    }
  });
  const chief = String(row.chief || row.team || row.manager || "");
  if (chief.includes("沈子晗")) {
    names.push("沈子晗");
  }
  if (chief.includes("韩梦凯")) {
    names.push("韩梦凯");
  }
  if (chief.includes("罗成") || String(row.director || "").includes("罗成")) {
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

function roleOfName(name, byName) {
  return rightsPins[name] || mapBoardRole(byName[name] && byName[name].role) || "运营";
}

function managerBranchOfStore(row) {
  const blob = [row.chief, row.team, row.lead, row.owner, row.manager, row.director, row.supervisor, row.operator].join(" ");
  if (blob.includes("韩梦凯")) {
    return "韩梦凯";
  }
  if (blob.includes("沈子晗")) {
    return "沈子晗";
  }
  if (blob.includes("罗成")) {
    return "罗成";
  }
  return "";
}

function branchOfPerson(name, person, stores) {
  if (name === "韩梦凯" || name === "沈子晗" || name === "罗成") {
    return name;
  }
  const blob = [person && person.center, person && person.department].join(" ");
  if (blob.includes("韩梦凯")) {
    return "韩梦凯";
  }
  if (blob.includes("沈子晗")) {
    return "沈子晗";
  }
  const hit = stores.find((row) => namesFromStore(row).includes(name));
  return hit ? managerBranchOfStore(hit) : "";
}

function makeNode(name, role, extra = {}) {
  return {
    name,
    role,
    id: extra.id || null,
    synthetic: Boolean(extra.synthetic),
    children: [],
    stores: []
  };
}

function attachChild(parent, child) {
  if (!parent || !child || parent === child) {
    return;
  }
  if (!parent.children.includes(child)) {
    parent.children.push(child);
  }
}

function sortTree(node) {
  const rank = { 主管: 1, 储备: 2, 运营: 3, 助理: 4, 店长: 5 };
  node.children.sort((a, b) => (rank[a.role] || 9) - (rank[b.role] || 9) || a.name.localeCompare(b.name, "zh"));
  node.stores.sort((a, b) => String(a.storeName).localeCompare(String(b.storeName), "zh"));
  node.children.forEach(sortTree);
}

function countTreePeople(node) {
  if (!node) {
    return 0;
  }
  return (node.synthetic ? 0 : 1) + node.children.reduce((sum, child) => sum + countTreePeople(child), 0);
}

function buildRightsTree(stores, roster, byName) {
  const director = makeNode("罗成", "总监");
  const han = makeNode("韩梦凯", "经理", { id: byName["韩梦凯"] ? byName["韩梦凯"].id : null });
  const shen = makeNode("沈子晗", "经理", { id: byName["沈子晗"] ? byName["沈子晗"].id : null });
  attachChild(director, han);
  attachChild(director, shen);
  const nodes = { 罗成: director, 韩梦凯: han, 沈子晗: shen };
  const branches = { 韩梦凯: han, 沈子晗: shen, 罗成: director };

  function ensure(name) {
    if (nodes[name]) {
      return nodes[name];
    }
    nodes[name] = makeNode(name, roleOfName(name, byName), { id: byName[name] ? byName[name].id : null });
    return nodes[name];
  }

  function place(name, hintBranch) {
    if (name === "罗成" || name === "韩梦凯" || name === "沈子晗") {
      return nodes[name];
    }
    const node = ensure(name);
    const person = byName[name];
    const manager = person && person.managerId ? roster.find((row) => row.id === person.managerId) : null;
    if (manager && manager.name !== name) {
      const parent = ensure(manager.name);
      attachChild(parent, node);
      if (parent.role === "主管" || parent.role === "储备") {
        const branch = branchOfPerson(parent.name, byName[parent.name], stores) || hintBranch || "沈子晗";
        attachChild(branches[branch] || shen, parent);
      }
      return node;
    }
    const branch = hintBranch || branchOfPerson(name, person, stores) || "沈子晗";
    attachChild(branches[branch] || shen, node);
    return node;
  }

  roster.forEach((person) => {
    place(person.name);
  });
  stores.forEach((row) => {
    const branch = managerBranchOfStore(row);
    [row.supervisor, row.operator, row.assistant, row.lead, row.owner].forEach((value) => {
      const name = String(value || "").trim();
      if (name) {
        place(name, branch);
      }
    });
  });

  stores.forEach((row) => {
    const owner = String(row.operator || row.owner || "").trim();
    const lead = String(row.supervisor || row.lead || "").trim();
    const target = (owner && nodes[owner]) || (lead && nodes[lead]) || branches[managerBranchOfStore(row)] || shen;
    target.stores.push({
      id: row.id,
      storeName: row.storeName,
      storeId: row.storeId || "",
      merchantId: row.merchantId || "",
      hanging: !(owner && nodes[owner])
    });
  });

  [han, shen].forEach((mgr) => {
    const leads = mgr.children.filter((child) => child.role === "主管");
    const rest = mgr.children.filter((child) => child.role !== "主管");
    if (!leads.length && rest.length) {
      const group = makeNode(mgr.name + "组", "主管", { synthetic: true });
      rest.forEach((child) => attachChild(group, child));
      mgr.children = [group];
    }
  });

  sortTree(director);
  return director;
}

function buildRightsWatch(stores, roster, byName, tree) {
  const issues = [];
  const rosterNames = new Set(roster.map((row) => row.name));
  rosterNames.add("罗成");
  stores.forEach((row) => {
    [
      ["operator", "运营"],
      ["supervisor", "主管/储备"],
      ["assistant", "助理"],
      ["manager", "经理"]
    ].forEach(([field, label]) => {
      const name = String(row[field] || "").trim();
      if (name && !rosterNames.has(name) && !["罗成", "沈子晗", "韩梦凯"].includes(name)) {
        issues.push({
          kind: "人员对不上",
          level: "warn",
          title: name + " 不在花名册",
          detail: label + "「" + name + "」出现在「" + row.storeName + "」，成员管理没有这个人。"
        });
      }
    });
    if (!String(row.operator || row.owner || "").trim()) {
      issues.push({
        kind: "店铺对不上",
        level: "error",
        title: row.storeName + " 缺运营",
        detail: "店铺主数据没有运营，挂不到树上。"
      });
    }
    if (!managerBranchOfStore(row)) {
      issues.push({
        kind: "店铺对不上",
        level: "warn",
        title: row.storeName + " 对不上经理线",
        detail: "总负责人 / 小组里看不到罗成、沈子晗或韩梦凯。"
      });
    }
    if (!String(row.storeId || "").trim()) {
      issues.push({
        kind: "待补全",
        level: "info",
        title: row.storeName + " 缺店铺ID",
        detail: "店铺主数据还没填店铺ID。"
      });
    }
    if (!String(row.merchantId || "").trim()) {
      issues.push({
        kind: "待补全",
        level: "info",
        title: row.storeName + " 缺商家id",
        detail: "店铺主数据还没填商家id。"
      });
    }
  });
  roster.forEach((person) => {
    const role = roleOfName(person.name, byName);
    if ((role === "运营" || role === "店长" || role === "助理") && storeCountOf(person.name, stores) === 0) {
      issues.push({
        kind: "店铺对不上",
        level: "warn",
        title: person.name + " 名下没有店铺",
        detail: "花名册在职，店铺主数据里不是总负责人、小组负责人或所属人员。"
      });
    }
    if (person.managerId && !roster.some((row) => row.id === person.managerId) && !listPeople().some((row) => row.id === person.managerId)) {
      issues.push({
        kind: "人员对不上",
        level: "warn",
        title: person.name + " 的上级不存在",
        detail: "花名册上级已不在名册里。"
      });
    }
  });
  const seen = new Set();
  const unique = issues.filter((item) => {
    const key = item.kind + item.title;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
  const kinds = [...new Set(unique.map((item) => item.kind))];
  const pending = unique.filter((item) => item.kind !== "待补全").length;
  const fill = unique.filter((item) => item.kind === "待补全").length;
  const departments = new Set(roster.map((row) => String(row.department || row.center || "").trim()).filter(Boolean));
  return {
    checkedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
    conflict: pending > 0,
    kpis: [
      { label: "经理线", value: 2 },
      { label: "在营店铺", value: stores.filter((row) => row.statusKey === "operating").length },
      { label: "部门", value: departments.size },
      { label: "在职员工", value: roster.length + (byName["罗成"] ? 0 : 1) },
      { label: "树上人数", value: countTreePeople(tree) },
      { label: "待处理", value: pending },
      { label: "冲突类型", value: kinds.filter((kind) => kind !== "待补全").length },
      { label: "待补全", value: fill }
    ],
    issues: unique
  };
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
  const tree = buildRightsTree(stores, roster, byName);
  return {
    ok: true,
    roles: RIGHTS_ROLES,
    columns: RIGHTS_ROLES.map((role) => ({ role, people: columns[role] })),
    candidates,
    tree,
    watch: buildRightsWatch(stores, roster, byName, tree)
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
    missingOwner: stores.filter((row) => !String(row.operator || row.owner || "").trim()).length
  };
}

export function listOrgStores(query = {}, actor) {
  const team = typeof query.team === "string" ? query.team.trim() : "";
  const status = typeof query.status === "string" ? query.status.trim() : "";
  const q = typeof query.q === "string" ? query.q.trim().toLowerCase() : "";
  const scope = scopeOf(actor);
  rows.forEach((row) => {
    const roles = syncStoreRoles({}, row);
    ["director", "manager", "supervisor", "operator", "assistant", "groupId"].forEach((key) => {
      if (!String(row[key] || "").trim() && roles[key]) {
        row[key] = roles[key];
      }
    });
    if (!String(row.groupId || "").trim()) {
      row.groupId = groupIdOf(row);
    }
    if (!String(row.shopId || "").trim() && row.storeId) {
      row.shopId = row.storeId;
    }
    if (!String(row.owner || "").trim() && roles.owner) {
      row.owner = roles.owner;
    }
    if (!String(row.chief || "").trim() && roles.chief) {
      row.chief = roles.chief;
      row.team = roles.team;
    }
  });
  return rows
    .filter((row) => rowMatchesScope(row, scope))
    .filter((row) => (team ? row.team === team : true))
    .filter((row) => (status ? row.statusKey === status : true))
    .filter((row) => {
      if (!q) {
        return true;
      }
      const blob = [row.storeName, row.storeId, row.shopId, row.groupId, row.merchantId, row.director, row.manager, row.supervisor, row.operator, row.assistant, row.owner, row.lead, row.chief, row.login]
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
  const roles = syncStoreRoles(input, previous);
  const storeId =
    typeof input.storeId === "string"
      ? input.storeId.trim()
      : typeof input.shopId === "string"
        ? input.shopId.trim()
        : previous.storeId || previous.shopId || "";
  const groupId = roles.groupId || groupIdOf({ ...previous, ...roles, groupId: input.groupId || previous.groupId });
  return {
    ...roles,
    groupId,
    shopId: storeId,
    storeName: typeof input.storeName === "string" ? input.storeName.trim() : previous.storeName || "",
    storeId,
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
  "总监",
  "经理",
  "主管/储备",
  "运营",
  "助理",
  "小组ID",
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
  总监: "director",
  经理: "manager",
  "主管/储备": "supervisor",
  主管: "supervisor",
  储备: "supervisor",
  运营: "operator",
  助理: "assistant",
  总负责人: "chief",
  小组负责人: "lead",
  店铺所属人员: "owner",
  所属人员: "owner",
  店铺名称: "storeName",
  店名: "storeName",
  店铺ID: "storeId",
  店铺id: "storeId",
  店铺编号: "storeId",
  shopId: "storeId",
  小组ID: "groupId",
  小组id: "groupId",
  groupId: "groupId",
  group_id: "groupId",
  商家id: "merchantId",
  商家ID: "merchantId",
  商家Id: "merchantId",
  店铺情况备注: "remark",
  备注: "remark",
  更新时间: "updatedOn",
  退店时间: "closedOn",
  登录主账号: "login",
  主账号: "login",
  密码: "password"
};

function storeIdOf(row) {
  return String(row.storeId || row.shopId || "").trim();
}

function importPool(actor, selectedGroupId = "") {
  const scope = scopeOf(actor);
  const forced = normalizeGroupId(selectedGroupId) || (scope.key === "group" ? scope.groupId : "");
  return rows.filter((row) => {
    if (forced) {
      return groupIdOf(row) === forced;
    }
    return rowMatchesScope(row, scope);
  });
}

function pickUnique(list) {
  if (list.length === 1) {
    return { store: list[0] };
  }
  if (list.length > 1) {
    return { error: "同一店铺ID出现在多个小组，请填写主管/储备或运营后再导" };
  }
  return { store: null };
}

function findExistingStore(input, actor, selectedGroupId = "") {
  const pool = importPool(actor, selectedGroupId);
  const gid =
    normalizeGroupId(selectedGroupId) ||
    (scopeOf(actor).key === "group" ? scopeOf(actor).groupId : "") ||
    groupIdOf(input);
  const useGroup = Boolean(gid) && !["罗成", "沈子晗", "韩梦凯"].includes(gid);
  const storeId = storeIdOf(input);
  if (storeId) {
    if (useGroup) {
      const inGroup = pool.filter((row) => groupIdOf(row) === gid && storeIdOf(row) === storeId);
      if (inGroup.length) {
        return pickUnique(inGroup);
      }
    } else {
      const byId = pool.filter((row) => storeIdOf(row) === storeId);
      if (byId.length) {
        return pickUnique(byId);
      }
    }
  }
  const merchantId = String(input.merchantId || "").trim();
  const storeName = String(input.storeName || "").trim();
  if (merchantId && storeName) {
    const nameMatches = pool.filter((row) => {
      const sameShop =
        String(row.merchantId || "").trim() === merchantId && String(row.storeName || "").trim() === storeName;
      return sameShop && (!useGroup || groupIdOf(row) === gid);
    });
    if (nameMatches.length) {
      return pickUnique(nameMatches);
    }
  }
  return { store: null };
}

function uniqueClash(next, excludeId) {
  const storeId = String(next.storeId || next.shopId || "").trim();
  if (!storeId) {
    return null;
  }
  const gid = groupIdOf(next);
  return (
    rows.find(
      (row) =>
        row.id !== excludeId &&
        groupIdOf(row) === gid &&
        String(row.storeId || row.shopId || "").trim() === storeId
    ) || null
  );
}

export function mapImportRow(raw = {}) {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const next = {};
  for (const [key, value] of Object.entries(raw)) {
    const norm = String(key || "")
      .replace(/^\uFEFF/, "")
      .replace(/\s+/g, "")
      .trim();
    const field =
      HEADER_TO_FIELD[norm] ||
      (["director", "manager", "supervisor", "operator", "assistant", "chief", "lead", "owner", "storeName", "storeId", "shopId", "groupId", "merchantId", "remark", "updatedOn", "closedOn", "login", "password"].includes(norm)
        ? norm
        : "");
    if (field) {
      next[field] = value;
    }
  }
  return next;
}

export function importOrgStores(items, actor, options = {}) {
  const list = Array.isArray(items) ? items : [];
  const selectedGroupId = normalizeGroupId(options.groupId);
  const scope = scopeOf(actor);
  const forcedGroup = scope.key === "group" ? scope.groupId : selectedGroupId;
  const created = [];
  const updated = [];
  const failed = [];
  const stamp = importStamp();
  list.forEach((raw, index) => {
    const mapped = mapImportRow(raw);
    const line = index + 2;
    if (
      scope.key === "group" &&
      !mapped.groupId &&
      !mapped.operator &&
      !mapped.owner &&
      !mapped.supervisor
    ) {
      mapped.groupId = scope.groupId;
      mapped.operator = scope.groupId;
    }
    const input = { ...mapped, updatedOn: stamp };
    const draft = normalize(input);
    if (!String(draft.storeName || "").trim()) {
      failed.push({ line, error: "店铺名称为必填" });
      return;
    }
    if (!String(draft.operator || "").trim() && !storeIdOf(draft) && !String(draft.merchantId || "").trim()) {
      failed.push({ line, error: "店铺名称之外请至少提供店铺ID或商家id+运营" });
      return;
    }
    const allowed = assertCanImportRow(actor, draft, forcedGroup);
    if (!allowed.ok) {
      failed.push({ line, error: allowed.error, storeName: draft.storeName, groupId: draft.groupId });
      return;
    }
    const found = findExistingStore(draft, actor, forcedGroup);
    if (found.error) {
      failed.push({ line, error: found.error, storeName: draft.storeName });
      return;
    }
    const existing = found.store;
    const result = existing ? patchOrgStore(existing.id, input, actor) : createOrgStore(input, actor);
    if (!result.ok) {
      failed.push({ line, error: result.error || "导入失败", storeName: draft.storeName });
      return;
    }
    if (existing) {
      updated.push(result.store);
    } else {
      created.push(result.store);
    }
  });
  addLog("导入", `本组新增${created.length}条，更新${updated.length}条，失败${failed.length}条`);
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
  if (!next.storeName || !next.operator) {
    return { ok: false, statusCode: 400, error: "店铺名称、运营为必填" };
  }
  const allowed = assertCanWrite(actor, next);
  if (!allowed.ok) {
    return allowed;
  }
  if (uniqueClash(next)) {
    return { ok: false, statusCode: 409, error: "本组已有相同店铺ID，请改为更新原记录" };
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
  if (uniqueClash(next, found.id)) {
    return { ok: false, statusCode: 409, error: "本组已有相同店铺ID，不能改成重复店铺" };
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
