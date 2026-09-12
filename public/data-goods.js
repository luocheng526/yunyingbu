(function () {
  window.XmModules = window.XmModules || {};

  var CARD_DEFS = [
    { key: "all", label: "全部", hint: "", color: "#8c8c8c" },
    { key: "highMargin", label: "高毛利高利润单品", hint: "净商品成本占比(支付) < 30%", color: "#cf1322" },
    { key: "strategy", label: "利润/毛利战略单品", hint: "净商品成本占比 <= 70%", color: "#d46b08" },
    { key: "refund", label: "款式/货值高退款", hint: "推广花费占比 >= 30%", color: "#d4b106" },
    { key: "loss", label: "利润亏损链接", hint: "利润支付额 < 0", color: "#cf1322" },
    { key: "lowAov", label: "低客单价", hint: "真实客单价 < 50", color: "#eb2f96" },
    { key: "midAov", label: "中客单价", hint: "真实客单价 <= 50", color: "#d46b08" },
    { key: "highAov", label: "高客单价", hint: "真实客单价 > 100", color: "#722ed1" },
    { key: "convLoss", label: "高转化亏损", hint: "利润支付额 < 0", color: "#13c2c2" },
    { key: "searchLoss", label: "高搜索亏损", hint: "搜索访客 >= 80%", color: "#1677c7" },
    { key: "cartLowPay", label: "高加购低付费", hint: "加购率 > 10%", color: "#389e0d" },
    { key: "profitDown", label: "利润环比下降30%+", hint: "利润环比 <= -30%", color: "#cf1322" },
    { key: "profitUp", label: "利润环比增长30%+", hint: "利润支付环比 >= 30%", color: "#cf1322" },
    { key: "feeDown", label: "费比环比下降5%+", hint: "推广花费占比环比 <= -5%", color: "#d46b08" }
  ];
  var RANGES = ["30天", "7天", "日", "周", "月", "年", "自定义"];
  var COLUMNS = [
    "商品",
    "店铺",
    "推广SKU",
    "成长阶段",
    "销售单数",
    "净销售单数 (支付)",
    "支付金额 (支付)",
    "无效金额 (标注)",
    "退款金额",
    "退款率 (移)"
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
      link.href = "/data-pages.css?v=goods-erp1";
      document.head.appendChild(link);
    }
  }

  function stripPageChrome(root) {
    Array.prototype.forEach.call(root.querySelectorAll(".kicker, .data-subnav, .page-head"), function (el) {
      el.remove();
    });
    Array.prototype.forEach.call(root.querySelectorAll("h1"), function (el) {
      if (/商品数据/.test(el.textContent.trim())) {
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

  function md(date) {
    return pad(date.getMonth() + 1) + "/" + pad(date.getDate());
  }

  function rangeSpan(label, customFrom, customTo) {
    const to = new Date();
    to.setHours(0, 0, 0, 0);
    const from = new Date(to);
    if (label === "7天") {
      from.setDate(from.getDate() - 6);
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
      from.setDate(from.getDate() - 29);
    }
    return { from: ymd(from), to: ymd(to), dateLabel: slashDate(to) };
  }

  function fmtNum(value) {
    if (value == null || value === "" || value === "--") {
      return "--";
    }
    const n = Number(value);
    if (Number.isNaN(n)) {
      return String(value);
    }
    return n.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
  }

  function fmtPct(value) {
    if (value == null || value === "" || value === "--") {
      return "--";
    }
    const n = Number(value);
    if (Number.isNaN(n)) {
      return String(value);
    }
    return (n > 1 ? n : n * 100).toFixed(2) + "%";
  }

  function classify(row) {
    const pay = Number(row.payAmount) || 0;
    const profit = Number(row.profit) || 0;
    const orders = Number(row.orderCount) || 0;
    const promo = Number(row.promotionCost) || 0;
    const costRatio = pay ? (pay - profit) / pay : 0;
    const aov = orders ? pay / orders : 0;
    const promoRatio = pay ? promo / pay : 0;
    return {
      highMargin: pay > 0 && costRatio < 0.3,
      strategy: pay > 0 && costRatio <= 0.7,
      refund: promoRatio >= 0.3,
      loss: profit < 0,
      lowAov: aov > 0 && aov < 50,
      midAov: aov > 0 && aov <= 50,
      highAov: aov > 100,
      convLoss: profit < 0,
      searchLoss: false,
      cartLowPay: false,
      profitDown: false,
      profitUp: false,
      feeDown: false
    };
  }

  function buildCards(records, total) {
    const counts = { all: Number(total) || records.length };
    CARD_DEFS.forEach(function (def) {
      if (def.key !== "all") {
        counts[def.key] = 0;
      }
    });
    records.forEach(function (row) {
      const flags = classify(row);
      Object.keys(flags).forEach(function (key) {
        if (flags[key]) {
          counts[key] += 1;
        }
      });
    });
    const denom = counts.all || 1;
    return CARD_DEFS.map(function (def) {
      const value = counts[def.key] || 0;
      return {
        key: def.key,
        label: def.label,
        hint: def.hint,
        color: def.color,
        value: String(value),
        share: ((value / denom) * 100).toFixed(2) + "% 占比",
        delta: "0.00% 环比"
      };
    });
  }

  function rowFromErp(row) {
    const refund = Number(row.payAmount) && Number(row.refundRate) ? Number(row.payAmount) * (Number(row.refundRate) > 1 ? Number(row.refundRate) / 100 : Number(row.refundRate)) : null;
    return {
      name: "SPU:" + (row.productId || "--") + " " + (row.productName || ""),
      kind: "sku",
      thumb: true,
      store: row.shopName || "",
      productId: row.productId,
      flags: classify(row),
      cells: [
        row.shopName || "--",
        "--",
        row.growthStage || "--",
        fmtNum(row.orderCount),
        fmtNum(row.skuNum),
        fmtNum(row.payAmount),
        "--",
        refund == null ? "--" : fmtNum(refund),
        fmtPct(row.refundRate)
      ]
    };
  }

  function sumRow(rows) {
    let orders = 0;
    let sku = 0;
    let pay = 0;
    let refund = 0;
    rows.forEach(function (row) {
      const rec = row._raw;
      if (!rec) {
        return;
      }
      orders += Number(rec.orderCount) || 0;
      sku += Number(rec.skuNum) || 0;
      pay += Number(rec.payAmount) || 0;
      const rate = Number(rec.refundRate) || 0;
      refund += Number(rec.payAmount) * (rate > 1 ? rate / 100 : rate) || 0;
    });
    return {
      name: "当页汇总",
      kind: "sum",
      store: "",
      cells: ["", "--", "--", fmtNum(orders), fmtNum(sku), fmtNum(pay), "--", fmtNum(refund), pay ? fmtPct(refund / pay) : "--"]
    };
  }

  function toolButtons() {
    return (
      '<div class="ch-tools">' +
      '<button type="button" disabled>表格操作</button>' +
      '<button type="button" disabled>选数</button>' +
      '<button type="button" disabled>导入推广SKU</button>' +
      '<button type="button" disabled>去推广</button>' +
      '<button type="button" class="is-on" disabled>列表</button>' +
      '<button type="button" disabled>周期</button>' +
      '<button type="button" disabled>大图</button>' +
      '<button type="button" disabled>默认视图</button>' +
      '<button type="button" disabled>更多数据</button>' +
      '<button type="button" disabled>导出</button></div>'
    );
  }

  function createGoodsDashboard(root) {
    ensureCss();
    stripPageChrome(root);
    let board = root.querySelector("#board");
    if (!board) {
      root.innerHTML = '<main class="xm-page data-overview-root ch-root"><div id="board"></div></main>';
      board = root.querySelector("#board");
    }
    const state = {
      view: "metrics",
      range: "30天",
      selectedKey: "all",
      cardDate: "08/13",
      dateLabel: "",
      from: "",
      to: "",
      customFrom: "",
      customTo: "",
      shopId: "",
      shops: [],
      q: "",
      page: 1,
      pages: 1,
      total: 0,
      rows: [],
      cards: CARD_DEFS.map(function (def) {
        return { ...def, value: "0", share: "0.00% 占比", delta: "0.00% 环比" };
      })
    };
    let dead = false;

    function visibleRows() {
      return state.rows.filter(function (row) {
        if (state.selectedKey !== "all" && row.flags && !row.flags[state.selectedKey]) {
          return false;
        }
        if (state.q) {
          const blob = (row.name + " " + row.store + " " + (row.productId || "")).toLowerCase();
          if (blob.indexOf(state.q.toLowerCase()) === -1) {
            return false;
          }
        }
        return true;
      });
    }

    function tableHtml() {
      const shown = visibleRows();
      const bodyRows = [sumRow(shown)].concat(shown);
      const shopOpts =
        '<option value="">全部店铺</option>' +
        state.shops
          .map(function (shop) {
            return (
              '<option value="' +
              escapeHtml(shop.id) +
              '"' +
              (shop.id === state.shopId ? " selected" : "") +
              ">" +
              escapeHtml(shop.shopName) +
              "</option>"
            );
          })
          .join("");
      const head =
        "<tr>" +
        COLUMNS.map(function (col) {
          return "<th>" + escapeHtml(col) + " <i></i></th>";
        }).join("") +
        "</tr>";
      const body = bodyRows
        .map(function (row) {
          const thumb = row.thumb
            ? '<span class="gd-thumb" aria-hidden="true"></span>'
            : '<span class="ch-bar"></span>';
          return (
            "<tr><td class=\"ch-name\">" +
            thumb +
            "<span>" +
            escapeHtml(row.name) +
            "</span></td>" +
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
        '<section class="ch-table ch-table-solo">' +
        '<div class="ch-table-bar gd-filters">' +
        '<label class="ch-pick"><select data-shop>' +
        shopOpts +
        "</select></label>" +
        '<label class="ch-pick"><select disabled><option>请选择标签</option></select></label>' +
        '<label class="ch-pick"><select disabled><option>请选择类目</option></select></label>' +
        '<label class="ch-pick"><select disabled><option>全部商品</option></select></label>' +
        '<label class="ch-pick gd-search"><input type="search" data-q placeholder="输入商品名/商品ID/网店SKU" value="' +
        escapeHtml(state.q) +
        '" /></label></div>' +
        '<div class="ch-table-bar">' +
        '<label class="ch-zero"><input type="checkbox" disabled /> 只看精选</label>' +
        '<label class="ch-zero"><input type="checkbox" disabled /> 只看负责人</label>' +
        '<label class="ch-zero"><input type="checkbox" disabled /> 只看有效商品</label>' +
        '<label class="ch-zero"><input type="checkbox" disabled /> 显示0</label>' +
        toolButtons() +
        "</div>" +
        '<div class="ch-table-wrap"><table><thead>' +
        head +
        "</thead><tbody>" +
        body +
        "</tbody></table></div>" +
        '<div class="ch-table-bar gd-pager"><span>第 ' +
        escapeHtml(String(state.page)) +
        " / " +
        escapeHtml(String(state.pages)) +
        " 页 · 共 " +
        escapeHtml(String(state.total)) +
        ' 条</span><button type="button" data-prev' +
        (state.page <= 1 ? " disabled" : "") +
        '>上一页</button><button type="button" data-next' +
        (state.page >= state.pages ? " disabled" : "") +
        ">下一页</button></div></section>"
      );
    }

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
      const cards = state.cards
        .map(function (card) {
          const on = card.key === state.selectedKey;
          return (
            '<article class="gd-card' +
            (on ? " is-on" : "") +
            '" data-card="' +
            escapeHtml(card.key) +
            '"><div class="gd-card-top"><span class="gd-dot" style="background:' +
            escapeHtml(card.color || "#8c8c8c") +
            '"></span><span class="label">' +
            escapeHtml(card.label) +
            '</span><span class="gd-date">' +
            escapeHtml(state.cardDate) +
            '</span><button type="button" class="gd-more" disabled>⋯</button></div>' +
            (card.hint ? '<div class="hint">' + escapeHtml(card.hint) + "</div>" : "") +
            '<div class="value">' +
            escapeHtml(card.value) +
            '</div><div class="extra"><span>' +
            escapeHtml(card.share || "") +
            "</span><span>" +
            escapeHtml(card.delta || "") +
            "</span></div></article>"
          );
        })
        .join("");
      const custom =
        state.range === "自定义"
          ? '<label class="ch-pick">从 <input type="date" data-from value="' +
            escapeHtml(state.customFrom) +
            '" /></label><label class="ch-pick">至 <input type="date" data-to value="' +
            escapeHtml(state.customTo) +
            '" /></label>'
          : "";
      board.innerHTML =
        '<div class="ch-top"><div class="ch-title">商品数据总览</div>' +
        '<div class="ch-right"><span class="ch-time">（统计时间：' +
        escapeHtml(state.dateLabel || "") +
        "）</span>" +
        '<div class="ch-ranges">' +
        ranges +
        custom +
        "</div></div></div>" +
        '<div class="gd-sub">' +
        '<button type="button" data-view="metrics"' +
        (state.view === "metrics" ? ' class="is-on"' : "") +
        ">综合指标</button>" +
        '<button type="button" data-view="spu"' +
        (state.view === "spu" ? ' class="is-on"' : "") +
        ">SPU</button>" +
        '<span class="gd-sub-tools"><button type="button" disabled>默认视图</button><button type="button" disabled>卡片设置</button></span></div>' +
        (state.view === "metrics"
          ? '<div class="gd-metrics">' + cards + '<article class="gd-card gd-add" aria-hidden="true">+</article></div>'
          : "") +
        tableHtml();
    }

    function json(url) {
      return fetch(url, { credentials: "same-origin", headers: { Accept: "application/json" } }).then(function (res) {
        if (!res.ok) {
          throw new Error("接口 " + res.status);
        }
        return res.json();
      });
    }

    function applyErp(data) {
      const records = data.records || [];
      state.total = Number(data.total) || records.length;
      state.pages = Number(data.totalPages) || 1;
      state.page = Number(data.currentPage || data.pageNum) || state.page;
      state.rows = records.map(function (rec) {
        const row = rowFromErp(rec);
        row._raw = rec;
        return row;
      });
      state.cards = buildCards(records, state.total);
    }

    function load() {
      const span = rangeSpan(state.range, state.customFrom, state.customTo);
      state.from = span.from;
      state.to = span.to;
      state.dateLabel = span.dateLabel;
      const params = new URLSearchParams();
      params.set("pageNum", String(state.page));
      params.set("pageSize", "20");
      if (state.shopId) {
        params.set("shopId", state.shopId);
      }
      if (state.from) {
        params.set("from", state.from + " 00:00:00");
      }
      if (state.to) {
        params.set("to", state.to + " 23:59:59");
      }
      return json("/api/data/goods?" + params.toString())
        .then(function (data) {
          if (dead) {
            return;
          }
          if (data && data.ok && (data.records || []).length) {
            applyErp(data);
            render();
            return;
          }
          throw new Error("empty");
        })
        .catch(function () {
          return json("/api/data/goods/board")
            .catch(function () {
              return json("/data/goods-demo.json");
            })
            .then(function (demo) {
              if (dead || !demo) {
                return;
              }
              state.cards = demo.cards && demo.cards.length ? demo.cards : state.cards;
              state.cardDate = demo.cardDate || state.cardDate;
              state.dateLabel = demo.dateLabel || state.dateLabel;
              state.rows = ((demo.goodsTable && demo.goodsTable.rows) || []).filter(function (row) {
                return row.kind !== "sum";
              });
              state.total = state.rows.length;
              state.pages = 1;
              render();
            });
        });
    }

    function loadShops() {
      return json("/api/data/shop-options")
        .then(function (data) {
          if (!dead) {
            state.shops = data.records || [];
          }
        })
        .catch(function () {
          state.shops = [];
        });
    }

    board.addEventListener("click", function (event) {
      const view = event.target.closest("[data-view]");
      if (view) {
        state.view = view.getAttribute("data-view");
        render();
        return;
      }
      const rangeBtn = event.target.closest("button[data-range]");
      if (rangeBtn) {
        state.range = rangeBtn.getAttribute("data-range");
        state.page = 1;
        load();
        return;
      }
      const card = event.target.closest("article[data-card]");
      if (card) {
        state.selectedKey = card.getAttribute("data-card");
        render();
        return;
      }
      if (event.target.closest("[data-prev]") && state.page > 1) {
        state.page -= 1;
        load();
        return;
      }
      if (event.target.closest("[data-next]") && state.page < state.pages) {
        state.page += 1;
        load();
      }
    });
    board.addEventListener("change", function (event) {
      if (event.target.matches("[data-shop]")) {
        state.shopId = event.target.value;
        state.page = 1;
        load();
        return;
      }
      if (event.target.matches("[data-from]")) {
        state.customFrom = event.target.value;
        state.page = 1;
        load();
        return;
      }
      if (event.target.matches("[data-to]")) {
        state.customTo = event.target.value;
        state.page = 1;
        load();
      }
    });
    board.addEventListener("input", function (event) {
      if (event.target.matches("[data-q]")) {
        state.q = event.target.value || "";
        render();
      }
    });

    const span = rangeSpan(state.range);
    state.from = span.from;
    state.to = span.to;
    state.dateLabel = span.dateLabel;
    render();
    loadShops().then(load);

    return function unmount() {
      dead = true;
    };
  }

  window.XmDataCreateGoodsDashboard = createGoodsDashboard;

  const goodsModule = {
    mount: function (root) {
      return createGoodsDashboard(root);
    }
  };

  try {
    Object.defineProperty(window.XmModules, "/data/goods", {
      configurable: true,
      enumerable: true,
      get: function () {
        return goodsModule;
      },
      set: function () {}
    });
  } catch (_err) {
    window.XmModules["/data/goods"] = goodsModule;
  }

  const existingBoard = document.getElementById("board");
  if (existingBoard && /\/data\/goods\/?$/.test(location.pathname)) {
    createGoodsDashboard(existingBoard.closest(".xm-page") || document.body);
  }
})();
