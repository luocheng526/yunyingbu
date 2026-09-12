/**
 * 商品自动分层 — 初版临时规则。
 * 后面换成更清晰的分类流程时，只改本文件。
 */
export const CLASSIFY_RULE_VERSION = "draft-1";

export const PRODUCT_LAYERS = [
  "头部产品",
  "中部产品",
  "尾部产品",
  "动销产品",
  "测新产品",
  "待做单产品",
];

const PRODUCT_LAYER_ALIASES = {
  "头部产品（高利润）": "头部产品",
  "新上架需做单产品": "待做单产品",
};

export function normalizeProductLayer(layer) {
  const text = String(layer || "").trim();
  return PRODUCT_LAYER_ALIASES[text] || text;
}

function parseMetric(value) {
  const text = String(value ?? "")
    .replace(/,/g, "")
    .replace(/%/g, "")
    .trim();
  if (!text) {
    return null;
  }
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function parsePercent(value) {
  const n = parseMetric(value);
  if (n == null) {
    return null;
  }
  return n <= 1 && String(value).includes("%") === false && n !== 0 ? n * 100 : n;
}

function latestReturnRate(row) {
  return (
    parsePercent(row.returnM8) ??
    parsePercent(row.returnM7) ??
    parsePercent(row.returnM6) ??
    parsePercent(row.returnM5) ??
    parsePercent(row.returnRate)
  );
}

export function classifyProduct(row = {}, options = {}) {
  if (!options.force) {
    const given = normalizeProductLayer(row.layer);
    if (given && PRODUCT_LAYERS.includes(given)) {
      return given;
    }
  }
  const ret = latestReturnRate(row);
  const spend = parsePercent(row.spendRate);
  const gmv = parseMetric(row.gmv7d);
  const conv = parsePercent(row.convRate);
  const orders = parseMetric(row.orders30d);
  const reviews = parseMetric(row.reviewCount);
  const needOrder = String(row.needOrder || "").trim();
  const hasOrders = orders != null && orders > 0;
  const manyOrders = orders != null && orders > 3;
  const someOrders = orders != null && orders >= 3;

  if (ret != null && ret <= 20 && spend != null && spend <= 42 && gmv != null && gmv >= 2000 && conv != null && conv >= 7) {
    return "头部产品";
  }
  if (someOrders && ret != null && ret < 25 && spend != null && spend <= 40 && gmv != null && gmv >= 1000 && conv != null && conv >= 5) {
    return "中部产品";
  }
  if (someOrders && ret != null && ret >= 25 && ret <= 30 && spend != null && spend <= 35 && gmv != null && gmv >= 1000 && conv != null && conv >= 5) {
    return "尾部产品";
  }
  if (manyOrders && ret != null && ret < 25) {
    return "中部产品";
  }
  if (manyOrders && ret != null && ret >= 25 && ret <= 30) {
    return "尾部产品";
  }
  if (manyOrders) {
    return "动销产品";
  }
  if (!hasOrders && reviews != null && reviews >= 1) {
    return "测新产品";
  }
  if (needOrder || !hasOrders) {
    return "待做单产品";
  }
  return "动销产品";
}
