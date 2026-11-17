/* xm-module-meeting — 月度大会会议档案 */
(function () {
  var KPI_KEYS = ["hours", "rank", "profit", "new", "star"];
  var KPI_META = {
    hours: { label: "奋斗时长", hint: "本月合计", unit: "小时", placeholder: "小时" },
    rank: { label: "奋斗排名", hint: "本月冠军", unit: "", placeholder: "第 1 名" },
    profit: { label: "BI利润", hint: "本月合计", unit: "", placeholder: "金额" },
    new: { label: "新人介绍", hint: "本月入职", unit: "人", placeholder: "人数" },
    star: { label: "优秀员工", hint: "本月表彰", unit: "人", placeholder: "人数" }
  };
  var LEVELS = ["专员", "主管", "经理", "总监", "负责人"];
  var SECTIONS = {
    ranks: ["name", "hours", "note"],
    intros: ["name", "role", "text"],
    levels: ["name", "from", "to", "note"],
    goals: ["name", "text"],
    stars: ["name", "reason"]
  };
  var state = {
    month: "",
    admin: false,
    board: null,
    prev: null,
    months: [],
    msg: "",
    error: false,
    saving: false,
    view: "board",
    entry: "form",
    batchKey: ""
  };

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
      ".meet-hero{position:relative;overflow:hidden;margin:0 0 10px;padding:2px 0 4px;}" +
      ".meet-hero h1{display:flex;align-items:center;gap:8px;margin:0;font-size:18px;font-weight:700;}" +
      ".meet-hero p{margin:4px 0 0;max-width:760px;color:var(--xm-muted);font-size:12px;line-height:1.5;}" +
      ".meet-mark{width:28px;height:28px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;background:var(--xm-primary-soft);color:var(--xm-primary);flex:none;}" +
      ".meet-mark svg,.meet-ico svg,.meet-op svg{width:16px;height:16px;}" +
      ".meet-wave{position:absolute;right:0;top:-8px;width:220px;height:72px;pointer-events:none;background:radial-gradient(circle at 70% 40%,rgba(22,119,255,.16),transparent 62%);}" +
      ".meet-tools{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin:0 0 10px;}" +
      ".meet-tools-left,.meet-tools-right,.meet-card-tools,.meet-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}" +
      ".meet-month{display:flex;align-items:center;gap:6px;color:var(--xm-muted);font-size:12px;}" +
      ".meet-month input{height:30px;border:1px solid var(--xm-line);border-radius:8px;background:var(--xm-card);color:var(--xm-ink);padding:0 8px;font:inherit;font-size:12px;}" +
      ".meet-tab,.meet-mini,.meet-op{height:30px;border:1px solid var(--xm-line);border-radius:8px;background:var(--xm-card);color:var(--xm-ink);padding:0 10px;font:inherit;font-size:12px;cursor:pointer;}" +
      ".meet-tab.is-on,.meet-primary{border-color:transparent;background:var(--xm-primary);color:#fff;}" +
      ".meet-link{border:0;background:transparent;color:var(--xm-primary);font:inherit;font-size:12px;cursor:pointer;padding:0;}" +
      ".meet-readonly{color:var(--xm-muted);font-size:12px;}" +
      ".meet-msg{min-height:16px;margin:0 0 8px;color:var(--xm-muted);font-size:12px;}" +
      ".meet-msg.is-error{color:#cf1322;}" +
      ".meet-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin:0 0 10px;}" +
      ".meet-kpi{display:flex;gap:10px;align-items:flex-start;background:var(--xm-card);border:1px solid var(--xm-line);border-radius:12px;box-shadow:var(--xm-shadow);padding:12px;min-height:84px;}" +
      ".meet-ico{width:32px;height:32px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;color:#fff;flex:none;}" +
      ".meet-ico-0{background:#1fb8c9;}.meet-ico-1{background:#2fcf78;}.meet-ico-2{background:#4b7cff;}.meet-ico-3{background:#7468ff;}.meet-ico-4{background:#ff9440;}" +
      ".meet-kpi .meet-label{display:block;color:var(--xm-muted);font-size:12px;line-height:1.2;}" +
      ".meet-kpi b,.meet-val{display:block;margin-top:4px;font-size:20px;line-height:1.15;font-weight:700;font-variant-numeric:tabular-nums;}" +
      ".meet-val{display:flex;align-items:baseline;gap:4px;}" +
      ".meet-val input,.meet-delta{border:0;background:transparent;color:var(--xm-ink);font:inherit;padding:0;}" +
      ".meet-val input{field-sizing:content;width:auto;min-width:1.5em;max-width:100%;font-size:20px;font-weight:700;}" +
      ".meet-val input::placeholder{color:var(--xm-muted);font-weight:650;}" +
      ".meet-unit{font-size:12px;font-weight:650;color:var(--xm-muted);flex:none;}" +
      ".meet-delta{width:64px;margin-left:6px;font-size:11px;color:var(--xm-muted);}" +
      ".meet-hint{display:flex;align-items:center;margin-top:4px;color:var(--xm-muted);font-size:11px;}" +
      ".meet-hint em{font-style:normal;margin-left:4px;}" +
      ".is-up{color:#159947;}.is-down{color:#cf1322;}" +
      ".meet-split{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:10px;align-items:start;}" +
      ".meet-panel,.meet-side-card,.meet-card{background:var(--xm-card);border:1px solid var(--xm-line);border-radius:12px;box-shadow:var(--xm-shadow);}" +
      ".meet-panel{padding:10px;}" +
      ".meet-panel-bar{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 8px;}" +
      ".meet-note{color:var(--xm-muted);font-size:12px;}" +
      ".meet-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}" +
      ".meet-card{padding:10px;}" +
      ".meet-card.is-wide{grid-column:1 / -1;}" +
      ".meet-card-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 8px;}" +
      ".meet-card-head h2{display:flex;align-items:center;gap:6px;margin:0;font-size:13px;font-weight:650;}" +
      ".meet-star{color:#e85d4c;font-weight:700;}" +
      ".meet-table{width:100%;border-collapse:collapse;font-size:12px;}" +
      ".meet-table th{text-align:left;color:var(--xm-muted);font-weight:600;padding:4px;border-bottom:1px solid var(--xm-line);white-space:nowrap;}" +
      ".meet-table td{padding:4px;border-bottom:1px solid var(--xm-line);vertical-align:middle;}" +
      ".meet-rank{width:3em;text-align:center;color:var(--xm-muted);font-variant-numeric:tabular-nums;}" +
      ".meet-table input,.meet-table select,.meet-table textarea,.meet-paste{width:100%;box-sizing:border-box;border:1px solid var(--xm-line);border-radius:6px;background:var(--xm-card);color:var(--xm-ink);font:inherit;font-size:12px;padding:4px 6px;}" +
      ".meet-table textarea,.meet-paste{min-height:52px;resize:vertical;}" +
      ".meet-empty{color:var(--xm-muted);padding:8px 2px;}" +
      ".meet-del{width:26px;height:26px;border:0;border-radius:6px;background:transparent;color:var(--xm-muted);cursor:pointer;}" +
      ".meet-del:hover{color:#cf1322;}" +
      ".meet-batch{margin-top:6px;}" +
      ".meet-side{display:flex;flex-direction:column;gap:8px;position:sticky;top:8px;}" +
      ".meet-side-card{padding:10px;}" +
      ".meet-side-card h2{display:flex;align-items:center;justify-content:space-between;margin:0 0 8px;font-size:13px;}" +
      ".meet-record{display:flex;gap:8px;width:100%;text-align:left;border:0;background:transparent;color:var(--xm-ink);padding:6px 0;border-bottom:1px solid var(--xm-line);cursor:pointer;font:inherit;}" +
      ".meet-record:last-child{border-bottom:0;}" +
      ".meet-record b{display:block;font-size:12px;font-weight:650;}" +
      ".meet-record span{display:block;color:var(--xm-muted);font-size:11px;margin-top:2px;}" +
      ".meet-dot{width:8px;height:8px;border-radius:99px;background:var(--xm-primary);margin-top:5px;flex:none;}" +
      ".meet-badge{display:inline-block;margin-left:4px;padding:0 5px;border-radius:99px;background:var(--xm-primary-soft);color:var(--xm-primary);font-size:11px;font-weight:600;}" +
      ".meet-ops{display:grid;grid-template-columns:1fr 1fr;gap:6px;}" +
      ".meet-op{height:auto;min-height:58px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:8px 4px;text-align:center;line-height:1.3;}" +
      ".meet-report h3{margin:12px 0 6px;font-size:14px;}" +
      ".meet-report li{margin:2px 0;}" +
      "@media (max-width:1100px){.meet-kpis{grid-template-columns:repeat(2,minmax(0,1fr));}.meet-split,.meet-grid{grid-template-columns:1fr;}.meet-side{position:static;}}";
    document.head.appendChild(style);
  }

  function icon(path) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + path + "</svg>";
  }

  var ICONS = [
    icon('<circle cx="12" cy="12" r="7"/><path d="M12 9v4l2 1"/>'),
    icon('<path d="M8 20h8"/><path d="M12 16v4"/><path d="M7 8h10v3a5 5 0 0 1-10 0V8z"/><path d="M7 9H5a2 2 0 0 0 2 3"/><path d="M17 9h2a2 2 0 0 1-2 3"/>'),
    icon('<ellipse cx="12" cy="7" rx="7" ry="3"/><path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7"/><path d="M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/>'),
    icon('<circle cx="9" cy="9" r="2.2"/><path d="M4.8 18c.5-2.2 2.2-3.4 4.2-3.4S12.7 15.8 13.2 18"/><circle cx="16" cy="9.2" r="1.7"/><path d="M15 14.6c1.4.2 2.5 1.2 2.9 2.8"/>'),
    icon('<circle cx="12" cy="9" r="3"/><path d="M8.5 14.5 7 20l5-2 5 2-1.5-5.5"/>')
  ];

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

  function num(value) {
    var text = String(value == null ? "" : value).replace(/,/g, "").replace(/[^\d.-]/g, "");
    if (!text || text === "-" || text === ".") {
      return null;
    }
    var parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function shiftMonth(month, delta) {
    var parts = String(month || "").split("-").map(Number);
    var date = new Date(Date.UTC(parts[0], (parts[1] || 1) - 1 + delta, 1));
    return date.getUTCFullYear() + "-" + String(date.getUTCMonth() + 1).padStart(2, "0");
  }

  function monthLabel(month) {
    var parts = String(month || "").split("-");
    if (parts.length < 2) {
      return month || "";
    }
    return parts[0] + "年" + Number(parts[1]) + "月";
  }

  function rowsOf(key) {
    return ((state.board && state.board[key]) || []).slice();
  }

  function derivedMap(board) {
    var ranks = (board && board.ranks) || [];
    var hours = 0;
    var hasHours = false;
    ranks.forEach(function (row) {
      var value = num(row && row.hours);
      if (value != null) {
        hours += value;
        hasHours = true;
      }
    });
    return {
      hours: hasHours ? String(Math.round(hours)) : "",
      rank: ranks.length ? "第 1 名" : "",
      profit: "",
      new: ((board && board.intros) || []).length ? String(board.intros.length) : "",
      star: ((board && board.stars) || []).length ? String(board.stars.length) : ""
    };
  }

  function kpisOf() {
    var byKey = {};
    ((state.board && state.board.kpis) || []).forEach(function (item) {
      if (item && item.key) {
        byKey[item.key] = item;
      }
    });
    var derived = derivedMap(state.board);
    return KPI_KEYS.map(function (key) {
      var meta = KPI_META[key];
      var item = byKey[key] || {};
      return {
        key: key,
        label: meta.label,
        hint: meta.hint,
        unit: meta.unit,
        placeholder: item.value ? "" : derived[key] || "—",
        value: item.value == null ? "" : String(item.value),
        delta: item.delta == null ? "" : String(item.delta)
      };
    });
  }

  function displayValue(item) {
    if (item.value) {
      return item.value;
    }
    return derivedMap(state.board)[item.key] || "";
  }

  function pretty(item) {
    var value = displayValue(item);
    if (!value) {
      return "—";
    }
    var parsed = num(value);
    if (parsed == null || item.key === "rank") {
      return value;
    }
    var text = Math.round(parsed).toLocaleString("zh-CN");
    if (item.key === "profit") {
      return "¥" + text;
    }
    if (item.unit) {
      return text + " " + item.unit;
    }
    return text;
  }

  function deltaOf(item) {
    if (item.delta) {
      return item.delta;
    }
    var prevItem = ((state.prev && state.prev.kpis) || []).filter(function (row) {
      return row.key === item.key;
    })[0];
    var now = num(displayValue(item));
    var prev = num(prevItem && prevItem.value);
    if (now == null || prev == null || prev === 0) {
      return "";
    }
    var change = ((now - prev) / Math.abs(prev)) * 100;
    return (change > 0 ? "+" : "") + change.toFixed(1) + "%";
  }

  function kpiCards() {
    return (
      '<div class="meet-kpis">' +
      kpisOf()
        .map(function (item, index) {
          var delta = deltaOf(item);
          var deltaClass = delta.charAt(0) === "-" ? "is-down" : "is-up";
          var body = state.admin
            ? '<span class="meet-val"><input data-kpi="' +
              esc(item.key) +
              '" value="' +
              esc(item.value) +
              '" placeholder="' +
              esc(item.placeholder) +
              '" aria-label="' +
              esc(item.label) +
              '">' +
              (item.unit ? '<em class="meet-unit">' + esc(item.unit) + "</em>" : "") +
              "</span>"
            : "<b>" + esc(pretty(item)) + "</b>";
          var hint =
            '<span class="meet-hint">' +
            esc(item.hint) +
            (state.admin
              ? '<input class="meet-delta" data-delta="' +
                esc(item.key) +
                '" value="' +
                esc(item.delta) +
                '" placeholder="环比" aria-label="' +
                esc(item.label) +
                '环比">'
              : delta
                ? '<em class="' + deltaClass + '">' + esc(delta) + "</em>"
                : "") +
            "</span>";
          return (
            '<article class="meet-kpi"><i class="meet-ico meet-ico-' +
            index +
            '">' +
            ICONS[index] +
            '</i><div><span class="meet-label">' +
            esc(item.label) +
            "</span>" +
            body +
            hint +
            "</div></article>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function levelSelect(key, index, name, value) {
    var options = LEVELS.slice();
    if (value && options.indexOf(value) < 0) {
      options.push(value);
    }
    return (
      '<select data-list="' +
      esc(key) +
      '" data-i="' +
      index +
      '" data-f="' +
      esc(name) +
      '"><option value="">请选择</option>' +
      options
        .map(function (level) {
          return '<option value="' + esc(level) + '"' + (level === value ? " selected" : "") + ">" + esc(level) + "</option>";
        })
        .join("") +
      "</select>"
    );
  }

  function cell(key, index, name, placeholder, wide) {
    var row = ((state.board && state.board[key]) || [])[index] || {};
    var value = row[name] || "";
    if (!state.admin) {
      return "<td>" + esc(value || "—") + "</td>";
    }
    if (key === "levels" && (name === "from" || name === "to")) {
      return "<td>" + levelSelect(key, index, name, value) + "</td>";
    }
    if (wide) {
      return (
        "<td><textarea data-list=\"" +
        esc(key) +
        '" data-i="' +
        index +
        '" data-f="' +
        esc(name) +
        '" placeholder="' +
        esc(placeholder) +
        '">' +
        esc(value) +
        "</textarea></td>"
      );
    }
    return (
      '<td><input data-list="' +
      esc(key) +
      '" data-i="' +
      index +
      '" data-f="' +
      esc(name) +
      '" value="' +
      esc(value) +
      '" placeholder="' +
      esc(placeholder) +
      '"></td>'
    );
  }

  function tableCard(title, key, headers, fields, placeholders, wide) {
    var list = rowsOf(key);
    if (state.admin && !list.length) {
      list = [{}];
    }
    var ranked = key === "ranks";
    var head =
      (ranked ? '<th class="meet-rank">名次</th>' : "") +
      headers.map(function (label) { return "<th>" + esc(label) + "</th>"; }).join("") +
      (state.admin ? "<th></th>" : "");
    var cols = headers.length + (ranked ? 1 : 0) + (state.admin ? 1 : 0);
    var body = !list.length
      ? '<tr><td class="meet-empty" colspan="' + cols + '">本月还没填</td></tr>'
      : list
          .map(function (_row, index) {
            var del = state.admin
              ? '<td><button type="button" class="meet-del" data-del="' +
                esc(key) +
                '" data-i="' +
                index +
                '" aria-label="删除">×</button></td>'
              : "";
            return (
              "<tr>" +
              (ranked ? '<td class="meet-rank">' + (index + 1) + "</td>" : "") +
              fields
                .map(function (name, col) {
                  return cell(key, index, name, placeholders[col], false);
                })
                .join("") +
              del +
              "</tr>"
            );
          })
          .join("");
    var tools = state.admin
      ? '<div class="meet-card-tools"><button type="button" class="meet-link" data-pick="' +
        esc(key) +
        '">导入表格</button><button type="button" class="meet-link" data-batch="' +
        esc(key) +
        '">批量添加</button></div>'
      : "";
    var batch =
      state.admin && state.batchKey === key
        ? '<div class="meet-batch"><textarea class="meet-paste" data-paste="' +
          esc(key) +
          '" placeholder="一行一条，逗号分开"></textarea><div class="meet-actions"><button type="button" class="meet-mini" data-apply="' +
          esc(key) +
          '">写入</button></div></div>'
        : "";
    var add = state.admin
      ? '<div class="meet-actions"><button type="button" class="meet-mini" data-add="' + esc(key) + '">+ 添加一行</button></div>'
      : "";
    return (
      '<section class="meet-card' +
      (wide ? " is-wide" : "") +
      '"><div class="meet-card-head"><h2>' +
      esc(title) +
      (state.admin ? '<span class="meet-star">*</span>' : "") +
      "</h2>" +
      tools +
      '</div><table class="meet-table"><thead><tr>' +
      head +
      "</tr></thead><tbody>" +
      body +
      "</tbody></table>" +
      batch +
      add +
      "</section>"
    );
  }

  function records(compact) {
    var list = state.months || [];
    if (!list.length) {
      return '<p class="meet-empty">还没有大会记录</p>';
    }
    return list
      .slice(0, compact ? 6 : list.length)
      .map(function (item) {
        return (
          '<button type="button" class="meet-record" data-open="' +
          esc(item.month) +
          '"><i class="meet-dot"></i><span><b>' +
          esc(monthLabel(item.month) + " 月度大会") +
          (item.current ? '<em class="meet-badge">本月</em>' : "") +
          "</b><span>" +
          esc(item.end + " · " + item.state + (item.note && item.note !== item.state ? " · " + item.note : "")) +
          "</span></span></button>"
        );
      })
      .join("");
  }

  function aside() {
    var ops = [
      ['template', "下载导入模板"],
      state.admin ? ['import', "批量导入数据"] : null,
      ['report', "预览大会报告"],
      ['ppt', "生成大会PPT"]
    ].filter(Boolean);
    return (
      '<aside class="meet-side"><section class="meet-side-card"><h2>大会记录 <button type="button" class="meet-link" data-view="history">查看全部</button></h2>' +
      records(true) +
      '</section><section class="meet-side-card"><h2>快速操作</h2><div class="meet-ops">' +
      ops
        .map(function (item) {
          return '<button type="button" class="meet-op" data-act="' + item[0] + '">' + esc(item[1]) + "</button>";
        })
        .join("") +
      "</div></section></aside>"
    );
  }

  function formPanel() {
    return (
      tableCard("奋斗排名", "ranks", ["姓名", "奋斗时长(小时)", "备注"], ["name", "hours", "note"], ["请输入姓名", "请输入时长", "请输入备注"]) +
      tableCard("新人介绍", "intros", ["姓名", "岗位", "介绍"], ["name", "role", "text"], ["请输入姓名", "请输入岗位", "请输入一句话介绍"]) +
      tableCard("职级调整", "levels", ["姓名", "原职级", "新职级", "说明"], ["name", "from", "to", "note"], ["请输入姓名", "请选择", "请选择", "请输入说明"]) +
      tableCard("个人目标", "goals", ["姓名", "目标"], ["name", "text"], ["请输入姓名", "请输入本月目标（如：销售额、利润、ROI等）"]) +
      tableCard("优秀员工", "stars", ["姓名", "事迹（表彰理由）"], ["name", "reason"], ["请输入姓名", "请输入表彰理由（如：业绩突出，增长最快、团队贡献等）"], true)
    );
  }

  function batchPanel() {
    return (
      '<div class="meet-batch"><p class="meet-note">支持手动填写，或把 Excel 另存为 CSV 后导入。导入只写到页面上，点保存本月才会留下。</p><textarea class="meet-paste" data-paste="all" placeholder="# 指标&#10;奋斗时长,120&#10;# 奋斗排名&#10;姓名,奋斗时长,备注"></textarea><div class="meet-actions"><button type="button" class="meet-mini" data-apply="all">写入本月</button></div></div>'
    );
  }

  function reportBlock() {
    var board = state.board || {};
    function lines(title, rows, format) {
      var body = rows.length
        ? "<ul>" + rows.map(function (row) { return "<li>" + esc(format(row)) + "</li>"; }).join("") + "</ul>"
        : '<p class="meet-empty">本月还没填</p>';
      return "<h3>" + esc(title) + "</h3>" + body;
    }
    return (
      '<section class="meet-panel meet-report"><h2>' +
      esc(monthLabel(state.month) + " 月度大会") +
      "</h2>" +
      kpisOf().map(function (item) { return "<p><b>" + esc(item.label) + "</b> " + esc(pretty(item)) + "</p>"; }).join("") +
      lines("奋斗排名", board.ranks || [], function (row) { return (row.name || "—") + " · " + (row.hours || "—") + (row.note ? " · " + row.note : ""); }) +
      lines("新人介绍", board.intros || [], function (row) { return (row.name || "—") + " · " + (row.role || "—") + (row.text ? " · " + row.text : ""); }) +
      lines("职级调整", board.levels || [], function (row) { return (row.name || "—") + " · " + (row.from || "—") + " → " + (row.to || "—"); }) +
      lines("个人目标", board.goals || [], function (row) { return (row.name || "—") + " · " + (row.text || "—"); }) +
      lines("优秀员工", board.stars || [], function (row) { return (row.name || "—") + " · " + (row.reason || "—"); }) +
      "</section>"
    );
  }

  function compareBlock() {
    var prevLabel = monthLabel(shiftMonth(state.month, -1));
    var rows = kpisOf()
      .map(function (item) {
        var prevItem = ((state.prev && state.prev.kpis) || []).filter(function (row) { return row.key === item.key; })[0] || { value: "" };
        return (
          "<tr><td>" +
          esc(item.label) +
          "</td><td>" +
          esc(pretty(item)) +
          "</td><td>" +
          esc(prevItem.value || "—") +
          "</td><td>" +
          esc(deltaOf(item) || "—") +
          "</td></tr>"
        );
      })
      .join("");
    return (
      '<section class="meet-panel"><h2>数据对比</h2><p class="meet-note">' +
      esc(monthLabel(state.month)) +
      " 对比 " +
      esc(prevLabel) +
      '</p><table class="meet-table"><thead><tr><th>指标</th><th>本月</th><th>上月</th><th>变化</th></tr></thead><tbody>' +
      rows +
      "</tbody></table></section>"
    );
  }

  function mainColumn() {
    if (state.view === "history") {
      return '<section class="meet-panel"><h2>历史大会</h2>' + records(false) + "</section>";
    }
    if (state.view === "compare") {
      return compareBlock();
    }
    if (state.view === "report") {
      return reportBlock();
    }
    return (
      '<section class="meet-panel"><div class="meet-panel-bar"><div class="meet-tools-left"><button type="button" class="meet-tab' +
      (state.entry === "form" ? " is-on" : "") +
      '" data-entry="form">数据录入</button><button type="button" class="meet-tab' +
      (state.entry === "batch" ? " is-on" : "") +
      '" data-entry="batch">数据导入（批量）</button></div><p class="meet-note">支持手动填写或导入 CSV，录入后点保存生成大会数据。</p></div>' +
      (state.entry === "batch" ? batchPanel() : '<div class="meet-grid">' + formPanel() + "</div>") +
      "</section>"
    );
  }

  function paint(root) {
    ensureStyle();
    var right = state.admin
      ? '<button type="button" class="meet-mini" data-act="import">导入数据</button><button type="button" class="meet-mini" data-act="template">下载模板</button><button type="button" class="meet-primary meet-mini" data-save="1"' +
        (state.saving ? " disabled" : "") +
        '>保存本月</button><button type="button" class="meet-mini" data-act="new">+ 新建大会记录</button>'
      : '<button type="button" class="meet-mini" data-act="template">下载模板</button><span class="meet-readonly">只读</span>';
    root.innerHTML =
      '<main class="page meet-page"><header class="meet-hero"><div class="meet-wave"></div><h1><i class="meet-mark">' +
      ICONS[1] +
      "</i>月度大会（会议档案）</h1><p>统一记录月度大会的核心数据：奋斗排名、BI利润、新人介绍、职级调整、个人目标、优秀员工等，沉淀团队成长档案。</p></header>" +
      '<div class="meet-tools"><div class="meet-tools-left"><label class="meet-month">月份 <input type="month" lang="zh-CN" data-month="1" value="' +
      esc(state.month) +
      '"></label><button type="button" class="meet-tab' +
      (state.view === "board" ? " is-on" : "") +
      '" data-view="board">本月大会</button><button type="button" class="meet-tab' +
      (state.view === "history" ? " is-on" : "") +
      '" data-view="history">历史大会</button><button type="button" class="meet-tab' +
      (state.view === "compare" ? " is-on" : "") +
      '" data-view="compare">数据对比</button></div><div class="meet-tools-right">' +
      right +
      "</div></div>" +
      '<p class="meet-msg' +
      (state.error ? " is-error" : "") +
      '">' +
      esc(state.msg) +
      "</p>" +
      (state.view === "board" ? kpiCards() : "") +
      '<div class="meet-split">' +
      mainColumn() +
      aside() +
      '</div><input type="file" accept=".csv,.txt,text/csv,text/plain" data-file="all" hidden></main>';
  }

  function collect(root) {
    var board = {
      title: "月度大会",
      kpis: kpisOf().map(function (item) {
        var input = root.querySelector('[data-kpi="' + item.key + '"]');
        var delta = root.querySelector('[data-delta="' + item.key + '"]');
        return {
          key: item.key,
          label: item.label,
          hint: item.hint,
          unit: item.unit,
          placeholder: item.placeholder,
          value: input ? input.value : item.value,
          delta: delta ? delta.value : item.delta
        };
      }),
      ranks: rowsOf("ranks"),
      intros: rowsOf("intros"),
      levels: rowsOf("levels"),
      goals: rowsOf("goals"),
      stars: rowsOf("stars")
    };
    var touched = {};
    [].slice.call(root.querySelectorAll("[data-list]")).forEach(function (input) {
      var key = input.getAttribute("data-list");
      var index = Number(input.getAttribute("data-i") || 0);
      var fieldName = input.getAttribute("data-f");
      if (!touched[key]) {
        board[key] = [];
        touched[key] = true;
      }
      board[key][index] = board[key][index] || {};
      board[key][index][fieldName] = input.value;
    });
    Object.keys(SECTIONS).forEach(function (key) {
      board[key] = (board[key] || []).filter(function (row) {
        return (SECTIONS[key] || []).some(function (field) {
          return String((row && row[field]) || "").trim();
        });
      });
    });
    return board;
  }

  function parseLines(text, section) {
    var current = section && section !== "all" ? section : "";
    var parsed = { kpis: [], ranks: [], intros: [], levels: [], goals: [], stars: [] };
    String(text || "")
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .forEach(function (line) {
        var raw = line.trim();
        if (!raw) {
          return;
        }
        if (raw.charAt(0) === "#") {
          var title = raw.slice(1).trim();
          if (title === "指标" || title === "KPI") {
            current = "kpis";
          } else if (title.indexOf("排名") >= 0) {
            current = "ranks";
          } else if (title.indexOf("新人") >= 0) {
            current = "intros";
          } else if (title.indexOf("职级") >= 0) {
            current = "levels";
          } else if (title.indexOf("目标") >= 0) {
            current = "goals";
          } else if (title.indexOf("优秀") >= 0) {
            current = "stars";
          }
          return;
        }
        var cells = raw.split(/[,\t，]/).map(function (cellText) { return cellText.trim(); });
        if (/^(姓名|名次|指标|奋斗时长|BI)/.test(cells[0])) {
          return;
        }
        if (current === "kpis") {
          var key = KPI_KEYS.filter(function (item) { return KPI_META[item].label === cells[0]; })[0];
          if (key) {
            parsed.kpis.push({ key: key, value: cells[1] || "", delta: cells[2] || "" });
          }
          return;
        }
        if (!parsed[current]) {
          return;
        }
        var fields = SECTIONS[current];
        var start = current === "ranks" && num(cells[0]) != null && cells.length > fields.length ? 1 : 0;
        var row = {};
        fields.forEach(function (field, index) {
          row[field] = cells[start + index] || "";
        });
        if (fields.some(function (field) { return row[field]; })) {
          parsed[current].push(row);
        }
      });
    return parsed;
  }

  function templateText() {
    return [
      "# 指标",
      "奋斗时长,",
      "奋斗排名,",
      "BI利润,",
      "新人介绍,",
      "优秀员工,",
      "# 奋斗排名",
      "姓名,奋斗时长,备注",
      "# 新人介绍",
      "姓名,岗位,介绍",
      "# 职级调整",
      "姓名,原职级,新职级,说明",
      "# 个人目标",
      "姓名,目标",
      "# 优秀员工",
      "姓名,事迹"
    ].join("\n");
  }

  function download(filename, content, type) {
    var blob = new Blob([content], { type: type || "text/plain;charset=utf-8" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
  }

  function reportHtml() {
    var title = monthLabel(state.month) + " 月度大会";
    return "<!DOCTYPE html><html lang=\"zh-CN\"><head><meta charset=\"utf-8\"><title>" + esc(title) + "</title></head><body><h1>" + esc(title) + "</h1>" + reportBlock().replace(/class="[^"]*"/g, "") + "</body></html>";
  }

  function fail(root, message) {
    state.saving = false;
    state.error = true;
    state.msg = message || "打不开月度大会";
    paint(root);
  }

  function load(root, month) {
    var query = month ? "?month=" + encodeURIComponent(month) : "";
    return api("/api/meeting" + query)
      .then(function (result) {
        if (!result.res.ok) {
          fail(root, (result.data && result.data.error) || "打不开月度大会");
          return null;
        }
        state.error = false;
        state.admin = Boolean(result.data.admin);
        state.board = result.data.board;
        state.months = result.data.months || [];
        state.month = result.data.board.month;
        return api("/api/meeting?month=" + encodeURIComponent(shiftMonth(state.month, -1)));
      })
      .then(function (prev) {
        if (!prev) {
          return;
        }
        state.prev = prev.res.ok ? prev.data.board : null;
        paint(root);
      })
      .catch(function () {
        fail(root, "打不开月度大会");
      });
  }

  function applyParsed(root, parsed, section) {
    var current = collect(root);
    if (section && section !== "all") {
      current[section] = (current[section] || []).concat(parsed[section] || []);
    } else {
      if (parsed.kpis.length) {
        var byKey = {};
        current.kpis.forEach(function (item) { byKey[item.key] = item; });
        parsed.kpis.forEach(function (item) {
          if (byKey[item.key]) {
            byKey[item.key].value = item.value;
            if (item.delta) {
              byKey[item.key].delta = item.delta;
            }
          }
        });
      }
      Object.keys(SECTIONS).forEach(function (key) {
        if ((parsed[key] || []).length) {
          current[key] = (current[key] || []).concat(parsed[key]);
        }
      });
    }
    state.board = current;
    state.view = "board";
    state.entry = "form";
    state.batchKey = "";
    state.error = false;
    state.msg = "已写入页面，点保存本月后才会留下";
    paint(root);
  }

  function onClick(root, event) {
    var view = event.target.closest("[data-view]");
    if (view) {
      if (state.admin) {
        state.board = collect(root);
      }
      state.view = view.getAttribute("data-view");
      state.msg = "";
      paint(root);
      return;
    }
    var entry = event.target.closest("[data-entry]");
    if (entry) {
      if (state.admin) {
        state.board = collect(root);
      }
      state.entry = entry.getAttribute("data-entry");
      state.view = "board";
      paint(root);
      return;
    }
    var add = event.target.closest("[data-add]");
    if (add && state.admin) {
      var key = add.getAttribute("data-add");
      var current = collect(root);
      current[key] = (current[key] || []).concat([{}]);
      state.board = current;
      paint(root);
      return;
    }
    var del = event.target.closest("[data-del]");
    if (del && state.admin) {
      var listKey = del.getAttribute("data-del");
      var index = Number(del.getAttribute("data-i") || 0);
      var next = collect(root);
      next[listKey] = (next[listKey] || []).filter(function (_row, rowIndex) { return rowIndex !== index; });
      state.board = next;
      paint(root);
      return;
    }
    var batch = event.target.closest("[data-batch]");
    if (batch && state.admin) {
      state.board = collect(root);
      state.batchKey = state.batchKey === batch.getAttribute("data-batch") ? "" : batch.getAttribute("data-batch");
      paint(root);
      return;
    }
    var apply = event.target.closest("[data-apply]");
    if (apply && state.admin) {
      var section = apply.getAttribute("data-apply");
      var paste = root.querySelector('[data-paste="' + section + '"]');
      applyParsed(root, parseLines(paste ? paste.value : "", section), section);
      return;
    }
    var pick = event.target.closest("[data-pick]");
    if (pick && state.admin) {
      var input = root.querySelector("[data-file]");
      if (input) {
        input.setAttribute("data-file", pick.getAttribute("data-pick"));
        input.value = "";
        input.click();
      }
      return;
    }
    var open = event.target.closest("[data-open]");
    if (open) {
      state.view = "board";
      state.msg = "";
      load(root, open.getAttribute("data-open"));
      return;
    }
    var act = event.target.closest("[data-act]");
    if (act) {
      var name = act.getAttribute("data-act");
      if (name === "template") {
        download("月度大会导入模板.csv", templateText(), "text/csv;charset=utf-8");
        return;
      }
      if (name === "import" && state.admin) {
        var file = root.querySelector("[data-file]");
        if (file) {
          file.setAttribute("data-file", "all");
          file.value = "";
          file.click();
        }
        return;
      }
      if (name === "new" && state.admin) {
        state.view = "board";
        load(root, shiftMonth(state.month, 1));
        return;
      }
      if (name === "report") {
        if (state.admin) {
          state.board = collect(root);
        }
        state.view = "report";
        state.msg = "";
        paint(root);
        return;
      }
      if (name === "ppt") {
        if (state.admin) {
          state.board = collect(root);
        }
        download("月度大会-" + state.month + ".html", reportHtml(), "text/html;charset=utf-8");
        state.error = false;
        state.msg = "已下载大会页面，可用浏览器打开";
        paint(root);
        return;
      }
    }
    if (!event.target.closest("[data-save]") || !state.admin) {
      return;
    }
    var payload = collect(root);
    state.board = payload;
    state.saving = true;
    state.error = false;
    state.msg = "";
    paint(root);
    api("/api/meeting", {
      method: "PUT",
      body: JSON.stringify({ month: state.month, board: payload })
    })
      .then(function (result) {
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
        state.months = result.data.months || state.months;
        paint(root);
      })
      .catch(function () {
        state.saving = false;
        state.error = true;
        state.msg = "保存失败";
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
            state.view = "board";
            load(root, event.target.value);
            return;
          }
          var file = event.target.getAttribute("data-file");
          var picked = event.target.files && event.target.files[0];
          if (!file || !picked || !state.admin) {
            return;
          }
          if (!/\.(csv|txt)$/i.test(picked.name)) {
            state.error = true;
            state.msg = "请把 Excel 另存为 CSV 再导入";
            paint(root);
            return;
          }
          var reader = new FileReader();
          reader.onload = function () {
            applyParsed(root, parseLines(String(reader.result || ""), file), file);
          };
          reader.readAsText(picked, "utf-8");
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
