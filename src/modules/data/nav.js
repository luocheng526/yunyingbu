/** Data-center submenu. Homepage owns the left rail; this list is for /api/data/nav and in-page links. */

export const DATA_NAV = {
  parent: { href: "/data", label: "数据中心" },
  children: [
    { href: "/data/overview", label: "数据总揽" },
    { href: "/data/shops", label: "店铺数据" },
    { href: "/data/goods", label: "商品数据" },
    { href: "/data/paid", label: "实时付费" }
  ]
};

export function getNav() {
  return { ok: true, module: "data", ...DATA_NAV };
}
