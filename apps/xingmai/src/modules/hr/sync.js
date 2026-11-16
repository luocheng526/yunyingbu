import { createDingClient, readDingEnv } from "./dingtalk.js";
import {
  latestSync,
  listBoardMetrics,
  listDingUsers,
  listLeaves,
  listLinks,
  listPunches,
  markLatePunches,
  readBoardPunches,
  readBoardStamp,
  recordSync,
  replaceDayPunches,
  replaceLeavesInRange,
  replaceOvertime,
  replaceQuotas,
  saveBoardDay,
  saveDingUsers,
  saveLinks
} from "./store.js";

const TIME_LABEL = {
  Normal: "正常",
  Early: "早退",
  Late: "迟到",
  SeriousLate: "严重迟到",
  Absenteeism: "旷工迟到",
  NotSigned: "未打卡"
};

const HR_VIEWERS = new Set(["罗成", "韩梦凯", "沈子晗", "luocheng"]);

export function canSeeHr(user, people = [], dingUsers = []) {
  const names = [user && user.username, user && user.displayName, user && user.name]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  if (names.some((name) => HR_VIEWERS.has(name) || HR_VIEWERS.has(name.toLowerCase()))) return true;
  const bags = [user && user.department, user && user.center, user && user.title, user && user.role];
  for (const person of people || []) {
    if (!person) continue;
    const personNames = [person.name, person.username].map((value) => String(value || "").trim());
    if (!names.some((name) => personNames.includes(name))) continue;
    bags.push(person.department, person.center, person.role);
  }
  for (const ding of dingUsers || []) {
    if (!ding) continue;
    const dingName = String(ding.userName || ding.name || "").trim();
    if (!names.includes(dingName)) continue;
    bags.push(ding.department);
  }
  const text = bags.map((value) => String(value || "")).join(" ");
  return text.includes("人事") || text.includes("技术");
}

export function publicPerson(row) {
  return {
    id: Number(row.id),
    name: String(row.name || "").trim(),
    role: String(row.role || "").trim(),
    status: String(row.status || "").trim(),
    employeeNo: String(row.employeeNo || row.employee_no || "").trim(),
    phone: String(row.phone || row.mobile || "").trim(),
    department: String(row.department || row.center || "").trim()
  };
}

export function normKey(value) {
  return String(value || "").replace(/\s+/g, "").toLowerCase();
}

export function normPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("86") && digits.length > 11) return digits.slice(-11);
  return digits;
}

export function matchRoster(people, dingUsers) {
  const active = (people || []).filter((person) => person && person.id && person.status !== "离职");
  const byJob = new Map();
  const byPhone = new Map();
  for (const user of dingUsers || []) {
    const job = normKey(user.jobNumber);
    const phone = normPhone(user.mobile);
    if (job) byJob.set(job, [...(byJob.get(job) || []), user]);
    if (phone) byPhone.set(phone, [...(byPhone.get(phone) || []), user]);
  }
  const pending = [];
  for (const person of active) {
    const job = normKey(person.employeeNo);
    const phone = normPhone(person.phone);
    if (!job && !phone) {
      pending.push({ personId: person.id, reason: "没有工号或手机号" });
      continue;
    }
    const hits = new Map();
    for (const user of job ? byJob.get(job) || [] : []) hits.set(user.userId, "job_number");
    for (const user of phone ? byPhone.get(phone) || [] : []) {
      if (!hits.has(user.userId)) hits.set(user.userId, "phone");
    }
    if (hits.size === 1) {
      const [dingtalkUserId, matchBy] = [...hits.entries()][0];
      pending.push({
        personId: person.id,
        dingtalkUserId,
        matchBy,
        employeeNo: person.employeeNo || "",
        reason: ""
      });
    } else if (hits.size > 1) {
      pending.push({ personId: person.id, reason: "对应到多名钉钉用户" });
    } else {
      pending.push({ personId: person.id, reason: "钉钉里没有相同工号或手机号" });
    }
  }
  const owners = new Map();
  for (const row of pending) {
    if (!row.dingtalkUserId) continue;
    owners.set(row.dingtalkUserId, [...(owners.get(row.dingtalkUserId) || []), row]);
  }
  const links = [];
  const skipped = [];
  for (const row of pending) {
    if (!row.dingtalkUserId) {
      skipped.push({ personId: row.personId, reason: row.reason });
      continue;
    }
    if ((owners.get(row.dingtalkUserId) || []).length > 1) {
      skipped.push({ personId: row.personId, reason: "多名在职人员对上同一个钉钉用户" });
      continue;
    }
    links.push({
      personId: row.personId,
      dingtalkUserId: row.dingtalkUserId,
      matchBy: row.matchBy,
      employeeNo: row.employeeNo
    });
  }
  return { links, skipped };
}

export function shanghaiParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(now);
  const pick = (type) => parts.find((part) => part.type === type)?.value || "";
  return { year: pick("year"), month: pick("month"), day: pick("day"), hour: Number(pick("hour")), minute: pick("minute") };
}

export function shanghaiToday(now = new Date()) {
  const parts = shanghaiParts(now);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function addDays(ymd, days) {
  const [year, month, day] = ymd.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return utc.toISOString().slice(0, 10);
}

export function shanghaiClock(value = Date.now()) {
  const ms = typeof value === "number" ? value : Date.parse(String(value || ""));
  if (!Number.isFinite(ms) || ms <= 0) return "";
  return formatShanghai(ms);
}

export function formatShanghai(value) {
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms <= 0) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date(ms));
  const pick = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${pick("year")}-${pick("month")}-${pick("day")} ${pick("hour")}:${pick("minute")}`;
}

export function punchesFromDing(records, usersById, workDate) {
  const out = [];
  for (const record of records || []) {
    const userId = String(record.userId || "").trim();
    if (!userId) continue;
    const user = usersById.get(userId) || {};
    const timeResult = String(record.timeResult || "");
    const signed = timeResult && timeResult !== "NotSigned";
    out.push({
      personId: Number(user.personId) || 0,
      dingtalkUserId: userId,
      userName: user.userName || user.name || "",
      jobNumber: user.jobNumber || "",
      department: user.department || "",
      workDate,
      checkType: record.checkType === "OffDuty" ? "OffDuty" : "OnDuty",
      timeResult,
      label: TIME_LABEL[timeResult] || "",
      checkAt: signed ? formatShanghai(record.userCheckTime) : "",
      recordId: String(record.id || record.recordId || `${userId}-${record.checkType || "OnDuty"}`)
    });
  }
  return out;
}

export function effortHours(workDate, checkAt) {
  const clock = String(checkAt || "").match(/^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2})/);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(workDate || "")) || !clock) return 0;
  const start = Date.parse(`${workDate}T18:00:00+08:00`);
  const end = Date.parse(`${clock[1]}T${clock[2]}:${clock[3]}:00+08:00`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.round(((end - start) / 3600000) * 10) / 10;
}

export function effortFromPunches(punches, month = "") {
  const people = new Map();
  for (const row of punches || []) {
    if (!String(row.department || "").includes("运营")) continue;
    if (row.checkType !== "OffDuty" || !row.checkAt) continue;
    const day = String(row.workDate || "");
    if (month && !day.startsWith(month)) continue;
    const hours = effortHours(day, row.checkAt);
    if (!(hours > 0)) continue;
    const key = String(row.dingtalkUserId || row.userName || "");
    if (!key) continue;
    if (!people.has(key)) {
      people.set(key, {
        userId: String(row.dingtalkUserId || ""),
        name: row.userName || "",
        department: row.department || "",
        hours: 0,
        days: []
      });
    }
    const person = people.get(key);
    if (row.userName) person.name = row.userName;
    if (row.department) person.department = row.department;
    const same = person.days.find((item) => item.date === day);
    if (same) {
      if (String(row.checkAt) > String(same.offAt)) {
        person.hours = Math.round((person.hours - same.hours + hours) * 10) / 10;
        same.offAt = row.checkAt;
        same.hours = hours;
      }
    } else {
      person.days.push({ date: day, offAt: row.checkAt, hours });
      person.hours = Math.round((person.hours + hours) * 10) / 10;
    }
  }
  return [...people.values()]
    .map((person) => {
      person.days.sort((a, b) => a.date.localeCompare(b.date));
      return person;
    })
    .sort((a, b) => b.hours - a.hours || String(a.name).localeCompare(String(b.name), "zh"));
}

export const EFFORT_RANKS = [
  { id: "assistant", title: "助理排行", roles: ["助理"] },
  { id: "operator", title: "运营排行", roles: ["运营"] },
  { id: "lead", title: "主管/储备/经理排行", roles: ["主管", "储备", "经理"] }
];

function round1(value) {
  return Math.round(Number(value) * 10) / 10;
}

function personName(value) {
  return String(value || "").replace(/\s+/g, "");
}

export function isOpsDepartment(name) {
  return String(name || "").includes("运营");
}

export function pairEffort(dingUsers, people, links = []) {
  const ding = (dingUsers || []).filter((user) => user && user.userId && isOpsDepartment(user.department));
  const org = (people || []).filter((person) => person && person.id && person.status !== "离职" && isOpsDepartment(person.department || person.center));
  const allPeople = new Map((people || []).filter((person) => person && person.id && person.status !== "离职").map((person) => [Number(person.id), person]));
  const dingById = new Map(ding.map((user) => [String(user.userId), user]));
  const usedPeople = new Set();
  const usedUsers = new Set();
  const pairs = [];
  function take(person, user, matchBy) {
    if (!person || !user || usedPeople.has(Number(person.id)) || usedUsers.has(String(user.userId))) return;
    usedPeople.add(Number(person.id));
    usedUsers.add(String(user.userId));
    pairs.push({
      personId: Number(person.id),
      userId: String(user.userId),
      matchBy,
      person: {
        id: Number(person.id),
        name: person.name || "",
        role: person.role || "",
        department: person.department || person.center || "",
        employeeNo: person.employeeNo || ""
      },
      user: {
        userId: String(user.userId),
        name: user.userName || user.name || "",
        department: user.department || "",
        jobNumber: user.jobNumber || ""
      }
    });
  }
  for (const link of links || []) {
    if (!link || link.matchBy !== "manual") continue;
    take(allPeople.get(Number(link.personId)), dingById.get(String(link.dingtalkUserId)), "manual");
  }
  const jobUsers = new Map();
  const jobPeople = new Map();
  for (const user of ding) {
    const job = normKey(user.jobNumber);
    if (!job || usedUsers.has(String(user.userId))) continue;
    jobUsers.set(job, [...(jobUsers.get(job) || []), user]);
  }
  for (const person of org) {
    const job = normKey(person.employeeNo);
    if (!job || usedPeople.has(Number(person.id))) continue;
    jobPeople.set(job, [...(jobPeople.get(job) || []), person]);
  }
  for (const [job, users] of jobUsers) {
    const found = jobPeople.get(job) || [];
    if (users.length === 1 && found.length === 1) take(found[0], users[0], "job_number");
  }
  const nameUsers = new Map();
  const namePeople = new Map();
  for (const user of ding) {
    const name = personName(user.userName || user.name);
    if (!name || usedUsers.has(String(user.userId))) continue;
    nameUsers.set(name, [...(nameUsers.get(name) || []), user]);
  }
  for (const person of org) {
    const name = personName(person.name);
    if (!name || usedPeople.has(Number(person.id))) continue;
    namePeople.set(name, [...(namePeople.get(name) || []), person]);
  }
  for (const [name, users] of nameUsers) {
    const found = namePeople.get(name) || [];
    if (users.length === 1 && found.length === 1) take(found[0], users[0], "name");
  }
  return {
    pairs,
    dingMiss: ding.filter((user) => !usedUsers.has(String(user.userId))).map((user) => ({
      userId: String(user.userId),
      name: user.userName || user.name || "",
      department: user.department || "",
      jobNumber: user.jobNumber || "",
      reason: "钉钉里有这个人，组织中心对不上"
    })),
    orgMiss: org.filter((person) => !usedPeople.has(Number(person.id))).map((person) => ({
      personId: Number(person.id),
      name: person.name || "",
      role: person.role || "",
      department: person.department || person.center || "",
      employeeNo: person.employeeNo || "",
      reason: "组织中心里有这个人，钉钉对不上"
    }))
  };
}

export function effortReport({ month = "", users = [], punches = [], people = [], links = [] } = {}) {
  const safeMonth = /^\d{4}-\d{2}$/.test(String(month || "")) ? String(month) : "";
  const hoursByUser = new Map(effortFromPunches(punches, safeMonth).map((row) => [row.userId, row]));
  const paired = pairEffort(users, people, links);
  const pairByUser = new Map(paired.pairs.map((row) => [row.userId, row]));
  const ding = (users || []).filter((user) => user && user.userId && isOpsDepartment(user.department));
  const org = (people || []).filter((person) => person && person.id && person.status !== "离职" && isOpsDepartment(person.department || person.center));
  const rows = ding.map((user) => {
    const effort = hoursByUser.get(String(user.userId));
    const pair = pairByUser.get(String(user.userId));
    return {
      userId: String(user.userId),
      name: user.userName || user.name || effort?.name || "",
      department: user.department || "",
      jobNumber: user.jobNumber || "",
      hours: effort?.hours || 0,
      days: effort?.days || [],
      personId: pair?.personId || 0,
      orgName: pair?.person.name || "",
      role: pair?.person.role || "",
      matchBy: pair?.matchBy || ""
    };
  }).sort((a, b) => b.hours - a.hours || String(a.name).localeCompare(String(b.name), "zh"));
  const participants = rows.filter((row) => row.hours > 0);
  const hours = round1(rows.reduce((sum, row) => sum + row.hours, 0));
  const teams = [...rows.reduce((map, row) => {
    const name = row.department || "未分部门";
    if (!map.has(name)) map.set(name, { name, roster: 0, participants: 0, hours: 0 });
    const team = map.get(name);
    team.roster += 1;
    team.hours = round1(team.hours + row.hours);
    if (row.hours > 0) team.participants += 1;
    return map;
  }, new Map()).values()].map((team) => ({
    ...team,
    average: team.roster ? round1(team.hours / team.roster) : 0
  })).sort((a, b) => b.average - a.average || a.name.localeCompare(b.name, "zh"));
  const ranks = EFFORT_RANKS.map((rank) => ({
    id: rank.id,
    title: rank.title,
    rows: rows.filter((row) => rank.roles.includes(row.role)).sort((a, b) => b.hours - a.hours || String(a.name).localeCompare(String(b.name), "zh"))
  }));
  return {
    month: safeMonth,
    participants: participants.length,
    roster: rows.length,
    hours,
    average: participants.length ? round1(hours / participants.length) : 0,
    unmatched: paired.dingMiss.length + paired.orgMiss.length,
    teams,
    ranks,
    people: rows,
    choices: {
      people: org.map((person) => ({
        id: Number(person.id),
        name: person.name || "",
        role: person.role || "",
        department: person.department || person.center || "",
        employeeNo: person.employeeNo || ""
      })),
      users: ding.map((user) => ({
        userId: String(user.userId),
        name: user.userName || user.name || "",
        department: user.department || "",
        jobNumber: user.jobNumber || ""
      }))
    },
    watch: {
      conflict: paired.dingMiss.length + paired.orgMiss.length > 0,
      compared: `${ding.length}/${org.length}`,
      pairs: paired.pairs.map((row) => ({
        personId: row.personId,
        userId: row.userId,
        matchBy: row.matchBy,
        name: row.user.name,
        orgName: row.person.name,
        role: row.person.role,
        department: row.user.department,
        orgDepartment: row.person.department
      })),
      dingMiss: paired.dingMiss,
      orgMiss: paired.orgMiss
    }
  };
}

export function overtimeFromColumns(columnVals, personId) {
  let hours = 0;
  for (const column of columnVals || []) {
    for (const cell of column.column_vals || column.columnVals || []) {
      const value = Number(cell.value);
      if (Number.isFinite(value) && value > 0) hours += value;
    }
  }
  const rounded = Math.round(hours * 10) / 10;
  if (!(rounded > 0)) return [];
  return [{ personId, hours: rounded, source: "ding" }];
}

function dayBounds(workDate) {
  const [year, month, day] = workDate.split("-").map(Number);
  const start = Date.UTC(year, month - 1, day, -8, 0, 0);
  return { startMs: start, endMs: start + 24 * 60 * 60 * 1000 - 1 };
}

export async function loadRoster() {
  try {
    const mod = await import("../people/store.js");
    if (typeof mod.listPeople !== "function") return [];
    const rows = await mod.listPeople();
    return (rows || []).map(publicPerson).filter((person) => person.id && person.status !== "离职");
  } catch {
    return [];
  }
}

function leaveCovers(leave, day) {
  const start = String(leave.startAt || "").slice(0, 10);
  const end = String(leave.endAt || "").slice(0, 10) || start;
  return Boolean(start) && start <= day && end >= day;
}

export const BOARD_TEAMS = [
  { id: "ops", title: "甄选运营团队看板" },
  { id: "backend", title: "后端团队看板" },
  { id: "total", title: "总看板" }
];

export function teamOf(department) {
  const name = String(department || "");
  if (name.includes("综合")) return "skip";
  if (name.includes("运营") || name.includes("人事") || name.includes("技术")) return "ops";
  return "backend";
}

export function usersForTeam(users, team) {
  return (users || []).filter((user) => {
    const kind = teamOf(user && user.department);
    if (kind === "skip") return false;
    if (team === "total") return true;
    return kind === team;
  });
}

export function boardPack({ date, users = [], punches = [], leaves = [], dates = [] }) {
  return BOARD_TEAMS.map((team) => {
    const picked = usersForTeam(users, team.id);
    const ids = new Set(picked.map((user) => user.userId));
    const scopedPunches = punches.filter((row) => ids.has(row.dingtalkUserId));
    const scopedLeaves = leaves.filter((row) => ids.has(row.dingtalkUserId));
    const days = dates.map((day) => {
      const one = buildBoard({ date: day, users: picked, punches: scopedPunches, leaves: scopedLeaves });
      return { date: day, expected: one.expected, punched: one.punched, late: one.late, leave: one.leave };
    });
    return {
      id: team.id,
      title: team.title,
      board: buildBoard({ date, users: picked, punches: scopedPunches, leaves: scopedLeaves }),
      days,
      punches: rowsForDay(picked, scopedPunches, date),
      roster: teamRoster({ date, users: picked, punches: scopedPunches, leaves: scopedLeaves })
    };
  });
}

export function shouldPullYesterday(parts, latest, yesterday) {
  if (!parts || Number(parts.hour) < 10) return false;
  if (latest && latest.ok && latest.workDate === yesterday) return false;
  return true;
}

export function previousMonth(today) {
  const [year, month] = String(today || "").split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function daysOfMonth(yearMonth) {
  const [year, month] = String(yearMonth || "").split("-").map(Number);
  if (!year || !month) return [];
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const days = [];
  for (let day = 1; day <= count; day += 1) days.push(`${yearMonth}-${String(day).padStart(2, "0")}`);
  return days;
}

export function shouldReconcileMonth(parts, latest, today) {
  if (!parts || Number(parts.day) !== 1 || Number(parts.hour) < 10) return false;
  const month = previousMonth(today);
  if (latest && latest.ok && latest.workDate === month) return false;
  return true;
}

export function rowsForDay(users, punches, date) {
  const byUser = new Map();
  for (const user of users || []) {
    if (user && user.userId) byUser.set(user.userId, user);
  }
  const rows = (punches || []).filter((row) => row.workDate === date).map((row) => {
    const user = byUser.get(row.dingtalkUserId) || {};
    return {
      ...row,
      userName: row.userName || user.userName || user.name || "",
      jobNumber: row.jobNumber || user.jobNumber || "",
      department: row.department || user.department || ""
    };
  });
  const seen = new Set(rows.map((row) => row.dingtalkUserId));
  for (const user of byUser.values()) {
    if (seen.has(user.userId)) continue;
    rows.push({
      personId: Number(user.personId) || 0,
      dingtalkUserId: user.userId,
      userName: user.userName || user.name || "",
      jobNumber: user.jobNumber || "",
      department: user.department || "",
      workDate: date,
      checkType: "OnDuty",
      timeResult: "",
      label: "",
      checkAt: "",
      recordId: ""
    });
  }
  return rows;
}

export function lateMinutes(planAt, checkAt) {
  const plan = Date.parse(`${String(planAt || "").replace(" ", "T")}:00+08:00`);
  const actual = Date.parse(`${String(checkAt || "").replace(" ", "T")}:00+08:00`);
  if (!Number.isFinite(plan) || !Number.isFinite(actual) || actual <= plan) return 0;
  return Math.round((actual - plan) / 60000);
}

export function teamRoster({ date, users = [], punches = [], leaves = [] }) {
  const day = String(date || "");
  const byUser = new Map();
  for (const row of punches || []) {
    if (row.workDate !== day || !row.dingtalkUserId) continue;
    if (!byUser.has(row.dingtalkUserId)) {
      byUser.set(row.dingtalkUserId, { on: "", off: "", planAt: "", minutes: 0, label: "", late: false });
    }
    const item = byUser.get(row.dingtalkUserId);
    if (row.checkType === "OffDuty") {
      if (!item.off || String(row.checkAt || "") > item.off) item.off = row.checkAt || "";
    } else if (!item.on || String(row.checkAt || "") > item.on) {
      item.on = row.checkAt || "";
    }
    if (row.timeResult === "Late" || row.timeResult === "SeriousLate" || row.timeResult === "Absenteeism" || Number(row.lateMinutes) > 0) {
      item.late = true;
      item.planAt = row.planAt || item.planAt;
      item.minutes = Number(row.lateMinutes) || item.minutes || lateMinutes(row.planAt, row.checkAt);
      item.label = row.label || TIME_LABEL[row.timeResult] || "迟到";
    }
  }
  const leaveByUser = new Map();
  for (const leave of leaves || []) {
    if (!leaveCovers(leave, day)) continue;
    const userId = String(leave.dingtalkUserId || "");
    if (userId && !leaveByUser.has(userId)) leaveByUser.set(userId, leave);
  }
  return (users || []).filter((user) => user && user.userId).map((user) => {
    const punch = byUser.get(user.userId) || { on: "", off: "", planAt: "", minutes: 0, label: "", late: false };
    const leave = leaveByUser.get(user.userId);
    return {
      userId: user.userId,
      name: user.userName || user.name || "",
      department: user.department || "",
      jobNumber: user.jobNumber || "",
      onLeave: Boolean(leave),
      leaveName: leave ? (leave.leaveName || "请假") : "",
      leaveStart: leave ? leave.startAt || "" : "",
      leaveEnd: leave ? leave.endAt || "" : "",
      leaveDuration: leave ? String(leave.duration || "") : "",
      punched: Boolean(punch.on || punch.off),
      on: punch.on,
      off: punch.off,
      late: punch.late,
      planAt: punch.planAt,
      lateMinutes: punch.minutes,
      lateLabel: punch.label
    };
  });
}

export function buildBoard({ date, users = [], punches = [], leaves = [] }) {
  const day = String(date || "");
  const directory = users.filter((user) => user && user.userId);
  const onLeave = new Set();
  for (const leave of leaves) {
    if (!leaveCovers(leave, day)) continue;
    const userId = String(leave.dingtalkUserId || "");
    if (userId) onLeave.add(userId);
  }
  const punched = new Set();
  const late = new Set();
  for (const row of punches) {
    if (row.workDate !== day) continue;
    const userId = String(row.dingtalkUserId || "");
    if (!userId) continue;
    if (row.checkAt) punched.add(userId);
    if (row.timeResult === "Late" || row.timeResult === "SeriousLate" || row.timeResult === "Absenteeism" || Number(row.lateMinutes) > 0) late.add(userId);
  }
  const leaveCount = directory.filter((user) => onLeave.has(user.userId)).length;
  const deptMap = new Map();
  for (const user of directory) {
    const name = user.department || "未分部门";
    if (!deptMap.has(name)) deptMap.set(name, { name, count: 0, punched: 0, leave: 0 });
    const bucket = deptMap.get(name);
    bucket.count += 1;
    if (punched.has(user.userId)) bucket.punched += 1;
    if (onLeave.has(user.userId)) bucket.leave += 1;
  }
  return {
    date: day,
    staff: directory.length,
    expected: Math.max(0, directory.length - leaveCount),
    punched: punched.size,
    late: late.size,
    leave: leaveCount,
    departments: [...deptMap.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh"))
  };
}

export async function alignRoster(client = createDingClient(), roster = null) {
  if (!client.configured()) {
    await recordSync("align", "", false, "钉钉还没配置");
    return { configured: false, links: await listLinks(), skipped: [] };
  }
  const people = roster || (await loadRoster());
  const users = await client.listUsers();
  const matched = matchRoster(people, users);
  await saveLinks(matched.links, { keepManual: true });
  await recordSync("align", shanghaiToday(), true, `对齐 ${matched.links.length} 人，未对齐 ${matched.skipped.length} 人`);
  return { configured: true, ...matched };
}

export async function refreshDirectory(client = createDingClient()) {
  if (!client.configured()) {
    return [];
  }
  const users = await client.listUsers();
  return saveDingUsers(users);
}

export async function pullDay(workDate, { client = createDingClient(), userIds = null } = {}) {
  if (!client.configured()) {
    return { configured: false, punches: [] };
  }
  let directory = await listDingUsers();
  if (!directory.length) directory = await refreshDirectory(client);
  const links = await listLinks();
  const personByUser = new Map(links.map((link) => [link.dingtalkUserId, link.personId]));
  const usersById = new Map(directory.map((user) => [user.userId, { ...user, personId: personByUser.get(user.userId) || 0 }]));
  const chosen = userIds ? directory.filter((user) => userIds.includes(user.userId)) : directory;
  const ids = chosen.map((user) => user.userId);
  if (!ids.length) {
    if (!directory.length) {
      await recordSync("attendance", workDate, true, "钉钉通讯录是空的，打卡表留空");
    }
    return { configured: true, punches: [], users: 0 };
  }
  const records = await client.listAttendance(ids, workDate);
  const punches = punchesFromDing(records, usersById, workDate);
  await replaceDayPunches(workDate, ids, punches);
  await recordSync("attendance", workDate, true, punches.length ? `钉钉 ${ids.length} 人，写入打卡 ${punches.length} 条` : `钉钉 ${ids.length} 人，这一天没有打卡结果`);
  return { configured: true, punches, users: ids.length };
}

function leaveMs(value) {
  const num = Number(value);
  if (Number.isFinite(num) && num > 0) return num;
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function pullLeaves(startDate, endDate, client = createDingClient()) {
  if (!client.configured()) return { configured: false, leaves: [], quotas: [] };
  let directory = await listDingUsers();
  if (!directory.length) directory = await refreshDirectory(client);
  const userIds = directory.map((user) => user.userId).filter(Boolean);
  if (!userIds.length) {
    return { configured: true, leaves: [], quotas: [] };
  }
  const links = await listLinks();
  const personByUser = new Map(links.map((link) => [link.dingtalkUserId, link.personId]));
  const { startMs } = dayBounds(startDate);
  const { endMs } = dayBounds(endDate);
  const leaveRows = await client.listLeaveStatus(userIds, startMs, endMs);
  let types = [];
  try {
    types = await client.listVacationTypes(userIds[0]);
  } catch {
    types = [];
  }
  const typeName = new Map();
  for (const type of types) {
    const code = String(type.leave_code || type.leaveCode || "");
    const name = String(type.leave_name || type.leaveName || "");
    if (code) typeName.set(code, name);
  }
  const known = new Set(userIds);
  const leaves = [];
  for (const row of leaveRows) {
    const userId = String(row.userid || "");
    if (!known.has(userId)) continue;
    const code = String(row.leave_code || "");
    const start = leaveMs(row.start_time);
    const end = leaveMs(row.end_time);
    if (!start || !end) continue;
    leaves.push({
      personId: personByUser.get(userId) || 0,
      dingtalkUserId: userId,
      leaveCode: code,
      leaveName: typeName.get(code) || "请假",
      startAt: formatShanghai(start),
      endAt: formatShanghai(end),
      duration: String(row.duration_percent ?? row.duration ?? ""),
      recordKey: `${userId}-${code}-${start}-${end}`
    });
  }
  await replaceLeavesInRange(userIds, `${startDate} 00:00`, `${endDate} 23:59`, leaves);

  const compTypes = [...typeName.entries()].filter(([, name]) => name.includes("调休"));
  const quotas = [];
  for (const [code, name] of compTypes) {
    try {
      const quotaRows = await client.listVacationQuota(userIds[0], code, userIds);
      for (const row of quotaRows) {
        const userId = String(row.userid || "");
        if (!known.has(userId)) continue;
        const quotaHours = Number(row.quota_num_per_hour ?? row.quota_num_per_day ?? 0);
        const usedHours = Number(row.used_num_per_hour ?? row.used_num_per_day ?? 0);
        quotas.push({
          personId: personByUser.get(userId) || 0,
          leaveCode: code,
          leaveName: name,
          quotaHours,
          usedHours,
          balanceHours: Math.round((quotaHours - usedHours) * 10) / 10
        });
      }
    } catch {
      /* 余额读不到时，请假记录仍然保留 */
    }
  }
  if (compTypes.length) await replaceQuotas(quotas);
  return { configured: true, leaves, quotas };
}

export async function pullLeaveAndOvertime(workDate, client = createDingClient()) {
  if (!client.configured()) return { configured: false };
  const pulled = await pullLeaves(workDate, workDate, client);
  const links = await listLinks();
  const overtime = [];
  for (const link of links) {
    try {
      const columns = await client.listOvertimeHours(link.dingtalkUserId, workDate);
      overtime.push(...overtimeFromColumns(columns, link.personId));
    } catch {
      /* 这一人的加班列读不到就留空，不用别的数填上 */
    }
  }
  if (links.length) await replaceOvertime(workDate, links.map((link) => link.personId), overtime);
  await recordSync("leave", workDate, true, `请假和调休 ${pulled.leaves.length} 条，调休余额 ${pulled.quotas.length} 条，加班 ${overtime.length} 条`);
  return { configured: true, quotas: pulled.quotas, overtime, leaves: pulled.leaves };
}

export async function refreshLeaves(client = createDingClient()) {
  const yesterday = addDays(shanghaiToday(), -1);
  if (!client.configured()) {
    await recordSync("leave", yesterday, false, "钉钉还没配置");
    return { configured: false, leaves: [] };
  }
  const from = addDays(yesterday, -30);
  const pulled = await pullLeaves(from, yesterday, client);
  const today = shanghaiToday();
  for (let offset = 0; offset <= 30; offset += 1) {
    const day = addDays(from, offset);
    if (day >= today) continue;
    await saveBoardSnapshot(day);
  }
  await recordSync("leave", yesterday, true, `请假和调休 ${pulled.leaves.length} 条，已写回看板`);
  return pulled;
}

function emptyBoard(date) {
  return { date, staff: 0, expected: 0, punched: 0, late: 0, leave: 0, departments: [] };
}

export async function saveBoardSnapshot(date) {
  const users = await listDingUsers();
  const links = await listLinks();
  const userByPerson = new Map(links.map((link) => [link.personId, link.dingtalkUserId]));
  const leaves = (await listLeaves()).map((row) => ({
    ...row,
    dingtalkUserId: row.dingtalkUserId || userByPerson.get(row.personId) || ""
  }));
  const punches = await listPunches({ date });
  const packed = boardPack({ date, users, punches, leaves, dates: [date] });
  const teams = packed.map((team) => ({
    id: team.id,
    title: team.title,
    board: team.board,
    punches: team.punches,
    roster: team.roster
  }));
  await saveBoardDay(date, { teams });
  return { date, teams };
}

function unpackTeam(raw) {
  if (Array.isArray(raw)) return { punches: raw, roster: [] };
  if (!raw || typeof raw !== "object") return { punches: [], roster: [] };
  return { punches: raw.punches || [], roster: raw.roster || [] };
}

export async function pullLate(workDate, client = createDingClient()) {
  if (!client.configured() || typeof client.listUpdatedata !== "function") return [];
  const directory = await listDingUsers();
  const byUser = new Map(directory.map((user) => [user.userId, user]));
  const ids = directory.map((user) => user.userId).filter(Boolean);
  const found = [];
  const queue = ids.slice();
  async function one(userId) {
    let list = [];
    try {
      list = await client.listUpdatedata(userId, workDate);
    } catch {
      return;
    }
    for (const item of list || []) {
      const timeResult = String(item.time_result || item.timeResult || "");
      const checkType = String(item.check_type || item.checkType || "OnDuty");
      if (checkType === "OffDuty") continue;
      if (timeResult !== "Late" && timeResult !== "SeriousLate" && timeResult !== "Absenteeism") continue;
      const user = byUser.get(userId) || {};
      const planAt = formatShanghai(item.plan_check_time || item.planCheckTime);
      const checkAt = formatShanghai(item.user_check_time || item.userCheckTime);
      found.push({
        dingtalkUserId: userId,
        userName: user.userName || user.name || "",
        jobNumber: user.jobNumber || "",
        department: user.department || "",
        timeResult,
        label: TIME_LABEL[timeResult] || "迟到",
        planAt,
        checkAt,
        minutes: lateMinutes(planAt, checkAt)
      });
    }
  }
  const workers = [0, 1, 2, 3].map(async () => {
    while (queue.length) {
      const userId = queue.shift();
      if (userId) await one(userId);
    }
  });
  await Promise.all(workers);
  if (found.length) await markLatePunches(workDate, found);
  return found;
}

export async function readStoredBoard(date) {
  const dates = [];
  for (let offset = 6; offset >= 0; offset -= 1) dates.push(addDays(date, -offset));
  const today = shanghaiToday();
  let metrics = await listBoardMetrics(dates);
  for (const day of dates) {
    if (day >= today || metrics[day]) continue;
    await saveBoardSnapshot(day);
  }
  metrics = await listBoardMetrics(dates);
  const punches = await readBoardPunches(date);
  const boards = BOARD_TEAMS.map((team) => {
    const packed = unpackTeam(punches && punches[team.id]);
    const current = (metrics[date] || []).find((item) => item.id === team.id);
    const board = current ? current.board : emptyBoard(date);
    const days = dates.map((day) => {
      const found = (metrics[day] || []).find((item) => item.id === team.id);
      const one = found ? found.board : emptyBoard(day);
      return { date: day, expected: one.expected || 0, punched: one.punched || 0, late: one.late || 0, leave: one.leave || 0 };
    });
    return {
      id: team.id,
      title: team.title,
      board,
      days,
      punches: packed.punches,
      roster: packed.roster
    };
  });
  return {
    saved: Boolean(metrics[date]),
    updatedAt: shanghaiClock(await readBoardStamp(date)),
    boards,
    board: boards[0].board,
    days: boards[0].days,
    punches: boards[0].punches
  };
}

export async function refreshBoardDay(workDate, client = createDingClient()) {
  const raw = String(workDate || "");
  const day = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : addDays(shanghaiToday(), -1);
  if (!client.configured()) {
    await recordSync("refresh", day, false, "钉钉还没配置");
    return { configured: false, workDate: day, updatedAt: "" };
  }
  await refreshDirectory(client);
  const pulled = await pullDay(day, { client });
  const leaves = await pullLeaves(day, day, client);
  const late = await pullLate(day, client);
  await saveBoardSnapshot(day);
  const updatedAt = shanghaiClock(await readBoardStamp(day));
  await recordSync("refresh", day, true, `已刷新 ${day}，打卡 ${pulled.punches?.length || 0} 条，请假 ${leaves.leaves?.length || 0} 条，迟到 ${late.length} 人`);
  return {
    configured: true,
    workDate: day,
    updatedAt,
    punches: pulled.punches?.length || 0,
    leaveCount: leaves.leaves?.length || 0,
    lateCount: late.length
  };
}

export async function archiveYesterday(client = createDingClient()) {
  const yesterday = addDays(shanghaiToday(), -1);
  if (!client.configured()) {
    await recordSync("daily", yesterday, false, "钉钉还没配置");
    return { configured: false, workDate: yesterday };
  }
  await refreshDirectory(client);
  const pulled = await pullDay(yesterday, { client });
  await pullLate(yesterday, client);
  await saveBoardSnapshot(yesterday);
  await recordSync("daily", yesterday, true, `已保存 ${yesterday}，打卡 ${pulled.punches?.length || 0} 条`);
  return { configured: true, workDate: yesterday, users: pulled.users, punches: pulled.punches };
}

export async function reconcileMonth(yearMonth, client = createDingClient()) {
  if (!client.configured()) {
    await recordSync("month", yearMonth, false, "钉钉还没配置");
    return { configured: false, month: yearMonth };
  }
  await refreshDirectory(client);
  const days = daysOfMonth(yearMonth);
  if (days.length) {
    try {
      await pullLeaves(days[0], days[days.length - 1], client);
    } catch (err) {
      await recordSync("month", yearMonth, false, String(err.message || "上月请假没有核对成").slice(0, 180));
    }
  }
  let failed = 0;
  for (const day of days) {
    try {
      await pullDay(day, { client });
      await saveBoardSnapshot(day);
    } catch (err) {
      failed += 1;
      await recordSync("month", day, false, String(err.message || "这一天没有核对成").slice(0, 180));
    }
  }
  if (failed) {
    await recordSync("month", yearMonth, false, `${yearMonth} 有 ${failed} 天没有核对成，原数据保留`);
    return { configured: true, month: yearMonth, days: days.length, failed };
  }
  await recordSync("month", yearMonth, true, `已用钉钉核对并覆盖 ${yearMonth} 共 ${days.length} 天`);
  return { configured: true, month: yearMonth, days: days.length, failed: 0 };
}

export async function runToday(client = createDingClient()) {
  const day = shanghaiToday();
  if (!readDingEnv().configured) {
    await recordSync("today", day, false, "钉钉还没配置");
    return { configured: false };
  }
  await refreshDirectory(client);
  const pulled = await pullDay(day, { client });
  await recordSync("today", day, true, `今日 ${pulled.users || 0} 人，打卡 ${pulled.punches?.length || 0} 条`);
  return { configured: true, workDate: day, punches: pulled.punches, users: pulled.users };
}

export async function runDaily(workDate, client = createDingClient()) {
  if (!readDingEnv().configured) {
    await recordSync("daily", workDate, false, "钉钉还没配置");
    return { configured: false };
  }
  const directory = await refreshDirectory(client);
  const days = [];
  for (let offset = 6; offset >= 0; offset -= 1) days.push(addDays(workDate, -offset));
  let punches = [];
  for (const day of days) {
    const pulled = await pullDay(day, { client });
    punches = punches.concat(pulled.punches || []);
  }
  await recordSync("attendance", workDate, true, `钉钉 ${directory.length} 人，近 7 天打卡 ${punches.length} 条`);
  return { configured: true, punches, users: directory.length };
}

let timer = null;

export function startScheduler(client = createDingClient()) {
  if (timer) return;
  const tick = async () => {
    if (!client.configured()) return;
    const parts = shanghaiParts();
    const today = shanghaiToday();
    const yesterday = addDays(today, -1);
    if (shouldPullYesterday(parts, await latestSync("daily"), yesterday)) {
      try {
        await archiveYesterday(client);
      } catch (err) {
        await recordSync("daily", yesterday, false, String(err.message || "前一天没有保存").slice(0, 180));
      }
    }
    if (shouldPullYesterday(parts, await latestSync("leave"), yesterday)) {
      try {
        await refreshLeaves(client);
      } catch (err) {
        await recordSync("leave", yesterday, false, String(err.message || "请假和调休没有抓下来").slice(0, 180));
      }
    }
    if (shouldReconcileMonth(parts, await latestSync("month"), today)) {
      try {
        await reconcileMonth(previousMonth(today), client);
      } catch (err) {
        await recordSync("month", previousMonth(today), false, String(err.message || "上月没有核对成").slice(0, 180));
      }
    }
  };
  timer = setInterval(() => {
    tick().catch(() => {});
  }, 15 * 60 * 1000);
  if (typeof timer.unref === "function") timer.unref();
  tick().catch(() => {});
}

export function stopScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}
