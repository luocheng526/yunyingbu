/** 韩梦凯、沈子晗本地机回传汇总。不接星脉 ERP，具体库表稍后对接。 */

function pad2(n) {
  return String(n).padStart(2, "0");
}

export function shanghaiNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Shanghai",
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).formatToParts(date instanceof Date ? date : new Date());
  const pick = (type) => parts.find((item) => item.type === type)?.value || "";
  return `${pick("year")}/${Number(pick("month"))}/${Number(pick("day"))} ${pad2(Number(pick("hour")))}:${pick("minute")}:${pick("second")}`;
}

export function getHomeLocalPaid() {
  return {
    ok: true,
    source: "han-shen-local",
    updatedAt: shanghaiNow(),
    summary: {},
    records: []
  };
}
