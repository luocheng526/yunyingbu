/* xm-module-notices announcement-center */
(function () {
  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function ensureCss() {
    let css = document.getElementById("xm-notices-css");
    if (!css) {
      css = document.createElement("style");
      css.id = "xm-notices-css";
      document.head.appendChild(css);
    }
    css.textContent =
      ".notice-page{padding:16px 18px 24px;}" +
      ".notice-hero{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:8px 4px 18px;}" +
      ".notice-hero-main{display:flex;align-items:center;gap:14px;}" +
      ".notice-mark{width:48px;height:48px;border-radius:14px;background:var(--xm-primary,#1677ff);color:#fff;display:grid;place-items:center;font-size:22px;flex:0 0 auto;}" +
      ".notice-hero h1{margin:0;font-size:26px;}" +
      ".notice-kicker{margin:0 0 4px;font-size:11px;letter-spacing:.08em;color:var(--xm-muted,#8c8c8c);}" +
      ".notice-lead{margin:6px 0 0;color:var(--xm-muted,#8c8c8c);font-size:13px;}" +
      ".notice-kpis{display:flex;gap:28px;}" +
      ".notice-kpis b{display:block;font-size:28px;line-height:1;}" +
      ".notice-kpis span{color:var(--xm-muted,#8c8c8c);font-size:12px;}" +
      ".notice-tabs{display:flex;gap:8px;margin:0 0 14px;}" +
      ".notice-tab{border:0;background:transparent;padding:8px 4px;font:inherit;color:var(--xm-muted,#8c8c8c);cursor:pointer;border-bottom:2px solid transparent;}" +
      ".notice-tab.is-on{color:var(--xm-primary,#1677ff);font-weight:600;border-bottom-color:var(--xm-primary,#1677ff);}" +
      ".notice-panel{background:var(--xm-card,#fff);border:1px solid var(--xm-line,#f0f0f0);border-radius:12px;box-shadow:var(--xm-shadow);overflow:hidden;}" +
      ".notice-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid var(--xm-line,#f0f0f0);}" +
      ".notice-toolbar h2{margin:0;font-size:16px;}" +
      ".notice-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}" +
      ".notice-actions button,.notice-form button{border:1px solid var(--xm-line,#e5e7eb);background:var(--xm-card,#fff);color:inherit;border-radius:8px;padding:6px 12px;font:inherit;cursor:pointer;}" +
      ".notice-actions button.is-on,.notice-actions .primary,.notice-form .primary{background:var(--xm-primary,#1677ff);border-color:var(--xm-primary,#1677ff);color:#fff;}" +
      ".notice-row{display:flex;justify-content:space-between;gap:16px;padding:14px 16px;border-top:1px solid var(--xm-line,#f5f5f5);cursor:pointer;}" +
      ".notice-row:hover{background:var(--xm-primary-soft,#e6f4ff);}" +
      ".notice-tags{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;}" +
      ".notice-tag{font-size:12px;padding:2px 8px;border-radius:999px;background:#eef2ff;color:#3730a3;}" +
      ".notice-tag.warn{background:#fef3c7;color:#92400e;}" +
      ".notice-tag.ok{background:#d1fae5;color:#065f46;}" +
      ".notice-row h3{margin:0 0 4px;font-size:15px;}" +
      ".notice-row p{margin:0;color:var(--xm-muted,#8c8c8c);font-size:13px;}" +
      ".notice-meta{color:var(--xm-muted,#8c8c8c);font-size:12px;text-align:right;white-space:nowrap;}" +
      ".notice-empty{padding:28px 16px;color:var(--xm-muted,#8c8c8c);}" +
      ".notice-table{width:100%;border-collapse:collapse;font-size:13px;}" +
      ".notice-table th,.notice-table td{text-align:left;padding:8px 12px;border-top:1px solid var(--xm-line,#f5f5f5);}" +
      ".notice-table th{color:var(--xm-muted,#8c8c8c);background:#fafafa;}" +
      ".notice-split{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,.8fr);gap:0;}" +
      "@media (max-width:900px){.notice-split{grid-template-columns:1fr;}}" +
      ".notice-detail{padding:16px;}" +
      ".notice-detail h2{margin:0 0 8px;}" +
      ".notice-form{display:grid;gap:8px;padding:16px;}" +
      ".notice-form input,.notice-form textarea,.notice-form select{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--xm-line,#e5e7eb);border-radius:8px;font:inherit;background:var(--xm-bg,#fff);color:inherit;}" +
      ".notice-form textarea{min-height:120px;resize:vertical;}" +
      ".notice-check{display:flex;gap:12px;align-items:center;font-size:13px;}" +
      "html[data-theme=dark] .notice-tag{background:#1e3a5f;color:#93c5fd;}" +
      "html[data-theme=dark] .notice-tag.warn{background:#5b4630;color:#fde68a;}" +
      "html[data-theme=dark] .notice-tag.ok{background:#16351f;color:#86efac;}";
  }

  const TABS = [
    { id: "all", label: "公告管理" },
    { id: "hr", label: "人事异动" },
    { id: "promotion", label: "员工晋升报" },
    { id: "board", label: "龙虎榜" },
    { id: "values", label: "价值观践行" },
    { id: "daily", label: "日常公告" }
  ];
  const EXTRA_TABS = { board: true };

  function statusLabel(status) {
    if (status === "done") {
      return "已结束";
    }
    if (status === "draft") {
      return "草稿";
    }
    return "进行中";
  }

  window.XmModules = window.XmModules || {};
  window.XmModules["/notices"] = {
    mount: function (root) {
      ensureCss();
      let tab = "all";
      let filter = "active";
      let mode = "list";
      let current = null;
      let dead = false;

      async function api(path, options) {
        const res = await fetch(path, Object.assign({ credentials: "same-origin" }, options || {}));
        let data = {};
        try {
          data = await res.json();
        } catch (_err) {
          data = {};
        }
        return { res: res, data: data };
      }

      function paintShell() {
        root.innerHTML =
          '<main class="page notice-page">' +
          '<nav class="notice-tabs">' +
          TABS.map(function (item) {
            return (
              '<button type="button" class="notice-tab' +
              (item.id === tab ? " is-on" : "") +
              '" data-tab="' +
              item.id +
              '">' +
              item.label +
              "</button>"
            );
          }).join("") +
          "</nav>" +
          '<header class="notice-hero">' +
          '<div class="notice-hero-main"><div class="notice-mark" aria-hidden="true">公</div>' +
          "<div><p class=\"notice-kicker\">ANNOUNCEMENT CENTER</p><h1>公告中心</h1>" +
          '<p class="notice-lead">集中发布和管理全员公告，登录后可弹窗提醒，首页公告栏同步最新内容。</p></div></div>' +
          '<div class="notice-kpis" id="notice-kpis"></div></header>' +
          '<section class="notice-panel" id="notice-panel"></section></main>';
      }

      function formHtml(item) {
        const row = item || {};
        return (
          '<form class="notice-form" id="notice-form">' +
          "<h2>" +
          (row.id ? "编辑公告" : "发布公告") +
          "</h2>" +
          '<input name="title" required placeholder="标题" value="' +
          escapeHtml(row.title || "") +
          '" />' +
          '<input name="summary" placeholder="摘要" value="' +
          escapeHtml(row.summary || "") +
          '" />' +
          '<textarea name="body" placeholder="正文">' +
          escapeHtml(row.body || "") +
          "</textarea>" +
          '<select name="category">' +
          '<option value="general"' +
          (row.category === "general" ? " selected" : "") +
          ">公告</option>" +
          '<option value="hr"' +
          (row.category === "hr" ? " selected" : "") +
          ">人事异动</option>" +
          '<option value="promotion"' +
          (row.category === "promotion" ? " selected" : "") +
          ">晋升报</option>" +
          '<option value="anniversary"' +
          (row.category === "anniversary" ? " selected" : "") +
          ">周年庆</option>" +
          '<option value="daily"' +
          (row.category === "daily" ? " selected" : "") +
          ">日常公告</option>" +
          '<option value="values"' +
          (row.category === "values" ? " selected" : "") +
          ">价值观践行</option></select>" +
          '<select name="level"><option value="normal">普通</option><option value="important"' +
          (row.level === "important" ? " selected" : "") +
          ">重要</option></select>" +
          '<label class="notice-check"><input type="checkbox" name="popup"' +
          (row.popup ? " checked" : "") +
          " />登录后弹出</label>" +
          '<label class="notice-check"><input type="checkbox" name="banner"' +
          (row.banner !== false ? " checked" : "") +
          " />出现在首页公告栏</label>" +
          '<div class="notice-actions"><button type="submit" class="primary">保存</button>' +
          '<button type="button" id="notice-cancel">取消</button></div></form>'
        );
      }

      function detailHtml(item) {
        return (
          '<div class="notice-detail">' +
          '<div class="notice-tags"><span class="notice-tag">' +
          escapeHtml(statusLabel(item.status)) +
          '</span><span class="notice-tag warn">' +
          escapeHtml(item.level === "important" ? "重要" : "普通") +
          '</span><span class="notice-tag">' +
          escapeHtml(item.categoryLabel) +
          "</span></div>" +
          "<h2>" +
          escapeHtml(item.title) +
          "</h2>" +
          "<p>" +
          escapeHtml(item.body || item.summary || "暂无正文") +
          "</p>" +
          '<p class="notice-meta">' +
          escapeHtml(item.author || "—") +
          "</p>" +
          '<div class="notice-actions"><button type="button" id="notice-back">返回列表</button>' +
          '<button type="button" class="primary" id="notice-edit">编辑</button></div></div>'
        );
      }

      function listHtml(items) {
        if (!items.length) {
          return '<p class="notice-empty">这一档还没有公告。点右上角发布。</p>';
        }
        return items
          .map(function (item) {
            return (
              '<article class="notice-row" data-id="' +
              escapeHtml(item.id) +
              '"><div><div class="notice-tags"><span class="notice-tag">' +
              escapeHtml(statusLabel(item.status)) +
              '</span><span class="notice-tag warn">' +
              escapeHtml(item.level === "important" ? "重要" : "普通") +
              '</span><span class="notice-tag ok">' +
              escapeHtml(item.categoryLabel) +
              "</span></div><h3>" +
              escapeHtml(item.title) +
              "</h3><p>" +
              escapeHtml(item.summary || "") +
              '</p></div><div class="notice-meta">' +
              (item.images ? escapeHtml(item.categoryLabel) + " · " + item.images + " 张图<br>" : "") +
              escapeHtml(item.author || "") +
              "</div></article>"
            );
          })
          .join("");
      }

      function paintPanel(data) {
        const kpis = root.querySelector("#notice-kpis");
        const panel = root.querySelector("#notice-panel");
        if (kpis) {
          const stats = (data && data.stats) || { active: 0, unreadWeek: 0, receipt: 0 };
          kpis.innerHTML =
            "<div><b>" +
            stats.active +
            "</b><span>进行中</span></div><div><b>" +
            stats.unreadWeek +
            "</b><span>本周未读</span></div><div><b>" +
            stats.receipt +
            "</b><span>需回执</span></div>";
        }
        if (!panel) {
          return;
        }
        if (mode === "form") {
          panel.innerHTML = formHtml(current);
          return;
        }
        if (mode === "detail" && current) {
          panel.innerHTML = detailHtml(current);
          return;
        }
        if (tab === "board") {
          const people = (data && data.people) || [];
          const teams = (data && data.teams) || [];
          panel.innerHTML =
            '<div class="notice-toolbar"><div><h2>龙虎榜</h2><p class="notice-lead">按在营店铺数排名，数据来自组织中心店铺主数据。</p></div></div>' +
            '<div class="notice-split">' +
            '<table class="notice-table"><thead><tr><th>名次</th><th>店铺所属人员</th><th>在营</th><th>闲置</th><th>合计</th></tr></thead><tbody>' +
            (people.length
              ? people
                  .map(function (row) {
                    return (
                      "<tr><td>" +
                      escapeHtml(row.rank) +
                      "</td><td>" +
                      escapeHtml(row.name) +
                      "</td><td>" +
                      escapeHtml(row.operating) +
                      "</td><td>" +
                      escapeHtml(row.idle) +
                      "</td><td>" +
                      escapeHtml(row.stores) +
                      "</td></tr>"
                    );
                  })
                  .join("")
              : '<tr><td colspan="5" class="notice-empty">暂无排名</td></tr>') +
            "</tbody></table>" +
            '<table class="notice-table"><thead><tr><th>名次</th><th>团队</th><th>店铺</th><th>人数</th></tr></thead><tbody>' +
            (teams.length
              ? teams
                  .map(function (row) {
                    return (
                      "<tr><td>" +
                      escapeHtml(row.rank) +
                      "</td><td>" +
                      escapeHtml(row.name) +
                      "</td><td>" +
                      escapeHtml(row.stores) +
                      "</td><td>" +
                      escapeHtml(row.people) +
                      "</td></tr>"
                    );
                  })
                  .join("")
              : '<tr><td colspan="4" class="notice-empty">暂无团队</td></tr>') +
            "</tbody></table></div>";
          return;
        }
        if (tab === "values") {
          const items = (data && data.items) || [];
          panel.innerHTML =
            '<div class="notice-toolbar"><div><h2>价值观践行</h2><p class="notice-lead">记录谁在践行哪一条。</p></div>' +
            '<div class="notice-actions"><button type="button" class="primary" id="notice-create">+ 发布践行</button></div></div>' +
            (items.length
              ? '<table class="notice-table"><thead><tr><th>标题</th><th>摘要</th><th>发布人</th></tr></thead><tbody>' +
                items
                  .map(function (item) {
                    return (
                      '<tr class="notice-row" data-id="' +
                      escapeHtml(item.id) +
                      '"><td>' +
                      escapeHtml(item.title) +
                      "</td><td>" +
                      escapeHtml(item.summary || item.body || "") +
                      "</td><td>" +
                      escapeHtml(item.author || "—") +
                      "</td></tr>"
                    );
                  })
                  .join("") +
                "</tbody></table>"
              : '<p class="notice-empty">还没有价值观践行记录。点右上角发布。</p>');
          return;
        }
        const heading = tab === "daily" ? "日常公告" : "进行中的公告";
        panel.innerHTML =
          '<div class="notice-toolbar"><div><h2>' +
          heading +
          '</h2><p class="notice-lead">按重要程度和类型筛选。后续可在这里增改。</p></div>' +
          '<div class="notice-actions">' +
          '<button type="button" data-filter="active"' +
          (filter === "active" ? ' class="is-on"' : "") +
          ">进行中</button>" +
          '<button type="button" data-filter="all"' +
          (filter === "all" ? ' class="is-on"' : "") +
          ">全部</button>" +
          '<button type="button" class="primary" id="notice-create">+ 发布公告</button></div></div>' +
          listHtml((data && data.items) || []);
      }

      function load() {
        if (tab === "board") {
          return api("/api/people/org/board").then(function (result) {
            if (dead) {
              return;
            }
            paintPanel(result.data && result.data.ok ? result.data : { people: [], teams: [] });
          });
        }
        const query = filter === "all" ? "" : "status=" + encodeURIComponent(filter);
        const catId = tab === "all" || EXTRA_TABS[tab] ? "" : tab;
        const cat = catId ? (query ? "&" : "") + "category=" + encodeURIComponent(catId) : "";
        return api("/api/notices" + (query || cat ? "?" + query + cat : "")).then(function (result) {
          if (dead) {
            return;
          }
          paintPanel(result.data);
        });
      }

      paintShell();
      root.addEventListener("click", function (event) {
        const tabBtn = event.target.closest("[data-tab]");
        if (tabBtn) {
          tab = tabBtn.getAttribute("data-tab");
          mode = "list";
          current = null;
          paintShell();
          load();
          return;
        }
        const filterBtn = event.target.closest("[data-filter]");
        if (filterBtn) {
          filter = filterBtn.getAttribute("data-filter");
          mode = "list";
          load();
          return;
        }
        if (event.target.closest("#notice-create")) {
          mode = "form";
          current = {
            popup: false,
            banner: tab !== "values",
            category: tab === "all" || tab === "board" ? "general" : tab
          };
          paintPanel();
          return;
        }
        if (event.target.closest("#notice-cancel") || event.target.closest("#notice-back")) {
          mode = "list";
          current = null;
          load();
          return;
        }
        if (event.target.closest("#notice-edit") && current) {
          mode = "form";
          paintPanel();
          return;
        }
        const row = event.target.closest(".notice-row");
        if (row) {
          api("/api/notices/" + encodeURIComponent(row.getAttribute("data-id"))).then(function (result) {
            if (dead || !result.res.ok) {
              return;
            }
            mode = "detail";
            current = result.data.item;
            paintPanel();
          });
        }
      });
      root.addEventListener("submit", function (event) {
        const form = event.target.closest("#notice-form");
        if (!form) {
          return;
        }
        event.preventDefault();
        const body = {
          title: form.title.value,
          summary: form.summary.value,
          body: form.body.value,
          category: form.category.value,
          level: form.level.value,
          popup: form.popup.checked,
          banner: form.banner.checked,
          status: "active"
        };
        const path = current && current.id ? "/api/notices/" + encodeURIComponent(current.id) : "/api/notices";
        api(path, {
          method: current && current.id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        }).then(function (result) {
          if (dead) {
            return;
          }
          if (!result.res.ok) {
            window.alert(result.data.error || "保存失败");
            return;
          }
          mode = "list";
          current = null;
          load();
        });
      });
      load();
      return function unmount() {
        dead = true;
        const css = document.getElementById("xm-notices-css");
        if (css) {
          css.remove();
        }
        root.innerHTML = "";
      };
    }
  };
})();
