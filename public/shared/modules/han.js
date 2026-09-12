/* han submenu pages — 韩梦凯运营中心 */
(function () {
  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  window.XmModules = window.XmModules || {};

  const HAN_GOODS_TEAMS = ["陈晓曼组", "高明阳组", "毛永超组", "段坤孝组", "薛双双组"];

  function tabLink(href, label, on) {
    return (
      '<a class="han-tab' +
      (on ? " is-active" : "") +
      '" href="' +
      href +
      '" data-han-tab="' +
      href +
      '">' +
      escapeHtml(label) +
      "</a>"
    );
  }

  function teamTabsHtml(team) {
    const current = String(team || "").trim();
    return (
      '<nav class="han-tabs han-tabs-sub" aria-label="商品分层小组">' +
      tabLink("/han/goods", "商品分层", !current) +
      HAN_GOODS_TEAMS.map(function (name) {
        return tabLink("/han/goods?team=" + encodeURIComponent(name), name, current === name);
      }).join("") +
      "</nav>"
    );
  }

  const HAN_PICK_BOARDS = [
    { key: "", label: "日常选品", title: "选品数据", lead: "记录观察中的选品。默认负责人韩梦凯。" },
    { key: "trend", label: "趋势选品", title: "趋势选品", lead: "跟趋势、关键词和爆款方向，单独记一板。" },
    { key: "peers", label: "同行竞对", title: "同行竞对", lead: "盯同行店铺和竞品，和日常选品分开。" },
    { key: "new", label: "全新商品", title: "全新商品", lead: "记录新上架、待测的新品。" },
  ];

  function selectionTabsHtml(board) {
    const current = String(board || "").trim();
    return (
      '<nav class="han-tabs han-tabs-sub" aria-label="选品板块">' +
      HAN_PICK_BOARDS.map(function (item) {
        const href = item.key ? "/han/selection?board=" + encodeURIComponent(item.key) : "/han/selection";
        return tabLink(href, item.label, current === item.key);
      }).join("") +
      "</nav>"
    );
  }

  function shopTabsHtml(team, shop, shops) {
    if (!team || !shops || !shops.length) {
      return "";
    }
    return (
      '<nav class="han-tabs han-tabs-sub" aria-label="小组店铺">' +
      shops
        .map(function (item) {
          const href =
            "/han/goods?team=" + encodeURIComponent(team) + "&store=" + encodeURIComponent(item.store);
          return tabLink(href, item.store, shop === item.store);
        })
        .join("") +
      "</nav>"
    );
  }

  function page(title, lead, body, extraTabs, afterLead) {
    ensureHanChrome();
    return (
      '<main class="page han-goods-stage">' +
      (extraTabs || "") +
      '<header class="page-head"><p class="kicker">韩梦凯运营中心</p><h1>' +
      escapeHtml(title) +
      "</h1><p class=\"lead\">" +
      escapeHtml(lead) +
      "</p>" +
      (afterLead || "") +
      "</header>" +
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
      const params = new URLSearchParams(window.location.search);
      const board = String(params.get("board") || "").trim();
      const spec =
        HAN_PICK_BOARDS.filter(function (item) {
          return item.key === board;
        })[0] || HAN_PICK_BOARDS[0];
      const extras = {
        trend: { label: "趋势 / 关键词", placeholder: "开学季 / 直播热搜" },
        peers: { label: "竞对店铺", placeholder: "同行店名" },
        new: { label: "上新日期", placeholder: "2026-09-12" },
      };
      const extra = extras[spec.key];
      const nameLabel = spec.key === "peers" ? "竞品名称（必填）" : spec.key === "new" ? "商品名称（必填）" : "名称（必填）";
      const listCols = spec.key
        ? spec.key === "peers"
          ? ["name", "extra", "category", "store", "status"]
          : ["name", "extra", "category", "store", "status"]
        : ["name", "store", "category", "status", "owner"];
      const listHeads = spec.key
        ? spec.key === "peers"
          ? "<th>竞品</th><th>竞对店铺</th><th>类目</th><th>我方店</th><th>状态</th>"
          : spec.key === "new"
            ? "<th>名称</th><th>上新日期</th><th>类目</th><th>店</th><th>状态</th>"
            : "<th>名称</th><th>趋势/关键词</th><th>类目</th><th>店</th><th>状态</th>"
        : "<th>名称</th><th>店</th><th>类目</th><th>状态</th><th>负责人</th>";
      root.innerHTML = page(
        spec.title,
        spec.lead,
        '<div class="stack"><section class="panel"><h2>新增' +
          escapeHtml(spec.label) +
          "</h2>" +
          '<form id="sel-form"><label for="sel-name">' +
          escapeHtml(nameLabel) +
          "</label>" +
          '<input id="sel-name" required placeholder="' +
          escapeHtml(spec.label) +
          '" />' +
          (extra
            ? "<label for=\"sel-extra\">" +
              escapeHtml(extra.label) +
              "</label><input id=\"sel-extra\" placeholder=\"" +
              escapeHtml(extra.placeholder) +
              '"' +
              (spec.key === "new" ? ' type="date"' : "") +
              " />"
            : "") +
          '<label for="sel-store">' +
          (spec.key === "peers" ? "我方店" : "店") +
          '</label><input id="sel-store" placeholder="韩梦凯店" />' +
          '<label for="sel-category">类目</label><input id="sel-category" placeholder="类目" />' +
          '<label for="sel-note">备注</label><input id="sel-note" placeholder="卖点 / 风险" />' +
          '<div class="actions"><button type="submit">添加</button></div>' +
          '<p class="msg status" id="sel-msg"></p></form></section>' +
          '<section class="panel"><h2>' +
          escapeHtml(spec.label) +
          "列表</h2><table><thead><tr>" +
          listHeads +
          '</tr></thead><tbody id="sel-body"></tbody></table></section></div>',
        selectionTabsHtml(spec.key),
      );
      const body = root.querySelector("#sel-body");
      const msg = root.querySelector("#sel-msg");
      const form = root.querySelector("#sel-form");
      let dead = false;
      function loadUrl() {
        return spec.key
          ? "/api/han/picks?board=" + encodeURIComponent(spec.key)
          : "/api/han/selection";
      }
      function load() {
        return jsonFetch(loadUrl()).then(function (json) {
          if (!dead) renderRows(body, json.items, listCols, "暂无" + spec.label);
        });
      }
      function onSubmit(e) {
        e.preventDefault();
        const extraEl = root.querySelector("#sel-extra");
        const payload = {
          name: root.querySelector("#sel-name").value,
          store: root.querySelector("#sel-store").value,
          category: root.querySelector("#sel-category").value,
          note: root.querySelector("#sel-note").value,
        };
        if (spec.key) {
          payload.board = spec.key;
          payload.extra = extraEl ? extraEl.value : "";
        }
        jsonFetch(spec.key ? "/api/han/picks" : "/api/han/selection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
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
      layers.forEach(function (layer) {
        layer.cols = [["_layer", "调动"]].concat(layer.cols);
      });
      const totalCols = layers.reduce(function (sum, layer) {
        return sum + layer.cols.length;
      }, 0);

      function inputType(key) {
        if (key === "listedOn") return "date";
        if (key === "price") return "number";
        return "text";
      }

      function layerSelect(row) {
        return (
          '<select class="han-layer-pick" data-id="' +
          escapeHtml(row.id) +
          '">' +
          layers
            .map(function (layer) {
              return (
                '<option value="' +
                escapeHtml(layer.name) +
                '"' +
                (row.layer === layer.name ? " selected" : "") +
                ">" +
                escapeHtml(layer.name) +
                "</option>"
              );
            })
            .join("") +
          "</select>"
        );
      }

      function cellHtml(row, key) {
        if (key === "_layer") {
          return "<td>" + layerSelect(row) + "</td>";
        }
        const value = row[key] || "";
        return (
          '<td><input class="han-cell" data-id="' +
          escapeHtml(row.id) +
          '" data-key="' +
          key +
          '" type="' +
          inputType(key) +
          '" value="' +
          escapeHtml(value) +
          '"' +
          (key === "image" ? " placeholder=\"主图链接\"" : "") +
          " /></td>"
        );
      }

      const teams = HAN_GOODS_TEAMS;
      const params = new URLSearchParams(window.location.search);
      const team = (params.get("team") || "").trim();
      const shop = (params.get("store") || "").trim();
      if (!teams.includes(team)) {
        root.innerHTML = page(
          "商品分层",
          "右侧横排切换小组。店铺从组织中心该小组负责人名下抓取。",
          '<div class="stack"><section class="panel"><h2>商品分层</h2><p class="lead">点小组查看组织中心里对应的店铺。</p></section></div>',
          teamTabsHtml(""),
        );
        return function unmount() {
          root.innerHTML = "";
        };
      }

      if (!shop) {
        root.innerHTML = page(
          team,
          "店铺从组织中心抓取，对应小组负责人「" +
            escapeHtml(String(team).replace(/组$/, "")) +
            "」。点店铺进入分层表。",
          '<div class="stack"><section class="panel"><h2>本小组店铺</h2>' +
            '<p class="msg status" id="shop-msg"></p>' +
            '<div id="shop-list" class="actions" style="flex-wrap:wrap"></div></section></div>',
          teamTabsHtml(team) + '<div id="han-shop-tabs"></div>',
        );
        const list = root.querySelector("#shop-list");
        const msg = root.querySelector("#shop-msg");
        let dead = false;
        function paintShops(items) {
          const shopTabs = root.querySelector("#han-shop-tabs");
          if (shopTabs) shopTabs.innerHTML = shopTabsHtml(team, "", items);
          if (!items.length) {
            list.innerHTML = '<p class="lead">组织中心还没有该组店铺。</p>';
            return;
          }
          list.innerHTML = items
            .map(function (item) {
              return (
                '<a class="han-team-card" href="/han/goods?team=' +
                encodeURIComponent(team) +
                "&store=" +
                encodeURIComponent(item.store) +
                '" data-han-tab="/han/goods?team=' +
                encodeURIComponent(team) +
                "&store=" +
                encodeURIComponent(item.store) +
                '">' +
                escapeHtml(item.store) +
                "</a>"
              );
            })
            .join("");
        }
        function loadShops() {
          return jsonFetch("/api/han/shops?team=" + encodeURIComponent(team)).then(function (json) {
            if (!dead) paintShops(json.items || []);
          });
        }
        loadShops().catch(function (err) {
          if (!dead) msg.textContent = String(err);
        });
        return function unmount() {
          dead = true;
          root.innerHTML = "";
        };
      }

      function field(name, label) {
        return (
          "<label>" +
          escapeHtml(label) +
          '<input data-rule="' +
          escapeHtml(name) +
          '" type="number" step="any" /></label>'
        );
      }

      const periods = (function () {
        const now = new Date();
        const month = now.getFullYear() + "年" + (now.getMonth() + 1) + "月";
        const weekday = now.getDay() || 7;
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - weekday + 1);
        const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
        function md(d) {
          return d.getMonth() + 1 + "/" + d.getDate();
        }
        return { month: month, week: md(start) + "-" + md(end) };
      })();

      root.innerHTML = page(
        shop,
        team + " · " + shop + "。本店可自定义分类规则；导入和分类只按本店规则。格子可改，调动可换层。",
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
          ".han-sheet-toolbar{display:flex;justify-content:flex-end;gap:8px;margin:0 0 10px;flex-wrap:wrap}" +
          ".han-sheet-toolbar button,.han-sheet-toolbar label{min-height:34px;padding:6px 14px;border:0;border-radius:999px;background:#111827;color:#fff;font-size:13px;font-weight:600;cursor:pointer}" +
          ".han-sheet-toolbar .han-export-btn{background:#2563eb}" +
          ".han-sheet-toolbar .han-tpl-btn{background:#6b7280}" +
          ".han-sheet-toolbar .han-class-btn{background:#0f766e}" +
          ".han-sheet-toolbar .han-rules-btn{background:#7c3aed}" +
          ".han-sheet select{max-width:88px;border:0;background:#ecfeff;font-size:12px}" +
          ".han-rules{display:none;margin:0 0 12px;padding:12px 14px;background:#fff;border:1px solid #ddd}" +
          ".han-rules.is-open{display:block}" +
          ".han-rules h3{margin:0 0 8px;font-size:14px}" +
          ".han-rules .han-rules-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px 14px}" +
          ".han-rules label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:#374151}" +
          ".han-rules input{min-height:30px;padding:4px 8px;border:1px solid #d1d5db}" +
          ".han-rules .han-rules-actions{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}" +
          ".han-rules .han-rules-actions button{min-height:32px;padding:6px 12px;border:0;border-radius:999px;color:#fff;cursor:pointer}" +
          ".han-rules #han-rules-save{background:#0f766e}" +
          ".han-rules #han-rules-reset{background:#6b7280}" +
          ".han-plans{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:10px 0 0}" +
          ".han-plan{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:10px 12px}" +
          ".han-plan h3{margin:0 0 8px;font-size:14px;display:flex;justify-content:space-between;gap:8px}" +
          ".han-plan h3 span{font-size:12px;font-weight:500;color:#6b7280}" +
          ".han-plan ul{list-style:none;margin:0;padding:0;max-height:140px;overflow:auto}" +
          ".han-plan li{display:flex;align-items:center;gap:8px;padding:3px 0;font-size:13px}" +
          ".han-plan li.is-done span{text-decoration:line-through;color:#9ca3af}" +
          ".han-plan .han-plan-empty{color:#9ca3af}" +
          ".han-plan .han-plan-del{border:0;background:transparent;color:#9ca3af;cursor:pointer}" +
          ".han-plan-add{display:flex;gap:6px;margin-top:8px}" +
          ".han-plan-add input{flex:1;min-height:30px;border:1px solid #d1d5db;border-radius:6px;padding:4px 8px}" +
          ".han-plan-add button{border:0;border-radius:6px;background:#111827;color:#fff;padding:4px 10px;cursor:pointer}" +
          "@media (max-width:900px){.han-plans{grid-template-columns:1fr}}" +
          "</style>" +
          '<div class="han-sheet-toolbar">' +
          '<button type="button" class="han-rules-btn" id="han-rules-toggle">本店分类规则</button>' +
          '<button type="button" class="han-class-btn" id="han-classify">按本店规则分类</button>' +
          '<button type="button" class="han-export-btn" id="han-export">导出</button>' +
          '<label class="han-import-btn">导入原始数据<input id="han-import" type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" hidden /></label>' +
          '<button type="button" class="han-tpl-btn" id="han-tpl">下载模板</button></div>' +
          '<div class="han-rules" id="han-rules">' +
          "<h3>本店分类规则</h3>" +
          '<p class="lead" id="han-rules-status">未保存过则用初版默认值，只作用于当前店铺。</p>' +
          '<div class="han-rules-grid">' +
          field("head.returnMax", "头部 退货率上限 %") +
          field("head.spendMax", "头部 花费占比上限 %") +
          field("head.gmvMin", "头部 近7天日成交下限") +
          field("head.convMin", "头部 转化率下限 %") +
          field("mid.ordersMin", "中部 成交单量下限") +
          field("mid.returnMax", "中部 退货率上限 %") +
          field("mid.spendMax", "中部 花费占比上限 %") +
          field("mid.gmvMin", "中部 近7天日成交下限") +
          field("mid.convMin", "中部 转化率下限 %") +
          field("tail.ordersMin", "尾部 成交单量下限") +
          field("tail.returnMin", "尾部 退货率下限 %") +
          field("tail.returnMax", "尾部 退货率上限 %") +
          field("tail.spendMax", "尾部 花费占比上限 %") +
          field("tail.gmvMin", "尾部 近7天日成交下限") +
          field("tail.convMin", "尾部 转化率下限 %") +
          field("moving.ordersMin", "动销 超过单量看退货率") +
          field("testNew.reviewMin", "测新 评价数下限") +
          "</div>" +
          '<div class="han-rules-actions">' +
          '<button type="button" id="han-rules-save">保存本店规则</button>' +
          '<button type="button" id="han-rules-reset">恢复默认</button></div></div>' +
          '<div class="han-sheet-wrap"><table class="han-sheet" id="han-sheet">' +
          "<thead></thead><tbody></tbody></table></div>" +
          '<p class="msg status han-sheet-msg" id="prod-msg"></p>',
        teamTabsHtml(team) + '<div id="han-shop-tabs"></div>',
        '<div class="han-plans">' +
          '<section class="han-plan" data-kind="month"><h3>本月任务规划<span>' +
          escapeHtml(periods.month) +
          "</span></h3><ul id=\"han-month-list\"></ul>" +
          '<div class="han-plan-add"><input id="han-month-input" placeholder="添加本月任务" /><button type="button" id="han-month-add">添加</button></div></section>' +
          '<section class="han-plan" data-kind="week"><h3>本周任务规划<span>' +
          escapeHtml(periods.week) +
          "</span></h3><ul id=\"han-week-list\"></ul>" +
          '<div class="han-plan-add"><input id="han-week-input" placeholder="添加本周任务" /><button type="button" id="han-week-add">添加</button></div></section>' +
          "</div>",
      );

      const table = root.querySelector("#han-sheet");
      const thead = table.querySelector("thead");
      const tbody = table.querySelector("tbody");
      const msg = root.querySelector("#prod-msg");
      const monthList = root.querySelector("#han-month-list");
      const weekList = root.querySelector("#han-week-list");
      const monthInput = root.querySelector("#han-month-input");
      const weekInput = root.querySelector("#han-week-input");
      const monthAdd = root.querySelector("#han-month-add");
      const weekAdd = root.querySelector("#han-week-add");
      let items = [];
      let monthItems = [];
      let weekItems = [];
      let dead = false;

      function paintPlanList(el, rows) {
        if (!rows.length) {
          el.innerHTML = '<li class="han-plan-empty">还没有任务</li>';
          return;
        }
        el.innerHTML = rows
          .map(function (row) {
            return (
              '<li class="' +
              (row.done ? "is-done" : "") +
              '" data-id="' +
              escapeHtml(row.id) +
              '"><input type="checkbox" class="han-plan-done"' +
              (row.done ? " checked" : "") +
              " /><span>" +
              escapeHtml(row.text) +
              '</span><button type="button" class="han-plan-del" aria-label="删除">×</button></li>'
            );
          })
          .join("");
      }

      function paintPlans() {
        paintPlanList(monthList, monthItems);
        paintPlanList(weekList, weekItems);
      }

      function savePlans() {
        return jsonFetch("/api/han/shop-plans", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            team: team,
            store: shop,
            monthItems: monthItems,
            weekItems: weekItems,
          }),
        }).then(function (json) {
          if (dead) return json;
          if (!json.ok) {
            msg.textContent = json.error || "任务规划保存失败";
            return json;
          }
          monthItems = json.monthItems || [];
          weekItems = json.weekItems || [];
          paintPlans();
          return json;
        });
      }

      function loadPlans() {
        return jsonFetch(
          "/api/han/shop-plans?team=" + encodeURIComponent(team) + "&store=" + encodeURIComponent(shop),
        ).then(function (json) {
          if (dead || !json.ok) return json;
          monthItems = json.monthItems || [];
          weekItems = json.weekItems || [];
          paintPlans();
          return json;
        });
      }

      function addPlan(kind) {
        const input = kind === "month" ? monthInput : weekInput;
        const text = String(input.value || "").trim();
        if (!text) return;
        const row = { id: String(Date.now()), text: text, done: false };
        if (kind === "month") monthItems = monthItems.concat([row]);
        else weekItems = weekItems.concat([row]);
        input.value = "";
        paintPlans();
        savePlans();
      }

      function onPlanClick(e) {
        const li = e.target.closest("li[data-id]");
        if (!li) return;
        const box = e.target.closest(".han-plan");
        const kind = box && box.getAttribute("data-kind");
        const id = li.getAttribute("data-id");
        const list = kind === "week" ? weekItems : monthItems;
        if (e.target.classList.contains("han-plan-del")) {
          const next = list.filter(function (row) {
            return row.id !== id;
          });
          if (kind === "week") weekItems = next;
          else monthItems = next;
          paintPlans();
          savePlans();
          return;
        }
        if (e.target.classList.contains("han-plan-done")) {
          const next = list.map(function (row) {
            if (row.id !== id) return row;
            return { id: row.id, text: row.text, done: e.target.checked };
          });
          if (kind === "week") weekItems = next;
          else monthItems = next;
          paintPlans();
          savePlans();
        }
      }

      function paintHead() {
        const title =
          '<tr><th class="han-sheet-title" colspan="' + totalCols + '">' +
          escapeHtml(shop) +
          " · " +
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
                  if (key === "_layer") {
                    return "<td></td>";
                  }
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
        return Promise.all([
          jsonFetch(
            "/api/han/products?team=" + encodeURIComponent(team) + "&store=" + encodeURIComponent(shop),
          ),
          jsonFetch("/api/han/shops?team=" + encodeURIComponent(team)),
        ]).then(function (pair) {
          if (dead) return;
          items = pair[0].items || [];
          const shopTabs = root.querySelector("#han-shop-tabs");
          if (shopTabs) shopTabs.innerHTML = shopTabsHtml(team, shop, pair[1].items || []);
          paintBody();
        });
      }

      function onAdd(e) {
        const btn = e.target.closest(".han-sheet-add");
        if (!btn) return;
        const index = Number(btn.getAttribute("data-layer"));
        const layer = layers[index];
        const body = { layer: layer.name, team: team, store: shop };
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

      const exportBtn = root.querySelector("#han-export");
      const importInput = root.querySelector("#han-import");
      const tplBtn = root.querySelector("#han-tpl");
      const classifyBtn = root.querySelector("#han-classify");
      const rulesBox = root.querySelector("#han-rules");
      const rulesToggle = root.querySelector("#han-rules-toggle");
      const rulesSave = root.querySelector("#han-rules-save");
      const rulesReset = root.querySelector("#han-rules-reset");
      const rulesStatus = root.querySelector("#han-rules-status");
      const csvHeader =
        "SPU,第一个sku,退货率,推广花费占比,近7天日成交金额,成交转化率,成交单量,评价数,上架时间,价格,主图,备注";

      function savePatch(id, patch) {
        return jsonFetch("/api/han/products/" + encodeURIComponent(id), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        }).then(function (json) {
          if (dead) return json;
          msg.textContent = json.ok ? "已保存" : json.error || "保存失败";
          if (json.ok && patch.layer) {
            return load();
          }
          if (json.ok && json.item) {
            items = items.map(function (row) {
              return String(row.id) === String(id) ? json.item : row;
            });
          }
          return json;
        });
      }

      function downloadText(name, text) {
        const blob = new Blob(["\uFEFF" + text], { type: "text/csv; charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.click();
        URL.revokeObjectURL(a.href);
      }

      function onExport() {
        const url =
          "/api/han/products.csv?team=" +
          encodeURIComponent(team) +
          "&store=" +
          encodeURIComponent(shop);
        fetch(url, { credentials: "same-origin" })
          .then(function (res) {
            return res.blob();
          })
          .then(function (blob) {
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = shop + "-分层表.csv";
            a.click();
            URL.revokeObjectURL(a.href);
          })
          .catch(function (err) {
            if (!dead) msg.textContent = String(err);
          });
      }

      function onTpl() {
        downloadText("商品分层导入模板.csv", csvHeader + "\n");
      }

      function applyHints(hints) {
        if (!hints) return;
        layers.forEach(function (layer) {
          if (hints[layer.name]) layer.hint = hints[layer.name];
        });
        paintHead();
      }

      function fillRules(rules) {
        if (!rules) return;
        Array.prototype.forEach.call(root.querySelectorAll("[data-rule]"), function (input) {
          const path = input.getAttribute("data-rule").split(".");
          const group = rules[path[0]] || {};
          input.value = group[path[1]] == null ? "" : group[path[1]];
        });
      }

      function readRules() {
        const rules = { head: {}, mid: {}, tail: {}, moving: {}, testNew: {} };
        Array.prototype.forEach.call(root.querySelectorAll("[data-rule]"), function (input) {
          const path = input.getAttribute("data-rule").split(".");
          rules[path[0]][path[1]] = Number(input.value);
        });
        return rules;
      }

      function loadRules() {
        return jsonFetch(
          "/api/han/shop-rules?team=" + encodeURIComponent(team) + "&store=" + encodeURIComponent(shop),
        ).then(function (json) {
          if (dead || !json.ok) return json;
          fillRules(json.rules);
          applyHints(json.hints);
          rulesStatus.textContent = json.custom
            ? "当前使用本店已保存规则。"
            : "当前使用初版默认规则，保存后只改本店。";
          return json;
        });
      }

      function onToggleRules() {
        rulesBox.classList.toggle("is-open");
      }

      function onSaveRules() {
        jsonFetch("/api/han/shop-rules", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ team: team, store: shop, rules: readRules() }),
        }).then(function (json) {
          if (dead) return;
          if (!json.ok) {
            msg.textContent = json.error || "保存规则失败";
            return;
          }
          fillRules(json.rules);
          applyHints(json.hints);
          rulesStatus.textContent = "已保存本店规则。";
          msg.textContent = "本店规则已保存，可点「按本店规则分类」重算。";
        });
      }

      function onResetRules() {
        jsonFetch(
          "/api/han/shop-rules?team=" + encodeURIComponent(team) + "&store=" + encodeURIComponent(shop),
          { method: "DELETE" },
        ).then(function (json) {
          if (dead) return;
          if (!json.ok) {
            msg.textContent = json.error || "恢复失败";
            return;
          }
          fillRules(json.rules);
          applyHints(json.hints);
          rulesStatus.textContent = "已恢复初版默认规则。";
          msg.textContent = "本店已恢复默认规则。";
        });
      }

      function onClassify() {
        jsonFetch("/api/han/products/classify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ team: team, store: shop }),
        }).then(function (json) {
          if (dead) return;
          msg.textContent = json.ok ? "已按本店规则调动" + (json.count || 0) + "条" : json.error || "分类失败";
          if (json.ok) return load();
        });
      }

      function onSheetChange(e) {
        const pick = e.target.closest(".han-layer-pick");
        if (!pick) return;
        savePatch(pick.getAttribute("data-id"), { layer: pick.value });
      }

      function onSheetBlur(e) {
        const input = e.target.closest("input.han-cell");
        if (!input) return;
        const id = input.getAttribute("data-id");
        const key = input.getAttribute("data-key");
        const patch = {};
        patch[key] = input.value;
        savePatch(id, patch);
      }

      function onImported(json) {
        if (dead) return;
        const n = (json.created || []).length;
        msg.textContent = json.ok
          ? "已按本店规则导入" + n + "条" + (json.skipped ? "，跳过" + json.skipped + "条" : "")
          : json.error || "导入失败";
        if (json.ok) return load();
      }

      function onImport(e) {
        const file = e.target.files && e.target.files[0];
        e.target.value = "";
        if (!file) return;
        const name = file.name || "";
        if (/\.xlsx$/i.test(name)) {
          const url =
            "/api/han/products/import-file?team=" +
            encodeURIComponent(team) +
            "&store=" +
            encodeURIComponent(shop) +
            "&filename=" +
            encodeURIComponent(name);
          fetch(url, {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/octet-stream" },
            body: file,
          })
            .then(function (res) {
              return res.json();
            })
            .then(onImported)
            .catch(function (err) {
              if (!dead) msg.textContent = String(err);
            });
          return;
        }
        const reader = new FileReader();
        reader.onload = function () {
          jsonFetch("/api/han/products/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ team: team, store: shop, csv: String(reader.result || "") }),
          }).then(onImported);
        };
        reader.readAsText(file, "utf-8");
      }

      paintHead();
      table.addEventListener("click", onAdd);
      table.addEventListener("change", onSheetChange);
      table.addEventListener("focusout", onSheetBlur);
      classifyBtn.addEventListener("click", onClassify);
      rulesToggle.addEventListener("click", onToggleRules);
      rulesSave.addEventListener("click", onSaveRules);
      rulesReset.addEventListener("click", onResetRules);
      exportBtn.addEventListener("click", onExport);
      tplBtn.addEventListener("click", onTpl);
      importInput.addEventListener("change", onImport);
      monthAdd.addEventListener("click", function () {
        addPlan("month");
      });
      weekAdd.addEventListener("click", function () {
        addPlan("week");
      });
      monthInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          addPlan("month");
        }
      });
      weekInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          addPlan("week");
        }
      });
      root.querySelector(".han-plans").addEventListener("click", onPlanClick);
      Promise.all([load(), loadRules(), loadPlans()]).catch(function (err) {
        if (!dead) msg.textContent = String(err);
      });
      return function unmount() {
        dead = true;
        table.removeEventListener("click", onAdd);
        table.removeEventListener("change", onSheetChange);
        table.removeEventListener("focusout", onSheetBlur);
        classifyBtn.removeEventListener("click", onClassify);
        rulesToggle.removeEventListener("click", onToggleRules);
        rulesSave.removeEventListener("click", onSaveRules);
        rulesReset.removeEventListener("click", onResetRules);
        exportBtn.removeEventListener("click", onExport);
        tplBtn.removeEventListener("click", onTpl);
        importInput.removeEventListener("change", onImport);
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

  function goodsRoot() {
    return (
      document.querySelector("[data-xm-mounted='/han/goods']") ||
      document.querySelector(".xm-workspace > .xm-pane.is-active") ||
      document.getElementById("xm-content")
    );
  }

  function remountGoods(root, path) {
    const modulePath = path || "/han/goods";
    const prev = root.__hanGoodsUnmount || window.__xmUnmount;
    if (typeof prev === "function") {
      try {
        prev();
      } catch (_err) {}
    }
    if (!window.XmModules || !window.XmModules[modulePath]) {
      return;
    }
    const stop = window.XmModules[modulePath].mount(root);
    root.__hanGoodsUnmount = stop;
    window.__xmUnmount = stop;
  }

  function animateGoodsSwap(root, path) {
    if (!root || window.__hanGoodsBusy) {
      return;
    }
    window.__hanGoodsBusy = 1;
    const stage = root.querySelector(".han-goods-stage") || root;
    stage.classList.add("is-leave");
    window.setTimeout(function () {
      remountGoods(root, path);
      const fresh = root.querySelector(".han-goods-stage");
      if (fresh) {
        fresh.classList.add("is-enter");
        window.requestAnimationFrame(function () {
          window.requestAnimationFrame(function () {
            fresh.classList.remove("is-enter");
          });
        });
      }
      window.__hanGoodsBusy = 0;
    }, 180);
  }

  function goHanPage(href) {
    const target = String(href || "/han/goods");
    const here = String(location.pathname || "") + String(location.search || "");
    if (here === target || here === target + "/") {
      return;
    }
    const path = target.split("?")[0].replace(/\/+$/, "") || "/";
    if (path === "/han/goods" || path === "/han/selection") {
      history.pushState({ xm: path }, "", target);
      const root =
        document.querySelector("[data-xm-mounted='" + path + "']") || goodsRoot();
      if (root) {
        animateGoodsSwap(root, path);
        return;
      }
    }
    if (typeof window.__xmGo === "function" && target.indexOf("?") < 0) {
      window.__xmGo(target);
      return;
    }
    location.assign(target);
  }

  function ensureHanChrome() {
    if (!document.getElementById("han-top-tabs-css")) {
      const style = document.createElement("style");
      style.id = "han-top-tabs-css";
      style.textContent =
        ".han-goods-teams{display:none!important}" +
        ".han-tabs{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 14px}" +
        ".han-tab{display:inline-flex;align-items:center;min-height:34px;padding:6px 16px;border-radius:999px;background:#f3f4f6;color:#374151;text-decoration:none;font-size:14px;font-weight:600;transition:background .18s ease,color .18s ease,box-shadow .18s ease,transform .18s ease}" +
        ".han-tab:hover{background:#e5e7eb}" +
        ".han-tab:active{transform:scale(.98)}" +
        ".han-tab.is-active{background:#fff;color:#111827;box-shadow:0 0 0 1px #e5e7eb}" +
        ".han-tabs-sub .han-tab{min-height:30px;font-size:13px;font-weight:500}" +
        ".han-team-card{display:inline-block;margin:0 0.5rem 0.5rem 0;padding:0.55rem 0.9rem;border-radius:8px;background:#ccfbf1;color:#134e4a;text-decoration:none;font-weight:600;transition:transform .18s ease,box-shadow .18s ease}" +
        ".han-team-card:hover{transform:translateY(-1px)}" +
        ".han-goods-stage{opacity:1;transform:translate3d(0,0,0);transition:opacity .22s ease,transform .22s ease}" +
        ".han-goods-stage.is-leave,.han-goods-stage.is-enter{opacity:0;transform:translate3d(0,10px,0)}";
      document.head.appendChild(style);
    }
    const leftover = document.getElementById("han-goods-teams");
    if (leftover && leftover.parentNode) leftover.parentNode.removeChild(leftover);
    if (!window.__hanTabBound) {
      window.__hanTabBound = 1;
      document.addEventListener("click", function (event) {
        const link = event.target.closest ? event.target.closest("a[data-han-tab]") : null;
        if (!link) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button) return;
        event.preventDefault();
        goHanPage(link.getAttribute("href") || "/han/selection");
      });
      window.addEventListener("popstate", function () {
        const path = String(location.pathname || "").replace(/\/+$/, "") || "/";
        if (path !== "/han/goods" && path !== "/han/selection") return;
        const root = document.querySelector("[data-xm-mounted='" + path + "']") || goodsRoot();
        if (root && root.querySelector(".han-goods-stage")) {
          animateGoodsSwap(root, path);
        }
      });
    }
  }

  function watchHanChrome() {
    ensureHanChrome();
    let n = 0;
    const timer = setInterval(function () {
      n += 1;
      ensureHanChrome();
      if (n > 40) clearInterval(timer);
    }, 200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", watchHanChrome);
  } else {
    watchHanChrome();
  }
})();
