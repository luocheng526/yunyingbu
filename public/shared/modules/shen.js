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
      ensureRechargeRulesNav();
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

      function shortStamp(value) {
        const text = String(value == null ? "" : value).trim();
        if (!text) {
          return "未记录";
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
          return Number(text.slice(5, 7)) + "." + Number(text.slice(8, 10));
        }
        const match = text.match(/(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
        if (match) {
          return Number(match[2]) + "." + Number(match[3]) + "-" + match[4] + ":" + match[5];
        }
        const parsed = new Date(text);
        if (Number.isNaN(parsed.getTime())) {
          return text;
        }
        const parts = new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Shanghai",
          month: "numeric",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23"
        }).formatToParts(parsed);
        const get = function (type) {
          return (parts.find(function (part) {
            return part.type === type;
          }) || {}).value;
        };
        return Number(get("month")) + "." + Number(get("day")) + "-" + get("hour") + ":" + get("minute");
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
                  escapeHtml(shortStamp(row.capturedAt || row.ingestedAt || row.date)) +
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
              (latest.capturedAt || latest.date ? " · " + shortStamp(latest.capturedAt || latest.date) : "") +
              "</span></td>" +
              subCells(latest) +
              "</tr>" +
              '<tr class="xm-paid-sub-history" data-sub-index="' +
              index +
              '" hidden><td colspan="11"><div class="xm-paid-nested"><p class="lead">该子账号各时间段明细</p><table><thead><tr>' +
              "<th>时间段</th><th>余额</th><th>账户备注</th><th>花费</th><th>投产比</th><th>单量</th>" +
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
            "<th>充值时间</th><th>子账号名称</th><th>充值金额</th><th>账户余额</th>" +
            "</tr></thead><tbody>" +
            rechargeRows
              .map(function (row) {
                return (
                  "<tr><td>" +
                  escapeHtml(shortStamp(row.chargedAt || row.date)) +
                  "</td><td>" +
                  recorded(row.subAccountName) +
                  "</td><td>" +
                  money(row.amount) +
                  "</td><td>" +
                  money(row.balance) +
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
  window.XmModules["/shen/recharge-rules"] = window.XmModules["/shen/recharge-rules/index.html"] = {
    mount: function (root) {
      if (!document.querySelector('link[href^="/shared/shen-paid.css"]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "/shared/shen-paid.css";
        document.head.appendChild(link);
      }
      ensureRechargeRulesNav();
      root.innerHTML =
        '<main class="page xm-paid xm-rules">' +
        '<header class="page-head"><div><h1>充值规则</h1>' +
        '<p class="lead" id="rules-lead">只配置自己名下店铺和子账号。本地工作机只需启动一次并保持运行，以后所有店铺启停和充值规则均由本页面控制。自动充值账号的计划ROI必须大于0，默认2。网站不保存京准通 Cookie，也不直接充值。</p></div>' +
        '<div class="xm-paid-meta"><span class="xm-paid-dot" aria-hidden="true"></span>' +
        '<span id="rules-asof">等待配置</span></div></header>' +
        '<section class="panel" id="rules-run-panel">' +
        '<div class="xm-paid-toolbar"><h2>工作机运行店铺</h2><div class="row" id="rules-run-actions"></div></div>' +
        '<p class="xm-rules-hint" id="rules-run-hint">本地工作机只需启动一次并保持运行，以后所有店铺启停和充值规则均由本页面控制。勾选=开启持续运行；取消=停止，本地完成当前转账及弹窗后不再开新一轮。全部取消时工作机在线待机。</p>' +
        '<div id="rules-run-shops" class="xm-rules-shops"></div></section>' +
        '<section class="panel">' +
        '<div class="xm-paid-toolbar"><h2>子账号规则</h2><div class="row" id="rules-toolbar"></div></div>' +
        '<div id="rules-table-wrap"><p class="empty">加载中…</p></div>' +
        "</section>" +
        '<section class="panel" id="rules-history-wrap" hidden>' +
        "<h2>修改历史</h2><div id=\"rules-history\"></div></section>" +
        '<p id="rules-status" class="status" role="status"></p></main>';

      const statusEl = root.querySelector("#rules-status");
      const asofEl = root.querySelector("#rules-asof");
      const toolbarEl = root.querySelector("#rules-toolbar");
      const tableWrap = root.querySelector("#rules-table-wrap");
      const historyWrap = root.querySelector("#rules-history-wrap");
      const historyEl = root.querySelector("#rules-history");
      let dead = false;
      let rows = [];
      let selected = new Set();
      let shop = "";
      let keyword = "";
      let enabledOnly = false;
      let lastMeta = { shops: [], shopRuns: [], machines: [], runListSaved: false };
      let runSelected = new Set();

      function authHeaders(extra) {
        const headers = extra ? Object.assign({}, extra) : {};
        if (location.hostname === "127.0.0.1" || location.hostname === "localhost") {
          headers["x-shen-user"] = headers["x-shen-user"] || encodeURIComponent("沈子晗");
          headers["x-shen-role"] = headers["x-shen-role"] || encodeURIComponent("超级管理员");
          headers["x-shen-scope"] = headers["x-shen-scope"] || encodeURIComponent("全平台数据");
        }
        return headers;
      }

      function visibleRows() {
        if (!keyword) {
          return rows;
        }
        return rows.filter(function (row) {
          return (String(row.subAccountName || "") + " " + String(row.subAccountId || "")).indexOf(keyword) >= 0;
        });
      }

      function setStatus(message, isError) {
        statusEl.textContent = message || "";
        statusEl.className = "status" + (isError ? " error" : message ? " ok" : "");
      }

      function money(value) {
        return String(value ?? "");
      }

      function yesNo(value) {
        return value ? "是" : "否";
      }

      function headers() {
        return [
          "选择",
          "店铺名称",
          "京准通主账户ID",
          "子账号名称",
          "子账号ID",
          "自动充值",
          "计划ROI",
          "第一档花费下限",
          "第一档花费上限",
          "第一档余额阈值",
          "第一档充值金额",
          "第二档花费下限",
          "第二档余额阈值",
          "第二档充值金额",
          "ROI上涨充值金额",
          "连续充值未增单次数",
          "暂停分钟数",
          "配置版本",
          "最后修改人",
          "最后修改时间",
          "本地机状态",
          "本地机最后同步时间"
        ];
      }

      function rowKey(row) {
        return row.store + "\t" + row.accountId + "\t" + row.subAccountId;
      }

      function numInput(row, field, step) {
        return (
          '<input class="xm-rules-num" data-key="' +
          escapeHtml(rowKey(row)) +
          '" data-field="' +
          field +
          '" type="number" min="0" step="' +
          (step || "1") +
          '" value="' +
          escapeHtml(money(row[field])) +
          '" />'
        );
      }

      function renderToolbar(data) {
        lastMeta = data || lastMeta;
        const shops = ["<option value=\"\">全部店铺</option>"].concat(
          (lastMeta.shops || []).map(function (name) {
            return (
              '<option value="' +
              escapeHtml(name) +
              '"' +
              (shop === name ? " selected" : "") +
              ">" +
              escapeHtml(name) +
              "</option>"
            );
          })
        );
        toolbarEl.innerHTML =
          '<label>店铺选择 <select id="rules-shop">' +
          shops.join("") +
          "</select></label>" +
          '<input id="rules-q" type="search" maxlength="64" placeholder="子账号名称/ID搜索" value="' +
          escapeHtml(keyword) +
          '" />' +
          '<label class="xm-rules-check"><input id="rules-enabled" type="checkbox"' +
          (enabledOnly ? " checked" : "") +
          " /> 只看已启用</label>" +
          '<input id="rules-batch-roi" type="number" min="0" step="0.01" placeholder="批量计划ROI" />' +
          '<button type="button" id="rules-apply-roi">批量设置计划ROI</button>' +
          '<button type="button" id="rules-on">批量启用</button>' +
          '<button type="button" id="rules-off">批量暂停</button>' +
          '<button type="button" class="xm-rules-save" id="rules-save">保存</button>' +
          '<button type="button" id="rules-history-btn">修改历史</button>';
        root.querySelector("#rules-shop").addEventListener("change", function (event) {
          shop = event.target.value;
          load();
        });
        root.querySelector("#rules-q").addEventListener("input", function (event) {
          keyword = event.target.value.trim();
          renderTable();
        });
        root.querySelector("#rules-enabled").addEventListener("change", function (event) {
          enabledOnly = event.target.checked;
          load();
        });
        root.querySelector("#rules-apply-roi").addEventListener("click", function () {
          batchRoi();
        });
        root.querySelector("#rules-on").addEventListener("click", function () {
          batchAuto(true);
        });
        root.querySelector("#rules-off").addEventListener("click", function () {
          batchAuto(false);
        });
        root.querySelector("#rules-save").addEventListener("click", function () {
          save("full", "保存充值规则");
        });
        root.querySelector("#rules-history-btn").addEventListener("click", function () {
          loadHistory();
        });
        renderRunShops(lastMeta);
      }

      function renderRunShops(data) {
        const box = root.querySelector("#rules-run-shops");
        const actions = root.querySelector("#rules-run-actions");
        const hint = root.querySelector("#rules-run-hint");
        if (!box || !actions) {
          return;
        }
        const shops = data.shops || [];
        const runByStore = {};
        (data.shopRuns || []).forEach(function (row) {
          runByStore[row.store] = row;
        });
        hint.textContent =
          "本地工作机只需启动一次并保持运行，以后所有店铺启停和充值规则均由本页面控制。勾选=开启，取消=停止。已开启会持续循环采集、回传并按规则充值；已停止不得再开新一轮；停止中表示本地正在完成已开始的安全收尾。全部取消时 runShops=[]，工作机在线待机。停止不强杀正在提交的转账。";
        const machines = data.machines || [];
        actions.innerHTML =
          (machines.length
            ? '<span class="xm-rules-machines">已绑定本地机：' +
              machines
                .map(function (item) {
                  return escapeHtml(item.machineId) + "（" + escapeHtml(item.status || "待同步") + "）";
                })
                .join("、") +
              "</span>"
            : "<span class=\"xm-rules-machines\">还没有本地机 ACK。第一台用 machineId=paid-worker-01，第二台换新的 machineId。</span>") +
          '<button type="button" class="xm-rules-save" id="rules-run-save">保存运行状态</button>';
        if (!shops.length) {
          box.innerHTML = '<p class="empty">暂无自己名下的店铺。</p>';
        } else {
          box.innerHTML = shops
            .map(function (name) {
              const status = (runByStore[name] && runByStore[name].status) || (runSelected.has(name) ? "已开启" : "已停止");
              const tone = status === "已开启" ? "on" : status === "停止中" ? "stopping" : "off";
              return (
                '<label class="xm-rules-shop"><input type="checkbox" data-run-shop="' +
                escapeHtml(name) +
                '"' +
                (runSelected.has(name) ? " checked" : "") +
                " /> <span>" +
                escapeHtml(name) +
                '</span><span class="xm-rules-run-status is-' +
                tone +
                '">' +
                escapeHtml(status) +
                "</span></label>"
              );
            })
            .join("");
        }
        box.querySelectorAll("[data-run-shop]").forEach(function (input) {
          input.addEventListener("change", function () {
            const name = input.getAttribute("data-run-shop");
            if (input.checked) {
              runSelected.add(name);
            } else {
              runSelected.delete(name);
            }
          });
        });
        const saveBtn = root.querySelector("#rules-run-save");
        if (saveBtn) {
          saveBtn.addEventListener("click", saveRunShops);
        }
      }

      async function saveRunShops() {
        const shops = lastMeta.shops || [];
        const runShops = shops.filter(function (name) {
          return runSelected.has(name);
        });
        setStatus("保存运行状态…");
        try {
          const res = await fetch("/api/shen/paid/recharge-config", {
            method: "PUT",
            credentials: "same-origin",
            headers: authHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({
              patch: "run",
              changeSummary: "保存运行状态",
              runShops: runShops
            })
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || "保存失败");
          }
          setStatus("已保存版本 " + data.version + "，已开启 " + (data.runShops || runShops).length + " 家店");
          runSelected = new Set();
          await load();
        } catch (err) {
          setStatus(err.message || "保存失败", true);
        }
      }

      function collectEdits() {
        root.querySelectorAll(".xm-rules-num").forEach(function (input) {
          const row = rows.find(function (item) {
            return rowKey(item) === input.getAttribute("data-key");
          });
          if (row) {
            row[input.getAttribute("data-field")] = input.value;
          }
        });
        root.querySelectorAll(".xm-rules-auto").forEach(function (input) {
          const row = rows.find(function (item) {
            return rowKey(item) === input.getAttribute("data-key");
          });
          if (row) {
            row.autoRecharge = input.checked;
          }
        });
      }

      function checkedRows() {
        collectEdits();
        return rows.filter(function (row) {
          return selected.has(rowKey(row));
        });
      }

      function batchRoi() {
        const value = root.querySelector("#rules-batch-roi").value;
        const picked = checkedRows();
        if (!picked.length) {
          setStatus("请先勾选要改计划ROI的子账号", true);
          return;
        }
        if (value === "") {
          setStatus("请填写批量计划ROI", true);
          return;
        }
        picked.forEach(function (row) {
          row.plannedRoi = value;
        });
        save("roi", "批量设置计划ROI", picked);
      }

      function batchAuto(on) {
        const picked = checkedRows();
        if (!picked.length) {
          setStatus("请先勾选要启用或暂停的子账号", true);
          return;
        }
        picked.forEach(function (row) {
          row.autoRecharge = on;
        });
        save("auto", on ? "批量启用自动充值" : "批量暂停自动充值", picked);
      }

      function payloadRows(list) {
        return list.map(function (row) {
          return {
            店铺名称: row.store,
            京准通主账户ID: String(row.accountId || ""),
            子账号ID: String(row.subAccountId || ""),
            子账号名称: row.subAccountName || "",
            自动充值: row.autoRecharge,
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

      function renderTable() {
        const list = visibleRows();
        if (!list.length) {
          tableWrap.innerHTML = rows.length
            ? '<p class="empty">没有匹配的子账号。</p>'
            : '<p class="empty">暂无自己名下的子账号。先在付费中心回传子账号，或确认店铺已分配给你。</p>';
          return;
        }
        const body = list
          .map(function (row) {
            const key = rowKey(row);
            return (
              "<tr><td><input type=\"checkbox\" data-check=\"" +
              escapeHtml(key) +
              "\"" +
              (selected.has(key) ? " checked" : "") +
              " /></td><td>" +
              escapeHtml(row.store) +
              "</td><td>" +
              escapeHtml(String(row.accountId || "")) +
              "</td><td>" +
              escapeHtml(row.subAccountName || "") +
              "</td><td>" +
              escapeHtml(String(row.subAccountId || "")) +
              '</td><td><label class="xm-rules-check"><input class="xm-rules-auto" data-key="' +
              escapeHtml(key) +
              '" type="checkbox"' +
              (row.autoRecharge ? " checked" : "") +
              " /> " +
              yesNo(row.autoRecharge) +
              "</label></td><td>" +
              numInput(row, "plannedRoi", "0.01") +
              "</td><td>" +
              numInput(row, "tier1MinSpend") +
              "</td><td>" +
              numInput(row, "tier1MaxSpend") +
              "</td><td>" +
              numInput(row, "tier1Balance") +
              "</td><td>" +
              numInput(row, "tier1Amount") +
              "</td><td>" +
              numInput(row, "tier2MinSpend") +
              "</td><td>" +
              numInput(row, "tier2Balance") +
              "</td><td>" +
              numInput(row, "tier2Amount") +
              "</td><td>" +
              numInput(row, "roiRiseAmount") +
              "</td><td>" +
              numInput(row, "noOrderTimes") +
              "</td><td>" +
              numInput(row, "pauseMinutes") +
              "</td><td>" +
              escapeHtml(String(row.version || 0)) +
              "</td><td>" +
              escapeHtml(row.updatedBy || "—") +
              "</td><td>" +
              escapeHtml(row.updatedAt || "—") +
              "</td><td>" +
              escapeHtml(row.syncStatus || "待同步") +
              "</td><td>" +
              escapeHtml(row.syncedAt || "—") +
              "</td></tr>"
            );
          })
          .join("");
        tableWrap.innerHTML =
          '<div class="xm-paid-table-wrap"><table><thead><tr>' +
          headers()
            .map(function (title) {
              return "<th>" + title + "</th>";
            })
            .join("") +
          "</tr></thead><tbody>" +
          body +
          "</tbody></table></div>";
        tableWrap.querySelectorAll("[data-check]").forEach(function (box) {
          box.addEventListener("change", function () {
            const key = box.getAttribute("data-check");
            if (box.checked) {
              selected.add(key);
            } else {
              selected.delete(key);
            }
          });
        });
      }

      async function load() {
        setStatus("加载规则…");
        try {
          const query =
            "/api/shen/paid/recharge-config/editor?store=" +
            encodeURIComponent(shop) +
            "&q=" +
            encodeURIComponent(keyword) +
            (enabledOnly ? "&enabled=1" : "");
          const res = await fetch(query, { credentials: "same-origin", headers: authHeaders() });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || "无法加载充值规则");
          }
          if (dead) {
            return;
          }
          rows = data.rows || [];
          lastMeta = data;
          runSelected = new Set();
          (data.shopRuns || []).forEach(function (row) {
            if (row.enabled) {
              runSelected.add(row.store);
            }
          });
          if (!data.runListSaved) {
            (data.shops || []).forEach(function (name) {
              runSelected.add(name);
            });
          }
          asofEl.textContent = data.version
            ? "配置版本 " + data.version + " · " + (data.syncStatus || "待同步")
            : "尚未保存过规则，显示默认档位";
          renderToolbar(data);
          renderTable();
          setStatus(rows.length ? "已加载 " + rows.length + " 个子账号" : "");
        } catch (err) {
          if (!dead) {
            setStatus(err.message || "无法加载充值规则", true);
          }
        }
      }

      async function save(patch, summary, list) {
        collectEdits();
        const target = list || rows;
        if (!target.length) {
          setStatus("没有可保存的规则", true);
          return;
        }
        setStatus("保存中…");
        try {
          const res = await fetch("/api/shen/paid/recharge-config", {
            method: "PUT",
            credentials: "same-origin",
            headers: authHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({ patch: patch, changeSummary: summary, rows: payloadRows(target) })
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || "保存失败");
          }
          setStatus("已保存版本 " + data.version);
          await load();
        } catch (err) {
          setStatus(err.message || "保存失败", true);
        }
      }

      async function loadHistory() {
        historyWrap.hidden = false;
        historyEl.innerHTML = "<p class=\"empty\">加载历史…</p>";
        try {
          const res = await fetch(
            "/api/shen/paid/recharge-config/history?store=" + encodeURIComponent(shop) + "&limit=100",
            { credentials: "same-origin", headers: authHeaders() }
          );
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || "无法加载历史");
          }
          const items = data.rows || [];
          if (!items.length) {
            historyEl.innerHTML = '<p class="empty">还没有修改记录。</p>';
            return;
          }
          historyEl.innerHTML =
            "<table><thead><tr><th>版本</th><th>店铺</th><th>子账号ID</th><th>字段</th><th>旧值</th><th>新值</th><th>修改人</th><th>时间</th><th>摘要</th></tr></thead><tbody>" +
            items
              .map(function (row) {
                return (
                  "<tr><td>" +
                  escapeHtml(String(row.version)) +
                  "</td><td>" +
                  escapeHtml(row.store) +
                  "</td><td>" +
                  escapeHtml(String(row.subAccountId || "")) +
                  "</td><td>" +
                  escapeHtml(row.field) +
                  "</td><td>" +
                  escapeHtml(row.oldValue) +
                  "</td><td>" +
                  escapeHtml(row.newValue) +
                  "</td><td>" +
                  escapeHtml(row.updatedBy) +
                  "</td><td>" +
                  escapeHtml(row.updatedAt) +
                  "</td><td>" +
                  escapeHtml(row.changeSummary || "") +
                  "</td></tr>"
                );
              })
              .join("") +
            "</tbody></table>";
        } catch (err) {
          historyEl.innerHTML = '<p class="empty">' + escapeHtml(err.message || "无法加载历史") + "</p>";
        }
      }

      load();
      return function unmount() {
        dead = true;
        root.innerHTML = "";
      };
    }
  };
  window.XmModules["/shen/training"] = waitPage("培训系统");
  window.XmModules["/shen/tasks"] = waitPage("任务管理");

  function ensureRechargeRulesNav() {
    const links = document.querySelectorAll("a[href='/shen/paid'], a[href=\"/shen/paid\"]");
    links.forEach(function (paid) {
      const parent = paid.parentElement;
      if (!parent || parent.querySelector("a[href='/shen/recharge-rules']") || parent.querySelector("a[href='/shen/recharge-rules/index.html']")) {
        return;
      }
      const next = paid.cloneNode(true);
      next.setAttribute("href", "/shen/recharge-rules/index.html");
      next.textContent = "充值规则";
      if (paid.nextSibling) {
        parent.insertBefore(next, paid.nextSibling);
      } else {
        parent.appendChild(next);
      }
    });
  }

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
