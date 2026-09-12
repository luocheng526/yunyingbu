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
      link.href = "/data-pages.css?v=shop-wide6";
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

  function firstNum(obj, keys) {
    const list = keys || [];
    for (let i = 0; i < list.length; i += 1) {
      const n = Number(obj && obj[list[i]]);
      if (obj && obj[list[i]] != null && obj[list[i]] !== "" && !Number.isNaN(n)) {
        return n;
      }
    }
    return null;
  }

  function money(shop, keys) {
    const n = firstNum(shop, keys);
    return fmt(n != null ? n : 0, 2);
  }

  function count(shop, keys) {
    const n = firstNum(shop, keys);
    return fmt(n != null ? n : 0, 0);
  }

  function rate(shop, keys, fallback) {
    const n = firstNum(shop, keys);
    if (n != null) {
      return pct(n);
    }
    return fallback != null ? pct(fallback) : "0.00%";
  }

  function cellsFromErp(shop, maxProfit) {
    const pay = Number(shop.payAmount) || 0;
    const refund = Number(shop.refundAmount) || 0;
    const profit = firstNum(shop, ["profit"]) != null ? firstNum(shop, ["profit"]) : 0;
    const promo = firstNum(shop, ["totalPromotionCost", "promotionCost"]) != null
      ? firstNum(shop, ["totalPromotionCost", "promotionCost"])
      : 0;
    const live = firstNum(shop, ["livePayAmount", "todayPayAmount", "realtimePayAmount", "payAmount"]);
    const invalid = firstNum(shop, ["invalidAmount", "invalidOrderAmount"]);
    const net = firstNum(shop, ["netSales", "netSalesAmount"]);
    const newRate = firstNum(shop, ["newRate"]);
    return [
      fmt(live != null ? live : pay, 2),
      newRate != null ? (Number(newRate) > 1 ? Number(newRate) : Number(newRate) * 100).toFixed(4) + "%" : "0.0000%",
      count(shop, ["orderCount"]),
      count(shop, ["netOrderCount"]),
      fmt(pay, 2),
      fmt(invalid != null ? invalid : 0, 2),
      fmt(refund, 2),
      rate(shop, ["refundRate"], pay ? refund / pay : 0),
      fmt(net != null ? net : pay - refund, 2),
      money(shop, ["totalMarketing"]),
      money(shop, ["siteMarketing"]),
      money(shop, ["offsiteMarketing"]),
      rate(shop, ["promotionRate"], pay ? promo / pay : 0),
      { html: profitCell(profit, maxProfit) },
      rate(shop, ["profitRate"], pay ? profit / pay : 0),
      money(shop, ["saleFee", "salesFee"]),
      money(shop, ["platformFee", "platformCost"]),
      money(shop, ["goodsCost", "totalGoodsCost"]),
      count(shop, ["dropshipCount"]),
      count(shop, ["invalidCount"]),
      rate(shop, ["goodsCostRate"]),
      money(shop, ["netGoodsCost"]),
      rate(shop, ["netGoodsCostRate"]),
      money(shop, ["customFee"]),
      money(shop, ["otherFee"]),
      money(shop, ["materialFee"]),
      money(shop, ["shipMaterialFee"]),
      money(shop, ["packFee"])
    ];
  }

  function mergeErpShops(metricShops, directory) {
    const metrics = metricShops || [];
    const byId = {};
    metrics.forEach(function (shop) {
      const id = String(shop.shopId || shop.id || "");
      if (id) {
        byId[id] = shop;
      }
    });
    const out = [];
    const seen = {};
    (directory || []).forEach(function (row) {
      const id = String(row.id || row.shopId || "");
      if (!id || seen[id]) {
        return;
      }
      seen[id] = true;
      const hit = byId[id] || {};
      out.push(Object.assign({}, row, hit, {
        shopId: id,
        shopName: hit.shopName || row.shopName
      }));
    });
    metrics.forEach(function (shop) {
      const id = String(shop.shopId || "");
      if (id && !seen[id]) {
        seen[id] = true;
        out.push(shop);
      }
    });
    return out;
  }

  function shopHasMetrics(shop) {
    return Boolean(
      Number(shop && shop.payAmount) ||
        Number(shop && shop.orderCount) ||
        Number(shop && shop.refundAmount) ||
        Number(shop && shop.profit)
    );
  }

  function sortShops(shops) {
    return (shops || []).slice().sort(function (a, b) {
      const payA = Number(a.payAmount) || 0;
      const payB = Number(b.payAmount) || 0;
      if (payB !== payA) {
        return payB - payA;
      }
      return String(a.shopName || "").localeCompare(String(b.shopName || ""), "zh");
    });
  }

  function aggregateGoods(records) {
    const acc = {
      payAmount: 0,
      orderCount: 0,
      netOrderCount: 0,
      netSales: 0,
      profit: 0,
      totalPromotionCost: 0,
      refundAmount: 0
    };
    (records || []).forEach(function (row) {
      const pay = Number(row.payAmount) || 0;
      const rate = Number(row.refundRate) || 0;
      acc.payAmount += pay;
      acc.orderCount += Number(row.orderCount) || 0;
      acc.netSales += Number(row.netSalesAmount) || 0;
      acc.profit += Number(row.profit) || 0;
      acc.totalPromotionCost += Number(row.promotionCost) || 0;
      acc.refundAmount += pay * (rate > 1 ? rate / 100 : rate);
    });
    acc.netOrderCount = acc.orderCount;
    acc.refundRate = acc.payAmount ? acc.refundAmount / acc.payAmount : 0;
    acc.profitRate = acc.payAmount ? acc.profit / acc.payAmount : 0;
    acc.promotionRate = acc.payAmount ? acc.totalPromotionCost / acc.payAmount : 0;
    return acc;
  }

  var SHOP_CACHE_LS = "xm-data-shops-metrics-v1";
  var SHOP_CACHE_FRESH_MS = 60 * 60 * 1000;
  var SHOP_METRIC_KEYS = [
    "shopId",
    "shopName",
    "payAmount",
    "orderCount",
    "netOrderCount",
    "netSales",
    "profit",
    "totalPromotionCost",
    "refundAmount",
    "refundRate",
    "profitRate",
    "promotionRate",
    "goodsEmpty"
  ];

  function cacheSlotKey(span) {
    return String((span && span.from) || "") + "_" + String((span && span.to) || "");
  }

  function pickShopCache(shop) {
    const out = {};
    SHOP_METRIC_KEYS.forEach(function (key) {
      if (shop && shop[key] != null) {
        out[key] = shop[key];
      }
    });
    return out;
  }

  function readShopCache(span) {
    try {
      const all = JSON.parse(localStorage.getItem(SHOP_CACHE_LS) || "{}");
      const slot = all[cacheSlotKey(span)] || all.latest;
      if (!slot || !Array.isArray(slot.shops) || !slot.shops.length) {
        return null;
      }
      return slot;
    } catch (_err) {
      return null;
    }
  }

  function writeShopCache(span, shops) {
    try {
      const all = JSON.parse(localStorage.getItem(SHOP_CACHE_LS) || "{}");
      const slot = {
        at: Date.now(),
        shops: (shops || []).map(pickShopCache)
      };
      all[cacheSlotKey(span)] = slot;
      all.latest = slot;
      localStorage.setItem(SHOP_CACHE_LS, JSON.stringify(all));
    } catch (_err) {}
  }

  function cacheIsFresh(slot) {
    return Boolean(slot && slot.at && Date.now() - slot.at < SHOP_CACHE_FRESH_MS);
  }

  function overlayCachedMetrics(shops, cachedShops) {
    const byId = {};
    (cachedShops || []).forEach(function (shop) {
      const id = String(shop.shopId || shop.id || "");
      if (id) {
        byId[id] = shop;
      }
    });
    (shops || []).forEach(function (shop) {
      const hit = byId[String(shop.shopId || "")];
      if (!hit) {
        return;
      }
      if (!shopHasMetrics(shop)) {
        Object.assign(shop, hit);
      } else if (hit.goodsEmpty) {
        shop.goodsEmpty = true;
      }
    });
    return shops;
  }

  function sumShops(shops) {
    return shops.reduce(
      function (acc, shop) {
        acc.payAmount += Number(shop.payAmount) || 0;
        acc.orderCount += Number(shop.orderCount) || 0;
        acc.netOrderCount += Number(shop.netOrderCount) || 0;
        acc.refundAmount += Number(shop.refundAmount) || 0;
        acc.profit += Number(shop.profit) || 0;
        acc.totalPromotionCost += Number(shop.totalPromotionCost || shop.promotionCost) || 0;
        acc.invalidAmount += Number(shop.invalidAmount || shop.invalidOrderAmount) || 0;
        acc.saleFee += Number(shop.saleFee || shop.salesFee) || 0;
        acc.platformFee += Number(shop.platformFee || shop.platformCost) || 0;
        acc.goodsCost += Number(shop.goodsCost || shop.totalGoodsCost) || 0;
        acc.customFee += Number(shop.customFee) || 0;
        acc.packFee += Number(shop.packFee) || 0;
        return acc;
      },
      {
        payAmount: 0,
        orderCount: 0,
        netOrderCount: 0,
        refundAmount: 0,
        profit: 0,
        totalPromotionCost: 0,
        invalidAmount: 0,
        saleFee: 0,
        platformFee: 0,
        goodsCost: 0,
        customFee: 0,
        packFee: 0
      }
    );
  }

  function fromErp(raw) {
    const shops = sortShops(raw.shops || []);
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
      shops: [],
      hint: "正在对接 ERP 店铺指标…",
      fillDone: 0,
      fillTotal: 0
    };
    let dead = false;
    let loadGen = 0;

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
        '<p class="sh-hint">' +
        escapeHtml(state.hint || "正在对接 ERP 店铺指标…") +
        "</p></section>";
    }

    function json(url) {
      return fetch(url, { credentials: "same-origin", headers: { Accept: "application/json" } }).then(function (res) {
        if (!res.ok) {
          throw new Error("接口 " + res.status);
        }
        return res.json();
      });
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

    function applyShops(shops) {
      const mapped = fromErp({ shops: shops || [] });
      state.shops = mapped.shops;
      state.rows = mapped.rows;
      render();
    }

    let applyTimer = 0;
    function applyShopsSoon(shops, immediate) {
      if (immediate) {
        if (applyTimer) {
          clearTimeout(applyTimer);
          applyTimer = 0;
        }
        applyShops(shops);
        return;
      }
      if (applyTimer) {
        return;
      }
      applyTimer = setTimeout(function () {
        applyTimer = 0;
        applyShops(shops);
      }, 400);
    }

    function goodsQuery(shopId, span, page) {
      const params = new URLSearchParams();
      params.set("shopId", shopId);
      params.set("page", String(page || 1));
      params.set("pageSize", "50");
      if (span && span.from && span.to) {
        params.set("from", span.from + " 00:00:00");
        params.set("to", span.to + " 23:59:59");
        params.set("payTimeStart", span.from + " 00:00:00");
        params.set("payTimeEnd", span.to + " 23:59:59");
      }
      return "/api/data/goods?" + params.toString();
    }

    function fetchShopGoods(shopId, span) {
      return softJson(goodsQuery(shopId, span, 1)).then(function (first) {
        if (!first || !first.ok) {
          return null;
        }
        const recs = (first.records || []).slice();
        const pages = Number(first.totalPages) || 1;
        let chain = Promise.resolve();
        for (let page = 2; page <= pages; page += 1) {
          chain = chain.then(function () {
            return softJson(goodsQuery(shopId, span, page)).then(function (pack) {
              recs.push.apply(recs, (pack && pack.records) || []);
            });
          });
        }
        return chain.then(function () {
          return aggregateGoods(recs);
        });
      });
    }

    function mapLimit(items, limit, worker) {
      return new Promise(function (resolve) {
        let index = 0;
        let active = 0;
        const out = new Array(items.length);
        function pump() {
          if (index >= items.length && active === 0) {
            resolve(out);
            return;
          }
          while (active < limit && index < items.length) {
            const cur = index;
            index += 1;
            active += 1;
            Promise.resolve(worker(items[cur], cur))
              .then(function (val) {
                out[cur] = val;
              })
              .catch(function () {
                out[cur] = null;
              })
              .then(function () {
                active -= 1;
                pump();
              });
          }
        }
        if (!items.length) {
          resolve(out);
          return;
        }
        pump();
      });
    }

    function fillShopMetrics(shops, span, gen) {
      const pending = (shops || []).filter(function (shop) {
        return shop.shopId && !shopHasMetrics(shop) && !shop.goodsEmpty;
      });
      state.fillTotal = pending.length;
      state.fillDone = 0;
      if (!pending.length) {
        state.hint = "已显示最近店铺数据";
        writeShopCache(span, shops);
        render();
        return Promise.resolve();
      }
      state.hint = "后台补全新店指标，表格已可查看";
      render();
      return mapLimit(pending, 8, function (shop) {
        if (dead || gen !== loadGen) {
          return null;
        }
        return fetchShopGoods(shop.shopId, span).then(function (metrics) {
          if (dead || gen !== loadGen) {
            return null;
          }
          if (metrics && shopHasMetrics(metrics)) {
            Object.assign(shop, metrics);
          } else if (metrics) {
            shop.goodsEmpty = true;
          }
          state.fillDone += 1;
          if (state.fillDone >= pending.length) {
            state.hint = "已显示最近店铺数据";
            writeShopCache(span, shops);
            applyShopsSoon(shops, true);
          } else {
            if (state.fillDone === 1 || state.fillDone % 6 === 0) {
              writeShopCache(span, shops);
            }
            applyShopsSoon(shops, false);
          }
          return metrics;
        });
      });
    }

    function loadShopDirectory(metricShops, span, gen, cached) {
      return softJson("/api/data/shop-options")
        .then(function (opt) {
          const recs = opt && (opt.records || opt.shops);
          if (recs && recs.length) {
            return recs;
          }
          return Promise.all([
            softJson("/api/data/shops?page=1&pageSize=50"),
            softJson("/api/data/shops?page=2&pageSize=50")
          ]).then(function (pages) {
            return pages.reduce(function (acc, pack) {
              return acc.concat((pack && pack.records) || []);
            }, []);
          });
        })
        .then(function (dir) {
          if (dead || gen !== loadGen) {
            return;
          }
          const merged = overlayCachedMetrics(
            mergeErpShops(metricShops, dir && dir.length ? dir : []),
            cached && cached.shops
          );
          applyShopsSoon(merged, true);
          if (cacheIsFresh(cached) && !merged.some(function (shop) {
            return shop.shopId && !shopHasMetrics(shop) && !shop.goodsEmpty;
          })) {
            state.hint = "已显示最近店铺数据";
            render();
            return;
          }
          return fillShopMetrics(merged, span, gen);
        });
    }

    function load(forceBoard) {
      const span = rangeSpan(state.range, state.customFrom, state.customTo);
      const gen = (loadGen += 1);
      state.dateLabel = span.dateLabel;
      const cached = readShopCache(span);
      if (cached && cached.shops.length) {
        applyShops(cached.shops);
        state.hint = cacheIsFresh(cached) ? "已显示最近店铺数据" : "已显示缓存，正在核对最新";
        render();
      } else {
        state.hint = "正在对接 ERP 店铺指标…";
      }
      if (!forceBoard && cacheIsFresh(cached)) {
        return Promise.resolve();
      }
      const params = new URLSearchParams();
      params.set("from", span.from + " 00:00:00");
      params.set("to", span.to + " 23:59:59");
      params.set("payTimeStart", span.from + " 00:00:00");
      params.set("payTimeEnd", span.to + " 23:59:59");
      return json("/api/data/overview?" + params.toString())
        .then(function (data) {
          if (dead || gen !== loadGen) {
            return;
          }
          if (data && data.ok && data.shops && data.shops.length) {
            try {
              const seeded = overlayCachedMetrics(data.shops.slice(), cached && cached.shops);
              if (!(cached && cached.shops.length)) {
                applyShops(seeded);
              }
              loadShopDirectory(data.shops, span, gen, cached);
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

    const boardTick = setInterval(function () {
      if (!dead) {
        load(true);
      }
    }, SHOP_CACHE_FRESH_MS);

    render();
    load();

    return function unmount() {
      dead = true;
      clearInterval(boardTick);
      if (applyTimer) {
        clearTimeout(applyTimer);
      }
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
