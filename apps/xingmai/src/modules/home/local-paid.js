/** 首页实时 = 韩梦凯「实时付费」+ 沈子晗「付费中心」汇总。模板相同，首页是总计。不接星脉 ERP。昨天快照做环比。 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function pad2(n) {
  return String(n).padStart(2, "0");
}

function shanghaiParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Shanghai",
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).formatToParts(date instanceof Date ? date : new Date());
  const pick = (type) => parts.find((item) => item.type === type)?.value || "";
  return {
    ymd: `${pick("year")}-${pad2(Number(pick("month")))}-${pad2(Number(pick("day")))}`,
    clock: `${pick("year")}/${Number(pick("month"))}/${Number(pick("day"))} ${pad2(Number(pick("hour")))}:${pick("minute")}:${pick("second")}`,
    hour: Number(pick("hour")) || 0
  };
}

export function shanghaiNow(date = new Date()) {
  return shanghaiParts(date).clock;
}

export function shanghaiYmd(date = new Date()) {
  return shanghaiParts(date).ymd;
}

export function shanghaiHour(date = new Date()) {
  return shanghaiParts(date).hour;
}

function emptyDay() {
  return { records: [], summary: {}, hourly: {} };
}

function emptySnap(ymd = "") {
  return { ymd, today: emptyDay(), yesterday: emptyDay() };
}

let snapPath = "";

export function setLocalPaidSnapPath(filePath) {
  snapPath = String(filePath || "");
}

function defaultSnapPath() {
  const env = String(process.env.HOME_LOCAL_PAID_SNAP || "").trim();
  if (env) {
    return env;
  }
  const root = String(process.env.MENGKAI_LIVE_ROOT || "").trim();
  if (root) {
    return path.join(root, "data", "home-local-paid-days.json");
  }
  if (fs.existsSync("/opt/mengkai/src")) {
    return "/opt/mengkai/data/home-local-paid-days.json";
  }
  return path.join(os.tmpdir(), "xingmai-home-local-paid-days.json");
}

function resolveSnapPath() {
  return snapPath || defaultSnapPath();
}

export function resetLocalPaidSnap() {
  snapPath = "";
  try {
    fs.unlinkSync(resolveSnapPath());
  } catch {}
}

function readSnap() {
  try {
    const raw = JSON.parse(fs.readFileSync(resolveSnapPath(), "utf8"));
    if (!raw || typeof raw !== "object") {
      return emptySnap();
    }
    return {
      ymd: String(raw.ymd || ""),
      today: raw.today && typeof raw.today === "object" ? raw.today : emptyDay(),
      yesterday: raw.yesterday && typeof raw.yesterday === "object" ? raw.yesterday : emptyDay()
    };
  } catch {
    return emptySnap();
  }
}

function writeSnap(snap) {
  const file = resolveSnapPath();
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(snap));
  } catch (err) {
    console.error("home local-paid snap failed", err?.message || err);
  }
}

function asNum(value) {
  if (value == null || value === "" || value === "—") {
    return null;
  }
  const n = Number(String(value).replace(/[¥￥,%\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function text(value) {
  return String(value == null ? "" : value).trim();
}

function rowDay(row) {
  const raw = text(row && (row.date || row.day || row.bizDate || row.capturedAt || row.ingestedAt));
  const m = raw.match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

function isLiveDay(row, ymd) {
  const day = rowDay(row);
  return !day || day === ymd;
}

function shopName(row) {
  return text(row && (row.shopName || row.shop || row.store || row.店铺名称));
}

function asFeeRange(raw) {
  if (raw == null || raw === "") {
    return null;
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const lo = asNum(raw.lo != null ? raw.lo : raw.min != null ? raw.min : raw.feeLo);
    const hi = asNum(raw.hi != null ? raw.hi : raw.max != null ? raw.max : raw.feeHi);
    if (lo == null && hi == null) {
      return null;
    }
    return { lo: lo != null ? lo : hi, hi: hi != null ? hi : lo };
  }
  const s = String(raw).trim();
  const m = s.match(/(\d+(?:\.\d+)?)\s*%?\s*[-–~至到]\s*(\d+(?:\.\d+)?)/);
  if (m) {
    return { lo: asNum(m[1]), hi: asNum(m[2]) };
  }
  const n = asNum(s);
  return n == null ? null : { lo: n, hi: n };
}

function mergeFeeTargets(base, incoming) {
  const out = { ...(base && typeof base === "object" && !Array.isArray(base) ? base : {}) };
  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
    return out;
  }
  Object.keys(incoming).forEach((shop) => {
    const name = text(shop);
    if (!name) {
      return;
    }
    const range = asFeeRange(incoming[shop]);
    if (!range) {
      return;
    }
    out[name] = range;
  });
  return out;
}

function applyFeeTargetsToRecords(records, book) {
  if (!book || typeof book !== "object") {
    return records || [];
  }
  return (records || []).map((row) => {
    const shop = shopName(row);
    const hit = shop ? book[shop] : null;
    if (!hit) {
      return row;
    }
    return {
      ...row,
      feeLo: row.feeLo != null ? row.feeLo : hit.lo,
      feeHi: row.feeHi != null ? row.feeHi : hit.hi
    };
  });
}

function pickNum(row, keys) {
  for (const key of keys) {
    const n = asNum(row && row[key]);
    if (n != null) {
      return n;
    }
  }
  return null;
}

function paidRecordFrom(row, source) {
  const shop = shopName(row);
  if (!shop) {
    return null;
  }
  const spend = pickNum(row, ["paidAmount", "spend", "totalPromotionCost", "花费"]);
  const jingmai = pickNum(row, ["jingmaiGmv", "liveAmount", "dealAmount", "gmv", "成交金额"]);
  const deal = pickNum(row, ["paidDeal", "totalOrderAmount", "payAmount"]);
  let fee = pickNum(row, ["feeRate", "realFeeRatio", "promotionRate"]);
  if (fee === 0) {
    fee = null;
  }
  if (fee == null && spend != null && jingmai) {
    fee = spend / jingmai;
  }
  let feeLo = pickNum(row, ["feeLo", "feeMin", "minFee", "targetLo", "feeGoalLo", "费比下限"]);
  let feeHi = pickNum(row, ["feeHi", "feeMax", "maxFee", "targetHi", "feeGoalHi", "费比上限"]);
  if (feeLo == null && feeHi == null) {
    const rangeText = text(row.feeGoal || row.feeRange || row.feeTarget || row["费比设置"]);
    const m = rangeText.match(/(\d+(?:\.\d+)?)\s*%?\s*[-–~至到]\s*(\d+(?:\.\d+)?)/);
    if (m) {
      feeLo = asNum(m[1]);
      feeHi = asNum(m[2]);
    }
  }
  return {
    shopName: shop,
    shop,
    source,
    date: rowDay(row),
    paidAmount: spend,
    paidDeal: deal != null ? deal : jingmai,
    liveAmount: jingmai,
    feeRate: fee,
    roi: pickNum(row, ["roi", "jzPaidRoi"]),
    accountId: text(row.accountId || row.jzAccount),
    paidOrders: pickNum(row, ["paidOrders", "orders", "jzPaidOrders"]),
    cvr: pickNum(row, ["cvr", "jzPaidCvr"]),
    cpc: pickNum(row, ["cpc", "jzCpc"]),
    clicks: pickNum(row, ["clicks", "jzClicks"]),
    ctr: pickNum(row, ["ctr", "jzCtr"]),
    totalOrderAmount: pickNum(row, ["totalOrderAmount", "jzOrderAmt"]),
    realFeeRatio: pickNum(row, ["realFeeRatio", "jzRealFee"]),
    success: text(row.success || row.jzOk),
    capturedAt: text(row.capturedAt || row.ingestedAt),
    feeLo,
    feeHi,
    online:
      row.online === true || row.online === "在线"
        ? true
        : row.online === false || row.online === "掉线" || row.loginExpired === true || row.stale === true
          ? false
          : null
  };
}

function betterRecord(cur, next) {
  if (!cur) {
    return next;
  }
  if (!next) {
    return cur;
  }
  if ((next.date || "") > (cur.date || "")) {
    return next;
  }
  if ((next.date || "") < (cur.date || "")) {
    return cur;
  }
  const nextAt = next.capturedAt || "";
  const curAt = cur.capturedAt || "";
  if (nextAt > curAt) {
    return next;
  }
  return {
    ...cur,
    paidAmount: cur.paidAmount != null ? cur.paidAmount : next.paidAmount,
    paidDeal: cur.paidDeal != null ? cur.paidDeal : next.paidDeal,
    liveAmount: cur.liveAmount != null ? cur.liveAmount : next.liveAmount,
    feeRate: cur.feeRate != null ? cur.feeRate : next.feeRate,
    roi: cur.roi != null ? cur.roi : next.roi,
    accountId: cur.accountId || next.accountId,
    paidOrders: cur.paidOrders != null ? cur.paidOrders : next.paidOrders,
    cvr: cur.cvr != null ? cur.cvr : next.cvr,
    cpc: cur.cpc != null ? cur.cpc : next.cpc,
    clicks: cur.clicks != null ? cur.clicks : next.clicks,
    ctr: cur.ctr != null ? cur.ctr : next.ctr,
    totalOrderAmount: cur.totalOrderAmount != null ? cur.totalOrderAmount : next.totalOrderAmount,
    realFeeRatio: cur.realFeeRatio != null ? cur.realFeeRatio : next.realFeeRatio,
    success: cur.success || next.success,
    capturedAt: cur.capturedAt || next.capturedAt,
    online: cur.online != null ? cur.online : next.online,
    feeLo: cur.feeLo != null ? cur.feeLo : next.feeLo,
    feeHi: cur.feeHi != null ? cur.feeHi : next.feeHi,
    source: cur.source && next.source && cur.source !== next.source ? "han+shen" : cur.source || next.source
  };
}

function listFromPack(pack, keys) {
  if (!pack || typeof pack !== "object") {
    return [];
  }
  for (const key of keys) {
    if (Array.isArray(pack[key])) {
      return pack[key];
    }
  }
  const nest = pack.data || pack.result || pack.payload;
  if (nest && typeof nest === "object") {
    for (const key of keys) {
      if (Array.isArray(nest[key])) {
        return nest[key];
      }
    }
  }
  return [];
}

function usableHours(hours) {
  return Array.isArray(hours) && hours.length >= 3 && hours.some((n) => Number(n) > 0);
}

function hourIncrements(hours) {
  if (!Array.isArray(hours) || hours.length < 3) {
    return [];
  }
  const nums = hours.map((n) => asNum(n));
  if (!nums.some((n) => n != null && n > 0)) {
    return [];
  }
  let lastSeen = null;
  let decreasing = false;
  nums.forEach((n) => {
    if (n == null || decreasing) {
      return;
    }
    if (lastSeen != null && n < lastSeen - 0.01) {
      decreasing = true;
    }
    lastSeen = n;
  });
  const out = Array.from({ length: 24 }, () => 0);
  if (decreasing) {
    nums.forEach((n, i) => {
      if (i < 24 && n != null) {
        out[i] = n;
      }
    });
    return out.some((n) => n > 0) ? out : [];
  }
  let last = 0;
  nums.forEach((n, i) => {
    if (i >= 24) {
      return;
    }
    if (n == null) {
      out[i] = 0;
      return;
    }
    out[i] = Math.max(0, n - last);
    last = n;
  });
  return out.some((n) => n > 0) ? out : [];
}

function sumHourIncrements(shops, field) {
  const out = Array.from({ length: 24 }, () => 0);
  let hit = false;
  (shops || []).forEach((shop) => {
    const inc = hourIncrements(shop && shop[field]);
    if (!inc.length) {
      return;
    }
    hit = true;
    inc.forEach((n, i) => {
      out[i] += n;
    });
  });
  return hit ? out : [];
}

function feeHoursFrom(spendH, payH) {
  if (!usableHours(spendH)) {
    return [];
  }
  const out = Array.from({ length: 24 }, () => 0);
  let last = 0;
  let hit = false;
  for (let i = 0; i < 24; i += 1) {
    const spend = Number(spendH[i]) || 0;
    const pay = Number((payH && payH[i]) || 0);
    if (pay > 0) {
      last = spend / pay;
      hit = true;
    }
    out[i] = last;
  }
  return hit ? out : [];
}

function pickUsableHours(...lists) {
  for (const hours of lists) {
    if (usableHours(hours)) {
      return hours;
    }
  }
  return [];
}

function summarizeRecords(records) {
  let spend = 0;
  let paidDeal = 0;
  let liveAmount = 0;
  let n = 0;
  (records || []).forEach((row) => {
    if (row.paidAmount != null) {
      spend += row.paidAmount;
    }
    if (row.paidDeal != null) {
      paidDeal += row.paidDeal;
    }
    if (row.liveAmount != null) {
      liveAmount += row.liveAmount;
    }
    n += 1;
  });
  return n
    ? {
        spend,
        paidDeal,
        liveAmount,
        feeRate: liveAmount ? spend / liveAmount : paidDeal ? spend / paidDeal : null,
        roi: spend ? (paidDeal || liveAmount) / spend : null,
        shops: n
      }
    : {};
}

export function mergeHanShenPaid(han, shenPaid, shenJingmai, ymd = shanghaiYmd()) {
  const map = {};
  function add(row, source, pack) {
    if (!isLiveDay(row, ymd)) {
      return;
    }
    const rec = paidRecordFrom(row, source);
    if (!rec) {
      return;
    }
    if (rec.online == null && pack && pack.stale === true) {
      rec.online = false;
    } else if (rec.online == null && pack && pack.stale === false) {
      rec.online = true;
    }
    map[rec.shopName] = betterRecord(map[rec.shopName], rec);
  }
  listFromPack(han, ["shops", "rows", "items", "records"]).forEach((row) => add(row, "han", han));
  listFromPack(shenPaid, ["rows", "shops", "items", "records"]).forEach((row) => add(row, "shen", shenPaid));
  listFromPack(shenJingmai, ["shops", "rows"]).forEach((row) => {
    const named = { ...row, store: shopName(row), jingmaiGmv: row.dealAmount, capturedAt: row.capturedAt };
    if (named.dealAmount == null && named.jingmaiGmv == null && !rowDay(named)) {
      return;
    }
    add(named, "shen");
  });
  const records = Object.keys(map)
    .map((name) => map[name])
    .sort((a, b) => (b.liveAmount || b.paidDeal || 0) - (a.liveAmount || a.paidDeal || 0));
  const jingmaiShops = listFromPack(shenJingmai, ["shops", "rows"]);
  const todayPay = sumHourIncrements(jingmaiShops, "todayHours");
  const todaySpend = sumHourIncrements(jingmaiShops, "todayPaidHours");
  const yesterdayPay = sumHourIncrements(jingmaiShops, "yesterdayHours");
  const yesterdaySpend = sumHourIncrements(jingmaiShops, "yesterdayPaidHours");
  const hourly = {
    todayPay,
    todaySpend,
    yesterdayPay,
    yesterdaySpend,
    todayFee: feeHoursFrom(todaySpend, todayPay),
    yesterdayFee: feeHoursFrom(yesterdaySpend, yesterdayPay)
  };
  return {
    records,
    summary: summarizeRecords(records),
    hourly
  };
}

function siblingOrigins(req) {
  const out = [];
  const forced = String(process.env.HOME_LIVE_ORIGIN || "").trim();
  if (forced) {
    out.push(forced.replace(/\/$/, ""));
  }
  if (!req) {
    return out;
  }
  const host = String(req.get?.("host") || req.headers?.host || "").trim();
  const proto = String(req.get?.("x-forwarded-proto") || req.headers?.["x-forwarded-proto"] || req.protocol || "http")
    .split(",")[0]
    .trim();
  if (host) {
    out.push(`${proto}://${host}`);
  }
  const port = Number(req.socket?.localPort || req.connection?.localPort || 0);
  if (port) {
    out.push(`http://127.0.0.1:${port}`);
  }
  return out;
}

function usableSibling(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return false;
  }
  return (
    data.ok === true ||
    Array.isArray(data.shops) ||
    Array.isArray(data.rows) ||
    Array.isArray(data.records) ||
    Array.isArray(data.items)
  );
}

async function fetchSibling(req, path) {
  const cookie = String(req?.headers?.cookie || "");
  const origins = siblingOrigins(req);
  for (const origin of origins) {
    try {
      const res = await fetch(origin + path, {
        headers: {
          accept: "application/json",
          cookie
        },
        signal: AbortSignal.timeout(8000)
      });
      if (!res.ok) {
        continue;
      }
      const data = await res.json();
      if (usableSibling(data)) {
        return data;
      }
    } catch {
      continue;
    }
  }
  return null;
}

export async function pullHanShenPaid(req, ymd = shanghaiYmd()) {
  const [han, shenPaid, shenJingmai] = await Promise.all([
    fetchSibling(req, "/api/han/worker?view=overview"),
    fetchSibling(req, `/api/shen/paid?latest=1&from=${ymd}&to=${ymd}`),
    fetchSibling(req, "/api/shen/paid/jingmai")
  ]);
  return mergeHanShenPaid(han, shenPaid, shenJingmai, ymd);
}

function feeBookFromPack(pack) {
  if (!pack || typeof pack !== "object" || Array.isArray(pack)) {
    return {};
  }
  if (pack.targets && typeof pack.targets === "object" && !Array.isArray(pack.targets)) {
    return mergeFeeTargets({}, pack.targets);
  }
  if (pack.feeTargets && typeof pack.feeTargets === "object" && !Array.isArray(pack.feeTargets)) {
    return mergeFeeTargets({}, pack.feeTargets);
  }
  return {};
}

export async function pullFeeTargets(req) {
  const [han, shen] = await Promise.all([
    fetchSibling(req, "/api/han/fee-targets"),
    fetchSibling(req, "/api/shen/paid/fee-targets")
  ]);
  return mergeFeeTargets(feeBookFromPack(han), feeBookFromPack(shen));
}

function pickHours(hourly, key) {
  const v = hourly && hourly[key];
  if (!Array.isArray(v) || v.length < 3) {
    return null;
  }
  return v.some((n) => Number(n) > 0) ? v : null;
}

function mergeTodayHourly(base, incoming, replaceHours) {
  const out = { ...(base || {}) };
  ["todayPay", "todaySpend", "todayFee"].forEach((key) => {
    const next = pickHours(incoming, key);
    if (!next) {
      return;
    }
    if (replaceHours || !pickHours(out, key)) {
      out[key] = next;
    }
  });
  return out;
}

export function stampRunningHours(prev, total, hour = shanghaiHour()) {
  const t = asNum(total);
  const src = Array.isArray(prev) ? prev : [];
  const out = Array.from({ length: 24 }, (_, i) => Number(src[i]) || 0);
  const h = Math.min(23, Math.max(0, Number(hour) || 0));
  if (t == null) {
    return out.some((n) => n > 0) ? out : [];
  }
  let before = 0;
  for (let i = 0; i < h; i += 1) {
    before += out[i];
  }
  out[h] = Math.max(0, t - before);
  for (let i = h + 1; i < 24; i += 1) {
    out[i] = 0;
  }
  return out;
}

export function stampFlatHours(prev, value, hour = shanghaiHour()) {
  const n = asNum(value);
  const src = Array.isArray(prev) ? prev : [];
  const out = Array.from({ length: 24 }, (_, i) => Number(src[i]) || 0);
  const h = Math.min(23, Math.max(0, Number(hour) || 0));
  if (n == null && !out.some((v) => v > 0)) {
    return [];
  }
  if (n != null) {
    out[h] = n;
  }
  for (let i = h + 1; i < 24; i += 1) {
    out[i] = 0;
  }
  return out;
}

function stampHourlyTotals(hourly, summary, hour) {
  const out = { ...(hourly || {}) };
  if (asNum(summary && summary.liveAmount) != null) {
    out.todayPay = stampRunningHours(out.todayPay, summary.liveAmount, hour);
  }
  if (asNum(summary && summary.spend) != null) {
    out.todaySpend = stampRunningHours(out.todaySpend, summary.spend, hour);
  }
  if (asNum(summary && summary.feeRate) != null) {
    out.todayFee = stampFlatHours(out.todayFee, summary.feeRate, hour);
  }
  return out;
}

export function rememberLocalPaidDay(pack = {}, ymd = shanghaiYmd()) {
  const snap = readSnap();
  if (snap.ymd && snap.ymd !== ymd) {
    snap.yesterday = snap.today || emptyDay();
    snap.today = emptyDay();
  }
  snap.ymd = ymd;
  snap.today = snap.today || emptyDay();
  snap.yesterday = snap.yesterday || emptyDay();
  const hasIncomingRecords = Array.isArray(pack.records) && pack.records.length;
  const records = hasIncomingRecords ? pack.records : snap.today.records || [];
  const incoming = pack.hourly && typeof pack.hourly === "object" ? pack.hourly : {};
  let hourly = mergeTodayHourly(snap.today.hourly, incoming, pack.replaceHours === true);
  let summary = { ...(snap.today.summary || {}) };
  if (pack.summary && typeof pack.summary === "object") {
    summary = { ...summary, ...pack.summary };
  } else if (hasIncomingRecords) {
    summary = { ...summary, ...summarizeRecords(records) };
  }
  if (ymd === shanghaiYmd()) {
    const hour = Number.isFinite(Number(pack.hour)) ? Number(pack.hour) : shanghaiHour();
    hourly = stampHourlyTotals(hourly, summary, hour);
  }
  const hasHours = pickHours(hourly, "todayPay") || pickHours(hourly, "todaySpend") || pickHours(hourly, "todayFee");
  if (records.length || hasHours) {
    snap.today = {
      records,
      summary,
      hourly
    };
  }
  writeSnap(snap);
  return snap;
}

export function postHomeLocalPaid(body = {}, ymd = shanghaiYmd()) {
  return packFromSnap(rememberLocalPaidDay({ ...(body || {}), replaceHours: true }, ymd));
}

function packFromSnap(snap, extra = {}) {
  const today = snap.today || emptyDay();
  const yesterday = snap.yesterday || emptyDay();
  const yestH = yesterday.hourly || {};
  const liveH = extra.hourly && typeof extra.hourly === "object" && !Array.isArray(extra.hourly) ? extra.hourly : {};
  const hourly = { ...(today.hourly || {}) };
  hourly.todayPay = pickUsableHours(hourly.todayPay, liveH.todayPay);
  hourly.todaySpend = pickUsableHours(liveH.todaySpend, hourly.todaySpend);
  hourly.todayFee = pickUsableHours(hourly.todayFee, liveH.todayFee);
  hourly.yesterdayPay = pickUsableHours(
    hourly.yesterdayPay,
    liveH.yesterdayPay,
    yestH.todayPay,
    yestH.yesterdayPay
  );
  hourly.yesterdaySpend = pickUsableHours(
    liveH.yesterdaySpend,
    hourly.yesterdaySpend,
    yestH.todaySpend,
    yestH.yesterdaySpend
  );
  hourly.yesterdayFee = pickUsableHours(
    hourly.yesterdayFee,
    liveH.yesterdayFee,
    yestH.todayFee,
    yestH.yesterdayFee
  );
  const feeTargets =
    extra.feeTargets && typeof extra.feeTargets === "object" && !Array.isArray(extra.feeTargets) ? extra.feeTargets : {};
  return {
    ok: true,
    source: "han-shen-local",
    updatedAt: shanghaiNow(),
    summary: today.summary || extra.summary || {},
    records: applyFeeTargetsToRecords(today.records || [], feeTargets),
    yesterday: {
      summary: yesterday.summary || {},
      records: yesterday.records || [],
      hourly: yesterday.hourly || {}
    },
    hourly,
    feeTargets,
    from: extra.from || []
  };
}

export async function getHomeLocalPaid(req) {
  const ymd = shanghaiYmd();
  const [merged, feeTargets] = await Promise.all([
    req ? pullHanShenPaid(req, ymd) : Promise.resolve({ records: [], summary: {}, hourly: {} }),
    req ? pullFeeTargets(req) : Promise.resolve({})
  ]);
  const snap = rememberLocalPaidDay(merged, ymd);
  const from = [];
  if ((merged.records || []).some((row) => String(row.source || "").indexOf("han") !== -1)) {
    from.push("han");
  }
  if ((merged.records || []).some((row) => String(row.source || "").indexOf("shen") !== -1)) {
    from.push("shen");
  }
  return packFromSnap(snap, { summary: merged.summary, from, feeTargets, hourly: merged.hourly });
}
