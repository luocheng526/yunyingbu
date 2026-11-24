import { randomUUID, createHash } from "node:crypto";
import { collectionStatus, requestSingleShopProbe, clearProbeSessionCookies } from "./collect.js";
import { readState, writeState } from "./persist.js";
import { verifyProbeMetric } from "./probe-metric.js";

import { PROBE_TARGET, getProbeTargets, findProbeTarget } from "./probe-target.js";
export { PROBE_TARGET } from "./probe-target.js";

let running = false;

function targetIndex(target) {
  return `probe_target:${createHash("sha256").update(JSON.stringify([target.platform, target.shopId, target.date, target.metric])).digest("hex").slice(0, 32)}`;
}

export async function singleProbeStatus(date) {
  const targets = getProbeTargets();
  const selected = date ? targets.find(target => target.date === date) : null;
  if (date && !selected) return { ok: false, statusCode: 400, message: "未配置该日期的试采任务。" };
  const id = await readState(selected ? targetIndex(selected) : "probe_latest", "");
  const last = id ? await readState(`probe:${id}`, null) : null;
  return { ok: true, target: selected || last?.target || PROBE_TARGET, targets, running, last };
}

export async function saveProbeRecord(record) {
  const metric = verifyProbeMetric(record);
  if (metric) {
    record.metric = metric;
    record.metricVerified = metric.matchesPage;
    record.status = metric.matchesPage ? "metric_verified" : "metric_mismatch";
    record.message = metric.matchesPage
      ? `支付金额 ${metric.displayValue} 与已确认的旧站页面一致；已保存试采记录，未计入全店汇总。`
      : "接口金额与已确认的页面值不一致，停止扩大采集范围。";
  }
  await writeState(`probe:${record.id}`, record);
  await writeState("probe_latest", record.id);
  await writeState(targetIndex(record.target), record.id);
  const saved = await readState(`probe:${record.id}`, null);
  if (!saved || JSON.stringify(saved) !== JSON.stringify(record)) throw new Error("试采记录回读不一致");
  return saved;
}

// First-stage diagnostic only: capture a response, never guess a money field or write bound_sheet.
export async function runSingleProbe(input = {}, { clearLocalSession = false } = {}) {
  const target = findProbeTarget(input);
  if (!target
    || Object.keys(input).some(key => !["shopId", "platform", "date"].includes(key))) {
    return { ok: false, statusCode: 400, reason: "invalid_scope", message: "仅允许已配置的单店、单日试采任务。" };
  }
  if (collectionStatus().batchEnabled || running) {
    return { ok: false, statusCode: 409, reason: "collector_busy", message: "请保持批量采集关闭，并等待当前试采结束。" };
  }
  running = true;
  const record = {
    id: randomUUID(), target, startedAt: new Date().toISOString(),
    status: "pending", message: "", requestCount: 0,
    validationMode: clearLocalSession ? "local_cookie_loss" : "normal",
    request: { method: "POST", path: "/v2/channel/shop/operatingData", body: {
      queryType: 2, platform: input.platform, shopId: input.shopId,
      startDate: input.date, endDate: input.date, daysType: "1", exportMode: ""
    } },
    metricVerified: false
  };
  try {
    let response;
    try {
      const prepared = clearLocalSession ? await clearProbeSessionCookies() : { ok: true };
      response = prepared.ok
        ? await requestSingleShopProbe(record.request.body, () => { record.requestCount += 1; })
        : { blocked: prepared.reason };
      if (response.blocked) {
        record.status = response.blocked;
        record.message = {
          permission_denied: "旧站会话没有渠道详情权限，未发送采集请求。",
          login_busy: "正在验证登录，本次未发送采集请求。",
          invalid_scope: "当前仅允许固定店铺和日期，未发送请求。",
          relogin_not_ready: "自动重登尚未就绪，未清除会话，也未发送请求。",
          session_changed: "试采期间登录身份发生变化，本次响应不予采用。"
        }[response.blocked] || "边界模块尚无可用的服务器登录会话；浏览器登录不会自动同步到这里。";
      } else {
        record.relogin = response.relogin || { attempted: false, succeeded: false };
        if (response.reloginTrigger) record.reloginTrigger = response.reloginTrigger;
        const payload = response.payload;
        record.httpStatus = response.httpStatus || response.status || null;
        record.upstreamCode = typeof payload?.code === "number" ? payload.code : null;
        if (payload?.code === 1011) {
          record.status = "device_restricted";
          record.message = "旧站限制了当前设备，已停止，不自动重登。";
        } else if (payload?.code === -7 || payload?.code === 9901) {
          record.status = "login_conflict";
          record.message = "旧站提示其他设备登录或账号禁用，已停止，不自动重登。";
        } else if (payload?.code === -1 || record.httpStatus === 401) {
          record.status = "login_expired";
          record.message = "服务器登录已失效，本次试采停止。";
        } else if (record.httpStatus !== 200 || payload?.code !== 0) {
          record.status = "request_failed";
          record.message = "旧站未返回成功的 JSON 响应，本次不重试。";
        } else {
          const table = Array.isArray(payload.data) ? payload.data[1] : null;
          if (!Array.isArray(table?.columnInfo) || !Array.isArray(table?.columnData)) {
            record.status = "schema_unverified";
            record.message = "响应结构与经营数据页面不一致，停止解析。";
          } else {
            const rows = table.columnData.filter(row => typeof row?.date === "string" && row.date.replaceAll("/", "-") === input.date);
            record.returnedRowCount = table.columnData.length;
            record.matchedRowCount = rows.length;
            if (rows.length !== 1) {
              record.status = "date_unverified";
              record.message = "响应未包含唯一的指定日期行，停止解析。";
            } else {
              record.status = "response_received";
              record.message = "已取得指定日期行，待核实金额字段和精度；尚未计入正式数据。";
              record.sample = { columns: table.columnInfo, row: rows[0], summary: payload.data[0] ?? null };
            }
          }
        }
      }
    } catch (error) {
      record.status = error?.name === "TimeoutError" || error?.name === "AbortError" ? "timeout" : "request_failed";
      record.message = record.status === "timeout" ? "单笔请求超时，已停止，不自动重试。" : "单笔请求失败，已停止，不自动重试。";
    }
    record.finishedAt = new Date().toISOString();
    const saved = await saveProbeRecord(record);
    return { ok: ["response_received", "metric_verified"].includes(saved.status), persisted: true, record: saved };
  } finally {
    running = false;
  }
}
