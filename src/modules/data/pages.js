/** Demo payloads for data-center child pages. No database. */

export function getStoreLive() {
  return {
    ok: true,
    demo: true,
    notice: "演示数据",
    title: "店铺实时数据",
    updatedAt: "2026-09-08 17:20",
    cards: [
      { label: "近5分钟成交", value: "6,480", unit: "元" },
      { label: "近5分钟订单", value: 12, unit: "单" },
      { label: "在线访客", value: 86, unit: "人" },
      { label: "支付转化", value: "3.8", unit: "%" }
    ],
    rows: [
      { store: "华东旗舰", gmv: "2,160", orders: 4, visitors: 31 },
      { store: "华南直营", gmv: "1,890", orders: 3, visitors: 22 },
      { store: "华北仓店", gmv: "1,240", orders: 3, visitors: 18 },
      { store: "西南专营", gmv: "1,190", orders: 2, visitors: 15 }
    ]
  };
}

export function getStoreOverview() {
  return {
    ok: true,
    demo: true,
    notice: "演示数据",
    title: "店铺数据总揽",
    range: "本周",
    cards: [
      { label: "店铺数", value: 4, unit: "家" },
      { label: "周成交", value: "186,200", unit: "元" },
      { label: "周订单", value: 412, unit: "单" },
      { label: "退款率", value: "1.2", unit: "%" }
    ],
    rows: [
      { store: "华东旗舰", gmv: "72,400", orders: 158, refund: "0.8%" },
      { store: "华南直营", gmv: "51,150", orders: 121, refund: "1.1%" },
      { store: "华北仓店", gmv: "36,230", orders: 79, refund: "1.4%" },
      { store: "西南专营", gmv: "26,420", orders: 54, refund: "1.9%" }
    ]
  };
}

export function getPlaceholder() {
  return {
    ok: true,
    demo: true,
    placeholder: true,
    notice: "建设中",
    title: "占位",
    cards: [],
    rows: []
  };
}

/** Team-level 数据总揽 demo. No company view. Numbers copied from the product mock. */
export function getTeamOverview() {
  return {
    ok: true,
    demo: true,
    notice: "示例数据，尚未接入店铺",
    title: "数据总揽",
    scope: "团队",
    range: "昨天",
    dateFrom: "2026-09-08",
    dateTo: "2026-09-08",
    ranges: ["昨天", "近3天", "近7天", "近15天", "近30天", "本月", "上月", "今年"],
    cards: [
      { key: "payAmount", label: "支付金额 (支付)", value: "912,658.94", delta: -5.81 },
      { key: "adSpend", label: "推广花费 (支付预估)", value: "382,745.07", delta: -1.79 },
      { key: "refundAmount", label: "退款金额", value: "205,834.05", delta: -12.13 },
      { key: "adSpendRate", label: "推广花费 (支付预估) 占比", value: "41.94%" },
      { key: "refundRate", label: "退款率 (按金额)", value: "22.55%" },
      { key: "profit", label: "利润 (支付预估)", value: "446,392.64", delta: -4.48 },
      { key: "orderCount", label: "销售单数 (支付)", value: "3,466", delta: -5.71 },
      { key: "grossMargin", label: "大毛利率", value: "48.91%" },
      { key: "platformSpend", label: "平台花费 (支付预估)", value: "49,690.97", delta: -6.4 },
      { key: "salesExpense", label: "销售费用 (支付预估)", value: "432,436.04", delta: -2.34 },
      { key: "goodsCost", label: "总货品成本", value: "28,156.56", delta: 5.89 },
      { key: "invalidAmount", label: "无效单金额", value: "677", delta: -21.54 },
      { key: "netSales", label: "净销售额 (支付)", value: "906,869.84", delta: -3.11 },
      { key: "jdOrders", label: "京仓订单数量", value: "2,211", delta: -9.12 },
      { key: "jdOrderRate", label: "京仓订单占比", value: "63.79%" },
      { key: "netQty", label: "净销售件数 (支付)", value: "4,098", delta: -5.92 },
      { key: "netGoodsCost", label: "净货品成本 (支付)", value: "28,041.16", delta: 8.61 }
    ],
    liveIndex: {
      title: "实时销售指数",
      total: "210,087.32",
      time: "10:30",
      group: "按店铺",
      rows: [
        { rank: 1, store: "RASW家居旗舰店", owner: "张文静", sales: "17,970.14", delta: -0.33 },
        { rank: 2, store: "AILUKI居家布艺旗舰店", owner: "李昊", sales: "16,420.08", delta: -1.12 },
        { rank: 3, store: "星脉茶具专营店", owner: "王倩", sales: "14,880.50", delta: 0.86 },
        { rank: 4, store: "华北仓店", owner: "赵磊", sales: "12,210.33", delta: -2.04 },
        { rank: 5, store: "华南直营", owner: "陈静", sales: "11,640.20", delta: -0.58 }
      ]
    },
    heroBoard: {
      title: "龙虎榜",
      rows: [
        { rank: 1, store: "AILUKI居家布艺旗舰店", owner: "李昊", sales: "92,860.64" },
        { rank: 2, store: "RASW家居旗舰店", owner: "张文静", sales: "81,240.18" },
        { rank: 3, store: "星脉茶具专营店", owner: "王倩", sales: "63,150.90" },
        { rank: 4, store: "华北仓店", owner: "赵磊", sales: "48,320.00" },
        { rank: 5, store: "华南直营", owner: "陈静", sales: "41,080.22" }
      ]
    }
  };
}

export function getGoodsOverview() {
  return {
    ok: true,
    demo: true,
    notice: "演示数据",
    title: "商品数据总揽",
    range: "本周",
    cards: [
      { label: "在售商品", value: 86, unit: "款" },
      { label: "动销款", value: 41, unit: "款" },
      { label: "周销量", value: 1_280, unit: "件" },
      { label: "缺货预警", value: 3, unit: "款" }
    ],
    rows: [
      { sku: "XM-茶具-01", name: "星脉茶具套装", sales: 186, stock: 420 },
      { sku: "XM-礼盒-08", name: "节庆礼盒", sales: 142, stock: 88 },
      { sku: "XM-杯-12", name: "保温随行杯", sales: 119, stock: 12 },
      { sku: "XM-巾-03", name: "棉麻茶巾", sales: 76, stock: 0 }
    ]
  };
}
