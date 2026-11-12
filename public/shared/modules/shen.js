/* xm-module-shen */
(function () {
  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  window.XmModules = window.XmModules || {};

  function waitPage(title) {
    return {
      mount: function (root) {
        root.innerHTML =
          '<main class="page">' +
          '<header class="page-head"><p class="kicker">沈子晗运营中心</p><h1>' +
          escapeHtml(title) +
          "</h1>" +
          '<p class="lead">内容待开发。</p></header></main>';
        return function unmount() {
          root.innerHTML = "";
        };
      }
    };
  }

  window.XmModules["/shen/product"] = waitPage("产品中心");
  window.XmModules["/shen/product/xuanpin"] = waitPage("选品");
  window.XmModules["/shen/product/youhua"] = waitPage("优化");
  window.XmModules["/shen/product/chengzhang"] = waitPage("产品成长");
  window.XmModules["/shen/selection"] = waitPage("选品");
  window.XmModules["/shen/growth"] = waitPage("产品成长");
  window.XmModules["/shen/paid"] = {
    mount: function (root) {
      if (!document.querySelector('link[href^="/shared/shen-paid.css"]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "/shared/shen-paid.css?v=0.1.817-jingmai";
        document.head.appendChild(link);
      }

      const COLS = [
        ["gmv", "今日成交"],
        ["yest", "昨日成交"],
        ["spend", "推广花费"],
        ["roi", "成交ROI"],
        ["fee", "推广占比"],
        ["profit", "利润"],
        ["owner", "负责人"]
      ];
      const EXTRA = {};
      const LIVE_CARDS = [
        { key: "ad", label: "推广花费" },
        { key: "roi", label: "成交ROI" },
        { key: "livePay", label: "京麦成交额" },
        { key: "livePaid", label: "店铺数量" }
      ];
      const COL_STORE = "shen-live-cols";
      const CARD_STORE = "shen-live-cards";
      const FEE_STORE = "shen-fee-targets";

      function parseHash() {
        const params = new URLSearchParams(String(location.hash || "").replace(/^#/, ""));
        return {
          store: params.get("store") || "",
          team: params.get("team") || "",
          liveShop: params.get("liveShop") || "",
          history: false
        };
      }

      function writeHash(next, replace) {
        const merged = Object.assign(parseHash(), next || {});
        const params = new URLSearchParams();
        if (merged.store) {
          params.set("store", merged.store);
        } else {
          if (merged.team) {
            params.set("team", merged.team);
          }
          if (merged.liveShop) {
            params.set("liveShop", merged.liveShop);
          }
          if (merged.history) {
            params.set("history", "1");
          }
        }
        const text = params.toString();
        const url = location.pathname + location.search + (text ? "#" + text : "");
        if (replace) {
          history.replaceState(null, "", url);
        } else {
          location.hash = text;
        }
      }

      let view = parseHash();
      root.innerHTML =
        '<main class="page xm-paid xm-paid-live">' +
        '<div class="xm-sp-live-bar" id="paid-live-bar">' +
        '<nav class="xm-sp-live-tabs" id="paid-tabs" aria-label="主管分组"></nav>' +
        '<div class="xm-paid-meta"><span class="xm-paid-dot" aria-hidden="true"></span>' +
        '<span id="paid-asof">等待回传</span></div></div>' +
        '<section id="paid-board"></section>' +
        '<section class="kpi-grid" id="paid-kpis" hidden></section>' +
        '<div id="paid-body"></div>' +
        '<p id="paid-status" class="status" role="status"></p></main>';

      const barEl = root.querySelector("#paid-live-bar");
      const tabsEl = root.querySelector("#paid-tabs");
      const asofEl = root.querySelector("#paid-asof");
      const boardEl = root.querySelector("#paid-board");
      const kpiEl = root.querySelector("#paid-kpis");
      const bodyEl = root.querySelector("#paid-body");
      const statusEl = root.querySelector("#paid-status");
      let dead = false;
      let overviewRows = [];
      let overviewAsOf = "";
      let enabledStores = [];
      let overviewStale = false;
      let keepColsOpen = false;
      let includeHistory = view.history;

      function setStatus(message, isError) {
        statusEl.textContent = message || "";
        statusEl.className = "status" + (isError ? " error" : message ? " ok" : "");
      }

      function money(value) {
        if (value == null || value === "") {
          return "—";
        }
        return (Number(value) || 0).toLocaleString("zh-CN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        });
      }

      function salesText(value) {
        if (value == null || value === "") {
          return "—";
        }
        return (Number(value) || 0).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        });
      }

      function integer(value) {
        return (Number(value) || 0).toLocaleString("zh-CN");
      }

      function liveInt(value) {
        return Math.round(Number(value) || 0).toLocaleString("en-US");
      }

      function rate(value) {
        if (value == null || value === "") {
          return "—";
        }
        return (Number(value) || 0).toFixed(2);
      }

      function recorded(value) {
        const text = String(value == null ? "" : value).trim();
        return text ? escapeHtml(text) : "未记录";
      }

      function shortStamp(value) {
        const text = String(value == null ? "" : value).trim();
        if (!text) {
          return "未记录";
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
          return Number(text.slice(5, 7)) + "." + Number(text.slice(8, 10));
        }
        const match = text.match(/(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
        if (match) {
          return Number(match[2]) + "." + Number(match[3]) + "-" + match[4] + ":" + match[5];
        }
        return text;
      }

      function clockText(value) {
        const match = String(value || "").match(/(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/);
        return match ? match[1] + " " + match[2] : "";
      }

      function shopStamp(row) {
        return clockText(row && (row.ingestedAt || row.capturedAt)) || (row && row.date) || "";
      }

      function successTag(value) {
        if (value === "是") {
          return '<span class="xm-paid-tag is-yes">是</span>';
        }
        if (value === "否") {
          return '<span class="xm-paid-tag is-no">否</span>';
        }
        return '<span class="xm-paid-tag is-empty">' + escapeHtml(value || "—") + "</span>";
      }

      function feeRatio(spend, gmv) {
        const pay = Number(gmv);
        if (!(pay > 0)) {
          return null;
        }
        return (Number(spend) || 0) / pay;
      }

      function feeText(spend, gmv) {
        const n = feeRatio(spend, gmv);
        return n == null ? "—" : (n * 100).toFixed(2) + "%";
      }

      function rowFeeText(row) {
        const stored = Number(row.realFeeRatio);
        if (stored > 0) {
          const ratio = stored > 1 ? stored / 100 : stored;
          return (ratio * 100).toFixed(2) + "%";
        }
        return feeText(row.spend, row.jingmaiGmv);
      }

      function shanghaiHour() {
        const text = new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Shanghai",
          hour: "2-digit",
          hourCycle: "h23"
        }).format(new Date());
        const hour = Number(String(text).slice(0, 2));
        return hour === 24 ? 0 : hour || 0;
      }

      function flatHours(ratio) {
        const out = [];
        const n = Number(ratio) || 0;
        for (let i = 0; i < 24; i += 1) {
          out.push(n);
        }
        return out;
      }

      function shopKey(value) {
        return String(value || "").replace(/\s+/g, "").toLowerCase();
      }

      function hourList(map) {
        const out = [];
        for (let hour = 0; hour < 24; hour += 1) {
          const key = String(hour).padStart(2, "0") + ":00";
          out.push(Number(map && map[key]) || 0);
        }
        return out;
      }

      function sumHourSeries(rows, field) {
        const out = [];
        for (let hour = 0; hour < 24; hour += 1) {
          out.push(0);
        }
        (rows || []).forEach(function (row) {
          const list = row[field] || [];
          for (let hour = 0; hour < 24; hour += 1) {
            out[hour] += Number(list[hour]) || 0;
          }
        });
        return out;
      }

      function mapShenShops(data) {
        const rows = ((data && data.shops) || [])
          .filter(function (shop) {
            const name = String(shop.name || "").trim();
            return shop.kind === "店铺" && shop.pack === "沈子晗包" && name && !/包$/.test(name);
          })
          .map(function (shop) {
            const bundle = String(shop.bundle || "").replace(/包$/, "");
            return {
              store: String(shop.name || "").trim(),
              owner: bundle || "沈子晗",
              spend: null,
              jingmaiGmv: null,
              yesterdayGmv: null,
              profit: null,
              roi: null,
              realFeeRatio: null,
              todayHours: [],
              yesterdayHours: [],
              linked: false
            };
          });
        return { asOf: "", rows: rows };
      }

      function operatorTeams() {
        const names = [];
        const seen = {};
        overviewRows.forEach(function (row) {
          const name = row.owner || "未分配";
          if (seen[name]) {
            return;
          }
          seen[name] = true;
          names.push(name);
        });
        names.sort(function (a, b) {
          return a.localeCompare(b, "zh");
        });
        return names;
      }

      function teamOf(store) {
        const row = overviewRows.find(function (item) {
          return item.store === store;
        });
        return (row && row.owner) || "未分配";
      }

      function feeTargetOf(store) {
        try {
          const n = Number(JSON.parse(localStorage.getItem(FEE_STORE) || "{}")[store]);
          return isFinite(n) && n >= 0 ? n : null;
        } catch (_err) {
          return null;
        }
      }

      function feeHot(row) {
        const target = feeTargetOf(row.store);
        const n = feeRatio(row.spend, row.jingmaiGmv);
        return target != null && n != null && (target > 1 ? n * 100 : n) > target;
      }

      function readCols() {
        const order = COLS.map(function (col) {
          return col[0];
        });
        let hidden = [];
        const widths = {};
        const known = { account: 1, clicks: 1, ctr: 1 };
        order.forEach(function (key) {
          known[key] = 1;
        });
        try {
          const saved = JSON.parse(localStorage.getItem(COL_STORE) || "null");
          if (saved && saved.order) {
            const next = [];
            saved.order.forEach(function (key) {
              if (known[key] && next.indexOf(key) < 0) {
                next.push(key);
              }
            });
            order.forEach(function (key) {
              if (next.indexOf(key) >= 0) {
                return;
              }
              const at = key === "target" ? next.indexOf("fee") : -1;
              next.splice(at < 0 ? next.length : at + 1, 0, key);
            });
            order.splice(0, order.length);
            next.forEach(function (key) {
              order.push(key);
            });
            hidden = (saved.hidden || []).filter(function (key) {
              return known[key];
            });
          }
          const raw = saved && saved.widths;
          if (raw) {
            Object.keys(raw).forEach(function (key) {
              const n = Math.round(Number(raw[key]));
              if ((key === "name" || known[key]) && n >= 48 && n <= 480) {
                widths[key] = n;
              }
            });
          }
        } catch (_err) {}
        if (Object.keys(widths).length && !widths.target) {
          widths.target = 112;
        }
        return { order: order, hidden: hidden, widths: widths };
      }

      function shownKeys() {
        const state = readCols();
        return state.order.filter(function (key) {
          return state.hidden.indexOf(key) < 0;
        });
      }

      function colLabel(key) {
        for (let i = 0; i < COLS.length; i += 1) {
          if (COLS[i][0] === key) {
            return COLS[i][1];
          }
        }
        return EXTRA[key] || key;
      }

      function colText(row, key) {
        if (key === "account") {
          return escapeHtml(row.accountId || "—");
        }
        if (key === "spend") {
          return money(row.spend);
        }
        if (key === "orders") {
          return integer(row.paidOrders);
        }
        if (key === "roi") {
          return rate(row.roi);
        }
        if (key === "cvr") {
          return rate(row.cvr);
        }
        if (key === "cpc") {
          return money(row.cpc);
        }
        if (key === "gmv") {
          return money(row.jingmaiGmv);
        }
        if (key === "yest") {
          return money(row.yesterdayGmv);
        }
        if (key === "profit") {
          return money(row.profit);
        }
        if (key === "owner") {
          return escapeHtml(row.owner || "—");
        }
        if (key === "clicks") {
          return integer(row.clicks);
        }
        if (key === "ctr") {
          return rate(row.ctr);
        }
        if (key === "amount") {
          return money(row.totalOrderAmount);
        }
        if (key === "fee") {
          return rowFeeText(row);
        }
        return successTag(row.success);
      }

      function metricCells(row) {
        return shownKeys()
          .map(function (key) {
            if (key === "target") {
              const goal = feeTargetOf(row.store);
              return (
                '<td><input class="xm-sp-fee-target" onkeydown="if(event.keyCode==13)this.blur()" data-fee-shop="' +
                escapeHtml(row.store) +
                '" value="' +
                (goal == null ? "" : goal) +
                '"></td>'
              );
            }
            return "<td" + (key === "fee" && feeHot(row) ? ' class="is-fee-hot"' : "") + ">" + colText(row, key) + "</td>";
          })
          .join("");
      }

      function headerRow(first) {
        const widths = readCols().widths;
        function cell(label, key) {
          const n = widths[key];
          return (
            "<th" +
            (n ? ' style="width:' + n + "px;max-width:" + n + 'px"' : "") +
            ">" +
            label +
            '<i class="xm-sp-col-grip" data-col-grip="' +
            key +
            '"></i></th>'
          );
        }
        return (
          "<thead><tr>" +
          cell(first, "name") +
          shownKeys()
            .map(function (key) {
              return cell(colLabel(key), key);
            })
            .join("") +
          "</tr></thead>"
        );
      }

      function isZeroRow(row) {
        return !(Number(row.spend) || Number(row.paidOrders) || Number(row.jingmaiGmv) || Number(row.clicks));
      }

      function pageRows() {
        return !view.team
          ? overviewRows
          : overviewRows.filter(function (row) {
              return teamOf(row.store) === view.team;
            });
      }

      function scopedRows() {
        let rows = pageRows();
        if (view.liveShop) {
          const key = shopKey(view.liveShop);
          rows = rows.filter(function (row) {
            return row.store === view.liveShop || shopKey(row.store) === key;
          });
        }
        return rows;
      }

      function boardShopNames() {
        const names = [];
        const seen = {};
        pageRows().forEach(function (row) {
          const name = String(row.store || "").trim();
          const key = shopKey(name);
          if (!name || seen[key]) {
            return;
          }
          seen[key] = true;
          names.push(name);
        });
        names.sort();
        return names;
      }

      function hiddenCards() {
        try {
          const raw = JSON.parse(localStorage.getItem(CARD_STORE) || "[]");
          return raw && raw.length ? raw : [];
        } catch (_err) {
          return [];
        }
      }

      function salesOf(rows) {
        let gmv = 0;
        let any = false;
        (rows || []).forEach(function (row) {
          if (row.jingmaiGmv == null) {
            return;
          }
          any = true;
          gmv += Number(row.jingmaiGmv) || 0;
        });
        return { gmv: any ? gmv : null, text: salesText(any ? gmv : null) };
      }

      function feeOf(rows) {
        let spend = 0;
        let gmv = 0;
        let any = false;
        (rows || []).forEach(function (row) {
          if (row.spend == null && row.jingmaiGmv == null) {
            return;
          }
          any = true;
          spend += Number(row.spend) || 0;
          gmv += Number(row.jingmaiGmv) || 0;
        });
        if (!any) {
          return { ratio: null, text: "—" };
        }
        return { ratio: feeRatio(spend, gmv), text: feeText(spend, gmv) };
      }

      function liveLine(series) {
        const width = 640;
        const height = Number(series.height) > 0 ? Number(series.height) : 184;
        const top = 12;
        const bottom = 22;
        const yesterday = series.yesterday || [];
        const today = series.today || [];
        const count = Number(series.hours) > 2 ? Number(series.hours) : Math.max(yesterday.length, today.length, 2);
        let max = 1;
        yesterday.concat(today).forEach(function (n) {
          const v = Number(n) || 0;
          if (v > max) {
            max = v;
          }
        });
        function xAt(index) {
          return 10 + (index / Math.max(count - 1, 1)) * 620;
        }
        function yAt(value) {
          return height - bottom - ((Number(value) || 0) / max) * (height - top - bottom);
        }
        function points(list) {
          return list
            .map(function (value, index) {
              return xAt(index).toFixed(1) + "," + yAt(value).toFixed(1);
            })
            .join(" ");
        }
        let labels = "";
        if (count === 24 || count === 48) {
          for (let hour = 1; hour <= 24; hour += 1) {
            const index = count === 48 ? hour * 2 - 1 : hour - 1;
            labels +=
              '<text x="' +
              xAt(index).toFixed(1) +
              '" y="' +
              (height - 5) +
              '" text-anchor="middle" fill="#8c8c8c" font-size="8">' +
              hour +
              "</text>";
          }
        }
        return (
          '<svg class="xm-hm-line" viewBox="0 0 ' +
          width +
          " " +
          height +
          '" preserveAspectRatio="none">' +
          (yesterday.length
            ? '<polyline fill="none" stroke="#91caff" stroke-width="2" points="' + points(yesterday) + '"></polyline>'
            : "") +
          (today.length
            ? '<polyline fill="none" stroke="#ffa39e" stroke-width="2" points="' + points(today) + '"></polyline>'
            : "") +
          labels +
          "</svg>"
        );
      }

      function livePlot(spec) {
        const yesterday = spec.yesterdayHour || [];
        const today = spec.todayHour || [];
        const hourly = yesterday.length > 2 || today.length > 2;
        if (!hourly) {
          return { yesterday: [], today: [], hours: 0, height: 184 };
        }
        const flat = spec.lineMode === "flat" || spec.unit === "rate";
        function roll(list) {
          let total = 0;
          return list.map(function (n) {
            total += Number(n) || 0;
            return total;
          });
        }
        return {
          yesterday: flat ? yesterday : roll(yesterday),
          today: flat ? today : roll(today),
          hours: 24,
          height: 128
        };
      }

      function liveChart(spec) {
        const plot = livePlot(spec);
        const sub = spec.unit === "rate" ? "线：当天费比" : "线：累计（23点=1-23点）";
        const legs = plot.hours
          ? '<span class="xm-hm-legs"><i class="is-yest"></i>昨天<i class="is-today"></i>今天</span>'
          : "";
        return (
          '<article class="xm-hm-chart" data-chart="' +
          (spec.unit === "rate" ? "fee" : "sales") +
          '"><div class="xm-hm-card-head"><span>' +
          escapeHtml(spec.label) +
          "</span>" +
          legs +
          '</div><div class="xm-hm-index-num">' +
          escapeHtml(spec.value) +
          "</div>" +
          (spec.asOf
            ? '<div class="xm-hm-trend' +
              (String(spec.asOf).indexOf("超过30分钟") >= 0 ? " is-up" : "") +
              '">更新于 ' +
              escapeHtml(spec.asOf) +
              "</div>"
            : "") +
          (plot.hours ? '<div class="xm-hm-chart-sub">' + sub + "</div>" : "") +
          liveLine(plot) +
          "</article>"
        );
      }

      function liveFilterHtml(pick, shops) {
        function option(value, label, on) {
          return (
            '<option value="' +
            escapeHtml(value) +
            '"' +
            (on ? " selected" : "") +
            ">" +
            escapeHtml(label) +
            "</option>"
          );
        }
        return (
          '<div class="xm-hm-live-filter"><div class="xm-hm-live-filter-left"><strong class="xm-hm-live-filter-lab">店铺列表</strong>' +
          '<span class="xm-hm-live-filter-box"><select data-live-filter="pick">' +
          option("", "责权归属", !pick) +
          '<optgroup label="负责人">' +
          operatorTeams().map(function (name) {
            return option("team:" + name, name, pick === "team:" + name);
          }).join("") +
          "</optgroup>" +
          (shops.length
            ? '<optgroup label="店铺">' +
              shops
                .map(function (name) {
                  return option("shop:" + name, name, pick === "shop:" + name);
                })
                .join("") +
              "</optgroup>"
            : "") +
          '</select></span></div><div class="xm-hm-live-filter-right">' +
          '<button type="button" class="xm-hm-live-heads" data-live-heads>表头设置</button>' +
          '<button type="button" class="xm-hm-live-refresh" data-refresh-live>刷新</button></div></div>'
        );
      }

      function renderTabs() {
        function link(hash, label, on) {
          return (
            '<a class="' +
            (on ? "is-active" : "") +
            '" href="' +
            (hash || "#") +
            '" data-sp-tab="' +
            escapeHtml(hash) +
            '">' +
            escapeHtml(label) +
            "</a>"
          );
        }
        tabsEl.innerHTML =
          link("", "全部汇总", !view.team) +
          operatorTeams()
            .map(function (name) {
              return link("team=" + encodeURIComponent(name), name, view.team === name);
            })
            .join("");
      }

      function latestStamp(data) {
        let best = "";
        (data.rows || overviewRows).forEach(function (row) {
          const stamp = String(row.ingestedAt || row.capturedAt || "");
          if (stamp > best) {
            best = stamp;
          }
        });
        return clockText(best) || (data && (data.asOf || data.capturedAt)) || "";
      }

      function paintAsof(data) {
        const stamp = latestStamp(data || {});
        const scoped = scopedRows();
        const stale = overviewStale;
        const meta = asofEl && asofEl.parentElement;
        if (meta) {
          meta.classList.toggle("is-stale", stale);
        }
        const roster = enabledStores;
        let text = stamp
          ? "京麦 " +
            stamp +
            " · " +
            (view.team || "全部") +
            " " +
            scoped.length +
            " 店"
          : "沈子晗包 · " + (view.team || "全部") + " " + scoped.length + " 店 · 京麦未接入";
        if (stale) {
          text += " · 已超过30分钟没有更新";
        }
        if (asofEl) {
          asofEl.textContent = text;
        }
      }

      function markStale(data) {
        const clock = latestStamp(data || {});
        if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(clock)) {
          overviewStale = false;
          return;
        }
        const parsed = Date.parse(clock.replace(" ", "T") + "+08:00");
        overviewStale = isFinite(parsed) && Date.now() - parsed > 30 * 60 * 1000;
      }

      function renderLiveBoard() {
        const pageNow = scopedRows();
        const pageSales = salesOf(pageNow);
        const pageFee = feeOf(pageNow);
        const feeHour = shanghaiHour();
        let pageSpend = 0;
        let pageGmv = 0;
        let linked = false;
        pageNow.forEach(function (row) {
          if (row.spend == null && row.jingmaiGmv == null) {
            return;
          }
          linked = true;
          pageSpend += Number(row.spend) || 0;
          pageGmv += Number(row.jingmaiGmv) || 0;
        });
        if (!linked) {
          pageSpend = null;
          pageGmv = null;
        }
        const hero = {
          label: "京麦成交额",
          value: pageSales.text,
          asOf: clockText(overviewAsOf),
          yesterdayHour: linked ? sumHourSeries(pageNow, "yesterdayHours") : [],
          todayHour: linked ? sumHourSeries(pageNow, "todayHours") : []
        };
        if (overviewStale && hero.asOf) {
          hero.asOf += " · 超过30分钟未更新";
        }
        const paid = {
          label: "真实费比",
          value: pageFee.text,
          unit: "rate",
          lineMode: "flat",
          yesterdayHour: [],
          todayHour: pageFee.ratio == null ? [] : flatHours(pageFee.ratio).slice(0, Math.min(24, feeHour + 1))
        };
        const cards = LIVE_CARDS.map(function (card) {
          const next = { key: card.key, label: card.label, value: "—", extra: "" };
          if (card.key === "ad") {
            next.value = salesText(linked ? pageSpend : null);
            next.extra = linked ? "推广占比 " + pageFee.text : "";
          }
          if (card.key === "roi") {
            next.value = linked && pageSpend > 0 ? (pageGmv / pageSpend).toFixed(2) : "—";
          }
          if (card.key === "livePay") {
            next.value = salesText(linked ? pageGmv : null);
          }
          if (card.key === "livePaid") {
            next.value = liveInt(pageNow.length);
          }
          return next;
        });
        const hidden = {};
        hiddenCards().forEach(function (key) {
          hidden[key] = true;
        });
        const shownCards = cards.filter(function (card) {
          return !hidden[card.key];
        });
        const shops = boardShopNames();
        const pick = view.liveShop ? "shop:" + view.liveShop : view.team ? "team:" + view.team : "";
        const colState = readCols();
        const openPop = keepColsOpen;
        keepColsOpen = false;
        boardEl.hidden = false;
        kpiEl.hidden = true;
        kpiEl.innerHTML = "";
        boardEl.innerHTML =
          liveFilterHtml(pick, shops) +
          '<div class="xm-hm-head-pop"' +
          (openPop ? "" : " hidden") +
          "><h3>表头设置</h3>" +
          cards
            .map(function (card) {
              return (
                '<label><input type="checkbox" data-live-card="' +
                escapeHtml(card.key) +
                '"' +
                (hidden[card.key] ? "" : " checked") +
                "> " +
                escapeHtml(card.label) +
                "</label>"
              );
            })
            .join("") +
          "<h3>表格列</h3>" +
          colState.order
            .map(function (key) {
              return (
                '<div class="xm-hm-col"><label><input type="checkbox" data-live-col="' +
                key +
                '"' +
                (colState.hidden.indexOf(key) < 0 ? " checked" : "") +
                "> " +
                colLabel(key) +
                '</label><button type="button" data-col-move="' +
                key +
                '" data-dir="-1">上</button><button type="button" data-col-move="' +
                key +
                '" data-dir="1">下</button></div>'
              );
            })
            .join("") +
          "</div>" +
          '<div class="xm-hm-live-charts">' +
          liveChart(hero) +
          liveChart(paid) +
          "</div>" +
          '<div class="xm-hm-live-cards">' +
          shownCards
            .map(function (card) {
              return (
                '<article class="xm-hm-card" data-card="' +
                escapeHtml(card.key) +
                '"><div class="xm-hm-card-head"><span>' +
                escapeHtml(card.label) +
                '</span></div><div class="xm-hm-value">' +
                escapeHtml(card.value) +
                "</div>" +
                (card.extra ? '<div class="xm-hm-trend">' + escapeHtml(card.extra) + "</div>" : "") +
                "</article>"
              );
            })
            .join("") +
          "</div>";

        const select = boardEl.querySelector("[data-live-filter]");
        if (select) {
          select.addEventListener("change", function () {
            const value = select.value || "";
            if (value.indexOf("team:") === 0) {
              writeHash({ team: value.slice(5), liveShop: "", store: "" });
            } else if (value.indexOf("shop:") === 0) {
              writeHash({ liveShop: value.slice(5), team: "", store: "" });
            } else {
              writeHash({ team: "", liveShop: "", store: "" });
            }
          });
        }
        const refresh = boardEl.querySelector("[data-refresh-live]");
        if (refresh) {
          refresh.addEventListener("click", function () {
            refresh.disabled = true;
            refresh.textContent = "刷新中…";
            load().catch(function (err) {
              if (!dead) {
                setStatus(err.message || "加载失败", true);
              }
            });
          });
        }
        const heads = boardEl.querySelector("[data-live-heads]");
        const pop = boardEl.querySelector(".xm-hm-head-pop");
        if (heads && pop) {
          heads.addEventListener("click", function () {
            pop.hidden = !pop.hidden;
          });
        }
        boardEl.querySelectorAll("[data-live-card]").forEach(function (box) {
          box.addEventListener("change", function () {
            const off = [];
            boardEl.querySelectorAll("[data-live-card]").forEach(function (item) {
              if (!item.checked) {
                off.push(item.getAttribute("data-live-card"));
              }
            });
            try {
              localStorage.setItem(CARD_STORE, JSON.stringify(off));
            } catch (_err) {}
            renderLiveBoard();
          });
        });
        const historyBox = boardEl.querySelector("[data-live-history]");
        if (historyBox) {
          historyBox.addEventListener("change", function () {
            includeHistory = historyBox.checked;
            writeHash({ history: includeHistory, store: "" }, true);
            load();
          });
        }
        function storeCols(state) {
          try {
            localStorage.setItem(COL_STORE, JSON.stringify(state));
          } catch (_err) {}
          keepColsOpen = true;
          renderLiveBoard();
          const wrap = root.querySelector("#paid-table");
          if (wrap) {
            wrap.innerHTML = renderLiveTables();
          }
        }
        if (pop) {
          pop.addEventListener("click", function (event) {
            const btn = event.target.closest("[data-col-move]");
            if (!btn) {
              return;
            }
            event.preventDefault();
            const state = readCols();
            const key = btn.getAttribute("data-col-move");
            const index = state.order.indexOf(key);
            const next = index + Number(btn.getAttribute("data-dir"));
            if (index < 0 || next < 0 || next >= state.order.length) {
              return;
            }
            const swap = state.order[index];
            state.order[index] = state.order[next];
            state.order[next] = swap;
            storeCols(state);
          });
          pop.addEventListener("change", function (event) {
            const box = event.target.closest("[data-live-col]");
            if (!box) {
              return;
            }
            const state = readCols();
            const key = box.getAttribute("data-live-col");
            state.hidden = state.hidden.filter(function (item) {
              return item !== key;
            });
            if (!box.checked) {
              state.hidden.push(key);
            }
            storeCols(state);
          });
        }
      }

      function paintWidths(widths) {
        const keys = ["name"].concat(shownKeys());
        let sum = 0;
        keys.forEach(function (key) {
          sum += widths[key] || 0;
        });
        root.querySelectorAll("table.xm-sp-live-grid").forEach(function (table) {
          table.classList.add("is-sized");
          if (sum) {
            table.style.width = sum + "px";
          }
          table.querySelectorAll("thead th").forEach(function (th, i) {
            const n = widths[keys[i]];
            if (!n) {
              return;
            }
            th.style.width = n + "px";
            th.style.maxWidth = n + "px";
          });
        });
      }

      function renderGroupTable(rows) {
        if (!rows.length) {
          return '<p class="empty">该组还没有回传</p>';
        }
        const widths = readCols().widths;
        let sum = 0;
        ["name"].concat(shownKeys()).forEach(function (key) {
          sum += widths[key] || 0;
        });
        return (
          '<div class="xm-paid-table-wrap"><table class="xm-sp-live-grid' +
          (sum ? " is-sized" : "") +
          '"' +
          (sum ? ' style="width:' + sum + 'px"' : "") +
          ">" +
          headerRow("店铺名称") +
          "<tbody>" +
          rows
            .map(function (row) {
              return (
                '<tr class="' +
                (isZeroRow(row) ? "is-zero" : "") +
                '"><td><a class="xm-paid-store" href="#store=' +
                encodeURIComponent(row.store) +
                '">' +
                escapeHtml(row.store) +
                '</a><span class="xm-paid-date">' +
                escapeHtml(shopStamp(row)) +
                "</span></td>" +
                metricCells(row) +
                "</tr>"
              );
            })
            .join("") +
          "</tbody></table></div>"
        );
      }

      function renderLiveTables() {
        const rows = scopedRows();
        const title = view.team || "全部汇总";
        const groupRows = view.team
          ? rows.filter(function (row) {
              return teamOf(row.store) === view.team;
            })
          : rows;
        return (
          '<section class="xm-sp-live-group"><h3>' +
          escapeHtml(title) +
          "<span>" +
          groupRows.length +
          "店</span></h3>" +
          renderGroupTable(groupRows) +
          "</section>"
        );
      }

      function renderOverview(data) {
        overviewRows = data.rows || [];
        enabledStores = data.enabledStores || [];
        markStale(data);
        renderTabs();
        paintAsof(data);
        renderLiveBoard();
        bodyEl.innerHTML =
          '<section class="panel"><div id="paid-table">' + renderLiveTables() + "</div></section>";
      }

      function renderKpis(metrics) {
        const cards = [
          {
            label: metrics.subs ? "子账号" : metrics.detail ? "抓取天数" : "店铺数",
            value: integer(metrics.stores),
            unit: metrics.subs ? "个" : metrics.detail ? "天" : "家"
          },
          { label: "京准通花费", value: money(metrics.spend) },
          { label: "京麦成交", value: money(metrics.jingmaiGmv) },
          { label: "总订单金额", value: money(metrics.totalOrderAmount) },
          { label: "付费订单", value: integer(metrics.paidOrders), unit: "单" },
          {
            label: metrics.detail ? "成功回传" : "回传成功",
            value: integer(metrics.successCount),
            unit: metrics.detail ? "天" : "店"
          }
        ];
        kpiEl.hidden = false;
        boardEl.hidden = true;
        kpiEl.innerHTML = cards
          .map(function (card) {
            return (
              '<article class="kpi-card"><div class="label">' +
              escapeHtml(card.label) +
              '</div><div class="value">' +
              card.value +
              (card.unit ? '<span class="unit">' + escapeHtml(card.unit) + "</span>" : "") +
              "</div></article>"
            );
          })
          .join("");
      }

      function subCells(row) {
        return (
          "<td>" +
          money(row.balance) +
          "</td><td>" +
          escapeHtml(row.remark || "—") +
          "</td><td>" +
          money(row.spend) +
          "</td><td>" +
          rate(row.roi) +
          "</td><td>" +
          integer(row.paidOrders) +
          "</td><td>" +
          money(row.totalOrderAmount) +
          "</td><td>" +
          integer(row.impressions) +
          "</td><td>" +
          integer(row.clicks) +
          "</td><td>" +
          rate(row.ctr) +
          "</td><td>" +
          money(row.cpc) +
          "</td>"
        );
      }

      function renderSubaccounts(accounts) {
        if (!accounts.length) {
          return '<p class="empty">本地程序尚未回传子账号明细</p>';
        }
        const body = accounts
          .map(function (group, index) {
            const latest = group.latest || {};
            const days = group.days || [];
            const dayRows = days
              .map(function (row) {
                return (
                  "<tr><td>" +
                  escapeHtml(shortStamp(row.capturedAt || row.ingestedAt || row.date)) +
                  "</td>" +
                  subCells(row) +
                  "</tr>"
                );
              })
              .join("");
            return (
              '<tr class="xm-paid-sub-row" data-sub-index="' +
              index +
              '"><td><button type="button" class="xm-paid-expand" aria-expanded="false" data-sub-index="' +
              index +
              '">▸</button><span class="xm-paid-sub-name">' +
              escapeHtml(group.subAccountName || group.subAccountId) +
              '</span><span class="xm-paid-date">' +
              escapeHtml(group.subAccountId) +
              (latest.capturedAt || latest.date ? " · " + shortStamp(latest.capturedAt || latest.date) : "") +
              "</span></td>" +
              subCells(latest) +
              "</tr>" +
              '<tr class="xm-paid-sub-history" data-sub-index="' +
              index +
              '" hidden><td colspan="11"><div class="xm-paid-nested"><p class="lead">该子账号各时间段明细</p><table><thead><tr>' +
              "<th>时间段</th><th>余额</th><th>账户备注</th><th>花费</th><th>投产比</th><th>单量</th>" +
              "<th>订单金额</th><th>展现数</th><th>点击数</th><th>点击率</th><th>平均点击成本</th>" +
              "</tr></thead><tbody>" +
              dayRows +
              "</tbody></table></div></td></tr>"
            );
          })
          .join("");
        return (
          '<div class="xm-paid-table-wrap"><table><thead><tr>' +
          "<th>子账号</th><th>余额</th><th>账户备注</th><th>花费</th><th>投产比</th><th>单量</th>" +
          "<th>订单金额</th><th>展现数</th><th>点击数</th><th>点击率</th><th>平均点击成本</th>" +
          "</tr></thead><tbody>" +
          body +
          "</tbody></table></div>"
        );
      }

      function renderDetail(store, paid, subaccounts, recharge) {
        const rows = paid.rows || [];
        const latest = rows[0] || { store: store };
        const accounts = subaccounts.accounts || [];
        const subTotals = subaccounts.totals || {};
        if (barEl) {
          barEl.hidden = true;
        }
        asofEl.textContent =
          (latest.accountId ? "京准通主账户 " + latest.accountId + " · " : "") +
          (accounts.length || 0) +
          " 个子账号";
        renderKpis({
          detail: true,
          subs: true,
          stores: accounts.length || rows.length,
          spend: subTotals.spend || latest.spend,
          jingmaiGmv: latest.jingmaiGmv,
          totalOrderAmount: subTotals.totalOrderAmount || latest.totalOrderAmount,
          paidOrders: subTotals.paidOrders || latest.paidOrders,
          successCount: (paid.metrics || {}).successCount
        });
        const rechargeRows = recharge.rows || [];
        const rechargeTable = rechargeRows.length
          ? '<div class="xm-paid-table-wrap"><table><thead><tr>' +
            "<th>充值时间</th><th>子账号名称</th><th>充值金额</th><th>账户余额</th>" +
            "</tr></thead><tbody>" +
            rechargeRows
              .map(function (row) {
                return (
                  "<tr><td>" +
                  escapeHtml(shortStamp(row.chargedAt || row.date)) +
                  "</td><td>" +
                  recorded(row.subAccountName) +
                  "</td><td>" +
                  money(row.amount) +
                  "</td><td>" +
                  money(row.balance) +
                  "</td></tr>"
                );
              })
              .join("") +
            "</tbody></table></div>"
          : '<p class="empty">暂无充值记录，本地程序回传后在此展示</p>';
        bodyEl.innerHTML =
          '<section class="panel"><div class="xm-paid-toolbar"><div class="xm-paid-toolbar-left">' +
          '<button type="button" class="xm-paid-back" id="paid-back">返回付费中心</button>' +
          "<h2>" +
          escapeHtml(store) +
          "</h2></div></div></section>" +
          '<div class="xm-paid-detail-grid">' +
          '<section class="panel"><h2>子账号</h2>' +
          renderSubaccounts(accounts) +
          "</section>" +
          '<section class="panel"><h2>充值记录</h2><p class="lead">累计充值 ' +
          money((recharge.totals || {}).amount) +
          " · " +
          integer((recharge.totals || {}).count) +
          " 笔</p>" +
          rechargeTable +
          "</section></div>";
        const back = root.querySelector("#paid-back");
        if (back) {
          back.addEventListener("click", function () {
            writeHash({ store: "" });
          });
        }
        Array.prototype.forEach.call(root.querySelectorAll(".xm-paid-expand"), function (btn) {
          btn.addEventListener("click", function () {
            const index = btn.getAttribute("data-sub-index");
            const history = root.querySelector('.xm-paid-sub-history[data-sub-index="' + index + '"]');
            if (!history) {
              return;
            }
            const open = history.hasAttribute("hidden");
            history.toggleAttribute("hidden", !open);
            btn.setAttribute("aria-expanded", open ? "true" : "false");
            btn.textContent = open ? "▾" : "▸";
          });
        });
      }

      function getJson(url) {
        return fetch(url, { credentials: "same-origin" }).then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (data) {
            if (!res.ok) {
              throw new Error(data.error || "无法加载付费数据");
            }
            return data;
          });
        });
      }

      function renderJingmaiShop(store) {
        const row = overviewRows.find(function (item) {
          return item.store === store;
        });
        if (barEl) {
          barEl.hidden = true;
        }
        boardEl.hidden = true;
        kpiEl.hidden = true;
        if (!row) {
          bodyEl.innerHTML =
            '<section class="panel"><button type="button" class="xm-paid-back" id="paid-back">返回付费中心</button>' +
            '<p class="empty">服务器京麦里没有这家店</p></section>';
        } else {
          const hours = hourList(null)
            .map(function (_n, index) {
              const label = String(index).padStart(2, "0") + ":00";
              return (
                "<tr><td>" +
                label +
                "</td><td>" +
                money(row.todayHours[index]) +
                "</td><td>" +
                money(row.yesterdayHours[index]) +
                "</td></tr>"
              );
            })
            .join("");
          bodyEl.innerHTML =
            '<section class="panel"><div class="xm-paid-toolbar"><div class="xm-paid-toolbar-left">' +
            '<button type="button" class="xm-paid-back" id="paid-back">返回付费中心</button><h2>' +
            escapeHtml(row.store) +
            "</h2></div></div><p class=\"lead\">" +
            escapeHtml(row.owner) +
            " · 今日成交 " +
            money(row.jingmaiGmv) +
            " · 昨日成交 " +
            money(row.yesterdayGmv) +
            " · 推广花费 " +
            money(row.spend) +
            "</p></section>" +
            '<section class="panel"><h2>小时成交</h2><div class="xm-paid-table-wrap"><table><thead><tr>' +
            "<th>小时</th><th>今天</th><th>昨天</th></tr></thead><tbody>" +
            hours +
            "</tbody></table></div></section>";
        }
        const back = root.querySelector("#paid-back");
        if (back) {
          back.addEventListener("click", function () {
            writeHash({ store: "" });
          });
        }
      }

      function load() {
        view = parseHash();
        setStatus("正在加载…");
        return getJson("/api/people/shops")
          .then(function (data) {
            if (dead) {
              return;
            }
            const mapped = mapShenShops(data);
            overviewRows = mapped.rows;
            overviewAsOf = "";
            overviewStale = false;
            if (view.store) {
              renderJingmaiShop(view.store);
            } else {
              if (barEl) {
                barEl.hidden = false;
              }
              renderOverview({ asOf: "", rows: mapped.rows });
            }
            setStatus("已更新 · 沈子晗包 " + mapped.rows.length + " 店，京麦还没有这些店的数据");
          })
          .catch(function (err) {
            if (!dead) {
              setStatus(err.message || "店铺名单加载失败", true);
            }
          });
      }

      function onHash() {
        load();
      }

      bodyEl.addEventListener("pointerdown", function (event) {
        const grip = event.target.closest("[data-col-grip]");
        if (!grip) {
          return;
        }
        event.preventDefault();
        const key = grip.getAttribute("data-col-grip");
        const state = readCols();
        const table = grip.closest("table");
        if (!Object.keys(state.widths).length && table) {
          const keys = ["name"].concat(shownKeys());
          table.querySelectorAll("thead th").forEach(function (th, i) {
            if (keys[i]) {
              state.widths[keys[i]] = Math.max(48, Math.round(th.getBoundingClientRect().width));
            }
          });
        }
        const startX = event.clientX;
        const startW = state.widths[key] || Math.round(grip.parentNode.getBoundingClientRect().width);
        function move(ev) {
          if (dead) {
            up();
            return;
          }
          state.widths[key] = Math.max(48, Math.min(480, Math.round(startW + ev.clientX - startX)));
          paintWidths(state.widths);
        }
        function up() {
          document.removeEventListener("pointermove", move);
          document.removeEventListener("pointerup", up);
          try {
            localStorage.setItem(COL_STORE, JSON.stringify(state));
          } catch (_err) {}
        }
        document.addEventListener("pointermove", move);
        document.addEventListener("pointerup", up);
        paintWidths(state.widths);
      });

      bodyEl.addEventListener("change", function (event) {
        const box = event.target.closest("[data-fee-shop]");
        if (!box) {
          return;
        }
        const store = box.getAttribute("data-fee-shop");
        const raw = box.value.replace(/[%％]/g, "").trim();
        let saved = {};
        try {
          saved = JSON.parse(localStorage.getItem(FEE_STORE) || "{}") || {};
        } catch (_err) {}
        const n = Number(raw);
        if (!raw) {
          delete saved[store];
        } else if (isFinite(n) && n >= 0) {
          saved[store] = n;
        } else {
          return;
        }
        try {
          localStorage.setItem(FEE_STORE, JSON.stringify(saved));
        } catch (_err) {}
        const wrap = root.querySelector("#paid-table");
        if (wrap) {
          wrap.innerHTML = renderLiveTables();
        }
      });

      tabsEl.addEventListener("click", function (event) {
        const link = event.target.closest("[data-sp-tab]");
        if (!link) {
          return;
        }
        event.preventDefault();
        const hash = link.getAttribute("data-sp-tab") || "";
        if (hash.indexOf("team=") === 0) {
          writeHash({ team: decodeURIComponent(hash.slice(5)), liveShop: "", store: "" });
        } else {
          writeHash({ team: "", liveShop: "", store: "" });
        }
      });

      window.addEventListener("hashchange", onHash);
      load();
      return function unmount() {
        dead = true;
        window.removeEventListener("hashchange", onHash);
        root.innerHTML = "";
      };
    }
  };
  window.XmModules["/shen/training"] = waitPage("培训系统");
  window.XmModules["/shen/tasks"] = waitPage("任务管理");

  window.XmModules["/shen"] = {
    mount: function (root) {
      root.innerHTML =
        '<main class="page">' +
        '<header class="page-head"><p class="kicker">沈子晗团队</p><h1>沈子晗运营中心</h1>' +
        '<p class="lead">任务和今日简报写入数据库，与韩梦凯中心隔离。进程重启后记录还在。</p></header>' +
        '<div class="stack">' +
        '<section class="panel" aria-labelledby="task-heading"><h2 id="task-heading">任务列表</h2>' +
        '<form id="task-form"><label for="task-title">任务标题（必填）</label><div class="row">' +
        '<input id="task-title" name="title" type="text" required maxlength="200" placeholder="例如：跟进今日达人排期" />' +
        '<button type="submit">新增任务</button></div></form>' +
        '<p id="task-status" class="status" role="status"></p><div id="task-table-wrap"><p class="empty">暂无任务</p></div></section>' +
        '<section class="panel" aria-labelledby="brief-heading"><h2 id="brief-heading">今日简报</h2>' +
        '<form id="brief-form"><label for="brief-text">简报内容</label>' +
        '<textarea id="brief-text" name="text" placeholder="记录今天的进展、风险与需要协调的事项"></textarea>' +
        '<div class="row"><button type="submit">保存简报</button></div></form>' +
        '<p id="brief-status" class="status" role="status"></p></section></div></main>';

      const taskForm = root.querySelector("#task-form");
      const taskTitle = root.querySelector("#task-title");
      const taskStatus = root.querySelector("#task-status");
      const taskTableWrap = root.querySelector("#task-table-wrap");
      const briefForm = root.querySelector("#brief-form");
      const briefText = root.querySelector("#brief-text");
      const briefStatus = root.querySelector("#brief-status");
      let dead = false;

      function setStatus(el, message, isError) {
        el.textContent = message || "";
        el.className = "status" + (isError ? " error" : message ? " ok" : "");
      }

      function renderTasks(tasks) {
        if (!tasks.length) {
          taskTableWrap.innerHTML = '<p class="empty">暂无任务</p>';
          return;
        }
        const rows = tasks
          .map(function (task) {
            return (
              "<tr><td>" +
              escapeHtml(task.title) +
              "</td><td>" +
              escapeHtml(task.status) +
              "</td><td>" +
              escapeHtml(task.owner) +
              "</td></tr>"
            );
          })
          .join("");
        taskTableWrap.innerHTML =
          "<table><thead><tr><th>标题</th><th>状态</th><th>负责人</th></tr></thead><tbody>" +
          rows +
          "</tbody></table>";
      }

      async function loadTasks() {
        const res = await fetch("/api/shen/tasks", { credentials: "same-origin" });
        if (!res.ok) {
          throw new Error("无法加载任务");
        }
        const data = await res.json();
        if (!dead) {
          renderTasks(Array.isArray(data) ? data : data.tasks || []);
        }
      }

      async function loadBrief() {
        const res = await fetch("/api/shen/brief", { credentials: "same-origin" });
        if (!res.ok) {
          throw new Error("无法加载简报");
        }
        const data = await res.json();
        if (!dead) {
          briefText.value = data.text || "";
        }
      }

      function onTask(event) {
        event.preventDefault();
        const title = taskTitle.value.trim();
        if (!title) {
          setStatus(taskStatus, "请填写任务标题", true);
          return;
        }
        setStatus(taskStatus, "正在保存…");
        fetch("/api/shen/tasks", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title })
        })
          .then(function (res) {
            return res.json().catch(function () { return {}; }).then(function (data) {
              if (!res.ok) {
                throw new Error(data.error || "新增失败");
              }
            });
          })
          .then(function () {
            taskTitle.value = "";
            return loadTasks();
          })
          .then(function () {
            if (!dead) {
              setStatus(taskStatus, "已新增任务");
            }
          })
          .catch(function (err) {
            if (!dead) {
              setStatus(taskStatus, err.message || "新增失败", true);
            }
          });
      }

      function onBrief(event) {
        event.preventDefault();
        setStatus(briefStatus, "正在保存…");
        fetch("/api/shen/brief", {
          method: "PUT",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: briefText.value })
        })
          .then(function (res) {
            return res.json().catch(function () { return {}; }).then(function (data) {
              if (!res.ok) {
                throw new Error(data.error || "保存失败");
              }
              return data;
            });
          })
          .then(function (data) {
            if (!dead) {
              briefText.value = data.text || briefText.value;
              setStatus(briefStatus, "简报已保存");
            }
          })
          .catch(function (err) {
            if (!dead) {
              setStatus(briefStatus, err.message || "保存失败", true);
            }
          });
      }

      taskForm.addEventListener("submit", onTask);
      briefForm.addEventListener("submit", onBrief);
      Promise.all([loadTasks(), loadBrief()]).catch(function (err) {
        if (!dead) {
          setStatus(taskStatus, err.message || "加载失败", true);
        }
      });

      return function unmount() {
        dead = true;
        taskForm.removeEventListener("submit", onTask);
        briefForm.removeEventListener("submit", onBrief);
        root.innerHTML = "";
      };
    }
  };
})();
