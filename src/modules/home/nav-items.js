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
    return `<a class="xm-menu-item" href="${item.href}"${current}><span>${item.label}</span></a>`;
  }).join("");
  return `<aside class="xm-sider" aria-label="侧栏导航"><a class="xm-logo" href="/"><span class="xm-logo-mark">星</span><span class="xm-logo-text">星脉管理系统</span></a><nav class="xm-menu">${links}</nav></aside>`;
}
