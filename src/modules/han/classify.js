/**
 * 商品自动分层 — 初版规则模板。
 * 每个店铺可覆盖阈值；后面换成更清晰的分类流程时，只改本文件的默认结构。
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

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function defaultClassifyRules() {
  return {
    version: CLASSIFY_RULE_VERSION,
    head: { returnMax: 20, spendMax: 42, gmvMin: 2000, convMin: 7 },
    mid: { ordersMin: 3, returnMax: 25, spendMax: 40, gmvMin: 1000, convMin: 5 },
    tail: { ordersMin: 3, returnMin: 25, returnMax: 30, spendMax: 35, gmvMin: 1000, convMin: 5 },
    moving: { ordersMin: 3 },
    testNew: { reviewMin: 1 },
  };
}

export function mergeClassifyRules(base, patch) {
  const src = defaultClassifyRules();
  const left = base && typeof base === "object" ? base : {};
  const right = patch && typeof patch === "object" ? patch : {};
  const pick = (key) => ({ ...(src[key] || {}), ...(left[key] || {}), ...(right[key] || {}) });
  return {
    version: String(right.version || left.version || src.version),
    head: {
      returnMax: num(pick("head").returnMax, src.head.returnMax),
      spendMax: num(pick("head").spendMax, src.head.spendMax),
      gmvMin: num(pick("head").gmvMin, src.head.gmvMin),
      convMin: num(pick("head").convMin, src.head.convMin),
    },
    mid: {
      ordersMin: num(pick("mid").ordersMin, src.mid.ordersMin),
      returnMax: num(pick("mid").returnMax, src.mid.returnMax),
      spendMax: num(pick("mid").spendMax, src.mid.spendMax),
      gmvMin: num(pick("mid").gmvMin, src.mid.gmvMin),
      convMin: num(pick("mid").convMin, src.mid.convMin),
    },
    tail: {
      ordersMin: num(pick("tail").ordersMin, src.tail.ordersMin),
      returnMin: num(pick("tail").returnMin, src.tail.returnMin),
      returnMax: num(pick("tail").returnMax, src.tail.returnMax),
      spendMax: num(pick("tail").spendMax, src.tail.spendMax),
      gmvMin: num(pick("tail").gmvMin, src.tail.gmvMin),
      convMin: num(pick("tail").convMin, src.tail.convMin),
    },
    moving: {
      ordersMin: num(pick("moving").ordersMin, src.moving.ordersMin),
    },
    testNew: {
      reviewMin: num(pick("testNew").reviewMin, src.testNew.reviewMin),
    },
  };
}

export function classifyRuleHints(rulesInput) {
  const rules = mergeClassifyRules(defaultClassifyRules(), rulesInput);
  return {
    头部产品:
      "满足以下参考条件：1.退货率" +
      rules.head.returnMax +
      "%以下  2.推广花费占比" +
      rules.head.spendMax +
      "%以下  3.近7天日成交金额" +
      rules.head.gmvMin +
      "元以上  4.成交转化率" +
      rules.head.convMin +
      "%以上  5.近30天转化率不合格的需要优化转化率",
    中部产品:
      "满足以下参考条件：1.成交" +
      rules.mid.ordersMin +
      "单以上  2.退货率" +
      rules.mid.returnMax +
      "%以下  3.推广花费占比" +
      rules.mid.spendMax +
      "%以下  4.近7天日成交金额" +
      rules.mid.gmvMin +
      "元以上  5.成交转化率" +
      rules.mid.convMin +
      "%以上  6.近30天转化率不合格的需要优化转化率",
    尾部产品:
      "满足以下参考条件：1.成交" +
      rules.tail.ordersMin +
      "单以上  2.退货率" +
      rules.tail.returnMin +
      "-" +
      rules.tail.returnMax +
      "%之间  3.推广花费占比" +
      rules.tail.spendMax +
      "%以下  4.近7天日成交金额" +
      rules.tail.gmvMin +
      "元以上  5.成交转化率" +
      rules.tail.convMin +
      "%以上  6.近30天转化率不合格的需要优化",
    动销产品:
      "满足以下参考条件：1.超过" +
      rules.moving.ordersMin +
      "单以上的看退货率  2.退货率在" +
      rules.tail.returnMin +
      "-" +
      rules.tail.returnMax +
      "%加到尾部  3.退货率在" +
      rules.mid.returnMax +
      "%以下加到中部",
    测新产品:
      "满足以下参考条件：1.新上架未出单 基础优化完成 评价至少" +
      rules.testNew.reviewMin +
      "条  2.花费本身产品价格的35%未出单产品暂停测新",
    待做单产品: "上架后做单 做单之后直接上车",
  };
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
  const rules = mergeClassifyRules(defaultClassifyRules(), options.rules);
  const ret = latestReturnRate(row);
  const spend = parsePercent(row.spendRate);
  const gmv = parseMetric(row.gmv7d);
  const conv = parsePercent(row.convRate);
  const orders = parseMetric(row.orders30d);
  const reviews = parseMetric(row.reviewCount);
  const needOrder = String(row.needOrder || "").trim();
  const hasOrders = orders != null && orders > 0;
  const manyOrders = orders != null && orders > rules.moving.ordersMin;
  const midOrders = orders != null && orders >= rules.mid.ordersMin;
  const tailOrders = orders != null && orders >= rules.tail.ordersMin;

  if (
    ret != null &&
    ret <= rules.head.returnMax &&
    spend != null &&
    spend <= rules.head.spendMax &&
    gmv != null &&
    gmv >= rules.head.gmvMin &&
    conv != null &&
    conv >= rules.head.convMin
  ) {
    return "头部产品";
  }
  if (
    midOrders &&
    ret != null &&
    ret < rules.mid.returnMax &&
    spend != null &&
    spend <= rules.mid.spendMax &&
    gmv != null &&
    gmv >= rules.mid.gmvMin &&
    conv != null &&
    conv >= rules.mid.convMin
  ) {
    return "中部产品";
  }
  if (
    tailOrders &&
    ret != null &&
    ret >= rules.tail.returnMin &&
    ret <= rules.tail.returnMax &&
    spend != null &&
    spend <= rules.tail.spendMax &&
    gmv != null &&
    gmv >= rules.tail.gmvMin &&
    conv != null &&
    conv >= rules.tail.convMin
  ) {
    return "尾部产品";
  }
  if (manyOrders && ret != null && ret < rules.mid.returnMax) {
    return "中部产品";
  }
  if (manyOrders && ret != null && ret >= rules.tail.returnMin && ret <= rules.tail.returnMax) {
    return "尾部产品";
  }
  if (manyOrders) {
    return "动销产品";
  }
  if (!hasOrders && reviews != null && reviews >= rules.testNew.reviewMin) {
    return "测新产品";
  }
  if (needOrder || !hasOrders) {
    return "待做单产品";
  }
  return "动销产品";
}
