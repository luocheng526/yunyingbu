export const NAV_ITEMS = [
  { href: "/", file: "index.html", label: "首页" },
  { href: "/data", file: "data.html", label: "数据中心" },
  { href: "/shen", file: "shen.html", label: "沈子晗运营中心" },
  { href: "/han", file: "han.html", label: "韩梦凯运营中心" },
  { href: "/people", file: "people.html", label: "人员管理" },
  { href: "/releases", file: "releases.html", label: "版本发布中心" },
  { href: "/me", file: "me.html", label: "个人中心" }
];

export function navMarkup(activeHref) {
  const links = NAV_ITEMS.map((item) => {
    const current = item.href === activeHref ? ' aria-current="page"' : "";
    return `<a href="${item.href}"${current}>${item.label}</a>`;
  }).join("");
  return `<header class="site-header"><div class="site-header__inner"><a class="site-brand" href="/">运营部</a><nav class="site-nav" aria-label="全站导航">${links}</nav></div></header>`;
}
