(function () {
  function officialShenMenu() {
    return document.querySelector('.xm-menu-group[data-xm-group="/shen"]');
  }

  function boot() {
    if (officialShenMenu()) {
      return;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
