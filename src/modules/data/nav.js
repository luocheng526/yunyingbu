/** Data-center submenu. Homepage owns the left rail; this list is for /api/data/nav and in-page links. */

export const DATA_NAV = {
  parent: { href: "/data", label: "数据中心" },
  children: [
    { href: "/data/stores/live", label: "店铺实时数据" },
    { href: "/data/stores/overview", label: "店铺数据总揽" },
    { href: "/data/goods/overview", label: "商品数据总揽" }
  ]
};

export function getNav() {
  return { ok: true, module: "data", ...DATA_NAV };
}
