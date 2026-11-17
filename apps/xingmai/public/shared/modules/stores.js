/* xm-module-stores erp-pages */
(function () {
  var PAGES = [
    {
      id: "reviews",
      title: "评价管理",
      path: "/stores/reviews",
      api: "/api/stores/erp/reviews",
      lead: "对接星脉 ERP 京东商品。按销量取数后按一星评价从高到低排。",
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
      lead: "商品标签选京东物流。库存总数 = 可用总数 − 全国仓。后面列出每个仓的库存，例如肇庆仓 7个。",
      kpis: [
        { key: "jd", label: "商品" },
        { key: "usable", label: "库存总数" },
        { key: "low", label: "低库存" }
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
    var link = document.querySelector('link[data-stores-css]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/stores.css";
      link.setAttribute("data-stores-css", "1");
    }
    document.head.appendChild(link);
  }

  function ensureXmUi(done) {
    if (!document.querySelector('link[href*="xm-ui.css"]')) {
      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/shared/xm-ui.css";
      document.head.appendChild(link);
    }
    if (window.XmUI) {
      done();
      return;
    }
    var script = document.createElement("script");
    script.src = "/shared/xm-ui.js";
    script.onload = function () {
      done();
    };
    script.onerror = function () {
      done();
    };
    document.head.appendChild(script);
  }

  function uiButton(label, extra, variant) {
    var attrs = String(extra || "");
    var className = "";
    var classMatch = attrs.match(/class="([^"]*)"/);
    if (classMatch) {
      className = classMatch[1];
      attrs = attrs.replace(classMatch[0], "").trim();
    }
    var html = window.XmUI.button({
      label: label,
      size: "small",
      variant: variant || "",
      type: attrs.indexOf('type="submit"') >= 0 ? "submit" : "button"
    });
    if (className) {
      html = html.replace('class="', 'class="' + className + " ");
    }
    if (attrs) {
      html = html.replace("<button ", "<button " + attrs + " ");
    }
    return html;
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

  function statusTone(label) {
    if (label === "待发货" || label === "低库存" || label === "下架" || label === "系统下架") {
      return "warning";
    }
    if (label === "异常" || label === "库存异常" || label === "删除" || label === "已取消") {
      return "danger";
    }
    if (label === "已发货" || label === "已完成" || label === "在售" || label === "正常") {
      return "success";
    }
    return "neutral";
  }

  function statusCell(label) {
    return window.XmUI.StatusBadge({ label: label || "—", tone: statusTone(label) });
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

  function textColumn(key, label, format) {
    return {
      key: key,
      label: label,
      render: function (value) {
        return format ? format(value) : none(value);
      }
    };
  }

  function tableColumns(id) {
    var product = { key: "productName", label: "商品", render: function (_value, row) { return productNameCell(row); } };
    var shop = { key: "shopName", label: "店铺", render: function (_value, row) { return shopCell(row); } };
    var status = { key: "statusLabel", label: "状态", render: function (value) { return statusCell(value); } };
    if (id === "reviews") {
      return [product, shop, textColumn("oneStarNum", "一星", count), textColumn("salesVolume", "销量", count), textColumn("sevenDaysSalesVolume", "7日销量", count), status, textColumn("stockNum", "库存", count), textColumn("syncTime", "同步时间")];
    }
    if (id === "violations") {
      return [product, shop, status, textColumn("stockNum", "库存", count), textColumn("offlineTime", "下架时间"), textColumn("syncTime", "同步时间")];
    }
    if (id === "shipping") {
      return [textColumn("orderId", "订单号"), shop, status, textColumn("actualPrice", "金额", money), textColumn("payTime", "付款时间"), textColumn("skuName", "商品"), textColumn("skuCount", "件数", count), textColumn("buyerRemark", "买家备注")];
    }
    return [product, shop, textColumn("usableNum", "库存总数", count), textColumn("warehouseText", "各仓"), status];
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

  function extraFilters(id, state) {
    if (id === "violations") {
      return (
        '<label class="xm-ui-field">状态<select class="xm-ui-select" name="productStatus">' +
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
        '<label class="xm-ui-field">状态<select class="xm-ui-select" name="orderStatus">' +
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
    var dead = false;
    var stop = function () {};
    ensureCss();
    ensureXmUi(function () {
      if (dead || !window.XmUI) {
        return;
      }
      ensureCss();
      stop = startStores(root, initialId);
    });
    return function unmount() {
      dead = true;
      stop();
    };
  }

  function startStores(root, initialId) {
    var state = {
      pageId: pageFromLocation(initialId),
      pageNum: 1,
      pages: 1,
      dutyId: "",
      shopId: "",
      q: "",
      shopQ: "",
      orderStatus: "",
      productStatus: "",
      shops: [],
      groups: []
    };
    var dead = false;

    root.innerHTML =
      '<div class="xm-ui-scope">' +
      '<div data-header></div>' +
      '<div class="xm-ui-stat-grid" data-kpi></div>' +
      '<div class="xm-ui-layout-grid">' +
      '<div class="xm-ui-stack">' +
      '<form class="xm-ui-filter-toolbar" data-filter>' +
      '<div class="xm-ui-tabs" data-tabs role="tablist"></div>' +
      '<div class="xm-ui-filter-toolbar__controls">' +
      '<label class="xm-ui-field">责权选择<select class="xm-ui-select" name="dutyId"><option value="">全部责权</option></select></label>' +
      '<label class="xm-ui-field">店铺<select class="xm-ui-select" name="shopId"><option value="">全部店铺</option></select></label>' +
      '<label class="xm-ui-search">' +
      window.XmUI.icon("search") +
      '<span class="xm-ui-sr-only">搜索</span><input name="q" type="search" maxlength="64" placeholder="店名 / 关键词" /></label>' +
      '<span data-extra></span>' +
      uiButton("查询", 'type="submit"') +
      "</div></form>" +
      '<section class="xm-ui-card stores-board"><div class="xm-ui-card__body">' +
      '<p data-status role="status"></p>' +
      '<div data-table></div>' +
      '<div class="stores-pager"><p data-pager></p><p>' +
      uiButton("上一页", "data-prev", "secondary") +
      uiButton("下一页", "data-next", "secondary") +
      "</p></div></div></section></div>" +
      '<aside class="xm-ui-card stores-aside" aria-label="明细店铺"><div class="xm-ui-card__body xm-ui-stack">' +
      window.XmUI.SectionTitle({ title: "明细店铺", description: "店铺责权和明细" }) +
      '<p class="xm-ui-page-description" data-shop-total></p>' +
      '<label class="xm-ui-search">' +
      window.XmUI.icon("search") +
      '<span class="xm-ui-sr-only">筛选店名</span><input data-shop-q maxlength="32" placeholder="筛选店名" /></label>' +
      uiButton("全部店铺", 'data-all="1" data-duty="" data-shop=""', "secondary") +
      '<p class="xm-ui-eyebrow">按责权分组</p>' +
      '<div class="stores-duty-list" data-duties></div>' +
      "</div></aside></div></div>";

    var headerEl = root.querySelector("[data-header]");
    var tabsEl = root.querySelector("[data-tabs]");
    var kpiEl = root.querySelector("[data-kpi]");
    var extraEl = root.querySelector("[data-extra]");
    var tableEl = root.querySelector("[data-table]");
    var statusEl = root.querySelector("[data-status]");
    var pagerEl = root.querySelector("[data-pager]");
    var filterForm = root.querySelector("[data-filter]");
    var dutySelect = filterForm.dutyId;
    var shopSelect = filterForm.shopId;
    var dutyListEl = root.querySelector("[data-duties]");
    var shopTotalEl = root.querySelector("[data-shop-total]");
    var shopQEl = root.querySelector("[data-shop-q]");

    function setStatus(message, isError) {
      statusEl.textContent = message || "";
      statusEl.className = isError ? "xm-ui-status xm-ui-status--danger" : "xm-ui-page-description";
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
      headerEl.innerHTML = window.XmUI.PageContentHeader({
        eyebrow: "店铺维护中心",
        title: page.title,
        description: page.lead
      });
      tabsEl.innerHTML = PAGES.map(function (item) {
        var on = item.id === page.id;
        return (
          '<button type="button" class="xm-ui-tab' +
          (on ? " is-active" : "") +
          '" data-page="' +
          escapeHtml(item.id) +
          '"' +
          (on ? ' aria-current="page"' : "") +
          ">" +
          escapeHtml(item.title) +
          "</button>"
        );
      }).join("");
      extraEl.innerHTML = extraFilters(page.id, state);
      filterForm.q.value = state.q;
      dutySelect.value = state.dutyId;
      shopSelect.value = state.shopId;
      renderDuties();
    }

    function renderKpi(summary) {
      var page = pageById(state.pageId);
      var data = summary || {};
      var tones = ["blue", "orange", "purple"];
      var icons = ["chart", "file", "award"];
      kpiEl.innerHTML = page.kpis
        .map(function (item, index) {
          return window.XmUI.StatCard({
            label: item.label,
            value: count(data[item.key]),
            tone: tones[index] || "blue",
            icon: icons[index] || "chart"
          });
        })
        .join("");
    }

    function paintTable(pageId, rows, emptyTitle) {
      if (!rows || !rows.length) {
        tableEl.innerHTML = window.XmUI.EmptyState({ title: emptyTitle || "暂无数据" });
        return;
      }
      tableEl.innerHTML = window.XmUI.DataTable({ columns: tableColumns(pageId), rows: rows });
    }

    function shopsInDuty(dutyId) {
      if (!dutyId) {
        return state.shops.slice();
      }
      return state.shops.filter(function (shop) {
        return String(shop.operatorId || "unassigned") === String(dutyId);
      });
    }

    function fillDuties() {
      var current = state.dutyId;
      dutySelect.innerHTML = '<option value="">全部责权</option>';
      state.groups.forEach(function (group) {
        dutySelect.insertAdjacentHTML(
          "beforeend",
          '<option value="' +
            escapeHtml(group.id) +
            '">' +
            escapeHtml(group.name) +
            " · " +
            count(group.shopCount || (group.shops || []).length) +
            "</option>"
        );
      });
      if (
        [...dutySelect.options].some(function (option) {
          return option.value === String(current);
        })
      ) {
        dutySelect.value = String(current);
      }
    }

    function fillShops() {
      var current = state.shopId;
      var shops = shopsInDuty(state.dutyId);
      shopSelect.innerHTML = '<option value="">全部店铺</option>';
      shops.forEach(function (shop) {
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
      } else {
        state.shopId = "";
        shopSelect.value = "";
      }
    }

    function renderDuties() {
      var allBtn = root.querySelector("[data-all]");
      if (allBtn) {
        allBtn.classList.toggle("is-active", !state.dutyId && !state.shopId);
      }
      var q = String(state.shopQ || "").trim().toLowerCase();
      var groups = state.groups
        .map(function (group) {
          var shops = (group.shops || []).filter(function (shop) {
            if (!q) {
              return true;
            }
            return (
              String(shop.shopName || "").toLowerCase().indexOf(q) !== -1 ||
              String(shop.id || "").indexOf(q) !== -1
            );
          });
          return { id: group.id, name: group.name, shops: shops, shopCount: shops.length };
        })
        .filter(function (group) {
          return group.shopCount > 0;
        });
      shopTotalEl.textContent =
        (state.dutyId
          ? "当前责权 " + count(shopsInDuty(state.dutyId).length)
          : "全部 " + count(state.shops.length)) + " 家店";
      if (!groups.length) {
        dutyListEl.innerHTML = window.XmUI.EmptyState({ title: "没有匹配的店铺" });
        return;
      }
      dutyListEl.innerHTML = groups
        .map(function (group) {
          var onDuty = String(group.id) === String(state.dutyId);
          var open = onDuty || Boolean(q) || groups.length <= 6;
          return (
            '<section class="stores-duty' +
            (onDuty ? " is-on" : "") +
            (open ? " is-open" : "") +
            '">' +
            uiButton(
              group.name + " " + count(group.shopCount),
              'class="stores-duty-head" data-duty="' + escapeHtml(group.id) + '" data-shop=""',
              "secondary"
            ) +
            "<ul>" +
            group.shops
              .map(function (shop) {
                var onShop = String(shop.id) === String(state.shopId);
                return (
                  "<li>" +
                  uiButton(
                    shop.shopName || String(shop.id),
                    'class="stores-duty-shop' +
                      (onShop ? " is-on" : "") +
                      '" data-duty="' +
                      escapeHtml(group.id) +
                      '" data-shop="' +
                      escapeHtml(shop.id) +
                      '"',
                    "secondary"
                  ) +
                  "</li>"
                );
              })
              .join("") +
            "</ul></section>"
          );
        })
        .join("");
    }

    var loadSeq = 0;
    var scanTimer = 0;

    function stopScan() {
      clearTimeout(scanTimer);
      scanTimer = 0;
    }

    function scheduleScan() {
      stopScan();
      scanTimer = setTimeout(function () {
        if (!dead && state.pageId === "inventory") {
          load();
        }
      }, 2000);
    }

    function load() {
      var seq = ++loadSeq;
      stopScan();
      var page = pageById(state.pageId);
      var params = new URLSearchParams();
      params.set("pageNum", String(state.pageNum));
      params.set("pageSize", "20");
      if (state.shopId) {
        params.set("shopId", state.shopId);
      } else if (state.dutyId) {
        params.set("dutyId", state.dutyId);
      }
      if (state.q) {
        if (page.id === "inventory") {
          params.set("skuName", state.q);
        } else {
          params.set("shopName", state.q);
        }
      }
      if (page.id === "shipping" && state.orderStatus) {
        params.set("orderStatus", state.orderStatus);
      }
      if (page.id === "violations" && state.productStatus) {
        params.set("productStatus", state.productStatus);
      }
      setStatus("正在从 ERP 拉取…");
      paintTable(page.id, [], "正在加载…");
      fetchJson(page.api + "?" + params.toString())
        .then(function (data) {
          if (dead || seq !== loadSeq) {
            return;
          }
          state.pages = Math.max(1, Number(data.totalPages || 1));
          state.pageNum = Math.max(1, Number(data.currentPage || state.pageNum));
          var rows = data.records || [];
          paintTable(page.id, rows, "暂无数据");
          renderKpi(data.summary || { total: data.total, listed: rows.length });
          pagerEl.textContent =
            "第 " + state.pageNum + " / " + state.pages + " 页，共 " + count(data.total) + " 条 · " + (data.source || "xingmai-erp");
          if (page.id === "inventory" && data.scanning) {
            setStatus(
              "正在读取全部商品页，店铺 " +
                count(data.shopsDone) +
                " / " +
                count(data.shopsTotal) +
                "，商品页 " +
                count(data.pagesRead) +
                " / " +
                count(data.pagesTotal)
            );
            scheduleScan();
            return;
          }
          setStatus(rows.length ? "" : "没有符合条件的记录");
        })
        .catch(function (err) {
          if (dead || seq !== loadSeq) {
            return;
          }
          renderKpi({});
          paintTable(page.id, [], "无法加载");
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

    function applyScope(dutyId, shopId) {
      state.dutyId = String(dutyId || "").trim();
      state.shopId = String(shopId || "").trim();
      if (state.shopId) {
        var shop = state.shops.find(function (item) {
          return String(item.id) === state.shopId;
        });
        if (shop) {
          state.dutyId = String(shop.operatorId || "unassigned");
        }
      }
      fillShops();
      dutySelect.value = state.dutyId;
      shopSelect.value = state.shopId;
      renderDuties();
      state.pageNum = 1;
      load();
    }

    function onFilter(event) {
      event.preventDefault();
      state.q = String(filterForm.q.value || "").trim();
      if (filterForm.orderStatus) {
        state.orderStatus = String(filterForm.orderStatus.value || "");
      }
      if (filterForm.productStatus) {
        state.productStatus = String(filterForm.productStatus.value || "");
      }
      applyScope(filterForm.dutyId.value, filterForm.shopId.value);
    }

    function onAsideClick(event) {
      var btn = event.target.closest("[data-duty]");
      if (!btn) {
        return;
      }
      applyScope(btn.getAttribute("data-duty"), btn.getAttribute("data-shop"));
    }

    function onShopQ() {
      state.shopQ = String(shopQEl.value || "").trim();
      renderDuties();
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

    tabsEl.addEventListener("click", onNavClick);
    filterForm.addEventListener("submit", onFilter);
    dutySelect.addEventListener("change", function () {
      applyScope(dutySelect.value, "");
    });
    shopSelect.addEventListener("change", function () {
      applyScope(state.dutyId, shopSelect.value);
    });
    root.querySelector(".stores-aside").addEventListener("click", onAsideClick);
    shopQEl.addEventListener("input", onShopQ);
    root.querySelector("[data-prev]").addEventListener("click", onPrev);
    root.querySelector("[data-next]").addEventListener("click", onNext);
    window.addEventListener("hashchange", onHash);

    renderChrome();
    renderKpi({});
    syncHash();
    fetchJson("/api/stores/erp/duties")
      .then(function (data) {
        if (dead) {
          return;
        }
        state.shops = data.records || [];
        state.groups = data.groups || [];
        fillDuties();
        fillShops();
        renderDuties();
      })
      .catch(function () {
        /* 责权列表失败不挡四个页面 */
      });
    load();

    return function unmount() {
      dead = true;
      stopScan();
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
