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
      link.href = "/data-pages.css?v=goods-tpl";
      document.head.appendChild(link);
    }
  }

  function stripPageChrome(root) {
    Array.prototype.forEach.call(root.querySelectorAll(".kicker, .data-subnav"), function (el) {
      el.remove();
    });
    Array.prototype.forEach.call(root.querySelectorAll("h1"), function (el) {
      if (/商品数据/.test(el.textContent.trim())) {
        el.remove();
      }
    });
  }

  function toolButtons() {
    return (
      '<div class="ch-tools">' +
      '<button type="button" disabled>表格操作</button>' +
      '<button type="button" disabled>选数</button>' +
      '<button type="button" disabled>导入推广SKU</button>' +
      '<button type="button" disabled>去推广</button>' +
      '<button type="button" class="is-on" disabled>列表</button>' +
      '<button type="button" disabled>周期</button>' +
      '<button type="button" disabled>大图</button>' +
      '<button type="button" disabled>默认视图</button>' +
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
          "<tr><td class=\"ch-name\"><span class=\"ch-bar\"></span><span>" +
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
      '<section class="ch-table ch-table-solo">' +
      '<div class="ch-table-bar gd-filters">' +
      '<label class="ch-pick"><select disabled><option>旗舰店专卖店</option></select></label>' +
      '<label class="ch-pick"><select disabled><option>请选择类目</option></select></label>' +
      '<label class="ch-pick"><select disabled><option>全部商品</option></select></label>' +
      '<label class="ch-pick"><select disabled><option>请选择标签</option></select></label>' +
      '<label class="ch-pick gd-search"><input type="search" disabled placeholder="输入商品名/商品ID/商品链接编码" /></label>' +
      "</div>" +
      '<div class="ch-table-bar">' +
      '<label class="ch-zero"><input type="checkbox" disabled /> 只看负责人</label>' +
      '<label class="ch-zero"><input type="checkbox" disabled /> 只看有效商品</label>' +
      '<label class="ch-zero"><input type="checkbox" disabled /> 显示0</label>' +
      toolButtons() +
      "</div>" +
      '<div class="ch-table-wrap"><table><thead>' +
      head +
      "</thead><tbody>" +
      body +
      "</tbody></table></div></section>"
    );
  }

  function createGoodsDashboard(root) {
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
          const current = view.href === "/data/goods";
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
            '<article class="gd-card"><span class="gd-mark" style="background:' +
            escapeHtml(card.color || "#8c8c8c") +
            '"></span><div class="label">' +
            escapeHtml(card.label) +
            '</div><div class="hint">' +
            escapeHtml(card.hint || "") +
            '</div><div class="value">' +
            escapeHtml(card.value) +
            '</div><div class="extra">' +
            escapeHtml(card.share || "") +
            " · " +
            escapeHtml(card.delta || "") +
            "</div></article>"
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
        '<div class="ch-summary"><span class="ch-sum-title">综合指标</span>' +
        '<label class="gd-grain"><input type="radio" checked disabled /> SPU</label>' +
        '<span class="gd-head-tools"><button type="button" disabled>默认视图</button>' +
        '<button type="button" disabled>卡片设计</button></span></div>' +
        '<div class="gd-metrics">' +
        cards +
        '<article class="gd-card gd-add" aria-hidden="true">+</article></div>' +
        tableHtml(payload.goodsTable);
    }

    board.addEventListener("click", function (event) {
      const rangeBtn = event.target.closest("button[data-range]");
      if (rangeBtn && payload) {
        payload.range = rangeBtn.getAttribute("data-range");
        render();
      }
    });

    fetch("/api/data/goods/board", {
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
        return fetch("/data/goods-demo.json", { credentials: "same-origin" }).then(function (res) {
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

  window.XmDataCreateGoodsDashboard = createGoodsDashboard;

  const goodsModule = {
    mount: function (root) {
      return createGoodsDashboard(root);
    }
  };

  try {
    Object.defineProperty(window.XmModules, "/data/goods", {
      configurable: true,
      enumerable: true,
      get: function () {
        return goodsModule;
      },
      set: function () {}
    });
  } catch (_err) {
    window.XmModules["/data/goods"] = goodsModule;
  }

  const existingBoard = document.getElementById("board");
  if (existingBoard && /\/data\/goods\/?$/.test(location.pathname)) {
    createGoodsDashboard(existingBoard.closest(".xm-page") || document.body);
  }
})();
