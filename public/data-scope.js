(function () {
  var FULL = { 罗成: 1, 韩梦凯: 1, 沈子晗: 1, luocheng: 1 };

  function mark(user) {
    if (!user) {
      return "";
    }
    return String(user.displayName || user.name || user.username || "").trim();
  }

  function isFull(user) {
    const n = mark(user);
    const un = String((user && user.username) || "").trim();
    return Boolean(FULL[n] || FULL[un]);
  }

  function shopKey(name) {
    return String(name || "").replace(/\s+/g, "");
  }

  function addShops(set, list) {
    (list || []).forEach(function (item) {
      const name = typeof item === "string" ? item : item && (item.shopName || item.name);
      const key = shopKey(name);
      if (key) {
        set[key] = true;
      }
    });
  }

  function personOf(user, people) {
    const n = mark(user);
    const un = String((user && user.username) || "").trim();
    return (
      (people || []).find(function (person) {
        return person.name === n || person.username === n || person.name === un || person.username === un;
      }) || { name: n, visibleShops: [] }
    );
  }

  function memberOf(lead, person) {
    const name = String((lead && lead.name) || "");
    if (!name || !person) {
      return false;
    }
    if (person.name === name) {
      return true;
    }
    if (person.lineManager === name || person.supervisor === name || person.reserve === name) {
      return true;
    }
    const center = String((lead && lead.center) || "");
    return Boolean(center && person.center === center && /运营中心$/.test(center) && lead.role === "经理");
  }

  function buildScope(user, people) {
    if (isFull(user)) {
      return { all: true };
    }
    const lead = personOf(user, people);
    const names = {};
    const ops = {};
    const ids = {};
    function take(person) {
      addShops(names, person && person.visibleShops);
      const nm = String((person && person.name) || "").trim();
      if (nm) {
        ops[nm] = true;
      }
      if (person && person.id != null) {
        ids[String(person.id)] = true;
      }
    }
    take(lead);
    (people || []).forEach(function (person) {
      if (memberOf(lead, person)) {
        take(person);
      }
    });
    return { all: false, names: names, ops: ops, ids: ids };
  }

  function attachOperate(shops, paid) {
    const recs = (paid && paid.records) || [];
    if (!shops || !recs.length) {
      return shops || [];
    }
    const byId = {};
    const byName = {};
    recs.forEach(function (row) {
      const op = String((row && row.operateName) || "").trim();
      if (!op) {
        return;
      }
      if (row.shopId) {
        byId[String(row.shopId)] = op;
      }
      if (row.shopName) {
        byName[shopKey(row.shopName)] = op;
      }
    });
    shops.forEach(function (shop) {
      shop.operateName =
        shop.operateName || byId[String(shop.shopId || shop.id || "")] || byName[shopKey(shop.shopName)] || "";
    });
    return shops;
  }

  function shopAllowed(shop, scope) {
    if (!scope || scope.all) {
      return true;
    }
    const key = shopKey(shop && (shop.shopName || shop.shop || shop.name));
    if (key && scope.names[key]) {
      return true;
    }
    const op = String((shop && shop.operateName) || "").trim();
    if (op && scope.ops[op]) {
      return true;
    }
    const oid = shop && shop.operatorId != null ? String(shop.operatorId) : "";
    return Boolean(oid && scope.ids[oid]);
  }

  function filterShops(shops, scope) {
    if (!scope || scope.all) {
      return shops || [];
    }
    return (shops || []).filter(function (shop) {
      return shopAllowed(shop, scope);
    });
  }

  function limitShops(shops, pack) {
    const list = shops || [];
    attachOperate(list, pack && pack.paid);
    return filterShops(list, pack && pack.scope);
  }

  function soft(url) {
    return fetch(url, { credentials: "same-origin", headers: { Accept: "application/json" } })
      .then(function (res) {
        return res.ok ? res.json() : null;
      })
      .catch(function () {
        return null;
      });
  }

  var pending = null;
  function ready() {
    if (pending) {
      return pending;
    }
    pending = Promise.all([soft("/api/auth/me"), soft("/api/people"), soft("/api/home/erp-paid")]).then(function (pack) {
      const raw = pack[0];
      const user = raw && (raw.user || raw);
      const people = (pack[1] && pack[1].people) || [];
      const paid = pack[2];
      return { user: user, people: people, paid: paid, scope: buildScope(user, people) };
    });
    return pending;
  }

  window.XmDataScope = {
    isFull: isFull,
    buildScope: buildScope,
    shopAllowed: shopAllowed,
    filterShops: filterShops,
    limitShops: limitShops,
    ready: ready
  };
})();
