export const NAV_VERSION = "v0.4.18";

export const DATA_CHILDREN = [
  { href: "/data/overview", label: "数据总揽" },
  { href: "/data/shops", label: "店铺数据" },
  { href: "/data/goods", label: "商品数据" },
  { href: "/data/paid", label: "实时付费" }
];

export const SHEN_CHILDREN = [
  { href: "/shen/selection", label: "选品中心" },
  { href: "/shen/growth", label: "商品成长" },
  { href: "/shen/paid", label: "实时付费" },
  { href: "/shen/training", label: "培训系统" },
  { href: "/shen/tasks", label: "任务管理" }
];

export const HAN_CHILDREN = [
  { href: "/han/selection", label: "选品数据" },
  { href: "/han/goods", label: "商品数据" },
  { href: "/han/paid", label: "实时付费" },
  { href: "/han/training", label: "培训系统" }
];

export const ACADEMY_CHILDREN = [
  { href: "/academy/courses", label: "培训课程" },
  { href: "/academy/exams", label: "培训考试" },
  { href: "/academy/handbook", label: "运营手册" }
];

export const NAV_MAIN = [
  { href: "/home", label: "首页" },
  { href: "/data", label: "数据中心", children: DATA_CHILDREN },
  { href: "/shen", label: "沈子晗运营中心", children: SHEN_CHILDREN },
  { href: "/han", label: "韩梦凯运营中心", children: HAN_CHILDREN },
  { href: "/academy", label: "甄选商学院", children: ACADEMY_CHILDREN },
  { href: "/agents", file: "agents.html", label: "甄选智能体" }
];

export const NAV_FOOT = [
  { href: "/releases", file: "releases.html", label: "版本发布中心" },
  { href: "/people", file: "people.html", label: "组织中心" },
  { href: "/me", file: "me.html", label: "个人中心" }
];

function flatten(items) {
  const out = [];
  for (const item of items) {
    if (item.children && item.children.length) {
      out.push(...item.children);
    } else {
      out.push(item);
    }
  }
  return out;
}

export const NAV_ITEMS = [...flatten(NAV_MAIN), ...NAV_FOOT];

const ICO_PATH = {
  "/home": '<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10.8V20h4.2v-5.2h3.6V20H18v-9.2"/>',
  "/data": '<path d="M5 19V10"/><path d="M10 19V6"/><path d="M15 19v-7"/><path d="M20 19V8"/>',
  "/shen": '<rect x="6" y="4" width="12" height="16" rx="2"/><path d="M9 9h6"/><path d="M9 13h6"/><path d="M9 17h4"/>',
  "/han": '<path d="M8 11.5 12 5l4 6.5"/><path d="M6.5 13h11l-1.2 6H7.7z"/>',
  "/people": '<circle cx="9" cy="8" r="2.2"/><path d="M4.8 18c.4-2.4 2.2-3.8 4.2-3.8s3.8 1.4 4.2 3.8"/><circle cx="16.2" cy="8.4" r="1.8"/><path d="M15 14.4c1.7.2 3 1.3 3.4 3.1"/>',
  "/academy": '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M8 7h8"/><path d="M8 11h6"/>',
  "/agents": '<rect x="6" y="8" width="12" height="10" rx="2"/><path d="M12 8V5"/><circle cx="9.5" cy="13" r="1"/><circle cx="14.5" cy="13" r="1"/><path d="M9 19v1h6v-1"/>',
  "/releases": '<path d="M12 4v10"/><path d="M8.5 7.5 12 4l3.5 3.5"/><rect x="6" y="14" width="12" height="6" rx="1"/>',
  "/me": '<circle cx="12" cy="8" r="2.6"/><path d="M6.2 18.5c.6-2.8 2.8-4.3 5.8-4.3s5.2 1.5 5.8 4.3"/>',
  logout: '<path d="M10 7V5.8A1.8 1.8 0 0 1 11.8 4h6.4A1.8 1.8 0 0 1 20 5.8v12.4a1.8 1.8 0 0 1-1.8 1.8h-6.4A1.8 1.8 0 0 1 10 18.2V17"/><path d="M4 12h10"/><path d="M11.2 8.8 14.4 12l-3.2 3.2"/>'
};

const CARET =
  '<i class="xm-caret" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 10 4 4 4-4"/></svg></i>';

function ico(name) {
  const path = ICO_PATH[name] || ICO_PATH["/han"];
  return `<i class="xm-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg></i>`;
}

function childActive(item, activeHref) {
  const key = String(activeHref || "");
  if (!item.children) {
    return false;
  }
  return item.children.some((child) => child.href === key) || key === item.href || key.startsWith(`${item.href}/`);
}

function queueBadge(item) {
  if (item.href !== "/releases") {
    return "";
  }
  return '<b class="xm-queue-badge" data-xm-queue-badge hidden>0</b>';
}

function itemLink(item, activeHref, extraClass) {
  const current = item.href === activeHref ? ' aria-current="page"' : "";
  const active = item.href === activeHref ? " is-active" : "";
  const extra = extraClass ? ` ${extraClass}` : "";
  return `<a class="xm-menu-item${extra}${active}" href="${item.href}"${current}>${ico(item.href)}<span>${item.label}</span>${queueBadge(item)}</a>`;
}

function groupMarkup(item, activeHref) {
  const open = childActive(item, activeHref);
  const kids = item.children.map((child) => itemLink(child, activeHref, "xm-menu-child")).join("");
  return `<div class="xm-menu-group${open ? " is-open" : ""}" data-xm-group="${item.href}"><button type="button" class="xm-menu-item xm-menu-parent" aria-expanded="${open ? "true" : "false"}">${ico(item.href)}<span>${item.label}</span>${CARET}</button><div class="xm-submenu">${kids}</div></div>`;
}

export function navMarkup(activeHref) {
  const main = NAV_MAIN.map((item) =>
    item.children ? groupMarkup(item, activeHref) : itemLink(item, activeHref)
  ).join("");
  const foot = NAV_FOOT.map((item) => itemLink(item, activeHref)).join("");
  return `<aside class="xm-sider" aria-label="侧栏导航"><div class="xm-brand"><a class="xm-logo" href="/data"><img src="/login-logo.png" alt="星脉甄选" onerror="this.onerror=null;this.src='/shared/xingmai-logo.png'" /></a><button type="button" class="xm-collapse" id="xm-collapse" aria-label="折叠侧栏">‹</button></div><nav class="xm-menu xm-menu-main">${main}</nav><nav class="xm-menu xm-menu-foot">${foot}<button type="button" class="xm-menu-item xm-logout" id="xm-logout">${ico("logout")}<span>退出登录</span></button><p class="xm-version">${NAV_VERSION}</p></nav></aside>`;
}
