/* xm-module-data restore-v1 — left-nav must load page scripts; do not restore the old waitPage shell */
(function () {
  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function renameDataPaidNav() {
    const root = document.getElementById("site-nav");
    if (!root) {
      return;
    }
    Array.prototype.forEach.call(root.querySelectorAll('a[href="/data/paid"], a[href="/data/paid/"]'), function (el) {
      if (el.textContent.replace(/\s+/g, "") === "实时付费") {
        el.textContent = "实时看板";
      }
    });
  }

  function watchPaidNav() {
    renameDataPaidNav();
    const root = document.getElementById("site-nav");
    if (!root || root.getAttribute("data-xm-paid-renamed") === "1") {
      return;
    }
    root.setAttribute("data-xm-paid-renamed", "1");
    new MutationObserver(function () {
      renameDataPaidNav();
    }).observe(root, { childList: true, subtree: true });
  }

  function ensureSheet() {
    if (!document.querySelector('link[href^="/data-pages.css"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/data-pages.css";
      document.head.appendChild(link);
    }
  }

  function factoryReady(src) {
    if (/data-shops\.js/.test(src)) {
      return typeof window.XmDataCreateShopDashboard === "function";
    }
    if (/data-overview\.js/.test(src)) {
      return typeof window.XmDataCreateDashboard === "function";
    }
    if (/data-goods\.js/.test(src)) {
      return typeof window.XmDataCreateGoodsDashboard === "function";
    }
    if (/data-live\.js/.test(src)) {
      return typeof window.XmDataCreateLiveDashboard === "function";
    }
    return false;
  }

  function loadScript(src) {
    return new Promise(function (resolve) {
      if (factoryReady(src)) {
        resolve();
        return;
      }
      const existing = document.querySelector('script[src="' + src + '"]');
      if (existing) {
        if (
          existing.getAttribute("data-loaded") === "1" ||
          existing.readyState === "complete" ||
          existing.readyState === "loaded"
        ) {
          resolve();
          return;
        }
        existing.addEventListener("load", function () {
          resolve();
        });
        existing.addEventListener("error", function () {
          resolve();
        });
        setTimeout(resolve, 8000);
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.onload = function () {
        script.setAttribute("data-loaded", "1");
        resolve();
      };
      script.onerror = function () {
        resolve();
      };
      document.head.appendChild(script);
    });
  }

  function mountLiveDashboard(root) {
    ensureSheet();
    return loadScript("/data-live.js?v=home-live1").then(function () {
      if (typeof window.XmDataCreateLiveDashboard === "function") {
        return window.XmDataCreateLiveDashboard(root);
      }
      root.innerHTML =
        '<main class="xm-page data-fill data-overview-root"><p class="lead">示例数据，尚未接入店铺。</p></main>';
      return function unmount() {
        root.innerHTML = "";
      };
    });
  }

  function mountShopDashboard(root) {
    ensureSheet();
    if (root && !root.querySelector("#board")) {
      root.innerHTML =
        '<main class="xm-page data-overview-root ch-root"><div id="board"><p class="ch-empty">正在加载店铺数据…</p></div></main>';
    }
    return loadScript("/data-shops.js?v=shop-wide2").then(function () {
      if (typeof window.XmDataCreateShopDashboard === "function") {
        return window.XmDataCreateShopDashboard(root);
      }
      root.innerHTML =
        '<main class="xm-page data-fill data-overview-root"><p class="lead">示例数据，尚未接入店铺。</p></main>';
      return function unmount() {
        root.innerHTML = "";
      };
    });
  }

  function mountGoodsDashboard(root) {
    ensureSheet();
    return loadScript("/data-goods.js?v=goods-erp1").then(function () {
      if (typeof window.XmDataCreateGoodsDashboard === "function") {
        return window.XmDataCreateGoodsDashboard(root);
      }
      root.innerHTML =
        '<main class="xm-page data-fill data-overview-root"><p class="lead">示例数据，尚未接入店铺。</p></main>';
      return function unmount() {
        root.innerHTML = "";
      };
    });
  }

  function mountOverview(root) {
    ensureSheet();
    if (root && !root.querySelector("#board")) {
      root.innerHTML =
        '<main class="xm-page data-overview-root ch-root"><div id="board"><p class="ch-empty">正在加载数据总览…</p></div></main>';
    }
    return loadScript("/data-overview.js?v=data-ov4").then(function () {
      if (typeof window.XmDataCreateDashboard === "function") {
        return window.XmDataCreateDashboard(root);
      }
          root.innerHTML =
            '<main class="xm-page data-fill data-overview-root"><p class="lead">示例数据，尚未接入店铺。</p></main>';
      return function unmount() {
        root.innerHTML = "";
      };
    });
  }

  function mountList(root, spec) {
    ensureSheet();
    root.innerHTML =
      '<main class="xm-page data-fill">' +
      "<h1>" +
      escapeHtml(spec.title) +
      "</h1>" +
      '<nav class="data-subnav" id="data-subnav"></nav>' +
      '<p class="lead">' +
      escapeHtml(spec.lead) +
      "</p>" +
      '<section class="kpi-grid" id="cards"></section>' +
      '<section class="panel"><h2>' +
      escapeHtml(spec.tableTitle) +
      '</h2><table class="data-table"><thead><tr>' +
      spec.headers
        .map(function (h) {
          return "<th>" + escapeHtml(h) + "</th>";
        })
        .join("") +
      '</tr></thead><tbody id="rows"><tr><td colspan="' +
      spec.headers.length +
      '">正在加载…</td></tr></tbody></table></section></main>';

    const sub = document.createElement("script");
    sub.src = "/data-subnav.js";
    root.appendChild(sub);

    let dead = false;
    const cardsEl = root.querySelector("#cards");
    const rowsEl = root.querySelector("#rows");

    fetch(spec.api, { credentials: "same-origin", headers: { Accept: "application/json" } })
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
        cardsEl.innerHTML = (data.cards || [])
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
        rowsEl.innerHTML = (data.rows || [])
          .map(function (row) {
            return (
              "<tr>" +
              spec.cells(row)
                .map(function (cell) {
                  return "<td>" + escapeHtml(cell) + "</td>";
                })
                .join("") +
              "</tr>"
            );
          })
          .join("");
      })
      .catch(function (err) {
        if (!dead) {
          rowsEl.innerHTML =
            '<tr><td colspan="' +
            spec.headers.length +
            '" class="error">' +
            escapeHtml(err.message) +
            "</td></tr>";
        }
      });

    return function unmount() {
      dead = true;
      root.innerHTML = "";
    };
  }

  window.XmModules = window.XmModules || {};

  function asyncMount(start) {
    return {
      mount: function (root) {
        let stop = null;
        try {
          Promise.resolve(start(root)).then(function (unmount) {
            stop = unmount;
          });
        } catch (_err) {
          root.innerHTML = '<main class="xm-page"><p class="ch-empty">页面加载失败</p></main>';
        }
        return function unmount() {
          if (typeof stop === "function") {
            stop();
          }
          root.innerHTML = "";
        };
      }
    };
  }

  const overviewModule = asyncMount(mountOverview);
  const shopsModule = asyncMount(mountShopDashboard);
  const goodsModule = asyncMount(mountGoodsDashboard);
  const paidModule = asyncMount(mountLiveDashboard);
  const homeModule = {
    mount: function (root) {
      window.location.replace("/data/overview");
      return function unmount() {
        root.innerHTML = "";
      };
    }
  };

  function lockModule(path, module) {
    try {
      Object.defineProperty(window.XmModules, path, {
        configurable: true,
        enumerable: true,
        get: function () {
          return module;
        },
        set: function () {}
      });
    } catch (_err) {
      window.XmModules[path] = module;
    }
  }

  function registerModule(path, module) {
    lockModule(path, module);
    if (path !== "/" && !path.endsWith("/")) {
      lockModule(path + "/", module);
    }
  }

  function restoreModules() {
    registerModule("/data/overview", overviewModule);
    registerModule("/data/shops", shopsModule);
    registerModule("/data/goods", goodsModule);
    registerModule("/data/paid", paidModule);
    registerModule("/data", homeModule);
  }

  restoreModules();
  setInterval(restoreModules, 8000);

  watchPaidNav();
})();
