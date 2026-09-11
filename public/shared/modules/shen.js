/* xm-module-shen */
(function () {
  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  window.XmModules = window.XmModules || {};

  function waitPage(title) {
    return {
      mount: function (root) {
        root.innerHTML =
          '<main class="page">' +
          '<header class="page-head"><p class="kicker">沈子晗运营中心</p><h1>' +
          escapeHtml(title) +
          "</h1>" +
          '<p class="lead">内容待开发。</p></header></main>';
        return function unmount() {
          root.innerHTML = "";
        };
      }
    };
  }

  var PRODUCT_TABS = [
    { id: "xuanpin", label: "选品" },
    { id: "youhua", label: "优化" },
    { id: "chengzhang", label: "产品成长" }
  ];

  function productTabId() {
    var hash = String(location.hash || "").replace(/^#/, "").toLowerCase();
    for (var i = 0; i < PRODUCT_TABS.length; i += 1) {
      if (PRODUCT_TABS[i].id === hash) {
        return hash;
      }
    }
    return "xuanpin";
  }

  function productCenterPage() {
    return {
      mount: function (root) {
        var tabButtons = PRODUCT_TABS.map(function (tab) {
          return (
            '<button type="button" class="shen-product-tab" data-product-tab="' +
            tab.id +
            '" aria-controls="shen-product-pane-' +
            tab.id +
            '">' +
            escapeHtml(tab.label) +
            "</button>"
          );
        }).join("");
        var panes = PRODUCT_TABS.map(function (tab) {
          return (
            '<section class="panel shen-product-pane" id="shen-product-pane-' +
            tab.id +
            '" data-product-pane="' +
            tab.id +
            '" hidden>' +
            "<h2>" +
            escapeHtml(tab.label) +
            "</h2>" +
            '<p class="lead">内容待开发。</p></section>'
          );
        }).join("");
        root.innerHTML =
          '<main class="page">' +
          '<header class="page-head"><p class="kicker">沈子晗运营中心</p><h1>产品中心</h1>' +
          '<p class="lead">产品中心分为选品、优化、产品成长三个模块。</p></header>' +
          '<nav class="shen-product-tabs" aria-label="产品中心分页">' +
          tabButtons +
          "</nav>" +
          '<div class="stack">' +
          panes +
          "</div>" +
          "<style>" +
          ".shen-product-tabs{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 16px}" +
          ".shen-product-tab{appearance:none;border:1px solid var(--xm-border, #d9dde3);background:var(--xm-surface, #fff);color:var(--xm-text, #1f2329);border-radius:999px;padding:8px 16px;cursor:pointer;font:inherit}" +
          '.shen-product-tab[aria-selected="true"]{background:var(--xm-accent, #1677ff);border-color:var(--xm-accent, #1677ff);color:#fff}' +
          "</style></main>";

        function applyTab() {
          var active = productTabId();
          var buttons = root.querySelectorAll("[data-product-tab]");
          var sections = root.querySelectorAll("[data-product-pane]");
          for (var i = 0; i < buttons.length; i += 1) {
            var selected = buttons[i].getAttribute("data-product-tab") === active;
            buttons[i].setAttribute("aria-selected", selected ? "true" : "false");
          }
          for (var j = 0; j < sections.length; j += 1) {
            sections[j].hidden = sections[j].getAttribute("data-product-pane") !== active;
          }
        }

        function onHashChange() {
          applyTab();
        }

        function onClick(event) {
          var btn = event.target.closest("[data-product-tab]");
          if (!btn || !root.contains(btn)) {
            return;
          }
          event.preventDefault();
          var id = btn.getAttribute("data-product-tab");
          if (location.hash !== "#" + id) {
            location.hash = id;
          } else {
            applyTab();
          }
        }

        root.addEventListener("click", onClick);
        window.addEventListener("hashchange", onHashChange);
        applyTab();

        return function unmount() {
          root.removeEventListener("click", onClick);
          window.removeEventListener("hashchange", onHashChange);
          root.innerHTML = "";
        };
      }
    };
  }

  window.XmModules["/shen/product"] = productCenterPage();
  window.XmModules["/shen/selection"] = productCenterPage();
  window.XmModules["/shen/growth"] = productCenterPage();
  window.XmModules["/shen/paid"] = waitPage("付费中心");
  window.XmModules["/shen/training"] = waitPage("培训系统");
  window.XmModules["/shen/tasks"] = waitPage("任务管理");

  window.XmModules["/shen"] = {
    mount: function (root) {
      root.innerHTML =
        '<main class="page">' +
        '<header class="page-head"><p class="kicker">沈子晗团队</p><h1>沈子晗运营中心</h1>' +
        '<p class="lead">任务和今日简报写入数据库，与韩梦凯中心隔离。进程重启后记录还在。</p></header>' +
        '<div class="stack">' +
        '<section class="panel" aria-labelledby="task-heading"><h2 id="task-heading">任务列表</h2>' +
        '<form id="task-form"><label for="task-title">任务标题（必填）</label><div class="row">' +
        '<input id="task-title" name="title" type="text" required maxlength="200" placeholder="例如：跟进今日达人排期" />' +
        '<button type="submit">新增任务</button></div></form>' +
        '<p id="task-status" class="status" role="status"></p><div id="task-table-wrap"><p class="empty">暂无任务</p></div></section>' +
        '<section class="panel" aria-labelledby="brief-heading"><h2 id="brief-heading">今日简报</h2>' +
        '<form id="brief-form"><label for="brief-text">简报内容</label>' +
        '<textarea id="brief-text" name="text" placeholder="记录今天的进展、风险与需要协调的事项"></textarea>' +
        '<div class="row"><button type="submit">保存简报</button></div></form>' +
        '<p id="brief-status" class="status" role="status"></p></section></div></main>';

      const taskForm = root.querySelector("#task-form");
      const taskTitle = root.querySelector("#task-title");
      const taskStatus = root.querySelector("#task-status");
      const taskTableWrap = root.querySelector("#task-table-wrap");
      const briefForm = root.querySelector("#brief-form");
      const briefText = root.querySelector("#brief-text");
      const briefStatus = root.querySelector("#brief-status");
      let dead = false;

      function setStatus(el, message, isError) {
        el.textContent = message || "";
        el.className = "status" + (isError ? " error" : message ? " ok" : "");
      }

      function renderTasks(tasks) {
        if (!tasks.length) {
          taskTableWrap.innerHTML = '<p class="empty">暂无任务</p>';
          return;
        }
        const rows = tasks
          .map(function (task) {
            return (
              "<tr><td>" +
              escapeHtml(task.title) +
              "</td><td>" +
              escapeHtml(task.status) +
              "</td><td>" +
              escapeHtml(task.owner) +
              "</td></tr>"
            );
          })
          .join("");
        taskTableWrap.innerHTML =
          "<table><thead><tr><th>标题</th><th>状态</th><th>负责人</th></tr></thead><tbody>" +
          rows +
          "</tbody></table>";
      }

      async function loadTasks() {
        const res = await fetch("/api/shen/tasks", { credentials: "same-origin" });
        if (!res.ok) {
          throw new Error("无法加载任务");
        }
        const data = await res.json();
        if (!dead) {
          renderTasks(Array.isArray(data) ? data : data.tasks || []);
        }
      }

      async function loadBrief() {
        const res = await fetch("/api/shen/brief", { credentials: "same-origin" });
        if (!res.ok) {
          throw new Error("无法加载简报");
        }
        const data = await res.json();
        if (!dead) {
          briefText.value = data.text || "";
        }
      }

      function onTask(event) {
        event.preventDefault();
        const title = taskTitle.value.trim();
        if (!title) {
          setStatus(taskStatus, "请填写任务标题", true);
          return;
        }
        setStatus(taskStatus, "正在保存…");
        fetch("/api/shen/tasks", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title })
        })
          .then(function (res) {
            return res.json().catch(function () { return {}; }).then(function (data) {
              if (!res.ok) {
                throw new Error(data.error || "新增失败");
              }
            });
          })
          .then(function () {
            taskTitle.value = "";
            return loadTasks();
          })
          .then(function () {
            if (!dead) {
              setStatus(taskStatus, "已新增任务");
            }
          })
          .catch(function (err) {
            if (!dead) {
              setStatus(taskStatus, err.message || "新增失败", true);
            }
          });
      }

      function onBrief(event) {
        event.preventDefault();
        setStatus(briefStatus, "正在保存…");
        fetch("/api/shen/brief", {
          method: "PUT",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: briefText.value })
        })
          .then(function (res) {
            return res.json().catch(function () { return {}; }).then(function (data) {
              if (!res.ok) {
                throw new Error(data.error || "保存失败");
              }
              return data;
            });
          })
          .then(function (data) {
            if (!dead) {
              briefText.value = data.text || briefText.value;
              setStatus(briefStatus, "简报已保存");
            }
          })
          .catch(function (err) {
            if (!dead) {
              setStatus(briefStatus, err.message || "保存失败", true);
            }
          });
      }

      taskForm.addEventListener("submit", onTask);
      briefForm.addEventListener("submit", onBrief);
      Promise.all([loadTasks(), loadBrief()]).catch(function (err) {
        if (!dead) {
          setStatus(taskStatus, err.message || "加载失败", true);
        }
      });

      return function unmount() {
        dead = true;
        taskForm.removeEventListener("submit", onTask);
        briefForm.removeEventListener("submit", onBrief);
        root.innerHTML = "";
      };
    }
  };
})();
