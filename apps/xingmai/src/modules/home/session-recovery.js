/** One normal password submission; platform verification always belongs to the user. */
export async function recoverPasswordSession(deps, credentials, signal) {
  const fail = (message, code = "login", needsHuman = true) => {
    throw Object.assign(new Error(message), { code, needsHuman });
  };
  const check = page => {
    if (signal?.aborted || (deps.allowed && !deps.allowed())) fail("采集已取消", "timeout", false);
    const limited = deps.limit();
    if (limited) fail(limited, "platform_limited", false);
    const text = String(page?.text || "");
    if (/操作频繁|请求拦截|访问频繁|请求过于频繁/.test(text)) fail("京东限制当前登录请求，请稍后重试", "platform_limited", false);
    if (page?.codeVisible || /滑块|安全验证|请完成.{0,8}验证|请输入.{0,8}验证码|登录异常|账号异常|密码.{0,6}错误|账号或密码不正确/.test(text)) {
      fail("京东要求验证或拒绝自动登录，请在服务器登录窗口处理");
    }
  };
  const isLogin = page => {
    try {
      const url = new URL(page?.href || "");
      return url.protocol === "https:" && ["passport.jd.com", "passport.shop.jd.com"].includes(url.hostname);
    } catch { return false; }
  };
  let submitted = false;
  for (let attempt = 0; attempt < 64; attempt++) {
    const page = await deps.page();
    check(page);
    // A slow/blank page is retryable; an unexpected web host must never receive
    // credentials or be accepted as the merchant session.
    try {
      const url = new URL(page?.href || "about:blank");
      if (/^https?:$/.test(url.protocol) && !["shop.jd.com", "passport.jd.com", "passport.shop.jd.com"].includes(url.hostname)) {
        fail("登录页面地址异常，请在服务器登录窗口检查");
      }
    } catch (error) { if (error.needsHuman) throw error; }
    // This callback must verify the native shop identity before returning cookies.
    if (page && !isLogin(page)) {
      const cookies = await deps.verifiedSession(page);
      if (cookies?.length) return cookies;
    }
    if (!submitted && isLogin(page) && page.accountVisible && page.passwordVisible) {
      if (!credentials?.loginName || !credentials?.password) fail("组织中心缺少登录账号，请在服务器登录窗口处理");
      submitted = true;
      let filled = false;
      try { filled = await deps.submit(credentials.loginName, credentials.password); }
      catch { fail("自动登录表单暂时无法提交，冷却后自动重试", "login", false); }
      if (!filled) fail("京东登录表单暂未就绪，冷却后自动重试", "login", false);
    }
    await deps.sleep(500, signal);
  }
  fail(submitted ? "自动登录暂未完成，冷却后自动重试" : "京东登录表单暂未就绪，冷却后自动重试", "login", false);
}
