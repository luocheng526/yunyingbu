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
          color: "#f4b183",
          hint: "满足以下参考条件：1.退货率20%以下  2.推广花费占比42%以下  3.近7天日成交金额2000元以上  4.成交转化率7%以上  5.近30天转化率不合格的需要优化转化率",
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
          ],
        },
        {
          name: "中部产品",
          color: "#ffe699",
          hint: "满足以下参考条件：1.成交3单以上  2.退货率25%以下  3.推广花费占比40%以下  4.近7天日成交金额1000元以上  5.成交转化率5%以上  6.近30天转化率不合格的需要优化转化率",
          cols: null,
        },
        {
          name: "尾部产品",
          color: "#c6e0b4",
          hint: "满足以下参考条件：1.成交3单以上  2.退货率25-30%之间  3.推广花费占比35%以下  4.近7天日成交金额1000元以上  5.成交转化率5%以上  6.近30天转化率不合格的需要优化",
          cols: null,
        },
        {
          name: "动销产品",
          color: "#bdd7ee",
          hint: "满足以下参考条件：1.超过3单的以上的看退货率  2.退货率在25-30%加到尾部  3.退货率在25%以下加到中部",
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
          ],
        },
        {
          name: "测新产品",
          color: "#d9d2e9",
          hint: "满足以下参考条件：1.新上架未出单 基础优化完成 评价至少1条  2.花费本身产品价格的35%未出单产品暂停测新",
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
          ],
        },
        {
          name: "待做单产品",
          color: "#f8cbad",
          hint: "上架后做单 做单之后直接上车",
          cols: [
            ["image", "主图"],
            ["spu", "SPU"],
            ["firstSku", "第一个sku"],
            ["hotSell", "全网热销"],
            ["price", "价格"],
            ["listedOn", "上架时间"],
            ["needOrder", "需做单数量和时间"],
            ["remark", "备注"],
          ],
        },
      ];
      layers[1].cols = layers[0].cols;
      layers[2].cols = layers[0].cols;
      const totalCols = layers.reduce(function (sum, layer) {
        return sum + layer.cols.length;
      }, 0);

      function inputType(key) {
        if (key === "listedOn") return "date";
        if (key === "price") return "number";
        return "text";
      }

      function cellHtml(row, key) {
        const value = row[key] || "";
        if (key === "image" && /^https?:\/\//i.test(value)) {
          return '<td><img src="' + escapeHtml(value) + '" alt="" style="height:36px;max-width:64px;object-fit:cover" /></td>';
        }
        return "<td>" + escapeHtml(value) + "</td>";
      }

      const teams = ["陈晓曼组", "高明阳组", "毛永超组", "段坤孝组", "薛双双组"];
      const team = (new URLSearchParams(window.location.search).get("team") || "").trim();
      if (!teams.includes(team)) {
        root.innerHTML = page(
          "商品数据",
          "先选小组，再填该组的店铺产品分层表。",
          '<div class="stack"><section class="panel"><h2>小组</h2><div class="actions" style="flex-wrap:wrap">' +
            teams
              .map(function (name) {
                return (
                  '<a class="han-team-card" href="/han/goods?team=' +
                  encodeURIComponent(name) +
                  '">' +
                  escapeHtml(name) +
                  "</a>"
                );
              })
              .join("") +
            "</div></section></div>",
        );
        return function unmount() {
          root.innerHTML = "";
        };
      }

      root.innerHTML = page(
        team,
        "商品数据 · " + team + "。六个分层左右排在同一张工作表里，向右滑动可看完。",
        '<style>' +
          ".han-sheet-wrap{overflow-x:auto;background:#fff;border:1px solid #c6c6c6}" +
          ".han-sheet{border-collapse:collapse;font-size:12px;min-width:2200px}" +
          ".han-sheet th,.han-sheet td{border:1px solid #b1b1b1;padding:4px 6px;white-space:nowrap;vertical-align:middle}" +
          ".han-sheet .han-sheet-title{text-align:center;font-size:20px;font-weight:700;background:#fff2cc}" +
          ".han-sheet .han-sheet-group{text-align:center;font-weight:700}" +
          ".han-sheet .han-sheet-hint{white-space:normal;min-width:160px;max-width:220px;font-size:11px;line-height:1.45;color:#444;background:#fafafa}" +
          ".han-sheet .han-sheet-col{background:#f3f3f3;font-weight:600}" +
          ".han-sheet input{width:92px;border:0;background:#fffde7;padding:2px 4px}" +
          ".han-sheet button{font-size:12px;padding:2px 8px}" +
          ".han-sheet-msg{margin:0.5rem 0 0;min-height:1.2em}" +
          "</style>" +
          '<div class="han-sheet-wrap"><table class="han-sheet" id="han-sheet">' +
          "<thead></thead><tbody></tbody></table></div>" +
          '<p class="msg status han-sheet-msg" id="prod-msg"></p>',
      );

      const table = root.querySelector("#han-sheet");
      const thead = table.querySelector("thead");
      const tbody = table.querySelector("tbody");
      const msg = root.querySelector("#prod-msg");
      let items = [];
      let dead = false;

      function paintHead() {
        const title =
          '<tr><th class="han-sheet-title" colspan="' + totalCols + '">' +
          escapeHtml(team) +
          " · 店铺产品分层表</th></tr>";
        const groups = "<tr>" + layers.map(function (layer) {
          return (
            '<th class="han-sheet-group" colspan="' +
            layer.cols.length +
            '" style="background:' +
            layer.color +
            '">' +
            escapeHtml(layer.name) +
            "</th>"
          );
        }).join("") + "</tr>";
        const hints = "<tr>" + layers.map(function (layer) {
          return (
            '<th class="han-sheet-hint" colspan="' +
            layer.cols.length +
            '">' +
            escapeHtml(layer.hint) +
            "</th>"
          );
        }).join("") + "</tr>";
        const cols = "<tr>" + layers.map(function (layer) {
          return layer.cols.map(function (pair) {
            return '<th class="han-sheet-col">' + escapeHtml(pair[1]) + "</th>";
          }).join("");
        }).join("") + "</tr>";
        thead.innerHTML = title + groups + hints + cols;
      }

      function addRowHtml() {
        return (
          "<tr>" +
          layers
            .map(function (layer, i) {
              return layer.cols
                .map(function (pair) {
                  const key = pair[0];
                  return (
                    '<td><input data-layer="' +
                    i +
                    '" data-key="' +
                    key +
                    '" type="' +
                    inputType(key) +
                    '"' +
                    (key === "spu" ? " placeholder=\"SPU\"" : "") +
                    (key === "image" ? " placeholder=\"主图链接\"" : "") +
                    " /></td>"
                  );
                })
                .join("");
            })
            .join("") +
          "</tr><tr>" +
          layers
            .map(function (layer, i) {
              return (
                '<td colspan="' +
                layer.cols.length +
                '"><button type="button" class="han-sheet-add" data-layer="' +
                i +
                '">添加到' +
                escapeHtml(layer.name) +
                "</button></td>"
              );
            })
            .join("") +
          "</tr>"
        );
      }

      function paintBody() {
        const grouped = layers.map(function (layer) {
          return items.filter(function (row) {
            return row.layer === layer.name;
          });
        });
        const max = Math.max.apply(
          null,
          grouped.map(function (rows) {
            return rows.length;
          }).concat([0]),
        );
        let html = "";
        for (let r = 0; r < max; r += 1) {
          html += "<tr>";
          layers.forEach(function (layer, i) {
            const row = grouped[i][r];
            if (!row) {
              html += layer.cols.map(function () {
                return "<td></td>";
              }).join("");
              return;
            }
            html += layer.cols.map(function (pair) {
              return cellHtml(row, pair[0]);
            }).join("");
          });
          html += "</tr>";
        }
        tbody.innerHTML = html + addRowHtml();
      }

      function load() {
        return jsonFetch("/api/han/products?team=" + encodeURIComponent(team)).then(function (json) {
          if (dead) return;
          items = json.items || [];
          paintBody();
        });
      }

      function onAdd(e) {
        const btn = e.target.closest(".han-sheet-add");
        if (!btn) return;
        const index = Number(btn.getAttribute("data-layer"));
        const layer = layers[index];
        const body = { layer: layer.name, team: team };
        root.querySelectorAll('input[data-layer="' + index + '"]').forEach(function (el) {
          body[el.getAttribute("data-key")] = el.value;
        });
        jsonFetch("/api/han/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }).then(function (json) {
          if (dead) return;
          msg.textContent = json.ok ? "已写入" + layer.name : json.error || "失败";
          if (json.ok) return load();
        });
      }

      paintHead();
      table.addEventListener("click", onAdd);
      load().catch(function (err) {
        if (!dead) msg.textContent = String(err);
      });
      return function unmount() {
        dead = true;
        table.removeEventListener("click", onAdd);
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

  const HAN_GOODS_TEAMS = ["陈晓曼组", "高明阳组", "毛永超组", "段坤孝组", "薛双双组"];

  function attachHanGoodsTeams() {
    if (document.getElementById("han-goods-teams")) {
      return true;
    }
    const goods = document.querySelector('.xm-submenu a[href="/han/goods"]');
    if (!goods) {
      return false;
    }
    if (!document.getElementById("han-goods-teams-css")) {
      const style = document.createElement("style");
      style.id = "han-goods-teams-css";
      style.textContent =
        ".han-goods-teams{display:flex;flex-direction:column}" +
        ".han-goods-teams-sub{display:flex;flex-direction:column;padding:0 0 0.15rem}" +
        ".han-goods-teams-sub a{padding-left:2.35rem !important;font-size:0.88rem}" +
        ".han-team-card{display:inline-block;margin:0 0.5rem 0.5rem 0;padding:0.55rem 0.9rem;border-radius:8px;background:#ccfbf1;color:#134e4a;text-decoration:none;font-weight:600}";
      document.head.appendChild(style);
    }
    const wrap = document.createElement("div");
    wrap.id = "han-goods-teams";
    wrap.className = "han-goods-teams";
    goods.parentNode.insertBefore(wrap, goods);
    wrap.appendChild(goods);
    const sub = document.createElement("div");
    sub.className = "han-goods-teams-sub";
    const current = new URLSearchParams(window.location.search).get("team") || "";
    HAN_GOODS_TEAMS.forEach(function (name) {
      const a = document.createElement("a");
      a.className = "xm-menu-item xm-menu-child";
      a.href = "/han/goods?team=" + encodeURIComponent(name);
      a.textContent = name;
      if (current === name) {
        a.classList.add("is-active");
        a.setAttribute("aria-current", "page");
        goods.classList.remove("is-active");
        goods.removeAttribute("aria-current");
      }
      sub.appendChild(a);
    });
    wrap.appendChild(sub);
    return true;
  }

  function watchHanGoodsTeams() {
    if (attachHanGoodsTeams()) {
      return;
    }
    let n = 0;
    const timer = setInterval(function () {
      n += 1;
      if (attachHanGoodsTeams() || n > 40) {
        clearInterval(timer);
      }
    }, 200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", watchHanGoodsTeams);
  } else {
    watchHanGoodsTeams();
  }
})();
