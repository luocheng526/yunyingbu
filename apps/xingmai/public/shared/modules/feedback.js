/* xm-module-feedback — 需求与反馈总览。 */
(function () {
  var TYPES = [
    { id: "feature", label: "功能需求" },
    { id: "suggest", label: "优化建议" },
    { id: "issue", label: "问题反馈" },
    { id: "other", label: "其他需求" }
  ];
  var STATUSES = {
    review: { label: "待评审" },
    doing: { label: "开发中" },
    accept: { label: "待验收" },
    closed: { label: "已完成" },
    mine: { label: "待我处理" },
    rejected: { label: "驳回" }
  };
  var TABS = [{ id: "all", label: "全部需求" }].concat(Object.keys(STATUSES).map(function (id) {
    return { id:id, label:STATUSES[id].label };
  }));
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
    readingShot: false,
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
  var activeMount = null;

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function ui() {
    return window.XmUI;
  }

  function ensureStyle() {
    if (document.getElementById("fb-overview-style")) return;
    var style = document.createElement("style");
    style.id = "fb-overview-style";
    style.textContent = `
      html[data-theme="dark"] .xm-ui-scope.fb-page-active{--xm-ui-bg:var(--xm-bg,#172133);--xm-ui-surface:var(--xm-card,#222d41);--xm-ui-surface-soft:color-mix(in srgb,var(--xm-ui-surface) 93%,white);--xm-ui-border:var(--xm-line,#374560);--xm-ui-border-strong:var(--xm-line,#41516d);--xm-ui-text:var(--xm-ink,#ebf0ff);--xm-ui-text-secondary:var(--xm-muted,#b5c3dc);--xm-ui-text-muted:var(--xm-muted,#b5c3dc);--xm-ui-primary:#88b8ff;--xm-ui-primary-soft:#263d63}
      html[data-theme="pink"] .xm-ui-scope.fb-page-active{--xm-ui-bg:var(--xm-bg,#fff1f6);--xm-ui-primary:var(--xm-primary,#bd426a);--xm-ui-primary-hover:var(--xm-primary-hover,#a83b5d);--xm-ui-primary-soft:var(--xm-primary-soft,#fce8ef)}
      .fb-overview{--fb-ink:var(--xm-ui-text,#172c4a);--fb-muted:var(--xm-ui-text-secondary,#536782);--fb-surface:var(--xm-ui-surface,#fff);--fb-line:var(--xm-ui-border,#dce6f4);--fb-blue:var(--xm-ui-primary,#126ff0);--fb-soft:color-mix(in srgb,var(--fb-blue) 8%,var(--fb-surface));--fb-quiet:color-mix(in srgb,var(--fb-blue) 4%,var(--fb-surface));color:var(--fb-ink);display:grid;gap:14px;min-width:0;padding:12px 0 20px;container-type:inline-size}
      .fb-overview *{box-sizing:border-box}
      .fb-overview :where(h1,h2,h3,p,ul,ol,dl){margin:0}
      .fb-overview :where(button,input,select,textarea):focus-visible{outline:2px solid var(--fb-blue);outline-offset:2px}
      .fb-overview .fb-intro{position:relative;isolation:isolate;overflow:hidden;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;min-height:105px;padding:17px 19px;border:1px solid var(--fb-line);border-radius:13px;background:linear-gradient(107deg,var(--fb-quiet),color-mix(in srgb,var(--fb-blue) 15%,var(--fb-surface)) 65%,color-mix(in srgb,#9279e8 15%,var(--fb-surface)))}
      .fb-overview .fb-intro::after{content:"";position:absolute;z-index:-1;width:330px;height:260px;right:12%;top:-145px;border-radius:50%;border:1px solid color-mix(in srgb,var(--fb-surface) 75%,transparent);box-shadow:0 0 0 22px color-mix(in srgb,var(--fb-surface) 37%,transparent),0 0 0 47px color-mix(in srgb,var(--fb-surface) 22%,transparent);pointer-events:none}
      .fb-overview .fb-intro h1{font-size:30px;font-weight:700;letter-spacing:-.035em;line-height:1.2}
      .fb-overview .fb-intro p{margin-top:5px;font-size:13px;color:var(--fb-muted)}
      .fb-overview .fb-actions{display:flex;align-items:center;flex-wrap:wrap;gap:7px}
      html[data-theme="dark"] .fb-overview .xm-ui-button:not(.xm-ui-button--secondary){background:#2565c2;border-color:#2565c2;color:#fff}
      .fb-overview .fb-panel{background:var(--fb-surface);border:1px solid var(--fb-line);border-radius:12px;min-width:0;box-shadow:0 3px 12px #14377409}
      .fb-overview .fb-layout{display:grid;grid-template-columns:minmax(0,1.9fr) minmax(260px,1fr);gap:12px;align-items:start;min-width:0}
      .fb-overview .fb-side{display:grid;gap:12px;min-width:0}
      .fb-overview .fb-head{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:13px 14px 9px}
      .fb-overview .fb-head h2{font-size:17px;line-height:1.3}
      .fb-overview .fb-subtle{font-size:12px;color:var(--fb-muted)}
      .fb-overview .fb-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
      .fb-overview .fb-kpi{display:flex;align-items:center;min-width:0;gap:10px;min-height:69px;padding:9px 11px;text-align:left;color:var(--fb-ink);cursor:pointer;font:inherit}
      .fb-overview .fb-kpi:hover,.fb-overview .fb-kpi[aria-pressed=true]{border-color:var(--fb-blue);background:var(--fb-quiet)}
      .fb-overview .fb-kpi-icon{display:grid;place-items:center;flex:none;width:34px;height:34px;border-radius:9px;background:color-mix(in srgb,var(--fb-kpi-color) 13%,var(--fb-surface));color:var(--fb-kpi-color)}
      .fb-overview .fb-kpi-icon svg{width:17px;height:17px}
      .fb-overview .fb-kpi-label{display:block;font-size:12px;color:var(--fb-muted)}
      .fb-overview .fb-kpi b{font-size:25px;font-weight:690;line-height:1.15;font-variant-numeric:tabular-nums}
      .fb-overview .fb-kpi-unit{margin-left:4px;font-size:11px;color:var(--fb-muted)}
      .fb-overview .fb-filters{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:0 13px 9px}
      .fb-overview .fb-filters input{flex:1 1 160px;min-width:110px}
      .fb-overview .fb-filters select{max-width:100%}
      .fb-overview .fb-filters :is(input,select),.fb-overview .fb-form :is(input,select,textarea),.fb-overview .fb-ops :is(input,select){min-width:0;max-width:100%}
      .fb-overview .fb-table-wrap{padding:0 12px 9px}
      .fb-overview .fb-table{width:100%;border-collapse:collapse;table-layout:fixed;text-align:left;font-size:13px}
      .fb-overview .fb-table th{font-size:12px;font-weight:500;color:var(--fb-muted);background:var(--fb-quiet)}
      .fb-overview .fb-table :is(th,td){padding:7px 5px}
      .fb-overview .fb-table td{border-bottom:1px solid var(--fb-line)}
      .fb-overview .fb-table tr:last-child td{border-bottom:0}
      .fb-overview .fb-table tbody tr[data-open-row]{cursor:pointer}
      .fb-overview .fb-table tbody tr:hover{background:var(--fb-quiet)}
      .fb-overview .fb-select-col{width:26px}
      .fb-overview .fb-date-col{width:78px}
      .fb-overview .fb-status-col{width:74px}
      .fb-overview .fb-arrow-col{width:16px;color:var(--fb-muted)}
      .fb-overview .fb-table input{margin:0;accent-color:var(--fb-blue);vertical-align:middle}
      .fb-overview .fb-title{display:inline-block;background:none;border:0;padding:2px 0;text-align:left;color:var(--fb-ink);font:inherit;font-weight:650;overflow-wrap:anywhere;cursor:pointer}
      .fb-overview .fb-title:hover{color:var(--fb-blue);text-decoration:underline}
      .fb-overview .fb-row-meta{display:block;font-size:11px;color:var(--fb-muted);overflow-wrap:anywhere}
      .fb-overview .fb-status-col .xm-ui-status-badge{white-space:nowrap}
      .fb-overview .fb-foot{display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap;padding:6px 13px 10px;color:var(--fb-muted);font-size:12px}
      .fb-overview .fb-pager{display:flex;gap:4px;align-items:center;flex-wrap:wrap}
      .fb-overview .fb-empty{padding:13px}
      .fb-overview .fb-category-list{padding:0 9px 8px}
      .fb-overview .fb-category{display:grid;grid-template-columns:68px minmax(20px,1fr) 72px;align-items:center;gap:7px;width:100%;min-height:34px;padding:3px 5px;background:none;border:1px solid transparent;border-radius:6px;text-align:left;font:inherit;font-size:12px;color:var(--fb-ink);cursor:pointer}
      .fb-overview .fb-category:hover,.fb-overview .fb-category[aria-pressed=true]{background:var(--fb-soft);color:var(--fb-blue)}
      .fb-overview .fb-category-total{text-align:right;white-space:nowrap;color:var(--fb-muted);font-variant-numeric:tabular-nums}
      .fb-overview .fb-bar{display:block;height:6px;border-radius:8px;background:var(--fb-soft);overflow:hidden}
      .fb-overview .fb-bar>i{display:block;height:100%;border-radius:inherit;background:var(--fb-blue)}
      .fb-overview .fb-flow{display:flex;flex-wrap:wrap;align-items:center;gap:4px 7px;padding:0 14px 14px;font-size:12px;color:var(--fb-muted)}
      .fb-overview .fb-link{font:inherit;font-size:12px;white-space:nowrap;color:var(--fb-blue);background:none;border:0;border-radius:5px;padding:3px;cursor:pointer}
      .fb-overview .fb-link:hover{text-decoration:underline}
      .fb-overview .fb-msg{margin:0;color:var(--fb-muted);font-size:13px}
      .fb-overview .fb-msg.is-error{color:var(--xm-ui-red,#b23343)}
      .fb-overview .fb-overlay{width:min(580px,calc(100% - 24px));max-height:calc(100dvh - 32px);padding:0;overflow:auto;border:1px solid var(--fb-line);border-radius:12px;background:var(--fb-surface);color:var(--fb-ink);box-shadow:0 16px 45px #142e614d}
      .fb-overview .fb-overlay[data-kind=detail]{margin-inline:auto 16px}
      .fb-overview .fb-overlay::backdrop{background:#12244960}
      .fb-overview .fb-overlay-head{position:sticky;top:0;z-index:1;display:flex;justify-content:space-between;gap:8px;align-items:center;padding:13px 15px;background:var(--fb-surface);border-bottom:1px solid var(--fb-line)}
      .fb-overview .fb-overlay-head h2{font-size:17px}
      .fb-overview .fb-overlay-body{display:grid;gap:12px;padding:15px}
      .fb-overview .fb-overlay-body :where(h3){font-size:14px}
      .fb-overview .fb-detail{display:grid;gap:11px;overflow-wrap:anywhere}
      .fb-overview .fb-detail h3{font-size:18px;line-height:1.3}
      .fb-overview .fb-detail p{white-space:pre-wrap;line-height:1.55}
      .fb-overview .fb-detail .fb-statusline{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
      .fb-overview .fb-detail dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 12px;padding:10px;background:var(--fb-quiet);border-radius:8px;font-size:12px}
      .fb-overview .fb-detail dl div{display:grid;gap:2px}
      .fb-overview .fb-detail dt{color:var(--fb-muted)}
      .fb-overview .fb-detail dd{margin:0;white-space:pre-wrap}
      .fb-overview .fb-progress{width:min(128px,55%);display:inline-block;vertical-align:middle;margin-inline-end:6px}
      .fb-overview .fb-shot{width:100%;max-height:260px;object-fit:contain;border-radius:8px;background:var(--fb-quiet)}
      .fb-overview .fb-ops{display:grid;gap:8px;padding-top:10px;border-top:1px solid var(--fb-line)}
      .fb-overview .fb-ops-fields{display:grid;grid-template-columns:minmax(0,1fr) minmax(75px,108px);gap:8px}
      .fb-overview .fb-form{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
      .fb-overview :is(.fb-form,.fb-ops) .xm-ui-field{display:grid;gap:4px;min-width:0}
      .fb-overview .fb-form .wide,.fb-overview .fb-form-ops{grid-column:1/-1}
      .fb-overview .fb-form textarea{height:auto;min-height:88px;padding:7px 9px;resize:vertical}
      .fb-overview .fb-form-ops{display:flex;justify-content:flex-end;gap:7px}
      .fb-overview .fb-help{display:grid;gap:8px;padding-left:18px}
      @container(max-width:760px){.fb-overview .fb-layout{grid-template-columns:1fr}.fb-overview .fb-side{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @container(max-width:490px){.fb-overview .fb-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.fb-overview .fb-side{grid-template-columns:1fr}.fb-overview .fb-intro{padding:11px}.fb-overview .fb-intro h1{font-size:25px}.fb-overview .fb-date-col{width:59px}.fb-overview .fb-status-col{width:66px}.fb-overview .fb-select-col{width:22px}.fb-overview .fb-arrow-col{width:12px}}
      @media(max-width:540px){.fb-overview .fb-form{grid-template-columns:1fr}.fb-overview .fb-overlay[data-kind=detail]{margin-inline:auto}}
    `;
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
    return STATUSES[id] || { label: id || "待评审" };
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
      var blob = [item.title, item.body, item.authorName, item.moduleName, "#" + item.id].join(" ").toLowerCase();
      return blob.indexOf(q) >= 0 || String(item.id) === q;
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
      signal: init.signal,
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

  function panel(title, content, action) {
    return `<section class="fb-panel"><header class="fb-head"><h2>${title}</h2>${action || ""}</header>${content}</section>`;
  }

  function kpis() {
    var stats = [
      ["all", "全部需求", state.items.length, "file", "var(--fb-blue)"],
      ["doing", "开发中", countStatus("doing"), "play", "var(--xm-ui-green,#188261)"],
      ["closed", "已完成", countStatus("closed"), "check", "var(--xm-ui-green,#188261)"],
      ["mine", "待我处理", countStatus("mine"), "award", "var(--xm-ui-orange,#9b5617)"]
    ];
    return `<section class="fb-kpis" aria-label="按状态筛选需求">${stats.map(function (row) {
      return `<button type="button" class="fb-kpi fb-panel" data-status-filter="${row[0]}" aria-pressed="${state.tab === row[0]}">
        <span class="fb-kpi-icon" style="--fb-kpi-color:${row[4]}" aria-hidden="true">${ui().icon(row[3])}</span>
        <span><span class="fb-kpi-label">${row[1]}</span><b>${row[2]}</b><span class="fb-kpi-unit">条</span></span>
      </button>`;
    }).join("")}</section>`;
  }

  function distribution() {
    var total = state.items.length;
    return panel("需求类型", `<div class="fb-category-list" role="group" aria-label="按需求类型筛选">${TYPES.map(function (type) {
      var count = state.items.filter(function (item) { return item.reqType === type.id; }).length;
      var percent = total ? Math.round(count / total * 1000) / 10 : 0;
      return `<button type="button" class="fb-category" data-type-filter="${type.id}" aria-pressed="${state.type === type.id}" aria-label="${type.label}，${count} 条，占 ${percent}%">
        <span>${type.label}</span><span class="fb-bar" aria-hidden="true"><i style="width:${percent}%"></i></span>
        <span class="fb-category-total">${count} · ${percent}%</span>
      </button>`;
    }).join("")}</div>`, `<span class="fb-subtle">共 ${total} 条</span>`);
  }

  var FLOW = [
    ["提交需求", "填写需求类型、标题和说明，可附截图。"],
    ["需求评审", "由评审人确认场景和可行性。"],
    ["排期开发", "安排优先级与开发计划。"],
    ["开发实现", "开发、测试并提交验收。"],
    ["验收上线", "确认结果并记录完成状态。"]
  ];

  function flow() {
    return panel("处理流程", `<div class="fb-flow">${FLOW.map(function (step, index) {
      return `${index ? '<span aria-hidden="true">›</span>' : ''}<span>${step[0]}</span>`;
    }).join("")}</div>`, '<button class="fb-link" type="button" data-fb-help aria-label="查看处理流程">查看</button>');
  }

  function pager(total) {
    var pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (pages === 1) return "";
    var buttons = [];
    for (var i = Math.max(1, state.page - 2); i <= Math.min(pages, state.page + 2); i += 1) {
      buttons.push(withAttr(ui().button({ label: String(i), variant: i === state.page ? "" : "secondary", size: "small" }),
        `data-page="${i}" aria-label="第 ${i} 页" ${i === state.page ? 'aria-current="page"' : ''}`));
    }
    return `<div class="fb-foot"><span>每页 ${PAGE_SIZE} 条</span><nav class="fb-pager" aria-label="需求列表分页">
      ${withAttr(ui().button({ label:"‹", variant:"secondary", size:"small", disabled:state.page === 1 }), `data-page="${state.page - 1}" aria-label="上一页"`)}
      ${buttons.join("")}
      ${withAttr(ui().button({ label:"›", variant:"secondary", size:"small", disabled:state.page === pages }), `data-page="${state.page + 1}" aria-label="下一页"`)}
    </nav></div>`;
  }

  function option(value, label, selected) {
    return `<option value="${esc(value)}" ${value === selected ? "selected" : ""}>${esc(label)}</option>`;
  }

  function toolbar() {
    return `<form class="fb-filters" data-filter-form aria-label="筛选需求">
      <input class="xm-ui-select" type="search" name="filterQuery" aria-label="搜索需求" placeholder="搜索标题、编号或提交人" value="${esc(state.draftQ)}">
      <select class="xm-ui-select" name="filterStatus" aria-label="需求状态">${TABS.map(function (tab) {
        return option(tab.id, tab.label, state.tab);
      }).join("")}</select>
      <select class="xm-ui-select" name="filterType" aria-label="需求类型">${option("", "全部类型", state.draftType)}${TYPES.map(function (type) {
        return option(type.id, type.label, state.draftType);
      }).join("")}</select>
      <select class="xm-ui-select" name="filterPriority" aria-label="优先级">${option("", "全部优先级", state.draftPriority)}${["P0","P1","P2"].map(function (level) {
        return option(level, level, state.draftPriority);
      }).join("")}</select>
      ${ui().button({ label:"查询", type:"submit", size:"small" })}
      ${ui().button({ label:"导出", variant:"secondary", size:"small", id:"fb-export" })}
    </form>`;
  }

  function progressCell(value) {
    var n = Math.max(0, Math.min(100, Number(value) || 0));
    return `<span class="fb-bar fb-progress" aria-hidden="true"><i style="width:${n}%"></i></span>${n}%`;
  }

  function stamp(value) {
    return String(value || "").replace("T", " ").slice(0, 16) || "—";
  }

  function table() {
    var list = matched();
    state.page = Math.max(1, Math.min(state.page, Math.ceil(list.length / PAGE_SIZE)));
    var pageRows = list.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);
    var body;
    if (!state.loaded) {
      body = '<div class="fb-empty">' + ui().EmptyState({ title:"正在加载", description:"正在读取需求列表。" }) + '</div>';
    } else if (state.loadError) {
      body = '<div class="fb-empty">' + ui().EmptyState({ title:"列表读取失败", description:"可以再试一次。" }) +
        withAttr(ui().button({ label:"重试", variant:"secondary", size:"small" }), 'data-retry') + '</div>';
    } else if (!pageRows.length) {
      var filtered = state.tab !== "all" || state.type || state.priority || state.query;
      body = '<div class="fb-empty">' + ui().EmptyState({ title:filtered ? "当前筛选下暂无需求" : "暂无需求或反馈",
        description:filtered ? "调整筛选条件后再查看。" : "可通过上方按钮提交第一条需求。" }) +
        (filtered ? '<button type="button" class="fb-link" data-clear-filter>清除筛选</button>' : '') + '</div>';
    } else {
      body = `<div class="fb-table-wrap"><table class="fb-table" aria-label="需求列表"><thead><tr>
        <th scope="col" class="fb-select-col"><input type="checkbox" data-pick-all aria-label="全选本页"></th>
        <th scope="col">需求</th><th scope="col" class="fb-date-col">提交日期</th><th scope="col" class="fb-status-col">状态</th><th class="fb-arrow-col" aria-label="详情"></th>
      </tr></thead><tbody>${pageRows.map(function (item) {
        var id = esc(item.id);
        var date = esc(stamp(item.createdAt).slice(0, 10));
        var meta = ["#" + item.id, typeOf(item.reqType).label, item.priority, item.authorName || item.author].filter(Boolean).map(esc).join(" · ");
        return `<tr data-open-row="${id}">
          <td><input type="checkbox" data-pick="${id}" ${state.picked[item.id] ? "checked" : ""} aria-label="选择 ${esc(item.title)}"></td>
          <td><button type="button" class="fb-title" data-open="${id}" aria-haspopup="dialog">${esc(item.title)}</button><span class="fb-row-meta">${meta}</span></td>
          <td class="fb-row-meta-date"><time title="${date}">${date.length === 10 ? date.slice(5).replace("-", "/") : date}</time></td>
          <td class="fb-status-col">${ui().StatusBadge({label:statusOf(item.status).label,tone:toneForStatus(item.status)})}</td>
          <td class="fb-arrow-col" aria-hidden="true">›</td></tr>`;
      }).join("")}</tbody></table></div>` + pager(list.length);
    }
    var count = state.loaded && !state.loadError ? `<span class="fb-subtle">${list.length} 条</span>` : "";
    return panel("需求列表", toolbar() + body, count);
  }

  function findItem(id) {
    for (var i = 0; i < state.items.length; i += 1) {
      if (state.items[i].id === id) {
        return state.items[i];
      }
    }
    return null;
  }

  function detail(item) {
    var id = esc(item.id);
    var noteValue = state.notes[item.id] != null ? state.notes[item.id] : item.note || "";
    var progressValue = state.progress[item.id] != null ? state.progress[item.id] : item.progress;
    var ops = !state.admin ? "" : `<section class="fb-ops"><h3>处理需求</h3><div class="fb-ops-fields">
      <label class="xm-ui-field">处理备注<input class="xm-ui-select" data-note-id="${id}" maxlength="500" value="${esc(noteValue)}"></label>
      <label class="xm-ui-field">进度（%）<input class="xm-ui-select" data-progress-id="${id}" type="number" min="0" max="100" value="${esc(progressValue)}"></label>
      </div><div class="fb-actions">${Object.keys(STATUSES).filter(function (status) {
        return status !== item.status;
      }).map(function (status) {
        return withAttr(ui().button({label:statusOf(status).label,variant:"secondary",size:"small",disabled:state.saving}),
          `data-set-status="${status}" data-id="${id}"`);
      }).join("")}</div></section>`;
    var shot = item.shot && /^data:image\//.test(item.shot) ? `<img class="fb-shot" alt="需求截图" src="${esc(item.shot)}">` : "";
    var fields = [
      ["提交人", item.authorName || item.author], ["优先级", item.priority || "P2"],
      ["所属模块", item.moduleName], ["计划完成", item.dueOn],
      ["提交时间", stamp(item.createdAt)], ["最近更新", stamp(item.updatedAt)],
      ["审核人", "经理 " + (item.managerName || "未登记") + " · 罗成"], ["当前进度", progressCell(item.progress)]
    ];
    return `<article class="fb-detail">
      <div class="fb-statusline"><span class="fb-subtle">#${id} · ${typeOf(item.reqType).label}</span>
        ${ui().StatusBadge({label:statusOf(item.status).label,tone:toneForStatus(item.status)})}</div>
      <h3>${esc(item.title)}</h3><p>${esc(item.body)}</p>
      <dl>${fields.map(function (field) {
        return `<div><dt>${field[0]}</dt><dd>${field[0] === "当前进度" ? field[1] : esc(field[1] || "—")}</dd></div>`;
      }).join("")}</dl>
      ${item.note ? `<p><strong>备注</strong><br>${esc(item.note)}</p>` : ""}${shot}${ops}
    </article>`;
  }

  function formHtml() {
    var disabled = state.saving || state.readingShot;
    return `<form class="fb-form" data-compose>
      <label class="xm-ui-field wide">需求标题<input class="xm-ui-select" name="title" maxlength="80" required value="${esc(state.title)}" placeholder="一句话写清要做什么"></label>
      <label class="xm-ui-field">需求类型<select class="xm-ui-select" name="reqType">${TYPES.map(function (type) {return option(type.id,type.label,state.reqType);}).join("")}</select></label>
      <label class="xm-ui-field">优先级<select class="xm-ui-select" name="priority">${["P0","P1","P2"].map(function (value) {return option(value,value,state.formPriority);}).join("")}</select></label>
      <label class="xm-ui-field">所属模块<select class="xm-ui-select" name="moduleName">${option("","请选择",state.moduleName)}${MODULES.map(function (name) {return option(name,name,state.moduleName);}).join("")}</select></label>
      <label class="xm-ui-field wide">需求说明<textarea class="xm-ui-select" name="body" maxlength="2000" required placeholder="背景、希望怎么处理">${esc(state.body)}</textarea></label>
      <label class="xm-ui-field">计划完成<input class="xm-ui-select" name="dueOn" type="date" value="${esc(state.dueOn)}"></label>
      <label class="xm-ui-field">备注<input class="xm-ui-select" name="remark" maxlength="500" value="${esc(state.note)}"></label>
      <label class="xm-ui-field">截图<input class="xm-ui-select" name="shot" type="file" accept="image/*"><span data-shot-name role="status">${esc(state.shotLabel || "可选")}</span></label>
      <div class="fb-form-ops">${withAttr(ui().button({label:"取消",variant:"secondary",disabled:state.saving}),'data-close-overlay')}${ui().button({label:"提交",type:"submit",disabled:disabled})}</div>
    </form>`;
  }

  function helpHtml() {
    return `<ol class="fb-help">${FLOW.map(function (step) {
      return `<li><strong>${step[0]}</strong><p class="fb-subtle">${step[1]}</p></li>`;
    }).join("")}</ol><p class="fb-subtle">审核人为提交人的经理和罗成。罗成可以更新状态、进度和备注，其他员工可查看自己提交的需求。</p>`;
  }

  function message() {
    return state.msg ? `<p class="fb-msg${state.error ? ' is-error' : ''}" role="${state.error ? 'alert' : 'status'}">${esc(state.msg)}</p>` : "";
  }

  function overlay(kind, title, content) {
    return `<dialog class="fb-overlay" data-kind="${kind}" aria-labelledby="fb-overlay-title"><header class="fb-overlay-head"><h2 id="fb-overlay-title">${title}</h2>
      ${withAttr(ui().button({label:"关闭",variant:"secondary",size:"small",disabled:state.saving}),'data-close-overlay')}</header>
      <div class="fb-overlay-body">${message()}${content}</div></dialog>`;
  }

  function syncPicked(root) {
    var pickAll = root.querySelector("[data-pick-all]");
    if (!pickAll) return;
    var boxes = Array.from(root.querySelectorAll("[data-pick]"));
    var selected = boxes.filter(function (box) { return box.checked; }).length;
    pickAll.checked = selected === boxes.length;
    pickAll.indeterminate = selected > 0 && !pickAll.checked;
  }

  function paint(root, focusSelector) {
    var item = findItem(state.openId);
    var dialog = state.help ? overlay("guide","使用说明",helpHtml())
      : state.composing ? overlay("compose","提交需求/反馈",formHtml())
      : item ? overlay("detail","需求详情",detail(item)) : "";
    var previous = root.querySelector("dialog[open]");
    var dialogScroll = previous && previous.scrollTop;
    if (previous) previous.close();
    root.innerHTML =
      `<div class="fb-overview"><header class="fb-intro"><div><h1>需求与反馈</h1><p>提交需求、反馈问题，查看处理进度</p></div><div class="fb-actions">
        ${ui().button({label:"使用说明",variant:"secondary",id:"fb-help"})}${ui().button({label:"提交需求/反馈",id:"fb-open-form"})}
      </div></header>${dialog ? "" : message()}${kpis()}<div class="fb-layout">${table()}<aside class="fb-side" aria-label="类型与流程">${distribution()}${flow()}</aside></div>${dialog}</div>`;
    syncPicked(root);
    var current = root.querySelector("dialog");
    if (current) {
      current.showModal();
      if (dialogScroll) current.scrollTop = dialogScroll;
    }
    if (focusSelector) {
      var target = root.querySelector(focusSelector) || (!current && root.querySelector("[name=filterQuery]"));
      if (target) target.focus({preventScroll:true});
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

  function load(root, keepMsg, focusSelector) {
    var mount = activeMount;
    var attempt = ++mount.loadAttempt;
    return api("/api/feedback/items", { signal: mount.controller.signal }).then(function (result) {
      if (activeMount !== mount || attempt !== mount.loadAttempt) return;
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
      paint(root, focusSelector);
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
          try {
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
          } catch (error) {
            resolve("");
          }
        };
        img.onerror = function () { resolve(""); };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function submit(root) {
    if (state.saving || state.readingShot) return;
    var mount = activeMount;
    snapshot(root);
    if (!state.title.trim() || !state.body.trim()) {
      state.error = true;
      state.msg = "请填写需求标题和说明";
      paint(root, state.title.trim() ? "[data-compose] textarea" : "[data-compose] [name=title]");
      return;
    }
    mount.loadAttempt += 1;
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
      if (activeMount !== mount) return;
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
      state.type = state.draftType = "";
      state.priority = state.draftPriority = "";
      state.query = state.draftQ = "";
      state.page = 1;
      state.error = false;
      state.msg = "已提交，进入待评审。";
      load(root, true, mount.returnTo);
    });
  }

  function setStatus(root, id, status) {
    if (!id || state.saving || !state.admin || !Object.hasOwn(STATUSES, status)) {
      return;
    }
    var mount = activeMount;
    var progressInput = root.querySelector("[data-progress-id]");
    if (progressInput && !progressInput.reportValidity()) return;
    mount.loadAttempt += 1;
    var current = findItem(id);
    var note = state.notes[id] != null ? state.notes[id] : current ? current.note || "" : "";
    var progress = state.progress[id] != null ? state.progress[id] : current ? current.progress : "";
    state.saving = true;
    state.error = false;
    state.msg = "正在更新…";
    paint(root);
    api("/api/feedback/items/" + id, {
      method: "PATCH",
      body: JSON.stringify({ status: status, note: note, progress: progress })
    }).then(function (result) {
      if (activeMount !== mount) return;
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

  function openOverlay(root, kind, trigger, id) {
    state.help = kind === "guide";
    state.composing = kind === "compose";
    state.openId = kind === "detail" ? id : 0;
    state.msg = "";
    state.error = false;
    activeMount.returnTo = trigger;
    paint(root, state.composing ? "[data-compose] [name=title]" : "[data-close-overlay]");
  }

  function closeOverlay(root) {
    if (state.saving) return;
    state.help = false;
    state.composing = false;
    state.openId = 0;
    state.msg = "";
    state.error = false;
    paint(root, activeMount.returnTo);
  }

  function onClick(root, event) {
    var target = event.target;
    if (target.closest("#fb-help,[data-fb-help]")) {
      openOverlay(root,"guide",target.closest("#fb-help") ? "#fb-help" : "[data-fb-help]");
      return;
    }
    if (target.closest("#fb-open-form")) {
      openOverlay(root,"compose","#fb-open-form");
      return;
    }
    if (target.closest("[data-close-overlay]") || target.matches("dialog.fb-overlay")) {
      closeOverlay(root);
      return;
    }
    if (target.closest("[data-retry]")) {
      load(root,false,"[name=filterQuery]");
      return;
    }
    if (target.closest("#fb-export")) {
      exportRows();
      return;
    }
    if (target.closest("[data-clear-filter]")) {
      state.tab = "all";
      state.type = state.draftType = "";
      state.priority = state.draftPriority = "";
      state.query = state.draftQ = "";
      state.page = 1;
      paint(root,"[name=filterQuery]");
      return;
    }
    var statusBtn = target.closest("[data-status-filter]");
    if (statusBtn) {
      state.tab = statusBtn.dataset.statusFilter;
      state.page = 1;
      paint(root,`[data-status-filter="${state.tab}"]`);
      return;
    }
    var typeBtn = target.closest("[data-type-filter]");
    if (typeBtn) {
      var type = typeBtn.dataset.typeFilter;
      state.type = state.draftType = state.type === type ? "" : type;
      state.page = 1;
      paint(root,`[data-type-filter="${type}"]`);
      return;
    }
    var pageBtn = target.closest("[data-page]");
    if (pageBtn) {
      state.page = Math.max(1,Number(pageBtn.dataset.page) || 1);
      paint(root,'[data-page][aria-current="page"]');
      return;
    }
    var setBtn = target.closest("[data-set-status]");
    if (setBtn) {
      setStatus(root,Number(setBtn.dataset.id),setBtn.dataset.setStatus);
      return;
    }
    if (target.closest("input")) return;
    var opener = target.closest("[data-open]") || target.closest("[data-open-row]");
    if (!opener) return;
    var id = Number(opener.dataset.open || opener.dataset.openRow);
    if (findItem(id)) openOverlay(root,"detail",`[data-open="${id}"]`,id);
  }

  function readShot(root, input) {
    var mount = activeMount;
    var version = ++mount.shotVersion;
    var file = input.files && input.files[0];
    var label = root.querySelector("[data-shot-name]");
    var submit = root.querySelector("[data-compose] [type=submit]");
    state.shot = "";
    state.readingShot = Boolean(file);
    state.shotLabel = file ? "正在读取截图…" : "";
    if (label) label.textContent = state.shotLabel || "可选";
    if (submit) submit.disabled = state.saving || state.readingShot;
    if (!file) return;
    compressShot(file).then(function (url) {
      if (activeMount !== mount || version !== mount.shotVersion) return;
      state.shot = url;
      state.readingShot = false;
      state.shotLabel = url ? "已选择截图" : "这张图太大或读不出来";
      var currentLabel = root.querySelector("[data-shot-name]");
      var currentSubmit = root.querySelector("[data-compose] [type=submit]");
      if (currentLabel) currentLabel.textContent = state.shotLabel;
      if (currentSubmit) currentSubmit.disabled = state.saving;
    });
  }

  window.XmModules = window.XmModules || {};
  window.XmModules["/feedback"] = {
    mount: function (root) {
      ensureStyle();
      if (activeMount) activeMount.controller.abort();
      var mount = { controller:new AbortController(),loadAttempt:0,shotVersion:0,returnTo:null };
      activeMount = mount;
      var events = {signal:mount.controller.signal};
      Object.assign(state,{help:false,composing:false,openId:0,msg:"",error:false,saving:false,
        readingShot:false,loaded:false,loadError:false,admin:false,items:[],picked:{}});
      root.classList.add("xm-ui-scope","fb-page-active");
      paint(root);
      root.addEventListener("click",function (event) { onClick(root,event); },events);
      root.addEventListener("cancel",function (event) {
        if (!event.target.matches("dialog.fb-overlay")) return;
        event.preventDefault();
        closeOverlay(root);
      },{signal:events.signal,capture:true});
      root.addEventListener("input",function (event) {
        var el = event.target;
        if (el.name === "filterQuery") state.draftQ = el.value;
        else if (el.hasAttribute("data-note-id")) state.notes[el.dataset.noteId] = el.value;
        else if (el.hasAttribute("data-progress-id")) state.progress[el.dataset.progressId] = el.value;
        else if (el.closest("[data-compose]")) snapshot(root);
      },events);
      root.addEventListener("change",function (event) {
        var el = event.target;
        if (el.name === "filterType") state.draftType = el.value;
        else if (el.name === "filterPriority") state.draftPriority = el.value;
        else if (el.name === "filterStatus") {
          state.tab = el.value;
          state.page = 1;
          paint(root,"[name=filterStatus]");
        } else if (el.hasAttribute("data-pick-all")) {
          root.querySelectorAll("[data-pick]").forEach(function (box) {
            box.checked = el.checked;
            if (box.checked) state.picked[box.dataset.pick] = true;
            else delete state.picked[box.dataset.pick];
          });
          syncPicked(root);
        } else if (el.hasAttribute("data-pick")) {
          if (el.checked) state.picked[el.dataset.pick] = true;
          else delete state.picked[el.dataset.pick];
          syncPicked(root);
        } else if (el.name === "shot") {
          readShot(root,el);
        }
      },events);
      root.addEventListener("submit",function (event) {
        var form = event.target;
        if (form.matches("[data-filter-form]")) {
          event.preventDefault();
          state.type = state.draftType;
          state.priority = state.draftPriority;
          state.query = state.draftQ.trim();
          state.page = 1;
          paint(root,"[name=filterQuery]");
        } else if (form.matches("[data-compose]")) {
          event.preventDefault();
          submit(root);
        }
      },events);
      load(root);
      return function unmount() {
        mount.controller.abort();
        if (activeMount !== mount) return;
        activeMount = null;
        root.querySelector("dialog[open]")?.close();
        root.classList.remove("xm-ui-scope","fb-page-active");
        root.innerHTML = "";
      };
    }
  };
})();
