/* xm-module-data 0.1.66 */
(function () {
  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function money(value) {
    if (value == null || value === "") {
      return "—";
    }
    const n = Number(value);
    if (!Number.isFinite(n)) {
      return escapeHtml(value);
    }
    return n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

  window.XmModules["/data/overview"] = waitPage("数据总揽");
  window.XmModules["/data/paid"] = waitPage("实时付费");

  window.XmModules["/data/shops"] = {
    mount: function (root) {
      const state = { page: 1, pages: 1, q: "" };
      root.innerHTML =
        '<main class="page">' +
        '<header class="page-head"><p class="kicker">数据中心</p><h1>店铺数据</h1>' +
        '<p class="lead">来自星脉 ERP 店铺管理，不是演示名单。</p></header>' +
        '<section class="panel"><form id="shop-filter" style="display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-bottom:12px">' +
        '<label>店名<input name="shopName" maxlength="64" /></label>' +
        '<button type="submit">查询</button></form>' +
        '<p class="status error" data-err hidden></p>' +
        '<div style="overflow:auto"><table><thead><tr><th>店铺</th><th>类型</th><th>状态</th><th>类目</th><th>简介</th><th>开店时间</th></tr></thead>' +
        '<tbody data-body><tr><td colspan="6" class="empty">正在加载…</td></tr></tbody></table></div>' +
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
            if (!rows.length) {
              body.innerHTML = '<tr><td colspan="6" class="empty">没有店铺</td></tr>';
            } else {
              body.innerHTML = rows
                .map(function (row) {
                  return (
                    "<tr><td>" +
                    escapeHtml(row.shopName) +
                    "<div class=\"lead\">" +
                    escapeHtml(row.id) +
                    "</div></td><td>" +
                    escapeHtml(row.typeLabel) +
                    "</td><td>" +
                    escapeHtml(row.statusLabel) +
                    "</td><td>" +
                    escapeHtml(row.mainFirstCategoryName) +
                    " / " +
                    escapeHtml(row.mainSecondCategoryName) +
                    "</td><td>" +
                    escapeHtml(row.introduction) +
                    "</td><td>" +
                    escapeHtml(row.openTime) +
                    "</td></tr>"
                  );
                })
                .join("");
            }
            renderPager(root, data);
          })
          .catch(function (error) {
            if (dead) {
              return;
            }
            body.innerHTML = '<tr><td colspan="6" class="empty">无法加载</td></tr>';
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
        '<p class="lead">来自星脉 ERP 商品总览。不选店时查全部已授权店铺。</p></header>' +
        '<section class="panel"><form id="goods-filter" style="display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-bottom:12px">' +
        '<label>店铺<select name="shopId"><option value="">全部店铺</option></select></label>' +
        '<label>开始<input name="from" type="date" /></label>' +
        '<label>结束<input name="to" type="date" /></label>' +
        '<button type="submit">查询</button></form>' +
        '<p class="status error" data-err hidden></p>' +
        '<div style="overflow:auto"><table><thead><tr><th>商品</th><th>店铺</th><th>订单</th><th>应收</th><th>净销售</th><th>利润</th><th>推广</th></tr></thead>' +
        '<tbody data-body><tr><td colspan="7" class="empty">正在加载…</td></tr></tbody></table></div>' +
        '<p class="lead" data-pager></p>' +
        '<p><button type="button" data-prev>上一页</button> <button type="button" data-next>下一页</button></p>' +
        "</section></main>";
      const body = root.querySelector("[data-body]");
      const err = root.querySelector("[data-err]");
      const shopSelect = root.querySelector("select[name=shopId]");
      let dead = false;

      function loadShops() {
        return fetchJson("/api/data/shops?pageNum=1&pageSize=50").then(function (data) {
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
            if (!rows.length) {
              body.innerHTML = '<tr><td colspan="7" class="empty">没有商品</td></tr>';
            } else {
              body.innerHTML = rows
                .map(function (row) {
                  return (
                    "<tr><td>" +
                    escapeHtml(row.productName) +
                    "<div class=\"lead\">" +
                    escapeHtml(row.productId) +
                    "</div></td><td>" +
                    escapeHtml(row.shopId) +
                    "</td><td>" +
                    escapeHtml(row.orderCount) +
                    "</td><td>" +
                    money(row.payAmount) +
                    "</td><td>" +
                    money(row.netSalesAmount) +
                    "</td><td>" +
                    money(row.profit) +
                    "</td><td>" +
                    money(row.promotionCost) +
                    "</td></tr>"
                  );
                })
                .join("");
            }
            renderPager(root, data);
          })
          .catch(function (error) {
            if (dead) {
              return;
            }
            body.innerHTML = '<tr><td colspan="7" class="empty">无法加载</td></tr>';
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

  window.XmModules["/data"] = {
    mount: function (root) {
      root.innerHTML =
        '<main class="page">' +
        '<header class="page-head">' +
        '<p class="kicker">运营部</p>' +
        " <h1>数据中心</h1>" +
        '<p class="lead">关键指标看板。数字来自库内种子，带演示标记，不是外部业务库。</p>' +
        "</header>" +
        '<section class="kpi-grid" id="cards" aria-label="关键指标">' +
        '<article class="kpi-card"><div class="label">今日订单</div><div class="value">128<span class="unit">单</span></div></article>' +
        '<article class="kpi-card"><div class="label">待处理</div><div class="value">17<span class="unit">件</span></div></article>' +
        '<article class="kpi-card"><div class="label">在职人数</div><div class="value">36<span class="unit">人</span></div></article>' +
        '<article class="kpi-card"><div class="label">本周发布次数</div><div class="value">5<span class="unit">次</span></div></article>' +
        "</section>" +
        '<section class="panel"><h2>最近数据事件</h2><table><thead><tr><th>时间</th><th>类型</th><th>摘要</th></tr></thead>' +
        '<tbody id="events"><tr><td colspan="3" class="empty">正在加载…</td></tr></tbody></table></section>' +
        "</main>";

      const cardsEl = root.querySelector("#cards");
      const eventsEl = root.querySelector("#events");
      let dead = false;

      function renderCards(cards) {
        cardsEl.innerHTML = cards
          .map(function (card) {
            return (
              '<article class="kpi-card"><div class="label">' +
              escapeHtml(card.label) +
              '</div><div class="value">' +
              escapeHtml(card.value) +
              (card.unit ? '<span class="unit">' + escapeHtml(card.unit) + "</span>" : "") +
              "</div></article>"
            );
          })
          .join("");
      }

      function renderEvents(events) {
        if (!events || !events.length) {
          eventsEl.innerHTML = '<tr><td colspan="3" class="empty">暂无事件</td></tr>';
          return;
        }
        eventsEl.innerHTML = events
          .map(function (row) {
            return (
              "<tr><td>" +
              escapeHtml(row.time) +
              "</td><td>" +
              escapeHtml(row.type) +
              "</td><td>" +
              escapeHtml(row.summary) +
              "</td></tr>"
            );
          })
          .join("");
      }

      fetch("/api/data/overview", {
        credentials: "same-origin",
        headers: { Accept: "application/json" }
      })
        .then(function (res) {
          if (!res.ok) {
            throw new Error("接口 " + res.status);
          }
          return res.json();
        })
        .then(function (data) {
          if (dead) {
            return;
          }
          renderCards(data.cards || []);
          renderEvents(data.events || []);
        })
        .catch(function (err) {
          if (dead) {
            return;
          }
          eventsEl.innerHTML =
            '<tr><td colspan="3" class="status error">无法加载：' +
            escapeHtml(err.message) +
            "</td></tr>";
        });

      return function unmount() {
        dead = true;
        root.innerHTML = "";
      };
    }
  };
})();
