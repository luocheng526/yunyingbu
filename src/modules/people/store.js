export const CENTERS = [
  "沈子晗运营中心",
  "韩梦凯运营中心",
  "数据中心",
  "版本发布中心",
  "个人中心",
  "其他",
  "人员管理"
];

export const POSTS = ["店长", "运营", "主管", "经理"];
export const SHOP_KINDS = ["店铺", "店群"];
export const INITIAL_PASSWORD = "ChangeMe123!";

function withLogin(person) {
  const name = String(person.name || "").trim();
  const username = String(person.username || name).trim() || name;
  const password = String(person.password || INITIAL_PASSWORD).trim() || INITIAL_PASSWORD;
  return { ...person, username, password };
}

const STATUSES = new Set(["在职", "离职"]);

const PEOPLE_SEED = [
  { id: 1, name: "沈子晗", role: "经理", center: "沈子晗运营中心", status: "在职", demo: true, employeeNo: "SZ001", department: "沈子晗运营中心", managerId: null },
  { id: 2, name: "韩梦凯", role: "经理", center: "韩梦凯运营中心", status: "在职", demo: true, employeeNo: "HK001", department: "韩梦凯运营中心", managerId: null },
  { id: 3, name: "管理员", role: "经理", center: "人员管理", status: "在职", demo: true, employeeNo: "XM001", department: "人员管理", managerId: null },
  { id: 4, name: "张文静", role: "运营", center: "沈子晗运营中心", status: "在职", demo: true, employeeNo: "SZ002", department: "沈子晗运营中心", managerId: 1 },
  { id: 5, name: "陈明婧", role: "运营", center: "沈子晗运营中心", status: "在职", demo: true, employeeNo: "SZ003", department: "沈子晗运营中心", managerId: 1 },
  { id: 6, name: "郭桂良", role: "运营", center: "沈子晗运营中心", status: "在职", demo: true, employeeNo: "SZ004", department: "沈子晗运营中心", managerId: 1 },
  { id: 7, name: "王博", role: "运营", center: "沈子晗运营中心", status: "在职", demo: true, employeeNo: "SZ005", department: "沈子晗运营中心", managerId: 1 },
  { id: 8, name: "杨润泽", role: "主管", center: "沈子晗运营中心", status: "在职", demo: true, employeeNo: "SZ006", department: "沈子晗运营中心", managerId: 1 },
  { id: 9, name: "崔安琪", role: "运营", center: "沈子晗运营中心", status: "在职", demo: true, employeeNo: "SZ007", department: "沈子晗运营中心", managerId: 8 },
  { id: 10, name: "郭哲宁", role: "运营", center: "沈子晗运营中心", status: "在职", demo: true, employeeNo: "SZ008", department: "沈子晗运营中心", managerId: 8 },
  { id: 11, name: "高丽男", role: "运营", center: "沈子晗运营中心", status: "在职", demo: true, employeeNo: "SZ009", department: "沈子晗运营中心", managerId: 1 },
  { id: 12, name: "栗静萱", role: "运营", center: "沈子晗运营中心", status: "在职", demo: true, employeeNo: "SZ010", department: "沈子晗运营中心", managerId: 1 },
  { id: 13, name: "杨禄", role: "运营", center: "沈子晗运营中心", status: "在职", demo: true, employeeNo: "SZ011", department: "沈子晗运营中心", managerId: 1 },
  { id: 14, name: "张鹏", role: "运营", center: "沈子晗运营中心", status: "在职", demo: true, employeeNo: "SZ012", department: "沈子晗运营中心", managerId: 1 },
  { id: 15, name: "王梓萱", role: "运营", center: "沈子晗运营中心", status: "在职", demo: true, employeeNo: "SZ013", department: "沈子晗运营中心", managerId: 1 },
  { id: 16, name: "秦怡硕", role: "运营", center: "沈子晗运营中心", status: "在职", demo: true, employeeNo: "SZ014", department: "沈子晗运营中心", managerId: 1 }
];

const SHOP_SEED = [
  { id: 1, name: "RASW家居旗舰店", kind: "店铺", pack: "沈子晗包", bundle: "", demo: true },
  { id: 2, name: "RASW生活电器旗舰店", kind: "店铺", pack: "沈子晗包", bundle: "", demo: true },
  { id: 3, name: "RASW健康电器旗舰店", kind: "店铺", pack: "沈子晗包", bundle: "", demo: true },
  { id: 4, name: "飒望居家旗舰店", kind: "店铺", pack: "沈子晗包", bundle: "", demo: true },
  { id: 5, name: "SAWAAG居家布艺旗舰店", kind: "店铺", pack: "沈子晗包", bundle: "", demo: true },
  { id: 6, name: "RASW居家旗舰店", kind: "店铺", pack: "沈子晗包", bundle: "杨润泽包", demo: true },
  { id: 7, name: "飒望家居日用旗舰店", kind: "店铺", pack: "沈子晗包", bundle: "杨润泽包", demo: true },
  { id: 8, name: "飒望旗舰店", kind: "店铺", pack: "沈子晗包", bundle: "杨润泽包", demo: true },
  { id: 9, name: "RASW潮流生活旗舰店", kind: "店铺", pack: "沈子晗包", bundle: "杨润泽包", demo: true },
  { id: 10, name: "HYEGIIR健康器械旗舰店", kind: "店铺", pack: "沈子晗包", bundle: "", demo: true },
  { id: 11, name: "DIKTT个护健康旗舰店", kind: "店铺", pack: "沈子晗包", bundle: "", demo: true },
  { id: 12, name: "HYEGIIR医疗保健旗舰店", kind: "店铺", pack: "沈子晗包", bundle: "", demo: true },
  { id: 13, name: "HYEGIIR养生器械旗舰店", kind: "店铺", pack: "沈子晗包", bundle: "", demo: true },
  { id: 14, name: "MGXEK旗舰店", kind: "店铺", pack: "沈子晗包", bundle: "", demo: true },
  { id: 15, name: "SAWAAG生活日用旗舰店", kind: "店铺", pack: "沈子晗包", bundle: "", demo: true },
  { id: 16, name: "沈子晗包", kind: "店群", pack: "沈子晗包", bundle: "", demo: true },
  { id: 17, name: "杨润泽包", kind: "店群", pack: "杨润泽包", bundle: "", demo: true }
];

const GRANT_SEED = [
  { id: 1, personId: 1, shopId: 16, role: "经理", startOn: "2026-01-01", endOn: "", revoked: false },
  { id: 2, personId: 8, shopId: 17, role: "主管", startOn: "2026-01-01", endOn: "", revoked: false },
  { id: 3, personId: 4, shopId: 1, role: "运营", startOn: "2026-01-01", endOn: "", revoked: false },
  { id: 4, personId: 5, shopId: 2, role: "运营", startOn: "2026-01-01", endOn: "", revoked: false },
  { id: 5, personId: 6, shopId: 3, role: "运营", startOn: "2026-01-01", endOn: "", revoked: false },
  { id: 6, personId: 7, shopId: 4, role: "运营", startOn: "2026-01-01", endOn: "", revoked: false },
  { id: 7, personId: 7, shopId: 5, role: "运营", startOn: "2026-01-01", endOn: "", revoked: false },
  { id: 8, personId: 8, shopId: 6, role: "主管", startOn: "2026-01-01", endOn: "", revoked: false },
  { id: 9, personId: 9, shopId: 7, role: "运营", startOn: "2026-01-01", endOn: "", revoked: false },
  { id: 10, personId: 8, shopId: 8, role: "主管", startOn: "2026-01-01", endOn: "", revoked: false },
  { id: 11, personId: 8, shopId: 9, role: "主管", startOn: "2026-01-01", endOn: "", revoked: false },
  { id: 12, personId: 10, shopId: 9, role: "运营", startOn: "2026-01-01", endOn: "", revoked: false },
  { id: 13, personId: 11, shopId: 10, role: "运营", startOn: "2026-01-01", endOn: "", revoked: false },
  { id: 14, personId: 12, shopId: 11, role: "运营", startOn: "2026-01-01", endOn: "", revoked: false },
  { id: 15, personId: 13, shopId: 12, role: "运营", startOn: "2026-01-01", endOn: "", revoked: false },
  { id: 16, personId: 14, shopId: 13, role: "运营", startOn: "2026-01-01", endOn: "", revoked: false },
  { id: 17, personId: 15, shopId: 14, role: "运营", startOn: "2026-01-01", endOn: "", revoked: false },
  { id: 18, personId: 16, shopId: 15, role: "运营", startOn: "2026-01-01", endOn: "", revoked: false }
];

function clone(row) {
  return { ...row };
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

let nextPersonId = 17;
let nextShopId = 18;
let nextGrantId = 19;
let people = PEOPLE_SEED.map(clone);
let shops = SHOP_SEED.map(clone);
let grants = GRANT_SEED.map(clone);

export function resetPeopleStore() {
  nextPersonId = 17;
  nextShopId = 18;
  nextGrantId = 19;
  people = PEOPLE_SEED.map(clone);
  shops = SHOP_SEED.map(clone);
  grants = GRANT_SEED.map(clone);
}

function findPerson(id) {
  return people.find((row) => row.id === Number(id));
}

function findShop(id) {
  return shops.find((row) => row.id === Number(id));
}

function managerNameOf(person) {
  if (!person.managerId) {
    return "";
  }
  const manager = findPerson(person.managerId);
  return manager ? manager.name : "";
}

function grantActive(grant, person) {
  if (grant.revoked) {
    return false;
  }
  if (person && person.status === "离职") {
    return false;
  }
  if (grant.endOn && grant.endOn < today()) {
    return false;
  }
  return true;
}

function expandShopNames(shop) {
  if (!shop) {
    return [];
  }
  if (shop.kind !== "店群") {
    return [shop.name];
  }
  return shops
    .filter((row) => row.kind === "店铺" && (row.pack === shop.name || row.bundle === shop.name))
    .map((row) => row.name);
}

function visibleShopsOf(person) {
  const names = [];
  for (const grant of grants) {
    if (grant.personId !== person.id || !grantActive(grant, person)) {
      continue;
    }
    for (const name of expandShopNames(findShop(grant.shopId))) {
      if (!names.includes(name)) {
        names.push(name);
      }
    }
  }
  return names;
}

function presentPerson(person) {
  const row = withLogin(person);
  return {
    ...clone(row),
    managerName: managerNameOf(person),
    visibleShops: visibleShopsOf(person)
  };
}

function presentGrant(grant) {
  const person = findPerson(grant.personId);
  const shop = findShop(grant.shopId);
  return {
    ...clone(grant),
    personName: person ? person.name : "",
    shopName: shop ? shop.name : "",
    active: grantActive(grant, person)
  };
}

export function listPeople() {
  return people.map(presentPerson);
}

export function listShops() {
  return shops.map(clone);
}

export function listGrants() {
  return grants.map(presentGrant);
}

export function reconcilePeople() {
  const employedNoGrant = listPeople()
    .filter((person) => person.status === "在职" && person.visibleShops.length === 0)
    .map((person) => ({ id: person.id, name: person.name }));
  const grantOnLeft = listGrants()
    .filter((grant) => {
      const person = findPerson(grant.personId);
      return person && person.status === "离职" && !grant.revoked;
    })
    .map((grant) => ({
      personName: grant.personName,
      shopName: grant.shopName
    }));
  return { employedNoGrant, grantOnLeft };
}

export function createPerson(input) {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const role = typeof input.role === "string" ? input.role.trim() : "";
  const center = typeof input.center === "string" ? input.center.trim() : "";
  const statusRaw = typeof input.status === "string" ? input.status.trim() : "在职";
  const status = statusRaw || "在职";
  const employeeNo = typeof input.employeeNo === "string" ? input.employeeNo.trim() : "";
  const department = typeof input.department === "string" ? input.department.trim() : center;
  const managerRaw = input.managerId;
  const managerId = managerRaw === "" || managerRaw == null ? null : Number(managerRaw);

  if (!name || !role || !center) {
    return { ok: false, statusCode: 400, error: "姓名、角色、所属中心均为必填" };
  }
  if (!CENTERS.includes(center)) {
    return { ok: false, statusCode: 400, error: "所属中心不在可选列表中" };
  }
  if (!STATUSES.has(status)) {
    return { ok: false, statusCode: 400, error: "状态仅支持在职或离职" };
  }
  if (managerId != null && !findPerson(managerId)) {
    return { ok: false, statusCode: 400, error: "上级不存在" };
  }

  const usernameRaw = typeof input.username === "string" ? input.username.trim() : "";
  const passwordRaw = typeof input.password === "string" ? input.password.trim() : "";
  const person = {
    id: nextPersonId++,
    name,
    role,
    center,
    status,
    demo: false,
    employeeNo,
    department,
    managerId,
    username: usernameRaw || name,
    password: passwordRaw || INITIAL_PASSWORD
  };
  people.push(person);
  return { ok: true, person: presentPerson(person) };
}

export function patchPerson(id, input) {
  const found = findPerson(id);
  if (!found) {
    return { ok: false, statusCode: 404, error: "人员不存在" };
  }
  if (typeof input.status === "string" && input.status.trim()) {
    const status = input.status.trim();
    if (!STATUSES.has(status)) {
      return { ok: false, statusCode: 400, error: "状态仅支持在职或离职" };
    }
    found.status = status;
    if (status === "离职") {
      const endOn = today();
      for (const grant of grants) {
        if (grant.personId === found.id && !grant.endOn) {
          grant.endOn = endOn;
        }
      }
    }
  }
  if (Object.prototype.hasOwnProperty.call(input, "username")) {
    const username = typeof input.username === "string" ? input.username.trim() : "";
    if (!username) {
      return { ok: false, statusCode: 400, error: "账号不能为空" };
    }
    const taken = people.some(
      (row) => row.id !== found.id && String(row.username || row.name).trim() === username
    );
    if (taken) {
      return { ok: false, statusCode: 400, error: "账号已被占用" };
    }
    found.username = username;
  }
  if (Object.prototype.hasOwnProperty.call(input, "password")) {
    const password = typeof input.password === "string" ? input.password.trim() : "";
    if (!password) {
      return { ok: false, statusCode: 400, error: "密码不能为空" };
    }
    found.password = password;
  }
  return { ok: true, person: presentPerson(found) };
}

export function createShop(input) {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const kind = typeof input.kind === "string" ? input.kind.trim() : "店铺";
  const pack = typeof input.pack === "string" ? input.pack.trim() : "";
  const bundle = typeof input.bundle === "string" ? input.bundle.trim() : "";
  if (!name) {
    return { ok: false, statusCode: 400, error: "店铺名称为必填" };
  }
  if (!SHOP_KINDS.includes(kind)) {
    return { ok: false, statusCode: 400, error: "类型仅支持店铺或店群" };
  }
  const shop = { id: nextShopId++, name, kind, pack, bundle, demo: false };
  shops.push(shop);
  return { ok: true, shop: clone(shop) };
}

export function createGrant(input) {
  const person = findPerson(input.personId);
  const shop = findShop(input.shopId);
  const role = typeof input.role === "string" ? input.role.trim() : "运营";
  if (!person || !shop) {
    return { ok: false, statusCode: 400, error: "人员和店铺均为必填" };
  }
  const grant = {
    id: nextGrantId++,
    personId: person.id,
    shopId: shop.id,
    role: role || "运营",
    startOn: typeof input.startOn === "string" ? input.startOn : "",
    endOn: typeof input.endOn === "string" ? input.endOn : "",
    revoked: false
  };
  grants.push(grant);
  return { ok: true, grant: presentGrant(grant) };
}

function personFromMysqlRow(row) {
  return {
    id: Number(row.id),
    name: row.name,
    role: row.role,
    center: row.center,
    status: row.status,
    demo: Boolean(row.demo),
    employeeNo: row.employee_no || "",
    department: row.department || "",
    managerId: row.manager_id == null ? null : Number(row.manager_id),
    username: row.username || row.name,
    password: row.password || INITIAL_PASSWORD
  };
}

function shopFromMysqlRow(row) {
  return {
    id: Number(row.id),
    name: row.name,
    kind: row.kind,
    pack: row.pack || "",
    bundle: row.bundle || "",
    demo: Boolean(row.demo)
  };
}

function grantFromMysqlRow(row) {
  return {
    id: Number(row.id),
    personId: Number(row.person_id),
    shopId: Number(row.shop_id),
    role: row.role,
    startOn: row.start_on || "",
    endOn: row.end_on || "",
    revoked: Boolean(row.revoked)
  };
}

/**
 * notes-store.js 启动时会 import 这个名字。缺导出则闸门试载失败并回滚。
 * 本仓库没有 profile/auth 时保持内存花名册；线上有 MySQL 时灌入 people / people_shops / people_grants。
 */
export async function hydrateFromMysql() {
  try {
    const auth = await import("../profile/auth.js");
    if (typeof auth.dbMode !== "function" || auth.dbMode() !== "mysql" || typeof auth.query !== "function") {
      return { ok: true, mode: "memory" };
    }
    const { query } = auth;
    const [personRows] = await query(
      "SELECT id, name, role, center, status, demo, employee_no, department, manager_id FROM people ORDER BY id ASC"
    );
    const [shopRows] = await query("SELECT id, name, kind, pack, bundle, demo FROM people_shops ORDER BY id ASC");
    const [grantRows] = await query(
      "SELECT id, person_id, shop_id, role, start_on, end_on, revoked FROM people_grants ORDER BY id ASC"
    );
    if (personRows && personRows.length) {
      people = personRows.map(personFromMysqlRow);
      nextPersonId = people.reduce((max, row) => Math.max(max, row.id), 0) + 1;
    }
    if (shopRows && shopRows.length) {
      shops = shopRows.map(shopFromMysqlRow);
      nextShopId = shops.reduce((max, row) => Math.max(max, row.id), 0) + 1;
    }
    if (grantRows && grantRows.length) {
      grants = grantRows.map(grantFromMysqlRow);
      nextGrantId = grants.reduce((max, row) => Math.max(max, row.id), 0) + 1;
    }
    return { ok: true, mode: "mysql", people: people.length, shops: shops.length, grants: grants.length };
  } catch {
    return { ok: true, mode: "memory" };
  }
}
