/* xm-module-hr — 智能人事。只挂 /hr。假勤只读钉钉落库，面试和人才在本库。 */
(function () {
  var TABS = [
    { id: "attendance", label: "考勤" },
    { id: "overtime", label: "加班" },
    { id: "timeoff", label: "调休" },
    { id: "talent", label: "人才" },
    { id: "interview", label: "面试" }
  ];
  var RESULTS = ["待定", "通过", "未通过", "未到场"];
  var STAGES = ["储备", "面试中", "已入职", "已淘汰"];

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function shanghaiToday() {
    var parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());
    var bag = {};
    parts.forEach(function (part) { bag[part.type] = part.value; });
    return bag.year + "-" + bag.month + "-" + bag.day;
  }

  function addDays(ymd, days) {
    var bits = ymd.split("-").map(Number);
    var utc = new Date(Date.UTC(bits[0], bits[1] - 1, bits[2] + days));
    return utc.toISOString().slice(0, 10);
  }

  function options(list, selected) {
    return list.map(function (item) {
      return '<option value="' + esc(item) + '"' + (item === selected ? " selected" : "") + ">" + esc(item) + "</option>";
    }).join("");
  }

  function ensureStyle() {
    if (document.getElementById("hr-page-style")) return;
    var style = document.createElement("style");
    style.id = "hr-page-style";
    style.textContent =
      ".hr-page{color:var(--xm-ink);}" +
      ".hr-title{margin:0 0 8px;font-size:18px;font-weight:600;color:var(--xm-ink);}" +
      ".hr-tabs{display:flex;gap:0;border-bottom:1px solid var(--xm-line);margin:0 0 12px;overflow:auto;}" +
      ".hr-tab{appearance:none;border:0;border-bottom:2px solid transparent;background:transparent;color:var(--xm-muted);font:inherit;font-size:14px;padding:10px 16px;cursor:pointer;white-space:nowrap;}" +
      ".hr-tab[aria-selected='true']{color:var(--xm-primary);border-bottom-color:var(--xm-primary);font-weight:600;}" +
      ".hr-tab:focus-visible,.hr-page button:focus-visible,.hr-page input:focus-visible,.hr-page select:focus-visible{outline:2px solid var(--xm-primary);outline-offset:1px;}" +
      ".hr-panel{display:flex;flex-direction:column;gap:12px;}" +
      ".hr-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(128px,1fr));gap:8px;}" +
      ".hr-kpi{background:var(--xm-card);border:1px solid var(--xm-line);border-radius:8px;padding:10px 12px;box-shadow:var(--xm-shadow);}" +
      ".hr-kpi b{display:block;font-size:22px;line-height:1.2;font-variant-numeric:tabular-nums;color:var(--xm-ink);}" +
      ".hr-kpi span{display:block;margin-top:2px;color:var(--xm-muted);font-size:12px;}" +
      ".hr-card{background:var(--xm-card);border:1px solid var(--xm-line);border-radius:8px;box-shadow:var(--xm-shadow);}" +
      ".hr-form{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;padding:12px;}" +
      ".hr-field{display:flex;flex-direction:column;gap:4px;min-width:140px;flex:1 1 140px;color:var(--xm-muted);font-size:12px;}" +
      ".hr-field input,.hr-field select{height:32px;border:1px solid var(--xm-line);border-radius:6px;background:var(--xm-card);color:var(--xm-ink);padding:0 8px;font:inherit;font-size:13px;}" +
      ".hr-field-grow{flex:2 1 220px;}" +
      ".hr-toolbar{display:flex;justify-content:space-between;gap:8px;align-items:center;color:var(--xm-muted);font-size:13px;}" +
      ".hr-month input{height:32px;border:1px solid var(--xm-line);border-radius:6px;background:var(--xm-card);color:var(--xm-ink);padding:0 8px;font:inherit;}" +
      ".hr-primary{height:32px;border:0;border-radius:6px;background:var(--xm-primary);color:#fff;padding:0 14px;font:inherit;font-size:13px;cursor:pointer;}" +
      ".hr-table-wrap{overflow:auto;}" +
      ".hr-table{width:100%;border-collapse:collapse;font-size:13px;}" +
      ".hr-table th{text-align:left;color:var(--xm-muted);font-weight:600;padding:8px 10px;border-bottom:1px solid var(--xm-line);white-space:nowrap;}" +
      ".hr-table td{padding:8px 10px;border-bottom:1px solid var(--xm-line);vertical-align:middle;}" +
      ".hr-empty{padding:28px 12px;text-align:center;color:var(--xm-muted);}" +
      ".hr-msg{min-height:18px;color:var(--xm-muted);font-size:12px;}" +
      ".hr-msg.is-error{color:#cf1322;}" +
      "html[data-theme='dark'] .hr-msg.is-error{color:#ff7875;}" +
      ".hr-mini{height:26px;border:1px solid var(--xm-line);border-radius:6px;background:var(--xm-card);color:var(--xm-ink);padding:0 8px;font:inherit;font-size:12px;cursor:pointer;}";
    document.head.appendChild(style);
  }

  function api(path, options) {
    var init = options || {};
    var headers = { Accept: "application/json" };
    if (init.body) headers["Content-Type"] = "application/json";
    return fetch(path, {
      method: init.method || "GET",
      credentials: "same-origin",
      headers: headers,
      body: init.body ? JSON.stringify(init.body) : undefined
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok || data.ok === false) {
          var err = new Error((data && data.error) || "读取失败");
          err.status = res.status;
          throw err;
        }
        return data || {};
      });
    });
  }

  function safePeople(payload) {
    var rows = (payload && payload.people) || [];
    return rows.map(function (row) {
      return {
        id: Number(row.id),
        name: String(row.name || "").trim(),
        status: String(row.status || "").trim(),
        employeeNo: String(row.employeeNo || "").trim(),
        department: String(row.department || row.center || "").trim()
      };
    }).filter(function (row) { return row.id && row.status !== "离职"; });
  }

  function kpis(items) {
    return '<div class="hr-stats" data-stats>' + items.map(function (item) {
      return '<div class="hr-kpi"><b>' + esc(item.value) + "</b><span>" + esc(item.label) + "</span></div>";
    }).join("") + "</div>";
  }

  function table(headers, body) {
    return '<div class="hr-card hr-table-wrap" data-list><table class="hr-table"><thead><tr>' +
      headers.map(function (name) { return "<th>" + esc(name) + "</th>"; }).join("") +
      "</tr></thead><tbody>" + body + "</tbody></table></div>";
  }

  function emptyRow(cols, text) {
    return '<tr><td colspan="' + cols + '"><div class="hr-empty">' + esc(text) + "</div></td></tr>";
  }

  function field(label, html, extra) {
    return '<label class="hr-field ' + (extra || "") + '">' + esc(label) + html + "</label>";
  }

  function setStats(root, items) {
    var box = root.querySelector("[data-stats]");
    if (box) box.outerHTML = kpis(items);
  }

  function setList(root, headers, rowsHtml) {
    var box = root.querySelector("[data-list]");
    if (box) box.outerHTML = table(headers, rowsHtml);
  }

  function setMsg(root, text, isError) {
    var box = root.querySelector("[data-msg]");
    if (!box) return;
    box.textContent = text || "";
    box.classList.toggle("is-error", !!isError);
  }

  function nameOf(people, id) {
    var found = people.filter(function (person) { return person.id === Number(id); })[0];
    return found ? found.name : "";
  }

  function pairPunches(rows) {
    var groups = {};
    rows.forEach(function (row) {
      var key = row.personId + "|" + row.workDate;
      if (!groups[key]) groups[key] = { personId: row.personId, workDate: row.workDate, on: "", off: "", labels: [] };
      if (row.checkType === "OffDuty") groups[key].off = row.checkAt || "";
      else groups[key].on = row.checkAt || "";
      if (row.label) groups[key].labels.push(row.label);
    });
    return Object.keys(groups).map(function (key) { return groups[key]; });
  }

  function paint(root, tab, month, today) {
    var hint = "钉钉是来源，这里只显示已经拉下来的记录。没有就空着。";
    var monthBar = '<div class="hr-toolbar"><span>' + esc(hint) + '</span><label class="hr-month">月份<input type="month" data-month value="' + esc(month) + '" /></label></div>';
    var html = "";
    if (tab === "attendance") {
      html = '<section class="hr-panel">' + monthBar + kpis([
        { label: "打卡条数", value: "0" },
        { label: "已对齐", value: "0" },
        { label: "未对齐", value: "0" }
      ]) + '<p class="hr-msg" data-msg></p>' + table(["姓名", "工号", "对齐"], emptyRow(3, "还没有在职人员")) +
        table(["姓名", "日期", "上班", "下班", "结果"], emptyRow(5, "还没有打卡")).replace("data-list", "data-punches") + "</section>";
    } else if (tab === "overtime") {
      html = '<section class="hr-panel">' + monthBar + kpis([{ label: "加班总时长", value: "0" }]) +
        '<p class="hr-msg" data-msg></p>' + table(["姓名", "日期", "时长"], emptyRow(3, "还没有加班")) + "</section>";
    } else if (tab === "timeoff") {
      html = '<section class="hr-panel"><div class="hr-toolbar"><span>' + esc(hint) + "</span></div>" +
        kpis([{ label: "有余额的人", value: "0" }, { label: "调休记录", value: "0" }]) +
        '<p class="hr-msg" data-msg></p>' + table(["姓名", "假期", "额度", "已用", "剩余"], emptyRow(5, "还没有调休余额")) +
        table(["姓名", "开始", "结束", "时长"], emptyRow(4, "还没有调休记录")).replace("data-list", "data-leaves") + "</section>";
    } else if (tab === "talent") {
      html = '<section class="hr-panel"><div class="hr-toolbar"><span>人才先记在本库。钉钉招聘还没接。</span></div>' +
        kpis([{ label: "人数", value: "0" }]) +
        '<form class="hr-form hr-card" data-form="talent">' +
        field("姓名", '<input name="name" required maxlength="64" autocomplete="off" />') +
        field("电话", '<input name="phone" maxlength="32" autocomplete="off" />') +
        field("目标岗位", '<input name="targetRole" maxlength="64" autocomplete="off" />') +
        field("来源", '<input name="source" maxlength="64" autocomplete="off" />') +
        field("阶段", '<select name="stage">' + options(STAGES, "储备") + "</select>") +
        field("备注", '<input name="note" maxlength="500" autocomplete="off" />', "hr-field-grow") +
        '<button class="hr-primary" type="submit">登记人才</button></form>' +
        '<p class="hr-msg" data-msg></p>' + table(["姓名", "电话", "目标岗位", "来源", "阶段", "备注", ""], emptyRow(7, "还没有人才档案")) + "</section>";
    } else {
      html = '<section class="hr-panel"><div class="hr-toolbar"><span>面试先记在本库。</span></div>' +
        kpis([{ label: "面试场次", value: "0" }, { label: "通过", value: "0" }, { label: "通过率", value: "—" }]) +
        '<form class="hr-form hr-card" data-form="interview">' +
        field("候选人", '<input name="candidateName" required maxlength="64" autocomplete="off" />') +
        field("岗位", '<input name="position" maxlength="64" autocomplete="off" />') +
        field("面试官", '<input name="interviewer" maxlength="64" autocomplete="off" />') +
        field("面试时间", '<input name="interviewAt" type="datetime-local" required />') +
        field("结果", '<select name="result">' + options(RESULTS, "待定") + "</select>") +
        field("备注", '<input name="note" maxlength="500" autocomplete="off" />', "hr-field-grow") +
        '<button class="hr-primary" type="submit">登记面试</button></form>' +
        '<p class="hr-msg" data-msg></p>' + table(["候选人", "岗位", "面试官", "时间", "结果", "备注", ""], emptyRow(7, "还没有面试记录")) + "</section>";
    }
    root.querySelector(".hr-body").innerHTML = html;
    void today;
  }

  function fillAttendance(root, pack) {
    var people = pack.people || [];
    var links = pack.links || [];
    var linked = {};
    links.forEach(function (link) { linked[link.personId] = link; });
    var open = people.filter(function (person) { return !linked[person.id]; });
    setStats(root, [
      { label: "打卡条数", value: (pack.punches || []).length },
      { label: "已对齐", value: links.length },
      { label: "未对齐", value: open.length }
    ]);
    var linkBody = people.length ? people.slice(0, 30).map(function (person) {
      var link = linked[person.id];
      var how = link ? (link.matchBy === "phone" ? "手机号" : "工号") : "未对齐";
      return "<tr><td>" + esc(person.name) + "</td><td>" + esc(person.employeeNo) + "</td><td>" + esc(how) + "</td></tr>";
    }).join("") : emptyRow(3, "还没有在职人员");
    if (people.length > 30) linkBody += '<tr><td colspan="3">还有 ' + (people.length - 30) + " 人</td></tr>";
    setList(root, ["姓名", "工号", "对齐"], linkBody);
    var days = pairPunches(pack.punches || []);
    var punchBody = days.length ? days.map(function (row) {
      var labels = row.labels.filter(function (label, index) { return row.labels.indexOf(label) === index; }).join("、");
      return "<tr><td>" + esc(nameOf(people, row.personId) || "未命名") + "</td><td>" + esc(row.workDate) +
        "</td><td>" + esc(row.on) + "</td><td>" + esc(row.off) + "</td><td>" + esc(labels) + "</td></tr>";
    }).join("") : emptyRow(5, "还没有打卡");
    var box = root.querySelector("[data-punches]");
    if (box) box.outerHTML = table(["姓名", "日期", "上班", "下班", "结果"], punchBody).replace("data-list", "data-punches");
    if (!pack.configured) setMsg(root, "钉钉还没配置，对齐和打卡先留空。", false);
  }

  function fillOvertime(root, pack) {
    var rows = pack.overtime || [];
    var total = rows.reduce(function (sum, row) { return sum + Number(row.hours || 0); }, 0);
    setStats(root, [{ label: "加班总时长", value: total ? String(Math.round(total * 10) / 10) : "0" }]);
    var body = rows.length ? rows.map(function (row) {
      return "<tr><td>" + esc(nameOf(pack.people, row.personId) || "未命名") + "</td><td>" + esc(row.workDate) + "</td><td>" + esc(row.hours) + "</td></tr>";
    }).join("") : emptyRow(3, "还没有加班");
    setList(root, ["姓名", "日期", "时长"], body);
    if (!pack.configured) setMsg(root, "钉钉还没配置，加班先留空。", false);
  }

  function fillTimeoff(root, pack) {
    var quotas = (pack.quotas || []).filter(function (row) { return !row.leaveName || String(row.leaveName).indexOf("调休") >= 0; });
    var leaves = pack.leaves || [];
    setStats(root, [
      { label: "有余额的人", value: quotas.length },
      { label: "调休记录", value: leaves.length }
    ]);
    var quotaBody = quotas.length ? quotas.map(function (row) {
      return "<tr><td>" + esc(nameOf(pack.people, row.personId) || "未命名") + "</td><td>" + esc(row.leaveName || "调休") +
        "</td><td>" + esc(row.quotaHours) + "</td><td>" + esc(row.usedHours) + "</td><td>" + esc(row.balanceHours) + "</td></tr>";
    }).join("") : emptyRow(5, "还没有调休余额");
    setList(root, ["姓名", "假期", "额度", "已用", "剩余"], quotaBody);
    var leaveBody = leaves.length ? leaves.map(function (row) {
      return "<tr><td>" + esc(nameOf(pack.people, row.personId) || "未命名") + "</td><td>" + esc(row.startAt) +
        "</td><td>" + esc(row.endAt) + "</td><td>" + esc(row.duration) + "</td></tr>";
    }).join("") : emptyRow(4, "还没有调休记录");
    var box = root.querySelector("[data-leaves]");
    if (box) box.outerHTML = table(["姓名", "开始", "结束", "时长"], leaveBody).replace("data-list", "data-leaves");
    if (!pack.configured) setMsg(root, "钉钉还没配置，调休先留空。", false);
  }

  function removeBtn(kind, id) {
    return '<button type="button" class="hr-mini" data-act="delete" data-kind="' + kind + '" data-id="' + esc(id) + '">删除</button>';
  }

  function fillTalent(root, pack) {
    var rows = pack.talents || [];
    setStats(root, [{ label: "人数", value: rows.length }]);
    var body = rows.length ? rows.map(function (row) {
      return "<tr><td>" + esc(row.name) + "</td><td>" + esc(row.phone) + "</td><td>" + esc(row.targetRole) +
        "</td><td>" + esc(row.source) + "</td><td>" + esc(row.stage) + "</td><td>" + esc(row.note) +
        "</td><td>" + removeBtn("talent", row.id) + "</td></tr>";
    }).join("") : emptyRow(7, "还没有人才档案");
    setList(root, ["姓名", "电话", "目标岗位", "来源", "阶段", "备注", ""], body);
  }

  function fillInterview(root, pack) {
    var rows = pack.interviews || [];
    var passed = rows.filter(function (row) { return row.result === "通过"; }).length;
    setStats(root, [
      { label: "面试场次", value: rows.length },
      { label: "通过", value: passed },
      { label: "通过率", value: rows.length ? Math.round((passed / rows.length) * 1000) / 10 + "%" : "—" }
    ]);
    var body = rows.length ? rows.map(function (row) {
      return "<tr><td>" + esc(row.candidateName) + "</td><td>" + esc(row.position) + "</td><td>" + esc(row.interviewer) +
        "</td><td>" + esc(row.interviewAt) + "</td><td>" + esc(row.result) + "</td><td>" + esc(row.note) +
        "</td><td>" + removeBtn("interview", row.id) + "</td></tr>";
    }).join("") : emptyRow(7, "还没有面试记录");
    setList(root, ["候选人", "岗位", "面试官", "时间", "结果", "备注", ""], body);
  }

  function monthQuery(root) {
    var input = root.querySelector("[data-month]");
    return input && input.value ? "?month=" + encodeURIComponent(input.value) : "";
  }

  function loadTab(root, state) {
    var ticket = ++state.ticket;
    var tab = state.tab;
    var peopleReq = api("/api/people").then(safePeople).catch(function () { return []; });
    var statusReq = api("/api/hr/status").catch(function () { return { configured: false }; });
    var dataReq;
    if (tab === "attendance") {
      dataReq = Promise.all([api("/api/hr/attendance" + monthQuery(root)), api("/api/hr/links")]).then(function (pair) {
        return { punches: pair[0].punches || [], links: pair[1].links || [] };
      });
    } else if (tab === "overtime") {
      dataReq = api("/api/hr/overtime" + monthQuery(root));
    } else if (tab === "timeoff") {
      dataReq = api("/api/hr/timeoff");
    } else if (tab === "talent") {
      dataReq = api("/api/hr/talents");
    } else {
      dataReq = api("/api/hr/interviews");
    }
    Promise.all([peopleReq, statusReq, dataReq]).then(function (pack) {
      if (!state.alive || ticket !== state.ticket || state.tab !== tab) return;
      var view = Object.assign({ people: pack[0], configured: pack[1].configured }, pack[2]);
      if (tab === "attendance") fillAttendance(root, view);
      else if (tab === "overtime") fillOvertime(root, view);
      else if (tab === "timeoff") fillTimeoff(root, view);
      else if (tab === "talent") fillTalent(root, view);
      else fillInterview(root, view);
    }).catch(function (err) {
      if (!state.alive || ticket !== state.ticket) return;
      setMsg(root, err.message || "读取失败", true);
    });
  }

  function selectTab(root, state, id) {
    if (!TABS.some(function (tab) { return tab.id === id; })) return;
    state.tab = id;
    Array.prototype.forEach.call(root.querySelectorAll(".hr-tab"), function (btn) {
      var on = btn.getAttribute("data-tab") === id;
      btn.setAttribute("aria-selected", on ? "true" : "false");
      btn.tabIndex = on ? 0 : -1;
    });
    paint(root, id, addDays(shanghaiToday(), -1).slice(0, 7), shanghaiToday());
    loadTab(root, state);
  }

  function formValue(form, name) {
    var el = form.elements[name];
    return el ? String(el.value || "").trim() : "";
  }

  function mount(root) {
    ensureStyle();
    var state = { tab: "attendance", ticket: 0, alive: true };
    root.innerHTML = '<div class="xm-page hr-page"><h1 class="hr-title">智能人事</h1><div class="hr-tabs" role="tablist" aria-label="智能人事">' +
      TABS.map(function (tab, index) {
        var on = index === 0;
        return '<button type="button" class="hr-tab" role="tab" data-tab="' + tab.id + '" aria-selected="' + (on ? "true" : "false") + '" tabindex="' + (on ? "0" : "-1") + '">' + esc(tab.label) + "</button>";
      }).join("") + '</div><div class="hr-body" role="tabpanel"></div></div>';
    paint(root, state.tab, addDays(shanghaiToday(), -1).slice(0, 7), shanghaiToday());

    function onClick(event) {
      var tabBtn = event.target.closest(".hr-tab");
      if (tabBtn && root.contains(tabBtn)) {
        event.preventDefault();
        selectTab(root, state, tabBtn.getAttribute("data-tab"));
        return;
      }
      var btn = event.target.closest("[data-act='delete']");
      if (!btn || !root.contains(btn)) return;
      if (!window.confirm("删除这条记录？")) return;
      var kind = btn.getAttribute("data-kind") === "talent" ? "/talents/" : "/interviews/";
      api("/api/hr" + kind + btn.getAttribute("data-id"), { method: "DELETE" })
        .then(function () { loadTab(root, state); })
        .catch(function (err) { setMsg(root, err.message, true); });
    }

    function onSubmit(event) {
      var form = event.target.closest("form[data-form]");
      if (!form || !root.contains(form)) return;
      event.preventDefault();
      var kind = form.getAttribute("data-form");
      var body = kind === "talent" ? {
        name: formValue(form, "name"),
        phone: formValue(form, "phone"),
        targetRole: formValue(form, "targetRole"),
        source: formValue(form, "source"),
        stage: formValue(form, "stage"),
        note: formValue(form, "note")
      } : {
        candidateName: formValue(form, "candidateName"),
        position: formValue(form, "position"),
        interviewer: formValue(form, "interviewer"),
        interviewAt: formValue(form, "interviewAt"),
        result: formValue(form, "result"),
        note: formValue(form, "note")
      };
      var button = form.querySelector("button[type='submit']");
      if (button) button.disabled = true;
      api("/api/hr/" + (kind === "talent" ? "talents" : "interviews"), { method: "POST", body: body })
        .then(function () {
          form.reset();
          loadTab(root, state);
        })
        .catch(function (err) { setMsg(root, err.message, true); })
        .then(function () { if (button) button.disabled = false; });
    }

    root.addEventListener("click", onClick);
    root.addEventListener("submit", onSubmit);
    root.addEventListener("change", function (event) {
      if (event.target && event.target.matches("[data-month]")) loadTab(root, state);
    });
    loadTab(root, state);
    return function unmount() {
      state.alive = false;
      root.innerHTML = "";
    };
  }

  var host = typeof window === "undefined" ? null : window;
  if (!host) return;
  host.XmModules = host.XmModules || {};
  host.XmModules["/hr"] = { mount: mount, unmount: function () {} };
})();
