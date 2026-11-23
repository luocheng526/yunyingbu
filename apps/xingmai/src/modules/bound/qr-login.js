import { passwordIdentity } from "./password-login.js";
import { loginDiagnostic } from "./login-diagnostics.js";

// QR and password login must derive the same owner key from server-verified
// identity, so the existing batch and its selected shops can be resumed.
export async function verifyQrIdentity(current, request, isCurrent, expectedCompany = "") {
  let stage = "session", response;
  const failed = (reason, message, error) => ({ ok: false, reason, message, diagnostic: loginDiagnostic(stage, response, error) });
  try {
    response = await request(current, { method: "get", path: "/auth/info", query: { domain: "hejun.ecbis.cn", url: "workTable-channelAnalysis-route" },
      withHttpStatus: true, redirect: "error", signal: globalThis.AbortSignal.timeout(15000) });
    if (!await isCurrent()) return { stale: true };
    const info = response.payload?.data;
    if (response.httpStatus !== 200 || response.payload?.code !== 0 || !info?.uid || !info.verify || !Object.keys(current.cookies).length) {
      return failed("session_unverified", "手机已确认，但旧站会话尚未核验成功。请重新扫码，采集进度已保留。");
    }
    stage = "profile"; response = undefined;
    response = await request(current, { method: "get", path: "/auth/getUserInfo", withHttpStatus: true, redirect: "error", signal: globalThis.AbortSignal.timeout(15000) });
    if (!await isCurrent()) return { stale: true };
    const user = response.payload?.data?.userInfo;
    if (response.httpStatus !== 200 || response.payload?.code !== 0 || !user) {
      return failed("profile_unverified", "扫码后未能核实旧站账号身份，已停止。请重新扫码。");
    }
    const identity = passwordIdentity(user);
    if (!identity.userId || identity.userId !== String(info.uid)
      || expectedCompany && String(user.companyId || user.companyID || "") !== String(expectedCompany)) {
      return failed("identity_changed", "扫码返回的账号或企业身份不一致，未继续采集。请确认扫码账号及所选企业。");
    }
    return { ok: true, identity, userName: String(user.nickName || user.userName || user.name || identity.userId).slice(0, 80) };
  } catch (error) {
    return failed("qr_verification_failed", "扫码后的登录核验未完成，请稍后重新扫码。采集进度已保留。", error);
  }
}
