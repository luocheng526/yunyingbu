/**
 * 实时（新版）字段。
 * 实时成交金额 = 京麦经营数据「成交金额」
 * 实时付费金额 = 京准通「花费」
 * 实时付费ROI = 京准通「投产比」
 * 实时付费成交额 = 京准通「总订单金额」
 * 实时费比 =（实时付费金额 / 实时成交金额）× 100%
 * 这里保存比值（0.61 表示 61%），页面再换成百分号。
 */

function asNumber(value) {
  if (value == null || value === "") {
    return null;
  }
  const number = Number(String(value).replace(/[,￥¥%\s]/g, ""));
  return Number.isFinite(number) ? number : null;
}

export function live2FeeRate(paidAmount, dealAmount) {
  const spend = asNumber(paidAmount);
  const deal = asNumber(dealAmount);
  if (spend == null || deal == null || deal === 0) {
    return null;
  }
  return spend / deal;
}

export function live2Metrics(deal, paid) {
  const liveAmount = deal && deal.dealAmount != null ? asNumber(deal.dealAmount) : null;
  const paidAmount = paid && paid.paidAmount != null ? asNumber(paid.paidAmount) : null;
  const paidDeal = paid && paid.paidDeal != null ? asNumber(paid.paidDeal) : null;
  const roi = paid && paid.paidRoi != null ? asNumber(paid.paidRoi) : null;
  return {
    liveAmount,
    paidAmount,
    roi,
    paidDeal,
    feeRate: live2FeeRate(paidAmount, liveAmount)
  };
}

export function blankLive2Record(shop) {
  return {
    shop: String((shop && shop.store) || (shop && shop.shop) || "").trim(),
    team: String((shop && shop.team) || "").trim(),
    manager: String((shop && shop.manager) || "").trim(),
    liveAmount: null,
    paidAmount: null,
    roi: null,
    paidDeal: null,
    feeRate: null,
    capturedAt: "",
    online: false,
    offline: false,
    loginExpired: false,
    adsFailed: false,
    adsReason: "",
    offlineReason: "",
    pendingCollect: true
  };
}

export function live2RecordFromMetrics(shop, metrics, capturedAt) {
  const row = blankLive2Record(shop);
  const numbers = live2Metrics(metrics, metrics);
  row.liveAmount = numbers.liveAmount;
  row.paidAmount = numbers.paidAmount;
  row.roi = numbers.roi;
  row.paidDeal = numbers.paidDeal;
  row.feeRate = numbers.feeRate;
  row.capturedAt = capturedAt || "";
  row.pendingCollect = false;
  row.online = numbers.liveAmount != null && numbers.paidAmount != null;
  row.partialData = !row.online && (numbers.liveAmount != null || numbers.paidAmount != null);
  row.dealFailed = numbers.liveAmount == null && numbers.paidAmount != null;
  row.dealReason = row.dealFailed ? String(metrics.dealNote || "京麦没有返回成交金额") : "";
  row.adsFailed = numbers.liveAmount != null && numbers.paidAmount == null;
  row.adsReason = row.adsFailed ? String(metrics.paidNote || "京准通没有返回广告金额") : "";
  row.dealCapturedAt = numbers.liveAmount != null ? row.capturedAt : "";
  row.adsCapturedAt = numbers.paidAmount != null ? row.capturedAt : "";
  row.offline = !row.online && !row.partialData && Boolean(metrics && (metrics.dealNote || metrics.paidNote));
  row.offlineReason = row.offline ? String((metrics && (metrics.dealNote || metrics.paidNote)) || "") : "";
  return row;
}
