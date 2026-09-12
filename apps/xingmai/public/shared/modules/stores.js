/* xm-module-stores 0.1.472 */
(function () {
  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function ensureCss() {
    if (document.querySelector('link[href*="stores.css"]')) {
      return;
    }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/stores.css";
    document.head.appendChild(link);
  }

  function optionHtml(value, selected) {
    return (
      '<option value="' +
      escapeHtml(value) +
      '"' +
      (value === selected ? " selected" : "") +
      ">" +
      escapeHtml(value) +
      "</option>"
    );
  }

  function statusPill(status) {
    const kind =
      status === "维护中" || status === "进行中" || status === "待处理"
        ? "keep"
        : status === "停用"
          ? "stop"
          : status === "已完成" || status === "正常"
            ? "done"
            : "";
    return '<span class="stores-pill' + (kind ? " " + kind : "") + '">' + escapeHtml(status) + "</span>";
  }

  function fillSelect(select, items, emptyLabel, current) {
    const value = current == null ? select.value : current;
    select.innerHTML = emptyLabel ? '<option value="">' + escapeHtml(emptyLabel) + "</option>" : "";
    items.forEach(function (item) {
      select.insertAdjacentHTML("beforeend", optionHtml(item, false));
    });
    if ([...select.options].some(function (option) {
      return option.value === value;
    })) {
      select.value = value;
    }
  }

  function formValues(form) {
    const data = new FormData(form);
    const out = {};
    data.forEach(function (value, key) {
      out[key] = String(value || "").trim();
    });
    return out;
  }

  function fetchJson(url, options) {
    return fetch(url, Object.assign({ credentials: "same-origin", headers: { Accept: "application/json" } }, options)).then(
      function (res) {
        return res.json().catch(function () {
          return {};
        }).then(function (data) {
          if (!res.ok || data.ok === false) {
            throw new Error(data.error || data.message || "接口 " + res.status);
          }
          return data;
        });
      }
    );
  }

  window.XmModules = window.XmModules || {};
  window.XmModules["/stores"] = {
    mount: function (root) {
      ensureCss();
      root.innerHTML =
        '<main class="page stores-page">' +
        '<header class="page-head"><p class="kicker">店铺维护中心</p><h1>店铺维护中心</h1>' +
        '<p class="lead">店铺档案、维护记录和工作台。这里管店档和跟进，不占用数据中心的店铺数据页。</p></header>' +
        '<div class="kpi-grid" id="stores-kpi"></div>' +
        '<div class="stores-toolbar">' +
        '<label>搜索<input id="store-q" maxlength="64" placeholder="店名 / 店铺ID / 负责人" /></label>' +
        '<label>平台<select id="store-platform-filter"><option value="">全部</option></select></label>' +
        '<label>状态<select id="store-status-filter"><option value="">全部</option></select></label>' +
        '<label>记录<select id="record-scope"><option value="all">全部记录</option><option value="open">只看未完成</option><option value="selected">只看选中店</option></select></label>' +
        "</div>" +
        '<div class="stores-grid">' +
        '<section class="panel"><h2>店铺档案</h2>' +
        '<form class="stores-form" id="store-form">' +
        '<label>店铺名称<input name="name" required maxlength="128" autocomplete="off" /></label>' +
        '<label>平台<select name="platform"></select></label>' +
        '<label>店铺ID<input name="shopCode" maxlength="64" placeholder="平台店号，可空" /></label>' +
        '<label>状态<select name="status"></select></label>' +
        '<label>负责人<input name="owner" maxlength="64" /></label>' +
        '<label>所属包<input name="pack" maxlength="64" placeholder="如 沈子晗包" /></label>' +
        '<label class="wide">备注<textarea name="note" maxlength="500" placeholder="账号、资质、对接人等维护备忘"></textarea></label>' +
        '<div class="stores-actions"><button type="submit" id="store-submit">新增档案</button>' +
        '<button type="button" class="ghost" id="store-cancel" hidden>取消编辑</button></div></form>' +
        '<p class="status" id="store-status" role="status"></p>' +
        '<div class="stores-table-wrap"><table><thead><tr><th>店铺</th><th>平台</th><th>店铺ID</th><th>状态</th><th>负责人</th><th>所属包</th><th>备注</th><th>操作</th></tr></thead>' +
        '<tbody id="store-tbody"></tbody></table></div></section>' +
        '<section class="panel"><h2>维护记录</h2>' +
        '<form class="stores-mini-form" id="record-form">' +
        '<label>店铺<select name="storeId" required></select></label>' +
        '<label>类型<select name="kind"></select></label>' +
        '<label>日期<input name="happenedOn" type="date" required /></label>' +
        '<label>处理人<input name="operator" maxlength="64" /></label>' +
        '<label>状态<select name="status"></select></label>' +
        '<label class="wide">内容<textarea name="content" required maxlength="1000" placeholder="巡检、改密、续证、活动报名或纠纷跟进"></textarea></label>' +
        '<div class="stores-actions"><button type="submit" id="record-submit">新增记录</button>' +
        '<button type="button" class="ghost" id="record-cancel" hidden>取消编辑</button></div></form>' +
        '<p class="status" id="record-status" role="status"></p>' +
        '<div class="stores-table-wrap"><table><thead><tr><th>日期</th><th>店铺</th><th>类型</th><th>内容</th><th>处理人</th><th>状态</th><th>操作</th></tr></thead>' +
        '<tbody id="record-tbody"></tbody></table></div></section></div></main>';

      const storeForm = root.querySelector("#store-form");
      const recordForm = root.querySelector("#record-form");
      const storeStatus = root.querySelector("#store-status");
      const recordStatus = root.querySelector("#record-status");
      const storeSubmit = root.querySelector("#store-submit");
      const recordSubmit = root.querySelector("#record-submit");
      const storeCancel = root.querySelector("#store-cancel");
      const recordCancel = root.querySelector("#record-cancel");
      const qInput = root.querySelector("#store-q");
      const platformFilter = root.querySelector("#store-platform-filter");
      const statusFilter = root.querySelector("#store-status-filter");
      const recordScope = root.querySelector("#record-scope");
      let dead = false;
      let snapshot = {
        stores: [],
        records: [],
        platforms: ["京东", "天猫", "抖音", "拼多多", "其他"],
        storeStatuses: ["正常", "维护中", "停用"],
        recordKinds: ["日常巡检", "账号密码", "资质证照", "活动报名", "纠纷处理", "其他"],
        recordStatuses: ["待处理", "进行中", "已完成"],
        summary: { total: 0, normal: 0, maintaining: 0, openRecords: 0 }
      };
      let selectedId = "";
      let editingStoreId = "";
      let editingRecordId = "";
      let meName = "";

      function setStatus(el, message, isError) {
        el.textContent = message || "";
        el.className = "status" + (isError ? " error" : message ? " ok" : "");
      }

      function storeName(id) {
        const hit = snapshot.stores.find(function (item) {
          return String(item.id) === String(id);
        });
        return hit ? hit.name : "已删店铺";
      }

      function visibleStores() {
        const q = qInput.value.trim().toLowerCase();
        const platform = platformFilter.value;
        const status = statusFilter.value;
        return snapshot.stores.filter(function (store) {
          if (platform && store.platform !== platform) {
            return false;
          }
          if (status && store.status !== status) {
            return false;
          }
          if (!q) {
            return true;
          }
          return [store.name, store.shopCode, store.owner, store.pack, store.note].join(" ").toLowerCase().indexOf(q) >= 0;
        });
      }

      function visibleRecords() {
        const scope = recordScope.value;
        const ids = new Set(
          visibleStores().map(function (store) {
            return Number(store.id);
          })
        );
        return snapshot.records.filter(function (record) {
          if (!ids.has(Number(record.storeId))) {
            return false;
          }
          if (scope === "open" && record.status === "已完成") {
            return false;
          }
          if (scope === "selected" && String(record.storeId) !== String(selectedId || editingStoreId)) {
            return false;
          }
          return true;
        });
      }

      function renderKpi() {
        const s = snapshot.summary || {};
        root.querySelector("#stores-kpi").innerHTML =
          '<article class="kpi-card"><div class="label">店铺档案</div><div class="value">' +
          escapeHtml(s.total || 0) +
          "</div></article>" +
          '<article class="kpi-card"><div class="label">正常运营</div><div class="value">' +
          escapeHtml(s.normal || 0) +
          "</div></article>" +
          '<article class="kpi-card is-warn"><div class="label">维护中</div><div class="value">' +
          escapeHtml(s.maintaining || 0) +
          "</div></article>" +
          '<article class="kpi-card is-open"><div class="label">未完成记录</div><div class="value">' +
          escapeHtml(s.openRecords || 0) +
          "</div></article>";
      }

      function renderStores() {
        const tbody = root.querySelector("#store-tbody");
        const rows = visibleStores();
        tbody.replaceChildren();
        if (!rows.length) {
          tbody.innerHTML = '<tr><td colspan="8" class="empty">还没有店铺档案。先在上面建档，不要写到数据中心店铺数据里。</td></tr>';
          return;
        }
        rows.forEach(function (store) {
          const tr = document.createElement("tr");
          if (String(store.id) === String(selectedId)) {
            tr.className = "is-on";
          }
          tr.innerHTML =
            "<td>" +
            escapeHtml(store.name) +
            "</td><td>" +
            escapeHtml(store.platform) +
            "</td><td>" +
            escapeHtml(store.shopCode || "—") +
            "</td><td>" +
            statusPill(store.status) +
            "</td><td>" +
            escapeHtml(store.owner || "—") +
            "</td><td>" +
            escapeHtml(store.pack || "—") +
            "</td><td>" +
            escapeHtml(store.note || "—") +
            '</td><td><button type="button" class="link-btn" data-act="pick">选中</button> ' +
            '<button type="button" class="link-btn" data-act="edit">编辑</button> ' +
            '<button type="button" class="link-btn danger" data-act="del">删除</button></td>';
          tr.querySelector('[data-act="pick"]').addEventListener("click", function () {
            selectedId = String(store.id);
            recordForm.storeId.value = String(store.id);
            renderStores();
            renderRecords();
          });
          tr.querySelector('[data-act="edit"]').addEventListener("click", function () {
            editingStoreId = String(store.id);
            selectedId = String(store.id);
            storeForm.name.value = store.name;
            storeForm.platform.value = store.platform;
            storeForm.shopCode.value = store.shopCode || "";
            storeForm.status.value = store.status;
            storeForm.owner.value = store.owner || "";
            storeForm.pack.value = store.pack || "";
            storeForm.note.value = store.note || "";
            storeSubmit.textContent = "保存档案";
            storeCancel.hidden = false;
            renderStores();
          });
          tr.querySelector('[data-act="del"]').addEventListener("click", function () {
            if (!window.confirm("删除「" + store.name + "」及它的维护记录？")) {
              return;
            }
            fetchJson("/api/stores/" + store.id, { method: "DELETE" })
              .then(function () {
                if (String(selectedId) === String(store.id)) {
                  selectedId = "";
                }
                if (String(editingStoreId) === String(store.id)) {
                  resetStoreForm();
                }
                return loadAll("已删除档案");
              })
              .catch(function (err) {
                if (!dead) {
                  setStatus(storeStatus, err.message || "删除失败", true);
                }
              });
          });
          tbody.append(tr);
        });
      }

      function renderRecords() {
        const tbody = root.querySelector("#record-tbody");
        const rows = visibleRecords();
        tbody.replaceChildren();
        if (!rows.length) {
          tbody.innerHTML = '<tr><td colspan="7" class="empty">暂无维护记录</td></tr>';
          return;
        }
        rows.forEach(function (record) {
          const tr = document.createElement("tr");
          tr.innerHTML =
            "<td>" +
            escapeHtml(record.happenedOn) +
            "</td><td>" +
            escapeHtml(storeName(record.storeId)) +
            "</td><td>" +
            escapeHtml(record.kind) +
            "</td><td>" +
            escapeHtml(record.content) +
            "</td><td>" +
            escapeHtml(record.operator || "—") +
            "</td><td>" +
            statusPill(record.status) +
            '</td><td><button type="button" class="link-btn" data-act="edit">编辑</button> ' +
            '<button type="button" class="link-btn danger" data-act="del">删除</button></td>';
          tr.querySelector('[data-act="edit"]').addEventListener("click", function () {
            editingRecordId = String(record.id);
            recordForm.storeId.value = String(record.storeId);
            recordForm.kind.value = record.kind;
            recordForm.happenedOn.value = record.happenedOn;
            recordForm.operator.value = record.operator || "";
            recordForm.status.value = record.status;
            recordForm.content.value = record.content;
            recordSubmit.textContent = "保存记录";
            recordCancel.hidden = false;
          });
          tr.querySelector('[data-act="del"]').addEventListener("click", function () {
            if (!window.confirm("删除这条维护记录？")) {
              return;
            }
            fetchJson("/api/stores/records/" + record.id, { method: "DELETE" })
              .then(function () {
                if (String(editingRecordId) === String(record.id)) {
                  resetRecordForm();
                }
                return loadAll("", "已删除记录");
              })
              .catch(function (err) {
                if (!dead) {
                  setStatus(recordStatus, err.message || "删除失败", true);
                }
              });
          });
          tbody.append(tr);
        });
      }

      function syncSelects() {
        fillSelect(storeForm.platform, snapshot.platforms, "", storeForm.platform.value || "京东");
        fillSelect(storeForm.status, snapshot.storeStatuses, "", storeForm.status.value || "正常");
        fillSelect(recordForm.kind, snapshot.recordKinds, "", recordForm.kind.value || "日常巡检");
        fillSelect(recordForm.status, snapshot.recordStatuses, "", recordForm.status.value || "待处理");
        fillSelect(platformFilter, snapshot.platforms, "全部", platformFilter.value);
        fillSelect(statusFilter, snapshot.storeStatuses, "全部", statusFilter.value);
        const storeIds = snapshot.stores.map(function (store) {
          return String(store.id);
        });
        const labels = snapshot.stores.map(function (store) {
          return store.name + (store.shopCode ? " · " + store.shopCode : "");
        });
        const current = recordForm.storeId.value || selectedId;
        recordForm.storeId.innerHTML = '<option value="">请选择店铺</option>';
        snapshot.stores.forEach(function (store, index) {
          recordForm.storeId.insertAdjacentHTML("beforeend", optionHtml(storeIds[index], false));
          recordForm.storeId.options[index + 1].textContent = labels[index];
        });
        if ([...recordForm.storeId.options].some(function (option) {
          return option.value === String(current);
        })) {
          recordForm.storeId.value = String(current);
        }
      }

      function resetStoreForm() {
        editingStoreId = "";
        storeForm.reset();
        storeForm.platform.value = "京东";
        storeForm.status.value = "正常";
        storeSubmit.textContent = "新增档案";
        storeCancel.hidden = true;
      }

      function resetRecordForm() {
        editingRecordId = "";
        const keepStore = recordForm.storeId.value || selectedId;
        recordForm.reset();
        recordForm.kind.value = "日常巡检";
        recordForm.status.value = "待处理";
        recordForm.happenedOn.value = snapshot.today || recordForm.happenedOn.value;
        recordForm.operator.value = meName;
        if (keepStore) {
          recordForm.storeId.value = String(keepStore);
        }
        recordSubmit.textContent = "新增记录";
        recordCancel.hidden = true;
      }

      function paint() {
        renderKpi();
        syncSelects();
        renderStores();
        renderRecords();
      }

      function loadAll(storeMsg, recordMsg) {
        return fetchJson("/api/stores").then(function (data) {
          if (dead) {
            return;
          }
          snapshot = data;
          if (!recordForm.happenedOn.value) {
            recordForm.happenedOn.value = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
          }
          paint();
          if (storeMsg) {
            setStatus(storeStatus, storeMsg);
          }
          if (recordMsg) {
            setStatus(recordStatus, recordMsg);
          }
        });
      }

      function onStoreSubmit(event) {
        event.preventDefault();
        const body = formValues(storeForm);
        setStatus(storeStatus, "正在保存…");
        const editing = Boolean(editingStoreId);
        fetchJson(editing ? "/api/stores/" + editingStoreId : "/api/stores", {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(body)
        })
          .then(function (data) {
            if (data.store) {
              selectedId = String(data.store.id);
            }
            resetStoreForm();
            return loadAll(editing ? "档案已保存" : "已新增档案");
          })
          .catch(function (err) {
            if (!dead) {
              setStatus(storeStatus, err.message || "保存失败", true);
            }
          });
      }

      function onRecordSubmit(event) {
        event.preventDefault();
        const body = formValues(recordForm);
        if (!body.operator && meName) {
          body.operator = meName;
        }
        setStatus(recordStatus, "正在保存…");
        const editing = Boolean(editingRecordId);
        fetchJson(editing ? "/api/stores/records/" + editingRecordId : "/api/stores/records", {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(body)
        })
          .then(function () {
            resetRecordForm();
            return loadAll("", editing ? "记录已保存" : "已新增记录");
          })
          .catch(function (err) {
            if (!dead) {
              setStatus(recordStatus, err.message || "保存失败", true);
            }
          });
      }

      function onFilter() {
        paint();
      }

      storeForm.addEventListener("submit", onStoreSubmit);
      recordForm.addEventListener("submit", onRecordSubmit);
      storeCancel.addEventListener("click", function () {
        resetStoreForm();
        setStatus(storeStatus, "");
      });
      recordCancel.addEventListener("click", function () {
        resetRecordForm();
        setStatus(recordStatus, "");
      });
      qInput.addEventListener("input", onFilter);
      platformFilter.addEventListener("change", onFilter);
      statusFilter.addEventListener("change", onFilter);
      recordScope.addEventListener("change", onFilter);

      Promise.all([
        fetchJson("/api/auth/me")
          .then(function (data) {
            meName = data.displayName || data.username || "";
          })
          .catch(function () {
            meName = "";
          }),
        loadAll()
      ])
        .then(function () {
          if (!dead) {
            if (meName && !recordForm.operator.value) {
              recordForm.operator.value = meName;
            }
          }
        })
        .catch(function (err) {
          if (!dead) {
            setStatus(storeStatus, err.message || "加载失败", true);
          }
        });

      return function unmount() {
        dead = true;
        storeForm.removeEventListener("submit", onStoreSubmit);
        recordForm.removeEventListener("submit", onRecordSubmit);
        root.innerHTML = "";
      };
    }
  };
})();
