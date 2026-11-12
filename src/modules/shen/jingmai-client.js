import { classifyTransportError, jingmaiError, parseRealtime } from "./jingmai.js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const SUMMARY_URL = "https://sz.jd.com/sz/api/realtime/realtimeSummary/getSummary.ajax?channel=99";
const LOGIN_PAGE = "https://passport.shop.jd.com/login/index.action?ReturnUrl=" + encodeURIComponent("https://sz.jd.com/");
const LOGIN_POST = "https://passport.shop.jd.com/login/doLogin";
const SESSION_COOKIES = new Set(["thor", "pin", "pt_key", "pt_pin", "flash", "light_key"]);

export function cookieHeader(jar) {
  return (jar || [])
    .filter(function (item) {
      return item && item.name && item.value != null;
    })
    .map(function (item) {
      return item.name + "=" + item.value;
    })
    .join("; ");
}

export function absorbCookies(response, jar) {
  const lines = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  lines.forEach(function (line) {
    const pair = String(line).split(";")[0];
    const index = pair.indexOf("=");
    if (index < 1) {
      return;
    }
    const name = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    const found = jar.findIndex(function (item) {
      return item.name === name;
    });
    const next = { name: name, value: value };
    if (found >= 0) {
      jar[found] = next;
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

async function request(fetchImpl, jar, url, options) {
  try {
    const response = await fetchImpl(url, {
      method: options.method || "GET",
      redirect: "manual",
      body: options.body,
      signal: options.signal || AbortSignal.timeout(20000),
      headers: Object.assign(
        {
          "user-agent": UA,
          cookie: cookieHeader(jar)
        },
        options.headers || {}
      )
    });
    absorbCookies(response, jar);
    return response;
  } catch (error) {
    throw classifyTransportError(error);
  }
}

export async function loginShop(username, password, fetchImpl = fetch) {
  const jar = [];
  const page = await request(fetchImpl, jar, LOGIN_PAGE, {});
  await page.text();
  const posted = await request(fetchImpl, jar, LOGIN_POST, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      origin: "https://passport.shop.jd.com",
      referer: "https://passport.shop.jd.com/login/index.action"
    },
    body: new URLSearchParams({
      loginName: username,
      password: password,
      ReturnUrl: "https://sz.jd.com/"
    })
  });
  let status = posted.status;
  let location = posted.headers.get("location") || "";
  let text = await posted.text();
  let hops = 0;
  while (status >= 300 && status < 400 && location && hops < 5) {
    const next = await request(fetchImpl, jar, new URL(location, "https://passport.shop.jd.com/").toString(), {});
    status = next.status;
    location = next.headers.get("location") || "";
    text = await next.text();
    hops += 1;
  }
  if (/验证码|滑块|安全验证|密码错误|账号或密码/.test(text) || !hasSession(jar)) {
    throw jingmaiError("login", "登录已失效，请重新登录");
  }
  return jar.map(function (item) {
    return { name: item.name, value: item.value };
  });
}

export async function fetchHome(jar, fetchImpl = fetch) {
  const response = await request(fetchImpl, jar.slice(), SUMMARY_URL, {
    headers: {
      accept: "application/json, text/plain, */*",
      referer: "https://sz.jd.com/realtime/realtimeSummarys.html"
    }
  });
  const text = await response.text();
  return parseRealtime(response.status, text, response.headers.get("location"));
}

export const jingmaiClient = {
  login: loginShop,
  fetchHome: fetchHome
};
