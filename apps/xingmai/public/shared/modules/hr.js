/* xm-module-hr — 智能人事。只挂 /hr，页签留在本页。 */
(function () {
  var TABS = [
    { id: "interview", label: "面试统计" },
    { id: "attendance", label: "考勤" },
    { id: "timeoff", label: "调休" },
    { id: "talent", label: "人才管理" },
    { id: "overtime", label: "加班时长" }
  ];
  var RESULTS = ["待定", "通过", "未通过", "未到场"];
  var ATTENDANCE = ["正常", "迟到", "早退", "缺卡", "旷工", "请假"];
  var TIMEOFF = ["待审", "已通过", "已驳回"];
  var STAGES = ["储备", "面试中", "已入职", "已淘汰"];

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function shanghaiMonth() {
    var parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit"
    }).formatToParts(new Date());
    var year = "";
    var month = "";
    parts.forEach(function (part) {
      if (part.type === "year") year = part.value;
      if (part.type === "month") month = part.value;
    });
    return year + "-" + month;
  }

  function shanghaiToday() {
    var parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());
    var bag = { year: "", month: "", day: "" };
    parts.forEach(function (part) {
      if (bag[part.type] != null) bag[part.type] = part.value;
    });
    return bag.year + "-" + bag.month + "-" + bag.day;
  }

  function options(list, selected) {
    return list
      .map(function (item) {
        var on = item === selected ? " selected" : "";
        return '<option value="' + esc(item) + '"' + on + ">" + esc(item) + "</option>";
      })
      .join("");
  }

  function rateText(rate) {
    if (rate == null || rate === "") return "—";
    return Math.round(Number(rate) * 1000) / 10 + "%";
  }

  function hoursText(value) {
    var num = Number(value || 0);
    if (!num) return "0";
    return String(Math.round(num * 10) / 10);
  }

  function ensureStyle() {
    if (document.getElementById("hr-page-style")) return;
    var style = document.createElement("style");
    style.id = "hr-page-style";
    style.textContent =
      ".hr-page{color:var(--xm-ink);}" +
      ".hr-tabs{display:flex;gap:0;border-bottom:1px solid var(--xm-line);margin:0 0 12px;overflow:auto;}" +
      ".hr-tab{appearance:none;border:0;border-bottom:2px solid transparent;background:transparent;color:var(--xm-muted);font:inherit;font-size:14px;padding:10px 16px;cursor:pointer;white-space:nowrap;}" +
      ".hr-tab:hover{color:var(--xm-ink);}" +
      ".hr-tab[aria-selected='true']{color:var(--xm-primary);border-bottom-color:var(--xm-primary);font-weight:600;}" +
      ".hr-tab:focus-visible,.hr-page button:focus-visible,.hr-page input:focus-visible,.hr-page select:focus-visible{outline:2px solid var(--xm-primary);outline-offset:1px;}" +
      ".hr-panel{display:flex;flex-direction:column;gap:12px;}" +
      ".hr-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(128px,1fr));gap:8px;}" +
      ".hr-kpi{background:var(--xm-card);border:1px solid var(--xm-line);border-radius:8px;padding:10px 12px;box-shadow:var(--xm-shadow);}" +
      ".hr-kpi b{display:block;font-size:22px;line-height:1.2;font-variant-numeric:tabular-nums;color:var(--xm-ink);font-weight:650;}" +
      ".hr-kpi span{display:block;margin-top:2px;color:var(--xm-muted);font-size:12px;}" +
      ".hr-card{background:var(--xm-card);border:1px solid var(--xm-line);border-radius:8px;box-shadow:var(--xm-shadow);}" +
      ".hr-form{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;padding:12px;}" +
      ".hr-field{display:flex;flex-direction:column;gap:4px;min-width:140px;flex:1 1 140px;color:var(--xm-muted);font-size:12px;}" +
      ".hr-field input,.hr-field select,.hr-page textarea{height:32px;border:1px solid var(--xm-line);border-radius:6px;background:var(--xm-card);color:var(--xm-ink);padding:0 8px;font:inherit;font-size:13px;}" +
      ".hr-field-grow{flex:2 1 220px;}" +
      ".hr-toolbar{display:flex;justify-content:space-between;gap:8px;align-items:center;color:var(--xm-muted);font-size:13px;}" +
      ".hr-month{display:inline-flex;align-items:center;gap:8px;}" +
      ".hr-month input{height:32px;border:1px solid var(--xm-line);border-radius:6px;background:var(--xm-card);color:var(--xm-ink);padding:0 8px;font:inherit;}" +
      ".hr-primary{height:32px;border:0;border-radius:6px;background:var(--xm-primary);color:#fff;padding:0 14px;font:inherit;font-size:13px;cursor:pointer;}" +
      ".hr-primary:disabled{opacity:.6;cursor:default;}" +
      ".hr-table-wrap{overflow:auto;}" +
      ".hr-table{width:100%;border-collapse:collapse;font-size:13px;}" +
      ".hr-table th{text-align:left;color:var(--xm-muted);font-weight:600;padding:8px 10px;border-bottom:1px solid var(--xm-line);white-space:nowrap;}" +
      ".hr-table td{padding:8px 10px;border-bottom:1px solid var(--xm-line);vertical-align:middle;}" +
      ".hr-empty{padding:28px 12px;text-align:center;color:var(--xm-muted);}" +
      ".hr-msg{min-height:18px;color:var(--xm-muted);font-size:12px;}" +
      ".hr-msg.is-error{color:#cf1322;}" +
      "html[data-theme='dark'] .hr-msg.is-error{color:#ff7875;}" +
      ".hr-actions{display:flex;flex-wrap:wrap;gap:4px;}" +
      ".hr-mini{height:26px;border:1px solid var(--xm-line);border-radius:6px;background:var(--xm-card);color:var(--xm-ink);padding:0 8px;font:inherit;font-size:12px;cursor:pointer;}" +
      ".hr-mini.is-on{border-color:var(--xm-primary);background:var(--xm-primary-soft);color:var(--xm-primary);}" +
      ".hr-split{margin-top:8px;}" +
      ".hr-subhead{margin:0;color:var(--xm-muted);font-size:12px;font-weight:600;}";
    document.head.appendChild(style);
  }

  function api(path, options) {
    var init = options || {};
    var headers = { Accept: "application/json" };
    if (init.body) headers["Content-Type"] = "application/json";
    return fetch("/api/hr" + path, {
      method: init.method || "GET",
      credentials: "same-origin",
      headers: headers,
      body: init.body ? JSON.stringify(init.body) : undefined
    }).then(function (res) {
      return res.json().catch(function () {
        return {};
      }).then(function (data) {
        data = data || {};
        if (!res.ok || data.ok === false) {
          var err = new Error(data.error || (res.status === 404 ? "人事接口还没挂上" : "读取失败"));
          err.status = res.status;
          throw err;
        }
        return data;
      });
    });
  }

  function kpis(items) {
    return (
      '<div class="hr-stats" data-stats>' +
      items
        .map(function (item) {
          return '<div class="hr-kpi"><b>' + esc(item.value) + "</b><span>" + esc(item.label) + "</span></div>";
        })
        .join("") +
      "</div>"
    );
  }

  function table(headers, body) {
    return (
      '<div class="hr-card hr-table-wrap" data-list><table class="hr-table"><thead><tr>' +
      headers.map(function (name) { return "<th>" + esc(name) + "</th>"; }).join("") +
      "</tr></thead><tbody>" +
      body +
      "</tbody></table></div>"
    );
  }

  function emptyRow(cols, text) {
    return '<tr><td colspan="' + cols + '"><div class="hr-empty">' + esc(text) + "</div></td></tr>";
  }

  function field(label, html, extra) {
    return '<label class="hr-field ' + (extra || "") + '">' + esc(label) + html + "</label>";
  }

  function monthBar(month) {
    return (
      '<div class="hr-toolbar"><span>按登记的真实记录统计，没有就空着。</span>' +
      '<label class="hr-month">月份<input type="month" data-month value="' +
      esc(month) +
      '" /></label></div>'
    );
  }

  function msgBox() {
    return '<p class="hr-msg" data-msg></p>';
  }

  function interviewPanel(month) {
    return (
      '<section class="hr-panel">' +
      monthBar(month) +
      kpis([
        { label: "面试场次", value: "0" },
        { label: "通过", value: "0" },
        { label: "未通过", value: "0" },
        { label: "待定", value: "0" },
        { label: "未到场", value: "0" },
        { label: "通过率", value: "—" }
      ]) +
      '<form class="hr-form hr-card" data-form="interview">' +
      field("候选人", '<input name="candidateName" required maxlength="64" autocomplete="off" />') +
      field("岗位", '<input name="position" maxlength="64" autocomplete="off" />') +
      field("面试官", '<input name="interviewer" maxlength="64" autocomplete="off" />') +
      field("面试时间", '<input name="interviewAt" type="datetime-local" required />') +
      field("结果", '<select name="result">' + options(RESULTS, "待定") + "</select>") +
      field("备注", '<input name="note" maxlength="500" autocomplete="off" />', "hr-field-grow") +
      '<button class="hr-primary" type="submit">登记面试</button></form>' +
      msgBox() +
      table(["候选人", "岗位", "面试官", "时间", "结果", "备注", ""], emptyRow(7, "还没有面试记录")) +
      "</section>"
    );
  }

  function attendancePanel(month, today) {
    return (
      '<section class="hr-panel">' +
      monthBar(month) +
      kpis([
        { label: "记录", value: "0" },
        { label: "正常", value: "0" },
        { label: "迟到", value: "0" },
        { label: "早退", value: "0" },
        { label: "缺卡", value: "0" },
        { label: "旷工", value: "0" },
        { label: "请假", value: "0" }
      ]) +
      '<form class="hr-form hr-card" data-form="attendance">' +
      field("姓名", '<input name="personName" required maxlength="64" autocomplete="off" />') +
      field("日期", '<input name="workDate" type="date" required value="' + esc(today) + '" />') +
      field("上班", '<input name="checkIn" type="time" />') +
      field("下班", '<input name="checkOut" type="time" />') +
      field("状态", '<select name="status">' + options(ATTENDANCE, "正常") + "</select>") +
      field("备注", '<input name="note" maxlength="500" autocomplete="off" />', "hr-field-grow") +
      '<button class="hr-primary" type="submit">登记考勤</button></form>' +
      msgBox() +
      table(["姓名", "日期", "上班", "下班", "状态", "备注", ""], emptyRow(7, "这个月还没有打卡")) +
      "</section>"
    );
  }

  function timeoffPanel(today) {
    return (
      '<section class="hr-panel">' +
      '<div class="hr-toolbar"><span>只显示已经登记的调休。</span></div>' +
      kpis([
        { label: "待审", value: "0" },
        { label: "已通过", value: "0" },
        { label: "已驳回", value: "0" },
        { label: "已通过时长", value: "0" }
      ]) +
      '<form class="hr-form hr-card" data-form="timeoff">' +
      field("姓名", '<input name="personName" required maxlength="64" autocomplete="off" />') +
      field("开始", '<input name="startOn" type="date" required value="' + esc(today) + '" />') +
      field("结束", '<input name="endOn" type="date" required value="' + esc(today) + '" />') +
      field("时长（小时）", '<input name="hours" type="number" min="0.5" max="240" step="0.5" required />') +
      field("原因", '<input name="reason" maxlength="500" autocomplete="off" />', "hr-field-grow") +
      '<button class="hr-primary" type="submit">登记调休</button></form>' +
      msgBox() +
      table(["姓名", "开始", "结束", "时长", "原因", "状态", ""], emptyRow(7, "还没有调休")) +
      "</section>"
    );
  }

  function talentPanel() {
    return (
      '<section class="hr-panel">' +
      '<div class="hr-toolbar"><span>人才档案只来自本页登记。</span></div>' +
      kpis([
        { label: "人数", value: "0" },
        { label: "储备", value: "0" },
        { label: "面试中", value: "0" },
        { label: "已入职", value: "0" },
        { label: "已淘汰", value: "0" }
      ]) +
      '<form class="hr-form hr-card" data-form="talent">' +
      field("姓名", '<input name="name" required maxlength="64" autocomplete="off" />') +
      field("电话", '<input name="phone" maxlength="32" autocomplete="off" />') +
      field("目标岗位", '<input name="targetRole" maxlength="64" autocomplete="off" />') +
      field("来源", '<input name="source" maxlength="64" autocomplete="off" />') +
      field("阶段", '<select name="stage">' + options(STAGES, "储备") + "</select>") +
      field("备注", '<input name="note" maxlength="500" autocomplete="off" />', "hr-field-grow") +
      '<button class="hr-primary" type="submit">登记人才</button></form>' +
      msgBox() +
      table(["姓名", "电话", "目标岗位", "来源", "阶段", "备注", ""], emptyRow(7, "还没有人才档案")) +
      "</section>"
    );
  }

  function overtimePanel(month, today) {
    return (
      '<section class="hr-panel">' +
      monthBar(month) +
      kpis([{ label: "加班总时长", value: "0" }]) +
      '<div data-people></div>' +
      '<form class="hr-form hr-card" data-form="overtime">' +
      field("姓名", '<input name="personName" required maxlength="64" autocomplete="off" />') +
      field("日期", '<input name="workDate" type="date" required value="' + esc(today) + '" />') +
      field("时长（小时）", '<input name="hours" type="number" min="0.5" max="24" step="0.5" required />') +
      field("原因", '<input name="reason" maxlength="500" autocomplete="off" />', "hr-field-grow") +
      '<button class="hr-primary" type="submit">登记加班</button></form>' +
      msgBox() +
      table(["姓名", "日期", "时长", "原因", ""], emptyRow(5, "这个月还没有加班")) +
      "</section>"
    );
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

  function removeBtn(kind, id) {
    return '<button type="button" class="hr-mini danger" data-act="delete" data-kind="' + kind + '" data-id="' + esc(id) + '">删除</button>';
  }

  function choiceBtns(kind, id, list, current) {
    return (
      '<div class="hr-actions">' +
      list
        .map(function (item) {
          var on = item === current ? " is-on" : "";
          return (
            '<button type="button" class="hr-mini' +
            on +
            '" data-act="' +
            kind +
            '" data-id="' +
            esc(id) +
            '" data-value="' +
            esc(item) +
            '">' +
            esc(item) +
            "</button>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function fillInterview(root, data) {
    var stats = data.stats || {};
    setStats(root, [
      { label: "面试场次", value: stats.total || 0 },
      { label: "通过", value: stats.passed || 0 },
      { label: "未通过", value: stats.failed || 0 },
      { label: "待定", value: stats.pending || 0 },
      { label: "未到场", value: stats.absent || 0 },
      { label: "通过率", value: rateText(stats.passRate) }
    ]);
    var rows = data.interviews || [];
    var body = rows.length
      ? rows
          .map(function (row) {
            return (
              "<tr><td>" + esc(row.candidateName) + "</td><td>" + esc(row.position) + "</td><td>" +
              esc(row.interviewer) + "</td><td>" + esc(row.interviewAt) + "</td><td>" + esc(row.result) +
              "</td><td>" + esc(row.note) + "</td><td>" + removeBtn("interview", row.id) + "</td></tr>"
            );
          })
          .join("")
      : emptyRow(7, "还没有面试记录");
    var positionRows = (stats.byPosition || [])
      .map(function (item) {
        return "<tr><td>" + esc(item.position) + "</td><td>" + esc(item.total) + "</td><td>" + esc(item.passed) + "</td></tr>";
      })
      .join("");
    var extra = positionRows
      ? '<div class="hr-split"><p class="hr-subhead">按岗位</p>' +
        table(["岗位", "场次", "通过"], positionRows).replace('data-list', 'data-positions') +
        "</div>"
      : "";
    setList(root, ["候选人", "岗位", "面试官", "时间", "结果", "备注", ""], body);
    var old = root.querySelector("[data-positions]");
    if (old) old.parentElement.remove();
    if (extra) {
      var list = root.querySelector("[data-list]");
      if (list) list.insertAdjacentHTML("afterend", extra);
    }
  }

  function fillAttendance(root, data) {
    var stats = data.stats || {};
    setStats(root, [
      { label: "记录", value: stats.total || 0 },
      { label: "正常", value: stats.normal || 0 },
      { label: "迟到", value: stats.late || 0 },
      { label: "早退", value: stats.early || 0 },
      { label: "缺卡", value: stats.missing || 0 },
      { label: "旷工", value: stats.absent || 0 },
      { label: "请假", value: stats.leave || 0 }
    ]);
    var rows = data.attendance || [];
    var body = rows.length
      ? rows
          .map(function (row) {
            return (
              "<tr><td>" + esc(row.personName) + "</td><td>" + esc(row.workDate) + "</td><td>" +
              esc(row.checkIn) + "</td><td>" + esc(row.checkOut) + "</td><td>" + esc(row.status) +
              "</td><td>" + esc(row.note) + "</td><td>" + removeBtn("attendance", row.id) + "</td></tr>"
            );
          })
          .join("")
      : emptyRow(7, "这个月还没有打卡");
    setList(root, ["姓名", "日期", "上班", "下班", "状态", "备注", ""], body);
  }

  function fillTimeoff(root, data) {
    var stats = data.stats || {};
    setStats(root, [
      { label: "待审", value: stats.pending || 0 },
      { label: "已通过", value: stats.approved || 0 },
      { label: "已驳回", value: stats.rejected || 0 },
      { label: "已通过时长", value: hoursText(stats.approvedHours) }
    ]);
    var rows = data.timeoff || [];
    var body = rows.length
      ? rows
          .map(function (row) {
            return (
              "<tr><td>" + esc(row.personName) + "</td><td>" + esc(row.startOn) + "</td><td>" +
              esc(row.endOn) + "</td><td>" + esc(hoursText(row.hours)) + "</td><td>" + esc(row.reason) +
              "</td><td>" + choiceBtns("timeoff", row.id, TIMEOFF, row.status) + "</td><td>" +
              removeBtn("timeoff", row.id) + "</td></tr>"
            );
          })
          .join("")
      : emptyRow(7, "还没有调休");
    setList(root, ["姓名", "开始", "结束", "时长", "原因", "状态", ""], body);
  }

  function fillTalent(root, data) {
    var stats = data.stats || {};
    setStats(root, [
      { label: "人数", value: stats.total || 0 },
      { label: "储备", value: stats.reserve || 0 },
      { label: "面试中", value: stats.interviewing || 0 },
      { label: "已入职", value: stats.hired || 0 },
      { label: "已淘汰", value: stats.rejected || 0 }
    ]);
    var rows = data.talents || [];
    var body = rows.length
      ? rows
          .map(function (row) {
            return (
              "<tr><td>" + esc(row.name) + "</td><td>" + esc(row.phone) + "</td><td>" +
              esc(row.targetRole) + "</td><td>" + esc(row.source) + "</td><td>" +
              choiceBtns("talent", row.id, STAGES, row.stage) + "</td><td>" + esc(row.note) +
              "</td><td>" + removeBtn("talent", row.id) + "</td></tr>"
            );
          })
          .join("")
      : emptyRow(7, "还没有人才档案");
    setList(root, ["姓名", "电话", "目标岗位", "来源", "阶段", "备注", ""], body);
  }

  function fillOvertime(root, data) {
    var stats = data.stats || {};
    setStats(root, [{ label: "加班总时长", value: hoursText(stats.totalHours) }]);
    var people = stats.byPerson || [];
    var peopleBox = root.querySelector("[data-people]");
    if (peopleBox) {
      peopleBox.innerHTML = people.length
        ? '<div class="hr-split"><p class="hr-subhead">按人合计</p>' +
          table(
            ["姓名", "时长"],
            people
              .map(function (item) {
                return "<tr><td>" + esc(item.personName) + "</td><td>" + esc(hoursText(item.hours)) + "</td></tr>";
              })
              .join("")
          ).replace("data-list", "data-people-table") +
          "</div>"
        : "";
    }
    var rows = data.overtime || [];
    var body = rows.length
      ? rows
          .map(function (row) {
            return (
              "<tr><td>" + esc(row.personName) + "</td><td>" + esc(row.workDate) + "</td><td>" +
              esc(hoursText(row.hours)) + "</td><td>" + esc(row.reason) + "</td><td>" +
              removeBtn("overtime", row.id) + "</td></tr>"
            );
          })
          .join("")
      : emptyRow(5, "这个月还没有加班");
    setList(root, ["姓名", "日期", "时长", "原因", ""], body);
  }

  function paintPanel(root, tab) {
    var month = shanghaiMonth();
    var today = shanghaiToday();
    var html = "";
    if (tab === "interview") html = interviewPanel(month);
    else if (tab === "attendance") html = attendancePanel(month, today);
    else if (tab === "timeoff") html = timeoffPanel(today);
    else if (tab === "talent") html = talentPanel();
    else html = overtimePanel(month, today);
    var body = root.querySelector(".hr-body");
    body.innerHTML = html;
  }

  function monthQuery(root) {
    var input = root.querySelector("[data-month]");
    var value = input && input.value ? input.value : "";
    return value ? "?month=" + encodeURIComponent(value) : "";
  }

  function loadTab(root, state) {
    var ticket = ++state.ticket;
    var tab = state.tab;
    var path = {
      interview: "/interviews",
      attendance: "/attendance",
      timeoff: "/timeoff",
      talent: "/talents",
      overtime: "/overtime"
    }[tab];
    var query = tab === "timeoff" || tab === "talent" ? "" : monthQuery(root);
    setMsg(root, "", false);
    return api(path + query)
      .then(function (data) {
        if (!state.alive || ticket !== state.ticket || state.tab !== tab) return;
        if (tab === "interview") fillInterview(root, data);
        else if (tab === "attendance") fillAttendance(root, data);
        else if (tab === "timeoff") fillTimeoff(root, data);
        else if (tab === "talent") fillTalent(root, data);
        else fillOvertime(root, data);
      })
      .catch(function (err) {
        if (!state.alive || ticket !== state.ticket || state.tab !== tab) return;
        setMsg(root, err.message || "读取失败", true);
      });
  }

  function formValue(form, name) {
    var el = form.elements[name];
    return el ? String(el.value || "").trim() : "";
  }

  function readForm(form, tab) {
    if (tab === "interview") {
      return {
        candidateName: formValue(form, "candidateName"),
        position: formValue(form, "position"),
        interviewer: formValue(form, "interviewer"),
        interviewAt: formValue(form, "interviewAt"),
        result: formValue(form, "result"),
        note: formValue(form, "note")
      };
    }
    if (tab === "attendance") {
      return {
        personName: formValue(form, "personName"),
        workDate: formValue(form, "workDate"),
        checkIn: formValue(form, "checkIn"),
        checkOut: formValue(form, "checkOut"),
        status: formValue(form, "status"),
        note: formValue(form, "note")
      };
    }
    if (tab === "timeoff") {
      return {
        personName: formValue(form, "personName"),
        startOn: formValue(form, "startOn"),
        endOn: formValue(form, "endOn"),
        hours: formValue(form, "hours"),
        reason: formValue(form, "reason")
      };
    }
    if (tab === "talent") {
      return {
        name: formValue(form, "name"),
        phone: formValue(form, "phone"),
        targetRole: formValue(form, "targetRole"),
        source: formValue(form, "source"),
        stage: formValue(form, "stage"),
        note: formValue(form, "note")
      };
    }
    return {
      personName: formValue(form, "personName"),
      workDate: formValue(form, "workDate"),
      hours: formValue(form, "hours"),
      reason: formValue(form, "reason")
    };
  }

  function selectTab(root, state, id) {
    if (!TABS.some(function (tab) { return tab.id === id; })) return;
    state.tab = id;
    Array.prototype.forEach.call(root.querySelectorAll(".hr-tab"), function (btn) {
      var on = btn.getAttribute("data-tab") === id;
      btn.setAttribute("aria-selected", on ? "true" : "false");
      btn.tabIndex = on ? 0 : -1;
    });
    var panel = root.querySelector(".hr-body");
    var current = TABS.filter(function (tab) { return tab.id === id; })[0];
    panel.setAttribute("aria-labelledby", "hr-tab-" + id);
    panel.dataset.tab = id;
    if (current) panel.setAttribute("aria-label", current.label);
    paintPanel(root, id);
    loadTab(root, state);
  }

  function mount(root) {
    ensureStyle();
    var state = { tab: "interview", ticket: 0, alive: true };
    root.innerHTML =
      '<div class="xm-page hr-page">' +
      '<div class="hr-tabs" role="tablist" aria-label="智能人事">' +
      TABS.map(function (tab, index) {
        var on = index === 0;
        return (
          '<button type="button" class="hr-tab" role="tab" id="hr-tab-' +
          tab.id +
          '" data-tab="' +
          tab.id +
          '" aria-selected="' +
          (on ? "true" : "false") +
          '" tabindex="' +
          (on ? "0" : "-1") +
          '">' +
          esc(tab.label) +
          "</button>"
        );
      }).join("") +
      '</div><div class="hr-body" role="tabpanel" aria-labelledby="hr-tab-interview"></div></div>';
    paintPanel(root, state.tab);

    function onClick(event) {
      var tabBtn = event.target.closest(".hr-tab");
      if (tabBtn && root.contains(tabBtn)) {
        event.preventDefault();
        selectTab(root, state, tabBtn.getAttribute("data-tab"));
        return;
      }
      var btn = event.target.closest("[data-act]");
      if (!btn || !root.contains(btn)) return;
      var act = btn.getAttribute("data-act");
      var id = btn.getAttribute("data-id");
      if (act === "delete") {
        var kind = btn.getAttribute("data-kind");
        var path = {
          interview: "/interviews/",
          attendance: "/attendance/",
          timeoff: "/timeoff/",
          talent: "/talents/",
          overtime: "/overtime/"
        }[kind];
        if (!path || !window.confirm("删除这条记录？")) return;
        api(path + id, { method: "DELETE" })
          .then(function () { loadTab(root, state); })
          .catch(function (err) { setMsg(root, err.message, true); });
        return;
      }
      if (act === "timeoff" || act === "talent") {
        var body = act === "timeoff" ? { status: btn.getAttribute("data-value") } : { stage: btn.getAttribute("data-value") };
        var patchPath = act === "timeoff" ? "/timeoff/" : "/talents/";
        api(patchPath + id, { method: "PATCH", body: body })
          .then(function () { loadTab(root, state); })
          .catch(function (err) { setMsg(root, err.message, true); });
      }
    }

    function onSubmit(event) {
      var form = event.target.closest("form[data-form]");
      if (!form || !root.contains(form)) return;
      event.preventDefault();
      var kind = form.getAttribute("data-form");
      var path = {
        interview: "/interviews",
        attendance: "/attendance",
        timeoff: "/timeoff",
        talent: "/talents",
        overtime: "/overtime"
      }[kind];
      var button = form.querySelector("button[type='submit']");
      if (button) button.disabled = true;
      api(path, { method: "POST", body: readForm(form, kind) })
        .then(function () {
          form.reset();
          var today = shanghaiToday();
          ["workDate", "startOn", "endOn"].forEach(function (name) {
            if (form.elements[name] && form.elements[name].type === "date") form.elements[name].value = today;
          });
          loadTab(root, state);
        })
        .catch(function (err) {
          setMsg(root, err.message, true);
        })
        .then(function () {
          if (button) button.disabled = false;
        });
    }

    function onChange(event) {
      if (event.target && event.target.matches("[data-month]")) loadTab(root, state);
    }

    root.addEventListener("click", onClick);
    root.addEventListener("submit", onSubmit);
    root.addEventListener("change", onChange);
    loadTab(root, state);

    return function unmount() {
      state.alive = false;
      root.removeEventListener("click", onClick);
      root.removeEventListener("submit", onSubmit);
      root.removeEventListener("change", onChange);
      root.innerHTML = "";
    };
  }

  window.XmModules = window.XmModules || {};
  window.XmModules["/hr"] = {
    mount: mount,
    unmount: function () {}
  };
})();
