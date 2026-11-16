/* xm-module-bound — 边界 BI 工作台。只读本库，只请求 /api/bound。爬虫，非 ERP。 */
(function () {
  var state = {
    page: "productOverview",
    tab: "",
    dim: "sku",
    view: "list",
    shop: "",
    q: "",
    from: "",
    to: "",
    pageNo: 1,
    catalog: null,
    viewData: null,
    link: null,
    admin: false,
    error: "",
    open: {},
    panel: ""
  };
  var active = 0;
  var timer = 0;
  var detach = function () {};

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function ensureStyle() {
    if (!document.getElementById || document.getElementById("bd-page-style")) {
      return;
    }
    var style = document.createElement("style");
    style.id = "bd-page-style";
    style.textContent = [
      ".bd-app{display:grid;grid-template-columns:168px minmax(0,1fr);gap:12px;color:var(--xm-ink);}",
      ".bd-side,.bd-main{background:var(--xm-card);border:1px solid var(--xm-line);border-radius:8px;}",
      ".bd-side{padding:8px;}",
      ".bd-mod{margin:8px 8px 4px;font-size:12px;opacity:.55;}",
      ".bd-side button{display:block;width:100%;height:32px;margin:0 0 4px;padding:0 10px;border:0;border-radius:6px;background:transparent;color:var(--xm-ink);text-align:left;cursor:pointer;}",
      ".bd-side button.is-on{background:var(--xm-primary-soft);color:var(--xm-primary);font-weight:650;}",
      ".bd-main{padding:12px;min-width:0;}",
      ".bd-note,.bd-banner{margin:0 0 10px;padding:8px 10px;border-radius:6px;background:var(--xm-bg);font-size:12px;line-height:1.5;}",
      ".bd-banner.is-bad{color:#cf1322;}",
      ".bd-bar,.bd-tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 10px;}",
      ".bd-bar h1{margin:0;font-size:16px;}",
      ".bd-bar input,.bd-bar select,.bd-tools button,.bd-bar button{height:30px;border:1px solid var(--xm-line);border-radius:4px;background:var(--xm-card);color:var(--xm-ink);font:inherit;font-size:13px;}",
      ".bd-tools button.is-on,.bd-tabs button.is-on{background:var(--xm-primary);color:#fff;border-color:var(--xm-primary);}",
      ".bd-tabs{display:flex;flex-wrap:wrap;gap:0;border-bottom:1px solid var(--xm-line);margin-bottom:8px;}",
      ".bd-tabs button{height:34px;padding:0 12px;border:0;background:transparent;color:var(--xm-ink);cursor:pointer;}",
      ".bd-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:0 0 10px;}",
      ".bd-card{padding:10px 12px;border:1px solid var(--xm-line);border-radius:6px;background:var(--xm-card);}",
      ".bd-card b{display:block;margin-top:6px;font-size:20px;}",
      ".bd-card span,.bd-miss{color:var(--xm-ink);opacity:.62;font-size:12px;}",
      ".bd-table{width:100%;border-collapse:collapse;font-size:12px;}",
      ".bd-table th,.bd-table td{padding:8px;border-bottom:1px solid var(--xm-line);text-align:left;white-space:nowrap;}",
      ".bd-table th{opacity:.6;}",
      ".bd-gallery{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;}",
      ".bd-tile{min-height:120px;padding:12px;border:1px solid var(--xm-line);border-radius:8px;}",
      ".bd-tile strong{display:block;font-size:16px;margin-bottom:6px;}",
      ".bd-sum{display:flex;gap:16px;margin-top:8px;font-size:13px;}",
      ".bd-panel{margin-top:8px;padding:8px;border:1px dashed var(--xm-line);border-radius:6px;}",
      ".bd-panel label{display:flex;gap:6px;align-items:center;margin:4px 0;font-size:13px;}",
      ".bd-qr{width:180px;height:180px;object-fit:contain;background:#fff;}",
      ".bd-detail{white-space:normal;font-size:12px;line-height:1.5;}",
      "@media(max-width:900px){.bd-app{grid-template-columns:1fr}.bd-cards,.bd-gallery{grid-template-columns:1fr 1fr}}"
    ].join("");
    if (document.head) {
      document.head.appendChild(style);
    }
  }

  function pageMeta() {
    var catalog = state.catalog;
    var found = null;
    if (!catalog) {
      return null;
    }
    catalog.modules.forEach(function (mod) {
      mod.pages.forEach(function (page) {
        if (page.id === state.page) {
          found = page;
        }
      });
    });
    return found;
  }

  function money(value) {
    var num = Number(value);
    if (!Number.isFinite(num)) {
      return esc(value);
    }
    return num.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function plain(value, numeric) {
    if (value == null || value === "") {
      return '<span class="bd-miss">—</span>';
    }
    if (typeof value === "number" && numeric) {
      return esc(String(Math.round(value * 100) / 100));
    }
    return esc(value);
  }

  function sumCell(sum, key) {
    if (!sum) {
      return "未采完";
    }
    if (!Object.prototype.hasOwnProperty.call(sum, key) || sum[key] == null) {
      return "—";
    }
    return String(Math.round(Number(sum[key]) * 100) / 100);
  }

  function queryString() {
    var params = new URLSearchParams();
    params.set("page", state.page);
    if (state.tab) {
      params.set("tab", state.tab);
    }
    params.set("dim", state.dim);
    params.set("view", state.view);
    params.set("shop", state.shop);
    params.set("q", state.q);
    params.set("from", state.from);
    params.set("to", state.to);
    params.set("pageNo", String(state.pageNo));
    return params.toString();
  }

  function renderNav() {
    if (!state.catalog) {
      return "";
    }
    return state.catalog.modules.map(function (mod) {
      var buttons = mod.pages.map(function (page) {
        return '<button type="button" data-act="page" data-page="' + esc(page.id) + '" class="' + (page.id === state.page ? "is-on" : "") + '">' + esc(page.label) + "</button>";
      }).join("");
      if (mod.id === "mine" && state.admin) {
        buttons += '<button type="button" data-act="page" data-page="link" class="' + (state.page === "link" ? "is-on" : "") + '">扫码连接旧站</button>';
      }
      return '<div class="bd-mod">' + esc(mod.label) + "</div>" + buttons;
    }).join("");
  }

  function renderBanner(data) {
    if (!data || data.page.id === "link") {
      return "";
    }
    var coverage = data.coverage || {};
    var text = "爬虫，非 ERP。查询只读本库，不会因为刷新去旧站重抓。";
    var bad = "";
    if (coverage.status === "missing") {
      bad = "这段还有 " + ((coverage.missing || []).length) + " 天没采完，汇总留空，不当成 0。";
    } else if (coverage.status === "failed") {
      bad = "这段有采集失败的日期，已标出失败，不会用 0 代替。" + esc(coverage.error || "");
    } else if (coverage.status === "denied") {
      bad = "当前账号没有这个菜单。";
    }
    return '<p class="bd-note">' + text + "</p>" + (bad ? '<p class="bd-banner is-bad">' + bad + "</p>" : '<p class="bd-banner">' + esc(data.sumNote || "") + "</p>");
  }

  function renderCards(data) {
    if (!data || !data.cards || !data.cards.length || state.panel === "cards") {
      return "";
    }
    return '<div class="bd-cards">' + data.cards.filter(function (card) { return card.on; }).map(function (card) {
      var value = data.cardStatus !== "ready" || card.value == null ? "未采完" : card.value;
      return '<div class="bd-card"><span>' + esc(card.label) + '</span><b>' + esc(value) + "</b></div>";
    }).join("") + "</div>";
  }

  function renderTable(data) {
    var columns = (data.columns || []).filter(function (column) { return column.on; });
    if (state.view === "gallery") {
      if (!data.rows.length) {
        return '<p class="bd-miss">' + (data.coverage.status === "ready" ? "这个范围内没有记录。" : "未采完") + "</p>";
      }
      return '<div class="bd-gallery">' + data.rows.map(function (row) {
        return '<article class="bd-tile"><strong>' + esc(row.name || "未命名") + "</strong><div>" + esc(row.shop) + "</div><div>" + esc(row.metrics.payAmount == null ? "—" : row.metrics.payAmount) + "</div></article>";
      }).join("") + "</div>";
    }
    var head = "<tr><th></th>" + columns.map(function (column) { return "<th>" + esc(column.label) + "</th>"; }).join("") + "</tr>";
    var body = data.rows.map(function (row) {
      var cells = columns.map(function (column) {
        return "<td>" + plain(row.metrics[column.key], column.numeric) + "</td>";
      }).join("");
      var detail = state.open[row.key] ? '<tr><td colspan="' + (columns.length + 1) + '" class="bd-detail">' + row.fields.map(function (field) {
        return "<div>" + esc(field.key) + "：" + esc(field.value) + "</div>";
      }).join("") + '<label>跟进 <input data-act="mark" data-key="' + esc(row.key) + '" data-field="follow" value="' + esc(row.follow) + '"></label><label>打标 <input data-act="mark" data-key="' + esc(row.key) + '" data-field="tag" value="' + esc(row.tag) + '"></label><label>目标 <input data-act="mark" data-key="' + esc(row.key) + '" data-field="target" value="' + esc(row.target) + '"></label></td></tr>' : "";
      return '<tr><td><button type="button" data-act="expand" data-key="' + esc(row.key) + '">明细</button></td>' + cells + "</tr>" + detail;
    }).join("");
    if (!data.rows.length) {
      body = '<tr><td colspan="' + (columns.length + 1) + '">' + (data.coverage.status === "ready" ? "这个范围内没有记录。" : "未采完") + "</td></tr>";
    }
    return '<div style="overflow:auto"><table class="bd-table">' + head + body + "</table></div>";
  }

  function renderSums(data) {
    var amount = sumCell(data.pageSum, "payAmount");
    var allAmount = sumCell(data.allSum, "payAmount");
    return '<div class="bd-sum"><span>当前页汇总 ' + esc(amount) + "</span><span>全部汇总 " + esc(allAmount) + "</span><span>记录 " + esc(data.total) + "</span></div>";
  }

  function renderPanel(data) {
    if (state.panel === "cards") {
      return '<div class="bd-panel"><strong>指标设置</strong>' + data.cards.map(function (card) {
        return '<label><input type="checkbox" data-act="card" value="' + esc(card.key) + '"' + (card.on ? " checked" : "") + ">" + esc(card.label) + "</label>";
      }).join("") + '<button type="button" data-act="save-cards">保存指标</button></div>';
    }
    if (state.panel === "columns") {
      return '<div class="bd-panel"><strong>字段设置</strong>' + data.columns.map(function (column) {
        return '<label><input type="checkbox" data-act="column" value="' + esc(column.key) + '"' + (column.on ? " checked" : "") + ">" + esc(column.label) + "</label>";
      }).join("") + '<button type="button" data-act="save-columns">保存字段</button></div>';
    }
    return "";
  }

  function renderLink() {
    var link = state.link || {};
    var qr = link.qrReady ? '<img class="bd-qr" alt="旧站登录二维码" src="/api/bound/link/qr?ts=' + Date.now() + '">' : "";
    var accounts = (link.accounts || []).map(function (account) {
      return '<button type="button" data-act="pick" data-company="' + esc(account.companyId) + '">' + esc(account.companyName || account.name || account.companyId) + "</button>";
    }).join("");
    return '<section class="bd-main" data-bound-erp="false"><h1>扫码连接旧站</h1><p class="bd-note">二维码来自旧站官方登录接口，和登录页同一张。扫码后服务器沿用这个会话补采，页面查询不再打旧站。</p><p>' + esc(link.message || "") + "</p><p>浏览器标识 " + esc(link.deviceId || "") + "</p>" + qr + '<div class="bd-tools"><button type="button" data-act="scan" data-provider="WECHAT">微信</button><button type="button" data-act="scan" data-provider="FEISHU">飞书</button><button type="button" data-act="scan" data-provider="DINGTALK">钉钉</button><button type="button" data-act="scan" data-provider="QYWX">企业微信</button></div>' + accounts + "</section>";
  }

  function renderMain() {
    if (state.page === "link") {
      return renderLink();
    }
    var data = state.viewData;
    var meta = pageMeta();
    if (!data || !meta) {
      return '<section class="bd-main"><p class="bd-miss">' + esc(state.error || "正在读取本库") + "</p></section>";
    }
    var ops = meta.ops || [];
    var tabs = (data.tabs || []).map(function (tab) {
      return '<button type="button" data-act="tab" data-tab="' + esc(tab.id) + '" class="' + (data.tab && data.tab.id === tab.id ? "is-on" : "") + '">' + esc(tab.label) + "</button>";
    }).join("");
    var shops = '<option value="">全部店铺</option>' + (data.shops || []).map(function (shop) {
      return '<option value="' + esc(shop) + '"' + (shop === state.shop ? " selected" : "") + ">" + esc(shop) + "</option>";
    }).join("");
    return '<section class="bd-main" data-bound-erp="false" data-page="' + esc(data.page.id) + '" data-coverage="' + esc(data.coverage.status) + '">' +
      renderBanner(data) +
      '<div class="bd-bar"><h1>' + esc(data.page.label) + '</h1>' +
      (ops.indexOf("date") >= 0 ? '<input data-act="from" type="date" value="' + esc(data.range.from) + '"><input data-act="to" type="date" value="' + esc(data.range.to) + '">' : "") +
      (ops.indexOf("shop") >= 0 ? "<select data-act=\"shop\">" + shops + "</select>" : "") +
      (ops.indexOf("search") >= 0 ? '<input data-act="q" value="' + esc(state.q) + '" placeholder="搜索商品、店铺、负责人">' : "") +
      "</div>" +
      '<div class="bd-tools">' +
      (ops.indexOf("dim") >= 0 ? '<button type="button" data-act="dim" data-dim="spu" class="' + (state.dim === "spu" ? "is-on" : "") + '">SPU</button><button type="button" data-act="dim" data-dim="sku" class="' + (state.dim === "sku" ? "is-on" : "") + '">SKU</button>' : "") +
      (ops.indexOf("views") >= 0 ? '<button type="button" data-act="view" data-view="list" class="' + (state.view === "list" ? "is-on" : "") + '">列表</button><button type="button" data-act="view" data-view="period" class="' + (state.view === "period" ? "is-on" : "") + '">周期</button><button type="button" data-act="view" data-view="gallery" class="' + (state.view === "gallery" ? "is-on" : "") + '">大图</button>' : "") +
      (ops.indexOf("cards") >= 0 ? '<button type="button" data-act="panel" data-panel="cards">指标设置</button>' : "") +
      (ops.indexOf("export") >= 0 ? '<a href="/api/bound/export?' + esc(queryString()) + '">导出</a>' : "") +
      '<button type="button" data-act="panel" data-panel="columns">字段</button></div>' +
      (tabs ? '<div class="bd-tabs">' + tabs + "</div>" : "") +
      renderCards(data) +
      renderPanel(data) +
      renderTable(data) +
      renderSums(data) +
      '<div class="bd-tools"><button type="button" data-act="page-no" data-delta="-1">上一页</button><span>第 ' + esc(data.pageNo) + ' 页</span><button type="button" data-act="page-no" data-delta="1">下一页</button></div></section>';
  }

  function render(root) {
    root.innerHTML = '<div class="bd-app" data-bound-erp="false"><nav class="bd-side" aria-label="边界数据中心">' + renderNav() + '</nav>' + renderMain() + "</div>";
  }

  function paint(root) {
    var focus = root.querySelector && root.querySelector("[data-act='q']");
    var start = focus ? focus.selectionStart : null;
    render(root);
    if (start != null && root.querySelector) {
      var next = root.querySelector("[data-act='q']");
      if (next) {
        next.focus();
        if (next.setSelectionRange) {
          next.setSelectionRange(start, start);
        }
      }
    }
  }

  async function load(root, token) {
    state.error = "";
    var stamp = await fetch("/api/bound");
    var view = await fetch("/api/bound/view?" + queryString());
    var catalog = state.catalog ? null : await fetch("/api/bound/catalog");
    var link = await fetch("/api/bound/link");
    if (token !== active) {
      return;
    }
    if (!stamp.ok) {
      state.error = "边界数据中心没有打开";
      paint(root);
      return;
    }
    if (catalog) {
      state.catalog = await catalog.json();
    }
    if (view.ok) {
      state.viewData = await view.json();
      if (state.viewData.range) {
        state.from = state.viewData.range.from;
        state.to = state.viewData.range.to;
      }
    } else {
      state.viewData = null;
      state.error = "这一页没有读到";
    }
    state.admin = link.ok;
    state.link = link.ok ? await link.json() : null;
    paint(root);
  }

  function listen(root, token) {
    function onClick(event) {
      var node = event.target.closest ? event.target.closest("[data-act]") : null;
      if (!node || token !== active) {
        return;
      }
      var act = node.getAttribute("data-act");
      if (act === "page") {
        state.page = node.getAttribute("data-page");
        state.tab = "";
        state.pageNo = 1;
        state.panel = "";
      } else if (act === "tab") {
        state.tab = node.getAttribute("data-tab");
        state.pageNo = 1;
      } else if (act === "dim") {
        state.dim = node.getAttribute("data-dim");
        state.pageNo = 1;
      } else if (act === "view") {
        state.view = node.getAttribute("data-view");
      } else if (act === "panel") {
        state.panel = state.panel === node.getAttribute("data-panel") ? "" : node.getAttribute("data-panel");
        paint(root);
        return;
      } else if (act === "expand") {
        var key = node.getAttribute("data-key");
        state.open[key] = !state.open[key];
        paint(root);
        return;
      } else if (act === "page-no") {
        state.pageNo = Math.max(1, state.pageNo + Number(node.getAttribute("data-delta") || 0));
      } else if (act === "scan") {
        fetch("/api/bound/link/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: node.getAttribute("data-provider") }) }).then(function () {
          return load(root, token);
        });
        return;
      } else if (act === "pick") {
        fetch("/api/bound/link/pick", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId: node.getAttribute("data-company") }) }).then(function () {
          return load(root, token);
        });
        return;
      } else if (act === "save-cards" || act === "save-columns") {
        var boxes = root.querySelectorAll("[data-act='" + (act === "save-cards" ? "card" : "column") + "']");
        var chosen = [];
        Array.prototype.forEach.call(boxes, function (box) {
          if (box.checked) {
            chosen.push(box.value);
          }
        });
        var body = { page: state.page };
        body[act === "save-cards" ? "cards" : "columns"] = chosen;
        fetch("/api/bound/prefs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(function () {
          state.panel = "";
          return load(root, token);
        });
        return;
      } else {
        return;
      }
      load(root, token);
    }
    function onChange(event) {
      var node = event.target;
      if (!node.getAttribute) {
        return;
      }
      var act = node.getAttribute("data-act");
      if (act === "from" || act === "to" || act === "shop") {
        state[act === "shop" ? "shop" : act] = node.value;
        state.pageNo = 1;
        load(root, token);
      }
      if (act === "mark") {
        var row = (state.viewData.rows || []).filter(function (item) { return item.key === node.getAttribute("data-key"); })[0] || {};
        var payload = { rowKey: node.getAttribute("data-key"), follow: row.follow, tag: row.tag, target: row.target };
        payload[node.getAttribute("data-field")] = node.value;
        fetch("/api/bound/marks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      }
    }
    root.addEventListener("click", onClick);
    root.addEventListener("change", onChange);
    return function () {
      if (root.removeEventListener) {
        root.removeEventListener("click", onClick);
        root.removeEventListener("change", onChange);
      }
    };
  }

  window.XmModules = window.XmModules || {};
  window.XmModules["/bound"] = {
    mount: function (root) {
      var token = ++active;
      ensureStyle();
      root.innerHTML = '<div class="bd-app" data-bound-erp="false"><nav class="bd-side" aria-label="边界数据中心"></nav><section class="bd-main"><p class="bd-note">爬虫，非 ERP</p></section></div>';
      detach = listen(root, token);
      load(root, token);
      if (typeof setInterval === "function") {
        timer = setInterval(function () {
          if (state.page === "link" && state.admin) {
            load(root, token);
          }
        }, 3000);
      }
      return function () {
        active += 1;
        detach();
        if (typeof clearInterval === "function") {
          clearInterval(timer);
        }
        root.innerHTML = "";
      };
    },
    unmount: function (root) {
      active += 1;
      detach();
      if (typeof clearInterval === "function") {
        clearInterval(timer);
      }
      if (root) {
        root.innerHTML = "";
      }
    }
  };
})();
