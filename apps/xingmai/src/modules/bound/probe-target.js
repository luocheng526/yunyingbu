import { readFileSync } from "node:fs";

export const PROBE_TARGET = Object.freeze({
  shopName: "RASW潮流生活京选菀瑶专卖店",
  shopId: "16501691",
  platform: "JD",
  date: "2026-11-19",
  metric: "支付金额(支付)",
  pageDisplay: "3,759"
});

// Local code-owned allowlist, reread so an authorized single-day task can be added
// without restarting the process that holds the user's login credentials.
export function getProbeTargets() {
  const targets = JSON.parse(readFileSync(new URL("./probe-targets.json", import.meta.url), "utf8"));
  const dates = new Set();
  if (!Array.isArray(targets) || !targets.length || targets.length > 10) throw new Error("试采任务配置无效");
  for (const target of targets) {
    if (target.shopId !== PROBE_TARGET.shopId || target.platform !== PROBE_TARGET.platform
      || typeof target.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(target.date)
      || Number.isNaN(Date.parse(target.date)) || new Date(target.date).toISOString().slice(0, 10) !== target.date
      || typeof target.metric !== "string" || !target.metric || target.metric.length > 80
      || !(target.pageDisplay === null || typeof target.pageDisplay === "string") || dates.has(target.date)) {
      throw new Error("试采任务范围无效");
    }
    dates.add(target.date);
  }
  return targets;
}

export function findProbeTarget(input) {
  return getProbeTargets().find(target => ["shopId", "platform", "date"].every(key => target[key] === input?.[key]));
}

export function isSingleShopRequest(body) {
  const target = findProbeTarget({ shopId: body?.shopId, platform: body?.platform, date: body?.startDate });
  if (!target) return false;
  const expected = {
    queryType: 2, platform: target.platform, shopId: target.shopId,
    startDate: target.date, endDate: target.date, daysType: "1", exportMode: ""
  };
  return body && Object.keys(body).length === Object.keys(expected).length
    && Object.entries(expected).every(([key, value]) => body[key] === value);
}
