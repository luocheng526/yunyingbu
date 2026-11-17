/* xm-module-work — 工作汇报。今天页按填写日报，汇总可点开明细。 */
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
    summaryFrom: "",
    summaryTo: "",
    summaryPerson: "",
    summaryShop: "",
    summarySpu: "",
    summaryDialog: null,
    todoOpen: false,
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
    var style = document.getElementById("work-page-style");
    if (style && style.getAttribute("data-rev") === "ding1") {
      return;
    }
    if (!style) {
      style = document.createElement("style");
      style.id = "work-page-style";
      document.head.appendChild(style);
    }
    style.setAttribute("data-rev", "ding1");
    style.textContent =
      ".work-page{color:var(--xm-ink);font-size:13px;}.work-bar{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:0 0 10px;}.work-page h1{margin:0;font-size:18px;font-weight:650;}.work-lead{margin:4px 0 0;color:var(--xm-muted);font-size:12px;}.work-page h2{margin:0 0 6px;padding:0;font-size:13px;font-weight:650;}.work-page h3{margin:0 0 6px;font-size:13px;font-weight:650;}.work-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 10px;}.work-tab{position:relative;appearance:none;border:1px solid var(--xm-line);border-radius:8px;background:var(--xm-card);color:var(--xm-ink);font:inherit;font-size:13px;padding:6px 12px;cursor:pointer;white-space:nowrap;}.work-dot{position:absolute;top:-7px;right:-8px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:#e23b3b;color:#fff;font-size:11px;line-height:16px;font-weight:700;font-style:normal;text-align:center;}.work-tab[aria-selected='true']{border:0;color:#fff;font-weight:650;background:linear-gradient(90deg,#245bdb,#4b7cff);}.work-panel{display:flex;flex-direction:column;gap:8px;}.work-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;}.work-kpi{border:0;border-radius:12px;min-height:92px;padding:14px 14px 12px;color:#fff;display:flex;flex-direction:column;justify-content:flex-end;}button.work-kpi{appearance:none;width:100%;cursor:pointer;font:inherit;text-align:left;}.work-kpi b,.work-kpi strong{display:block;font-size:28px;line-height:1;font-weight:700;color:#fff;}.work-kpi span{display:block;margin-top:8px;color:rgba(255,255,255,.92);font-size:13px;font-weight:600;}.work-c0{background:linear-gradient(135deg,#2f6fe4,#5b94f5);}.work-c1{background:linear-gradient(135deg,#1faa5a,#3dce78);}.work-c2{background:linear-gradient(135deg,#f08a1e,#ffb04a);}.work-c4{background:linear-gradient(135deg,#1fb8c9,#2fd3c0);}.work-c5{background:linear-gradient(135deg,#e23b3b,#ff6b6b);}.work-quiet{background:var(--xm-card);color:var(--xm-ink);border:1px solid var(--xm-line);}.work-quiet b" +
      "{color:var(--xm-primary);}.work-quiet span{color:var(--xm-muted);}.work-card{background:var(--xm-card);border:1px solid var(--xm-line);border-radius:12px;padding:10px 12px;}.work-cardhead{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;margin:0 0 4px;}.work-lane .work-field{margin-top:8px;max-width:720px;}.work-tools{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;}.work-form{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;}.work-field{display:flex;flex-direction:column;gap:4px;min-width:140px;color:var(--xm-muted);font-size:12px;}.work-field input,.work-field select,.work-tools select{height:28px;border:1px solid var(--xm-line);border-radius:6px;background:var(--xm-card);color:var(--xm-ink);padding:0 8px;font:inherit;font-size:12px;}.work-field textarea,.work-table textarea{min-height:56px;width:100%;border:1px solid var(--xm-line);border-radius:6px;background:var(--xm-card);color:var(--xm-ink);padding:6px 8px;font:inherit;font-size:13px;resize:vertical;box-sizing:border-box;}.work-primary{height:28px;border:0;border-radius:6px;background:var(--xm-primary);color:#fff;padding:0 12px;font:inherit;font-size:12px;cursor:pointer;}.work-primary:disabled{opacity:.6;cursor:default;}.work-mini{height:26px;border:1px solid var(--xm-line);border-radius:6px;background:var(--xm-card);color:var(--xm-ink);padding:0 8px;font:inherit;font-size:12px;cursor:pointer;}.work-mini.is-on{border:0;color:#fff;background:linear-gradient(90deg,#245bdb,#4b7cff);}.work-table-wrap{overflow:auto;}.work-roster-scroll{max-height:360px;overflow:auto;}.work-table{width:100%;border-collapse:collapse;font-size:12px;}.work-table th{text-align:left;color:var(--xm-muted);font-weight:600;padding:4px 6px;border-bottom:1px solid var(--xm-line);white-space:nowrap;}.work-table td{padding:4px 6px;border-bottom:1px solid var(--xm-line);vertical-align:middle;}td.work-check{width:48px;text-align:center;}td.work-check input{width:16px;height:16px;margin:0;accent-color:var(--xm-primary);cursor:pointer;}.work-empty{padding:18px 12px;text-align:center;color:var(--xm-muted);}.work-empty b{display:block;margin-bottom:6px;font-size:15px;color:var(--xm-ink);}.work-msg{min-height:16px;margin:0 0 6px;color:var(--xm-muted);font-size:12px;}.work-msg.is-error{color:#cf1322;}.work-ok{color:#12b36a;font-weight:650;white-space:nowrap;}.wor" +
      "k-miss{color:#cf1322;font-weight:650;white-space:nowrap;}.work-depts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;}.work-dept{min-height:88px;text-align:left;border:0;border-radius:12px;padding:14px;cursor:pointer;color:#fff;font:inherit;}.work-dept b{display:block;font-size:16px;font-weight:700;}.work-dept span{display:block;margin-top:6px;color:rgba(255,255,255,.9);font-size:12px;}.work-muted{color:var(--xm-muted);font-size:12px;}.work-filters{display:flex;flex-direction:row;flex-wrap:wrap;gap:8px;align-items:center;}.work-filters .work-mini{flex:none;width:auto;}.work-chiprow{display:flex;flex-wrap:wrap;gap:8px;align-items:center;}.work-sub{display:block;margin-top:2px;font-size:12px;line-height:1.45;opacity:.92;}.work-duty{min-width:140px;max-width:280px;white-space:normal;line-height:1.45;}.work-count{margin-left:auto;color:var(--xm-muted);font-size:12px;}.work-field.is-grow{flex:1;min-width:200px;}.work-checks{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px;}.work-checks label{display:inline-flex;align-items:center;gap:5px;background:var(--xm-card);border:1px solid var(--xm-line);border-radius:5px;padding:4px 7px;font-size:13px;cursor:pointer;}.work-context{display:flex;align-items:center;flex-wrap:wrap;gap:10px 22px;font-size:13px;color:var(--xm-muted);}.work-context .work-field{flex-direction:row;align-items:center;gap:8px;min-width:0;}.work-context .work-field input{height:34px;}.work-filler strong{margin-left:4px;color:var(--xm-ink);font-weight:650;}.work-dutybadge{margin-left:auto;border-radius:20px;background:var(--xm-card);color:var(--xm-ink);border:1px solid var(--xm-line);padding:3px 10px;font-size:12px;}.work-sheet{background:var(--xm-card);border:1px solid var(--xm-line);border-radius:12px;min-width:0;}.work-storebar{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;padding:18px 22px;border-bottom:1px solid var(--xm-line);}.work-storetitle,.work-storeactions{display:flex;align-items:center;gap:10px;min-width:0;}.work-storetitle{flex-wrap:wrap;}.work-storeicon{display:grid;place-items:center;width:38px;height:38px;color:var(--xm-primary);flex:none;}.work-storetitle small{display:block;font-siz" +
      "e:12px;color:var(--xm-muted);}.work-storetitle h3{margin:0;font-size:18px;font-weight:670;}.work-storetitle select{border:0;background:transparent;color:var(--xm-ink);font:inherit;font-size:16px;font-weight:650;max-width:320px;}.work-badge{border-radius:6px;background:rgba(20,40,80,.06);color:var(--xm-muted);padding:2px 8px;font-size:12px;}.work-storeactions{margin-left:auto;}.work-storeactions select{height:32px;border:1px solid var(--xm-primary);border-radius:6px;background:var(--xm-card);color:var(--xm-primary);padding:0 10px;font:inherit;font-size:13px;font-weight:650;}.work-link{border:0;background:transparent;color:var(--xm-muted);font:inherit;font-size:12px;cursor:pointer;padding:6px 4px;}.work-groups{display:flex;gap:22px;padding:0 22px;border-bottom:1px solid var(--xm-line);flex-wrap:wrap;}.work-groups button{display:inline-flex;gap:7px;align-items:center;min-height:48px;padding:0 3px;cursor:pointer;border:0;border-bottom:2px solid transparent;background:transparent;color:var(--xm-muted);font:inherit;font-size:14px;font-weight:650;}.work-groups button.is-on{color:var(--xm-primary);border-bottom-color:var(--xm-primary);}.work-section{padding:18px 22px 8px;}.work-lanes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:28px;align-items:start;}.work-lanes.is-single{grid-template-columns:minmax(0,1fr);}.work-lane{min-width:0;}.work-lane-title{margin:0 0 5px;padding:7px 10px;border-radius:5px;background:rgba(20,40,80,.05);font-size:13px;color:var(--xm-muted);font-weight:650;}.work-diary-item{padding:0 4px;border-bottom:1px solid var(--xm-line);}.work-item-line{min-height:55px;display:grid;align-items:center;column-gap:8px;grid-template-columns:minmax(0,1fr) minmax(62px,92px) 69px;font-size:14px;}.work-item-line>span{font-weight:550;overflow-wrap:anywhere;}.work-metric-num{display:flex;align-items:center;gap:5px;}.work-metric-num input{width:72px;height:33px;border:1px solid var(--xm-line);border-radius:6px;background:var(--xm-card);color:var(--xm-ink);padding:0 8px;font:inherit;font-size:15px;font-weight:650;box-sizing:border-box;}.work-metric-num small{color:var(--xm-muted);font-size:12px;}.work-more{display:inline-flex;align-items:center;justify-self:end;gap:5px;padding:6px 2px;font:inherit;font-size:12px;background:transparent;color:var(--xm-muted);border:0;cursor:pointer;}.work-more.is-open,.work-more:hov" +
      "er{color:var(--xm-primary);}.work-more i{width:6px;height:6px;border:solid currentColor;border-width:0 1.5px 1.5px 0;transform:translateY(-2px) rotate(45deg);}.work-more.is-open i{transform:translateY(2px) rotate(225deg);}.work-diary-more{display:grid;gap:10px;margin:0 0 12px;padding:12px;background:rgba(20,40,80,.04);border-radius:7px;}.work-diary-more[hidden]{display:none;}.work-orders{display:grid;grid-template-columns:minmax(200px,.8fr) minmax(0,1.2fr);gap:28px;align-items:start;}.work-order{min-width:0;}.work-order header{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:40px;border-bottom:1px solid var(--xm-line);padding-bottom:9px;margin-bottom:12px;}.work-order h4{margin:0;font-size:15px;}.work-order textarea,.work-diary-more textarea{min-height:70px;width:100%;box-sizing:border-box;}.work-shot{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}.work-shot img{max-width:148px;max-height:72px;object-fit:cover;border:0;border-radius:8px;}.work-submitbar{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;padding:2px 2px 0;}.work-submitbar strong{color:var(--xm-muted);font-size:12px;font-weight:650;}.work-submitbar .work-primary,.work-submitbar .work-mini{min-height:38px;padding:7px 16px;font-weight:650;}.work-sum-table th,.work-sum-table td{white-space:nowrap;}.work-modal{position:fixed;inset:0;z-index:40;display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;overflow:auto;background:rgba(15,23,42,.45);}.work-dialog{width:min(920px,100%);background:var(--xm-card);color:var(--xm-ink);border-radius:12px;padding:16px 18px;}.work-dialog-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:0 0 12px;}.work-sum-split{display:grid;grid-template-columns:minmax(180px,.7fr) minmax(280px,1.6fr);gap:14px;align-items:start;}.work-fold{margin:0 0 8px;}.work-fold summary{cursor:pointer;font-weight:650;}.work-total{margin:0 0 8px;font-size:22px;font-weight:700;}.work-people{display:flex;flex-direction:column;gap:8px;}.work-person{color:#fff;border-radius:12px;padding:12px 14px;box-shadow:0 8px 18px rgba(20,40,80,.12);display:flex;align-items:center;gap:16px;}.work-person.tone-ok{background:linear-gradient(90deg,#1faa5a,#3dce78);}.work-person.tone-miss{background:linear-gradient(90deg,#e23" +
      "b3b,#ff6b6b);}.work-person.tone-rest{background:linear-gradient(90deg,#f08a1e,#ffb04a);}.work-person.tone-free{background:linear-gradient(90deg,#2f6fe4,#5b94f5);}.work-who{flex:0 0 140px;min-width:0;}.work-who b{display:block;font-size:16px;}.work-who span,.work-main{font-size:12px;color:rgba(255,255,255,.92);line-height:1.45;}.work-main{flex:1;min-width:0;}.work-person .work-mini{background:#fff;color:#245bdb;border:0;font-weight:650;}@media (max-width:980px){.work-stats,.work-depts,.work-lanes,.work-orders,.work-sum-split{grid-template-columns:1fr}.work-person{flex-wrap:wrap}}";
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

  function mineIn(rows) {
    var me = state.meta && state.meta.me;
    if (!me) {
      return (rows || [])[0] || null;
    }
    return (
      (rows || []).find(function (row) {
        return Number(row.person && row.person.id) === Number(me.id);
      }) || null
    );
  }

  function myRow() {
    return mineIn(state.report && state.report.rows);
  }

  function renderTodos() {
    if (!state.todoOpen) {
      return '<div class="work-card"><div class="work-empty"><b>没有待办</b>今天的日报已经提交，或今天不用交。</div></div>';
    }
    return (
      '<div class="work-people"><article class="work-person tone-miss"><div class="work-who"><b>日报</b><span>今天</span></div><div class="work-main">今天的日报还没提交</div><button type="button" class="work-mini" data-todo-go>去填写</button></article></div>'
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
      return '<div class="work-card"><div class="work-empty">这一天还没有人需要汇报。</div></div>';
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

  function diaryIcon() {
    return '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 4h12v12H4z"/></svg>';
  }

  function quantityField(node, current) {
    var count = Number(current.count) > 0 ? String(current.count) : "";
    return (
      '<label class="work-metric-num"><input data-diary-count type="number" min="0" max="100000" step="1" placeholder="0" value="' +
      esc(count) +
      '">' +
      (node.unit ? "<small>" + esc(node.unit) + "</small>" : "") +
      "</label>"
    );
  }

  function shotField(images) {
    return (
      '<div class="work-shot" data-diary-images>' +
      (images || [])
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
      '<label class="work-mini">添加截图<input data-diary-file type="file" accept="image/png,image/jpeg,image/webp" hidden></label></div>'
    );
  }

  function choiceField(node, current) {
    var choices = diaryNodes("choice", node.id);
    if (!choices.length) {
      return "";
    }
    return (
      '<div class="work-checks" role="group" aria-label="优化项目"><span class="work-muted">优化项目</span>' +
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
    );
  }

  function metricFilled(current) {
    return Boolean(
      (current.spus && String(current.spus).trim()) ||
        (current.detail && String(current.detail).trim()) ||
        (current.actions && current.actions.length) ||
        (current.images && current.images.length)
    );
  }

  function metricRow(node, item) {
    var shared = ((state.diary && state.diary.sharedLabels) || []).indexOf(node.name) >= 0;
    if (shared) {
      return '<p class="work-muted">「' + esc(node.name) + "」和上面的部门事项是同一项，只填一次。</p>";
    }
    var current = item || {};
    var yesNo = node.id === "报名活动" || node.id === "一键低价商品";
    var countsOnly = node.id === "评价数" || node.id === "穿热销数量";
    var open = metricFilled(current);
    var detail = yesNo
      ? '<label class="work-field">是否全部完成<select data-diary-detail><option value=""></option><option' +
        (current.detail === "是" ? " selected" : "") +
        '>是</option><option' +
        (current.detail === "否" ? " selected" : "") +
        ">否</option></select></label>"
      : '<label class="work-field">' +
        (node.id === "优化" ? "补充说明" : "工作明细") +
        '<input data-diary-detail value="' +
        esc(current.detail || "") +
        '" maxlength="600" placeholder="选填"></label>';
    var spus = countsOnly
      ? ""
      : '<label class="work-field">相关 SPU<input data-diary-spu value="' +
        esc(current.spus || "") +
        '" maxlength="2200" placeholder="' +
        (node.id === "优化" ? "按 SPU 去重，也可只填款数" : "多个 SPU 用逗号分隔") +
        '"></label>';
    return (
      '<div class="work-diary-item" data-metric="' +
      esc(node.id) +
      '"><div class="work-item-line"><span>' +
      esc(node.name) +
      "</span>" +
      quantityField(node, current) +
      '<button type="button" class="work-more' +
      (open ? " is-open" : "") +
      '" data-diary-more aria-expanded="' +
      (open ? "true" : "false") +
      '">' +
      (open ? "已填明细" : "明细") +
      "<i></i></button></div><div class=\"work-diary-more\"" +
      (open ? "" : " hidden") +
      ">" +
      spus +
      choiceField(node, current) +
      detail +
      shotField(current.images) +
      "</div></div>"
    );
  }

  function orderCard(node, item) {
    var current = item || {};
    var late = node.id === "即将超时订单";
    return (
      '<section class="work-order" data-metric="' +
      esc(node.id) +
      '"><header><h4>' +
      esc(node.name) +
      "</h4>" +
      (late ? quantityField(node, current) : "") +
      "</header><label class=\"work-field\">" +
      (late ? "即将超时原因" : "处置经过") +
      '<textarea data-diary-detail maxlength="600" placeholder="' +
      (late ? "数量大于 0 时请填写原因" : "记录发生了什么、如何处理、处理结果") +
      '">' +
      esc(current.detail || "") +
      "</textarea></label>" +
      shotField(current.images) +
      "</section>"
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
      var orders = metrics.length > 0 && metrics.every(function (node) {
        return node.id === "即将超时订单" || node.id === "违约单处置记录";
      });
      var body = orders
        ? '<div class="work-orders">' +
          metrics
            .map(function (node) {
              return orderCard(node, (draft && draft.items && draft.items[node.id]) || {});
            })
            .join("") +
          "</div>"
        : metrics
            .map(function (node) {
              return metricRow(node, (draft && draft.items && draft.items[node.id]) || {});
            })
            .join("");
      fields +=
        '<section class="work-lane"><h3 class="work-lane-title">' +
        esc(lane.name) +
        "</h3>" +
        body +
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
    var currentShop = shops.find(function (item) { return String(item.id) === state.diaryShop; });
    var shopTitle = state.diaryOpen.length > 1
      ? '<select data-switch-shop aria-label="切换填写店铺">' +
        state.diaryOpen
          .map(function (id) {
            var shop = shops.find(function (item) { return String(item.id) === id; });
            return (
              '<option value="' +
              esc(id) +
              '"' +
              (id === state.diaryShop ? " selected" : "") +
              ">" +
              esc(shop ? shop.name : id) +
              "</option>"
            );
          })
          .join("") +
        "</select>"
      : "<h3>" + esc(currentShop ? currentShop.name : "选择填写店铺") + "</h3>";
    return (
      '<section class="work-sheet"><div class="work-storebar"><div class="work-storetitle"><i class="work-storeicon">' +
      diaryIcon("store") +
      "</i><div><small>填写店铺</small>" +
      shopTitle +
      "</div>" +
      (draft ? '<span class="work-badge">' + esc(draft.status || "未填报") + "</span>" : "") +
      '</div><div class="work-storeactions">' +
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
        ? '<button type="button" class="work-link" data-remove-shop="' + esc(state.diaryShop) + '">移出</button>'
        : "") +
      "</div></div>" +
      '<nav class="work-groups" aria-label="工作分类">' +
      sections
        .map(function (section) {
          return (
            '<button type="button"' +
            (section.id === state.diaryGroup ? ' class="is-on"' : "") +
            ' data-diary-group="' +
            esc(section.id) +
            '" aria-pressed="' +
            (section.id === state.diaryGroup) +
            '">' +
            diaryIcon(section.id) +
            "<span>" +
            esc(section.name) +
            "</span></button>"
          );
        })
        .join("") +
      '</nav><div class="work-section"><div class="work-lanes' +
      (lanes.length === 1 ? " is-single" : "") +
      '">' +
      fields +
      "</div></div></section>" +
      '<footer class="work-submitbar"><strong>本次填报：' +
      state.diaryOpen.length +
      ' 家店</strong><div class="work-filters"><button type="button" class="work-mini" data-diary-save="草稿">保存草稿</button><button type="button" class="work-primary" data-diary-save="已提交">提交日报</button></div></footer>'
    );
  }

  function shiftIso(day, offset) {
    var date = new Date(String(day) + "T12:00:00Z");
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
  }

  function summarySpu() {
    return String(state.summarySpu || "").trim().toUpperCase();
  }

  function splitSpus(value) {
    return String(value || "")
      .toUpperCase()
      .split(/[\s,，、;；]+/)
      .filter(Boolean);
  }

  function summaryRows() {
    var spu = summarySpu();
    return ((state.summary && state.summary.rows) || []).filter(function (row) {
      if (state.summaryPerson && String(row.personId) !== String(state.summaryPerson)) {
        return false;
      }
      if (state.summaryShop && String(row.shopId) !== String(state.summaryShop)) {
        return false;
      }
      if (!spu) {
        return true;
      }
      var items = row.items || {};
      return Object.keys(items).some(function (id) {
        return splitSpus(items[id] && items[id].spus).indexOf(spu) >= 0;
      });
    });
  }

  function metricCount(row, id) {
    var item = (row.items && row.items[id]) || {};
    var spu = summarySpu();
    if (spu && splitSpus(item.spus).indexOf(spu) < 0) {
      return 0;
    }
    if (id === "违约单处置记录") {
      if (String(item.detail || "").trim() || (item.images || []).length) {
        return 1;
      }
    }
    if (id === "优化" && spu) {
      return 1;
    }
    return Number(item.count) || 0;
  }

  function metricTotal(rows, id) {
    return rows.reduce(function (sum, row) {
      return sum + metricCount(row, id);
    }, 0);
  }

  function metricLabel(metric) {
    return metric.name + (metric.unit ? "（" + metric.unit + "）" : "");
  }

  function choiceName(id) {
    var nodes = (state.diary && state.diary.catalog && state.diary.catalog.nodes) || [];
    var found = null;
    nodes.forEach(function (node) {
      if (node.id === id) {
        found = node.name;
      }
    });
    return found || id;
  }

  function itemDetailText(item) {
    var actions = (item && item.actions) || [];
    var parts = actions.map(choiceName);
    if (item && item.detail) {
      parts.push(item.detail);
    }
    return parts.filter(Boolean).join("、");
  }

  function imageButtons(images) {
    return (images || [])
      .map(function (image) {
        return (
          '<button type="button" class="work-mini" data-preview-image="' +
          esc(image.id) +
          '">查看截图 · ' +
          esc(image.name) +
          "</button>"
        );
      })
      .join("");
  }

  function summaryTable(headers, rows) {
    return (
      '<div class="work-table-wrap"><table class="work-table work-sum-table"><thead><tr>' +
      headers.map(function (header) { return "<th>" + esc(header) + "</th>"; }).join("") +
      "</tr></thead><tbody>" +
      (rows || '<tr><td colspan="' + headers.length + '" class="work-empty">暂无明细</td></tr>') +
      "</tbody></table></div>"
    );
  }

  function groupSummary(rows, key) {
    var groups = [];
    var index = {};
    rows.forEach(function (row) {
      var id = String(row[key]);
      if (!index[id]) {
        index[id] = { id: id, name: key === "personId" ? row.personName : row.shopName, rows: [] };
        groups.push(index[id]);
      }
      index[id].rows.push(row);
    });
    return groups;
  }

  function renderSummaryDialog(rows, metrics) {
    var dialog = state.summaryDialog;
    if (!dialog) {
      return "";
    }
    var body = "";
    var title = "";
    if (dialog.type === "metric") {
      var metric = null;
      metrics.forEach(function (item) {
        if (item.id === dialog.id) {
          metric = item;
        }
      });
      if (!metric) {
        return "";
      }
      title = metricLabel(metric) + "明细";
      var entries = rows.filter(function (row) {
        var item = (row.items && row.items[dialog.id]) || {};
        return metricCount(row, dialog.id) || item.spus || (item.images || []).length || itemDetailText(item);
      });
      var people = groupSummary(entries, "personId");
      var shops = groupSummary(entries, "shopId");
      body =
        '<p class="work-total">合计 ' +
        metricTotal(entries, dialog.id) +
        '</p><div class="work-sum-split"><section><h3>人员贡献</h3>' +
        summaryTable(
          ["人员", "数量"],
          people
            .map(function (group) {
              return "<tr><td>" + esc(group.name) + "</td><td>" + metricTotal(group.rows, dialog.id) + "</td></tr>";
            })
            .join("")
        ) +
        '</section><section><h3>店铺明细</h3>' +
        (shops.length
          ? shops
              .map(function (group) {
                return (
                  '<details class="work-fold" open><summary>' +
                  esc(group.name) +
                  " · " +
                  metricTotal(group.rows, dialog.id) +
                  "</summary>" +
                  summaryTable(
                    ["日期", "人员", "数量", "SPU", "明细"],
                    group.rows
                      .map(function (row) {
                        var item = (row.items && row.items[dialog.id]) || {};
                        return (
                          "<tr><td>" +
                          esc(row.day) +
                          "</td><td>" +
                          esc(row.personName) +
                          "</td><td>" +
                          metricCount(row, dialog.id) +
                          "</td><td>" +
                          esc(summarySpu() && dialog.id === "优化" ? state.summarySpu : item.spus || "") +
                          "</td><td>" +
                          esc(itemDetailText(item)) +
                          imageButtons(item.images) +
                          "</td></tr>"
                        );
                      })
                      .join("")
                  ) +
                  "</details>"
                );
              })
              .join("")
          : '<p class="work-empty">暂无明细</p>') +
        "</section></div>";
    } else {
      var report = rows[dialog.index];
      if (!report) {
        return "";
      }
      title = "日报详情";
      body =
        "<p>" +
        esc(report.day) +
        "　" +
        esc(report.personName) +
        "　" +
        esc(report.shopName) +
        "</p>" +
        summaryTable(
          ["工作内容", "数量", "SPU", "明细"],
          metrics
            .map(function (metric) {
              var item = (report.items && report.items[metric.id]) || {};
              return (
                "<tr><td>" +
                esc(metricLabel(metric)) +
                "</td><td>" +
                (item && item.count != null ? item.count : "—") +
                "</td><td>" +
                esc(item.spus || "") +
                "</td><td>" +
                esc(itemDetailText(item)) +
                imageButtons(item.images) +
                "</td></tr>"
              );
            })
            .join("")
        ) +
        "<p>其他工作　" +
        esc(((report.extra || []).map(choiceName).join("、")) || "—") +
        "</p><p>备注　" +
        esc(report.notes || "—") +
        "</p>" +
        imageButtons((report.proofs && report.proofs["备注"]) || []);
    }
    return (
      '<div class="work-modal"><div class="work-dialog" role="dialog"><div class="work-dialog-head"><h2>' +
      esc(title) +
      '</h2><button type="button" class="work-mini" data-summary-close>关闭</button></div>' +
      body +
      "</div></div>"
    );
  }

  function renderSummary() {
    var data = state.summary;
    if (!data) {
      return '<div class="work-card"><div class="work-empty">正在读取工作汇总…</div></div>';
    }
    var rows = summaryRows();
    var metrics = data.metrics || [];
    var peopleCount = {};
    var shopCount = {};
    rows.forEach(function (row) {
      peopleCount[row.personId] = true;
      shopCount[row.shopId] = true;
    });
    var peopleOptions = (data.people || [])
      .map(function (person) {
        return (
          '<option value="' +
          esc(person.id) +
          '"' +
          (String(state.summaryPerson) === String(person.id) ? " selected" : "") +
          ">" +
          esc(person.name) +
          "</option>"
        );
      })
      .join("");
    var shopOptions = (data.shops || [])
      .map(function (shop) {
        return (
          '<option value="' +
          esc(shop.id) +
          '"' +
          (String(state.summaryShop) === String(shop.id) ? " selected" : "") +
          ">" +
          esc(shop.name) +
          "</option>"
        );
      })
      .join("");
    function bits(group) {
      var text = metrics
        .filter(function (metric) {
          return metricTotal(group.rows, metric.id);
        })
        .map(function (metric) {
          return metric.name + " " + metricTotal(group.rows, metric.id);
        })
        .join(" · ");
      return text || "暂无数量";
    }
    function bars(groups, tone) {
      if (!groups.length) {
        return '<div class="work-card"><div class="work-empty">暂无明细</div></div>';
      }
      return (
        '<div class="work-people">' +
        groups
          .map(function (group) {
            return (
              '<article class="work-person ' + tone + '"><div class="work-who"><b>' +
              esc(group.name) +
              "</b><span>日报 " +
              group.rows.length +
              '</span></div><div class="work-main">' +
              esc(bits(group)) +
              "</div></article>"
            );
          })
          .join("") +
        "</div>"
      );
    }
    var cards = metrics
      .map(function (metric) {
        var total = rows.length ? metricTotal(rows, metric.id) : "—";
        return (
          '<button type="button" class="work-kpi work-quiet" data-summary-metric="' +
          esc(metric.id) +
          '"><b>' +
          total +
          "</b><span>" +
          esc(metric.name) +
          "</span></button>"
        );
      })
      .join("");
    var diaries = rows
      .map(function (row, index) {
        return (
          '<article class="work-person tone-ok"><div class="work-who"><b>' +
          esc(row.day) +
          "</b><span>" +
          esc(row.personName) +
          '</span></div><div class="work-main">' +
          esc(row.shopName) +
          '</div><button type="button" class="work-mini" data-summary-report="' +
          index +
          '">查看详情</button></article>'
        );
      })
      .join("");
    return (
      '<div class="work-panel"><section class="work-card"><h2>汇总筛选</h2><div class="work-filters">' +
      '<button type="button" class="work-mini" data-summary-period="今天">今天</button>' +
      '<button type="button" class="work-mini" data-summary-period="昨天">昨天</button>' +
      '<button type="button" class="work-mini" data-summary-period="近7天">近7天</button>' +
      '<button type="button" class="work-mini" data-summary-period="本月">本月</button></div>' +
      '<div class="work-form"><label class="work-field">开始日期<input type="date" data-summary-from value="' +
      esc(state.summaryFrom) +
      '"></label><label class="work-field">结束日期<input type="date" data-summary-to value="' +
      esc(state.summaryTo) +
      '"></label><label class="work-field">人员<select data-summary-person><option value="">全部人员</option>' +
      peopleOptions +
      '</select></label><label class="work-field">店铺<select data-summary-shop><option value="">全部店铺</option>' +
      shopOptions +
      '</select></label><label class="work-field">SPU<input data-summary-spu value="' +
      esc(state.summarySpu) +
      '"></label><button type="button" class="work-primary" data-summary-query>查询</button></div></section>' +
      '<div class="work-stats">' +
      kpi(0, rows.length, "已交日报") +
      kpi(1, Object.keys(peopleCount).length, "已报人数") +
      kpi(4, Object.keys(shopCount).length, "店铺数") +
      "</div>" +
      '<div class="work-stats">' +
      cards +
      "</div><h2>按人员汇总</h2>" +
      bars(groupSummary(rows, "personId"), "tone-ok") +
      "<h2>按店铺汇总</h2>" +
      bars(groupSummary(rows, "shopId"), "tone-free") +
      "<h2>已提交日报</h2>" +
      (diaries ? '<div class="work-people">' + diaries + "</div>" : '<div class="work-card"><div class="work-empty">这段时间还没有已提交的店铺日报。</div></div>') +
      renderSummaryDialog(rows, metrics) +
      "</div>"
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
      if (status === "待核对") {
        return "tone-free";
      }
      return "tone-free";
    }
    var rows = (data.rows || [])
      .map(function (row) {
        var restLabel = row.manualRest ? "取消休息" : "登记休息";
        var restOn = row.manualRest ? "0" : "1";
        var showRest = row.manualRest || row.status === "未报" || row.status === "待核对" || row.status === "已报";
        var rest = showRest
            ? '<button type="button" class="work-mini" data-rest="' +
              esc(row.personId) +
              '" data-rest-on="' +
              restOn +
              '">' +
              restLabel +
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
      (sum.pending ? '<p class="work-lead">考勤待核对 ' + esc(sum.pending) + " 人，未计入未报。</p>" : "") +
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
    var link = policy.integration || {};
    var dingLead = link.app
      ? "已关联 " + (link.bound || 0) + " 人。排班休息、整天请假免报；半天假仍要交。未绑定或接口失败会标明原因。"
      : "密钥只放服务器环境变量，不在这里填写。";
    var operatorOptions = (data.binds || []).filter(function (row) { return row.confirmed; }).map(function (row) {
      return '<option value="' + row.personId + '"' + (Number(delivery.operatorPersonId) === Number(row.personId) ? " selected" : "") + ">" + esc(row.name) + "</option>";
    }).join("");
    var bindRows = (data.binds || []).map(function (row) {
      var options = (row.candidates || []).map(function (item) {
        return '<option value="' + esc(item.userid) + '">' + esc(item.name) + "</option>";
      }).join("");
      return "<tr><td>" + esc(row.name) + "</td><td>" + esc(row.employeeNo || "") + '</td><td><input data-ding-user data-person="' + row.personId + '" value="' + esc(row.userid || "") + '">' + (options ? '<select data-ding-fill="' + row.personId + '"><option value="">待核对</option>' + options + "</select>" : "") + "</td><td>" + esc(row.match || "") + "</td></tr>";
    }).join("");
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
      '<div class="work-panel"><div class="work-card"><h2>必须提交店铺日报的岗位</h2><p class="work-lead">勾选岗位，并且已排进运营部、人事部或技术部、名下有店的人，当天要交店铺日报。登记休息后免报。</p><div class="work-checks">' +
      positions +
      '</div><button type="button" class="work-primary" data-save-positions>保存岗位设置</button></div>' +
      '<div class="work-card"><h2>考勤与提醒</h2><p class="work-lead">' +
      dingLead +
      (link.app && !link.agent ? " 待配置工作通知 AgentId。" : "") +
      '</p><div class="work-checks"><label><input type="checkbox" data-delivery="useSchedule"' +
      (delivery.useSchedule ? " checked" : "") +
      '> 按钉钉排班识别休息日</label><label><input type="checkbox" data-delivery="useLeave"' +
      (delivery.useLeave ? " checked" : "") +
      '> 按钉钉请假记录识别已批休假</label><label><input type="checkbox" data-delivery="remind"' +
      (delivery.remind ? " checked" : "") +
      '> 提醒未交日报</label></div><label class="work-field">每日提醒时间（北京时间）<input data-remind-at type="time" value="' +
      esc(delivery.remindAt || "18:00") +
      '"></label><label class="work-field">排班查询人<select data-ding-operator><option value="">请选择</option>' +
      operatorOptions +
      '</select></label><button type="button" class="work-primary" data-save-delivery>保存考勤与提醒</button>' +
      (link.app
        ? '<div class="work-table-wrap"><table class="work-table"><thead><tr><th>姓名</th><th>工号</th><th>钉钉 userId</th><th>核对</th></tr></thead><tbody>' +
          (bindRows || '<tr><td colspan="4" class="work-empty">没有在职人员</td></tr>') +
          '</tbody></table></div><button type="button" class="work-mini" data-ding-sync>从钉钉核对员工</button><button type="button" class="work-primary" data-ding-save>保存员工绑定</button>'
        : "") +
      "</div>" +
      '<div class="work-card"><h2>填报项目</h2><p class="work-lead">停用后，已经提交的记录仍可在工作汇总里看。</p><div class="work-table-wrap"><table class="work-table"><thead><tr><th>栏目</th><th>名称</th><th>单位</th><th>启用</th></tr></thead><tbody>' +
      nodes +
      '</tbody></table></div><button type="button" class="work-primary" data-save-catalog>保存填报内容</button></div></div>'
    );
  }

  function fillerName() {
    var me = state.meta && state.meta.me;
    return me && me.name ? me.name : "";
  }

  function dutyBadge() {
    var row = myRow();
    if (!row || row.status === "自愿") {
      return "自愿填报";
    }
    if (row.status === "免报") {
      return "免报";
    }
    if (row.status === "已报") {
      return "已交";
    }
    if (row.status === "待核对") {
      return "待核对" + (row.statusNote ? "（" + row.statusNote + "）" : "");
    }
    if (row.status === "未报") {
      return "应交 · 待提交" + (row.statusNote ? "（" + row.statusNote + "）" : "");
    }
    return "自愿填报";
  }

  function renderContext() {
    var date = state.date || todayIso();
    var max = (state.meta && state.meta.today) || todayIso();
    return (
      '<div class="work-context"><label class="work-field">工作日期<input type="date" data-work-date min="2020-01-01" max="' +
      esc(max) +
      '" value="' +
      esc(date) +
      '"></label><button type="button" class="work-mini" data-today>今天</button><span class="work-filler">填报人 <strong>' +
      esc(fillerName()) +
      '</strong></span><span class="work-dutybadge">' +
      esc(dutyBadge()) +
      "</span></div>"
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
    } else if (!isAdmin() && !hasShops) {
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
    return '<div class="work-panel">' + renderContext() + fillBlock + diary + board + "</div>";
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
      '<p class="work-lead">名单来自组织中心在职人员。勾上的人按当前部门模板填报。</p>' +
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
      '<button type="button" class="work-tab" data-tab="todo" aria-selected="' +
      (state.tab === "todo") +
      '">待办事项' +
      (state.todoOpen ? '<i class="work-dot">1</i>' : "") +
      "</button></div>";
    var body =
      state.tab === "settings" && admin
        ? renderSettings()
        : state.tab === "summary"
          ? renderSummary()
          : state.tab === "duty" && leader
            ? renderDuty()
            : state.tab === "diarySettings" && admin
              ? renderDiarySettings()
              : state.tab === "todo"
                ? renderTodos()
                : renderToday();
    var focusKey = state.keepFocus;
    var caret = state.keepCaret;
    state.keepFocus = "";
    state.keepCaret = null;
    var dated = state.tab === "duty";
    var date = state.date || todayIso();
    var dateTools = dated
      ? '<div class="work-tools"><label class="work-field">日期<input type="date" data-work-date min="2020-01-01" max="2099-12-31" value="' +
        esc(date) +
        '"></label><button type="button" class="work-mini" data-today>今天</button></div>'
      : "";
    var heading = state.tab === "today" ? "填写日报" : state.tab === "summary" ? "工作汇总" : state.tab === "todo" ? "待办事项" : "工作汇报";
    var lead = state.tab === "duty" ? '<p class="work-lead">人数按人计，店铺按店计。</p>' : "";
    root.innerHTML =
      '<main class="page work-page">' +
      '<div class="work-bar"><div><h1>' +
      heading +
      "</h1>" +
      lead +
      "</div>" +
      dateTools +
      "</div>" +
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
    if (!state.date) {
      state.date = todayIso();
    }
    var query = "/api/work/report?date=" + encodeURIComponent(state.date);
    if (state.dept) {
      query += "&dept=" + encodeURIComponent(state.dept);
    }
    var metaPromise = api("/api/work");
    var reportPromise = api(query);
    var diaryPromise = api("/api/work/diary?date=" + encodeURIComponent(state.date));
    var today = todayIso();
    var todayPromise = state.date !== today ? api("/api/work/report?date=" + encodeURIComponent(today)) : null;
    var settingsPromise = isAdmin() && state.tab === "settings" ? api("/api/work/settings") : null;
    state.meta = await metaPromise;
    if (!state.date) {
      state.date = state.meta.today;
    }
    state.report = await reportPromise;
    state.diary = await diaryPromise;
    var todayRows = todayPromise ? (await todayPromise).rows : state.report.rows;
    var mine = mineIn(todayRows);
    state.todoOpen = Boolean(mine && mine.status === "未报");
    state.diaryDraftDate = "";
    if (settingsPromise) {
      state.settings = await settingsPromise;
    }
    if (state.tab === "summary") {
      var summaryDay = state.meta.today || state.date || todayIso();
      if (!state.summaryTo) {
        state.summaryTo = summaryDay;
      }
      if (!state.summaryFrom) {
        state.summaryFrom = shiftIso(state.summaryTo, -6);
      }
      state.summaryDialog = null;
      state.summary = await api(
        "/api/work/diary/summary?from=" +
          encodeURIComponent(state.summaryFrom) +
          "&to=" +
          encodeURIComponent(state.summaryTo)
      );
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

  function readSummaryForm(root) {
    var from = root.querySelector("[data-summary-from]");
    var to = root.querySelector("[data-summary-to]");
    var person = root.querySelector("[data-summary-person]");
    var shop = root.querySelector("[data-summary-shop]");
    var spu = root.querySelector("[data-summary-spu]");
    if (from && from.value) {
      state.summaryFrom = from.value;
    }
    if (to && to.value) {
      state.summaryTo = to.value;
    }
    if (person) {
      state.summaryPerson = person.value;
    }
    if (shop) {
      state.summaryShop = shop.value;
    }
    if (spu) {
      state.summarySpu = spu.value;
    }
  }

  function bind(root) {
    root.addEventListener("click", function (event) {
      var todoGo = event.target.closest("[data-todo-go]");
      if (todoGo) {
        state.tab = "today";
        state.date = (state.meta && state.meta.today) || todayIso();
        setMsg("");
        reload(root).catch(function (err) {
          setMsg(err.message, true);
          paint(root);
        });
        return;
      }
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
      var summaryPeriod = event.target.closest("[data-summary-period]");
      if (summaryPeriod) {
        readSummaryForm(root);
        var summaryToday = (state.meta && state.meta.today) || todayIso();
        var period = summaryPeriod.getAttribute("data-summary-period");
        state.summaryTo = period === "昨天" ? shiftIso(summaryToday, -1) : summaryToday;
        state.summaryFrom = period === "今天" ? summaryToday : period === "昨天" ? state.summaryTo : period === "本月" ? summaryToday.slice(0, 7) + "-01" : shiftIso(summaryToday, -6);
        reload(root).catch(function (err) {
          setMsg(err.message, true);
          paint(root);
        });
        return;
      }
      var summaryQuery = event.target.closest("[data-summary-query]");
      if (summaryQuery) {
        readSummaryForm(root);
        reload(root).catch(function (err) {
          setMsg(err.message, true);
          paint(root);
        });
        return;
      }
      var summaryMetric = event.target.closest("[data-summary-metric]");
      if (summaryMetric) {
        state.summaryDialog = { type: "metric", id: summaryMetric.getAttribute("data-summary-metric") };
        paint(root);
        return;
      }
      var summaryReport = event.target.closest("[data-summary-report]");
      if (summaryReport) {
        state.summaryDialog = { type: "report", index: Number(summaryReport.getAttribute("data-summary-report")) };
        paint(root);
        return;
      }
      if ((event.target.classList && event.target.classList.contains("work-modal")) || event.target.closest("[data-summary-close]")) {
        state.summaryDialog = null;
        paint(root);
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
        var row = more.closest("[data-metric]");
        var box = row ? row.querySelector(".work-diary-more") : null;
        if (box) {
          box.hidden = !box.hidden;
          more.classList.toggle("is-open", !box.hidden);
          more.setAttribute("aria-expanded", box.hidden ? "false" : "true");
          more.childNodes[0].textContent = box.hidden ? "明细" : "已填明细";
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
        delivery.operatorPersonId = Number((root.querySelector("[data-ding-operator]") || {}).value) || 0;
        api("/api/work/diary/settings", {
          method: "PUT",
          body: { delivery: delivery }
        })
          .then(function (data) {
            state.diarySettings = data;
            var ready = data.policy && data.policy.integration && data.policy.integration.app;
            setMsg(ready ? "考勤与提醒已保存" : "已保存。企业应用未配置，暂不查询钉钉。");
            paint(root);
          })
          .catch(function (err) {
            setMsg(err.message, true);
            paint(root);
          });
        return;
      }
      var dingSync = event.target.closest("[data-ding-sync]");
      if (dingSync) {
        api("/api/work/diary/ding/sync", { method: "POST", body: {} })
          .then(function (data) {
            state.diarySettings = data;
            setMsg("工号已自动绑定，重名请人工确认");
            paint(root);
          })
          .catch(function (err) {
            setMsg(err.message, true);
            paint(root);
          });
        return;
      }
      var dingSave = event.target.closest("[data-ding-save]");
      if (dingSave) {
        api("/api/work/diary/ding", {
          method: "PUT",
          body: {
            binds: [].slice.call(root.querySelectorAll("[data-ding-user]")).map(function (input) {
              return { personId: Number(input.getAttribute("data-person")), userid: input.value || "" };
            })
          }
        })
          .then(function (data) {
            state.diarySettings = data;
            setMsg("员工绑定已保存");
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
      var switchShop = event.target.closest("[data-switch-shop]");
      if (switchShop && switchShop.value) {
        readDiarySheet(root);
        state.diaryShop = String(switchShop.value);
        paint(root);
        return;
      }
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
    root.addEventListener("change", function (event) {
      var pick = event.target.closest("[data-ding-fill]");
      if (!pick) {
        return;
      }
      var input = root.querySelector('[data-ding-user][data-person="' + pick.getAttribute("data-ding-fill") + '"]');
      if (input && pick.value) {
        input.value = pick.value;
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
