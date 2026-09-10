/* xm-module-home 0.1.123 */
(function () {
  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function openNotice(id) {
    if (typeof window.__xmGo === "function") {
      window.__xmGo("/notices");
    } else {
      window.location.assign("/notices");
    }
    if (!id) {
      return;
    }
    window.setTimeout(function () {
      const row = document.querySelector('.notice-row[data-id="' + id + '"]');
      if (row) {
        row.click();
      }
    }, 400);
  }

  window.XmModules = window.XmModules || {};
  window.XmModules["/home"] = {
    mount: function (root) {
      root.innerHTML =
        '<main class="page home-page">' +
        '<header class="page-head"><p class="kicker">首页</p><h1>首页</h1>' +
        '<p class="lead">公告栏点进去是公告中心的正文。工作台功能待开发。</p></header>' +
        '<section class="panel home-notice-panel">' +
        "<h2>公告栏</h2>" +
        '<div id="home-notice-list" class="home-notice-list">正在读取公告…</div>' +
        "</section></main>";

      const box = root.querySelector("#home-notice-list");
      fetch("/api/notices/banner", { credentials: "same-origin" })
        .then(function (res) {
          return res.ok ? res.json() : { items: [] };
        })
        .then(function (data) {
          const items = data.items || [];
          if (!items.length) {
            box.innerHTML = '<p class="lead">暂无公告。到组织中心 · 公告中心发布。</p>';
            return;
          }
          box.innerHTML = items
            .map(function (item) {
              return (
                '<button type="button" class="home-notice-item" data-id="' +
                escapeHtml(item.id) +
                '"><strong>' +
                escapeHtml(item.title) +
                "</strong><span>" +
                escapeHtml(item.summary || "") +
                "</span></button>"
              );
            })
            .join("");
        })
        .catch(function () {
          box.innerHTML = '<p class="lead">公告暂时读不到。</p>';
        });

      box.addEventListener("click", function (event) {
        const btn = event.target.closest("[data-id]");
        if (btn) {
          openNotice(btn.getAttribute("data-id"));
        }
      });

      return function unmount() {
        root.innerHTML = "";
      };
    }
  };
  window.XmModules["/"] = window.XmModules["/home"];
})();
