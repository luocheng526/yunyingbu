(function () {
  window.XmModules = window.XmModules || {};

  var RANGES = ["7天", "30天", "日", "周", "月", "年", "自定义"];
  var COLUMNS = [
    "店铺",
    "实时销售额 (支付)",
    "店铺上新成功率",
    "销售单数",
    "净销售单数 (支付)",
    "支付金额 (支付)",
    "无效单金额 (标注)",
    "退款金额",
    "退款率 (按金额)",
    "净销售额 (支付)",
    "总营销额",
    "全站营销额",
    "非全站营销额",
    "推广花费占比 (支付预估)",
    "利润 (支付预估)",
    "大毛利率",
    "销售费用 (支付预估)",
    "平台费用 (支付预估)",
    "总货款成本",
    "代发单量",
    "无效单量",
    "总货款成本占比",
    "净货款成本 (支付)",
    "净货款成本占比 (支付)",
    "自定义费用",
    "其他费用",
    "耗材费",
    "耗材费 (发货)",
    "打包费"
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
      link.href = "/data-pages.css?v=shop-wide2";
      document.head.appendChild(link);
    }
  }

  function stripPageChrome(root) {
    Array.prototype.forEach.call(root.querySelectorAll(".kicker, .data-subnav, .page-head"), function (el) {
      el.remove();
    });
    Array.prototype.forEach.call(root.querySelectorAll("h1"), function (el) {
      if (/店铺数据|店铺总览/.test(el.textContent.trim())) {
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
    if (value == null || value === "" || Number.isNaN(Number(value))) {
      return "--";
    }
    const n = Number(value);
    return (n > 1 ? n : n * 100).toFixed(2) + "%";
  }

  function profitCell(value, maxAbs) {
    const n = Number(value) || 0;
    const width = maxAbs ? Math.min(100, (Math.abs(n) / maxAbs) * 100) : 0;
    const sign = n > 0 ? "+" : "";
    return (
      '<span class="sh-profit"><i style="width:' +
      width.toFixed(1) +
      '%"></i><em>' +
      escapeHtml(sign + fmt(n, 2)) +
      "</em></span>"
    );
  }

  function dash() {
    return "--";
  }

  function cellsFromErp(shop, maxProfit) {
    const pay = Number(shop.payAmount) || 0;
    const refund = Number(shop.refundAmount) || 0;
    const profit = Number(shop.profit) || 0;
    return [
      fmt(pay, 2),
      shop.newRate != null ? pct(shop.newRate) : "0.00%",
      fmt(shop.orderCount, 0),
      fmt(shop.netOrderCount, 0),
      fmt(pay, 2),
      dash(),
      fmt(refund, 2),
      pct(shop.refundRate != null ? shop.refundRate : pay ? refund / pay : null),
      fmt(pay - refund, 2),
      shop.totalMarketing != null ? fmt(shop.totalMarketing, 2) : dash(),
      shop.siteMarketing != null ? fmt(shop.siteMarketing, 2) : dash(),
      shop.offsiteMarketing != null ? fmt(shop.offsiteMarketing, 2) : dash(),
      pct(shop.promotionRate),
      { html: profitCell(profit, maxProfit) },
      pct(shop.profitRate != null ? shop.profitRate : pay ? profit / pay : null),
      shop.saleFee != null ? fmt(shop.saleFee, 2) : dash(),
      shop.platformFee != null ? fmt(shop.platformFee, 2) : dash(),
      shop.goodsCost != null ? fmt(shop.goodsCost, 2) : dash(),
      shop.dropshipCount != null ? fmt(shop.dropshipCount, 0) : dash(),
      shop.invalidCount != null ? fmt(shop.invalidCount, 0) : dash(),
      shop.goodsCostRate != null ? pct(shop.goodsCostRate) : dash(),
      shop.netGoodsCost != null ? fmt(shop.netGoodsCost, 2) : dash(),
      shop.netGoodsCostRate != null ? pct(shop.netGoodsCostRate) : dash(),
      shop.customFee != null ? fmt(shop.customFee, 2) : "0",
      shop.otherFee != null ? fmt(shop.otherFee, 2) : dash(),
      shop.materialFee != null ? fmt(shop.materialFee, 2) : dash(),
      shop.shipMaterialFee != null ? fmt(shop.shipMaterialFee, 2) : dash(),
      shop.packFee != null ? fmt(shop.packFee, 2) : dash()
    ];
  }

  function sumShops(shops) {
    return shops.reduce(
      function (acc, shop) {
        acc.payAmount += Number(shop.payAmount) || 0;
        acc.orderCount += Number(shop.orderCount) || 0;
        acc.netOrderCount += Number(shop.netOrderCount) || 0;
        acc.refundAmount += Number(shop.refundAmount) || 0;
        acc.profit += Number(shop.profit) || 0;
        acc.totalPromotionCost += Number(shop.totalPromotionCost) || 0;
        return acc;
      },
      { payAmount: 0, orderCount: 0, netOrderCount: 0, refundAmount: 0, profit: 0, totalPromotionCost: 0 }
    );
  }

  function fromErp(raw) {
    const shops = raw.shops || [];
    const totals = sumShops(shops);
    totals.refundRate = totals.payAmount ? totals.refundAmount / totals.payAmount : 0;
    totals.profitRate = totals.payAmount ? totals.profit / totals.payAmount : 0;
    totals.promotionRate = totals.payAmount ? totals.totalPromotionCost / totals.payAmount : 0;
    const maxProfit = Math.max.apply(
      null,
      shops.map(function (shop) {
        return Math.abs(Number(shop.profit) || 0);
      }).concat([Math.abs(totals.profit), 1])
    );
    return {
      shops: shops,
      rows: [{ name: "当页汇总", kind: "sum", cells: cellsFromErp(totals, maxProfit) }].concat(
        shops.map(function (shop) {
          return {
            name: shop.shopName,
            kind: "shop",
            shopId: shop.shopId,
            color: "#e53935",
            cells: cellsFromErp(shop, maxProfit)
          };
        })
      )
    };
  }

  function padCells(cells) {
    const next = (cells || []).slice();
    while (next.length < COLUMNS.length - 1) {
      next.push("--");
    }
    return next;
  }

  function nameCell(row) {
    const color = row.color || (row.kind === "shop" ? "#e53935" : "");
    const mark =
      row.kind === "shop"
        ? '<span class="ch-logo" style="background:' + escapeHtml(color) + '" aria-hidden="true"></span>'
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

  function cellHtml(cell) {
    if (cell && typeof cell === "object" && cell.html) {
      return "<td>" + cell.html + "</td>";
    }
    return "<td>" + escapeHtml(cell) + "</td>";
  }

  function createShopDashboard(root) {
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
      dateLabel: "",
      rows: [],
      shops: []
    };
    let dead = false;

    function render() {
      if (dead || !board) {
        return;
      }
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
      const head =
        "<tr>" +
        COLUMNS.map(function (col) {
          return "<th>" + escapeHtml(col) + " <i></i></th>";
        }).join("") +
        "</tr>";
      const body = state.rows
        .map(function (row) {
          return "<tr>" + nameCell(row) + padCells(row.cells).map(cellHtml).join("") + "</tr>";
        })
        .join("");
      board.innerHTML =
        '<div class="ch-top"><div class="ch-title">店铺总览</div>' +
        '<div class="ch-right"><span class="ch-time">（统计时间：' +
        escapeHtml(state.dateLabel) +
        "）</span>" +
        '<div class="ch-ranges">' +
        ranges +
        custom +
        "</div></div></div>" +
        '<section class="ch-table ch-table-solo sh-wide">' +
        '<div class="ch-table-bar"><strong>店铺列表</strong>' +
        '<label class="ch-pick"><select disabled><option>请选择标签</option></select></label>' +
        '<label class="ch-zero"><input type="checkbox" disabled /> 显示数字</label>' +
        toolButtons() +
        "</div>" +
        '<div class="ch-table-wrap" data-hscroll>' +
        "<table><thead>" +
        head +
        "</thead><tbody>" +
        body +
        "</tbody></table></div>" +
        '<p class="sh-hint">表格可左右滑动，后面还有营销额、利润、费用和打包费。</p></section>';
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
      state.dateLabel = span.dateLabel;
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
          if (data && data.ok && data.shops && data.shops.length) {
            try {
              const mapped = fromErp(data);
              state.shops = mapped.shops;
              state.rows = mapped.rows;
              render();
              return;
            } catch (_err) {
              throw new Error("empty");
            }
          }
          throw new Error("empty");
        })
        .catch(function () {
          return json("/api/data/shops")
            .catch(function () {
              return json("/data/shops-demo.json");
            })
            .then(function (demo) {
              if (dead || !demo) {
                return;
              }
              state.dateLabel = demo.dateLabel || span.dateLabel;
              state.rows = ((demo.shopTable && demo.shopTable.rows) || []).map(function (row) {
                return { name: row.name, kind: row.kind, color: row.color, cells: padCells(row.cells) };
              });
              render();
            });
        });
    }

    board.addEventListener("click", function (event) {
      const rangeBtn = event.target.closest("button[data-range]");
      if (rangeBtn) {
        state.range = rangeBtn.getAttribute("data-range");
        load();
      }
    });
    board.addEventListener("change", function (event) {
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

    render();
    load();

    return function unmount() {
      dead = true;
    };
  }

  window.XmDataCreateShopDashboard = createShopDashboard;

  const shopModule = {
    mount: function (root) {
      return createShopDashboard(root);
    }
  };

  try {
    Object.defineProperty(window.XmModules, "/data/shops", {
      configurable: true,
      enumerable: true,
      get: function () {
        return shopModule;
      },
      set: function () {}
    });
  } catch (_err) {
    window.XmModules["/data/shops"] = shopModule;
  }

  const existingBoard = document.getElementById("board");
  if (existingBoard && /\/data\/shops\/?$/.test(location.pathname)) {
    createShopDashboard(existingBoard.closest(".xm-page") || document.body);
  }
})();
