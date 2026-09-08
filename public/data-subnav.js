(function () {
  const items = [
    { href: "/data/stores/live", label: "店铺实时数据" },
    { href: "/data/stores/overview", label: "店铺数据总揽" },
    { href: "/data/goods/overview", label: "商品数据总揽" },
    { href: "/data/placeholder", label: "占位" }
  ];
  const current = window.location.pathname.replace(/\/+$/, "") || "/";
  const root = document.getElementById("data-subnav");
  if (!root) {
    return;
  }
  root.setAttribute("aria-label", "数据中心子菜单");
  root.innerHTML = items
    .map(function (item) {
      const active = current === item.href;
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
