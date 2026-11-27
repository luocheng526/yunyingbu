import { START_ON } from "./catalog.js";

let clock = () => new Date();

export function setBoundClock(next) {
  clock = typeof next === "function" ? next : () => new Date();
}

export function nowDate() {
  return clock();
}

export function shanghaiToday(at = null) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(at || clock());
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

export function reliableEnd(today) {
  const day = today || shanghaiToday();
  const end = addDays(day, -2);
  return end < START_ON ? START_ON : end;
}

function clampStart(start, end) {
  const from = start < START_ON ? START_ON : start;
  return from > end ? end : from;
}

function weekStartIso(iso) {
  const date = new Date(`${iso}T12:00:00Z`);
  return addDays(iso, -((date.getUTCDay() + 6) % 7));
}

function pushScope(scopes, start, end, daysType) {
  const stop = end;
  const from = clampStart(start, stop);
  if (from > stop) {
    return;
  }
  const key = `${from}|${stop}|${daysType}`;
  if (scopes.some((item) => `${item.start}|${item.end}|${item.daysType}` === key)) {
    return;
  }
  scopes.push({ start: from, end: stop, daysType });
}

export function presetRange(kind, today) {
  const end = reliableEnd(today);
  if (kind === "30") {
    return { start: clampStart(addDays(end, -29), end), end, daysType: "30" };
  }
  if (kind === "1") {
    return { start: end, end, daysType: "1" };
  }
  return { start: clampStart(addDays(end, -6), end), end, daysType: "7" };
}

export function collectScopes(today) {
  const end = reliableEnd(today);
  const scopes = [];
  let month = START_ON.slice(0, 7);
  const endMonth = end.slice(0, 7);
  while (month < endMonth) {
    const start = `${month}-01`;
    pushScope(scopes, start, monthEnd(start), "month");
    const [year, mon] = month.split("-").map(Number);
    month = new Date(Date.UTC(year, mon, 1)).toISOString().slice(0, 7);
  }
  pushScope(scopes, `${endMonth}-01`, end, "month");
  pushScope(scopes, `${end.slice(0, 4)}-01-01`, end, "year");
  const monday = weekStartIso(end);
  const sunday = addDays(monday, 6);
  if (sunday <= end) {
    pushScope(scopes, monday, sunday, "week");
  } else {
    pushScope(scopes, addDays(monday, -7), addDays(monday, -1), "week");
  }
  pushScope(scopes, addDays(end, -29), end, "30");
  pushScope(scopes, addDays(end, -6), end, "7");
  pushScope(scopes, end, end, "1");
  return scopes;
}
