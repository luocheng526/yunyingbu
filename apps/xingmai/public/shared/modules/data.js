/* xm-module-data 0.1.65 */
(function () {
  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
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
  window.XmModules["/data/shops"] = waitPage("店铺数据");
  window.XmModules["/data/goods"] = waitPage("商品数据");
  window.XmModules["/data/paid"] = waitPage("实时付费");

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
