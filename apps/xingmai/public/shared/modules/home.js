/* xm-module-home 0.1.112 */
(function () {
  function waitPage(title, lead) {
    return {
      mount: function (root) {
        root.innerHTML =
          '<main class="page">' +
          '<header class="page-head"><p class="kicker">首页</p><h1>' +
          title +
          "</h1>" +
          '<p class="lead">' +
          lead +
          "</p></header></main>";
        return function unmount() {
          root.innerHTML = "";
        };
      }
    };
  }

  window.XmModules = window.XmModules || {};
  window.XmModules["/home"] = waitPage("首页", "功能待开发。");
  window.XmModules["/"] = window.XmModules["/home"];
})();
