const DAY_MS = 24 * 60 * 60 * 1000;

export function jingmaiError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function beijingParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });
  const parts = {};
  fmt.formatToParts(date).forEach(function (part) {
    parts[part.type] = part.value;
  });
  let hour = parts.hour === "24" ? "00" : parts.hour;
  const day = parts.year + "-" + parts.month + "-" + parts.day;
  const clock = hour + ":" + parts.minute + ":" + parts.second;
  return { day: day, clock: clock, stamp: day + " " + clock, hour: Number(hour) };
}

export function previousDay(day) {
  const date = new Date(day + "T12:00:00+08:00");
  return beijingParts(new Date(date.getTime() - DAY_MS)).day;
}

export function displayStamp(stamp) {
  return stamp ? String(stamp).replace(/-/g, "/") : "";
}

function asNumber(value) {
  if (value == null || value === "") {
    return null;
  }
  if (typeof value === "object") {
    if (Object.prototype.hasOwnProperty.call(value, "value")) {
      return asNumber(value.value);
    }
    return null;
  }
  const number = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(number) ? number : null;
}

function readField(source, names) {
  if (!source || typeof source !== "object") {
    return null;
  }
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(source, name)) {
      const number = asNumber(source[name]);
      if (number != null) {
        return number;
      }
    }
  }
  return null;
}

const DEAL_KEYS = ["OrdAmt", "ordAmt", "dealAmt", "todayDealAmt", "dealAmount", "成交金额", "今日成交金额"];
const ORDER_KEYS = ["OrdNum", "ordNum", "dealOrderNum", "orderCount", "成交单量"];
const CUSTOMER_KEYS = ["OrdCustNum", "ordCustNum", "dealUserNum", "customerCount", "成交客户数"];

export function extractMetrics(body) {
  const content = body && (body.content || body.data || body.result) ? body.content || body.data || body.result : body;
  const dealSource = content && (content.OrdAmt || content.ordAmt);
  const dealAmount = readField(content, DEAL_KEYS);
  const orderCount = readField(content, ORDER_KEYS);
  const customerCount = readField(content, CUSTOMER_KEYS);
  if (dealAmount == null && orderCount == null && customerCount == null) {
    return null;
  }
  let yesterdayAmount = null;
  if (dealSource && typeof dealSource === "object") {
    yesterdayAmount = asNumber(dealSource.preValue != null ? dealSource.preValue : dealSource.yesterday);
  }
  if (yesterdayAmount == null) {
    yesterdayAmount = readField(content, ["yesterdayDealAmt", "yesterdayAmount", "昨日成交金额"]);
  }
  return { dealAmount, orderCount, customerCount, yesterdayAmount };
}

export function parseRealtime(status, text, location) {
  if (status === 401 || status === 403) {
    throw jingmaiError("login", "登录已失效，请重新登录");
  }
  if (status >= 300 && status < 400 && /login|passport/i.test(String(location || ""))) {
    throw jingmaiError("login", "登录已失效，请重新登录");
  }
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    throw jingmaiError("network", "京麦没有返回成交数据");
  }
  if (trimmed.startsWith("<")) {
    if (/未登录|请登录|passport|login/i.test(trimmed.slice(0, 800))) {
      throw jingmaiError("login", "登录已失效，请重新登录");
    }
    throw jingmaiError("network", "京麦没有返回成交数据");
  }
  let body;
  try {
    body = JSON.parse(trimmed);
  } catch {
    throw jingmaiError("network", "京麦没有返回成交数据");
  }
  const preview = JSON.stringify(body).slice(0, 400);
  if (
    body.code === 401 ||
    body.status === 401 ||
    body.nologin === true ||
    /未登录|请登录/.test(preview)
  ) {
    throw jingmaiError("login", "登录已失效，请重新登录");
  }
  const metrics = extractMetrics(body);
  if (!metrics) {
    throw jingmaiError("network", "京麦首页没有成交字段");
  }
  return metrics;
}

export function classifyTransportError(error) {
  if (error && (error.code === "login" || error.code === "timeout" || error.code === "network")) {
    return error;
  }
  if (error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return jingmaiError("timeout", "采集超时");
  }
  return jingmaiError("network", "采集超时");
}

export function hoursFromSamples(samples, day) {
  const hours = new Array(24).fill(null);
  const rows = (samples || [])
    .filter(function (sample) {
      return sample.day === day && sample.ok !== false && sample.dealAmount != null;
    })
    .sort(function (a, b) {
      return a.capturedAt < b.capturedAt ? -1 : 1;
    });
  rows.forEach(function (sample) {
    const hour = Number(String(sample.capturedAt || "").slice(11, 13));
    if (hour >= 0 && hour < 24) {
      hours[hour] = sample.dealAmount;
    }
  });
  return hours;
}

function latestSample(samples, day) {
  let found = null;
  (samples || []).forEach(function (sample) {
    if (sample.day !== day || sample.ok === false) {
      return;
    }
    if (!found || found.capturedAt < sample.capturedAt) {
      found = sample;
    }
  });
  return found;
}

export function buildLiveView({ shops, samples, now }) {
  const day = now.day;
  const yesterday = previousDay(day);
  let updated = "";
  (samples || []).forEach(function (sample) {
    if (sample.ok === false || sample.dealAmount == null || !sample.capturedAt) {
      return;
    }
    if (!updated || updated < sample.capturedAt) {
      updated = sample.capturedAt;
    }
  });
  const viewShops = (shops || []).map(function (shop) {
    const today = latestSample(
      (samples || []).filter(function (sample) {
        return sample.store === shop.store;
      }),
      day
    );
    const prior = latestSample(
      (samples || []).filter(function (sample) {
        return sample.store === shop.store;
      }),
      yesterday
    );
    const mine = (samples || []).filter(function (sample) {
      return sample.store === shop.store;
    });
    const yesterdayAmount =
      today && today.yesterdayAmount != null ? today.yesterdayAmount : prior ? prior.dealAmount : null;
    return {
      shop: shop.store,
      enabled: shop.enabled !== false,
      loginExpired: shop.authState === "login_expired",
      dealAmount: today && today.dealAmount != null ? today.dealAmount : null,
      orderCount: today && today.orderCount != null ? today.orderCount : null,
      customerCount: today && today.customerCount != null ? today.customerCount : null,
      yesterdayAmount: yesterdayAmount,
      capturedAt: today ? displayStamp(today.capturedAt) : "",
      todayHours: hoursFromSamples(mine, day),
      yesterdayHours: hoursFromSamples(mine, yesterday)
    };
  });
  const enabled = viewShops.filter(function (shop) {
    return shop.enabled;
  });
  const successShops = enabled.filter(function (shop) {
    return shop.dealAmount != null;
  }).length;
  const loginExpiredShops = enabled.filter(function (shop) {
    return shop.loginExpired;
  }).length;
  return {
    ok: true,
    source: "shen-jingmai",
    updatedAt: displayStamp(updated),
    successShops: successShops,
    enabledShops: enabled.length,
    loginExpiredShops: loginExpiredShops,
    shops: viewShops
  };
}

export async function runTick(deps) {
  const inflight = deps.inflight;
  const targets = await deps.listTargets();
  const jobs = [];
  for (const shop of targets) {
    if (!shop || shop.enabled === false || shop.authState === "login_expired") {
      continue;
    }
    if (!shop.cookies || !shop.cookies.length) {
      continue;
    }
    if (inflight.has(shop.store)) {
      continue;
    }
    inflight.add(shop.store);
    jobs.push(
      collectOne(shop, deps).finally(function () {
        inflight.delete(shop.store);
      })
    );
  }
  await Promise.all(jobs);
}

async function collectOne(shop, deps) {
  const now = deps.now();
  try {
    const metrics = await deps.fetchHome(shop.cookies);
    await deps.saveSample({
      store: shop.store,
      day: now.day,
      capturedAt: now.stamp,
      dealAmount: metrics.dealAmount,
      orderCount: metrics.orderCount,
      customerCount: metrics.customerCount,
      yesterdayAmount: metrics.yesterdayAmount,
      ok: true
    });
  } catch (error) {
    const classified = classifyTransportError(error);
    if (classified.code === "login") {
      await deps.markAuth(shop.store, "login_expired", "登录已失效，请重新登录");
    }
  }
}
