/** WPS daily report: read-only input, per-shop registration gate, isolated snapshots. */
import fs from "node:fs";
import { wpsStorePath, wpsEnabled } from "./week-storage.js";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { buildGrandSummary, reportNumber, sumReportCells } from "./week-totals.js";

export function chinaDay(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function registrationDay(value, today) {
  const text = String(value ?? "").trim();
  const m = text.match(/^(?:(\d{4})[年./-])?(\d{1,2})[月./-](\d{1,2})(?:日|号)?$/);
  if (!m) return null;
  const year = Number(m[1] || today.slice(0, 4)), month = Number(m[2]), day = Number(m[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function businessDay(label, today) {
  let day = registrationDay(label, today);
  // A visible December column in January belongs to the preceding year.
  if (day && day > today) day = registrationDay(`${Number(today.slice(0, 4)) - 1}.${label}`, today);
  return day;
}

const FIELDS = {
  "拿店日期": "takeDate", "当月职级": "rank", "所属人": "owner", "店铺阶段": "stage",
  "店铺": "shop", "店铺名称": "shop", "当月费比": "monthFee", "访客数": "visitors",
  "订单数": "orders", "店铺上新数": "newSku", "在售": "onSale", "京仓SPU个数": "jingcang",
  "近15天退货率": "ret15", "近30天退货率": "ret30", "本月推广总费用": "monthSpend",
  "登记日期": "register", "店铺星级": "stars", "客服咨询": "service", "物流履约": "logistics",
  "售后服务": "afterSale", "商品体验": "experience", "保险截图": "insuranceImage", "是否有新增保险": "insuranceNew"
};

export function sourceColumn(label, index, today, categoryIndex = 0) {
  const clean = String(label || "").replace(/\s+/g, "");
  let key = FIELDS[clean], group = "ops", ymd;
  if (clean === "店铺所在类目") key = categoryIndex ? "cat2" : "cat";
  if (/^\d+月职级$/.test(clean)) key = "rank";
  if (/^(?:\d+月)?面板总业绩$/.test(clean)) key = "panel";
  const date = clean.match(/^(\d{1,2}\.\d{1,2})(?:号)?(.*)$/);
  if (date && !date[2].startsWith("-")) {
    ymd = businessDay(date[1], today);
    if (!date[2]) { key = `gmv_${ymd}`; group = "gmv"; }
    else if (/^推广费用?$/.test(date[2])) { key = `fee_${ymd}`; group = "fee"; }
    else if (/^(?:付费占比|推广费(?:用)?占比)$/.test(date[2])) { key = `feeRate_${ymd}`; group = "feeRate"; }
    else if (/2星以下数量$/.test(date[2])) key = `lowStars_${ymd}`;
  }
  if (/利润|毛利率/.test(clean)) {
    key = `period_${clean}`;
    group = /率/.test(clean) ? "margin" : "profit";
  }
  if (["takeDate", "rank", "owner", "stage", "shop"].includes(key)) group = "id";
  if (key === "cat") group = "cat";
  if (key === "monthFee") group = "feeRate";
  return { key: key || `wps_${index}_${clean}`, label: String(label).trim(), sourceCol: index,
    group, ...(ymd ? { ymd } : {}), w: key === "shop" ? 170 : ["owner", "stage"].includes(key) ? 110 : 74, edit: false };
}

export function parseWpsReport({ cells, visibility, today = chinaDay(), team, sheetName, fetchedAt = new Date().toISOString(), version = null }) {
  if (!["han", "shen"].includes(team)) throw new Error("未知团队");
  if (!Array.isArray(cells) || !visibility?.columns?.length || !visibility?.rows?.length) throw new Error("缺少可见行列范围，停止导入");
  const visibleCols = new Set(visibility.columns), visibleRows = new Set(visibility.rows);
  const footerRows = new Set(visibility.footerRows || []);
  const grid = new Map(cells.filter(c => visibleCols.has(c.colFrom) && (visibleRows.has(c.rowFrom) || footerRows.has(c.rowFrom) || c.rowFrom === visibility.headerRow))
    .map(c => [`${c.rowFrom}:${c.colFrom}`, c]));
  const get = (r, c) => grid.get(`${r}:${c}`);
  const registrationColumns = [...visibleCols].filter(c => String(get(visibility.headerRow, c)?.cellText || "").replace(/\s/g, "") === "登记日期");
  if (registrationColumns.length !== 1) throw new Error("无法唯一识别可见表头：register");
  const cutoff = registrationColumns[0];
  const summary = visibility.summary;
  const sourceSummary = summary ? summary.rows.filter(r => visibleRows.has(r)).flatMap(r => {
    const label = String(get(r, summary.labelColumn)?.cellText || "").trim();
    const value = String(get(r, summary.valueColumn)?.cellText ?? "").trim();
    return label ? [{ label, value, sourceRow: r + 1 }] : [];
  }) : [];
  let category = 0;
  const columns = [...visibleCols].filter(c => c <= cutoff && (!summary || ![summary.labelColumn, summary.valueColumn].includes(c))).sort((a, b) => a - b).flatMap(c => {
    const label = get(visibility.headerRow, c)?.cellText?.trim();
    if (!label) return [];
    return [sourceColumn(label, c, today, label.replace(/\s/g, "") === "店铺所在类目" ? category++ : 0)];
  });
  for (const key of ["shop", "register"]) if (columns.filter(c => c.key === key).length !== 1) throw new Error(`无法唯一识别可见表头：${key}`);
  const keys = new Set();
  for (const col of columns) {
    if (keys.has(col.key)) throw new Error(`可见表头重复：${col.label}`);
    keys.add(col.key);
  }
  const shopCol = columns.find(c => c.key === "shop").sourceCol;
  const regCol = columns.find(c => c.key === "register").sourceCol;
  const sourceGroups = {};
  for (const r of footerRows) {
    const label = String(get(r, shopCol)?.cellText || "").trim();
    const kind = /^无清洁/.test(label) ? "noclean" : /^清洁/.test(label) ? "clean" : null;
    if (!kind) continue;
    if (sourceGroups[kind]) throw new Error(`原表分类汇总行重复：${label}`);
    const values = Object.fromEntries(columns.filter(col => !["id", "cat"].includes(col.group))
      .map(col => [col.key, String(get(r, col.sourceCol)?.cellText ?? "").trim()]));
    const available = columns.some(col => ["gmv", "fee", "profit"].includes(col.group) && reportNumber(values[col.key]) !== null);
    sourceGroups[kind] = { label, sourceRow: r + 1, cells: values, available };
  }
  const rows = [], pending = [], issues = [], seen = new Set();
  for (const r of [...visibleRows].sort((a, b) => a - b)) {
    const shop = String(get(r, shopCol)?.cellText || "").trim();
    if (!shop || /(?:合计|汇总|统计|近七天业绩|近7天业绩|^清洁店铺$)/.test(shop)) continue;
    if (seen.has(shop)) throw new Error(`重复店铺：${shop}`);
    seen.add(shop);
    const register = String(get(r, regCol)?.cellText || "").trim();
    if (registrationDay(register, today) !== today) {
      pending.push({ shop, sourceRow: r + 1, register, reason: register ? "登记日期非当天或格式无效" : "未登记" });
      continue;
    }
    const values = {};
    for (const col of columns) {
      const cell = get(r, col.sourceCol);
      values[col.key] = cell?.isCellPic ? "[原表图片待接入]" : String(cell?.cellText ?? "").trim();
      if (cell?.isCellPic || /^#(?:DIV\/0!|VALUE!|REF!|N\/A|NAME\?|NUM!|SPILL!|CALC!)/.test(values[col.key])) {
        issues.push({ shop, sourceRow: r + 1, column: col.label, kind: cell?.isCellPic ? "image" : "formula", value: values[col.key] });
      }
    }
    rows.push({ shop, cells: values, source: "wps", sourceRow: r + 1, registeredOn: today });
  }
  const businessDate = columns.filter(c => c.group === "gmv").map(c => c.ymd).sort().at(-1) || "";
  const fingerprint = createHash("sha256").update(JSON.stringify({ columns, rows, pending, issues, sourceSummary, sourceGroups })).digest("hex");
  return { team, sheetName, today, businessDate, fetchedAt, version, columns, rows, pending, issues, sourceSummary, sourceGroups, fingerprint,
    visibility: { mode: visibility.mode, verified: visibility.verified === true },
    status: "ok", complete: seen.size > 0 && pending.length === 0 && !issues.some(i => i.kind === "image") && visibility.verified === true,
    counts: { expected: seen.size, synced: rows.length, pending: pending.length, issues: issues.length } };
}

export function readWpsStore(file = wpsEnabled() ? wpsStorePath() : null) {
  if (!file) return null;
  try {
    const state = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!state.teams || !Array.isArray(state.expectedTeams)) throw new Error("快照格式无效");
    return state;
  } catch (err) { return { teams: {}, expectedTeams: ["han", "shen"], error: err.code === "ENOENT" ? "尚未同步" : "同步快照无法读取" }; }
}

export function writeWpsStore(file, state) {
  if (!file) throw new Error("必须指定本地 WPS 快照文件");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(state, null, 2));
  fs.renameSync(temp, file);
}

function numeric(value) {
  if (value == null || value === "" || /[%#]/.test(String(value))) return null;
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function wpsTeam(snapshot, meta, today) {
  const fresh = snapshot?.today === today;
  const rows = fresh ? snapshot.rows : [];
  const businessDate = snapshot?.businessDate || "";
  const sum = key => rows.reduce((total, row) => total + (numeric(row.cells[key]) ?? 0), 0);
  const totals = sumReportCells(rows, snapshot?.columns || []);
  const status = !snapshot ? "未接入" : !fresh ? "等待今日登记" : snapshot.status === "error" ? "同步失败，显示上次成功结果" : "已读取";
  return { ...meta, rows, sourceSummary: fresh ? snapshot.sourceSummary || [] : [],
    sourceGroups: fresh ? snapshot.sourceGroups || {} : {},
    groupTotalsEligible: fresh && snapshot.status === "ok" && snapshot.rows.length > 0 && snapshot.pending.length === 0,
    readonly: true, sync: { status, counts: fresh ? snapshot.counts : null,
    fetchedAt: snapshot?.fetchedAt, businessDate, pending: fresh ? snapshot.pending : [], issues: fresh ? snapshot.issues : [],
    visibility: snapshot?.visibility, complete: fresh && snapshot.status === "ok" && snapshot.complete === true },
    kpis: [{ key: "total", label: businessDate ? `${businessDate.slice(5).replace("-", ".")}业绩` : "业绩", value: rows.length ? sum(`gmv_${businessDate}`) : "" },
      { key: "shops", label: "已同步店铺", value: rows.length }, { key: "orders", label: "订单数", value: rows.length ? sum("orders") : "" }],
    foot: [{ key: "fine", kind: "fine", label: "已同步店铺合计", cells: totals }] };
}

export function applyWpsPack(pack, state, today) {
  if (!state) return pack;
  const snapshots = Object.values(state.teams);
  const columns = new Map();
  for (const snapshot of snapshots) for (const col of snapshot.columns || []) if (!columns.has(col.key)) columns.set(col.key, col);
  const teams = pack.teams.map(meta => wpsTeam(state.teams[meta.key], { key: meta.key, label: meta.label, totalLabel: meta.totalLabel }, today));
  const grandSummary = buildGrandSummary(teams, [...columns.values()], state.expectedTeams, today);
  const ready = !state.error && grandSummary.complete && state.expectedTeams.length > 0 && state.expectedTeams.every(key => teams.find(t => t.key === key)?.sync.complete);
  return { ...pack, columns: [...columns.values()], days: [...columns.values()].filter(c => c.group === "gmv").map(c => ({ ymd: c.ymd, label: c.label })),
    teams, grandSummary, source: "wps", registrationDate: today, readyToSend: ready, dingReady: pack.dingReady && ready,
    sync: { ready, expectedTeams: state.expectedTeams, error: state.error || "", testOnly: state.testOnly !== false },
    note: `按店铺登记日期 ${today} 读取。${snapshots.some(s => !s.visibility?.verified) ? "本地测试按截图可见范围读取；自动识别隐藏状态尚未接通。" : "隐藏行列已排除。"}仅在全部团队数据完整后发送。` };
}
