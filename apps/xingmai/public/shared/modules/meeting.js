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

  function filledRows(rows, fields) {
    return (rows || []).filter(function (row) {
      return fields.some(function (field) {
        return String((row && row[field]) || "").trim();
      });
    });
  }

  function derivedMap(board) {
    var ranks = filledRows(board && board.ranks, SECTIONS.ranks);
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
      new: filledRows(board && board.intros, SECTIONS.intros).length ? String(filledRows(board && board.intros, SECTIONS.intros).length) : "",
      star: filledRows(board && board.stars, SECTIONS.stars).length ? String(filledRows(board && board.stars, SECTIONS.stars).length) : ""
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

  function lib() {
    return window.XmUI || null;
  }

  function statValue(item) {
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
    return text;
  }

  function statUnit(item) {
    if (!displayValue(item) || item.key === "rank" || item.key === "profit") {
      return "";
    }
    return item.unit || "";
  }

  function kpiCards() {
    var ui = lib();
    var tones = { hours: "blue", rank: "green", profit: "blue", new: "purple", star: "orange" };
    var icons = { hours: "chart", rank: "award", profit: "file", new: "users", star: "award" };
    return (
      '<div class="xm-ui-stat-grid">' +
      kpisOf()
        .map(function (item) {
          var delta = deltaOf(item);
          var html = ui.StatCard({
            label: item.label,
            value: state.admin ? item.value || item.placeholder || "—" : statValue(item),
            unit: state.admin ? item.unit : statUnit(item),
            icon: icons[item.key],
            tone: tones[item.key],
            note: item.hint + (!state.admin && delta ? " " + delta : ""),
            trend: !state.admin && delta && delta.charAt(0) !== "-" ? "up" : ""
          });
          if (!state.admin) {
            return html;
          }
          var computed = deltaOf({ key: item.key, value: item.value, unit: item.unit, delta: "" });
          html = html.replace(
            /<p class="xm-ui-stat-card__value">[\s\S]*?<\/p>/,
            '<p class="xm-ui-stat-card__value"><input class="xm-ui-select" style="width:8em" data-kpi="' +
              esc(item.key) +
              '" value="' +
              esc(item.value) +
              '" placeholder="' +
              esc(item.placeholder || "—") +
              '" aria-label="' +
              esc(item.label) +
              '">' +
              (item.unit ? "<small>" + esc(item.unit) + "</small>" : "") +
              "</p>"
          );
          html = html.replace(
            /<p class="xm-ui-stat-card__note[\s\S]*?<\/p>/,
            '<p class="xm-ui-stat-card__note">' +
              esc(item.hint) +
              ' <input class="xm-ui-select" style="width:5.5em" data-delta="' +
              esc(item.key) +
              '" value="' +
              esc(item.delta) +
              '" placeholder="' +
              esc(computed || "环比") +
              '" aria-label="' +
              esc(item.label) +
              '环比"></p>'
          );
          return html;
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
      '<select class="xm-ui-select" style="width:100%" data-list="' +
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

  function fieldControl(key, index, name, placeholder) {
    var row = (rowsOf(key)[index] || {});
    var value = row[name] || "";
    if (!state.admin) {
      return esc(value || "—");
    }
    if (key === "levels" && (name === "from" || name === "to")) {
      return levelSelect(key, index, name, value);
    }
    return (
      '<input class="xm-ui-select" style="width:100%;box-sizing:border-box" data-list="' +
      esc(key) +
      '" data-i="' +
      index +
      '" data-f="' +
      esc(name) +
      '" value="' +
      esc(value) +
      '" placeholder="' +
      esc(placeholder) +
      '" aria-label="' +
      esc(placeholder) +
      '">'
    );
  }

  function tableCard(title, key, headers, fields, placeholders) {
    var ui = lib();
    var list = rowsOf(key);
    if (state.admin && !list.length) {
      list = [{}];
    }
    var columns = [];
    if (key === "ranks") {
      columns.push({
        key: "rank",
        label: "名次",
        render: function (_value, row) {
          return String(row._i + 1);
        }
      });
    }
    headers.forEach(function (label, col) {
      columns.push({
        key: fields[col],
        label: label,
        render: function (_value, row) {
          return fieldControl(key, row._i, fields[col], placeholders[col]);
        }
      });
    });
    if (state.admin) {
      columns.push({
        key: "op",
        label: "操作",
        render: function (_value, row) {
          return ui.button({ id: "meet-del-" + key + "-" + row._i, label: "删除", variant: "secondary", size: "small" });
        }
      });
    }
    var body = !list.length
      ? ui.EmptyState({ title: "本月还没填", description: "这一项还没有记录" })
      : ui.DataTable({
          columns: columns,
          rows: list.map(function (row, index) {
            var next = { _i: index };
            fields.forEach(function (name) {
              next[name] = row[name] || "";
            });
            return next;
          })
        });
    var tools = state.admin
      ? '<div class="xm-ui-page-actions">' +
        ui.button({ id: "meet-pick-" + key, label: "导入表格", variant: "secondary", size: "small" }) +
        ui.button({ id: "meet-batch-" + key, label: "批量添加", variant: "secondary", size: "small" }) +
        "</div>"
      : "";
    var batch =
      state.admin && state.batchKey === key
        ? '<textarea class="xm-ui-select" style="width:100%;min-height:96px;box-sizing:border-box" data-paste="' +
          esc(key) +
          '" placeholder="一行一条，逗号分开"></textarea>' +
          ui.button({ id: "meet-apply-" + key, label: "写入", size: "small" })
        : "";
    var add = state.admin ? ui.button({ id: "meet-add-" + key, label: "添加一行", variant: "secondary", size: "small" }) : "";
    return ui.ContentCard({
      title: title,
      content: tools + body + batch + add
    });
  }

  function badgeFor(label, tone) {
    return lib().StatusBadge({ label: label, tone: tone || "neutral" });
  }

  function recordList(compact) {
    var ui = lib();
    var list = state.months || [];
    if (!list.length) {
      return ui.EmptyState({ title: "还没有大会记录", description: "保存本月后会出现在这里" });
    }
    return list
      .slice(0, compact ? 6 : list.length)
      .map(function (item) {
        var stateTone = item.state === "已完成" ? "success" : item.state === "已录入" ? "blue" : "neutral";
        var noteTone = item.note === "记录完整" ? "success" : item.note === "待补充" ? "warning" : "neutral";
        return (
          "<p>" +
          ui.button({
            id: "meet-open-" + item.month,
            label: monthLabel(item.month) + " 月度大会",
            variant: "secondary",
            size: "small"
          }) +
          (item.current ? badgeFor("本月", "blue") : "") +
          badgeFor(item.state, stateTone) +
          (item.note && item.note !== item.state ? badgeFor(item.note, noteTone) : "") +
          " " +
          esc(item.end) +
          "</p>"
        );
      })
      .join("");
  }

  function viewToolbar() {
    var ui = lib();
    var bar = ui.FilterToolbar({
      search: false,
      tabs: [
        { label: "本月大会", value: "board", active: state.view === "board" || state.view === "report" },
        { label: "历史大会", value: "history", active: state.view === "history" },
        { label: "数据对比", value: "compare", active: state.view === "compare" }
      ]
    });
    var month =
      '<label class="xm-ui-field">月份 <input class="xm-ui-select" type="month" lang="zh-CN" data-month="1" value="' +
      esc(state.month) +
      '" aria-label="月份"></label>';
    return bar.replace('<div class="xm-ui-filter-toolbar__controls">', '<div class="xm-ui-filter-toolbar__controls">' + month);
  }

  function aside() {
    var ui = lib();
    var ops = [
      ui.button({ id: "meet-template-side", label: "下载导入模板", variant: "secondary", size: "small" }),
      state.admin ? ui.button({ id: "meet-import-side", label: "批量导入数据", variant: "secondary", size: "small" }) : "",
      ui.button({ id: "meet-report", label: "预览大会报告", variant: "secondary", size: "small" }),
      ui.button({ id: "meet-ppt", label: "生成大会PPT", variant: "secondary", size: "small" })
    ].join("");
    return (
      '<div class="xm-ui-stack">' +
      ui.ContentCard({ title: "大会记录", action: "查看全部", content: recordList(true) }) +
      ui.ContentCard({ title: "快速操作", content: '<div class="xm-ui-page-actions">' + ops + "</div>" }) +
      "</div>"
    );
  }

  function formPanel() {
    return (
      '<div class="xm-ui-stack">' +
      tableCard("奋斗排名", "ranks", ["姓名", "奋斗时长(小时)", "备注"], ["name", "hours", "note"], ["请输入姓名", "请输入时长", "请输入备注"]) +
      tableCard("新人介绍", "intros", ["姓名", "岗位", "介绍"], ["name", "role", "text"], ["请输入姓名", "请输入岗位", "请输入一句话介绍"]) +
      tableCard("职级调整", "levels", ["姓名", "原职级", "新职级", "说明"], ["name", "from", "to", "note"], ["请输入姓名", "请选择", "请选择", "请输入说明"]) +
      tableCard("个人目标", "goals", ["姓名", "目标"], ["name", "text"], ["请输入姓名", "请输入本月目标（如：销售额、利润、ROI等）"]) +
      tableCard("优秀员工", "stars", ["姓名", "事迹（表彰理由）"], ["name", "reason"], ["请输入姓名", "请输入表彰理由（如：业绩突出，增长最快、团队贡献等）"]) +
      "</div>"
    );
  }

  function batchPanel() {
    var ui = lib();
    return ui.ContentCard({
      title: "数据导入（批量）",
      description: "把 Excel 另存为 CSV 后导入。导入只写到页面上，点保存本月才会留下。",
      content:
        '<textarea class="xm-ui-select" style="width:100%;min-height:140px;box-sizing:border-box" data-paste="all" placeholder="# 指标&#10;奋斗时长,120&#10;# 奋斗排名&#10;姓名,奋斗时长,备注"></textarea>' +
        ui.button({ id: "meet-apply-all", label: "写入本月", size: "small" })
    });
  }

  function reportBlock() {
    var board = state.board || {};
    function lines(title, rows, format) {
      var body = rows.length
        ? "<ul>" + rows.map(function (row) { return "<li>" + esc(format(row)) + "</li>"; }).join("") + "</ul>"
        : "<p>本月还没填</p>";
      return "<h2>" + esc(title) + "</h2>" + body;
    }
    return (
      "<h1>" +
      esc(monthLabel(state.month) + " 月度大会") +
      "</h1>" +
      kpisOf().map(function (item) { return "<p><b>" + esc(item.label) + "</b> " + esc(pretty(item)) + "</p>"; }).join("") +
      lines("奋斗排名", filledRows(board.ranks, SECTIONS.ranks), function (row) { return (row.name || "—") + " · " + (row.hours || "—") + (row.note ? " · " + row.note : ""); }) +
      lines("新人介绍", filledRows(board.intros, SECTIONS.intros), function (row) { return (row.name || "—") + " · " + (row.role || "—") + (row.text ? " · " + row.text : ""); }) +
      lines("职级调整", filledRows(board.levels, SECTIONS.levels), function (row) { return (row.name || "—") + " · " + (row.from || "—") + " → " + (row.to || "—"); }) +
      lines("个人目标", filledRows(board.goals, SECTIONS.goals), function (row) { return (row.name || "—") + " · " + (row.text || "—"); }) +
      lines("优秀员工", filledRows(board.stars, SECTIONS.stars), function (row) { return (row.name || "—") + " · " + (row.reason || "—"); })
    );
  }

  function reportPanel() {
    var ui = lib();
    var board = state.board || {};
    function card(title, columns, rows) {
      return ui.ContentCard({
        title: title,
        content: rows.length ? ui.DataTable({ columns: columns, rows: rows }) : ui.EmptyState({ title: "本月还没填" })
      });
    }
    return (
      '<div class="xm-ui-stack">' +
      ui.ContentCard({
        title: monthLabel(state.month) + " 月度大会",
        content: kpisOf().map(function (item) { return "<p><b>" + esc(item.label) + "</b> " + esc(pretty(item)) + "</p>"; }).join("")
      }) +
      card("奋斗排名", [
        { key: "name", label: "姓名" },
        { key: "hours", label: "奋斗时长(小时)" },
        { key: "note", label: "备注" }
      ], filledRows(board.ranks, SECTIONS.ranks)) +
      card("新人介绍", [
        { key: "name", label: "姓名" },
        { key: "role", label: "岗位" },
        { key: "text", label: "介绍" }
      ], filledRows(board.intros, SECTIONS.intros)) +
      card("职级调整", [
        { key: "name", label: "姓名" },
        { key: "from", label: "原职级" },
        { key: "to", label: "新职级" },
        { key: "note", label: "说明" }
      ], filledRows(board.levels, SECTIONS.levels)) +
      card("个人目标", [
        { key: "name", label: "姓名" },
        { key: "text", label: "目标" }
      ], filledRows(board.goals, SECTIONS.goals)) +
      card("优秀员工", [
        { key: "name", label: "姓名" },
        { key: "reason", label: "事迹（表彰理由）" }
      ], filledRows(board.stars, SECTIONS.stars)) +
      "</div>"
    );
  }

  function comparePanel() {
    var ui = lib();
    var prevLabel = monthLabel(shiftMonth(state.month, -1));
    return ui.ContentCard({
      title: "数据对比",
      description: monthLabel(state.month) + " 对比 " + prevLabel,
      content: ui.DataTable({
        columns: [
          { key: "label", label: "指标" },
          { key: "now", label: "本月" },
          { key: "prev", label: "上月" },
          { key: "delta", label: "变化" }
        ],
        rows: kpisOf().map(function (item) {
          var prevItem = ((state.prev && state.prev.kpis) || []).filter(function (row) { return row.key === item.key; })[0] || { value: "" };
          return {
            label: item.label,
            now: pretty(item),
            prev: prevItem.value || "—",
            delta: deltaOf(item) || "—"
          };
        })
      })
    });
  }

  function mainColumn() {
    var ui = lib();
    if (state.view === "history") {
      return ui.ContentCard({ title: "历史大会", content: recordList(false) });
    }
    if (state.view === "compare") {
      return comparePanel();
    }
    if (state.view === "report") {
      return reportPanel();
    }
    var tabs = ui.FilterToolbar({
      search: false,
      tabs: [
        { label: "数据录入", value: "form", active: state.entry !== "batch" },
        { label: "数据导入（批量）", value: "batch", active: state.entry === "batch" }
      ]
    });
    return tabs + (state.entry === "batch" ? batchPanel() : formPanel());
  }

  function paint(root) {
    var retired = document.getElementById("meet-page-style");
    if (retired) {
      retired.remove();
    }
    var ui = lib();
    if (!ui) {
      root.innerHTML = '<div class="xm-ui-scope"><p>页面组件没有加载</p></div>';
      return;
    }
    var actions = state.admin
      ? [
          { id: "meet-import", label: "导入数据", variant: "secondary" },
          { id: "meet-template", label: "下载模板", variant: "secondary" },
          { id: "meet-save", label: "保存本月", disabled: state.saving },
          { id: "meet-new", label: "新建大会记录", variant: "secondary" }
        ]
      : [{ id: "meet-template", label: "下载模板", variant: "secondary" }];
    var header = ui.PageContentHeader({
      title: "月度大会（会议档案）",
      description: "统一记录月度大会的核心数据：奋斗排名、BI利润、新人介绍、职级调整、个人目标、优秀员工等，沉淀团队成长档案。",
      actions: actions
    });
    if (!state.admin) {
      header = header.replace("</div></header>", badgeFor("只读", "neutral") + "</div></header>");
    }
    var message = state.msg
      ? "<p>" + (state.error ? ui.StatusBadge({ label: state.msg, tone: "danger" }) : esc(state.msg)) + "</p>"
      : "";
    root.innerHTML =
      '<div class="xm-ui-scope">' +
      header +
      viewToolbar() +
      message +
      (state.view === "board" || state.view === "report" ? kpiCards() : "") +
      '<div class="xm-ui-layout-grid"><div class="xm-ui-stack">' +
      mainColumn() +
      "</div>" +
      aside() +
      '</div><input type="file" accept=".csv,.txt,text/csv,text/plain" data-file="all" hidden></div>';
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
    return "<!DOCTYPE html><html lang=\"zh-CN\"><head><meta charset=\"utf-8\"><title>" + esc(title) + "</title></head><body>" + reportBlock() + "</body></html>";
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

  function buttonId(event) {
    var button = event.target.closest("button");
    return button && button.id ? button.id : "";
  }

  function remember(root) {
    if (state.admin) {
      state.board = collect(root);
    }
  }

  function onClick(root, event) {
    var tab = event.target.closest("[data-xm-ui-tab]");
    if (tab) {
      var value = tab.getAttribute("data-xm-ui-tab");
      remember(root);
      state.msg = "";
      if (value === "form" || value === "batch") {
        state.entry = value;
        state.view = "board";
      } else {
        state.view = value;
      }
      paint(root);
      return;
    }
    var textAction = event.target.closest(".xm-ui-text-action");
    if (textAction && textAction.textContent.indexOf("查看全部") >= 0) {
      remember(root);
      state.view = "history";
      state.msg = "";
      paint(root);
      return;
    }
    var id = buttonId(event);
    if (!id) {
      return;
    }
    var add = id.match(/^meet-add-(ranks|intros|levels|goals|stars)$/);
    if (add && state.admin) {
      var current = collect(root);
      var visible = root.querySelectorAll('[data-list="' + add[1] + '"][data-f="name"]').length;
      current[add[1]] = current[add[1]] || [];
      while (current[add[1]].length < visible) {
        current[add[1]].push({});
      }
      current[add[1]] = current[add[1]].concat([{}]);
      state.board = current;
      paint(root);
      return;
    }
    var del = id.match(/^meet-del-(ranks|intros|levels|goals|stars)-(\d+)$/);
    if (del && state.admin) {
      var next = collect(root);
      var index = Number(del[2]);
      next[del[1]] = (next[del[1]] || []).filter(function (_row, rowIndex) { return rowIndex !== index; });
      state.board = next;
      paint(root);
      return;
    }
    var batch = id.match(/^meet-batch-(ranks|intros|levels|goals|stars)$/);
    if (batch && state.admin) {
      state.board = collect(root);
      state.batchKey = state.batchKey === batch[1] ? "" : batch[1];
      paint(root);
      return;
    }
    var apply = id.match(/^meet-apply-(ranks|intros|levels|goals|stars|all)$/);
    if (apply && state.admin) {
      var section = apply[1];
      var paste = root.querySelector('[data-paste="' + section + '"]');
      applyParsed(root, parseLines(paste ? paste.value : "", section), section);
      return;
    }
    var pick = id.match(/^meet-pick-(ranks|intros|levels|goals|stars)$/);
    if (pick && state.admin) {
      var input = root.querySelector("[data-file]");
      if (input) {
        input.setAttribute("data-file", pick[1]);
        input.value = "";
        input.click();
      }
      return;
    }
    if (id.indexOf("meet-open-") === 0) {
      state.view = "board";
      state.msg = "";
      load(root, id.slice("meet-open-".length));
      return;
    }
    if (id === "meet-template" || id === "meet-template-side") {
      download("月度大会导入模板.csv", templateText(), "text/csv;charset=utf-8");
      return;
    }
    if ((id === "meet-import" || id === "meet-import-side") && state.admin) {
      var file = root.querySelector("[data-file]");
      if (file) {
        file.setAttribute("data-file", "all");
        file.value = "";
        file.click();
      }
      return;
    }
    if (id === "meet-new" && state.admin) {
      state.view = "board";
      load(root, shiftMonth(state.month, 1));
      return;
    }
    if (id === "meet-report") {
      remember(root);
      state.view = "report";
      state.msg = "";
      paint(root);
      return;
    }
    if (id === "meet-ppt") {
      remember(root);
      download("月度大会-" + state.month + ".html", reportHtml(), "text/html;charset=utf-8");
      state.error = false;
      state.msg = "已下载大会页面，可用浏览器打开";
      paint(root);
      return;
    }
    if (id !== "meet-save" || !state.admin) {
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
      var retired = document.getElementById("meet-page-style");
      if (retired) {
        retired.remove();
      }
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
