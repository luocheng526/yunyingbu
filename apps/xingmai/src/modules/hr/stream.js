import { dingCallsEnabled, readDingEnv } from "./dingtalk.js";
import { pullDay, pullLeaves, saveBoardSnapshot, shanghaiToday } from "./sync.js";

const OPEN_URL = "https://api.dingtalk.com/v1.0/gateway/connections/open";

function parseData(raw) {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function ackFor(message) {
  const headers = message.headers || message.header || {};
  const topic = headers.topic;
  const messageId = headers.messageId;
  if (topic === "ping") {
    const data = parseData(message.data);
    return {
      code: 200,
      message: "OK",
      headers: { messageId, contentType: "application/json" },
      data: JSON.stringify({ opaque: data.opaque || "" })
    };
  }
  if (topic === "disconnect") return null;
  return {
    code: 200,
    message: "OK",
    headers: { messageId, contentType: "application/json" },
    data: JSON.stringify({ status: "SUCCESS", message: "success" })
  };
}

export function interestingEvent(message, corpId) {
  const headers = message.headers || message.header || {};
  if ((message.type || "") !== "EVENT") return null;
  const eventType = headers.eventType || "";
  if (corpId && headers.eventCorpId && headers.eventCorpId !== corpId) return null;
  const data = parseData(message.data);
  if (eventType === "attendance_check_record") {
    const userIds = (data.dataList || []).map((row) => String(row.userId || "")).filter(Boolean);
    return userIds.length ? { kind: "punch", userIds } : null;
  }
  if (eventType === "bpms_instance_change") {
    const category = String(data.bizCategoryId || "");
    const aboutLeave = category.includes("attendance") || category.includes("leave") || category.includes("overtime");
    if (data.type === "finish" && data.result === "agree" && aboutLeave && data.staffId) {
      return { kind: "approval", userIds: [String(data.staffId)] };
    }
  }
  return null;
}

async function refreshUsers(userIds, client, leave) {
  if (!userIds.length) return;
  const day = shanghaiToday();
  await pullDay(day, { client, userIds });
  if (leave) {
    try {
      await pullLeaves(day, day, client);
    } catch {
      /* 请假没跟上也不挡住当天留档 */
    }
  }
  await saveBoardSnapshot(day);
}

export function startDingStream({ client, fetchImpl = globalThis.fetch, WebSocketImpl = globalThis.WebSocket } = {}) {
  const env = readDingEnv();
  if (!dingCallsEnabled() || !env.configured || !client || !client.configured()) return { started: false };
  let stopped = false;
  let socket = null;
  const pending = new Set();
  let wantLeave = false;
  let flushTimer = null;

  function schedule(hit) {
    for (const id of hit.userIds || []) pending.add(id);
    if (hit.kind === "approval") wantLeave = true;
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
      const ids = [...pending];
      const leave = wantLeave;
      pending.clear();
      wantLeave = false;
      flushTimer = null;
      refreshUsers(ids, client, leave).catch(() => {});
    }, 20000);
    if (typeof flushTimer.unref === "function") flushTimer.unref();
  }

  async function connectOnce() {
    const res = await fetchImpl(OPEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        clientId: env.clientId,
        clientSecret: env.clientSecret,
        subscriptions: [{ type: "EVENT", topic: "*" }],
        ua: "xingmai-hr/0.1"
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.endpoint || !data.ticket) {
      throw new Error("钉钉长连接没有建起来");
    }
    const endpoint = new URL(data.endpoint);
    endpoint.searchParams.set("ticket", data.ticket);
    await new Promise((resolve, reject) => {
      const ws = new WebSocketImpl(endpoint.toString());
      socket = ws;
      ws.addEventListener("message", (event) => {
        let message = {};
        try {
          message = JSON.parse(String(event.data || ""));
        } catch {
          return;
        }
        const ack = ackFor(message);
        if (ack) ws.send(JSON.stringify(ack));
        const hit = interestingEvent(message, env.corpId);
        if (hit) schedule(hit);
      });
      ws.addEventListener("close", () => resolve());
      ws.addEventListener("error", () => reject(new Error("钉钉长连接中断")));
    });
  }

  async function loop() {
    while (!stopped) {
      try {
        await connectOnce();
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        continue;
      }
      if (!stopped) await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  loop();
  return {
    started: true,
    stop() {
      stopped = true;
      if (flushTimer) clearTimeout(flushTimer);
      flushTimer = null;
      pending.clear();
      if (socket && socket.close) socket.close();
    }
  };
}
