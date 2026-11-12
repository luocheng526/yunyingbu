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
      return { name: item.name, value: item.value };
    })
  };
}

export async function pollQrLogin({ uuid, jar, fetchImpl = fetch }) {
  const next = (jar || []).map(function (item) {
    return { name: item.name, value: item.value };
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
        return { name: item.name, value: item.value };
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
      return { name: item.name, value: item.value };
    })
  };
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
  fetchHome: fetchHome,
  startQr: startQrLogin,
  pollQr: pollQrLogin
};
