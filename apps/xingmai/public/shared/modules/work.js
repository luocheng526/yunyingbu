/* xm-module-work — 工作汇报。按组织中心责权排进运营部、人事部、技术部，再按模板填当天表。 */
(function () {
  var state = {
    tab: "today",
    date: "",
    dept: "",
    settingsDept: "ops",
    personId: 0,
    rosterQuery: "",
    rosterScope: "all",
    orgBoard: "",
    boardQuery: "",
    meta: null,
    report: null,
    settings: null,
    msg: "",
    error: false,
    saving: false
  };

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function ensureStyle() {
    if (document.getElementById("work-page-style")) {
      return;
    }
    var style = document.createElement("style");
    style.id = "work-page-style";
    style.textContent =
      ".work-page{color:var(--xm-ink);}" +
      ".work-tabs{display:flex;gap:0;border-bottom:1px solid var(--xm-line);margin:0 0 12px;overflow:auto;}" +
      ".work-tab{appearance:none;border:0;border-bottom:2px solid transparent;background:transparent;color:var(--xm-muted);font:inherit;font-size:14px;padding:10px 16px;cursor:pointer;white-space:nowrap;}" +
      ".work-tab[aria-selected='true']{color:var(--xm-primary);border-bottom-color:var(--xm-primary);font-weight:600;}" +
      ".work-page button:focus-visible,.work-page input:focus-visible,.work-page select:focus-visible,.work-page textarea:focus-visible{outline:2px solid var(--xm-primary);outline-offset:1px;}" +
      ".work-panel{display:flex;flex-direction:column;gap:12px;}" +
      ".work-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(128px,1fr));gap:8px;}" +
      ".work-kpi{background:var(--xm-card);border:1px solid var(--xm-line);border-radius:8px;padding:10px 12px;box-shadow:var(--xm-shadow);}" +
      ".work-kpi b{display:block;font-size:22px;line-height:1.2;font-variant-numeric:tabular-nums;color:var(--xm-ink);}" +
      ".work-kpi span{display:block;margin-top:2px;color:var(--xm-muted);font-size:12px;}" +
      ".work-card{background:var(--xm-card);border:1px solid var(--xm-line);border-radius:8px;box-shadow:var(--xm-shadow);}" +
      ".work-form{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;padding:12px;}" +
      ".work-field{display:flex;flex-direction:column;gap:4px;min-width:140px;color:var(--xm-muted);font-size:12px;}" +
      ".work-field input,.work-field select{height:32px;border:1px solid var(--xm-line);border-radius:6px;background:var(--xm-card);color:var(--xm-ink);padding:0 8px;font:inherit;font-size:13px;}" +
      ".work-field textarea,.work-table textarea{min-height:64px;width:100%;border:1px solid var(--xm-line);border-radius:6px;background:var(--xm-card);color:var(--xm-ink);padding:6px 8px;font:inherit;font-size:13px;resize:vertical;box-sizing:border-box;}" +
      ".work-primary{height:32px;border:0;border-radius:6px;background:var(--xm-primary);color:#fff;padding:0 14px;font:inherit;font-size:13px;cursor:pointer;}" +
      ".work-mini{height:28px;border:1px solid var(--xm-line);border-radius:6px;background:var(--xm-card);color:var(--xm-ink);padding:0 10px;font:inherit;font-size:12px;cursor:pointer;}" +
      ".work-mini.is-on{border-color:var(--xm-primary);color:var(--xm-primary);}" +
      ".work-table-wrap{overflow:auto;}" +
      ".work-roster-scroll{max-height:360px;overflow:auto;}" +
      ".work-table{width:100%;border-collapse:collapse;font-size:13px;}" +
      ".work-table th{text-align:left;color:var(--xm-muted);font-weight:600;padding:8px 10px;border-bottom:1px solid var(--xm-line);white-space:nowrap;}" +
      ".work-table td{padding:8px 10px;border-bottom:1px solid var(--xm-line);vertical-align:top;}" +
      "td.work-check{width:48px;text-align:center;}" +
      "td.work-check input{width:18px;height:18px;margin:0;accent-color:var(--xm-primary);cursor:pointer;}" +
      ".work-empty{padding:28px 12px;text-align:center;color:var(--xm-muted);}" +
      ".work-msg{min-height:18px;color:var(--xm-muted);font-size:12px;padding:0 4px;}" +
      ".work-msg.is-error{color:#cf1322;}" +
      ".work-ok{color:#12b36a;font-weight:650;white-space:nowrap;}" +
      ".work-miss{color:#cf1322;font-weight:650;white-space:nowrap;}" +
      ".work-depts{display:flex;flex-wrap:wrap;gap:8px;padding:12px;}" +
      ".work-dept{min-width:140px;flex:1;text-align:left;border:1px solid var(--xm-line);border-radius:8px;background:var(--xm-card);padding:10px 12px;cursor:pointer;color:var(--xm-ink);font:inherit;}" +
      ".work-dept.is-on{border-color:var(--xm-primary);box-shadow:0 0 0 1px var(--xm-primary);}" +
      ".work-dept b{display:block;font-size:16px;}" +
      ".work-dept span{display:block;margin-top:4px;color:var(--xm-muted);font-size:12px;}" +
      ".work-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-end;flex-wrap:wrap;}" +
      ".work-lead{margin:4px 0 0;color:var(--xm-muted);font-size:13px;}" +
      ".work-page h1{margin:0;font-size:22px;}" +
      ".work-page h2{margin:0;padding:12px 12px 0;font-size:14px;}" +
      ".work-muted{color:var(--xm-muted);font-size:12px;}" +
      ".work-filters{display:flex;flex-direction:row;flex-wrap:wrap;gap:8px;align-items:center;padding:4px 12px 12px;}" +
      ".work-filters .work-mini{flex:none;width:auto;}" +
      ".work-chiprow{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:0 12px 12px;}" +
      ".work-sub{display:block;margin-top:2px;color:var(--xm-muted);font-size:12px;line-height:1.45;}" +
      ".work-duty{min-width:160px;max-width:340px;white-space:normal;line-height:1.45;}" +
      ".work-count{margin-left:auto;color:var(--xm-muted);font-size:12px;}" +
      ".work-field.is-grow{flex:1;min-width:200px;}" +
      ".work-table td.work-rights{max-width:280px;white-space:normal;}" +
      "@media (max-width:720px){.work-stats{grid-template-columns:repeat(2,minmax(0,1fr));}.work-count{margin-left:0;}}";
    document.head.appendChild(style);
  }

  function api(path, options) {
    var init = options || {};
    var headers = { Accept: "application/json" };
    if (init.body) {
      headers["Content-Type"] = "application/json";
    }
    return fetch(path, {
      method: init.method || "GET",
      credentials: "same-origin",
      headers: headers,
      body: init.body ? JSON.stringify(init.body) : undefined
    }).then(function (res) {
      return res
        .json()
        .catch(function () {
          return {};
        })
        .then(function (data) {
          if (!res.ok || data.ok === false) {
            var err = new Error((data && data.error) || "读取失败");
            err.status = res.status;
            throw err;
          }
          return data || {};
        });
    });
  }

  function setMsg(text, isError) {
    state.msg = text || "";
    state.error = Boolean(isError);
  }

  function todayIso() {
    if (state.meta && state.meta.today) {
      return state.meta.today;
    }
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date());
  }

  function countDept(code) {
    var members = (state.settings && state.settings.members) || [];
    return members.filter(function (item) {
      return item.deptCode === code;
    }).length;
  }

  function personTemplate(personId) {
    var bag = (state.settings && state.settings.personTemplates) || {};
    return bag[String(personId)] || [];
  }

  function deptTemplate(code) {
    var bag = (state.settings && state.settings.templates) || {};
    return bag[code] || [];
  }

  function isAdmin() {
    return Boolean(state.meta && state.meta.isAdmin);
  }

  function orgBoards() {
    return (
      (state.settings && state.settings.orgBoards) ||
      (state.meta && state.meta.orgBoards) || [
        { code: "ops", name: "运营部门" },
        { code: "hrTech", name: "人事和技术部门" },
        { code: "backend", name: "后端部门" }
      ]
    );
  }

  function deptLabel(code) {
    var hit = ((state.meta && state.meta.depts) || []).find(function (item) {
      return item.code === code;
    });
    return hit ? hit.name : "";
  }

  function dateLabel(date) {
    return date === todayIso() ? "今日工作" : date + " 的工作";
  }

  function chip(attr, value, label, current) {
    return (
      '<button type="button" class="work-mini' +
      (current === value ? " is-on" : "") +
      '" ' +
      attr +
      '="' +
      esc(value) +
      '">' +
      esc(label) +
      "</button>"
    );
  }

  function personShops(person) {
    return ((person && person.visibleShops) || []).filter(Boolean).join("、");
  }

  function rosterDuty(person) {
    var shops = personShops(person);
    var duty = (person && person.duty) || "";
    if (shops && duty) {
      return esc(shops) + '<span class="work-sub">' + esc(duty) + "</span>";
    }
    return esc(shops || duty || (person && person.rights) || "—");
  }

  function boardDuty(person) {
    if (!person) {
      return "—";
    }
    if (personShops(person)) {
      return (person.seat ? person.seat + " · " : "") + (person.rights || personShops(person));
    }
    return person.duty || person.seat || person.rights || "—";
  }

  function rosterBlob(person) {
    return [
      person.name,
      person.role,
      person.center,
      person.orgBoardName,
      person.seat,
      person.duty,
      person.rights,
      personShops(person),
      person.deptName
    ]
      .join(" ")
      .toLowerCase();
  }

  function personVisible(person) {
    var q = String(state.rosterQuery || "").trim().toLowerCase();
    if (state.orgBoard === "none") {
      if (person.orgBoard) {
        return false;
      }
    } else if (state.orgBoard && person.orgBoard !== state.orgBoard) {
      return false;
    }
    if (state.rosterScope === "open" && person.deptCode) {
      return false;
    }
    if (state.rosterScope === "here" && person.deptCode !== state.settingsDept) {
      return false;
    }
    if (state.rosterScope === "other" && (!person.deptCode || person.deptCode === state.settingsDept)) {
      return false;
    }
    if (q && rosterBlob(person).indexOf(q) < 0) {
      return false;
    }
    return true;
  }

  function rosterPeople() {
    return ((state.settings && state.settings.people) || []).filter(personVisible);
  }

  function applyRosterFilter(root) {
    var rows = [].slice.call(root.querySelectorAll("[data-person-row]"));
    var shown = 0;
    rows.forEach(function (tr) {
      var person = {
        orgBoard: tr.getAttribute("data-org-board") || "",
        deptCode: tr.getAttribute("data-dept") || ""
      };
      var q = String(state.rosterQuery || "").trim().toLowerCase();
      var ok = true;
      if (state.orgBoard === "none") {
        ok = !person.orgBoard;
      } else if (state.orgBoard) {
        ok = person.orgBoard === state.orgBoard;
      }
      if (ok && state.rosterScope === "open") {
        ok = !person.deptCode;
      }
      if (ok && state.rosterScope === "here") {
        ok = person.deptCode === state.settingsDept;
      }
      if (ok && state.rosterScope === "other") {
        ok = Boolean(person.deptCode) && person.deptCode !== state.settingsDept;
      }
      if (ok && q) {
        ok = String(tr.getAttribute("data-blob") || "").indexOf(q) >= 0;
      }
      tr.hidden = !ok;
      if (ok) {
        shown += 1;
      }
    });
    var empty = root.querySelector("[data-roster-empty]");
    if (empty) {
      empty.hidden = shown > 0;
    }
    var count = root.querySelector("[data-roster-count]");
    if (count) {
      count.textContent = "显示 " + shown + " / " + rows.length;
    }
  }

  function reportRows() {
    var rows = (state.report && state.report.rows) || [];
    var q = String(state.boardQuery || "").trim().toLowerCase();
    if (!q) {
      return rows;
    }
    return rows.filter(function (row) {
      var person = row.person || {};
      var blob = [
        person.name,
        row.deptName,
        person.role,
        person.center,
        person.seat,
        person.duty,
        person.rights,
        personShops(person),
        row.status,
        (row.items || [])
          .map(function (item) {
            return item.label + " " + item.content;
          })
          .join(" ")
      ]
        .join(" ")
        .toLowerCase();
      return blob.indexOf(q) >= 0;
    });
  }

  function reportBlob(row) {
    var person = row.person || {};
    return [
      person.name,
      row.deptName,
      person.role,
      person.center,
      person.seat,
      person.duty,
      person.rights,
      personShops(person),
      row.status,
      (row.items || [])
        .map(function (item) {
          return item.label + " " + item.content;
        })
        .join(" ")
    ]
      .join(" ")
      .toLowerCase();
  }

  function applyBoardFilter(root) {
    var q = String(state.boardQuery || "").trim().toLowerCase();
    var groups = {};
    [].slice.call(root.querySelectorAll("[data-report-row]")).forEach(function (tr) {
      var id = tr.getAttribute("data-report-row");
      groups[id] = groups[id] || [];
      groups[id].push(tr);
    });
    var ids = Object.keys(groups);
    var shown = 0;
    ids.forEach(function (id) {
      var blob = groups[id][0].getAttribute("data-blob") || "";
      var ok = !q || blob.indexOf(q) >= 0;
      groups[id].forEach(function (tr) {
        tr.hidden = !ok;
      });
      if (ok) {
        shown += 1;
      }
    });
    var empty = root.querySelector("[data-board-empty]");
    if (empty) {
      empty.hidden = shown > 0;
    }
    var count = root.querySelector("[data-board-count]");
    if (count) {
      count.hidden = !q;
      count.textContent = "显示 " + shown + " / " + ids.length;
    }
  }

  function myRow() {
    var rows = (state.report && state.report.rows) || [];
    var me = state.meta && state.meta.me;
    if (!me) {
      return rows[0] || null;
    }
    return (
      rows.find(function (row) {
        return Number(row.person && row.person.id) === Number(me.id);
      }) || null
    );
  }

  function renderKpis() {
    var sum = (state.report && state.report.summary) || { should: 0, done: 0, miss: 0 };
    return (
      '<div class="work-stats">' +
      '<div class="work-kpi"><b>' +
      esc(sum.should) +
      "</b><span>应报人数</span></div>" +
      '<div class="work-kpi"><b>' +
      esc(sum.done) +
      "</b><span>已报</span></div>" +
      '<div class="work-kpi"><b>' +
      esc(sum.miss) +
      "</b><span>未报</span></div>" +
      "</div>"
    );
  }

  function renderFillTable(row, editable) {
    if (!row) {
      return '<div class="work-empty">今天没有需要填的事项。</div>';
    }
    var body = (row.items || [])
      .map(function (item) {
        var cell = editable
          ? '<textarea data-item-key="' +
            esc(item.key) +
            '" placeholder="写今天这项做了什么">' +
            esc(item.content) +
            "</textarea>"
          : esc(item.content || "—");
        return (
          "<tr><td>" +
          esc(item.label) +
          "</td><td>" +
          cell +
          "</td></tr>"
        );
      })
      .join("");
    return (
      '<div class="work-card work-table-wrap"><table class="work-table"><thead><tr><th>工作事项</th><th>今日工作</th></tr></thead><tbody>' +
      (body || '<tr><td colspan="2" class="work-empty">还没有事项，请罗成在部门设置里配模板。</td></tr>') +
      "</tbody></table></div>"
    );
  }

  function renderAdminTable(date) {
    var rows = (state.report && state.report.rows) || [];
    if (!rows.length) {
      return '<div class="work-card"><div class="work-empty">这一天还没有人需要汇报。先到部门设置里按责权把人排进运营部、人事部或技术部。</div></div>';
    }
    var q = String(state.boardQuery || "").trim().toLowerCase();
    var visiblePeople = 0;
    var body = rows
      .map(function (row) {
        var items = row.items || [];
        var blob = reportBlob(row);
        var hide = q && blob.indexOf(q) < 0;
        if (!hide) {
          visiblePeople += 1;
        }
        return items
          .map(function (item, index) {
            return (
              "<tr" +
              (hide ? " hidden" : "") +
              ' data-report-row="' +
              esc(row.person.id) +
              '" data-blob="' +
              esc(blob) +
              '">' +
              (index === 0
                ? '<td rowspan="' +
                  items.length +
                  '">' +
                  esc(row.person.name) +
                  "</td><td rowspan=\"" +
                  items.length +
                  '">' +
                  esc(row.deptName) +
                  "</td><td rowspan=\"" +
                  items.length +
                  '">' +
                  esc(row.person.role) +
                  "</td><td rowspan=\"" +
                  items.length +
                  '">' +
                  esc(row.person.center) +
                  '</td><td class="work-duty" rowspan="' +
                  items.length +
                  '">' +
                  esc(boardDuty(row.person)) +
                  "</td>"
                : "") +
              "<td>" +
              esc(item.label) +
              "</td><td>" +
              esc(item.content || "—") +
              "</td>" +
              (index === 0
                ? '<td rowspan="' +
                  items.length +
                  '" class="' +
                  (row.submitted ? "work-ok" : "work-miss") +
                  '">' +
                  esc(row.status) +
                  "</td>"
                : "") +
              "</tr>"
            );
          })
          .join("");
      })
      .join("");
    return (
      '<div class="work-card work-table-wrap"><table class="work-table"><thead><tr><th>姓名</th><th>部门</th><th>岗位</th><th>所属中心</th><th>责权</th><th>工作事项</th><th>' +
      esc(dateLabel(date)) +
      '</th><th>状态</th></tr></thead><tbody>' +
      body +
      '<tr data-board-empty' +
      (visiblePeople ? " hidden" : "") +
      '><td colspan="8" class="work-empty">没有符合筛选的人。</td></tr>' +
      "</tbody></table></div>"
    );
  }

  function renderToday() {
    var date = state.date || todayIso();
    var depts = ((state.meta && state.meta.depts) || [])
      .map(function (item) {
        return (
          '<button type="button" class="work-mini' +
          (state.dept === item.code ? " is-on" : "") +
          '" data-dept-filter="' +
          esc(item.code) +
          '">' +
          esc(item.name) +
          "</button>"
        );
      })
      .join("");
    var mine = myRow();
    var canFill = Boolean(mine);
    var skip = state.report && state.report.needReport === false && !isAdmin();
    var fillBlock = "";
    if (skip) {
      fillBlock = '<div class="work-card"><div class="work-empty">你所在部门不需要工作汇报。</div></div>';
    } else if (canFill) {
      fillBlock =
        '<div class="work-head"><div><h2 style="padding:0">' +
        esc(dateLabel(date)) +
        (mine.deptName ? " · " + esc(mine.deptName) : "") +
        '</h2><p class="work-lead">按罗成配好的模板填，一天一张表。</p></div>' +
        '<button type="button" class="work-primary" data-save-mine>保存这一天</button></div>' +
        renderFillTable(mine, true);
    } else if (!isAdmin()) {
      fillBlock = '<div class="work-card"><div class="work-empty">今天没有需要填的事项。</div></div>';
    }
    var shown = reportRows().length;
    var total = ((state.report && state.report.rows) || []).length;
    var board = isAdmin()
      ? renderKpis() +
        '<div class="work-filters"><span class="work-muted">部门</span>' +
        '<button type="button" class="work-mini' +
        (state.dept ? "" : " is-on") +
        '" data-dept-filter="">全部</button>' +
        depts +
        '<label class="work-field is-grow">找人<input data-board-q data-keep-focus="board" value="' +
        esc(state.boardQuery) +
        '" placeholder="姓名、责权、事项"></label>' +
        '<span class="work-count" data-board-count' +
        (state.boardQuery ? "" : " hidden") +
        ">显示 " +
        shown +
        " / " +
        total +
        "</span></div>" +
        renderAdminTable(date)
      : "";
    return (
      '<div class="work-panel">' +
      '<div class="work-card work-form">' +
      '<label class="work-field">日期<input type="date" data-work-date min="2020-01-01" max="2099-12-31" value="' +
      esc(date) +
      '"></label>' +
      '<button type="button" class="work-mini" data-today>今天</button>' +
      "</div>" +
      fillBlock +
      board +
      "</div>"
    );
  }

  function renderTemplateEditor(items, personMode) {
    var rows = (items || [])
      .map(function (item, index) {
        return (
          "<tr><td>" +
          (index + 1) +
          '</td><td><input data-tpl-key="' +
          esc(item.key || "") +
          '" data-tpl-label="' +
          index +
          '" value="' +
          esc(item.label) +
          '"></td><td><button type="button" class="work-mini" data-tpl-del="' +
          index +
          '">删除</button></td></tr>'
        );
      })
      .join("");
    return (
      '<div class="work-card"><h2>' +
      (personMode ? "个人工作事项" : "部门默认事项") +
      "</h2>" +
      '<p class="work-lead" style="padding:0 12px 8px">' +
      (personMode && !personTemplate(state.personId).length
        ? "这个人还没有个人模板，下面是部门事项。保存后只给这个人用。"
        : "他们打开工作汇报时，按这个表格填每天事项。") +
      "</p>" +
      '<div class="work-table-wrap"><table class="work-table"><thead><tr><th>#</th><th>事项名称</th><th></th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="3" class="work-empty">还没有事项</td></tr>') +
      "</tbody></table></div>" +
      '<div class="work-form"><label class="work-field">新增事项<input data-tpl-new placeholder="例如：店铺运营"></label>' +
      '<button type="button" class="work-mini" data-tpl-add>添加</button>' +
      '<button type="button" class="work-primary" data-tpl-save>保存模板</button>' +
      (personMode ? '<button type="button" class="work-mini" data-tpl-reset>改回部门模板</button>' : "") +
      "</div></div>"
    );
  }

  function renderPeopleTable() {
    var all = (state.settings && state.settings.people) || [];
    var people = rosterPeople();
    var body = people
      .map(function (person) {
        var on = person.deptCode === state.settingsDept;
        var orgName = person.orgBoardName || (person.orgBoard ? person.orgBoard : "未分部门");
        return (
          "<tr" +
          (personVisible(person) ? "" : " hidden") +
          ' data-person-row="' +
          esc(person.id) +
          '" data-org-board="' +
          esc(person.orgBoard || "") +
          '" data-dept="' +
          esc(person.deptCode || "") +
          '" data-blob="' +
          esc(rosterBlob(person)) +
          '"><td class="work-check"><input type="checkbox" data-assign="' +
          esc(person.id) +
          '"' +
          (on ? " checked" : "") +
          "></td><td>" +
          esc(person.name) +
          "</td><td>" +
          esc(person.role) +
          "</td><td>" +
          esc(person.center) +
          "</td><td>" +
          esc(orgName) +
          "</td><td>" +
          esc(person.seat || "—") +
          '</td><td class="work-duty">' +
          rosterDuty(person) +
          "</td><td>" +
          esc(person.deptName || "不汇报") +
          "</td></tr>"
        );
      })
      .join("");
    var boards = [{ code: "", name: "全部组织部门" }]
      .concat(orgBoards())
      .concat([{ code: "none", name: "未分部门" }]);
    return (
      '<div class="work-card"><h2>按责权加人</h2>' +
      '<p class="work-lead" style="padding:0 12px 8px">名单来自组织中心在职人员。组织部门只作参考：人事和技术在那边是同一张表，这里要拆成人事部或技术部。勾上的人才按当前部门的模板每天填表。</p>' +
      '<div class="work-form"><label class="work-field is-grow">搜索<input data-roster-q data-keep-focus="roster" value="' +
      esc(state.rosterQuery) +
      '" placeholder="姓名、中心、店铺、主管"></label><span class="work-count" data-roster-count>显示 ' +
      people.length +
      " / " +
      all.length +
      "</span></div>" +
      '<div class="work-chiprow">' +
      chip("data-roster-scope", "all", "全部", state.rosterScope) +
      chip("data-roster-scope", "open", "未排", state.rosterScope) +
      chip("data-roster-scope", "here", "本部门", state.rosterScope) +
      chip("data-roster-scope", "other", "其他汇报部门", state.rosterScope) +
      "</div>" +
      '<div class="work-chiprow">' +
      boards
        .map(function (item) {
          return chip("data-org-board", item.code, item.name, state.orgBoard);
        })
        .join("") +
      "</div>" +
      '<div class="work-table-wrap work-roster-scroll"><table class="work-table"><thead><tr><th>汇报</th><th>姓名</th><th>岗位</th><th>所属中心</th><th>组织部门</th><th>席位</th><th>责权</th><th>当前汇报</th></tr></thead><tbody>' +
      body +
      '<tr data-roster-empty' +
      (people.length ? " hidden" : "") +
      '><td colspan="8" class="work-empty">' +
      (all.length ? "没有符合筛选的人" : "组织中心还没有人") +
      "</td></tr>" +
      "</tbody></table></div></div>"
    );
  }

  function renderPersonPicker() {
    var members = ((state.settings && state.settings.members) || []).filter(function (item) {
      return item.deptCode === state.settingsDept;
    });
    var options = ['<option value="0">部门默认模板</option>']
      .concat(
        members.map(function (item) {
          return (
            '<option value="' +
            esc(item.personId) +
            '"' +
            (Number(state.personId) === Number(item.personId) ? " selected" : "") +
            ">" +
            esc(item.person.name) +
            "</option>"
          );
        })
      )
      .join("");
    return (
      '<div class="work-card work-form"><label class="work-field">给谁配事项<select data-person-tpl>' +
      options +
      "</select></label></div>"
    );
  }

  function renderSettings() {
    var depts = ((state.meta && state.meta.depts) || [])
      .map(function (item) {
        return (
          '<button type="button" class="work-dept' +
          (state.settingsDept === item.code ? " is-on" : "") +
          '" data-settings-dept="' +
          esc(item.code) +
          '"><b>' +
          esc(item.name) +
          "</b><span>" +
          countDept(item.code) +
          " 人需汇报</span></button>"
        );
      })
      .join("");
    var items = Number(state.personId)
      ? personTemplate(state.personId).length
        ? personTemplate(state.personId)
        : deptTemplate(state.settingsDept)
      : deptTemplate(state.settingsDept);
    return (
      '<div class="work-panel"><div class="work-depts">' +
      depts +
      "</div>" +
      renderPeopleTable() +
      renderPersonPicker() +
      renderTemplateEditor(items, Boolean(Number(state.personId))) +
      "</div>"
    );
  }

  function paint(root) {
    ensureStyle();
    var admin = isAdmin();
    var tabs =
      '<div class="work-tabs" role="tablist">' +
      '<button type="button" class="work-tab" data-tab="today" aria-selected="' +
      (state.tab === "today") +
      '">今天工作汇报</button>' +
      (admin
        ? '<button type="button" class="work-tab" data-tab="settings" aria-selected="' +
          (state.tab === "settings") +
          '">部门设置</button>'
        : "") +
      "</div>";
    var body = state.tab === "settings" && admin ? renderSettings() : renderToday();
    var focusKey = state.keepFocus;
    var caret = state.keepCaret;
    state.keepFocus = "";
    state.keepCaret = null;
    root.innerHTML =
      '<main class="page work-page">' +
      '<header class="page-head work-head"><div><p class="kicker">工作汇报</p><h1>工作汇报</h1>' +
      '<p class="work-lead">运营部、人事部、技术部按组织中心责权填报。其他部门不用报。</p></div></header>' +
      tabs +
      '<p class="work-msg' +
      (state.error ? " is-error" : "") +
      '">' +
      esc(state.msg) +
      "</p>" +
      body +
      "</main>";
    if (focusKey) {
      var focused = root.querySelector('[data-keep-focus="' + focusKey + '"]');
      if (focused) {
        focused.focus();
        if (typeof caret === "number" && focused.setSelectionRange) {
          focused.setSelectionRange(caret, caret);
        }
      }
    }
  }

  function collectTemplate(root) {
    var labels = [].slice.call(root.querySelectorAll("[data-tpl-label]"));
    return labels
      .map(function (input, index) {
        return { key: input.getAttribute("data-tpl-key") || "item_" + (index + 1), label: input.value };
      })
      .filter(function (item) {
        return String(item.label || "").trim();
      });
  }

  function collectMine(root) {
    return [].slice.call(root.querySelectorAll("[data-item-key]")).map(function (node) {
      return { key: node.getAttribute("data-item-key"), content: node.value };
    });
  }

  async function reload(root) {
    state.meta = await api("/api/work");
    if (!state.date) {
      state.date = state.meta.today;
    }
    var query = "/api/work/report?date=" + encodeURIComponent(state.date);
    if (state.dept) {
      query += "&dept=" + encodeURIComponent(state.dept);
    }
    state.report = await api(query);
    if (isAdmin()) {
      state.settings = await api("/api/work/settings");
    }
    paint(root);
  }

  function bind(root) {
    root.addEventListener("click", function (event) {
      var tab = event.target.closest("[data-tab]");
      if (tab) {
        state.tab = tab.getAttribute("data-tab") || "today";
        setMsg("");
        if (state.tab === "today") {
          reload(root).catch(function (err) {
            setMsg(err.message, true);
            paint(root);
          });
        } else {
          paint(root);
        }
        return;
      }
      var today = event.target.closest("[data-today]");
      if (today) {
        state.date = todayIso();
        reload(root).catch(function (err) {
          setMsg(err.message, true);
          paint(root);
        });
        return;
      }
      var deptFilter = event.target.closest("[data-dept-filter]");
      if (deptFilter) {
        state.dept = deptFilter.getAttribute("data-dept-filter") || "";
        reload(root).catch(function (err) {
          setMsg(err.message, true);
          paint(root);
        });
        return;
      }
      var settingsDept = event.target.closest("[data-settings-dept]");
      if (settingsDept) {
        state.settingsDept = settingsDept.getAttribute("data-settings-dept") || "ops";
        state.personId = 0;
        paint(root);
        return;
      }
      var scope = event.target.closest("button[data-roster-scope]");
      if (scope) {
        state.rosterScope = scope.getAttribute("data-roster-scope") || "all";
        paint(root);
        return;
      }
      var orgBoard = event.target.closest("button[data-org-board]");
      if (orgBoard) {
        state.orgBoard = orgBoard.getAttribute("data-org-board") || "";
        paint(root);
        return;
      }
      var saveMine = event.target.closest("[data-save-mine]");
      if (saveMine) {
        if (state.saving) {
          return;
        }
        state.saving = true;
        api("/api/work/report", { method: "PUT", body: { date: state.date, items: collectMine(root) } })
          .then(function (data) {
            state.report = data;
            setMsg(state.date === todayIso() ? "今日汇报已保存" : "这一天的汇报已保存");
          })
          .catch(function (err) {
            setMsg(err.message, true);
          })
          .finally(function () {
            state.saving = false;
            paint(root);
          });
        return;
      }
      var add = event.target.closest("[data-tpl-add]");
      if (add) {
        var input = root.querySelector("[data-tpl-new]");
        var label = input ? String(input.value || "").trim() : "";
        if (!label) {
          return;
        }
        var items = collectTemplate(root);
        items.push({ label: label });
        if (Number(state.personId)) {
          state.settings.personTemplates = state.settings.personTemplates || {};
          state.settings.personTemplates[String(state.personId)] = items;
        } else {
          state.settings.templates[state.settingsDept] = items;
        }
        paint(root);
        return;
      }
      var del = event.target.closest("[data-tpl-del]");
      if (del) {
        var index = Number(del.getAttribute("data-tpl-del"));
        var next = collectTemplate(root).filter(function (_item, i) {
          return i !== index;
        });
        if (Number(state.personId)) {
          state.settings.personTemplates[String(state.personId)] = next;
        } else {
          state.settings.templates[state.settingsDept] = next;
        }
        paint(root);
        return;
      }
      var saveTpl = event.target.closest("[data-tpl-save]");
      if (saveTpl) {
        var payload = { items: collectTemplate(root) };
        if (Number(state.personId)) {
          payload.personId = Number(state.personId);
        } else {
          payload.deptCode = state.settingsDept;
        }
        api("/api/work/settings/templates", { method: "PUT", body: payload })
          .then(function (data) {
            state.settings = data;
            setMsg("模板已保存，他们按这个表汇报");
            paint(root);
          })
          .catch(function (err) {
            setMsg(err.message, true);
            paint(root);
          });
        return;
      }
      var reset = event.target.closest("[data-tpl-reset]");
      if (reset && Number(state.personId)) {
        api("/api/work/settings/templates", {
          method: "PUT",
          body: { personId: Number(state.personId), useDept: true, items: deptTemplate(state.settingsDept) }
        })
          .then(function (data) {
            state.settings = data;
            setMsg("已改回部门模板");
            paint(root);
          })
          .catch(function (err) {
            setMsg(err.message, true);
            paint(root);
          });
      }
    });
    root.addEventListener("change", function (event) {
      var date = event.target.closest("[data-work-date]");
      if (date) {
        state.date = date.value || todayIso();
        reload(root).catch(function (err) {
          setMsg(err.message, true);
          paint(root);
        });
        return;
      }
      var person = event.target.closest("[data-person-tpl]");
      if (person) {
        state.personId = Number(person.value || 0);
        paint(root);
        return;
      }
      var assign = event.target.closest("[data-assign]");
      if (assign) {
        var personId = Number(assign.getAttribute("data-assign"));
        var deptCode = assign.checked ? state.settingsDept : "";
        var current = ((state.settings && state.settings.people) || []).find(function (item) {
          return Number(item.id) === personId;
        });
        var prevCode = current ? current.deptCode : "";
        var prevName = current ? current.deptName : "";
        api("/api/work/settings/members", { method: "PUT", body: { personId: personId, deptCode: deptCode } })
          .then(function (data) {
            state.settings = data;
            var nextName = deptLabel(deptCode);
            var msg = "已移出，不用再报";
            if (deptCode && prevCode && prevCode !== deptCode) {
              msg = "已从" + prevName + "改到" + nextName;
            } else if (deptCode) {
              msg = "已加入" + nextName;
            }
            setMsg(msg);
            paint(root);
          })
          .catch(function (err) {
            setMsg(err.message, true);
            assign.checked = !assign.checked;
            paint(root);
          });
      }
    });
    root.addEventListener("input", function (event) {
      var roster = event.target.closest("[data-roster-q]");
      if (roster) {
        state.rosterQuery = roster.value || "";
        applyRosterFilter(root);
        return;
      }
      var boardQuery = event.target.closest("[data-board-q]");
      if (boardQuery) {
        state.boardQuery = boardQuery.value || "";
        applyBoardFilter(root);
      }
    });
  }

  window.XmModules = window.XmModules || {};
  window.XmModules["/work"] = {
    mount: function (root) {
      ensureStyle();
      state.tab = "today";
      state.date = "";
      state.dept = "";
      state.settingsDept = "ops";
      state.personId = 0;
      state.rosterQuery = "";
      state.rosterScope = "all";
      state.orgBoard = "";
      state.boardQuery = "";
      state.keepFocus = "";
      state.msg = "";
      state.error = false;
      root.innerHTML = '<main class="page work-page"><p class="work-empty">正在打开工作汇报…</p></main>';
      if (!root.dataset.workBound) {
        root.dataset.workBound = "1";
        bind(root);
      }
      reload(root).catch(function (err) {
        setMsg(err.message, true);
        paint(root);
      });
      return function unmount() {
        root.innerHTML = "";
      };
    }
  };
})();
