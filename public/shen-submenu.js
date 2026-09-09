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

  function isShenPath(pathname) {
    return pathname === "/shen" || pathname.indexOf("/shen/") === 0;
  }

  function isActive(href, pathname) {
    const normalized = href.replace(/\/+$/, "") || "/";
    return pathname === normalized;
  }

  function findShenLink(root) {
    const links = root.querySelectorAll("a[href]");
    for (let i = 0; i < links.length; i += 1) {
      const href = String(links[i].getAttribute("href") || "").replace(/\/+$/, "") || "/";
      if (href === "/shen") {
        return links[i];
      }
    }
    return null;
  }

  function enhance(nav) {
    if (!nav || nav.querySelector(".shen-nav-group")) {
      return;
    }
    const parentLink = findShenLink(nav);
    if (!parentLink) {
      return;
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
      link.href = item.href;
      link.textContent = item.label;
      if (isActive(item.href, pathname)) {
        link.setAttribute("aria-current", "page");
      }
      sub.appendChild(link);
    });

    function setOpen(open) {
      group.classList.toggle("is-open", open);
      arrow.setAttribute("aria-expanded", open ? "true" : "false");
    }

    parentLink.addEventListener("click", function (event) {
      if (!group.classList.contains("is-open")) {
        event.preventDefault();
        setOpen(true);
      }
    });

    arrow.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(!group.classList.contains("is-open"));
    });

    parentLink.replaceWith(group);
    parentRow.appendChild(parentLink);
    parentRow.appendChild(arrow);
    group.appendChild(parentRow);
    group.appendChild(sub);
  }

  function run() {
    const nav = document.querySelector(".site-nav") || document.querySelector("nav[aria-label='全站导航']");
    enhance(nav);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
