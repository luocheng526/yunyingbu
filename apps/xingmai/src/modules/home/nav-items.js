export const NAV_VERSION = "v0.4.5";

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

const ICO_PATH = {
  "/": '<path d="M4 11 12 4l8 7"/><path d="M6 10.5V20h4.2v-5.2h3.6V20H18v-9.5"/>',
  "/data": '<path d="M5 19V10"/><path d="M10 19V6"/><path d="M15 19v-7"/><path d="M20 19V8"/>',
  "/shen": '<rect x="6" y="4" width="12" height="16" rx="2"/><path d="M9 9h6"/><path d="M9 13h6"/><path d="M9 17h4"/>',
  "/han": '<path d="M8 11.5 12 5l4 6.5"/><path d="M6.5 13h11l-1.2 6H7.7z"/>',
  "/people": '<circle cx="9" cy="8" r="2.2"/><path d="M4.8 18c.4-2.4 2.2-3.8 4.2-3.8s3.8 1.4 4.2 3.8"/><circle cx="16.2" cy="8.4" r="1.8"/><path d="M15 14.4c1.7.2 3 1.3 3.4 3.1"/>',
  "/releases": '<path d="M12 4v10"/><path d="M8.5 7.5 12 4l3.5 3.5"/><rect x="6" y="14" width="12" height="6" rx="1"/>',
  "/me": '<circle cx="12" cy="8" r="2.6"/><path d="M6.2 18.5c.6-2.8 2.8-4.3 5.8-4.3s5.2 1.5 5.8 4.3"/>',
  logout: '<path d="M10 7V5.8A1.8 1.8 0 0 1 11.8 4h6.4A1.8 1.8 0 0 1 20 5.8v12.4a1.8 1.8 0 0 1-1.8 1.8h-6.4A1.8 1.8 0 0 1 10 18.2V17"/><path d="M4 12h10"/><path d="M11.2 8.8 14.4 12l-3.2 3.2"/>'
};

function ico(name) {
  const path = ICO_PATH[name] || ICO_PATH["/"];
  return `<i class="xm-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg></i>`;
}

function itemLink(item, activeHref) {
  const current = item.href === activeHref ? ' aria-current="page"' : "";
  const active = item.href === activeHref ? " is-active" : "";
  return `<a class="xm-menu-item${active}" href="${item.href}"${current}>${ico(item.href)}<span>${item.label}</span></a>`;
}

export function navMarkup(activeHref) {
  const main = NAV_MAIN.map((item) => itemLink(item, activeHref)).join("");
  const foot = NAV_FOOT.map((item) => itemLink(item, activeHref)).join("");
  return `<aside class="xm-sider" aria-label="侧栏导航"><div class="xm-brand"><a class="xm-logo" href="/"><img src="/shared/xingmai-logo.png?v=0.1.82" alt="星脉甄选" /></a><button type="button" class="xm-collapse" id="xm-collapse" aria-label="折叠侧栏">‹</button></div><nav class="xm-menu xm-menu-main"><p class="xm-menu-label">项目</p>${main}</nav><nav class="xm-menu xm-menu-foot">${foot}<button type="button" class="xm-menu-item xm-logout" id="xm-logout">${ico("logout")}<span>退出登录</span></button><p class="xm-version">${NAV_VERSION}</p></nav></aside>`;
}
