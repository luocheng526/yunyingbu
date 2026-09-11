/* xm-module-data — themed content mounts; does not paint a stub page */
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

  function loadScript(src) {
    return new Promise(function (resolve) {
      const existing = document.querySelector('script[src="' + src + '"]');
      if (existing) {
        if (window.XmDataCreateDashboard) {
          resolve();
          return;
        }
        existing.addEventListener("load", function () {
          resolve();
        });
        existing.addEventListener("error", function () {
          resolve();
        });
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.onload = function () {
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
    return loadScript("/data-shops.js?v=shop-tpl3").then(function () {
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
    return loadScript("/data-overview.js?v=channel-tpl2").then(function () {
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

  window.XmModules["/data/overview"] = {
    mount: function (root) {
      let stop = null;
      mountOverview(root).then(function (unmount) {
        stop = unmount;
      });
      return function unmount() {
        if (typeof stop === "function") {
          stop();
        }
        root.innerHTML = "";
      };
    }
  };

  window.XmModules["/data/shops"] = {
    mount: function (root) {
      let stop = null;
      mountShopDashboard(root).then(function (unmount) {
        stop = unmount;
      });
      return function unmount() {
        if (typeof stop === "function") {
          stop();
        }
        root.innerHTML = "";
      };
    }
  };

  window.XmModules["/data/goods"] = {
    mount: function (root) {
      let stop = null;
      mountGoodsDashboard(root).then(function (unmount) {
        stop = unmount;
      });
      return function unmount() {
        if (typeof stop === "function") {
          stop();
        }
        root.innerHTML = "";
      };
    }
  };

  window.XmModules["/data/paid"] = {
    mount: function (root) {
      let stop = null;
      mountLiveDashboard(root).then(function (unmount) {
        stop = unmount;
      });
      return function unmount() {
        if (typeof stop === "function") {
          stop();
        }
        root.innerHTML = "";
      };
    }
  };

  window.XmModules["/data"] = {
    mount: function (root) {
      window.location.replace("/data/overview");
      return function unmount() {
        root.innerHTML = "";
      };
    }
  };

  watchPaidNav();
})();
