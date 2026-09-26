/* 韩梦凯付费中心 / 充值规则。数据走 /api/han/worker，看板和档位与沈子晗对齐。 */
(function () {
  var VERSION = "20260926-align";

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function money(value) {
    return (Number(value) || 0).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function integer(value) {
    return (Number(value) || 0).toLocaleString("zh-CN");
  }

  function rate(value) {
    return (Number(value) || 0).toFixed(2);
  }

  function jsonFetch(url, options) {
    return fetch(url, Object.assign({ credentials: "same-origin" }, options || {})).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          throw new Error((data && data.error) || "请求失败");
        }
        return data;
      });
    });
  }

  var css =
    ".han-paid{display:flex;flex-direction:column;gap:12px}" +
    ".han-paid .page-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin:0}" +
    ".han-paid .page-head h1{margin:0;font-size:22px}" +
    ".han-paid .lead{margin:6px 0 0;color:#6b7280;font-size:13px}" +
    ".han-paid-meta{display:flex;align-items:center;gap:8px;color:#6b7280;font-size:13px}" +
    ".han-paid-dot{width:6px;height:6px;border-radius:50%;background:#52c41a;box-shadow:0 0 0 4px rgba(82,196,26,.12)}" +
    ".han-paid .kpi-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}" +
    ".han-paid .kpi-card{background:#fff;border-radius:8px;box-shadow:0 1px 2px rgba(0,0,0,.03),0 8px 24px rgba(0,0,0,.04);min-height:86px;padding:14px 16px 12px}" +
    ".han-paid .kpi-card .label{color:#6b7280;font-size:12px}" +
    ".han-paid .kpi-card .value{font-size:22px;font-weight:700;margin-top:6px}" +
    ".han-paid .kpi-card .unit{margin-left:4px;font-size:12px;font-weight:500;color:#6b7280}" +
    ".han-paid .panel{background:#fff;border-radius:8px;box-shadow:0 1px 2px rgba(0,0,0,.03),0 8px 24px rgba(0,0,0,.04);padding:14px 16px 16px}" +
    ".han-paid-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px}" +
    ".han-paid-toolbar h2{margin:0;font-size:16px}" +
    ".han-paid-toolbar .row,.han-paid-toolbar-left{display:flex;align-items:center;gap:8px;flex-wrap:wrap}" +
    ".han-paid input,.han-paid select,.han-paid button{height:32px;border:1px solid #e5e7eb;border-radius:6px;background:#fff;padding:0 10px;font-size:13px}" +
    ".han-paid button{cursor:pointer}" +
    ".han-paid-table-wrap{overflow:auto;max-height:calc(100vh - 320px);border:1px solid #e5e7eb;border-radius:8px}" +
    ".han-paid table{width:100%;border-collapse:separate;border-spacing:0;font-size:13px}" +
    ".han-paid thead th{position:sticky;top:0;z-index:1;background:#fafafa;color:#6b7280;font-weight:600;white-space:nowrap;padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right}" +
    ".han-paid thead th:first-child,.han-paid thead th:nth-child(2),.han-paid td:first-child,.han-paid td:nth-child(2){text-align:left}" +
    ".han-paid tbody td{padding:10px 12px;border-bottom:1px solid #f3f4f6;white-space:nowrap;text-align:right}" +
    ".han-paid tbody tr:hover td{background:#f8fbff}" +
    ".han-paid tbody tr.is-zero td{color:#9ca3af}" +
    ".han-paid-store{color:#0f766e;font-weight:700;text-decoration:none;cursor:pointer;background:none;border:0;padding:0;height:auto}" +
    ".han-paid-date{display:block;margin-top:2px;color:#9ca3af;font-size:12px;font-weight:400}" +
    ".han-paid-tag{display:inline-flex;align-items:center;justify-content:center;min-width:36px;height:22px;padding:0 8px;border-radius:999px;font-size:12px;font-weight:600}" +
    ".han-paid-tag.is-yes{background:#ecfdf3;color:#027a48}" +
    ".han-paid-tag.is-no{background:#fef3f2;color:#b42318}" +
    ".han-rules-num{width:88px}" +
    ".han-rules-shops{display:flex;flex-wrap:wrap;gap:8px}" +
    ".han-rules-shop{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid #e5e7eb;border-radius:999px;background:#fff}" +
    ".han-rules-run.is-on{color:#027a48}" +
    ".han-rules-run.is-off{color:#6b7280}" +
    ".han-rules-save{background:#0f766e;color:#fff;border-color:#0f766e}" +
    ".han-paid .status{min-height:20px;font-size:13px}" +
    ".han-paid .status.ok{color:#027a48}" +
    ".han-paid .status.error{color:#b42318}" +
    ".han-paid .empty{color:#6b7280;margin:8px 0}" +
    "@media (max-width:1100px){.han-paid .kpi-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}" +
    "@media (max-width:700px){.han-paid .kpi-grid{grid-template-columns:1fr 1fr}}";

  function page(title, lead, body) {
    return (
      '<main class="page han-paid"><style>' + css + "</style>" +
      '<header class="page-head"><div><p class="kicker">韩梦凯运营中心</p><h1>' + escapeHtml(title) + "</h1>" +
      '<p class="lead">' + escapeHtml(lead) + "</p></div>" + body
    );
  }

  function mountCenter(root) {
    root.innerHTML = page(
      "付费中心",
      "最新一次回传的全店快照。点店铺名称下钻查看子账号和充值记录。",
      '<div class="han-paid-meta"><span class="han-paid-dot"></span><span id="han-paid-asof">等待回传</span></div></header>' +
      '<section class="kpi-grid" id="han-paid-kpis"></section><div id="han-paid-body"></div><p id="han-paid-status" class="status"></p></main>'
    );
    var asofEl = root.querySelector("#han-paid-asof");
    var kpiEl = root.querySelector("#han-paid-kpis");
    var bodyEl = root.querySelector("#han-paid-body");
    var statusEl = root.querySelector("#han-paid-status");
    var dead = false;
    var overviewRows = [];
    var keyword = "";

    function setStatus(message, isError) {
      statusEl.textContent = message || "";
      statusEl.className = "status" + (isError ? " error" : message ? " ok" : "");
    }

    function successTag(value) {
      if (value === "是") return '<span class="han-paid-tag is-yes">是</span>';
      if (value === "否") return '<span class="han-paid-tag is-no">否</span>';
      return '<span class="han-paid-tag">' + escapeHtml(value || "—") + "</span>";
    }

    function renderKpis(metrics) {
      var cards = [
        { label: metrics.detail ? "子账号" : "店铺数", value: integer(metrics.stores), unit: metrics.detail ? "个" : "家" },
        { label: "京准通花费", value: money(metrics.spend) },
        { label: "京麦成交", value: money(metrics.jingmaiGmv) },
        { label: "总订单金额", value: money(metrics.totalOrderAmount) },
        { label: "付费订单", value: integer(metrics.paidOrders), unit: "单" },
        { label: "回传成功", value: integer(metrics.successCount), unit: metrics.detail ? "店" : "店" },
      ];
      kpiEl.innerHTML = cards.map(function (card) {
        return '<article class="kpi-card"><div class="label">' + escapeHtml(card.label) + '</div><div class="value">' +
          card.value + (card.unit ? '<span class="unit">' + escapeHtml(card.unit) + "</span>" : "") + "</div></article>";
      }).join("");
    }

    function metricCells(row) {
      return "<td>" + escapeHtml(row.accountId || "—") + "</td><td>" + money(row.spend) + "</td><td>" +
        integer(row.paidOrders) + "</td><td>" + rate(row.roi) + "</td><td>" + rate(row.cvr) + "</td><td>" +
        money(row.cpc) + "</td><td>" + money(row.jingmaiGmv) + "</td><td>" + integer(row.clicks) + "</td><td>" +
        rate(row.ctr) + "</td><td>" + money(row.totalOrderAmount) + "</td><td>" + rate(row.realFeeRatio) + "</td><td>" +
        successTag(row.success) + "</td>";
    }

    function headerRow(first) {
      return "<thead><tr><th>" + first + "</th><th>京准通主账户ID</th><th>京准通花费</th><th>京准通付费订单数</th>" +
        "<th>京准通付费投产比</th><th>京准通付费转化率</th><th>京准通平均点击成本</th><th>京麦成交金额</th>" +
        "<th>京准通点击数</th><th>京准通点击率</th><th>京准通总订单金额</th><th>真实费比</th><th>是否成功</th></tr></thead>";
    }

    function isZeroRow(row) {
      return !(Number(row.spend) || Number(row.paidOrders) || Number(row.jingmaiGmv) || Number(row.clicks));
    }

    function renderOverviewTable(rows) {
      var filtered = keyword ? rows.filter(function (row) { return String(row.store || "").indexOf(keyword) >= 0; }) : rows;
      if (!filtered.length) return '<p class="empty">暂无回传数据</p>';
      return '<div class="han-paid-table-wrap"><table>' + headerRow("店铺名称") + "<tbody>" + filtered.map(function (row) {
        return '<tr class="' + (isZeroRow(row) ? "is-zero" : "") + '"><td><button type="button" class="han-paid-store" data-han-store="' +
          escapeHtml(row.store) + '">' + escapeHtml(row.store) + '</button><span class="han-paid-date">' +
          escapeHtml(row.date || row.capturedAt || "") + "</span></td>" + metricCells(row) + "</tr>";
      }).join("") + "</tbody></table></div>";
    }

    function renderOverview(data) {
      overviewRows = data.shops || [];
      var metrics = data.metrics || data.totals || {};
      asofEl.textContent = data.asOf || data.capturedAt
        ? "最新回传 " + (data.asOf || data.capturedAt) + " · " + (metrics.stores || overviewRows.length) + " 店"
        : "等待回传";
      renderKpis(metrics);
      bodyEl.innerHTML = '<section class="panel"><div class="han-paid-toolbar"><h2>本次回传</h2><div class="row">' +
        '<input id="han-paid-filter" type="search" maxlength="64" placeholder="搜索店铺名称" /></div></div>' +
        '<div id="han-paid-table">' + renderOverviewTable(overviewRows) + "</div></section>";
      var filter = root.querySelector("#han-paid-filter");
      if (filter) {
        filter.value = keyword;
        filter.addEventListener("input", function () {
          keyword = filter.value.trim();
          var wrap = root.querySelector("#han-paid-table");
          if (wrap) wrap.innerHTML = renderOverviewTable(overviewRows);
        });
      }
    }

    function subCells(row) {
      return "<td>" + money(row.balance) + "</td><td>" + escapeHtml(row.remark || "—") + "</td><td>" + money(row.spend) +
        "</td><td>" + rate(row.roi) + "</td><td>" + integer(row.paidOrders != null ? row.paidOrders : row.orders) +
        "</td><td>" + money(row.totalOrderAmount) + "</td><td>" + integer(row.impressions) + "</td><td>" +
        integer(row.clicks) + "</td><td>" + rate(row.ctr) + "</td><td>" + money(row.cpc) + "</td>";
    }

    function renderDetail(data) {
      var shop = data.shop || { store: data.store };
      var accounts = data.subaccounts || [];
      var recharges = data.recharges || [];
      var spend = 0;
      var orders = 0;
      var orderAmount = 0;
      accounts.forEach(function (row) {
        spend += Number(row.spend) || 0;
        orders += Number(row.paidOrders != null ? row.paidOrders : row.orders) || 0;
        orderAmount += Number(row.totalOrderAmount) || 0;
      });
      asofEl.textContent = (shop.accountId ? "京准通主账户 " + shop.accountId + " · " : "") + accounts.length + " 个子账号";
      renderKpis({
        detail: true,
        stores: accounts.length,
        spend: spend || shop.spend,
        jingmaiGmv: shop.jingmaiGmv,
        totalOrderAmount: orderAmount || shop.totalOrderAmount,
        paidOrders: orders || shop.paidOrders,
        successCount: shop.success === "否" ? 0 : 1,
      });
      var rechargeAmount = recharges.reduce(function (sum, row) { return sum + (Number(row.amount) || 0); }, 0);
      bodyEl.innerHTML =
        '<section class="panel"><div class="han-paid-toolbar"><div class="han-paid-toolbar-left">' +
        '<button type="button" id="han-paid-back">返回付费中心</button><h2>' + escapeHtml(data.store || shop.store) +
        "</h2></div></div></section>" +
        '<section class="panel"><h2>子账号</h2>' +
        (accounts.length
          ? '<div class="han-paid-table-wrap"><table><thead><tr><th>子账号</th><th>余额</th><th>账户备注</th><th>花费</th><th>投产比</th><th>单量</th><th>订单金额</th><th>展现数</th><th>点击数</th><th>点击率</th><th>平均点击成本</th></tr></thead><tbody>' +
            accounts.map(function (row) {
              return "<tr><td>" + escapeHtml(row.subAccountName || row.subAccountId) + '<span class="han-paid-date">' +
                escapeHtml(row.subAccountId || "") + "</span></td>" + subCells(row) + "</tr>";
            }).join("") + "</tbody></table></div>"
          : '<p class="empty">本地程序尚未回传子账号明细</p>') +
        "</section>" +
        '<section class="panel"><h2>充值记录</h2><p class="lead">累计充值 ' + money(rechargeAmount) + " · " + integer(recharges.length) +
        " 笔</p>" +
        (recharges.length
          ? '<div class="han-paid-table-wrap"><table><thead><tr><th>充值时间</th><th>子账号名称</th><th>充值金额</th><th>账户余额</th><th>命中规则</th><th>结果</th></tr></thead><tbody>' +
            recharges.map(function (row) {
              return "<tr><td>" + escapeHtml(row.chargedAt || "") + "</td><td>" + escapeHtml(row.subAccountName || row.subAccountId || "—") +
                "</td><td>" + money(row.amount) + "</td><td>" + money(row.balance) + "</td><td>" + escapeHtml(row.ruleCode || row.note || "—") +
                "</td><td>" + escapeHtml(row.result || "—") + "</td></tr>";
            }).join("") + "</tbody></table></div>"
          : '<p class="empty">暂无充值记录，本地程序回传后在此展示</p>') +
        "</section>";
    }

    function loadOverview() {
      setStatus("正在加载…");
      return jsonFetch("/api/han/worker?view=overview").then(function (data) {
        if (dead) return;
        renderOverview(data);
        setStatus("已更新");
      });
    }

    function loadShop(store) {
      setStatus("正在加载…");
      return jsonFetch("/api/han/worker?view=shop&store=" + encodeURIComponent(store)).then(function (data) {
        if (dead) return;
        renderDetail(data);
        setStatus("已更新");
      });
    }

    bodyEl.addEventListener("click", function (event) {
      var link = event.target.closest("[data-han-store]");
      if (link) {
        loadShop(link.getAttribute("data-han-store")).catch(function (err) {
          if (!dead) setStatus(err.message || "加载失败", true);
        });
        return;
      }
      if (event.target.closest("#han-paid-back")) loadOverview().catch(function (err) {
        if (!dead) setStatus(err.message || "加载失败", true);
      });
    });

    var store = new URLSearchParams(window.location.search).get("store") || "";
    (store ? loadShop(store) : loadOverview()).catch(function (err) {
      if (!dead) setStatus(err.message || "加载失败", true);
    });
    return function unmount() {
      dead = true;
      root.innerHTML = "";
    };
  }

  function mountRules(root) {
    root.innerHTML = page(
      "充值规则",
      "只配置自己名下店铺和子账号。本地工作机保持运行，店铺启停和充值规则由本页控制。未保存过的子账号显示默认档位：计划ROI 2，第一档花费1–1000且余额≤100充100，第二档花费≥1000且余额≤50充150。网站不保存京准通 Cookie，也不直接充值。",
      '<div class="han-paid-meta"><span class="han-paid-dot"></span><span id="han-rules-asof">等待配置</span></div></header>' +
      '<section class="panel"><div class="han-paid-toolbar"><h2>工作机运行店铺</h2><div class="row" id="han-rules-run-actions"></div></div>' +
      '<p class="lead" id="han-rules-run-hint">勾选=开启持续运行；取消=停止。全部取消时本地机在线待机，不再开新一轮充值。</p>' +
      '<div id="han-rules-run-shops" class="han-rules-shops"></div></section>' +
      '<section class="panel"><div class="han-paid-toolbar"><h2>子账号规则</h2><div class="row" id="han-rules-toolbar"></div></div>' +
      '<div id="han-rules-table"><p class="empty">加载中…</p></div></section>' +
      '<section class="panel" id="han-rules-history-wrap" hidden><h2>修改历史</h2><div id="han-rules-history"></div></section>' +
      '<p id="han-rules-status" class="status"></p></main>'
    );
    var statusEl = root.querySelector("#han-rules-status");
    var asofEl = root.querySelector("#han-rules-asof");
    var toolbarEl = root.querySelector("#han-rules-toolbar");
    var tableWrap = root.querySelector("#han-rules-table");
    var historyWrap = root.querySelector("#han-rules-history-wrap");
    var historyEl = root.querySelector("#han-rules-history");
    var dead = false;
    var rows = [];
    var selected = new Set();
    var shop = "";
    var keyword = "";
    var enabledOnly = false;
    var lastMeta = { shops: [], shopRuns: [], machines: [], runListSaved: false };
    var runSelected = new Set();

    function setStatus(message, isError) {
      statusEl.textContent = message || "";
      statusEl.className = "status" + (isError ? " error" : message ? " ok" : "");
    }

    function rowKey(row) {
      return row.store + "\t" + row.accountId + "\t" + row.subAccountId;
    }

    function headers() {
      return ["选择", "店铺名称", "京准通主账户ID", "子账号名称", "子账号ID", "自动充值", "计划ROI", "第一档花费下限", "第一档花费上限", "第一档余额阈值", "第一档充值金额", "第二档花费下限", "第二档余额阈值", "第二档充值金额", "ROI上涨充值金额", "连续充值未增单次数", "暂停分钟数", "配置版本", "最后修改人", "最后修改时间", "本地机状态", "本地机最后同步时间"];
    }

    function visibleRows() {
      return rows.filter(function (row) {
        if (shop && row.store !== shop) return false;
        if (enabledOnly && !row.autoRecharge) return false;
        if (!keyword) return true;
        return (String(row.subAccountName || "") + " " + String(row.subAccountId || "")).indexOf(keyword) >= 0;
      });
    }

    function numInput(row, field, step) {
      return '<input class="han-rules-num" data-key="' + escapeHtml(rowKey(row)) + '" data-field="' + field +
        '" type="number" min="0" step="' + (step || "1") + '" value="' + escapeHtml(row[field]) + '" />';
    }

    function collectEdits() {
      root.querySelectorAll(".han-rules-num").forEach(function (input) {
        var row = rows.find(function (item) { return rowKey(item) === input.getAttribute("data-key"); });
        if (row) row[input.getAttribute("data-field")] = input.value;
      });
      root.querySelectorAll(".han-rules-auto").forEach(function (input) {
        var row = rows.find(function (item) { return rowKey(item) === input.getAttribute("data-key"); });
        if (row) row.autoRecharge = input.checked;
      });
    }

    function payloadRows(list) {
      return list.map(function (row) {
        return {
          店铺名称: row.store,
          京准通主账户ID: String(row.accountId || ""),
          子账号ID: String(row.subAccountId || ""),
          子账号名称: row.subAccountName || "",
          自动充值: row.autoRecharge === true || row.autoRecharge === "true",
          计划ROI: row.plannedRoi,
          第一档花费下限: row.tier1MinSpend,
          第一档花费上限: row.tier1MaxSpend,
          第一档余额阈值: row.tier1Balance,
          第一档充值金额: row.tier1Amount,
          第二档花费下限: row.tier2MinSpend,
          第二档余额阈值: row.tier2Balance,
          第二档充值金额: row.tier2Amount,
          ROI上涨充值金额: row.roiRiseAmount,
          连续充值未增单次数: row.noOrderTimes,
          暂停分钟数: row.pauseMinutes,
        };
      });
    }

    function renderRunShops() {
      var box = root.querySelector("#han-rules-run-shops");
      var actions = root.querySelector("#han-rules-run-actions");
      var shops = lastMeta.shops || [];
      var machines = lastMeta.machines || [];
      actions.innerHTML = (machines.length
        ? '<span>已绑定本地机：' + machines.map(function (item) {
          return escapeHtml(item.machineId) + "（" + escapeHtml(item.status || "待同步") + "）";
        }).join("、") + "</span>"
        : "<span>还没有本地机 ACK。韩梦凯这台用 machineId=han-worker-01。</span>") +
        '<button type="button" class="han-rules-save" id="han-rules-run-save">保存运行状态</button>';
      box.innerHTML = shops.length ? shops.map(function (name) {
        var run = (lastMeta.shopRuns || []).find(function (item) { return item.store === name; });
        var status = (run && run.status) || (runSelected.has(name) ? "已开启" : "已停止");
        var tone = status === "已开启" ? "on" : "off";
        return '<label class="han-rules-shop"><input type="checkbox" data-run-shop="' + escapeHtml(name) + '"' +
          (runSelected.has(name) ? " checked" : "") + " /><span>" + escapeHtml(name) +
          '</span><span class="han-rules-run is-' + tone + '">' + escapeHtml(status) + "</span></label>";
      }).join("") : '<p class="empty">等本地机回传子账号后，才能勾选要跑的店。</p>';
      box.querySelectorAll("[data-run-shop]").forEach(function (input) {
        input.addEventListener("change", function () {
          var name = input.getAttribute("data-run-shop");
          if (input.checked) runSelected.add(name);
          else runSelected.delete(name);
          var badge = input.parentNode.querySelector(".han-rules-run");
          if (badge) {
            badge.textContent = input.checked ? "已开启" : "已停止";
            badge.className = "han-rules-run is-" + (input.checked ? "on" : "off");
          }
        });
      });
      var saveBtn = root.querySelector("#han-rules-run-save");
      if (saveBtn) saveBtn.addEventListener("click", saveRunShops);
    }

    function renderToolbar() {
      var shops = ['<option value="">全部店铺</option>'].concat((lastMeta.shops || []).map(function (name) {
        return '<option value="' + escapeHtml(name) + '"' + (shop === name ? " selected" : "") + ">" + escapeHtml(name) + "</option>";
      }));
      toolbarEl.innerHTML =
        "<label>店铺选择 <select id=\"han-rules-shop\">" + shops.join("") + "</select></label>" +
        '<input id="han-rules-q" type="search" maxlength="64" placeholder="子账号名称/ID搜索" value="' + escapeHtml(keyword) + '" />' +
        '<label><input id="han-rules-enabled" type="checkbox"' + (enabledOnly ? " checked" : "") + " /> 只看已启用</label>" +
        '<input id="han-rules-batch-roi" type="number" min="0" step="0.01" placeholder="批量计划ROI" />' +
        '<button type="button" id="han-rules-apply-roi">批量设置计划ROI</button>' +
        '<button type="button" id="han-rules-on">批量启用</button>' +
        '<button type="button" id="han-rules-off">批量暂停</button>' +
        '<button type="button" class="han-rules-save" id="han-rules-save">保存</button>' +
        '<button type="button" id="han-rules-history-btn">修改历史</button>';
      root.querySelector("#han-rules-shop").addEventListener("change", function (event) {
        collectEdits();
        shop = event.target.value;
        renderTable();
      });
      root.querySelector("#han-rules-q").addEventListener("input", function (event) {
        collectEdits();
        keyword = event.target.value.trim();
        renderTable();
      });
      root.querySelector("#han-rules-enabled").addEventListener("change", function (event) {
        collectEdits();
        enabledOnly = event.target.checked;
        renderTable();
      });
      root.querySelector("#han-rules-apply-roi").addEventListener("click", batchRoi);
      root.querySelector("#han-rules-on").addEventListener("click", function () { batchAuto(true); });
      root.querySelector("#han-rules-off").addEventListener("click", function () { batchAuto(false); });
      root.querySelector("#han-rules-save").addEventListener("click", function () { saveRules(rows, "保存充值规则"); });
      root.querySelector("#han-rules-history-btn").addEventListener("click", loadHistory);
      renderRunShops();
    }

    function renderTable() {
      var list = visibleRows();
      if (!list.length) {
        tableWrap.innerHTML = rows.length ? '<p class="empty">没有匹配的子账号。</p>' : '<p class="empty">暂无子账号。先等本地机把店铺回传到付费中心。</p>';
        return;
      }
      tableWrap.innerHTML = '<div class="han-paid-table-wrap"><table><thead><tr>' + headers().map(function (title) {
        return "<th>" + title + "</th>";
      }).join("") + "</tr></thead><tbody>" + list.map(function (row) {
        var key = rowKey(row);
        return '<tr><td><input type="checkbox" data-check="' + escapeHtml(key) + '"' + (selected.has(key) ? " checked" : "") +
          " /></td><td>" + escapeHtml(row.store) + "</td><td>" + escapeHtml(String(row.accountId || "")) + "</td><td>" +
          escapeHtml(row.subAccountName || "") + "</td><td>" + escapeHtml(String(row.subAccountId || "")) +
          '</td><td><label><input class="han-rules-auto" data-key="' + escapeHtml(key) + '" type="checkbox"' +
          (row.autoRecharge ? " checked" : "") + " /> " + (row.autoRecharge ? "是" : "否") + "</label></td><td>" +
          numInput(row, "plannedRoi", "0.01") + "</td><td>" + numInput(row, "tier1MinSpend") + "</td><td>" +
          numInput(row, "tier1MaxSpend") + "</td><td>" + numInput(row, "tier1Balance") + "</td><td>" +
          numInput(row, "tier1Amount") + "</td><td>" + numInput(row, "tier2MinSpend") + "</td><td>" +
          numInput(row, "tier2Balance") + "</td><td>" + numInput(row, "tier2Amount") + "</td><td>" +
          numInput(row, "roiRiseAmount") + "</td><td>" + numInput(row, "noOrderTimes") + "</td><td>" +
          numInput(row, "pauseMinutes") + "</td><td>" + escapeHtml(String(row.version || 0)) + "</td><td>" +
          escapeHtml(row.updatedBy || "—") + "</td><td>" + escapeHtml(row.updatedAt || "—") + "</td><td>" +
          escapeHtml(row.syncStatus || "待同步") + "</td><td>" + escapeHtml(row.syncedAt || "—") + "</td></tr>";
      }).join("") + "</tbody></table></div>";
      tableWrap.querySelectorAll("[data-check]").forEach(function (box) {
        box.addEventListener("change", function () {
          var key = box.getAttribute("data-check");
          if (box.checked) selected.add(key);
          else selected.delete(key);
        });
      });
    }

    function checkedRows() {
      collectEdits();
      return rows.filter(function (row) { return selected.has(rowKey(row)); });
    }

    function saveRules(list, summary) {
      collectEdits();
      var target = list || rows;
      if (!target.length) {
        setStatus("没有可保存的规则", true);
        return;
      }
      setStatus("保存中…");
      jsonFetch("/api/han/worker", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rules", changeSummary: summary, rows: payloadRows(target) }),
      }).then(function (data) {
        return load().then(function () {
          setStatus("已保存版本 " + data.version);
        });
      }).catch(function (err) {
        if (!dead) setStatus(err.message || "保存失败", true);
      });
    }

    function batchRoi() {
      var value = root.querySelector("#han-rules-batch-roi").value;
      var picked = checkedRows();
      if (!picked.length) {
        setStatus("请先勾选要改计划ROI的子账号", true);
        return;
      }
      if (value === "") {
        setStatus("请填写批量计划ROI", true);
        return;
      }
      picked.forEach(function (row) { row.plannedRoi = value; });
      saveRules(picked, "批量设置计划ROI");
    }

    function batchAuto(on) {
      var picked = checkedRows();
      if (!picked.length) {
        setStatus("请先勾选要启用或暂停的子账号", true);
        return;
      }
      picked.forEach(function (row) { row.autoRecharge = on; });
      saveRules(picked, on ? "批量启用自动充值" : "批量暂停自动充值");
    }

    function saveRunShops() {
      var names = lastMeta.shops || [];
      var runShops = names.filter(function (name) { return runSelected.has(name); });
      setStatus("保存运行状态…");
      jsonFetch("/api/han/worker", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run", changeSummary: "保存运行状态", runShops: runShops }),
      }).then(function (data) {
        return load().then(function () {
          setStatus("已保存版本 " + data.version + "，已开启 " + runShops.length + " 家店");
        });
      }).catch(function (err) {
        if (!dead) setStatus(err.message || "保存失败", true);
      });
    }

    function loadHistory() {
      historyWrap.hidden = false;
      historyEl.innerHTML = '<p class="empty">加载历史…</p>';
      jsonFetch("/api/han/worker?view=history").then(function (data) {
        var items = (data && data.items) || [];
        if (!items.length) {
          historyEl.innerHTML = '<p class="empty">还没有修改记录。</p>';
          return;
        }
        historyEl.innerHTML = '<div class="han-paid-table-wrap"><table><thead><tr><th>版本</th><th>店铺</th><th>子账号ID</th><th>字段</th><th>旧值</th><th>新值</th><th>修改人</th><th>时间</th><th>摘要</th></tr></thead><tbody>' +
          items.map(function (row) {
            return "<tr><td>" + escapeHtml(row.version || "") + "</td><td>" + escapeHtml(row.store || "") + "</td><td>" +
              escapeHtml(row.subAccountId || "") + "</td><td>" + escapeHtml(row.field || "") + "</td><td>" +
              escapeHtml(row.oldValue || "") + "</td><td>" + escapeHtml(row.newValue || "") + "</td><td>" +
              escapeHtml(row.actor || "") + "</td><td>" + escapeHtml(row.at || "") + "</td><td>" +
              escapeHtml(row.summary || "") + "</td></tr>";
          }).join("") + "</tbody></table></div>";
      }).catch(function (err) {
        historyEl.innerHTML = '<p class="empty">' + escapeHtml(err.message || "无法加载历史") + "</p>";
      });
    }

    function load() {
      setStatus("加载规则…");
      return jsonFetch("/api/han/worker?view=rules").then(function (data) {
        if (dead) return;
        rows = data.rows || [];
        lastMeta = data;
        lastMeta.shops = data.shops || data.stores || [];
        runSelected = new Set();
        (data.shopRuns || []).forEach(function (row) {
          if (row.enabled) runSelected.add(row.store);
        });
        if (!data.runListSaved) {
          (lastMeta.shops || []).forEach(function (name) { runSelected.add(name); });
        }
        asofEl.textContent = data.version
          ? "配置版本 " + data.version + " · " + (data.syncStatus || "待同步")
          : "尚未保存过规则，显示默认档位" + (data.syncStatus && data.syncStatus !== "待同步" ? " · " + data.syncStatus : "");
        renderToolbar();
        renderTable();
        setStatus(rows.length ? "已加载 " + rows.length + " 个子账号" : "");
      });
    }

    load().catch(function (err) {
      if (!dead) setStatus(err.message || "无法加载充值规则", true);
    });
    return function unmount() {
      dead = true;
      root.innerHTML = "";
    };
  }

  window.HanCenter = {
    version: VERSION,
    mount: function (root, board) {
      if (board === "rules") return mountRules(root);
      return mountCenter(root);
    },
  };
})();
