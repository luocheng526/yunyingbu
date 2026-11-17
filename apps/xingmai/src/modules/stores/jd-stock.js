import { createHash } from "node:crypto";

const JD_ROUTER = "https://api.jd.com/routerjson";
const LOW_STOCK = 20;

let jdFetchForTests = null;
const warehouseNameCache = new Map();

export function setJdFetchForTests(fn) {
  jdFetchForTests = fn;
}

export function resetJdStockForTests() {
  jdFetchForTests = null;
  warehouseNameCache.clear();
}

export function shortWarehouseName(name, storeId) {
  const text = String(name || "").trim();
  const city = text.match(/^([\u4e00-\u9fff]{2,}?)(?=常温|[A-Za-z])/);
  if (city) {
    return `${city[1]}仓`;
  }
  if (text && !text.startsWith("京东仓")) {
    return text;
  }
  return storeId ? `京东仓${storeId}` : "京东仓";
}

export function isJdExpress(features) {
  return (Array.isArray(features) ? features : []).some(
    (feature) => feature?.featureKey === "isJDexpress" && String(feature.featureValue) === "1"
  );
}

export function isNationalWarehouse(row) {
  const id = Number(row?.storeId ?? row?.warehouseId);
  const name = String(row?.warehouseName || row?.storeName || "");
  return id === 0 || name.includes("全国仓");
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function stockLabelOf(usable) {
  if (!Number.isFinite(usable)) {
    return "未知";
  }
  if (usable < 0) {
    return "库存异常";
  }
  if (usable <= LOW_STOCK) {
    return "低库存";
  }
  return "正常";
}

export function warehouseLines(features, stocks) {
  const jdExpress = isJdExpress(features);
  if (!jdExpress) {
    return { jdExpress: false, droppedNational: 0, lines: [] };
  }
  const lines = [];
  let droppedNational = 0;
  for (const row of Array.isArray(stocks) ? stocks : []) {
    if (isNationalWarehouse(row)) {
      droppedNational += 1;
      continue;
    }
    const storeId = row?.storeId ?? row?.warehouseId;
    if (storeId == null || storeId === "") {
      continue;
    }
    const spotNum = num(row.stockNum);
    const bookingNum = num(row.orderBookingNum) + num(row.orderTransferNum) + num(row.appBookingNum);
    const usableNum = spotNum - bookingNum;
    const warehouseName = String(row.warehouseName || row.storeName || "").trim() || `京东仓 ${storeId}`;
    lines.push({
      warehouseId: String(storeId),
      warehouseName,
      spotNum,
      bookingNum,
      usableNum,
      stockNum: usableNum,
      stockLabel: stockLabelOf(usableNum),
      tag: "京东物流"
    });
  }
  lines.sort((a, b) => a.usableNum - b.usableNum || String(a.warehouseId).localeCompare(String(b.warehouseId)));
  return { jdExpress: true, droppedNational, lines };
}

function warehouseLabel(line, duplicated) {
  if (!duplicated) {
    return line.warehouseName;
  }
  const numMatch = String(line.warehouseFullName || "").match(/(\d+)号/);
  if (!numMatch) {
    return `${line.warehouseName}${line.warehouseId}`;
  }
  return String(line.warehouseName || "").replace(/仓$/, `${numMatch[1]}号仓`);
}

export function groupSkuInventory(lines) {
  const grouped = new Map();
  for (const line of lines) {
    const key = `${line.shopId || ""}:${line.skuId || ""}:${line.warehouseId}`;
    const skuKey = `${line.shopId || ""}:${line.skuId || ""}`;
    if (!grouped.has(skuKey)) {
      grouped.set(skuKey, {
        productId: line.productId || "",
        productName: line.productName || "",
        skuId: line.skuId || "",
        shopId: line.shopId || "",
        shopName: line.shopName || "",
        tag: line.tag || "京东物流",
        warehouses: [],
        seen: new Set()
      });
    }
    const row = grouped.get(skuKey);
    if (row.seen.has(key)) {
      continue;
    }
    row.seen.add(key);
    row.warehouses.push({
      warehouseId: line.warehouseId,
      warehouseName: line.warehouseName,
      warehouseFullName: line.warehouseFullName || line.warehouseName,
      spotNum: line.spotNum,
      bookingNum: line.bookingNum,
      usableNum: line.usableNum
    });
  }
  const records = [];
  for (const row of grouped.values()) {
    const counts = new Map();
    for (const warehouse of row.warehouses) {
      counts.set(warehouse.warehouseName, (counts.get(warehouse.warehouseName) || 0) + 1);
    }
    row.warehouses.sort((a, b) => b.usableNum - a.usableNum || a.warehouseName.localeCompare(b.warehouseName, "zh"));
    const parts = row.warehouses.map((warehouse) => {
      const label = warehouseLabel(warehouse, (counts.get(warehouse.warehouseName) || 0) > 1);
      return `${label} ${warehouse.usableNum}个`;
    });
    const usableNum = row.warehouses.reduce((sum, warehouse) => sum + warehouse.usableNum, 0);
    const spotNum = row.warehouses.reduce((sum, warehouse) => sum + warehouse.spotNum, 0);
    const bookingNum = row.warehouses.reduce((sum, warehouse) => sum + warehouse.bookingNum, 0);
    records.push({
      productId: row.productId,
      productName: row.productName,
      skuId: row.skuId,
      shopId: row.shopId,
      shopName: row.shopName,
      tag: row.tag,
      usableNum,
      spotNum,
      bookingNum,
      stockNum: usableNum,
      stockLabel: stockLabelOf(usableNum),
      warehouseText: parts.join("、"),
      warehouses: row.warehouses.map(({ warehouseFullName, ...warehouse }) => warehouse)
    });
  }
  records.sort((a, b) => {
    const emptyA = a.usableNum === 0 ? 1 : 0;
    const emptyB = b.usableNum === 0 ? 1 : 0;
    return emptyA - emptyB || a.usableNum - b.usableNum || String(a.skuId).localeCompare(String(b.skuId));
  });
  return records;
}

export async function warehouseNameMap(auth) {
  const key = String(auth?.appKey || "");
  const hit = warehouseNameCache.get(key);
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) {
    return hit.map;
  }
  let map = {};
  try {
    const payload = await callJd(auth, "jingdong.store.findPartitionWhByIdAndStatus", { status: 1 });
    const rows = payload?.jingdong_store_findPartitionWhByIdAndStatus_responce?.find_Partition_Warehouse_Result?.result || [];
    for (const row of rows) {
      if (row?.seq_num == null || !row?.name) {
        continue;
      }
      map[String(row.seq_num)] = String(row.name).trim();
    }
  } catch {
    map = hit?.map || {};
  }
  warehouseNameCache.set(key, { at: Date.now(), map });
  return map;
}

export function shanghaiTimestamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || "00";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

function sign(secret, params) {
  const raw = Object.keys(params)
    .sort()
    .map((key) => key + params[key])
    .join("");
  return createHash("md5").update(`${secret}${raw}${secret}`).digest("hex").toUpperCase();
}

export function parseSkuFeatures(payload) {
  return payload?.jingdong_sku_read_findSkuById_responce?.sku?.features || [];
}

export function parseSkuSearch(payload) {
  const page = payload?.jingdong_sku_read_searchSkuList_responce?.page || {};
  const data = Array.isArray(page.data) ? page.data : [];
  const pageSize = Number(page.pageSize || 20) || 20;
  const total = Number(page.totalItem || 0);
  return {
    total,
    pageSize,
    lastPage: Math.max(1, Math.ceil(total / pageSize) || 1),
    skus: data
      .filter((row) => isJdExpress(row.features) && row?.skuId != null)
      .map((row) => ({
        skuId: String(row.skuId),
        wareId: String(row.wareId ?? ""),
        skuName: row.skuName || ""
      }))
  };
}

export function parsePartitionStocks(payload) {
  const info = payload?.jingdong_ware_stock_sku_query_responce?.returnType;
  if (info && info.success === false) {
    throw new Error(info.errorMessage || "京东分区库存查询失败");
  }
  return info?.obj?.skuStockInfos || [];
}

export async function callJd(auth, method, biz) {
  if (!auth?.appKey || !auth?.appSecret || !auth?.accessToken) {
    throw new Error("店铺未授权京东");
  }
  const params = {
    method,
    app_key: auth.appKey,
    access_token: auth.accessToken,
    timestamp: shanghaiTimestamp(),
    format: "json",
    v: "2.0",
    sign_method: "md5",
    "360buy_param_json": JSON.stringify(biz)
  };
  params.sign = sign(auth.appSecret, params);
  const doFetch = jdFetchForTests || fetch;
  const res = await doFetch(JD_ROUTER, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json"
    },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(8000)
  });
  const payload = await res.json();
  if (payload?.error_response) {
    const desc = payload.error_response.zh_desc || payload.error_response.en_desc || "京东接口失败";
    throw new Error(String(desc).slice(0, 180));
  }
  return payload;
}

export async function readPartitionLines(auth, skuId) {
  const stockPayload = await callJd(auth, "jingdong.ware.stock.sku.query", {
    skuId: String(skuId),
    stockModel: "POP_PARTITION"
  });
  return warehouseLines([{ featureKey: "isJDexpress", featureValue: "1" }], parsePartitionStocks(stockPayload));
}

export async function readJdWarehouseStock(auth, skuId) {
  const id = String(skuId);
  const [skuPayload, stockPayload] = await Promise.all([
    callJd(auth, "jingdong.sku.read.findSkuById", {
      skuId: id,
      field: "skuId,wareId,features,skuName"
    }),
    callJd(auth, "jingdong.ware.stock.sku.query", {
      skuId: id,
      stockModel: "POP_PARTITION"
    })
  ]);
  return warehouseLines(parseSkuFeatures(skuPayload), parsePartitionStocks(stockPayload));
}
