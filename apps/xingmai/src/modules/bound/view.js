import {
  CHANNEL_CARDS,
  CHANNEL_COLUMNS,
  GOODS_CARDS,
  GOODS_COLUMNS,
  HP_CARDS,
  HP_COLUMNS,
  HP_STOCK_COLUMNS,
  MEMBER_COLUMNS,
  PAGES,
  SKILL_COLUMNS,
  STOCK_COLUMNS,
  START_ON,
  TEAM_CARDS,
  TEAM_COLUMNS,
  pageById,
  publicCatalog,
  tabById
} from "./catalog.js";
import { listMasters, listSheets, readMarks, readPref, writeMark, writePref } from "./persist.js";
import { shanghaiToday } from "./time.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const RATE_RE = /率|占比|rate|ratio/i;

function text(value, max) {
  const raw = String(value == null ? "" : value).trim();
  return raw.slice(0, max);
}

export function normalizeRange(query) {
  const today = shanghaiToday();
  let from = DATE_RE.test(String(query.from || "")) ? String(query.from) : today;
  let to = DATE_RE.test(String(query.to || "")) ? String(query.to) : from;
  if (from < START_ON) {
    from = START_ON;
  }
  if (to > today) {
    to = today;
  }
  if (from > to) {
    const swap = from;
    from = to;
    to = swap;
  }
  return { from, to };
}

function eachDay(from, to) {
  const days = [];
  let cursor = from;
  while (cursor <= to && days.length < 400) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

function addDays(iso, delta) {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function monthEnd(iso) {
  const [year, month] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month, 0));
  return date.toISOString().slice(0, 10);
}

function isFullMonth(from, to) {
  return from.endsWith("-01") && to === monthEnd(from) && from.slice(0, 7) === to.slice(0, 7);
}

const DAY_TYPES = new Set(["1", "7", "14", "30", "week", "month", "year", "quarter", "custom"]);

const PLATFORM_NAMES = {
  TM: "天猫",
  JD: "京东",
  DY: "抖音",
  PDD: "拼多多",
  TB: "淘宝",
  KS: "快手",
  XHS: "小红书",
  WX: "微信"
};

function daysTypeOf(raw, range) {
  const value = String(raw || "");
  if (DAY_TYPES.has(value)) {
    return value;
  }
  if (isFullMonth(range.from, range.to)) {
    return "month";
  }
  if (range.from === range.to) {
    return "1";
  }
  return "custom";
}

function ownValue(source, aliases) {
  const keys = Object.keys(source);
  for (const alias of aliases) {
    const key = keys.find((item) => item.toLowerCase() === alias.toLowerCase());
    const value = key ? source[key] : undefined;
    if (value != null && value !== "" && typeof value !== "object") {
      return value;
    }
  }
  return undefined;
}

function platformLabel(code) {
  const raw = String(code || "");
  if (!raw) {
    return "";
  }
  if (raw.toLowerCase() === "all") {
    return "全部";
  }
  return PLATFORM_NAMES[raw.toUpperCase()] || raw;
}

function latestReadyMonth(all, reportId, dim, today) {
  let best = null;
  all.forEach((row) => {
    if (row.reportId !== reportId || row.dim !== dim || row.pageNo !== 1 || row.status !== "done") {
      return;
    }
    if (!isFullMonth(row.startOn, row.endOn) || row.endOn > today) {
      return;
    }
    if (!best || row.startOn > best.startOn) {
      best = row;
    }
  });
  return best ? { from: best.startOn, to: best.endOn } : null;
}

function asNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() && !value.includes("%")) {
    const num = Number(value.replace(/,/g, ""));
    if (Number.isFinite(num)) {
      return num;
    }
  }
  return null;
}

function walk(node, visit, depth) {
  if (!node || depth > 3) {
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((item) => walk(item, visit, depth + 1));
    return;
  }
  if (typeof node === "object") {
    Object.entries(node).forEach(([key, value]) => {
      visit(key, value);
      if (value && typeof value === "object") {
        walk(value, visit, depth + 1);
      }
    });
  }
}

export function pickAlias(raw, aliases) {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const wanted = new Set(aliases.map((item) => item.toLowerCase()));
  let found;
  walk(raw, (key, value) => {
    if (found !== undefined) {
      return;
    }
    if (wanted.has(String(key).toLowerCase()) && value != null && typeof value !== "object") {
      found = value;
    }
  }, 0);
  return found;
}

function rowKeyOf(raw, index) {
  const id = pickAlias(raw, ["rowKey", "goodsId", "spuid", "skuId", "shopId", "userId", "id", "cateId"]);
  return id == null || id === "" ? `row-${index}` : String(id);
}

export function normalizeRow(raw, index) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : { value: raw };
  const metrics = {};
  GOODS_COLUMNS.forEach((column) => {
    const value = pickAlias(source, column.aliases);
    if (value != null && value !== "") {
      metrics[column.key] = column.numeric ? asNumber(value) ?? value : value;
    }
  });
  walk(source, (key, value) => {
    const num = asNumber(value);
    if (num == null || metrics[key] != null || RATE_RE.test(key)) {
      return;
    }
    if (typeof value === "number" || (typeof value === "string" && value.trim())) {
      metrics[key] = num;
    }
  }, 0);
  const children = []
    .concat(source.children || [], source.skuList || [], source.detailList || [])
    .filter((item) => item && typeof item === "object");
  const directName = ownValue(source, ["goodsName", "hpName", "channelName", "platformName", "cateName", "userName", "memberName", "styleName", "name", "title"]);
  const metricLabel = directName && /支付|预估|占比/.test(String(directName));
  const name = String((metricLabel ? "" : directName) || platformLabel(ownValue(source, ["platform"])) || directName || "");
  if (name) {
    metrics.name = name;
  }
  return {
    key: rowKeyOf(source, index),
    name,
    shop: String(metrics.shop || ""),
    owner: String(metrics.owner || ""),
    metrics,
    children: children.map((item, childIndex) => normalizeRow(item, childIndex)),
    raw: source
  };
}

function sheetsFor(all, reportId, dim, startOn, endOn) {
  return all.filter(
    (row) => row.reportId === reportId && row.dim === dim && row.startOn === startOn && row.endOn === endOn
  );
}

export function scopeStatus(pages) {
  const dataPages = pages.filter((row) => row.pageNo > 0);
  const first = dataPages.find((row) => row.pageNo === 1) || dataPages[0];
  if (!first) {
    return { status: "missing", error: "" };
  }
  if (first.status === "denied") {
    return { status: "denied", error: first.errorText || "当前账号没有这个菜单" };
  }
  if (first.status === "failed") {
    return { status: "failed", error: first.errorText || "采集失败" };
  }
  if (first.status !== "done") {
    return { status: "missing", error: "" };
  }
  if (first.kind === "object" || first.kind === "sum") {
    return { status: "ready", error: "" };
  }
  const pageSize = first.pageSize || 1;
  const need = first.totalRows === 0 ? 1 : Math.ceil(first.totalRows / pageSize);
  for (let page = 1; page <= need; page += 1) {
    const found = dataPages.find((row) => row.pageNo === page);
    if (!found || found.status === "failed") {
      return { status: found && found.status === "failed" ? "failed" : "missing", error: found ? found.errorText : "" };
    }
    if (found.status !== "done") {
      return { status: "missing", error: "" };
    }
  }
  return { status: "ready", error: "" };
}

function rowsOf(pages) {
  return pages
    .filter((row) => row.pageNo > 0 && row.status === "done")
    .sort((a, b) => a.pageNo - b.pageNo)
    .flatMap((row) => (Array.isArray(row.payload && row.payload.rows) ? row.payload.rows : []));
}

function sumRows(rows) {
  const totals = {};
  let saw = false;
  rows.forEach((row) => {
    Object.entries(row.metrics || {}).forEach(([key, value]) => {
      if (RATE_RE.test(key)) {
        return;
      }
      const num = asNumber(value);
      if (num == null) {
        return;
      }
      saw = true;
      totals[key] = (totals[key] || 0) + num;
    });
  });
  if (!saw) {
    return null;
  }
  const pay = totals.payAmount;
  const refund = totals.refundAmount;
  if (pay) {
    totals.refundRate = refund ? refund / pay : 0;
  }
  return totals;
}

function filterRows(rows, query) {
  const shop = text(query.shop, 80);
  const keyword = text(query.q, 80).toLowerCase();
  return rows.filter((row) => {
    if (shop && row.shop !== shop && String(pickAlias(row.raw, ["shopId"]) || "") !== shop) {
      return false;
    }
    if (!keyword) {
      return true;
    }
    const blob = `${row.name} ${row.shop} ${row.owner} ${row.key}`.toLowerCase();
    return blob.includes(keyword);
  });
}

function cardSource(page) {
  if (page && page.module === "hp") {
    return HP_CARDS;
  }
  return GOODS_CARDS;
}

function cardsFrom(payload, pref, page) {
  const defs = cardSource(page);
  const enabled = new Set((pref && pref.cards) || defs.map((card) => card.key));
  const source = payload && payload.raw ? payload.raw : payload;
  return defs.map((card) => {
    const value = source ? pickAlias(source, card.aliases.concat(card.label)) : undefined;
    return {
      key: card.key,
      label: card.label,
      on: enabled.has(card.key),
      value: value == null || value === "" ? null : value,
      rate: Boolean(card.rate),
      money: Boolean(card.money)
    };
  });
}

function columnSource(page) {
  if (page && page.id === "productStock") {
    return STOCK_COLUMNS;
  }
  if (page && page.id === "hpStock") {
    return HP_STOCK_COLUMNS;
  }
  if (page && page.id === "teamSkills") {
    return SKILL_COLUMNS;
  }
  if (page && page.id === "teamMemberProfile") {
    return MEMBER_COLUMNS;
  }
  if (page && page.module === "channel") {
    return CHANNEL_COLUMNS;
  }
  if (page && page.module === "team") {
    return TEAM_COLUMNS;
  }
  if (page && page.module === "hp") {
    return HP_COLUMNS;
  }
  return GOODS_COLUMNS;
}

function nameLabel(page, tab) {
  const tabLabel = tab && tab.label ? tab.label : "";
  if (page && page.module === "channel") {
    if (/店铺/.test(tabLabel)) {
      return "店铺";
    }
    if (/品类/.test(tabLabel)) {
      return "品类";
    }
    if (/商品|热销/.test(tabLabel)) {
      return "商品";
    }
    return "渠道";
  }
  if (page && page.module === "team") {
    return /成员|个人|客服/.test(tabLabel) ? "成员" : "名称";
  }
  if (page && page.module === "hp") {
    if (/品牌/.test(tabLabel)) {
      return "品牌";
    }
    if (/仓库/.test(tabLabel)) {
      return "仓库";
    }
    if (/款式/.test(tabLabel)) {
      return "款式";
    }
    if (/分类/.test(tabLabel)) {
      return "分类";
    }
    return "货品";
  }
  return "商品";
}

function columnsFrom(pref, page, tab) {
  const source = columnSource(page);
  const enabled = new Set((pref && pref.columns) || source.map((column) => column.key));
  return source.map((column, index) => ({
    key: column.key,
    label: index === 0 && column.key === "name" ? nameLabel(page, tab) : column.label,
    on: enabled.has(column.key),
    numeric: Boolean(column.numeric || column.money || column.rate),
    money: Boolean(column.money),
    rate: Boolean(column.rate),
    aliases: column.aliases || []
  }));
}

function metricCards(defs, source, ready) {
  return defs.map((card) => {
    const value = ready && source ? pickAlias(source, [card.key].concat(card.aliases || [])) : null;
    return {
      key: card.key,
      label: card.label,
      on: true,
      value: value == null || value === "" ? null : value,
      rate: Boolean(card.rate),
      money: Boolean(card.money),
      note: card.note || ""
    };
  });
}

async function loadScope(all, report, dim, from, to, daysType) {
  if (isFullMonth(from, to) && from.slice(0, 7) < shanghaiToday().slice(0, 7) && daysType !== "1") {
    const monthPages = sheetsFor(all, report.id, dim, from, to);
    const month = scopeStatus(monthPages);
    if (month.status === "ready" || month.status === "failed" || month.status === "denied") {
      return { mode: "month", status: month, pages: monthPages, missing: [], failed: month.status === "failed" ? [`${from}~${to}`] : [] };
    }
  }
  const days = eachDay(from, to);
  const missing = [];
  const failed = [];
  const denied = [];
  const pages = [];
  days.forEach((day) => {
    const found = sheetsFor(all, report.id, dim, day, day);
    const state = scopeStatus(found);
    if (state.status === "ready") {
      pages.push(...found);
    } else if (state.status === "failed") {
      failed.push(day);
    } else if (state.status === "denied") {
      denied.push(day);
    } else {
      missing.push(day);
    }
  });
  let status = "ready";
  if (denied.length && denied.length === days.length) {
    status = "denied";
  } else if (failed.length) {
    status = "failed";
  } else if (missing.length) {
    status = "missing";
  }
  return { mode: "day", status: { status, error: failed[0] ? "有日期采集失败" : "" }, pages, missing, failed, denied };
}

function shopOptions(rows, masters) {
  const names = new Set();
  masters.forEach((item) => {
    const name = pickAlias(item.payload, ["shopName", "name", "channelName"]);
    if (name) {
      names.add(String(name));
    }
  });
  rows.forEach((row) => {
    if (row.shop) {
      names.add(row.shop);
    }
  });
  return [...names];
}

export async function readView(query) {
  const page = pageById(text(query.page, 40));
  const tab = tabById(page, text(query.tab, 40));
  const requested = normalizeRange(query);
  const explicitFrom = DATE_RE.test(String(query.from || ""));
  let range = requested;
  let daysType = daysTypeOf(query.daysType, requested);
  const dim = tab && tab.dims && tab.dims.includes(query.dim) ? query.dim : (tab && tab.dims ? tab.dims[0] : "all");
  const view = ["list", "period", "gallery"].includes(query.view) ? query.view : "list";
  const pageNo = Math.max(1, Number(query.pageNo) || 1);
  const pageSize = Math.min(100, Math.max(10, Number(query.pageSize) || 20));
  const pref = await readPref(`page:${page.id}`);
  const all = await listSheets();
  let coverage = { status: "missing", mode: "day", missing: eachDay(range.from, range.to), failed: [], denied: [], error: "" };
  let rawRows = [];
  let sumPayload = null;
  if (page.local) {
    const masters = await listMasters(page.local);
    rawRows = masters.map((item) => item.payload);
    coverage = { status: masters.length ? "ready" : "missing", mode: "local", missing: [], failed: [], denied: [], error: "" };
  } else if (tab) {
    const trend = view === "period" ? (page.tabs || []).find((item) => item.id.endsWith("_trend")) : null;
    if (!explicitFrom) {
      const readyMonth = latestReadyMonth(all, (trend || tab).id, dim, shanghaiToday());
      if (readyMonth) {
        range = readyMonth;
        daysType = "month";
      }
    }
    const loaded = await loadScope(all, trend || tab, dim, range.from, range.to, daysType);
    coverage = { ...loaded.status, mode: loaded.mode, missing: loaded.missing, failed: loaded.failed, denied: loaded.denied || [] };
    rawRows = rowsOf(loaded.pages);
    const sumPage = loaded.pages.find((item) => item.pageNo === 0 && item.status === "done");
    sumPayload = sumPage ? sumPage.payload : null;
  }
  const normalized = rawRows.map((row, index) => normalizeRow(row, index));
  const filtered = filterRows(normalized, query);
  const marks = await readMarks(filtered.map((row) => row.key));
  const markMap = new Map(marks.map((item) => [item.rowKey, item]));
  filtered.forEach((row) => {
    const mark = markMap.get(row.key);
    row.follow = mark ? mark.follow : "";
    row.tag = mark ? mark.tag : "";
    row.target = mark ? mark.target : "";
  });
  const start = (pageNo - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);
  const complete = coverage.status === "ready";
  const pageSum = !complete && !slice.length ? null : sumRows(slice) || (complete || slice.length ? {} : null);
  let allSum = null;
  if (complete) {
    const fromSum = sumPayload && sumPayload.raw ? sumRows([normalizeRow(sumPayload.raw, 0)]) : null;
    allSum = fromSum || sumRows(filtered) || {};
  }
  const cardSheet = page.cards ? sheetsFor(all, page.cards.id, "all", range.from, range.to) : [];
  const cardDay = page.cards && !cardSheet.length ? sheetsFor(all, page.cards.id, "all", range.to, range.to) : [];
  const cardPage = (cardSheet[0] && cardSheet[0].status === "done" && cardSheet[0]) || (cardDay[0] && cardDay[0].status === "done" && cardDay[0]) || null;
  const shops = shopOptions(normalized, await listMasters("shops"));
  return {
    ok: true,
    module: "bound",
    source: "crawler",
    erp: false,
    demo: false,
    label: "爬虫，非 ERP",
    page: { id: page.id, label: page.label, ops: page.ops, module: page.module },
    tab: tab ? { id: tab.id, label: tab.label, dims: tab.dims } : null,
    tabs: (page.tabs || []).filter((item) => !item.id.endsWith("_trend") || item.id === (tab && tab.id)).map((item) => ({
      id: item.id,
      label: item.label,
      group: item.group || ""
    })).filter((item) => item.id !== "sp_zl_trend"),
    range,
    daysType,
    dim,
    view,
    shops,
    columns: columnsFrom(pref, page, tab),
    cards: page.ops.includes("cards")
      ? cardsFrom(cardPage && cardPage.payload, pref, page)
      : metricCards(page.module === "channel" ? CHANNEL_CARDS : page.module === "team" ? TEAM_CARDS : page.module === "hp" ? HP_CARDS : [], complete ? allSum : null, complete),
    cardStatus: page.ops.includes("cards") ? (cardPage ? "ready" : "missing") : complete ? "ready" : "missing",
    coverage,
    rows: slice.map((row) => ({
      key: row.key,
      name: row.name,
      shop: row.shop,
      owner: row.owner,
      metrics: row.metrics,
      follow: row.follow,
      tag: row.tag,
      target: row.target,
      children: row.children,
      fields: Object.entries(row.raw || {})
        .filter(([, value]) => value == null || typeof value !== "object")
        .slice(0, 40)
        .map(([key, value]) => ({ key, value }))
    })),
    total: filtered.length,
    pageNo,
    pageSize,
    pageSum: complete || slice.length ? pageSum : null,
    allSum,
    sumNote: complete
      ? coverage.mode === "day"
        ? "全部汇总按已入库日明细相加。人数和比率不是旧站整段去重口径；整月查询优先用整月快照。"
        : "全部汇总来自这一整段已入库的快照。"
      : "这段还没采完或采集失败，汇总留空，不会显示成 0。"
  };
}

export async function savePagePref(body) {
  const page = pageById(text(body.page, 40));
  const current = (await readPref(`page:${page.id}`)) || {};
  const next = {
    cards: Array.isArray(body.cards) ? body.cards.map((item) => text(item, 40)).filter(Boolean) : current.cards,
    columns: Array.isArray(body.columns) ? body.columns.map((item) => text(item, 40)).filter(Boolean) : current.columns
  };
  await writePref(`page:${page.id}`, next);
  return { ok: true, module: "bound", source: "crawler", erp: false, page: page.id, pref: next };
}

export async function saveRowMark(body) {
  const rowKey = text(body.rowKey, 180);
  if (!rowKey) {
    return { ok: false, statusCode: 400, error: "缺少行标识" };
  }
  const saved = await writeMark(rowKey, {
    follow: text(body.follow, 500),
    tag: text(body.tag, 128),
    target: text(body.target, 128)
  });
  return { ok: true, module: "bound", source: "crawler", erp: false, rowKey, mark: saved };
}

function csvCell(value) {
  const textValue = value == null ? "" : String(value);
  return `"${textValue.replace(/"/g, '""')}"`;
}

export async function exportView(query) {
  const full = await readView({ ...query, pageNo: 1, pageSize: 100 });
  const all = [...full.rows];
  const pages = Math.max(1, Math.ceil(full.total / 100));
  for (let page = 2; page <= pages; page += 1) {
    const chunk = await readView({ ...query, pageNo: page, pageSize: 100 });
    all.push(...chunk.rows);
  }
  const view = full;
  const columns = view.columns.filter((column) => column.on);
  const header = ["状态", ...columns.map((column) => column.label), "跟进", "打标", "目标"];
  const lines = [
    `# status=${view.coverage.status}`,
    `# ${view.sumNote}`,
    header.map(csvCell).join(",")
  ];
  all.forEach((row) => {
    lines.push(
      [view.coverage.status, ...columns.map((column) => row.metrics[column.key] ?? ""), row.follow, row.tag, row.target]
        .map(csvCell)
        .join(",")
    );
  });
  return { filename: `${view.page.id}-${view.range.from}-${view.range.to}.csv`, body: `\uFEFF${lines.join("\n")}` };
}

export function catalogBody() {
  return publicCatalog();
}

export async function coverageBody() {
  const all = await listSheets();
  const today = shanghaiToday();
  const reports = [];
  PAGES.forEach((page) => {
    (page.tabs || []).forEach((tab) => {
      (tab.dims || ["all"]).forEach((dim) => {
        const mine = all.filter((row) => row.reportId === tab.id && row.dim === dim && row.pageNo > 0);
        const ready = [];
        const failed = [];
        const groups = new Map();
        mine.forEach((row) => {
          const key = `${row.startOn}|${row.endOn}`;
          if (!groups.has(key)) {
            groups.set(key, []);
          }
          groups.get(key).push(row);
        });
        groups.forEach((pages, key) => {
          const [startOn, endOn] = key.split("|");
          const state = scopeStatus(pages);
          if (state.status === "ready") {
            ready.push(startOn === endOn ? startOn : `${startOn}~${endOn}`);
          } else if (state.status === "failed") {
            failed.push(startOn);
          }
        });
        ready.sort();
        if (ready.length || failed.length) {
          reports.push({
            id: tab.id,
            dim,
            page: page.label,
            tab: tab.label,
            ready,
            failed,
            readyFrom: ready[0] || "",
            readyTo: ready[ready.length - 1] || ""
          });
        }
      });
    });
  });
  return {
    ok: true,
    module: "bound",
    source: "crawler",
    erp: false,
    startOn: START_ON,
    today,
    reports
  };
}
