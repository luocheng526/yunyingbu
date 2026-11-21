// Read-only projections of persisted Jingmai samples. No collection or login side effects.
const MATCH_WINDOW = 20 * 60;

function stampParts(value) {
  if (value instanceof Date) value = new Date(value.getTime() + 8 * 3600000).toISOString().slice(0, 19);
  const match = String(value || "").match(/^(\d{4})[-/](\d{2})[-/](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  return { day: match.slice(1, 4).join("-"), second: Number(match[4]) * 3600 + Number(match[5]) * 60 + Number(match[6] || 0) };
}

function amount(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function previousDay(day) {
  return new Date(Date.parse(day + "T12:00:00Z") - 86400000).toISOString().slice(0, 10);
}

function points(rows) {
  // Keep real observation times, including the first point, then the last per hour.
  // Never invent a midnight zero, interpolate missing hours or project future sales.
  const hours = new Map();
  rows.forEach(row => hours.set(Math.floor(row.second / 3600), row));
  return Array.from(new Map([rows[0], ...hours.values()].filter(Boolean).map(row => [row.second, row])).values())
    .sort((a, b) => a.second - b.second).map(row => ({ second: row.second, amount: row.amount }));
}

export function buildShopSalesTrend(record, samples, nowStamp) {
  const now = stampParts(nowStamp);
  const day = now.day;
  const yesterday = previousDay(day);
  const captured = stampParts(record.dealCapturedAt || record.capturedAt);
  const current = amount(record.liveAmount);
  const valid = current != null && captured && captured.day === day && captured.second <= now.second;
  const todayRows = new Map(), yesterdayRows = new Map();
  for (const sample of samples || []) {
    if (sample.store !== record.shop || sample.ok === false) continue;
    const at = stampParts(sample.capturedAt), value = amount(sample.dealAmount);
    if (!at || value == null) continue;
    const row = { second: at.second, amount: value };
    if (at.day === yesterday) yesterdayRows.set(at.second, row);
    if (at.day === day && at.second <= (valid ? captured.second : now.second)) todayRows.set(at.second, row);
  }
  if (valid) todayRows.set(captured.second, { second: captured.second, amount: current });
  const today = [...todayRows.values()].sort((a, b) => a.second - b.second);
  const yest = [...yesterdayRows.values()].sort((a, b) => a.second - b.second);
  const baseline = valid ? yest.filter(row => row.second <= captured.second).at(-1) : null;
  const matched = baseline && captured.second - baseline.second <= MATCH_WINDOW;
  const base = matched ? baseline.amount : null;
  const change = valid && base > 0 ? (current - base) / base * 100 : valid && base === 0 && current === 0 ? 0 : null;
  return {
    todayDate: day, yesterdayDate: yesterday,
    today: points(today), yesterday: points(yest),
    todayAmount: valid ? current : null, yesterdayAmount: base, change,
    comparedSecond: valid ? captured.second : null,
    yesterdaySecond: matched ? baseline.second : null,
    status: !valid ? "no-current" : !matched ? "no-baseline" : base === 0 && current > 0 ? "zero-baseline" : "ok"
  };
}

export function createLive2SalesTrends({ listSamples, now, clock = Date.now }) {
  let cache = null, pending = null;
  return async function enrich(records) {
    const stamp = now(), day = stampParts(stamp).day;
    try {
      if (!cache || cache.day !== day || clock() - cache.at >= 30000) {
        if (!pending) {
          pending = Promise.resolve().then(() => listSamples(previousDay(day), day)).then(rows => {
            const byShop = new Map();
            for (const row of rows) {
              if (!byShop.has(row.store)) byShop.set(row.store, []);
              byShop.get(row.store).push(row);
            }
            cache = { day, at: clock(), byShop };
          }).finally(() => { pending = null; });
        }
        await pending;
      }
      return records.map(record => ({ ...record,
        salesTrend: buildShopSalesTrend(record, cache.day === day ? cache.byShop.get(record.shop) : [], stamp) }));
    } catch {
      // A history outage must not blank the current board or report missing data as 0%.
      return records.map(record => ({ ...record,
        salesTrend: { ...buildShopSalesTrend(record, [], stamp), status: "unavailable" } }));
    }
  };
}
