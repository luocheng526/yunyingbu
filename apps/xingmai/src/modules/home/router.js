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
  router.get("/teams", (_req, res) => {
    res.json({
      ok: true,
      module: "home",
      demo: true,
      notice: "团队店铺先用演示店。数据中心责权接口上线后按店名对齐。",
      teams: [
        {
          key: "shen",
          name: "沈子晗",
          href: "/shen",
          cards: [
            { key: "payAmount", label: "支付金额（支付）", value: "548,231.16", accent: true, trend: -4.12 },
            { key: "adCost", label: "推广费（预估）", value: "229,647.04", trend: 2.41 },
            { key: "refundAmount", label: "退款金额", value: "123,500.43", trend: 0.88 },
            { key: "adRatio", label: "推广费占比", value: "41.89%", trend: 1.62 },
            { key: "refundRate", label: "退款率（按金额）", value: "22.53%", trend: -0.41 },
            { key: "profit", label: "利润（预估）", value: "264,402.49", trend: 3.18 },
            { key: "payQty", label: "销售件数（支付）", value: "2,080", trend: -1.55 },
            { key: "grossMargin", label: "大毛利率", value: "48.22%", trend: 0.44 },
            { key: "platformFee", label: "平台费用（预估）", value: "51,847.38", trend: 0.92 },
            { key: "saleFee", label: "销售费用（预估）", value: "32,524.90", trend: -0.51 },
            { key: "goodsCost", label: "总货款", value: "196,914.26", trend: -2.77 },
            { key: "invalid", label: "无效订单金额（件数）", value: "11,184.00（31）", trend: 4.1 },
            { key: "netSales", label: "净销售金额", value: "424,094.93", trend: -3.02 },
            { key: "jdOrders", label: "京东仓订单量", value: "1,327", trend: 0.72 },
            { key: "jdRatio", label: "京东仓订单占比", value: "63.80%", trend: 0.28 },
            { key: "netQty", label: "净销售件数", value: "1,745", trend: -1.21 }
          ],
          shops: [
            { shop: "RASW家居旗舰店", owner: "张文静", liveAmount: "22,997.91", orders: "205", payAmount: "70,190.95", refundRate: "26.31%" },
            { shop: "RASW生活电器旗舰店", owner: "陈明婧", liveAmount: "8,929.03", orders: "168", payAmount: "52,426.01", refundRate: "25.00%" },
            { shop: "RASW健康电器旗舰店", owner: "郭桂良", liveAmount: "10,018.13", orders: "115", payAmount: "30,516.64", refundRate: "17.10%" },
            { shop: "飒望居家旗舰店", owner: "王博", liveAmount: "9,640.22", orders: "98", payAmount: "28,410.70", refundRate: "19.40%" },
            { shop: "SAWAAG居家布艺旗舰店", owner: "王博", liveAmount: "8,210.55", orders: "86", payAmount: "24,108.33", refundRate: "18.22%" },
            { shop: "RASW居家旗舰店", owner: "杨润泽", liveAmount: "7,540.18", orders: "74", payAmount: "21,330.80", refundRate: "16.80%" },
            { shop: "飒望家居日用旗舰店", owner: "崔安琪", liveAmount: "6,880.40", orders: "69", payAmount: "19,640.12", refundRate: "15.10%" },
            { shop: "飒望旗舰店", owner: "杨润泽", liveAmount: "6,120.08", orders: "61", payAmount: "17,908.44", refundRate: "14.60%" },
            { shop: "RASW潮流生活旗舰店", owner: "郭哲宁", liveAmount: "5,410.30", orders: "54", payAmount: "15,710.30", refundRate: "13.88%" },
            { shop: "HYEGIIR健康器械旗舰店", owner: "高丽男", liveAmount: "6,287.11", orders: "89", payAmount: "29,508.85", refundRate: "18.32%" }
          ]
        },
        {
          key: "han",
          name: "韩梦凯",
          href: "/han",
          cards: [
            { key: "payAmount", label: "支付金额（支付）", value: "364,427.78", accent: true, trend: -7.90 },
            { key: "adCost", label: "推广费（预估）", value: "153,098.03", trend: 4.08 },
            { key: "refundAmount", label: "退款金额", value: "82,333.62", trend: 2.16 },
            { key: "adRatio", label: "推广费占比", value: "42.01%", trend: 2.70 },
            { key: "refundRate", label: "退款率（按金额）", value: "22.59%", trend: -1.44 },
            { key: "profit", label: "利润（预估）", value: "176,268.33", trend: 5.66 },
            { key: "payQty", label: "销售件数（支付）", value: "1,386", trend: -3.40 },
            { key: "grossMargin", label: "大毛利率", value: "48.37%", trend: 0.88 },
            { key: "platformFee", label: "平台费用（预估）", value: "34,564.92", trend: 1.55 },
            { key: "saleFee", label: "销售费用（预估）", value: "21,683.26", trend: -1.08 },
            { key: "goodsCost", label: "总货款", value: "131,276.18", trend: -4.62 },
            { key: "invalid", label: "无效订单金额（件数）", value: "7,456.00（21）", trend: 8.8 },
            { key: "netSales", label: "净销售金额", value: "282,729.96", trend: -5.70 },
            { key: "jdOrders", label: "京东仓订单量", value: "884", trend: 1.52 },
            { key: "jdRatio", label: "京东仓订单占比", value: "63.77%", trend: 0.60 },
            { key: "netQty", label: "净销售件数", value: "1,163", trend: -2.80 }
          ],
          shops: [
            { shop: "RASW旗舰店", owner: "刘畅", liveAmount: "17,568.69", orders: "177", payAmount: "66,474.58", refundRate: "26.18%" },
            { shop: "HYGEAR医疗保健旗舰店", owner: "郑凯", liveAmount: "19,986.66", orders: "177", payAmount: "56,928.22", refundRate: "34.41%" },
            { shop: "SAWAAG平价专卖店", owner: "吴桐", liveAmount: "14,216.75", orders: "177", payAmount: "52,932.76", refundRate: "41.31%" },
            { shop: "RASW个护旗舰店", owner: "郑凯", liveAmount: "10,792.90", orders: "106", payAmount: "35,991.48", refundRate: "26.89%" },
            { shop: "DIKTTT欧格专卖店", owner: "韩梦凯", liveAmount: "13,747.75", orders: "130", payAmount: "34,409.11", refundRate: "34.86%" },
            { shop: "ZYUTO旗舰店", owner: "刘畅", liveAmount: "7,087.40", orders: "164", payAmount: "29,329.38", refundRate: "7.80%" },
            { shop: "SAWAAG居家旗舰店", owner: "吴桐", liveAmount: "8,640.20", orders: "92", payAmount: "24,810.55", refundRate: "21.40%" },
            { shop: "HYGEAR健康器械旗舰店", owner: "韩梦凯", liveAmount: "6,287.11", orders: "89", payAmount: "29,508.85", refundRate: "18.32%" }
          ]
        }
      ]
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
