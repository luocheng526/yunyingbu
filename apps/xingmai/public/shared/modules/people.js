/* xm-module-people 0.1.65 */
(function () {
  window.XmModules = window.XmModules || {};
  window.XmModules["/people"] = {
    mount: function (root) {
      root.innerHTML =
        '<main class="page">' +
        '<header class="page-head"><p class="kicker">星脉</p><h1>人员管理</h1>' +
        '<p class="lead">组织名册写入数据库。预置三人带演示标记，后来新增的人员会留下。</p></header>' +
        '<div class="stack"><section class="panel"><h2>新增人员</h2>' +
        '<form class="people-form" id="people-form">' +
        '<label>姓名<input name="name" required maxlength="40" autocomplete="off" /></label>' +
        '<label>角色<input name="role" required maxlength="40" placeholder="如 运营 / 管理" /></label>' +
        "<label>所属中心<select name=\"center\" required>" +
        '<option value="">请选择</option><option>沈子晗运营中心</option><option>韩梦凯运营中心</option>' +
        "<option>数据中心</option><option>版本发布中心</option><option>个人中心</option><option>其他</option>" +
        "</select></label>" +
        "<label>状态<select name=\"status\"><option selected>在职</option><option>离职</option></select></label>" +
        '<button type="submit">新增</button></form>' +
        '<p class="status error" id="people-error" hidden></p></section>' +
        '<section class="panel"><h2>人员名册</h2><table><thead><tr><th>姓名</th><th>角色</th><th>所属中心</th><th>状态</th></tr></thead>' +
        '<tbody id="people-tbody"></tbody></table></section></div></main>';

      const tbody = root.querySelector("#people-tbody");
      const form = root.querySelector("#people-form");
      const errorEl = root.querySelector("#people-error");
      let dead = false;

      function showError(message) {
        errorEl.hidden = !message;
        errorEl.textContent = message || "";
      }

      function render(people) {
        tbody.replaceChildren();
        if (!people.length) {
          const tr = document.createElement("tr");
          tr.innerHTML = '<td colspan="4" class="empty">暂无人员</td>';
          tbody.append(tr);
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
          const role = document.createElement("td");
          role.textContent = person.role;
          const center = document.createElement("td");
          center.textContent = person.center;
          const status = document.createElement("td");
          status.textContent = person.status;
          tr.append(name, role, center, status);
          tbody.append(tr);
        });
      }

      async function loadPeople() {
        const res = await fetch("/api/people", { credentials: "same-origin" });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error || "无法加载人员名册");
        }
        if (!dead) {
          render(data.people || []);
        }
      }

      function onSubmit(event) {
        event.preventDefault();
        showError("");
        const payload = Object.fromEntries(new FormData(form).entries());
        fetch("/api/people", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
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
              showError(result.data.error || "新增失败");
              return;
            }
            form.reset();
            form.status.value = "在职";
            return loadPeople();
          });
      }

      form.addEventListener("submit", onSubmit);
      loadPeople().catch(function (err) {
        if (!dead) {
          showError(err.message);
        }
      });

      return function unmount() {
        dead = true;
        form.removeEventListener("submit", onSubmit);
        root.innerHTML = "";
      };
    }
  };
})();
