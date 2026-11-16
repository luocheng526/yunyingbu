/* xm-module-hr — 智能人事。只挂 /hr。假勤只读钉钉落库，招聘记在服务器上。 */
(function () {
  var TABS = [
    { id: "attendance", label: "数据看板" },
    { id: "overtime", label: "奋斗时长" },
    { id: "recruit", label: "招聘中心" },
    { id: "staff", label: "员工花名册" }
  ];
  var GENDERS = ["男", "女"];
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
      ".hr-top{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;border-bottom:1px solid var(--xm-line);margin:0 0 12px;}" +
      ".hr-tabs{display:flex;gap:0;min-width:0;overflow:auto;}" +
      ".hr-refresh{display:flex;align-items:center;gap:10px;padding:0 0 8px;flex:none;}" +
      ".hr-updated{color:var(--xm-muted);font-size:13px;white-space:nowrap;}" +
      ".hr-tab{appearance:none;border:0;border-bottom:2px solid transparent;background:transparent;color:var(--xm-muted);font:inherit;font-size:14px;padding:10px 16px;cursor:pointer;white-space:nowrap;}" +
      ".hr-tab[aria-selected='true']{color:var(--xm-primary);border-bottom-color:var(--xm-primary);font-weight:600;}" +
      ".hr-tab:focus-visible,.hr-page button:focus-visible,.hr-page input:focus-visible,.hr-page select:focus-visible,.hr-page textarea:focus-visible{outline:2px solid var(--xm-primary);outline-offset:1px;}" +
      ".hr-panel{display:flex;flex-direction:column;gap:12px;}" +
      ".hr-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(128px,1fr));gap:8px;}" +
      ".hr-kpi{background:var(--xm-card);border:1px solid var(--xm-line);border-radius:8px;padding:10px 12px;box-shadow:var(--xm-shadow);}" +
      ".hr-kpi b{display:block;font-size:22px;line-height:1.2;font-variant-numeric:tabular-nums;color:var(--xm-ink);}" +
      ".hr-kpi span{display:block;margin-top:2px;color:var(--xm-muted);font-size:12px;}" +
      ".hr-card{background:var(--xm-card);border:1px solid var(--xm-line);border-radius:8px;box-shadow:var(--xm-shadow);}" +
      ".hr-form{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;padding:12px;}" +
      ".hr-field{display:flex;flex-direction:column;gap:4px;min-width:140px;flex:1 1 140px;color:var(--xm-muted);font-size:12px;}" +
      ".hr-field input,.hr-field select{height:32px;border:1px solid var(--xm-line);border-radius:6px;background:var(--xm-card);color:var(--xm-ink);padding:0 8px;font:inherit;font-size:13px;}" +
      ".hr-field textarea{min-height:64px;border:1px solid var(--xm-line);border-radius:6px;background:var(--xm-card);color:var(--xm-ink);padding:6px 8px;font:inherit;font-size:13px;resize:vertical;}" +
      ".hr-field-grow{flex:2 1 220px;}" +
      ".hr-field-wide{flex:1 1 100%;}" +
      ".hr-rank-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;}" +
      ".hr-rank-list{margin:0;padding:0;list-style:none;}" +
      ".hr-rank-list li{display:flex;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid var(--xm-line);cursor:pointer;}" +
      ".hr-rank-list li[aria-expanded='true']{color:var(--xm-primary);}" +
      ".hr-watch{display:flex;flex-direction:column;gap:10px;}" +
      ".hr-watch-banner{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:10px 12px;border:1px solid var(--xm-line);border-radius:8px;background:var(--xm-card);}" +
      ".hr-watch-banner.is-conflict{border-color:#cf1322;color:#cf1322;}" +
      ".hr-watch-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;}" +
      ".hr-watch-kpi{text-align:left;border:1px solid var(--xm-line);border-radius:8px;background:var(--xm-card);padding:10px 12px;cursor:pointer;color:var(--xm-ink);font:inherit;}" +
      ".hr-watch-kpi.is-on{border-color:var(--xm-primary);box-shadow:0 0 0 1px var(--xm-primary);}" +
      ".hr-watch-kpi b{display:block;font-size:22px;line-height:1.2;}" +
      ".hr-watch-kpi span{display:block;margin-top:2px;color:var(--xm-muted);font-size:12px;}" +
      ".hr-link{display:flex;flex-wrap:wrap;gap:8px;align-items:center;}" +
      ".hr-link select{height:32px;border:1px solid var(--xm-line);border-radius:6px;background:var(--xm-card);color:var(--xm-ink);font:inherit;}" +
      ".hr-toolbar{display:flex;justify-content:space-between;gap:8px;align-items:center;color:var(--xm-muted);font-size:13px;}" +
      ".hr-month input,.hr-month select{height:32px;border:1px solid var(--xm-line);border-radius:6px;background:var(--xm-card);color:var(--xm-ink);padding:0 8px;font:inherit;}" +
      ".hr-primary{height:32px;border:0;border-radius:6px;background:var(--xm-primary);color:#fff;padding:0 14px;font:inherit;font-size:13px;cursor:pointer;}" +
      ".hr-table-wrap{overflow:auto;}" +
      ".hr-table{width:100%;border-collapse:collapse;font-size:13px;}" +
      ".hr-table th{text-align:left;color:var(--xm-muted);font-weight:600;padding:8px 10px;border-bottom:1px solid var(--xm-line);white-space:nowrap;}" +
      ".hr-table td{padding:8px 10px;border-bottom:1px solid var(--xm-line);vertical-align:middle;}" +
      ".hr-empty{padding:28px 12px;text-align:center;color:var(--xm-muted);}" +
      ".hr-msg{min-height:18px;color:var(--xm-muted);font-size:12px;}" +
      ".hr-msg:empty{display:none;min-height:0;}" +
      ".hr-joined{color:#12b36a;font-weight:650;white-space:nowrap;}" +
      ".hr-msg.is-error{color:#cf1322;}" +
      "html[data-theme='dark'] .hr-msg.is-error{color:#ff7875;}" +
      ".hr-mini{height:26px;border:1px solid var(--xm-line);border-radius:6px;background:var(--xm-card);color:var(--xm-ink);padding:0 8px;font:inherit;font-size:12px;cursor:pointer;}" +
      ".hr-person{cursor:pointer;}" +
      ".hr-person[aria-expanded='true'] td{background:color-mix(in srgb,var(--xm-primary) 8%,var(--xm-card));}" +
      ".hr-detail td{padding:8px 10px 12px;}" +
      ".hr-board-head{display:flex;justify-content:flex-end;gap:12px;align-items:center;}" +
      ".hr-board-head .hr-msg:not(:empty){margin-right:auto;}" +
      ".hr-board-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;}" +
      ".hr-board-kpi{border:0;border-radius:16px;padding:16px 16px 14px;color:#fff;min-height:108px;box-shadow:0 10px 22px rgba(24,49,99,.12);}" +
      "button.hr-board-kpi{width:100%;text-align:left;cursor:pointer;font:inherit;}" +
      "button.hr-board-kpi.is-on{box-shadow:0 0 0 3px rgba(16,24,40,.35),0 10px 22px rgba(24,49,99,.18);}" +
      ".hr-staff-kpis{grid-template-columns:repeat(2,minmax(0,1fr));}" +
      ".hr-cell{width:100%;min-width:88px;height:28px;border:1px solid var(--xm-line);border-radius:6px;background:var(--xm-card);color:var(--xm-ink);padding:0 6px;font:inherit;font-size:12px;}" +
      ".hr-cell-wide{min-width:140px;}" +
      ".hr-board-kpi i{display:flex;width:28px;height:28px;border-radius:8px;align-items:center;justify-content:center;background:rgba(255,255,255,.22);}" +
      ".hr-board-kpi i svg{width:16px;height:16px;stroke:#fff;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;}" +
      ".hr-board-kpi b{display:block;margin-top:10px;font-size:34px;line-height:1;font-weight:700;font-variant-numeric:tabular-nums;}" +
      ".hr-board-kpi span{display:block;margin-top:8px;font-size:13px;opacity:.95;}" +
      ".hr-recruit-kpis .hr-board-kpi b{margin-top:6px;font-size:18px;font-weight:650;}" +
      ".hr-recruit-kpis .hr-board-kpi span{margin-top:8px;font-size:22px;font-weight:700;line-height:1.25;opacity:1;}" +
      ".hr-kpi-list{margin-top:4px;}" +
      ".hr-kpi-list:empty{display:none;}" +
      ".hr-kpi-list h3{margin:0 0 8px;font-size:14px;font-weight:650;color:var(--xm-ink);}" +
      ".hr-status-work{color:#0f9f6e;font-weight:650;}" +
      ".hr-status-late{color:#7c5cff;font-weight:650;}" +
      ".hr-status-leave{color:#f08a24;font-weight:650;}" +
      ".hr-status-miss{color:var(--xm-muted);}" +
      ".hr-tone-staff{background:linear-gradient(135deg,#3dcbd6,#1499c4);}" +
      ".hr-tone-due{background:linear-gradient(135deg,#3adf8a,#12b36a);}" +
      ".hr-tone-punch{background:linear-gradient(135deg,#5b8cff,#3a63f5);}" +
      ".hr-tone-late{background:linear-gradient(135deg,#8d7cff,#6847f0);}" +
      ".hr-tone-leave{background:linear-gradient(135deg,#ffb057,#ff7a18);}" +
      ".hr-board-grid{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(240px,.8fr);gap:12px;}" +
      ".hr-board-card{padding:14px 16px 16px;}" +
      ".hr-board-card h3{margin:0 0 12px;font-size:14px;font-weight:650;color:var(--xm-ink);}" +
      ".hr-bar-row{display:grid;grid-template-columns:minmax(108px,168px) minmax(0,1fr) 36px;gap:8px;align-items:center;margin:0 0 10px;}" +
      ".hr-bar-name{color:var(--xm-muted);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
      ".hr-bar-track{height:10px;border-radius:999px;background:color-mix(in srgb,var(--xm-primary) 12%,var(--xm-line));overflow:hidden;}" +
      ".hr-bar-fill{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#7a6cff,#3a63f5);}" +
      ".hr-bar-row b{text-align:right;font-size:13px;color:var(--xm-ink);font-variant-numeric:tabular-nums;}" +
      ".hr-day-cols{display:flex;align-items:flex-end;gap:8px;height:148px;padding-top:8px;}" +
      ".hr-day-col{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:6px;min-width:0;height:100%;}" +
      ".hr-day-col b{font-size:12px;color:var(--xm-ink);font-variant-numeric:tabular-nums;}" +
      ".hr-day-fill{width:100%;max-width:28px;border-radius:8px 8px 4px 4px;background:linear-gradient(180deg,#8d7cff,#3a63f5);min-height:4px;}" +
      ".hr-day-col span{color:var(--xm-muted);font-size:11px;}" +
      ".hr-team{display:flex;flex-direction:column;gap:12px;}" +
      ".hr-team + .hr-team{margin-top:8px;padding-top:16px;border-top:1px solid var(--xm-line);}" +
      ".hr-team-title{margin:0;font-size:16px;font-weight:700;color:var(--xm-ink);}" +
      ".hr-board-sub{margin:4px 0 0;font-size:14px;font-weight:650;color:var(--xm-ink);}" +
      "@media (max-width:980px){.hr-board-kpis{grid-template-columns:repeat(2,minmax(0,1fr));}.hr-board-grid{grid-template-columns:1fr;}}";
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
      var key = (row.dingtalkUserId || row.personId) + "|" + row.workDate;
      if (!groups[key]) {
        groups[key] = {
          personId: row.personId,
          userName: row.userName || "",
          department: row.department || "",
          jobNumber: row.jobNumber || "",
          workDate: row.workDate,
          on: "",
          off: "",
          labels: [],
          status: ""
        };
      }
      if (row.department && !groups[key].department) groups[key].department = row.department;
      if (row.checkType === "OffDuty") groups[key].off = row.checkAt || "";
      else groups[key].on = row.checkAt || "";
      if (row.label) groups[key].labels.push(row.label);
      if (row.status) groups[key].status = row.status;
    });
    return Object.keys(groups).map(function (key) { return groups[key]; });
  }

  function paint(root, tab, month, today) {
    var hint = "钉钉是来源，这里只显示已经拉下来的记录。没有就空着。";
    var monthBar = '<div class="hr-toolbar"><span>' + esc(hint) + '</span><label class="hr-month">月份<input type="month" data-month value="' + esc(month) + '" /></label></div>';
    var html = "";
    if (tab === "attendance") {
      var teams = [
        { id: "ops", title: "甄选运营团队看板" },
        { id: "backend", title: "后端团队看板" },
        { id: "total", title: "总看板" }
      ];
      html = '<section class="hr-panel hr-board">' +
        '<div class="hr-board-head"><p class="hr-msg" data-msg></p>' +
        '<label class="hr-month">统计日<input type="date" data-day value="' + esc(addDays(today, -1)) + '" /></label></div>' +
        teams.map(function (team) {
          return '<section class="hr-team" data-team="' + team.id + '"><h2 class="hr-team-title">' + esc(team.title) + "</h2>" +
            '<div class="hr-board-kpis" data-board></div><div class="hr-kpi-list" data-kpi-list></div>' +
            '<div class="hr-board-grid"><section class="hr-card hr-board-card" data-depts></section>' +
            '<section class="hr-card hr-board-card" data-days></section></div>' +
            '<h3 class="hr-board-sub">当日打卡</h3>' +
            table(["姓名", "部门", "工号", "日期", "上班", "下班", "状态"], emptyRow(7, "还没有打卡")).replace("data-list", "data-punch-list") + "</section>";
        }).join("") + "</section>";
    } else if (tab === "overtime") {
      html = '<section class="hr-panel hr-effort"><div class="hr-toolbar"><span>运营部门，18:00 之后的下班打卡。角色从组织中心对齐。</span>' +
        '<span class="hr-link"><button type="button" class="hr-mini" data-act="download">下载表格</button>' +
        '<label class="hr-month">月份<input type="month" data-month value="' + esc(month) + '" /></label></span></div>' +
        '<div class="hr-board-kpis" data-effort-kpis></div>' +
        '<section class="hr-card hr-board-card" data-teams></section>' +
        '<div class="hr-rank-grid" data-ranks></div>' +
        '<section class="hr-card hr-watch" data-watch></section>' +
        '<p class="hr-msg" data-msg></p>' +
        table(["姓名", "部门", "角色", "组织", "月累计"], emptyRow(5, "这个月还没有 18 点后的下班打卡")) + "</section>";
    } else if (tab === "recruit") {
      html = '<section class="hr-panel"><div class="hr-toolbar"><span>按月统计待入职。点登记后进入花名册在职，记录在服务器上。</span>' +
        '<label class="hr-month">月份<input type="month" data-join-month value="' + esc(String(today).slice(0, 7)) + '" /></label></div>' +
        '<div class="hr-board-kpis hr-recruit-kpis" data-recruit-kpis></div>' +
        '<h2 class="hr-team-title">待入职</h2>' +
        '<form class="hr-form hr-card" data-form="recruit">' +
        field("姓名", '<input name="name" required maxlength="64" autocomplete="off" />') +
        field("性别", '<select name="gender"><option value="">请选择</option>' + options(GENDERS, "") + "</select>") +
        field("应聘岗位", '<input name="position" maxlength="64" autocomplete="off" />') +
        field("预计入职时间", '<input name="expectedJoin" type="date" />') +
        field("联系电话", '<input name="phone" maxlength="32" autocomplete="off" />') +
        field("籍贯", '<input name="hometown" maxlength="64" autocomplete="off" />') +
        field("渠道", '<input name="channel" maxlength="64" autocomplete="off" />') +
        field("邀约人", '<input name="inviter" maxlength="64" autocomplete="off" />') +
        field("备注", '<input name="note" maxlength="500" autocomplete="off" />', "hr-field-grow") +
        field("情况说明", '<textarea name="detail" maxlength="1000" rows="3"></textarea>', "hr-field-wide") +
        '<button class="hr-primary" type="submit">登记待入职</button></form>' +
        table(["姓名", "性别", "应聘岗位", "预计入职时间", "联系电话", "籍贯", "渠道", "邀约人", "备注", "情况说明", "是否登记入职", ""], emptyRow(12, "这个月还没有待入职")) +
        '<h2 class="hr-team-title">入职情况表</h2>' +
        '<form class="hr-form hr-card" data-form="onboard">' +
        field("姓名", '<input name="name" required maxlength="64" autocomplete="off" />') +
        field("性别", '<select name="gender"><option value="">请选择</option>' + options(GENDERS, "") + "</select>") +
        field("入职部门", '<input name="department" maxlength="64" autocomplete="off" />') +
        field("岗位", '<input name="position" maxlength="64" autocomplete="off" />') +
        field("入职日期", '<input name="joinedOn" type="date" />') +
        field("联系电话", '<input name="phone" maxlength="32" autocomplete="off" />') +
        field("籍贯", '<input name="hometown" maxlength="64" autocomplete="off" />') +
        field("渠道", '<input name="channel" maxlength="64" autocomplete="off" />') +
        field("邀约人", '<input name="inviter" maxlength="64" autocomplete="off" />') +
        field("备注", '<input name="note" maxlength="500" autocomplete="off" />', "hr-field-grow") +
        field("情况说明", '<textarea name="detail" maxlength="1000" rows="3"></textarea>', "hr-field-wide") +
        '<button class="hr-primary" type="submit">登记入职情况</button></form>' +
        '<p class="hr-msg" data-msg></p>' +
        table(["姓名", "性别", "入职部门", "岗位", "入职日期", "联系电话", "籍贯", "渠道", "邀约人", "备注", "情况说明", ""], emptyRow(12, "还没有入职情况")).replace("data-list", "data-onboards") +
        "</section>";
    } else {
      html = '<section class="hr-panel"><div class="hr-toolbar"><span>运营打卡人员的在职和离职记在服务器上。可以手填、导入表格，或从打卡带入。</span>' +
        '<span class="hr-link"><button type="button" class="hr-mini" data-act="staff-template">下载模板</button>' +
        '<button type="button" class="hr-mini" data-act="staff-pick">导入表格</button>' +
        '<input type="file" accept=".csv,text/csv" data-staff-file hidden />' +
        '<button type="button" class="hr-mini" data-act="staff-sync">从打卡带入</button></span></div>' +
        '<div class="hr-board-kpis hr-staff-kpis" data-staff-kpis></div>' +
        '<form class="hr-form hr-card" data-form="staff">' +
        field("姓名", '<input name="name" required maxlength="64" autocomplete="off" />') +
        field("性别", '<select name="gender"><option value="">请选择</option>' + options(GENDERS, "") + "</select>") +
        field("工号", '<input name="jobNumber" maxlength="64" autocomplete="off" />') +
        field("部门", '<input name="department" maxlength="64" autocomplete="off" />') +
        field("岗位", '<input name="position" maxlength="64" autocomplete="off" />') +
        field("联系电话", '<input name="phone" maxlength="32" autocomplete="off" />') +
        field("入职日期", '<input name="joinedOn" type="date" />') +
        field("离职日期", '<input name="leftOn" type="date" />') +
        field("状态", '<select name="status">' + options(["在职", "离职"], "在职") + "</select>") +
        field("籍贯", '<input name="hometown" maxlength="64" autocomplete="off" />') +
        field("学历", '<input name="education" maxlength="32" autocomplete="off" />') +
        field("紧急联系人", '<input name="emergencyName" maxlength="64" autocomplete="off" />') +
        field("紧急电话", '<input name="emergencyPhone" maxlength="32" autocomplete="off" />') +
        field("备注", '<input name="note" maxlength="500" autocomplete="off" />', "hr-field-grow") +
        '<button class="hr-primary" type="submit">登记</button></form>' +
        '<p class="hr-msg" data-msg></p>' +
        '<div class="hr-toolbar"><h2 class="hr-team-title">甄选员工详细名单</h2>' +
        '<label class="hr-month">搜索<input type="search" data-staff-search placeholder="姓名、工号、部门、电话" /></label></div>' +
        table(["姓名", "性别", "工号", "部门", "岗位", "联系电话", "入职日期", "离职日期", "状态", "籍贯", "学历", "紧急联系人", "紧急电话", "备注", ""], emptyRow(15, "还没有花名册")) +
        "</section>";
    }
    root.querySelector(".hr-body").innerHTML = html;
    void today;
  }

  function boardIcon(kind) {
    var paths = {
      staff: '<circle cx="8" cy="5" r="2.2"/><path d="M3 13c.6-2.2 2.4-3.2 5-3.2s4.4 1 5 3.2"/>',
      due: '<rect x="3" y="3" width="10" height="10" rx="2"/><path d="M5.5 8.2l1.6 1.6 3.4-3.6"/>',
      punch: '<circle cx="8" cy="8" r="5"/><path d="M8 5.2V8l2 1.4"/>',
      late: '<path d="M8 2.5l1.4 3.2 3.4.3-2.6 2.2.8 3.3L8 9.8 4.9 11.5l.8-3.3L3.2 6l3.4-.3z"/>',
      leave: '<path d="M4 12V4.5L8 3l4 1.5V12"/><path d="M6 12V7.5h4V12"/>'
    };
    return "<i>" + '<svg viewBox="0 0 16 16" aria-hidden="true">' + (paths[kind] || "") + "</svg></i>";
  }

  function fillTeam(section, view) {
    if (!section) return;
    var board = (view && view.board) || { staff: 0, expected: 0, punched: 0, late: 0, leave: 0, date: "", departments: [] };
    var prefix = board.date && board.date === shanghaiToday() ? "今日" : "当日";
    var open = section.getAttribute("data-open") || "";
    var cards = [
      { key: "staff", tone: "staff", icon: "staff", label: "员工人数", value: board.staff || 0 },
      { key: "due", tone: "due", icon: "due", label: prefix + "应到人数", value: board.expected || 0 },
      { key: "punch", tone: "punch", icon: "punch", label: prefix + "打卡人数", value: board.punched || 0 },
      { key: "late", tone: "late", icon: "late", label: prefix + "迟到人数", value: board.late || 0 },
      { key: "leave", tone: "leave", icon: "leave", label: prefix + "请假人数", value: board.leave || 0 }
    ];
    var box = section.querySelector("[data-board]");
    if (box) {
      box.innerHTML = cards.map(function (card) {
        return '<button type="button" class="hr-board-kpi hr-tone-' + card.tone + (open === card.key ? " is-on" : "") +
          '" data-kpi="' + card.key + '">' + boardIcon(card.icon) +
          "<b>" + esc(card.value) + "</b><span>" + esc(card.label) + "</span></button>";
      }).join("");
    }
    fillKpiList(section, (view && view.roster) || []);
    var depts = board.departments || [];
    var maxCount = depts.reduce(function (max, row) { return Math.max(max, row.count || 0); }, 0) || 1;
    var deptBox = section.querySelector("[data-depts]");
    if (deptBox) {
      var rows = depts.length ? depts.map(function (row) {
        var width = Math.max(4, Math.round((row.count / maxCount) * 100));
        return '<div class="hr-bar-row"><span class="hr-bar-name">' + esc(row.name) + '</span><span class="hr-bar-track"><span class="hr-bar-fill" style="width:' +
          width + '%"></span></span><b>' + esc(row.count) + "</b></div>";
      }).join("") : '<div class="hr-empty">这个范围还没有部门人数。</div>';
      deptBox.innerHTML = "<h3>" + esc(prefix) + "部门人数</h3>" + rows;
    }
    var series = (view && view.days) || [];
    var maxPunch = series.reduce(function (max, row) { return Math.max(max, row.punched || 0); }, 0) || 1;
    var dayBox = section.querySelector("[data-days]");
    if (dayBox) {
      var cols = series.length ? series.map(function (row) {
        var height = Math.max(8, Math.round(((row.punched || 0) / maxPunch) * 96));
        var label = String(row.date || "").slice(5);
        return '<div class="hr-day-col"><b>' + esc(row.punched || 0) + '</b><span class="hr-day-fill" style="height:' + height +
          'px"></span><span>' + esc(label) + "</span></div>";
      }).join("") : '<div class="hr-empty">还没有每日统计。</div>';
      dayBox.innerHTML = "<h3>近 7 日打卡人数</h3>" + (series.length ? '<div class="hr-day-cols">' + cols + "</div>" : cols);
    }
    var roster = (view && view.roster) || [];
    var days = pairPunches((view && view.punches) || []).sort(function (a, b) {
      return String(a.department).localeCompare(String(b.department), "zh") || String(a.userName).localeCompare(String(b.userName), "zh");
    });
    var body = days.length ? days.map(function (row) {
      var status = showStatus(row, roster);
      return "<tr><td>" + esc(row.userName || "未命名") + "</td><td>" + esc(row.department) + "</td><td>" + esc(row.jobNumber) +
        "</td><td>" + esc(row.workDate) + "</td><td>" + esc(row.on) + "</td><td>" + esc(row.off) +
        '</td><td class="' + statusClass(status) + '">' + esc(status) + "</td></tr>";
    }).join("") : emptyRow(7, "还没有打卡");
    var list = section.querySelector("[data-punch-list]");
    if (list) list.outerHTML = table(["姓名", "部门", "工号", "日期", "上班", "下班", "状态"], body).replace("data-list", "data-punch-list");
  }

  function showStatus(row, roster) {
    if (row.status) return row.status;
    var person = (roster || []).filter(function (item) {
      return item.name && item.name === row.userName && (!row.department || !item.department || item.department === row.department);
    })[0];
    if (!person) person = (roster || []).filter(function (item) { return item.name && item.name === row.userName; })[0];
    if (person && person.onLeave) return person.leaveName || "请假";
    if (person && person.late) return person.lateLabel || "迟到";
    if ((person && person.punched) || row.on || row.off) return "上班";
    var labels = row.labels || [];
    if (labels.indexOf("严重迟到") >= 0) return "严重迟到";
    if (labels.indexOf("旷工迟到") >= 0) return "旷工迟到";
    if (labels.indexOf("迟到") >= 0) return "迟到";
    if (labels.indexOf("早退") >= 0) return "早退";
    return "未打卡";
  }

  function statusClass(text) {
    if (text === "上班" || text.indexOf("上班") === 0) return "hr-status-work";
    if (text === "未打卡") return "hr-status-miss";
    if (text.indexOf("迟到") >= 0 || text.indexOf("早退") >= 0 || text.indexOf("旷工") >= 0) return "hr-status-late";
    return "hr-status-leave";
  }

  function fillKpiList(section, roster) {
    var box = section.querySelector("[data-kpi-list]");
    if (!box) return;
    var kind = section.getAttribute("data-open") || "";
    if (!kind) {
      box.innerHTML = "";
      return;
    }
    var titles = { staff: "员工明细", due: "应到明细", punch: "打卡明细", late: "迟到明细", leave: "请假明细" };
    var rows = (roster || []).filter(function (row) {
      if (kind === "due") return !row.onLeave;
      if (kind === "punch") return row.punched;
      if (kind === "late") return row.late;
      if (kind === "leave") return row.onLeave;
      return true;
    }).sort(function (a, b) {
      return String(a.department).localeCompare(String(b.department), "zh") || String(a.name).localeCompare(String(b.name), "zh");
    });
    var headers = ["姓名", "部门", "工号"];
    var body = "";
    if (!roster.length) {
      body = emptyRow(3, "点刷新数据后可以看明细");
    } else if (!rows.length) {
      if (kind === "late") headers = ["姓名", "部门", "工号", "应上班", "打卡时间", "迟到"];
      else if (kind === "leave") headers = ["姓名", "部门", "假期", "开始", "结束", "时长"];
      else if (kind === "punch") headers = ["姓名", "部门", "工号", "上班", "下班"];
      body = emptyRow(headers.length, kind === "late" ? "这一天没有迟到的人" : kind === "leave" ? "这一天没有请假的人" : "没有对应的人");
    } else if (kind === "late") {
      headers = ["姓名", "部门", "工号", "应上班", "打卡时间", "迟到"];
      body = rows.map(function (row) {
        var minutes = row.lateMinutes ? row.lateMinutes + "分钟" : "";
        var result = [row.lateLabel, minutes].filter(Boolean).join(" ");
        return "<tr><td>" + esc(row.name || "未命名") + "</td><td>" + esc(row.department) + "</td><td>" + esc(row.jobNumber) +
          "</td><td>" + esc(String(row.planAt || "").slice(11)) + "</td><td>" + esc(String(row.on || "").slice(11)) + "</td><td>" + esc(result) + "</td></tr>";
      }).join("");
    } else if (kind === "leave") {
      headers = ["姓名", "部门", "假期", "开始", "结束", "时长"];
      body = rows.map(function (row) {
        return "<tr><td>" + esc(row.name || "未命名") + "</td><td>" + esc(row.department) + "</td><td>" + esc(row.leaveName || "请假") +
          "</td><td>" + esc(row.leaveStart) + "</td><td>" + esc(row.leaveEnd) + "</td><td>" + esc(row.leaveDuration) + "</td></tr>";
      }).join("");
    } else if (kind === "punch") {
      headers = ["姓名", "部门", "工号", "上班", "下班"];
      body = rows.map(function (row) {
        return "<tr><td>" + esc(row.name || "未命名") + "</td><td>" + esc(row.department) + "</td><td>" + esc(row.jobNumber) +
          "</td><td>" + esc(String(row.on || "").slice(11)) + "</td><td>" + esc(String(row.off || "").slice(11)) + "</td></tr>";
      }).join("");
    } else {
      body = rows.map(function (row) {
        return "<tr><td>" + esc(row.name || "未命名") + "</td><td>" + esc(row.department) + "</td><td>" + esc(row.jobNumber) + "</td></tr>";
      }).join("");
    }
    box.innerHTML = "<h3>" + esc(titles[kind] || "明细") + "</h3>" + table(headers, body).replace("data-list", "data-kpi-table");
  }

  function setUpdated(root, value) {
    var node = root.querySelector("[data-updated]");
    if (!node) return;
    node.textContent = value ? "更新于 " + value : "尚未更新";
  }

  function fillAttendance(root, pack) {
    var boards = pack.boards || [];
    ["ops", "backend", "total"].forEach(function (id) {
      var view = boards.filter(function (item) { return item.id === id; })[0];
      if (!view && id === "ops" && pack.board) view = { board: pack.board, days: pack.days, punches: pack.punches };
      fillTeam(root.querySelector('[data-team="' + id + '"]'), view || { board: {}, days: [], punches: [] });
    });
    setUpdated(root, pack.updatedAt);
    if (!pack.configured) setMsg(root, "钉钉还没配置，看板先按空模板放着。", false);
    else if (!pack.saved) setMsg(root, "这一天还没归档。每天 10 点保存前一天。", false);
    else setMsg(root, "", false);
  }

  function dayRows(person) {
    return (person.days || []).map(function (day) {
      return "<tr><td>" + esc(day.date) + "</td><td>" + esc(String(day.offAt || "").slice(11, 16)) + "</td><td>" + esc(day.hours) + "</td></tr>";
    }).join("");
  }

  function choicePeople(pack) {
    return ((pack.choices || {}).people || []).map(function (person) {
      return '<option value="' + esc(person.id) + '">' + esc(person.name) + " · " + esc(person.role || "未标角色") + " · " + esc(person.department) + "</option>";
    }).join("");
  }

  function choiceUsers(pack) {
    return ((pack.choices || {}).users || []).map(function (user) {
      return '<option value="' + esc(user.userId) + '">' + esc(user.name) + " · " + esc(user.department) + "</option>";
    }).join("");
  }

  function fillEffort(root, pack) {
    var cards = [
      { tone: "staff", label: "参与总人数", value: pack.participants || 0 },
      { tone: "due", label: "在册人数", value: pack.roster || 0 },
      { tone: "punch", label: "本月总时长", value: pack.hours || 0 },
      { tone: "late", label: "人均时长", value: pack.average || 0 },
      { tone: "leave", label: "未对齐", value: pack.unmatched || 0 }
    ];
    var kpi = root.querySelector("[data-effort-kpis]");
    if (kpi) {
      kpi.innerHTML = cards.map(function (card) {
        return '<article class="hr-board-kpi hr-tone-' + card.tone + '"><b>' + esc(card.value) + "</b><span>" + esc(card.label) + "</span></article>";
      }).join("");
    }
    var teams = pack.teams || [];
    var teamBox = root.querySelector("[data-teams]");
    if (teamBox) {
      var teamBody = teams.length ? teams.map(function (team) {
        return "<tr><td>" + esc(team.name) + "</td><td>" + esc(team.roster) + "</td><td>" + esc(team.participants) +
          "</td><td>" + esc(team.hours) + "</td><td>" + esc(team.average) + "</td></tr>";
      }).join("") : emptyRow(5, "还没有运营团队");
      teamBox.innerHTML = "<h3>各团队平均时长</h3><div class=\"hr-table-wrap\"><table class=\"hr-table\"><thead><tr><th>团队</th><th>在册</th><th>参与</th><th>总时长</th><th>平均时长</th></tr></thead><tbody>" +
        teamBody + "</tbody></table></div>";
    }
    var open = root.getAttribute("data-open") || "";
    var rankBox = root.querySelector("[data-ranks]");
    if (rankBox) {
      rankBox.innerHTML = (pack.ranks || []).map(function (rank) {
        var items = (rank.rows || []).length ? rank.rows.map(function (row, index) {
          var on = open === row.userId;
          var days = on ? '<div class="hr-table-wrap"><table class="hr-table"><thead><tr><th>日期</th><th>下班</th><th>时长</th></tr></thead><tbody>' +
            (dayRows(row) || emptyRow(3, "这个月没有 18 点后的下班")) + "</tbody></table></div>" : "";
          return '<li data-effort="' + esc(row.userId) + '" aria-expanded="' + (on ? "true" : "false") + '"><span>' + (index + 1) + ". " +
            esc(row.name || "未命名") + (row.department ? " · " + esc(row.department) : "") + "</span><b>" + esc(row.hours) + "</b>" + days + "</li>";
        }).join("") : '<li class="hr-empty">这个角色还没有对上的人</li>';
        return '<section class="hr-card hr-board-card"><h3>' + esc(rank.title) + '</h3><ul class="hr-rank-list">' + items + "</ul></section>";
      }).join("");
    }
    var watch = pack.watch || {};
    var watchBox = root.querySelector("[data-watch]");
    var opened = root.getAttribute("data-watch") || "";
    if (watchBox) {
      var issue = "";
      if (opened === "人员对不上") {
        issue = (watch.dingMiss || []).length ? (watch.dingMiss || []).map(function (row) {
          return '<div class="hr-link" data-link><span>' + esc(row.name) + " · " + esc(row.department) + " · 工号 " + esc(row.jobNumber || "空") +
            '</span><select data-pick-person><option value="">选择组织里的人</option>' + choicePeople(pack) + '</select>' +
            '<button type="button" class="hr-mini" data-act="bind" data-user="' + esc(row.userId) + '">保存对齐</button></div>';
        }).join("") : '<div class="hr-empty">没有对不上的钉钉人员。</div>';
      } else if (opened === "组织对不上") {
        issue = (watch.orgMiss || []).length ? (watch.orgMiss || []).map(function (row) {
          return '<div class="hr-link" data-link><span>' + esc(row.name) + " · " + esc(row.role) + " · " + esc(row.department) +
            '</span><select data-pick-user><option value="">选择钉钉里的人</option>' + choiceUsers(pack) + '</select>' +
            '<button type="button" class="hr-mini" data-act="bind" data-person="' + esc(row.personId) + '">保存对齐</button></div>';
        }).join("") : '<div class="hr-empty">没有对不上的组织人员。</div>';
      } else if (opened === "已对齐") {
        var how = { manual: "手工", job_number: "工号", name: "姓名" };
        issue = (watch.pairs || []).length ? (watch.pairs || []).map(function (row) {
          return '<div class="hr-link" data-link><span>' + esc(row.name) + " → " + esc(row.orgName) + " · " + esc(row.role) + " · " + esc(how[row.matchBy] || row.matchBy) +
            '</span><button type="button" class="hr-mini" data-act="unbind" data-person="' + esc(row.personId) + '">解除</button></div>';
        }).join("") : '<div class="hr-empty">还没有对齐上的人。</div>';
      }
      watchBox.innerHTML = '<div class="hr-watch-banner' + (watch.conflict ? " is-conflict" : "") + '"><span>钉钉运营人数 / 组织运营人数。点数字看对不上的人，改完保存。</span><strong>' +
        (watch.conflict ? "存在冲突" : "暂无冲突") + '</strong></div><div class="hr-watch-kpis">' +
        '<article class="hr-watch-kpi"><b>' + esc(watch.compared || "0/0") + '</b><span>钉钉运营/组织运营</span></article>' +
        '<button type="button" class="hr-watch-kpi' + (opened === "人员对不上" ? " is-on" : "") + '" data-watch-open="人员对不上"><b>' + esc((watch.dingMiss || []).length) + '</b><span>人员对不上</span></button>' +
        '<button type="button" class="hr-watch-kpi' + (opened === "组织对不上" ? " is-on" : "") + '" data-watch-open="组织对不上"><b>' + esc((watch.orgMiss || []).length) + '</b><span>组织对不上</span></button>' +
        '<button type="button" class="hr-watch-kpi' + (opened === "已对齐" ? " is-on" : "") + '" data-watch-open="已对齐"><b>' + esc((watch.pairs || []).length) + '</b><span>已对齐</span></button></div>' +
        (issue ? '<div class="hr-watch-issues">' + issue + "</div>" : "");
    }
    var people = pack.people || [];
    var body = people.length ? people.map(function (person) {
      var on = open === person.userId;
      var main = '<tr class="hr-person" data-effort="' + esc(person.userId) + '" aria-expanded="' + (on ? "true" : "false") + '"><td>' +
        esc(person.name || "未命名") + "</td><td>" + esc(person.department) + "</td><td>" + esc(person.role) + "</td><td>" +
        esc(person.orgName) + "</td><td>" + esc(person.hours) + "</td></tr>";
      if (!on) return main;
      return main + '<tr class="hr-detail"><td colspan="5"><table class="hr-table"><thead><tr><th>日期</th><th>下班</th><th>时长</th></tr></thead><tbody>' +
        (dayRows(person) || emptyRow(3, "这个月没有 18 点后的下班")) + "</tbody></table></td></tr>";
    }).join("") : emptyRow(5, "这个月还没有运营部门的人");
    setList(root, ["姓名", "部门", "角色", "组织", "月累计"], body);
    if (!pack.configured) setMsg(root, "钉钉还没配置，奋斗时长先留空。", false);
    else setMsg(root, "", false);
  }

  function downloadEffort(pack) {
    var lines = ["姓名,部门,工号,角色,组织姓名,月累计"];
    (pack.people || []).forEach(function (person) {
      lines.push([person.name, person.department, person.jobNumber, person.role, person.orgName, person.hours].map(csvCell).join(","));
    });
    lines.push("");
    lines.push("姓名,日期,下班,时长");
    (pack.people || []).forEach(function (person) {
      (person.days || []).forEach(function (day) {
        lines.push([person.name, day.date, String(day.offAt || "").slice(11, 16), day.hours].map(csvCell).join(","));
      });
    });
    var blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "奋斗时长-" + (pack.month || "全部") + ".csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
  }

  function csvCell(value) {
    var text = String(value == null ? "" : value);
    if (/[",\n]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
    return text;
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

  function recruitCells(row, extra) {
    return "<td>" + esc(row.name) + "</td><td>" + esc(row.gender) + "</td>" + extra +
      "<td>" + esc(row.phone) + "</td><td>" + esc(row.hometown) + "</td><td>" + esc(row.channel) +
      "</td><td>" + esc(row.inviter) + "</td><td>" + esc(row.note) + "</td><td>" + esc(row.detail) + "</td>";
  }

  function joinCell(row) {
    if (row.joined) return '<td><span class="hr-joined">已登记入职</span></td>';
    return '<td><button type="button" class="hr-mini" data-act="join" data-id="' + esc(row.id) + '">登记</button></td>';
  }

  function recruitKpis(rows) {
    var done = rows.filter(function (row) { return row.joined; }).length;
    var cards = [
      { tone: "staff", icon: "staff", label: "待入职", value: rows.length },
      { tone: "due", icon: "due", label: "已登记入职", value: done },
      { tone: "punch", icon: "punch", label: "未登记", value: rows.length - done },
      { tone: "late", icon: "late", label: "男", value: rows.filter(function (row) { return row.gender === "男"; }).length },
      { tone: "leave", icon: "leave", label: "女", value: rows.filter(function (row) { return row.gender === "女"; }).length }
    ];
    return cards.map(function (card) {
      return '<article class="hr-board-kpi hr-tone-' + card.tone + '">' + boardIcon(card.icon) +
        "<b>" + esc(card.value) + "</b><span>" + esc(card.label) + "</span></article>";
    }).join("");
  }

  function fillRecruit(root, pack) {
    var rows = pack.recruits || [];
    var joined = pack.onboards || [];
    var cards = root.querySelector("[data-recruit-kpis]");
    if (cards) cards.innerHTML = recruitKpis(rows);
    var headers = ["姓名", "性别", "应聘岗位", "预计入职时间", "联系电话", "籍贯", "渠道", "邀约人", "备注", "情况说明", "是否登记入职", ""];
    var body = rows.length ? rows.map(function (row) {
      return "<tr>" + recruitCells(row, "<td>" + esc(row.position) + "</td><td>" + esc(row.expectedJoin) + "</td>") +
        joinCell(row) + "<td>" + removeBtn("recruit", row.id) + "</td></tr>";
    }).join("") : emptyRow(12, "这个月还没有待入职");
    setList(root, headers, body);
    var onboardHeaders = ["姓名", "性别", "入职部门", "岗位", "入职日期", "联系电话", "籍贯", "渠道", "邀约人", "备注", "情况说明", ""];
    var onboardBody = joined.length ? joined.map(function (row) {
      return "<tr>" + recruitCells(row, "<td>" + esc(row.department) + "</td><td>" + esc(row.position) + "</td><td>" + esc(row.joinedOn) + "</td>") +
        "<td>" + removeBtn("onboard", row.id) + "</td></tr>";
    }).join("") : emptyRow(12, "还没有入职情况");
    var box = root.querySelector("[data-onboards]");
    if (box) box.outerHTML = table(onboardHeaders, onboardBody).replace("data-list", "data-onboards");
  }

  function staffSaveBody(row, key, value) {
    var body = {
      name: row.name || "",
      gender: row.gender || "",
      jobNumber: row.jobNumber || "",
      department: row.department || "",
      position: row.position || "",
      phone: row.phone || "",
      joinedOn: row.joinedOn || "",
      leftOn: row.leftOn || "",
      status: row.status || "在职",
      hometown: row.hometown || "",
      education: row.education || "",
      emergencyName: row.emergencyName || "",
      emergencyPhone: row.emergencyPhone || "",
      note: row.note || "",
      dingtalkUserId: row.dingtalkUserId || "",
      replace: true
    };
    body[key] = value;
    return body;
  }

  function staffBox(row, key, type, max) {
    var value = row[key] || "";
    if (key === "gender") {
      return '<select class="hr-cell" data-staff-field="gender" data-id="' + esc(row.id) + '"><option value="">请选择</option>' + options(GENDERS, value) + "</select>";
    }
    return '<input class="hr-cell' + (key === "note" ? " hr-cell-wide" : "") + '" data-staff-field="' + key + '" data-id="' + esc(row.id) +
      '" type="' + (type || "text") + '" maxlength="' + (max || 64) + '" value="' + esc(value) + '" />';
  }

  function staffCells(row) {
    return "<td>" + staffBox(row, "name", "text", 64) + "</td><td>" + staffBox(row, "gender") + "</td><td>" + staffBox(row, "jobNumber") +
      "</td><td>" + staffBox(row, "department") + "</td><td>" + staffBox(row, "position") + "</td><td>" + staffBox(row, "phone", "text", 32) +
      "</td><td>" + staffBox(row, "joinedOn", "date", 10) + "</td><td>" + staffBox(row, "leftOn", "date", 10) + "</td><td>" +
      '<select class="hr-cell" data-staff-status data-id="' + esc(row.id) + '">' + options(["在职", "离职"], row.status || "在职") + "</select></td><td>" +
      staffBox(row, "hometown") + "</td><td>" + staffBox(row, "education", "text", 32) + "</td><td>" + staffBox(row, "emergencyName") +
      "</td><td>" + staffBox(row, "emergencyPhone", "text", 32) + "</td><td>" + staffBox(row, "note", "text", 500) + "</td>";
  }

  function fillStaff(root, pack) {
    var all = pack.staff || [];
    var picked = root.getAttribute("data-staff-pick") || "";
    var search = root.querySelector("[data-staff-search]");
    var query = search ? String(search.value || "").replace(/\s+/g, "").toLowerCase() : "";
    var rows = all.filter(function (row) {
      if (picked && row.status !== picked) return false;
      if (!query) return true;
      var bag = [row.name, row.jobNumber, row.department, row.position, row.phone, row.hometown, row.education, row.emergencyName, row.note].join("");
      return bag.replace(/\s+/g, "").toLowerCase().indexOf(query) >= 0;
    });
    var active = all.filter(function (row) { return row.status !== "离职"; }).length;
    var cards = root.querySelector("[data-staff-kpis]");
    if (cards) {
      cards.innerHTML = [
        { tone: "due", status: "在职", label: "在职", value: active, icon: "staff" },
        { tone: "leave", status: "离职", label: "离职", value: all.length - active, icon: "leave" }
      ].map(function (card) {
        return '<button type="button" class="hr-board-kpi hr-tone-' + card.tone + (picked === card.status ? " is-on" : "") +
          '" data-staff-pick="' + card.status + '">' + boardIcon(card.icon) + "<b>" + esc(card.value) + "</b><span>" + esc(card.label) + "</span></button>";
      }).join("");
    }
    var headers = ["姓名", "性别", "工号", "部门", "岗位", "联系电话", "入职日期", "离职日期", "状态", "籍贯", "学历", "紧急联系人", "紧急电话", "备注", ""];
    var body = rows.length ? rows.map(function (row) {
      return "<tr>" + staffCells(row) + "<td>" +
        '<button type="button" class="hr-mini" data-act="staff-edit" data-id="' + esc(row.id) + '">修改</button> ' +
        removeBtn("staff", row.id) + "</td></tr>";
    }).join("") : emptyRow(15, query ? "没有匹配的人" : picked === "离职" ? "没有离职人员" : picked === "在职" ? "没有在职人员" : "还没有花名册");
    setList(root, headers, body);
  }

  function monthQuery(root) {
    var input = root.querySelector("[data-month]");
    return input && input.value ? "?month=" + encodeURIComponent(input.value) : "";
  }

  function loadTab(root, state) {
    var ticket = ++state.ticket;
    var tab = state.tab;
    if (tab === "attendance") {
      var dayInput = root.querySelector("[data-day]");
      var day = dayInput && dayInput.value ? dayInput.value : addDays(shanghaiToday(), -1);
      state.boards = state.boards || {};
      var boardReq = state.boards[day]
        ? Promise.resolve(state.boards[day])
        : api("/api/hr/board?date=" + encodeURIComponent(day)).then(function (data) {
          state.boards[day] = data;
          return data;
        });
      boardReq.then(function (view) {
        if (!state.alive || ticket !== state.ticket || state.tab !== tab) return;
        state.view = view;
        fillAttendance(root, view);
      }).catch(function (err) {
        if (!state.alive || ticket !== state.ticket) return;
        if (err.status === 403) {
          var link = document.querySelector('a[href="/hr"]');
          if (link) link.remove();
          root.innerHTML = '<div class="xm-page hr-page"><p class="hr-msg is-error">没有智能人事权限</p></div>';
          return;
        }
        setMsg(root, err.message || "读取失败", true);
      });
      return;
    }
    var peopleReq = api("/api/people").then(safePeople).catch(function () { return []; });
    var statusReq = api("/api/hr/status").catch(function () { return { configured: false }; });
    var dataReq;
    if (tab === "overtime") {
      dataReq = api("/api/hr/effort" + monthQuery(root));
    } else if (tab === "staff") {
      dataReq = api("/api/hr/staff");
    } else {
      var monthInput = root.querySelector("[data-join-month]");
      var month = monthInput && monthInput.value ? monthInput.value : shanghaiToday().slice(0, 7);
      dataReq = Promise.all([
        api("/api/hr/recruits?month=" + encodeURIComponent(month)),
        api("/api/hr/onboards")
      ]).then(function (pair) {
        return Object.assign({}, pair[0], pair[1]);
      });
    }
    Promise.all([peopleReq, statusReq, dataReq]).then(function (pack) {
      if (!state.alive || ticket !== state.ticket || state.tab !== tab) return;
      var view = Object.assign({ people: pack[0], configured: pack[1].configured }, pack[2]);
      state.view = view;
      if (tab === "attendance") fillAttendance(root, view);
      else if (tab === "overtime") fillEffort(root, view);
      else if (tab === "staff") fillStaff(root, view);
      else fillRecruit(root, view);
    }).catch(function (err) {
      if (!state.alive || ticket !== state.ticket) return;
      if (err.status === 403) {
        var link = document.querySelector('a[href="/hr"]');
        if (link) link.remove();
        root.innerHTML = '<div class="xm-page hr-page"><p class="hr-msg is-error">没有智能人事权限</p></div>';
        return;
      }
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

  var STAFF_HEADERS = ["姓名", "性别", "工号", "部门", "岗位", "联系电话", "入职日期", "离职日期", "状态", "籍贯", "学历", "紧急联系人", "紧急电话", "备注"];
  var STAFF_KEYS = {
    "姓名": "name",
    "性别": "gender",
    "工号": "jobNumber",
    "部门": "department",
    "岗位": "position",
    "联系电话": "phone",
    "电话": "phone",
    "入职日期": "joinedOn",
    "离职日期": "leftOn",
    "状态": "status",
    "在职状态": "status",
    "籍贯": "hometown",
    "学历": "education",
    "紧急联系人": "emergencyName",
    "紧急电话": "emergencyPhone",
    "备注": "note"
  };

  function parseCsv(text) {
    var rows = [];
    var row = [];
    var cell = "";
    var quoted = false;
    var source = String(text || "").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    function pushRow() {
      if (row.some(function (value) { return String(value || "").trim(); })) rows.push(row);
      row = [];
      cell = "";
    }
    for (var i = 0; i < source.length; i += 1) {
      var ch = source[i];
      if (quoted) {
        if (ch === '"') {
          if (source[i + 1] === '"') { cell += '"'; i += 1; }
          else quoted = false;
        } else cell += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ",") { row.push(cell); cell = ""; }
      else if (ch === "\n") { row.push(cell); pushRow(); }
      else cell += ch;
    }
    row.push(cell);
    pushRow();
    return rows;
  }

  function csvStaff(text) {
    var grid = parseCsv(text);
    if (!grid.length) return [];
    var head = grid[0].map(function (name) { return String(name || "").trim(); });
    var keys = head.map(function (name) { return STAFF_KEYS[name] || ""; });
    if (keys.indexOf("name") < 0) return [];
    return grid.slice(1).map(function (line) {
      var item = {};
      keys.forEach(function (key, index) {
        if (key) item[key] = String(line[index] || "").trim();
      });
      return item;
    }).filter(function (item) { return item.name; });
  }

  function downloadCsv(filename, text) {
    var blob = new Blob(["\uFEFF" + text], { type: "text/csv;charset=utf-8" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function fillStaffForm(form, row) {
    ["name", "gender", "jobNumber", "department", "position", "phone", "joinedOn", "leftOn", "status", "hometown", "education", "emergencyName", "emergencyPhone", "note"].forEach(function (key) {
      if (form.elements[key]) form.elements[key].value = row && row[key] ? row[key] : (key === "status" ? "在职" : "");
    });
    var button = form.querySelector("button[type='submit']");
    if (row && row.id) {
      form.setAttribute("data-staff-id", String(row.id));
      if (button) button.textContent = "保存修改";
    } else {
      form.removeAttribute("data-staff-id");
      if (button) button.textContent = "登记";
    }
  }

  function mount(root) {
    ensureStyle();
    var state = { tab: "attendance", ticket: 0, alive: true };
    root.innerHTML = '<div class="xm-page hr-page"><div class="hr-top"><div class="hr-tabs" role="tablist" aria-label="智能人事">' +
      TABS.map(function (tab, index) {
        var on = index === 0;
        return '<button type="button" class="hr-tab" role="tab" data-tab="' + tab.id + '" aria-selected="' + (on ? "true" : "false") + '" tabindex="' + (on ? "0" : "-1") + '">' + esc(tab.label) + "</button>";
      }).join("") + '</div><div class="hr-refresh"><span class="hr-updated" data-updated>尚未更新</span>' +
      '<button type="button" class="hr-primary" data-act="refresh-board">刷新数据</button></div></div><div class="hr-body" role="tabpanel"></div></div>';
    paint(root, state.tab, addDays(shanghaiToday(), -1).slice(0, 7), shanghaiToday());

    function onClick(event) {
      var kpi = event.target.closest("[data-kpi]");
      if (kpi && root.contains(kpi)) {
        event.preventDefault();
        var section = kpi.closest("[data-team]");
        if (!section || !state.view) return;
        var key = kpi.getAttribute("data-kpi");
        section.setAttribute("data-open", section.getAttribute("data-open") === key ? "" : key);
        var teamId = section.getAttribute("data-team");
        var teamView = ((state.view && state.view.boards) || []).filter(function (item) { return item.id === teamId; })[0];
        fillTeam(section, teamView || { board: {}, days: [], punches: [], roster: [] });
        return;
      }
      var refresh = event.target.closest("[data-act='refresh-board']");
      if (refresh && root.contains(refresh)) {
        event.preventDefault();
        if (refresh.disabled) return;
        var dayInput = root.querySelector("[data-day]");
        var day = dayInput && dayInput.value ? dayInput.value : addDays(shanghaiToday(), -1);
        refresh.disabled = true;
        refresh.textContent = "正在拉取";
        api("/api/hr/sync", { method: "POST", body: { date: day } })
          .then(function (data) {
            setUpdated(root, data.updatedAt);
            state.boards = state.boards || {};
            delete state.boards[day];
            if (state.tab === "attendance") loadTab(root, state);
            setMsg(root, data.configured === false ? "钉钉还没配置" : "已刷新 " + day, false);
          })
          .catch(function (err) { setMsg(root, err.message, true); })
          .then(function () {
            refresh.disabled = false;
            refresh.textContent = "刷新数据";
          });
        return;
      }
      var download = event.target.closest("[data-act='download']");
      if (download && root.contains(download)) {
        event.preventDefault();
        if (state.view) downloadEffort(state.view);
        return;
      }
      var bind = event.target.closest("[data-act='bind']");
      if (bind && root.contains(bind)) {
        event.preventDefault();
        var box = bind.closest("[data-link]");
        var personPick = box && box.querySelector("[data-pick-person]");
        var userPick = box && box.querySelector("[data-pick-user]");
        var personId = bind.getAttribute("data-person") || (personPick ? personPick.value : "");
        var userId = bind.getAttribute("data-user") || (userPick ? userPick.value : "");
        api("/api/hr/links", { method: "POST", body: { personId: Number(personId), dingtalkUserId: userId } })
          .then(function () { loadTab(root, state); })
          .catch(function (err) { setMsg(root, err.message, true); });
        return;
      }
      var unbind = event.target.closest("[data-act='unbind']");
      if (unbind && root.contains(unbind)) {
        event.preventDefault();
        api("/api/hr/links/" + encodeURIComponent(unbind.getAttribute("data-person")), { method: "DELETE" })
          .then(function () { loadTab(root, state); })
          .catch(function (err) { setMsg(root, err.message, true); });
        return;
      }
      var watch = event.target.closest("[data-watch-open]");
      if (watch && root.contains(watch)) {
        event.preventDefault();
        var key = watch.getAttribute("data-watch-open");
        root.setAttribute("data-watch", root.getAttribute("data-watch") === key ? "" : key);
        if (state.view) fillEffort(root, state.view);
        return;
      }
      var person = event.target.closest("[data-effort]");
      if (person && root.contains(person)) {
        event.preventDefault();
        var id = person.getAttribute("data-effort");
        root.setAttribute("data-open", root.getAttribute("data-open") === id ? "" : id);
        if (state.view) fillEffort(root, state.view);
        return;
      }
      var template = event.target.closest("[data-act='staff-template']");
      if (template && root.contains(template)) {
        event.preventDefault();
        downloadCsv("员工花名册.csv", STAFF_HEADERS.join(",") + "\n");
        return;
      }
      var pick = event.target.closest("[data-act='staff-pick']");
      if (pick && root.contains(pick)) {
        event.preventDefault();
        var fileInput = root.querySelector("[data-staff-file]");
        if (fileInput) fileInput.click();
        return;
      }
      var pick = event.target.closest("[data-staff-pick]");
      if (pick && root.contains(pick)) {
        event.preventDefault();
        var nextPick = pick.getAttribute("data-staff-pick");
        root.setAttribute("data-staff-pick", root.getAttribute("data-staff-pick") === nextPick ? "" : nextPick);
        if (state.view) fillStaff(root, state.view);
        return;
      }
      var sync = event.target.closest("[data-act='staff-sync']");
      if (sync && root.contains(sync)) {
        event.preventDefault();
        sync.disabled = true;
        api("/api/hr/staff/sync", { method: "POST", body: {} })
          .then(function (data) {
            setMsg(root, data.added ? "已从打卡带入 " + data.added + " 人" : "打卡里的运营人员都已经在花名册里", false);
            loadTab(root, state);
          })
          .catch(function (err) { setMsg(root, err.message, true); })
          .then(function () { sync.disabled = false; });
        return;
      }
      var join = event.target.closest("[data-act='join']");
      if (join && root.contains(join)) {
        event.preventDefault();
        join.disabled = true;
        api("/api/hr/recruits/" + encodeURIComponent(join.getAttribute("data-id")) + "/join", { method: "POST", body: {} })
          .then(function (data) {
            setMsg(root, data.already ? "已经登记过入职" : "已登记入职，已写入员工花名册的在职人员", false);
            loadTab(root, state);
          })
          .catch(function (err) { setMsg(root, err.message, true); join.disabled = false; });
        return;
      }
      var edit = event.target.closest("[data-act='staff-edit']");
      if (edit && root.contains(edit)) {
        event.preventDefault();
        var staffId = Number(edit.getAttribute("data-id"));
        var person = ((state.view && state.view.staff) || []).filter(function (row) { return Number(row.id) === staffId; })[0];
        var staffForm = root.querySelector("form[data-form='staff']");
        if (person && staffForm) fillStaffForm(staffForm, person);
        return;
      }
      var tabBtn = event.target.closest(".hr-tab");
      if (tabBtn && root.contains(tabBtn)) {
        event.preventDefault();
        selectTab(root, state, tabBtn.getAttribute("data-tab"));
        return;
      }
      var btn = event.target.closest("[data-act='delete']");
      if (!btn || !root.contains(btn)) return;
      if (!window.confirm("删除这条记录？")) return;
      var kindName = btn.getAttribute("data-kind");
      var kind = kindName === "onboard" ? "/onboards/" : kindName === "staff" ? "/staff/" : "/recruits/";
      api("/api/hr" + kind + btn.getAttribute("data-id"), { method: "DELETE" })
        .then(function () { loadTab(root, state); })
        .catch(function (err) { setMsg(root, err.message, true); });
    }

    function onSubmit(event) {
      var form = event.target.closest("form[data-form]");
      if (!form || !root.contains(form)) return;
      event.preventDefault();
      var kind = form.getAttribute("data-form");
      var monthInput = root.querySelector("[data-join-month]");
      var joinMonth = monthInput && monthInput.value ? monthInput.value : shanghaiToday().slice(0, 7);
      var todayText = shanghaiToday();
      var staffId = form.getAttribute("data-staff-id");
      var body = kind === "staff" ? {
        name: formValue(form, "name"),
        gender: formValue(form, "gender"),
        jobNumber: formValue(form, "jobNumber"),
        department: formValue(form, "department"),
        position: formValue(form, "position"),
        phone: formValue(form, "phone"),
        joinedOn: formValue(form, "joinedOn"),
        leftOn: formValue(form, "leftOn"),
        status: formValue(form, "status") || "在职",
        hometown: formValue(form, "hometown"),
        education: formValue(form, "education"),
        emergencyName: formValue(form, "emergencyName"),
        emergencyPhone: formValue(form, "emergencyPhone"),
        note: formValue(form, "note"),
        replace: true
      } : kind === "onboard" ? {
        name: formValue(form, "name"),
        gender: formValue(form, "gender"),
        department: formValue(form, "department"),
        position: formValue(form, "position"),
        joinedOn: formValue(form, "joinedOn"),
        phone: formValue(form, "phone"),
        hometown: formValue(form, "hometown"),
        channel: formValue(form, "channel"),
        inviter: formValue(form, "inviter"),
        note: formValue(form, "note"),
        detail: formValue(form, "detail")
      } : {
        name: formValue(form, "name"),
        gender: formValue(form, "gender"),
        position: formValue(form, "position"),
        expectedJoin: formValue(form, "expectedJoin"),
        phone: formValue(form, "phone"),
        hometown: formValue(form, "hometown"),
        channel: formValue(form, "channel"),
        inviter: formValue(form, "inviter"),
        note: formValue(form, "note"),
        detail: formValue(form, "detail"),
        recordDate: todayText.slice(0, 7) === joinMonth ? todayText : joinMonth + "-01"
      };
      var button = form.querySelector("button[type='submit']");
      if (button) button.disabled = true;
      var path = kind === "staff" ? (staffId ? "/staff/" + encodeURIComponent(staffId) : "/staff") : kind === "onboard" ? "/onboards" : "/recruits";
      api("/api/hr" + path, { method: kind === "staff" && staffId ? "PUT" : "POST", body: body })
        .then(function () {
          form.reset();
          if (kind === "staff") fillStaffForm(form, null);
          loadTab(root, state);
        })
        .catch(function (err) { setMsg(root, err.message, true); })
        .then(function () { if (button) button.disabled = false; });
    }

    root.addEventListener("click", onClick);
    root.addEventListener("submit", onSubmit);
    root.addEventListener("input", function (event) {
      if (event.target && event.target.matches("[data-staff-search]") && state.view) fillStaff(root, state.view);
    });
    root.addEventListener("change", function (event) {
      var target = event.target;
      if (!target || !root.contains(target)) return;
      if (target.matches("[data-month], [data-day], [data-join-month]")) {
        loadTab(root, state);
        return;
      }
      if (target.matches("[data-staff-field]")) {
        var field = target.getAttribute("data-staff-field");
        var staffId = Number(target.getAttribute("data-id"));
        var person = ((state.view && state.view.staff) || []).filter(function (item) { return Number(item.id) === staffId; })[0];
        if (!person || String(person[field] || "") === String(target.value || "")) return;
        api("/api/hr/staff/" + encodeURIComponent(staffId), { method: "PUT", body: staffSaveBody(person, field, target.value) })
          .then(function (data) {
            if (data.staff) Object.assign(person, data.staff);
            setMsg(root, "已保存", false);
          })
          .catch(function (err) {
            setMsg(root, err.message, true);
            loadTab(root, state);
          });
        return;
      }
      if (target.matches("[data-staff-file]")) {
        var file = target.files && target.files[0];
        target.value = "";
        if (!file) return;
        file.text().then(function (text) {
          var rows = csvStaff(text);
          if (!rows.length) {
            setMsg(root, "表格需要有姓名这一列，并且至少一行人员", true);
            return null;
          }
          return api("/api/hr/staff/import", { method: "POST", body: { rows: rows } });
        }).then(function (data) {
          if (!data) return;
          setMsg(root, "已导入，新增 " + data.added + " 人，更新 " + data.updated + " 人", false);
          loadTab(root, state);
        }).catch(function (err) { setMsg(root, err.message || "导入失败", true); });
        return;
      }
      if (target.matches("[data-staff-status]")) {
        api("/api/hr/staff/" + encodeURIComponent(target.getAttribute("data-id")), {
          method: "PUT",
          body: { status: target.value, replace: false }
        }).then(function () { loadTab(root, state); })
          .catch(function (err) { setMsg(root, err.message, true); });
      }
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
