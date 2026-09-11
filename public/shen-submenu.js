(function () {
  var ITEMS = [
    { href: "/shen/selection", label: "产品中心" },
    { href: "/shen/paid", label: "付费中心" },
    { href: "/shen/training", label: "培训系统" },
    { href: "/shen/tasks", label: "任务管理" }
  ];
  var TO_EMBED = {
    "/shen/product": "/shen/selection",
    "/shen/growth": "/shen/selection"
  };
  var TITLE_FIX = {
    选品中心: "产品中心",
    商品成长: "产品中心",
    实时付费: "付费中心"
  };

  function pathNow() {
    return String(location.pathname || "/").replace(/\/+$/, "") || "/";
  }

  function goEmbed(href, push) {
    if (typeof window.__xmGo === "function") {
      window.__xmGo(href, push);
      return;
    }
    location.assign(href);
  }

  function officialGroup() {
    return document.querySelector('.xm-menu-group[data-xm-group="/shen"]');
  }

  function currentHref() {
    var path = pathNow();
    return TO_EMBED[path] || path;
  }

  function icoHtml(sub) {
    var ico = sub.querySelector(".xm-ico");
    return ico ? ico.outerHTML : "";
  }

  function rewriteOfficial(group) {
    var sub = group.querySelector(".xm-submenu");
    if (!sub) {
      return;
    }
    var text = sub.textContent || "";
    if (
      !sub.querySelector('a[href="/shen/product"]') &&
      text.indexOf("选品中心") === -1 &&
      text.indexOf("商品成长") === -1 &&
      text.indexOf("实时付费") === -1 &&
      text.indexOf("产品中心") !== -1
    ) {
      return;
    }
    var icon = icoHtml(sub);
    var activeHref = currentHref();
    sub.innerHTML = ITEMS.map(function (item) {
      var active = item.href === activeHref;
      return (
        '<a class="xm-menu-item xm-menu-child' +
        (active ? " is-active" : "") +
        '" href="' +
        item.href +
        '"' +
        (active ? ' aria-current="page"' : "") +
        ">" +
        icon +
        "<span>" +
        item.label +
        "</span></a>"
      );
    }).join("");
  }

  function relabelChrome() {
    var nodes = document.querySelectorAll("h1, title, .page-head h1, .xm-tab-label");
    for (var i = 0; i < nodes.length; i += 1) {
      var node = nodes[i];
      var raw = (node.textContent || "").trim();
      if (TITLE_FIX[raw]) {
        node.textContent = TITLE_FIX[raw];
      }
    }
    Object.keys(TITLE_FIX).forEach(function (oldLabel) {
      if (document.title.indexOf(oldLabel) !== -1) {
        document.title = document.title.replace(oldLabel, TITLE_FIX[oldLabel]);
      }
    });
  }

  function bounceStandaloneProduct() {
    if (pathNow() !== "/shen/product") {
      return;
    }
    if (typeof window.__xmGo === "function") {
      history.replaceState({ xm: "/shen/selection" }, "", "/shen/selection");
      window.__xmGo("/shen/selection", false);
    }
  }

  function apply() {
    bounceStandaloneProduct();
    var group = officialGroup();
    if (group) {
      rewriteOfficial(group);
    }
    relabelChrome();
  }

  document.addEventListener(
    "click",
    function (event) {
      var link = event.target.closest("a[href]");
      if (!link) {
        return;
      }
      var href = String(link.getAttribute("href") || "").replace(/\/+$/, "") || "/";
      if (TO_EMBED[href]) {
        event.preventDefault();
        goEmbed(TO_EMBED[href], true);
      }
    },
    true
  );

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", apply);
  } else {
    apply();
  }

  var timer = 0;
  var observer = new MutationObserver(function () {
    window.clearTimeout(timer);
    timer = window.setTimeout(apply, 30);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
