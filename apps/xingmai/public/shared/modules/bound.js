/* global window, URLSearchParams, Blob, setInterval, clearInterval */
/* xm-module-bound — 边界 BI 工作台。只读本库，只请求 /api/bound。爬虫，非 ERP。 */
(function () {
  var state = {
    page: "channelOverview",
    tab: "",
    dim: "sku",
    view: "list",
    shop: "",
    q: "",
    from: "",
    to: "",
    daysType: "",
    pageNo: 1,
    catalog: null,
    viewData: null,
    link: null,
    probe: null,
    probeDate: "",
    probeBusy: false,
    passwordBusy: false,
    loginEditing: false,
    admin: false,
    error: "",
    open: {},
    panel: "",
    area: "province",
    hourType: "pay",
    goodsGroup: "",
    compare: "yoy",
    stockDim: "style",
    hideCombo: false,
    dutyScope: "link",
    hpKind: "hp",
    matchMode: "exact",
    splitWarehouse: false,
    splitCombo: false,
    datePop: "",
    calMonth: "",
    calAnchor: "",
    comboMode: "whole",
    profilePane: "info",
    shopView: "list",
    sortKey: "",
    sortDir: "desc",
    archiveGoodsId: "",
    archiveCard: "",
    archiveCardsExpanded: false,
    archiveCategory: "",
    archiveFlag: "",
    archiveProfit: "",
    archiveColumnsHidden: {},
    archivePageSize: 50,
    archiveSummary: "all",
    archivePromotion: "",
    archiveChartMetric: "",
    archivePeriodDays: 7,
    archiveKeyMetric: "gmv",
    archiveTrendFolded: false,
    archiveRefreshBusy: false
  };
  var active = 0;
  var loadRevision = 0;
  var archivePromise = null, archiveKey = "", archiveRevision = 0, savedOptionsPromise = null;
  function savedUrl(path, query, archive) {
    var scope = archive && archive.scope;
    var saved = archive ? archive.unified : state.savedOptions;
    if (!saved) return "/api/bound/shop-day" + path + (query ? "?" + query : "");
    if (!scope) {
      var options = state.savedOptions, selected = options.shops.find(function (s) { return s.platform + ":" + s.shopId === state.savedShopKey; }) || options.defaultScope;
      scope = { platform: selected.platform, shopId: selected.shopId, from: state.from || options.defaultScope.date, to: state.to || options.defaultScope.date };
    }
    var params = new URLSearchParams(query || "");
    params.set("shopId", scope.shopId); params.set("platform", scope.platform);
    params.set("from", scope.from || scope.date); params.set("to", scope.to || scope.date);
    return "/api/bound/shop-day/saved" + path + "?" + params.toString();
  }
  function sameArchiveScope(a, b) {
    return a && b && a.shopId === b.shopId && a.platform === b.platform && (a.from || a.date) === (b.from || b.date) && (a.to || a.date) === (b.to || b.date);
  }
  async function readSavedOptions(refresh) {
    if (refresh) savedOptionsPromise = null;
    if (!savedOptionsPromise) savedOptionsPromise = (async function () {
      try {
        var r = await fetch("/api/bound/shop-day/saved/options");
        if (!r.ok) return;
        var options = await r.json();
        if (!options.ok || !Array.isArray(options.shops) || !options.defaultScope) return;
        if (!state.savedOptions) {
          state.savedShopKey = options.defaultScope.platform + ":" + options.defaultScope.shopId;
          state.from = state.to = options.defaultScope.date; state.daysType = "1";
        }
        state.savedOptions = options;
      } catch { /* Standalone local harnesses can still serve fixed archived data. */ }
    })();
    await savedOptionsPromise;
  }

  // The standalone loopback harness exposes archived responses. Reading them must
  // never trigger collection or put single-shop rows into the legacy daily table.
  async function readLocalArchive(refresh) {
    if (!window.location) return;
    await readSavedOptions(refresh);
    var url = savedUrl("", ""), changed = archiveKey !== url;
    if (refresh || changed) { archivePromise = null; archiveKey = url; archiveRevision++; }
    var revision = archiveRevision;
    if (changed && state.savedOptions) {
      state.archiveGoodsId = state.archiveCard = state.archiveCategory = state.archiveFlag = state.archiveProfit = state.q = state.sortKey = "";
      state.pageNo = 1; state.open = {};
    }
    if (!archivePromise) archivePromise = (async function () {
      var response = await fetch(url);
      if (!response.ok) { if (state.localArchive || state.savedOptions) throw new Error("archive unavailable"); return; }
      var manifest = await response.json();
      if (!manifest.ok || !manifest.scope || !Array.isArray(manifest.reports)) { if (state.localArchive || state.savedOptions) throw new Error("archive manifest invalid"); return; }
      var records = {};
      var failures = [];
      await Promise.all(manifest.reports.map(async function (report) {
        records[report.id] = [];
        await Promise.all((report.pages || []).map(async function (page) {
          if (page.status !== "received" && page.status !== "empty") return;
          try {
            var result = await fetch(savedUrl("/report", "reportId=" + encodeURIComponent(report.id) + "&page=" + page.page, manifest));
            if (!result.ok) throw new Error("archive unavailable");
            var body = await result.json();
            var record = body.record;
            var scope = record && record.scope;
            if (!body.ok || !scope || !sameArchiveScope(scope, manifest.scope) || record.reportId !== report.id || record.page !== page.page || !Array.isArray(record.rows) || (record.status !== "received" && record.status !== "empty")) throw new Error("archive scope mismatch");
            if (report.product && (!manifest.selected || String(record.goodsId) !== String(manifest.selected.goodsId))) throw new Error("product mismatch");
            records[report.id].push(record);
          } catch { failures.push(report.label + "第 " + page.page + " 页"); }
        }));
        records[report.id].sort(function (a, b) { return a.page - b.page; });
      }));
      if (revision !== archiveRevision) return;
      var previous = state.localArchive;
      var products = previous && !refresh && !changed ? previous.products : {};
      if (manifest.selected) {
        products[String(manifest.selected.goodsId)] = {};
        manifest.reports.filter(function (r) { return r.product; }).forEach(function (r) {
          products[String(manifest.selected.goodsId)][r.id] = records[r.id];
        });
      }
      state.localArchive = { scope: manifest.scope, selected: manifest.selected, records: records, failures: failures, products: products,
        unified: manifest.unified, collectionScope: manifest.collectionScope || manifest.scope, runtime: manifest.runtime || 'local', inventory: manifest.inventory, reports: manifest.reports, run: manifest.runtime === 'server' ? manifest.fourPageRun : manifest.run, exclusions: manifest.exclusions || [], cardRecords: {}, periods: {}, extras: {} };
      if (!previous) {
        state.from = manifest.scope.from || manifest.scope.date; state.to = manifest.scope.to || manifest.scope.date;
        state.daysType = "1";
        state.shop = manifest.scope.shopName;
        state.view = "list";
        state.dim = records.shop_spu_page && records.shop_spu_page.length ? "spu" : "sku";
        if (state.page !== "link") { state.page = "channelAnalysis"; state.tab = "qdfx_jy"; }
        state.pageNo = 1;
      }
      state.shop = manifest.scope.shopName;
      if (changed && !records.shop_spu_page?.length) state.dim = "sku";
      var notice = document.querySelector && document.querySelector(".local-notice");
      if (notice) notice.textContent = "边界数据中心 · 本机已采数据　" + manifest.scope.shopName + " · " + manifest.scope.date + "。采集期间请勿在旧站登录同一账号；本地查看已采数据无需重新登录。";
    })().catch(function () {
      if (revision !== archiveRevision) return;
      state.error = "已采数据读取失败，请刷新重试。";
      if (changed && state.savedOptions) {
        var params = new URL(url, "http://localhost").searchParams;
        var shop = state.savedOptions.shops.find(function (s) { return s.platform + ":" + s.shopId === state.savedShopKey; }) || state.savedOptions.defaultScope;
        state.localArchive = { scope: Object.assign({}, shop, { date: params.get("to"), from: params.get("from"), to: params.get("to") }), unified: true, collectionScope: state.savedOptions.defaultScope, runtime: "server", records: {}, products: {}, failures: [], reports: [], extras: {}, periods: {}, cardRecords: {} };
      }
    });
    await archivePromise;
  }

  function archiveSelected() {
    var archive = state.localArchive;
    var id = state.archiveGoodsId || (archive.selected && archive.selected.goodsId);
    return ((archive.inventory && archive.inventory.items) || []).find(function (p) { return String(p.goodsId) === String(id); }) || (archive.selected && String(archive.selected.goodsId) === String(id) ? archive.selected : null);
  }
  async function readArchiveProduct() {
    if (!state.localArchive || !["productPanorama", "productOperation"].includes(state.page)) return;
    var archive = state.localArchive, selected = archiveSelected();
    if (!selected || archive.products[selected.goodsId]) return;
    var records = {};
    await Promise.all(archive.reports.filter(function (r) { return r.product; }).map(async function (report) {
      records[report.id] = [];
      try {
        var response = await fetch(savedUrl("/report", "reportId=" + encodeURIComponent(report.id) + "&goodsId=" + encodeURIComponent(selected.goodsId) + "&page=1", archive));
        if (!response.ok) return;
        var body = await response.json(), record = body.record;
        if (body.ok && record && ["received", "empty"].includes(record.status) && record.reportId === report.id && record.page === 1 && String(record.goodsId) === String(selected.goodsId) && sameArchiveScope(record.scope, archive.scope) && Array.isArray(record.rows)) records[report.id] = [record];
      } catch { /* Missing or unreadable product tables stay explicitly uncollected. */ }
    }));
    archive.products[selected.goodsId] = records;
  }
  function archiveRecords(id) {
    if (["key_graph", "key_shops", "key_goods", "channel_shop_table", "shop_goods_period", "shop_spu_period"].includes(id)) {
      var extra = state.localArchive.extras[archiveExtraKey(id)];
      return extra && extra.status === 'ready' ? extra.records : [];
    }
    if (/^product_/.test(id || "")) {
      var selected = archiveSelected();
      var records = selected && state.localArchive.products[selected.goodsId];
      return records && records[id] || [];
    }
    return state.localArchive.records[id] || [];
  }
  function archiveExtraKey(id) {
    return id + (['key_shops', 'key_goods'].includes(id) ? ':' + state.archiveKeyMetric : /_period$/.test(id) ? ':' + state.archivePeriodDays : '');
  }
  // These GETs read saved reports only. Navigating a page never logs in or calls BI.
  function fillArchiveExtras(root) {
    var archive = state.localArchive, token = active;
    if (!archive) return;
    var ids = state.page === 'channelOverview' ? ['channel_shop_table'] : state.page === 'channelAnalysisNew' ? ['key_graph'] : state.page === 'productOverview' && state.view === 'period' ? [state.dim === 'spu' ? 'shop_spu_period' : 'shop_goods_period'] : [];
    if (state.page === 'channelAnalysisNew' && archiveRecords('key_graph').length) ids.push(state.tab === 'qd_gjzbfx_dpck' ? 'key_shops' : 'key_goods');
    ids.forEach(function (id) {
      var key = archiveExtraKey(id);
      if (archive.extras[key]) return;
      var metric = ['key_shops', 'key_goods'].includes(id) ? state.archiveKeyMetric : null;
      var days = /_period$/.test(id) ? state.archivePeriodDays : null;
      archive.extras[key] = { status: 'loading', records: [] };
      (async function () {
        var records = [], expected = null, seen = new Set();
        for (var page = 1; page <= 10; page++) {
          var query = '?reportId=' + id + '&page=' + page + (metric ? '&columnKey=' + encodeURIComponent(metric) : '') + (days ? '&trendDays=' + days : '');
          var response = await fetch(savedUrl("/report", query.slice(1), archive));
          if (!response.ok) throw new Error('not_collected');
          var result = await response.json(), r = result.record;
          if (!result.ok || !r || !['received', 'empty'].includes(r.status) || r.reportId !== id || r.page !== page || metric && r.columnKey !== metric || days && r.trendDays !== days || !Array.isArray(r.rows) || !r.scope || !sameArchiveScope(r.scope, archive.scope)) throw new Error('scope_mismatch');
          if (days || id === 'key_goods') {
            if (expected === null) expected = r.total;
            if (!Number.isInteger(expected) || r.total !== expected) throw new Error('pagination_total');
            r.rows.filter(function (row) { return !row.sumLine; }).forEach(function (row) {
              var identity = String(id === 'shop_spu_period' ? row.spuid || '' : row.goodsId || '');
              if (!identity || seen.has(identity) || String(row.shopId) !== archive.scope.shopId || row.platform !== archive.scope.platform) throw new Error('pagination_identity');
              seen.add(identity);
            });
          }
          records.push(r);
          if (!r.nextPage) break;
          if (r.nextPage !== page + 1) throw new Error('pagination_order');
        }
        if (expected !== null && expected !== seen.size) throw new Error('pagination_incomplete');
        archive.extras[key] = { status: 'ready', records: records };
        if (state.localArchive === archive && id === 'key_graph' && !records[0].metricColumns.some(function (c) { return c.columnKey === state.archiveKeyMetric; })) state.archiveKeyMetric = records[0].metricColumns[0].columnKey;
      })().catch(function () { archive.extras[key] = { status: 'missing', records: [] }; }).finally(function () { if (token === active && state.localArchive === archive) paint(root); });
    });
  }
  async function readArchiveCard() {
    if (!state.localArchive || !state.archiveCard) return;
    var archive = state.localArchive, cardId = state.archiveCard;
    var dim = state.page === 'productOverview' ? state.dim : 'sku';
    var key = dim + ':' + cardId;
    if (archive.cardRecords[key]) return;
    var card = archiveRows('shop_cards_' + dim).find(function (c) { return String(c.id) === cardId; });
    if (!card) return;
    var prefix = dim === 'spu' ? 'shop_spu_' : 'shop_goods_';
    var rows = [], expected = null, summary = null;
    async function read(reportId, page) {
      var response = await fetch(savedUrl("/report", "reportId=" + reportId + "&page=" + page + "&cardId=" + encodeURIComponent(cardId), archive));
      if (!response.ok) throw new Error('not_collected');
      var result = await response.json(), r = result.record;
      if (!result.ok || !r || !['received', 'empty'].includes(r.status) || r.cardId !== cardId || r.reportId !== reportId || r.page !== page || !Array.isArray(r.rows) || !sameArchiveScope(r.scope, archive.scope)) throw new Error('invalid_card_archive');
      return r;
    }
    try {
      for (var page = 1; page <= 10; page++) {
        var r = await read(prefix + 'page', page);
        if (expected === null) expected = r.total;
        if (!Number.isInteger(expected) || r.total !== expected || expected !== Number(card.count)) throw new Error('card_count_mismatch');
        rows = rows.concat(r.rows.filter(function (row) { return !row.sumLine; }));
        if (!r.nextPage) break;
        if (r.nextPage !== page + 1) throw new Error('invalid_next_page');
      }
      var identity = dim === 'spu' ? 'spuid' : 'goodsId';
      var known = new Set(archiveRows(prefix + 'page').filter(function (row) { return !row.sumLine; }).map(function (row) { return String(row[identity]); }));
      if (rows.length !== expected || new Set(rows.map(function (row) { return String(row[identity]); })).size !== expected || rows.some(function (row) { return !known.has(String(row[identity])) || String(row.shopId) !== archive.scope.shopId || row.platform !== archive.scope.platform; })) throw new Error('card_scope_mismatch');
      try { summary = (await read(prefix + 'total', 1)).rows[0] || null; } catch { /* List completeness never implies a total response exists. */ }
      archive.cardRecords[key] = { verified: true, rows: rows, summary: summary };
    } catch { archive.cardRecords[key] = { verified: false }; }
  }
  function archiveRows(id) {
    return archiveRecords(id).reduce(function (rows, record) { return rows.concat(record.rows); }, []);
  }
  function archiveColumns(id, rows, explicitTable) {
    var record = archiveRecords(id)[0];
    var payload = record && record.response && record.response.payload;
    var tables = payload && payload.data;
    tables = Array.isArray(tables) ? tables : [tables];
    var table = explicitTable || tables.filter(function (item) { return item && Array.isArray(item.columnInfo); }).pop();
    var info = table ? table.columnInfo.slice() : [];
    if (['channel_shop_table', 'key_shops'].includes(id) && !info.some(function (c) { return c.columnKey === 'shopName'; })) info.unshift({ columnKey: 'shopName', columnName: '店铺' });
    if (id === "product_promotion") {
      var nameKey = rows.some(function (r) { return r.planName != null; }) ? "planName" : "name";
      if (!info.some(function (c) { return c.columnKey === nameKey; })) info.unshift({ columnKey: nameKey, columnName: nameKey === "planName" ? "计划名称" : "类型" });
    }
    if (id === "shop_goods_page" || id === "shop_spu_page") {
      // Match the product list's business order. IDs belong with the product;
      // sales is pieces, never silently relabel it as number of orders.
      var productOrder = [
        ["goodsName", "商品"], ["shopName", "店铺"], ["onSaleTime", "上架时间"],
        ["gmv", "支付金额(支付)"], ["netGmv", "净销售额(支付)"], ["sales", "销售件数(支付)"],
        ["refund", "退款金额"], ["refundRatio", "退款率(按金额)"],
        ["netHpCost", "净货品成本(支付)"], ["netHpCostRatio", "净货品成本占比(支付)"],
        ["tghf", "推广花费(支付预估)"], ["tghfXseZb", "推广花费销售额占比(支付预估)"], ["profit", "利润(支付预估)"]
      ];
      var rest = info.filter(function (c) { return !["goodsId", "spuid"].includes(c.columnKey) && !productOrder.some(function (item) { return item[0] === c.columnKey; }); });
      info = productOrder.map(function (item) {
        return info.find(function (c) { return c.columnKey === item[0]; }) || { columnKey: item[0], columnName: item[1] };
      }).concat(rest);
    }
    if (id === "product_skus" && !info.some(function (c) { return c.columnKey === "skuId"; })) info.unshift({ columnKey: "skuId", columnName: "SKU ID" });
    if (id === "channel_operating") info = info.concat([
      { columnKey: "tghf", columnName: "推广花费(支付预估)" },
      { columnKey: "thtkje", columnName: "退款金额" },
      { columnKey: "jhpcb", columnName: "净货品成本(支付)" },
      { columnKey: "deliverCost", columnName: "发货费用(支付)" }
    ]);
    return info.filter(function (column) { return column.columnKey !== "seeGoods"; }).map(function (column) {
      var key = column.columnKey;
      var style = {};
      try { style = JSON.parse(column.styleRule || "{}"); } catch { /* metadata is optional */ }
      var identifier = /id$|code$|date|hour|time$|name$|province|city|platform|leaders/i.test(key);
      var numeric = !identifier && (style.isNumberCell === true || rows.some(function (row) { return row[key] != null && /^-?\d+(\.\d+)?$/.test(String(row[key])); }));
      return { key: key, label: column.columnName, on: true, numeric: numeric, rate: !!(style.renderAttr && style.renderAttr.formatType === "percent") || /率|占比|同比|环比/.test(column.columnName), sourceRatio: true, sourceValue: true, note: column.note || "", aliases: [] };
    });
  }

  function completeArchivePages(id) {
    var pages = archiveRecords(id), rows = archiveRows(id).filter(function (r) { return r.sumLine !== true; });
    var expected = pages[0] && pages[0].total, key = id === "shop_spu_page" ? "spuid" : "goodsId";
    return !pages.some(function (r) { return r.completeness === 'partial'; }) && Number.isInteger(expected) && expected === rows.length && new Set(rows.map(function (r) { return String(r[key]); })).size === expected && rows.every(function (r) { return r[key] && String(r.shopId) === state.localArchive.scope.shopId; }) && pages.every(function (r, i) { return r.page === i + 1 && r.total === expected; });
  }
  function archiveCardRules(card) {
    try { var rules = JSON.parse(card.calculateRule); return Array.isArray(rules) ? rules : []; } catch { return []; }
  }
  // A source count is not evidence of membership. Enable a local card filter
  // only when every rule field is present and its exact result matches that count.
  function archiveCardRows(card, rows) {
    var rules = archiveCardRules(card);
    var ops = { lt: function (a, b) { return a < b; }, lte: function (a, b) { return a <= b; }, gt: function (a, b) { return a > b; }, gte: function (a, b) { return a >= b; }, eq: function (a, b) { return a === b; } };
    if (!rules.length || rules.some(function (r) { return !ops[r.calculation] || r.compareType && r.compareType !== "value" || r.filterType && r.filterType !== "default" || !Number.isFinite(Number(r.calculatedValue)) || rows.some(function (row) { return row[r.columnKey] == null || row[r.columnKey] === "" || !Number.isFinite(Number(row[r.columnKey])); }); })) return null;
    var filtered = rows.filter(function (row) { return rules.every(function (r) { return ops[r.calculation](Number(row[r.columnKey]), Number(r.calculatedValue)); }); });
    return filtered.length === Number(card.count) ? filtered : null;
  }
  function archivePromotionGroups() {
    var record = archiveRecords("product_promotion")[0];
    var groups = record && record.response.payload.data;
    return Array.isArray(groups) ? groups.filter(function (g) { return g.extensibleTableWrapper && Array.isArray(g.extensibleTableWrapper.columnData); }) : [];
  }
  function buildArchiveView() {
    var archive = state.localArchive;
    var scope = archive.scope;
    var meta = pageMeta() || { id: state.page, label: "边界数据中心" };
    var tabsByPage = {
      channelOverview: [["qdzl_jy", "单店经营概况", "channel_operating"], ["qdzl_dp", "店铺列表", "channel_shop_table"], ["qdzl_pl", "品类分布", "channel_category"]],
      channelAnalysis: [["qdfx_jy", "经营数据", "channel_operating"], ["qdfx_rx", "商品明细", "shop_goods_page"], ["qdfx_pl", "品类分析", "channel_category"], ["qdfx_bqfx", "标签分析", "channel_labels"], ["qdfx_area", "销售地域分析", "channel_area"], ["qdfx_hour", "销售时段分析", "channel_hour"]],
      productOverview: [["sp_zl_list", "商品列表", state.dim === "spu" ? "shop_spu_page" : "shop_goods_page"]],
      channelAnalysisNew: [["qd_gjzbfx_ljck", "按链接查看", "key_goods"], ["qd_gjzbfx_dpck", "按店铺查看", "key_shops"]],
      productPanorama: [["spqj_zl", "总览数据", "product_overview"], ["spqj_sku", "SKU销售分析", "product_skus"], ["spqj_area", "销售地域分析", "product_area"], ["spqj_hour", "销售时段分析", "product_hour"]],
      productOperation: [["spyy_zl", "运营总览", "product_operation"], ["spyy_tg", "推广分析", "product_promotion"], ["spyy_sku", "SKU分析", "product_operation_skus"], ["spyy_area", "销售地域分析", "product_operation_area"], ["spyy_hour", "销售时段分析", "product_operation_hour"]]
    };
    var choices = tabsByPage[state.page] || [];
    var choice = choices.find(function (tab) { return tab[0] === state.tab; }) || choices[0];
    var id = choice && choice[2];
    var validRange = state.from === (scope.from || scope.date) && state.to === (scope.to || scope.date) && (!state.shop || state.shop === scope.shopName);
    var available = !!id && archiveRecords(id).length > 0;
    var partial = available && archiveRecords(id).some(function (r) { return r.completeness === "partial"; });
    // Province rows are marked sumLine by BI, but belong to the province view.
    var rows = available && validRange ? archiveRows(id).filter(function (row) { return row.sumLine !== true || /_area$/.test(id) && row.isProv === true; }) : [];
    if (state.page === 'channelAnalysisNew') rows = rows.map(function (row) {
      var copy = Object.assign({}, row);
      (Array.isArray(row.cells) ? row.cells : []).forEach(function (cell) { if (/^[A-Za-z][A-Za-z0-9_]*$/.test(cell.column) && !['constructor', 'prototype'].includes(cell.column)) copy[cell.column] = cell.value; });
      return copy;
    });
    var product = ["productPanorama", "productOperation"].includes(state.page);
    var goods = ["shop_goods_page", "shop_spu_page"].includes(id);
    var region = /_area$/.test(id || "");
    var complete = !goods || completeArchivePages(id);
    var explicitTable = null, promotionGroups = [], selectedPromotion = null;
    if (id === "product_operation_hour" && available && validRange) {
      // Upstream PeriodAnalysis uses data[0] for its table, data[1] for its chart.
      var hourTables = archiveRecords(id)[0].response.payload.data;
      explicitTable = hourTables[state.view === "chart" ? 1 : 0];
      rows = explicitTable && Array.isArray(explicitTable.columnData) ? explicitTable.columnData.filter(function (r) { return !r.sumLine; }) : [];
    }
    if (id === "product_promotion" && available && validRange) {
      promotionGroups = archivePromotionGroups();
      selectedPromotion = promotionGroups.find(function (g) { return String(g.promoteKey) === state.archivePromotion; }) || promotionGroups[0];
      explicitTable = selectedPromotion && selectedPromotion.extensibleTableWrapper;
      rows = explicitTable ? explicitTable.columnData.filter(function (r) { return !r.sumLine; }) : [];
    }
    if (region) rows = rows.filter(function (row) { return state.area === "city" ? row.isProv !== true : row.isProv === true; });
    var columns = archiveColumns(id, rows, explicitTable);
    var allRows = rows.slice(), categoryOptions = [];
    var classifications = goods && validRange && complete ? archiveRows(id === "shop_spu_page" ? "shop_cards_spu" : "shop_cards_sku") : [];
    var unavailableCard = false;
    if (goods) {
      categoryOptions = Array.from(new Set(rows.map(function (r) { return r.catePathName; }).filter(Boolean))).sort();
      var card = classifications.find(function (c) { return String(c.id) === state.archiveCard; });
      var cardArchive = archive.cardRecords[(id === 'shop_spu_page' ? 'spu:' : 'sku:') + state.archiveCard];
      if (card) { var members = cardArchive && cardArchive.verified ? cardArchive.rows : archiveCardRows(card, rows); unavailableCard = members === null; rows = members || []; }
      if (state.archiveCategory) rows = rows.filter(function (r) { return r.catePathName === state.archiveCategory; });
      if (state.archiveFlag) rows = rows.filter(function (r) { return r[state.archiveFlag] === true || Number(r[state.archiveFlag]) > 0; });
      if (state.archiveProfit) rows = rows.filter(function (r) { return r.profit != null && Number.isFinite(Number(r.profit)) && (state.archiveProfit === "loss" ? Number(r.profit) < 0 : Number(r.profit) >= 0); });
    }
    var q = state.q.trim().toLowerCase();
    if (q) rows = rows.filter(function (row) {
      return (goods ? columns.concat([{ key: "goodsId" }, { key: "spuid" }]) : columns).some(function (column) { return typeof row[column.key] !== "object" && String(row[column.key] == null ? "" : row[column.key]).toLowerCase().indexOf(q) >= 0; });
    });
    if (state.sortKey) rows.sort(function (a, b) {
      var column = columns.find(function (c) { return c.key === state.sortKey; });
      var x = a[state.sortKey], y = b[state.sortKey];
      var cmp = column && column.numeric && x != null && y != null ? Number(x) - Number(y) : String(x == null ? "" : x).localeCompare(String(y == null ? "" : y), "zh");
      return state.sortDir === "asc" ? cmp : -cmp;
    });
    var total = rows.length;
    var pageSize = state.archivePageSize;
    state.pageNo = Math.min(Math.max(1, state.pageNo), Math.max(1, Math.ceil(total / pageSize)));
    var metricReport = product ? (state.page === "productOperation" ? "product_operation" : "product_overview") : (state.page === "productOverview" ? (state.dim === "spu" ? "shop_spu_total" : "shop_goods_total") : "channel_operating");
    var metricRow = validRange && id && state.page !== 'channelAnalysisNew' ? archiveRows(metricReport)[0] : null;
    // A partial goods response is never promoted to a shop total.
    if (state.page === "productOverview" && !complete) metricRow = null;
    var cardDefinitions = [
      ["gmv", "支付金额(支付)"], ["netGmv", "净销售额(支付)"], ["tghf", "推广花费(支付预估)"],
      ["profit", product ? "商品利润(支付预估)" : (state.page === "productOverview" ? "商品合计利润（未扣店铺自定义费用）" : "店铺利润（已扣自定义费用）")],
      [product || state.page === "productOverview" ? "refund" : "thtkje", "退款金额"],
      [product || state.page === "productOverview" ? "netHpCost" : "jhpcb", "净货品成本(支付)"],
      ["ptCost", "平台花费(支付预估)"], ["deliverCost", "发货费用(支付)"],
      [product || state.page === "productOverview" ? "sales" : "zdyFyAll", product || state.page === "productOverview" ? "销售件数(支付)" : "自定义费用"]
    ];
    var cards = metricRow ? cardDefinitions.map(function (entry) {
      return { key: entry[0], label: entry[1], value: metricRow[entry[0]], on: true, sourceValue: true, note: entry[0] === "tghf" ? "保留来源表值；支付预估口径" : "来源表原值" };
    }) : [];
    var message = !validRange ? "当前选择范围未采集。已保存的数据仅覆盖 " + scope.date + "，未采数据不计为 0。" : !id ? "这个页面本轮尚未采集。请查看渠道详情、商品总览或商品全景分析。" : !available ? "这张表尚未采集或档案读取失败。采集完成后点击刷新已采数据。" : !complete ? "商品分页不完整，暂不显示商品合计指标。" : partial ? "以下为已保存的部分明细，不代表全部记录。" : unavailableCard ? "已取得此卡片的数量与规则，但分类明细尚未核验，暂不显示商品列表。选择“全部”可返回。" : total === 0 ? (q || state.archiveCard || state.archiveCategory || state.archiveFlag || state.archiveProfit ? "没有匹配的记录。" : "接口已采集完成，返回 0 条记录。") : "";
    return {
      localArchive: true, page: { id: meta.id, label: meta.label, ops: [] },
      tabs: choices.map(function (tab) { return { id: tab[0], label: tab[1] }; }),
      tab: choice ? { id: choice[0], label: choice[1] } : null,
      range: { from: state.from, to: state.to }, daysType: state.daysType,
      scope: scope, selected: product ? archiveSelected() : null, region: region, goods: goods,
      classifications: classifications, categoryOptions: categoryOptions, allRows: allRows, filteredRows: rows,
      promotionGroups: promotionGroups, selectedPromotion: selectedPromotion,
      promotionSummary: selectedPromotion && selectedPromotion.extensibleTableWrapper.columnData.find(function (r) { return r.sumLine; }),
      reportId: id, complete: complete, partial: partial, message: message,
      goodsSummary: goods && validRange && complete && available ? (state.archiveCard ? cardArchive && cardArchive.verified && cardArchive.summary : archiveRows(id === "shop_spu_page" ? "shop_spu_total" : "shop_goods_total")[0]) : null,
      coverage: { status: validRange && available ? "ready" : "missing" },
      cardStatus: "ready", cards: cards, channelCount: 1, shopCount: 1, shops: [scope.shopName],
      columns: columns.map(function (c) { c.on = !(state.archiveColumnsHidden[id] || []).includes(c.key); return c; }), total: total, pageNo: state.pageNo, pageSize: pageSize,
      rows: rows.slice((state.pageNo - 1) * pageSize, state.pageNo * pageSize).map(function (row, index) {
        var metrics = {};
        Object.keys(row).forEach(function (key) { if (row[key] == null || typeof row[key] !== "object") metrics[key] = row[key]; });
        metrics.payAmount = row.gmv;
        return { key: String(row.goodsId || row.spuid || index), name: row.goodsName || row.planName || row.name || row.date || row.cateName || (region && state.area === "city" ? row.city : row.province) || row.hour, shop: scope.shopName, platform: row.platform, metrics: metrics, raw: row };
      })
    };
  }

  function archiveProductImage(value) {
    if (typeof value !== "string" || !value) return "";
    var candidate = value.indexOf("//") === 0 ? "https:" + value : value.indexOf("://") < 0 ? "https://" + value : value;
    try {
      var url = new URL(candidate);
      // Only the image origin actually present in this shop's archived results.
      if (url.protocol !== "https:" || url.hostname !== "img11.360buyimg.com" || url.port || url.username || url.password) return "";
      return url.href;
    } catch { return ""; }
  }

  function archivePeriodDates() {
    var end = Date.parse(state.localArchive.scope.date + 'T00:00:00Z');
    return Array.from({ length: state.archivePeriodDays }, function (_, i) { return new Date(end - i * 86400000).toISOString().slice(0, 10); }).filter(function (date) { return date >= DATA_START; });
  }
  function inspectArchivePeriod(record, goodsId, scope) {
    if (!record || record.reportId !== 'product_overview' || record.page !== 1 || record.goodsId !== goodsId || record.status !== 'received'
      || !record.scope || record.scope.shopId !== scope.shopId || record.scope.platform !== scope.platform || record.scope.date !== scope.date) throw new Error('period_scope');
    // Product Panorama's Overview uses data[1] for daily history; data[0] is the selected range aggregate.
    var table = record.response && record.response.payload && record.response.payload.code === 0 && record.response.payload.data[1];
    if (!table || !Array.isArray(table.columnData) || !Array.isArray(table.columnInfo) || table.progress != null && Number(table.progress) < 100) throw new Error('period_table');
    var rows = {};
    table.columnData.forEach(function (row) {
      var date = typeof row.date === 'string' ? row.date.replace(/\//g, '-') : '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date + 'T00:00:00Z')) || new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) !== date || date > scope.date
        || rows[date] || row.sumLine || String(row.goodsId) !== goodsId || String(row.shopId) !== scope.shopId || row.platform !== scope.platform) throw new Error('period_row');
      rows[date] = row;
    });
    var anchor = record.rows && record.rows[0];
    if (!anchor || !rows[scope.date] || ['gmv', 'netGmv', 'sales', 'refund', 'tghf', 'profit'].some(function (key) { return rows[scope.date][key] == null || anchor[key] == null || Number(rows[scope.date][key]) !== Number(anchor[key]); })) throw new Error('period_anchor');
    return { status: 'ready', rows: rows, columns: table.columnInfo };
  }
  function fillArchivePeriods(root) {
    var data = state.viewData, archive = state.localArchive, token = active;
    if (!archive || state.page !== 'productOverview' || state.view !== 'period' || !data || data.message || data.reportId !== 'shop_goods_page') return;
    if (archiveRecords('shop_goods_period').length) return;
    var queue = data.rows.map(function (row) { return String(row.metrics.goodsId); }).filter(function (id) { return !archive.periods[id]; });
    if (!queue.length) return;
    queue.forEach(function (id) { archive.periods[id] = { status: 'loading' }; });
    async function worker() {
      while (queue.length) {
        if (token !== active || state.localArchive !== archive) return;
        var goodsId = queue.shift();
        try {
          var cached = archive.products[goodsId] && archive.products[goodsId].product_overview;
          var record = cached && cached[0];
          if (!record) {
            var response = await fetch(savedUrl("/report", "reportId=product_overview&goodsId=" + encodeURIComponent(goodsId) + "&page=1", archive));
            if (!response.ok) throw new Error('period_unavailable');
            var body = await response.json();
            if (!body.ok) throw new Error('period_unavailable');
            record = body.record;
          }
          archive.periods[goodsId] = inspectArchivePeriod(record, goodsId, archive.scope);
        } catch { archive.periods[goodsId] = { status: 'unavailable', rows: {} }; }
      }
    }
    Promise.all(Array.from({ length: Math.min(4, queue.length) }, worker)).then(function () { if (token === active && state.localArchive === archive) paint(root); });
  }
  function archivePeriodColumns(data) {
    var dedicated = archiveRecords(data.reportId === 'shop_spu_page' ? 'shop_spu_period' : 'shop_goods_period');
    if (dedicated.length) return data.columns.filter(function (c) { return ['goodsName', 'onSaleTime'].includes(c.key) || c.numeric && dedicated.some(function (r) { return (r.periods || []).some(function (p) { return p.rows.some(function (row) { return row[c.key] != null; }); }); }); });
    var keys = ['goodsName', 'onSaleTime', 'gmv', 'netGmv', 'sales', 'refund', 'netHpCost', 'tghf', 'profit'];
    // Only common source fields are shown. Missing ratio fields are not inferred from rounded amounts.
    return keys.map(function (key) { return data.columns.find(function (c) { return c.key === key; }); }).filter(Boolean);
  }
  function archivePeriodItem(data, product) {
    var spu = data.reportId === 'shop_spu_page', id = spu ? product.spuid : product.goodsId;
    var records = archiveRecords(spu ? 'shop_spu_period' : 'shop_goods_period');
    if (records.length) {
      var entry = records.flatMap(function (r) { return r.periods || []; }).find(function (p) { return String(spu ? p.spuid : p.goodsId) === String(id); });
      var rows = {};
      if (entry) entry.rows.forEach(function (r) { rows[String(r.date).replace(/\//g, '-')] = r; });
      return { status: entry ? 'ready' : 'unavailable', rows: rows, dedicated: true };
    }
    return spu ? { status: 'unavailable', rows: {} } : state.localArchive.periods[id];
  }
  function archivePeriodPending(data) {
    return data.rows.some(function (row) { var item = archivePeriodItem(data, row.metrics); return !item || item.status === 'loading'; });
  }
  function archivePeriodStatus(item, row) {
    return !item || item.status === 'loading' ? '读取中' : item.status !== 'ready' ? '档案未通过核验，请刷新重试' : row ? '已采集' : '未采集';
  }
  function renderArchivePeriod(data) {
    if (data.reportId === 'shop_spu_page' && !archiveRecords('shop_spu_period').length) return '<p class="bd-miss">SPU 周期使用独立接口，尚未采集。SKU 已有逐日档案，可先切换查看。</p><button type="button" data-act="dim" data-dim="sku">查看 SKU 周期</button>';
    var dates = archivePeriodDates(), columns = archivePeriodColumns(data).filter(function (c) { return c.on; });
    var metrics = columns.filter(function (c) { return !['goodsName', 'onSaleTime'].includes(c.key); });
    var onSale = columns.some(function (c) { return c.key === 'onSaleTime'; });
    var head = '<thead><tr><th class="bd-period-product">商品</th><th>时间范围</th>' + (onSale ? '<th>上架时间</th>' : '') + metrics.map(function (c) { return '<th><button type="button" data-act="sort" data-key="' + esc(c.key) + '" title="按 ' + esc(data.scope.date) + ' 的数值排序">' + esc(c.label) + '</button></th>'; }).join('') + '</tr></thead>';
    var body = data.rows.map(function (product) {
      var p = product.metrics, item = archivePeriodItem(data, p), src = archiveProductImage(p.goodsUrl);
      return '<tbody data-period-product="' + esc(p.goodsId || p.spuid) + '">' + dates.map(function (date, index) {
        var row = item && item.status === 'ready' && item.rows[date];
        var status = archivePeriodStatus(item, row);
        var identity = index ? '' : '<td class="bd-period-product" rowspan="' + dates.length + '"><div class="bd-product-cell"><span class="bd-product-thumb">暂无图' + (src ? '<img src="' + esc(src) + '" alt="' + esc(product.name) + '" loading="lazy" referrerpolicy="no-referrer">' : '') + '</span><div class="bd-product-caption"><button type="button" class="bd-product-name" data-act="archive-product" data-goods-id="' + esc(p.goodsId) + '">' + esc(product.name) + '</button><small class="bd-product-id">ID ' + esc(p.goodsId) + ' · SPU ' + esc(p.spuid || '—') + '</small><small>' + esc(product.shop) + '</small></div></div><div class="bd-period-actions"><button type="button" data-act="archive-product" data-goods-id="' + esc(p.goodsId) + '">全景分析</button><button type="button" data-act="archive-product" data-goods-id="' + esc(p.goodsId) + '" data-product-page="productOperation">运营分析</button></div></td>';
        if (!index && data.reportId === 'shop_spu_page') identity = '<td class="bd-period-product" rowspan="' + dates.length + '"><strong>' + esc(product.name) + '</strong><p>SPU ' + esc(p.spuid) + '</p><p>' + esc(product.shop) + '</p><button type="button" data-act="archive-gallery-spu" data-spuid="' + esc(p.spuid) + '">展开商品链接</button></td>';
        return '<tr data-period-date="' + date + '">' + identity + '<td class="bd-period-date"><time datetime="' + date + '">' + date.replace(/-/g, '/') + '</time><small>' + ['日', '一', '二', '三', '四', '五', '六'][new Date(date + 'T00:00:00Z').getUTCDay()] + '</small></td>' + (!index && onSale ? '<td rowspan="' + dates.length + '">' + esc(p.onSaleTime ? String(p.onSaleTime).split(' ')[0].replace(/-/g, '/') : '—') + '</td>' : '') + metrics.map(function (c) {
          if (!row) return '<td class="bd-period-missing">' + esc(status) + '</td>';
          var value = row[c.key], numeric = value != null && value !== '' && Number.isFinite(Number(value));
          if (!numeric) return '<td title="来源未返回此指标">—</td>';
          var max = Math.max(1, ...dates.map(function (d) { var v = item.rows[d] && item.rows[d][c.key]; return v == null || !Number.isFinite(Number(v)) ? 0 : Math.abs(Number(v)); }));
          return '<td><span class="bd-period-value' + (c.key === 'profit' ? Number(value) < 0 ? ' is-negative' : Number(value) > 0 ? ' is-positive' : '' : '') + '"><i style="width:' + (Math.abs(Number(value)) / max * 100) + '%"></i><b>' + formatCell(value, c) + '</b></span></td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody>';
    }).join('');
    return '<p class="bd-status">商品筛选、排序和上方卡片按 ' + esc(data.scope.date) + '；下表逐日展开截至该日的 ' + dates.length + ' 天。数据来自' + (archiveRecords(data.reportId === 'shop_spu_page' ? 'shop_spu_period' : 'shop_goods_period').length ? '已保存的商品总览周期接口' : '已保存的商品经营趋势') + '，缺失日期不计为 0。</p><div class="bd-scroll"><table class="bd-table bd-period-table">' + head + body + '</table></div>';
  }

  function renderArchiveGoodsTable(data) {
    var columns = data.columns.filter(function (c) { return c.on; });
    var isSpu = data.reportId === "shop_spu_page";
    function valueCell(metrics, column, summary, raw) {
      var value = metrics[column.key];
      if (column.key === "goodsName") {
        if (summary) return '<strong>汇总：' + (state.archiveSummary === "page" ? '当前页' : state.archiveCard ? '当前分类全部' : '全店全部') + '</strong><small class="bd-product-id">' + (state.archiveSummary === "page" ? '展示值相加，可能有取整差异' : '包含零销量商品 · 不随搜索变化') + '</small>';
        var src = archiveProductImage(metrics.goodsUrl);
        var expandable = isSpu && !metrics.goodsId;
        return '<div class="bd-product-cell">' + (expandable ? '<button type="button" class="bd-expand" data-act="expand" data-key="spu-' + esc(metrics.spuid) + '" aria-expanded="' + !!state.open['spu-' + metrics.spuid] + '" aria-label="展开 SPU 商品链接">' + (state.open['spu-' + metrics.spuid] ? '⌄' : '›') + '</button>' : '') + '<span class="bd-product-thumb"><span>暂无图</span>' +
          (src ? '<img src="' + esc(src) + '" alt="' + esc(metrics.goodsName || "商品缩略图") + '" width="32" height="32" loading="lazy" decoding="async" referrerpolicy="no-referrer">' : '') + '</span>' +
          '<div class="bd-product-caption"><button type="button" class="bd-product-name" data-act="' + (expandable ? 'expand' : 'archive-product') + '" data-key="spu-' + esc(metrics.spuid) + '" data-goods-id="' + esc(metrics.goodsId) + '" title="' + esc(value) + '">' + esc(value || "未命名商品") + '</button>' +
          '<small class="bd-product-id" title="商品 ID：' + esc(metrics.goodsId) + '；SPU ID：' + esc(metrics.spuid) + '">ID ' + esc(metrics.goodsId || "—") + ' · SPU ' + esc(metrics.spuid || "—") + '</small></div></div>';
      }
      if (column.key === "shopName") return summary ? "" : '<span class="bd-product-shop" title="' + esc(value || data.scope.shopName) + '">' + esc(value || data.scope.shopName) + '</span>';
      if (column.key === "onSaleTime") return summary ? "" : '<span title="' + esc(value) + '">' + esc(value ? String(value).split(" ")[0].replace(/-/g, "/") : "—") + '</span>';
      // Monetary source rows may be rounded; use the separately collected total.
      if (column.key === "sales" || /Orders$|Count$/.test(column.key)) return value == null || value === "" ? "—" : esc(value);
      var formatted = formatCell(value, column);
      if (column.key === "tghfXseZb" && value != null && value !== "" && Number.isFinite(Number(value))) {
        var width = Math.min(100, Math.max(0, Number(value) * 100));
        return '<span class="bd-ratio-cell"><i style="width:' + width + '%"></i>' + formatted + '</span>';
      }
      var detailKey = { gmv: 'lstGmv', refund: 'lstRefund', netHpCost: 'lstNetHpCost', saleCost: 'lstSaleCost', fhSaleCost: 'lstFhSaleCost', deliverCost: 'lstDeliverCost', tghf: 'lstTghf', ptCost: 'lstPthf' }[column.key];
      var detailRow = raw || metrics;
      var detail = detailKey && detailRow[detailKey];
      if (column.key === 'tghf' && !Array.isArray(detail)) detail = (detailRow.lstSaleCost || []).filter(function (d) { return d.code === 'tghf'; });
      if (Array.isArray(detail) && detail.length) return '<details class="bd-metric-detail"><summary>' + formatted + '</summary><div><strong>' + esc(column.label) + ' · 来源明细</strong>' + detail.map(function (d) { return '<p><span>' + esc(d.name || d.code) + '</span><b>' + esc(d.originCost == null ? d.cost : d.originCost) + '</b></p>'; }).join('') + '<small>明细保留来源精度，表格主值可能已取整。</small></div></details>';
      return formatted;
    }
    var header = '<thead><tr>' + columns.map(function (column, index) {
      var mark = state.sortKey === column.key ? (state.sortDir === "asc" ? " ↑" : " ↓") : "";
      var label = index === 0 ? '商品 <span class="bd-product-dim">' + (isSpu ? '<b>SPU</b> · SKU' : (archiveRecords('shop_spu_page').length ? 'SPU · <b>SKU</b>' : 'SPU（未采集） · <b>SKU</b>')) + '</span>' : esc(column.label);
      return '<th scope="col"' + (state.sortKey === column.key ? ' aria-sort="' + (state.sortDir === "asc" ? "ascending" : "descending") + '"' : '') + '><button type="button" data-act="sort" data-key="' + esc(column.key) + '" title="' + esc(column.note || column.label) + '">' + label + mark + '</button></th>';
    }).join("") + '</tr></thead>';
    var summaryMetrics = data.goodsSummary;
    if (state.archiveSummary === "page" && summaryMetrics) {
      summaryMetrics = {};
      columns.forEach(function (c) {
        if (c.numeric && !c.rate && !/realTime/i.test(c.key) && data.rows.length && data.rows.every(function (r) { return r.metrics[c.key] != null && r.metrics[c.key] !== "" && Number.isFinite(Number(r.metrics[c.key])); })) summaryMetrics[c.key] = Math.round(data.rows.reduce(function (sum, r) { return sum + Number(r.metrics[c.key]); }, 0) * 10000) / 10000;
      });
    }
    var summary = summaryMetrics ? '<tr class="bd-total" data-product-summary="' + esc(state.archiveSummary) + '">' + columns.map(function (column) { return '<td>' + valueCell(summaryMetrics, column, true) + '</td>'; }).join("") + '</tr>' : '';
    function rowHtml(metrics, child, raw) {
      return '<tr' + (child ? ' class="bd-product-child"' : '') + ' data-product-id="' + esc(metrics.goodsId || metrics.spuid) + '">' + columns.map(function (column) { return '<td>' + valueCell(metrics, column, false, raw) + '</td>'; }).join("") + '</tr>';
    }
    var body = data.rows.map(function (row) {
      var html = rowHtml(row.metrics, false, row.raw);
      if (isSpu && state.open['spu-' + row.metrics.spuid]) {
        var children = archiveRows('shop_goods_page').filter(function (r) { return !r.sumLine && String(r.spuid) === String(row.metrics.spuid); });
        html += completeArchivePages('shop_goods_page') ? children.map(function (r) { return rowHtml(r, true); }).join('') : '<tr><td colspan="' + columns.length + '">商品链接分页尚未收齐，暂不展开。</td></tr>';
      }
      return html;
    }).join("");
    return '<div class="bd-scroll bd-product-scroll" tabindex="0" role="region" aria-label="商品明细表，可横向滚动"><table class="bd-table bd-product-table">' + header + '<tbody>' + summary + body + '</tbody></table></div>';
  }

  function renderArchiveClassifications(data) {
    if (data.page.id === 'channelAnalysisNew') return renderArchiveIndicators(data);
    if (data.page.id !== "productOverview" || !data.classifications.length) return renderCards(data);
    var cards = state.archiveCardsExpanded ? data.classifications : data.classifications.slice(0, 4);
    return '<section class="bd-block"><h2>综合指标 <small>商品分类</small></h2><div class="bd-classifications"><button type="button" data-act="archive-card" data-id="" class="bd-class-card' + (!state.archiveCard ? ' is-on' : '') + '"><span>全部</span><strong>' + data.allRows.length + '</strong><small>' + (data.reportId === "shop_spu_page" ? 'SPU' : '商品链接') + '</small></button>' + cards.map(function (c) {
      var rules = archiveCardRules(c).map(function (r) { return (r.columnName || r.columnKey) + ' ' + ({ lt: '<', lte: '≤', gt: '>', gte: '≥', eq: '=' }[r.calculation] || r.calculation) + ' ' + r.calculatedValue + (r.compareType === 'time' ? '（对比期）' : ''); }).join('；');
      var collected = state.localArchive.cardRecords[(data.reportId === 'shop_spu_page' ? 'spu:' : 'sku:') + c.id];
      var supported = collected && collected.verified || archiveCardRows(c, data.allRows) !== null;
      return '<button type="button" data-act="archive-card" data-id="' + esc(c.id) + '" class="bd-class-card' + (state.archiveCard === String(c.id) ? ' is-on' : '') + '" title="' + esc(rules + (supported ? '' : '；分类明细尚未核验')) + '"><span>' + esc(c.labelName ? c.labelName + ' · ' : '') + esc(c.cardName) + '</span><small class="bd-card-rule">' + esc(rules) + '</small><strong>' + esc(c.count) + '</strong><small>占比 ' + formatCell(c.ratio, { numeric: true, rate: true, sourceRatio: true }) + ' · 环比 ' + formatCell(c.grow, { numeric: true, rate: true, sourceRatio: true }) + '</small>' + (!supported ? '<small>分类明细待核验</small>' : '') + '</button>';
    }).join('') + '</div><button type="button" class="bd-plain" data-act="archive-cards-expand">' + (state.archiveCardsExpanded ? '收起' : '展开更多') + '</button></section>';
  }

  function renderArchiveIndicators(data) {
    var record = archiveRecords('key_graph')[0];
    if (!record || data.range.from !== data.scope.date || data.range.to !== data.scope.date) return '<section class="bd-block"><h2>关键指标</h2><p class="bd-miss">关键指标卡和趋势尚未采集。补采后点击“刷新已采数据”。</p></section>';
    var selected = record.metricColumns.find(function (c) { return c.columnKey === state.archiveKeyMetric; });
    var cards = record.metricColumns.map(function (c) {
      var value = record.metricCards[c.columnKey] || {}, rate = /率|占比/.test(c.columnName);
      return '<button type="button" data-act="archive-key-metric" data-key="' + esc(c.columnKey) + '" class="bd-class-card' + (state.archiveKeyMetric === c.columnKey ? ' is-on' : '') + '" title="' + esc(c.note || c.columnName) + '"><span>' + esc(c.columnName) + '</span><strong>' + formatCell(value.value, { numeric: true, rate: rate, sourceRatio: true }) + '</strong><small>同比 ' + formatCell(value.yoy, { numeric: true, rate: true, sourceRatio: true }) + ' · 环比 ' + formatCell(value.mom, { numeric: true, rate: true, sourceRatio: true }) + '</small></button>';
    }).join('');
    var points = record.metricTrend.slice().sort(function (a, b) { return a.date.localeCompare(b.date); });
    var column = { numeric: true, rate: /率|占比/.test(selected && selected.columnName), sourceRatio: true };
    var series = points.map(function (p) { return { date: p.date, cell: p.cells[state.archiveKeyMetric] || {} }; });
    var values = series.flatMap(function (p) { return [p.cell.value, p.cell.lastYearValue].filter(function (v) { return v != null && v !== '' && Number.isFinite(Number(v)); }).map(Number); });
    var min = Math.min(0, ...values), max = Math.max(1, ...values), span = max - min;
    function line(key, color) {
      var segments = [], path = '';
      series.forEach(function (p, i) {
        var v = p.cell[key];
        if (v == null || v === '' || !Number.isFinite(Number(v))) { if (path) segments.push(path); path = ''; return; }
        path += (path ? ' L' : 'M') + (50 + i * 700 / Math.max(1, series.length - 1)) + ',' + (180 - (Number(v) - min) / span * 150);
      });
      if (path) segments.push(path);
      return segments.map(function (d) { return '<path d="' + d + '" stroke="' + color + '" stroke-width="2" fill="none"/>'; }).join('') + series.map(function (p, i) {
        var v = p.cell[key]; if (v == null || v === '' || !Number.isFinite(Number(v))) return '';
        return '<circle cx="' + (50 + i * 700 / Math.max(1, series.length - 1)) + '" cy="' + (180 - (Number(v) - min) / span * 150) + '" r="4" fill="' + color + '"><title>' + esc(p.date + ' ' + (key === 'value' ? '本期' : '去年同期') + ' ' + v) + '</title></circle>';
      }).join('');
    }
    var chart = '<svg viewBox="0 0 800 220" role="img" aria-label="' + esc((selected && selected.columnName) + '趋势，本期及去年同期') + '" style="width:100%;max-height:260px"><path d="M50,20 V180 H750" fill="none" stroke="var(--xm-border,#ddd)"/>' + line('lastYearValue', '#97a2b2') + line('value', '#376bed') + '<text x="50" y="208" fill="currentColor" font-size="12">' + esc(series[0] && series[0].date) + '</text><text x="750" y="208" text-anchor="end" fill="currentColor" font-size="12">' + esc(series.at(-1) && series.at(-1).date) + '</text></svg>';
    var table = '<details><summary>查看趋势数值</summary><div class="bd-scroll"><table class="bd-table"><thead><tr><th>日期</th><th>本期</th><th>去年同期</th><th>同比</th><th>环比</th></tr></thead><tbody>' + series.map(function (p) { return '<tr><td>' + esc(p.date) + '</td>' + ['value', 'lastYearValue', 'yoy', 'mom'].map(function (k) { return '<td>' + formatCell(p.cell[k], ['yoy', 'mom'].includes(k) ? { numeric: true, rate: true, sourceRatio: true } : column) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div></details>';
    return '<section class="bd-block"><h2>关键指标 <small>点击指标联动趋势和明细</small></h2><div class="bd-classifications">' + cards + '</div><button type="button" data-act="archive-trend-fold">' + (state.archiveTrendFolded ? '展开指标趋势' : '收起指标趋势') + '</button>' + (state.archiveTrendFolded ? '' : '<h3>' + esc(selected && selected.columnName) + '</h3><p class="bd-status">蓝色：本期 · 灰色：去年同期；同比和环比保留来源值。</p>' + chart + table) + '</section>';
  }

  function renderArchiveControls(data) {
    var goods = data.goods;
    var period = state.page === 'productOverview' && state.view === 'period';
    var columns = period ? archivePeriodColumns(data) : data.columns;
    var category = goods ? '<select data-act="archive-category" aria-label="品类"><option value="">全部品类</option>' + data.categoryOptions.map(function (c) { return '<option value="' + esc(c) + '"' + (state.archiveCategory === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select>' : '';
    return '<div class="bd-tools bd-archive-tools"><input data-act="q" value="' + esc(state.q) + '" placeholder="搜索商品 / SPU ID / SKU ID / 地域">' + category +
      (goods ? '<select data-act="archive-flag" aria-label="任务筛选"><option value="">全部商品</option>' + [['hasUnread', '跟进'], ['hasTodo', '待办'], ['hasTask', '有任务']].map(function (x) { return '<option value="' + x[0] + '"' + (state.archiveFlag === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select><select data-act="archive-profit" aria-label="盈亏筛选"><option value="">全部盈亏（显示值）</option><option value="profit"' + (state.archiveProfit === 'profit' ? ' selected' : '') + '>盈利及持平（显示值）</option><option value="loss"' + (state.archiveProfit === 'loss' ? ' selected' : '') + '>亏损（显示值）</option></select>' : '') +
      '<button type="button" data-act="archive-reset">重置筛选</button>' + chips(goods ? (state.page === 'productOverview' ? [['list', '列表'], ['period', '周期'], ['gallery', '大图']] : [['list', '列表'], ['gallery', '大图']]) : [['list', '列表'], ['chart', '图表']], 'view') +
      (period ? '<div class="bd-period-days" role="group" aria-label="周期天数">' + [7, 15].map(function (n) { return '<label><input type="radio" name="bound-period-days" data-act="archive-period-days" value="' + n + '"' + (state.archivePeriodDays === n ? ' checked' : '') + '>' + n + '天</label>'; }).join('') + '</div>' : '') +
      (state.view === 'chart' ? '<select data-act="archive-chart-metric" aria-label="图表指标">' + data.columns.filter(function (c) { return c.numeric; }).map(function (c) { return '<option value="' + esc(c.key) + '"' + (archiveChartColumn(data).key === c.key ? ' selected' : '') + '>' + esc(c.label) + '</option>'; }).join('') + '</select>' : '') +
      '<button type="button" data-act="archive-columns">表格设置</button><button type="button" data-act="archive-export"' + (data.message && !data.partial || period && (data.reportId === 'shop_spu_page' && !archiveRecords('shop_spu_period').length || archivePeriodPending(data)) ? ' disabled' : '') + '>' + (period ? '导出本页周期' : '导出当前筛选') + '</button></div>' +
      (state.panel === 'archive-columns' ? '<div class="bd-archive-columns"><strong>显示字段</strong>' + columns.map(function (c) { return '<label><input type="checkbox" data-act="archive-column" data-key="' + esc(c.key) + '"' + (c.on ? ' checked' : '') + (c.key === 'goodsName' ? ' disabled' : '') + '> ' + esc(c.label) + '</label>'; }).join('') + '<button type="button" data-act="archive-columns-reset">恢复全部字段</button></div>' : '');
  }

  function renderArchiveGallery(data) {
    return '<div class="bd-gallery">' + data.rows.map(function (r) {
      var src = archiveProductImage(r.metrics.goodsUrl);
      return '<article class="bd-tile"><span class="bd-product-thumb">暂无图' + (src ? '<img src="' + esc(src) + '" alt="' + esc(r.name) + '" loading="lazy" referrerpolicy="no-referrer">' : '') + '</span><button type="button" class="bd-product-name" data-act="' + (r.metrics.goodsId ? 'archive-product' : 'archive-gallery-spu') + '" data-goods-id="' + esc(r.metrics.goodsId) + '" data-spuid="' + esc(r.metrics.spuid) + '">' + esc(r.name) + '</button><small>' + esc(r.shop) + '</small><p>支付金额：' + formatCell(r.metrics.gmv, { numeric: true }) + '</p><p>推广花费：' + formatCell(r.metrics.tghf, { numeric: true }) + '</p><p>利润：' + formatCell(r.metrics.profit, { numeric: true, key: 'profit' }) + '</p></article>';
    }).join('') + '</div>';
  }

  function archiveRunText() {
    var run = state.localArchive.run;
    if (!run || state.page !== 'link' && state.localArchive.unified) return '查看已保存数据，无需登录 BI 或重新采集。';
    var label = { collecting: '正在采集', running: '正在采集', stopped: '采集已停止', paused: '采集已暂停', complete_with_deferred: '本轮采集完成，仍有待核验项', complete: '采集完成', interrupted: '采集中断' }[run.status] || run.status;
    var reason = run.errors && run.errors.length ? run.errors[run.errors.length - 1].reason : '';
    var error = { login_conflict: '账号已在其他位置登录，请先结束另一处操作后再建立采集会话。', server_login_required: '需要在连接旧站重新登录后续采。', login_expired: '自动重登未恢复会话，请重新登录后续采。', account_disabled: '旧站账号已禁用，已停止重试。', device_restricted: '旧站设备限制，已停止重试。' }[reason] || '';
    return label + '：' + run.done + ' / ' + run.total + ' 项。' + (['collecting', 'running'].includes(run.status) ? '请勿同时在旧站登录此账号。' : error || '查看已保存数据无需登录 BI。');
  }
  function archiveChartColumn(data) {
    return data.columns.find(function (c) { return c.numeric && c.key === state.archiveChartMetric; }) || data.columns.find(function (c) { return c.key === 'gmv'; }) || data.columns.find(function (c) { return c.numeric; }) || {};
  }
  function renderArchiveChart(data) {
    var column = archiveChartColumn(data);
    if (!column.key) return '<p class="bd-miss">此表没有可展示的数值指标。</p>';
    var max = Math.max.apply(Math, [1].concat(data.rows.map(function (r) { return Math.abs(Number(r.metrics[column.key])) || 0; })));
    return '<p class="bd-status">' + esc(column.label) + ' · 当前页记录</p><div class="bd-bars">' + data.rows.map(function (r) {
      var value = r.metrics[column.key];
      var valid = value != null && value !== '' && Number.isFinite(Number(value));
      var width = valid ? Math.abs(Number(value)) / max * 100 : 0;
      return '<div class="bd-bar"><span title="' + esc(r.name) + '">' + esc(r.name || '—') + '</span><i style="width:' + width + '%;' + (Number(value) < 0 ? 'background:#17a66a' : '') + '"></i><b>' + (valid ? formatCell(value, column) : '—') + '</b></div>';
    }).join('') + '</div>';
  }
  function renderArchiveTable(data) {
    if (!data.promotionSummary) return renderTable(data);
    var metrics = Object.assign({}, data.promotionSummary, { planName: '合计（本类型全部计划）' });
    return renderTable(data, [{ key: 'promotion-sum', name: '合计（本类型全部计划）', shop: data.scope.shopName, metrics: metrics }].concat(data.rows));
  }

  function renderArchiveMain(data) {
    var scope = data.scope;
    var selected = data.selected;
    var tabs = data.tabs.map(function (tab) { return '<button type="button" data-act="tab" data-tab="' + esc(tab.id) + '" class="' + (data.tab.id === tab.id ? "is-on" : "") + '">' + esc(tab.label) + '</button>'; }).join("");
    var explanation = data.page.id === 'channelAnalysisNew' ? '指标卡、趋势和下方明细来自关键指标分析专用接口；点击指标切换明细。单店条件下按旧站规则不显示“按渠道查看”。' : data.page.id === "productOverview"
      ? "商品合计取完整分页对应的全部合计，包含零销量但有花费或退款的商品。利润未扣店铺自定义费用；金额保留来源表的显示精度，不将逐行取整金额相加。"
      : selected ? "仅展示这件商品在所选日期的已采结果。金额保留来源表显示精度。"
      : "上方指标取店铺经营表，店铺利润已扣自定义费用。商品、品类等明细表利润口径不同，不能直接替代店铺利润。推广花费为支付预估口径。";
    var provenance = archiveRecords(data.page.id === 'channelAnalysisNew' ? 'key_graph' : data.page.id === 'productOverview' ? data.reportId : 'channel_operating')[0];
    if (provenance && provenance.source) explanation = provenance.source.note + "。保留来源表金额精度与指标口径。";
    if (data.page.id === 'productOverview' && !data.complete) explanation = "展示已保存的商品明细；分页未核齐时不显示全店商品合计或分类数量。";
    var shopPicker = state.savedOptions ? '<label>店铺 <select data-act="saved-shop" aria-label="选择店铺">' + state.savedOptions.shops.map(function (s) { return '<option value="' + esc(s.platform + ':' + s.shopId) + '"' + (s.shopId === scope.shopId && s.platform === scope.platform ? ' selected' : '') + '>' + esc(s.shopName) + '</option>'; }).join('') + '</select></label>' : '';
    var inventory = state.localArchive.inventory;
    var selectProduct = selected ? '<section class="bd-block"><label>选择商品 <select data-act="archive-select-product" aria-label="选择商品">' + ((inventory && inventory.items) || [selected]).map(function (p) { return '<option value="' + esc(p.goodsId) + '"' + (String(p.goodsId) === String(selected.goodsId) ? ' selected' : '') + '>' + esc(p.goodsName + ' · ' + p.goodsId) + '</option>'; }).join('') + '</select></label><p>商品 ID：' + esc(selected.goodsId) + '</p><button type="button" class="bd-plain" data-act="page" data-page="' + (data.page.id === 'productOperation' ? 'productPanorama' : 'productOperation') + '">' + (data.page.id === 'productOperation' ? '查看商品全景' : '查看商品运营分析') + '</button></section>' : '';
    var dim = data.page.id === 'productOverview' ? chips([['spu', 'SPU'], ['sku', 'SKU']], 'dim') : '';
    var report = '<section class="bd-block"><h2>' + esc(data.tab ? data.tab.label : "采集范围") + '</h2>' + dim +
      (data.region ? chips([["province", "按省份"], ["city", "按城市"]], "area") + '<p class="bd-status">省份汇总和城市明细分开展示，避免重复计算。</p>' : "") +
      (data.promotionGroups.length ? '<div class="bd-chips">' + data.promotionGroups.map(function (g) { return '<button type="button" data-act="archive-promotion" data-key="' + esc(g.promoteKey) + '" class="' + (g === data.selectedPromotion ? 'is-on' : '') + '">' + esc(g.promoteName) + '</button>'; }).join('') + '</div><p>' + (data.selectedPromotion.promoteKey === 'wxd' ? '无效单费用见下表，与推广花费口径不同。' : '本推广类型花费：' + formatCell(data.selectedPromotion.sumCost, { numeric: true })) + '</p>' : '') +
      renderArchiveControls(data) +
      (data.goods && state.view !== 'period' ? '<div class="bd-summary-switch">汇总：' + chips([['all', '全部'], ['page', '当前页']], 'archiveSummary') + '</div>' : '') +
      (data.message ? '<p class="bd-miss">' + esc(data.message) + '</p>' : '') +
      (data.message && !(data.partial && data.rows.length) ? '' : data.goods ? (state.view === 'period' && state.page === 'productOverview' ? renderArchivePeriod(data) : state.view === 'gallery' ? renderArchiveGallery(data) : renderArchiveGoodsTable(data)) : state.view === 'chart' ? renderArchiveChart(data) : renderArchiveTable(data)) +
      (data.goods && state.view !== 'period' ? '<p class="bd-status">当前为 ' + (data.reportId === 'shop_spu_page' ? 'SPU 汇总，点击箭头展开商品链接' : 'SKU 商品链接明细') + '。销售件数按接口原口径展示，不等同于销售单数。左右滚动可查看全部指标。</p>' : '') +
      '<div class="bd-sum">当前表 ' + esc(data.total) + ' 条' + (data.goods && data.complete && data.coverage.status === "ready" ? ' · 全店商品分页已收齐' : '') + ' · 表格筛选不改变上方指标范围</div>' +
      '<div class="bd-pager"><select data-act="archive-page-size" aria-label="每页条数">' + [20, 50, 100].map(function (n) { return '<option value="' + n + '"' + (data.pageSize === n ? ' selected' : '') + '>' + n + ' 条/页</option>'; }).join('') + '</select><button type="button" data-act="page-no" data-delta="-1"' + (data.pageNo <= 1 ? " disabled" : "") + '>上一页</button><span>第 ' + data.pageNo + ' / ' + Math.max(1, Math.ceil(data.total / data.pageSize)) + ' 页</span><button type="button" data-act="page-no" data-delta="1"' + (data.pageNo * data.pageSize >= data.total ? " disabled" : "") + '>下一页</button></div></section>';
    return '<section class="bd-main" data-bound-erp="false" data-local-archive="true" data-page="' + esc(data.page.id) + '">' +
      '<header class="bd-head"><div><h1>' + esc(data.page.label) + '</h1><p class="bd-sub">' + (state.localArchive.runtime === 'server' ? '服务器' : '本机') + '已采数据 · ' + esc(scope.platform) + ' · ' + esc(scope.shopName) + '</p></div><div class="bd-filters">' + shopPicker + renderDateBar(data) + '<button type="button" data-act="archive-date">单日 ' + esc(scope.date) + '</button></div></header>' +
      '<div class="bd-archive-progress"><span data-archive-progress>' + esc(archiveRunText()) + '</span><button type="button" data-act="archive-refresh"' + (state.archiveRefreshBusy ? ' disabled' : '') + '>' + (state.archiveRefreshBusy ? '正在刷新…' : '刷新已采数据') + '</button></div>' + selectProduct +
      (state.error ? '<p class="bd-banner" role="alert">' + esc(state.error) + '</p>' : '') +
      (state.localArchive.failures.length ? '<p class="bd-banner">部分档案读取失败：' + esc(state.localArchive.failures.join("、")) + '</p>' : '') +
      (data.page.id === 'channelOverview' ? '<p class="bd-banner">当前总览范围：' + esc(scope.platform) + ' · ' + esc(scope.shopName) + ' · ' + esc(scope.date) + '。全账号渠道汇总和店铺分组尚未采集。</p>' : '') +
      renderArchiveClassifications(data) + '<p class="bd-status">' + esc(explanation) + '</p>' +
      '<div class="bd-tabs">' + tabs + '</div>' + report + '</section>';
  }
  var timer = 0;
  var detach = function () {};

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function xm() {
    return window.XmUI || null;
  }

  function ensureStyle() {
    if (!document.getElementById || document.getElementById("bd-page-style")) {
      return;
    }
    var style = document.createElement("style");
    style.id = "bd-page-style";
    style.textContent = [
      ".bd-app{display:grid;grid-template-columns:112px minmax(0,1fr);min-height:640px;background:#f4f6fa;color:#1f2329;font-size:13px;}",
      ".bd-side{background:#fff;border-right:1px solid #e6e8ee;padding:8px 0;}",
      ".bd-mod{margin:12px 14px 4px;color:#86909c;font-size:12px;}",
      ".bd-side button{display:block;width:100%;height:30px;padding:0 10px;border:0;background:transparent;color:#1f2329;text-align:left;cursor:pointer;font-size:12px;}",
      ".bd-side button.is-on{background:#e8f1ff;color:#3b6cff;font-weight:650;}",
      ".bd-main{min-width:0;padding:24px;}",
      ".bd-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:12px;}",
      ".bd-head h1{margin:0;font-size:18px;font-weight:650;line-height:1.3;}",
      ".bd-sub,.bd-status{margin:4px 0 0;color:#86909c;font-size:12px;line-height:1.5;}",
      ".bd-banner{margin:6px 0 0;color:#d93025;font-size:12px;}",
      ".bd-filters{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;align-items:center;}",
      ".bd-filters input,.bd-filters select,.bd-tools button,.bd-tools a,.bd-pager button,.bd-panel button,.bd-outline{height:30px;padding:0 10px;border:1px solid #e1e4ea;border-radius:4px;background:#fff;color:#1f2329;font:inherit;font-size:12px;text-decoration:none;line-height:28px;cursor:pointer;}",
      ".bd-outline{margin-left:auto;border-color:#3b6cff;color:#3b6cff;}",
      ".bd-datepick{position:relative;display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:8px;color:#4e5969;font-size:12px;}",
      ".bd-stat-time{white-space:nowrap;}",
      ".bd-presets{display:flex;align-items:center;padding:2px;border-radius:4px;background:#f2f3f5;}",
      ".bd-presets button{height:26px;min-width:28px;padding:0 8px;border:0;border-radius:4px;background:transparent;color:#4e5969;cursor:pointer;font:inherit;font-size:12px;}",
      ".bd-presets button.is-on{background:#fff;color:#3b6cff;font-weight:650;}",
      ".bd-presets button.bd-custom{text-decoration:underline;text-decoration-style:dashed;text-underline-offset:3px;}",
      ".bd-presets button:disabled{color:#c9cdd4;cursor:not-allowed;}",
      ".bd-split{width:1px;align-self:stretch;margin:6px 4px;background:#e5e6eb;}",
      ".bd-picker{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;}",
      ".bd-pop{position:absolute;top:36px;right:0;z-index:3;display:flex;gap:6px;align-items:center;padding:8px;background:#fff;border:1px solid #e5e6eb;border-radius:4px;box-shadow:0 6px 16px rgba(29,33,41,.12);}",
      ".bd-custom{position:relative;}",
      ".bd-tip{display:none;position:absolute;top:34px;right:0;z-index:6;width:280px;padding:10px 12px;border-radius:2px;background:#1d2129;color:#fff;font-size:12px;font-weight:400;line-height:1.6;text-align:left;text-decoration:none;white-space:normal;box-shadow:0 6px 16px rgba(0,0,0,.18);}",
      ".bd-custom:hover .bd-tip{display:block;}",
      ".bd-cal{position:absolute;top:40px;right:0;z-index:5;width:560px;padding:8px 12px 10px;background:#fff;border:1px solid #e5e6eb;border-radius:2px;box-shadow:0 8px 24px rgba(29,33,41,.12);}",
      ".bd-cal-months{display:grid;grid-template-columns:1fr 1fr;gap:12px;}",
      ".bd-cal-head{display:grid;grid-template-columns:28px 1fr 28px;align-items:center;height:36px;color:#1d2129;font-size:14px;}",
      ".bd-cal-head strong{text-align:center;font-weight:500;}",
      ".bd-cal-head button{height:28px;border:0;background:transparent;color:#4e5969;cursor:pointer;font-size:16px;}",
      ".bd-cal-head button:disabled{color:#c9cdd4;cursor:not-allowed;}",
      ".bd-cal-week,.bd-cal-grid{display:grid;grid-template-columns:repeat(7,32px);justify-content:center;}",
      ".bd-cal-week span{height:28px;line-height:28px;text-align:center;color:#86909c;font-size:12px;}",
      ".bd-cal-day{height:32px;border:0;background:transparent;color:#1d2129;cursor:pointer;font:inherit;font-size:12px;}",
      ".bd-cal-day.is-out{color:#c9cdd4;}",
      ".bd-cal-day.is-off{color:#c9cdd4;cursor:not-allowed;}",
      ".bd-cal-day.is-mid{background:#e8f3ff;color:#1d2129;border-radius:0;}",
      ".bd-cal-day.is-edge{background:#3b6cff;color:#fff;}",
      ".bd-cal-day.is-edge.is-from{border-radius:4px 0 0 4px;}",
      ".bd-cal-day.is-edge.is-to{border-radius:0 4px 4px 0;}",
      ".bd-cal-day.is-edge.is-one{border-radius:4px;}",
      ".bd-cal-foot{margin:8px 0 0;color:#86909c;font-size:12px;text-align:right;}",
      ".bd-primary{height:30px;padding:0 12px;border:0;border-radius:4px;background:#3b6cff;color:#fff;cursor:pointer;font:inherit;font-size:12px;}",
      ".bd-login{display:grid;gap:10px;max-width:420px;margin:12px 0;}.bd-login label{display:grid;gap:5px;}.bd-login input:not([type=checkbox]){box-sizing:border-box;width:100%;padding:8px;border:1px solid var(--xm-border,#e1e4ea);border-radius:4px;background:var(--xm-bg,#fff);color:inherit;font:inherit;}.bd-login .bd-auto{display:flex;align-items:center;gap:6px;}.bd-login button:disabled{opacity:.6;cursor:wait;}",
      ".bd-kpi-head .bd-primary{margin-left:auto;height:28px;}",
      ".bd-kpis{margin:0 0 12px;padding:8px 4px 12px;background:#fff;border:1px solid #eceff5;border-radius:6px;}",
      ".bd-kpi-head{display:flex;gap:12px;align-items:center;margin:0 12px 4px;font-size:14px;}",
      ".bd-kpi-head span{color:#86909c;font-size:12px;}",
      ".bd-kpi-row{display:flex;flex-wrap:wrap;gap:0;}",
      ".bd-kpi{min-width:132px;padding:8px 14px;background:#fff;border-right:1px solid #f2f3f5;}",
      ".bd-chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px;}",
      ".bd-chip{height:28px;padding:0 10px;border:1px solid #e1e4ea;border-radius:4px;background:#fff;color:#4e5969;cursor:pointer;font:inherit;font-size:12px;}",
      ".bd-chip.is-on{border-color:#3b6cff;color:#3b6cff;background:#e8f1ff;}",
      ".bd-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0 0 12px;}",
      ".bd-stat{padding:12px;background:#fff;border:1px solid #eceff5;border-radius:6px;}",
      ".bd-stat span{display:block;color:#86909c;font-size:12px;}",
      ".bd-stat b{display:block;margin-top:6px;font-size:20px;}",
      ".bd-top3{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 12px;}",
      ".bd-top3 article,.bd-profile{padding:12px;background:#fff;border:1px solid #eceff5;border-radius:6px;}",
      ".bd-top3 h3,.bd-profile h2,.bd-block-title{margin:0 0 8px;font-size:14px;}",
      ".bd-fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;}",
      ".bd-fields div{padding:8px 0;border-bottom:1px solid #f0f2f5;}",
      ".bd-fields span{display:block;color:#86909c;font-size:12px;}",
      ".bd-fields b{display:block;margin-top:4px;font-weight:500;}",
      ".bd-wall{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;}",
      ".bd-wall button{height:32px;padding:0 12px;border:1px solid #e1e4ea;border-radius:4px;background:#fff;cursor:pointer;font:inherit;}",
      ".bd-kpi span{display:block;color:#86909c;font-size:12px;}",
      ".bd-kpi b{display:block;margin:6px 0 4px;font-size:22px;font-weight:650;letter-spacing:-.02em;color:#1d2129;}",
      ".bd-kpi b.is-up{color:#f53f3f;}",
      ".bd-kpi b.is-down{color:#00b42a;}",
      ".bd-kpi em{color:#86909c;font-style:normal;font-size:12px;}",
      ".bd-tabs{display:flex;gap:4px;border-bottom:1px solid #e6e8ee;margin:0 0 12px;}",
      ".bd-tabs button{height:36px;padding:0 12px;border:0;border-bottom:2px solid transparent;background:transparent;color:#4e5969;cursor:pointer;font:inherit;}",
      ".bd-tabs button.is-on{color:#3b6cff;border-bottom-color:#3b6cff;font-weight:650;}",
      ".bd-block{background:#fff;border:1px solid #eceff5;border-radius:6px;padding:12px;}",
      ".bd-block + .bd-block{margin-top:12px;}",
      ".bd-block-bar{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:8px;}",
      ".bd-block-bar h2{margin:0;font-size:14px;font-weight:650;}",
      ".bd-tools{display:flex;flex-wrap:wrap;gap:6px;align-items:center;}",
      ".bd-tools button.is-on{background:#e8f1ff;color:#3b6cff;border-color:#c9dbff;}",
      ".bd-scroll{overflow:auto;}",
      ".bd-table{width:100%;border-collapse:collapse;font-size:12px;}",
      ".bd-table th,.bd-table td{padding:8px 10px;border-bottom:1px solid #f0f2f5;text-align:right;white-space:nowrap;}",
      ".bd-table th:first-child,.bd-table td:first-child,.bd-table th:nth-child(2),.bd-table td:nth-child(2){text-align:left;}",
      ".bd-table th{background:#fafafa;color:#3b6cff;font-weight:500;}",
      ".bd-table th button{border:0;background:transparent;color:inherit;font:inherit;cursor:pointer;}",
      ".bd-table tr.bd-total td{font-weight:650;background:#fafafa;}",
      ".bd-product-scroll{max-height:65vh;border:1px solid var(--xm-border,#e5e7eb);border-radius:5px;margin-top:10px;}",
      ".bd-metric-detail summary{cursor:pointer;list-style:none;text-decoration:underline dotted;text-underline-offset:3px}.bd-metric-detail>div{min-width:240px;max-width:360px;white-space:normal;text-align:left;padding:10px;background:var(--xm-bg,#f5f8ff);border:1px solid var(--xm-border,#d7e0ef)}.bd-metric-detail p{display:flex;justify-content:space-between;gap:15px;margin:7px 0;font-size:12px}.bd-metric-detail small{font-size:11px;color:var(--xm-muted,#66748a)}",
      ".bd-archive-progress{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;margin:10px 0;background:var(--xm-bg,#edf3ff);border:1px solid var(--xm-border,#dce6ff);border-radius:5px;font-size:12px}.bd-archive-progress button,.bd-plain{border:0;background:transparent;color:var(--xm-accent,#3b6cff);cursor:pointer;font:inherit}",
      ".bd-archive-tools{flex-wrap:wrap}.bd-archive-tools select,.bd-pager select,.bd-block select{max-width:100%;height:30px;border:1px solid var(--xm-border,#e1e4ea);border-radius:4px;background:var(--xm-bg,#fff);color:inherit;padding:0 6px}.bd-archive-tools select{max-width:240px}.bd-archive-columns{display:flex;flex-wrap:wrap;gap:12px;padding:12px;border:1px solid var(--xm-border,#e1e4ea);margin:8px 0}.bd-archive-columns strong{width:100%}.bd-summary-switch{display:flex;align-items:center;gap:10px;margin-top:10px}",
      ".bd-classifications{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px;margin:12px 0}.bd-class-card{display:grid;gap:8px;min-height:105px;text-align:left;padding:12px;border:1px solid var(--xm-border,#d7e0ef);border-radius:4px;background:var(--xm-bg,#fff);color:inherit;cursor:pointer;font:inherit}.bd-class-card strong{font-size:21px}.bd-class-card small{font-size:11px;color:var(--xm-muted,#66748a)}.bd-class-card.is-on{background:#3b6cdf;color:white}.bd-class-card.is-on small{color:inherit}.bd-card-rule{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bd-block h2 small{font-weight:400;color:#86909c;margin-left:8px}.bd-product-child td{background:var(--xm-bg,#f6f9ff)!important}.bd-product-child td:first-child{padding-left:32px}.bd-expand{border:0;background:transparent;cursor:pointer;color:#3b6cff;font-size:18px}.bd-tile .bd-product-thumb{width:100%;height:150px;margin-bottom:10px;display:block}.bd-tile .bd-product-thumb img{width:100%;height:100%;object-fit:contain}.bd-tile .bd-product-name{white-space:normal}.bd-tile small{display:block;color:#86909c}",
      ".bd-product-table{border-collapse:separate;border-spacing:0;background:var(--xm-surface,#fff);}",
      ".bd-period-days{display:flex;gap:10px;align-items:center}.bd-period-days label{display:flex;align-items:center;gap:4px;white-space:nowrap}.bd-period-table{border-collapse:separate;border-spacing:0;background:var(--xm-surface,#fff)}.bd-period-table th{position:sticky;top:0;z-index:3;background:var(--xm-bg,#eef3ff)}.bd-period-table td{padding:3px 8px;height:24px;border-bottom:0;vertical-align:middle}.bd-period-table tbody:nth-of-type(odd){background:var(--xm-bg,#f2f5fa)}.bd-period-table tbody tr:last-child td{border-bottom:1px solid var(--xm-border,#d7e0ef)}.bd-period-table .bd-period-product{position:sticky;left:0;min-width:280px;max-width:280px;box-sizing:border-box;z-index:2;background:var(--xm-surface,#fff);white-space:normal;border-right:1px solid var(--xm-border,#d7e0ef);border-bottom:1px solid var(--xm-border,#d7e0ef);padding:12px}.bd-period-table th.bd-period-product{z-index:4;background:var(--xm-bg,#eef3ff)}.bd-period-table .bd-product-thumb,.bd-period-table .bd-product-thumb img{width:78px;height:100px;flex-basis:78px}.bd-period-table .bd-product-name{white-space:normal;display:block;line-height:1.5;text-align:left;max-height:7.5em;overflow:hidden}.bd-period-table .bd-product-caption small{display:block;color:var(--xm-muted,#66748a);font-size:11px;overflow-wrap:anywhere}.bd-period-actions{display:flex;gap:6px;margin-top:8px}.bd-period-actions button{border:0;background:#3b6cdf;color:white;border-radius:3px;padding:4px 7px;cursor:pointer}.bd-period-date small{margin-left:10px;color:var(--xm-muted,#66748a)}.bd-period-value{display:block;position:relative;min-width:90px;padding:0 5px;text-align:right;isolation:isolate}.bd-period-value i{position:absolute;inset:2px auto 2px 0;z-index:-1;background:#d5e8fa;border-radius:4px}.bd-period-value b{font-weight:400}.bd-period-value.is-positive i{background:#f8ceca}.bd-period-value.is-negative i{background:#ccebdc}.bd-period-missing{color:var(--xm-muted,#66748a);font-size:11px}",
      ".bd-product-table th{position:sticky;top:0;z-index:3;height:46px;box-sizing:border-box;background:var(--xm-bg,#eef3ff);color:var(--xm-text,#173d75);}",
      ".bd-product-table th:first-child,.bd-product-table td:first-child{position:sticky;left:0;min-width:260px;max-width:260px;width:260px;box-sizing:border-box;z-index:2;background:var(--xm-surface,#fff);border-right:1px solid var(--xm-border,#e5e7eb);}",
      ".bd-product-table th:first-child{z-index:5;background:var(--xm-bg,#eef3ff);}",
      ".bd-product-table .bd-total td{position:sticky;top:46px;z-index:2;background:var(--xm-bg,#f4f7ff);}",
      ".bd-product-table .bd-total td:first-child{z-index:4;}",
      ".bd-product-cell{display:flex;align-items:center;gap:8px;min-height:38px;}",
      ".bd-product-thumb{position:relative;flex:0 0 32px;width:32px;height:32px;display:grid;place-items:center;background:var(--xm-bg,#f4f6fa);border:1px solid var(--xm-border,#e5e7eb);border-radius:4px;color:var(--xm-muted,#86909c);font-size:9px;}",
      ".bd-product-thumb img{position:absolute;inset:0;width:32px;height:32px;object-fit:contain;background:var(--xm-surface,#fff);border-radius:3px;}",
      ".bd-product-caption{min-width:0;flex:1;}.bd-product-name{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:inherit;line-height:20px;color:var(--xm-primary,#1677ff);background:none;border:0;padding:0;text-align:left;}.bd-product-name[data-act]{cursor:pointer;text-decoration:underline;text-underline-offset:3px;}",
      ".bd-product-id{display:block;font-size:10px;line-height:16px;font-weight:400;color:var(--xm-muted,#86909c);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}.bd-product-shop{display:block;max-width:170px;overflow:hidden;text-overflow:ellipsis;color:var(--xm-primary,#1677ff);}",
      ".bd-product-dim{font-size:10px;margin-left:8px;color:var(--xm-muted,#86909c);}.bd-product-dim b{color:var(--xm-primary,#1677ff);}",
      ".bd-ratio-cell{display:block;position:relative;min-width:100px;isolation:isolate;}.bd-ratio-cell i{position:absolute;left:0;top:0;bottom:0;z-index:-1;border-radius:4px;background:#d8e8ff;}.bd-ratio-cell .bd-num{position:relative;}",
      ".bd-dot{display:inline-block;width:8px;height:8px;margin-right:6px;border-radius:2px;vertical-align:middle;}",
      ".bd-num{display:inline-block;min-width:56px;padding:2px 6px;border-radius:2px;text-align:right;color:#1d2129;}",
      ".bd-num.is-neg{color:#00b42a;}",
      ".bd-num.is-solid.is-up{background:#f53f3f;color:#fff;}",
      ".bd-num.is-solid.is-down{background:#00b42a;color:#fff;}",
      ".bd-bars{display:flex;flex-direction:column;gap:8px;padding:8px 0;}",
      ".bd-bar{display:grid;grid-template-columns:120px minmax(0,1fr) 120px;gap:8px;align-items:center;}",
      ".bd-bar i{display:block;height:8px;background:#3b6cff;border-radius:4px;}",
      ".bd-miss{color:#c0c4cc;}",
      ".bd-linkish{padding:0;border:0;background:transparent;color:#3b6cff;cursor:pointer;font:inherit;font-size:12px;}",
      ".bd-gallery{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;}",
      ".bd-tile{min-height:120px;padding:12px;border:1px solid #eceff5;border-radius:6px;background:#fff;}",
      ".bd-tile strong{display:block;margin-bottom:6px;font-size:14px;}",
      ".bd-sum,.bd-pager{display:flex;gap:16px;align-items:center;margin-top:10px;color:#4e5969;font-size:12px;}",
      ".bd-pager{justify-content:flex-end;}",
      ".bd-panel{margin:0 0 12px;padding:10px 12px;background:#fff;border:1px solid #eceff5;border-radius:6px;}",
      ".bd-panel label{display:flex;gap:6px;align-items:center;margin:4px 12px 4px 0;font-size:12px;}",
      ".bd-qr{width:180px;height:180px;object-fit:contain;background:#fff;}",
      ".bd-now{margin:0 0 8px;font-size:13px;}",
      ".bd-meter{height:8px;margin:8px 0 12px;background:#f2f3f5;border-radius:4px;overflow:hidden;}",
      ".bd-meter i{display:block;height:100%;background:#3b6cff;}",
      ".bd-progress{max-height:420px;overflow:auto;}",
      ".bd-progress td.is-current{color:#3b6cff;font-weight:650;}",
      ".bd-reason{margin-top:2px;max-width:280px;color:#8a93a6;font-size:12px;font-weight:400;white-space:normal;}",
      ".bd-detail{white-space:normal;text-align:left;font-size:12px;line-height:1.6;color:#4e5969;}",
      "@media(max-width:900px){.bd-head{flex-direction:column}.bd-gallery{grid-template-columns:1fr 1fr}}"
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
    if (state.daysType) {
      params.set("daysType", state.daysType);
    }
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
        buttons += '<button type="button" data-act="page" data-page="link" class="' + (state.page === "link" ? "is-on" : "") + '">连接旧站</button>';
      }
      return '<div class="bd-mod">' + esc(mod.label) + "</div>" + buttons;
    }).join("");
  }

  var BLURBS = {
    channelOverview: "全渠道经营指标、渠道与店铺数据使用同一统计口径。",
    channelAnalysis: "按店铺查看经营、流量、业绩、地域和时段。",
    channelAnalysisNew: "按链接、店铺、渠道对比关键指标。",
    productOverview: "商品销售、流量和转化使用同一统计口径。",
    productPanorama: "从渠道、SKU、地域和库存看商品全景。",
    productOperation: "商品流量、搜索、推广和素材运营。",
    productStock: "商品总库存数据。支持按款式、按货品查看。",
    hpOverview: "货品名称、编码和店铺使用同一套货品资料。",
    hpPanorama: "按货品或款式看总览、渠道布局、商品布局、SKU 全渠道、库存、品牌和发货仓库。",
    hpStock: "货品总库存综合指标和库存明细。",
    teamOverview: "链接管理、店铺管理、业绩对比和个人榜单、团队榜单。",
    teamSkills: "销售额贡献和提成收入。",
    teamMemberDetail: "管理店铺、责权链接和岗位工作明细。访客相关指标按单日累加。",
    teamMemberProfile: "团队综合指标和成员档案。",
    myProjects: "当前账号在旧站工作台里的项目。",
    personalCenter: "账号绑定、密码和手机号。"
  };

  function cardTitle(pageId) {
    if (pageId === "channelAnalysis") return "店铺综合指标";
    if (pageId === "productStock") return "商品总库存综合指标";
    if (pageId === "hpStock") return "货品总库存综合指标";
    if (pageId === "hpOverview") return "货品综合指标";
    if (pageId === "teamOverview" || pageId === "teamMemberProfile" || pageId === "teamMemberDetail") return "团队综合指标";
    return "综合指标";
  }

  function searchPlaceholder(pageId) {
    if (pageId === "teamMemberProfile") return "请输入成员名称";
    if (pageId === "hpOverview" || pageId === "hpPanorama" || pageId === "hpStock") return "货品名称/编码/款式编码";
    return "搜索商品、店铺、负责人";
  }

  function iso(date) {
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    return date.getFullYear() + "-" + month + "-" + day;
  }

  function parseIso(value) {
    var parts = String(value || "").split("-");
    if (parts.length !== 3) {
      return new Date();
    }
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  function addDays(date, delta) {
    var next = new Date(date.getTime());
    next.setDate(next.getDate() + delta);
    return next;
  }

  var DATA_START = "2026-09-01";

  function shanghaiToday() {
    try {
      return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    } catch {
      return iso(new Date());
    }
  }

  function weekStart(value) {
    var date = parseIso(value);
    return iso(addDays(date, -((date.getDay() + 6) % 7)));
  }

  function monthEndIso(startIso) {
    var date = parseIso(startIso);
    return iso(new Date(date.getFullYear(), date.getMonth() + 1, 0));
  }

  function reliableDay() {
    return iso(addDays(parseIso(shanghaiToday()), -2));
  }

  function clampRange(from, to) {
    var cap = reliableDay();
    if (to > cap) {
      to = cap;
    }
    if (from > cap) {
      from = cap;
    }
    if (from < DATA_START) {
      from = DATA_START;
    }
    if (to < DATA_START) to = DATA_START;
    if (from > to) {
      from = to;
    }
    return { from: from, to: to };
  }

  function weekContains(mondayIso, dayIso) {
    var end = iso(addDays(parseIso(mondayIso), 6));
    return dayIso >= mondayIso && dayIso <= end;
  }

  function isoWeekValue(mondayIso) {
    var monday = parseIso(weekStart(mondayIso));
    var thursday = addDays(monday, 3);
    var year = thursday.getFullYear();
    var jan4 = new Date(year, 0, 4);
    var week1 = addDays(jan4, -((jan4.getDay() + 6) % 7));
    var week = Math.floor(Math.round((monday.getTime() - week1.getTime()) / 86400000) / 7) + 1;
    return year + "-W" + String(week).padStart(2, "0");
  }

  function mondayFromWeekValue(value) {
    var match = /^(\d{4})-W(\d{2})$/.exec(String(value || ""));
    if (!match) {
      return "";
    }
    var year = Number(match[1]);
    var week = Number(match[2]);
    var jan4 = new Date(year, 0, 4);
    var week1 = addDays(jan4, -((jan4.getDay() + 6) % 7));
    return iso(addDays(week1, (week - 1) * 7));
  }

  function rollingRange(days) {
    var end = parseIso(reliableDay());
    var range = clampRange(iso(addDays(end, -(days - 1))), iso(end));
    return { from: range.from, to: range.to, daysType: String(days) };
  }

  function latestWeek() {
    var cap = reliableDay();
    var monday = weekStart(cap);
    var sunday = iso(addDays(parseIso(monday), 6));
    if (sunday > cap) {
      monday = iso(addDays(parseIso(monday), -7));
    }
    return clampRange(monday, iso(addDays(parseIso(monday), 6)));
  }

  function defaultCalendarRange(preset) {
    var today = shanghaiToday();
    var range;
    if (preset === "date") {
      var day = clampRange(reliableDay(), reliableDay());
      return { from: day.from, to: day.to, daysType: "1" };
    }
    if (preset === "week") {
      range = latestWeek();
      return { from: range.from, to: range.to, daysType: "week" };
    }
    if (preset === "month") {
      var start = today.slice(0, 7) + "-01";
      range = clampRange(start, monthEndIso(start));
      return { from: range.from, to: range.to, daysType: "month" };
    }
    if (preset === "year") {
      range = clampRange(today.slice(0, 4) + "-01-01", today.slice(0, 4) + "-12-31");
      return { from: range.from, to: range.to, daysType: "year" };
    }
    return null;
  }

  function shiftRange(delta) {
    var cap = reliableDay();
    var start, range;
    var type = state.daysType;
    if (!state.from || (type !== "1" && type !== "week" && type !== "month" && type !== "year")) {
      return null;
    }
    if (type === "1") {
      var day = iso(addDays(parseIso(state.from), delta));
      if (day < DATA_START || day > cap) {
        return null;
      }
      return { from: day, to: day, daysType: "1" };
    }
    if (type === "week") {
      start = iso(addDays(parseIso(weekStart(state.from)), delta * 7));
      var end = iso(addDays(parseIso(start), 6));
      if (end < DATA_START || start > cap || end > cap) {
        return null;
      }
      return { from: start, to: end, daysType: "week" };
    }
    if (type === "month") {
      var cursor = parseIso(state.from.slice(0, 7) + "-01");
      cursor.setMonth(cursor.getMonth() + delta);
      start = iso(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
      if (start < DATA_START || start > cap) {
        return null;
      }
      range = clampRange(start, monthEndIso(start));
      return { from: range.from, to: range.to, daysType: "month" };
    }
    var year = Number(state.from.slice(0, 4)) + delta;
    start = year + "-01-01";
    if (year < 2026 || start > cap) {
      return null;
    }
    range = clampRange(start, year + "-12-31");
    return { from: range.from, to: range.to, daysType: "year" };
  }

  function daySpan(from, to) {
    var start = parseIso(from);
    var end = parseIso(to);
    return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  }

  function addMonth(ym, delta) {
    var parts = String(ym || "").split("-");
    var date = new Date(Number(parts[0]), Number(parts[1]) - 1 + delta, 1);
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
  }

  function monthCells(ym) {
    var parts = String(ym).split("-");
    var year = Number(parts[0]);
    var month = Number(parts[1]);
    var first = new Date(year, month - 1, 1);
    var lead = (first.getDay() + 6) % 7;
    var count = new Date(year, month, 0).getDate();
    var cells = [];
    var index;
    for (index = 0; index < lead; index += 1) {
      var prev = new Date(year, month - 1, 1 - (lead - index));
      cells.push({ iso: iso(prev), day: prev.getDate(), inMonth: false });
    }
    for (index = 1; index <= count; index += 1) {
      var day = String(index).padStart(2, "0");
      cells.push({ iso: ym + "-" + day, day: index, inMonth: true });
    }
    var next = 1;
    while (cells.length % 7 !== 0) {
      var tail = new Date(year, month, next);
      cells.push({ iso: iso(tail), day: tail.getDate(), inMonth: false });
      next += 1;
    }
    return cells;
  }

  function renderMonth(ym, side) {
    var today = shanghaiToday();
    var todayMonth = today.slice(0, 7);
    var from = state.calAnchor || state.from;
    var to = state.calAnchor ? state.calAnchor : state.to;
    var week = ["一", "二", "三", "四", "五", "六", "日"].map(function (name) {
      return "<span>" + name + "</span>";
    }).join("");
    var days = monthCells(ym).map(function (cell) {
      var off = cell.iso < DATA_START || cell.iso > reliableDay();
      if (state.calAnchor && !off && Math.abs(daySpan(state.calAnchor, cell.iso) - 1) > 59) {
        off = true;
      }
      var edge = !off && (cell.iso === from || cell.iso === to);
      var mid = !off && from && to && cell.iso > from && cell.iso < to;
      var one = edge && from === to;
      var cls = "bd-cal-day";
      if (!cell.inMonth) cls += " is-out";
      if (off) cls += " is-off";
      if (mid) cls += " is-mid";
      if (edge) cls += " is-edge" + (one ? " is-one" : cell.iso === from ? " is-from" : " is-to");
      return '<button type="button" class="' + cls + '" data-act="cal-day" data-day="' + cell.iso + '"' + (off ? " disabled" : "") + ">" + cell.day + "</button>";
    }).join("");
    var prev = side === "left" ? '<button type="button" data-act="cal-shift" data-delta="-1"' + (ym <= "2026-09" ? " disabled" : "") + ' aria-label="上个月">«</button>' : "<span></span>";
    var next = side === "right" ? '<button type="button" data-act="cal-shift" data-delta="1"' + (addMonth(ym, 0) > todayMonth ? " disabled" : "") + ' aria-label="下个月">»</button>' : "<span></span>";
    var title = Number(ym.slice(0, 4)) + " 年 " + Number(ym.slice(5, 7)) + " 月";
    return '<section><div class="bd-cal-head">' + prev + "<strong>" + title + "</strong>" + next + '</div><div class="bd-cal-week">' + week + '</div><div class="bd-cal-grid">' + days + "</div></section>";
  }

  function renderCustomCalendar() {
    var left = state.calMonth || (state.from || shanghaiToday()).slice(0, 7);
    if (left < "2026-09") left = "2026-09";
    var right = addMonth(left, 1);
    return '<div class="bd-cal"><div class="bd-cal-months">' + renderMonth(left, "left") + renderMonth(right, "right") + '</div><p class="bd-cal-foot">*最少选择 1 天，最多选择 60 天</p></div>';
  }

  function activePreset() {
    var map = { "1": "date", "7": "day7", "30": "day30", week: "week", month: "month", year: "year", custom: "custom" };
    return map[state.daysType] || "";
  }

  function applyRange(range) {
    state.from = range.from;
    state.to = range.to;
    state.daysType = range.daysType;
    state.pageNo = 1;
  }

  function cnDate(value) {
    var parts = String(value || "").split("-");
    if (parts.length !== 3) {
      return "";
    }
    return parts[0] + "年" + Number(parts[1]) + "月" + Number(parts[2]) + "日";
  }

  function statText(from, to, daysType) {
    if (!from || !to) {
      return "（统计时间：）";
    }
    var single = daysType === "1" || from === to;
    if (from.slice(0, 4) !== to.slice(0, 4)) {
      return "（统计时间：" + cnDate(from) + (single ? "" : "-" + cnDate(to)) + "）";
    }
    var text = from.slice(0, 4) + "年" + Number(from.slice(5, 7)) + "月" + Number(from.slice(8, 10)) + "日";
    if (!single) {
      text += "-" + Number(to.slice(5, 7)) + "月" + Number(to.slice(8, 10)) + "日";
    }
    return "（统计时间：" + text + "）";
  }

  function yearChoices() {
    var end = Number(shanghaiToday().slice(0, 4));
    var years = [];
    var year = 2026;
    while (year <= end) {
      years.push(String(year));
      year += 1;
    }
    return years;
  }

  function renderDateBar(data) {
    var daysType = state.daysType || (data.range.from === data.range.to ? "1" : "");
    var preset = activePreset();
    var buttons = [["day7", "7天"], ["day30", "30天"], ["date", "日"], ["week", "周"], ["month", "月"], ["year", "年"]].map(function (item) {
      return '<button type="button" data-act="preset" data-preset="' + item[0] + '" class="' + (preset === item[0] ? "is-on" : "") + '">' + item[1] + "</button>";
    }).join("");
    var today = shanghaiToday();
    var cap = reliableDay();
    var dayValue = daysType === "1" && data.range.from ? data.range.from : cap;
    var monday = daysType === "week" && data.range.from ? weekStart(data.range.from) : iso(addDays(parseIso(weekStart(today)), -7));
    var monthValue = (daysType === "month" && data.range.from ? data.range.from : today).slice(0, 7);
    var years = yearChoices().map(function (year) {
      var on = daysType === "year" && data.range.from && data.range.from.slice(0, 4) === year;
      return '<button type="button" data-act="pick-year" data-year="' + year + '" class="' + (on ? "is-on" : "") + '">' + year + "年</button>";
    }).join("");
    return '<div class="bd-datepick"><span class="bd-stat-time">' + esc(statText(data.range.from, data.range.to, daysType)) + '</span><div class="bd-presets">' + buttons +
      '<i class="bd-split"></i><button type="button" class="bd-arrow" data-act="shift" data-delta="-1" aria-label="上一期"' + (shiftRange(-1) ? "" : " disabled") + '>‹</button><button type="button" class="bd-arrow" data-act="shift" data-delta="1" aria-label="下一期"' + (shiftRange(1) ? "" : " disabled") + '>›</button><i class="bd-split"></i>' +
      '<button type="button" data-act="preset" data-preset="custom" class="bd-custom' + (preset === "custom" ? " is-on" : "") + '">自定义<span class="bd-tip">自定义最多连续 60 天。只查看已保存的对应时间段数据；切换日期不会触发采集。最近两天不取。</span></button></div>' +
      '<input class="bd-picker" data-act="pick-date" type="date" min="' + DATA_START + '" max="' + esc(cap) + '" value="' + esc(dayValue) + '">' +
      '<input class="bd-picker" data-act="pick-week" type="week" max="' + esc(isoWeekValue(iso(addDays(parseIso(weekStart(today)), -7)))) + '" value="' + esc(isoWeekValue(monday)) + '">' +
      '<input class="bd-picker" data-act="pick-month" type="month" min="2026-09" max="' + esc(today.slice(0, 7)) + '" value="' + esc(monthValue) + '">' +
      (state.datePop === "year" ? '<div class="bd-pop">' + years + "</div>" : "") +
      (state.datePop === "custom" ? renderCustomCalendar() : "") +
      "</div>";
  }

  function metricOf(row, column) {
    if (!column) {
      return null;
    }
    if (column.key === "name") {
      return row.name || (row.metrics && row.metrics.name) || "";
    }
    if (column.key === "shop") {
      return row.shop || (row.metrics && row.metrics.shop) || "";
    }
    if (column.key === "owner") {
      return row.owner || (row.metrics && row.metrics.owner) || "";
    }
    if (column.key === "platform") {
      return row.platform || (row.metrics && row.metrics.platform) || "";
    }
    var metrics = row.metrics || {};
    if (metrics[column.key] != null && metrics[column.key] !== "") {
      return metrics[column.key];
    }
    var folded = null;
    Object.keys(metrics).forEach(function (key) {
      if (folded) {
        return;
      }
      if (key.toLowerCase() === String(column.key).toLowerCase() && metrics[key] != null && metrics[key] !== "") {
        folded = metrics[key];
      }
    });
    if (folded != null) {
      return folded;
    }
    var aliases = column.aliases || [];
    for (var i = 0; i < aliases.length; i += 1) {
      if (metrics[aliases[i]] != null && metrics[aliases[i]] !== "") {
        return metrics[aliases[i]];
      }
      var alias = String(aliases[i]).toLowerCase();
      var aliasHit = null;
      Object.keys(metrics).forEach(function (key) {
        if (!aliasHit && key.toLowerCase() === alias && metrics[key] != null && metrics[key] !== "") {
          aliasHit = metrics[key];
        }
      });
      if (aliasHit != null) {
        return aliasHit;
      }
    }
    return null;
  }

  function formatCell(value, column) {
    if (value == null || value === "") {
      return '<span class="bd-miss">—</span>';
    }
    var num = Number(value);
    if (!column || !column.numeric || !Number.isFinite(num)) {
      return esc(value);
    }
    if (column.rate && (column.sourceRatio || Math.abs(num) <= 1)) {
      num = num * 100;
    }
    var whole = column.sourceValue ? Number.isInteger(num) : Math.abs(num) >= 100 && Math.abs(num - Math.round(num)) < 0.001;
    var digits = column.rate || !whole ? 2 : 0;
    var text = num.toLocaleString("zh-CN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
    if (column.rate) {
      text += "%";
    }
    var solid = column.solid || column.key === "profit" || column.key === "lrl" || column.key === "grossRate";
    var tone = solid ? (num < 0 ? "is-solid is-down" : "is-solid is-up") : (num < 0 ? "is-neg" : "");
    return '<span class="bd-num ' + tone + '">' + esc(text) + "</span>";
  }

  function channelDot(name) {
    var color = { "京东": "#e1251b", "天猫": "#ff0036", "淘宝": "#ff5000", "抖音": "#111111", "拼多多": "#e02e24", "快手": "#ff4906", "全部": "#3b6cff", "全渠道": "#3b6cff", "汇总": "#3b6cff" }[name] || "";
    return color ? '<i class="bd-dot" style="background:' + color + '"></i>' : "";
  }

  function renderStatus(data) {
    var coverage = data.coverage || {};
    var bad = "";
    if (coverage.status === "missing") {
      bad = "这段还有 " + ((coverage.missing || []).length) + " 天没采完，汇总留空，不当成 0。";
    } else if (coverage.status === "failed") {
      bad = "这段有采集失败的日期，已标出失败，不会用 0 代替。" + esc(coverage.error || "");
    } else if (coverage.status === "denied") {
      bad = "当前账号没有这个菜单。";
    }
    var line = xm() ? "" : '<p class="bd-status">爬虫，非 ERP。</p>';
    return line + (bad ? '<p class="bd-banner">' + bad + "</p>" : "");
  }

  function renderCards(data) {
    if (!data || !data.cards || !data.cards.length || state.panel === "cards") {
      return "";
    }
    var cards = data.cards.filter(function (card) { return card.on; }).map(function (card, index) {
      var rangeMissing = data.cardStatus !== "ready";
      var empty = card.value == null || card.value === "";
      var text = rangeMissing ? "未采完" : (empty ? "—" : formatCard(card));
      var num = Number(card.value);
      var tone = "";
      if (!rangeMissing && !empty && num < 0) {
        tone = "is-down";
      } else if (!rangeMissing && !empty && card.rate && num > 0) {
        tone = "is-up";
      }
      var sub = card.note != null ? card.note : (card.rate ? "" : "达成率 —");
      var ui = xm();
      if (ui) {
        var tones = ["blue", "green", "orange", "purple"];
        var icons = ["chart", "file", "users", "award"];
        return ui.StatCard({
          label: card.label,
          value: text,
          note: sub || "",
          tone: tones[index % tones.length],
          icon: icons[index % icons.length],
          trend: tone === "is-up" ? "up" : ""
        });
      }
      return '<article class="bd-kpi"><span>' + esc(card.label) + '</span><b class="' + tone + '">' + text + "</b><em>" + esc(sub || "") + "</em></article>";
    });
    var title = cardTitle(data.page && data.page.id);
    var channelCount = data.channelCount != null ? data.channelCount : data.total;
    var shopCount = data.shopCount != null ? data.shopCount : (data.shops || []).length;
    var ui = xm();
    var grid = cards.join("");
    var meta = "渠道 " + channelCount + " 个 · 店铺 " + shopCount + " 个";
    var action = '<button type="button" class="bd-primary" data-act="panel" data-panel="cards">设定指标</button>';
    if (data.localArchive) action = "";
    if (ui) {
      return ui.ContentCard({
        title: title,
        description: meta,
        content: '<div class="xm-ui-stat-grid">' + grid + "</div>" + action
      });
    }
    var first = cards.slice(0, 9).join("");
    var rest = cards.slice(9).join("");
    return '<section class="bd-kpis"><div class="bd-kpi-head"><strong>' + esc(title) + '</strong><span>渠道 ' + esc(channelCount) + ' 个</span><span>店铺 ' + esc(shopCount) + ' 个</span>' + action + '</div><div class="bd-kpi-row">' + first + "</div>" + (rest ? '<div class="bd-kpi-row">' + rest + "</div>" : "") + "</section>";
  }

  function chips(items, key) {
    return '<div class="bd-chips">' + items.map(function (item) {
      var on = String(state[key] || "") === item[0] ? " is-on" : "";
      return '<button type="button" data-act="chip" data-key="' + esc(key) + '" data-value="' + esc(item[0]) + '" class="bd-chip' + on + '">' + esc(item[1]) + "</button>";
    }).join("") + "</div>";
  }

  function renderExtras(data) {
    var id = data.page && data.page.id;
    var tabLabel = (data.tab && data.tab.label) || "";
    var html = "";
    if (id === "channelAnalysis" && tabLabel.indexOf("地域") >= 0) {
      html += '<span class="bd-sub">地域范围</span>' + chips([["province", "按省份"], ["city", "按城市"]], "area");
    }
    if (id === "channelAnalysis" && tabLabel.indexOf("时段") >= 0) {
      html += '<span class="bd-sub">销售时段统计类型</span>' + chips([["ship", "按发货"], ["pay", "按支付"]], "hourType");
    }
    if (id === "hpOverview") {
      html += chips([["exact", "精确"], ["fuzzy", "模糊"]], "matchMode");
      html += '<label class="bd-chip' + (state.splitWarehouse ? " is-on" : "") + '"><input type="checkbox" data-act="warehouse"' + (state.splitWarehouse ? " checked" : "") + ">按发货仓库拆分</label>";
      html += '<label class="bd-chip' + (state.splitCombo ? " is-on" : "") + '"><input type="checkbox" data-act="split-combo"' + (state.splitCombo ? " checked" : "") + ">拆分组合装</label>";
    }
    if (id === "hpPanorama") {
      html += chips([["hp", "按货品"], ["ks", "按款式"]], "hpKind");
      html += '<span class="bd-sub">组合装口径</span>' + chips([["split", "已拆分"], ["whole", "未拆分"]], "comboMode");
      html += '<p class="bd-status">仅总览数据和渠道布局分析支持按拆分组合装查询，其他分析固定按未拆分查询。</p>';
    }
    if (id === "channelAnalysisNew") {
      html += chips([["yoy", "同比"], ["mom", "环比"]], "compare");
    }
    if (id === "productOverview") {
      html += chips([
        ["", "全部"],
        ["info", "商品信息"],
        ["sale", "销售表现"],
        ["refund", "退款售后"],
        ["cost", "成本费用"],
        ["ad", "推广投放"],
        ["profit", "利润收益"],
        ["order", "订单分类明细"],
        ["flow", "流量转化"],
        ["service", "服务体验"]
      ], "goodsGroup");
    }
    if (id === "productStock") {
      html += chips([["style", "按款式"], ["goods", "按货品"]], "stockDim");
      html += '<label class="bd-chip' + (state.hideCombo ? " is-on" : "") + '"><input type="checkbox" data-act="combo"' + (state.hideCombo ? " checked" : "") + ">不显示组合装</label>";
    }
    if (id === "teamMemberDetail") {
      html += chips([
        ["link", "按负责的链接"],
        ["shop", "按负责的店铺"],
        ["joinLink", "按参与管理的链接"],
        ["joinShop", "按参与管理的店铺"]
      ], "dutyScope");
    }
    return html;
  }

  function visibleColumns(data) {
    var cols = (data.columns || []).filter(function (column) { return column.on; });
    if (!data.page || data.page.id !== "productOverview" || !state.goodsGroup) {
      return cols;
    }
    var groups = {
      info: { name: 1, shop: 1, owner: 1 },
      sale: { saleCount: 1, dealCount: 1, payUsers: 1, netPayUsers: 1, payAmount: 1 },
      flow: { visitor: 1, pv: 1 },
      refund: { refundAmount: 1, refundRate: 1 },
      cost: { saleCost: 1 },
      ad: { cost: 1 },
      profit: { profit: 1 },
      order: { orderType: 1 },
      service: { service: 1 }
    };
    var allow = groups[state.goodsGroup];
    if (!allow) {
      return [];
    }
    return cols.filter(function (column) { return allow[column.key]; });
  }

  function renderTeamExtra(data) {
    if (!data.page) {
      return "";
    }
    if (data.page.id === "teamSkills") {
      var ranked = (data.rows || []).slice().sort(function (left, right) {
        return Number(metricOf(right, { key: "payAmount", numeric: true, aliases: ["gmv", "xse"] }) || 0) - Number(metricOf(left, { key: "payAmount", numeric: true, aliases: ["gmv", "xse"] }) || 0);
      }).slice(0, 3);
      function board(title) {
        var body = ranked.length ? "<ol>" + ranked.map(function (row, index) {
          return "<li>" + (index + 1) + ". " + esc(row.name || "未命名") + "</li>";
        }).join("") + "</ol>" : "<p>暂无相关数据</p>";
        return "<article><h3>" + title + "</h3>" + body + '<button type="button" class="bd-linkish" data-act="chip" data-key="skillMore" data-value="1">查看更多</button></article>';
      }
      return '<div class="bd-top3">' + board("销售额贡献TOP3") + board("个人提成TOP3") + "</div>";
    }
    if (data.page.id === "teamMemberDetail") {
      var ready = data.coverage && data.coverage.status === "ready";
      var sum = data.allSum || {};
      function picked(keys, fallback) {
        for (var i = 0; i < keys.length; i += 1) {
          if (sum[keys[i]] != null && sum[keys[i]] !== "") return sum[keys[i]];
        }
        return fallback;
      }
      function stat(label, value) {
        var text = !ready ? "未采完" : (value == null || value === "" ? "—" : value);
        return '<article class="bd-stat"><span>' + label + "</span><b>" + esc(text) + "</b></article>";
      }
      return '<div class="bd-stats">' + stat("管理店铺数", picked(["shopCount", "manageShopCount"], (data.shops || []).length)) + stat("自己责权的店铺数", picked(["ownShopCount", "dutyShopCount"], null)) + stat("管理链接数", picked(["linkCount", "manageLinkCount"], data.total)) + stat("管理人数", picked(["memberCount", "manageUserCount"], null)) + "</div>" + chips([["sku", "按SKU统计"], ["spu", "按SPU统计"]], "dim") + '<p class="bd-status">表格按所选时间段整段显示，不把单日相加。</p><h2 class="bd-block-title">岗位工作明细</h2>';
    }
    return "";
  }

  function renderSpecial(data) {
    if (!data.page) {
      return "";
    }
    if (data.page.id === "personalCenter") {
      var row = (data.rows || [])[0] || {};
      var metrics = row.metrics || {};
      function field(label, value) {
        var text = value == null || value === "" ? "未采完" : value;
        return "<div><span>" + label + "</span><b>" + esc(text) + "</b></div>";
      }
      var body = "";
      if (state.profilePane === "safe") {
        body = field("更换手机号", metrics.phone || metrics.mobile || row.shop) + '<div><span>修改密码</span><b>密码只在旧站修改，这里不保存密码。</b></div>' + field("微信", metrics.wechat) + field("飞书", metrics.feishu) + field("钉钉", metrics.dingtalk) + field("企业微信", metrics.qywx);
      } else if (state.profilePane === "msg") {
        body = "<p>消息设置从本库个人资料读取。" + (data.coverage.status === "ready" ? "已采到个人资料。" : "未采完。") + "</p>";
      } else {
        body = field("姓名", metrics.userName || row.name) + field("手机号", metrics.phone || metrics.mobile || row.shop) + field("花名", metrics.nickName || metrics.alias) + field("岗位", metrics.postName || metrics.post) + field("职级", metrics.rankName || metrics.rank) + field("职务", metrics.jobName || metrics.duty);
      }
      return '<section class="bd-profile">' + chips([["info", "基本信息"], ["safe", "账号安全"], ["msg", "消息设置"]], "profilePane") + '<div class="bd-fields">' + body + "</div></section>";
    }
    if (data.page.id === "myProjects") {
      var rows = data.rows || [];
      var dayText = data.range && data.range.to ? cnDate(data.range.to) : "";
      var wall = "";
      if (state.catalog) {
        state.catalog.modules.forEach(function (mod) {
          mod.pages.forEach(function (page) {
            if (page.id === "myProjects" || page.id === "personalCenter") {
              return;
            }
            wall += '<button type="button" data-act="page" data-page="' + esc(page.id) + '">' + esc(page.label) + "</button>";
          });
        });
      }
      var projects = rows.length ? rows.map(function (item) {
        return '<article class="bd-tile"><strong>' + esc(item.name || "未命名项目") + "</strong><div>" + esc(item.shop || "") + "</div></article>";
      }).join("") : '<p class="bd-miss">' + (data.coverage.status === "ready" ? "这个范围内没有记录。" : "未采完") + "</p>";
      return '<section class="bd-profile"><p>今天是' + esc(dayText) + '。今天是你在公司服务的天数以本库个人资料为准。</p><div class="bd-wall">' + wall + "</div></section>" + '<div class="bd-gallery">' + projects + "</div>";
    }
    if (data.page.id === "channelAnalysisNew") {
      return '<section class="bd-block"><div class="bd-block-bar"><h2>指标趋势</h2></div><p class="bd-miss">' + (data.coverage.status === "ready" ? "这段已采完，趋势按当前指标对比。" : "未采完") + "</p></section>";
    }
    return "";
  }

  function renderBars(data, list) {
    if (!list.length) {
      return '<p class="bd-miss">' + (data.coverage.status === "ready" ? "这个范围内没有记录。" : "未采完") + "</p>";
    }
    var pay = { key: "payAmount", numeric: true, money: true, aliases: ["gmv", "xse", "saleAmount"] };
    var max = 1;
    list.forEach(function (row) {
      max = Math.max(max, Math.abs(Number(metricOf(row, pay)) || 0));
    });
    return '<div class="bd-bars">' + list.map(function (row) {
      var amount = Number(metricOf(row, pay)) || 0;
      var width = Math.max(2, Math.round(Math.abs(amount) / max * 100));
      return '<div class="bd-bar"><span>' + esc(row.name || "未命名") + '</span><i style="width:' + width + '%"></i><b>' + formatCell(amount, pay) + "</b></div>";
    }).join("") + "</div>";
  }

  function formatCard(card) {
    var num = Number(card.value);
    if (!Number.isFinite(num)) {
      return esc(card.value);
    }
    if (card.rate && Math.abs(num) <= 1) {
      num = num * 100;
    }
    var whole = !card.rate && (card.sourceValue ? Number.isInteger(num) : Math.abs(num) >= 100 && Math.abs(num - Math.round(num)) < 0.001);
    var digits = card.rate || !whole ? 2 : 0;
    var text = num.toLocaleString("zh-CN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
    return esc(card.rate ? text + "%" : text);
  }

  function renderTable(data, rows, columns) {
    var list = rows || data.rows || [];
    var cols = columns || visibleColumns(data);
    if (!cols.length) {
      return '<p class="bd-miss">这个分组的字段还没进本地库。</p>';
    }
    if (state.view === "chart" && rows == null) {
      var bars = renderBars(data, list);
      var chart = xm();
      if (!chart) {
        return bars;
      }
      return chart.ChartCard({
        title: (data.tab && data.tab.label) || "图表",
        ariaLabel: "渠道图表",
        content: bars
      });
    }
    if (state.view === "gallery" && rows == null) {
      if (!list.length) {
        return '<p class="bd-miss">' + (data.coverage.status === "ready" ? "这个范围内没有记录。" : "未采完") + "</p>";
      }
      return '<div class="bd-gallery">' + list.map(function (row) {
        return '<article class="bd-tile"><strong>' + esc(row.name || "未命名") + "</strong><div>" + esc(row.shop) + "</div><div>" + formatCell(metricOf(row, { key: "payAmount", numeric: true, money: true, aliases: ["gmv", "xse"] }), { key: "payAmount", numeric: true, money: true }) + "</div></article>";
      }).join("") + "</div>";
    }
    var suffix = !data.localArchive && data.page && data.page.id === "channelAnalysisNew" ? (state.compare === "mom" ? "环比" : "同比") : "";
    var showOpener = !data.localArchive && !(data.page && (data.page.id === "channelOverview" || data.page.id === "channelAnalysis"));
    if (state.sortKey && !data.localArchive) {
      var sortColumn = null;
      cols.forEach(function (column) {
        if (column.key === state.sortKey) {
          sortColumn = column;
        }
      });
      if (sortColumn) {
        list = list.slice().sort(function (left, right) {
          var a = metricOf(left, sortColumn);
          var b = metricOf(right, sortColumn);
          var an = Number(a);
          var bn = Number(b);
          var cmp = Number.isFinite(an) && Number.isFinite(bn) ? an - bn : String(a || "").localeCompare(String(b || ""), "zh");
          return state.sortDir === "asc" ? cmp : -cmp;
        });
      }
    }
    var ui = xm();
    if (ui && !showOpener) {
      if (!list.length) {
        return ui.EmptyState({
          title: data.coverage.status === "ready" ? "这个范围内没有记录。" : "未采完",
          description: data.coverage.status === "ready" ? "" : "汇总留空，不当成 0。"
        });
      }
      var table = ui.DataTable({
        columns: cols.map(function (column) {
          return {
            key: column.key,
            label: column.label + (suffix && column.numeric ? suffix : ""),
            render: function (_value, row) {
              var value = formatCell(metricOf(row, column), column);
              if (column.key === "name") {
                var shown = row.name === "全部" && data.page && data.page.id === "channelOverview" ? "全渠道" : row.name;
                value = channelDot(shown) + (shown === row.name ? value : formatCell(shown, column));
              }
              if (column.key === "platform") {
                value = channelDot(row.platform || row.name) + value;
              }
              return value;
            }
          };
        }),
        rows: list
      });
      var index = 0;
      return table.replace(/<th>([\s\S]*?)<\/th>/g, function (_all, inner) {
        var column = cols[index++] || {};
        var mark = state.sortKey === column.key ? (state.sortDir === "asc" ? " ↑" : " ↓") : "";
        return '<th><button type="button" data-act="sort" data-key="' + esc(column.key) + '">' + inner + mark + "</button></th>";
      });
    }
    var head = "<tr>" + (showOpener ? "<th></th>" : "") + cols.map(function (column) {
      var label = column.label + (suffix && column.numeric ? suffix : "");
      var mark = state.sortKey === column.key ? (state.sortDir === "asc" ? " ↑" : " ↓") : "";
      return '<th><button type="button" data-act="sort" data-key="' + esc(column.key) + '">' + esc(label) + mark + "</button></th>";
    }).join("") + "</tr>";
    var body = list.map(function (row) {
      var cells = cols.map(function (column) {
        var value = formatCell(metricOf(row, column), column);
        if (column.key === "name") {
          var shown = row.name === "全部" && data.page && data.page.id === "channelOverview" ? "全渠道" : row.name;
          value = channelDot(shown) + (shown === row.name ? value : formatCell(shown, column));
        }
        if (column.key === "platform") {
          value = channelDot(row.platform || row.name) + value;
        }
        return "<td>" + value + "</td>";
      }).join("");
      var detail = row.fields && state.open[row.key] ? '<tr><td colspan="' + (cols.length + (showOpener ? 1 : 0)) + '" class="bd-detail">' + row.fields.map(function (field) {
        return "<div>" + esc(field.key) + "：" + esc(field.value) + "</div>";
      }).join("") + '<label>跟进 <input data-act="mark" data-key="' + esc(row.key) + '" data-field="follow" value="' + esc(row.follow) + '"></label><label>打标 <input data-act="mark" data-key="' + esc(row.key) + '" data-field="tag" value="' + esc(row.tag) + '"></label><label>目标 <input data-act="mark" data-key="' + esc(row.key) + '" data-field="target" value="' + esc(row.target) + '"></label></td></tr>' : "";
      var openerLabel = data.page && data.page.id === "channelAnalysisNew" ? "跟进 待办 打标" : "明细";
      var opener = row.fields ? '<button type="button" class="bd-linkish" data-act="expand" data-key="' + esc(row.key) + '">' + openerLabel + "</button>" : "";
      var total = row.name === "全部" || row.name === "全渠道" || row.name === "汇总";
      return '<tr class="' + (total ? "bd-total" : "") + '">' + (showOpener ? "<td>" + opener + "</td>" : "") + cells + "</tr>" + detail;
    }).join("");
    if (!list.length) {
      body = '<tr><td colspan="' + (cols.length + (showOpener ? 1 : 0)) + '">' + (data.coverage.status === "ready" ? "这个范围内没有记录。" : "未采完") + "</td></tr>";
    }
    return '<div class="bd-scroll"><table class="bd-table">' + head + body + "</table></div>";
  }

  function renderShopBlock(data) {
    if (!data.page || data.page.id !== "channelOverview" || !data.tab || data.tab.id !== "qdzl_lb") {
      return "";
    }
    var source = data.shopRows || [];
    var gaps = data.shopGaps || [];
    var gapNote = gaps.length ? '<p class="bd-banner">店铺明细缺失：' + esc(gaps.join("、")) + "。这些天的金额没有采全，不会按 0 计入店铺汇总。请查看采集进度。</p>" : "";
    var channelPay = Number(sumCell(data.allSum, "payAmount").replace(/,/g, "")) || 0;
    var shopPay = source.reduce(function (sum, row) {
      return sum + (Number((row.metrics || {}).payAmount) || 0);
    }, 0);
    var uiShop = xm();
    function shopCard(content) {
      if (!uiShop) {
        return '<section class="bd-block"><div class="bd-block-bar"><h2>店铺列表</h2></div>' + content + "</section>";
      }
      return uiShop.ContentCard({ title: "店铺列表", content: content });
    }
    if (source.length && channelPay > 0 && shopPay === 0) {
      var mismatch = "这一天的店铺明细金额是 0，和渠道支付 " + sumCell(data.allSum, "payAmount") + " 对不上。这是明细没采全，不会把缺失显示成真实的 0。请查看采集进度。";
      return shopCard(uiShop ? uiShop.EmptyState({ title: "店铺明细缺失", description: mismatch }) : '<p class="bd-banner">' + esc(mismatch) + "</p>");
    }
    if (!source.length) {
      if (gapNote) {
        var gapText = "店铺明细缺失：" + gaps.join("、") + "。这些天的金额没有采全，不会按 0 计入店铺汇总。请查看采集进度。";
        return shopCard(uiShop ? uiShop.EmptyState({ title: "店铺明细缺失", description: gapText }) : gapNote);
      }
      var waiting = data.shopStatus && data.shopStatus !== "ready" ? "店铺列表还没采完。" : "这个范围内没有店铺记录。";
      return shopCard(uiShop ? uiShop.EmptyState({ title: waiting }) : '<p class="bd-miss">' + waiting + "</p>");
    }
    var columns = [{ key: "shop", label: "店铺", numeric: false, aliases: ["shopName"] }, { key: "platform", label: "渠道", numeric: false, aliases: [] }].concat((data.columns || []).filter(function (column) {
      return column.on && column.key !== "name";
    }));
    var rows = source.map(function (row) {
      var total = isTotalName(row);
      return {
        key: row.key,
        name: total ? "汇总" : row.shop || row.name,
        shop: total ? "汇总" : row.shop || row.name,
        platform: total ? "全部" : row.platform || row.name,
        metrics: row.metrics || {},
        fields: null
      };
    }).sort(function (left, right) {
      return (left.name === "汇总" ? 0 : 1) - (right.name === "汇总" ? 0 : 1);
    });
    var shopBody = state.shopView === "chart" ? renderBars(data, rows) : renderTable(data, rows, columns);
    var shopTools = '<div class="bd-tools"><button type="button" data-act="shop-view" data-view="list" class="' + (state.shopView === "list" ? "is-on" : "") + '">列表</button><button type="button" data-act="shop-view" data-view="chart" class="' + (state.shopView === "chart" ? "is-on" : "") + '">图表</button><a href="/api/bound/export?' + esc(queryString()) + '">导出</a></div>';
    return shopCard(shopTools + gapNote + shopBody);
  }

  function isTotalName(row) {
    return row.shop === "合计" || row.name === "全部" || row.name === "全渠道" || row.name === "汇总";
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
    if (state.panel === "batch") {
      var batchLabel = state.batchField === "target" ? "设置目标" : state.batchField === "tag" ? "批量打标" : "设置跟进";
      return '<div class="bd-panel"><strong>' + batchLabel + '</strong><input data-act="batch-value" value="' + esc(state.batchValue || "") + '"><button type="button" data-act="save-batch">确定</button></div>';
    }
    if (state.panel === "upload") {
      return '<div class="bd-panel"><strong>上传报表</strong><p>生意参谋入店来源报表、生意参谋关键指标对比报表、生意参谋流量来源报表、关键词推广来源详情报表、生意参谋手淘搜索来源详情报表。</p><p>这一页只读本库，不把报表回传到旧站。</p></div>';
    }
    if (state.panel === "columns") {
      return '<div class="bd-panel"><strong>字段设置</strong>' + data.columns.map(function (column) {
        return '<label><input type="checkbox" data-act="column" value="' + esc(column.key) + '"' + (column.on ? " checked" : "") + ">" + esc(column.label) + "</label>";
      }).join("") + '<button type="button" data-act="save-columns">保存字段</button></div>';
    }
    return "";
  }

  function renderProgress() {
    var progress = state.progress;
    if (!progress || !progress.items) {
      return '<section class="bd-block"><h2 class="bd-block-title">采集进度</h2><p class="bd-miss">正在读取本库进度。</p></section>';
    }
    var counts = progress.counts || {};
    var done = counts.done || 0;
    var total = progress.total || progress.items.length || 1;
    var width = Math.max(0, Math.min(100, Math.round(done / total * 100)));
    var cursor = progress.cursor || {};
    var phase = progress.phase || "";
    var now = "采集还没开始。";
    if (progress.collection && !progress.collection.batchEnabled) {
      now = progress.collection.message;
    } else if (phase === "collecting" && cursor.label) {
      now = "正在采集：" + (cursor.page || "") + " / " + cursor.label + "，" + (cursor.start || "") + (cursor.end && cursor.end !== cursor.start ? " 至 " + cursor.end : "");
    } else if (phase === "collecting") {
      now = "正在采集。这一页每几秒刷新一次。";
    } else if (phase === "logged_in") {
      now = progress.message || "已补到今天。之后按天增量。";
    } else if (phase === "needs_scan" || phase === "waiting_scan") {
      now = "采集停住，等扫码。下面是已经入库的进度。";
    }
    var labels = { done: "已完成", partial: "部分完成", failed: "失败", pending: "还没开始" };
    var rows = progress.items.map(function (item) {
      var current = cursor.id === item.id && (cursor.dim || "all") === (item.dim || "all");
      var dim = item.dim && item.dim !== "all" ? " " + item.dim.toUpperCase() : "";
      var statusText = current ? "正在采" : (labels[item.status] || item.status);
      var reason = item.reason || "";
      if (!reason && item.readyDays === 0 && item.failedDays > 0) {
        reason = "还没有一天采集成功，已采天数不会增加";
      }
      var dates = item.failedDates || [];
      var failLine = "";
      if (item.failedDays) {
        failLine = "失败 " + item.failedDays + " 天";
        if (item.retries) {
          failLine += "，已重试 " + item.retries + " 次";
        }
        if (dates.length) {
          failLine += "：" + dates.slice(0, 8).join("、");
          if (dates.length > 8) {
            failLine += " 等 " + dates.length + " 天";
          }
        }
      }
      if (item.failedMonths) {
        failLine += (failLine ? "。" : "") + "整月失败 " + item.failedMonths + " 个";
      }
      var reasonHtml = (reason || failLine) ? '<div class="bd-reason">' + esc([reason, failLine].filter(Boolean).join("。")) + "</div>" : "";
      return '<tr class="' + (current ? "bd-total" : "") + '"><td class="' + (current ? "is-current" : "") + '">' + esc(item.page) + "</td><td>" + esc(item.tab + dim) + "</td><td>" + esc(item.readyDays) + "/" + esc(progress.dayCount) + "</td><td>" + esc(item.failedDays) + "</td><td>" + esc(item.latest || "—") + "</td><td>" + esc(statusText) + reasonHtml + "</td></tr>";
    }).join("");
    return '<section class="bd-block"><h2 class="bd-block-title">采集进度</h2><p class="bd-now">' + esc(now) + "</p><div class=\"bd-meter\"><i style=\"width:" + width + "%\"></i></div><p class=\"bd-status\">已完成 " + esc(done) + " / " + esc(total) + " 张表。进行中 " + esc(counts.partial || 0) + "，失败 " + esc(counts.failed || 0) + "，还没开始 " + esc(counts.pending || 0) + "。范围 " + esc(progress.startOn) + " 至 " + esc(progress.today) + "。</p><div class=\"bd-progress\"><table class=\"bd-table\"><tr><th>页面</th><th>表</th><th>已采天数</th><th>失败</th><th>最近一天</th><th>状态</th></tr>" + rows + "</table></div></section>";
  }

  function renderProbe() {
    var probe = state.probe;
    if (!probe || !probe.target) return "";
    var target = probe.target;
    var busy = state.probeBusy || probe.running;
    var last = probe.last;
    var metric = last && last.metric;
    var result = metric ? '<p><strong>接口支付金额：' + esc(metric.displayValue) + '</strong> · ' + (metric.matchesPage ? "与旧站页面一致" : "与页面不一致") + '</p><p class="bd-status">' + esc(metric.definition) + '。' + esc(metric.precisionNote) + '</p>' : '';
    var candidateRow = last && last.sample && last.sample.row;
    if (!metric && target.metric === "广告花费" && last && last.status === "response_received"
      && candidateRow && String(candidateRow.date || "").replace(/\//g, "-") === target.date
      && typeof candidateRow.tghf === "number" && Number.isFinite(candidateRow.tghf)) {
      var adMatchesPage = target.pageConfirmation && target.pageConfirmation.source === "user"
        && typeof target.pageDisplay === "string" && Number(target.pageDisplay.replace(/,/g, "")) === candidateRow.tghf;
      result = '<p><strong>' + (adMatchesPage ? '接口广告花费：' : '推广相关候选值：')
        + esc(new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 20 }).format(candidateRow.tghf))
        + '</strong>' + (adMatchesPage ? ' · 与用户确认的旧站页面一致' : '')
        + '</p><p class="bd-status">接口字段 tghf。' + (adMatchesPage ? '页面金额已人工核对；账单实际消耗口径尚未单独验证。' : '广告金额口径待核对；尚未确认为广告账单实际消耗。') + '</p>';
    }
    var tasks = (probe.targets || [target]).map(function (item) {
      return '<button type="button" data-act="probe-target" data-date="' + esc(item.date) + '"' + (busy ? ' disabled' : '') + '>' + esc(item.date + " · " + item.metric) + '</button>';
    }).join("");
    var baseline = target.pageDisplay == null ? "尚未核对旧站页面值。" : "已确认的旧站页面值：" + esc(target.pageDisplay) + "。";
    return '<section class="bd-block"><h2 class="bd-block-title">单店试采</h2><div class="bd-tools">' + tasks + '</div><p>' + esc(target.shopName) + " · " + esc(target.date) + " · " + esc(target.metric) + '</p><p class="bd-status">' + baseline + '每次只请求这一家店的数据，并核对指定日期行。</p><div class="bd-tools"><button type="button" data-act="probe"' + (busy ? ' disabled' : '') + '>' + (busy ? "试采中…" : "试采一次") + '</button></div>' + result + (last ? '<p role="status">' + esc(last.message) + '</p><p class="bd-status">请求次数：' + esc(last.requestCount) + " · " + esc(last.finishedAt) + "</p>" : "") + '</section>';
  }

  function renderLink() {
    var link = state.link || {};
    var showQr = link.qrReady && (link.phase === "waiting_scan" || link.phase === "needs_scan" || link.phase === "choose_account");
    var qr = showQr ? '<img class="bd-qr" alt="旧站登录二维码" src="/api/bound/link/qr?ts=' + Date.now() + '">' : "";
    var accounts = (link.accounts || []).map(function (account) {
      return '<button type="button" data-act="pick" data-company="' + esc(account.companyId) + '">' + esc(account.companyName || account.name || account.companyId) + "</button>";
    }).join("");
    var password = '<div class="bd-login" data-bound-password><label>旧站账号<input name="bound-user-name" autocomplete="username" value="' + esc(link.userName || "") + '"></label><label>旧站密码<input name="bound-password" type="password" autocomplete="current-password"></label><label class="bd-auto"><input name="bound-auto-relogin" type="checkbox" checked>登录正常过期后自动重新登录</label><button class="bd-primary" type="button" data-act="password-login"' + (state.passwordBusy ? ' disabled' : '') + '>' + (state.passwordBusy ? "正在登录…" : "账号密码登录") + '</button><p class="bd-status">密码仅在服务运行期间保留，服务重启后需重新输入。异地登录、账号禁用或重新登录失败时会停止。</p></div>';
    var archive = state.localArchive;
    var run = archive && archive.run, running = run && ['running', 'collecting'].includes(run.status);
    var scoped = archive ? '<section class="bd-block"><h2>单店四页采集</h2><p>' + esc((archive.collectionScope || archive.scope).shopName + ' · ' + (archive.collectionScope || archive.scope).date) + '</p><p>渠道总览（单店范围）、渠道详情、关键指标分析、商品总览</p><p data-archive-progress>' + esc(archiveRunText()) + '</p>' + (archive.runtime === 'server' ? '<button type="button" data-act="archive-job-start"' + (running ? ' disabled' : '') + '>开始 / 继续补采</button><button type="button" data-act="archive-job-stop"' + (!running ? ' disabled' : '') + '>停止采集</button><p class="bd-status">采集固定为上方店铺及日期，浏览筛选不会改变采集范围。只补缺少的结果，已成功归档的数据直接复用。关闭页面后服务器继续采集；账号冲突或接口异常时停止。</p>' : '<p class="bd-status">旧的全模块批量采集保持暂停。四页专用接口正在逐项核验。</p>') + '<button type="button" data-act="archive-refresh">刷新已采数据</button></section>' : renderProgress();
    return '<section class="bd-main" data-bound-erp="false"><header class="bd-head"><div><h1>连接旧站</h1><p class="bd-sub">使用旧站账号密码建立采集会话。</p><p class="bd-status">同一账号只能保持一处登录。采集期间查看本系统已采数据，旧站对照需等采集停止后进行。</p><p class="bd-status">爬虫，非 ERP。浏览器标识 ' + esc(link.deviceId || "") + '</p></div></header><section class="bd-block"><p role="status">' + esc(link.message || "") + '</p>' + password + '<details><summary>扫码登录（备用）</summary>' + qr + '<div class="bd-tools"><button type="button" data-act="scan" data-provider="WECHAT">微信</button><button type="button" data-act="scan" data-provider="FEISHU">飞书</button><button type="button" data-act="scan" data-provider="DINGTALK">钉钉</button><button type="button" data-act="scan" data-provider="QYWX">企业微信</button>' + accounts + '</div></details></section>' + (archive ? '' : renderProbe()) + scoped + '</section>';
  }

  function renderMain() {
    if (state.page === "link") {
      return renderLink();
    }
    var data = state.viewData;
    if (data && data.localArchive) return renderArchiveMain(data);
    var meta = pageMeta();
    if (!data || !meta) {
      return '<section class="bd-main"><p class="bd-miss">' + esc(state.error || "正在读取本库") + "</p></section>";
    }
    var ops = (data.page && data.page.ops) || meta.ops || [];
    var visibleTabs = (data.tabs || []).filter(function (tab) {
      if (!data.page || data.page.id !== "hpPanorama") {
        return true;
      }
      return (tab.group || "hp") === state.hpKind;
    });
    var tabs = visibleTabs.map(function (tab) {
      return '<button type="button" data-act="tab" data-tab="' + esc(tab.id) + '" class="' + (data.tab && data.tab.id === tab.id ? "is-on" : "") + '">' + esc(tab.label) + "</button>";
    }).join("");
    var ui = xm();
    var tabBar = tabs ? (ui ? ui.FilterToolbar({
      tabs: visibleTabs.map(function (tab) {
        return { label: tab.label, value: tab.id, active: !!(data.tab && data.tab.id === tab.id) };
      }),
      search: false
    }) : '<div class="bd-tabs">' + tabs + "</div>") : "";
    var shopPrompt = data.page.id === "channelAnalysis" ? "选择渠道/店铺/分组" : "全部店铺";
    var shops = '<option value="">' + shopPrompt + "</option>" + (data.shops || []).map(function (shop) {
      return '<option value="' + esc(shop) + '"' + (shop === state.shop ? " selected" : "") + ">" + esc(shop) + "</option>";
    }).join("");
    var setting = (data.cards && data.cards.length) ? "cards" : "columns";
    var channelPage = data.page.id === "channelOverview" || data.page.id === "channelAnalysis";
    var tabLabel = data.page.id === "teamSkills" ? "团队成员" : (data.tab && data.tab.label ? data.tab.label : data.page.label);
    var profileOnly = data.page.id === "personalCenter" || data.page.id === "myProjects";
    var tableBlock = profileOnly ? "" : '<div class="bd-tools">' +
      (ops.indexOf("dim") >= 0 ? '<button type="button" data-act="dim" data-dim="spu" class="' + (state.dim === "spu" ? "is-on" : "") + '">SPU</button><button type="button" data-act="dim" data-dim="sku" class="' + (state.dim === "sku" ? "is-on" : "") + '">SKU</button>' : "") +
      (channelPage ? '<button type="button" data-act="panel" data-panel="cards">目标</button><button type="button" data-act="view" data-view="list" class="' + (state.view === "list" ? "is-on" : "") + '">列表</button><button type="button" data-act="view" data-view="chart" class="' + (state.view === "chart" ? "is-on" : "") + '">图表</button><button type="button" data-act="panel" data-panel="columns">默认视窗</button>' : "") +
      (ops.indexOf("views") >= 0 ? '<button type="button" data-act="view" data-view="list" class="' + (state.view === "list" ? "is-on" : "") + '">列表</button><button type="button" data-act="view" data-view="period" class="' + (state.view === "period" ? "is-on" : "") + '">周期</button><button type="button" data-act="view" data-view="gallery" class="' + (state.view === "gallery" ? "is-on" : "") + '">大图</button>' : "") +
      (ops.indexOf("export") >= 0 ? '<a href="/api/bound/export?' + esc(queryString()) + '">' + (data.page.id === "productStock" ? "导出表格数据" : "导出") + "</a>" : "") +
      (data.page.id === "productOverview" ? '<button type="button" data-act="panel" data-panel="columns">自定义数据字段</button><button type="button" data-act="panel" data-panel="batch" data-field="follow">设置跟进</button><button type="button" data-act="panel" data-panel="batch" data-field="target">设置目标</button><button type="button" data-act="panel" data-panel="batch" data-field="tag">批量打标</button>' : "") +
      (data.page.id === "productOperation" ? '<button type="button" data-act="panel" data-panel="upload">上传报表</button>' : "") +
      '<button type="button" data-act="panel" data-panel="columns">更多</button></div>' +
      renderTable(data) +
      renderSums(data) +
      '<div class="bd-pager"><span>共 ' + esc(data.total) + ' 条</span><span>50条/页</span><button type="button" data-act="page-no" data-delta="-1">上一页</button><span>第 ' + esc(data.pageNo) + ' 页</span><button type="button" data-act="page-no" data-delta="1">下一页</button></div>';
    if (!profileOnly && ui) {
      tableBlock = ui.ContentCard({ title: tabLabel, content: tableBlock });
    } else if (!profileOnly) {
      tableBlock = '<section class="bd-block"><div class="bd-block-bar"><h2>' + esc(tabLabel) + "</h2></div>" + tableBlock + "</section>";
    }
    var filters = (ops.indexOf("date") >= 0 ? renderDateBar(data) : "") +
      (ops.indexOf("shop") >= 0 ? "<select data-act=\"shop\">" + shops + "</select>" : "") +
      (ops.indexOf("search") >= 0 ? '<input data-act="q" value="' + esc(state.q) + '" placeholder="' + esc(searchPlaceholder(data.page.id)) + '">' : "") +
      (data.cards && data.cards.length ? "" : '<button type="button" class="bd-primary" data-act="panel" data-panel="' + setting + '">设定指标</button>');
    var heading = ui
      ? ui.PageContentHeader({ eyebrow: "爬虫，非 ERP", title: data.page.label, description: BLURBS[data.page.id] || "" })
      : '<div><h1>' + esc(data.page.label) + '</h1><p class="bd-sub">' + esc(BLURBS[data.page.id] || "") + "</p></div>";
    return '<section class="bd-main" data-bound-erp="false" data-page="' + esc(data.page.id) + '" data-coverage="' + esc(data.coverage.status) + '">' +
      '<header class="bd-head">' + heading +
      '<div class="bd-filters">' + filters + "</div></header>" +
      renderStatus(data) +
      renderCards(data) +
      renderPanel(data) +
      tabBar +
      renderExtras(data) +
      renderTeamExtra(data) +
      renderSpecial(data) +
      tableBlock +
      renderShopBlock(data) + "</section>";
  }

  function render(root) {
    root.innerHTML = '<div class="bd-app xm-ui-scope" data-bound-erp="false"><nav class="bd-side" aria-label="边界数据中心">' + renderNav() + '</nav>' + renderMain() + "</div>";
  }

  function paint(root) {
    if (state.localArchive && state.page !== "link") state.viewData = buildArchiveView();
    var focus = root.querySelector && root.querySelector("[data-act='q']");
    var start = focus ? focus.selectionStart : null;
    render(root);
    fillArchiveExtras(root);
    fillArchivePeriods(root);
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
    var revision = ++loadRevision;
    state.error = "";
    var stamp = await fetch("/api/bound");
    await readLocalArchive();
    await readArchiveProduct();
    if (token !== active || revision !== loadRevision) return;
    var view = state.page === "link" || state.localArchive ? null : await fetch("/api/bound/view?" + queryString());
    var catalog = state.catalog ? null : await fetch("/api/bound/catalog");
    var link = await fetch("/api/bound/link");
    var progress = state.page === "link" ? await fetch("/api/bound/progress") : null;
    if (token !== active || revision !== loadRevision) {
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
    if (progress && progress.ok) {
      state.progress = await progress.json();
    }
    if (view && view.ok) {
      state.viewData = await view.json();
      if (state.viewData.page && state.viewData.page.id && state.page !== "link") {
        state.page = state.viewData.page.id;
      }
      if (state.viewData.range) {
        state.from = state.viewData.range.from;
        state.to = state.viewData.range.to;
        state.daysType = state.viewData.daysType || (state.from === state.to ? "1" : "custom");
      }
    } else if (view) {
      state.viewData = null;
      state.error = "这一页没有读到";
    }
    state.admin = link.ok;
    state.link = link.ok ? await link.json() : null;
    if (state.page === "link" && state.admin) {
      try {
        var requestedProbeDate = state.probeDate;
        var probe = await fetch("/api/bound/collect/probe" + (requestedProbeDate ? "?date=" + encodeURIComponent(requestedProbeDate) : ""));
        if (token !== active || requestedProbeDate !== state.probeDate) return;
        state.probe = probe.ok ? await probe.json() : null;
      } catch {
        state.probe = null;
      }
    }
    if (!state.loginEditing && !state.passwordBusy) paint(root);
  }

  function openPicker(root, preset) {
    var act = { date: "pick-date", week: "pick-week", month: "pick-month" }[preset];
    if (!act || !root.querySelector) {
      return false;
    }
    var input = root.querySelector("[data-act='" + act + "']");
    if (!input || typeof input.showPicker !== "function") {
      return false;
    }
    try {
      input.showPicker();
      return true;
    } catch {
      return false;
    }
  }

  function listen(root, token) {
    function onClick(event) {
      var tabNode = event.target.closest ? event.target.closest("[data-xm-ui-tab]") : null;
      var tabValue = tabNode && tabNode.getAttribute("data-xm-ui-tab");
      if (tabValue && token === active) {
        state.tab = tabValue;
        state.pageNo = 1;
        load(root, token);
        return;
      }
      var node = event.target.closest ? event.target.closest("[data-act]") : null;
      if (!node || token !== active) {
        return;
      }
      var act = node.getAttribute("data-act");
      if (state.localArchive && act.indexOf("archive-") === 0) {
        if (act === 'archive-job-start' || act === 'archive-job-stop') {
          if (state.localArchive.runtime !== 'server') return;
          fetch('/api/bound/shop-day/' + (act === 'archive-job-start' ? 'four-pages/start' : 'stop'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(async function (r) {
            var result = await r.json(); if (!r.ok || !result.ok) throw new Error('job_failed');
            if (result.run) state.localArchive.run = result.run;
          }).catch(function () { state.error = '采集任务未启动，请确认登录状态后重试。'; }).finally(function () { if (token === active) paint(root); });
          return;
        }
        if (act === 'archive-key-metric') {
          var graph = archiveRecords('key_graph')[0], metric = node.getAttribute('data-key');
          if (graph && graph.metricColumns.some(function (c) { return c.columnKey === metric; })) { state.archiveKeyMetric = metric; state.q = state.sortKey = ''; state.pageNo = 1; paint(root); }
          return;
        }
        if (act === 'archive-trend-fold') { state.archiveTrendFolded = !state.archiveTrendFolded; paint(root); return; }
        if (act === "archive-refresh") {
          if (state.archiveRefreshBusy) return;
          state.error = "";
          state.archiveRefreshBusy = true;
          paint(root);
          readLocalArchive(true).then(readArchiveProduct).then(readArchiveCard).finally(function () { state.archiveRefreshBusy = false; if (token === active) paint(root); });
          return;
        }
        if (act === "archive-card") { state.archiveCard = node.getAttribute("data-id") || ""; state.pageNo = 1; paint(root); readArchiveCard().then(function () { if (token === active) paint(root); }); return; }
        if (act === "archive-cards-expand") { state.archiveCardsExpanded = !state.archiveCardsExpanded; paint(root); return; }
        if (act === "archive-columns") { state.panel = state.panel === "archive-columns" ? "" : "archive-columns"; paint(root); return; }
        if (act === "archive-columns-reset") { state.archiveColumnsHidden[state.viewData.reportId] = []; paint(root); return; }
        if (act === "archive-reset") {
          state.q = state.archiveCard = state.archiveCategory = state.archiveFlag = state.archiveProfit = state.sortKey = "";
          state.pageNo = 1; paint(root); return;
        }
        if (act === "archive-promotion") { state.archivePromotion = node.getAttribute("data-key"); state.q = state.sortKey = ""; state.pageNo = 1; paint(root); return; }
        if (act === "archive-gallery-spu") { state.view = "list"; state.open['spu-' + node.getAttribute('data-spuid')] = true; paint(root); return; }
        if (act === "archive-export") {
          var data = state.viewData, columns = data.columns.filter(function (c) { return c.on; });
          var exportRows = data.filteredRows;
          var periodExport = state.page === 'productOverview' && state.view === 'period';
          if (periodExport) {
            if (data.message && !data.partial || data.reportId === 'shop_spu_page' && !archiveRecords('shop_spu_period').length || archivePeriodPending(data)) return;
            columns = [{ key: 'goodsId', label: '商品 ID' }, { key: 'spuid', label: 'SPU ID' }, { key: 'date', label: '时间范围' }, { key: 'coverage', label: '数据状态' }].concat(archivePeriodColumns(data).filter(function (c) { return c.on; }));
            exportRows = data.rows.flatMap(function (product) {
              var item = archivePeriodItem(data, product.metrics);
              return archivePeriodDates().map(function (date) {
                var daily = item && item.status === 'ready' && item.rows[date];
                return Object.assign({}, daily || {}, { goodsId: product.metrics.goodsId, spuid: product.metrics.spuid, goodsName: product.name, onSaleTime: product.metrics.onSaleTime, date: date, coverage: archivePeriodStatus(item, daily) });
              });
            });
          }
          function csvCell(value) {
            var text = String(value == null ? "" : value);
            // Protect exported text from spreadsheet formula evaluation.
            if (/^[=+@\t\r]/.test(text) || /^-\D/.test(text)) text = "'" + text;
            return '"' + text.replace(/"/g, '""') + '"';
          }
          var csv = '\ufeff' + [columns.map(function (c) { return csvCell(c.label); }).join(',')].concat(exportRows.map(function (r) { return columns.map(function (c) { var value = r[c.key]; return csvCell(c.rate && value != null && value !== '' && Number.isFinite(Number(value)) ? (Number(value) * 100).toFixed(2) + '%' : value); }).join(','); })).join('\r\n');
          var href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
          var anchor = document.createElement('a'); anchor.href = href; anchor.download = data.scope.date + '-' + data.reportId + '-' + (data.selected ? data.selected.goodsId : state.dim) + (periodExport ? '-period-' + state.archivePeriodDays + '-page-' + data.pageNo : '') + '.csv'; anchor.click(); URL.revokeObjectURL(href);
          return;
        }
      }
      if (act === "archive-product" && state.localArchive && state.localArchive.selected) {
        var goodsId = node.getAttribute("data-goods-id") || state.localArchive.selected.goodsId;
        var allowed = String(goodsId) === String(state.localArchive.selected.goodsId) || ((state.localArchive.inventory && state.localArchive.inventory.items) || []).some(function (p) { return String(p.goodsId) === String(goodsId); });
        if (!allowed) return;
        state.archiveGoodsId = goodsId;
        state.page = node.getAttribute('data-product-page') === 'productOperation' ? 'productOperation' : 'productPanorama';
        state.tab = state.page === 'productOperation' ? 'spyy_zl' : 'spqj_zl';
        state.view = 'list';
        state.q = "";
        state.sortKey = "";
        state.pageNo = 1;
      } else if (act === "archive-date" && state.localArchive) {
        state.from = state.to = state.localArchive.scope.date;
        state.daysType = "1";
        state.pageNo = 1;
      } else if (act === "page") {
        if (state.localArchive) { state.q = ""; state.sortKey = ""; state.view = "list"; state.archiveCard = state.archiveCategory = state.archiveFlag = state.archiveProfit = ""; }
        state.page = node.getAttribute("data-page");
        state.tab = "";
        state.pageNo = 1;
        state.panel = "";
      } else if (act === "tab") {
        if (state.localArchive) { state.q = ""; state.sortKey = ""; state.view = "list"; state.panel = ""; }
        state.tab = node.getAttribute("data-tab");
        state.pageNo = 1;
      } else if (act === "dim") {
        if (state.localArchive) { state.archiveCard = ""; state.q = ""; state.sortKey = ""; }
        state.dim = node.getAttribute("data-dim");
        state.pageNo = 1;
      } else if (act === "sort") {
        var sortKey = node.getAttribute("data-key");
        if (state.sortKey === sortKey) {
          state.sortDir = state.sortDir === "desc" ? "asc" : "desc";
        } else {
          state.sortKey = sortKey;
          state.sortDir = "desc";
        }
        paint(root);
        return;
      } else if (act === "view") {
        state.view = node.getAttribute("data-view");
        paint(root);
        return;
      } else if (act === "shop-view") {
        state.shopView = node.getAttribute("data-view");
        paint(root);
        return;
      } else if (act === "chip") {
        var chipKey = node.getAttribute("data-key");
        state[chipKey] = node.getAttribute("data-value");
        if (chipKey === "hpKind") {
          var hpPage = pageMeta();
          var nextTab = ((hpPage && hpPage.tabs) || []).filter(function (tab) {
            return (tab.group || "hp") === state.hpKind;
          })[0];
          state.tab = nextTab ? nextTab.id : "";
          state.pageNo = 1;
          load(root, token);
          return;
        }
        if (chipKey === "dim") {
          if (state.localArchive) { state.archiveCard = ""; state.q = ""; state.sortKey = ""; }
          state.pageNo = 1;
          load(root, token);
          return;
        }
        paint(root);
        return;
      } else if (act === "panel") {
        var nextPanel = node.getAttribute("data-panel");
        state.panel = state.panel === nextPanel && state.batchField === (node.getAttribute("data-field") || "") ? "" : nextPanel;
        if (node.getAttribute("data-field")) {
          state.batchField = node.getAttribute("data-field");
        }
        paint(root);
        return;
      } else if (act === "expand") {
        var key = node.getAttribute("data-key");
        state.open[key] = !state.open[key];
        paint(root);
        return;
      } else if (act === "page-no") {
        state.pageNo = Math.max(1, state.pageNo + Number(node.getAttribute("data-delta") || 0));
      } else if (act === "preset") {
        var presetName = node.getAttribute("data-preset");
        if (presetName === "custom") {
          state.datePop = state.datePop === "custom" ? "" : "custom";
          state.calAnchor = "";
          state.calMonth = (state.from || shanghaiToday()).slice(0, 7);
          paint(root);
          return;
        }
        if (presetName === "year") {
          state.datePop = state.datePop === "year" ? "" : "year";
          paint(root);
          return;
        }
        state.datePop = "";
        if (presetName === "day7" || presetName === "day30") {
          applyRange(rollingRange(presetName === "day7" ? 7 : 30));
        } else if (!openPicker(root, presetName)) {
          var fallback = defaultCalendarRange(presetName);
          if (!fallback) {
            return;
          }
          applyRange(fallback);
        } else {
          return;
        }
      } else if (act === "shift") {
        if (node.disabled) {
          return;
        }
        var nextRange = shiftRange(Number(node.getAttribute("data-delta") || 0));
        if (!nextRange) {
          return;
        }
        state.datePop = "";
        applyRange(nextRange);
      } else if (act === "pick-year") {
        var year = node.getAttribute("data-year");
        var yearRange = clampRange(year + "-01-01", year + "-12-31");
        state.datePop = "";
        applyRange({ from: yearRange.from, to: yearRange.to, daysType: "year" });
      } else if (act === "password-login") {
        if (state.passwordBusy || state.probeBusy) return;
        var userField = root.querySelector('[name="bound-user-name"]');
        var passwordField = root.querySelector('[name="bound-password"]');
        var autoField = root.querySelector('[name="bound-auto-relogin"]');
        if (!userField || !passwordField || !userField.value.trim() || !passwordField.value) {
          state.error = "请填写旧站账号和密码。";
          paint(root);
          return;
        }
        var loginBody = JSON.stringify({ userName: userField.value.trim(), password: passwordField.value, autoRelogin: Boolean(autoField && autoField.checked) });
        passwordField.value = "";
        state.loginEditing = false;
        state.passwordBusy = true;
        paint(root);
        fetch("/api/bound/link/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: loginBody })
          .then(function (response) { return response.json(); }).then(function (result) {
            if (token !== active) return;
            state.link = result;
            if (!result.ok) state.error = result.message || "登录未成功";
          }).catch(function () {
            if (token === active) state.error = "登录请求未完成，请重新检查登录状态。";
          }).finally(function () {
            state.passwordBusy = false;
            if (token === active) paint(root);
          });
        loginBody = "";
        return;
      } else if (act === "probe-target") {
        if (state.probeBusy || state.passwordBusy) return;
        state.probeDate = node.getAttribute("data-date");
        state.probe = null;
        paint(root);
        load(root, token);
        return;
      } else if (act === "probe") {
        if (state.probeBusy || state.passwordBusy || !state.probe || !state.probe.target) return;
        state.probeBusy = true;
        var target = state.probe.target;
        paint(root);
        fetch("/api/bound/collect/probe", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shopId: target.shopId, platform: target.platform, date: target.date })
        }).then(function (response) { return response.json(); }).then(function (result) {
          if (token !== active) return;
          if (result.record) state.probe.last = result.record;
          else state.error = result.message || "本次试采未开始";
        }).catch(function () {
          if (token === active) state.error = "没有收到试采结果，请查看最近一次记录，避免重复提交。";
        }).finally(function () {
          state.probeBusy = false;
          if (token === active) paint(root);
        });
        return;
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
      } else if (act === "save-batch") {
        var input = root.querySelector("[data-act='batch-value']");
        var value = input ? input.value : "";
        var field = state.batchField || "follow";
        var rows = (state.viewData && state.viewData.rows) || [];
        Promise.all(rows.map(function (row) {
          var payload = { rowKey: row.key, follow: row.follow, tag: row.tag, target: row.target };
          payload[field] = value;
          return fetch("/api/bound/marks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        })).then(function () {
          state.panel = "";
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
      } else if (act === "cal-shift") {
        var nextMonth = addMonth(state.calMonth || shanghaiToday().slice(0, 7), Number(node.getAttribute("data-delta") || 0));
        var todayMonth = shanghaiToday().slice(0, 7);
        if (nextMonth >= "2026-09" && nextMonth <= todayMonth) {
          state.calMonth = nextMonth;
          paint(root);
        }
        return;
      } else if (act === "cal-day") {
        if (node.disabled) {
          return;
        }
        var picked = node.getAttribute("data-day");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(picked || "")) {
          return;
        }
        if (!state.calAnchor) {
          state.calAnchor = picked;
          paint(root);
          return;
        }
        var start = state.calAnchor < picked ? state.calAnchor : picked;
        var end = state.calAnchor < picked ? picked : state.calAnchor;
        if (daySpan(start, end) > 60) {
          return;
        }
        var calendarChosen = clampRange(start, end);
        state.calAnchor = "";
        state.datePop = "";
        applyRange({ from: calendarChosen.from, to: calendarChosen.to, daysType: "custom" });
        load(root, token);
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
      if (act === "saved-shop" && state.savedOptions) {
        var shop = state.savedOptions.shops.find(function (s) { return s.platform + ":" + s.shopId === node.value; });
        if (shop) { state.savedShopKey = node.value; state.shop = shop.shopName; state.pageNo = 1; load(root, token); }
        return;
      }
      if (state.localArchive) {
        if (act === 'archive-period-days') {
          if ([7, 15].includes(Number(node.value))) state.archivePeriodDays = Number(node.value);
          paint(root); return;
        }
        if (act === "archive-select-product") {
          if (!((state.localArchive.inventory && state.localArchive.inventory.items) || []).some(function (p) { return String(p.goodsId) === node.value; })) return;
          state.archiveGoodsId = node.value; state.q = state.sortKey = state.archivePromotion = ""; state.pageNo = 1;
          load(root, token); return;
        }
        if (act === "archive-category" || act === "archive-flag" || act === "archive-profit" || act === "archive-page-size") {
          if (act === "archive-category") state.archiveCategory = node.value;
          if (act === "archive-flag" && ["", "hasTask", "hasTodo", "hasUnread"].includes(node.value)) state.archiveFlag = node.value;
          if (act === "archive-profit" && ["", "profit", "loss"].includes(node.value)) state.archiveProfit = node.value;
          if (act === "archive-page-size" && [20, 50, 100].includes(Number(node.value))) state.archivePageSize = Number(node.value);
          state.pageNo = 1; paint(root); return;
        }
        if (act === "archive-column") {
          var id = state.viewData.reportId, key = node.getAttribute("data-key");
          if (key === "goodsName") return;
          var hidden = state.archiveColumnsHidden[id] || [];
          state.archiveColumnsHidden[id] = node.checked ? hidden.filter(function (k) { return k !== key; }) : Array.from(new Set(hidden.concat(key)));
          paint(root); return;
        }
        if (act === "archive-chart-metric") { state.archiveChartMetric = node.value; paint(root); return; }
      }
      if (act === "q" && state.localArchive) {
        state.q = node.value;
        state.pageNo = 1;
        paint(root);
        return;
      }
      if (act === "combo" || act === "warehouse" || act === "split-combo") {
        if (act === "combo") state.hideCombo = Boolean(node.checked);
        if (act === "warehouse") state.splitWarehouse = Boolean(node.checked);
        if (act === "split-combo") state.splitCombo = Boolean(node.checked);
        paint(root);
        return;
      }
      if (act === "shop") {
        state.shop = node.value;
        state.pageNo = 1;
        load(root, token);
        return;
      }
      if (act === "pick-date") {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(node.value || "")) {
          return;
        }
        var pickedDay = clampRange(node.value, node.value);
        state.datePop = "";
        applyRange({ from: pickedDay.from, to: pickedDay.to, daysType: "1" });
        load(root, token);
        return;
      }
      if (act === "pick-week") {
        var monday = mondayFromWeekValue(node.value);
        if (!monday || weekContains(monday, shanghaiToday())) {
          return;
        }
        var week = clampRange(monday, iso(addDays(parseIso(monday), 6)));
        state.datePop = "";
        applyRange({ from: week.from, to: week.to, daysType: "week" });
        load(root, token);
        return;
      }
      if (act === "pick-month") {
        if (!/^\d{4}-\d{2}$/.test(node.value || "")) {
          return;
        }
        var monthStart = node.value + "-01";
        var month = clampRange(monthStart, monthEndIso(monthStart));
        state.datePop = "";
        applyRange({ from: month.from, to: month.to, daysType: "month" });
        load(root, token);
        return;
      }
      if (act === "range-from" || act === "range-to") {
        state[act === "range-from" ? "from" : "to"] = node.value;
        state.daysType = "custom";
        state.pageNo = 1;
        if (state.from && state.to) {
          load(root, token);
        }
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
    function onArchiveSearch(event) {
      if (state.localArchive && event.target.getAttribute && event.target.getAttribute("data-act") === "q") onChange(event);
    }
    root.addEventListener("input", onArchiveSearch);
    function onProductImageError(event) {
      var img = event.target;
      if (img && img.tagName === "IMG" && img.parentElement && img.parentElement.classList.contains("bd-product-thumb")) img.hidden = true;
    }
    root.addEventListener("error", onProductImageError, true);
    function onLoginFocus(event) {
      if (event.target.closest && event.target.closest("[data-bound-password]")) state.loginEditing = true;
    }
    function onLoginBlur(event) {
      state.loginEditing = Boolean(event.relatedTarget && event.relatedTarget.closest && event.relatedTarget.closest("[data-bound-password]"));
    }
    root.addEventListener("focusin", onLoginFocus);
    root.addEventListener("focusout", onLoginBlur);
    return function () {
      if (root.removeEventListener) {
        root.removeEventListener("click", onClick);
        root.removeEventListener("change", onChange);
        root.removeEventListener("input", onArchiveSearch);
        root.removeEventListener("error", onProductImageError, true);
        root.removeEventListener("focusin", onLoginFocus);
        root.removeEventListener("focusout", onLoginBlur);
      }
    };
  }

  window.XmModules = window.XmModules || {};
  window.XmModules["/bound"] = {
    mount: function (root) {
      var token = ++active;
      state.loginEditing = false;
      var initialProbeDate = new URLSearchParams(window.location && window.location.search || "").get("probeDate");
      if (initialProbeDate) { state.page = "link"; state.probeDate = initialProbeDate; }
      ensureStyle();
      if (root.classList) {
        root.classList.add("xm-ui-scope");
      }
      root.innerHTML = '<div class="bd-app xm-ui-scope" data-bound-erp="false"><nav class="bd-side" aria-label="边界数据中心"></nav><section class="bd-main"><p class="bd-note">爬虫，非 ERP</p></section></div>';
      detach = listen(root, token);
      load(root, token);
      if (typeof setInterval === "function") {
        var archivePollTick = 0;
        timer = setInterval(function () {
          if (state.page === "link" && state.admin && !state.loginEditing && !state.passwordBusy) {
            load(root, token);
          }
          if (state.localArchive && ++archivePollTick % 10 === 0 && token === active) {
            fetch("/api/bound/shop-day/run").then(function (r) { return r.ok ? r.json() : null; }).then(function (result) {
              if (!result || !result.ok || token !== active) return;
              state.localArchive.run = result.run;
              var label = root.querySelector && root.querySelector('[data-archive-progress]');
              if (label) label.textContent = archiveRunText();
            }).catch(function () { /* The saved data remains readable during a local outage. */ });
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
