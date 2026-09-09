/* han submenu pages — 韩梦凯运营中心 */
(function () {
  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  window.XmModules = window.XmModules || {};

  function page(title, lead, body) {
    return (
      '<main class="page">' +
      '<header class="page-head"><p class="kicker">韩梦凯运营中心</p><h1>' +
      escapeHtml(title) +
      "</h1><p class=\"lead\">" +
      escapeHtml(lead) +
      "</p></header>" +
      body +
      "</main>"
    );
  }

  function renderRows(tbody, rows, cols, emptyText) {
    tbody.innerHTML = "";
    if (!rows || !rows.length) {
      tbody.innerHTML = '<tr><td colspan="' + cols.length + '" class="empty">' + emptyText + "</td></tr>";
      return;
    }
    rows.forEach(function (row) {
      const tr = document.createElement("tr");
      tr.innerHTML = cols
        .map(function (key) {
          return "<td>" + escapeHtml(row[key]) + "</td>";
        })
        .join("");
      tbody.appendChild(tr);
    });
  }

  function jsonFetch(url, options) {
    return fetch(url, Object.assign({ credentials: "same-origin" }, options || {})).then(function (res) {
      return res.json();
    });
  }

  window.XmModules["/han"] = {
    mount: function (root) {
      root.innerHTML = page(
        "韩梦凯运营中心",
        "任务和今日简报写入数据库，与沈子晗中心隔离。默认负责人是韩梦凯。",
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
          '<p class="msg status" id="brief-msg"></p></form></section></div>',
      );

      const taskBody = root.querySelector("#task-body");
      const taskMsg = root.querySelector("#task-msg");
      const briefMsg = root.querySelector("#brief-msg");
      const briefEl = root.querySelector("#brief");
      const taskForm = root.querySelector("#task-form");
      const briefForm = root.querySelector("#brief-form");
      let dead = false;

      function load() {
        return Promise.all([jsonFetch("/api/han/tasks"), jsonFetch("/api/han/brief")]).then(function (pair) {
          if (dead) return;
          renderRows(taskBody, pair[0].tasks, ["title", "status", "owner"], "暂无任务");
          briefEl.value = pair[1].text || "";
        });
      }

      function onTask(e) {
        e.preventDefault();
        jsonFetch("/api/han/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: root.querySelector("#title").value }),
        }).then(function (json) {
          if (dead) return;
          taskMsg.textContent = json.ok ? "已添加" : json.error || "失败";
          if (json.ok) {
            root.querySelector("#title").value = "";
            return load();
          }
        });
      }

      function onBrief(e) {
        e.preventDefault();
        jsonFetch("/api/han/brief", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: briefEl.value }),
        }).then(function (json) {
          if (dead) return;
          briefMsg.textContent = json.ok ? "已保存" : "保存失败";
        });
      }

      taskForm.addEventListener("submit", onTask);
      briefForm.addEventListener("submit", onBrief);
      load().catch(function (err) {
        if (!dead) taskMsg.textContent = String(err);
      });

      return function unmount() {
        dead = true;
        taskForm.removeEventListener("submit", onTask);
        briefForm.removeEventListener("submit", onBrief);
        root.innerHTML = "";
      };
    },
  };

  window.XmModules["/han/selection"] = {
    mount: function (root) {
      root.innerHTML = page(
        "选品数据",
        "记录观察中的选品。默认负责人韩梦凯。",
        '<div class="stack"><section class="panel"><h2>新增选品</h2>' +
          '<form id="sel-form"><label for="sel-name">名称（必填）</label>' +
          '<input id="sel-name" required placeholder="选品名称" />' +
          '<label for="sel-category">类目</label><input id="sel-category" placeholder="类目" />' +
          '<label for="sel-note">备注</label><input id="sel-note" placeholder="卖点 / 风险" />' +
          '<div class="actions"><button type="submit">添加</button></div>' +
          '<p class="msg status" id="sel-msg"></p></form></section>' +
          '<section class="panel"><h2>选品列表</h2><table><thead><tr><th>名称</th><th>类目</th><th>状态</th><th>负责人</th></tr></thead>' +
          '<tbody id="sel-body"></tbody></table></section></div>',
      );
      const body = root.querySelector("#sel-body");
      const msg = root.querySelector("#sel-msg");
      const form = root.querySelector("#sel-form");
      let dead = false;
      function load() {
        return jsonFetch("/api/han/selection").then(function (json) {
          if (!dead) renderRows(body, json.items, ["name", "category", "status", "owner"], "暂无选品");
        });
      }
      function onSubmit(e) {
        e.preventDefault();
        jsonFetch("/api/han/selection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: root.querySelector("#sel-name").value,
            category: root.querySelector("#sel-category").value,
            note: root.querySelector("#sel-note").value,
          }),
        }).then(function (json) {
          if (dead) return;
          msg.textContent = json.ok ? "已添加" : json.error || "失败";
          if (json.ok) {
            form.reset();
            return load();
          }
        });
      }
      form.addEventListener("submit", onSubmit);
      load().catch(function (err) {
        if (!dead) msg.textContent = String(err);
      });
      return function unmount() {
        dead = true;
        form.removeEventListener("submit", onSubmit);
        root.innerHTML = "";
      };
    },
  };

  window.XmModules["/han/goods"] = {
    mount: function (root) {
      root.innerHTML = page(
        "商品数据",
        "在库商品。默认负责人韩梦凯。",
        '<div class="stack"><section class="panel"><h2>新增商品</h2>' +
          '<form id="prod-form"><label for="prod-name">名称（必填）</label>' +
          '<input id="prod-name" required placeholder="商品名称" />' +
          '<label for="prod-sku">SKU</label><input id="prod-sku" placeholder="SKU" />' +
          '<label for="prod-price">价格</label><input id="prod-price" type="number" step="0.01" placeholder="0.00" />' +
          '<label for="prod-stock">库存</label><input id="prod-stock" type="number" step="1" placeholder="0" />' +
          '<div class="actions"><button type="submit">添加</button></div>' +
          '<p class="msg status" id="prod-msg"></p></form></section>' +
          '<section class="panel"><h2>商品列表</h2><table><thead><tr><th>名称</th><th>SKU</th><th>价格</th><th>库存</th><th>负责人</th></tr></thead>' +
          '<tbody id="prod-body"></tbody></table></section></div>',
      );
      const tbody = root.querySelector("#prod-body");
      const msg = root.querySelector("#prod-msg");
      const form = root.querySelector("#prod-form");
      let dead = false;
      function load() {
        return jsonFetch("/api/han/products").then(function (json) {
          if (!dead) renderRows(tbody, json.items, ["name", "sku", "price", "stock", "owner"], "暂无商品");
        });
      }
      function onSubmit(e) {
        e.preventDefault();
        jsonFetch("/api/han/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: root.querySelector("#prod-name").value,
            sku: root.querySelector("#prod-sku").value,
            price: root.querySelector("#prod-price").value,
            stock: root.querySelector("#prod-stock").value,
          }),
        }).then(function (json) {
          if (dead) return;
          msg.textContent = json.ok ? "已添加" : json.error || "失败";
          if (json.ok) {
            form.reset();
            return load();
          }
        });
      }
      form.addEventListener("submit", onSubmit);
      load().catch(function (err) {
        if (!dead) msg.textContent = String(err);
      });
      return function unmount() {
        dead = true;
        form.removeEventListener("submit", onSubmit);
        root.innerHTML = "";
      };
    },
  };

  window.XmModules["/han/paid"] = {
    mount: function (root) {
      root.innerHTML = page(
        "实时付费",
        "投放花费记录。默认负责人韩梦凯。",
        '<div class="stack"><section class="panel"><h2>新增付费记录</h2>' +
          '<form id="paid-form"><label for="paid-channel">渠道（必填）</label>' +
          '<input id="paid-channel" required placeholder="信息流 / 搜索" />' +
          '<label for="paid-amount">金额</label><input id="paid-amount" type="number" step="0.01" placeholder="0.00" />' +
          '<label for="paid-date">日期</label><input id="paid-date" type="date" />' +
          '<label for="paid-note">备注</label><input id="paid-note" placeholder="投放说明" />' +
          '<div class="actions"><button type="submit">添加</button></div>' +
          '<p class="msg status" id="paid-msg"></p></form></section>' +
          '<section class="panel"><h2>付费列表</h2><table><thead><tr><th>渠道</th><th>金额</th><th>日期</th><th>负责人</th></tr></thead>' +
          '<tbody id="paid-body"></tbody></table></section></div>',
      );
      const tbody = root.querySelector("#paid-body");
      const msg = root.querySelector("#paid-msg");
      const form = root.querySelector("#paid-form");
      let dead = false;
      function load() {
        return jsonFetch("/api/han/paid").then(function (json) {
          if (!dead) renderRows(tbody, json.items, ["channel", "amount", "spentOn", "owner"], "暂无付费记录");
        });
      }
      function onSubmit(e) {
        e.preventDefault();
        jsonFetch("/api/han/paid", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channel: root.querySelector("#paid-channel").value,
            amount: root.querySelector("#paid-amount").value,
            spentOn: root.querySelector("#paid-date").value,
            note: root.querySelector("#paid-note").value,
          }),
        }).then(function (json) {
          if (dead) return;
          msg.textContent = json.ok ? "已添加" : json.error || "失败";
          if (json.ok) {
            form.reset();
            return load();
          }
        });
      }
      form.addEventListener("submit", onSubmit);
      load().catch(function (err) {
        if (!dead) msg.textContent = String(err);
      });
      return function unmount() {
        dead = true;
        form.removeEventListener("submit", onSubmit);
        root.innerHTML = "";
      };
    },
  };

  window.XmModules["/han/training"] = {
    mount: function (root) {
      root.innerHTML = page(
        "培训系统",
        "本中心培训安排。默认负责人韩梦凯。",
        '<div class="stack"><section class="panel"><h2>新增培训</h2>' +
          '<form id="train-form"><label for="train-title">课程（必填）</label>' +
          '<input id="train-title" required placeholder="课程名称" />' +
          '<label for="train-trainee">学员</label><input id="train-trainee" placeholder="学员姓名" />' +
          '<label for="train-date">日期</label><input id="train-date" type="date" />' +
          '<label for="train-note">备注</label><input id="train-note" placeholder="大纲 / 地点" />' +
          '<div class="actions"><button type="submit">添加</button></div>' +
          '<p class="msg status" id="train-msg"></p></form></section>' +
          '<section class="panel"><h2>培训列表</h2><table><thead><tr><th>课程</th><th>学员</th><th>日期</th><th>状态</th><th>负责人</th></tr></thead>' +
          '<tbody id="train-body"></tbody></table></section></div>',
      );
      const tbody = root.querySelector("#train-body");
      const msg = root.querySelector("#train-msg");
      const form = root.querySelector("#train-form");
      let dead = false;
      function load() {
        return jsonFetch("/api/han/training").then(function (json) {
          if (!dead) renderRows(tbody, json.items, ["title", "trainee", "scheduledOn", "status", "owner"], "暂无培训");
        });
      }
      function onSubmit(e) {
        e.preventDefault();
        jsonFetch("/api/han/training", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: root.querySelector("#train-title").value,
            trainee: root.querySelector("#train-trainee").value,
            scheduledOn: root.querySelector("#train-date").value,
            note: root.querySelector("#train-note").value,
          }),
        }).then(function (json) {
          if (dead) return;
          msg.textContent = json.ok ? "已添加" : json.error || "失败";
          if (json.ok) {
            form.reset();
            return load();
          }
        });
      }
      form.addEventListener("submit", onSubmit);
      load().catch(function (err) {
        if (!dead) msg.textContent = String(err);
      });
      return function unmount() {
        dead = true;
        form.removeEventListener("submit", onSubmit);
        root.innerHTML = "";
      };
    },
  };
})();
