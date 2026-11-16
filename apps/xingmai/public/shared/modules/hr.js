/* xm-module-hr 0.1.113 */
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
          '<header class="page-head"><p class="kicker">智能人事</p><h1>' +
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
  window.XmModules["/hr"] = waitPage("智能人事", "人事工作台待独立对话框写入。内容挂在本页 #xm-content。");
})();
