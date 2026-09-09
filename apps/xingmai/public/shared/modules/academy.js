/* xm-module-academy 0.1.111 */
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
          '<header class="page-head"><p class="kicker">甄选商学院</p><h1>' +
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
  window.XmModules["/academy"] = waitPage("甄选商学院", "运营培训知识库待独立对话框写入。内容挂在本页 #xm-content。");
  window.XmModules["/academy/courses"] = waitPage("培训课程", "课程目录待写入。");
  window.XmModules["/academy/exams"] = waitPage("培训考试", "考试内容待写入。");
  window.XmModules["/academy/handbook"] = waitPage("运营手册", "手册内容待写入。");
})();
