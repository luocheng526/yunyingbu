/** Shared totals for the page and its exported image. Never add percentages. */

export function reportNumber(value) {
  if (value == null || String(value).trim() === "" || /[%#]/.test(String(value))) {
    return null;
  }
  const number = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(number) ? number : null;
}

function additive(col) {
  return (
    ["gmv", "fee", "profit", "mtd"].includes(col.group) ||
    ["visitors", "orders", "newSku", "onSale", "jingcang", "monthSpend", "panel"].includes(col.key)
  );
}

export function sumReportCells(rows, columns) {
  const cells = {};
  for (const col of columns) {
    if (!additive(col)) {
      continue;
    }
    const values = rows.map((row) => reportNumber(row.cells?.[col.key])).filter((value) => value !== null);
    cells[col.key] = values.length ? Number(values.reduce((sum, value) => sum + value, 0).toFixed(2)) : "";
  }
  const ratio = (key, numerator, denominator) => {
    const n = reportNumber(cells[numerator]);
    const d = reportNumber(cells[denominator]);
    cells[key] = n !== null && d !== null && d !== 0 ? `${((n / d) * 100).toFixed(2)}%` : "";
  };
  for (const col of columns) {
    if (col.key.startsWith("feeRate_")) {
      const day = col.key.slice("feeRate_".length);
      ratio(col.key, `fee_${day}`, `gmv_${day}`);
    }
  }
  if (columns.some((c) => c.key === "monthFee")) {
    ratio("monthFee", "monthSpend", "panel");
  }
  // Historical margins and return rates need denominators not present in this report.
  return cells;
}

export function buildGrandSummary(teams, columns, expectedTeams, today) {
  const allRows = teams.flatMap((team) => team.rows || []);
  const expected = expectedTeams.map((key) => teams.find((team) => team.key === key)).filter(Boolean);
  const teamName = (team) => (team.key === "han" ? "韩梦凯组" : team.key === "shen" ? "沈子晗组" : team.label || team.key);
  const missing = expected.filter((team) => !team.rows?.length).map(teamName);
  const notes = ["无清洁＝沈子晗全部＋韩梦凯无清洁；清洁＝韩梦凯清洁"];
  if (missing.length) {
    notes.push(`当前仅汇总已同步店铺；等待 ${missing.join("、")}`);
  }
  const foot = [{ key: "all", kind: "fine", label: "总汇总", cells: { ...sumReportCells(allRows, columns), register: allRows.length ? today : "" } }];
  let complete = missing.length === 0 && expected.every((team) => team.groupTotalsEligible);
  for (const kind of ["noclean", "clean"]) {
    const label = kind === "noclean" ? "无清洁店铺汇总" : "清洁店铺汇总";
    const applicable = expected.filter((team) => kind !== "clean" || team.key !== "shen");
    const contributors = applicable.flatMap((team) => {
      if (team.key === "shen") {
        return team.rows?.length ? [{ team, cells: sumReportCells(team.rows, columns) }] : [];
      }
      return team.groupTotalsEligible && team.sourceGroups?.[kind]?.available ? [{ team, cells: team.sourceGroups[kind].cells }] : [];
    });
    const unavailable = applicable.filter((team) => !contributors.some((item) => item.team === team));
    if (unavailable.length) {
      complete = false;
      if (!missing.length) {
        notes.push(`${label}：等待 ${unavailable.map(teamName).join("、")}的分类汇总`);
      }
    }
    const cells = applicable.length
      ? sumReportCells(contributors, columns)
      : sumReportCells(
          [
            {
              cells: Object.fromEntries(columns.filter(additive).map((col) => [col.key, 0]))
            }
          ],
          columns
        );
    const suffix = unavailable.length ? (contributors.length ? "（部分）" : `（待${unavailable.map(teamName).join("、")}）`) : "";
    foot.push({
      key: kind,
      kind,
      label: `${label}${suffix}`,
      cells: { ...cells, register: contributors.length || !applicable.length ? today : "" }
    });
  }
  const latestDay = columns
    .filter((col) => col.group === "gmv")
    .map((col) => col.ymd)
    .sort()
    .at(-1);
  const overTenThousand = allRows.filter((row) => (reportNumber(row.cells?.[`gmv_${latestDay}`]) ?? 0) >= 10000).length;
  return {
    key: "grand",
    label: "全部团队汇总",
    totalLabel: "全部团队汇总",
    isSummary: true,
    readonly: true,
    rows: [],
    foot,
    complete,
    note: notes.join("；"),
    statusText: complete ? "汇总完整" : missing.length ? `等待${missing.join("、")}` : "分类汇总尚未完整",
    kpis: [
      { key: "shops", label: "已同步店铺", value: allRows.length },
      { key: "overTenThousand", label: latestDay ? `${latestDay.slice(5).replace("-", ".")}过万店铺` : "过万店铺", value: overTenThousand }
    ]
  };
}

export function isWeekCleanShop(row) {
  const cells = (row && row.cells) || {};
  const blob = `${(row && row.shop) || ""} ${cells.shop || ""} ${cells.cat || ""} ${cells.cat2 || ""}`;
  return /清洁|洗护|护理/.test(blob);
}

function dayOf(day) {
  if (!day) {
    return "";
  }
  return typeof day === "string" ? day : String(day.ymd || "");
}

export function latestWeekGmvYmd(rows, days, fallback) {
  const list = [...(days || [])].map(dayOf).filter(Boolean).reverse();
  for (const ymd of list) {
    if ((rows || []).some((row) => reportNumber(row.cells && row.cells[`gmv_${ymd}`]) != null)) {
      return ymd;
    }
  }
  return fallback || "";
}

function kpisOf(rows, ymd) {
  let gmv = 0;
  let orders = 0;
  let n = 0;
  let over = 0;
  const owners = {};
  (rows || []).forEach((row) => {
    const pay = reportNumber(row.cells && row.cells[`gmv_${ymd}`]);
    if (pay != null) {
      gmv += pay;
      if (pay >= 10000) {
        over += 1;
      }
    }
    const od = reportNumber(row.cells && row.cells.orders);
    if (od != null) {
      orders += od;
    }
    const owner = String((row.cells && row.cells.owner) || "").trim();
    if (owner) {
      owners[owner] = true;
    }
    n += 1;
  });
  return [
    { key: "total", label: "业绩", value: gmv || "" },
    { key: "shopAvg", label: "店均", value: n ? Math.round(gmv / n) : "" },
    { key: "unitPrice", label: "客单价", value: "" },
    { key: "cvr", label: "转化率", value: "" },
    { key: "orders", label: "订单数", value: orders || "" },
    { key: "staff", label: "运营人数", value: Object.keys(owners).length || "" },
    { key: "shops", label: "运营店铺数量", value: n },
    { key: "over10k", label: "过万店铺", value: over }
  ];
}

function feeRateOf(rows, day) {
  let fee = 0;
  let gmv = 0;
  let hasFee = false;
  let weighted = 0;
  let gmvForRate = 0;
  let hasRate = false;
  (rows || []).forEach((row) => {
    const cells = (row && row.cells) || {};
    const g = reportNumber(cells[`gmv_${day}`]);
    const f = reportNumber(cells[`fee_${day}`]);
    const r = reportNumber(cells[`feeRate_${day}`]);
    if (g != null) {
      gmv += g;
    }
    if (f != null) {
      fee += f;
      hasFee = true;
    }
    if (r != null && g != null) {
      weighted += r * g;
      gmvForRate += g;
      hasRate = true;
    }
  });
  if (hasFee && gmv) {
    return Number((fee / gmv).toFixed(4));
  }
  if (hasRate && gmvForRate) {
    return Number((weighted / gmvForRate).toFixed(4));
  }
  return "";
}

export function sumWeekCells(rows, columns) {
  const cells = {};
  (columns || []).forEach((col) => {
    if (!additive(col)) {
      return;
    }
    const values = (rows || []).map((row) => reportNumber(row.cells && row.cells[col.key])).filter((value) => value !== null);
    cells[col.key] = values.length ? Number(values.reduce((sum, value) => sum + value, 0).toFixed(2)) : "";
  });
  (columns || []).forEach((col) => {
    if (!String(col.key || "").startsWith("feeRate_")) {
      return;
    }
    cells[col.key] = feeRateOf(rows, col.key.slice("feeRate_".length));
  });
  return cells;
}

function splitCleanRows(rows) {
  const clean = [];
  const noclean = [];
  (rows || []).forEach((row) => {
    if (isWeekCleanShop(row)) {
      clean.push(row);
    } else {
      noclean.push(row);
    }
  });
  return { clean, noclean };
}

export function weekFootOf(rows, columns, meta) {
  const { clean, noclean } = splitCleanRows(rows);
  const name = String((meta && meta.label) || "").replace("五倍店铺", "");
  return [
    { key: "fine", kind: "fine", label: `${name}精铺组近七天业绩`, cells: sumWeekCells(rows, columns) },
    { key: "noclean", kind: "noclean", label: "无清洁统计", cells: sumWeekCells(noclean, columns) },
    { key: "clean", kind: "clean", label: "清洁统计", cells: sumWeekCells(clean, columns) }
  ];
}

function weekGrandFoot(rows, columns) {
  const { clean, noclean } = splitCleanRows(rows);
  return [
    {
      key: "fine",
      kind: "fine",
      label: `店铺总计 ${(rows || []).length}家`,
      cells: sumWeekCells(rows, columns)
    },
    { key: "noclean", kind: "noclean", label: "无清洁统计", cells: sumWeekCells(noclean, columns) },
    { key: "clean", kind: "clean", label: "清洁店铺统计", cells: sumWeekCells(clean, columns) }
  ];
}

export function attachWeekTotals(pack) {
  if (!pack || !Array.isArray(pack.teams)) {
    return pack;
  }
  const columns = pack.columns || [];
  const days = pack.days || [];
  const fallback = pack.ymd;
  pack.teams.forEach((team) => {
    const rows = team.rows || [];
    const ymd = latestWeekGmvYmd(rows, days, fallback);
    team.kpis = kpisOf(rows, ymd);
    const computed = weekFootOf(rows, columns, { key: team.key, label: team.label });
    const existing = Array.isArray(team.foot) ? team.foot : [];
    team.foot = computed.map((item, index) => ({
      ...item,
      label: (existing[index] && existing[index].label) || item.label
    }));
  });
  const allRows = pack.teams.flatMap((team) => team.rows || []);
  pack.grandSummary = {
    key: "sum",
    label: "汇总",
    totalLabel: "人员总计",
    isSummary: true,
    readonly: true,
    kpis: kpisOf(allRows, latestWeekGmvYmd(allRows, days, fallback)),
    rows: [],
    foot: weekGrandFoot(allRows, columns)
  };
  return pack;
}
