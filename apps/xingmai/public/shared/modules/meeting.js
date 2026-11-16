/* xm-module-meeting 0.1.772-meeting — 月度大会单页小看板 */
(function () {
  var state = { month: "", admin: false, board: null, msg: "", error: false, saving: false, bound: false };

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function ensureStyle() {
    if (document.getElementById("meet-page-style")) {
      return;
    }
    var style = document.createElement("style");
    style.id = "meet-page-style";
    style.textContent =
      ".meet-page{color:var(--xm-ink);font-size:13px;}" +
      ".meet-bar{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin:0 0 10px;}" +
      ".meet-bar h1{margin:0;font-size:16px;font-weight:650;}" +
      ".meet-bar p{margin:2px 0 0;color:var(--xm-muted);font-size:12px;}" +
      ".meet-month{display:flex;align-items:center;gap:6px;color:var(--xm-muted);font-size:12px;}" +
      ".meet-month input{height:28px;border:1px solid var(--xm-line);border-radius:6px;background:var(--xm-card);color:var(--xm-ink);padding:0 8px;font:inherit;font-size:12px;}" +
      ".meet-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin:0 0 10px;}" +
      ".meet-kpi{border:0;border-radius:10px;padding:10px 12px;color:#fff;min-height:72px;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 6px 16px rgba(22,119,255,.12);}" +
      ".meet-kpi b{display:block;font-size:22px;line-height:1.1;font-variant-numeric:tabular-nums;}" +
      ".meet-kpi span{display:block;font-size:11px;opacity:.92;}" +
      ".meet-kpi input{width:100%;border:0;background:transparent;color:#fff;font:inherit;font-size:22px;font-weight:700;padding:0;}" +
      ".meet-kpi input::placeholder{color:rgba(255,255,255,.7);}" +
      ".meet-c0{background:linear-gradient(135deg,#1fb8c9,#2fd3c0);}" +
      ".meet-c1{background:linear-gradient(135deg,#2fcf78,#62e08a);}" +
      ".meet-c2{background:linear-gradient(135deg,#4b7cff,#6ea0ff);}" +
      ".meet-c3{background:linear-gradient(135deg,#7468ff,#9b8cff);}" +
      ".meet-c4{background:linear-gradient(135deg,#ff9440,#ffb15a);}" +
      ".meet-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}" +
      ".meet-card{background:var(--xm-card);border:1px solid var(--xm-line);border-radius:10px;box-shadow:var(--xm-shadow);padding:10px;}" +
      ".meet-card h2{margin:0 0 8px;font-size:13px;font-weight:650;}" +
      ".meet-table{width:100%;border-collapse:collapse;font-size:12px;}" +
      ".meet-table th{text-align:left;color:var(--xm-muted);font-weight:600;padding:4px 6px;border-bottom:1px solid var(--xm-line);white-space:nowrap;}" +
      ".meet-table td{padding:4px 6px;border-bottom:1px solid var(--xm-line);vertical-align:top;}" +
      ".meet-table input,.meet-table textarea{width:100%;border:1px solid var(--xm-line);border-radius:5px;background:var(--xm-card);color:var(--xm-ink);font:inherit;font-size:12px;padding:3px 6px;box-sizing:border-box;}" +
      ".meet-table textarea{min-height:36px;resize:vertical;}" +
      ".meet-empty{color:var(--xm-muted);font-size:12px;padding:8px 2px;}" +
      ".meet-actions{display:flex;gap:6px;margin-top:8px;}" +
      ".meet-mini{height:26px;border:1px solid var(--xm-line);border-radius:6px;background:var(--xm-card);color:var(--xm-ink);padding:0 8px;font:inherit;font-size:12px;cursor:pointer;}" +
      ".meet-primary{height:26px;border:0;border-radius:6px;background:var(--xm-primary);color:#fff;padding:0 10px;font:inherit;font-size:12px;cursor:pointer;}" +
      ".meet-msg{min-height:16px;color:var(--xm-muted);font-size:12px;margin:0 0 8px;}" +
      ".meet-msg.is-error{color:#cf1322;}" +
      "@media (max-width:980px){.meet-kpis{grid-template-columns:repeat(2,minmax(0,1fr));}.meet-grid{grid-template-columns:1fr;}}";
    document.head.appendChild(style);
  }

  function api(path, options) {
    var init = options || {};
    var headers = { Accept: "application/json" };
    if (init.body) {
      headers["Content-Type"] = "application/json";
    }
    return fetch(path, {
      credentials: "same-origin",
      headers: headers,
      method: init.method || "GET",
      body: init.body || undefined
    }).then(function (res) {
      return res.json().then(function (data) {
        return { res: res, data: data };
      });
    });
  }

  function rowsOf(key) {
    return ((state.board && state.board[key]) || []).slice();
  }

  function kpiCards() {
    var kpis = (state.board && state.board.kpis) || [];
    return (
      '<div class="meet-kpis">' +
      kpis
        .map(function (item, index) {
          var value = esc(item.value);
          var body = state.admin
            ? '<input data-kpi="' + esc(item.key) + '" value="' + value + '" aria-label="' + esc(item.label) + '">'
            : "<b>" + value + (item.unit ? item.unit : "") + "</b>";
          return (
            '<article class="meet-kpi meet-c' +
            index +
            '"><span>' +
            esc(item.label) +
            "</span>" +
            body +
            "<span>" +
            esc(item.hint) +
            "</span></article>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function cell(key, index, name, placeholder, wide) {
    var row = ((state.board && state.board[key]) || [])[index] || {};
    var value = esc(row[name] || "");
    if (!state.admin) {
      return "<td>" + (value || "—") + "</td>";
    }
    var tag = wide
      ? '<textarea data-list="' +
        esc(key) +
        '" data-i="' +
        index +
        '" data-f="' +
        esc(name) +
        '" placeholder="' +
        esc(placeholder) +
        '">' +
        value +
        "</textarea>"
      : '<input data-list="' +
        esc(key) +
        '" data-i="' +
        index +
        '" data-f="' +
        esc(name) +
        '" value="' +
        value +
        '" placeholder="' +
        esc(placeholder) +
        '">';
    return "<td>" + tag + "</td>";
  }

  function table(title, key, headers, fields, placeholders) {
    var list = rowsOf(key);
    if (state.admin && !list.length) {
      list = [{}];
    }
    var head = headers
      .map(function (label) {
        return "<th>" + esc(label) + "</th>";
      })
      .join("");
    var body;
    if (!list.length) {
      body = '<tr><td class="meet-empty" colspan="' + headers.length + '">本月还没填</td></tr>';
    } else {
      body = list
        .map(function (_row, index) {
          return (
            "<tr>" +
            fields
              .map(function (name, col) {
                var wide = name === "text" || name === "reason" || name === "note";
                return cell(key, index, name, placeholders[col], wide);
              })
              .join("") +
            "</tr>"
          );
        })
        .join("");
    }
    var add = state.admin
      ? '<div class="meet-actions"><button type="button" class="meet-mini" data-add="' + esc(key) + '">加一行</button></div>'
      : "";
    return (
      '<section class="meet-card"><h2>' +
      esc(title) +
      '</h2><table class="meet-table"><thead><tr>' +
      head +
      "</tr></thead><tbody>" +
      body +
      "</tbody></table>" +
      add +
      "</section>"
    );
  }

  function paint(root) {
    ensureStyle();
    var board = state.board || { month: state.month, kpis: [], title: "月度大会" };
    var save = state.admin
      ? '<button type="button" class="meet-primary" data-save="1"' +
        (state.saving ? " disabled" : "") +
        ">保存本月</button>"
      : "";
    root.innerHTML =
      '<main class="page meet-page">' +
      '<div class="meet-bar"><div><h1>' +
      esc(board.title || "月度大会") +
      "</h1><p>奋斗时长、排名、BI利润、新人、职级、目标、优秀员工，一页看完。</p></div>" +
      '<label class="meet-month">月份 <input type="month" data-month="1" value="' +
      esc(state.month) +
      '"></label>' +
      save +
      "</div>" +
      '<p class="meet-msg' +
      (state.error ? " is-error" : "") +
      '">' +
      esc(state.msg) +
      "</p>" +
      kpiCards() +
      '<div class="meet-grid">' +
      table("奋斗排名", "ranks", ["姓名", "时长", "备注"], ["name", "hours", "note"], ["姓名", "时长", "备注"]) +
      table("个人目标", "goals", ["姓名", "目标"], ["name", "text"], ["姓名", "本月目标"]) +
      table("新人介绍", "intros", ["姓名", "岗位", "介绍"], ["name", "role", "text"], ["姓名", "岗位", "一句话介绍"]) +
      table("职级调整", "levels", ["姓名", "原职级", "新职级", "说明"], ["name", "from", "to", "note"], ["姓名", "原", "新", "说明"]) +
      table("优秀员工", "stars", ["姓名", "事迹"], ["name", "reason"], ["姓名", "表彰理由"]) +
      "</div></main>";
  }

  function collect(root) {
    var board = {
      title: "月度大会",
      kpis: ((state.board && state.board.kpis) || []).map(function (item) {
        var input = root.querySelector('[data-kpi="' + item.key + '"]');
        return { key: item.key, value: input ? input.value : item.value };
      }),
      ranks: [],
      intros: [],
      levels: [],
      goals: [],
      stars: []
    };
    [].slice.call(root.querySelectorAll("[data-list]")).forEach(function (input) {
      var key = input.getAttribute("data-list");
      var index = Number(input.getAttribute("data-i") || 0);
      var fieldName = input.getAttribute("data-f");
      if (!board[key]) {
        board[key] = [];
      }
      board[key][index] = board[key][index] || {};
      board[key][index][fieldName] = input.value;
    });
    return board;
  }

  function load(root, month) {
    var query = month ? "?month=" + encodeURIComponent(month) : "";
    return api("/api/meeting" + query).then(function (result) {
      if (!result.res.ok) {
        state.error = true;
        state.msg = (result.data && result.data.error) || "打不开月度大会";
        paint(root);
        return;
      }
      state.error = false;
      state.admin = Boolean(result.data.admin);
      state.board = result.data.board;
      state.month = result.data.board.month;
      paint(root);
    });
  }

  function onClick(root, event) {
    var add = event.target.closest("[data-add]");
    if (add) {
      var key = add.getAttribute("data-add");
      var current = collect(root);
      current[key] = (current[key] || []).concat([{}]);
      state.board = current;
      paint(root);
      return;
    }
    if (!event.target.closest("[data-save]")) {
      return;
    }
    var payload = collect(root);
    state.saving = true;
    state.msg = "";
    paint(root);
    api("/api/meeting", {
      method: "PUT",
      body: JSON.stringify({ month: state.month, board: payload })
    }).then(function (result) {
      state.saving = false;
      if (!result.res.ok) {
        state.error = true;
        state.msg = (result.data && result.data.error) || "保存失败";
        paint(root);
        return;
      }
      state.error = false;
      state.msg = "已保存";
      state.board = result.data.board;
      paint(root);
    });
  }

  window.XmModules = window.XmModules || {};
  window.XmModules["/meeting"] = {
    mount: function (root) {
      ensureStyle();
      if (!root.__xmMeetBound) {
        root.__xmMeetBound = true;
        root.addEventListener("change", function (event) {
          if (event.target.getAttribute("data-month")) {
            load(root, event.target.value);
          }
        });
        root.addEventListener("click", function (event) {
          onClick(root, event);
        });
      }
      load(root);
      return function unmount() {
        root.innerHTML = "";
      };
    }
  };
})();
