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
    ":host(.is-months){width:280px;border:1px solid #f0f0f0;box-shadow:0 6px 16px rgba(0,0,0,.08)}" +
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
    "td button.is-start,td button.is-end{background:#c62828;color:#fff}" +
    ".ch-cal.is-weeks tr:hover td button:not(:disabled){background:#e6f4ff;color:#1677ff}" +
    ".ch-cal.is-weeks tr.is-week td button{background:#1677ff;color:#fff}" +
    ".ch-cal.is-months{width:280px;border:0}" +
    ".ch-cal-months{display:grid;grid-template-columns:repeat(4,1fr);gap:16px 4px;padding:20px 12px 24px}" +
    ".ch-cal-months button{height:32px;border:0;border-radius:16px;background:transparent;cursor:pointer}" +
    ".ch-cal-months button.is-start{background:#1677ff;color:#fff}" +
    ".ch-cal-months button:disabled{color:#d9d9d9;cursor:default}";

  function shopNameOf(item) {
    if (!item) {
      return "";
    }
    return String(typeof item === "string" ? item : item.shopName || item.name || "").trim();
  }

  function personDuty(person, people) {
    const name = String((person && person.name) || "").trim();
    const role = String((person && person.role) || "");
    const center = String((person && person.center) || "");
    if (role === "经理" && /运营中心$/.test(center)) {
      return "经理";
    }
    if (name && (people || []).some(function (item) {
      const reserve = String((item && item.reserve) || "").trim();
      return reserve && reserve !== "无" && reserve === name;
    })) {
      return "储备";
    }
    if (name && (people || []).some(function (item) {
      return String((item && item.supervisor) || "").trim() === name;
    })) {
      return "主管";
    }
    if (role === "主管") {
      return "主管";
    }
    return "";
  }

  function leaders(people) {
    const list = people || [];
    const seen = {};
    const out = [];
    function add(person, duty) {
      const name = String((person && person.name) || "").trim();
      if (!name || seen[name]) {
        return;
      }
      seen[name] = duty;
      out.push(person);
    }
    list.forEach(function (person) {
      if (personDuty(person, list) === "经理") {
        add(person, "经理");
      }
    });
    const mgr = {};
    list.forEach(function (person) {
      if (personDuty(person, list) === "经理") {
        mgr[String(person.name || "")] = true;
      }
    });
    list.forEach(function (person) {
      const sup = String((person && person.supervisor) || "").trim();
      if (sup && !mgr[sup] && seen[sup] !== "储备") {
        const hit = list.find(function (item) {
          return String(item.name || "").trim() === sup;
        });
        if (!hit || personDuty(hit, list) !== "储备") {
          add(hit || { id: "sup-" + sup, name: sup, role: "主管", visibleShops: [] }, "主管");
        }
      }
      if (personDuty(person, list) === "主管") {
        add(person, "主管");
      }
    });
    list.forEach(function (person) {
      const reserve = String((person && person.reserve) || "").trim();
      if (reserve && reserve !== "无") {
        const hit = list.find(function (item) {
          return String(item.name || "").trim() === reserve;
        });
        add(hit || { id: "rs-" + reserve, name: reserve, role: "储备", visibleShops: [] }, "储备");
      }
    });
    return out;
  }

  function teamShopNames(leader, duty, people, shops) {
    const names = {};
    const ops = {};
    function add(list) {
      (list || []).forEach(function (item) {
        const name = shopNameOf(item);
        if (name) {
          names[name.replace(/\s+/g, "")] = name;
        }
      });
    }
    add(leader && leader.visibleShops);
    const lead = String((leader && leader.name) || "");
    const center = String((leader && leader.center) || "");
    if (lead) {
      ops[lead] = true;
    }
    (people || []).forEach(function (person) {
      const belong =
        (duty === "经理" && (person.lineManager === lead || person.center === center || person.center === lead + "运营中心")) ||
        (duty === "主管" && (person.supervisor === lead || person.name === lead)) ||
        (duty === "储备" && (person.reserve === lead || person.name === lead));
      if (belong) {
        add(person.visibleShops);
        const nm = String(person.name || "").trim();
        if (nm) {
          ops[nm] = true;
        }
      }
    });
    (shops || []).forEach(function (shop) {
      const op = String((shop && shop.operateName) || "").trim();
      if (op && ops[op]) {
        add([shop.shopName]);
      }
    });
    return names;
  }

  function covers(person, shop, duty, people, shops) {
    const map = teamShopNames(person, duty || personDuty(person, people), people, shops);
    const key = String((shop && shop.shopName) || "").replace(/\s+/g, "");
    return Boolean(key && map[key]);
  }

  function dutyTable(shops, people, openId, teamIds, api) {
    const list = shops || [];
    const cols = api.cols;
    const tot = api.sum(list);
    const rank = { 经理: 0, 主管: 1, 储备: 2 };
    const rows = [{
      name: "当页汇总",
      kind: "sum",
      profit: api.firstNum(tot, ["profit"]),
      cells: cols.map(function (col) {
        return api.cell(tot, col);
      })
    }];
    leaders(people)
      .map(function (person) {
        const duty = personDuty(person, people) || String(person.role || "储备");
        const map = teamShopNames(person, duty, people, list);
        const members = api.sortByPay(list.filter(function (shop) {
          const key = String((shop && shop.shopName) || "").replace(/\s+/g, "");
          return Boolean(key && map[key]);
        }));
        const sum = api.sum(members);
        return { person: person, members: members, duty: duty, sum: sum, pay: api.payOf(sum) };
      })
      .filter(function (item) {
        if (teamIds && teamIds.length) {
          const tid = String(item.person.id || item.person.name);
          return teamIds.indexOf(tid) >= 0 || teamIds.indexOf(item.person.name) >= 0;
        }
        return teamIds == null;
      })
      .sort(function (a, b) {
        const d = (rank[a.duty] || 9) - (rank[b.duty] || 9);
        return d !== 0 ? d : b.pay - a.pay;
      })
      .forEach(function (item) {
        const tid = String(item.person.id || item.person.name);
        rows.push({
          name: api.title(item.person.name, item.duty),
          kind: "team",
          teamId: tid,
          open: String(openId) === tid,
          profit: api.firstNum(item.sum, ["profit"]),
          cells: cols.map(function (col) {
            return api.cell(item.sum, col);
          })
        });
        if (String(openId) === tid) {
          item.members.forEach(function (shop) {
            rows.push({
              name: shop.shopName,
              kind: "shop",
              child: true,
              shopId: shop.shopId,
              profit: api.firstNum(shop, ["profit"]),
              cells: cols.map(function (col) {
                return api.cell(shop, col);
              })
            });
          });
        }
      });
    return {
      title: "店铺分组",
      columns: ["团队"].concat(cols.map(function (col) {
        return col.label;
      })),
      rows: rows
    };
  }

  function weekBounds(day) {
    const parts = String(day || "").split("-").map(Number);
    const utc = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    const sun = new Date(utc);
    sun.setUTCDate(utc.getUTCDate() - utc.getUTCDay());
    const sat = new Date(sun);
    sat.setUTCDate(sun.getUTCDate() + 6);
    return { from: sun.toISOString().slice(0, 10), to: sat.toISOString().slice(0, 10) };
  }

  function monthBounds(ym) {
    const parts = String(ym || "").split("-").map(Number);
    const mm = String(parts[1]).padStart(2, "0");
    const last = new Date(Date.UTC(parts[0], parts[1], 0));
    return { from: parts[0] + "-" + mm + "-01", to: last.toISOString().slice(0, 10) };
  }

  function teamMenu(people, teamIds, teamDraft, esc, titleFn, dutyFn) {
    const list = leaders(people);
    const all = list.map(function (person) {
      return String(person.id || person.name);
    });
    function draft() {
      if (teamDraft === undefined) {
        return teamIds == null ? all.slice() : teamIds.slice();
      }
      if (teamDraft == null) {
        return all.slice();
      }
      return teamDraft.slice();
    }
    const ids = draft();
    const allOn = (teamDraft === undefined ? teamIds : teamDraft) == null || (all.length > 0 && ids.length === all.length);
    return (
      '<label class="ch-shop-opt"><input type="checkbox" data-team-all' +
      (allOn ? " checked" : "") +
      ">全选</label>" +
      list
        .map(function (person) {
          const tid = String(person.id || person.name);
          const duty = dutyFn(person, people) || String(person.role || "主管");
          return (
            '<label class="ch-shop-opt"><input type="checkbox" data-team-id="' +
            esc(tid) +
            '"' +
            (allOn || ids.indexOf(tid) >= 0 ? " checked" : "") +
            ">" +
            esc(titleFn(person.name, duty)) +
            "</label>"
          );
        })
        .join("")
    );
  }

  function p2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function monthCells(year, month, sunFirst) {
    const first = new Date(year, month, 1);
    let lead = first.getDay();
    if (!sunFirst) {
      lead = lead === 0 ? 6 : lead - 1;
    }
    const days = new Date(year, month + 1, 0).getDate();
    const cells = [];
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

  function monthCal(year, month, from, to, today, side, weekMode) {
    const weekHead =
      "<tr>" +
      (weekMode ? ["日", "一", "二", "三", "四", "五", "六"] : ["一", "二", "三", "四", "五", "六", "日"])
        .map(function (name) {
          return "<th>" + name + "</th>";
        })
        .join("") +
      "</tr>";
    const cells = monthCells(year, month, weekMode);
    let rows = "";
    for (let i = 0; i < cells.length; i += 7) {
      const slice = cells.slice(i, i + 7);
      const mon = slice[0];
      const monVal = mon.y + "-" + p2(mon.m + 1) + "-" + p2(mon.d);
      const weekOn = weekMode && from && to && weekBounds(monVal).from === from;
      rows +=
        "<tr" +
        (weekOn ? ' class="is-week"' : "") +
        ">" +
        slice
          .map(function (cell) {
            const value = cell.y + "-" + p2(cell.m + 1) + "-" + p2(cell.d);
            const future = value > today;
            const over =
              !weekMode &&
              from &&
              !to &&
              Math.round(Math.abs(Date.parse(value + "T00:00:00+08:00") - Date.parse(from + "T00:00:00+08:00")) / 86400000) + 1 > 30;
            const blocked = future || over;
            const cls = [
              cell.out ? "is-out" : "",
              future ? "is-future" : "",
              over ? "is-over" : "",
              !blocked && value === today ? "is-today" : "",
              from && to && value >= from && value <= to ? "is-in" : "",
              !weekMode && value === from ? "is-start" : "",
              !weekMode && value === to ? "is-end" : ""
            ]
              .filter(Boolean)
              .join(" ");
            return (
              '<td><button type="button" data-day="' +
              value +
              '"' +
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
    return (
      '<div class="ch-cal-month"><div class="ch-cal-head">' +
      (side === "left"
        ? '<button type="button" data-cal="prev-year" aria-label="上一年">«</button><button type="button" data-cal="prev-month" aria-label="上一月">‹</button>'
        : "") +
      "<strong>" +
      year +
      "年" +
      (month + 1) +
      "月</strong>" +
      (side === "right"
        ? '<button type="button" data-cal="next-month" aria-label="下一月">›</button><button type="button" data-cal="next-year" aria-label="下一年">»</button>'
        : "") +
      '</div><table><thead>' +
      weekHead +
      '</thead><tbody class="ch-cal-days">' +
      rows +
      "</tbody></table></div>"
    );
  }

  function yearBounds(y, today) {
    const year = String(y || "").slice(0, 4);
    const from = year + "-01-01";
    const last = year + "-12-31";
    return { from: from, to: today && last > today ? today : last };
  }

  function yearPick(start, selected, nowYear) {
    const base = Math.floor(Number(start || nowYear) / 10) * 10;
    const hit = String(selected || "").slice(0, 4);
    let cells = "";
    for (let i = 0; i < 12; i += 1) {
      const y = base + i;
      cells +=
        '<button type="button" data-year="' +
        y +
        '"' +
        (y > nowYear ? " disabled" : "") +
        (String(y) === hit ? ' class="is-start"' : "") +
        ">" +
        y +
        "</button>";
    }
    return (
      '<div class="ch-cal is-months is-years" data-calendar="1"><div class="ch-cal-month" style="width:100%"><div class="ch-cal-head">' +
      '<button type="button" data-cal="prev-year" aria-label="上一页">«</button><strong>' +
      base +
      "-" +
      (base + 9) +
      '</strong><button type="button" data-cal="next-year" aria-label="下一页">»</button></div>' +
      '<div class="ch-cal-months">' +
      cells +
      "</div></div></div>"
    );
  }

  function yearCal(year, selected, nowYm) {
    const hit = String(selected || "").slice(0, 7);
    let cells = "";
    for (let m = 1; m <= 12; m += 1) {
      const ym = year + "-" + String(m).padStart(2, "0");
      cells +=
        '<button type="button" data-month="' +
        ym +
        '"' +
        (ym > nowYm ? " disabled" : "") +
        (ym === hit ? ' class="is-start"' : "") +
        ">" +
        ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"][m - 1] +
        "月</button>";
    }
    return (
      '<div class="ch-cal is-months" data-calendar="1"><div class="ch-cal-month" style="width:100%"><div class="ch-cal-head">' +
      '<button type="button" data-cal="prev-year" aria-label="上一年">«</button><strong>' +
      year +
      '年</strong><button type="button" data-cal="next-year" aria-label="下一年">»</button></div>' +
      '<div class="ch-cal-months">' +
      cells +
      "</div></div></div>"
    );
  }

  window.XmDataOps = {
    panel: panel,
    paint: paint,
    fill: fill,
    calCss: CAL_CSS,
    personDuty: personDuty,
    leaders: leaders,
    dutyTable: dutyTable,
    weekBounds: weekBounds,
    monthBounds: monthBounds,
    yearCal: yearCal,
    yearPick: yearPick,
    yearBounds: yearBounds,
    monthCal: monthCal,
    teamMenu: teamMenu
  };
})();
