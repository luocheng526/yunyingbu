(function () {
  var COLS = [
    ["payAmount", "支付金额 (支付)", "m"],
    ["netSales", "净销售额 (支付)", "m"],
    ["netOrderCount", "净销售单数 (支付)", "n"],
    ["refundAmount", "退款金额", "m"],
    ["refundRate", "退款率 (按金额)", "r"],
    ["netGoodsCost", "净货品成本 (支付)", "m"],
    ["netGoodsCostRate", "净货品成本占比 (支付)", "r"],
    ["promotionCost", "推广花费 (支付预估)", "m"],
    ["promotionRate", "推广花费销售额占比 (支付预估)", "r"],
    ["platformFee", "平台花费 (支付预估)", "m"],
    ["customFee", "自定义费用", "m"],
    ["shipFee", "发货费用 (支付)", "m"],
    ["realPayRate", "真实支付转化率", "r"],
    ["profit", "利润 (支付预估)", "p"],
    ["profitRate", "大毛利率", "r"],
    ["grossProfit", "毛利润 (支付预估)", "p"],
    ["smallProfitRate", "小毛利率", "r"]
  ];

  function esc(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function num(obj, keys) {
    for (let i = 0; i < keys.length; i += 1) {
      const n = Number(obj && obj[keys[i]]);
      if (obj && obj[keys[i]] != null && obj[keys[i]] !== "" && !Number.isNaN(n)) {
        return n;
      }
    }
    return null;
  }

  function fmt(value, digits) {
    const n = Number(value);
    if (Number.isNaN(n)) {
      return "0";
    }
    return n.toLocaleString("zh-CN", {
      minimumFractionDigits: digits || 0,
      maximumFractionDigits: digits == null ? 2 : digits
    });
  }

  function pct(value) {
    const n = Number(value);
    if (Number.isNaN(n)) {
      return "0.00%";
    }
    return (n > 1 ? n : n * 100).toFixed(2) + "%";
  }

  function fill(row) {
    const pay = num(row, ["payAmount"]) || 0;
    const refund = num(row, ["refundAmount"]) || 0;
    const net = num(row, ["netSales", "netSalesAmount"]);
    const sales = net != null ? net : pay - refund;
    const cost = num(row, ["netGoodsCost"]) || 0;
    const promo = num(row, ["promotionCost", "totalPromotionCost"]) || 0;
    const profit = num(row, ["profit"]) || 0;
    const g0 = num(row, ["grossProfit", "grossProfitAmount"]);
    const g = g0 != null ? g0 : sales - cost;
    return {
      date: row && row.date ? row.date : "",
      payAmount: pay,
      netSales: sales,
      netOrderCount: num(row, ["netOrderCount", "orderCount"]) || 0,
      refundAmount: refund,
      refundRate: pay ? refund / pay : 0,
      netGoodsCost: cost,
      netGoodsCostRate: pay ? cost / pay : 0,
      promotionCost: promo,
      promotionRate: pay ? promo / pay : 0,
      platformFee: num(row, ["platformFee", "platformCost"]) || 0,
      customFee: num(row, ["customFee"]) || 0,
      shipFee: num(row, ["shipFee", "deliveryFee", "fulfillmentFee"]) || 0,
      realPayRate: num(row, ["realPayRate", "payConvertRate"]) || 0,
      profit: profit,
      profitRate: pay ? profit / pay : 0,
      grossProfit: g,
      smallProfitRate: pay ? g / pay : 0
    };
  }

  function sum(rows) {
    const acc = fill({});
    (rows || []).forEach(function (row) {
      const o = fill(row);
      acc.payAmount += o.payAmount;
      acc.netSales += o.netSales;
      acc.netOrderCount += o.netOrderCount;
      acc.refundAmount += o.refundAmount;
      acc.netGoodsCost += o.netGoodsCost;
      acc.promotionCost += o.promotionCost;
      acc.platformFee += o.platformFee;
      acc.customFee += o.customFee;
      acc.shipFee += o.shipFee;
      acc.profit += o.profit;
      acc.grossProfit += o.grossProfit;
    });
    const p = acc.payAmount;
    acc.refundRate = p ? acc.refundAmount / p : 0;
    acc.netGoodsCostRate = p ? acc.netGoodsCost / p : 0;
    acc.promotionRate = p ? acc.promotionCost / p : 0;
    acc.profitRate = p ? acc.profit / p : 0;
    acc.smallProfitRate = p ? acc.grossProfit / p : 0;
    return acc;
  }

  function cell(kind, n) {
    if (kind === "n") {
      return fmt(n, 0);
    }
    if (kind === "r") {
      return pct(n);
    }
    if (kind === "p") {
      return (n > 0 ? "+" : "") + fmt(n, 0);
    }
    return fmt(n, 0);
  }

  function tools() {
    return (
      '<div class="ch-tools"><button type="button" disabled>打标</button><button type="button" disabled>目标</button>' +
      '<button type="button" class="is-on" disabled>列表</button><button type="button" disabled>周期</button>' +
      '<button type="button" disabled>图表</button><button type="button" disabled>个人默认视图</button>' +
      '<button type="button" disabled>更多数据</button><button type="button" disabled>导出</button></div>'
    );
  }

  function panel(payload, shops) {
    const days = ((payload && payload.trend) || []).map(fill);
    const tot = shops && shops.length ? sum(shops) : sum(days);
    const kpis = COLS.map(function (col) {
      const n = Number(tot[col[0]]) || 0;
      return (
        '<div class="op-kpi"><div class="lab">' +
        esc(col[1]) +
        '</div><div class="val' +
        (col[2] === "p" ? " is-gain" : "") +
        '">' +
        esc(cell(col[2], n)) +
        "</div></div>"
      );
    }).join("");
    const rows = days
      .slice()
      .sort(function (a, b) {
        return String(b.date).localeCompare(String(a.date));
      })
      .map(function (day) {
        return (
          "<tr><td>" +
          esc(String(day.date || "").replaceAll("-", "/")) +
          "</td>" +
          COLS.map(function (col) {
            const n = Number(day[col[0]]) || 0;
            return "<td" + (col[2] === "p" ? ' class="op-gain"' : "") + ">" + esc(cell(col[2], n)) + "</td>";
          }).join("") +
          "</tr>"
        );
      })
      .join("");
    return (
      '<div class="op-kpis">' +
      kpis +
      '</div><div class="op-chart"><div class="op-chart-leg"><i></i>支付金额(支付)</div>' +
      '<svg class="op-bars" viewBox="0 0 800 220" preserveAspectRatio="none"></svg></div>' +
      '<section class="ch-table op-table sh-wide"><div class="ch-table-bar"><strong>数据列表</strong>' +
      '<label class="ch-zero"><input type="checkbox" disabled /> 显示数字</label>' +
      tools() +
      '</div><div class="ch-table-wrap"><table><thead><tr><th>日期 <i></i></th>' +
      COLS.map(function (col) {
        return "<th>" + esc(col[1]) + " <i></i></th>";
      }).join("") +
      "</tr></thead><tbody>" +
      (rows || '<tr><td colspan="18">暂无经营明细</td></tr>') +
      "</tbody></table></div></section>"
    );
  }

  function paint(svg, rawDays) {
    if (!svg) {
      return;
    }
    const list = (rawDays || []).map(fill).sort(function (a, b) {
      return String(a.date).localeCompare(String(b.date));
    });
    const ns = "http://www.w3.org/2000/svg";
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }
    const w = 800;
    const h = 220;
    let max = 1;
    list.forEach(function (row) {
      if (row.payAmount > max) {
        max = row.payAmount;
      }
    });
    const n = list.length || 1;
    const inner = 744;
    const bw = Math.max(2, inner / n - 4);
    function add(name, attrs, text) {
      const el = document.createElementNS(ns, name);
      Object.keys(attrs).forEach(function (k) {
        el.setAttribute(k, attrs[k]);
      });
      if (text) {
        el.textContent = text;
      }
      svg.appendChild(el);
    }
    [0, 0.5, 1].forEach(function (t) {
      const y = 8 + (1 - t) * 184;
      add("line", { x1: "48", y1: String(y), x2: "792", y2: String(y), stroke: "#f0f0f0" });
      add("text", { x: "4", y: String(y + 4), fill: "#bfbfbf", "font-size": "10" }, String(Math.round(max * t)));
    });
    list.forEach(function (row, i) {
      const bh = ((row.payAmount || 0) / max) * 184;
      const x = 48 + i * (inner / n) + 2;
      add("rect", {
        x: String(x),
        y: String(192 - bh),
        width: String(bw),
        height: String(Math.max(0, bh)),
        fill: "#2f54eb"
      });
      if (n <= 40) {
        add(
          "text",
          { x: String(x + bw / 2), y: "212", fill: "#bfbfbf", "font-size": "9", "text-anchor": "middle" },
          String(row.date || "").slice(5).replace("-", "/")
        );
      }
    });
  }

  var CAL_CSS =
    ":host{position:fixed;z-index:4000;display:none;width:560px;background:#fff;border:1px solid #e8e8e8;box-shadow:0 6px 16px rgba(0,0,0,.12)}" +
    ":host(.is-open){display:block}" +
    ".ch-cal{display:flex;width:560px}" +
    ".ch-cal-month{width:280px;padding:8px 12px}" +
    ".ch-cal-month + .ch-cal-month{border-left:1px solid #f0f0f0}" +
    ".ch-cal-head{position:relative;height:32px;text-align:center}" +
    ".ch-cal-head button{position:absolute;top:4px;width:22px;height:22px;border:0;background:transparent;cursor:pointer}" +
    ".ch-cal-head [data-cal='prev-year']{left:0}" +
    ".ch-cal-head [data-cal='prev-month']{left:20px}" +
    ".ch-cal-head [data-cal='next-month']{right:20px}" +
    ".ch-cal-head [data-cal='next-year']{right:0}" +
    "table{width:100%;border-collapse:collapse;table-layout:fixed}" +
    "th{height:24px;font-size:12px;color:#8c8c8c}" +
    "td{height:28px;padding:0;text-align:center}" +
    "td button{display:block;width:100%;height:28px;margin:0;padding:0;border:0;border-radius:2px;background:transparent;color:#262626;font:13px/28px inherit;cursor:pointer}" +
    "td button:hover:not(:disabled):not(.is-start):not(.is-end){background:#f5f5f5}" +
    "td button.is-out,td button.is-over,td button.is-future,td button:disabled{color:#bfbfbf;cursor:default}" +
    "td button.is-today{color:#cf1322;font-weight:600}" +
    "td button.is-in{background:#fff1f0;color:#c62828}" +
    "td button.is-start,td button.is-end{background:#c62828;color:#fff}";

  window.XmDataOps = { panel: panel, paint: paint, fill: fill, calCss: CAL_CSS };
})();
