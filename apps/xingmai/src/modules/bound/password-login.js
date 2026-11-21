import { createCipheriv, randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";

// Wire format used by the official hejun.ecbis.cn login client (shared-DUVJACM6.js).
// This public protocol key is NOT encryption for storing credentials.
export function encodeLoginPassword(password) {
  const cipher = createCipheriv("aes-128-ecb", Buffer.from("xishuiwangluoMDF", "utf8"), null);
  return Buffer.concat([cipher.update(password, "utf8"), cipher.final()]).toString("base64");
}

// Official client reads uid/verify from auth/info, then userInfo from getUserInfo.
// Its tenant identity also supports companyID and primaryAccount (shared-DUVJACM6.js).
export function passwordIdentity(user = {}) {
  const id = value => typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
  const company = id(user.companyId) || id(user.companyID);
  const primary = id(user.primaryAccount);
  return { userId: id(user.userId), companyId: company || (primary ? `primary-account:${primary}` : "") };
}

export function createPasswordAuth({ readSession, saveSession, request, allowUserOnlyIdentity = () => false }) {
  let credentials = null;
  let busy = false;

  function status() {
    return { busy, autoReloginReady: Boolean(credentials), credentialStorage: "process_memory", identityScope: credentials?.identityScope || "none" };
  }

  function forget() { credentials = null; }

  async function fail(current, reason, message) {
    forget();
    await saveSession({ ...current, phase: "needs_password", cookies: {}, message, authFailure: reason });
    return { ok: false, reason, message };
  }

  async function signIn(input, automatic = false) {
    if (!input || typeof input.userName !== "string" || !input.userName.trim() || input.userName.length > 80
      || typeof input.password !== "string" || !input.password || input.password.length > 256
      || /[\r\n]/.test(input.userName) || typeof input.autoRelogin !== "boolean") {
      return { ok: false, statusCode: 400, reason: "invalid_credentials", message: "请填写旧站账号、密码及自动重登选项。" };
    }
    if (busy) return { ok: false, statusCode: 409, reason: "login_busy", message: "正在登录，请稍候。" };
    busy = true;
    try {
      const previous = await readSession();
      const current = {
        ...previous, provider: "PASSWORD", phase: "logging_in", cookies: {},
        scene: "", qrUrl: "", loginTicket: "", accounts: [], allowed: null,
        userName: input.userName.trim(), authGeneration: randomUUID(),
        authFailure: "", passwordIdentity: null, message: automatic ? "登录过期，正在重新登录。" : "正在验证账号密码。"
      };
      forget();
      await saveSession(current);
      try {
        const reply = await request(current, {
          method: "form", path: "/auth/login", withHttpStatus: true, redirect: "error", signal: globalThis.AbortSignal.timeout(15000),
          body: { userName: current.userName, password: encodeLoginPassword(input.password), deviceId: current.deviceId, domain: "hejun.ecbis.cn", agreementStatus: true }
        });
        const code = reply.payload?.code;
        if (code === -7) return await fail(current, "login_conflict", "账号已在其他设备登录，已停止自动重登。");
        if (code === 9901) return await fail(current, "account_disabled", "旧站账号已禁用，已停止自动重登。");
        if (code === 1011) return await fail(current, "device_restricted", "旧站限制了此浏览器标识，请联系旧站管理员。");
        if (reply.payload?.data?.needSelect) return await fail(current, "company_selection_required", "旧站要求选择企业，请先核实目标企业，未自动选择账号。");
        if (reply.httpStatus !== 200 || code !== 0) return await fail(current, "login_failed", "旧站未通过登录验证，请核对账号密码或登录限制。");
        const info = await request(current, { method: "get", path: "/auth/info", query: { domain: "hejun.ecbis.cn", url: "workTable-channelAnalysis-route" }, withHttpStatus: true, redirect: "error", signal: globalThis.AbortSignal.timeout(15000) });
        if (info.httpStatus !== 200 || info.payload?.code !== 0 || !info.payload?.data?.uid || !info.payload.data.verify || !Object.keys(current.cookies).length) {
          return await fail(current, "session_unverified", "登录返回后未能验证服务器会话，本次停止。");
        }
        const profile = await request(current, { method: "get", path: "/auth/getUserInfo", withHttpStatus: true, redirect: "error", signal: globalThis.AbortSignal.timeout(15000) });
        if (profile.httpStatus !== 200 || profile.payload?.code !== 0 || !profile.payload?.data?.userInfo) {
          return await fail(current, "profile_unverified", "未能核实旧站用户资料，本次停止。");
        }
        const identity = passwordIdentity(profile.payload.data.userInfo);
        if (!identity.userId || identity.userId !== String(info.payload.data.uid)) {
          return await fail(current, "identity_changed", "会话与用户资料的身份不一致，已停止采集。");
        }
        if (automatic && ((!identity.companyId && !allowUserOnlyIdentity()) || JSON.stringify(identity) !== JSON.stringify(previous.passwordIdentity))) {
          return await fail(current, "identity_changed", "重新登录后的用户或企业身份不一致，已停止采集。");
        }
        current.passwordIdentity = identity;
        current.phase = "logged_in";
        current.message = "账号密码登录成功，批量采集保持暂停。";
        if (input.autoRelogin && (identity.companyId || allowUserOnlyIdentity())) {
          const identityScope = identity.companyId ? "user_and_company" : "user_and_fixed_shop";
          credentials = { userName: input.userName.trim(), password: input.password, autoRelogin: true, identityScope };
          current.message += "自动重登已就绪，仅用于当前固定店铺试采。";
          if (!identity.companyId) current.message += "旧站未返回企业标识，将严格核对同一用户及固定店铺。";
        } else if (input.autoRelogin) {
          current.message += "旧站未返回完整用户和企业标识，自动重登暂不可用。";
        }
        await saveSession(current);
        return { ok: true, phase: current.phase, message: current.message };
      } catch (error) {
        return await fail(current, "login_request_failed", error?.name === "TimeoutError" || error?.name === "AbortError"
          ? "旧站登录请求超时，已停止，不自动重复提交。" : "旧站登录请求失败，已停止，不自动重复提交。");
      }
    } finally { busy = false; }
  }

  async function refresh() {
    if (!credentials) return { ok: false, reason: "credentials_unavailable" };
    if (credentials.identityScope === "user_and_fixed_shop" && !allowUserOnlyIdentity()) {
      forget();
      return { ok: false, reason: "scope_disabled" };
    }
    const input = { ...credentials };
    return signIn(input, true);
  }

  return { signIn, refresh, forget, status };
}
