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
  const number = Number(String(value).replace(/[,￥¥%\s]/g, ""));
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

function indicatorValue(item) {
  if (!item || typeof item !== "object") {
    return null;
  }
  if (item.todayNum != null && item.todayNum !== "") {
    return asNumber(item.todayNum);
  }
  return asNumber(item.value);
}

function pickIndicator(list, names, codes) {
  const rows = Array.isArray(list) ? list : [];
  const byCode = rows.find(function (item) {
    return item && codes.includes(String(item.code));
  });
  const byName = rows.find(function (item) {
    return item && names.includes(String(item.name || ""));
  });
  return byCode || byName || null;
}

export function extractShopDeal(body) {
  const data = body && (body.data || body.result) ? body.data || body.result : body;
  const channel = data && data.channelData ? data.channelData : data;
  const list = channel && (channel.indicatorList || channel.indicators);
  const deal = pickIndicator(list, ["成交金额", "成交总金额"], ["3009"]);
  const order = pickIndicator(list, ["成交单量", "成交总单量"], ["3001"]);
  const customer = pickIndicator(list, ["成交客户数"], ["3008"]);
  const dealAmount = indicatorValue(deal);
  const orderCount = indicatorValue(order);
  const customerCount = indicatorValue(customer);
  if (dealAmount == null && orderCount == null && customerCount == null) {
    return null;
  }
  const yesterdayAmount = deal ? asNumber(deal.yesterdayNum) : null;
  return { dealAmount, orderCount, customerCount, yesterdayAmount };
}

export function collectPinIds() {
  const ids = [];
  const seen = new Set();
  function add(list) {
    (Array.isArray(list) ? list : []).forEach(function (item) {
      if (!item || typeof item !== "object") {
        return;
      }
      const raw = item.userId != null && item.userId !== "" ? item.userId : item.pinId;
      if (raw == null || raw === "") {
        return;
      }
      const key = String(raw);
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      ids.push(typeof raw === "number" ? raw : /^\d+$/.test(key) ? Number(key) : key);
    });
  }
  function take(node, depth) {
    if (!node || depth > 4) {
      return;
    }
    if (Array.isArray(node)) {
      add(node);
      return;
    }
    if (typeof node !== "object") {
      return;
    }
    add(node.own);
    add(node.value);
    add(node.list);
    ["user", "auth", "agency", "data"].forEach(function (key) {
      if (node[key]) {
        take(node[key], depth + 1);
      }
    });
  }
  for (let index = 0; index < arguments.length; index += 1) {
    take(arguments[index], 0);
  }
  return ids;
}

export function paidQuery(day, pinIds) {
  return {
    pinIdList: pinIds || [],
    businessType: [-4, 256],
    skuBrandId: [],
    skuCid3: [],
    clickOrOrderDay: 15,
    clickOrOrderCaliber: 0,
    isGift: 0,
    orderStatusCategory: 1,
    startDate: day,
    endDate: day,
    basic: 0,
    basicRange: 0,
    userTypes: [],
    marketingObjectives: [],
    marketingScenarios: [],
    marketingTargetingTypes: []
  };
}

export function extractPaid(body) {
  const data = body && body.summary ? body : body && body.data ? body.data : body;
  const summary = data && data.summary;
  const list = Array.isArray(summary) ? summary : [];
  const found = {};
  list.forEach(function (item) {
    if (!item || !item.index) {
      return;
    }
    found[item.index] = asNumber(item.value);
  });
  const paidAmount = Object.prototype.hasOwnProperty.call(found, "cost") ? found.cost : null;
  const paidDeal = Object.prototype.hasOwnProperty.call(found, "totalOrderSum") ? found.totalOrderSum : null;
  const paidRoi = Object.prototype.hasOwnProperty.call(found, "ROI") ? found.ROI : null;
  if (paidAmount == null && paidDeal == null && paidRoi == null) {
    return null;
  }
  return { paidAmount, paidDeal, paidRoi };
}

export function businessFieldCode(body) {
  const data = body && (body.data || body.result) ? body.data || body.result : body;
  if (!data || typeof data !== "object") {
    return "";
  }
  const list = data.belongVos || data.belongVOList || [];
  const current = data.currentBelongType;
  const found =
    list.find(function (item) {
      return item && String(item.belongType) === String(current);
    }) || list[0];
  return found && found.businessFieldCode ? String(found.businessFieldCode) : "";
}

export function sampleFields(metrics) {
  const source = metrics || {};
  return {
    dealAmount: source.dealAmount == null ? null : source.dealAmount,
    orderCount: source.orderCount == null ? null : source.orderCount,
    customerCount: source.customerCount == null ? null : source.customerCount,
    yesterdayAmount: source.yesterdayAmount == null ? null : source.yesterdayAmount,
    paidAmount: source.paidAmount == null ? null : source.paidAmount,
    paidDeal: source.paidDeal == null ? null : source.paidDeal,
    paidRoi: source.paidRoi == null ? null : source.paidRoi,
    dealNote: source.dealNote ? String(source.dealNote).slice(0, 80) : ""
  };
}

function sampleHasData(sample) {
  return sample.dealAmount != null || sample.paidAmount != null || sample.paidDeal != null || sample.paidRoi != null;
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
  const rows = (samples || [])
    .filter(function (sample) {
      return sample.day === day && sample.ok !== false;
    })
    .sort(function (a, b) {
      return a.capturedAt < b.capturedAt ? -1 : 1;
    });
  if (!rows.length) {
    return null;
  }
  const merged = sampleFields({});
  merged.capturedAt = "";
  rows.forEach(function (sample) {
    ["dealAmount", "orderCount", "customerCount", "yesterdayAmount", "paidAmount", "paidDeal", "paidRoi"].forEach(
      function (key) {
        if (sample[key] != null) {
          merged[key] = sample[key];
        }
      }
    );
    if (sample.dealNote) {
      merged.dealNote = String(sample.dealNote).slice(0, 80);
    }
    if (sample.dealAmount != null) {
      merged.dealNote = "";
    }
    if (sampleHasData(sample) && sample.capturedAt) {
      merged.capturedAt = sample.capturedAt;
    }
  });
  return merged;
}

export function buildLiveView({ shops, samples, now }) {
  const day = now.day;
  const yesterday = previousDay(day);
  let updated = "";
  (samples || []).forEach(function (sample) {
    if (sample.ok === false || !sampleHasData(sample) || !sample.capturedAt) {
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
      paidAmount: today && today.paidAmount != null ? today.paidAmount : null,
      paidDeal: today && today.paidDeal != null ? today.paidDeal : null,
      paidRoi: today && today.paidRoi != null ? today.paidRoi : null,
      dealNote: today && today.dealNote ? today.dealNote : "",
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
    return shop.dealAmount != null || shop.paidAmount != null || shop.paidDeal != null || shop.paidRoi != null;
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
    await deps.saveSample(
      Object.assign({ store: shop.store, day: now.day, capturedAt: now.stamp, ok: true }, sampleFields(metrics))
    );
  } catch (error) {
    const classified = classifyTransportError(error);
    if (classified.code === "login") {
      await deps.markAuth(shop.store, "login_expired", "登录已失效，请重新登录");
    }
  }
}
