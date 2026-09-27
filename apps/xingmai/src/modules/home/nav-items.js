export const NAV_VERSION = "v0.4.24";

export const DATA_CHILDREN = [
  { href: "/data/overview", label: "数据总揽" },
  { href: "/data/shops", label: "店铺数据" },
  { href: "/data/goods", label: "商品数据" },
  { href: "/data/paid", label: "实时付费" }
];

export const SHEN_CHILDREN = [
  { href: "/shen/product", label: "产品中心" },
  { href: "/shen/paid", label: "付费中心" },
  { href: "/shen/recharge-rules", label: "充值规则" },
  { href: "/shen/training", label: "培训系统" },
  { href: "/shen/tasks", label: "任务管理" }
];

export const HAN_CHILDREN = [
  { href: "/han/selection", label: "选品数据" },
  { href: "/han/goods", label: "商品数据" },
  { href: "/han/paid", label: "实时付费", attrs: { "data-han-center": "center" } },
  { href: "/han/recharge-rules", label: "充值规则", attrs: { "data-han-center": "rules" } },
  { href: "/han/training", label: "培训系统" }
];

const STAFF_NAV_HREFS = new Set(["/releases", "/people"]);
const STAFF_NAV_NAMES = new Set(["罗成", "韩梦凯", "沈子晗", "luocheng"]);

export function canSeeStaffNav(user) {
  if (!user) {
    return false;
  }
  if (typeof user === "string") {
    const name = user.trim();
    return STAFF_NAV_NAMES.has(name) || STAFF_NAV_NAMES.has(name.toLowerCase());
  }
  return [user.username, user.displayName, user.name].some((value) => {
    const name = String(value || "").trim();
    return Boolean(name) && (STAFF_NAV_NAMES.has(name) || STAFF_NAV_NAMES.has(name.toLowerCase()));
  });
}

export function orgNavFlags(user) {
  if (canSeeStaffNav(user)) {
    return { shen: true, han: true, staff: true, known: true };
  }
  if (!user) {
    return { shen: false, han: false, staff: false, known: false };
  }
  const bag = [user.center, user.department, user.lineManager, user.director, user.managerName]
    .map((value) => String(value || ""))
    .join(" ");
  const shen = bag.includes("沈子晗");
  const han = bag.includes("韩梦凯");
  return { shen, han, staff: false, known: shen || han };
}

export function actorName(user) {
  if (!user) {
    return "";
  }
  if (typeof user === "string") {
    return user.trim();
  }
  return String(user.displayName || user.name || user.username || "").trim();
}

export function shopKey(name) {
  return String(name || "")
    .replace(/\s+/g, "")
    .replace(/旗舰店$/g, "旗舰")
    .replace(/店$/g, "")
    .toLowerCase();
}

export function shopNameOf(row) {
  if (typeof row === "string") {
    return row;
  }
  if (!row || typeof row !== "object") {
    return "";
  }
  return String(
    row.store || row.storeName || row.shopName || row.shop || row["店铺名称"] || row["店铺"] || row.name || ""
  ).trim();
}

export function queryValue(url, key) {
  const raw = String(url || "");
  const qIdx = raw.indexOf("?");
  const q = qIdx >= 0 ? raw.slice(qIdx + 1) : "";
  const match = q.match(new RegExp(`(?:^|&)${String(key || "")}=([^&]*)`, "i"));
  if (!match) {
    return "";
  }
  try {
    return decodeURIComponent(match[1].replace(/\+/g, " "));
  } catch {
    return match[1];
  }
}

export function isCenterUiWorkerView(url) {
  const raw = String(url || "");
  const path = raw.split("?")[0];
  if (!/\/api\/(?:han|shen)\/worker\/?$/i.test(path)) {
    return false;
  }
  return /^(overview|shop|rules|history)$/i.test(queryValue(raw, "view"));
}

export function skipCenterFilter(url, method) {
  const verb = String(method || "GET").toUpperCase();
  if (verb !== "GET") {
    return true;
  }
  const raw = String(url || "");
  const path = raw.split("?")[0];
  if (!centerOfApiPath(path) || path.indexOf("/api/") !== 0) {
    return true;
  }
  if (/\.csv$/i.test(path)) {
    return true;
  }
  if (/worker/i.test(path) && !isCenterUiWorkerView(raw)) {
    return true;
  }
  return false;
}

export function centerOfApiPath(url) {
  const path = String(url || "").split("?")[0];
  if (path.indexOf("/api/shen") === 0 || path.indexOf("/shen") === 0) {
    return "shen";
  }
  if (path.indexOf("/api/han") === 0 || path.indexOf("/han") === 0) {
    return "han";
  }
  return "";
}

export function storeMatchesCenter(store, which) {
  const manager = which === "shen" ? "沈子晗" : which === "han" ? "韩梦凯" : "";
  if (!manager || !store) {
    return false;
  }
  const bag = [store.manager, store.team, store.chief, store.lead, store.director, store.groupId]
    .map((value) => String(value || ""))
    .join(" ");
  return bag.includes(manager);
}

export function centerNameSet(stores, which) {
  const names = {};
  (stores || []).forEach((store) => {
    if (!storeMatchesCenter(store, which)) {
      return;
    }
    const key = shopKey(store.storeName || store.shopName || store.name);
    if (key) {
      names[key] = true;
    }
  });
  return names;
}

export function dutyNameSet(user, stores, people) {
  const names = {};
  const me = actorName(user);
  if (!me) {
    return names;
  }
  const add = (value) => {
    const key = shopKey(value);
    if (key) {
      names[key] = true;
    }
  };
  const person = (people || []).find((row) => {
    const name = String((row && row.name) || "").trim();
    const username = String((row && row.username) || "").trim();
    return name === me || username === me;
  });
  if (person) {
    (person.visibleShops || []).forEach(add);
  }
  (stores || []).forEach((store) => {
    const roles = [store.manager, store.supervisor, store.reserve, store.operator, store.assistant, store.lead, store.chief];
    if (roles.some((role) => String(role || "").trim() === me)) {
      add(store.storeName || store.shopName || store.name);
    }
  });
  return names;
}

export function allowCenterShop(name, which, centerSet, dutySet, full) {
  const key = shopKey(name);
  if (!key) {
    return false;
  }
  if (centerSet && Object.keys(centerSet).length && !centerSet[key]) {
    return false;
  }
  if (full) {
    return true;
  }
  if (!dutySet || !Object.keys(dutySet).length) {
    return false;
  }
  return Boolean(dutySet[key]);
}

function keepCenterRow(row, allow) {
  if (typeof row === "string") {
    return allow(row);
  }
  const name = shopNameOf(row);
  if (!name) {
    return true;
  }
  return allow(name);
}

const SHOP_LIST_KEYS = [
  "enabledStores",
  "shops",
  "stores",
  "rows",
  "items",
  "shopRuns",
  "records",
  "runs",
  "runShops",
  "subaccounts",
  "recharges"
];

function blankDeniedShop(data) {
  const next = { ...data, store: "", shop: {}, forbidden: true };
  SHOP_LIST_KEYS.forEach((key) => {
    if (Array.isArray(next[key])) {
      next[key] = [];
    }
  });
  if (next.metrics && typeof next.metrics === "object") {
    next.metrics = { ...next.metrics, stores: 0, shops: 0 };
  }
  if (next.totals && typeof next.totals === "object") {
    next.totals = { ...next.totals, stores: 0, shops: 0 };
  }
  return next;
}

function recountCenterMetrics(next) {
  const list = Array.isArray(next.enabledStores)
    ? next.enabledStores
    : Array.isArray(next.shops)
      ? next.shops
      : Array.isArray(next.stores)
        ? next.stores
        : Array.isArray(next.rows)
          ? next.rows
          : null;
  if (!list) {
    return;
  }
  const patch = { stores: list.length, shops: list.length };
  if (list.length && typeof list[0] === "object") {
    const add = (key) => list.reduce((sum, row) => sum + (Number(row && row[key]) || 0), 0);
    if (next.metrics && typeof next.metrics === "object") {
      if ("spend" in next.metrics) {
        patch.spend = add("spend");
      }
      if ("paidOrders" in next.metrics) {
        patch.paidOrders = add("paidOrders");
      }
      if ("orders" in next.metrics) {
        patch.orders = add("orders");
      }
      if ("jingmaiGmv" in next.metrics) {
        patch.jingmaiGmv = add("jingmaiGmv");
      }
      if ("gmv" in next.metrics) {
        patch.gmv = add("gmv");
      }
      if ("totalOrderAmount" in next.metrics) {
        patch.totalOrderAmount = add("totalOrderAmount");
      }
      if ("balance" in next.metrics) {
        patch.balance = add("balance");
      }
    }
  }
  if (next.metrics && typeof next.metrics === "object") {
    next.metrics = { ...next.metrics, ...patch };
  }
  if (next.totals && typeof next.totals === "object") {
    next.totals = { ...next.totals, ...patch };
  }
}

export function filterCenterPayload(data, allow, storeQuery) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return data;
  }
  const asked = String(storeQuery || data.store || "").trim();
  if (asked && !allow(asked)) {
    return blankDeniedShop(data);
  }
  const next = { ...data };
  SHOP_LIST_KEYS.forEach((key) => {
    if (Array.isArray(next[key])) {
      next[key] = next[key].filter((row) => keepCenterRow(row, allow));
    }
  });
  if (next.shop && typeof next.shop === "object" && !Array.isArray(next.shop)) {
    const name = shopNameOf(next.shop);
    if (name && !allow(name)) {
      return blankDeniedShop(next);
    }
  }
  recountCenterMetrics(next);
  return next;
}

function footItemsFor(user) {
  if (canSeeStaffNav(user)) {
    return NAV_FOOT;
  }
  return NAV_FOOT.filter((item) => !STAFF_NAV_HREFS.has(item.href));
}

function mainItemsFor(user) {
  const flags = orgNavFlags(user);
  return NAV_MAIN.filter((item) => {
    if (item.href === "/shen") {
      return flags.shen || !flags.known;
    }
    if (item.href === "/han") {
      return flags.han || !flags.known;
    }
    return true;
  });
}

export const ACADEMY_CHILDREN = [
  { href: "/academy/courses", label: "培训课程" },
  { href: "/academy/exams", label: "培训考试" },
  { href: "/academy/handbook", label: "运营手册" }
];

export const PEOPLE_CHILDREN = [
  { href: "/people", label: "组织中心" },
  { href: "/notices", label: "公告中心" }
];

export const NAV_MAIN = [
  { href: "/home", label: "首页" },
  { href: "/data", label: "数据中心", children: DATA_CHILDREN },
  { href: "/shen", label: "沈子晗运营中心", children: SHEN_CHILDREN },
  { href: "/han", label: "韩梦凯运营中心", children: HAN_CHILDREN },
  { href: "/stores", file: "stores.html", label: "店铺维护中心" },
  { href: "/academy", label: "甄选商学院", children: ACADEMY_CHILDREN },
  { href: "/agents", file: "agents.html", label: "甄选智能体" }
];

export const NAV_FOOT = [
  { href: "/releases", file: "releases.html", label: "版本发布中心" },
  { href: "/people", file: "people.html", label: "组织中心", children: PEOPLE_CHILDREN },
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

export const NAV_ITEMS = [...flatten(NAV_MAIN), ...flatten(NAV_FOOT)];

const ICO_PATH = {
  "/home": '<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10.8V20h4.2v-5.2h3.6V20H18v-9.2"/>',
  "/data": '<path d="M5 19V10"/><path d="M10 19V6"/><path d="M15 19v-7"/><path d="M20 19V8"/>',
  "/shen": '<rect x="6" y="4" width="12" height="16" rx="2"/><path d="M9 9h6"/><path d="M9 13h6"/><path d="M9 17h4"/>',
  "/han": '<path d="M8 11.5 12 5l4 6.5"/><path d="M6.5 13h11l-1.2 6H7.7z"/>',
  "/people": '<circle cx="9" cy="8" r="2.2"/><path d="M4.8 18c.4-2.4 2.2-3.8 4.2-3.8s3.8 1.4 4.2 3.8"/><circle cx="16.2" cy="8.4" r="1.8"/><path d="M15 14.4c1.7.2 3 1.3 3.4 3.1"/>',
  "/stores": '<path d="M4 9 6 4h12l2 5"/><path d="M4 9h16v11H4z"/><path d="M9 20v-6h6v6"/>',
  "/academy": '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M8 7h8"/><path d="M8 11h6"/>',
  "/agents": '<rect x="6" y="8" width="12" height="10" rx="2"/><path d="M12 8V5"/><circle cx="9.5" cy="13" r="1"/><circle cx="14.5" cy="13" r="1"/><path d="M9 19v1h6v-1"/>',
  "/releases": '<path d="M12 4v10"/><path d="M8.5 7.5 12 4l3.5 3.5"/><rect x="6" y="14" width="12" height="6" rx="1"/>',
  "/me": '<circle cx="12" cy="8" r="2.6"/><path d="M6.2 18.5c.6-2.8 2.8-4.3 5.8-4.3s5.2 1.5 5.8 4.3"/>',
  "/notices": '<path d="M5 9v6"/><path d="M8 7v10"/><path d="M8 7l11-3v16L8 17"/>',
  logout: '<path d="M10 7V5.8A1.8 1.8 0 0 1 11.8 4h6.4A1.8 1.8 0 0 1 20 5.8v12.4a1.8 1.8 0 0 1-1.8 1.8h-6.4A1.8 1.8 0 0 1 10 18.2V17"/><path d="M4 12h10"/><path d="M11.2 8.8 14.4 12l-3.2 3.2"/>'
};

const CARET =
  '<i class="xm-caret" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 10 4 4 4-4"/></svg></i>';

function ico(name) {
  const path = ICO_PATH[name] || ICO_PATH["/han"];
  return `<i class="xm-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg></i>`;
}

function hrefKey(href) {
  return String(href || "/")
    .replace(/\/index\.html$/i, "")
    .replace(/\/+$/, "") || "/";
}

function childActive(item, activeHref) {
  const key = hrefKey(activeHref);
  if (!item.children) {
    return false;
  }
  return (
    item.children.some((child) => hrefKey(child.href) === key || key.startsWith(`${hrefKey(child.href)}/`)) ||
    key === item.href ||
    key.startsWith(`${item.href}/`)
  );
}

function queueBadge(item) {
  if (item.href !== "/releases") {
    return "";
  }
  return '<b class="xm-queue-badge" data-xm-queue-badge hidden>0</b>';
}

function attrMarkup(item) {
  const attrs = item.attrs || {};
  return Object.entries(attrs)
    .map(([key, value]) => ` ${key}="${String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;")}"`)
    .join("");
}

function itemLink(item, activeHref, extraClass) {
  const on = hrefKey(item.href) === hrefKey(activeHref);
  const current = on ? ' aria-current="page"' : "";
  const active = on ? " is-active" : "";
  const extra = extraClass ? ` ${extraClass}` : "";
  return `<a class="xm-menu-item${extra}${active}" href="${item.href}"${current}${attrMarkup(item)}>${ico(item.href)}<span>${item.label}</span>${queueBadge(item)}</a>`;
}

function groupMarkup(item, activeHref) {
  const open = childActive(item, activeHref);
  const kids = item.children.map((child) => itemLink(child, activeHref, "xm-menu-child")).join("");
  return `<div class="xm-menu-group${open ? " is-open" : ""}" data-xm-group="${item.href}"><button type="button" class="xm-menu-item xm-menu-parent" aria-expanded="${open ? "true" : "false"}">${ico(item.href)}<span>${item.label}</span>${CARET}</button><div class="xm-submenu">${kids}</div></div>`;
}

export function navMarkup(activeHref, user) {
  const main = mainItemsFor(user)
    .map((item) => (item.children ? groupMarkup(item, activeHref) : itemLink(item, activeHref)))
    .join("");
  const foot = footItemsFor(user)
    .map((item) => (item.children ? groupMarkup(item, activeHref) : itemLink(item, activeHref)))
    .join("");
  return `<aside class="xm-sider" aria-label="侧栏导航"><div class="xm-brand"><a class="xm-logo" href="/home" title="回到首页"><img src="/login-logo.png" alt="星脉甄选" onerror="this.onerror=null;this.src='/shared/xingmai-logo.png'" /></a><button type="button" class="xm-collapse" id="xm-collapse" aria-label="折叠侧栏">‹</button></div><nav class="xm-menu xm-menu-main">${main}</nav><nav class="xm-menu xm-menu-foot">${foot}<button type="button" class="xm-menu-item xm-logout" id="xm-logout">${ico("logout")}<span>退出登录</span></button><p class="xm-version">${NAV_VERSION}</p></nav></aside>`;
}
