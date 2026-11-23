import fs from "node:fs";
import path from "node:path";
import { Buffer } from "node:buffer";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { dbMode, query } from "../profile/auth.js";
import { atomicJson, weekDataDir } from "./week-storage.js";
import { dingWebhook } from "./week-report.js";

export const DING_CHANNELS = { group: "群机器人 Webhook", notice: "应用工作通知", bot: "应用机器人单聊" };
const file = () => path.join(weekDataDir(), "ding-config.json");
const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const defaults = () => ({ defaultChannel: "group", group: { name: "业绩群", webhook: "", secret: "", keyword: "" },
  notice: { source: "existing", name: "甄选智能人事", clientId: "", clientSecret: "", agentId: "", userIds: [] },
  bot: { source: "notice", name: "甄选智能人事", clientId: "", clientSecret: "", robotCode: "", userIds: [] } });

function encryptionKey(create = false) {
  if (process.env.HOME_WEEK_DING_KEY) {
    const key = Buffer.from(process.env.HOME_WEEK_DING_KEY, "base64");
    if (key.length !== 32) throw new Error("钉钉配置加密密钥必须为 32 字节 Base64");
    return key;
  }
  const keyFile = path.join(weekDataDir(), "ding-config.key");
  if (create && !fs.existsSync(keyFile)) {
    fs.mkdirSync(weekDataDir(), { recursive: true });
    try { fs.writeFileSync(keyFile, randomBytes(32), { mode: 0o600, flag: "wx" }); }
    catch (error) { if (error.code !== "EEXIST") throw error; }
  }
  if (!fs.existsSync(keyFile)) throw new Error("钉钉配置加密密钥缺失，请恢复备份");
  const key = fs.readFileSync(keyFile);
  if (key.length !== 32) throw new Error("钉钉配置加密密钥无效");
  return key;
}
function readConfig() {
  if (!fs.existsSync(file())) return defaults();
  try {
    const saved = JSON.parse(fs.readFileSync(file(), "utf8"));
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(saved.iv, "base64"));
    decipher.setAAD(Buffer.from("home-week-ding-v1"));
    decipher.setAuthTag(Buffer.from(saved.tag, "base64"));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(saved.data, "base64")), decipher.final()]).toString("utf8"));
  } catch { throw new Error("无法读取钉钉配置，请检查配置文件和加密密钥备份"); }
}
function writeConfig(config) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", encryptionKey(true), iv);
  cipher.setAAD(Buffer.from("home-week-ding-v1"));
  const data = Buffer.concat([cipher.update(JSON.stringify(config), "utf8"), cipher.final()]);
  atomicJson(file(), { version: 1, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") });
}
function clean(value, max = 200) { return String(value || "").trim().slice(0, max); }
function identifier(value, label) {
  const text = clean(value);
  if (text && !/^[a-zA-Z0-9_.:@-]+$/.test(text)) throw new Error(`${label} 格式不正确`);
  return text;
}
export function dingUserIds(value) {
  const ids = [...new Set((Array.isArray(value) ? value : String(value || "").split(/[\s,，;；]+/)).map(v => identifier(v, "接收人 userId")).filter(Boolean))];
  if (ids.length > 20) throw new Error("每种发送方式最多配置 20 位接收人");
  return ids;
}
export function validateDingWebhook(value) {
  let url;
  try { url = new URL(String(value || "")); } catch { throw new Error("请填写钉钉群机器人的完整 Webhook"); }
  if (url.protocol !== "https:" || url.hostname !== "oapi.dingtalk.com" || url.port || url.username || url.password || url.pathname !== "/robot/send" || !url.searchParams.get("access_token") || url.hash) throw new Error("Webhook 必须来自钉钉群机器人 https://oapi.dingtalk.com/robot/send");
  for (const key of [...url.searchParams.keys()]) if (key !== "access_token") url.searchParams.delete(key);
  return url.toString();
}
// Read the existing work-center app without changing its settings or sending probe messages.
async function existingApp() {
  let saved = {};
  if (dbMode() === "mysql") {
    try { const [rows] = await query("SELECT body FROM work_report_diary_meta WHERE meta_key = 'ding_agent'"); saved = JSON.parse(rows[0]?.body || "{}"); }
    catch { /* This module may be installed before the work center. */ }
  }
  const haveSavedPair = saved.clientId && saved.clientSecret;
  return { clientId: clean(haveSavedPair ? saved.clientId : process.env.DINGTALK_CLIENT_ID),
    clientSecret: clean(haveSavedPair ? saved.clientSecret : process.env.DINGTALK_CLIENT_SECRET, 1000),
    agentId: clean(process.env.DINGTALK_AGENT_ID || saved.agentId) };
}
function resolve(config, channel, existing, legacy) {
  const c = config[channel];
  if (!Object.hasOwn(DING_CHANNELS, channel)) throw new Error("请选择发送方式");
  if (channel === "group") return { ...c, webhook: c.webhook || legacy };
  let app = c.source === "existing" ? existing : c;
  if (channel === "bot" && c.source === "notice") app = resolve(config, "notice", existing, legacy);
  return { ...c, clientId: app.clientId, clientSecret: app.clientSecret,
    agentId: channel === "notice" ? c.agentId || app.agentId : undefined,
    robotCode: channel === "bot" ? c.robotCode || app.clientId : undefined };
}
function validate(channel, c) {
  if (channel === "group") { validateDingWebhook(c.webhook); return; }
  if (!c.clientId || !c.clientSecret) throw new Error("请先配置应用 Client ID 和 Client Secret，或选择可用的现有应用");
  if (channel === "notice" && (!/^\d+$/.test(c.agentId || "") || !Number.isSafeInteger(Number(c.agentId)) || Number(c.agentId) <= 0)) throw new Error("应用工作通知需要填写有效的数字 AgentId");
  if (channel === "bot" && !c.robotCode) throw new Error("请填写应用机器人的 RobotCode");
  if (!c.userIds.length) throw new Error("请填写接收人的钉钉 userId（不是手机号或姓名）");
}
function destination(channel, c) {
  return { channel, label: DING_CHANNELS[channel], name: c.name,
    recipients: channel === "group" ? [] : c.userIds,
    key: digest(channel === "group" ? { channel, webhook: c.webhook } : { channel, clientId: c.clientId, agent: c.agentId || c.robotCode, users: [...c.userIds].sort() }) };
}

export function createDingService({ fetcher = globalThis.fetch, loadExisting = existingApp, legacyWebhook = dingWebhook } = {}) {
  async function snapshot() {
    const config = readConfig(), existing = await loadExisting(), legacy = legacyWebhook();
    return { config, existing, legacy, revision: digest({ config, existing, legacy }) };
  }
  async function publicConfig() {
    const { config, existing, legacy, revision } = await snapshot();
    const result = { defaultChannel: config.defaultChannel, revision,
      existing: { available: Boolean(existing.clientId && existing.clientSecret), clientId: existing.clientId || "", agentId: existing.agentId || "" } };
    for (const channel of Object.keys(DING_CHANNELS)) {
      const raw = config[channel], c = resolve(config, channel, existing, legacy);
      let error = ""; try { validate(channel, c); } catch (e) { error = e.message; }
      result[channel] = { name: raw.name, source: raw.source, ready: !error, error, keyword: raw.keyword || "",
        hasWebhook: Boolean(c.webhook), hasSignSecret: Boolean(raw.secret), clientId: raw.clientId || "", hasClientSecret: Boolean(raw.clientSecret),
        resolvedClientId: c.clientId || "", agentId: raw.agentId || "", resolvedAgentId: c.agentId || "", robotCode: raw.robotCode || "",
        resolvedRobotCode: c.robotCode || "", userIds: raw.userIds || [] };
    }
    return result;
  }
  async function save(channel, input) {
    if (!Object.hasOwn(DING_CHANNELS, channel)) throw new Error("发送方式不正确");
    const { config, existing, legacy } = await snapshot(), old = config[channel];
    const next = { ...old, name: clean(input.name, 60) || old.name };
    if (channel === "group") {
      next.webhook = input.webhook ? validateDingWebhook(input.webhook) : old.webhook || legacy;
      next.secret = input.clearSignSecret ? "" : clean(input.secret, 1000) || old.secret;
      if (next.secret && !/^SEC[a-zA-Z0-9]+$/.test(next.secret)) throw new Error("加签密钥应为群机器人安全设置中的 SEC 开头密钥");
      next.keyword = clean(input.keyword, 60);
    } else {
      if (!(channel === "bot" ? ["manual", "existing", "notice"] : ["manual", "existing"]).includes(input.source)) throw new Error("请选择应用凭据来源");
      next.source = input.source;
      if (input.source === "manual") {
        next.clientId = identifier(input.clientId, "Client ID");
        if (next.clientId !== old.clientId && !clean(input.clientSecret)) throw new Error("更换 Client ID 时请同时填写对应的 Client Secret");
        next.clientSecret = clean(input.clientSecret, 1000) || old.clientSecret;
      }
      next.userIds = dingUserIds(input.userIds);
      if (channel === "notice") next.agentId = identifier(input.agentId, "AgentId");
      else next.robotCode = identifier(input.robotCode, "RobotCode");
    }
    config[channel] = next;
    validate(channel, resolve(config, channel, existing, legacy));
    if (input.makeDefault) config.defaultChannel = channel;
    writeConfig(config);
    return publicConfig();
  }
  async function target(channel, revision) {
    const snap = await snapshot();
    channel = channel || snap.config.defaultChannel;
    if (revision !== snap.revision) throw new Error("钉钉配置已变化，请重新选择接收渠道后发送");
    const config = resolve(snap.config, channel, snap.existing, snap.legacy);
    validate(channel, config);
    return { channel, config, destination: destination(channel, config) };
  }
  async function request(url, options, sending = false) {
    try {
      const response = await fetcher(url, { ...options, redirect: "error", signal: globalThis.AbortSignal.timeout(25000) });
      const body = await response.json();
      const rejected = (body.errcode != null && Number(body.errcode) !== 0) || Boolean(body.code);
      if (!response.ok || rejected) {
        const code = String(body.code || body.errcode || response.status).replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 80);
        return { ok: false, definiteFailure: !sending || (response.status < 500 && rejected), error: `钉钉接口未通过（${code}），请检查应用权限、接收人范围和配置` };
      }
      return { ok: true, body };
    } catch { return { ok: false, definiteFailure: !sending, error: sending ? "发送结果待确认，请核对钉钉消息后再操作" : "连接钉钉失败，尚未发送消息" }; }
  }
  const json = body => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  async function token(c) {
    const result = await request("https://api.dingtalk.com/v1.0/oauth2/accessToken", json({ appKey: c.clientId, appSecret: c.clientSecret }));
    if (result.ok && !result.body.accessToken) return { ok: false, definiteFailure: true, error: "应用凭据验证未返回有效令牌，尚未发送消息" };
    return result;
  }
  async function check(channel) {
    const { config, existing, legacy } = await snapshot(), c = resolve(config, channel, existing, legacy);
    validate(channel, c);
    if (channel === "group") return { ok: true, message: "Webhook 格式有效。未发送消息；加签、关键词和群权限需在实际发送时确认。" };
    const result = await token(c);
    return result.ok ? { ok: true, message: "应用凭据有效，未发送消息。消息权限、机器人能力和接收人可见范围仍需在钉钉后台开通。" } : { ok: false, error: result.error };
  }
  async function send({ target: t, image, picUrl, title, text }) {
    const c = t.config;
    if (t.channel === "group") {
      const url = new URL(validateDingWebhook(c.webhook));
      if (c.secret) {
        const timestamp = String(Date.now());
        url.searchParams.set("timestamp", timestamp);
        url.searchParams.set("sign", createHmac("sha256", c.secret).update(`${timestamp}\n${c.secret}`).digest("base64"));
      }
      const heading = `${c.keyword ? c.keyword + " · " : ""}${title}`;
      const result = await request(url.toString(), json({ msgtype: "markdown", markdown: { title: heading, text: `### ${heading}\n${text}\n\n![业绩报表](${picUrl})` } }), true);
      return result.ok && result.body.errcode === 0 ? { ok: true, status: "sent" } : result.ok ? { ok: false, definiteFailure: false } : result;
    }
    const auth = await token(c);
    if (!auth.ok) return auth;
    const accessToken = auth.body.accessToken;
    const form = new globalThis.FormData(); form.append("media", new globalThis.Blob([image], { type: "image/png" }), "report.png");
    const upload = await request(`https://oapi.dingtalk.com/media/upload?access_token=${encodeURIComponent(accessToken)}&type=image`, { method: "POST", body: form });
    if (!upload.ok) return upload;
    if (upload.body.errcode !== 0 || !upload.body.media_id) return { ok: false, definiteFailure: true, error: "图片上传未成功，尚未发送消息" };
    if (t.channel === "notice") {
      const result = await request(`https://oapi.dingtalk.com/topapi/message/corpconversation/asyncsend_v2?access_token=${encodeURIComponent(accessToken)}`,
        json({ agent_id: Number(c.agentId), userid_list: c.userIds.join(","), to_all_user: false, msg: { msgtype: "image", image: { media_id: upload.body.media_id } } }), true);
      return result.ok && result.body.errcode === 0 && result.body.task_id ? { ok: true, status: "accepted", receipt: String(result.body.task_id) } : result.ok ? { ok: false, definiteFailure: false } : result;
    }
    const options = json({ robotCode: c.robotCode, userIds: c.userIds, msgKey: "sampleImageMsg", msgParam: JSON.stringify({ photoURL: upload.body.media_id }) });
    options.headers["x-acs-dingtalk-access-token"] = accessToken;
    const result = await request("https://api.dingtalk.com/v1.0/robot/oToMessages/batchSend", options, true);
    if (!result.ok) return result;
    const rejected = [...new Set([...(result.body.invalidStaffIdList || []), ...(result.body.flowControlledStaffIdList || [])].map(String))];
    if (result.body.processQueryKey) return { ok: true, status: rejected.length ? "partial" : "accepted", receipt: String(result.body.processQueryKey), rejected };
    return { ok: false, definiteFailure: rejected.length === c.userIds.length, error: "单聊接口未返回发送凭证，请核对机器人能力与接收人范围" };
  }
  return { publicConfig, save, target, check, send };
}
