// Each pair comes from one Jingmai reading: yesterday = today / (1 + rate / 100).
// The platform rate is authoritative; yesterday's local collection is not a baseline.
import { buildShopOverviewHistory } from "./live2-overview-history.js";

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

export function jingmaiSalesCompare(today, source = {}) {
  const current = amount(today);
  const raw = source.dealRate;
  const rate = raw == null || raw === "" ? null : Number(raw);
  const given = rate != null && Number.isFinite(rate);
  const direct = amount(source.yesterdayAmount);
  if (current == null) return { yesterday: null, change: null, estimated: false, status: "no-current" };
  if (given) {
    if (rate < -100 || (rate === -100 && current > 0)) {
      return { yesterday: null, change: null, estimated: false, status: "invalid-platform-compare" };
    }
    if (rate === -100) {
      // 0 / 0 is indeterminate: retain the platform's -100%, never invent yesterday.
      return { yesterday: direct > 0 ? direct : null, change: rate, estimated: false, status: direct > 0 ? "ok" : "rate-only" };
    }
    const yesterday = current / (1 + rate / 100);
    return Number.isFinite(yesterday)
      ? { yesterday, change: rate, estimated: true, status: "ok" }
      : { yesterday: null, change: null, estimated: false, status: "invalid-platform-compare" };
  }
  if (direct != null) {
    return { yesterday: direct, change: direct > 0 ? (current / direct - 1) * 100 : current === 0 ? 0 : null,
      estimated: false, status: direct === 0 && current > 0 ? "zero-baseline" : "ok" };
  }
  return { yesterday: null, change: null, estimated: false, status: "no-platform-compare" };
}

export function buildShopSalesTrend(record, samples, nowStamp) {
  const now = stampParts(nowStamp);
  const day = now.day;
  const yesterday = previousDay(day);
  const captured = stampParts(record.dealCapturedAt || record.capturedAt);
  const current = amount(record.liveAmount);
  const valid = current != null && captured && captured.day === day && captured.second <= now.second;
  const todayRows = new Map(), yesterdayRows = new Map();
  let exactSample = null;
  for (const sample of samples || []) {
    if (sample.store !== record.shop || sample.ok === false) continue;
    const at = stampParts(sample.capturedAt), value = amount(sample.dealAmount);
    if (!at || value == null || at.day !== day || at.second > (valid ? captured.second : now.second)) continue;
    const row = { second: at.second, amount: value };
    todayRows.set(at.second, row);
    const pair = jingmaiSalesCompare(value, sample);
    if (pair.yesterday != null) yesterdayRows.set(at.second, { second: at.second, amount: pair.yesterday });
    else yesterdayRows.delete(at.second);
    // Backfill old published snapshots only from the exact same saved reading.
    if (valid && at.second === captured.second && Math.abs(value - current) < 0.005) exactSample = sample;
  }
  const hasRecordCompare = record.dealRate != null || record.yesterdayAmount != null;
  const compare = jingmaiSalesCompare(valid ? current : null, hasRecordCompare ? record : exactSample || record);
  if (valid) {
    todayRows.set(captured.second, { second: captured.second, amount: current });
    if (compare.yesterday != null) yesterdayRows.set(captured.second, { second: captured.second, amount: compare.yesterday });
    else yesterdayRows.delete(captured.second);
  }
  const today = [...todayRows.values()].sort((a, b) => a.second - b.second);
  const yest = [...yesterdayRows.values()].sort((a, b) => a.second - b.second);
  return {
    todayDate: day, yesterdayDate: yesterday,
    today: points(today), yesterday: points(yest),
    todayAmount: valid ? current : null, yesterdayAmount: compare.yesterday, change: compare.change,
    comparedSecond: valid ? captured.second : null,
    yesterdaySecond: compare.yesterday != null ? captured.second : null,
    yesterdayEstimated: compare.estimated,
    comparisonSource: "jingmai",
    status: compare.status
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
      return records.map(record => {
        const rows = cache.day === day ? cache.byShop.get(record.shop) : [];
        return { ...record, salesTrend: buildShopSalesTrend(record, rows, stamp),
          overviewHistory: buildShopOverviewHistory(record, rows, stamp) };
      });
    } catch {
      // Current platform comparison remains usable even when history is unavailable.
      return records.map(record => {
        // A failed refresh must not erase observations already read today.
        // A cache from another day must never be relabelled as today's data.
        const rows = cache?.day === day ? cache.byShop.get(record.shop) || [] : [];
        return { ...record,
          salesTrend: { ...buildShopSalesTrend(record, rows, stamp), historyUnavailable: true },
          overviewHistory: { ...buildShopOverviewHistory(record, rows, stamp),
            historyUnavailable: true, historyCached: rows.length > 0 } };
      });
    }
  };
}
