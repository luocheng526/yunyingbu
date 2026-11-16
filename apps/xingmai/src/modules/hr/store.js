import { dbMode, query } from "../profile/auth.js";

export const HR_TABS = ["看板", "加班", "调休", "人才", "面试"];
export const INTERVIEW_RESULTS = ["待定", "通过", "未通过", "未到场"];
export const TALENT_STAGES = ["储备", "面试中", "已入职", "已淘汰"];

export const HR_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS hr_ding_users (
    dingtalk_userid VARCHAR(64) NOT NULL PRIMARY KEY,
    user_name VARCHAR(64) NOT NULL DEFAULT '',
    job_number VARCHAR(64) NOT NULL DEFAULT '',
    department VARCHAR(64) NOT NULL DEFAULT '',
    updated_at VARCHAR(40) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS hr_ding_links (
    person_id INT NOT NULL PRIMARY KEY,
    dingtalk_userid VARCHAR(64) NOT NULL,
    match_by VARCHAR(16) NOT NULL,
    employee_no VARCHAR(64) NOT NULL DEFAULT '',
    updated_at VARCHAR(40) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS hr_punches (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    person_id INT NOT NULL DEFAULT 0,
    dingtalk_userid VARCHAR(64) NOT NULL DEFAULT '',
    user_name VARCHAR(64) NOT NULL DEFAULT '',
    job_number VARCHAR(64) NOT NULL DEFAULT '',
    department VARCHAR(64) NOT NULL DEFAULT '',
    work_date VARCHAR(10) NOT NULL,
    check_type VARCHAR(16) NOT NULL,
    time_result VARCHAR(32) NOT NULL DEFAULT '',
    label VARCHAR(16) NOT NULL DEFAULT '',
    check_at VARCHAR(32) NOT NULL DEFAULT '',
    record_id VARCHAR(64) NOT NULL DEFAULT '',
    UNIQUE KEY uq_hr_punch_user (dingtalk_userid, work_date, check_type, record_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS hr_overtime_days (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    person_id INT NOT NULL,
    work_date VARCHAR(10) NOT NULL,
    hours DECIMAL(5,1) NOT NULL,
    source_name VARCHAR(16) NOT NULL DEFAULT 'ding',
    UNIQUE KEY uq_hr_ot (person_id, work_date)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS hr_leave_quotas (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    person_id INT NOT NULL,
    leave_code VARCHAR(64) NOT NULL,
    leave_name VARCHAR(64) NOT NULL DEFAULT '',
    quota_hours DECIMAL(8,1) NOT NULL DEFAULT 0,
    used_hours DECIMAL(8,1) NOT NULL DEFAULT 0,
    balance_hours DECIMAL(8,1) NOT NULL DEFAULT 0,
    UNIQUE KEY uq_hr_quota (person_id, leave_code)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS hr_leave_records (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    person_id INT NOT NULL,
    leave_code VARCHAR(64) NOT NULL DEFAULT '',
    leave_name VARCHAR(64) NOT NULL DEFAULT '',
    start_at VARCHAR(32) NOT NULL,
    end_at VARCHAR(32) NOT NULL,
    duration VARCHAR(32) NOT NULL DEFAULT '',
    record_key VARCHAR(191) NOT NULL,
    UNIQUE KEY uq_hr_leave (record_key)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
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
  `CREATE TABLE IF NOT EXISTS hr_sync_runs (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    run_kind VARCHAR(32) NOT NULL,
    work_date VARCHAR(10) NOT NULL DEFAULT '',
    ok_flag TINYINT NOT NULL,
    message VARCHAR(180) NOT NULL DEFAULT '',
    created_at VARCHAR(40) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
];

const memory = emptyMemory();
let seq = 1;
let ready = null;

function emptyMemory() {
  return {
    users: [],
    links: [],
    punches: [],
    overtime: [],
    quotas: [],
    leaves: [],
    interviews: [],
    talents: [],
    runs: []
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

export function resetHrStore() {
  const fresh = emptyMemory();
  Object.assign(memory, fresh);
  seq = 1;
  ready = null;
}

export function ensureHrSchema() {
  if (dbMode() !== "mysql") return Promise.resolve();
  if (!ready) {
    ready = (async () => {
      for (const sql of HR_SCHEMA) await query(sql);
      await migratePunchTable();
      await migrateDingUsers();
    })().catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}

function mustName(value, label) {
  const name = clip(value, 64);
  if (!name) throw bad(`${label}不能为空`);
  return name;
}

function mustChoice(value, options, label) {
  const picked = clip(value, 16);
  if (!options.includes(picked)) throw bad(`${label}不正确`);
  return picked;
}

function mustDate(value, label) {
  const text = clip(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw bad(`${label}要写成 YYYY-MM-DD`);
  return text;
}

function mustMonth(value) {
  const text = clip(value, 7);
  if (!text) return "";
  if (!/^\d{4}-\d{2}$/.test(text)) throw bad("月份要写成 YYYY-MM");
  return text;
}

function mustWhen(value) {
  const text = clip(value, 32).replace("T", " ");
  const match = text.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/);
  if (!match) throw bad("面试时间要写成 YYYY-MM-DD HH:MM");
  return `${match[1]} ${match[2]}`;
}

function inMonth(value, month) {
  return !month || String(value || "").slice(0, 7) === month;
}

function stamp(actor) {
  return { createdBy: clip(actor, 64), createdAt: new Date().toISOString() };
}

async function migratePunchTable() {
  const columns = await rowsOf(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hr_punches'`
  );
  const names = new Set(columns.map((row) => row.COLUMN_NAME));
  if (!names.has("user_name")) {
    await query("ALTER TABLE hr_punches ADD COLUMN user_name VARCHAR(64) NOT NULL DEFAULT ''");
  }
  if (!names.has("job_number")) {
    await query("ALTER TABLE hr_punches ADD COLUMN job_number VARCHAR(64) NOT NULL DEFAULT ''");
  }
  if (!names.has("department")) {
    await query("ALTER TABLE hr_punches ADD COLUMN department VARCHAR(64) NOT NULL DEFAULT ''");
  }
  await query("ALTER TABLE hr_punches MODIFY person_id INT NOT NULL DEFAULT 0");
  const indexes = await rowsOf(
    `SELECT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hr_punches'`
  );
  const indexNames = new Set(indexes.map((row) => row.INDEX_NAME));
  if (indexNames.has("uq_hr_punch")) {
    await query("ALTER TABLE hr_punches DROP INDEX uq_hr_punch");
  }
  if (!indexNames.has("uq_hr_punch_user")) {
    await query(
      "ALTER TABLE hr_punches ADD UNIQUE KEY uq_hr_punch_user (dingtalk_userid, work_date, check_type, record_id)"
    );
  }
}

async function migrateDingUsers() {
  const columns = await rowsOf(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hr_ding_users'`
  );
  const names = new Set(columns.map((row) => row.COLUMN_NAME));
  if (!names.has("department")) {
    await query("ALTER TABLE hr_ding_users ADD COLUMN department VARCHAR(64) NOT NULL DEFAULT ''");
  }
}

async function rowsOf(sql, params = []) {
  const [rows] = await query(sql, params);
  return rows;
}

export async function listDingUsers() {
  await ensureHrSchema();
  if (dbMode() === "mysql") {
    const rows = await rowsOf("SELECT dingtalk_userid, user_name, job_number, department FROM hr_ding_users ORDER BY user_name, dingtalk_userid");
    return rows.map((row) => ({
      userId: row.dingtalk_userid,
      userName: row.user_name || "",
      jobNumber: row.job_number || "",
      department: row.department || ""
    }));
  }
  return memory.users.map((row) => ({ ...row }));
}

export async function saveDingUsers(users) {
  await ensureHrSchema();
  const now = new Date().toISOString();
  const clean = users.map((user) => ({
    userId: clip(user.userId, 64),
    userName: clip(user.name || user.userName, 64),
    jobNumber: clip(user.jobNumber, 64),
    department: clip(user.department, 64),
    updatedAt: now
  })).filter((user) => user.userId);
  if (dbMode() === "mysql") {
    await query("DELETE FROM hr_ding_users");
    for (const user of clean) {
      await query(
        "INSERT INTO hr_ding_users (dingtalk_userid, user_name, job_number, department, updated_at) VALUES (?, ?, ?, ?, ?)",
        [user.userId, user.userName, user.jobNumber, user.department, user.updatedAt]
      );
    }
    return listDingUsers();
  }
  memory.users = clean;
  return listDingUsers();
}

export async function listLinks() {
  await ensureHrSchema();
  if (dbMode() === "mysql") {
    const rows = await rowsOf("SELECT person_id, dingtalk_userid, match_by, employee_no FROM hr_ding_links ORDER BY person_id");
    return rows.map((row) => ({
      personId: Number(row.person_id),
      dingtalkUserId: row.dingtalk_userid,
      matchBy: row.match_by,
      employeeNo: row.employee_no || ""
    }));
  }
  return memory.links.map((row) => ({ ...row }));
}

export async function saveLinks(links) {
  await ensureHrSchema();
  const now = new Date().toISOString();
  const clean = links.map((link) => ({
    personId: Number(link.personId),
    dingtalkUserId: clip(link.dingtalkUserId, 64),
    matchBy: clip(link.matchBy, 16),
    employeeNo: clip(link.employeeNo, 64),
    updatedAt: now
  })).filter((link) => link.personId && link.dingtalkUserId);
  if (dbMode() === "mysql") {
    await query("DELETE FROM hr_ding_links");
    for (const link of clean) {
      await query(
        `INSERT INTO hr_ding_links (person_id, dingtalk_userid, match_by, employee_no, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [link.personId, link.dingtalkUserId, link.matchBy, link.employeeNo, link.updatedAt]
      );
    }
    return listLinks();
  }
  memory.links = clean;
  return listLinks();
}

export async function listPunches({ month = "", date = "" } = {}) {
  await ensureHrSchema();
  const pickedMonth = mustMonth(month);
  const pickedDate = date ? mustDate(date, "日期") : "";
  if (dbMode() === "mysql") {
    const where = [];
    const params = [];
    if (pickedDate) {
      where.push("work_date = ?");
      params.push(pickedDate);
    } else if (pickedMonth) {
      where.push("work_date LIKE ?");
      params.push(`${pickedMonth}%`);
    }
    const sql = `SELECT * FROM hr_punches ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY work_date DESC, user_name, check_type`;
    const rows = await rowsOf(sql, params);
    return rows.map(mapPunch);
  }
  return memory.punches
    .filter((row) => (pickedDate ? row.workDate === pickedDate : inMonth(row.workDate, pickedMonth)))
    .map((row) => ({ ...row }))
    .sort((a, b) => String(b.workDate).localeCompare(String(a.workDate)) || a.personId - b.personId);
}

export async function replaceDayPunches(workDate, userIds, punches) {
  await ensureHrSchema();
  const day = mustDate(workDate, "日期");
  const ids = [...new Set(userIds.map((id) => clip(id, 64)).filter(Boolean))];
  if (dbMode() === "mysql") {
    if (ids.length) {
      await query(
        `DELETE FROM hr_punches WHERE work_date = ? AND dingtalk_userid IN (${ids.map(() => "?").join(",")})`,
        [day, ...ids]
      );
    }
    for (const punch of punches) {
      await query(
        `INSERT INTO hr_punches
          (person_id, dingtalk_userid, user_name, job_number, department, work_date, check_type, time_result, label, check_at, record_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          Number(punch.personId) || 0,
          punch.dingtalkUserId,
          punch.userName || "",
          punch.jobNumber || "",
          punch.department || "",
          day,
          punch.checkType,
          punch.timeResult,
          punch.label,
          punch.checkAt,
          punch.recordId || ""
        ]
      );
    }
    return listPunches({ date: day });
  }
  memory.punches = memory.punches.filter((row) => !(row.workDate === day && ids.includes(row.dingtalkUserId)));
  for (const punch of punches) memory.punches.push({ ...punch, workDate: day, personId: Number(punch.personId) || 0 });
  return listPunches({ date: day });
}

export async function listOvertime({ month = "" } = {}) {
  await ensureHrSchema();
  const picked = mustMonth(month);
  if (dbMode() === "mysql") {
    const sql = picked
      ? "SELECT * FROM hr_overtime_days WHERE work_date LIKE ? ORDER BY work_date DESC, person_id"
      : "SELECT * FROM hr_overtime_days ORDER BY work_date DESC, person_id";
    const rows = await rowsOf(sql, picked ? [`${picked}%`] : []);
    return rows.map((row) => ({
      personId: Number(row.person_id),
      workDate: row.work_date,
      hours: Number(row.hours),
      source: row.source_name
    }));
  }
  return memory.overtime
    .filter((row) => inMonth(row.workDate, picked))
    .map((row) => ({ ...row }))
    .sort((a, b) => String(b.workDate).localeCompare(String(a.workDate)) || a.personId - b.personId);
}

export async function replaceOvertime(workDate, personIds, rows) {
  await ensureHrSchema();
  const day = mustDate(workDate, "日期");
  const ids = [...new Set(personIds.map((id) => Number(id)).filter((id) => id > 0))];
  if (dbMode() === "mysql") {
    if (ids.length) {
      await query(`DELETE FROM hr_overtime_days WHERE work_date = ? AND person_id IN (${ids.map(() => "?").join(",")})`, [day, ...ids]);
    }
    for (const row of rows) {
      if (!(Number(row.hours) > 0)) continue;
      await query(
        "INSERT INTO hr_overtime_days (person_id, work_date, hours, source_name) VALUES (?, ?, ?, ?)",
        [row.personId, day, row.hours, row.source || "ding"]
      );
    }
    return listOvertime({ month: day.slice(0, 7) });
  }
  memory.overtime = memory.overtime.filter((row) => !(row.workDate === day && ids.includes(row.personId)));
  for (const row of rows) {
    if (Number(row.hours) > 0) memory.overtime.push({ personId: row.personId, workDate: day, hours: Number(row.hours), source: row.source || "ding" });
  }
  return listOvertime({ month: day.slice(0, 7) });
}

export async function listQuotas() {
  await ensureHrSchema();
  if (dbMode() === "mysql") {
    const rows = await rowsOf("SELECT * FROM hr_leave_quotas ORDER BY person_id");
    return rows.map(mapQuota);
  }
  return memory.quotas.map((row) => ({ ...row }));
}

export async function replaceQuotas(rows) {
  await ensureHrSchema();
  if (dbMode() === "mysql") {
    await query("DELETE FROM hr_leave_quotas");
    for (const row of rows) {
      await query(
        `INSERT INTO hr_leave_quotas (person_id, leave_code, leave_name, quota_hours, used_hours, balance_hours)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [row.personId, row.leaveCode, row.leaveName, row.quotaHours, row.usedHours, row.balanceHours]
      );
    }
    return listQuotas();
  }
  memory.quotas = rows.map((row) => ({ ...row }));
  return listQuotas();
}

export async function listLeaves() {
  await ensureHrSchema();
  if (dbMode() === "mysql") {
    const rows = await rowsOf("SELECT * FROM hr_leave_records ORDER BY start_at DESC");
    return rows.map(mapLeave);
  }
  return memory.leaves.map((row) => ({ ...row })).sort((a, b) => String(b.startAt).localeCompare(String(a.startAt)));
}

export async function replaceLeaves(_personIds, rows) {
  await ensureHrSchema();
  if (dbMode() === "mysql") {
    for (const row of rows) {
      await query(
        `INSERT INTO hr_leave_records (person_id, leave_code, leave_name, start_at, end_at, duration, record_key)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE leave_name = VALUES(leave_name), start_at = VALUES(start_at), end_at = VALUES(end_at), duration = VALUES(duration)`,
        [row.personId, row.leaveCode, row.leaveName, row.startAt, row.endAt, row.duration, row.recordKey]
      );
    }
    return listLeaves();
  }
  for (const row of rows) {
    const index = memory.leaves.findIndex((item) => item.recordKey === row.recordKey);
    if (index >= 0) memory.leaves[index] = { ...row };
    else memory.leaves.push({ ...row });
  }
  return listLeaves();
}

export async function recordSync(kind, workDate, ok, message) {
  await ensureHrSchema();
  const row = {
    kind: clip(kind, 32),
    workDate: clip(workDate, 10),
    ok: ok ? 1 : 0,
    message: clip(message, 180),
    createdAt: new Date().toISOString()
  };
  if (dbMode() === "mysql") {
    await query(
      "INSERT INTO hr_sync_runs (run_kind, work_date, ok_flag, message, created_at) VALUES (?, ?, ?, ?, ?)",
      [row.kind, row.workDate, row.ok, row.message, row.createdAt]
    );
  } else {
    memory.runs.push(row);
  }
  return row;
}

export async function latestSync(kind = "") {
  await ensureHrSchema();
  const picked = clip(kind, 32);
  if (dbMode() === "mysql") {
    const rows = picked
      ? await rowsOf("SELECT * FROM hr_sync_runs WHERE run_kind = ? ORDER BY id DESC LIMIT 1", [picked])
      : await rowsOf("SELECT * FROM hr_sync_runs ORDER BY id DESC LIMIT 1");
    if (!rows.length) return null;
    const row = rows[0];
    return { kind: row.run_kind, workDate: row.work_date, ok: Boolean(row.ok_flag), message: row.message, createdAt: row.created_at };
  }
  const rows = picked ? memory.runs.filter((row) => row.kind === picked) : memory.runs;
  return rows.length ? { ...rows[rows.length - 1] } : null;
}

function mapPunch(row) {
  return {
    personId: Number(row.person_id) || 0,
    dingtalkUserId: row.dingtalk_userid,
    userName: row.user_name || "",
    jobNumber: row.job_number || "",
    department: row.department || "",
    workDate: row.work_date,
    checkType: row.check_type,
    timeResult: row.time_result,
    label: row.label,
    checkAt: row.check_at || "",
    recordId: row.record_id || ""
  };
}

function mapQuota(row) {
  return {
    personId: Number(row.person_id),
    leaveCode: row.leave_code,
    leaveName: row.leave_name,
    quotaHours: Number(row.quota_hours),
    usedHours: Number(row.used_hours),
    balanceHours: Number(row.balance_hours)
  };
}

function mapLeave(row) {
  return {
    personId: Number(row.person_id),
    leaveCode: row.leave_code,
    leaveName: row.leave_name,
    startAt: row.start_at,
    endAt: row.end_at,
    duration: row.duration,
    recordKey: row.record_key
  };
}

export async function listInterviews() {
  await ensureHrSchema();
  if (dbMode() === "mysql") {
    const rows = await rowsOf("SELECT * FROM hr_interviews ORDER BY interview_at DESC, id DESC");
    return rows.map((row) => ({
      id: Number(row.id),
      candidateName: row.candidate_name,
      position: row.position_name,
      interviewer: row.interviewer,
      interviewAt: row.interview_at,
      result: row.result_name,
      note: row.note_text,
      createdBy: row.created_by
    }));
  }
  return memory.interviews.map((row) => ({ ...row })).sort((a, b) => String(b.interviewAt).localeCompare(String(a.interviewAt)) || b.id - a.id);
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
    return row;
  }
  row.id = seq++;
  memory.interviews.push(row);
  return { ...row };
}

export async function deleteInterview(id) {
  return removeRow("hr_interviews", memory.interviews, id, (next) => {
    memory.interviews = next;
  });
}

export async function listTalents() {
  await ensureHrSchema();
  if (dbMode() === "mysql") {
    const rows = await rowsOf("SELECT * FROM hr_talents ORDER BY id DESC");
    return rows.map((row) => ({
      id: Number(row.id),
      name: row.person_name,
      phone: row.phone,
      targetRole: row.target_role,
      source: row.source_name,
      stage: row.stage_name,
      note: row.note_text,
      createdBy: row.created_by
    }));
  }
  return memory.talents.map((row) => ({ ...row })).sort((a, b) => b.id - a.id);
}

export async function createTalent(input = {}, actor = "") {
  await ensureHrSchema();
  const phone = clip(input.phone, 32);
  if (phone && !/^[0-9+\-\s]{5,32}$/.test(phone)) throw bad("电话只保留数字、加号和短横线");
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
    return row;
  }
  row.id = seq++;
  memory.talents.push(row);
  return { ...row };
}

export async function deleteTalent(id) {
  return removeRow("hr_talents", memory.talents, id, (next) => {
    memory.talents = next;
  });
}

async function removeRow(table, rows, id, assign) {
  await ensureHrSchema();
  const key = Number(id);
  if (!Number.isInteger(key) || key <= 0) throw bad("记录不存在", 404);
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
