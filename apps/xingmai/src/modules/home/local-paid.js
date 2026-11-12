/** 韩梦凯、沈子晗本地机回传汇总。不接星脉 ERP，具体库表稍后对接。昨天快照会留下来做环比。 */

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

export function getHomeLocalPaid() {
  const snap = rememberLocalPaidDay({}, shanghaiYmd());
  const today = snap.today || emptyDay();
  const yesterday = snap.yesterday || emptyDay();
  const hourly = { ...(today.hourly || {}) };
  if (!hourly.yesterdaySpend || hourly.yesterdaySpend.length < 3) {
    hourly.yesterdaySpend = (yesterday.hourly || {}).todaySpend || (yesterday.hourly || {}).yesterdaySpend;
  }
  if (!hourly.yesterdayFee || hourly.yesterdayFee.length < 3) {
    hourly.yesterdayFee = (yesterday.hourly || {}).todayFee || (yesterday.hourly || {}).yesterdayFee;
  }
  return {
    ok: true,
    source: "han-shen-local",
    updatedAt: shanghaiNow(),
    summary: today.summary || {},
    records: today.records || [],
    yesterday: {
      summary: yesterday.summary || {},
      records: yesterday.records || [],
      hourly: yesterday.hourly || {}
    },
    hourly
  };
}
