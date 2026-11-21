// Read-only contracts checked against the BI's public page bundles on 2026-11-21.
// This stage deliberately permits one shop/day, and never the historical batch.
export const SHOP_DAY = Object.freeze({ platform: "JD", shopId: "16501691", shopName: "RASW潮流生活京选菀瑶专卖店", date: "2026-10-03" });
export const DAY_REPORTS = Object.freeze([
  // Separate, explicit probes for the four-page acceptance. Never join the
  // existing 1,544-task product batch or issue account-wide overview requests.
  { id: "channel_shop_table", label: "单店列表", path: "/v2/channel/shopOverViewList", shape: "table", manual: true, stage: "four_pages" },
  { id: "key_graph", label: "关键指标卡和趋势", path: "/v2/channel/shop/card-graph", shape: "key_graph", manual: true, stage: "four_pages", access: "qd_gjzbfx" },
  { id: "key_shops", label: "关键指标按店铺", path: "/v2/channel/channelAnalysisShopOverview", shape: "table", manual: true, stage: "four_pages", metric: true, access: "qd_gjzbfx" },
  { id: "key_goods", label: "关键指标按链接", path: "/v2/goods/channelAnalysisGoodsList", shape: "table", paged: true, identity: "goodsId", overview: true, manual: true, stage: "four_pages", metric: true, access: "qd_gjzbfx" },
  { id: "shop_goods_period", label: "商品 SKU 周期", path: "/v2/goods/trendOverViewPageList", shape: "period", paged: true, identity: "goodsId", overview: true, manual: true, stage: "four_pages", access: "sp_zl" },
  { id: "shop_spu_period", label: "商品 SPU 周期", path: "/v2/goods/trendOverViewPageListBySpu", shape: "period", paged: true, identity: "spuid", overview: true, manual: true, stage: "four_pages", access: "sp_zl" },
  { id: "channel_operating", label: "经营数据", path: "/v2/channel/shop/operatingData", shape: "series" },
  { id: "channel_goods", label: "商品详情", path: "/v2/channel/hotGoods", shape: "table" },
  { id: "channel_category", label: "品类分析", path: "/v2/channel/cateAnalysis", shape: "table" },
  { id: "channel_labels", label: "标签分析", path: "/v2/channel/labelAnalysis/comparisonList", shape: "table", paged: true },
  { id: "channel_label_sum", label: "标签汇总", path: "/v2/channel/labelAnalysis/comparisonSum", shape: "table" },
  { id: "channel_area", label: "销售地域", path: "/v2/channel/shopAreaAnalysis", shape: "table" },
  { id: "channel_hour", label: "销售时段", path: "/v2/channel/shopHourAnalysis", shape: "table" },
  { id: "product_overview", label: "商品经营总览", path: "/v2/goods/overallOverview", shape: "series", product: true },
  { id: "product_skus", label: "商品 SKU 销售", path: "/v2/goods/overallGoodsSku", shape: "table", product: true },
  { id: "product_area", label: "商品销售地域", path: "/v2/goods/overallArea", shape: "table", product: true },
  { id: "product_hour", label: "商品销售时段", path: "/v2/goods/overallHour", shape: "table", product: true },
  // Product Overview's current-page and all-results totals are separate requests.
  // Checked in useAnalysisNewStore-CaAStSZN.js: bt -> wo, Ve -> lc.
  { id: "shop_goods_page", label: "全店商品分页明细", path: "/v2/goods/overViewPageList", shape: "table", paged: true, access: "sp_zl" },
  { id: "shop_goods_total", label: "全店商品全部合计", path: "/v2/goods/overViewPageListSumData", shape: "table", access: "sp_zl" },
  { id: "shop_spu_page", label: "全店 SPU 分页明细", path: "/v2/goods/spuOverView", shape: "table", paged: true, access: "sp_zl", overview: true, identity: "spuid" },
  { id: "shop_spu_total", label: "全店 SPU 全部合计", path: "/v2/goods/spuOverViewSum", shape: "table", access: "sp_zl", overview: true },
  { id: "shop_categories", label: "商品总览指定品类明细", path: "/v2/goods/cateOverViewPageList", shape: "table", paged: true, access: "sp_zl", overview: true, requiresSelection: "category" },
  { id: "shop_cards_sku", label: "商品分类卡片（SKU）", path: "/v2/goods/card/queryCardInfo", shape: "cards", access: "sp_zl" },
  { id: "shop_cards_spu", label: "商品分类卡片（SPU）", path: "/v2/goods/card/queryCardInfo", shape: "cards", access: "sp_zl" },
  { id: "product_operation", label: "商品运营总览", path: "/v2/goodsOperation/overView", shape: "series", product: true, access: "sp_yyfx", method: "form" },
  { id: "product_operation_skus", label: "商品运营 SKU", path: "/v2/goodsOperation/skuView", shape: "table", product: true, access: "sp_yyfx", method: "json" },
  { id: "product_operation_area", label: "商品运营地域", path: "/v2/goodsOperation/cityView", shape: "table", product: true, access: "sp_yyfx", method: "json" },
  { id: "product_operation_hour", label: "商品运营时段", path: "/v2/goodsOperation/timeView", shape: "tables", product: true, access: "sp_yyfx", method: "json" },
  { id: "product_promotion", label: "商品推广分析", path: "/goodsOperation/promoteView", shape: "promotion", product: true, access: "sp_yyfx", method: "json" },
  // Sample these separately before adding them to the bulk job. Their selectors
  // must come from the same product's already collected promotion response.
  { id: "product_promotion_trend", label: "商品推广趋势（待逐笔核验）", path: "/goodsOperation/promoteViewQsCard", shape: "dated_table", product: true, access: "sp_yyfx", method: "json", manual: true },
  { id: "product_promotion_plan", label: "推广计划趋势（待逐笔核验）", path: "/goodsOperation/promoteViewQs", shape: "dated_rows", product: true, access: "sp_yyfx", method: "json", manual: true }
]);
export const DAY_EXCLUSIONS = Object.freeze([
  { label: "店铺列表", status: "not_applicable", reason: "旧站仅在未选定单店时显示" },
  { label: "业绩对比", status: "outside_day_scope", reason: "旧站按年度查询，本轮仅采一天" },
  ...["流量来源", "流量分析", "主播达人分析", "素材分析"].map(label => ({ label, status: "not_applicable", reason: "旧站限定抖音平台，当前为京东" })),
  { label: "商品跨渠道及库存", status: "outside_day_scope", reason: "跨店或当前库存口径不等于本店当日数据" }
]);

export function validShopDay(scope) {
  return scope && /^[A-Z]{2,8}$/.test(scope.platform || "") && /^\d{1,24}$/.test(scope.shopId || "")
    && typeof scope.shopId === "string" && /^\d{4}-\d{2}-\d{2}$/.test(scope.date || "")
    && Number.isFinite(Date.parse(scope.date)) && new Date(scope.date).toISOString().slice(0, 10) === scope.date
    && scope.date >= "2026-09-01";
}

export function shopDayRequest(input, scope = SHOP_DAY, maxPages = 10) {
  if (!validShopDay(scope)) return null;
  if (!input || Object.keys(input).some(key => !["reportId", "page", "goodsId", "cardId", "categoryPath", "promoteKeys", "planId", "promoteKey", "columnKey", "trendDays"].includes(key))) return null;
  const report = DAY_REPORTS.find(item => item.id === input.reportId);
  const page = input.page ?? 1;
  if (!report || !Number.isInteger(page) || page < 1 || page > maxPages || (!report.paged && page !== 1)) return null;
  if (report.metric ? typeof input.columnKey !== "string" || !/^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(input.columnKey) : input.columnKey !== undefined) return null;
  if (report.shape === "period" ? ![7, 15].includes(input.trendDays) : input.trendDays !== undefined) return null;
  if (report.product ? !/^[A-Za-z0-9_-]{1,80}$/.test(input.goodsId || "") : input.goodsId !== undefined) return null;
  if (input.cardId !== undefined && (!["shop_goods_page", "shop_goods_total", "shop_spu_page", "shop_spu_total"].includes(report.id) || typeof input.cardId !== "string" || !/^[1-9]\d{0,15}$/.test(input.cardId) || !Number.isSafeInteger(Number(input.cardId)))) return null;
  if (input.categoryPath !== undefined && (report.id !== "shop_categories" || typeof input.categoryPath !== "string" || !/^\d+(>\d+){0,5}$/.test(input.categoryPath))) return null;
  if (report.id === "product_promotion_trend") {
    if (!Array.isArray(input.promoteKeys) || !input.promoteKeys.length || input.promoteKeys.length > 30 || input.promoteKeys.some(k => typeof k !== "string" || !/^[A-Za-z0-9_]{1,60}$/.test(k) || k === "wxd")) return null;
  } else if (input.promoteKeys !== undefined) return null;
  if (report.id === "product_promotion_plan") {
    if (typeof input.planId !== "string" || !/^\d{1,30}$/.test(input.planId) || typeof input.promoteKey !== "string" || !/^[A-Za-z0-9_]{1,60}$/.test(input.promoteKey) || input.promoteKey === "wxd") return null;
  } else if (input.planId !== undefined || input.promoteKey !== undefined) return null;
  const { platform, shopId, date } = scope;
  let body = { platform, shopId, startDate: date, endDate: date, daysType: "1" };
  if (report.id.startsWith("shop_goods_") || report.overview) body = {
    startDate: date, endDate: date, daysType: "1", shopId: "",
    shopList: [{ platform, shopId }], filterCondition: [], orderCondition: [],
    exportMode: "", isSku: false,
    ...(report.paged ? { pageNum: page, pageSize: 100 } : {})
  };
  else if (report.shape === "cards") body = {
    startDate: date, endDate: date, daysType: "1", shopIdList: [{ platform, shopId }],
    goodsIdList: [], cardViewOperation: 1, isSpu: report.id === "shop_cards_spu", offset: 0, pageSize: 18
  };
  else if (report.product) body = { ...body, goodsId: input.goodsId, spuid: "" };
  else if (report.id === "key_graph") body = { startDate: date, endDate: date, daysType: "1", shopIds: [{ channel: platform, shopId }], queryType: 2 };
  else if (["channel_shop_table", "key_shops"].includes(report.id)) body = {
    startDate: date, endDate: date, daysType: "1", shopId, platform,
    shopIds: [{ channel: platform, shopId }], filterCondition: [], orderCondition: [], showTrendView: false
  };
  else if (report.id.startsWith("channel_label")) body = {
    startDate: date, endDate: date, daysType: "1", queryType: 2,
    shopIds: [{ channel: platform, shopId }], flagIds: [], flagType: 0, pageNum: page, pageSize: 100
  };
  else if (!["channel_area", "channel_hour"].includes(report.id)) {
    body = { ...body, queryType: 2, exportMode: "" };
    if (report.id === "channel_goods") body.showTrendView = false;
  }
  // Verified in useAnalysisNewStore: yt() passes the selected cardId to both
  // list and all-total requests. The collector also validates account-owned IDs.
  if (input.cardId !== undefined) body.cardId = Number(input.cardId);
  if (input.categoryPath !== undefined) body.filterCondition = [{ name: "lmidsList", value: JSON.stringify([{ qd: platform, list: [input.categoryPath] }]) }];
  if (input.promoteKeys) body.promoteKeyList = input.promoteKeys;
  if (input.planId) { body.planId = input.planId; body.promoteKey = input.promoteKey; }
  if (input.columnKey) body.columnKey = input.columnKey;
  if (input.trendDays === 15) body.trendDays = 15;
  return { method: report.method || (report.product ? "form" : "json"), path: report.path,
    access: report.access || (report.product ? "sp_qj" : "qd_fx"), body,
    referer: `https://hejun.ecbis.cn/workTable/${report.access === "qd_gjzbfx" ? "channelAnalysisNew" : report.overview || report.id.startsWith("shop_") ? "productOverview" : report.access === "sp_yyfx" ? "productOperation" : report.product ? "productPanorama" : "channelAnalysis"}` };
}
