/* xm-module-stores 0.1.146 */
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
          '<header class="page-head"><p class="kicker">店铺维护中心</p><h1>' +
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
  window.XmModules["/stores"] = waitPage("店铺维护中心", "店铺维护工作台待独立对话框写入。内容挂在本页 #xm-content。");
})();
