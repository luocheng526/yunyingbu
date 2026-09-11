/* xm-module-data 0.1.67 */
(function () {
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

  function money(value) {
    if (blank(value)) {
      return "—";
    }
    const n = Number(value);
    if (!Number.isFinite(n)) {
      return escapeHtml(value);
    }
    return n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function count(value) {
    if (blank(value)) {
      return "—";
    }
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString("zh-CN") : escapeHtml(value);
  }

  function pct(value) {
    if (blank(value)) {
      return "—";
    }
    const n = Number(value);
    if (!Number.isFinite(n)) {
      return escapeHtml(value);
    }
    return (n * 100).toFixed(2) + "%";
  }

  function fetchJson(url) {
    return fetch(url, { credentials: "same-origin", headers: { Accept: "application/json" } }).then(
      function (res) {
        return res.json().then(function (data) {
          if (!res.ok || data.ok === false) {
            throw new Error(data.error || data.message || "接口 " + res.status);
          }
          return data;
        });
      }
    );
  }

  function bindPager(root, state, load) {
    root.querySelector("[data-prev]").addEventListener("click", function () {
      if (state.page > 1) {
        state.page -= 1;
        load();
      }
    });
    root.querySelector("[data-next]").addEventListener("click", function () {
      if (state.page < state.pages) {
        state.page += 1;
        load();
      }
    });
  }

  function renderPager(root, data) {
    const page = Number(data.currentPage || 1);
    const pages = Math.max(1, Number(data.totalPages || 1));
    const total = Number(data.total || 0);
    root.querySelector("[data-pager]").textContent =
      "第 " + page + " / " + pages + " 页，共 " + total + " 条";
  }

  function trendSvg(points) {
    const rows = (points || []).filter(function (item) {
      return item && item.date && !blank(item.payAmount);
    });
    if (rows.length < 2) {
      return '<p class="lead">这段时间还没有可画的销售趋势。</p>';
    }
    const values = rows.map(function (item) {
      return Number(item.payAmount) || 0;
    });
    const min = Math.min.apply(null, values);
    const max = Math.max.apply(null, values);
    const span = max - min || 1;
    const coords = values
      .map(function (value, index) {
        const x = (index / (values.length - 1)) * 320;
        const y = 110 - ((value - min) / span) * 90;
        return x.toFixed(1) + "," + y.toFixed(1);
      })
      .join(" ");
    return (
      '<svg class="trend-svg" viewBox="0 0 320 120" role="img" aria-label="应收趋势">' +
      '<polyline fill="none" stroke="currentColor" stroke-width="2" points="' +
      coords +
      '" /></svg>'
    );
  }

  window.XmModules = window.XmModules || {};

  function waitPage(title) {
    return {
      mount: function (root) {
        root.innerHTML =
          '<main class="page">' +
          '<header class="page-head"><p class="kicker">数据中心</p><h1>' +
          escapeHtml(title) +
          "</h1>" +
          '<p class="lead">内容待开发。</p></header></main>';
        return function unmount() {
          root.innerHTML = "";
        };
      }
    };
  }

  window.XmModules["/data/paid"] = waitPage("实时付费");

  function mountOverview(root) {
    root.innerHTML =
      '<main class="page">' +
      '<header class="page-head"><p class="kicker">数据中心</p><h1>数据总揽</h1>' +
      '<p class="lead">来自星脉 ERP 销售趋势和店铺/商品总览。实时付费另接接口，这里不填。</p></header>' +
      '<p class="status error" data-err hidden></p>' +
      '<section class="kpi-grid" data-cards></section>' +
      '<div class="dash-bottom">' +
      '<section class="panel"><h2>销售趋势</h2><div data-trend><p class="lead">正在加载…</p></div></section>' +
      '<section class="panel sales-index"><h2>热销商品</h2><ol class="board-list" data-goods></ol></section>' +
      "</div>" +
      '<section class="panel"><h2>店铺排行</h2><div style="overflow:auto"><table><thead><tr><th>店铺</th><th>应收</th><th>订单</th><th>利润</th></tr></thead>' +
      '<tbody data-shops><tr><td colspan="4" class="empty">正在加载…</td></tr></tbody></table></div></section>' +
      "</main>";
    const err = root.querySelector("[data-err]");
    let dead = false;
    fetchJson("/api/data/overview")
      .then(function (data) {
        if (dead) {
          return;
        }
        const cards = data.cards || [];
        root.querySelector("[data-cards]").innerHTML = cards.length
          ? cards
              .map(function (card) {
                return (
                  '<article class="kpi-card"><div class="label">' +
                  escapeHtml(card.label) +
                  '</div><div class="value">' +
                  (card.unit === "元" ? money(card.value) : count(card.value)) +
                  (card.unit ? '<span class="unit">' + escapeHtml(card.unit) + "</span>" : "") +
                  "</div></article>"
                );
              })
              .join("")
          : '<p class="lead">看板数字还对不上，先空着。</p>';
        root.querySelector("[data-trend]").innerHTML = trendSvg(data.trend);
        const goods = data.goods || [];
        root.querySelector("[data-goods]").innerHTML = goods.length
          ? goods
              .map(function (row, index) {
                return (
                  "<li><span class=\"rank\">" +
                  (index + 1) +
                  "</span><span class=\"name\">" +
                  escapeHtml(row.productName || "—") +
                  "</span><span>" +
                  money(row.payAmount) +
                  "</span></li>"
                );
              })
              .join("")
          : '<li class="lead">没有热销商品。</li>';
        const shops = data.shops || [];
        root.querySelector("[data-shops]").innerHTML = shops.length
          ? shops
              .map(function (row) {
                return (
                  "<tr><td>" +
                  escapeHtml(row.shopName || row.shopId || "—") +
                  "</td><td>" +
                  money(row.payAmount) +
                  "</td><td>" +
                  count(row.orderCount) +
                  "</td><td>" +
                  money(row.profit) +
                  "</td></tr>"
                );
              })
              .join("")
          : '<tr><td colspan="4" class="empty">没有店铺排行</td></tr>';
      })
      .catch(function (error) {
        if (dead) {
          return;
        }
        err.hidden = false;
        err.textContent = error.message;
      });
    return function unmount() {
      dead = true;
      root.innerHTML = "";
    };
  }

  window.XmModules["/data/overview"] = { mount: mountOverview };
  window.XmModules["/data"] = { mount: mountOverview };

  window.XmModules["/data/shops"] = {
    mount: function (root) {
      const state = { page: 1, pages: 1, q: "" };
      root.innerHTML =
        '<main class="page">' +
        '<header class="page-head"><p class="kicker">数据中心</p><h1>店铺数据</h1>' +
        '<p class="lead">来自星脉 ERP 渠道总览店铺。店名用店铺管理补上，没有的字段先空着。</p></header>' +
        '<section class="panel"><form id="shop-filter" style="display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-bottom:12px">' +
        '<label>店名<input name="shopName" maxlength="64" /></label>' +
        '<button type="submit">查询</button></form>' +
        '<p class="status error" data-err hidden></p>' +
        '<div style="overflow:auto"><table><thead><tr><th>店铺</th><th>状态</th><th>应收</th><th>今日</th><th>昨日</th><th>订单</th><th>利润</th><th>退款率</th></tr></thead>' +
        '<tbody data-body><tr><td colspan="8" class="empty">正在加载…</td></tr></tbody></table></div>' +
        '<p class="lead" data-pager></p>' +
        '<p><button type="button" data-prev>上一页</button> <button type="button" data-next>下一页</button></p>' +
        "</section></main>";
      const body = root.querySelector("[data-body]");
      const err = root.querySelector("[data-err]");
      let dead = false;

      function load() {
        err.hidden = true;
        const q = encodeURIComponent(state.q);
        fetchJson("/api/data/shops?pageNum=" + state.page + "&pageSize=20&shopName=" + q)
          .then(function (data) {
            if (dead) {
              return;
            }
            state.pages = Math.max(1, Number(data.totalPages || 1));
            const rows = data.records || [];
            body.innerHTML = rows.length
              ? rows
                  .map(function (row) {
                    return (
                      "<tr><td>" +
                      escapeHtml(row.shopName || "—") +
                      '<div class="lead">' +
                      escapeHtml(row.shopId || "") +
                      "</div></td><td>" +
                      escapeHtml(row.statusLabel || "—") +
                      "</td><td>" +
                      money(row.payAmount) +
                      "</td><td>" +
                      money(row.todayPayAmount) +
                      "</td><td>" +
                      money(row.yesterdayPayAmount) +
                      "</td><td>" +
                      count(row.orderCount) +
                      "</td><td>" +
                      money(row.profit) +
                      "</td><td>" +
                      pct(row.refundRate) +
                      "</td></tr>"
                    );
                  })
                  .join("")
              : '<tr><td colspan="8" class="empty">没有店铺</td></tr>';
            renderPager(root, data);
          })
          .catch(function (error) {
            if (dead) {
              return;
            }
            body.innerHTML = '<tr><td colspan="8" class="empty">无法加载</td></tr>';
            err.hidden = false;
            err.textContent = error.message;
          });
      }

      root.querySelector("#shop-filter").addEventListener("submit", function (event) {
        event.preventDefault();
        state.q = String(new FormData(event.target).get("shopName") || "").trim();
        state.page = 1;
        load();
      });
      bindPager(root, state, load);
      load();
      return function unmount() {
        dead = true;
        root.innerHTML = "";
      };
    }
  };

  window.XmModules["/data/goods"] = {
    mount: function (root) {
      const state = { page: 1, pages: 1, shopId: "", from: "", to: "" };
      root.innerHTML =
        '<main class="page">' +
        '<header class="page-head"><p class="kicker">数据中心</p><h1>商品数据</h1>' +
        '<p class="lead">来自星脉 ERP 商品总览。店名用店铺管理补上，没有的字段先空着。</p></header>' +
        '<section class="panel"><form id="goods-filter" style="display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-bottom:12px">' +
        '<label>店铺<select name="shopId"><option value="">全部店铺</option></select></label>' +
        '<label>开始<input name="from" type="date" /></label>' +
        '<label>结束<input name="to" type="date" /></label>' +
        '<button type="submit">查询</button></form>' +
        '<p class="status error" data-err hidden></p>' +
        '<div style="overflow:auto"><table><thead><tr><th>商品</th><th>店铺</th><th>订单</th><th>应收</th><th>净销售</th><th>利润</th><th>推广</th><th>退款率</th></tr></thead>' +
        '<tbody data-body><tr><td colspan="8" class="empty">正在加载…</td></tr></tbody></table></div>' +
        '<p class="lead" data-pager></p>' +
        '<p><button type="button" data-prev>上一页</button> <button type="button" data-next>下一页</button></p>' +
        "</section></main>";
      const body = root.querySelector("[data-body]");
      const err = root.querySelector("[data-err]");
      const shopSelect = root.querySelector("select[name=shopId]");
      let dead = false;

      function loadShops() {
        return fetchJson("/api/data/shop-options?pageNum=1&pageSize=50").then(function (data) {
          if (dead) {
            return;
          }
          (data.records || []).forEach(function (row) {
            const option = document.createElement("option");
            option.value = row.id;
            option.textContent = row.shopName;
            shopSelect.append(option);
          });
        });
      }

      function load() {
        err.hidden = true;
        const params = new URLSearchParams();
        params.set("pageNum", String(state.page));
        params.set("pageSize", "20");
        if (state.shopId) {
          params.set("shopId", state.shopId);
        }
        if (state.from) {
          params.set("from", state.from + " 00:00:00");
        }
        if (state.to) {
          params.set("to", state.to + " 23:59:59");
        }
        fetchJson("/api/data/goods?" + params.toString())
          .then(function (data) {
            if (dead) {
              return;
            }
            state.pages = Math.max(1, Number(data.totalPages || 1));
            const rows = data.records || [];
            body.innerHTML = rows.length
              ? rows
                  .map(function (row) {
                    return (
                      "<tr><td>" +
                      escapeHtml(row.productName || "—") +
                      '<div class="lead">' +
                      escapeHtml(row.productId || "") +
                      "</div></td><td>" +
                      escapeHtml(row.shopName || row.shopId || "—") +
                      "</td><td>" +
                      count(row.orderCount) +
                      "</td><td>" +
                      money(row.payAmount) +
                      "</td><td>" +
                      money(row.netSalesAmount) +
                      "</td><td>" +
                      money(row.profit) +
                      "</td><td>" +
                      money(row.promotionCost) +
                      "</td><td>" +
                      pct(row.refundRate) +
                      "</td></tr>"
                    );
                  })
                  .join("")
              : '<tr><td colspan="8" class="empty">没有商品</td></tr>';
            renderPager(root, data);
          })
          .catch(function (error) {
            if (dead) {
              return;
            }
            body.innerHTML = '<tr><td colspan="8" class="empty">无法加载</td></tr>';
            err.hidden = false;
            err.textContent = error.message;
          });
      }

      root.querySelector("#goods-filter").addEventListener("submit", function (event) {
        event.preventDefault();
        const form = new FormData(event.target);
        state.shopId = String(form.get("shopId") || "").trim();
        state.from = String(form.get("from") || "").trim();
        state.to = String(form.get("to") || "").trim();
        state.page = 1;
        load();
      });
      bindPager(root, state, load);
      loadShops().finally(load);
      return function unmount() {
        dead = true;
        root.innerHTML = "";
      };
    }
  };
})();
