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
  var KPI_CARDS = [
    { key: "payAmount", label: "支付金额 (支付)", kind: "money", fields: ["payAmount"], accent: true },
    { key: "adCost", label: "推广花费 (支付预估)", kind: "money", fields: ["totalPromotionCost", "promotionCost", "adCost"] },
    { key: "refundAmount", label: "退款金额", kind: "money", fields: ["refundAmount"] },
    { key: "adRate", label: "推广花费 (支付预估) 占比", kind: "rate", fields: ["promotionRate"] },
    { key: "refundRate", label: "退款率 (按金额)", kind: "rate", fields: ["refundRate"] },
    { key: "profit", label: "利润 (支付预估)", kind: "money", fields: ["profit"] },
    { key: "orderCount", label: "销售单数 (支付)", kind: "int", fields: ["orderCount"] },
    { key: "grossMargin", label: "大毛利率", kind: "rate", fields: ["profitRate"] },
    { key: "platformFee", label: "平台花费 (支付预估)", kind: "money", fields: ["platformFee", "platformCost"] },
    { key: "saleFee", label: "销售费用 (支付预估)", kind: "money", fields: ["saleFee", "salesFee"] },
    { key: "goodsCost", label: "总货款成本", kind: "money", fields: ["goodsCost", "totalGoodsCost"] },
    { key: "invalidAmount", label: "无效单金额", kind: "money", fields: ["invalidAmount", "invalidOrderAmount"] },
    { key: "netSales", label: "净销售额 (支付)", kind: "money", fields: ["netSales", "netSalesAmount"] },
    { key: "jdOrders", label: "京仓订单数量", kind: "int", fields: ["jdWarehouseOrderCount", "jingCangOrderCount", "jdOrders"] },
    { key: "jdRate", label: "京仓订单占比", kind: "rate", fields: ["jdWarehouseRate", "jdRatio"] },
    { key: "netQty", label: "净销售件数 (支付)", kind: "int", fields: ["netSkuNum", "netSalesQty"] },
    { key: "netGoodsCost", label: "净货款成本 (支付)", kind: "money", fields: ["netGoodsCost"] }
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
      link.href = "/data-pages.css?v=kpi17";
      document.head.appendChild(link);
    }
  }

  function stripPageChrome(root) {
    Array.prototype.forEach.call(root.querySelectorAll(".kicker, .data-subnav, .page-head"), function (el) {
      el.remove();
    });
    Array.prototype.forEach.call(root.querySelectorAll("h1"), function (el) {
      if (/数据总揽|渠道总览/.test(el.textContent.trim())) {
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

  function rangeSpan(label, customFrom, customTo) {
    const to = new Date();
    to.setHours(0, 0, 0, 0);
    const from = new Date(to);
    if (label === "30天") {
      from.setDate(from.getDate() - 29);
    } else if (label === "日") {
      from.setDate(from.getDate() - 1);
      to.setTime(from.getTime());
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
    return { from: ymd(from), to: ymd(to), dateLabel: slashDate(to) };
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

  function kpiValue(kind, n) {
    if (n == null) {
      return "—";
    }
    if (kind === "money") {
      return fmt(n, 2);
    }
    if (kind === "int") {
      return fmt(n, 0);
    }
    return pct(n);
  }

  function buildKpiCards(totals) {
    return KPI_CARDS.map(function (def) {
      return {
        key: def.key,
        label: def.label,
        value: kpiValue(def.kind, firstNum(totals, [def.key].concat(def.fields))),
        accent: !!def.accent
      };
    });
  }

  function metricRow(shop) {
    const pay = Number(shop.payAmount) || 0;
    const refund = Number(shop.refundAmount) || 0;
    return [
      fmt(pay, 2),
      "--",
      fmt(shop.orderCount, 0),
      fmt(shop.netOrderCount, 0),
      fmt(pay, 2),
      "--",
      fmt(refund, 2),
      pct(shop.refundRate != null ? shop.refundRate : pay ? refund / pay : null),
      fmt(pay - refund, 2)
    ];
  }

  function fromErp(raw, rangeLabel, dateLabel) {
    const cardsIn = raw.cards || [];
    const shops = raw.shops || [];
    const trend = raw.trend || [];
    const pay = asNum(cardOf(cardsIn, "payAmount").value) != null ? asNum(cardOf(cardsIn, "payAmount").value) : sumField(shops, ["payAmount"]) || 0;
    const orders = asNum(cardOf(cardsIn, "orderCount").value) != null ? asNum(cardOf(cardsIn, "orderCount").value) : sumField(shops, ["orderCount"]) || 0;
    const profit = asNum(cardOf(cardsIn, "profit").value) != null ? asNum(cardOf(cardsIn, "profit").value) : sumField(shops, ["profit"]) || 0;
    const refund = asNum(cardOf(cardsIn, "refundAmount").value) != null ? asNum(cardOf(cardsIn, "refundAmount").value) : sumField(shops, ["refundAmount"]) || 0;
    const promo = sumField(shops, ["totalPromotionCost", "promotionCost"]) != null
      ? sumField(shops, ["totalPromotionCost", "promotionCost"])
      : sumField(trend, ["promotionCost"]);
    const last = trend[trend.length - 1] || {};
    const prev = trend[trend.length - 2] || last;
    const lastPay = Number(last.payAmount);
    const prevPay = Number(prev.payAmount);
    const heroVal = lastPay || pay;
    const delta = prevPay ? ((lastPay - prevPay) / prevPay) * 100 : 0;
    const margin = pay ? profit / pay : null;
    const refundRate = pay ? refund / pay : null;
    const promoRate = pay && promo != null ? promo / pay : null;
    const kpiTotals = {
      payAmount: pay,
      adCost: promo,
      totalPromotionCost: promo,
      refundAmount: refund,
      adRate: promoRate,
      promotionRate: promoRate,
      refundRate: refundRate,
      profit: profit,
      orderCount: orders,
      grossMargin: margin,
      profitRate: firstNum(shops[0], ["profitRate"]) != null ? (pay ? profit / pay : null) : margin,
      platformFee: sumField(shops, ["platformFee", "platformCost"]),
      saleFee: sumField(shops, ["saleFee", "salesFee"]),
      goodsCost: sumField(shops, ["goodsCost", "totalGoodsCost"]),
      invalidAmount: sumField(shops, ["invalidAmount", "invalidOrderAmount"]),
      netSales: sumField(shops, ["netSales", "netSalesAmount"]) != null ? sumField(shops, ["netSales", "netSalesAmount"]) : (pay != null && refund != null ? pay - refund : null),
      jdOrders: sumField(shops, ["jdWarehouseOrderCount", "jingCangOrderCount", "jdOrders"]),
      jdRate: null,
      netQty: sumField(shops, ["netSkuNum", "netSalesQty"]),
      netGoodsCost: sumField(shops, ["netGoodsCost"])
    };
    if (kpiTotals.jdOrders != null && orders) {
      kpiTotals.jdRate = kpiTotals.jdOrders / orders;
    }
    const shopCount = Number(raw.shopTotal) || shops.length;
    const channelCells = metricRow({
      payAmount: pay,
      orderCount: orders,
      netOrderCount: shops.reduce(function (s, r) { return s + (Number(r.netOrderCount) || 0); }, 0),
      refundAmount: refund,
      refundRate: refundRate
    });
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
      title: "渠道总览",
      range: rangeLabel,
      dateLabel: dateLabel,
      ranges: RANGES,
      summary: { channels: 1, shops: shopCount },
      hero: {
        label: "实时销售指数",
        value: fmt(heroVal, 2),
        delta: Number(delta.toFixed(2)),
        spark: trend.map(function (row) { return Number(row.payAmount) || 0; })
      },
      cards: buildKpiCards(kpiTotals),
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

  function sparkSvg(points) {
    const vals = points && points.length ? points : [20, 24, 22, 30, 28, 36];
    const w = 140;
    const h = 40;
    const min = Math.min.apply(null, vals);
    const max = Math.max.apply(null, vals);
    const span = max - min || 1;
    const d = vals
      .map(function (v, i) {
        const x = (i / (vals.length - 1)) * w;
        const y = h - ((v - min) / span) * (h - 6) - 3;
        return (i === 0 ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1);
      })
      .join(" ");
    return (
      '<svg class="ch-spark" viewBox="0 0 ' +
      w +
      " " +
      h +
      '" preserveAspectRatio="none" aria-hidden="true"><path d="' +
      d +
      '" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>'
    );
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

  function createDashboard(root) {
    ensureCss();
    stripPageChrome(root);
    let board = root.querySelector("#board");
    if (!board) {
      root.innerHTML = '<main class="xm-page data-overview-root ch-root"><div id="board"></div></main>';
      board = root.querySelector("#board");
    }
    const state = {
      range: "7天",
      customFrom: "",
      customTo: "",
      shopId: "",
      section: "渠道列表",
      payload: null
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
      const hero = payload.hero || {};
      const down = Number(hero.delta) < 0;
      const cards = (payload.cards || [])
        .map(function (card) {
          return (
            '<article class="ch-card' +
            (card.accent || card.key === "payAmount" ? " is-pay" : "") +
            '"><div class="label">' +
            escapeHtml(card.label) +
            '</div><div class="value">' +
            escapeHtml(card.value) +
            "</div></article>"
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
      const custom =
        state.range === "自定义"
          ? '<label class="ch-pick">从 <input type="date" data-from value="' +
            escapeHtml(state.customFrom) +
            '" /></label><label class="ch-pick">至 <input type="date" data-to value="' +
            escapeHtml(state.customTo) +
            '" /></label>'
          : "";
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
        '<div class="ch-top"><div class="ch-title">渠道总览</div>' +
        '<div class="ch-right"><span class="ch-time">（统计时间：' +
        escapeHtml(payload.dateLabel || "") +
        "）</span>" +
        '<div class="ch-ranges">' +
        ranges +
        custom +
        "</div></div></div>" +
        '<div class="ch-summary"><span class="ch-sum-title">综合指标</span>' +
        "<b>渠道 " +
        escapeHtml(String(payload.summary.channels)) +
        "个</b>" +
        "<b>店铺 " +
        escapeHtml(String(payload.summary.shops)) +
        '个</b><button type="button" class="ch-set" disabled>设定指标</button></div>' +
        '<div class="ch-metrics ch-metrics-hero"><article class="ch-card ch-hero"><div class="label">' +
        escapeHtml(hero.label || "实时销售指数") +
        '</div><div class="value">' +
        escapeHtml(hero.value || "") +
        "</div>" +
        sparkSvg(hero.spark) +
        '<div class="ch-axis"><span>00:00</span><span>12:00</span><span>23:00</span></div>' +
        '<div class="delta ' +
        (down ? "is-down" : "is-up") +
        '">' +
        (down ? "↓ " : "↑ ") +
        escapeHtml(String(Math.abs(Number(hero.delta || 0)).toFixed(2))) +
        "%</div></article></div>" +
        '<div class="ch-kpi">' +
        cards +
        "</div>" +
        '<div class="ch-tabs">' +
        tabs +
        "</div>" +
        lists;
    }

    function json(url) {
      return fetch(url, { credentials: "same-origin", headers: { Accept: "application/json" } }).then(function (res) {
        if (!res.ok) {
          throw new Error("接口 " + res.status);
        }
        return res.json();
      });
    }

    function load() {
      const span = rangeSpan(state.range, state.customFrom, state.customTo);
      const params = new URLSearchParams();
      params.set("from", span.from + " 00:00:00");
      params.set("to", span.to + " 23:59:59");
      params.set("payTimeStart", span.from + " 00:00:00");
      params.set("payTimeEnd", span.to + " 23:59:59");
      return json("/api/data/overview?" + params.toString())
        .then(function (data) {
          if (dead) {
            return;
          }
          if (data && data.ok && (data.source === "xingmai-erp" || (data.shops && data.shops.length) || (data.cards || []).some(function (c) { return c.key === "payAmount"; }))) {
            state.payload = fromErp(data, state.range, span.dateLabel);
            render();
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
            });
        });
    }

    board.addEventListener("click", function (event) {
      const rangeBtn = event.target.closest("button[data-range]");
      if (rangeBtn) {
        state.range = rangeBtn.getAttribute("data-range");
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
        return;
      }
      if (event.target.matches("[data-from]")) {
        state.customFrom = event.target.value;
        load();
        return;
      }
      if (event.target.matches("[data-to]")) {
        state.customTo = event.target.value;
        load();
      }
    });

    load();

    return function unmount() {
      dead = true;
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
