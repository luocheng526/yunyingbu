const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const NOTE =
  "演示数据。版式对齐数据总揽、店铺数据、商品数据。数字不是星脉 ERP，爬虫接口对接后替换。不读取、不转发、不展示星脉 ERP、京麦、首页实时、星脉数据中心。";

export const PANES = [
  { key: "overview", label: "数据总揽" },
  { key: "shops", label: "店铺数据" },
  { key: "goods", label: "商品数据" }
];

export const RANGES = ["7天", "30天", "日", "周", "月", "年", "自定义"];
export const SECTIONS = ["渠道列表", "店铺分组", "经营数据", "竞对对比", "品类分析", "热销商品"];

const OVERVIEW_COLS = [
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

const SHOP_COLS = [
  "店铺",
  ...OVERVIEW_COLS,
  "总营销额",
  "全站营销额",
  "非全站营销额",
  "推广花费占比 (支付预估)",
  "利润 (支付预估)",
  "大毛利率",
  "销售费用 (支付预估)",
  "平台费用 (支付预估)",
  "总货款成本",
  "代发单量",
  "无效单量",
  "总货款成本占比",
  "净货款成本 (支付)",
  "净货款成本占比 (支付)",
  "自定义费用",
  "其他费用",
  "耗材费",
  "耗材费 (发货)",
  "打包费"
];

const GOODS_COLS = [
  "商品",
  "店铺",
  "推广SKU",
  "成长阶段",
  "销售单数",
  "净销售单数 (支付)",
  "支付金额 (支付)",
  "无效金额 (标注)",
  "退款金额",
  "退款率 (移)"
];

const OPS_COLS = [
  ["payAmount", "支付金额 (支付)", "m"],
  ["netSales", "净销售额 (支付)", "m"],
  ["netOrderCount", "净销售单数 (支付)", "n"],
  ["refundAmount", "退款金额", "m"],
  ["refundRate", "退款率 (按金额)", "r"],
  ["netGoodsCost", "净货品成本 (支付)", "m"],
  ["netGoodsCostRate", "净货品成本占比 (支付)", "r"],
  ["promotionCost", "推广花费 (支付预估)", "m"],
  ["promotionRate", "推广花费销售额占比 (支付预估)", "r"],
  ["platformFee", "平台花费 (支付预估)", "m"],
  ["customFee", "自定义费用", "m"],
  ["shipFee", "发货费用 (支付)", "m"],
  ["realPayRate", "真实支付转化率", "r"],
  ["profit", "利润 (支付预估)", "p"],
  ["profitRate", "大毛利率", "r"],
  ["grossProfit", "毛利润 (支付预估)", "p"],
  ["smallProfitRate", "小毛利率", "r"]
];

const SHOP_SEEDS = [
  { id: "demo-a", name: "演示旗舰店", color: "#1677ff", pay: 128000, orders: 860, refundRate: 0.08, profitRate: 0.18, newRate: 0.12 },
  { id: "demo-b", name: "演示专营店", color: "#52c41a", pay: 86400, orders: 540, refundRate: 0.11, profitRate: 0.12, newRate: 0.08 },
  { id: "demo-c", name: "演示专卖店", color: "#fa8c16", pay: 43200, orders: 260, refundRate: 0.06, profitRate: 0.21, newRate: 0.15 }
];

const GOODS_SEEDS = [
  { name: "演示保温杯", shopId: "demo-a", sku: "DEMO-SKU-01", stage: "成长", orders: 120, pay: 9600, profit: 2800 },
  { name: "演示收纳盒", shopId: "demo-b", sku: "DEMO-SKU-02", stage: "稳定", orders: 80, pay: 4200, profit: 600 },
  { name: "演示台灯", shopId: "demo-a", sku: "DEMO-SKU-03", stage: "新品", orders: 36, pay: 5400, profit: -320 },
  { name: "演示帆布袋", shopId: "demo-c", sku: "DEMO-SKU-04", stage: "成长", orders: 210, pay: 3150, profit: 880 },
  { name: "演示香薰", shopId: "demo-c", sku: "DEMO-SKU-05", stage: "稳定", orders: 18, pay: 3960, profit: 1400 }
];

function money(value) {
  return Number(value || 0).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function whole(value) {
  return Number(value || 0).toLocaleString("zh-CN", { maximumFractionDigits: 0 });
}

function percent(value) {
  return `${(Number(value || 0) * 100).toFixed(2)}%`;
}

function shanghaiToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
}

function addDays(iso, delta) {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function shopMath(seed) {
  const pay = seed.pay;
  const refund = Math.round(pay * seed.refundRate);
  const net = pay - refund;
  const profit = Math.round(pay * seed.profitRate);
  const promo = Math.round(pay * 0.09);
  const site = Math.round(promo * 0.62);
  const goodsCost = Math.round(pay * 0.42);
  const invalid = Math.round(pay * 0.015);
  return {
    ...seed,
    pay,
    refund,
    net,
    profit,
    promo,
    site,
    offsite: promo - site,
    goodsCost,
    invalid,
    orders: seed.orders,
    netOrders: Math.round(seed.orders * 0.9),
    saleFee: Math.round(pay * 0.04),
    platformFee: Math.round(pay * 0.03),
    customFee: Math.round(pay * 0.01),
    otherFee: Math.round(pay * 0.008),
    materialFee: Math.round(pay * 0.006),
    shipMaterialFee: Math.round(pay * 0.004),
    packFee: Math.round(pay * 0.005),
    dropship: Math.round(seed.orders * 0.2),
    invalidCount: Math.round(seed.orders * 0.03)
  };
}

function overviewCells(row) {
  return [
    money(row.pay),
    percent(row.newRate || 0.1),
    whole(row.orders),
    whole(row.netOrders),
    money(row.pay),
    money(row.invalid),
    money(row.refund),
    percent(row.pay ? row.refund / row.pay : 0),
    money(row.net)
  ];
}

function shopCells(row) {
  return [
    ...overviewCells(row),
    money(row.promo),
    money(row.site),
    money(row.offsite),
    percent(row.pay ? row.promo / row.pay : 0),
    money(row.profit),
    percent(row.pay ? row.profit / row.pay : 0),
    money(row.saleFee),
    money(row.platformFee),
    money(row.goodsCost),
    whole(row.dropship),
    whole(row.invalidCount),
    percent(row.pay ? row.goodsCost / row.pay : 0),
    money(Math.round(row.goodsCost * 0.9)),
    percent(row.pay ? (row.goodsCost * 0.9) / row.pay : 0),
    money(row.customFee),
    money(row.otherFee),
    money(row.materialFee),
    money(row.shipMaterialFee),
    money(row.packFee)
  ];
}

function sumRows(rows) {
  const total = {
    name: "汇总",
    newRate: 0.1,
    pay: 0,
    orders: 0,
    netOrders: 0,
    invalid: 0,
    refund: 0,
    net: 0,
    promo: 0,
    site: 0,
    offsite: 0,
    profit: 0,
    saleFee: 0,
    platformFee: 0,
    goodsCost: 0,
    dropship: 0,
    invalidCount: 0,
    customFee: 0,
    otherFee: 0,
    materialFee: 0,
    shipMaterialFee: 0,
    packFee: 0
  };
  rows.forEach((row) => {
    Object.keys(total).forEach((key) => {
      if (key !== "name" && key !== "newRate") {
        total[key] += Number(row[key]) || 0;
      }
    });
  });
  return total;
}

function goodsFlags(row) {
  const orders = row.orders || 0;
  const pay = row.pay || 0;
  const profit = row.profit || 0;
  const aov = orders ? pay / orders : 0;
  const costRatio = pay ? (pay - profit) / pay : 1;
  return {
    highMargin: pay > 0 && costRatio < 0.3,
    strategy: pay > 0 && costRatio <= 0.7,
    refund: false,
    loss: profit < 0,
    lowAov: aov > 0 && aov < 50,
    midAov: aov > 0 && aov <= 50,
    highAov: aov > 100,
    convLoss: profit < 0,
    searchLoss: false,
    cartLowPay: false,
    profitDown: false,
    profitUp: profit > 1000,
    feeDown: false
  };
}

function buildDays(today) {
  return Array.from({ length: 30 }, (_, index) => {
    const offset = index - 29;
    const wave = 0.82 + (index % 7) * 0.04;
    const pay = Math.round(8600 * wave);
    const refund = Math.round(pay * 0.09);
    const orders = 40 + (index % 5) * 6;
    return {
      date: addDays(today, offset),
      payAmount: pay,
      netSales: pay - refund,
      netOrderCount: orders,
      refundAmount: refund,
      refundRate: refund / pay,
      netGoodsCost: Math.round(pay * 0.41),
      netGoodsCostRate: 0.41,
      promotionCost: Math.round(pay * 0.09),
      promotionRate: 0.09,
      platformFee: Math.round(pay * 0.03),
      customFee: Math.round(pay * 0.01),
      shipFee: Math.round(pay * 0.02),
      realPayRate: 0.034,
      profit: Math.round(pay * 0.16),
      profitRate: 0.16,
      grossProfit: Math.round(pay * 0.22),
      smallProfitRate: 0.22
    };
  });
}

function heroSeries(lastPay) {
  const yesterday = Array.from({ length: 24 }, (_, hour) => Math.round((lastPay / 24) * (0.55 + (hour % 6) * 0.08)));
  const today = yesterday.map((value, hour) => (hour < 16 ? Math.round(value * 0.92) : 0));
  return { yesterday, today };
}

function goodsCards(rows) {
  const defs = [
    { key: "all", label: "全部", hint: "", color: "#8c8c8c" },
    { key: "highMargin", label: "高毛利高利润单品", hint: "净商品成本占比(支付) < 30%", color: "#cf1322" },
    { key: "strategy", label: "利润/毛利战略单品", hint: "净商品成本占比 <= 70%", color: "#d46b08" },
    { key: "refund", label: "款式/货值高退款", hint: "推广花费占比 >= 30%", color: "#d4b106" },
    { key: "loss", label: "利润亏损链接", hint: "利润支付额 < 0", color: "#cf1322" },
    { key: "lowAov", label: "低客单价", hint: "真实客单价 < 50", color: "#eb2f96" },
    { key: "midAov", label: "中客单价", hint: "真实客单价 <= 50", color: "#d46b08" },
    { key: "highAov", label: "高客单价", hint: "真实客单价 > 100", color: "#722ed1" },
    { key: "convLoss", label: "高转化亏损", hint: "利润支付额 < 0", color: "#13c2c2" },
    { key: "searchLoss", label: "高搜索亏损", hint: "搜索访客 >= 80%", color: "#1677c7" },
    { key: "cartLowPay", label: "高加购低付费", hint: "加购率 > 10%", color: "#389e0d" },
    { key: "profitDown", label: "利润环比下降30%+", hint: "利润环比 <= -30%", color: "#cf1322" },
    { key: "profitUp", label: "利润环比增长30%+", hint: "利润支付环比 >= 30%", color: "#cf1322" },
    { key: "feeDown", label: "费比环比下降5%+", hint: "推广花费占比环比 <= -5%", color: "#d46b08" }
  ];
  const counts = { all: rows.length };
  rows.forEach((row) => {
    Object.entries(row.flags).forEach(([key, on]) => {
      if (on) {
        counts[key] = (counts[key] || 0) + 1;
      }
    });
  });
  const denom = counts.all || 1;
  return defs.map((def) => {
    const value = counts[def.key] || 0;
    return {
      ...def,
      value: String(value),
      share: `${((value / denom) * 100).toFixed(2)}% 占比`,
      delta: "0.00% 环比"
    };
  });
}

export function normalizeFilters(input) {
  const src = input && typeof input === "object" ? input : {};
  let from = DATE_RE.test(String(src.from || "")) ? String(src.from) : "";
  let to = DATE_RE.test(String(src.to || "")) ? String(src.to) : "";
  if (from && to && from > to) {
    const swap = from;
    from = to;
    to = swap;
  }
  return { from, to, q: String(src.q || "").trim().slice(0, 80) };
}

export function demoBoard() {
  const today = shanghaiToday();
  const shops = SHOP_SEEDS.map(shopMath);
  const total = sumRows(shops);
  const days = buildDays(today);
  const last = days[days.length - 1];
  const hero = heroSeries(last.payAmount);
  const goods = GOODS_SEEDS.map((item) => {
    const shop = shops.find((row) => row.id === item.shopId);
    const refund = Math.round(item.pay * 0.07);
    const flags = goodsFlags(item);
    return {
      name: item.name,
      shopId: item.shopId,
      shopName: shop.name,
      thumb: true,
      flags,
      cells: [
        shop.name,
        item.sku,
        item.stage,
        whole(item.orders),
        whole(Math.round(item.orders * 0.92)),
        money(item.pay),
        money(Math.round(item.pay * 0.01)),
        money(refund),
        percent(item.pay ? refund / item.pay : 0)
      ]
    };
  });
  return {
    ok: true,
    module: "bound",
    source: "crawler",
    erp: false,
    demo: true,
    connected: false,
    label: "爬虫，非 ERP",
    note: NOTE,
    panes: PANES,
    ranges: RANGES,
    sections: SECTIONS,
    opsCols: OPS_COLS.map((col) => ({ key: col[0], label: col[1], kind: col[2] })),
    days,
    overview: {
      title: "数据总览",
      summary: { channels: 1, shops: shops.length },
      hero: {
        label: "实时销售额",
        value: whole(last.payAmount),
        delta: -3.2,
        yesterday: hero.yesterday,
        today: hero.today
      },
      cards: [
        { key: "pay", label: "支付金额 (支付)", value: whole(total.pay) },
        { key: "orders", label: "销售单数 (支付)", value: whole(total.netOrders) },
        { key: "ad", label: "推广花费 (支付预估)", value: whole(total.promo), extra: `推广花费占比 ${percent(total.pay ? total.promo / total.pay : 0)}` },
        { key: "profit", label: "利润 (支付预估)", value: whole(total.profit), extra: `毛利率 ${percent(total.pay ? total.profit / total.pay : 0)}` },
        { key: "margin", label: "大毛利率", value: percent(total.pay ? total.profit / total.pay : 0) },
        { key: "custom", label: "自定义费用", value: whole(total.customFee) },
        { key: "refundRate", label: "退款率 (按金额)", value: percent(total.pay ? total.refund / total.pay : 0) },
        { key: "adRate", label: "推广花费占比 (支付预估)", value: percent(total.pay ? total.promo / total.pay : 0) }
      ],
      channel: {
        title: "渠道列表",
        columns: ["渠道", ...OVERVIEW_COLS],
        rows: [
          { name: "汇总", cells: overviewCells(total) },
          { name: "京东", cells: overviewCells(total) }
        ]
      },
      shopTable: {
        title: "店铺列表",
        columns: ["店铺", ...OVERVIEW_COLS],
        rows: [{ name: "汇总", cells: overviewCells(total) }].concat(
          shops.map((shop) => ({ name: shop.name, color: shop.color, cells: overviewCells(shop) }))
        )
      },
      groups: {
        title: "店铺分组",
        columns: ["分组", "店铺数", "支付金额 (支付)", "利润 (支付预估)"],
        rows: [
          { name: "演示一组", cells: ["2", money(shops[0].pay + shops[1].pay), money(shops[0].profit + shops[1].profit)] },
          { name: "演示二组", cells: ["1", money(shops[2].pay), money(shops[2].profit)] }
        ]
      },
      rivals: {
        title: "竞对对比",
        columns: ["对象", "支付金额 (支付)", "销售单数", "退款率 (按金额)"],
        rows: [
          { name: "演示本品", cells: [money(total.pay), whole(total.orders), percent(total.pay ? total.refund / total.pay : 0)] },
          { name: "演示竞品", cells: [money(Math.round(total.pay * 0.86)), whole(Math.round(total.orders * 0.9)), "9.40%"] }
        ]
      },
      categories: {
        title: "品类分析",
        columns: ["品类", "支付金额 (支付)", "销售单数", "利润 (支付预估)"],
        rows: [
          { name: "杯壶", cells: [money(9600), "120", money(2800)] },
          { name: "收纳", cells: [money(4200), "80", money(600)] },
          { name: "灯具", cells: [money(5400), "36", money(-320)] }
        ]
      },
      hot: {
        title: "热销商品",
        columns: ["商品", "店铺", "支付金额 (支付)", "销售单数"],
        rows: goods.slice(0, 4).map((item) => ({ name: item.name, cells: [item.shopName, item.cells[5], item.cells[3]] }))
      }
    },
    shops: {
      title: "店铺总览",
      columns: SHOP_COLS,
      rows: [{ name: "汇总", cells: shopCells(total) }].concat(
        shops.map((shop) => ({ name: shop.name, color: shop.color, cells: shopCells(shop) }))
      )
    },
    goods: {
      title: "商品数据总览",
      columns: GOODS_COLS,
      shops: shops.map((shop) => ({ id: shop.id, shopName: shop.name })),
      cards: goodsCards(goods),
      rows: goods
    }
  };
}

export async function readBoard() {
  return demoBoard();
}
