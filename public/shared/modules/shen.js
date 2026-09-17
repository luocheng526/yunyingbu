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

  window.XmModules["/shen/product"] = waitPage("产品中心");
  window.XmModules["/shen/product/xuanpin"] = waitPage("选品");
  window.XmModules["/shen/product/youhua"] = waitPage("优化");
  window.XmModules["/shen/product/chengzhang"] = waitPage("产品成长");
  window.XmModules["/shen/selection"] = waitPage("选品");
  window.XmModules["/shen/growth"] = waitPage("产品成长");
  window.XmModules["/shen/paid"] = {
    mount: function (root) {
      root.innerHTML =
        '<main class="page">' +
        '<header class="page-head"><p class="kicker">沈子晗运营中心</p><h1>付费中心</h1>' +
        '<p class="lead">本地程序跑完后回传到 <code>POST /api/shen/paid/ingest</code>，同一店铺名称 + 日期再传会覆盖。</p></header>' +
        '<div class="stack">' +
        '<section class="panel" aria-labelledby="paid-filter-heading"><h2 id="paid-filter-heading">回传记录</h2>' +
        '<form id="paid-filter"><div class="row">' +
        '<label for="paid-store">店</label>' +
        '<input id="paid-store" name="store" type="text" maxlength="64" placeholder="可选，留空看全部" />' +
        '<label for="paid-from">从</label>' +
        '<input id="paid-from" name="from" type="date" />' +
        '<label for="paid-to">到</label>' +
        '<input id="paid-to" name="to" type="date" />' +
        '<button type="submit">查询</button></div></form>' +
        '<p id="paid-totals" class="lead"></p>' +
        '<p id="paid-status" class="status" role="status"></p>' +
        '<div id="paid-table-wrap"><p class="empty">暂无回传数据</p></div></section></div></main>';

      const form = root.querySelector("#paid-filter");
      const storeInput = root.querySelector("#paid-store");
      const fromInput = root.querySelector("#paid-from");
      const toInput = root.querySelector("#paid-to");
      const totalsEl = root.querySelector("#paid-totals");
      const statusEl = root.querySelector("#paid-status");
      const tableWrap = root.querySelector("#paid-table-wrap");
      let dead = false;

      function setStatus(message, isError) {
        statusEl.textContent = message || "";
        statusEl.className = "status" + (isError ? " error" : message ? " ok" : "");
      }

      function money(value) {
        return (Number(value) || 0).toFixed(2);
      }

      function rate(value) {
        return (Number(value) || 0).toFixed(2);
      }

      function render(data) {
        const totals = data.totals || {};
        totalsEl.textContent =
          "合计 " +
          (totals.count || 0) +
          " 行 · 京准通花费 " +
          money(totals.spend) +
          " · 付费订单 " +
          (totals.paidOrders || 0) +
          " · 京麦成交 " +
          money(totals.jingmaiGmv) +
          " · 总订单金额 " +
          money(totals.totalOrderAmount);
        const rows = data.rows || [];
        if (!rows.length) {
          tableWrap.innerHTML = '<p class="empty">暂无回传数据</p>';
          return;
        }
        const body = rows
          .map(function (row) {
            return (
              "<tr><td>" +
              escapeHtml(row.store) +
              "</td><td>" +
              escapeHtml(row.accountId) +
              "</td><td>" +
              money(row.spend) +
              "</td><td>" +
              escapeHtml(row.paidOrders) +
              "</td><td>" +
              rate(row.roi) +
              "</td><td>" +
              rate(row.cvr) +
              "</td><td>" +
              money(row.cpc) +
              "</td><td>" +
              money(row.jingmaiGmv) +
              "</td><td>" +
              escapeHtml(row.clicks) +
              "</td><td>" +
              rate(row.ctr) +
              "</td><td>" +
              money(row.totalOrderAmount) +
              "</td><td>" +
              rate(row.realFeeRatio) +
              "</td><td>" +
              escapeHtml(row.success) +
              "</td></tr>"
            );
          })
          .join("");
        tableWrap.innerHTML =
          "<table><thead><tr>" +
          "<th>店铺名称</th><th>京准通主账户ID</th><th>京准通花费</th>" +
          "<th>京准通付费订单数</th><th>京准通付费投产比</th><th>京准通付费转化率</th>" +
          "<th>京准通平均点击成本</th><th>京麦成交金额</th><th>京准通点击数</th>" +
          "<th>京准通点击率</th><th>京准通总订单金额</th><th>真实费比</th><th>是否成功</th>" +
          "</tr></thead><tbody>" +
          body +
          "</tbody></table>";
      }

      function load() {
        const params = new URLSearchParams();
        const store = storeInput.value.trim();
        const from = fromInput.value;
        const to = toInput.value;
        if (store) {
          params.set("store", store);
        }
        if (from) {
          params.set("from", from);
        }
        if (to) {
          params.set("to", to);
        }
        setStatus("正在加载…");
        return fetch("/api/shen/paid?" + params.toString(), { credentials: "same-origin" })
          .then(function (res) {
            return res.json().catch(function () { return {}; }).then(function (data) {
              if (!res.ok) {
                throw new Error(data.error || "无法加载付费数据");
              }
              return data;
            });
          })
          .then(function (data) {
            if (!dead) {
              render(data);
              setStatus("已更新");
            }
          })
          .catch(function (err) {
            if (!dead) {
              setStatus(err.message || "加载失败", true);
            }
          });
      }

      function onFilter(event) {
        event.preventDefault();
        load();
      }

      form.addEventListener("submit", onFilter);
      load();
      return function unmount() {
        dead = true;
        form.removeEventListener("submit", onFilter);
        root.innerHTML = "";
      };
    }
  };
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
