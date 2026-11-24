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
    );
}
