import { createDingClient, readDingEnv } from "./dingtalk.js";
import {
  latestSync,
  listLinks,
  listPunches,
  recordSync,
  replaceDayPunches,
  replaceLeaves,
  replaceOvertime,
  replaceQuotas,
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

export function publicPerson(row) {
  return {
    id: Number(row.id),
    name: String(row.name || "").trim(),
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

export function punchesFromDing(records, linksByUserId, workDate) {
  const out = [];
  for (const record of records || []) {
    const userId = String(record.userId || "").trim();
    const link = linksByUserId.get(userId);
    if (!link) continue;
    const timeResult = String(record.timeResult || "");
    const signed = timeResult && timeResult !== "NotSigned";
    out.push({
      personId: link.personId,
      dingtalkUserId: userId,
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

export async function alignRoster(client = createDingClient(), roster = null) {
  if (!client.configured()) {
    await recordSync("align", "", false, "钉钉还没配置");
    return { configured: false, links: await listLinks(), skipped: [] };
  }
  const people = roster || (await loadRoster());
  const users = await client.listUsers();
  const matched = matchRoster(people, users);
  await saveLinks(matched.links);
  await recordSync("align", shanghaiToday(), true, `对齐 ${matched.links.length} 人，未对齐 ${matched.skipped.length} 人`);
  return { configured: true, ...matched };
}

export async function pullDay(workDate, { client = createDingClient(), personIds = null } = {}) {
  if (!client.configured()) {
    return { configured: false, punches: [] };
  }
  const links = await listLinks();
  const chosen = personIds ? links.filter((link) => personIds.includes(link.personId)) : links;
  const linksByUserId = new Map(chosen.map((link) => [link.dingtalkUserId, link]));
  const userIds = [...linksByUserId.keys()];
  if (!userIds.length) {
    await recordSync("attendance", workDate, true, "没有已对齐的人，打卡表留空");
    return { configured: true, punches: [] };
  }
  const records = await client.listAttendance(userIds, workDate);
  const punches = punchesFromDing(records, linksByUserId, workDate);
  await replaceDayPunches(workDate, chosen.map((link) => link.personId), punches);
  await recordSync("attendance", workDate, true, punches.length ? `写入打卡 ${punches.length} 条` : "钉钉这一天没有打卡结果");
  return { configured: true, punches };
}

export async function pullLeaveAndOvertime(workDate, client = createDingClient()) {
  if (!client.configured()) return { configured: false };
  const links = await listLinks();
  if (!links.length) {
    await recordSync("leave", workDate, true, "没有已对齐的人，调休和加班留空");
    return { configured: true, quotas: [], overtime: [] };
  }
  const userIds = links.map((link) => link.dingtalkUserId);
  const byUser = new Map(links.map((link) => [link.dingtalkUserId, link]));
  const { startMs, endMs } = dayBounds(workDate);
  const leaveRows = await client.listLeaveStatus(userIds, startMs, endMs);
  const opUserId = userIds[0];
  let types = [];
  try {
    types = await client.listVacationTypes(opUserId);
  } catch {
    types = [];
  }
  const typeName = new Map();
  for (const type of types) {
    const code = String(type.leave_code || type.leaveCode || "");
    const name = String(type.leave_name || type.leaveName || "");
    if (code) typeName.set(code, name);
  }
  const compTypes = [...typeName.entries()].filter(([, name]) => name.includes("调休"));
  const leaves = [];
  for (const row of leaveRows) {
    const link = byUser.get(String(row.userid || ""));
    if (!link) continue;
    const code = String(row.leave_code || "");
    const name = typeName.get(code) || "";
    if (!name.includes("调休")) continue;
    leaves.push({
      personId: link.personId,
      leaveCode: code,
      leaveName: name || "调休",
      startAt: formatShanghai(row.start_time),
      endAt: formatShanghai(row.end_time),
      duration: String(row.duration_percent ?? ""),
      recordKey: `${link.personId}-${code}-${row.start_time}-${row.end_time}`
    });
  }
  await replaceLeaves(links.map((link) => link.personId), leaves);

  const quotas = [];
  for (const [code, name] of compTypes) {
    const quotaRows = await client.listVacationQuota(opUserId, code, userIds);
    for (const row of quotaRows) {
      const link = byUser.get(String(row.userid || ""));
      if (!link) continue;
      const quotaHours = Number(row.quota_num_per_hour ?? row.quota_num_per_day ?? 0);
      const usedHours = Number(row.used_num_per_hour ?? row.used_num_per_day ?? 0);
      quotas.push({
        personId: link.personId,
        leaveCode: code,
        leaveName: name,
        quotaHours,
        usedHours,
        balanceHours: Math.round((quotaHours - usedHours) * 10) / 10
      });
    }
  }
  if (compTypes.length) await replaceQuotas(quotas);

  const overtime = [];
  for (const link of links) {
    try {
      const columns = await client.listOvertimeHours(link.dingtalkUserId, workDate);
      overtime.push(...overtimeFromColumns(columns, link.personId));
    } catch {
      /* 这一人的加班列读不到就留空，不用别的数填上 */
    }
  }
  await replaceOvertime(workDate, links.map((link) => link.personId), overtime);
  await recordSync("leave", workDate, true, `调休余额 ${quotas.length} 条，加班 ${overtime.length} 条`);
  return { configured: true, quotas, overtime, leaves };
}

export async function runDaily(workDate, client = createDingClient()) {
  if (!readDingEnv().configured) {
    await recordSync("daily", workDate, false, "钉钉还没配置");
    return { configured: false };
  }
  await alignRoster(client);
  const first = await pullDay(workDate, { client });
  const stored = await listPunches({ date: workDate });
  if (!stored.length) {
    await pullDay(addDays(workDate, -1), { client });
  }
  await pullLeaveAndOvertime(workDate, client);
  return { configured: true, punches: first.punches };
}

let timer = null;

export function startScheduler(client = createDingClient()) {
  if (timer) return;
  const tick = async () => {
    if (!client.configured()) return;
    const parts = shanghaiParts();
    if (parts.hour < 1) return;
    const day = addDays(shanghaiToday(), -1);
    const latest = await latestSync();
    if (latest && latest.ok && latest.kind === "daily" && latest.workDate === day) return;
    try {
      await runDaily(day, client);
      await recordSync("daily", day, true, "日批完成");
    } catch (err) {
      await recordSync("daily", day, false, String(err.message || "日批没有完成").slice(0, 180));
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
