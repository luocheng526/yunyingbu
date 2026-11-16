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
      list("qdzl_pl", "品类分析", "/v2/channel/cateAnalysis", "json", "qd_zl"),
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
      list("qdfx_yj", "业绩对比", "/v2/channel/dynamicChannelAnalysis", "json", "qd_fx"),
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
    label: "商品库存数据",
    route: "/workTable/productStock",
    ops: ["date", "shop", "search", "expand", "export", "sums"],
    tabs: [list("sp_kc", "商品库存数据", "/goods/goodsStock", "form", "sp_kc")]
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
    label: "岗位技能评估",
    route: "/workTable/teamSkills",
    ops: ["date", "search", "expand", "export", "sums"],
    tabs: [list("td_gwnl", "岗位技能评估", "/team/postAssess", "form", "td_zl")]
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
  { key: "payAmount", label: "销售金额", aliases: ["payAmount", "saleAmount", "gmv", "payMoney"], numeric: true, money: true }
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
  { key: "realTimeGmv", label: "实时销售额(支付)", aliases: ["realTimeGmv", "ssxse"], numeric: true, money: true },
  { key: "payAmount", label: "支付金额(支付)", aliases: ["payAmount", "gmv", "xse"], numeric: true, money: true },
  { key: "netGmv", label: "净销售额(支付)", aliases: ["netGmv", "jxse"], numeric: true, money: true },
  { key: "sales", label: "销售件数(支付)", aliases: ["sales", "xsjs", "saleCount"], numeric: true },
  { key: "refund", label: "退款数", aliases: ["refund", "refundCount", "thtkjs"], numeric: true },
  { key: "refundRate", label: "退款率(退款金额)", aliases: ["refundRate", "tkl"], numeric: true, rate: true },
  { key: "saleCost", label: "商品成本(支付)", aliases: ["saleCost", "xshf"], numeric: true, money: true },
  { key: "netHpCost", label: "净商品成本(支付)", aliases: ["netHpCost", "jhpcb"], numeric: true, money: true },
  { key: "jhpcbzb", label: "净商品成本占比(支付)", aliases: ["jhpcbzb"], numeric: true, rate: true },
  { key: "cost", label: "推广花费(支付预估)", aliases: ["cost", "tghf"], numeric: true, money: true },
  { key: "tghfXseZb", label: "推广花费销售占比(支付预估)", aliases: ["tghfXseZb"], numeric: true, rate: true },
  { key: "profit", label: "利润(支付预估)", aliases: ["profit", "lryg"], numeric: true, money: true },
  { key: "lrl", label: "小毛利率", aliases: ["lrl"], numeric: true, rate: true }
];

export const CHANNEL_CARDS = [
  { key: "realTimeGmv", label: "实时销售额(支付)", aliases: ["realTimeGmv", "ssxse"], money: true },
  { key: "payCount", label: "支付件数(支付)", aliases: ["payCount", "payGoodsCount", "zfxs"] },
  { key: "sales", label: "销售件数(支付)", aliases: ["sales", "xsjs", "saleCount"] },
  { key: "deliverCount", label: "发货件数(支付)", aliases: ["deliverCount", "fhjs", "sendCount"] },
  { key: "costRate", label: "成本率(支付)", aliases: ["costRate", "cbl"], rate: true },
  { key: "profit", label: "利润(支付预估)", aliases: ["profit", "lryg"], money: true },
  { key: "refundRate", label: "退款率(退款金额)", aliases: ["refundRate", "tkl"], rate: true },
  { key: "netProfit", label: "净利润(支付)", aliases: ["netProfit", "jlr"], money: true },
  { key: "cost", label: "推广花费(支付)", aliases: ["cost", "tghf"], money: true },
  { key: "lrl", label: "小毛利率", aliases: ["lrl", "grossRate"], rate: true }
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
    note: "版式对齐边界 BI 工作台的渠道、商品、团队、我的。数字只读本库，不读星脉 ERP。",
    modules: MODULES.map((item) => ({
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
          kind: tab.kind
        }))
      }))
    }))
  };
}
