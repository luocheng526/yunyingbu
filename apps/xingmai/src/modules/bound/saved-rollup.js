const additive = new Set(('gmv netGmv tghf profit refund thtkje netHpCost jhpcb ptCost deliverCost zdyFyAll sales invalidGmv otherCost saleCost fhSaleCost wyj gxh_5c0f6bdb52296da6ff08652f4ed898844f30ff09').split(' '));
const labels = new Set(('shopId shopName platform goodsId goodsName spuid goodsUrl cateId cateName catePathName province city isProv hour groupId groupName leaders onSaleTime').split(' '));
const rates = { refundRatio: ['refund', 'gmv'], tghfXseZb: ['tghf', 'gmv'], fhfyZfZb: ['deliverCost', 'gmv'] };
const number = value => value != null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
export const normalizedDay = value => String(value || '').replaceAll('/', '-');

// Sum only additive measures. Unknown ratios, ranks and realtime snapshots stay
// blank; carrying the last day's value would misrepresent the selected period.
export function sumSavedRows(rows, identity, date) {
  const groups = new Map();
  for (const row of rows) {
    const key = identity(row);
    if (key == null) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
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
