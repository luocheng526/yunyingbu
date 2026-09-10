/* xm-module-people org-board */
(function () {
  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function ensureCss() {
    const href = "/people.css?v=0.1.150-tabs";
    let link = document.querySelector('link[data-people-css="1"]') || document.querySelector('link[href*="people.css"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.setAttribute("data-people-css", "1");
    link.href = href;
  }

  function hideShellTab() {
    const tabs = document.querySelector(".xm-tabs");
    if (tabs) {
      tabs.dataset.peopleHid = "1";
      tabs.hidden = true;
      tabs.style.display = "none";
    }
    let css = document.getElementById("people-page-css");
    if (!css) {
      css = document.createElement("style");
      css.id = "people-page-css";
      document.head.appendChild(css);
    }
    css.textContent =
      "html:has(.people-page),body:has(.people-page){height:100%;}" +
      "body:has(.xm-shell):has(.people-page){overflow:hidden;}" +
      "body:has(.xm-shell):has(.people-page) .xm-shell,body:has(.xm-shell):has(.people-page) .xm-main{height:100vh;max-height:100vh;overflow:hidden;min-height:0;}" +
      "body:has(.people-page) .xm-content,#xm-content:has(.people-page){min-height:0;overflow:auto!important;}" +
      ".people-page .org-table-wrap{max-height:calc(100vh - 250px);overflow:auto;}";
  }

  function showShellTab() {
    const tabs = document.querySelector(".xm-tabs");
    if (tabs && tabs.dataset.peopleHid) {
      tabs.hidden = false;
      tabs.style.display = "";
      delete tabs.dataset.peopleHid;
    }
  }

  function tagClass(statusKey) {
    if (statusKey === "idle") {
      return "tag tag-idle";
    }
    if (statusKey === "closed") {
      return "tag tag-off";
    }
    return "tag tag-on";
  }

  window.XmModules = window.XmModules || {};
  window.XmModules["/people"] = {
    mount: function (root) {
      ensureCss();
      hideShellTab();
      root.innerHTML =
        '<main class="page people-page">' +
        '<header class="page-head"><h1>组织中心</h1>' +
        '<p class="lead">双击单元格即可改。罗成改全部；沈子晗只改沈子晗组；韩梦凯只改韩梦凯组。按责权显示。</p>' +
        '<p class="banner" id="org-scope">当前责权：—</p></header>' +
        '<nav class="org-tabs" id="org-tabs">' +
        '<button type="button" class="org-tab is-active" data-pane="stores">店铺主数据</button>' +
        '<button type="button" class="org-tab" data-pane="members">成员管理</button>' +
        '<button type="button" class="org-tab" data-pane="rights">责权</button>' +
        '<button type="button" class="org-tab" data-pane="acl">权限</button>' +
        '<button type="button" class="org-tab" data-pane="logs">改动日志</button>' +
        '<button type="button" class="org-tab" data-pane="board">龙虎榜</button>' +
        '<button type="button" class="org-tab" data-pane="values">价值观践行</button>' +
        '<button type="button" class="org-tab" data-pane="notices">日常公告</button>' +
        "</nav>" +
        '<div class="org-pane" data-pane="stores">' +
        '<div class="org-kpis" id="org-kpis"></div>' +
        '<div class="org-toolbar">' +
        '<input type="search" id="org-q" placeholder="商家ID / 店铺名 / 人员" />' +
        '<button type="button" id="org-search">搜索</button>' +
        '<select id="org-team"><option value="">全部团队</option></select>' +
        '<select id="org-status"><option value="">全部状态</option><option value="operating">在营</option><option value="idle">闲置</option><option value="closed">退店</option></select>' +
        '<span class="spacer" id="org-count"></span>' +
        '<button type="button" class="ghost" id="org-export">导出本筛</button>' +
        '<button type="button" id="org-add">+ 新增店铺</button>' +
        "</div>" +
        '<p class="status error" id="org-error" hidden></p>' +
        '<div class="org-table-wrap"><table><thead><tr>' +
        "<th>总负责人</th><th>小组负责人</th><th>店铺所属人员</th><th>店铺名称</th><th>商家id</th>" +
        "<th>店铺情况备注</th><th>更新时间</th><th>退店时间</th><th>登录主账号</th><th>密码</th><th>操作</th>" +
        '</tr></thead><tbody id="org-tbody"></tbody></table></div></div>' +
        '<div class="org-pane" data-pane="members" hidden>' +
        '<section class="panel"><h2>身份名册</h2>' +
        '<form class="people-form" id="people-form">' +
        '<label>姓名<input name="name" required maxlength="40" autocomplete="off" /></label>' +
        '<label>工号<input name="employeeNo" maxlength="32" /></label>' +
        '<label>部门<input name="department" maxlength="64" placeholder="如 沈子晗运营中心" /></label>' +
        '<label>上级<select name="managerId"><option value="">无</option></select></label>' +
        '<label>岗位<select name="role"><option>运营</option><option>主管</option><option>经理</option><option>店长</option></select></label>' +
        '<label>所属中心<select name="center" required><option value="">请选择</option>' +
        "<option>沈子晗运营中心</option><option>韩梦凯运营中心</option><option>数据中心</option>" +
        "<option>版本发布中心</option><option>个人中心</option><option>其他</option></select></label>" +
        "<label>状态<select name=\"status\"><option>在职</option><option>离职</option></select></label>" +
        '<button type="submit">新增人员</button></form>' +
        '<p class="status error" id="people-error" hidden></p>' +
        '<div class="org-table-wrap"><table><thead><tr><th>姓名</th><th>工号</th><th>部门</th><th>上级</th><th>岗位</th><th>所属中心</th><th>状态</th><th>能看见的店</th></tr></thead>' +
        '<tbody id="people-tbody"></tbody></table></div></section>' +
        '<section class="panel"><h2>店铺 / 店群</h2>' +
        '<form class="people-mini-form" id="shop-form">' +
        '<label>名称<input name="name" required maxlength="64" /></label>' +
        '<label>类型<select name="kind"><option>店铺</option><option>店群</option></select></label>' +
        '<label>所属包<input name="pack" maxlength="32" placeholder="沈子晗包" /></label>' +
        '<label>主管包<input name="bundle" maxlength="32" placeholder="杨润泽包，可空" /></label>' +
        '<button type="submit">新增店铺</button></form>' +
        '<p class="status error" id="shop-error" hidden></p>' +
        '<div class="org-table-wrap"><table><thead><tr><th>名称</th><th>类型</th><th>所属包</th><th>主管包</th></tr></thead>' +
        '<tbody id="shop-tbody"></tbody></table></div></section></div>' +
        '<div class="org-pane" data-pane="rights" hidden>' +
        '<section class="panel"><h2>管辖</h2>' +
        '<p class="lead">店权认管辖。一人多店多行。店铺主数据的「店铺所属人员」与此对齐。</p>' +
        '<form class="people-mini-form" id="grant-form">' +
        '<label>人员<select name="personId" required><option value="">请选择</option></select></label>' +
        '<label>店铺或店群<select name="shopId" required><option value="">请选择</option></select></label>' +
        '<label>角色<select name="role"><option>运营</option><option>主管</option><option>经理</option><option>店长</option></select></label>' +
        '<label>生效起<input name="startOn" type="date" /></label>' +
        '<label>生效止<input name="endOn" type="date" /></label>' +
        '<button type="submit">新增授权</button></form>' +
        '<p class="status error" id="grant-error" hidden></p>' +
        '<p class="people-check muted" id="check-employed">在职但没有店权：—</p>' +
        '<p class="people-check muted" id="check-left">店权还挂在离职人员：—</p>' +
        '<div class="org-table-wrap"><table><thead><tr><th>人</th><th>店 / 店群</th><th>角色</th><th>生效</th><th>状态</th></tr></thead>' +
        '<tbody id="rights-tbody"></tbody></table></div></section></div>' +
        '<div class="org-pane" data-pane="acl" hidden>' +
        '<section class="panel"><h2>权限</h2>' +
        "<p>店铺主数据按登录人责权：罗成可改全部，沈子晗只改沈子晗组，韩梦凯只改韩梦凯组。双击单元格保存。</p>" +
        "<p>智能体只读：GET /api/people、GET /api/people/org/stores、GET /api/people/grants。</p></section></div>" +
        '<div class="org-pane" data-pane="logs" hidden>' +
        '<section class="panel"><h2>改动日志</h2>' +
        '<div class="org-table-wrap"><table><thead><tr><th>时间</th><th>动作</th><th>摘要</th></tr></thead>' +
        '<tbody id="logs-tbody"></tbody></table></div></section></div>' +
        '<div class="org-pane" data-pane="board" hidden>' +
        '<section class="org-card"><div class="org-card-head"><div><h2>龙虎榜</h2>' +
        "<p>按在营店铺数排。罗成看全部，沈子晗/韩梦凯只看本团队。</p></div></div>" +
        '<div class="org-split">' +
        '<div class="org-table-wrap"><table><thead><tr><th>名次</th><th>店铺所属人员</th><th>在营</th><th>闲置</th><th>合计</th></tr></thead>' +
        '<tbody id="board-people"></tbody></table></div>' +
        '<div class="org-table-wrap"><table><thead><tr><th>名次</th><th>团队</th><th>店铺</th><th>人数</th></tr></thead>' +
        '<tbody id="board-teams"></tbody></table></div></div></section></div>' +
        '<div class="org-pane" data-pane="values" hidden>' +
        '<section class="org-card"><div class="org-card-head"><div><h2>价值观践行</h2>' +
        "<p>记录谁在践行哪一条，可新增。</p></div></div>" +
        '<form class="people-mini-form" id="value-form">' +
        '<label>人<input name="person" required maxlength="40" /></label>' +
        '<label>践行事项<input name="title" required maxlength="80" /></label>' +
        '<label>备注<input name="note" maxlength="80" /></label>' +
        '<label>状态<select name="status"><option>践行中</option><option>已完成</option></select></label>' +
        '<button type="submit">新增践行</button></form>' +
        '<p class="status error" id="value-error" hidden></p>' +
        '<div class="org-table-wrap"><table><thead><tr><th>人</th><th>事项</th><th>备注</th><th>状态</th></tr></thead>' +
        '<tbody id="value-tbody"></tbody></table></div></section></div>' +
        '<div class="org-pane" data-pane="notices" hidden>' +
        '<div class="org-kpis" id="notice-kpis"></div>' +
        '<section class="org-card"><div class="org-card-head"><div><h2>进行中的公告</h2>' +
        "<p>集中发布组织日常公告。登录后可看，首页栏可同步最新内容。</p></div>" +
        '<div class="org-card-actions">' +
        '<button type="button" class="ghost" id="notice-active">进行中</button>' +
        '<button type="button" class="ghost" id="notice-all">全部</button>' +
        '<button type="button" id="notice-add">+ 发布公告</button></div></div>' +
        '<p class="status error" id="notice-error" hidden></p>' +
        '<div id="notice-list"></div></section></div>' +
        '<div class="org-modal" id="notice-modal">' +
        '<form class="org-dialog" id="notice-form"><h3>发布日常公告</h3>' +
        '<div class="org-grid">' +
        '<label>标题<input name="title" required maxlength="80" /></label>' +
        '<label style="grid-column:1/-1">正文<textarea name="body" required rows="4"></textarea></label></div>' +
        '<p class="status error" id="notice-form-error" hidden></p>' +
        '<div class="org-actions" style="margin-top:12px">' +
        '<button type="submit">发布</button>' +
        '<button type="button" class="ghost" id="notice-cancel">取消</button></div></form></div>' +
        '<div class="org-modal" id="org-modal">' +
        '<form class="org-dialog" id="org-form"><h3 id="org-form-title">新增店铺</h3>' +
        '<div class="org-grid">' +
        '<label>总负责人<input name="chief" required /></label>' +
        '<label>小组负责人<input name="lead" required /></label>' +
        '<label>店铺所属人员<input name="owner" required /></label>' +
        '<label>店铺名称<input name="storeName" required /></label>' +
        '<label>商家id<input name="merchantId" /></label>' +
        '<label>店铺情况备注<select name="remark"><option>5倍在做</option><option>5倍闲置可退店</option><option>退店</option><option>已退店</option></select></label>' +
        '<label>更新时间<input name="updatedOn" placeholder="9.8更新" /></label>' +
        '<label>退店时间<input name="closedOn" /></label>' +
        '<label>登录主账号<input name="login" /></label>' +
        '<label>密码<input name="password" /></label>' +
        "</div>" +
        '<p class="status error" id="org-form-error" hidden></p>' +
        '<div class="org-actions" style="margin-top:12px">' +
        '<button type="submit">保存</button>' +
        '<button type="button" class="ghost" id="org-cancel">取消</button>' +
        "</div></form></div></main>";

      const kpis = root.querySelector("#org-kpis");
      const tbody = root.querySelector("#org-tbody");
      const teamSel = root.querySelector("#org-team");
      const statusSel = root.querySelector("#org-status");
      const qInput = root.querySelector("#org-q");
      const errorEl = root.querySelector("#org-error");
      const countEl = root.querySelector("#org-count");
      const modal = root.querySelector("#org-modal");
      const form = root.querySelector("#org-form");
      const formError = root.querySelector("#org-form-error");
      const peopleTbody = root.querySelector("#people-tbody");
      const shopTbody = root.querySelector("#shop-tbody");
      const peopleForm = root.querySelector("#people-form");
      const shopForm = root.querySelector("#shop-form");
      const grantForm = root.querySelector("#grant-form");
      const peopleError = root.querySelector("#people-error");
      const shopError = root.querySelector("#shop-error");
      const grantError = root.querySelector("#grant-error");
      const rightsTbody = root.querySelector("#rights-tbody");
      const logsTbody = root.querySelector("#logs-tbody");
      const boardPeople = root.querySelector("#board-people");
      const boardTeams = root.querySelector("#board-teams");
      const valueForm = root.querySelector("#value-form");
      const valueError = root.querySelector("#value-error");
      const valueTbody = root.querySelector("#value-tbody");
      const noticeKpis = root.querySelector("#notice-kpis");
      const noticeList = root.querySelector("#notice-list");
      const noticeError = root.querySelector("#notice-error");
      const noticeModal = root.querySelector("#notice-modal");
      const noticeForm = root.querySelector("#notice-form");
      const noticeFormError = root.querySelector("#notice-form-error");
      let noticeFilter = "active";
      let roster = { people: [], shops: [], grants: [] };
      let dead = false;
      let editingId = null;
      let lastStores = [];
      let boardMeta = { actor: "罗成", scope: "all", canCreate: true };
      const CELL_FIELDS = [
        { key: "chief", type: "text" },
        { key: "lead", type: "text" },
        { key: "owner", type: "text" },
        { key: "storeName", type: "text" },
        { key: "merchantId", type: "text" },
        { key: "remark", type: "select" },
        { key: "updatedOn", type: "text" },
        { key: "closedOn", type: "text" },
        { key: "login", type: "text" },
        { key: "password", type: "text" }
      ];
      const REMARKS = ["5倍在做", "5倍闲置可退店", "退店", "已退店"];

      function showError(el, message) {
        el.hidden = !message;
        el.textContent = message || "";
      }

      function switchPane(name) {
        root.querySelectorAll(".org-tab").forEach(function (tab) {
          tab.classList.toggle("is-active", tab.getAttribute("data-pane") === name);
        });
        root.querySelectorAll(".org-pane").forEach(function (pane) {
          pane.hidden = pane.getAttribute("data-pane") !== name;
        });
      }

      function query() {
        return {
          q: qInput.value.trim(),
          team: teamSel.value,
          status: statusSel.value
        };
      }

      function fillTeams(teams) {
        const current = teamSel.value;
        teamSel.innerHTML = '<option value="">全部团队</option>';
        (teams || []).forEach(function (team) {
          const option = document.createElement("option");
          option.value = team;
          option.textContent = team;
          teamSel.append(option);
        });
        teamSel.value = current;
      }

      function renderKpis(summary) {
        const items = [
          ["店铺总数", summary.total],
          ["正常运营", summary.operating],
          ["闲置", summary.idle],
          ["退店", summary.closed],
          ["缺商家ID", summary.missingMerchant],
          ["缺主账号", summary.missingLogin]
        ];
        kpis.innerHTML = items
          .map(function (item) {
            return (
              '<article class="org-kpi"><div class="label">' +
              escapeHtml(item[0]) +
              '</div><div class="value">' +
              escapeHtml(item[1]) +
              "</div></article>"
            );
          })
          .join("");
      }

      function displayCell(row, field) {
        const raw = row[field.key];
        if (field.key === "remark") {
          return '<span class="' + tagClass(row.statusKey) + '">' + escapeHtml(raw || "—") + "</span>";
        }
        if (field.key === "storeName") {
          return '<span class="org-link">' + escapeHtml(raw || "点击填写") + "</span>";
        }
        if (field.key === "owner") {
          return escapeHtml(raw || "点击填写") + (row.demo ? '<span class="demo-flag">演示</span>' : "");
        }
        return escapeHtml(raw || (field.key === "closedOn" || field.key === "updatedOn" ? "—" : "点击填写"));
      }

      function renderStores(stores) {
        lastStores = stores;
        tbody.replaceChildren();
        countEl.textContent = "筛选 " + stores.length + " 条";
        root.querySelector("#org-add").hidden = !boardMeta.canCreate;
        if (!stores.length) {
          tbody.innerHTML = '<tr><td colspan="11" class="org-empty">暂无店铺</td></tr>';
          return;
        }
        stores.forEach(function (row) {
          const tr = document.createElement("tr");
          tr.setAttribute("data-id", String(row.id));
          CELL_FIELDS.forEach(function (field) {
            const td = document.createElement("td");
            td.className = "org-cell" + (row.canEdit ? " can-edit" : "");
            td.setAttribute("data-field", field.key);
            td.setAttribute("title", row.canEdit ? "双击修改" : "无责权");
            td.innerHTML = displayCell(row, field);
            tr.append(td);
          });
          const actions = document.createElement("td");
          actions.className = "org-actions";
          if (row.canEdit) {
            actions.innerHTML =
              '<button type="button" class="ghost" data-edit="' +
              row.id +
              '">编辑</button><button type="button" class="danger" data-del="' +
              row.id +
              '">移除</button>';
          } else {
            actions.innerHTML = '<span class="org-locked">只读</span>';
          }
          tr.append(actions);
          tbody.append(tr);
        });
      }

      function openForm(row) {
        editingId = row ? row.id : null;
        root.querySelector("#org-form-title").textContent = row ? "编辑店铺" : "新增店铺";
        showError(formError, "");
        form.chief.value = row ? row.chief : "";
        form.lead.value = row ? row.lead : "";
        form.owner.value = row ? row.owner : "";
        form.storeName.value = row ? row.storeName : "";
        form.merchantId.value = row ? row.merchantId : "";
        form.remark.value = row ? row.remark : "5倍在做";
        form.updatedOn.value = row ? row.updatedOn : "";
        form.closedOn.value = row ? row.closedOn : "";
        form.login.value = row ? row.login : "";
        form.password.value = row ? row.password : "";
        modal.classList.add("show");
      }

      function closeForm() {
        modal.classList.remove("show");
        editingId = null;
      }

      function loadBoard() {
        const params = new URLSearchParams(query());
        return Promise.all([
          fetch("/api/people/org/summary", { credentials: "same-origin" }).then(function (res) {
            return res.json();
          }),
          fetch("/api/people/org/stores?" + params.toString(), { credentials: "same-origin" }).then(function (res) {
            return res.json();
          })
        ]).then(function (results) {
          if (dead) {
            return;
          }
          const summaryData = results[0];
          const storeData = results[1];
          if (!summaryData.ok || !storeData.ok) {
            throw new Error(storeData.error || summaryData.error || "无法加载店铺主数据");
          }
          boardMeta = {
            actor: storeData.actor || summaryData.actor || "罗成",
            scope: storeData.scope || "all",
            canCreate: storeData.canCreate !== false
          };
          const scopeEl = root.querySelector("#org-scope");
          if (scopeEl) {
            scopeEl.textContent =
              "当前：" +
              boardMeta.actor +
              " · " +
              (storeData.scopeLabel || "可改全部团队") +
              " · 双击单元格保存";
          }
          fillTeams(storeData.teams || summaryData.teams);
          renderKpis(summaryData.summary);
          renderStores(storeData.stores || []);
        });
      }

      function saveCell(id, field, value) {
        return fetch("/api/people/org/stores/" + id, {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value })
        }).then(function (res) {
          return res.json().then(function (data) {
            return { res: res, data: data };
          });
        }).then(function (result) {
          if (!result.res.ok || !result.data.ok) {
            throw new Error(result.data.error || "保存失败");
          }
          return loadBoard();
        });
      }

      function startCellEdit(td) {
        if (!td || td.querySelector("input,select") || !td.classList.contains("can-edit")) {
          return;
        }
        const id = td.parentElement && td.parentElement.getAttribute("data-id");
        const field = td.getAttribute("data-field");
        const row = lastStores.find(function (item) {
          return String(item.id) === String(id);
        });
        if (!id || !field || !row || !row.canEdit) {
          return;
        }
        const current = row[field] || "";
        if (field === "remark") {
          const select = document.createElement("select");
          REMARKS.forEach(function (item) {
            const option = document.createElement("option");
            option.value = item;
            option.textContent = item;
            if (item === current) {
              option.selected = true;
            }
            select.append(option);
          });
          td.textContent = "";
          td.append(select);
          select.focus();
          select.addEventListener("change", function () {
            saveCell(id, field, select.value).catch(function (err) {
              showError(errorEl, err.message);
              return loadBoard();
            });
          });
          select.addEventListener("blur", function () {
            if (select.value === current) {
              loadBoard();
            }
          });
          return;
        }
        const input = document.createElement("input");
        input.type = "text";
        input.value = current;
        td.textContent = "";
        td.append(input);
        input.focus();
        input.select();
        let saved = false;
        function commit() {
          if (saved) {
            return;
          }
          saved = true;
          const next = input.value.trim();
          if (next === String(current).trim()) {
            loadBoard();
            return;
          }
          saveCell(id, field, next).catch(function (err) {
            showError(errorEl, err.message);
            return loadBoard();
          });
        }
        input.addEventListener("keydown", function (event) {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
          if (event.key === "Escape") {
            saved = true;
            loadBoard();
          }
        });
        input.addEventListener("blur", commit);
      }

      function fillSelect(select, items, getValue, getLabel, emptyLabel) {
        if (!select) {
          return;
        }
        const current = select.value;
        select.innerHTML = emptyLabel ? '<option value="">' + escapeHtml(emptyLabel) + "</option>" : "";
        items.forEach(function (item) {
          const option = document.createElement("option");
          option.value = getValue(item);
          option.textContent = getLabel(item);
          select.append(option);
        });
        if ([].some.call(select.options, function (option) { return option.value === current; })) {
          select.value = current;
        }
      }

      function loadMembers() {
        return Promise.all([
          fetch("/api/people", { credentials: "same-origin" }).then(function (res) { return res.json(); }),
          fetch("/api/people/shops", { credentials: "same-origin" }).then(function (res) { return res.json(); })
        ]).then(function (results) {
          if (dead) {
            return;
          }
          const peopleData = results[0];
          const shopData = results[1];
          roster.people = peopleData.people || [];
          roster.shops = shopData.shops || [];
          peopleTbody.replaceChildren();
          roster.people.forEach(function (person) {
            const tr = document.createElement("tr");
            const shops = (person.visibleShops || []).join("、") || "—";
            tr.innerHTML =
              "<td>" +
              escapeHtml(person.name) +
              (person.demo ? '<span class="demo-flag">演示</span>' : "") +
              "</td><td>" +
              escapeHtml(person.employeeNo || "—") +
              "</td><td>" +
              escapeHtml(person.department || "—") +
              "</td><td>" +
              escapeHtml(person.managerName || "—") +
              "</td><td>" +
              escapeHtml(person.role) +
              "</td><td>" +
              escapeHtml(person.center) +
              '</td><td><select class="people-status" data-id="' +
              person.id +
              '"><option' +
              (person.status === "在职" ? " selected" : "") +
              ">在职</option><option" +
              (person.status === "离职" ? " selected" : "") +
              ">离职</option></select></td><td>" +
              escapeHtml(shops) +
              "</td>";
            peopleTbody.append(tr);
          });
          shopTbody.replaceChildren();
          roster.shops.forEach(function (shop) {
            const tr = document.createElement("tr");
            tr.innerHTML =
              "<td>" +
              escapeHtml(shop.name) +
              (shop.demo ? '<span class="demo-flag">演示</span>' : "") +
              "</td><td>" +
              escapeHtml(shop.kind) +
              "</td><td>" +
              escapeHtml(shop.pack || "—") +
              "</td><td>" +
              escapeHtml(shop.bundle || "—") +
              "</td>";
            shopTbody.append(tr);
          });
          fillSelect(
            peopleForm.managerId,
            roster.people,
            function (item) { return String(item.id); },
            function (item) { return item.name; },
            "无"
          );
        });
      }

      function loadRights() {
        return Promise.all([
          fetch("/api/people/grants", { credentials: "same-origin" }).then(function (res) { return res.json(); }),
          fetch("/api/people/reconcile", { credentials: "same-origin" }).then(function (res) { return res.json(); }),
          fetch("/api/people", { credentials: "same-origin" }).then(function (res) { return res.json(); }),
          fetch("/api/people/shops", { credentials: "same-origin" }).then(function (res) { return res.json(); })
        ]).then(function (results) {
          if (dead) {
            return;
          }
          const grantData = results[0];
          const checkData = results[1];
          roster.people = results[2].people || roster.people;
          roster.shops = results[3].shops || roster.shops;
          rightsTbody.replaceChildren();
          (grantData.grants || []).forEach(function (grant) {
            const tr = document.createElement("tr");
            const range = (grant.startOn || "") + (grant.endOn ? " ~ " + grant.endOn : " 起");
            tr.innerHTML =
              "<td>" +
              escapeHtml(grant.personName) +
              "</td><td>" +
              escapeHtml(grant.shopName) +
              "</td><td>" +
              escapeHtml(grant.role) +
              "</td><td>" +
              escapeHtml(range) +
              "</td><td>" +
              escapeHtml(grant.active ? "有效" : "已失效") +
              "</td>";
            rightsTbody.append(tr);
          });
          const employed = (checkData.employedNoGrant || []).map(function (item) { return item.name; });
          const left = (checkData.grantOnLeft || []).map(function (item) { return item.personName + " / " + item.shopName; });
          root.querySelector("#check-employed").textContent =
            "在职但没有店权：" + (employed.length ? employed.join("、") : "无");
          root.querySelector("#check-left").textContent =
            "店权还挂在离职人员：" + (left.length ? left.join("、") : "无");
          fillSelect(
            grantForm.personId,
            roster.people,
            function (item) { return String(item.id); },
            function (item) { return item.name; },
            "请选择"
          );
          fillSelect(
            grantForm.shopId,
            roster.shops,
            function (item) { return String(item.id); },
            function (item) { return item.name + "（" + item.kind + "）"; },
            "请选择"
          );
        });
      }

      function loadLogs() {
        return fetch("/api/people/org/logs", { credentials: "same-origin" })
          .then(function (res) {
            return res.json();
          })
          .then(function (data) {
            if (dead) {
              return;
            }
            logsTbody.replaceChildren();
            (data.logs || []).forEach(function (row) {
              const tr = document.createElement("tr");
              tr.innerHTML =
                "<td>" +
                escapeHtml(row.at) +
                "</td><td>" +
                escapeHtml(row.action) +
                "</td><td>" +
                escapeHtml(row.detail) +
                "</td>";
              logsTbody.append(tr);
            });
          });
      }

      function loadBoardRank() {
        return fetch("/api/people/org/board", { credentials: "same-origin" })
          .then(function (res) { return res.json(); })
          .then(function (data) {
            if (dead) {
              return;
            }
            boardPeople.replaceChildren();
            (data.people || []).forEach(function (row) {
              const tr = document.createElement("tr");
              tr.innerHTML =
                "<td>" +
                escapeHtml(row.rank) +
                "</td><td>" +
                escapeHtml(row.name) +
                "</td><td>" +
                escapeHtml(row.operating) +
                "</td><td>" +
                escapeHtml(row.idle) +
                "</td><td>" +
                escapeHtml(row.stores) +
                "</td>";
              boardPeople.append(tr);
            });
            boardTeams.replaceChildren();
            (data.teams || []).forEach(function (row) {
              const tr = document.createElement("tr");
              tr.innerHTML =
                "<td>" +
                escapeHtml(row.rank) +
                "</td><td>" +
                escapeHtml(row.name) +
                "</td><td>" +
                escapeHtml(row.stores) +
                "</td><td>" +
                escapeHtml(row.people) +
                "</td>";
              boardTeams.append(tr);
            });
          });
      }

      function loadValues() {
        return fetch("/api/people/org/values", { credentials: "same-origin" })
          .then(function (res) { return res.json(); })
          .then(function (data) {
            if (dead) {
              return;
            }
            valueTbody.replaceChildren();
            (data.items || []).forEach(function (row) {
              const tr = document.createElement("tr");
              tr.innerHTML =
                "<td>" +
                escapeHtml(row.person) +
                "</td><td>" +
                escapeHtml(row.title) +
                "</td><td>" +
                escapeHtml(row.note || "—") +
                "</td><td>" +
                escapeHtml(row.status) +
                "</td>";
              valueTbody.append(tr);
            });
          });
      }

      function loadNotices() {
        const q = noticeFilter === "active" ? "?status=active" : "";
        return fetch("/api/people/org/notices" + q, { credentials: "same-origin" })
          .then(function (res) { return res.json(); })
          .then(function (data) {
            if (dead) {
              return;
            }
            const stats = data.stats || { active: 0, total: 0 };
            noticeKpis.innerHTML = [
              ["进行中", stats.active],
              ["全部", stats.total],
              ["本周未读", 0]
            ]
              .map(function (item) {
                return (
                  '<article class="org-kpi"><div class="label">' +
                  escapeHtml(item[0]) +
                  '</div><div class="value">' +
                  escapeHtml(item[1]) +
                  "</div></article>"
                );
              })
              .join("");
            const items = data.items || [];
            if (!items.length) {
              noticeList.innerHTML = '<p class="org-empty">这一档还没有公告，点右上角发布。</p>';
              return;
            }
            noticeList.innerHTML = items
              .map(function (row) {
                return (
                  '<article class="notice-item"><h3>' +
                  escapeHtml(row.title) +
                  "</h3><p>" +
                  escapeHtml(row.body) +
                  '</p><p class="muted">' +
                  escapeHtml(row.author || "") +
                  " · " +
                  escapeHtml(row.at || "") +
                  "</p></article>"
                );
              })
              .join("");
          });
      }

      root.querySelector("#org-tabs").addEventListener("click", function (event) {
        const tab = event.target.closest(".org-tab");
        if (!tab) {
          return;
        }
        const pane = tab.getAttribute("data-pane");
        switchPane(pane);
        if (pane === "members") {
          loadMembers();
        }
        if (pane === "rights") {
          loadRights();
        }
        if (pane === "logs") {
          loadLogs();
        }
        if (pane === "board") {
          loadBoardRank();
        }
        if (pane === "values") {
          loadValues();
        }
        if (pane === "notices") {
          loadNotices();
        }
      });

      root.querySelector("#org-search").addEventListener("click", function () {
        loadBoard().catch(function (err) {
          showError(errorEl, err.message);
        });
      });
      teamSel.addEventListener("change", function () {
        loadBoard().catch(function (err) {
          showError(errorEl, err.message);
        });
      });
      statusSel.addEventListener("change", function () {
        loadBoard().catch(function (err) {
          showError(errorEl, err.message);
        });
      });
      root.querySelector("#org-add").addEventListener("click", function () {
        openForm(null);
      });
      root.querySelector("#org-cancel").addEventListener("click", closeForm);
      modal.addEventListener("click", function (event) {
        if (event.target === modal) {
          closeForm();
        }
      });
      tbody.addEventListener("dblclick", function (event) {
        startCellEdit(event.target.closest("td.org-cell"));
      });
      tbody.addEventListener("click", function (event) {
        const editId = event.target.getAttribute("data-edit");
        const delId = event.target.getAttribute("data-del");
        if (editId) {
          const row = lastStores.find(function (item) {
            return String(item.id) === String(editId);
          });
          openForm(row || null);
        }
        if (delId && window.confirm("确认移除该店铺行？")) {
          fetch("/api/people/org/stores/" + delId, {
            method: "DELETE",
            credentials: "same-origin"
          })
            .then(function (res) {
              return res.json();
            })
            .then(function () {
              return loadBoard();
            })
            .catch(function (err) {
              showError(errorEl, err.message);
            });
        }
      });
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        showError(formError, "");
        const body = Object.fromEntries(new FormData(form).entries());
        const url = editingId ? "/api/people/org/stores/" + editingId : "/api/people/org/stores";
        fetch(url, {
          method: editingId ? "PATCH" : "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        })
          .then(function (res) {
            return res.json().then(function (data) {
              return { res: res, data: data };
            });
          })
          .then(function (result) {
            if (!result.res.ok || !result.data.ok) {
              showError(formError, result.data.error || "保存失败");
              return;
            }
            closeForm();
            return loadBoard();
          });
      });
      function postForm(form, url, errorEl, after) {
        form.addEventListener("submit", function (event) {
          event.preventDefault();
          showError(errorEl, "");
          fetch(url, {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(Object.fromEntries(new FormData(form).entries()))
          })
            .then(function (res) {
              return res.json().then(function (data) {
                return { res: res, data: data };
              });
            })
            .then(function (result) {
              if (!result.res.ok || !result.data.ok) {
                showError(errorEl, result.data.error || "保存失败");
                return;
              }
              form.reset();
              return after();
            });
        });
      }

      postForm(valueForm, "/api/people/org/values", valueError, loadValues);
      postForm(peopleForm, "/api/people", peopleError, loadMembers);
      postForm(shopForm, "/api/people/shops", shopError, loadMembers);
      postForm(grantForm, "/api/people/grants", grantError, loadRights);

      root.querySelector("#notice-add").addEventListener("click", function () {
        showError(noticeFormError, "");
        noticeForm.reset();
        noticeModal.classList.add("show");
      });
      root.querySelector("#notice-cancel").addEventListener("click", function () {
        noticeModal.classList.remove("show");
      });
      noticeModal.addEventListener("click", function (event) {
        if (event.target === noticeModal) {
          noticeModal.classList.remove("show");
        }
      });
      root.querySelector("#notice-active").addEventListener("click", function () {
        noticeFilter = "active";
        loadNotices();
      });
      root.querySelector("#notice-all").addEventListener("click", function () {
        noticeFilter = "all";
        loadNotices();
      });
      noticeForm.addEventListener("submit", function (event) {
        event.preventDefault();
        showError(noticeFormError, "");
        fetch("/api/people/org/notices", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(Object.fromEntries(new FormData(noticeForm).entries()))
        })
          .then(function (res) {
            return res.json().then(function (data) {
              return { res: res, data: data };
            });
          })
          .then(function (result) {
            if (!result.res.ok || !result.data.ok) {
              showError(noticeFormError, result.data.error || "发布失败");
              return;
            }
            noticeModal.classList.remove("show");
            noticeForm.reset();
            return loadNotices();
          });
      });

      peopleTbody.addEventListener("change", function (event) {
        const select = event.target.closest("select[data-id]");
        if (!select) {
          return;
        }
        fetch("/api/people/" + select.getAttribute("data-id"), {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: select.value })
        }).then(function () {
          return loadMembers();
        });
      });
      root.querySelector("#org-export").addEventListener("click", function () {
        const header = [
          "总负责人",
          "小组负责人",
          "店铺所属人员",
          "店铺名称",
          "商家id",
          "店铺情况备注",
          "更新时间",
          "退店时间",
          "登录主账号",
          "密码"
        ];
        const lines = [header.join(",")].concat(
          lastStores.map(function (row) {
            return [
              row.chief,
              row.lead,
              row.owner,
              row.storeName,
              row.merchantId,
              row.remark,
              row.updatedOn,
              row.closedOn,
              row.login,
              row.password
            ]
              .map(function (cell) {
                return '"' + String(cell || "").replaceAll('"', '""') + '"';
              })
              .join(",");
          })
        );
        const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "组织中心-店铺主数据.csv";
        a.click();
      });

      loadBoard().catch(function (err) {
        showError(errorEl, err.message);
      });

      return function unmount() {
        dead = true;
        showShellTab();
        root.innerHTML = "";
      };
    }
  };
})();
