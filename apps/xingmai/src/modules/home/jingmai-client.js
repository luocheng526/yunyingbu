import crypto from "node:crypto";
import vm from "node:vm";
import {
  accountIdentity,
  businessFieldCode,
  classifyTransportError,
  collectPinIds,
  collectPinRecords,
  pinsForLoggedInShop,
  extractPaid,
  describeShopPayload,
  extractShopDeal,
  jingmaiError,
  paidQuery,
  parseRealtime,
  beijingParts,
  withDeadline
} from "./jingmai.js";
import { readHomeDeal, readJztOverview, reloginHomeSession } from "./jingmai-desk.js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const SUMMARY_URL = "https://sz.jd.com/sz/api/realtime/realtimeSummary/getSummary.ajax?channel=99";
const LOGIN_PAGE = "https://passport.shop.jd.com/login/index.action?ReturnUrl=" + encodeURIComponent("https://sz.jd.com/");
const PASSWORD_INIT = "https://passport.jd.com/login/component/v1/init";
const PASSWORD_SUBMIT = "https://passport.jd.com/login/component/v1/loginSubmit";
const SUMMER_URL = "https://jrsecstatic.jdpay.com/jr-sec-dev-static/summer-cryptico-h5.min.js";
const LOGIN_POST = "https://passport.shop.jd.com/login/doLogin";
const SESSION_COOKIES = new Set(["thor", "pin", "pt_key", "pt_pin", "flash", "light_key"]);

export function defaultCookiePath(pathname) {
  const path = String(pathname || "/");
  if (!path.startsWith("/")) {
    return "/";
  }
  const index = path.lastIndexOf("/");
  if (index <= 0) {
    return "/";
  }
  return path.slice(0, index) || "/";
}

export function cookieMatchesUrl(cookie, urlString) {
  if (!cookie || !cookie.name || cookie.value == null || cookie.value === "") {
    return false;
  }
  let url;
  try {
    url = new URL(String(urlString || ""));
  } catch {
    return false;
  }
  if (cookie.expires != null && Number(cookie.expires) >= 0 && Number(cookie.expires) * 1000 <= Date.now()) {
    return false;
  }
  if (cookie.secure && url.protocol !== "https:") {
    return false;
  }
  const host = String(url.hostname || "").toLowerCase();
  const hostOnly = cookie.hostOnly === true || (!cookie.domain && Boolean(cookie.host));
  if (hostOnly) {
    const cookieHost = String(cookie.host || "").replace(/^\./, "").toLowerCase();
    // Exact host only — sub.passport.jd.com must not receive passport.jd.com hostOnly cookies.
    if (!cookieHost || host !== cookieHost) {
      return false;
    }
  } else if (cookie.domain) {
    const domain = String(cookie.domain).replace(/^\./, "").toLowerCase();
    if (!domain || (host !== domain && !host.endsWith("." + domain))) {
      return false;
    }
  } else {
    // Unknown-origin legacy cookie (no domain/host): never spray across arbitrary URLs.
    return false;
  }
  const path = String(cookie.path || "/");
  const uPath = String(url.pathname || "/");
  if (path !== "/") {
    const prefix = path.endsWith("/") ? path : path + "/";
    if (uPath !== path && !uPath.startsWith(prefix)) {
      return false;
    }
  }
  return true;
}

export function cookieHeader(jar, url) {
  return (jar || [])
    .filter(function (item) {
      if (!item || !item.name || item.value == null || item.value === "") {
        return false;
      }
      if (!url) {
        // Without a target URL, only allow cookies that already carry an explicit scope.
        if (!item.domain && !item.host) {
          return false;
        }
        return item.expires == null || Number(item.expires) <= 0 || Number(item.expires) * 1000 > Date.now();
      }
      return cookieMatchesUrl(item, url);
    })
    .map(function (item) {
      return item.name + "=" + item.value;
    })
    .join("; ");
}

export function parseSetCookieLine(line) {
  const parts = String(line || "").split(";");
  const pair = parts[0] || "";
  const index = pair.indexOf("=");
  if (index < 1) {
    return null;
  }
  const next = {
    name: pair.slice(0, index).trim(),
    value: pair.slice(index + 1).trim()
  };
  if (!next.name) {
    return null;
  }
  let maxAge = null;
  let expiresAt = null;
  let sawMaxAge = false;
  for (let i = 1; i < parts.length; i += 1) {
    const chunk = String(parts[i] || "").trim();
    if (!chunk) {
      continue;
    }
    const eq = chunk.indexOf("=");
    const key = (eq >= 0 ? chunk.slice(0, eq) : chunk).trim().toLowerCase();
    const val = eq >= 0 ? chunk.slice(eq + 1).trim() : "";
    if (key === "domain" && val) {
      next.domain = val;
      next.hostOnly = false;
    } else if (key === "path" && val) {
      next.path = val;
    } else if (key === "expires" && val) {
      const ms = Date.parse(val);
      if (Number.isFinite(ms)) {
        expiresAt = Math.floor(ms / 1000);
      }
    } else if (key === "max-age" && val !== "") {
      const seconds = Number(val);
      if (Number.isFinite(seconds)) {
        sawMaxAge = true;
        maxAge = seconds;
      }
    } else if (key === "secure") {
      next.secure = true;
    } else if (key === "httponly") {
      next.httpOnly = true;
    } else if (key === "samesite" && val) {
      next.sameSite = val;
    }
  }
  // RFC 6265: Max-Age overrides Expires when both are present.
  if (sawMaxAge) {
    if (maxAge <= 0) {
      next.expires = 0;
      next.expired = true;
    } else {
      next.expires = Math.floor(Date.now() / 1000) + Math.floor(maxAge);
    }
  } else if (expiresAt != null) {
    next.expires = expiresAt;
    if (expiresAt * 1000 <= Date.now()) {
      next.expired = true;
    }
  }
  return next;
}

export function absorbCookies(response, jar, requestUrl) {
  const lines = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  let base = null;
  const baseHref = String((response && response.url) || requestUrl || "").trim();
  if (baseHref) {
    try {
      base = new URL(baseHref);
    } catch {
      base = null;
    }
  }
  lines.forEach(function (line) {
    const next = parseSetCookieLine(line);
    if (!next) {
      return;
    }
    if (next.domain) {
      next.hostOnly = false;
      next.host = String(next.domain).replace(/^\./, "").toLowerCase();
    } else if (base) {
      // No Domain attribute → host-only cookie bound to the response/request host.
      next.hostOnly = true;
      next.host = String(base.hostname || "").toLowerCase();
      delete next.domain;
    } else {
      // Cannot infer origin — keep unscopeable so cookieHeader never sprays it.
      next.hostOnly = true;
    }
    if (!next.path) {
      next.path = base ? defaultCookiePath(base.pathname) : "/";
    }
    const found = jar.findIndex(function (item) {
      if (!item || item.name !== next.name) {
        return false;
      }
      if (next.hostOnly || item.hostOnly) {
        return String(item.host || "") === String(next.host || "") && String(item.path || "/") === String(next.path || "/");
      }
      if (next.domain && item.domain && String(item.domain) !== String(next.domain)) {
        return false;
      }
      if (next.path && item.path && String(item.path) !== String(next.path)) {
        return false;
      }
      return true;
    });
    const expired =
      next.expired === true ||
      next.value === "" ||
      (next.expires != null && Number(next.expires) >= 0 && Number(next.expires) * 1000 <= Date.now());
    if (expired) {
      if (found >= 0) {
        jar.splice(found, 1);
      }
      return;
    }
    if (found >= 0) {
      jar[found] = Object.assign({}, jar[found], next);
    } else {
      jar.push(next);
    }
  });
  return jar;
}

function hasSession(jar) {
  return jar.some(function (item) {
    return SESSION_COOKIES.has(item.name) && item.value;
  });
}

function linkSignals(extra, budgetMs) {
  const timeout = AbortSignal.timeout(budgetMs == null ? 20000 : budgetMs);
  if (!extra) {
    return timeout;
  }
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([extra, timeout]);
  }
  if (extra.aborted) {
    return extra;
  }
  const controller = new AbortController();
  const forward = function () {
    try {
      controller.abort();
    } catch {
      /* already aborted */
    }
  };
  extra.addEventListener("abort", forward, { once: true });
  timeout.addEventListener("abort", forward, { once: true });
  return controller.signal;
}

async function request(fetchImpl, jar, url, options) {
  try {
    const response = await fetchImpl(url, {
      method: options.method || "GET",
      redirect: "manual",
      body: options.body,
      signal: linkSignals(options.signal, options.timeoutMs),
      headers: Object.assign(
        {
          "user-agent": UA,
          cookie: cookieHeader(jar, url)
        },
        options.headers || {}
      )
    });
    absorbCookies(response, jar, url);
    return response;
  } catch (error) {
    throw classifyTransportError(error);
  }
}

export async function loginShop(username, password, fetchImpl = fetch) {
  const opened = await openPasswordSession(fetchImpl);
  const jar = await submitPasswordSession({
    jar: opened.jar,
    init: opened.init,
    loginName: username,
    password: password,
    fetchImpl: fetchImpl
  });
  if (!hasSession(jar)) {
    throw jingmaiError("login", "登录已失效，请重新登录");
  }
  return jar.map(function (item) {
    return Object.assign({}, item);
  });
}

export function interpretQrCheck(body) {
  const info = body && body.resultInfo ? body.resultInfo : {};
  const result = info.result || {};
  const state = Number(result.state);
  if (state === 10) {
    return "waiting";
  }
  if (state === 0) {
    return "confirm";
  }
  if (state === 1) {
    return "ok";
  }
  if (state === 11 || state === 12) {
    return "expired";
  }
  if (state === 213) {
    return "cancelled";
  }
  return "waiting";
}

export async function startQrLogin(fetchImpl = fetch) {
  const jar = [];
  const init = await request(fetchImpl, jar, "https://passport.jd.com/service/mobile/initLoginPageData?source=pop_new_mobile", {
    headers: { accept: "application/json", referer: "https://passport.shop.jd.com/login/index.action" }
  });
  const initBody = JSON.parse(await init.text());
  const uuid = String(initBody.data && initBody.data.uuid ? initBody.data.uuid : "").replace(/-/g, "");
  if (!uuid) {
    throw jingmaiError("network", "京麦二维码暂时开不了");
  }
  const shown = await request(
    fetchImpl,
    jar,
    "https://passport.shop.jd.com/login/json/qrcode_show.action?_timeStr=" + Date.now() + uuid,
    { headers: { accept: "image/png,*/*", referer: "https://passport.shop.jd.com/login/index.action" } }
  );
  const bytes = Buffer.from(await shown.arrayBuffer());
  if (bytes[0] !== 0x89) {
    throw jingmaiError("network", "京麦二维码暂时开不了");
  }
  return {
    uuid: uuid,
    image: bytes.toString("base64"),
    jar: jar.map(function (item) {
      return Object.assign({}, item);
    })
  };
}

export async function pollQrLogin({ uuid, jar, fetchImpl = fetch }) {
  const next = (jar || []).map(function (item) {
    return Object.assign({}, item);
  });
  const checked = await request(
    fetchImpl,
    next,
    "https://passport.shop.jd.com/login/json/qrcode_check.action?_timeStr=" + Date.now() + uuid,
    {
      method: "POST",
      body: "",
      headers: {
        accept: "application/json",
        origin: "https://passport.shop.jd.com",
        referer: "https://passport.shop.jd.com/login/index.action",
        "x-requested-with": "XMLHttpRequest",
        "content-type": "application/x-www-form-urlencoded"
      }
    }
  );
  const body = JSON.parse(await checked.text());
  const status = interpretQrCheck(body);
  if (status !== "ok") {
    return {
      status: status,
      jar: next.map(function (item) {
        return Object.assign({}, item);
      })
    };
  }
  let location = (body.resultInfo && body.resultInfo.result && body.resultInfo.result.returnUrl) || "https://shop.jd.com/";
  let hops = 0;
  while (location && hops < 5) {
    const followed = await request(fetchImpl, next, location, {
      headers: { referer: "https://passport.shop.jd.com/login/index.action" }
    });
    await followed.arrayBuffer();
    const jump = followed.headers.get("location") || "";
    if (followed.status < 300 || followed.status >= 400 || !jump) {
      break;
    }
    location = new URL(jump, location).toString();
    hops += 1;
  }
  return {
    status: "ok",
    jar: next.map(function (item) {
      return Object.assign({}, item);
    })
  };
}

export function passwordFailureMessage(body) {
  const data = body && body.data ? body.data : {};
  const msg = String(
    (body && (body.msg || body.message || body.errorMsg)) ||
      (data && (data.msg || data.message || data.tip || data.errorMsg)) ||
      ""
  );
  if (data.emptyAuthcode || /验证码|滑块|安全验证/.test(msg)) {
    return "请先完成滑动验证";
  }
  if (/账号异常|暂无法登录|冻结|停用|环境异常/.test(msg)) {
    return "当前账号异常，暂无法登录";
  }
  if (msg) {
    return msg.slice(0, 80);
  }
  return "账号或密码不正确";
}

let summerEncrypt = null;

async function encryptPayload(publicKey, text, fetchImpl) {
  if (!summerEncrypt) {
    const response = await fetchImpl(SUMMER_URL);
    const source = await response.text();
    const sandbox = {
      console,
      navigator: { userAgent: UA },
      document: { createElement: function () { return {}; } },
      atob: function (value) {
        return Buffer.from(value, "base64").toString("binary");
      },
      btoa: function (value) {
        return Buffer.from(value, "binary").toString("base64");
      }
    };
    sandbox.window = sandbox;
    sandbox.self = sandbox;
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox);
    summerEncrypt = sandbox.SummerCryptico.encryptData.bind(sandbox.SummerCryptico);
  }
  return summerEncrypt(publicKey, text);
}

function rsaPassword(publicKey, password) {
  const pem = "-----BEGIN PUBLIC KEY-----\n" + String(publicKey).match(/.{1,64}/g).join("\n") + "\n-----END PUBLIC KEY-----\n";
  return crypto.publicEncrypt({ key: pem, padding: crypto.constants.RSA_PKCS1_PADDING }, Buffer.from(password)).toString("base64");
}

export async function openPasswordSession(fetchImpl = fetch, seedJar) {
  const jar = Array.isArray(seedJar)
    ? seedJar.filter(Boolean).map(function (item) {
        return Object.assign({}, item);
      })
    : [];
  const response = await request(fetchImpl, jar, PASSWORD_INIT, {
    method: "POST",
    body: "source=pop_new&channel=pc&nr=1&h5st=none&seqSid=none&eid=NONE&fp=NONE&ssoDomains=sso.jd.com",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      origin: "https://passport.shop.jd.com",
      referer: "https://passport.shop.jd.com/login/index.action",
      "x-requested-with": "XMLHttpRequest"
    }
  });
  const body = JSON.parse(await response.text());
  const data = body.data || {};
  if (body.code !== 1 || !data.publicKey || !data.aksPublicKey) {
    throw jingmaiError("network", "京麦登录暂时开不了");
  }
  const captcha = data.graphicCaptcha || {};
  return {
    sessionId: captcha.graphicCaptchaSessionId || "",
    jar: jar.map(function (item) {
      return Object.assign({}, item);
    }),
    init: {
      uuid: data.uuid,
      loginId: data.loginId,
      saToken: data.sa_token,
      publicKey: data.publicKey,
      aksPublicKey: data.aksPublicKey,
      useSlideAuthCode: data.useSlideAuthCode,
      jwt: captcha.graphicCaptchaJwtToken || "",
      sessionId: captcha.graphicCaptchaSessionId || ""
    }
  };
}

export async function submitPasswordSession({ jar, init, loginName, password, authCode, fetchImpl = fetch }) {
  const next = (jar || []).map(function (item) {
    return Object.assign({}, item);
  });
  const payload = {
    source: "pop_new",
    eid: "NONE",
    fp: "NONE",
    seqSid: "none",
    ssoDomains: "sso.jd.com",
    channel: "pc",
    h5st: "none",
    nr: 1,
    uuid: init.uuid,
    loginId: init.loginId,
    saToken: init.saToken,
    publicKey: init.publicKey,
    useSlideAuthCode: init.useSlideAuthCode,
    loginName: loginName,
    loginPwd: rsaPassword(init.publicKey, password),
    _stk: loginName,
    authCode: authCode || "",
    ReturnUrl: "https://shop.jd.com",
    graphicCaptchaJwtToken: init.jwt || "",
    graphicCaptchaSessionId: init.sessionId || "",
    graphicCaptchaVerifyToken: authCode || ""
  };
  const cipher = await encryptPayload(init.aksPublicKey, new URLSearchParams(payload).toString(), fetchImpl);
  const response = await request(fetchImpl, next, PASSWORD_SUBMIT, {
    method: "POST",
    body: new URLSearchParams({ aksParamsB: cipher }).toString(),
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      origin: "https://passport.shop.jd.com",
      referer: "https://passport.shop.jd.com/login/index.action",
      "x-requested-with": "XMLHttpRequest"
    }
  });
  const body = JSON.parse(await response.text());
  if (body.code !== 1) {
    const message = passwordFailureMessage(body);
    // A rejected request is not evidence that the saved session or password is
    // invalid. Preserve the session so the browser route can still recover it.
    if (/参数.*(?:为空|不合法|无效|错误|缺失)|(?:invalid|missing)\s+(?:parameter|param|argument)/i.test(message)) {
      throw jingmaiError("network", "京麦自动登录请求被拒绝（" + message + "），请使用服务器登录窗口");
    }
    throw jingmaiError("login", message);
  }
  let location = (body.data && (body.data.returnUrl || body.data.redirectUrl)) || "https://shop.jd.com/";
  let hops = 0;
  while (location && hops < 5) {
    const followed = await request(fetchImpl, next, location, {
      headers: { referer: "https://passport.shop.jd.com/login/index.action" }
    });
    await followed.arrayBuffer();
    const jump = followed.headers.get("location") || "";
    if (followed.status < 300 || followed.status >= 400 || !jump) {
      break;
    }
    location = new URL(jump, location).toString();
    hops += 1;
  }
  return next;
}

const SHOP_APP = "P9Q5MDPM2DHRJOCY4UDL";
const SHELL_APP = "1VLIXQT5B1IEYHXSVHRV";
const SHOP_DATA_API = "dsm.shop.center.shopDataFacade.findShopDataByChannel";
const ACCOUNT_API = "dsm.shop.pageframe.navigation.accountFacade.findAccountInfo";
const JZT_ORIGIN = "https://jzt-api.jd.com";

function dsmUrl(appId, api) {
  return "https://sff.jd.com/api?v=1.0&appId=" + appId + "&api=" + api;
}

function readJson(status, text, location) {
  if (status === 401 || status === 403) {
    throw jingmaiError("login", "登录已失效，请重新登录");
  }
  if (status >= 300 && status < 400 && /login|passport/i.test(String(location || ""))) {
    throw jingmaiError("login", "登录已失效，请重新登录");
  }
  const trimmed = String(text || "").trim();
  if (!trimmed || trimmed.startsWith("<")) {
    if (/未登录|请登录|passport/i.test(trimmed.slice(0, 800))) {
      throw jingmaiError("login", "登录已失效，请重新登录");
    }
    throw jingmaiError("network", "京麦没有返回数据");
  }
  let body;
  try {
    body = JSON.parse(trimmed);
  } catch {
    throw jingmaiError("network", "京麦没有返回数据");
  }
  const code = body && (body.code != null ? body.code : body.status);
  const message = String((body && (body.msg || body.message)) || "");
  if (code === 1001 || code === 401 || code === "1001" || /未登录|请登录/.test(message)) {
    throw jingmaiError("login", "登录已失效，请重新登录");
  }
  return body;
}

async function postJson(fetchImpl, jar, url, body, headers, signal) {
  const response = await request(fetchImpl, jar, url, {
    method: "POST",
    body: JSON.stringify(body || {}),
    signal: signal,
    headers: Object.assign(
      {
        accept: "application/json, text/plain, */*",
        "content-type": "application/json;charset=UTF-8"
      },
      headers || {}
    )
  });
  return readJson(response.status, await response.text(), response.headers.get("location"));
}

async function getJson(fetchImpl, jar, url, headers, signal) {
  const response = await request(fetchImpl, jar, url, { headers: headers || {}, signal: signal });
  return readJson(response.status, await response.text(), response.headers.get("location"));
}

function dsmHeaders() {
  return {
    accept: "application/json, text/plain, */*",
    "x-requested-with": "XMLHttpRequest",
    "dsm-platform": "pc",
    "dsm-lang": "zh-CN",
    "jm-platform": "web",
    "dsm-fv": "0.0.0",
    origin: "https://shop.jd.com",
    referer: "https://shop.jd.com/jdm/home"
  };
}

function dsmProblem(body) {
  if (!body || typeof body !== "object" || body.code == null) {
    return "";
  }
  if (String(body.code) === "200") {
    return "";
  }
  const message = String(body.msg || body.message || "")
    .replace(/\s+/g, " ")
    .slice(0, 48);
  if (/cookie|thor|pt_key|password/i.test(message)) {
    return String(body.code);
  }
  return (String(body.code) + " " + message).trim();
}

async function postDsm(fetchImpl, jar, appId, api, body, signal) {
  const payload = await postJson(fetchImpl, jar, dsmUrl(appId, api), body, dsmHeaders(), signal);
  const problem = dsmProblem(payload);
  if (problem) {
    throw jingmaiError("network", "京麦首页 " + problem);
  }
  return payload;
}

function dealGapMs() {
  const value = Number(process.env.SHEN_DEAL_RETRY_MS);
  return Number.isFinite(value) && value >= 0 ? Math.min(value, 800) : 800;
}

function dealBusy(error) {
  return /601|操作频繁/.test(String((error && error.message) || ""));
}

let dealActive = 0;
const dealWaiters = [];

function dealGateMs() {
  const value = Number(process.env.SHEN_DEAL_GATE_MS);
  return Number.isFinite(value) && value > 0 ? value : 25000;
}

function enqueueDeal(task, signal) {
  return new Promise(function (resolve, reject) {
    let queued = false;
    const run = function () {
      queued = false;
      if (signal && signal.aborted) {
        reject(jingmaiError("timeout", "采集超时"));
        const next = dealWaiters.shift();
        if (next) {
          setTimeout(next, dealGapMs());
        }
        return;
      }
      dealActive += 1;
      Promise.resolve()
        .then(function () {
          return withDeadline(task, dealGateMs(), "采集超时", signal);
        })
        .then(resolve, reject)
        .finally(function () {
          dealActive -= 1;
          const next = dealWaiters.shift();
          if (next) {
            setTimeout(next, dealGapMs());
          }
        });
    };
    const onAbort = function () {
      if (!queued) {
        return;
      }
      const index = dealWaiters.indexOf(run);
      if (index < 0) {
        return;
      }
      dealWaiters.splice(index, 1);
      queued = false;
      reject(jingmaiError("timeout", "采集超时"));
    };
    if (signal) {
      if (signal.aborted) {
        reject(jingmaiError("timeout", "采集超时"));
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }
    if (dealActive < 3) {
      run();
    } else {
      queued = true;
      dealWaiters.push(run);
    }
  });
}

async function fetchShopDealOnce(jar, fetchImpl, signal) {
  let field = "";
  try {
    const account = await postDsm(fetchImpl, jar, SHELL_APP, ACCOUNT_API, {}, signal);
    field = businessFieldCode(account);
  } catch (error) {
    if (classifyTransportError(error).code === "login") {
      throw classifyTransportError(error);
    }
  }
  const belongParam = field ? { businessFieldCode: field } : {};
  const attempts = [{ channelCode: "99" }, {}];
  let last = "";
  for (let index = 0; index < attempts.length; index += 1) {
    try {
      const payload = await postDsm(
        fetchImpl,
        jar,
        SHOP_APP,
        SHOP_DATA_API,
        {
          request: { belongParam: belongParam, bizRequest: attempts[index] }
        },
        signal
      );
      const metrics = extractShopDeal(payload);
      if (metrics) {
        return metrics;
      }
      last = "京麦首页没有成交字段 " + describeShopPayload(payload) + (field ? " field=yes" : " field=no");
    } catch (error) {
      const classified = classifyTransportError(error);
      if (classified.code === "login") {
        throw classified;
      }
      if (dealBusy(classified)) {
        throw classified;
      }
      last = classified.message || last;
    }
  }
  throw jingmaiError("network", last || "京麦首页没有成交字段");
}

async function fetchShopDeal(jar, fetchImpl, signal) {
  // Do not repeatedly hit a rejected legacy API. Preserve the existing
  // authenticated browser path; an explicit browser limit stops the shop.
  return fetchShopDealOnce(jar, fetchImpl, signal);
}

async function fetchSzDeal(jar, fetchImpl, signal) {
  const response = await request(fetchImpl, jar.slice(), SUMMARY_URL, {
    signal: signal,
    headers: {
      accept: "application/json, text/plain, */*",
      referer: "https://sz.jd.com/realtime/realtimeSummarys.html"
    }
  });
  return parseRealtime(response.status, await response.text(), response.headers.get("location"));
}

async function fetchDeal(jar, fetchImpl, readCard, signal, shopKeyOrExpected) {
  let shopError = null;
  try {
    return await enqueueDeal(function (gateSignal) {
      return fetchShopDeal(jar, fetchImpl, gateSignal || signal);
    }, signal);
  } catch (error) {
    shopError = classifyTransportError(error);
  }
  if (signal && signal.aborted) {
    throw jingmaiError("timeout", "采集超时");
  }
  try {
    return await fetchSzDeal(jar, fetchImpl, signal);
  } catch (error) {
    shopError = shopError || classifyTransportError(error);
  }
  if (signal && signal.aborted) {
    throw jingmaiError("timeout", "采集超时");
  }
  const reader = readCard || (fetchImpl === fetch ? readHomeDeal : null);
  if (reader && jar && jar.length) {
    try {
      const card = await reader(jar, signal, shopKeyOrExpected || "");
      if (card && (card.dealAmount != null || card.orderCount != null || card.customerCount != null || card.dealUnavailable === true)) {
        return card;
      }
    } catch (error) {
      const browserError = classifyTransportError(error);
      if (["identity", "login", "platform_limited"].includes(browserError.code) || !shopError) shopError = browserError;
    }
  }
  throw shopError || jingmaiError("network", "京麦首页没有成交字段");
}

function jztHeaders() {
  return {
    accept: "application/json, text/plain, */*",
    siteId: "0",
    origin: "https://jzt.jd.com",
    referer: "https://jzt.jd.com/custom-report/"
  };
}

function paidAccountError(payload) {
  const code = payload && payload.code != null ? String(payload.code) : "";
  const message = String((payload && (payload.msg || payload.message)) || "")
    .replace(/\s+/g, " ")
    .slice(0, 36);
  return ("京准通没有可用账号" + (code ? " " + code : "") + (message ? " " + message : "")).trim();
}

async function followRedirectChain(fetchImpl, jar, startUrl, headers, signal, maxHops) {
  let current = startUrl;
  let lastStatus = 0;
  for (let hop = 0; hop < (maxHops || 8); hop += 1) {
    if (signal && signal.aborted) {
      throw jingmaiError("timeout", "采集超时");
    }
    const response = await request(fetchImpl, jar, current, {
      signal: signal,
      timeoutMs: 20000,
      headers: headers || {}
    });
    lastStatus = response.status;
    const location = response.headers.get("location") || "";
    try {
      await response.arrayBuffer();
    } catch {
      /* body optional while hopping SSO */
    }
    if (lastStatus >= 300 && lastStatus < 400 && location) {
      current = new URL(location, current).toString();
      continue;
    }
    return { url: current, status: lastStatus };
  }
  return { url: current, status: lastStatus };
}

async function warmJzt(jar, fetchImpl, signal) {
  // Real SSO chain: shop session → follow redirects into JZT (not a single manual hit).
  try {
    await followRedirectChain(
      fetchImpl,
      jar,
      "https://shop.jd.com/jdm/home",
      {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        referer: "https://shop.jd.com/"
      },
      signal,
      6
    );
  } catch (error) {
    if (classifyTransportError(error).code === "timeout") {
      throw error;
    }
  }
  try {
    const landed = await followRedirectChain(
      fetchImpl,
      jar,
      "https://jzt.jd.com/custom-report/",
      {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        referer: "https://shop.jd.com/jdm/home"
      },
      signal,
      8
    );
    if (/passport\.|\/login/i.test(String(landed.url || ""))) {
      throw jingmaiError("paid", "京准通跨域登录未完成");
    }
  } catch (error) {
    const classified = classifyTransportError(error);
    if (classified.code === "timeout") {
      throw classified;
    }
    if (classified.code === "paid") {
      throw classified;
    }
    /* pinlist still runs; warm only seeds SSO cookies */
  }
}

async function fetchPaid(jar, fetchImpl, signal, expected) {
  const headers = jztHeaders();
  await warmJzt(jar, fetchImpl, signal);
  if (signal && signal.aborted) {
    throw jingmaiError("timeout", "采集超时");
  }
  let user = null;
  try {
    user = await getJson(
      fetchImpl,
      jar,
      JZT_ORIGIN + "/dataCenter/index/user/pinlist?requestFrom=0",
      headers,
      signal
    );
  } catch (error) {
    const classified = classifyTransportError(error);
    if (classified.code === "login") {
      throw jingmaiError("paid", "京准通账号未授权或需要重新开通");
    }
    throw jingmaiError("paid", classified.message || "京准通暂时读不到账号");
  }
  let auth = null;
  try {
    auth = await getJson(
      fetchImpl,
      jar,
      JZT_ORIGIN + "/dataCenter/index/auth/pinlist?requestFrom=0",
      headers,
      signal
    );
  } catch (error) {
    const classified = classifyTransportError(error);
    if (classified.code !== "login" && classified.code !== "paid") {
      /* own-account list is enough when auth list is flaky */
    } else if (!user || Number(user.code) !== 1) {
      throw jingmaiError("paid", classified.message || "京准通账号未授权");
    }
  }
  const userData = user && Number(user.code) === 1 ? user.data : null;
  const authData = auth && Number(auth.code) === 1 ? auth.data : null;
  const records = collectPinRecords(userData, authData);
  if (!records.length) {
    const payload = user && user.code != null ? user : auth;
    if (fetchImpl === fetch && payload && Number(payload.code) !== 1) {
      return readJztOverview(jar, signal, expected);
    }
    throw jingmaiError("paid", paidAccountError(payload));
  }
  // Ownership must come from JZT pin metadata belonging to this shop — not Jingmai DSM identity.
  const wantId = String((expected && expected.shopId) || "").trim();
  const wantName = String((expected && (expected.shopName || expected.store)) || "").trim();
  let matched = records;
  if (wantId || wantName) {
    matched = pinsForLoggedInShop(records, expected);
    if (!matched.length) {
      // Real shop ids on the pins belong to a different shop. Do not mix them in.
      throw jingmaiError("paid", "待核验：无本店广告账号证据");
    }
  }
  const pinIds = matched.map(function (row) {
    return row.pinId;
  });
  const day = beijingParts().day;
  const overview = await postJson(
    fetchImpl,
    jar,
    JZT_ORIGIN + "/dataCenter/index/v2/summary/overview?requestFrom=0",
    paidQuery(day, pinIds),
    Object.assign({ "content-type": "application/json" }, headers),
    signal
  );
  if (overview && overview.code != null && Number(overview.code) !== 1) {
    throw jingmaiError("paid", "京准通没有返回付费数据");
  }
  const paid = extractPaid(overview && overview.code === 1 ? overview.data : overview);
  if (!paid) {
    throw jingmaiError("paid", "京准通没有返回付费数据");
  }
  return paid;
}

function hasDealFields(metrics) {
  return ["dealAmount", "orderCount", "customerCount", "yesterdayAmount"].some(function (key) {
    return metrics && metrics[key] != null;
  });
}

function hasCollected(metrics) {
  return ["dealAmount", "orderCount", "customerCount", "paidAmount", "paidDeal", "paidRoi"].some(function (key) {
    return metrics[key] != null;
  });
}

export async function fetchAccountIdentity(jar, fetchImpl = fetch, signal) {
  const account = await postDsm(fetchImpl, jar, SHELL_APP, ACCOUNT_API, {}, signal);
  return accountIdentity(account);
}

function paidBudgetMs() {
  const value = Number(process.env.SHEN_PAID_BUDGET_MS);
  // Old-site collect_ads independent 40s budget (zhenxuan2 jingmai_ad_report.py).
  return Number.isFinite(value) && value > 0 ? value : 40000;
}

function linkAbort(outer, local) {
  if (!outer) {
    return local;
  }
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([outer, local]);
  }
  if (outer.aborted) {
    try {
      local.abort();
    } catch {
      /* already */
    }
    return outer;
  }
  outer.addEventListener(
    "abort",
    function () {
      try {
        local.abort();
      } catch {
        /* already */
      }
    },
    { once: true }
  );
  return local;
}

export async function fetchHome(jar, fetchImpl = fetch, readCard, signal, expected) {
  // Shapes: fetchHome(jar), fetchHome(jar, signal), fetchHome(jar, signal, expected),
  // fetchHome(jar, fetchImpl, readCard, signal, expected).
  if (fetchImpl && typeof fetchImpl === "object" && typeof fetchImpl.aborted === "boolean") {
    expected = readCard && typeof readCard === "object" && !("aborted" in readCard) ? readCard : expected;
    signal = fetchImpl;
    fetchImpl = fetch;
    readCard = undefined;
  } else if (
    fetchImpl &&
    typeof fetchImpl === "object" &&
    !("aborted" in fetchImpl) &&
    (fetchImpl.shopId != null || fetchImpl.store || fetchImpl.onDeal)
  ) {
    // fetchHome(jar, expected)
    expected = fetchImpl;
    fetchImpl = fetch;
    readCard = undefined;
  } else if (readCard && typeof readCard === "object" && typeof readCard.aborted === "boolean") {
    expected = signal && typeof signal === "object" && !("aborted" in signal) ? signal : expected;
    signal = readCard;
    readCard = undefined;
  } else if (
    readCard &&
    typeof readCard === "object" &&
    typeof readCard !== "function" &&
    !("aborted" in readCard) &&
    (readCard.shopId != null || readCard.store || readCard.onDeal)
  ) {
    // fetchHome(jar, undefined, expected) — explicit undefined skips default fetchImpl.
    expected = readCard;
    readCard = undefined;
  } else if (signal && typeof signal === "object" && !("aborted" in signal) && (signal.shopId != null || signal.store || signal.onDeal)) {
    expected = signal;
    signal = undefined;
  }
  if (typeof fetchImpl !== "function") {
    fetchImpl = fetch;
  }
  const shopKey = String((expected && (expected.shopId || expected.store)) || "").trim();
  const onDeal = expected && typeof expected.onDeal === "function" ? expected.onDeal : null;
  // Pass full expected so DOM reader can use persistent profile + shop-base-name checks.
  const dealHint = expected && typeof expected === "object" ? expected : shopKey;

  // Old-site order: parse_home / store deal first, then collect_ads (never wipe deal on ad fail).
  let dealResult;
  try {
    const value = (expected && expected.browserDeal) || await fetchDeal(jar, fetchImpl, readCard, signal, dealHint);
    dealResult = { deal: value, dealError: null };
  } catch (error) {
    dealResult = { deal: null, dealError: classifyTransportError(error) };
  }
  // Stop this shop on an identity mismatch or explicit browser-side limit.
  if (dealResult.dealError && ["identity", "platform_limited"].includes(dealResult.dealError.code)) throw dealResult.dealError;
  if (dealResult.deal && hasDealFields(dealResult.deal) && onDeal) {
    try {
      await onDeal(dealResult.deal);
    } catch {
      /* early persist must not fail the collect round */
    }
  }

  const paidLocal = typeof AbortController === "function" ? new AbortController() : null;
  const paidSignal = paidLocal ? linkAbort(signal, paidLocal.signal) : signal;
  let paidResult;
  try {
    const value = await withDeadline(
      function (inner) {
        return fetchPaid(jar, fetchImpl, inner || paidSignal, expected);
      },
      paidBudgetMs(),
      "广告采集超时",
      paidSignal
    );
    paidResult = { paid: value, paidError: null };
  } catch (error) {
    const classified = classifyTransportError(error);
    if (classified.code === "timeout" || (error && error.name === "AbortError")) {
      paidResult = { paid: null, paidError: jingmaiError("timeout", "广告采集超时") };
    } else if (classified.code === "login") {
      // JZT auth gap is paid-channel only — never flip whole-shop Jingmai login_expired here.
      paidResult = { paid: null, paidError: jingmaiError("paid", "京准通账号未授权或需要重新开通") };
    } else if (classified.code !== "paid") {
      paidResult = { paid: null, paidError: jingmaiError("paid", classified.message || "京准通暂时读不到数据") };
    } else {
      paidResult = { paid: null, paidError: classified };
    }
  }
  const deal = dealResult.deal;
  const dealError = dealResult.dealError;
  const paid = paidResult.paid;
  const paidError = paidResult.paidError;
  const metrics = Object.assign(
    {
      dealAmount: null,
      orderCount: null,
      customerCount: null,
      yesterdayAmount: null,
      paidAmount: null,
      paidDeal: null,
      paidRoi: null,
      dealNote: "",
      paidNote: ""
    },
    deal || {},
    paid || {}
  );
  if (dealError && deal == null) {
    metrics.dealNote = String(dealError.message || "京麦首页没有成交字段").slice(0, 160);
  }
  if (paidError && paid == null) {
    metrics.paidNote = String(paidError.message || "京准通暂时读不到数据").slice(0, 160);
  }
  // Keep a finished Jingmai deal even if ads timed out / outer signal aborted.
  if (hasDealFields(metrics)) {
    if (paidError && /待核验/.test(String(paidError.message || ""))) {
      metrics.paidNote = String(paidError.message).slice(0, 160);
    } else if (
      (signal && signal.aborted) ||
      (paidError && (paidError.code === "timeout" || paidError.name === "AbortError"))
    ) {
      metrics.paidNote = "广告采集超时";
    }
    return metrics;
  }
  if (signal && signal.aborted) {
    throw jingmaiError("timeout", "采集超时");
  }
  // Old-site rule: ads failure must not wipe a successful Jingmai deal snapshot.
  if (hasCollected(metrics)) {
    return metrics;
  }
  if (deal && deal.dealUnavailable) {
    throw jingmaiError("data_unavailable", [deal.dealNote, paidError && paidError.message].filter(Boolean).join("；"));
  }
  // Never join Jingmai-login and JZT/ads failures into one message — that made Han shops
  // look "login expired" and triggered endless password recover while ads was the only gap.
  if (dealError && dealError.code === "login") {
    throw jingmaiError("login", "登录已失效，请重新登录");
  }
  if (paidError && !dealError) {
    throw jingmaiError("paid", paidError.message || "京准通暂时读不到数据");
  }
  if (dealError && dealError.code === "timeout") {
    throw jingmaiError("timeout", dealError.message || "采集超时");
  }
  if (dealError && dealError.message) {
    throw jingmaiError(dealError.code || "network", String(dealError.message).slice(0, 180));
  }
  if (paidError && paidError.message) {
    throw jingmaiError("paid", String(paidError.message).slice(0, 180));
  }
  throw jingmaiError("network", "京麦没有返回数据");
}

export async function recoverBrowserSession(cookies, signal, expected = {}, deps = {}) {
  const readDeal = deps.readDeal || readHomeDeal;
  const relogin = deps.relogin || reloginHomeSession;
  let jar = (cookies || []).map(cookie => ({ ...cookie }));
  // Credentials are only supplied to the normal browser login, never to metrics.
  const { credentials, ...hint } = expected;
  let deal;
  try {
    deal = await readDeal(jar, signal, { ...hint, requireIdentity: true });
  } catch (error) {
    if (error.code !== "login" || !credentials?.loginName || !credentials?.password || signal?.aborted) throw error;
    try {
      jar = await relogin(signal, hint, credentials);
      deal = await readDeal(jar, signal, { ...hint, requireIdentity: true });
    } catch (failed) {
      failed.loginAttempted = true;
      throw failed;
    }
  }
  if (!deal || !jar.length) throw jingmaiError("login", "服务器登录需要验证，请打开这家店的登录窗口");
  return { cookies: jar, deal };
}

export const jingmaiClient = {
  login: loginShop,
  recoverBrowserSession,
  fetchHome: fetchHome,
  fetchAccountIdentity: fetchAccountIdentity,
  startQr: startQrLogin,
  pollQr: pollQrLogin,
  openPassword: openPasswordSession,
  submitPassword: submitPasswordSession
};
