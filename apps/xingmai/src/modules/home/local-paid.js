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
    clock: `${pick("year")}/${Number(pick("month"))}/${Number(pick("day"))} ${pad2(Number(pick("hour")))}:${pick("minute")}:${pick("second")}`
  };
}

export function shanghaiNow(date = new Date()) {
  return shanghaiParts(date).clock;
}

export function shanghaiYmd(date = new Date()) {
  return shanghaiParts(date).ymd;
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
  return [];
}

function sumHourly(shops, field) {
  const out = Array.from({ length: 24 }, () => null);
  let hit = false;
  (shops || []).forEach((shop) => {
    const hours = shop && shop[field];
    if (!Array.isArray(hours)) {
      return;
    }
    hours.forEach((value, i) => {
      if (i >= 24) {
        return;
      }
      const n = asNum(value);
      if (n == null) {
        return;
      }
      out[i] = (out[i] || 0) + n;
      hit = true;
    });
  });
  return hit ? out : [];
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
  const hourly = {
    todayPay: sumHourly(jingmaiShops, "todayHours"),
    yesterdayPay: sumHourly(jingmaiShops, "yesterdayHours")
  };
  return {
    records,
    summary: summarizeRecords(records),
    hourly
  };
}

function siblingOrigin(req) {
  const forced = String(process.env.HOME_LIVE_ORIGIN || "").trim();
  if (forced) {
    return forced.replace(/\/$/, "");
  }
  if (!req) {
    return "";
  }
  const host = String(req.get?.("host") || req.headers?.host || "").trim();
  if (!host) {
    return "";
  }
  const proto = String(req.get?.("x-forwarded-proto") || req.headers?.["x-forwarded-proto"] || req.protocol || "http")
    .split(",")[0]
    .trim();
  return `${proto}://${host}`;
}

async function fetchSibling(req, path) {
  const origin = siblingOrigin(req);
  if (!origin) {
    return null;
  }
  const cookie = String(req.headers?.cookie || "");
  try {
    const res = await fetch(origin + path, {
      headers: {
        accept: "application/json",
        cookie
      },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) {
      return null;
    }
    const data = await res.json();
    return data && typeof data === "object" ? data : null;
  } catch {
    return null;
  }
}

export async function pullHanShenPaid(req, ymd = shanghaiYmd()) {
  const [han, shenPaid, shenJingmai] = await Promise.all([
    fetchSibling(req, "/api/han/worker?view=overview"),
    fetchSibling(req, `/api/shen/paid?latest=1&from=${ymd}&to=${ymd}`),
    fetchSibling(req, "/api/shen/paid/jingmai")
  ]);
  return mergeHanShenPaid(han, shenPaid, shenJingmai, ymd);
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
  const records = Array.isArray(pack.records) ? pack.records : [];
  if (records.length) {
    snap.today = {
      records,
      summary: pack.summary && typeof pack.summary === "object" ? pack.summary : {},
      hourly: pack.hourly && typeof pack.hourly === "object" ? pack.hourly : snap.today.hourly || {}
    };
  }
  writeSnap(snap);
  return snap;
}

function packFromSnap(snap, extra = {}) {
  const today = snap.today || emptyDay();
  const yesterday = snap.yesterday || emptyDay();
  const hourly = { ...(today.hourly || {}) };
  if (!hourly.yesterdaySpend || hourly.yesterdaySpend.length < 3) {
    hourly.yesterdaySpend = (yesterday.hourly || {}).todaySpend || (yesterday.hourly || {}).yesterdaySpend;
  }
  if (!hourly.yesterdayFee || hourly.yesterdayFee.length < 3) {
    hourly.yesterdayFee = (yesterday.hourly || {}).todayFee || (yesterday.hourly || {}).yesterdayFee;
  }
  if (!hourly.yesterdayPay || hourly.yesterdayPay.length < 3) {
    hourly.yesterdayPay = (yesterday.hourly || {}).todayPay || (yesterday.hourly || {}).yesterdayPay;
  }
  return {
    ok: true,
    source: "han-shen-local",
    updatedAt: shanghaiNow(),
    summary: today.summary || extra.summary || {},
    records: today.records || [],
    yesterday: {
      summary: yesterday.summary || {},
      records: yesterday.records || [],
      hourly: yesterday.hourly || {}
    },
    hourly,
    from: extra.from || []
  };
}

export async function getHomeLocalPaid(req) {
  const ymd = shanghaiYmd();
  const merged = req ? await pullHanShenPaid(req, ymd) : { records: [], summary: {}, hourly: {} };
  const snap = rememberLocalPaidDay(merged, ymd);
  const from = [];
  if ((merged.records || []).some((row) => String(row.source || "").indexOf("han") !== -1)) {
    from.push("han");
  }
  if ((merged.records || []).some((row) => String(row.source || "").indexOf("shen") !== -1)) {
    from.push("shen");
  }
  return packFromSnap(snap, { summary: merged.summary, from });
}
