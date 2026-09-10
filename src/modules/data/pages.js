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
      { key: "profit", label: "利润 (支付预估)", value: "415,136.64" },
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
          cells: ["165,362.13", "--", "3,194", "3,174", "837,247.17", "0", "226,229.63", "27.02%", "825,966.57"]
        },
        {
          name: "京东",
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
          cells: ["118,700.32", "0.0000%", "2,289", "2,273", "663,906.61", "0", "184,552.98", "27.80%", "654,123.66"]
        },
        {
          name: "RASW家居旗舰店",
          cells: ["12,889.30", "0.0000%", "205", "202", "70,190.95", "0", "18,467.65", "26.31%", "68,877.95"]
        }
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
