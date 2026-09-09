/* xm-module-home 0.1.157-board */
(function () {
  var VIEWS = [
    { key: "company", label: "公司" },
    { key: "team", label: "团队" },
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
    }
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
      ".xm-hm{position:relative;min-height:100%;padding:10px 12px 16px;color:var(--xm-ink)}" +
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
      ".xm-hm-body{position:relative;display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:12px}" +
      ".xm-hm.is-board .xm-hm-kpis{display:none}" +
      ".xm-hm.is-board .xm-hm-body{grid-template-columns:1fr 1fr}" +
      ".xm-hm-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;align-content:start}" +
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
      ".xm-hm-side{display:flex;flex-direction:column;gap:10px}" +
      ".xm-hm-panel{background:var(--xm-card);border:1px solid var(--xm-line);border-radius:8px;box-shadow:var(--xm-shadow);padding:12px 12px 8px;min-height:0}" +
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
      "@media (max-width:1200px){.xm-hm-body{grid-template-columns:1fr}.xm-hm-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}" +
      "@media (max-width:700px){.xm-hm-kpis{grid-template-columns:1fr}}"
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
      '<aside class="xm-hm-side">' +
      '<section class="xm-hm-panel"><h2>实时销售指数 <span id="xm-hm-index-time"></span></h2>' +
      '<div class="xm-hm-index-num" id="xm-hm-index-num"></div>' +
      '<div class="xm-hm-modes"><label><input type="radio" name="xm-hm-mode" value="shop" checked /> 按店铺</label>' +
      '<label><input type="radio" name="xm-hm-mode" value="company" /> 按公司</label></div>' +
      '<table class="xm-hm-table"><thead><tr><th>排名</th><th>店铺名称</th><th>运营</th><th>实时销售额</th><th>环比</th></tr></thead>' +
      '<tbody id="xm-hm-index-rows"></tbody></table></section>' +
      '<section class="xm-hm-panel"><h2>龙虎榜</h2>' +
      '<table class="xm-hm-table"><thead><tr><th>排名</th><th>店铺名称</th><th>运营</th><th>销售额</th></tr></thead>' +
      '<tbody id="xm-hm-tiger-rows"></tbody></table></section>' +
      '</aside></div><p class="xm-hm-note">演示看板，数字不是外部业务库。先按这个模版铺上，后面再对真实口径。</p></div>'
    );
  }

  function paint(root, state) {
    var board = root.querySelector("#xm-hm");
    var hide = hiddenCards();
    var cards = (state.cards || FALLBACK.cards).filter(function (card) {
      return hide.indexOf(card.key) === -1;
    });
    var index = state.index || FALLBACK.index;
    var tiger = state.tiger || FALLBACK.tiger;
    var rows = state.mode === "company" || state.view === "team" ? groupByOwner(index.rows || []) : index.rows || [];
    var tigerRows = state.view === "team" ? groupByOwner(tiger.rows || []) : tiger.rows || [];
    board.classList.toggle("is-board", state.view === "board");
    Array.prototype.forEach.call(root.querySelectorAll("[data-view]"), function (btn) {
      btn.classList.toggle("is-on", btn.getAttribute("data-view") === state.view);
    });
    Array.prototype.forEach.call(root.querySelectorAll("[data-range]"), function (btn) {
      btn.classList.toggle("is-on", btn.getAttribute("data-range") === state.range);
    });
    root.querySelector("#xm-hm-from").value = state.from;
    root.querySelector("#xm-hm-to").value = state.to;
    root.querySelector("#xm-hm-kpis").innerHTML = cards.map(cardHtml).join("");
    root.querySelector("#xm-hm-index-num").textContent = index.value || "—";
    root.querySelector("#xm-hm-index-time").textContent = index.time ? index.time + " 更新" : "";
    root.querySelector("#xm-hm-index-rows").innerHTML = rows.map(function (row, i) {
      return rowHtml(row, i, true);
    }).join("");
    root.querySelector("#xm-hm-tiger-rows").innerHTML = tigerRows.map(function (row, i) {
      return rowHtml(row, i, false);
    }).join("");
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
    var modeShop = root.querySelector('input[name="xm-hm-mode"][value="shop"]');
    var modeCo = root.querySelector('input[name="xm-hm-mode"][value="company"]');
    if (modeShop && modeCo) {
      modeShop.checked = state.mode !== "company";
      modeCo.checked = state.mode === "company";
    }
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
        index: FALLBACK.index,
        tiger: FALLBACK.tiger
      };
      paint(root, state);

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
        if (event.target.name === "xm-hm-mode") {
          state.mode = event.target.value;
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
        if (data.index && data.index.rows && data.index.rows.length) {
          state.index = data.index;
        }
        if (data.tiger && data.tiger.rows && data.tiger.rows.length) {
          state.tiger = data.tiger;
        }
        if (data.from && data.to && state.range === "yesterday") {
          state.from = data.from;
          state.to = data.to;
        }
        paint(root, state);
      });

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
        root.removeEventListener("click", onClick);
        root.removeEventListener("change", onChange);
        root.innerHTML = "";
      };
    }
  };
  window.XmModules["/"] = window.XmModules["/home"];
})();
