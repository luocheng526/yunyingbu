/* xm-module-work — 工作汇报。部门模板填当天事项，再填店铺日报。 */
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
    diary: null,
    diaryDraft: null,
    diaryDraftDate: "",
    diaryOpen: [],
    diaryShop: "",
    diaryGroup: "goods",
    summary: null,
    duty: null,
    diarySettings: null,
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
      ".work-page{color:var(--xm-ink);font-size:13px;}" +
      ".work-bar{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:0 0 10px;}" +
      ".work-page h1{margin:0;font-size:18px;font-weight:650;}" +
      ".work-lead{margin:4px 0 0;color:var(--xm-muted);font-size:12px;}" +
      ".work-page h2{margin:0 0 6px;padding:0;font-size:13px;font-weight:650;}" +
      ".work-page h3{margin:0 0 6px;font-size:13px;font-weight:650;}" +
      ".work-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 10px;}" +
      ".work-tab{appearance:none;border:1px solid var(--xm-line);border-radius:8px;background:var(--xm-card);color:var(--xm-ink);font:inherit;font-size:13px;padding:6px 12px;cursor:pointer;white-space:nowrap;}" +
      ".work-tab[aria-selected='true']{border:0;color:#fff;font-weight:650;background:linear-gradient(90deg,#245bdb,#4b7cff);box-shadow:0 6px 14px rgba(36,91,219,.18);}" +
      ".work-page button:focus-visible,.work-page input:focus-visible,.work-page select:focus-visible,.work-page textarea:focus-visible{outline:2px solid var(--xm-primary);outline-offset:1px;}" +
      ".work-panel{display:flex;flex-direction:column;gap:8px;}" +
      ".work-split{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:8px;align-items:start;}" +
      ".work-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;}" +
      ".work-kpi{border:0;border-radius:12px;min-height:92px;padding:14px 14px 12px;color:#fff;display:flex;flex-direction:column;justify-content:flex-end;box-shadow:0 8px 18px rgba(22,119,255,.12);}" +
      ".work-kpi b,.work-kpi strong{display:block;font-size:28px;line-height:1;font-weight:700;font-variant-numeric:tabular-nums;color:#fff;}" +
      ".work-kpi span{display:block;margin-top:8px;color:rgba(255,255,255,.92);font-size:13px;font-weight:600;}" +
      ".work-c0{background:linear-gradient(135deg,#2f6fe4,#5b94f5);}" +
      ".work-c1{background:linear-gradient(135deg,#1faa5a,#3dce78);}" +
      ".work-c2{background:linear-gradient(135deg,#f08a1e,#ffb04a);}" +
      ".work-c3{background:linear-gradient(135deg,#7468ff,#9b8cff);}" +
      ".work-c4{background:linear-gradient(135deg,#1fb8c9,#2fd3c0);}" +
      ".work-c5{background:linear-gradient(135deg,#e23b3b,#ff6b6b);}" +
      ".work-card{background:var(--xm-card);border:1px solid var(--xm-line);border-radius:12px;box-shadow:var(--xm-shadow);padding:10px 12px;}" +
      ".work-cardhead{display:flex;justify-content:space-between;gap:8px;align-items:flex-end;flex-wrap:wrap;margin:0 0 8px;}" +
      ".work-tools{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;}" +
      ".work-form{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;}" +
      ".work-field{display:flex;flex-direction:column;gap:4px;min-width:140px;color:var(--xm-muted);font-size:12px;}" +
      ".work-field input,.work-field select,.work-tools select{height:28px;border:1px solid var(--xm-line);border-radius:6px;background:var(--xm-card);color:var(--xm-ink);padding:0 8px;font:inherit;font-size:12px;}" +
      ".work-field textarea,.work-table textarea{min-height:56px;width:100%;border:1px solid var(--xm-line);border-radius:6px;background:var(--xm-card);color:var(--xm-ink);padding:6px 8px;font:inherit;font-size:13px;resize:vertical;box-sizing:border-box;}" +
      ".work-primary{height:28px;border:0;border-radius:6px;background:var(--xm-primary);color:#fff;padding:0 12px;font:inherit;font-size:12px;cursor:pointer;}" +
      ".work-primary:disabled{opacity:.6;cursor:default;}" +
      ".work-mini{height:26px;border:1px solid var(--xm-line);border-radius:6px;background:var(--xm-card);color:var(--xm-ink);padding:0 8px;font:inherit;font-size:12px;cursor:pointer;}" +
      ".work-mini.is-on{border:0;color:#fff;background:linear-gradient(90deg,#245bdb,#4b7cff);}" +
      ".work-table-wrap{overflow:auto;}" +
      ".work-roster-scroll{max-height:360px;overflow:auto;}" +
      ".work-table{width:100%;border-collapse:collapse;font-size:12px;}" +
      ".work-table th{text-align:left;color:var(--xm-muted);font-weight:600;padding:4px 6px;border-bottom:1px solid var(--xm-line);white-space:nowrap;}" +
      ".work-table td{padding:4px 6px;border-bottom:1px solid var(--xm-line);vertical-align:middle;}" +
      "td.work-check{width:48px;text-align:center;}" +
      "td.work-check input{width:16px;height:16px;margin:0;accent-color:var(--xm-primary);cursor:pointer;}" +
      ".work-empty{padding:28px 12px;text-align:center;color:var(--xm-muted);}" +
      ".work-empty b{display:block;margin-bottom:6px;font-size:15px;color:var(--xm-ink);}" +
      ".work-msg{min-height:16px;margin:0 0 6px;color:var(--xm-muted);font-size:12px;}" +
      ".work-msg.is-error{color:#cf1322;}" +
      ".work-ok{color:#12b36a;font-weight:650;white-space:nowrap;}" +
      ".work-miss{color:#cf1322;font-weight:650;white-space:nowrap;}" +
      ".work-depts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;}" +
      ".work-dept{min-height:88px;text-align:left;border:0;border-radius:12px;padding:14px;cursor:pointer;color:#fff;font:inherit;box-shadow:0 8px 18px rgba(22,119,255,.12);}" +
      ".work-dept.is-on{box-shadow:0 0 0 3px #fff,0 0 0 5px rgba(20,40,80,.45);}" +
      ".work-dept b{display:block;font-size:16px;font-weight:700;}" +
      ".work-dept span{display:block;margin-top:6px;color:rgba(255,255,255,.9);font-size:12px;}" +
      ".work-head{display:flex;justify-content:space-between;gap:8px;align-items:flex-end;flex-wrap:wrap;}" +
      ".work-muted{color:var(--xm-muted);font-size:12px;}" +
      ".work-filters{display:flex;flex-direction:row;flex-wrap:wrap;gap:8px;align-items:center;}" +
      ".work-filters .work-mini{flex:none;width:auto;}" +
      ".work-chiprow{display:flex;flex-wrap:wrap;gap:8px;align-items:center;}" +
      ".work-boardbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;color:#fff;margin:0 0 8px;padding:10px 12px;border-radius:12px;background:linear-gradient(90deg,#245bdb,#4b7cff);}" +
      ".work-boardbar strong{font-size:14px;font-weight:700;}" +
      ".work-boardbar span{flex:1;font-size:12px;opacity:.92;}" +
      ".work-boardbar .work-mini{background:#fff;color:#245bdb;border:0;font-weight:650;}" +
      ".work-boardbar .work-mini.is-on{background:#163a86;color:#fff;}" +
      ".work-boardbar select{height:26px;border:0;border-radius:6px;padding:0 8px;font:inherit;font-size:12px;}" +
      ".work-sub{display:block;margin-top:2px;font-size:12px;line-height:1.45;opacity:.92;}" +
      ".work-duty{min-width:140px;max-width:280px;white-space:normal;line-height:1.45;}" +
      ".work-count{margin-left:auto;color:var(--xm-muted);font-size:12px;}" +
      ".work-field.is-grow{flex:1;min-width:200px;}" +
      ".work-table td.work-rights{max-width:280px;white-space:normal;}" +
      ".work-checks{display:flex;flex-wrap:wrap;gap:8px 14px;margin:0 0 8px;}" +
      ".work-checks label{display:flex;align-items:center;gap:6px;font-size:13px;}" +
      ".work-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}" +
      ".work-lane{background:rgba(36,91,219,.06);border:1px solid var(--xm-line);border-radius:10px;padding:8px 10px;}" +
      ".work-card .work-chiprow,.work-card .work-filters{margin-top:8px;}" +
      ".work-diary-item{display:grid;grid-template-columns:minmax(88px,1fr) 72px 28px auto;gap:6px;align-items:center;padding:6px 0;border-bottom:1px solid var(--xm-line);}" +
      ".work-diary-item small{color:var(--xm-muted);font-size:12px;}" +
      ".work-diary-more{grid-column:1 / -1;display:flex;flex-direction:column;gap:8px;padding:4px 0 8px;}" +
      ".work-diary-more[hidden]{display:none;}" +
      ".work-shot{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}" +
      ".work-shot img{max-width:148px;max-height:72px;object-fit:cover;border:0;border-radius:8px;}" +
      ".work-people{display:flex;flex-direction:column;gap:8px;}" +
      ".work-person{color:#fff;border-radius:12px;padding:12px 14px;box-shadow:0 8px 18px rgba(20,40,80,.12);display:flex;align-items:center;gap:16px;}" +
      ".work-person.tone-ok{background:linear-gradient(90deg,#1faa5a,#3dce78);}" +
      ".work-person.tone-miss{background:linear-gradient(90deg,#e23b3b,#ff6b6b);}" +
      ".work-person.tone-rest{background:linear-gradient(90deg,#f08a1e,#ffb04a);}" +
      ".work-person.tone-free{background:linear-gradient(90deg,#2f6fe4,#5b94f5);}" +
      ".work-who{flex:0 0 140px;min-width:0;}" +
      ".work-who b{display:block;font-size:16px;}" +
      ".work-who span,.work-main{font-size:12px;color:rgba(255,255,255,.92);line-height:1.45;}" +
      ".work-main{flex:1;min-width:0;}" +
      ".work-person .work-mini{background:#fff;color:#245bdb;border:0;font-weight:650;}" +
      "@media (max-width:980px){.work-stats,.work-depts{grid-template-columns:repeat(2,minmax(0,1fr));}.work-split,.work-grid{grid-template-columns:1fr;}.work-person{flex-wrap:wrap;align-items:flex-start;}.work-count{margin-left:0;}.work-diary-item{grid-template-columns:1fr;}}";
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

  function kpi(index, value, label) {
    return (
      '<article class="work-kpi work-c' +
      index +
      '"><b>' +
      esc(value) +
      "</b><span>" +
      esc(label) +
      "</span></article>"
    );
  }

  function renderKpis() {
    var sum = (state.report && state.report.summary) || { should: 0, done: 0, miss: 0 };
    return '<div class="work-stats">' + kpi(0, sum.should, "应报人数") + kpi(1, sum.done, "已报") + kpi(5, sum.miss, "未报") + "</div>";
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
      '<div class="work-table-wrap"><table class="work-table"><thead><tr><th>工作事项</th><th>今日工作</th></tr></thead><tbody>' +
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
                  (row.statusNote ? '<span class="work-sub">' + esc(row.statusNote) + "</span>" : "") +
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

  function diarySections() {
    var nodes = (state.diary && state.diary.catalog && state.diary.catalog.nodes) || [];
    return nodes.filter(function (node) {
      return node.kind === "section" && node.enabled !== false;
    });
  }

  function diaryNodes(kind, parent) {
    var nodes = (state.diary && state.diary.catalog && state.diary.catalog.nodes) || [];
    return nodes.filter(function (node) {
      return node.kind === kind && node.parent === parent && node.enabled !== false;
    });
  }

  function syncDiaryDraft() {
    var pack = state.diary || { shops: [], mine: [], sharedLabels: [] };
    if (state.diaryDraftDate === state.date && state.diaryDraft) {
      return;
    }
    var draft = {};
    var open = [];
    (pack.mine || []).forEach(function (row) {
      if (!row.shopId || row.shopId === "__personal__") {
        return;
      }
      open.push(String(row.shopId));
      draft[String(row.shopId)] = JSON.parse(JSON.stringify(row));
    });
    if (!open.length && pack.shops && pack.shops[0]) {
      open = [String(pack.shops[0].id)];
    }
    open.forEach(function (id) {
      if (!draft[id]) {
        draft[id] = { shopId: id, revision: 0, status: "未填报", items: {}, extra: [], notes: "", proofs: {} };
      }
    });
    state.diaryDraft = draft;
    state.diaryOpen = open;
    state.diaryDraftDate = state.date;
    if (!state.diaryShop || open.indexOf(state.diaryShop) < 0) {
      state.diaryShop = open[0] || "";
    }
  }

  function activeDraft() {
    syncDiaryDraft();
    return state.diaryDraft[state.diaryShop] || null;
  }

  function metricRow(node, item) {
    var shared = ((state.diary && state.diary.sharedLabels) || []).indexOf(node.name) >= 0;
    if (shared) {
      return (
        '<p class="work-muted">「' +
        esc(node.name) +
        "」和上面的部门事项是同一项，只填一次。</p>"
      );
    }
    var current = item || {};
    var images = current.images || [];
    var choices = diaryNodes("choice", node.id);
    var yesNo = node.id === "报名活动" || node.id === "一键低价商品";
    var late = node.id === "即将超时订单";
    return (
      '<div class="work-diary-item" data-metric="' +
      esc(node.id) +
      '"><span>' +
      esc(node.name) +
      '</span><input data-diary-count type="number" min="0" max="100000" step="1" value="' +
      esc(current.count || "") +
      '">' +
      (node.unit ? "<small>" + esc(node.unit) + "</small>" : "<small></small>") +
      '<button type="button" class="work-mini" data-diary-more>明细</button>' +
      '<div class="work-diary-more" hidden>' +
      (yesNo
        ? '<label class="work-field">是否全部完成<select data-diary-detail><option value=""></option><option' +
          (current.detail === "是" ? " selected" : "") +
          '>是</option><option' +
          (current.detail === "否" ? " selected" : "") +
          ">否</option></select></label>"
        : '<label class="work-field">' +
          (late ? "即将超时原因" : "工作明细") +
          '<input data-diary-detail value="' +
          esc(current.detail || "") +
          '" maxlength="600"></label>') +
      '<label class="work-field">相关 SPU<input data-diary-spu value="' +
      esc(current.spus || "") +
      '" maxlength="2200" placeholder="多个 SPU 用逗号分隔"></label>' +
      (choices.length
        ? '<div class="work-checks">' +
          choices
            .map(function (choice) {
              var on = (current.actions || []).indexOf(choice.id) >= 0;
              return (
                '<label><input type="checkbox" data-diary-choice value="' +
                esc(choice.id) +
                '"' +
                (on ? " checked" : "") +
                ">" +
                esc(choice.name) +
                "</label>"
              );
            })
            .join("") +
          "</div>"
        : "") +
      '<div class="work-shot" data-diary-images>' +
      images
        .map(function (image) {
          return (
            '<button type="button" class="work-mini" data-preview-image="' +
            esc(image.id) +
            '">查看截图 · ' +
            esc(image.name) +
            '</button><button type="button" class="work-mini" data-remove-image="' +
            esc(image.id) +
            '">移除</button>'
          );
        })
        .join("") +
      '<label class="work-mini">添加截图<input data-diary-file type="file" accept="image/png,image/jpeg,image/webp" hidden></label>' +
      "</div></div></div>"
    );
  }

  function renderDiaryFill() {
    var pack = state.diary;
    if (!pack) {
      return "";
    }
    var shops = pack.shops || [];
    if (!shops.length) {
      return "";
    }
    syncDiaryDraft();
    var draft = activeDraft();
    var sections = diarySections();
    if (sections.every(function (section) { return section.id !== state.diaryGroup; })) {
      state.diaryGroup = sections[0] ? sections[0].id : "goods";
    }
    var lanes = diaryNodes("lane", state.diaryGroup);
    var fields = "";
    lanes.forEach(function (lane) {
      var metrics = diaryNodes("metric", lane.id);
      var extras = diaryNodes("extra", lane.id);
      var notes = diaryNodes("note", lane.id);
      fields +=
        '<section class="work-lane"><h3>' +
        esc(lane.name) +
        "</h3>" +
        metrics
          .map(function (node) {
            return metricRow(node, (draft && draft.items && draft.items[node.id]) || {});
          })
          .join("") +
        (extras.length
          ? '<div class="work-checks">' +
            extras
              .map(function (node) {
                var on = draft && (draft.extra || []).indexOf(node.id) >= 0;
                return (
                  '<label><input type="checkbox" data-diary-extra value="' +
                  esc(node.id) +
                  '"' +
                  (on ? " checked" : "") +
                  ">" +
                  esc(node.name) +
                  "</label>"
                );
              })
              .join("") +
            "</div>"
          : "") +
        notes
          .map(function () {
            return (
              '<label class="work-field">备注<textarea data-diary-notes maxlength="2000">' +
              esc((draft && draft.notes) || "") +
              "</textarea></label>"
            );
          })
          .join("") +
        "</section>";
    });
    var remaining = shops.filter(function (shop) {
      return state.diaryOpen.indexOf(String(shop.id)) < 0;
    });
    return (
      '<section class="work-card"><div class="work-boardbar"><strong>店铺日报</strong><span>同一天可以填多家店，草稿刷新还在。</span></div>' +
      '<div class="work-chiprow">' +
      state.diaryOpen
        .map(function (id) {
          var shop = shops.find(function (item) { return String(item.id) === id; });
          return (
            '<button type="button" class="work-mini' +
            (id === state.diaryShop ? " is-on" : "") +
            '" data-diary-shop="' +
            esc(id) +
            '">' +
            esc(shop ? shop.name : id) +
            "</button>"
          );
        })
        .join("") +
      (remaining.length
        ? '<select data-add-shop><option value="">＋ 添加店铺</option>' +
          remaining
            .map(function (shop) {
              return '<option value="' + esc(shop.id) + '">' + esc(shop.name) + "</option>";
            })
            .join("") +
          "</select>"
        : "") +
      (state.diaryShop
        ? '<button type="button" class="work-mini" data-remove-shop="' + esc(state.diaryShop) + '">移出当前店</button>'
        : "") +
      "</div>" +
      '<div class="work-chiprow">' +
      sections
        .map(function (section) {
          return (
            '<button type="button" class="work-mini' +
            (section.id === state.diaryGroup ? " is-on" : "") +
            '" data-diary-group="' +
            esc(section.id) +
            '">' +
            esc(section.name) +
            "</button>"
          );
        })
        .join("") +
      "</div>" +
      '<div class="work-grid">' +
      fields +
      "</div>" +
      '<div class="work-filters"><button type="button" class="work-mini" data-diary-save="草稿">保存草稿</button><button type="button" class="work-primary" data-diary-save="已提交">提交日报</button><span class="work-muted">' +
      esc(draft && draft.status ? draft.status : "") +
      "</span></div></section>"
    );
  }

  function renderSummary() {
    var data = state.summary;
    if (!data) {
      return '<div class="work-card"><div class="work-empty">正在读取工作汇总…</div></div>';
    }
    var metrics = (data.metrics || [])
      .map(function (item, index) {
        return kpi(index % 5, item.total, item.name);
      })
      .join("");
    var rows = (data.rows || [])
      .map(function (row) {
        return (
          "<tr><td>" +
          esc(row.day) +
          "</td><td>" +
          esc(row.personName) +
          "</td><td>" +
          esc(row.shopName) +
          "</td><td>" +
          esc(row.status) +
          "</td><td>" +
          esc(row.notes || "—") +
          "</td></tr>"
        );
      })
      .join("");
    return (
      '<div class="work-panel"><div class="work-stats">' +
      kpi(0, data.reportCount, "已交日报") +
      kpi(1, data.peopleCount, "已报人数") +
      kpi(4, data.shopCount, "店铺数") +
      "</div>" +
      '<div class="work-card"><h2>工作量</h2><div class="work-stats">' +
      metrics +
      "</div></div>" +
      '<div class="work-card work-table-wrap"><table class="work-table"><thead><tr><th>日期</th><th>填报人</th><th>店铺</th><th>状态</th><th>备注</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="5" class="work-empty">这段时间还没有已提交的店铺日报。</td></tr>') +
      "</tbody></table></div></div>"
    );
  }

  function renderDuty() {
    var data = state.duty;
    if (!data) {
      return '<div class="work-card"><div class="work-empty">正在读取提交情况…</div></div>';
    }
    var sum = data.summary || {};
    function tone(status) {
      if (status === "已报") {
        return "tone-ok";
      }
      if (status === "未报") {
        return "tone-miss";
      }
      if (status === "免报") {
        return "tone-rest";
      }
      return "tone-free";
    }
    var rows = (data.rows || [])
      .map(function (row) {
        var rest =
          row.status !== "自愿"
            ? '<button type="button" class="work-mini" data-rest="' +
              esc(row.personId) +
              '" data-rest-on="' +
              (row.status === "免报" ? "0" : "1") +
              '">' +
              (row.status === "免报" ? "取消休息" : "登记休息") +
              "</button>"
            : "";
        return (
          '<article class="work-person ' +
          tone(row.status) +
          '"><div class="work-who"><b>' +
          esc(row.name) +
          "</b><span>" +
          esc(row.role || "—") +
          " · " +
          esc(row.deptName || "—") +
          '</span></div><div class="work-main">部门事项 ' +
          esc(row.template) +
          " · 店铺日报 " +
          esc(row.diary) +
          " · 已交店 " +
          esc(row.shops) +
          "<br>" +
          esc(row.status) +
          (row.note ? '<span class="work-sub">' + esc(row.note) + "</span>" : "") +
          "</div>" +
          rest +
          "</article>"
        );
      })
      .join("");
    return (
      '<div class="work-panel"><div class="work-stats">' +
      kpi(0, sum.should || 0, "应报人数") +
      kpi(1, sum.done || 0, "已报人数") +
      kpi(5, sum.miss || 0, "未报人数") +
      kpi(2, sum.exempt || 0, "免报") +
      kpi(4, sum.shops || 0, "已交店铺数") +
      "</div>" +
      '<div class="work-people">' +
      (rows || '<div class="work-card"><div class="work-empty"><b>这一天没有需要汇报的人</b></div></div>') +
      "</div></div>"
    );
  }

  function renderDiarySettings() {
    var data = state.diarySettings;
    if (!data) {
      return '<div class="work-card"><div class="work-empty">正在读取日报设置…</div></div>';
    }
    var policy = data.policy || {};
    var positions = (policy.options || [])
      .map(function (item) {
        var on = (policy.positions || []).indexOf(item) >= 0;
        return (
          '<label><input type="checkbox" data-position value="' +
          esc(item) +
          '"' +
          (on ? " checked" : "") +
          "> " +
          esc(item === "助理" ? "运营助理" : item) +
          "</label>"
        );
      })
      .join("");
    var delivery = policy.delivery || {};
    var catalogNodes = (data.catalog && data.catalog.nodes) || [];
    function sectionTitle(node) {
      var current = node;
      var guard = 0;
      while (current && current.kind !== "section" && guard < 6) {
        current = catalogNodes.find(function (item) {
          return item.id === current.parent;
        });
        guard += 1;
      }
      return current && current.kind === "section" ? current.name : "";
    }
    var nodes = catalogNodes
      .filter(function (node) {
        return node.kind === "metric" || node.kind === "extra" || node.kind === "note";
      })
      .map(function (node, index) {
        return (
          '<tr data-catalog-row="' +
          index +
          '"><td>' +
          esc(sectionTitle(node)) +
          '</td><td><input data-catalog-name value="' +
          esc(node.name) +
          '"></td><td><input data-catalog-unit value="' +
          esc(node.unit || "") +
          '"></td><td><input type="checkbox" data-catalog-on' +
          (node.enabled !== false ? " checked" : "") +
          "></td></tr>"
        );
      })
      .join("");
    return (
      '<div class="work-panel"><div class="work-card"><h2>必须提交店铺日报的岗位</h2><p class="work-lead">勾选岗位、并且已经排进运营部、人事部或技术部、名下有店的人，当天要交店铺日报。登记休息后当天免报。移出汇报名单的人不再计入部门应报。</p><div class="work-checks">' +
      positions +
      '</div><button type="button" class="work-primary" data-save-positions>保存岗位设置</button></div>' +
      '<div class="work-card"><h2>考勤与提醒</h2><p class="work-lead">新站还没有钉钉企业应用，休息登记在这里生效，提醒不会发到钉钉。</p><div class="work-checks"><label><input type="checkbox" data-delivery="useSchedule"' +
      (delivery.useSchedule ? " checked" : "") +
      '> 按钉钉排班识别休息日</label><label><input type="checkbox" data-delivery="useLeave"' +
      (delivery.useLeave ? " checked" : "") +
      '> 按钉钉请假记录识别已批休假</label><label><input type="checkbox" data-delivery="remind"' +
      (delivery.remind ? " checked" : "") +
      '> 提醒未交日报</label></div><label class="work-field">每日提醒时间（北京时间）<input data-remind-at type="time" value="' +
      esc(delivery.remindAt || "18:00") +
      '"></label><button type="button" class="work-primary" data-save-delivery>保存考勤与提醒</button></div>' +
      '<div class="work-card"><h2>填报项目</h2><p class="work-lead">四个栏目：商品与评价、活动与库存、订单处理、其他与备注。停用后，已经提交的记录仍可在工作汇总里看。</p><div class="work-table-wrap"><table class="work-table"><thead><tr><th>栏目</th><th>名称</th><th>单位</th><th>启用</th></tr></thead><tbody>' +
      nodes +
      '</tbody></table></div><button type="button" class="work-primary" data-save-catalog>保存填报内容</button></div></div>'
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
    var hasShops = Boolean(state.diary && state.diary.shops && state.diary.shops.length);
    var skip = state.report && state.report.needReport === false && !isAdmin() && !hasShops;
    var fillBlock = "";
    if (skip) {
      fillBlock = '<div class="work-card"><div class="work-empty">你所在部门不需要工作汇报。</div></div>';
    } else if (canFill) {
      fillBlock =
        '<section class="work-card"><div class="work-cardhead"><div><h2>' +
        esc(dateLabel(date)) +
        (mine.deptName ? " · " + esc(mine.deptName) : "") +
        '</h2><p class="work-lead">按罗成配好的模板填，一天一张表。</p></div>' +
        '<button type="button" class="work-primary" data-save-mine>保存这一天</button></div>' +
        renderFillTable(mine, true) +
        "</section>";
    } else if (!isAdmin()) {
      fillBlock = '<div class="work-card"><div class="work-empty">今天没有需要填的事项。</div></div>';
    }
    var shown = reportRows().length;
    var total = ((state.report && state.report.rows) || []).length;
    var board = isAdmin()
      ? '<div class="work-card"><div class="work-filters"><span class="work-muted">部门</span>' +
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
        "</span></div></div>" +
        renderAdminTable(date)
      : "";
    var diary = renderDiaryFill();
    var main = fillBlock && diary ? '<div class="work-split">' + fillBlock + diary + "</div>" : fillBlock + diary;
    return (
      '<div class="work-panel">' +
      '<div class="work-tools">' +
      '<label class="work-field">日期<input type="date" data-work-date min="2020-01-01" max="2099-12-31" value="' +
      esc(date) +
      '"></label>' +
      '<button type="button" class="work-mini" data-today>今天</button>' +
      "</div>" +
      (isAdmin() ? renderKpis() : "") +
      main +
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
      '<p class="work-lead">' +
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
      '<p class="work-lead">名单来自组织中心在职人员。组织部门只作参考：人事和技术在那边是同一张表，这里要拆成人事部或技术部。勾上的人才按当前部门的模板每天填表。</p>' +
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
      .map(function (item, index) {
        return (
          '<button type="button" class="work-dept work-c' +
          (index % 3) +
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
    var leader = Boolean(state.diary && state.diary.leader);
    var tabs =
      '<div class="work-tabs" role="tablist">' +
      '<button type="button" class="work-tab" data-tab="today" aria-selected="' +
      (state.tab === "today") +
      '">今天工作汇报</button>' +
      '<button type="button" class="work-tab" data-tab="summary" aria-selected="' +
      (state.tab === "summary") +
      '">工作汇总</button>' +
      (leader
        ? '<button type="button" class="work-tab" data-tab="duty" aria-selected="' +
          (state.tab === "duty") +
          '">提交情况</button>'
        : "") +
      (admin
        ? '<button type="button" class="work-tab" data-tab="settings" aria-selected="' +
          (state.tab === "settings") +
          '">部门设置</button>' +
          '<button type="button" class="work-tab" data-tab="diarySettings" aria-selected="' +
          (state.tab === "diarySettings") +
          '">日报设置</button>'
        : "") +
      "</div>";
    var body =
      state.tab === "settings" && admin
        ? renderSettings()
        : state.tab === "summary"
          ? renderSummary()
          : state.tab === "duty" && leader
            ? renderDuty()
            : state.tab === "diarySettings" && admin
              ? renderDiarySettings()
              : renderToday();
    var focusKey = state.keepFocus;
    var caret = state.keepCaret;
    state.keepFocus = "";
    state.keepCaret = null;
    root.innerHTML =
      '<main class="page work-page">' +
      '<div class="work-bar"><div><h1>工作汇报</h1>' +
      '<p class="work-lead">先填部门模板里的今日事项，再填自己负责的店铺日报。人数按人计，店铺按店计。</p></div></div>' +
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
    state.diaryDraftDate = "";
    state.diary = await api("/api/work/diary?date=" + encodeURIComponent(state.date));
    if (isAdmin()) {
      state.settings = await api("/api/work/settings");
    }
    if (state.tab === "summary") {
      state.summary = await api("/api/work/diary/summary?from=" + encodeURIComponent(state.date) + "&to=" + encodeURIComponent(state.date));
    }
    if (state.tab === "duty" && state.diary.leader) {
      state.duty = await api("/api/work/diary/duty?date=" + encodeURIComponent(state.date));
    }
    if (state.tab === "diarySettings" && isAdmin()) {
      state.diarySettings = await api("/api/work/diary/settings");
    }
    paint(root);
  }

  function readDiarySheet(root) {
    syncDiaryDraft();
    var draft = state.diaryDraft[state.diaryShop];
    if (!draft) {
      return;
    }
    draft.items = draft.items || {};
    [].slice.call(root.querySelectorAll("[data-metric]")).forEach(function (row) {
      var id = row.getAttribute("data-metric");
      var countNode = row.querySelector("[data-diary-count]");
      var detailNode = row.querySelector("[data-diary-detail]");
      var spuNode = row.querySelector("[data-diary-spu]");
      var previous = draft.items[id] || {};
      draft.items[id] = {
        count: countNode ? Number(countNode.value) || 0 : previous.count || 0,
        detail: detailNode ? detailNode.value : previous.detail || "",
        spus: spuNode ? spuNode.value : previous.spus || "",
        actions: [].slice.call(row.querySelectorAll("[data-diary-choice]:checked")).map(function (box) {
          return box.value;
        }),
        images: previous.images || []
      };
    });
    var notes = root.querySelector("[data-diary-notes]");
    if (notes) {
      draft.notes = notes.value;
    }
    var extras = [].slice.call(root.querySelectorAll("[data-diary-extra]"));
    if (extras.length) {
      draft.extra = extras
        .filter(function (box) {
          return box.checked;
        })
        .map(function (box) {
          return box.value;
        });
    }
  }

  function bind(root) {
    root.addEventListener("click", function (event) {
      var tab = event.target.closest("[data-tab]");
      if (tab) {
        state.tab = tab.getAttribute("data-tab") || "today";
        setMsg("");
        reload(root).catch(function (err) {
          setMsg(err.message, true);
          paint(root);
        });
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
      var diaryShop = event.target.closest("[data-diary-shop]");
      if (diaryShop) {
        readDiarySheet(root);
        state.diaryShop = diaryShop.getAttribute("data-diary-shop") || "";
        paint(root);
        return;
      }
      var diaryGroup = event.target.closest("[data-diary-group]");
      if (diaryGroup) {
        readDiarySheet(root);
        state.diaryGroup = diaryGroup.getAttribute("data-diary-group") || "goods";
        paint(root);
        return;
      }
      var more = event.target.closest("[data-diary-more]");
      if (more) {
        var box = more.parentNode.querySelector(".work-diary-more");
        if (box) {
          box.hidden = !box.hidden;
        }
        return;
      }
      var removeShop = event.target.closest("[data-remove-shop]");
      if (removeShop) {
        readDiarySheet(root);
        var removeId = removeShop.getAttribute("data-remove-shop");
        state.diaryOpen = state.diaryOpen.filter(function (id) { return id !== removeId; });
        delete state.diaryDraft[removeId];
        state.diaryShop = state.diaryOpen[0] || "";
        paint(root);
        return;
      }
      var saveDiaryBtn = event.target.closest("[data-diary-save]");
      if (saveDiaryBtn) {
        readDiarySheet(root);
        var reports = state.diaryOpen.map(function (id) {
          var row = state.diaryDraft[id] || { shopId: id, revision: 0, items: {}, extra: [], notes: "", proofs: {} };
          return {
            shopId: id,
            revision: row.revision || 0,
            items: row.items || {},
            extra: row.extra || [],
            notes: row.notes || "",
            proofs: row.proofs || {}
          };
        });
        api("/api/work/diary", {
          method: "PUT",
          body: { date: state.date, status: saveDiaryBtn.getAttribute("data-diary-save"), reports: reports }
        })
          .then(function () {
            setMsg(saveDiaryBtn.getAttribute("data-diary-save") === "草稿" ? "草稿已保存" : "日报已提交");
            return reload(root);
          })
          .catch(function (err) {
            setMsg(err.message, true);
            paint(root);
          });
        return;
      }
      var preview = event.target.closest("[data-preview-image]");
      if (preview) {
        api("/api/work/diary/image?id=" + encodeURIComponent(preview.getAttribute("data-preview-image")))
          .then(function (image) {
            var img = document.createElement("img");
            img.alt = image.name || "截图";
            img.src = "data:" + image.mime + ";base64," + image.data;
            preview.parentNode.appendChild(img);
          })
          .catch(function (err) {
            setMsg(err.message, true);
            paint(root);
          });
        return;
      }
      var restBtn = event.target.closest("[data-rest]");
      if (restBtn) {
        api("/api/work/diary/rest", {
          method: "PUT",
          body: {
            date: state.date,
            personId: Number(restBtn.getAttribute("data-rest")),
            rest: restBtn.getAttribute("data-rest-on") === "1"
          }
        })
          .then(function (data) {
            state.duty = data;
            setMsg(restBtn.getAttribute("data-rest-on") === "1" ? "已登记休息" : "已取消休息");
            paint(root);
          })
          .catch(function (err) {
            setMsg(err.message, true);
            paint(root);
          });
        return;
      }
      var savePositions = event.target.closest("[data-save-positions]");
      if (savePositions) {
        api("/api/work/diary/settings", {
          method: "PUT",
          body: {
            revision: state.diarySettings.policy.revision,
            positions: [].slice.call(root.querySelectorAll("[data-position]:checked")).map(function (box) { return box.value; })
          }
        })
          .then(function (data) {
            state.diarySettings = data;
            setMsg("日报岗位设置已保存");
            paint(root);
          })
          .catch(function (err) {
            setMsg(err.message, true);
            paint(root);
          });
        return;
      }
      var saveDelivery = event.target.closest("[data-save-delivery]");
      if (saveDelivery) {
        var delivery = {};
        [].slice.call(root.querySelectorAll("[data-delivery]")).forEach(function (box) {
          delivery[box.getAttribute("data-delivery")] = box.checked;
        });
        delivery.remindAt = (root.querySelector("[data-remind-at]") || {}).value || "18:00";
        api("/api/work/diary/settings", {
          method: "PUT",
          body: { delivery: delivery }
        })
          .then(function (data) {
            state.diarySettings = data;
            setMsg("考勤与提醒已保存。钉钉企业应用未接入，不会外发。");
            paint(root);
          })
          .catch(function (err) {
            setMsg(err.message, true);
            paint(root);
          });
        return;
      }
      var saveCatalog = event.target.closest("[data-save-catalog]");
      if (saveCatalog) {
        var catalog = JSON.parse(JSON.stringify(state.diarySettings.catalog));
        var editable = catalog.nodes.filter(function (node) {
          return node.kind === "metric" || node.kind === "extra" || node.kind === "note";
        });
        [].slice.call(root.querySelectorAll("[data-catalog-row]")).forEach(function (row, index) {
          if (!editable[index]) {
            return;
          }
          editable[index].name = row.querySelector("[data-catalog-name]").value;
          editable[index].unit = row.querySelector("[data-catalog-unit]").value;
          editable[index].enabled = row.querySelector("[data-catalog-on]").checked;
        });
        api("/api/work/diary/settings", { method: "PUT", body: { catalog: catalog } })
          .then(function (data) {
            state.diarySettings = data;
            setMsg("填报内容已保存");
            paint(root);
          })
          .catch(function (err) {
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
    root.addEventListener("change", function (event) {
      var addShop = event.target.closest("[data-add-shop]");
      if (addShop && addShop.value) {
        readDiarySheet(root);
        var id = String(addShop.value);
        if (state.diaryOpen.indexOf(id) < 0) {
          state.diaryOpen.push(id);
          state.diaryDraft[id] = state.diaryDraft[id] || {
            shopId: id,
            revision: 0,
            status: "未填报",
            items: {},
            extra: [],
            notes: "",
            proofs: {}
          };
        }
        state.diaryShop = id;
        paint(root);
        return;
      }
      var file = event.target.closest("[data-diary-file]");
      if (file && file.files && file.files[0]) {
        var metric = file.closest("[data-metric]");
        var fieldKey = metric ? metric.getAttribute("data-metric") : "备注";
        var picked = file.files[0];
        var form = new FormData();
        form.append("date", state.date);
        form.append("shopId", state.diaryShop);
        form.append("fieldKey", fieldKey);
        form.append("file", picked, picked.name);
        fetch("/api/work/diary/image", { method: "POST", credentials: "same-origin", body: form })
          .then(function (res) {
            return res.json().then(function (data) {
              if (!res.ok || data.ok === false) {
                throw new Error(data.error || "截图上传失败");
              }
              return data;
            });
          })
          .then(function (saved) {
            readDiarySheet(root);
            var draft = state.diaryDraft[state.diaryShop];
            draft.items[fieldKey] = draft.items[fieldKey] || { count: 0, detail: "", spus: "", actions: [], images: [] };
            draft.items[fieldKey].images = (draft.items[fieldKey].images || []).concat([saved.image]);
            setMsg("截图已上传");
            paint(root);
          })
          .catch(function (err) {
            setMsg(err.message, true);
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
