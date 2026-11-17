import { dbMode, query } from "../profile/auth.js";

const MONTH_RE = /^\d{4}-\d{2}$/;
const KPI_KEYS = ["hours", "rank", "profit", "new", "star"];
const KPI_META = {
  hours: { label: "奋斗时长", hint: "本月合计", unit: "小时", placeholder: "小时" },
  rank: { label: "奋斗排名", hint: "本月冠军", unit: "", placeholder: "第 1 名" },
  profit: { label: "BI利润", hint: "本月合计", unit: "", placeholder: "金额" },
  new: { label: "新人介绍", hint: "本月入职", unit: "人", placeholder: "人数" },
  star: { label: "优秀员工", hint: "本月表彰", unit: "人", placeholder: "人数" }
};
const SECTIONS = ["ranks", "intros", "levels", "goals", "stars"];

let ready = false;
const boards = new Map();

function nowStamp() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

export function currentMonth() {
  const text = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
  return text.slice(0, 7);
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

export function isMeetingAdmin(user) {
  return namesOf(user).some((name) => name === "罗成" || name.toLowerCase() === "luocheng");
}

function text(value) {
  return String(value == null ? "" : value).trim();
}

function cloneKpis(list) {
  const byKey = new Map();
  (Array.isArray(list) ? list : []).forEach((item) => {
    const key = String(item.key || "");
    if (KPI_KEYS.includes(key)) {
      byKey.set(key, {
        key,
        label: KPI_META[key].label,
        hint: KPI_META[key].hint,
        unit: KPI_META[key].unit,
        placeholder: KPI_META[key].placeholder,
        value: text(item.value),
        delta: text(item.delta)
      });
    }
  });
  return KPI_KEYS.map((key) => byKey.get(key) || { key, value: "", delta: "", ...KPI_META[key] });
}

function sectionCount(board) {
  return SECTIONS.filter((key) => board[key].length).length;
}

function monthEnd(month) {
  const [year, monthNum] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
  return `${month}-${String(last).padStart(2, "0")}`;
}

export function listMonths() {
  const keys = new Set(boards.keys());
  keys.add(currentMonth());
  return [...keys]
    .filter((month) => MONTH_RE.test(month))
    .sort()
    .reverse()
    .map((month) => {
      const board = boards.get(month) || blankBoard(month);
      const sections = sectionCount(board);
      const any = sections > 0 || board.kpis.some((item) => item.value);
      const current = month === currentMonth();
      return {
        month,
        current,
        end: monthEnd(month),
        state: !any ? "未填写" : current ? "已录入" : "已完成",
        note: sections === SECTIONS.length ? "记录完整" : any ? "待补充" : "未填写"
      };
    });
}

function cloneRows(list, fields) {
  return (Array.isArray(list) ? list : [])
    .map((row) => {
      const next = {};
      fields.forEach((field) => {
        next[field] = text(row && row[field]);
      });
      return next;
    })
    .filter((row) => fields.some((field) => row[field]));
}

export function blankBoard(month) {
  const key = MONTH_RE.test(month) ? month : currentMonth();
  return {
    month: key,
    title: "月度大会",
    kpis: cloneKpis([]),
    ranks: [],
    intros: [],
    levels: [],
    goals: [],
    stars: []
  };
}

function normalizeBoard(month, input) {
  const board = blankBoard(month);
  const src = input && typeof input === "object" ? input : {};
  board.title = text(src.title) || "月度大会";
  board.kpis = cloneKpis(src.kpis);
  board.ranks = cloneRows(src.ranks, ["name", "hours", "note"]);
  board.intros = cloneRows(src.intros, ["name", "role", "text"]);
  board.levels = cloneRows(src.levels, ["name", "from", "to", "note"]);
  board.goals = cloneRows(src.goals, ["name", "text"]);
  board.stars = cloneRows(src.stars, ["name", "reason"]);
  return board;
}

export function resetMeetingStore() {
  ready = false;
  boards.clear();
}

async function ensureTables() {
  await query(
    `CREATE TABLE IF NOT EXISTS meeting_boards (
      month CHAR(7) NOT NULL PRIMARY KEY,
      payload_json MEDIUMTEXT NOT NULL,
      updated_at VARCHAR(40) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
}

async function hydrateMysql() {
  boards.clear();
  const [rows] = await query("SELECT month, payload_json FROM meeting_boards");
  for (const row of rows) {
    let payload = {};
    try {
      payload = JSON.parse(row.payload_json || "{}");
    } catch {
      payload = {};
    }
    const month = String(row.month || "");
    if (MONTH_RE.test(month)) {
      boards.set(month, normalizeBoard(month, payload));
    }
  }
}

async function readyStore() {
  if (ready) {
    return;
  }
  if (dbMode() === "mysql") {
    await ensureTables();
    await hydrateMysql();
  }
  ready = true;
}

export async function getBoard(user, month) {
  if (!user) {
    return { ok: false, statusCode: 401, error: "未登录" };
  }
  await readyStore();
  const key = MONTH_RE.test(String(month || "")) ? String(month) : currentMonth();
  const board = boards.get(key) || blankBoard(key);
  return { ok: true, admin: isMeetingAdmin(user), board, months: listMonths() };
}

export async function saveBoard(user, body) {
  if (!user) {
    return { ok: false, statusCode: 401, error: "未登录" };
  }
  if (!isMeetingAdmin(user)) {
    return { ok: false, statusCode: 403, error: "只有罗成能改月度大会" };
  }
  const month = String(body?.month || "");
  if (!MONTH_RE.test(month)) {
    return { ok: false, statusCode: 400, error: "请选择月份" };
  }
  await readyStore();
  const board = normalizeBoard(month, body?.board || body);
  boards.set(month, board);
  if (dbMode() === "mysql") {
    await query(
      `INSERT INTO meeting_boards (month, payload_json, updated_at) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE payload_json = VALUES(payload_json), updated_at = VALUES(updated_at)`,
      [month, JSON.stringify(board), nowStamp()]
    );
  }
  return { ok: true, admin: true, board, months: listMonths() };
}
