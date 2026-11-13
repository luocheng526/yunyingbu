export function groupOf(store) {
  const supervisor = String((store && store.supervisor) || "").trim();
  const reserve = String((store && store.reserve) || "").trim();
  const name = supervisor || reserve;
  if (!name) {
    return "未分组";
  }
  return /组$/.test(name) ? name : name + "组";
}

export function shortHouse(name) {
  const text = String(name || "");
  const city = text.match(/^([\u4e00-\u9fa5]{2,3}?)(?=常|温|[A-Za-z])/);
  const num = text.match(/(\d+)号库/);
  if (city && num) {
    return city[1] + num[1];
  }
  return text.replace(/常温|平台仓|中件消费品|库-CHN|-CHN/g, "").slice(0, 8) || text;
}

export function shopNames(stores) {
  return (stores || []).map(function (store) {
    return String(store.storeName || "").trim();
  }).filter(Boolean);
}

export function groupsOf(stores) {
  const buckets = {};
  (stores || []).forEach(function (store) {
    const name = String(store.storeName || "").trim();
    if (!name) {
      return;
    }
    const group = groupOf(store);
    if (!buckets[group]) {
      buckets[group] = [];
    }
    buckets[group].push(store);
  });
  return Object.keys(buckets)
    .map(function (name) {
      const shops = buckets[name].slice().sort(function (a, b) {
        return String(a.storeName).localeCompare(String(b.storeName), "zh");
      });
      return { name: name, shops: shops };
    })
    .sort(function (a, b) {
      if (a.name === "未分组") {
        return 1;
      }
      if (b.name === "未分组") {
        return -1;
      }
      return a.name.localeCompare(b.name, "zh");
    });
}

export function collectedMap(data) {
  const collected = (data && data.collected) || {};
  const map = {};
  Object.keys(collected).forEach(function (shop) {
    const pack = collected[shop] || {};
    const rows = Array.isArray(pack.rows) ? pack.rows : [];
    if (!rows.length) {
      return;
    }
    map[shop] = {
      capturedAt: pack.capturedAt || data.capturedAt || "",
      rows: rows
    };
  });
  return map;
}

export function qtyAt(row, house) {
  const found = (row.warehouses || []).find(function (item) {
    return item && item.name === house;
  });
  if (!found || found.qty == null || found.qty === "") {
    return null;
  }
  const qty = Number(found.qty);
  return Number.isFinite(qty) ? qty : null;
}

export function knownTotal(row) {
  let total = 0;
  let any = false;
  (row.warehouses || []).forEach(function (item) {
    if (!item || item.qty == null || item.qty === "") {
      return;
    }
    const qty = Number(item.qty);
    if (!Number.isFinite(qty)) {
      return;
    }
    any = true;
    total += qty;
  });
  return any ? total : null;
}

export function warehouseNames(rows) {
  const names = [];
  const seen = {};
  (rows || []).forEach(function (row) {
    (row.warehouses || []).forEach(function (item) {
      const name = String((item && item.name) || "");
      if (!name || seen[name] || name.indexOf("全国仓") !== -1) {
        return;
      }
      seen[name] = true;
      names.push(name);
    });
  });
  names.sort(function (a, b) {
    return shortHouse(a).localeCompare(shortHouse(b), "zh");
  });
  return names;
}

export function scopeShops(stores, group) {
  return (stores || []).filter(function (store) {
    return !group || groupOf(store) === group;
  });
}

export function detailRows(stores, collected, options) {
  const group = options.group || "";
  const picked = options.picked;
  const query = String(options.query || "").trim().toLowerCase();
  const house = options.house || "";
  const mode = options.mode || "";
  const threshold = Number(options.threshold);
  const limit = Number.isFinite(threshold) ? threshold : 5;
  const scoped = scopeShops(stores, group).filter(function (store) {
    if (!picked || !picked.length) {
      return true;
    }
    return picked.indexOf(store.storeName) !== -1;
  });
  const lines = [];
  scoped.forEach(function (store) {
    const pack = collected[store.storeName];
    if (!pack) {
      return;
    }
    pack.rows.forEach(function (row) {
      const blob = [row.name, row.sku, row.spu, row.code, store.storeName].join(" ").toLowerCase();
      if (query && blob.indexOf(query) === -1) {
        return;
      }
      const cell = house ? qtyAt(row, house) : null;
      if (house && mode === "out" && cell !== 0) {
        return;
      }
      if (house && mode === "low" && !(cell != null && cell <= limit)) {
        return;
      }
      lines.push({
        shop: store.storeName,
        group: groupOf(store),
        name: row.name || "",
        spu: row.spu || "",
        sku: row.sku || "",
        code: row.code || "",
        status: row.status || "",
        image: row.image || "",
        warehouses: row.warehouses || [],
        total: knownTotal(row),
        capturedAt: pack.capturedAt || ""
      });
    });
  });
  lines.sort(function (a, b) {
    if (house) {
      const left = qtyAt(a, house);
      const right = qtyAt(b, house);
      if (left == null && right == null) {
        return a.shop.localeCompare(b.shop, "zh") || a.sku.localeCompare(b.sku);
      }
      if (left == null) {
        return 1;
      }
      if (right == null) {
        return -1;
      }
      if (left !== right) {
        return left - right;
      }
    } else if ((b.total || 0) !== (a.total || 0)) {
      return (b.total || 0) - (a.total || 0);
    }
    return a.shop.localeCompare(b.shop, "zh") || a.sku.localeCompare(b.sku);
  });
  return lines;
}

export function shopSummary(stores, collected, options) {
  const house = options.house || "";
  return scopeShops(stores, options.group || "")
    .filter(function (store) {
      if (!options.picked || !options.picked.length) {
        return true;
      }
      return options.picked.indexOf(store.storeName) !== -1;
    })
    .map(function (store) {
      const pack = collected[store.storeName];
      if (!pack) {
        return {
          shop: store.storeName,
          group: groupOf(store),
          sku: null,
          total: null,
          out: null,
          state: "待采集",
          capturedAt: ""
        };
      }
      let out = 0;
      pack.rows.forEach(function (row) {
        if (house) {
          if (qtyAt(row, house) === 0) {
            out += 1;
          }
          return;
        }
        const hit = (row.warehouses || []).some(function (item) {
          return Number(item.qty) === 0;
        });
        if (hit) {
          out += 1;
        }
      });
      let total = 0;
      let seenQty = false;
      pack.rows.forEach(function (row) {
        const known = house ? qtyAt(row, house) : knownTotal(row);
        if (known == null) {
          return;
        }
        seenQty = true;
        total += known;
      });
      if (!seenQty) {
        total = null;
      }
      return {
        shop: store.storeName,
        group: groupOf(store),
        sku: pack.rows.length,
        total: total,
        out: out,
        state: "已采集",
        capturedAt: pack.capturedAt || ""
      };
    })
    .sort(function (a, b) {
      return a.group.localeCompare(b.group, "zh") || a.shop.localeCompare(b.shop, "zh");
    });
}

export function headline(rows) {
  const collected = (rows || []).filter(function (row) {
    return row.state === "已采集";
  });
  return {
    shops: (rows || []).length,
    collected: collected.length,
    waiting: (rows || []).length - collected.length,
    total: collected.length === 1 ? collected[0].total : null,
    out: collected.length === 1 ? collected[0].out : null,
    shop: collected.length === 1 ? collected[0].shop : ""
  };
}

export function scopeLabel(group, picked, house) {
  const who = group || "全部店铺";
  const shops = picked && picked.length ? picked.join("、") : "全部店铺";
  const where = house ? shortHouse(house) : "全部已返回的仓";
  return who + " · " + shops + " · " + where;
}
