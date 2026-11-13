/* xm-module-han 0.1.65 */
(function () {
  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  window.XmModules = window.XmModules || {};

  function waitPage(title) {
    return {
      mount: function (root) {
        root.innerHTML =
          '<main class="page">' +
          '<header class="page-head"><p class="kicker">韩梦凯运营中心</p><h1>' +
          escapeHtml(title) +
          "</h1>" +
          '<p class="lead">内容待开发。</p></header></main>';
        return function unmount() {
          root.innerHTML = "";
        };
      }
    };
  }

  window.XmModules["/han/selection"] = waitPage("选品数据");
  window.XmModules["/han/goods"] = waitPage("商品数据");
  window.XmModules["/han/paid"] = waitPage("实时付费");
  window.XmModules["/han/training"] = waitPage("培训系统");

  window.XmModules["/han"] = {
    mount: function (root) {
      root.innerHTML =
        '<main class="page">' +
        '<header class="page-head"><p class="kicker">韩梦凯业务线</p><h1>韩梦凯运营中心</h1>' +
        '<p class="lead">任务和今日简报写入数据库，与沈子晗中心隔离。默认负责人是韩梦凯。</p></header>' +
        '<div class="stack"><section class="panel"><h2>新增任务</h2>' +
        '<form id="task-form"><label for="title">标题（必填）</label>' +
        '<input id="title" name="title" required placeholder="任务标题" />' +
        '<div class="actions"><button type="submit">添加</button></div>' +
        '<p class="msg status" id="task-msg"></p></form></section>' +
        '<section class="panel"><h2>任务列表</h2><table><thead><tr><th>标题</th><th>状态</th><th>负责人</th></tr></thead>' +
        '<tbody id="task-body"></tbody></table></section>' +
        '<section class="panel"><h2>今日简报</h2><form id="brief-form"><label for="brief">简报</label>' +
        '<textarea id="brief" name="text" placeholder="今日进展…"></textarea>' +
        '<div class="actions"><button type="submit">保存简报</button></div>' +
        '<p class="msg status" id="brief-msg"></p></form></section></div></main>';

      const taskBody = root.querySelector("#task-body");
      const taskMsg = root.querySelector("#task-msg");
      const briefMsg = root.querySelector("#brief-msg");
      const briefEl = root.querySelector("#brief");
      const taskForm = root.querySelector("#task-form");
      const briefForm = root.querySelector("#brief-form");
      let dead = false;

      function renderTasks(tasks) {
        taskBody.innerHTML = "";
        if (!tasks || !tasks.length) {
          taskBody.innerHTML = '<tr><td colspan="3" class="empty">暂无任务</td></tr>';
          return;
        }
        tasks.forEach(function (t) {
          const tr = document.createElement("tr");
          tr.innerHTML =
            "<td>" +
            escapeHtml(t.title) +
            '</td><td class="status">' +
            escapeHtml(t.status) +
            "</td><td>" +
            escapeHtml(t.owner) +
            "</td>";
          taskBody.appendChild(tr);
        });
      }

      async function load() {
        const [tasksRes, briefRes] = await Promise.all([
          fetch("/api/han/tasks", { credentials: "same-origin" }),
          fetch("/api/han/brief", { credentials: "same-origin" })
        ]);
        const tasksJson = await tasksRes.json();
        const briefJson = await briefRes.json();
        if (dead) {
          return;
        }
        renderTasks(tasksJson.tasks);
        briefEl.value = briefJson.text || "";
      }

      function onTask(e) {
        e.preventDefault();
        const title = root.querySelector("#title").value;
        fetch("/api/han/tasks", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title })
        })
          .then(function (res) { return res.json(); })
          .then(function (json) {
            if (dead) {
              return;
            }
            taskMsg.textContent = json.ok ? "已添加" : json.error || "失败";
            taskMsg.className = "msg status" + (json.ok ? " ok" : " error");
            if (json.ok) {
              root.querySelector("#title").value = "";
              return load();
            }
          });
      }

      function onBrief(e) {
        e.preventDefault();
        fetch("/api/han/brief", {
          method: "PUT",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: briefEl.value })
        })
          .then(function (res) { return res.json(); })
          .then(function (json) {
            if (dead) {
              return;
            }
            briefMsg.textContent = json.ok ? "已保存" : "保存失败";
            briefMsg.className = "msg status" + (json.ok ? " ok" : " error");
          });
      }

      taskForm.addEventListener("submit", onTask);
      briefForm.addEventListener("submit", onBrief);
      load().catch(function (err) {
        if (!dead) {
          taskMsg.textContent = String(err);
          taskMsg.className = "msg status error";
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
