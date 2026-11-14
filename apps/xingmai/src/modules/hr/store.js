import { dbMode, query } from "../profile/auth.js";

export const HR_TABS = ["面试统计", "考勤", "调休", "人才管理", "加班时长"];

export const INTERVIEW_RESULTS = ["待定", "通过", "未通过", "未到场"];
export const ATTENDANCE_STATUSES = ["正常", "迟到", "早退", "缺卡", "旷工", "请假"];
export const TIMEOFF_STATUSES = ["待审", "已通过", "已驳回"];
export const TALENT_STAGES = ["储备", "面试中", "已入职", "已淘汰"];

export const HR_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS hr_interviews (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    candidate_name VARCHAR(64) NOT NULL,
    position_name VARCHAR(64) NOT NULL DEFAULT '',
    interviewer VARCHAR(64) NOT NULL DEFAULT '',
    interview_at VARCHAR(32) NOT NULL,
    result_name VARCHAR(16) NOT NULL,
    note_text VARCHAR(500) NOT NULL DEFAULT '',
    created_by VARCHAR(64) NOT NULL DEFAULT '',
    created_at VARCHAR(40) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS hr_attendance (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    person_name VARCHAR(64) NOT NULL,
    work_date VARCHAR(10) NOT NULL,
    check_in VARCHAR(8) NOT NULL DEFAULT '',
    check_out VARCHAR(8) NOT NULL DEFAULT '',
    status_name VARCHAR(16) NOT NULL,
    note_text VARCHAR(500) NOT NULL DEFAULT '',
    created_by VARCHAR(64) NOT NULL DEFAULT '',
    created_at VARCHAR(40) NOT NULL,
    UNIQUE KEY uq_hr_att_person_day (person_name, work_date)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS hr_timeoff (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    person_name VARCHAR(64) NOT NULL,
    start_on VARCHAR(10) NOT NULL,
    end_on VARCHAR(10) NOT NULL,
    hours DECIMAL(6,1) NOT NULL,
    reason VARCHAR(500) NOT NULL DEFAULT '',
    status_name VARCHAR(16) NOT NULL,
    created_by VARCHAR(64) NOT NULL DEFAULT '',
    created_at VARCHAR(40) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS hr_talents (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    person_name VARCHAR(64) NOT NULL,
    phone VARCHAR(32) NOT NULL DEFAULT '',
    target_role VARCHAR(64) NOT NULL DEFAULT '',
    source_name VARCHAR(64) NOT NULL DEFAULT '',
    stage_name VARCHAR(16) NOT NULL,
    note_text VARCHAR(500) NOT NULL DEFAULT '',
    created_by VARCHAR(64) NOT NULL DEFAULT '',
    created_at VARCHAR(40) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS hr_overtime (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    person_name VARCHAR(64) NOT NULL,
    work_date VARCHAR(10) NOT NULL,
    hours DECIMAL(5,1) NOT NULL,
    reason VARCHAR(500) NOT NULL DEFAULT '',
    created_by VARCHAR(64) NOT NULL DEFAULT '',
    created_at VARCHAR(40) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
];

const memory = emptyMemory();
let seq = 1;
let ready = null;

function emptyMemory() {
  return {
    interviews: [],
    attendance: [],
    timeoff: [],
    talents: [],
    overtime: []
  };
}

function bad(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function clip(value, max) {
  return String(value ?? "").trim().slice(0, max);
}

function mustName(value, label) {
  const name = clip(value, 64);
  if (!name) {
    throw bad(`${label}不能为空`);
  }
  return name;
}

function mustChoice(value, options, label) {
  const picked = clip(value, 16);
  if (!options.includes(picked)) {
    throw bad(`${label}不正确`);
  }
  return picked;
}

function mustDate(value, label) {
  const text = clip(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00Z`))) {
    throw bad(`${label}要写成 YYYY-MM-DD`);
  }
  return text;
}

function mustMonth(value) {
  const text = clip(value, 7);
  if (!text) {
    return "";
  }
  if (!/^\d{4}-\d{2}$/.test(text)) {
    throw bad("月份要写成 YYYY-MM");
  }
  return text;
}

function mustTime(value, label, { required = false } = {}) {
  const text = clip(value, 8);
  if (!text) {
    if (required) {
      throw bad(`${label}不能为空`);
    }
    return "";
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) {
    throw bad(`${label}要写成 HH:MM`);
  }
  return text;
}

function mustWhen(value) {
  const text = clip(value, 32).replace("T", " ");
  const match = text.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/);
  if (!match) {
    throw bad("面试时间要写成 YYYY-MM-DD HH:MM");
  }
  mustDate(match[1], "面试日期");
  mustTime(match[2], "面试时间", { required: true });
  return `${match[1]} ${match[2]}`;
}

function mustHours(value, label, max) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0 || num > max) {
    throw bad(`${label}要大于 0，且不超过 ${max}`);
  }
  return Math.round(num * 10) / 10;
}

function inMonth(value, month) {
  if (!month) {
    return true;
  }
  return String(value || "").slice(0, 7) === month;
}

function stamp(actor) {
  return {
    createdBy: clip(actor, 64),
    createdAt: new Date().toISOString()
  };
}

function round1(value) {
  return Math.round(Number(value) * 10) / 10;
}

function byIdDesc(rows) {
  return rows.slice().sort((a, b) => Number(b.id) - Number(a.id));
}

export function resetHrStore() {
  const fresh = emptyMemory();
  memory.interviews = fresh.interviews;
  memory.attendance = fresh.attendance;
  memory.timeoff = fresh.timeoff;
  memory.talents = fresh.talents;
  memory.overtime = fresh.overtime;
  seq = 1;
  ready = null;
}

export function ensureHrSchema() {
  if (dbMode() !== "mysql") {
    return Promise.resolve();
  }
  if (!ready) {
    ready = (async () => {
      for (const sql of HR_SCHEMA) {
        await query(sql);
      }
    })().catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}

function interviewStats(rows) {
  const stats = {
    total: rows.length,
    passed: 0,
    failed: 0,
    pending: 0,
    absent: 0,
    passRate: null,
    byPosition: []
  };
  const positions = new Map();
  for (const row of rows) {
    if (row.result === "通过") stats.passed += 1;
    else if (row.result === "未通过") stats.failed += 1;
    else if (row.result === "未到场") stats.absent += 1;
    else stats.pending += 1;
    const key = row.position || "未填岗位";
    const bucket = positions.get(key) || { position: key, total: 0, passed: 0 };
    bucket.total += 1;
    if (row.result === "通过") bucket.passed += 1;
    positions.set(key, bucket);
  }
  if (stats.total > 0) {
    stats.passRate = Math.round((stats.passed / stats.total) * 1000) / 1000;
  }
  stats.byPosition = [...positions.values()].sort((a, b) => b.total - a.total || a.position.localeCompare(b.position, "zh"));
  return stats;
}

function attendanceStats(rows) {
  const stats = { total: rows.length, normal: 0, late: 0, early: 0, missing: 0, absent: 0, leave: 0 };
  const map = { 正常: "normal", 迟到: "late", 早退: "early", 缺卡: "missing", 旷工: "absent", 请假: "leave" };
  for (const row of rows) {
    const key = map[row.status];
    if (key) stats[key] += 1;
  }
  return stats;
}

function timeoffStats(rows) {
  const stats = { pending: 0, approved: 0, rejected: 0, approvedHours: 0 };
  for (const row of rows) {
    if (row.status === "已通过") {
      stats.approved += 1;
      stats.approvedHours = round1(stats.approvedHours + Number(row.hours || 0));
    } else if (row.status === "已驳回") {
      stats.rejected += 1;
    } else {
      stats.pending += 1;
    }
  }
  return stats;
}

function talentStats(rows) {
  const stats = { total: rows.length, reserve: 0, interviewing: 0, hired: 0, rejected: 0 };
  const map = { 储备: "reserve", 面试中: "interviewing", 已入职: "hired", 已淘汰: "rejected" };
  for (const row of rows) {
    const key = map[row.stage];
    if (key) stats[key] += 1;
  }
  return stats;
}

function overtimeStats(rows) {
  const people = new Map();
  let totalHours = 0;
  for (const row of rows) {
    const hours = Number(row.hours || 0);
    totalHours = round1(totalHours + hours);
    people.set(row.personName, round1((people.get(row.personName) || 0) + hours));
  }
  const byPerson = [...people.entries()]
    .map(([personName, hours]) => ({ personName, hours }))
    .sort((a, b) => b.hours - a.hours || a.personName.localeCompare(b.personName, "zh"));
  return { totalHours, byPerson };
}

function mapInterview(row) {
  return {
    id: Number(row.id),
    candidateName: row.candidate_name ?? row.candidateName,
    position: row.position_name ?? row.position ?? "",
    interviewer: row.interviewer || "",
    interviewAt: row.interview_at ?? row.interviewAt,
    result: row.result_name ?? row.result,
    note: row.note_text ?? row.note ?? "",
    createdBy: row.created_by ?? row.createdBy ?? "",
    createdAt: row.created_at ?? row.createdAt
  };
}

function mapAttendance(row) {
  return {
    id: Number(row.id),
    personName: row.person_name ?? row.personName,
    workDate: row.work_date ?? row.workDate,
    checkIn: row.check_in ?? row.checkIn ?? "",
    checkOut: row.check_out ?? row.checkOut ?? "",
    status: row.status_name ?? row.status,
    note: row.note_text ?? row.note ?? "",
    createdBy: row.created_by ?? row.createdBy ?? "",
    createdAt: row.created_at ?? row.createdAt
  };
}

function mapTimeoff(row) {
  return {
    id: Number(row.id),
    personName: row.person_name ?? row.personName,
    startOn: row.start_on ?? row.startOn,
    endOn: row.end_on ?? row.endOn,
    hours: round1(row.hours),
    reason: row.reason || "",
    status: row.status_name ?? row.status,
    createdBy: row.created_by ?? row.createdBy ?? "",
    createdAt: row.created_at ?? row.createdAt
  };
}

function mapTalent(row) {
  return {
    id: Number(row.id),
    name: row.person_name ?? row.name,
    phone: row.phone || "",
    targetRole: row.target_role ?? row.targetRole ?? "",
    source: row.source_name ?? row.source ?? "",
    stage: row.stage_name ?? row.stage,
    note: row.note_text ?? row.note ?? "",
    createdBy: row.created_by ?? row.createdBy ?? "",
    createdAt: row.created_at ?? row.createdAt
  };
}

function mapOvertime(row) {
  return {
    id: Number(row.id),
    personName: row.person_name ?? row.personName,
    workDate: row.work_date ?? row.workDate,
    hours: round1(row.hours),
    reason: row.reason || "",
    createdBy: row.created_by ?? row.createdBy ?? "",
    createdAt: row.created_at ?? row.createdAt
  };
}

async function selectAll(sql, params, map) {
  const [rows] = await query(sql, params);
  return rows.map(map);
}

export async function listInterviews({ month = "" } = {}) {
  await ensureHrSchema();
  const picked = mustMonth(month);
  if (dbMode() === "mysql") {
    const sql = picked
      ? "SELECT * FROM hr_interviews WHERE interview_at LIKE ? ORDER BY interview_at DESC, id DESC"
      : "SELECT * FROM hr_interviews ORDER BY interview_at DESC, id DESC";
    const interviews = await selectAll(sql, picked ? [`${picked}%`] : [], mapInterview);
    return { interviews, stats: interviewStats(interviews) };
  }
  const interviews = byIdDesc(memory.interviews.filter((row) => inMonth(row.interviewAt, picked)).map(mapInterview));
  interviews.sort((a, b) => String(b.interviewAt).localeCompare(String(a.interviewAt)) || b.id - a.id);
  return { interviews, stats: interviewStats(interviews) };
}

export async function createInterview(input = {}, actor = "") {
  await ensureHrSchema();
  const row = {
    candidateName: mustName(input.candidateName, "候选人"),
    position: clip(input.position, 64),
    interviewer: clip(input.interviewer, 64),
    interviewAt: mustWhen(input.interviewAt),
    result: mustChoice(input.result || "待定", INTERVIEW_RESULTS, "面试结果"),
    note: clip(input.note, 500),
    ...stamp(actor)
  };
  if (dbMode() === "mysql") {
    const [result] = await query(
      `INSERT INTO hr_interviews
        (candidate_name, position_name, interviewer, interview_at, result_name, note_text, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.candidateName, row.position, row.interviewer, row.interviewAt, row.result, row.note, row.createdBy, row.createdAt]
    );
    row.id = Number(result.insertId);
    return mapInterview(row);
  }
  row.id = seq++;
  memory.interviews.push(row);
  return mapInterview(row);
}

export async function deleteInterview(id) {
  await ensureHrSchema();
  const key = Number(id);
  if (!Number.isInteger(key) || key <= 0) {
    throw bad("记录不存在", 404);
  }
  if (dbMode() === "mysql") {
    const [result] = await query("DELETE FROM hr_interviews WHERE id = ?", [key]);
    if (!result.affectedRows) throw bad("记录不存在", 404);
    return { id: key };
  }
  const before = memory.interviews.length;
  memory.interviews = memory.interviews.filter((row) => row.id !== key);
  if (memory.interviews.length === before) throw bad("记录不存在", 404);
  return { id: key };
}

export async function listAttendance({ month = "" } = {}) {
  await ensureHrSchema();
  const picked = mustMonth(month);
  if (dbMode() === "mysql") {
    const sql = picked
      ? "SELECT * FROM hr_attendance WHERE work_date LIKE ? ORDER BY work_date DESC, id DESC"
      : "SELECT * FROM hr_attendance ORDER BY work_date DESC, id DESC";
    const attendance = await selectAll(sql, picked ? [`${picked}%`] : [], mapAttendance);
    return { attendance, stats: attendanceStats(attendance) };
  }
  const attendance = memory.attendance
    .filter((row) => inMonth(row.workDate, picked))
    .map(mapAttendance)
    .sort((a, b) => String(b.workDate).localeCompare(String(a.workDate)) || b.id - a.id);
  return { attendance, stats: attendanceStats(attendance) };
}

export async function createAttendance(input = {}, actor = "") {
  await ensureHrSchema();
  const row = {
    personName: mustName(input.personName, "姓名"),
    workDate: mustDate(input.workDate, "考勤日期"),
    checkIn: mustTime(input.checkIn, "上班时间"),
    checkOut: mustTime(input.checkOut, "下班时间"),
    status: mustChoice(input.status, ATTENDANCE_STATUSES, "考勤状态"),
    note: clip(input.note, 500),
    ...stamp(actor)
  };
  if (dbMode() === "mysql") {
    try {
      const [result] = await query(
        `INSERT INTO hr_attendance
          (person_name, work_date, check_in, check_out, status_name, note_text, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [row.personName, row.workDate, row.checkIn, row.checkOut, row.status, row.note, row.createdBy, row.createdAt]
      );
      row.id = Number(result.insertId);
    } catch (err) {
      if (err && (err.code === "ER_DUP_ENTRY" || err.errno === 1062)) {
        throw bad("这一天已经有这条考勤", 409);
      }
      throw err;
    }
    return mapAttendance(row);
  }
  if (memory.attendance.some((item) => item.personName === row.personName && item.workDate === row.workDate)) {
    throw bad("这一天已经有这条考勤", 409);
  }
  row.id = seq++;
  memory.attendance.push(row);
  return mapAttendance(row);
}

export async function deleteAttendance(id) {
  return deleteById("hr_attendance", memory.attendance, id, (next) => {
    memory.attendance = next;
  });
}

export async function listTimeoff() {
  await ensureHrSchema();
  if (dbMode() === "mysql") {
    const timeoff = await selectAll(
      "SELECT * FROM hr_timeoff ORDER BY start_on DESC, id DESC",
      [],
      mapTimeoff
    );
    return { timeoff, stats: timeoffStats(timeoff) };
  }
  const timeoff = memory.timeoff
    .map(mapTimeoff)
    .sort((a, b) => String(b.startOn).localeCompare(String(a.startOn)) || b.id - a.id);
  return { timeoff, stats: timeoffStats(timeoff) };
}

export async function createTimeoff(input = {}, actor = "") {
  await ensureHrSchema();
  const startOn = mustDate(input.startOn, "开始日期");
  const endOn = mustDate(input.endOn, "结束日期");
  if (endOn < startOn) {
    throw bad("结束日期不能早于开始日期");
  }
  const row = {
    personName: mustName(input.personName, "姓名"),
    startOn,
    endOn,
    hours: mustHours(input.hours, "调休时长", 240),
    reason: clip(input.reason, 500),
    status: mustChoice(input.status || "待审", TIMEOFF_STATUSES, "调休状态"),
    ...stamp(actor)
  };
  if (dbMode() === "mysql") {
    const [result] = await query(
      `INSERT INTO hr_timeoff
        (person_name, start_on, end_on, hours, reason, status_name, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.personName, row.startOn, row.endOn, row.hours, row.reason, row.status, row.createdBy, row.createdAt]
    );
    row.id = Number(result.insertId);
    return mapTimeoff(row);
  }
  row.id = seq++;
  memory.timeoff.push(row);
  return mapTimeoff(row);
}

export async function updateTimeoffStatus(id, status) {
  await ensureHrSchema();
  const key = mustPositiveId(id);
  const next = mustChoice(status, TIMEOFF_STATUSES, "调休状态");
  if (dbMode() === "mysql") {
    const [result] = await query("UPDATE hr_timeoff SET status_name = ? WHERE id = ?", [next, key]);
    if (!result.affectedRows) throw bad("记录不存在", 404);
    const [rows] = await query("SELECT * FROM hr_timeoff WHERE id = ?", [key]);
    return mapTimeoff(rows[0]);
  }
  const row = memory.timeoff.find((item) => item.id === key);
  if (!row) throw bad("记录不存在", 404);
  row.status = next;
  return mapTimeoff(row);
}

export async function deleteTimeoff(id) {
  return deleteById("hr_timeoff", memory.timeoff, id, (next) => {
    memory.timeoff = next;
  });
}

export async function listTalents() {
  await ensureHrSchema();
  if (dbMode() === "mysql") {
    const talents = await selectAll("SELECT * FROM hr_talents ORDER BY id DESC", [], mapTalent);
    return { talents, stats: talentStats(talents) };
  }
  const talents = byIdDesc(memory.talents.map(mapTalent));
  return { talents, stats: talentStats(talents) };
}

export async function createTalent(input = {}, actor = "") {
  await ensureHrSchema();
  const phone = clip(input.phone, 32);
  if (phone && !/^[0-9+\-\s]{5,32}$/.test(phone)) {
    throw bad("电话只保留数字、加号和短横线");
  }
  const row = {
    name: mustName(input.name, "姓名"),
    phone,
    targetRole: clip(input.targetRole, 64),
    source: clip(input.source, 64),
    stage: mustChoice(input.stage || "储备", TALENT_STAGES, "人才阶段"),
    note: clip(input.note, 500),
    ...stamp(actor)
  };
  if (dbMode() === "mysql") {
    const [result] = await query(
      `INSERT INTO hr_talents
        (person_name, phone, target_role, source_name, stage_name, note_text, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.name, row.phone, row.targetRole, row.source, row.stage, row.note, row.createdBy, row.createdAt]
    );
    row.id = Number(result.insertId);
    return mapTalent(row);
  }
  row.id = seq++;
  memory.talents.push(row);
  return mapTalent(row);
}

export async function updateTalentStage(id, stage) {
  await ensureHrSchema();
  const key = mustPositiveId(id);
  const next = mustChoice(stage, TALENT_STAGES, "人才阶段");
  if (dbMode() === "mysql") {
    const [result] = await query("UPDATE hr_talents SET stage_name = ? WHERE id = ?", [next, key]);
    if (!result.affectedRows) throw bad("记录不存在", 404);
    const [rows] = await query("SELECT * FROM hr_talents WHERE id = ?", [key]);
    return mapTalent(rows[0]);
  }
  const row = memory.talents.find((item) => item.id === key);
  if (!row) throw bad("记录不存在", 404);
  row.stage = next;
  return mapTalent(row);
}

export async function deleteTalent(id) {
  return deleteById("hr_talents", memory.talents, id, (next) => {
    memory.talents = next;
  });
}

export async function listOvertime({ month = "" } = {}) {
  await ensureHrSchema();
  const picked = mustMonth(month);
  if (dbMode() === "mysql") {
    const sql = picked
      ? "SELECT * FROM hr_overtime WHERE work_date LIKE ? ORDER BY work_date DESC, id DESC"
      : "SELECT * FROM hr_overtime ORDER BY work_date DESC, id DESC";
    const overtime = await selectAll(sql, picked ? [`${picked}%`] : [], mapOvertime);
    return { overtime, stats: overtimeStats(overtime) };
  }
  const overtime = memory.overtime
    .filter((row) => inMonth(row.workDate, picked))
    .map(mapOvertime)
    .sort((a, b) => String(b.workDate).localeCompare(String(a.workDate)) || b.id - a.id);
  return { overtime, stats: overtimeStats(overtime) };
}

export async function createOvertime(input = {}, actor = "") {
  await ensureHrSchema();
  const row = {
    personName: mustName(input.personName, "姓名"),
    workDate: mustDate(input.workDate, "加班日期"),
    hours: mustHours(input.hours, "加班时长", 24),
    reason: clip(input.reason, 500),
    ...stamp(actor)
  };
  if (dbMode() === "mysql") {
    const [sumRows] = await query(
      "SELECT COALESCE(SUM(hours), 0) AS total FROM hr_overtime WHERE person_name = ? AND work_date = ?",
      [row.personName, row.workDate]
    );
    const used = Number(sumRows[0]?.total || 0);
    if (round1(used + row.hours) > 24) {
      throw bad("同一人同一天加班不能超过 24 小时");
    }
    const [result] = await query(
      `INSERT INTO hr_overtime
        (person_name, work_date, hours, reason, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [row.personName, row.workDate, row.hours, row.reason, row.createdBy, row.createdAt]
    );
    row.id = Number(result.insertId);
    return mapOvertime(row);
  }
  const used = memory.overtime
    .filter((item) => item.personName === row.personName && item.workDate === row.workDate)
    .reduce((sum, item) => sum + Number(item.hours), 0);
  if (round1(used + row.hours) > 24) {
    throw bad("同一人同一天加班不能超过 24 小时");
  }
  row.id = seq++;
  memory.overtime.push(row);
  return mapOvertime(row);
}

export async function deleteOvertime(id) {
  return deleteById("hr_overtime", memory.overtime, id, (next) => {
    memory.overtime = next;
  });
}

function mustPositiveId(id) {
  const key = Number(id);
  if (!Number.isInteger(key) || key <= 0) {
    throw bad("记录不存在", 404);
  }
  return key;
}

async function deleteById(table, rows, id, assign) {
  await ensureHrSchema();
  const key = mustPositiveId(id);
  if (dbMode() === "mysql") {
    const [result] = await query(`DELETE FROM ${table} WHERE id = ?`, [key]);
    if (!result.affectedRows) throw bad("记录不存在", 404);
    return { id: key };
  }
  const next = rows.filter((row) => row.id !== key);
  if (next.length === rows.length) throw bad("记录不存在", 404);
  assign(next);
  return { id: key };
}
