const INACTIVE_KEYS = new Set(["idle", "closing", "closed"]);
const INACTIVE_REMARKS = new Set(["闲置中", "退店中", "已退店"]);

export function isInactiveOrgStore(row) {
  if (!row) {
    return true;
  }
  const key = String(row.statusKey || "").trim().toLowerCase();
  if (INACTIVE_KEYS.has(key)) {
    return true;
  }
  const remark = String(row.remark || "").trim();
  return INACTIVE_REMARKS.has(remark);
}

export function isDutyOrgStore(row) {
  return Boolean(row) && row.kind !== "店群" && !isInactiveOrgStore(row);
}

export function orgStoreErpIds(row) {
  if (!row) {
    return [];
  }
  const seen = new Set();
  const ids = [];
  const rowId = String(row.id == null ? "" : row.id).trim();
  const keys = ["storeId", "erpShopId", "erpId", "platformShopId", "jdShopId", "shopCode", "shopId"];
  for (const key of keys) {
    const id = String(row[key] == null ? "" : row[key]).trim();
    if (!id || seen.has(id)) {
      continue;
    }
    if (key === "shopId" && id === rowId) {
      continue;
    }
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function operatingErpIdsFromStores(stores) {
  const seen = new Set();
  const ids = [];
  for (const row of stores || []) {
    if (!isDutyOrgStore(row)) {
      continue;
    }
    for (const id of orgStoreErpIds(row)) {
      if (!seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
  }
  return ids;
}

export function inactiveErpIdsFromStores(stores) {
  const seen = new Set();
  const ids = [];
  for (const row of stores || []) {
    if (!row || row.kind === "店群" || !isInactiveOrgStore(row)) {
      continue;
    }
    for (const id of orgStoreErpIds(row)) {
      if (!seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
  }
  return ids;
}

export function parseIdList(query = {}, key = "shopIds") {
  const raw = query[key];
  if (raw == null || raw === "") {
    return [];
  }
  const text = Array.isArray(raw) ? raw.join(",") : String(raw);
  const seen = new Set();
  const ids = [];
  for (const part of text.split(/[,\s]+/)) {
    const id = String(part || "").trim();
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function filterRecordsByShopIds(records, allowIds, denyIds) {
  const allow = allowIds instanceof Set ? allowIds : new Set(allowIds || []);
  const deny = denyIds instanceof Set ? denyIds : new Set(denyIds || []);
  return (records || []).filter((row) => {
    const id = String((row && (row.shopId || row.id)) || "").trim();
    if (!id) {
      return allow.size === 0;
    }
    if (deny.has(id)) {
      return false;
    }
    return allow.size === 0 || allow.has(id);
  });
}

function asShopIdToken(id) {
  const n = Number(id);
  return Number.isFinite(n) && String(n) === String(id) ? n : id;
}

export function erpShopIdTokens(ids) {
  return (ids || []).map(asShopIdToken);
}
