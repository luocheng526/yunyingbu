import {
  collectedMap,
  detailRows,
  groupsOf,
  groupOf,
  headline,
  qtyAt,
  scopeLabel,
  shopSummary,
  shortHouse,
  warehouseNames
} from "./logic.js";

const root = document.querySelector("#app");
const state = {
  group: "",
  picked: [],
  roster: true,
  view: "detail",
  query: "",
  house: "",
  mode: "",
  threshold: 5,
  shopQuery: "",
  back: null,
  drawer: null
};

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function num(value) {
  if (value == null) {
    return "—";
  }
  return Number(value).toLocaleString("zh-CN");
}

function brief(name) {
  const text = String(name || "");
  return text.length > 26 ? text.slice(0, 26) + "…" : text;
}

function namesInScope(stores) {
  return stores
    .filter(function (store) {
      return !state.group || groupOf(store) === state.group;
    })
    .map(function (store) {
      return store.storeName;
    });
}

function activePicked(stores) {
  const names = namesInScope(stores);
  if (!state.picked.length) {
    return names;
  }
  return state.picked.filter(function (name) {
    return names.indexOf(name) !== -1;
  });
}

function options(stores) {
  return {
    group: state.group,
    picked: state.picked,
    query: state.query,
    house: state.house,
    mode: state.mode,
    threshold: state.threshold
  };
}

function cellText(row, house) {
  const qty = qtyAt(row, house);
  if (qty == null) {
    return '<span class="is-none">—</span>';
  }
  if (qty === 0) {
    return '<span class="is-out">0</span>';
  }
  return num(qty);
}

async function copyText(value, button) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const input = document.createElement("textarea");
    input.value = value;
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    input.remove();
  }
  button.textContent = "已复制";
}

function render(data) {
  const stores = data.stores || [];
  const collected = collectedMap(data);
  const groups = groupsOf(stores);
  const summary = shopSummary(stores, collected, options(stores));
  const head = headline(summary);
  const lines = detailRows(stores, collected, options(stores));
  const columnSource = detailRows(stores, collected, {
    group: state.group,
    picked: state.picked,
    query: "",
    house: "",
    mode: ""
  });
  const houses = warehouseNames(columnSource);
  const picked = activePicked(stores);
  const scope = scopeLabel(state.group, state.picked.length ? picked : [], state.house);
  const waitingNames = summary
    .filter(function (row) {
      return row.state === "待采集";
    })
    .map(function (row) {
      return row.shop;
    });
  const totalNote = head.total == null
    ? head.collected > 1
      ? "多家店已采集。未确认是否共用实物库存，所以不把各店数量加在一起。"
      : "当前范围内还没有已采集的店。"
    : "只统计 " + head.shop + "。未与其他店相加。";
  const tabs = ['<button type="button" data-group="" class="' + (state.group ? "" : "is-on") + '">全部店铺</button>']
    .concat(groups.map(function (group) {
      return '<button type="button" data-group="' + escapeHtml(group.name) + '" class="' + (state.group === group.name ? "is-on" : "") + '">' + escapeHtml(group.name) + "（" + group.shops.length + "店）</button>";
    }))
    .join("");
  const roster = state.roster
    ? '<section class="roster"><h2>分组名单</h2>' +
      groups.map(function (group) {
        return "<div><b>" + escapeHtml(group.name) + "</b><ul>" +
          group.shops.map(function (store) {
            const on = Boolean(collected[store.storeName]);
            return "<li>" + escapeHtml(store.storeName) + '<span class="tag ' + (on ? "is-on" : "is-wait") + '">' + (on ? "已采集" : "待采集") + "</span></li>";
          }).join("") +
          "</ul></div>";
      }).join("") +
      "</section>"
    : "";
  const shopBox = state.group
    ? '<section class="shops"><input data-shop-query type="search" placeholder="在本组搜索店名" value="' + escapeHtml(state.shopQuery) + '" />' +
      "<ul>" +
      stores.filter(function (store) {
        return groupOf(store) === state.group && (!state.shopQuery || store.storeName.toLowerCase().indexOf(state.shopQuery.toLowerCase()) !== -1);
      }).map(function (store) {
        const on = picked.indexOf(store.storeName) !== -1;
        const collectedShop = Boolean(collected[store.storeName]);
        return '<li><label><input type="checkbox" data-shop="' + escapeHtml(store.storeName) + '"' + (on ? " checked" : "") + " />" + escapeHtml(store.storeName) + '<span class="tag ' + (collectedShop ? "is-on" : "is-wait") + '">' + (collectedShop ? "已采集" : "待采集") + "</span></label></li>";
      }).join("") +
      "</ul></section>"
    : "";
  const houseOptions = ['<option value="">全部已返回的仓</option>']
    .concat(houses.map(function (name) {
      return '<option value="' + escapeHtml(name) + '"' + (state.house === name ? " selected" : "") + ">" + escapeHtml(shortHouse(name)) + "</option>";
    }))
    .join("");
  const table = state.view === "shops"
    ? summaryTable(summary)
    : detailTable(lines, houses, waitingNames);
  const drawer = state.drawer ? drawerHtml(state.drawer, houses) : "";
  root.innerHTML =
    '<p class="banner">这是京仓管理的预览，没有替换线上页面。组织名单和库存用的是 ' + escapeHtml(data.capturedAt || "") + '（北京时间）的真实快照。目前只有 RASW潮流生活旗舰店 采到了京仓库存，其他店标为待采集。没有返回的仓显示 —，只有采到 0 才算缺货。</p>' +
    "<header><h1>京仓管理<em>预览</em></h1><p class=\"lead\">先看分组里有哪些店，再看整组、几家店或某一个仓的库存。</p></header>" +
    '<section class="kpis"><article><span>统计范围</span><strong>' + escapeHtml(state.group || "全部店铺") + "</strong><small>" + escapeHtml(scope) + "</small></article>" +
    "<article><span>店铺</span><strong>" + head.shops + "</strong><small>已采集 " + head.collected + " · 待采集 " + head.waiting + "</small></article>" +
    "<article><span>" + (state.house ? escapeHtml(shortHouse(state.house)) + " 已采数量" : "可用库存") + "</span><strong>" + num(head.total) + "</strong><small>" + escapeHtml(totalNote) + "</small></article>" +
    "<article><span>" + (state.house ? escapeHtml(shortHouse(state.house)) + " 缺货 SKU" : "采到 0 的 SKU") + "</span><strong>" + (head.out == null ? "—" : head.out) + "</strong><small>" + (state.house ? "只看这个仓采到的 0" : "任一已返回的仓采到 0") + "</small></article></section>" +
    '<div class="bar"><nav class="tabs">' + tabs + '</nav><button type="button" data-roster>' + (state.roster ? "收起分组名单" : "查看分组名单") + "</button></div>" +
    roster +
    shopBox +
    '<div class="tools"><div class="views"><button type="button" data-view="detail" class="' + (state.view === "detail" ? "is-on" : "") + '">库存明细</button><button type="button" data-view="shops" class="' + (state.view === "shops" ? "is-on" : "") + '">按店铺汇总</button></div>' +
    (state.back ? '<button type="button" class="back" data-back>返回</button>' : "") +
    '<input data-query type="search" placeholder="商品名、SKU、SPU" value="' + escapeHtml(state.query) + '" />' +
    '<select data-house>' + houseOptions + "</select>" +
    '<button type="button" data-mode="out" class="' + (state.mode === "out" ? "is-on" : "") + '"' + (state.house ? "" : " disabled") + ">缺货</button>" +
    '<button type="button" data-mode="low" class="' + (state.mode === "low" ? "is-on" : "") + '"' + (state.house ? "" : " disabled") + ">低库存</button>" +
    '<label>阈值 <input data-threshold type="number" min="0" value="' + escapeHtml(state.threshold) + '" /></label></div>' +
    table +
    drawer;
}

function summaryTable(rows) {
  return '<div class="grid"><table><thead><tr><th class="stick col-shop">所属组</th><th class="stick col-name">店铺</th><th>SKU 数</th><th>可用库存</th><th>缺货 SKU</th><th>采集状态</th><th>最后成功采集</th></tr></thead><tbody>' +
    rows.map(function (row) {
      return "<tr><td class=\"stick col-shop\">" + escapeHtml(row.group) + "</td><td class=\"stick col-name\"><button type=\"button\" data-open-shop=\"" + escapeHtml(row.shop) + "\">" + escapeHtml(row.shop) + "</button></td><td>" + num(row.sku) + "</td><td>" + num(row.total) + "</td><td>" + num(row.out) + "</td><td>" + escapeHtml(row.state) + "</td><td>" + escapeHtml(row.capturedAt || "—") + "</td></tr>";
    }).join("") +
    "</tbody></table></div>";
}

function detailTable(lines, houses, waitingNames) {
  if (!lines.length) {
    const reason = waitingNames.length
      ? escapeHtml(waitingNames.join("、")) + " 还是待采集，没有可对比的库存行。当前只有杨润泽组的 RASW潮流生活旗舰店 采到了京仓库存。"
      : "这个筛选下没有商品。未返回的仓不是缺货。";
    return '<p class="empty">' + reason + "</p>";
  }
  const head = '<th class="stick col-shop">店铺</th><th class="stick col-name">商品</th><th class="stick col-spec">规格</th><th class="stick col-sku">SKU</th><th>可用</th>' +
    houses.map(function (name) {
      return '<th class="house" title="' + escapeHtml(name) + '">' + escapeHtml(shortHouse(name)) + "</th>";
    }).join("");
  const body = lines.map(function (row, index) {
    return "<tr><td class=\"stick col-shop\">" + escapeHtml(row.shop) + "</td><td class=\"stick col-name\"><button type=\"button\" data-open-row=\"" + index + "\">" + escapeHtml(brief(row.name)) + "</button></td><td class=\"stick col-spec\">" + escapeHtml(row.code || "—") + "</td><td class=\"stick col-sku\">" + escapeHtml(row.sku) + '<button type="button" class="copy" data-copy="' + escapeHtml(row.sku) + '">复制</button></td><td>' + num(row.total) + "</td>" +
      houses.map(function (name) {
        return '<td class="house">' + cellText(row, name) + "</td>";
      }).join("") +
      "</tr>";
  }).join("");
  return '<div class="grid"><table><thead><tr>' + head + "</tr></thead><tbody>" + body + "</tbody></table></div>";
}

function drawerHtml(row, houses) {
  const items = houses.map(function (name) {
    return "<li><span title=\"" + escapeHtml(name) + "\">" + escapeHtml(shortHouse(name)) + "</span><b>" + cellText(row, name) + "</b></li>";
  }).join("");
  return '<aside class="drawer"><button type="button" data-close>关闭</button><h2>' + escapeHtml(row.name) + "</h2>" +
    (row.image ? '<img src="' + escapeHtml(row.image) + '" alt="" />' : "") +
    "<p>店铺 " + escapeHtml(row.shop) + "<br />SPU " + escapeHtml(row.spu || "—") + "<br />SKU " + escapeHtml(row.sku) + "<br />规格 " + escapeHtml(row.code || "—") + "<br />最后采集 " + escapeHtml(row.capturedAt || "—") + "</p><ul>" + items + "</ul></aside>";
}

function focusField(selector) {
  const input = root.querySelector(selector);
  if (!input) {
    return;
  }
  input.focus();
  const pos = input.value.length;
  if (input.setSelectionRange) {
    input.setSelectionRange(pos, pos);
  }
}

function bind(data) {
  root.onclick = function (event) {
    const group = event.target.closest("[data-group]");
    if (group) {
      state.group = group.getAttribute("data-group") || "";
      state.picked = [];
      state.shopQuery = "";
      state.query = "";
      state.house = "";
      state.mode = "";
      state.back = null;
      state.drawer = null;
      render(data);
      return;
    }
    if (event.target.closest("[data-roster]")) {
      state.roster = !state.roster;
      render(data);
      return;
    }
    const view = event.target.closest("[data-view]");
    if (view) {
      state.view = view.getAttribute("data-view");
      state.drawer = null;
      render(data);
      return;
    }
    const mode = event.target.closest("[data-mode]");
    if (mode && state.house) {
      const next = mode.getAttribute("data-mode");
      state.mode = state.mode === next ? "" : next;
      render(data);
      return;
    }
    if (event.target.closest("[data-back]") && state.back) {
      Object.assign(state, state.back);
      state.back = null;
      state.drawer = null;
      render(data);
      return;
    }
    if (event.target.closest("[data-close]")) {
      state.drawer = null;
      render(data);
      return;
    }
    const copy = event.target.closest("[data-copy]");
    if (copy) {
      event.stopPropagation();
      copyText(copy.getAttribute("data-copy"), copy);
      return;
    }
    const shop = event.target.closest("[data-open-shop]");
    if (shop) {
      const name = shop.getAttribute("data-open-shop");
      const store = (data.stores || []).find(function (item) {
        return item.storeName === name;
      });
      state.back = {
        group: state.group,
        picked: state.picked.slice(),
        view: state.view,
        query: state.query,
        house: state.house,
        mode: state.mode,
        shopQuery: state.shopQuery
      };
      state.group = store ? groupOf(store) : "";
      state.picked = [name];
      state.view = "detail";
      state.drawer = null;
      render(data);
      return;
    }
    const open = event.target.closest("[data-open-row]");
    if (open) {
      const lines = detailRows(data.stores || [], collectedMap(data), options(data.stores || []));
      state.drawer = lines[Number(open.getAttribute("data-open-row"))] || null;
      render(data);
    }
  };
  root.onchange = function (event) {
    const shop = event.target.closest("[data-shop]");
    if (shop) {
      const name = shop.getAttribute("data-shop");
      const names = namesInScope(data.stores || []);
      const next = (state.picked.length ? state.picked : names).slice();
      const index = next.indexOf(name);
      if (shop.checked && index < 0) {
        next.push(name);
      }
      if (!shop.checked && index >= 0) {
        next.splice(index, 1);
      }
      state.picked = next.length === names.length ? [] : next;
      state.drawer = null;
      render(data);
      return;
    }
    if (event.target.matches("[data-house]")) {
      state.house = event.target.value;
      if (!state.house) {
        state.mode = "";
      }
      render(data);
      return;
    }
    if (event.target.matches("[data-threshold]")) {
      state.threshold = Math.max(0, Number(event.target.value) || 0);
      render(data);
    }
  };
  root.oninput = function (event) {
    if (event.target.matches("[data-query]")) {
      state.query = event.target.value;
      render(data);
      focusField("[data-query]");
    }
    if (event.target.matches("[data-shop-query]")) {
      state.shopQuery = event.target.value;
      render(data);
      focusField("[data-shop-query]");
    }
  };
}

const data = await fetch("./data.json").then(function (res) {
  return res.json();
});
bind(data);
render(data);
