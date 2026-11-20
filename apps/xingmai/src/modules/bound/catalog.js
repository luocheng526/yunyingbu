export const START_ON = "2026-09-01";
export const PAGE_SIZE = 50;
export const ORIGIN = "https://hejun.ecbis.cn";
export const API_ORIGIN = "https://biprodapi.ecbis.cn/prod";

const list = (id, label, path, method, access, extra = {}) => ({
  id,
  label,
  path,
  method,
  access,
  kind: extra.kind || "list",
  dims: extra.dims || ["all"],
  group: extra.group || "",
  sumPath: extra.sumPath || "",
  sumMethod: extra.sumMethod || method
});

export const PAGES = [
  {
    id: "channelOverview",
    module: "channel",
    label: "渠道总览",
    route: "/workTable/channelOverview",
    ops: ["date", "shop", "tabs", "search", "expand", "export", "sums"],
    tabs: [
      list("qdzl_lb", "渠道列表", "/v2/channel/channelOverViewList", "json", "qd_zl"),
      list("qdzl_fz", "店铺分组", "/v2/channel/shopGroupOverViewList_v2", "json", "qd_zl"),
      list("qdzl_jy", "经营数据", "/v2/channel/operatingData", "json", "qd_zl", { kind: "object" }),
      list("qdzl_yj", "业绩对比", "/v2/channel/dynamicChannelAnalysis", "json", "qd_zl"),
      list("qdzl_pl", "品类分析", "/v2/channel/channelCateAnalysis", "json", "qd_zl"),
      list("qdzl_bqfx", "标签分析", "/v2/channel/labelAnalysis/comparisonList", "json", "qd_zl"),
      list("qdzl_rx", "热销商品", "/v2/channel/hotGoods", "json", "qd_zl"),
      list("qdzl_zbdrfx", "主播达人分析", "/v2/flow/channel/anchorExpertListInfo", "json", "qd_zl")
    ]
  },
  {
    id: "channelAnalysis",
    module: "channel",
    label: "渠道详情",
    route: "/workTable/channelAnalysis",
    ops: ["date", "shop", "tabs", "search", "expand", "export", "sums"],
    tabs: [
      list("qdfx_dplb", "店铺列表", "/v2/channel/shopOverViewList_V2", "json", "qd_fx"),
      list("qdfx_jy", "经营数据", "/v2/channel/shop/operatingData", "json", "qd_fx", { kind: "object" }),
      list("qdfx_yj", "业绩对比", "/v2/channel/dynamicDetailAnalysis", "json", "qd_fx"),
      list("qdfx_llly", "流量来源", "/v2/flow/source/channel/flowSourceListInfo", "json", "qd_fx"),
      list("qdfx_llfx", "流量分析", "/v2/flow/channel/flowChannelAnalyzeExpert", "json", "qd_fx"),
      list("qdfx_zbdr", "主播达人分析", "/v2/flow/channel/anchorExpertListInfo", "json", "qd_fx"),
      list("qdfx_scfx", "素材分析", "/v2/channel/materialPageListInfo", "json", "qd_fx"),
      list("qdfx_pl", "品类分析", "/v2/channel/shopCateAnalysis", "json", "qd_fx"),
      list("qdfx_bqfx", "标签分析", "/v2/channel/labelAnalysis/comparisonList", "json", "qd_fx"),
      list("qdfx_rx", "热销商品", "/v2/channel/hotGoods", "json", "qd_fx"),
      list("qdfx_area", "销售地域分析", "/v2/channel/shopAreaAnalysis", "json", "qd_fx"),
      list("qdfx_hour", "销售时段分析", "/v2/channel/shopHourAnalysis", "json", "qd_fx")
    ]
  },
  {
    id: "channelAnalysisNew",
    module: "channel",
    label: "关键指标分析",
    route: "/workTable/channelAnalysisNew",
    ops: ["date", "shop", "tabs", "search", "expand", "export", "sums"],
    tabs: [
      list("qd_gjzbfx_ljck", "按链接查看", "/v2/channel/dynamicDetailAnalysis", "json", "qd_gjzbfx"),
      list("qd_gjzbfx_dpck", "按店铺查看", "/v2/channel/shopOverViewList_V2", "json", "qd_gjzbfx"),
      list("qd_gjzbfx_qdck", "按渠道查看", "/v2/channel/channelList", "json", "qd_gjzbfx")
    ]
  },
  {
    id: "productOverview",
    module: "goods",
    label: "商品总览",
    route: "/workTable/productOverview",
    ops: ["date", "shop", "cards", "dim", "tabs", "search", "expand", "views", "export", "sums", "follow", "tag", "target"],
    cards: list("sp_zl_cards", "指标卡片", "/v2/goods/coreIndicator", "form", "sp_zl", { kind: "object" }),
    tabs: [
      list("sp_zl_list", "商品列表", "/v2/goods/overViewPageList", "json", "sp_zl", {
        dims: ["sku", "spu"],
        sumPath: "/v2/goods/overViewPageListSumData"
      }),
      list("sp_zl_cate", "品类分析", "/v2/goods/cateOverViewPageList", "json", "sp_zl"),
      list("sp_zl_area", "地域分析", "/v2/goods/overallArea", "form", "sp_zl"),
      list("sp_zl_hour", "销售时段分析", "/v2/goods/overallHour", "form", "sp_zl"),
      list("sp_zl_trend", "周期", "/v2/goods/trendOverViewPageList", "json", "sp_zl", { dims: ["sku", "spu"] })
    ]
  },
  {
    id: "productPanorama",
    module: "goods",
    label: "商品全景分析",
    route: "/workTable/productPanorama",
    ops: ["date", "shop", "tabs", "search", "expand", "export", "sums"],
    tabs: [
      list("spqj_zl", "总览数据", "/v2/goods/overallOverview", "form", "sp_qj", { kind: "object" }),
      list("spqj_qdbj", "渠道布局分析", "/v2/goods/overallChannel", "form", "sp_qj"),
      list("spqj_qqd", "SKU全渠道分析", "/v2/goods/overallGoodsSku", "form", "sp_qj"),
      list("spqj_sku", "SKU销售分析", "/v2/goods/overallSku", "form", "sp_qj"),
      list("spqj_area", "销售地域分析", "/v2/goods/overallArea", "form", "sp_qj"),
      list("spqj_hour", "销售时段分析", "/v2/goods/overallHour", "form", "sp_qj"),
      list("spqj_kc", "商品库存数据", "/v2/goods/allGoodsStock", "json", "sp_qj")
    ]
  },
  {
    id: "productOperation",
    module: "goods",
    label: "商品运营分析",
    route: "/workTable/productOperation",
    ops: ["date", "shop", "tabs", "search", "expand", "export", "sums"],
    tabs: [
      list("spyy_zl", "总览数据", "/v2/goodsOperation/overView", "form", "sp_yyfx", { kind: "object" }),
      list("spyy_ll", "流量来源", "/v2/flow/source/goods/flowSourceListInfo", "json", "sp_yyfx"),
      list("spyy_ss", "搜索分析", "/goodsOperation/searchTrends", "json", "sp_yyfx"),
      list("spyy_bt", "标题优化", "/goodsOperation/getContrastTitleList", "json", "sp_yyfx"),
      list("spyy_tg", "推广分析", "/goodsOperation/promoteView", "json", "sp_yyfx"),
      list("spyy_sku", "SKU分析", "/v2/goodsOperation/skuView", "json", "sp_yyfx"),
      list("spyy_area", "地域分析", "/v2/goodsOperation/cityView", "json", "sp_yyfx"),
      list("spyy_hour", "时段分析", "/v2/goodsOperation/timeView", "json", "sp_yyfx"),
      list("spyy_llfx", "流量分析", "/v2/flow/goods/flowChannelAnalyzeExpert", "json", "sp_yyfx"),
      list("spyy_zbdr", "主播达人分析", "/v2/flow/goods/anchorExpertListInfo", "json", "sp_yyfx"),
      list("spyy_scfx", "素材分析", "/v2/goods/materialPageListInfo", "json", "sp_yyfx")
    ]
  },
  {
    id: "productStock",
    module: "goods",
    label: "商品库存分析",
    route: "/workTable/productStock",
    ops: ["date", "shop", "search", "expand", "export", "sums"],
    tabs: [list("sp_kc", "商品总库存数据", "/goods/goodsStock", "form", "sp_kc")]
  },
  {
    id: "hpOverview",
    module: "hp",
    label: "货品总览",
    route: "/workTable/hpOverview",
    ops: ["date", "shop", "search", "cards", "export", "sums"],
    cards: list("hp_zl_cards", "货品综合指标", "/hp/coreIndicator", "json", "hp_zl", { kind: "object" }),
    tabs: [
      list("hp_zl_list", "货品", "/hp/hpOverView", "json", "hp_zl", {
        sumPath: "/v2/Hp/overViewPageListSumData"
      }),
      list("hp_zl_ks", "款式", "/ks/ksOverView", "json", "hp_zl"),
      list("hp_zl_pp", "品牌", "/hp/attribute/pp/page", "json", "hp_zl"),
      list("hp_zl_hpfl", "ERP分类", "/hp/attribute/hpfl/page", "json", "hp_zl"),
      list("hp_zl_xnfl", "ERP虚拟分类", "/hp/attribute/xnfl/page", "json", "hp_zl"),
      list("hp_zl_fhck", "发货仓库", "/hp/attribute/fhck/page", "json", "hp_zl")
    ]
  },
  {
    id: "hpPanorama",
    module: "hp",
    label: "货品全景分析",
    route: "/workTable/hpPanorama",
    ops: ["date", "shop", "search", "tabs", "export", "sums"],
    tabs: [
      list("hp_qj_zl", "总览数据", "/hp/getOperateData", "json", "hp_qj", { kind: "object", group: "hp" }),
      list("hp_qj_qd", "渠道布局分析", "/hp/hpAllChannelData", "json", "hp_qj", { group: "hp" }),
      list("hp_qj_layout", "商品布局分析", "/hp/hpProductLayoutAnalysisData", "json", "hp_qj", { group: "hp" }),
      list("hp_qj_sku", "SKU全渠道分析", "/hp/hpSkuData", "json", "hp_qj", { group: "hp" }),
      list("hp_qj_kc", "货品库存数据", "/hp/hpStock", "json", "hp_qj", { group: "hp" }),
      list("hp_qj_pp", "品牌分析", "/hp/attribute/pp/page", "json", "hp_qj", { group: "hp" }),
      list("hp_qj_ck", "发货仓库分析", "/hp/warehouseAnalysisPage", "json", "hp_qj", { group: "hp" }),
      list("hp_qj_ks_zl", "总览数据", "/ks/getOperateData", "json", "hp_qj", { kind: "object", group: "ks" }),
      list("hp_qj_ks_hp", "货品数据", "/ks/getRelatedHpDataPage", "json", "hp_qj", { group: "ks" }),
      list("hp_qj_ks_qd", "渠道布局分析", "/ks/ksAllChannelData", "json", "hp_qj", { group: "ks" }),
      list("hp_qj_ks_layout", "商品布局分析", "/ks/ksProductLayoutAnalysisData", "json", "hp_qj", { group: "ks" }),
      list("hp_qj_ks_pp", "品牌分析", "/hp/attribute/pp/page", "json", "hp_qj", { group: "ks" }),
      list("hp_qj_ks_ck", "发货仓库分析", "/ks/warehouseAnalysisPage", "json", "hp_qj", { group: "ks" })
    ]
  },
  {
    id: "hpStock",
    module: "hp",
    label: "货品库存数据",
    route: "/workTable/hpStock",
    ops: ["date", "search", "cards", "export", "sums"],
    cards: list("hp_kc_cards", "货品总库存综合指标", "/hp/newStockIndicator", "json", "hp_kc", { kind: "object" }),
    tabs: [list("hp_kc_list", "货品总库存数据", "/v2/hp/allHpStock", "json", "hp_kc")]
  },
  {
    id: "teamOverview",
    module: "team",
    label: "团队总览",
    route: "/workTable/teamOverview",
    ops: ["date", "shop", "tabs", "search", "expand", "export", "sums"],
    tabs: [
      list("td_zl_ljgl", "链接管理", "/v2/team/manageLinkListNew", "form", "td_zl"),
      list("td_zl_dpgl", "店铺管理", "/v2/team/manageShopListNew", "form", "td_zl"),
      list("td_zl_yjdb", "业绩对比", "/team/getAchievementCompare", "form", "td_zl"),
      list("td_zl_cy", "个人榜单", "/team/memberRank", "json", "td_zl"),
      list("td_zl_lb", "团队榜单", "/teamOverview/getTeamList", "form", "td_zl")
    ]
  },
  {
    id: "teamSkills",
    module: "team",
    label: "岗位能力评估",
    route: "/workTable/teamSkills",
    ops: ["date", "search", "expand", "export", "sums"],
    tabs: [list("td_gwnl", "岗位能力评估", "/team/postAssess", "form", "td_zl")]
  },
  {
    id: "teamMemberDetail",
    module: "team",
    label: "团队详情",
    route: "/workTable/teamMemberDetail",
    ops: ["date", "shop", "tabs", "search", "expand", "export", "sums"],
    tabs: [
      list("td_cyxq_glsp", "管理商品", "/v2/team/getManageSpuList", "form", "td_cyxq"),
      list("td_cyxq_zqsp", "责权商品", "/v2/team/getResponsibleSpuList", "form", "td_cyxq"),
      list("td_cyxq_gldp", "管理店铺", "/v2/team/manageShopListNew", "form", "td_cyxq"),
      list("td_cyxq_zqdp", "责权店铺", "/v3/team/overViewList", "form", "td_cyxq"),
      list("td_cyxq_gltd", "管理团队", "/teamOverview/getTeamList", "form", "td_cyxq"),
      list("td_cyxq_glkf", "管理客服", "/v2/team/glCustomerServiceList", "form", "td_cyxq"),
      list("td_cyxq_fzkf", "负责客服", "/v2/team/zqCustomerServiceList", "form", "td_cyxq"),
      list("td_cyxq_gllm", "管理类目", "/v2/team/getGlCategories", "json", "td_cyxq"),
      list("td_cyxq_zqlm", "责权类目", "/v2/team/getZqCategories", "json", "td_cyxq")
    ]
  },
  {
    id: "teamMemberProfile",
    module: "team",
    label: "成员档案",
    route: "/workTable/teamMemberProfile",
    ops: ["search", "expand", "export"],
    tabs: [list("td_cyda", "成员档案", "/teamOverview/getTeamMemberList", "form", "td_cyxq")]
  },
  {
    id: "myProjects",
    module: "mine",
    label: "我的项目",
    route: "/workTable/workTableHome",
    ops: ["search", "expand"],
    tabs: [],
    local: "projects"
  },
  {
    id: "personalCenter",
    module: "mine",
    label: "个人中心",
    route: "/workTable/personalCenter",
    ops: ["expand"],
    tabs: [],
    local: "profile"
  }
];

export const MODULES = [
  { id: "channel", label: "渠道" },
  { id: "goods", label: "商品" },
  { id: "hp", label: "货品" },
  { id: "team", label: "团队" },
  { id: "mine", label: "我的" }
];

export const MASTERS = [
  { id: "profile", label: "个人资料", path: "/auth/info", method: "get", kind: "object" },
  { id: "perms", label: "菜单权限", path: "/auth/userPerm/gzt", method: "get", kind: "object" },
  { id: "projects", label: "我的项目", path: "/auth/userPerm/project", method: "get", kind: "list" },
  { id: "shops", label: "店铺", path: "/v2/channel/getAllChannelList", method: "get", kind: "list" },
  { id: "teams", label: "团队", path: "/teamOverview/getTeamList", method: "form", kind: "list" },
  { id: "members", label: "成员", path: "/teamOverview/getUserList", method: "get", kind: "list" },
  { id: "goods", label: "商品资料", path: "/goods/search", method: "get", kind: "list" }
];

export const GOODS_COLUMNS = [
  { key: "name", label: "商品", aliases: ["goodsName", "name", "title", "spuName", "styleName"] },
  { key: "shop", label: "店铺", aliases: ["shopName", "shop", "channelName"] },
  { key: "owner", label: "负责人", aliases: ["leaderName", "fzrName", "ownerName", "managerName", "userName"] },
  { key: "saleCount", label: "销售件数", aliases: ["saleCount", "salesVolume", "saleQty", "netGoodsCount"], numeric: true },
  { key: "visitor", label: "访客数", aliases: ["visitor", "visitors", "uv", "visitorCount"], numeric: true },
  { key: "pv", label: "浏览量", aliases: ["pv", "pageView", "viewCount"], numeric: true },
  { key: "dealCount", label: "成交件数", aliases: ["dealCount", "cjjs", "payGoodsCount"], numeric: true },
  { key: "payUsers", label: "支付人数", aliases: ["payUsers", "payBuyer", "buyerCount", "payUserCount"], numeric: true },
  { key: "netPayUsers", label: "净支付人数", aliases: ["netPayUsers", "netBuyerCount"], numeric: true },
  { key: "payAmount", label: "销售金额", aliases: ["payAmount", "saleAmount", "gmv", "payMoney"], numeric: true, money: true },
  { key: "refundAmount", label: "退款金额", aliases: ["refundAmount", "refundMoney"], numeric: true, money: true },
  { key: "refundRate", label: "退款率", aliases: ["refundRate"], numeric: true, rate: true },
  { key: "saleCost", label: "商品成本", aliases: ["saleCost", "xshf"], numeric: true, money: true },
  { key: "cost", label: "推广花费", aliases: ["cost", "tghf"], numeric: true, money: true },
  { key: "profit", label: "利润", aliases: ["profit", "lryg"], numeric: true, money: true },
  { key: "orderType", label: "订单类型", aliases: ["orderType", "orderKind", "ddlx"] },
  { key: "service", label: "服务体验", aliases: ["serviceScore", "experience", "fwty"] }
];

export const STOCK_COLUMNS = [
  { key: "hpName", label: "货品名称", aliases: ["hpName", "goodsName", "name", "styleName"] },
  { key: "code", label: "货品编码", aliases: ["hpCode", "goodsCode", "code"] },
  { key: "styleCode", label: "款式编码", aliases: ["styleCode", "ksCode"] },
  { key: "goodsId", label: "商品ID", aliases: ["goodsId", "spuId", "productId"] },
  { key: "goodsName", label: "商品名称", aliases: ["spuName", "productName"] },
  { key: "stock", label: "库存数量", aliases: ["stock", "stockCount", "kcsl"], numeric: true },
  { key: "stockAmount", label: "库存金额", aliases: ["stockAmount", "kcje"], numeric: true, money: true }
];

export const GOODS_CARDS = [
  { key: "visitor", label: "访客数", aliases: ["visitor", "visitors", "uv", "visitorCount"] },
  { key: "payRate", label: "支付转化率", aliases: ["payRate", "payConvRate", "conversionRate"], rate: true },
  { key: "unitPrice", label: "客单价", aliases: ["unitPrice", "atv", "perCustomer"], money: true },
  { key: "payUsers", label: "支付人数", aliases: ["payUsers", "payBuyer", "buyerCount"] },
  { key: "saleCount", label: "销售件数", aliases: ["saleCount", "salesVolume", "saleQty"] },
  { key: "payAmount", label: "支付金额", aliases: ["payAmount", "gmv", "saleAmount"], money: true },
  { key: "refundAmount", label: "退款金额", aliases: ["refundAmount", "refundMoney"], money: true },
  { key: "refundRate", label: "退款率", aliases: ["refundRate"], rate: true }
];

export const CHANNEL_COLUMNS = [
  { key: "name", label: "渠道", aliases: ["channelName", "platformName", "name", "title"] },
  { key: "realTimeGmv", label: "实时销售指数", aliases: ["realTimeGmv", "ssxse"], numeric: true, money: true },
  { key: "payAmount", label: "支付金额(支付)", aliases: ["payAmount", "gmv", "xse"], numeric: true, money: true },
  { key: "noOrderAmount", label: "无订单金额(支付)", aliases: ["noOrderAmount", "wddje", "invalidOrderAmount", "invalidGmv", "zgxse"], numeric: true, money: true },
  { key: "netGmv", label: "净销售额(支付)", aliases: ["netGmv", "jxse"], numeric: true, money: true },
  { key: "sales", label: "销售件数(支付)", aliases: ["sales", "xsjs", "saleCount"], numeric: true },
  { key: "refund", label: "退款数", aliases: ["refund", "refundCount", "thtkjs"], numeric: true },
  { key: "shipRefundRate", label: "已发货退款率(退款金额)", aliases: ["shipRefundRate", "yfhtkl", "yfhTkl"], numeric: true, rate: true },
  { key: "refundRate", label: "退款率(退款金额)", aliases: ["refundRate", "tkl"], numeric: true, rate: true },
  { key: "netHpCost", label: "净商品成本(支付)", aliases: ["netHpCost", "jhpcb"], numeric: true, money: true },
  { key: "jhpcbzb", label: "净商品成本占比(支付)", aliases: ["jhpcbzb"], numeric: true, rate: true },
  { key: "cost", label: "推广花费(支付预估)", aliases: ["cost", "tghf"], numeric: true, money: true },
  { key: "tghfXseZb", label: "推广花费销售占比(支付预估)", aliases: ["tghfXseZb"], numeric: true, rate: true },
  { key: "profit", label: "利润(支付预估)", aliases: ["profit", "lryg"], numeric: true, money: true, solid: true },
  { key: "grossRate", label: "大毛利率", aliases: ["grossRate", "dml", "dmll"], numeric: true, rate: true, solid: true }
];

export const CHANNEL_CARDS = [
  { key: "realTimeGmv", label: "实时销售指数", aliases: ["realTimeGmv", "ssxse"], money: true, note: "实时指数，不按所选日期累加" },
  { key: "payAmount", label: "支付金额(支付)", aliases: ["payAmount", "gmv", "xse"], money: true, note: "达成率 —" },
  { key: "netGmv", label: "净销售额(支付)", aliases: ["netGmv", "jxse"], money: true, note: "达成率 —" },
  { key: "tghfXseZb", label: "推广花费销售占比(支付)", aliases: ["tghfXseZb"], rate: true, note: "净销售额占比 —" },
  { key: "netHpCost", label: "净商品成本(支付)", aliases: ["netHpCost", "jhpcb"], money: true, note: "净商品成本占比 —" },
  { key: "refundRate", label: "退款率(退款金额)", aliases: ["refundRate", "tkl"], rate: true, note: "退款目标 —" },
  { key: "platformCost", label: "平台花费(支付预估)", aliases: ["platformCost", "ptCost", "pthf"], money: true, note: "平台花费占比 —" },
  { key: "profit", label: "毛利(支付预估)", aliases: ["profit", "lryg"], money: true, note: "毛利率 —" },
  { key: "cost", label: "推广花费(支付预估)", aliases: ["cost", "tghf"], money: true, note: "推广花费率 —" },
  { key: "selfShipFee", label: "自发货费用", aliases: ["selfShipFee", "zfhfy", "fhfyZf", "deliverCost"], money: true, note: "" },
  { key: "grossRate", label: "大毛利率", aliases: ["grossRate", "dml", "dmll"], rate: true, note: "" },
  { key: "jdFeeRate", label: "京东费用占比", aliases: ["jdFeeRate", "jdfyzb"], rate: true, note: "京东费用占比 —" },
  { key: "otherFee", label: "其他费用(支付)", aliases: ["otherFee", "qtfy", "qtfyZf", "otherCost"], money: true, note: "其他费用占比 —" }
];

export const TEAM_COLUMNS = [
  { key: "name", label: "名称", aliases: ["teamName", "userName", "name", "title"] },
  { key: "owner", label: "负责人", aliases: ["leaderName", "fzrName", "ownerName", "userName"] },
  { key: "shop", label: "店铺", aliases: ["shopName", "shop", "channelName"] },
  { key: "payAmount", label: "销售金额", aliases: ["payAmount", "gmv", "saleAmount"], numeric: true, money: true },
  { key: "sales", label: "销售件数", aliases: ["sales", "xsjs", "saleCount"], numeric: true },
  { key: "cost", label: "推广花费", aliases: ["cost", "tghf"], numeric: true, money: true },
  { key: "profit", label: "利润", aliases: ["profit", "lryg"], numeric: true, money: true }
];

export const HP_COLUMNS = [
  { key: "name", label: "货品", aliases: ["hpName", "goodsName", "name", "title", "styleName"] },
  { key: "code", label: "货品编码", aliases: ["hpCode", "skuCode", "goodsCode", "styleCode", "code"] },
  { key: "shop", label: "店铺", aliases: ["shopName", "shop", "channelName"] },
  { key: "stock", label: "库存数量", aliases: ["stock", "stockCount", "kcsl", "stockNum"], numeric: true },
  { key: "stockAmount", label: "库存金额", aliases: ["stockAmount", "kcje", "stockMoney"], numeric: true, money: true },
  { key: "payAmount", label: "销售金额", aliases: ["payAmount", "gmv", "saleAmount"], numeric: true, money: true },
  { key: "sales", label: "销售件数", aliases: ["sales", "saleCount", "xsjs"], numeric: true }
];

export const HP_STOCK_COLUMNS = [
  { key: "hpName", label: "货品", aliases: ["hpName", "goodsName", "name", "title"] },
  { key: "code", label: "货品编码", aliases: ["hpCode", "skuCode", "goodsCode", "code"] },
  { key: "spec", label: "颜色规格", aliases: ["spec", "skuName", "color"] },
  { key: "owner", label: "货品负责人", aliases: ["ownerName", "leaderName", "fzrName"] },
  { key: "ship7", label: "最近7天出货量", aliases: ["ship7", "weekShip", "recentShip"], numeric: true },
  { key: "coverDays", label: "库存可支撑天数", aliases: ["coverDays", "stockDays"], numeric: true },
  { key: "replenishDays", label: "补货周期(天)", aliases: ["replenishDays", "bhCycle"], numeric: true },
  { key: "oversell", label: "即将超卖", aliases: ["oversell", "willOversell"] },
  { key: "stock", label: "库存数量", aliases: ["stock", "stockCount", "kcsl"], numeric: true },
  { key: "stockRate", label: "库存数量占比", aliases: ["stockRate", "kcslzb"], numeric: true, rate: true },
  { key: "stockAmount", label: "库存金额", aliases: ["stockAmount", "kcje"], numeric: true, money: true },
  { key: "stockAmountRate", label: "库存金额占比", aliases: ["stockAmountRate", "kcjezb"], numeric: true, rate: true },
  { key: "slow", label: "是否滞销", aliases: ["slow", "unsalable", "zx"] }
];

export const SKILL_COLUMNS = [
  { key: "memberName", label: "姓名", aliases: ["userName", "memberName", "name"] },
  { key: "dept", label: "部门", aliases: ["deptName", "department", "dept"] },
  { key: "rank", label: "职级", aliases: ["rankName", "postRank", "rank"] },
  { key: "payAmount", label: "总销售额", aliases: ["payAmount", "gmv", "saleAmount"], numeric: true, money: true },
  { key: "commission", label: "提成收入", aliases: ["commission", "tcIncome", "bonus"], numeric: true, money: true }
];

export const MEMBER_COLUMNS = [
  { key: "memberName", label: "姓名", aliases: ["userName", "memberName", "name"] },
  { key: "dept", label: "部门", aliases: ["deptName", "department", "dept"] },
  { key: "post", label: "岗位", aliases: ["postName", "jobName", "post"] },
  { key: "rank", label: "职级", aliases: ["rankName", "postRank", "rank"] },
  { key: "tenure", label: "在职时间", aliases: ["tenure", "entryDate", "onJob"] },
  { key: "years", label: "服务年限", aliases: ["years", "serviceYears"] }
];

export const HP_CARDS = [
  { key: "payAmount", label: "销售金额", aliases: ["payAmount", "gmv", "saleAmount"], money: true },
  { key: "sales", label: "销售件数", aliases: ["sales", "saleCount", "xsjs"] },
  { key: "stock", label: "库存数量", aliases: ["stock", "stockCount", "kcsl"] },
  { key: "stockAmount", label: "库存金额", aliases: ["stockAmount", "kcje"], money: true }
];

export const TEAM_CARDS = [
  { key: "payAmount", label: "销售金额", aliases: ["payAmount", "gmv", "saleAmount"], money: true },
  { key: "sales", label: "销售件数", aliases: ["sales", "xsjs", "saleCount"] },
  { key: "cost", label: "推广花费", aliases: ["cost", "tghf"], money: true },
  { key: "profit", label: "利润", aliases: ["profit", "lryg"], money: true }
];

export function pageById(id) {
  return PAGES.find((page) => page.id === id) || PAGES.find((page) => page.id === "productOverview");
}

export function tabById(page, tabId) {
  const tabs = page && page.tabs ? page.tabs : [];
  return tabs.find((tab) => tab.id === tabId) || tabs[0] || null;
}

export function reports() {
  const rows = [];
  PAGES.forEach((page) => {
    if (page.cards) {
      rows.push({ ...page.cards, pageId: page.id, pageLabel: page.label, module: page.module, role: "cards" });
    }
    (page.tabs || []).forEach((tab) => {
      rows.push({ ...tab, pageId: page.id, pageLabel: page.label, module: page.module, role: "tab" });
    });
  });
  return rows;
}

export function accessCodes() {
  return [...new Set(reports().map((item) => item.access).filter(Boolean))];
}

export function publicCatalog() {
  return {
    ok: true,
    module: "bound",
    source: "crawler",
    erp: false,
    label: "爬虫，非 ERP",
    startOn: START_ON,
    note: "版式对齐边界 BI 工作台的渠道、商品和我的。货品、团队不进菜单，也不采集。数字只读本库，不读星脉 ERP。",
    modules: MODULES.filter((item) => item.id === "channel" || item.id === "goods" || item.id === "mine").map((item) => ({
      ...item,
      pages: PAGES.filter((page) => page.module === item.id).map((page) => ({
        id: page.id,
        label: page.label,
        route: page.route,
        ops: page.ops,
        local: page.local || "",
        tabs: (page.tabs || []).filter((tab) => !tab.id.endsWith("_trend")).map((tab) => ({
          id: tab.id,
          label: tab.label,
          dims: tab.dims,
          kind: tab.kind,
          group: tab.group || ""
        }))
      }))
    }))
  };
}
