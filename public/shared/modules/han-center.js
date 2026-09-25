/* 韩梦凯付费中心 / 充值规则。由 han.js 在 /han/paid?board= 下加载。 */
(function () {
  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function money(value) {
    return (Number(value) || 0).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function jsonFetch(url, options) {
    return fetch(url, Object.assign({ credentials: "same-origin" }, options || {})).then(function (res) {
      return res.json();
    });
  }

  function page(title, lead, body) {
    return (
      '<main class="page han-goods-stage">' +
      '<header class="page-head"><p class="kicker">韩梦凯运营中心</p><h1>' +
      escapeHtml(title) +
      '</h1><p class="lead">' +
      escapeHtml(lead) +
      "</p></header>" +
      body +
      "</main>"
    );
  }

  function mountCenter(root) {
    root.innerHTML = page(
      "付费中心",
      "本地机回传的最新快照。花费、投产比、余额是本地机充值前向京小洁查的。成交金额和充值记录由本地机执行后回传。",
      '<style>' +
        ".han-center-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:0 0 14px}" +
        ".han-center-kpi,.han-center-panel{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:12px 14px}" +
        ".han-center-kpi .lab{font-size:12px;color:#6b7280}" +
        ".han-center-kpi .val{font-size:22px;font-weight:700;margin-top:4px}" +
        ".han-center-panel table{width:100%;border-collapse:collapse;font-size:13px}" +
        ".han-center-panel th,.han-center-panel td{padding:8px 6px;border-bottom:1px solid #f3f4f6;text-align:right;white-space:nowrap}" +
        ".han-center-panel th:first-child,.han-center-panel td:first-child{text-align:left}" +
        ".han-center-panel a{color:#0f766e;font-weight:700;text-decoration:none}" +
        ".han-center-back{border:0;background:#111827;color:#fff;border-radius:999px;padding:6px 12px;cursor:pointer;margin:0 0 10px}" +
        "@media (max-width:800px){.han-center-kpis{grid-template-columns:1fr 1fr}}" +
        "</style>" +
        '<p class="msg status" id="han-center-msg"></p>' +
        '<div id="han-center-body"></div>',
    );
    const body = root.querySelector("#han-center-body");
    const msg = root.querySelector("#han-center-msg");
    let dead = false;

    function overview(json) {
      const totals = json.totals || {};
      const shops = json.shops || [];
      body.innerHTML =
        '<div class="han-center-kpis">' +
        '<div class="han-center-kpi"><div class="lab">店铺</div><div class="val">' +
        escapeHtml(totals.shops || 0) +
        '</div></div><div class="han-center-kpi"><div class="lab">花费</div><div class="val">' +
        escapeHtml(money(totals.spend)) +
        '</div></div><div class="han-center-kpi"><div class="lab">成交单量</div><div class="val">' +
        escapeHtml(totals.orders || 0) +
        '</div></div><div class="han-center-kpi"><div class="lab">成交金额</div><div class="val">' +
        escapeHtml(money(totals.gmv)) +
        "</div></div></div>" +
        '<section class="han-center-panel"><table><thead><tr><th>店铺</th><th>花费</th><th>单量</th><th>ROI</th><th>余额</th><th>成交金额</th></tr></thead><tbody>' +
        (shops.length
          ? shops
              .map(function (row) {
                return (
                  "<tr><td><a href=\"/han/paid?board=center&store=" +
                  encodeURIComponent(row.store) +
                  '" data-han-store="' +
                  escapeHtml(row.store) +
                  '">' +
                  escapeHtml(row.store) +
                  "</a></td><td>" +
                  escapeHtml(money(row.spend)) +
                  "</td><td>" +
                  escapeHtml(row.orders || 0) +
                  "</td><td>" +
                  escapeHtml(row.roi || 0) +
                  "</td><td>" +
                  escapeHtml(money(row.balance)) +
                  "</td><td>" +
                  escapeHtml(money(row.gmv)) +
                  "</td></tr>"
                );
              })
              .join("")
          : '<tr><td colspan="6">还没有本地机回传。接口是 GET/POST /api/han/worker。</td></tr>') +
        "</tbody></table></section>";
      msg.textContent = json.capturedAt ? "快照时间 " + json.capturedAt : "";
    }

    function shopView(json) {
      const subs = json.subaccounts || [];
      const recharges = json.recharges || [];
      body.innerHTML =
        '<button type="button" class="han-center-back" id="han-center-back">返回付费中心</button>' +
        '<section class="han-center-panel"><h2>' +
        escapeHtml(json.store) +
        ' · 子账号</h2><table><thead><tr><th>子账号</th><th>花费</th><th>ROI</th><th>余额</th><th>单量</th></tr></thead><tbody>' +
        (subs.length
          ? subs
              .map(function (row) {
                return (
                  "<tr><td>" +
                  escapeHtml(row.subAccountName || row.subAccountId) +
                  "</td><td>" +
                  escapeHtml(money(row.spend)) +
                  "</td><td>" +
                  escapeHtml(row.roi || 0) +
                  "</td><td>" +
                  escapeHtml(money(row.balance)) +
                  "</td><td>" +
                  escapeHtml(row.orders || 0) +
                  "</td></tr>"
                );
              })
              .join("")
          : '<tr><td colspan="5">没有子账号</td></tr>') +
        '</tbody></table></section><section class="han-center-panel" style="margin-top:12px"><h2>充值记录</h2><table><thead><tr><th>子账号</th><th>金额</th><th>时间</th><th>命中规则</th><th>结果</th></tr></thead><tbody>' +
        (recharges.length
          ? recharges
              .map(function (row) {
                return (
                  "<tr><td>" +
                  escapeHtml(row.subAccountName || row.subAccountId) +
                  "</td><td>" +
                  escapeHtml(money(row.amount)) +
                  "</td><td>" +
                  escapeHtml(row.chargedAt) +
                  "</td><td>" +
                  escapeHtml(row.ruleCode || row.note) +
                  "</td><td>" +
                  escapeHtml(row.result) +
                  "</td></tr>"
                );
              })
              .join("")
          : '<tr><td colspan="5">没有充值记录</td></tr>') +
        "</tbody></table></section>";
    }

    function loadOverview() {
      return jsonFetch("/api/han/worker?view=overview").then(function (json) {
        if (!dead) overview(json);
      });
    }

    function loadShop(store) {
      return jsonFetch("/api/han/worker?view=shop&store=" + encodeURIComponent(store)).then(function (json) {
        if (!dead) shopView(json);
      });
    }

    body.addEventListener("click", function (event) {
      const link = event.target.closest("[data-han-store]");
      if (link) {
        event.preventDefault();
        loadShop(link.getAttribute("data-han-store")).catch(function (err) {
          if (!dead) msg.textContent = String(err);
        });
        return;
      }
      if (event.target.closest("#han-center-back")) {
        loadOverview();
      }
    });

    const store = new URLSearchParams(window.location.search).get("store") || "";
    (store ? loadShop(store) : loadOverview()).catch(function (err) {
      if (!dead) msg.textContent = String(err);
    });
    return function unmount() {
      dead = true;
      root.innerHTML = "";
    };
  }

  function mountRules(root) {
    root.innerHTML = page(
      "充值规则",
      "只保存规则、计划 ROI 和哪些店在跑。本地机拉 GET /api/han/worker 后自己查京小洁、自己充值，再把结果回传。",
      '<style>' +
        ".han-rules-bar{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px}" +
        ".han-rules-bar button{border:0;border-radius:999px;background:#0f766e;color:#fff;padding:6px 14px;cursor:pointer}" +
        ".han-rules-panel{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:12px 14px;margin:0 0 12px}" +
        ".han-rules-panel label{display:inline-flex;gap:6px;align-items:center;margin:0 10px 8px 0;font-size:13px}" +
        ".han-rules-panel table{width:100%;border-collapse:collapse;font-size:13px}" +
        ".han-rules-panel th,.han-rules-panel td{padding:6px;border-bottom:1px solid #f3f4f6;text-align:left}" +
        ".han-rules-panel input{min-height:30px;width:88px;border:1px solid #d1d5db;border-radius:6px;padding:4px 6px}" +
        "</style>" +
        '<p class="msg status" id="han-rules-msg"></p><div id="han-rules-body"></div>',
    );
    const body = root.querySelector("#han-rules-body");
    const msg = root.querySelector("#han-rules-msg");
    let dead = false;
    let rows = [];

    function paint(json) {
      const stores = json.stores || [];
      const run = new Set(json.runShops || []);
      rows = json.rows || [];
      body.innerHTML =
        '<section class="han-rules-panel"><h2>运行店铺</h2><div id="han-run-shops">' +
        (stores.length
          ? stores
              .map(function (store) {
                return (
                  '<label><input type="checkbox" data-run-store="' +
                  escapeHtml(store) +
                  '"' +
                  (run.has(store) ? " checked" : "") +
                  " />" +
                  escapeHtml(store) +
                  "</label>"
                );
              })
              .join("")
          : "<p>等本地机回传子账号后，才能勾选要跑的店。</p>") +
        '</div><div class="han-rules-bar"><button type="button" id="han-run-save">保存运行状态</button></div></section>' +
        '<section class="han-rules-panel"><h2>子账号规则</h2><table><thead><tr><th>店铺</th><th>子账号</th><th>自动充值</th><th>计划ROI</th></tr></thead><tbody>' +
        (rows.length
          ? rows
              .map(function (row, index) {
                return (
                  '<tr data-rule-index="' +
                  index +
                  '"><td>' +
                  escapeHtml(row.store) +
                  "</td><td>" +
                  escapeHtml(row.subAccountName || row.subAccountId) +
                  '</td><td><input type="checkbox" data-rule-auto="' +
                  index +
                  '"' +
                  (row.autoRecharge ? " checked" : "") +
                  ' /></td><td><input data-rule-roi="' +
                  index +
                  '" type="number" step="0.1" value="' +
                  escapeHtml(row.plannedRoi) +
                  '" /></td></tr>'
                );
              })
              .join("")
          : '<tr><td colspan="4">还没有子账号</td></tr>') +
        '</tbody></table><div class="han-rules-bar"><button type="button" id="han-rules-save">保存充值规则</button></div></section>' +
        '<section class="han-rules-panel"><h2>修改记录</h2><ul id="han-rules-history"></ul></section>';
      msg.textContent = "版本 " + (json.version || 0) + " · " + (json.syncStatus || "待同步");
    }

    function load() {
      return Promise.all([
        jsonFetch("/api/han/worker?view=rules"),
        jsonFetch("/api/han/worker?view=history"),
      ]).then(function (pair) {
        if (dead) return;
        paint(pair[0]);
        const list = root.querySelector("#han-rules-history");
        const items = (pair[1] && pair[1].items) || [];
        list.innerHTML = items.length
          ? items
              .map(function (item) {
                return "<li>" + escapeHtml((item.at || "") + " " + (item.actor || "") + " " + (item.summary || "")) + "</li>";
              })
              .join("")
          : "<li>还没有修改</li>";
      });
    }

    body.addEventListener("click", function (event) {
      if (event.target.id === "han-run-save") {
        const runShops = Array.prototype.map
          .call(root.querySelectorAll("[data-run-store]:checked"), function (input) {
            return input.getAttribute("data-run-store");
          });
        jsonFetch("/api/han/worker", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "run", runShops: runShops, changeSummary: "保存运行状态" }),
        }).then(function (json) {
          if (dead) return;
          msg.textContent = json.ok ? "运行状态已保存，版本 " + json.version : json.error || "保存失败";
          if (json.ok) return load();
        });
        return;
      }
      if (event.target.id === "han-rules-save") {
        const next = rows.map(function (row, index) {
          const auto = root.querySelector('[data-rule-auto="' + index + '"]');
          const roi = root.querySelector('[data-rule-roi="' + index + '"]');
          return {
            store: row.store,
            accountId: row.accountId,
            subAccountId: row.subAccountId,
            subAccountName: row.subAccountName,
            autoRecharge: Boolean(auto && auto.checked),
            plannedRoi: roi ? Number(roi.value) : row.plannedRoi,
          };
        });
        jsonFetch("/api/han/worker", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "rules", rows: next, changeSummary: "保存充值规则" }),
        }).then(function (json) {
          if (dead) return;
          msg.textContent = json.ok ? "充值规则已保存，版本 " + json.version : json.error || "保存失败";
          if (json.ok) return load();
        });
      }
    });

    load().catch(function (err) {
      if (!dead) msg.textContent = String(err);
    });
    return function unmount() {
      dead = true;
      root.innerHTML = "";
    };
  }

  window.HanCenter = {
    mount: function (root, board) {
      if (board === "rules") return mountRules(root);
      return mountCenter(root);
    },
  };
})();
