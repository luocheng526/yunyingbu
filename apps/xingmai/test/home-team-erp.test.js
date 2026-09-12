import test from "node:test";
import assert from "node:assert/strict";

function normShopId(value) {
  return String(value == null ? "" : value).trim();
}

function shopErpId(shop) {
  if (!shop) {
    return "";
  }
  const keys = ["storeId", "erpShopId", "erpId", "platformShopId", "jdShopId", "shopCode"];
  for (const key of keys) {
    const id = normShopId(shop[key]);
    if (id) {
      return id;
    }
  }
  const shopId = normShopId(shop.shopId);
  if (shopId && shopId !== String(shop.id == null ? "" : shop.id)) {
    return shopId;
  }
  return "";
}

function normShopName(value) {
  return String(value == null ? "" : value).replace(/\s+/g, "").toLowerCase();
}

function resolveErpId(shop, catalogByName) {
  const id = shopErpId(shop);
  if (id) {
    return id;
  }
  const name = (shop && (shop.storeName || shop.name || shop.shopName)) || "";
  const hit = (catalogByName && (catalogByName[name] || catalogByName[normShopName(name)])) || null;
  if (!hit) {
    return "";
  }
  return normShopId(hit.shopId || hit.id);
}

test("Han org store uses filled storeId", () => {
  assert.equal(
    resolveErpId({ id: 19, storeId: "16107402", storeName: "DIKTT潮流生活旗舰店" }, {}),
    "16107402"
  );
});

test("Shen org store without storeId uses ERP shop-options name", () => {
  assert.equal(
    resolveErpId(
      { id: 1, storeId: "", storeName: "RASW家居旗舰店" },
      { RASW家居旗舰店: { id: "16065563" } }
    ),
    "16065563"
  );
});

test("unknown shop stays empty so the card can show a dash", () => {
  assert.equal(resolveErpId({ storeName: "不存在的店" }, {}), "");
});

test("team totals keep the first ERP row when two duty shops share one id", () => {
  const seen = {};
  const matched = [];
  ["159582056", "159582056", "16107402"].forEach((id) => {
    if (!seen[id]) {
      seen[id] = true;
      matched.push(id);
    }
  });
  assert.deepEqual(matched, ["159582056", "16107402"]);
});
