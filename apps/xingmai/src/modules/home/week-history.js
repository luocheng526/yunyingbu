import fs from "node:fs";
import path from "node:path";
import { Buffer } from "node:buffer";
import { createHash, randomUUID, randomBytes } from "node:crypto";
import { atomicJson, weekDataDir } from "./week-storage.js";
import { exportWeekXlsx } from "./week-export.js";

const directory = () => path.join(weekDataDir(), "history");
function location(id) { if (!/^[a-f0-9-]{36}$/.test(id || "")) throw new Error("历史记录不存在"); return path.join(directory(), id); }
export function reportRevision(pack) {
  return createHash("sha256").update(JSON.stringify({ date: pack.registrationDate || pack.ymd, title: pack.title, columns: pack.columns,
    teams: pack.teams.map(t => ({ key: t.key, label: t.label, rows: t.rows, foot: t.foot, sourceSummary: t.sourceSummary, kpis: t.kpis })), grandSummary: pack.grandSummary })).digest("hex");
}
function metadata(id) { return JSON.parse(fs.readFileSync(path.join(location(id), "meta.json"), "utf8")); }
export function listWeekHistory({ from = "", to = "" } = {}) {
  if ((from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) || (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) || (from && to && from > to)) throw new Error("日期范围不正确");
  if (!fs.existsSync(directory())) return [];
  return fs.readdirSync(directory()).filter(id => /^[a-f0-9-]{36}$/.test(id)).flatMap(id => {
    try { const m = metadata(id); return (!from || m.date >= from) && (!to || m.date <= to) ? [m] : []; } catch { return []; }
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(m => { delete m.imageToken; return m; });
}
export function readWeekHistory(id) {
  const m = metadata(id);
  const pack = JSON.parse(fs.readFileSync(path.join(location(id), "table.json"), "utf8"));
  delete m.imageToken;
  return { meta: m, pack: { ...pack, historical: true } };
}
export function historyFile(id, type) {
  if (!["png", "xlsx"].includes(type)) throw new Error("导出格式不支持");
  return fs.readFileSync(path.join(location(id), `report.${type}`));
}
export function publicHistoryImage(token) {
  if (!/^[a-f0-9]{64}$/.test(token || "")) return null;
  for (const item of listWeekHistory()) {
    const m = metadata(item.id);
    if (m.imageToken === token && ["sending", "sent", "accepted", "partial", "uncertain"].includes(m.status)) return historyFile(m.id, "png");
  }
  return null;
}
export function prepareWeekHistory(pack, image, actor, destination = null) {
  if (!Buffer.isBuffer(image) || image.length < 24 || !image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || image.toString("ascii", 12, 16) !== "IHDR") throw new Error("请上传有效的 PNG 报表图片");
  const hash = reportRevision(pack), existing = listWeekHistory().find(m => m.revision === hash && (m.destination?.key || "") === (destination?.key || "") && m.status !== "failed");
  if (existing) {
    const m = metadata(existing.id);
    if (["sent", "accepted"].includes(m.status)) return { ...m, duplicate: true };
    if (["sending", "uncertain", "partial"].includes(m.status)) throw new Error("这版报表正在发送、部分受理或结果待确认，请先查看历史记录，避免重复发送");
  }
  const id = randomUUID(), date = pack.registrationDate || pack.ymd;
  const version = listWeekHistory().filter(m => m.date === date).length + 1;
  const folder = location(id); fs.mkdirSync(folder, { recursive: true });
  const snapshot = JSON.parse(JSON.stringify(pack));
  // Save all artifacts BEFORE any external send; never reconstruct old data from WPS.
  atomicJson(path.join(folder, "table.json"), snapshot);
  fs.writeFileSync(path.join(folder, "report.png"), image, { mode: 0o600 });
  fs.writeFileSync(path.join(folder, "report.xlsx"), exportWeekXlsx(snapshot), { mode: 0o600 });
  const meta = { id, date, version, revision: hash, status: "sending", createdAt: new Date().toISOString(), sentAt: "",
    actor: String(actor || ""), destination, shops: pack.teams.reduce((n, t) => n + t.rows.length, 0), imageToken: randomBytes(32).toString("hex"), message: "正在发送" };
  atomicJson(path.join(folder, "meta.json"), meta);
  return meta;
}
export function finishWeekHistory(id, status, result = {}) {
  const meta = metadata(id);
  if (!["sent", "accepted", "partial", "failed", "uncertain"].includes(status)) throw new Error("发送状态无效");
  meta.status = status; meta.sentAt = status === "sent" ? new Date().toISOString() : "";
  meta.receipt = result.receipt || ""; meta.rejected = result.rejected || [];
  meta.message = { sent: "钉钉发送成功，表格和图片已归档", accepted: "钉钉已受理，实际送达请在客户端确认；表格和图片已归档",
    partial: "部分接收人未通过，请核对钉钉消息和接收人，勿整体重复发送", failed: "本次发送失败，表格和图片已保留", uncertain: "发送结果待确认，请核对钉钉消息，勿重复发送" }[status];
  if (result.error) meta.message += "。" + result.error;
  atomicJson(path.join(location(id), "meta.json"), meta);
  return meta;
}
