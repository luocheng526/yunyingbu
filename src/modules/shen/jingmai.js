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
  return {
    dealAmount,
    orderCount,
    customerCount,
    yesterdayAmount,
    dealRate: readDealRate(dealSource, yesterdayAmount),
    dealRateLabel: readDealLabel(dealSource),
    platformUpdatedAt: readUpdatedAt(dealSource) || readUpdatedAt(content)
  };
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

function layerValue(node) {
  if (!node || typeof node !== "object") {
    return null;
  }
  const next = node.data != null ? node.data : node.result;
  if (typeof next === "string") {
    try {
      return JSON.parse(next);
    } catch {
      return null;
    }
  }
  return next && typeof next === "object" ? next : null;
}

function shopRoot(body) {
  let current = body;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    if (current.channelData || current.indicatorList || current.indicators) {
      return current;
    }
    const next = layerValue(current);
    if (!next || next === current) {
      return current;
    }
    current = next;
  }
  return current && typeof current === "object" ? current : {};
}

export function extractShopDeal(body) {
  const data = shopRoot(body);
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
  const channelUpdated = readUpdatedAt(channel) || readUpdatedAt(data);
  return {
    dealAmount,
    orderCount,
    customerCount,
    yesterdayAmount,
    dealRate: readDealRate(deal, yesterdayAmount),
    dealRateLabel: readDealLabel(deal),
    platformUpdatedAt: readUpdatedAt(deal) || channelUpdated
  };
}

export function parseHomeCard(text) {
  const source = String(text || "").replace(/\u00a0/g, " ");
  const start = source.indexOf("经营数据");
  const section = start >= 0 ? source.slice(start, start + 900) : source.slice(0, 900);
  function pick(label) {
    const match = section.match(new RegExp(label + "[^\\d¥￥]{0,40}[¥￥]?\\s*([\\d,]+(?:\\.\\d+)?)"));
    if (!match) {
      return null;
    }
    const number = Number(match[1].replace(/,/g, ""));
    return Number.isFinite(number) ? number : null;
  }
  const dealAmount = pick("成交金额");
  const orderCount = pick("成交单量");
  const customerCount = pick("成交客户数");
  if (dealAmount == null && orderCount == null && customerCount == null) {
    return null;
  }
  const compare = readCardCompare(section);
  return {
    dealAmount: dealAmount,
    orderCount: orderCount,
    customerCount: customerCount,
    yesterdayAmount: null,
    dealRate: compare.rate,
    dealRateLabel: compare.label,
    platformUpdatedAt: readCardUpdated(section)
  };
}

function readCardCompare(section) {
  const match = String(section || "").match(/成交金额[\s\S]{0,160}?较昨日(同时段)?\s*([+-]?\d+(?:\.\d+)?)\s*%/);
  if (!match) {
    return { rate: null, label: "" };
  }
  const rate = Number(match[2]);
  if (!Number.isFinite(rate)) {
    return { rate: null, label: "" };
  }
  return { rate: rate, label: match[1] ? "较昨日同时段" : "较昨日" };
}

function readCardUpdated(section) {
  const match = String(section || "").match(
    /(?:更新时间|数据更新|平台更新|更新于)\s*[:：]?\s*(\d{4}[-/]\d{1,2}[-/]\d{1,2}\s+\d{2}:\d{2}(?::\d{2})?)/
  );
  return match ? match[1].replace(/\//g, "-") : "";
}

function readDealRate(item, platformYesterday) {
  if (!item || typeof item !== "object") {
    return null;
  }
  const unit = item.rateUnit || item.compareUnit || item.unit || "";
  const keys = ["rate", "compareRate", "chainRate", "ringRate", "yesterdayRate", "rateNum"];
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    if (item[key] == null || item[key] === "") {
      continue;
    }
    const number = asNumber(item[key]);
    if (number == null) {
      return null;
    }
    if (String(unit).includes("%") || Math.abs(number) > 1) {
      return number;
    }
    if (platformYesterday != null) {
      return null;
    }
    return Math.round(number * 10000) / 100;
  }
  return null;
}

function readDealLabel(item) {
  const text = [item && item.desc, item && item.compareDesc, item && item.rateDesc, item && item.subTitle]
    .filter(Boolean)
    .join("");
  if (text.includes("较昨日同时段")) {
    return "较昨日同时段";
  }
  if (text.includes("较昨日")) {
    return "较昨日";
  }
  return "";
}

function readUpdatedAt(item) {
  if (!item || typeof item !== "object") {
    return "";
  }
  const keys = ["updateTime", "dataTime", "statisticTime", "refreshTime", "updatedAt"];
  for (let index = 0; index < keys.length; index += 1) {
    const value = item[keys[index]];
    if (value) {
      return String(value).replace(/\//g, "-").slice(0, 19);
    }
  }
  return "";
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
  let current = body;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    const list = current.belongVos || current.belongVOList;
    if (Array.isArray(list) && list.length) {
      const found =
        list.find(function (item) {
          return item && String(item.belongType) === String(current.currentBelongType);
        }) || list[0];
      if (found && found.businessFieldCode) {
        return String(found.businessFieldCode);
      }
    }
    const next = layerValue(current);
    if (!next || next === current) {
      break;
    }
    current = next;
  }
  return "";
}

export function describeShopPayload(body) {
  const parts = [];
  let current = body;
  for (let depth = 0; depth < 3 && current && typeof current === "object" && !Array.isArray(current); depth += 1) {
    parts.push("l" + depth + "=" + Object.keys(current).slice(0, 8).join(","));
    const next = layerValue(current);
    if (!next || next === current) {
      break;
    }
    current = next;
  }
  const data = shopRoot(body);
  const channel = data && data.channelData ? data.channelData : data;
  const list = channel && (channel.indicatorList || channel.indicators);
  const rows = Array.isArray(list) ? list : [];
  return (parts.join(" ") + " n=" + rows.length).slice(0, 150);
}

export function sampleFields(metrics) {
  const source = metrics || {};
  return {
    dealAmount: source.dealAmount == null ? null : source.dealAmount,
    orderCount: source.orderCount == null ? null : source.orderCount,
    customerCount: source.customerCount == null ? null : source.customerCount,
    yesterdayAmount: source.yesterdayAmount == null ? null : source.yesterdayAmount,
    dealRate: asNumber(source.dealRate),
    dealRateLabel: source.dealRateLabel === "较昨日同时段" ? "较昨日同时段" : source.dealRateLabel === "较昨日" ? "较昨日" : "",
    platformUpdatedAt: source.platformUpdatedAt ? String(source.platformUpdatedAt).slice(0, 19) : "",
    paidAmount: source.paidAmount == null ? null : source.paidAmount,
    paidDeal: source.paidDeal == null ? null : source.paidDeal,
    paidRoi: source.paidRoi == null ? null : source.paidRoi,
    dealNote: source.dealNote ? String(source.dealNote).slice(0, 160) : ""
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

export function hoursFromSamples(samples, day, field) {
  const key = field || "dealAmount";
  const hours = new Array(24).fill(null);
  const rows = (samples || [])
    .filter(function (sample) {
      return sample.day === day && sample.ok !== false && sample[key] != null;
    })
    .sort(function (a, b) {
      return a.capturedAt < b.capturedAt ? -1 : 1;
    });
  rows.forEach(function (sample) {
    const hour = Number(String(sample.capturedAt || "").slice(11, 13));
    if (hour >= 0 && hour < 24) {
      hours[hour] = sample[key];
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
      merged.dealNote = String(sample.dealNote).slice(0, 160);
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

function latestDealReading(samples, day) {
  const rows = (samples || [])
    .filter(function (sample) {
      return sample.day === day && sample.ok !== false && sample.dealAmount != null;
    })
    .sort(function (left, right) {
      if (left.capturedAt < right.capturedAt) {
        return -1;
      }
      if (left.capturedAt > right.capturedAt) {
        return 1;
      }
      return 0;
    });
  return rows.length ? rows[rows.length - 1] : null;
}

export function resolveDealCompare(sample) {
  const source = sample || {};
  const today = source.dealAmount == null || source.dealAmount === "" ? null : Number(source.dealAmount);
  const todayAmount = Number.isFinite(today) ? today : null;
  const platform = source.yesterdayAmount == null || source.yesterdayAmount === "" ? null : Number(source.yesterdayAmount);
  const hasPlatform = Number.isFinite(platform);
  const given = source.dealRate == null || source.dealRate === "" ? null : Number(source.dealRate);
  const hasRate = Number.isFinite(given);
  let yesterday = hasPlatform ? platform : null;
  let estimated = false;
  let rate = hasRate ? given : null;
  if (yesterday == null && todayAmount != null && hasRate && given > -100) {
    yesterday = todayAmount / (1 + given / 100);
    estimated = true;
  }
  if (rate == null && todayAmount != null && yesterday != null && yesterday > 0) {
    rate = (todayAmount / yesterday - 1) * 100;
  }
  const comparable = todayAmount != null && yesterday != null;
  const label =
    source.dealRateLabel === "较昨日同时段"
      ? "较昨日同时段"
      : rate != null || yesterday != null
        ? "较昨日"
        : "";
  return {
    today: todayAmount,
    yesterday: yesterday,
    rate: rate,
    estimated: estimated,
    comparable: comparable,
    label: label,
    platformUpdatedAt: source.platformUpdatedAt ? String(source.platformUpdatedAt) : ""
  };
}

function slotOf(stamp) {
  const match = String(stamp || "").match(/(\d{2}):(\d{2})/);
  if (!match) {
    return null;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    return null;
  }
  const floored = Math.floor(minute / 5) * 5;
  const index = hour * 12 + floored / 5;
  const label = String(hour).padStart(2, "0") + ":" + String(floored).padStart(2, "0");
  return { index: index, label: label };
}

export function dealPointsFromSamples(samples, day) {
  const buckets = new Map();
  (samples || []).forEach(function (sample) {
    if (!sample || sample.day !== day || sample.ok === false || sample.dealAmount == null) {
      return;
    }
    const slot = slotOf(sample.capturedAt);
    if (!slot) {
      return;
    }
    const current = buckets.get(slot.index);
    if (!current || String(current.capturedAt || "") <= String(sample.capturedAt || "")) {
      buckets.set(slot.index, sample);
    }
  });
  return Array.from(buckets.values())
    .sort(function (left, right) {
      return String(left.capturedAt || "") < String(right.capturedAt || "") ? -1 : 1;
    })
    .map(function (sample) {
      const slot = slotOf(sample.capturedAt);
      const compare = resolveDealCompare(sample);
      return {
        slot: slot.label,
        index: slot.index,
        today: compare.today,
        yesterday: compare.yesterday,
        rate: compare.rate,
        estimated: compare.estimated,
        comparable: compare.comparable,
        label: compare.label
      };
    });
}

export function fiveMinuteStamp(stamp) {
  const match = String(stamp || "").match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})[ T](\d{1,2}):(\d{2})/);
  if (!match) {
    return "";
  }
  const minute = Math.floor(Number(match[5]) / 5) * 5;
  function pad(value) {
    return String(value).padStart(2, "0");
  }
  return match[1] + "/" + pad(match[2]) + "/" + pad(match[3]) + " " + pad(match[4]) + ":" + pad(minute);
}

export function sharedFiveMinuteStamp(stamps) {
  let latest = "";
  (stamps || []).forEach(function (stamp) {
    const text = String(stamp || "");
    if (text > latest) {
      latest = text;
    }
  });
  return fiveMinuteStamp(latest);
}

export function alignOnlineDealSeries(shops) {
  const rows = (shops || []).filter(function (shop) {
    return shop && shop.online === true;
  });
  const events = new Map();
  const series = rows.map(function (shop) {
    const points = (shop.dealPoints || [])
      .filter(function (point) {
        return (
          point &&
          point.comparable === true &&
          point.today != null &&
          point.yesterday != null &&
          Number.isFinite(Number(point.today)) &&
          Number.isFinite(Number(point.yesterday)) &&
          Number(point.yesterday) > 0 &&
          Number.isFinite(Number(point.index))
        );
      })
      .slice()
      .sort(function (left, right) {
        return Number(left.index) - Number(right.index);
      });
    points.forEach(function (point) {
      events.set(Number(point.index), point.slot);
    });
    return points;
  });
  return Array.from(events.keys())
    .sort(function (left, right) {
      return left - right;
    })
    .map(function (index) {
      let today = 0;
      let yesterday = 0;
      let count = 0;
      let estimated = false;
      let samePeriod = true;
      series.forEach(function (points) {
        let chosen = null;
        points.forEach(function (point) {
          if (Number(point.index) <= index) {
            chosen = point;
          }
        });
        if (!chosen) {
          return;
        }
        today += Number(chosen.today);
        yesterday += Number(chosen.yesterday);
        count += 1;
        if (chosen.estimated) {
          estimated = true;
        }
        if (chosen.label !== "较昨日同时段") {
          samePeriod = false;
        }
      });
      return {
        index: index,
        slot: events.get(index),
        today: today,
        yesterday: yesterday,
        rate: count > 0 && yesterday > 0 ? (today / yesterday - 1) * 100 : null,
        n: count,
        total: rows.length,
        estimated: estimated,
        label: count > 0 && samePeriod ? "较昨日同时段" : "较昨日"
      };
    });
}

export function sumDealCompare(rows) {
  const list = rows || [];
  let todayAll = 0;
  let todayCount = 0;
  let cohortToday = 0;
  let cohortYesterday = 0;
  let comparable = 0;
  let estimated = false;
  let samePeriod = true;
  list.forEach(function (row) {
    const today = row && row.today == null ? null : Number(row && row.today);
    if (!Number.isFinite(today)) {
      return;
    }
    todayAll += today;
    todayCount += 1;
    const yesterday = row.yesterday == null ? null : Number(row.yesterday);
    if (!row.comparable || !Number.isFinite(yesterday)) {
      return;
    }
    cohortToday += today;
    cohortYesterday += yesterday;
    comparable += 1;
    if (row.estimated) {
      estimated = true;
    }
    if (row.label !== "较昨日同时段") {
      samePeriod = false;
    }
  });
  return {
    today: todayCount ? todayAll : null,
    cohortToday: comparable ? cohortToday : null,
    cohortYesterday: comparable ? cohortYesterday : null,
    rate: comparable > 0 && cohortYesterday > 0 ? (cohortToday / cohortYesterday - 1) * 100 : null,
    comparable: comparable,
    total: list.length,
    estimated: estimated,
    label: comparable && samePeriod ? "较昨日同时段" : "较昨日"
  };
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
    const mine = (samples || []).filter(function (sample) {
      return sample.store === shop.store;
    });
    const today = latestSample(mine, day);
    const reading = latestDealReading(mine, day);
    const compare = resolveDealCompare(reading || {});
    return {
      shop: shop.store,
      enabled: shop.enabled !== false,
      online: shop.enabled !== false && shop.authState === "ok" && Array.isArray(shop.cookies) && shop.cookies.length > 0,
      loginExpired: shop.enabled !== false && shop.authState === "login_expired",
      dealAmount: compare.today,
      orderCount: today && today.orderCount != null ? today.orderCount : null,
      customerCount: today && today.customerCount != null ? today.customerCount : null,
      paidAmount: today && today.paidAmount != null ? today.paidAmount : null,
      paidDeal: today && today.paidDeal != null ? today.paidDeal : null,
      paidRoi: today && today.paidRoi != null ? today.paidRoi : null,
      dealNote: today && today.dealNote ? today.dealNote : "",
      yesterdayAmount: compare.yesterday,
      yesterdayEstimated: compare.estimated,
      dealRate: compare.rate,
      dealRateLabel: compare.label,
      dealComparable: compare.comparable,
      platformUpdatedAt: compare.platformUpdatedAt,
      dealPoints: dealPointsFromSamples(mine, day),
      capturedAt: reading ? displayStamp(reading.capturedAt) : today ? displayStamp(today.capturedAt) : "",
      todayHours: hoursFromSamples(mine, day),
      yesterdayHours: hoursFromSamples(mine, yesterday),
      todayPaidHours: hoursFromSamples(mine, day, "paidAmount"),
      yesterdayPaidHours: hoursFromSamples(mine, yesterday, "paidAmount")
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
