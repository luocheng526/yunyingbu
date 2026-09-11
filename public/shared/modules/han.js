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
          '<label for="task-store">店</label><input id="task-store" placeholder="韩梦凯店" />' +
          '<div class="actions"><button type="submit">添加</button></div>' +
          '<p class="msg status" id="task-msg"></p></form></section>' +
          '<section class="panel"><h2>任务列表</h2><table><thead><tr><th>标题</th><th>状态</th><th>店</th><th>负责人</th></tr></thead>' +
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
          renderRows(taskBody, pair[0].tasks, ["title", "status", "store", "owner"], "暂无任务");
          briefEl.value = pair[1].text || "";
        });
      }

      function onTask(e) {
        e.preventDefault();
        jsonFetch("/api/han/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: root.querySelector("#title").value,
            store: root.querySelector("#task-store").value,
          }),
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
          '<label for="sel-store">店</label><input id="sel-store" placeholder="韩梦凯店" />' +
          '<label for="sel-category">类目</label><input id="sel-category" placeholder="类目" />' +
          '<label for="sel-note">备注</label><input id="sel-note" placeholder="卖点 / 风险" />' +
          '<div class="actions"><button type="submit">添加</button></div>' +
          '<p class="msg status" id="sel-msg"></p></form></section>' +
          '<section class="panel"><h2>选品列表</h2><table><thead><tr><th>名称</th><th>店</th><th>类目</th><th>状态</th><th>负责人</th></tr></thead>' +
          '<tbody id="sel-body"></tbody></table></section></div>',
      );
      const body = root.querySelector("#sel-body");
      const msg = root.querySelector("#sel-msg");
      const form = root.querySelector("#sel-form");
      let dead = false;
      function load() {
        return jsonFetch("/api/han/selection").then(function (json) {
          if (!dead) renderRows(body, json.items, ["name", "store", "category", "status", "owner"], "暂无选品");
        });
      }
      function onSubmit(e) {
        e.preventDefault();
        jsonFetch("/api/han/selection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: root.querySelector("#sel-name").value,
            store: root.querySelector("#sel-store").value,
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
      const layers = [
        {
          name: "头部产品",
          hint: "参考：退货率20%以下；推广花费占比42%以下；近7天日成交金额2000元以上；成交转化率7%以上；近30天转化率不合格需优化。",
          cols: [
            ["image", "主图"],
            ["spu", "SPU"],
            ["firstSku", "第一个sku"],
            ["hotSell", "全网热销"],
            ["reviewCount", "评价数"],
            ["shareCount", "晒单数"],
            ["qaVideo", "问答/视频logo"],
            ["returnM5", "BI 5月退货率"],
            ["returnM6", "BI 6月退货率"],
            ["returnM7", "BI 7月退货率"],
            ["returnM8", "BI 8月退货率"],
            ["orders30d", "近30天真实单量"],
            ["fulfillNote", "京仓/线下/拍单/无锡中转"],
            ["jdStock", "京仓库存"],
            ["remark", "备注"],
            ["store", "店"],
          ],
        },
        {
          name: "中部产品",
          hint: "参考：成交3单以上；退货率25%以下；推广花费占比40%以下；近7天日成交金额1000元以上；成交转化率5%以上；近30天转化率不合格需优化。",
          cols: null,
        },
        {
          name: "尾部产品",
          hint: "参考：成交3单以上；退货率25-30%；推广花费占比35%以下；近7天日成交金额1000元以上；成交转化率5%以上；近30天转化率不合格需优化。",
          cols: null,
        },
        {
          name: "动销产品",
          hint: "参考：超过3单看退货率；退货率25-30%加到尾部；退货率25%以下加到中部。",
          cols: [
            ["image", "主图"],
            ["spu", "SPU"],
            ["firstSku", "第一个sku"],
            ["hotSell", "全网热销"],
            ["reviewCount", "评价数"],
            ["shareCount", "晒单数"],
            ["returnM5", "BI 5月退货率"],
            ["returnM6", "BI 6月退货率"],
            ["returnM7", "BI 7月退货率"],
            ["returnM8", "BI 8月退货率"],
            ["orders30d", "近30天真实单量"],
            ["fulfillNote", "京仓/线下/拍单/无锡中转"],
            ["jdStock", "京仓库存"],
            ["remark", "备注"],
            ["store", "店"],
          ],
        },
        {
          name: "测新产品",
          hint: "参考：新上架未出单、基础优化完成、评价至少1条；花费达到产品价格35%仍未出单则暂停测新。",
          cols: [
            ["image", "主图"],
            ["spu", "SPU"],
            ["firstSku", "第一个sku"],
            ["hotSell", "全网热销"],
            ["reviewCount", "评价数"],
            ["shareCount", "晒单数"],
            ["listedOn", "上架时间"],
            ["hasNewBadge", "是否有新品标"],
            ["remark", "备注"],
            ["store", "店"],
          ],
        },
        {
          name: "待做单产品",
          hint: "上架后做单，做单之后直接上车。",
          cols: [
            ["image", "主图"],
            ["spu", "SPU"],
            ["firstSku", "第一个sku"],
            ["hotSell", "全网热销"],
            ["price", "价格"],
            ["listedOn", "上架时间"],
            ["needOrder", "需做单数量和时间"],
            ["remark", "备注"],
            ["store", "店"],
          ],
        },
      ];
      const coreCols = layers[0].cols;
      layers[1].cols = coreCols;
      layers[2].cols = coreCols;

      const tabs = layers
        .map(function (layer, i) {
          return (
            '<button type="button" class="han-layer-tab' +
            (i === 0 ? " is-on" : "") +
            '" data-layer="' +
            escapeHtml(layer.name) +
            '">' +
            escapeHtml(layer.name) +
            "</button>"
          );
        })
        .join("");
      const layerNames = layers.map(function (layer) {
        return layer.name;
      }).join("、");

      function fieldsHtml(layer) {
        return layer.cols
          .map(function (pair) {
            const key = pair[0];
            const label = pair[1];
            const id = "prod-" + key;
            const extra =
              key === "listedOn"
                ? ' type="date"'
                : key === "price"
                  ? ' type="number" step="0.01"'
                  : key === "image"
                    ? ' placeholder="主图链接"'
                    : key === "spu"
                      ? " required placeholder=\"SPU\""
                      : "";
            return '<label for="' + id + '">' + escapeHtml(label) + (key === "spu" ? "（必填）" : "") + "</label><input id=\"" + id + '"' + extra + " />";
          })
          .join("");
      }

      function tableHead(layer) {
        return layer.cols.map(function (pair) {
          return "<th>" + escapeHtml(pair[1]) + "</th>";
        }).join("");
      }

      root.innerHTML = page(
        "商品数据",
        "店铺产品分层：" + layerNames + "。点上面一排分类切换。默认负责人韩梦凯。",
        '<style>' +
          ".han-layer-bar{margin:0 0 1rem}" +
          ".han-layer-label{margin:0 0 0.5rem;font-weight:700}" +
          ".han-layer-row{display:flex;flex-wrap:wrap;border:1px solid #d6d3d1;border-radius:8px;overflow:hidden;background:#fff}" +
          ".han-layer-tab{flex:1 1 7rem;margin:0;border:0;border-right:1px solid #d6d3d1;padding:0.75rem 0.4rem;background:#fff;cursor:pointer;font-size:0.95rem}" +
          ".han-layer-tab:last-child{border-right:0}" +
          ".han-layer-tab.is-on{background:#0f766e;color:#fff;font-weight:700}" +
          "</style>" +
          '<div class="stack"><section class="panel"><div id="prod-tabs" class="han-layer-bar">' +
          '<p class="han-layer-label">商品分层</p>' +
          '<div class="han-layer-row">' +
          tabs +
          "</div></div>" +
          '<p class="lead" id="prod-hint"></p>' +
          '<form id="prod-form"></form></section>' +
          '<section class="panel" style="overflow-x:auto"><h2 id="prod-table-title">分层列表</h2>' +
          '<table><thead id="prod-head"></thead><tbody id="prod-body"></tbody></table></section></div>',
      );

      const form = root.querySelector("#prod-form");
      const hint = root.querySelector("#prod-hint");
      const thead = root.querySelector("#prod-head");
      const tbody = root.querySelector("#prod-body");
      const title = root.querySelector("#prod-table-title");
      const msgId = "prod-msg";
      let current = layers[0];
      let items = [];
      let dead = false;

      function paintForm() {
        form.innerHTML =
          fieldsHtml(current) +
          '<div class="actions"><button type="submit">添加到' +
          escapeHtml(current.name) +
          '</button></div><p class="msg status" id="' +
          msgId +
          '"></p>';
        hint.textContent = current.hint;
        title.textContent = current.name;
        thead.innerHTML = "<tr>" + tableHead(current) + "</tr>";
      }

      function cell(row, key) {
        const value = row[key] || "";
        if (key === "image" && /^https?:\/\//i.test(value)) {
          return '<td><img src="' + escapeHtml(value) + '" alt="" style="height:40px;max-width:72px;object-fit:cover" /></td>';
        }
        return "<td>" + escapeHtml(value) + "</td>";
      }

      function paintRows() {
        const rows = items.filter(function (row) {
          return row.layer === current.name;
        });
        if (!rows.length) {
          tbody.innerHTML =
            '<tr><td class="empty" colspan="' + current.cols.length + '">该分层暂无商品</td></tr>';
          return;
        }
        tbody.innerHTML = rows
          .map(function (row) {
            return (
              "<tr>" +
              current.cols
                .map(function (pair) {
                  return cell(row, pair[0]);
                })
                .join("") +
              "</tr>"
            );
          })
          .join("");
      }

      function load() {
        return jsonFetch("/api/han/products").then(function (json) {
          if (dead) return;
          items = json.items || [];
          paintRows();
        });
      }

      function switchLayer(name) {
        const next = layers.find(function (layer) {
          return layer.name === name;
        });
        if (!next) return;
        current = next;
        root.querySelectorAll(".han-layer-tab").forEach(function (btn) {
          btn.classList.toggle("is-on", btn.getAttribute("data-layer") === name);
        });
        paintForm();
        paintRows();
      }

      function onSubmit(e) {
        e.preventDefault();
        const body = { layer: current.name };
        current.cols.forEach(function (pair) {
          const el = root.querySelector("#prod-" + pair[0]);
          if (el) body[pair[0]] = el.value;
        });
        const msg = root.querySelector("#" + msgId);
        jsonFetch("/api/han/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }).then(function (json) {
          if (dead) return;
          if (msg) msg.textContent = json.ok ? "已添加到" + current.name : json.error || "失败";
          if (json.ok) {
            form.reset();
            return load();
          }
        });
      }

      function onTab(e) {
        const btn = e.target.closest(".han-layer-tab");
        if (btn) switchLayer(btn.getAttribute("data-layer"));
      }

      paintForm();
      root.querySelector("#prod-tabs").addEventListener("click", onTab);
      form.addEventListener("submit", onSubmit);
      load().catch(function (err) {
        const msg = root.querySelector("#" + msgId);
        if (!dead && msg) msg.textContent = String(err);
      });
      return function unmount() {
        dead = true;
        root.querySelector("#prod-tabs").removeEventListener("click", onTab);
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
          '<label for="paid-store">店</label><input id="paid-store" placeholder="韩梦凯店" />' +
          '<label for="paid-amount">金额</label><input id="paid-amount" type="number" step="0.01" placeholder="0.00" />' +
          '<label for="paid-date">日期</label><input id="paid-date" type="date" />' +
          '<label for="paid-note">备注</label><input id="paid-note" placeholder="投放说明" />' +
          '<div class="actions"><button type="submit">添加</button></div>' +
          '<p class="msg status" id="paid-msg"></p></form></section>' +
          '<section class="panel"><h2>付费列表</h2><table><thead><tr><th>店</th><th>渠道</th><th>金额</th><th>日期</th><th>负责人</th></tr></thead>' +
          '<tbody id="paid-body"></tbody></table></section></div>',
      );
      const tbody = root.querySelector("#paid-body");
      const msg = root.querySelector("#paid-msg");
      const form = root.querySelector("#paid-form");
      let dead = false;
      function load() {
        return jsonFetch("/api/han/paid").then(function (json) {
          if (!dead) renderRows(tbody, json.items, ["store", "channel", "amount", "spentOn", "owner"], "暂无付费记录");
        });
      }
      function onSubmit(e) {
        e.preventDefault();
        jsonFetch("/api/han/paid", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channel: root.querySelector("#paid-channel").value,
            store: root.querySelector("#paid-store").value,
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
          '<label for="train-store">店</label><input id="train-store" placeholder="韩梦凯店" />' +
          '<label for="train-trainee">学员</label><input id="train-trainee" placeholder="学员姓名" />' +
          '<label for="train-date">日期</label><input id="train-date" type="date" />' +
          '<label for="train-note">备注</label><input id="train-note" placeholder="大纲 / 地点" />' +
          '<div class="actions"><button type="submit">添加</button></div>' +
          '<p class="msg status" id="train-msg"></p></form></section>' +
          '<section class="panel"><h2>培训列表</h2><table><thead><tr><th>课程</th><th>店</th><th>学员</th><th>日期</th><th>状态</th><th>负责人</th></tr></thead>' +
          '<tbody id="train-body"></tbody></table></section></div>',
      );
      const tbody = root.querySelector("#train-body");
      const msg = root.querySelector("#train-msg");
      const form = root.querySelector("#train-form");
      let dead = false;
      function load() {
        return jsonFetch("/api/han/training").then(function (json) {
          if (!dead) renderRows(tbody, json.items, ["title", "store", "trainee", "scheduledOn", "status", "owner"], "暂无培训");
        });
      }
      function onSubmit(e) {
        e.preventDefault();
        jsonFetch("/api/han/training", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: root.querySelector("#train-title").value,
            store: root.querySelector("#train-store").value,
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
