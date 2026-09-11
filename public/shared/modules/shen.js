/* xm-module-shen 0.1.65 */
(function () {
  var ITEMS = [
    { href: "/shen/selection", label: "产品中心" },
    { href: "/shen/paid", label: "付费中心" },
    { href: "/shen/training", label: "培训系统" },
    { href: "/shen/tasks", label: "任务管理" }
  ];

  function pathNow() {
    return String(location.pathname || "/").replace(/\/+$/, "") || "/";
  }

  function rewriteOfficialShenMenu() {
    var group = document.querySelector('.xm-menu-group[data-xm-group="/shen"]');
    if (!group) {
      return;
    }
    var sub = group.querySelector(".xm-submenu");
    if (!sub) {
      return;
    }
    var text = sub.textContent || "";
    if (
      !sub.querySelector('a[href="/shen/product"]') &&
      text.indexOf("选品中心") === -1 &&
      text.indexOf("商品成长") === -1 &&
      text.indexOf("实时付费") === -1 &&
      text.indexOf("产品中心") !== -1
    ) {
      return;
    }
    var ico = sub.querySelector(".xm-ico");
    var icon = ico ? ico.outerHTML : "";
    var activeHref = pathNow();
    if (activeHref === "/shen/product" || activeHref === "/shen/growth") {
      activeHref = "/shen/selection";
    }
    sub.innerHTML = ITEMS.map(function (item) {
      var active = item.href === activeHref;
      return (
        '<a class="xm-menu-item xm-menu-child' +
        (active ? " is-active" : "") +
        '" href="' +
        item.href +
        '"' +
        (active ? ' aria-current="page"' : "") +
        ">" +
        icon +
        "<span>" +
        item.label +
        "</span></a>"
      );
    }).join("");
  }

  document.addEventListener(
    "click",
    function (event) {
      var link = event.target.closest("a[href]");
      if (!link) {
        return;
      }
      var href = String(link.getAttribute("href") || "").replace(/\/+$/, "") || "/";
      if (href === "/shen/product" || href === "/shen/growth") {
        event.preventDefault();
        if (typeof window.__xmGo === "function") {
          window.__xmGo("/shen/selection", true);
        } else {
          location.assign("/shen/selection");
        }
      }
    },
    true
  );

  rewriteOfficialShenMenu();
  var timer = 0;
  var observer = new MutationObserver(function () {
    window.clearTimeout(timer);
    timer = window.setTimeout(rewriteOfficialShenMenu, 30);
  });
  if (document.documentElement) {
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

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

  window.XmModules["/shen/product"] = waitPage("产品中心");
  window.XmModules["/shen/selection"] = waitPage("产品中心");
  window.XmModules["/shen/growth"] = waitPage("产品中心");
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
