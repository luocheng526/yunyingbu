(function () {
  window.XmModules = window.XmModules || {};

  var RANGES = ["7天", "30天", "日", "周", "月", "年", "自定义"];
  var SECTIONS = ["渠道列表", "店铺分组", "经营数据", "竞对对比", "品类分析", "热销商品"];
  var DUTY_GROUPS = ["经理组", "主管组", "储备组"];
  var TABLE_COLS = [
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

  var METRIC_LS = "xm-data-ov-metrics";
  var METRIC_SEEN_LS = "xm-data-ov-metrics-seen";
  var SHOP_COL_LS = "xm-data-ov-shop-cols";
  var SHOP_COL_SEEN_LS = "xm-data-ov-shop-cols-seen";
  var SHOP_COL_CATALOG = [
    { key: "live", label: "实时销售额 (支付)", fields: ["livePayAmount", "todayPayAmount", "realtimePayAmount", "payAmount"], kind: "money" },
    { key: "newRate", label: "店铺上新成功率", fields: ["newRate"], kind: "rate4" },
    { key: "orders", label: "销售单数", fields: ["orderCount"], kind: "int" },
    { key: "netOrders", label: "净销售单数 (支付)", fields: ["netOrderCount"], kind: "int" },
    { key: "pay", label: "支付金额 (支付)", fields: ["payAmount"], kind: "money" },
    { key: "invalidAmount", label: "无效单金额 (标注)", fields: ["invalidAmount", "invalidOrderAmount"], kind: "money" },
    { key: "refund", label: "退款金额", fields: ["refundAmount"], kind: "money" },
    { key: "refundRate", label: "退款率 (按金额)", fields: ["refundRate"], kind: "rate" },
    { key: "netSales", label: "净销售额 (支付)", fields: ["netSales", "netSalesAmount"], kind: "money" },
    { key: "totalMarketing", label: "总营销额", fields: ["totalMarketing"], kind: "money" },
    { key: "siteMarketing", label: "全站营销额", fields: ["siteMarketing"], kind: "money" },
    { key: "offsiteMarketing", label: "非全站营销额", fields: ["offsiteMarketing"], kind: "money" },
    { key: "adRate", label: "推广花费占比 (支付预估)", fields: ["promotionRate"], kind: "rate" },
    { key: "profit", label: "利润 (支付预估)", fields: ["profit"], kind: "money" },
    { key: "margin", label: "大毛利率", fields: ["profitRate"], kind: "rate" },
    { key: "saleFee", label: "销售费用 (支付预估)", fields: ["saleFee", "salesFee"], kind: "money" },
    { key: "platformFee", label: "平台费用 (支付预估)", fields: ["platformFee", "platformCost"], kind: "money" },
    { key: "goodsCost", label: "总货款成本", fields: ["goodsCost", "totalGoodsCost"], kind: "money" },
    { key: "dropshipCount", label: "代发单量", fields: ["dropshipCount"], kind: "int" },
    { key: "invalidCount", label: "无效单量", fields: ["invalidCount"], kind: "int" },
    { key: "goodsCostRate", label: "总货款成本占比", fields: ["goodsCostRate"], kind: "rate" },
    { key: "netGoodsCost", label: "净货款成本 (支付)", fields: ["netGoodsCost"], kind: "money" },
    { key: "netGoodsCostRate", label: "净货品成本占比 (支付)", fields: ["netGoodsCostRate"], kind: "rate" },
    { key: "custom", label: "自定义费用", fields: ["customFee"], kind: "money" },
    { key: "otherFee", label: "其他费用", fields: ["otherFee"], kind: "money" },
    { key: "materialFee", label: "耗材费", fields: ["materialFee"], kind: "money" },
    { key: "shipMaterialFee", label: "耗材费 (发货)", fields: ["shipMaterialFee"], kind: "money" },
    { key: "packFee", label: "打包费", fields: ["packFee"], kind: "money" }
  ];
  var HERO_TIP = "当天按支付时间累计的销售额，与首页实时销售指数同源（星脉 ERP 支付流水）";
  var METRIC_CATALOG = [
    { key: "pay", label: "支付金额 (支付)", tip: "按支付时间统计的订单金额(包含无效单、代发单)" },
    {
      key: "orders",
      label: "销售单数 (支付)",
      tip: "剔除无效单和退款订单后的订单数(按支付时间统计)\n计算公式:销售单数(支付)-无效单订单数-普通单退款单数-代发单退款单数"
    },
    { key: "ad", label: "推广花费 (支付预估)", tip: "SPU推广费用" },
    {
      key: "profit",
      label: "利润 (支付预估)",
      tip: "统计时间内产生的利润（按支付时间统计）\n计算公式：净销售额（支付）-净货品成本（支付）-销售费用（支付）-发货费用（支付）-其他费用-自定义费用"
    },
    { key: "margin", label: "大毛利率", tip: "利润/支付金额" },
    { key: "custom", label: "自定义费用", tip: "店铺或运营录入的自定义费用，利润计算时会扣除" },
    {
      key: "refundRate",
      label: "退款率 (按金额)",
      tip: "按订单金额计算的退款率\n计算公式:退款金额/支付金额(支付)*100%"
    },
    {
      key: "adRate",
      label: "推广花费占比 (支付预估)",
      tip: "推广花费占支付金额的比例（按支付时间统计）\n计算公式：推广花费（支付预估）/支付金额（支付）100%（推广花费≤0时，按0计算：支付金额≤0时，按1计算）"
    },
    { key: "netSales", label: "净销售额 (支付)", tip: "净销售数对应的订单金额合计" },
    {
      key: "refundAmount",
      label: "退款金额",
      tip: "按退款成功时间统计的金额(包含未发货退款、已发货仅退款和已发货退货退款)"
    },
    { key: "platformFee", label: "平台花费 (支付预估)", tip: "支付金额（支付）对应的预估平台花费" },
    { key: "goodsCost", label: "总货品成本", tip: "京小洁采购单成本+导入的货品成本" },
    {
      key: "saleFee",
      label: "销售费用 (支付预估)",
      tip: "支付金额（支付）对应的预估销售费用\n计算公式：推广花费（支付预估）+平台花费（支付预估）+无效单佣金"
    },
    {
      key: "jdWarehouseRate",
      label: "京仓订单占比",
      tip: "京仓订单数量占销售订单数量的比例(按支付时间统计)\n计算公式:京仓订单数量（支付）/销售单数（支付）*100%"
    },
    {
      key: "netGoodsCostRate",
      label: "净货品成本占比 (支付)",
      tip: "净货品成本占支付金额的比例（按支付时间统计）\n计算公式：净货款成本（支付）/支付金额（支付）*100%"
    },
    { key: "invalidAmount", label: "无效单金额", tip: "标记为无效单的订单支付金额" },
    { key: "jdWarehouseCount", label: "京仓订单数量", tip: "京仓订单数量（按支付时间统计）" }
  ];

  function catalogKeys() {
    return METRIC_CATALOG.map(function (item) {
      return item.key;
    });
  }

  function metricOf(key) {
    return (
      METRIC_CATALOG.find(function (item) {
        return item.key === key;
      }) || { key: key, label: key }
    );
  }

  function tipAttr(text) {
    return escapeHtml(text || "指标说明").replaceAll("\n", "&#10;");
  }

  function helpBtn(tip) {
    if (!tip) {
      return "";
    }
    return (
      '<button type="button" class="ch-help" data-tip="' +
      tipAttr(tip) +
      '" aria-label="指标说明">?</button>'
    );
  }

  function rememberMetricCatalog() {
    try {
      localStorage.setItem(METRIC_SEEN_LS, JSON.stringify(catalogKeys()));
    } catch (_err) {}
  }

  function loadMetricKeys() {
    const all = catalogKeys();
    try {
      const raw = localStorage.getItem(METRIC_LS);
      const seenRaw = localStorage.getItem(METRIC_SEEN_LS);
      const seen = seenRaw ? JSON.parse(seenRaw) : [];
      const seenList = Array.isArray(seen) ? seen : [];
      const newcomers = all.filter(function (key) {
        return seenList.indexOf(key) < 0;
      });
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const allow = {};
          all.forEach(function (key) {
            allow[key] = true;
          });
          const kept = parsed.filter(function (key) {
            return allow[key];
          });
          newcomers.forEach(function (key) {
            if (kept.indexOf(key) < 0) {
              kept.push(key);
            }
          });
          rememberMetricCatalog();
          return kept;
        }
      }
    } catch (_err) {}
    return all.slice();
  }

  function saveMetricKeys(keys) {
    try {
      localStorage.setItem(METRIC_LS, JSON.stringify(keys));
      rememberMetricCatalog();
    } catch (_err) {}
  }

  function shopColKeys() {
    return SHOP_COL_CATALOG.map(function (item) {
      return item.key;
    });
  }

  function shopColOf(key) {
    return (
      SHOP_COL_CATALOG.find(function (item) {
        return item.key === key;
      }) || { key: key, label: key, fields: [key], kind: "money" }
    );
  }

  function rememberShopCols() {
    try {
      localStorage.setItem(SHOP_COL_SEEN_LS, JSON.stringify(shopColKeys()));
    } catch (_err) {}
  }

  function loadShopColKeys() {
    const all = shopColKeys();
    try {
      const raw = localStorage.getItem(SHOP_COL_LS);
      const seenRaw = localStorage.getItem(SHOP_COL_SEEN_LS);
      const seen = seenRaw ? JSON.parse(seenRaw) : [];
      const seenList = Array.isArray(seen) ? seen : [];
      const newcomers = all.filter(function (key) {
        return seenList.indexOf(key) < 0;
      });
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const keep = parsed.filter(function (key) {
            return all.indexOf(key) >= 0;
          });
          newcomers.forEach(function (key) {
            if (keep.indexOf(key) < 0) {
              keep.push(key);
            }
          });
          rememberShopCols();
          return keep.length ? keep : all.slice();
        }
      }
    } catch (_err) {}
    rememberShopCols();
    return all.slice();
  }

  function saveShopColKeys(keys) {
    try {
      localStorage.setItem(SHOP_COL_LS, JSON.stringify(keys));
      rememberShopCols();
    } catch (_err) {}
  }

  var LIVE_KEY = "live";
  var BOARD_ORDER_LS = "xm-data-ov-card-order";

  function defaultBoardOrder() {
    return [LIVE_KEY].concat(catalogKeys());
  }

  function loadBoardOrder(selected) {
    const allow = {};
    allow[LIVE_KEY] = true;
    (selected || []).forEach(function (key) {
      allow[key] = true;
    });
    let stored = [];
    try {
      const parsed = JSON.parse(localStorage.getItem(BOARD_ORDER_LS) || "[]");
      if (Array.isArray(parsed)) {
        stored = parsed;
      }
    } catch (_err) {}
    const out = [];
    stored.concat(defaultBoardOrder()).forEach(function (key) {
      if (allow[key] && out.indexOf(key) < 0) {
        out.push(key);
      }
    });
    return out;
  }

  function saveBoardOrder(keys) {
    try {
      localStorage.setItem(BOARD_ORDER_LS, JSON.stringify(keys));
    } catch (_err) {}
  }

  var OV_BOARD_LS = "xm-data-ov-board-v1";
  var OV_BOARD_FRESH_MS = 60 * 60 * 1000;

  function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function ovBoardKey(range, span) {
    return [range || "", (span && span.from) || "", (span && span.to) || ""].join("|");
  }

  function readOvBoard(range, span) {
    try {
      const all = JSON.parse(localStorage.getItem(OV_BOARD_LS) || "{}");
      const slot = all[ovBoardKey(range, span)] || all.latest;
      if (!slot || !slot.payload) {
        return null;
      }
      return slot;
    } catch (_err) {
      return null;
    }
  }

  function writeOvBoard(range, span, payload) {
    if (!payload) {
      return;
    }
    try {
      const all = JSON.parse(localStorage.getItem(OV_BOARD_LS) || "{}");
      const slot = { at: Date.now(), range: range, payload: cloneJson(payload) };
      all[ovBoardKey(range, span)] = slot;
      all.latest = slot;
      localStorage.setItem(OV_BOARD_LS, JSON.stringify(all));
    } catch (_err) {}
  }

  function ovBoardFresh(slot) {
    return Boolean(slot && slot.at && Date.now() - slot.at < OV_BOARD_FRESH_MS);
  }

  function readSharedShopMetrics() {
    try {
      const all = JSON.parse(localStorage.getItem("xm-data-shops-metrics-v1") || "{}");
      const slot = all.latest;
      return slot && Array.isArray(slot.shops) ? slot.shops : [];
    } catch (_err) {
      return [];
    }
  }

  function overlaySharedShopMetrics(shops) {
    const extra = readSharedShopMetrics();
    if (!extra.length) {
      return shops || [];
    }
    const byId = {};
    extra.forEach(function (shop) {
      const id = String(shop.shopId || shop.id || "");
      if (id) {
        byId[id] = shop;
      }
    });
    const seen = {};
    const out = (shops || []).map(function (shop) {
      const id = String(shop.shopId || "");
      if (id) {
        seen[id] = true;
      }
      const hit = byId[id];
      if (!hit) {
        return shop;
      }
      return Object.assign({}, shop, hit, {
        shopName: shop.shopName || hit.shopName,
        shopId: id
      });
    });
    extra.forEach(function (shop) {
      const id = String(shop.shopId || shop.id || "");
      if (!id || seen[id]) {
        return;
      }
      seen[id] = true;
      out.push(shop);
    });
    return out;
  }

  function expandCards(cards) {
    const byKey = {};
    (cards || []).forEach(function (card) {
      if (card && card.key) {
        byKey[card.key] = card;
      }
    });
    return METRIC_CATALOG.map(function (item) {
      return (
        byKey[item.key] || {
          key: item.key,
          label: item.label,
          value: /占比|利率|退款率/.test(item.label) ? "0.00%" : "0"
        }
      );
    });
  }

  function visibleCards(cards, keys) {
    const byKey = {};
    expandCards(cards).forEach(function (card) {
      byKey[card.key] = card;
    });
    return (keys || catalogKeys())
      .map(function (key) {
        return byKey[key];
      })
      .filter(Boolean);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function ensureCss() {
    if (!document.querySelector('link[href^="/data-pages.css"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/data-pages.css?v=data-ov27";
      document.head.appendChild(link);
    }
    ensureCardTypeStyle();
    ensurePickStyle();
    ensureTabsStyle();
  }

  function ensureTabsStyle() {
    if (document.getElementById("ch-tabs-style")) {
      return;
    }
    const style = document.createElement("style");
    style.id = "ch-tabs-style";
    style.textContent =
      ".ch-split{height:2px;margin:8px 0;background:#2f54eb}" +
      ".ch-tabs{display:flex;background:transparent;border-bottom:1px solid #f0f0f0}" +
      ".ch-tabs button{height:36px;border:0;background:transparent;color:#262626}" +
      ".ch-tabs button.is-active{color:#fff;background:#2f54eb}";
    document.head.appendChild(style);
  }

  function ensurePickStyle() {
    if (document.getElementById("ch-mpick-style")) {
      return;
    }
    const style = document.createElement("style");
    style.id = "ch-mpick-style";
    style.textContent =
      ".ch-mpick-mask{position:fixed;inset:0;z-index:4200;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,.45)}" +
      ".ch-mpick{display:flex;flex-direction:column;width:min(1080px,100%);height:min(640px,100%);background:#fff;border-radius:8px;box-shadow:0 12px 40px rgba(0,0,0,.18);color:#262626;overflow:hidden}" +
      ".ch-mpick-head{display:flex;align-items:center;justify-content:space-between;height:48px;padding:0 20px;border-bottom:1px solid #f0f0f0;font-size:16px}" +
      ".ch-mpick-x{width:28px;height:28px;border:0;background:transparent;color:#8c8c8c;font-size:20px;line-height:28px;cursor:pointer}" +
      ".ch-mpick-body{display:flex;flex:1;min-height:0}" +
      ".ch-mpick-left{flex:1;min-width:0;padding:16px 20px;overflow:auto}" +
      ".ch-mpick-search input{width:100%;height:36px;padding:0 12px;border:1px solid #d9d9d9;border-radius:6px;box-sizing:border-box}" +
      ".ch-mpick-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px 20px;margin-top:18px}" +
      ".ch-mpick-opt{display:flex;align-items:center;gap:8px;color:#2f54eb;font-size:14px;cursor:pointer}" +
      ".ch-mpick-opt input{accent-color:#2f54eb}" +
      ".ch-mpick-right{width:280px;flex:none;padding:16px 16px 12px;background:#f7f8fa;border-left:1px solid #f0f0f0;overflow:auto}" +
      ".ch-mpick-right-top{display:flex;align-items:center;justify-content:space-between;font-size:13px}" +
      ".ch-mpick-right-top button{border:0;background:transparent;color:#2f54eb;cursor:pointer}" +
      ".ch-mpick-hint{margin:10px 0 12px;color:#8c8c8c;font-size:12px}" +
      ".ch-mpick-item{display:flex;align-items:center;gap:8px;height:36px;margin-bottom:8px;padding:0 10px;background:#fff;border:1px solid #f0f0f0;border-radius:6px;font-size:13px;cursor:grab}" +
      ".ch-mpick-handle{width:12px;height:12px;opacity:.45}" +
      ".ch-mpick-foot{display:flex;gap:8px;padding:12px 20px;border-top:1px solid #f0f0f0}" +
      ".ch-mpick-ok{height:32px;padding:0 16px;border:0;border-radius:4px;background:#2f54eb;color:#fff;cursor:pointer}" +
      ".ch-mpick-foot [data-mpick='cancel']{height:32px;padding:0 16px;border:1px solid #d9d9d9;border-radius:4px;background:#fff;cursor:pointer}";
    document.head.appendChild(style);
  }

  function ensureCardTypeStyle() {
    if (document.getElementById("ch-card-type-style")) {
      return;
    }
    const style = document.createElement("style");
    style.id = "ch-card-type-style";
    style.textContent =
      ".ch-card .label{font-size:13px;line-height:22px;color:#8c8c8c;opacity:1}" +
      ".ch-card .value{margin-top:16px;font-size:28px;font-weight:700;line-height:1.3;letter-spacing:-.02em;color:#141414;font-variant-numeric:tabular-nums}" +
      ".ch-card .extra{margin-top:14px;font-size:12px;line-height:20px;color:#8c8c8c;opacity:1}" +
      ".ch-metrics{align-items:stretch}" +
      ".ch-metrics .ch-card{min-height:148px;height:100%;box-sizing:border-box;cursor:grab;user-select:none}" +
      ".ch-metrics .ch-hero{min-height:216px;height:100%;box-sizing:border-box;cursor:grab;user-select:none}" +
      ".ch-metrics .ch-card.is-drag{opacity:.55;cursor:grabbing}" +
      ".ch-metrics .ch-card.is-over{outline:1px solid #2f54eb;background:#f5f8ff}" +
      ".ch-hero .ch-spark{display:block;width:100%;height:72px;margin:8px 0 0}" +
      ".ch-axis{display:flex;justify-content:space-between;font-size:10px;opacity:.4;margin-top:2px}" +
      ".ch-hero .value{margin:8px 0 0}" +
      ".ch-card-right{display:inline-flex;align-items:center;gap:6px;margin-left:auto;flex:none}" +
      ".ch-hero .delta{margin:4px 0 0;font-size:12px;line-height:16px;white-space:nowrap}" +
      ".ch-hero .ch-clock{margin-left:2px;padding:0;height:auto;border-radius:0;background:transparent;color:#8c8c8c;font-size:12px;font-variant-numeric:tabular-nums;opacity:1}" +
      ".ch-card .label{display:flex;align-items:center;justify-content:space-between;gap:8px}" +
      ".ch-help{flex:none;width:16px;height:16px;border:1px solid var(--xm-line,#d9d9d9);border-radius:3px;background:#fff;color:#8c8c8c;font-size:11px;line-height:14px;cursor:help;padding:0}" +
      ".ch-tip{position:fixed;z-index:4300;max-width:320px;padding:10px 12px;background:#fff;border:1px solid #f0f0f0;border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,.12);color:#262626;font-size:12px;line-height:1.6;white-space:pre-wrap;display:none}" +
      ".ch-tip.is-on{display:block}" +
      ".ch-table.sh-wide{overflow:visible}" +
      ".ch-shop-menu{display:none;position:fixed;z-index:5200;min-width:220px;max-height:280px;overflow:auto;padding:6px 0;background:#fff;border:1px solid #d9d9d9}" +
      ".ch-shop-menu.is-open{display:block}" +
      ".ch-shop-opt{display:flex;align-items:center;gap:8px;padding:5px 12px;color:#262626;background:#fff;cursor:pointer}";
    document.head.appendChild(style);
  }

  var CAL_SHADOW_CSS =
    ":host{position:fixed;z-index:4000;display:none;box-sizing:border-box;width:560px;background:#fff;border:1px solid #e8e8e8;border-radius:4px;box-shadow:0 6px 16px rgba(0,0,0,.12);color:#262626;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif}" +
    ":host(.is-open){display:block}" +
    ".ch-cal{display:flex;width:560px}" +
    ".ch-cal-month{width:280px;padding:8px 12px 10px;box-sizing:border-box}" +
    ".ch-cal-month + .ch-cal-month{border-left:1px solid #f0f0f0}" +
    ".ch-cal-head{position:relative;height:32px;line-height:32px;text-align:center;font-size:14px}" +
    ".ch-cal-head button{position:absolute;top:4px;width:22px;height:22px;padding:0;border:0;background:transparent;color:#8c8c8c;font-size:12px;line-height:22px;cursor:pointer}" +
    ".ch-cal-head [data-cal='prev-year']{left:0}" +
    ".ch-cal-head [data-cal='prev-month']{left:20px}" +
    ".ch-cal-head [data-cal='next-month']{right:20px}" +
    ".ch-cal-head [data-cal='next-year']{right:0}" +
    "table{width:100%;border-collapse:collapse;table-layout:fixed}" +
    "th{height:24px;font-size:12px;font-weight:400;color:#8c8c8c}" +
    "td{height:28px;padding:0;text-align:center}" +
    "td button{display:block;width:100%;height:28px;margin:0;padding:0;border:0;border-radius:2px;background:transparent;color:#262626;font:13px/28px inherit;cursor:pointer}" +
    "td button:hover:not(:disabled):not(.is-start):not(.is-end){background:#f5f5f5}" +
    "td button.is-out,td button.is-over,td button.is-future,td button:disabled{color:#bfbfbf;cursor:default}" +
    "td button.is-today{color:#cf1322;font-weight:600}" +
    "td button.is-in{background:#fff1f0;color:#c62828}" +
    "td button.is-start,td button.is-end{background:#c62828;color:#fff}";

  function getCalPop() {
    let el = document.getElementById("ch-cal-pop");
    if (el && !el.shadowRoot) {
      el.remove();
      el = null;
    }
    if (!el) {
      el = document.createElement("div");
      el.id = "ch-cal-pop";
      el.className = "ch-cal-pop";
      el.attachShadow({ mode: "open" });
      document.body.appendChild(el);
    }
    return el;
  }

  function getShopMenu() {
    let el = document.getElementById("ch-shop-menu");
    if (!el) {
      el = document.createElement("div");
      el.id = "ch-shop-menu";
      el.className = "ch-shop-menu";
      el.setAttribute("data-shop-menu", "");
      document.body.appendChild(el);
    }
    return el;
  }

  function hideShopMenu() {
    const el = document.getElementById("ch-shop-menu");
    if (el) {
      el.classList.remove("is-open");
      el.innerHTML = "";
    }
  }

  function hideCalPop() {
    const el = document.getElementById("ch-cal-pop");
    if (el) {
      el.classList.remove("is-open");
      if (el.shadowRoot) {
        el.shadowRoot.innerHTML = "";
      }
    }
  }

  function pathEl(event, attr) {
    const path = event.composedPath ? event.composedPath() : [];
    for (let i = 0; i < path.length; i += 1) {
      const node = path[i];
      if (node && node.getAttribute && node.getAttribute(attr) != null) {
        return node;
      }
    }
    return null;
  }

  function stripPageChrome(root) {
    Array.prototype.forEach.call(root.querySelectorAll(".kicker, .data-subnav, .page-head"), function (el) {
      el.remove();
    });
    Array.prototype.forEach.call(root.querySelectorAll("h1"), function (el) {
      if (/数据总揽|数据总览|渠道总览/.test(el.textContent.trim())) {
        el.remove();
      }
    });
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function ymd(date) {
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
  }

  function slashDate(date) {
    return date.getFullYear() + "/" + (date.getMonth() + 1) + "/" + date.getDate();
  }

  function shanghaiMinute() {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Shanghai",
      minute: "2-digit"
    }).formatToParts(new Date());
    const minute = parts.find(function (part) {
      return part.type === "minute";
    });
    return Number(minute && minute.value) || 0;
  }

  function shanghaiHour() {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Shanghai",
      hour: "2-digit",
      hour12: false
    }).formatToParts(new Date());
    const hour = parts.find(function (part) {
      return part.type === "hour";
    });
    return Number(hour && hour.value) || 0;
  }

  function shanghaiHms() {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Shanghai",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(new Date());
  }

  function cumulativeCurve(total, points) {
    const n = Math.max(Number(points) || 0, 2);
    const end = Number(total) || 0;
    const out = [];
    for (let i = 0; i < n; i += 1) {
      const t = (i + 1) / n;
      const eased = t * t * (3 - 2 * t);
      out.push(Number((end * eased).toFixed(2)));
    }
    return out;
  }

  function seedHeroCompare(yestTotal, todayTotal) {
    const hour = Math.max(0, Math.min(shanghaiHour(), 23));
    const todayPts = Math.max(2, hour + 1);
    const yesterday = cumulativeCurve(yestTotal, 24);
    const todayEnd = todayTotal != null ? Number(todayTotal) || 0 : 0;
    const today = cumulativeCurve(todayEnd, todayPts);
    const idx = Math.min(today.length, yesterday.length) - 1;
    const now = todayEnd;
    const then = yesterday[idx] || 0;
    const delta = then ? Number((((now - then) / Math.abs(then)) * 100).toFixed(2)) : 0;
    return { yesterday: yesterday, today: today, delta: delta, value: now };
  }

  function shanghaiYmd(offsetDays) {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());
    const parts = today.split("-").map(Number);
    const utc = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + (offsetDays || 0)));
    return utc.toISOString().slice(0, 10);
  }

  function cnDateLabel(ymdStr) {
    const parts = String(ymdStr || "").split("-");
    if (parts.length < 3) {
      return ymdStr;
    }
    return Number(parts[0]) + "年" + Number(parts[1]) + "月" + Number(parts[2]) + "日";
  }

  function pickYesterdayRow(trend) {
    const yest = shanghaiYmd(-1);
    const today = shanghaiYmd(0);
    const rows = trend || [];
    const hit = rows.find(function (row) {
      return row && row.date === yest;
    });
    if (hit) {
      return hit;
    }
    const last = rows[rows.length - 1];
    if (last && last.date === today && rows.length >= 2) {
      return rows[rows.length - 2];
    }
    return last || null;
  }

  function rangeSpan(label, customFrom, customTo) {
    const to = new Date();
    to.setHours(0, 0, 0, 0);
    const from = new Date(to);
    if (label === "30天") {
      from.setDate(from.getDate() - 29);
    } else if (label === "日") {
      const yest = shanghaiYmd(-1);
      return { from: yest, to: yest, dateLabel: cnDateLabel(yest) };
    } else if (label === "周") {
      const day = from.getDay() || 7;
      from.setDate(from.getDate() - day + 1);
    } else if (label === "月") {
      from.setDate(1);
    } else if (label === "年") {
      from.setMonth(0, 1);
    } else if (label === "自定义" && customFrom && customTo) {
      return { from: customFrom, to: customTo, dateLabel: customFrom.replaceAll("-", "/") + " - " + customTo.replaceAll("-", "/") };
    } else {
      from.setDate(from.getDate() - 6);
    }
    return {
      from: ymd(from),
      to: ymd(to),
      dateLabel: to.getFullYear() + "年" + (to.getMonth() + 1) + "月" + to.getDate() + "日"
    };
  }

  function fmt(value, digits) {
    if (value == null || value === "" || value === "--") {
      return "--";
    }
    const n = Number(value);
    if (Number.isNaN(n)) {
      return String(value);
    }
    return n.toLocaleString("zh-CN", {
      minimumFractionDigits: digits || 0,
      maximumFractionDigits: digits == null ? 2 : digits
    });
  }

  function fmtInt(value) {
    if (value == null || value === "" || value === "--" || value === "—") {
      return "--";
    }
    const n = Number(String(value).replace(/,/g, ""));
    if (Number.isNaN(n)) {
      return String(value);
    }
    return Math.round(n).toLocaleString("zh-CN");
  }

  function fmtHeroMoney(value) {
    if (value == null || value === "" || value === "--" || value === "—") {
      return "--";
    }
    const n = Number(String(value).replace(/,/g, ""));
    if (Number.isNaN(n)) {
      return String(value);
    }
    return n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function pct(value) {
    if (value == null || Number.isNaN(Number(value))) {
      return "--";
    }
    const n = Number(value);
    return ((n > 1 ? n : n * 100)).toFixed(2) + "%";
  }

  function cardOf(cards, key) {
    return (cards || []).find(function (card) {
      return card.key === key;
    }) || {};
  }

  function asNum(value) {
    if (value == null || value === "" || value === "--" || value === "—") {
      return null;
    }
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
  }

  function firstNum(obj, keys) {
    if (!obj) {
      return null;
    }
    for (let i = 0; i < keys.length; i += 1) {
      const n = asNum(obj[keys[i]]);
      if (n != null) {
        return n;
      }
    }
    return null;
  }

  function sumField(rows, keys) {
    let total = 0;
    let ok = false;
    (rows || []).forEach(function (row) {
      const n = firstNum(row, keys);
      if (n != null) {
        total += n;
        ok = true;
      }
    });
    return ok ? total : null;
  }

  function shopRateText(shop, fields, fallback, digits) {
    const n = firstNum(shop, fields);
    const raw = n != null ? n : fallback;
    if (raw == null) {
      return (digits === 4 ? "0.0000" : "0.00") + "%";
    }
    const pctn = Number(raw) > 1 ? Number(raw) : Number(raw) * 100;
    return pctn.toFixed(digits == null ? 2 : digits) + "%";
  }

  function shopColCell(shop, col) {
    const pay = Number(shop.payAmount) || 0;
    const refund = Number(shop.refundAmount) || 0;
    const profit = firstNum(shop, ["profit"]) != null ? firstNum(shop, ["profit"]) : 0;
    const promo =
      firstNum(shop, ["totalPromotionCost", "promotionCost"]) != null
        ? firstNum(shop, ["totalPromotionCost", "promotionCost"])
        : 0;
    if (col.key === "newRate") {
      return shopRateText(shop, col.fields, 0, 4);
    }
    if (col.key === "refundRate") {
      return shopRateText(shop, col.fields, pay ? refund / pay : 0, 2);
    }
    if (col.key === "adRate") {
      return shopRateText(shop, col.fields, pay ? promo / pay : 0, 2);
    }
    if (col.key === "margin") {
      return shopRateText(shop, col.fields, pay ? profit / pay : 0, 2);
    }
    if (col.key === "goodsCostRate") {
      const cost = firstNum(shop, ["goodsCost", "totalGoodsCost"]);
      return shopRateText(shop, col.fields, pay && cost != null ? cost / pay : 0, 2);
    }
    if (col.key === "netGoodsCostRate") {
      const cost = firstNum(shop, ["netGoodsCost"]);
      return shopRateText(shop, col.fields, pay && cost != null ? cost / pay : 0, 2);
    }
    if (col.key === "netSales") {
      const net = firstNum(shop, col.fields);
      return fmt(net != null ? net : pay - refund, 2);
    }
    if (col.kind === "int") {
      const count = firstNum(shop, col.fields);
      return fmt(count != null ? count : 0, 0);
    }
    const money = firstNum(shop, col.fields);
    return fmt(money != null ? money : 0, 2);
  }

  function sumShopTotals(list) {
    const tot = {};
    SHOP_COL_CATALOG.forEach(function (col) {
      if (col.kind === "money" || col.kind === "int") {
        tot[col.fields[0]] = 0;
      }
    });
    tot.payAmount = 0;
    tot.refundAmount = 0;
    tot.profit = 0;
    tot.totalPromotionCost = 0;
    (list || []).forEach(function (shop) {
      SHOP_COL_CATALOG.forEach(function (col) {
        if (col.kind !== "money" && col.kind !== "int") {
          return;
        }
        const n = firstNum(shop, col.fields);
        if (n != null) {
          tot[col.fields[0]] += n;
        }
      });
      tot.payAmount += Number(shop.payAmount) || 0;
      tot.refundAmount += Number(shop.refundAmount) || 0;
      tot.profit += Number(shop.profit) || 0;
      tot.totalPromotionCost += Number(shop.totalPromotionCost || shop.promotionCost) || 0;
    });
    tot.refundRate = tot.payAmount ? tot.refundAmount / tot.payAmount : 0;
    tot.profitRate = tot.payAmount ? tot.profit / tot.payAmount : 0;
    tot.promotionRate = tot.payAmount ? tot.totalPromotionCost / tot.payAmount : 0;
    tot.netSales = tot.netSales || tot.payAmount - tot.refundAmount;
    return tot;
  }

  function metricRow(shop, liveSales) {
    const pay = Number(shop.payAmount) || 0;
    const refund = Number(shop.refundAmount) || 0;
    const orders = Number(shop.orderCount) || 0;
    const netOrders = shop.netOrderCount != null ? Number(shop.netOrderCount) || 0 : 0;
    const live = liveSales != null ? liveSales : firstNum(shop, ["livePayAmount", "todayPayAmount", "realtimePayAmount", "payAmount"]);
    const invalid = firstNum(shop, ["invalidAmount", "invalidOrderAmount"]);
    const net = firstNum(shop, ["netSales", "netSalesAmount"]);
    const newRate = firstNum(shop, ["newRate"]);
    return [
      fmtInt(live != null ? live : 0),
      newRate != null ? (Number(newRate) * (Number(newRate) > 1 ? 1 : 100)).toFixed(4) + "%" : "0.0000%",
      fmt(orders, 0),
      fmt(netOrders, 0),
      fmtInt(pay),
      fmtInt(invalid != null ? invalid : 0),
      fmtInt(refund),
      pct(shop.refundRate != null ? shop.refundRate : pay ? refund / pay : 0),
      fmtInt(net != null ? net : pay - refund)
    ];
  }

  function mergeErpShops(metricShops, directory) {
    const metrics = metricShops || [];
    const byId = {};
    metrics.forEach(function (shop) {
      const id = String(shop.shopId || shop.id || "");
      if (id) {
        byId[id] = shop;
      }
    });
    const out = [];
    const seen = {};
    (directory || []).forEach(function (row) {
      const id = String(row.id || row.shopId || "");
      if (!id || seen[id]) {
        return;
      }
      seen[id] = true;
      const hit = byId[id] || {};
      out.push(Object.assign({}, row, hit, {
        shopId: id,
        shopName: hit.shopName || row.shopName
      }));
    });
    metrics.forEach(function (shop) {
      const id = String(shop.shopId || "");
      if (id && !seen[id]) {
        seen[id] = true;
        out.push(shop);
      }
    });
    return out;
  }

  function sameShopName(a, b) {
    return String(a || "").replace(/\s+/g, "") === String(b || "").replace(/\s+/g, "");
  }

  function personCoversShop(person, shop) {
    const name = shop && shop.shopName;
    const shops = (person && person.visibleShops) || [];
    if (name && shops.some(function (item) { return sameShopName(item, name); })) {
      return true;
    }
    const oid = shop && shop.operatorId != null ? String(shop.operatorId) : "";
    return Boolean(oid && person && String(person.id) === oid);
  }

  function shopDutyFlags(shop, people) {
    const flags = { 经理组: false, 主管组: false, 储备组: false };
    const reserves = {};
    (people || []).forEach(function (person) {
      const name = String((person && person.reserve) || "").trim();
      if (name && name !== "无") {
        reserves[name] = true;
      }
    });
    (people || []).forEach(function (person) {
      if (!personCoversShop(person, shop)) {
        return;
      }
      const role = String(person.role || "");
      if (role === "经理") {
        flags.经理组 = true;
      }
      if (role === "主管") {
        flags.主管组 = true;
      }
      const reserve = String(person.reserve || "").trim();
      if (role === "储备" || reserves[person.name] || (reserve && reserve !== "无")) {
        flags.储备组 = true;
      }
    });
    return flags;
  }

  function dutyTableFrom(shops, people) {
    const list = shops || [];
    const keys = loadShopColKeys();
    const cols = keys.map(shopColOf);
    const tot = sumShopTotals(list);
    const rows = [{
      name: "当页汇总",
      kind: "sum",
      profit: firstNum(tot, ["profit"]),
      cells: cols.map(function (col) {
        return shopColCell(tot, col);
      })
    }];
    DUTY_GROUPS.forEach(function (group) {
      const members = list.filter(function (shop) {
        return shopDutyFlags(shop, people)[group];
      });
      const sum = sumShopTotals(members);
      rows.push({
        name: group,
        kind: "group",
        profit: firstNum(sum, ["profit"]),
        cells: cols.map(function (col) {
          return shopColCell(sum, col);
        })
      });
    });
    return {
      title: "店铺分组",
      columns: ["责权分组"].concat(cols.map(function (col) {
        return col.label;
      })),
      rows: rows
    };
  }

  function shopTableFrom(shops) {
    const list = shops || [];
    const keys = loadShopColKeys();
    const cols = keys.map(shopColOf);
    const tot = sumShopTotals(list);
    return {
      title: "店铺列表",
      columns: ["店铺"].concat(cols.map(function (col) {
        return col.label;
      })),
      rows: [{ name: "当页汇总", kind: "sum", cells: cols.map(function (col) {
        return shopColCell(tot, col);
      }) }].concat(
        list.map(function (shop) {
          return {
            name: shop.shopName,
            kind: "shop",
            shopId: shop.shopId,
            profit: firstNum(shop, ["profit"]),
            cells: cols.map(function (col) {
              return shopColCell(shop, col);
            })
          };
        })
      )
    };
  }

  function fromErp(raw, rangeLabel, dateLabel) {
    const cardsIn = raw.cards || [];
    const shops = raw.shops || [];
    const trend = raw.trend || [];
    const dayRow = rangeLabel === "日" ? pickYesterdayRow(trend) : null;
    const pay = dayRow && asNum(dayRow.payAmount) != null
      ? asNum(dayRow.payAmount)
      : asNum(cardOf(cardsIn, "payAmount").value) != null ? asNum(cardOf(cardsIn, "payAmount").value) : sumField(shops, ["payAmount"]) || 0;
    const orders = dayRow && asNum(dayRow.orderCount) != null
      ? asNum(dayRow.orderCount)
      : asNum(cardOf(cardsIn, "orderCount").value) != null ? asNum(cardOf(cardsIn, "orderCount").value) : sumField(shops, ["orderCount"]) || 0;
    const profit = dayRow && asNum(dayRow.profit) != null
      ? asNum(dayRow.profit)
      : asNum(cardOf(cardsIn, "profit").value) != null ? asNum(cardOf(cardsIn, "profit").value) : sumField(shops, ["profit"]) || 0;
    const refund = dayRow && asNum(dayRow.refundAmount) != null
      ? asNum(dayRow.refundAmount)
      : asNum(cardOf(cardsIn, "refundAmount").value) != null ? asNum(cardOf(cardsIn, "refundAmount").value) : sumField(shops, ["refundAmount"]) || 0;
    const netOrders = dayRow ? orders : (sumField(shops, ["netOrderCount"]) != null ? sumField(shops, ["netOrderCount"]) : orders);
    const promo = dayRow && asNum(dayRow.promotionCost) != null
      ? asNum(dayRow.promotionCost)
      : sumField(shops, ["totalPromotionCost", "promotionCost"]) != null
        ? sumField(shops, ["totalPromotionCost", "promotionCost"])
        : sumField(trend, ["promotionCost"]);
    const last = dayRow || trend[trend.length - 1] || {};
    const prev = (function () {
      const idx = trend.indexOf(last);
      if (idx > 0) {
        return trend[idx - 1];
      }
      return trend[trend.length - 2] || last;
    })();
    const lastPay = asNum(last.payAmount);
    const prevPay = asNum(prev.payAmount);
    const heroVal = lastPay != null ? lastPay : pay;
    const todayRow = trend.find(function (row) {
      return row && row.date === shanghaiYmd(0);
    });
    const todayPay = todayRow && asNum(todayRow.payAmount);
    const seeded = seedHeroCompare(heroVal, todayPay);
    const margin = pay ? profit / pay : null;
    const refundRate = pay ? refund / pay : null;
    const promoRate = pay && promo != null ? promo / pay : null;
    const customFee = sumField(shops, ["customFee"]);
    const shopCount = Number(raw.shopTotal) || shops.length;
    const channelCells = metricRow(
      {
        payAmount: pay,
        orderCount: orders,
        netOrderCount: netOrders,
        refundAmount: refund,
        refundRate: refundRate,
        invalidAmount: firstNum(raw, ["invalidAmount"]) != null ? firstNum(raw, ["invalidAmount"]) : sumField(shops, ["invalidAmount", "invalidOrderAmount"]),
        netSales: firstNum(raw, ["netSales", "netSalesAmount"]) != null ? firstNum(raw, ["netSales", "netSalesAmount"]) : sumField(shops, ["netSales", "netSalesAmount"])
      },
      heroVal
    );
    return {
      ok: true,
      source: raw.source || "xingmai-erp",
      title: "数据总览",
      range: rangeLabel,
      dateLabel: dateLabel,
      ranges: RANGES,
      summary: { channels: 1, shops: shopCount },
      hero: {
        label: "实时销售指数",
        value: fmtInt(todayPay != null ? todayPay : 0),
        todayPay: todayPay,
        yestPay: heroVal,
        delta: seeded.delta,
        yesterday: seeded.yesterday,
        today: seeded.today
      },
      cards: [
        { key: "pay", label: "支付金额 (支付)", value: fmtInt(pay) },
        { key: "orders", label: "销售单数 (支付)", value: fmt(netOrders, 0) },
        { key: "ad", label: "推广花费 (支付预估)", value: fmtInt(promo), extra: "推广花费占比 " + pct(promoRate) },
        { key: "profit", label: "利润 (支付预估)", value: fmtInt(profit), extra: "毛利率 " + pct(margin) },
        { key: "margin", label: "大毛利率", value: pct(margin) },
        { key: "custom", label: "自定义费用", value: fmt(customFee != null ? customFee : 0, 0) },
        { key: "refundRate", label: "退款率 (按金额)", value: pct(refundRate) },
        { key: "adRate", label: "推广花费占比 (支付预估)", value: pct(promoRate) },
        {
          key: "netSales",
          label: "净销售额 (支付)",
          value: fmtInt(
            firstNum(raw, ["netSales", "netSalesAmount"]) != null
              ? firstNum(raw, ["netSales", "netSalesAmount"])
              : sumField(shops, ["netSales", "netSalesAmount"]) != null
                ? sumField(shops, ["netSales", "netSalesAmount"])
                : pay - refund
          )
        },
        { key: "refundAmount", label: "退款金额", value: fmtInt(refund) },
        {
          key: "platformFee",
          label: "平台花费 (支付预估)",
          value: fmtInt(
            firstNum(raw, ["platformFee", "platformCost"]) != null
              ? firstNum(raw, ["platformFee", "platformCost"])
              : sumField(shops, ["platformFee", "platformCost"]) != null
                ? sumField(shops, ["platformFee", "platformCost"])
                : 0
          )
        },
        {
          key: "goodsCost",
          label: "总货品成本",
          value: fmtInt(
            firstNum(raw, ["goodsCost", "totalGoodsCost"]) != null
              ? firstNum(raw, ["goodsCost", "totalGoodsCost"])
              : sumField(shops, ["goodsCost", "totalGoodsCost"]) != null
                ? sumField(shops, ["goodsCost", "totalGoodsCost"])
                : 0
          )
        },
        {
          key: "saleFee",
          label: "销售费用 (支付预估)",
          value: fmtInt(
            firstNum(raw, ["saleFee", "salesFee"]) != null
              ? firstNum(raw, ["saleFee", "salesFee"])
              : sumField(shops, ["saleFee", "salesFee"]) != null
                ? sumField(shops, ["saleFee", "salesFee"])
                : 0
          )
        },
        {
          key: "jdWarehouseRate",
          label: "京仓订单占比",
          value: pct(
            firstNum(raw, ["jdWarehouseRate"]) != null
              ? firstNum(raw, ["jdWarehouseRate"])
              : sumField(shops, ["jdWarehouseRate"]) != null
                ? sumField(shops, ["jdWarehouseRate"])
                : 0
          )
        },
        {
          key: "netGoodsCostRate",
          label: "净货品成本占比 (支付)",
          value: pct(
            firstNum(raw, ["netGoodsCostRate"]) != null
              ? firstNum(raw, ["netGoodsCostRate"])
              : sumField(shops, ["netGoodsCostRate"]) != null
                ? sumField(shops, ["netGoodsCostRate"])
                : 0
          )
        },
        {
          key: "invalidAmount",
          label: "无效单金额",
          value: fmtInt(
            firstNum(raw, ["invalidAmount"]) != null
              ? firstNum(raw, ["invalidAmount"])
              : sumField(shops, ["invalidAmount", "invalidOrderAmount"]) != null
                ? sumField(shops, ["invalidAmount", "invalidOrderAmount"])
                : 0
          )
        },
        {
          key: "jdWarehouseCount",
          label: "京仓订单数量",
          value: fmt(
            firstNum(raw, ["jdWarehouseCount"]) != null
              ? firstNum(raw, ["jdWarehouseCount"])
              : sumField(shops, ["jdWarehouseCount"]) != null
                ? sumField(shops, ["jdWarehouseCount"])
                : 0,
            0
          )
        }
      ],
      sections: SECTIONS,
      shops: shops,
      channelTable: {
        title: "渠道列表",
        columns: ["渠道"].concat(TABLE_COLS),
        rows: [
          { name: "汇总", kind: "sum", cells: channelCells },
          { name: "京东", kind: "jd", cells: channelCells }
        ]
      },
      shopTable: shopTableFrom(shops)
    };
  }

  function asSeries(list) {
    return (list || []).map(function (n) {
      return Number(n) || 0;
    });
  }

  function ensureHeroSeries(hero) {
    if (!hero) {
      return hero;
    }
    let yest = asSeries(hero.yesterday);
    let today = asSeries(hero.today && hero.today.length ? hero.today : hero.spark);
    if (!yest.length || !today.length) {
      const yestTotal = yest.length ? yest[yest.length - 1] : Number(hero.yestPay) || 0;
      const todayTotal = today.length
        ? today[today.length - 1]
        : hero.todayPay != null
          ? Number(hero.todayPay) || 0
          : 0;
      const seeded = seedHeroCompare(yestTotal, todayTotal);
      if (!yest.length) {
        yest = seeded.yesterday;
      }
      if (!today.length) {
        today = seeded.today;
      }
      if (hero.delta == null || hero.delta === 0) {
        hero.delta = seeded.delta;
      }
    }
    if (hero.todayPay != null) {
      hero.value = fmtHeroMoney(hero.todayPay);
    }
    hero.yesterday = yest;
    hero.today = today;
    return hero;
  }

  function hourList(list, keyed) {
    if (list && list.length) {
      return list.map(function (n) {
        return Number(n) || 0;
      });
    }
    if (!keyed || typeof keyed !== "object") {
      return [];
    }
    const out = [];
    let h = 0;
    for (h = 0; h < 24; h += 1) {
      const key = (h < 10 ? "0" : "") + h + ":00";
      out.push(Number(keyed[key]) || 0);
    }
    return out;
  }

  function padHours(list, slots) {
    const out = (list || []).map(function (n) {
      return Number(n) || 0;
    });
    while (out.length < (slots || 24)) {
      out.push(0);
    }
    return out.slice(0, slots || 24);
  }

  function cumulativeHours(list) {
    const out = [];
    let sum = 0;
    (list || []).forEach(function (n) {
      sum += Number(n) || 0;
      out.push(sum);
    });
    return out;
  }

  function todayHours(list) {
    return padHours(list, 24).slice(0, Math.min(24, shanghaiHour() + 1));
  }

  function heroFromErpPaid(data) {
    if (!data || !data.ok) {
      return null;
    }
    const sum = data.summary || {};
    const hourly = data.hourly || {};
    const todayPay = asNum(sum.todayPayAmount != null ? sum.todayPayAmount : sum.payAmount);
    const yestPay = asNum(sum.yesterdayPayAmount);
    if (todayPay == null) {
      return null;
    }
    const rawToday = hourList(hourly.todayPay, sum.todayHourlyData);
    const rawYest = hourList(hourly.yesterdayPay, sum.yesterdayHourlyData);
    const hasHourly = rawToday.length > 2;
    const todayH = hasHourly ? todayHours(rawToday) : rawToday;
    const yestH = hasHourly ? padHours(rawYest, 24) : rawYest;
    const delta = yestPay ? Number((((todayPay - yestPay) / Math.abs(yestPay)) * 100).toFixed(2)) : 0;
    return {
      label: "实时销售指数",
      value: fmtHeroMoney(todayPay),
      todayPay: todayPay,
      yestPay: yestPay,
      delta: delta,
      yesterdayHour: hasHourly ? yestH : [],
      todayHour: hasHourly ? todayH : [],
      yesterday: cumulativeHours(yestH),
      today: cumulativeHours(todayH)
    };
  }

  function compareSpark() {
    return '<svg class="ch-spark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 72" preserveAspectRatio="none" aria-hidden="true"></svg>';
  }

  function paintSparkSvg(svg, hero) {
    if (!svg) {
      return;
    }
    const yest = asSeries(hero && hero.yesterday);
    const today = asSeries(hero && hero.today);
    const w = 240;
    const h = 72;
    const padX = 4;
    const padY = 8;
    let max = 1;
    yest.concat(today).forEach(function (n) {
      if (n > max) {
        max = n;
      }
    });
    const steps = 23;
    const nowT = Math.min(23, shanghaiHour() + shanghaiMinute() / 60);
    const nowX = padX + (nowT / steps) * (w - padX * 2);
    const ns = "http://www.w3.org/2000/svg";
    function xy(i, n) {
      return {
        x: padX + (i / steps) * (w - padX * 2),
        y: h - padY - (n / max) * (h - padY * 2)
      };
    }
    function add(name, attrs) {
      const el = document.createElementNS(ns, name);
      Object.keys(attrs).forEach(function (key) {
        el.setAttribute(key, attrs[key]);
      });
      svg.appendChild(el);
      return el;
    }
    function linePts(list) {
      return list
        .map(function (n, i) {
          const p = xy(i, n);
          return p.x.toFixed(1) + "," + p.y.toFixed(1);
        })
        .join(" ");
    }
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }
    add("rect", { x: "0", y: "0", width: nowX.toFixed(1), height: String(h), fill: "#f5f5f5" });
    add("rect", {
      x: nowX.toFixed(1),
      y: "0",
      width: Math.max(0, w - nowX).toFixed(1),
      height: String(h),
      fill: "#f0f5ff"
    });
    if (yest.length) {
      add("polyline", {
        fill: "none",
        stroke: "#2f54eb",
        "stroke-width": "2",
        "stroke-linejoin": "round",
        "stroke-linecap": "round",
        points: linePts(yest)
      });
    }
    if (today.length) {
      add("polyline", {
        fill: "none",
        stroke: "#cf1322",
        "stroke-width": "2",
        "stroke-linejoin": "round",
        "stroke-linecap": "round",
        points: linePts(today)
      });
    }
  }

  function attachLiveHero(hero, live) {
    const src = (live && live.hero) || live || {};
    const yest = asSeries(src.yesterday);
    const today = asSeries(src.today && src.today.length ? src.today : src.spark);
    if (!yest.length && !today.length) {
      if (hero.todayPay != null) {
        hero.value = fmtHeroMoney(hero.todayPay);
      }
      return ensureHeroSeries(hero);
    }
    hero.yesterday = yest;
    hero.today = today;
    if (src.value) {
      hero.value = fmtHeroMoney(src.value);
    } else if (today.length) {
      hero.value = fmtHeroMoney(today[today.length - 1]);
    }
    if (yest.length && today.length) {
      const idx = Math.min(today.length, yest.length) - 1;
      const now = today[today.length - 1];
      const then = yest[idx];
      if (then) {
        hero.delta = Number((((now - then) / Math.abs(then)) * 100).toFixed(2));
      }
    } else if (src.delta != null) {
      hero.delta = Number(src.delta) || 0;
    }
    return ensureHeroSeries(hero);
  }

  function nameCell(row) {
    const kind = row.kind || "";
    const mark =
      kind === "jd"
        ? '<span class="ch-logo ch-logo-jd" aria-hidden="true">京</span>'
        : kind === "shop"
          ? '<span class="ch-logo" style="background:#e53935" aria-hidden="true"></span>'
          : "";
    return (
      '<td class="ch-name"><span class="ch-bar"></span>' +
      mark +
      "<span>" +
      escapeHtml(row.name) +
      "</span></td>"
    );
  }

  function toolButtons() {
    return (
      '<div class="ch-tools">' +
      '<button type="button" disabled>打标</button>' +
      '<button type="button" disabled>目标</button>' +
      '<button type="button" class="is-on" disabled>列表</button>' +
      '<button type="button" disabled>周期</button>' +
      '<button type="button" disabled>图表</button>' +
      '<button type="button" disabled>个人默认视图</button>' +
      '<button type="button" disabled>更多数据</button>' +
      '<button type="button" disabled>导出</button></div>'
    );
  }

  function tableHtml(block, extraLeft, extraClass, showPl) {
    const isShop = extraClass && String(extraClass).indexOf("sh-wide") >= 0;
    const head =
      "<tr>" +
      (block.columns || [])
        .map(function (col) {
          return "<th>" + escapeHtml(col) + " <i></i></th>";
        })
        .join("") +
      "</tr>";
    const body = (block.rows || [])
      .map(function (row) {
        let cls = "";
        if (showPl && row.kind === "shop") {
          const raw = row.profit;
          const n = Number(raw);
          if (raw != null && raw !== "" && Number.isFinite(n) && n > 0) {
            cls = ' class="is-gain"';
          } else if (raw != null && raw !== "" && Number.isFinite(n) && n < 0) {
            cls = ' class="is-loss"';
          }
        }
        return (
          "<tr" +
          cls +
          ">" +
          nameCell(row) +
          (row.cells || [])
            .map(function (cell) {
              if (cell && typeof cell === "object" && cell.html) {
                return "<td>" + cell.html + "</td>";
              }
              return "<td>" + escapeHtml(cell) + "</td>";
            })
            .join("") +
          "</tr>"
        );
      })
      .join("");
    return (
      '<section class="ch-table' +
      (extraClass ? " " + extraClass : "") +
      (isShop && showPl ? " is-pl" : "") +
      '">' +
      '<div class="ch-table-bar"><strong>' +
      escapeHtml(block.title) +
      "</strong>" +
      (extraLeft || "") +
      (isShop
        ? '<label class="ch-zero"><input type="checkbox" data-show-pl' +
          (showPl ? " checked" : "") +
          " /> 显示盈亏</label>"
        : "") +
      toolButtons() +
      "</div>" +
      '<div class="ch-table-wrap"><table><thead>' +
      head +
      "</thead><tbody>" +
      body +
      "</tbody></table></div></section>"
    );
  }

  function inclusiveDays(from, to) {
    const a = Date.parse(from + "T00:00:00+08:00");
    const b = Date.parse(to + "T00:00:00+08:00");
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      return 0;
    }
    return Math.round(Math.abs(b - a) / 86400000) + 1;
  }

  function shiftMonth(year, month, delta) {
    const next = new Date(year, month + delta, 1);
    return { year: next.getFullYear(), month: next.getMonth() };
  }

  function monthCells(year, month) {
    const first = new Date(year, month, 1);
    let lead = first.getDay();
    lead = lead === 0 ? 6 : lead - 1;
    const days = new Date(year, month + 1, 0).getDate();
    const cells = [];
    const prevDays = new Date(year, month, 0).getDate();
    for (let i = lead; i > 0; i -= 1) {
      const dt = new Date(year, month, 1 - i);
      cells.push({ y: dt.getFullYear(), m: dt.getMonth(), d: dt.getDate(), out: true });
    }
    for (let d = 1; d <= days; d += 1) {
      cells.push({ y: year, m: month, d: d, out: false });
    }
    while (cells.length < 42) {
      const dt = new Date(year, month, days + (cells.length - lead - days) + 1);
      cells.push({ y: dt.getFullYear(), m: dt.getMonth(), d: dt.getDate(), out: true });
    }
    return cells;
  }

  function dayOverLimit(from, to, value) {
    return Boolean(from && !to && inclusiveDays(from, value) > 30);
  }

  function calendarMonthHtml(year, month, from, to, today, side) {
    const week =
      "<tr>" +
      ["一", "二", "三", "四", "五", "六", "日"]
        .map(function (name) {
          return "<th>" + name + "</th>";
        })
        .join("") +
      "</tr>";
    const cells = monthCells(year, month);
    let rows = "";
    for (let i = 0; i < cells.length; i += 7) {
      rows +=
        "<tr>" +
        cells
          .slice(i, i + 7)
          .map(function (cell) {
            const value = cell.y + "-" + pad(cell.m + 1) + "-" + pad(cell.d);
            const future = value > today;
            const over = dayOverLimit(from, to, value);
            const blocked = future || over;
            const cls = [
              cell.out ? "is-out" : "",
              future ? "is-future" : "",
              over ? "is-over" : "",
              !blocked && value === today ? "is-today" : "",
              from && to && value >= from && value <= to ? "is-in" : "",
              value === from ? "is-start" : "",
              value === to ? "is-end" : ""
            ]
              .filter(Boolean)
              .join(" ");
            return (
              "<td><button type=\"button\" data-day=\"" +
              value +
              "\"" +
              (blocked ? " disabled" : "") +
              (cls ? ' class="' + cls + '"' : "") +
              ">" +
              cell.d +
              "</button></td>"
            );
          })
          .join("") +
        "</tr>";
    }
    const leftNav =
      side === "left"
        ? '<button type="button" data-cal="prev-year" aria-label="上一年">«</button><button type="button" data-cal="prev-month" aria-label="上一月">‹</button>'
        : "";
    const rightNav =
      side === "right"
        ? '<button type="button" data-cal="next-month" aria-label="下一月">›</button><button type="button" data-cal="next-year" aria-label="下一年">»</button>'
        : "";
    return (
      '<div class="ch-cal-month"><div class="ch-cal-head">' +
      leftNav +
      "<strong>" +
      year +
      "年" +
      (month + 1) +
      "月</strong>" +
      rightNav +
      "</div><table><thead>" +
      week +
      "</thead><tbody class=\"ch-cal-days\">" +
      rows +
      "</tbody></table></div>"
    );
  }

  function calendarPanel(state) {
    const today = shanghaiYmd(0);
    const left = { year: state.calYear, month: state.calMonth };
    const right = shiftMonth(state.calYear, state.calMonth, 1);
    return (
      '<div class="ch-cal" data-calendar="1">' +
      calendarMonthHtml(left.year, left.month, state.customFrom, state.customTo, today, "left") +
      calendarMonthHtml(right.year, right.month, state.customFrom, state.customTo, today, "right") +
      "</div>"
    );
  }

  function createDashboard(root) {
    ensureCss();
    stripPageChrome(root);
    let board = root.querySelector("#board");
    if (!board) {
      root.innerHTML = '<main class="xm-page data-overview-root ch-root"><div id="board"><p class="ch-empty">正在加载数据总览…</p></div></main>';
      board = root.querySelector("#board");
    } else if (!board.innerHTML.trim()) {
      board.innerHTML = '<p class="ch-empty">正在加载数据总览…</p>';
    }
    const state = {
      range: "日",
      customFrom: "",
      customTo: "",
      shopId: "",
      shopIds: null,
      shopPickOpen: false,
      showPl: false,
      people: [],
      section: "渠道列表",
      payload: null,
      calOpen: false,
      calYear: Number(shanghaiYmd(0).slice(0, 4)),
      calMonth: Number(shanghaiYmd(0).slice(5, 7)) - 1,
      pickOpen: false,
      pickKind: "metrics",
      pickDraft: loadMetricKeys(),
      pickQuery: "",
      pickDrag: ""
    };
    let dead = false;
    let tipEl = null;
    let shopMenuScroll = 0;

    function hideMetricTip() {
      if (tipEl) {
        tipEl.classList.remove("is-on");
        tipEl.textContent = "";
      }
    }

    function showMetricTip(anchor) {
      const raw = String((anchor && anchor.getAttribute("data-tip")) || "").replace(/&#10;/g, "\n");
      if (!raw) {
        return;
      }
      if (!tipEl || !document.body.contains(tipEl)) {
        tipEl = document.createElement("div");
        tipEl.className = "ch-tip";
        document.body.appendChild(tipEl);
      }
      tipEl.textContent = raw;
      tipEl.classList.add("is-on");
      const box = anchor.getBoundingClientRect();
      const tw = tipEl.offsetWidth || 280;
      const th = tipEl.offsetHeight || 80;
      let left = Math.max(8, Math.min(box.right - tw, window.innerWidth - tw - 8));
      let top = box.bottom + 8;
      if (top + th > window.innerHeight - 8 && box.top - th - 8 >= 8) {
        top = box.top - th - 8;
      }
      if (top < 8) {
        top = 8;
      }
      tipEl.style.left = Math.round(left) + "px";
      tipEl.style.top = Math.round(top) + "px";
    }

    function pickerRoot() {
      let el = document.getElementById("ch-mpick-root");
      if (!el) {
        el = document.createElement("div");
        el.id = "ch-mpick-root";
        document.body.appendChild(el);
        el.addEventListener("click", onPickClick);
        el.addEventListener("input", onPickInput);
        el.addEventListener("change", onPickChange);
        el.addEventListener("dragstart", onPickDragStart);
        el.addEventListener("dragover", onPickDragOver);
        el.addEventListener("drop", onPickDrop);
      }
      return el;
    }

    function closePicker() {
      state.pickOpen = false;
      state.pickQuery = "";
      const el = document.getElementById("ch-mpick-root");
      if (el) {
        el.innerHTML = "";
      }
    }

    function pickCatalog() {
      return state.pickKind === "cols" ? SHOP_COL_CATALOG : METRIC_CATALOG;
    }

    function pickItemOf(key) {
      return state.pickKind === "cols" ? shopColOf(key) : metricOf(key);
    }

    function pickTitle() {
      return state.pickKind === "cols" ? "设定表头" : "设定指标";
    }

    function openPicker() {
      state.pickKind = "metrics";
      state.pickOpen = true;
      state.pickDraft = loadMetricKeys().slice();
      state.pickQuery = "";
      paintPicker(true);
    }

    function openColPicker() {
      state.pickKind = "cols";
      state.pickOpen = true;
      state.pickDraft = loadShopColKeys().slice();
      state.pickQuery = "";
      paintPicker(true);
    }

    function pickerGridHtml() {
      const selected = {};
      state.pickDraft.forEach(function (key) {
        selected[key] = true;
      });
      const q = String(state.pickQuery || "").trim();
      return pickCatalog().filter(function (item) {
        return !q || item.label.indexOf(q) >= 0;
      })
        .map(function (item) {
          return (
            '<label class="ch-mpick-opt"><input type="checkbox" data-mpick-key="' +
            escapeHtml(item.key) +
            '"' +
            (selected[item.key] ? " checked" : "") +
            "> " +
            escapeHtml(item.label) +
            "</label>"
          );
        })
        .join("");
    }

    function pickerSelHtml() {
      return state.pickDraft
        .map(function (key) {
          const item = pickItemOf(key);
          return (
            '<div class="ch-mpick-item" draggable="true" data-mpick-drag="' +
            escapeHtml(item.key) +
            '"><i class="ch-mpick-handle"></i>' +
            escapeHtml(item.label) +
            "</div>"
          );
        })
        .join("");
    }

    function paintPicker(force) {
      const el = pickerRoot();
      if (!state.pickOpen) {
        el.innerHTML = "";
        return;
      }
      const n = state.pickDraft.length;
      const tot = pickCatalog().length;
      if (force || !el.querySelector(".ch-mpick")) {
        el.innerHTML =
          '<div class="ch-mpick-mask" data-mpick-mask>' +
          '<div class="ch-mpick" role="dialog" aria-label="' +
          pickTitle() +
          '">' +
          '<div class="ch-mpick-head"><span data-mpick-title>' +
          pickTitle() +
          "（" +
          n +
          "/" +
          tot +
          '）</span><button type="button" class="ch-mpick-x" data-mpick="close" aria-label="关闭">×</button></div>' +
          '<div class="ch-mpick-body"><div class="ch-mpick-left">' +
          '<div class="ch-mpick-search"><input data-mpick-q type="search" placeholder="请输入关键字" value="' +
          escapeHtml(state.pickQuery) +
          '"></div>' +
          '<div class="ch-mpick-grid">' +
          pickerGridHtml() +
          "</div></div>" +
          '<aside class="ch-mpick-right"><div class="ch-mpick-right-top"><span data-mpick-count>已选' +
          n +
          "/" +
          tot +
          '</span><button type="button" data-mpick="clear">清空</button></div>' +
          '<p class="ch-mpick-hint">拖动以下字段进行排序</p>' +
          '<div class="ch-mpick-sel">' +
          pickerSelHtml() +
          "</div></aside></div>" +
          '<footer class="ch-mpick-foot"><button type="button" class="ch-mpick-ok" data-mpick="ok">确定</button>' +
          '<button type="button" data-mpick="cancel">取消</button></footer></div></div>';
        return;
      }
      const title = el.querySelector("[data-mpick-title]");
      const count = el.querySelector("[data-mpick-count]");
      const grid = el.querySelector(".ch-mpick-grid");
      const sel = el.querySelector(".ch-mpick-sel");
      if (title) {
        title.textContent = pickTitle() + "（" + n + "/" + tot + "）";
      }
      if (count) {
        count.textContent = "已选" + n + "/" + tot;
      }
      if (grid) {
        grid.innerHTML = pickerGridHtml();
      }
      if (sel) {
        sel.innerHTML = pickerSelHtml();
      }
    }

    function onPickClick(event) {
      const actEl = event.target.closest("[data-mpick]");
      const act = actEl ? actEl.getAttribute("data-mpick") : "";
      if (event.target.hasAttribute("data-mpick-mask") || act === "close" || act === "cancel") {
        closePicker();
        return;
      }
      if (act === "clear") {
        state.pickDraft = [];
        paintPicker();
        return;
      }
      if (act === "ok") {
        if (state.pickKind === "cols") {
          saveShopColKeys(state.pickDraft.slice());
        } else {
          saveMetricKeys(state.pickDraft.slice());
          saveBoardOrder(loadBoardOrder(state.pickDraft.slice()));
        }
        closePicker();
        render();
      }
    }

    function onPickInput(event) {
      if (!event.target.matches("[data-mpick-q]")) {
        return;
      }
      state.pickQuery = event.target.value;
      const grid = pickerRoot().querySelector(".ch-mpick-grid");
      if (grid) {
        grid.innerHTML = pickerGridHtml();
      }
    }

    function onPickChange(event) {
      const box = event.target.closest("[data-mpick-key]");
      if (!box) {
        return;
      }
      const key = box.getAttribute("data-mpick-key");
      const idx = state.pickDraft.indexOf(key);
      if (box.checked && idx < 0) {
        state.pickDraft.push(key);
      } else if (!box.checked && idx >= 0) {
        state.pickDraft.splice(idx, 1);
      }
      paintPicker();
    }

    function onPickDragStart(event) {
      const row = event.target.closest("[data-mpick-drag]");
      if (!row) {
        return;
      }
      state.pickDrag = row.getAttribute("data-mpick-drag");
      event.dataTransfer.effectAllowed = "move";
    }

    function onPickDragOver(event) {
      if (event.target.closest("[data-mpick-drag]")) {
        event.preventDefault();
      }
    }

    function onPickDrop(event) {
      const row = event.target.closest("[data-mpick-drag]");
      if (!row || !state.pickDrag) {
        return;
      }
      event.preventDefault();
      const from = state.pickDraft.indexOf(state.pickDrag);
      const to = state.pickDraft.indexOf(row.getAttribute("data-mpick-drag"));
      if (from < 0 || to < 0 || from === to) {
        return;
      }
      const next = state.pickDraft.slice();
      const moved = next.splice(from, 1)[0];
      next.splice(to, 0, moved);
      state.pickDraft = next;
      state.pickDrag = "";
      paintPicker();
    }

    function allShopIds(payload) {
      return ((payload && payload.shops) || []).map(function (shop) {
        return shop.shopId;
      }).filter(Boolean);
    }

    function selectedShopIds(payload) {
      if (state.shopIds == null) {
        return allShopIds(payload);
      }
      return state.shopIds.slice();
    }

    function isAllShops(payload) {
      const all = allShopIds(payload);
      return state.shopIds == null || (all.length > 0 && state.shopIds.length === all.length);
    }

    function shopPickLabel(payload) {
      const shops = (payload && payload.shops) || [];
      const ids = selectedShopIds(payload);
      if (isAllShops(payload)) {
        return "全选";
      }
      if (!ids.length) {
        return "请选择店铺";
      }
      if (ids.length === 1) {
        const hit = shops.find(function (shop) {
          return shop.shopId === ids[0];
        });
        return hit ? hit.shopName : "已选1家";
      }
      return "已选" + ids.length + "家";
    }

    function shopMenuItemsHtml(payload) {
      const shops = (payload && payload.shops) || [];
      const ids = selectedShopIds(payload);
      const allOn = isAllShops(payload);
      return (
        '<label class="ch-shop-opt"><input type="checkbox" data-shop-all' +
        (allOn ? " checked" : "") +
        ">全选</label>" +
        shops
          .map(function (shop) {
            const on = allOn || ids.indexOf(shop.shopId) >= 0;
            return (
              '<label class="ch-shop-opt"><input type="checkbox" data-shop-id="' +
              escapeHtml(shop.shopId) +
              '"' +
              (on ? " checked" : "") +
              ">" +
              escapeHtml(shop.shopName) +
              "</label>"
            );
          })
          .join("")
      );
    }

    function shopPickHtml(payload) {
      return (
        '<div class="ch-shop-pick' +
        (state.shopPickOpen ? " is-open" : "") +
        '" data-shop-pick><button type="button" class="ch-shop-pick-btn" data-shop-pick-toggle>' +
        escapeHtml(shopPickLabel(payload)) +
        "</button></div>"
      );
    }

    function placeShopMenu() {
      const el = getShopMenu();
      const btn = board && board.querySelector("[data-shop-pick-toggle]");
      if (!btn) {
        return;
      }
      const box = btn.getBoundingClientRect();
      const width = Math.max(220, Math.round(box.width));
      let left = box.left;
      if (left + width > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - width - 8);
      }
      let top = box.bottom + 4;
      if (top + 160 > window.innerHeight && box.top > 180) {
        top = Math.max(8, box.top - 284);
      }
      el.style.left = Math.round(left) + "px";
      el.style.top = Math.round(top) + "px";
      el.style.minWidth = width + "px";
    }

    function syncShopMenu() {
      const el = getShopMenu();
      if (!state.shopPickOpen || !state.payload) {
        hideShopMenu();
        return;
      }
      el.innerHTML = shopMenuItemsHtml(state.payload);
      placeShopMenu();
      el.classList.add("is-open");
      el.scrollTop = shopMenuScroll;
    }

    function applyShopMenuChange(target) {
      if (!target || !target.matches) {
        return;
      }
      const menu = getShopMenu();
      shopMenuScroll = menu.scrollTop;
      if (target.matches("[data-shop-all]")) {
        state.shopIds = target.checked ? null : [];
        state.shopPickOpen = true;
        render();
        return;
      }
      if (target.matches("[data-shop-id]")) {
        const id = target.getAttribute("data-shop-id") || "";
        const all = allShopIds(state.payload);
        let cur = selectedShopIds(state.payload);
        if (target.checked) {
          if (cur.indexOf(id) < 0) {
            cur.push(id);
          }
        } else {
          cur = cur.filter(function (item) {
            return item !== id;
          });
        }
        state.shopIds = cur.length === all.length ? null : cur;
        state.shopId = cur.length === 1 ? cur[0] : "";
        state.shopPickOpen = true;
        render();
      }
    }

    function visibleShops(payload) {
      const shops = (payload && payload.shops) || [];
      if (isAllShops(payload)) {
        return shops;
      }
      const allow = {};
      selectedShopIds(payload).forEach(function (id) {
        allow[id] = true;
      });
      return shops.filter(function (shop) {
        return allow[shop.shopId];
      });
    }

    function filteredPayload() {
      const payload = state.payload;
      if (!payload) {
        return payload;
      }
      if (isAllShops(payload)) {
        return payload;
      }
      const allow = {};
      selectedShopIds(payload).forEach(function (id) {
        allow[id] = true;
      });
      const shopTable = payload.shopTable || {};
      const rows = (shopTable.rows || []).filter(function (row) {
        return row.kind === "sum" || allow[row.shopId];
      });
      return Object.assign({}, payload, {
        shopTable: Object.assign({}, shopTable, { rows: rows })
      });
    }

    function render() {
      if (dead || !state.payload || !board) {
        return;
      }
      const payload = filteredPayload();
      const hero = ensureHeroSeries(payload.hero || {});
      const down = Number(hero.delta) < 0;
      const selected = loadMetricKeys();
      const byKey = {};
      visibleCards(payload.cards, selected).forEach(function (card) {
        byKey[card.key] = card;
      });
      const cards = loadBoardOrder(selected)
        .map(function (key) {
          if (key === LIVE_KEY) {
            const sign =
              (Number(hero.delta || 0) > 0 ? "+" : Number(hero.delta || 0) < 0 ? "-" : "") +
              Math.abs(Number(hero.delta || 0)).toFixed(2);
            return (
              '<article class="ch-card ch-hero" data-card-key="' +
              LIVE_KEY +
              '"><div class="label"><span>实时销售指数<span class="ch-clock">' +
              escapeHtml(shanghaiHms()) +
              "</span></span>" +
              helpBtn(HERO_TIP) +
              '</div><div class="value">' +
              escapeHtml(/[.,]\d/.test(String(hero.value || "")) ? hero.value : fmtHeroMoney(hero.value)) +
              '</div><div class="delta ' +
              (down ? "is-down" : "is-up") +
              '">' +
              escapeHtml(sign) +
              "% " +
              (down ? "↓" : "↑") +
              "</div>" +
              compareSpark() +
              '<div class="ch-axis"><span>00</span><span>12</span><span>23</span></div></article>'
            );
          }
          const card = byKey[key];
          if (!card) {
            return "";
          }
          const tip = card.tip || metricOf(card.key).tip || "";
          return (
            '<article class="ch-card" data-card-key="' +
            escapeHtml(card.key) +
            '"><div class="label"><span>' +
            escapeHtml(card.label) +
            "</span>" +
            helpBtn(tip) +
            '</div><div class="value">' +
            escapeHtml(/%/.test(String(card.value || "")) ? card.value : fmtInt(card.value)) +
            '</div><div class="extra">' +
            (card.extra ? escapeHtml(card.extra) : "&nbsp;") +
            "</div></article>"
          );
        })
        .join("");
      const tabs = (payload.sections || SECTIONS)
        .map(function (name) {
          return (
            '<button type="button" data-section="' +
            escapeHtml(name) +
            '"' +
            (name === state.section ? ' class="is-active"' : "") +
            ">" +
            escapeHtml(name) +
            "</button>"
          );
        })
        .join("");
      const ranges = RANGES.map(function (label) {
        return (
          '<button type="button" data-range="' +
          escapeHtml(label) +
          '"' +
          (label === state.range ? ' class="is-active"' : "") +
          ">" +
          escapeHtml(label) +
          "</button>"
        );
      }).join("");
      const shopTools =
        shopPickHtml(state.payload) +
        '<button type="button" class="ch-set" data-shop-cols="open">设定表头</button>';
      const lists =
        state.section === "渠道列表"
          ? tableHtml(payload.channelTable) +
            tableHtml(payload.shopTable, shopTools, "sh-wide", state.showPl)
          : state.section === "店铺分组"
            ? tableHtml(
                dutyTableFrom(visibleShops(state.payload), state.people),
                shopTools,
                "sh-wide",
                state.showPl
              )
            : '<p class="ch-empty">「' + escapeHtml(state.section) + "」为示例，尚未接入。</p>";
      board.innerHTML =
        '<div class="ch-top"><div class="ch-title">数据总览</div>' +
        '<div class="ch-right"><span class="ch-time">（统计时间：' +
        escapeHtml(payload.dateLabel || "") +
        "）</span>" +
        '<div class="ch-cal-wrap"><div class="ch-ranges">' +
        ranges +
        "</div></div></div></div>" +
        '<div class="ch-summary"><span class="ch-sum-title">综合指标</span>' +
        '<span class="ch-pill">渠道' +
        escapeHtml(String(payload.summary.channels)) +
        "个</span>" +
        '<span class="ch-pill">店铺' +
        escapeHtml(String(payload.summary.shops)) +
        '个</span><button type="button" class="ch-set" data-metrics="open">设定指标</button></div>' +
        '<div class="ch-metrics">' +
        cards +
        "</div>" +
        '<div class="ch-split" aria-hidden="true"></div>' +
        '<div class="ch-tabs">' +
        tabs +
        "</div>" +
        lists;
      syncCalPop();
      if (state.pickOpen) {
        paintPicker();
      }
      paintSparkSvg(board.querySelector(".ch-hero .ch-spark"), hero);
      syncShopMenu();
    }

    function placeCalPop(anchor) {
      const pop = getCalPop();
      const box = anchor.getBoundingClientRect();
      const width = Math.min(560, window.innerWidth - 24);
      let left = box.right - width;
      if (left < 12) {
        left = 12;
      }
      let top = box.bottom + 6;
      if (top + 340 > window.innerHeight && box.top > 360) {
        top = Math.max(12, box.top - 346);
      }
      pop.style.left = left + "px";
      pop.style.top = top + "px";
      pop.style.width = width + "px";
    }

    function applyCalDay(day) {
      if (!state.customFrom || state.customTo) {
        state.customFrom = day;
        state.customTo = "";
        render();
        return;
      }
      if (inclusiveDays(state.customFrom, day) > 30) {
        return;
      }
      let from = state.customFrom;
      let to = day;
      if (to < from) {
        const swap = from;
        from = to;
        to = swap;
      }
      state.customFrom = from;
      state.customTo = to;
      state.calOpen = false;
      state.range = "自定义";
      hideCalPop();
      load();
    }

    function applyCalNav(act) {
      const moved = shiftMonth(
        state.calYear,
        state.calMonth,
        act === "prev-year" ? -12 : act === "next-year" ? 12 : act === "prev-month" ? -1 : 1
      );
      state.calYear = moved.year;
      state.calMonth = moved.month;
      render();
    }

    function onCalPopClick(event) {
      event.stopPropagation();
      const calNav = pathEl(event, "data-cal");
      if (calNav) {
        applyCalNav(calNav.getAttribute("data-cal"));
        return;
      }
      const dayBtn = pathEl(event, "data-day");
      if (dayBtn && !dayBtn.disabled) {
        applyCalDay(dayBtn.getAttribute("data-day"));
      }
    }

    function syncCalPop() {
      const pop = getCalPop();
      if (!state.calOpen) {
        hideCalPop();
        return;
      }
      pop.shadowRoot.innerHTML = "<style>" + CAL_SHADOW_CSS + "</style>" + calendarPanel(state);
      pop.classList.add("is-open");
      pop.style.width = "560px";
      pop.style.minWidth = "560px";
      const btn = board.querySelector('button[data-range="自定义"]');
      if (btn) {
        placeCalPop(btn);
      }
      pop.removeEventListener("click", onCalPopClick);
      pop.addEventListener("click", onCalPopClick);
    }

    function json(url) {
      return fetch(url, { credentials: "same-origin", headers: { Accept: "application/json" } }).then(function (res) {
        if (!res.ok) {
          throw new Error("接口 " + res.status);
        }
        return res.json();
      });
    }

    function paintErp(data, span) {
      state.payload = fromErp(data, state.range, span.dateLabel);
      render();
    }

    function applyCachedBoard(slot, span) {
      state.payload = cloneJson(slot.payload);
      if (state.payload) {
        state.payload.range = state.range;
        state.payload.dateLabel = span.dateLabel;
        state.payload.ranges = RANGES;
        if (state.payload.shops && state.payload.shops.length) {
          state.payload.shops = overlaySharedShopMetrics(state.payload.shops);
          state.payload.shopTable = shopTableFrom(state.payload.shops);
        }
        if (state.payload.hero && Number(state.payload.hero.todayPay) > 0) {
          state.payload.hero.value = fmtHeroMoney(state.payload.hero.todayPay);
        }
      }
      render();
    }

    function persistBoard(span) {
      writeOvBoard(state.range, span, state.payload);
    }

    function softJson(url) {
      return fetch(url, { credentials: "same-origin", headers: { Accept: "application/json" } })
        .then(function (res) {
          if (!res.ok) {
            return null;
          }
          return res.json();
        })
        .catch(function () {
          return null;
        });
    }

    function loadPeople() {
      return softJson("/api/people").then(function (pack) {
        if (dead) {
          return;
        }
        state.people = (pack && pack.people) || [];
        if (state.payload) {
          render();
        }
      });
    }

    function loadShopDirectory() {
      return softJson("/api/data/shop-options")
        .then(function (opt) {
          const recs = opt && (opt.records || opt.shops);
          if (recs && recs.length) {
            return recs;
          }
          return Promise.all([
            softJson("/api/data/shops?page=1&pageSize=50"),
            softJson("/api/data/shops?page=2&pageSize=50")
          ]).then(function (pages) {
            return pages.reduce(function (acc, pack) {
              return acc.concat((pack && pack.records) || []);
            }, []);
          });
        })
        .then(function (dir) {
          if (dead || !state.payload || !dir || !dir.length) {
            return;
          }
          const merged = overlaySharedShopMetrics(mergeErpShops(state.payload.shops, dir));
          state.payload.shops = merged;
          state.payload.summary.shops = merged.length;
          state.payload.shopTable = shopTableFrom(merged);
          persistBoard(rangeSpan(state.range, state.customFrom, state.customTo));
          render();
        });
    }

    function loadLiveSpark() {
      return Promise.all([
        softJson("/api/home/erp-paid"),
        softJson("/api/data/live"),
        softJson("/api/home/live")
      ]).then(function (pack) {
        if (dead || !state.payload || !state.payload.hero) {
          return;
        }
        const fromPaid = heroFromErpPaid(pack[0]);
        if (fromPaid) {
          state.payload.hero = Object.assign({}, state.payload.hero, fromPaid);
          render();
          return;
        }
        const live = pack.find(function (item) {
          return item && item.hero && ((item.hero.yesterday && item.hero.yesterday.length) || (item.hero.today && item.hero.today.length));
        });
        if (!live) {
          return;
        }
        attachLiveHero(state.payload.hero, live);
        render();
      });
    }

    function fetchBoard(span) {
      const params = new URLSearchParams();
      params.set("from", span.from + " 00:00:00");
      params.set("to", span.to + " 23:59:59");
      params.set("payTimeStart", span.from + " 00:00:00");
      params.set("payTimeEnd", span.to + " 23:59:59");
      return json("/api/data/overview?" + params.toString())
        .then(function (data) {
          if (dead) {
            return;
          }
          if (data && data.ok && (data.source === "xingmai-erp" || (data.shops && data.shops.length) || (data.cards || []).some(function (c) { return c.key === "payAmount"; }))) {
            paintErp(data, span);
            persistBoard(span);
            loadShopDirectory();
            return;
          }
          throw new Error("empty");
        })
        .catch(function () {
          if (state.payload) {
            return;
          }
          return json("/api/data/team")
            .catch(function () {
              return json("/data/team-demo.json");
            })
            .then(function (demo) {
              if (dead || !demo) {
                return;
              }
              demo.range = state.range;
              demo.dateLabel = span.dateLabel;
              demo.ranges = RANGES;
              state.payload = demo;
              persistBoard(span);
              render();
              loadShopDirectory();
            });
        });
    }

    function load(forceBoard) {
      const span = rangeSpan(state.range, state.customFrom, state.customTo);
      const cached = readOvBoard(state.range, span);
      if (cached && cached.payload) {
        applyCachedBoard(cached, span);
      } else if (!state.payload && board) {
        board.innerHTML = '<p class="ch-empty">正在加载数据总览…</p>';
      }
      loadLiveSpark();
      const heroReady = cached && cached.payload && cached.payload.hero && Number(cached.payload.hero.todayPay) > 0;
      if (!forceBoard && ovBoardFresh(cached) && heroReady) {
        return Promise.resolve();
      }
      return fetchBoard(span).then(function () {
        loadLiveSpark();
      });
    }

    function onDocClick(event) {
      const t = event.target;
      const shopEl = t && t.nodeType === 1 ? t : t && t.parentElement;
      const inShopPick =
        shopEl &&
        ((shopEl.matches &&
          shopEl.matches(
            "[data-shop-pick], [data-shop-pick-toggle], [data-shop-all], [data-shop-id], .ch-shop-opt, .ch-shop-menu, #ch-shop-menu, [data-shop-menu]"
          )) ||
          (shopEl.closest &&
            shopEl.closest("[data-shop-pick], .ch-shop-opt, #ch-shop-menu, [data-shop-menu]")));
      if (state.shopPickOpen && !inShopPick) {
        state.shopPickOpen = false;
        hideShopMenu();
        if (state.payload) {
          render();
        }
      }
      if (!state.calOpen || dead) {
        return;
      }
      if (t && t.closest && (t.closest("#ch-cal-pop") || t.closest('button[data-range="自定义"]'))) {
        return;
      }
      state.calOpen = false;
      hideCalPop();
    }

    function onWinResize() {
      if (state.shopPickOpen) {
        placeShopMenu();
      }
      if (!state.calOpen) {
        return;
      }
      const btn = board && board.querySelector('button[data-range="自定义"]');
      if (btn) {
        placeCalPop(btn);
      }
    }

    function onWinScroll() {
      if (state.shopPickOpen) {
        placeShopMenu();
      }
    }

    const clockTick = setInterval(function () {
      if (dead) {
        return;
      }
      const el = board && board.querySelector(".ch-clock");
      if (el) {
        el.textContent = shanghaiHms();
      }
    }, 1000);

    const liveTick = setInterval(function () {
      if (!dead) {
        loadLiveSpark();
      }
    }, 60 * 1000);

    const boardTick = setInterval(function () {
      if (!dead) {
        load(true);
      }
    }, OV_BOARD_FRESH_MS);

    const shopMenuEl = getShopMenu();
    function onShopMenuChange(event) {
      applyShopMenuChange(event.target);
    }
    function onShopMenuClick(event) {
      event.stopPropagation();
    }
    shopMenuEl.addEventListener("change", onShopMenuChange);
    shopMenuEl.addEventListener("click", onShopMenuClick);

    document.addEventListener("click", onDocClick);
    window.addEventListener("resize", onWinResize);
    window.addEventListener("scroll", onWinScroll, true);

    board.addEventListener("mouseover", function (event) {
      const help = event.target.closest && event.target.closest(".ch-help");
      if (help) {
        showMetricTip(help);
      }
    });
    board.addEventListener("mouseout", function (event) {
      const help = event.target.closest && event.target.closest(".ch-help");
      if (!help) {
        return;
      }
      const to = event.relatedTarget;
      if (to && help.contains(to)) {
        return;
      }
      hideMetricTip();
    });

    board.addEventListener("click", function (event) {
      const help = event.target.closest && event.target.closest(".ch-help");
      if (help) {
        event.preventDefault();
        event.stopPropagation();
        showMetricTip(help);
        return;
      }
      const shopToggle = event.target.closest("[data-shop-pick-toggle]");
      if (shopToggle) {
        event.preventDefault();
        state.shopPickOpen = !state.shopPickOpen;
        const wrap = board.querySelector("[data-shop-pick]");
        if (wrap) {
          wrap.classList.toggle("is-open", state.shopPickOpen);
        }
        syncShopMenu();
        return;
      }
      const colBtn = event.target.closest("[data-shop-cols='open']");
      if (colBtn) {
        event.preventDefault();
        openColPicker();
        return;
      }
      const setBtn = event.target.closest("[data-metrics='open'], .ch-set");
      if (setBtn) {
        event.preventDefault();
        openPicker();
        return;
      }
      const rangeBtn = event.target.closest("button[data-range]");
      if (rangeBtn) {
        const next = rangeBtn.getAttribute("data-range");
        if (next === "自定义") {
          state.calOpen = !state.calOpen;
          if (state.calOpen) {
            state.range = "自定义";
          }
          render();
          return;
        }
        state.range = next;
        state.calOpen = false;
        hideCalPop();
        load();
        return;
      }
      const secBtn = event.target.closest("button[data-section]");
      if (secBtn) {
        state.section = secBtn.getAttribute("data-section");
        render();
      }
    });
    board.addEventListener("change", function (event) {
      if (event.target.matches("[data-show-pl]")) {
        state.showPl = event.target.checked;
        render();
        return;
      }
      if (event.target.matches("[data-shop]")) {
        state.shopId = event.target.value;
        state.shopIds = event.target.value ? [event.target.value] : null;
        render();
        return;
      }
      applyShopMenuChange(event.target);
    });

    let boardDragKey = "";
    let boardDragMoved = false;
    let boardDragOrigin = null;
    function metricsRoot() {
      return board.querySelector(".ch-metrics");
    }
    function asEl(node) {
      if (!node) {
        return null;
      }
      return node.nodeType === 1 ? node : node.parentElement;
    }
    function closestCard(node) {
      const el = asEl(node);
      return el && el.closest ? el.closest(".ch-card[data-card-key]") : null;
    }
    function cardFromPoint(x, y) {
      const metrics = metricsRoot();
      if (!metrics) {
        return null;
      }
      return (
        Array.prototype.find.call(metrics.querySelectorAll(".ch-card[data-card-key]"), function (card) {
          const box = card.getBoundingClientRect();
          return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
        }) || null
      );
    }
    function markOver(over) {
      board.querySelectorAll(".ch-card").forEach(function (card) {
        card.classList.toggle("is-over", card === over);
      });
    }
    function clearBoardDrag() {
      boardDragKey = "";
      boardDragMoved = false;
      boardDragOrigin = null;
      board.querySelectorAll(".ch-card").forEach(function (card) {
        card.classList.remove("is-drag", "is-over");
      });
    }
    function applyBoardMove(overKey) {
      const fromKey = boardDragKey;
      if (!fromKey || !overKey || fromKey === overKey) {
        clearBoardDrag();
        return;
      }
      const order = loadBoardOrder(loadMetricKeys());
      const from = order.indexOf(fromKey);
      const to = order.indexOf(overKey);
      clearBoardDrag();
      if (from < 0 || to < 0) {
        return;
      }
      order.splice(from, 1);
      order.splice(to, 0, fromKey);
      saveBoardOrder(order);
      render();
    }
    function overKeyAt(event) {
      const marked = board.querySelector(".ch-card.is-over");
      const pointed = cardFromPoint(event.clientX, event.clientY) || closestCard(event.target);
      return (marked && marked.getAttribute("data-card-key")) || (pointed && pointed.getAttribute("data-card-key")) || "";
    }
    board.addEventListener("pointerdown", function (event) {
      if (event.button !== 0) {
        return;
      }
      const startEl = asEl(event.target);
      if (startEl && startEl.closest && startEl.closest(".ch-help, button, select, input, a")) {
        return;
      }
      const metrics = metricsRoot();
      const card = closestCard(event.target);
      if (!metrics || !card || !metrics.contains(card)) {
        return;
      }
      boardDragKey = card.getAttribute("data-card-key") || "";
      boardDragMoved = false;
      boardDragOrigin = { x: event.clientX, y: event.clientY };
      card.classList.add("is-drag");
      try {
        board.setPointerCapture(event.pointerId);
      } catch (_err) {}
    });
    board.addEventListener("pointermove", function (event) {
      if (!boardDragKey || !boardDragOrigin) {
        return;
      }
      const dx = event.clientX - boardDragOrigin.x;
      const dy = event.clientY - boardDragOrigin.y;
      if (dx * dx + dy * dy > 64) {
        boardDragMoved = true;
      }
      if (!boardDragMoved) {
        return;
      }
      markOver(cardFromPoint(event.clientX, event.clientY));
    });
    function onBoardPointerUp(event) {
      if (!boardDragKey) {
        return;
      }
      if (!boardDragMoved) {
        clearBoardDrag();
        return;
      }
      applyBoardMove(overKeyAt(event));
    }
    function onBoardPointerCancel() {
      if (boardDragKey) {
        clearBoardDrag();
      }
    }
    window.addEventListener("pointerup", onBoardPointerUp);
    window.addEventListener("pointercancel", onBoardPointerCancel);

    load();
    loadPeople();

    return function unmount() {
      dead = true;
      clearInterval(clockTick);
      clearInterval(liveTick);
      clearInterval(boardTick);
      document.removeEventListener("click", onDocClick);
      window.removeEventListener("resize", onWinResize);
      window.removeEventListener("scroll", onWinScroll, true);
      shopMenuEl.removeEventListener("change", onShopMenuChange);
      shopMenuEl.removeEventListener("click", onShopMenuClick);
      window.removeEventListener("pointerup", onBoardPointerUp);
      window.removeEventListener("pointercancel", onBoardPointerCancel);
      hideShopMenu();
      hideCalPop();
      hideMetricTip();
      if (tipEl) {
        tipEl.remove();
        tipEl = null;
      }
      closePicker();
      const pickEl = document.getElementById("ch-mpick-root");
      if (pickEl) {
        pickEl.remove();
      }
    };
  }

  window.XmDataCreateDashboard = createDashboard;

  const teamModule = {
    mount: function (root) {
      return createDashboard(root);
    }
  };

  try {
    Object.defineProperty(window.XmModules, "/data/overview", {
      configurable: true,
      enumerable: true,
      get: function () {
        return teamModule;
      },
      set: function () {}
    });
  } catch (_err) {
    window.XmModules["/data/overview"] = teamModule;
  }

  const existingBoard = document.getElementById("board");
  if (existingBoard && /\/data\/overview\/?$/.test(location.pathname)) {
    createDashboard(existingBoard.closest(".xm-page") || document.body);
  }
})();
