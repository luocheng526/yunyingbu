/* 工作汇报填报。 */
import { dbMode, query } from "../profile/auth.js";
import { bindRoster, diaryObligation, loadOrg, noteMemberAdded, obligationBundle, readyDiary, resetDiaryStore } from "./diary.js";
import { releaseReminder } from "./dingtalk.js";
import { resetTaskStore } from "./tasks.js";

export const WORK_DEPTS = [
  { code: "ops", name: "运营部" },
  { code: "hr", name: "人事部" },
  { code: "tech", name: "技术部" }
];

export const DEFAULT_TEMPLATES = {
  ops: [
    { key: "shop", label: "店铺运营" },
    { key: "ads", label: "推广投放" },
    { key: "review", label: "数据复盘" },
    { key: "help", label: "需协助事项" }
  ],
  hr: [
    { key: "hire", label: "招聘进展" },
    { key: "onoff", label: "入离职" },
    { key: "attend", label: "考勤对接" },
    { key: "help", label: "需协助事项" }
  ],
  tech: [
    { key: "dev", label: "开发事项" },
    { key: "bug", label: "线上问题" },
    { key: "ship", label: "发布/运维" },
    { key: "help", label: "需协助事项" }
  ]
};

const DEPT_CODES = new Set(WORK_DEPTS.map((item) => item.code));
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

let ready = false;
let members = new Map();
let templates = new Map();
let rows = new Map();

function nowStamp() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

export function todayShanghai() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
}

export function deptName(code) {
  return WORK_DEPTS.find((item) => item.code === code)?.name || "";
}

export function isWorkAdmin(user) {
  return namesOf(user).some((name) => name === "罗成" || name.toLowerCase() === "luocheng");
}

function formatRights(person) {
  const shops = Array.isArray(person.visibleShops) ? person.visibleShops.map((item) => String(item)) : [];
  if (!shops.length) {
    return String(person.role || "");
  }
  if (shops.length <= 2) {
    return shops.join("、");
  }
  return `${shops.slice(0, 2).join("、")} 等${shops.length}店`;
}

export const ORG_BOARDS = [
  { code: "ops", name: "运营部门" },
  { code: "hrTech", name: "人事和技术部门" },
  { code: "backend", name: "后端部门" }
];

const SEATS = [
  ["director", "总监"],
  ["lineManager", "经理"],
  ["supervisor", "主管"],
  ["reserve", "储备"],
  ["operator", "运营"],
  ["assistant", "助理"]
];

function dutyValue(value) {
  const text = String(value || "").trim();
  return text === "无" ? "" : text;
}

export function orgBoardName(code) {
  return ORG_BOARDS.find((item) => item.code === code)?.name || "";
}

export function seatOf(person) {
  const name = String(person?.name || "").trim();
  if (!name) {
    return "";
  }
  return SEATS.filter(([key]) => dutyValue(person[key]) === name)
    .map(([, label]) => label)
    .join("、");
}

export function dutyText(person) {
  const name = String(person?.name || "").trim();
  return SEATS.filter(([key]) => key !== "director" || dutyValue(person?.director) === name)
    .map(([key, label]) => {
      const value = dutyValue(person?.[key]);
      return value ? `${label} ${value}` : "";
    })
    .filter(Boolean)
    .join(" · ");
}

function namesOf(user) {
  if (!user) {
    return [];
  }
  if (typeof user === "string") {
    return [user.trim()].filter(Boolean);
  }
  return [user.username, user.displayName, user.name]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function templateKey(scopeType, scopeId) {
  return `${scopeType}:${scopeId}`;
}

function rowKey(personId, date, itemKey) {
  return `${Number(personId)}|${date}|${itemKey}`;
}

function cloneItems(list) {
  return (Array.isArray(list) ? list : []).map((item) => ({
    key: String(item.key || ""),
    label: String(item.label || "")
  }));
}

function seedDefaultTemplates() {
  for (const dept of WORK_DEPTS) {
    const key = templateKey("dept", dept.code);
    if (!templates.has(key)) {
      templates.set(key, cloneItems(DEFAULT_TEMPLATES[dept.code]));
    }
  }
}

export function resetWorkStore() {
  ready = false;
  members = new Map();
  templates = new Map();
  rows = new Map();
  resetDiaryStore();
  resetTaskStore();
}

async function ignoreDuplicate(work) {
  try {
    await work();
  } catch (err) {
    const message = String(err && err.message ? err.message : err);
    if (!/already exists|Duplicate/i.test(message)) {
      throw err;
    }
  }
}

async function ensureTables() {
  await query(
    `CREATE TABLE IF NOT EXISTS work_report_members (
      person_id INT NOT NULL PRIMARY KEY,
      dept_code VARCHAR(16) NOT NULL,
      updated_at VARCHAR(40) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
  await query(
    `CREATE TABLE IF NOT EXISTS work_report_templates (
      scope_type VARCHAR(16) NOT NULL,
      scope_id VARCHAR(32) NOT NULL,
      items_json MEDIUMTEXT NOT NULL,
      updated_at VARCHAR(40) NOT NULL,
      PRIMARY KEY (scope_type, scope_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
  await query(
    `CREATE TABLE IF NOT EXISTS work_report_rows (
      person_id INT NOT NULL,
      work_date CHAR(10) NOT NULL,
      item_key VARCHAR(64) NOT NULL,
      content TEXT NOT NULL,
      updated_at VARCHAR(40) NOT NULL,
      PRIMARY KEY (person_id, work_date, item_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
  await ignoreDuplicate(() => Promise.resolve());
}

async function hydrateMysql() {
  members = new Map();
  templates = new Map();
  rows = new Map();
  const [memberRows] = await query("SELECT person_id, dept_code FROM work_report_members");
  for (const row of memberRows) {
    const code = String(row.dept_code || "");
    if (DEPT_CODES.has(code)) {
      members.set(Number(row.person_id), code);
    }
  }
  const [templateRows] = await query("SELECT scope_type, scope_id, items_json FROM work_report_templates");
  for (const row of templateRows) {
    let items = [];
    try {
      items = JSON.parse(row.items_json || "[]");
    } catch {
      items = [];
    }
    templates.set(templateKey(String(row.scope_type), String(row.scope_id)), cloneItems(items));
  }
  const [reportRows] = await query("SELECT person_id, work_date, item_key, content FROM work_report_rows");
  for (const row of reportRows) {
    rows.set(rowKey(row.person_id, row.work_date, row.item_key), String(row.content || ""));
  }
  seedDefaultTemplates();
  for (const dept of WORK_DEPTS) {
    const key = templateKey("dept", dept.code);
    const items = templates.get(key) || [];
    await query(
      `INSERT IGNORE INTO work_report_templates (scope_type, scope_id, items_json, updated_at)
       VALUES (?, ?, ?, ?)`,
      ["dept", dept.code, JSON.stringify(items), nowStamp()]
    );
  }
}

async function readyStore() {
  if (ready) {
    return;
  }
  if (dbMode() === "mysql") {
    await ensureTables();
    await hydrateMysql();
  } else {
    seedDefaultTemplates();
  }
  await readyDiary();
  ready = true;
}

export async function orgPeople() {
  const packed = await loadOrg();
  const list = packed.people;
  let usernameById = new Map();
  if (dbMode() === "mysql") {
    try {
      const [rows] = await query("SELECT id, username FROM people");
      usernameById = new Map(rows.map((row) => [Number(row.id), String(row.username || "").trim()]));
    } catch {
      usernameById = new Map();
    }
  }
  return list.map((person) => {
    const username =
      person.username ||
      usernameById.get(Number(person.id)) ||
      (person.employeeNo === "XM001" || person.center === "人员管理" ? "罗成" : "");
    const board = String(person.board || person.orgBoard || "").trim();
    return {
      id: Number(person.id),
      organizationManaged: person.demo !== true || Number(person.orgRevision || 0) > 0,
      name: String(person.name || ""),
      role: String(person.role || ""),
      center: String(person.center || ""),
      department: String(person.department || ""),
      employeeNo: String(person.employeeNo || ""),
      managerName: String(person.managerName || ""),
      status: String(person.status || ""),
      username,
      director: dutyValue(person.director),
      lineManager: dutyValue(person.lineManager),
      supervisor: dutyValue(person.supervisor),
      reserve: dutyValue(person.reserve),
      operator: dutyValue(person.operator),
      assistant: dutyValue(person.assistant),
      board,
      visibleShops: Array.isArray(person.visibleShops) ? person.visibleShops.map((item) => String(item)) : [],
      rights: formatRights(person)
    };
  });
}

export async function matchPerson(user) {
  await readyStore();
  const aliases = namesOf(user);
  const people = await orgPeople();
  const hit =
    people.find((person) => aliases.includes(person.username) || aliases.includes(person.name)) ||
    (isWorkAdmin(user)
      ? people.find((person) => person.employeeNo === "XM001" || person.center === "人员管理")
      : null);
  return hit || null;
}

function textLooksHr(value) {
  const text = String(value || "").trim();
  if (!text || text.includes("人员管理")) {
    return false;
  }
  if (text === "人事" || text.includes("人事部")) {
    return true;
  }
  return /人事(专员|主管|经理|总监)$/.test(text);
}

function isStaffBrain(user) {
  return namesOf(user).some((name) => {
    const lower = name.toLowerCase();
    return name === "罗成" || lower === "luocheng" || name === "韩梦凯" || name === "沈子晗";
  });
}

export async function deskOf(user) {
  if (!user || isStaffBrain(user)) {
    return "";
  }
  await readyStore();
  const me = await matchPerson(user);
  const code = me ? members.get(Number(me.id)) || "" : "";
  if (code === "hr") {
    return "hr";
  }
  const bag = [
    user.department,
    user.center,
    user.role,
    user.username,
    user.displayName,
    user.name,
    me && me.department,
    me && me.center,
    me && me.role,
    me && me.name,
    me && me.username
  ];
  if (bag.some(textLooksHr)) {
    return "hr";
  }
  return "";
}

function parseDate(raw) {
  const value = String(raw || "").trim();
  if (!value) {
    return todayShanghai();
  }
  if (!DATE_RE.test(value)) {
    return "";
  }
  return value;
}

export function normalizeItems(input) {
  const list = Array.isArray(input) ? input : [];
  const out = [];
  const used = new Set();
  list.forEach((item, index) => {
    const label = String(item?.label || "").trim().slice(0, 40);
    if (!label) {
      return;
    }
    let key = String(item?.key || "")
      .trim()
      .slice(0, 64)
      .replace(/[^\w\u4e00-\u9fff-]/g, "");
    if (!key) {
      key = `item_${index + 1}`;
    }
    if (used.has(key)) {
      key = `${key}_${index + 1}`;
    }
    used.add(key);
    out.push({ key, label });
  });
  return out.slice(0, 20);
}

function itemsFor(personId, deptCode) {
  const personItems = templates.get(templateKey("person", String(personId)));
  if (personItems && personItems.length) {
    return cloneItems(personItems);
  }
  return cloneItems(templates.get(templateKey("dept", deptCode)) || DEFAULT_TEMPLATES[deptCode] || []);
}

function publicPerson(person, deptCode) {
  const board = String(person.board || "");
  return {
    id: person.id,
    name: person.name,
    role: person.role,
    center: person.center,
    department: person.department,
    employeeNo: person.employeeNo,
    managerName: person.managerName,
    username: person.username,
    rights: person.rights,
    visibleShops: person.visibleShops,
    orgBoard: board,
    orgBoardName: orgBoardName(board),
    seat: seatOf(person),
    duty: dutyText(person),
    deptCode: deptCode || "",
    deptName: deptName(deptCode)
  };
}

export async function snapshot(user) {
  await readyStore();
  const me = await matchPerson(user);
  const admin = isWorkAdmin(user);
  const deptCode = me ? members.get(Number(me.id)) || "" : "";
  return {
    ok: true,
    today: todayShanghai(),
    isAdmin: admin,
    depts: WORK_DEPTS,
    orgBoards: ORG_BOARDS,
    me: me ? publicPerson(me, deptCode) : null,
    needReport: Boolean(deptCode) || admin
  };
}

export async function getSettings(user) {
  await readyStore();
  if (!isWorkAdmin(user)) {
    return { ok: false, statusCode: 403, error: "只有罗成可以改部门设置" };
  }
  const people = (await orgPeople()).filter((person) => person.status !== "离职");
  const memberList = [];
  for (const [personId, deptCode] of members.entries()) {
    const person = people.find((item) => item.id === personId);
    if (!person) {
      continue;
    }
    memberList.push({
      personId,
      deptCode,
      deptName: deptName(deptCode),
      person: publicPerson(person, deptCode)
    });
  }
  const templateMap = {};
  for (const dept of WORK_DEPTS) {
    templateMap[dept.code] = itemsFor(0, dept.code);
  }
  const personTemplates = {};
  for (const [key, items] of templates.entries()) {
    if (key.startsWith("person:")) {
      personTemplates[key.slice("person:".length)] = cloneItems(items);
    }
  }
  return {
    ok: true,
    depts: WORK_DEPTS,
    orgBoards: ORG_BOARDS,
    people: people.map((person) => publicPerson(person, members.get(person.id) || "")),
    members: memberList,
    templates: templateMap,
    personTemplates
  };
}

export async function saveMembers(user, input) {
  await readyStore();
  if (!isWorkAdmin(user)) {
    return { ok: false, statusCode: 403, error: "只有罗成可以改部门设置" };
  }
  const list = Array.isArray(input?.members)
    ? input.members
    : input?.personId != null
      ? [{ personId: input.personId, deptCode: input.deptCode }]
      : [];
  if (!list.length) {
    return { ok: false, statusCode: 400, error: "请选择人员" };
  }
  const people = await orgPeople();
  const byId = new Map(people.map((person) => [Number(person.id), person]));
  for (const item of list) {
    const personId = Number(item.personId);
    const deptCode = String(item.deptCode || "").trim();
    const person = byId.get(personId);
    if (!person || person.status === "离职") {
      return { ok: false, statusCode: 400, error: "人员不在组织中心在职名单" };
    }
    if (deptCode && !DEPT_CODES.has(deptCode)) {
      return { ok: false, statusCode: 400, error: "只给运营部、人事部、技术部排汇报" };
    }
    if (!deptCode) {
      members.delete(personId);
      if (dbMode() === "mysql") {
        await query("DELETE FROM work_report_members WHERE person_id = ?", [personId]);
      }
      try {
        await releaseReminder(personId, `${todayShanghai()}#new`);
      } catch {
        /* 取消提醒标记失败不影响移出。 */
      }
      continue;
    }
    const isNew = !members.has(personId);
    members.set(personId, deptCode);
    if (dbMode() === "mysql") {
      await query(
        `INSERT INTO work_report_members (person_id, dept_code, updated_at)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE dept_code = VALUES(dept_code), updated_at = VALUES(updated_at)`,
        [personId, deptCode, nowStamp()]
      );
    }
    if (isNew) {
      try {
        await noteMemberAdded(personId);
      } catch {
        /* 提醒失败不影响排进部门。 */
      }
    }
  }
  return getSettings(user);
}

export async function myTodoCount(user) {
  await readyStore();
  const me = await matchPerson(user);
  if (!me || me.status === "离职") {
    return 0;
  }
  const deptCode = members.get(Number(me.id));
  if (!deptCode) {
    return 0;
  }
  const date = todayShanghai();
  const row = await applyDayStatus(reportOf(me, deptCode, date), me, date, await obligationBundle(date));
  return row.status === "未报" ? 1 : 0;
}

export async function saveTemplate(user, input) {
  await readyStore();
  if (!isWorkAdmin(user)) {
    return { ok: false, statusCode: 403, error: "只有罗成可以改部门设置" };
  }
  const items = normalizeItems(input?.items);
  if (!items.length && !input?.clearPerson) {
    return { ok: false, statusCode: 400, error: "至少保留一项工作事项" };
  }
  const personId = input?.personId == null || input.personId === "" ? 0 : Number(input.personId);
  if (personId) {
    const deptCode = members.get(personId);
    if (!deptCode) {
      return { ok: false, statusCode: 400, error: "先把人排进运营部、人事部或技术部" };
    }
    const key = templateKey("person", String(personId));
    if (input?.clearPerson || input?.useDept) {
      templates.delete(key);
      if (dbMode() === "mysql") {
        await query("DELETE FROM work_report_templates WHERE scope_type = ? AND scope_id = ?", ["person", String(personId)]);
      }
    } else {
      templates.set(key, items);
      if (dbMode() === "mysql") {
        await query(
          `INSERT INTO work_report_templates (scope_type, scope_id, items_json, updated_at)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE items_json = VALUES(items_json), updated_at = VALUES(updated_at)`,
          ["person", String(personId), JSON.stringify(items), nowStamp()]
        );
      }
    }
    return getSettings(user);
  }
  const deptCode = String(input?.deptCode || "").trim();
  if (!DEPT_CODES.has(deptCode)) {
    return { ok: false, statusCode: 400, error: "只给运营部、人事部、技术部配模板" };
  }
  const key = templateKey("dept", deptCode);
  templates.set(key, items);
  if (dbMode() === "mysql") {
    await query(
      `INSERT INTO work_report_templates (scope_type, scope_id, items_json, updated_at)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE items_json = VALUES(items_json), updated_at = VALUES(updated_at)`,
      ["dept", deptCode, JSON.stringify(items), nowStamp()]
    );
  }
  return getSettings(user);
}

function reportOf(person, deptCode, date) {
  const items = itemsFor(person.id, deptCode).map((item) => ({
    key: item.key,
    label: item.label,
    content: rows.get(rowKey(person.id, date, item.key)) || ""
  }));
  const templateFilled = items.some((item) => item.content.trim());
  return {
    person: publicPerson(person, deptCode),
    deptCode,
    deptName: deptName(deptCode),
    items,
    templateFilled,
    submitted: templateFilled,
    status: templateFilled ? "已报" : "未报"
  };
}

async function applyDayStatus(row, person, date, ctx) {
  const obligation = await diaryObligation({
    person,
    date,
    onRoster: true,
    templateFilled: row.templateFilled,
    templateLabels: row.items.map((item) => item.label),
    bundle: ctx && ctx.bundle,
    reportsByPerson: ctx && ctx.reportsByPerson,
    attendance: ctx && ctx.attendance
  });
  row.submitted = obligation.status === "已报";
  row.status = obligation.status;
  row.statusNote = obligation.note || "";
  row.diary = {
    shopRequired: obligation.shopRequired,
    templateRequired: obligation.templateRequired,
    shopDone: obligation.shopDone
  };
  return row;
}

export async function getReport(user, queryInput) {
  await readyStore();
  const date = parseDate(queryInput?.date);
  if (!date) {
    return { ok: false, statusCode: 400, error: "日期不合法" };
  }
  const admin = isWorkAdmin(user);
  const me = await matchPerson(user);
  const deptFilter = String(queryInput?.dept || "").trim();
  if (deptFilter && !DEPT_CODES.has(deptFilter)) {
    return { ok: false, statusCode: 400, error: "部门不合法" };
  }
  const people = await orgPeople();
  const byId = new Map(people.map((person) => [Number(person.id), person]));
  const ctx = await obligationBundle(date);
  if (!admin) {
    if (!me || !members.get(Number(me.id))) {
      return {
        ok: true,
        date,
        today: todayShanghai(),
        isAdmin: false,
        needReport: false,
        rows: [],
        summary: { should: 0, done: 0, miss: 0 }
      };
    }
    const deptCode = members.get(Number(me.id));
    const row = await applyDayStatus(reportOf(me, deptCode, date), me, date, ctx);
    return {
      ok: true,
      date,
      today: todayShanghai(),
      isAdmin: false,
      needReport: true,
      rows: [row],
      summary: {
        should: row.status === "免报" ? 0 : 1,
        done: row.status === "已报" ? 1 : 0,
        miss: row.status === "已报" || row.status === "免报" ? 0 : 1
      }
    };
  }
  const list = [];
  for (const [personId, deptCode] of members.entries()) {
    if (deptFilter && deptCode !== deptFilter) {
      continue;
    }
    const person = byId.get(Number(personId));
    if (!person || person.status === "离职") {
      continue;
    }
    list.push(await applyDayStatus(reportOf(person, deptCode, date), person, date, ctx));
  }
  list.sort((a, b) => {
    const dept = a.deptCode.localeCompare(b.deptCode);
    if (dept) {
      return dept;
    }
    return a.person.name.localeCompare(b.person.name, "zh");
  });
  const counted = list.filter((item) => item.status === "已报" || item.status === "未报");
  const done = counted.filter((item) => item.status === "已报").length;
  return {
    ok: true,
    date,
    today: todayShanghai(),
    isAdmin: true,
    needReport: true,
    rows: list,
    summary: { should: counted.length, done, miss: counted.length - done }
  };
}

bindRoster(async () => ({
  memberDept(id) {
    return members.get(Number(id)) || "";
  },
  deptName(code) {
    return deptName(code);
  },
  templateLabels(person, date) {
    const deptCode = members.get(Number(person.id));
    if (!deptCode) {
      return [];
    }
    return itemsFor(person.id, deptCode).map((item) => item.label);
  },
  templateFilled(person, date) {
    const deptCode = members.get(Number(person.id));
    if (!deptCode) {
      return false;
    }
    return itemsFor(person.id, deptCode).some((item) => String(rows.get(rowKey(person.id, date, item.key)) || "").trim());
  },
  templateContent(person, date, label) {
    const deptCode = members.get(Number(person.id));
    if (!deptCode) {
      return "";
    }
    const item = itemsFor(person.id, deptCode).find((entry) => entry.label === label);
    return item ? rows.get(rowKey(person.id, date, item.key)) || "" : "";
  }
}));

export async function saveReport(user, input) {
  await readyStore();
  const date = parseDate(input?.date);
  if (!date) {
    return { ok: false, statusCode: 400, error: "日期不合法" };
  }
  const admin = isWorkAdmin(user);
  const me = await matchPerson(user);
  const requestedId = input?.personId == null || input.personId === "" ? 0 : Number(input.personId);
  const personId = admin && requestedId ? requestedId : me ? Number(me.id) : 0;
  if (!personId) {
    return { ok: false, statusCode: 400, error: "对不上组织中心的人" };
  }
  const deptCode = members.get(personId);
  if (!deptCode) {
    return { ok: false, statusCode: 400, error: "这个人不用汇报" };
  }
  if (!admin && (!me || Number(me.id) !== personId)) {
    return { ok: false, statusCode: 403, error: "只能填自己的汇报" };
  }
  const people = await orgPeople();
  const person = people.find((item) => item.id === personId);
  if (!person || person.status === "离职") {
    return { ok: false, statusCode: 400, error: "人员不在组织中心在职名单" };
  }
  const allowed = new Set(itemsFor(personId, deptCode).map((item) => item.key));
  const incoming = Array.isArray(input?.items) ? input.items : [];
  for (const item of incoming) {
    const key = String(item?.key || "").trim();
    if (!key || !allowed.has(key)) {
      continue;
    }
    const content = String(item?.content || "").trim().slice(0, 2000);
    rows.set(rowKey(personId, date, key), content);
    if (dbMode() === "mysql") {
      await query(
        `INSERT INTO work_report_rows (person_id, work_date, item_key, content, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE content = VALUES(content), updated_at = VALUES(updated_at)`,
        [personId, date, key, content, nowStamp()]
      );
    }
  }
  return getReport(user, { date, dept: admin ? "" : deptCode });
}
