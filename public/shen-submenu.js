(function () {
  var LABEL_BY_HREF = {
    "/shen/selection": "产品中心",
    "/shen/product": "产品中心",
    "/shen/paid": "付费中心"
  };
  var EMBED = {
    "/shen/product": "/shen/selection",
    "/shen/growth": "/shen/selection"
  };

  function leafHref(href) {
    return String(href || "/").replace(/\/+$/, "") || "/";
  }

  function relabel() {
    var group = document.querySelector('.xm-menu-group[data-xm-group="/shen"]');
    if (group) {
      var links = group.querySelectorAll("a[href]");
      for (var i = 0; i < links.length; i += 1) {
        var a = links[i];
        var href = leafHref(a.getAttribute("href"));
        var span = a.querySelector("span");
        if (href === "/shen/growth") {
          a.hidden = true;
          a.style.display = "none";
          continue;
        }
        if (LABEL_BY_HREF[href] && span && span.textContent !== LABEL_BY_HREF[href]) {
          span.textContent = LABEL_BY_HREF[href];
        }
      }
    }
    var tabs = document.querySelectorAll(".xm-tab-label");
    for (var t = 0; t < tabs.length; t += 1) {
      var label = (tabs[t].textContent || "").trim();
      if (label === "选品中心") {
        tabs[t].textContent = "产品中心";
      } else if (label === "实时付费") {
        tabs[t].textContent = "付费中心";
      }
    }
  }

  document.addEventListener(
    "click",
    function (event) {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button) {
        return;
      }
      var link = event.target.closest("a[href]");
      if (!link || typeof window.__xmGo !== "function") {
        return;
      }
      var href = leafHref(link.getAttribute("href"));
      if (!/^\/shen\/(selection|product|growth|paid|training|tasks)$/.test(href)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      window.__xmGo(EMBED[href] || href, true);
    },
    true
  );

  function boot() {
    if (leafHref(location.pathname) === "/shen/product" && typeof window.__xmGo === "function") {
      history.replaceState({ xm: "/shen/selection" }, "", "/shen/selection");
      window.__xmGo("/shen/selection", false);
    }
    relabel();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  var timer = 0;
  var observer = new MutationObserver(function () {
    window.clearTimeout(timer);
    timer = window.setTimeout(relabel, 30);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
