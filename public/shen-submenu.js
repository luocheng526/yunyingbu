(function () {
  const ITEMS = [
    { href: "/shen/xuanpin", label: "选品中心" },
    { href: "/shen/chengzhang", label: "商品成长" },
    { href: "/shen/fufei", label: "实时付费" },
    { href: "/shen/peixun", label: "培训系统" },
    { href: "/shen/renwu", label: "任务管理" }
  ];

  function currentPath() {
    return window.location.pathname.replace(/\/+$/, "") || "/";
  }

  function normalize(href) {
    return String(href || "/").replace(/\/+$/, "") || "/";
  }

  function isShenPath(pathname) {
    return pathname === "/shen" || pathname.indexOf("/shen/") === 0;
  }

  function findShenLink() {
    const official = document.querySelector('.xm-menu a[href="/shen"], .xm-menu a[href="/shen/"]');
    if (official) {
      return official;
    }
    const fallbacks = document.querySelectorAll("a[href='/shen'], a[href='/shen/']");
    return fallbacks[0] || null;
  }

  function setOpen(group, arrow, open) {
    group.classList.toggle("is-open", open);
    if (arrow) {
      arrow.setAttribute("aria-expanded", open ? "true" : "false");
    }
  }

  function enhance() {
    if (document.querySelector(".shen-nav-group")) {
      return true;
    }
    const parentLink = findShenLink();
    if (!parentLink) {
      return false;
    }

    const pathname = currentPath();
    const group = document.createElement("div");
    group.className = "shen-nav-group" + (isShenPath(pathname) ? " is-open" : "");

    const parentRow = document.createElement("div");
    parentRow.className = "shen-nav-parent";

    const arrow = document.createElement("button");
    arrow.type = "button";
    arrow.className = "shen-nav-arrow";
    arrow.setAttribute("aria-expanded", isShenPath(pathname) ? "true" : "false");
    arrow.setAttribute("aria-label", "展开或收起沈子晗子菜单");
    arrow.textContent = "▼";

    const sub = document.createElement("div");
    sub.className = "shen-nav-sub";
    ITEMS.forEach(function (item) {
      const link = document.createElement("a");
      link.className = "xm-menu-item shen-sub-item";
      link.href = item.href;
      link.innerHTML = "<span>" + item.label + "</span>";
      if (normalize(item.href) === pathname) {
        link.classList.add("is-active");
        link.setAttribute("aria-current", "page");
      }
      sub.appendChild(link);
    });

    parentLink.addEventListener(
      "click",
      function (event) {
        if (!group.classList.contains("is-open")) {
          event.preventDefault();
          event.stopImmediatePropagation();
          setOpen(group, arrow, true);
        }
      },
      true
    );

    arrow.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(group, arrow, !group.classList.contains("is-open"));
    });

    parentLink.replaceWith(group);
    parentRow.appendChild(parentLink);
    parentRow.appendChild(arrow);
    group.appendChild(parentRow);
    group.appendChild(sub);
    if (isShenPath(pathname)) {
      parentLink.classList.add("is-active");
    }
    return true;
  }

  function boot() {
    if (enhance()) {
      return;
    }
    let tries = 0;
    const timer = setInterval(function () {
      tries += 1;
      if (enhance() || tries > 40) {
        clearInterval(timer);
      }
    }, 50);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
