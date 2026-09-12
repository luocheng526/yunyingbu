(function () {
  const items = [
    { href: "/data/overview", label: "数据总揽" },
    { href: "/data/shops", label: "店铺数据" },
    { href: "/data/goods", label: "商品数据" },
    { href: "/data/paid", label: "实时看板" }
  ];
  const current = window.location.pathname.replace(/\/+$/, "") || "/";
  const root = document.getElementById("data-subnav");
  if (!root) {
    return;
  }
  function isActive(href) {
    if (current === href) {
      return true;
    }
    if (href === "/data/shops" && current.indexOf("/data/stores") === 0) {
      return true;
    }
    if (href === "/data/goods" && current.indexOf("/data/goods") === 0) {
      return true;
    }
    if (href === "/data/paid" && current === "/data/stores/live") {
      return true;
    }
    return false;
  }
  root.setAttribute("aria-label", "数据中心子菜单");
  root.innerHTML = items
    .map(function (item) {
      const active = isActive(item.href);
      return (
        '<a href="' +
        item.href +
        '"' +
        (active ? ' aria-current="page" class="is-active"' : "") +
        ">" +
        item.label +
        "</a>"
      );
    })
    .join("");
})();
