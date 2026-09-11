/* xm-module-home 0.1.317-home-shopid */
(function () {
  var VIEWS = [
    { key: "company", label: "公司" },
    { key: "team", label: "团队" },
    { key: "live", label: "实时" },
    { key: "board", label: "排行榜" }
  ];
  var RANGES = [
    { key: "yesterday", label: "昨天" },
    { key: "d3", label: "近3天" },
    { key: "d7", label: "近7天" },
    { key: "d15", label: "近15天" },
    { key: "d30", label: "近30天" },
    { key: "month", label: "本月" },
    { key: "lastMonth", label: "上月" },
    { key: "year", label: "今年" }
  ];
  var FALLBACK = {
    cards: [
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
    ],
    index: {
      title: "实时销售指数",
      value: "407,140.54",
      time: "15:30",
      mode: "shop",
      rows: [
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
      ]
    },
    tiger: {
      title: "龙虎榜",
      rows: [
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
      ]
    },
    live: {
      title: "实时看板",
      dateLabel: "",
      range: "7天",
      source: "数据中心",
      href: "/data/paid",
      summary: { channels: 1, shops: 10 },
      hero: {
        label: "实时销售指数",
        value: "165,362.13",
        delta: -7.44,
        yesterday: [42, 38, 32, 28, 26, 24, 25, 30, 38, 48, 58, 66, 72, 70, 68, 74, 80, 86, 84, 78, 70, 62, 55, 48],
        today: [40, 36, 30, 26, 24, 22, 23, 28, 34, 44, 52, 60, 64]
      },
      paid: {
        label: "实时付费金额",
        value: "41,340.88",
        delta: -5.20,
        yesterday: [18, 16, 14, 12, 11, 10, 11, 14, 18, 22, 26, 30, 32, 31, 30, 33, 36, 38, 37, 34, 30, 26, 22, 20],
        today: [16, 15, 13, 11, 10, 9, 10, 13, 16, 20, 24, 27, 29]
      },
      cards: [
        { key: "ad", label: "推广花费 (支付预估)", value: "348,174.63", extra: "推广占比 41.59%" },
        { key: "profit", label: "利润 (支付预估)", value: "415,136.64", extra: "毛利率 49.58%" },
        { key: "roi", label: "付费成交ROI", value: "2.40" },
        { key: "livePay", label: "实时付费成交额", value: "12,480.50" },
        { key: "liveFee", label: "实时费比", value: "41.75%" }
      ]
    },
    shops: [
      { shop: "RASW家居旗舰店", liveAmount: "22,997.91", paidAmount: "8,280.40", profit: "6,210.18", roi: "2.51", paidDeal: "3,680.15", feeRate: "35.32%", orders: "205", payAmount: "70,190.95", refundRate: "26.31%" },
      { shop: "RASW旗舰店", liveAmount: "17,568.69", paidAmount: "6,324.70", profit: "4,743.55", roi: "2.38", paidDeal: "2,811.00", feeRate: "36.18%", orders: "177", payAmount: "66,474.58", refundRate: "26.18%" },
      { shop: "HYGEAR医疗保健旗舰店", liveAmount: "19,986.66", paidAmount: "7,195.20", profit: "5,396.40", roi: "2.22", paidDeal: "3,197.86", feeRate: "38.41%", orders: "177", payAmount: "56,928.22", refundRate: "34.41%" },
      { shop: "SAWAAG平价专卖店", liveAmount: "14,216.75", paidAmount: "5,118.03", profit: "3,838.52", roi: "2.08", paidDeal: "2,274.68", feeRate: "41.31%", orders: "177", payAmount: "52,932.76", refundRate: "41.31%" },
      { shop: "RASW生活电器旗舰店", liveAmount: "8,929.03", paidAmount: "3,214.45", profit: "2,410.84", roi: "2.44", paidDeal: "1,428.64", feeRate: "33.80%", orders: "168", payAmount: "52,426.01", refundRate: "25.00%" },
      { shop: "RASW个护旗舰店", liveAmount: "10,792.90", paidAmount: "3,885.44", profit: "2,914.08", roi: "2.31", paidDeal: "1,726.86", feeRate: "36.89%", orders: "106", payAmount: "35,991.48", refundRate: "26.89%" },
      { shop: "DIKTTT欧格专卖店", liveAmount: "13,747.75", paidAmount: "4,949.19", profit: "3,711.89", roi: "2.15", paidDeal: "2,199.64", feeRate: "39.86%", orders: "130", payAmount: "34,409.11", refundRate: "34.86%" },
      { shop: "RASW健康电器旗舰店", liveAmount: "10,018.13", paidAmount: "3,606.53", profit: "2,704.90", roi: "2.62", paidDeal: "1,602.90", feeRate: "31.10%", orders: "115", payAmount: "30,516.64", refundRate: "17.10%" },
      { shop: "HYGEAR健康器械旗舰店", liveAmount: "6,287.11", paidAmount: "2,263.36", profit: "1,697.52", roi: "2.28", paidDeal: "1,005.94", feeRate: "34.32%", orders: "89", payAmount: "29,508.85", refundRate: "18.32%" },
      { shop: "ZYUTO旗舰店", liveAmount: "7,087.40", paidAmount: "2,551.46", profit: "1,913.60", roi: "2.74", paidDeal: "1,133.98", feeRate: "28.80%", orders: "164", payAmount: "29,329.38", refundRate: "7.80%" }
    ],
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
    ],
    ladders: [
      {
        key: "perf",
        title: "业绩排行榜",
        unit: "业绩指数",
        columns: [
          {
            title: "运营排行榜",
            rows: [
              { name: "张文静", amount: "585,528.77" },
              { name: "陈明婧", amount: "364,394.18" },
              { name: "郭桂良", amount: "342,816.69" },
              { name: "王博", amount: "273,203.33" },
              { name: "崔安琪", amount: "259,020.61" },
              { name: "郭哲宁", amount: "246,265.67" },
              { name: "高丽男", amount: "237,946.14" },
              { name: "刘畅", amount: "223,926.24" },
              { name: "吴桐", amount: "212,929.41" },
              { name: "郑凯", amount: "210,833.54" }
            ]
          },
          {
            title: "主管排行榜",
            rows: [
              { name: "杨润泽", amount: "612,787.80" },
              { name: "李斌", amount: "584,589.44" },
              { name: "刘志勇", amount: "497,311.93" },
              { name: "罗铮", amount: "483,799.74" },
              { name: "冯瑾", amount: "466,671.93" },
              { name: "高婷", amount: "391,553.00" },
              { name: "冯玉辰", amount: "386,949.92" },
              { name: "栗静萱", amount: "348,775.68" },
              { name: "杨禄", amount: "317,635.27" }
            ]
          },
          {
            title: "经理排行榜",
            rows: [
              { name: "沈子晗", amount: "1,695,404.92" },
              { name: "韩梦凯", amount: "1,611,339.53" },
              { name: "李忠瑞", amount: "1,574,022.42" },
              { name: "荣越", amount: "1,172,511.68" },
              { name: "丹井", amount: "889,167.46" },
              { name: "王鑫", amount: "710,000.44" },
              { name: "张勇", amount: "499,507.82" },
              { name: "杨阳", amount: "387,360.18" },
              { name: "武魏", amount: "398,576.83" },
              { name: "张强", amount: "299,312.11" }
            ]
          }
        ]
      },
      {
        key: "profit",
        title: "利润排行榜",
        unit: "利润指数",
        columns: [
          {
            title: "运营排行榜",
            rows: [
              { name: "张文静", amount: "264,402.49" },
              { name: "陈明婧", amount: "176,268.33" },
              { name: "郭桂良", amount: "158,410.20" },
              { name: "王博", amount: "131,276.18" },
              { name: "崔安琪", amount: "124,810.55" },
              { name: "郭哲宁", amount: "118,640.12" },
              { name: "高丽男", amount: "112,508.85" },
              { name: "刘畅", amount: "106,474.58" },
              { name: "吴桐", amount: "98,932.76" },
              { name: "郑凯", amount: "94,409.11" }
            ]
          },
          {
            title: "主管排行榜",
            rows: [
              { name: "杨润泽", amount: "296,914.26" },
              { name: "李斌", amount: "264,402.49" },
              { name: "刘志勇", amount: "229,647.04" },
              { name: "罗铮", amount: "196,914.26" },
              { name: "冯瑾", amount: "176,268.33" },
              { name: "高婷", amount: "153,098.03" },
              { name: "冯玉辰", amount: "131,276.18" },
              { name: "栗静萱", amount: "123,500.43" },
              { name: "杨禄", amount: "112,508.85" }
            ]
          },
          {
            title: "经理排行榜",
            rows: [
              { name: "沈子晗", amount: "764,402.49" },
              { name: "韩梦凯", amount: "676,268.33" },
              { name: "李忠瑞", amount: "615,136.64" },
              { name: "荣越", amount: "512,511.68" },
              { name: "丹井", amount: "415,136.64" },
              { name: "王鑫", amount: "348,174.63" },
              { name: "张勇", amount: "264,402.49" },
              { name: "杨阳", amount: "196,914.26" },
              { name: "武魏", amount: "176,268.33" },
              { name: "张强", amount: "131,276.18" }
            ]
          }
        ]
      }
    ]
  };

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function shanghaiYmd(daysAgo) {
    var today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());
    var shift = Number(daysAgo) || 0;
    if (!shift) {
      return today;
    }
    var parts = today.split("-").map(function (item) {
      return Number(item);
    });
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] - shift)));
  }

  function rangeDates(range) {
    if (range === "d3") {
      return { from: shanghaiYmd(3), to: shanghaiYmd(1) };
    }
    if (range === "d7") {
      return { from: shanghaiYmd(7), to: shanghaiYmd(1) };
    }
    if (range === "d15") {
      return { from: shanghaiYmd(15), to: shanghaiYmd(1) };
    }
    if (range === "d30") {
      return { from: shanghaiYmd(30), to: shanghaiYmd(1) };
    }
    if (range === "month") {
      var today = shanghaiYmd(0);
      return { from: today.slice(0, 8) + "01", to: today };
    }
    if (range === "lastMonth") {
      var first = shanghaiYmd(0).slice(0, 8) + "01";
      var parts = first.split("-").map(Number);
      var prev = new Date(Date.UTC(parts[0], parts[1] - 2, 1));
      var last = new Date(Date.UTC(parts[0], parts[1] - 1, 0));
      var fmt = function (d) {
        return new Intl.DateTimeFormat("en-CA", {
          timeZone: "UTC",
          year: "numeric",
          month: "2-digit",
          day: "2-digit"
        }).format(d);
      };
      return { from: fmt(prev), to: fmt(last) };
    }
    if (range === "year") {
      return { from: shanghaiYmd(0).slice(0, 4) + "-01-01", to: shanghaiYmd(0) };
    }
    var y = shanghaiYmd(1);
    return { from: y, to: y };
  }

  function readUser() {
    if (window.__xmBootUser && (window.__xmBootUser.displayName || window.__xmBootUser.username)) {
      return window.__xmBootUser;
    }
    try {
      var cached = sessionStorage.getItem("xm-me");
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (_err) {}
    return null;
  }

  function hiddenCards() {
    try {
      var raw = localStorage.getItem("xm-home-hidden-cards");
      return raw ? JSON.parse(raw) : [];
    } catch (_err) {
      return [];
    }
  }

  function saveHidden(list) {
    try {
      localStorage.setItem("xm-home-hidden-cards", JSON.stringify(list));
    } catch (_err) {}
  }

  function trendHtml(trend) {
    if (trend == null || trend === "") {
      return "";
    }
    var n = Number(trend);
    var up = n >= 0;
    return (
      '<div class="xm-hm-trend ' +
      (up ? "is-up" : "is-down") +
      '">环比 ' +
      (up ? "↗" : "↘") +
      " " +
      Math.abs(n).toFixed(2) +
      "%</div>"
    );
  }

  function rankMark(index) {
    if (index === 0) {
      return '<b class="xm-hm-cup gold">1</b>';
    }
    if (index === 1) {
      return '<b class="xm-hm-cup silver">2</b>';
    }
    if (index === 2) {
      return '<b class="xm-hm-cup bronze">3</b>';
    }
    return "<span>" + (index + 1) + "</span>";
  }

  function cardHtml(card) {
    return (
      '<article class="xm-hm-card" data-card="' +
      escapeHtml(card.key) +
      '"><div class="xm-hm-card-head"><span>' +
      escapeHtml(card.label) +
      '</span><i title="指标">i</i></div><div class="xm-hm-value' +
      (card.accent ? " is-accent" : "") +
      '">' +
      escapeHtml(card.value) +
      "</div>" +
      trendHtml(card.trend) +
      "</article>"
    );
  }

  function shopRowHtml(row, index, withOwner) {
    return (
      "<tr><td>" +
      rankMark(index) +
      "</td><td>" +
      escapeHtml(row.shop) +
      "</td>" +
      (withOwner ? "<td>" + escapeHtml(row.owner || "—") + "</td>" : "") +
      "<td>" +
      escapeHtml(row.liveAmount) +
      "</td><td>" +
      escapeHtml(row.orders || "—") +
      "</td><td>" +
      escapeHtml(row.payAmount || "—") +
      "</td><td>" +
      escapeHtml(row.refundRate || "—") +
      "</td></tr>"
    );
  }

  function teamBlockHtml(team, hide) {
    var cards = (team.cards || []).filter(function (card) {
      return hide.indexOf(card.key) === -1;
    });
    var shops = team.shops || [];
    return (
      '<section class="xm-hm-team" data-team="' +
      escapeHtml(team.key) +
      '"><header class="xm-hm-team-head"><div><h2>' +
      escapeHtml(team.name) +
      "团队</h2><p>店铺按人管责权，数字按店铺id对齐数据中心 ERP。</p></div>" +
      '<a href="' +
      escapeHtml(team.href || "#") +
      '">打开运营中心</a></header>' +
      '<div class="xm-hm-team-kpis">' +
      cards.map(cardHtml).join("") +
      "</div>" +
      '<div class="xm-hm-panel"><h2>责权店铺 <span>' +
      shops.length +
      " 店</span></h2>" +
      '<table class="xm-hm-table"><thead><tr><th>排名</th><th>店铺名称</th><th>运营</th><th>实时销售额</th><th>销售单数</th><th>支付金额</th><th>退款率</th></tr></thead><tbody>' +
      shops.map(function (row, i) {
        return shopRowHtml(row, i, true);
      }).join("") +
      "</tbody></table></div></section>"
    );
  }

  function standItemHtml(row, place, unit) {
    var rank = place === 1 ? "01" : place === 2 ? "02" : "03";
    return (
      '<div class="xm-hm-stand-item is-' +
      place +
      '"><b class="xm-hm-avatar">' +
      escapeHtml((row.name || "—").slice(0, 1)) +
      '</b><span class="xm-hm-stand-rank">TOP ' +
      rank +
      "</span><strong>" +
      escapeHtml(row.name) +
      '</strong><em>' +
      escapeHtml(row.amount) +
      "</em><small>" +
      escapeHtml(unit) +
      "</small></div>"
    );
  }

  function podiumColumnHtml(column, unit) {
    var rows = column.rows || [];
    var first = rows[0] || { name: "—", amount: "—" };
    var second = rows[1] || { name: "—", amount: "—" };
    var third = rows[2] || { name: "—", amount: "—" };
    var rest = rows.slice(3, 10);
    return (
      '<article class="xm-hm-podium"><h3>' +
      escapeHtml(column.title) +
      '</h3><div class="xm-hm-stand">' +
      standItemHtml(second, 2, unit) +
      standItemHtml(first, 1, unit) +
      standItemHtml(third, 3, unit) +
      "</div><ol class=\"xm-hm-rest\">" +
      rest
        .map(function (row, i) {
          var n = i + 4;
          return (
            "<li><span>" +
            (n < 10 ? "0" + n : String(n)) +
            "</span><b>" +
            escapeHtml(row.name) +
            "</b><em>" +
            escapeHtml(row.amount) +
            "</em></li>"
          );
        })
        .join("") +
      "</ol></article>"
    );
  }

  function ladderHtml(ladder) {
    var unit = ladder.unit || "指数";
    return (
      '<section class="xm-hm-ladder" data-ladder="' +
      escapeHtml(ladder.key) +
      '"><h2>' +
      escapeHtml(ladder.title) +
      '</h2><div class="xm-hm-podiums">' +
      (ladder.columns || [])
        .map(function (column) {
          return podiumColumnHtml(column, unit);
        })
        .join("") +
      "</div></section>"
    );
  }

  var LIVE_CARD_KEYS = ["ad", "profit", "roi", "livePay", "liveFee"];

  function pickLiveCards(cards) {
    var map = {};
    (cards || []).forEach(function (card) {
      if (card && card.key) {
        map[card.key] = card;
      }
    });
    return LIVE_CARD_KEYS.map(function (key) {
      if (map[key]) {
        return map[key];
      }
      return blankLive().cards.filter(function (card) {
        return card.key === key;
      })[0];
    }).filter(Boolean);
  }

  function hasVal(value) {
    return value != null && String(value) !== "" && String(value) !== "—";
  }

  function fillLiveShopFields(rows, fallbackRows) {
    var map = {};
    (fallbackRows || []).forEach(function (row) {
      map[row.shop] = row;
    });
    return (rows || []).map(function (row) {
      var fb = map[row.shop] || {};
      return {
        shop: row.shop,
        owner: row.owner || fb.owner || "",
        liveAmount: hasVal(row.liveAmount) ? row.liveAmount : fb.liveAmount || "—",
        orders: hasVal(row.orders) ? row.orders : fb.orders || "—",
        payAmount: hasVal(row.payAmount) ? row.payAmount : fb.payAmount || "—",
        refundRate: hasVal(row.refundRate) ? row.refundRate : fb.refundRate || "—",
        paidAmount: hasVal(row.paidAmount) ? row.paidAmount : fb.paidAmount || "—",
        profit: hasVal(row.profit) ? row.profit : fb.profit || "—",
        roi: hasVal(row.roi) ? row.roi : fb.roi || "—",
        paidDeal: hasVal(row.paidDeal) ? row.paidDeal : fb.paidDeal || "—",
        feeRate: hasVal(row.feeRate) ? row.feeRate : fb.feeRate || "—"
      };
    });
  }

  function readChart(chart, fallback) {
    var src = chart || {};
    var base = fallback || {};
    return {
      label: src.label || base.label,
      value: src.value || base.value,
      delta: src.delta != null ? src.delta : base.delta,
      yesterday: src.yesterday && src.yesterday.length ? src.yesterday : base.yesterday,
      today: src.today && src.today.length ? src.today : src.spark && src.spark.length ? src.spark : base.today
    };
  }

  function compareLineHtml(chart) {
    var width = 640;
    var height = 168;
    var padX = 8;
    var padY = 14;
    var yest = (chart && chart.yesterday) || [];
    var today = (chart && chart.today) || [];
    var max = 1;
    yest.concat(today).forEach(function (n) {
      var v = Number(n) || 0;
      if (v > max) {
        max = v;
      }
    });
    var steps = Math.max(yest.length, today.length, 2) - 1;
    function pts(list) {
      if (!list.length) {
        return "";
      }
      return list
        .map(function (n, i) {
          var x = padX + (i / steps) * (width - padX * 2);
          var y = height - padY - ((Number(n) || 0) / max) * (height - padY * 2);
          return x.toFixed(1) + "," + y.toFixed(1);
        })
        .join(" ");
    }
    var yestPts = pts(yest);
    var todayPts = pts(today);
    return (
      '<svg class="xm-hm-line" viewBox="0 0 ' +
      width +
      " " +
      height +
      '" preserveAspectRatio="none" aria-hidden="true">' +
      (yestPts
        ? '<polyline fill="none" stroke="#2f54eb" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" points="' +
          yestPts +
          '"></polyline>'
        : "") +
      (todayPts
        ? '<polyline fill="none" stroke="#cf1322" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" points="' +
          todayPts +
          '"></polyline>'
        : "") +
      "</svg>"
    );
  }

  function liveChartHtml(chart) {
    var down = Number(chart && chart.delta) < 0;
    return (
      '<article class="xm-hm-chart"><div class="xm-hm-card-head"><span>' +
      escapeHtml((chart && chart.label) || "实时指标") +
      '</span><span class="xm-hm-legs"><i class="is-yest"></i>昨天<i class="is-today"></i>今天</span></div><div class="xm-hm-index-num">' +
      escapeHtml((chart && chart.value) || "—") +
      '</div><div class="xm-hm-trend ' +
      (down ? "is-down" : "is-up") +
      '">环比 ' +
      (down ? "↘" : "↗") +
      " " +
      Math.abs(Number(chart && chart.delta) || 0).toFixed(2) +
      "%</div>" +
      compareLineHtml(chart) +
      "</article>"
    );
  }

  function liveShopRowHtml(row, index) {
    return (
      "<tr><td>" +
      rankMark(index) +
      "</td><td>" +
      escapeHtml(row.shop) +
      "</td><td>" +
      escapeHtml(row.liveAmount || "—") +
      "</td><td>" +
      escapeHtml(row.paidAmount || "—") +
      "</td><td>" +
      escapeHtml(row.profit || "—") +
      "</td><td>" +
      escapeHtml(row.roi || "—") +
      "</td><td>" +
      escapeHtml(row.paidDeal || "—") +
      "</td><td>" +
      escapeHtml(row.feeRate || "—") +
      "</td></tr>"
    );
  }

  function liveCardHtml(card) {
    return (
      '<article class="xm-hm-card"><div class="xm-hm-card-head"><span>' +
      escapeHtml(card.label) +
      "</span></div><div class=\"xm-hm-value\">" +
      escapeHtml(card.value) +
      "</div>" +
      (card.extra ? '<div class="xm-hm-trend">' + escapeHtml(card.extra) + "</div>" : "") +
      "</article>"
    );
  }

  function readShopRows(payload) {
    var table = payload && payload.shopTable;
    var rows = (table && table.rows) || payload.rows || [];
    return rows
      .filter(function (row) {
        var name = row.name || row.shop || "";
        return name && name !== "当页汇总" && row.kind !== "sum";
      })
      .map(function (row) {
        var cells = row.cells || [];
        return {
          shop: row.name || row.shop,
          liveAmount: cells[0] || row.liveAmount || row.amount || "—",
          orders: cells[2] || row.orders || "—",
          payAmount: cells[4] || row.payAmount || "—",
          refundRate: cells[7] || row.refundRate || "—",
          paidAmount: row.paidAmount || row.livePaid || "—",
          profit: row.liveProfit || row.profit || "—",
          roi: row.liveRoi || row.roi || "—",
          paidDeal: row.paidDeal || row.livePay || "—",
          feeRate: row.feeRate || row.liveFee || "—"
        };
      });
  }

  function assignTeam(pack, name) {
    var text = String(pack || "") + String(name || "");
    if (text.indexOf("韩梦凯") !== -1) {
      return "han";
    }
    if (text.indexOf("沈子晗") !== -1) {
      return "shen";
    }
    return "";
  }

  function overlayShopMetrics(shops, liveRows) {
    var map = {};
    (liveRows || []).forEach(function (row) {
      map[row.shop] = row;
    });
    return (shops || []).map(function (row) {
      var live = map[row.shop];
      if (!live) {
        return row;
      }
      return {
        shop: row.shop,
        owner: row.owner || live.owner || "—",
        liveAmount: live.liveAmount || row.liveAmount,
        orders: live.orders || row.orders,
        payAmount: live.payAmount || row.payAmount,
        refundRate: live.refundRate || row.refundRate
      };
    });
  }

  function mergePeopleShops(teams, peoplePayload) {
    var shops = (peoplePayload && peoplePayload.shops) || [];
    shops.forEach(function (shop) {
      if (!shop || shop.kind === "店群") {
        return;
      }
      var key = assignTeam(shop.pack, shop.name);
      if (!key) {
        return;
      }
      var team = teams.filter(function (item) {
        return item.key === key;
      })[0];
      if (!team) {
        return;
      }
      var exists = (team.shops || []).some(function (row) {
        return row.shop === shop.name;
      });
      if (!exists) {
        team.shops.push({
          shop: shop.name,
          owner: team.name,
          liveAmount: "—",
          orders: "—",
          payAmount: "—",
          refundRate: "—"
        });
      }
    });
    return teams;
  }

  function mergeLive(target, payload) {
    if (!payload || payload.ok === false) {
      return target;
    }
    return {
      title: payload.title || target.title,
      dateLabel: payload.dateLabel || target.dateLabel,
      range: payload.range || target.range,
      source: "数据中心",
      href: "/data/paid",
      summary: payload.summary || target.summary,
      hero: readChart(payload.hero, target.hero),
      paid: readChart(payload.paid || payload.paidHero, target.paid),
      cards: pickLiveCards(payload.cards && payload.cards.length ? payload.cards : target.cards)
    };
  }

  function cssText() {
    return (
      "html:has(#xm-hm),html:has(#xm-hm) body{height:100%!important;max-height:100%!important;overflow:hidden!important}" +
      ".xm-shell{height:100vh!important;max-height:100vh!important;min-height:0!important;overflow:hidden!important}" +
      ".xm-main{min-height:0!important;overflow:hidden!important;flex:1 1 auto!important}" +
      ".xm-content,#xm-content{min-height:0!important;flex:1 1 auto!important;overflow:auto!important;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}" +
      ".xm-hm{position:relative;display:block;box-sizing:border-box;min-height:min-content;height:auto;max-height:none;padding:10px 12px 24px;color:var(--xm-ink);overflow:visible}" +
      ".xm-hm-mark{pointer-events:none;position:absolute;inset:0;overflow:hidden;opacity:.045;font-size:42px;font-weight:700;letter-spacing:.4em;display:flex;flex-wrap:wrap;align-content:flex-start;gap:48px 64px;padding:40px 20px;color:var(--xm-ink)}" +
      ".xm-hm-mark span{transform:rotate(-18deg)}" +
      ".xm-hm-bar{position:relative;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;margin-bottom:10px;background:var(--xm-card);border:1px solid var(--xm-line);border-radius:8px;box-shadow:var(--xm-shadow)}" +
      ".xm-hm-views{display:flex;align-items:center;gap:6px}" +
      ".xm-hm-views button,.xm-hm-set{border:0;background:transparent;color:var(--xm-muted);padding:6px 10px;border-radius:6px;cursor:pointer;font-size:13px}" +
      ".xm-hm-views button.is-on{color:var(--xm-primary);background:var(--xm-primary-soft);font-weight:600}" +
      ".xm-hm-set{color:var(--xm-primary)}" +
      ".xm-hm-ranges{display:flex;flex-wrap:wrap;align-items:center;gap:6px}" +
      ".xm-hm-ranges button{border:1px solid var(--xm-line);background:var(--xm-card);color:var(--xm-ink);padding:5px 10px;border-radius:4px;cursor:pointer;font-size:12px}" +
      ".xm-hm-ranges button.is-on{background:var(--xm-primary);border-color:var(--xm-primary);color:#fff}" +
      ".xm-hm-dates{display:flex;align-items:center;gap:6px;color:var(--xm-muted);font-size:12px}" +
      ".xm-hm-dates input{border:1px solid var(--xm-line);background:var(--xm-card);color:var(--xm-ink);border-radius:4px;padding:4px 6px;font-size:12px}" +
      ".xm-hm-body{position:relative;display:flex;flex-direction:column;gap:12px;overflow:visible}" +
      ".xm-hm.is-live .xm-hm-kpis,.xm-hm.is-board .xm-hm-kpis,.xm-hm.is-team .xm-hm-kpis,.xm-hm.is-live .xm-hm-set,.xm-hm.is-board .xm-hm-set,.xm-hm.is-live .xm-hm-ranges{display:none}" +
      ".xm-hm-live[hidden],.xm-hm-board[hidden],.xm-hm-teams[hidden]{display:none}" +
      ".xm-hm-kpis,.xm-hm-team-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;align-content:start;width:100%}" +
      ".xm-hm-team{display:flex;flex-direction:column;gap:10px;padding-bottom:8px}" +
      ".xm-hm-team-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}" +
      ".xm-hm-team-head h2{margin:0;font-size:16px}" +
      ".xm-hm-team-head p{margin:4px 0 0;color:var(--xm-muted);font-size:12px}" +
      ".xm-hm-team-head a{color:var(--xm-primary);text-decoration:none;font-size:13px;white-space:nowrap}" +
      ".xm-hm-ladder{margin-top:4px}" +
      ".xm-hm-ladder h2{margin:16px 0 10px;font-size:16px}" +
      ".xm-hm-podiums{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}" +
      ".xm-hm-podium{background:var(--xm-card);border:1px solid var(--xm-line);border-radius:8px;box-shadow:var(--xm-shadow);padding:12px 12px 8px}" +
      ".xm-hm-podium h3{margin:0 0 10px;text-align:center;font-size:13px;color:var(--xm-muted);font-weight:600}" +
      ".xm-hm-stand{display:grid;grid-template-columns:1fr 1.15fr 1fr;align-items:end;gap:6px;min-height:168px}" +
      ".xm-hm-stand-item{display:flex;flex-direction:column;align-items:center;text-align:center;background:#f6f1e8;border-radius:8px 8px 0 0;padding:10px 6px 8px}" +
      ".xm-hm-stand-item.is-1{background:#fff4d6;padding-top:16px;min-height:150px}" +
      ".xm-hm-stand-item.is-2,.xm-hm-stand-item.is-3{min-height:124px}" +
      ".xm-hm-avatar{width:36px;height:36px;border-radius:50%;background:var(--xm-primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700}" +
      ".xm-hm-stand-item.is-1 .xm-hm-avatar{background:#f5a623}" +
      ".xm-hm-stand-rank{margin-top:6px;font-size:10px;color:var(--xm-muted);letter-spacing:.04em}" +
      ".xm-hm-stand-item strong{margin-top:2px;font-size:13px;color:var(--xm-ink)}" +
      ".xm-hm-stand-item em{margin-top:4px;font-style:normal;font-size:13px;font-weight:700;color:var(--xm-ink)}" +
      ".xm-hm-stand-item small{color:var(--xm-muted);font-size:11px}" +
      ".xm-hm-rest{list-style:none;margin:8px 0 0;padding:0}" +
      ".xm-hm-rest li{display:flex;align-items:center;gap:8px;padding:7px 2px;border-top:1px solid var(--xm-line);font-size:12px}" +
      ".xm-hm-rest span{color:var(--xm-muted);width:22px}" +
      ".xm-hm-rest b{flex:1;font-weight:500}" +
      ".xm-hm-rest em{font-style:normal;font-variant-numeric:tabular-nums}" +
      "html[data-theme=dark] .xm-hm-stand-item{background:#2a2418}" +
      "html[data-theme=dark] .xm-hm-stand-item.is-1{background:#3a3018}" +
      ".xm-hm-live-clock{margin:0 0 8px;color:var(--xm-muted);font-size:12px}" +
      ".xm-hm-live-charts{display:grid;grid-template-columns:1fr 1fr;gap:10px}" +
      ".xm-hm-chart{background:var(--xm-card);border:1px solid var(--xm-line);border-radius:8px;box-shadow:var(--xm-shadow);padding:14px 16px 10px;min-width:0}" +
      ".xm-hm-legs{display:inline-flex;align-items:center;gap:10px;color:var(--xm-muted);font-size:12px}" +
      ".xm-hm-legs i{width:10px;height:10px;border-radius:50%;display:inline-block}" +
      ".xm-hm-legs i.is-yest{background:#2f54eb}" +
      ".xm-hm-legs i.is-today{background:#cf1322}" +
      ".xm-hm-line{display:block;width:100%;height:160px;margin-top:8px}" +
      ".xm-hm-live-cards{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}" +
      ".xm-hm-live .xm-hm-table{min-width:960px}" +
      ".xm-hm-live .xm-hm-panel{overflow-x:auto}" +
      ".xm-hm-live .xm-hm-table th:nth-child(n+3),.xm-hm-live .xm-hm-table td:nth-child(n+3){text-align:right}" +
      ".xm-hm-card{background:var(--xm-card);border:1px solid var(--xm-line);border-radius:8px;padding:12px 14px 10px;box-shadow:var(--xm-shadow);min-height:104px}" +
      ".xm-hm-card-head{display:flex;align-items:center;justify-content:space-between;color:var(--xm-muted);font-size:12px}" +
      ".xm-hm-card-head i{width:14px;height:14px;border:1px solid var(--xm-line);border-radius:50%;font-style:normal;font-size:10px;display:inline-flex;align-items:center;justify-content:center;color:var(--xm-muted)}" +
      ".xm-hm-value{margin-top:8px;font-size:22px;font-weight:700;letter-spacing:-.02em;color:var(--xm-ink)}" +
      ".xm-hm-value.is-accent{color:var(--xm-primary)}" +
      ".xm-hm-trend{margin-top:6px;font-size:12px;color:var(--xm-muted)}" +
      ".xm-hm-trend.is-up{color:#cf1322}" +
      ".xm-hm-trend.is-down{color:#389e0d}" +
      "html[data-theme=dark] .xm-hm-trend.is-up{color:#ff7875}" +
      "html[data-theme=dark] .xm-hm-trend.is-down{color:#73d13d}" +
      ".xm-hm-panel{width:100%;background:var(--xm-card);border:1px solid var(--xm-line);border-radius:8px;box-shadow:var(--xm-shadow);padding:12px 12px 8px;min-height:0}" +
      ".xm-hm-panel h2{margin:0;font-size:14px;display:flex;align-items:center;justify-content:space-between;gap:8px}" +
      ".xm-hm-index-num{margin:8px 0 6px;font-size:28px;font-weight:700;color:var(--xm-primary)}" +
      ".xm-hm-modes{display:flex;gap:12px;margin:0 0 8px;font-size:12px;color:var(--xm-muted)}" +
      ".xm-hm-modes label{cursor:pointer}" +
      ".xm-hm-table{width:100%;border-collapse:collapse;font-size:12px}" +
      ".xm-hm-table th{text-align:left;color:var(--xm-muted);font-weight:500;padding:6px 4px;border-bottom:1px solid var(--xm-line)}" +
      ".xm-hm-table td{padding:7px 4px;border-bottom:1px solid var(--xm-line);color:var(--xm-ink)}" +
      ".xm-hm-table td:last-child,.xm-hm-table th:last-child{text-align:right}" +
      ".xm-hm-cup{display:inline-flex;width:18px;height:18px;border-radius:50%;align-items:center;justify-content:center;color:#fff;font-size:11px}" +
      ".xm-hm-cup.gold{background:#f5a623}" +
      ".xm-hm-cup.silver{background:#8c8c8c}" +
      ".xm-hm-cup.bronze{background:#d46b08}" +
      ".xm-hm-pop{position:absolute;top:48px;left:10px;z-index:3;width:280px;background:var(--xm-card);border:1px solid var(--xm-line);border-radius:8px;box-shadow:var(--xm-shadow);padding:10px}" +
      ".xm-hm-pop[hidden]{display:none}" +
      ".xm-hm-pop h3{margin:0 0 8px;font-size:13px}" +
      ".xm-hm-pop label{display:flex;gap:8px;align-items:center;padding:4px 0;font-size:12px;color:var(--xm-ink)}" +
      ".xm-hm-note{margin:8px 0 0;color:var(--xm-muted);font-size:12px}" +
      "@media (max-width:1200px){.xm-hm-kpis,.xm-hm-team-kpis,.xm-hm-live-cards,.xm-hm-podiums,.xm-hm-live-charts{grid-template-columns:repeat(2,minmax(0,1fr))}}" +
      "@media (max-width:700px){.xm-hm-kpis,.xm-hm-team-kpis,.xm-hm-live-cards,.xm-hm-podiums,.xm-hm-live-charts{grid-template-columns:1fr}.xm-hm-team-head{flex-direction:column}}"
    );
  }

  function frameHtml() {
    var viewBtns = VIEWS.map(function (item) {
      return '<button type="button" data-view="' + item.key + '">' + item.label + "</button>";
    }).join("");
    var rangeBtns = RANGES.map(function (item) {
      return '<button type="button" data-range="' + item.key + '">' + item.label + "</button>";
    }).join("");
    return (
      '<style id="xm-home-css">' +
      cssText() +
      "</style>" +
      '<div class="xm-hm" id="xm-hm">' +
      '<div class="xm-hm-mark" id="xm-hm-mark" aria-hidden="true"></div>' +
      '<div class="xm-hm-bar">' +
      '<div class="xm-hm-views">' +
      viewBtns +
      '<button type="button" class="xm-hm-set" id="xm-hm-set">卡片设置</button>' +
      "</div>" +
      '<div class="xm-hm-ranges">' +
      rangeBtns +
      '<label class="xm-hm-dates"><input type="date" id="xm-hm-from" /><span>至</span><input type="date" id="xm-hm-to" /></label>' +
      "</div></div>" +
      '<div class="xm-hm-pop" id="xm-hm-pop" hidden><h3>卡片设置</h3><div id="xm-hm-card-opts"></div></div>' +
      '<div class="xm-hm-body">' +
      '<section class="xm-hm-kpis" id="xm-hm-kpis"></section>' +
      '<section class="xm-hm-teams" id="xm-hm-teams" hidden></section>' +
      '<section class="xm-hm-live" id="xm-hm-live" hidden></section>' +
      '<section class="xm-hm-board" id="xm-hm-board" hidden>' +
      '<div id="xm-hm-ladders"></div></section>' +
      '</div><p class="xm-hm-note" id="xm-hm-note">数字来自数据中心 ERP，已取消演示数。</p></div>'
    );
  }

  function paint(root, state) {
    var board = root.querySelector("#xm-hm");
    var hide = hiddenCards();
    var cards = (state.cards || blankCompanyCards()).filter(function (card) {
      return hide.indexOf(card.key) === -1;
    });
    var live = state.live || blankLive();
    var shops = state.shops && state.shops.length ? state.shops : [];
    var teams = state.teams && state.teams.length ? state.teams : blankTeams();
    var hero = readChart(live.hero, blankLive().hero);
    var paid = readChart(live.paid, blankLive().paid);
    var liveCards = pickLiveCards(live.cards);
    board.classList.toggle("is-board", state.view === "board");
    board.classList.toggle("is-live", state.view === "live");
    board.classList.toggle("is-team", state.view === "team");
    Array.prototype.forEach.call(root.querySelectorAll("[data-view]"), function (btn) {
      btn.classList.toggle("is-on", btn.getAttribute("data-view") === state.view);
    });
    Array.prototype.forEach.call(root.querySelectorAll("[data-range]"), function (btn) {
      btn.classList.toggle("is-on", btn.getAttribute("data-range") === state.range);
    });
    root.querySelector("#xm-hm-from").value = state.from;
    root.querySelector("#xm-hm-to").value = state.to;
    root.querySelector("#xm-hm-kpis").innerHTML = cards.map(cardHtml).join("");
    root.querySelector("#xm-hm-teams").hidden = state.view !== "team";
    root.querySelector("#xm-hm-teams").innerHTML = teams.map(function (team) {
      return teamBlockHtml(team, hide);
    }).join("");
    root.querySelector("#xm-hm-live").hidden = state.view !== "live";
    root.querySelector("#xm-hm-board").hidden = state.view !== "board";
    root.querySelector("#xm-hm-live").innerHTML =
      '<div class="xm-hm-live-clock">每5分钟自动刷新' +
      (state.liveAt ? " · 上次 " + escapeHtml(state.liveAt) : "") +
      '</div><div class="xm-hm-live-charts">' +
      liveChartHtml(hero) +
      liveChartHtml(paid) +
      '</div><div class="xm-hm-live-cards">' +
      liveCards.map(liveCardHtml).join("") +
      '</div><div class="xm-hm-panel"><h2>店铺 <span>' +
      escapeHtml(String((live.summary && live.summary.shops) || shops.length)) +
      " 店</span></h2>" +
      '<table class="xm-hm-table"><thead><tr><th>排名</th><th>店铺名称</th><th>实时销售额</th><th>实时付费金额</th><th>实时利润</th><th>实时付费ROI</th><th>实时付费成交额</th><th>实时费比</th></tr></thead>' +
      "<tbody>" +
      shops.map(function (row, i) {
        return liveShopRowHtml(row, i);
      }).join("") +
      "</tbody></table></div>";
    root.querySelector("#xm-hm-ladders").innerHTML = (state.ladders || blankLadders()).map(ladderHtml).join("");
    var gapText = (state.gaps || []).filter(function (item) {
      return item.indexOf("人管有店") !== -1 || item.indexOf("韩梦凯 ·") !== -1;
    }).join("；");
    root.querySelector("#xm-hm-note").textContent =
      state.view === "live"
        ? "实时数字来自数据中心 ERP，每5分钟拉一次。昨今曲线各用当日总额，没有分时点。"
        : state.view === "team"
          ? (gapText
            ? "人管对不上：" + gapText
            : "团队店按人管责权，数字只按店铺id对齐 ERP。")
          : state.view === "board"
            ? "排行榜按人管职务和责权店，只按店铺id对齐 ERP 后汇总支付金额 / 利润。"
            : "数字来自数据中心 ERP，已取消演示数。平台费用、销售费用、总货款、无效订单、京东仓无接口，显示 —。";
    var user = state.user && (state.user.displayName || state.user.username);
    var mark = user || "星脉";
    root.querySelector("#xm-hm-mark").innerHTML = new Array(18)
      .fill(0)
      .map(function () {
        return "<span>" + escapeHtml(mark) + "</span>";
      })
      .join("");
    root.querySelector("#xm-hm-card-opts").innerHTML = (state.cards || blankCompanyCards())
      .map(function (card) {
        return (
          '<label><input type="checkbox" data-hide="' +
          escapeHtml(card.key) +
          '"' +
          (hide.indexOf(card.key) === -1 ? " checked" : "") +
          " /> " +
          escapeHtml(card.label) +
          "</label>"
        );
      })
      .join("");
  }

  function api(path) {
    return fetch(path, { credentials: "same-origin", headers: { Accept: "application/json" } }).then(function (res) {
      if (res.status === 401) {
        window.location.href = "/login";
        return null;
      }
      return res.ok ? res.json() : null;
    });
  }

  var COMPANY_CARD_DEFS = [
    { key: "payAmount", label: "支付金额（支付）", accent: true, field: "payAmount", kind: "money" },
    { key: "adCost", label: "推广费（预估）", field: "totalPromotionCost", kind: "money" },
    { key: "refundAmount", label: "退款金额", field: "refundAmount", kind: "money" },
    { key: "adRatio", label: "推广费占比", field: "promotionRate", kind: "rate" },
    { key: "refundRate", label: "退款率（按金额）", field: "refundRate", kind: "rate" },
    { key: "profit", label: "利润（预估）", field: "profit", kind: "money" },
    { key: "payQty", label: "销售件数（支付）", field: "orderCount", kind: "int" },
    { key: "grossMargin", label: "大毛利率", field: "profitRate", kind: "rate" },
    { key: "platformFee", label: "平台费用（预估）", field: "", kind: "none" },
    { key: "saleFee", label: "销售费用（预估）", field: "", kind: "none" },
    { key: "goodsCost", label: "总货款", field: "", kind: "none" },
    { key: "invalid", label: "无效订单金额（件数）", field: "", kind: "none" },
    { key: "netSales", label: "净销售金额", field: "netSales", kind: "money" },
    { key: "jdOrders", label: "京东仓订单量", field: "", kind: "none" },
    { key: "jdRatio", label: "京东仓订单占比", field: "", kind: "none" },
    { key: "netQty", label: "净销售件数", field: "netOrderCount", kind: "int" }
  ];

  function asNum(value) {
    if (value == null || value === "" || value === "—") {
      return null;
    }
    var n = Number(String(value).replace(/,/g, ""));
    return isFinite(n) ? n : null;
  }

  function fmtMoney(value) {
    var n = asNum(value);
    return n == null ? "—" : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtInt(value) {
    var n = asNum(value);
    return n == null ? "—" : Math.round(n).toLocaleString("en-US");
  }

  function fmtRate(value) {
    var n = asNum(value);
    if (n == null) {
      return "—";
    }
    if (Math.abs(n) <= 1) {
      n = n * 100;
    }
    return n.toFixed(2) + "%";
  }

  function fmtRoi(pay, ad) {
    var p = asNum(pay);
    var a = asNum(ad);
    if (p == null || a == null || a === 0) {
      return "—";
    }
    return (p / a).toFixed(2);
  }

  function trendOf(cur, prev) {
    var c = asNum(cur);
    var p = asNum(prev);
    if (c == null || p == null || p === 0) {
      return 0;
    }
    return ((c - p) / Math.abs(p)) * 100;
  }

  function sumField(rows, key) {
    var total = 0;
    var ok = false;
    (rows || []).forEach(function (row) {
      var n = asNum(row[key]);
      if (n != null) {
        total += n;
        ok = true;
      }
    });
    return ok ? total : null;
  }

  function withRates(sum) {
    var next = {
      payAmount: sum.payAmount,
      totalPromotionCost: sum.totalPromotionCost,
      refundAmount: sum.refundAmount,
      profit: sum.profit,
      orderCount: sum.orderCount,
      netOrderCount: sum.netOrderCount,
      todayPayAmount: sum.todayPayAmount,
      yesterdayPayAmount: sum.yesterdayPayAmount,
      profitRate: sum.profitRate,
      promotionRate: sum.promotionRate,
      refundRate: sum.refundRate,
      netSales: null
    };
    if (next.payAmount != null) {
      if (next.profit != null && next.profitRate == null) {
        next.profitRate = next.profit / next.payAmount;
      }
      if (next.totalPromotionCost != null && next.promotionRate == null) {
        next.promotionRate = next.totalPromotionCost / next.payAmount;
      }
      if (next.refundAmount != null) {
        next.netSales = next.payAmount - next.refundAmount;
        if (next.refundRate == null) {
          next.refundRate = next.refundAmount / next.payAmount;
        }
      }
    }
    return next;
  }

  function summaryFrom(pack) {
    if (pack && pack.summary && pack.summary.payAmount != null) {
      return withRates(pack.summary);
    }
    return withRates({
      payAmount: sumField(pack && pack.records, "payAmount"),
      totalPromotionCost: sumField(pack && pack.records, "totalPromotionCost"),
      refundAmount: sumField(pack && pack.records, "refundAmount"),
      profit: sumField(pack && pack.records, "profit"),
      orderCount: sumField(pack && pack.records, "orderCount"),
      netOrderCount: sumField(pack && pack.records, "netOrderCount"),
      todayPayAmount: sumField(pack && pack.records, "todayPayAmount"),
      yesterdayPayAmount: sumField(pack && pack.records, "yesterdayPayAmount")
    });
  }

  function blankCompanyCards() {
    return COMPANY_CARD_DEFS.map(function (def) {
      return { key: def.key, label: def.label, value: "—", accent: !!def.accent, trend: 0 };
    });
  }

  function companyCardsFrom(sum, prev) {
    sum = sum || {};
    prev = prev || {};
    return COMPANY_CARD_DEFS.map(function (def) {
      var cur = def.kind === "none" ? null : sum[def.field];
      var old = def.kind === "none" ? null : prev[def.field];
      var value = "—";
      if (def.kind === "money") {
        value = fmtMoney(cur);
      } else if (def.kind === "int") {
        value = fmtInt(cur);
      } else if (def.kind === "rate") {
        value = fmtRate(cur);
      }
      return { key: def.key, label: def.label, value: value, accent: !!def.accent, trend: trendOf(cur, old) };
    });
  }

  function blankLive() {
    return {
      title: "实时看板",
      summary: { channels: 1, shops: 0 },
      hero: { label: "实时销售指数", value: "—", delta: 0, yesterday: [], today: [] },
      paid: { label: "实时付费金额", value: "—", delta: 0, yesterday: [], today: [] },
      cards: [
        { key: "ad", label: "推广花费 (支付预估)", value: "—" },
        { key: "profit", label: "利润 (支付预估)", value: "—" },
        { key: "roi", label: "付费成交ROI", value: "—" },
        { key: "livePay", label: "实时付费成交额", value: "—" },
        { key: "liveFee", label: "实时费比", value: "—" }
      ],
      shops: []
    };
  }

  function blankTeams() {
    return [
      { key: "shen", name: "沈子晗", href: "/shen", cards: blankCompanyCards(), shops: [] },
      { key: "han", name: "韩梦凯", href: "/han", cards: blankCompanyCards(), shops: [] }
    ];
  }

  function blankLadders() {
    var cols = [
      { title: "运营排行榜", rows: [] },
      { title: "主管排行榜", rows: [] },
      { title: "经理排行榜", rows: [] }
    ];
    return [
      { key: "perf", title: "业绩排行榜", unit: "支付金额", columns: cols },
      { key: "profit", title: "利润排行榜", unit: "利润", columns: cols.map(function (col) {
        return { title: col.title, rows: [] };
      }) }
    ];
  }

  function erpQuery(from, to) {
    return (
      "payTimeStart=" +
      encodeURIComponent(from + " 00:00:00") +
      "&payTimeEnd=" +
      encodeURIComponent(to + " 23:59:59")
    );
  }

  function shiftYmd(ymd, days) {
    var parts = String(ymd || "").split("-").map(Number);
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + days)));
  }

  function previousDates(from, to) {
    var start = new Date(from + "T00:00:00+08:00").getTime();
    var end = new Date(to + "T00:00:00+08:00").getTime();
    var days = Math.round((end - start) / 86400000) + 1;
    var prevTo = shiftYmd(from, -1);
    return { from: shiftYmd(prevTo, -(days - 1)), to: prevTo };
  }

  function uniqShops(records) {
    var seen = {};
    return (records || []).filter(function (row) {
      var id = row.shopId || row.shopName;
      if (!id || seen[id]) {
        return false;
      }
      seen[id] = true;
      return true;
    });
  }

  function fetchShopPages(qs) {
    var acc = [];
    var summary = null;
    function page(n) {
      var path = "/api/data/shops?pageSize=50&currentPage=" + n + (qs ? "&" + qs : "");
      return api(path).then(function (data) {
        if (!data || !data.ok || !data.records) {
          return { records: uniqShops(acc), summary: summary };
        }
        if (data.summary) {
          summary = data.summary;
        }
        acc = acc.concat(data.records);
        var unique = uniqShops(acc);
        if (unique.length >= (data.total || unique.length) || !data.records.length || n >= 8) {
          return { records: unique, summary: summary };
        }
        if (n > 1 && unique.length === uniqShops(acc.slice(0, acc.length - data.records.length)).length) {
          return { records: unique, summary: summary };
        }
        return page(n + 1);
      });
    }
    return page(1);
  }

  function normShopId(value) {
    var id = String(value == null ? "" : value).trim();
    return id;
  }

  function mapByShopId(records) {
    var map = {};
    (records || []).forEach(function (row) {
      var id = normShopId(row && row.shopId);
      if (id) {
        map[id] = row;
      }
    });
    return map;
  }

  function shopDisplayName(shop) {
    return (shop && (shop.storeName || shop.name || shop.shopName)) || "—";
  }

  function shopErpId(shop) {
    if (!shop) {
      return "";
    }
    var keys = ["storeId", "erpShopId", "erpId", "platformShopId", "jdShopId", "shopCode"];
    var i;
    for (i = 0; i < keys.length; i++) {
      var id = normShopId(shop[keys[i]]);
      if (id) {
        return id;
      }
    }
    var shopId = normShopId(shop.shopId);
    if (shopId && shopId !== String(shop.id == null ? "" : shop.id)) {
      return shopId;
    }
    return "";
  }

  function dutyShopsFrom(orgPack, peopleShops) {
    if (orgPack && Object.prototype.toString.call(orgPack.stores) === "[object Array]") {
      return orgPack.stores.filter(function (row) {
        return row && row.statusKey !== "closed" && row.kind !== "店群";
      });
    }
    return ((peopleShops && peopleShops.shops) || []).filter(function (shop) {
      return shop && shop.kind !== "店群";
    });
  }

  function personOwnsShop(person, shop) {
    if (!person || !shop) {
      return false;
    }
    var name = String(person.name || "").trim();
    if (!name) {
      return false;
    }
    if (String(shop.owner || "").trim() === name || String(shop.lead || "").trim() === name) {
      return true;
    }
    if (person.role === "经理") {
      var line = String(shop.team || "") + String(shop.chief || "") + String(shop.pack || "");
      if (line.indexOf(name) !== -1) {
        return true;
      }
    }
    return (person.visibleShops || []).indexOf(shopDisplayName(shop)) !== -1;
  }

  function liveFromErp(todayPack, yestPack, snapPack) {
    var live = blankLive();
    var todaySum = summaryFrom(todayPack);
    var yestSum = summaryFrom(yestPack);
    var snap = summaryFrom(snapPack);
    var todayPay = snap.todayPayAmount != null ? snap.todayPayAmount : todaySum.payAmount;
    var yestPay = snap.yesterdayPayAmount != null ? snap.yesterdayPayAmount : yestSum.payAmount;
    var todayAd = todaySum.totalPromotionCost;
    var yestAd = yestSum.totalPromotionCost;
    live.hero = {
      label: "实时销售指数",
      value: fmtMoney(todayPay),
      delta: trendOf(todayPay, yestPay),
      yesterday: yestPay == null ? [] : [yestPay, yestPay],
      today: todayPay == null ? [] : [todayPay, todayPay]
    };
    live.paid = {
      label: "实时付费金额",
      value: fmtMoney(todayAd),
      delta: trendOf(todayAd, yestAd),
      yesterday: yestAd == null ? [] : [yestAd, yestAd],
      today: todayAd == null ? [] : [todayAd, todayAd]
    };
    live.cards = [
      { key: "ad", label: "推广花费 (支付预估)", value: fmtMoney(todayAd), extra: todaySum.promotionRate != null ? "推广占比 " + fmtRate(todaySum.promotionRate) : "" },
      { key: "profit", label: "利润 (支付预估)", value: fmtMoney(todaySum.profit), extra: todaySum.profitRate != null ? "利润率 " + fmtRate(todaySum.profitRate) : "" },
      { key: "roi", label: "付费成交ROI", value: fmtRoi(todaySum.payAmount != null ? todaySum.payAmount : todayPay, todayAd) },
      { key: "livePay", label: "实时付费成交额", value: fmtMoney(todayPay) },
      { key: "liveFee", label: "实时费比", value: fmtRate(todaySum.promotionRate != null ? todaySum.promotionRate : snap.promotionRate) }
    ];
    var rows = (todayPack && todayPack.records && todayPack.records.length ? todayPack.records : snapPack && snapPack.records) || [];
    live.shops = rows
      .slice()
      .sort(function (a, b) {
        return (asNum(b.todayPayAmount) || asNum(b.payAmount) || 0) - (asNum(a.todayPayAmount) || asNum(a.payAmount) || 0);
      })
      .map(function (row) {
        var pay = row.todayPayAmount != null ? row.todayPayAmount : row.payAmount;
        return {
          shop: row.shopName,
          liveAmount: fmtMoney(pay),
          paidAmount: fmtMoney(row.totalPromotionCost),
          profit: fmtMoney(row.profit),
          roi: fmtRoi(row.payAmount != null ? row.payAmount : pay, row.totalPromotionCost),
          paidDeal: fmtMoney(pay),
          feeRate: fmtRate(row.promotionRate)
        };
      });
    live.summary = { channels: 1, shops: live.shops.length };
    return live;
  }

  function ownerOfShop(shopMeta, grants) {
    if (!shopMeta) {
      return "—";
    }
    var hit = (grants || []).filter(function (grant) {
      return grant.active && grant.shopId === shopMeta.id;
    });
    var op = hit.filter(function (grant) {
      return grant.role === "运营";
    })[0];
    return (op || hit[0] || {}).personName || "—";
  }

  function teamPredicate(name) {
    return function (shop) {
      var text = String(shop.team || "") + String(shop.chief || "") + String(shop.pack || "") + String(shop.name || "") + String(shop.storeName || "");
      return text.indexOf(name) !== -1;
    };
  }

  function buildTeams(dutyShops, grants, rangePack, prevPack, catalogPack) {
    var erp = mapByShopId(rangePack && rangePack.records);
    var prevErp = mapByShopId(prevPack && prevPack.records);
    var catalog = mapByShopId((catalogPack && catalogPack.records) || (rangePack && rangePack.records));
    var shops = dutyShops || [];
    var mismatches = [];
    function oneTeam(key, name, href) {
      var pred = teamPredicate(name);
      var rows = [];
      var matched = [];
      var prevMatched = [];
      shops.forEach(function (shop) {
        if (!pred(shop)) {
          return;
        }
        var label = shopDisplayName(shop);
        var id = shopErpId(shop);
        var owner = (shop.owner && String(shop.owner).trim()) || ownerOfShop(shop, grants);
        if (!id) {
          mismatches.push(name + " · " + label + "（人管有店，未填店铺id）");
          rows.push({
            shop: label,
            owner: owner,
            liveAmount: "—",
            orders: "—",
            payAmount: "—",
            refundRate: "—"
          });
          return;
        }
        var erpRow = erp[id];
        if (!erpRow) {
          if (!catalog[id]) {
            mismatches.push(name + " · " + label + "（人管有店，ERP 无此店铺id）");
          }
          rows.push({
            shop: label,
            owner: owner,
            liveAmount: "—",
            orders: "—",
            payAmount: catalog[id] ? fmtMoney(0) : "—",
            refundRate: "—"
          });
          return;
        }
        matched.push(erpRow);
        if (prevErp[id]) {
          prevMatched.push(prevErp[id]);
        }
        rows.push({
          shop: label,
          owner: owner,
          liveAmount: fmtMoney(erpRow.todayPayAmount),
          orders: fmtInt(erpRow.orderCount),
          payAmount: fmtMoney(erpRow.payAmount),
          refundRate: fmtRate(erpRow.refundRate)
        });
      });
      rows.sort(function (a, b) {
        return (asNum(b.payAmount) || 0) - (asNum(a.payAmount) || 0);
      });
      if (!rows.length && name === "韩梦凯") {
        mismatches.push("韩梦凯 · 整包（人管没有韩梦凯的店铺或店群）");
      }
      return {
        key: key,
        name: name,
        href: href,
        cards: companyCardsFrom(withRates({
          payAmount: sumField(matched, "payAmount"),
          totalPromotionCost: sumField(matched, "totalPromotionCost"),
          refundAmount: sumField(matched, "refundAmount"),
          profit: sumField(matched, "profit"),
          orderCount: sumField(matched, "orderCount"),
          netOrderCount: sumField(matched, "netOrderCount")
        }), withRates({
          payAmount: sumField(prevMatched, "payAmount"),
          totalPromotionCost: sumField(prevMatched, "totalPromotionCost"),
          refundAmount: sumField(prevMatched, "refundAmount"),
          profit: sumField(prevMatched, "profit"),
          orderCount: sumField(prevMatched, "orderCount"),
          netOrderCount: sumField(prevMatched, "netOrderCount")
        })),
        shops: rows
      };
    }
    return {
      teams: [oneTeam("shen", "沈子晗", "/shen"), oneTeam("han", "韩梦凯", "/han")],
      mismatches: mismatches
    };
  }

  function buildLadders(people, dutyShops, rangePack) {
    var erp = mapByShopId(rangePack && rangePack.records);
    function amount(person, field) {
      var total = 0;
      var ok = false;
      (dutyShops || []).forEach(function (shop) {
        if (!personOwnsShop(person, shop)) {
          return;
        }
        var id = shopErpId(shop);
        var row = id ? erp[id] : null;
        var n = row ? asNum(row[field]) : null;
        if (n != null) {
          total += n;
          ok = true;
        }
      });
      return ok ? total : 0;
    }
    function column(title, role, field) {
      var rows = (people || [])
        .filter(function (person) {
          return person.status === "在职" && person.role === role && person.name !== "管理员";
        })
        .map(function (person) {
          var n = amount(person, field);
          return { name: person.name, amount: fmtMoney(n), _n: n };
        })
        .sort(function (a, b) {
          return b._n - a._n;
        })
        .map(function (row) {
          return { name: row.name, amount: row.amount };
        });
      return { title: title, rows: rows };
    }
    return [
      {
        key: "perf",
        title: "业绩排行榜",
        unit: "支付金额",
        columns: [column("运营排行榜", "运营", "payAmount"), column("主管排行榜", "主管", "payAmount"), column("经理排行榜", "经理", "payAmount")]
      },
      {
        key: "profit",
        title: "利润排行榜",
        unit: "利润",
        columns: [column("运营排行榜", "运营", "profit"), column("主管排行榜", "主管", "profit"), column("经理排行榜", "经理", "profit")]
      }
    ];
  }

  window.XmModules = window.XmModules || {};
  window.XmModules["/home"] = {
    mount: function (root) {
      root.innerHTML = frameHtml();
      var dead = false;
      var dates = rangeDates("yesterday");
      var state = {
        view: "company",
        range: "yesterday",
        mode: "shop",
        from: dates.from,
        to: dates.to,
        user: readUser(),
        cards: blankCompanyCards(),
        tiger: { title: "龙虎榜", rows: [] },
        live: blankLive(),
        shops: [],
        teams: blankTeams(),
        ladders: blankLadders(),
        liveAt: "",
        gaps: [],
        source: ""
      };
      var poll = 0;
      var LIVE_REFRESH_MS = 5 * 60 * 1000;
      paint(root, state);

      function shanghaiClock() {
        return new Intl.DateTimeFormat("zh-CN", {
          timeZone: "Asia/Shanghai",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false
        }).format(new Date());
      }

      function pullLive() {
        var today = shanghaiYmd(0);
        var yest = shanghaiYmd(1);
        return Promise.all([
          fetchShopPages(erpQuery(today, today)),
          fetchShopPages(erpQuery(yest, yest)),
          fetchShopPages("")
        ]).then(function (pack) {
          if (dead) {
            return;
          }
          state.live = liveFromErp(pack[0], pack[1], pack[2]);
          state.shops = state.live.shops;
          state.liveAt = shanghaiClock();
          state.source = "xingmai-erp";
          paint(root, state);
        }).catch(function () {
          if (!dead) {
            paint(root, state);
          }
        });
      }

      function pullBoard() {
        var prev = previousDates(state.from, state.to);
        return Promise.all([
          fetchShopPages(erpQuery(state.from, state.to)),
          fetchShopPages(erpQuery(prev.from, prev.to)),
          fetchShopPages(""),
          api("/api/people"),
          api("/api/people/shops"),
          api("/api/people/grants"),
          api("/api/people/org/stores")
        ]).then(function (pack) {
          if (dead) {
            return;
          }
          var rangePack = pack[0] || { records: [], summary: null };
          var prevPack = pack[1] || { records: [], summary: null };
          var catalogPack = pack[2] || { records: [], summary: null };
          var people = pack[3] && pack[3].people ? pack[3].people : [];
          var peopleShops = pack[4] || { shops: [] };
          var grants = pack[5] && pack[5].grants ? pack[5].grants : [];
          var dutyShops = dutyShopsFrom(pack[6], peopleShops);
          state.cards = companyCardsFrom(summaryFrom(rangePack), summaryFrom(prevPack));
          var built = buildTeams(dutyShops, grants, rangePack, prevPack, catalogPack);
          state.teams = built.teams;
          state.ladders = buildLadders(people, dutyShops, rangePack);
          state.gaps = built.mismatches;
          state.source = rangePack.records && rangePack.records.length ? "xingmai-erp" : "";
          paint(root, state);
        }).catch(function () {
          if (!dead) {
            paint(root, state);
          }
        });
      }

      function onClick(event) {
        var view = event.target.closest("[data-view]");
        if (view) {
          state.view = view.getAttribute("data-view");
          state.mode = state.view === "team" ? "company" : "shop";
          paint(root, state);
          if (state.view === "live") {
            pullLive();
          }
          return;
        }
        var range = event.target.closest("[data-range]");
        if (range) {
          state.range = range.getAttribute("data-range");
          var next = rangeDates(state.range);
          state.from = next.from;
          state.to = next.to;
          paint(root, state);
          pullBoard();
          return;
        }
        if (event.target.closest("#xm-hm-set")) {
          var pop = root.querySelector("#xm-hm-pop");
          pop.hidden = !pop.hidden;
        }
      }

      function onChange(event) {
        var hideKey = event.target.getAttribute("data-hide");
        if (hideKey) {
          var list = hiddenCards();
          if (event.target.checked) {
            list = list.filter(function (item) {
              return item !== hideKey;
            });
          } else if (list.indexOf(hideKey) === -1) {
            list.push(hideKey);
          }
          saveHidden(list);
          paint(root, state);
          return;
        }
        if (event.target.id === "xm-hm-from" || event.target.id === "xm-hm-to") {
          state.from = root.querySelector("#xm-hm-from").value || state.from;
          state.to = root.querySelector("#xm-hm-to").value || state.to;
          pullBoard();
        }
      }

      root.addEventListener("click", onClick);
      root.addEventListener("change", onChange);

      pullBoard();
      pullLive();
      poll = window.setInterval(function () {
        if (state.view === "live") {
          pullLive();
        }
      }, LIVE_REFRESH_MS);

      if (!state.user || !state.user.username) {
        api("/api/auth/me").then(function (user) {
          if (dead || !user) {
            return;
          }
          state.user = user;
          paint(root, state);
        });
      }

      return function unmount() {
        dead = true;
        window.clearInterval(poll);
        root.removeEventListener("click", onClick);
        root.removeEventListener("change", onChange);
        root.innerHTML = "";
      };
    }
  };
  window.XmModules["/"] = window.XmModules["/home"];
})();
