import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { setTimeout, clearTimeout } from "node:timers";
import { atomicJson, readWpsConfig, wpsConfigPath, wpsStorePath, cliPath } from "./week-storage.js";
import { cliRead, syncWpsOnce } from "./week-wps-sync.js";
import { readWpsStore, writeWpsStore } from "./week-wps.js";
import { prepareWpsRuntime } from "./week-wps-runtime.js";

const execute = promisify(execFile);
export function validateWpsUrl(value) {
  let url;
  try { url = new URL(String(value).trim()); } catch { throw new Error("请填写有效的 WPS 共享链接"); }
  if (url.protocol !== "https:" || !["www.kdocs.cn", "kdocs.cn"].includes(url.hostname) || url.port || url.username || url.password || !/^\/l\/[A-Za-z0-9]+$/.test(url.pathname)) throw new Error("请使用 https://www.kdocs.cn/l/ 开头的 WPS 个人文档链接");
  return `${url.origin}${url.pathname}`;
}
export function parseIndexes(value, columns = false) {
  if (!String(value || "").trim()) return [];
  const result = new Set();
  const number = item => {
    if (columns && /^[A-Z]+$/i.test(item)) return [...item.toUpperCase()].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
    if (!/^\d+$/.test(item)) throw new Error("读取范围格式不正确");
    return Number(item) - 1;
  };
  for (const item of String(value).replace(/，/g, ",").split(",")) {
    const parts = item.trim().split(/[:-]/);
    if (parts.length > 2) throw new Error("读取范围格式不正确");
    const start = number(parts[0]), end = parts.length === 2 ? number(parts[1]) : start;
    if (start < 0 || end < start || end >= (columns ? 16384 : 10000) || end - start > 2000) throw new Error("读取范围过大或无效");
    for (let n = start; n <= end; n++) result.add(n);
  }
  if (result.size > (columns ? 700 : 1000)) throw new Error("请缩小读取范围");
  return [...result].sort((a, b) => a - b);
}
export function formatIndexes(values, columns = false) {
  const label = n => {
    if (!columns) return String(n + 1);
    let text = "";
    for (n++; n; n = Math.floor((n - 1) / 26)) text = String.fromCharCode(65 + (n - 1) % 26) + text;
    return text;
  };
  const groups = [];
  for (const n of [...new Set(values || [])].sort((a, b) => a - b)) {
    const last = groups.at(-1);
    if (last && last[1] + 1 === n) last[1] = n; else groups.push([n, n]);
  }
  return groups.map(([a, b]) => a === b ? label(a) : `${label(a)}-${label(b)}`).join(",");
}
export function publicWpsConfig(config = readWpsConfig()) {
  return { accountLabel: config.accountLabel || "", updatedAt: config.updatedAt || "",
    sources: ["han", "shen"].map(team => {
      const s = config.sources.find(s => s.team === team) || {}, v = s.visibility || {};
      return { team, url: s.url || "", sheetName: s.sheetName || "近七天业绩", headerRow: (v.headerRow ?? 1) + 1,
        rows: formatIndexes(v.rows), columns: formatIndexes(v.columns, true), footerRows: formatIndexes(v.footerRows),
        summaryRows: formatIndexes(v.summary?.rows), summaryLabelColumn: formatIndexes(v.summary ? [v.summary.labelColumn] : [], true),
        summaryValueColumn: formatIndexes(v.summary ? [v.summary.valueColumn] : [], true), verified: v.verified === true };
    }) };
}
export function saveWpsConfig(input) {
  const previous = readWpsConfig();
  if (!Array.isArray(input.sources) || input.sources.length !== 2 || input.sources.some(s => !["han", "shen"].includes(s.team)) || new Set(input.sources.map(s => s.team)).size !== 2) throw new Error("请分别配置韩梦凯组和沈子晗组");
  const sources = input.sources.filter(s => String(s.url || "").trim()).map(s => {
    if (!["han", "shen"].includes(s.team)) throw new Error("未知团队");
    const old = previous.sources.find(p => p.team === s.team);
    const url = validateWpsUrl(s.url), sheetName = String(s.sheetName || "").trim();
    if (!sheetName || sheetName.length > 100) throw new Error("请填写工作表名称");
    const headerRow = Number(s.headerRow) - 1;
    if (!Number.isInteger(headerRow) || headerRow < 0 || headerRow > 999) throw new Error("表头行不正确");
    const rows = parseIndexes(s.rows), columns = parseIndexes(s.columns, true), footerRows = parseIndexes(s.footerRows);
    if (rows.includes(headerRow) || footerRows.includes(headerRow) || rows.some(r => footerRows.includes(r))) throw new Error("表头、店铺行和分类汇总行不能重叠");
    const visibility = { headerRow, rows, columns, footerRows, mode: "configured-visible-ranges", verified: Boolean(s.verified && rows.length && columns.length) };
    if (s.summaryRows || s.summaryLabelColumn || s.summaryValueColumn) {
      const summaryRows = parseIndexes(s.summaryRows), labels = parseIndexes(s.summaryLabelColumn, true), values = parseIndexes(s.summaryValueColumn, true);
      if (!summaryRows.length || labels.length !== 1 || values.length !== 1 || labels[0] === values[0] || summaryRows.some(r => !rows.includes(r)) || !columns.includes(labels[0]) || !columns.includes(values[0])) throw new Error("左侧汇总范围必须包含在读取行列内");
      visibility.summary = { rows: summaryRows, labelColumn: labels[0], valueColumn: values[0] };
    }
    return { team: s.team, url, sheetName, visibility, ...(old?.url === url && old?.sheetName === sheetName ? { expectedHeaders: old.expectedHeaders } : {}) };
  });
  const config = { ...previous, accountLabel: String(input.accountLabel || "").trim().slice(0, 80), sources,
    expectedTeams: ["han", "shen"], updatedAt: new Date().toISOString() };
  if (JSON.stringify(previous.sources) !== JSON.stringify(sources)) invalidateSnapshot(sources.map(s => s.team));
  atomicJson(wpsConfigPath(), config);
  return publicWpsConfig(config);
}
function invalidateSnapshot(teams) {
  const state = readWpsStore(wpsStorePath());
  if (!state?.teams) return;
  if (teams) for (const team of Object.keys(state.teams)) if (!teams.includes(team)) delete state.teams[team];
  for (const team of Object.values(state.teams)) { team.status = "error"; team.complete = false; }
  state.error = "配置或账号已变更，请重新同步后再发送";
  writeWpsStore(wpsStorePath(), state);
}
export function createWpsService({ exec = execute, launch = spawn, prepare = prepareWpsRuntime,
  read = async (service, action, args) => { await prepare(); return cliRead(cliPath(), service, action, args); } } = {}) {
  let auth = null, authChild = null, syncing = false;
  const view = () => auth ? { id: auth.id, status: auth.status, url: auth.url, message: auth.message } : { status: "idle" };
  return {
    busy: () => syncing || Boolean(authChild),
    async status() {
      try {
        await prepare();
        const { stdout } = await exec(cliPath(), ["auth", "status"], { windowsHide: true, timeout: 15000, maxBuffer: 64000 });
        const data = JSON.parse(stdout);
        return { authenticated: data.authenticated === true, message: data.authenticated === true ? "已授权，可检查两张表的读取权限" : "尚未授权，请连接 WPS 账号" };
      } catch { return { authenticated: false, message: "授权未就绪，请检查服务器是否安装 WPS 连接工具并完成授权" }; }
    },
    authState: view,
    async startAuth() {
      await prepare();
      if (syncing) throw new Error("正在同步，请完成后再更换账号");
      if (authChild) return view();
      invalidateSnapshot();
      auth = { id: randomUUID(), status: "starting", url: "", message: "正在生成 WPS 官方授权链接" };
      let child;
      try { child = launch(cliPath(), ["auth", "login"], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }); }
      catch { auth.status = "error"; auth.message = "无法启动授权，请检查服务器上的 WPS 连接工具"; return view(); }
      authChild = child;
      const attempt = auth;
      let tail = "", finished = false;
      // CLI can print the token. Never log, persist or return its raw output.
      const collect = chunk => {
        tail = (tail + chunk.toString()).slice(-4096);
        const match = tail.match(/https:\/\/mcp-center\.wps\.cn\/kdocs-auth\/auth-guide\?auth_code=[A-Za-z0-9-]+/);
        if (match) { attempt.url = match[0]; attempt.status = "waiting"; attempt.message = "请在 WPS 官方页面选择有两张表权限的账号并确认授权"; }
      };
      child.stdout.on("data", collect); child.stderr.on("data", collect);
      const timeout = setTimeout(() => { child.kill(); }, 310000);
      timeout.unref?.();
      const finish = async code => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout); tail = ""; authChild = null;
        const status = code === 0 ? await this.status() : { authenticated: false };
        attempt.url = ""; attempt.status = status.authenticated ? "authorized" : "error";
        attempt.message = status.authenticated ? "授权已完成，请检查表格读取权限" : "授权未完成或已过期，可以重新连接";
      };
      child.once("error", () => { void finish(1); }); child.once("close", code => { void finish(code); });
      return view();
    },
    async check(source) {
      const url = validateWpsUrl(source.url);
      await read("drive", "get-file-info", { url });
      const info = await read("sheet", "get-sheets-info", { url });
      const sheets = (info.detail?.sheetsInfo || info.sheetsInfo || []).filter(s => s.isVisible !== false).map(s => s.sheetName);
      if (!sheets.includes(source.sheetName)) throw new Error("有文档读取权限，但未找到指定工作表，请核对名称");
      return { ok: true, sheets, message: "读取权限正常，已找到工作表" };
    },
    async sync() {
      if (syncing || authChild) throw new Error("正在同步或授权，请稍后再试");
      syncing = true;
      try {
        const config = readWpsConfig();
        return await syncWpsOnce({ ...config, cli: cliPath(), store: wpsStorePath(), testOnly: process.env.HOME_WEEK_TEST_ONLY === "1" }, { call: read });
      } finally { syncing = false; }
    }
  };
}
