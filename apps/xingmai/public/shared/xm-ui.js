/* Xingmai Main Content UI components — framework-free, dependency-free. */
(function (global) {
  "use strict";

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function classNames() {
    return Array.prototype.slice.call(arguments).filter(Boolean).join(" ");
  }

  function icon(name) {
    var icons = {
      users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
      play: '<circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4Z"/>',
      file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>',
      award: '<circle cx="12" cy="8" r="5"/><path d="m8.5 12-1 9 4.5-2 4.5 2-1-9"/>',
      chart: '<path d="M3 3v18h18M7 16v-4M12 16V8M17 16V5"/>',
      search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
      arrow: '<path d="m9 18 6-6-6-6"/>',
      check: '<path d="m5 12 4 4L19 6"/>',
      empty: '<path d="M4 7h16v13H4zM8 3h8l2 4H6z"/><path d="M9 13h6"/>',
      close: '<path d="m6 6 12 12M18 6 6 18"/>'
    };
    return (
      '<svg class="xm-ui-icon" viewBox="0 0 24 24" aria-hidden="true">' +
      (icons[name] || icons.file) +
      "</svg>"
    );
  }

  function button(config) {
    var item = config || {};
    return (
      '<button class="' +
      classNames("xm-ui-button", item.variant === "secondary" && "xm-ui-button--secondary", item.size === "small" && "xm-ui-button--small") +
      '" type="' +
      escapeHtml(item.type || "button") +
      '"' +
      (item.id ? ' id="' + escapeHtml(item.id) + '"' : "") +
      (item.disabled ? " disabled" : "") +
      ">" +
      (item.icon ? icon(item.icon) : "") +
      escapeHtml(item.label || "操作") +
      "</button>"
    );
  }

  function PageContentHeader(config) {
    var item = config || {};
    var actions = (item.actions || []).map(button).join("");
    return (
      '<header class="xm-ui-page-header">' +
      '<div class="xm-ui-page-header__copy">' +
      (item.eyebrow ? '<p class="xm-ui-eyebrow">' + escapeHtml(item.eyebrow) + "</p>" : "") +
      '<h1 class="xm-ui-page-title">' + escapeHtml(item.title || "") + "</h1>" +
      (item.description ? '<p class="xm-ui-page-description">' + escapeHtml(item.description) + "</p>" : "") +
      "</div>" +
      (actions ? '<div class="xm-ui-page-actions">' + actions + "</div>" : "") +
      "</header>"
    );
  }

  function StatCard(config) {
    var item = config || {};
    return (
      '<article class="xm-ui-stat-card">' +
      '<span class="' +
      classNames("xm-ui-stat-card__icon", "xm-ui-tone--" + (item.tone || "blue")) +
      '">' +
      icon(item.icon || "chart") +
      "</span>" +
      '<div class="xm-ui-stat-card__body">' +
      '<p class="xm-ui-stat-card__label">' + escapeHtml(item.label || "") + "</p>" +
      '<p class="xm-ui-stat-card__value">' +
      escapeHtml(item.value || "0") +
      (item.unit ? "<small>" + escapeHtml(item.unit) + "</small>" : "") +
      "</p>" +
      (item.note
        ? '<p class="' +
          classNames("xm-ui-stat-card__note", item.trend === "up" && "is-positive") +
          '">' +
          escapeHtml(item.note) +
          "</p>"
        : "") +
      "</div></article>"
    );
  }

  function SectionTitle(config) {
    var item = config || {};
    return (
      '<div class="xm-ui-section-title">' +
      '<div><h2>' +
      escapeHtml(item.title || "") +
      "</h2>" +
      (item.description ? "<p>" + escapeHtml(item.description) + "</p>" : "") +
      "</div>" +
      (item.action
        ? '<button class="xm-ui-text-action" type="button">' +
          escapeHtml(item.action) +
          icon("arrow") +
          "</button>"
        : "") +
      "</div>"
    );
  }

  function ContentCard(config) {
    var item = config || {};
    return (
      '<section class="' +
      classNames("xm-ui-card", item.className) +
      '">' +
      (item.title ? SectionTitle({ title: item.title, description: item.description, action: item.action }) : "") +
      '<div class="xm-ui-card__body">' +
      (item.content || "") +
      "</div></section>"
    );
  }

  function FilterToolbar(config) {
    var item = config || {};
    var tabs = (item.tabs || [])
      .map(function (tab, index) {
        return (
          '<button class="' +
          classNames("xm-ui-tab", (tab.active || (!item.tabs.some(function (entry) { return entry.active; }) && index === 0)) && "is-active") +
          '" type="button" data-xm-ui-tab="' +
          escapeHtml(tab.value || tab.label) +
          '">' +
          escapeHtml(tab.label) +
          "</button>"
        );
      })
      .join("");
    var filters = (item.filters || [])
      .map(function (filter) {
        var options = (filter.options || [])
          .map(function (option) {
            return '<option value="' + escapeHtml(option.value || option) + '">' + escapeHtml(option.label || option) + "</option>";
          })
          .join("");
        return (
          '<label class="xm-ui-field"><span>' +
          escapeHtml(filter.label || "筛选") +
          '</span><select class="xm-ui-select" name="' +
          escapeHtml(filter.name || "") +
          '">' +
          options +
          "</select></label>"
        );
      })
      .join("");
    return (
      '<div class="xm-ui-filter-toolbar">' +
      (tabs ? '<div class="xm-ui-tabs" role="tablist">' + tabs + "</div>" : "") +
      '<div class="xm-ui-filter-toolbar__controls">' +
      filters +
      (item.search !== false
        ? '<label class="xm-ui-search">' +
          icon("search") +
          '<span class="xm-ui-sr-only">搜索</span><input type="search" placeholder="' +
          escapeHtml(item.searchPlaceholder || "搜索关键词") +
          '" /></label>'
        : "") +
      (item.action ? button({ label: item.action, size: "small" }) : "") +
      "</div></div>"
    );
  }

  function StatusBadge(config) {
    var item = typeof config === "string" ? { label: config } : config || {};
    return (
      '<span class="' +
      classNames("xm-ui-status", "xm-ui-status--" + (item.tone || "neutral")) +
      '">' +
      (item.dot === false ? "" : '<i aria-hidden="true"></i>') +
      escapeHtml(item.label || "") +
      "</span>"
    );
  }

  function DataTable(config) {
    var item = config || {};
    var columns = item.columns || [];
    var rows = item.rows || [];
    return (
      '<div class="xm-ui-table-wrap"><table class="xm-ui-table"><thead><tr>' +
      columns.map(function (column) { return "<th>" + escapeHtml(column.label) + "</th>"; }).join("") +
      "</tr></thead><tbody>" +
      rows
        .map(function (row) {
          return (
            "<tr>" +
            columns
              .map(function (column) {
                var value = row[column.key];
                if (column.type === "status") {
                  value = StatusBadge(value);
                } else if (column.render) {
                  value = column.render(value, row);
                } else {
                  value = escapeHtml(value);
                }
                return "<td>" + value + "</td>";
              })
              .join("") +
            "</tr>"
          );
        })
        .join("") +
      "</tbody></table></div>"
    );
  }

  function ChartCard(config) {
    var item = config || {};
    var legend = (item.legend || [])
      .map(function (entry) {
        return (
          '<span><i style="--xm-ui-legend-color:' +
          escapeHtml(entry.color) +
          '"></i>' +
          escapeHtml(entry.label) +
          "</span>"
        );
      })
      .join("");
    return ContentCard({
      className: "xm-ui-chart-card",
      title: item.title,
      action: item.action,
      content:
        (legend ? '<div class="xm-ui-chart-legend">' + legend + "</div>" : "") +
        '<div class="xm-ui-chart" role="img" aria-label="' +
        escapeHtml(item.ariaLabel || item.title || "数据图表") +
        '">' +
        (item.content || "") +
        "</div>"
    });
  }

  function ProgressCard(config) {
    var item = config || {};
    var value = Math.max(0, Math.min(100, Number(item.value) || 0));
    return (
      '<article class="xm-ui-progress-card">' +
      (item.cover ? '<div class="xm-ui-progress-card__cover">' + item.cover + "</div>" : "") +
      '<div class="xm-ui-progress-card__body">' +
      (item.badge ? StatusBadge({ label: item.badge, tone: item.tone || "blue", dot: false }) : "") +
      '<h3>' + escapeHtml(item.title || "") + "</h3>" +
      (item.meta ? "<p>" + escapeHtml(item.meta) + "</p>" : "") +
      '<div class="xm-ui-progress-card__progress"><span style="width:' + value + '%"></span></div>' +
      '<div class="xm-ui-progress-card__foot"><span>已学 ' +
      value +
      "%</span>" +
      (item.action ? '<button type="button">' + escapeHtml(item.action) + icon("arrow") + "</button>" : "") +
      "</div></div></article>"
    );
  }

  function EmptyState(config) {
    var item = config || {};
    return (
      '<div class="xm-ui-empty-state">' +
      '<span class="xm-ui-empty-state__icon">' + icon(item.icon || "empty") + "</span>" +
      '<h3>' + escapeHtml(item.title || "暂无数据") + "</h3>" +
      (item.description ? "<p>" + escapeHtml(item.description) + "</p>" : "") +
      (item.action ? button({ label: item.action, size: "small" }) : "") +
      "</div>"
    );
  }

  global.XmUI = {
    escapeHtml: escapeHtml,
    icon: icon,
    button: button,
    PageContentHeader: PageContentHeader,
    StatCard: StatCard,
    ContentCard: ContentCard,
    SectionTitle: SectionTitle,
    FilterToolbar: FilterToolbar,
    DataTable: DataTable,
    StatusBadge: StatusBadge,
    ChartCard: ChartCard,
    ProgressCard: ProgressCard,
    EmptyState: EmptyState
  };
})(window);
