export function paintWeekInk(text) {
  return String(text || "")
    .replaceAll(
      ".xm-hm-week-table td.is-up{background:#00b050;color:#fff}",
      ".xm-hm-week-table td.is-up{background:#00b050;color:#000}"
    )
    .replaceAll(
      ".xm-hm-week-table td.is-down{background:#ff0000;color:#fff}",
      ".xm-hm-week-table td.is-down{background:#ff0000;color:#000}"
    )
    .replaceAll(
      ".xm-hm-week-table td.is-noclean{background:#5b9bd5;color:#fff}",
      ".xm-hm-week-table td.is-noclean{background:#5b9bd5;color:#000}"
    )
    .replaceAll(
      ".xm-hm-week-table td.is-clean{background:#00b050;color:#fff}",
      ".xm-hm-week-table td.is-clean{background:#00b050;color:#000}"
    )
    .replaceAll(
      'ctx.fillStyle = bg === "#00b050" || bg === "#ff0000" || bg === "#5b9bd5" ? "#fff" : "#111";',
      'ctx.fillStyle = "#000";'
    )
    .replaceAll(
      'ctx.fillStyle = bg === "#00b050" || bg === "#ff0000" ? "#fff" : "#111";',
      'ctx.fillStyle = "#000";'
    )
    .replaceAll(
      "function footCell(kind, col, label) {\n      if (col.key === \"shop\") {\n        return '<td class=\"is-' + kind + '\">' + escapeHtml(label) + \"</td>\";\n      }\n      return '<td class=\"is-' + kind + '\"></td>';\n    }",
      "function footCell(kind, col, label, cells) {\n      if (col.key === \"shop\") {\n        return '<td class=\"is-' + kind + '\">' + escapeHtml(label) + \"</td>\";\n      }\n      return '<td class=\"is-' + kind + '\">' + escapeHtml(weekCellText(cells && cells[col.key])) + \"</td>\";\n    }"
    )
    .replaceAll(
      "return footCell(item.kind || \"fine\", col, item.label);",
      "return footCell(item.kind || \"fine\", col, item.label, item.cells);"
    )
    .replaceAll(
      "var teams = ((pack && pack.teams) || []).map(function (team, teamIndex) {",
      "var teams = ((pack && pack.teams) || []).concat(pack && pack.grandSummary ? [pack.grandSummary] : []).map(function (team, teamIndex) {"
    )
    .replaceAll(
      "var teams = (pack && pack.teams) || [];\n      if (!columns.length) {\n        reject(new Error(\"没有表头\"));",
      "var teams = ((pack && pack.teams) || []).concat(pack && pack.grandSummary ? [pack.grandSummary] : []);\n      if (!columns.length) {\n        reject(new Error(\"没有表头\"));"
    )
    .replaceAll(
      "'</div><button type=\"button\" class=\"is-ghost\" data-week-add=\"'",
      "'</div><button type=\"button\" class=\"is-ghost\" ' + (team.readonly || pack.historical ? 'hidden ' : '') + 'data-week-add=\"'"
    )
    .replaceAll(
      "drawWeekRow({ label: item.label }, \"\", item.kind, -1);",
      "drawWeekRow(Object.assign({}, item.cells || {}, { label: item.label }), \"\", item.kind, -1);"
    );
}
