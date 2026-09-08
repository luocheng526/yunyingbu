export const NAV_VERSION = "v0.4.4";

export const NAV_MAIN = [
  { href: "/", file: "index.html", label: "首页" },
  { href: "/data", file: "data.html", label: "数据中心" },
  { href: "/shen", file: "shen.html", label: "沈子晗运营中心" },
  { href: "/han", file: "han.html", label: "韩梦凯运营中心" },
  { href: "/people", file: "people.html", label: "人员管理" }
];

export const NAV_FOOT = [
  { href: "/releases", file: "releases.html", label: "版本发布中心" },
  { href: "/me", file: "me.html", label: "个人中心" }
];

export const NAV_ITEMS = [...NAV_MAIN, ...NAV_FOOT];

function itemLink(item, activeHref) {
  const current = item.href === activeHref ? ' aria-current="page"' : "";
  const active = item.href === activeHref ? " is-active" : "";
  return `<a class="xm-menu-item${active}" href="${item.href}"${current}><i class="xm-ico" aria-hidden="true"></i><span>${item.label}</span></a>`;
}

export function navMarkup(activeHref) {
  const main = NAV_MAIN.map((item) => itemLink(item, activeHref)).join("");
  const foot = NAV_FOOT.map((item) => itemLink(item, activeHref)).join("");
  return `<aside class="xm-sider" aria-label="侧栏导航"><div class="xm-brand"><a class="xm-logo" href="/"><img src="/shared/xingmai-logo.png" alt="星脉甄选" /></a><button type="button" class="xm-collapse" id="xm-collapse" aria-label="折叠侧栏">‹</button></div><nav class="xm-menu xm-menu-main"><p class="xm-menu-label">项目</p>${main}</nav><nav class="xm-menu xm-menu-foot">${foot}<button type="button" class="xm-menu-item xm-logout" id="xm-logout"><i class="xm-ico" aria-hidden="true"></i><span>退出登录</span></button><p class="xm-version">${NAV_VERSION}</p></nav></aside>`;
}
