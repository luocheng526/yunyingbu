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
      lead: "商品标签选京东物流，去掉全国仓。现货和占用都是 0 的空仓不展示。可用库存 = 现货 − 占用，小于等于 20 标低库存。",
      kpis: [
        { key: "jd", label: "京仓" },
        { key: "usable", label: "可用库存" },
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
          "<div>" +
          none(row.productName) +
          '</div><div class="stores-sub">SKU ' +
          none(row.skuId) +
          "</div></td><td>" +
          shopCell(row) +
          "</td><td>" +
          none(row.warehouseName) +
          '</td><td class="stores-sub">' +
          none(row.warehouseId) +
          "</td><td>" +
          count(row.usableNum) +
          "</td><td>" +
          count(row.spotNum) +
          "</td><td>" +
          count(row.bookingNum) +
          "</td><td>" +
          pill(row.stockLabel, statusKind(row.stockLabel)) +
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
    return "<tr><th>商品</th><th>店铺</th><th>仓库</th><th>仓库编号</th><th>京仓库存</th><th>现货</th><th>占用</th><th>状态</th></tr>";
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
      '<main class="page stores-page">' +
      '<p class="kicker">店铺维护中心</p>' +
      '<h1 class="stores-sr" data-title></h1>' +
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
      '<p class="lead" data-lead></p>' +
      '<section class="stores-main">' +
      '<div class="kpi-grid" data-kpi></div>' +
      '<form class="stores-toolbar" data-filter>' +
      '<label>责权选择<select name="dutyId"><option value="">全部责权</option></select></label>' +
      '<label>店铺<select name="shopId"><option value="">全部店铺</option></select></label>' +
      '<label>搜索<input name="q" maxlength="64" placeholder="店名 / 关键词" /></label>' +
      '<span data-extra></span>' +
      '<button type="submit">查询</button>' +
      "</form>" +
      '<p class="status" data-status role="status"></p>' +
      '<div class="stores-work">' +
      '<section class="panel stores-board"><div class="stores-table-wrap"><table><thead data-head></thead>' +
      '<tbody data-body><tr><td colspan="8" class="empty">正在加载…</td></tr></tbody></table></div>' +
      '<div class="stores-pager"><p data-pager></p>' +
      '<p><button type="button" class="ghost" data-prev>上一页</button> ' +
      '<button type="button" class="ghost" data-next>下一页</button></p></div></section>' +
      '<aside class="stores-aside" aria-label="明细店铺">' +
      "<h2>明细店铺</h2>" +
      '<p class="stores-aside-meta" data-shop-total></p>' +
      '<input class="stores-aside-q" data-shop-q maxlength="32" placeholder="筛选店名" />' +
      '<button type="button" class="stores-aside-all" data-duty="" data-shop="">全部店铺</button>' +
      '<p class="stores-aside-kicker">按责权分组</p>' +
      '<div class="stores-duty-list" data-duties></div>' +
      "</aside></div></section></main>";

    var titleEl = root.querySelector("[data-title]");
    var leadEl = root.querySelector("[data-lead]");
    var kpiEl = root.querySelector("[data-kpi]");
    var extraEl = root.querySelector("[data-extra]");
    var headEl = root.querySelector("[data-head]");
    var bodyEl = root.querySelector("[data-body]");
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
        var on = btn.getAttribute("data-page") === page.id;
        btn.classList.toggle("is-on", on);
        if (on) {
          btn.setAttribute("aria-current", "page");
        } else {
          btn.removeAttribute("aria-current");
        }
      });
      filterForm.q.value = state.q;
      dutySelect.value = state.dutyId;
      shopSelect.value = state.shopId;
      renderDuties();
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
      var allBtn = root.querySelector(".stores-aside-all");
      if (allBtn) {
        allBtn.classList.toggle("is-on", !state.dutyId && !state.shopId);
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
        dutyListEl.innerHTML = '<p class="empty">没有匹配的店铺</p>';
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
            '<button type="button" class="stores-duty-head" data-duty="' +
            escapeHtml(group.id) +
            '" data-shop=""><span>' +
            escapeHtml(group.name) +
            "</span><em>" +
            count(group.shopCount) +
            "</em></button><ul>" +
            group.shops
              .map(function (shop) {
                var onShop = String(shop.id) === String(state.shopId);
                return (
                  '<li><button type="button" class="stores-duty-shop' +
                  (onShop ? " is-on" : "") +
                  '" data-duty="' +
                  escapeHtml(group.id) +
                  '" data-shop="' +
                  escapeHtml(shop.id) +
                  '">' +
                  escapeHtml(shop.shopName || shop.id) +
                  "</button></li>"
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
      bodyEl.innerHTML = '<tr><td colspan="8" class="empty">正在加载…</td></tr>';
      fetchJson(page.api + "?" + params.toString())
        .then(function (data) {
          if (dead || seq !== loadSeq) {
            return;
          }
          state.pages = Math.max(1, Number(data.totalPages || 1));
          state.pageNum = Math.max(1, Number(data.currentPage || state.pageNum));
          var rows = data.records || [];
          bodyEl.innerHTML = renderRows(page.id, rows);
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

    root.querySelector(".stores-subnav").addEventListener("click", onNavClick);
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
