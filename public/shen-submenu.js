(function () {
  var ITEMS = [
    { href: "/shen/product", label: "产品中心" },
    { href: "/shen/paid", label: "付费中心" },
    { href: "/shen/training", label: "培训系统" },
    { href: "/shen/tasks", label: "任务管理" }
  ];
  var RETIRED = {
    "/shen/selection": "/shen/product",
    "/shen/growth": "/shen/product"
  };
  var TITLE_FIX = {
    选品中心: "产品中心",
    商品成长: "产品中心",
    实时付费: "付费中心"
  };

  function pathNow() {
    return String(location.pathname || "/").replace(/\/+$/, "") || "/";
  }

  function officialGroup() {
    return document.querySelector('.xm-menu-group[data-xm-group="/shen"]');
  }

  function currentHref() {
    var path = pathNow();
    return RETIRED[path] || path;
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
    if (text.indexOf("选品中心") === -1 && text.indexOf("商品成长") === -1 && text.indexOf("实时付费") === -1) {
      if (text.indexOf("产品中心") !== -1 && text.indexOf("付费中心") !== -1 && text.indexOf("选品") === -1) {
        return;
      }
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

  function rewriteFallback() {
    var box = document.querySelector(".shen-nav-sub");
    if (!box) {
      return;
    }
    var text = box.textContent || "";
    if (text.indexOf("选品中心") === -1 && text.indexOf("商品成长") === -1 && text.indexOf("实时付费") === -1) {
      return;
    }
    var activeHref = currentHref();
    box.innerHTML = ITEMS.map(function (item) {
      var active = item.href === activeHref;
      return (
        '<a href="' +
        item.href +
        '"' +
        (active ? ' aria-current="page"' : "") +
        ">" +
        item.label +
        "</a>"
      );
    }).join("");
  }

  function relabelHeadings() {
    var nodes = document.querySelectorAll("h1, title, .page-head h1");
    for (var i = 0; i < nodes.length; i += 1) {
      var node = nodes[i];
      var raw = (node.textContent || "").trim();
      if (TITLE_FIX[raw]) {
        if (node.tagName === "TITLE") {
          node.textContent = raw.replace(raw, TITLE_FIX[raw]) + " · 沈子晗运营中心";
        } else {
          node.textContent = TITLE_FIX[raw];
        }
      }
    }
    if (TITLE_FIX[document.title]) {
      document.title = TITLE_FIX[document.title] + " · 沈子晗运营中心";
    } else {
      Object.keys(TITLE_FIX).forEach(function (oldLabel) {
        if (document.title.indexOf(oldLabel) === 0) {
          document.title = document.title.replace(oldLabel, TITLE_FIX[oldLabel]);
        }
      });
    }
  }

  function redirectRetired() {
    var dest = RETIRED[pathNow()];
    if (dest && dest !== pathNow()) {
      location.replace(dest);
    }
  }

  function apply() {
    redirectRetired();
    var group = officialGroup();
    if (group) {
      rewriteOfficial(group);
    }
    rewriteFallback();
    relabelHeadings();
  }

  document.addEventListener(
    "click",
    function (event) {
      var link = event.target.closest("a[href]");
      if (!link) {
        return;
      }
      var href = String(link.getAttribute("href") || "").replace(/\/+$/, "") || "/";
      if (RETIRED[href]) {
        event.preventDefault();
        location.assign(RETIRED[href]);
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
