import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  filterRecordsByShopIds,
  inactiveErpIdsFromStores,
  isDutyOrgStore,
  isInactiveOrgStore,
  operatingErpIdsFromStores,
  parseIdList
} from "../src/modules/home/org-shop-status.js";
import { mapErpKpis, resolveErpShopScope } from "../src/modules/home/erp-kpis.js";

const homeJs = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../public/shared/modules/home.js"),
  "utf8"
);
const peopleJs = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../public/shared/modules/people.js"),
  "utf8"
);

const stores = [
  { id: 1, storeName: "运营店", storeId: "111", statusKey: "operating", remark: "运营中" },
  { id: 48, storeName: "UUMILO个人护理旗舰店", storeId: "159582056", shopId: "159582056", statusKey: "idle", remark: "闲置中" },
  { id: 9, storeName: "退店中店", storeId: "222", statusKey: "closing", remark: "退店中" },
  { id: 10, storeName: "已退店", storeId: "333", statusKey: "closed", remark: "已退店" },
  { id: 11, storeName: "店群", storeId: "444", statusKey: "operating", kind: "店群" }
];

test("idle closing and closed org shops are not duty shops", () => {
  assert.equal(isInactiveOrgStore(stores[0]), false);
  assert.equal(isDutyOrgStore(stores[0]), true);
  assert.equal(isInactiveOrgStore(stores[1]), true);
  assert.equal(isDutyOrgStore(stores[1]), false);
  assert.equal(isDutyOrgStore(stores[2]), false);
  assert.equal(isDutyOrgStore(stores[3]), false);
  assert.equal(isDutyOrgStore(stores[4]), false);
});

test("operating ERP ids skip idle closing closed and shop groups", () => {
  assert.deepEqual(operatingErpIdsFromStores(stores), ["111"]);
  assert.deepEqual(inactiveErpIdsFromStores(stores), ["159582056", "222", "333"]);
});

test("ERP KPI map drops inactive shop ids and resums totals", () => {
  const mapped = mapErpKpis(
    {
      summary: { payAmount: 300, orderCount: 3, profit: 30 },
      records: [
        { shopId: "111", shopName: "运营店", payAmount: 100, orderCount: 1, profit: 10 },
        { shopId: "159582056", shopName: "闲置店", payAmount: 200, orderCount: 2, profit: 20 }
      ]
    },
    [],
    { denyIds: new Set(["159582056"]) }
  );
  assert.equal(mapped.records.length, 1);
  assert.equal(mapped.records[0].shopId, "111");
  assert.equal(mapped.summary.payAmount, 100);
  assert.equal(mapped.summary.orderCount, 1);
  assert.equal(mapped.summary.profit, 10);
});

test("resolveErpShopScope skips ERP when every org shop is inactive", async () => {
  const scope = await resolveErpShopScope({}, [stores[1], stores[2], stores[3]]);
  assert.equal(scope.skipErp, true);
  assert.equal(scope.allowIds.size, 0);
});

test("resolveErpShopScope keeps operating ids and excludes idle even if requested", async () => {
  const scope = await resolveErpShopScope(
    { shopIds: "111,159582056", excludeShopIds: "" },
    stores
  );
  assert.equal(scope.skipErp, false);
  assert.deepEqual([...scope.allowIds], ["111"]);
  assert.equal(scope.denyIds.has("159582056"), true);
});

test("parseIdList and record filter keep allow/deny rules", () => {
  assert.deepEqual(parseIdList({ shopIds: "111, 159582056,111" }, "shopIds"), ["111", "159582056"]);
  const rows = filterRecordsByShopIds(
    [{ shopId: "111" }, { shopId: "159582056" }, { shopId: "999" }],
    ["111"],
    ["159582056"]
  );
  assert.deepEqual(rows.map((row) => row.shopId), ["111"]);
});

test("home client only duties operating shops and asks ERP with those ids", () => {
  assert.match(homeJs, /0\.1\.564-org-idle-skip-erp/);
  assert.match(homeJs, /function isInactiveOrgStore\(row\)/);
  assert.match(homeJs, /key === "idle" \|\| key === "closing" \|\| key === "closed"/);
  assert.match(homeJs, /row && row.kind !== "店群" && !isInactiveOrgStore\(row\)/);
  assert.match(homeJs, /opts: orgLoaded \? \{ shopIds: shopIds, skipErp: shopIds.length === 0 \}/);
  assert.match(homeJs, /fetchRangePack\(state.from, state.to, scope.opts\)/);
  assert.match(homeJs, /filterPackByDuty/);
  assert.match(homeJs, /scoped \? Promise.resolve\(\{ ok: false \}\) : api\("\/api\/data\/overview\?"/);
  assert.doesNotMatch(homeJs, /statusKey !== "closed" && row.kind !== "店群"/);
});

test("org board KPIs recount from operating shops only", () => {
  assert.match(peopleJs, /0\.1\.564-org-idle-skip-erp/);
  assert.match(peopleJs, /function summaryFromActiveStores\(stores\)/);
  assert.match(peopleJs, /renderKpis\(summaryFromActiveStores\(rawStores\)\)/);
  assert.match(peopleJs, /return key === "operating"/);
});
