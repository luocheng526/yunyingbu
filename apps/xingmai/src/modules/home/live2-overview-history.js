// Shared, read-only chart history. Only saved observations are chart points.
const blank = () => ({ deal: Array(24).fill(null), spend: Array(24).fill(null) });

function parts(value) {
  if (value instanceof Date) value = new Date(value.getTime() + 8 * 3600000).toISOString().slice(0, 19);
  const m = String(value || "").match(/^(\d{4})[-/](\d{2})[-/](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  return m ? { day: m.slice(1, 4).join("-"), second: +m[4] * 3600 + +m[5] * 60 + +(m[6] || 0) } : null;
}

function number(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function buildShopOverviewHistory(record, samples, nowStamp) {
  const now = parts(nowStamp);
  const yesterdayDate = new Date(Date.parse(now.day + "T12:00:00Z") - 86400000).toISOString().slice(0, 10);
  const result = { source: "server-samples", todayDate: now.day, yesterdayDate,
    today: blank(), yesterday: blank(), comparison: { deal: null, spend: null },
    comparisonAgeSeconds: { deal: null, spend: null } };
  const latest = { today: blank(), yesterday: blank() };
  for (const [metric, field, currentField, stampField] of [
    ["deal", "dealAmount", "liveAmount", "dealCapturedAt"],
    ["spend", "paidAmount", "paidAmount", "adsCapturedAt"]
  ]) {
    const captured = parts(record[stampField] || record.capturedAt);
    const current = number(record[currentField]);
    const valid = current != null && captured?.day === now.day && captured.second <= now.second;
    const cutoff = valid ? captured.second : now.second;
    let comparisonSecond = -1;
    function add(day, second, value) {
      const hour = Math.floor(second / 3600);
      if (value == null || (latest[day][metric][hour] != null && latest[day][metric][hour] > second)) return;
      result[day][metric][hour] = value;
      latest[day][metric][hour] = second;
    }
    for (const sample of samples || []) {
      if (sample.store !== record.shop || sample.ok === false) continue;
      const at = parts(sample.capturedAt), value = number(sample[field]);
      if (!at || value == null) continue;
      if (at.day === now.day && at.second <= cutoff) add("today", at.second, value);
      if (at.day === yesterdayDate) {
        add("yesterday", at.second, value);
        // Keep the latest real observation before the current reading. Gaps
        // over 15 minutes are explicitly labelled as a reference by the UI.
        // Never substitute a later observation or yesterday's closing total.
        if (valid && at.second <= cutoff && at.second >= comparisonSecond) {
          result.comparison[metric] = value;
          result.comparisonAgeSeconds[metric] = cutoff - at.second;
          comparisonSecond = at.second;
        }
      }
    }
    if (valid) add("today", captured.second, current);
  }
  return result;
}
