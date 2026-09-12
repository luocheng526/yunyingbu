/* xm-module-home 0.1.393-home-tabsel */
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

  function parseYmd(ymd) {
    var p = String(ymd || "").split("-");
    return new Date(Date.UTC(Number(p[0]) || 1970, (Number(p[1]) || 1) - 1, Number(p[2]) || 1));
  }

  function ymdFromUtc(date) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date);
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
  var cardTipAnchor = null;
  var cardTipPinned = false;

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
    cardTipEl.setAttribute("role", "tooltip");
    document.body.appendChild(cardTipEl);
    return cardTipEl;
  }

  function hideCardTip(force) {
    if (cardTipPinned && !force) {
      return;
    }
    cardTipPinned = false;
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
    var left = box.right - tw;
    if (left < 8) {
      left = 8;
    }
    if (left + tw > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - tw - 8);
    }
    var top = box.bottom + 8;
    if (top + th > window.innerHeight - 8 && box.top - th - 8 >= 8) {
      top = box.top - th - 8;
    }
    if (top < 8) {
      top = 8;
    }
    tip.style.left = Math.round(left) + "px";
    tip.style.top = Math.round(top) + "px";
  }

  function showCardTip(anchor, pinned) {
    var text = cardTipText(anchor);
    if (!text) {
      return;
    }
    cardTipAnchor = anchor;
    cardTipPinned = !!pinned;
    cardTipNode().textContent = text;
    placeCardTip(anchor);
  }

  function helpFromEvent(event) {
    return event.target && event.target.closest ? event.target.closest(".xm-hm-help") : null;
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
      '<div class="xm-hm-cal-arrow" aria-hidden="true"></div>' +
      '<div class="xm-hm-cal-months">' +
      calMonthHtml(cursor, opts, "left") +
      calMonthHtml(shiftMonth(cursor, 1), opts, "right") +
      "</div>"
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

  function hiddenCards() {
    try {
      var raw = localStorage.getItem("xm-home-hidden-cards");
      return raw ? JSON.parse(raw) : [];
    } catch (_err) {
      return [];
    }
  }

  function teamHidden(hide) {
    var out = (hide || []).slice();
    try {
      if (localStorage.getItem("xm-home-hidden-cards") == null && out.indexOf("netQty") === -1) {
        out.push("netQty");
      }
    } catch (_err) {}
    return out;
  }

  function saveHidden(list) {
    try {
      localStorage.setItem("xm-home-hidden-cards", JSON.stringify(list));
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
      saved = JSON.parse(localStorage.getItem("xm-home-card-order") || "[]");
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
      localStorage.setItem("xm-home-card-order", JSON.stringify(cardOrderFrom(keys)));
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

  function orderedDefs() {
    var map = {};
    COMPANY_CARD_DEFS.forEach(function (def) {
      map[def.key] = def;
    });
    return cardOrder()
      .map(function (key) {
        return map[key];
      })
      .filter(Boolean);
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
      Math.round(Math.abs(n)) +
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
  var shopColW = [];

  function applyColW(table, idx, w) {
    if (!table || !table.rows) {
      return;
    }
    w = Math.max(48, Math.round(w));
    for (var i = 0; i < table.rows.length; i += 1) {
      var cell = table.rows[i].cells[idx];
      if (cell) {
        cell.style.width = cell.style.minWidth = w + "px";
      }
    }
    shopColW[idx] = w;
  }

  function restoreShopColW(root) {
    Array.prototype.forEach.call(root.querySelectorAll(".xm-hm-teams .xm-hm-table"), function (table) {
      shopColW.forEach(function (w, i) {
        if (w) {
          applyColW(table, i, w);
        }
      });
    });
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
          return '<td class="xm-hm-num">' + escapeHtml(metrics[def.key] || "—") + "</td>";
        })
        .join("") +
      "<td>" +
      escapeHtml(row.owner || "—") +
      "</td></tr>"
    );
  }

  function teamHeadHtml(team) {
    return (
      '<header class="xm-hm-team-head" data-team="' +
      escapeHtml(team.key) +
      '"><div><h2>' +
      escapeHtml(team.name) +
      "团队</h2><p>责权店对齐 ERP。</p></div>" +
      '<button type="button" class="xm-hm-set">卡片设置</button></header>'
    );
  }

  function teamShopsHtml(team, simple) {
    var shops = sortedShops(team.shops || [], simple ? { key: "", dir: "desc" } : shopSort);
    if (simple) {
      return (
        '<div class="xm-hm-panel" data-team="' +
        escapeHtml(team.key) +
        '"><h2>责权店铺 <span>' +
        shops.length +
        " 店</span></h2>" +
        '<table class="xm-hm-table"><thead><tr><th>排名</th><th>店铺名称</th><th class="xm-hm-num">数量</th></tr></thead><tbody>' +
        shops
          .map(function (row, i) {
            return "<tr><td>" + rankMark(i) + "</td><td>" + escapeHtml(row.shop) + '</td><td class="xm-hm-num">' + escapeHtml((row.metrics || {}).payQty || "—") + "</td></tr>";
          })
          .join("") +
        "</tbody></table></div>"
      );
    }
    var cols = shopCols();
    var sort = shopSort;
    return (
      '<div class="xm-hm-panel" data-team="' +
      escapeHtml(team.key) +
      '"><h2>责权店铺 <span>' +
      shops.length +
      " 店</span></h2>" +
      '<table class="xm-hm-table"><thead><tr><th>排名</th><th>店铺名称</th>' +
      cols
        .map(function (def) {
          return shopColHead(def, sort);
        })
        .join("") +
      "<th>运营</th></tr></thead><tbody>" +
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
      '">' +
      teamHeadHtml(team) +
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
    var list = teams && teams.length ? teams : simple ? [] : blankTeams();
    return (
      '<div class="xm-hm-teams-bar"><b>星脉甄选</b></div><div class="xm-hm-teams-grid">' +
      list
        .map(function (team) {
          return teamBlockHtml(team, hide, simple);
        })
        .join("") +
      "</div>"
    );
  }

  function seesAllChiefs(user) {
    user = user || {};
    return /超级|管理员|经理|全平台/.test(String(user.role || "") + String(user.title || "") + String(user.dataScope || ""));
  }

  function filterOwnChiefs(teams, user) {
    teams = teams || [];
    if (seesAllChiefs(user)) {
      return teams;
    }
    var name = String((user && (user.displayName || user.username)) || "").trim();
    return name
      ? teams.filter(function (team) {
          return team && team.name === name;
        })
      : teams;
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

  var LIVE_CARD_KEYS = ["ad", "roi", "livePay", "livePaid"];

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
      Math.round(Math.abs(Number(chart && chart.delta) || 0)) +
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
      ".xm-hm-bar{position:relative;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;padding:8px 2px;margin-bottom:10px;background:transparent;border:0}" +
      ".xm-hm-views{display:flex;align-items:center;gap:6px}" +
      ".xm-hm-views button,.xm-hm-set{border:0;background:transparent;color:var(--xm-muted);padding:6px 10px;border-radius:6px;cursor:pointer;font-size:13px;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}" +
      ".xm-hm-views button.is-on{color:var(--xm-primary);background:var(--xm-primary-soft);font-weight:600}" +
      ".xm-hm-set{color:var(--xm-primary)}" +
      ".xm-hm-ranges{display:flex;flex-wrap:wrap;align-items:center;gap:6px}" +
      ".xm-hm-ranges button{border:1px solid var(--xm-line);background:var(--xm-card);color:var(--xm-ink);padding:5px 10px;border-radius:4px;cursor:pointer;font-size:12px;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}" +
      ".xm-hm-views button::selection,.xm-hm-ranges button::selection,.xm-hm-set::selection{background:transparent;color:inherit}" +
      ".xm-hm-ranges button.is-on{background:var(--xm-primary);border-color:var(--xm-primary);color:#fff}" +
      ".xm-hm-datewrap{position:relative}" +
      ".xm-hm-dates{display:inline-flex;align-items:center;gap:8px;min-width:248px;height:32px;padding:0 10px 0 12px;border:1px solid #dcdfe6;background:#fff;color:#303133;border-radius:20px;cursor:pointer;font-size:13px;line-height:1}" +
      ".xm-hm-dates.is-on{border-color:#c0c4cc;box-shadow:0 0 0 1px rgba(192,196,204,.35)}" +
      ".xm-hm-dates-ico,.xm-hm-dates-clear{display:inline-flex;color:#c0c4cc;flex:0 0 auto}" +
      ".xm-hm-dates-text{flex:1 1 auto;text-align:left;white-space:nowrap}" +
      ".xm-hm-dates-clear{border:0;background:transparent;padding:0;width:16px;height:16px;border-radius:50%;cursor:pointer;align-items:center;justify-content:center}" +
      ".xm-hm-dates-clear:hover{color:#909399}" +
      ".xm-hm-cal{position:absolute;top:calc(100% + 10px);right:0;z-index:8;width:646px;max-width:min(646px,calc(100vw - 24px));background:#fff;border-radius:4px;box-shadow:0 2px 12px rgba(0,0,0,.12);padding:8px 8px 12px}" +
      ".xm-hm-cal[hidden]{display:none}" +
      ".xm-hm-cal-arrow{position:absolute;top:-6px;right:48px;width:10px;height:10px;background:#fff;transform:rotate(45deg);box-shadow:-1px -1px 1px rgba(0,0,0,.04)}" +
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
      "html[data-theme=dark] .xm-hm-dates,html[data-theme=dark] .xm-hm-cal,html[data-theme=dark] .xm-hm-cal-arrow{background:var(--xm-card);color:var(--xm-ink);border-color:var(--xm-line)}" +
      ".xm-hm-card-head .xm-hm-help{cursor:help;position:relative;z-index:2;width:18px;height:18px;border:1px solid var(--xm-line);border-radius:50%;background:transparent;padding:0;margin:0;font:inherit;font-size:11px;line-height:1;color:var(--xm-muted);display:inline-flex;align-items:center;justify-content:center}" +
      ".xm-hm-tip{position:fixed;z-index:2147483646;display:none;box-sizing:border-box;width:max-content;max-width:min(360px,calc(100vw - 24px));padding:10px 12px;background:var(--xm-card,#fff);border:1px solid var(--xm-line,#eadfd0);border-radius:8px;box-shadow:0 8px 28px rgba(0,0,0,.18);color:var(--xm-ink,#1f1b16);font-size:12px;line-height:1.6;white-space:pre-wrap;text-align:left;pointer-events:none}" +
      ".xm-hm-tip.is-on{display:block}" +
      ".xm-hm-body{position:relative;display:flex;flex-direction:column;gap:12px;overflow:visible}" +
      ".xm-hm.is-live .xm-hm-kpis-shell,.xm-hm.is-board .xm-hm-kpis-shell,.xm-hm.is-team .xm-hm-kpis-shell,.xm-hm.is-live .xm-hm-set,.xm-hm.is-board .xm-hm-set,.xm-hm.is-live .xm-hm-ranges{display:none}" +
      ".xm-hm-live[hidden],.xm-hm-board[hidden],.xm-hm-teams[hidden]{display:none}" +
      ".xm-hm-kpis-shell,.xm-hm-teams,.xm-hm-team{background:linear-gradient(#dceaff,#f7fbff);border:0;outline:0;box-shadow:none;border-radius:12px}" +
      ".xm-hm-kpis-shell,.xm-hm-teams{padding:10px}" +
      ".xm-hm-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;align-content:start;width:100%}" +
      ".xm-hm-teams{display:flex;flex-direction:column;gap:10px;overflow-x:auto}" +
      ".xm-hm-teams-bar{display:flex;justify-content:space-between;align-items:center;padding:0 0 8px}" +
      ".xm-hm-teams-grid{display:grid;grid-template-columns:repeat(var(--xm-hm-team-cols,2),minmax(200px,1fr));gap:10px}" +
      ".xm-hm-team{display:flex;flex-direction:column;gap:8px;min-width:0;padding:8px 8px 8px}" +
      ".xm-hm-team-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;align-content:start;width:100%}" +
      ".xm-hm.is-chief .xm-hm-team-kpis{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}" +
      ".xm-hm-teams .xm-hm-panel{overflow-x:auto;min-width:0;background:#fff;border:0;box-shadow:none}" +
      ".xm-hm-teams .xm-hm-table{min-width:760px;font-variant-numeric:tabular-nums;border-collapse:separate;border-spacing:0;table-layout:fixed}" +
      ".xm-hm-teams .xm-hm-table .xm-hm-num{text-align:right;white-space:nowrap}" +
      ".xm-hm-teams .xm-hm-table th,.xm-hm-teams .xm-hm-table td{border:0;border-right:1px dashed #c8ced8;overflow:hidden;text-overflow:ellipsis}" +
      ".xm-hm.is-chief .xm-hm-teams .xm-hm-panel{overflow:hidden}" +
      ".xm-hm.is-chief .xm-hm-teams .xm-hm-table{min-width:0}" +
      ".xm-hm-teams .xm-hm-table th.xm-hm-num{white-space:normal;max-width:6.4em;line-height:1.25}" +
      ".xm-hm-teams .xm-hm-table th:last-child,.xm-hm-teams .xm-hm-table td:last-child{text-align:left;white-space:nowrap;border-right:0}" +
      ".xm-hm-sort-h{display:inline-flex;align-items:center;justify-content:flex-end;gap:3px;width:100%}" +
      ".xm-hm-sort-btns{display:inline-flex;flex-direction:column;line-height:1}" +
      ".xm-hm-sort-btns button{border:0;background:0;padding:0;font-size:9px;line-height:1;color:#c0c4cc;cursor:pointer}" +
      ".xm-hm-sort-btns button.is-on{color:#2f54eb}" +
      ".xm-hm.is-team .xm-hm-card{min-height:104px;padding:12px 12px 10px;border-radius:8px;cursor:grab}" +
      ".xm-hm.is-team .xm-hm-card.is-hold{cursor:grabbing}" +
      ".xm-hm.is-team .xm-hm-card-head{font-size:12px}" +
      ".xm-hm.is-team .xm-hm-card-head .xm-hm-help{width:16px;height:16px;font-size:10px}" +
      ".xm-hm.is-team .xm-hm-value{margin-top:8px;font-size:20px}" +
      ".xm-hm.is-team .xm-hm-trend{margin-top:6px;font-size:12px}" +
      ".xm-hm.is-chief .xm-hm-card{aspect-ratio:1/1;min-height:0;min-width:0;padding:6px;display:flex;flex-direction:column}" +
      ".xm-hm.is-chief .xm-hm-card-head{font-size:10px;line-height:1.2;align-items:flex-start;gap:4px}" +
      ".xm-hm.is-chief .xm-hm-card-head span{min-width:0;overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3}" +
      ".xm-hm.is-chief .xm-hm-card-head .xm-hm-help{width:12px;height:12px;font-size:8px;flex:0 0 auto}" +
      ".xm-hm.is-chief .xm-hm-value{margin-top:auto;font-size:13px}" +
      ".xm-hm.is-chief .xm-hm-trend{margin-top:2px;font-size:10px}" +
      ".xm-hm-team-head{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;min-height:0;padding:0 2px 2px}" +
      ".xm-hm-team-head h2{margin:0;font-size:16px}" +
      ".xm-hm-team-head p{margin:2px 0 0;color:var(--xm-muted);font-size:12px}" +
      ".xm-hm.is-chief .xm-hm-team-head h2{font-size:13px}" +
      ".xm-hm.is-chief .xm-hm-team-head p{font-size:10px}" +
      ".xm-hm-team-head .xm-hm-set{padding:0;font-size:13px;white-space:nowrap}" +
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
      ".xm-hm-live-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;width:100%}" +
      ".xm-hm-live-cards .xm-hm-card{text-align:center}" +
      ".xm-hm-live-cards .xm-hm-card-head{justify-content:center}" +
      ".xm-hm-live .xm-hm-table{min-width:960px}" +
      ".xm-hm-live .xm-hm-panel{overflow-x:auto}" +
      ".xm-hm-live .xm-hm-table th:nth-child(n+3),.xm-hm-live .xm-hm-table td:nth-child(n+3){text-align:right}" +
      ".xm-hm-card,.xm-hm-pop label{-webkit-user-select:none;user-select:none}" +
      ".xm-hm-card::selection,.xm-hm-card *::selection{background:transparent}" +
      ".xm-hm-card{position:relative;background:var(--xm-card);border:1px solid var(--xm-line);border-radius:8px;padding:12px 14px 10px;box-shadow:var(--xm-shadow);min-height:104px;overflow:visible}" +
      ".xm-hm-card.is-hold,.xm-hm-pop label.is-hold{opacity:.72;cursor:grabbing;pointer-events:none}" +
      ".xm-hm-card.is-over,.xm-hm-pop label.is-over{outline:1px dashed var(--xm-primary)}" +
      ".xm-hm-pop label{cursor:grab}" +
      ".xm-hm-card-head{display:flex;align-items:center;justify-content:space-between;color:var(--xm-muted);font-size:12px}" +
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
      ".xm-hm-table{width:100%;border-collapse:collapse;font-size:12px}" +
      ".xm-hm-table th{text-align:left;color:var(--xm-muted);font-weight:500;padding:6px 4px;border-bottom:1px solid var(--xm-line)}" +
      ".xm-hm-table td{padding:7px 4px;border-bottom:1px solid var(--xm-line);color:var(--xm-ink)}" +
      ".xm-hm-table td:last-child,.xm-hm-table th:last-child{text-align:right}" +
      ".xm-hm-teams .xm-hm-table th,.xm-hm-teams .xm-hm-table td{border-bottom:0;border-top:0}" +
      ".xm-hm-cup{display:inline-flex;width:18px;height:18px;border-radius:50%;align-items:center;justify-content:center;color:#fff;font-size:11px}" +
      ".xm-hm-cup.gold{background:#f5a623}" +
      ".xm-hm-cup.silver{background:#8c8c8c}" +
      ".xm-hm-cup.bronze{background:#d46b08}" +
      ".xm-hm-pop{position:absolute;top:48px;left:10px;z-index:3;width:280px;background:var(--xm-card);border:1px solid var(--xm-line);border-radius:8px;box-shadow:var(--xm-shadow);padding:10px}" +
      ".xm-hm-pop[hidden]{display:none}" +
      ".xm-hm-pop h3{margin:0 0 8px;font-size:13px}" +
      ".xm-hm-pop label{display:flex;gap:8px;align-items:center;padding:4px 0;font-size:12px;color:var(--xm-ink)}" +
      ".xm-hm-note{margin:8px 0 0;color:var(--xm-muted);font-size:12px}" +
      "@media (max-width:1100px){.xm-hm-teams-grid{grid-template-columns:1fr}.xm-hm-team{min-width:0}.xm-hm-team-kpis{grid-template-columns:repeat(4,minmax(0,1fr))}.xm-hm.is-chief .xm-hm-team-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}}" +
      "@media (max-width:1200px){.xm-hm-kpis,.xm-hm-live-cards,.xm-hm-podiums,.xm-hm-live-charts{grid-template-columns:repeat(2,minmax(0,1fr))}}" +
      "@media (max-width:700px){.xm-hm-kpis,.xm-hm-live-cards,.xm-hm-podiums,.xm-hm-live-charts,.xm-hm-team-kpis{grid-template-columns:1fr}.xm-hm-team-head{flex-direction:column}.xm-hm-cal-months{flex-direction:column}}"
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
      '<div class="xm-hm-datewrap"><div class="xm-hm-dates" id="xm-hm-dates" role="button" tabindex="0" aria-haspopup="dialog" aria-expanded="false" aria-description="最多选择30天"><span class="xm-hm-dates-ico" aria-hidden="true">日</span><span class="xm-hm-dates-text" id="xm-hm-date-text"></span><button type="button" class="xm-hm-dates-clear" id="xm-hm-date-clear" aria-label="清除日期">×</button></div><div class="xm-hm-cal" id="xm-hm-cal" hidden></div></div>' +
      "</div></div>" +
      '<div class="xm-hm-pop" id="xm-hm-pop" hidden><h3>卡片设置</h3><div id="xm-hm-card-opts"></div></div>' +
      '<div class="xm-hm-body">' +
      '<section class="xm-hm-kpis-shell"><div class="xm-hm-teams-bar"><b>星脉甄选</b><button type="button" class="xm-hm-set" id="xm-hm-set">卡片设置</button></div><div class="xm-hm-kpis" id="xm-hm-kpis"></div></section>' +
      '<section class="xm-hm-teams" id="xm-hm-teams" hidden></section>' +
      '<section class="xm-hm-live" id="xm-hm-live" hidden></section>' +
      '<section class="xm-hm-board" id="xm-hm-board" hidden>' +
      '<div id="xm-hm-ladders"></div></section>' +
      '</div><p class="xm-hm-note" id="xm-hm-note">数字来自星脉 ERP。</p></div>'
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
    var teamView = state.view === "team" || state.view === "chief";
    var teams =
      state.view === "chief"
        ? filterOwnChiefs(state.chiefs && state.chiefs.length ? state.chiefs : blankRoleTeams("主管"), state.user)
        : state.teams && state.teams.length
          ? state.teams
          : blankTeams();
    var hero = readChart(live.hero, blankLive().hero);
    var paid = readChart(live.paid, blankLive().paid);
    var liveCards = pickLiveCards(live.cards);
    hideCardTip(true);
    board.setAttribute("data-hm-js", "0.1.393-home-tabsel");
    board.classList.toggle("is-board", state.view === "board");
    board.classList.toggle("is-live", state.view === "live");
    board.classList.toggle("is-team", teamView);
    board.classList.toggle("is-chief", state.view === "chief");
    Array.prototype.forEach.call(root.querySelectorAll("[data-view]"), function (btn) {
      btn.classList.toggle("is-on", btn.getAttribute("data-view") === state.view);
    });
    Array.prototype.forEach.call(root.querySelectorAll("[data-range]"), function (btn) {
      btn.classList.toggle("is-on", btn.getAttribute("data-range") === state.range);
    });
    root.querySelector("#xm-hm-date-text").textContent = formatDashDate(state.from) + " 至 " + formatDashDate(state.to);
    root.querySelector("#xm-hm-kpis").innerHTML = cards.map(cardHtml).join("");
    root.querySelector("#xm-hm-teams").hidden = !teamView;
    root.querySelector("#xm-hm-teams").style.setProperty("--xm-hm-team-cols", String(Math.max(teams.length, 1)));
    root.querySelector("#xm-hm-teams").innerHTML = teamsCompareHtml(teams, teamHidden(hide), state.view === "chief");
    restoreShopColW(root);
    root.querySelector("#xm-hm-live").hidden = state.view !== "live";
    root.querySelector("#xm-hm-board").hidden = state.view !== "board";
    root.querySelector("#xm-hm-live").innerHTML =
      '<div class="xm-hm-live-clock">每5分钟刷新' +
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
    var gapText = ((state.view === "chief" ? state.chiefGaps : state.teamGaps) || state.gaps || []).filter(function (item) {
      return item.indexOf("人管有店") !== -1 || item.indexOf("韩梦凯 ·") !== -1;
    }).join("；");
    root.querySelector("#xm-hm-note").textContent =
      state.view === "live"
        ? "实时来自 ERP，每5分钟拉一次。"
        : state.view === "team" || state.view === "chief"
          ? (gapText
            ? "人管对不上：" + gapText
            : state.view === "chief"
              ? "主管/储备按责权，本人只看自己数据。"
              : "经理团队按责权店对齐 ERP。")
          : state.view === "board"
            ? "排行榜按责权店对齐 ERP。"
            : "数字来自星脉 ERP。净销售额=支付-退款。";
    root.querySelector("#xm-hm-card-opts").innerHTML = (state.cards || blankCompanyCards())
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

  function teamSummaryFrom(rows) {
    return sumPack(rows);
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
    return orderedDefs().map(function (def) {
      return { key: def.key, label: def.label, value: "—", accent: !!def.accent, trend: 0, tip: def.tip || "" };
    });
  }

  function companyCardsFrom(sum, prev) {
    sum = sum || {};
    prev = prev || {};
    return orderedDefs().map(function (def) {
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
      hero: { label: "实时销售指数", value: "—", delta: 0, yesterday: [], today: [] },
      paid: { label: "实时费比", value: "—", delta: 0, yesterday: [], today: [] },
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
      return [{ key: "chief", name: "主管", href: "/data/overview", cards: blankCompanyCards(), shops: [] }];
    }
    return [
      { key: "shen", name: "沈子晗", href: "/data/overview", cards: blankCompanyCards(), shops: [] },
      { key: "han", name: "韩梦凯", href: "/data/overview", cards: blankCompanyCards(), shops: [] }
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

  function packHasStats(pack) {
    return ((pack && pack.records) || []).some(function (row) {
      return row && (row.payAmount != null || row.totalPromotionCost != null || row.profit != null);
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
    var todayFee = todaySum.promotionRate != null ? todaySum.promotionRate : snap.promotionRate;
    var yestFee = yestSum.promotionRate;
    live.paid = {
      label: "实时费比",
      value: fmtRate(todayFee),
      delta: trendOf(todayFee, yestFee),
      yesterday: yestFee == null ? [] : [yestFee, yestFee],
      today: todayFee == null ? [] : [todayFee, todayFee]
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
      if (person && person.status === "在职" && (person.role === role || (role === "主管" && person.role === "储备"))) {
        add(person.name);
      }
    });
    (dutyShops || []).forEach(function (shop) {
      if (role === "经理") {
        add(shop && shop.manager);
      }
      if (role === "主管") {
        add(shop && shop.supervisor);
        add(shop && shop.assistant);
      }
    });
    if (!names.length && role === "经理") {
      add("沈子晗");
      add("韩梦凯");
    }
    return names;
  }

  function shopOnRoleTeam(shop, name, role, person) {
    if (!shop || !name) {
      return false;
    }
    if (role !== "主管") {
      return teamPredicate(name)(shop);
    }
    if ([shop.supervisor, shop.assistant, shop.lead, shop.groupId].some(function (v) {
      return String(v || "").trim() === name;
    })) {
      return true;
    }
    return !!(person && (person.visibleShops || []).indexOf(shopDisplayName(shop)) !== -1);
  }

  function buildTeams(dutyShops, grants, rangePack, prevPack, catalogPack, people, role) {
    var erp = mapByShopId(rangePack && rangePack.records);
    var prevErp = mapByShopId(prevPack && prevPack.records);
    var catalog = mapByShopId((catalogPack && catalogPack.records) || (rangePack && rangePack.records));
    var catalogByName = mapByShopName((catalogPack && catalogPack.records) || (rangePack && rangePack.records) || []);
    var shops = dutyShops || [];
    var mismatches = [];
    var peopleByName = {};
    (people || []).forEach(function (person) {
      if (person && person.name) {
        peopleByName[person.name] = person;
      }
    });
    function oneTeam(key, name, href) {
      var pred = function (shop) {
        return shopOnRoleTeam(shop, name, role || "经理", peopleByName[name]);
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
        var owner = (shop.owner && String(shop.owner).trim()) || ownerOfShop(shop, grants);
        if (!id) {
          mismatches.push(name + " · " + label + "（人管有店，未填店铺id，店名也对不上 ERP）");
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
        mismatches.push("韩梦凯 · 整包（人管没有韩梦凯的店铺或店群）");
      }
      return {
        key: key,
        name: name,
        href: href,
        cards: companyCardsFrom(teamSummaryFrom(matched), teamSummaryFrom(prevMatched)),
        shops: rows
      };
    }
    return {
      teams: teamLeadNames(people, shops, role || "经理").map(function (name, index) {
        return oneTeam("t" + index, name, "/data/overview");
      }),
      mismatches: mismatches
    };
  }

  function buildLadders(people, dutyShops, rangePack, catalogPack) {
    var erp = mapByShopId(rangePack && rangePack.records);
    var catalogByName = mapByShopName((catalogPack && catalogPack.records) || []);
    function amount(person, field) {
      var total = 0;
      var ok = false;
      (dutyShops || []).forEach(function (shop) {
        if (!personOwnsShop(person, shop)) {
          return;
        }
        var id = resolveErpId(shop, catalogByName);
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
        live: blankLive(),
        shops: [],
        teams: blankTeams(),
        chiefs: blankRoleTeams("主管"),
        teamGaps: [],
        chiefGaps: [],
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
          fetchRangePack(today, today),
          fetchRangePack(yest, yest),
          fetchCatalogPack()
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
          fetchRangePack(state.from, state.to),
          fetchRangePack(prev.from, prev.to),
          fetchCatalogPack(),
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
          var built = buildTeams(dutyShops, grants, rangePack, prevPack, catalogPack, people, "经理");
          var chiefs = buildTeams(dutyShops, grants, rangePack, prevPack, catalogPack, people, "主管");
          state.teams = built.teams;
          state.chiefs = chiefs.teams;
          state.ladders = buildLadders(people, dutyShops, rangePack, catalogPack);
          state.teamGaps = built.mismatches;
          state.chiefGaps = chiefs.mismatches;
          state.gaps = built.mismatches;
          state.source = (rangePack.summary && rangePack.summary.payAmount != null) || (rangePack.records && rangePack.records.length) ? "xingmai-erp" : "";
          paint(root, state);
        }).catch(function () {
          if (!dead) {
            paint(root, state);
          }
        });
      }

      function onClick(event) {
        var help = event.target.closest && event.target.closest(".xm-hm-help");
        if (help) {
          return;
        }
        if (cardTipPinned) {
          hideCardTip(true);
        }
        var view = event.target.closest("[data-view]");
        if (view) {
          state.view = view.getAttribute("data-view");
          state.mode = state.view === "team" || state.view === "chief" ? "company" : "shop";
          closeCal();
          clearTextSelection();
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
          closeCal();
          paint(root, state);
          pullBoard();
          return;
        }
        if (event.target.closest("#xm-hm-date-clear")) {
          var yest = rangeDates("yesterday");
          state.range = "yesterday";
          state.from = yest.from;
          state.to = yest.to;
          closeCal();
          paint(root, state);
          pullBoard();
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
        var day = event.target.closest("#xm-hm-cal [data-ymd]");
        if (day && !day.disabled) {
          var ymd = day.getAttribute("data-ymd") || "";
          if (!ymd) {
            return;
          }
          if (!calPick) {
            calPick = ymd;
            calHover = "";
            renderCal();
            return;
          }
          var from = calPick;
          var to = ymd;
          if (from > to) {
            from = ymd;
            to = calPick;
          }
          if (!withinDays(from, to, 30)) {
            calPick = ymd;
            calHover = "";
            renderCal();
            return;
          }
          state.from = from;
          state.to = to;
          state.range = "custom";
          closeCal();
          paint(root, state);
          pullBoard();
          return;
        }
        if (event.target.closest(".xm-hm-set")) {
          var pop = root.querySelector("#xm-hm-pop");
          pop.hidden = !pop.hidden;
          closeCal();
          return;
        }
        var sortBtn = event.target.closest("[data-shop-sort]");
        if (sortBtn) {
          shopSort = { key: sortBtn.getAttribute("data-shop-sort") || "", dir: sortBtn.getAttribute("data-dir") || "desc" };
          paint(root, state);
          return;
        }
      }

      function onOutsideCardSet(event) {
        var pop = root.querySelector("#xm-hm-pop");
        if (pop && !pop.hidden && !event.target.closest("#xm-hm-pop") && !event.target.closest(".xm-hm-set")) {
          pop.hidden = true;
        }
        if (calOpen && !event.target.closest("#xm-hm-cal") && !event.target.closest("#xm-hm-dates")) {
          closeCal();
        }
      }

      function onHelpOver(event) {
        var help = helpFromEvent(event);
        if (!help) {
          return;
        }
        showCardTip(help, false);
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
        hideCardTip(true);
      }

      function onTipScroll() {
        if (!cardTipAnchor || !cardTipEl || !cardTipEl.classList.contains("is-on")) {
          return;
        }
        if (!document.body.contains(cardTipAnchor)) {
          hideCardTip(true);
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
        renderCal();
      }

      function syncCardOrderToState() {
        var keys = cardOrder();
        function sortCards(list) {
          var map = {};
          (list || []).forEach(function (card) {
            map[card.key] = card;
          });
          return keys
            .map(function (key) {
              return map[key];
            })
            .filter(Boolean);
        }
        state.cards = sortCards(state.cards && state.cards.length ? state.cards : blankCompanyCards());
        (state.teams || []).forEach(function (team) {
          team.cards = sortCards(team.cards);
        });
        (state.chiefs || []).forEach(function (team) {
          team.cards = sortCards(team.cards);
        });
      }

      var calOpen = false;
      var calCursor = (state.from || shanghaiYmd(1)).slice(0, 7);
      var calPick = "";
      var calHover = "";

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
        var applied = !calPick && withinDays(state.from, state.to, 30);
        el.innerHTML = calPanelHtml(calCursor, {
          today: shanghaiYmd(0),
          pick: calPick,
          start: calPick || (applied ? state.from : ""),
          end: calPick ? "" : applied ? state.to : "",
          hover: calPick ? calHover : ""
        });
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
      var sortStartX = 0;
      var sortStartY = 0;
      var sortSwallow = false;
      var colDrag = null;

      function shopColHit(event) {
        var cell = event.target.closest && event.target.closest(".xm-hm-teams .xm-hm-table th,.xm-hm-teams .xm-hm-table td");
        if (!cell) {
          return null;
        }
        var rect = cell.getBoundingClientRect();
        var x = event.clientX || 0;
        var last = cell.cellIndex >= cell.parentNode.cells.length - 1;
        if (!last && rect.right - x <= 8) {
          return { table: cell.closest("table"), idx: cell.cellIndex, start: cell.offsetWidth, x: x };
        }
        if (cell.cellIndex > 0 && x - rect.left <= 8) {
          var prev = cell.parentNode.cells[cell.cellIndex - 1];
          return { table: cell.closest("table"), idx: cell.cellIndex - 1, start: prev.offsetWidth, x: x };
        }
        return null;
      }

      function clearTextSelection() {
        var sel = window.getSelection && window.getSelection();
        if (sel && sel.removeAllRanges) sel.removeAllRanges();
      }


      function sortFinish() {
        sortFrom = "";
        sortDragging = false;
        sortSettings = false;
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

      function hitSortEl(event) {
        var el = document.elementFromPoint(event.clientX || 0, event.clientY || 0);
        if (!el || !el.closest || !root.contains(el)) {
          return null;
        }
        return sortSettings ? el.closest("#xm-hm-card-opts label") : el.closest(".xm-hm-card");
      }

      function onSortDown(event) {
        if (event.button && event.button !== 0) {
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
          colDrag = hit;
          clearTextSelection();
          return;
        }
        if (event.target.closest("i") || event.target.closest("input") || event.target.closest("button") || event.target.closest("a")) {
          return;
        }
        var card = event.target.closest(".xm-hm-card");
        var row = event.target.closest("#xm-hm-card-opts label");
        sortStartX = event.clientX || 0;
        sortStartY = event.clientY || 0;
        if (card && (card.closest("#xm-hm-kpis") || card.closest("#xm-hm-teams"))) {
          if (event.cancelable) event.preventDefault();
          sortFrom = card.getAttribute("data-card") || "";
          sortSettings = false;
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
        var tab = event.target.closest && event.target.closest(".xm-hm-views button,.xm-hm-ranges button,.xm-hm-set,.xm-hm-dates");
        if (sortFrom || sortDragging || tab) event.preventDefault();
      }

      function onSortMove(event) {
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
        if (!sortFrom && !sortDragging) {
          document.body.style.cursor = shopColHit(event) ? "col-resize" : "";
        }
        if (sortFrom || sortDragging) {
          clearTextSelection();
        }
        if (sortFrom && !sortDragging && (Math.abs(x - sortStartX) > 8 || Math.abs(y - sortStartY) > 8)) {
          sortDragging = true;
          var moving = root.querySelectorAll('.xm-hm-card[data-card="' + sortFrom + '"]');
          Array.prototype.forEach.call(moving, function (el) {
            el.classList.add("is-hold");
          });
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
        if (over && (over.getAttribute("data-sort") || over.getAttribute("data-card")) !== sortFrom) {
          sortMarkOver(over);
        } else {
          sortMarkOver(null);
        }
      }

      function onSortUp(event) {
        if (colDrag) {
          colDrag = null;
          document.body.style.cursor = "";
          sortFinish();
          return;
        }
        var moved = sortDragging && sortFrom;
        var toEl = hitSortEl(event);
        var toKey = toEl ? toEl.getAttribute(sortSettings ? "data-sort" : "data-card") : "";
        if (moved && toKey && toKey !== sortFrom) {
          saveCardOrder(applyCardMove(sortFrom, toKey, !sortSettings));
          syncCardOrderToState();
          var pop = root.querySelector("#xm-hm-pop");
          var popOpen = pop && !pop.hidden;
          paint(root, state);
          if (pop && popOpen) {
            pop.hidden = false;
          }
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
      }

      var scroller = document.getElementById("xm-content") || root;
      root.addEventListener("click", onClick);
      root.addEventListener("change", onChange);
      root.addEventListener("pointerover", onCalHover);
      root.addEventListener("mouseover", onHelpOver);
      root.addEventListener("mouseout", onHelpOut);
      scroller.addEventListener("scroll", onTipScroll, true);
      window.addEventListener("resize", onTipScroll);
      document.addEventListener("mousedown", onOutsideCardSet);
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
        root.removeEventListener("pointerover", onCalHover);
        root.removeEventListener("mouseover", onHelpOver);
        root.removeEventListener("mouseout", onHelpOut);
        scroller.removeEventListener("scroll", onTipScroll, true);
        window.removeEventListener("resize", onTipScroll);
        hideCardTip(true);
        if (cardTipEl && cardTipEl.parentNode) {
          cardTipEl.parentNode.removeChild(cardTipEl);
        }
        cardTipEl = null;
        document.removeEventListener("mousedown", onOutsideCardSet);
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
