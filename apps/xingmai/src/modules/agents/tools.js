import { listGrants, listPeople, listShops } from "../people/store.js";

export const PHASE2_GAPS = [
  "店近30天经营数据 → 向数据中心要只读 API",
  "商学院课程检索 → 向甄选商学院要只读 API",
  "外数 → 向主框架或对应模块开口",
  "沈/韩任务检索 → 向对应模块要只读 API"
];

export function refuse(message) {
  const error = new Error(message);
  error.statusCode = 403;
  error.refused = true;
  return error;
}

export async function resolveViewer(user) {
  const people = await listPeople();
  const names = [user?.displayName, user?.username].filter(Boolean).map((item) => String(item));
  const person = people.find((item) => names.includes(item.name) || names.includes(item.employeeNo)) || null;
  const employed = Boolean(person && person.status === "在职");
  return {
    username: user?.username || "",
    displayName: user?.displayName || user?.username || "",
    person,
    employed,
    shops: employed ? [...(person.visibleShops || [])] : []
  };
}

export async function rosterSnapshot() {
  const [people, shops, grants] = await Promise.all([listPeople(), listShops(), listGrants()]);
  return { people, shops, grants };
}

export function findPerson(people, name) {
  const needle = String(name || "").trim();
  if (!needle) {
    return null;
  }
  return (
    people.find((item) => item.name === needle || item.employeeNo === needle) ||
    people.find((item) => needle.length >= 2 && item.name.includes(needle)) ||
    null
  );
}

export function findShop(shops, name) {
  const needle = String(name || "").trim();
  if (!needle) {
    return null;
  }
  const exact = shops.find((item) => item.name === needle);
  if (exact) {
    return exact;
  }
  const hits = shops.filter((item) => item.name.includes(needle) || needle.includes(item.name));
  return hits.length === 1 ? hits[0] : null;
}

function packStores(shop, shops) {
  if (!shop) {
    return [];
  }
  if (shop.kind !== "店群") {
    return [shop];
  }
  return shops.filter((item) => item.kind === "店铺" && (item.pack === shop.name || item.bundle === shop.name));
}

export function viewerCanSeeShop(viewer, shop, shops) {
  if (!viewer || !shop) {
    return false;
  }
  if (!viewer.person) {
    return false;
  }
  if (viewer.person.status === "离职") {
    return false;
  }
  const allowed = new Set(viewer.shops || []);
  if (shop.kind === "店铺") {
    return allowed.has(shop.name);
  }
  return packStores(shop, shops).some((item) => allowed.has(item.name));
}

export async function toolPersonStatus(name) {
  const { people } = await rosterSnapshot();
  const person = findPerson(people, name);
  if (!person) {
    return { ok: false, found: false, name, source: "人员花名册只读", text: `花名册没有「${name}」。` };
  }
  return {
    ok: true,
    found: true,
    name: person.name,
    status: person.status,
    role: person.role,
    center: person.center,
    employeeNo: person.employeeNo,
    employed: person.status === "在职",
    source: "人员花名册只读",
    text:
      person.status === "在职"
        ? `${person.name} 在职，岗位 ${person.role}，中心 ${person.center}。依据花名册。`
        : `${person.name} 花名册状态是离职。离职以花名册为准，店权按人员模块已收。`
  };
}

export async function toolMyShops(viewer) {
  if (!viewer.person) {
    return {
      ok: false,
      shops: [],
      source: "人员花名册只读",
      text: `花名册没有「${viewer.displayName || viewer.username}」，按店权现在看不到店。要挂名请去人员管理。`
    };
  }
  if (viewer.person.status === "离职") {
    return {
      ok: true,
      shops: [],
      source: "人员花名册只读",
      text: `${viewer.person.name} 花名册是离职，看不见店。`
    };
  }
  const shops = viewer.shops || [];
  return {
    ok: true,
    shops,
    source: "人员花名册只读",
    text: shops.length
      ? `${viewer.person.name} 当前能看见：${shops.join("、")}。`
      : `${viewer.person.name} 在职，但花名册没有生效店权。`
  };
}

export async function toolShopOperators(viewer, shopName) {
  const { people, shops } = await rosterSnapshot();
  const shop = findShop(shops, shopName);
  if (!shop) {
    return { ok: false, found: false, source: "人员花名册只读", text: `花名册没有店「${shopName}」。` };
  }
  if (!viewerCanSeeShop(viewer, shop, shops)) {
    return {
      ok: false,
      forbidden: true,
      source: "人员花名册只读",
      text: viewer.person
        ? `无权查看「${shop.name}」。店权以花名册管辖为准。`
        : `花名册没有你的名字，无权查看「${shop.name}」。`
    };
  }
  const visible = new Set(
    shop.kind === "店群" ? packStores(shop, shops).map((item) => item.name) : [shop.name]
  );
  const operators = people
    .filter((person) => person.status === "在职")
    .filter((person) => (person.visibleShops || []).some((item) => visible.has(item)))
    .map((person) => ({
      name: person.name,
      role: person.role,
      shops: (person.visibleShops || []).filter((item) => visible.has(item))
    }));
  return {
    ok: true,
    found: true,
    shop: shop.name,
    operators,
    source: "人员花名册只读",
    text: operators.length
      ? `「${shop.name}」在职管辖：${operators.map((item) => `${item.name}（${item.role}）`).join("、")}。离职人员不计入。`
      : `「${shop.name}」花名册没有在职管辖。`
  };
}
