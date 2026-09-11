(function () {
  const items = [
    { href: "/", label: "首页" },
    { href: "/data", label: "数据中心" },
    { href: "/shen", label: "沈子晗运营中心" },
    { href: "/han", label: "韩梦凯运营中心" },
    { href: "/people", label: "人员管理" },
    { href: "/releases", label: "版本发布中心" },
    { href: "/me", label: "个人中心" }
  ];

  const current = window.location.pathname.replace(/\/+$/, "") || "/";

  function isActive(href) {
    const normalized = href.replace(/\/+$/, "") || "/";
    return current === normalized;
  }

  const header = document.createElement("header");
  header.className = "site-header";
  header.innerHTML =
    '<div class="site-header__inner">' +
    '<a class="site-brand" href="/">运营部</a>' +
    '<nav class="site-nav" aria-label="全站导航">' +
    items
      .map(function (item) {
        const currentAttr = isActive(item.href) ? ' aria-current="page"' : "";
        return '<a href="' + item.href + '"' + currentAttr + ">" + item.label + "</a>";
      })
      .join("") +
    "</nav></div>";

  const mount = document.getElementById("site-nav");
  if (mount) {
    mount.replaceWith(header);
  } else {
    document.body.insertBefore(header, document.body.firstChild);
  }
})();
