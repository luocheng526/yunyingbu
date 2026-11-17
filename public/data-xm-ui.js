/* Data-center pages paint through window.XmUI. Do not copy shell components. */
(function (w) {
  function ui() {
    return w.XmUI;
  }

  function markScope(root) {
    if (!root) {
      return;
    }
    if (root.classList) {
      if (root.classList.contains("xm-page") || root.id === "board") {
        root.classList.add("xm-ui-scope");
      }
    }
    const pages = root.querySelectorAll ? root.querySelectorAll(".xm-page") : [];
    for (let i = 0; i < pages.length; i += 1) {
      pages[i].classList.add("xm-ui-scope");
    }
    const board = root.id === "board" ? root : root.querySelector && root.querySelector("#board");
    if (board && board.classList) {
      board.classList.add("xm-ui-scope");
    }
  }

  function loadSharedKit() {
    if (!document.querySelector('link[href*="xm-ui.css"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/shared/xm-ui.css";
      document.head.appendChild(link);
    }
    if (w.XmUI || document.querySelector('script[src="/shared/xm-ui.js"]')) {
      return;
    }
    const script = document.createElement("script");
    script.src = "/shared/xm-ui.js";
    document.head.appendChild(script);
  }

  function ready(cb) {
    if (typeof cb !== "function") {
      return;
    }
    if (w.XmUI) {
      cb(w.XmUI);
      return;
    }
    loadSharedKit();
    let n = 0;
    const tick = w.setInterval(function () {
      n += 1;
      if (w.XmUI) {
        w.clearInterval(tick);
        cb(w.XmUI);
      } else if (n > 60) {
        w.clearInterval(tick);
        cb(null);
      }
    }, 50);
  }

  function tone(i) {
    return ["blue", "green", "orange", "purple"][i % 4];
  }

  function glyph(i) {
    return ["chart", "file", "users", "award"][i % 4];
  }

  function statGrid(cards) {
    const kit = ui();
    if (!kit) {
      return "";
    }
    return (
      '<div class="xm-ui-stat-grid">' +
      (cards || [])
        .map(function (card, i) {
          return kit.StatCard({
            label: card.label,
            value: String(card.value == null ? "0" : card.value),
            unit: card.unit || "",
            note: card.extra || card.note || "",
            icon: glyph(i),
            tone: tone(i),
            trend: card.trend
          });
        })
        .join("") +
      "</div>"
    );
  }

  function tools(labels, onLabel) {
    const kit = ui();
    if (!kit) {
      return "";
    }
    return (
      '<div class="xm-ui-page-actions">' +
      (labels || [])
        .map(function (label) {
          return kit.button({
            label: label,
            size: "small",
            variant: label === onLabel ? undefined : "secondary",
            disabled: true
          });
        })
        .join("") +
      "</div>"
    );
  }

  function rangeTabs(labels, active) {
    const kit = ui();
    if (!kit) {
      return "";
    }
    return kit
      .FilterToolbar({
        search: false,
        tabs: (labels || []).map(function (label) {
          return { label: label, value: label, active: label === active };
        })
      })
      .replace(/data-xm-ui-tab="/g, 'data-range="');
  }

  function sectionTabs(labels, active) {
    const kit = ui();
    if (!kit) {
      return "";
    }
    return kit
      .FilterToolbar({
        search: false,
        tabs: (labels || []).map(function (label) {
          return { label: label, value: label, active: label === active };
        })
      })
      .replace(/data-xm-ui-tab="/g, 'data-section="');
  }

  function viewTabs(items, active) {
    const kit = ui();
    if (!kit) {
      return "";
    }
    return kit
      .FilterToolbar({
        search: false,
        tabs: (items || []).map(function (item) {
          return { label: item.label, value: item.key, active: item.key === active };
        })
      })
      .replace(/data-xm-ui-tab="/g, 'data-view="');
  }

  function empty(title, description) {
    const kit = ui();
    if (!kit) {
      return '<p class="ch-empty">' + String(title || "暂无数据") + "</p>";
    }
    return kit.EmptyState({ title: title || "暂无数据", description: description || "" });
  }

  w.XmDataUi = {
    ui: ui,
    markScope: markScope,
    ready: ready,
    statGrid: statGrid,
    tools: tools,
    rangeTabs: rangeTabs,
    sectionTabs: sectionTabs,
    viewTabs: viewTabs,
    empty: empty
  };
})(window);
