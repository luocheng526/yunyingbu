// Shop list order from BI columnInfo and the user's complete header captures.
// Keep each report's own columns: operating and product tables have different metrics.
export const SHOP_TABLE_COLUMNS = [
  ['shopName', '店铺'], ['platform', '渠道'], ['tx_lmcjpm', '类目成交排名'],
  ['ssxse', '实时销售额(支付)'], ['gmv', '支付金额(支付)'], ['invalidGmv', '无效单金额(标注)'],
  ['netGmv', '净销售额(支付)'], ['sales', '销售件数(支付)'], ['refund', '退款金额'],
  ['refundRatio', '退款率(按金额)'], ['wfhTkl', '未发货退款率(按金额)'],
  ['netHpCost', '净货品成本(支付)'], ['netHpCostRatio', '净货品成本占比(支付)'],
  ['tghf', '推广花费(支付预估)'], ['tghfXseZb', '推广花费销售额占比(支付预估)'],
  ['wyj', '违约金'], ['gxh_5c0f6bdb52296da6ff08652f4ed898844f30ff09', '小毛利润(支付预估)'],
  ['profit', '利润(支付预估)'], ['gxh_5c0f6bdb52297387', '小毛利率'],
  ['gxh_59276bdb52297387', '大毛利率'], ['leaders', '负责人'],
  ['ptCost', '平台花费(支付预估)'], ['saleCost', '销售费用(支付预估)'],
  ['otherCost', '其他费用(支付)'], ['zdyFyAll', '自定义费用'],
  ['deliverCost', '发货费用(支付)'], ['profitRate', '利润率(支付预估)']
].map(([columnKey, columnName]) => ({ columnKey, columnName, defaultHidden: columnKey === 'tx_lmcjpm', styleRule: JSON.stringify({ isNumberCell: !['shopName', 'platform', 'leaders'].includes(columnKey), ...(/率|占比/.test(columnName) ? { renderAttr: { formatType: 'percent' } } : {}) }) }));
