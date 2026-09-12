/* xm-module-stores erp-pages */
(function () {
  var PAGES = [
    {
      id: "reviews",
      title: "评价管理",
      path: "/stores/reviews",
      api: "/api/stores/erp/reviews",
      lead: "对接星脉 ERP 京东商品。按一星评价从高到低看差评。",
      kpis: [
        { key: "total", label: "商品总数" },
        { key: "oneStar", label: "本页一星" },
        { key: "listed", label: "本页条数" }
      ]
    },
    {
      id: "violations",
      title: "违规管理",
      path: "/stores/violations",
      api: "/api/stores/erp/violations",
      lead: "对接星脉 ERP。系统下架和删除商品按同步时间倒序。",
      kpis: [
        { key: "total", label: "违规商品" },
        { key: "systemOff", label: "本页系统下架" },
        { key: "removed", label: "本页删除" }
      ]
    },
    {
      id: "shipping",
      title: "发货监控",
      path: "/stores/shipping",
      api: "/api/stores/erp/shipping",
      lead: "对接星脉 ERP 京东订单。默认看待发货和已发货。",
      kpis: [
        { key: "total", label: "监控订单" },
        { key: "waiting", label: "本页待发货" },
        { key: "shipped", label: "本页已发货" }
      ]
    },
    {
      id: "inventory",
      title: "京东库存监控",
      path: "/stores/inventory",
      api: "/api/stores/erp/inventory",
      lead: "对接星脉 ERP 京东商品库存。负数标异常，小于等于 20 标低库存。",
      kpis: [
        { key: "total", label: "商品总数" },
        { key: "abnormal", label: "本页库存异常" },
        { key: "low", label: "本页低库存" }
      ]
    }
  ];

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function blank(value) {
    return value === null || value === undefined || value === "";
  }

  function none(value) {
    return blank(value) ? "—" : escapeHtml(value);
  }

  function count(value) {
    if (blank(value)) {
      return "—";
    }
    var n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString("zh-CN") : escapeHtml(value);
  }

  function money(value) {
    if (blank(value)) {
      return "—";
    }
    var n = Number(value);
    if (!Number.isFinite(n)) {
      return escapeHtml(value);
    }
    return n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function ensureCss() {
    if (document.querySelector('link[href*="stores.css"]')) {
      return;
    }
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/stores.css";
    document.head.appendChild(link);
  }

  function fetchJson(url) {
    return fetch(url, { credentials: "same-origin", headers: { Accept: "application/json" } }).then(function (res) {
      return res
        .json()
        .catch(function () {
          return {};
        })
        .then(function (data) {
          if (!res.ok || data.ok === false) {
            throw new Error(data.error || data.message || "接口 " + res.status);
          }
          return data;
        });
    });
  }

  function pill(text, kind) {
    return '<span class="stores-pill' + (kind ? " " + kind : "") + '">' + escapeHtml(text || "—") + "</span>";
  }

  function statusKind(label) {
    if (label === "待发货" || label === "低库存" || label === "下架" || label === "系统下架") {
      return "keep";
    }
    if (label === "异常" || label === "库存异常" || label === "删除" || label === "已取消") {
      return "stop";
    }
    if (label === "已发货" || label === "已完成" || label === "在售" || label === "正常") {
      return "done";
    }
    return "";
  }

  function pageById(id) {
    return (
      PAGES.find(function (item) {
        return item.id === id;
      }) || PAGES[0]
    );
  }

  function pageFromLocation(fallbackId) {
    var path = (window.location.pathname || "").replace(/\/+$/, "") || "/";
    var byPath = PAGES.find(function (item) {
      return item.path === path;
    });
    if (byPath) {
      return byPath.id;
    }
    var hash = decodeURIComponent(String(window.location.hash || "").replace(/^#/, ""));
    var byHash = PAGES.find(function (item) {
      return item.id === hash || item.title === hash;
    });
    if (byHash) {
      return byHash.id;
    }
    return fallbackId || "reviews";
  }

  function productNameCell(row) {
    return (
      "<div>" +
      none(row.productName) +
      '</div><div class="stores-sub">' +
      none(row.productId) +
      (row.itemNum ? " · " + escapeHtml(row.itemNum) : "") +
      "</div>"
    );
  }

  function shopCell(row) {
    return "<div>" + none(row.shopName) + '</div><div class="stores-sub">' + none(row.shopId) + "</div>";
  }

  function renderRows(id, rows) {
    if (!rows.length) {
      return '<tr><td colspan="8" class="empty">暂无数据</td></tr>';
    }
    return rows
      .map(function (row) {
        if (id === "reviews") {
          return (
            "<tr><td>" +
            productNameCell(row) +
            "</td><td>" +
            shopCell(row) +
            "</td><td>" +
            count(row.oneStarNum) +
            "</td><td>" +
            count(row.salesVolume) +
            "</td><td>" +
            count(row.sevenDaysSalesVolume) +
            "</td><td>" +
            pill(row.statusLabel, statusKind(row.statusLabel)) +
            "</td><td>" +
            count(row.stockNum) +
            "</td><td>" +
            none(row.syncTime) +
            "</td></tr>"
          );
        }
        if (id === "violations") {
          return (
            "<tr><td>" +
            productNameCell(row) +
            "</td><td>" +
            shopCell(row) +
            "</td><td>" +
            pill(row.statusLabel, statusKind(row.statusLabel)) +
            "</td><td>" +
            count(row.stockNum) +
            "</td><td>" +
            none(row.offlineTime) +
            "</td><td>" +
            none(row.syncTime) +
            "</td></tr>"
          );
        }
        if (id === "shipping") {
          return (
            "<tr><td>" +
            none(row.orderId) +
            "</td><td>" +
            shopCell(row) +
            "</td><td>" +
            pill(row.statusLabel, statusKind(row.statusLabel)) +
            "</td><td>" +
            money(row.actualPrice) +
            "</td><td>" +
            none(row.payTime) +
            "</td><td>" +
            none(row.skuName) +
            "</td><td>" +
            count(row.skuCount) +
            "</td><td>" +
            none(row.buyerRemark) +
            "</td></tr>"
          );
        }
        return (
          "<tr><td>" +
          productNameCell(row) +
          "</td><td>" +
          shopCell(row) +
          "</td><td>" +
          count(row.stockNum) +
          "</td><td>" +
          pill(row.stockLabel, statusKind(row.stockLabel)) +
          "</td><td>" +
          money(row.jdPrice) +
          "</td><td>" +
          pill(row.statusLabel, statusKind(row.statusLabel)) +
          "</td><td>" +
          none(row.itemNum) +
          "</td><td>" +
          none(row.syncTime) +
          "</td></tr>"
        );
      })
      .join("");
  }

  function tableHead(id) {
    if (id === "reviews") {
      return "<tr><th>商品</th><th>店铺</th><th>一星</th><th>销量</th><th>7日销量</th><th>状态</th><th>库存</th><th>同步时间</th></tr>";
    }
    if (id === "violations") {
      return "<tr><th>商品</th><th>店铺</th><th>状态</th><th>库存</th><th>下架时间</th><th>同步时间</th></tr>";
    }
    if (id === "shipping") {
      return "<tr><th>订单号</th><th>店铺</th><th>状态</th><th>金额</th><th>付款时间</th><th>商品</th><th>件数</th><th>买家备注</th></tr>";
    }
    return "<tr><th>商品</th><th>店铺</th><th>库存</th><th>库存状态</th><th>京东价</th><th>状态</th><th>货号</th><th>同步时间</th></tr>";
  }

  function extraFilters(id, state) {
    if (id === "violations") {
      return (
        '<label>状态<select name="productStatus">' +
        '<option value=""' +
        (state.productStatus === "" ? " selected" : "") +
        ">系统下架 + 删除</option>" +
        '<option value="103"' +
        (state.productStatus === "103" ? " selected" : "") +
        ">系统下架</option>" +
        '<option value="0"' +
        (state.productStatus === "0" ? " selected" : "") +
        ">删除</option></select></label>"
      );
    }
    if (id === "shipping") {
      return (
        '<label>状态<select name="orderStatus">' +
        '<option value=""' +
        (state.orderStatus === "" ? " selected" : "") +
        ">待发货 + 已发货</option>" +
        '<option value="3"' +
        (state.orderStatus === "3" ? " selected" : "") +
        ">待发货</option>" +
        '<option value="6"' +
        (state.orderStatus === "6" ? " selected" : "") +
        ">已发货</option>" +
        '<option value="4"' +
        (state.orderStatus === "4" ? " selected" : "") +
        ">异常</option></select></label>"
      );
    }
    return "";
  }

  function mountStores(root, initialId) {
    ensureCss();
    var state = {
      pageId: pageFromLocation(initialId),
      pageNum: 1,
      pages: 1,
      shopId: "",
      q: "",
      orderStatus: "",
      productStatus: "",
      shops: []
    };
    var dead = false;

    root.innerHTML =
      '<main class="page stores-page">' +
      '<header class="page-head"><p class="kicker">店铺维护中心</p><h1 data-title></h1>' +
      '<p class="lead" data-lead></p></header>' +
      '<div class="stores-desk">' +
      '<nav class="stores-subnav" aria-label="店铺维护页面">' +
      PAGES.map(function (item) {
        return (
          '<button type="button" data-page="' +
          escapeHtml(item.id) +
          '">' +
          escapeHtml(item.title) +
          "</button>"
        );
      }).join("") +
      "</nav>" +
      '<section class="stores-main">' +
      '<div class="kpi-grid" data-kpi></div>' +
      '<form class="stores-toolbar" data-filter>' +
      '<label>店铺<select name="shopId"><option value="">全部店铺</option></select></label>' +
      '<label>搜索<input name="q" maxlength="64" placeholder="店名 / 关键词" /></label>' +
      '<span data-extra></span>' +
      '<button type="submit">查询</button>' +
      "</form>" +
      '<p class="status" data-status role="status"></p>' +
      '<section class="panel"><div class="stores-table-wrap"><table><thead data-head></thead>' +
      '<tbody data-body><tr><td colspan="8" class="empty">正在加载…</td></tr></tbody></table></div>' +
      '<div class="stores-pager"><p data-pager></p>' +
      '<p><button type="button" class="ghost" data-prev>上一页</button> ' +
      '<button type="button" class="ghost" data-next>下一页</button></p></div></section>' +
      "</section></div></main>";

    var titleEl = root.querySelector("[data-title]");
    var leadEl = root.querySelector("[data-lead]");
    var kpiEl = root.querySelector("[data-kpi]");
    var extraEl = root.querySelector("[data-extra]");
    var headEl = root.querySelector("[data-head]");
    var bodyEl = root.querySelector("[data-body]");
    var statusEl = root.querySelector("[data-status]");
    var pagerEl = root.querySelector("[data-pager]");
    var filterForm = root.querySelector("[data-filter]");
    var shopSelect = filterForm.shopId;

    function setStatus(message, isError) {
      statusEl.textContent = message || "";
      statusEl.className = "status" + (isError ? " error" : message ? " ok" : "");
    }

    function syncHash() {
      var page = pageById(state.pageId);
      var path = (window.location.pathname || "").replace(/\/+$/, "") || "/";
      if (path === "/stores" && window.location.hash !== "#" + page.title) {
        window.history.replaceState(window.history.state, "", "/stores#" + page.title);
      }
    }

    function renderChrome() {
      var page = pageById(state.pageId);
      titleEl.textContent = page.title;
      leadEl.textContent = page.lead;
      extraEl.innerHTML = extraFilters(page.id, state);
      headEl.innerHTML = tableHead(page.id);
      root.querySelectorAll("[data-page]").forEach(function (btn) {
        btn.classList.toggle("is-on", btn.getAttribute("data-page") === page.id);
      });
      filterForm.q.value = state.q;
      shopSelect.value = state.shopId;
    }

    function renderKpi(summary) {
      var page = pageById(state.pageId);
      var data = summary || {};
      kpiEl.innerHTML = page.kpis
        .map(function (item, index) {
          var warn = index === 1 ? " is-warn" : index === 2 ? " is-open" : "";
          return (
            '<article class="kpi-card' +
            warn +
            '"><div class="label">' +
            escapeHtml(item.label) +
            '</div><div class="value">' +
            count(data[item.key]) +
            "</div></article>"
          );
        })
        .join("");
    }

    function fillShops() {
      var current = state.shopId;
      shopSelect.innerHTML = '<option value="">全部店铺</option>';
      state.shops.forEach(function (shop) {
        shopSelect.insertAdjacentHTML(
          "beforeend",
          '<option value="' +
            escapeHtml(shop.id) +
            '">' +
            escapeHtml(shop.shopName || shop.id) +
            (shop.statusLabel ? " · " + escapeHtml(shop.statusLabel) : "") +
            "</option>"
        );
      });
      if (
        [...shopSelect.options].some(function (option) {
          return option.value === String(current);
        })
      ) {
        shopSelect.value = String(current);
      }
    }

    function load() {
      var page = pageById(state.pageId);
      var params = new URLSearchParams();
      params.set("pageNum", String(state.pageNum));
      params.set("pageSize", "20");
      if (state.shopId) {
        params.set("shopId", state.shopId);
      }
      if (state.q) {
        params.set("shopName", state.q);
      }
      if (page.id === "shipping" && state.orderStatus) {
        params.set("orderStatus", state.orderStatus);
      }
      if (page.id === "violations" && state.productStatus) {
        params.set("productStatus", state.productStatus);
      }
      setStatus("正在从 ERP 拉取…");
      bodyEl.innerHTML = '<tr><td colspan="8" class="empty">正在加载…</td></tr>';
      fetchJson(page.api + "?" + params.toString())
        .then(function (data) {
          if (dead) {
            return;
          }
          state.pages = Math.max(1, Number(data.totalPages || 1));
          state.pageNum = Math.max(1, Number(data.currentPage || state.pageNum));
          var rows = data.records || [];
          bodyEl.innerHTML = renderRows(page.id, rows);
          renderKpi(data.summary || { total: data.total, listed: rows.length });
          pagerEl.textContent =
            "第 " + state.pageNum + " / " + state.pages + " 页，共 " + count(data.total) + " 条 · " + (data.source || "xingmai-erp");
          setStatus(rows.length ? "" : "没有符合条件的记录");
        })
        .catch(function (err) {
          if (dead) {
            return;
          }
          renderKpi({});
          bodyEl.innerHTML = '<tr><td colspan="8" class="empty">无法加载</td></tr>';
          pagerEl.textContent = "";
          setStatus(err.message || "ERP 拉取失败", true);
        });
    }

    function showPage(id) {
      state.pageId = pageById(id).id;
      state.pageNum = 1;
      syncHash();
      renderChrome();
      load();
    }

    function onNavClick(event) {
      var btn = event.target.closest("[data-page]");
      if (!btn) {
        return;
      }
      showPage(btn.getAttribute("data-page"));
    }

    function onFilter(event) {
      event.preventDefault();
      state.shopId = String(filterForm.shopId.value || "").trim();
      state.q = String(filterForm.q.value || "").trim();
      if (filterForm.orderStatus) {
        state.orderStatus = String(filterForm.orderStatus.value || "");
      }
      if (filterForm.productStatus) {
        state.productStatus = String(filterForm.productStatus.value || "");
      }
      state.pageNum = 1;
      load();
    }

    function onPrev() {
      if (state.pageNum > 1) {
        state.pageNum -= 1;
        load();
      }
    }

    function onNext() {
      if (state.pageNum < state.pages) {
        state.pageNum += 1;
        load();
      }
    }

    function onHash() {
      var next = pageFromLocation(state.pageId);
      if (next !== state.pageId) {
        showPage(next);
      }
    }

    root.querySelector(".stores-subnav").addEventListener("click", onNavClick);
    filterForm.addEventListener("submit", onFilter);
    root.querySelector("[data-prev]").addEventListener("click", onPrev);
    root.querySelector("[data-next]").addEventListener("click", onNext);
    window.addEventListener("hashchange", onHash);

    renderChrome();
    renderKpi({});
    syncHash();
    fetchJson("/api/stores/erp/shops")
      .then(function (data) {
        if (dead) {
          return;
        }
        state.shops = data.records || [];
        fillShops();
      })
      .catch(function () {
        /* 店铺下拉失败不挡四个页面 */
      });
    load();

    return function unmount() {
      dead = true;
      window.removeEventListener("hashchange", onHash);
      root.innerHTML = "";
    };
  }

  window.XmModules = window.XmModules || {};
  window.XmModules["/stores"] = {
    mount: function (root) {
      return mountStores(root, "reviews");
    }
  };
  PAGES.forEach(function (page) {
    window.XmModules[page.path] = {
      mount: function (root) {
        return mountStores(root, page.id);
      }
    };
  });
})();
