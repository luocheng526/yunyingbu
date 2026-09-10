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
      link.href = "/data-pages.css";
      document.head.appendChild(link);
    }
  }

  function stripPageChrome(root) {
    Array.prototype.forEach.call(root.querySelectorAll(".kicker, .data-subnav"), function (el) {
      el.remove();
    });
    Array.prototype.forEach.call(root.querySelectorAll("h1"), function (el) {
      if (/数据总揽|渠道总览/.test(el.textContent.trim())) {
        el.remove();
      }
    });
  }

  function sparkSvg(points) {
    const vals = points && points.length ? points : [20, 24, 22, 30, 28, 36];
    const w = 120;
    const h = 36;
    const min = Math.min.apply(null, vals);
    const max = Math.max.apply(null, vals);
    const span = max - min || 1;
    const d = vals
      .map(function (v, i) {
        const x = (i / (vals.length - 1)) * w;
        const y = h - ((v - min) / span) * (h - 4) - 2;
        return (i === 0 ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1);
      })
      .join(" ");
    return (
      '<svg class="ch-spark" viewBox="0 0 ' +
      w +
      " " +
      h +
      '" aria-hidden="true"><path d="' +
      d +
      '" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>'
    );
  }

  function tableHtml(block) {
    const head =
      "<tr>" +
      block.columns
        .map(function (col) {
          return "<th>" + escapeHtml(col) + "</th>";
        })
        .join("") +
      "</tr>";
    const body = (block.rows || [])
      .map(function (row) {
        return (
          "<tr><td>" +
          escapeHtml(row.name) +
          "</td>" +
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
      '<section class="ch-table">' +
      '<div class="ch-table-bar"><strong>' +
      escapeHtml(block.title) +
      '</strong><label class="ch-zero"><input type="checkbox" disabled /> 显示零</label>' +
      '<span class="ch-tools">打标 · 目标 · 列表 · 周期 · 图表 · 个人视图 · 更多数据 · 导出</span></div>' +
      '<div class="ch-table-wrap"><table><thead>' +
      head +
      "</thead><tbody>" +
      body +
      "</tbody></table></div></section>"
    );
  }

  function frameHtml() {
    return '<main class="xm-page data-overview-root ch-root"><div id="board"></div></main>';
  }

  function createDashboard(root) {
    ensureCss();
    stripPageChrome(root);
    let board = root.querySelector("#board");
    if (!board) {
      root.innerHTML = frameHtml();
      board = root.querySelector("#board");
    }
    let payload = null;
    let section = "渠道列表";
    let dead = false;

    function render() {
      if (dead || !payload || !board) {
        return;
      }
      const hero = payload.hero || {};
      const down = Number(hero.delta) < 0;
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
      const tabs = (payload.sections || [])
        .map(function (name) {
          return (
            '<button type="button" data-section="' +
            escapeHtml(name) +
            '"' +
            (name === section ? ' class="is-active"' : "") +
            ">" +
            escapeHtml(name) +
            "</button>"
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
      const lists =
        section === "渠道列表"
          ? tableHtml(payload.channelTable) + tableHtml(payload.shopTable)
          : '<p class="ch-empty">「' + escapeHtml(section) + "」为示例，尚未接入。</p>";
      board.innerHTML =
        '<div class="ch-top"><div class="ch-title">渠道总览</div>' +
        '<div class="ch-time">统计时间：' +
        escapeHtml(payload.dateLabel || "") +
        "</div>" +
        '<div class="ch-ranges">' +
        ranges +
        "</div></div>" +
        '<div class="ch-summary"><span>综合指标</span><b>渠道 ' +
        escapeHtml(payload.summary.channels) +
        "个</b><b>店铺 " +
        escapeHtml(payload.summary.shops) +
        '个</b><button type="button" class="ch-set" disabled>设定指标</button></div>' +
        '<div class="ch-metrics"><article class="ch-card ch-hero"><div class="label">' +
        escapeHtml(hero.label || "实时销售指数") +
        "</div>" +
        sparkSvg(hero.spark) +
        '<div class="value">' +
        escapeHtml(hero.value || "") +
        '</div><div class="delta ' +
        (down ? "is-down" : "is-up") +
        '">' +
        (down ? "↓ " : "↑ ") +
        escapeHtml(Math.abs(Number(hero.delta || 0))) +
        "%</div></article>" +
        cards +
        "</div>" +
        '<div class="ch-tabs">' +
        tabs +
        "</div>" +
        lists;
    }

    board.addEventListener("click", function (event) {
      const rangeBtn = event.target.closest("button[data-range]");
      if (rangeBtn && payload) {
        payload.range = rangeBtn.getAttribute("data-range");
        render();
        return;
      }
      const secBtn = event.target.closest("button[data-section]");
      if (secBtn) {
        section = secBtn.getAttribute("data-section");
        render();
      }
    });

    fetch("/api/data/team", {
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
        return fetch("/data/team-demo.json", { credentials: "same-origin" }).then(function (res) {
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

  window.XmDataCreateDashboard = createDashboard;

  const teamModule = {
    mount: function (root) {
      return createDashboard(root);
    }
  };

  try {
    Object.defineProperty(window.XmModules, "/data/overview", {
      configurable: true,
      enumerable: true,
      get: function () {
        return teamModule;
      },
      set: function () {}
    });
  } catch (_err) {
    window.XmModules["/data/overview"] = teamModule;
  }

  const existingBoard = document.getElementById("board");
  if (existingBoard) {
    createDashboard(existingBoard.closest(".xm-page") || document.body);
  }
})();
