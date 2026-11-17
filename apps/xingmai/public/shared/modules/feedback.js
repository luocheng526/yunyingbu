/* xm-module-feedback — 需求与反馈工作台：统计、类型分布、流程、列表。 */
(function () {
  var TYPES = [
    { id: "feature", label: "功能需求", color: "var(--xm-ui-primary)" },
    { id: "suggest", label: "优化建议", color: "var(--xm-ui-green)" },
    { id: "issue", label: "问题反馈", color: "var(--xm-ui-orange)" },
    { id: "other", label: "其他需求", color: "var(--xm-ui-text-muted)" }
  ];
  var STATUSES = {
    review: { label: "待评审", color: "#f5a524" },
    doing: { label: "开发中", color: "#2f6bff" },
    accept: { label: "待验收", color: "#7c5cfc" },
    closed: { label: "已完成", color: "#22a06b" },
    mine: { label: "待我处理", color: "#f04452" },
    rejected: { label: "驳回", color: "#f04452" }
  };
  var TABS = [
    { id: "all", label: "全部需求" },
    { id: "review", label: "待评审" },
    { id: "doing", label: "开发中" },
    { id: "accept", label: "待验收" },
    { id: "closed", label: "已完成" }
  ];
  var MODULES = ["商品管理", "店铺维护", "京仓管理", "数据分析", "工作汇报", "组织中心", "智能人事", "月度大会", "其他"];
  var PAGE_SIZE = 20;
  var state = {
    help: false,
    composing: false,
    tab: "all",
    type: "",
    priority: "",
    draftType: "",
    draftPriority: "",
    draftQ: "",
    query: "",
    page: 1,
    title: "",
    body: "",
    note: "",
    reqType: "feature",
    formPriority: "P2",
    moduleName: "",
    dueOn: "",
    shot: "",
    shotLabel: "",
    admin: false,
    items: [],
    openId: 0,
    notes: {},
    progress: {},
    picked: {},
    msg: "",
    error: false,
    saving: false,
    loaded: false,
    loadError: false
  };

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function ui() {
    return window.XmUI;
  }

  function ensureStyle() {
    var style = document.getElementById("fb-page-style");
    if (!style) {
      style = document.createElement("style");
      style.id = "fb-page-style";
      document.head.appendChild(style);
    }
    style.textContent =
      ".xm-ui-scope .fb-msg{min-height:18px;margin:0 0 12px;color:var(--xm-ui-text-muted);font-size:13px;}" +
      ".xm-ui-scope .fb-msg.is-error{color:var(--xm-ui-red);}" +
      ".xm-ui-scope .fb-form{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;}" +
      ".xm-ui-scope .fb-form .xm-ui-field{display:flex;flex-direction:column;align-items:stretch;}" +
      ".xm-ui-scope .fb-form .xm-ui-select,.xm-ui-scope .fb-ops .xm-ui-select{width:100%;box-sizing:border-box;}" +
      ".xm-ui-scope .fb-form .wide{grid-column:1 / -1;}" +
      ".xm-ui-scope textarea.xm-ui-select{height:auto;min-height:88px;padding:8px 10px;resize:vertical;}" +
      ".xm-ui-scope .fb-form-ops{grid-column:1 / -1;display:flex;justify-content:flex-end;gap:8px;}" +
      ".xm-ui-scope .fb-dist{display:flex;justify-content:center;min-height:180px;}" +
      ".xm-ui-scope .fb-donut{width:148px;height:148px;border-radius:50%;position:relative;}" +
      ".xm-ui-scope .fb-donut-hole{position:absolute;inset:34px;border-radius:50%;background:var(--xm-ui-surface);display:flex;flex-direction:column;align-items:center;justify-content:center;}" +
      ".xm-ui-scope .fb-donut-hole b{font-size:27px;line-height:1;font-weight:750;color:var(--xm-ui-text);}" +
      ".xm-ui-scope .fb-donut-hole span{margin-top:4px;color:var(--xm-ui-text-muted);font-size:12px;}" +
      ".xm-ui-scope .fb-flow{display:flex;align-items:flex-start;gap:8px;}" +
      ".xm-ui-scope .fb-step{flex:1;min-width:0;text-align:center;}" +
      ".xm-ui-scope .fb-step .xm-ui-icon{width:22px;height:22px;color:var(--xm-ui-primary);}" +
      ".xm-ui-scope .fb-step b{display:block;margin-top:8px;color:var(--xm-ui-text);font-size:13px;}" +
      ".xm-ui-scope .fb-step span{display:block;margin-top:4px;color:var(--xm-ui-text-muted);font-size:12px;line-height:1.45;}" +
      ".xm-ui-scope .fb-arrow{margin-top:2px;color:var(--xm-ui-text-muted);flex:none;}" +
      ".xm-ui-scope .fb-foot{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-top:12px;color:var(--xm-ui-text-secondary);font-size:13px;}" +
      ".xm-ui-scope .fb-pager{display:flex;flex-wrap:wrap;gap:8px;align-items:center;}" +
      ".xm-ui-scope .fb-progress{width:88px;display:inline-block;vertical-align:middle;margin:0 6px 0 0;}" +
      ".xm-ui-scope .fb-detail{display:grid;grid-template-columns:1.4fr .8fr;gap:16px;}" +
      ".xm-ui-scope .fb-detail p{margin:0 0 8px;white-space:pre-wrap;line-height:1.5;color:var(--xm-ui-text);}" +
      ".xm-ui-scope .fb-meta{display:flex;flex-direction:column;gap:4px;color:var(--xm-ui-text-secondary);font-size:13px;}" +
      ".xm-ui-scope .fb-shot{width:100%;max-height:180px;object-fit:contain;border-radius:8px;background:var(--xm-ui-bg);}" +
      ".xm-ui-scope .fb-ops{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:12px;}" +
      ".xm-ui-scope .fb-ops .xm-ui-select{width:auto;}" +
      "@media (max-width:1100px){.xm-ui-scope .fb-form,.xm-ui-scope .fb-detail,.xm-ui-scope .fb-flow{display:grid;grid-template-columns:1fr;}}";
  }

  function typeOf(id) {
    for (var i = 0; i < TYPES.length; i += 1) {
      if (TYPES[i].id === id) {
        return TYPES[i];
      }
    }
    return TYPES[0];
  }

  function statusOf(id) {
    return STATUSES[id] || { label: id || "待评审", color: "#7c8aa5" };
  }

  function countStatus(id) {
    return state.items.filter(function (item) {
      return item.status === id;
    }).length;
  }

  function matched() {
    var q = state.query.trim().toLowerCase();
    return state.items.filter(function (item) {
      if (state.tab !== "all" && item.status !== state.tab) {
        return false;
      }
      if (state.type && item.reqType !== state.type) {
        return false;
      }
      if (state.priority && item.priority !== state.priority) {
        return false;
      }
      if (!q) {
        return true;
      }
      var blob = [item.title, item.body, item.authorName, item.moduleName].join(" ").toLowerCase();
      return blob.indexOf(q) >= 0;
    });
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
      return res.text().then(function (text) {
        var data = {};
        if (text) {
          try {
            data = JSON.parse(text);
          } catch (err) {
            data = { error: "响应无法读取" };
          }
        }
        return { httpOk: res.ok, data: data };
      });
    }).catch(function () {
      return { httpOk: false, data: { error: "网络异常" } };
    });
  }

  function withAttr(html, attrs) {
    return html.replace("<button ", "<button " + attrs + " ");
  }

  function toneForStatus(id) {
    if (id === "doing") return "blue";
    if (id === "accept") return "purple";
    if (id === "closed") return "success";
    if (id === "review") return "warning";
    if (id === "mine" || id === "rejected") return "danger";
    return "neutral";
  }

  function toneForType(id) {
    if (id === "feature") return "blue";
    if (id === "suggest") return "success";
    if (id === "issue") return "warning";
    return "neutral";
  }

  function toneForPriority(id) {
    if (id === "P0") return "danger";
    if (id === "P1") return "warning";
    return "neutral";
  }

  function kpis() {
    return ui().StatCard({ label: "全部需求", value: String(state.items.length), unit: "条", icon: "file", tone: "blue" }) +
      ui().StatCard({ label: "开发中", value: String(countStatus("doing")), unit: "条", icon: "play", tone: "green" }) +
      ui().StatCard({ label: "已完成", value: String(countStatus("closed")), unit: "条", icon: "check", tone: "purple" }) +
      ui().StatCard({ label: "待我处理", value: String(countStatus("mine")), unit: "条", icon: "award", tone: "orange" });
  }

  function donut() {
    var total = state.items.length;
    var parts = TYPES.map(function (type) {
      return { type: type, n: state.items.filter(function (item) { return item.reqType === type.id; }).length };
    });
    var gradient = "var(--xm-ui-border)";
    if (total) {
      var cursor = 0;
      gradient = parts.map(function (part) {
        var start = cursor;
        cursor += (part.n / total) * 100;
        return part.type.color + " " + start.toFixed(2) + "% " + cursor.toFixed(2) + "%";
      }).join(",");
    }
    return ui().ChartCard({
      title: "需求类型分布",
      ariaLabel: "需求类型分布",
      legend: parts.map(function (part) {
        var pct = total ? ((part.n / total) * 100).toFixed(1) : "0.0";
        return { label: part.type.label + " " + part.n + " · " + pct + "%", color: part.type.color };
      }),
      content: '<div class="fb-dist"><div class="fb-donut" style="background:conic-gradient(' + gradient + ')"><div class="fb-donut-hole"><b>' + total + "</b><span>总需求</span></div></div></div>"
    });
  }

  function flow() {
    var steps = [
      ["提交需求", "员工提出需求或反馈", "file"],
      ["需求评审", "产品/技术评估可行性", "users"],
      ["排期开发", "进入开发迭代计划", "chart"],
      ["开发实现", "开发与内部测试", "play"],
      ["验收上线", "上线发布并通知", "check"]
    ];
    return ui().ContentCard({
      title: "需求处理流程",
      content: '<div class="fb-flow">' + steps.map(function (step, index) {
        return (index ? '<span class="fb-arrow" aria-hidden="true">›</span>' : "") + '<div class="fb-step">' + ui().icon(step[2]) + "<b>" + step[0] + "</b><span>" + step[1] + "</span></div>";
      }).join("") + "</div>"
    });
  }

  function pager(total) {
    var pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (state.page > pages) {
      state.page = pages;
    }
    var buttons = "";
    var start = Math.max(1, state.page - 2);
    var end = Math.min(pages, start + 4);
    for (var i = start; i <= end; i += 1) {
      buttons += withAttr(ui().button({ label: String(i), variant: i === state.page ? "" : "secondary", size: "small" }), 'data-page="' + i + '"');
    }
    return '<div class="fb-foot"><span>共 ' + total + ' 条记录</span><div class="fb-pager"><span>20 条/页</span>' +
      withAttr(ui().button({ label: "‹", variant: "secondary", size: "small" }), 'data-page="' + Math.max(1, state.page - 1) + '"') +
      buttons +
      withAttr(ui().button({ label: "›", variant: "secondary", size: "small" }), 'data-page="' + Math.min(pages, state.page + 1) + '"') +
      "</div></div>";
  }

  function toolbar() {
    var html = ui().FilterToolbar({
      tabs: TABS.map(function (tab) {
        var n = tab.id === "all" ? state.items.length : countStatus(tab.id);
        return { label: tab.label + " (" + n + ")", value: tab.id, active: state.tab === tab.id };
      }),
      filters: [
        {
          label: "需求类型",
          name: "filterType",
          options: [{ value: "all", label: "全部类型" }].concat(TYPES.map(function (type) {
            return { value: type.id, label: type.label };
          }))
        },
        {
          label: "优先级",
          name: "filterPriority",
          options: [
            { value: "all", label: "全部" },
            { value: "P0", label: "P0" },
            { value: "P1", label: "P1" },
            { value: "P2", label: "P2" }
          ]
        }
      ],
      searchPlaceholder: "搜索需求标题/描述/提交人",
      action: "查询"
    });
    html = html.replace('class="xm-ui-button xm-ui-button--small"', 'class="xm-ui-button xm-ui-button--small" data-search="1"');
    return html.replace("</div></div>", ui().button({ label: "导出", variant: "secondary", size: "small", id: "fb-export" }) + "</div></div>");
  }

  function progressCell(value) {
    var n = Math.max(0, Math.min(100, Number(value) || 0));
    return '<span class="xm-ui-progress-card__progress fb-progress"><span style="width:' + n + '%"></span></span>' + n + "%";
  }

  function tableColumns() {
    return [
      { key: "pick", label: "选择", render: function (value) { return value; } },
      { key: "title", label: "需求标题" },
      { key: "reqType", label: "需求类型", type: "status" },
      { key: "priority", label: "优先级", type: "status" },
      { key: "author", label: "提交人" },
      { key: "moduleName", label: "所属模块" },
      { key: "status", label: "当前状态", type: "status" },
      { key: "progress", label: "进度", render: function (value) { return progressCell(value); } },
      { key: "createdAt", label: "提交时间" },
      { key: "dueOn", label: "计划完成" },
      { key: "ops", label: "操作", render: function (value) { return value; } }
    ];
  }

  function table() {
    var list = matched();
    var pageRows = list.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);
    var head = toolbar() + '<div class="xm-ui-spacer-3"></div><label class="xm-ui-field"><input type="checkbox" data-pick-all="1" aria-label="全选本页"> 全选本页</label>';
    var body = "";
    if (!state.loaded) {
      body = ui().EmptyState({ title: "正在加载", description: "正在读取需求列表。" });
    } else if (state.loadError) {
      body = ui().EmptyState({ title: "列表没有加载出来", description: "可以再试一次。", action: "重试" }).replace(
        'class="xm-ui-button xm-ui-button--small"',
        'class="xm-ui-button xm-ui-button--small" data-retry="1"'
      );
    } else if (!pageRows.length) {
      body = ui().DataTable({ columns: tableColumns(), rows: [] }) + ui().EmptyState({ title: "还没有符合条件的需求", description: "换个筛选条件，或提交一条新需求。" }) + pager(list.length);
    } else {
      body = ui().DataTable({
        columns: tableColumns(),
        rows: pageRows.map(function (item) {
          var type = typeOf(item.reqType);
          var status = statusOf(item.status);
          var op = withAttr(ui().button({ label: "查看", variant: "secondary", size: "small" }), 'data-open="' + item.id + '"');
          if (state.admin && item.status !== "closed") {
            op += withAttr(ui().button({ label: item.status === "doing" || item.status === "accept" ? "跟进" : "处理", variant: "secondary", size: "small" }), 'data-open="' + item.id + '"');
          } else if (state.admin) {
            op += withAttr(ui().button({ label: "评价", variant: "secondary", size: "small" }), 'data-open="' + item.id + '"');
          }
          return {
            pick: '<input type="checkbox" data-pick="' + item.id + '"' + (state.picked[item.id] ? " checked" : "") + ' aria-label="选择">',
            title: item.title,
            reqType: { label: type.label, tone: toneForType(item.reqType) },
            priority: { label: item.priority || "P2", tone: toneForPriority(item.priority) },
            author: item.authorName || item.author || "",
            moduleName: item.moduleName || "—",
            status: { label: status.label, tone: toneForStatus(item.status) },
            progress: item.progress,
            createdAt: String(item.createdAt || "").slice(0, 16),
            dueOn: item.dueOn || "—",
            ops: op
          };
        })
      }) + pager(list.length);
    }
    return ui().ContentCard({ title: "需求列表", content: head + body });
  }

  function findItem(id) {
    for (var i = 0; i < state.items.length; i += 1) {
      if (state.items[i].id === id) {
        return state.items[i];
      }
    }
    return null;
  }

  function detail() {
    var item = findItem(state.openId);
    if (!item) {
      return "";
    }
    var type = typeOf(item.reqType);
    var status = statusOf(item.status);
    var shot = item.shot && /^data:image\//.test(item.shot) ? '<img class="fb-shot" alt="需求截图" src="' + esc(item.shot) + '">' : ui().EmptyState({ title: "没有截图", description: "这条需求没有附截图。" });
    var ops = "";
    if (state.admin) {
      var noteValue = state.notes[item.id] != null ? state.notes[item.id] : item.note || "";
      var progressValue = state.progress[item.id] != null ? state.progress[item.id] : item.progress;
      ops = '<div class="fb-ops"><input class="xm-ui-select" data-note-id="' + item.id + '" value="' + esc(noteValue) + '" placeholder="备注说明" aria-label="备注说明"><input class="xm-ui-select" data-progress-id="' +
        item.id + '" type="number" min="0" max="100" value="' + esc(progressValue) + '" aria-label="进度" style="width:88px">' +
        ["review", "doing", "accept", "mine", "closed", "rejected"].map(function (id) {
          if (id === item.status) {
            return "";
          }
          return withAttr(ui().button({ label: statusOf(id).label, variant: "secondary", size: "small" }), 'data-set-status="' + id + '" data-id="' + item.id + '"');
        }).join("") + "</div>";
    }
    return '<div class="xm-ui-spacer-4"></div>' + ui().ContentCard({
      title: item.title,
      content: '<div class="fb-detail"><div><p>' + esc(item.body) + '</p><div class="fb-meta"><div>类型　' + esc(type.label) + "　优先级　" + esc(item.priority) + "　状态　" + esc(status.label) + "</div><div>备注　" + esc(item.note || "暂无") + "</div><div>审核人　经理 " + esc(item.managerName || "未登记") + "　罗成</div></div>" + ops + "</div><div>" + shot + "</div></div>"
    });
  }

  function formHtml() {
    if (!state.composing) {
      return "";
    }
    return ui().ContentCard({
      title: "提交需求/反馈",
      content: '<form class="fb-form" data-compose="1"><label class="xm-ui-field wide">需求标题<input class="xm-ui-select" name="title" maxlength="80" required value="' + esc(state.title) + '" placeholder="一句话写清要做什么"></label><label class="xm-ui-field">需求类型<select class="xm-ui-select" name="reqType">' +
        TYPES.map(function (type) {
          return '<option value="' + type.id + '"' + (state.reqType === type.id ? " selected" : "") + ">" + type.label + "</option>";
        }).join("") +
        '</select></label><label class="xm-ui-field">优先级<select class="xm-ui-select" name="priority"><option' + (state.formPriority === "P0" ? " selected" : "") + '>P0</option><option' + (state.formPriority === "P1" ? " selected" : "") + '>P1</option><option' + (state.formPriority === "P2" ? " selected" : "") + '>P2</option></select></label><label class="xm-ui-field">所属模块<select class="xm-ui-select" name="moduleName"><option value="">请选择</option>' +
        MODULES.map(function (name) {
          return '<option' + (state.moduleName === name ? " selected" : "") + ">" + name + "</option>";
        }).join("") +
        '</select></label><label class="xm-ui-field wide">需求说明<textarea class="xm-ui-select" name="body" maxlength="2000" required placeholder="背景、希望怎么处理">' + esc(state.body) + '</textarea></label><label class="xm-ui-field">计划完成<input class="xm-ui-select" name="dueOn" type="date" value="' + esc(state.dueOn) + '"></label><label class="xm-ui-field">备注<input class="xm-ui-select" name="remark" maxlength="500" value="' + esc(state.note) + '"></label><label class="xm-ui-field">截图<input class="xm-ui-select" name="shot" type="file" accept="image/*"><span data-shot-name>' +
        esc(state.shotLabel || "可选") + "</span></label><div class=\"fb-form-ops\">" +
        ui().button({ label: "取消", variant: "secondary", id: "fb-close-form" }) +
        ui().button({ label: "提交", type: "submit", disabled: state.saving }) +
        "</div></form>"
    }) + '<div class="xm-ui-spacer-4"></div>';
  }

  function helpHtml() {
    if (!state.help) {
      return "";
    }
    return ui().ContentCard({
      title: "使用说明",
      content: "<p>员工提交需求后，先由评审看可行性，再排期开发、实现测试，最后验收上线。罗成可以改状态、进度和备注。审核人是提交人的经理和罗成。其他人只看自己提交的。</p>"
    }) + '<div class="xm-ui-spacer-4"></div>';
  }

  function syncControls(root) {
    var typeSel = root.querySelector("[name=filterType]");
    if (typeSel) typeSel.value = state.draftType || "all";
    var priSel = root.querySelector("[name=filterPriority]");
    if (priSel) priSel.value = state.draftPriority || "all";
    var search = root.querySelector(".xm-ui-search input");
    if (search) search.value = state.draftQ;
  }

  function paint(root) {
    ensureStyle();
    root.classList.add("xm-ui-scope");
    root.innerHTML =
      ui().PageContentHeader({
        title: "需求与反馈",
        description: "收集、跟进和管理产品需求、优化建议与问题反馈，持续提升系统体验",
        actions: [
          { label: "使用说明", variant: "secondary", id: "fb-help" },
          { label: "提交需求/反馈", id: "fb-open-form" }
        ]
      }) +
      '<p class="fb-msg' + (state.error ? " is-error" : "") + '" role="status">' + esc(state.msg) + "</p>" +
      '<div class="xm-ui-stack">' + helpHtml() + formHtml() +
      '<div class="xm-ui-stat-grid">' + kpis() + "</div>" +
      donut() + flow() + table() + "</div>" + detail();
    syncControls(root);
    var opened = root.querySelector(".fb-detail") || root.querySelector("[data-compose]");
    if (opened && opened.scrollIntoView) {
      opened.scrollIntoView({ block: "nearest" });
    }
  }

  function snapshot(root) {
    var title = root.querySelector("[name=title]");
    var body = root.querySelector("[name=body]");
    var remark = root.querySelector("[name=remark]");
    var reqType = root.querySelector("[name=reqType]");
    var priority = root.querySelector("[name=priority]");
    var moduleName = root.querySelector("[name=moduleName]");
    var dueOn = root.querySelector("[name=dueOn]");
    if (title) state.title = title.value;
    if (body) state.body = body.value;
    if (remark) state.note = remark.value;
    if (reqType) state.reqType = reqType.value;
    if (priority) state.formPriority = priority.value;
    if (moduleName) state.moduleName = moduleName.value;
    if (dueOn) state.dueOn = dueOn.value;
  }

  function load(root, keepMsg) {
    return api("/api/feedback/items").then(function (result) {
      state.loaded = true;
      if (!result.httpOk || !result.data || result.data.ok === false) {
        state.loadError = true;
        state.items = [];
        state.error = true;
        state.msg = (result.data && result.data.error) || "列表加载失败";
      } else {
        state.loadError = false;
        state.admin = Boolean(result.data.admin);
        state.items = result.data.items || [];
        if (!keepMsg) {
          state.error = false;
          state.msg = "";
        }
      }
      paint(root);
    });
  }

  function compressShot(file) {
    return new Promise(function (resolve) {
      if (!file || !/^image\//.test(file.type)) {
        resolve("");
        return;
      }
      var reader = new FileReader();
      reader.onerror = function () { resolve(""); };
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var edge = 720;
          var scale = Math.min(1, edge / Math.max(img.width, img.height));
          var canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
          var quality = 0.72;
          var url = canvas.toDataURL("image/jpeg", quality);
          while (url.length > 70000 && quality > 0.4) {
            quality -= 0.08;
            url = canvas.toDataURL("image/jpeg", quality);
          }
          resolve(url.length > 80000 ? "" : url);
        };
        img.onerror = function () { resolve(""); };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function submit(root) {
    snapshot(root);
    if (!state.title.trim() || !state.body.trim()) {
      state.error = true;
      state.msg = "请填写需求标题和说明";
      paint(root);
      return;
    }
    state.saving = true;
    state.error = false;
    state.msg = "正在提交…";
    paint(root);
    api("/api/feedback/items", {
      method: "POST",
      body: JSON.stringify({
        kind: state.reqType === "issue" ? "feedback" : "request",
        reqType: state.reqType,
        priority: state.formPriority,
        moduleName: state.moduleName,
        title: state.title.trim(),
        body: state.body.trim(),
        note: state.note.trim(),
        dueOn: state.dueOn,
        shot: state.shot
      })
    }).then(function (result) {
      state.saving = false;
      if (!result.httpOk || !result.data || result.data.ok === false) {
        state.error = true;
        state.msg = (result.data && result.data.error) || "提交失败";
        state.composing = true;
        paint(root);
        return;
      }
      state.title = "";
      state.body = "";
      state.note = "";
      state.dueOn = "";
      state.shot = "";
      state.shotLabel = "";
      state.composing = false;
      state.tab = "review";
      state.page = 1;
      state.error = false;
      state.msg = "已提交，进入待评审。";
      load(root, true);
    });
  }

  function setStatus(root, id, status) {
    if (!id || state.saving) {
      return;
    }
    var current = findItem(id);
    var note = state.notes[id] != null ? state.notes[id] : current ? current.note || "" : "";
    var progress = state.progress[id] != null ? state.progress[id] : current ? current.progress : "";
    state.saving = true;
    api("/api/feedback/items/" + id, {
      method: "PATCH",
      body: JSON.stringify({ status: status, note: note, progress: progress })
    }).then(function (result) {
      state.saving = false;
      if (!result.httpOk || !result.data || result.data.ok === false) {
        state.error = true;
        state.msg = (result.data && result.data.error) || "更新失败";
        paint(root);
        return;
      }
      state.error = false;
      state.msg = "已更新为" + statusOf(status).label + "。";
      delete state.notes[id];
      delete state.progress[id];
      load(root, true);
    });
  }

  function exportRows() {
    var list = matched().filter(function (item) {
      return !Object.keys(state.picked).length || state.picked[item.id];
    });
    var lines = ["需求标题,需求类型,优先级,提交人,所属模块,当前状态,进度,提交时间,计划完成"];
    list.forEach(function (item) {
      lines.push([item.title, typeOf(item.reqType).label, item.priority, item.authorName, item.moduleName, statusOf(item.status).label, item.progress, item.createdAt, item.dueOn].map(function (cell) {
        return '"' + String(cell == null ? "" : cell).replace(/"/g, '""') + '"';
      }).join(","));
    });
    var blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "需求与反馈.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function onClick(root, event) {
    if (event.target.closest("#fb-help")) {
      state.help = !state.help;
      paint(root);
      return;
    }
    if (event.target.closest("#fb-open-form")) {
      state.composing = true;
      paint(root);
      return;
    }
    if (event.target.closest("#fb-close-form")) {
      state.composing = false;
      paint(root);
      return;
    }
    if (event.target.closest("[data-retry]")) {
      load(root);
      return;
    }
    if (event.target.closest("[data-search]")) {
      state.type = state.draftType;
      state.priority = state.draftPriority;
      state.query = state.draftQ.trim();
      state.page = 1;
      paint(root);
      return;
    }
    if (event.target.closest("#fb-export")) {
      exportRows();
      return;
    }
    var tab = event.target.closest("[data-xm-ui-tab]");
    if (tab) {
      state.tab = tab.getAttribute("data-xm-ui-tab") || "all";
      state.page = 1;
      paint(root);
      return;
    }
    var pageBtn = event.target.closest("[data-page]");
    if (pageBtn) {
      state.page = Number(pageBtn.getAttribute("data-page")) || 1;
      paint(root);
      return;
    }
    var setBtn = event.target.closest("[data-set-status]");
    if (setBtn) {
      setStatus(root, Number(setBtn.getAttribute("data-id")), setBtn.getAttribute("data-set-status"));
      return;
    }
    var openBtn = event.target.closest("[data-open]");
    if (openBtn) {
      var id = Number(openBtn.getAttribute("data-open"));
      state.openId = state.openId === id ? 0 : id;
      paint(root);
    }
  }

  window.XmModules = window.XmModules || {};
  window.XmModules["/feedback"] = {
    mount: function (root) {
      ensureStyle();
      state.msg = "";
      state.error = false;
      paint(root);
      if (!root.__xmFeedbackBound) {
        root.__xmFeedbackBound = true;
        root.addEventListener("click", function (event) {
          onClick(root, event);
        });
        root.addEventListener("input", function (event) {
          var el = event.target;
          if (!el) return;
          if (el.name === "title") state.title = el.value;
          else if (el.name === "body") state.body = el.value;
          else if (el.name === "remark") state.note = el.value;
          else if (el.name === "reqType") state.reqType = el.value;
          else if (el.name === "priority") state.formPriority = el.value;
          else if (el.name === "moduleName") state.moduleName = el.value;
          else if (el.name === "dueOn") state.dueOn = el.value;
          else if (el.closest && el.closest(".xm-ui-search")) state.draftQ = el.value;
          else if (el.hasAttribute("data-note-id")) state.notes[el.getAttribute("data-note-id")] = el.value;
          else if (el.hasAttribute("data-progress-id")) state.progress[el.getAttribute("data-progress-id")] = el.value;
        });
        root.addEventListener("change", function (event) {
          var el = event.target;
          if (!el) return;
          if (el.name === "filterType") {
            state.draftType = el.value === "all" ? "" : el.value;
            return;
          }
          if (el.name === "filterPriority") {
            state.draftPriority = el.value === "all" ? "" : el.value;
            return;
          }
          if (el.hasAttribute("data-pick-all")) {
            matched().slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE).forEach(function (item) {
              if (el.checked) state.picked[item.id] = true;
              else delete state.picked[item.id];
            });
            return;
          }
          if (el.hasAttribute("data-pick")) {
            var id = el.getAttribute("data-pick");
            if (el.checked) state.picked[id] = true;
            else delete state.picked[id];
            return;
          }
          if (el.name === "shot") {
            compressShot(el.files && el.files[0]).then(function (url) {
              state.shot = url;
              state.shotLabel = url ? "已选择截图" : "这张图太大或读不出来";
              var label = root.querySelector("[data-shot-name]");
              if (label) label.textContent = state.shotLabel;
            });
          }
        });
        root.addEventListener("submit", function (event) {
          var form = event.target && event.target.closest ? event.target.closest("[data-compose]") : null;
          if (!form) return;
          event.preventDefault();
          submit(root);
        });
      }
      load(root);
      return function unmount() {
        root.classList.remove("xm-ui-scope");
        root.innerHTML = "";
      };
    }
  };
})();
