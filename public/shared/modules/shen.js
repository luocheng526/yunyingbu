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
      if (!document.querySelector('link[href^="/shared/shen-paid.css"]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "/shared/shen-paid.css";
        document.head.appendChild(link);
      }

      root.innerHTML =
        '<main class="page xm-paid">' +
        '<header class="page-head"><div><h1>付费中心</h1>' +
        '<p class="lead" id="paid-lead">最新一次回传的全店快照。点店铺名称下钻查看子账号和充值记录。</p></div>' +
        '<div class="xm-paid-meta"><span class="xm-paid-dot" aria-hidden="true"></span>' +
        '<span id="paid-asof">等待回传</span></div></header>' +
        '<section class="kpi-grid" id="paid-kpis"></section>' +
        '<div id="paid-body"></div>' +
        '<p id="paid-status" class="status" role="status"></p></main>';

      const leadEl = root.querySelector("#paid-lead");
      const asofEl = root.querySelector("#paid-asof");
      const kpiEl = root.querySelector("#paid-kpis");
      const bodyEl = root.querySelector("#paid-body");
      const statusEl = root.querySelector("#paid-status");
      let dead = false;
      let overviewRows = [];
      let keyword = "";
      let includeHistory = false;

      function setStatus(message, isError) {
        statusEl.textContent = message || "";
        statusEl.className = "status" + (isError ? " error" : message ? " ok" : "");
      }

      function money(value) {
        return (Number(value) || 0).toLocaleString("zh-CN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        });
      }

      function integer(value) {
        return (Number(value) || 0).toLocaleString("zh-CN");
      }

      function rate(value) {
        return (Number(value) || 0).toFixed(2);
      }

      function recorded(value) {
        const text = String(value == null ? "" : value).trim();
        return text ? escapeHtml(text) : "未记录";
      }

      function successTag(value) {
        if (value === "是") {
          return '<span class="xm-paid-tag is-yes">是</span>';
        }
        if (value === "否") {
          return '<span class="xm-paid-tag is-no">否</span>';
        }
        return '<span class="xm-paid-tag is-empty">' + escapeHtml(value || "—") + "</span>";
      }

      function currentStore() {
        const hash = String(location.hash || "").replace(/^#/, "");
        return new URLSearchParams(hash).get("store") || "";
      }

      function setStore(store) {
        if (!store) {
          history.replaceState(null, "", location.pathname + location.search);
          return;
        }
        location.hash = "store=" + encodeURIComponent(store);
      }

      function renderKpis(metrics) {
        const cards = [
          {
            label: metrics.subs ? "子账号" : metrics.detail ? "抓取天数" : "店铺数",
            value: integer(metrics.stores),
            unit: metrics.subs ? "个" : metrics.detail ? "天" : "家"
          },
          { label: "京准通花费", value: money(metrics.spend) },
          { label: "京麦成交", value: money(metrics.jingmaiGmv) },
          { label: "总订单金额", value: money(metrics.totalOrderAmount) },
          { label: "付费订单", value: integer(metrics.paidOrders), unit: "单" },
          {
            label: metrics.detail ? "成功回传" : "回传成功",
            value: integer(metrics.successCount),
            unit: metrics.detail ? "天" : "店"
          }
        ];
        kpiEl.innerHTML = cards
          .map(function (card) {
            return (
              '<article class="kpi-card"><div class="label">' +
              escapeHtml(card.label) +
              '</div><div class="value">' +
              card.value +
              (card.unit ? '<span class="unit">' + escapeHtml(card.unit) + "</span>" : "") +
              "</div></article>"
            );
          })
          .join("");
      }

      function metricCells(row) {
        return (
          "<td>" +
          escapeHtml(row.accountId || "—") +
          "</td><td>" +
          money(row.spend) +
          "</td><td>" +
          integer(row.paidOrders) +
          "</td><td>" +
          rate(row.roi) +
          "</td><td>" +
          rate(row.cvr) +
          "</td><td>" +
          money(row.cpc) +
          "</td><td>" +
          money(row.jingmaiGmv) +
          "</td><td>" +
          integer(row.clicks) +
          "</td><td>" +
          rate(row.ctr) +
          "</td><td>" +
          money(row.totalOrderAmount) +
          "</td><td>" +
          rate(row.realFeeRatio) +
          "</td><td>" +
          successTag(row.success) +
          "</td>"
        );
      }

      function headerRow(first) {
        return (
          "<thead><tr><th>" +
          first +
          "</th><th>京准通主账户ID</th><th>京准通花费</th>" +
          "<th>京准通付费订单数</th><th>京准通付费投产比</th><th>京准通付费转化率</th>" +
          "<th>京准通平均点击成本</th><th>京麦成交金额</th><th>京准通点击数</th>" +
          "<th>京准通点击率</th><th>京准通总订单金额</th><th>真实费比</th><th>是否成功</th>" +
          "</tr></thead>"
        );
      }

      function isZeroRow(row) {
        return !(Number(row.spend) || Number(row.paidOrders) || Number(row.jingmaiGmv) || Number(row.clicks));
      }

      function renderOverviewTable(rows) {
        const filtered = keyword
          ? rows.filter(function (row) {
              return String(row.store || "").indexOf(keyword) >= 0;
            })
          : rows;
        if (!filtered.length) {
          return '<p class="empty">暂无回传数据</p>';
        }
        const body = filtered
          .map(function (row) {
            return (
              '<tr class="' +
              (isZeroRow(row) ? "is-zero" : "") +
              '"><td><a class="xm-paid-store" href="#store=' +
              encodeURIComponent(row.store) +
              '">' +
              escapeHtml(row.store) +
              '</a><span class="xm-paid-date">' +
              escapeHtml(row.date) +
              "</span></td>" +
              metricCells(row) +
              "</tr>"
            );
          })
          .join("");
        return (
          '<div class="xm-paid-table-wrap"><table>' + headerRow("店铺名称") + "<tbody>" + body + "</tbody></table></div>"
        );
      }

      function renderOverview(data) {
        overviewRows = data.rows || [];
        const metrics = data.metrics || {};
        const roster = data.enabledStores || [];
        leadEl.textContent = roster.length
          ? "默认只展示当前启用店铺。历史回传保留，可点「含历史店铺」查看。"
          : "最新一次回传的全店快照。点店铺名称下钻查看该店全部子账号。";
        asofEl.textContent = data.asOf
          ? "最新回传 " +
            data.asOf +
            " · " +
            (data.scope === "all" && roster.length ? "含历史 " : roster.length ? "当前启用 " : "") +
            (metrics.stores || 0) +
            " 店"
          : "等待回传";
        renderKpis(metrics);
        bodyEl.innerHTML =
          '<section class="panel" aria-labelledby="paid-latest-heading">' +
          '<div class="xm-paid-toolbar"><h2 id="paid-latest-heading">本次回传</h2>' +
          '<div class="row"><input id="paid-store-filter" type="search" maxlength="64" placeholder="搜索店铺名称" />' +
          (roster.length
            ? '<button type="button" class="xm-paid-scope" id="paid-scope">' +
              (includeHistory ? "只看启用店铺" : "含历史店铺") +
              "</button>"
            : "") +
          "</div></div>" +
          '<div id="paid-table-wrap">' +
          renderOverviewTable(overviewRows) +
          "</div></section>";
        const filter = root.querySelector("#paid-store-filter");
        if (filter) {
          filter.value = keyword;
          filter.addEventListener("input", function () {
            keyword = filter.value.trim();
            const wrap = root.querySelector("#paid-table-wrap");
            if (wrap) {
              wrap.innerHTML = renderOverviewTable(overviewRows);
            }
          });
        }
        const scopeBtn = root.querySelector("#paid-scope");
        if (scopeBtn) {
          scopeBtn.addEventListener("click", function () {
            includeHistory = !includeHistory;
            load();
          });
        }
      }

      function subCells(row) {
        return (
          "<td>" +
          money(row.balance) +
          "</td><td>" +
          escapeHtml(row.remark || "—") +
          "</td><td>" +
          money(row.spend) +
          "</td><td>" +
          rate(row.roi) +
          "</td><td>" +
          integer(row.paidOrders) +
          "</td><td>" +
          money(row.totalOrderAmount) +
          "</td><td>" +
          integer(row.impressions) +
          "</td><td>" +
          integer(row.clicks) +
          "</td><td>" +
          rate(row.ctr) +
          "</td><td>" +
          money(row.cpc) +
          "</td>"
        );
      }

      function renderSubaccounts(accounts) {
        if (!accounts.length) {
          return '<p class="empty">本地程序尚未回传子账号明细</p>';
        }
        const body = accounts
          .map(function (group, index) {
            const latest = group.latest || {};
            const days = group.days || [];
            const dayRows = days
              .map(function (row) {
                return (
                  "<tr><td>" +
                  escapeHtml(row.date) +
                  "</td>" +
                  subCells(row) +
                  "</tr>"
                );
              })
              .join("");
            return (
              '<tr class="xm-paid-sub-row" data-sub-index="' +
              index +
              '"><td><button type="button" class="xm-paid-expand" aria-expanded="false" data-sub-index="' +
              index +
              '">▸</button><span class="xm-paid-sub-name">' +
              escapeHtml(group.subAccountName || group.subAccountId) +
              '</span><span class="xm-paid-date">' +
              escapeHtml(group.subAccountId) +
              (latest.date ? " · " + latest.date : "") +
              "</span></td>" +
              subCells(latest) +
              "</tr>" +
              '<tr class="xm-paid-sub-history" data-sub-index="' +
              index +
              '" hidden><td colspan="11"><div class="xm-paid-nested"><p class="lead">该子账号各时间段明细</p><table><thead><tr>' +
              "<th>日期</th><th>余额</th><th>账户备注</th><th>花费</th><th>投产比</th><th>单量</th>" +
              "<th>订单金额</th><th>展现数</th><th>点击数</th><th>点击率</th><th>平均点击成本</th>" +
              "</tr></thead><tbody>" +
              dayRows +
              "</tbody></table></div></td></tr>"
            );
          })
          .join("");
        return (
          '<div class="xm-paid-table-wrap"><table><thead><tr>' +
          "<th>子账号</th><th>余额</th><th>账户备注</th><th>花费</th><th>投产比</th><th>单量</th>" +
          "<th>订单金额</th><th>展现数</th><th>点击数</th><th>点击率</th><th>平均点击成本</th>" +
          "</tr></thead><tbody>" +
          body +
          "</tbody></table></div>"
        );
      }

      function renderDetail(store, paid, subaccounts, recharge) {
        const rows = paid.rows || [];
        const latest = rows[0] || { store: store };
        const accounts = subaccounts.accounts || [];
        const subTotals = subaccounts.totals || {};
        leadEl.textContent = "该店全部子账号。点左侧箭头展开每个时间段的明细。";
        asofEl.textContent =
          (latest.accountId ? "京准通主账户 " + latest.accountId + " · " : "") +
          (accounts.length || 0) +
          " 个子账号";
        renderKpis({
          detail: true,
          subs: true,
          stores: accounts.length || rows.length,
          spend: subTotals.spend || latest.spend,
          jingmaiGmv: latest.jingmaiGmv,
          totalOrderAmount: subTotals.totalOrderAmount || latest.totalOrderAmount,
          paidOrders: subTotals.paidOrders || latest.paidOrders,
          successCount: (paid.metrics || {}).successCount
        });
        const rechargeRows = recharge.rows || [];
        const rechargeTable = rechargeRows.length
          ? '<div class="xm-paid-table-wrap"><table><thead><tr>' +
            "<th>充值日期</th><th>充值时间</th><th>子账号ID</th><th>子账号名称</th><th>充值金额</th><th>账户余额</th><th>渠道</th><th>备注</th>" +
            "</tr></thead><tbody>" +
            rechargeRows
              .map(function (row) {
                return (
                  "<tr><td>" +
                  escapeHtml(row.date) +
                  "</td><td>" +
                  escapeHtml(row.chargedAt || "—") +
                  "</td><td>" +
                  recorded(row.subAccountId) +
                  "</td><td>" +
                  recorded(row.subAccountName) +
                  "</td><td>" +
                  money(row.amount) +
                  "</td><td>" +
                  money(row.balance) +
                  "</td><td>" +
                  escapeHtml(row.channel || "—") +
                  "</td><td>" +
                  escapeHtml(row.remark || "—") +
                  "</td></tr>"
                );
              })
              .join("") +
            "</tbody></table></div>"
          : '<p class="empty">暂无充值记录，本地程序回传后在此展示</p>';
        bodyEl.innerHTML =
          '<section class="panel"><div class="xm-paid-toolbar"><div class="xm-paid-toolbar-left">' +
          '<button type="button" class="xm-paid-back" id="paid-back">返回付费中心</button>' +
          "<h2>" +
          escapeHtml(store) +
          "</h2></div></div></section>" +
          '<div class="xm-paid-detail-grid">' +
          '<section class="panel"><h2>子账号</h2>' +
          renderSubaccounts(accounts) +
          "</section>" +
          '<section class="panel"><h2>充值记录</h2><p class="lead">累计充值 ' +
          money((recharge.totals || {}).amount) +
          " · " +
          integer((recharge.totals || {}).count) +
          " 笔</p>" +
          rechargeTable +
          "</section></div>";
        const back = root.querySelector("#paid-back");
        if (back) {
          back.addEventListener("click", function () {
            setStore("");
            load();
          });
        }
        Array.prototype.forEach.call(root.querySelectorAll(".xm-paid-expand"), function (btn) {
          btn.addEventListener("click", function () {
            const index = btn.getAttribute("data-sub-index");
            const history = root.querySelector('.xm-paid-sub-history[data-sub-index="' + index + '"]');
            if (!history) {
              return;
            }
            const open = history.hasAttribute("hidden");
            history.toggleAttribute("hidden", !open);
            btn.setAttribute("aria-expanded", open ? "true" : "false");
            btn.textContent = open ? "▾" : "▸";
          });
        });
      }

      function getJson(url) {
        return fetch(url, { credentials: "same-origin" }).then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (data) {
            if (!res.ok) {
              throw new Error(data.error || "无法加载付费数据");
            }
            return data;
          });
        });
      }

      function load() {
        const store = currentStore();
        setStatus("正在加载…");
        if (store) {
          return Promise.all([
            getJson("/api/shen/paid?store=" + encodeURIComponent(store) + "&limit=1000"),
            getJson("/api/shen/paid/subaccounts?store=" + encodeURIComponent(store) + "&limit=2000"),
            getJson("/api/shen/paid/recharges?store=" + encodeURIComponent(store) + "&limit=1000")
          ])
            .then(function (pair) {
              if (!dead) {
                renderDetail(store, pair[0], pair[1], pair[2]);
                setStatus("已更新");
              }
            })
            .catch(function (err) {
              if (!dead) {
                setStatus(err.message || "加载失败", true);
              }
            });
        }
        return getJson("/api/shen/paid?view=latest&limit=500" + (includeHistory ? "&scope=all" : ""))
          .then(function (data) {
            if (!dead) {
              renderOverview(data);
              setStatus("已更新");
            }
          })
          .catch(function (err) {
            if (!dead) {
              setStatus(err.message || "加载失败", true);
            }
          });
      }

      function onHash() {
        load();
      }

      window.addEventListener("hashchange", onHash);
      load();
      return function unmount() {
        dead = true;
        window.removeEventListener("hashchange", onHash);
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
