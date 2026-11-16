/* xm-module-bound 0.1.772-bound — 边界数据中心，爬虫汇总，非 ERP */
(function () {
  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function waitPage(title, lead) {
    return {
      mount: function (root) {
        root.innerHTML =
          '<main class="page">' +
          '<header class="page-head"><p class="kicker">边界数据中心</p><h1>' +
          escapeHtml(title) +
          "</h1>" +
          '<p class="lead">' +
          escapeHtml(lead) +
          "</p></header></main>";
        return function unmount() {
          root.innerHTML = "";
        };
      }
    };
  }

  window.XmModules = window.XmModules || {};
  window.XmModules["/bound"] = waitPage(
    "爬虫数据汇总",
    "这里汇总爬虫数据，不是星脉 ERP。独立数据接口后续接入。内容挂在本页 #xm-content。"
  );
})();
