import { isDeepStrictEqual } from "node:util";
import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SHOP_DAY, shopDayRequest } from "./shop-day-contract.js";
import { createShopDayCollector } from "./shop-day.js";

// Reconciliation arithmetic only. Display values and raw report JSON are never replaced.
const SCALE = 10n ** 18n;
function units(value) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const match = String(value).match(/^(-?)(\d+)(?:\.(\d{1,18}))?$/);
  if (!match) return null;
  return (match[1] ? -1n : 1n) * (BigInt(match[2]) * SCALE + BigInt((match[3] || "").padEnd(18, "0")));
}
function decimal(value) {
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  const fraction = String(absolute % SCALE).padStart(18, "0").replace(/0+$/, "");
  return `${sign}${absolute / SCALE}${fraction ? `.${fraction}` : ""}`;
}
export function decimalSum(values) {
  const parsed = values.map(units);
  return parsed.some(value => value === null) ? null : decimal(parsed.reduce((sum, value) => sum + value, 0n));
}
export function decimalSubtract(first, ...rest) {
  const parsed = [first, ...rest].map(units);
  return parsed.some(value => value === null) ? null : decimal(parsed.slice(1).reduce((sum, value) => sum - value, parsed[0]));
}
export function roundedInteger(value) {
  const parsed = units(value);
  if (parsed === null) return null;
  const absolute = parsed < 0n ? -parsed : parsed;
  const rounded = (absolute + SCALE / 2n) / SCALE;
  return `${parsed < 0n && rounded ? "-" : ""}${rounded}`;
}
const equal = (a, b) => units(a) !== null && units(b) !== null && units(a) === units(b);
const matchesDisplay = (value, display) => value !== null && equal(roundedInteger(value), display);

function detail(row, key, code) {
  if (!Array.isArray(row?.[key])) return { value: null, originComplete: false };
  const parts = code ? row[key].filter(part => part.code === code) : row[key];
  return { value: decimalSum(parts.map(part => part.originCost ?? part.cost)),
    originComplete: parts.every(part => units(part.originCost) !== null), components: parts.length };
}
function aggregateDetails(rows, key, code) {
  const parts = rows.map(row => detail(row, key, code));
  return { value: decimalSum(parts.map(part => part.value)), originComplete: parts.every(part => part.originComplete) };
}
function valid(record, id, page = 1) {
  return record?.reportId === id && ["received", "empty"].includes(record.status)
    && isDeepStrictEqual(record.scope, SHOP_DAY)
    && isDeepStrictEqual(record.request, shopDayRequest({ reportId: id, page }))
    && Array.isArray(record.rows);
}

export function reconcileShopDay({ operating, hotGoods, fullPages, fullTotal }) {
  const result = { scope: SHOP_DAY, status: "incomplete", readyForShopAggregation: false,
    readyForHistoricalBatch: false, policy: {
      shopHeadlineSource: "channel_operating",
      productCoverageSource: "shop_goods_page + shop_goods_total",
      hotGoodsMayRepresentShopTotal: false,
      profitRequiresCustomFeeBridge: true,
      regionLevelsMustBeSeparate: true,
      pageValuesIndependentlyVerified: false
    } };
  if (!valid(operating, "channel_operating") || !valid(hotGoods, "channel_goods")
    || !valid(fullTotal, "shop_goods_total") || !Array.isArray(fullPages) || !fullPages.length
    || fullPages.some((page, i) => !valid(page, "shop_goods_page", i + 1))) return result;
  const total = fullPages[0].total;
  const rows = fullPages.flatMap(page => page.rows.filter(row => !row.sumLine));
  const identities = new Set(rows.map(row => JSON.stringify([row.platform, String(row.shopId), String(row.goodsId)])));
  const covered = Number.isInteger(total) && total >= 0 && rows.length === total && identities.size === total
    && fullPages.every((page, i) => page.total === total && (i === fullPages.length - 1 ? !page.nextPage : page.nextPage === i + 2))
    && rows.every(row => row.platform === SHOP_DAY.platform && String(row.shopId) === SHOP_DAY.shopId && row.goodsId);
  result.coverage = { complete: covered, expected: total, received: rows.length, unique: identities.size, pages: fullPages.length };
  if (!covered || fullTotal.rows.length !== 1 || operating.rows.length !== 1) return result;
  const oldRows = hotGoods.rows.filter(row => !row.sumLine);
  const oldSum = hotGoods.rows.find(row => row.sumLine);
  const full = fullTotal.rows[0];
  const shop = operating.rows[0];
  const oldIds = new Set(oldRows.map(row => String(row.goodsId)));
  const allIds = new Set(rows.map(row => String(row.goodsId)));
  const omitted = rows.filter(row => !oldIds.has(String(row.goodsId)));
  if (!oldSum || oldIds.size !== oldRows.length || [...oldIds].some(id => !allIds.has(id))
    || oldRows.some(row => row.platform !== SHOP_DAY.platform || String(row.shopId) !== SHOP_DAY.shopId)) return result;
  result.coverage.hotGoodsRows = oldRows.length;
  result.coverage.omittedRows = omitted.length;
  result.coverage.hotGoodsMatchesFirstRows = oldRows.every((row, i) => String(row.goodsId) === String(rows[i]?.goodsId));
  result.omitted = { goodsIds: omitted.map(row => String(row.goodsId)),
    payment: aggregateDetails(omitted, "lstGmv"), sales: decimalSum(omitted.map(row => row.sales)),
    // Sales-expense components are present even on zero-ad rows where lstTghf is omitted.
    promotion: aggregateDetails(omitted, "lstSaleCost", "tghf"), refund: aggregateDetails(omitted, "lstRefund") };

  const oldPromotion = detail(oldSum, "lstSaleCost", "tghf");
  const allPromotion = detail(full, "lstSaleCost", "tghf");
  const oldRefund = detail(oldSum, "lstRefund"), allRefund = detail(full, "lstRefund");
  const allGmv = detail(full, "lstGmv"), invalid = detail(full, "lstGmv", "invalidGmv");
  const net = decimalSubtract(allGmv.value, invalid.value, allRefund.value);
  result.promotion = { partial: oldPromotion.value, omitted: result.omitted.promotion.value, full: allPromotion.value,
    shop: String(shop.tghf), resolved: equal(decimalSum([oldPromotion.value, result.omitted.promotion.value]), allPromotion.value)
      && equal(allPromotion.value, shop.tghf) };
  result.refund = { partial: oldRefund.value, omitted: result.omitted.refund.value, full: allRefund.value,
    shop: String(shop.thtkje), resolved: equal(decimalSum([oldRefund.value, result.omitted.refund.value]), allRefund.value)
      && equal(allRefund.value, shop.thtkje) };
  result.netSales = { computedFromDetails: net, fullDisplay: full.netGmv, shopDisplay: shop.netGmv,
    resolved: matchesDisplay(net, full.netGmv) && equal(full.netGmv, shop.netGmv) };
  const netCost = detail(full, "lstNetHpCost"), salesCost = detail(full, "lstSaleCost");
  const delivery = detail(full, "lstDeliverCost"), other = detail(shop, "lstOtherCost"), custom = detail(shop, "lstZdyFyAll");
  const beforeCustom = decimalSubtract(net, netCost.value, salesCost.value, delivery.value, other.value);
  const afterCustom = decimalSubtract(beforeCustom, custom.value);
  result.profit = {
    netSales: net, netProductCost: netCost.value, salesExpenses: salesCost.value,
    deliveryExpenses: delivery.value, otherExpenses: other.value,
    customExpenses: custom.value, customComponents: (shop.lstZdyFyAll || []).map(part => ({ name: part.name, amount: part.originCost ?? part.cost })),
    beforeCustom, fullDisplay: full.profit, afterCustom, shopDisplay: shop.profit,
    originComplete: [allGmv, invalid, allRefund, netCost, salesCost, delivery, other, custom].every(value => value.originComplete),
    resolved: matchesDisplay(beforeCustom, full.profit) && matchesDisplay(afterCustom, shop.profit)
  };
  result.readyForShopAggregation = [result.promotion, result.refund, result.netSales, result.profit].every(check => check.resolved)
    && result.profit.originComplete && result.omitted.promotion.originComplete && result.omitted.refund.originComplete;
  result.status = result.readyForShopAggregation ? "reconciled_for_this_shop_day" : "unresolved_differences";
  result.evidence = [operating, hotGoods, ...fullPages, fullTotal].map(record => ({ id: record.id, reportId: record.reportId, page: record.page, requestHash: record.requestHash }));
  return result;
}

// Offline audit of the current contracts. No credentials, network calls or changes to raw responses.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directory = process.argv[2];
  if (!directory) throw new Error("请提供单店采集存档根目录");
  const collector = createShopDayCollector({ directory, request: () => { throw new Error("离线核对不允许采集"); } });
  const fullPages = [];
  for (let page = 1; page <= 10; page++) {
    const record = await collector.getRecord({ reportId: "shop_goods_page", page });
    if (!record) break;
    fullPages.push(record);
    if (!record.nextPage) break;
  }
  const result = reconcileShopDay({
    operating: await collector.getRecord({ reportId: "channel_operating" }),
    hotGoods: await collector.getRecord({ reportId: "channel_goods" }),
    fullTotal: await collector.getRecord({ reportId: "shop_goods_total" }), fullPages
  });
  const output = join((await collector.status()).directory, "reconciliation.json");
  await writeFile(output, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify({ status: result.status, coverage: result.coverage, promotion: result.promotion,
    refund: result.refund, netSales: result.netSales, profit: result.profit, output }, null, 2));
}
