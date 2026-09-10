/* xm-module-home 0.1.195-home-no-tiger */
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
      hero: { label: "实时销售指数", value: "407,140.54", delta: -7.44, spark: [28, 30, 26, 32, 31, 36, 34, 40, 38, 48, 46, 58] },
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
    },
    shops: [
      { shop: "RASW家居旗舰店", liveAmount: "22,997.91", orders: "205", payAmount: "70,190.95", refundRate: "26.31%" },
      { shop: "RASW旗舰店", liveAmount: "17,568.69", orders: "177", payAmount: "66,474.58", refundRate: "26.18%" },
      { shop: "HYGEAR医疗保健旗舰店", liveAmount: "19,986.66", orders: "177", payAmount: "56,928.22", refundRate: "34.41%" },
      { shop: "SAWAAG平价专卖店", liveAmount: "14,216.75", orders: "177", payAmount: "52,932.76", refundRate: "41.31%" },
      { shop: "RASW生活电器旗舰店", liveAmount: "8,929.03", orders: "168", payAmount: "52,426.01", refundRate: "25.00%" },
      { shop: "RASW个护旗舰店", liveAmount: "10,792.90", orders: "106", payAmount: "35,991.48", refundRate: "26.89%" },
      { shop: "DIKTTT欧格专卖店", liveAmount: "13,747.75", orders: "130", payAmount: "34,409.11", refundRate: "34.86%" },
      { shop: "RASW健康电器旗舰店", liveAmount: "10,018.13", orders: "115", payAmount: "30,516.64", refundRate: "17.10%" },
      { shop: "HYGEAR健康器械旗舰店", liveAmount: "6,287.11", orders: "89", payAmount: "29,508.85", refundRate: "18.32%" },
      { shop: "ZYUTO旗舰店", liveAmount: "7,087.40", orders: "164", payAmount: "29,329.38", refundRate: "7.80%" }
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
      '</span><i title="演示指标">i</i></div><div class="xm-hm-value' +
      (card.accent ? " is-accent" : "") +
      '">' +
      escapeHtml(card.value) +
      "</div>" +
      trendHtml(card.trend) +
      "</article>"
    );
  }

  function rowHtml(row, index, withTrend) {
    return (
      "<tr><td>" +
      rankMark(index) +
      "</td><td>" +
      escapeHtml(row.shop) +
      "</td><td>" +
      escapeHtml(row.owner) +
      "</td><td>" +
      escapeHtml(row.amount) +
      "</td>" +
      (withTrend ? "<td>" + trendHtml(row.trend) + "</td>" : "") +
      "</tr>"
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
      "团队</h2><p>责权下的店铺先走演示店，数据中心按店名对齐后替换数字。</p></div>" +
      '<a href="' +
      escapeHtml(team.href || "#") +
      '">打开运营中心</a></header>' +
      '<div class="xm-hm-team-kpis">' +
      cards.map(cardHtml).join("") +
      "</div>" +
      '<div class="xm-hm-panel"><h2>责权店铺 <span>' +
      shops.length +
      " 店 · 演示</span></h2>" +
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

  function sparkHtml(values) {
    var list = values && values.length ? values : [20, 24, 22, 28, 26];
    var max = Math.max.apply(null, list) || 1;
    return (
      '<div class="xm-hm-spark" aria-hidden="true">' +
      list
        .map(function (n) {
          return '<i style="height:' + Math.max(12, Math.round((Number(n) / max) * 100)) + '%"></i>';
        })
        .join("") +
      "</div>"
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
          refundRate: cells[7] || row.refundRate || "—"
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
      hero: payload.hero || target.hero,
      cards: payload.cards && payload.cards.length ? payload.cards : target.cards
    };
  }

  function groupByOwner(rows) {
    var map = {};
    rows.forEach(function (row) {
      var key = row.owner || "未分配";
      if (!map[key]) {
        map[key] = { shop: key + "团队", owner: key, amount: 0, trend: 0, n: 0 };
      }
      var num = Number(String(row.amount).replace(/,/g, "")) || 0;
      map[key].amount += num;
      map[key].trend += Number(row.trend) || 0;
      map[key].n += 1;
    });
    return Object.keys(map)
      .map(function (key) {
        var item = map[key];
        return {
          shop: item.shop,
          owner: item.owner,
          amount: item.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          trend: item.n ? item.trend / item.n : 0
        };
      })
      .sort(function (a, b) {
        return Number(String(b.amount).replace(/,/g, "")) - Number(String(a.amount).replace(/,/g, ""));
      });
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
      ".xm-hm-live-meta{display:none;align-items:center;gap:10px;color:var(--xm-muted);font-size:12px}" +
      ".xm-hm.is-live .xm-hm-live-meta{display:flex}" +
      ".xm-hm-live-meta a{color:var(--xm-primary);text-decoration:none}" +
      ".xm-hm-hero{background:var(--xm-card);border:1px solid var(--xm-line);border-radius:8px;box-shadow:var(--xm-shadow);padding:14px 16px 12px}" +
      ".xm-hm-hero-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}" +
      ".xm-hm-spark{display:flex;align-items:flex-end;gap:3px;height:42px;min-width:120px}" +
      ".xm-hm-spark i{flex:1;display:block;background:var(--xm-primary);opacity:.45;border-radius:2px 2px 0 0}" +
      ".xm-hm-live-cards{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}" +
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
      "@media (max-width:1200px){.xm-hm-kpis,.xm-hm-team-kpis,.xm-hm-live-cards,.xm-hm-podiums{grid-template-columns:repeat(2,minmax(0,1fr))}}" +
      "@media (max-width:700px){.xm-hm-kpis,.xm-hm-team-kpis,.xm-hm-live-cards,.xm-hm-podiums{grid-template-columns:1fr}.xm-hm-hero-top{flex-direction:column}.xm-hm-team-head{flex-direction:column}}"
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
      "</div>" +
      '<div class="xm-hm-live-meta" id="xm-hm-live-meta"></div></div>' +
      '<div class="xm-hm-pop" id="xm-hm-pop" hidden><h3>卡片设置</h3><div id="xm-hm-card-opts"></div></div>' +
      '<div class="xm-hm-body">' +
      '<section class="xm-hm-kpis" id="xm-hm-kpis"></section>' +
      '<section class="xm-hm-teams" id="xm-hm-teams" hidden></section>' +
      '<section class="xm-hm-live" id="xm-hm-live" hidden></section>' +
      '<section class="xm-hm-board" id="xm-hm-board" hidden>' +
      '<div id="xm-hm-ladders"></div></section>' +
      '</div><p class="xm-hm-note" id="xm-hm-note">演示看板，数字不是外部业务库。先按这个模版铺上，后面再对真实口径。</p></div>'
    );
  }

  function paint(root, state) {
    var board = root.querySelector("#xm-hm");
    var hide = hiddenCards();
    var cards = (state.cards || FALLBACK.cards).filter(function (card) {
      return hide.indexOf(card.key) === -1;
    });
    var live = state.live || FALLBACK.live;
    var shops = state.shops && state.shops.length ? state.shops : FALLBACK.shops;
    var teams = state.teams && state.teams.length ? state.teams : FALLBACK.teams;
    var hero = live.hero || {};
    var down = Number(hero.delta) < 0;
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
    root.querySelector("#xm-hm-live-meta").innerHTML =
      '<span>跟数据中心「实时付费」同一套看板</span>' +
      (live.dateLabel ? "<span>（统计时间：" + escapeHtml(live.dateLabel) + "）</span>" : "") +
      (live.range ? "<span>" + escapeHtml(live.range) + "</span>" : "") +
      '<a href="/data/paid">打开数据中心</a>';
    root.querySelector("#xm-hm-live").innerHTML =
      '<article class="xm-hm-hero"><div class="xm-hm-hero-top"><div><div class="xm-hm-card-head"><span>' +
      escapeHtml(hero.label || "实时销售指数") +
      '</span></div><div class="xm-hm-index-num">' +
      escapeHtml(hero.value || "—") +
      '</div><div class="xm-hm-trend ' +
      (down ? "is-down" : "is-up") +
      '">环比 ' +
      (down ? "↘" : "↗") +
      " " +
      Math.abs(Number(hero.delta) || 0).toFixed(2) +
      "%</div></div>" +
      sparkHtml(hero.spark) +
      "</div></article>" +
      '<div class="xm-hm-live-cards">' +
      (live.cards || []).map(liveCardHtml).join("") +
      "</div>" +
      '<div class="xm-hm-panel"><h2>数据中心网点 <span>' +
      escapeHtml(String((live.summary && live.summary.shops) || shops.length)) +
      " 店</span></h2>" +
      '<table class="xm-hm-table"><thead><tr><th>排名</th><th>店铺名称</th><th>实时销售额</th><th>销售单数</th><th>支付金额</th><th>退款率</th></tr></thead>' +
      "<tbody>" +
      shops.map(function (row, i) {
        return shopRowHtml(row, i, false);
      }).join("") +
      "</tbody></table></div>";
    root.querySelector("#xm-hm-ladders").innerHTML = (state.ladders || FALLBACK.ladders).map(ladderHtml).join("");
    root.querySelector("#xm-hm-note").textContent =
      state.view === "live"
        ? "实时页读取数据中心 /api/data/live 与 /api/data/shops，那边看板变了这里跟着变。"
        : state.view === "team"
          ? "团队页分沈子晗、韩梦凯两份。店铺先用演示店，数据中心责权接口有了按店名对齐。"
          : state.view === "board"
            ? "排行榜是业绩排行榜和利润排行榜，按运营 / 主管 / 经理分列。演示数字。"
            : "演示看板，数字不是外部业务库。先按这个模版铺上，后面再对真实口径。";
    var user = state.user && (state.user.displayName || state.user.username);
    var mark = user || "星脉";
    root.querySelector("#xm-hm-mark").innerHTML = new Array(18)
      .fill(0)
      .map(function () {
        return "<span>" + escapeHtml(mark) + "</span>";
      })
      .join("");
    root.querySelector("#xm-hm-card-opts").innerHTML = (state.cards || FALLBACK.cards)
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
        cards: FALLBACK.cards,
        tiger: FALLBACK.tiger,
        live: FALLBACK.live,
        shops: FALLBACK.shops,
        teams: FALLBACK.teams.map(function (team) {
          return { key: team.key, name: team.name, href: team.href, cards: team.cards, shops: team.shops.slice() };
        }),
        ladders: FALLBACK.ladders
      };
      var poll = 0;
      paint(root, state);

      function pullDataCenter() {
        return Promise.all([
          api("/api/data/live"),
          api("/api/data/shops"),
          api("/api/home/live"),
          api("/api/home/teams"),
          api("/api/people/shops")
        ]).then(function (pack) {
          if (dead) {
            return;
          }
          var live = pack[0] && pack[0].ok ? pack[0] : pack[2];
          var shops = pack[1];
          var homeTeams = pack[3];
          var peopleShops = pack[4];
          if (live && live.ok) {
            state.live = mergeLive(state.live, live);
          }
          var nextShops = readShopRows(shops || {});
          if (nextShops.length) {
            state.shops = nextShops;
          }
          if (homeTeams && homeTeams.ok && homeTeams.teams && homeTeams.teams.length) {
            state.teams = homeTeams.teams;
          }
          state.teams = mergePeopleShops(state.teams, peopleShops);
          state.teams = state.teams.map(function (team) {
            return {
              key: team.key,
              name: team.name,
              href: team.href,
              cards: team.cards,
              shops: overlayShopMetrics(team.shops, nextShops)
            };
          });
          paint(root, state);
        });
      }

      function onClick(event) {
        var view = event.target.closest("[data-view]");
        if (view) {
          state.view = view.getAttribute("data-view");
          state.mode = state.view === "team" ? "company" : "shop";
          paint(root, state);
          return;
        }
        var range = event.target.closest("[data-range]");
        if (range) {
          state.range = range.getAttribute("data-range");
          var next = rangeDates(state.range);
          state.from = next.from;
          state.to = next.to;
          paint(root, state);
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
        }
      }

      root.addEventListener("click", onClick);
      root.addEventListener("change", onChange);

      api("/api/home/summary").then(function (data) {
        if (dead || !data || data.ok !== true) {
          return;
        }
        if (data.cards && data.cards.some(function (card) { return card.key === "payAmount"; })) {
          state.cards = data.cards;
        }
        if (data.tiger && data.tiger.rows && data.tiger.rows.length) {
          state.tiger = data.tiger;
        }
        if (data.ladders && data.ladders.length) {
          state.ladders = data.ladders;
        }
        if (data.from && data.to && state.range === "yesterday") {
          state.from = data.from;
          state.to = data.to;
        }
        paint(root, state);
      });

      pullDataCenter();
      poll = window.setInterval(pullDataCenter, 30000);

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
