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
    const href = "/people.css?v=0.1.169-rights-tree";
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
      "body:has(.xm-shell):has(.people-page) .xm-shell{height:100vh;max-height:100vh;overflow:hidden;min-height:0;}" +
      "body:has(.xm-shell):has(.people-page) .xm-main{height:100vh;max-height:100vh;overflow-x:hidden!important;overflow-y:auto!important;min-height:0;display:flex;flex-direction:column;}" +
      "body:has(.people-page) .xm-content,#xm-content:has(.people-page){flex:0 0 auto;height:auto;overflow:visible!important;}" +
      ".people-page{overflow:visible;padding-bottom:24px;}" +
      ".people-page .org-table-wrap{overflow:auto!important;max-height:min(70vh,calc(100vh - 240px));}" +
      ".people-page table{border-collapse:separate;border-spacing:0;}" +
      ".people-page th{position:sticky;top:0;z-index:4;background:#fafafa;}";
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
    if (statusKey === "closing") {
      return "tag tag-warn";
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
      function onPeopleWheel(event) {
        if (event.defaultPrevented || event.ctrlKey) {
          return;
        }
        if (event.target.closest && event.target.closest(".org-filter-pop, input, select, textarea")) {
          return;
        }
        const main = document.querySelector(".xm-main");
        if (!main) {
          return;
        }
        const before = main.scrollTop;
        main.scrollTop += event.deltaY;
        if (main.scrollTop !== before) {
          event.preventDefault();
        }
      }
      document.addEventListener("wheel", onPeopleWheel, { passive: false, capture: true });
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
        "</nav>" +
        '<div class="org-pane" data-pane="stores">' +
        '<div class="org-kpis" id="org-kpis"></div>' +
        '<div class="org-toolbar">' +
        '<input type="search" id="org-q" placeholder="店铺ID / 商家ID / 店铺名 / 人员" />' +
        '<button type="button" id="org-search">搜索</button>' +
        '<span class="spacer" id="org-count"></span>' +
        '<button type="button" class="ghost" id="org-template">下载模板</button>' +
        '<button type="button" class="ghost" id="org-import">导入</button>' +
        '<input type="file" id="org-import-file" accept=".csv,text/csv" hidden />' +
        '<button type="button" class="ghost" id="org-export">导出本筛</button>' +
        '<button type="button" id="org-add">+ 新增店铺</button>' +
        "</div>" +
        '<p class="status error" id="org-error" hidden></p>' +
        '<div class="org-table-wrap"><table><thead><tr>' +
        '<th class="org-check"><input type="checkbox" id="org-check-all" title="全选本筛" /></th>' +
        '<th class="org-th-filter"><button type="button" class="org-filter-btn" data-filter-key="chief"><span class="org-filter-name">总负责人</span><span class="org-filter-caret">▾</span></button></th>' +
        '<th class="org-th-filter"><button type="button" class="org-filter-btn" data-filter-key="lead"><span class="org-filter-name">小组负责人</span><span class="org-filter-caret">▾</span></button></th>' +
        '<th class="org-th-filter"><button type="button" class="org-filter-btn" data-filter-key="owner"><span class="org-filter-name">店铺所属人员</span><span class="org-filter-caret">▾</span></button></th>' +
        '<th class="org-th-filter"><button type="button" class="org-filter-btn" data-filter-key="storeName"><span class="org-filter-name">店铺名称</span><span class="org-filter-caret">▾</span></button></th>' +
        "<th>店铺ID</th>" +
        "<th>商家id</th>" +
        '<th class="org-th-filter"><button type="button" class="org-filter-btn" data-filter-key="remark"><span class="org-filter-name">店铺情况备注</span><span class="org-filter-caret">▾</span></button></th>' +
        "<th>更新时间</th><th>退店时间</th><th>登录主账号</th><th>密码</th><th>操作</th>" +
        '</tr></thead><tbody id="org-tbody"></tbody></table></div>' +
        '<div class="org-filter-pop" id="org-filter-pop" hidden></div></div>' +
        '<div class="org-pane" data-pane="members" hidden>' +
        '<section class="panel"><h2>身份名册</h2>' +
        '<p class="lead">表头可筛部门、上级、岗位、所属中心、状态。勾选后可统一改密码或删除。点新增人员弹出对话框。</p>' +
        '<div class="org-toolbar">' +
        '<input type="search" id="people-q" placeholder="姓名 / 账号 / 部门" />' +
        '<button type="button" id="people-search">搜索</button>' +
        '<span class="spacer" id="people-count"></span>' +
        '<button type="button" class="ghost" id="people-template">下载模板</button>' +
        '<button type="button" class="ghost" id="people-import">导入</button>' +
        '<input type="file" id="people-import-file" accept=".csv,text/csv" hidden />' +
        '<button type="button" class="ghost" id="people-export">导出本筛</button>' +
        '<button type="button" id="people-add">+ 新增人员</button></div>' +
        '<p class="status error" id="people-error" hidden></p>' +
        '<div class="people-bulk" id="people-bulk" hidden>' +
        '<label class="people-bulk-check"><input type="checkbox" id="people-bulk-all" />全选</label>' +
        '<span id="people-bulk-count">已选 0 人</span>' +
        '<label>统一密码<input id="people-bulk-password" maxlength="64" placeholder="给勾中的人一起改" autocomplete="off" /></label>' +
        '<button type="button" id="people-bulk-apply">应用密码</button>' +
        '<button type="button" class="danger" id="people-bulk-remove">删除</button></div>' +
        '<div class="org-table-wrap"><table><thead><tr>' +
        '<th class="org-check"><input type="checkbox" id="people-check-all" title="全选" /></th>' +
        '<th>姓名</th>' +
        '<th class="org-th-filter"><button type="button" class="org-filter-btn" data-filter-key="department"><span class="org-filter-name">部门</span><span class="org-filter-caret">▾</span></button></th>' +
        '<th class="org-th-filter"><button type="button" class="org-filter-btn" data-filter-key="managerName"><span class="org-filter-name">上级</span><span class="org-filter-caret">▾</span></button></th>' +
        '<th class="org-th-filter"><button type="button" class="org-filter-btn" data-filter-key="role"><span class="org-filter-name">岗位</span><span class="org-filter-caret">▾</span></button></th>' +
        '<th class="org-th-filter"><button type="button" class="org-filter-btn" data-filter-key="center"><span class="org-filter-name">所属中心</span><span class="org-filter-caret">▾</span></button></th>' +
        '<th class="org-th-filter"><button type="button" class="org-filter-btn" data-filter-key="status"><span class="org-filter-name">状态</span><span class="org-filter-caret">▾</span></button></th>' +
        '<th>账号</th><th>登录密码</th></tr></thead>' +
        '<tbody id="people-tbody"></tbody></table></div>' +
        '<div class="org-filter-pop" id="people-filter-pop" hidden></div></section></div>' +
        '<div class="org-pane" data-pane="rights" hidden>' +
        '<section class="panel"><h2>管辖</h2>' +
        '<p class="lead">树按花名册上级和店铺主数据归属来画：总监罗成，下面经理韩梦凯、沈子晗，再往下主管、运营、助理和店铺。点刷新重新读成员管理和店铺主数据。人员对不上或店铺对不上会在看板里列出来。</p>' +
        '<div class="rights-watch" id="rights-watch"></div>' +
        '<div class="rights-tree-toolbar"><button type="button" id="rights-refresh">刷新树和看板</button><span class="muted" id="rights-checked">检查时间：—</span></div>' +
        '<div class="rights-tree-chart" id="rights-tree-chart"></div>' +
        '<div class="rights-board" id="rights-board"></div>' +
        '<div class="rights-pin-pop" id="rights-pin-pop" hidden></div>' +
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
        '<div class="org-modal" id="org-modal">' +
        '<form class="org-dialog" id="org-form"><h3 id="org-form-title">新增店铺</h3>' +
        '<div class="org-grid">' +
        '<label>总负责人<input name="chief" required /></label>' +
        '<label>小组负责人<input name="lead" required /></label>' +
        '<label>店铺所属人员<input name="owner" required /></label>' +
        '<label>店铺名称<input name="storeName" required /></label>' +
        '<label>店铺ID<input name="storeId" /></label>' +
        '<label>商家id<input name="merchantId" /></label>' +
        '<label>店铺情况备注<select name="remark"><option>运营中</option><option>闲置中</option><option>退店中</option><option>已退店</option></select></label>' +
        '<label>更新时间<input name="updatedOn" placeholder="9.8更新" /></label>' +
        '<label>退店时间<input name="closedOn" /></label>' +
        '<label>登录主账号<input name="login" /></label>' +
        '<label>密码<input name="password" /></label>' +
        "</div>" +
        '<p class="status error" id="org-form-error" hidden></p>' +
        '<div class="org-actions" style="margin-top:12px">' +
        '<button type="submit">保存</button>' +
        '<button type="button" class="ghost" id="org-cancel">取消</button>' +
        "</div></form></div>" +
        '<div class="org-modal" id="people-modal">' +
        '<form class="org-dialog people-form" id="people-form"><h3>新增人员</h3>' +
        '<div class="org-grid">' +
        '<label>姓名<input name="name" required maxlength="40" autocomplete="off" /></label>' +
        '<label>部门<input name="department" maxlength="64" placeholder="如 沈子晗运营中心" /></label>' +
        '<label>上级<select name="managerId"><option value="">无</option></select></label>' +
        '<label>岗位<select name="role"><option>运营</option><option>主管</option><option>经理</option><option>店长</option></select></label>' +
        '<label>所属中心<select name="center" required><option value="">请选择</option>' +
        "<option>沈子晗运营中心</option><option>韩梦凯运营中心</option><option>数据中心</option>" +
        "<option>版本发布中心</option><option>个人中心</option><option>其他</option></select></label>" +
        "<label>状态<select name=\"status\"><option>在职</option><option>离职</option></select></label>" +
        '<label>账号<input name="username" maxlength="40" placeholder="与姓名相同" /></label>' +
        '<label>登录密码<input name="password" maxlength="64" value="ChangeMe123!" placeholder="初始密码" /></label>' +
        "</div>" +
        '<p class="status error" id="people-form-error" hidden></p>' +
        '<div class="org-actions" style="margin-top:12px">' +
        '<button type="submit">保存</button>' +
        '<button type="button" class="ghost" id="people-cancel">取消</button>' +
        "</div></form></div></main>";

      const kpis = root.querySelector("#org-kpis");
      const tbody = root.querySelector("#org-tbody");
      const qInput = root.querySelector("#org-q");
      const errorEl = root.querySelector("#org-error");
      const countEl = root.querySelector("#org-count");
      const modal = root.querySelector("#org-modal");
      const form = root.querySelector("#org-form");
      const formError = root.querySelector("#org-form-error");
      const peopleTbody = root.querySelector("#people-tbody");
      const peopleForm = root.querySelector("#people-form");
      const peopleModal = root.querySelector("#people-modal");
      const peopleFormError = root.querySelector("#people-form-error");
      const PEOPLE_HEADERS = ["姓名", "部门", "上级", "岗位", "所属中心", "状态", "账号", "登录密码"];
      const PEOPLE_KEYS = ["name", "department", "managerName", "role", "center", "status", "username", "password"];
      if (peopleForm && peopleForm.name && peopleForm.username) {
        peopleForm.name.addEventListener("input", function () {
          peopleForm.username.value = peopleForm.name.value.trim();
        });
      }
      function openPeopleForm() {
        if (peopleForm) {
          peopleForm.reset();
          if (peopleForm.password) {
            peopleForm.password.value = "ChangeMe123!";
          }
        }
        showError(peopleFormError, "");
        fillSelect(
          peopleForm.managerId,
          roster.people,
          function (item) { return String(item.id); },
          function (item) { return item.name; },
          "无"
        );
        peopleModal.classList.add("show");
      }
      function closePeopleForm() {
        peopleModal.classList.remove("show");
      }
      const grantForm = root.querySelector("#grant-form");
      const peopleError = root.querySelector("#people-error");
      const grantError = root.querySelector("#grant-error");
      const rightsTbody = root.querySelector("#rights-tbody");
      const logsTbody = root.querySelector("#logs-tbody");
      let roster = { people: [], shops: [], grants: [] };
      let dead = false;
      let editingId = null;
      let lastStores = [];
      let rawStores = [];
      let selectedIds = {};
      let memberSelectedIds = {};
      const COLUMN_FILTERS = ["chief", "lead", "owner", "storeName", "remark"];
      const MEMBER_FILTERS = ["department", "managerName", "role", "center", "status"];
      const columnPicked = {};
      COLUMN_FILTERS.concat(MEMBER_FILTERS).forEach(function (key) {
        columnPicked[key] = null;
      });
      const filterPop = root.querySelector("#org-filter-pop");
      const peopleFilterPop = root.querySelector("#people-filter-pop");
      [filterPop, peopleFilterPop].forEach(function (pop) {
        if (pop) {
          document.body.appendChild(pop);
        }
      });
      let lastPeople = [];
      let openFilterBtn = null;
      let openFilterKey = "";
      let boardMeta = { actor: "罗成", scope: "all", canCreate: true };
      const CELL_FIELDS = [
        { key: "chief", type: "text" },
        { key: "lead", type: "text" },
        { key: "owner", type: "text" },
        { key: "storeName", type: "text" },
        { key: "storeId", type: "text" },
        { key: "merchantId", type: "text" },
        { key: "remark", type: "select" },
        { key: "updatedOn", type: "text" },
        { key: "closedOn", type: "text" },
        { key: "login", type: "text" },
        { key: "password", type: "text" }
      ];
      const REMARKS = ["运营中", "闲置中", "退店中", "已退店"];
      const STORE_HEADERS = [
        "总负责人",
        "小组负责人",
        "店铺所属人员",
        "店铺名称",
        "店铺ID",
        "商家id",
        "店铺情况备注",
        "更新时间",
        "退店时间",
        "登录主账号",
        "密码"
      ];
      const STORE_KEYS = [
        "chief",
        "lead",
        "owner",
        "storeName",
        "storeId",
        "merchantId",
        "remark",
        "updatedOn",
        "closedOn",
        "login",
        "password"
      ];

      function csvEscape(value) {
        return '"' + String(value == null ? "" : value).replaceAll('"', '""') + '"';
      }

      function downloadCsv(filename, lines) {
        const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
      }

      function parseCsv(text) {
        const rows = [];
        let row = [];
        let cell = "";
        let quoted = false;
        const source = String(text || "").replace(/^\uFEFF/, "");
        for (let i = 0; i < source.length; i += 1) {
          const ch = source[i];
          if (quoted) {
            if (ch === '"' && source[i + 1] === '"') {
              cell += '"';
              i += 1;
            } else if (ch === '"') {
              quoted = false;
            } else {
              cell += ch;
            }
            continue;
          }
          if (ch === '"') {
            quoted = true;
          } else if (ch === ",") {
            row.push(cell);
            cell = "";
          } else if (ch === "\n") {
            row.push(cell);
            rows.push(row);
            row = [];
            cell = "";
          } else if (ch !== "\r") {
            cell += ch;
          }
        }
        if (cell || row.length) {
          row.push(cell);
          rows.push(row);
        }
        return rows.filter(function (item) {
          return item.some(function (value) {
            return String(value || "").trim();
          });
        });
      }

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
          q: qInput.value.trim()
        };
      }

      function renderKpis(summary) {
        const items = [
          ["店铺总数", summary.total],
          ["运营中", summary.operating],
          ["闲置中", summary.idle],
          ["退店中", summary.closing],
          ["已退店", summary.closed],
          ["缺店铺ID", summary.missingStoreId],
          ["缺商家ID", summary.missingMerchant],
          ["缺主账号", summary.missingLogin],
          ["缺密码", summary.missingPassword],
          ["缺所属人员", summary.missingOwner]
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
          return escapeHtml(raw || "点击填写");
        }
        return escapeHtml(raw || (field.key === "closedOn" || field.key === "updatedOn" ? "—" : "点击填写"));
      }

      function cellFilterValue(row, key) {
        return String(row[key] || "").trim() || "（空）";
      }

      function personFilterValue(person, key) {
        if (key === "managerName") {
          return String(person.managerName || "").trim() || "（空）";
        }
        return String(person[key] || "").trim() || "（空）";
      }

      function isMemberFilter(key) {
        return MEMBER_FILTERS.indexOf(key) >= 0;
      }

      function uniqueColumnValues(key) {
        const seen = {};
        const list = [];
        function add(value) {
          if (!seen[value]) {
            seen[value] = true;
            list.push(value);
          }
        }
        if (isMemberFilter(key)) {
          if (key === "status") {
            ["在职", "离职"].forEach(add);
          }
          roster.people.forEach(function (row) {
            add(personFilterValue(row, key));
          });
          if (key !== "status") {
            list.sort(function (a, b) {
              return a.localeCompare(b, "zh");
            });
          }
          return list;
        }
        if (key === "remark") {
          REMARKS.forEach(add);
        }
        rawStores.forEach(function (row) {
          add(cellFilterValue(row, key));
        });
        if (key !== "remark") {
          list.sort(function (a, b) {
            return a.localeCompare(b, "zh");
          });
        }
        return list;
      }

      function isColumnFiltered(key) {
        const picked = columnPicked[key];
        const all = uniqueColumnValues(key);
        if (!picked) {
          return false;
        }
        return all.some(function (value) {
          return !picked[value];
        });
      }

      function applyColumnFilters(stores) {
        return stores.filter(function (row) {
          return COLUMN_FILTERS.every(function (key) {
            const picked = columnPicked[key];
            if (!picked) {
              return true;
            }
            return Boolean(picked[cellFilterValue(row, key)]);
          });
        });
      }

      function applyMemberFilters(people) {
        const q = String((root.querySelector("#people-q") || {}).value || "")
          .trim()
          .toLowerCase();
        return people.filter(function (row) {
          const passColumns = MEMBER_FILTERS.every(function (key) {
            const picked = columnPicked[key];
            if (!picked) {
              return true;
            }
            return Boolean(picked[personFilterValue(row, key)]);
          });
          if (!passColumns) {
            return false;
          }
          if (!q) {
            return true;
          }
          const blob = [
            row.name,
            row.username,
            row.department,
            row.role,
            row.center,
            row.managerName
          ]
            .join(" ")
            .toLowerCase();
          return blob.indexOf(q) >= 0;
        });
      }

      function paintFilterCarets() {
        root.querySelectorAll(".org-filter-btn").forEach(function (btn) {
          const key = btn.getAttribute("data-filter-key");
          btn.classList.toggle("is-on", isColumnFiltered(key));
        });
      }

      function filterPopFor(key) {
        return isMemberFilter(key) ? peopleFilterPop : filterPop;
      }

      function closeFilterPop() {
        openFilterKey = "";
        openFilterBtn = null;
        [filterPop, peopleFilterPop].forEach(function (pop) {
          if (pop) {
            pop.hidden = true;
            pop.innerHTML = "";
          }
        });
      }

      function placeFilterPop() {
        if (!openFilterKey || !openFilterBtn) {
          return;
        }
        const pop = filterPopFor(openFilterKey);
        if (!pop || pop.hidden) {
          return;
        }
        const rect = openFilterBtn.getBoundingClientRect();
        const width = pop.offsetWidth || 188;
        let left = rect.left;
        if (left + width > window.innerWidth - 8) {
          left = Math.max(8, window.innerWidth - width - 8);
        }
        pop.style.left = Math.max(8, left) + "px";
        pop.style.top = rect.bottom + 4 + "px";
      }

      function toggleFilterPop(key, btn) {
        if (openFilterKey === key) {
          closeFilterPop();
          return;
        }
        fillFilterPop(key, btn);
      }

      function fillFilterPop(key, btn) {
        const pop = filterPopFor(key);
        if (!pop) {
          return;
        }
        closeFilterPop();
        openFilterKey = key;
        const values = uniqueColumnValues(key);
        if (!columnPicked[key]) {
          columnPicked[key] = {};
        }
        values.forEach(function (value) {
          if (columnPicked[key][value] == null) {
            columnPicked[key][value] = true;
          }
        });
        const picked = columnPicked[key];
        const selected = values.filter(function (value) {
          return picked[value];
        }).length;
        pop.hidden = false;
        pop.innerHTML =
          '<label class="org-filter-item org-filter-all"><input type="checkbox" id="org-filter-all"' +
          (selected === values.length && values.length ? " checked" : "") +
          (selected > 0 && selected < values.length ? " data-mid=1" : "") +
          " />全选</label><div class=\"org-filter-list\">" +
          (values.length
            ? values
                .map(function (value) {
                  return (
                    '<label class="org-filter-item"><input type="checkbox" class="org-filter-value" data-value="' +
                    escapeHtml(value) +
                    '"' +
                    (picked[value] ? " checked" : "") +
                    " />" +
                    escapeHtml(value) +
                    "</label>"
                  );
                })
                .join("")
            : '<p class="org-empty">没有可筛选项</p>') +
          "</div>";
        const allBox = pop.querySelector("#org-filter-all");
        if (allBox && selected > 0 && selected < values.length) {
          allBox.indeterminate = true;
        }
        openFilterBtn = btn;
        placeFilterPop();
      }

      function selectedCount() {
        return lastStores.filter(function (row) {
          return selectedIds[String(row.id)];
        }).length;
      }

      function syncCheckAll() {
        const all = root.querySelector("#org-check-all");
        if (!all) {
          return;
        }
        const n = lastStores.length;
        const picked = selectedCount();
        all.checked = n > 0 && picked === n;
        all.indeterminate = picked > 0 && picked < n;
      }

      function renderStores(stores) {
        lastStores = stores;
        tbody.replaceChildren();
        countEl.textContent = "筛选 " + stores.length + " 条 · 已选 " + selectedCount() + " 条";
        root.querySelector("#org-add").hidden = !boardMeta.canCreate;
        if (!stores.length) {
          tbody.innerHTML = '<tr><td colspan="13" class="org-empty">暂无店铺</td></tr>';
          syncCheckAll();
          return;
        }
        stores.forEach(function (row) {
          const tr = document.createElement("tr");
          tr.setAttribute("data-id", String(row.id));
          const checkTd = document.createElement("td");
          checkTd.className = "org-check";
          const box = document.createElement("input");
          box.type = "checkbox";
          box.className = "org-row-check";
          box.setAttribute("data-check", String(row.id));
          box.checked = Boolean(selectedIds[String(row.id)]);
          checkTd.append(box);
          tr.append(checkTd);
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
        syncCheckAll();
      }

      function openForm(row) {
        editingId = row ? row.id : null;
        root.querySelector("#org-form-title").textContent = row ? "编辑店铺" : "新增店铺";
        showError(formError, "");
        form.chief.value = row ? row.chief : "";
        form.lead.value = row ? row.lead : "";
        form.owner.value = row ? row.owner : "";
        form.storeName.value = row ? row.storeName : "";
        form.storeId.value = row && row.storeId ? row.storeId : "";
        form.merchantId.value = row ? row.merchantId : "";
        form.remark.value = row ? row.remark : "运营中";
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
          renderKpis(summaryData.summary);
          rawStores = storeData.stores || [];
          renderStores(applyColumnFilters(rawStores));
          paintFilterCarets();
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

      function renderPeople(people) {
        lastPeople = people;
        peopleTbody.replaceChildren();
        people.forEach(function (person) {
          const tr = document.createElement("tr");
          tr.setAttribute("data-id", String(person.id));
          tr.innerHTML =
            '<td class="org-check"><input type="checkbox" class="people-row-check" data-check="' +
            person.id +
            '"' +
            (memberSelectedIds[String(person.id)] ? " checked" : "") +
            " /></td><td>" +
            escapeHtml(person.name) +
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
            ">离职</option></select></td>" +
            '<td class="people-cell can-edit" data-field="username" title="单击可改">' +
            escapeHtml(person.username || person.name || "—") +
            '</td><td class="people-cell can-edit" data-field="password" title="单击可改">' +
            escapeHtml(person.password || "ChangeMe123!") +
            "</td>";
          peopleTbody.append(tr);
        });
        paintMemberBar();
        paintFilterCarets();
        const peopleCount = root.querySelector("#people-count");
        if (peopleCount) {
          peopleCount.textContent = "筛选 " + people.length + " 人";
        }
      }

      function loadMembers() {
        return fetch("/api/people", { credentials: "same-origin" }).then(function (res) { return res.json(); }).then(function (peopleData) {
          if (dead) {
            return;
          }
          roster.people = peopleData.people || [];
          fillSelect(
            peopleForm.managerId,
            roster.people,
            function (item) { return String(item.id); },
            function (item) { return item.name; },
            "无"
          );
          renderPeople(applyMemberFilters(roster.people));
        });
      }

      const rightsPinPop = root.querySelector("#rights-pin-pop");
      let rightsPinRole = "";
      let rightsCandidates = [];

      function closeRightsPin() {
        if (rightsPinPop) {
          rightsPinPop.hidden = true;
          rightsPinPop.innerHTML = "";
        }
        rightsPinRole = "";
      }

      function pinRights(name, role) {
        return fetch("/api/people/org/rights-board/pin", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name, role: role })
        }).then(function (res) {
          return res.json();
        }).then(function () {
          closeRightsPin();
          return loadRights();
        });
      }

      function renderRightsWatch(watch) {
        const host = root.querySelector("#rights-watch");
        const checked = root.querySelector("#rights-checked");
        if (checked) {
          checked.textContent = "检查时间：" + ((watch && watch.checkedAt) || "—");
        }
        if (!host) {
          return;
        }
        const kpis = (watch && watch.kpis) || [];
        const issues = (watch && watch.issues) || [];
        host.innerHTML =
          '<div class="rights-watch-banner' +
          (watch && watch.conflict ? " is-conflict" : "") +
          '"><div>组织人员以花名册为准，店铺、店铺ID、商家id以店铺主数据为准。刷新只读这两边，不另开一套权。</div><strong>' +
          (watch && watch.conflict ? "存在冲突" : "暂无冲突") +
          "</strong></div>" +
          '<div class="rights-watch-kpis">' +
          kpis
            .map(function (item) {
              return (
                '<article class="rights-watch-kpi"><div class="label">' +
                escapeHtml(item.label) +
                '</div><div class="value">' +
                escapeHtml(item.value) +
                "</div></article>"
              );
            })
            .join("") +
          "</div>" +
          (issues.length
            ? '<ul class="rights-watch-issues">' +
              issues
                .map(function (item) {
                  return (
                    "<li data-kind=\"" +
                    escapeHtml(item.kind) +
                    '"><strong>' +
                    escapeHtml(item.kind) +
                    " · " +
                    escapeHtml(item.title) +
                    "</strong><span>" +
                    escapeHtml(item.detail) +
                    "</span></li>"
                  );
                })
                .join("") +
              "</ul>"
            : '<p class="rights-empty">人员和店铺都对得上。</p>');
      }

      function renderRightsNode(node) {
        if (!node) {
          return "";
        }
        const stores = (node.stores || [])
          .map(function (store) {
            return '<span class="rights-tree-store">' + escapeHtml(store.storeName) + "</span>";
          })
          .join("");
        return (
          '<div class="rights-tree-node" data-role="' +
          escapeHtml(node.role) +
          '"><div class="rights-tree-card"><em>' +
          escapeHtml(node.role) +
          "</em><strong>" +
          escapeHtml(node.name) +
          "</strong></div>" +
          (stores ? '<div class="rights-tree-stores">' + stores + "</div>" : "") +
          ((node.children || []).length
            ? '<div class="rights-tree-kids">' + node.children.map(renderRightsNode).join("") + "</div>"
            : "") +
          "</div>"
        );
      }

      function renderRightsTreeChart(tree) {
        const host = root.querySelector("#rights-tree-chart");
        if (!host) {
          return;
        }
        host.innerHTML = tree ? renderRightsNode(tree) : '<p class="rights-empty">还没有树。</p>';
      }

      function renderRightsBoard(board) {
        const host = root.querySelector("#rights-board");
        if (!host) {
          return;
        }
        rightsCandidates = board.candidates || [];
        const columns = board.columns || [];
        host.innerHTML = columns
          .map(function (col) {
            const people = col.people || [];
            const chips = people.length
              ? people
                  .map(function (person) {
                    return (
                      '<span class="rights-chip">' +
                      escapeHtml(person.name) +
                      '<button type="button" class="rights-chip-x" data-rights-unpin="' +
                      escapeHtml(person.name) +
                      '" aria-label="取消指定">×</button></span>'
                    );
                  })
                  .join("")
              : '<p class="rights-empty">还没有人。灯钉职位对不上就点「指定」。</p>';
            return (
              '<div class="rights-col" data-rights-role="' +
              escapeHtml(col.role) +
              '"><div class="rights-col-head"><div><strong>' +
              escapeHtml(col.role) +
              '</strong><span class="rights-col-count">' +
              people.length +
              "人</span></div>" +
              '<button type="button" class="rights-pin-btn" data-rights-pin="' +
              escapeHtml(col.role) +
              '">指定</button></div><div class="rights-chips">' +
              chips +
              "</div></div>"
            );
          })
          .join("");
      }

      function openRightsPin(role, btn) {
        if (!rightsPinPop) {
          return;
        }
        rightsPinRole = role;
        const taken = {};
        root.querySelectorAll(".rights-col").forEach(function (col) {
          if (col.getAttribute("data-rights-role") === role) {
            col.querySelectorAll(".rights-chip-x").forEach(function (chip) {
              taken[chip.getAttribute("data-rights-unpin")] = true;
            });
          }
        });
        const list = rightsCandidates.filter(function (item) {
          return !taken[item.name];
        });
        rightsPinPop.innerHTML =
          "<p>指定到「" +
          escapeHtml(role) +
          "」</p>" +
          '<input id="rights-pin-q" type="search" placeholder="搜姓名" autocomplete="off" />' +
          '<div class="rights-pin-list" id="rights-pin-list"></div>';
        function paintList() {
          const q = String(rightsPinPop.querySelector("#rights-pin-q").value || "").trim();
          const matched = list.filter(function (item) {
            return !q || item.name.indexOf(q) >= 0;
          });
          rightsPinPop.querySelector("#rights-pin-list").innerHTML = matched.length
            ? matched
                .map(function (item) {
                  return (
                    '<button type="button" class="rights-pin-item" data-rights-name="' +
                    escapeHtml(item.name) +
                    '">' +
                    escapeHtml(item.name) +
                    "<span>" +
                    escapeHtml(item.role) +
                    "</span></button>"
                  );
                })
                .join("")
            : '<p class="rights-empty">没有可指定的人</p>';
        }
        paintList();
        rightsPinPop.hidden = false;
        const rect = btn.getBoundingClientRect();
        rightsPinPop.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 280)) + "px";
        rightsPinPop.style.top = rect.bottom + 6 + "px";
        const input = rightsPinPop.querySelector("#rights-pin-q");
        input.addEventListener("input", paintList);
        input.focus();
      }

      function loadRights() {
        return Promise.all([
          fetch("/api/people/grants", { credentials: "same-origin" }).then(function (res) { return res.json(); }),
          fetch("/api/people/reconcile", { credentials: "same-origin" }).then(function (res) { return res.json(); }),
          fetch("/api/people", { credentials: "same-origin" }).then(function (res) { return res.json(); }),
          fetch("/api/people/shops", { credentials: "same-origin" }).then(function (res) { return res.json(); }),
          fetch("/api/people/org/rights-board", { credentials: "same-origin" }).then(function (res) { return res.json(); })
        ]).then(function (results) {
          if (dead) {
            return;
          }
          const grantData = results[0];
          const checkData = results[1];
          roster.people = results[2].people || roster.people;
          roster.shops = results[3].shops || roster.shops;
          const board = results[4] || { columns: [] };
          renderRightsWatch(board.watch || {});
          renderRightsTreeChart(board.tree);
          renderRightsBoard(board);
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

      root.querySelector("#rights-refresh").addEventListener("click", function () {
        loadRights();
      });
      root.querySelector("#rights-board").addEventListener("click", function (event) {
        const pinBtn = event.target.closest("[data-rights-pin]");
        if (pinBtn) {
          event.preventDefault();
          openRightsPin(pinBtn.getAttribute("data-rights-pin"), pinBtn);
          return;
        }
        const unpinBtn = event.target.closest("[data-rights-unpin]");
        if (unpinBtn) {
          event.preventDefault();
          fetch("/api/people/org/rights-board/unpin", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: unpinBtn.getAttribute("data-rights-unpin") })
          }).then(function (res) {
            return res.json();
          }).then(function () {
            closeRightsPin();
            return loadRights();
          });
        }
      });
      if (rightsPinPop) {
        rightsPinPop.addEventListener("click", function (event) {
          const item = event.target.closest("[data-rights-name]");
          if (!item || !rightsPinRole) {
            return;
          }
          pinRights(item.getAttribute("data-rights-name"), rightsPinRole);
        });
      }
      function onDocRightsPinClose(event) {
        if (dead) {
          document.removeEventListener("click", onDocRightsPinClose);
          return;
        }
        if (event.target.closest("#rights-pin-pop") || event.target.closest("[data-rights-pin]")) {
          return;
        }
        closeRightsPin();
      }
      document.addEventListener("click", onDocRightsPinClose);

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
      });

      root.querySelector("#org-tabs").parentElement.addEventListener("click", function (event) {
        const btn = event.target.closest(".org-filter-btn");
        if (btn && root.contains(btn)) {
          event.preventDefault();
          toggleFilterPop(btn.getAttribute("data-filter-key"), btn);
          return;
        }
        if (!event.target.closest("#org-filter-pop") && !event.target.closest("#people-filter-pop")) {
          closeFilterPop();
        }
      });
      function onDocFilterClose(event) {
        if (dead) {
          document.removeEventListener("click", onDocFilterClose);
          return;
        }
        if (
          !event.target.closest("#org-filter-pop") &&
          !event.target.closest("#people-filter-pop") &&
          !event.target.closest(".org-filter-btn")
        ) {
          closeFilterPop();
        }
      }
      document.addEventListener("click", onDocFilterClose);
      function onFilterPin() {
        if (dead) {
          return;
        }
        placeFilterPop();
      }
      window.addEventListener("scroll", onFilterPin, true);
      window.addEventListener("resize", onFilterPin);
      root.querySelectorAll(".org-table-wrap").forEach(function (wrap) {
        wrap.addEventListener("scroll", onFilterPin);
      });
      const mainPane = document.querySelector(".xm-main");
      if (mainPane) {
        mainPane.addEventListener("scroll", onFilterPin);
      }
      function onFilterChange(event) {
        const key = openFilterKey;
        if (!key) {
          return;
        }
        const values = uniqueColumnValues(key);
        if (!columnPicked[key]) {
          columnPicked[key] = {};
        }
        if (event.target.id === "org-filter-all") {
          const on = event.target.checked;
          values.forEach(function (value) {
            columnPicked[key][value] = on;
          });
        } else if (event.target.classList.contains("org-filter-value")) {
          columnPicked[key][event.target.getAttribute("data-value")] = event.target.checked;
        } else {
          return;
        }
        if (isMemberFilter(key)) {
          renderPeople(applyMemberFilters(roster.people));
        } else {
          renderStores(applyColumnFilters(rawStores));
        }
        paintFilterCarets();
        const btn = root.querySelector('.org-filter-btn[data-filter-key="' + key + '"]');
        if (btn) {
          fillFilterPop(key, btn);
        }
      }
      if (filterPop) {
        filterPop.addEventListener("change", onFilterChange);
      }
      if (peopleFilterPop) {
        peopleFilterPop.addEventListener("change", onFilterChange);
      }
      root.querySelector("#org-search").addEventListener("click", function () {
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
        if (event.target.closest(".org-check")) {
          return;
        }
        startCellEdit(event.target.closest("td.org-cell"));
      });
      function paintCount() {
        countEl.textContent = "筛选 " + lastStores.length + " 条 · 已选 " + selectedCount() + " 条";
        syncCheckAll();
      }
      root.querySelector("#org-check-all").addEventListener("change", function (event) {
        const on = event.target.checked;
        lastStores.forEach(function (row) {
          if (on) {
            selectedIds[String(row.id)] = true;
          } else {
            delete selectedIds[String(row.id)];
          }
        });
        tbody.querySelectorAll(".org-row-check").forEach(function (box) {
          box.checked = on;
        });
        paintCount();
      });
      tbody.addEventListener("click", function (event) {
        const box = event.target.closest(".org-row-check");
        if (box) {
          const id = box.getAttribute("data-check");
          if (box.checked) {
            selectedIds[id] = true;
          } else {
            delete selectedIds[id];
          }
          paintCount();
          return;
        }
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

      function memberSelectedCount() {
        return lastPeople.filter(function (person) {
          return memberSelectedIds[String(person.id)];
        }).length;
      }

      function paintMemberBar() {
        const bar = root.querySelector("#people-bulk");
        const count = memberSelectedCount();
        const header = root.querySelector("#people-check-all");
        const barAll = root.querySelector("#people-bulk-all");
        const countEl = root.querySelector("#people-bulk-count");
        if (bar) {
          bar.hidden = count === 0;
        }
        if (countEl) {
          countEl.textContent = "已选 " + count + " 人";
        }
        const allOn = lastPeople.length > 0 && count === lastPeople.length;
        if (header) {
          header.checked = allOn;
          header.indeterminate = count > 0 && !allOn;
        }
        if (barAll) {
          barAll.checked = allOn;
          barAll.indeterminate = count > 0 && !allOn;
        }
      }

      function setAllMembers(on) {
        lastPeople.forEach(function (person) {
          if (on) {
            memberSelectedIds[String(person.id)] = true;
          } else {
            delete memberSelectedIds[String(person.id)];
          }
        });
        peopleTbody.querySelectorAll(".people-row-check").forEach(function (box) {
          box.checked = on;
        });
        paintMemberBar();
      }

      postForm(grantForm, "/api/people/grants", grantError, loadRights);
      function rerenderPeople() {
        renderPeople(applyMemberFilters(roster.people));
      }
      root.querySelector("#people-search").addEventListener("click", rerenderPeople);
      root.querySelector("#people-q").addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          rerenderPeople();
        }
      });
      root.querySelector("#people-add").addEventListener("click", openPeopleForm);
      root.querySelector("#people-cancel").addEventListener("click", closePeopleForm);
      peopleModal.addEventListener("click", function (event) {
        if (event.target === peopleModal) {
          closePeopleForm();
        }
      });
      peopleForm.addEventListener("submit", function (event) {
        event.preventDefault();
        showError(peopleFormError, "");
        fetch("/api/people", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(Object.fromEntries(new FormData(peopleForm).entries()))
        })
          .then(function (res) {
            return res.json().then(function (data) {
              return { res: res, data: data };
            });
          })
          .then(function (result) {
            if (!result.res.ok || !result.data.ok) {
              showError(peopleFormError, result.data.error || "保存失败");
              return;
            }
            closePeopleForm();
            peopleForm.reset();
            return loadMembers();
          })
          .catch(function (err) {
            showError(peopleFormError, err.message);
          });
      });
      function peopleCsvLines(rows) {
        return [PEOPLE_HEADERS.map(csvEscape).join(",")].concat(
          rows.map(function (row) {
            return PEOPLE_KEYS.map(function (key) {
              return csvEscape(row[key]);
            }).join(",");
          })
        );
      }
      root.querySelector("#people-template").addEventListener("click", function () {
        downloadCsv(
          "组织中心-身份名册模板.csv",
          peopleCsvLines([
            {
              name: "示例同事",
              department: "沈子晗运营中心",
              managerName: "沈子晗",
              role: "运营",
              center: "沈子晗运营中心",
              status: "在职",
              username: "示例同事",
              password: "ChangeMe123!"
            }
          ])
        );
      });
      root.querySelector("#people-export").addEventListener("click", function () {
        downloadCsv("组织中心-身份名册.csv", peopleCsvLines(lastPeople));
      });
      root.querySelector("#people-import").addEventListener("click", function () {
        root.querySelector("#people-import-file").click();
      });
      root.querySelector("#people-import-file").addEventListener("change", function (event) {
        const file = event.target.files && event.target.files[0];
        event.target.value = "";
        if (!file) {
          return;
        }
        file
          .text()
          .then(function (text) {
            const table = parseCsv(text);
            if (table.length < 2) {
              throw new Error("模板至少要有表头和一行数据");
            }
            const headers = table[0].map(function (cell) {
              return String(cell || "").trim();
            });
            const missing = PEOPLE_HEADERS.filter(function (name) {
              return headers.indexOf(name) < 0;
            });
            if (missing.length) {
              throw new Error("表头需与表格一致，缺少：" + missing.join("、"));
            }
            const rows = table.slice(1).map(function (cells) {
              const item = {};
              headers.forEach(function (name, index) {
                item[name] = cells[index] || "";
              });
              return item;
            });
            return fetch("/api/people/import", {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ rows: rows })
            }).then(function (res) {
              return res.json().then(function (data) {
                return { res: res, data: data };
              });
            });
          })
          .then(function (result) {
            if (!result.res.ok || !result.data.ok) {
              throw new Error(result.data.error || "导入失败");
            }
            const failed = result.data.failed || [];
            showError(
              peopleError,
              failed.length
                ? "导入完成：新增" +
                    result.data.created +
                    "，更新" +
                    result.data.updated +
                    "。失败" +
                    failed.length +
                    "行"
                : ""
            );
            if (!failed.length) {
              window.alert("导入完成：新增" + result.data.created + "条，更新" + result.data.updated + "条。");
            }
            return loadMembers();
          })
          .catch(function (err) {
            showError(peopleError, err.message);
          });
      });

      function savePersonField(id, field, value) {
        return fetch("/api/people/" + id, {
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
          return loadMembers();
        });
      }

      function startPersonCellEdit(td) {
        if (!td || td.querySelector("input") || !td.classList.contains("can-edit")) {
          return;
        }
        const id = td.parentElement && td.parentElement.getAttribute("data-id");
        const field = td.getAttribute("data-field");
        const person = roster.people.find(function (item) {
          return String(item.id) === String(id);
        });
        if (!id || !field || !person) {
          return;
        }
        const current = field === "username"
          ? person.username || person.name || ""
          : person.password || "ChangeMe123!";
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
          if (!next || next === String(current).trim()) {
            loadMembers();
            return;
          }
          savePersonField(id, field, next).catch(function (err) {
            showError(peopleError, err.message);
            return loadMembers();
          });
        }
        input.addEventListener("keydown", function (event) {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
          if (event.key === "Escape") {
            saved = true;
            loadMembers();
          }
        });
        input.addEventListener("blur", commit);
      }

      peopleTbody.addEventListener("click", function (event) {
        if (event.target.closest("select, input, button")) {
          return;
        }
        startPersonCellEdit(event.target.closest("td.people-cell"));
      });
      peopleTbody.addEventListener("change", function (event) {
        const box = event.target.closest(".people-row-check");
        if (!box) {
          return;
        }
        const id = box.getAttribute("data-check");
        if (box.checked) {
          memberSelectedIds[id] = true;
        } else {
          delete memberSelectedIds[id];
        }
        paintMemberBar();
      });
      root.querySelector("#people-check-all").addEventListener("change", function (event) {
        setAllMembers(event.target.checked);
      });
      root.querySelector("#people-bulk-all").addEventListener("change", function (event) {
        setAllMembers(event.target.checked);
      });
      function selectedMemberIds() {
        return roster.people
          .filter(function (person) {
            return memberSelectedIds[String(person.id)];
          })
          .map(function (person) {
            return person.id;
          });
      }

      root.querySelector("#people-bulk-apply").addEventListener("click", function () {
        const password = root.querySelector("#people-bulk-password").value.trim();
        const ids = selectedMemberIds();
        if (!ids.length) {
          showError(peopleError, "请先勾选人员");
          return;
        }
        if (!password) {
          showError(peopleError, "请填写统一密码");
          return;
        }
        fetch("/api/people/passwords", {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: ids, password: password })
        })
          .then(function (res) {
            return res.json().then(function (data) {
              return { res: res, data: data };
            });
          })
          .then(function (result) {
            if (!result.res.ok || !result.data.ok) {
              throw new Error(result.data.error || "保存失败");
            }
            showError(peopleError, "");
            root.querySelector("#people-bulk-password").value = "";
            return loadMembers();
          })
          .catch(function (err) {
            showError(peopleError, err.message);
          });
      });
      root.querySelector("#people-bulk-remove").addEventListener("click", function () {
        const ids = selectedMemberIds();
        if (!ids.length) {
          showError(peopleError, "请先勾选人员");
          return;
        }
        if (!window.confirm("确定删除已选 " + ids.length + " 人？名册和店权会一起去掉。")) {
          return;
        }
        fetch("/api/people/remove", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: ids })
        })
          .then(function (res) {
            return res.json().then(function (data) {
              return { res: res, data: data };
            });
          })
          .then(function (result) {
            if (!result.res.ok || !result.data.ok) {
              throw new Error(result.data.error || "删除失败");
            }
            (result.data.people || []).forEach(function (person) {
              delete memberSelectedIds[String(person.id)];
            });
            showError(peopleError, "");
            return loadMembers();
          })
          .catch(function (err) {
            showError(peopleError, err.message);
          });
      });
      peopleTbody.addEventListener("dblclick", function (event) {
        startPersonCellEdit(event.target.closest("td.people-cell"));
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
      function storeCsvLines(rows) {
        return [STORE_HEADERS.map(csvEscape).join(",")].concat(
          rows.map(function (row) {
            return STORE_KEYS.map(function (key) {
              return csvEscape(row[key]);
            }).join(",");
          })
        );
      }

      root.querySelector("#org-template").addEventListener("click", function () {
        downloadCsv(
          "组织中心-店铺主数据模板.csv",
          storeCsvLines([
            {
              chief: "沈子晗组",
              lead: "张文静",
              owner: "示例运营",
              storeName: "示例旗舰店",
              storeId: "10001",
              merchantId: "11009999",
              remark: "运营中",
              updatedOn: "9.11更新",
              closedOn: "",
              login: "demo_9999",
              password: "Demo123!"
            }
          ])
        );
      });
      root.querySelector("#org-import").addEventListener("click", function () {
        root.querySelector("#org-import-file").click();
      });
      root.querySelector("#org-import-file").addEventListener("change", function (event) {
        const file = event.target.files && event.target.files[0];
        event.target.value = "";
        if (!file) {
          return;
        }
        file
          .text()
          .then(function (text) {
            const table = parseCsv(text);
            if (table.length < 2) {
              throw new Error("模板至少要有表头和一行数据");
            }
            const headers = table[0].map(function (cell) {
              return String(cell || "").trim();
            });
            const missing = STORE_HEADERS.filter(function (name) {
              return headers.indexOf(name) < 0;
            });
            if (missing.length) {
              throw new Error("表头需与表格一致，缺少：" + missing.join("、"));
            }
            const rows = table.slice(1).map(function (cells) {
              const item = {};
              headers.forEach(function (name, index) {
                item[name] = cells[index] || "";
              });
              return item;
            });
            return fetch("/api/people/org/stores/import", {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ rows: rows })
            }).then(function (res) {
              return res.json().then(function (data) {
                return { res: res, data: data };
              });
            });
          })
          .then(function (result) {
            if (!result.res.ok || !result.data.ok) {
              throw new Error(result.data.error || "导入失败");
            }
            const failed = result.data.failed || [];
            showError(
              errorEl,
              failed.length
                ? "导入完成：新增" +
                    result.data.created +
                    "，更新" +
                    result.data.updated +
                    "。失败" +
                    failed.length +
                    "行：" +
                    failed
                      .slice(0, 3)
                      .map(function (item) {
                        return "第" + item.line + "行" + item.error;
                      })
                      .join("；")
                : ""
            );
            if (!failed.length) {
              window.alert("导入完成：新增" + result.data.created + "条，更新" + result.data.updated + "条。");
            }
            return loadBoard();
          })
          .catch(function (err) {
            showError(errorEl, err.message);
          });
      });
      root.querySelector("#org-export").addEventListener("click", function () {
        downloadCsv("组织中心-店铺主数据.csv", storeCsvLines(lastStores));
      });

      loadBoard().catch(function (err) {
        showError(errorEl, err.message);
      });

      return function unmount() {
        dead = true;
        document.removeEventListener("wheel", onPeopleWheel, true);
        document.removeEventListener("click", onDocRightsPinClose);
        document.removeEventListener("click", onDocFilterClose);
        window.removeEventListener("scroll", onFilterPin, true);
        window.removeEventListener("resize", onFilterPin);
        if (mainPane) {
          mainPane.removeEventListener("scroll", onFilterPin);
        }
        closeFilterPop();
        [filterPop, peopleFilterPop].forEach(function (pop) {
          if (pop && pop.parentNode) {
            pop.parentNode.removeChild(pop);
          }
        });
        showShellTab();
        root.innerHTML = "";
      };
    }
  };
})();
