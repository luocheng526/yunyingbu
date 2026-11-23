/** Shared totals for the page and its exported image. Never add percentages. */
export function reportNumber(value) {
  if (value == null || String(value).trim() === "" || /[%#]/.test(String(value))) return null;
  const number = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(number) ? number : null;
}

function additive(col) {
  return ["gmv", "fee", "profit", "mtd"].includes(col.group) ||
    ["visitors", "orders", "newSku", "onSale", "jingcang", "monthSpend", "panel"].includes(col.key);
}

export function sumReportCells(rows, columns) {
  const cells = {};
  for (const col of columns) {
    if (!additive(col)) continue;
    const values = rows.map(row => reportNumber(row.cells?.[col.key])).filter(value => value !== null);
    cells[col.key] = values.length ? Number(values.reduce((sum, value) => sum + value, 0).toFixed(2)) : "";
  }
  const ratio = (key, numerator, denominator) => {
    const n = reportNumber(cells[numerator]), d = reportNumber(cells[denominator]);
    cells[key] = n !== null && d !== null && d !== 0 ? `${(n / d * 100).toFixed(2)}%` : "";
  };
  for (const col of columns) if (col.key.startsWith("feeRate_")) {
    const day = col.key.slice("feeRate_".length);
    ratio(col.key, `fee_${day}`, `gmv_${day}`);
  }
  if (columns.some(c => c.key === "monthFee")) ratio("monthFee", "monthSpend", "panel");
  // Historical margins and return rates need denominators not present in this report.
  return cells;
}

export function buildGrandSummary(teams, columns, expectedTeams, today) {
  const allRows = teams.flatMap(team => team.rows || []);
  const expected = expectedTeams.map(key => teams.find(team => team.key === key)).filter(Boolean);
  const teamName = team => team.key === "han" ? "韩梦凯组" : team.key === "shen" ? "沈子晗组" : team.label || team.key;
  const missing = expected.filter(team => !team.rows?.length).map(teamName);
  const notes = ["无清洁＝沈子晗全部＋韩梦凯无清洁；清洁＝韩梦凯清洁"];
  if (missing.length) notes.push(`当前仅汇总已同步店铺；等待 ${missing.join("、")}`);
  const foot = [{ key: "all", kind: "fine", label: "总汇总", cells: { ...sumReportCells(allRows, columns), register: allRows.length ? today : "" } }];
  let complete = missing.length === 0 && expected.every(team => team.groupTotalsEligible);
  for (const kind of ["noclean", "clean"]) {
    const label = kind === "noclean" ? "无清洁店铺汇总" : "清洁店铺汇总";
    // Confirmed business rule: Shen has no cleaning shops. Its current,
    // registration-filtered detail rows are the entire non-cleaning contribution.
    // Han alone uses the two category subtotal rows from its source sheet.
    const applicable = expected.filter(team => kind !== "clean" || team.key !== "shen");
    const contributors = applicable.flatMap(team => {
      if (team.key === "shen") return team.rows?.length ? [{ team, cells: sumReportCells(team.rows, columns) }] : [];
      return team.groupTotalsEligible && team.sourceGroups?.[kind]?.available ? [{ team, cells: team.sourceGroups[kind].cells }] : [];
    });
    const unavailable = applicable.filter(team => !contributors.some(item => item.team === team));
    if (unavailable.length) {
      complete = false;
      if (!missing.length) notes.push(`${label}：等待 ${unavailable.map(teamName).join("、")}的分类汇总`);
    }
    // An unconnected Han source is unknown, not zero. Only a report that
    // explicitly excludes Han can have a known empty cleaning group.
    const cells = applicable.length ? sumReportCells(contributors, columns) : sumReportCells([
      { cells: Object.fromEntries(columns.filter(additive).map(col => [col.key, 0])) }
    ], columns);
    const suffix = unavailable.length ? contributors.length ? "（部分）" : `（待${unavailable.map(teamName).join("、")}）` : "";
    foot.push({ key: kind, kind, label: `${label}${suffix}`,
      cells: { ...cells, register: contributors.length || !applicable.length ? today : "" } });
  }
  const latestDay = columns.filter(col => col.group === "gmv").map(col => col.ymd).sort().at(-1);
  const overTenThousand = allRows.filter(row => (reportNumber(row.cells?.[`gmv_${latestDay}`]) ?? 0) >= 10000).length;
  return { key: "grand", label: "全部团队汇总", totalLabel: "全部团队汇总", isSummary: true, readonly: true,
    rows: [], foot, complete, note: notes.join("；"), statusText: complete ? "汇总完整" : missing.length ? `等待${missing.join("、")}` : "分类汇总尚未完整",
    kpis: [{ key: "shops", label: "已同步店铺", value: allRows.length },
      { key: "overTenThousand", label: latestDay ? `${latestDay.slice(5).replace("-", ".")}过万店铺` : "过万店铺", value: overTenThousand }] };
}
