export const CHINA_TZ = "Asia/Shanghai";

export function formatChinaTime(value) {
  if (value == null || value === "") {
    return "—";
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: CHINA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date);
  const pick = (type) => (parts.find((part) => part.type === type) || {}).value || "00";
  return (
    pick("year") +
    "-" +
    pick("month") +
    "-" +
    pick("day") +
    " " +
    pick("hour") +
    ":" +
    pick("minute") +
    ":" +
    pick("second")
  );
}

export function rewriteUtcStamp(text) {
  return String(text).replace(
    /(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(?:\.\d+)?(?:Z|\s*UTC)/g,
    (_all, day, time) => formatChinaTime(day + "T" + time + "Z")
  );
}