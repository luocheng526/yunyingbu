/* xm-module-hr — 智能人事。只挂 /hr。假勤只读钉钉落库，招聘记在本库。 */
(function () {
  var TABS = [
    { id: "attendance", label: "看板" },
    { id: "overtime", label: "奋斗时长" },
    { id: "recruit", label: "招聘" }
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
      ".hr-tabs{display:flex;gap:0;border-bottom:1px solid var(--xm-line);margin:0 0 12px;overflow:auto;}" +
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
      ".hr-toolbar{display:flex;justify-content:space-between;gap:8px;align-items:center;color:var(--xm-muted);font-size:13px;}" +
      ".hr-month input{height:32px;border:1px solid var(--xm-line);border-radius:6px;background:var(--xm-card);color:var(--xm-ink);padding:0 8px;font:inherit;}" +
      ".hr-primary{height:32px;border:0;border-radius:6px;background:var(--xm-primary);color:#fff;padding:0 14px;font:inherit;font-size:13px;cursor:pointer;}" +
      ".hr-table-wrap{overflow:auto;}" +
      ".hr-table{width:100%;border-collapse:collapse;font-size:13px;}" +
      ".hr-table th{text-align:left;color:var(--xm-muted);font-weight:600;padding:8px 10px;border-bottom:1px solid var(--xm-line);white-space:nowrap;}" +
      ".hr-table td{padding:8px 10px;border-bottom:1px solid var(--xm-line);vertical-align:middle;}" +
      ".hr-empty{padding:28px 12px;text-align:center;color:var(--xm-muted);}" +
      ".hr-msg{min-height:18px;color:var(--xm-muted);font-size:12px;}" +
      ".hr-msg:empty{display:none;min-height:0;}" +
      ".hr-msg.is-error{color:#cf1322;}" +
      "html[data-theme='dark'] .hr-msg.is-error{color:#ff7875;}" +
      ".hr-mini{height:26px;border:1px solid var(--xm-line);border-radius:6px;background:var(--xm-card);color:var(--xm-ink);padding:0 8px;font:inherit;font-size:12px;cursor:pointer;}" +
      ".hr-person{cursor:pointer;}" +
      ".hr-person[aria-expanded='true'] td{background:color-mix(in srgb,var(--xm-primary) 8%,var(--xm-card));}" +
      ".hr-detail td{padding:8px 10px 12px;}" +
      ".hr-board-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-end;}" +
      ".hr-board-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;}" +
      ".hr-board-kpi{border:0;border-radius:16px;padding:16px 16px 14px;color:#fff;min-height:108px;box-shadow:0 10px 22px rgba(24,49,99,.12);}" +
      ".hr-board-kpi i{display:flex;width:28px;height:28px;border-radius:8px;align-items:center;justify-content:center;background:rgba(255,255,255,.22);}" +
      ".hr-board-kpi i svg{width:16px;height:16px;stroke:#fff;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;}" +
      ".hr-board-kpi b{display:block;margin-top:10px;font-size:34px;line-height:1;font-weight:700;font-variant-numeric:tabular-nums;}" +
      ".hr-board-kpi span{display:block;margin-top:8px;font-size:13px;opacity:.95;}" +
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
          labels: []
        };
      }
      if (row.department && !groups[key].department) groups[key].department = row.department;
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
      var teams = [
        { id: "ops", title: "甄选运营团队看板" },
        { id: "backend", title: "后端团队看板" },
        { id: "total", title: "总看板" }
      ];
      html = '<section class="hr-panel hr-board">' +
        '<div class="hr-board-head"><p class="hr-msg" data-msg></p>' +
        '<label class="hr-month">统计日<input type="date" data-day value="' + esc(today) + '" /></label></div>' +
        teams.map(function (team) {
          return '<section class="hr-team" data-team="' + team.id + '"><h2 class="hr-team-title">' + esc(team.title) + "</h2>" +
            '<div class="hr-board-kpis" data-board></div>' +
            '<div class="hr-board-grid"><section class="hr-card hr-board-card" data-depts></section>' +
            '<section class="hr-card hr-board-card" data-days></section></div>' +
            '<h3 class="hr-board-sub">当日打卡</h3>' +
            table(["姓名", "部门", "工号", "日期", "上班", "下班", "结果"], emptyRow(7, "还没有打卡")) + "</section>";
        }).join("") + "</section>";
    } else if (tab === "overtime") {
      html = '<section class="hr-panel"><div class="hr-toolbar"><span>运营部门，18:00 之后的下班打卡，按月累计。</span>' +
        '<label class="hr-month">月份<input type="month" data-month value="' + esc(month) + '" /></label></div>' +
        kpis([{ label: "本月奋斗时长", value: "0" }, { label: "人数", value: "0" }]) +
        '<p class="hr-msg" data-msg></p>' + table(["姓名", "部门", "月累计"], emptyRow(3, "这个月还没有 18 点后的下班打卡")) + "</section>";
    } else {
      html = '<section class="hr-panel"><div class="hr-toolbar"><span>招聘先记在本库。</span></div>' +
        kpis([{ label: "人数", value: "0" }]) +
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
        '<button class="hr-primary" type="submit">登记</button></form>' +
        '<p class="hr-msg" data-msg></p>' +
        table(["姓名", "性别", "应聘岗位", "预计入职时间", "联系电话", "籍贯", "渠道", "邀约人", "备注", "情况说明", ""], emptyRow(11, "还没有招聘记录")) + "</section>";
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
    var cards = [
      { tone: "staff", icon: "staff", label: "员工人数", value: board.staff || 0 },
      { tone: "due", icon: "due", label: prefix + "应到人数", value: board.expected || 0 },
      { tone: "punch", icon: "punch", label: prefix + "打卡人数", value: board.punched || 0 },
      { tone: "late", icon: "late", label: prefix + "迟到人数", value: board.late || 0 },
      { tone: "leave", icon: "leave", label: prefix + "请假人数", value: board.leave || 0 }
    ];
    var box = section.querySelector("[data-board]");
    if (box) {
      box.innerHTML = cards.map(function (card) {
        return '<article class="hr-board-kpi hr-tone-' + card.tone + '">' + boardIcon(card.icon) +
          "<b>" + esc(card.value) + "</b><span>" + esc(card.label) + "</span></article>";
      }).join("");
    }
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
    var days = pairPunches((view && view.punches) || []).sort(function (a, b) {
      return String(a.department).localeCompare(String(b.department), "zh") || String(a.userName).localeCompare(String(b.userName), "zh");
    });
    var body = days.length ? days.map(function (row) {
      var labels = row.labels.filter(function (label, index) { return row.labels.indexOf(label) === index; }).join("、");
      return "<tr><td>" + esc(row.userName || "未命名") + "</td><td>" + esc(row.department) + "</td><td>" + esc(row.jobNumber) +
        "</td><td>" + esc(row.workDate) + "</td><td>" + esc(row.on) + "</td><td>" + esc(row.off) + "</td><td>" + esc(labels) + "</td></tr>";
    }).join("") : emptyRow(7, "还没有打卡");
    var list = section.querySelector("[data-list]");
    if (list) list.outerHTML = table(["姓名", "部门", "工号", "日期", "上班", "下班", "结果"], body);
  }

  function fillAttendance(root, pack) {
    var boards = pack.boards || [];
    ["ops", "backend", "total"].forEach(function (id) {
      var view = boards.filter(function (item) { return item.id === id; })[0];
      if (!view && id === "ops" && pack.board) view = { board: pack.board, days: pack.days, punches: pack.punches };
      fillTeam(root.querySelector('[data-team="' + id + '"]'), view || { board: {}, days: [], punches: [] });
    });
    if (!pack.configured) setMsg(root, "钉钉还没配置，看板先按空模板放着。", false);
    else setMsg(root, "", false);
  }

  function fillEffort(root, pack) {
    var people = pack.people || [];
    var total = people.reduce(function (sum, person) { return sum + Number(person.hours || 0); }, 0);
    setStats(root, [
      { label: "本月奋斗时长", value: total ? String(Math.round(total * 10) / 10) : "0" },
      { label: "人数", value: people.length }
    ]);
    var open = root.getAttribute("data-open") || "";
    var body = people.length ? people.map(function (person) {
      var id = person.userId || person.name;
      var on = open === id;
      var main = '<tr class="hr-person" data-effort="' + esc(id) + '" aria-expanded="' + (on ? "true" : "false") + '"><td>' +
        esc(person.name || "未命名") + "</td><td>" + esc(person.department) + "</td><td>" + esc(person.hours) + "</td></tr>";
      if (!on) return main;
      var days = (person.days || []).map(function (day) {
        return "<tr><td>" + esc(day.date) + "</td><td>" + esc(String(day.offAt || "").slice(11, 16)) + "</td><td>" + esc(day.hours) + "</td></tr>";
      }).join("");
      return main + '<tr class="hr-detail"><td colspan="3"><table class="hr-table"><thead><tr><th>日期</th><th>下班</th><th>时长</th></tr></thead><tbody>' +
        days + "</tbody></table></td></tr>";
    }).join("") : emptyRow(3, "这个月还没有 18 点后的下班打卡");
    setList(root, ["姓名", "部门", "月累计"], body);
    if (!pack.configured) setMsg(root, "钉钉还没配置，奋斗时长先留空。", false);
    else setMsg(root, "", false);
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

  function fillRecruit(root, pack) {
    var rows = pack.recruits || [];
    setStats(root, [{ label: "人数", value: rows.length }]);
    var headers = ["姓名", "性别", "应聘岗位", "预计入职时间", "联系电话", "籍贯", "渠道", "邀约人", "备注", "情况说明", ""];
    var body = rows.length ? rows.map(function (row) {
      return "<tr><td>" + esc(row.name) + "</td><td>" + esc(row.gender) + "</td><td>" + esc(row.position) +
        "</td><td>" + esc(row.expectedJoin) + "</td><td>" + esc(row.phone) + "</td><td>" + esc(row.hometown) +
        "</td><td>" + esc(row.channel) + "</td><td>" + esc(row.inviter) + "</td><td>" + esc(row.note) +
        "</td><td>" + esc(row.detail) + "</td><td>" + removeBtn("recruit", row.id) + "</td></tr>";
    }).join("") : emptyRow(11, "还没有招聘记录");
    setList(root, headers, body);
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
      var dayInput = root.querySelector("[data-day]");
      var day = dayInput && dayInput.value ? dayInput.value : shanghaiToday();
      dataReq = api("/api/hr/board?date=" + encodeURIComponent(day));
    } else if (tab === "overtime") {
      dataReq = api("/api/hr/effort" + monthQuery(root));
    } else {
      dataReq = api("/api/hr/recruits");
    }
    Promise.all([peopleReq, statusReq, dataReq]).then(function (pack) {
      if (!state.alive || ticket !== state.ticket || state.tab !== tab) return;
      var view = Object.assign({ people: pack[0], configured: pack[1].configured }, pack[2]);
      state.view = view;
      if (tab === "attendance") fillAttendance(root, view);
      else if (tab === "overtime") fillEffort(root, view);
      else fillRecruit(root, view);
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
    root.innerHTML = '<div class="xm-page hr-page"><div class="hr-tabs" role="tablist" aria-label="智能人事">' +
      TABS.map(function (tab, index) {
        var on = index === 0;
        return '<button type="button" class="hr-tab" role="tab" data-tab="' + tab.id + '" aria-selected="' + (on ? "true" : "false") + '" tabindex="' + (on ? "0" : "-1") + '">' + esc(tab.label) + "</button>";
      }).join("") + '</div><div class="hr-body" role="tabpanel"></div></div>';
    paint(root, state.tab, addDays(shanghaiToday(), -1).slice(0, 7), shanghaiToday());

    function onClick(event) {
      var person = event.target.closest("[data-effort]");
      if (person && root.contains(person)) {
        event.preventDefault();
        var id = person.getAttribute("data-effort");
        root.setAttribute("data-open", root.getAttribute("data-open") === id ? "" : id);
        if (state.view) fillEffort(root, state.view);
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
      var kind = btn.getAttribute("data-kind") === "talent" ? "/talents/" : "/recruits/";
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
        name: formValue(form, "name"),
        gender: formValue(form, "gender"),
        position: formValue(form, "position"),
        expectedJoin: formValue(form, "expectedJoin"),
        phone: formValue(form, "phone"),
        hometown: formValue(form, "hometown"),
        channel: formValue(form, "channel"),
        inviter: formValue(form, "inviter"),
        note: formValue(form, "note"),
        detail: formValue(form, "detail")
      };
      var button = form.querySelector("button[type='submit']");
      if (button) button.disabled = true;
      api("/api/hr/" + (kind === "talent" ? "talents" : "recruits"), { method: "POST", body: body })
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
      if (event.target && event.target.matches("[data-month], [data-day]")) loadTab(root, state);
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
