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
