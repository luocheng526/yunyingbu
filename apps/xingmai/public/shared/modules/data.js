/* xm-module-data 0.1.71 */
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

  function none(value) {
    return blank(value) ? "无" : escapeHtml(value);
  }

  function money(value) {
    if (blank(value)) {
      return "无";
    }
    const n = Number(value);
    if (!Number.isFinite(n)) {
      return escapeHtml(value);
    }
    return n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function count(value) {
    if (blank(value)) {
      return "无";
    }
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString("zh-CN") : escapeHtml(value);
  }

  function pct(value) {
    if (blank(value)) {
      return "无";
    }
    const n = Number(value);
    if (!Number.isFinite(n)) {
      return escapeHtml(value);
    }
    return (n * 100).toFixed(2) + "%";
  }

  function categoryText(first, second) {
    if (blank(first) && blank(second)) {
      return "无";
    }
    if (blank(first)) {
      return escapeHtml(second);
    }
    if (blank(second)) {
      return escapeHtml(first);
    }
    return escapeHtml(first) + " / " + escapeHtml(second);
  }

  function shanghaiToday() {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date());
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

  function kpiCard(label, value, unit) {
    return (
      '<article class="kpi-card"><div class="label">' +
      escapeHtml(label) +
      '</div><div class="value">' +
      escapeHtml(value) +
      '<span class="unit">' +
      escapeHtml(unit) +
      "</span></div></article>"
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
      '<p class="lead">关键指标看板。对得上的来自星脉 ERP，没有的写无。</p></header>' +
      '<p class="status error" data-err hidden></p>' +
      '<section class="kpi-grid" data-cards aria-label="关键指标">' +
      kpiCard("今日订单", "无", "单") +
      kpiCard("待处理", "无", "件") +
      kpiCard("在职人数", "无", "人") +
      kpiCard("本周发布次数", "无", "次") +
      "</section>" +
      '<section class="panel"><h2>最近数据事件</h2>' +
      "<table><thead><tr><th>时间</th><th>类型</th><th>摘要</th></tr></thead>" +
      '<tbody data-events><tr><td colspan="3" class="empty">无</td></tr></tbody></table>' +
      "</section></main>";
    const err = root.querySelector("[data-err]");
    const cards = root.querySelector("[data-cards]");
    const events = root.querySelector("[data-events]");
    let dead = false;
    fetchJson("/api/data/overview")
      .then(function (data) {
        if (dead) {
          return;
        }
        const today = shanghaiToday();
        const row = (data.trend || []).find(function (item) {
          return item && item.date === today && !blank(item.orderCount);
        });
        cards.innerHTML =
          kpiCard("今日订单", row ? count(row.orderCount) : "无", "单") +
          kpiCard("待处理", "无", "件") +
          kpiCard("在职人数", "无", "人") +
          kpiCard("本周发布次数", "无", "次");
        const rows = data.events || [];
        events.innerHTML = rows.length
          ? rows
              .map(function (item) {
                return (
                  "<tr><td>" +
                  none(item.time) +
                  "</td><td>" +
                  none(item.type) +
                  "</td><td>" +
                  none(item.summary) +
                  "</td></tr>"
                );
              })
              .join("")
          : '<tr><td colspan="3" class="empty">无</td></tr>';
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
              body.innerHTML = '<tr><td colspan="6" class="empty">无</td></tr>';
            } else {
              body.innerHTML = rows
                .map(function (row) {
                  return (
                    "<tr><td>" +
                    none(row.shopName) +
                    '<div class="lead">' +
                    none(row.id) +
                    "</div></td><td>" +
                    none(row.typeLabel) +
                    "</td><td>" +
                    none(row.statusLabel) +
                    "</td><td>" +
                    categoryText(row.mainFirstCategoryName, row.mainSecondCategoryName) +
                    "</td><td>" +
                    none(row.introduction) +
                    "</td><td>" +
                    none(row.openTime) +
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
        return fetchJson("/api/data/shop-options").then(function (data) {
          if (dead) {
            return;
          }
          (data.records || []).forEach(function (row) {
            const option = document.createElement("option");
            option.value = row.id;
            option.textContent = row.shopName || "无";
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
              body.innerHTML = '<tr><td colspan="7" class="empty">无</td></tr>';
            } else {
              body.innerHTML = rows
                .map(function (row) {
                  return (
                    "<tr><td>" +
                    none(row.productName) +
                    '<div class="lead">' +
                    none(row.productId) +
                    "</div></td><td>" +
                    none(row.shopName || row.shopId) +
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

  window.XmModules["/data/groups"] = {
    mount: function (root) {
      const state = { page: 1, pages: 1, q: "" };
      root.innerHTML =
        '<main class="page">' +
        '<header class="page-head"><p class="kicker">数据中心</p><h1>渠道分组</h1>' +
        '<p class="lead">来自星脉 ERP 渠道分组。没有的写无。</p></header>' +
        '<section class="panel"><form id="group-filter" style="display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-bottom:12px">' +
        '<label>分组<input name="name" maxlength="64" /></label>' +
        '<button type="submit">查询</button></form>' +
        '<p class="status error" data-err hidden></p>' +
        '<div style="overflow:auto"><table><thead><tr><th>分组</th><th>店铺数</th><th>店铺</th></tr></thead>' +
        '<tbody data-body><tr><td colspan="3" class="empty">正在加载…</td></tr></tbody></table></div>' +
        '<p class="lead" data-pager></p>' +
        '<p><button type="button" data-prev>上一页</button> <button type="button" data-next>下一页</button></p>' +
        "</section></main>";
      const body = root.querySelector("[data-body]");
      const err = root.querySelector("[data-err]");
      let dead = false;

      function load() {
        err.hidden = true;
        fetchJson("/api/data/groups?pageNum=" + state.page + "&pageSize=20&shopName=" + encodeURIComponent(state.q))
          .then(function (data) {
            if (dead) {
              return;
            }
            state.pages = Math.max(1, Number(data.totalPages || 1));
            const rows = data.records || [];
            body.innerHTML = rows.length
              ? rows
                  .map(function (row) {
                    const shops = (row.shops || [])
                      .map(function (shop) {
                        return shop.shopName || shop.shopId;
                      })
                      .filter(Boolean)
                      .join("、");
                    return (
                      "<tr><td>" +
                      none(row.name || row.id) +
                      "</td><td>" +
                      count((row.shops || []).length) +
                      "</td><td>" +
                      none(shops) +
                      "</td></tr>"
                    );
                  })
                  .join("")
              : '<tr><td colspan="3" class="empty">无</td></tr>';
            renderPager(root, data);
          })
          .catch(function (error) {
            if (dead) {
              return;
            }
            body.innerHTML = '<tr><td colspan="3" class="empty">无法加载</td></tr>';
            err.hidden = false;
            err.textContent = error.message;
          });
      }

      root.querySelector("#group-filter").addEventListener("submit", function (event) {
        event.preventDefault();
        state.q = String(new FormData(event.target).get("name") || "").trim();
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

  window.XmModules["/data/categories"] = {
    mount: function (root) {
      const state = { page: 1, pages: 1 };
      root.innerHTML =
        '<main class="page">' +
        '<header class="page-head"><p class="kicker">数据中心</p><h1>渠道品类</h1>' +
        '<p class="lead">来自星脉 ERP 渠道品类。没有的写无。</p></header>' +
        '<section class="panel">' +
        '<p class="status error" data-err hidden></p>' +
        '<div style="overflow:auto"><table><thead><tr><th>品类</th><th>商品数</th><th>订单</th><th>应收</th><th>净销售</th><th>利润</th><th>退款率</th></tr></thead>' +
        '<tbody data-body><tr><td colspan="7" class="empty">正在加载…</td></tr></tbody></table></div>' +
        '<p class="lead" data-pager></p>' +
        '<p><button type="button" data-prev>上一页</button> <button type="button" data-next>下一页</button></p>' +
        "</section></main>";
      const body = root.querySelector("[data-body]");
      const err = root.querySelector("[data-err]");
      let dead = false;

      function load() {
        err.hidden = true;
        fetchJson("/api/data/categories?pageNum=" + state.page + "&pageSize=20")
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
                      none(row.categoryName || row.thirdCategoryId) +
                      "</td><td>" +
                      count(row.productCount) +
                      "</td><td>" +
                      count(row.orderCount) +
                      "</td><td>" +
                      money(row.payAmount) +
                      "</td><td>" +
                      money(row.netSalesAmount) +
                      "</td><td>" +
                      money(row.profit) +
                      "</td><td>" +
                      pct(row.refundRate) +
                      "</td></tr>"
                    );
                  })
                  .join("")
              : '<tr><td colspan="7" class="empty">无</td></tr>';
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

      bindPager(root, state, load);
      load();
      return function unmount() {
        dead = true;
        root.innerHTML = "";
      };
    }
  };

  window.XmModules["/data/compare"] = {
    mount: function (root) {
      root.innerHTML =
        '<main class="page">' +
        '<header class="page-head"><p class="kicker">数据中心</p><h1>渠道对比</h1>' +
        '<p class="lead">来自星脉 ERP 渠道业绩对比，按月。没有的写无。</p></header>' +
        '<section class="panel">' +
        '<p class="status error" data-err hidden></p>' +
        '<div style="overflow:auto"><table><thead><tr><th>月份</th><th>应收</th><th>净额</th><th>利润</th><th>退款</th><th>推广</th><th>利润率</th></tr></thead>' +
        '<tbody data-body><tr><td colspan="7" class="empty">正在加载…</td></tr></tbody></table></div>' +
        "</section></main>";
      const body = root.querySelector("[data-body]");
      const err = root.querySelector("[data-err]");
      let dead = false;
      fetchJson("/api/data/compare")
        .then(function (data) {
          if (dead) {
            return;
          }
          const rows = data.records || [];
          body.innerHTML = rows.length
            ? rows
                .map(function (row) {
                  return (
                    "<tr><td>" +
                    none(row.yearMonth) +
                    "</td><td>" +
                    money(row.payAmount) +
                    "</td><td>" +
                    money(row.netAmount) +
                    "</td><td>" +
                    money(row.profit) +
                    "</td><td>" +
                    money(row.refundAmount) +
                    "</td><td>" +
                    money(row.promotionCost) +
                    "</td><td>" +
                    pct(row.profitRate) +
                    "</td></tr>"
                  );
                })
                .join("")
            : '<tr><td colspan="7" class="empty">无</td></tr>';
        })
        .catch(function (error) {
          if (dead) {
            return;
          }
          body.innerHTML = '<tr><td colspan="7" class="empty">无法加载</td></tr>';
          err.hidden = false;
          err.textContent = error.message;
        });
      return function unmount() {
        dead = true;
        root.innerHTML = "";
      };
    }
  };
})();
