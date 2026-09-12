(function () {
  window.XmModules = window.XmModules || {};

  var RANGES = ["7天", "30天", "日", "周", "月", "年", "自定义"];
  var SECTIONS = ["渠道列表", "店铺分组", "经营数据", "竞对对比", "品类分析", "热销商品"];
  var TABLE_COLS = [
    "实时销售额 (支付)",
    "店铺上新成功率",
    "销售单数",
    "净销售单数 (支付)",
    "支付金额 (支付)",
    "无效单金额 (标注)",
    "退款金额",
    "退款率 (按金额)",
    "净销售额 (支付)"
  ];

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function ensureCss() {
    if (!document.querySelector('link[href^="/data-pages.css"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/data-pages.css?v=data-ov1";
      document.head.appendChild(link);
    }
    ensureHeroStyle();
  }

  function ensureHeroStyle() {
    if (document.getElementById("ch-hero-style")) {
      return;
    }
    const style = document.createElement("style");
    style.id = "ch-hero-style";
    style.textContent =
      ".ch-hero .label{display:flex;align-items:center;gap:8px;flex-wrap:wrap}" +
      ".ch-clock{font-variant-numeric:tabular-nums;font-size:12px;opacity:.55;letter-spacing:.04em}" +
      ".ch-hero .value{margin:8px 0 6px}" +
      ".ch-hero .delta{margin:0 0 6px;font-size:12px}" +
      ".ch-hero .ch-spark{display:block;width:100%;height:72px;margin:0}" +
      ".ch-axis{display:flex;justify-content:space-between;font-size:10px;opacity:.4;margin:2px 0 4px}" +
      ".ch-legs{display:flex;align-items:center;gap:10px;font-size:11px;opacity:.7}" +
      ".ch-legs i{width:8px;height:8px;border-radius:50%;display:inline-block}" +
      ".ch-legs i.is-yest{background:#2f54eb}" +
      ".ch-legs i.is-today{background:#cf1322}";
    document.head.appendChild(style);
  }

  var CAL_SHADOW_CSS =
    ":host{position:fixed;z-index:4000;display:none;box-sizing:border-box;width:560px;background:#fff;border:1px solid #e8e8e8;border-radius:4px;box-shadow:0 6px 16px rgba(0,0,0,.12);color:#262626;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif}" +
    ":host(.is-open){display:block}" +
    ".ch-cal{display:flex;width:560px}" +
    ".ch-cal-month{width:280px;padding:8px 12px 10px;box-sizing:border-box}" +
    ".ch-cal-month + .ch-cal-month{border-left:1px solid #f0f0f0}" +
    ".ch-cal-head{position:relative;height:32px;line-height:32px;text-align:center;font-size:14px}" +
    ".ch-cal-head button{position:absolute;top:4px;width:22px;height:22px;padding:0;border:0;background:transparent;color:#8c8c8c;font-size:12px;line-height:22px;cursor:pointer}" +
    ".ch-cal-head [data-cal='prev-year']{left:0}" +
    ".ch-cal-head [data-cal='prev-month']{left:20px}" +
    ".ch-cal-head [data-cal='next-month']{right:20px}" +
    ".ch-cal-head [data-cal='next-year']{right:0}" +
    "table{width:100%;border-collapse:collapse;table-layout:fixed}" +
    "th{height:24px;font-size:12px;font-weight:400;color:#8c8c8c}" +
    "td{height:28px;padding:0;text-align:center}" +
    "td button{display:block;width:100%;height:28px;margin:0;padding:0;border:0;border-radius:2px;background:transparent;color:#262626;font:13px/28px inherit;cursor:pointer}" +
    "td button:hover:not(:disabled):not(.is-start):not(.is-end){background:#f5f5f5}" +
    "td button.is-out,td button.is-over,td button.is-future,td button:disabled{color:#bfbfbf;cursor:default}" +
    "td button.is-today{color:#cf1322;font-weight:600}" +
    "td button.is-in{background:#fff1f0;color:#c62828}" +
    "td button.is-start,td button.is-end{background:#c62828;color:#fff}";

  function getCalPop() {
    let el = document.getElementById("ch-cal-pop");
    if (el && !el.shadowRoot) {
      el.remove();
      el = null;
    }
    if (!el) {
      el = document.createElement("div");
      el.id = "ch-cal-pop";
      el.className = "ch-cal-pop";
      el.attachShadow({ mode: "open" });
      document.body.appendChild(el);
    }
    return el;
  }

  function hideCalPop() {
    const el = document.getElementById("ch-cal-pop");
    if (el) {
      el.classList.remove("is-open");
      if (el.shadowRoot) {
        el.shadowRoot.innerHTML = "";
      }
    }
  }

  function pathEl(event, attr) {
    const path = event.composedPath ? event.composedPath() : [];
    for (let i = 0; i < path.length; i += 1) {
      const node = path[i];
      if (node && node.getAttribute && node.getAttribute(attr) != null) {
        return node;
      }
    }
    return null;
  }

  function stripPageChrome(root) {
    Array.prototype.forEach.call(root.querySelectorAll(".kicker, .data-subnav, .page-head"), function (el) {
      el.remove();
    });
    Array.prototype.forEach.call(root.querySelectorAll("h1"), function (el) {
      if (/数据总揽|数据总览|渠道总览/.test(el.textContent.trim())) {
        el.remove();
      }
    });
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function ymd(date) {
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
  }

  function slashDate(date) {
    return date.getFullYear() + "/" + (date.getMonth() + 1) + "/" + date.getDate();
  }

  function shanghaiHour() {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Shanghai",
      hour: "2-digit",
      hour12: false
    }).formatToParts(new Date());
    const hour = parts.find(function (part) {
      return part.type === "hour";
    });
    return Number(hour && hour.value) || 0;
  }

  function shanghaiHms() {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Shanghai",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(new Date());
  }

  function cumulativeCurve(total, points) {
    const n = Math.max(Number(points) || 0, 2);
    const end = Number(total) || 0;
    const out = [];
    for (let i = 0; i < n; i += 1) {
      const t = (i + 1) / n;
      const eased = t * t * (3 - 2 * t);
      out.push(Number((end * eased).toFixed(2)));
    }
    return out;
  }

  function seedHeroCompare(yestTotal, todayTotal) {
    const hour = Math.max(0, Math.min(shanghaiHour(), 23));
    const todayPts = Math.max(2, hour + 1);
    const yesterday = cumulativeCurve(yestTotal, 24);
    const todayEnd =
      todayTotal != null ? todayTotal : (Number(yestTotal) || 0) * (todayPts / 24);
    const today = cumulativeCurve(todayEnd, todayPts);
    const idx = Math.min(today.length, yesterday.length) - 1;
    const now = today[today.length - 1] || 0;
    const then = yesterday[idx] || 0;
    const delta = then ? Number((((now - then) / Math.abs(then)) * 100).toFixed(2)) : 0;
    return { yesterday: yesterday, today: today, delta: delta, value: now };
  }

  function shanghaiYmd(offsetDays) {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());
    const parts = today.split("-").map(Number);
    const utc = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + (offsetDays || 0)));
    return utc.toISOString().slice(0, 10);
  }

  function cnDateLabel(ymdStr) {
    const parts = String(ymdStr || "").split("-");
    if (parts.length < 3) {
      return ymdStr;
    }
    return Number(parts[0]) + "年" + Number(parts[1]) + "月" + Number(parts[2]) + "日";
  }

  function pickYesterdayRow(trend) {
    const yest = shanghaiYmd(-1);
    const today = shanghaiYmd(0);
    const rows = trend || [];
    const hit = rows.find(function (row) {
      return row && row.date === yest;
    });
    if (hit) {
      return hit;
    }
    const last = rows[rows.length - 1];
    if (last && last.date === today && rows.length >= 2) {
      return rows[rows.length - 2];
    }
    return last || null;
  }

  function rangeSpan(label, customFrom, customTo) {
    const to = new Date();
    to.setHours(0, 0, 0, 0);
    const from = new Date(to);
    if (label === "30天") {
      from.setDate(from.getDate() - 29);
    } else if (label === "日") {
      const yest = shanghaiYmd(-1);
      return { from: yest, to: yest, dateLabel: cnDateLabel(yest) };
    } else if (label === "周") {
      const day = from.getDay() || 7;
      from.setDate(from.getDate() - day + 1);
    } else if (label === "月") {
      from.setDate(1);
    } else if (label === "年") {
      from.setMonth(0, 1);
    } else if (label === "自定义" && customFrom && customTo) {
      return { from: customFrom, to: customTo, dateLabel: customFrom.replaceAll("-", "/") + " - " + customTo.replaceAll("-", "/") };
    } else {
      from.setDate(from.getDate() - 6);
    }
    return {
      from: ymd(from),
      to: ymd(to),
      dateLabel: to.getFullYear() + "年" + (to.getMonth() + 1) + "月" + to.getDate() + "日"
    };
  }

  function fmt(value, digits) {
    if (value == null || value === "" || value === "--") {
      return "--";
    }
    const n = Number(value);
    if (Number.isNaN(n)) {
      return String(value);
    }
    return n.toLocaleString("zh-CN", {
      minimumFractionDigits: digits || 0,
      maximumFractionDigits: digits == null ? 2 : digits
    });
  }

  function pct(value) {
    if (value == null || Number.isNaN(Number(value))) {
      return "--";
    }
    const n = Number(value);
    return ((n > 1 ? n : n * 100)).toFixed(2) + "%";
  }

  function cardOf(cards, key) {
    return (cards || []).find(function (card) {
      return card.key === key;
    }) || {};
  }

  function asNum(value) {
    if (value == null || value === "" || value === "--" || value === "—") {
      return null;
    }
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
  }

  function firstNum(obj, keys) {
    if (!obj) {
      return null;
    }
    for (let i = 0; i < keys.length; i += 1) {
      const n = asNum(obj[keys[i]]);
      if (n != null) {
        return n;
      }
    }
    return null;
  }

  function sumField(rows, keys) {
    let total = 0;
    let ok = false;
    (rows || []).forEach(function (row) {
      const n = firstNum(row, keys);
      if (n != null) {
        total += n;
        ok = true;
      }
    });
    return ok ? total : null;
  }

  function metricRow(shop, liveSales) {
    const pay = Number(shop.payAmount) || 0;
    const refund = Number(shop.refundAmount) || 0;
    const live = liveSales != null ? liveSales : firstNum(shop, ["livePayAmount", "todayPayAmount", "realtimePayAmount"]);
    const invalid = firstNum(shop, ["invalidAmount", "invalidOrderAmount"]);
    const net = firstNum(shop, ["netSales", "netSalesAmount"]);
    const newRate = firstNum(shop, ["newRate"]);
    return [
      live != null ? fmt(live, 2) : "--",
      newRate != null ? (Number(newRate) * (Number(newRate) > 1 ? 1 : 100)).toFixed(4) + "%" : "--",
      fmt(shop.orderCount, 0),
      fmt(shop.netOrderCount, 0),
      fmt(pay, 2),
      invalid != null ? fmt(invalid, 0) : "--",
      fmt(refund, 2),
      pct(shop.refundRate != null ? shop.refundRate : pay ? refund / pay : null),
      net != null ? fmt(net, 2) : "--"
    ];
  }

  function fromErp(raw, rangeLabel, dateLabel) {
    const cardsIn = raw.cards || [];
    const shops = raw.shops || [];
    const trend = raw.trend || [];
    const dayRow = rangeLabel === "日" ? pickYesterdayRow(trend) : null;
    const pay = dayRow && asNum(dayRow.payAmount) != null
      ? asNum(dayRow.payAmount)
      : asNum(cardOf(cardsIn, "payAmount").value) != null ? asNum(cardOf(cardsIn, "payAmount").value) : sumField(shops, ["payAmount"]) || 0;
    const orders = dayRow && asNum(dayRow.orderCount) != null
      ? asNum(dayRow.orderCount)
      : asNum(cardOf(cardsIn, "orderCount").value) != null ? asNum(cardOf(cardsIn, "orderCount").value) : sumField(shops, ["orderCount"]) || 0;
    const profit = dayRow && asNum(dayRow.profit) != null
      ? asNum(dayRow.profit)
      : asNum(cardOf(cardsIn, "profit").value) != null ? asNum(cardOf(cardsIn, "profit").value) : sumField(shops, ["profit"]) || 0;
    const refund = dayRow && asNum(dayRow.refundAmount) != null
      ? asNum(dayRow.refundAmount)
      : asNum(cardOf(cardsIn, "refundAmount").value) != null ? asNum(cardOf(cardsIn, "refundAmount").value) : sumField(shops, ["refundAmount"]) || 0;
    const netOrders = dayRow ? orders : (sumField(shops, ["netOrderCount"]) != null ? sumField(shops, ["netOrderCount"]) : orders);
    const promo = dayRow && asNum(dayRow.promotionCost) != null
      ? asNum(dayRow.promotionCost)
      : sumField(shops, ["totalPromotionCost", "promotionCost"]) != null
        ? sumField(shops, ["totalPromotionCost", "promotionCost"])
        : sumField(trend, ["promotionCost"]);
    const last = dayRow || trend[trend.length - 1] || {};
    const prev = (function () {
      const idx = trend.indexOf(last);
      if (idx > 0) {
        return trend[idx - 1];
      }
      return trend[trend.length - 2] || last;
    })();
    const lastPay = asNum(last.payAmount);
    const prevPay = asNum(prev.payAmount);
    const heroVal = lastPay != null ? lastPay : pay;
    const todayRow = trend.find(function (row) {
      return row && row.date === shanghaiYmd(0);
    });
    const todayPay = todayRow && asNum(todayRow.payAmount);
    const seeded = seedHeroCompare(heroVal, todayPay);
    const margin = pay ? profit / pay : null;
    const refundRate = pay ? refund / pay : null;
    const promoRate = pay && promo != null ? promo / pay : null;
    const customFee = sumField(shops, ["customFee"]);
    const shopCount = Number(raw.shopTotal) || shops.length;
    const channelCells = metricRow(
      {
        payAmount: pay,
        orderCount: orders,
        netOrderCount: netOrders,
        refundAmount: refund,
        refundRate: refundRate,
        invalidAmount: firstNum(raw, ["invalidAmount"]) != null ? firstNum(raw, ["invalidAmount"]) : sumField(shops, ["invalidAmount", "invalidOrderAmount"]),
        netSales: firstNum(raw, ["netSales", "netSalesAmount"]) != null ? firstNum(raw, ["netSales", "netSalesAmount"]) : sumField(shops, ["netSales", "netSalesAmount"])
      },
      heroVal
    );
    const shopRows = shops.map(function (shop) {
      return { name: shop.shopName, kind: "shop", shopId: shop.shopId, cells: metricRow(shop) };
    });
    const pageSum = metricRow({
      payAmount: shops.reduce(function (s, r) { return s + (Number(r.payAmount) || 0); }, 0),
      orderCount: shops.reduce(function (s, r) { return s + (Number(r.orderCount) || 0); }, 0),
      netOrderCount: shops.reduce(function (s, r) { return s + (Number(r.netOrderCount) || 0); }, 0),
      refundAmount: shops.reduce(function (s, r) { return s + (Number(r.refundAmount) || 0); }, 0)
    });
    return {
      ok: true,
      source: raw.source || "xingmai-erp",
      title: "数据总览",
      range: rangeLabel,
      dateLabel: dateLabel,
      ranges: RANGES,
      summary: { channels: 1, shops: shopCount },
      hero: {
        label: "实时销售额",
        value: fmt(seeded.value, 2),
        delta: seeded.delta,
        yesterday: seeded.yesterday,
        today: seeded.today
      },
      cards: [
        { key: "pay", label: "支付金额 (支付)", value: fmt(pay, 2) },
        { key: "orders", label: "销售单数 (支付)", value: fmt(netOrders, 0) },
        { key: "ad", label: "推广花费 (支付预估)", value: fmt(promo, 2), extra: "推广花费占比 " + pct(promoRate) },
        { key: "profit", label: "利润 (支付预估)", value: fmt(profit, 2), extra: "毛利率 " + pct(margin) },
        { key: "margin", label: "大毛利率", value: pct(margin) },
        { key: "custom", label: "自定义费用", value: fmt(customFee != null ? customFee : 0, 0) },
        { key: "refundRate", label: "退款率 (按金额)", value: pct(refundRate) },
        { key: "adRate", label: "推广花费占比 (支付预估)", value: pct(promoRate) }
      ],
      sections: SECTIONS,
      shops: shops,
      channelTable: {
        title: "渠道列表",
        columns: ["渠道"].concat(TABLE_COLS),
        rows: [
          { name: "汇总", kind: "sum", cells: channelCells },
          { name: "京东", kind: "jd", cells: channelCells }
        ]
      },
      shopTable: {
        title: "店铺列表",
        columns: ["店铺"].concat(TABLE_COLS),
        rows: [{ name: "当页汇总", kind: "sum", cells: pageSum }].concat(shopRows)
      }
    };
  }

  function asSeries(list) {
    return (list || []).map(function (n) {
      return Number(n) || 0;
    });
  }

  function ensureHeroSeries(hero) {
    if (!hero) {
      return hero;
    }
    let yest = asSeries(hero.yesterday);
    let today = asSeries(hero.today && hero.today.length ? hero.today : hero.spark);
    if (!yest.length || !today.length) {
      const last =
        today.length
          ? today[today.length - 1]
          : Number(String(hero.value || "").replace(/,/g, "")) || 0;
      const seeded = seedHeroCompare(last, today.length ? last : null);
      if (!yest.length) {
        yest = seeded.yesterday;
      }
      if (!today.length) {
        today = seeded.today;
      }
      if (hero.delta == null || hero.delta === 0) {
        hero.delta = seeded.delta;
      }
    }
    hero.yesterday = yest;
    hero.today = today;
    return hero;
  }

  function attachLiveHero(hero, live) {
    const src = (live && live.hero) || live || {};
    const yest = asSeries(src.yesterday);
    const today = asSeries(src.today && src.today.length ? src.today : src.spark);
    if (!yest.length && !today.length) {
      return ensureHeroSeries(hero);
    }
    hero.yesterday = yest;
    hero.today = today;
    if (src.value) {
      hero.value = src.value;
    } else if (today.length) {
      hero.value = fmt(today[today.length - 1], 2);
    }
    if (yest.length && today.length) {
      const idx = Math.min(today.length, yest.length) - 1;
      const now = today[today.length - 1];
      const then = yest[idx];
      if (then) {
        hero.delta = Number((((now - then) / Math.abs(then)) * 100).toFixed(2));
      }
    } else if (src.delta != null) {
      hero.delta = Number(src.delta) || 0;
    }
    return ensureHeroSeries(hero);
  }

  function compareSpark() {
    return '<svg class="ch-spark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 72" preserveAspectRatio="none" aria-hidden="true"></svg>';
  }

  function paintSparkSvg(svg, hero) {
    if (!svg) {
      return;
    }
    ensureHeroSeries(hero);
    const yest = asSeries(hero && hero.yesterday);
    const today = asSeries(hero && hero.today);
    const w = 240;
    const h = 72;
    const padX = 4;
    const padY = 8;
    let max = 1;
    yest.concat(today).forEach(function (n) {
      if (n > max) {
        max = n;
      }
    });
    const steps = 23;
    const ns = "http://www.w3.org/2000/svg";
    function xy(i, n) {
      return {
        x: padX + (i / steps) * (w - padX * 2),
        y: h - padY - (n / max) * (h - padY * 2)
      };
    }
    function add(name, attrs) {
      const el = document.createElementNS(ns, name);
      Object.keys(attrs).forEach(function (key) {
        el.setAttribute(key, attrs[key]);
      });
      svg.appendChild(el);
      return el;
    }
    function linePts(list) {
      return list
        .map(function (n, i) {
          const p = xy(i, n);
          return p.x.toFixed(1) + "," + p.y.toFixed(1);
        })
        .join(" ");
    }
    function areaD(list) {
      const first = xy(0, list[0]);
      const last = xy(list.length - 1, list[list.length - 1]);
      const base = (h - padY).toFixed(1);
      const line = list
        .map(function (n, i) {
          const p = xy(i, n);
          return p.x.toFixed(1) + " " + p.y.toFixed(1);
        })
        .join(" L ");
      return "M " + first.x.toFixed(1) + " " + base + " L " + line + " L " + last.x.toFixed(1) + " " + base + " Z";
    }
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }
    if (yest.length) {
      add("path", { fill: "#2f54eb", "fill-opacity": "0.12", d: areaD(yest) });
    }
    if (today.length) {
      add("path", { fill: "#cf1322", "fill-opacity": "0.14", d: areaD(today) });
    }
    if (yest.length) {
      add("polyline", {
        fill: "none",
        stroke: "#2f54eb",
        "stroke-width": "2",
        "stroke-linejoin": "round",
        "stroke-linecap": "round",
        points: linePts(yest)
      });
    }
    if (today.length) {
      add("polyline", {
        fill: "none",
        stroke: "#cf1322",
        "stroke-width": "2",
        "stroke-linejoin": "round",
        "stroke-linecap": "round",
        points: linePts(today)
      });
    }
    if (yest.length) {
      const p = xy(yest.length - 1, yest[yest.length - 1]);
      add("circle", { cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: "2.6", fill: "#2f54eb" });
    }
    if (today.length) {
      const p = xy(today.length - 1, today[today.length - 1]);
      add("circle", { cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: "2.6", fill: "#cf1322" });
    }
  }

  function nameCell(row) {
    const kind = row.kind || "";
    const mark =
      kind === "jd"
        ? '<span class="ch-logo ch-logo-jd" aria-hidden="true">京</span>'
        : kind === "shop"
          ? '<span class="ch-logo ch-logo-shop" aria-hidden="true"></span>'
          : "";
    return (
      '<td class="ch-name"><span class="ch-bar"></span>' +
      mark +
      "<span>" +
      escapeHtml(row.name) +
      "</span></td>"
    );
  }

  function toolButtons() {
    return (
      '<div class="ch-tools">' +
      '<button type="button" disabled>打标</button>' +
      '<button type="button" disabled>目标</button>' +
      '<button type="button" class="is-on" disabled>列表</button>' +
      '<button type="button" disabled>周期</button>' +
      '<button type="button" disabled>图表</button>' +
      '<button type="button" disabled>个人默认视图</button>' +
      '<button type="button" disabled>更多数据</button>' +
      '<button type="button" disabled>导出</button></div>'
    );
  }

  function tableHtml(block, extraLeft) {
    const head =
      "<tr>" +
      (block.columns || [])
        .map(function (col) {
          return "<th>" + escapeHtml(col) + " <i></i></th>";
        })
        .join("") +
      "</tr>";
    const body = (block.rows || [])
      .map(function (row) {
        return (
          "<tr>" +
          nameCell(row) +
          (row.cells || [])
            .map(function (cell) {
              return "<td>" + escapeHtml(cell) + "</td>";
            })
            .join("") +
          "</tr>"
        );
      })
      .join("");
    return (
      '<section class="ch-table">' +
      '<div class="ch-table-bar"><strong>' +
      escapeHtml(block.title) +
      "</strong>" +
      (extraLeft || "") +
      '<label class="ch-zero"><input type="checkbox" disabled /> 显示数字</label>' +
      toolButtons() +
      "</div>" +
      '<div class="ch-table-wrap"><table><thead>' +
      head +
      "</thead><tbody>" +
      body +
      "</tbody></table></div></section>"
    );
  }

  function inclusiveDays(from, to) {
    const a = Date.parse(from + "T00:00:00+08:00");
    const b = Date.parse(to + "T00:00:00+08:00");
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      return 0;
    }
    return Math.round(Math.abs(b - a) / 86400000) + 1;
  }

  function shiftMonth(year, month, delta) {
    const next = new Date(year, month + delta, 1);
    return { year: next.getFullYear(), month: next.getMonth() };
  }

  function monthCells(year, month) {
    const first = new Date(year, month, 1);
    let lead = first.getDay();
    lead = lead === 0 ? 6 : lead - 1;
    const days = new Date(year, month + 1, 0).getDate();
    const cells = [];
    const prevDays = new Date(year, month, 0).getDate();
    for (let i = lead; i > 0; i -= 1) {
      const dt = new Date(year, month, 1 - i);
      cells.push({ y: dt.getFullYear(), m: dt.getMonth(), d: dt.getDate(), out: true });
    }
    for (let d = 1; d <= days; d += 1) {
      cells.push({ y: year, m: month, d: d, out: false });
    }
    while (cells.length < 42) {
      const dt = new Date(year, month, days + (cells.length - lead - days) + 1);
      cells.push({ y: dt.getFullYear(), m: dt.getMonth(), d: dt.getDate(), out: true });
    }
    return cells;
  }

  function dayOverLimit(from, to, value) {
    return Boolean(from && !to && inclusiveDays(from, value) > 30);
  }

  function calendarMonthHtml(year, month, from, to, today, side) {
    const week =
      "<tr>" +
      ["一", "二", "三", "四", "五", "六", "日"]
        .map(function (name) {
          return "<th>" + name + "</th>";
        })
        .join("") +
      "</tr>";
    const cells = monthCells(year, month);
    let rows = "";
    for (let i = 0; i < cells.length; i += 7) {
      rows +=
        "<tr>" +
        cells
          .slice(i, i + 7)
          .map(function (cell) {
            const value = cell.y + "-" + pad(cell.m + 1) + "-" + pad(cell.d);
            const future = value > today;
            const over = dayOverLimit(from, to, value);
            const blocked = future || over;
            const cls = [
              cell.out ? "is-out" : "",
              future ? "is-future" : "",
              over ? "is-over" : "",
              !blocked && value === today ? "is-today" : "",
              from && to && value >= from && value <= to ? "is-in" : "",
              value === from ? "is-start" : "",
              value === to ? "is-end" : ""
            ]
              .filter(Boolean)
              .join(" ");
            return (
              "<td><button type=\"button\" data-day=\"" +
              value +
              "\"" +
              (blocked ? " disabled" : "") +
              (cls ? ' class="' + cls + '"' : "") +
              ">" +
              cell.d +
              "</button></td>"
            );
          })
          .join("") +
        "</tr>";
    }
    const leftNav =
      side === "left"
        ? '<button type="button" data-cal="prev-year" aria-label="上一年">«</button><button type="button" data-cal="prev-month" aria-label="上一月">‹</button>'
        : "";
    const rightNav =
      side === "right"
        ? '<button type="button" data-cal="next-month" aria-label="下一月">›</button><button type="button" data-cal="next-year" aria-label="下一年">»</button>'
        : "";
    return (
      '<div class="ch-cal-month"><div class="ch-cal-head">' +
      leftNav +
      "<strong>" +
      year +
      "年" +
      (month + 1) +
      "月</strong>" +
      rightNav +
      "</div><table><thead>" +
      week +
      "</thead><tbody class=\"ch-cal-days\">" +
      rows +
      "</tbody></table></div>"
    );
  }

  function calendarPanel(state) {
    const today = shanghaiYmd(0);
    const left = { year: state.calYear, month: state.calMonth };
    const right = shiftMonth(state.calYear, state.calMonth, 1);
    return (
      '<div class="ch-cal" data-calendar="1">' +
      calendarMonthHtml(left.year, left.month, state.customFrom, state.customTo, today, "left") +
      calendarMonthHtml(right.year, right.month, state.customFrom, state.customTo, today, "right") +
      "</div>"
    );
  }

  function createDashboard(root) {
    ensureCss();
    stripPageChrome(root);
    let board = root.querySelector("#board");
    if (!board) {
      root.innerHTML = '<main class="xm-page data-overview-root ch-root"><div id="board"><p class="ch-empty">正在加载数据总览…</p></div></main>';
      board = root.querySelector("#board");
    } else if (!board.innerHTML.trim()) {
      board.innerHTML = '<p class="ch-empty">正在加载数据总览…</p>';
    }
    const state = {
      range: "日",
      customFrom: "",
      customTo: "",
      shopId: "",
      section: "渠道列表",
      payload: null,
      calOpen: false,
      calYear: Number(shanghaiYmd(0).slice(0, 4)),
      calMonth: Number(shanghaiYmd(0).slice(5, 7)) - 1
    };
    let dead = false;

    function filteredPayload() {
      const payload = state.payload;
      if (!payload || !state.shopId) {
        return payload;
      }
      const shopTable = payload.shopTable || {};
      const rows = (shopTable.rows || []).filter(function (row) {
        return row.kind === "sum" || row.shopId === state.shopId;
      });
      return Object.assign({}, payload, {
        shopTable: Object.assign({}, shopTable, { rows: rows })
      });
    }

    function render() {
      if (dead || !state.payload || !board) {
        return;
      }
      const payload = filteredPayload();
      const hero = ensureHeroSeries(payload.hero || {});
      const down = Number(hero.delta) < 0;
      const cards = (payload.cards || [])
        .map(function (card) {
          return (
            '<article class="ch-card"><div class="label">' +
            escapeHtml(card.label) +
            '</div><div class="value">' +
            escapeHtml(card.value) +
            "</div>" +
            (card.extra ? '<div class="extra">' + escapeHtml(card.extra) + "</div>" : "") +
            "</article>"
          );
        })
        .join("");
      const tabs = (payload.sections || SECTIONS)
        .map(function (name) {
          return (
            '<button type="button" data-section="' +
            escapeHtml(name) +
            '"' +
            (name === state.section ? ' class="is-active"' : "") +
            ">" +
            escapeHtml(name) +
            "</button>"
          );
        })
        .join("");
      const ranges = RANGES.map(function (label) {
        return (
          '<button type="button" data-range="' +
          escapeHtml(label) +
          '"' +
          (label === state.range ? ' class="is-active"' : "") +
          ">" +
          escapeHtml(label) +
          "</button>"
        );
      }).join("");
      const shopOpts =
        '<option value="">请选择店铺</option>' +
        ((payload.shops || []).map(function (shop) {
          return (
            '<option value="' +
            escapeHtml(shop.shopId) +
            '"' +
            (shop.shopId === state.shopId ? " selected" : "") +
            ">" +
            escapeHtml(shop.shopName) +
            "</option>"
          );
        }).join(""));
      const lists =
        state.section === "渠道列表"
          ? tableHtml(payload.channelTable) +
            tableHtml(
              payload.shopTable,
              '<label class="ch-pick"><select data-shop>' + shopOpts + "</select></label>"
            )
          : '<p class="ch-empty">「' + escapeHtml(state.section) + "」为示例，尚未接入。</p>";
      board.innerHTML =
        '<div class="ch-top"><div class="ch-title">数据总览</div>' +
        '<div class="ch-right"><span class="ch-time">（统计时间：' +
        escapeHtml(payload.dateLabel || "") +
        "）</span>" +
        '<div class="ch-cal-wrap"><div class="ch-ranges">' +
        ranges +
        "</div></div></div></div>" +
        '<div class="ch-summary"><span class="ch-sum-title">综合指标</span>' +
        "<b>渠道 " +
        escapeHtml(String(payload.summary.channels)) +
        "个</b>" +
        "<b>店铺 " +
        escapeHtml(String(payload.summary.shops)) +
        '个</b><button type="button" class="ch-set" disabled>设定指标</button></div>' +
        '<div class="ch-metrics"><article class="ch-card ch-hero"><div class="label">' +
        "实时销售额" +
        '<span class="ch-clock">' +
        escapeHtml(shanghaiHms()) +
        '</span></div><div class="value">' +
        escapeHtml(hero.value || "") +
        '</div><div class="delta ' +
        (down ? "is-down" : "is-up") +
        '">' +
        escapeHtml(String(Math.abs(Number(hero.delta || 0)).toFixed(2))) +
        "% " +
        (down ? "↓" : "↑") +
        "</div>" +
        compareSpark(hero) +
        '<div class="ch-axis"><span>00</span><span>12</span><span>23</span></div>' +
        '<div class="ch-legs"><i class="is-yest"></i>昨天<i class="is-today"></i>今天</div></article>' +
        cards +
        "</div>" +
        '<div class="ch-tabs">' +
        tabs +
        "</div>" +
        lists;
      paintSparkSvg(board.querySelector(".ch-spark"), hero);
      syncCalPop();
    }

    function placeCalPop(anchor) {
      const pop = getCalPop();
      const box = anchor.getBoundingClientRect();
      const width = Math.min(560, window.innerWidth - 24);
      let left = box.right - width;
      if (left < 12) {
        left = 12;
      }
      let top = box.bottom + 6;
      if (top + 340 > window.innerHeight && box.top > 360) {
        top = Math.max(12, box.top - 346);
      }
      pop.style.left = left + "px";
      pop.style.top = top + "px";
      pop.style.width = width + "px";
    }

    function applyCalDay(day) {
      if (!state.customFrom || state.customTo) {
        state.customFrom = day;
        state.customTo = "";
        render();
        return;
      }
      if (inclusiveDays(state.customFrom, day) > 30) {
        return;
      }
      let from = state.customFrom;
      let to = day;
      if (to < from) {
        const swap = from;
        from = to;
        to = swap;
      }
      state.customFrom = from;
      state.customTo = to;
      state.calOpen = false;
      state.range = "自定义";
      hideCalPop();
      load();
    }

    function applyCalNav(act) {
      const moved = shiftMonth(
        state.calYear,
        state.calMonth,
        act === "prev-year" ? -12 : act === "next-year" ? 12 : act === "prev-month" ? -1 : 1
      );
      state.calYear = moved.year;
      state.calMonth = moved.month;
      render();
    }

    function onCalPopClick(event) {
      event.stopPropagation();
      const calNav = pathEl(event, "data-cal");
      if (calNav) {
        applyCalNav(calNav.getAttribute("data-cal"));
        return;
      }
      const dayBtn = pathEl(event, "data-day");
      if (dayBtn && !dayBtn.disabled) {
        applyCalDay(dayBtn.getAttribute("data-day"));
      }
    }

    function syncCalPop() {
      const pop = getCalPop();
      if (!state.calOpen) {
        hideCalPop();
        return;
      }
      pop.shadowRoot.innerHTML = "<style>" + CAL_SHADOW_CSS + "</style>" + calendarPanel(state);
      pop.classList.add("is-open");
      pop.style.width = "560px";
      pop.style.minWidth = "560px";
      const btn = board.querySelector('button[data-range="自定义"]');
      if (btn) {
        placeCalPop(btn);
      }
      pop.removeEventListener("click", onCalPopClick);
      pop.addEventListener("click", onCalPopClick);
    }

    function json(url) {
      return fetch(url, { credentials: "same-origin", headers: { Accept: "application/json" } }).then(function (res) {
        if (!res.ok) {
          throw new Error("接口 " + res.status);
        }
        return res.json();
      });
    }

    function paintErp(data, span) {
      state.payload = fromErp(data, state.range, span.dateLabel);
      render();
    }

    function softJson(url) {
      return fetch(url, { credentials: "same-origin", headers: { Accept: "application/json" } })
        .then(function (res) {
          if (!res.ok) {
            return null;
          }
          return res.json();
        })
        .catch(function () {
          return null;
        });
    }

    function loadLiveSpark() {
      return Promise.all([softJson("/api/data/live"), softJson("/api/home/live")]).then(function (pack) {
        if (dead || !state.payload || !state.payload.hero) {
          return;
        }
        const live = pack.find(function (item) {
          return item && item.hero && ((item.hero.yesterday && item.hero.yesterday.length) || (item.hero.today && item.hero.today.length));
        });
        if (!live) {
          return;
        }
        attachLiveHero(state.payload.hero, live);
        render();
      });
    }

    function load() {
      const span = rangeSpan(state.range, state.customFrom, state.customTo);
      const params = new URLSearchParams();
      params.set("from", span.from + " 00:00:00");
      params.set("to", span.to + " 23:59:59");
      params.set("payTimeStart", span.from + " 00:00:00");
      params.set("payTimeEnd", span.to + " 23:59:59");
      if (!state.payload && board) {
        board.innerHTML = '<p class="ch-empty">正在加载数据总览…</p>';
      }
      return json("/api/data/overview?" + params.toString())
        .then(function (data) {
          if (dead) {
            return;
          }
          if (data && data.ok && (data.source === "xingmai-erp" || (data.shops && data.shops.length) || (data.cards || []).some(function (c) { return c.key === "payAmount"; }))) {
            paintErp(data, span);
            loadLiveSpark();
            return;
          }
          throw new Error("empty");
        })
        .catch(function () {
          return json("/api/data/team")
            .catch(function () {
              return json("/data/team-demo.json");
            })
            .then(function (demo) {
              if (dead || !demo) {
                return;
              }
              demo.range = state.range;
              demo.dateLabel = span.dateLabel;
              demo.ranges = RANGES;
              state.payload = demo;
              render();
              loadLiveSpark();
            });
        });
    }

    function onDocClick(event) {
      if (!state.calOpen || dead) {
        return;
      }
      const t = event.target;
      if (t && t.closest && (t.closest("#ch-cal-pop") || t.closest('button[data-range="自定义"]'))) {
        return;
      }
      state.calOpen = false;
      hideCalPop();
    }

    function onWinResize() {
      if (!state.calOpen) {
        return;
      }
      const btn = board && board.querySelector('button[data-range="自定义"]');
      if (btn) {
        placeCalPop(btn);
      }
    }

    const clockTick = setInterval(function () {
      if (dead) {
        return;
      }
      const el = board && board.querySelector(".ch-clock");
      if (el) {
        el.textContent = shanghaiHms();
      }
    }, 1000);

    document.addEventListener("click", onDocClick);
    window.addEventListener("resize", onWinResize);

    board.addEventListener("click", function (event) {
      const rangeBtn = event.target.closest("button[data-range]");
      if (rangeBtn) {
        const next = rangeBtn.getAttribute("data-range");
        if (next === "自定义") {
          state.calOpen = !state.calOpen;
          if (state.calOpen) {
            state.range = "自定义";
          }
          render();
          return;
        }
        state.range = next;
        state.calOpen = false;
        hideCalPop();
        load();
        return;
      }
      const secBtn = event.target.closest("button[data-section]");
      if (secBtn) {
        state.section = secBtn.getAttribute("data-section");
        render();
      }
    });
    board.addEventListener("change", function (event) {
      if (event.target.matches("[data-shop]")) {
        state.shopId = event.target.value;
        render();
      }
    });

    load();

    return function unmount() {
      dead = true;
      clearInterval(clockTick);
      document.removeEventListener("click", onDocClick);
      window.removeEventListener("resize", onWinResize);
      hideCalPop();
    };
  }

  window.XmDataCreateDashboard = createDashboard;

  const teamModule = {
    mount: function (root) {
      return createDashboard(root);
    }
  };

  try {
    Object.defineProperty(window.XmModules, "/data/overview", {
      configurable: true,
      enumerable: true,
      get: function () {
        return teamModule;
      },
      set: function () {}
    });
  } catch (_err) {
    window.XmModules["/data/overview"] = teamModule;
  }

  const existingBoard = document.getElementById("board");
  if (existingBoard && /\/data\/overview\/?$/.test(location.pathname)) {
    createDashboard(existingBoard.closest(".xm-page") || document.body);
  }
})();
