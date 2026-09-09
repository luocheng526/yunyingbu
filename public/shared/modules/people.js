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
    const href = "/people.css?v=0.1.140-org";
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
        '<p class="lead">店铺与人对齐。表头按花名册架构；增删改存。智能体只读，在职认花名册，店权认管辖/本表。</p></header>' +
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
        '<label>姓名<input name="name" required maxlength="40" /></label>' +
        '<label>角色<input name="role" required maxlength="40" placeholder="如 运营" /></label>' +
        '<label>所属中心<select name="center" required><option value="">请选择</option>' +
        "<option>沈子晗运营中心</option><option>韩梦凯运营中心</option><option>数据中心</option>" +
        "<option>版本发布中心</option><option>个人中心</option><option>其他</option></select></label>" +
        "<label>状态<select name=\"status\"><option>在职</option><option>离职</option></select></label>" +
        '<button type="submit">新增人员</button></form>' +
        '<p class="status error" id="people-error" hidden></p>' +
        '<div class="org-table-wrap"><table><thead><tr><th>姓名</th><th>角色</th><th>所属中心</th><th>状态</th></tr></thead>' +
        '<tbody id="people-tbody"></tbody></table></div></section></div>' +
        '<div class="org-pane" data-pane="rights" hidden>' +
        '<section class="panel"><h2>责权</h2><p class="lead">店权以本表「店铺所属人员」和管辖为准。一人多店多行。</p>' +
        '<div class="org-table-wrap"><table><thead><tr><th>人</th><th>店</th><th>团队</th><th>状态</th></tr></thead>' +
        '<tbody id="rights-tbody"></tbody></table></div></section></div>' +
        '<div class="org-pane" data-pane="acl" hidden>' +
        '<section class="panel"><h2>权限</h2>' +
        "<p>智能体只读：GET /api/people、GET /api/people/org/stores、GET /api/people/grants。</p>" +
        "<p>登录主账号和密码在店铺主数据列维护，不是钉钉通讯录。</p></section></div>" +
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
      const peopleForm = root.querySelector("#people-form");
      const peopleError = root.querySelector("#people-error");
      const rightsTbody = root.querySelector("#rights-tbody");
      const logsTbody = root.querySelector("#logs-tbody");
      let dead = false;
      let editingId = null;
      let lastStores = [];

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

      function renderStores(stores) {
        lastStores = stores;
        tbody.replaceChildren();
        countEl.textContent = "筛选 " + stores.length + " 条";
        if (!stores.length) {
          tbody.innerHTML = '<tr><td colspan="11" class="org-empty">暂无店铺</td></tr>';
          return;
        }
        stores.forEach(function (row) {
          const tr = document.createElement("tr");
          tr.innerHTML =
            "<td>" +
            escapeHtml(row.chief) +
            "</td><td>" +
            escapeHtml(row.lead) +
            "</td><td>" +
            escapeHtml(row.owner) +
            (row.demo ? '<span class="demo-flag">演示</span>' : "") +
            '</td><td class="org-link">' +
            escapeHtml(row.storeName) +
            "</td><td>" +
            escapeHtml(row.merchantId || "点击填写") +
            '</td><td><span class="' +
            tagClass(row.statusKey) +
            '">' +
            escapeHtml(row.remark) +
            "</span></td><td>" +
            escapeHtml(row.updatedOn || "—") +
            "</td><td>" +
            escapeHtml(row.closedOn || "—") +
            "</td><td>" +
            escapeHtml(row.login || "点击填写") +
            "</td><td>" +
            escapeHtml(row.password || "点击填写") +
            '</td><td class="org-actions"><button type="button" class="ghost" data-edit="' +
            row.id +
            '">编辑</button><button type="button" class="danger" data-del="' +
            row.id +
            '">移除</button></td>';
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
          fillTeams(storeData.teams || summaryData.teams);
          renderKpis(summaryData.summary);
          renderStores(storeData.stores || []);
        });
      }

      function loadMembers() {
        return fetch("/api/people", { credentials: "same-origin" })
          .then(function (res) {
            return res.json();
          })
          .then(function (data) {
            if (dead) {
              return;
            }
            peopleTbody.replaceChildren();
            (data.people || []).forEach(function (person) {
              const tr = document.createElement("tr");
              tr.innerHTML =
                "<td>" +
                escapeHtml(person.name) +
                (person.demo ? '<span class="demo-flag">演示</span>' : "") +
                "</td><td>" +
                escapeHtml(person.role) +
                "</td><td>" +
                escapeHtml(person.center) +
                "</td><td>" +
                escapeHtml(person.status) +
                "</td>";
              peopleTbody.append(tr);
            });
          });
      }

      function loadRights() {
        return fetch("/api/people/org/stores", { credentials: "same-origin" })
          .then(function (res) {
            return res.json();
          })
          .then(function (data) {
            if (dead) {
              return;
            }
            rightsTbody.replaceChildren();
            (data.stores || []).forEach(function (row) {
              const tr = document.createElement("tr");
              tr.innerHTML =
                "<td>" +
                escapeHtml(row.owner) +
                "</td><td>" +
                escapeHtml(row.storeName) +
                "</td><td>" +
                escapeHtml(row.team) +
                "</td><td>" +
                escapeHtml(row.remark) +
                "</td>";
              rightsTbody.append(tr);
            });
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
      peopleForm.addEventListener("submit", function (event) {
        event.preventDefault();
        showError(peopleError, "");
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
              showError(peopleError, result.data.error || "新增失败");
              return;
            }
            peopleForm.reset();
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
