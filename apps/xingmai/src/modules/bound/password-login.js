import { createCipheriv, randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";
import { classifyLoginFailure, loginDiagnostic, nextShanghaiDay, passwordLoginHold } from "./login-diagnostics.js";

// Wire format verified against hejun.ecbis.cn shared-BRAVGqD7.js (2026-11-24).
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

export function createPasswordAuth({ readSession, saveSession, request, allowUserOnlyIdentity = () => false, savePreference = async () => {}, now = Date.now }) {
  let credentials = null;
  let busy = false;
  let disableVersion = 0;

  function status() {
    return { busy, autoReloginReady: Boolean(credentials), credentialStorage: "process_memory", identityScope: credentials?.identityScope || "none" };
  }

  function forget() { credentials = null; }
  // A cancellation also fences a login already awaiting an upstream response.
  function disableAutoRelogin() { disableVersion++; forget(); }

  async function fail(current, reason, message, diagnostic = null) {
    forget();
    const loginRetryAfter = reason === "login_daily_limit" ? nextShanghaiDay(now()) : null;
    const hold = loginRetryAfter ? { userName: current.userName, until: loginRetryAfter, message, diagnostic } : passwordLoginHold(current, now());
    await saveSession({ ...current, phase: "needs_password", cookies: {}, message, authFailure: reason, authDiagnostic: diagnostic, loginRetryAfter, passwordLoginHold: hold });
    return { ok: false, reason, message, diagnostic, loginRetryAfter };
  }

  async function signIn(input, automatic = false) {
    if (!input || typeof input.userName !== "string" || !input.userName.trim() || input.userName.length > 80
      || typeof input.password !== "string" || !input.password.trim() || input.password.length > 256
      || /[\r\n]/.test(input.userName) || typeof input.autoRelogin !== "boolean") {
      return { ok: false, statusCode: 400, reason: "invalid_credentials", message: "请填写旧站账号、密码及自动重登选项。" };
    }
    if (busy) return { ok: false, statusCode: 409, reason: "login_busy", message: "正在登录，请稍候。" };
    // Official Login-7yHdo_By.js trims both fields before encryption. Do this once
    // for the explicit attempt and retain the same value for an enabled refresh.
    const password = input.password.trim();
    busy = true;
    const version = disableVersion;
    try {
      if (!automatic) await savePreference(input.autoRelogin);
      const previous = await readSession();
      if (automatic && version !== disableVersion) return { ok: false, reason: "auto_relogin_disabled" };
      const hold = passwordLoginHold(previous, now());
      if (hold && hold.userName === input.userName.trim()) {
        forget();
        return { ok: false, statusCode: 429, reason: "login_daily_limit", message: hold.message,
          diagnostic: hold.diagnostic || null, loginRetryAfter: hold.until };
      }
      const current = {
        ...previous, provider: "PASSWORD", phase: "logging_in", cookies: {},
        scene: "", qrUrl: "", loginTicket: "", accounts: [], allowed: null,
        userName: input.userName.trim(), authGeneration: randomUUID(),
        authFailure: "", authDiagnostic: null, loginRetryAfter: null, passwordLoginHold: hold, passwordIdentity: null, qrIdentityGeneration: null, message: automatic ? "登录过期，正在重新登录。" : "正在验证账号密码。"
      };
      forget();
      await saveSession(current);
      let stage = "login", latestReply;
      const send = async (nextStage, spec) => { stage = nextStage; latestReply = undefined; latestReply = await request(current, spec); return latestReply; };
      const failed = (reason, message) => fail(current, reason, message, loginDiagnostic(stage, latestReply));
      try {
        if (automatic && version !== disableVersion) {
          return await fail(current, "auto_relogin_disabled", "自动重登已关闭，请手动登录。");
        }
        const reply = await send("login", {
          method: "form", path: "/auth/login", withHttpStatus: true, redirect: "error", signal: globalThis.AbortSignal.timeout(15000),
          body: { userName: current.userName, password: encodeLoginPassword(password), deviceId: current.deviceId, domain: "hejun.ecbis.cn", agreementStatus: true }
        });
        const code = reply.payload?.code;
        if (reply.httpStatus !== 200 || code !== 0 || reply.payload?.data?.needSelect) {
          const issue = classifyLoginFailure(reply);
          return await failed(issue.reason, issue.message);
        }
        const info = await send("session", { method: "get", path: "/auth/info", query: { domain: "hejun.ecbis.cn", url: "workTable-channelAnalysis-route" }, withHttpStatus: true, redirect: "error", signal: globalThis.AbortSignal.timeout(15000) });
        if (info.httpStatus !== 200 || info.payload?.code !== 0 || !info.payload?.data?.uid || !info.payload.data.verify || !Object.keys(current.cookies).length) {
          return await failed("session_unverified", "登录返回后未能验证服务器会话，本次停止。");
        }
        const profile = await send("profile", { method: "get", path: "/auth/getUserInfo", withHttpStatus: true, redirect: "error", signal: globalThis.AbortSignal.timeout(15000) });
        if (profile.httpStatus !== 200 || profile.payload?.code !== 0 || !profile.payload?.data?.userInfo) {
          return await failed("profile_unverified", "未能核实旧站用户资料，本次停止。");
        }
        const identity = passwordIdentity(profile.payload.data.userInfo);
        if (!identity.userId || identity.userId !== String(info.payload.data.uid)) {
          return await failed("identity_changed", "会话与用户资料的身份不一致，已停止采集。");
        }
        if (automatic && ((!identity.companyId && !allowUserOnlyIdentity()) || JSON.stringify(identity) !== JSON.stringify(previous.passwordIdentity))) {
          return await failed("identity_changed", "重新登录后的用户或企业身份不一致，已停止采集。");
        }
        current.passwordIdentity = identity;
        current.phase = "logged_in";
        current.message = "账号密码登录成功，批量采集保持暂停。";
        if (input.autoRelogin && version === disableVersion && (identity.companyId || allowUserOnlyIdentity())) {
          const identityScope = identity.companyId ? "user_and_company" : "user_and_fixed_shop";
          credentials = { userName: input.userName.trim(), password, autoRelogin: true, identityScope };
          current.message += "自动重登已就绪，仅用于已授权的采集任务。";
          if (!identity.companyId) current.message += "旧站未返回企业标识，将严格核对同一用户及其可见店铺。";
        } else if (input.autoRelogin && version === disableVersion) {
          current.message += "旧站未返回完整用户和企业标识，自动重登暂不可用。";
        }
        await saveSession(current);
        return { ok: true, phase: current.phase, message: current.message };
      } catch (error) {
        return await fail(current, "login_request_failed", error?.name === "TimeoutError" || error?.name === "AbortError"
          ? "旧站登录请求超时，已停止，不自动重复提交。" : "旧站登录请求失败，已停止，不自动重复提交。", loginDiagnostic(stage, latestReply, error));
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

  return { signIn, refresh, forget, disableAutoRelogin, status };
}
