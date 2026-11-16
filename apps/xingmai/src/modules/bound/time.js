let clock = () => new Date();

export function setBoundClock(next) {
  clock = typeof next === "function" ? next : () => new Date();
}

export function nowDate() {
  return clock();
}

export function shanghaiToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(clock());
}

export function addDays(iso, delta) {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

export function monthEnd(iso) {
  const [year, month] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

export function eachDay(from, to) {
  const days = [];
  let cursor = from;
  while (cursor <= to && days.length < 400) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

export function collectScopes(today) {
  const scopes = [];
  let month = "2026-09";
  const current = today.slice(0, 7);
  while (month < current) {
    const start = `${month}-01`;
    const end = monthEnd(start);
    scopes.push({ start, end, daysType: "month" });
    const [year, mon] = month.split("-").map(Number);
    const next = new Date(Date.UTC(year, mon, 1));
    month = next.toISOString().slice(0, 7);
  }
  eachDay("2026-09-01", today).forEach((day) => {
    scopes.push({ start: day, end: day, daysType: "date" });
  });
  return scopes;
}
