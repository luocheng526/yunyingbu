(function () {
  window.XmModules = window.XmModules || {};

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function ensureCss() {
    if (!document.querySelector('link[href^="/data-pages.css"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/data-pages.css?v=live-shops2";
      document.head.appendChild(link);
    }
  }

  function stripPageChrome(root) {
    Array.prototype.forEach.call(root.querySelectorAll(".kicker, .data-subnav"), function (el) {
      el.remove();
    });
    Array.prototype.forEach.call(root.querySelectorAll("h1"), function (el) {
      if (/实时付费|实时看板/.test(el.textContent.trim())) {
        el.remove();
      }
    });
  }

  function formatNow(date) {
    const d = date || new Date();
    return (
      d.getFullYear() +
      "/" +
      (d.getMonth() + 1) +
      "/" +
      d.getDate() +
      " " +
      String(d.getHours()).padStart(2, "0") +
      ":" +
      String(d.getMinutes()).padStart(2, "0") +
      ":" +
      String(d.getSeconds()).padStart(2, "0")
    );
  }

  function shopTableHtml(block) {
    if (!block) {
      return "";
    }
    const head =
      "<tr>" +
      (block.columns || [])
        .map(function (col) {
          return "<th>" + escapeHtml(col) + " <i></i></th>";
        })
        .join("") +
      "</tr>";
    const body = (block.rows || [])
      .map(function (row) {
        const color = row.color || (row.kind === "shop" ? "#e53935" : "");
        const mark =
          row.kind === "shop"
            ? '<span class="ch-logo" style="background:' + escapeHtml(color) + '" aria-hidden="true"></span>'
            : "";
        return (
          "<tr><td class=\"ch-name\"><span class=\"ch-bar\"></span>" +
          mark +
          "<span>" +
          escapeHtml(row.name) +
          "</span></td>" +
          (row.cells || [])
            .map(function (cell) {
              return "<td>" + escapeHtml(cell) + "</td>";
            })
            .join("") +
          "</tr>"
        );
      })
      .join("");
    return (
      '<section class="ch-table ch-table-solo lv-shop-table">' +
      '<div class="ch-table-bar"><strong>' +
      escapeHtml(block.title || "店铺实时付费明细") +
      "</strong></div>" +
      '<div class="ch-table-wrap"><table><thead>' +
      head +
      "</thead><tbody>" +
      body +
      "</tbody></table></div></section>"
    );
  }

  function sparkSvg(points) {
    const vals = points && points.length ? points : [20, 24, 22, 30, 28, 36];
    const w = 140;
    const h = 40;
    const min = Math.min.apply(null, vals);
    const max = Math.max.apply(null, vals);
    const span = max - min || 1;
    const d = vals
      .map(function (v, i) {
        const x = (i / (vals.length - 1)) * w;
        const y = h - ((v - min) / span) * (h - 6) - 3;
        return (i === 0 ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1);
      })
      .join(" ");
    return (
      '<svg class="ch-spark" viewBox="0 0 ' +
      w +
      " " +
      h +
      '" preserveAspectRatio="none" aria-hidden="true"><path d="' +
      d +
      '" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>'
    );
  }

  function createLiveDashboard(root) {
    ensureCss();
    stripPageChrome(root);
    let board = root.querySelector("#board");
    if (!board) {
      root.innerHTML = '<main class="xm-page data-overview-root ch-root"><div id="board"></div></main>';
      board = root.querySelector("#board");
    }
    let payload = null;
    let clock = formatNow();
    let dead = false;

    function render() {
      if (dead || !payload || !board) {
        return;
      }
      const hero = payload.hero || {};
      const down = Number(hero.delta) < 0;
      const views = (payload.views || [])
        .map(function (view) {
          const current = view.href === "/data/paid";
          return (
            '<a href="' +
            escapeHtml(view.href) +
            '"' +
            (current ? ' class="is-active"' : "") +
            ">" +
            escapeHtml(view.label) +
            "</a>"
          );
        })
        .join("");
      const ranges = (payload.ranges || [])
        .map(function (label) {
          return (
            '<button type="button" data-range="' +
            escapeHtml(label) +
            '"' +
            (label === payload.range ? ' class="is-active"' : "") +
            ">" +
            escapeHtml(label) +
            "</button>"
          );
        })
        .join("");
      const cards = (payload.cards || [])
        .map(function (card) {
          return (
            '<article class="ch-card"><div class="label">' +
            escapeHtml(card.label) +
            '</div><div class="value">' +
            escapeHtml(card.value) +
            "</div>" +
            (card.extra ? '<div class="extra">' + escapeHtml(card.extra) + "</div>" : "") +
            "</article>"
          );
        })
        .join("");
      board.innerHTML =
        '<div class="ch-top"><div class="ch-views">' +
        views +
        '</div><div class="lv-now"><span id="lv-clock">' +
        escapeHtml(clock) +
        '</span><button type="button" data-refresh>刷新</button></div>' +
        '<div class="ch-right"><span class="ch-time">（统计时间：' +
        escapeHtml(payload.dateLabel || "") +
        "）</span>" +
        '<div class="ch-ranges">' +
        ranges +
        "</div></div></div>" +
        '<div class="ch-summary"><span class="ch-sum-title">综合指标</span>' +
        "<b>渠道 " +
        escapeHtml(String(payload.summary.channels)) +
        "个</b><b>店铺 " +
        escapeHtml(String(payload.summary.shops)) +
        '个</b><button type="button" class="ch-set" disabled>设定指标</button></div>' +
        '<div class="ch-metrics lv-metrics"><article class="ch-card ch-hero"><div class="label">' +
        escapeHtml(hero.label || "实时销售指数") +
        '</div><div class="value">' +
        escapeHtml(hero.value || "") +
        "</div>" +
        sparkSvg(hero.spark) +
        '<div class="ch-axis"><span>00:00</span><span>12:00</span><span>23:00</span></div>' +
        '<div class="delta ' +
        (down ? "is-down" : "is-up") +
        '">' +
        (down ? "↓ " : "↑ ") +
        escapeHtml(String(Math.abs(Number(hero.delta || 0)))) +
        "%</div></article>" +
        cards +
        "</div>" +
        shopTableHtml(payload.shopLiveTable);
    }

    function applyPayload(data) {
      if (dead || !data) {
        return;
      }
      payload = data;
      clock = formatNow();
      render();
    }

    function loadDemoTable(base) {
      return fetch("/data/live-demo.json", { credentials: "same-origin" }).then(function (res) {
        if (!res.ok) {
          throw new Error("示例数据 " + res.status);
        }
        return res.json();
      }).then(function (demo) {
        if (base && demo && demo.shopLiveTable && !base.shopLiveTable) {
          base.shopLiveTable = demo.shopLiveTable;
        }
        return base || demo;
      });
    }

    function load() {
      clock = formatNow();
      fetch("/api/data/live", {
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
          if (data && data.shopLiveTable) {
            applyPayload(data);
            return null;
          }
          return loadDemoTable(data);
        })
        .catch(function () {
          return loadDemoTable(null);
        })
        .then(function (data) {
          if (data) {
            applyPayload(data);
          }
        })
        .catch(function (err) {
          if (!dead && board) {
            board.innerHTML = '<p class="data-table error">' + escapeHtml(err.message) + "</p>";
          }
        });
    }

    board.addEventListener("click", function (event) {
      if (event.target.closest("button[data-refresh]")) {
        payload = payload || payload;
        clock = formatNow();
        if (payload) {
          render();
        }
        load();
        return;
      }
      const rangeBtn = event.target.closest("button[data-range]");
      if (rangeBtn && payload) {
        payload.range = rangeBtn.getAttribute("data-range");
        render();
      }
    });

    load();

    return function unmount() {
      dead = true;
    };
  }

  window.XmDataCreateLiveDashboard = createLiveDashboard;

  const liveModule = {
    mount: function (root) {
      return createLiveDashboard(root);
    }
  };

  try {
    Object.defineProperty(window.XmModules, "/data/paid", {
      configurable: true,
      enumerable: true,
      get: function () {
        return liveModule;
      },
      set: function () {}
    });
  } catch (_err) {
    window.XmModules["/data/paid"] = liveModule;
  }

  const existingBoard = document.getElementById("board");
  if (existingBoard && /\/data\/paid\/?$/.test(location.pathname)) {
    createLiveDashboard(existingBoard.closest(".xm-page") || document.body);
  }
})();
