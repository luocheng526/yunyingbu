/* 韩梦凯付费中心 / 充值规则。数据走 /api/han/worker，看板和档位与沈子晗对齐。 */
(function () {
  var VERSION = "20260926-master";

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
    ".han-rules-sync{margin:0 0 10px;padding:8px 10px;border-radius:6px;font-size:13px;line-height:1.45;color:#ad6800;background:#fff7e6;border:1px solid #ffe58f}" +
    ".han-rules-sync.is-error{color:#a8071a;background:#fff1f0;border-color:#ffa39e}" +
    ".han-rules .han-rules-save{background:#1677ff;color:#fff;border-color:#1677ff}" +
    ".han-rules-hint{margin:0 0 10px;color:#8c8c8c;font-size:13px;line-height:1.5}" +
    ".han-rules-form{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:flex-end;margin:0 0 12px;padding:12px;border:1px dashed #e5e7eb;border-radius:8px;background:#fafafa}" +
    ".han-rules-form h3{flex:1 0 100%;margin:0;font-size:14px}" +
    ".han-rules-form label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:#8c8c8c}" +
    ".han-rules-form input,.han-rules-form select{min-width:160px}" +
    ".han-rules-run.is-on{color:#237804;background:#f6ffed}" +
    ".han-rules-run.is-stopping{color:#ad6800;background:#fff7e6}" +
    ".han-rules-run.is-off{color:#8c8c8c;background:#f5f5f5}" +
    ".han-rules-run{margin-left:0;padding:0 6px;border-radius:999px;font-size:12px;line-height:20px}" +
    ".han-rules table.han-shop-table,.han-rules table.han-rules-grid{width:100%;table-layout:fixed;border-collapse:collapse;font-size:12px}" +
    ".han-rules table.han-shop-table th,.han-rules table.han-shop-table td,.han-rules table.han-rules-grid th,.han-rules table.han-rules-grid td{padding:6px 4px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;vertical-align:middle}" +
    ".han-rules table.han-shop-table td:nth-child(2),.han-rules table.han-shop-table th:nth-child(2),.han-rules table.han-rules-grid td:nth-child(2),.han-rules table.han-rules-grid td:nth-child(4){text-align:left}" +
    ".han-rules table.han-rules-grid thead th{white-space:normal;line-height:1.2;font-size:11px}" +
    ".han-rules table.han-rules-grid input{width:100%;min-width:0;height:24px;padding:0 2px;text-align:center;border:1px solid #e5e7eb;border-radius:3px}" +
    ".han-rules tr.is-deleted td{color:#8c8c8c;text-decoration:line-through}" +
    ".han-rules tr.is-deleted td:last-child{text-decoration:none}" +
    ".han-rules .han-paid-table-wrap{max-height:none}" +
    "@media (max-width:1100px){.han-paid .kpi-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}" +
    "@media (max-width:700px){.han-paid .kpi-grid{grid-template-columns:1fr 1fr}}";

  function page(title, lead, body, extra) {
    return (
      '<main class="page han-paid' + (extra ? " " + extra : "") + '"><style>' + css + "</style>" +
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
      "网站是店铺、子账号和充值规则的唯一主档。本地工作机只需启动一次并保持运行，以后店铺启停、主档和规则都由本页控制。本地机回报 Cookie 状态和心跳。网站不保存、不接收、不返回京准通/京麦 Cookie 或密码，也不直接充值。",
      '<div class="han-paid-meta"><span class="han-paid-dot"></span><span id="han-rules-asof">等待配置</span></div></header>' +
      '<section class="panel"><div class="han-paid-toolbar"><h2>店铺主档 / 工作机运行店铺</h2><div class="row" id="han-rules-run-actions"></div></div>' +
      '<p class="han-rules-hint" id="han-rules-run-hint">勾选=开启持续运行；取消=停止，本地完成已开始的转账及弹窗后再停该店。全部取消时本地机在线待机。Cookie 状态只显示本地机回报，本页没有 Cookie 输入框。</p>' +
      '<div id="han-shop-form" class="han-rules-form" hidden></div>' +
      '<div id="han-rules-run-shops"></div></section>' +
      '<section class="panel"><div class="han-paid-toolbar"><h2>子账号规则</h2><div class="row" id="han-rules-toolbar"></div></div>' +
      '<div id="han-sub-form" class="han-rules-form" hidden></div>' +
      '<p id="han-rules-sync" class="han-rules-sync" hidden></p>' +
      '<div id="han-rules-table"><p class="empty">加载中…</p></div></section>' +
      '<section class="panel" id="han-rules-history-wrap" hidden><h2>修改历史</h2><div id="han-rules-history"></div></section>' +
      '<p id="han-rules-status" class="status"></p></main>',
      "han-rules"
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
    var showDeleted = false;
    var lastMeta = { shops: [], shopRuns: [], machines: [], runListSaved: false, newSubDefaults: { autoRecharge: false, plannedRoi: 2 } };
    var runSelected = new Set();

    function setStatus(message, isError) {
      statusEl.textContent = message || "";
      statusEl.className = "status" + (isError ? " error" : message ? " ok" : "");
    }

    function setSyncBanner(text, tone) {
      var banner = root.querySelector("#han-rules-sync");
      if (!banner) return;
      banner.hidden = !text;
      banner.textContent = text || "";
      banner.className = "han-rules-sync" + (tone ? " is-" + tone : "");
    }

    function rowKey(row) {
      return row.store + "\t" + row.accountId + "\t" + row.subAccountId;
    }

    function runKey(row) {
      return String(row.accountId || row.store || "");
    }

    function statusTone(status) {
      if (status === "已开启" || status === "运行中" || status === "正常" || status === "在线") return "on";
      if (status === "停止中" || status === "等待Cookie" || status === "过期" || status === "身份不符") return "stopping";
      return "off";
    }

    function headers() {
      return [
        ["选择", "选择"],
        ["店铺", "店铺名称"],
        ["主账户ID", "京准通主账户ID"],
        ["子账号", "子账号名称"],
        ["子账号ID", "子账号ID"],
        ["自动", "自动充值"],
        ["计划\nROI", "计划ROI"],
        ["一档\n花费≥", "第一档花费下限"],
        ["一档\n花费<", "第一档花费上限"],
        ["一档\n余额≤", "第一档余额阈值"],
        ["一档\n充值", "第一档充值金额"],
        ["二档\n花费≥", "第二档花费下限"],
        ["二档\n余额≤", "第二档余额阈值"],
        ["二档\n充值", "第二档充值金额"],
        ["ROI\n涨充值", "ROI上涨充值金额"],
        ["未增\n单次", "连续充值未增单次数"],
        ["暂停\n分", "暂停分钟数"],
        ["版本", "配置版本"],
        ["本地机", "本地机状态"],
        ["操作", "操作"]
      ];
    }

    function visibleRows() {
      return rows.filter(function (row) {
        if (shop && String(row.store || "") !== String(shop)) return false;
        if (enabledOnly && !row.autoRecharge) return false;
        if (!keyword) return true;
        return (String(row.subAccountName || "") + " " + String(row.subAccountId || "")).indexOf(keyword) >= 0;
      });
    }

    function numInput(row, field) {
      return '<input class="han-rules-num" data-key="' + escapeHtml(rowKey(row)) + '" data-field="' + field +
        '" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" value="' + escapeHtml(row[field]) + '" />';
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
          暂停分钟数: row.pauseMinutes
        };
      });
    }

    function renderRunShops() {
      var box = root.querySelector("#han-rules-run-shops");
      var actions = root.querySelector("#han-rules-run-actions");
      var hint = root.querySelector("#han-rules-run-hint");
      var shopRows = (lastMeta.shopRuns || []).filter(function (row) { return showDeleted || !row.deleted; });
      hint.textContent = "网站是店铺和子账号的唯一主档。勾选=开启持续运行；取消=停止，本地完成已开始的转账及弹窗后再停该店。已开启会持续循环采集、回传并按规则充值；已停止不得再开新一轮；停止中表示本地正在收尾。全部取消时本地机在线待机。Cookie 状态只显示本地机回报。";
      var machines = lastMeta.machines || [];
      actions.innerHTML = (machines.length
        ? '<span>已绑定本地机：' + machines.map(function (item) {
          return escapeHtml(item.machineId) + "（" + escapeHtml(item.status || "待同步") + "）";
        }).join("、") + "</span>"
        : "<span>还没有本地机 ACK。韩梦凯这台用 machineId=han-worker-01。</span>") +
        '<button type="button" class="han-rules-save" id="han-rules-run-save">保存运行状态</button>';
      if (!shopRows.length) {
        box.innerHTML = '<p class="empty">暂无自己名下的店铺。请先新增店铺。</p>';
      } else {
        box.innerHTML = '<div class="han-paid-table-wrap"><table class="han-shop-table"><thead><tr>' +
          ["勾选", "店铺", "主账户ID", "执行机", "运行状态", "京准通Cookie", "京麦Cookie", "执行状态", "最后心跳", "最后错误", "操作"].map(function (title) {
            return "<th>" + title + "</th>";
          }).join("") + "</tr></thead><tbody>" + shopRows.map(function (row) {
            var key = runKey(row);
            var runStatus = row.status || (runSelected.has(key) ? "已开启" : "已停止");
            return '<tr class="' + (row.deleted ? "is-deleted" : "") + '"><td><input type="checkbox" data-run-shop="' + escapeHtml(key) + '"' +
              (runSelected.has(key) && !row.deleted ? " checked" : "") + (row.deleted ? " disabled" : "") + " /></td><td>" +
              escapeHtml(row.store || "") + "</td><td>" + escapeHtml(String(row.accountId || "")) + "</td><td>" +
              escapeHtml(row.machineId || "任意机") + '</td><td><span class="han-rules-run is-' + statusTone(runStatus) + '">' + escapeHtml(runStatus) +
              '</span></td><td><span class="han-rules-run is-' + statusTone(row.jztCookieStatus || "待录") + '">' + escapeHtml(row.jztCookieStatus || "待录") +
              '</span></td><td><span class="han-rules-run is-' + statusTone(row.jmCookieStatus || "待录") + '">' + escapeHtml(row.jmCookieStatus || "待录") +
              '</span></td><td><span class="han-rules-run is-' + statusTone(row.runStatus || "已停止") + '">' + escapeHtml(row.runStatus || "已停止") +
              "</span></td><td>" + escapeHtml(row.heartbeatAt || "—") + (row.workerStatus ? "（" + escapeHtml(row.workerStatus) + "）" : "") +
              "</td><td>" + escapeHtml(row.lastError || "—") + "</td><td>" +
              (row.deleted
                ? '<button type="button" data-shop-restore="' + escapeHtml(key) + '">恢复</button>'
                : '<button type="button" data-shop-edit="' + escapeHtml(key) + '">编辑</button> <button type="button" data-shop-del="' + escapeHtml(key) + '">删除</button>') +
              "</td></tr>";
          }).join("") + "</tbody></table></div>";
      }
      box.querySelectorAll("[data-run-shop]").forEach(function (input) {
        input.addEventListener("change", function () {
          var key = input.getAttribute("data-run-shop");
          if (input.checked) runSelected.add(key);
          else runSelected.delete(key);
        });
      });
      box.querySelectorAll("[data-shop-edit]").forEach(function (btn) {
        btn.addEventListener("click", function () { toggleShopForm("update", btn.getAttribute("data-shop-edit")); });
      });
      box.querySelectorAll("[data-shop-del]").forEach(function (btn) {
        var row = findShop(btn.getAttribute("data-shop-del"));
        btn.addEventListener("click", function () {
          saveMaster("shop", "delete", { 京准通主账户ID: row && row.accountId, 店铺名称: row && row.store }, "删除店铺");
        });
      });
      box.querySelectorAll("[data-shop-restore]").forEach(function (btn) {
        var row = findShop(btn.getAttribute("data-shop-restore"));
        btn.addEventListener("click", function () {
          saveMaster("shop", "restore", { 京准通主账户ID: row && row.accountId, 店铺名称: row && row.store }, "恢复店铺");
        });
      });
      var saveBtn = root.querySelector("#han-rules-run-save");
      if (saveBtn) saveBtn.addEventListener("click", saveRunShops);
    }

    function findShop(key) {
      return (lastMeta.shopRuns || []).find(function (row) { return runKey(row) === String(key || ""); });
    }

    function toggleShopForm(action, key) {
      var box = root.querySelector("#han-shop-form");
      if (!box) return;
      if (!box.hidden && box.getAttribute("data-action") === action && box.getAttribute("data-id") === String(key || "")) {
        box.hidden = true;
        box.innerHTML = "";
        return;
      }
      var current = findShop(key) || {};
      box.hidden = false;
      box.setAttribute("data-action", action);
      box.setAttribute("data-id", key || "");
      box.innerHTML = "<h3>" + (action === "create" ? "新增店铺" : "编辑店铺") + "</h3>" +
        '<label>店铺名称 <input id="han-shop-name" maxlength="64" value="' + escapeHtml(current.store || "") + '" /></label>' +
        '<label>京准通主账户ID <input id="han-shop-account" maxlength="64" value="' + escapeHtml(current.accountId || "") + '"' + (action === "update" ? " readonly" : "") + " /></label>" +
        '<label>执行机 <input id="han-shop-machine" maxlength="64" placeholder="空=任意已绑定机" value="' + escapeHtml(current.machineId || "") + '" /></label>' +
        '<button type="button" class="han-rules-save" id="han-shop-form-save">保存店铺</button>' +
        '<p class="han-rules-hint">主账户ID创建后不可改。更换时请删除旧店再新建。本页不接收 Cookie 正文。</p>';
      root.querySelector("#han-shop-form-save").addEventListener("click", function () {
        saveMaster("shop", action, {
          店铺名称: root.querySelector("#han-shop-name").value,
          京准通主账户ID: root.querySelector("#han-shop-account").value,
          执行机: root.querySelector("#han-shop-machine").value
        }, action === "create" ? "新增店铺" : "编辑店铺");
      });
    }

    function toggleSubForm(action, row) {
      var box = root.querySelector("#han-sub-form");
      if (!box) return;
      var current = row || {};
      if (!box.hidden && action === "create" && !row) {
        box.hidden = true;
        box.innerHTML = "";
        return;
      }
      var shops = (lastMeta.shopRuns || []).filter(function (item) { return !item.deleted; });
      var defaults = lastMeta.newSubDefaults || { autoRecharge: false, plannedRoi: 2 };
      box.hidden = false;
      box.innerHTML = "<h3>" + (action === "create" ? "新增子账号" : "编辑子账号") + "</h3>" +
        '<label>店铺 <select id="han-sub-shop">' + shops.map(function (item) {
          var selected = String(item.accountId || "") === String(current.accountId || "") ? " selected" : "";
          return '<option value="' + escapeHtml(item.accountId || "") + '"' + selected + ">" + escapeHtml(item.store) + "（" + escapeHtml(item.accountId || "") + "）</option>";
        }).join("") + "</select></label>" +
        '<label>子账号ID <input id="han-sub-id" maxlength="64" value="' + escapeHtml(String(current.subAccountId || "")) + '"' + (action === "update" ? " readonly" : "") + " /></label>" +
        '<label>子账号名称 <input id="han-sub-name" maxlength="64" value="' + escapeHtml(current.subAccountName || "") + '" /></label>' +
        '<label><input id="han-sub-auto" type="checkbox"' + ((current.autoRecharge != null ? current.autoRecharge : defaults.autoRecharge) ? " checked" : "") + " /> 自动充值</label>" +
        '<label>计划ROI <input id="han-sub-roi" type="number" min="0" step="0.01" value="' + escapeHtml(String(current.plannedRoi != null ? current.plannedRoi : defaults.plannedRoi)) + '" /></label>' +
        '<button type="button" class="han-rules-save" id="han-sub-form-save">保存子账号</button>' +
        '<p class="han-rules-hint">新增子账号默认自动充值=否、计划ROI=2。完整档位仍在下方表格编辑。</p>';
      root.querySelector("#han-sub-form-save").addEventListener("click", function () {
        saveMaster("sub", action, {
          京准通主账户ID: root.querySelector("#han-sub-shop").value,
          子账号ID: root.querySelector("#han-sub-id").value,
          子账号名称: root.querySelector("#han-sub-name").value,
          自动充值: root.querySelector("#han-sub-auto").checked,
          计划ROI: root.querySelector("#han-sub-roi").value
        }, action === "create" ? "新增子账号" : "编辑子账号");
      });
    }

    function saveMaster(kind, op, payload, summary) {
      setStatus(summary + "…");
      jsonFetch("/api/han/worker", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.assign({ action: kind, op: op, changeSummary: summary }, payload))
      }).then(function (data) {
        var shopForm = root.querySelector("#han-shop-form");
        var subForm = root.querySelector("#han-sub-form");
        if (shopForm) { shopForm.hidden = true; shopForm.innerHTML = ""; }
        if (subForm) { subForm.hidden = true; subForm.innerHTML = ""; }
        return load().then(function () {
          setSyncBanner("配置版本 " + data.version + " 本地机尚未接收（待同步）。本机 GET 并 ACK 后才会变成已同步。");
          setStatus("已保存版本 " + data.version + "，本地机尚未接收（待同步）。");
        });
      }).catch(function (err) {
        if (!dead) setStatus(err.message || "保存失败", true);
      });
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
        '<button type="button" id="han-rules-add-shop">新增店铺</button>' +
        '<button type="button" id="han-rules-add-sub">新增子账号</button>' +
        '<label><input id="han-rules-deleted" type="checkbox"' + (showDeleted ? " checked" : "") + " /> 显示已删除</label>" +
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
      root.querySelector("#han-rules-add-shop").addEventListener("click", function () { toggleShopForm("create"); });
      root.querySelector("#han-rules-add-sub").addEventListener("click", function () { toggleSubForm("create"); });
      root.querySelector("#han-rules-deleted").addEventListener("change", function (event) {
        showDeleted = event.target.checked;
        load();
      });
      root.querySelector("#han-rules-history-btn").addEventListener("click", loadHistory);
      renderRunShops();
    }

    function renderTable() {
      var list = visibleRows();
      if (!list.length) {
        tableWrap.innerHTML = rows.length ? '<p class="empty">没有匹配的子账号。</p>' : '<p class="empty">暂无自己名下的子账号。请先新增店铺和子账号，或等本地机回传。</p>';
        return;
      }
      tableWrap.innerHTML = '<div class="han-paid-table-wrap"><table class="han-rules-grid"><thead><tr>' + headers().map(function (item) {
        return '<th title="' + escapeHtml(item[1]) + '">' + escapeHtml(item[0]).split("\n").join("<br>") + "</th>";
      }).join("") + "</tr></thead><tbody>" + list.map(function (row) {
        var key = rowKey(row);
        return '<tr class="' + (row.deleted ? "is-deleted" : "") + '"><td><input type="checkbox" data-check="' + escapeHtml(key) + '"' +
          (selected.has(key) ? " checked" : "") + " /></td><td>" + escapeHtml(row.store) + "</td><td>" + escapeHtml(String(row.accountId || "")) +
          "</td><td>" + escapeHtml(row.subAccountName || "") + "</td><td>" + escapeHtml(String(row.subAccountId || "")) +
          '</td><td><label title="' + (row.autoRecharge ? "是" : "否") + '"><input class="han-rules-auto" data-key="' + escapeHtml(key) +
          '" type="checkbox"' + (row.autoRecharge ? " checked" : "") + " /></label></td><td>" +
          numInput(row, "plannedRoi") + "</td><td>" + numInput(row, "tier1MinSpend") + "</td><td>" + numInput(row, "tier1MaxSpend") +
          "</td><td>" + numInput(row, "tier1Balance") + "</td><td>" + numInput(row, "tier1Amount") + "</td><td>" +
          numInput(row, "tier2MinSpend") + "</td><td>" + numInput(row, "tier2Balance") + "</td><td>" + numInput(row, "tier2Amount") +
          "</td><td>" + numInput(row, "roiRiseAmount") + "</td><td>" + numInput(row, "noOrderTimes") + "</td><td>" +
          numInput(row, "pauseMinutes") + "</td><td>" + escapeHtml(String(row.version || 0)) + "</td><td>" +
          escapeHtml(row.syncStatus || "待同步") + "</td><td>" +
          (row.deleted
            ? '<button type="button" data-sub-restore="' + escapeHtml(key) + '">恢复</button>'
            : '<button type="button" data-sub-edit="' + escapeHtml(key) + '">编辑</button> <button type="button" data-sub-del="' + escapeHtml(key) + '">删除</button>') +
          "</td></tr>";
      }).join("") + "</tbody></table></div>";
      tableWrap.querySelectorAll("[data-check]").forEach(function (box) {
        box.addEventListener("change", function () {
          var key = box.getAttribute("data-check");
          if (box.checked) selected.add(key);
          else selected.delete(key);
        });
      });
      tableWrap.querySelectorAll("[data-sub-edit]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var row = rows.find(function (item) { return rowKey(item) === btn.getAttribute("data-sub-edit"); });
          if (row) toggleSubForm("update", row);
        });
      });
      tableWrap.querySelectorAll("[data-sub-del]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var row = rows.find(function (item) { return rowKey(item) === btn.getAttribute("data-sub-del"); });
          if (row) saveMaster("sub", "delete", { 京准通主账户ID: row.accountId, 子账号ID: row.subAccountId }, "删除子账号");
        });
      });
      tableWrap.querySelectorAll("[data-sub-restore]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var row = rows.find(function (item) { return rowKey(item) === btn.getAttribute("data-sub-restore"); });
          if (row) saveMaster("sub", "restore", { 京准通主账户ID: row.accountId, 子账号ID: row.subAccountId }, "恢复子账号");
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
        body: JSON.stringify({ action: "rules", changeSummary: summary, rows: payloadRows(target) })
      }).then(function (data) {
        setSyncBanner("配置版本 " + data.version + " 本地机尚未接收（待同步）。本机 GET 并 ACK 后才会变成已同步。");
        return load().then(function () { setStatus("已保存版本 " + data.version + "，本地机尚未接收（待同步）。"); });
      }).catch(function (err) {
        if (!dead) setStatus(err.message || "保存失败", true);
      });
    }

    function batchRoi() {
      var value = root.querySelector("#han-rules-batch-roi").value;
      var picked = checkedRows();
      if (!picked.length) { setStatus("请先勾选要改计划ROI的子账号", true); return; }
      if (value === "") { setStatus("请填写批量计划ROI", true); return; }
      picked.forEach(function (row) { row.plannedRoi = value; });
      saveRules(picked, "批量设置计划ROI");
    }

    function batchAuto(on) {
      var picked = checkedRows();
      if (!picked.length) { setStatus("请先勾选要启用或暂停的子账号", true); return; }
      picked.forEach(function (row) { row.autoRecharge = on; });
      saveRules(picked, on ? "批量启用自动充值" : "批量暂停自动充值");
    }

    function saveRunShops() {
      var runShops = (lastMeta.shopRuns || []).filter(function (row) {
        return !row.deleted && runSelected.has(runKey(row));
      }).map(function (row) { return row.store; });
      setStatus("保存运行状态…");
      jsonFetch("/api/han/worker", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run", changeSummary: "保存运行状态", runShops: runShops })
      }).then(function (data) {
        setSyncBanner("配置版本 " + data.version + " 本地机尚未接收（待同步）。已开启 " + runShops.length + " 家店。本机 GET 并 ACK 后才会变成已同步。");
        return load().then(function () {
          setStatus("已保存版本 " + data.version + "，已开启 " + runShops.length + " 家店，本地机尚未接收（待同步）。");
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
      return jsonFetch("/api/han/worker?view=rules" + (showDeleted ? "&deleted=1" : "")).then(function (data) {
        if (dead) return;
        rows = data.rows || [];
        lastMeta = data;
        lastMeta.shops = data.shops || data.stores || [];
        runSelected = new Set();
        (data.shopRuns || []).forEach(function (row) {
          if (row.enabled && !row.deleted) runSelected.add(runKey(row));
        });
        if (!data.runListSaved) {
          (data.shopRuns || []).forEach(function (row) {
            if (!row.deleted) runSelected.add(runKey(row));
          });
        }
        asofEl.textContent = data.version
          ? "配置版本 " + data.version + " · " + (data.syncStatus || "待同步")
          : "尚未保存过规则，显示默认档位" + (data.syncStatus && data.syncStatus !== "待同步" ? " · " + data.syncStatus : "");
        if (data.version && data.syncStatus && data.syncStatus !== "已同步") {
          setSyncBanner("配置版本 " + data.version + " 本地机尚未接收（" + data.syncStatus + "）。本机 GET 并 ACK 后才会变成已同步。", data.syncStatus === "同步失败" ? "error" : "");
        } else if (!root.querySelector("#han-rules-sync").textContent) {
          setSyncBanner("");
        }
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
