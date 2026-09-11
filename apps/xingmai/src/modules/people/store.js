import {
  dbMode,
  disableLogin,
  disableLoginByPersonId,
  loginStateForPerson,
  provisionLogin,
  query,
  STAFF_INITIAL_PASSWORD,
  syncRosterLogins
} from "../profile/auth.js";

export const CENTERS = [
  "沈子晗运营中心",
  "韩梦凯运营中心",
  "数据中心",
  "版本发布中心",
  "个人中心",
  "其他"
];

export const POSTS = ["店长", "运营", "主管", "经理"];
export const SHOP_KINDS = ["店铺", "店群"];
const STATUSES = new Set(["在职", "离职"]);
const ROLE_ALIASES = { 管理: "经理" };

const PEOPLE_SELECT =
  "SELECT id, name, role, center, status, demo, employee_no, department, manager_id FROM people ORDER BY id ASC";
const SHOP_SELECT = "SELECT id, name, kind, pack, bundle, demo FROM people_shops ORDER BY id ASC";
const GRANT_SELECT =
  "SELECT id, person_id, shop_id, role, start_on, end_on, revoked FROM people_grants ORDER BY id ASC";

function todayShanghai() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
}

function normalizeRole(raw) {
  const role = typeof raw === "string" ? raw.trim() : "";
  return ROLE_ALIASES[role] || role;
}

function clonePerson(person) {
  return {
    ...person,
    id: Number(person.id),
    managerId: person.managerId == null || person.managerId === "" ? null : Number(person.managerId),
    demo: Boolean(person.demo)
  };
}

function cloneShop(shop) {
  return { ...shop, id: Number(shop.id), demo: Boolean(shop.demo) };
}

function cloneGrant(grant) {
  return {
    ...grant,
    id: Number(grant.id),
    personId: Number(grant.personId),
    shopId: Number(grant.shopId),
    revoked: Boolean(grant.revoked)
  };
}

function personFromRow(row) {
  return {
    id: Number(row.id),
    name: row.name,
    role: row.role,
    center: row.center,
    status: row.status,
    demo: Boolean(row.demo),
    employeeNo: row.employee_no == null ? "" : String(row.employee_no),
    department: row.department == null ? "" : String(row.department),
    managerId: row.manager_id == null || row.manager_id === "" ? null : Number(row.manager_id)
  };
}

function shopFromRow(row) {
  return {
    id: Number(row.id),
    name: row.name,
    kind: row.kind,
    pack: row.pack || "",
    bundle: row.bundle || "",
    demo: Boolean(row.demo)
  };
}

function grantFromRow(row) {
  return {
    id: Number(row.id),
    personId: Number(row.person_id),
    shopId: Number(row.shop_id),
    role: row.role,
    startOn: row.start_on || "",
    endOn: row.end_on || "",
    revoked: Boolean(Number(row.revoked))
  };
}

function seedPeople() {
  return [
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
}

function seedShops() {
  const stores = [
    ["RASW家居旗舰店", "沈子晗包", ""],
    ["RASW生活电器旗舰店", "沈子晗包", ""],
    ["RASW健康电器旗舰店", "沈子晗包", ""],
    ["飒望居家旗舰店", "沈子晗包", ""],
    ["SAWAAG居家布艺旗舰店", "沈子晗包", ""],
    ["RASW居家旗舰店", "沈子晗包", "杨润泽包"],
    ["飒望家居日用旗舰店", "沈子晗包", "杨润泽包"],
    ["飒望旗舰店", "沈子晗包", "杨润泽包"],
    ["RASW潮流生活旗舰店", "沈子晗包", "杨润泽包"],
    ["HYEGIIR健康器械旗舰店", "沈子晗包", ""],
    ["DIKTT个护健康旗舰店", "沈子晗包", ""],
    ["HYEGIIR医疗保健旗舰店", "沈子晗包", ""],
    ["HYEGIIR养生器械旗舰店", "沈子晗包", ""],
    ["MGXEK旗舰店", "沈子晗包", ""],
    ["SAWAAG生活日用旗舰店", "沈子晗包", ""]
  ];
  const shops = stores.map((item, index) => ({
    id: index + 1,
    name: item[0],
    kind: "店铺",
    pack: item[1],
    bundle: item[2],
    demo: true
  }));
  shops.push({ id: 16, name: "沈子晗包", kind: "店群", pack: "沈子晗包", bundle: "", demo: true });
  shops.push({ id: 17, name: "杨润泽包", kind: "店群", pack: "杨润泽包", bundle: "", demo: true });
  return shops;
}

function seedGrants() {
  const start = "2026-01-01";
  const rows = [
    [1, 16, "经理"],
    [8, 17, "主管"],
    [4, 1, "运营"],
    [5, 2, "运营"],
    [6, 3, "运营"],
    [7, 4, "运营"],
    [7, 5, "运营"],
    [8, 6, "主管"],
    [9, 7, "运营"],
    [8, 8, "主管"],
    [8, 9, "主管"],
    [10, 9, "运营"],
    [11, 10, "运营"],
    [12, 11, "运营"],
    [13, 12, "运营"],
    [14, 13, "运营"],
    [15, 14, "运营"],
    [16, 15, "运营"]
  ];
  return rows.map((item, index) => ({
    id: index + 1,
    personId: item[0],
    shopId: item[1],
    role: item[2],
    startOn: start,
    endOn: "",
    revoked: false
  }));
}

let nextPersonId = 17;
let nextShopId = 18;
let nextGrantId = 19;
let people = seedPeople();
let shops = seedShops();
let grants = seedGrants();

export function resetPeopleStore() {
  people = seedPeople();
  shops = seedShops();
  grants = seedGrants();
  nextPersonId = 17;
  nextShopId = 18;
  nextGrantId = 19;
}

async function ensureRosterLogins(list) {
  const roster = list || (dbMode() === "mysql" ? await loadMysqlPeople() : people);
  await syncRosterLogins(roster);
}

async function ignoreDuplicateColumn(work) {
  try {
    await work();
  } catch (err) {
    const message = String(err && err.message ? err.message : err);
    if (!/Duplicate column|already exists/i.test(message)) {
      throw err;
    }
  }
}

export async function ensurePeopleSchema() {
  await ignoreDuplicateColumn(() =>
    query("ALTER TABLE people ADD COLUMN employee_no VARCHAR(32) NOT NULL DEFAULT ''")
  );
  await ignoreDuplicateColumn(() =>
    query("ALTER TABLE people ADD COLUMN department VARCHAR(128) NOT NULL DEFAULT ''")
  );
  await ignoreDuplicateColumn(() => query("ALTER TABLE people ADD COLUMN manager_id INT NULL"));
  await query(
    "CREATE TABLE IF NOT EXISTS people_shops (id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, name VARCHAR(128) NOT NULL, kind VARCHAR(16) NOT NULL, pack VARCHAR(64) NOT NULL DEFAULT '', bundle VARCHAR(64) NOT NULL DEFAULT '', demo TINYINT NOT NULL DEFAULT 0) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
  );
  await query(
    "CREATE TABLE IF NOT EXISTS people_grants (id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, person_id INT NOT NULL, shop_id INT NOT NULL, role VARCHAR(32) NOT NULL, start_on VARCHAR(16) NOT NULL DEFAULT '', end_on VARCHAR(16) NOT NULL DEFAULT '', revoked TINYINT NOT NULL DEFAULT 0) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
  );
}

async function insertPersonRow(person) {
  await query(
    "INSERT INTO people (id, name, role, center, status, demo, employee_no, department, manager_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      person.id,
      person.name,
      person.role,
      person.center,
      person.status,
      person.demo ? 1 : 0,
      person.employeeNo,
      person.department,
      person.managerId
    ]
  );
}

async function insertShopRow(shop) {
  await query("INSERT INTO people_shops (id, name, kind, pack, bundle, demo) VALUES (?, ?, ?, ?, ?, ?)", [
    shop.id,
    shop.name,
    shop.kind,
    shop.pack,
    shop.bundle,
    shop.demo ? 1 : 0
  ]);
}

async function insertGrantRow(grant) {
  await query(
    "INSERT INTO people_grants (id, person_id, shop_id, role, start_on, end_on, revoked) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [grant.id, grant.personId, grant.shopId, grant.role, grant.startOn, grant.endOn, grant.revoked ? 1 : 0]
  );
}

async function loadMysqlPeople() {
  const [rows] = await query(PEOPLE_SELECT);
  return rows.map(personFromRow);
}

async function loadMysqlShops() {
  const [rows] = await query(SHOP_SELECT);
  return rows.map(shopFromRow);
}

async function loadMysqlGrants() {
  const [rows] = await query(GRANT_SELECT);
  return rows.map(grantFromRow);
}

export async function hydrateFromMysql() {
  await ensurePeopleSchema();
  let rows = await loadMysqlPeople();
  if (!rows.length) {
    for (const person of seedPeople()) {
      await insertPersonRow(person);
    }
    rows = seedPeople();
  } else {
    const have = new Map(rows.map((person) => [person.name, person]));
    for (const person of seedPeople()) {
      const existing = have.get(person.name);
      if (!existing) {
        await insertPersonRow(person);
        continue;
      }
      if (!existing.employeeNo) {
        await query(
          "UPDATE people SET role = ?, employee_no = ?, department = ?, manager_id = ? WHERE id = ?",
          [person.role, person.employeeNo, person.department, person.managerId, existing.id]
        );
      }
    }
    rows = await loadMysqlPeople();
  }
  people = rows;
  nextPersonId = people.reduce((max, person) => Math.max(max, Number(person.id) || 0), 0) + 1;

  let shopRows = await loadMysqlShops();
  if (!shopRows.length) {
    for (const shop of seedShops()) {
      await insertShopRow(shop);
    }
    shopRows = seedShops();
  }
  shops = shopRows;
  nextShopId = shops.reduce((max, shop) => Math.max(max, Number(shop.id) || 0), 0) + 1;

  let grantRows = await loadMysqlGrants();
  if (!grantRows.length) {
    for (const grant of seedGrants()) {
      await insertGrantRow(grant);
    }
    grantRows = seedGrants();
  }
  grants = grantRows;
  nextGrantId = grants.reduce((max, grant) => Math.max(max, Number(grant.id) || 0), 0) + 1;
  await ensureRosterLogins(people);
}

function personById(id, list) {
  return list.find((person) => Number(person.id) === Number(id)) || null;
}

function shopById(id, list) {
  return list.find((shop) => Number(shop.id) === Number(id)) || null;
}

function isGrantOpen(grant, onDay) {
  if (grant.revoked) {
    return false;
  }
  if (grant.endOn && grant.endOn < onDay) {
    return false;
  }
  if (grant.startOn && grant.startOn > onDay) {
    return false;
  }
  return true;
}

function expandShop(shop, allShops) {
  if (!shop) {
    return [];
  }
  if (shop.kind !== "店群") {
    return [shop];
  }
  return allShops.filter(
    (item) => item.kind === "店铺" && (item.pack === shop.name || item.bundle === shop.name)
  );
}

function decoratePeople(list, shopList, grantList) {
  const onDay = todayShanghai();
  const names = new Map(list.map((person) => [Number(person.id), person.name]));
  return list.map((person) => {
    const own = grantList.filter((grant) => Number(grant.personId) === Number(person.id) && isGrantOpen(grant, onDay));
    const seen = new Map();
    own.forEach((grant) => {
      const shop = shopById(grant.shopId, shopList);
      expandShop(shop, shopList).forEach((item) => {
        seen.set(item.id, item.name);
      });
    });
    const login = loginStateForPerson(person);
    return {
      ...clonePerson(person),
      managerName: person.managerId ? names.get(Number(person.managerId)) || "" : "",
      visibleShops: [...seen.values()],
      loginUsername: login.loginUsername,
      loginEnabled: login.loginEnabled
    };
  });
}

export async function listPeople() {
  if (dbMode() === "mysql") {
    const [personRows, shopRows, grantRows] = await Promise.all([
      loadMysqlPeople(),
      loadMysqlShops(),
      loadMysqlGrants()
    ]);
    await ensureRosterLogins(personRows);
    return decoratePeople(personRows, shopRows, grantRows);
  }
  await ensureRosterLogins(people);
  return decoratePeople(people, shops, grants);
}

export async function listShops() {
  if (dbMode() === "mysql") {
    return (await loadMysqlShops()).map(cloneShop);
  }
  return shops.map(cloneShop);
}

export async function listGrants() {
  const [personList, shopList, grantList] =
    dbMode() === "mysql"
      ? [await loadMysqlPeople(), await loadMysqlShops(), await loadMysqlGrants()]
      : [people, shops, grants];
  const personNames = new Map(personList.map((person) => [Number(person.id), person.name]));
  const shopNames = new Map(shopList.map((shop) => [Number(shop.id), shop.name]));
  const onDay = todayShanghai();
  return grantList.map((grant) => {
    const item = cloneGrant(grant);
    item.personName = personNames.get(item.personId) || "";
    item.shopName = shopNames.get(item.shopId) || "";
    item.active = isGrantOpen(item, onDay);
    return item;
  });
}

function parsePersonInput(input, { requireCore }) {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const role = normalizeRole(input.role);
  const center = typeof input.center === "string" ? input.center.trim() : "";
  const statusRaw = typeof input.status === "string" ? input.status.trim() : "在职";
  const status = statusRaw || "在职";
  const employeeNo = typeof input.employeeNo === "string" ? input.employeeNo.trim() : typeof input.employee_no === "string" ? input.employee_no.trim() : "";
  const department = typeof input.department === "string" ? input.department.trim() : "";
  const managerRaw = input.managerId ?? input.manager_id;
  const managerId = managerRaw === "" || managerRaw == null ? null : Number(managerRaw);

  if (requireCore && (!name || !role || !center)) {
    return { ok: false, statusCode: 400, error: "姓名、岗位、所属中心均为必填" };
  }
  if (center && !CENTERS.includes(center) && center !== "人员管理") {
    return { ok: false, statusCode: 400, error: "所属中心不在可选列表中" };
  }
  if (status && !STATUSES.has(status)) {
    return { ok: false, statusCode: 400, error: "状态仅支持在职或离职" };
  }
  if (managerId != null && !Number.isFinite(managerId)) {
    return { ok: false, statusCode: 400, error: "上级不合法" };
  }
  return { ok: true, name, role, center, status, employeeNo, department, managerId };
}

async function nameTaken(name, exceptId) {
  const list = dbMode() === "mysql" ? await loadMysqlPeople() : people;
  return list.some((person) => person.name === name && Number(person.id) !== Number(exceptId || 0));
}

async function attachLogin(person, { resetPassword = false } = {}) {
  if (!person || person.name === "罗成") {
    return person;
  }
  if (person.status === "离职") {
    await disableLogin(person.name);
    await disableLoginByPersonId(person.id);
    return { ...clonePerson(person), ...loginStateForPerson(person) };
  }
  await provisionLogin({
    username: person.name,
    displayName: person.name,
    personId: person.id,
    password: STAFF_INITIAL_PASSWORD,
    resetPassword,
    disabled: false
  });
  return { ...clonePerson(person), ...loginStateForPerson(person) };
}

export async function createPerson(input) {
  const parsed = parsePersonInput(input || {}, { requireCore: true });
  if (!parsed.ok) {
    return parsed;
  }
  if (await nameTaken(parsed.name)) {
    return { ok: false, statusCode: 409, error: "姓名已存在，登录名必须唯一" };
  }
  const person = {
    id: nextPersonId,
    name: parsed.name,
    role: parsed.role,
    center: parsed.center,
    status: parsed.status,
    demo: false,
    employeeNo: parsed.employeeNo,
    department: parsed.department || parsed.center,
    managerId: parsed.managerId
  };

  if (dbMode() === "mysql") {
    const [result] = await query(
      "INSERT INTO people (name, role, center, status, demo, employee_no, department, manager_id) VALUES (?, ?, ?, ?, 0, ?, ?, ?)",
      [person.name, person.role, person.center, person.status, person.employeeNo, person.department, person.managerId]
    );
    person.id = Number(result.insertId);
    return { ok: true, person: await attachLogin(person, { resetPassword: true }) };
  }

  person.id = nextPersonId++;
  people.push(person);
  return { ok: true, person: await attachLogin(person, { resetPassword: true }) };
}

async function revokeOpenGrants(personId) {
  const onDay = todayShanghai();
  if (dbMode() === "mysql") {
    await query("UPDATE people_grants SET revoked = 1, end_on = CASE WHEN end_on = '' THEN ? ELSE end_on END WHERE person_id = ? AND revoked = 0", [
      onDay,
      personId
    ]);
    return;
  }
  grants.forEach((grant) => {
    if (Number(grant.personId) === Number(personId) && !grant.revoked) {
      grant.revoked = true;
      if (!grant.endOn) {
        grant.endOn = onDay;
      }
    }
  });
}

export async function updatePerson(id, input) {
  const personId = Number(id);
  if (!Number.isFinite(personId)) {
    return { ok: false, statusCode: 400, error: "人员不存在" };
  }
  const current =
    dbMode() === "mysql"
      ? (await loadMysqlPeople()).find((person) => person.id === personId)
      : personById(personId, people);
  if (!current) {
    return { ok: false, statusCode: 404, error: "人员不存在" };
  }
  const nextStatus = String(input.status || current.status || "").trim();
  const leaving = current.status !== "离职" && nextStatus === "离职";
  const rejoining = current.status === "离职" && nextStatus === "在职";
  const parsed = parsePersonInput(
    {
      name: input.name ?? current.name,
      role: input.role ?? current.role,
      center: input.center ?? current.center,
      status: input.status ?? current.status,
      employeeNo: input.employeeNo ?? input.employee_no ?? current.employeeNo,
      department: input.department ?? current.department,
      managerId: input.managerId ?? input.manager_id ?? current.managerId
    },
    { requireCore: true }
  );
  if (!parsed.ok) {
    return parsed;
  }
  if (parsed.name !== current.name && (await nameTaken(parsed.name, personId))) {
    return { ok: false, statusCode: 409, error: "姓名已存在，登录名必须唯一" };
  }
  const next = {
    ...current,
    name: parsed.name,
    role: parsed.role,
    center: parsed.center,
    status: parsed.status,
    employeeNo: parsed.employeeNo,
    department: parsed.department,
    managerId: parsed.managerId
  };
  if (dbMode() === "mysql") {
    await query(
      "UPDATE people SET name = ?, role = ?, center = ?, status = ?, employee_no = ?, department = ?, manager_id = ? WHERE id = ?",
      [next.name, next.role, next.center, next.status, next.employeeNo, next.department, next.managerId, personId]
    );
  } else {
    Object.assign(current, next);
  }
  if (leaving) {
    await revokeOpenGrants(personId);
    await disableLogin(next.name);
    await disableLoginByPersonId(personId);
    if (current.name !== next.name) {
      await disableLogin(current.name);
    }
  } else if (rejoining) {
    await attachLogin(next, { resetPassword: true });
  } else if (current.name !== next.name) {
    await disableLogin(current.name);
    await attachLogin(next, { resetPassword: false });
  }
  return { ok: true, person: { ...clonePerson(next), ...loginStateForPerson(next) } };
}

export async function deletePerson(id) {
  const personId = Number(id);
  if (!Number.isFinite(personId)) {
    return { ok: false, statusCode: 400, error: "人员不存在" };
  }
  const current =
    dbMode() === "mysql"
      ? (await loadMysqlPeople()).find((person) => person.id === personId)
      : personById(personId, people);
  if (!current) {
    return { ok: false, statusCode: 404, error: "人员不存在" };
  }
  await disableLogin(current.name);
  await disableLoginByPersonId(personId);
  await revokeOpenGrants(personId);
  if (dbMode() === "mysql") {
    await query("DELETE FROM people_grants WHERE person_id = ?", [personId]);
    await query("DELETE FROM people WHERE id = ?", [personId]);
  } else {
    grants = grants.filter((grant) => Number(grant.personId) !== personId);
    people = people.filter((person) => Number(person.id) !== personId);
  }
  return { ok: true };
}

export async function createShop(input) {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const kind = typeof input.kind === "string" ? input.kind.trim() : "店铺";
  const pack = typeof input.pack === "string" ? input.pack.trim() : "";
  const bundle = typeof input.bundle === "string" ? input.bundle.trim() : "";
  if (!name) {
    return { ok: false, statusCode: 400, error: "店铺名称必填" };
  }
  if (!SHOP_KINDS.includes(kind)) {
    return { ok: false, statusCode: 400, error: "类型只支持店铺或店群" };
  }
  const shop = { id: nextShopId, name, kind, pack: pack || (kind === "店群" ? name : "沈子晗包"), bundle, demo: false };
  if (dbMode() === "mysql") {
    const [result] = await query("INSERT INTO people_shops (name, kind, pack, bundle, demo) VALUES (?, ?, ?, ?, 0)", [
      shop.name,
      shop.kind,
      shop.pack,
      shop.bundle
    ]);
    shop.id = Number(result.insertId);
    return { ok: true, shop: cloneShop(shop) };
  }
  shop.id = nextShopId++;
  shops.push(shop);
  return { ok: true, shop: cloneShop(shop) };
}

export async function createGrant(input) {
  const personId = Number(input.personId ?? input.person_id);
  const shopId = Number(input.shopId ?? input.shop_id);
  const role = normalizeRole(input.role) || "运营";
  const startOn = typeof input.startOn === "string" && input.startOn.trim() ? input.startOn.trim() : todayShanghai();
  const endOn = typeof input.endOn === "string" ? input.endOn.trim() : typeof input.end_on === "string" ? input.end_on.trim() : "";
  if (!Number.isFinite(personId) || !Number.isFinite(shopId)) {
    return { ok: false, statusCode: 400, error: "人和店都要选" };
  }
  const personList = dbMode() === "mysql" ? await loadMysqlPeople() : people;
  const shopList = dbMode() === "mysql" ? await loadMysqlShops() : shops;
  if (!personById(personId, personList) || !shopById(shopId, shopList)) {
    return { ok: false, statusCode: 400, error: "人或店不存在" };
  }
  const grant = { id: nextGrantId, personId, shopId, role, startOn, endOn, revoked: false };
  if (dbMode() === "mysql") {
    const [result] = await query(
      "INSERT INTO people_grants (person_id, shop_id, role, start_on, end_on, revoked) VALUES (?, ?, ?, ?, ?, 0)",
      [personId, shopId, role, startOn, endOn]
    );
    grant.id = Number(result.insertId);
    return { ok: true, grant: cloneGrant(grant) };
  }
  grant.id = nextGrantId++;
  grants.push(grant);
  return { ok: true, grant: cloneGrant(grant) };
}

export async function reconcileRoster() {
  const personList = dbMode() === "mysql" ? await loadMysqlPeople() : people.map(clonePerson);
  const shopList = dbMode() === "mysql" ? await loadMysqlShops() : shops.map(cloneShop);
  const grantList = dbMode() === "mysql" ? await loadMysqlGrants() : grants.map(cloneGrant);
  const onDay = todayShanghai();
  const employedNoGrant = personList
    .filter((person) => person.status === "在职")
    .filter((person) => !grantList.some((grant) => Number(grant.personId) === Number(person.id) && isGrantOpen(grant, onDay)))
    .map((person) => ({ id: person.id, name: person.name }));
  const grantOnLeft = grantList
    .filter((grant) => isGrantOpen(grant, onDay))
    .filter((grant) => {
      const person = personById(grant.personId, personList);
      return person && person.status === "离职";
    })
    .map((grant) => ({
      id: grant.id,
      personName: personById(grant.personId, personList)?.name || "",
      shopName: shopById(grant.shopId, shopList)?.name || ""
    }));
  return { employedNoGrant, grantOnLeft };
}
