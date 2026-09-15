(function () {
  window.XmModules = window.XmModules || {};

  var LIVE_CARD_LS = "xm-data-live-cards";
  var LIVE_CARD_SEEN_LS = "xm-data-live-cards-seen";
  var LIVE_CARD_CATALOG = [
    { key: "ad", label: "推广花费 (支付预估)" },
    { key: "profit", label: "利润 (支付预估)" },
    { key: "roi", label: "付费成交ROI" },
    { key: "livePay", label: "实时付费成交额" },
    { key: "liveFee", label: "实时费比" },
    { key: "paidAmount", label: "实时付费金额" }
  ];
  var LIVE_CARD_DEFAULT = ["ad", "profit", "roi", "livePay", "liveFee"];

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
      ".xm-hm-bar{position:relative;display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:10px 12px;margin-bottom:10px;background:var(--xm-card);border:1px solid var(--xm-line);border-radius:8px;box-shadow:var(--xm-shadow)}" +
      ".xm-hm-title{margin:0;font-size:18px;font-weight:650;color:var(--xm-ink)}" +
      ".xm-hm-set{margin-left:auto;height:28px;padding:0 12px;border:1px solid var(--xm-line);border-radius:4px;background:var(--xm-card);color:var(--xm-ink);cursor:pointer;font-size:13px}" +
      ".xm-hm-cpick-mask{position:fixed;inset:0;z-index:4200;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,.45)}" +
      ".xm-hm-cpick{display:flex;flex-direction:column;width:min(720px,100%);max-height:min(560px,100%);background:#fff;border-radius:8px;box-shadow:0 12px 40px rgba(0,0,0,.18);color:#262626;overflow:hidden}" +
      ".xm-hm-cpick-head{display:flex;align-items:center;justify-content:space-between;height:48px;padding:0 20px;border-bottom:1px solid #f0f0f0;font-size:16px}" +
      ".xm-hm-cpick-x{width:28px;height:28px;border:0;background:transparent;color:#8c8c8c;font-size:20px;cursor:pointer}" +
      ".xm-hm-cpick-body{padding:16px 20px;overflow:auto}" +
      ".xm-hm-cpick-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 20px}" +
      ".xm-hm-cpick-opt{display:flex;align-items:center;gap:8px;color:#2f54eb;font-size:14px;cursor:pointer}" +
      ".xm-hm-cpick-opt input{accent-color:#2f54eb}" +
      ".xm-hm-cpick-foot{display:flex;gap:8px;padding:12px 20px;border-top:1px solid #f0f0f0}" +
      ".xm-hm-cpick-ok{height:32px;padding:0 16px;border:0;border-radius:4px;background:#2f54eb;color:#fff;cursor:pointer}" +
      ".xm-hm-cpick-foot [data-cpick='cancel']{height:32px;padding:0 16px;border:1px solid #d9d9d9;border-radius:4px;background:#fff;cursor:pointer}" +
      ".xm-hm-live-clock{margin:0 0 8px;color:var(--xm-muted);font-size:12px}" +
      ".xm-hm-live-charts{display:grid;grid-template-columns:1fr 1fr;gap:10px}" +
      ".xm-hm-chart{background:var(--xm-card);border:1px solid var(--xm-line);border-radius:8px;box-shadow:var(--xm-shadow);padding:14px 16px 10px;min-width:0}" +
      ".xm-hm-legs{display:inline-flex;align-items:center;gap:10px;color:var(--xm-muted);font-size:12px}" +
      ".xm-hm-legs i{width:10px;height:10px;border-radius:50%;display:inline-block}" +
      ".xm-hm-legs i.is-yest{background:#2f54eb}" +
      ".xm-hm-legs i.is-today{background:#cf1322}" +
      ".xm-hm-line{display:block;width:100%;height:160px;margin-top:8px}" +
      ".xm-hm-live-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-top:10px}" +
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

  function catalogKeys() {
    return LIVE_CARD_CATALOG.map(function (item) {
      return item.key;
    });
  }

  function catalogOf(key) {
    return (
      LIVE_CARD_CATALOG.find(function (item) {
        return item.key === key;
      }) || { key: key, label: key }
    );
  }

  function rememberCardCatalog() {
    try {
      localStorage.setItem(LIVE_CARD_SEEN_LS, JSON.stringify(catalogKeys()));
    } catch (_err) {}
  }

  function loadCardKeys() {
    const all = catalogKeys();
    try {
      const raw = localStorage.getItem(LIVE_CARD_LS);
      const seenRaw = localStorage.getItem(LIVE_CARD_SEEN_LS);
      const seen = seenRaw ? JSON.parse(seenRaw) : [];
      const seenList = Array.isArray(seen) ? seen : [];
      const newcomers = all.filter(function (key) {
        return seenList.indexOf(key) < 0;
      });
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const allow = {};
          all.forEach(function (key) {
            allow[key] = true;
          });
          const kept = parsed.filter(function (key) {
            return allow[key];
          });
          newcomers.forEach(function (key) {
            if (kept.indexOf(key) < 0) {
              kept.push(key);
            }
          });
          rememberCardCatalog();
          return kept.length ? kept : LIVE_CARD_DEFAULT.slice();
        }
      }
    } catch (_err) {}
    return LIVE_CARD_DEFAULT.slice();
  }

  function saveCardKeys(keys) {
    try {
      localStorage.setItem(LIVE_CARD_LS, JSON.stringify(keys));
      rememberCardCatalog();
    } catch (_err) {}
  }

  function ratioSeries(paidList, salesList) {
    const n = Math.max((paidList || []).length, (salesList || []).length);
    const out = [];
    let i = 0;
    for (i = 0; i < n; i += 1) {
      const sales = Number(salesList && salesList[i]) || 0;
      const paid = Number(paidList && paidList[i]) || 0;
      out.push(sales ? (paid / sales) * 100 : 0);
    }
    return out;
  }

  function salesChart(hero) {
    const chart = readChart(hero);
    chart.label = "实时销售额";
    return chart;
  }

  function feeRateChart(paid, hero, cards) {
    const paidChart = readChart(paid);
    const heroChart = readChart(hero);
    const feeCard = (cards || []).find(function (card) {
      return card && card.key === "liveFee";
    });
    return {
      label: "实时费比",
      value: (feeCard && feeCard.value) || paidChart.value || "—",
      delta: paidChart.delta,
      yesterday: ratioSeries(paidChart.yesterday, heroChart.yesterday),
      today: ratioSeries(paidChart.today, heroChart.today)
    };
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

  function pickLiveCards(cards, keys) {
    const map = {};
    (cards || []).forEach(function (card) {
      if (card && card.key) {
        map[card.key] = card;
      }
    });
    const want = keys && keys.length ? keys : LIVE_CARD_DEFAULT;
    return want
      .map(function (key) {
        return map[key] || { key: key, label: catalogOf(key).label, value: "—" };
      })
      .filter(Boolean);
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
    const down = Number(chart && chart.delta) < 0;
    return (
      '<article class="xm-hm-chart"><div class="xm-hm-card-head"><span>' +
      escapeHtml((chart && chart.label) || "实时指标") +
      '</span><span class="xm-hm-legs"><i class="is-yest"></i>昨天<i class="is-today"></i>今天</span></div><div class="xm-hm-index-num">' +
      escapeHtml((chart && chart.value) || "—") +
      '</div><div class="xm-hm-trend ' +
      (down ? "is-down" : "is-up") +
      '">环比 ' +
      (down ? "↘" : "↗") +
      " " +
      Math.abs(Number(chart && chart.delta) || 0).toFixed(2) +
      "%</div>" +
      compareLineHtml(chart) +
      "</article>"
    );
  }

  function liveCardHtml(card) {
    return (
      '<article class="xm-hm-card"><div class="xm-hm-card-head"><span>' +
      escapeHtml(card.label) +
      '</span></div><div class="xm-hm-value">' +
      escapeHtml(card.value) +
      "</div>" +
      (card.extra ? '<div class="xm-hm-trend">' + escapeHtml(card.extra) + "</div>" : "") +
      "</article>"
    );
  }

  function rankMark(index) {
    if (index === 0) {
      return '<b class="xm-hm-cup gold">1</b>';
    }
    if (index === 1) {
      return '<b class="xm-hm-cup silver">2</b>';
    }
    if (index === 2) {
      return '<b class="xm-hm-cup bronze">3</b>';
    }
    return "<span>" + (index + 1) + "</span>";
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
    const incoming = a.cards && a.cards.length ? a.cards : b.cards;
    const paid = readChart(a.paid || a.paidHero, b.paid || b.paidHero);
    const hero = readChart(a.hero, b.hero);
    const extras = [{ key: "paidAmount", label: "实时付费金额", value: paid.value || "—" }];
    const cards = pickLiveCards((incoming || []).concat(extras), catalogKeys());
    return {
      ok: true,
      title: a.title || b.title || "实时看板",
      summary: a.summary || b.summary || { channels: 1, shops: shops.length },
      hero: hero,
      paid: paid,
      cards: cards,
      shops: shops
    };
  }

  function createLiveDashboard(root) {
    ensureCss();
    stripPageChrome(root);
    let board = root.querySelector("#board");
    if (!board) {
      root.innerHTML = '<main class="xm-page data-overview-root"><div id="board"></div></main>';
      board = root.querySelector("#board");
    }
    let payload = null;
    let liveAt = "";
    let mark = "星脉";
    let dead = false;
    let poll = 0;
    let pickKeys = loadCardKeys();

    function closePicker() {
      const el = document.getElementById("xm-hm-cpick-root");
      if (el) {
        el.remove();
      }
    }

    function pickerHtml() {
      const opts = LIVE_CARD_CATALOG.map(function (item) {
        const on = pickKeys.indexOf(item.key) >= 0 ? " checked" : "";
        return (
          '<label class="xm-hm-cpick-opt"><input type="checkbox" data-cpick-key="' +
          escapeHtml(item.key) +
          '"' +
          on +
          ">" +
          escapeHtml(item.label) +
          "</label>"
        );
      }).join("");
      return (
        '<div class="xm-hm-cpick-mask" data-cpick-mask>' +
        '<div class="xm-hm-cpick" role="dialog" aria-label="卡片设置">' +
        '<div class="xm-hm-cpick-head"><span>卡片设置</span><button type="button" class="xm-hm-cpick-x" data-cpick="close" aria-label="关闭">×</button></div>' +
        '<div class="xm-hm-cpick-body"><div class="xm-hm-cpick-grid">' +
        opts +
        '</div></div><div class="xm-hm-cpick-foot"><button type="button" class="xm-hm-cpick-ok" data-cpick="ok">确定</button><button type="button" data-cpick="cancel">取消</button></div></div></div>'
      );
    }

    function openPicker() {
      closePicker();
      pickKeys = loadCardKeys();
      const el = document.createElement("div");
      el.id = "xm-hm-cpick-root";
      el.innerHTML = pickerHtml();
      el.addEventListener("click", function (event) {
        if (event.target.closest("[data-cpick='ok']")) {
          const next = [];
          Array.prototype.forEach.call(el.querySelectorAll("[data-cpick-key]"), function (box) {
            if (box.checked) {
              next.push(box.getAttribute("data-cpick-key"));
            }
          });
          saveCardKeys(next.length ? next : LIVE_CARD_DEFAULT.slice());
          closePicker();
          render();
          return;
        }
        if (event.target.closest("[data-cpick='cancel'], [data-cpick='close']")) {
          closePicker();
          return;
        }
        if (event.target.hasAttribute("data-cpick-mask")) {
          closePicker();
        }
      });
      document.body.appendChild(el);
    }

    function render() {
      if (dead || !payload || !board) {
        return;
      }
      const shops = payload.shops || [];
      const liveCards = pickLiveCards(payload.cards, loadCardKeys());
      const shopCount = (payload.summary && payload.summary.shops) || shops.length;
      board.innerHTML =
        '<div class="xm-hm" id="xm-hm">' +
        '<div class="xm-hm-mark" aria-hidden="true">' +
        new Array(18)
          .fill(0)
          .map(function () {
            return "<span>" + escapeHtml(mark) + "</span>";
          })
          .join("") +
        "</div>" +
        '<div class="xm-hm-bar"><h1 class="xm-hm-title">实时看板</h1><button type="button" class="xm-hm-set" data-cards="open">卡片设置</button></div>' +
        '<section class="xm-hm-live">' +
        '<div class="xm-hm-live-clock">每5分钟自动刷新' +
        (liveAt ? " · 上次 " + escapeHtml(liveAt) : "") +
        '</div><div class="xm-hm-live-charts">' +
        liveChartHtml(salesChart(payload.hero)) +
        liveChartHtml(feeRateChart(payload.paid, payload.hero, payload.cards)) +
        '</div><div class="xm-hm-live-cards">' +
        liveCards.map(liveCardHtml).join("") +
        '</div><div class="xm-hm-panel"><h2>店铺 <span>' +
        escapeHtml(String(shopCount)) +
        " 店</span></h2>" +
        '<table class="xm-hm-table"><thead><tr><th>排名</th><th>店铺名称</th><th>实时销售额</th><th>实时付费金额</th><th>实时利润</th><th>实时付费ROI</th><th>实时付费成交额</th><th>实时费比</th></tr></thead><tbody>' +
        shops
          .map(function (row, i) {
            return liveShopRowHtml(row, i);
          })
          .join("") +
        "</tbody></table></div></section>" +
        '<p class="xm-hm-note">实时页每5分钟自动拉一次数。版式与首页实时板块相同。</p></div>';
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
            board.innerHTML = '<p class="data-table error">' + escapeHtml(err.message) + "</p>";
          }
        });
    }

    json("/api/auth/me").then(function (user) {
      if (dead || !user) {
        return;
      }
      mark = user.displayName || user.username || mark;
      if (payload) {
        render();
      }
    });

    board.addEventListener("click", function (event) {
      if (event.target.closest("[data-cards='open']")) {
        event.preventDefault();
        openPicker();
      }
    });

    load();
    poll = window.setInterval(function () {
      if (!dead) {
        load();
      }
    }, 5 * 60 * 1000);

    return function unmount() {
      dead = true;
      window.clearInterval(poll);
      closePicker();
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
