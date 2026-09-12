/* xm-module-home 0.1.360-home-tipbody */
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
    var t = event.target;
    if (!t || !t.closest) {
      return null;
    }
    var help = t.closest(".xm-hm-help");
    if (help) {
      return help;
    }
    var head = t.closest(".xm-hm-card-head");
    return head ? head.querySelector(".xm-hm-help") : null;
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
        ? '<button type="button" data-cal-nav="-12" aria-label="上一年">《</button><button type="button" data-cal-nav="-1" aria-label="上个月">&lt;</button>'
        : "";
    var navRight =
      side === "right"
        ? '<button type="button" data-cal-nav="1" aria-label="下个月">&gt;</button><button type="button" data-cal-nav="12" aria-label="下一年">》</button>'
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
      '</span><button type="button" class="xm-hm-help" data-tip="' +
      tipAttr(card.tip) +
      '" aria-label="指标说明">i</button></div><div class="xm-hm-value' +
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
      ".xm-hm-datewrap{position:relative}" +
      ".xm-hm-dates{display:inline-flex;align-items:center;gap:8px;min-width:248px;height:32px;padding:0 10px 0 12px;border:1px solid #dcdfe6;background:#fff;color:#303133;border-radius:20px;cursor:pointer;font-size:13px;line-height:1}" +
      ".xm-hm-dates.is-on{border-color:#c0c4cc;box-shadow:0 0 0 1px rgba(192,196,204,.35)}" +
      ".xm-hm-dates-ico,.xm-hm-dates-clear{display:inline-flex;color:#c0c4cc;flex:0 0 auto}" +
      ".xm-hm-dates-ico svg,.xm-hm-dates-clear svg{display:block}" +
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
      "html[data-theme=dark] .xm-hm-dates,html[data-theme=dark] .xm-hm-cal{background:var(--xm-card);color:var(--xm-ink);border-color:var(--xm-line)}" +
      "html[data-theme=dark] .xm-hm-cal-arrow{background:var(--xm-card)}" +
      "html[data-theme=dark] .xm-hm-cal-month + .xm-hm-cal-month{border-color:var(--xm-line)}" +
      "html[data-theme=dark] .xm-hm-cal-caption,html[data-theme=dark] .xm-hm-cal-caption button{color:var(--xm-ink)}" +
      ".xm-hm-card{overflow:visible}" +
      ".xm-hm-card-head .xm-hm-help{cursor:help;position:relative;z-index:2;width:18px;height:18px;border:1px solid var(--xm-line);border-radius:50%;background:transparent;padding:0;margin:0;font:inherit;font-size:11px;line-height:1;color:var(--xm-muted);display:inline-flex;align-items:center;justify-content:center}" +
      ".xm-hm-card-head .xm-hm-help::before{content:\"\";position:absolute;inset:-14px}" +
      ".xm-hm-tip{position:fixed;z-index:2147483646;display:none;box-sizing:border-box;width:max-content;max-width:min(360px,calc(100vw - 24px));padding:10px 12px;background:var(--xm-card,#fff);border:1px solid var(--xm-line,#eadfd0);border-radius:8px;box-shadow:0 8px 28px rgba(0,0,0,.18);color:var(--xm-ink,#1f1b16);font-size:12px;line-height:1.6;white-space:pre-wrap;text-align:left;pointer-events:none}" +
      ".xm-hm-tip.is-on{display:block}" +
      ".xm-hm-body{position:relative;display:flex;flex-direction:column;gap:12px;overflow:visible}" +
      ".xm-hm.is-live .xm-hm-kpis,.xm-hm.is-board .xm-hm-kpis,.xm-hm.is-team .xm-hm-kpis,.xm-hm.is-live .xm-hm-set,.xm-hm.is-board .xm-hm-set,.xm-hm.is-live .xm-hm-ranges{display:none}" +
      ".xm-hm-live[hidden],.xm-hm-board[hidden],.xm-hm-teams[hidden]{display:none}" +
      ".xm-hm-kpis,.xm-hm-team-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;align-content:start;width:100%}" +
      ".xm-hm-teams{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;align-items:start}" +
      ".xm-hm-team{display:flex;flex-direction:column;gap:10px;min-width:0;padding-bottom:8px}" +
      ".xm-hm-team + .xm-hm-team{border-left:1px solid var(--xm-line);padding-left:12px}" +
      ".xm-hm-team .xm-hm-panel{overflow-x:auto}" +
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
      ".xm-hm-card{position:relative;background:var(--xm-card);border:1px solid var(--xm-line);border-radius:8px;padding:12px 14px 10px;box-shadow:var(--xm-shadow);min-height:104px;overflow:visible}" +
      ".xm-hm-card.is-hold,.xm-hm-pop label.is-hold{opacity:.72;cursor:grabbing;user-select:none;pointer-events:none}" +
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
      "@media (max-width:900px){.xm-hm-teams{grid-template-columns:1fr}.xm-hm-team + .xm-hm-team{border-left:0;padding-left:0}}" +
      "@media (max-width:700px){.xm-hm-kpis,.xm-hm-team-kpis,.xm-hm-live-cards,.xm-hm-podiums,.xm-hm-live-charts{grid-template-columns:1fr}.xm-hm-team-head{flex-direction:column}.xm-hm-cal-months{flex-direction:column}}"
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
      '<div class="xm-hm-datewrap"><div class="xm-hm-dates" id="xm-hm-dates" role="button" tabindex="0" aria-haspopup="dialog" aria-expanded="false" aria-description="最多选择30天"><span class="xm-hm-dates-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3.5v4M16 3.5v4"/></svg></span><span class="xm-hm-dates-text" id="xm-hm-date-text"></span><button type="button" class="xm-hm-dates-clear" id="xm-hm-date-clear" aria-label="清除日期"><svg viewBox="0 0 16 16" width="12" height="12"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor"/><path d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8" stroke="currentColor" stroke-width="1.2" fill="none"/></svg></button></div><div class="xm-hm-cal" id="xm-hm-cal" hidden></div></div>' +
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
    var keepCard = "";
    var wasPinned = cardTipPinned;
    if (cardTipAnchor && cardTipAnchor.closest) {
      var hold = cardTipAnchor.closest("[data-card]");
      keepCard = hold ? hold.getAttribute("data-card") || "" : "";
    }
    hideCardTip(true);
    board.setAttribute("data-hm-js", "0.1.360-home-tipbody");
    board.classList.toggle("is-board", state.view === "board");
    board.classList.toggle("is-live", state.view === "live");
    board.classList.toggle("is-team", state.view === "team");
    Array.prototype.forEach.call(root.querySelectorAll("[data-view]"), function (btn) {
      btn.classList.toggle("is-on", btn.getAttribute("data-view") === state.view);
    });
    Array.prototype.forEach.call(root.querySelectorAll("[data-range]"), function (btn) {
      btn.classList.toggle("is-on", btn.getAttribute("data-range") === state.range);
    });
    root.querySelector("#xm-hm-date-text").textContent = formatDashDate(state.from) + " 至 " + formatDashDate(state.to);
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
            : "数字来自星脉 ERP 店铺汇总。净销售额按支付金额减退款。";
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
    if (keepCard) {
      var nextHelp = root.querySelector('.xm-hm-card[data-card="' + keepCard + '"] .xm-hm-help');
      if (nextHelp) {
        showCardTip(nextHelp, wasPinned);
      }
    }
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
    { key: "netGoodsCost", label: "净货款成本 (支付)", field: "netGoodsCost", kind: "money", tip: "剔除无效单和退款订单后的货品成本（按支付时间统计）" }
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
      platformFee: sum.platformFee,
      saleFee: sum.saleFee,
      goodsCost: sum.goodsCost,
      invalidAmount: sum.invalidAmount,
      jdOrders: sum.jdOrders,
      jdRatio: sum.jdRatio,
      netSkuNum: sum.netSkuNum,
      netGoodsCost: sum.netGoodsCost,
      netSales: sum.netSales != null ? sum.netSales : null
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
      yesterdayPayAmount: sumField(pack && pack.records, "yesterdayPayAmount"),
      platformFee: sumField(pack && pack.records, "platformFee"),
      saleFee: sumField(pack && pack.records, "saleFee"),
      goodsCost: sumField(pack && pack.records, "goodsCost"),
      invalidAmount: sumField(pack && pack.records, "invalidAmount"),
      jdOrders: sumField(pack && pack.records, "jdOrders"),
      netSkuNum: sumField(pack && pack.records, "netSkuNum"),
      netGoodsCost: sumField(pack && pack.records, "netGoodsCost")
    });
  }

  function teamSummaryFrom(rows) {
    return withRates({
      payAmount: sumField(rows, "payAmount"),
      totalPromotionCost: sumField(rows, "totalPromotionCost"),
      refundAmount: sumField(rows, "refundAmount"),
      profit: sumField(rows, "profit"),
      orderCount: sumField(rows, "orderCount"),
      netOrderCount: sumField(rows, "netOrderCount"),
      platformFee: sumField(rows, "platformFee"),
      saleFee: sumField(rows, "saleFee"),
      goodsCost: sumField(rows, "goodsCost"),
      invalidAmount: sumField(rows, "invalidAmount"),
      jdOrders: sumField(rows, "jdOrders"),
      netSkuNum: sumField(rows, "netSkuNum"),
      netGoodsCost: sumField(rows, "netGoodsCost")
    });
  }

  function mergeSummary(primary, extra) {
    var out = withRates(primary || {});
    var src = extra || {};
    [
      "payAmount",
      "totalPromotionCost",
      "refundAmount",
      "profit",
      "orderCount",
      "profitRate",
      "promotionRate",
      "refundRate",
      "platformFee",
      "saleFee",
      "goodsCost",
      "invalidAmount",
      "jdOrders",
      "jdRatio",
      "netSkuNum",
      "netGoodsCost",
      "netSales",
      "netOrderCount",
      "todayPayAmount",
      "yesterdayPayAmount"
    ].forEach(function (key) {
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
      var records = withShopIds((data && data.records) || []);
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
        cards: companyCardsFrom(teamSummaryFrom(matched), teamSummaryFrom(prevMatched)),
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
          var built = buildTeams(dutyShops, grants, rangePack, prevPack, catalogPack);
          state.teams = built.teams;
          state.ladders = buildLadders(people, dutyShops, rangePack);
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
          if (cardTipPinned && cardTipAnchor === help) {
            hideCardTip(true);
          } else {
            showCardTip(help, true);
          }
          return;
        }
        if (cardTipPinned) {
          hideCardTip(true);
        }
        var view = event.target.closest("[data-view]");
        if (view) {
          state.view = view.getAttribute("data-view");
          state.mode = state.view === "team" ? "company" : "shop";
          closeCal();
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
        if (event.target.closest("#xm-hm-set")) {
          var pop = root.querySelector("#xm-hm-pop");
          pop.hidden = !pop.hidden;
          closeCal();
          return;
        }
      }

      function onOutsideCardSet(event) {
        var pop = root.querySelector("#xm-hm-pop");
        if (pop && !pop.hidden && !event.target.closest("#xm-hm-pop") && !event.target.closest("#xm-hm-set")) {
          pop.hidden = true;
        }
        if (calOpen && !event.target.closest("#xm-hm-cal") && !event.target.closest("#xm-hm-dates")) {
          closeCal();
        }
      }

      function onHelpOver(event) {
        var help = helpFromEvent(event);
        if (!help || cardTipPinned) {
          return;
        }
        showCardTip(help, false);
      }

      function onHelpOut(event) {
        if (cardTipPinned) {
          return;
        }
        var help = helpFromEvent(event);
        if (!help) {
          return;
        }
        var head = help.closest(".xm-hm-card-head");
        var to = event.relatedTarget;
        if (to && head && head.contains(to)) {
          return;
        }
        hideCardTip(false);
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

      var sortHold = 0;
      var sortFrom = "";
      var sortDragging = false;
      var sortSettings = false;
      var sortStartX = 0;
      var sortStartY = 0;
      var sortSwallow = false;

      function sortClearHold() {
        window.clearTimeout(sortHold);
        sortHold = 0;
      }

      function sortFinish() {
        sortClearHold();
        sortFrom = "";
        sortDragging = false;
        sortSettings = false;
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
        if (event.target.closest("i") || event.target.closest("input") || event.target.closest("button") || event.target.closest("a")) {
          return;
        }
        var card = event.target.closest(".xm-hm-card");
        var row = event.target.closest("#xm-hm-card-opts label");
        sortClearHold();
        sortStartX = event.clientX || 0;
        sortStartY = event.clientY || 0;
        if (card && (card.closest("#xm-hm-kpis") || card.closest(".xm-hm-team-kpis"))) {
          sortFrom = card.getAttribute("data-card") || "";
          sortSettings = false;
          sortHold = window.setTimeout(function () {
            var hold = root.querySelector('.xm-hm-card[data-card="' + sortFrom + '"]');
            if (!sortFrom || !hold) {
              return;
            }
            sortDragging = true;
            hold.classList.add("is-hold");
          }, 420);
          return;
        }
        if (row) {
          sortFrom = row.getAttribute("data-sort") || "";
          sortSettings = true;
        }
      }

      function onSortMove(event) {
        var x = event.clientX || 0;
        var y = event.clientY || 0;
        if (sortHold && !sortDragging && (Math.abs(x - sortStartX) > 8 || Math.abs(y - sortStartY) > 8)) {
          sortClearHold();
          sortFrom = "";
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

      function onSortMenu(event) {
        if (sortHold || sortDragging) {
          event.preventDefault();
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
      document.addEventListener("contextmenu", onSortMenu);

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
        document.removeEventListener("contextmenu", onSortMenu);
        sortFinish();
        root.innerHTML = "";
      };
    }
  };
  window.XmModules["/"] = window.XmModules["/home"];
})();
