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

  window.XmModules["/shen/jingcang"] = {
    mount: function (root) {
      const css = document.querySelector('link[href^="/shared/shen-jingcang.css"]') || document.createElement("link");
      css.rel = "stylesheet";
      css.href = "/shared/shen-jingcang.css?v=0.1.864-jingcang-rasw";
      if (!css.parentNode) {
        document.head.appendChild(css);
      }

      const GROUPS = ["杨润泽组", "张文静组", "高丽男组", "张鹏组"];
      const SHOPS = [
        ["杨润泽组", "RASW潮流生活旗舰店"],
        ["张文静组", "RASW家居旗舰店"],
        ["张文静组", "RASW生活电器旗舰"],
        ["张文静组", "RASW健康电器旗舰店"],
        ["高丽男组", "HYEGIIR健康器械旗舰店"],
        ["高丽男组", "HYEGIIR养生器械旗舰店"],
        ["高丽男组", "DIKTT个护健康旗舰店"],
        ["高丽男组", "HYEGIIR医疗保健旗舰店"],
        ["张鹏组", "飒望旗舰店"],
        ["张鹏组", "SAWAAG生活日用旗舰店"],
        ["张鹏组", "飒望居家旗舰店"],
        ["张鹏组", "MGXEK旗舰店"]
      ];
      const GOODS = [
        {
          shop: "RASW潮流生活旗舰店",
          name: "RASW【德国】婴儿理发器超静音自动吸发",
          spu: "100290230908",
          sku: "1023541407306",
          code: "RXF-T",
          status: "在售",
          mark: "截图样例",
          image: "/shared/jingcang-sample.png",
          warehouses: [
            { name: "商家全国仓", kind: "商家仓", qty: 99999 },
            { name: "无锡常温C平台仓13号库-CHN", kind: "京东仓", qty: 36 },
            { name: "廊坊常温C平台仓5号库-CHN", kind: "京东仓", qty: 11 },
            { name: "北京常温C平台仓55号库-CHN", kind: "京东仓", qty: 45 }
          ]
        },
        {
          shop: "RASW家居旗舰店",
          name: "样例商品 · 家居",
          spu: "100000000101",
          sku: "10000000010101",
          code: "DEMO-JJ",
          status: "在售",
          mark: "版式样例",
          warehouses: [
            { name: "商家全国仓", kind: "商家仓", qty: 860 },
            { name: "广州常温C平台仓2号库-CHN", kind: "京东仓", qty: 24 }
          ]
        },
        {
          shop: "HYEGIIR健康器械旗舰店",
          name: "样例商品 · 健康",
          spu: "100000000201",
          sku: "10000000020101",
          code: "DEMO-JK",
          status: "在售",
          mark: "版式样例",
          warehouses: [
            { name: "商家全国仓", kind: "商家仓", qty: 120 },
            { name: "成都常温C平台仓1号库-CHN", kind: "京东仓", qty: 6 },
            { name: "北京常温C平台仓55号库-CHN", kind: "京东仓", qty: 3 }
          ]
        },
        {
          shop: "飒望旗舰店",
          name: "样例商品 · 日用",
          spu: "100000000301",
          sku: "10000000030101",
          code: "DEMO-RY",
          status: "在售",
          mark: "版式样例",
          warehouses: [
            { name: "商家全国仓", kind: "商家仓", qty: 40 },
            { name: "廊坊常温C平台仓5号库-CHN", kind: "京东仓", qty: 9 }
          ]
        }
      ];
      let groupWatch = "";
      let query = "";

      function money(value) {
        if (value == null || value === "") {
          return "—";
        }
        return Number(value).toLocaleString("zh-CN");
      }

      function goodsOf(shop) {
        return GOODS.filter(function (row) {
          return row.shop === shop;
        });
      }

      function shownHouses(row) {
        return (row.warehouses || []).filter(function (house) {
          return String(house.name || "").indexOf("全国仓") === -1;
        });
      }

      function totalQty(row) {
        return shownHouses(row).reduce(function (sum, house) {
          return sum + Number(house.qty || 0);
        }, 0);
      }

      function photo(src) {
        if (src) {
          return '<span class="xm-jc-photo"><img src="' + escapeHtml(src) + '" alt="" /></span>';
        }
        return (
          '<span class="xm-jc-photo" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="5" width="16" height="14" rx="2"/><path d="m8 15 2.5-2.5L14 16l2-2 2 2"/><circle cx="9" cy="9" r="1"/></svg></span>'
        );
      }

      function housesFor(rows) {
        const list = [];
        const seen = {};
        rows.forEach(function (row) {
          shownHouses(row).forEach(function (house) {
            const key = house.kind + "\n" + house.name;
            if (seen[key]) {
              return;
            }
            seen[key] = true;
            list.push(house);
          });
        });
        return list;
      }

      function qtyAt(row, house) {
        const hit = shownHouses(row).find(function (item) {
          return item.name === house.name && item.kind === house.kind;
        });
        return hit ? money(hit.qty) : "—";
      }

      function goodsCell(row) {
        return (
          '<div class="xm-jc-goods">' +
          photo(row.image) +
          "<div><strong>" +
          escapeHtml(row.name) +
          '</strong><p><span class="is-on">' +
          escapeHtml(row.status) +
          "</span><span>" +
          escapeHtml(row.mark) +
          "</span>" +
          (row.code ? "<span>货号 " + escapeHtml(row.code) + "</span>" : "") +
          "</p></div></div>"
        );
      }

      function sheet(shopName, rows) {
        const houses = housesFor(rows);
        if (!rows.length) {
          return (
            '<article class="xm-jc-shop"><header><h3>' +
            escapeHtml(shopName) +
            '</h3><p>还没有样例</p></header><div class="xm-jc-wait">' +
            photo() +
            "<div><strong>抓取后显示商品</strong><p>仓名写在上面，每个仓下面是对应数量</p></div></div></article>"
          );
        }
        if (!houses.length) {
          return (
            '<article class="xm-jc-shop"><header><h3>' +
            escapeHtml(shopName) +
            "</h3><p>" +
            rows.length +
            ' 个 SKU</p></header><div class="xm-jc-wait">' +
            rows
              .map(function (row) {
                return goodsCell(row);
              })
              .join("") +
            "</div></article>"
          );
        }
        const style = ' style="--jc-wh:' + houses.length + '"';
        const heads = houses
          .map(function (house) {
            return (
              '<div class="xm-jc-wh-head"><i>' +
              escapeHtml(house.kind) +
              "</i><b>" +
              escapeHtml(house.name) +
              "</b></div>"
            );
          })
          .join("");
        const lines = rows
          .map(function (row) {
            return (
              '<div class="xm-jc-line"' +
              style +
              ">" +
              goodsCell(row) +
              '<div class="xm-jc-code">' +
              escapeHtml(row.spu) +
              '</div><div class="xm-jc-code">' +
              escapeHtml(row.sku) +
              "</div>" +
              houses
                .map(function (house) {
                  return '<div class="xm-jc-wh-qty">' + qtyAt(row, house) + "</div>";
                })
                .join("") +
              '<div class="xm-jc-wh-qty is-total">' +
              money(totalQty(row)) +
              "</div></div>"
            );
          })
          .join("");
        const sum = rows.reduce(function (acc, row) {
          return acc + totalQty(row);
        }, 0);
        return (
          '<article class="xm-jc-shop"><div class="xm-jc-sheet"><div class="xm-jc-line xm-jc-line-head"' +
          style +
          '><div class="xm-jc-shop-title"><h3>' +
          escapeHtml(shopName) +
          "</h3><p>" +
          rows.length +
          " 个 SKU · 可用 " +
          money(sum) +
          '</p></div><div class="xm-jc-code-label">SPU</div><div class="xm-jc-code-label">SKU</div>' +
          heads +
          '<div class="xm-jc-wh-head is-total"><b>可用</b></div></div>' +
          lines +
          "</div></article>"
        );
      }

      function matches(row) {
        if (!query) {
          return true;
        }
        const blob = [row.name, row.spu, row.sku, row.code, row.shop].join(" ").toLowerCase();
        return blob.indexOf(query) !== -1;
      }

      root.innerHTML =
        '<main class="xm-jc" id="jingcang-board"><header class="xm-jc-head"><div><p class="kicker">沈子晗运营中心</p><h1>京仓管理<em data-jc-state>抓取中</em></h1><p class="lead" data-jc-lead>正在抓取 RASW潮流生活旗舰店里商品标签为京东物流的库存。仓名写在上面，每个仓下面是对应数量。其他店铺仍是版式。</p></div></header>' +
        '<section class="xm-jc-kpis"><article><span>分组</span><strong data-jc-kpi="groups">4</strong></article><article><span>店铺</span><strong data-jc-kpi="shops">12</strong></article><article><span>SKU</span><strong data-jc-kpi="sku">0</strong></article><article><span>可用库存</span><strong data-jc-kpi="stock">0</strong></article></section>' +
        '<div class="xm-jc-bar"><nav class="xm-jc-tabs" aria-label="分组"><button type="button" data-jc-group="" class="is-on">全部</button>' +
        GROUPS.map(function (name) {
          return '<button type="button" data-jc-group="' + escapeHtml(name) + '">' + escapeHtml(name) + "</button>";
        }).join("") +
        '</nav><label class="xm-jc-search">搜索<input type="search" placeholder="店铺、商品、SPU、SKU" /></label></div>' +
        '<div class="xm-jc-body"></div></main>';
      const bodyEl = root.querySelector(".xm-jc-body");
      const kpiEls = {
        groups: root.querySelector('[data-jc-kpi="groups"]'),
        shops: root.querySelector('[data-jc-kpi="shops"]'),
        sku: root.querySelector('[data-jc-kpi="sku"]'),
        stock: root.querySelector('[data-jc-kpi="stock"]')
      };

      function render() {
        const needle = query;
        const visibleShops = SHOPS.filter(function (pair) {
          if (groupWatch && pair[0] !== groupWatch) {
            return false;
          }
          if (!needle) {
            return true;
          }
          if (pair[1].toLowerCase().indexOf(needle) !== -1) {
            return true;
          }
          return goodsOf(pair[1]).some(matches);
        });
        const cards = GOODS.filter(function (row) {
          return visibleShops.some(function (pair) {
            return pair[1] === row.shop && matches(row);
          });
        });
        const stock = cards.reduce(function (sum, row) {
          return sum + totalQty(row);
        }, 0);
        const groups = GROUPS.filter(function (name) {
          return visibleShops.some(function (pair) {
            return pair[0] === name;
          });
        });
        kpiEls.groups.textContent = String(groups.length);
        kpiEls.shops.textContent = String(visibleShops.length);
        kpiEls.sku.textContent = String(cards.length);
        kpiEls.stock.textContent = money(stock);
        root.querySelectorAll("[data-jc-group]").forEach(function (button) {
          button.classList.toggle("is-on", (button.getAttribute("data-jc-group") || "") === groupWatch);
        });
        bodyEl.innerHTML = groups.length
          ? groups
              .map(function (name) {
                const shops = visibleShops.filter(function (pair) {
                  return pair[0] === name;
                });
                return (
                  '<section class="xm-jc-group"><h2>' +
                  escapeHtml(name) +
                  "<span>" +
                  shops.length +
                  "店</span></h2>" +
                  shops
                    .map(function (pair) {
                      const rows = goodsOf(pair[1]).filter(function (row) {
                        return !needle || pair[1].toLowerCase().indexOf(needle) !== -1 || matches(row);
                      });
                      return sheet(pair[1], rows);
                    })
                    .join("") +
                  "</section>"
                );
              })
              .join("")
          : '<p class="xm-jc-empty">没有符合的店铺或商品</p>';
      }

      root.addEventListener("click", function (event) {
        const button = event.target.closest("[data-jc-group]");
        if (!button || !root.contains(button)) {
          return;
        }
        groupWatch = button.getAttribute("data-jc-group") || "";
        render();
      });
      root.addEventListener("input", function (event) {
        const input = event.target.closest(".xm-jc-search input");
        if (!input) {
          return;
        }
        query = String(input.value || "").trim().toLowerCase();
        render();
      });
      render();
      let alive = true;
      const liveShop = "RASW潮流生活旗舰店";
      const stateEl = root.querySelector("[data-jc-state]");
      const leadEl = root.querySelector("[data-jc-lead]");
      function say(state, lead) {
        if (stateEl) {
          stateEl.textContent = state;
        }
        if (leadEl) {
          leadEl.textContent = lead;
        }
      }
      let pulls = 0;
      function pullStock() {
        if (!alive || pulls > 90) {
          return;
        }
        pulls += 1;
        fetch("/api/shen/jingcang?store=" + encodeURIComponent(liveShop), { headers: { accept: "application/json" } })
        .then(function (res) {
          return res.json();
        })
        .then(function (payload) {
          if (!alive) {
            return;
          }
          if (payload && payload.pending) {
            say("抓取中", "正在从京麦翻 " + liveShop + " 里商品标签为京东物流的库存。");
            setTimeout(pullStock, 2000);
            return;
          }
          const rows = payload && Array.isArray(payload.rows) ? payload.rows : [];
          if (!payload || payload.ok !== true || !rows.length) {
            say("版式", liveShop + " 没抓到：" + ((payload && (payload.error || payload.message)) || "没有库存") + "。下面仍是版式。");
            return;
          }
          for (let index = GOODS.length - 1; index >= 0; index -= 1) {
            if (GOODS[index].shop === liveShop) {
              GOODS.splice(index, 1);
            }
          }
          rows.forEach(function (row) {
            GOODS.push({
              shop: liveShop,
              name: row.name || "",
              spu: row.spu || "",
              sku: row.sku || "",
              code: row.code || "",
              status: row.status || "在售",
              mark: "京东物流",
              image: row.image || "",
              warehouses: Array.isArray(row.warehouses) ? row.warehouses : []
            });
          });
          say(
            "已抓取",
            liveShop +
              " 已抓取商品标签为京东物流的 " +
              rows.length +
              " 个 SKU" +
              (payload.truncated ? "，后面还有没翻完的页" : "") +
              "。全国仓不显示。其他店铺仍是版式。"
          );
          render();
        })
        .catch(function () {
          if (alive) {
            say("版式", "京仓接口没有打开，下面仍是版式。");
          }
        });
      }
      pullStock();
      return function unmount() {
        alive = false;
        root.innerHTML = "";
      };
    }
  };
  window.XmModules["/shen/product"] = waitPage("产品中心");
  window.XmModules["/shen/product/xuanpin"] = waitPage("选品");
  window.XmModules["/shen/product/youhua"] = waitPage("优化");
  window.XmModules["/shen/product/chengzhang"] = waitPage("产品成长");
  window.XmModules["/shen/selection"] = waitPage("选品");
  window.XmModules["/shen/growth"] = waitPage("产品成长");
  window.XmModules["/shen/paid"] = {
    mount: function (root) {
      const paidCss = document.querySelector('link[href^="/shared/shen-paid.css"]') || document.createElement("link");
      paidCss.rel = "stylesheet";
      paidCss.href = "/shared/shen-paid.css?v=0.1.764-paid-online";
      if (!paidCss.parentNode) {
        document.head.appendChild(paidCss);
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
      let feeWatch = "";
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
      let liveUpdatedAt = "";
      let overviewAsOf = "";
      let enabledStores = [];
      let overviewStale = false;
      let keepColsOpen = false;
      let includeHistory = view.history;
      let deskStore = "";
      let deskTimer = 0;

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

      const GROUP_ORDER = ["杨润泽组", "张文静组", "高丽男组", "张鹏组"];

      function groupLabel(name) {
        const text = String(name || "").trim();
        if (!text || text === "未分配") {
          return "未分配";
        }
        return /组$/.test(text) ? text : text + "组";
      }

      function groupRank(name) {
        const index = GROUP_ORDER.indexOf(groupLabel(name));
        return index < 0 ? GROUP_ORDER.length : index;
      }

      function mapShenShops(data) {
        const rows = ((data && data.stores) || [])
          .filter(function (store) {
            const name = String(store.storeName || "").trim();
            return name && (store.team === "沈子晗组" || store.manager === "沈子晗");
          })
          .map(function (store) {
            const operator = String(store.operator || store.owner || "").trim();
            const supervisor = String(store.supervisor || "").trim();
            const reserve = String(store.reserve || "").trim();
            const lead = String(store.lead || "").trim();
            const groupLead = /组$/.test(lead) ? "" : lead;
            const person = supervisor || reserve || groupLead || operator || "未分配";
            const remark = String(store.remark || "").trim();
            return {
              store: String(store.storeName || "").trim(),
              enabled: store.statusKey === "operating" || (store.statusKey == null && store.remark === "运营中"),
              owner: operator || person,
              group: groupLabel(person),
              note: remark && remark !== "运营中" ? remark : "",
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
        rows.sort(function (a, b) {
          return a.store.localeCompare(b.store, "zh");
        });
        return { asOf: "", rows: rows };
      }

      function operatorTeams() {
        const names = [];
        const seen = {};
        overviewRows.forEach(function (row) {
          const name = row.group || row.owner || "未分配";
          if (seen[name]) {
            return;
          }
          seen[name] = true;
          names.push(name);
        });
        names.sort(function (a, b) {
          const diff = groupRank(a) - groupRank(b);
          return diff || a.localeCompare(b, "zh");
        });
        return names;
      }

      function teamOf(store) {
        const row = overviewRows.find(function (item) {
          return item.store === store;
        });
        return (row && (row.group || row.owner)) || "未分配";
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
          return escapeHtml((row.owner || "—") + (row.note ? " · " + row.note : ""));
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
          if (series.gaps && (n == null || !isFinite(Number(n)))) {
            return;
          }
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
          if (series.gaps) {
            const parts = [];
            let current = [];
            list.forEach(function (value, index) {
              if (value == null || !isFinite(Number(value))) {
                if (current.length) {
                  parts.push(current.join(" "));
                }
                current = [];
                return;
              }
              current.push(xAt(index).toFixed(1) + "," + yAt(value).toFixed(1));
            });
            if (current.length) {
              parts.push(current.join(" "));
            }
            return parts;
          }
          return [
            list
              .map(function (value, index) {
                return xAt(index).toFixed(1) + "," + yAt(value).toFixed(1);
              })
              .join(" ")
          ];
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
          points(yesterday)
            .filter(Boolean)
            .map(function (line) {
              return '<polyline fill="none" stroke="#91caff" stroke-width="2" points="' + line + '"></polyline>';
            })
            .join("") +
          points(today)
            .filter(Boolean)
            .map(function (line) {
              return '<polyline fill="none" stroke="#ffa39e" stroke-width="2" points="' + line + '"></polyline>';
            })
            .join("") +
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
          '<button type="button" class="xm-hm-live-heads" data-add-shop>新增店铺</button>' +
          '<button type="button" class="xm-hm-live-heads" data-live-heads>表头设置</button>' +
          '<button type="button" class="xm-hm-live-refresh" data-refresh-live>刷新</button></div></div>' +
          '<div class="xm-sp-shop-modal" data-shop-modal hidden><form class="xm-sp-shop-dialog" data-shop-form>' +
          "<h3>新增店铺</h3><p class=\"xm-sp-shop-hint\">保存后归入沈子晗组，并出现在这份全部店铺里。登录账号在组织中心填写。</p>" +
          '<label>店铺名称<input name="storeName" required maxlength="64" autocomplete="off" /></label>' +
          '<label>主管<input name="supervisor" maxlength="40" autocomplete="off" placeholder="用来分组，可空" /></label>' +
          '<label>运营<input name="operator" maxlength="40" autocomplete="off" /></label>' +
          '<label>店铺ID<input name="storeId" maxlength="32" autocomplete="off" /></label>' +
          '<p class="xm-sp-shop-error" data-shop-error hidden></p>' +
          '<div class="xm-sp-shop-actions"><button type="submit">保存</button>' +
          '<button type="button" data-shop-cancel>取消</button></div></form></div>'
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
              return link("team=" + encodeURIComponent(name), name, groupLabel(view.team) === groupLabel(name));
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
          : "沈子晗组 · " + (view.team || "全部") + " " + scoped.length + " 店 · 京麦未接入";
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
        const addShop = boardEl.querySelector("[data-add-shop]");
        const shopModal = boardEl.querySelector("[data-shop-modal]");
        const shopForm = boardEl.querySelector("[data-shop-form]");
        const shopError = boardEl.querySelector("[data-shop-error]");
        if (addShop && shopModal && shopForm) {
          addShop.addEventListener("click", function () {
            if (shopError) {
              shopError.hidden = true;
              shopError.textContent = "";
            }
            shopModal.hidden = false;
            const nameInput = shopForm.querySelector("[name=storeName]");
            if (nameInput) {
              nameInput.focus();
            }
          });
          shopForm.addEventListener("submit", function (event) {
            event.preventDefault();
            const storeName = String(shopForm.storeName.value || "").trim();
            if (!storeName) {
              return;
            }
            const submit = shopForm.querySelector("[type=submit]");
            if (submit) {
              submit.disabled = true;
            }
            postJson("/api/people/org/stores", {
              director: "罗成",
              manager: "沈子晗",
              supervisor: String(shopForm.supervisor.value || "").trim(),
              operator: String(shopForm.operator.value || "").trim(),
              storeName: storeName,
              storeId: String(shopForm.storeId.value || "").trim(),
              remark: "运营中"
            })
              .then(function () {
                shopForm.reset();
                shopModal.hidden = true;
                return load();
              })
              .catch(function (err) {
                if (shopError) {
                  shopError.hidden = false;
                  shopError.textContent = err.message || "保存失败";
                }
              })
              .then(function () {
                if (submit) {
                  submit.disabled = false;
                }
              });
          });
          const cancel = shopForm.querySelector("[data-shop-cancel]");
          if (cancel) {
            cancel.addEventListener("click", function () {
              shopModal.hidden = true;
            });
          }
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

      function shopKey(name) {
        return String(name || "")
          .replace(/\s+/g, "")
          .replace(/店$/, "");
      }

      function parseMoney(value) {
        if (value == null || value === "" || value === "—") {
          return null;
        }
        const n = Number(String(value).replace(/[,％%\s]/g, ""));
        return isFinite(n) ? n : null;
      }

      function formatMoney(value) {
        if (value == null || !isFinite(Number(value))) {
          return "—";
        }
        const neg = Number(value) < 0;
        const parts = Math.abs(Number(value)).toFixed(2).split(".");
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        return (neg ? "-" : "") + parts.join(".");
      }

      function formatRate(value) {
        if (value == null || !isFinite(Number(value))) {
          return "—";
        }
        return (Number(value) * 100).toFixed(2) + "%";
      }

      function liveShopsOf(payload) {
        if (!payload || payload.demo === true || payload.ok === false) {
          return [];
        }
        return (payload.shops || []).filter(function (shop) {
          return shop && shop.demo !== true;
        });
      }

      const HOME_COLS = [
        { key: "rank", label: "排名", lock: true, w: "56px" },
        { key: "shop", label: "店铺名称", lock: true, w: "16%" },
        { key: "liveAmount", label: "实时成交金额" },
        { key: "paidAmount", label: "实时付费金额" },
        { key: "roi", label: "实时付费ROI" },
        { key: "paidDeal", label: "实时付费成交额" },
        { key: "feeRate", label: "实时费比" },
        { key: "feeWarn", label: "费比监控", w: "120px" },
        { key: "feeGoal", label: "费比设置", w: "176px" },
        { key: "liveAt", label: "更新时间", w: "150px" },
        { key: "jzAccount", label: "京准通主账户ID", extra: true, w: "140px" },
        { key: "jzSpend", label: "京准通花费", extra: true },
        { key: "jzPaidOrders", label: "京准通付费订单数", extra: true },
        { key: "jzPaidRoi", label: "京准通付费投产比", extra: true },
        { key: "jzPaidCvr", label: "京准通付费转化率", extra: true },
        { key: "jzCpc", label: "京准通平均点击成本", extra: true },
        { key: "jzDeal", label: "京麦成交金额", extra: true },
        { key: "jzClicks", label: "京准通点击数", extra: true },
        { key: "jzCtr", label: "京准通点击率", extra: true },
        { key: "jzOrderAmt", label: "京准通总订单金额", extra: true },
        { key: "jzRealFee", label: "真实费比", extra: true },
        { key: "jzOk", label: "是否成功", extra: true }
      ];
      const HEAD_KEY = "shen-home-live-head-hide";
      const FEE_KEY = "shen-home-fee-targets";

      function freshPayload(payload) {
        if (!payload || payload.demo === true || payload.ok === false) {
          return null;
        }
        return payload;
      }

      function applyHomeLive(rows, jingmai, localPaid) {
        const sales = {};
        const jingmaiPayload = freshPayload(jingmai);
        ((jingmaiPayload && jingmaiPayload.shops) || []).forEach(function (shop) {
          if (!shop || shop.demo === true) {
            return;
          }
          const key = shopKey(shop.shop || shop.store);
          if (key) {
            sales[key] = shop;
          }
        });
        const paid = {};
        const local = freshPayload(localPaid);
        ((local && local.records) || []).forEach(function (rec) {
          if (!rec || rec.demo === true) {
            return;
          }
          const key = shopKey(rec.shopName || rec.shop || rec.store);
          if (key) {
            paid[key] = rec;
          }
        });
        rows.forEach(function (row) {
          const sale = sales[shopKey(row.store)];
          const pay = paid[shopKey(row.store)];
          row.liveAmount = sale ? parseMoney(sale.dealAmount) : null;
          row.yesterdayAmount = sale ? parseMoney(sale.yesterdayAmount) : null;
          row.todayHours = sale && Array.isArray(sale.todayHours) ? sale.todayHours : [];
          row.yesterdayHours = sale && Array.isArray(sale.yesterdayHours) ? sale.yesterdayHours : [];
          row.capturedAt = sale && sale.capturedAt ? String(sale.capturedAt) : "";
          row.online = Boolean(sale && sale.online);
          row.loginExpired = Boolean(sale && sale.loginExpired);
          row.paidAmount =
            sale && sale.paidAmount != null
              ? parseMoney(sale.paidAmount)
              : pay
                ? parseMoney(pay.paidAmount != null ? pay.paidAmount : pay.totalPromotionCost)
                : null;
          row.paidDeal =
            sale && sale.paidDeal != null
              ? parseMoney(sale.paidDeal)
              : pay
                ? parseMoney(pay.paidDeal != null ? pay.paidDeal : pay.payAmount)
                : null;
          const rawFee = pay && pay.feeRate != null && pay.feeRate !== "" ? pay.feeRate : pay && pay.promotionRate;
          const fee = rawFee == null || rawFee === "" ? null : Number(rawFee);
          row.feeRate = fee != null && isFinite(fee) ? fee : null;
          row.roi =
            sale && sale.paidRoi != null
              ? parseMoney(sale.paidRoi)
              : row.paidAmount > 0 && row.paidDeal != null
                ? row.paidDeal / row.paidAmount
                : null;
          row.linked = row.liveAmount != null;
        });
        rows.sort(function (a, b) {
          const diff = (Number(b.liveAmount) || 0) - (Number(a.liveAmount) || 0);
          if (diff) {
            return diff;
          }
          return a.store.localeCompare(b.store, "zh");
        });
      }

      function sumField(rows, key) {
        let total = 0;
        let any = false;
        rows.forEach(function (row) {
          if (row[key] == null) {
            return;
          }
          any = true;
          total += Number(row[key]) || 0;
        });
        return any ? total : null;
      }

      function rankMark(index) {
        if (index === 0) {
          return '<b class="xm-dc-cup gold">1</b>';
        }
        if (index === 1) {
          return '<b class="xm-dc-cup silver">2</b>';
        }
        if (index === 2) {
          return '<b class="xm-dc-cup bronze">3</b>';
        }
        return "<span>" + (index + 1) + "</span>";
      }

      function bindShopForm() {
        const addShop = boardEl.querySelector("[data-add-shop]");
        const shopModal = boardEl.querySelector("[data-shop-modal]");
        const shopForm = boardEl.querySelector("[data-shop-form]");
        const shopError = boardEl.querySelector("[data-shop-error]");
        if (!addShop || !shopModal || !shopForm) {
          return;
        }
        addShop.addEventListener("click", function () {
          if (shopError) {
            shopError.hidden = true;
            shopError.textContent = "";
          }
          shopModal.hidden = false;
          const nameInput = shopForm.querySelector("[name=storeName]");
          if (nameInput) {
            nameInput.focus();
          }
        });
        shopForm.addEventListener("submit", function (event) {
          event.preventDefault();
          const storeName = String(shopForm.storeName.value || "").trim();
          if (!storeName) {
            return;
          }
          const submit = shopForm.querySelector("[type=submit]");
          if (submit) {
            submit.disabled = true;
          }
          postJson("/api/people/org/stores", {
            director: "罗成",
            manager: "沈子晗",
            supervisor: String(shopForm.supervisor.value || "").trim(),
            operator: String(shopForm.operator.value || "").trim(),
            storeName: storeName,
            storeId: String(shopForm.storeId.value || "").trim(),
            remark: "运营中"
          })
            .then(function () {
              shopForm.reset();
              shopModal.hidden = true;
              return load();
            })
            .catch(function (err) {
              if (shopError) {
                shopError.hidden = false;
                shopError.textContent = err.message || "保存失败";
              }
            })
            .then(function () {
              if (submit) {
                submit.disabled = false;
              }
            });
        });
        const cancel = shopForm.querySelector("[data-shop-cancel]");
        if (cancel) {
          cancel.addEventListener("click", function () {
            shopModal.hidden = true;
          });
        }
      }

      function shanghaiClock() {
        return new Intl.DateTimeFormat("sv-SE", {
          timeZone: "Asia/Shanghai",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false
        })
          .format(new Date())
          .replace(/-/g, "/");
      }

      function formatLive(value) {
        if (value == null || !isFinite(Number(value))) {
          return "—";
        }
        const n = Number(value);
        const digits = Math.abs(n - Math.round(n)) < 0.005 ? 0 : 2;
        return n.toLocaleString("zh-CN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
      }

      function hiddenKeys() {
        try {
          const raw = localStorage.getItem(HEAD_KEY);
          if (raw == null) {
            return HOME_COLS.filter(function (col) {
              return col.extra;
            }).map(function (col) {
              return col.key;
            });
          }
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            return list.filter(function (key) {
              return key && key !== "rank" && key !== "shop";
            });
          }
        } catch (err) {
          return HOME_COLS.filter(function (col) {
            return col.extra;
          }).map(function (col) {
            return col.key;
          });
        }
        return [];
      }

      function feeBook() {
        try {
          const raw = JSON.parse(localStorage.getItem(FEE_KEY) || "{}");
          return raw && typeof raw === "object" ? raw : {};
        } catch (err) {
          return {};
        }
      }

      function feeBound(value) {
        if (value == null || value === "") {
          return null;
        }
        const n = Number(String(value).replace(/%/g, ""));
        return isFinite(n) ? Math.max(0, Math.min(100, n)) : null;
      }

      function feeBounds(shop) {
        const raw = feeBook()[shop];
        if (raw == null || raw === "") {
          return { lo: null, hi: null };
        }
        let lo;
        let hi;
        if (typeof raw === "object") {
          lo = feeBound(raw.lo != null ? raw.lo : raw.min);
          hi = feeBound(raw.hi != null ? raw.hi : raw.max);
        } else {
          lo = feeBound(raw);
          hi = lo;
        }
        if (lo != null && hi != null && lo > hi) {
          return { lo: hi, hi: lo };
        }
        return { lo: lo, hi: hi };
      }

      function feePercent(row) {
        if (row.feeRate == null || !isFinite(Number(row.feeRate))) {
          return null;
        }
        let n = Number(row.feeRate);
        if (Math.abs(n) <= 1) {
          n *= 100;
        }
        return n;
      }

      function feeKind(row) {
        const bounds = feeBounds(row.store);
        const pct = feePercent(row);
        if (bounds.lo == null && bounds.hi == null) {
          return { label: "未设目标", kind: "" };
        }
        if (pct == null) {
          return { label: "—", kind: "" };
        }
        if (bounds.hi != null && pct > bounds.hi) {
          return { label: "费比超标", kind: "hot" };
        }
        if (bounds.lo != null && pct < bounds.lo) {
          return { label: "加大付费", kind: "cold" };
        }
        return { label: "正常", kind: "ok" };
      }

      function deltaOf(today, yesterday) {
        if (today == null || yesterday == null || !Number(yesterday)) {
          return null;
        }
        const pct = ((Number(today) - Number(yesterday)) / Math.abs(Number(yesterday))) * 100;
        const down = pct < 0;
        return { text: (down ? "下降 " : "上升 ") + Math.abs(pct).toFixed(0) + "%", kind: down ? "down" : "up" };
      }

      function sumHours(rows, field) {
        const out = [];
        for (let hour = 0; hour < 24; hour += 1) {
          out.push(0);
        }
        rows.forEach(function (row) {
          const list = hourList(row[field] || {});
          for (let hour = 0; hour < 24; hour += 1) {
            out[hour] += Number(list[hour]) || 0;
          }
        });
        return out;
      }

      function sumHourSlots(rows, field) {
        const out = [];
        for (let hour = 0; hour < 24; hour += 1) {
          let any = false;
          let total = 0;
          rows.forEach(function (row) {
            const list = row[field];
            const value = list && list.length ? list[hour] : null;
            if (value == null || value === "") {
              return;
            }
            any = true;
            total += Number(value) || 0;
          });
          out.push(any ? total : null);
        }
        return out;
      }

      function homeChart(spec) {
        const plot = spec.gaps
          ? { yesterday: spec.yHours || [], today: spec.tHours || [], hours: 24, height: 168, gaps: true }
          : spec.blank
          ? { yesterday: [], today: [], hours: 24, height: 168 }
          : livePlot({
              yesterdayHour: spec.yHours,
              todayHour: spec.tHours,
              lineMode: spec.flat ? "flat" : "",
              unit: spec.flat ? "rate" : ""
            });
        const delta = spec.delta;
        return (
          '<article class="xm-hl-chart"><div class="xm-hl-chart-head"><span>' +
          escapeHtml(spec.title) +
          '</span><span class="xm-hl-legs"><i class="is-yest"></i>昨天<i class="is-today"></i>今天</span></div>' +
          '<div class="xm-hl-value">' +
          escapeHtml(spec.value) +
          '</div><div class="xm-hl-sub">昨天 ' +
          escapeHtml(spec.yesterday) +
          (delta
            ? ' <b class="' + delta.kind + '">环比 ' + escapeHtml(delta.text) + "</b>"
            : " <span>环比 —</span>") +
          "</div>" +
          liveLine(plot) +
          "</article>"
        );
      }

      function shownCols() {
        const hide = {};
        hiddenKeys().forEach(function (key) {
          hide[key] = true;
        });
        return HOME_COLS.filter(function (col) {
          return col.lock || !hide[col.key];
        });
      }

      function netMark(row) {
        if (row.online) {
          return '<span class="xm-hl-net is-on">在线</span>';
        }
        if (row.loginExpired) {
          return '<span class="xm-hl-net is-off">掉线</span>';
        }
        return "";
      }

      function homeCell(row, col, index, clock) {
        if (col.key === "rank") {
          return rankMark(index);
        }
        if (col.key === "shop") {
          return (
            '<button type="button" class="xm-hl-shop" data-open-shop="' +
            escapeHtml(row.store) +
            '">' +
            escapeHtml(row.store) +
            "</button>" +
            netMark(row) +
            (row.loginExpired
              ? '<button type="button" class="xm-hl-relogin" data-relogin="' +
                escapeHtml(row.store) +
                '">重新登录</button>'
              : "")
          );
        }
        if (col.key === "liveAmount" || col.key === "paidAmount" || col.key === "paidDeal") {
          return formatLive(row[col.key]);
        }
        if (col.key === "roi") {
          return row.roi == null ? "—" : Number(row.roi).toFixed(2);
        }
        if (col.key === "feeRate") {
          const pct = feePercent(row);
          const kind = feeKind(row).kind;
          return (
            '<span class="' +
            (kind === "hot" ? "is-hot" : kind === "cold" ? "is-cold" : "") +
            '">' +
            (pct == null ? "—" : pct.toFixed(2) + "%") +
            "</span>"
          );
        }
        if (col.key === "feeWarn") {
          const kind = feeKind(row);
          return (
            '<span class="' +
            (kind.kind === "hot" ? "is-hot" : kind.kind === "cold" ? "is-cold" : "") +
            '">' +
            escapeHtml(kind.label) +
            "</span>"
          );
        }
        if (col.key === "feeGoal") {
          const bounds = feeBounds(row.store);
          return (
            '<span class="xm-hl-fee" data-fee-target><input data-fee-lo data-shop="' +
            escapeHtml(row.store) +
            '" value="' +
            (bounds.lo == null ? "" : bounds.lo) +
            '" inputmode="decimal" /> % <input data-fee-hi data-shop="' +
            escapeHtml(row.store) +
            '" value="' +
            (bounds.hi == null ? "" : bounds.hi) +
            '" inputmode="decimal" /> %</span>'
          );
        }
        if (col.key === "liveAt") {
          return row.capturedAt ? escapeHtml(row.capturedAt) : "—";
        }
        return "—";
      }

      function renderHomeLive(rows) {
        const picked = rows.filter(function (row) {
          if (view.liveShop && row.store !== view.liveShop) {
            return false;
          }
          if (view.team && groupLabel(row.group) !== groupLabel(view.team)) {
            return false;
          }
          return true;
        });
        const sales = sumField(picked, "liveAmount");
        const yestSales = sumField(picked, "yesterdayAmount");
        const spend = sumField(picked, "paidAmount");
        const deal = sumField(picked, "paidDeal");
        const roi = spend > 0 && deal != null ? deal / spend : null;
        const fee = sales > 0 && spend != null ? spend / sales : null;
        const paidShops = picked.filter(function (row) {
          return row.paidAmount != null || row.paidDeal != null;
        }).length;
        const hot = picked.filter(function (row) {
          return feeKind(row).kind === "hot";
        }).length;
        const cold = picked.filter(function (row) {
          return feeKind(row).kind === "cold";
        }).length;
        const listed = picked.filter(function (row) {
          return !feeWatch || feeKind(row).kind === feeWatch;
        });
        const clock = liveUpdatedAt || "—";
        const cols = shownCols();
        const groups = [];
        const seenGroup = {};
        rows.forEach(function (row) {
          const name = groupLabel(row.group);
          if (name && !seenGroup[name]) {
            seenGroup[name] = true;
            groups.push(name);
          }
        });
        groups.sort(function (a, b) {
          const diff = groupRank(a) - groupRank(b);
          return diff || a.localeCompare(b, "zh");
        });
        const pick = view.liveShop ? "shop:" + view.liveShop : view.team ? "team:" + view.team : "";
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
        const hide = {};
        hiddenKeys().forEach(function (key) {
          hide[key] = true;
        });
        const liveCols = HOME_COLS.filter(function (col) {
          return !col.lock && !col.extra;
        });
        const extraCols = HOME_COLS.filter(function (col) {
          return col.extra;
        });
        const snapshot = {
          ok: true,
          source: "shen-paid-live",
          center: "沈子晗",
          updatedAt: clock,
          summary: {
            liveAmount: sales,
            paidAmount: spend,
            paidDeal: deal,
            roi: roi,
            feeRate: fee,
            shops: picked.length,
            paidShops: paidShops
          },
          shops: picked.map(function (row) {
            return {
              shop: row.store,
              group: row.group || "",
              owner: row.owner || "",
              liveAmount: row.liveAmount,
              yesterdayAmount: row.yesterdayAmount,
              paidAmount: row.paidAmount,
              roi: row.roi,
              paidDeal: row.paidDeal,
              feeRate: row.feeRate
            };
          })
        };
        function homeTable(list) {
          return (
            '<div class="xm-hl-table-wrap"><table class="xm-hl-table"><colgroup>' +
            cols
              .map(function (col) {
                return col.w ? '<col style="width:' + col.w + '" />' : "<col />";
              })
              .join("") +
            "</colgroup><thead><tr>" +
            cols
              .map(function (col) {
                return "<th>" + escapeHtml(col.label) + "</th>";
              })
              .join("") +
            "</tr></thead><tbody>" +
            (list.length
              ? list
                  .map(function (row, index) {
                    return (
                      "<tr>" +
                      cols
                        .map(function (col) {
                          return "<td>" + homeCell(row, col, index, clock) + "</td>";
                        })
                        .join("") +
                      "</tr>"
                    );
                  })
                  .join("")
              : '<tr><td class="xm-hl-empty" colspan="' + cols.length + '">该组还没有店铺</td></tr>') +
            "</tbody></table></div>"
          );
        }
        function groupedTables(list) {
          const buckets = [];
          const byName = {};
          list.forEach(function (row) {
            const name = groupLabel(row.group);
            if (!byName[name]) {
              byName[name] = [];
              buckets.push(name);
            }
            byName[name].push(row);
          });
          buckets.sort(function (a, b) {
            const diff = groupRank(a) - groupRank(b);
            return diff || a.localeCompare(b, "zh");
          });
          if (!buckets.length) {
            return homeTable([]);
          }
          return buckets
            .map(function (name) {
              const listRows = byName[name];
              return (
                '<section class="xm-hl-group"><h3>' +
                escapeHtml(name) +
                "<span>" +
                listRows.length +
                "店</span></h3>" +
                homeTable(listRows) +
                "</section>"
              );
            })
            .join("");
        }
        if (barEl) {
          barEl.hidden = false;
        }
        if (asofEl) {
          asofEl.textContent = liveUpdatedAt ? "最新采集 " + liveUpdatedAt : "等待采集";
        }
        renderTabs();
        boardEl.hidden = false;
        kpiEl.hidden = true;
        boardEl.innerHTML =
          '<div class="xm-hl"><div class="xm-hm-live-filter"><div class="xm-hm-live-filter-left"><strong class="xm-hm-live-filter-lab">店铺列表</strong>' +
          '<span class="xm-hm-live-filter-box"><select data-live-filter="pick">' +
          option("", "责权归属", !pick) +
          (groups.length
            ? '<optgroup label="责权归属">' +
              groups
                .map(function (name) {
                  return option("team:" + name, name, pick === "team:" + name);
                })
                .join("") +
              "</optgroup>"
            : "") +
          (rows.length
            ? '<optgroup label="店铺">' +
              rows
                .map(function (row) {
                  return option("shop:" + row.store, row.store, pick === "shop:" + row.store);
                })
                .join("") +
              "</optgroup>"
            : "") +
          '</select></span></div><div class="xm-hl-tools"><span class="xm-hl-clock">更新时间 ' +
          escapeHtml(clock) +
          '</span><button type="button" data-connect-jingmai>连接京麦</button><button type="button" data-add-shop>新增店铺</button><button type="button" data-head-open>表头设置</button><button type="button" data-refresh>刷新</button>' +
          '<div class="xm-hl-pop" data-head-pop hidden><p>实时</p>' +
          liveCols
            .map(function (col) {
              return (
                '<label><input type="checkbox" data-col="' +
                col.key +
                '"' +
                (hide[col.key] ? "" : " checked") +
                " />" +
                escapeHtml(col.label) +
                "</label>"
              );
            })
            .join("") +
          "<p>付费中心（数据待对接）</p>" +
          extraCols
            .map(function (col) {
              return (
                '<label><input type="checkbox" data-col="' +
                col.key +
                '"' +
                (hide[col.key] ? "" : " checked") +
                " />" +
                escapeHtml(col.label) +
                "</label>"
              );
            })
            .join("") +
          "</div></div></div>" +
          '<div class="xm-hl-charts">' +
          homeChart({
            title: "实时总成交金额",
            value: formatLive(sales),
            yesterday: formatLive(yestSales),
            delta: deltaOf(sales, yestSales),
            gaps: true,
            yHours: sumHourSlots(picked, "yesterdayHours"),
            tHours: sumHourSlots(picked, "todayHours")
          }) +
          homeChart({
            title: "推广总花费",
            value: formatLive(spend),
            yesterday: "—",
            delta: null,
            blank: true
          }) +
          homeChart({
            title: "实时费比",
            value: fee == null ? "—" : formatRate(fee),
            yesterday: "—",
            delta: null,
            blank: true
          }) +
          '</div><div class="xm-hl-cards">' +
          [
            ["实时付费成交额", formatLive(deal), ""],
            ["付费成交ROI", roi == null ? "—" : roi.toFixed(2), ""],
            ["实时付费接入店铺数量", String(paidShops), ""],
            ["实时付费超标店铺", String(hot), "hot"],
            ["实时费比低店铺", String(cold), "cold"],
            ["更新时间", clock, ""]
          ]
            .map(function (card) {
              const key = card[2];
              const on = key && feeWatch === key;
              return (
                '<article class="xm-hl-card' +
                (key ? " is-click" : "") +
                (on ? " is-on" : "") +
                '"' +
                (key ? ' data-fee-filter="' + key + '" role="button" tabindex="0"' : "") +
                '><div class="label">' +
                escapeHtml(card[0]) +
                '</div><div class="xm-hl-value">' +
                escapeHtml(card[1]) +
                "</div></article>"
              );
            })
            .join("") +
          '</div><section class="xm-hl-panel">' +
          (feeWatch && !listed.length
            ? '<p class="xm-hl-empty">' + (feeWatch === "hot" ? "没有费比超标的店铺" : "没有费比偏低的店铺") + "</p>"
            : groupedTables(listed)) +
          '<p class="xm-hl-note">连接京麦和重新登录都在服务器里登录组织中心保存的账号。验证出现在弹出的画面里，点画面就是在服务器上操作。登录成功后服务器每 5 分钟采集。成交金额来自京麦首页经营数据，付费金额、付费成交额和付费 ROI 来自京准通非全站营销概况。分组按组织中心的主管、储备。</p></section>' +
          '<div class="xm-sp-shop-modal" data-shop-modal hidden><form class="xm-sp-shop-dialog" data-shop-form>' +
          "<h3>新增店铺</h3><p class=\"xm-sp-shop-hint\">保存后归入沈子晗组，并出现在这份全部店铺里。登录账号在组织中心填写。</p>" +
          '<label>店铺名称<input name="storeName" required maxlength="64" autocomplete="off" /></label>' +
          '<label>主管<input name="supervisor" maxlength="40" autocomplete="off" /></label>' +
          '<label>运营<input name="operator" maxlength="40" autocomplete="off" /></label>' +
          '<label>店铺ID<input name="storeId" maxlength="32" autocomplete="off" /></label>' +
          '<p class="xm-sp-shop-error" data-shop-error hidden></p>' +
          '<div class="xm-sp-shop-actions"><button type="submit">保存</button>' +
          '<button type="button" data-shop-cancel>取消</button></div></form></div>' +
          '<div class="xm-sp-shop-modal" data-desk-modal hidden><div class="xm-sp-shop-dialog is-desk" role="dialog" aria-modal="true">' +
          '<h3>服务器登录</h3><p class="xm-sp-shop-hint" data-desk-shop>正在服务器上登录…</p>' +
          '<p class="xm-sp-shop-hint" data-desk-state></p>' +
          '<img class="xm-hl-desk" data-desk-shot alt="" />' +
          '<label>验证码<input data-desk-code maxlength="20" autocomplete="off" /></label>' +
          '<div class="xm-sp-shop-actions"><button type="button" data-desk-code-send>发送验证码</button>' +
          '<button type="button" data-desk-close>关闭</button></div></div></div>' +
          '<pre id="shen-paid-live-snapshot" hidden>' +
          JSON.stringify(snapshot).replace(/</g, "\\u003c") +
          "</pre></div>";
        bindShopForm();
        bindHomeLive();
      }

      function bindHomeLive() {
        const filter = boardEl.querySelector("[data-live-filter]");
        if (filter) {
          filter.addEventListener("change", function () {
            const value = filter.value || "";
            if (value.indexOf("shop:") === 0) {
              writeHash({ liveShop: value.slice(5), team: "" });
            } else if (value.indexOf("team:") === 0) {
              writeHash({ team: value.slice(5), liveShop: "" });
            } else {
              writeHash({ team: "", liveShop: "" });
            }
          });
        }
        boardEl.querySelectorAll("[data-fee-filter]").forEach(function (card) {
          card.addEventListener("click", function () {
            const next = card.getAttribute("data-fee-filter") || "";
            feeWatch = feeWatch === next ? "" : next;
            renderHomeLive(overviewRows);
          });
        });
        const refresh = boardEl.querySelector("[data-refresh]");
        if (refresh) {
          refresh.addEventListener("click", function () {
            load();
          });
        }
        const connect = boardEl.querySelector("[data-connect-jingmai]");
        if (connect) {
          connect.addEventListener("click", function () {
            openDesk("", true);
          });
        }
        boardEl.querySelectorAll("[data-relogin]").forEach(function (button) {
          button.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            openDesk(button.getAttribute("data-relogin") || "", false);
          });
        });
        const deskShot = boardEl.querySelector("[data-desk-shot]");
        if (deskShot) {
          deskShot.addEventListener("click", function (event) {
            if (!deskStore || !deskShot.naturalWidth) {
              return;
            }
            const rect = deskShot.getBoundingClientRect();
            const x = Math.round((event.clientX - rect.left) * (deskShot.naturalWidth / rect.width));
            const y = Math.round((event.clientY - rect.top) * (deskShot.naturalHeight / rect.height));
            postJson("/api/shen/paid/jingmai/relogin/input", { store: deskStore, x: x, y: y }).catch(function () {});
          });
        }
        const deskSend = boardEl.querySelector("[data-desk-code-send]");
        if (deskSend) {
          deskSend.addEventListener("click", function () {
            const field = boardEl.querySelector("[data-desk-code]");
            const text = field ? field.value : "";
            if (!deskStore || !text) {
              return;
            }
            postJson("/api/shen/paid/jingmai/relogin/input", { store: deskStore, text: text }).catch(function () {});
            if (field) {
              field.value = "";
            }
          });
        }
        const deskClose = boardEl.querySelector("[data-desk-close]");
        if (deskClose) {
          deskClose.addEventListener("click", function () {
            closeDesk(true);
          });
        }
        const headOpen = boardEl.querySelector("[data-head-open]");
        const headPop = boardEl.querySelector("[data-head-pop]");
        if (headOpen && headPop) {
          headOpen.addEventListener("click", function (event) {
            event.stopPropagation();
            headPop.hidden = !headPop.hidden;
          });
          headPop.addEventListener("change", function () {
            const next = [];
            headPop.querySelectorAll("[data-col]").forEach(function (box) {
              if (!box.checked) {
                next.push(box.getAttribute("data-col"));
              }
            });
            try {
              localStorage.setItem(HEAD_KEY, JSON.stringify(next));
            } catch (err) {
              return;
            }
            renderHomeLive(overviewRows);
          });
        }
        boardEl.querySelectorAll("[data-open-shop]").forEach(function (button) {
          button.addEventListener("click", function () {
            writeHash({ store: button.getAttribute("data-open-shop") || "" });
          });
        });
        boardEl.querySelectorAll("[data-fee-lo],[data-fee-hi]").forEach(function (input) {
          input.addEventListener("change", function () {
            const shop = input.getAttribute("data-shop") || "";
            const book = feeBook();
            const bounds = feeBounds(shop);
            if (input.hasAttribute("data-fee-lo")) {
              bounds.lo = feeBound(input.value);
            } else {
              bounds.hi = feeBound(input.value);
            }
            book[shop] = bounds;
            try {
              localStorage.setItem(FEE_KEY, JSON.stringify(book));
            } catch (err) {
              return;
            }
            renderHomeLive(overviewRows);
          });
        });
      }

      function renderOverview(data) {
        overviewRows = data.rows || [];
        enabledStores = data.enabledStores || [];
        markStale(data);
        if (barEl) {
          barEl.hidden = true;
        }
        bodyEl.innerHTML = "";
        renderHomeLive(overviewRows);
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

      function readJson(res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (!res.ok || data.ok === false) {
            throw new Error(data.error || "无法加载付费数据");
          }
          return data;
        });
      }

      function getJson(url) {
        return fetch(url, { credentials: "same-origin" }).then(readJson);
      }

      function getOptional(url) {
        return fetch(url, { credentials: "same-origin", headers: { Accept: "application/json" } })
          .then(function (res) {
            if (!res.ok) {
              return null;
            }
            return res.json().catch(function () {
              return null;
            });
          })
          .catch(function () {
            return null;
          });
      }

      function postJson(url, body) {
        return fetch(url, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        }).then(readJson);
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

      function closeDesk(cancel) {
        deskStore = "";
        window.clearInterval(deskTimer);
        deskTimer = 0;
        const modal = boardEl.querySelector("[data-desk-modal]");
        if (modal) {
          modal.hidden = true;
        }
        if (cancel) {
          postJson("/api/shen/paid/jingmai/relogin/cancel", {}).catch(function () {});
        }
      }

      function paintDesk(state) {
        const shop = boardEl.querySelector("[data-desk-shop]");
        const hint = boardEl.querySelector("[data-desk-state]");
        const shot = boardEl.querySelector("[data-desk-shot]");
        const name = (state && state.store) || deskStore;
        if (shop) {
          const progress = state && state.total > 1 ? "（" + state.index + "/" + state.total + "）" : "";
          shop.textContent = "服务器正在登录「" + name + "」" + progress + "。账号和密码用组织中心保存的，不在这台电脑上登录。";
        }
        if (hint) {
          hint.textContent = (state && state.message) || "请在下面的画面里完成验证。点画面就是在服务器上操作。";
        }
        if (shot && name && state && state.status === "screen") {
          shot.src = "/api/shen/paid/jingmai/relogin/screen?store=" + encodeURIComponent(name) + "&t=" + Date.now();
        }
      }

      function watchDesk() {
        window.clearInterval(deskTimer);
        const pull = function () {
          if (!deskStore) {
            return;
          }
          getJson("/api/shen/paid/jingmai/relogin/state?store=" + encodeURIComponent(deskStore))
            .then(function (state) {
              if (!deskStore) {
                return;
              }
              if (state && (state.status === "ok" || state.status === "done")) {
                closeDesk(false);
                setStatus((state && state.message) || "已在服务器登录");
                load();
                return;
              }
              if (state && (state.status === "login" || state.status === "missing")) {
                window.clearInterval(deskTimer);
                deskTimer = 0;
                paintDesk(state);
                setStatus((state && state.message) || "登录没有通过", true);
                return;
              }
              if (state && state.store) {
                deskStore = state.store;
              }
              paintDesk(state);
            })
            .catch(function (err) {
              if (deskStore) {
                setStatus(err.message || "服务器登录中断了", true);
              }
            });
        };
        pull();
        deskTimer = window.setInterval(pull, 2000);
      }

      function openDesk(store, all) {
        const name = String(store || "");
        if (!all && !name) {
          return;
        }
        const modal = boardEl.querySelector("[data-desk-modal]");
        if (!modal) {
          return;
        }
        deskStore = name || "全部";
        modal.hidden = false;
        paintDesk({ store: name || "全部店铺", message: "正在服务器上打开登录…" });
        const request = all
          ? postJson("/api/shen/paid/jingmai/relogin/all", {})
          : postJson("/api/shen/paid/jingmai/relogin", { store: name });
        request
          .then(function (result) {
            if (result && result.status === "ok") {
              closeDesk(false);
              setStatus(result.message || "已在服务器登录");
              load();
              return;
            }
            if (!result || result.status !== "screen") {
              paintDesk({
                store: (result && result.store) || name,
                message: (result && result.message) || "服务器登录没有打开"
              });
              setStatus((result && result.message) || "服务器登录没有打开", true);
              return;
            }
            deskStore = result.store || deskStore;
            paintDesk(result);
            watchDesk();
          })
          .catch(function (err) {
            closeDesk(true);
            setStatus(err.message || "服务器登录没有打开", true);
          });
      }

      function load() {
        if (deskStore) {
          return Promise.resolve();
        }
        view = parseHash();
        setStatus("正在加载…");
        return Promise.all([
          getJson("/api/people/org/stores?team=" + encodeURIComponent("沈子晗组")),
          getOptional("/api/shen/paid/jingmai"),
          getOptional("/api/home/local-paid")
        ])
          .then(function (pack) {
            if (dead) {
              return;
            }
            const data = pack[0];
            (data.stores || []).forEach(function (store) {
              delete store.login;
              delete store.password;
            });
            const mapped = mapShenShops(data);
            const jingmai = pack[1];
            liveUpdatedAt = jingmai && jingmai.updatedAt ? String(jingmai.updatedAt) : "";
            applyHomeLive(mapped.rows, jingmai, pack[2]);
            overviewRows = mapped.rows;
            overviewAsOf = "";
            overviewStale = false;
            postJson("/api/shen/paid/jingmai/roster", {
              shops: mapped.rows.map(function (row) {
                return { store: row.store, enabled: row.enabled };
              })
            }).catch(function () {});
            if (deskStore) {
              return;
            }
            if (view.store) {
              renderJingmaiShop(view.store);
            } else {
              renderOverview({ asOf: "", rows: mapped.rows });
            }
            const success = jingmai && jingmai.successShops != null ? jingmai.successShops : 0;
            const enabled =
              jingmai && jingmai.enabledShops
                ? jingmai.enabledShops
                : mapped.rows.filter(function (row) {
                    return row.enabled;
                  }).length;
            const relogin = jingmai && jingmai.loginExpiredShops ? jingmai.loginExpiredShops : 0;
            setStatus(
              "已更新 · 成功 " +
                success +
                "/" +
                enabled +
                " 家" +
                (relogin ? "，" + relogin + " 家需要重新登录" : "") +
                (liveUpdatedAt ? " · 最后采集 " + liveUpdatedAt : "")
            );
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
      const poll = window.setInterval(function () {
        if (!dead) {
          load();
        }
      }, 60 * 1000);
      load();
      return function unmount() {
        dead = true;
        window.clearInterval(poll);
        window.clearInterval(deskTimer);
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
