import { createHmac } from "node:crypto";

export const STALE_MS = 30 * 60 * 1000;
export const REPEAT_MS = 30 * 60 * 1000;

export function parseReturnAt(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(raw)) {
    const ms = Date.parse(raw);
    return Number.isFinite(ms) ? ms : null;
  }
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
  if (match) {
    const ms = Date.parse(`${match[1]}T${match[2]}+08:00`);
    return Number.isFinite(ms) ? ms : null;
  }
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}

export function latestReturnMs(shops) {
  const rows = Array.isArray(shops) ? shops : [];
  if (!rows.length) return null;
  let latest = null;
  for (const row of rows) {
    const ms = parseReturnAt(row && row.capturedAt);
    if (ms == null) continue;
    if (latest == null || ms > latest) latest = ms;
  }
  return latest == null ? 0 : latest;
}

export function formatShanghai(ms) {
  if (!ms) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ms));
  const pick = (type) => parts.find((part) => part.type === type)?.value || "";
  let hour = pick("hour");
  if (hour === "24") hour = "00";
  return `${pick("year")}-${pick("month")}-${pick("day")} ${hour}:${pick("minute")}:${pick("second")}`;
}

export function staleDecision({ shops, now, alert, thresholdMs = STALE_MS, repeatMs = REPEAT_MS }) {
  const stamp = latestReturnMs(shops);
  if (stamp == null) {
    return { stale: false, send: false, stamp: null, minutes: 0, ageMs: 0 };
  }
  const ageMs = now - stamp;
  const stale = ageMs > thresholdMs;
  const minutes = stale ? Math.max(31, Math.ceil(ageMs / 60000)) : Math.max(0, Math.floor(ageMs / 60000));
  const sentAt = Number(alert && alert.sentAt) || 0;
  const send = stale && (!sentAt || now - sentAt >= repeatMs);
  return { stale, send, stamp, minutes, ageMs };
}

export function staleAlertText({ minutes, stamp }) {
  const when = formatShanghai(stamp);
  const clock = when ? `最新回传 ${when}，已过 ${minutes} 分钟。` : "还没有可用的回传时间。";
  return `韩梦凯实时付费：回传超过30分钟没有更新。${clock}`;
}

export function dingtalkTestText({ stamp, stale, minutes }) {
  const when = formatShanghai(stamp);
  const clock = when ? `最新回传 ${when}。` : "";
  const tail = stale
    ? `当前已超过30分钟没有更新，已过 ${minutes} 分钟。`
    : "当前回传还在更新。回传超过30分钟没有更新时，每30分钟自动发一条。";
  return `韩梦凯实时付费：这是一条测试提醒。${clock}${tail}`;
}

export function isDingtalkWebhook(value) {
  try {
    const url = new URL(String(value || "").trim());
    return url.protocol === "https:"
      && url.hostname === "oapi.dingtalk.com"
      && url.pathname === "/robot/send"
      && Boolean(url.searchParams.get("access_token"));
  } catch {
    return false;
  }
}

export function signDingtalkUrl(webhook, secret, now = Date.now()) {
  const raw = String(webhook || "");
  const key = String(secret || "").trim();
  if (!key) return raw;
  const timestamp = String(now);
  const sign = encodeURIComponent(createHmac("sha256", key).update(`${timestamp}\n${key}`).digest("base64"));
  const joiner = raw.includes("?") ? "&" : "?";
  return `${raw}${joiner}timestamp=${timestamp}&sign=${sign}`;
}

export async function postDingtalk(webhook, content, secret, now = Date.now()) {
  const res = await fetch(signDingtalkUrl(webhook, secret, now), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ msgtype: "text", text: { content: String(content || "") } }),
    signal: AbortSignal.timeout(8000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data && data.errcode)) {
    const err = new Error((data && data.errmsg) || "钉钉提醒发送失败");
    err.statusCode = 502;
    throw err;
  }
  return data;
}
