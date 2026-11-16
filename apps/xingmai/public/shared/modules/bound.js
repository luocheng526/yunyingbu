/* xm-module-bound — 三个版式的演示数据。爬虫，非 ERP。只请求 /api/bound。 */
(function () {
  var state = {
    pane: "overview",
    range: "7天",
    section: "渠道列表",
    card: "all",
    shopId: "",
    q: "",
    from: "",
    to: "",
    board: null,
    stamp: "",
    error: "",
    loading: false
  };
  var active = 0;

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function ensureStyle() {
    if (!document.getElementById || document.getElementById("bd-page-style")) {
      return;
    }
    var style = document.createElement("style");
    style.id = "bd-page-style";
    style.textContent =
      "/* Content-area theme. Follows shell tokens; 团队/昨天 keep business red. */\n.xm-content .xm-page,\n.xm-content .data-overview-root,\n.xm-content .data-fill {\n  width: 100%;\n  max-width: none;\n  color: var(--xm-ink);\n}\n\n.xm-content .kicker,\n.xm-content .data-overview-root > h1,\n.xm-page.data-overview-root > h1,\n.xm-content .data-overview-root > .data-subnav,\n.xm-page.data-overview-root > .data-subnav {\n  display: none;\n}\n\n.data-subnav {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 8px;\n  margin: 0 0 16px;\n}\n.data-subnav a {\n  display: inline-flex;\n  align-items: center;\n  height: 32px;\n  padding: 0 12px;\n  border-radius: 6px;\n  background: var(--xm-card);\n  color: var(--xm-ink);\n  border: 1px solid var(--xm-line);\n  text-decoration: none;\n  font-size: 13px;\n}\n.data-subnav a:hover,\n.data-subnav a.is-active,\n.data-subnav a[aria-current=\"page\"] {\n  background: var(--xm-primary-soft);\n  color: var(--xm-primary);\n  font-weight: 600;\n}\n\n.xm-page .lead,\n.data-fill .lead {\n  color: var(--xm-ink);\n  opacity: 0.72;\n}\n\n.xm-page .panel,\n.xm-content .panel,\n.data-placeholder {\n  margin-top: 8px;\n  padding: 16px 20px;\n  background: var(--xm-card);\n  color: var(--xm-ink);\n  border: 1px solid var(--xm-line);\n  border-radius: 8px;\n}\n\n.xm-content .kpi-card,\n.xm-page .kpi-card {\n  background: var(--xm-card);\n  color: var(--xm-ink);\n  border: 1px solid var(--xm-line);\n}\n.xm-content .kpi-card .label,\n.xm-page .kpi-card .label {\n  color: var(--xm-ink);\n  opacity: 0.65;\n}\n.xm-content .kpi-card .value,\n.xm-page .kpi-card .value {\n  color: var(--xm-ink);\n}\n\n.data-table {\n  width: 100%;\n  border-collapse: collapse;\n}\n.data-table th,\n.data-table td {\n  text-align: left;\n  padding: 0.75rem 0.2rem;\n  border-bottom: 1px solid var(--xm-line);\n  font-size: 0.95rem;\n  color: var(--xm-ink);\n}\n.data-table th {\n  color: var(--xm-ink);\n  opacity: 0.6;\n  font-weight: 600;\n}\n.data-table tr:last-child td {\n  border-bottom: none;\n}\n.data-table .error {\n  color: #b91c1c;\n}\n\n.data-placeholder .muted,\n.dash-dates,\n.dash-notice,\n.dash-time {\n  color: var(--xm-ink);\n  opacity: 0.55;\n  font-size: 12px;\n}\n\n.dash-toolbar {\n  display: flex;\n  flex-wrap: wrap;\n  align-items: center;\n  justify-content: space-between;\n  gap: 10px;\n  margin: 0 0 12px;\n}\n.dash-tabs,\n.dash-ranges {\n  display: flex;\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 6px;\n}\n.dash-tabs button,\n.dash-ranges button {\n  height: 30px;\n  padding: 0 12px;\n  border: 1px solid var(--xm-line);\n  border-radius: 4px;\n  background: var(--xm-card);\n  color: var(--xm-ink);\n  cursor: pointer;\n  font-size: 13px;\n}\n/* Business emphasis — do not theme to primary blue */\n.dash-tabs button.is-active,\n.dash-ranges button.is-active {\n  background: #c62828;\n  color: #fff;\n  border-color: #c62828;\n}\n.dash-gear {\n  display: inline-flex;\n  align-items: center;\n  gap: 4px;\n}\n.dash-notice {\n  margin: 0 0 12px;\n}\n.dash-layout {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr) 360px;\n  gap: 12px;\n  align-items: start;\n}\n.metric-grid {\n  display: grid;\n  grid-template-columns: repeat(4, minmax(0, 1fr));\n  gap: 10px;\n}\n.metric-card,\n.dash-panel {\n  background: var(--xm-card);\n  color: var(--xm-ink);\n  border: 1px solid var(--xm-line);\n  border-radius: 6px;\n}\n.metric-card {\n  min-height: 92px;\n  padding: 12px 14px;\n}\n.metric-card .label {\n  display: flex;\n  align-items: center;\n  gap: 4px;\n  color: var(--xm-ink);\n  opacity: 0.6;\n  font-size: 12px;\n}\n.metric-card .value,\n.dash-total,\n.dash-panel h2 {\n  color: var(--xm-ink);\n}\n.metric-card .value {\n  margin-top: 8px;\n  font-size: 22px;\n  font-weight: 700;\n  letter-spacing: -0.02em;\n}\n.metric-card .delta {\n  margin-top: 6px;\n  font-size: 12px;\n}\n.metric-card .delta.is-down {\n  color: #389e0d;\n}\n.metric-card .delta.is-up {\n  color: #cf1322;\n}\n.dash-side {\n  display: flex;\n  flex-direction: column;\n  gap: 12px;\n}\n.dash-panel {\n  padding: 12px;\n}\n.dash-panel h2 {\n  margin: 0 0 8px;\n  font-size: 14px;\n}\n.dash-panel-head {\n  display: flex;\n  align-items: baseline;\n  justify-content: space-between;\n  gap: 8px;\n  margin-bottom: 8px;\n}\n.dash-total {\n  font-size: 18px;\n  font-weight: 700;\n}\n.dash-rank {\n  width: 100%;\n  border-collapse: collapse;\n}\n.dash-rank th,\n.dash-rank td {\n  padding: 6px 4px;\n  border-bottom: 1px solid var(--xm-line);\n  font-size: 12px;\n  text-align: left;\n  color: var(--xm-ink);\n}\n.dash-rank th {\n  opacity: 0.6;\n  font-weight: 600;\n}\n.dash-settings label {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  margin: 6px 0;\n  font-size: 13px;\n  color: var(--xm-ink);\n}\n.dash-settings input {\n  accent-color: #c62828;\n}\n\nhtml[data-theme=\"dark\"] .metric-card,\nhtml[data-theme=\"dark\"] .dash-panel,\nhtml[data-theme=\"dark\"] .data-subnav a,\nhtml[data-theme=\"dark\"] .xm-content .kpi-card,\nhtml[data-theme=\"dark\"] .xm-page .panel,\nhtml[data-theme=\"pink\"] .metric-card,\nhtml[data-theme=\"pink\"] .dash-panel,\nhtml[data-theme=\"pink\"] .data-subnav a,\nhtml[data-theme=\"pink\"] .xm-content .kpi-card,\nhtml[data-theme=\"pink\"] .xm-page .panel {\n  background: var(--xm-card);\n  color: var(--xm-ink);\n  border-color: var(--xm-line);\n}\n\nhtml[data-theme=\"dark\"] .data-subnav a.is-active,\nhtml[data-theme=\"dark\"] .data-subnav a[aria-current=\"page\"],\nhtml[data-theme=\"pink\"] .data-subnav a.is-active,\nhtml[data-theme=\"pink\"] .data-subnav a[aria-current=\"page\"] {\n  background: var(--xm-primary-soft);\n  color: var(--xm-primary);\n}\n\n@media (max-width: 1100px) {\n  .dash-layout {\n    grid-template-columns: 1fr;\n  }\n  .metric-grid {\n    grid-template-columns: repeat(2, minmax(0, 1fr));\n  }\n}\n\n.ch-root {\n  --ch-ink: var(--xm-ink, #1f1f1f);\n  --ch-line: var(--xm-line, #ececec);\n  --ch-card: var(--xm-card, #fff);\n  --ch-bg: var(--xm-bg, #f7f7f7);\n  --ch-primary: var(--xm-primary, #4da6ff);\n  color: var(--ch-ink);\n  padding-top: 8px;\n}\n.ch-top,\n.ch-summary,\n.ch-table-bar,\n.ch-right {\n  display: flex;\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 8px 14px;\n}\n.ch-top {\n  justify-content: space-between;\n  margin-bottom: 14px;\n}\n.ch-title {\n  font-size: 16px;\n  font-weight: 600;\n}\n.ch-right {\n  margin-left: auto;\n}\n.ch-time {\n  font-size: 12px;\n  opacity: 0.55;\n}\n.ch-ranges {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n}\n.ch-ranges button,\n.ch-set {\n  height: 28px;\n  padding: 0 10px;\n  border: 1px solid var(--ch-line);\n  border-radius: 4px;\n  background: var(--ch-card);\n  color: var(--ch-ink);\n  cursor: pointer;\n  font-size: 13px;\n}\n.ch-ranges button.is-active {\n  background: #c62828;\n  color: #fff;\n  border-color: #c62828;\n}\n.ch-top,\n.ch-right,\n.ch-cal-wrap {\n  overflow: visible;\n}\n.ch-cal-wrap {\n  position: relative;\n}\n.ch-cal-pop {\n  position: fixed;\n  z-index: 4000;\n  display: none;\n  box-sizing: border-box;\n  width: 560px;\n  max-width: calc(100vw - 24px);\n  padding: 8px 4px 10px;\n  background: #fff;\n  border: 1px solid #e8e8e8;\n  border-radius: 4px;\n  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);\n}\n.ch-cal-pop.is-open {\n  display: block;\n}\n.ch-cal {\n  display: flex;\n  flex-wrap: nowrap;\n  width: 100%;\n  background: transparent;\n  border: 0;\n  box-shadow: none;\n}\n.ch-cal-month {\n  width: 50%;\n  box-sizing: border-box;\n  padding: 12px 16px 16px;\n}\n.ch-cal-month + .ch-cal-month {\n  border-left: 1px solid var(--ch-line, #eee);\n}\n.ch-cal-head {\n  position: relative;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  min-height: 32px;\n  margin-bottom: 4px;\n  font-size: 14px;\n}\n.ch-cal-head button {\n  position: absolute;\n  top: 2px;\n  height: 24px;\n  width: 24px;\n  padding: 0;\n  border: 0;\n  background: transparent;\n  color: var(--ch-ink);\n  cursor: pointer;\n}\n.ch-cal-head [data-cal=\"prev-year\"] {\n  left: 0;\n}\n.ch-cal-head [data-cal=\"prev-month\"] {\n  left: 22px;\n}\n.ch-cal-head [data-cal=\"next-month\"] {\n  right: 22px;\n}\n.ch-cal-head [data-cal=\"next-year\"] {\n  right: 0;\n}\n.ch-cal-week,\n.ch-cal-days {\n  display: grid;\n  grid-template-columns: repeat(7, 1fr);\n}\n.ch-cal-week span {\n  text-align: center;\n  padding: 6px 0;\n  font-size: 12px;\n  opacity: 0.45;\n}\n.ch-cal-days button {\n  height: 32px;\n  border: 0;\n  border-radius: 4px;\n  background: transparent;\n  color: var(--ch-ink);\n  cursor: pointer;\n  font-size: 13px;\n}\n.ch-cal-days button.is-out,\n.ch-cal-days button.is-future {\n  opacity: 0.28;\n}\n.ch-cal-days button.is-future {\n  cursor: default;\n}\n.ch-cal-days button.is-today {\n  color: #c62828;\n}\n.ch-cal-days button.is-in {\n  background: #fff1f0;\n}\n.ch-cal-days button.is-start,\n.ch-cal-days button.is-end {\n  background: #c62828;\n  color: #fff;\n}\n.ch-cal-err {\n  width: 100%;\n  margin: 0;\n  padding: 8px 16px 12px;\n  color: #c62828;\n  font-size: 12px;\n}\n.ch-summary {\n  display: flex;\n  align-items: center;\n  flex-wrap: wrap;\n  gap: 10px;\n  padding: 2px 0 12px;\n  margin: 0 0 10px;\n  border-bottom: 1px solid var(--ch-line, var(--xm-line, #eee));\n  font-size: 13px;\n}\n.ch-sum-title {\n  font-size: 18px;\n  font-weight: 700;\n  line-height: 28px;\n}\n.ch-pill {\n  display: inline-flex;\n  align-items: center;\n  height: 28px;\n  padding: 0 14px;\n  border-radius: 14px;\n  background: #2f54eb;\n  color: #fff;\n  font-size: 13px;\n  line-height: 28px;\n  white-space: nowrap;\n}\n.ch-summary .ch-set {\n  margin-left: auto;\n}\n.ch-metrics {\n  display: grid;\n  grid-template-columns: repeat(6, minmax(0, 1fr));\n  grid-auto-rows: minmax(216px, auto);\n  align-items: stretch;\n  gap: 0;\n  margin-bottom: 0;\n  background: var(--ch-card);\n  border: 1px solid var(--ch-line);\n  border-radius: 6px;\n  overflow: hidden;\n}\n.ch-metrics .ch-card,\n.ch-metrics .ch-hero {\n  min-height: 216px;\n  height: 100%;\n  box-sizing: border-box;\n  cursor: grab;\n  user-select: none;\n}\n.ch-metrics .ch-card.is-drag {\n  opacity: 0.55;\n  cursor: grabbing;\n}\n.ch-metrics .ch-card.is-over {\n  outline: 1px solid #2f54eb;\n  background: #f5f8ff;\n}\n.ch-metrics-hero {\n  grid-template-columns: 1fr;\n}\n.ch-kpi {\n  display: grid;\n  grid-template-columns: repeat(4, minmax(0, 1fr));\n  gap: 12px;\n  margin: 0 0 12px;\n}\n.ch-kpi .ch-card {\n  min-height: 108px;\n  padding: 16px 18px 18px;\n  background: var(--ch-card, var(--xm-card, #fff));\n  border: 1px solid var(--ch-line, var(--xm-line, #eee));\n  border-radius: 8px;\n}\n.ch-kpi .ch-card.is-pay .value {\n  color: #c62828;\n}\n.ch-card {\n  min-height: 148px;\n  padding: 16px 18px 20px;\n  background: transparent;\n  border: 0;\n  border-right: 1px solid var(--ch-line);\n  border-bottom: 1px solid var(--ch-line);\n  border-radius: 0;\n}\n.ch-card:nth-child(6n) {\n  border-right: 0;\n}\n.ch-card .label {\n  font-size: 13px;\n  line-height: 22px;\n  color: #8c8c8c;\n  opacity: 1;\n}\n.ch-card .value {\n  margin-top: 16px;\n  font-size: 28px;\n  font-weight: 700;\n  line-height: 1.3;\n  letter-spacing: -0.02em;\n  color: #141414;\n  font-variant-numeric: tabular-nums;\n}\n.ch-hero .value {\n  margin-top: 8px;\n}\n.ch-card .extra {\n  margin-top: 14px;\n  font-size: 12px;\n  line-height: 20px;\n  color: #8c8c8c;\n  opacity: 1;\n}\n.ch-hero .label {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n}\n.ch-clock {\n  font-variant-numeric: tabular-nums;\n  font-size: 12px;\n  opacity: 0.55;\n}\n.ch-hero .ch-spark {\n  display: block;\n  width: 100%;\n  height: 72px;\n  margin: 8px 0 0;\n}\n.ch-axis {\n  display: flex;\n  justify-content: space-between;\n  font-size: 10px;\n  opacity: 0.4;\n  margin-top: 2px;\n}\n.ch-card-right {\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n  margin-left: auto;\n  flex: none;\n}\n.ch-legs {\n  display: none;\n}\n.ch-hero .ch-clock {\n  display: inline;\n  margin-left: 2px;\n  padding: 0;\n  height: auto;\n  border-radius: 0;\n  background: transparent;\n  color: #8c8c8c;\n  font-size: 12px;\n  font-variant-numeric: tabular-nums;\n  opacity: 1;\n}\n.ch-card .label {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n}\n.ch-help {\n  flex: none;\n  width: 16px;\n  height: 16px;\n  border: 1px solid var(--xm-line, #d9d9d9);\n  border-radius: 3px;\n  background: #fff;\n  color: #8c8c8c;\n  font-size: 11px;\n  line-height: 14px;\n  cursor: help;\n  padding: 0;\n}\n.ch-tip {\n  position: fixed;\n  z-index: 4300;\n  max-width: 320px;\n  padding: 10px 12px;\n  background: #fff;\n  border: 1px solid #f0f0f0;\n  border-radius: 6px;\n  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);\n  color: #262626;\n  font-size: 12px;\n  line-height: 1.6;\n  white-space: pre-wrap;\n  display: none;\n}\n.ch-tip.is-on {\n  display: block;\n}\n.ch-hero .delta.is-down {\n  color: #389e0d;\n  font-size: 12px;\n  margin-top: 4px;\n}\n.ch-hero .delta.is-up {\n  color: #cf1322;\n  font-size: 12px;\n  margin-top: 4px;\n}\n.ch-split {\n  height: 2px;\n  margin: 8px 0;\n  background: #2f54eb;\n  border: 0;\n}\n.ch-tabs {\n  display: flex;\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 0;\n  margin: 0;\n  padding: 0;\n  background: transparent;\n  border-bottom: 1px solid var(--ch-line, #f0f0f0);\n}\n.ch-tabs button {\n  height: 36px;\n  padding: 0 16px;\n  border: 0;\n  background: transparent;\n  color: #262626;\n  cursor: pointer;\n  font-size: 13px;\n  opacity: 1;\n}\n.ch-tabs button.is-active {\n  font-weight: 600;\n  color: #fff;\n  background: #2f54eb;\n}\n.ch-table {\n  margin: 0 0 18px;\n  background: var(--ch-card);\n  border: 1px solid var(--ch-line);\n  border-top: 0;\n  border-radius: 0 0 6px 6px;\n  overflow: hidden;\n}\n.ch-table-bar {\n  position: relative;\n  z-index: 20;\n  padding: 10px 12px;\n  border-bottom: 1px solid var(--ch-line);\n  font-size: 13px;\n  overflow: visible;\n}\n.ch-table.sh-wide {\n  overflow: visible;\n}\n.ch-table tr.is-team {\n  cursor: pointer;\n}\n.ch-table tr.is-team.is-open {\n  background: #f5f8ff;\n}\n.ch-table tr.is-child .ch-name {\n  padding-left: 22px;\n}\n.ch-caret {\n  display: inline-block;\n  width: 14px;\n  margin-right: 4px;\n  color: #8c8c8c;\n}\n.ch-table.is-pl tr.is-gain td {\n  background: #fff1f0;\n}\n.ch-table.is-pl tr.is-loss td {\n  background: #f6ffed;\n}\n.sh-wide.is-pl tr.is-gain td:first-child {\n  background: #fff1f0;\n}\n.sh-wide.is-pl tr.is-loss td:first-child {\n  background: #f6ffed;\n}\n.ch-pick {\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n  font-size: 12px;\n  opacity: 0.75;\n}\n.ch-pick select {\n  height: 26px;\n  border: 1px solid var(--xm-line);\n  border-radius: 4px;\n  background: var(--ch-card);\n  color: var(--ch-ink);\n  border-color: var(--ch-line);\n}\n.ch-shop-pick {\n  position: relative;\n  display: inline-block;\n  min-width: 160px;\n  opacity: 1;\n  z-index: 30;\n}\n.ch-shop-pick-btn {\n  position: relative;\n  display: block;\n  width: 100%;\n  height: 26px;\n  padding: 0 24px 0 8px;\n  border: 1px solid var(--ch-line, #d9d9d9);\n  border-radius: 4px;\n  background: var(--ch-card, #fff);\n  color: var(--ch-ink, #262626);\n  font-size: 12px;\n  text-align: left;\n  cursor: pointer;\n}\n.ch-shop-pick-btn:after {\n  content: \"\";\n  position: absolute;\n  right: 8px;\n  top: 11px;\n  border: 4px solid transparent;\n  border-top-color: #8c8c8c;\n}\n.ch-shop-menu {\n  display: none;\n  position: fixed;\n  z-index: 5200;\n  min-width: 220px;\n  max-height: 280px;\n  overflow: auto;\n  padding: 6px 0;\n  background: #fff;\n  opacity: 1;\n  pointer-events: auto;\n  border: 1px solid #d9d9d9;\n  border-radius: 4px;\n  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);\n}\n.ch-shop-menu.is-open {\n  display: block;\n}\n.ch-shop-opt {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  margin: 0;\n  padding: 5px 12px;\n  color: #262626;\n  background: #fff;\n  font-size: 13px;\n  cursor: pointer;\n  white-space: nowrap;\n}\n.ch-shop-opt:hover {\n  background: #f5f8ff;\n}\n.ch-shop-opt input {\n  flex: none;\n  width: 14px;\n  height: 14px;\n  margin: 0;\n  accent-color: #2f54eb;\n}\n.ch-zero {\n  display: inline-flex;\n  align-items: center;\n  gap: 4px;\n  opacity: 0.7;\n}\n.ch-tools {\n  margin-left: auto;\n  display: flex;\n  flex-wrap: wrap;\n  gap: 4px;\n}\n.ch-tools button {\n  height: 26px;\n  padding: 0 8px;\n  border: 0;\n  background: transparent;\n  color: var(--ch-ink);\n  opacity: 0.62;\n  font-size: 12px;\n}\n.ch-tools button.is-on {\n  color: var(--ch-primary);\n  opacity: 1;\n  font-weight: 600;\n}\n.ch-table-wrap {\n  overflow-x: auto;\n  -webkit-overflow-scrolling: touch;\n}\n.ch-table table {\n  width: 100%;\n  min-width: 1100px;\n  border-collapse: collapse;\n}\n.sh-wide .ch-table-wrap {\n  max-width: 100%;\n}\n.sh-wide table {\n  min-width: 3200px;\n}\n.sh-wide th:first-child,\n.sh-wide td:first-child {\n  position: sticky;\n  left: 0;\n  z-index: 1;\n  background: var(--ch-card, var(--xm-card, #fff));\n  box-shadow: 1px 0 0 var(--ch-line, var(--xm-line, #ececec));\n}\n.sh-wide thead th:first-child {\n  background: var(--ch-bg, var(--xm-bg, #f7f7f7));\n}\n.sh-profit {\n  position: relative;\n  display: block;\n  min-width: 120px;\n  height: 22px;\n}\n.sh-profit i {\n  position: absolute;\n  left: 0;\n  top: 4px;\n  height: 14px;\n  background: #cf1322;\n  opacity: 0.85;\n  border-radius: 1px;\n}\n.sh-profit em {\n  position: relative;\n  font-style: normal;\n  font-variant-numeric: tabular-nums;\n}\n.sh-hint {\n  margin: 0;\n  padding: 8px 12px 10px;\n  font-size: 12px;\n  color: var(--ch-ink, var(--xm-ink));\n  opacity: 0.45;\n}\n.ch-table th,\n.ch-table td {\n  padding: 9px 10px;\n  border-bottom: 1px solid var(--ch-line);\n  font-size: 12px;\n  text-align: left;\n  white-space: nowrap;\n}\n.ch-table th {\n  background: var(--ch-bg);\n  color: var(--ch-ink);\n  opacity: 0.72;\n  font-weight: 600;\n}\n.ch-table th i {\n  display: inline-block;\n  width: 0;\n  height: 0;\n  margin-left: 3px;\n  border-left: 3px solid transparent;\n  border-right: 3px solid transparent;\n  border-top: 4px solid currentColor;\n  opacity: 0.45;\n  vertical-align: middle;\n}\n.ch-name {\n  display: table-cell;\n}\n.ch-name span {\n  vertical-align: middle;\n}\n.ch-bar {\n  display: inline-block;\n  width: 3px;\n  height: 14px;\n  margin-right: 8px;\n  background: var(--ch-primary);\n  border-radius: 1px;\n}\n.ch-logo {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 16px;\n  height: 16px;\n  margin-right: 6px;\n  border-radius: 2px;\n  font-size: 10px;\n  line-height: 1;\n  color: #fff;\n}\n.ch-logo-jd {\n  background: #4da6ff;\n}\n.ch-logo-shop {\n  background: #e53935;\n}\n.ch-empty {\n  padding: 24px 8px;\n  opacity: 0.6;\n}\nhtml[data-theme=\"dark\"] .ch-card,\nhtml[data-theme=\"dark\"] .ch-table,\nhtml[data-theme=\"pink\"] .ch-card,\nhtml[data-theme=\"pink\"] .ch-table {\n  background: var(--xm-card);\n  color: var(--xm-ink);\n  border-color: var(--xm-line);\n}\nhtml[data-theme=\"dark\"] .ch-metrics,\nhtml[data-theme=\"pink\"] .ch-metrics {\n  background: var(--xm-card);\n  border-color: var(--xm-line);\n}\nhtml[data-theme=\"dark\"] .ch-card .value,\nhtml[data-theme=\"pink\"] .ch-card .value {\n  color: var(--xm-ink);\n}\nhtml[data-theme=\"dark\"] .ch-card .label,\nhtml[data-theme=\"dark\"] .ch-card .extra,\nhtml[data-theme=\"pink\"] .ch-card .label,\nhtml[data-theme=\"pink\"] .ch-card .extra {\n  color: var(--xm-ink);\n  opacity: 0.45;\n}\n.ch-views {\n  display: flex;\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 16px;\n}\n.ch-views a {\n  color: var(--ch-ink, var(--xm-ink));\n  text-decoration: none;\n  font-size: 16px;\n  font-weight: 500;\n  opacity: 0.55;\n}\n.ch-views a.is-active {\n  opacity: 1;\n  font-weight: 600;\n}\n.ch-table-solo {\n  border-top: 1px solid var(--ch-line, var(--xm-line, #ececec));\n  border-radius: 6px;\n}\n.gd-metrics {\n  display: grid;\n  grid-template-columns: repeat(6, minmax(0, 1fr));\n  gap: 10px;\n  margin: 0 0 16px;\n}\n.gd-card {\n  min-height: 112px;\n  padding: 10px 12px 12px;\n  background: var(--ch-card, var(--xm-card, #fff));\n  border: 1px solid var(--ch-line, var(--xm-line, #ececec));\n  border-radius: 6px;\n  cursor: pointer;\n}\n.gd-card-top {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n}\n.gd-dot {\n  width: 8px;\n  height: 8px;\n  border-radius: 2px;\n  flex: 0 0 auto;\n}\n.gd-card .label {\n  flex: 1 1 auto;\n  min-width: 0;\n  font-size: 13px;\n  font-weight: 600;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n.gd-date,\n.gd-more {\n  flex: 0 0 auto;\n  font-size: 11px;\n  opacity: 0.45;\n}\n.gd-more {\n  border: 0;\n  background: transparent;\n  color: inherit;\n  padding: 0 2px;\n  line-height: 1;\n}\n.gd-card .hint {\n  margin-top: 4px;\n  font-size: 11px;\n  opacity: 0.45;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n.gd-card .extra {\n  display: flex;\n  justify-content: space-between;\n  gap: 8px;\n  margin-top: 4px;\n  font-size: 11px;\n  opacity: 0.45;\n}\n.gd-card .value {\n  margin-top: 10px;\n  font-size: 26px;\n  font-weight: 700;\n  letter-spacing: -0.03em;\n}\n.gd-card.is-on {\n  background: var(--ch-primary, #3d8bfd);\n  border-color: var(--ch-primary, #3d8bfd);\n  color: #fff;\n}\n.gd-card.is-on .gd-dot {\n  background: #fff !important;\n}\n.gd-card.is-on .hint,\n.gd-card.is-on .extra,\n.gd-card.is-on .gd-date,\n.gd-card.is-on .gd-more {\n  opacity: 0.85;\n}\n.gd-add {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  font-size: 28px;\n  opacity: 0.35;\n  cursor: default;\n  border-style: dashed;\n}\n.gd-thumb {\n  display: inline-block;\n  width: 28px;\n  height: 28px;\n  margin-right: 8px;\n  border-radius: 4px;\n  background: #d9d9d9;\n  vertical-align: middle;\n}\n.gd-filters {\n  gap: 8px;\n}\n.gd-sub {\n  display: flex;\n  align-items: center;\n  gap: 16px;\n  margin: 0 0 12px;\n  font-size: 13px;\n}\n.gd-sub button {\n  border: 0;\n  background: transparent;\n  color: var(--ch-ink, var(--xm-ink));\n  opacity: 0.5;\n  cursor: pointer;\n  padding: 0;\n  font-size: 13px;\n}\n.gd-sub button.is-on {\n  opacity: 1;\n  font-weight: 600;\n  color: var(--ch-primary, #3d8bfd);\n}\n.gd-sub-tools {\n  margin-left: auto;\n  display: flex;\n  gap: 12px;\n}\n.gd-sub-tools button {\n  opacity: 0.55;\n  cursor: default;\n}\n.gd-pager {\n  justify-content: flex-end;\n  gap: 10px;\n}\n.gd-pager button {\n  height: 26px;\n  padding: 0 10px;\n  border: 1px solid var(--ch-line, var(--xm-line, #ececec));\n  border-radius: 4px;\n  background: var(--ch-card, var(--xm-card, #fff));\n  color: var(--ch-ink, var(--xm-ink));\n}\n.lv-now {\n  display: inline-flex;\n  align-items: center;\n  gap: 8px;\n  margin-left: auto;\n  font-size: 13px;\n}\n.lv-now button {\n  height: 28px;\n  padding: 0 10px;\n  border: 1px solid var(--ch-line, var(--xm-line, #ececec));\n  border-radius: 4px;\n  background: var(--ch-card, var(--xm-card, #fff));\n  color: var(--ch-ink, var(--xm-ink));\n  cursor: pointer;\n  font-size: 13px;\n}\n.lv-metrics .ch-card:nth-child(6n) {\n  border-right: 1px solid var(--ch-line, var(--xm-line, #ececec));\n}\n.gd-search input {\n  width: 220px;\n  height: 26px;\n  border: 1px solid var(--ch-line, var(--xm-line, #ececec));\n  border-radius: 4px;\n  background: var(--ch-card, var(--xm-card, #fff));\n  color: var(--ch-ink, var(--xm-ink));\n  padding: 0 8px;\n}\nhtml[data-theme=\"dark\"] .gd-card,\nhtml[data-theme=\"pink\"] .gd-card {\n  background: var(--xm-card);\n  color: var(--xm-ink);\n  border-color: var(--xm-line);\n}\n.ch-mpick-mask {\n  position: fixed;\n  inset: 0;\n  z-index: 4200;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  padding: 24px;\n  background: rgba(0, 0, 0, 0.45);\n}\n.ch-mpick {\n  display: flex;\n  flex-direction: column;\n  width: min(1080px, 100%);\n  height: min(640px, 100%);\n  background: var(--ch-card, #fff);\n  border-radius: 8px;\n  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);\n  color: var(--ch-ink, #262626);\n  overflow: hidden;\n}\n.ch-mpick-head {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  height: 48px;\n  padding: 0 20px;\n  border-bottom: 1px solid var(--ch-line, #f0f0f0);\n  font-size: 16px;\n}\n.ch-mpick-x {\n  width: 28px;\n  height: 28px;\n  border: 0;\n  background: transparent;\n  color: #8c8c8c;\n  font-size: 20px;\n  cursor: pointer;\n}\n.ch-mpick-body {\n  display: flex;\n  flex: 1;\n  min-height: 0;\n}\n.ch-mpick-left {\n  flex: 1;\n  min-width: 0;\n  padding: 16px 20px;\n  overflow: auto;\n}\n.ch-mpick-search input {\n  width: 100%;\n  height: 36px;\n  padding: 0 12px;\n  border: 1px solid var(--ch-line, #d9d9d9);\n  border-radius: 6px;\n  box-sizing: border-box;\n}\n.ch-mpick-grid {\n  display: grid;\n  grid-template-columns: repeat(3, minmax(0, 1fr));\n  gap: 14px 20px;\n  margin-top: 18px;\n}\n.ch-mpick-opt {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  color: #2f54eb;\n  font-size: 14px;\n  cursor: pointer;\n}\n.ch-mpick-right {\n  width: 280px;\n  flex: none;\n  padding: 16px 16px 12px;\n  background: #f7f8fa;\n  border-left: 1px solid var(--ch-line, #f0f0f0);\n  overflow: auto;\n}\n.ch-mpick-right-top {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  font-size: 13px;\n}\n.ch-mpick-right-top button {\n  border: 0;\n  background: transparent;\n  color: #2f54eb;\n  cursor: pointer;\n}\n.ch-mpick-hint {\n  margin: 10px 0 12px;\n  color: #8c8c8c;\n  font-size: 12px;\n}\n.ch-mpick-item {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  height: 36px;\n  margin-bottom: 8px;\n  padding: 0 10px;\n  background: #fff;\n  border: 1px solid #f0f0f0;\n  border-radius: 6px;\n  font-size: 13px;\n  cursor: grab;\n}\n.ch-mpick-ok {\n  height: 32px;\n  padding: 0 16px;\n  border: 0;\n  border-radius: 4px;\n  background: #2f54eb;\n  color: #fff;\n  cursor: pointer;\n}\n.ch-mpick-foot {\n  display: flex;\n  gap: 8px;\n  padding: 12px 20px;\n  border-top: 1px solid var(--ch-line, #f0f0f0);\n}\n.data-overview-root.is-wait .ch-card .value,\n.data-overview-root.is-wait .ch-card .extra,\n.data-overview-root.is-wait .ch-hero .delta,\n.data-overview-root.is-wait .ch-hero .value,\n.data-overview-root.is-wait .op-kpi .val,\n.data-overview-root.is-wait .ch-table td,\n.data-overview-root.is-wait .ch-table td *,\n.data-overview-root.is-wait .ch-pill,\n.data-overview-root.is-wait .gd-card .value,\n.data-overview-root.is-wait .gd-card .extra,\n.data-overview-root.is-wait .gd-pager span,\n.data-overview-root.is-wait .sh-hint {\n  color: transparent !important;\n}\n.data-overview-root.is-wait .ch-hero .ch-spark,\n.data-overview-root.is-wait .op-bars,\n.data-overview-root.is-wait .ch-table .ch-bar,\n.data-overview-root.is-wait .ch-table .ch-logo,\n.data-overview-root.is-wait .gd-thumb {\n  opacity: 0;\n}\n.op-kpis {\n  display: grid;\n  grid-template-columns: repeat(9, minmax(0, 1fr));\n  background: var(--ch-card, #fff);\n  border: 1px solid var(--ch-line, #ececec);\n}\n.op-kpi {\n  min-height: 88px;\n  padding: 14px 10px 16px;\n  border-right: 1px solid var(--ch-line, #f0f0f0);\n  border-bottom: 1px solid var(--ch-line, #f0f0f0);\n  box-sizing: border-box;\n}\n.op-kpi:nth-child(9n) {\n  border-right: 0;\n}\n.op-kpi .lab {\n  font-size: 12px;\n  color: #8c8c8c;\n  line-height: 18px;\n}\n.op-kpi .val {\n  margin-top: 10px;\n  font-size: 20px;\n  font-weight: 600;\n  color: #141414;\n  font-variant-numeric: tabular-nums;\n}\n.op-kpi .val.is-gain {\n  color: #d46b08;\n}\n.op-chart {\n  margin: 12px 0 0;\n  padding: 10px 12px 8px;\n  background: var(--ch-card, #fff);\n  border: 1px solid var(--ch-line, #ececec);\n}\n.op-chart-leg {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  margin: 0 0 8px;\n  color: #8c8c8c;\n  font-size: 12px;\n}\n.op-chart-leg i {\n  width: 10px;\n  height: 10px;\n  background: #2f54eb;\n}\n.op-chart svg {\n  display: block;\n  width: 100%;\n  height: 220px;\n}\n.op-table .op-gain {\n  color: #d46b08;\n  font-weight: 600;\n}\n\n@media (max-width: 1100px) {\n  .ch-metrics,\n  .gd-metrics,\n  .ch-kpi,\n  .op-kpis {\n    grid-template-columns: repeat(2, minmax(0, 1fr));\n  }\n  .ch-card:nth-child(6n) {\n    border-right: 1px solid var(--xm-line);\n  }\n  .ch-card:nth-child(2n) {\n    border-right: 0;\n  }\n}\n" +
      ".bd-note{margin:0 0 8px;padding:8px 12px;border:1px solid var(--xm-line);border-left:3px solid var(--xm-primary);border-radius:8px;background:var(--xm-card);color:var(--xm-ink);font-size:12px;line-height:1.5;}" +
      ".bd-panes{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 10px;}" +
      ".bd-panes button{height:32px;padding:0 12px;border-radius:6px;border:1px solid var(--xm-line);background:var(--xm-card);color:var(--xm-ink);font:inherit;font-size:13px;cursor:pointer;}" +
      ".bd-panes button.is-active{background:var(--xm-primary-soft);color:var(--xm-primary);font-weight:650;}" +
      ".bd-msg{min-height:16px;margin:0 0 8px;color:var(--xm-muted);font-size:12px;}" +
      ".bd-msg.is-error{color:#cf1322;}";
    if (document.head) {
      document.head.appendChild(style);
    }
  }

  function boardOf() {
    return state.board;
  }

  function sliceDays(days) {
    var list = (days || []).slice();
    if (state.range === "自定义" && state.from && state.to) {
      return list.filter(function (day) {
        return day.date >= state.from && day.date <= state.to;
      });
    }
    if (state.range === "日") {
      return list.slice(-1);
    }
    if (state.range === "周" || state.range === "7天") {
      return list.slice(-7);
    }
    if (state.range === "月") {
      var month = list.length ? String(list[list.length - 1].date).slice(0, 7) : "";
      var inMonth = list.filter(function (day) {
        return String(day.date).slice(0, 7) === month;
      });
      return inMonth.length ? inMonth : list.slice(-7);
    }
    return list;
  }

  function dateLabel(days) {
    var last = days && days.length ? days[days.length - 1].date : "";
    if (!last) {
      return "";
    }
    var parts = String(last).split("-");
    return Number(parts[0]) + "/" + Number(parts[1]) + "/" + Number(parts[2]);
  }

  function rangesHtml() {
    var ranges = (boardOf() && boardOf().ranges) || ["7天", "30天", "日", "周", "月", "年", "自定义"];
    var buttons = ranges
      .map(function (label) {
        return (
          '<button type="button" data-range="' +
          esc(label) +
          '"' +
          (label === state.range ? ' class="is-active"' : "") +
          ">" +
          esc(label) +
          "</button>"
        );
      })
      .join("");
    var custom =
      state.range === "自定义"
        ? '<label class="ch-pick">从 <input type="date" data-from value="' +
          esc(state.from) +
          '"></label><label class="ch-pick">至 <input type="date" data-to value="' +
          esc(state.to) +
          '"></label>'
        : "";
    return buttons + custom;
  }

  function tools() {
    return (
      '<div class="ch-tools"><button type="button" disabled>打标</button><button type="button" disabled>目标</button>' +
      '<button type="button" class="is-on" disabled>列表</button><button type="button" disabled>周期</button>' +
      '<button type="button" disabled>图表</button><button type="button" disabled>个人默认视图</button>' +
      '<button type="button" disabled>更多数据</button><button type="button" disabled>导出</button></div>'
    );
  }

  function tableHtml(table) {
    var columns = (table && table.columns) || [];
    var rows = (table && table.rows) || [];
    var head = columns
      .map(function (column) {
        return "<th>" + esc(column) + " <i></i></th>";
      })
      .join("");
    var body = rows.length
      ? rows
          .map(function (row) {
            var mark = row.color ? '<span class="ch-logo" style="background:' + esc(row.color) + '"></span>' : '<span class="ch-bar"></span>';
            return (
              '<tr><td class="ch-name">' +
              mark +
              "<span>" +
              esc(row.name) +
              "</span></td>" +
              (row.cells || [])
                .map(function (cell) {
                  return "<td>" + esc(cell) + "</td>";
                })
                .join("") +
              "</tr>"
            );
          })
          .join("")
      : '<tr><td class="ch-empty" colspan="' + Math.max(columns.length, 1) + '">暂无演示数据</td></tr>';
    return (
      '<section class="ch-table sh-wide"><div class="ch-table-bar"><strong>' +
      esc((table && table.title) || "数据列表") +
      "</strong>" +
      tools() +
      '</div><div class="ch-table-wrap"><table><thead><tr>' +
      head +
      "</tr></thead><tbody>" +
      body +
      "</tbody></table></div></section>"
    );
  }

  function sparkSvg(hero) {
    var yest = (hero && hero.yesterday) || [];
    var today = (hero && hero.today) || [];
    var max = 1;
    yest.concat(today).forEach(function (value) {
      if (Number(value) > max) {
        max = Number(value);
      }
    });
    function line(list) {
      if (!list.length) {
        return "";
      }
      return list
        .map(function (value, index) {
          var x = list.length === 1 ? 0 : (index / (list.length - 1)) * 240;
          var y = 48 - (Number(value) / max) * 40;
          return x.toFixed(1) + "," + y.toFixed(1);
        })
        .join(" ");
    }
    return (
      '<svg class="ch-spark" viewBox="0 0 240 56" aria-hidden="true">' +
      '<polyline fill="none" stroke="#bfbfbf" stroke-width="1.5" points="' +
      line(yest) +
      '"></polyline>' +
      '<polyline fill="none" stroke="#1677ff" stroke-width="1.5" points="' +
      line(today) +
      '"></polyline></svg>'
    );
  }

  function opsCell(day, col) {
    var value = Number(day[col.key]) || 0;
    if (col.kind === "r") {
      return (value * 100).toFixed(2) + "%";
    }
    if (col.kind === "n") {
      return String(Math.round(value));
    }
    var text = value.toLocaleString("zh-CN", { maximumFractionDigits: 0 });
    return col.kind === "p" && value > 0 ? "+" + text : text;
  }

  function opsHtml(days) {
    var cols = (boardOf() && boardOf().opsCols) || [];
    var latest = days.length ? days[days.length - 1] : {};
    var kpis = cols
      .map(function (col) {
        return (
          '<div class="op-kpi"><div class="lab">' +
          esc(col.label) +
          '</div><div class="val' +
          (col.kind === "p" ? " is-gain" : "") +
          '">' +
          esc(opsCell(latest, col)) +
          "</div></div>"
        );
      })
      .join("");
    var max = 1;
    days.forEach(function (day) {
      if (Number(day.payAmount) > max) {
        max = Number(day.payAmount);
      }
    });
    var bars = days
      .map(function (day, index) {
        var width = days.length ? 800 / days.length : 20;
        var height = (Number(day.payAmount) / max) * 160;
        var x = index * width + 4;
        var y = 180 - height;
        return '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + Math.max(width - 8, 2).toFixed(1) + '" height="' + height.toFixed(1) + '" fill="#1677ff"></rect>';
      })
      .join("");
    var head = cols
      .map(function (col) {
        return "<th>" + esc(col.label) + " <i></i></th>";
      })
      .join("");
    var body = days
      .slice()
      .reverse()
      .map(function (day) {
        return (
          "<tr><td>" +
          esc(String(day.date).replace(/-/g, "/")) +
          "</td>" +
          cols
            .map(function (col) {
              return "<td" + (col.kind === "p" ? ' class="op-gain"' : "") + ">" + esc(opsCell(day, col)) + "</td>";
            })
            .join("") +
          "</tr>"
        );
      })
      .join("");
    return (
      '<div class="op-kpis">' +
      kpis +
      '</div><div class="op-chart"><div class="op-chart-leg"><i></i>支付金额(支付)</div>' +
      '<svg class="op-bars" viewBox="0 0 800 220" preserveAspectRatio="none">' +
      bars +
      "</svg></div>" +
      '<section class="ch-table op-table sh-wide"><div class="ch-table-bar"><strong>数据列表</strong>' +
      '<label class="ch-zero"><input type="checkbox" disabled> 显示数字</label>' +
      tools() +
      '</div><div class="ch-table-wrap"><table><thead><tr><th>日期 <i></i></th>' +
      head +
      "</tr></thead><tbody>" +
      (body || '<tr><td colspan="18">暂无经营明细</td></tr>') +
      "</tbody></table></div></section>"
    );
  }

  function overviewHtml(pack, days) {
    var overview = pack.overview;
    var hero = overview.hero || {};
    var down = Number(hero.delta) < 0;
    var cards = (overview.cards || [])
      .map(function (card) {
        return (
          '<article class="ch-card"><div class="label">' +
          esc(card.label) +
          '</div><div class="value">' +
          esc(card.value) +
          "</div>" +
          (card.extra ? '<div class="extra">' + esc(card.extra) + "</div>" : "") +
          "</article>"
        );
      })
      .join("");
    var tabs = (pack.sections || [])
      .map(function (name) {
        return (
          '<button type="button" data-section="' +
          esc(name) +
          '"' +
          (name === state.section ? ' class="is-active"' : "") +
          ">" +
          esc(name) +
          "</button>"
        );
      })
      .join("");
    var body = opsHtml(days);
    if (state.section === "渠道列表") {
      body = tableHtml(overview.channel) + tableHtml(overview.shopTable);
    } else if (state.section === "店铺分组") {
      body = tableHtml(overview.groups);
    } else if (state.section === "竞对对比") {
      body = tableHtml(overview.rivals);
    } else if (state.section === "品类分析") {
      body = tableHtml(overview.categories);
    } else if (state.section === "热销商品") {
      body = tableHtml(overview.hot);
    }
    return (
      '<div class="ch-top"><div class="ch-title">数据总览</div><div class="ch-right"><span class="ch-time">（统计时间：' +
      esc(dateLabel(days)) +
      '）</span><div class="ch-ranges">' +
      rangesHtml() +
      "</div></div></div>" +
      '<div class="ch-summary"><span class="ch-sum-title">综合指标</span><span class="ch-pill">渠道' +
      esc(overview.summary.channels) +
      '个</span><span class="ch-pill">店铺' +
      esc(overview.summary.shops) +
      '个</span><button type="button" class="ch-set" disabled>设定指标</button></div>' +
      '<div class="ch-metrics"><article class="ch-card ch-hero"><div class="label">' +
      esc(hero.label || "实时销售额") +
      '</div><div class="value">' +
      esc(hero.value) +
      '</div><div class="delta ' +
      (down ? "is-down" : "is-up") +
      '">' +
      esc(Math.abs(Number(hero.delta || 0)).toFixed(2)) +
      "% " +
      (down ? "↓" : "↑") +
      "</div>" +
      sparkSvg(hero) +
      '<div class="ch-axis"><span>00</span><span>12</span><span>23</span></div>' +
      '<div class="ch-legs"><i class="is-yest"></i>昨天<i class="is-today"></i>今天</div></article>' +
      cards +
      '</div><div class="ch-tabs">' +
      tabs +
      "</div>" +
      body
    );
  }

  function shopsHtml(pack, days) {
    var shops = pack.shops;
    return (
      '<div class="ch-top"><div class="ch-title">店铺总览</div><div class="ch-right"><span class="ch-time">（统计时间：' +
      esc(dateLabel(days)) +
      '）</span><div class="ch-ranges">' +
      rangesHtml() +
      "</div></div></div>" +
      '<section class="ch-table ch-table-solo sh-wide"><div class="ch-table-bar"><strong>店铺列表</strong>' +
      '<label class="ch-pick"><select disabled><option>请选择标签</option></select></label>' +
      '<label class="ch-zero"><input type="checkbox" disabled> 显示数字</label>' +
      tools() +
      '</div><div class="ch-table-wrap" data-hscroll><table><thead><tr>' +
      (shops.columns || [])
        .map(function (column) {
          return "<th>" + esc(column) + " <i></i></th>";
        })
        .join("") +
      "</tr></thead><tbody>" +
      (shops.rows || [])
        .map(function (row) {
          var mark = row.color ? '<span class="ch-logo" style="background:' + esc(row.color) + '"></span>' : '<span class="ch-bar"></span>';
          return (
            '<tr><td class="ch-name">' +
            mark +
            "<span>" +
            esc(row.name) +
            "</span></td>" +
            (row.cells || [])
              .map(function (cell) {
                return "<td>" + esc(cell) + "</td>";
              })
              .join("") +
            "</tr>"
          );
        })
        .join("") +
      '</tbody></table></div><p class="sh-hint">演示数据。表格可左右滑动，后面还有营销额、利润、费用和打包费。</p></section>'
    );
  }

  function goodsRows() {
    var goods = (boardOf() && boardOf().goods) || { rows: [] };
    return (goods.rows || []).filter(function (row) {
      if (state.shopId && row.shopId !== state.shopId) {
        return false;
      }
      if (state.card !== "all" && !(row.flags && row.flags[state.card])) {
        return false;
      }
      if (state.q) {
        var blob = (row.name + " " + (row.cells || []).join(" ")).toLowerCase();
        if (blob.indexOf(state.q.toLowerCase()) < 0) {
          return false;
        }
      }
      return true;
    });
  }

  function goodsHtml(pack, days) {
    var goods = pack.goods;
    var shown = goodsRows();
    var cards = (goods.cards || [])
      .map(function (card) {
        return (
          '<article class="gd-card' +
          (card.key === state.card ? " is-on" : "") +
          '" data-card="' +
          esc(card.key) +
          '"><div class="gd-card-top"><span class="gd-dot" style="background:' +
          esc(card.color || "#8c8c8c") +
          '"></span><span class="label">' +
          esc(card.label) +
          '</span><button type="button" class="gd-more" disabled>⋯</button></div>' +
          (card.hint ? '<div class="hint">' + esc(card.hint) + "</div>" : "") +
          '<div class="value">' +
          esc(card.value) +
          '</div><div class="extra"><span>' +
          esc(card.share || "") +
          "</span><span>" +
          esc(card.delta || "") +
          "</span></div></article>"
        );
      })
      .join("");
    var shopOpts =
      '<option value="">全部店铺</option>' +
      (goods.shops || [])
        .map(function (shop) {
          return (
            '<option value="' +
            esc(shop.id) +
            '"' +
            (shop.id === state.shopId ? " selected" : "") +
            ">" +
            esc(shop.shopName) +
            "</option>"
          );
        })
        .join("");
    var body = shown
      .map(function (row) {
        return (
          '<tr><td class="ch-name"><span class="gd-thumb" aria-hidden="true"></span><span>' +
          esc(row.name) +
          "</span></td>" +
          (row.cells || [])
            .map(function (cell) {
              return "<td>" + esc(cell) + "</td>";
            })
            .join("") +
          "</tr>"
        );
      })
      .join("");
    if (!body) {
      body = '<tr><td class="ch-empty" colspan="' + ((goods.columns || []).length || 1) + '">没有匹配的演示商品</td></tr>';
    }
    return (
      '<div class="ch-top"><div class="ch-title">商品数据总览</div><div class="ch-right"><span class="ch-time">（统计时间：' +
      esc(dateLabel(days)) +
      '）</span><div class="ch-ranges">' +
      rangesHtml() +
      "</div></div></div>" +
      '<div class="gd-cards">' +
      cards +
      "</div>" +
      '<section class="ch-table ch-table-solo"><div class="ch-table-bar gd-filters">' +
      '<label class="ch-pick"><select data-shop>' +
      shopOpts +
      "</select></label>" +
      '<label class="ch-pick"><select disabled><option>请选择标签</option></select></label>' +
      '<label class="ch-pick"><select disabled><option>请选择类目</option></select></label>' +
      '<label class="ch-pick"><select disabled><option>全部商品</option></select></label>' +
      '<label class="ch-pick gd-search"><input type="search" data-q placeholder="输入商品名/商品ID/网店SKU" value="' +
      esc(state.q) +
      '"></label></div><div class="ch-table-bar">' +
      '<label class="ch-zero"><input type="checkbox" disabled> 只看精选</label>' +
      '<label class="ch-zero"><input type="checkbox" disabled> 只看负责人</label>' +
      '<label class="ch-zero"><input type="checkbox" disabled> 只看有效商品</label>' +
      '<label class="ch-zero"><input type="checkbox" disabled> 显示0</label>' +
      tools() +
      '</div><div class="ch-table-wrap"><table><thead><tr>' +
      (goods.columns || [])
        .map(function (column) {
          return "<th>" + esc(column) + " <i></i></th>";
        })
        .join("") +
      "</tr></thead><tbody>" +
      body +
      "</tbody></table></div></section>"
    );
  }

  function boardHtml() {
    var pack = boardOf();
    if (!pack) {
      return '<p class="ch-empty">正在加载演示模板…</p>';
    }
    var days = sliceDays(pack.days);
    if (state.pane === "shops") {
      return shopsHtml(pack, days);
    }
    if (state.pane === "goods") {
      return goodsHtml(pack, days);
    }
    return overviewHtml(pack, days);
  }

  function panesHtml() {
    var panes = (boardOf() && boardOf().panes) || [
      { key: "overview", label: "数据总揽" },
      { key: "shops", label: "店铺数据" },
      { key: "goods", label: "商品数据" }
    ];
    return panes
      .map(function (pane) {
        return (
          '<button type="button" data-pane="' +
          esc(pane.key) +
          '"' +
          (pane.key === state.pane ? ' class="is-active"' : "") +
          ">" +
          esc(pane.label) +
          "</button>"
        );
      })
      .join("");
  }

  function paint(root) {
    ensureStyle();
    var focused = document.activeElement;
    var focusKey = "";
    var caret = 0;
    if (focused && focused.getAttribute && root.contains(focused)) {
      if (focused.hasAttribute("data-q")) {
        focusKey = "q";
      } else if (focused.hasAttribute("data-from")) {
        focusKey = "from";
      } else if (focused.hasAttribute("data-to")) {
        focusKey = "to";
      }
      caret = focused.selectionStart || 0;
    }
    var pack = boardOf();
    var note = (pack && pack.note) || "演示数据。爬虫，非 ERP。";
    root.innerHTML =
      '<main class="page bd-page" data-bound-source="crawler" data-bound-erp="false" data-bound-demo="true">' +
      '<section class="bd-note" role="status"><b>爬虫，非 ERP。</b> ' +
      esc(String(note).replace(/^演示数据。/, "演示数据。")) +
      (state.stamp ? " " + esc(state.stamp) : "") +
      "</section>" +
      '<p class="bd-msg' +
      (state.error ? " is-error" : "") +
      '">' +
      esc(state.error || (state.loading ? "正在读取演示模板…" : "")) +
      "</p>" +
      '<nav class="bd-panes" aria-label="边界数据中心版式">' +
      panesHtml() +
      '</nav><div class="data-overview-root ch-root"><div id="bd-board">' +
      boardHtml() +
      "</div></div></main>";
    if (focusKey) {
      var next = root.querySelector("[data-" + focusKey + "]");
      if (next && next.focus) {
        next.focus();
        if (next.setSelectionRange) {
          next.setSelectionRange(caret, caret);
        }
      }
    }
  }

  function readControls(root) {
    var from = root.querySelector("[data-from]");
    var to = root.querySelector("[data-to]");
    var q = root.querySelector("[data-q]");
    var shop = root.querySelector("[data-shop]");
    if (from) {
      state.from = from.value;
    }
    if (to) {
      state.to = to.value;
    }
    if (q) {
      state.q = q.value;
    }
    if (shop) {
      state.shopId = shop.value;
    }
  }

  function load(root, mine) {
    state.loading = true;
    state.error = "";
    paint(root);
    return Promise.all([
      fetch("/api/bound", { credentials: "same-origin", headers: { Accept: "application/json" } }).then(function (res) {
        return res.json().then(function (data) {
          return { res: res, data: data };
        });
      }),
      fetch("/api/bound/board", { credentials: "same-origin", headers: { Accept: "application/json" } }).then(function (res) {
        return res.json().then(function (data) {
          return { res: res, data: data };
        });
      })
    ])
      .then(function (results) {
        if (mine !== active) {
          return;
        }
        state.loading = false;
        var stamp = results[0];
        var board = results[1];
        if (stamp.res.ok && stamp.data && stamp.data.source === "crawler" && stamp.data.erp === false) {
          state.stamp = "接口已确认：爬虫，不是 ERP";
        } else {
          state.error = (stamp.data && stamp.data.error) || "边界接口没有标成爬虫";
        }
        if (board.res.ok && board.data && board.data.erp === false && board.data.demo === true) {
          state.board = board.data;
        } else if (!state.error) {
          state.error = (board.data && board.data.error) || "演示模板暂时打不开";
        }
        paint(root);
      })
      .catch(function () {
        if (mine !== active) {
          return;
        }
        state.loading = false;
        state.error = "演示模板没有读到。没有改去请求别的数据源。";
        paint(root);
      });
  }

  function mount(root) {
    var mine = ++active;
    function onClick(event) {
      var target = event.target;
      if (!target || !target.closest || !root.contains(target)) {
        return;
      }
      readControls(root);
      var pane = target.closest("[data-pane]");
      var range = target.closest("[data-range]");
      var section = target.closest("[data-section]");
      var card = target.closest("[data-card]");
      if (pane) {
        state.pane = pane.getAttribute("data-pane") || "overview";
        paint(root);
        return;
      }
      if (range) {
        state.range = range.getAttribute("data-range") || "7天";
        paint(root);
        return;
      }
      if (section) {
        state.section = section.getAttribute("data-section") || "渠道列表";
        paint(root);
        return;
      }
      if (card) {
        state.card = card.getAttribute("data-card") || "all";
        paint(root);
      }
    }
    function onInput(event) {
      var target = event.target;
      if (!target || !root.contains(target)) {
        return;
      }
      if (target.hasAttribute("data-q") || target.hasAttribute("data-from") || target.hasAttribute("data-to")) {
        readControls(root);
        paint(root);
      }
    }
    function onChange(event) {
      var target = event.target;
      if (!target || !target.hasAttribute || !target.hasAttribute("data-shop") || !root.contains(target)) {
        return;
      }
      readControls(root);
      paint(root);
    }
    root.addEventListener("click", onClick);
    root.addEventListener("input", onInput);
    root.addEventListener("change", onChange);
    load(root, mine);
    return function unmount() {
      if (mine === active) {
        active += 1;
      }
      root.removeEventListener("click", onClick);
      root.removeEventListener("input", onInput);
      root.removeEventListener("change", onChange);
      root.innerHTML = "";
    };
  }

  window.XmModules = window.XmModules || {};
  window.XmModules["/bound"] = { mount: mount };
})();
