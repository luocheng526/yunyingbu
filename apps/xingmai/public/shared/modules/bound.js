/* xm-module-bound — 边界数据中心汇总台。爬虫，非 ERP。只请求 /api/bound。 */
(function () {
  var state = {
    from: "",
    to: "",
    q: "",
    tab: "batches",
    loading: false,
    error: "",
    warning: "",
    stamp: "",
    board: null
  };
  var active = 0;

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fallbackBoard() {
    return {
      ok: true,
      module: "bound",
      source: "crawler",
      erp: false,
      label: "爬虫，非 ERP",
      connected: false,
      note: "爬虫，非 ERP。这里只汇总爬虫数据，表目前是空的。不读取、不转发、不展示星脉 ERP、京麦、首页实时、星脉数据中心。爬虫接口以后单独接入。",
      ownedTables: ["bound_batches", "bound_rows"],
      filters: { from: state.from, to: state.to, q: state.q },
      kpis: [
        { key: "batches", label: "采集批次", value: null, hint: "待接入" },
        { key: "rows", label: "汇总条目", value: null, hint: "待接入" },
        { key: "latest", label: "最近采集", value: null, hint: "待接入" },
        { key: "source", label: "数据来源", value: "爬虫，非 ERP", hint: "非 ERP" }
      ],
      tables: [
        {
          key: "batches",
          title: "采集批次",
          columns: [
            { key: "id", label: "批次" },
            { key: "capturedAt", label: "采集时间" },
            { key: "site", label: "来源站点" },
            { key: "count", label: "条目" },
            { key: "status", label: "状态" },
            { key: "note", label: "说明" }
          ],
          rows: []
        },
        {
          key: "rows",
          title: "汇总明细",
          columns: [
            { key: "dimension", label: "维度" },
            { key: "metric", label: "指标" },
            { key: "value", label: "数值" },
            { key: "capturedAt", label: "采集时间" },
            { key: "note", label: "备注" }
          ],
          rows: []
        }
      ]
    };
  }

  function ensureStyle() {
    if (!document.getElementById || document.getElementById("bd-page-style")) {
      return;
    }
    var style = document.createElement("style");
    style.id = "bd-page-style";
    style.textContent =
      ".bd-page{color:var(--xm-ink);font-size:13px;}" +
      ".bd-bar{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;margin:0 0 8px;}" +
      ".bd-bar h1{margin:0;font-size:16px;font-weight:650;}" +
      ".bd-bar p{margin:4px 0 0;color:var(--xm-muted);font-size:12px;}" +
      ".bd-chip{display:inline-flex;align-items:center;height:26px;padding:0 10px;border-radius:999px;background:var(--xm-primary-soft);color:var(--xm-ink);font-size:12px;font-weight:650;white-space:nowrap;}" +
      ".bd-note{margin:0 0 10px;padding:10px 12px;border:1px solid var(--xm-line);border-left:3px solid var(--xm-primary);border-radius:10px;background:var(--xm-card);color:var(--xm-ink);line-height:1.55;}" +
      ".bd-note b{font-weight:650;}" +
      ".bd-meta{margin:6px 0 0;color:var(--xm-muted);font-size:12px;}" +
      ".bd-filters{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;margin:0 0 10px;}" +
      ".bd-filters label{display:flex;flex-direction:column;gap:4px;color:var(--xm-muted);font-size:12px;}" +
      ".bd-filters input{height:30px;min-width:140px;border:1px solid var(--xm-line);border-radius:6px;background:var(--xm-card);color:var(--xm-ink);padding:0 8px;font:inherit;font-size:12px;}" +
      ".bd-filters input:focus{outline:2px solid var(--xm-primary);outline-offset:1px;}" +
      ".bd-go{height:30px;border:0;border-radius:6px;background:var(--xm-primary);color:#fff;padding:0 12px;font:inherit;font-size:12px;cursor:pointer;}" +
      ".bd-go:disabled{opacity:.6;cursor:default;}" +
      ".bd-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:0 0 10px;}" +
      ".bd-kpi{background:var(--xm-card);border:1px solid var(--xm-line);border-radius:10px;box-shadow:var(--xm-shadow);padding:10px 12px;min-height:74px;}" +
      ".bd-kpi span{display:block;color:var(--xm-muted);font-size:12px;}" +
      ".bd-kpi b{display:block;margin-top:6px;font-size:20px;font-weight:650;font-variant-numeric:tabular-nums;}" +
      ".bd-kpi em{display:block;margin-top:4px;font-style:normal;color:var(--xm-muted);font-size:11px;}" +
      ".bd-tabs{display:flex;gap:6px;margin:0 0 8px;}" +
      ".bd-tab{height:28px;border:1px solid var(--xm-line);border-radius:6px;background:var(--xm-card);color:var(--xm-ink);padding:0 10px;font:inherit;font-size:12px;cursor:pointer;}" +
      ".bd-tab.is-on{background:var(--xm-primary);border-color:var(--xm-primary);color:#fff;}" +
      ".bd-card{background:var(--xm-card);border:1px solid var(--xm-line);border-radius:10px;box-shadow:var(--xm-shadow);padding:10px;}" +
      ".bd-card h2{margin:0 0 8px;font-size:13px;font-weight:650;}" +
      ".bd-table{width:100%;border-collapse:collapse;font-size:12px;}" +
      ".bd-table th{text-align:left;color:var(--xm-muted);font-weight:600;padding:6px;border-bottom:1px solid var(--xm-line);white-space:nowrap;}" +
      ".bd-table td{padding:6px;border-bottom:1px solid var(--xm-line);}" +
      ".bd-empty{text-align:center;color:var(--xm-muted);padding:28px 8px;}" +
      ".bd-msg{min-height:16px;margin:0 0 8px;color:var(--xm-muted);font-size:12px;}" +
      ".bd-msg.is-error{color:#cf1322;}" +
      "@media (max-width:900px){.bd-kpis{grid-template-columns:repeat(2,minmax(0,1fr));}}";
    if (document.head) {
      document.head.appendChild(style);
    }
  }

  function boardOf() {
    return state.board || fallbackBoard();
  }

  function currentTable() {
    var tables = boardOf().tables || [];
    var found = tables.filter(function (table) {
      return table.key === state.tab;
    })[0];
    return found || tables[0] || { key: "batches", title: "采集批次", columns: [], rows: [] };
  }

  function cellText(value) {
    if (value == null || value === "") {
      return "—";
    }
    return esc(value);
  }

  function kpis() {
    return (boardOf().kpis || [])
      .map(function (item) {
        var shown = item.value == null || item.value === "" ? "—" : esc(item.value);
        return (
          '<article class="bd-kpi"><span>' +
          esc(item.label) +
          "</span><b>" +
          shown +
          "</b><em>" +
          esc(item.hint || "") +
          "</em></article>"
        );
      })
      .join("");
  }

  function tabs(board) {
    return (board.tables || [])
      .map(function (table) {
        var on = table.key === state.tab ? " is-on" : "";
        return (
          '<button type="button" class="bd-tab' +
          on +
          '" data-tab="' +
          esc(table.key) +
          '">' +
          esc(table.title) +
          "</button>"
        );
      })
      .join("");
  }

  function tableBody(table) {
    var columns = table.columns || [];
    var rows = table.rows || [];
    if (!rows.length) {
      return (
        '<tr><td class="bd-empty" colspan="' +
        Math.max(columns.length, 1) +
        '">暂无爬虫数据。接口尚未接入，这里不是 ERP。</td></tr>'
      );
    }
    return rows
      .map(function (row) {
        return (
          "<tr>" +
          columns
            .map(function (column) {
              return "<td>" + cellText(row[column.key]) + "</td>";
            })
            .join("") +
          "</tr>"
        );
      })
      .join("");
  }

  function paint(root) {
    ensureStyle();
    var board = boardOf();
    var table = currentTable();
    var columns = table.columns || [];
    var head = columns
      .map(function (column) {
        return "<th>" + esc(column.label) + "</th>";
      })
      .join("");
    var msg = state.error || state.warning || (state.loading ? "正在读取爬虫汇总…" : "");
    var owned = (board.ownedTables || []).join("、");
    root.innerHTML =
      '<main class="page bd-page" data-bound-source="crawler" data-bound-erp="false">' +
      '<div class="bd-bar"><div><h1>边界数据中心</h1><p>爬虫数据汇总。只有这一页，筛选不离开 /bound。</p></div>' +
      '<span class="bd-chip">爬虫，非 ERP</span></div>' +
      '<section class="bd-note" role="status"><b>爬虫，非 ERP。</b> ' +
      esc(String(board.note || "").replace(/^爬虫，非 ERP。/, "")) +
      '<p class="bd-meta">自有表 ' +
      esc(owned || "bound_batches、bound_rows") +
      " · 接入状态 " +
      (board.connected ? "已接入" : "未接入") +
      (state.stamp ? " · " + esc(state.stamp) : "") +
      "</p></section>" +
      '<p class="bd-msg' +
      (state.error ? " is-error" : "") +
      '">' +
      esc(msg) +
      "</p>" +
      '<form class="bd-filters" data-bound-filters="1">' +
      '<label>开始日期 <input type="date" name="from" data-filter="from" value="' +
      esc(state.from) +
      '"></label>' +
      '<label>结束日期 <input type="date" name="to" data-filter="to" value="' +
      esc(state.to) +
      '"></label>' +
      '<label>关键词 <input type="search" name="q" data-filter="q" value="' +
      esc(state.q) +
      '" placeholder="来源、状态、指标" maxlength="80"></label>' +
      '<button type="submit" class="bd-go"' +
      (state.loading ? " disabled" : "") +
      ">查询</button></form>" +
      '<div class="bd-kpis">' +
      kpis() +
      "</div>" +
      '<div class="bd-tabs" role="tablist">' +
      tabs(board) +
      "</div>" +
      '<section class="bd-card"><h2>' +
      esc(table.title || "汇总") +
      '</h2><table class="bd-table"><thead><tr>' +
      head +
      "</tr></thead><tbody>" +
      tableBody(table) +
      "</tbody></table></section></main>";
  }

  function readFilters(root) {
    var from = root.querySelector("[data-filter=from]");
    var to = root.querySelector("[data-filter=to]");
    var q = root.querySelector("[data-filter=q]");
    state.from = from ? from.value : state.from;
    state.to = to ? to.value : state.to;
    state.q = q ? q.value : state.q;
  }

  function applyBoard(data) {
    state.board = data;
    state.warning = data && data.warning ? data.warning : "";
    if (data && data.filters) {
      state.from = data.filters.from || "";
      state.to = data.filters.to || "";
      state.q = data.filters.q || "";
    }
    var keys = ((data && data.tables) || []).map(function (table) {
      return table.key;
    });
    if (keys.length && keys.indexOf(state.tab) < 0) {
      state.tab = keys[0];
    }
  }

  function load(root, mine) {
    state.loading = true;
    state.error = "";
    paint(root);
    var query = new URLSearchParams();
    if (state.from) {
      query.set("from", state.from);
    }
    if (state.to) {
      query.set("to", state.to);
    }
    if (state.q) {
      query.set("q", state.q);
    }
    var suffix = query.toString();
    var boardUrl = "/api/bound/board" + (suffix ? "?" + suffix : "");
    return Promise.all([
      fetch("/api/bound", { credentials: "same-origin", headers: { Accept: "application/json" } }).then(function (res) {
        return res.json().then(function (data) {
          return { res: res, data: data };
        });
      }),
      fetch(boardUrl, { credentials: "same-origin", headers: { Accept: "application/json" } }).then(function (res) {
        return res.json().then(function (data) {
          return { res: res, data: data };
        });
      })
    ])
      .then(function (results) {
        if (mine !== active) {
          return;
        }
        var stamp = results[0];
        var board = results[1];
        state.loading = false;
        if (stamp.res.ok && stamp.data && stamp.data.source === "crawler" && stamp.data.erp === false) {
          state.stamp = "接口已确认：爬虫，不是 ERP";
        } else if (stamp.data && stamp.data.error) {
          state.error = stamp.data.error;
        } else {
          state.error = "边界接口没有标成爬虫";
        }
        if (board.res.ok && board.data && board.data.erp === false && board.data.source === "crawler") {
          applyBoard(board.data);
        } else if (!state.error) {
          state.error = (board.data && board.data.error) || "汇总台暂时打不开";
          state.board = fallbackBoard();
        }
        paint(root);
      })
      .catch(function () {
        if (mine !== active) {
          return;
        }
        state.loading = false;
        state.error = "汇总台没有读到。没有改去请求别的数据源。";
        state.board = fallbackBoard();
        paint(root);
      });
  }

  function mount(root) {
    var mine = ++active;
    function onSubmit(event) {
      var form = event.target;
      if (!form || !form.getAttribute || form.getAttribute("data-bound-filters") !== "1") {
        return;
      }
      event.preventDefault();
      readFilters(root);
      load(root, mine);
    }
    function onClick(event) {
      var button = event.target && event.target.closest ? event.target.closest("[data-tab]") : null;
      if (!button || !root.contains(button)) {
        return;
      }
      readFilters(root);
      state.tab = button.getAttribute("data-tab") || "batches";
      paint(root);
    }
    root.addEventListener("submit", onSubmit);
    root.addEventListener("click", onClick);
    state.board = fallbackBoard();
    load(root, mine);
    return function unmount() {
      if (mine === active) {
        active += 1;
      }
      root.removeEventListener("submit", onSubmit);
      root.removeEventListener("click", onClick);
      root.innerHTML = "";
    };
  }

  window.XmModules = window.XmModules || {};
  window.XmModules["/bound"] = { mount: mount };
})();
