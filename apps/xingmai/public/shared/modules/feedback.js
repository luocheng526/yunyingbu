/* xm-module-feedback 0.1.772-feedback-board — 需求看板：四色统计 + 向下渐变里的个人卡片。 */
(function () {
  var LANES = [
    { status: "open", label: "需求与任务", tone: "c0" },
    { status: "doing", label: "开发中任务", tone: "c1" },
    { status: "closed", label: "已完成任务", tone: "c2" },
    { status: "rejected", label: "需求驳回", tone: "c3" }
  ];
  var STATUS = {
    open: "需求与任务",
    doing: "开发中任务",
    closed: "已完成任务",
    rejected: "需求驳回"
  };
  var state = {
    lane: "",
    composing: false,
    title: "",
    body: "",
    note: "",
    shot: "",
    shotLabel: "",
    admin: false,
    items: [],
    notes: {},
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
      ".fb-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-end;margin:0 0 12px;}" +
      ".fb-page h1{margin:0;font-size:18px;font-weight:650;}" +
      ".fb-lead{margin:4px 0 0;color:var(--xm-muted);font-size:12px;}" +
      ".fb-page button:focus-visible,.fb-page input:focus-visible,.fb-page textarea:focus-visible{outline:2px solid var(--xm-primary);outline-offset:1px;}" +
      ".fb-msg{min-height:18px;margin:0 0 8px;color:var(--xm-muted);font-size:12px;}" +
      ".fb-msg.is-error{color:#cf1322;}" +
      ".fb-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:0 0 14px;}" +
      ".fb-stat{position:relative;border:0;border-radius:12px;min-height:108px;padding:16px 16px 14px;color:#fff;text-align:left;cursor:pointer;box-shadow:0 8px 18px rgba(22,119,255,.12);font:inherit;}" +
      ".fb-stat b{display:block;margin-top:26px;font-size:32px;line-height:1;font-weight:700;font-variant-numeric:tabular-nums;}" +
      ".fb-stat em{display:block;margin-top:8px;font-style:normal;font-size:13px;font-weight:600;letter-spacing:.01em;}" +
      ".fb-stat.is-on{box-shadow:0 0 0 3px #fff,0 0 0 5px rgba(20,40,80,.45);}" +
      ".fb-ico{position:absolute;top:12px;left:14px;width:28px;height:28px;border-radius:8px;background:rgba(255,255,255,.24);display:flex;align-items:center;justify-content:center;}" +
      ".fb-ico svg{width:16px;height:16px;stroke:#fff;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;}" +
      ".fb-c0{background:linear-gradient(135deg,#1fb8c9,#2fd3c0);}" +
      ".fb-c1{background:linear-gradient(135deg,#2fcf78,#62e08a);}" +
      ".fb-c2{background:linear-gradient(135deg,#4b7cff,#6ea0ff);}" +
      ".fb-c3{background:linear-gradient(135deg,#ff9440,#ffb15a);}" +
      ".fb-board{border-radius:16px;padding:14px;background:linear-gradient(180deg,#7ed4ea 0%,#8eb6ff 42%,#c9b6ff 74%,#ffd3ae 100%);min-height:280px;}" +
      ".fb-board-bar{display:flex;align-items:center;gap:8px;color:#fff;margin:0 0 12px;}" +
      ".fb-board-bar strong{font-size:16px;font-weight:700;}" +
      ".fb-board-bar span{flex:1;font-size:12px;opacity:.92;}" +
      ".fb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px;}" +
      ".fb-person{background:var(--xm-card);color:var(--xm-ink);border-radius:12px;padding:12px;box-shadow:0 10px 24px rgba(20,40,80,.12);display:flex;flex-direction:column;gap:8px;}" +
      ".fb-person-top{display:flex;justify-content:space-between;gap:8px;align-items:flex-start;}" +
      ".fb-name{font-size:16px;font-weight:700;}" +
      ".fb-when{color:var(--xm-muted);font-size:12px;text-align:right;line-height:1.4;font-variant-numeric:tabular-nums;}" +
      ".fb-need{font-size:14px;font-weight:650;}" +
      ".fb-body{white-space:pre-wrap;line-height:1.55;}" +
      ".fb-shot{width:100%;max-height:168px;object-fit:cover;border-radius:8px;background:#f4f7fb;display:block;}" +
      ".fb-shot-empty{height:92px;border:1px dashed var(--xm-line);border-radius:8px;color:var(--xm-muted);display:flex;align-items:center;justify-content:center;font-size:12px;background:color-mix(in srgb, var(--xm-ink) 4%, var(--xm-card));}" +
      ".fb-meta{display:flex;flex-direction:column;gap:3px;font-size:12px;color:var(--xm-muted);}" +
      ".fb-meta b{color:var(--xm-ink);font-weight:650;}" +
      ".fb-ops{display:flex;flex-wrap:wrap;gap:6px;align-items:center;}" +
      ".fb-ops input{flex:1 1 100%;min-width:0;height:30px;border:1px solid var(--xm-line);border-radius:6px;background:var(--xm-card);color:var(--xm-ink);padding:0 8px;font:inherit;font-size:12px;}" +
      ".fb-empty{padding:36px 12px;text-align:center;color:#fff;}" +
      ".fb-empty b{display:block;margin-bottom:6px;font-size:15px;}" +
      ".fb-form{background:var(--xm-card);border:1px solid var(--xm-line);border-radius:12px;box-shadow:var(--xm-shadow);padding:14px;display:flex;flex-direction:column;gap:10px;margin:0 0 14px;}" +
      ".fb-field{display:flex;flex-direction:column;gap:4px;color:var(--xm-muted);font-size:12px;}" +
      ".fb-field input,.fb-field textarea{border:1px solid var(--xm-line);border-radius:6px;background:var(--xm-card);color:var(--xm-ink);font:inherit;font-size:13px;padding:6px 8px;box-sizing:border-box;}" +
      ".fb-field textarea{min-height:88px;resize:vertical;}" +
      ".fb-file{display:flex;align-items:center;gap:8px;}" +
      ".fb-submitrow{display:flex;justify-content:space-between;gap:8px;align-items:center;}" +
      ".fb-primary{height:32px;border:0;border-radius:6px;background:var(--xm-primary);color:#fff;padding:0 14px;font:inherit;font-size:13px;cursor:pointer;}" +
      ".fb-primary:disabled{opacity:.6;cursor:default;}" +
      ".fb-onboard{height:32px;border:0;border-radius:6px;background:#fff;color:#245bdb;padding:0 12px;font:inherit;font-size:13px;font-weight:650;cursor:pointer;}" +
      ".fb-ghost{height:28px;border:1px solid var(--xm-line);border-radius:6px;background:var(--xm-card);color:var(--xm-ink);padding:0 8px;font:inherit;font-size:12px;cursor:pointer;}" +
      "@media (max-width:900px){.fb-stats{grid-template-columns:repeat(2,minmax(0,1fr));}}";
    document.head.appendChild(style);
  }

  function icon(path) {
    return '<span class="fb-ico" aria-hidden="true"><svg viewBox="0 0 24 24">' + path + "</svg></span>";
  }

  var ICONS = {
    open: icon('<path d="M7 4h10v16H7z"/><path d="M9 8h6"/><path d="M9 12h6"/><path d="M9 16h4"/>'),
    doing: icon('<path d="M12 7v5l3 2"/><circle cx="12" cy="12" r="7"/>'),
    closed: icon('<circle cx="12" cy="12" r="7"/><path d="m9 12 2 2 4-4"/>'),
    rejected: icon('<circle cx="12" cy="12" r="7"/><path d="m9 9 6 6"/><path d="m15 9-6 6"/>')
  };

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

  function count(status) {
    return state.items.filter(function (item) {
      return item.status === status;
    }).length;
  }

  function laneLabel() {
    if (!state.lane) {
      return "全部需求";
    }
    return STATUS[state.lane] || "全部需求";
  }

  function stats() {
    return (
      '<div class="fb-stats">' +
      LANES.map(function (lane) {
        var on = state.lane === lane.status;
        return (
          '<button type="button" class="fb-stat fb-' +
          lane.tone +
          (on ? " is-on" : "") +
          '" data-lane="' +
          lane.status +
          '" aria-pressed="' +
          (on ? "true" : "false") +
          '">' +
          ICONS[lane.status] +
          "<b>" +
          count(lane.status) +
          "</b><em>" +
          esc(lane.label) +
          "</em></button>"
        );
      }).join("") +
      "</div>"
    );
  }

  function shotHtml(item) {
    if (item.shot && /^data:image\//.test(item.shot)) {
      return '<img class="fb-shot" alt="' + esc(item.authorName || "截图") + '的需求截图" src="' + esc(item.shot) + '">';
    }
    return '<div class="fb-shot-empty">截图</div>';
  }

  function personCard(item) {
    var when = String(item.createdAt || "").slice(0, 16);
    var updated = String(item.updatedAt || "").slice(0, 16);
    var time = "提交 " + when;
    if (updated && updated !== when) {
      time += "<br>更新 " + updated;
    }
    var manager = item.managerName || "未登记";
    var noteText = item.note || "暂无";
    var ops = "";
    if (state.admin) {
      var noteValue = state.notes[item.id] != null ? state.notes[item.id] : item.note || "";
      ops =
        '<div class="fb-ops"><input data-note-id="' +
        item.id +
        '" maxlength="500" value="' +
        esc(noteValue) +
        '" placeholder="备注说明" aria-label="备注说明">' +
        (item.status === "doing" ? "" : '<button type="button" class="fb-ghost" data-id="' + item.id + '" data-set-status="doing">开发中</button>') +
        (item.status === "closed" ? "" : '<button type="button" class="fb-ghost" data-id="' + item.id + '" data-set-status="closed">已完成</button>') +
        (item.status === "rejected" ? "" : '<button type="button" class="fb-ghost" data-id="' + item.id + '" data-set-status="rejected">驳回</button>') +
        (item.status === "open" ? "" : '<button type="button" class="fb-ghost" data-id="' + item.id + '" data-set-status="open">退回</button>') +
        "</div>";
    }
    return (
      '<article class="fb-person">' +
      '<div class="fb-person-top"><div class="fb-name">' +
      esc(item.authorName || item.author) +
      '</div><div class="fb-when">' +
      time +
      "</div></div>" +
      '<div class="fb-need">' +
      esc(item.title) +
      '</div><div class="fb-body">' +
      esc(item.body) +
      "</div>" +
      shotHtml(item) +
      '<div class="fb-meta"><div>备注说明　<b>' +
      esc(noteText) +
      "</b></div><div>审核人　经理 <b>" +
      esc(manager) +
      "</b>　罗成</div><div>状态　<b>" +
      esc(STATUS[item.status] || item.status) +
      "</b></div></div>" +
      ops +
      "</article>"
    );
  }

  function board() {
    var rows = state.items.filter(function (item) {
      return !state.lane || item.status === state.lane;
    });
    var body;
    if (!state.loaded) {
      body = '<div class="fb-empty">正在加载…</div>';
    } else if (state.loadError) {
      body = '<div class="fb-empty"><b>看板没有加载出来</b><button type="button" class="fb-onboard" data-retry="1">重试</button></div>';
    } else if (!rows.length) {
      body = '<div class="fb-empty"><b>这个颜色里还没有需求</b>提交后，每个人一张小卡片，放在这块渐变里。</div>';
    } else {
      body = '<div class="fb-grid">' + rows.map(personCard).join("") + "</div>";
    }
    return (
      '<section class="fb-board">' +
      '<div class="fb-board-bar"><strong>' +
      esc(laneLabel()) +
      "</strong><span>" +
      rows.length +
      ' 条 · 姓名、需求、截图、备注、审核人、时间</span><button type="button" class="fb-onboard" data-open-form="1">' +
      (state.composing ? "收起" : "提交需求") +
      "</button></div>" +
      body +
      "</section>"
    );
  }

  function formHtml() {
    if (!state.composing) {
      return "";
    }
    return (
      '<form class="fb-form" data-compose="1">' +
      '<label class="fb-field">具体需求<input name="title" maxlength="80" required placeholder="一句话写清要做什么" autocomplete="off" value="' +
      esc(state.title) +
      '"></label>' +
      '<label class="fb-field">需求说明<textarea name="body" maxlength="2000" required placeholder="背景、希望怎么处理">' +
      esc(state.body) +
      "</textarea></label>" +
      '<label class="fb-field">备注说明<input name="remark" maxlength="500" placeholder="补充情况，可选" value="' +
      esc(state.note) +
      '"></label>' +
      '<label class="fb-field">截图<span class="fb-file"><input name="shot" type="file" accept="image/*"><span data-shot-name>' +
      esc(state.shotLabel || "可选，会自动压小") +
      "</span></span></label>" +
      '<div class="fb-submitrow"><span>审核人：经理（按组织中心带出）和罗成。时间在提交后写入。</span><button type="submit" class="fb-primary"' +
      (state.saving ? " disabled" : "") +
      ">提交</button></div></form>"
    );
  }

  function paint(root) {
    ensureStyle();
    var lead = state.admin ? "你看全部。审核人是对方的经理和你。" : "你提交的需求会出现在下面的渐变里。";
    root.innerHTML =
      '<main class="page fb-page">' +
      '<div class="fb-head"><div><h1>需求与反馈</h1><p class="fb-lead">' +
      esc(lead) +
      "</p></div></div>" +
      '<p class="fb-msg' +
      (state.error ? " is-error" : "") +
      '" role="status">' +
      esc(state.msg) +
      "</p>" +
      stats() +
      formHtml() +
      board() +
      "</main>";
  }

  function snapshot(root) {
    var title = root.querySelector("[name=title]");
    var body = root.querySelector("[name=body]");
    var remark = root.querySelector("[name=remark]");
    if (title) {
      state.title = title.value;
    }
    if (body) {
      state.body = body.value;
    }
    if (remark) {
      state.note = remark.value;
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

  function compressShot(file) {
    return new Promise(function (resolve) {
      if (!file || !/^image\//.test(file.type)) {
        resolve("");
        return;
      }
      var reader = new FileReader();
      reader.onerror = function () {
        resolve("");
      };
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
        img.onerror = function () {
          resolve("");
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function submit(root) {
    snapshot(root);
    var title = state.title.trim();
    var body = state.body.trim();
    if (!title) {
      state.error = true;
      state.msg = "请填写具体需求";
      paint(root);
      return;
    }
    if (!body) {
      state.error = true;
      state.msg = "请填写需求说明";
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
        kind: "request",
        title: title,
        body: body,
        note: state.note.trim(),
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
      state.shot = "";
      state.shotLabel = "";
      state.composing = false;
      state.lane = "open";
      state.error = false;
      state.msg = "已放入需求与任务。";
      load(root, true);
    });
  }

  function setStatus(root, id, status) {
    if (!id || state.saving) {
      return;
    }
    state.saving = true;
    var note = state.notes[id] != null ? state.notes[id] : "";
    var current = null;
    for (var i = 0; i < state.items.length; i += 1) {
      if (state.items[i].id === id) {
        current = state.items[i];
      }
    }
    if (state.notes[id] == null && current) {
      note = current.note || "";
    }
    api("/api/feedback/items/" + id, {
      method: "PATCH",
      body: JSON.stringify({ status: status, note: note })
    }).then(function (result) {
      state.saving = false;
      if (!result.httpOk || !result.data || result.data.ok === false) {
        state.error = true;
        state.msg = (result.data && result.data.error) || "状态更新失败";
        paint(root);
        return;
      }
      state.error = false;
      state.msg = "已放到" + (STATUS[status] || status) + "。";
      state.lane = status;
      delete state.notes[id];
      load(root, true);
    });
  }

  function onClick(root, event) {
    var lane = event.target.closest("[data-lane]");
    if (lane) {
      var next = lane.getAttribute("data-lane") || "";
      state.lane = state.lane === next ? "" : next;
      paint(root);
      return;
    }
    if (event.target.closest("[data-open-form]")) {
      snapshot(root);
      state.composing = !state.composing;
      paint(root);
      return;
    }
    if (event.target.closest("[data-retry]")) {
      load(root);
      return;
    }
    var setBtn = event.target.closest("[data-set-status]");
    if (setBtn) {
      setStatus(root, Number(setBtn.getAttribute("data-id")), setBtn.getAttribute("data-set-status"));
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
        root.addEventListener("click", onClickBound);
        root.addEventListener("input", function (event) {
          var el = event.target;
          if (!el) {
            return;
          }
          if (el.name === "title") {
            state.title = el.value;
          } else if (el.name === "body") {
            state.body = el.value;
          } else if (el.name === "remark") {
            state.note = el.value;
          } else if (el.hasAttribute("data-note-id")) {
            state.notes[el.getAttribute("data-note-id")] = el.value;
          }
        });
        root.addEventListener("change", function (event) {
          var el = event.target;
          if (!el || el.name !== "shot") {
            return;
          }
          var file = el.files && el.files[0];
          compressShot(file).then(function (url) {
            state.shot = url;
            state.shotLabel = url ? "已选择截图" : "这张图太大或读不出来";
            var label = root.querySelector("[data-shot-name]");
            if (label) {
              label.textContent = state.shotLabel;
            }
          });
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
      function onClickBound(event) {
        onClick(root, event);
      }
      load(root);
      return function unmount() {
        root.innerHTML = "";
      };
    }
  };
})();
