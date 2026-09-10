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

/** Channel-overview template for 数据总揽. Demo numbers from the product mock. */
export function getTeamOverview() {
  const tableCols = [
    "渠道",
    "实时销售额 (支付)",
    "店铺上新成功率",
    "销售单数",
    "净销售单数 (支付)",
    "支付金额 (支付)",
    "无效单金额 (标注)",
    "退款金额",
    "退款率 (按金额)",
    "净销售额 (支付)"
  ];
  return {
    ok: true,
    demo: true,
    notice: "示例数据，尚未接入店铺",
    title: "渠道总览",
    scope: "团队",
    range: "7天",
    dateLabel: "2026年9月9日",
    ranges: ["7天", "昨日", "周", "月", "年", "自定义"],
    summary: { channels: 1, shops: 46 },
    hero: {
      label: "实时销售指数",
      value: "165,362.13",
      delta: -7.44,
      spark: [28, 30, 26, 32, 31, 36, 34, 40, 38, 48, 46, 58]
    },
    cards: [
      { key: "pay", label: "支付金额 (支付)", value: "837,247.17" },
      { key: "orders", label: "销售单数 (支付)", value: "3,174" },
      { key: "ad", label: "推广花费 (支付预估)", value: "348,174.63", extra: "推广占比 41.59%" },
      { key: "profit", label: "利润 (支付预估)", value: "415,136.64", extra: "毛利率 49.58%" },
      { key: "margin", label: "大毛利率", value: "49.58%" },
      { key: "custom", label: "自定义费用", value: "0" },
      { key: "refundRate", label: "退款率 (按金额)", value: "27.02%" },
      { key: "adRate", label: "推广花费占比 (支付预估)", value: "41.59%" }
    ],
    sections: ["渠道列表", "店铺分组", "经营数据", "竞对对比", "品类分析", "热销商品"],
    channelTable: {
      title: "渠道列表",
      columns: tableCols,
      rows: [
        {
          name: "汇总",
          kind: "sum",
          cells: ["165,362.13", "--", "3,194", "3,174", "837,247.17", "0", "226,229.63", "27.02%", "825,966.57"]
        },
        {
          name: "京东",
          kind: "jd",
          cells: ["165,362.13", "--", "3,194", "3,174", "837,247.17", "0", "226,229.63", "27.02%", "825,966.57"]
        }
      ]
    },
    shopTable: {
      title: "店铺列表",
      columns: [
        "店铺",
        "实时销售额 (支付)",
        "店铺上新成功率",
        "销售单数",
        "净销售单数 (支付)",
        "支付金额 (支付)",
        "无效单金额 (标注)",
        "退款金额",
        "退款率 (按金额)",
        "净销售额 (支付)"
      ],
      rows: [
        {
          name: "当页汇总",
          kind: "sum",
          cells: ["118,700.32", "0.0000%", "2,289", "2,273", "663,906.61", "0", "184,552.98", "27.80%", "654,123.66"]
        },
        {
          name: "RASW家居旗舰店",
          kind: "shop",
          cells: ["12,889.30", "0.0000%", "205", "202", "70,190.95", "0", "18,467.65", "26.31%", "68,877.95"]
        }
      ]
    }
  };
}

/** Shop-overview template for 店铺数据. Demo numbers from the product mock. */
export function getShopOverview() {
  const columns = [
    "店铺",
    "实时销售额 (支付)",
    "店铺上新成功率",
    "销售单数",
    "净销售单数 (支付)",
    "支付金额 (支付)",
    "无效单金额 (标注)",
    "退款金额",
    "退款率 (按金额)",
    "净销售额 (支付)"
  ];
  return {
    ok: true,
    demo: true,
    notice: "示例数据，尚未接入店铺",
    title: "店铺总览",
    scope: "店铺",
    range: "7天",
    dateLabel: "2026年9月9日",
    ranges: ["7天", "30天", "昨日", "年", "自定义"],
    views: [
      { label: "渠道总览", href: "/data/overview" },
      { label: "店铺总览", href: "/data/shops" }
    ],
    shopTable: {
      title: "店铺列表",
      columns,
      rows: [
        { name: "当页汇总", kind: "sum", cells: ["190,231.43", "0.0000%", "2,289", "2,266", "663,906.61", "0", "184,562.98", "27.80%", "652,398.36"] },
        { name: "RASW家居旗舰店", kind: "shop", color: "#4da6ff", cells: ["22,997.91", "0.0000%", "205", "201", "70,190.95", "0", "18,467.65", "26.31%", "68,622.20"] },
        { name: "RASW旗舰店", kind: "shop", color: "#4da6ff", cells: ["17,568.69", "0.0000%", "177", "175", "66,474.58", "0", "17,404.15", "26.18%", "62,944.61"] },
        { name: "HYGEAR医疗保健旗舰店", kind: "shop", color: "#4da6ff", cells: ["19,986.66", "--", "177", "175", "56,928.22", "0", "19,514.18", "34.41%", "56,429.71"] },
        { name: "SAWAAG平价专卖店", kind: "shop", color: "#4da6ff", cells: ["14,216.75", "--", "177", "174", "52,932.76", "0", "21,866.26", "41.31%", "51,465.57"] },
        { name: "RASW生活电器旗舰店", kind: "shop", color: "#e53935", cells: ["8,929.03", "--", "168", "167", "52,426.01", "0", "13,108.66", "25.00%", "52,127.01"] },
        { name: "RASW个护旗舰店", kind: "shop", color: "#4da6ff", cells: ["10,792.90", "0.0000%", "106", "105", "35,991.48", "0", "9,677.28", "26.89%", "35,602.48"] },
        { name: "DIKTTT欧格专卖店", kind: "shop", color: "#e53935", cells: ["13,747.75", "--", "130", "127", "34,409.11", "0", "11,996.38", "34.86%", "33,577.11"] },
        { name: "RASW健康电器旗舰店", kind: "shop", color: "#4da6ff", cells: ["10,018.13", "--", "115", "115", "30,516.64", "0", "5,219.00", "17.10%", "30,516.64"] },
        { name: "HYGEAR健康器械旗舰店", kind: "shop", color: "#4da6ff", cells: ["6,287.11", "--", "89", "89", "29,508.85", "0", "5,406.55", "18.32%", "29,508.85"] },
        { name: "ZYUTO旗舰店", kind: "shop", color: "#e53935", cells: ["7,087.40", "0.0000%", "164", "163", "29,329.38", "0", "2,288.14", "7.80%", "29,200.38"] },
        { name: "SAWAAG居家旗舰店", kind: "shop", color: "#4da6ff", cells: ["5,226.70", "--", "95", "95", "25,147.45", "0", "4,483.92", "17.83%", "25,147.45"] },
        { name: "张望居家旗舰店", kind: "shop", color: "#e53935", cells: ["8,850.20", "--", "107", "107", "24,587.95", "0", "4,559.59", "18.54%", "24,587.95"] }
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

/** Goods-overview template for 商品数据. Demo numbers from the product mock. */
export function getGoodsBoard() {
  const zero = { value: "0", share: "0.00% 占比", delta: "0.00% 环比" };
  return {
    ok: true,
    demo: true,
    notice: "示例数据，尚未接入店铺",
    title: "商品数据总览",
    scope: "商品",
    range: "7天",
    dateLabel: "2026年9月9日",
    ranges: ["7天", "30天", "昨日", "周", "月", "年", "自定义"],
    views: [
      { label: "渠道总览", href: "/data/overview" },
      { label: "商品数据总览", href: "/data/goods" }
    ],
    grain: "SPU",
    cards: [
      { key: "all", label: "全部", hint: "", color: "#8c8c8c", ...zero },
      { key: "highMargin", label: "高毛利高利润单品", hint: "净商品成本占比(支付) < 30%", color: "#cf1322", ...zero },
      { key: "strategy", label: "利润/毛利战略单品", hint: "净商品成本占比 <= 70%", color: "#d46b08", ...zero },
      { key: "refund", label: "款式/货值高退款", hint: "推广花费占比 >= 30%", color: "#d4b106", ...zero },
      { key: "loss", label: "利润亏损链接", hint: "利润支付额 < 0", color: "#cf1322", ...zero },
      { key: "lowAov", label: "低客单价", hint: "真实客单价 < 50", color: "#eb2f96", ...zero },
      { key: "midAov", label: "中客单价", hint: "真实客单价 <= 50", color: "#d46b08", ...zero },
      { key: "highAov", label: "高客单价", hint: "真实客单价 > 100", color: "#722ed1", ...zero },
      { key: "convLoss", label: "高转化亏损", hint: "利润支付额 < 0", color: "#13c2c2", ...zero },
      { key: "searchLoss", label: "高搜索亏损", hint: "搜索访客 >= 80%", color: "#1677c7", ...zero },
      { key: "cartLowPay", label: "高加购低付费", hint: "加购率 > 10%", color: "#389e0d", ...zero },
      { key: "profitDown", label: "利润环比下降30%+", hint: "利润环比 <= -30%", color: "#cf1322", ...zero },
      { key: "profitUp", label: "利润环比增长30%+", hint: "利润支付环比 >= 30%", color: "#cf1322", ...zero },
      { key: "feeDown", label: "费比环比下降5%+", hint: "推广花费占比环比 <= -5%", color: "#d46b08", ...zero }
    ],
    goodsTable: {
      title: "商品列表",
      columns: [
        "商品",
        "店铺",
        "推广SKU",
        "成长阶段",
        "销售单数",
        "净销售单数",
        "支付金额",
        "无效金额 (标注)",
        "退款金额",
        "退款率 (移)"
      ],
      rows: [
        {
          name: "当页汇总",
          kind: "sum",
          store: "",
          cells: ["", "--", "--", "28", "28", "8,444.60", "0", "0", "0.00%"]
        },
        {
          name: "SPU:10031884709988 SAWAAG德国儿童枕头-12岁护颈枕",
          kind: "sku",
          store: "张望跨境专卖店",
          cells: ["张望跨境专卖店", "--", "--", "9", "9", "3,177.80", "0", "0", "0.00%"]
        }
      ]
    }
  };
}
