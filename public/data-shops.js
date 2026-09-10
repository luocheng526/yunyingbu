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
      link.href = "/data-pages.css?v=shop-tpl";
      document.head.appendChild(link);
    }
  }

  function stripPageChrome(root) {
    Array.prototype.forEach.call(root.querySelectorAll(".kicker, .data-subnav"), function (el) {
      el.remove();
    });
    Array.prototype.forEach.call(root.querySelectorAll("h1"), function (el) {
      if (/店铺数据|店铺总览/.test(el.textContent.trim())) {
        el.remove();
      }
    });
  }

  function nameCell(row) {
    const color = row.color || (row.kind === "shop" ? "#e53935" : "");
    const mark =
      row.kind === "shop"
        ? '<span class="ch-logo" style="background:' + escapeHtml(color) + '" aria-hidden="true"></span>'
        : "";
    return (
      '<td class="ch-name"><span class="ch-bar"></span>' +
      mark +
      "<span>" +
      escapeHtml(row.name) +
      "</span></td>"
    );
  }

  function toolButtons() {
    return (
      '<div class="ch-tools">' +
      '<button type="button" disabled>打标</button>' +
      '<button type="button" disabled>目标</button>' +
      '<button type="button" class="is-on" disabled>列表</button>' +
      '<button type="button" disabled>周期</button>' +
      '<button type="button" disabled>图表</button>' +
      '<button type="button" disabled>个人默认视图</button>' +
      '<button type="button" disabled>更多数据</button>' +
      '<button type="button" disabled>导出</button></div>'
    );
  }

  function tableHtml(block) {
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
        return (
          "<tr>" +
          nameCell(row) +
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
      '<section class="ch-table ch-table-solo">' +
      '<div class="ch-table-bar"><strong>' +
      escapeHtml(block.title) +
      '</strong><label class="ch-pick"><select disabled><option>请选择标签</option></select></label>' +
      '<label class="ch-zero"><input type="checkbox" disabled /> 显示数字</label>' +
      toolButtons() +
      "</div>" +
      '<div class="ch-table-wrap"><table><thead>' +
      head +
      "</thead><tbody>" +
      body +
      "</tbody></table></div></section>"
    );
  }

  function createShopDashboard(root) {
    ensureCss();
    stripPageChrome(root);
    let board = root.querySelector("#board");
    if (!board) {
      root.innerHTML = '<main class="xm-page data-overview-root ch-root"><div id="board"></div></main>';
      board = root.querySelector("#board");
    }
    let payload = null;
    let dead = false;

    function render() {
      if (dead || !payload || !board) {
        return;
      }
      const views = (payload.views || [])
        .map(function (view) {
          const current = view.href === "/data/shops";
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
      board.innerHTML =
        '<div class="ch-top"><div class="ch-views">' +
        views +
        '</div><div class="ch-right"><span class="ch-time">（统计时间：' +
        escapeHtml(payload.dateLabel || "") +
        "）</span>" +
        '<div class="ch-ranges">' +
        ranges +
        "</div></div></div>" +
        tableHtml(payload.shopTable);
    }

    board.addEventListener("click", function (event) {
      const rangeBtn = event.target.closest("button[data-range]");
      if (rangeBtn && payload) {
        payload.range = rangeBtn.getAttribute("data-range");
        render();
      }
    });

    fetch("/api/data/shops", {
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
        if (!dead) {
          payload = data;
          render();
        }
      })
      .catch(function () {
        return fetch("/data/shops-demo.json", { credentials: "same-origin" }).then(function (res) {
          if (!res.ok) {
            throw new Error("示例数据 " + res.status);
          }
          return res.json();
        });
      })
      .then(function (data) {
        if (data && !payload && !dead) {
          payload = data;
          render();
        }
      })
      .catch(function (err) {
        if (!dead && board) {
          board.innerHTML = '<p class="data-table error">' + escapeHtml(err.message) + "</p>";
        }
      });

    return function unmount() {
      dead = true;
    };
  }

  window.XmDataCreateShopDashboard = createShopDashboard;

  const shopModule = {
    mount: function (root) {
      return createShopDashboard(root);
    }
  };

  try {
    Object.defineProperty(window.XmModules, "/data/shops", {
      configurable: true,
      enumerable: true,
      get: function () {
        return shopModule;
      },
      set: function () {}
    });
  } catch (_err) {
    window.XmModules["/data/shops"] = shopModule;
  }

  const existingBoard = document.getElementById("board");
  if (existingBoard) {
    createShopDashboard(existingBoard.closest(".xm-page") || document.body);
  }
})();
