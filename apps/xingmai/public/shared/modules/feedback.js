/* xm-module-feedback 0.1.772-feedback-desk — 需求与反馈单页。提交、列表、状态。 */
(function () {
  var KIND = { request: "需求", feedback: "反馈" };
  var STATUS = { open: "待处理", doing: "处理中", closed: "已关闭" };
  var state = {
    tab: "list",
    kind: "",
    status: "",
    draftKind: "request",
    title: "",
    body: "",
    admin: false,
    items: [],
    openId: 0,
    note: "",
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
      ".fb-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-end;margin:0 0 8px;}" +
      ".fb-page h1{margin:0;font-size:18px;font-weight:650;}" +
      ".fb-lead{margin:4px 0 0;color:var(--xm-muted);font-size:12px;}" +
      ".fb-tabs{display:flex;gap:0;border-bottom:1px solid var(--xm-line);margin:0 0 12px;}" +
      ".fb-tab{appearance:none;border:0;border-bottom:2px solid transparent;background:transparent;color:var(--xm-muted);font:inherit;font-size:14px;padding:8px 16px;cursor:pointer;}" +
      ".fb-tab[aria-selected='true']{color:var(--xm-primary);border-bottom-color:var(--xm-primary);font-weight:600;}" +
      ".fb-page button:focus-visible,.fb-page input:focus-visible,.fb-page textarea:focus-visible{outline:2px solid var(--xm-primary);outline-offset:1px;}" +
      ".fb-msg{min-height:18px;margin:0 0 8px;color:var(--xm-muted);font-size:12px;}" +
      ".fb-msg.is-error{color:#cf1322;}" +
      ".fb-toolbar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 8px;}" +
      ".fb-chip{height:26px;border:1px solid var(--xm-line);border-radius:999px;background:var(--xm-card);color:var(--xm-ink);padding:0 10px;font:inherit;font-size:12px;cursor:pointer;}" +
      ".fb-chip.is-on{border-color:var(--xm-primary);color:var(--xm-primary);background:var(--xm-primary-soft);}" +
      ".fb-hint{margin:0 0 8px;color:var(--xm-muted);font-size:12px;}" +
      ".fb-card{background:var(--xm-card);border:1px solid var(--xm-line);border-radius:10px;box-shadow:var(--xm-shadow);}" +
      ".fb-table-wrap{overflow:auto;}" +
      ".fb-table{width:100%;border-collapse:collapse;font-size:13px;}" +
      ".fb-table th{text-align:left;color:var(--xm-muted);font-weight:600;padding:8px 10px;border-bottom:1px solid var(--xm-line);white-space:nowrap;}" +
      ".fb-table td{padding:8px 10px;border-bottom:1px solid var(--xm-line);vertical-align:middle;}" +
      ".fb-row{cursor:pointer;}" +
      ".fb-row:hover td{background:color-mix(in srgb, var(--xm-primary) 7%, transparent);}" +
      ".fb-title{font-weight:600;}" +
      ".fb-pill{display:inline-block;border-radius:999px;padding:1px 8px;font-size:12px;line-height:20px;white-space:nowrap;}" +
      ".fb-pill[data-status='open']{color:var(--xm-primary);background:var(--xm-primary-soft);}" +
      ".fb-pill[data-status='doing']{color:#ad6800;background:#fff7e6;}" +
      ".fb-pill[data-status='closed']{color:var(--xm-muted);background:transparent;border:1px solid var(--xm-line);}" +
      "html[data-theme='dark'] .fb-pill[data-status='doing']{color:#ffc069;background:#3a2e14;}" +
      ".fb-detail td{background:color-mix(in srgb, var(--xm-primary) 5%, var(--xm-card));}" +
      ".fb-detail-box{display:flex;flex-direction:column;gap:8px;padding:2px 2px 6px;}" +
      ".fb-body{white-space:pre-wrap;line-height:1.55;}" +
      ".fb-note{color:var(--xm-muted);font-size:12px;white-space:pre-wrap;}" +
      ".fb-ops{display:flex;flex-wrap:wrap;gap:8px;align-items:center;}" +
      ".fb-ops input{flex:1;min-width:180px;height:30px;border:1px solid var(--xm-line);border-radius:6px;background:var(--xm-card);color:var(--xm-ink);padding:0 8px;font:inherit;font-size:13px;}" +
      ".fb-empty{padding:28px 12px;text-align:center;color:var(--xm-muted);}" +
      ".fb-empty b{display:block;margin-bottom:6px;color:var(--xm-ink);font-size:14px;}" +
      ".fb-empty .fb-primary{margin-top:10px;}" +
      ".fb-form{max-width:720px;background:var(--xm-card);border:1px solid var(--xm-line);border-radius:10px;box-shadow:var(--xm-shadow);padding:14px;display:flex;flex-direction:column;gap:12px;}" +
      ".fb-kinds{display:grid;grid-template-columns:1fr 1fr;gap:8px;}" +
      ".fb-kinds button{text-align:left;border:1px solid var(--xm-line);border-radius:8px;background:var(--xm-card);color:var(--xm-ink);padding:10px 12px;cursor:pointer;font:inherit;font-weight:650;}" +
      ".fb-kinds button[aria-pressed='true']{border-color:var(--xm-primary);box-shadow:0 0 0 1px var(--xm-primary);background:var(--xm-primary-soft);}" +
      ".fb-kinds span{display:block;margin-top:4px;color:var(--xm-muted);font-size:12px;font-weight:400;}" +
      ".fb-field{display:flex;flex-direction:column;gap:4px;color:var(--xm-muted);font-size:12px;}" +
      ".fb-field input,.fb-field textarea{border:1px solid var(--xm-line);border-radius:6px;background:var(--xm-card);color:var(--xm-ink);font:inherit;font-size:13px;padding:6px 8px;box-sizing:border-box;}" +
      ".fb-field textarea{min-height:120px;resize:vertical;}" +
      ".fb-submitrow{display:flex;justify-content:flex-end;}" +
      ".fb-primary{height:32px;border:0;border-radius:6px;background:var(--xm-primary);color:#fff;padding:0 14px;font:inherit;font-size:13px;cursor:pointer;}" +
      ".fb-primary:disabled{opacity:.6;cursor:default;}" +
      ".fb-ghost{height:32px;border:1px solid var(--xm-line);border-radius:6px;background:var(--xm-card);color:var(--xm-ink);padding:0 12px;font:inherit;font-size:13px;cursor:pointer;}" +
      ".fb-time{color:var(--xm-muted);white-space:nowrap;font-variant-numeric:tabular-nums;}" +
      "@media (max-width:720px){.fb-kinds{grid-template-columns:1fr;}.fb-form{max-width:none;}}";
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

  function filtered() {
    return state.items.filter(function (item) {
      if (state.kind && item.kind !== state.kind) {
        return false;
      }
      if (state.status && item.status !== state.status) {
        return false;
      }
      return true;
    });
  }

  function chip(group, value, label) {
    var on = state[group] === value;
    return (
      '<button type="button" class="fb-chip' +
      (on ? " is-on" : "") +
      '" data-filter="' +
      group +
      '" data-value="' +
      esc(value) +
      '" aria-pressed="' +
      (on ? "true" : "false") +
      '">' +
      esc(label) +
      "</button>"
    );
  }

  function toolbar() {
    return (
      '<div class="fb-toolbar">' +
      chip("kind", "", "全部类型") +
      chip("kind", "request", "需求") +
      chip("kind", "feedback", "反馈") +
      chip("status", "", "全部状态") +
      chip("status", "open", "待处理") +
      chip("status", "doing", "处理中") +
      chip("status", "closed", "已关闭") +
      "</div>"
    );
  }

  function detail(item) {
    var note = item.note
      ? '<p class="fb-note">处理说明：' + esc(item.note) + "</p>"
      : "";
    var ops = "";
    if (state.admin) {
      var doing = item.status === "doing" ? "" : '<button type="button" class="fb-primary" data-set-status="doing">开始处理</button>';
      var closed = item.status === "closed" ? "" : '<button type="button" class="fb-ghost" data-set-status="closed">关闭</button>';
      var reopen = item.status === "closed" ? '<button type="button" class="fb-ghost" data-set-status="open">重新打开</button>' : "";
      ops =
        '<div class="fb-ops"><input data-note maxlength="500" value="' +
        esc(state.note) +
        '" placeholder="处理说明，可选" aria-label="处理说明">' +
        doing +
        closed +
        reopen +
        "</div>";
    }
    return (
      '<tr class="fb-detail"><td colspan="5"><div class="fb-detail-box"><div class="fb-body">' +
      esc(item.body) +
      "</div>" +
      note +
      ops +
      "</div></td></tr>"
    );
  }

  function listPanel() {
    if (!state.loaded) {
      return '<p class="fb-empty">正在加载…</p>';
    }
    if (state.loadError) {
      return '<div class="fb-card"><div class="fb-empty"><b>列表没有加载出来</b><button type="button" class="fb-primary" data-retry="1">重试</button></div></div>';
    }
    var rows = filtered();
    var hint = "共 " + state.items.length + " 条";
    if (state.kind || state.status) {
      hint += "，当前显示 " + rows.length + " 条";
    } else if (rows.length) {
      hint += " · 点一行查看内容";
    }
    if (!state.items.length) {
      return '<div class="fb-card"><div class="fb-empty"><b>还没有记录</b><span>提交一条需求或反馈后，会出现在这里。</span><div><button type="button" class="fb-primary" data-tab="compose">去提交</button></div></div></div>';
    }
    if (!rows.length) {
      return toolbar() + '<p class="fb-hint">' + esc(hint) + '</p><div class="fb-card"><div class="fb-empty"><b>没有符合筛选的记录</b></div></div>';
    }
    var body = rows
      .map(function (item) {
        var open = state.openId === item.id;
        return (
          '<tr class="fb-row" data-id="' +
          item.id +
          '" aria-expanded="' +
          (open ? "true" : "false") +
          '"><td>' +
          esc(KIND[item.kind] || item.kind) +
          '</td><td class="fb-title">' +
          esc(item.title) +
          "</td><td>" +
          esc(item.authorName || item.author) +
          '</td><td><span class="fb-pill" data-status="' +
          esc(item.status) +
          '">' +
          esc(STATUS[item.status] || item.status) +
          '</span></td><td class="fb-time">' +
          esc(String(item.updatedAt || "").slice(0, 16)) +
          "</td></tr>" +
          (open ? detail(item) : "")
        );
      })
      .join("");
    return (
      toolbar() +
      '<p class="fb-hint">' +
      esc(hint) +
      '</p><div class="fb-card"><div class="fb-table-wrap"><table class="fb-table"><thead><tr><th>类型</th><th>标题</th><th>提交人</th><th>状态</th><th>更新</th></tr></thead><tbody>' +
      body +
      "</tbody></table></div></div>"
    );
  }

  function composePanel() {
    var requestOn = state.draftKind !== "feedback";
    return (
      '<form class="fb-form" data-compose="1">' +
      '<div class="fb-kinds" role="radiogroup" aria-label="类型">' +
      '<button type="button" data-kind="request" aria-pressed="' +
      (requestOn ? "true" : "false") +
      '">需求<span>希望新增或调整</span></button>' +
      '<button type="button" data-kind="feedback" aria-pressed="' +
      (requestOn ? "false" : "true") +
      '">反馈<span>问题、建议、使用感受</span></button>' +
      "</div>" +
      '<label class="fb-field">标题<input name="title" maxlength="80" required placeholder="一句话说明" autocomplete="off" value="' +
      esc(state.title) +
      '"></label>' +
      '<label class="fb-field">内容<textarea name="body" maxlength="2000" required placeholder="发生了什么，希望怎么处理">' +
      esc(state.body) +
      "</textarea></label>" +
      '<div class="fb-submitrow"><button type="submit" class="fb-primary"' +
      (state.saving ? " disabled" : "") +
      ">提交</button></div></form>"
    );
  }

  function paint(root) {
    ensureStyle();
    var lead = state.admin
      ? "全部人的需求和反馈。可以开始处理或关闭。"
      : "提交后在列表里看自己的进度。";
    root.innerHTML =
      '<main class="page fb-page">' +
      '<div class="fb-head"><div><h1>需求与反馈</h1><p class="fb-lead">' +
      esc(lead) +
      "</p></div></div>" +
      '<div class="fb-tabs" role="tablist">' +
      '<button type="button" class="fb-tab" role="tab" data-tab="list" aria-selected="' +
      (state.tab === "list" ? "true" : "false") +
      '">列表</button>' +
      '<button type="button" class="fb-tab" role="tab" data-tab="compose" aria-selected="' +
      (state.tab === "compose" ? "true" : "false") +
      '">提交</button></div>' +
      '<p class="fb-msg' +
      (state.error ? " is-error" : "") +
      '" role="status">' +
      esc(state.msg) +
      "</p>" +
      (state.tab === "compose" ? composePanel() : listPanel()) +
      "</main>";
  }

  function findItem(id) {
    for (var i = 0; i < state.items.length; i += 1) {
      if (state.items[i].id === id) {
        return state.items[i];
      }
    }
    return null;
  }

  function snapshot(root) {
    var title = root.querySelector("[name=title]");
    var body = root.querySelector("[name=body]");
    var note = root.querySelector("[data-note]");
    if (title) {
      state.title = title.value;
    }
    if (body) {
      state.body = body.value;
    }
    if (note) {
      state.note = note.value;
    }
  }

  function load(root, keepMsg) {
    var quiet = state.loaded && !state.loadError;
    state.loadError = false;
    if (!quiet) {
      state.loaded = false;
      paint(root);
    }
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

  function submit(root) {
    snapshot(root);
    var title = state.title.trim();
    var body = state.body.trim();
    if (!title) {
      state.error = true;
      state.msg = "请填写标题";
      paint(root);
      return;
    }
    if (!body) {
      state.error = true;
      state.msg = "请填写内容";
      paint(root);
      return;
    }
    state.saving = true;
    state.error = false;
    state.msg = "正在提交…";
    paint(root);
    api("/api/feedback/items", {
      method: "POST",
      body: JSON.stringify({ kind: state.draftKind === "feedback" ? "feedback" : "request", title: title, body: body })
    }).then(function (result) {
      state.saving = false;
      if (!result.httpOk || !result.data || result.data.ok === false) {
        state.error = true;
        state.msg = (result.data && result.data.error) || "提交失败";
        state.tab = "compose";
        paint(root);
        return;
      }
      state.title = "";
      state.body = "";
      state.tab = "list";
      state.kind = "";
      state.status = "";
      state.openId = result.data.item ? result.data.item.id : 0;
      state.note = "";
      state.error = false;
      state.msg = "已提交，状态是待处理。";
      load(root, true);
    });
  }

  function setStatus(root, status) {
    if (!state.openId || state.saving) {
      return;
    }
    snapshot(root);
    state.saving = true;
    state.error = false;
    state.msg = "正在更新状态…";
    var id = state.openId;
    var note = state.note;
    paint(root);
    api("/api/feedback/items/" + id, {
      method: "PATCH",
      body: JSON.stringify({ status: status, note: note })
    }).then(function (result) {
      state.saving = false;
      if (!result.httpOk || !result.data || result.data.ok === false) {
        state.error = true;
        state.msg = (result.data && result.data.error) || "状态更新失败";
        state.openId = id;
        state.note = note;
        paint(root);
        return;
      }
      state.error = false;
      state.msg = "状态已更新为" + (STATUS[status] || status) + "。";
      state.openId = id;
      state.note = result.data.item ? result.data.item.note : note;
      load(root, true);
    });
  }

  function onClick(root, event) {
    var kindBtn = event.target.closest("[data-kind]");
    if (kindBtn) {
      state.draftKind = kindBtn.getAttribute("data-kind") === "feedback" ? "feedback" : "request";
      root.querySelectorAll("[data-kind]").forEach(function (btn) {
        btn.setAttribute("aria-pressed", btn === kindBtn ? "true" : "false");
      });
      return;
    }
    var tab = event.target.closest("[data-tab]");
    if (tab) {
      state.tab = tab.getAttribute("data-tab") === "compose" ? "compose" : "list";
      if (state.tab === "list") {
        state.error = false;
      }
      paint(root);
      return;
    }
    var retry = event.target.closest("[data-retry]");
    if (retry) {
      load(root);
      return;
    }
    var setBtn = event.target.closest("[data-set-status]");
    if (setBtn) {
      setStatus(root, setBtn.getAttribute("data-set-status"));
      return;
    }
    var filter = event.target.closest("[data-filter]");
    if (filter) {
      var group = filter.getAttribute("data-filter");
      if (group === "kind" || group === "status") {
        state[group] = filter.getAttribute("data-value") || "";
        paint(root);
      }
      return;
    }
    if (event.target.closest("input, textarea, button")) {
      return;
    }
    var row = event.target.closest("tr[data-id]");
    if (!row) {
      return;
    }
    var id = Number(row.getAttribute("data-id"));
    if (state.openId === id) {
      state.openId = 0;
      state.note = "";
    } else {
      var item = findItem(id);
      state.openId = id;
      state.note = item ? item.note || "" : "";
    }
    paint(root);
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
          if (!el) {
            return;
          }
          if (el.name === "title") {
            state.title = el.value;
          } else if (el.name === "body") {
            state.body = el.value;
          } else if (el.hasAttribute("data-note")) {
            state.note = el.value;
          }
        });
        root.addEventListener("submit", function (event) {
          var form = event.target && event.target.closest ? event.target.closest("[data-compose]") : null;
          if (!form) {
            return;
          }
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
