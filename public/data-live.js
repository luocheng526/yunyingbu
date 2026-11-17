(function () {
  window.XmModules = window.XmModules || {};

  var LIVE_CARD_KEYS = ["ad", "profit", "roi", "livePay", "liveFee"];
  var HOME_VIEWS = [
    { key: "company", label: "公司", href: "/home" },
    { key: "team", label: "团队", href: "/home" },
    { key: "live", label: "实时", href: "/data/paid" },
    { key: "board", label: "排行榜", href: "/home" }
  ];

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function cssText() {
    return (
      ".xm-hm{position:relative;display:block;box-sizing:border-box;padding:10px 12px 24px;color:var(--xm-ink)}" +
      ".xm-hm-mark{pointer-events:none;position:absolute;inset:0;overflow:hidden;opacity:.045;font-size:42px;font-weight:700;letter-spacing:.4em;display:flex;flex-wrap:wrap;align-content:flex-start;gap:48px 64px;padding:40px 20px;color:var(--xm-ink)}" +
      ".xm-hm-mark span{transform:rotate(-18deg)}" +
      ".xm-hm-bar{position:relative;display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:8px 10px;margin-bottom:10px;background:var(--xm-card);border:1px solid var(--xm-line);border-radius:8px;box-shadow:var(--xm-shadow)}" +
      ".xm-hm-views{display:flex;align-items:center;gap:6px}" +
      ".xm-hm-views a,.xm-hm-views button{border:0;background:transparent;color:var(--xm-muted);padding:6px 10px;border-radius:6px;cursor:pointer;font-size:13px;text-decoration:none}" +
      ".xm-hm-views a.is-on,.xm-hm-views button.is-on{color:var(--xm-primary);background:var(--xm-primary-soft);font-weight:600}" +
      ".xm-hm-live-clock{margin:0 0 8px;color:var(--xm-muted);font-size:12px}" +
      ".xm-hm-live-charts{display:grid;grid-template-columns:1fr 1fr;gap:10px}" +
      ".xm-hm-chart{background:var(--xm-card);border:1px solid var(--xm-line);border-radius:8px;box-shadow:var(--xm-shadow);padding:14px 16px 10px;min-width:0}" +
      ".xm-hm-legs{display:inline-flex;align-items:center;gap:10px;color:var(--xm-muted);font-size:12px}" +
      ".xm-hm-legs i{width:10px;height:10px;border-radius:50%;display:inline-block}" +
      ".xm-hm-legs i.is-yest{background:#2f54eb}" +
      ".xm-hm-legs i.is-today{background:#cf1322}" +
      ".xm-hm-line{display:block;width:100%;height:160px;margin-top:8px}" +
      ".xm-hm-live-cards{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-top:10px}" +
      ".xm-hm-card{background:var(--xm-card);border:1px solid var(--xm-line);border-radius:8px;padding:12px 14px 10px;box-shadow:var(--xm-shadow);min-height:104px}" +
      ".xm-hm-card-head{display:flex;align-items:center;justify-content:space-between;color:var(--xm-muted);font-size:12px}" +
      ".xm-hm-value{margin-top:8px;font-size:22px;font-weight:700;letter-spacing:-.02em;color:var(--xm-ink)}" +
      ".xm-hm-trend{margin-top:6px;font-size:12px;color:var(--xm-muted)}" +
      ".xm-hm-trend.is-up{color:#cf1322}" +
      ".xm-hm-trend.is-down{color:#389e0d}" +
      ".xm-hm-index-num{margin:8px 0 6px;font-size:28px;font-weight:700;color:var(--xm-primary)}" +
      ".xm-hm-panel{width:100%;margin-top:10px;background:var(--xm-card);border:1px solid var(--xm-line);border-radius:8px;box-shadow:var(--xm-shadow);padding:12px 12px 8px;overflow-x:auto}" +
      ".xm-hm-panel h2{margin:0 0 8px;font-size:14px;display:flex;align-items:center;justify-content:space-between;gap:8px}" +
      ".xm-hm-table{width:100%;min-width:960px;border-collapse:collapse;font-size:12px}" +
      ".xm-hm-table th{text-align:left;color:var(--xm-muted);font-weight:500;padding:6px 4px;border-bottom:1px solid var(--xm-line)}" +
      ".xm-hm-table td{padding:7px 4px;border-bottom:1px solid var(--xm-line);color:var(--xm-ink)}" +
      ".xm-hm-table th:nth-child(n+3),.xm-hm-table td:nth-child(n+3){text-align:right}" +
      ".xm-hm-cup{display:inline-flex;width:18px;height:18px;border-radius:50%;align-items:center;justify-content:center;color:#fff;font-size:11px}" +
      ".xm-hm-cup.gold{background:#f5a623}" +
      ".xm-hm-cup.silver{background:#8c8c8c}" +
      ".xm-hm-cup.bronze{background:#d46b08}" +
      ".xm-hm-note{margin:8px 0 0;color:var(--xm-muted);font-size:12px}" +
      "@media (max-width:1200px){.xm-hm-live-cards,.xm-hm-live-charts{grid-template-columns:repeat(2,minmax(0,1fr))}}" +
      "@media (max-width:700px){.xm-hm-live-cards,.xm-hm-live-charts{grid-template-columns:1fr}}"
    );
  }

  function ensureCss() {
    if (!document.getElementById("xm-data-live-css")) {
      const style = document.createElement("style");
      style.id = "xm-data-live-css";
      style.textContent = cssText();
      document.head.appendChild(style);
    }
  }

  function stripPageChrome(root) {
    Array.prototype.forEach.call(root.querySelectorAll(".kicker, .data-subnav"), function (el) {
      el.remove();
    });
    Array.prototype.forEach.call(root.querySelectorAll("h1"), function (el) {
      if (/实时付费|实时看板/.test(el.textContent.trim())) {
        el.remove();
      }
    });
  }

  function shanghaiClock() {
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(new Date());
  }

  function readChart(chart, fallback) {
    const src = chart || {};
    const base = fallback || {};
    return {
      label: src.label || base.label || "实时指标",
      value: src.value || base.value || "—",
      delta: src.delta != null ? src.delta : base.delta,
      yesterday: src.yesterday && src.yesterday.length ? src.yesterday : base.yesterday || [],
      today: src.today && src.today.length ? src.today : src.spark && src.spark.length ? src.spark : base.today || []
    };
  }

  function pickLiveCards(cards) {
    const map = {};
    (cards || []).forEach(function (card) {
      if (card && card.key) {
        map[card.key] = card;
      }
    });
    return LIVE_CARD_KEYS.map(function (key) {
      return map[key];
    }).filter(Boolean);
  }

  function compareLineHtml(chart) {
    const width = 640;
    const height = 168;
    const padX = 8;
    const padY = 14;
    const yest = (chart && chart.yesterday) || [];
    const today = (chart && chart.today) || [];
    let max = 1;
    yest.concat(today).forEach(function (n) {
      const v = Number(n) || 0;
      if (v > max) {
        max = v;
      }
    });
    const steps = Math.max(yest.length, today.length, 2) - 1;
    function pts(list) {
      if (!list.length) {
        return "";
      }
      return list
        .map(function (n, i) {
          const x = padX + (i / steps) * (width - padX * 2);
          const y = height - padY - ((Number(n) || 0) / max) * (height - padY * 2);
          return x.toFixed(1) + "," + y.toFixed(1);
        })
        .join(" ");
    }
    const yestPts = pts(yest);
    const todayPts = pts(today);
    return (
      '<svg class="xm-hm-line" viewBox="0 0 ' +
      width +
      " " +
      height +
      '" preserveAspectRatio="none" aria-hidden="true">' +
      (yestPts
        ? '<polyline fill="none" stroke="#2f54eb" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" points="' +
          yestPts +
          '"></polyline>'
        : "") +
      (todayPts
        ? '<polyline fill="none" stroke="#cf1322" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" points="' +
          todayPts +
          '"></polyline>'
        : "") +
      "</svg>"
    );
  }

  function liveChartHtml(chart) {
    const kit = window.XmUI;
    if (!kit) {
      return "";
    }
    const down = Number(chart && chart.delta) < 0;
    return kit.ChartCard({
      title: (chart && chart.label) || "实时指标",
      legend: [
        { label: "昨天", color: "#2f54eb" },
        { label: "今天", color: "#cf1322" }
      ],
      content:
        kit.StatCard({
          label: (chart && chart.label) || "实时指标",
          value: String((chart && chart.value) || "—"),
          note:
            "环比 " +
            (down ? "↘" : "↗") +
            " " +
            Math.abs(Number(chart && chart.delta) || 0).toFixed(2) +
            "%",
          tone: down ? "orange" : "blue",
          trend: down ? undefined : "up",
          icon: "chart"
        }) +
        compareLineHtml(chart)
    });
  }

  function liveCardHtml(card) {
    const kit = window.XmUI;
    if (!kit) {
      return "";
    }
    return kit.StatCard({
      label: card.label,
      value: String(card.value),
      note: card.extra || "",
      icon: "chart",
      tone: "blue"
    });
  }

  function rankMark(index) {
    const kit = window.XmUI;
    if (index === 0) {
      return kit ? kit.StatusBadge({ label: "1", tone: "green" }) : "1";
    }
    if (index === 1) {
      return kit ? kit.StatusBadge({ label: "2", tone: "blue" }) : "2";
    }
    if (index === 2) {
      return kit ? kit.StatusBadge({ label: "3", tone: "orange" }) : "3";
    }
    return String(index + 1);
  }

  function liveShopRowHtml(row, index) {
    return (
      "<tr><td>" +
      rankMark(index) +
      "</td><td>" +
      escapeHtml(row.shop) +
      "</td><td>" +
      escapeHtml(row.liveAmount || "—") +
      "</td><td>" +
      escapeHtml(row.paidAmount || "—") +
      "</td><td>" +
      escapeHtml(row.profit || "—") +
      "</td><td>" +
      escapeHtml(row.roi || "—") +
      "</td><td>" +
      escapeHtml(row.paidDeal || "—") +
      "</td><td>" +
      escapeHtml(row.feeRate || "—") +
      "</td></tr>"
    );
  }

  function tableLooksLikeHome(block) {
    const cols = ((block && block.columns) || []).join(" ");
    return /实时付费金额/.test(cols) && /实时销售额|实时销售指数/.test(cols);
  }

  function shopsFromTable(block) {
    if (!block || !tableLooksLikeHome(block)) {
      return [];
    }
    return (block.rows || [])
      .filter(function (row) {
        const name = row.name || row.shop || "";
        return name && name !== "当页汇总" && row.kind !== "sum";
      })
      .map(function (row) {
        const cells = row.cells || [];
        return {
          shop: row.name || row.shop,
          liveAmount: cells[0] || row.liveAmount || "—",
          paidAmount: cells[1] || row.paidAmount || "—",
          profit: cells[2] || row.profit || "—",
          roi: cells[3] || row.roi || "—",
          paidDeal: cells[4] || row.paidDeal || "—",
          feeRate: cells[5] || row.feeRate || "—"
        };
      });
  }

  function mergeLive(base, extra) {
    const a = base && base.ok !== false ? base : {};
    const b = extra && extra.ok !== false ? extra : {};
    const shops =
      a.shops && a.shops.length
        ? a.shops
        : b.shops && b.shops.length
          ? b.shops
          : shopsFromTable(a.shopLiveTable).length
            ? shopsFromTable(a.shopLiveTable)
            : shopsFromTable(b.shopLiveTable);
    const cards = pickLiveCards(a.cards && a.cards.length ? a.cards : b.cards);
    return {
      ok: true,
      title: a.title || b.title || "实时看板",
      summary: a.summary || b.summary || { channels: 1, shops: shops.length },
      hero: readChart(a.hero, b.hero),
      paid: readChart(a.paid || a.paidHero, b.paid || b.paidHero),
      cards: cards,
      shops: shops
    };
  }

  function createLiveDashboard(root) {
    ensureCss();
    stripPageChrome(root);
    if (window.XmDataUi) {
      window.XmDataUi.markScope(root);
    }
    let board = root.querySelector("#board");
    if (!board) {
      root.innerHTML = '<main class="xm-page xm-ui-scope data-overview-root"><div id="board"></div></main>';
      board = root.querySelector("#board");
    }
    if (window.XmDataUi) {
      window.XmDataUi.markScope(board);
    }
    let payload = null;
    let liveAt = "";
    let mark = "星脉";
    let dead = false;
    let poll = 0;

    function render() {
      if (dead || !payload || !board) {
        return;
      }
      const kit = window.XmUI;
      const ui = window.XmDataUi;
      if (!kit || !ui) {
        return;
      }
      const shops = payload.shops || [];
      const liveCards = pickLiveCards(payload.cards);
      const shopCount = (payload.summary && payload.summary.shops) || shops.length;
      board.innerHTML =
        kit.PageContentHeader({
          eyebrow: "数据中心",
          title: payload.title || "实时看板",
          description: "每5分钟自动刷新" + (liveAt ? " · 上次 " + liveAt : "")
        }) +
        ui.viewTabs(HOME_VIEWS, "live") +
        liveChartHtml(payload.hero) +
        liveChartHtml(payload.paid) +
        '<div class="xm-ui-stat-grid">' +
        liveCards.map(liveCardHtml).join("") +
        "</div>" +
        kit.ContentCard({
          title: "店铺 " + String(shopCount) + " 店",
          content: kit.DataTable({
            columns: [
              {
                key: "rank",
                label: "排名",
                render: function (v) {
                  return v;
                }
              },
              { key: "shop", label: "店铺名称" },
              { key: "liveAmount", label: "实时销售额" },
              { key: "paidAmount", label: "实时付费金额" },
              { key: "profit", label: "实时利润" },
              { key: "roi", label: "实时付费ROI" },
              { key: "paidDeal", label: "实时付费成交额" },
              { key: "feeRate", label: "实时费比" }
            ],
            rows: shops.map(function (row, i) {
              return {
                rank: rankMark(i),
                shop: row.shop,
                liveAmount: row.liveAmount || "—",
                paidAmount: row.paidAmount || "—",
                profit: row.profit || "—",
                roi: row.roi || "—",
                paidDeal: row.paidDeal || "—",
                feeRate: row.feeRate || "—"
              };
            })
          })
        }) +
        '<p>实时页每5分钟自动拉一次数。</p>';
    }

    function applyPayload(data) {
      if (dead || !data) {
        return;
      }
      payload = data;
      liveAt = shanghaiClock();
      render();
    }

    function json(path) {
      return fetch(path, { credentials: "same-origin", headers: { Accept: "application/json" } }).then(function (res) {
        if (!res.ok) {
          return null;
        }
        return res.json();
      });
    }

    function loadDemo() {
      return json("/data/live-demo.json");
    }

    function load() {
      return Promise.all([json("/api/data/live"), json("/api/home/live")])
        .then(function (pack) {
          const merged = mergeLive(pack[0], pack[1]);
          if (merged.shops && merged.shops.length && merged.hero && merged.hero.value) {
            return merged;
          }
          return loadDemo().then(function (demo) {
            return mergeLive(merged, demo);
          });
        })
        .catch(function () {
          return loadDemo();
        })
        .then(function (data) {
          if (data) {
            applyPayload(mergeLive(data, null));
          }
        })
        .catch(function (err) {
          if (!dead && board) {
            board.innerHTML = window.XmUI
              ? window.XmUI.EmptyState({ title: err.message })
              : '<p class="data-table error">' + escapeHtml(err.message) + "</p>";
          }
        });
    }

    board.addEventListener("click", function (event) {
      const tab = event.target.closest("[data-view]");
      if (!tab) {
        return;
      }
      const key = tab.getAttribute("data-view");
      const item = HOME_VIEWS.filter(function (view) {
        return view.key === key;
      })[0];
      if (item && item.href && item.key !== "live") {
        window.location.href = item.href;
      }
    });

    json("/api/auth/me").then(function (user) {
      if (dead || !user) {
        return;
      }
      mark = user.displayName || user.username || mark;
      if (payload) {
        render();
      }
    });

    if (window.XmDataUi) {
      window.XmDataUi.ready(function () {
        if (!dead) {
          load();
        }
      });
    } else {
      load();
    }
    poll = window.setInterval(function () {
      if (!dead) {
        load();
      }
    }, 5 * 60 * 1000);

    return function unmount() {
      dead = true;
      window.clearInterval(poll);
    };
  }

  window.XmDataCreateLiveDashboard = createLiveDashboard;

  const liveModule = {
    mount: function (root) {
      return createLiveDashboard(root);
    }
  };

  try {
    Object.defineProperty(window.XmModules, "/data/paid", {
      configurable: true,
      enumerable: true,
      get: function () {
        return liveModule;
      },
      set: function () {}
    });
  } catch (_err) {
    window.XmModules["/data/paid"] = liveModule;
  }

  const existingBoard = document.getElementById("board");
  if (existingBoard && /\/data\/paid\/?$/.test(location.pathname)) {
    createLiveDashboard(existingBoard.closest(".xm-page") || document.body);
  }
})();
