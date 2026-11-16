const TOKEN_URL = "https://api.dingtalk.com/v1.0/oauth2/accessToken";
const OAPI = "https://oapi.dingtalk.com";

export function readDingEnv(env = process.env) {
  const corpId = String(env.DINGTALK_CORP_ID || "").trim();
  const clientId = String(env.DINGTALK_CLIENT_ID || "").trim();
  const clientSecret = String(env.DINGTALK_CLIENT_SECRET || "").trim();
  return {
    configured: Boolean(corpId && clientId && clientSecret),
    corpId,
    clientId,
    clientSecret
  };
}

function dingError(data) {
  const code = data && (data.errcode ?? data.code);
  const message = data && (data.errmsg || data.message);
  if (code == null || Number(code) === 0) return "";
  return String(message || "钉钉接口没有返回数据").slice(0, 180);
}

export function createDingClient({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const config = readDingEnv(env);
  let token = "";
  let tokenUntil = 0;

  async function accessToken() {
    if (!config.configured) {
      const err = new Error("钉钉还没配置");
      err.statusCode = 503;
      throw err;
    }
    if (token && Date.now() < tokenUntil) return token;
    const res = await fetchImpl(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ appKey: config.clientId, appSecret: config.clientSecret })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.accessToken) {
      throw Object.assign(new Error("钉钉凭证换不到访问令牌"), { statusCode: 502 });
    }
    token = data.accessToken;
    tokenUntil = Date.now() + Math.max(60, Number(data.expireIn || 7200) - 120) * 1000;
    return token;
  }

  async function postOapi(path, body) {
    const access = await accessToken();
    const res = await fetchImpl(`${OAPI}${path}?access_token=${encodeURIComponent(access)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body || {})
    });
    const data = await res.json().catch(() => ({}));
    const message = dingError(data);
    if (!res.ok || message) {
      throw Object.assign(new Error(message || "钉钉接口没有返回数据"), { statusCode: 502 });
    }
    return data;
  }

  async function listDepartments() {
    const seen = new Set();
    const queue = [1];
    const ids = [];
    while (queue.length && ids.length < 400) {
      const deptId = queue.shift();
      if (seen.has(deptId)) continue;
      seen.add(deptId);
      ids.push(deptId);
      const data = await postOapi("/topapi/v2/department/listsub", { dept_id: deptId });
      for (const dept of data.result || []) {
        if (dept && dept.dept_id != null) queue.push(Number(dept.dept_id));
      }
    }
    return ids;
  }

  async function listUsers() {
    const departments = await listDepartments();
    const byId = new Map();
    for (const deptId of departments) {
      let cursor = 0;
      for (let page = 0; page < 40; page += 1) {
        const data = await postOapi("/topapi/v2/user/list", { dept_id: deptId, cursor, size: 100 });
        const result = data.result || {};
        const list = Array.isArray(result.list) ? result.list : (result.list ? [result.list] : []);
        for (const user of list) {
          const userId = String(user.userid || "").trim();
          if (!userId || byId.has(userId)) continue;
          byId.set(userId, {
            userId,
            name: String(user.name || "").trim(),
            mobile: String(user.mobile || "").trim(),
            jobNumber: String(user.job_number || "").trim()
          });
        }
        if (result.has_more !== true && result.has_more !== "true") break;
        cursor = Number(result.next_cursor || 0);
      }
    }
    return [...byId.values()];
  }

  async function listAttendance(userIds, workDate) {
    const rows = [];
    for (let index = 0; index < userIds.length; index += 50) {
      const chunk = userIds.slice(index, index + 50);
      let offset = 0;
      for (let page = 0; page < 20; page += 1) {
        const data = await postOapi("/attendance/list", {
          workDateFrom: `${workDate} 00:00:00`,
          workDateTo: `${workDate} 23:59:59`,
          userIdList: chunk,
          offset,
          limit: 50,
          isI18n: false
        });
        const records = Array.isArray(data.recordresult) ? data.recordresult : (data.recordresult ? [data.recordresult] : []);
        rows.push(...records);
        if (data.hasMore !== true && data.hasMore !== "true") break;
        offset += 50;
      }
    }
    return rows;
  }

  async function listLeaveStatus(userIds, startMs, endMs) {
    const rows = [];
    for (let index = 0; index < userIds.length; index += 20) {
      const chunk = userIds.slice(index, index + 20);
      let offset = 0;
      for (let page = 0; page < 20; page += 1) {
        const data = await postOapi("/topapi/attendance/getleavestatus", {
          userid_list: chunk.join(","),
          start_time: startMs,
          end_time: endMs,
          offset,
          size: 20
        });
        const result = data.result || {};
        rows.push(...(result.leave_status || []));
        if (!result.has_more) break;
        offset += 20;
      }
    }
    return rows;
  }

  async function listVacationTypes(opUserId) {
    const data = await postOapi("/topapi/attendance/vacation/type/list", {
      op_userid: opUserId,
      vacation_source: "all"
    });
    const raw = (data.result && data.result.result) || data.result || [];
    return Array.isArray(raw) ? raw : [];
  }

  async function listVacationQuota(opUserId, leaveCode, userIds) {
    const rows = [];
    for (let index = 0; index < userIds.length; index += 50) {
      const chunk = userIds.slice(index, index + 50);
      let offset = 0;
      for (let page = 0; page < 10; page += 1) {
        const data = await postOapi("/topapi/attendance/vacation/quota/list", {
          leave_code: leaveCode,
          op_userid: opUserId,
          userids: chunk.join(","),
          offset,
          size: 50
        });
        const result = data.result || {};
        rows.push(...(result.leave_quotas || []));
        if (!result.has_more) break;
        offset += 50;
      }
    }
    return rows;
  }

  async function listOvertimeHours(userId, workDate) {
    const columns = await postOapi("/topapi/attendance/getattcolumns", {});
    const list = (columns.result && columns.result.columns) || [];
    const overtime = list.filter((column) => String(column.name || "").includes("加班"));
    if (!overtime.length) return [];
    const data = await postOapi("/topapi/attendance/getcolumnval", {
      userid: userId,
      column_id_list: overtime.map((column) => column.id).join(","),
      from_date: `${workDate} 00:00:00`,
      to_date: `${workDate} 23:59:59`
    });
    return (data.result && data.result.column_vals) || [];
  }

  return {
    configured: () => config.configured,
    corpId: () => config.corpId,
    listUsers,
    listAttendance,
    listLeaveStatus,
    listVacationTypes,
    listVacationQuota,
    listOvertimeHours
  };
}
