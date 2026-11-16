/* xm-module-bound — 边界 BI 工作台。只读本库，只请求 /api/bound。爬虫，非 ERP。 */
(function () {
  var state = {
    page: "channelOverview",
    tab: "",
    dim: "sku",
    view: "list",
    shop: "",
    q: "",
    from: "",
    to: "",
    daysType: "",
    pageNo: 1,
    catalog: null,
    viewData: null,
    link: null,
    admin: false,
    error: "",
    open: {},
    panel: "",
    area: "province",
    hourType: "pay",
    goodsGroup: "",
    compare: "yoy",
    stockDim: "style",
    hideCombo: false,
    dutyScope: "link",
    hpKind: "hp",
    matchMode: "exact",
    splitWarehouse: false,
    splitCombo: false,
    comboMode: "whole",
    profilePane: "info"
  };
  var active = 0;
  var timer = 0;
  var detach = function () {};

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function ensureStyle() {
    if (!document.getElementById || document.getElementById("bd-page-style")) {
      return;
    }
    var style = document.createElement("style");
    style.id = "bd-page-style";
    style.textContent = [
      ".bd-app{display:grid;grid-template-columns:156px minmax(0,1fr);min-height:640px;background:#f4f6fa;color:#1f2329;font-size:13px;}",
      ".bd-side{background:#fff;border-right:1px solid #e6e8ee;padding:8px 0;}",
      ".bd-mod{margin:12px 14px 4px;color:#86909c;font-size:12px;}",
      ".bd-side button{display:block;width:100%;height:34px;padding:0 14px;border:0;background:transparent;color:#1f2329;text-align:left;cursor:pointer;}",
      ".bd-side button.is-on{background:#e8f1ff;color:#3b6cff;font-weight:650;}",
      ".bd-main{min-width:0;padding:16px 16px 24px;}",
      ".bd-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:12px;}",
      ".bd-head h1{margin:0;font-size:18px;font-weight:650;line-height:1.3;}",
      ".bd-sub,.bd-status{margin:4px 0 0;color:#86909c;font-size:12px;line-height:1.5;}",
      ".bd-banner{margin:6px 0 0;color:#d93025;font-size:12px;}",
      ".bd-filters{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;align-items:center;}",
      ".bd-filters input,.bd-filters select,.bd-tools button,.bd-tools a,.bd-pager button,.bd-panel button{height:30px;padding:0 10px;border:1px solid #e1e4ea;border-radius:4px;background:#fff;color:#1f2329;font:inherit;font-size:12px;text-decoration:none;line-height:28px;}",
      ".bd-presets{display:flex;align-items:center;height:30px;padding:0 4px;border-radius:4px;background:#fff;}",
      ".bd-presets button{height:24px;padding:0 8px;border:0;border-radius:4px;background:transparent;color:#4e5969;cursor:pointer;font:inherit;font-size:12px;}",
      ".bd-presets button.is-on{background:#e8f1ff;color:#3b6cff;}",
      ".bd-primary{height:30px;padding:0 12px;border:0;border-radius:4px;background:#3b6cff;color:#fff;cursor:pointer;font:inherit;font-size:12px;}",
      ".bd-kpis{margin:0 0 12px;padding:12px;background:#fff;border:1px solid #eceff5;border-radius:6px;}",
      ".bd-kpi-head{display:flex;gap:12px;align-items:center;margin-bottom:10px;font-size:14px;}",
      ".bd-kpi-head span{color:#86909c;font-size:12px;}",
      ".bd-kpi-row{display:flex;gap:8px;overflow:auto;}",
      ".bd-kpi{min-width:148px;padding:8px 12px;background:#fff;border-right:1px solid #eceff3;}",
      ".bd-chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px;}",
      ".bd-chip{height:28px;padding:0 10px;border:1px solid #e1e4ea;border-radius:4px;background:#fff;color:#4e5969;cursor:pointer;font:inherit;font-size:12px;}",
      ".bd-chip.is-on{border-color:#3b6cff;color:#3b6cff;background:#e8f1ff;}",
      ".bd-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0 0 12px;}",
      ".bd-stat{padding:12px;background:#fff;border:1px solid #eceff5;border-radius:6px;}",
      ".bd-stat span{display:block;color:#86909c;font-size:12px;}",
      ".bd-stat b{display:block;margin-top:6px;font-size:20px;}",
      ".bd-top3{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 12px;}",
      ".bd-top3 article,.bd-profile{padding:12px;background:#fff;border:1px solid #eceff5;border-radius:6px;}",
      ".bd-top3 h3,.bd-profile h2,.bd-block-title{margin:0 0 8px;font-size:14px;}",
      ".bd-fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;}",
      ".bd-fields div{padding:8px 0;border-bottom:1px solid #f0f2f5;}",
      ".bd-fields span{display:block;color:#86909c;font-size:12px;}",
      ".bd-fields b{display:block;margin-top:4px;font-weight:500;}",
      ".bd-wall{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;}",
      ".bd-wall button{height:32px;padding:0 12px;border:1px solid #e1e4ea;border-radius:4px;background:#fff;cursor:pointer;font:inherit;}",
      ".bd-kpi span{display:block;color:#86909c;font-size:12px;}",
      ".bd-kpi b{display:block;margin:6px 0 4px;font-size:22px;font-weight:650;letter-spacing:-.02em;}",
      ".bd-kpi b.is-down{color:#d93025;}",
      ".bd-kpi em{color:#86909c;font-style:normal;font-size:12px;}",
      ".bd-tabs{display:flex;gap:4px;border-bottom:1px solid #e6e8ee;margin:0 0 12px;}",
      ".bd-tabs button{height:36px;padding:0 12px;border:0;border-bottom:2px solid transparent;background:transparent;color:#4e5969;cursor:pointer;font:inherit;}",
      ".bd-tabs button.is-on{color:#3b6cff;border-bottom-color:#3b6cff;font-weight:650;}",
      ".bd-block{background:#fff;border:1px solid #eceff5;border-radius:6px;padding:12px;}",
      ".bd-block + .bd-block{margin-top:12px;}",
      ".bd-block-bar{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:8px;}",
      ".bd-block-bar h2{margin:0;font-size:14px;font-weight:650;}",
      ".bd-tools{display:flex;flex-wrap:wrap;gap:6px;align-items:center;}",
      ".bd-tools button.is-on{background:#e8f1ff;color:#3b6cff;border-color:#c9dbff;}",
      ".bd-scroll{overflow:auto;}",
      ".bd-table{width:100%;border-collapse:collapse;font-size:12px;}",
      ".bd-table th,.bd-table td{padding:8px 10px;border-bottom:1px solid #f0f2f5;text-align:right;white-space:nowrap;}",
      ".bd-table th:first-child,.bd-table td:first-child,.bd-table th:nth-child(2),.bd-table td:nth-child(2){text-align:left;}",
      ".bd-table th{background:#fafafa;color:#86909c;font-weight:500;}",
      ".bd-num{display:inline-block;min-width:56px;padding:2px 6px;border-radius:2px;text-align:right;}",
      ".bd-num.is-up{background:#e8f8ef;color:#137333;}",
      ".bd-num.is-down{background:#fdecea;color:#d93025;}",
      ".bd-miss{color:#c0c4cc;}",
      ".bd-linkish{padding:0;border:0;background:transparent;color:#3b6cff;cursor:pointer;font:inherit;font-size:12px;}",
      ".bd-gallery{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;}",
      ".bd-tile{min-height:120px;padding:12px;border:1px solid #eceff5;border-radius:6px;background:#fff;}",
      ".bd-tile strong{display:block;margin-bottom:6px;font-size:14px;}",
      ".bd-sum,.bd-pager{display:flex;gap:16px;align-items:center;margin-top:10px;color:#4e5969;font-size:12px;}",
      ".bd-pager{justify-content:flex-end;}",
      ".bd-panel{margin:0 0 12px;padding:10px 12px;background:#fff;border:1px solid #eceff5;border-radius:6px;}",
      ".bd-panel label{display:flex;gap:6px;align-items:center;margin:4px 12px 4px 0;font-size:12px;}",
      ".bd-qr{width:180px;height:180px;object-fit:contain;background:#fff;}",
      ".bd-detail{white-space:normal;text-align:left;font-size:12px;line-height:1.6;color:#4e5969;}",
      "@media(max-width:900px){.bd-app{grid-template-columns:1fr}.bd-head{flex-direction:column}.bd-gallery{grid-template-columns:1fr 1fr}}"
    ].join("");
    if (document.head) {
      document.head.appendChild(style);
    }
  }

  function pageMeta() {
    var catalog = state.catalog;
    var found = null;
    if (!catalog) {
      return null;
    }
    catalog.modules.forEach(function (mod) {
      mod.pages.forEach(function (page) {
        if (page.id === state.page) {
          found = page;
        }
      });
    });
    return found;
  }

  function sumCell(sum, key) {
    if (!sum) {
      return "未采完";
    }
    if (!Object.prototype.hasOwnProperty.call(sum, key) || sum[key] == null) {
      return "—";
    }
    return String(Math.round(Number(sum[key]) * 100) / 100);
  }

  function queryString() {
    var params = new URLSearchParams();
    params.set("page", state.page);
    if (state.tab) {
      params.set("tab", state.tab);
    }
    params.set("dim", state.dim);
    params.set("view", state.view);
    params.set("shop", state.shop);
    params.set("q", state.q);
    params.set("from", state.from);
    params.set("to", state.to);
    if (state.daysType) {
      params.set("daysType", state.daysType);
    }
    params.set("pageNo", String(state.pageNo));
    return params.toString();
  }

  function renderNav() {
    if (!state.catalog) {
      return "";
    }
    return state.catalog.modules.map(function (mod) {
      var buttons = mod.pages.map(function (page) {
        return '<button type="button" data-act="page" data-page="' + esc(page.id) + '" class="' + (page.id === state.page ? "is-on" : "") + '">' + esc(page.label) + "</button>";
      }).join("");
      if (mod.id === "mine" && state.admin) {
        buttons += '<button type="button" data-act="page" data-page="link" class="' + (state.page === "link" ? "is-on" : "") + '">扫码连接旧站</button>';
      }
      return '<div class="bd-mod">' + esc(mod.label) + "</div>" + buttons;
    }).join("");
  }

  var BLURBS = {
    channelOverview: "全渠道经营指标、渠道与店铺数据使用同一统计口径。",
    channelAnalysis: "按店铺查看经营、流量、业绩、地域和时段。",
    channelAnalysisNew: "按链接、店铺、渠道对比关键指标。",
    productOverview: "商品销售、流量和转化使用同一统计口径。",
    productPanorama: "从渠道、SKU、地域和库存看商品全景。",
    productOperation: "商品流量、搜索、推广和素材运营。",
    productStock: "商品总库存数据。支持按款式、按货品查看。",
    hpOverview: "货品名称、编码和店铺使用同一套货品资料。",
    hpPanorama: "按货品或款式看总览、渠道布局、商品布局、SKU 全渠道、库存、品牌和发货仓库。",
    hpStock: "货品总库存综合指标和库存明细。",
    teamOverview: "链接管理、店铺管理、业绩对比和个人榜单、团队榜单。",
    teamSkills: "销售额贡献和提成收入。",
    teamMemberDetail: "管理店铺、责权链接和岗位工作明细。访客相关指标按单日累加。",
    teamMemberProfile: "团队综合指标和成员档案。",
    myProjects: "当前账号在旧站工作台里的项目。",
    personalCenter: "账号绑定、密码和手机号。"
  };

  function cardTitle(pageId) {
    if (pageId === "channelAnalysis") return "店铺综合指标";
    if (pageId === "productStock") return "商品总库存综合指标";
    if (pageId === "hpStock") return "货品总库存综合指标";
    if (pageId === "hpOverview") return "货品综合指标";
    if (pageId === "teamOverview" || pageId === "teamMemberProfile" || pageId === "teamMemberDetail") return "团队综合指标";
    return "综合指标";
  }

  function searchPlaceholder(pageId) {
    if (pageId === "teamMemberProfile") return "请输入成员名称";
    if (pageId === "hpOverview" || pageId === "hpPanorama" || pageId === "hpStock") return "货品名称/编码/款式编码";
    return "搜索商品、店铺、负责人";
  }

  function iso(date) {
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    return date.getFullYear() + "-" + month + "-" + day;
  }

  function parseIso(value) {
    var parts = String(value || "").split("-");
    if (parts.length !== 3) {
      return new Date();
    }
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  function addDays(date, delta) {
    var next = new Date(date.getTime());
    next.setDate(next.getDate() + delta);
    return next;
  }

  function presetRange(preset, anchorIso) {
    var anchor = parseIso(anchorIso);
    if (preset === "date") {
      var day = iso(anchor);
      return { from: day, to: day, daysType: "1" };
    }
    if (preset === "day7") {
      return { from: iso(addDays(anchor, -7)), to: iso(addDays(anchor, -1)), daysType: "7" };
    }
    if (preset === "day30") {
      return { from: iso(addDays(anchor, -30)), to: iso(addDays(anchor, -1)), daysType: "30" };
    }
    if (preset === "week") {
      var offset = (anchor.getDay() + 6) % 7;
      var start = addDays(anchor, -offset);
      return { from: iso(start), to: iso(addDays(start, 6)), daysType: "week" };
    }
    if (preset === "month") {
      var monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      var monthEnd = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
      return { from: iso(monthStart), to: iso(monthEnd), daysType: "month" };
    }
    if (preset === "year") {
      return { from: anchor.getFullYear() + "-01-01", to: anchor.getFullYear() + "-12-31", daysType: "year" };
    }
    return { from: state.from, to: state.to, daysType: state.daysType || "custom" };
  }

  function activePreset() {
    var map = { "1": "date", "7": "day7", "30": "day30", week: "week", month: "month", year: "year" };
    return map[state.daysType] || "";
  }

  function applyRange(range) {
    state.from = range.from;
    state.to = range.to;
    state.daysType = range.daysType;
    state.pageNo = 1;
  }

  function cnDate(value) {
    var parts = String(value || "").split("-");
    if (parts.length !== 3) {
      return "";
    }
    return parts[0] + "年" + Number(parts[1]) + "月" + Number(parts[2]) + "日";
  }

  function metricOf(row, column) {
    if (!column) {
      return null;
    }
    if (column.key === "name") {
      return row.name || (row.metrics && row.metrics.name) || "";
    }
    if (column.key === "shop") {
      return row.shop || (row.metrics && row.metrics.shop) || "";
    }
    if (column.key === "owner") {
      return row.owner || (row.metrics && row.metrics.owner) || "";
    }
    var metrics = row.metrics || {};
    if (metrics[column.key] != null && metrics[column.key] !== "") {
      return metrics[column.key];
    }
    var aliases = column.aliases || [];
    for (var i = 0; i < aliases.length; i += 1) {
      if (metrics[aliases[i]] != null && metrics[aliases[i]] !== "") {
        return metrics[aliases[i]];
      }
    }
    return null;
  }

  function formatCell(value, column) {
    if (value == null || value === "") {
      return '<span class="bd-miss">—</span>';
    }
    var num = Number(value);
    if (!column || !column.numeric || !Number.isFinite(num)) {
      return esc(value);
    }
    var whole = Math.abs(num) >= 100 && Math.abs(num - Math.round(num)) < 0.001;
    var digits = column.rate || !whole ? 2 : 0;
    var text = num.toLocaleString("zh-CN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
    if (column.rate) {
      text += "%";
    }
    return '<span class="bd-num ' + (num < 0 ? "is-down" : "is-up") + '">' + esc(text) + "</span>";
  }

  function renderStatus(data) {
    var coverage = data.coverage || {};
    var bad = "";
    if (coverage.status === "missing") {
      bad = "这段还有 " + ((coverage.missing || []).length) + " 天没采完，汇总留空，不当成 0。";
    } else if (coverage.status === "failed") {
      bad = "这段有采集失败的日期，已标出失败，不会用 0 代替。" + esc(coverage.error || "");
    } else if (coverage.status === "denied") {
      bad = "当前账号没有这个菜单。";
    }
    var note = "爬虫，非 ERP。查询只读本库，不会因为刷新去旧站重抓。";
    if (!bad && data.sumNote) {
      note += esc(data.sumNote);
    }
    return '<p class="bd-status">' + note + "</p>" + (bad ? '<p class="bd-banner">' + bad + "</p>" : "");
  }

  function renderCards(data) {
    if (!data || !data.cards || !data.cards.length || state.panel === "cards") {
      return "";
    }
    var cards = data.cards.filter(function (card) { return card.on; }).map(function (card) {
      var missing = data.cardStatus !== "ready" || card.value == null || card.value === "";
      var text = missing ? "未采完" : formatCard(card);
      var tone = !missing && Number(card.value) < 0 ? "is-down" : "";
      return '<article class="bd-kpi"><span>' + esc(card.label) + '</span><b class="' + tone + '">' + text + "</b><em>达成率 —</em></article>";
    }).join("");
    var title = cardTitle(data.page && data.page.id);
    return '<section class="bd-kpis"><div class="bd-kpi-head"><strong>' + esc(title) + '</strong><span>渠道 ' + esc(data.total) + ' 个</span><span>店铺 ' + esc((data.shops || []).length) + " 个</span></div><div class=\"bd-kpi-row\">" + cards + "</div></section>";
  }

  function chips(items, key) {
    return '<div class="bd-chips">' + items.map(function (item) {
      var on = String(state[key] || "") === item[0] ? " is-on" : "";
      return '<button type="button" data-act="chip" data-key="' + esc(key) + '" data-value="' + esc(item[0]) + '" class="bd-chip' + on + '">' + esc(item[1]) + "</button>";
    }).join("") + "</div>";
  }

  function renderExtras(data) {
    var id = data.page && data.page.id;
    var tabLabel = (data.tab && data.tab.label) || "";
    var html = "";
    if (id === "channelAnalysis" && tabLabel.indexOf("地域") >= 0) {
      html += '<span class="bd-sub">地域范围</span>' + chips([["province", "按省份"], ["city", "按城市"]], "area");
    }
    if (id === "channelAnalysis" && tabLabel.indexOf("时段") >= 0) {
      html += '<span class="bd-sub">销售时段统计类型</span>' + chips([["ship", "按发货"], ["pay", "按支付"]], "hourType");
    }
    if (id === "hpOverview") {
      html += chips([["exact", "精确"], ["fuzzy", "模糊"]], "matchMode");
      html += '<label class="bd-chip' + (state.splitWarehouse ? " is-on" : "") + '"><input type="checkbox" data-act="warehouse"' + (state.splitWarehouse ? " checked" : "") + ">按发货仓库拆分</label>";
      html += '<label class="bd-chip' + (state.splitCombo ? " is-on" : "") + '"><input type="checkbox" data-act="split-combo"' + (state.splitCombo ? " checked" : "") + ">拆分组合装</label>";
    }
    if (id === "hpPanorama") {
      html += chips([["hp", "按货品"], ["ks", "按款式"]], "hpKind");
      html += '<span class="bd-sub">组合装口径</span>' + chips([["split", "已拆分"], ["whole", "未拆分"]], "comboMode");
      html += '<p class="bd-status">仅总览数据和渠道布局分析支持按拆分组合装查询，其他分析固定按未拆分查询。</p>';
    }
    if (id === "channelAnalysisNew") {
      html += chips([["yoy", "同比"], ["mom", "环比"]], "compare");
    }
    if (id === "productOverview") {
      html += chips([
        ["", "全部"],
        ["info", "商品信息"],
        ["sale", "销售表现"],
        ["refund", "退款售后"],
        ["cost", "成本费用"],
        ["ad", "推广投放"],
        ["profit", "利润收益"],
        ["order", "订单分类明细"],
        ["flow", "流量转化"],
        ["service", "服务体验"]
      ], "goodsGroup");
    }
    if (id === "productStock") {
      html += chips([["style", "按款式"], ["goods", "按货品"]], "stockDim");
      html += '<label class="bd-chip' + (state.hideCombo ? " is-on" : "") + '"><input type="checkbox" data-act="combo"' + (state.hideCombo ? " checked" : "") + ">不显示组合装</label>";
    }
    if (id === "teamMemberDetail") {
      html += chips([
        ["link", "按负责的链接"],
        ["shop", "按负责的店铺"],
        ["joinLink", "按参与管理的链接"],
        ["joinShop", "按参与管理的店铺"]
      ], "dutyScope");
    }
    return html;
  }

  function visibleColumns(data) {
    var cols = (data.columns || []).filter(function (column) { return column.on; });
    if (!data.page || data.page.id !== "productOverview" || !state.goodsGroup) {
      return cols;
    }
    var groups = {
      info: { name: 1, shop: 1, owner: 1 },
      sale: { saleCount: 1, dealCount: 1, payUsers: 1, netPayUsers: 1, payAmount: 1 },
      flow: { visitor: 1, pv: 1 },
      refund: { refundAmount: 1, refundRate: 1 },
      cost: { saleCost: 1 },
      ad: { cost: 1 },
      profit: { profit: 1 },
      order: { orderType: 1 },
      service: { service: 1 }
    };
    var allow = groups[state.goodsGroup];
    if (!allow) {
      return [];
    }
    return cols.filter(function (column) { return allow[column.key]; });
  }

  function renderTeamExtra(data) {
    if (!data.page) {
      return "";
    }
    if (data.page.id === "teamSkills") {
      var ranked = (data.rows || []).slice().sort(function (left, right) {
        return Number(metricOf(right, { key: "payAmount", numeric: true, aliases: ["gmv", "xse"] }) || 0) - Number(metricOf(left, { key: "payAmount", numeric: true, aliases: ["gmv", "xse"] }) || 0);
      }).slice(0, 3);
      function board(title) {
        var body = ranked.length ? "<ol>" + ranked.map(function (row, index) {
          return "<li>" + (index + 1) + ". " + esc(row.name || "未命名") + "</li>";
        }).join("") + "</ol>" : "<p>暂无相关数据</p>";
        return "<article><h3>" + title + "</h3>" + body + '<button type="button" class="bd-linkish" data-act="chip" data-key="skillMore" data-value="1">查看更多</button></article>';
      }
      return '<div class="bd-top3">' + board("销售额贡献TOP3") + board("个人提成TOP3") + "</div>";
    }
    if (data.page.id === "teamMemberDetail") {
      var ready = data.coverage && data.coverage.status === "ready";
      var sum = data.allSum || {};
      function picked(keys, fallback) {
        for (var i = 0; i < keys.length; i += 1) {
          if (sum[keys[i]] != null && sum[keys[i]] !== "") return sum[keys[i]];
        }
        return fallback;
      }
      function stat(label, value) {
        var text = !ready ? "未采完" : (value == null || value === "" ? "—" : value);
        return '<article class="bd-stat"><span>' + label + "</span><b>" + esc(text) + "</b></article>";
      }
      return '<div class="bd-stats">' + stat("管理店铺数", picked(["shopCount", "manageShopCount"], (data.shops || []).length)) + stat("自己责权的店铺数", picked(["ownShopCount", "dutyShopCount"], null)) + stat("管理链接数", picked(["linkCount", "manageLinkCount"], data.total)) + stat("管理人数", picked(["memberCount", "manageUserCount"], null)) + "</div>" + chips([["sku", "按SKU统计"], ["spu", "按SPU统计"]], "dim") + '<p class="bd-status">表格为自定义时间时，只显示有销量的数据。访客相关指标按单日累加。</p><h2 class="bd-block-title">岗位工作明细</h2>';
    }
    return "";
  }

  function renderSpecial(data) {
    if (!data.page) {
      return "";
    }
    if (data.page.id === "personalCenter") {
      var row = (data.rows || [])[0] || {};
      var metrics = row.metrics || {};
      function field(label, value) {
        var text = value == null || value === "" ? "未采完" : value;
        return "<div><span>" + label + "</span><b>" + esc(text) + "</b></div>";
      }
      var body = "";
      if (state.profilePane === "safe") {
        body = field("更换手机号", metrics.phone || metrics.mobile || row.shop) + '<div><span>修改密码</span><b>密码只在旧站修改，这里不保存密码。</b></div>' + field("微信", metrics.wechat) + field("飞书", metrics.feishu) + field("钉钉", metrics.dingtalk) + field("企业微信", metrics.qywx);
      } else if (state.profilePane === "msg") {
        body = "<p>消息设置从本库个人资料读取。" + (data.coverage.status === "ready" ? "已采到个人资料。" : "未采完。") + "</p>";
      } else {
        body = field("姓名", metrics.userName || row.name) + field("手机号", metrics.phone || metrics.mobile || row.shop) + field("花名", metrics.nickName || metrics.alias) + field("岗位", metrics.postName || metrics.post) + field("职级", metrics.rankName || metrics.rank) + field("职务", metrics.jobName || metrics.duty);
      }
      return '<section class="bd-profile">' + chips([["info", "基本信息"], ["safe", "账号安全"], ["msg", "消息设置"]], "profilePane") + '<div class="bd-fields">' + body + "</div></section>";
    }
    if (data.page.id === "myProjects") {
      var rows = data.rows || [];
      var dayText = data.range && data.range.to ? cnDate(data.range.to) : "";
      var wall = "";
      if (state.catalog) {
        state.catalog.modules.forEach(function (mod) {
          mod.pages.forEach(function (page) {
            if (page.id === "myProjects" || page.id === "personalCenter") {
              return;
            }
            wall += '<button type="button" data-act="page" data-page="' + esc(page.id) + '">' + esc(page.label) + "</button>";
          });
        });
      }
      var projects = rows.length ? rows.map(function (item) {
        return '<article class="bd-tile"><strong>' + esc(item.name || "未命名项目") + "</strong><div>" + esc(item.shop || "") + "</div></article>";
      }).join("") : '<p class="bd-miss">' + (data.coverage.status === "ready" ? "这个范围内没有记录。" : "未采完") + "</p>";
      return '<section class="bd-profile"><p>今天是' + esc(dayText) + '。今天是你在公司服务的天数以本库个人资料为准。</p><div class="bd-wall">' + wall + "</div></section>" + '<div class="bd-gallery">' + projects + "</div>";
    }
    if (data.page.id === "channelAnalysisNew") {
      return '<section class="bd-block"><div class="bd-block-bar"><h2>指标趋势</h2></div><p class="bd-miss">' + (data.coverage.status === "ready" ? "这段已采完，趋势按当前指标对比。" : "未采完") + "</p></section>";
    }
    return "";
  }

  function formatCard(card) {
    var num = Number(card.value);
    if (!Number.isFinite(num)) {
      return esc(card.value);
    }
    var whole = !card.rate && Math.abs(num) >= 100 && Math.abs(num - Math.round(num)) < 0.001;
    var digits = card.rate || !whole ? 2 : 0;
    var text = num.toLocaleString("zh-CN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
    return esc(card.rate ? text + "%" : text);
  }

  function renderTable(data, rows, columns) {
    var list = rows || data.rows || [];
    var cols = columns || visibleColumns(data);
    if (!cols.length) {
      return '<p class="bd-miss">这个分组的字段还没进本地库。</p>';
    }
    if (state.view === "gallery" && rows == null) {
      if (!list.length) {
        return '<p class="bd-miss">' + (data.coverage.status === "ready" ? "这个范围内没有记录。" : "未采完") + "</p>";
      }
      return '<div class="bd-gallery">' + list.map(function (row) {
        return '<article class="bd-tile"><strong>' + esc(row.name || "未命名") + "</strong><div>" + esc(row.shop) + "</div><div>" + formatCell(metricOf(row, { key: "payAmount", numeric: true, money: true, aliases: ["gmv", "xse"] }), { key: "payAmount", numeric: true, money: true }) + "</div></article>";
      }).join("") + "</div>";
    }
    var suffix = data.page && data.page.id === "channelAnalysisNew" ? (state.compare === "mom" ? "环比" : "同比") : "";
    var head = "<tr><th></th>" + cols.map(function (column) {
      var label = column.label + (suffix && column.numeric ? suffix : "");
      return "<th>" + esc(label) + "</th>";
    }).join("") + "</tr>";
    var body = list.map(function (row) {
      var cells = cols.map(function (column) {
        return "<td>" + formatCell(metricOf(row, column), column) + "</td>";
      }).join("");
      var detail = row.fields && state.open[row.key] ? '<tr><td colspan="' + (cols.length + 1) + '" class="bd-detail">' + row.fields.map(function (field) {
        return "<div>" + esc(field.key) + "：" + esc(field.value) + "</div>";
      }).join("") + '<label>跟进 <input data-act="mark" data-key="' + esc(row.key) + '" data-field="follow" value="' + esc(row.follow) + '"></label><label>打标 <input data-act="mark" data-key="' + esc(row.key) + '" data-field="tag" value="' + esc(row.tag) + '"></label><label>目标 <input data-act="mark" data-key="' + esc(row.key) + '" data-field="target" value="' + esc(row.target) + '"></label></td></tr>' : "";
      var openerLabel = data.page && data.page.id === "channelAnalysisNew" ? "跟进 待办 打标" : "明细";
      var opener = row.fields ? '<button type="button" class="bd-linkish" data-act="expand" data-key="' + esc(row.key) + '">' + openerLabel + "</button>" : "";
      return "<tr><td>" + opener + "</td>" + cells + "</tr>" + detail;
    }).join("");
    if (!list.length) {
      body = '<tr><td colspan="' + (cols.length + 1) + '">' + (data.coverage.status === "ready" ? "这个范围内没有记录。" : "未采完") + "</td></tr>";
    }
    return '<div class="bd-scroll"><table class="bd-table">' + head + body + "</table></div>";
  }

  function renderShopBlock(data) {
    if (!data.page || data.page.id !== "channelOverview" || !(data.shops || []).length) {
      return "";
    }
    var columns = (data.columns || []).filter(function (column) { return column.on; }).map(function (column, index) {
      if (index === 0) {
        return { key: "name", label: "店铺", numeric: false, aliases: [] };
      }
      return column;
    });
    var byShop = {};
    (data.rows || []).forEach(function (row) {
      if (row.shop) {
        byShop[row.shop] = row;
      }
    });
    var rows = data.shops.map(function (shop) {
      return byShop[shop] || { key: "shop-" + shop, name: shop, shop: shop, metrics: {}, fields: null };
    });
    return '<section class="bd-block"><div class="bd-block-bar"><h2>店铺列表</h2></div>' + renderTable(data, rows, columns) + "</section>";
  }

  function renderSums(data) {
    var amount = sumCell(data.pageSum, "payAmount");
    var allAmount = sumCell(data.allSum, "payAmount");
    return '<div class="bd-sum"><span>当前页汇总 ' + esc(amount) + "</span><span>全部汇总 " + esc(allAmount) + "</span><span>记录 " + esc(data.total) + "</span></div>";
  }

  function renderPanel(data) {
    if (state.panel === "cards") {
      return '<div class="bd-panel"><strong>指标设置</strong>' + data.cards.map(function (card) {
        return '<label><input type="checkbox" data-act="card" value="' + esc(card.key) + '"' + (card.on ? " checked" : "") + ">" + esc(card.label) + "</label>";
      }).join("") + '<button type="button" data-act="save-cards">保存指标</button></div>';
    }
    if (state.panel === "batch") {
      var batchLabel = state.batchField === "target" ? "设置目标" : state.batchField === "tag" ? "批量打标" : "设置跟进";
      return '<div class="bd-panel"><strong>' + batchLabel + '</strong><input data-act="batch-value" value="' + esc(state.batchValue || "") + '"><button type="button" data-act="save-batch">确定</button></div>';
    }
    if (state.panel === "upload") {
      return '<div class="bd-panel"><strong>上传报表</strong><p>生意参谋入店来源报表、生意参谋关键指标对比报表、生意参谋流量来源报表、关键词推广来源详情报表、生意参谋手淘搜索来源详情报表。</p><p>这一页只读本库，不把报表回传到旧站。</p></div>';
    }
    if (state.panel === "columns") {
      return '<div class="bd-panel"><strong>字段设置</strong>' + data.columns.map(function (column) {
        return '<label><input type="checkbox" data-act="column" value="' + esc(column.key) + '"' + (column.on ? " checked" : "") + ">" + esc(column.label) + "</label>";
      }).join("") + '<button type="button" data-act="save-columns">保存字段</button></div>';
    }
    return "";
  }

  function renderLink() {
    var link = state.link || {};
    var qr = link.qrReady ? '<img class="bd-qr" alt="旧站登录二维码" src="/api/bound/link/qr?ts=' + Date.now() + '">' : "";
    var accounts = (link.accounts || []).map(function (account) {
      return '<button type="button" data-act="pick" data-company="' + esc(account.companyId) + '">' + esc(account.companyName || account.name || account.companyId) + "</button>";
    }).join("");
    return '<section class="bd-main" data-bound-erp="false"><header class="bd-head"><div><h1>扫码连接旧站</h1><p class="bd-sub">二维码来自旧站官方登录接口，和登录页同一张。扫码后服务器沿用这个会话补采，页面查询不再打旧站。</p><p class="bd-status">爬虫，非 ERP。浏览器标识 ' + esc(link.deviceId || "") + "</p></div></header><section class=\"bd-block\"><p>" + esc(link.message || "") + "</p>" + qr + '<div class="bd-tools"><button type="button" data-act="scan" data-provider="WECHAT">微信</button><button type="button" data-act="scan" data-provider="FEISHU">飞书</button><button type="button" data-act="scan" data-provider="DINGTALK">钉钉</button><button type="button" data-act="scan" data-provider="QYWX">企业微信</button>' + accounts + "</div></section></section>";
  }

  function renderMain() {
    if (state.page === "link") {
      return renderLink();
    }
    var data = state.viewData;
    var meta = pageMeta();
    if (!data || !meta) {
      return '<section class="bd-main"><p class="bd-miss">' + esc(state.error || "正在读取本库") + "</p></section>";
    }
    var ops = (data.page && data.page.ops) || meta.ops || [];
    var visibleTabs = (data.tabs || []).filter(function (tab) {
      if (!data.page || data.page.id !== "hpPanorama") {
        return true;
      }
      return (tab.group || "hp") === state.hpKind;
    });
    var tabs = visibleTabs.map(function (tab) {
      return '<button type="button" data-act="tab" data-tab="' + esc(tab.id) + '" class="' + (data.tab && data.tab.id === tab.id ? "is-on" : "") + '">' + esc(tab.label) + "</button>";
    }).join("");
    var shopPrompt = data.page.id === "channelAnalysis" ? "选择渠道/店铺/分组" : "全部店铺";
    var shops = '<option value="">' + shopPrompt + "</option>" + (data.shops || []).map(function (shop) {
      return '<option value="' + esc(shop) + '"' + (shop === state.shop ? " selected" : "") + ">" + esc(shop) + "</option>";
    }).join("");
    var preset = activePreset();
    var presetButtons = [["day7", "7天"], ["day30", "30天"], ["date", "日"], ["week", "周"], ["month", "月"], ["year", "年"]].map(function (item) {
      return '<button type="button" data-act="preset" data-preset="' + item[0] + '" class="' + (preset === item[0] ? "is-on" : "") + '">' + item[1] + "</button>";
    }).join("");
    var setting = (data.cards && data.cards.length) ? "cards" : "columns";
    var tabLabel = data.page.id === "teamSkills" ? "团队成员" : (data.tab && data.tab.label ? data.tab.label : data.page.label);
    var profileOnly = data.page.id === "personalCenter" || data.page.id === "myProjects";
    var tableBlock = profileOnly ? "" : '<section class="bd-block"><div class="bd-block-bar"><h2>' + esc(tabLabel) + '</h2><div class="bd-tools">' +
      (ops.indexOf("dim") >= 0 ? '<button type="button" data-act="dim" data-dim="spu" class="' + (state.dim === "spu" ? "is-on" : "") + '">SPU</button><button type="button" data-act="dim" data-dim="sku" class="' + (state.dim === "sku" ? "is-on" : "") + '">SKU</button>' : "") +
      (ops.indexOf("views") >= 0 ? '<button type="button" data-act="view" data-view="list" class="' + (state.view === "list" ? "is-on" : "") + '">列表</button><button type="button" data-act="view" data-view="period" class="' + (state.view === "period" ? "is-on" : "") + '">周期</button><button type="button" data-act="view" data-view="gallery" class="' + (state.view === "gallery" ? "is-on" : "") + '">大图</button>' : "") +
      (ops.indexOf("export") >= 0 ? '<a href="/api/bound/export?' + esc(queryString()) + '">' + (data.page.id === "productStock" ? "导出表格数据" : "导出") + "</a>" : "") +
      (data.page.id === "productOverview" ? '<button type="button" data-act="panel" data-panel="columns">自定义数据字段</button><button type="button" data-act="panel" data-panel="batch" data-field="follow">设置跟进</button><button type="button" data-act="panel" data-panel="batch" data-field="target">设置目标</button><button type="button" data-act="panel" data-panel="batch" data-field="tag">批量打标</button>' : "") +
      (data.page.id === "productOperation" ? '<button type="button" data-act="panel" data-panel="upload">上传报表</button>' : "") +
      '<button type="button" data-act="panel" data-panel="columns">更多</button></div></div>' +
      renderTable(data) +
      renderSums(data) +
      '<div class="bd-pager"><span>共 ' + esc(data.total) + ' 条</span><button type="button" data-act="page-no" data-delta="-1">上一页</button><span>第 ' + esc(data.pageNo) + ' 页</span><button type="button" data-act="page-no" data-delta="1">下一页</button></div></section>';
    return '<section class="bd-main" data-bound-erp="false" data-page="' + esc(data.page.id) + '" data-coverage="' + esc(data.coverage.status) + '">' +
      '<header class="bd-head"><div><h1>' + esc(data.page.label) + '</h1><p class="bd-sub">' + esc(BLURBS[data.page.id] || "") + "</p>" + renderStatus(data) + "</div>" +
      '<div class="bd-filters">' +
      (ops.indexOf("date") >= 0 ? '<span class="bd-sub">统计时间：' + esc(cnDate(data.range.from)) + " 至 " + esc(cnDate(data.range.to)) + '</span><div class="bd-presets">' + presetButtons + '</div><button type="button" data-act="shift" data-delta="-1" aria-label="上一期">‹</button><input data-act="from" type="date" value="' + esc(data.range.from) + '"><input data-act="to" type="date" value="' + esc(data.range.to) + '"><button type="button" data-act="shift" data-delta="1" aria-label="下一期">›</button>' : "") +
      (ops.indexOf("shop") >= 0 ? "<select data-act=\"shop\">" + shops + "</select>" : "") +
      (ops.indexOf("search") >= 0 ? '<input data-act="q" value="' + esc(state.q) + '" placeholder="' + esc(searchPlaceholder(data.page.id)) + '">' : "") +
      '<button type="button" class="bd-primary" data-act="panel" data-panel="' + setting + '">设定指标</button></div></header>' +
      renderCards(data) +
      renderPanel(data) +
      (tabs ? '<div class="bd-tabs">' + tabs + "</div>" : "") +
      renderExtras(data) +
      renderTeamExtra(data) +
      renderSpecial(data) +
      tableBlock +
      renderShopBlock(data) + "</section>";
  }

  function render(root) {
    root.innerHTML = '<div class="bd-app" data-bound-erp="false"><nav class="bd-side" aria-label="边界数据中心">' + renderNav() + '</nav>' + renderMain() + "</div>";
  }

  function paint(root) {
    var focus = root.querySelector && root.querySelector("[data-act='q']");
    var start = focus ? focus.selectionStart : null;
    render(root);
    if (start != null && root.querySelector) {
      var next = root.querySelector("[data-act='q']");
      if (next) {
        next.focus();
        if (next.setSelectionRange) {
          next.setSelectionRange(start, start);
        }
      }
    }
  }

  async function load(root, token) {
    state.error = "";
    var stamp = await fetch("/api/bound");
    var view = await fetch("/api/bound/view?" + queryString());
    var catalog = state.catalog ? null : await fetch("/api/bound/catalog");
    var link = await fetch("/api/bound/link");
    if (token !== active) {
      return;
    }
    if (!stamp.ok) {
      state.error = "边界数据中心没有打开";
      paint(root);
      return;
    }
    if (catalog) {
      state.catalog = await catalog.json();
    }
    if (view.ok) {
      state.viewData = await view.json();
      if (state.viewData.page && state.viewData.page.id && state.page !== "link") {
        state.page = state.viewData.page.id;
      }
      if (state.viewData.range) {
        state.from = state.viewData.range.from;
        state.to = state.viewData.range.to;
        state.daysType = state.viewData.daysType || state.daysType;
      }
    } else {
      state.viewData = null;
      state.error = "这一页没有读到";
    }
    state.admin = link.ok;
    state.link = link.ok ? await link.json() : null;
    paint(root);
  }

  function listen(root, token) {
    function onClick(event) {
      var node = event.target.closest ? event.target.closest("[data-act]") : null;
      if (!node || token !== active) {
        return;
      }
      var act = node.getAttribute("data-act");
      if (act === "page") {
        state.page = node.getAttribute("data-page");
        state.tab = "";
        state.pageNo = 1;
        state.panel = "";
      } else if (act === "tab") {
        state.tab = node.getAttribute("data-tab");
        state.pageNo = 1;
      } else if (act === "dim") {
        state.dim = node.getAttribute("data-dim");
        state.pageNo = 1;
      } else if (act === "view") {
        state.view = node.getAttribute("data-view");
      } else if (act === "chip") {
        var chipKey = node.getAttribute("data-key");
        state[chipKey] = node.getAttribute("data-value");
        if (chipKey === "hpKind") {
          var hpPage = pageMeta();
          var nextTab = ((hpPage && hpPage.tabs) || []).filter(function (tab) {
            return (tab.group || "hp") === state.hpKind;
          })[0];
          state.tab = nextTab ? nextTab.id : "";
          state.pageNo = 1;
          load(root, token);
          return;
        }
        if (chipKey === "dim") {
          state.pageNo = 1;
          load(root, token);
          return;
        }
        paint(root);
        return;
      } else if (act === "panel") {
        var nextPanel = node.getAttribute("data-panel");
        state.panel = state.panel === nextPanel && state.batchField === (node.getAttribute("data-field") || "") ? "" : nextPanel;
        if (node.getAttribute("data-field")) {
          state.batchField = node.getAttribute("data-field");
        }
        paint(root);
        return;
      } else if (act === "expand") {
        var key = node.getAttribute("data-key");
        state.open[key] = !state.open[key];
        paint(root);
        return;
      } else if (act === "page-no") {
        state.pageNo = Math.max(1, state.pageNo + Number(node.getAttribute("data-delta") || 0));
      } else if (act === "preset") {
        applyRange(presetRange(node.getAttribute("data-preset"), state.to || iso(new Date())));
      } else if (act === "shift") {
        var current = state.daysType || "month";
        var preset = { "1": "date", "7": "day7", "30": "day30", week: "week", month: "month", year: "year" }[current] || "date";
        var anchor = parseIso(state.to || iso(new Date()));
        var delta = Number(node.getAttribute("data-delta") || 0);
        if (preset === "month") {
          anchor = new Date(anchor.getFullYear(), anchor.getMonth() + delta, 1);
        } else if (preset === "year") {
          anchor = new Date(anchor.getFullYear() + delta, 0, 1);
        } else if (preset === "week" || preset === "day7") {
          anchor = addDays(anchor, delta * 7);
        } else if (preset === "day30") {
          anchor = addDays(anchor, delta * 30);
        } else {
          anchor = addDays(anchor, delta);
        }
        applyRange(presetRange(preset, iso(anchor)));
      } else if (act === "scan") {
        fetch("/api/bound/link/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: node.getAttribute("data-provider") }) }).then(function () {
          return load(root, token);
        });
        return;
      } else if (act === "pick") {
        fetch("/api/bound/link/pick", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId: node.getAttribute("data-company") }) }).then(function () {
          return load(root, token);
        });
        return;
      } else if (act === "save-batch") {
        var input = root.querySelector("[data-act='batch-value']");
        var value = input ? input.value : "";
        var field = state.batchField || "follow";
        var rows = (state.viewData && state.viewData.rows) || [];
        Promise.all(rows.map(function (row) {
          var payload = { rowKey: row.key, follow: row.follow, tag: row.tag, target: row.target };
          payload[field] = value;
          return fetch("/api/bound/marks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        })).then(function () {
          state.panel = "";
          return load(root, token);
        });
        return;
      } else if (act === "save-cards" || act === "save-columns") {
        var boxes = root.querySelectorAll("[data-act='" + (act === "save-cards" ? "card" : "column") + "']");
        var chosen = [];
        Array.prototype.forEach.call(boxes, function (box) {
          if (box.checked) {
            chosen.push(box.value);
          }
        });
        var body = { page: state.page };
        body[act === "save-cards" ? "cards" : "columns"] = chosen;
        fetch("/api/bound/prefs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(function () {
          state.panel = "";
          return load(root, token);
        });
        return;
      } else {
        return;
      }
      load(root, token);
    }
    function onChange(event) {
      var node = event.target;
      if (!node.getAttribute) {
        return;
      }
      var act = node.getAttribute("data-act");
      if (act === "combo" || act === "warehouse" || act === "split-combo") {
        if (act === "combo") state.hideCombo = Boolean(node.checked);
        if (act === "warehouse") state.splitWarehouse = Boolean(node.checked);
        if (act === "split-combo") state.splitCombo = Boolean(node.checked);
        paint(root);
        return;
      }
      if (act === "from" || act === "to" || act === "shop") {
        state[act === "shop" ? "shop" : act] = node.value;
        if (act === "from" || act === "to") {
          state.daysType = "custom";
        }
        state.pageNo = 1;
        load(root, token);
      }
      if (act === "mark") {
        var row = (state.viewData.rows || []).filter(function (item) { return item.key === node.getAttribute("data-key"); })[0] || {};
        var payload = { rowKey: node.getAttribute("data-key"), follow: row.follow, tag: row.tag, target: row.target };
        payload[node.getAttribute("data-field")] = node.value;
        fetch("/api/bound/marks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      }
    }
    root.addEventListener("click", onClick);
    root.addEventListener("change", onChange);
    return function () {
      if (root.removeEventListener) {
        root.removeEventListener("click", onClick);
        root.removeEventListener("change", onChange);
      }
    };
  }

  window.XmModules = window.XmModules || {};
  window.XmModules["/bound"] = {
    mount: function (root) {
      var token = ++active;
      ensureStyle();
      root.innerHTML = '<div class="bd-app" data-bound-erp="false"><nav class="bd-side" aria-label="边界数据中心"></nav><section class="bd-main"><p class="bd-note">爬虫，非 ERP</p></section></div>';
      detach = listen(root, token);
      load(root, token);
      if (typeof setInterval === "function") {
        timer = setInterval(function () {
          if (state.page === "link" && state.admin) {
            load(root, token);
          }
        }, 3000);
      }
      return function () {
        active += 1;
        detach();
        if (typeof clearInterval === "function") {
          clearInterval(timer);
        }
        root.innerHTML = "";
      };
    },
    unmount: function (root) {
      active += 1;
      detach();
      if (typeof clearInterval === "function") {
        clearInterval(timer);
      }
      if (root) {
        root.innerHTML = "";
      }
    }
  };
})();
