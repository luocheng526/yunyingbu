/* xm-module-people */
(function () {
  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function ensureCss() {
    if (document.querySelector('link[href*="people.css"]')) {
      return;
    }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/people.css";
    document.head.appendChild(link);
  }

  function optionHtml(value, selected) {
    return (
      "<option value=\"" +
      escapeHtml(value) +
      "\"" +
      (value === selected ? " selected" : "") +
      ">" +
      escapeHtml(value) +
      "</option>"
    );
  }

  window.XmModules = window.XmModules || {};
  window.XmModules["/people"] = {
    mount: function (root) {
      ensureCss();
      root.innerHTML =
        '<main class="page people-page">' +
        '<header class="page-head"><h1>花名册试点</h1>' +
        '<p class="lead">先用手录身份和店权。沈子晗线的人和店已预置，标了演示。不接钉钉。一人多店用多条管辖。</p></header>' +
        '<div class="stack">' +
        '<section class="panel"><h2>身份名册</h2>' +
        '<form class="people-form" id="people-form">' +
        '<label>姓名<input name="name" required maxlength="40" autocomplete="off" /></label>' +
        '<label>工号<input name="employeeNo" maxlength="32" /></label>' +
        '<label>部门<input name="department" maxlength="64" placeholder="如 沈子晗运营中心" /></label>' +
        '<label>上级<select name="managerId"><option value="">无</option></select></label>' +
        '<label>岗位<select name="role"></select></label>' +
        '<label>所属中心<select name="center" required><option value="">请选择</option></select></label>' +
        '<label>状态<select name="status"><option selected>在职</option><option>离职</option></select></label>' +
        '<button type="submit">新增人员</button></form>' +
        '<p class="status error" id="people-error" hidden></p>' +
        '<div class="people-table-wrap"><table><thead><tr><th>姓名</th><th>工号</th><th>部门</th><th>上级</th><th>岗位</th><th>所属中心</th><th>状态</th><th>能看见的店</th></tr></thead>' +
        '<tbody id="people-tbody"></tbody></table></div></section>' +
        '<section class="panel"><h2>店铺 / 店群</h2>' +
        '<form class="people-mini-form" id="shop-form">' +
        '<label>名称<input name="name" required maxlength="64" /></label>' +
        '<label>类型<select name="kind"><option>店铺</option><option>店群</option></select></label>' +
        '<label>所属包<input name="pack" maxlength="32" placeholder="沈子晗包" /></label>' +
        '<label>主管包<input name="bundle" maxlength="32" placeholder="杨润泽包，可空" /></label>' +
        '<button type="submit">新增店铺</button></form>' +
        '<p class="status error" id="shop-error" hidden></p>' +
        '<div class="people-table-wrap"><table><thead><tr><th>名称</th><th>类型</th><th>所属包</th><th>主管包</th></tr></thead>' +
        '<tbody id="shop-tbody"></tbody></table></div></section>' +
        '<section class="panel"><h2>管辖</h2>' +
        '<form class="people-mini-form" id="grant-form">' +
        '<label>人员<select name="personId" required></select></label>' +
        '<label>店铺或店群<select name="shopId" required></select></label>' +
        '<label>角色<select name="role"></select></label>' +
        '<label>生效起<input name="startOn" type="date" /></label>' +
        '<label>生效止<input name="endOn" type="date" /></label>' +
        '<button type="submit">新增授权</button></form>' +
        '<p class="status error" id="grant-error" hidden></p>' +
        '<div class="people-table-wrap"><table><thead><tr><th>人</th><th>店 / 店群</th><th>角色</th><th>生效</th><th>状态</th></tr></thead>' +
        '<tbody id="grant-tbody"></tbody></table></div></section>' +
        '<section class="panel"><h2>对账</h2>' +
        '<p class="people-check muted" id="check-employed">在职但没有店权：—</p>' +
        '<p class="people-check muted" id="check-left">店权还挂在离职人员：—</p>' +
        "</section></div></main>";

      const peopleForm = root.querySelector("#people-form");
      const shopForm = root.querySelector("#shop-form");
      const grantForm = root.querySelector("#grant-form");
      const peopleError = root.querySelector("#people-error");
      const shopError = root.querySelector("#shop-error");
      const grantError = root.querySelector("#grant-error");
      let dead = false;
      let snapshot = { people: [], shops: [], grants: [], posts: ["店长", "运营", "主管", "经理"], centers: [] };

      function showError(el, message) {
        el.hidden = !message;
        el.textContent = message || "";
      }

      function fillSelect(select, items, getValue, getLabel, emptyLabel) {
        const current = select.value;
        select.innerHTML = emptyLabel ? '<option value="">' + escapeHtml(emptyLabel) + "</option>" : "";
        items.forEach(function (item) {
          const option = document.createElement("option");
          option.value = getValue(item);
          option.textContent = getLabel(item);
          select.append(option);
        });
        if ([...select.options].some(function (option) { return option.value === current; })) {
          select.value = current;
        }
      }

      function renderPeople(people) {
        const tbody = root.querySelector("#people-tbody");
        tbody.replaceChildren();
        if (!people.length) {
          tbody.innerHTML = '<tr><td colspan="8" class="empty">暂无人员</td></tr>';
          return;
        }
        people.forEach(function (person) {
          const tr = document.createElement("tr");
          const name = document.createElement("td");
          name.append(person.name);
          if (person.demo) {
            const tag = document.createElement("span");
            tag.className = "demo-flag";
            tag.textContent = "演示";
            name.append(tag);
          }
          const status = document.createElement("td");
          const select = document.createElement("select");
          select.className = "people-status";
          select.innerHTML = optionHtml("在职", person.status) + optionHtml("离职", person.status);
          select.addEventListener("change", function () {
            fetch("/api/people/" + person.id, {
              method: "PATCH",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: select.value })
            }).then(function () {
              return reload();
            });
          });
          status.append(select);
          const shops = document.createElement("td");
          shops.textContent = (person.visibleShops || []).join("、") || "—";
          const cells = [
            name,
            textCell(person.employeeNo),
            textCell(person.department),
            textCell(person.managerName || "—"),
            textCell(person.role),
            textCell(person.center),
            status,
            shops
          ];
          cells.forEach(function (cell) {
            tr.append(cell);
          });
          tbody.append(tr);
        });
      }

      function textCell(value) {
        const td = document.createElement("td");
        td.textContent = value || "—";
        return td;
      }

      function renderShops(shops) {
        const tbody = root.querySelector("#shop-tbody");
        tbody.replaceChildren();
        if (!shops.length) {
          tbody.innerHTML = '<tr><td colspan="4" class="empty">暂无店铺</td></tr>';
          return;
        }
        shops.forEach(function (shop) {
          const tr = document.createElement("tr");
          const name = document.createElement("td");
          name.append(shop.name);
          if (shop.demo) {
            const tag = document.createElement("span");
            tag.className = "demo-flag";
            tag.textContent = "演示";
            name.append(tag);
          }
          tr.append(name, textCell(shop.kind), textCell(shop.pack), textCell(shop.bundle || "—"));
          tbody.append(tr);
        });
      }

      function renderGrants(grants) {
        const tbody = root.querySelector("#grant-tbody");
        tbody.replaceChildren();
        if (!grants.length) {
          tbody.innerHTML = '<tr><td colspan="5" class="empty">暂无管辖</td></tr>';
          return;
        }
        grants.forEach(function (grant) {
          const tr = document.createElement("tr");
          const range = (grant.startOn || "") + (grant.endOn ? " ~ " + grant.endOn : " 起");
          tr.append(
            textCell(grant.personName),
            textCell(grant.shopName),
            textCell(grant.role),
            textCell(range),
            textCell(grant.active ? "有效" : "已失效")
          );
          tbody.append(tr);
        });
      }

      function renderChecks(data) {
        const employed = (data.employedNoGrant || []).map(function (item) { return item.name; });
        const left = (data.grantOnLeft || []).map(function (item) { return item.personName + " / " + item.shopName; });
        root.querySelector("#check-employed").textContent =
          "在职但没有店权：" + (employed.length ? employed.join("、") : "无");
        root.querySelector("#check-left").textContent =
          "店权还挂在离职人员：" + (left.length ? left.join("、") : "无");
      }

      function syncSelects() {
        const posts = snapshot.posts || [];
        fillSelect(peopleForm.role, posts, function (item) { return item; }, function (item) { return item; });
        fillSelect(grantForm.role, posts, function (item) { return item; }, function (item) { return item; });
        fillSelect(peopleForm.center, snapshot.centers || [], function (item) { return item; }, function (item) { return item; }, "请选择");
        fillSelect(
          peopleForm.managerId,
          snapshot.people || [],
          function (item) { return String(item.id); },
          function (item) { return item.name; },
          "无"
        );
        fillSelect(
          grantForm.personId,
          snapshot.people || [],
          function (item) { return String(item.id); },
          function (item) { return item.name; },
          "请选择"
        );
        fillSelect(
          grantForm.shopId,
          snapshot.shops || [],
          function (item) { return String(item.id); },
          function (item) { return item.name + "（" + item.kind + "）"; },
          "请选择"
        );
      }

      function reload() {
        return Promise.all([
          fetch("/api/people", { credentials: "same-origin" }).then(function (res) { return res.json(); }),
          fetch("/api/people/shops", { credentials: "same-origin" }).then(function (res) { return res.json(); }),
          fetch("/api/people/grants", { credentials: "same-origin" }).then(function (res) { return res.json(); }),
          fetch("/api/people/reconcile", { credentials: "same-origin" }).then(function (res) { return res.json(); })
        ]).then(function (results) {
          if (dead) {
            return;
          }
          const peopleData = results[0];
          const shopData = results[1];
          const grantData = results[2];
          const checkData = results[3];
          if (!peopleData.ok) {
            throw new Error(peopleData.error || "无法加载人员名册");
          }
          snapshot = {
            people: peopleData.people || [],
            shops: shopData.shops || [],
            grants: grantData.grants || [],
            posts: peopleData.posts || snapshot.posts,
            centers: peopleData.centers || []
          };
          renderPeople(snapshot.people);
          renderShops(snapshot.shops);
          renderGrants(snapshot.grants);
          renderChecks(checkData);
          syncSelects();
        });
      }

      function postForm(form, url, map, errorEl) {
        return function (event) {
          event.preventDefault();
          showError(errorEl, "");
          const raw = Object.fromEntries(new FormData(form).entries());
          fetch(url, {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(map(raw))
          })
            .then(function (res) {
              return res.json().catch(function () { return {}; }).then(function (data) {
                return { res: res, data: data };
              });
            })
            .then(function (result) {
              if (dead) {
                return;
              }
              if (!result.res.ok || !result.data.ok) {
                showError(errorEl, result.data.error || "保存失败");
                return;
              }
              form.reset();
              return reload();
            });
        };
      }

      const onPeople = postForm(peopleForm, "/api/people", function (raw) { return raw; }, peopleError);
      const onShop = postForm(shopForm, "/api/people/shops", function (raw) { return raw; }, shopError);
      const onGrant = postForm(grantForm, "/api/people/grants", function (raw) { return raw; }, grantError);

      peopleForm.addEventListener("submit", onPeople);
      shopForm.addEventListener("submit", onShop);
      grantForm.addEventListener("submit", onGrant);
      reload().catch(function (err) {
        if (!dead) {
          showError(peopleError, err.message);
        }
      });

      return function unmount() {
        dead = true;
        peopleForm.removeEventListener("submit", onPeople);
        shopForm.removeEventListener("submit", onShop);
        grantForm.removeEventListener("submit", onGrant);
        root.innerHTML = "";
      };
    }
  };
})();
