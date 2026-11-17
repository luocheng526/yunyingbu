/* 工作汇报的钉钉排班、请假和工作通知。密钥只读环境变量。 */
import { dbMode, query } from "../profile/auth.js";

const WORK_URL = "https://zx.xingmaierp.cc/work";

export function workLink(tab, taskId) {
  const url = new URL(WORK_URL);
  if (tab) {
    url.searchParams.set("tab", tab);
  }
  if (taskId) {
    url.searchParams.set("task", String(taskId));
  }
  return url.toString();
}
const sentKeys = new Set();
const binds = new Map();
let attendanceCache = new Map();
let tokenCache = { value: "", until: 0 };
let rememberedAgent = "";
let rememberedAuth = { clientId: "", clientSecret: "" };
let transport = globalThis.fetch;

export function setDingTransport(fn) {
  transport = fn || globalThis.fetch;
  tokenCache = { value: "", until: 0 };
}

export function resetDingStore() {
  sentKeys.clear();
  binds.clear();
  attendanceCache = new Map();
  tokenCache = { value: "", until: 0 };
  rememberedAgent = "";
  rememberedAuth = { clientId: "", clientSecret: "" };
}

export function dingConfig() {
  return {
    corpId: String(process.env.DINGTALK_CORP_ID || "").trim(),
    clientId: rememberedAuth.clientId || String(process.env.DINGTALK_CLIENT_ID || "").trim(),
    clientSecret: rememberedAuth.clientSecret || String(process.env.DINGTALK_CLIENT_SECRET || "").trim(),
    agentId: String(process.env.DINGTALK_AGENT_ID || "").trim()
  };
}

export function dingPublic() {
  const cfg = dingConfig();
  return {
    app: Boolean(cfg.clientId && cfg.clientSecret),
    agent: Boolean(cfg.agentId || rememberedAgent),
    corp: Boolean(cfg.corpId)
  };
}

export function classifySchedule(rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) {
    return "none";
  }
  const working = list.some((row) => String(row.is_rest || row.isRest || "N").toUpperCase() !== "Y");
  return working ? "work" : "rest";
}

export function shiftWindow(rows) {
  const times = (Array.isArray(rows) ? rows : [])
    .filter((row) => String(row.is_rest || row.isRest || "N").toUpperCase() !== "Y")
    .map((row) => Date.parse(String(row.plan_check_time || row.planCheckTime || "").replace(" ", "T") + "+08:00"))
    .filter((value) => Number.isFinite(value));
  if (times.length < 2) {
    return null;
  }
  return { start: Math.min(...times), end: Math.max(...times) };
}

export function classifyLeave(records, shift) {
  let full = false;
  let half = false;
  for (const row of Array.isArray(records) ? records : []) {
    const percent = Number(row.duration_percent ?? row.durationPercent);
    const start = Number(row.start_time ?? row.startTime);
    const end = Number(row.end_time ?? row.endTime);
    if (shift && start && end) {
      if (start <= shift.start && end >= shift.end) {
        full = true;
      } else if (end > shift.start && start < shift.end) {
        half = true;
      }
    } else if (percent >= 100) {
      full = true;
    } else if (percent > 0) {
      half = true;
    }
  }
  if (full) {
    return "full";
  }
  if (half) {
    return "half";
  }
  return "none";
}

export function proposeBinds(people, users) {
  const byJob = new Map();
  const byName = new Map();
  const siteNames = new Map();
  for (const person of people || []) {
    const name = String(person.name || "").trim();
    if (name) {
      siteNames.set(name, (siteNames.get(name) || 0) + 1);
    }
  }
  for (const user of users || []) {
    const job = String(user.jobNumber || user.job_number || "").trim();
    const name = String(user.name || "").trim();
    if (job) {
      const list = byJob.get(job) || [];
      list.push(user);
      byJob.set(job, list);
    }
    if (name) {
      const list = byName.get(name) || [];
      list.push(user);
      byName.set(name, list);
    }
  }
  return (people || []).map((person) => {
    const jobHits = person.employeeNo ? byJob.get(String(person.employeeNo).trim()) || [] : [];
    const nameHits = byName.get(String(person.name || "").trim()) || [];
    if (jobHits.length === 1) {
      return { personId: Number(person.id), userid: jobHits[0].userid, match: "工号", confirmed: true, candidates: [] };
    }
    if (jobHits.length > 1) {
      return { personId: Number(person.id), userid: "", match: "工号重复", confirmed: false, candidates: publicUsers(jobHits) };
    }
    if (nameHits.length > 1) {
      return { personId: Number(person.id), userid: "", match: "重名待核对", confirmed: false, candidates: publicUsers(nameHits) };
    }
    const name = String(person.name || "").trim();
    if (nameHits.length === 1 && siteNames.get(name) === 1 && !jobHits.length) {
      return { personId: Number(person.id), userid: nameHits[0].userid, match: "姓名", confirmed: true, candidates: [] };
    }
    if (nameHits.length === 1) {
      return { personId: Number(person.id), userid: "", match: "姓名待核对", confirmed: false, candidates: publicUsers(nameHits) };
    }
    return { personId: Number(person.id), userid: "", match: "未找到", confirmed: false, candidates: [] };
  });
}

function publicUsers(users) {
  return users.map((user) => ({
    userid: String(user.userid || ""),
    name: String(user.name || ""),
    jobNumber: String(user.jobNumber || user.job_number || "")
  }));
}

function dayStart(date) {
  return Date.parse(`${date}T00:00:00+08:00`);
}

async function accessToken() {
  const cfg = dingConfig();
  if (!cfg.clientId || !cfg.clientSecret) {
    const error = new Error("钉钉企业应用未配置");
    error.publicMessage = error.message;
    throw error;
  }
  if (!tokenCache.value || Date.now() >= tokenCache.until) {
    const res = await transport("https://api.dingtalk.com/v1.0/oauth2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appKey: cfg.clientId, appSecret: cfg.clientSecret }),
      signal: AbortSignal.timeout(5000)
    });
    const data = await res.json();
    if (!data.accessToken) {
      const error = new Error("钉钉接口失败");
      error.publicMessage = "应用凭证没有通过";
      throw error;
    }
    tokenCache = {
      value: data.accessToken,
      until: Date.now() + Math.max(60, Number(data.expireIn) || 7200 - 120) * 1000
    };
  }
  return tokenCache.value;
}

async function oapi(path, body) {
  const token = await accessToken();
  const res = await transport(`https://oapi.dingtalk.com${path}?access_token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
    signal: AbortSignal.timeout(8000)
  });
  const data = await res.json();
  if (data.errcode) {
    const error = new Error("钉钉接口失败");
    error.publicMessage = error.message;
    error.code = Number(data.errcode);
    throw error;
  }
  return data.result === undefined ? data : data.result;
}

export async function readyDing() {
  if (dbMode() !== "mysql") {
    return;
  }
  await query(
    `CREATE TABLE IF NOT EXISTS work_report_ding_bind (
      person_id INT NOT NULL PRIMARY KEY,
      dingtalk_user_id VARCHAR(64) NOT NULL,
      match_by VARCHAR(16) NOT NULL,
      confirmed TINYINT NOT NULL,
      updated_at VARCHAR(40) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
  await query(
    `CREATE TABLE IF NOT EXISTS work_report_ding_remind (
      person_id INT NOT NULL,
      work_date CHAR(10) NOT NULL,
      sent_at VARCHAR(40) NOT NULL,
      PRIMARY KEY (person_id, work_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
  const [rows] = await query("SELECT person_id, dingtalk_user_id, match_by, confirmed FROM work_report_ding_bind");
  binds.clear();
  for (const row of rows) {
    if (!Number(row.confirmed)) {
      continue;
    }
    binds.set(Number(row.person_id), {
      userid: String(row.dingtalk_user_id || ""),
      match: String(row.match_by || ""),
      confirmed: true
    });
  }
  const [agentRows] = await query("SELECT body FROM work_report_diary_meta WHERE meta_key = 'ding_agent'");
  rememberedAgent = "";
  if (agentRows[0]?.body) {
    try {
      const saved = JSON.parse(agentRows[0].body);
      rememberedAgent = String(saved.agentId || "");
      rememberedAuth = {
        clientId: String(saved.clientId || ""),
        clientSecret: String(saved.clientSecret || "")
      };
    } catch {
      rememberedAgent = "";
      rememberedAuth = { clientId: "", clientSecret: "" };
    }
  }
  const [sent] = await query("SELECT person_id, work_date FROM work_report_ding_remind");
  sentKeys.clear();
  for (const row of sent) {
    sentKeys.add(`${Number(row.person_id)}|${row.work_date}`);
  }
}

export function bindingOf(personId) {
  return binds.get(Number(personId)) || null;
}

export function confirmedBinds() {
  return [...binds.entries()].map(([personId, row]) => ({ personId, ...row }));
}

export async function saveBinds(rows) {
  for (const row of rows || []) {
    const personId = Number(row.personId);
    const userid = String(row.userid || "").trim().slice(0, 64);
    if (!personId) {
      continue;
    }
    if (!userid) {
      binds.delete(personId);
      if (dbMode() === "mysql") {
        await query("DELETE FROM work_report_ding_bind WHERE person_id = ?", [personId]);
      }
      continue;
    }
    const next = { userid, match: row.match || "人工", confirmed: true };
    binds.set(personId, next);
    if (dbMode() === "mysql") {
      await query(
        `INSERT INTO work_report_ding_bind (person_id, dingtalk_user_id, match_by, confirmed, updated_at)
         VALUES (?, ?, ?, 1, ?)
         ON DUPLICATE KEY UPDATE dingtalk_user_id = VALUES(dingtalk_user_id), match_by = VALUES(match_by), confirmed = 1, updated_at = VALUES(updated_at)`,
        [personId, userid, next.match, new Date().toISOString().slice(0, 19).replace("T", " ")]
      );
    }
  }
}

async function listDingUsers() {
  const departments = [1];
  const queue = [1];
  while (queue.length && departments.length < 80) {
    const deptId = queue.shift();
    const result = await oapi("/topapi/v2/department/listsub", { dept_id: deptId });
    const rows = Array.isArray(result) ? result : [];
    for (const row of rows) {
      const id = Number(row.dept_id);
      if (id && !departments.includes(id)) {
        departments.push(id);
        queue.push(id);
      }
    }
  }
  const seen = new Map();
  for (const deptId of departments) {
    let cursor = 0;
    for (let page = 0; page < 20; page += 1) {
      const result = await oapi("/topapi/v2/user/list", { dept_id: deptId, cursor, size: 100 });
      for (const user of result.list || []) {
        if (user.userid) {
          seen.set(String(user.userid), {
            userid: String(user.userid),
            name: String(user.name || ""),
            jobNumber: String(user.job_number || "")
          });
        }
      }
      if (!result.has_more) {
        break;
      }
      cursor = result.next_cursor || 0;
    }
  }
  return [...seen.values()];
}

export async function syncBinds(people) {
  const users = await listDingUsers();
  const proposals = proposeBinds(people, users);
  await saveBinds(proposals.filter((row) => row.confirmed && row.userid));
  return proposals.map((row) => {
    const saved = binds.get(row.personId);
    if (saved && saved.confirmed) {
      return { ...row, userid: saved.userid, match: saved.match, confirmed: true };
    }
    return row;
  });
}

async function schedulesFor(userids, date, operatorId) {
  const grouped = new Map();
  for (let index = 0; index < userids.length; index += 50) {
    const slice = userids.slice(index, index + 50);
    const result = await oapi("/topapi/attendance/schedule/listbyusers", {
      op_user_id: operatorId,
      userids: slice.join(","),
      from_date_time: dayStart(date),
      to_date_time: dayStart(date) + 24 * 3600 * 1000 - 1
    });
    const rows = Array.isArray(result) ? result : result?.schedules || [];
    for (const row of rows) {
      const id = String(row.userid || row.user_id || "");
      const list = grouped.get(id) || [];
      list.push(row);
      grouped.set(id, list);
    }
  }
  return grouped;
}

async function leavesFor(userids, date) {
  const grouped = new Map();
  const start = dayStart(date);
  const end = start + 24 * 3600 * 1000 - 1;
  for (let index = 0; index < userids.length; index += 100) {
    const slice = userids.slice(index, index + 100);
    let offset = 0;
    for (let page = 0; page < 20; page += 1) {
      const result = await oapi("/topapi/attendance/getleavestatus", {
        userid_list: slice.join(","),
        start_time: start,
        end_time: end,
        offset,
        size: 20
      });
      const rows = result.leave_status || result.leave_status_list || [];
      for (const row of rows) {
        const id = String(row.userid || "");
        const list = grouped.get(id) || [];
        list.push(row);
        grouped.set(id, list);
      }
      if (!result.has_more) {
        break;
      }
      offset += rows.length || 20;
    }
  }
  return grouped;
}

export async function loadAttendance({ date, people, useSchedule, useLeave, operatorPersonId, fresh }) {
  const map = new Map();
  if (!useSchedule && !useLeave) {
    return map;
  }
  const key = `${date}|${useSchedule ? 1 : 0}|${useLeave ? 1 : 0}`;
  const cached = attendanceCache.get(key);
  if (!fresh && cached && Date.now() - cached.at < 60000) {
    return cached.map;
  }
  const wanted = (people || []).filter((person) => person.status !== "离职");
  if (!dingPublic().app) {
    return map;
  }
  const bound = [];
  for (const person of wanted) {
    const row = binds.get(Number(person.id));
    if (!row || !row.confirmed || !row.userid) {
      map.set(Number(person.id), { pending: false, exempt: false, half: false, reason: "未绑定钉钉" });
      continue;
    }
    bound.push({ personId: Number(person.id), userid: row.userid });
  }
  const operator = binds.get(Number(operatorPersonId));
  let scheduleError = "";
  let schedules = new Map();
  if (useSchedule) {
    if (!operator || !operator.userid) {
      scheduleError = "待配置排班查询人";
    } else {
      try {
        schedules = await schedulesFor(bound.map((row) => row.userid), date, operator.userid);
      } catch (error) {
        scheduleError = error.publicMessage || "钉钉排班接口失败";
      }
    }
  }
  let leaveError = "";
  let leaves = new Map();
  if (useLeave) {
    try {
      leaves = await leavesFor(bound.map((row) => row.userid), date);
    } catch (error) {
      leaveError = error.publicMessage || "钉钉请假接口失败";
    }
  }
  for (const row of bound) {
    const shiftRows = schedules.get(row.userid) || [];
    const schedule = scheduleError ? "error" : classifySchedule(shiftRows);
    const leave = leaveError ? "error" : classifyLeave(leaves.get(row.userid) || [], shiftWindow(shiftRows));
    let pending = false;
    let exempt = false;
    let half = false;
    let reason = "";
    if (useSchedule) {
      if (scheduleError) {
        pending = true;
        reason = scheduleError;
      } else if (schedule === "none") {
        pending = true;
        reason = "没有排班数据";
      } else if (schedule === "rest") {
        exempt = true;
        reason = "钉钉排班休息";
      }
    }
    if (useLeave && !exempt) {
      if (leaveError) {
        pending = true;
        reason = reason || leaveError;
      } else if (leave === "full") {
        exempt = true;
        pending = false;
        reason = "钉钉请假";
      } else if (leave === "half") {
        half = true;
        reason = reason || "钉钉半天假，当天仍要交";
      }
    }
    map.set(row.personId, { pending: pending && !exempt, exempt, half, reason });
  }
  attendanceCache.set(key, { at: Date.now(), map });
  return map;
}

export async function claimReminder(personId, date) {
  const key = `${Number(personId)}|${date}`;
  if (sentKeys.has(key)) {
    return false;
  }
  sentKeys.add(key);
  if (dbMode() === "mysql") {
    try {
      await query("INSERT INTO work_report_ding_remind (person_id, work_date, sent_at) VALUES (?, ?, ?)", [
        Number(personId),
        date,
        new Date().toISOString().slice(0, 19).replace("T", " ")
      ]);
    } catch (error) {
      if (error?.code === "ER_DUP_ENTRY" || error?.errno === 1062) {
        return false;
      }
      sentKeys.delete(key);
      throw error;
    }
  }
  return true;
}

export async function releaseReminder(personId, date) {
  const key = `${Number(personId)}|${date}`;
  sentKeys.delete(key);
  if (dbMode() === "mysql") {
    await query("DELETE FROM work_report_ding_remind WHERE person_id = ? AND work_date = ?", [Number(personId), date]);
  }
}

function currentAgentId() {
  return dingConfig().agentId || rememberedAgent;
}

async function persistDingApp() {
  if (dbMode() !== "mysql") {
    return;
  }
  if (!rememberedAgent && !rememberedAuth.clientId) {
    await query("DELETE FROM work_report_diary_meta WHERE meta_key = 'ding_agent'");
    return;
  }
  await query(
    `INSERT INTO work_report_diary_meta (meta_key, body, updated_at)
     VALUES ('ding_agent', ?, ?)
     ON DUPLICATE KEY UPDATE body = VALUES(body), updated_at = VALUES(updated_at)`,
    [
      JSON.stringify({
        agentId: rememberedAgent,
        clientId: rememberedAuth.clientId,
        clientSecret: rememberedAuth.clientSecret
      }),
      new Date().toISOString().slice(0, 19).replace("T", " ")
    ]
  );
}

async function rememberAgent(agentId) {
  rememberedAgent = String(agentId || "");
  await persistDingApp();
}

const USERID_CODES = new Set([33012, 40031, 49016, 60121]);

export async function checkWorkNotice() {
  try {
    await sendWorkNotice("0");
    return { ok: true };
  } catch (error) {
    const code = Number(error.code);
    if (USERID_CODES.has(code)) {
      return { ok: true };
    }
    if (error.publicMessage === "应用凭证没有通过") {
      return { ok: false, error: "应用凭证没有通过" };
    }
    if (code === 88 || code === 60011) {
      return { ok: false, error: "这个应用还没有发工作通知的权限" };
    }
    if (Number.isFinite(code) && code > 0) {
      return { ok: false, error: `工作通知还不能用（${code}）` };
    }
    return { ok: false, error: "工作通知还不能用" };
  }
}

export async function saveAppConfig(input) {
  const agentId = String(input?.agentId || "").trim();
  const clientId = String(input?.clientId || "").trim();
  const clientSecret = String(input?.clientSecret || "").trim();
  if (!/^\d{4,20}$/.test(agentId)) {
    return { ok: false, error: "应用凭证不完整" };
  }
  if (clientSecret.includes("*")) {
    return { ok: false, error: "页面上的 Client Secret 被挡住了" };
  }
  const prevAgent = rememberedAgent;
  const prevAuth = { ...rememberedAuth };
  let nextAuth = { ...rememberedAuth };
  if (clientSecret) {
    if (!/^ding[a-z0-9]+$/i.test(clientId) || clientSecret.length < 10 || clientSecret.length > 128) {
      return { ok: false, error: "应用凭证不完整" };
    }
    nextAuth = { clientId, clientSecret };
  } else if (clientId && clientId !== dingConfig().clientId) {
    return { ok: false, error: "页面上的 Client Secret 被挡住了，还不能换成这个应用" };
  }
  rememberedAgent = agentId;
  rememberedAuth = nextAuth;
  tokenCache = { value: "", until: 0 };
  const check = await checkWorkNotice();
  if (!check.ok) {
    rememberedAgent = prevAgent;
    rememberedAuth = prevAuth;
    tokenCache = { value: "", until: 0 };
    await persistDingApp();
    return check;
  }
  await persistDingApp();
  return { ok: true };
}

function appRows(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  return payload?.appList || payload?.apps || [];
}

export async function discoverAgent() {
  if (currentAgentId()) {
    return { ok: true, names: [], chosenName: "" };
  }
  let names = [];
  let chosen = "";
  let chosenName = "";
  try {
    await oapi("/topapi/v2/department/listsub", { dept_id: 1 });
    const res = await transport("https://api.dingtalk.com/v1.0/microApp/allInnerApps", {
      headers: { "x-acs-dingtalk-access-token": tokenCache.value },
      signal: AbortSignal.timeout(8000)
    });
    const data = await res.json();
    if (data.code || data.errcode) {
      return { ok: false, names: [], error: "还读不到工作通知 AgentId" };
    }
    const rows = appRows(data.result || data).filter((app) => app && (app.agentId || app.agentid));
    names = rows.map((app) => String(app.name || app.appName || "未命名"));
    const enabled = rows.filter((app) => app.appStatus === undefined || Number(app.appStatus) === 1);
    const pool = enabled.length ? enabled : rows;
    const prefer = pool.length === 1 ? pool[0] : pool.find((app) => /日报|汇报|考勤/.test(String(app.name || app.appName || "")));
    if (prefer) {
      chosen = String(prefer.agentId || prefer.agentid);
      chosenName = String(prefer.name || prefer.appName || "未命名");
    }
  } catch {
    chosen = "";
  }
  if (!chosen) {
    return { ok: false, names, error: names.length > 1 ? "有多个企业内部应用，还不能确定用哪一个发提醒" : "还读不到工作通知 AgentId" };
  }
  await rememberAgent(chosen);
  return { ok: true, names, chosenName };
}

export async function probeAttendance(people) {
  const date = shanghaiNow().date;
  const bound = confirmedBinds();
  if (!bound.length) {
    return { ok: false, error: "还没有绑定员工" };
  }
  const roleOf = (personId) => String((people || []).find((person) => Number(person.id) === Number(personId))?.role || "");
  const ordered = [...bound].sort((a, b) => {
    const rank = (role) => (role === "经理" || role === "总监" ? 0 : role === "主管" ? 1 : 2);
    return rank(roleOf(a.personId)) - rank(roleOf(b.personId));
  });
  const sample = ordered.slice(0, 20).map((row) => row.userid);
  let opened = null;
  let last = "钉钉排班接口失败";
  for (const op of ordered.slice(0, 8)) {
    try {
      const result = await oapi("/topapi/attendance/schedule/listbyusers", {
        op_user_id: op.userid,
        userids: sample.join(","),
        from_date_time: dayStart(date),
        to_date_time: dayStart(date) + 24 * 3600 * 1000 - 1
      });
      const rows = Array.isArray(result) ? result : result?.schedules || [];
      opened = { personId: op.personId, rows: rows.length };
      if (rows.length) {
        break;
      }
    } catch {
      last = "钉钉排班接口失败";
    }
  }
  let leaveOk = false;
  try {
    await oapi("/topapi/attendance/getleavestatus", {
      userid_list: sample.slice(0, 20).join(","),
      start_time: dayStart(date),
      end_time: dayStart(date) + 24 * 3600 * 1000 - 1,
      offset: 0,
      size: 20
    });
    leaveOk = true;
  } catch {
    leaveOk = false;
  }
  if (!opened) {
    return { ok: false, leaveOk, error: last };
  }
  return { ok: true, personId: opened.personId, rows: opened.rows, leaveOk };
}

export function dingUserOf(personId) {
  return binds.get(Number(personId))?.userid || "";
}

let lastPopup = { channel: "", error: "" };

function dingFail(message, code) {
  const error = new Error("钉钉接口失败");
  error.publicMessage = message || "钉钉接口失败";
  if (code) {
    error.code = Number(code) || code;
  }
  return error;
}

async function sendRobotCard(userid, title, markdown, url, button, robotCode) {
  const token = await accessToken();
  const res = await transport("https://api.dingtalk.com/v1.0/robot/oToMessages/batchSend", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-acs-dingtalk-access-token": token
    },
    body: JSON.stringify({
      robotCode: robotCode || dingConfig().clientId,
      userIds: [String(userid)],
      msgKey: "sampleMarkdown",
      msgParam: JSON.stringify({
        title: String(title || "工作任务").slice(0, 64),
        text: `${String(markdown || "").slice(0, 400)}\n\n[${button || "去处理"}](${url || WORK_URL})`
      })
    }),
    signal: AbortSignal.timeout(8000)
  });
  const data = await res.json();
  if (data.code || data.errcode) {
    throw dingFail(data.message || data.errmsg || "机器人消息没有发出", data.errcode);
  }
  if (Array.isArray(data.invalidStaffIdList) && data.invalidStaffIdList.length) {
    throw dingFail("钉钉没有这个接收人");
  }
}

async function sendCorpCard(userid, title, markdown, url, button) {
  const agentId = currentAgentId();
  if (!agentId) {
    throw dingFail("待配置工作通知 AgentId");
  }
  await oapi("/topapi/message/corpconversation/asyncsend_v2", {
    agent_id: Number(agentId) || agentId,
    userid_list: userid,
    msg: {
      msgtype: "action_card",
      action_card: {
        title: String(title || "工作任务").slice(0, 64),
        markdown: String(markdown || "").slice(0, 500),
        single_title: button || "去处理",
        single_url: url || WORK_URL
      }
    }
  });
}

export async function sendTaskNotice(userid, title, markdown, url, button = "去处理") {
  if (!userid) {
    return false;
  }
  try {
    await sendRobotCard(userid, title, markdown, url, button);
    lastPopup = { channel: "robot", error: "" };
    return "robot";
  } catch (error) {
    lastPopup = { channel: "work", error: error.publicMessage || "机器人消息没有发出" };
    await sendCorpCard(userid, title, markdown, url, button);
    return "work";
  }
}

function maskId(value) {
  const text = String(value || "");
  if (text.length < 10) {
    return text ? "已配置" : "";
  }
  return `${text.slice(0, 6)}…${text.slice(-4)}`;
}

async function robotState() {
  try {
    const data = await oapi("/microapp/list", {});
    const list = Array.isArray(data.appList) ? data.appList : [];
    const agentId = String(currentAgentId());
    const mine = list.find((app) => String(app.agentId || "") === agentId);
    const named = list
      .filter((app) => /甄选|汇报|人事|通知/.test(String(app.name || "")))
      .map((app) => `${app.name}#${app.agentId} 状态${app.appStatus ?? ""}`)
      .join("，");
    const self = mine
      ? `当前应用 ${mine.name || "未命名"} 状态${mine.appStatus ?? ""} 字段 ${Object.keys(mine).join("/")}`
      : "当前 AgentId 不在已安装应用里";
    return `${self}。相关应用：${named || "没有"}`;
  } catch (error) {
    return `读应用列表失败 ${error.code || ""} ${error.publicMessage || ""}`.slice(0, 300);
  }
}

export async function popupTo(userid) {
  if (!userid) {
    return { ok: false, statusCode: 400, error: "当前账号还没有钉钉" };
  }
  const meta = { appKey: maskId(dingConfig().clientId), agentId: currentAgentId() };
  try {
    await sendRobotCard(userid, "工作汇报", "右下角弹窗测试。请看电脑右下角，点「去处理」打开工作汇报。", workLink("todo"), "去处理");
    lastPopup = { channel: "robot", error: "" };
    return { ok: true, channel: "robot", error: "", ...meta };
  } catch (error) {
    const agentCode = String(currentAgentId() || "");
    if (agentCode && agentCode !== dingConfig().clientId) {
      try {
        await sendRobotCard(userid, "工作汇报", "右下角弹窗测试。请看电脑右下角，点「去处理」打开工作汇报。", workLink("todo"), "去处理", agentCode);
        lastPopup = { channel: "robot", error: "" };
        return { ok: true, channel: "robot", error: "", ...meta, robotCode: "agent" };
      } catch {
        /* AgentId 也不是机器人编号。 */
      }
    }
    return {
      ok: false,
      statusCode: 502,
      channel: "",
      error: `${error.publicMessage || "机器人消息没有发出"} 当前 Client ID ${meta.appKey}，AgentId ${meta.agentId}。${await robotState()}`,
      ...meta
    };
  }
}

export async function sendWorkNotice(userid) {
  if (String(userid) === "0") {
    await sendCorpCard(userid, "今天的日报还没提交", "今天的工作日报还没交，请在今天提交。", workLink("todo"), "去填日报");
    return;
  }
  await sendTaskNotice(userid, "今天的日报还没提交", "今天的工作日报还没交，请在今天提交。", workLink("todo"), "去填日报");
}

export function shanghaiNow(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value])
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hm: `${parts.hour}:${parts.minute}` };
}

export function inRemindWindow(remindAt, hm) {
  const toMinutes = (value) => {
    const [hour, minute] = String(value || "").split(":");
    return Number(hour) * 60 + Number(minute);
  };
  const target = toMinutes(remindAt);
  const current = toMinutes(hm);
  if (!Number.isFinite(target) || !Number.isFinite(current)) {
    return false;
  }
  const diff = current - target;
  return diff >= 0 && diff <= 15;
}
