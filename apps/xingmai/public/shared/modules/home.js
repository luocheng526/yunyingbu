/* xm-module-home 0.1.723-home-headset */
(function () {
  var VIEWS = [
    { key: "company", label: "公司" },
    { key: "team", label: "经理团队" },
    { key: "chief", label: "主管/储备" },
    { key: "live", label: "实时" },
    { key: "board", label: "排行榜" }
  ];
  var RANGES = [
    { key: "yesterday", label: "昨天" },
    { key: "month", label: "本月" },
    { key: "lastMonth", label: "上月" },
    { key: "year", label: "今年" }
  ];
  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }
  function ymdFmt(tz, date) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  }
  function shanghaiYmd(daysAgo) {
    var today = ymdFmt("Asia/Shanghai", new Date());
    var shift = Number(daysAgo) || 0;
    if (!shift) {
      return today;
    }
    var parts = today.split("-").map(Number);
    return ymdFmt("UTC", new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] - shift)));
  }
  function rangeDates(range) {
    if (range === "month") {
      var today = shanghaiYmd(0);
      return { from: today.slice(0, 8) + "01", to: today };
    }
    if (range === "lastMonth") {
      var first = shanghaiYmd(0).slice(0, 8) + "01";
      var parts = first.split("-").map(Number);
      var prev = new Date(Date.UTC(parts[0], parts[1] - 2, 1));
      var last = new Date(Date.UTC(parts[0], parts[1] - 1, 0));
      return { from: ymdFmt("UTC", prev), to: ymdFmt("UTC", last) };
    }
    if (range === "year") {
      return { from: shanghaiYmd(0).slice(0, 4) + "-01-01", to: shanghaiYmd(0) };
    }
    var y = shanghaiYmd(1);
    return { from: y, to: y };
  }
  function parseYmd(ymd) {
    var p = String(ymd || "").split("-");
    return new Date(Date.UTC(Number(p[0]) || 1970, (Number(p[1]) || 1) - 1, Number(p[2]) || 1));
  }
  function ymdFromUtc(date) {
    return ymdFmt("UTC", date);
  }
  function diffYmd(from, to) {
    return Math.round((parseYmd(to) - parseYmd(from)) / 86400000);
  }
  function withinDays(from, to, maxInclusive) {
    return Math.abs(diffYmd(from, to)) + 1 <= (maxInclusive || 30);
  }
  function formatDashDate(ymd) {
    var p = String(ymd || "").split("-");
    if (p.length < 3 || !p[0]) {
      return "—";
    }
    return ("0000" + Number(p[0])).slice(-4) + "-" + ("0" + Number(p[1])).slice(-2) + "-" + ("0" + Number(p[2])).slice(-2);
  }
  function shiftMonth(ym, delta) {
    var p = String(ym || "").split("-");
    var d = new Date(Date.UTC(Number(p[0]) || 1970, (Number(p[1]) || 1) - 1 + (Number(delta) || 0), 1));
    return ymdFromUtc(d).slice(0, 7);
  }
  function monthTitle(ym) {
    var p = String(ym || "").split("-");
    return Number(p[0]) + "年 " + Number(p[1]) + "月";
  }
  function monthLastDay(ym) {
    var first = parseYmd(ym + "-01");
    return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  }
  function calDayClass(ymd, opts, other) {
    var start = opts.start;
    var end = opts.end || opts.hover;
    if (start && end && start > end) {
      var swap = start;
      start = end;
      end = swap;
    }
    var cls = [];
    if (other) {
      cls.push("is-other");
    }
    if (ymd > opts.today || (opts.pick && !withinDays(opts.pick, ymd, 30))) {
      cls.push("is-off");
    }
    if (ymd === opts.today) {
      cls.push("is-today");
    }
    if (start && end && ymd >= start && ymd <= end) {
      cls.push("is-in");
    }
    if (ymd === start) {
      cls.push("is-start");
    }
    if (ymd === end) {
      cls.push("is-end");
    }
    return cls;
  }
  function tipAttr(text) {
    return escapeHtml(text || "指标").replaceAll("\n", "&#10;");
  }
  var cardTipEl = null;
  var lineTipEl = null;
  var cardTipAnchor = null;
  function cardTipText(el) {
    return String((el && el.getAttribute("data-tip")) || "").replace(/&#10;/g, "\n");
  }
  function cardTipNode() {
    if (cardTipEl && document.body.contains(cardTipEl)) {
      return cardTipEl;
    }
    cardTipEl = document.createElement("div");
    cardTipEl.id = "xm-hm-tip";
    cardTipEl.className = "xm-hm-tip";
    document.body.appendChild(cardTipEl);
    return cardTipEl;
  }
  function hideCardTip() {
    cardTipAnchor = null;
    if (cardTipEl) {
      cardTipEl.classList.remove("is-on");
      cardTipEl.textContent = "";
    }
  }
  function placeCardTip(anchor) {
    var tip = cardTipNode();
    var box = anchor.getBoundingClientRect();
    tip.classList.add("is-on");
    var tw = tip.offsetWidth || 280;
    var th = tip.offsetHeight || 80;
    var left = Math.max(8, Math.min(box.right - tw, window.innerWidth - tw - 8));
    var top = box.bottom + 8;
    if (top + th > window.innerHeight - 8 && box.top - th - 8 >= 8) top = box.top - th - 8;
    if (top < 8) top = 8;
    tip.style.left = Math.round(left) + "px";
    tip.style.top = Math.round(top) + "px";
  }
  function showCardTip(anchor) {
    var text = cardTipText(anchor);
    if (!text) {
      return;
    }
    cardTipAnchor = anchor;
    cardTipNode().textContent = text;
    placeCardTip(anchor);
  }
  function helpFromEvent(event) {
    return event.target && event.target.closest ? event.target.closest(".xm-hm-help") : null;
  }
  function lineTipNode() {
    if (lineTipEl && document.body.contains(lineTipEl)) {
      return lineTipEl;
    }
    lineTipEl = document.createElement("div");
    lineTipEl.id = "xm-hm-line-tip";
    lineTipEl.className = "xm-hm-line-tip";
    document.body.appendChild(lineTipEl);
    return lineTipEl;
  }
  function hideLineTip(root) {
    if (lineTipEl) {
      lineTipEl.classList.remove("is-on");
      lineTipEl.innerHTML = "";
    }
    var guides = root && root.querySelectorAll ? root.querySelectorAll(".xm-hm-line-guide, .xm-hm-bar-guide") : [];
    Array.prototype.forEach.call(guides, function (guide) {
      guide.setAttribute("visibility", "hidden");
    });
  }
  function tipNum(value, unit) {
    return unit === "rate" ? fmtRate(value) : fmtMoney(value);
  }
  function lineTipHtml(hour, yestHour, yestCum, todayHour, todayOk, todayCum, label, part, unit) {
    return (
      "<b>" +
      escapeHtml(label != null && label !== "" ? label : String(hour + 1)) +
      "</b>" +
      '<div class="xm-hm-line-row"><span><i class="is-yest"></i>昨天</span><em>' +
      escapeHtml(tipNum(yestCum, unit)) +
      "</em></div>" +
      '<div class="xm-hm-line-sub"><span>' +
      escapeHtml(part || "本小时") +
      "</span><span>" +
      escapeHtml(tipNum(yestHour, unit)) +
      "</span></div>" +
      '<div class="xm-hm-line-row"><span><i class="is-today"></i>实时</span><em>' +
      (todayOk ? escapeHtml(tipNum(todayCum, unit)) : "—") +
      "</em></div>" +
      '<div class="xm-hm-line-sub"><span>' +
      escapeHtml(part || "本小时") +
      "</span><span>" +
      (todayOk ? escapeHtml(tipNum(todayHour, unit)) : "—") +
      "</span></div>"
    );
  }
  function calMonthHtml(ym, opts, side) {
    var first = parseYmd(ym + "-01");
    var pad = (first.getUTCDay() + 6) % 7;
    var last = monthLastDay(ym);
    var prevYm = shiftMonth(ym, -1);
    var nextYm = shiftMonth(ym, 1);
    var prevLast = monthLastDay(prevYm);
    var cells = [];
    var i;
    for (i = 0; i < pad; i++) {
      cells.push({ ymd: prevYm + "-" + ("0" + (prevLast - pad + 1 + i)).slice(-2), num: prevLast - pad + 1 + i, other: true });
    }
    for (i = 1; i <= last; i++) {
      cells.push({ ymd: ym + "-" + ("0" + i).slice(-2), num: i, other: false });
    }
    i = 1;
    while (cells.length < 42) {
      cells.push({ ymd: nextYm + "-" + ("0" + i).slice(-2), num: i, other: true });
      i += 1;
    }
    var navLeft =
      side === "left"
        ? '<button type="button" data-cal-nav="-12">《</button><button type="button" data-cal-nav="-1">&lt;</button>'
        : "";
    var navRight =
      side === "right"
        ? '<button type="button" data-cal-nav="1">&gt;</button><button type="button" data-cal-nav="12">》</button>'
        : "";
    var html =
      '<div class="xm-hm-cal-month"><div class="xm-hm-cal-caption"><div class="xm-hm-cal-nav">' +
      navLeft +
      "</div><strong>" +
      monthTitle(ym) +
      '</strong><div class="xm-hm-cal-nav is-end">' +
      navRight +
      '</div></div><div class="xm-hm-cal-week"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div><div class="xm-hm-cal-grid">';
    cells.forEach(function (cell) {
      var cls = calDayClass(cell.ymd, opts, cell.other);
      var disabled = cls.indexOf("is-off") !== -1;
      html +=
        '<button type="button" data-ymd="' +
        cell.ymd +
        '"' +
        (disabled ? " disabled" : "") +
        (cls.length ? ' class="' + cls.join(" ") + '"' : "") +
        ">" +
        cell.num +
        "</button>";
    });
    return html + "</div></div>";
  }
  function calPanelHtml(cursor, opts) {
    return (
      '<div class="xm-hm-cal-months">' +
      calMonthHtml(cursor, opts, "left") +
      calMonthHtml(shiftMonth(cursor, 1), opts, "right") +
      '</div><p class="xm-hm-cal-hint">先点开始日期，再点结束日期，最多连续30天</p>'
    );
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
  var viewKey = "company";
  var cardSetOpen = false;
  var headSetOpen = false;
  var teamsRefreshing = false;
  var liveRefreshing = false;
  function viewStore(kind) {
    return viewKey === "team" || viewKey === "chief"
      ? "xm-home-" + viewKey + "-" + kind
      : kind === "hide"
        ? "xm-home-hidden-cards"
        : "xm-home-card-order";
  }
  function hiddenCards() {
    try {
      var raw = localStorage.getItem(viewStore("hide"));
      return raw ? JSON.parse(raw) : [];
    } catch (_err) {
      return [];
    }
  }
  function teamHidden(hide) {
    var out = (hide || []).slice();
    try {
      if (localStorage.getItem(viewStore("hide")) == null && out.indexOf("netQty") === -1) {
        out.push("netQty");
      }
    } catch (_err) {}
    return out;
  }
  function saveHidden(list) {
    try {
      localStorage.setItem(viewStore("hide"), JSON.stringify(list));
    } catch (_err) {}
  }
  function goneTeams() {
    try {
      return viewKey === "team" || viewKey === "chief" ? JSON.parse(localStorage.getItem(viewStore("gone")) || "[]") || [] : [];
    } catch (_err) {
      return [];
    }
  }
  function saveGone(list) {
    try {
      if (viewKey === "team" || viewKey === "chief") localStorage.setItem(viewStore("gone"), JSON.stringify(list || []));
    } catch (_err) {}
  }
  function defaultCardKeys() {
    return COMPANY_CARD_DEFS.map(function (def) {
      return def.key;
    });
  }
  function cardOrder() {
    var defs = defaultCardKeys();
    var saved = [];
    try {
      saved = JSON.parse(localStorage.getItem(viewStore("order")) || "[]");
    } catch (_err) {
      saved = [];
    }
    if (Object.prototype.toString.call(saved) !== "[object Array]") {
      saved = [];
    }
    var seen = {};
    var out = [];
    saved.forEach(function (key) {
      if (defs.indexOf(key) !== -1 && !seen[key]) {
        seen[key] = true;
        out.push(key);
      }
    });
    defs.forEach(function (key) {
      if (!seen[key]) {
        out.push(key);
      }
    });
    return out;
  }
  function saveCardOrder(keys) {
    try {
      localStorage.setItem(viewStore("order"), JSON.stringify(cardOrderFrom(keys)));
    } catch (_err) {}
  }
  function cardOrderFrom(keys) {
    var defs = defaultCardKeys();
    var seen = {};
    var out = [];
    (keys || []).forEach(function (key) {
      if (defs.indexOf(key) !== -1 && !seen[key]) {
        seen[key] = true;
        out.push(key);
      }
    });
    defs.forEach(function (key) {
      if (!seen[key]) {
        out.push(key);
      }
    });
    return out;
  }
  function applyCardMove(fromKey, toKey, visibleOnly) {
    var full = cardOrder();
    var hide = hiddenCards();
    var seq = visibleOnly
      ? full.filter(function (key) {
          return hide.indexOf(key) === -1;
        })
      : full.slice();
    var from = seq.indexOf(fromKey);
    var to = seq.indexOf(toKey);
    if (from < 0 || to < 0 || from === to) {
      return full;
    }
    seq.splice(from, 1);
    seq.splice(to, 0, fromKey);
    if (!visibleOnly) {
      return seq;
    }
    var i = 0;
    return full.map(function (key) {
      if (hide.indexOf(key) !== -1) {
        return key;
      }
      return seq[i++];
    });
  }
  function arrangeCards(cards) {
    var map = {};
    (cards || []).forEach(function (card) {
      if (card) {
        map[card.key] = card;
      }
    });
    return cardOrder()
      .map(function (key) {
        return map[key];
      })
      .filter(Boolean);
  }
  function companySetCards(cards) {
    return arrangeCards(cards || blankCompanyCards());
  }
  function companyHideKeys(cards) {
    return arrangeCards(cards || blankCompanyCards()).map(function (card) {
      return card.key;
    });
  }
  function colOrderKey(simple) {
    return simple ? "xm-home-chief-cols" : "xm-home-mgr-cols";
  }
  function orderTeams(teams, simple) {
    var list = teams || [];
    var saved = [];
    try {
      saved = JSON.parse(localStorage.getItem(colOrderKey(simple)) || "[]");
    } catch (_err) {
      saved = [];
    }
    var by = {};
    list.forEach(function (team) {
      if (team && team.name) {
        by[team.name] = team;
      }
    });
    var out = [];
    saved.forEach(function (name) {
      if (by[name]) {
        out.push(by[name]);
        delete by[name];
      }
    });
    list.forEach(function (team) {
      if (team && by[team.name]) {
        out.push(team);
      }
    });
    return out;
  }
  function saveTeamCols(fromName, toName, simple) {
    var names = Array.prototype.map.call(document.querySelectorAll(".xm-hm-team[data-name]"), function (el) {
      return el.getAttribute("data-name");
    });
    var from = names.indexOf(fromName);
    var to = names.indexOf(toName);
    if (from < 0 || to < 0 || from === to) {
      return;
    }
    names.splice(from, 1);
    names.splice(to, 0, fromName);
    try {
      localStorage.setItem(colOrderKey(simple), JSON.stringify(names));
    } catch (_err) {}
  }
  function trendHtml(trend) {
    if (trend == null || trend === "") {
      return '<div class="xm-hm-trend"></div>';
    }
    var n = Number(trend);
    var up = n >= 0;
    return (
      '<div class="xm-hm-trend ' +
      (up ? "is-up" : "is-down") +
      '">环比 ' +
      (up ? "↗" : "↘") +
      " " +
      Math.round(Math.abs(n)) +
      "%</div>"
    );
  }
  function rankMark(index) {
    return index < 3
      ? '<b class="xm-hm-cup ' + ["gold", "silver", "bronze"][index] + '">' + (index + 1) + "</b>"
      : "<span>" + (index + 1) + "</span>";
  }
  function cardHtml(card, teamKey) {
    return (
      '<article class="xm-hm-card" data-card="' +
      escapeHtml(card.key) +
      '"' +
      (teamKey ? ' data-team="' + escapeHtml(teamKey) + '"' : "") +
      '><div class="xm-hm-card-head"><span>' +
      escapeHtml(card.label) +
      '</span><button type="button" class="xm-hm-help" data-tip="' +
      tipAttr(card.tip) +
      '" aria-label="指标说明">!</button></div><div class="xm-hm-value' +
      (card.accent ? " is-accent" : "") +
      '">' +
      escapeHtml(card.value) +
      "</div>" +
      trendHtml(card.trend) +
      "</article>"
    );
  }
  function shopColLabel(def) {
    return String(def.label || "").replace(/\s*\([^)]*\)\s*/g, "").replace(/\s+/g, "");
  }
  var SHOP_CARD_KEYS = ["adRatio", "profit", "grossMargin", "refundRate", "netGoodsCost"];
  function shopCols() {
    var map = {};
    COMPANY_CARD_DEFS.forEach(function (def) {
      map[def.key] = def;
    });
    return SHOP_CARD_KEYS.map(function (key) {
      return map[key];
    }).filter(Boolean);
  }
  var shopSort = { key: "", dir: "desc" };
  var shopColW = {};
  function colKey(table) {
    if (table && table.closest && table.closest(".xm-hm-live")) {
      return "live";
    }
    var box = table && table.closest && table.closest("[data-team]");
    return box ? box.getAttribute("data-team") || "t" : "t";
  }
  function applyColW(table, idx, w, snap) {
    if (!table || !table.rows || !table.rows[0]) return;
    var key = colKey(table);
    var heads = table.rows[0].cells;
    var list = shopColW[key];
    var i, r, cell, cw, sum = 0;
    if (snap || !list) {
      list = [];
      for (i = 0; i < heads.length; i += 1) list[i] = heads[i].offsetWidth;
    }
    if (idx != null && w != null) list[idx] = Math.max(48, Math.round(w));
    shopColW[key] = list;
    var cols = table.querySelectorAll ? table.querySelectorAll("col") : [];
    for (i = 0; i < list.length; i += 1) {
      cw = list[i];
      if (!cw) continue;
      sum += cw;
      if (cols[i]) {
        cols[i].style.width = cols[i].style.minWidth = cols[i].style.maxWidth = cw + "px";
      }
      for (r = 0; r < table.rows.length; r += 1) {
        cell = table.rows[r].cells[i];
        if (cell) cell.style.width = cell.style.minWidth = cell.style.maxWidth = cw + "px";
      }
    }
    if (sum) table.style.width = table.style.minWidth = table.style.maxWidth = sum + "px";
  }
  function restoreShopColW(root) {
    loadLiveColW();
    Array.prototype.forEach.call(root.querySelectorAll(".xm-hm-teams .xm-hm-table, .xm-hm-live .xm-hm-table"), function (table) {
      if (shopColW[colKey(table)]) applyColW(table);
    });
  }
  function loadLiveColW() {
    var need = liveCols().length;
    if (shopColW.live && shopColW.live.length && shopColW.live.length !== need) {
      delete shopColW.live;
    }
    if (shopColW.live && shopColW.live.length) {
      return;
    }
    try {
      var list = JSON.parse(localStorage.getItem("xm-home-live-cols") || "[]");
      if (Object.prototype.toString.call(list) === "[object Array]" && list.length === need) {
        shopColW.live = list.map(function (n) {
          return Math.max(48, Math.round(Number(n) || 48));
        });
      }
    } catch (_err) {}
  }
  function saveLiveColW() {
    try {
      if (shopColW.live && shopColW.live.length) {
        localStorage.setItem("xm-home-live-cols", JSON.stringify(shopColW.live));
      }
    } catch (_err) {}
  }
  function metricSortNum(text) {
    return text && text !== "—" ? asNum(String(text).replace(/%/g, "")) : null;
  }
  function sortedShops(shops, sort) {
    var list = (shops || []).slice();
    var key = sort && sort.key;
    var dir = sort && sort.dir === "asc" ? 1 : -1;
    list.sort(function (a, b) {
      var pay = (Number(b._pay) || 0) - (Number(a._pay) || 0);
      if (!key) {
        return pay;
      }
      var av = metricSortNum(a.metrics && a.metrics[key]);
      var bv = metricSortNum(b.metrics && b.metrics[key]);
      if (av == null && bv == null || av === bv) {
        return pay;
      }
      if (av == null) {
        return 1;
      }
      if (bv == null) {
        return -1;
      }
      return av > bv ? dir : -dir;
    });
    return list;
  }
  function shopColHead(def, sort) {
    var k = def.key;
    var on = sort && sort.key === k ? sort.dir : "";
    return (
      '<th class="xm-hm-num xm-hm-sort" data-shop-card="' +
      escapeHtml(k) +
      '"><span class="xm-hm-sort-h"><span>' +
      escapeHtml(shopColLabel(def)) +
      '</span><span class="xm-hm-sort-btns"><button type="button" class="xm-hm-sort-up' +
      (on === "asc" ? " is-on" : "") +
      '" data-shop-sort="' +
      escapeHtml(k) +
      '" data-dir="asc" aria-label="升序">▲</button><button type="button" class="xm-hm-sort-dn' +
      (on === "desc" ? " is-on" : "") +
      '" data-shop-sort="' +
      escapeHtml(k) +
      '" data-dir="desc" aria-label="降序">▼</button></span></span></th>'
    );
  }
  function shopMetricsFrom(row) {
    var out = {};
    companyCardsFrom(row ? withRates(row) : {}, {}).forEach(function (card) {
      out[card.key] = card.value;
    });
    return out;
  }
  function shopRowHtml(row, index, cols) {
    var metrics = row.metrics || {};
    return (
      "<tr><td>" +
      rankMark(index) +
      "</td><td>" +
      escapeHtml(row.shop) +
      "</td>" +
      (cols || [])
        .map(function (def) {
          return '<td class="xm-hm-num">' + escapeHtml(metrics[def.key] == null ? "—" : metrics[def.key]) + "</td>";
        })
        .join("") +
      "<td>" +
      escapeHtml(row.owner || "—") +
      "</td></tr>"
    );
  }
  function teamHeadHtml(team, simple) {
    return (
      '<header class="xm-hm-team-head" data-team="' +
      escapeHtml(team.key) +
      '"><div><h2>' +
      escapeHtml(team.name) +
      "团队</h2></div>" +
      (simple
        ? '<button type="button" class="xm-hm-drop" data-drop-team="' +
          escapeHtml(team.name) +
          '" title="删除此团队">×</button>'
        : "") +
      "</header>"
    );
  }
  function teamShopsHtml(team, simple) {
    if (simple) {
      return "";
    }
    var shops = sortedShops(team.shops || [], shopSort);
    var cols = shopCols();
    var sort = shopSort;
    return (
      '<div class="xm-hm-panel" data-team="' +
      escapeHtml(team.key) +
      '"><h2>责权店铺 <span>' +
      shops.length +
      " 店</span></h2>" +
      '<table class="xm-hm-table"><thead><tr><th><span>排名</span></th><th><span>店铺名称</span></th>' +
      cols
        .map(function (def) {
          return shopColHead(def, sort);
        })
        .join("") +
      "<th><span>运营</span></th></tr></thead><tbody>" +
      shops
        .map(function (row, i) {
          return shopRowHtml(row, i, cols);
        })
        .join("") +
      "</tbody></table></div>"
    );
  }
  function teamBlockHtml(team, hide, simple) {
    var cards = (team.cards || []).filter(function (card) {
      return hide.indexOf(card.key) === -1;
    });
    return (
      '<section class="xm-hm-team" data-team="' +
      escapeHtml(team.key) +
      '" data-name="' +
      escapeHtml(team.name) +
      '">' +
      teamHeadHtml(team, simple) +
      '<div class="xm-hm-team-kpis">' +
      cards
        .map(function (card) {
          return cardHtml(card, team.key);
        })
        .join("") +
      "</div>" +
      teamShopsHtml(team, simple) +
      "</section>"
    );
  }
  function teamsCompareHtml(teams, hide, simple) {
    var gone = goneTeams();
    var list = orderTeams(teams && teams.length ? teams : simple ? [] : blankTeams(), simple).filter(function (team) {
      return gone.indexOf(team.name) === -1;
    });
    return (
      '<div class="xm-hm-teams-bar"><b>星脉甄选</b><span><button type="button" data-refresh-teams' +
      (teamsRefreshing ? " disabled" : "") +
      ">" +
      (teamsRefreshing ? "更新中…" : "更新团队") +
      '</button><button type="button" data-show-teams>恢复所有团队的卡片</button><button type="button" class="xm-hm-set">卡片设置</button></span></div><div class="xm-hm-teams-grid">' +
      list
        .map(function (team) {
          return teamBlockHtml({ key: team.key, name: team.name, cards: arrangeCards(team.cards), shops: team.shops }, hide, simple);
        })
        .join("") +
      "</div>"
    );
  }
  function homeUserName(user) {
    return String((user && (user.displayName || user.username)) || "").trim();
  }
  function isHomeBoss(user) {
    var n = homeUserName(user);
    return n === "罗成" || n === "韩梦凯" || n === "沈子晗";
  }
  function findRosterPerson(people, user) {
    var n = homeUserName(user);
    if (!n) {
      return null;
    }
    var list = people || [];
    var i;
    for (i = 0; i < list.length; i += 1) {
      var person = list[i];
      if (!person) {
        continue;
      }
      if (String(person.name || "").trim() === n || String(person.username || "").trim() === n) {
        return person;
      }
    }
    return null;
  }
  function shopOnUserDuty(shop, user) {
    var n = homeUserName(user);
    if (!shop || !n) {
      return false;
    }
    return (
      String(shop.manager || "").trim() === n ||
      shopSupervisorName(shop) === n ||
      shopReserveName(shop) === n ||
      String(shop.operator || "").trim() === n ||
      String(shop.assistant || "").trim() === n
    );
  }
  function userIsChief(user, people, shops) {
    if (isHomeBoss(user)) {
      return true;
    }
    var role = String((user && user.role) || "").trim();
    if (role === "主管" || role === "储备") {
      return true;
    }
    if (personIsChief(findRosterPerson(people, user))) {
      return true;
    }
    var n = homeUserName(user);
    if (!n) {
      return false;
    }
    return (shops || []).some(function (shop) {
      return shopSupervisorName(shop) === n || shopReserveName(shop) === n;
    });
  }
  function canSeeTeamView(user) {
    return isHomeBoss(user);
  }
  function canSeeChiefView(user, people, shops) {
    return userIsChief(user, people, shops);
  }
  function allowedHomeViews(user, people, shops) {
    return {
      company: true,
      team: canSeeTeamView(user),
      chief: canSeeChiefView(user, people, shops),
      live: true,
      board: true
    };
  }
  function seesAllChiefs(user) {
    return canSeeChiefView(user);
  }
  function filterOwnChiefs(teams, user, people, shops) {
    return canSeeChiefView(user, people, shops) ? teams || [] : [];
  }
  function dutyShopKeys(shops, user) {
    if (!homeUserName(user)) {
      return {};
    }
    if (isHomeBoss(user)) {
      return null;
    }
    var keys = {};
    (shops || []).forEach(function (shop) {
      if (!shopOnUserDuty(shop, user)) {
        return;
      }
      var id = shopErpId(shop) || normShopId(shop.shopId);
      var name = normShopName(shopDisplayName(shop));
      if (id) {
        keys["id:" + id] = true;
      }
      if (name && name !== "—") {
        keys["name:" + name] = true;
      }
    });
    return keys;
  }
  function recordOnDuty(row, keys) {
    if (!keys) {
      return true;
    }
    if (!row) {
      return false;
    }
    var id = erpRecordId(row) || normShopId(row.shopId || row.id);
    var name = normShopName(row.shopName || row.storeName || row.name);
    return !!((id && keys["id:" + id]) || (name && keys["name:" + name]));
  }
  function scopeRecords(records, keys) {
    if (!keys) {
      return records || [];
    }
    return (records || []).filter(function (row) {
      return recordOnDuty(row, keys);
    });
  }
  function scopePack(pack, keys) {
    pack = pack || {};
    if (!keys) {
      return pack;
    }
    var records = scopeRecords(pack.records, keys);
    return { records: records, summary: sumPack(records), hourly: null };
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
  function restRows(rows) {
    var rest = (rows || []).slice(3, 10);
    var out = rest.slice();
    while (out.length < 7) {
      out.push({ name: "—", amount: "—" });
    }
    return out;
  }
  function podiumBodyHtml(rows, unit, label) {
    var list = rows || [];
    var first = list[0] || { name: "—", amount: "—" };
    var second = list[1] || { name: "—", amount: "—" };
    var third = list[2] || { name: "—", amount: "—" };
    return (
      (label ? '<h4 class="xm-hm-podium-sub">' + escapeHtml(label) + "</h4>" : "") +
      '<div class="xm-hm-stand">' +
      standItemHtml(second, 2, unit) +
      standItemHtml(first, 1, unit) +
      standItemHtml(third, 3, unit) +
      '</div><ol class="xm-hm-rest">' +
      restRows(list)
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
      "</ol>"
    );
  }
  function podiumColumnHtml(column, unit) {
    var blocks =
      column.blocks && column.blocks.length
        ? column.blocks
        : [{ rows: column.rows || [], unit: unit }];
    return (
      '<article class="xm-hm-podium"><h3>' +
      escapeHtml(column.title) +
      "</h3>" +
      blocks
        .map(function (block) {
          return podiumBodyHtml(block.rows, block.unit || unit, block.label);
        })
        .join("") +
      "</article>"
    );
  }
  function ladderHtml(ladder) {
    var unit = ladder.unit || "指数";
    return (
      '<section class="xm-hm-ladder" data-ladder="' +
      escapeHtml(ladder.key) +
      '"><h2 class="xm-hm-ladder-title">' +
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
  var LIVE_CARD_KEYS = ["ad", "roi", "livePay", "livePaid"];
  function liveCardOrderFrom(keys) {
    var defs = LIVE_CARD_KEYS.slice();
    var seen = {};
    var out = [];
    (keys || []).forEach(function (key) {
      if (defs.indexOf(key) !== -1 && !seen[key]) {
        seen[key] = true;
        out.push(key);
      }
    });
    defs.forEach(function (key) {
      if (!seen[key]) {
        out.push(key);
      }
    });
    return out;
  }
  function liveCardOrder() {
    var saved = [];
    try {
      saved = JSON.parse(localStorage.getItem("xm-home-live-card-order") || "[]");
    } catch (_err) {
      saved = [];
    }
    if (Object.prototype.toString.call(saved) !== "[object Array]") {
      saved = [];
    }
    return liveCardOrderFrom(saved);
  }
  function saveLiveCardOrder(keys) {
    try {
      localStorage.setItem("xm-home-live-card-order", JSON.stringify(liveCardOrderFrom(keys)));
    } catch (_err) {}
  }
  function applyLiveCardMove(fromKey, toKey) {
    var seq = liveCardOrder();
    var from = seq.indexOf(fromKey);
    var to = seq.indexOf(toKey);
    if (from < 0 || to < 0 || from === to) {
      return seq;
    }
    seq.splice(from, 1);
    seq.splice(to, 0, fromKey);
    return seq;
  }
  function liveRowPadClamp(n) {
    var v = Number(n);
    if (!isFinite(v)) {
      return 10;
    }
    return Math.max(4, Math.min(20, Math.round(v)));
  }
  function liveRowPad() {
    try {
      var raw = localStorage.getItem("xm-home-live-row");
      if (raw == null || raw === "" || Number(raw) <= 4) {
        return 10;
      }
      return liveRowPadClamp(raw);
    } catch (_err) {
      return 10;
    }
  }
  function saveLiveRowPad(n) {
    try {
      localStorage.setItem("xm-home-live-row", String(liveRowPadClamp(n)));
    } catch (_err) {}
  }
  function applyLiveRowPad(root) {
    var box = root && root.querySelector("#xm-hm-live");
    if (box) {
      box.style.setProperty("--xm-hm-live-row", liveRowPad() + "px");
    }
  }
  function feePct(value) {
    var n = asNum(String(value == null ? "" : value).replace(/%/g, ""));
    if (n == null) {
      return null;
    }
    if (Math.abs(n) <= 1) {
      n = n * 100;
    }
    return n;
  }
  function feeTargets() {
    try {
      var raw = JSON.parse(localStorage.getItem("xm-home-fee-targets") || "{}");
      return raw && typeof raw === "object" && Object.prototype.toString.call(raw) === "[object Object]" ? raw : {};
    } catch (_err) {
      return {};
    }
  }
  function feeTargetFor(shop) {
    var key = String(shop || "").trim();
    if (!key) {
      return null;
    }
    var n = Number(feeTargets()[key]);
    if (!isFinite(n)) {
      return null;
    }
    return Math.max(0, Math.min(100, n));
  }
  function saveFeeTargetFor(shop, raw) {
    var key = String(shop || "").trim();
    if (!key) {
      return;
    }
    try {
      var map = feeTargets();
      if (raw == null || raw === "") {
        delete map[key];
      } else {
        var n = Number(raw);
        if (!isFinite(n)) {
          return;
        }
        map[key] = Math.max(0, Math.min(100, n));
      }
      localStorage.setItem("xm-home-fee-targets", JSON.stringify(map));
    } catch (_err) {}
  }
  function feeMonitorOf(feeRate, shop) {
    var goal = feeTargetFor(shop);
    var cur = feePct(feeRate);
    if (goal == null) {
      return { label: "未设目标", kind: "" };
    }
    if (cur == null) {
      return { label: "—", kind: "" };
    }
    if (cur > goal + 2) {
      return { label: "控制费比", kind: "hot" };
    }
    if (cur < goal - 2) {
      return { label: "放大付费", kind: "cold" };
    }
    return { label: "正常", kind: "ok" };
  }
  function feeOverTarget(value, shop) {
    return feeMonitorOf(value, shop).kind === "hot";
  }
  function feeWarnText(value, shop) {
    if (!feeOverTarget(value, shop)) {
      return "";
    }
    return "费比监控：当前 " + Math.round(feePct(value)) + "% 超过目标 " + Math.round(feeTargetFor(shop)) + "%";
  }
  function feeWarnLabel(feeRate, shop) {
    return feeMonitorOf(feeRate, shop).label;
  }
  function feeMonitorClass(kind) {
    if (kind === "hot") {
      return " is-fee-warn is-fee-hot";
    }
    if (kind === "cold") {
      return " is-fee-cold";
    }
    return "";
  }
  function isHomeFormField(el) {
    return !!(el && el.closest && el.closest("input,select,textarea,button,a,[data-fee-target],.xm-hm-fee-goal"));
  }
  function isFeeTyping(el) {
    return !!(el && el.closest && el.closest("input,textarea,select,[data-fee-target],.xm-hm-fee-goal"));
  }
  function liveFeeDraft(root) {
    var el = root && root.querySelector ? root.querySelector("[data-fee-target]:focus") : null;
    if (!el) {
      return null;
    }
    return {
      shop: String(el.getAttribute("data-fee-shop") || ""),
      value: el.value,
      start: el.selectionStart,
      end: el.selectionEnd
    };
  }
  function restoreLiveFeeDraft(root, draft) {
    if (!root || !draft || !draft.shop) {
      return;
    }
    var list = root.querySelectorAll("[data-fee-target]");
    var i;
    var el;
    for (i = 0; i < list.length; i += 1) {
      el = list[i];
      if (el.getAttribute("data-fee-shop") !== draft.shop) {
        continue;
      }
      el.value = draft.value;
      el.focus();
      try {
        if (typeof el.setSelectionRange === "function") {
          el.setSelectionRange(draft.start == null ? el.value.length : draft.start, draft.end == null ? el.value.length : draft.end);
        }
      } catch (_err) {}
      return;
    }
  }
  function liveAtText(liveAt) {
    var raw = String(liveAt || "").trim();
    return raw || "—";
  }
  function feeGoalCellHtml(shop) {
    var goal = feeTargetFor(shop);
    return (
      '<label class="xm-hm-fee-goal" onpointerdown="event.stopPropagation()" onmousedown="event.stopPropagation()"><input type="text" inputmode="decimal" autocomplete="off" spellcheck="false" data-fee-target data-fee-shop="' +
      escapeHtml(String(shop || "")) +
      '"' +
      (goal == null ? "" : ' value="' + escapeHtml(String(goal)) + '"') +
      ' onpointerdown="event.stopPropagation()" onmousedown="event.stopPropagation()" /> %</label>'
    );
  }
  function liveFilter() {
    try {
      var raw = JSON.parse(localStorage.getItem("xm-home-live-filter") || "{}");
      return {
        team: String((raw && raw.team) || "").trim(),
        shop: String((raw && raw.shop) || "").trim()
      };
    } catch (_err) {
      return { team: "", shop: "" };
    }
  }
  function saveLiveFilter(next) {
    try {
      localStorage.setItem(
        "xm-home-live-filter",
        JSON.stringify({
          team: String((next && next.team) || "").trim(),
          shop: String((next && next.shop) || "").trim()
        })
      );
    } catch (_err) {}
  }
  function dutyTeamLabel(name) {
    var n = String(name || "").trim();
    return /团队$/.test(n) ? n : n + "团队";
  }
  function dutyTeamList(state) {
    var seen = {};
    var out = [];
    function add(team) {
      var name = String((team && team.name) || "").trim();
      if (!name || seen[name]) {
        return;
      }
      seen[name] = true;
      out.push({ name: name, shops: (team && team.shops) || [] });
    }
    ((state && state.teams) || []).forEach(add);
    ((state && state.chiefs) || []).forEach(add);
    return out;
  }
  function shopsInDutyTeam(state, teamName) {
    var map = {};
    dutyTeamList(state).forEach(function (team) {
      if (teamName && team.name !== teamName) {
        return;
      }
      (team.shops || []).forEach(function (row) {
        var n = normShopName(row && row.shop);
        if (n) {
          map[n] = true;
        }
      });
    });
    return map;
  }
  function filterLiveShops(shops, state) {
    var pick = liveFilter();
    var teamMap = pick.team ? shopsInDutyTeam(state, pick.team) : null;
    return (shops || []).filter(function (row) {
      var name = String((row && row.shop) || "").trim();
      if (pick.shop && name !== pick.shop) {
        return false;
      }
      if (teamMap && !teamMap[normShopName(name)]) {
        return false;
      }
      return true;
    });
  }
  function liveFilterShopNames(allShops) {
    var names = [];
    var seen = {};
    (allShops || []).forEach(function (row) {
      var name = String((row && row.shop) || "").trim();
      if (!name || seen[name]) {
        return;
      }
      seen[name] = true;
      names.push(name);
    });
    return names;
  }
  function liveFilterValue(pick) {
    if (pick && pick.shop) {
      return "shop:" + pick.shop;
    }
    if (pick && pick.team) {
      return "team:" + pick.team;
    }
    return "";
  }
  function parseLiveFilterValue(raw) {
    var v = String(raw || "");
    if (v.indexOf("shop:") === 0) {
      return { team: "", shop: v.slice(5) };
    }
    if (v.indexOf("team:") === 0) {
      return { team: v.slice(5), shop: "" };
    }
    return { team: "", shop: "" };
  }
  function liveFilterOption(value, label, selected) {
    return (
      '<option value="' +
      escapeHtml(value) +
      '"' +
      (selected ? " selected" : "") +
      ">" +
      escapeHtml(label) +
      "</option>"
    );
  }
  function liveFilterHtml(allShops, state) {
    var pick = liveFilter();
    var cur = liveFilterValue(pick);
    var teams = dutyTeamList(state);
    var shops = liveFilterShopNames(allShops);
    return (
      '<div class="xm-hm-live-filter">' +
      '<div class="xm-hm-live-filter-left">' +
      '<strong class="xm-hm-live-filter-lab">店铺列表</strong>' +
      '<span class="xm-hm-live-filter-box"><select data-live-filter="pick">' +
      liveFilterOption("", "全选", !cur) +
      (teams.length
        ? '<optgroup label="责权团队">' +
          teams
            .map(function (team) {
              return liveFilterOption("team:" + team.name, dutyTeamLabel(team.name), cur === "team:" + team.name);
            })
            .join("") +
          "</optgroup>"
        : "") +
      (shops.length
        ? '<optgroup label="店铺">' +
          shops
            .map(function (name) {
              return liveFilterOption("shop:" + name, name, cur === "shop:" + name);
            })
            .join("") +
          "</optgroup>"
        : "") +
      "</select></span></div>" +
      '<div class="xm-hm-live-filter-right">' +
      '<button type="button" class="xm-hm-live-heads" data-live-heads>表头设置</button>' +
      '<button type="button" class="xm-hm-live-refresh" data-refresh-live' +
      (liveRefreshing ? " disabled" : "") +
      ">" +
      (liveRefreshing ? "刷新中…" : "刷新") +
      "</button></div></div>"
    );
  }
  function liveMetaHtml(state) {
    return (
      '<div class="xm-hm-live-bar">' +
      '<span class="xm-hm-live-clock">每5分钟刷新 · 更新时间 ' +
      escapeHtml(liveAtText(state && state.liveAt)) +
      "</span>" +
      '<span class="xm-hm-fee-hint">各店费比目标在表头列里单独设置</span>' +
      "</div>"
    );
  }
  function pickLiveCards(cards) {
    var map = {};
    (cards || []).forEach(function (card) {
      if (card && card.key) map[card.key] = card;
    });
    var blank = blankLive().cards;
    return liveCardOrder().map(function (key) {
      return map[key] || blank.filter(function (card) { return card.key === key; })[0];
    }).filter(Boolean);
  }
  function readChart(chart, fallback) {
    var src = chart || {};
    var base = fallback || {};
    return {
      label: src.label || base.label,
      value: src.value != null ? src.value : base.value,
      delta: src.delta != null ? src.delta : base.delta,
      yesterday: src.yesterday && src.yesterday.length ? src.yesterday : base.yesterday,
      today: src.today && src.today.length ? src.today : src.spark && src.spark.length ? src.spark : base.today,
      yesterdayHour: src.yesterdayHour && src.yesterdayHour.length ? src.yesterdayHour : base.yesterdayHour || [],
      todayHour: src.todayHour && src.todayHour.length ? src.todayHour : base.todayHour || [],
      hours: src.hours || base.hours || 0,
      unit: src.unit || base.unit || "",
      lineMode: src.lineMode || base.lineMode || ""
    };
  }
  function hourX(i, slots) {
    return 10 + (i / Math.max((Number(slots) || 24) - 1, 1)) * 620;
  }
  function toHalfIncrements(hourly) {
    var out = [];
    (hourly || []).forEach(function (n) {
      var v = Number(n) || 0;
      out.push(v / 2);
      out.push(v / 2);
    });
    return out;
  }
  function halfTipLabel(i) {
    var minutes = (Number(i) + 1) * 30;
    var h = Math.floor(minutes / 60);
    var m = minutes % 60;
    if (!h) {
      return "0:30";
    }
    return m ? h + ":30" : String(h);
  }
  function hourFromEvent(svg, event, slots) {
    if (!svg || !event) {
      return 0;
    }
    var box = svg.getBoundingClientRect();
    var x = ((event.clientX - box.left) / (box.width || 1)) * 640;
    var i = Math.round(((x - 10) / 620) * Math.max((slots || 24) - 1, 1));
    if (i < 0) {
      return 0;
    }
    if (i > (slots || 24) - 1) {
      return (slots || 24) - 1;
    }
    return i;
  }
  function compareLineHtml(chart) {
    var width = 640;
    var height = Number(chart && chart.height) > 160 ? Number(chart.height) : 184;
    var padTop = 12;
    var padBot = 22;
    var yest = (chart && chart.yesterday) || [];
    var today = (chart && chart.today) || [];
    var slots = Number(chart && chart.hours) > 2 ? Number(chart.hours) : Math.max(yest.length, today.length, 2);
    var drawDots = !(chart && chart.noDots);
    var max = 1;
    yest.concat(today).forEach(function (n) {
      var v = Number(n) || 0;
      if (v > max) {
        max = v;
      }
    });
    function yAt(n) {
      return height - padBot - ((Number(n) || 0) / max) * (height - padTop - padBot);
    }
    function pts(list) {
      return list
        .map(function (n, i) {
          return hourX(i, slots).toFixed(1) + "," + yAt(n).toFixed(1);
        })
        .join(" ");
    }
    function dots(list, color) {
      return list
        .map(function (n, i) {
          return '<circle cx="' + hourX(i, slots).toFixed(1) + '" cy="' + yAt(n).toFixed(1) + '" r="2.4" fill="' + color + '"></circle>';
        })
        .join("");
    }
    function axis() {
      if (slots !== 24 && slots !== 48) {
        return "";
      }
      var out = [];
      for (var h = 1; h <= 24; h += 1) {
        out.push(
          '<text x="' +
            hourX(slots === 48 ? h * 2 - 1 : h - 1, slots).toFixed(1) +
            '" y="' +
            (height - 5) +
            '" text-anchor="middle" fill="#8c8c8c" font-size="8">' +
            h +
            "</text>"
        );
      }
      return out.join("");
    }
    var yestPts = yest.length ? pts(yest) : "";
    var todayPts = today.length ? pts(today) : "";
    return (
      '<svg class="xm-hm-line" viewBox="0 0 ' +
      width +
      " " +
      height +
      '" preserveAspectRatio="none">' +
      (yestPts ? '<polyline fill="none" stroke="#91caff" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" points="' + yestPts + '"></polyline>' : "") +
      (todayPts ? '<polyline fill="none" stroke="#ffa39e" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" points="' + todayPts + '"></polyline>' : "") +
      (drawDots && yest.length ? dots(yest, "#91caff") : "") +
      (drawDots && today.length ? dots(today, "#ffa39e") : "") +
      (slots === 24 || slots === 48
        ? '<line class="xm-hm-line-guide" x1="0" y1="' +
          padTop +
          '" x2="0" y2="' +
          (height - padBot) +
          '" stroke="#c0c4cc" stroke-dasharray="3 3" visibility="hidden"></line>'
        : "") +
      axis() +
      "</svg>"
    );
  }
  function lineChartOf(chart) {
    var yestHour = (chart && chart.yesterdayHour) || [];
    var todayHour = (chart && chart.todayHour) || [];
    var hasHour = yestHour.length > 2 || todayHour.length > 2;
    var flat = (chart && chart.lineMode) === "flat" || (chart && chart.unit) === "rate";
    if (!hasHour) {
      return halfSalesChart(chart);
    }
    return {
      yesterday: flat ? yestHour : cumHours(yestHour),
      today: flat ? todayHour : cumHours(todayHour),
      hours: 24,
      noDots: true,
      height: 128
    };
  }
  function halfSalesChart(chart) {
    var yestHour = (chart && chart.yesterdayHour) || [];
    var todayHour = (chart && chart.todayHour) || [];
    var hasHalf = yestHour.length > 2 || todayHour.length > 2;
    return {
      yesterday: hasHalf ? cumHours(toHalfIncrements(yestHour)) : (chart && chart.yesterday) || [],
      today: hasHalf ? cumHours(toHalfIncrements(todayHour)) : (chart && chart.today) || [],
      hours: hasHalf ? 48 : Number(chart && chart.hours) || 0,
      noDots: true,
      height: 128
    };
  }
  function hoursAttr(hours) {
    return Number(hours) === 48 || Number(hours) === 24 ? ' data-hours="' + hours + '"' : "";
  }
  function liveChartHtml(chart) {
    var down = Number(chart && chart.delta) < 0;
    var unit = (chart && chart.unit) || "";
    var kind = unit === "rate" ? "fee" : "sales";
    var line = lineChartOf(chart);
    var sub = unit === "rate" ? "线：当天费比" : "线：累计（23点=1-23点）";
    return (
      '<article class="xm-hm-chart' +
      (kind === "fee" && feeWarnText(chart && chart.value) ? " is-warn" : "") +
      '" data-chart="' +
      kind +
      '"' +
      (unit ? ' data-unit="' + unit + '"' : "") +
      hoursAttr(line.hours) +
      '><div class="xm-hm-card-head"><span>' +
      escapeHtml((chart && chart.label) || "实时指标") +
      '</span><span class="xm-hm-legs"><i class="is-yest"></i>昨天<i class="is-today"></i>今天</span></div><div class="xm-hm-index-num">' +
      escapeHtml(chart && chart.value != null ? chart.value : "—") +
      "</div>" +
      (chart && (chart.delta == null || chart.delta === "")
        ? '<div class="xm-hm-trend"></div>'
        : '<div class="xm-hm-trend ' +
          (down ? "is-down" : "is-up") +
          '">环比 ' +
          (down ? "↘" : "↗") +
          " " +
          Math.round(Math.abs(Number(chart && chart.delta) || 0)) +
          "%</div>") +
      (line.hours ? '<div class="xm-hm-chart-sub">' + sub + "</div>" : "") +
      compareLineHtml(line) +
      "</article>"
    );
  }
  function companySalesHtml(chart) {
    var sales = Object.assign(
      {
        label: "实时销售金额",
        value: (chart && chart.value) || "—"
      },
      lineChartOf(chart)
    );
    return (
      '<article class="xm-hm-chart xm-hm-sales-chart" data-chart="sales"' +
      hoursAttr(sales.hours) +
      '><div class="xm-hm-card-head"><span>' +
      escapeHtml(sales.label) +
      '</span><span class="xm-hm-legs"><i class="is-yest"></i>昨天<i class="is-today"></i>今天</span></div><div class="xm-hm-index-num">' +
      escapeHtml(sales.value) +
      "</div>" +
      (sales.hours ? '<div class="xm-hm-chart-sub">线：累计（23点=1-23点）</div>' : "") +
      compareLineHtml(sales) +
      "</article>"
    );
  }
  var LIVE_CORE_HEADS = [
    { key: "rank", label: "排名", w: "56px" },
    { key: "shop", label: "店铺名称", w: "16%" },
    { key: "liveAmount", label: "京麦面板实时金额" },
    { key: "paidAmount", label: "实时付费金额" },
    { key: "roi", label: "实时付费ROI" },
    { key: "paidDeal", label: "实时付费成交额" },
    { key: "feeRate", label: "实时费比" },
    { key: "feeWarn", label: "费比监控", w: "108px" },
    { key: "feeGoal", label: "费比目标设置", w: "124px" },
    { key: "liveAt", label: "更新时间", w: "150px" }
  ];
  var LIVE_EXTRA_HEADS = [
    { key: "jzAccount", label: "京准通主账户ID", extra: true, w: "140px" },
    { key: "jzSpend", label: "京准通花费", extra: true },
    { key: "jzPaidOrders", label: "京准通付费订单数", extra: true },
    { key: "jzPaidRoi", label: "京准通付费投产比", extra: true },
    { key: "jzPaidCvr", label: "京准通付费转化率", extra: true },
    { key: "jzCpc", label: "京准通平均点击成本", extra: true },
    { key: "jzDeal", label: "京麦成交金额", extra: true },
    { key: "jzClicks", label: "京准通点击数", extra: true },
    { key: "jzCtr", label: "京准通点击率", extra: true },
    { key: "jzOrderAmt", label: "京准通总订单金额", extra: true },
    { key: "jzRealFee", label: "真实费比", extra: true },
    { key: "jzOk", label: "是否成功", extra: true }
  ];
  var LIVE_SHOP_HEADS = LIVE_CORE_HEADS.concat(LIVE_EXTRA_HEADS);
  var LIVE_LOCK_HEADS = { rank: true, shop: true };
  function liveHiddenHeads() {
    try {
      var raw = JSON.parse(localStorage.getItem("xm-home-live-head-hide") || "[]");
      if (Object.prototype.toString.call(raw) === "[object Array]") {
        return raw.filter(function (key) {
          return key && !LIVE_LOCK_HEADS[key];
        });
      }
    } catch (_err) {}
    return [];
  }
  function saveLiveHiddenHeads(keys) {
    try {
      localStorage.setItem("xm-home-live-head-hide", JSON.stringify(keys || []));
    } catch (_err) {}
  }
  function liveHeadToggleList() {
    return LIVE_SHOP_HEADS.filter(function (col) {
      return col && !LIVE_LOCK_HEADS[col.key];
    });
  }
  function liveTableMinW() {
    return Math.max(1280, liveCols().length * 118);
  }
  var livePicked = {};
  function liveColMap() {
    var map = {};
    LIVE_SHOP_HEADS.forEach(function (col) {
      map[col.key] = col;
    });
    return map;
  }
  function liveHeadKeys() {
    var map = liveColMap();
    var keys = LIVE_SHOP_HEADS.map(function (col) {
      return col.key;
    });
    try {
      var saved = JSON.parse(localStorage.getItem("xm-home-live-head-order") || "[]");
      if (Object.prototype.toString.call(saved) === "[object Array]" && saved.length) {
        var next = [];
        saved.forEach(function (key) {
          if (map[key] && next.indexOf(key) < 0) {
            next.push(key);
          }
        });
        keys.forEach(function (key) {
          if (next.indexOf(key) < 0) {
            next.push(key);
          }
        });
        var rankAt = next.indexOf("rank");
        if (rankAt > 0) {
          next.splice(rankAt, 1);
          next.unshift("rank");
        }
        return next;
      }
    } catch (_err) {}
    return keys;
  }
  function saveLiveHeadOrder(keys) {
    try {
      localStorage.setItem("xm-home-live-head-order", JSON.stringify(keys || liveHeadKeys()));
    } catch (_err) {}
  }
  function applyLiveHeadMove(fromKey, toKey) {
    var seq = liveHeadKeys();
    if (fromKey === "rank" || toKey === "rank") {
      return seq;
    }
    var from = seq.indexOf(fromKey);
    var to = seq.indexOf(toKey);
    if (from < 0 || to < 0 || from === to) {
      return seq;
    }
    seq.splice(from, 1);
    seq.splice(to, 0, fromKey);
    return seq;
  }
  function liveCols() {
    var map = liveColMap();
    var hide = liveHiddenHeads();
    return liveHeadKeys()
      .map(function (key) {
        return map[key];
      })
      .filter(function (col) {
        return col && hide.indexOf(col.key) === -1;
      });
  }
  function liveRowPicked(shop) {
    return !!livePicked[String(shop || "")];
  }
  function markLiveRowPicked(shop) {
    var key = String(shop || "");
    if (key) {
      livePicked[key] = true;
    }
  }
  function toggleLiveRowPicked(shop) {
    var key = String(shop || "");
    if (!key) {
      return false;
    }
    if (livePicked[key]) {
      delete livePicked[key];
      return false;
    }
    livePicked[key] = true;
    return true;
  }
  function clearLiveRowPicked() {
    livePicked = {};
  }
  function liveColgroupHtml() {
    return (
      "<colgroup>" +
      liveCols().map(function (col) {
        return col.w ? '<col style="width:' + col.w + '" />' : "<col />";
      }).join("") +
      "</colgroup>"
    );
  }
  function liveTheadHtml() {
    return (
      "<thead><tr>" +
      liveCols().map(function (col) {
        return (
          '<th data-live-col="' +
          escapeHtml(col.key) +
          '"><span>' +
          escapeHtml(col.label) +
          "</span></th>"
        );
      }).join("") +
      "</tr></thead>"
    );
  }
  function liveShopCellHtml(col, row, index, liveAt) {
    var shop = row && row.shop;
    var mon = feeMonitorOf(row && row.feeRate, shop);
    var key = col && col.key;
    if (key === "rank") {
      return '<td class="xm-hm-num">' + rankMark(index) + "</td>";
    }
    if (key === "shop") {
      return "<td>" + escapeHtml(shop) + "</td>";
    }
    if (key === "liveAmount") {
      return '<td class="xm-hm-num">' + escapeHtml(row.liveAmount == null ? "—" : row.liveAmount) + "</td>";
    }
    if (key === "paidAmount") {
      return '<td class="xm-hm-num">' + escapeHtml(row.paidAmount == null ? "—" : row.paidAmount) + "</td>";
    }
    if (key === "roi") {
      return '<td class="xm-hm-num">' + escapeHtml(row.roi == null ? "—" : row.roi) + "</td>";
    }
    if (key === "paidDeal") {
      return '<td class="xm-hm-num">' + escapeHtml(row.paidDeal == null ? "—" : row.paidDeal) + "</td>";
    }
    if (key === "feeRate") {
      return (
        '<td class="xm-hm-num' +
        feeMonitorClass(mon.kind) +
        '">' +
        escapeHtml(row.feeRate == null ? "—" : row.feeRate) +
        "</td>"
      );
    }
    if (key === "feeWarn") {
      return (
        '<td class="xm-hm-num' +
        feeMonitorClass(mon.kind) +
        '">' +
        escapeHtml(mon.label) +
        "</td>"
      );
    }
    if (key === "feeGoal") {
      return '<td class="xm-hm-num">' + feeGoalCellHtml(shop) + "</td>";
    }
    if (key === "liveAt") {
      return '<td class="xm-hm-num">' + escapeHtml(liveAtText(liveAt)) + "</td>";
    }
    return "<td>—</td>";
  }
  function liveShopRowHtml(row, index, liveAt) {
    var shop = row && row.shop;
    return (
      '<tr class="xm-hm-live-row' +
      (liveRowPicked(shop) ? " is-picked" : "") +
      '" data-live-shop="' +
      escapeHtml(shop) +
      '">' +
      liveCols()
        .map(function (col) {
          return liveShopCellHtml(col, row, index, liveAt);
        })
        .join("") +
      "</tr>"
    );
  }
  function liveCardHtml(card) {
    return (
      '<article class="xm-hm-card" data-card="' +
      escapeHtml(card.key) +
      '"><div class="xm-hm-card-head"><span>' +
      escapeHtml(card.label) +
      "</span></div><div class=\"xm-hm-value\">" +
      escapeHtml(card.value) +
      "</div>" +
      (card.extra ? '<div class="xm-hm-trend">' + escapeHtml(card.extra) + "</div>" : "") +
      "</article>"
    );
  }
  function cssText() {
    return (
      "html:has(#xm-hm),html:has(#xm-hm) body{height:100%!important;max-height:100%!important;overflow:hidden!important}" +
      ".xm-shell{height:100vh!important;max-height:100vh!important;min-height:0!important;overflow:hidden!important}" +
      ".xm-main{min-height:0!important;overflow:hidden!important;flex:1 1 auto!important}" +
      ".xm-content,#xm-content{min-height:0!important;flex:1 1 auto!important;overflow:auto!important}" +
      ".xm-hm{position:relative;display:block;box-sizing:border-box;min-height:min-content;height:auto;max-height:none;padding:10px 12px 24px;color:var(--xm-ink);overflow:visible}" +
      ".xm-hm-bar{position:relative;display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:10px;padding:0 2px;margin-bottom:12px;background:transparent;border:0;border-bottom:1px solid #e4e7ed}" +
      ".xm-hm-views{display:flex;align-items:stretch;gap:0;flex-wrap:wrap;background:transparent}" +
      ".xm-hm-views button{border:0;border-bottom:2px solid transparent;background:transparent;color:#303133;padding:12px 20px;min-height:40px;border-radius:0;margin-bottom:-1px;cursor:pointer;font-size:14px;line-height:22px;-webkit-user-select:none;user-select:none}" +
      ".xm-hm-views button:hover{color:var(--xm-primary)}" +
      ".xm-hm-views button.is-on{background:transparent;border-bottom-color:var(--xm-primary);color:var(--xm-primary);font-weight:500}" +
      ".xm-hm-views button[hidden]{display:none}" +
      ".xm-hm-set{border:0;background:transparent;color:var(--xm-primary);padding:6px 10px;border-radius:6px;cursor:pointer;font-size:13px;-webkit-user-select:none;user-select:none}" +
      ".xm-hm-ranges{display:flex;flex-wrap:wrap;align-items:center;gap:6px}" +
      ".xm-hm-ranges button{border:1px solid var(--xm-line);background:var(--xm-card);color:var(--xm-ink);padding:5px 10px;border-radius:4px;cursor:pointer;font-size:12px;-webkit-user-select:none;user-select:none}" +
      ".xm-hm-ranges button.is-on{background:var(--xm-primary);border-color:var(--xm-primary);color:#fff}" +
      ".xm-hm-datewrap{position:relative}" +
      ".xm-hm-dates{display:inline-flex;align-items:center;gap:8px;min-width:248px;height:32px;padding:0 10px 0 12px;border:1px solid #dcdfe6;background:#fff;color:#303133;border-radius:20px;cursor:pointer;font-size:13px;line-height:1}" +
      ".xm-hm-dates-ico,.xm-hm-dates-clear{color:#c0c4cc}" +
      ".xm-hm-dates-text{flex:1 1 auto;text-align:left;white-space:nowrap}" +
      ".xm-hm-dates-clear{border:0;background:transparent;padding:0;width:16px;height:16px;border-radius:50%;cursor:pointer;align-items:center;justify-content:center}" +
      ".xm-hm-cal{position:absolute;top:calc(100% + 10px);right:0;z-index:8;width:646px;max-width:min(646px,calc(100vw - 24px));background:#fff;border-radius:4px;box-shadow:0 2px 12px rgba(0,0,0,.12);padding:8px 8px 12px}" +
      ".xm-hm-cal[hidden]{display:none}" +
      ".xm-hm-cal-months{display:flex}" +
      ".xm-hm-cal-month{flex:1 1 50%;min-width:0;padding:4px 12px 0}" +
      ".xm-hm-cal-month + .xm-hm-cal-month{border-left:1px solid #ebeef5}" +
      ".xm-hm-cal-caption{display:grid;grid-template-columns:56px 1fr 56px;align-items:center;min-height:32px;margin:0 0 4px;color:#303133}" +
      ".xm-hm-cal-caption strong{text-align:center;font-size:16px;font-weight:500}" +
      ".xm-hm-cal-nav{display:flex;align-items:center;gap:2px}" +
      ".xm-hm-cal-nav.is-end{justify-content:flex-end}" +
      ".xm-hm-cal-nav button{border:0;background:transparent;color:#303133;width:22px;height:22px;padding:0;cursor:pointer;font-size:13px;line-height:1}" +
      ".xm-hm-cal-week,.xm-hm-cal-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));text-align:center}" +
      ".xm-hm-cal-week{color:#606266;font-size:12px;padding:6px 0}" +
      ".xm-hm-cal-grid button{border:0;background:transparent;width:32px;height:32px;margin:2px auto;border-radius:50%;font-size:12px;color:#606266;cursor:pointer}" +
      ".xm-hm-cal-grid button.is-other{color:#c0c4cc}" +
      ".xm-hm-cal-grid button.is-in{background:#fde2e2;border-radius:0;width:100%}" +
      ".xm-hm-cal-grid button.is-today{color:#f56c6c}" +
      ".xm-hm-cal-grid button.is-start,.xm-hm-cal-grid button.is-end{background:#f56c6c;color:#fff;border-radius:50%;width:32px}" +
      ".xm-hm-cal-grid button:disabled,.xm-hm-cal-grid button.is-off{color:#c0c4cc;opacity:.7;cursor:not-allowed}" +
      ".xm-hm-cal-hint{margin:8px 12px 0;color:#909399;font-size:12px;line-height:1.4}" +
      ".xm-hm-card-head .xm-hm-help{cursor:help;position:relative;z-index:2;width:18px;height:18px;border:1px solid var(--xm-line);border-radius:50%;background:transparent;padding:0;margin:0;font:inherit;font-size:11px;line-height:1;color:var(--xm-muted);display:inline-flex;align-items:center;justify-content:center}" +
      ".xm-hm-tip{position:fixed;z-index:9;display:none;box-sizing:border-box;width:max-content;max-width:360px;padding:10px 12px;background:var(--xm-card);border:1px solid var(--xm-line);border-radius:8px;color:var(--xm-ink);font-size:12px;line-height:1.6;white-space:pre-wrap;pointer-events:none}" +
      ".xm-hm-tip.is-on{display:block}" +
      ".xm-hm-body{position:relative;display:flex;flex-direction:column;gap:12px;overflow:visible}" +
      ".xm-hm.is-live .xm-hm-kpis-shell,.xm-hm.is-board .xm-hm-kpis-shell,.xm-hm.is-team .xm-hm-kpis-shell,.xm-hm.is-live .xm-hm-set,.xm-hm.is-board .xm-hm-set,.xm-hm.is-live .xm-hm-ranges{display:none}" +
      ".xm-hm-live[hidden],.xm-hm-board[hidden],.xm-hm-teams[hidden]{display:none}" +
      ".xm-hm-live{display:flex;flex-direction:column;gap:20px}" +
      ".xm-hm-kpis-shell,.xm-hm-teams,.xm-hm-team{background:linear-gradient(#dceaff,#f7fbff);border:0;outline:0;box-shadow:none;border-radius:12px}" +
      ".xm-hm-teams{background:0}" +
      ".xm-hm-team{cursor:grab;background:#dceaff;border:1px solid #7ea6dc}" +
      ".xm-hm-team.is-hold{cursor:grabbing;opacity:.84}" +
      ".xm-hm-kpis-shell,.xm-hm-teams{padding:10px}" +
      ".xm-hm-sales{display:none;margin:0}" +
      ".xm-hm-sales-chart{width:100%}" +
      ".xm-hm-sales-chart .xm-hm-line,.xm-hm-live .xm-hm-line{display:block;width:100%;height:148px;cursor:crosshair}" +
      ".xm-hm-chart-sub{margin:10px 0 0;color:var(--xm-muted);font-size:12px}" +
      ".xm-hm-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;align-content:start;width:100%}" +
      ".xm-hm-teams{display:flex;flex-direction:column;gap:10px;overflow-x:auto}" +
      ".xm-hm-teams-bar{display:flex;justify-content:space-between;align-items:center;padding:0 0 8px}" +
      ".xm-hm-teams-grid{display:grid;grid-template-columns:repeat(var(--xm-hm-team-cols,2),minmax(200px,1fr));gap:16px}" +
      ".xm-hm.is-team:not(.is-chief) .xm-hm-teams-grid{grid-template-columns:repeat(var(--xm-hm-team-cols,2),minmax(0,1fr));gap:20px}" +
      ".xm-hm-team{display:flex;flex-direction:column;gap:8px;min-width:0;padding:12px}" +
      ".xm-hm.is-team:not(.is-chief) .xm-hm-team{min-width:0;width:100%}" +
      ".xm-hm.is-team:not(.is-chief) .xm-hm-team .xm-hm-panel{margin-top:48px}" +
      ".xm-hm-team-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;align-content:start;width:100%}" +
      ".xm-hm.is-chief .xm-hm-team-kpis{grid-template-columns:1fr;gap:6px}" +
      ".xm-hm-teams .xm-hm-panel{overflow-x:auto;min-width:0;background:#fff;border:0;box-shadow:none}" +
      ".xm-hm-teams .xm-hm-table{min-width:760px;font-variant-numeric:tabular-nums;border-collapse:separate;border-spacing:0;table-layout:fixed}" +
      ".xm-hm-teams .xm-hm-table .xm-hm-num{text-align:center;white-space:nowrap}" +
      ".xm-hm-teams .xm-hm-table th,.xm-hm-teams .xm-hm-table td{border:0;overflow:hidden;text-overflow:ellipsis;box-sizing:border-box;text-align:center}" +
      ".xm-hm-teams .xm-hm-table th{border-right:1px dashed #c8ced8;text-align:center}" +
      ".xm-hm-teams .xm-hm-table th span{display:block;width:100%;text-align:center}" +
      ".xm-hm.is-chief .xm-hm-teams .xm-hm-panel{overflow:hidden}" +
      ".xm-hm.is-chief .xm-hm-teams .xm-hm-table{min-width:0}" +
      ".xm-hm-teams .xm-hm-table th:last-child,.xm-hm-teams .xm-hm-table td:last-child{text-align:center;white-space:nowrap;border-right:0}" +
      ".xm-hm-sort-h{display:inline-flex;align-items:center;justify-content:center;gap:3px;width:100%}" +
      ".xm-hm-sort-btns{display:inline-flex;flex-direction:column;line-height:1}" +
      ".xm-hm-sort-btns button{border:0;background:0;padding:0;font-size:9px;line-height:1;color:#c0c4cc;cursor:pointer}" +
      ".xm-hm-sort-btns button.is-on{color:#2f54eb}" +
      ".xm-hm.is-team .xm-hm-card{min-height:104px;padding:12px 12px 10px;border-radius:8px;cursor:grab}" +
      ".xm-hm.is-team .xm-hm-card.is-hold{cursor:grabbing}" +
      ".xm-hm.is-team .xm-hm-card-head{font-size:12px}" +
      ".xm-hm.is-team .xm-hm-card-head .xm-hm-help{width:16px;height:16px;font-size:10px}" +
      ".xm-hm.is-team .xm-hm-value{margin-top:8px;font-size:20px}" +
      ".xm-hm.is-team .xm-hm-trend{margin-top:6px;font-size:12px}" +
      ".xm-hm.is-chief .xm-hm-card{min-height:0;min-width:0;padding:6px}" +
      ".xm-hm.is-chief .xm-hm-card-head{font-size:10px;line-height:1.2;gap:4px}" +
      ".xm-hm.is-chief .xm-hm-card-head span{min-width:0;overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2}" +
      ".xm-hm.is-chief .xm-hm-card-head .xm-hm-help{width:12px;height:12px;font-size:8px;flex:0 0 auto}" +
      ".xm-hm.is-chief .xm-hm-value{margin-top:4px;font-size:13px}" +
      ".xm-hm.is-chief .xm-hm-trend{margin-top:2px;font-size:10px}" +
      ".xm-hm-team-head{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;min-height:0;padding:0 2px 2px}" +
      ".xm-hm-team-head>div{min-width:0;flex:1}" +
      ".xm-hm-team-head h2{margin:0;font-size:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".xm-hm.is-chief .xm-hm-team-head h2{font-size:13px}" +
      ".xm-hm-teams-bar .xm-hm-set{padding:0;font-size:13px;white-space:nowrap}" +
      ".xm-hm-teams-bar span{display:flex;gap:12px;align-items:center}" +
      "[data-refresh-teams],[data-show-teams]{border:0;background:0;color:var(--xm-primary);cursor:pointer;padding:0;font-size:13px}" +
      "[data-refresh-teams]:disabled{opacity:.55;cursor:wait}" +
      ".xm-hm-drop{width:20px;height:20px;border:1px solid #d96c6c;border-radius:50%;background:#fff;color:#c45656;font-size:16px;line-height:18px;cursor:pointer;padding:0}" +
      "#xm-hm-ladders{display:flex;flex-direction:column;gap:16px}" +
      ".xm-hm-ladder{background:var(--xm-card);border:1px solid var(--xm-line);border-radius:12px;box-shadow:var(--xm-shadow);padding:16px 16px 12px}" +
      ".xm-hm-ladder-title{margin:0 0 16px;text-align:center;font-size:22px;font-weight:700;color:var(--xm-ink)}" +
      ".xm-hm-podiums{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;align-items:start}" +
      ".xm-hm-podium{background:var(--xm-card);border:1px solid var(--xm-line);border-radius:8px;box-shadow:var(--xm-shadow);padding:12px 12px 8px}" +
      ".xm-hm-podium h3{margin:0 0 10px;text-align:center;font-size:13px;color:var(--xm-muted);font-weight:600}" +
      ".xm-hm-podium-sub{margin:14px 0 8px;text-align:center;font-size:15px;font-weight:700;color:var(--xm-ink)}" +
      ".xm-hm-podium-sub:first-of-type{margin-top:0}" +
      ".xm-hm-stand{display:grid;grid-template-columns:1fr 1.15fr 1fr;align-items:end;gap:6px;min-height:168px}" +
      ".xm-hm-stand-item{display:flex;flex-direction:column;align-items:center;text-align:center;background:#f6f1e8;border-radius:8px 8px 0 0;padding:10px 6px 8px}" +
      ".xm-hm-stand-item.is-1{background:#fff4d6;padding-top:16px;min-height:150px}" +
      ".xm-hm-stand-item.is-2,.xm-hm-stand-item.is-3{min-height:124px}" +
      ".xm-hm-avatar{width:36px;height:36px;border-radius:50%;background:var(--xm-primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700}" +
      ".xm-hm-stand-item.is-1 .xm-hm-avatar{background:#f5a623}" +
      ".xm-hm-stand-rank{margin-top:6px;font-size:10px;color:var(--xm-muted)}" +
      ".xm-hm-stand-item strong{margin-top:2px;font-size:13px;color:var(--xm-ink)}" +
      ".xm-hm-stand-item em{margin-top:4px;font-style:normal;font-size:13px;font-weight:700;color:var(--xm-ink)}" +
      ".xm-hm-stand-item small{color:var(--xm-muted);font-size:11px}" +
      ".xm-hm-rest{list-style:none;margin:8px 0 0;padding:0}" +
      ".xm-hm-rest li{display:flex;align-items:center;gap:8px;padding:7px 2px;border-top:1px solid var(--xm-line);font-size:12px}" +
      ".xm-hm-rest span{color:var(--xm-muted);width:22px}" +
      ".xm-hm-rest b{flex:1;font-weight:500}" +
      ".xm-hm-rest em{font-style:normal;font-variant-numeric:tabular-nums}" +
      ".xm-hm-live-bar{display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px}" +
      ".xm-hm-live-clock{margin:0;color:var(--xm-muted);font-size:12px}" +
      ".xm-hm-live-filter{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 12px;padding:0;border:0}" +
      ".xm-hm-live-filter-left{display:flex;align-items:center;gap:12px;min-width:0}" +
      ".xm-hm-live-filter-lab{font-size:16px;font-weight:600;color:var(--xm-ink);line-height:40px;white-space:nowrap}" +
      ".xm-hm-live-filter-box{position:relative;flex:0 1 320px;min-width:220px;max-width:100%}" +
      ".xm-hm-live-filter-right{display:flex;align-items:center;gap:16px;flex:0 0 auto}" +
      ".xm-hm-live-heads,.xm-hm-live-refresh{border:0;background:transparent;color:var(--xm-primary);cursor:pointer;padding:0 2px;font:inherit;font-size:14px;line-height:40px;white-space:nowrap}" +
      ".xm-hm-live-refresh:disabled{opacity:.55;cursor:wait}" +
      ".xm-hm-head-pop{position:absolute;top:0;left:0;z-index:9;width:540px;max-width:calc(100vw - 24px);max-height:min(72vh,640px);overflow:auto;background:var(--xm-card);border:1px solid var(--xm-line);border-radius:8px;box-shadow:var(--xm-shadow);padding:10px}" +
      ".xm-hm-head-pop[hidden]{display:none}" +
      ".xm-hm-head-pop h3{margin:0 0 8px;font-size:13px}" +
      ".xm-hm-head-pop .xm-hm-head-hint{margin:0 0 8px;color:var(--xm-muted);font-size:12px;line-height:1.5}" +
      "#xm-hm-head-opts{display:grid;grid-template-columns:1fr 1fr;column-gap:16px;align-items:start}" +
      "#xm-hm-head-opts .xm-hm-pop-all,#xm-hm-head-opts .xm-hm-head-sec{grid-column:1/-1}" +
      ".xm-hm-head-pop .xm-hm-head-sec{margin:8px 0 4px;color:var(--xm-muted);font-size:12px;font-weight:600}" +
      ".xm-hm-head-pop label{display:flex;gap:8px;align-items:center;padding:4px 0;font-size:12px;color:var(--xm-ink);cursor:pointer;-webkit-user-select:none;user-select:none}" +
      ".xm-hm-live-filter select{width:100%;height:40px;box-sizing:border-box;border:1px solid #e4e7ed;border-radius:8px;padding:0 36px 0 14px;font:inherit;font-size:14px;color:var(--xm-ink);background:#fff;-webkit-appearance:none;appearance:none}" +
      ".xm-hm-live-filter-box:after{content:\"\";position:absolute;right:14px;top:50%;width:8px;height:8px;margin-top:-6px;border-right:2px solid #8c8c8c;border-bottom:2px solid #8c8c8c;transform:rotate(45deg);pointer-events:none}" +
      ".xm-hm-fee-goal{display:inline-flex;align-items:center;justify-content:center;gap:4px;width:100%;color:var(--xm-ink);font-size:12px;cursor:text;-webkit-user-select:text;user-select:text;pointer-events:auto}" +
      ".xm-hm-fee-goal input{width:64px;height:28px;box-sizing:border-box;border:1px solid var(--xm-line);border-radius:4px;padding:0 6px;font:inherit;text-align:center;cursor:text;pointer-events:auto;-webkit-user-select:text;user-select:text}" +
      ".xm-hm-fee-warn{color:#cf1322;font-size:13px;font-weight:600}" +
      ".xm-hm-fee-hint{color:var(--xm-muted);font-size:12px}" +
      ".xm-hm-chart.is-warn{border-color:#ff7875}" +
      ".xm-hm-live .xm-hm-table td.is-fee-warn,.xm-hm-live .xm-hm-table td.is-fee-hot{color:#cf1322;font-weight:600}" +
      ".xm-hm-live .xm-hm-table td.is-fee-cold{color:#1677ff;font-weight:600}" +
      ".xm-hm-live .xm-hm-table td:has(.xm-hm-fee-goal){overflow:visible}" +
      ".xm-hm-live-charts{display:grid;grid-template-columns:1fr 1fr;gap:20px}" +
      ".xm-hm-chart{background:var(--xm-card);border:1px solid var(--xm-line);border-radius:8px;box-shadow:var(--xm-shadow);padding:14px 16px 10px;min-width:0}" +
      ".xm-hm-legs{display:inline-flex;align-items:center;gap:10px;color:var(--xm-muted);font-size:12px}" +
      ".xm-hm-legs i{width:10px;height:10px;border-radius:50%;display:inline-block}" +
      ".xm-hm-legs i.is-yest{background:#91caff}" +
      ".xm-hm-legs i.is-today{background:#ffa39e}" +
      ".xm-hm-line{display:block;width:100%;height:180px;margin-top:8px}" +
      ".xm-hm-chart[data-hours] .xm-hm-line{cursor:crosshair}" +
      ".xm-hm-line-tip{position:fixed;z-index:20;display:none;box-sizing:border-box;min-width:168px;padding:8px 10px;background:#1f1f1f;color:#fff;border-radius:6px;font-size:12px;line-height:1.5;pointer-events:none}" +
      ".xm-hm-line-tip.is-on{display:block}" +
      ".xm-hm-line-tip b{display:block;margin:0 0 6px;font-size:13px}" +
      ".xm-hm-line-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:4px}" +
      ".xm-hm-line-row i{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:6px}" +
      ".xm-hm-line-tip i.is-yest{background:#91caff}" +
      ".xm-hm-line-tip i.is-today{background:#ffa39e}" +
      ".xm-hm-line-row em{font-style:normal;font-variant-numeric:tabular-nums}" +
      ".xm-hm-line-sub{padding:0 0 0 14px;color:#c0c4cc;font-size:11px;display:flex;justify-content:space-between;gap:12px}" +
      ".xm-hm-live-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:20px;width:100%}" +
      ".xm-hm-live-cards .xm-hm-card{text-align:center;cursor:grab}" +
      ".xm-hm-live-cards .xm-hm-card.is-hold{cursor:grabbing}" +
      ".xm-hm-live .xm-hm-table{min-width:1280px;table-layout:fixed;border-collapse:separate;border-spacing:0;font-variant-numeric:tabular-nums}" +
      ".xm-hm-live .xm-hm-panel h2 .xm-hm-fee-goal{margin-left:auto}" +
      ".xm-hm-live .xm-hm-table .xm-hm-num{text-align:center;white-space:nowrap}" +
      ".xm-hm-live .xm-hm-table th,.xm-hm-live .xm-hm-table td{border:0;overflow:hidden;text-overflow:ellipsis;box-sizing:border-box;text-align:center;padding:var(--xm-hm-live-row,10px) 8px;line-height:1.45}" +
      ".xm-hm-live .xm-hm-table tbody tr{cursor:pointer}" +
      ".xm-hm-live .xm-hm-table tbody tr.is-picked td{background:#ffe4ec}" +
      ".xm-hm-live .xm-hm-table th[data-live-col]{cursor:grab}" +
      ".xm-hm-live .xm-hm-table th[data-live-col=\"rank\"]{cursor:default}" +
      ".xm-hm-live .xm-hm-table th[data-live-col].is-hold{cursor:grabbing;opacity:.72}" +
      ".xm-hm-live .xm-hm-table th[data-live-col].is-over{outline:1px dashed var(--xm-primary)}" +
      ".xm-hm-live .xm-hm-table th{border-right:1px dashed #c8ced8;text-align:center}" +
      ".xm-hm-live .xm-hm-table th span{display:block;width:100%;text-align:center}" +
      ".xm-hm-live .xm-hm-table th:last-child,.xm-hm-live .xm-hm-table td:last-child{text-align:center;border-right:0}" +
      ".xm-hm-live .xm-hm-panel{overflow-x:auto}" +
      ".xm-hm-card,.xm-hm-pop label{-webkit-user-select:none;user-select:none}" +
      ".xm-hm-card{position:relative;background:var(--xm-card);border:1px solid var(--xm-line);border-radius:8px;padding:12px 14px 10px;box-shadow:var(--xm-shadow);min-height:104px;overflow:visible}" +
      ".xm-hm-card.is-hold,.xm-hm-pop label.is-hold{opacity:.72;cursor:grabbing;pointer-events:none}" +
      ".xm-hm-card.is-over,.xm-hm-pop label.is-over{outline:1px dashed var(--xm-primary)}" +
      ".xm-hm-pop label{cursor:grab}" +
      ".xm-hm-card-head{display:flex;align-items:center;justify-content:space-between;color:var(--xm-muted);font-size:12px}" +
      ".xm-hm-value{margin-top:8px;min-height:1.2em;font-size:22px;font-weight:700;color:var(--xm-ink)}" +
      ".xm-hm-value.is-accent{color:var(--xm-primary)}" +
      ".xm-hm-trend{margin-top:6px;min-height:1.2em;font-size:12px;color:var(--xm-muted)}" +
      ".xm-hm-trend.is-up{color:#cf1322}" +
      ".xm-hm-trend.is-down{color:#389e0d}" +
      ".xm-hm-panel{width:100%;background:var(--xm-card);border:1px solid var(--xm-line);border-radius:8px;box-shadow:var(--xm-shadow);padding:12px 12px 8px;min-height:0}" +
      ".xm-hm-panel h2{margin:0;font-size:14px;display:flex;align-items:center;justify-content:space-between;gap:8px}" +
      ".xm-hm-index-num{margin:8px 0 6px;font-size:28px;font-weight:700;color:var(--xm-primary)}" +
      ".xm-hm-table{width:100%;border-collapse:collapse;font-size:12px}" +
      ".xm-hm-table th{text-align:center;color:var(--xm-muted);font-weight:500;padding:6px 4px;border-bottom:1px solid var(--xm-line)}" +
      ".xm-hm-table thead th{text-align:center}" +
      ".xm-hm-table thead th span{display:block;width:100%;text-align:center}" +
      ".xm-hm-table td{padding:7px 4px;border-bottom:1px solid var(--xm-line);color:var(--xm-ink);text-align:center}" +
      ".xm-hm-table td:last-child,.xm-hm-table th:last-child{text-align:center}" +
      ".xm-hm-cup{display:inline-flex;width:18px;height:18px;border-radius:50%;align-items:center;justify-content:center;color:#fff;font-size:11px}" +
      ".xm-hm-cup.gold{background:#f5a623}" +
      ".xm-hm-cup.silver{background:#8c8c8c}" +
      ".xm-hm-cup.bronze{background:#d46b08}" +
      ".xm-hm-pop{position:absolute;top:0;left:0;z-index:8;width:280px;background:var(--xm-card);border:1px solid var(--xm-line);border-radius:8px;box-shadow:var(--xm-shadow);padding:10px}" +
      ".xm-hm-pop[hidden]{display:none}" +
      ".xm-hm-pop h3{margin:0 0 8px;font-size:13px}" +
      ".xm-hm-pop-all{font-weight:600;border-bottom:1px solid var(--xm-line);margin:0 0 4px;padding:2px 0 8px}" +
      ".xm-hm-pop label{display:flex;gap:8px;align-items:center;padding:4px 0;font-size:12px;color:var(--xm-ink)}" +
      ".xm-hm-note{color:var(--xm-muted);font-size:12px}" +
      "@media (max-width:1100px){.xm-hm-teams-grid{grid-template-columns:1fr}.xm-hm.is-chief .xm-hm-team{min-width:0}.xm-hm-team-kpis{grid-template-columns:repeat(4,minmax(0,1fr))}.xm-hm.is-chief .xm-hm-team-kpis{grid-template-columns:1fr}}"
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
      '<div class="xm-hm-bar">' +
      '<div class="xm-hm-views">' +
      viewBtns +
      "</div>" +
      '<div class="xm-hm-ranges">' +
      rangeBtns +
      '<div class="xm-hm-datewrap"><div class="xm-hm-dates" id="xm-hm-dates" title="最多选择30天"><span class="xm-hm-dates-ico">日</span><span class="xm-hm-dates-text" id="xm-hm-date-text"></span><button type="button" class="xm-hm-dates-clear" id="xm-hm-date-clear">×</button></div><div class="xm-hm-cal" id="xm-hm-cal" hidden></div></div>' +
      "</div></div>" +
      '<div class="xm-hm-pop" id="xm-hm-pop" hidden><h3>卡片设置</h3><div id="xm-hm-card-opts"></div></div>' +
      '<div class="xm-hm-head-pop" id="xm-hm-head-pop" hidden><h3>表头设置</h3><p class="xm-hm-head-hint">付费中心表头先挂上，数据稍后对接。</p><div id="xm-hm-head-opts"></div></div>' +
      '<div class="xm-hm-body">' +
      '<section class="xm-hm-kpis-shell"><div class="xm-hm-teams-bar"><b>星脉甄选</b><button type="button" class="xm-hm-set" id="xm-hm-set">卡片设置</button></div><div class="xm-hm-sales" id="xm-hm-sales"></div><div class="xm-hm-kpis" id="xm-hm-kpis"></div></section>' +
      '<section class="xm-hm-teams" id="xm-hm-teams" hidden></section>' +
      '<section class="xm-hm-live" id="xm-hm-live" hidden></section>' +
      '<section class="xm-hm-board" id="xm-hm-board" hidden>' +
      '<div id="xm-hm-ladders"></div></section>' +
      '</div><p class="xm-hm-note" id="xm-hm-note">数字来自星脉 ERP。</p></div>'
    );
  }
  function visibleSetBtn(root) {
    var list = root.querySelectorAll(".xm-hm-set");
    for (var i = 0; i < list.length; i++) {
      if (list[i].offsetParent) {
        return list[i];
      }
    }
    return null;
  }
  function syncCardPop(root, btn) {
    var pop = root.querySelector("#xm-hm-pop");
    if (!pop) {
      return;
    }
    pop.hidden = !cardSetOpen;
    if (cardSetOpen) {
      placeCardPop(root, btn);
    }
  }
  function placeCardPop(root, btn) {
    var pop = root.querySelector("#xm-hm-pop");
    var box = root.querySelector("#xm-hm");
    btn = btn || visibleSetBtn(root);
    if (!pop || pop.hidden || !btn || !box) {
      return;
    }
    var b = btn.getBoundingClientRect();
    var p = box.getBoundingClientRect();
    var top = b.bottom - p.top + 8;
    var left = b.right - p.left - pop.offsetWidth;
    if (left < 8) {
      left = 8;
    }
    if (left + pop.offsetWidth > p.width - 8) {
      left = Math.max(8, p.width - pop.offsetWidth - 8);
    }
    pop.style.top = Math.round(top) + "px";
    pop.style.left = Math.round(left) + "px";
  }
  function liveHeadOptsHtml() {
    var hide = liveHiddenHeads();
    var list = liveHeadToggleList();
    var extras = list.filter(function (col) {
      return col.extra;
    });
    var cores = list.filter(function (col) {
      return !col.extra;
    });
    var allOn = list.length > 0 && list.every(function (col) {
      return hide.indexOf(col.key) === -1;
    });
    function row(col) {
      return (
        '<label><input type="checkbox" data-live-head="' +
        escapeHtml(col.key) +
        '"' +
        (hide.indexOf(col.key) === -1 ? " checked" : "") +
        " /> " +
        escapeHtml(col.label) +
        "</label>"
      );
    }
    return (
      '<label class="xm-hm-pop-all"><input type="checkbox" data-live-head-all' +
      (allOn ? " checked" : "") +
      " /> 全选</label>" +
      '<div class="xm-hm-head-sec">实时</div>' +
      cores.map(row).join("") +
      '<div class="xm-hm-head-sec">付费中心（数据待对接）</div>' +
      extras.map(row).join("")
    );
  }
  function syncHeadPop(root, btn) {
    var pop = root.querySelector("#xm-hm-head-pop");
    if (!pop) {
      return;
    }
    pop.hidden = !headSetOpen;
    if (!headSetOpen) {
      return;
    }
    var opts = root.querySelector("#xm-hm-head-opts");
    if (opts) {
      opts.innerHTML = liveHeadOptsHtml();
    }
    var allBox = root.querySelector("[data-live-head-all]");
    var hide = liveHiddenHeads();
    var list = liveHeadToggleList();
    if (allBox) {
      var someOn = list.some(function (col) {
        return hide.indexOf(col.key) === -1;
      });
      allBox.indeterminate = someOn && hide.length > 0;
    }
    btn = btn || root.querySelector("[data-live-heads]");
    var box = root.querySelector("#xm-hm");
    if (!btn || !box || !btn.offsetParent) {
      return;
    }
    var b = btn.getBoundingClientRect();
    var p = box.getBoundingClientRect();
    var top = b.bottom - p.top + 8;
    var left = b.right - p.left - pop.offsetWidth;
    if (left < 8) {
      left = 8;
    }
    if (left + pop.offsetWidth > p.width - 8) {
      left = Math.max(8, p.width - pop.offsetWidth - 8);
    }
    var popH = pop.offsetHeight;
    var spaceBelow = p.height - (b.bottom - p.top) - 8;
    var spaceAbove = b.top - p.top - 8;
    if (top + popH > p.height - 8 && spaceAbove > spaceBelow) {
      top = Math.max(8, b.top - p.top - popH - 8);
    }
    if (top + popH > p.height - 8) {
      top = Math.max(8, p.height - popH - 8);
    }
    pop.style.top = Math.round(top) + "px";
    pop.style.left = Math.round(left) + "px";
  }
  function paint(root, state) {
    var board = root.querySelector("#xm-hm");
    var allow = allowedHomeViews(state.user, state.people, state.dutyShops);
    if (!allow[state.view]) {
      state.view = "company";
    }
    viewKey = state.view || "company";
    var teamView = state.view === "team" || state.view === "chief";
    var hide = teamView ? teamHidden(hiddenCards()) : hiddenCards();
    var companySrc = !homeUserName(state.user)
      ? blankCompanyCards()
      : isHomeBoss(state.user)
        ? state.cards || blankCompanyCards()
        : state.ownCards || blankCompanyCards();
    var cards = arrangeCards(companySrc).filter(function (card) {
      return hide.indexOf(card.key) === -1;
    });
    var live = state.live || blankLive();
    var allShops = state.shops && state.shops.length ? state.shops : [];
    var shops = filterLiveShops(allShops, state);
    var teams =
      state.view === "chief"
        ? filterOwnChiefs(state.chiefs && state.chiefs.length ? state.chiefs : blankRoleTeams("主管"), state.user, state.people, state.dutyShops)
        : state.teams && state.teams.length
          ? state.teams
          : blankTeams();
    var hero = readChart(live.hero, blankLive().hero);
    var paid = readChart(live.paid, blankLive().paid);
    var liveCards = pickLiveCards(live.cards);
    hideCardTip();
    hideLineTip(root);
    var feeDraft = liveFeeDraft(root);
    board.setAttribute("data-hm-js", "0.1.723-home-headset");
    board.classList.toggle("is-board", state.view === "board");
    board.classList.toggle("is-live", state.view === "live");
    board.classList.toggle("is-team", teamView);
    board.classList.toggle("is-chief", state.view === "chief");
    Array.prototype.forEach.call(root.querySelectorAll("[data-view]"), function (btn) {
      var key = btn.getAttribute("data-view");
      btn.hidden = !allow[key];
      btn.classList.toggle("is-on", key === state.view);
    });
    Array.prototype.forEach.call(root.querySelectorAll("[data-range]"), function (btn) {
      btn.classList.toggle("is-on", btn.getAttribute("data-range") === state.range);
    });
    root.querySelector("#xm-hm-date-text").textContent = formatDashDate(state.from) + " 至 " + formatDashDate(state.to);
    root.querySelector("#xm-hm-sales").innerHTML = "";
    root.querySelector("#xm-hm-kpis").innerHTML = cards.map(cardHtml).join("");
    var teamBox = root.querySelector("#xm-hm-teams");
    teamBox.hidden = !teamView;
    teamBox.innerHTML = teamsCompareHtml(teams, hide, state.view === "chief");
    teamBox.style.setProperty("--xm-hm-team-cols", String(Math.max(teamBox.querySelectorAll(".xm-hm-team").length, 1)));
    root.querySelector("#xm-hm-live").hidden = state.view !== "live";
    root.querySelector("#xm-hm-board").hidden = state.view !== "board";
    root.querySelector("#xm-hm-live").innerHTML =
      liveMetaHtml(state) +
      '<div class="xm-hm-live-charts">' +
      liveChartHtml(hero) +
      liveChartHtml(paid) +
      '</div><div class="xm-hm-live-cards">' +
      liveCards.map(liveCardHtml).join("") +
      '</div><div class="xm-hm-panel">' +
      liveFilterHtml(allShops, state) +
      '<table class="xm-hm-table" style="min-width:' +
      liveTableMinW() +
      'px">' +
      liveColgroupHtml() +
      liveTheadHtml() +
      "<tbody>" +
      shops.map(function (row, i) {
        return liveShopRowHtml(row, i, state.liveAt);
      }).join("") +
      "</tbody></table></div>";
    applyLiveRowPad(root);
    restoreShopColW(root);
    root.querySelector("#xm-hm-ladders").innerHTML = (state.ladders || blankLadders()).map(ladderHtml).join("");
    var gapText = ((state.view === "chief" ? state.chiefGaps : state.teamGaps) || state.gaps || []).filter(function (item) {
      return item.indexOf("人管有店") !== -1 || item.indexOf("韩梦凯 ·") !== -1;
    }).join("；");
    root.querySelector("#xm-hm-note").textContent = gapText
      ? "人管对不上：" + gapText
      : state.view === "live"
        ? "京麦面板实时金额和实时付费都走星脉 ERP，每5分钟拉一次。"
        : "数字来自星脉 ERP。";
    root.querySelector("#xm-hm-pop h3").textContent =
      "卡片设置 · " + (state.view === "team" ? "经理团队" : state.view === "chief" ? "主管/储备" : "公司");
    var setCards = state.view === "company" ? companySetCards(state.cards) : arrangeCards(state.cards || blankCompanyCards());
    var allOn = setCards.length > 0 && setCards.every(function (card) {
      return hide.indexOf(card.key) === -1;
    });
    var someOn = setCards.some(function (card) {
      return hide.indexOf(card.key) === -1;
    });
    root.querySelector("#xm-hm-card-opts").innerHTML =
      '<label class="xm-hm-pop-all"><input type="checkbox" data-hide-all' +
      (allOn ? " checked" : "") +
      " /> 全选</label>" +
      setCards
        .map(function (card) {
          return (
            '<label data-sort="' +
            escapeHtml(card.key) +
            '"><input type="checkbox" data-hide="' +
            escapeHtml(card.key) +
            '"' +
            (hide.indexOf(card.key) === -1 ? " checked" : "") +
            " /> " +
            escapeHtml(card.label) +
            "</label>"
          );
        })
        .join("");
    var allBox = root.querySelector("[data-hide-all]");
    if (allBox) {
      allBox.indeterminate = someOn && !allOn;
    }
    syncCardPop(root);
    syncHeadPop(root);
    restoreLiveFeeDraft(root, feeDraft);
  }
  function api(path) {
    return fetch(path, { credentials: "same-origin", headers: { Accept: "application/json" } }).then(function (res) {
      if (res.status === 401) {
        window.location.href = "/login";
        return null;
      }
      if (!res.ok) {
        return null;
      }
      return res.json().catch(function () {
        return null;
      });
    }).catch(function () {
      return null;
    });
  }
  var COMPANY_CARD_DEFS = [
    { key: "payAmount", label: "支付金额 (支付)", accent: true, field: "payAmount", kind: "money", tip: "按支付时间统计的订单金额(包含无效单、代发单)" },
    { key: "adCost", label: "推广花费 (支付预估)", field: "totalPromotionCost", kind: "money", tip: "SPU推广费用" },
    { key: "refundAmount", label: "退款金额", field: "refundAmount", kind: "money", tip: "按退款成功时间统计的金额(包含未发货退款、已发货仅退款和已发货退货退款)" },
    {
      key: "adRatio",
      label: "推广花费 (支付预估) 占比",
      field: "promotionRate",
      kind: "rate",
      tip: "推广花费占支付金额的比例（按支付时间统计）\n计算公式：推广花费（支付预估）/支付金额（支付）100%（推广花费≤0时，按0计算：支付金额≤0时，按1计算）"
    },
    {
      key: "refundRate",
      label: "退款率 (按金额)",
      field: "refundRate",
      kind: "rate",
      tip: "按订单金额计算的退款率\n计算公式:退款金额/支付金额(支付)*100%"
    },
    {
      key: "profit",
      label: "利润 (支付预估)",
      field: "profit",
      kind: "money",
      tip: "统计时间内产生的利润（按支付时间统计）\n计算公式：净销售额（支付）-净货品成本（支付）-销售费用（支付）-发货费用（支付）-其他费用-自定义费用"
    },
    {
      key: "payQty",
      label: "销售单数 (支付)",
      field: "orderCount",
      kind: "int",
      tip: "剔除无效单和退款订单后的订单数(按支付时间统计)\n计算公式:销售单数(支付)-无效单订单数-普通单退款单数-代发单退款单数"
    },
    { key: "grossMargin", label: "大毛利率", field: "profitRate", kind: "rate", tip: "利润/支付金额" },
    { key: "platformFee", label: "平台花费 (支付预估)", field: "platformFee", kind: "money", tip: "支付金额（支付）对应的预估平台花费" },
    {
      key: "saleFee",
      label: "销售费用 (支付预估)",
      field: "saleFee",
      kind: "money",
      tip: "支付金额（支付）对应的预估销售费用\n计算公式：推广花费（支付预估）+平台花费（支付预估）+无效单佣金"
    },
    { key: "goodsCost", label: "总货款成本", field: "goodsCost", kind: "money", tip: "京小洁采购单成本+导入的货品成本" },
    { key: "invalid", label: "无效单金额", field: "invalidAmount", kind: "money", tip: "标记为无效单的订单支付金额" },
    { key: "netSales", label: "净销售额 (支付)", field: "netSales", kind: "money", tip: "净销售数对应的订单金额合计" },
    { key: "jdOrders", label: "京仓订单数量", field: "jdOrders", kind: "int", tip: "京仓订单数量（按支付时间统计）" },
    {
      key: "jdRatio",
      label: "京仓订单占比",
      field: "jdRatio",
      kind: "rate",
      tip: "京仓订单数量占销售订单数量的比例(按支付时间统计)\n计算公式:京仓订单数量（支付）/销售单数（支付）*100%"
    },
    {
      key: "netQty",
      label: "净销售件数 (支付)",
      field: "netSkuNum",
      kind: "int",
      tip: "剔除无效单和退款订单后的商品销售件数(按支付时间统计)\n计算公式:销售件数(支付)-无效单销售件数-普通单退款销售件数-代发单退款件数"
    },
    { key: "netGoodsCost", label: "净货款成本 (支付)", field: "netGoodsCost", kind: "money", tip: "剔除无效单和退款订单后的货品成本（按支付时间统计）" },
    {
      key: "netGoodsRatio",
      label: "净货品成本占比 (支付)",
      field: "netGoodsRate",
      kind: "rate",
      tip: "净货品成本占支付金额的比例（按支付时间统计）\n计算公式：净货款成本（支付）/支付金额（支付）*100%"
    }
  ];
  function asNum(value) {
    if (value == null || value === "" || value === "—") {
      return null;
    }
    var n = Number(String(value).replace(/,/g, ""));
    return isFinite(n) ? n : null;
  }
  function fmtMoney(value) {
    return fmtInt(value);
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
    return Math.round(n) + "%";
  }
  function fmtRoi(pay, ad) {
    var p = asNum(pay);
    var a = asNum(ad);
    if (p == null || a == null || a === 0) {
      return "—";
    }
    return String(Math.round(p / a));
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
      platformFee: sum.platformFee,
      saleFee: sum.saleFee,
      goodsCost: sum.goodsCost,
      invalidAmount: sum.invalidAmount,
      jdOrders: sum.jdOrders,
      jdRatio: sum.jdRatio,
      netSkuNum: sum.netSkuNum,
      netGoodsCost: sum.netGoodsCost,
      netGoodsRate: sum.netGoodsRate,
      netSales: sum.netSales != null ? sum.netSales : null
    };
    if (next.jdRatio == null && next.jdOrders != null && next.orderCount) {
      next.jdRatio = next.jdOrders / next.orderCount;
    }
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
      if (next.netGoodsRate == null && next.netGoodsCost != null && next.payAmount) {
        next.netGoodsRate = next.netGoodsCost / next.payAmount;
      }
    }
    return next;
  }
  var SUM_ADD = ["payAmount", "totalPromotionCost", "refundAmount", "profit", "orderCount", "netOrderCount", "todayPayAmount", "yesterdayPayAmount", "platformFee", "saleFee", "goodsCost", "invalidAmount", "jdOrders", "netSkuNum", "netGoodsCost"];
  function sumPack(rows) {
    var out = {};
    SUM_ADD.forEach(function (key) {
      out[key] = sumField(rows, key);
    });
    return withRates(out);
  }
  function summaryFrom(pack) {
    if (pack && pack.summary && pack.summary.payAmount != null) {
      return withRates(pack.summary);
    }
    return sumPack(pack && pack.records);
  }
  function mergeSummary(primary, extra) {
    var out = withRates(primary || {});
    var src = extra || {};
    Object.keys(src).forEach(function (key) {
      if (out[key] == null && src[key] != null) {
        out[key] = src[key];
      }
    });
    return withRates(out);
  }
  function blankCompanyCards() {
    return COMPANY_CARD_DEFS.map(function (def) {
      return { key: def.key, label: def.label, value: "", accent: !!def.accent, trend: "", tip: def.tip || "" };
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
      return { key: def.key, label: def.label, value: value, accent: !!def.accent, trend: trendOf(cur, old), tip: def.tip || "" };
    });
  }
  function blankLive() {
    return {
      title: "实时看板",
      summary: { channels: 1, shops: 0 },
      hero: { label: "京麦面板实时金额", value: "—", delta: 0, yesterday: [], today: [], yesterdayHour: [], todayHour: [], hours: 0 },
      paid: { label: "实时费比", value: "—", delta: 0, yesterday: [], today: [], yesterdayHour: [], todayHour: [], hours: 0, unit: "rate", lineMode: "flat" },
      cards: [
        { key: "ad", label: "推广花费 (支付预估)", value: "—" },
        { key: "roi", label: "付费成交ROI", value: "—" },
        { key: "livePay", label: "实时付费成交额", value: "—" },
        { key: "livePaid", label: "实时付费金额", value: "—" }
      ],
      shops: []
    };
  }
  function blankTeams() {
    return blankRoleTeams("经理");
  }
  function blankRoleTeams(role) {
    if (role === "主管") {
      return [{ key: "chief", name: "主管", cards: blankCompanyCards(), shops: [] }];
    }
    return [
      { key: "shen", name: "沈子晗", cards: blankCompanyCards(), shops: [] },
      { key: "han", name: "韩梦凯", cards: blankCompanyCards(), shops: [] }
    ];
  }
  function blankLadders() {
    var cols = [
      { title: "主管储备排行榜", rows: [] },
      { title: "运营排行榜", rows: [] }
    ];
    return [
      { key: "perf", title: "业绩排行榜", unit: "支付金额", columns: cols },
      { key: "profit", title: "利润排行榜", unit: "利润", columns: cols.map(function (col) {
        return { title: col.title, rows: [] };
      }) }
    ];
  }
  function blankShownCards(cards) {
    return (cards || []).map(function (card) {
      return Object.assign({}, card, { value: "", trend: "" });
    });
  }
  function blankShownShops(shops) {
    return (shops || []).map(function (shop) {
      var metrics = {};
      SHOP_CARD_KEYS.forEach(function (key) {
        metrics[key] = "";
      });
      return Object.assign({}, shop, { metrics: metrics });
    });
  }
  function blankShownRows(rows) {
    return (rows || []).map(function (row) {
      return Object.assign({}, row, { amount: "" });
    });
  }
  function blankShownLadders(ladders) {
    return (ladders || []).map(function (ladder) {
      return Object.assign({}, ladder, {
        columns: (ladder.columns || []).map(function (col) {
          return Object.assign({}, col, {
            rows: blankShownRows(col.rows),
            blocks: (col.blocks || []).map(function (block) {
              return Object.assign({}, block, { rows: blankShownRows(block.rows) });
            })
          });
        })
      });
    });
  }
  function blankShownTeam(team) {
    return Object.assign({}, team, {
      cards: blankShownCards(team && team.cards),
      shops: blankShownShops(team && team.shops)
    });
  }
  function clearRangeData(state) {
    if (!state) {
      return state;
    }
    state.cards = blankShownCards(state.cards && state.cards.length ? state.cards : blankCompanyCards());
    state.teams = (state.teams || []).map(blankShownTeam);
    state.chiefs = (state.chiefs || []).map(blankShownTeam);
    state.ladders = blankShownLadders(state.ladders && state.ladders.length ? state.ladders : blankLadders());
    return state;
  }
  function clearLiveShown(state) {
    if (!state) {
      return state;
    }
    var blank = blankLive();
    var live = state.live || blank;
    state.live = Object.assign({}, live, {
      hero: Object.assign({}, live.hero || {}, { value: "", delta: "" }),
      paid: Object.assign({}, live.paid || {}, { value: "", delta: "" }),
      cards: (live.cards && live.cards.length ? live.cards : blank.cards).map(function (card) {
        return Object.assign({}, card, { value: "", extra: "" });
      })
    });
    state.shops = (state.shops || []).map(function (row) {
      return Object.assign({}, row, {
        liveAmount: "",
        paidAmount: "",
        profit: "",
        roi: "",
        paidDeal: "",
        feeRate: ""
      });
    });
    return state;
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
      var id = normShopId(row && (row.shopId || row.id)) || (row && row.shopName);
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
      var path = "/api/data/shops?pageSize=50&pageNum=" + n + "&currentPage=" + n + (qs ? "&" + qs : "");
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
  function erpRecordId(row) {
    return normShopId(row && (row.shopId || row.id));
  }
  function withShopIds(records) {
    return (records || []).map(function (row) {
      var id = erpRecordId(row);
      if (!id || (row && row.shopId === id)) {
        return row;
      }
      return Object.assign({}, row, { shopId: id });
    });
  }
  function summaryFromOverview(data) {
    var sum = {};
    ((data && data.cards) || []).forEach(function (card) {
      if (card && card.key) {
        sum[card.key] = card.value;
      }
    });
    if (sum.totalPromotionCost == null) {
      sum.totalPromotionCost = sumField(data && data.trend, "promotionCost");
    }
    if (sum.totalPromotionCost == null) {
      sum.totalPromotionCost = sumField(data && data.shops, "totalPromotionCost");
    }
    return withRates(sum);
  }
  function fetchOverviewPack(from, to) {
    return api("/api/data/overview?" + erpQuery(from, to)).then(function (data) {
      if (!data || !data.ok) {
        return { records: [], summary: null };
      }
      return {
        records: withShopIds(data.shops || []),
        summary: summaryFromOverview(data)
      };
    });
  }
  function fetchCatalogPack() {
    return api("/api/data/shop-options").then(function (data) {
      var records = ((data && data.records) || []).map(function (row) {
        return {
          shopId: normShopId(row && (row.shopId || row.id)),
          shopName: (row && (row.shopName || row.name)) || "",
          id: row && row.id
        };
      }).filter(function (row) {
        return row.shopId || row.shopName;
      });
      if (records.length) {
        return { records: records, summary: null };
      }
      return fetchShopPages("").then(function (pack) {
        return { records: withShopIds(pack.records), summary: pack.summary };
      });
    });
  }
  var packMemo = {};
  function fetchRangePack(from, to) {
    var key = String(from) + "|" + String(to);
    var now = Date.now();
    var hit = packMemo[key];
    if (hit && now - hit.at < 15000) {
      return hit.promise;
    }
    var qs = erpQuery(from, to);
    var promise = Promise.all([
      api("/api/home/erp-kpis?" + qs),
      api("/api/data/overview?" + qs)
    ]).then(function (pair) {
      var homePack = pair[0];
      var overview = pair[1];
      var overSum = overview && overview.ok ? summaryFromOverview(overview) : {};
      var records = [];
      var sum = {};
      if (homePack && homePack.ok && homePack.summary) {
        sum = withRates(homePack.summary);
        records = withShopIds(homePack.records || homePack.shops || []);
      }
      if (!records.length && overview && overview.ok) {
        records = withShopIds(overview.shops || []);
      }
      sum = mergeSummary(sum, overSum);
      if (homePack && homePack.ok && homePack.summary) {
        return { records: records, summary: sum };
      }
      if (sum.payAmount != null) {
        return { records: records, summary: sum };
      }
      return api("/api/data/shops?pageSize=1&pageNum=1&currentPage=1&" + qs).then(function (probe) {
        var row = probe && probe.records && probe.records[0];
        if (row && (row.payAmount != null || row.totalPromotionCost != null || row.profit != null)) {
          return fetchShopPages(qs).then(function (pack) {
            pack.records = withShopIds(pack.records);
            pack.summary = mergeSummary(pack.summary, overSum);
            return pack;
          });
        }
        if (overview && overview.ok) {
          return { records: withShopIds(overview.shops || []), summary: overSum };
        }
        return fetchOverviewPack(from, to);
      });
    });
    packMemo[key] = { at: now, promise: promise };
    promise.then(function () {}, function () {
      if (packMemo[key] && packMemo[key].promise === promise) {
        delete packMemo[key];
      }
    });
    return promise;
  }
  function mapByShopId(records) {
    var map = {};
    (records || []).forEach(function (row) {
      var id = erpRecordId(row);
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
    return shopId && shopId !== String(shop.id == null ? "" : shop.id) ? shopId : "";
  }
  function normShopName(value) {
    return String(value == null ? "" : value).replace(/\s+/g, "").toLowerCase();
  }
  function mapByShopName(records) {
    var map = {};
    (records || []).forEach(function (row) {
      var name = String((row && (row.shopName || row.storeName || row.name)) || "").trim();
      if (!name) {
        return;
      }
      map[name] = row;
      map[normShopName(name)] = row;
    });
    return map;
  }
  function resolveErpId(shop, catalogByName) {
    var id = shopErpId(shop);
    if (id) {
      return id;
    }
    var name = shopDisplayName(shop);
    var hit = (catalogByName && (catalogByName[name] || catalogByName[normShopName(name)])) || null;
    if (!hit) {
      return "";
    }
    return normShopId(hit.shopId || hit.id);
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
    if (String(shop.owner || "").trim() === name || String(shop.lead || "").trim() === name || String(shop.supervisor || "").trim() === name || String(shop.assistant || "").trim() === name) {
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
  function shanghaiHour() {
    return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Shanghai", hour: "2-digit", hour12: false }).format(new Date()).slice(0, 2)) || 0;
  }
  function repeatHours(value, slots) {
    var out = [];
    var i;
    for (i = 0; i < (slots || 24); i += 1) {
      out.push(Number(value) || 0);
    }
    return out;
  }
  function padHours(hourly, slots) {
    slots = slots || 24;
    var src = hourly && hourly.length ? hourly.slice() : [];
    while (src.length < slots) {
      src.push(0);
    }
    return src.slice(0, slots);
  }
  function todayHours(hourly) {
    return padHours(hourly, 24).slice(0, Math.min(24, shanghaiHour() + 1));
  }
  function cumHours(list) {
    var sum = 0;
    return (list || []).map(function (n) {
      sum += Number(n) || 0;
      return sum;
    });
  }
  function seriesOf(hourly, fallback) {
    if (hourly && hourly.length) {
      return hourly;
    }
    return fallback == null ? [] : [fallback, fallback];
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
    var hourly = (todayPack && todayPack.hourly) || (snapPack && snapPack.hourly) || {};
    var hasHourly = hourly.todayPay && hourly.todayPay.length > 2;
    var yestHour = hasHourly ? padHours(hourly.yesterdayPay, 24) : seriesOf(hourly.yesterdayPay, yestPay);
    var todayHour = hasHourly ? todayHours(hourly.todayPay) : seriesOf(hourly.todayPay, todayPay);
    live.hero = {
      label: "京麦面板实时金额",
      value: fmtMoney(todayPay),
      delta: trendOf(todayPay, yestPay),
      yesterday: hasHourly ? cumHours(yestHour) : yestHour,
      today: hasHourly ? cumHours(todayHour) : todayHour,
      yesterdayHour: hasHourly ? yestHour : [],
      todayHour: hasHourly ? todayHour : [],
      hours: hasHourly ? 24 : 0
    };
    var todayFee = todaySum.promotionRate != null ? todaySum.promotionRate : snap.promotionRate;
    var yestFee = yestSum.promotionRate;
    var yestFeeH = yestFee == null ? [] : repeatHours(yestFee, 24);
    var todayFeeH = todayFee == null ? [] : todayHours(repeatHours(todayFee, 24));
    live.paid = {
      label: "实时费比",
      value: fmtRate(todayFee),
      delta: trendOf(todayFee, yestFee),
      yesterday: todayFeeH.length || yestFeeH.length ? yestFeeH : yestFee == null ? [] : [yestFee, yestFee],
      today: todayFeeH.length || yestFeeH.length ? todayFeeH : todayFee == null ? [] : [todayFee, todayFee],
      yesterdayHour: yestFeeH,
      todayHour: todayFeeH,
      hours: yestFeeH.length || todayFeeH.length ? 24 : 0,
      unit: "rate",
      lineMode: "flat"
    };
    live.cards = [
      { key: "ad", label: "推广花费 (支付预估)", value: fmtMoney(todayAd), extra: todaySum.promotionRate != null ? "推广占比 " + fmtRate(todaySum.promotionRate) : "" },
      { key: "roi", label: "付费成交ROI", value: fmtRoi(todaySum.payAmount != null ? todaySum.payAmount : todayPay, todayAd) },
      { key: "livePay", label: "实时付费成交额", value: fmtMoney(todayPay) },
      { key: "livePaid", label: "实时付费金额", value: fmtMoney(todayAd) }
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
      if (String(shop.manager || "").trim() === name) {
        return true;
      }
      var text =
        String(shop.team || "") +
        String(shop.chief || "") +
        String(shop.pack || "") +
        String(shop.lead || "") +
        String(shop.name || "") +
        String(shop.storeName || "");
      return text.indexOf(name) !== -1;
    };
  }
  function dutyShopOwner(shop, grants) {
    if (!shop) {
      return "—";
    }
    var op = shopDutyName(shop, "operator");
    if (op) {
      return op;
    }
    var owner = String(shop.owner || "").trim();
    if (owner && owner !== "管理员") {
      return owner;
    }
    return ownerOfShop(shop, grants);
  }
  function personIsChief(person) {
    if (!person || person.status !== "在职") {
      return false;
    }
    if (person.role === "主管" || person.role === "储备") {
      return true;
    }
    var n = String(person.name || "").trim();
    return !!(n && String(person.reserve || "").trim() === n);
  }
  function dutyPersonName(shop, keys) {
    var list = keys || [];
    var i;
    for (i = 0; i < list.length; i += 1) {
      var n = String((shop && shop[list[i]]) || "").trim();
      if (n && n !== "管理员" && n !== "无") {
        return n;
      }
    }
    return "";
  }
  function shopSupervisorName(shop) {
    return dutyPersonName(shop, ["supervisor", "supervisorName"]);
  }
  function shopReserveName(shop) {
    return dutyPersonName(shop, ["reserve", "reserveName", "chuBei", "backup"]);
  }
  function teamLeadNames(people, dutyShops, role) {
    var seen = {};
    var names = [];
    function add(name) {
      var n = String(name || "").trim();
      if (!n || n === "管理员" || seen[n]) {
        return;
      }
      seen[n] = true;
      names.push(n);
    }
    (people || []).forEach(function (person) {
      if (role === "主管" ? personIsChief(person) : person && person.status === "在职" && person.role === role) {
        add(person.name);
      }
    });
    (dutyShops || []).forEach(function (shop) {
      if (role === "经理") {
        add(shop && shop.manager);
      }
      if (role === "主管" && shop) {
        add(shopSupervisorName(shop));
        add(shopReserveName(shop));
      }
    });
    if (!names.length && role === "经理") {
      add("沈子晗");
      add("韩梦凯");
    }
    return names;
  }
  function shopOnRoleTeam(shop, name, role) {
    if (!shop || !name) {
      return false;
    }
    if (role === "主管") {
      var asst = String(shop.assistant || "").trim();
      var op = String(shop.operator || "").trim();
      return shopSupervisorName(shop) === name || shopReserveName(shop) === name || (asst === name && asst !== op);
    }
    var manager = String(shop.manager || "").trim();
    if (manager) {
      return manager === name;
    }
    return teamPredicate(name)(shop);
  }
  function buildTeams(dutyShops, grants, rangePack, prevPack, catalogPack, people, role) {
    var erp = mapByShopId(rangePack && rangePack.records);
    var prevErp = mapByShopId(prevPack && prevPack.records);
    var catalog = mapByShopId((catalogPack && catalogPack.records) || (rangePack && rangePack.records));
    var catalogByName = mapByShopName((catalogPack && catalogPack.records) || (rangePack && rangePack.records) || []);
    var shops = dutyShops || [];
    var mismatches = [];
    function oneTeam(key, name) {
      var pred = function (shop) {
        return shopOnRoleTeam(shop, name, role || "经理");
      };
      var rows = [];
      var matched = [];
      var prevMatched = [];
      var seen = {};
      function pushShop(label, owner, erpRow, pay) {
        rows.push({
          shop: label,
          owner: owner,
          metrics: shopMetricsFrom(erpRow),
          _pay: pay
        });
      }
      shops.forEach(function (shop) {
        if (!pred(shop)) {
          return;
        }
        var label = shopDisplayName(shop);
        var id = resolveErpId(shop, catalogByName);
        var owner = dutyShopOwner(shop, grants);
        if (!id) {
          mismatches.push(name + " · " + label + "（人管有店，无店铺id）");
          pushShop(label, owner, null, -1);
          return;
        }
        var erpRow = erp[id];
        if (!erpRow) {
          if (!catalog[id]) {
            mismatches.push(name + " · " + label + "（人管有店，ERP 无此店铺id）");
          }
          pushShop(label, owner, catalog[id] ? { payAmount: 0 } : null, catalog[id] ? 0 : -1);
          return;
        }
        if (!seen[id]) {
          seen[id] = true;
          matched.push(erpRow);
          if (prevErp[id]) {
            prevMatched.push(prevErp[id]);
          }
        }
        pushShop(label, owner, erpRow, asNum(erpRow.payAmount));
      });
      rows.sort(function (a, b) {
        return (Number(b._pay) || 0) - (Number(a._pay) || 0);
      });
      if (!rows.length && name === "韩梦凯") {
        mismatches.push("韩梦凯 · 整包");
      }
      return {
        key: key,
        name: name,
        cards: companyCardsFrom(sumPack(matched), sumPack(prevMatched)),
        shops: rows
      };
    }
    return {
      teams: teamLeadNames(people, shops, role || "经理").map(function (name, index) {
        return oneTeam("t" + index, name);
      }),
      mismatches: mismatches
    };
  }
  function shopDutyName(shop, field) {
    if (field === "supervisor") {
      return shopSupervisorName(shop);
    }
    if (field === "reserve") {
      return shopReserveName(shop);
    }
    var n = String((shop && shop[field]) || "").trim();
    if (!n || n === "管理员" || n === "无") {
      return "";
    }
    if (field === "operator" && (n === shopSupervisorName(shop) || n === shopReserveName(shop))) {
      return "";
    }
    return n;
  }
  function reserveNameSet(shops, people) {
    var blocked = {};
    (shops || []).forEach(function (shop) {
      var n = shopReserveName(shop);
      if (n) {
        blocked[n] = true;
      }
    });
    (people || []).forEach(function (person) {
      if (!person || person.status !== "在职") {
        return;
      }
      var n = String(person.name || "").trim();
      if (!n) {
        return;
      }
      if (person.role === "储备" || String(person.reserve || "").trim() === n) {
        blocked[n] = true;
      }
    });
    return blocked;
  }
  function namesFromShopDuty(shops, field, people) {
    var blocked = {};
    if (field === "operator") {
      (shops || []).forEach(function (shop) {
        var sup = shopSupervisorName(shop);
        if (sup) {
          blocked[sup] = true;
        }
      });
      Object.assign(blocked, reserveNameSet(shops, people));
    }
    var seen = {};
    var names = [];
    function add(name) {
      var n = String(name || "").trim();
      if (!n || n === "管理员" || seen[n] || blocked[n]) {
        return;
      }
      seen[n] = true;
      names.push(n);
    }
    if (field === "chief") {
      (shops || []).forEach(function (shop) {
        add(shopSupervisorName(shop));
        add(shopReserveName(shop));
      });
      return names;
    }
    (shops || []).forEach(function (shop) {
      add(shopDutyName(shop, field));
    });
    return names;
  }
  function shopMatchesDuty(shop, name, field) {
    if (!shop || !name) {
      return false;
    }
    if (field === "chief") {
      return shopSupervisorName(shop) === name || shopReserveName(shop) === name;
    }
    return shopDutyName(shop, field) === name;
  }
  function sumDutyMetric(shops, name, field, erp, catalogByName, metric) {
    var total = 0;
    var ok = false;
    (shops || []).forEach(function (shop) {
      if (!shopMatchesDuty(shop, name, field)) {
        return;
      }
      var id = resolveErpId(shop, catalogByName);
      var row = id ? erp[id] : null;
      var n = row ? asNum(row[metric]) : null;
      if (n != null) {
        total += n;
        ok = true;
      }
    });
    return ok ? total : 0;
  }
  function buildLadders(people, dutyShops, rangePack, catalogPack) {
    var erp = mapByShopId(rangePack && rangePack.records);
    var catalogByName = mapByShopName((catalogPack && catalogPack.records) || []);
    function column(title, dutyField, field) {
      var rows = namesFromShopDuty(dutyShops, dutyField, people)
        .map(function (name) {
          var n = sumDutyMetric(dutyShops, name, dutyField, erp, catalogByName, field);
          return { name: name, amount: fmtMoney(n), _n: n };
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
        columns: [column("主管储备排行榜", "chief", "payAmount"), column("运营排行榜", "operator", "payAmount")]
      },
      {
        key: "profit",
        title: "利润排行榜",
        unit: "利润",
        columns: [column("主管储备排行榜", "chief", "profit"), column("运营排行榜", "operator", "profit")]
      }
    ];
  }
  window.XmModules = window.XmModules || {};
  window.XmModules["/home"] = {
    mount: function (root) {
      clearLiveRowPicked();
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
        live: blankLive(),
        shops: [],
        teams: blankTeams(),
        chiefs: blankRoleTeams("主管"),
        people: [],
        dutyShops: [],
        dutyKeys: null,
        dutyReady: false,
        ownCards: blankCompanyCards(),
        livePacks: null,
        rangePack: null,
        prevPack: null,
        teamGaps: [],
        chiefGaps: [],
        ladders: blankLadders(),
        liveAt: "",
        gaps: [],
        source: ""
      };
      var poll = 0;
      var LIVE_REFRESH_MS = 5 * 60 * 1000;
      cardSetOpen = false;
      paint(root, state);
      function shanghaiClock() {
        return new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
      }
      function liveScopeKeys() {
        if (!homeUserName(state.user)) {
          return {};
        }
        if (isHomeBoss(state.user)) {
          return null;
        }
        return state.dutyReady ? state.dutyKeys || {} : {};
      }
      function applyDutyCards() {
        if (!state.rangePack) {
          return;
        }
        var keys = liveScopeKeys();
        state.cards = companyCardsFrom(summaryFrom(state.rangePack), summaryFrom(state.prevPack));
        if (keys) {
          state.ownCards = companyCardsFrom(summaryFrom(scopePack(state.rangePack, keys)), summaryFrom(scopePack(state.prevPack, keys)));
        } else {
          state.ownCards = state.cards;
        }
      }
      function applyLive(todayPack, yestPack, snapPack) {
        state.livePacks = { today: todayPack, yest: yestPack, snap: snapPack };
        var keys = liveScopeKeys();
        var today = scopePack(todayPack, keys);
        var yest = scopePack(yestPack, keys);
        var snap = scopePack(snapPack, keys);
        state.live = liveFromErp(today, yest, snap);
        state.shops = state.live.shops;
        state.liveAt = shanghaiClock();
        state.source = "xingmai-erp";
        paint(root, state);
      }
      function pullLiveKpis() {
        var today = shanghaiYmd(0);
        var yest = shanghaiYmd(1);
        return Promise.all([
          fetchRangePack(today, today),
          fetchRangePack(yest, yest),
          fetchCatalogPack()
        ]).then(function (pack) {
          if (!dead) {
            applyLive(pack[0], pack[1], pack[2]);
          }
        }).catch(function () {
          if (!dead) {
            paint(root, state);
          }
        });
      }
      var boardSeq = 0;
      function refreshRange() {
        clearRangeData(state);
        if (state.view === "live") {
          clearLiveShown(state);
        }
        paint(root, state);
        return pullBoard();
      }
      function refreshTeams() {
        if (teamsRefreshing) {
          return;
        }
        viewKey = state.view || "company";
        saveGone([]);
        closeCal();
        cardSetOpen = false;
        headSetOpen = false;
        teamsRefreshing = true;
        clearRangeData(state);
        paint(root, state);
        return pullBoard().then(function () {
          teamsRefreshing = false;
          if (!dead) {
            paint(root, state);
          }
        }).catch(function () {
          teamsRefreshing = false;
          if (!dead) {
            paint(root, state);
          }
        });
      }
      function refreshLive() {
        if (liveRefreshing) {
          return;
        }
        liveRefreshing = true;
        clearLiveRowPicked();
        paint(root, state);
        return Promise.resolve(pullLive(true)).then(function () {
          liveRefreshing = false;
          if (!dead) {
            paint(root, state);
          }
        }).catch(function () {
          liveRefreshing = false;
          if (!dead) {
            paint(root, state);
          }
        });
      }
      function pullLive(blankFirst) {
        if (blankFirst) {
          clearLiveShown(state);
          paint(root, state);
        }
        return api("/api/home/erp-paid").then(function (data) {
          if (dead) {
            return;
          }
          if (data && data.ok && (data.summary || (data.records && data.records.length))) {
            var todayPack = { records: data.records || [], summary: data.summary || {}, hourly: data.hourly };
            var yestPack = { records: [], summary: data.yesterday || {}, hourly: data.hourly };
            applyLive(todayPack, yestPack, todayPack);
            return;
          }
          return pullLiveKpis();
        }).catch(function () {
          if (!dead) {
            return pullLiveKpis();
          }
        });
      }
      function pullBoard() {
        var seq = ++boardSeq;
        var prev = previousDates(state.from, state.to);
        return Promise.all([
          fetchRangePack(state.from, state.to),
          fetchRangePack(prev.from, prev.to),
          fetchCatalogPack(),
          api("/api/people"),
          api("/api/people/shops"),
          api("/api/people/grants"),
          api("/api/people/org/stores?_=" + Date.now())
        ]).then(function (pack) {
          if (dead || seq !== boardSeq) {
            return;
          }
          var rangePack = pack[0] || { records: [], summary: null };
          var prevPack = pack[1] || { records: [], summary: null };
          var catalogPack = pack[2] || { records: [], summary: null };
          var people = pack[3] && pack[3].people ? pack[3].people : [];
          var peopleShops = pack[4] || { shops: [] };
          var grants = pack[5] && pack[5].grants ? pack[5].grants : [];
          var dutyShops = dutyShopsFrom(pack[6], peopleShops);
          state.people = people;
          state.dutyShops = dutyShops;
          state.rangePack = rangePack;
          state.prevPack = prevPack;
          state.dutyReady = true;
          state.dutyKeys = dutyShopKeys(dutyShops, state.user);
          applyDutyCards();
          var built = buildTeams(dutyShops, grants, rangePack, prevPack, catalogPack, people, "经理");
          var chiefs = buildTeams(dutyShops, grants, rangePack, prevPack, catalogPack, people, "主管");
          state.teams = built.teams;
          state.chiefs = chiefs.teams;
          state.ladders = buildLadders(people, dutyShops, rangePack, catalogPack);
          state.teamGaps = built.mismatches;
          state.chiefGaps = chiefs.mismatches;
          state.gaps = built.mismatches;
          state.source = (rangePack.summary && rangePack.summary.payAmount != null) || (rangePack.records && rangePack.records.length) ? "xingmai-erp" : "";
          if (state.livePacks) {
            applyLive(state.livePacks.today, state.livePacks.yest, state.livePacks.snap);
            return;
          }
          paint(root, state);
        }).catch(function () {
          if (!dead && seq === boardSeq) {
            paint(root, state);
          }
        });
      }
      function onClick(event) {
        var help = event.target.closest && event.target.closest(".xm-hm-help");
        if (help) {
          return;
        }
        var view = event.target.closest("[data-view]");
        if (view) {
          var nextView = view.getAttribute("data-view");
          if (!allowedHomeViews(state.user, state.people, state.dutyShops)[nextView]) {
            return;
          }
          if (nextView !== state.view) {
            clearLiveRowPicked();
          }
          state.view = nextView;
          viewKey = state.view || "company";
          state.mode = state.view === "team" || state.view === "chief" ? "company" : "shop";
          closeCal();
          clearTextSelection();
          cardSetOpen = false;
          headSetOpen = false;
          paint(root, state);
          if (state.view === "live" || state.view === "company") {
            pullLive(true);
          }
          return;
        }
        var range = event.target.closest("[data-range]");
        if (range) {
          state.range = range.getAttribute("data-range");
          var next = rangeDates(state.range);
          state.from = next.from;
          state.to = next.to;
          closeCal();
          refreshRange();
          return;
        }
        if (event.target.closest("#xm-hm-date-clear")) {
          var yest = rangeDates("yesterday");
          state.range = "yesterday";
          state.from = yest.from;
          state.to = yest.to;
          closeCal();
          refreshRange();
          return;
        }
        if (event.target.closest("#xm-hm-dates")) {
          if (calOpen) {
            closeCal();
          } else {
            openCal();
          }
          return;
        }
        var calNav = event.target.closest("[data-cal-nav]");
        if (calNav) {
          calCursor = shiftMonth(calCursor, Number(calNav.getAttribute("data-cal-nav")) || 0);
          renderCal();
          return;
        }
        if (event.target.closest("#xm-hm-cal [data-ymd]")) {
          return;
        }
        var drop = event.target.closest("[data-drop-team]");
        if (drop) {
          viewKey = state.view || "company";
          var n = drop.getAttribute("data-drop-team") || "";
          var g = goneTeams();
          if (n && g.indexOf(n) < 0) {
            g.push(n);
            saveGone(g);
          }
          paint(root, state);
          return;
        }
        if (event.target.closest("[data-refresh-teams]")) {
          refreshTeams();
          return;
        }
        if (event.target.closest("[data-refresh-live]")) {
          refreshLive();
          return;
        }
        if (event.target.closest("[data-show-teams]")) {
          viewKey = state.view || "company";
          saveGone([]);
          paint(root, state);
          return;
        }
        if (event.target.closest("[data-live-heads]")) {
          headSetOpen = !headSetOpen;
          cardSetOpen = false;
          syncCardPop(root);
          syncHeadPop(root, event.target.closest("[data-live-heads]"));
          closeCal();
          return;
        }
        if (event.target.closest(".xm-hm-set")) {
          viewKey = state.view || "company";
          cardSetOpen = !cardSetOpen;
          headSetOpen = false;
          syncHeadPop(root);
          syncCardPop(root, event.target.closest(".xm-hm-set"));
          closeCal();
          return;
        }
        var sortBtn = event.target.closest("[data-shop-sort]");
        if (sortBtn) {
          shopSort = { key: sortBtn.getAttribute("data-shop-sort") || "", dir: sortBtn.getAttribute("data-dir") || "desc" };
          paint(root, state);
          return;
        }
        var liveRow = event.target.closest(".xm-hm-live .xm-hm-table tbody tr");
        if (liveRow && !isHomeFormField(event.target)) {
          var picked = toggleLiveRowPicked(liveRow.getAttribute("data-live-shop"));
          liveRow.classList.toggle("is-picked", picked);
        }
      }
      function onOutsideCardSet(event) {
        var t = event.target && event.target.closest ? event.target : null;
        var onPop = t && (t.closest("#xm-hm-pop") || t.closest(".xm-hm-set"));
        if (cardSetOpen && !onPop) {
          cardSetOpen = false;
          syncCardPop(root);
        }
        var onHead = t && (t.closest("#xm-hm-head-pop") || t.closest("[data-live-heads]"));
        if (headSetOpen && !onHead) {
          headSetOpen = false;
          syncHeadPop(root);
        }
        if (calOpen && Date.now() - calLockAt > 400 && t && !t.closest("#xm-hm-cal") && !t.closest("#xm-hm-dates")) {
          closeCal();
        }
      }
      function onHelpOver(event) {
        var help = helpFromEvent(event);
        if (!help) {
          return;
        }
        showCardTip(help);
      }
      function onHelpOut(event) {
        var help = helpFromEvent(event);
        if (!help) {
          return;
        }
        var to = event.relatedTarget;
        if (to && help.contains(to)) {
          return;
        }
        hideCardTip();
      }
      function placeLineTip(tip, event) {
        var tw = tip.offsetWidth || 180;
        var th = tip.offsetHeight || 96;
        var left = event.clientX + 12;
        var top = event.clientY + 14;
        if (left + tw > window.innerWidth - 8) {
          left = event.clientX - tw - 12;
        }
        if (top + th > window.innerHeight - 8) {
          top = event.clientY - th - 12;
        }
        if (left < 8) {
          left = 8;
        }
        if (top < 8) {
          top = 8;
        }
        tip.style.left = Math.round(left) + "px";
        tip.style.top = Math.round(top) + "px";
      }
      function onLineTipMove(event) {
        var chartEl = event.target && event.target.closest ? event.target.closest(".xm-hm-chart[data-hours]") : null;
        var svg = event.target && event.target.closest ? event.target.closest(".xm-hm-line") : null;
        if (!chartEl || !svg || !chartEl.contains(svg)) {
          hideLineTip(root);
          return;
        }
        var slots = Number(chartEl.getAttribute("data-hours")) || 24;
        var hero = (state.live && state.live.hero) || {};
        var yestHour = hero.yesterdayHour || [];
        var todayHour = hero.todayHour || [];
        var yestCum = hero.yesterday || [];
        var todayCum = hero.today || [];
        if (!yestHour.length && !yestCum.length) {
          hideLineTip(root);
          return;
        }
        var i = hourFromEvent(svg, event, slots);
        var label = "";
        var part = "本小时";
        if (slots === 48) {
          yestHour = toHalfIncrements(yestHour);
          todayHour = toHalfIncrements(todayHour);
          yestCum = cumHours(yestHour);
          todayCum = cumHours(todayHour);
          label = halfTipLabel(i);
          part = "半小时";
        }
        var todayOk = i < todayHour.length;
        var tip = lineTipNode();
        tip.innerHTML = lineTipHtml(
          i,
          yestHour[i],
          yestCum[i],
          todayHour[i],
          todayOk,
          todayCum[i],
          label,
          part
        );
        tip.classList.add("is-on");
        placeLineTip(tip, event);
        var guide = svg.querySelector(".xm-hm-line-guide");
        if (guide) {
          var x = hourX(i, slots).toFixed(1);
          guide.setAttribute("x1", x);
          guide.setAttribute("x2", x);
          guide.setAttribute("visibility", "visible");
        }
      }
      function onTipScroll() {
        hideLineTip(root);
        placeCardPop(root);
        if (!cardTipAnchor || !cardTipEl || !cardTipEl.classList.contains("is-on")) {
          return;
        }
        if (!document.body.contains(cardTipAnchor)) {
          hideCardTip();
          return;
        }
        placeCardTip(cardTipAnchor);
      }
      function onCalHover(event) {
        if (!calOpen || !calPick) {
          return;
        }
        var day = event.target.closest && event.target.closest("#xm-hm-cal [data-ymd]");
        var ymd = day && !day.disabled ? day.getAttribute("data-ymd") || "" : "";
        if (ymd === calHover) {
          return;
        }
        calHover = ymd;
        paintCalHover();
      }
      function onCalPointerDown(event) {
        var day = event.target.closest && event.target.closest("#xm-hm-cal [data-ymd]");
        if (!calOpen || !day || day.disabled) {
          return;
        }
        var ymd = day.getAttribute("data-ymd") || "";
        if (!ymd) {
          return;
        }
        if (event.cancelable) {
          event.preventDefault();
        }
        applyCalDay(ymd);
      }
      var calOpen = false;
      var calCursor = (state.from || shanghaiYmd(1)).slice(0, 7);
      var calPick = "";
      var calHover = "";
      var calLockAt = 0;
      function calOpts() {
        var applied = !calPick && withinDays(state.from, state.to, 30);
        return {
          today: shanghaiYmd(0),
          pick: calPick,
          start: calPick || (applied ? state.from : ""),
          end: calPick ? calHover : applied ? state.to : "",
          hover: calPick ? calHover : ""
        };
      }
      function paintCalHover() {
        var el = root.querySelector("#xm-hm-cal");
        if (!el) {
          return;
        }
        var opts = calOpts();
        Array.prototype.forEach.call(el.querySelectorAll("[data-ymd]"), function (btn) {
          var ymd = btn.getAttribute("data-ymd") || "";
          var other = btn.classList.contains("is-other");
          var cls = calDayClass(ymd, opts, other);
          btn.className = cls.join(" ");
          btn.disabled = cls.indexOf("is-off") !== -1;
        });
      }
      function applyCalDay(ymd) {
        calLockAt = Date.now();
        if (!calPick) {
          calPick = ymd;
          calHover = "";
          renderCal();
          return;
        }
        var from = calPick < ymd ? calPick : ymd;
        var to = calPick < ymd ? ymd : calPick;
        if (!withinDays(from, to, 30)) {
          return;
        }
        state.from = from;
        state.to = to;
        state.range = "custom";
        closeCal();
        refreshRange();
      }
      function renderCal() {
        var el = root.querySelector("#xm-hm-cal");
        var btn = root.querySelector("#xm-hm-dates");
        if (!el) {
          return;
        }
        el.hidden = !calOpen;
        if (btn) {
          btn.classList.toggle("is-on", calOpen);
          btn.setAttribute("aria-expanded", calOpen ? "true" : "false");
        }
        if (!calOpen) {
          return;
        }
        el.innerHTML = calPanelHtml(calCursor, calOpts());
      }
      function closeCal() {
        calOpen = false;
        calPick = "";
        calHover = "";
        renderCal();
      }
      function openCal() {
        calOpen = true;
        calPick = "";
        calHover = "";
        calCursor = (state.from || shanghaiYmd(1)).slice(0, 7);
        renderCal();
      }
      var sortFrom = "";
      var sortDragging = false;
      var sortSettings = false;
      var sortTeam = false;
      var sortLive = false;
      var sortHead = false;
      var sortStartX = 0;
      var sortStartY = 0;
      var sortSwallow = false;
      var colDrag = null;
      var rowDrag = null;
      function shopColHit(event) {
        var cell = event.target.closest && event.target.closest(".xm-hm-teams .xm-hm-table th, .xm-hm-live .xm-hm-table th");
        if (!cell) return null;
        var rect = cell.getBoundingClientRect();
        var x = event.clientX || 0;
        if (rect.right - x <= 8) {
          return { table: cell.closest("table"), idx: cell.cellIndex, start: cell.offsetWidth, x: x };
        }
        if (cell.cellIndex > 0 && x - rect.left <= 8) {
          var prev = cell.parentNode.cells[cell.cellIndex - 1];
          return { table: cell.closest("table"), idx: cell.cellIndex - 1, start: prev.offsetWidth, x: x };
        }
        return null;
      }
      function liveFeeHead(cell) {
        var key = cell && cell.getAttribute ? cell.getAttribute("data-live-col") : "";
        return key === "feeWarn" || key === "feeGoal" || key === "liveAt";
      }
      function liveRowHit(event) {
        if (shopColHit(event)) {
          return null;
        }
        var cell = event.target.closest && event.target.closest(".xm-hm-live .xm-hm-table th");
        if (!cell || !cell.parentNode || !cell.parentNode.cells) {
          return null;
        }
        if (liveFeeHead(cell) || cell.cellIndex >= cell.parentNode.cells.length - 3) {
          return null;
        }
        var rect = cell.getBoundingClientRect();
        if (rect.bottom - (event.clientY || 0) <= 8) {
          return { start: liveRowPad(), y: event.clientY || 0 };
        }
        return null;
      }
      function clearTextSelection() {
        var ae = document.activeElement;
        if (isFeeTyping(ae)) {
          return;
        }
        var sel = window.getSelection && window.getSelection();
        if (sel && sel.removeAllRanges) sel.removeAllRanges();
      }
      function sortFinish() {
        sortFrom = "";
        sortDragging = false;
        sortSettings = false;
        sortTeam = false;
        sortLive = false;
        sortHead = false;
        clearTextSelection();
        Array.prototype.forEach.call(root.querySelectorAll(".is-hold, .is-over"), function (el) {
          el.classList.remove("is-hold", "is-over");
        });
      }
      function sortMarkOver(el) {
        Array.prototype.forEach.call(root.querySelectorAll(".is-over"), function (item) {
          item.classList.remove("is-over");
        });
        if (el) {
          el.classList.add("is-over");
        }
      }
      function hitLiveHead(event) {
        var x = event.clientX || 0;
        var y = event.clientY || 0;
        var el = document.elementFromPoint(x, y);
        var th = el && el.closest ? el.closest(".xm-hm-live .xm-hm-table th[data-live-col]") : null;
        if (th && root.contains(th)) {
          return th;
        }
        var heads = root.querySelectorAll(".xm-hm-live .xm-hm-table th[data-live-col]");
        var i, rect;
        for (i = 0; i < heads.length; i += 1) {
          rect = heads[i].getBoundingClientRect();
          if (x >= rect.left && x <= rect.right && y >= rect.top - 12 && y <= rect.bottom + 12) {
            return heads[i];
          }
        }
        return null;
      }
      function hitSortEl(event) {
        if (sortHead) {
          return hitLiveHead(event);
        }
        var el = document.elementFromPoint(event.clientX || 0, event.clientY || 0);
        if (!el || !el.closest || !root.contains(el)) {
          return null;
        }
        return sortTeam
          ? el.closest(".xm-hm-team")
          : sortSettings
            ? el.closest("#xm-hm-card-opts label")
            : el.closest(".xm-hm-card");
      }
      function onSortDown(event) {
        if (event.button && event.button !== 0) {
          return;
        }
        if (isHomeFormField(event.target)) {
          return;
        }
        if (!event.target.closest || !event.target.closest("#xm-hm")) {
          return;
        }
        var hit = shopColHit(event);
        if (hit) {
          if (event.cancelable) {
            event.preventDefault();
          }
          applyColW(hit.table, hit.idx, hit.start, 1);
          colDrag = hit;
          clearTextSelection();
          return;
        }
        var rowHit = liveRowHit(event);
        if (rowHit) {
          if (event.cancelable) {
            event.preventDefault();
          }
          rowDrag = rowHit;
          clearTextSelection();
          return;
        }
        var liveHead = event.target.closest && event.target.closest(".xm-hm-live .xm-hm-table th[data-live-col]");
        if (liveHead && liveHead.getAttribute("data-live-col") !== "rank") {
          if (event.cancelable) {
            event.preventDefault();
          }
          sortFrom = liveHead.getAttribute("data-live-col") || "";
          sortHead = true;
          sortLive = false;
          sortTeam = false;
          sortSettings = false;
          sortStartX = event.clientX || 0;
          sortStartY = event.clientY || 0;
          clearTextSelection();
          return;
        }
        if (event.target.closest("i") || event.target.closest("input") || event.target.closest("button") || event.target.closest("a")) {
          return;
        }
        var teamCol = event.target.closest(".xm-hm-team");
        var card = event.target.closest(".xm-hm-card");
        var row = event.target.closest("#xm-hm-card-opts label");
        sortStartX = event.clientX || 0;
        sortStartY = event.clientY || 0;
        if (teamCol && !event.target.closest(".xm-hm-card,.xm-hm-table")) {
          if (event.cancelable) event.preventDefault();
          sortFrom = teamCol.getAttribute("data-name") || "";
          sortTeam = true;
          sortLive = false;
          sortSettings = false;
          clearTextSelection();
          return;
        }
        if (card && (card.closest("#xm-hm-kpis") || card.closest("#xm-hm-teams") || card.closest(".xm-hm-live-cards"))) {
          if (event.cancelable) event.preventDefault();
          sortFrom = card.getAttribute("data-card") || "";
          sortSettings = false;
          sortLive = !!card.closest(".xm-hm-live-cards");
          sortTeam = false;
          clearTextSelection();
          return;
        }
        if (row) {
          if (event.cancelable) event.preventDefault();
          sortFrom = row.getAttribute("data-sort") || "";
          sortSettings = true;
          clearTextSelection();
        }
      }
      function onSortSelectStart(event) {
        if (isFeeTyping(event.target)) {
          return;
        }
        var tab = event.target.closest && event.target.closest(".xm-hm-views button,.xm-hm-ranges button,.xm-hm-set,.xm-hm-dates,[data-refresh-teams],[data-show-teams],[data-refresh-live],[data-live-heads]");
        if (sortFrom || sortDragging || tab) event.preventDefault();
      }
      function onSortMove(event) {
        if (isFeeTyping(event.target) || isFeeTyping(document.activeElement)) {
          return;
        }
        var x = event.clientX || 0;
        var y = event.clientY || 0;
        if (colDrag) {
          if (event.cancelable) {
            event.preventDefault();
          }
          applyColW(colDrag.table, colDrag.idx, colDrag.start + (x - colDrag.x));
          document.body.style.cursor = "col-resize";
          return;
        }
        if (rowDrag) {
          if (event.cancelable) {
            event.preventDefault();
          }
          saveLiveRowPad(rowDrag.start + (y - rowDrag.y));
          applyLiveRowPad(root);
          document.body.style.cursor = "row-resize";
          return;
        }
        if (!sortFrom && !sortDragging) {
          document.body.style.cursor = liveRowHit(event) ? "row-resize" : shopColHit(event) ? "col-resize" : "";
        }
        if (sortFrom || sortDragging) {
          clearTextSelection();
        }
        if (sortFrom && !sortDragging && (Math.abs(x - sortStartX) > 8 || Math.abs(y - sortStartY) > 8)) {
          sortDragging = true;
          if (sortHead) {
            var movingHead = root.querySelector('.xm-hm-live .xm-hm-table th[data-live-col="' + sortFrom + '"]');
            if (movingHead) {
              movingHead.classList.add("is-hold");
            }
          } else {
            var moving = sortTeam
              ? root.querySelectorAll('.xm-hm-team[data-name="' + sortFrom + '"]')
              : root.querySelectorAll('.xm-hm-card[data-card="' + sortFrom + '"]');
            Array.prototype.forEach.call(moving, function (el) {
              el.classList.add("is-hold");
            });
          }
        }
        if (sortSettings && sortFrom && !sortDragging && (Math.abs(x - sortStartX) > 6 || Math.abs(y - sortStartY) > 6)) {
          sortDragging = true;
          var startRow = root.querySelector('#xm-hm-card-opts label[data-sort="' + sortFrom + '"]');
          if (startRow) {
            startRow.classList.add("is-hold");
          }
        }
        if (!sortDragging || !sortFrom) {
          return;
        }
        if (event.cancelable) {
          event.preventDefault();
        }
        var over = hitSortEl(event);
        var overKey = over
          ? over.getAttribute(sortHead ? "data-live-col" : sortTeam ? "data-name" : sortSettings ? "data-sort" : "data-card")
          : "";
        if (over && overKey && overKey !== sortFrom) {
          sortMarkOver(over);
        } else {
          sortMarkOver(null);
        }
      }
      function onSortUp(event) {
        if (colDrag) {
          if (colKey(colDrag.table) === "live") {
            saveLiveColW();
          }
          colDrag = null;
          document.body.style.cursor = "";
          sortFinish();
          return;
        }
        if (rowDrag) {
          rowDrag = null;
          document.body.style.cursor = "";
          sortFinish();
          return;
        }
        var moved = sortDragging && sortFrom;
        var toEl = hitSortEl(event);
        var toKey = toEl
          ? toEl.getAttribute(sortHead ? "data-live-col" : sortTeam ? "data-name" : sortSettings ? "data-sort" : "data-card")
          : "";
        if (moved && toKey && toKey !== sortFrom) {
          if (sortHead) {
            saveLiveHeadOrder(applyLiveHeadMove(sortFrom, toKey));
          } else if (sortTeam) {
            saveTeamCols(sortFrom, toKey, state.view === "chief");
          } else if (sortLive) {
            saveLiveCardOrder(applyLiveCardMove(sortFrom, toKey));
          } else {
            saveCardOrder(applyCardMove(sortFrom, toKey, !sortSettings));
          }
          paint(root, state);
          sortSwallow = true;
          window.setTimeout(function () {
            sortSwallow = false;
          }, 400);
        }
        sortFinish();
      }
      function onSortClickCapture(event) {
        if (!sortSwallow) {
          return;
        }
        sortSwallow = false;
        event.preventDefault();
        event.stopPropagation();
      }
      function onFeeKey(event) {
        if (event.target.getAttribute("data-fee-target") == null) {
          return;
        }
        if (event.key === "Enter") {
          event.target.blur();
        }
      }
      function onChange(event) {
        if (event.target.getAttribute("data-live-head-all") != null) {
          saveLiveHiddenHeads(
            event.target.checked
              ? []
              : liveHeadToggleList().map(function (col) {
                  return col.key;
                })
          );
          paint(root, state);
          return;
        }
        var liveHead = event.target.getAttribute("data-live-head");
        if (liveHead && !LIVE_LOCK_HEADS[liveHead]) {
          var heads = liveHiddenHeads();
          if (event.target.checked) {
            heads = heads.filter(function (item) {
              return item !== liveHead;
            });
          } else if (heads.indexOf(liveHead) === -1) {
            heads.push(liveHead);
          }
          saveLiveHiddenHeads(heads);
          paint(root, state);
          return;
        }
        if (event.target.getAttribute("data-live-filter") === "pick") {
          saveLiveFilter(parseLiveFilterValue(event.target.value));
          paint(root, state);
          return;
        }
        if (event.target.getAttribute("data-fee-target") != null) {
          saveFeeTargetFor(event.target.getAttribute("data-fee-shop"), event.target.value);
          paint(root, state);
          return;
        }
        if (event.target.getAttribute("data-hide-all") != null) {
          viewKey = state.view || "company";
          saveHidden(
            event.target.checked
              ? []
              : state.view === "company"
                ? companyHideKeys(state.cards)
                : arrangeCards(state.cards || blankCompanyCards()).map(function (card) {
                    return card.key;
                  })
          );
          paint(root, state);
          return;
        }
        var hideKey = event.target.getAttribute("data-hide");
        if (hideKey) {
          viewKey = state.view || "company";
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
      }
      var scroller = document.getElementById("xm-content") || root;
      root.addEventListener("click", onClick);
      root.addEventListener("keydown", onFeeKey);
      root.addEventListener("change", onChange);
      root.addEventListener("pointerdown", onCalPointerDown);
      root.addEventListener("pointerover", onCalHover);
      function onLineTipLeave() {
        hideLineTip(root);
      }
      root.addEventListener("mousemove", onLineTipMove);
      root.addEventListener("mouseleave", onLineTipLeave);
      root.addEventListener("mouseover", onHelpOver);
      root.addEventListener("mouseout", onHelpOut);
      scroller.addEventListener("scroll", onTipScroll, true);
      window.addEventListener("resize", onTipScroll);
      document.addEventListener("mousedown", onOutsideCardSet);
      document.addEventListener("click", onOutsideCardSet);
      document.addEventListener("pointerdown", onSortDown);
      document.addEventListener("pointermove", onSortMove, { passive: false });
      document.addEventListener("pointerup", onSortUp);
      document.addEventListener("pointercancel", onSortUp);
      document.addEventListener("click", onSortClickCapture, true);
      document.addEventListener("contextmenu", onSortSelectStart);
      document.addEventListener("selectstart", onSortSelectStart);
      document.addEventListener("dragstart", onSortSelectStart);
      pullBoard();
      pullLive();
      poll = window.setInterval(function () {
        if (state.view === "live" || state.view === "company") {
          pullLive();
        }
      }, LIVE_REFRESH_MS);
      if (!state.user || !state.user.username) {
        api("/api/auth/me").then(function (user) {
          if (dead || !user) {
            return;
          }
          state.user = user;
          state.dutyKeys = dutyShopKeys(state.dutyShops, state.user);
          applyDutyCards();
          if (state.livePacks) {
            applyLive(state.livePacks.today, state.livePacks.yest, state.livePacks.snap);
            return;
          }
          paint(root, state);
        });
      }
      return function unmount() {
        dead = true;
        clearLiveRowPicked();
        window.clearInterval(poll);
        root.removeEventListener("click", onClick);
        root.removeEventListener("keydown", onFeeKey);
        root.removeEventListener("change", onChange);
        root.removeEventListener("pointerdown", onCalPointerDown);
        root.removeEventListener("pointerover", onCalHover);
        root.removeEventListener("mousemove", onLineTipMove);
        root.removeEventListener("mouseleave", onLineTipLeave);
        root.removeEventListener("mouseover", onHelpOver);
        root.removeEventListener("mouseout", onHelpOut);
        scroller.removeEventListener("scroll", onTipScroll, true);
        window.removeEventListener("resize", onTipScroll);
        hideCardTip();
        hideLineTip(root);
        if (cardTipEl && cardTipEl.parentNode) {
          cardTipEl.parentNode.removeChild(cardTipEl);
        }
        cardTipEl = null;
        if (lineTipEl && lineTipEl.parentNode) {
          lineTipEl.parentNode.removeChild(lineTipEl);
        }
        lineTipEl = null;
        document.removeEventListener("mousedown", onOutsideCardSet);
        document.removeEventListener("click", onOutsideCardSet);
        document.removeEventListener("pointerdown", onSortDown);
        document.removeEventListener("pointermove", onSortMove);
        document.removeEventListener("pointerup", onSortUp);
        document.removeEventListener("pointercancel", onSortUp);
        document.removeEventListener("click", onSortClickCapture, true);
        document.removeEventListener("contextmenu", onSortSelectStart);
        document.removeEventListener("selectstart", onSortSelectStart);
        document.removeEventListener("dragstart", onSortSelectStart);
        sortFinish();
        root.innerHTML = "";
      };
    }
  };
})();
