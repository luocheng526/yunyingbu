import { Router } from "express";

function shanghaiYmd(daysAgo) {
  const now = new Date();
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
  const shift = Number(daysAgo) || 0;
  if (!shift) {
    return today;
  }
  const parts = today.split("-").map((item) => Number(item));
  const utc = Date.UTC(parts[0], parts[1] - 1, parts[2] - shift);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(utc));
}

const CARDS = [
  { key: "payAmount", label: "支付金额（支付）", value: "912,658.94", accent: true, trend: -5.81 },
  { key: "adCost", label: "推广费（预估）", value: "382,745.07", trend: 3.12 },
  { key: "refundAmount", label: "退款金额", value: "205,834.05", trend: 1.44 },
  { key: "adRatio", label: "推广费占比", value: "41.94%", trend: 2.08 },
  { key: "refundRate", label: "退款率（按金额）", value: "22.55%", trend: -0.86 },
  { key: "profit", label: "利润（预估）", value: "440,670.82", trend: 4.27 },
  { key: "payQty", label: "销售件数（支付）", value: "3,466", trend: -2.31 },
  { key: "grossMargin", label: "大毛利率", value: "48.28%", trend: 0.62 },
  { key: "platformFee", label: "平台费用（预估）", value: "86,412.30", trend: 1.18 },
  { key: "saleFee", label: "销售费用（预估）", value: "54,208.16", trend: -0.74 },
  { key: "goodsCost", label: "总货款", value: "328,190.44", trend: -3.55 },
  { key: "invalid", label: "无效订单金额（件数）", value: "18,640.00（52）", trend: 6.2 },
  { key: "netSales", label: "净销售金额", value: "706,824.89", trend: -4.16 },
  { key: "jdOrders", label: "京东仓订单量", value: "2,211", trend: 1.05 },
  { key: "jdRatio", label: "京东仓订单占比", value: "63.79%", trend: 0.41 },
  { key: "netQty", label: "净销售件数", value: "2,908", trend: -1.88 }
];

const INDEX_ROWS = [
  { shop: "RASW家居旗舰店", owner: "张文静", amount: "82,416.20", trend: 9.66 },
  { shop: "RASW生活电器旗舰店", owner: "陈明婧", amount: "61,208.54", trend: -3.12 },
  { shop: "RASW健康电器旗舰店", owner: "郭桂良", amount: "54,190.08", trend: 2.44 },
  { shop: "飒望居家旗舰店", owner: "王博", amount: "41,872.16", trend: -1.08 },
  { shop: "SAWAAG居家布艺旗舰店", owner: "王博", amount: "36,540.70", trend: 4.21 },
  { shop: "RASW居家旗舰店", owner: "杨润泽", amount: "32,118.90", trend: -0.55 },
  { shop: "飒望家居日用旗舰店", owner: "崔安琪", amount: "28,640.12", trend: 1.73 },
  { shop: "飒望旗舰店", owner: "杨润泽", amount: "24,908.44", trend: -2.9 },
  { shop: "RASW潮流生活旗舰店", owner: "郭哲宁", amount: "22,710.30", trend: 0.88 },
  { shop: "HYEGIIR健康器械旗舰店", owner: "高丽男", amount: "22,535.10", trend: -5.81 }
];

const TIGER_ROWS = [
  { shop: "RASW家居旗舰店", owner: "张文静", amount: "196,420.18" },
  { shop: "RASW生活电器旗舰店", owner: "陈明婧", amount: "148,902.44" },
  { shop: "RASW健康电器旗舰店", owner: "郭桂良", amount: "121,330.06" },
  { shop: "飒望居家旗舰店", owner: "王博", amount: "98,774.52" },
  { shop: "SAWAAG居家布艺旗舰店", owner: "王博", amount: "86,210.90" },
  { shop: "RASW居家旗舰店", owner: "杨润泽", amount: "74,108.33" },
  { shop: "飒望家居日用旗舰店", owner: "崔安琪", amount: "61,540.27" },
  { shop: "飒望旗舰店", owner: "杨润泽", amount: "54,882.10" },
  { shop: "RASW潮流生活旗舰店", owner: "郭哲宁", amount: "48,216.08" },
  { shop: "HYEGIIR健康器械旗舰店", owner: "高丽男", amount: "41,990.64" }
];

export function homeRouter() {
  const router = Router();
  router.get("/summary", (_req, res) => {
    const from = shanghaiYmd(1);
    res.json({
      ok: true,
      module: "home",
      title: "首页",
      demo: true,
      view: "company",
      range: "yesterday",
      from,
      to: from,
      cards: CARDS.map((card) => ({ ...card })),
      index: {
        title: "实时销售指数",
        value: "407,140.54",
        time: "15:30",
        mode: "shop",
        rows: INDEX_ROWS.map((row) => ({ ...row }))
      },
      tiger: {
        title: "龙虎榜",
        rows: TIGER_ROWS.map((row) => ({ ...row }))
      }
    });
  });
  router.get("/live", (_req, res) => {
    res.json({
      ok: true,
      module: "home",
      title: "实时看板",
      demo: true,
      source: "home-fallback",
      dateLabel: shanghaiYmd(0).replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$1年$2月$3日"),
      range: "7天",
      summary: { channels: 1, shops: INDEX_ROWS.length },
      hero: {
        label: "实时销售指数",
        value: "407,140.54",
        delta: -7.44,
        spark: [28, 30, 26, 32, 31, 36, 34, 40, 38, 48, 46, 58]
      },
      cards: [
        { key: "pay", label: "支付金额 (支付)", value: "837,247.17", extra: "付费成交ROI 2.40" },
        { key: "orders", label: "销售单数 (支付)", value: "3,174" },
        { key: "ad", label: "推广花费 (支付预估)", value: "348,174.63", extra: "推广占比 41.59%" },
        { key: "profit", label: "利润 (支付预估)", value: "415,136.64", extra: "毛利率 49.58%" },
        { key: "margin", label: "大毛利率", value: "49.58%" },
        { key: "roi", label: "付费成交ROI", value: "2.40" },
        { key: "livePay", label: "实时付费成交额", value: "12,480.50" },
        { key: "liveAd", label: "实时推广花费额", value: "5,210.30" },
        { key: "liveProfit", label: "实时利润预估", value: "6,180.20" },
        { key: "liveFee", label: "实时费比", value: "41.75%" }
      ]
    });
  });
  return router;
}
