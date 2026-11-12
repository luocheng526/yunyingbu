import { cookieHeader } from "./jingmai-client.js";
import { readShopStock } from "./jingmai-desk.js";
import { beijingParts, classifyTransportError, jingmaiError } from "./jingmai.js";
import { listSessions } from "./jingmai-store.js";

export const JINGCANG_TEST_STORE = "RASW潮流生活旗舰店";
const STOCK_APP = "KZFBL0OIH93MGTTRPGQK";
const STOCK_API = "dsm.store.bff.StockReadBffService.queryStockByPage";
const PAGE_SIZE = 50;
const MAX_PAGES = 30;

let hooks = {};
let currentJob = null;

export function setJingcangHooks(next) {
  hooks = next || {};
}

export function resetJingcangJob() {
  currentJob = null;
}

export function stockQuery(pageNo, pageSize) {
  return {
    request: {
      data: {
        pageNo: pageNo,
        pageSize: pageSize,
        searchFeatureCodes: null,
        skuIds: null,
        productIds: null,
        skuPStatuses: null,
        categoryIds: null,
        itemNum: null
      },
      source: "pc"
    }
  };
}

function stockUrl() {
  return "https://sff.jd.com/api?v=1.0&appId=" + STOCK_APP + "&api=" + STOCK_API;
}

function unwrapStock(body) {
  if (!body || typeof body !== "object") {
    return null;
  }
  if (Array.isArray(body.data)) {
    return body;
  }
  if (body.data && typeof body.data === "object" && Array.isArray(body.data.data)) {
    return body.data;
  }
  return null;
}

function imageUrl(logo) {
  const value = String(logo || "").trim();
  if (!value) {
    return "";
  }
  if (/^https?:/i.test(value)) {
    return value;
  }
  if (value.startsWith("//")) {
    return "https:" + value;
  }
  return "https://img10.360buyimg.com/n4/" + value.replace(/^\/+/, "");
}

function houseKind(name) {
  if (name.indexOf("平台仓") !== -1 || name.indexOf("京东") !== -1) {
    return "京东仓";
  }
  if (name.indexOf("云仓") !== -1) {
    return "云仓";
  }
  if (name.indexOf("门店") !== -1) {
    return "门店仓";
  }
  if (name.indexOf("前置") !== -1) {
    return "前置仓";
  }
  return "商家仓";
}

function asQty(raw) {
  if (raw == null || raw === "") {
    return null;
  }
  const qty = Number(String(raw).replace(/,/g, ""));
  return Number.isFinite(qty) ? qty : null;
}

function qtyOf(detail) {
  if (!detail || typeof detail !== "object") {
    return null;
  }
  const stock = detail.stockNum && typeof detail.stockNum === "object" ? detail.stockNum : null;
  const raw = stock && stock.availableStock != null
    ? stock.availableStock
    : detail.availableStock != null
      ? detail.availableStock
      : detail.num != null
        ? detail.num
        : stock && stock.totalStock != null
          ? stock.totalStock
          : null;
  return asQty(raw);
}

function collectHouses(item) {
  const found = [];
  const seen = {};
  function consider(node) {
    if (!node || typeof node !== "object" || Array.isArray(node)) {
      return;
    }
    const house = node.warehouse && typeof node.warehouse === "object" ? node.warehouse : node;
    let name = String(house.sName || house.warehouseName || node.sName || node.warehouseName || "").trim();
    if (!name) {
      const typeName = String(node.sTypeName || "").trim();
      if (typeName.indexOf("仓") !== -1) {
        name = typeName;
      }
    }
    if (!name || name.indexOf("全国仓") !== -1 || seen[name] || name.length > 48) {
      return;
    }
    const qty = qtyOf(node);
    const sid = house.sid != null ? house.sid : node.sid;
    if (qty == null && sid == null) {
      return;
    }
    seen[name] = true;
    found.push({ name: name, kind: houseKind(name), qty: qty == null ? 0 : qty });
  }
  function walk(node, depth) {
    if (!node || depth > 5) {
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(function (child) {
        walk(child, depth + 1);
      });
      return;
    }
    if (typeof node !== "object") {
      return;
    }
    consider(node);
    Object.keys(node).forEach(function (key) {
      if (key === "skuInfo" || key === "logo") {
        return;
      }
      walk(node[key], depth + 1);
    });
  }
  walk(item, 0);
  return found;
}

function shapeOf(item) {
  const lines = [];
  function walk(node, path, depth) {
    if (lines.length > 50 || depth > 3) {
      return;
    }
    if (Array.isArray(node)) {
      lines.push(path + "[]*" + node.length);
      if (node.length) {
        walk(node[0], path + "[0]", depth + 1);
      }
      return;
    }
    if (node && typeof node === "object") {
      Object.keys(node).slice(0, 20).forEach(function (key) {
        walk(node[key], path + "." + key, depth + 1);
      });
      return;
    }
    if (typeof node === "number") {
      lines.push(path + "=" + node);
    }
  }
  walk(item, "row", 0);
  return lines;
}

function statusOf(info) {
  const text = [info.skuStatusName, info.statusName, info.pStatusName, info.saleStatusName].find(function (item) {
    return typeof item === "string" && item.trim();
  });
  return text ? text.trim().slice(0, 12) : "";
}

function toRow(item) {
  const info = (item && item.skuInfo) || {};
  const sku = String(info.skuId || item.skuId || "").trim();
  if (!sku) {
    return null;
  }
  const warehouses = collectHouses(item);
  return {
    name: String(info.skuName || info.productName || item.skuName || "").slice(0, 120),
    spu: String(info.spuId || info.productId || "").trim(),
    sku: sku,
    code: String(info.itemNum || "").trim(),
    status: statusOf(info),
    image: imageUrl(info.logo),
    warehouses: warehouses,
    shape: warehouses.length ? [] : shapeOf(item)
  };
}

export function parseStockPage(body) {
  const payload = unwrapStock(body);
  if (!payload) {
    return { rows: [], total: 0, stock: false };
  }
  const rows = payload.data.map(toRow).filter(Boolean);
  const known = payload.totalNum != null || payload.total != null;
  const total = Number(payload.totalNum != null ? payload.totalNum : payload.total);
  return { rows: rows, total: known && Number.isFinite(total) ? total : 0, stock: true };
}

function mergePages(pages) {
  const rows = [];
  const seen = {};
  let total = 0;
  pages.forEach(function (page) {
    total = Math.max(total, page.total || 0);
    page.rows.forEach(function (row) {
      if (seen[row.sku]) {
        return;
      }
      seen[row.sku] = true;
      rows.push(row);
    });
  });
  return { rows: rows, total: total || rows.length };
}

function safeNote(error) {
  return String((error && error.message) || "京仓库存没有返回")
    .replace(/thor|pt_key|pt_pin|cookie|password|secret/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 48);
}

function pause(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

function readBody(status, text, location) {
  if (status === 401 || status === 403 || (status >= 300 && status < 400 && /login|passport/i.test(String(location || "")))) {
    throw jingmaiError("login", "登录已失效，请重新登录");
  }
  const trimmed = String(text || "").trim();
  if (!trimmed || trimmed.startsWith("<")) {
    if (/未登录|请登录|passport/i.test(trimmed.slice(0, 400))) {
      throw jingmaiError("login", "登录已失效，请重新登录");
    }
    throw jingmaiError("network", "京仓库存没有返回");
  }
  let body;
  try {
    body = JSON.parse(trimmed);
  } catch {
    throw jingmaiError("network", "京仓库存没有返回");
  }
  const code = body && body.code != null ? String(body.code) : "";
  const message = String((body && (body.msg || body.message)) || "");
  if (code === "1001" || code === "401" || /未登录|请登录/.test(message)) {
    throw jingmaiError("login", "登录已失效，请重新登录");
  }
  if (code === "601" || /操作频繁/.test(message)) {
    throw jingmaiError("network", "601 操作频繁");
  }
  if (code && code !== "200" && code !== "0" && !parseStockPage(body).stock) {
    throw jingmaiError("network", safeNote({ message: code + " " + message }) || "京仓库存没有返回");
  }
  return body;
}

async function postStock(jar, fetchImpl, pageNo) {
  let last = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetchImpl(stockUrl(), {
        method: "POST",
        redirect: "manual",
        body: JSON.stringify(stockQuery(pageNo, PAGE_SIZE)),
        signal: AbortSignal.timeout(8000),
        headers: {
          accept: "application/json, text/plain, */*",
          "content-type": "application/json;charset=UTF-8",
          "user-agent": "Mozilla/5.0",
          "x-requested-with": "XMLHttpRequest",
          "dsm-platform": "pc",
          origin: "https://trade-warehousing-jdm.jd.com",
          referer: "https://trade-warehousing-jdm.jd.com/inventory-manage",
          cookie: cookieHeader(jar)
        }
      });
      return readBody(response.status, await response.text(), response.headers.get("location"));
    } catch (error) {
      const classified = classifyTransportError(error);
      if (classified.code === "login" || attempt === 1 || !/601|操作频繁/.test(classified.message || "")) {
        throw classified;
      }
      last = classified;
      await pause(2000);
    }
  }
  throw last || jingmaiError("network", "京仓库存没有返回");
}

async function fetchOverHttp(jar, fetchImpl) {
  const pages = [];
  for (let pageNo = 1; pageNo <= MAX_PAGES; pageNo += 1) {
    const body = await postStock(jar, fetchImpl, pageNo);
    const page = parseStockPage(body);
    if (!page.stock) {
      throw jingmaiError("network", "京仓库存没有返回商品");
    }
    pages.push(page);
    const merged = mergePages(pages);
    if (!page.rows.length || (page.total > 0 && merged.rows.length >= page.total) || (page.total <= 0 && page.rows.length < PAGE_SIZE)) {
      break;
    }
  }
  const merged = mergePages(pages);
  return {
    rows: merged.rows,
    total: merged.total,
    source: "dsm",
    truncated: merged.total > 0 && merged.rows.length < merged.total
  };
}

async function fetchOverPage(jar, readBrowser) {
  const texts = await readBrowser(jar);
  if (texts == null) {
    throw jingmaiError("network", "京麦登录窗口正开着，这次没有抓库存");
  }
  const pages = (texts || [])
    .map(function (text) {
      try {
        return parseStockPage(JSON.parse(text));
      } catch {
        return null;
      }
    })
    .filter(function (page) {
      return page && page.stock;
    });
  if (!pages.length) {
    throw jingmaiError("network", "京仓库存页面没有返回");
  }
  const merged = mergePages(pages);
  return {
    rows: merged.rows,
    total: merged.total,
    source: "page",
    truncated: merged.total > 0 && merged.rows.length < merged.total
  };
}

function miss(store, error) {
  return { ok: false, store: store, error: safeNote(error), rows: [], capturedAt: beijingParts().stamp };
}

export function watchJingcang(storeName) {
  const store = String(storeName || JINGCANG_TEST_STORE).trim() || JINGCANG_TEST_STORE;
  if (store !== JINGCANG_TEST_STORE) {
    const error = jingmaiError("network", "这次只抓取RASW潮流生活旗舰店");
    error.statusCode = 400;
    throw error;
  }
  if (currentJob && currentJob.store === store && currentJob.result && currentJob.result.ok) {
    return Promise.resolve(currentJob.result);
  }
  if (!currentJob || currentJob.store !== store || !currentJob.pending) {
    const promise = loadJingcang(store).then(function (result) {
      if (currentJob && currentJob.promise === promise) {
        currentJob.pending = false;
        currentJob.result = result;
      }
      return result;
    });
    currentJob = { store: store, pending: true, result: null, promise: promise };
  }
  const promise = currentJob.promise;
  return new Promise(function (resolve) {
    const timer = setTimeout(function () {
      resolve({ ok: false, pending: true, store: store, rows: [] });
    }, 8000);
    promise.then(
      function (result) {
        clearTimeout(timer);
        resolve(result);
      },
      function () {
        clearTimeout(timer);
        resolve({ ok: false, store: store, error: "京仓库存没有返回", rows: [] });
      }
    );
  });
}

export async function loadJingcang(storeName, deps) {
  const store = String(storeName || JINGCANG_TEST_STORE).trim() || JINGCANG_TEST_STORE;
  if (store !== JINGCANG_TEST_STORE) {
    const error = jingmaiError("network", "这次只抓取RASW潮流生活旗舰店");
    error.statusCode = 400;
    throw error;
  }
  const sessions = await (deps && deps.listSessions ? deps.listSessions() : hooks.listSessions ? hooks.listSessions() : listSessions());
  const session = (sessions || []).find(function (item) {
    return item && item.store === store;
  });
  if (!session || session.authState !== "ok" || !session.cookies || !session.cookies.length) {
    return miss(store, { message: "店铺还没有登录" });
  }
  const fetchImpl = (deps && deps.fetchImpl) || hooks.fetchImpl || fetch;
  const readBrowser = (deps && deps.readShopStock) || hooks.readShopStock || readShopStock;
  let result = null;
  try {
    result = await fetchOverHttp(session.cookies, fetchImpl);
  } catch (error) {
    const classified = classifyTransportError(error);
    if (classified.code === "login") {
      return miss(store, classified);
    }
    try {
      result = await fetchOverPage(session.cookies, readBrowser);
    } catch (browserError) {
      return miss(store, classifyTransportError(browserError));
    }
  }
  let shape = [];
  const rows = result.rows.map(function (row) {
    if (!shape.length && row.shape && row.shape.length) {
      shape = row.shape;
    }
    return {
      name: row.name,
      spu: row.spu,
      sku: row.sku,
      code: row.code,
      status: row.status,
      image: row.image,
      warehouses: row.warehouses
    };
  });
  return {
    ok: true,
    store: store,
    total: result.total,
    count: rows.length,
    truncated: Boolean(result.truncated),
    source: result.source,
    capturedAt: beijingParts().stamp,
    shape: shape,
    rows: rows
  };
}
