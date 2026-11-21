import { readFile } from "node:fs/promises";

export function normalizeOrgShops(rows) {
  const roster = rows.map((row) => ({
    store: String(row.storeName || "").trim(),
    team: String(row.team || ""),
    manager: String(row.manager || ""),
    enabled: row.statusKey === "operating" || (row.statusKey == null && row.remark === "运营中"),
    login: String(row.login || ""),
    password: String(row.password || ""),
    shopId: String(row.shopId || row.storeId || "").trim(),
    merchantId: String(row.merchantId || "").trim()
  })).filter((row) => row.store);
  const merchants = new Map();
  // An idle sibling still makes a merchant ID insufficient to identify a shop.
  roster.forEach(row => {
    if (row.merchantId) merchants.set(row.merchantId, (merchants.get(row.merchantId) || 0) + 1);
  });
  return roster.filter(row => row.enabled).map(row => ({ ...row, ambiguousMerchant: (merchants.get(row.merchantId) || 0) > 1 }));
}

// Background jobs run as the server, independent of a browser user's login.
// Browser-facing requests still read the authenticated org API.
export async function readServerOrgShops(file = process.env.HOME_ORG_STORES_FILE || new URL("../people/data/org-stores.json", import.meta.url)) {
  const data = JSON.parse(await readFile(file, "utf8"));
  if (!data || !Array.isArray(data.rows)) throw new Error("组织中心店铺配置格式不正确");
  return normalizeOrgShops(data.rows);
}
