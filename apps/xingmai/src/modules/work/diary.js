/* 工作汇报店铺日报。 */
import { dbMode, query } from "../profile/auth.js";
import { listGrants, listPeople, listShops } from "../people/store.js";
import {
  claimReminder,
  confirmedBinds,
  dingUserOf,
  dingPublic,
  discoverAgent,
  inRemindWindow,
  loadAttendance,
  probeAttendance,
  readyDing,
  releaseReminder,
  resetDingStore,
  saveAppConfig,
  saveBinds,
  sendTaskNotice,
  sendWorkNotice,
  workLink,
  shanghaiNow,
  syncBinds
} from "./dingtalk.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
const POSITIONS = ["运营", "助理", "店长", "主管", "经理", "总监", "储备"];
const PERSONAL = "__personal__";

const DEFAULT_NODES = [
  { id: "goods", kind: "section", parent: "", name: "商品与评价", enabled: true },
  { id: "ops", kind: "section", parent: "", name: "活动与库存", enabled: true },
  { id: "orders", kind: "section", parent: "", name: "订单处置", enabled: true },
  { id: "other", kind: "section", parent: "", name: "其他与备注", enabled: true },
  { id: "products", kind: "lane", parent: "goods", name: "商品维护", enabled: true },
  { id: "上品", kind: "metric", parent: "products", name: "上品", enabled: true },
  { id: "优化", kind: "metric", parent: "products", name: "优化商品数", unit: "款", enabled: true },
  { id: "新增SPU", kind: "metric", parent: "products", name: "新增SPU", unit: "个", enabled: true },
  { id: "新增单品", kind: "metric", parent: "products", name: "新增单品", unit: "个", enabled: true },
  { id: "reviews", kind: "lane", parent: "goods", name: "评价与热销", enabled: true },
  { id: "评价合并", kind: "metric", parent: "reviews", name: "评价合并", enabled: true },
  { id: "差评整改", kind: "metric", parent: "reviews", name: "差评整改", enabled: true },
  { id: "评价数", kind: "metric", parent: "reviews", name: "找到的评价数", unit: "条", enabled: true },
  { id: "穿热销数量", kind: "metric", parent: "reviews", name: "穿热销数量", unit: "个", enabled: true },
  { id: "campaign", kind: "lane", parent: "ops", name: "活动提报", enabled: true },
  { id: "报名活动", kind: "metric", parent: "campaign", name: "报名活动", enabled: true },
  { id: "一键低价商品", kind: "metric", parent: "campaign", name: "一键低价商品", enabled: true },
  { id: "新增活动提报", kind: "metric", parent: "campaign", name: "新增活动提报", enabled: true },
  { id: "stock", kind: "lane", parent: "ops", name: "仓储库存", enabled: true },
  { id: "新增入仓量", kind: "metric", parent: "stock", name: "新增入仓量", enabled: true },
  { id: "库存调整", kind: "metric", parent: "stock", name: "库存调整", enabled: true },
  { id: "exceptions", kind: "lane", parent: "orders", name: "订单跟进", enabled: true },
  { id: "即将超时订单", kind: "metric", parent: "exceptions", name: "即将超时订单", unit: "单", enabled: true },
  { id: "违约单处置记录", kind: "metric", parent: "exceptions", name: "违约单处置记录", unit: "份", enabled: true },
  { id: "misc", kind: "lane", parent: "other", name: "其他工作", enabled: true },
  { id: "开直播", kind: "extra", parent: "misc", name: "开直播", enabled: true },
  { id: "做短视频", kind: "extra", parent: "misc", name: "做短视频", enabled: true },
  { id: "活动复盘", kind: "extra", parent: "misc", name: "活动复盘", enabled: true },
  { id: "商品素材管理", kind: "extra", parent: "misc", name: "商品素材管理", enabled: true },
  { id: "主图", kind: "choice", parent: "优化", name: "主图", enabled: true },
  { id: "详情", kind: "choice", parent: "优化", name: "详情", enabled: true },
  { id: "标题", kind: "choice", parent: "优化", name: "标题", enabled: true },
  { id: "SKU名", kind: "choice", parent: "优化", name: "SKU名", enabled: true },
  { id: "商品素材", kind: "choice", parent: "优化", name: "商品素材", enabled: true },
  { id: "短标题", kind: "choice", parent: "优化", name: "短标题", enabled: true },
  { id: "商品属性", kind: "choice", parent: "优化", name: "商品属性", enabled: true },
  { id: "主图视频", kind: "choice", parent: "优化", name: "主图视频", enabled: true },
  { id: "详情视频", kind: "choice", parent: "优化", name: "详情视频", enabled: true },
  { id: "问答", kind: "choice", parent: "优化", name: "问答", enabled: true },
  { id: "备注", kind: "note", parent: "misc", name: "备注", enabled: true }
];

let ready = false;
let catalog = { revision: 1, nodes: cloneNodes(DEFAULT_NODES) };
let policy = {
  revision: 1,
  positions: ["运营", "助理"],
  delivery: { revision: 1, useSchedule: false, useLeave: false, remind: false, remindAt: "18:00", operatorPersonId: 0 }
};
let reports = new Map();
let images = new Map();
let rests = new Map();
let rosterReader = async () => ({
  memberDept() {
    return "";
  },
  templateFilled() {
    return false;
  },
  templateLabels() {
    return [];
  },
  deptName() {
    return "";
  }
});

function cloneNodes(list) {
  return (Array.isArray(list) ? list : []).map((node) => ({
    id: String(node.id || ""),
    kind: String(node.kind || ""),
    parent: String(node.parent || ""),
    name: String(node.name || ""),
    unit: String(node.unit || ""),
    enabled: node.enabled !== false
  }));
}

function nowStamp() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

export function todayShanghai() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
}

export function bindRoster(reader) {
  rosterReader = reader;
}

export function resetDiaryStore() {
  resetOrgMemo();
  resetDingStore();
  ready = false;
  catalog = { revision: 1, nodes: cloneNodes(DEFAULT_NODES) };
  policy = {
    revision: 1,
    positions: ["运营", "助理"],
    delivery: { revision: 1, useSchedule: false, useLeave: false, remind: false, remindAt: "18:00", operatorPersonId: 0 }
  };
  reports = new Map();
  images = new Map();
  rests = new Map();
}

function reportKey(personId, date, shopKey) {
  return `${Number(personId)}|${date}|${shopKey}`;
}

function restKey(personId, date) {
  return `${Number(personId)}|${date}`;
}

function parseDate(raw, { allowFuture = false } = {}) {
  const value = String(raw || "").trim();
  if (!DATE_RE.test(value)) {
    return "";
  }
  if (!allowFuture && value > todayShanghai()) {
    return "";
  }
  return value;
}

function legacyCatalog(nodes) {
  const ids = new Set(nodes.map((node) => node.id));
  return ids.has("lane-goods") && !ids.has("上品");
}

function enabledNodes(nodes) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const enabled = (node) => {
    if (!node || node.enabled === false) {
      return false;
    }
    if (!node.parent) {
      return true;
    }
    return enabled(byId.get(node.parent));
  };
  return nodes.filter(enabled);
}

function publicCatalog() {
  return { revision: catalog.revision, nodes: cloneNodes(catalog.nodes) };
}

function publicPolicy() {
  return {
    revision: policy.revision,
    positions: [...policy.positions],
    options: POSITIONS,
    delivery: { ...policy.delivery },
    integration: { app: false, bound: 0, operator: false, agent: false }
  };
}

function personPositions(person) {
  const found = new Set();
  const role = String(person.role || "").trim();
  if (role) {
    found.add(role);
  }
  String(person.seat || "")
    .split("、")
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((item) => found.add(item));
  return found;
}

function positionRequired(person) {
  const have = personPositions(person);
  return policy.positions.some((item) => have.has(item));
}

function grantOpen(grant, day) {
  if (grant.revoked) {
    return false;
  }
  if (grant.endOn && grant.endOn < day) {
    return false;
  }
  if (grant.startOn && grant.startOn > day) {
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

let orgMemo = null;
let orgUntil = 0;

export function loadOrg() {
  const now = Date.now();
  if (orgMemo && now < orgUntil) {
    return orgMemo;
  }
  orgUntil = now + 1500;
  orgMemo = Promise.all([listPeople(), listShops(), listGrants()])
    .then(([people, shops, grants]) => ({ people, shops, grants }))
    .catch((error) => {
      orgMemo = null;
      orgUntil = 0;
      throw error;
    });
  return orgMemo;
}

export function resetOrgMemo() {
  orgMemo = null;
  orgUntil = 0;
}

async function orgBundle() {
  const packed = await loadOrg();
  return {
    people: packed.people.filter((person) => person.status !== "离职"),
    shops: packed.shops,
    grants: packed.grants
  };
}

function shopsFor(personId, day, shops, grants) {
  const byId = new Map(shops.map((shop) => [Number(shop.id), shop]));
  const seen = new Map();
  grants
    .filter((grant) => Number(grant.personId) === Number(personId) && grantOpen(grant, day))
    .forEach((grant) => {
      expandShop(byId.get(Number(grant.shopId)), shops).forEach((shop) => {
        if (shop.kind === "店铺") {
          seen.set(String(shop.id), { id: String(shop.id), name: shop.name });
        }
      });
    });
  return [...seen.values()];
}

function manages(viewer, target, byId) {
  let cursor = target;
  const seen = new Set();
  while (cursor && cursor.managerId && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    if (Number(cursor.managerId) === Number(viewer.id)) {
      return true;
    }
    cursor = byId.get(Number(cursor.managerId));
  }
  return false;
}

function leaderShopIds(viewer, day, shops, grants) {
  const ids = new Set();
  grants
    .filter(
      (grant) =>
        Number(grant.personId) === Number(viewer.id) &&
        grantOpen(grant, day) &&
        ["主管", "经理", "店长", "总监"].includes(String(grant.role || ""))
    )
    .forEach((grant) => {
      const shop = shops.find((item) => Number(item.id) === Number(grant.shopId));
      expandShop(shop, shops).forEach((item) => {
        if (item.kind === "店铺") {
          ids.add(String(item.id));
        }
      });
    });
  return ids;
}

function canSeeShop(viewer, author, shopKey, admin, day, people, shops, grants) {
  if (admin || Number(viewer.id) === Number(author.id)) {
    return true;
  }
  const byId = new Map(people.map((person) => [Number(person.id), person]));
  if (manages(viewer, author, byId)) {
    return true;
  }
  return leaderShopIds(viewer, day, shops, grants).has(String(shopKey));
}

function isLeader(viewer, admin, people, shops, grants, day) {
  if (admin) {
    return true;
  }
  if (people.some((person) => Number(person.managerId) === Number(viewer.id))) {
    return true;
  }
  return leaderShopIds(viewer, day, shops, grants).size > 0;
}

async function ensureTables() {
  await query(
    `CREATE TABLE IF NOT EXISTS work_report_diary_meta (
      meta_key VARCHAR(32) NOT NULL PRIMARY KEY,
      body MEDIUMTEXT NOT NULL,
      updated_at VARCHAR(40) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
  await query(
    `CREATE TABLE IF NOT EXISTS work_report_diary (
      person_id INT NOT NULL,
      work_date CHAR(10) NOT NULL,
      shop_key VARCHAR(64) NOT NULL,
      status VARCHAR(16) NOT NULL,
      revision INT NOT NULL,
      payload MEDIUMTEXT NOT NULL,
      updated_at VARCHAR(40) NOT NULL,
      PRIMARY KEY (person_id, work_date, shop_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
  await query(
    `CREATE TABLE IF NOT EXISTS work_report_diary_images (
      id VARCHAR(40) NOT NULL PRIMARY KEY,
      person_id INT NOT NULL,
      work_date CHAR(10) NOT NULL,
      shop_key VARCHAR(64) NOT NULL,
      field_key VARCHAR(64) NOT NULL,
      name VARCHAR(200) NOT NULL,
      mime VARCHAR(40) NOT NULL,
      data MEDIUMTEXT NOT NULL,
      created_at VARCHAR(40) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
  await query(
    `CREATE TABLE IF NOT EXISTS work_report_diary_rest (
      person_id INT NOT NULL,
      work_date CHAR(10) NOT NULL,
      rest TINYINT NOT NULL,
      updated_at VARCHAR(40) NOT NULL,
      PRIMARY KEY (person_id, work_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
}

async function hydrateMysql() {
  const [metaRows] = await query("SELECT meta_key, body FROM work_report_diary_meta");
  for (const row of metaRows) {
    let body = null;
    try {
      body = JSON.parse(row.body || "null");
    } catch {
      body = null;
    }
    if (row.meta_key === "catalog" && body?.nodes) {
      catalog = { revision: Number(body.revision) || 1, nodes: cloneNodes(body.nodes) };
    }
    if (row.meta_key === "policy" && body) {
      policy = {
        revision: Number(body.revision) || 1,
        positions: Array.isArray(body.positions) ? body.positions.map((item) => String(item)) : ["运营", "助理"],
        delivery: {
          revision: Number(body.delivery?.revision) || 1,
          useSchedule: Boolean(body.delivery?.useSchedule),
          useLeave: Boolean(body.delivery?.useLeave),
          remind: Boolean(body.delivery?.remind),
          remindAt: String(body.delivery?.remindAt || "18:00"),
          operatorPersonId: Number(body.delivery?.operatorPersonId) || 0
        }
      };
    }
  }
  reports = new Map();
  const [reportRows] = await query(
    "SELECT person_id, work_date, shop_key, status, revision, payload FROM work_report_diary"
  );
  for (const row of reportRows) {
    let payload = {};
    try {
      payload = JSON.parse(row.payload || "{}");
    } catch {
      payload = {};
    }
    reports.set(reportKey(row.person_id, row.work_date, row.shop_key), {
      personId: Number(row.person_id),
      date: String(row.work_date),
      shopKey: String(row.shop_key),
      status: String(row.status || "草稿"),
      revision: Number(row.revision) || 1,
      items: payload.items || {},
      extra: payload.extra || [],
      notes: payload.notes || "",
      proofs: payload.proofs || {}
    });
  }
  images = new Map();
  const [imageRows] = await query(
    "SELECT id, person_id, work_date, shop_key, field_key, name, mime FROM work_report_diary_images"
  );
  for (const row of imageRows) {
    images.set(String(row.id), {
      id: String(row.id),
      personId: Number(row.person_id),
      date: String(row.work_date),
      shopKey: String(row.shop_key),
      fieldKey: String(row.field_key),
      name: String(row.name || ""),
      mime: String(row.mime || ""),
      data: "",
      loaded: false
    });
  }
  rests = new Map();
  const [restRows] = await query("SELECT person_id, work_date, rest FROM work_report_diary_rest");
  for (const row of restRows) {
    if (Number(row.rest)) {
      rests.set(restKey(row.person_id, row.work_date), true);
    }
  }
}

export async function readyDiary() {
  if (ready) {
    return;
  }
  if (dbMode() === "mysql") {
    await ensureTables();
    await hydrateMysql();
    await readyDing();
  }
  if (legacyCatalog(catalog.nodes)) {
    catalog = { revision: Number(catalog.revision || 1) + 1, nodes: cloneNodes(DEFAULT_NODES) };
    await saveMeta("catalog", catalog);
  }
  ready = true;
}

function fail(statusCode, error) {
  return { ok: false, statusCode, error };
}

function sharedLabels(labels) {
  const names = new Set(catalog.nodes.filter((node) => node.kind === "metric").map((node) => node.name));
  return (labels || []).map((item) => String(item || "").trim()).filter((item) => item && names.has(item));
}

function reportsByPersonOn(date) {
  const map = new Map();
  for (const row of reports.values()) {
    if (row.date !== date || row.shopKey === PERSONAL) {
      continue;
    }
    const id = Number(row.personId);
    const list = map.get(id);
    if (list) {
      list.push(row);
    } else {
      map.set(id, [row]);
    }
  }
  return map;
}

export async function obligationBundle(date, options = {}) {
  await readyDiary();
  const bundle = await orgBundle();
  const attendance = await loadAttendance({
    date,
    people: bundle.people,
    useSchedule: policy.delivery.useSchedule,
    useLeave: policy.delivery.useLeave,
    operatorPersonId: Number(policy.delivery.operatorPersonId) || 0,
    fresh: Boolean(options.fresh)
  });
  return { bundle, reportsByPerson: reportsByPersonOn(date), attendance };
}

export async function diaryObligation({ person, date, onRoster, templateFilled, templateLabels, bundle, reportsByPerson, attendance }) {
  await readyDiary();
  const packed = bundle || (await orgBundle());
  const manualRest = Boolean(rests.get(restKey(person.id, date)));
  const ownShops = shopsFor(person.id, date, packed.shops, packed.grants);
  const mine = reportsByPerson
    ? reportsByPerson.get(Number(person.id)) || []
    : [...reports.values()].filter((row) => row.personId === Number(person.id) && row.date === date && row.shopKey !== PERSONAL);
  const shopDone = mine.some((row) => row.status === "已提交");
  const shopDraft = mine.some((row) => row.status === "草稿");
  const mark = attendance && attendance.get ? attendance.get(Number(person.id)) : attendance || null;
  let exempt = manualRest || Boolean(mark && mark.exempt);
  let shopRequired = !exempt && onRoster && positionRequired(person) && ownShops.length > 0;
  let templateRequired = !exempt && onRoster;
  let status = "自愿";
  if (exempt) {
    status = "免报";
  } else if (templateRequired || shopRequired) {
    const templateOk = !templateRequired || templateFilled;
    const shopOk = !shopRequired || shopDone;
    status = templateOk && shopOk ? "已报" : "未报";
  }
  let note = shopRequired && !shopDone ? "店铺日报未交" : templateRequired && !templateFilled ? "部门事项未填" : "";
  if (manualRest) {
    note = "已登记休息";
  } else if (mark && mark.exempt) {
    note = mark.reason || "免报";
  } else if (mark && mark.pending && status === "未报") {
    status = "待核对";
    note = mark.reason || "待核对钉钉考勤";
  } else if (mark && mark.reason) {
    note = note ? note + " · " + mark.reason : mark.reason;
  }
  return {
    status,
    exempt: status === "免报",
    manualRest,
    onRoster,
    shopRequired,
    templateRequired,
    shopDone,
    shopDraft,
    shopCount: ownShops.length,
    submittedShops: mine.filter((row) => row.status === "已提交").length,
    sharedLabels: sharedLabels(templateLabels),
    note
  };
}

function blankItem() {
  return { count: 0, spus: "", detail: "", actions: [], images: [] };
}

function publicReport(row, shopName) {
  return {
    shopId: row.shopKey,
    shopName: shopName || row.shopKey,
    status: row.status,
    revision: row.revision,
    items: row.items || {},
    extra: row.extra || [],
    notes: row.notes || "",
    proofs: row.proofs || {}
  };
}

async function saveMeta(key, body) {
  if (dbMode() !== "mysql") {
    return;
  }
  await query(
    `INSERT INTO work_report_diary_meta (meta_key, body, updated_at)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE body = VALUES(body), updated_at = VALUES(updated_at)`,
    [key, JSON.stringify(body), nowStamp()]
  );
}

async function persistReport(row) {
  if (dbMode() !== "mysql") {
    return;
  }
  await query(
    `INSERT INTO work_report_diary (person_id, work_date, shop_key, status, revision, payload, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE status = VALUES(status), revision = VALUES(revision), payload = VALUES(payload), updated_at = VALUES(updated_at)`,
    [
      row.personId,
      row.date,
      row.shopKey,
      row.status,
      row.revision,
      JSON.stringify({ items: row.items, extra: row.extra, notes: row.notes, proofs: row.proofs }),
      nowStamp()
    ]
  );
}

async function deleteReport(row) {
  reports.delete(reportKey(row.personId, row.date, row.shopKey));
  if (dbMode() === "mysql") {
    await query("DELETE FROM work_report_diary WHERE person_id = ? AND work_date = ? AND shop_key = ?", [
      row.personId,
      row.date,
      row.shopKey
    ]);
  }
}

function normalizeReport(input, shopKey, knownImages) {
  const items = {};
  const source = input?.items && typeof input.items === "object" ? input.items : {};
  for (const [key, value] of Object.entries(source)) {
    const id = String(key).slice(0, 64);
    const count = Number(value?.count);
    items[id] = {
      count: Number.isFinite(count) ? Math.max(0, Math.min(100000, Math.round(count))) : 0,
      spus: String(value?.spus || "").slice(0, 2200),
      detail: String(value?.detail || "").slice(0, 600),
      actions: Array.isArray(value?.actions) ? value.actions.map((item) => String(item).slice(0, 40)).slice(0, 20) : [],
      images: (Array.isArray(value?.images) ? value.images : [])
        .map((image) => ({ id: String(image?.id || ""), name: String(image?.name || "").slice(0, 200) }))
        .filter((image) => knownImages.has(image.id))
        .slice(0, 3)
    };
  }
  const proofs = {};
  const proofSource = input?.proofs && typeof input.proofs === "object" ? input.proofs : {};
  for (const [key, value] of Object.entries(proofSource)) {
    proofs[String(key).slice(0, 64)] = (Array.isArray(value) ? value : [])
      .map((image) => ({ id: String(image?.id || ""), name: String(image?.name || "").slice(0, 200) }))
      .filter((image) => knownImages.has(image.id))
      .slice(0, 3);
  }
  return {
    items,
    extra: (Array.isArray(input?.extra) ? input.extra : []).map((item) => String(item).slice(0, 64)).slice(0, 30),
    notes: String(input?.notes || "").slice(0, 2000),
    proofs
  };
}

export async function getDiary(user, queryInput, isAdmin) {
  await readyDiary();
  const date = parseDate(queryInput?.date || todayShanghai());
  if (!date) {
    return fail(400, "请选择今天或之前的工作日期");
  }
  const bundle = await orgBundle();
  const me = bundle.people.find((person) => namesMatch(user, person));
  if (!me && !isAdmin) {
    return fail(400, "对不上组织中心的人");
  }
  const roster = await rosterReader();
  const labels = me ? roster.templateLabels(me, date) : [];
  const shops = me ? shopsFor(me.id, date, bundle.shops, bundle.grants) : [];
  const mine = me
    ? [...reports.values()]
        .filter((row) => row.personId === Number(me.id) && row.date === date)
        .map((row) => publicReport(row, shops.find((shop) => shop.id === row.shopKey)?.name || "岗位日报"))
    : [];
  return {
    ok: true,
    date,
    today: todayShanghai(),
    catalog: publicCatalog(),
    sharedLabels: sharedLabels(labels),
    shops,
    mine,
    leader: me ? isLeader(me, isAdmin, bundle.people, bundle.shops, bundle.grants, date) : isAdmin,
    integration: publicPolicy().integration
  };
}

function namesMatch(user, person) {
  const names = [user?.username, user?.displayName, user?.name]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  if (names.includes(person.name) || names.includes(person.username) || names.includes(String(person.employeeNo || ""))) {
    return true;
  }
  const admin = names.some((name) => name === "罗成" || name.toLowerCase() === "luocheng");
  return admin && (person.employeeNo === "XM001" || person.center === "人员管理");
}

function canSeePerson(viewer, author, admin, day, people, shops, grants) {
  if (admin || (viewer && Number(viewer.id) === Number(author.id))) {
    return true;
  }
  if (!viewer) {
    return false;
  }
  const byId = new Map(people.map((person) => [Number(person.id), person]));
  if (manages(viewer, author, byId)) {
    return true;
  }
  const lead = leaderShopIds(viewer, day, shops, grants);
  return shopsFor(author.id, day, shops, grants).some((shop) => lead.has(shop.id));
}

export async function saveDiary(user, input, isAdmin) {
  await readyDiary();
  const date = parseDate(input?.date);
  if (!date) {
    return fail(400, "请选择今天或之前的工作日期");
  }
  const status = input?.status === "已提交" ? "已提交" : "草稿";
  const bundle = await orgBundle();
  const me = bundle.people.find((person) => namesMatch(user, person));
  if (!me) {
    return fail(400, "对不上组织中心的人");
  }
  if (isAdmin && input?.personId && Number(input.personId) !== Number(me.id)) {
    return fail(403, "只能填自己的店铺日报");
  }
  const allowed = new Map(shopsFor(me.id, date, bundle.shops, bundle.grants).map((shop) => [shop.id, shop]));
  const incoming = Array.isArray(input?.reports) ? input.reports : [];
  if (!incoming.length) {
    return fail(400, "请先添加要填写的店铺");
  }
  const knownImages = new Set(
    [...images.values()].filter((image) => image.personId === Number(me.id) && image.date === date).map((image) => image.id)
  );
  const written = [];
  for (const item of incoming) {
    const shopKey = String(item?.shopId || "").trim();
    if (!allowed.has(shopKey)) {
      return fail(400, "这家店不在你的责权里");
    }
    const current = reports.get(reportKey(me.id, date, shopKey));
    const revision = Number(item?.revision || 0);
    if (current && revision !== current.revision) {
      return fail(409, "这家店的日报已有新版本，请先对照后再保存");
    }
    const payload = normalizeReport(item, shopKey, knownImages);
    const late = payload.items["即将超时订单"];
    if (status === "已提交" && late && late.count > 0 && !String(late.detail || "").trim()) {
      return fail(400, `${allowed.get(shopKey).name}：请填写即将超时订单的原因`);
    }
    const next = {
      personId: Number(me.id),
      date,
      shopKey,
      status: current?.status === "已提交" && status === "草稿" ? "已提交" : status,
      revision: (current?.revision || 0) + 1,
      ...payload
    };
    if (current?.status === "已提交" && status === "草稿") {
      continue;
    }
    reports.set(reportKey(me.id, date, shopKey), next);
    await persistReport(next);
    written.push(shopKey);
  }
  if (status === "草稿") {
    for (const row of [...reports.values()]) {
      if (row.personId === Number(me.id) && row.date === date && row.status === "草稿" && !written.includes(row.shopKey)) {
        await deleteReport(row);
      }
    }
  }
  return getDiary(user, { date }, isAdmin);
}

function imageId() {
  return `img_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function saveDiaryImage(user, input) {
  await readyDiary();
  const date = parseDate(input?.date);
  if (!date) {
    return fail(400, "请选择今天或之前的工作日期");
  }
  const bundle = await orgBundle();
  const me = bundle.people.find((person) => namesMatch(user, person));
  if (!me) {
    return fail(400, "对不上组织中心的人");
  }
  const shopKey = String(input?.shopId || "").trim();
  const allowed = shopsFor(me.id, date, bundle.shops, bundle.grants);
  if (!allowed.some((shop) => shop.id === shopKey)) {
    return fail(400, "这家店不在你的责权里");
  }
  const mime = String(input?.mime || "").toLowerCase();
  if (!IMAGE_MIME.has(mime)) {
    return fail(400, "截图只接收 png、jpeg、webp");
  }
  const data = String(input?.data || "").replace(/^data:[^,]*,/, "");
  let bytes = 0;
  try {
    bytes = Buffer.from(data, "base64").length;
  } catch {
    return fail(400, "截图读取失败");
  }
  if (!bytes || bytes > 3 * 1024 * 1024) {
    return fail(400, "截图不能为空，每张最大 3 MB");
  }
  const fieldKey = String(input?.fieldKey || "").slice(0, 64);
  const existing = [...images.values()].filter(
    (image) =>
      image.personId === Number(me.id) && image.date === date && image.shopKey === shopKey && image.fieldKey === fieldKey
  );
  if (existing.length >= 3) {
    return fail(400, "每条工作明细最多附 3 张截图");
  }
  const image = {
    id: imageId(),
    personId: Number(me.id),
    date,
    shopKey,
    fieldKey,
    name: String(input?.name || "截图").slice(0, 200),
    mime,
    data,
    loaded: true
  };
  images.set(image.id, image);
  if (dbMode() === "mysql") {
    await query(
      `INSERT INTO work_report_diary_images
        (id, person_id, work_date, shop_key, field_key, name, mime, data, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [image.id, image.personId, image.date, image.shopKey, image.fieldKey, image.name, image.mime, image.data, nowStamp()]
    );
  }
  return { ok: true, image: { id: image.id, name: image.name, mime: image.mime } };
}

export async function readDiaryImage(user, id, isAdmin) {
  await readyDiary();
  const image = images.get(String(id || ""));
  if (!image) {
    return fail(404, "找不到这张截图");
  }
  if (!image.loaded && dbMode() === "mysql") {
    const [rows] = await query("SELECT data FROM work_report_diary_images WHERE id = ?", [image.id]);
    image.data = rows[0] ? String(rows[0].data || "") : "";
    image.loaded = true;
  }
  const bundle = await orgBundle();
  const me = bundle.people.find((person) => namesMatch(user, person));
  const author = bundle.people.find((person) => Number(person.id) === image.personId);
  const report = reports.get(reportKey(image.personId, image.date, image.shopKey));
  const submitted = report?.status === "已提交";
  if (!me) {
    return fail(403, "不能查看这张截图");
  }
  if (Number(me.id) === image.personId || (submitted && author && canSeeShop(me, author, image.shopKey, isAdmin, image.date, bundle.people, bundle.shops, bundle.grants))) {
    return { ok: true, id: image.id, name: image.name, mime: image.mime, data: image.data };
  }
  return fail(403, "不能查看这张截图");
}

function metricValue(report, id) {
  const item = report.items?.[id] || {};
  return Number(item.count) || 0;
}

export async function diarySummary(user, queryInput, isAdmin) {
  await readyDiary();
  const from = parseDate(queryInput?.from || todayShanghai());
  const to = parseDate(queryInput?.to || from);
  if (!from || !to || to < from) {
    return fail(400, "请选择有效日期范围");
  }
  const bundle = await orgBundle();
  const me = bundle.people.find((person) => namesMatch(user, person));
  if (!me && !isAdmin) {
    return fail(403, "对不上组织中心的人");
  }
  const personFilter = String(queryInput?.personId || "").trim();
  const shopFilter = String(queryInput?.shopId || "").trim();
  const visible = [];
  for (const row of reports.values()) {
    if (row.status !== "已提交" || row.date < from || row.date > to || row.shopKey === PERSONAL) {
      continue;
    }
    const author = bundle.people.find((person) => Number(person.id) === row.personId);
    if (!author) {
      continue;
    }
    if (!canSeePerson(me, author, isAdmin, row.date, bundle.people, bundle.shops, bundle.grants)) {
      continue;
    }
    if (personFilter && String(author.id) !== personFilter) {
      continue;
    }
    if (shopFilter && row.shopKey !== shopFilter) {
      continue;
    }
    const shop = bundle.shops.find((item) => String(item.id) === row.shopKey);
    visible.push({ row, author, shopName: shop?.name || row.shopKey });
  }
  const metrics = catalog.nodes.filter((node) => node.kind === "metric" && node.enabled !== false);
  const peopleIds = new Set(visible.map((item) => item.author.id));
  const shopIds = new Set(visible.map((item) => item.row.shopKey));
  const totals = {};
  metrics.forEach((node) => {
    totals[node.id] = 0;
  });
  visible.forEach((item) => {
    metrics.forEach((node) => {
      totals[node.id] += metricValue(item.row, node.id);
    });
  });
  const optionPeople = bundle.people
    .filter((person) => canSeePerson(me, person, isAdmin, to, bundle.people, bundle.shops, bundle.grants))
    .map((person) => ({ id: person.id, name: person.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "zh"));
  const optionShops = new Map();
  optionPeople.forEach((person) => {
    shopsFor(person.id, to, bundle.shops, bundle.grants).forEach((shop) => {
      optionShops.set(String(shop.id), shop.name);
    });
  });
  visible.forEach((item) => {
    optionShops.set(String(item.row.shopKey), item.shopName);
  });
  return {
    ok: true,
    from,
    to,
    reportCount: visible.length,
    peopleCount: peopleIds.size,
    shopCount: shopIds.size,
    people: optionPeople,
    shops: [...optionShops.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "zh")),
    metrics: metrics.map((node) => ({
      id: node.id,
      name: node.name,
      unit: node.unit,
      total: totals[node.id] || 0
    })),
    rows: visible.map((item) => ({
      ...publicReport(item.row, item.shopName),
      day: item.row.date,
      personId: item.author.id,
      personName: item.author.name
    }))
  };
}

function shiftDate(day, offset) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export async function diaryDuty(user, queryInput, isAdmin) {
  await readyDiary();
  const date = parseDate(queryInput?.date || todayShanghai());
  if (!date) {
    return fail(400, "日期不合法");
  }
  const packed = await obligationBundle(date);
  const bundle = packed.bundle;
  const me = bundle.people.find((person) => namesMatch(user, person));
  if (!me || !isLeader(me, isAdmin, bundle.people, bundle.shops, bundle.grants, date)) {
    return fail(403, "只有负责人可以看提交情况");
  }
  const roster = await rosterReader();
  const rows = [];
  for (const person of bundle.people) {
    const dept = roster.memberDept(person.id);
    const onRoster = Boolean(dept);
    const labels = roster.templateLabels(person, date);
    const filled = roster.templateFilled(person, date);
    const obligation = await diaryObligation({
      person,
      date,
      onRoster,
      templateFilled: filled,
      templateLabels: labels,
      bundle,
      reportsByPerson: packed.reportsByPerson,
      attendance: packed.attendance
    });
    if (!onRoster && !obligation.shopRequired && obligation.status === "自愿" && !obligation.shopDraft && !obligation.shopDone) {
      continue;
    }
    if (!canSeePerson(me, person, isAdmin, date, bundle.people, bundle.shops, bundle.grants)) {
      continue;
    }
    rows.push({
      personId: person.id,
      name: person.name,
      role: person.role,
      deptName: dept ? roster.deptName(dept) : "",
      status: obligation.status,
      template: obligation.templateRequired ? (filled ? "已填" : "未填") : "不用",
      diary: obligation.shopRequired ? (obligation.shopDone ? "已交" : obligation.shopDraft ? "草稿" : "未交") : obligation.shopDone ? "已交" : "不用",
      shops: obligation.submittedShops,
      shopCount: obligation.shopCount,
      manualRest: obligation.manualRest,
      note: obligation.note
    });
  }
  const counted = rows.filter((row) => row.status === "已报" || row.status === "未报");
  const done = counted.filter((row) => row.status === "已报").length;
  return {
    ok: true,
    date,
    summary: {
      should: counted.length,
      done,
      miss: counted.length - done,
      exempt: rows.filter((row) => row.status === "免报").length,
      pending: rows.filter((row) => row.status === "待核对").length,
      people: counted.length,
      shops: rows.reduce((sum, row) => sum + Number(row.shops || 0), 0)
    },
    rows
  };
}

export async function saveDiaryRest(user, input, isAdmin) {
  await readyDiary();
  const date = parseDate(input?.date);
  if (!date) {
    return fail(400, "日期不合法");
  }
  const bundle = await orgBundle();
  const me = bundle.people.find((person) => namesMatch(user, person));
  const target = bundle.people.find((person) => Number(person.id) === Number(input?.personId));
  if (!me || !target) {
    return fail(400, "人员不在组织中心在职名单");
  }
  const byId = new Map(bundle.people.map((person) => [Number(person.id), person]));
  if (!isAdmin && !manages(me, target, byId)) {
    return fail(403, "只能给自己负责的人登记休息");
  }
  const key = restKey(target.id, date);
  const rest = Boolean(input?.rest);
  if (rest) {
    rests.set(key, true);
  } else {
    rests.delete(key);
  }
  if (dbMode() === "mysql") {
    await query(
      `INSERT INTO work_report_diary_rest (person_id, work_date, rest, updated_at)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE rest = VALUES(rest), updated_at = VALUES(updated_at)`,
      [target.id, date, rest ? 1 : 0, nowStamp()]
    );
  }
  return diaryDuty(user, { date }, isAdmin);
}

function cleanCatalog(input) {
  const nodes = cloneNodes(input?.nodes);
  const kinds = new Set(["section", "lane", "metric", "extra", "note", "choice"]);
  if (!nodes.length || nodes.length > 80) {
    return fail(400, "填报项目数量不合法");
  }
  const ids = new Set();
  for (const node of nodes) {
    if (!node.id || ids.has(node.id) || !kinds.has(node.kind) || !node.name.trim()) {
      return fail(400, "请填写项目名称");
    }
    ids.add(node.id);
    node.name = node.name.trim().slice(0, 40);
    node.unit = node.unit.trim().slice(0, 8);
  }
  return { ok: true, nodes };
}

function bindRows(people, proposals) {
  const proposed = new Map((proposals || []).map((row) => [Number(row.personId), row]));
  return people
    .filter((person) => person.status !== "离职")
    .map((person) => {
      const saved = confirmedBinds().find((row) => row.personId === Number(person.id));
      const proposal = proposed.get(Number(person.id));
      return {
        personId: Number(person.id),
        name: person.name,
        employeeNo: person.employeeNo || "",
        department: person.department || "",
        userid: saved?.userid || "",
        match: saved?.match || proposal?.match || "",
        confirmed: Boolean(saved),
        candidates: proposal?.candidates || []
      };
    });
}

export async function getDiarySettings(user, isAdmin) {
  await readyDiary();
  if (!isAdmin) {
    return fail(403, "只有罗成可以改日报设置");
  }
  const bundle = await orgBundle();
  const flags = dingPublic();
  const saved = confirmedBinds();
  return {
    ok: true,
    catalog: publicCatalog(),
    policy: {
      ...publicPolicy(),
      integration: {
        ...flags,
        bound: saved.length,
        operator: saved.some((row) => row.personId === Number(policy.delivery.operatorPersonId))
      }
    },
    binds: bindRows(bundle.people)
  };
}

export async function syncDingBinds(user, isAdmin) {
  await readyDiary();
  if (!isAdmin) {
    return fail(403, "只有罗成可以改日报设置");
  }
  if (!dingPublic().app) {
    return fail(400, "钉钉企业应用未配置");
  }
  const bundle = await orgBundle();
  let proposals = [];
  try {
    proposals = await syncBinds(bundle.people);
  } catch (error) {
    return fail(502, error.publicMessage || "钉钉接口失败");
  }
  const settings = await getDiarySettings(user, true);
  settings.binds = bindRows(bundle.people, proposals);
  return settings;
}

export async function activateDing(user, isAdmin) {
  await readyDiary();
  if (!isAdmin) {
    return fail(403, "只有罗成可以改日报设置");
  }
  if (!dingPublic().app) {
    return fail(400, "钉钉企业应用未配置");
  }
  const bundle = await orgBundle();
  let proposals = [];
  try {
    proposals = await syncBinds(bundle.people);
  } catch (error) {
    return fail(502, error.publicMessage || "钉钉接口失败");
  }
  const agent = await discoverAgent();
  const attendance = await probeAttendance(bundle.people);
  if (attendance.ok && attendance.rows > 0) {
    policy.delivery = {
      ...policy.delivery,
      revision: policy.delivery.revision + 1,
      useSchedule: true,
      operatorPersonId: attendance.personId
    };
  } else if (attendance.ok) {
    policy.delivery = { ...policy.delivery, operatorPersonId: attendance.personId };
  }
  if (attendance.leaveOk) {
    policy.delivery = { ...policy.delivery, useLeave: true };
  }
  policy.delivery = { ...policy.delivery, remind: Boolean(agent.ok) };
  policy.revision += 1;
  await saveMeta("policy", policy);
  const settings = await getDiarySettings(user, true);
  settings.binds = bindRows(bundle.people, proposals);
  settings.activation = {
    agent: Boolean(agent.ok),
    agentNote: agent.error || "",
    appNames: agent.names || [],
    appName: agent.chosenName || "",
    schedule: Boolean(attendance.ok && attendance.rows > 0),
    scheduleRows: attendance.rows || 0,
    leave: Boolean(attendance.leaveOk),
    operator: Boolean(attendance.ok),
    note: attendance.error || ""
  };
  return settings;
}

export async function saveDingApp(user, input, isAdmin) {
  await readyDiary();
  if (!isAdmin) {
    return fail(403, "只有罗成可以改日报设置");
  }
  const saved = await saveAppConfig(input || {});
  if (!saved.ok) {
    return fail(400, saved.error || "应用凭证不完整");
  }
  policy.delivery = {
    ...policy.delivery,
    revision: policy.delivery.revision + 1,
    remind: true,
    remindAt: policy.delivery.remindAt || "18:00"
  };
  policy.revision += 1;
  await saveMeta("policy", policy);
  const settings = await getDiarySettings(user, true);
  settings.activation = { agent: true, remind: true };
  return settings;
}

export async function saveDingBinds(user, input, isAdmin) {
  await readyDiary();
  if (!isAdmin) {
    return fail(403, "只有罗成可以改日报设置");
  }
  const bundle = await orgBundle();
  const known = new Set(bundle.people.map((person) => Number(person.id)));
  const rows = (Array.isArray(input?.binds) ? input.binds : []).filter((row) => known.has(Number(row.personId)));
  await saveBinds(rows.map((row) => ({ personId: row.personId, userid: row.userid, match: "人工" })));
  return getDiarySettings(user, true);
}

export async function noteMemberAdded(personId) {
  await readyDiary();
  const date = shanghaiNow().date;
  const packed = await obligationBundle(date);
  const person = packed.bundle.people.find((item) => Number(item.id) === Number(personId));
  const roster = await rosterReader();
  if (!person || !roster.memberDept(person.id)) {
    return { sent: false };
  }
  const obligation = await diaryObligation({
    person,
    date,
    onRoster: true,
    templateFilled: roster.templateFilled(person, date),
    templateLabels: roster.templateLabels(person, date),
    bundle: packed.bundle,
    reportsByPerson: packed.reportsByPerson,
    attendance: packed.attendance
  });
  if (obligation.status !== "未报") {
    return { sent: false };
  }
  const userid = dingUserOf(person.id);
  if (!userid) {
    return { sent: false };
  }
  const claimed = await claimReminder(person.id, `${date}#new`);
  if (!claimed) {
    return { sent: false };
  }
  try {
    await sendTaskNotice(userid, "待办事项", `今天的日报还没提交。截止日期 ${date}。`, workLink("todo"), "去处理", person.name);
    return { sent: true };
  } catch (error) {
    await releaseReminder(person.id, `${date}#new`);
    return { sent: false, error: error.publicMessage || "钉钉接口失败" };
  }
}

export async function reminderTargets(date) {
  await readyDiary();
  const packed = await obligationBundle(date, { fresh: true });
  const roster = await rosterReader();
  const targets = [];
  for (const person of packed.bundle.people) {
    if (!roster.memberDept(person.id)) {
      continue;
    }
    const obligation = await diaryObligation({
      person,
      date,
      onRoster: true,
      templateFilled: roster.templateFilled(person, date),
      templateLabels: roster.templateLabels(person, date),
      bundle: packed.bundle,
      reportsByPerson: packed.reportsByPerson,
      attendance: packed.attendance
    });
    const bind = confirmedBinds().find((row) => row.personId === Number(person.id));
    if (obligation.status === "未报" && bind?.userid) {
      targets.push({ personId: Number(person.id), userid: bind.userid, name: person.name });
    }
  }
  return targets;
}

export async function runDiaryReminder(now = new Date()) {
  await readyDiary();
  const delivery = policy.delivery;
  if (!delivery.remind || !dingPublic().app || !dingPublic().agent) {
    return { sent: 0 };
  }
  const clock = shanghaiNow(now);
  if (!inRemindWindow(delivery.remindAt, clock.hm)) {
    return { sent: 0 };
  }
  const targets = await reminderTargets(clock.date);
  let sent = 0;
  for (const target of targets) {
    const claimed = await claimReminder(target.personId, clock.date);
    if (!claimed) {
      continue;
    }
    try {
      await sendWorkNotice(target.userid, target.name);
      sent += 1;
    } catch (error) {
      await releaseReminder(target.personId, clock.date);
      console.error("日报提醒未发出", error.publicMessage || "钉钉接口失败");
    }
  }
  return { sent };
}

let reminderTimer = null;
export function startDiaryReminder() {
  if (reminderTimer) {
    return;
  }
  reminderTimer = setInterval(() => {
    runDiaryReminder().catch((error) => {
      console.error("日报提醒未发出", error.publicMessage || error.message || "失败");
    });
  }, 30000);
  reminderTimer.unref?.();
}

export async function saveDiarySettings(user, input, isAdmin) {
  await readyDiary();
  if (!isAdmin) {
    return fail(403, "只有罗成可以改日报设置");
  }
  if (Array.isArray(input?.positions)) {
    if (Number(input.revision) && Number(input.revision) !== policy.revision) {
      return fail(409, "日报设置已有新版本");
    }
    policy.positions = input.positions.map((item) => String(item)).filter((item) => POSITIONS.includes(item));
    policy.revision += 1;
  }
  if (input?.delivery) {
    const remindAt = String(input.delivery.remindAt || "18:00");
    if (!/^\d{2}:\d{2}$/.test(remindAt)) {
      return fail(400, "提醒时间不合法");
    }
    policy.delivery = {
      revision: policy.delivery.revision + 1,
      useSchedule: Boolean(input.delivery.useSchedule),
      useLeave: Boolean(input.delivery.useLeave),
      remind: Boolean(input.delivery.remind),
      remindAt,
      operatorPersonId: Number(input.delivery.operatorPersonId) || 0
    };
    policy.revision += 1;
  }
  if (input?.catalog) {
    const cleaned = cleanCatalog(input.catalog);
    if (!cleaned.ok) {
      return cleaned;
    }
    catalog = { revision: catalog.revision + 1, nodes: cleaned.nodes };
    await saveMeta("catalog", catalog);
  }
  await saveMeta("policy", policy);
  return getDiarySettings(user, true);
}

export function positionOptions() {
  return POSITIONS;
}
