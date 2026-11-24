// Offline completeness and integrity audit. Never logs in or requests the BI.
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { SHOP_DAY, DAY_REPORTS, shopDayRequest } from "./shop-day-contract.js";
import { inspectDayResponse } from "./shop-day.js";
import { decimalSum, decimalSubtract } from "./reconcile-shop-day.js";

const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const good = status => ["received", "empty"].includes(status);

export function inspectPromotionGroup(group) {
  const rows = group.extensibleTableWrapper.columnData.filter(r => !r.sumLine);
  const planSum = decimalSum(rows.map(r => r.cost));
  const delta = decimalSubtract(planSum, group.sumCost);
  const status = delta === "0" ? "consistent" : delta !== null && typeof group.sumCost === "number" && Math.abs(Number(delta)) < 1e-9 ? "source_number_rounding" : "mismatch";
  return { planSum, sourceTotal: group.sumCost, delta, status };
}

export async function auditDayArchive(directory) {
  const dir = join(directory, SHOP_DAY.platform, SHOP_DAY.shopId, SHOP_DAY.date);
  async function read(input) {
    const spec = shopDayRequest(input), digest = hash(spec);
    const filename = `${input.reportId}-${input.goodsId || "shop"}-${input.page || 1}-${digest.slice(0, 12)}.json`;
    let record;
    try { record = JSON.parse(await readFile(join(dir, filename), "utf8")); }
    catch (error) { if (error.code === "ENOENT") return { status: "missing" }; throw error; }
    if (!isDeepStrictEqual(record.scope, SHOP_DAY) || !isDeepStrictEqual(record.request, spec) || record.requestHash !== digest
      || record.reportId !== input.reportId || record.page !== (input.page || 1) || record.goodsId !== (input.goodsId || null)) return { status: "invalid_archive" };
    if (!good(record.status)) return { status: record.status, record };
    const inspected = inspectDayResponse(input.reportId, record.response, input.goodsId);
    if (!good(inspected.status) || inspected.dataHash !== record.dataHash || !isDeepStrictEqual(inspected.rows, record.rows)) return { status: "invalid_archive" };
    return { status: record.status, record };
  }
  const reports = [], shopRecords = {};
  for (const report of DAY_REPORTS.filter(r => !r.product && !r.requiresSelection && !r.manual)) {
    const pages = [];
    for (let page = 1; page <= 10; page++) {
      const result = await read({ reportId: report.id, page });
      pages.push({ page, status: result.status, rows: result.record?.rows?.length || 0 });
      if (result.record && good(result.status)) (shopRecords[report.id] ||= []).push(result.record);
      if (!result.record?.nextPage) break;
      if (result.record.nextPage !== page + 1) { pages.at(-1).status = "invalid_pagination"; break; }
    }
    reports.push({ id: report.id, label: report.label, pages });
  }
  const fullPages = shopRecords.shop_goods_page || [];
  const stock = fullPages.flatMap(r => r.rows.filter(row => !row.sumLine));
  const expected = fullPages[0]?.total;
  const inventoryComplete = Number.isInteger(expected) && stock.length === expected && new Set(stock.map(r => r.goodsId)).size === expected
    && !fullPages.at(-1)?.nextPage && fullPages.every(r => r.total === expected)
    && stock.every(r => r.goodsId && String(r.shopId) === SHOP_DAY.shopId && r.platform === SHOP_DAY.platform);
  const products = [], differences = [], comparisonCounts = {}, promotionAmounts = [], promotionSourceAmounts = [], promotionPlanDifferences = [], promotionNumberRounding = [];
  let promotionRecords = 0;
  if (inventoryComplete) for (const item of stock) {
    const checks = await Promise.all(DAY_REPORTS.filter(r => r.product && !r.manual).map(async report => {
      const result = await read({ reportId: report.id, goodsId: String(item.goodsId) });
      if (good(result.status) && report.id === "product_promotion") {
        promotionRecords++;
        for (const group of result.record.response.payload.data.filter(g => g.promoteKey !== "wxd")) {
          promotionSourceAmounts.push(group.sumCost);
          const { planSum, delta, status } = inspectPromotionGroup(group);
          promotionAmounts.push(planSum);
          if (delta !== "0") {
            const difference = { goodsId: String(item.goodsId), promoteKey: group.promoteKey, planSum, sourceTotal: group.sumCost, delta };
            // Some source sumCost JSON numbers expose a binary floating-point
            // tail (202.23999999999998). Keep that evidence separate; the shop
            // reconciliation itself uses exact decimal strings from plan rows.
            if (status === "source_number_rounding") promotionNumberRounding.push(difference);
            else promotionPlanDifferences.push(difference);
          }
        }
      }
      if (good(result.status) && ["product_overview", "product_operation"].includes(report.id)) {
        for (const field of ["gmv", "netGmv", "sales", "refund", "tghf", "profit"]) {
          const value = result.record.rows[0]?.[field], listValue = item[field];
          const count = (comparisonCounts[report.id] ||= {})[field] ||= { compared: 0, missing: 0 };
          const comparable = value != null && listValue != null && value !== "" && listValue !== "" && Number.isFinite(Number(value)) && Number.isFinite(Number(listValue));
          if (comparable) count.compared++; else count.missing++;
          if (comparable && Number(value) !== Number(listValue)) {
            differences.push({ goodsId: String(item.goodsId), reportId: report.id, field, productValue: value, listValue });
          }
        }
      }
      return { id: report.id, status: result.status, rows: result.record?.matchedRows ?? null, requestHash: result.record?.requestHash ?? null };
    }));
    products.push({ goodsId: String(item.goodsId), complete: checks.every(r => good(r.status)), reports: checks });
  }
  const coverageByReport = DAY_REPORTS.filter(r => r.product && !r.manual).map(r => ({ id: r.id, label: r.label,
    received: products.filter(p => p.reports.some(x => x.id === r.id && x.status === "received")).length,
    empty: products.filter(p => p.reports.some(x => x.id === r.id && x.status === "empty")).length,
    outstanding: products.filter(p => p.reports.some(x => x.id === r.id && !good(x.status))).length }));
  const promotionComponent = shopRecords.shop_goods_total?.[0]?.rows?.[0]?.lstSaleCost?.find(r => r.code === "tghf");
  const sourcePromotionTotal = promotionComponent?.originCost ?? promotionComponent?.cost ?? null;
  const promotionSum = decimalSum(promotionAmounts);
  const promotionCoverage = inventoryComplete && promotionRecords === expected;
  return { scope: SHOP_DAY, auditedAt: new Date().toISOString(), inventoryComplete,
    expectedProducts: expected ?? null, completeProducts: products.filter(p => p.complete).length,
    coreReportsArchived: inventoryComplete && reports.every(r => r.pages.every(p => good(p.status))) && products.every(p => p.complete),
    uiParityVerified: false, livePageVerified: false,
    policy: "仅核验基础九类商品数据及全店基础表；不代表全部旧站数据和交互已验收。独立推广趋势、计划趋势须另行逐笔核验。多表时段和地域层级不可直接相加。",
    additionalReports: DAY_REPORTS.filter(r => r.manual).map(r => ({ id: r.id, label: r.label, status: "requires_separate_verification" })),
    deferred: DAY_REPORTS.filter(r => r.requiresSelection).map(r => ({ id: r.id, reason: "selected_category_contract_unverified" })),
    reports, coverageByReport, products, comparisonCounts, displayedValueDifferences: differences,
    promotionPlans: { checkedProducts: promotionRecords, complete: promotionCoverage, planTotal: promotionSum, sourceTotal: sourcePromotionTotal,
      sourceGroupedTotal: decimalSum(promotionSourceAmounts), sourceNumberRounding: promotionNumberRounding,
      matchesShopPromotion: promotionCoverage && decimalSubtract(promotionSum, sourcePromotionTotal) === "0",
      planDifferences: promotionPlanDifferences, scopeNote: "推广接口金额；无效单费用不并入推广花费，不等同于广告账单实际扣费核验。" } };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directory = process.argv[2];
  if (!directory) throw new Error("请提供单店档案根目录");
  const result = await auditDayArchive(directory);
  const output = join(directory, SHOP_DAY.platform, SHOP_DAY.shopId, SHOP_DAY.date, "coverage-audit.json");
  await writeFile(output, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify({ inventoryComplete: result.inventoryComplete, completeProducts: result.completeProducts,
    expectedProducts: result.expectedProducts, coreReportsArchived: result.coreReportsArchived,
    coverageByReport: result.coverageByReport, displayedValueDifferences: result.displayedValueDifferences.length,
    promotionPlans: result.promotionPlans, output }));
}
