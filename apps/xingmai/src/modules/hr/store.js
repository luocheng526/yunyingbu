import { dbMode, query } from "../profile/auth.js";

export const HR_TABS = ["数据看板", "奋斗时长", "招聘管理", "员工管理", "考勤管理", "薪酬绩效", "培训发展", "组织架构"];
export const GENDERS = ["男", "女"];
export const STAFF_STATUSES = ["在职", "离职"];
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
    plan_at VARCHAR(32) NOT NULL DEFAULT '',
    late_minutes INT NOT NULL DEFAULT 0,
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
    dingtalk_userid VARCHAR(64) NOT NULL DEFAULT '',
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
  `CREATE TABLE IF NOT EXISTS hr_recruits (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    person_name VARCHAR(64) NOT NULL,
    gender VARCHAR(8) NOT NULL DEFAULT '',
    position_name VARCHAR(64) NOT NULL DEFAULT '',
    expected_join VARCHAR(10) NOT NULL DEFAULT '',
    phone VARCHAR(32) NOT NULL DEFAULT '',
    hometown VARCHAR(64) NOT NULL DEFAULT '',
    channel_name VARCHAR(64) NOT NULL DEFAULT '',
    inviter VARCHAR(64) NOT NULL DEFAULT '',
    note_text VARCHAR(500) NOT NULL DEFAULT '',
    detail_text VARCHAR(1000) NOT NULL DEFAULT '',
    record_date VARCHAR(10) NOT NULL DEFAULT '',
    joined_flag TINYINT NOT NULL DEFAULT 0,
    staff_id INT NOT NULL DEFAULT 0,
    created_by VARCHAR(64) NOT NULL DEFAULT '',
    created_at VARCHAR(40) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS hr_onboards (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    person_name VARCHAR(64) NOT NULL,
    gender VARCHAR(8) NOT NULL DEFAULT '',
    department_name VARCHAR(64) NOT NULL DEFAULT '',
    position_name VARCHAR(64) NOT NULL DEFAULT '',
    joined_on VARCHAR(10) NOT NULL DEFAULT '',
    phone VARCHAR(32) NOT NULL DEFAULT '',
    hometown VARCHAR(64) NOT NULL DEFAULT '',
    channel_name VARCHAR(64) NOT NULL DEFAULT '',
    inviter VARCHAR(64) NOT NULL DEFAULT '',
    note_text VARCHAR(500) NOT NULL DEFAULT '',
    detail_text VARCHAR(1000) NOT NULL DEFAULT '',
    created_by VARCHAR(64) NOT NULL DEFAULT '',
    created_at VARCHAR(40) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS hr_staff (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    person_name VARCHAR(64) NOT NULL,
    gender VARCHAR(8) NOT NULL DEFAULT '',
    job_number VARCHAR(64) NOT NULL DEFAULT '',
    department_name VARCHAR(64) NOT NULL DEFAULT '',
    position_name VARCHAR(64) NOT NULL DEFAULT '',
    phone VARCHAR(32) NOT NULL DEFAULT '',
    joined_on VARCHAR(10) NOT NULL DEFAULT '',
    birthday VARCHAR(10) NOT NULL DEFAULT '',
    left_on VARCHAR(10) NOT NULL DEFAULT '',
    status_name VARCHAR(16) NOT NULL DEFAULT '在职',
    hometown VARCHAR(64) NOT NULL DEFAULT '',
    education VARCHAR(32) NOT NULL DEFAULT '',
    emergency_name VARCHAR(64) NOT NULL DEFAULT '',
    emergency_phone VARCHAR(32) NOT NULL DEFAULT '',
    note_text VARCHAR(500) NOT NULL DEFAULT '',
    dingtalk_userid VARCHAR(64) NOT NULL DEFAULT '',
    created_by VARCHAR(64) NOT NULL DEFAULT '',
    created_at VARCHAR(40) NOT NULL,
    updated_at VARCHAR(40) NOT NULL
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
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS hr_board_days (
    work_date VARCHAR(10) NOT NULL PRIMARY KEY,
    metrics_json MEDIUMTEXT NOT NULL,
    punches_json MEDIUMTEXT NOT NULL,
    saved_at VARCHAR(40) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS hr_effort_months (
    \`year_month\` VARCHAR(7) NOT NULL,
    report_json MEDIUMTEXT NOT NULL,
    saved_at VARCHAR(40) NOT NULL,
    PRIMARY KEY (\`year_month\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS hr_api_usage (
    usage_month VARCHAR(7) NOT NULL PRIMARY KEY,
    baseline_calls INT NOT NULL DEFAULT 0,
    made_calls INT NOT NULL DEFAULT 0,
    updated_at VARCHAR(40) NOT NULL
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
    recruits: [],
    onboards: [],
    staff: [],
    talents: [],
    runs: [],
    boards: [],
    effort: [],
    usage: []
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
  apiCallChain = Promise.resolve();
}

export function ensureHrSchema() {
  if (dbMode() !== "mysql") return Promise.resolve();
  if (!ready) {
    ready = (async () => {
      const errors = [];
      for (const sql of HR_SCHEMA) {
        try {
          await query(sql);
        } catch (err) {
          errors.push(String(err.sqlMessage || err.message || "建表失败"));
        }
      }
      for (const step of [migratePunchTable, migrateDingUsers, migrateRecruitTable, migrateLeaveTable, migrateStaffTable]) {
        try {
          await step();
        } catch (err) {
          errors.push(String(err.sqlMessage || err.message || "补字段失败"));
        }
      }
      try {
        await query("SELECT 1 FROM hr_ding_links LIMIT 1");
      } catch (err) {
        const reason = errors[0] || String(err.sqlMessage || err.message || "人事表读不了");
        const wrapped = new Error(reason);
        wrapped.sqlMessage = reason;
        throw wrapped;
      }
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

function optionalGender(value) {
  const text = clip(value, 8);
  if (!text) return "";
  if (!GENDERS.includes(text)) throw bad("性别请选男或女");
  return text;
}

function optionalDate(value, label) {
  const text = clip(value, 10);
  if (!text) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw bad(`${label}要写成 YYYY-MM-DD`);
  return text;
}

function optionalPhone(value) {
  const phone = clip(value, 32);
  if (phone && !/^[0-9+\-\s]{5,32}$/.test(phone)) throw bad("电话只保留数字、加号和短横线");
  return phone;
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

async function migrateRecruitTable() {
  const columns = await rowsOf(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hr_recruits'`
  );
  const names = new Set(columns.map((row) => row.COLUMN_NAME));
  if (!names.has("record_date")) {
    await query("ALTER TABLE hr_recruits ADD COLUMN record_date VARCHAR(10) NOT NULL DEFAULT ''");
    await query(
      `UPDATE hr_recruits
       SET record_date = CASE
         WHEN expected_join <> '' THEN LEFT(expected_join, 10)
         ELSE LEFT(created_at, 10)
       END
       WHERE record_date = ''`
    );
  }
  if (!names.has("joined_flag")) {
    await query("ALTER TABLE hr_recruits ADD COLUMN joined_flag TINYINT NOT NULL DEFAULT 0");
  }
  if (!names.has("staff_id")) {
    await query("ALTER TABLE hr_recruits ADD COLUMN staff_id INT NOT NULL DEFAULT 0");
  }
}

async function migrateLeaveTable() {
  const columns = await rowsOf(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hr_leave_records'`
  );
  const names = new Set(columns.map((row) => row.COLUMN_NAME));
  if (!names.has("dingtalk_userid")) {
    await query("ALTER TABLE hr_leave_records ADD COLUMN dingtalk_userid VARCHAR(64) NOT NULL DEFAULT ''");
  }
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
  if (!names.has("plan_at")) {
    await query("ALTER TABLE hr_punches ADD COLUMN plan_at VARCHAR(32) NOT NULL DEFAULT ''");
  }
  if (!names.has("late_minutes")) {
    await query("ALTER TABLE hr_punches ADD COLUMN late_minutes INT NOT NULL DEFAULT 0");
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
  if (!indexNames.has("idx_hr_punch_day")) {
    await query("ALTER TABLE hr_punches ADD INDEX idx_hr_punch_day (work_date)");
  }
}

async function migrateStaffTable() {
  const columns = await rowsOf(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hr_staff'`
  );
  const names = new Set(columns.map((row) => row.COLUMN_NAME));
  if (!names.has("birthday")) {
    await query("ALTER TABLE hr_staff ADD COLUMN birthday VARCHAR(10) NOT NULL DEFAULT ''");
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

export async function saveLinks(links, options = {}) {
  await ensureHrSchema();
  const keepManual = Boolean(options.keepManual);
  const now = new Date().toISOString();
  const clean = links.map((link) => ({
    personId: Number(link.personId),
    dingtalkUserId: clip(link.dingtalkUserId, 64),
    matchBy: clip(link.matchBy, 16),
    employeeNo: clip(link.employeeNo, 64),
    updatedAt: now
  })).filter((link) => link.personId && link.dingtalkUserId);
  if (dbMode() === "mysql") {
    await query(keepManual ? "DELETE FROM hr_ding_links WHERE match_by <> 'manual'" : "DELETE FROM hr_ding_links");
    const kept = keepManual ? await listLinks() : [];
    const blockedPeople = new Set(kept.map((link) => link.personId));
    const blockedUsers = new Set(kept.map((link) => link.dingtalkUserId));
    for (const link of clean) {
      if (keepManual && (blockedPeople.has(link.personId) || blockedUsers.has(link.dingtalkUserId))) continue;
      await query(
        `INSERT INTO hr_ding_links (person_id, dingtalk_userid, match_by, employee_no, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [link.personId, link.dingtalkUserId, link.matchBy, link.employeeNo, link.updatedAt]
      );
    }
    return listLinks();
  }
  if (!keepManual) {
    memory.links = clean;
    return listLinks();
  }
  const manual = memory.links.filter((link) => link.matchBy === "manual");
  const blockedPeople = new Set(manual.map((link) => link.personId));
  const blockedUsers = new Set(manual.map((link) => link.dingtalkUserId));
  memory.links = manual.concat(clean.filter((link) => !blockedPeople.has(link.personId) && !blockedUsers.has(link.dingtalkUserId)));
  return listLinks();
}

export async function upsertLink(input = {}) {
  await ensureHrSchema();
  const personId = Number(input.personId);
  const dingtalkUserId = clip(input.dingtalkUserId, 64);
  if (!personId || personId < 1) throw bad("要选择组织里的人");
  if (!dingtalkUserId) throw bad("要选择钉钉里的人");
  const row = {
    personId,
    dingtalkUserId,
    matchBy: "manual",
    employeeNo: clip(input.employeeNo, 64),
    updatedAt: new Date().toISOString()
  };
  if (dbMode() === "mysql") {
    await query("DELETE FROM hr_ding_links WHERE person_id = ? OR dingtalk_userid = ?", [personId, dingtalkUserId]);
    await query(
      `INSERT INTO hr_ding_links (person_id, dingtalk_userid, match_by, employee_no, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [row.personId, row.dingtalkUserId, row.matchBy, row.employeeNo, row.updatedAt]
    );
    return row;
  }
  memory.links = memory.links.filter((link) => link.personId !== personId && link.dingtalkUserId !== dingtalkUserId);
  memory.links.push(row);
  return { ...row };
}

export async function deleteLink(personId) {
  await ensureHrSchema();
  const id = Number(personId);
  if (!id) throw bad("找不到这条对齐");
  if (dbMode() === "mysql") {
    await query("DELETE FROM hr_ding_links WHERE person_id = ?", [id]);
  } else {
    memory.links = memory.links.filter((link) => link.personId !== id);
  }
  return { id };
}

export async function listPunches({ month = "", date = "", from = "", to = "" } = {}) {
  await ensureHrSchema();
  const pickedMonth = mustMonth(month);
  const pickedDate = date ? mustDate(date, "日期") : "";
  const pickedFrom = from ? mustDate(from, "开始日期") : "";
  const pickedTo = to ? mustDate(to, "结束日期") : "";
  if (dbMode() === "mysql") {
    const where = [];
    const params = [];
    if (pickedDate) {
      where.push("work_date = ?");
      params.push(pickedDate);
    } else if (pickedFrom && pickedTo) {
      where.push("work_date >= ? AND work_date <= ?");
      params.push(pickedFrom, pickedTo);
    } else if (pickedMonth) {
      where.push("work_date LIKE ?");
      params.push(`${pickedMonth}%`);
    }
    const sql = `SELECT * FROM hr_punches ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY work_date DESC, user_name, check_type`;
    const rows = await rowsOf(sql, params);
    return rows.map(mapPunch);
  }
  return memory.punches
    .filter((row) => {
      if (pickedDate) return row.workDate === pickedDate;
      if (pickedFrom && pickedTo) return row.workDate >= pickedFrom && row.workDate <= pickedTo;
      return inMonth(row.workDate, pickedMonth);
    })
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

export async function markLatePunches(workDate, rows) {
  await ensureHrSchema();
  const day = mustDate(workDate, "日期");
  const clean = (rows || []).map((row) => ({
    dingtalkUserId: clip(row.dingtalkUserId, 64),
    userName: clip(row.userName, 64),
    jobNumber: clip(row.jobNumber, 64),
    department: clip(row.department, 64),
    timeResult: clip(row.timeResult, 32),
    label: clip(row.label, 16),
    planAt: clip(row.planAt, 32),
    checkAt: clip(row.checkAt, 32),
    minutes: Math.max(0, Number(row.minutes) || 0)
  })).filter((row) => row.dingtalkUserId && row.timeResult);
  if (dbMode() === "mysql") {
    for (const row of clean) {
      await query(
        `UPDATE hr_punches
         SET time_result = ?, label = ?, plan_at = ?, late_minutes = ?,
             check_at = CASE WHEN check_at = '' AND ? <> '' THEN ? ELSE check_at END
         WHERE work_date = ? AND dingtalk_userid = ? AND check_type = 'OnDuty'`,
        [row.timeResult, row.label, row.planAt, row.minutes, row.checkAt, row.checkAt, day, row.dingtalkUserId]
      );
      const existing = await rowsOf(
        "SELECT id FROM hr_punches WHERE work_date = ? AND dingtalk_userid = ? AND check_type = 'OnDuty' LIMIT 1",
        [day, row.dingtalkUserId]
      );
      if (existing.length) continue;
      await query(
        `INSERT INTO hr_punches
          (person_id, dingtalk_userid, user_name, job_number, department, work_date, check_type, time_result, label, check_at, plan_at, late_minutes, record_id)
         VALUES (0, ?, ?, ?, ?, ?, 'OnDuty', ?, ?, ?, ?, ?, ?)`,
        [row.dingtalkUserId, row.userName, row.jobNumber, row.department, day, row.timeResult, row.label, row.checkAt, row.planAt, row.minutes, `late-${row.dingtalkUserId}`]
      );
    }
    return listPunches({ date: day });
  }
  for (const row of clean) {
    const existing = memory.punches.filter((item) => item.workDate === day && item.dingtalkUserId === row.dingtalkUserId && item.checkType !== "OffDuty");
    if (!existing.length) {
      memory.punches.push({
        personId: 0,
        dingtalkUserId: row.dingtalkUserId,
        userName: row.userName,
        jobNumber: row.jobNumber,
        department: row.department,
        workDate: day,
        checkType: "OnDuty",
        timeResult: row.timeResult,
        label: row.label,
        checkAt: row.checkAt,
        planAt: row.planAt,
        lateMinutes: row.minutes,
        recordId: `late-${row.dingtalkUserId}`
      });
      continue;
    }
    for (const item of existing) {
      item.timeResult = row.timeResult;
      item.label = row.label;
      item.planAt = row.planAt;
      item.lateMinutes = row.minutes;
      if (!item.checkAt && row.checkAt) item.checkAt = row.checkAt;
    }
  }
  return listPunches({ date: day });
}

export async function saveBoardDay(workDate, snapshot) {
  await ensureHrSchema();
  const day = mustDate(workDate, "日期");
  const metrics = (snapshot.teams || []).map((team) => ({
    id: team.id,
    title: team.title,
    board: team.board
  }));
  const punches = {};
  for (const team of snapshot.teams || []) {
    punches[team.id] = { punches: team.punches || [], roster: team.roster || [] };
  }
  const savedAt = new Date().toISOString();
  if (dbMode() === "mysql") {
    await query(
      `INSERT INTO hr_board_days (work_date, metrics_json, punches_json, saved_at)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE metrics_json = VALUES(metrics_json), punches_json = VALUES(punches_json), saved_at = VALUES(saved_at)`,
      [day, JSON.stringify(metrics), JSON.stringify(punches), savedAt]
    );
    return { workDate: day, savedAt };
  }
  const row = { workDate: day, metrics, punches, savedAt };
  const index = memory.boards.findIndex((item) => item.workDate === day);
  if (index >= 0) memory.boards[index] = row;
  else memory.boards.push(row);
  return { workDate: day, savedAt };
}

export async function listBoardMetrics(dates) {
  await ensureHrSchema();
  const wanted = [...new Set((dates || []).map((day) => clip(day, 10)).filter(Boolean))];
  if (!wanted.length) return {};
  if (dbMode() === "mysql") {
    const rows = await rowsOf(
      `SELECT work_date, metrics_json FROM hr_board_days WHERE work_date IN (${wanted.map(() => "?").join(",")})`,
      wanted
    );
    const out = {};
    for (const row of rows) out[row.work_date] = JSON.parse(row.metrics_json || "[]");
    return out;
  }
  const out = {};
  for (const row of memory.boards) {
    if (wanted.includes(row.workDate)) out[row.workDate] = row.metrics;
  }
  return out;
}

export async function readBoardStamp(workDate) {
  await ensureHrSchema();
  const day = mustDate(workDate, "日期");
  if (dbMode() === "mysql") {
    const rows = await rowsOf("SELECT saved_at FROM hr_board_days WHERE work_date = ?", [day]);
    return rows.length ? String(rows[0].saved_at || "") : "";
  }
  const row = memory.boards.find((item) => item.workDate === day);
  return row ? String(row.savedAt || "") : "";
}

export async function saveEffortMonth(yearMonth, report) {
  await ensureHrSchema();
  const month = mustMonth(yearMonth);
  if (!month) throw bad("月份要写成 YYYY-MM");
  const savedAt = new Date().toISOString();
  const body = JSON.stringify(report || {});
  if (dbMode() === "mysql") {
    await query(
      `INSERT INTO hr_effort_months (\`year_month\`, report_json, saved_at)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE report_json = VALUES(report_json), saved_at = VALUES(saved_at)`,
      [month, body, savedAt]
    );
    return { month, savedAt };
  }
  const row = { month, report: JSON.parse(body), savedAt };
  const index = memory.effort.findIndex((item) => item.month === month);
  if (index >= 0) memory.effort[index] = row;
  else memory.effort.push(row);
  return { month, savedAt };
}

export async function readEffortMonth(yearMonth) {
  await ensureHrSchema();
  const month = mustMonth(yearMonth);
  if (!month) return null;
  if (dbMode() === "mysql") {
    const rows = await rowsOf("SELECT report_json, saved_at FROM hr_effort_months WHERE \`year_month\` = ?", [month]);
    if (!rows.length) return null;
    return { month, report: JSON.parse(rows[0].report_json || "{}"), savedAt: String(rows[0].saved_at || "") };
  }
  const row = memory.effort.find((item) => item.month === month);
  return row ? { month, report: row.report, savedAt: String(row.savedAt || "") } : null;
}

export async function readBoardPunches(workDate) {
  await ensureHrSchema();
  const day = mustDate(workDate, "日期");
  if (dbMode() === "mysql") {
    const rows = await rowsOf("SELECT punches_json FROM hr_board_days WHERE work_date = ?", [day]);
    if (!rows.length) return null;
    return JSON.parse(rows[0].punches_json || "{}");
  }
  const row = memory.boards.find((item) => item.workDate === day);
  return row ? row.punches : null;
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

function leaveRow(row) {
  return {
    personId: Number(row.personId) || 0,
    dingtalkUserId: clip(row.dingtalkUserId, 64),
    leaveCode: clip(row.leaveCode, 64),
    leaveName: clip(row.leaveName, 64),
    startAt: clip(row.startAt, 32),
    endAt: clip(row.endAt, 32),
    duration: clip(row.duration, 32),
    recordKey: clip(row.recordKey, 191)
  };
}

export async function replaceLeaves(userIds, rows) {
  await ensureHrSchema();
  const ids = [...new Set((userIds || []).map((id) => clip(id, 64)).filter(Boolean))];
  return replaceLeavesInRange(ids, "0000-01-01 00:00", "9999-12-31 23:59", rows);
}

export async function replaceLeavesInRange(userIds, startAt, endAt, rows) {
  await ensureHrSchema();
  const ids = [...new Set((userIds || []).map((id) => clip(id, 64)).filter(Boolean))];
  const start = clip(startAt, 32);
  const end = clip(endAt, 32);
  const clean = (rows || []).map(leaveRow).filter((row) => row.recordKey && row.dingtalkUserId);
  if (dbMode() === "mysql") {
    if (ids.length && start && end) {
      await query(
        `DELETE FROM hr_leave_records WHERE dingtalk_userid IN (${ids.map(() => "?").join(",")}) AND start_at <= ? AND end_at >= ?`,
        [...ids, end, start]
      );
    }
    if (start && end) {
      await query("DELETE FROM hr_leave_records WHERE dingtalk_userid = '' AND start_at <= ? AND end_at >= ?", [end, start]);
    }
    for (const row of clean) {
      await query(
        `INSERT INTO hr_leave_records
          (person_id, dingtalk_userid, leave_code, leave_name, start_at, end_at, duration, record_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE dingtalk_userid = VALUES(dingtalk_userid), leave_name = VALUES(leave_name),
           start_at = VALUES(start_at), end_at = VALUES(end_at), duration = VALUES(duration)`,
        [row.personId, row.dingtalkUserId, row.leaveCode, row.leaveName, row.startAt, row.endAt, row.duration, row.recordKey]
      );
    }
    return listLeaves();
  }
  memory.leaves = memory.leaves.filter((row) => {
    const overlaps = String(row.startAt || "") <= end && String(row.endAt || "") >= start;
    if (!overlaps) return true;
    if (!row.dingtalkUserId) return false;
    return !ids.includes(row.dingtalkUserId);
  });
  for (const row of clean) {
    const index = memory.leaves.findIndex((item) => item.recordKey === row.recordKey);
    if (index >= 0) memory.leaves[index] = row;
    else memory.leaves.push(row);
  }
  return listLeaves();
}

export async function renameCoveringLeaves(workDate, updates) {
  await ensureHrSchema();
  const day = String(workDate || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
  const start = `${day} 00:00`;
  const end = `${day} 23:59`;
  const rows = (updates || []).filter((row) => row && row.dingtalkUserId && row.leaveName && row.leaveName !== "请假");
  if (dbMode() === "mysql") {
    for (const row of rows) {
      await query(
        `UPDATE hr_leave_records SET leave_name = ?
         WHERE dingtalk_userid = ? AND start_at <= ? AND end_at >= ? AND (leave_name = '' OR leave_name = '请假')`,
        [clip(row.leaveName, 64), clip(row.dingtalkUserId, 64), end, start]
      );
    }
    return;
  }
  for (const row of rows) {
    const name = clip(row.leaveName, 64);
    const userId = clip(row.dingtalkUserId, 64);
    for (const item of memory.leaves) {
      if (item.dingtalkUserId !== userId) continue;
      if (String(item.startAt || "") > end || String(item.endAt || "") < start) continue;
      if (item.leaveName && item.leaveName !== "请假") continue;
      item.leaveName = name;
    }
  }
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

export const HR_API_CAP = 10000;
export const HR_API_STOP = 9000;
const HR_API_BASELINE = { "2026-11": 7507 };
let apiCallChain = Promise.resolve();

export function hrUsageMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    hourCycle: "h23"
  }).formatToParts(now);
  const pick = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${pick("year")}-${pick("month")}`;
}

function usageView(row) {
  const baseline = Number(row.baseline) || 0;
  const calls = Number(row.calls) || 0;
  return {
    month: row.month,
    baseline,
    calls,
    total: baseline + calls,
    cap: HR_API_CAP,
    stopAt: HR_API_STOP
  };
}

async function loadUsage(month) {
  await ensureHrSchema();
  if (dbMode() === "mysql") {
    const rows = await rowsOf(
      "SELECT usage_month, baseline_calls, made_calls FROM hr_api_usage WHERE usage_month = ?",
      [month]
    );
    if (!rows.length) {
      const baseline = HR_API_BASELINE[month] || 0;
      if (baseline) {
        await query(
          "INSERT INTO hr_api_usage (usage_month, baseline_calls, made_calls, updated_at) VALUES (?, ?, 0, ?)",
          [month, baseline, new Date().toISOString()]
        );
      }
      return { month, baseline, calls: 0 };
    }
    return {
      month,
      baseline: Number(rows[0].baseline_calls) || 0,
      calls: Number(rows[0].made_calls) || 0
    };
  }
  let row = memory.usage.find((item) => item.month === month);
  if (!row) {
    row = { month, baseline: HR_API_BASELINE[month] || 0, calls: 0 };
    memory.usage.push(row);
  }
  return row;
}

export async function readApiUsage(now = new Date()) {
  const month = hrUsageMonth(now);
  const current = usageView(await loadUsage(month));
  let months = [];
  if (dbMode() === "mysql") {
    const rows = await rowsOf("SELECT usage_month, baseline_calls, made_calls FROM hr_api_usage ORDER BY usage_month");
    months = rows.map((row) => usageView({
      month: row.usage_month,
      baseline: Number(row.baseline_calls) || 0,
      calls: Number(row.made_calls) || 0
    }));
  } else {
    months = memory.usage.map((row) => usageView(row)).sort((a, b) => a.month.localeCompare(b.month));
  }
  if (!months.some((row) => row.month === month)) months.push(current);
  return { cap: HR_API_CAP, stopAt: HR_API_STOP, month, total: current.total, months };
}

export async function addApiCalls(count, now = new Date()) {
  const amount = Math.max(0, Math.floor(Number(count) || 0));
  const month = hrUsageMonth(now);
  if (!amount) return readApiUsage(now);
  const row = await loadUsage(month);
  row.calls += amount;
  if (dbMode() === "mysql") {
    await query(
      `INSERT INTO hr_api_usage (usage_month, baseline_calls, made_calls, updated_at) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE made_calls = made_calls + ?, updated_at = VALUES(updated_at)`,
      [month, row.baseline, amount, new Date().toISOString(), amount]
    );
  }
  return readApiUsage(now);
}

async function reserveApiCallBody(now = new Date()) {
  const row = await loadUsage(hrUsageMonth(now));
  if (row.baseline + row.calls >= HR_API_STOP) {
    const err = new Error("本月钉钉调用已到上限，先停下来");
    err.statusCode = 429;
    err.capped = true;
    throw err;
  }
  await addApiCalls(1, now);
}

export function reserveApiCall(now = new Date()) {
  const run = apiCallChain.then(() => reserveApiCallBody(now));
  apiCallChain = run.then(() => {}, () => {});
  return run;
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
    planAt: row.plan_at || "",
    lateMinutes: Number(row.late_minutes) || 0,
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
    dingtalkUserId: row.dingtalk_userid || "",
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

function mapRecruit(row) {
  return {
    id: Number(row.id),
    name: row.person_name,
    gender: row.gender || "",
    position: row.position_name || "",
    expectedJoin: row.expected_join || "",
    phone: row.phone || "",
    hometown: row.hometown || "",
    channel: row.channel_name || "",
    inviter: row.inviter || "",
    note: row.note_text || "",
    detail: row.detail_text || "",
    recordDate: row.record_date || "",
    joined: Boolean(Number(row.joined_flag) || row.joined),
    staffId: Number(row.staff_id || row.staffId) || 0,
    createdBy: row.created_by || ""
  };
}

export async function listRecruits({ date = "", month = "" } = {}) {
  await ensureHrSchema();
  const day = date ? mustDate(date, "日期") : "";
  const picked = !day && month ? mustMonth(month) : "";
  if (dbMode() === "mysql") {
    const where = [];
    const params = [];
    if (day) {
      where.push("record_date = ?");
      params.push(day);
    } else if (picked) {
      where.push("record_date LIKE ?");
      params.push(`${picked}%`);
    }
    const rows = await rowsOf(
      `SELECT * FROM hr_recruits ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY id DESC`,
      params
    );
    return rows.map(mapRecruit);
  }
  return memory.recruits
    .filter((row) => (day ? row.recordDate === day : !picked || String(row.recordDate || "").slice(0, 7) === picked))
    .map((row) => ({ ...row }))
    .sort((a, b) => b.id - a.id);
}

export async function createRecruit(input = {}, actor = "") {
  await ensureHrSchema();
  const row = {
    name: mustName(input.name, "姓名"),
    gender: optionalGender(input.gender),
    position: clip(input.position, 64),
    expectedJoin: optionalDate(input.expectedJoin, "预计入职时间"),
    phone: optionalPhone(input.phone),
    hometown: clip(input.hometown, 64),
    channel: clip(input.channel, 64),
    inviter: clip(input.inviter, 64),
    note: clip(input.note, 500),
    detail: clip(input.detail, 1000),
    recordDate: mustDate(input.recordDate, "日期"),
    joined: false,
    staffId: 0,
    ...stamp(actor)
  };
  if (dbMode() === "mysql") {
    const [result] = await query(
      `INSERT INTO hr_recruits
        (person_name, gender, position_name, expected_join, phone, hometown, channel_name, inviter, note_text, detail_text, record_date, joined_flag, staff_id, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`,
      [row.name, row.gender, row.position, row.expectedJoin, row.phone, row.hometown, row.channel, row.inviter, row.note, row.detail, row.recordDate, row.createdBy, row.createdAt]
    );
    row.id = Number(result.insertId);
    return row;
  }
  row.id = seq++;
  memory.recruits.push(row);
  return { ...row };
}

export async function deleteRecruit(id) {
  return removeRow("hr_recruits", memory.recruits, id, (next) => {
    memory.recruits = next;
  });
}

export async function registerRecruitJoin(id, actor = "") {
  await ensureHrSchema();
  const key = Number(id);
  const current = (await listRecruits()).find((row) => row.id === key);
  if (!current) throw bad("记录不存在", 404);
  if (current.joined && current.staffId) return { recruit: current, already: true };
  const note = [current.note, current.detail, current.channel && `渠道 ${current.channel}`, current.inviter && `邀约人 ${current.inviter}`]
    .filter(Boolean)
    .join("；");
  const staff = await createStaff({
    name: current.name,
    gender: current.gender,
    position: current.position,
    phone: current.phone,
    hometown: current.hometown,
    joinedOn: current.expectedJoin || current.recordDate,
    status: "在职",
    note
  }, actor);
  if (dbMode() === "mysql") {
    await query("UPDATE hr_recruits SET joined_flag = 1, staff_id = ? WHERE id = ?", [staff.id, key]);
  } else {
    const stored = memory.recruits.find((row) => row.id === key);
    if (stored) {
      stored.joined = true;
      stored.staffId = staff.id;
    }
  }
  return { recruit: { ...current, joined: true, staffId: staff.id }, staff, already: false };
}

function mapOnboard(row) {
  return {
    id: Number(row.id),
    name: row.person_name,
    gender: row.gender || "",
    department: row.department_name || "",
    position: row.position_name || "",
    joinedOn: row.joined_on || "",
    phone: row.phone || "",
    hometown: row.hometown || "",
    channel: row.channel_name || "",
    inviter: row.inviter || "",
    note: row.note_text || "",
    detail: row.detail_text || "",
    createdBy: row.created_by || ""
  };
}

export async function listOnboards() {
  await ensureHrSchema();
  if (dbMode() === "mysql") {
    const rows = await rowsOf("SELECT * FROM hr_onboards ORDER BY joined_on DESC, id DESC");
    return rows.map(mapOnboard);
  }
  return memory.onboards.map((row) => ({ ...row })).sort((a, b) => String(b.joinedOn).localeCompare(String(a.joinedOn)) || b.id - a.id);
}

export async function createOnboard(input = {}, actor = "") {
  await ensureHrSchema();
  const row = {
    name: mustName(input.name, "姓名"),
    gender: optionalGender(input.gender),
    department: clip(input.department, 64),
    position: clip(input.position, 64),
    joinedOn: optionalDate(input.joinedOn, "入职日期"),
    phone: optionalPhone(input.phone),
    hometown: clip(input.hometown, 64),
    channel: clip(input.channel, 64),
    inviter: clip(input.inviter, 64),
    note: clip(input.note, 500),
    detail: clip(input.detail, 1000),
    ...stamp(actor)
  };
  if (dbMode() === "mysql") {
    const [result] = await query(
      `INSERT INTO hr_onboards
        (person_name, gender, department_name, position_name, joined_on, phone, hometown, channel_name, inviter, note_text, detail_text, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.name, row.gender, row.department, row.position, row.joinedOn, row.phone, row.hometown, row.channel, row.inviter, row.note, row.detail, row.createdBy, row.createdAt]
    );
    row.id = Number(result.insertId);
    return row;
  }
  row.id = seq++;
  memory.onboards.push(row);
  return { ...row };
}

export async function deleteOnboard(id) {
  return removeRow("hr_onboards", memory.onboards, id, (next) => {
    memory.onboards = next;
  });
}

function mapStaff(row) {
  return {
    id: Number(row.id),
    name: row.person_name,
    gender: row.gender || "",
    jobNumber: row.job_number || "",
    department: row.department_name || "",
    position: row.position_name || "",
    phone: row.phone || "",
    joinedOn: row.joined_on || "",
    birthday: row.birthday || "",
    leftOn: row.left_on || "",
    status: row.status_name || "在职",
    hometown: row.hometown || "",
    education: row.education || "",
    emergencyName: row.emergency_name || "",
    emergencyPhone: row.emergency_phone || "",
    note: row.note_text || "",
    dingtalkUserId: row.dingtalk_userid || "",
    createdBy: row.created_by || ""
  };
}

function filled(input, key) {
  return input && input[key] != null && String(input[key]).trim() !== "";
}

function staffFrom(input, { requireName = true } = {}) {
  const statusText = clip(input.status, 16);
  let status = statusText ? mustChoice(statusText, STAFF_STATUSES, "状态") : "";
  const leftOn = optionalDate(input.leftOn, "离职日期");
  if (!status) status = leftOn ? "离职" : "在职";
  return {
    name: requireName ? mustName(input.name, "姓名") : clip(input.name, 64),
    gender: optionalGender(input.gender),
    jobNumber: clip(input.jobNumber, 64),
    department: clip(input.department, 64),
    position: clip(input.position, 64),
    phone: optionalPhone(input.phone),
    joinedOn: optionalDate(input.joinedOn, "入职日期"),
    birthday: optionalDate(input.birthday, "生日"),
    leftOn,
    status,
    hometown: clip(input.hometown, 64),
    education: clip(input.education, 32),
    emergencyName: clip(input.emergencyName, 64),
    emergencyPhone: optionalPhone(input.emergencyPhone),
    note: clip(input.note, 500),
    dingtalkUserId: clip(input.dingtalkUserId, 64)
  };
}

function staffPatch(input) {
  const patch = {};
  if (filled(input, "name")) patch.name = mustName(input.name, "姓名");
  if (filled(input, "gender")) patch.gender = optionalGender(input.gender);
  if (filled(input, "jobNumber")) patch.jobNumber = clip(input.jobNumber, 64);
  if (filled(input, "department")) patch.department = clip(input.department, 64);
  if (filled(input, "position")) patch.position = clip(input.position, 64);
  if (filled(input, "phone")) patch.phone = optionalPhone(input.phone);
  if (filled(input, "joinedOn")) patch.joinedOn = optionalDate(input.joinedOn, "入职日期");
  if (filled(input, "birthday")) patch.birthday = optionalDate(input.birthday, "生日");
  if (filled(input, "leftOn")) patch.leftOn = optionalDate(input.leftOn, "离职日期");
  if (filled(input, "status")) patch.status = mustChoice(input.status, STAFF_STATUSES, "状态");
  else if (patch.leftOn) patch.status = "离职";
  if (filled(input, "hometown")) patch.hometown = clip(input.hometown, 64);
  if (filled(input, "education")) patch.education = clip(input.education, 32);
  if (filled(input, "emergencyName")) patch.emergencyName = clip(input.emergencyName, 64);
  if (filled(input, "emergencyPhone")) patch.emergencyPhone = optionalPhone(input.emergencyPhone);
  if (filled(input, "note")) patch.note = clip(input.note, 500);
  if (filled(input, "dingtalkUserId")) patch.dingtalkUserId = clip(input.dingtalkUserId, 64);
  return patch;
}

async function readStaffRows() {
  await ensureHrSchema();
  if (dbMode() === "mysql") {
    const rows = await rowsOf("SELECT * FROM hr_staff ORDER BY id DESC");
    return rows.map(mapStaff);
  }
  return memory.staff.map((row) => ({ ...row }));
}

function sortStaff(rows) {
  return rows
    .slice()
    .sort((a, b) => (a.status === "在职" ? 0 : 1) - (b.status === "在职" ? 0 : 1) || String(a.department).localeCompare(String(b.department), "zh") || String(a.name).localeCompare(String(b.name), "zh"));
}

export async function listStaff({ status = "" } = {}) {
  const picked = clip(status, 16);
  if (picked && !STAFF_STATUSES.includes(picked)) throw bad("状态不正确");
  const rows = await readStaffRows();
  return sortStaff(picked ? rows.filter((row) => row.status === picked) : rows);
}

async function writeStaff(row) {
  if (dbMode() === "mysql") {
    const [result] = await query(
      `INSERT INTO hr_staff
        (person_name, gender, job_number, department_name, position_name, phone, joined_on, birthday, left_on, status_name, hometown, education, emergency_name, emergency_phone, note_text, dingtalk_userid, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.name, row.gender, row.jobNumber, row.department, row.position, row.phone, row.joinedOn, row.birthday || "", row.leftOn, row.status, row.hometown, row.education, row.emergencyName, row.emergencyPhone, row.note, row.dingtalkUserId, row.createdBy, row.createdAt, row.updatedAt]
    );
    row.id = Number(result.insertId);
    return row;
  }
  row.id = seq++;
  memory.staff.push(row);
  return { ...row };
}

async function saveStaffRow(row) {
  row.updatedAt = new Date().toISOString();
  if (dbMode() === "mysql") {
    const [result] = await query(
      `UPDATE hr_staff SET
        person_name = ?, gender = ?, job_number = ?, department_name = ?, position_name = ?, phone = ?,
        joined_on = ?, birthday = ?, left_on = ?, status_name = ?, hometown = ?, education = ?, emergency_name = ?,
        emergency_phone = ?, note_text = ?, dingtalk_userid = ?, updated_at = ?
       WHERE id = ?`,
      [row.name, row.gender, row.jobNumber, row.department, row.position, row.phone, row.joinedOn, row.birthday || "", row.leftOn, row.status, row.hometown, row.education, row.emergencyName, row.emergencyPhone, row.note, row.dingtalkUserId, row.updatedAt, row.id]
    );
    if (!result.affectedRows) throw bad("记录不存在", 404);
    return row;
  }
  const index = memory.staff.findIndex((item) => item.id === row.id);
  if (index < 0) throw bad("记录不存在", 404);
  memory.staff[index] = row;
  return { ...row };
}

export async function createStaff(input = {}, actor = "") {
  const row = { ...staffFrom(input), ...stamp(actor), updatedAt: new Date().toISOString() };
  return writeStaff(row);
}

export async function updateStaff(id, input = {}, _actor = "", { replace = false } = {}) {
  const key = Number(id);
  const rows = await readStaffRows();
  const current = rows.find((row) => row.id === key);
  if (!current) throw bad("记录不存在", 404);
  const next = replace ? { ...current, ...staffFrom(input), id: current.id, createdBy: current.createdBy, createdAt: current.createdAt } : { ...current, ...staffPatch(input) };
  // Explicit clearing is separate from import's merge-only blank values.
  if (!replace && Array.isArray(input.clearFields)) {
    const clearable = ["jobNumber", "department", "position", "joinedOn", "leftOn"];
    for (const field of input.clearFields) {
      if (clearable.includes(field)) next[field] = "";
    }
  }
  if (next.status === "在职" && replace && !clip(input.leftOn, 10)) next.leftOn = "";
  return saveStaffRow(next);
}

function matchStaff(rows, input) {
  const ding = clip(input.dingtalkUserId, 64);
  const job = clip(input.jobNumber, 64);
  const name = clip(input.name, 64);
  const department = clip(input.department, 64);
  if (ding) {
    const hit = rows.find((row) => row.dingtalkUserId === ding);
    if (hit) return hit;
  }
  if (job) {
    const hit = rows.find((row) => row.jobNumber === job);
    if (hit) return hit;
  }
  if (name) {
    return rows.find((row) => row.name === name && row.department === department) || null;
  }
  return null;
}

export async function importStaff(rows = [], actor = "") {
  if (!Array.isArray(rows) || !rows.length) throw bad("没有可导入的行");
  if (rows.length > 400) throw bad("一次最多导入 400 人");
  const existing = await readStaffRows();
  let added = 0;
  let updated = 0;
  for (const input of rows) {
    if (!clip(input && input.name, 64)) continue;
    const hit = matchStaff(existing, input);
    if (hit) {
      const saved = await updateStaff(hit.id, input, actor, { replace: false });
      Object.assign(hit, saved);
      updated += 1;
    } else {
      const saved = await createStaff(input, actor);
      existing.push(saved);
      added += 1;
    }
  }
  if (!added && !updated) throw bad("没有可导入的行");
  return { added, updated };
}

async function opsPunchPeople() {
  await ensureHrSchema();
  if (dbMode() === "mysql") {
    const rows = await rowsOf(
      `SELECT dingtalk_userid, MAX(user_name) AS user_name, MAX(job_number) AS job_number, MAX(department) AS department
       FROM hr_punches
       WHERE department LIKE '%运营%' AND dingtalk_userid <> ''
       GROUP BY dingtalk_userid`
    );
    return rows.map((row) => ({
      dingtalkUserId: row.dingtalk_userid,
      name: row.user_name || "",
      jobNumber: row.job_number || "",
      department: row.department || ""
    }));
  }
  const seen = new Map();
  for (const row of memory.punches) {
    if (!String(row.department || "").includes("运营") || !row.dingtalkUserId) continue;
    seen.set(row.dingtalkUserId, {
      dingtalkUserId: row.dingtalkUserId,
      name: row.userName || "",
      jobNumber: row.jobNumber || "",
      department: row.department || ""
    });
  }
  return [...seen.values()];
}

export async function deleteStaff(id) {
  return removeRow("hr_staff", memory.staff, id, (next) => {
    memory.staff = next;
  });
}

export async function syncStaffFromPunches(actor = "") {
  const people = await opsPunchPeople();
  const existing = await readStaffRows();
  let added = 0;
  for (const person of people) {
    if (!person.name || matchStaff(existing, person)) continue;
    const saved = await createStaff({ ...person, status: "在职" }, actor);
    existing.push(saved);
    added += 1;
  }
  return { added };
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

function shiftDate(ymd, days) {
  const [year, month, day] = String(ymd).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function eachDay(start, end) {
  const days = [];
  let cursor = start;
  while (cursor && cursor <= end && days.length < 400) {
    days.push(cursor);
    cursor = shiftDate(cursor, 1);
  }
  return days;
}

function round1(value) {
  return Math.round(Number(value) * 10) / 10;
}

function changePercent(current, previous) {
  if (!previous) return current ? 100 : 0;
  return round1(((current - previous) / previous) * 100);
}

function homeToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23"
  }).formatToParts(now);
  const bag = {};
  for (const part of parts) bag[part.type] = part.value;
  return { today: `${bag.year}-${bag.month}-${bag.day}`, hour: Number(bag.hour) };
}

function rangeWindow(key, today) {
  if (key === "7") return { key: "7", start: shiftDate(today, -6), end: today };
  if (key === "month") return { key: "month", start: `${today.slice(0, 7)}-01`, end: today };
  if (key === "year") return { key: "year", start: `${today.slice(0, 4)}-01-01`, end: today };
  return { key: "30", start: shiftDate(today, -29), end: today };
}

function activeOn(person, date) {
  if (!person) return false;
  if (person.leftOn && person.leftOn <= date) return false;
  if (person.status === "离职") return false;
  if (person.joinedOn && person.joinedOn > date) return false;
  return true;
}

function monthOf(date) {
  return String(date || "").slice(0, 7);
}

function countWhere(rows, pred) {
  return rows.reduce((sum, row) => sum + (pred(row) ? 1 : 0), 0);
}

function punchKey(row) {
  return row.dingtalkUserId || row.userName || row.jobNumber || "";
}

function punchPeople(punches, date) {
  return new Set(punches.filter((row) => row.workDate === date && punchKey(row)).map(punchKey)).size;
}

function birthdayParts(person) {
  const match = String(person.birthday || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return { year: Number(match[1]), month: match[2], day: match[3] };
}

function ageOn(parts, today) {
  if (!parts?.year) return null;
  let age = Number(today.slice(0, 4)) - parts.year;
  if (today.slice(5) < `${parts.month}-${parts.day}`) age -= 1;
  return age;
}

function monthsBetween(start, end) {
  const [y1, m1, d1] = start.split("-").map(Number);
  const [y2, m2, d2] = end.split("-").map(Number);
  let months = (y2 - y1) * 12 + (m2 - m1);
  if (d2 < d1) months -= 1;
  return months;
}

function bandShare(rows, bands) {
  const total = rows.length || 1;
  return bands.map((band) => {
    const count = rows.filter((row) => band.test(row)).length;
    return { label: band.label, count, ratio: round1((count / total) * 100) };
  });
}

export function buildHrHome({
  staff = [],
  punches = [],
  recruits = [],
  interviews = [],
  effort = null,
  today,
  hour = 9,
  viewer = "",
  range = "30"
} = {}) {
  const people = Array.isArray(staff) ? staff : [];
  const window = rangeWindow(range, today);
  const month = monthOf(today);
  const previous = shiftDate(`${month}-01`, -1).slice(0, 7);
  const activeNow = countWhere(people, (row) => activeOn(row, today));
  const activePrev = countWhere(people, (row) => activeOn(row, shiftDate(`${month}-01`, -1)));
  const hiredNow = countWhere(people, (row) => monthOf(row.joinedOn) === month);
  const hiredPrev = countWhere(people, (row) => monthOf(row.joinedOn) === previous);
  const leftNow = countWhere(people, (row) => monthOf(row.leftOn) === month);
  const leftPrev = countWhere(people, (row) => monthOf(row.leftOn) === previous);
  const baseNow = countWhere(people, (row) => activeOn(row, shiftDate(`${month}-01`, -1)));
  const basePrev = countWhere(people, (row) => activeOn(row, shiftDate(`${previous}-01`, -1)));
  const rateNow = baseNow ? round1((leftNow / baseNow) * 100) : 0;
  const ratePrev = basePrev ? round1((leftPrev / basePrev) * 100) : 0;
  const sparkDays = eachDay(shiftDate(today, -6), today);
  const birthdays = people
    .filter((row) => activeOn(row, today))
    .map((row) => ({ row, parts: birthdayParts(row) }))
    .filter((item) => item.parts && item.parts.month === today.slice(5, 7))
    .sort((a, b) => a.parts.day.localeCompare(b.parts.day) || String(a.row.name).localeCompare(String(b.row.name), "zh"));
  const upcoming = birthdays.find((item) => item.parts.day >= today.slice(8)) || null;
  const activePeople = people.filter((row) => activeOn(row, today));
  const deptMap = new Map();
  for (const row of activePeople) {
    const name = row.department || "未分部门";
    deptMap.set(name, (deptMap.get(name) || 0) + 1);
  }
  const deptRows = [...deptMap.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh"));
  const head = deptRows.slice(0, 6);
  const rest = deptRows.slice(6).reduce((sum, row) => sum + row.count, 0);
  const departments = rest ? head.concat([{ name: "其他", count: rest }]) : head;
  const deptTotal = activeNow || 1;
  const days = eachDay(window.start, window.end);
  const base = countWhere(people, (row) => activeOn(row, shiftDate(window.start, -1)));
  let leftSoFar = 0;
  const series = days.map((date) => {
    const left = countWhere(people, (row) => row.leftOn === date);
    leftSoFar += left;
    return {
      date,
      active: countWhere(people, (row) => activeOn(row, date)),
      hired: countWhere(people, (row) => row.joinedOn === date),
      left,
      rate: base ? round1((leftSoFar / base) * 100) : 0
    };
  });
  const lateNames = [...new Set(punches.filter((row) => row.workDate === today && (Number(row.lateMinutes) > 0 || /迟到/.test(`${row.label || ""}${row.timeResult || ""}`))).map((row) => row.userName || "未命名"))];
  const probation = activePeople.filter((row) => row.joinedOn && shiftDate(row.joinedOn, 90) >= today && shiftDate(row.joinedOn, 90) <= shiftDate(today, 7));
  const pendingJoin = recruits.filter((row) => !row.joined && row.expectedJoin && row.expectedJoin >= today && row.expectedJoin <= shiftDate(today, 7));
  const todos = [];
  if (probation.length) todos.push({ kind: "probation", title: `${probation.length} 名员工试用期即将结束`, when: "7天内", names: probation.map((row) => row.name) });
  if (lateNames.length) todos.push({ kind: "late", title: `${lateNames.length} 条考勤异常待处理`, when: "今天", names: lateNames });
  if (pendingJoin.length) todos.push({ kind: "recruit", title: `${pendingJoin.length} 个入职流程待审批`, when: "7天内", names: pendingJoin.map((row) => row.name) });
  const effortTeams = Array.isArray(effort?.teams) ? effort.teams : [];
  const teams = effortTeams.length
    ? effortTeams.slice().sort((a, b) => Number(b.average) - Number(a.average)).slice(0, 5).map((team) => ({ name: team.name, value: Number(team.average) || 0, unit: "小时" }))
    : deptRows.slice(0, 5).map((row) => ({ name: row.name, value: row.count, unit: "人" }));
  const ages = activePeople.map((row) => ageOn(birthdayParts(row), today)).filter((age) => age != null && age >= 0 && age < 100);
  const ageBands = [
    { label: "<24岁", test: (age) => age <= 24 },
    { label: "25–29岁", test: (age) => age >= 25 && age <= 29 },
    { label: "30–34岁", test: (age) => age >= 30 && age <= 34 },
    { label: "35–39岁", test: (age) => age >= 35 && age <= 39 },
    { label: "≥40岁", test: (age) => age >= 40 }
  ];
  const tenureBands = [
    { label: "<6个月", test: (months) => months < 6 },
    { label: "6个月–1年", test: (months) => months >= 6 && months < 12 },
    { label: "1–3年", test: (months) => months >= 12 && months < 36 },
    { label: "3–5年", test: (months) => months >= 36 && months < 60 },
    { label: ">5年", test: (months) => months >= 60 }
  ];
  const tenures = activePeople.map((row) => (row.joinedOn ? monthsBetween(row.joinedOn, today) : null)).filter((months) => months != null && months >= 0);
  const movement = (dateKey) => people
    .filter((row) => row[dateKey] && row[dateKey] >= window.start && row[dateKey] <= window.end)
    .map((row) => ({
      name: row.name || "未命名",
      department: row.department || "",
      position: row.position || "",
      date: row[dateKey],
      probation: row.joinedOn && shiftDate(row.joinedOn, 90) >= today ? "3个月" : "已过",
      status: dateKey === "leftOn" || row.status === "离职" ? "已离职" : (row.joinedOn && shiftDate(row.joinedOn, 90) >= today ? "试用中" : "已转正")
    }))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(a.name).localeCompare(String(b.name), "zh"));
  const monthRecruits = recruits.filter((row) => monthOf(row.recordDate || row.expectedJoin) === month);
  const monthInterviews = interviews.filter((row) => monthOf(row.interviewAt) === month);
  const hiredRecruit = monthRecruits.filter((row) => row.joined).length;
  return {
    hello: hour < 12 ? "上午好" : hour < 18 ? "下午好" : "晚上好",
    viewer: clip(viewer, 64),
    range: window,
    kpis: {
      active: { value: activeNow, delta: activeNow - activePrev, percent: changePercent(activeNow, activePrev), spark: sparkDays.map((date) => countWhere(people, (row) => activeOn(row, date))) },
      hired: { value: hiredNow, delta: hiredNow - hiredPrev, percent: changePercent(hiredNow, hiredPrev), spark: sparkDays.map((date) => countWhere(people, (row) => row.joinedOn === date)) },
      left: { value: leftNow, rate: rateNow, rateDelta: round1(rateNow - ratePrev), spark: sparkDays.map((date) => countWhere(people, (row) => row.leftOn === date)) },
      lunch: { value: punchPeople(punches, today), delta: punchPeople(punches, today) - punchPeople(punches, shiftDate(today, -1)), spark: sparkDays.map((date) => punchPeople(punches, date)) },
      birthday: {
        value: birthdays.length,
        next: upcoming ? { name: upcoming.row.name, date: `${upcoming.parts.month}-${upcoming.parts.day}` } : null,
        spark: sparkDays.map((date) => birthdays.filter((item) => item.parts.day === date.slice(8)).length)
      }
    },
    series,
    departments: departments.map((row) => ({ ...row, ratio: round1((row.count / deptTotal) * 100) })),
    todos,
    teams,
    teamMetric: effortTeams.length ? "人均奋斗时长" : "在职人数",
    gender: {
      male: countWhere(activePeople, (row) => row.gender === "男"),
      female: countWhere(activePeople, (row) => row.gender === "女")
    },
    ageReady: ages.length > 0,
    ages: bandShare(ages, ageBands),
    tenureReady: tenures.length > 0,
    tenures: bandShare(tenures, tenureBands),
    hiredRows: movement("joinedOn"),
    leftRows: movement("leftOn"),
    recruit: {
      registered: monthRecruits.length,
      done: hiredRecruit,
      rate: monthRecruits.length ? round1((hiredRecruit / monthRecruits.length) * 100) : 0,
      steps: [
        { label: "简历筛选", count: monthRecruits.length },
        { label: "初试", count: monthInterviews.length },
        { label: "复试", count: monthInterviews.filter((row) => row.result === "通过").length },
        { label: "录用", count: hiredRecruit }
      ]
    }
  };
}

export async function readHrHome({ range = "30", today, hour, viewer = "" } = {}) {
  const clock = homeToday();
  const day = today || clock.today;
  const [staff, punches, recruits, interviews, effort] = await Promise.all([
    listStaff(),
    listPunches({ from: shiftDate(day, -6), to: day }),
    listRecruits({ month: day.slice(0, 7) }),
    listInterviews(),
    readEffortMonth(day.slice(0, 7)).catch(() => null)
  ]);
  return buildHrHome({
    staff,
    punches,
    recruits,
    interviews,
    effort: effort?.report || null,
    today: day,
    hour: hour == null ? clock.hour : hour,
    viewer,
    range
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
