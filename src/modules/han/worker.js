/**
 * 韩梦凯付费中心 / 充值规则。
 * 本地机只连 GET/POST /api/han/worker。网站下发规则、保存回传，不登录京小洁，不保存京准通 Cookie，也不直接充值。
 * 花费、ROI、余额由本地机在充值前向京小洁查询；成交金额和充值由本地机执行后回传。
 */

const DOC_ID_SQL = "SELECT id, doc FROM han_worker_doc ORDER BY id ASC";

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function text(value, max = 128) {
  return String(value ?? "").trim().slice(0, max);
}

function idText(value, label, max = 64) {
  if (value == null || value === "") {
    return "";
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw httpError(400, `${label}必须是字符串，不能用科学计数法`);
    }
    return String(value);
  }
  const raw = String(value).trim();
  if (/^[+-]?\d+(\.\d+)?[eE][+-]?\d+$/.test(raw)) {
    throw httpError(400, `${label}不能使用科学计数法`);
  }
  return raw.slice(0, max);
}

function num(value, fallback = 0) {
  const raw = String(value ?? "").replace(/[¥￥,\s%元]/g, "");
  if (!raw) {
    return fallback;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function pick(row, keys) {
  for (const key of keys) {
    if (row && row[key] != null && String(row[key]).trim() !== "") {
      return row[key];
    }
  }
  return "";
}

function clockMinutes(value) {
  const match = String(value ?? "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function formatClock(value) {
  const minutes = clockMinutes(value);
  if (minutes == null) return "";
  return String(Math.floor(minutes / 60)).padStart(2, "0") + ":" + String(minutes % 60).padStart(2, "0");
}

function readClock(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const formatted = formatClock(raw);
  if (!formatted) throw httpError(400, "开关时间要写成 08:00 这种小时和分钟");
  return formatted;
}

export function shanghaiMinutes(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  let hour = Number(parts.find((part) => part.type === "hour").value);
  const minute = Number(parts.find((part) => part.type === "minute").value);
  if (hour === 24) hour = 0;
  return hour * 60 + minute;
}

export function rechargeWindowOpen(start, end, nowMinutes) {
  const from = clockMinutes(start);
  const to = clockMinutes(end);
  if (from == null || to == null || from === to) return null;
  if (from < to) return nowMinutes >= from && nowMinutes < to;
  return nowMinutes >= from || nowMinutes < to;
}

function applyRechargeSchedule(state, date = new Date()) {
  const nowMinutes = shanghaiMinutes(date);
  const inactive = new Set(
    ruleIdentities(state, true)
      .filter((row) => row.deleted)
      .map((row) => ruleKey(row)),
  );
  let opened = 0;
  let closed = 0;
  for (const rule of state.rules || []) {
    if (inactive.has(ruleKey(rule))) continue;
    const open = rechargeWindowOpen(rule.rechargeStart, rule.rechargeEnd, nowMinutes);
    if (open == null || Boolean(rule.autoRecharge) === open) continue;
    rule.autoRecharge = open;
    if (open) opened += 1;
    else closed += 1;
  }
  if (!opened && !closed) return false;
  state.version = (Number(state.version) || 0) + 1;
  state.updatedAt = date.toISOString();
  state.syncStatus = "待同步";
  state.history.push({
    at: state.updatedAt,
    actor: "定时",
    version: state.version,
    summary: opened && closed
      ? "定时开关充值：开启 " + opened + " 个，关闭 " + closed + " 个"
      : opened
        ? "定时开充值 " + opened + " 个子账号"
        : "定时关充值 " + closed + " 个子账号",
  });
  state.history = state.history.slice(-200);
  return true;
}

const DEFAULT_RECHARGE_RULE = {
  autoRecharge: true,
  plannedRoi: 2,
  tier1MinSpend: 1,
  tier1MaxSpend: 1000,
  tier1Balance: 100,
  tier1Amount: 100,
  tier2MinSpend: 1000,
  tier2Balance: 50,
  tier2Amount: 150,
  roiRiseAmount: 100,
  noOrderTimes: 3,
  pauseMinutes: 30,
};

const RULE_FIELDS = [
  ["autoRecharge", "自动充值"],
  ["plannedRoi", "计划ROI"],
  ["tier1MinSpend", "第一档花费下限"],
  ["tier1MaxSpend", "第一档花费上限"],
  ["tier1Balance", "第一档余额阈值"],
  ["tier1Amount", "第一档充值金额"],
  ["tier2MinSpend", "第二档花费下限"],
  ["tier2Balance", "第二档余额阈值"],
  ["tier2Amount", "第二档充值金额"],
  ["roiRiseAmount", "ROI上涨充值金额"],
  ["noOrderTimes", "连续充值未增单次数"],
  ["pauseMinutes", "暂停分钟数"],
  ["rechargeStart", "开充值时间"],
  ["rechargeEnd", "关充值时间"],
];

function flagOn(value, fallback) {
  if (value == null || value === "") {
    return fallback;
  }
  return value === true || value === 1 || value === "1" || value === "true";
}

function defaultRule(base = {}) {
  return {
    store: text(base.store, 64),
    accountId: text(base.accountId, 64),
    subAccountId: text(base.subAccountId, 64),
    subAccountName: text(base.subAccountName, 64),
    autoRecharge: flagOn(base.autoRecharge, DEFAULT_RECHARGE_RULE.autoRecharge),
    plannedRoi: num(base.plannedRoi, DEFAULT_RECHARGE_RULE.plannedRoi),
    tier1MinSpend: num(base.tier1MinSpend, DEFAULT_RECHARGE_RULE.tier1MinSpend),
    tier1MaxSpend: num(base.tier1MaxSpend, DEFAULT_RECHARGE_RULE.tier1MaxSpend),
    tier1Balance: num(base.tier1Balance, DEFAULT_RECHARGE_RULE.tier1Balance),
    tier1Amount: num(base.tier1Amount, DEFAULT_RECHARGE_RULE.tier1Amount),
    tier2MinSpend: num(base.tier2MinSpend, DEFAULT_RECHARGE_RULE.tier2MinSpend),
    tier2Balance: num(base.tier2Balance, DEFAULT_RECHARGE_RULE.tier2Balance),
    tier2Amount: num(base.tier2Amount, DEFAULT_RECHARGE_RULE.tier2Amount),
    roiRiseAmount: num(base.roiRiseAmount, DEFAULT_RECHARGE_RULE.roiRiseAmount),
    noOrderTimes: Math.round(num(base.noOrderTimes, DEFAULT_RECHARGE_RULE.noOrderTimes)),
    pauseMinutes: Math.round(num(base.pauseMinutes, DEFAULT_RECHARGE_RULE.pauseMinutes)),
    rechargeStart: formatClock(base.rechargeStart || base.开充值时间),
    rechargeEnd: formatClock(base.rechargeEnd || base.关充值时间),
  };
}

function materializeRule(base = {}) {
  const rule = defaultRule(base);
  if (rule.autoRecharge && !(rule.plannedRoi > 0)) {
    rule.autoRecharge = false;
  }
  if (rule.autoRecharge && !(rule.tier1Amount > 0) && !(rule.tier2Amount > 0)) {
    rule.autoRecharge = false;
  }
  return rule;
}

function assertRule(rule) {
  if (rule.tier1MaxSpend <= rule.tier1MinSpend) {
    throw httpError(400, "第一档花费上限必须大于第一档下限");
  }
  if (rule.tier2MinSpend < rule.tier1MaxSpend) {
    throw httpError(400, "第二档花费下限不能小于第一档花费上限");
  }
  if (rule.autoRecharge && !(rule.plannedRoi > 0)) {
    throw httpError(400, "自动充值时计划ROI必须大于0");
  }
  if (rule.autoRecharge && !(rule.tier1Amount > 0) && !(rule.tier2Amount > 0)) {
    throw httpError(400, "自动充值时第一档或第二档充值金额必须大于0");
  }
  const startRaw = String(rule.rechargeStart || "");
  const endRaw = String(rule.rechargeEnd || "");
  if ((startRaw && clockMinutes(startRaw) == null) || (endRaw && clockMinutes(endRaw) == null)) {
    throw httpError(400, "开关时间要写成 08:00 这种小时和分钟");
  }
  if (Boolean(startRaw) !== Boolean(endRaw)) {
    throw httpError(400, "开充值和关充值要一起填写");
  }
  if (startRaw && clockMinutes(startRaw) === clockMinutes(endRaw)) {
    throw httpError(400, "开充值和关充值不能是同一个时间");
  }
  return rule;
}

function emptyState() {
  return {
    version: 0,
    updatedAt: "",
    updatedBy: "韩梦凯",
    syncStatus: "待同步",
    shops: [],
    subs: [],
    recharges: [],
    rules: [],
    runs: [],
    history: [],
    machines: [],
    shopMasters: [],
    subMasters: [],
    shopStatuses: [],
    issues: {},
    syncedSubs: {},
    runSubList: null,
    jingmaiOnly: false,
    subNotes: [],
  };
}

const COOKIE_STATUSES = new Set(["待录", "正常", "过期", "身份不符"]);

function cookieStatus(value, strict = true) {
  const raw = text(value, 32);
  if (!raw) {
    return "";
  }
  const alias = { 有效: "正常", 可用: "正常", 已登录: "正常", 失效: "过期", 未登录: "过期" };
  const mapped = alias[raw] || raw;
  if (!COOKIE_STATUSES.has(mapped)) {
    if (!strict) {
      return "";
    }
    throw httpError(400, "Cookie状态只能是待录、正常、过期、身份不符，不能回传 Cookie 正文");
  }
  return mapped;
}

function hasReportedStatus(raw) {
  return ["京准通Cookie状态", "jztCookieStatus", "京麦Cookie状态", "jmCookieStatus", "执行状态", "runStatus", "最后错误", "lastError", "在线状态", "workerStatus", "最后心跳", "heartbeatAt"].some((key) => pick(raw, [key]) !== "");
}

function ruleIdentities(state, includeDeleted = false) {
  const masters = Array.isArray(state.subMasters) ? state.subMasters : [];
  const deadStores = new Set((state.shopMasters || []).filter((row) => row.deleted).map((row) => row.store));
  const masterKeys = new Set(masters.map((row) => ruleKey(row)));
  const rows = [];
  for (const master of masters) {
    if (!includeDeleted && (master.deleted || deadStores.has(master.store))) {
      continue;
    }
    rows.push({ ...master, deleted: Boolean(master.deleted || deadStores.has(master.store)) });
  }
  for (const sub of state.subs || []) {
    if (masterKeys.has(ruleKey(sub))) {
      continue;
    }
    if (!includeDeleted && deadStores.has(sub.store)) {
      continue;
    }
    rows.push({ ...sub, deleted: deadStores.has(sub.store) });
  }
  return rows;
}

function applyShopStatuses(state, body, strict = true) {
  const incoming = Array.isArray(body.店铺状态)
    ? body.店铺状态
    : Array.isArray(body.statuses)
      ? body.statuses
      : body.accountId || body.京准通主账户ID
        ? [body]
        : [];
  if (!incoming.length) {
    if (strict) {
      throw httpError(400, "店铺状态必填");
    }
    return;
  }
  const current = new Map((state.shopStatuses || []).map((row) => [row.accountId, row]));
  for (const raw of incoming) {
    const accountId = idText(pick(raw, ["京准通主账户ID", "accountId"]), "京准通主账户ID");
    if (!accountId) {
      if (strict) {
        throw httpError(400, "店铺状态必须带京准通主账户ID");
      }
      continue;
    }
    const prev = current.get(accountId) || {};
    const jzt = cookieStatus(pick(raw, ["京准通Cookie状态", "jztCookieStatus"]), strict);
    const jm = cookieStatus(pick(raw, ["京麦Cookie状态", "jmCookieStatus"]), strict);
    current.set(accountId, {
      accountId,
      machineId: text(pick(raw, ["执行机", "machineId"]) || prev.machineId, 64),
      jztCookieStatus: jzt || prev.jztCookieStatus || "待录",
      jmCookieStatus: jm || prev.jmCookieStatus || "待录",
      runStatus: text(pick(raw, ["执行状态", "runStatus"]) || prev.runStatus || "已停止", 16),
      lastError: pick(raw, ["最后错误", "lastError"]) !== "" ? text(pick(raw, ["最后错误", "lastError"]), 200) : (prev.lastError || ""),
      heartbeatAt: text(pick(raw, ["最后心跳", "heartbeatAt"]) || new Date().toISOString(), 40),
      workerStatus: text(pick(raw, ["在线状态", "workerStatus"]) || prev.workerStatus, 16),
    });
  }
  state.shopStatuses = [...current.values()];
}

function stampMachineHeartbeat(state, machineId) {
  const now = new Date().toISOString();
  const current = new Map((state.shopStatuses || []).map((row) => [row.accountId, row]));
  for (const shop of shopDirectory(state)) {
    if (shop.deleted || !shop.accountId) {
      continue;
    }
    if (shop.machineId && shop.machineId !== machineId) {
      continue;
    }
    const prev = current.get(shop.accountId) || {};
    current.set(shop.accountId, {
      accountId: shop.accountId,
      machineId,
      jztCookieStatus: prev.jztCookieStatus || "待录",
      jmCookieStatus: prev.jmCookieStatus || "待录",
      runStatus: prev.runStatus || "在线待机",
      lastError: prev.lastError || "",
      heartbeatAt: now,
      workerStatus: "在线",
    });
  }
  state.shopStatuses = [...current.values()];
}

function rememberHistory(state, actor, summary, extra = {}) {
  state.history.push({
    at: state.updatedAt,
    actor,
    version: state.version,
    summary,
    ...extra,
  });
}

function knownRunStores(state) {
  return new Set(
    (state.subs || [])
      .map((row) => row.store)
      .concat((state.shops || []).map((row) => row.store))
      .concat((state.shopMasters || []).filter((row) => !row.deleted).map((row) => row.store))
      .filter(Boolean),
  );
}

function applyNamedRuns(state, names, body) {
  const wanted = new Set((names || []).map((name) => text(name, 64)).filter(Boolean));
  const known = knownRunStores(state);
  for (const store of wanted) {
    known.add(store);
  }
  const previous = new Map(state.runs.map((row) => [row.store, row]));
  state.runs = [...known].map((store) => ({
    store,
    enabled: wanted.has(store),
    machineId: text(body.machineId, 64) || previous.get(store)?.machineId || "",
  }));
}

function saveRunSubs(state, body, actor) {
  const clear = body.clear === true || body.runMode === "shop";
  if (clear) {
    if (Array.isArray(body.runShops)) {
      applyNamedRuns(state, body.runShops, body);
    }
    state.runSubList = null;
    rememberHistory(state, actor, text(body.changeSummary, 200) || "恢复整店跑", {
      runShops: state.runs.filter((row) => row.enabled).map((row) => row.store),
    });
    return;
  }
  const incoming = Array.isArray(body.runSubs) ? body.runSubs : [];
  if (!incoming.length) {
    throw httpError(400, "请先勾选要跑的子账号");
  }
  const identities = ruleIdentities(state).filter((sub) => sub.subAccountId && !sub.deleted);
  const byId = new Map(identities.map((sub) => [ruleKey(sub), sub]));
  const picked = [];
  const seen = new Set();
  for (const raw of incoming) {
    const identity = {
      store: text(pick(raw, ["店铺名称", "store"]), 64),
      accountId: idText(pick(raw, ["京准通主账户ID", "accountId"]), "京准通主账户ID"),
      subAccountId: idText(pick(raw, ["子账号ID", "subAccountId"]), "子账号ID"),
    };
    const found = byId.get(ruleKey(identity));
    if (!found) {
      throw httpError(400, "找不到要跑的子账号");
    }
    const row = {
      store: found.store,
      accountId: String(found.accountId || ""),
      subAccountId: String(found.subAccountId || ""),
    };
    const key = ruleKey(row);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    picked.push(row);
  }
  state.runSubList = picked;
  if (Array.isArray(body.runShops)) {
    const names = body.runShops.map((name) => text(name, 64)).filter(Boolean);
    for (const row of picked) {
      if (!names.includes(row.store)) names.push(row.store);
    }
    applyNamedRuns(state, names, body);
  } else {
    const hadRuns = state.runs.length > 0;
    const previous = new Map(state.runs.map((row) => [row.store, row]));
    const stores = new Set(picked.map((row) => row.store));
    const known = knownRunStores(state);
    for (const store of stores) {
      known.add(store);
    }
    state.runs = [...known].map((store) => ({
      store,
      enabled: !hadRuns ? stores.has(store) : stores.has(store) ? true : Boolean(previous.get(store)?.enabled),
      machineId: previous.get(store)?.machineId || "",
    }));
  }
  rememberHistory(state, actor, text(body.changeSummary, 200) || "只跑选中子账号", {
    runSubs: picked.map((row) => row.subAccountId),
  });
}

function saveJingmaiOnly(state, body, actor) {
  const scope = text(body.scope || body.runScope, 16);
  const enabledFlag = pick(body, ["只跑京麦", "enabled", "jingmaiOnly"]);
  const turnOff = body.clear === true || scope === "all" || enabledFlag === false || enabledFlag === 0 || enabledFlag === "0" || enabledFlag === "false";
  const turnOn = scope === "jingmai" || enabledFlag === true || enabledFlag === 1 || enabledFlag === "1" || enabledFlag === "true";
  if (!turnOff && !turnOn) {
    throw httpError(400, "请指定只跑京麦或恢复京准通");
  }
  if (Array.isArray(body.runShops)) {
    applyNamedRuns(state, body.runShops, body);
  }
  state.jingmaiOnly = !turnOff && turnOn;
  rememberHistory(state, actor, text(body.changeSummary, 200) || (state.jingmaiOnly ? "只跑京麦" : "恢复京准通"), {
    runShops: state.runs.filter((row) => row.enabled).map((row) => row.store),
  });
}

function saveShopMaster(state, body, actor) {
  const op = text(body.op || body.操作, 16) || "create";
  const store = text(pick(body, ["店铺名称", "store"]), 64);
  const accountId = idText(pick(body, ["京准通主账户ID", "accountId"]), "京准通主账户ID");
  const machineId = text(pick(body, ["执行机", "machineId"]), 64);
  state.shopMasters = Array.isArray(state.shopMasters) ? state.shopMasters : [];
  const index = state.shopMasters.findIndex((row) => (accountId && row.accountId === accountId) || (store && row.store === store));
  if (op === "delete" || op === "restore") {
    if (index < 0) {
      throw httpError(400, "找不到要修改的店铺");
    }
    state.shopMasters[index].deleted = op === "delete";
    if (op === "delete") {
      state.runs = state.runs.map((row) => (row.store === state.shopMasters[index].store ? { ...row, enabled: false } : row));
    }
    rememberHistory(state, actor, text(body.changeSummary, 200) || (op === "delete" ? "删除店铺" : "恢复店铺"), {
      store: state.shopMasters[index].store,
    });
    return;
  }
  if (!store || !accountId) {
    throw httpError(400, "必须填写店铺名称和京准通主账户ID");
  }
  if (op === "update") {
    if (index < 0) {
      throw httpError(400, "找不到要编辑的店铺");
    }
    const current = state.shopMasters[index];
    if (current.accountId && current.accountId !== accountId) {
      throw httpError(400, "主账户ID创建后不可改");
    }
    const previous = current.store;
    current.store = store;
    current.machineId = machineId;
    if (previous !== store) {
      state.runs = state.runs.map((row) => (row.store === previous ? { ...row, store } : row));
      state.subs = state.subs.map((row) => (row.store === previous ? { ...row, store } : row));
      state.subMasters = (state.subMasters || []).map((row) => (row.store === previous ? { ...row, store } : row));
      state.rules = state.rules.map((row) => (row.store === previous ? { ...row, store } : row));
    }
  } else if (index >= 0) {
    throw httpError(400, "这个主账户ID已经有店铺");
  } else {
    state.shopMasters.push({ store, accountId, machineId, deleted: false });
  }
  rememberHistory(state, actor, text(body.changeSummary, 200) || (op === "update" ? "编辑店铺" : "新增店铺"), { store });
}

function writeSubRule(state, store, accountId, subAccountId, subAccountName, body) {
  const current = new Map((state.rules || []).map((row) => [ruleKey(row), row]));
  const identity = { store, accountId, subAccountId, subAccountName };
  const saved = readRulePatch({
    店铺名称: store,
    京准通主账户ID: accountId,
    子账号ID: subAccountId,
    子账号名称: subAccountName,
    自动充值: pick(body, ["自动充值", "autoRecharge"]),
    计划ROI: pick(body, ["计划ROI", "plannedRoi"]),
  }, current.get(ruleKey(identity)) || identity);
  current.set(ruleKey(saved), saved);
  state.rules = [...current.values()];
  return saved;
}

function saveSubMaster(state, body, actor) {
  const op = text(body.op || body.操作, 16) || "create";
  const accountId = idText(pick(body, ["京准通主账户ID", "accountId"]), "京准通主账户ID");
  const subAccountId = idText(pick(body, ["子账号ID", "subAccountId"]), "子账号ID");
  const subAccountName = text(pick(body, ["子账号名称", "subAccountName"]), 64);
  state.subMasters = Array.isArray(state.subMasters) ? state.subMasters : [];
  const shop = (state.shopMasters || []).find((row) => row.accountId === accountId) || shopDirectory(state).find((row) => row.accountId === accountId);
  if (!shop && op !== "delete" && op !== "restore") {
    throw httpError(400, "请先选择已有店铺");
  }
  const store = shop?.store || text(pick(body, ["店铺名称", "store"]), 64);
  const index = state.subMasters.findIndex((row) => row.accountId === accountId && row.subAccountId === subAccountId);
  if (op === "delete" || op === "restore") {
    if (!subAccountId) {
      throw httpError(400, "必须指定子账号ID");
    }
    if (index < 0) {
      const posted = (state.subs || []).find((row) => row.accountId === accountId && row.subAccountId === subAccountId);
      if (!posted) {
        throw httpError(400, "找不到要修改的子账号");
      }
      state.subMasters.push({
        store: posted.store,
        accountId,
        subAccountId,
        subAccountName: posted.subAccountName,
        deleted: op === "delete",
      });
    } else {
      state.subMasters[index].deleted = op === "delete";
    }
    rememberHistory(state, actor, text(body.changeSummary, 200) || (op === "delete" ? "删除子账号" : "恢复子账号"), {
      store,
      subAccountId,
    });
    return;
  }
  if (!accountId || !subAccountId) {
    throw httpError(400, "必须填写店铺和子账号ID");
  }
  if (op === "update") {
    const posted = (state.subs || []).find((row) => row.accountId === accountId && row.subAccountId === subAccountId);
    if (index < 0 && !posted) {
      throw httpError(400, "找不到要编辑的子账号");
    }
    if (index < 0) {
      state.subMasters.push({
        store: posted.store || store,
        accountId,
        subAccountId,
        subAccountName: subAccountName || posted.subAccountName,
        deleted: false,
      });
    } else {
      state.subMasters[index].subAccountName = subAccountName || state.subMasters[index].subAccountName;
    }
    writeSubRule(state, posted?.store || store, accountId, subAccountId, subAccountName || posted?.subAccountName || "", body);
  } else if (index >= 0 || (state.subs || []).some((row) => row.accountId === accountId && row.subAccountId === subAccountId)) {
    throw httpError(400, "这个子账号已经存在");
  } else {
    state.subMasters.push({ store, accountId, subAccountId, subAccountName, deleted: false });
    writeSubRule(state, store, accountId, subAccountId, subAccountName, body);
  }
  rememberHistory(state, actor, text(body.changeSummary, 200) || (op === "update" ? "编辑子账号" : "新增子账号"), {
    store,
    subAccountId,
  });
}

function shopDirectory(state) {
  const masters = Array.isArray(state.shopMasters) ? state.shopMasters : [];
  const seen = new Set(masters.map((row) => row.accountId || row.store));
  const rows = masters.map((row) => ({ ...row }));
  const discovered = new Map();
  for (const sub of state.subs || []) {
    if (sub.store && !discovered.has(sub.store)) {
      discovered.set(sub.store, sub.accountId || "");
    }
  }
  for (const shop of state.shops || []) {
    if (shop.store && !discovered.has(shop.store)) {
      discovered.set(shop.store, shop.accountId || "");
    }
  }
  for (const [store, accountId] of discovered) {
    const key = accountId || store;
    if (seen.has(key) || masters.some((row) => row.store === store)) {
      continue;
    }
    rows.push({ store, accountId, machineId: "", deleted: false });
  }
  return rows;
}

function ruleKey(row) {
  return [row.store, row.accountId, row.subAccountId].join("\0");
}

function documentSync(state) {
  const keys = ruleIdentities(state)
    .filter((row) => row.subAccountId && !row.deleted)
    .map((row) => ruleKey(row));
  if (!keys.length) {
    return "待同步";
  }
  const marks = keys.map((key) => (state.syncedSubs || {})[key]);
  if (marks.every((mark) => mark && Number(mark.version) === Number(state.version) && mark.status === "success")) {
    return "已同步";
  }
  if (marks.some((mark) => mark && Number(mark.version) === Number(state.version) && mark.status === "failed")) {
    return "同步失败";
  }
  return "待同步";
}

function rowSync(state, row) {
  const mark = (state.syncedSubs || {})[ruleKey(row)];
  if (!mark || Number(mark.version) !== Number(state.version)) {
    return { status: "待同步", syncedAt: mark?.syncedAt || "" };
  }
  return {
    status: mark.status === "failed" ? "同步失败" : "已同步",
    syncedAt: mark.syncedAt || "",
  };
}

function toWorkerSub(row) {
  return {
    子账号ID: String(row.subAccountId || ""),
    子账号名称: row.subAccountName || "",
    自动充值: Boolean(row.autoRecharge),
    计划ROI: Number(row.plannedRoi) || 0,
    第一档花费下限: Number(row.tier1MinSpend) || 0,
    第一档花费上限: Number(row.tier1MaxSpend) || 0,
    第一档余额阈值: Number(row.tier1Balance) || 0,
    第一档充值金额: Number(row.tier1Amount) || 0,
    第二档花费下限: Number(row.tier2MinSpend) || 0,
    第二档余额阈值: Number(row.tier2Balance) || 0,
    第二档充值金额: Number(row.tier2Amount) || 0,
    ROI上涨充值金额: Number(row.roiRiseAmount) || 0,
    连续充值未增单次数: Number(row.noOrderTimes) || 0,
    暂停分钟数: Number(row.pauseMinutes) || 0,
    开充值时间: formatClock(row.rechargeStart),
    关充值时间: formatClock(row.rechargeEnd),
    运行: Boolean(row.running),
  };
}

function parseShop(row, capturedAt) {
  const store = text(pick(row, ["店铺名称", "store", "店铺", "店名"]), 64);
  if (!store) {
    return null;
  }
  const paidOrders = num(pick(row, ["京准通付费订单数", "paidOrders", "成交单量", "orders", "单量"]));
  const jingmaiGmv = num(pick(row, ["京麦成交金额", "jingmaiGmv", "成交金额", "gmv"]));
  const success = text(pick(row, ["是否成功", "success"]), 8);
  return {
    store,
    accountId: idText(pick(row, ["京准通主账户ID", "accountId", "主账户ID"]), "京准通主账户ID"),
    spend: num(pick(row, ["京准通花费", "花费", "spend", "付费金额", "精准通总花费"])),
    paidOrders,
    orders: paidOrders,
    roi: num(pick(row, ["京准通付费投产比", "ROI", "roi", "投产比"])),
    cvr: num(pick(row, ["京准通付费转化率", "cvr", "转化率"])),
    cpc: num(pick(row, ["京准通平均点击成本", "cpc", "平均点击成本"])),
    jingmaiGmv,
    gmv: jingmaiGmv,
    clicks: num(pick(row, ["京准通点击数", "clicks", "点击数"])),
    ctr: num(pick(row, ["京准通点击率", "ctr", "点击率"])),
    totalOrderAmount: num(pick(row, ["京准通总订单金额", "totalOrderAmount"])),
    realFeeRatio: num(pick(row, ["真实费比", "realFeeRatio"])),
    balance: num(pick(row, ["余额", "balance"])),
    success: success === "否" ? "否" : "是",
    date: text(pick(row, ["date", "日期"]), 10),
    capturedAt: text(pick(row, ["抓取时间", "capturedAt", "采集时间"]) || capturedAt, 40),
  };
}

function parseSub(row, fallbackStore, capturedAt) {
  const store = text(pick(row, ["店铺名称", "store"]) || fallbackStore, 64);
  const subAccountId = idText(pick(row, ["子账号ID", "subAccountId"]), "子账号ID");
  if (!store || !subAccountId) {
    return null;
  }
  const paidOrders = num(pick(row, ["京准通付费订单数", "paidOrders", "单量", "orders", "成交单量"]));
  return {
    store,
    accountId: idText(pick(row, ["京准通主账户ID", "accountId"]), "京准通主账户ID"),
    subAccountId,
    subAccountName: text(pick(row, ["子账号名称", "subAccountName"]), 64),
    spend: num(pick(row, ["京准通花费", "花费", "spend"])),
    roi: num(pick(row, ["京准通付费投产比", "ROI", "roi", "投产比"])),
    balance: num(pick(row, ["余额", "balance", "账户余额"])),
    paidOrders,
    orders: paidOrders,
    totalOrderAmount: num(pick(row, ["京准通总订单金额", "totalOrderAmount", "订单金额"])),
    impressions: num(pick(row, ["展现数", "impressions", "曝光数"])),
    clicks: num(pick(row, ["京准通点击数", "clicks", "点击数"])),
    ctr: num(pick(row, ["京准通点击率", "ctr", "点击率"])),
    cpc: num(pick(row, ["京准通平均点击成本", "cpc", "平均点击成本"])),
    remark: text(pick(row, ["账户备注", "remark"]), 200),
    capturedAt: text(pick(row, ["抓取时间", "capturedAt", "采集时间"]) || capturedAt, 40),
  };
}

function parseRecharge(row, fallbackStore) {
  const store = text(pick(row, ["店铺名称", "store", "店铺", "店名"]) || fallbackStore, 64);
  const amountRaw = pick(row, ["充值金额", "金额", "amount", "money", "chargeAmount", "到账金额", "充值"]);
  const chargedAt = text(pick(row, ["充值时间", "chargedAt", "时间", "time", "日期"]), 40);
  const executionId = idText(pick(row, ["executionId", "执行编号", "唯一执行编号"]), "executionId");
  if (!store || (amountRaw === "" && !chargedAt && !executionId)) {
    return null;
  }
  return {
    store,
    accountId: idText(pick(row, ["京准通主账户ID", "accountId"]), "京准通主账户ID"),
    subAccountId: idText(pick(row, ["子账号ID", "子帐号ID", "子账户ID", "subAccountId"]), "子账号ID"),
    subAccountName: text(pick(row, ["子账号名称", "子帐号名称", "子账户名称", "subAccountName"]), 64),
    amount: num(amountRaw),
    balance: num(pick(row, ["余额", "balance", "账户余额", "充值后余额"])),
    chargedAt,
    note: text(pick(row, ["备注", "note", "remark"]), 200),
    executionId,
    configVersion: num(pick(row, ["configVersion", "配置版本"])),
    ruleCode: text(pick(row, ["ruleCode", "命中规则", "规则", "规则编码"]), 64),
    plannedRoi: num(pick(row, ["plannedRoi", "当时计划ROI", "计划ROI"])),
    execSpend: num(pick(row, ["execSpend", "当时花费"])),
    execRoi: num(pick(row, ["execRoi", "当时ROI"])),
    execOrders: num(pick(row, ["execPaidOrders", "当时单量"])),
    result: text(pick(row, ["result", "执行结果", "结果"]), 32),
  };
}

function rechargeKey(row) {
  if (row.executionId) {
    return `id\0${row.executionId}`;
  }
  return ["at", row.store, row.subAccountId, row.chargedAt, row.amount].join("\0");
}

function rechargeDay(value) {
  const match = String(value || "").match(/(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
}

function rechargeCutoff(now = new Date()) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const [year, month, day] = today.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
}

function keepRecentRecharges(rows, now = new Date()) {
  const cutoff = rechargeCutoff(now);
  return (rows || []).filter((row) => {
    const day = rechargeDay(row.chargedAt);
    return Boolean(day) && day >= cutoff;
  });
}

function withParentIds(item, parent) {
  const store = pick(item, ["店铺名称", "store", "店铺", "店名"]) || pick(parent, ["店铺名称", "store", "店铺", "店名"]);
  const accountId = pick(item, ["京准通主账户ID", "accountId", "主账户ID"]) || pick(parent, ["京准通主账户ID", "accountId", "主账户ID"]);
  const subAccountId = pick(item, ["子账号ID", "子帐号ID", "子账户ID", "subAccountId"]) || pick(parent, ["子账号ID", "子帐号ID", "子账户ID", "subAccountId"]);
  const subAccountName = pick(item, ["子账号名称", "子帐号名称", "子账户名称", "subAccountName"]) || pick(parent, ["子账号名称", "子帐号名称", "子账户名称", "subAccountName"]);
  return {
    ...item,
    店铺名称: store,
    京准通主账户ID: accountId,
    子账号ID: subAccountId,
    子账号名称: subAccountName,
  };
}

function parseJsonContainer(value) {
  if (typeof value !== "string") return value;
  const raw = value.trim();
  if (!raw || (raw[0] !== "[" && raw[0] !== "{")) return value;
  try {
    return JSON.parse(raw);
  } catch {
    return value;
  }
}

function looksLikeRecharge(row) {
  if (!row || typeof row !== "object" || Array.isArray(row)) return false;
  const amount = pick(row, ["充值金额", "金额", "amount", "money", "chargeAmount", "到账金额"]);
  const when = pick(row, ["充值时间", "chargedAt", "时间", "time"]);
  const exec = pick(row, ["executionId", "执行编号", "唯一执行编号"]);
  const rule = pick(row, ["ruleCode", "命中规则", "规则编码"]);
  if (pick(row, ["京准通花费", "花费", "spend", "子账号名称", "subAccountName", "店铺名称"]) && !exec && !when && amount === "") {
    return false;
  }
  return Boolean(exec || (amount !== "" && (when || rule)) || (when && rule));
}

function rechargeContext(node, parent) {
  const base = parent || {};
  if (!node || typeof node !== "object" || Array.isArray(node)) return base;
  return {
    店铺名称: pick(node, ["店铺名称", "store", "店铺", "店名"]) || base.店铺名称 || "",
    京准通主账户ID: pick(node, ["京准通主账户ID", "accountId", "主账户ID"]) || base.京准通主账户ID || "",
    子账号ID: pick(node, ["子账号ID", "子帐号ID", "子账户ID", "subAccountId"]) || base.子账号ID || "",
    子账号名称: pick(node, ["子账号名称", "子帐号名称", "子账户名称", "subAccountName"]) || base.子账号名称 || "",
  };
}

function walkRecharges(node, parent, out, depth) {
  if (depth > 8 || node == null) return;
  if (typeof node === "string") {
    const parsed = parseJsonContainer(node);
    if (parsed !== node) walkRecharges(parsed, parent, out, depth + 1);
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) walkRecharges(item, parent, out, depth + 1);
    return;
  }
  if (typeof node !== "object") return;
  const nested = Object.values(node).some((value) => Array.isArray(value) || (typeof value === "string" && value.trim().startsWith("[")));
  if (!nested && looksLikeRecharge(node)) {
    out.push(withParentIds(node, parent || {}));
    return;
  }
  const next = rechargeContext(node, parent);
  for (const value of Object.values(node)) {
    if (value && (typeof value === "object" || typeof value === "string")) walkRecharges(value, next, out, depth + 1);
  }
}

function collectRechargeRows(body) {
  const rows = [];
  walkRecharges(body, {}, rows, 0);
  return rows;
}

function collectSubRows(body, shopRows) {
  const rows = [];
  if (Array.isArray(body.subaccounts)) {
    rows.push(...body.subaccounts);
  } else if (Array.isArray(body.子账号)) {
    rows.push(...body.子账号);
  }
  for (const shop of shopRows) {
    const nested = shop?.子账号 || shop?.subaccounts;
    if (!Array.isArray(nested)) {
      continue;
    }
    const store = pick(shop, ["店铺名称", "store", "店铺", "店名"]);
    for (const row of nested) {
      rows.push({ ...row, 店铺名称: pick(row, ["店铺名称", "store"]) || store });
    }
  }
  return rows;
}

function readRulePatch(raw, current) {
  const next = defaultRule(current);
  const source = raw && typeof raw === "object" ? raw : {};
  next.store = text(pick(source, ["店铺名称", "store"]) || next.store, 64);
  next.accountId = idText(pick(source, ["京准通主账户ID", "accountId"]) || next.accountId, "京准通主账户ID");
  next.subAccountId = idText(pick(source, ["子账号ID", "subAccountId"]) || next.subAccountId, "子账号ID");
  next.subAccountName = text(pick(source, ["子账号名称", "subAccountName"]) || next.subAccountName, 64);
  if (pick(source, ["自动充值", "autoRecharge"]) !== "") {
    const flag = pick(source, ["自动充值", "autoRecharge"]);
    next.autoRecharge = flag === true || flag === 1 || flag === "1" || flag === "true";
  }
  if (pick(source, ["计划ROI", "plannedRoi"]) !== "") {
    next.plannedRoi = num(pick(source, ["计划ROI", "plannedRoi"]), next.plannedRoi);
  }
  const fields = [
    ["tier1MinSpend", "第一档花费下限"],
    ["tier1MaxSpend", "第一档花费上限"],
    ["tier1Balance", "第一档余额阈值"],
    ["tier1Amount", "第一档充值金额"],
    ["tier2MinSpend", "第二档花费下限"],
    ["tier2Balance", "第二档余额阈值"],
    ["tier2Amount", "第二档充值金额"],
    ["roiRiseAmount", "ROI上涨充值金额"],
    ["noOrderTimes", "连续充值未增单次数"],
    ["pauseMinutes", "暂停分钟数"],
  ];
  for (const [key, label] of fields) {
    const value = pick(source, [label, key]);
    if (value !== "") {
      next[key] = num(value, next[key]);
      if (key === "noOrderTimes" || key === "pauseMinutes") {
        next[key] = Math.round(next[key]);
      }
    }
  }
  if (Object.prototype.hasOwnProperty.call(source, "开充值时间") || Object.prototype.hasOwnProperty.call(source, "rechargeStart")) {
    next.rechargeStart = readClock(pick(source, ["开充值时间", "rechargeStart"]));
  }
  if (Object.prototype.hasOwnProperty.call(source, "关充值时间") || Object.prototype.hasOwnProperty.call(source, "rechargeEnd")) {
    next.rechargeEnd = readClock(pick(source, ["关充值时间", "rechargeEnd"]));
  }
  return assertRule(next);
}

export function createWorkerMethods(db, ensure) {
  async function load() {
    await ensure();
    const [rows] = await db().query(DOC_ID_SQL);
    if (!rows.length || !rows[0].doc) {
      return emptyState();
    }
    try {
      return { ...emptyState(), ...JSON.parse(rows[0].doc) };
    } catch {
      return emptyState();
    }
  }

  async function save(state) {
    const doc = JSON.stringify(state);
    const [rows] = await db().query(DOC_ID_SQL);
    if (!rows.length) {
      await db().query("INSERT INTO han_worker_doc (doc) VALUES (?)", [doc]);
      return;
    }
    await db().query("UPDATE han_worker_doc SET doc = ? WHERE id = ?", [doc, rows[0].id]);
  }

  function orderAmountByStore(subs) {
    const sums = new Map();
    for (const row of subs || []) {
      const store = String(row?.store || "");
      if (!store) continue;
      sums.set(store, (sums.get(store) || 0) + num(row.totalOrderAmount));
    }
    return sums;
  }

  function applySubOrderAmount(shop, sums) {
    if (!shop) return shop;
    const rolled = sums.get(shop.store) || 0;
    if (rolled > 0) shop.totalOrderAmount = rolled;
    return shop;
  }

  function presentShop(row) {
    const paidOrders = num(row.paidOrders ?? row.orders);
    const jingmaiGmv = num(row.jingmaiGmv ?? row.gmv);
    return {
      ...row,
      paidOrders,
      orders: paidOrders,
      jingmaiGmv,
      gmv: jingmaiGmv,
      totalOrderAmount: num(row.totalOrderAmount),
      clicks: num(row.clicks),
      ctr: num(row.ctr),
      cvr: num(row.cvr),
      cpc: num(row.cpc),
      realFeeRatio: num(row.realFeeRatio),
      success: row.success === "否" ? "否" : "是",
      date: row.date || String(row.capturedAt || "").slice(0, 10),
    };
  }

  function presentSub(row, notes) {
    const paidOrders = num(row.paidOrders ?? row.orders);
    const saved = (notes || []).find((note) => note.store === row.store && note.subAccountId === row.subAccountId);
    return {
      ...row,
      paidOrders,
      orders: paidOrders,
      totalOrderAmount: num(row.totalOrderAmount),
      impressions: num(row.impressions),
      clicks: num(row.clicks),
      ctr: num(row.ctr),
      cpc: num(row.cpc),
      remark: saved ? saved.remark : (row.remark || ""),
    };
  }

  function totals(shops) {
    return shops.reduce(
      (sum, row) => {
        const shop = presentShop(row);
        sum.spend += shop.spend;
        sum.orders += shop.paidOrders;
        sum.paidOrders += shop.paidOrders;
        sum.gmv += shop.jingmaiGmv;
        sum.jingmaiGmv += shop.jingmaiGmv;
        sum.totalOrderAmount += shop.totalOrderAmount;
        sum.balance += num(shop.balance);
        if (shop.success !== "否") {
          sum.successCount += 1;
        }
        return sum;
      },
      {
        shops: shops.length,
        stores: shops.length,
        spend: 0,
        orders: 0,
        paidOrders: 0,
        gmv: 0,
        jingmaiGmv: 0,
        totalOrderAmount: 0,
        balance: 0,
        successCount: 0,
      },
    );
  }

  function latestSync(state) {
    const machines = state.machines || [];
    const latest = machines.reduce((best, row) => (!best || String(row.syncedAt || "") > String(best.syncedAt || "") ? row : best), null);
    return { status: state.syncStatus || "待同步", syncedAt: latest?.syncedAt || "" };
  }

  function editorRows(state, includeDeleted = false) {
    const rules = new Map(state.rules.map((row) => [ruleKey(row), row]));
    const runSubActive = Array.isArray(state.runSubList);
    const runSubKeys = new Set((state.runSubList || []).map((row) => ruleKey(row)));
    const runSaved = state.runs.length > 0;
    const runByStore = new Map(state.runs.map((row) => [row.store, row]));
    return ruleIdentities(state, includeDeleted).map((sub) => {
      const saved = rules.get(ruleKey(sub));
      const rule = materializeRule(saved || { store: sub.store, accountId: sub.accountId, subAccountId: sub.subAccountId, subAccountName: sub.subAccountName });
      const sync = rowSync(state, sub);
      const shopRun = runByStore.get(sub.store);
      const shopOn = shopRun ? Boolean(shopRun.enabled) : !runSaved;
      const subRunning = state.jingmaiOnly ? false : runSubActive ? shopOn && runSubKeys.has(ruleKey(sub)) && !sub.deleted : false;
      return {
        ...rule,
        subAccountName: sub.subAccountName || rule.subAccountName,
        deleted: Boolean(sub.deleted),
        subRunning,
        spend: sub.spend,
        roi: sub.roi,
        balance: sub.balance,
        orders: sub.orders,
        version: saved ? state.version : 0,
        updatedBy: saved ? state.updatedBy : "",
        updatedAt: saved ? state.updatedAt : "",
        syncStatus: sync.status,
        syncedAt: sync.syncedAt,
      };
    });
  }

  function shopRuns(state) {
    const saved = new Map(state.runs.map((row) => [row.store, row]));
    const statusByAccount = new Map((state.shopStatuses || []).map((row) => [row.accountId, row]));
    const runListSaved = state.runs.length > 0;
    return shopDirectory(state).map((shop) => {
      const run = saved.get(shop.store);
      const enabled = shop.deleted ? false : run ? Boolean(run.enabled) : !runListSaved;
      const reported = statusByAccount.get(shop.accountId) || {};
      return {
        store: shop.store,
        accountId: shop.accountId || "",
        deleted: Boolean(shop.deleted),
        enabled,
        machineId: shop.machineId || run?.machineId || reported.machineId || "",
        status: shop.deleted ? "已停止" : enabled ? "已开启" : "已停止",
        jztCookieStatus: reported.jztCookieStatus || "待录",
        jmCookieStatus: reported.jmCookieStatus || "待录",
        runStatus: reported.runStatus || "已停止",
        heartbeatAt: reported.heartbeatAt || "",
        workerStatus: reported.workerStatus || "",
        lastError: reported.lastError || "",
      };
    });
  }

  return {
    async workerOverview() {
      const state = await load();
      const capturedAt = state.shops.reduce((latest, row) => (row.capturedAt > latest ? row.capturedAt : latest), "");
      const orderAmounts = orderAmountByStore(state.subs);
      const shops = state.shops.map((row) => applySubOrderAmount(presentShop(row), orderAmounts));
      const metrics = totals(shops);
      return {
        ok: true,
        view: "overview",
        capturedAt,
        asOf: capturedAt,
        version: state.version,
        totals: metrics,
        metrics,
        shops,
      };
    },

    async workerShop(store) {
      const shop = text(store, 64);
      if (!shop) {
        throw httpError(400, "store required");
      }
      const state = await load();
      const subaccounts = state.subs.filter((row) => row.store === shop).map((row) => presentSub(row, state.subNotes));
      const found = applySubOrderAmount(
        state.shops.filter((row) => row.store === shop).map(presentShop)[0] || null,
        orderAmountByStore(subaccounts),
      );
      const accountId = String(found?.accountId || "");
      return {
        ok: true,
        view: "shop",
        store: shop,
        shop: found,
        subaccounts,
        recharges: keepRecentRecharges(state.recharges.filter((row) => row.store === shop || (accountId && row.accountId === accountId))),
      };
    },

    async workerRules(query = {}) {
      const state = await load();
      if (applyRechargeSchedule(state)) await save(state);
      const includeDeleted = String(query.deleted || "") === "1";
      const runs = shopRuns(state).filter((row) => includeDeleted || !row.deleted);
      return {
        ok: true,
        view: "rules",
        version: state.version,
        updatedAt: state.updatedAt,
        updatedBy: state.updatedBy,
        syncStatus: documentSync(state),
        runListSaved: state.runs.length > 0,
        runShops: runs.filter((row) => row.enabled).map((row) => row.store),
        shopRuns: runs,
        runs,
        machines: (state.machines || []).map((row) => ({
          ...row,
          status: row.status === "success" ? "已同步" : row.status === "failed" ? "同步失败" : row.status || "待同步",
        })),
        rows: editorRows(state, includeDeleted),
        jingmaiOnly: Boolean(state.jingmaiOnly),
        runScope: state.jingmaiOnly ? "jingmai" : "all",
        runSubMode: Array.isArray(state.runSubList),
        runSubs: (state.runSubList || []).map((row) => ({
          store: row.store,
          accountId: String(row.accountId || ""),
          subAccountId: String(row.subAccountId || ""),
        })),
        stores: runs.map((row) => row.store),
        shops: runs.map((row) => row.store),
        newSubDefaults: { autoRecharge: false, plannedRoi: 2 },
      };
    },

    async workerHistory() {
      const state = await load();
      return { ok: true, view: "history", items: state.history.slice(-100).reverse() };
    },

    async pullWorker({ machineId, sinceVersion } = {}) {
      const state = await load();
      const scheduled = applyRechargeSchedule(state);
      const since = Number(sinceVersion) || 0;
      const machine = text(machineId, 64);
      if (machine) stampMachineHeartbeat(state, machine);
      if (scheduled || machine) await save(state);
      const version = Number(state.version) || 0;
      if (version > 0 && version <= since) {
        return { ok: true, changed: false, version, updatedAt: state.updatedAt, machineId: machine };
      }
      const runSaved = state.runs.length > 0;
      const runByStore = new Map(state.runs.map((row) => [row.store, row]));
      const subRunActive = Array.isArray(state.runSubList);
      const runSubKeys = new Set((state.runSubList || []).map((row) => ruleKey(row)));
      const rules = new Map(state.rules.map((row) => [ruleKey(row), row]));
      const subsByStore = new Map();
      for (const sub of ruleIdentities(state)) {
        if (!sub.subAccountId || sub.deleted) {
          continue;
        }
        if (!subsByStore.has(sub.store)) {
          subsByStore.set(sub.store, []);
        }
        subsByStore.get(sub.store).push(sub);
      }
      const issuedKeys = [];
      const runShops = [];
      const directory = shopDirectory(state);
      const shops = directory
        .filter((shop) => !shop.deleted)
        .map((shop) => {
          const run = runByStore.get(shop.store);
          const enabled = run ? Boolean(run.enabled) : !runSaved;
          const assignedElsewhere = Boolean(run?.machineId && machine && run.machineId !== machine);
          const accountId = String(shop.accountId || "");
          const running = enabled && !assignedElsewhere && Boolean(accountId);
          const subs = (subsByStore.get(shop.store) || []).map((sub) => {
            issuedKeys.push(ruleKey(sub));
            const saved = rules.get(ruleKey(sub));
            const rule = materializeRule(saved || {
              store: sub.store,
              accountId: sub.accountId,
              subAccountId: sub.subAccountId,
              subAccountName: sub.subAccountName,
            });
            const subRunning = state.jingmaiOnly ? false : subRunActive ? running && runSubKeys.has(ruleKey(sub)) : running;
            return toWorkerSub({
              ...rule,
              subAccountName: sub.subAccountName || rule.subAccountName,
              running: subRunning,
            });
          });
          const shopOn = state.jingmaiOnly ? running : subRunActive ? subs.some((row) => row.运行) : running;
          if (shopOn && accountId && !runShops.includes(accountId)) {
            runShops.push(accountId);
          }
          return {
            店铺名称: shop.store,
            京准通主账户ID: String(shop.accountId || ""),
            启用: shopOn,
            执行机: shop.machineId || run?.machineId || "",
            子账号: subs,
          };
        });
      const runSubs = shops.flatMap((shop) => (shop.子账号 || [])
        .filter((sub) => sub.运行)
        .map((sub) => ({ 京准通主账户ID: shop.京准通主账户ID, 子账号ID: sub.子账号ID })));
      state.issues = state.issues || {};
      state.issues[String(version)] = issuedKeys;
      const issueVersions = Object.keys(state.issues).map(Number).sort((a, b) => a - b);
      for (const oldVersion of issueVersions.slice(0, Math.max(0, issueVersions.length - 20))) {
        delete state.issues[String(oldVersion)];
      }
      await save(state);
      const latestChange = [...state.history].reverse().find((row) => row && row.summary);
      const deletedSubAccounts = ruleIdentities(state, true)
        .filter((sub) => sub.deleted && sub.subAccountId)
        .map((sub) => ({
          京准通主账户ID: String(sub.accountId || ""),
          子账号ID: String(sub.subAccountId || ""),
        }));
      return {
        ok: true,
        changed: true,
        version,
        updatedAt: state.updatedAt,
        machineId: machine,
        fullSnapshot: true,
        changeSummary: latestChange?.summary || "",
        runMode: subRunActive ? "sub" : "shop",
        runScope: state.jingmaiOnly ? "jingmai" : "all",
        只跑京麦: Boolean(state.jingmaiOnly),
        runShops,
        runSubs,
        shops,
        deletedShopIds: directory.filter((shop) => shop.deleted && shop.accountId).map((shop) => String(shop.accountId)),
        deletedSubAccounts,
        note: "fullSnapshot 为 true，用本次 shops 整包覆盖本地规则。批量改ROI写入计划ROI，批量改金额写入第一档充值金额、第二档充值金额或ROI上涨充值金额，批量开付费和批量关付费写入自动充值。开充值时间和关充值时间都有值时，每天只在这个时段里自动充值是 true，时段外自动充值是 false，不要充值；采集、京麦、京准通仍按运行范围继续。到点后网站会给出新版本。改这些不用停店，店铺正在运行时也返回。本机下次 GET 拿到新版本后，在下一批开始时使用最新规则。runMode 为 shop 时按整店跑，该店每个子账号的运行都是 true。runMode 为 sub 时只跑 runSubs 里的子账号，子账号.运行 为 false 的不要采集、不要充值。runShops 只是当前要进入的店铺的京准通主账户ID；为空表示在线待机，京麦也不采集。只跑京麦为 true 时，runShops 里的店都要进，只采集京麦成交金额和京麦 Cookie 状态，这些子账号的运行都是 false，不要打开京准通，不要采集京准通花费、ROI、余额、点击，不要充值。未选中的子账号仍留在 shops 里，规则不要丢掉。deletedShopIds、deletedSubAccounts 是已删除名单。网站不接收京准通 Cookie。",
      };
    },

    async pushWorker(body = {}) {
      const action = text(body.action || body.type, 32);
      if (action === "ack") {
        return this.ackWorker(body);
      }
      if (action === "status") {
        const state = await load();
        applyShopStatuses(state, body);
        await save(state);
        return { ok: true, statuses: state.shopStatuses.length };
      }
      const state = await load();
      const capturedAt = text(pick(body, ["抓取时间", "capturedAt", "采集时间"]) || new Date().toISOString(), 40);
      const shopRows = Array.isArray(body.rows) ? body.rows : Array.isArray(body.shops) ? body.shops : [];
      const subRows = collectSubRows(body, shopRows);
      const rechargeRows = collectRechargeRows(body);
      if (!shopRows.length && !subRows.length && !rechargeRows.length) {
        throw httpError(400, "rows、子账号或充值记录必填");
      }
      const shops = shopRows.map((row) => parseShop(row, capturedAt)).filter(Boolean);
      const subs = subRows.map((row) => parseSub(row, shops[0]?.store || "", capturedAt)).filter(Boolean);
      const recharges = [];
      for (const row of rechargeRows) {
        try {
          const parsed = parseRecharge(row, shops[0]?.store || subs[0]?.store || "");
          if (parsed) recharges.push(parsed);
        } catch {
          // 一条坏记录不挡这次花费回传，也不挡同包里的其他充值记录。
        }
      }
      const shopNames = new Set(shops.map((row) => row.store));
      state.shops = state.shops.filter((row) => !shopNames.has(row.store)).concat(shops);
      const touchedSubs = new Set(subs.map((row) => row.store));
      state.subs = state.subs.filter((row) => !touchedSubs.has(row.store)).concat(subs);
      const rechargeMap = new Map(keepRecentRecharges(state.recharges).map((row) => [rechargeKey(row), row]));
      for (const row of recharges) {
        rechargeMap.set(rechargeKey(row), row);
      }
      state.recharges = keepRecentRecharges([...rechargeMap.values()]);
      if (Array.isArray(body.店铺状态) || Array.isArray(body.statuses)) {
        applyShopStatuses(state, body, false);
      }
      const statusRows = shopRows.filter((row) => hasReportedStatus(row));
      if (statusRows.length) {
        applyShopStatuses(state, { 店铺状态: statusRows }, false);
      }
      await save(state);
      return {
        ok: true,
        received: { shops: shops.length, subaccounts: subs.length, recharges: recharges.length },
        capturedAt,
      };
    },

    async ackWorker(body = {}) {
      const state = await load();
      const machineId = text(body.machineId, 64) || "local";
      const version = num(body.version, state.version);
      const statusText = text(body.status, 16).toLowerCase();
      if (statusText !== "success" && statusText !== "failed") {
        throw httpError(400, "status 必须是 success 或 failed");
      }
      const status = statusText;
      const syncedAt = new Date().toISOString();
      state.machines = state.machines.filter((row) => row.machineId !== machineId).concat([
        { machineId, version, status, syncedAt, message: text(body.message, 200) },
      ]);
      const issued = (state.issues || {})[String(version)] || [];
      state.syncedSubs = state.syncedSubs || {};
      for (const key of issued) {
        state.syncedSubs[key] = { version: Number(version), status, syncedAt };
      }
      state.syncStatus = documentSync(state);
      await save(state);
      return { ok: true, machineId, version, status: status === "success" ? "已同步" : "同步失败" };
    },

    async saveWorker(body = {}) {
      const action = text(body.action, 32) || "rules";
      if (action === "remark") {
        const state = await load();
        const storeName = text(pick(body, ["店铺名称", "store"]), 64);
        const subAccountId = idText(pick(body, ["子账号ID", "subAccountId"]), "子账号ID");
        if (!storeName || !subAccountId) throw httpError(400, "店铺和子账号必填");
        const known = (state.subs || []).some((row) => row.store === storeName && row.subAccountId === subAccountId);
        if (!known) throw httpError(404, "子账号不存在");
        const remark = text(pick(body, ["账户备注", "remark"]), 200);
        state.subNotes = (state.subNotes || []).filter((row) => !(row.store === storeName && row.subAccountId === subAccountId));
        state.subNotes.push({ store: storeName, subAccountId, remark });
        if (state.subNotes.length > 2000) state.subNotes = state.subNotes.slice(-2000);
        await save(state);
        return { ok: true, store: storeName, subAccountId, remark, version: state.version };
      }
      const state = await load();
      const actor = text(body.actor, 64) || "韩梦凯";
      state.version = (Number(state.version) || 0) + 1;
      state.updatedAt = new Date().toISOString();
      state.updatedBy = actor;
      state.syncStatus = "待同步";
      if (action === "shop") {
        saveShopMaster(state, body, actor);
      } else if (action === "sub") {
        saveSubMaster(state, body, actor);
      } else if (action === "run") {
        const names = Array.isArray(body.runShops) ? body.runShops.map((name) => text(name, 64)).filter(Boolean) : [];
        const known = new Set(
          state.subs
            .map((row) => row.store)
            .concat(state.shops.map((row) => row.store))
            .concat((state.shopMasters || []).filter((row) => !row.deleted).map((row) => row.store)),
        );
        const previous = new Map(state.runs.map((row) => [row.store, row]));
        const named = Array.isArray(body.shopRuns) ? body.shopRuns : null;
        state.runs = named
          ? named
              .map((row) => {
                const store = text(pick(row, ["店铺名称", "store"]), 64);
                if (!store) {
                  return null;
                }
                const enabledFlag = pick(row, ["启用", "enabled"]);
                return {
                  store,
                  enabled: enabledFlag === "" ? true : enabledFlag === true || enabledFlag === 1 || enabledFlag === "1" || enabledFlag === "true",
                  machineId: text(pick(row, ["执行机", "machineId"]), 64),
                };
              })
              .filter(Boolean)
          : [...known].map((store) => ({
              store,
              enabled: names.includes(store),
              machineId: text(body.machineId, 64) || previous.get(store)?.machineId || "",
            }));
        state.history.push({
          at: state.updatedAt,
          actor,
          summary: text(body.changeSummary, 200) || "保存运行状态",
          runShops: state.runs.filter((row) => row.enabled).map((row) => row.store),
        });
      } else if (action === "runSubs") {
        saveRunSubs(state, body, actor);
      } else if (action === "jingmai" || action === "runScope") {
        saveJingmaiOnly(state, body, actor);
      } else {
        const incoming = Array.isArray(body.rows) ? body.rows : [];
        if (!incoming.length) {
          throw httpError(400, "rows required");
        }
        const current = new Map(state.rules.map((row) => [ruleKey(row), row]));
        const saved = incoming.map((row) => readRulePatch(row, current.get(ruleKey({
          store: text(pick(row, ["店铺名称", "store"]), 64),
          accountId: text(pick(row, ["京准通主账户ID", "accountId"]), 64),
          subAccountId: text(pick(row, ["子账号ID", "subAccountId"]), 64),
        })) || {}));
        const summary = text(body.changeSummary, 200) || "保存充值规则";
        for (const rule of saved) {
          const before = materializeRule(current.get(ruleKey(rule)) || {
            store: rule.store,
            accountId: rule.accountId,
            subAccountId: rule.subAccountId,
            subAccountName: rule.subAccountName,
          });
          for (const [key, label] of RULE_FIELDS) {
            if (String(before[key]) === String(rule[key])) {
              continue;
            }
            state.history.push({
              at: state.updatedAt,
              actor,
              version: state.version,
              store: rule.store,
              subAccountId: rule.subAccountId,
              field: label,
              oldValue: String(before[key]),
              newValue: String(rule[key]),
              summary,
            });
          }
          current.set(ruleKey(rule), rule);
        }
        state.rules = [...current.values()];
        state.history.push({
          at: state.updatedAt,
          actor,
          version: state.version,
          summary,
          saved: saved.length,
        });
      }
      state.history = state.history.slice(-200);
      await save(state);
      return { ok: true, version: state.version, updatedAt: state.updatedAt, syncStatus: state.syncStatus };
    },
  };
}
