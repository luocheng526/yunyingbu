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
      if (el.textContent.trim() === "数据总揽") {
        el.remove();
      }
    });
  }

  function frameHtml() {
    return (
      '<main class="xm-page data-overview-root">' +
      '<div class="dash-toolbar">' +
      '<div class="dash-tabs" role="tablist" aria-label="数据总揽视图">' +
      '<button type="button" class="is-active" data-view="team">团队</button>' +
      '<button type="button" data-view="rank">排行榜</button>' +
      '<button type="button" class="dash-gear" data-view="settings">卡片设置</button>' +
      "</div><div>" +
      '<div class="dash-ranges" id="ranges" aria-label="时间范围"></div>' +
      '<div class="dash-dates" id="dates"></div></div></div>' +
      '<p class="dash-notice" id="notice">示例数据，尚未接入店铺。</p>' +
      '<div id="board"></div></main>'
    );
  }

  function createDashboard(root) {
    ensureCss();
    stripPageChrome(root);
    let board = root.querySelector("#board");
    if (!board) {
      root.innerHTML = frameHtml();
      board = root.querySelector("#board");
    }
    const rangesEl = root.querySelector("#ranges");
    const datesEl = root.querySelector("#dates");
    const noticeEl = root.querySelector("#notice");
    const tabs = root.querySelector(".dash-tabs");
    let payload = null;
    let view = "team";
    let dead = false;

    function deltaHtml(delta) {
      if (delta === undefined || delta === null) {
        return "";
      }
      const down = Number(delta) < 0;
      const arrow = down ? "↓" : "↑";
      const cls = down ? "is-down" : "is-up";
      return (
        '<div class="delta ' +
        cls +
        '">环比 ' +
        arrow +
        " " +
        escapeHtml(Math.abs(Number(delta))) +
        "%</div>"
      );
    }

    function rankTable(rows, withDelta) {
      const head = withDelta
        ? "<tr><th>排名</th><th>店铺名称</th><th>运营</th><th>实时销售额</th><th>环比</th></tr>"
        : "<tr><th>排名</th><th>店铺名称</th><th>运营</th><th>销售额</th></tr>";
      const body = (rows || [])
        .map(function (row) {
          const deltaCell = withDelta
            ? "<td>" +
              (row.delta < 0 ? "↓ " : row.delta > 0 ? "↑ " : "") +
              escapeHtml(Math.abs(Number(row.delta || 0))) +
              "%</td>"
            : "";
          return (
            "<tr><td>" +
            escapeHtml(row.rank) +
            "</td><td>" +
            escapeHtml(row.store) +
            "</td><td>" +
            escapeHtml(row.owner) +
            "</td><td>" +
            escapeHtml(row.sales) +
            "</td>" +
            deltaCell +
            "</tr>"
          );
        })
        .join("");
      return '<table class="dash-rank"><thead>' + head + "</thead><tbody>" + body + "</tbody></table>";
    }

    function renderMetrics() {
      return (
        '<div class="metric-grid">' +
        payload.cards
          .map(function (card) {
            return (
              '<article class="metric-card"><div class="label">' +
              escapeHtml(card.label) +
              '</div><div class="value">' +
              escapeHtml(card.value) +
              "</div>" +
              deltaHtml(card.delta) +
              "</article>"
            );
          })
          .join("") +
        "</div>"
      );
    }

    function renderSide() {
      const live = payload.liveIndex;
      const hero = payload.heroBoard;
      return (
        '<aside class="dash-side">' +
        '<section class="dash-panel"><div class="dash-panel-head"><h2>' +
        escapeHtml(live.title) +
        '</h2><div class="dash-time">' +
        escapeHtml(live.time) +
        '</div></div><div class="dash-total">' +
        escapeHtml(live.total) +
        "</div><p class=\"dash-notice\">" +
        escapeHtml(live.group) +
        "</p>" +
        rankTable(live.rows, true) +
        "</section>" +
        '<section class="dash-panel"><h2>' +
        escapeHtml(hero.title) +
        "</h2>" +
        rankTable(hero.rows, false) +
        "</section></aside>"
      );
    }

    function renderSettings() {
      return (
        '<section class="dash-panel dash-settings"><p class="dash-notice">卡片设置为示例，尚未接入。</p>' +
        payload.cards
          .map(function (card) {
            return (
              "<label><input type=\"checkbox\" checked disabled /> " +
              escapeHtml(card.label) +
              "</label>"
            );
          })
          .join("") +
        "</section>"
      );
    }

    function render() {
      if (dead || !payload || !board) {
        return;
      }
      if (view === "settings") {
        board.innerHTML = renderSettings();
        return;
      }
      if (view === "rank") {
        board.innerHTML = '<div class="dash-layout"><div>' + renderSide() + "</div></div>";
        return;
      }
      board.innerHTML = '<div class="dash-layout">' + renderMetrics() + renderSide() + "</div>";
    }

    if (tabs) {
      tabs.addEventListener("click", function (event) {
        const btn = event.target.closest("button[data-view]");
        if (!btn) {
          return;
        }
        view = btn.getAttribute("data-view");
        tabs.querySelectorAll("button").forEach(function (el) {
          el.classList.toggle("is-active", el === btn);
        });
        render();
      });
    }

    function applyPayload(data) {
      if (dead) {
        return;
      }
      payload = data;
      if (noticeEl) {
        noticeEl.textContent = data.notice || "示例数据，尚未接入店铺。";
      }
      if (datesEl) {
        datesEl.textContent = (data.dateFrom || "") + " 至 " + (data.dateTo || "");
      }
      if (rangesEl) {
        rangesEl.innerHTML = (data.ranges || [])
          .map(function (label) {
            const active = label === data.range ? " is-active" : "";
            return (
              '<button type="button" class="' +
              active.trim() +
              '" data-range="' +
              escapeHtml(label) +
              '">' +
              escapeHtml(label) +
              "</button>"
            );
          })
          .join("");
        rangesEl.onclick = function (event) {
          const btn = event.target.closest("button[data-range]");
          if (!btn) {
            return;
          }
          rangesEl.querySelectorAll("button").forEach(function (el) {
            el.classList.toggle("is-active", el === btn);
          });
        };
      }
      render();
    }

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
      .then(applyPayload)
      .catch(function () {
        return fetch("/data/team-demo.json", { credentials: "same-origin" }).then(function (res) {
          if (!res.ok) {
            throw new Error("示例数据 " + res.status);
          }
          return res.json();
        });
      })
      .then(function (data) {
        if (data && !payload) {
          applyPayload(data);
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
      set: function () {
        /* homepage waitPage must not replace the team dashboard */
      }
    });
  } catch (_err) {
    window.XmModules["/data/overview"] = teamModule;
  }

  const existingBoard = document.getElementById("board");
  if (existingBoard) {
    createDashboard(existingBoard.closest(".xm-page") || document.body);
  }
})();
