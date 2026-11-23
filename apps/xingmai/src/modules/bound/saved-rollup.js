const additive = new Set(('gmv netGmv tghf profit refund wfhRefund thtkje netHpCost jhpcb ptCost deliverCost zdyFyAll sales invalidGmv otherCost saleCost fhSaleCost wyj gxh_5c0f6bdb52296da6ff08652f4ed898844f30ff09').split(' '));
const labels = new Set(('shopId shopName platform goodsId goodsName spuid goodsUrl cateId cateName catePathName province city isProv hour groupId groupName leaders onSaleTime').split(' '));
// Denominators follow the saved BI shop/channel reports: cost and profit ratios
// use net sales; the two custom gross margins use payment GMV. Small gross
// profit is its own saved measure (before penalties), not the shop profit.
const rates = {
  refundRatio: ['refund', 'gmv'], wfhTkl: ['wfhRefund', 'gmv'],
  netHpCostRatio: ['netHpCost', 'netGmv'], profitRate: ['profit', 'netGmv'],
  gxh_59276bdb52297387: ['profit', 'gmv'],
  gxh_5c0f6bdb52297387: ['gxh_5c0f6bdb52296da6ff08652f4ed898844f30ff09', 'gmv'],
  tghfXseZb: ['tghf', 'gmv'], fhfyZfZb: ['deliverCost', 'gmv']
};
const number = value => (typeof value === 'number' || typeof value === 'string' && value.trim() !== '') && Number.isFinite(Number(value)) ? Number(value) : null;
export const normalizedDay = value => String(value || '').replaceAll('/', '-');

function unshippedRefund(row) {
  const explicit = number(row.wfhRefund);
  if (explicit != null) return explicit;
  if (Array.isArray(row.lstRefund) && row.lstRefund.every(item => item && typeof item.code === 'string')) {
    const parts = row.lstRefund.filter(item => item.code === 'wfhRefund');
    const values = parts.map(item => number(item.originCost ?? item.cost));
    if (parts.length && values.every(value => value != null)) return values.reduce((a, b) => a + b, 0);
    if (!parts.length && (number(row.wfhTkl) == null || number(row.wfhTkl) === 0)) return 0;
  }
  // Older flat records may retain only the rounded ratio. Reconstruct its
  // numerator with payment GMV so aggregation is weighted, never a mean of rates.
  const ratio = number(row.wfhTkl), gmv = number(row.gmv);
  return ratio != null && gmv != null ? ratio * gmv : null;
}

// Sum only additive measures. Unknown ratios, ranks and realtime snapshots stay
// blank; carrying the last day's value would misrepresent the selected period.
export function sumSavedRows(rows, identity, date) {
  const groups = new Map();
  for (const row of rows) {
    const key = identity(row);
    if (key == null) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ ...row, wfhRefund: unshippedRefund(row) });
  }
  return [...groups.values()].map(items => {
    const out = {};
    for (const row of items) for (const key of labels) if (row[key] != null) out[key] = row[key];
    for (const key of additive) {
      const values = items.map(row => number(row[key]));
      if (values.every(value => value != null)) out[key] = Number(values.reduce((a, b) => a + b, 0).toFixed(8));
    }
    for (const [key, [numerator, denominator]] of Object.entries(rates)) {
      if (out[numerator] != null && out[denominator]) out[key] = out[numerator] / out[denominator];
    }
    return { ...out, date };
  });
}
export function reportIdentity(reportId, row) {
  const shop = `${row.platform}:${row.shopId}`;
  if (reportId === 'shop_spu_page') return row.spuid && row.spuid !== '--' ? `${shop}:${row.spuid}` : null;
  if (['shop_goods_page', 'key_goods', 'channel_goods'].includes(reportId)) return row.goodsId ? `${shop}:${row.goodsId}` : null;
  if (reportId === 'channel_category') return row.cateId != null ? `${shop}:${row.cateId}` : null;
  if (reportId === 'channel_area') return `${shop}:${row.province}:${row.city}:${row.isProv}`;
  if (reportId === 'channel_hour') return `${shop}:${row.hour}`;
  if (reportId === 'channel_labels') return row.flagId != null ? `${shop}:${row.flagId}` : null;
  return shop;
}

export function dailyCoverage(rows, from, to) {
  const dates = [...new Set(rows.map(row => normalizedDay(row.date)))].sort();
  const expectedDays = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
  return { from, to, dates, availableDays: dates.length, expectedDays, missingDays: expectedDays - dates.length };
}
