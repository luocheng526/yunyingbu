// Keep only bounded diagnostic fields. Upstream text may echo credentials.
export function loginDiagnostic(stage, response, error) {
  const status = response?.httpStatus ?? response?.status;
  const code = response?.payload?.code;
  return { stage, at: new Date().toISOString(),
    httpStatus: Number.isInteger(status) && status >= 100 && status <= 599 ? status : null,
    upstreamCode: typeof code === "number" && Number.isSafeInteger(code) ? code
      : typeof code === "string" && /^-?\d{1,12}$/.test(code) ? code : null,
    responseType: response?.payload && typeof response.payload === "object" ? "json" : response ? "non_json" : null,
    errorType: error ? ["TimeoutError", "AbortError"].includes(error.name) ? "timeout" : error.name === "SyntaxError" ? "invalid_json" : "request_failed" : null };
}

export function classifyLoginFailure(response) {
  const code = String(response.payload?.code ?? "");
  // Match the confirmed platform notice; never forward the upstream text itself.
  const text = [response.payload?.content, response.payload?.message].filter(value => typeof value === "string").map(value => value.slice(0, 500)).join(" ");
  if (/(今日|当天).{0,30}失败次数.{0,15}(上限|过多)/.test(text) || /失败次数.{0,20}上限.{0,15}明天/.test(text)) {
    return { reason: "login_daily_limit", message: "旧站今日登录失败次数已达上限，请明天再试，或联系旧站管理员核实。已停止自动重登，今天不再重复提交。" };
  }
  if (code === "-7") return { reason: "login_conflict", message: "账号已在其他设备登录，已停止自动重登。" };
  if (code === "9901") return { reason: "account_disabled", message: "旧站账号已禁用，已停止自动重登。" };
  if (code === "1011") return { reason: "device_restricted", message: "旧站限制了此浏览器标识，请联系旧站管理员。" };
  if (response.httpStatus === 429) return { reason: "login_rate_limited", message: "旧站限制了登录请求频率，请稍后再试，已停止自动重登。" };
  if (response.httpStatus >= 500) return { reason: "login_service_unavailable", message: "旧站登录服务暂时异常，请稍后再试；这次不能据此判断密码是否正确。" };
  if (!response.payload || typeof response.payload !== "object") return { reason: "login_response_invalid", message: "旧站未返回有效的登录接口响应，可能是访问拦截或服务异常；这次不能据此判断密码是否正确。" };
  if (response.payload?.data?.needSelect) return { reason: "company_selection_required", message: "旧站要求选择企业，请先核实目标企业，未自动选择账号。" };
  // Official Login-7yHdo_By.js maps these codes explicitly. Keep local messages
  // instead of echoing upstream text, which can contain credentials.
  if (code === "1000101") return { reason: "credentials_rejected", message: "旧站返回“用户名或密码错误”（1000101）。请核对与 hejun.ecbis.cn 登录页相同的账号密码，或使用已绑定账号扫码连接。已停止自动重登。" };
  if (code === "1000104") return { reason: "account_unavailable", message: "旧站返回“账号不可用”（1000104），请联系旧站管理员核实，已停止自动重登。" };
  if (code === "1000105") return { reason: "phone_not_registered", message: "旧站返回“手机号未注册”（1000105），请核对该旧站的登录账号，或使用已绑定账号扫码连接。" };
  return { reason: "login_failed", message: "旧站拒绝了本次登录，尚不能确认是账号密码还是登录限制。请先查看旧站提示；若已达到今日失败上限，请停止重试。" };
}

export function nextShanghaiDay(now) {
  return new Date(Math.floor((now + 8 * 3600000) / 86400000) * 86400000 + 86400000 - 8 * 3600000).toISOString();
}

// Preserve a known password-login cooldown while using the independent QR flow.
export function passwordLoginHold(session, now = Date.now()) {
  const hold = session.passwordLoginHold || (session.authFailure === "login_daily_limit"
    ? { userName: session.userName, until: session.loginRetryAfter, message: session.message, diagnostic: session.authDiagnostic || null } : null);
  return hold && Date.parse(hold.until) > now ? hold : null;
}
