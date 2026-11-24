const METRIC = "支付金额(支付)";
const DEFINITION = "按支付时间统计的订单金额(包含无效单、代发单)";
const normalized = value => String(value || "").replaceAll("（", "(").replaceAll("）", ")");
const decimal = value => {
  if (typeof value !== "string" || !/^-?\d+(?:\.\d+)?$/.test(value)) return null;
  const [integer, fraction = ""] = value.split(".");
  const tail = fraction.replace(/0+$/, "");
  return integer + (tail ? `.${tail}` : "");
};

// Mapping verified against the single real response on 2026-11-21.
// gmv is the table's display value. lstGmv costs are components, not a replacement total.
export function verifyProbeMetric(record) {
  const row = record.sample?.row;
  const columns = record.sample?.columns;
  const target = record.target;
  if (!target || !Array.isArray(columns) || !row || record.httpStatus !== 200 || record.upstreamCode !== 0
    || record.matchedRowCount !== 1 || record.request?.body?.shopId !== target.shopId
    || record.request.body.platform !== target.platform || record.request.body.queryType !== 2
    || record.request.body.startDate !== target.date || record.request.body.endDate !== target.date
    || typeof row.date !== "string" || row.date.replaceAll("/", "-") !== target.date) {
    return null;
  }
  const matches = columns.filter(column => column.columnKey === "gmv");
  if (matches.length !== 1 || normalized(matches[0].columnName) !== METRIC
    || normalized(target.metric) !== METRIC || normalized(matches[0].note) !== DEFINITION) return null;
  const value = decimal(row.gmv);
  if (value === null) return null;
  const matchesPage = value === decimal(target.pageDisplay.replaceAll(",", ""));
  const [integer, fraction] = row.gmv.split(".");
  const displayValue = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (fraction === undefined ? "" : `.${fraction}`);
  return {
    field: "gmv", label: METRIC, definition: DEFINITION,
    value: row.gmv, displayValue,
    matchesPage, precision: "as_returned_by_operating_table",
    precisionNote: "保留接口表格原值，未推算订单级小数金额。"
  };
}
