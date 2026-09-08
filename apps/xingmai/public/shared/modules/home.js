/* xm-module-home 0.1.65 */
(function () {
  window.XmModules = window.XmModules || {};
  window.XmModules["/"] = {
    mount: function (root) {
      root.innerHTML =
        '<main class="page">' +
        '<header class="page-head">' +
        '<p class="kicker">星脉</p>' +
        "<h1>工作台</h1>" +
        "</header>" +
        '<p class="empty">待开发</p>' +
        "</main>";
      return function unmount() {
        root.innerHTML = "";
      };
    }
  };
})();
