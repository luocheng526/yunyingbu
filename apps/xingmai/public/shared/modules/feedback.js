/* xm-module-feedback — 需求与反馈工作台：统计、类型分布、流程、列表。 */
(function () {
  var TYPES = [
    { id: "feature", label: "功能需求", color: "#2f6bff" },
    { id: "suggest", label: "优化建议", color: "#22a06b" },
    { id: "issue", label: "问题反馈", color: "#f5a524" },
    { id: "other", label: "其他需求", color: "#7c8aa5" }
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

  function ensureStyle() {
    if (document.getElementById("fb-page-style")) {
      return;
    }
    var style = document.createElement("style");
    style.id = "fb-page-style";
    style.textContent =
      ".fb-page{color:var(--xm-ink);font-size:13px;}" +
      ".fb-page button:focus-visible,.fb-page input:focus-visible,.fb-page select:focus-visible,.fb-page textarea:focus-visible{outline:2px solid var(--xm-primary);outline-offset:1px;}" +
      ".fb-top{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin:0 0 14px;}" +
      ".fb-brand{display:flex;gap:10px;align-items:flex-start;}" +
      ".fb-logo{width:36px;height:36px;border-radius:10px;background:#2f6bff;color:#fff;display:flex;align-items:center;justify-content:center;flex:none;}" +
      ".fb-page h1{margin:0;font-size:20px;font-weight:700;}" +
      ".fb-sub{margin:4px 0 0;color:var(--xm-muted);font-size:12px;}" +
      ".fb-actions{display:flex;gap:8px;align-items:center;}" +
      ".fb-ghost{height:32px;border:1px solid var(--xm-line);border-radius:8px;background:var(--xm-card);color:var(--xm-ink);padding:0 12px;font:inherit;font-size:13px;cursor:pointer;}" +
      ".fb-primary{height:32px;border:0;border-radius:8px;background:#2f6bff;color:#fff;padding:0 14px;font:inherit;font-size:13px;font-weight:650;cursor:pointer;}" +
      ".fb-primary:disabled{opacity:.6;cursor:default;}" +
      ".fb-msg{min-height:18px;margin:0 0 8px;color:var(--xm-muted);font-size:12px;}" +
      ".fb-msg.is-error{color:#cf1322;}" +
      ".fb-help,.fb-form,.fb-card,.fb-detail{background:var(--xm-card);border:1px solid var(--xm-line);border-radius:12px;box-shadow:var(--xm-shadow);}" +
      ".fb-help{padding:12px 14px;margin:0 0 12px;color:var(--xm-muted);line-height:1.6;}" +
      ".fb-form{padding:14px;margin:0 0 12px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;}" +
      ".fb-field{display:flex;flex-direction:column;gap:4px;color:var(--xm-muted);font-size:12px;}" +
      ".fb-field.wide{grid-column:1 / -1;}" +
      ".fb-field input,.fb-field select,.fb-field textarea{border:1px solid var(--xm-line);border-radius:8px;background:var(--xm-card);color:var(--xm-ink);font:inherit;font-size:13px;padding:6px 8px;}" +
      ".fb-field textarea{min-height:72px;resize:vertical;}" +
      ".fb-form-ops{grid-column:1 / -1;display:flex;justify-content:flex-end;gap:8px;}" +
      ".fb-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:0 0 12px;}" +
      ".fb-kpi{background:var(--xm-card);border:1px solid var(--xm-line);border-radius:12px;box-shadow:var(--xm-shadow);padding:14px 16px;display:flex;justify-content:space-between;gap:8px;align-items:center;min-height:92px;}" +
      ".fb-kpi b{display:block;margin-top:8px;font-size:28px;line-height:1;font-weight:700;}" +
      ".fb-kpi span{display:block;margin-top:6px;color:var(--xm-muted);font-size:12px;}" +
      ".fb-kpi-ico{width:28px;height:28px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;color:#fff;}" +
      ".fb-kpi-ico.blue{background:#2f6bff;}.fb-kpi-ico.green{background:#22a06b;}.fb-kpi-ico.purple{background:#7c5cfc;}.fb-kpi-ico.red{background:#f04452;}" +
      ".fb-spark{width:92px;height:36px;flex:none;}" +
      ".fb-mid{display:grid;grid-template-columns:1fr 1.35fr;gap:12px;margin:0 0 12px;}" +
      ".fb-card{padding:14px 16px;}" +
      ".fb-card h2{margin:0 0 12px;font-size:14px;font-weight:700;display:flex;align-items:center;gap:6px;}" +
      ".fb-card h2 i{width:3px;height:14px;border-radius:2px;background:#2f6bff;display:inline-block;}" +
      ".fb-dist{display:flex;gap:18px;align-items:center;}" +
      ".fb-donut{width:132px;height:132px;border-radius:50%;position:relative;flex:none;}" +
      ".fb-donut-hole{position:absolute;inset:28px;border-radius:50%;background:var(--xm-card);display:flex;flex-direction:column;align-items:center;justify-content:center;}" +
      ".fb-donut-hole b{font-size:22px;line-height:1;}" +
      ".fb-donut-hole span{color:var(--xm-muted);font-size:12px;margin-top:2px;}" +
      ".fb-legend{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px;flex:1;}" +
      ".fb-legend li{display:grid;grid-template-columns:10px 1fr auto auto;gap:8px;align-items:center;}" +
      ".fb-legend i{width:8px;height:8px;border-radius:50%;}" +
      ".fb-legend em{font-style:normal;color:var(--xm-muted);min-width:52px;text-align:right;}" +
      ".fb-flow{display:flex;align-items:flex-start;justify-content:space-between;gap:6px;}" +
      ".fb-step{flex:1;text-align:center;min-width:0;}" +
      ".fb-step-ico{width:42px;height:42px;margin:0 auto 8px;border-radius:50%;background:#eef3ff;color:#2f6bff;display:flex;align-items:center;justify-content:center;}" +
      ".fb-step b{display:block;font-size:13px;}" +
      ".fb-step span{display:block;margin-top:4px;color:var(--xm-muted);font-size:12px;line-height:1.4;}" +
      ".fb-arrow{color:#c5d0e0;margin-top:12px;flex:none;}" +
      ".fb-table-card{padding:0;overflow:hidden;}" +
      ".fb-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:12px 12px 0;}" +
      ".fb-tab{height:30px;border:0;border-radius:8px;background:transparent;color:var(--xm-muted);padding:0 10px;font:inherit;font-size:13px;cursor:pointer;}" +
      ".fb-tab.is-on{background:#2f6bff;color:#fff;}" +
      ".fb-filters{margin-left:auto;display:flex;flex-wrap:wrap;gap:8px;align-items:center;}" +
      ".fb-filters select,.fb-filters input{height:32px;border:1px solid var(--xm-line);border-radius:8px;background:var(--xm-card);color:var(--xm-ink);font:inherit;font-size:13px;padding:0 8px;}" +
      ".fb-filters input{width:210px;}" +
      ".fb-wrap{overflow:auto;}" +
      ".fb-table{width:100%;border-collapse:collapse;font-size:13px;min-width:980px;}" +
      ".fb-table th{text-align:left;color:var(--xm-muted);font-weight:600;padding:10px 8px;border-bottom:1px solid var(--xm-line);background:color-mix(in srgb, var(--xm-ink) 3%, var(--xm-card));white-space:nowrap;}" +
      ".fb-table td{padding:10px 8px;border-bottom:1px solid var(--xm-line);vertical-align:middle;}" +
      ".fb-title{font-weight:650;}" +
      ".fb-pill{display:inline-block;border-radius:6px;padding:1px 8px;font-size:12px;line-height:20px;color:#fff;white-space:nowrap;}" +
      ".fb-pri{display:inline-block;min-width:28px;text-align:center;border-radius:6px;padding:1px 6px;font-size:12px;font-weight:700;color:#fff;}" +
      ".fb-pri.P0{background:#f04452;}.fb-pri.P1{background:#f5a524;}.fb-pri.P2{background:#7c8aa5;}" +
      ".fb-who{display:flex;align-items:center;gap:6px;white-space:nowrap;}" +
      ".fb-av{width:22px;height:22px;border-radius:50%;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:12px;}" +
      ".fb-bar{width:88px;height:6px;border-radius:99px;background:color-mix(in srgb, var(--xm-ink) 8%, transparent);display:inline-block;vertical-align:middle;margin-right:6px;overflow:hidden;}" +
      ".fb-bar i{display:block;height:100%;border-radius:99px;}" +
      ".fb-link{border:0;background:transparent;color:#2f6bff;font:inherit;font-size:13px;cursor:pointer;padding:0 4px;}" +
      ".fb-foot{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:10px 12px;color:var(--xm-muted);}" +
      ".fb-pager{display:flex;gap:6px;align-items:center;}" +
      ".fb-pager button{min-width:28px;height:28px;border:1px solid var(--xm-line);border-radius:6px;background:var(--xm-card);color:var(--xm-ink);font:inherit;cursor:pointer;}" +
      ".fb-pager button.is-on{background:#2f6bff;color:#fff;border-color:#2f6bff;}" +
      ".fb-empty{padding:28px 12px;text-align:center;color:var(--xm-muted);}" +
      ".fb-detail{margin-top:12px;padding:14px;display:grid;grid-template-columns:1.4fr .8fr;gap:12px;}" +
      ".fb-detail h3{margin:0 0 6px;font-size:15px;}" +
      ".fb-detail p{margin:0 0 8px;white-space:pre-wrap;line-height:1.55;}" +
      ".fb-meta{color:var(--xm-muted);font-size:12px;display:flex;flex-direction:column;gap:4px;}" +
      ".fb-shot{width:100%;max-height:180px;object-fit:contain;border-radius:8px;background:color-mix(in srgb, var(--xm-ink) 4%, var(--xm-card));}" +
      ".fb-ops{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:8px;}" +
      ".fb-ops input{height:30px;border:1px solid var(--xm-line);border-radius:6px;background:var(--xm-card);color:var(--xm-ink);padding:0 8px;font:inherit;}" +
      "@media (max-width:1100px){.fb-kpis,.fb-mid,.fb-form,.fb-detail{grid-template-columns:1fr;}.fb-filters{margin-left:0;}}";
    document.head.appendChild(style);
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

  function icon(paths) {
    return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + paths + "</svg>";
  }

  function spark(color) {
    return '<svg class="fb-spark" viewBox="0 0 92 36" aria-hidden="true"><path d="M0 24 C12 24 14 8 26 12 C38 16 40 28 52 20 C64 12 70 6 92 10" fill="none" stroke="' + color + '" stroke-width="2"/></svg>';
  }

  function kpis() {
    var cards = [
      { n: state.items.length, label: "全部需求", tone: "blue", color: "#2f6bff", ico: icon('<rect x="5" y="4" width="14" height="16" rx="2"/><path d="M8 9h8M8 13h8"/>') },
      { n: countStatus("doing"), label: "开发中", tone: "green", color: "#22a06b", ico: icon('<circle cx="12" cy="12" r="7"/><path d="M12 8v4l3 2"/>') },
      { n: countStatus("closed"), label: "已完成", tone: "purple", color: "#7c5cfc", ico: icon('<circle cx="12" cy="12" r="7"/><path d="m9 12 2 2 4-4"/>') },
      { n: countStatus("mine"), label: "待我处理", tone: "red", color: "#f04452", ico: icon('<path d="M12 8v5"/><path d="M12 16h.01"/><circle cx="12" cy="12" r="8"/>') }
    ];
    return '<section class="fb-kpis">' + cards.map(function (card) {
      return '<article class="fb-kpi"><div><span class="fb-kpi-ico ' + card.tone + '">' + card.ico + '</span><b>' + card.n + "</b><span>" + card.label + "</span></div>" + spark(card.color) + "</article>";
    }).join("") + "</section>";
  }

  function donut() {
    var total = state.items.length;
    var parts = TYPES.map(function (type) {
      return { type: type, n: state.items.filter(function (item) { return item.reqType === type.id; }).length };
    });
    var gradient = "#e6ebf2";
    if (total) {
      var cursor = 0;
      gradient = parts.map(function (part) {
        var start = cursor;
        cursor += (part.n / total) * 100;
        return part.type.color + " " + start.toFixed(2) + "% " + cursor.toFixed(2) + "%";
      }).join(",");
    }
    var legend = parts.map(function (part) {
      var pct = total ? ((part.n / total) * 100).toFixed(1) : "0.0";
      return "<li><i style=\"background:" + part.type.color + "\"></i><span>" + part.type.label + "</span><b>" + part.n + "</b><em>" + pct + "%</em></li>";
    }).join("");
    return '<section class="fb-card"><h2><i></i>需求类型分布</h2><div class="fb-dist"><div class="fb-donut" style="background:conic-gradient(' + gradient + ')"><div class="fb-donut-hole"><b>' + total + '</b><span>总需求</span></div></div><ul class="fb-legend">' + legend + "</ul></div></section>";
  }

  function flow() {
    var steps = [
      ["提交需求", "员工提出需求或反馈", icon('<path d="M7 4h8l4 4v12H7z"/><path d="M15 4v4h4"/>')],
      ["需求评审", "产品/技术评估可行性", icon('<circle cx="9" cy="9" r="3"/><circle cx="16" cy="10" r="2"/><path d="M4 18c1-3 3-4 5-4s4 1 5 4"/><path d="M14 18c.4-2 1.6-3 3-3 1 0 2 .4 2.5 1.5"/>')],
      ["排期开发", "进入开发迭代计划", icon('<path d="M8 7h8v10H8z"/><path d="M10 7V5h4v2"/>')],
      ["开发实现", "开发与内部测试", icon('<circle cx="12" cy="12" r="3"/><path d="M12 5v2M12 17v2M5 12h2M17 12h2"/>')],
      ["验收上线", "上线发布并通知", icon('<circle cx="12" cy="12" r="7"/><path d="m9 12 2 2 4-4"/>')]
    ];
    return '<section class="fb-card"><h2><i></i>需求处理流程</h2><div class="fb-flow">' + steps.map(function (step, index) {
      return (index ? '<span class="fb-arrow" aria-hidden="true">›</span>' : "") + '<div class="fb-step"><div class="fb-step-ico">' + step[2] + "</div><b>" + step[0] + "</b><span>" + step[1] + "</span></div>";
    }).join("") + "</div></section>";
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
      buttons += '<button type="button" data-page="' + i + '" class="' + (i === state.page ? "is-on" : "") + '">' + i + "</button>";
    }
    return '<div class="fb-foot"><span>共 ' + total + ' 条记录</span><div class="fb-pager"><span>20 条/页</span><button type="button" data-page="' + Math.max(1, state.page - 1) + '">‹</button>' + buttons + '<button type="button" data-page="' + Math.min(pages, state.page + 1) + '">›</button></div></div>';
  }

  function table() {
    var list = matched();
    var pageRows = list.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);
    var head = '<div class="fb-toolbar">' + TABS.map(function (tab) {
      var n = tab.id === "all" ? state.items.length : countStatus(tab.id);
      return '<button type="button" class="fb-tab' + (state.tab === tab.id ? " is-on" : "") + '" data-tab="' + tab.id + '">' + tab.label + " (" + n + ")</button>";
    }).join("") + '<div class="fb-filters"><label>需求类型 <select data-filter="type"><option value="">全部类型</option>' +
      TYPES.map(function (type) {
        return '<option value="' + type.id + '"' + (state.draftType === type.id ? " selected" : "") + ">" + type.label + "</option>";
      }).join("") +
      '</select></label><label>优先级 <select data-filter="priority"><option value="">全部</option><option value="P0">P0</option><option value="P1">P1</option><option value="P2">P2</option></select></label><input data-q="1" value="' +
      esc(state.draftQ) +
      '" placeholder="搜索需求标题/描述/提交人" aria-label="搜索"><button type="button" class="fb-primary" data-search="1">查询</button><button type="button" class="fb-ghost" data-export="1">导出</button></div></div>';
    if (!state.loaded) {
      return '<section class="fb-card fb-table-card">' + head + '<div class="fb-empty">正在加载…</div></section>';
    }
    if (state.loadError) {
      return '<section class="fb-card fb-table-card">' + head + '<div class="fb-empty">列表没有加载出来 <button type="button" class="fb-link" data-retry="1">重试</button></div></section>';
    }
    if (!pageRows.length) {
      return '<section class="fb-card fb-table-card">' + head + '<div class="fb-empty">还没有符合条件的需求</div>' + pager(list.length) + "</section>";
    }
    var body = pageRows.map(function (item) {
      var type = typeOf(item.reqType);
      var status = statusOf(item.status);
      var progress = Math.max(0, Math.min(100, Number(item.progress) || 0));
      var due = item.dueOn || "—";
      var op = '<button type="button" class="fb-link" data-open="' + item.id + '">查看</button>';
      if (state.admin && item.status !== "closed") {
        op += '<button type="button" class="fb-link" data-open="' + item.id + '">' + (item.status === "doing" || item.status === "accept" ? "跟进" : "处理") + "</button>";
      } else if (state.admin) {
        op += '<button type="button" class="fb-link" data-open="' + item.id + '">评价</button>';
      }
      return "<tr><td><input type=\"checkbox\" data-pick=\"" + item.id + "\"" + (state.picked[item.id] ? " checked" : "") + ' aria-label="选择"></td><td class="fb-title">' +
        esc(item.title) + '</td><td><span class="fb-pill" style="background:' + type.color + '">' + type.label + '</span></td><td><span class="fb-pri ' + esc(item.priority) + '">' +
        esc(item.priority || "P2") + '</span></td><td><span class="fb-who"><span class="fb-av" style="background:' + type.color + '">' +
        esc((item.authorName || "?").slice(0, 1)) + "</span>" + esc(item.authorName || item.author) + "</span></td><td>" +
        esc(item.moduleName || "—") + '</td><td><span class="fb-pill" style="background:' + status.color + '">' + status.label +
        '</span></td><td><span class="fb-bar"><i style="width:' + progress + "%;background:" + status.color + '"></i></span>' + progress +
        "%</td><td>" + esc(String(item.createdAt || "").slice(0, 16)) + "</td><td>" + esc(due) + "</td><td>" + op + "</td></tr>";
    }).join("");
    return '<section class="fb-card fb-table-card">' + head + '<div class="fb-wrap"><table class="fb-table"><thead><tr><th><input type="checkbox" data-pick-all="1" aria-label="全选本页"></th><th>需求标题</th><th>需求类型</th><th>优先级</th><th>提交人</th><th>所属模块</th><th>当前状态</th><th>进度</th><th>提交时间</th><th>计划完成</th><th>操作</th></tr></thead><tbody>' +
      body + "</tbody></table></div>" + pager(list.length) + "</section>";
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
    var shot = item.shot && /^data:image\//.test(item.shot) ? '<img class="fb-shot" alt="需求截图" src="' + esc(item.shot) + '">' : "";
    var ops = "";
    if (state.admin) {
      var noteValue = state.notes[item.id] != null ? state.notes[item.id] : item.note || "";
      var progressValue = state.progress[item.id] != null ? state.progress[item.id] : item.progress;
      ops = '<div class="fb-ops"><input data-note-id="' + item.id + '" value="' + esc(noteValue) + '" placeholder="备注说明" aria-label="备注说明"><input data-progress-id="' +
        item.id + '" type="number" min="0" max="100" value="' + esc(progressValue) + '" aria-label="进度" style="width:72px">' +
        ["review", "doing", "accept", "mine", "closed", "rejected"].map(function (id) {
          if (id === item.status) {
            return "";
          }
          return '<button type="button" class="fb-ghost" data-set-status="' + id + '" data-id="' + item.id + '">' + statusOf(id).label + "</button>";
        }).join("") + "</div>";
    }
    return '<section class="fb-detail"><div><h3>' + esc(item.title) + "</h3><p>" + esc(item.body) + '</p><div class="fb-meta"><div>类型　' + type.label + "　优先级　" + esc(item.priority) + "　状态　" + status.label + "</div><div>备注　" + esc(item.note || "暂无") + "</div><div>审核人　经理 " + esc(item.managerName || "未登记") + "　罗成</div></div>" + ops + "</div><div>" + (shot || '<div class="fb-empty">没有截图</div>') + "</div></section>";
  }

  function formHtml() {
    if (!state.composing) {
      return "";
    }
    return '<form class="fb-form" data-compose="1"><label class="fb-field wide">需求标题<input name="title" maxlength="80" required value="' + esc(state.title) + '" placeholder="一句话写清要做什么"></label><label class="fb-field">需求类型<select name="reqType">' +
      TYPES.map(function (type) {
        return '<option value="' + type.id + '"' + (state.reqType === type.id ? " selected" : "") + ">" + type.label + "</option>";
      }).join("") +
      '</select></label><label class="fb-field">优先级<select name="priority"><option' + (state.formPriority === "P0" ? " selected" : "") + '>P0</option><option' + (state.formPriority === "P1" ? " selected" : "") + '>P1</option><option' + (state.formPriority === "P2" ? " selected" : "") + '>P2</option></select></label><label class="fb-field">所属模块<select name="moduleName"><option value="">请选择</option>' +
      MODULES.map(function (name) {
        return '<option' + (state.moduleName === name ? " selected" : "") + ">" + name + "</option>";
      }).join("") +
      '</select></label><label class="fb-field wide">需求说明<textarea name="body" maxlength="2000" required placeholder="背景、希望怎么处理">' + esc(state.body) + '</textarea></label><label class="fb-field">计划完成<input name="dueOn" type="date" value="' + esc(state.dueOn) + '"></label><label class="fb-field">备注<input name="remark" maxlength="500" value="' + esc(state.note) + '"></label><label class="fb-field">截图<input name="shot" type="file" accept="image/*"><span data-shot-name>' +
      esc(state.shotLabel || "可选") + '</span></label><div class="fb-form-ops"><button type="button" class="fb-ghost" data-close-form="1">取消</button><button type="submit" class="fb-primary"' + (state.saving ? " disabled" : "") + ">提交</button></div></form>";
  }

  function paint(root) {
    ensureStyle();
    root.innerHTML =
      '<main class="page fb-page"><div class="fb-top"><div class="fb-brand"><span class="fb-logo" aria-hidden="true">' +
      icon('<path d="M6 7h12v8H9l-3 3z"/>') +
      '</span><div><h1>需求与反馈</h1><p class="fb-sub">收集、跟进和管理产品需求、优化建议与问题反馈，持续提升系统体验</p></div></div><div class="fb-actions"><button type="button" class="fb-ghost" data-help="1">使用说明</button><button type="button" class="fb-primary" data-open-form="1">+ 提交需求/反馈</button></div></div><p class="fb-msg' +
      (state.error ? " is-error" : "") + '" role="status">' + esc(state.msg) + "</p>" +
      (state.help ? '<section class="fb-help">员工提交需求后，先由评审看可行性，再排期开发、实现测试，最后验收上线。罗成可以改状态、进度和备注。审核人是提交人的经理和罗成。其他人只看自己提交的。</section>' : "") +
      formHtml() + kpis() + '<div class="fb-mid">' + donut() + flow() + "</div>" + table() + detail() + "</main>";
    var priority = root.querySelector('[data-filter="priority"]');
    if (priority) {
      priority.value = state.draftPriority;
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
    if (event.target.closest("[data-help]")) {
      state.help = !state.help;
      paint(root);
      return;
    }
    if (event.target.closest("[data-open-form]")) {
      state.composing = true;
      paint(root);
      return;
    }
    if (event.target.closest("[data-close-form]")) {
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
    if (event.target.closest("[data-export]")) {
      exportRows();
      return;
    }
    var tab = event.target.closest("[data-tab]");
    if (tab) {
      state.tab = tab.getAttribute("data-tab") || "all";
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
          else if (el.hasAttribute("data-q")) state.draftQ = el.value;
          else if (el.hasAttribute("data-note-id")) state.notes[el.getAttribute("data-note-id")] = el.value;
          else if (el.hasAttribute("data-progress-id")) state.progress[el.getAttribute("data-progress-id")] = el.value;
        });
        root.addEventListener("change", function (event) {
          var el = event.target;
          if (!el) return;
          if (el.getAttribute("data-filter") === "type") {
            state.draftType = el.value;
            return;
          }
          if (el.getAttribute("data-filter") === "priority") {
            state.draftPriority = el.value;
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
        root.innerHTML = "";
      };
    }
  };
})();
