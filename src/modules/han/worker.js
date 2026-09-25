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
  const n = Number(String(value ?? "").replace(/[¥￥,\s%]/g, ""));
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

function defaultRule(base = {}) {
  return {
    store: text(base.store, 64),
    accountId: text(base.accountId, 32),
    subAccountId: text(base.subAccountId, 32),
    subAccountName: text(base.subAccountName, 64),
    autoRecharge: base.autoRecharge !== false,
    plannedRoi: num(base.plannedRoi, 2) || 2,
    tier1MinSpend: num(base.tier1MinSpend, 1),
    tier1MaxSpend: num(base.tier1MaxSpend, 1000),
    tier1Balance: num(base.tier1Balance, 100),
    tier1Amount: num(base.tier1Amount, 100),
    tier2MinSpend: num(base.tier2MinSpend, 1000),
    tier2Balance: num(base.tier2Balance, 50),
    tier2Amount: num(base.tier2Amount, 150),
    roiRiseAmount: num(base.roiRiseAmount, 100),
    noOrderTimes: num(base.noOrderTimes, 3),
    pauseMinutes: num(base.pauseMinutes, 30),
  };
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
  };
}

function ruleKey(row) {
  return [row.store, row.accountId, row.subAccountId].join("\0");
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
  };
}

function parseShop(row, capturedAt) {
  const store = text(pick(row, ["店铺名称", "store", "店铺", "店名"]), 64);
  if (!store) {
    return null;
  }
  return {
    store,
    accountId: idText(pick(row, ["京准通主账户ID", "accountId", "主账户ID"]), "京准通主账户ID"),
    spend: num(pick(row, ["花费", "spend", "付费金额", "精准通总花费"])),
    orders: num(pick(row, ["成交单量", "orders", "单量"])),
    roi: num(pick(row, ["ROI", "roi"])),
    balance: num(pick(row, ["余额", "balance"])),
    gmv: num(pick(row, ["京麦成交金额", "成交金额", "gmv"])),
    capturedAt: text(pick(row, ["抓取时间", "capturedAt", "采集时间"]) || capturedAt, 40),
  };
}

function parseSub(row, fallbackStore, capturedAt) {
  const store = text(pick(row, ["店铺名称", "store"]) || fallbackStore, 64);
  const subAccountId = idText(pick(row, ["子账号ID", "subAccountId"]), "子账号ID");
  if (!store || !subAccountId) {
    return null;
  }
  return {
    store,
    accountId: idText(pick(row, ["京准通主账户ID", "accountId"]), "京准通主账户ID"),
    subAccountId,
    subAccountName: text(pick(row, ["子账号名称", "subAccountName"]), 64),
    spend: num(pick(row, ["花费", "spend"])),
    roi: num(pick(row, ["ROI", "roi"])),
    balance: num(pick(row, ["余额", "balance"])),
    orders: num(pick(row, ["单量", "orders", "成交单量"])),
    capturedAt: text(capturedAt, 40),
  };
}

function parseRecharge(row, fallbackStore) {
  const store = text(pick(row, ["店铺名称", "store"]) || fallbackStore, 64);
  const amount = num(pick(row, ["金额", "amount", "充值金额"]));
  if (!store || !amount) {
    return null;
  }
  return {
    store,
    accountId: idText(pick(row, ["京准通主账户ID", "accountId"]), "京准通主账户ID"),
    subAccountId: idText(pick(row, ["子账号ID", "subAccountId"]), "子账号ID"),
    subAccountName: text(pick(row, ["子账号名称", "subAccountName"]), 64),
    amount,
    chargedAt: text(pick(row, ["时间", "chargedAt", "充值时间", "日期"]), 40),
    note: text(pick(row, ["备注", "note", "remark"]), 200),
    executionId: idText(pick(row, ["executionId", "执行编号"]), "executionId"),
    configVersion: num(pick(row, ["configVersion", "配置版本"])),
    ruleCode: text(pick(row, ["ruleCode", "命中规则", "规则"]), 32),
    plannedRoi: num(pick(row, ["plannedRoi", "当时计划ROI", "计划ROI"])),
    execSpend: num(pick(row, ["execSpend", "当时花费"])),
    execRoi: num(pick(row, ["execRoi", "当时ROI"])),
    execOrders: num(pick(row, ["execPaidOrders", "当时单量"])),
    result: text(pick(row, ["result", "执行结果"]), 32),
  };
}

function rechargeKey(row) {
  if (row.executionId) {
    return `id\0${row.executionId}`;
  }
  return ["at", row.store, row.subAccountId, row.chargedAt, row.amount].join("\0");
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
    }
  }
  if (next.autoRecharge && !(next.plannedRoi > 0)) {
    throw httpError(400, "自动充值时计划ROI必须大于0");
  }
  return next;
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

  function totals(shops) {
    return shops.reduce(
      (sum, row) => {
        sum.spend += Number(row.spend) || 0;
        sum.orders += Number(row.orders) || 0;
        sum.gmv += Number(row.gmv) || 0;
        sum.balance += Number(row.balance) || 0;
        return sum;
      },
      { shops: shops.length, spend: 0, orders: 0, gmv: 0, balance: 0 },
    );
  }

  function editorRows(state) {
    const rules = new Map(state.rules.map((row) => [ruleKey(row), row]));
    return state.subs.map((sub) => {
      const rule = defaultRule(rules.get(ruleKey(sub)) || sub);
      return { ...rule, spend: sub.spend, roi: sub.roi, balance: sub.balance, orders: sub.orders };
    });
  }

  return {
    async workerOverview() {
      const state = await load();
      const capturedAt = state.shops.reduce((latest, row) => (row.capturedAt > latest ? row.capturedAt : latest), "");
      return {
        ok: true,
        view: "overview",
        capturedAt,
        version: state.version,
        totals: totals(state.shops),
        shops: state.shops,
      };
    },

    async workerShop(store) {
      const shop = text(store, 64);
      if (!shop) {
        throw httpError(400, "store required");
      }
      const state = await load();
      return {
        ok: true,
        view: "shop",
        store: shop,
        shop: state.shops.find((row) => row.store === shop) || null,
        subaccounts: state.subs.filter((row) => row.store === shop),
        recharges: state.recharges.filter((row) => row.store === shop),
      };
    },

    async workerRules() {
      const state = await load();
      return {
        ok: true,
        view: "rules",
        version: state.version,
        updatedAt: state.updatedAt,
        syncStatus: state.syncStatus,
        runShops: state.runs.filter((row) => row.enabled).map((row) => row.store),
        runs: state.runs,
        rows: editorRows(state),
        stores: [...new Set(state.subs.map((row) => row.store).concat(state.shops.map((row) => row.store)))],
      };
    },

    async workerHistory() {
      const state = await load();
      return { ok: true, view: "history", items: state.history.slice(-100).reverse() };
    },

    async pullWorker({ machineId, sinceVersion } = {}) {
      const state = await load();
      const version = Number(state.version) || 0;
      const since = Number(sinceVersion) || 0;
      const machine = text(machineId, 64);
      if (version > 0 && version <= since) {
        return { ok: true, changed: false, version, updatedAt: state.updatedAt, machineId: machine };
      }
      const runSaved = state.runs.length > 0;
      const enabled = new Set(state.runs.filter((row) => row.enabled).map((row) => row.store));
      const rules = new Map(state.rules.map((row) => [ruleKey(row), row]));
      const byShop = new Map();
      for (const sub of state.subs) {
        if (runSaved && !enabled.has(sub.store)) {
          continue;
        }
        const run = state.runs.find((row) => row.store === sub.store);
        if (run && run.machineId && machine && run.machineId !== machine) {
          continue;
        }
        if (!byShop.has(sub.store)) {
          byShop.set(sub.store, {
            店铺名称: sub.store,
            京准通主账户ID: String(sub.accountId || ""),
            启用: true,
            执行机: run?.machineId || "",
            子账号: [],
          });
        }
        const shop = byShop.get(sub.store);
        const rule = defaultRule(rules.get(ruleKey(sub)) || sub);
        shop.子账号.push(toWorkerSub({ ...rule, subAccountName: sub.subAccountName || rule.subAccountName }));
      }
      const shops = [...byShop.values()];
      return {
        ok: true,
        changed: true,
        version,
        updatedAt: state.updatedAt,
        machineId: machine,
        runShops: shops.map((shop) => shop.店铺名称),
        shops,
        note: "网站只下发规则。本地机用京小洁的花费、ROI、余额命中规则，再执行充值，并把花费、ROI、余额、京麦成交金额和充值记录回传。不要把京准通 Cookie 回传。",
      };
    },

    async pushWorker(body = {}) {
      const action = text(body.action || body.type, 32);
      if (action === "ack") {
        return this.ackWorker(body);
      }
      const state = await load();
      const capturedAt = text(pick(body, ["抓取时间", "capturedAt", "采集时间"]) || new Date().toISOString(), 40);
      const shopRows = Array.isArray(body.rows) ? body.rows : Array.isArray(body.shops) ? body.shops : [];
      const subRows = collectSubRows(body, shopRows);
      const rechargeRows = Array.isArray(body.recharges)
        ? body.recharges
        : Array.isArray(body.充值记录)
          ? body.充值记录
          : [];
      if (!shopRows.length && !subRows.length && !rechargeRows.length) {
        throw httpError(400, "rows、子账号或充值记录必填");
      }
      const shops = shopRows.map((row) => parseShop(row, capturedAt)).filter(Boolean);
      const subs = subRows.map((row) => parseSub(row, shops[0]?.store || "", capturedAt)).filter(Boolean);
      const recharges = rechargeRows.map((row) => parseRecharge(row, shops[0]?.store || subs[0]?.store || "")).filter(Boolean);
      const shopNames = new Set(shops.map((row) => row.store));
      state.shops = state.shops.filter((row) => !shopNames.has(row.store)).concat(shops);
      const touchedSubs = new Set(subs.map((row) => row.store));
      state.subs = state.subs.filter((row) => !touchedSubs.has(row.store)).concat(subs);
      const rechargeMap = new Map(state.recharges.map((row) => [rechargeKey(row), row]));
      for (const row of recharges) {
        rechargeMap.set(rechargeKey(row), row);
      }
      state.recharges = [...rechargeMap.values()].slice(-500);
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
      state.machines = state.machines.filter((row) => row.machineId !== machineId).concat([
        { machineId, version, status, syncedAt: new Date().toISOString(), message: text(body.message, 200) },
      ]);
      state.syncStatus = status === "success" ? "已同步" : "同步失败";
      await save(state);
      return { ok: true, machineId, version, status: status === "success" ? "已同步" : "同步失败" };
    },

    async saveWorker(body = {}) {
      const state = await load();
      const action = text(body.action, 32) || "rules";
      const actor = text(body.actor, 64) || "韩梦凯";
      state.version = (Number(state.version) || 0) + 1;
      state.updatedAt = new Date().toISOString();
      state.updatedBy = actor;
      state.syncStatus = "待同步";
      if (action === "run") {
        const names = Array.isArray(body.runShops) ? body.runShops.map((name) => text(name, 64)).filter(Boolean) : [];
        const known = new Set(state.subs.map((row) => row.store).concat(state.shops.map((row) => row.store)));
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
      } else {
        const incoming = Array.isArray(body.rows) ? body.rows : [];
        if (!incoming.length) {
          throw httpError(400, "rows required");
        }
        const current = new Map(state.rules.map((row) => [ruleKey(row), row]));
        const saved = incoming.map((row) => readRulePatch(row, current.get(ruleKey({
          store: text(pick(row, ["店铺名称", "store"]), 64),
          accountId: text(pick(row, ["京准通主账户ID", "accountId"]), 32),
          subAccountId: text(pick(row, ["子账号ID", "subAccountId"]), 32),
        })) || {}));
        for (const rule of saved) {
          current.set(ruleKey(rule), rule);
        }
        state.rules = [...current.values()];
        state.history.push({
          at: state.updatedAt,
          actor,
          summary: text(body.changeSummary, 200) || "保存充值规则",
          saved: saved.length,
        });
      }
      state.history = state.history.slice(-200);
      await save(state);
      return { ok: true, version: state.version, updatedAt: state.updatedAt, syncStatus: state.syncStatus };
    },
  };
}
