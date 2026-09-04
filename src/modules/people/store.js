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
  return { ...person };
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

export function listPeople() {
  return people.map(clone);
}

export function createPerson(input) {
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
