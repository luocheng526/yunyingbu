/** 首页「近七天业绩汇总」：表头、爬虫底稿、手填覆盖、钉钉发图。 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { shanghaiYmd, shanghaiNow } from "./local-paid.js";
import { applyWpsPack, readWpsStore } from "./week-wps.js";

const TEAMS = [
  { key: "han", label: "韩梦凯五倍店铺", totalLabel: "韩梦凯五倍店铺业绩" },
  { key: "shen", label: "沈子晗五倍店铺", totalLabel: "沈子晗五倍店铺业绩" }
];

const MONTH_DAYS = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function pad2(n) {
  return String(n).padStart(2, "0");
}

export function mdLabel(ymd) {
  const p = String(ymd || "").split("-");
  if (p.length < 3) {
    return String(ymd || "");
  }
  return `${Number(p[1])}.${Number(p[2])}号`;
}

export function shiftYmd(ymd, delta) {
  const p = String(ymd || shanghaiYmd())
    .split("-")
    .map(Number);
  const d = new Date(Date.UTC(p[0] || 2026, (p[1] || 1) - 1, p[2] || 1));
  d.setUTCDate(d.getUTCDate() + Number(delta || 0));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

export function lastDays(count, ymd = shanghaiYmd()) {
  const n = Math.max(1, Number(count) || 7);
  const out = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const day = shiftYmd(ymd, -i);
    out.push({ ymd: day, label: mdLabel(day) });
  }
  return out;
}

function monthLastDay(year, month) {
  if (month === 2) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return leap ? 29 : 28;
  }
  return MONTH_DAYS[month] || 30;
}

function monthProfitLabel(year, month) {
  const last = monthLastDay(year, month);
  if (month === 6) {
    return `6.1-${last}号利润`;
  }
  if (month === 8 || month === 10) {
    return `${month}.1-${last}号利润`;
  }
  return `${month}.1-${month}.${last}号利润`;
}

function monthMarginLabel(year, month) {
  const last = monthLastDay(year, month);
  if (month === 6) {
    return `6.1-${last}号大毛利率`;
  }
  if (month === 8 || month === 10) {
    return `${month}.1-${last}号大毛利率`;
  }
  return `${month}.1-${month}.${last}号大毛利率`;
}

export function buildWeekColumns(ymd = shanghaiYmd()) {
  const today = String(ymd || shanghaiYmd());
  const parts = today.split("-").map(Number);
  const year = parts[0] || 2026;
  const month = parts[1] || 1;
  const days = lastDays(7, today);
  const feeDays = days.slice(-3);
  const cols = [
    { key: "takeDate", label: "拿店日期", group: "id", sticky: true, w: 72, edit: true },
    { key: "rank", label: "当月职级", group: "id", sticky: true, w: 56, edit: true },
    { key: "owner", label: "所属人", group: "id", sticky: true, w: 110, edit: true },
    { key: "stage", label: "店铺阶段", group: "id", sticky: true, w: 120, edit: true },
    { key: "shop", label: "店铺名称", group: "id", sticky: true, w: 150, edit: false },
    { key: "cat", label: "店铺所在类目", group: "cat", sticky: true, w: 88, edit: true }
  ];
  days.forEach((day) => {
    cols.push({ key: `gmv_${day.ymd}`, label: day.label, group: "gmv", w: 58, ymd: day.ymd, edit: true, tone: "gmv" });
  });
  feeDays.forEach((day) => {
    cols.push({
      key: `fee_${day.ymd}`,
      label: `${day.label}推广费用`,
      group: "fee",
      w: 64,
      ymd: day.ymd,
      edit: true
    });
  });
  feeDays.forEach((day) => {
    cols.push({
      key: `feeRate_${day.ymd}`,
      label: `${day.label}推广费用占比`,
      group: "feeRate",
      w: 72,
      ymd: day.ymd,
      edit: true
    });
  });
  cols.push({ key: "monthFee", label: "当月费比", group: "feeRate", w: 64, edit: true });
  for (let m = 1; m < month; m += 1) {
    cols.push({
      key: `profit_${pad2(m)}`,
      label: monthProfitLabel(year, m),
      group: "profit",
      w: 70,
      edit: true
    });
  }
  const mtdDays = lastDays(6, shiftYmd(today, -1)).slice(-5);
  mtdDays.forEach((day) => {
    cols.push({
      key: `mtd_${day.ymd}`,
      label: `${Number(parts[1])}.1-${Number(day.ymd.split("-")[2])}号利润`,
      group: "mtd",
      w: 70,
      ymd: day.ymd,
      edit: true
    });
  });
  const marginFrom = 5;
  for (let m = marginFrom; m < month; m += 1) {
    cols.push({
      key: `margin_${pad2(m)}`,
      label: monthMarginLabel(year, m),
      group: "margin",
      w: 72,
      edit: true
    });
  }
  mtdDays.slice(-2).forEach((day) => {
    cols.push({
      key: `marginMtd_${day.ymd}`,
      label: `${Number(parts[1])}.1-${Number(day.ymd.split("-")[2])}号大毛利率`,
      group: "margin",
      w: 72,
      ymd: day.ymd,
      edit: true
    });
  });
  [
    { key: "visitors", label: "访客数", w: 56 },
    { key: "orders", label: "订单数", w: 56 },
    { key: "newSku", label: "店铺上新数", w: 64 },
    { key: "onSale", label: "在售", w: 48 },
    { key: "jingcang", label: "京仓SPU个数", w: 72 },
    { key: "ret15", label: "近15天退货率", w: 72 },
    { key: "ret30", label: "近30天退货率", w: 72 },
    { key: "cat2", label: "店铺所在类目", w: 88 },
    { key: "monthSpend", label: "本月推广总费用", w: 80 },
    { key: "panel", label: "面板总业绩", w: 72 },
    { key: "register", label: "登记日期", w: 64 }
  ].forEach((item) => {
    cols.push({ ...item, group: "ops", edit: true });
  });
  return { ymd: today, days, feeDays, columns: cols };
}

export function weekTeams() {
  return TEAMS.map((item) => ({ ...item }));
}

export function cellKey(team, shop, col) {
  return `${team}|${shop}|${col}`;
}

function num(value) {
  if (value == null || value === "") {
    return null;
  }
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function seedRowsFromLive(records, teamKey, ymd = shanghaiYmd()) {
  const rows = [];
  (records || []).forEach((row) => {
    const source = String((row && row.source) || "");
    if (teamKey === "han" && source.indexOf("han") === -1) {
      return;
    }
    if (teamKey === "shen" && source.indexOf("shen") === -1) {
      return;
    }
    const shop = String((row && (row.shopName || row.shop || row.storeName)) || "").trim();
    if (!shop) {
      return;
    }
    const gmv = num(row.liveAmount != null ? row.liveAmount : row.paidDeal);
    const spend = num(row.paidAmount);
    const cells = {
      shop,
      owner: String((row && (row.owner || row.operator || row.chief)) || "").trim(),
      [`gmv_${ymd}`]: gmv,
      [`fee_${ymd}`]: spend,
      [`feeRate_${ymd}`]: gmv ? spend / gmv : null,
      monthFee: num(row.feeLo) != null || num(row.feeHi) != null ? `${row.feeLo || ""}-${row.feeHi || ""}` : "",
      panel: gmv
    };
    rows.push({ shop, source: "crawler", cells });
  });
  return rows;
}

export function applyManualCells(rows, cells, teamKey) {
  const map = cells && typeof cells === "object" ? cells : {};
  (rows || []).forEach((row) => {
    Object.keys(map).forEach((key) => {
      const prefix = `${teamKey}|${row.shop}|`;
      if (key.indexOf(prefix) !== 0) {
        return;
      }
      const col = key.slice(prefix.length);
      if (col && col !== "shop") {
        row.cells[col] = map[key];
        row.source = row.source === "crawler" ? "mixed" : row.source || "manual";
      }
    });
  });
  return rows;
}

export function extraManualRows(cells, teamKey, known) {
  const seen = {};
  (known || []).forEach((row) => {
    seen[row.shop] = true;
  });
  const shops = {};
  Object.keys(cells || {}).forEach((key) => {
    const parts = String(key).split("|");
    if (parts[0] !== teamKey || parts.length < 3) {
      return;
    }
    const shop = parts[1];
    if (!shop || seen[shop]) {
      return;
    }
    shops[shop] = shops[shop] || { shop, source: "manual", cells: { shop } };
    shops[shop].cells[parts.slice(2).join("|")] = cells[key];
  });
  return Object.keys(shops).map((name) => shops[name]);
}

export function teamKpis(rows, ymd) {
  let gmv = 0;
  let orders = 0;
  let n = 0;
  (rows || []).forEach((row) => {
    const pay = num(row.cells && row.cells[`gmv_${ymd}`]);
    if (pay != null) {
      gmv += pay;
    }
    const od = num(row.cells && row.cells.orders);
    if (od != null) {
      orders += od;
    }
    n += 1;
  });
  return [
    { key: "total", label: "业绩", value: gmv || "" },
    { key: "shopAvg", label: "店均", value: n ? Math.round(gmv / n) : "" },
    { key: "orders", label: "订单数", value: orders || "" },
    { key: "shops", label: "运营店铺数量", value: n }
  ];
}

let storePath = "";
const shots = new Map();

export function setWeekStorePath(filePath) {
  storePath = String(filePath || "");
}

function defaultStorePath() {
  const env = String(process.env.HOME_WEEK_STORE || "").trim();
  if (env) {
    return env;
  }
  const root = String(process.env.MENGKAI_LIVE_ROOT || "").trim();
  if (root) {
    return path.join(root, "data", "home-week-report.json");
  }
  if (fs.existsSync("/opt/mengkai/src")) {
    return "/opt/mengkai/data/home-week-report.json";
  }
  return path.join(os.tmpdir(), "xingmai-home-week-report.json");
}

function resolveStorePath() {
  return storePath || defaultStorePath();
}

export function resetWeekStore() {
  storePath = "";
  shots.clear();
  try {
    fs.unlinkSync(resolveStorePath());
  } catch {}
}

function emptyStore() {
  return { cells: {}, webhook: "", updatedAt: "" };
}

export function readWeekStore() {
  try {
    const raw = JSON.parse(fs.readFileSync(resolveStorePath(), "utf8"));
    if (!raw || typeof raw !== "object") {
      return emptyStore();
    }
    return {
      cells: raw.cells && typeof raw.cells === "object" ? raw.cells : {},
      webhook: String(raw.webhook || "").trim(),
      updatedAt: String(raw.updatedAt || "")
    };
  } catch {
    return emptyStore();
  }
}

function writeWeekStore(next) {
  const file = resolveStorePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(next, null, 2));
  return next;
}

export function saveWeekCells(patch) {
  const cur = readWeekStore();
  const cells = { ...cur.cells };
  Object.keys((patch && patch.cells) || {}).forEach((key) => {
    const val = patch.cells[key];
    if (val == null || val === "") {
      delete cells[key];
    } else {
      cells[key] = val;
    }
  });
  if (patch && Object.prototype.hasOwnProperty.call(patch, "webhook")) {
    cur.webhook = String(patch.webhook || "").trim();
  }
  cur.cells = cells;
  cur.updatedAt = shanghaiNow();
  return writeWeekStore(cur);
}

export function buildWeekPack(liveRecords, ymd = shanghaiYmd()) {
  const layout = buildWeekColumns(ymd);
  const saved = readWeekStore();
  const teams = TEAMS.map((meta) => {
    const seeded = seedRowsFromLive(liveRecords, meta.key, ymd);
    const extras = extraManualRows(saved.cells, meta.key, seeded);
    const rows = applyManualCells(seeded.concat(extras), saved.cells, meta.key);
    return {
      key: meta.key,
      label: meta.label,
      totalLabel: meta.totalLabel,
      kpis: teamKpis(rows, ymd),
      rows,
      foot: [
        { key: "fine", label: `${meta.label.replace("五倍店铺", "")}精铺组近七天业绩`, kind: "fine" },
        { key: "noclean", label: "无清洁统计", kind: "noclean" },
        { key: "clean", label: "清洁店铺统计", kind: "clean" }
      ]
    };
  });
  return applyWpsPack({
    ok: true,
    title: "甄选五倍业绩统计",
    ymd: layout.ymd,
    days: layout.days,
    feeDays: layout.feeDays,
    columns: layout.columns,
    teams,
    dingReady: Boolean(saved.webhook || process.env.HOME_WEEK_DING_WEBHOOK),
    updatedAt: saved.updatedAt || shanghaiNow(),
    source: "han-shen-crawler+manual"
  }, readWpsStore(), ymd);
}

function token() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export function saveWeekShot(buffer) {
  const id = token();
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  shots.set(id, { buf, at: Date.now() });
  if (shots.size > 8) {
    const first = shots.keys().next().value;
    shots.delete(first);
  }
  return id;
}

export function getWeekShot(id) {
  const hit = shots.get(String(id || ""));
  return hit ? hit.buf : null;
}

export function dingWebhook() {
  return String(process.env.HOME_WEEK_DING_WEBHOOK || readWeekStore().webhook || "").trim();
}

export async function postDingTalk({ webhook, title, text, picUrl }) {
  const url = String(webhook || "").trim();
  if (!url || !/^https:\/\/oapi\.dingtalk\.com\/robot\/send\?/i.test(url)) {
    return { ok: false, definiteFailure: true, error: "未配置钉钉机器人 webhook" };
  }
  const body = picUrl
    ? {
        msgtype: "markdown",
        markdown: {
          title: title || "近七天业绩汇总",
          text: `${text || title || "近七天业绩汇总"}\n\n![](${picUrl})`
        }
      }
    : {
        msgtype: "markdown",
        markdown: { title: title || "近七天业绩汇总", text: text || title || "近七天业绩汇总" }
      };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.errcode !== 0) {
    return { ok: false, definiteFailure: res.ok && typeof data.errcode === "number" && data.errcode !== 0, error: "钉钉发送未确认成功" };
  }
  return { ok: true, data };
}
