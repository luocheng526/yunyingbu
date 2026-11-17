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
    datePop: "",
    calMonth: "",
    calAnchor: "",
    comboMode: "whole",
    profilePane: "info",
    shopView: "list",
    sortKey: "",
    sortDir: "desc"
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
      ".bd-app{display:grid;grid-template-columns:112px minmax(0,1fr);min-height:640px;background:#f4f6fa;color:#1f2329;font-size:13px;}",
      ".bd-side{background:#fff;border-right:1px solid #e6e8ee;padding:8px 0;}",
      ".bd-mod{margin:12px 14px 4px;color:#86909c;font-size:12px;}",
      ".bd-side button{display:block;width:100%;height:30px;padding:0 10px;border:0;background:transparent;color:#1f2329;text-align:left;cursor:pointer;font-size:12px;}",
      ".bd-side button.is-on{background:#e8f1ff;color:#3b6cff;font-weight:650;}",
      ".bd-main{min-width:0;padding:16px 16px 24px;}",
      ".bd-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:12px;}",
      ".bd-head h1{margin:0;font-size:18px;font-weight:650;line-height:1.3;}",
      ".bd-sub,.bd-status{margin:4px 0 0;color:#86909c;font-size:12px;line-height:1.5;}",
      ".bd-banner{margin:6px 0 0;color:#d93025;font-size:12px;}",
      ".bd-filters{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;align-items:center;}",
      ".bd-filters input,.bd-filters select,.bd-tools button,.bd-tools a,.bd-pager button,.bd-panel button,.bd-outline{height:30px;padding:0 10px;border:1px solid #e1e4ea;border-radius:4px;background:#fff;color:#1f2329;font:inherit;font-size:12px;text-decoration:none;line-height:28px;cursor:pointer;}",
      ".bd-outline{margin-left:auto;border-color:#3b6cff;color:#3b6cff;}",
      ".bd-datepick{position:relative;display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:8px;color:#4e5969;font-size:12px;}",
      ".bd-stat-time{white-space:nowrap;}",
      ".bd-presets{display:flex;align-items:center;padding:2px;border-radius:4px;background:#f2f3f5;}",
      ".bd-presets button{height:26px;min-width:28px;padding:0 8px;border:0;border-radius:4px;background:transparent;color:#4e5969;cursor:pointer;font:inherit;font-size:12px;}",
      ".bd-presets button.is-on{background:#fff;color:#3b6cff;font-weight:650;}",
      ".bd-presets button.bd-custom{text-decoration:underline;text-decoration-style:dashed;text-underline-offset:3px;}",
      ".bd-presets button:disabled{color:#c9cdd4;cursor:not-allowed;}",
      ".bd-split{width:1px;align-self:stretch;margin:6px 4px;background:#e5e6eb;}",
      ".bd-picker{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;}",
      ".bd-pop{position:absolute;top:36px;right:0;z-index:3;display:flex;gap:6px;align-items:center;padding:8px;background:#fff;border:1px solid #e5e6eb;border-radius:4px;box-shadow:0 6px 16px rgba(29,33,41,.12);}",
      ".bd-custom{position:relative;}",
      ".bd-tip{display:none;position:absolute;top:34px;right:0;z-index:6;width:280px;padding:10px 12px;border-radius:2px;background:#1d2129;color:#fff;font-size:12px;font-weight:400;line-height:1.6;text-align:left;text-decoration:none;white-space:normal;box-shadow:0 6px 16px rgba(0,0,0,.18);}",
      ".bd-custom:hover .bd-tip{display:block;}",
      ".bd-cal{position:absolute;top:40px;right:0;z-index:5;width:560px;padding:8px 12px 10px;background:#fff;border:1px solid #e5e6eb;border-radius:2px;box-shadow:0 8px 24px rgba(29,33,41,.12);}",
      ".bd-cal-months{display:grid;grid-template-columns:1fr 1fr;gap:12px;}",
      ".bd-cal-head{display:grid;grid-template-columns:28px 1fr 28px;align-items:center;height:36px;color:#1d2129;font-size:14px;}",
      ".bd-cal-head strong{text-align:center;font-weight:500;}",
      ".bd-cal-head button{height:28px;border:0;background:transparent;color:#4e5969;cursor:pointer;font-size:16px;}",
      ".bd-cal-head button:disabled{color:#c9cdd4;cursor:not-allowed;}",
      ".bd-cal-week,.bd-cal-grid{display:grid;grid-template-columns:repeat(7,32px);justify-content:center;}",
      ".bd-cal-week span{height:28px;line-height:28px;text-align:center;color:#86909c;font-size:12px;}",
      ".bd-cal-day{height:32px;border:0;background:transparent;color:#1d2129;cursor:pointer;font:inherit;font-size:12px;}",
      ".bd-cal-day.is-out{color:#c9cdd4;}",
      ".bd-cal-day.is-off{color:#c9cdd4;cursor:not-allowed;}",
      ".bd-cal-day.is-mid{background:#e8f3ff;color:#1d2129;border-radius:0;}",
      ".bd-cal-day.is-edge{background:#3b6cff;color:#fff;}",
      ".bd-cal-day.is-edge.is-from{border-radius:4px 0 0 4px;}",
      ".bd-cal-day.is-edge.is-to{border-radius:0 4px 4px 0;}",
      ".bd-cal-day.is-edge.is-one{border-radius:4px;}",
      ".bd-cal-foot{margin:8px 0 0;color:#86909c;font-size:12px;text-align:right;}",
      ".bd-primary{height:30px;padding:0 12px;border:0;border-radius:4px;background:#3b6cff;color:#fff;cursor:pointer;font:inherit;font-size:12px;}",
      ".bd-kpi-head .bd-primary{margin-left:auto;height:28px;}",
      ".bd-kpis{margin:0 0 12px;padding:8px 4px 12px;background:#fff;border:1px solid #eceff5;border-radius:6px;}",
      ".bd-kpi-head{display:flex;gap:12px;align-items:center;margin:0 12px 4px;font-size:14px;}",
      ".bd-kpi-head span{color:#86909c;font-size:12px;}",
      ".bd-kpi-row{display:flex;flex-wrap:wrap;gap:0;}",
      ".bd-kpi{min-width:132px;padding:8px 14px;background:#fff;border-right:1px solid #f2f3f5;}",
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
      ".bd-kpi b{display:block;margin:6px 0 4px;font-size:22px;font-weight:650;letter-spacing:-.02em;color:#1d2129;}",
      ".bd-kpi b.is-up{color:#f53f3f;}",
      ".bd-kpi b.is-down{color:#00b42a;}",
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
      ".bd-table th{background:#fafafa;color:#3b6cff;font-weight:500;}",
      ".bd-table th button{border:0;background:transparent;color:inherit;font:inherit;cursor:pointer;}",
      ".bd-table tr.bd-total td{font-weight:650;background:#fafafa;}",
      ".bd-dot{display:inline-block;width:8px;height:8px;margin-right:6px;border-radius:2px;vertical-align:middle;}",
      ".bd-num{display:inline-block;min-width:56px;padding:2px 6px;border-radius:2px;text-align:right;color:#1d2129;}",
      ".bd-num.is-neg{color:#00b42a;}",
      ".bd-num.is-solid.is-up{background:#f53f3f;color:#fff;}",
      ".bd-num.is-solid.is-down{background:#00b42a;color:#fff;}",
      ".bd-bars{display:flex;flex-direction:column;gap:8px;padding:8px 0;}",
      ".bd-bar{display:grid;grid-template-columns:120px minmax(0,1fr) 120px;gap:8px;align-items:center;}",
      ".bd-bar i{display:block;height:8px;background:#3b6cff;border-radius:4px;}",
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
      ".bd-now{margin:0 0 8px;font-size:13px;}",
      ".bd-meter{height:8px;margin:8px 0 12px;background:#f2f3f5;border-radius:4px;overflow:hidden;}",
      ".bd-meter i{display:block;height:100%;background:#3b6cff;}",
      ".bd-progress{max-height:420px;overflow:auto;}",
      ".bd-progress td.is-current{color:#3b6cff;font-weight:650;}",
      ".bd-reason{margin-top:2px;max-width:280px;color:#8a93a6;font-size:12px;font-weight:400;white-space:normal;}",
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

  var DATA_START = "2026-09-01";

  function shanghaiToday() {
    try {
      return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    } catch (error) {
      return iso(new Date());
    }
  }

  function weekStart(value) {
    var date = parseIso(value);
    return iso(addDays(date, -((date.getDay() + 6) % 7)));
  }

  function monthEndIso(startIso) {
    var date = parseIso(startIso);
    return iso(new Date(date.getFullYear(), date.getMonth() + 1, 0));
  }

  function clampRange(from, to) {
    var today = shanghaiToday();
    if (to > today) {
      to = today;
    }
    if (from < DATA_START) {
      from = DATA_START;
    }
    if (from > to) {
      from = to;
    }
    return { from: from, to: to };
  }

  function weekContains(mondayIso, dayIso) {
    var end = iso(addDays(parseIso(mondayIso), 6));
    return dayIso >= mondayIso && dayIso <= end;
  }

  function isoWeekValue(mondayIso) {
    var monday = parseIso(weekStart(mondayIso));
    var thursday = addDays(monday, 3);
    var year = thursday.getFullYear();
    var jan4 = new Date(year, 0, 4);
    var week1 = addDays(jan4, -((jan4.getDay() + 6) % 7));
    var week = Math.floor(Math.round((monday.getTime() - week1.getTime()) / 86400000) / 7) + 1;
    return year + "-W" + String(week).padStart(2, "0");
  }

  function mondayFromWeekValue(value) {
    var match = /^(\d{4})-W(\d{2})$/.exec(String(value || ""));
    if (!match) {
      return "";
    }
    var year = Number(match[1]);
    var week = Number(match[2]);
    var jan4 = new Date(year, 0, 4);
    var week1 = addDays(jan4, -((jan4.getDay() + 6) % 7));
    return iso(addDays(week1, (week - 1) * 7));
  }

  function rollingRange(days) {
    var today = parseIso(shanghaiToday());
    var range = clampRange(iso(addDays(today, -days)), iso(addDays(today, -1)));
    return { from: range.from, to: range.to, daysType: String(days) };
  }

  function defaultCalendarRange(preset) {
    var today = shanghaiToday();
    if (preset === "date") {
      var day = clampRange(iso(addDays(parseIso(today), -1)), iso(addDays(parseIso(today), -1)));
      return { from: day.from, to: day.to, daysType: "1" };
    }
    if (preset === "week") {
      var monday = iso(addDays(parseIso(weekStart(today)), -7));
      var range = clampRange(monday, iso(addDays(parseIso(monday), 6)));
      return { from: range.from, to: range.to, daysType: "week" };
    }
    if (preset === "month") {
      var start = today.slice(0, 7) + "-01";
      var range = clampRange(start, monthEndIso(start));
      return { from: range.from, to: range.to, daysType: "month" };
    }
    if (preset === "year") {
      var range = clampRange(today.slice(0, 4) + "-01-01", today.slice(0, 4) + "-12-31");
      return { from: range.from, to: range.to, daysType: "year" };
    }
    return null;
  }

  function shiftRange(delta) {
    var today = shanghaiToday();
    var type = state.daysType;
    if (!state.from || (type !== "1" && type !== "week" && type !== "month" && type !== "year")) {
      return null;
    }
    if (type === "1") {
      var day = iso(addDays(parseIso(state.from), delta));
      if (day < DATA_START || day > today) {
        return null;
      }
      return { from: day, to: day, daysType: "1" };
    }
    if (type === "week") {
      var start = iso(addDays(parseIso(weekStart(state.from)), delta * 7));
      var end = iso(addDays(parseIso(start), 6));
      if (end < DATA_START || start > today || weekContains(start, today)) {
        return null;
      }
      var range = clampRange(start, end);
      return { from: range.from, to: range.to, daysType: "week" };
    }
    if (type === "month") {
      var cursor = parseIso(state.from.slice(0, 7) + "-01");
      cursor.setMonth(cursor.getMonth() + delta);
      var start = iso(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
      if (start < DATA_START || start > today) {
        return null;
      }
      var range = clampRange(start, monthEndIso(start));
      return { from: range.from, to: range.to, daysType: "month" };
    }
    var year = Number(state.from.slice(0, 4)) + delta;
    var start = year + "-01-01";
    if (year < 2026 || start > today) {
      return null;
    }
    var range = clampRange(start, year + "-12-31");
    return { from: range.from, to: range.to, daysType: "year" };
  }

  function daySpan(from, to) {
    var start = parseIso(from);
    var end = parseIso(to);
    return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  }

  function addMonth(ym, delta) {
    var parts = String(ym || "").split("-");
    var date = new Date(Number(parts[0]), Number(parts[1]) - 1 + delta, 1);
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
  }

  function monthCells(ym) {
    var parts = String(ym).split("-");
    var year = Number(parts[0]);
    var month = Number(parts[1]);
    var first = new Date(year, month - 1, 1);
    var lead = (first.getDay() + 6) % 7;
    var count = new Date(year, month, 0).getDate();
    var cells = [];
    var index;
    for (index = 0; index < lead; index += 1) {
      var prev = new Date(year, month - 1, 1 - (lead - index));
      cells.push({ iso: iso(prev), day: prev.getDate(), inMonth: false });
    }
    for (index = 1; index <= count; index += 1) {
      var day = String(index).padStart(2, "0");
      cells.push({ iso: ym + "-" + day, day: index, inMonth: true });
    }
    var next = 1;
    while (cells.length % 7 !== 0) {
      var tail = new Date(year, month, next);
      cells.push({ iso: iso(tail), day: tail.getDate(), inMonth: false });
      next += 1;
    }
    return cells;
  }

  function renderMonth(ym, side) {
    var today = shanghaiToday();
    var todayMonth = today.slice(0, 7);
    var from = state.calAnchor || state.from;
    var to = state.calAnchor ? state.calAnchor : state.to;
    var week = ["一", "二", "三", "四", "五", "六", "日"].map(function (name) {
      return "<span>" + name + "</span>";
    }).join("");
    var days = monthCells(ym).map(function (cell) {
      var off = cell.iso < DATA_START || cell.iso > today;
      if (state.calAnchor && !off && Math.abs(daySpan(state.calAnchor, cell.iso) - 1) > 30) {
        off = true;
      }
      var edge = !off && (cell.iso === from || cell.iso === to);
      var mid = !off && from && to && cell.iso > from && cell.iso < to;
      var one = edge && from === to;
      var cls = "bd-cal-day";
      if (!cell.inMonth) cls += " is-out";
      if (off) cls += " is-off";
      if (mid) cls += " is-mid";
      if (edge) cls += " is-edge" + (one ? " is-one" : cell.iso === from ? " is-from" : " is-to");
      return '<button type="button" class="' + cls + '" data-act="cal-day" data-day="' + cell.iso + '"' + (off ? " disabled" : "") + ">" + cell.day + "</button>";
    }).join("");
    var prev = side === "left" ? '<button type="button" data-act="cal-shift" data-delta="-1"' + (ym <= "2026-09" ? " disabled" : "") + ' aria-label="上个月">«</button>' : "<span></span>";
    var next = side === "right" ? '<button type="button" data-act="cal-shift" data-delta="1"' + (addMonth(ym, 0) > todayMonth ? " disabled" : "") + ' aria-label="下个月">»</button>' : "<span></span>";
    var title = Number(ym.slice(0, 4)) + " 年 " + Number(ym.slice(5, 7)) + " 月";
    return '<section><div class="bd-cal-head">' + prev + "<strong>" + title + "</strong>" + next + '</div><div class="bd-cal-week">' + week + '</div><div class="bd-cal-grid">' + days + "</div></section>";
  }

  function renderCustomCalendar() {
    var left = state.calMonth || (state.from || shanghaiToday()).slice(0, 7);
    if (left < "2026-09") left = "2026-09";
    var right = addMonth(left, 1);
    return '<div class="bd-cal"><div class="bd-cal-months">' + renderMonth(left, "left") + renderMonth(right, "right") + '</div><p class="bd-cal-foot">*最少选择 1 天，最多选择 31 天</p></div>';
  }

  function activePreset() {
    var map = { "1": "date", "7": "day7", "30": "day30", week: "week", month: "month", year: "year", custom: "custom" };
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

  function statText(from, to, daysType) {
    if (!from || !to) {
      return "（统计时间：）";
    }
    var single = daysType === "1" || from === to;
    if (from.slice(0, 4) !== to.slice(0, 4)) {
      return "（统计时间：" + cnDate(from) + (single ? "" : "-" + cnDate(to)) + "）";
    }
    var text = from.slice(0, 4) + "年" + Number(from.slice(5, 7)) + "月" + Number(from.slice(8, 10)) + "日";
    if (!single) {
      text += "-" + Number(to.slice(5, 7)) + "月" + Number(to.slice(8, 10)) + "日";
    }
    return "（统计时间：" + text + "）";
  }

  function yearChoices() {
    var end = Number(shanghaiToday().slice(0, 4));
    var years = [];
    var year = 2026;
    while (year <= end) {
      years.push(String(year));
      year += 1;
    }
    return years;
  }

  function renderDateBar(data) {
    var daysType = state.daysType || (data.range.from === data.range.to ? "1" : "");
    var preset = activePreset();
    var buttons = [["day7", "7天"], ["day30", "30天"], ["date", "日"], ["week", "周"], ["month", "月"], ["year", "年"]].map(function (item) {
      return '<button type="button" data-act="preset" data-preset="' + item[0] + '" class="' + (preset === item[0] ? "is-on" : "") + '">' + item[1] + "</button>";
    }).join("");
    var today = shanghaiToday();
    var yesterday = iso(addDays(parseIso(today), -1));
    var dayValue = daysType === "1" && data.range.from ? data.range.from : yesterday;
    var monday = daysType === "week" && data.range.from ? weekStart(data.range.from) : iso(addDays(parseIso(weekStart(today)), -7));
    var monthValue = (daysType === "month" && data.range.from ? data.range.from : today).slice(0, 7);
    var years = yearChoices().map(function (year) {
      var on = daysType === "year" && data.range.from && data.range.from.slice(0, 4) === year;
      return '<button type="button" data-act="pick-year" data-year="' + year + '" class="' + (on ? "is-on" : "") + '">' + year + "年</button>";
    }).join("");
    return '<div class="bd-datepick"><span class="bd-stat-time">' + esc(statText(data.range.from, data.range.to, daysType)) + '</span><div class="bd-presets">' + buttons +
      '<i class="bd-split"></i><button type="button" class="bd-arrow" data-act="shift" data-delta="-1" aria-label="上一期"' + (shiftRange(-1) ? "" : " disabled") + '>‹</button><button type="button" class="bd-arrow" data-act="shift" data-delta="1" aria-label="下一期"' + (shiftRange(1) ? "" : " disabled") + '>›</button><i class="bd-split"></i>' +
      '<button type="button" data-act="preset" data-preset="custom" class="bd-custom' + (preset === "custom" ? " is-on" : "") + '">自定义<span class="bd-tip">自定义支持在可选时间范围内，对任意连续最多 31 天的数据进行分析。访客相关的指标默认将单日的数据直接累加计算。</span></button></div>' +
      '<input class="bd-picker" data-act="pick-date" type="date" min="' + DATA_START + '" max="' + esc(today) + '" value="' + esc(dayValue) + '">' +
      '<input class="bd-picker" data-act="pick-week" type="week" max="' + esc(isoWeekValue(iso(addDays(parseIso(weekStart(today)), -7)))) + '" value="' + esc(isoWeekValue(monday)) + '">' +
      '<input class="bd-picker" data-act="pick-month" type="month" min="2026-09" max="' + esc(today.slice(0, 7)) + '" value="' + esc(monthValue) + '">' +
      (state.datePop === "year" ? '<div class="bd-pop">' + years + "</div>" : "") +
      (state.datePop === "custom" ? renderCustomCalendar() : "") +
      "</div>";
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
    if (column.key === "platform") {
      return row.platform || (row.metrics && row.metrics.platform) || "";
    }
    var metrics = row.metrics || {};
    if (metrics[column.key] != null && metrics[column.key] !== "") {
      return metrics[column.key];
    }
    var folded = null;
    Object.keys(metrics).forEach(function (key) {
      if (folded) {
        return;
      }
      if (key.toLowerCase() === String(column.key).toLowerCase() && metrics[key] != null && metrics[key] !== "") {
        folded = metrics[key];
      }
    });
    if (folded != null) {
      return folded;
    }
    var aliases = column.aliases || [];
    for (var i = 0; i < aliases.length; i += 1) {
      if (metrics[aliases[i]] != null && metrics[aliases[i]] !== "") {
        return metrics[aliases[i]];
      }
      var alias = String(aliases[i]).toLowerCase();
      var aliasHit = null;
      Object.keys(metrics).forEach(function (key) {
        if (!aliasHit && key.toLowerCase() === alias && metrics[key] != null && metrics[key] !== "") {
          aliasHit = metrics[key];
        }
      });
      if (aliasHit != null) {
        return aliasHit;
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
    if (column.rate && Math.abs(num) <= 1) {
      num = num * 100;
    }
    var whole = Math.abs(num) >= 100 && Math.abs(num - Math.round(num)) < 0.001;
    var digits = column.rate || !whole ? 2 : 0;
    var text = num.toLocaleString("zh-CN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
    if (column.rate) {
      text += "%";
    }
    var solid = column.solid || column.key === "profit" || column.key === "lrl" || column.key === "grossRate";
    var tone = solid ? (num < 0 ? "is-solid is-down" : "is-solid is-up") : (num < 0 ? "is-neg" : "");
    return '<span class="bd-num ' + tone + '">' + esc(text) + "</span>";
  }

  function channelDot(name) {
    var color = { "京东": "#e1251b", "天猫": "#ff0036", "淘宝": "#ff5000", "抖音": "#111111", "拼多多": "#e02e24", "快手": "#ff4906", "全部": "#3b6cff", "全渠道": "#3b6cff", "汇总": "#3b6cff" }[name] || "";
    return color ? '<i class="bd-dot" style="background:' + color + '"></i>' : "";
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
    return '<p class="bd-status">爬虫，非 ERP。</p>' + (bad ? '<p class="bd-banner">' + bad + "</p>" : "");
  }

  function renderCards(data) {
    if (!data || !data.cards || !data.cards.length || state.panel === "cards") {
      return "";
    }
    var cards = data.cards.filter(function (card) { return card.on; }).map(function (card) {
      var rangeMissing = data.cardStatus !== "ready";
      var empty = card.value == null || card.value === "";
      var text = rangeMissing ? "未采完" : (empty ? "—" : formatCard(card));
      var num = Number(card.value);
      var tone = "";
      if (!rangeMissing && !empty && num < 0) {
        tone = "is-down";
      } else if (!rangeMissing && !empty && card.rate && num > 0) {
        tone = "is-up";
      }
      var sub = card.note != null ? card.note : (card.rate ? "" : "达成率 —");
      return '<article class="bd-kpi"><span>' + esc(card.label) + '</span><b class="' + tone + '">' + text + "</b><em>" + (sub || "&nbsp;") + "</em></article>";
    });
    var title = cardTitle(data.page && data.page.id);
    var channelCount = data.channelCount != null ? data.channelCount : data.total;
    var shopCount = data.shopCount != null ? data.shopCount : (data.shops || []).length;
    var first = cards.slice(0, 9).join("");
    var rest = cards.slice(9).join("");
    return '<section class="bd-kpis"><div class="bd-kpi-head"><strong>' + esc(title) + '</strong><span>渠道 ' + esc(channelCount) + ' 个</span><span>店铺 ' + esc(shopCount) + ' 个</span><button type="button" class="bd-primary" data-act="panel" data-panel="cards">设定指标</button></div><div class="bd-kpi-row">' + first + "</div>" + (rest ? '<div class="bd-kpi-row">' + rest + "</div>" : "") + "</section>";
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

  function renderBars(data, list) {
    if (!list.length) {
      return '<p class="bd-miss">' + (data.coverage.status === "ready" ? "这个范围内没有记录。" : "未采完") + "</p>";
    }
    var pay = { key: "payAmount", numeric: true, money: true, aliases: ["gmv", "xse", "saleAmount"] };
    var max = 1;
    list.forEach(function (row) {
      max = Math.max(max, Math.abs(Number(metricOf(row, pay)) || 0));
    });
    return '<div class="bd-bars">' + list.map(function (row) {
      var amount = Number(metricOf(row, pay)) || 0;
      var width = Math.max(2, Math.round(Math.abs(amount) / max * 100));
      return '<div class="bd-bar"><span>' + esc(row.name || "未命名") + '</span><i style="width:' + width + '%"></i><b>' + formatCell(amount, pay) + "</b></div>";
    }).join("") + "</div>";
  }

  function formatCard(card) {
    var num = Number(card.value);
    if (!Number.isFinite(num)) {
      return esc(card.value);
    }
    if (card.rate && Math.abs(num) <= 1) {
      num = num * 100;
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
    if (state.view === "chart" && rows == null) {
      return renderBars(data, list);
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
    var showOpener = !(data.page && (data.page.id === "channelOverview" || data.page.id === "channelAnalysis"));
    if (state.sortKey) {
      var sortColumn = null;
      cols.forEach(function (column) {
        if (column.key === state.sortKey) {
          sortColumn = column;
        }
      });
      if (sortColumn) {
        list = list.slice().sort(function (left, right) {
          var a = metricOf(left, sortColumn);
          var b = metricOf(right, sortColumn);
          var an = Number(a);
          var bn = Number(b);
          var cmp = Number.isFinite(an) && Number.isFinite(bn) ? an - bn : String(a || "").localeCompare(String(b || ""), "zh");
          return state.sortDir === "asc" ? cmp : -cmp;
        });
      }
    }
    var head = "<tr>" + (showOpener ? "<th></th>" : "") + cols.map(function (column) {
      var label = column.label + (suffix && column.numeric ? suffix : "");
      var mark = state.sortKey === column.key ? (state.sortDir === "asc" ? " ↑" : " ↓") : "";
      return '<th><button type="button" data-act="sort" data-key="' + esc(column.key) + '">' + esc(label) + mark + "</button></th>";
    }).join("") + "</tr>";
    var body = list.map(function (row) {
      var cells = cols.map(function (column) {
        var value = formatCell(metricOf(row, column), column);
        if (column.key === "name") {
          var shown = row.name === "全部" && data.page && data.page.id === "channelOverview" ? "全渠道" : row.name;
          value = channelDot(shown) + (shown === row.name ? value : formatCell(shown, column));
        }
        if (column.key === "platform") {
          value = channelDot(row.platform || row.name) + value;
        }
        return "<td>" + value + "</td>";
      }).join("");
      var detail = row.fields && state.open[row.key] ? '<tr><td colspan="' + (cols.length + (showOpener ? 1 : 0)) + '" class="bd-detail">' + row.fields.map(function (field) {
        return "<div>" + esc(field.key) + "：" + esc(field.value) + "</div>";
      }).join("") + '<label>跟进 <input data-act="mark" data-key="' + esc(row.key) + '" data-field="follow" value="' + esc(row.follow) + '"></label><label>打标 <input data-act="mark" data-key="' + esc(row.key) + '" data-field="tag" value="' + esc(row.tag) + '"></label><label>目标 <input data-act="mark" data-key="' + esc(row.key) + '" data-field="target" value="' + esc(row.target) + '"></label></td></tr>' : "";
      var openerLabel = data.page && data.page.id === "channelAnalysisNew" ? "跟进 待办 打标" : "明细";
      var opener = row.fields ? '<button type="button" class="bd-linkish" data-act="expand" data-key="' + esc(row.key) + '">' + openerLabel + "</button>" : "";
      var total = row.name === "全部" || row.name === "全渠道" || row.name === "汇总";
      return '<tr class="' + (total ? "bd-total" : "") + '">' + (showOpener ? "<td>" + opener + "</td>" : "") + cells + "</tr>" + detail;
    }).join("");
    if (!list.length) {
      body = '<tr><td colspan="' + (cols.length + (showOpener ? 1 : 0)) + '">' + (data.coverage.status === "ready" ? "这个范围内没有记录。" : "未采完") + "</td></tr>";
    }
    return '<div class="bd-scroll"><table class="bd-table">' + head + body + "</table></div>";
  }

  function renderShopBlock(data) {
    if (!data.page || data.page.id !== "channelOverview" || !data.tab || data.tab.id !== "qdzl_lb") {
      return "";
    }
    var source = data.shopRows || [];
    var gaps = data.shopGaps || [];
    var gapNote = gaps.length ? '<p class="bd-banner">店铺明细缺失：' + esc(gaps.join("、")) + "。这些天的金额没有采全，不会按 0 计入店铺汇总，已安排补采。</p>" : "";
    var channelPay = Number(sumCell(data.allSum, "payAmount").replace(/,/g, "")) || 0;
    var shopPay = source.reduce(function (sum, row) {
      return sum + (Number((row.metrics || {}).payAmount) || 0);
    }, 0);
    if (source.length && channelPay > 0 && shopPay === 0) {
      return '<section class="bd-block"><div class="bd-block-bar"><h2>店铺列表</h2></div><p class="bd-banner">这一天的店铺明细金额是 0，和渠道支付 ' + esc(sumCell(data.allSum, "payAmount")) + " 对不上。这是明细没采全，不会把缺失显示成真实的 0。已安排补采。</p></section>";
    }
    if (!source.length) {
      if (gapNote) {
        return '<section class="bd-block"><div class="bd-block-bar"><h2>店铺列表</h2></div>' + gapNote + "</section>";
      }
      var waiting = data.shopStatus && data.shopStatus !== "ready" ? "店铺列表还没采完。" : "这个范围内没有店铺记录。";
      return '<section class="bd-block"><div class="bd-block-bar"><h2>店铺列表</h2></div><p class="bd-miss">' + waiting + "</p></section>";
    }
    var columns = [{ key: "shop", label: "店铺", numeric: false, aliases: ["shopName"] }, { key: "platform", label: "渠道", numeric: false, aliases: [] }].concat((data.columns || []).filter(function (column) {
      return column.on && column.key !== "name";
    }));
    var rows = source.map(function (row) {
      var total = isTotalName(row);
      return {
        key: row.key,
        name: total ? "汇总" : row.shop || row.name,
        shop: total ? "汇总" : row.shop || row.name,
        platform: total ? "全部" : row.platform || row.name,
        metrics: row.metrics || {},
        fields: null
      };
    }).sort(function (left, right) {
      return (left.name === "汇总" ? 0 : 1) - (right.name === "汇总" ? 0 : 1);
    });
    var shopBody = state.shopView === "chart" ? renderBars(data, rows) : renderTable(data, rows, columns);
    return '<section class="bd-block"><div class="bd-block-bar"><h2>店铺列表</h2><div class="bd-tools"><button type="button" data-act="shop-view" data-view="list" class="' + (state.shopView === "list" ? "is-on" : "") + '">列表</button><button type="button" data-act="shop-view" data-view="chart" class="' + (state.shopView === "chart" ? "is-on" : "") + '">图表</button><a href="/api/bound/export?' + esc(queryString()) + '">导出</a></div></div>' + gapNote + shopBody + "</section>";
  }

  function isTotalName(row) {
    return row.shop === "合计" || row.name === "全部" || row.name === "全渠道" || row.name === "汇总";
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

  function renderProgress() {
    var progress = state.progress;
    if (!progress || !progress.items) {
      return '<section class="bd-block"><h2 class="bd-block-title">采集进度</h2><p class="bd-miss">正在读取本库进度。</p></section>';
    }
    var counts = progress.counts || {};
    var done = counts.done || 0;
    var total = progress.total || progress.items.length || 1;
    var width = Math.max(0, Math.min(100, Math.round(done / total * 100)));
    var cursor = progress.cursor || {};
    var phase = progress.phase || "";
    var now = "采集还没开始。";
    if (phase === "collecting" && cursor.label) {
      now = "正在采集：" + (cursor.page || "") + " / " + cursor.label + "，" + (cursor.start || "") + (cursor.end && cursor.end !== cursor.start ? " 至 " + cursor.end : "");
    } else if (phase === "collecting") {
      now = "正在采集。这一页每几秒刷新一次。";
    } else if (phase === "logged_in") {
      now = progress.message || "已补到今天。之后按天增量。";
    } else if (phase === "needs_scan" || phase === "waiting_scan") {
      now = "采集停住，等扫码。下面是已经入库的进度。";
    }
    var labels = { done: "已完成", partial: "进行中", failed: "失败", pending: "还没开始" };
    var rows = progress.items.map(function (item) {
      var current = cursor.id === item.id && (cursor.dim || "all") === (item.dim || "all");
      var dim = item.dim && item.dim !== "all" ? " " + item.dim.toUpperCase() : "";
      var statusText = current ? "正在采" : (labels[item.status] || item.status);
      var reason = item.reason || "";
      if (!reason && item.readyDays === 0 && item.failedDays > 0) {
        reason = "还没有一天采集成功，已采天数不会增加";
      }
      var dates = item.failedDates || [];
      var failLine = "";
      if (item.failedDays) {
        failLine = "失败 " + item.failedDays + " 天";
        if (item.retries) {
          failLine += "，已重试 " + item.retries + " 次";
        }
        if (dates.length) {
          failLine += "：" + dates.slice(0, 8).join("、");
          if (dates.length > 8) {
            failLine += " 等 " + dates.length + " 天";
          }
        }
      }
      if (item.failedMonths) {
        failLine += (failLine ? "。" : "") + "整月失败 " + item.failedMonths + " 个";
      }
      var reasonHtml = (reason || failLine) ? '<div class="bd-reason">' + esc([reason, failLine].filter(Boolean).join("。")) + "</div>" : "";
      return '<tr class="' + (current ? "bd-total" : "") + '"><td class="' + (current ? "is-current" : "") + '">' + esc(item.page) + "</td><td>" + esc(item.tab + dim) + "</td><td>" + esc(item.readyDays) + "/" + esc(progress.dayCount) + "</td><td>" + esc(item.failedDays) + "</td><td>" + esc(item.latest || "—") + "</td><td>" + esc(statusText) + reasonHtml + "</td></tr>";
    }).join("");
    return '<section class="bd-block"><h2 class="bd-block-title">采集进度</h2><p class="bd-now">' + esc(now) + "</p><div class=\"bd-meter\"><i style=\"width:" + width + "%\"></i></div><p class=\"bd-status\">已完成 " + esc(done) + " / " + esc(total) + " 张表。进行中 " + esc(counts.partial || 0) + "，失败 " + esc(counts.failed || 0) + "，还没开始 " + esc(counts.pending || 0) + "。范围 " + esc(progress.startOn) + " 至 " + esc(progress.today) + "。</p><div class=\"bd-progress\"><table class=\"bd-table\"><tr><th>页面</th><th>表</th><th>已采天数</th><th>失败</th><th>最近一天</th><th>状态</th></tr>" + rows + "</table></div></section>";
  }

  function renderLink() {
    var link = state.link || {};
    var showQr = link.qrReady && (link.phase === "waiting_scan" || link.phase === "needs_scan" || link.phase === "choose_account");
    var qr = showQr ? '<img class="bd-qr" alt="旧站登录二维码" src="/api/bound/link/qr?ts=' + Date.now() + '">' : "";
    var accounts = (link.accounts || []).map(function (account) {
      return '<button type="button" data-act="pick" data-company="' + esc(account.companyId) + '">' + esc(account.companyName || account.name || account.companyId) + "</button>";
    }).join("");
    return '<section class="bd-main" data-bound-erp="false"><header class="bd-head"><div><h1>扫码连接旧站</h1><p class="bd-sub">二维码来自旧站官方登录接口，和登录页同一张。扫码后服务器沿用这个会话补采，页面查询不再打旧站。</p><p class="bd-status">爬虫，非 ERP。浏览器标识 ' + esc(link.deviceId || "") + "</p></div></header><section class=\"bd-block\"><p>" + esc(link.message || "") + "</p>" + qr + '<div class="bd-tools"><button type="button" data-act="scan" data-provider="WECHAT">微信</button><button type="button" data-act="scan" data-provider="FEISHU">飞书</button><button type="button" data-act="scan" data-provider="DINGTALK">钉钉</button><button type="button" data-act="scan" data-provider="QYWX">企业微信</button>' + accounts + "</div></section>" + renderProgress() + "</section>";
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
    var setting = (data.cards && data.cards.length) ? "cards" : "columns";
    var channelPage = data.page.id === "channelOverview" || data.page.id === "channelAnalysis";
    var tabLabel = data.page.id === "teamSkills" ? "团队成员" : (data.tab && data.tab.label ? data.tab.label : data.page.label);
    var profileOnly = data.page.id === "personalCenter" || data.page.id === "myProjects";
    var tableBlock = profileOnly ? "" : '<section class="bd-block"><div class="bd-block-bar"><h2>' + esc(tabLabel) + '</h2><div class="bd-tools">' +
      (ops.indexOf("dim") >= 0 ? '<button type="button" data-act="dim" data-dim="spu" class="' + (state.dim === "spu" ? "is-on" : "") + '">SPU</button><button type="button" data-act="dim" data-dim="sku" class="' + (state.dim === "sku" ? "is-on" : "") + '">SKU</button>' : "") +
      (channelPage ? '<button type="button" data-act="panel" data-panel="cards">目标</button><button type="button" data-act="view" data-view="list" class="' + (state.view === "list" ? "is-on" : "") + '">列表</button><button type="button" data-act="view" data-view="chart" class="' + (state.view === "chart" ? "is-on" : "") + '">图表</button><button type="button" data-act="panel" data-panel="columns">默认视窗</button>' : "") +
      (ops.indexOf("views") >= 0 ? '<button type="button" data-act="view" data-view="list" class="' + (state.view === "list" ? "is-on" : "") + '">列表</button><button type="button" data-act="view" data-view="period" class="' + (state.view === "period" ? "is-on" : "") + '">周期</button><button type="button" data-act="view" data-view="gallery" class="' + (state.view === "gallery" ? "is-on" : "") + '">大图</button>' : "") +
      (ops.indexOf("export") >= 0 ? '<a href="/api/bound/export?' + esc(queryString()) + '">' + (data.page.id === "productStock" ? "导出表格数据" : "导出") + "</a>" : "") +
      (data.page.id === "productOverview" ? '<button type="button" data-act="panel" data-panel="columns">自定义数据字段</button><button type="button" data-act="panel" data-panel="batch" data-field="follow">设置跟进</button><button type="button" data-act="panel" data-panel="batch" data-field="target">设置目标</button><button type="button" data-act="panel" data-panel="batch" data-field="tag">批量打标</button>' : "") +
      (data.page.id === "productOperation" ? '<button type="button" data-act="panel" data-panel="upload">上传报表</button>' : "") +
      '<button type="button" data-act="panel" data-panel="columns">更多</button></div></div>' +
      renderTable(data) +
      renderSums(data) +
      '<div class="bd-pager"><span>共 ' + esc(data.total) + ' 条</span><span>50条/页</span><button type="button" data-act="page-no" data-delta="-1">上一页</button><span>第 ' + esc(data.pageNo) + ' 页</span><button type="button" data-act="page-no" data-delta="1">下一页</button></div></section>';
    return '<section class="bd-main" data-bound-erp="false" data-page="' + esc(data.page.id) + '" data-coverage="' + esc(data.coverage.status) + '">' +
      '<header class="bd-head"><div><h1>' + esc(data.page.label) + '</h1><p class="bd-sub">' + esc(BLURBS[data.page.id] || "") + "</p>" + renderStatus(data) + "</div>" +
      '<div class="bd-filters">' +
      (ops.indexOf("date") >= 0 ? renderDateBar(data) : "") +
      (ops.indexOf("shop") >= 0 ? "<select data-act=\"shop\">" + shops + "</select>" : "") +
      (ops.indexOf("search") >= 0 ? '<input data-act="q" value="' + esc(state.q) + '" placeholder="' + esc(searchPlaceholder(data.page.id)) + '">' : "") +
      (data.cards && data.cards.length ? "" : '<button type="button" class="bd-primary" data-act="panel" data-panel="' + setting + '">设定指标</button>') + "</div></header>" +
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
    var view = state.page === "link" ? null : await fetch("/api/bound/view?" + queryString());
    var catalog = state.catalog ? null : await fetch("/api/bound/catalog");
    var link = await fetch("/api/bound/link");
    var progress = state.page === "link" ? await fetch("/api/bound/progress") : null;
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
    if (progress && progress.ok) {
      state.progress = await progress.json();
    }
    if (view && view.ok) {
      state.viewData = await view.json();
      if (state.viewData.page && state.viewData.page.id && state.page !== "link") {
        state.page = state.viewData.page.id;
      }
      if (state.viewData.range) {
        state.from = state.viewData.range.from;
        state.to = state.viewData.range.to;
        state.daysType = state.viewData.daysType || (state.from === state.to ? "1" : "custom");
      }
    } else if (view) {
      state.viewData = null;
      state.error = "这一页没有读到";
    }
    state.admin = link.ok;
    state.link = link.ok ? await link.json() : null;
    paint(root);
  }

  function openPicker(root, preset) {
    var act = { date: "pick-date", week: "pick-week", month: "pick-month" }[preset];
    if (!act || !root.querySelector) {
      return false;
    }
    var input = root.querySelector("[data-act='" + act + "']");
    if (!input || typeof input.showPicker !== "function") {
      return false;
    }
    try {
      input.showPicker();
      return true;
    } catch (error) {
      return false;
    }
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
      } else if (act === "sort") {
        var sortKey = node.getAttribute("data-key");
        if (state.sortKey === sortKey) {
          state.sortDir = state.sortDir === "desc" ? "asc" : "desc";
        } else {
          state.sortKey = sortKey;
          state.sortDir = "desc";
        }
        paint(root);
        return;
      } else if (act === "view") {
        state.view = node.getAttribute("data-view");
        paint(root);
        return;
      } else if (act === "shop-view") {
        state.shopView = node.getAttribute("data-view");
        paint(root);
        return;
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
        var presetName = node.getAttribute("data-preset");
        if (presetName === "custom") {
          state.datePop = state.datePop === "custom" ? "" : "custom";
          state.calAnchor = "";
          state.calMonth = (state.from || shanghaiToday()).slice(0, 7);
          paint(root);
          return;
        }
        if (presetName === "year") {
          state.datePop = state.datePop === "year" ? "" : "year";
          paint(root);
          return;
        }
        state.datePop = "";
        if (presetName === "day7" || presetName === "day30") {
          applyRange(rollingRange(presetName === "day7" ? 7 : 30));
        } else if (!openPicker(root, presetName)) {
          var fallback = defaultCalendarRange(presetName);
          if (!fallback) {
            return;
          }
          applyRange(fallback);
        } else {
          return;
        }
      } else if (act === "shift") {
        if (node.disabled) {
          return;
        }
        var nextRange = shiftRange(Number(node.getAttribute("data-delta") || 0));
        if (!nextRange) {
          return;
        }
        state.datePop = "";
        applyRange(nextRange);
      } else if (act === "pick-year") {
        var year = node.getAttribute("data-year");
        var yearRange = clampRange(year + "-01-01", year + "-12-31");
        state.datePop = "";
        applyRange({ from: yearRange.from, to: yearRange.to, daysType: "year" });
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
      } else if (act === "cal-shift") {
        var nextMonth = addMonth(state.calMonth || shanghaiToday().slice(0, 7), Number(node.getAttribute("data-delta") || 0));
        var todayMonth = shanghaiToday().slice(0, 7);
        if (nextMonth >= "2026-09" && nextMonth <= todayMonth) {
          state.calMonth = nextMonth;
          paint(root);
        }
        return;
      } else if (act === "cal-day") {
        if (node.disabled) {
          return;
        }
        var picked = node.getAttribute("data-day");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(picked || "")) {
          return;
        }
        if (!state.calAnchor) {
          state.calAnchor = picked;
          paint(root);
          return;
        }
        var start = state.calAnchor < picked ? state.calAnchor : picked;
        var end = state.calAnchor < picked ? picked : state.calAnchor;
        if (daySpan(start, end) > 31) {
          return;
        }
        var chosen = clampRange(start, end);
        state.calAnchor = "";
        state.datePop = "";
        applyRange({ from: chosen.from, to: chosen.to, daysType: "custom" });
        load(root, token);
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
      if (act === "shop") {
        state.shop = node.value;
        state.pageNo = 1;
        load(root, token);
        return;
      }
      if (act === "pick-date") {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(node.value || "")) {
          return;
        }
        var pickedDay = clampRange(node.value, node.value);
        state.datePop = "";
        applyRange({ from: pickedDay.from, to: pickedDay.to, daysType: "1" });
        load(root, token);
        return;
      }
      if (act === "pick-week") {
        var monday = mondayFromWeekValue(node.value);
        if (!monday || weekContains(monday, shanghaiToday())) {
          return;
        }
        var week = clampRange(monday, iso(addDays(parseIso(monday), 6)));
        state.datePop = "";
        applyRange({ from: week.from, to: week.to, daysType: "week" });
        load(root, token);
        return;
      }
      if (act === "pick-month") {
        if (!/^\d{4}-\d{2}$/.test(node.value || "")) {
          return;
        }
        var monthStart = node.value + "-01";
        var month = clampRange(monthStart, monthEndIso(monthStart));
        state.datePop = "";
        applyRange({ from: month.from, to: month.to, daysType: "month" });
        load(root, token);
        return;
      }
      if (act === "range-from" || act === "range-to") {
        state[act === "range-from" ? "from" : "to"] = node.value;
        state.daysType = "custom";
        state.pageNo = 1;
        if (state.from && state.to) {
          load(root, token);
        }
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
