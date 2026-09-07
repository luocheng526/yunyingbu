import { dbMode, query } from "../profile/auth.js";

export const CENTERS = [
  "沈子晗运营中心",
  "韩梦凯运营中心",
  "数据中心",
  "版本发布中心",
  "个人中心",
  "其他"
];

const STATUSES = new Set(["在职", "离职"]);

function clone(person) {
  return { ...person, demo: Boolean(person.demo) };
}

function seed() {
  return [
    {
      id: 1,
      name: "沈子晗",
      role: "运营",
      center: "沈子晗运营中心",
      status: "在职",
      demo: true
    },
    {
      id: 2,
      name: "韩梦凯",
      role: "运营",
      center: "韩梦凯运营中心",
      status: "在职",
      demo: true
    },
    {
      id: 3,
      name: "管理员",
      role: "管理",
      center: "人员管理",
      status: "在职",
      demo: true
    }
  ];
}

let nextId = 4;
let people = seed();

export function resetPeopleStore() {
  nextId = 4;
  people = seed();
}

function fromRow(row) {
  return {
    id: Number(row.id),
    name: row.name,
    role: row.role,
    center: row.center,
    status: row.status,
    demo: Boolean(row.demo)
  };
}

export async function hydrateFromMysql() {
  const [rows] = await query("SELECT id, name, role, center, status, demo FROM people ORDER BY id ASC");
  if (!rows.length) {
    for (const person of seed()) {
      await query("INSERT INTO people (id, name, role, center, status, demo) VALUES (?, ?, ?, ?, ?, ?)", [
        person.id,
        person.name,
        person.role,
        person.center,
        person.status,
        person.demo ? 1 : 0
      ]);
    }
    people = seed();
    nextId = 4;
    return;
  }
  people = rows.map(fromRow);
  nextId = people.reduce((max, person) => Math.max(max, Number(person.id) || 0), 0) + 1;
}

export async function listPeople() {
  if (dbMode() === "mysql") {
    const [rows] = await query("SELECT id, name, role, center, status, demo FROM people ORDER BY id ASC");
    return rows.map(fromRow);
  }
  return people.map(clone);
}

export async function createPerson(input) {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const role = typeof input.role === "string" ? input.role.trim() : "";
  const center = typeof input.center === "string" ? input.center.trim() : "";
  const statusRaw = typeof input.status === "string" ? input.status.trim() : "在职";
  const status = statusRaw || "在职";

  if (!name || !role || !center) {
    return { ok: false, statusCode: 400, error: "姓名、角色、所属中心均为必填" };
  }
  if (!CENTERS.includes(center)) {
    return { ok: false, statusCode: 400, error: "所属中心不在可选列表中" };
  }
  if (!STATUSES.has(status)) {
    return { ok: false, statusCode: 400, error: "状态仅支持在职或离职" };
  }

  if (dbMode() === "mysql") {
    const [result] = await query(
      "INSERT INTO people (name, role, center, status, demo) VALUES (?, ?, ?, ?, 0)",
      [name, role, center, status]
    );
    return {
      ok: true,
      person: {
        id: Number(result.insertId),
        name,
        role,
        center,
        status,
        demo: false
      }
    };
  }

  const person = {
    id: nextId++,
    name,
    role,
    center,
    status,
    demo: false
  };
  people.push(person);
  return { ok: true, person: clone(person) };
}
