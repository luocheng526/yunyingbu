/** Read-only CLI runner. No WPS writes, website deployment, or message sends. */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { chinaDay, parseWpsReport, readWpsStore, writeWpsStore } from "./week-wps.js";

const execute = promisify(execFile);

function rangeCells(response) {
  if (response?.result !== "ok" || !Object.hasOwn(response.detail || {}, "rangeData")) throw new Error("WPS 返回了不完整的单元格响应");
  // WPS explicitly returns null for a successfully read, entirely empty range.
  if (response.detail.rangeData === null) return [];
  if (!Array.isArray(response.detail.rangeData)) throw new Error("WPS 单元格响应格式无效");
  return response.detail.rangeData;
}

export function contiguous(values) {
  const groups = [];
  for (const n of [...new Set(values)].sort((a, b) => a - b)) {
    if (!Number.isInteger(n) || n < 0) throw new Error("行列索引无效");
    const last = groups.at(-1);
    if (last && last[1] + 1 === n) last[1] = n;
    else groups.push([n, n]);
  }
  return groups;
}

export async function cliRead(executable, service, action, params) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "home-wps-read-"));
  try {
    const input = path.join(dir, "request.json");
    await fs.writeFile(input, JSON.stringify(params));
    const { stdout } = await execute(executable, [service, action, "--file", input], { windowsHide: true, timeout: 60000, maxBuffer: 16 * 1024 * 1024 });
    return JSON.parse(stdout);
  } catch {
    // CLI errors may include signed URLs. Keep credentials and server responses out of UI/logs.
    throw new Error(`WPS ${service}/${action} 读取失败，请检查本机授权和文档权限`);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
}

export async function readSource(source, call, today) {
  const locate = { url: source.url };
  const before = await call("drive", "get-file-info", locate);
  const info = await call("sheet", "get-sheets-info", locate);
  const sheets = info.detail?.sheetsInfo || info.sheetsInfo;
  const sheet = sheets?.find(s => s.sheetName === source.sheetName);
  if (!sheet || sheet.isVisible === false) throw new Error("找不到指定的可见工作表");
  let visibility = source.visibility;
  if (!visibility?.columns?.length || !visibility?.rows?.length) throw new Error("没有可见行列范围，拒绝全表读取");
  if (Math.max(...visibility.columns) > sheet.colTo || Math.max(...visibility.rows, ...(visibility.footerRows || []), visibility.headerRow) > sheet.rowTo) throw new Error("原表范围已变化，请重新核对可见范围");
  const cells = [];
  // Read headers before data: registration is the hard stop, even if a stale
  // configuration still contains columns to its right.
  for (const [colFrom, colTo] of contiguous(visibility.columns)) {
    const response = await call("sheet", "get-range-data", { ...locate, worksheet_id: sheet.sheetId,
      range: { rowFrom: visibility.headerRow, rowTo: visibility.headerRow, colFrom, colTo } });
    cells.push(...rangeCells(response));
  }
  const registrations = cells.filter(c => String(c.cellText || "").replace(/\s/g, "") === "登记日期");
  if (registrations.length !== 1) throw new Error("无法唯一识别登记日期列");
  visibility = { ...visibility, columns: visibility.columns.filter(c => c <= registrations[0].colFrom) };
  for (const [rowFrom, rowTo] of contiguous([...visibility.rows, ...(visibility.footerRows || [])])) {
    for (const [colFrom, colTo] of contiguous(visibility.columns)) {
      const response = await call("sheet", "get-range-data", { ...locate, worksheet_id: sheet.sheetId, range: { rowFrom, rowTo, colFrom, colTo } });
      cells.push(...rangeCells(response));
    }
  }
  const after = await call("drive", "get-file-info", locate);
  const version = before.version ?? before.file?.version;
  if (version == null || version !== (after.version ?? after.file?.version)) throw new Error("读取期间原表发生修改，本次不替换快照，请重试");
  const parsed = parseWpsReport({ cells, visibility, today, team: source.team, sheetName: sheet.sheetName, version });
  if (source.expectedHeaders) {
    for (const [index, label] of Object.entries(source.expectedHeaders)) {
      if (parsed.columns.find(c => c.sourceCol === Number(index))?.label !== label) throw new Error(`表头位置变化：${label}，请重新核对可见范围`);
    }
  }
  return parsed;
}

export async function syncWpsOnce(config, { call, today = chinaDay() } = {}) {
  if (!config.store || !Array.isArray(config.sources) || !config.sources.length) throw new Error("缺少同步配置");
  const previous = readWpsStore(config.store);
  const teams = {};
  const expectedTeams = config.expectedTeams || ["han", "shen"];
  const configured = new Set();
  for (const source of config.sources) {
    if (configured.has(source.team)) throw new Error("一个团队只能配置一张源表");
    configured.add(source.team);
    if (previous?.teams?.[source.team]) teams[source.team] = previous.teams[source.team];
  }
  const read = call || ((service, action, args) => cliRead(config.cli, service, action, args));
  const failures = [];
  for (const source of config.sources) {
    try { teams[source.team] = await readSource(source, read, today); }
    catch (err) {
      failures.push({ team: source.team, message: err.message });
      if (teams[source.team]) teams[source.team] = { ...teams[source.team], status: "error", complete: false };
    }
  }
  const state = { schema: 1, expectedTeams, testOnly: config.testOnly !== false, teams, failures,
    error: failures.length ? "部分源表读取失败" : "", updatedAt: new Date().toISOString() };
  writeWpsStore(config.store, state);
  return state;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const config = JSON.parse(await fs.readFile(process.argv[2], "utf8"));
    const state = await syncWpsOnce(config);
    console.log(JSON.stringify({ ok: !state.error, failures: state.failures, teams: Object.values(state.teams).map(s => ({ team: s.team, counts: s.counts, businessDate: s.businessDate, complete: s.complete })) }, null, 2));
    if (state.error) process.exitCode = 1;
  } catch (err) { console.error(err.message); process.exitCode = 1; }
}
