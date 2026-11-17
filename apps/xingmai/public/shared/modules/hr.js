/* xm-module-hr — 智能人事。只挂 /hr。假勤只读钉钉落库，招聘记在服务器上。 */
(function () {
  var TABS = [
    { id: "attendance", label: "数据看板" },
    { id: "overtime", label: "奋斗时长" },
    { id: "recruit", label: "招聘管理" },
    { id: "staff", label: "员工管理" },
    { id: "clock", label: "考勤管理" },
    { id: "pay", label: "薪酬绩效" },
    { id: "train", label: "培训发展" },
    { id: "org", label: "组织架构" }
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
      ".hr-org{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;}" +
      ".hr-org-card{padding:12px 14px;}" +
      ".hr-org-card h3{margin:0 0 8px;font-size:15px;}" +
      ".hr-org-card ul{margin:0;padding:0;list-style:none;}" +
      ".hr-org-card li{padding:6px 0;border-bottom:1px solid var(--xm-line);font-size:13px;}" +
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
      ".hr-board-kpi{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;text-align:center;border:0;border-radius:16px;padding:14px 12px 12px;color:#fff;min-height:156px;box-shadow:0 10px 22px rgba(24,49,99,.12);}" +
      "button.hr-board-kpi{width:100%;text-align:center;cursor:pointer;font:inherit;}" +
      "button.hr-board-kpi.is-on{box-shadow:0 0 0 3px rgba(16,24,40,.35),0 10px 22px rgba(24,49,99,.18);}" +
      ".hr-staff-kpis{grid-template-columns:repeat(2,minmax(0,1fr));}" +
      ".hr-cell{width:100%;min-width:88px;height:28px;border:1px solid var(--xm-line);border-radius:6px;background:var(--xm-card);color:var(--xm-ink);padding:0 6px;font:inherit;font-size:12px;}" +
      ".hr-cell-wide{min-width:140px;}" +
      ".hr-board-kpi i{order:3;display:flex;width:52px;height:52px;border-radius:14px;align-items:center;justify-content:center;background:rgba(255,255,255,.22);}" +
      ".hr-board-kpi i svg{width:30px;height:30px;stroke:#fff;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;}" +
      ".hr-board-kpi b{order:2;display:block;margin:auto 0;font-size:40px;line-height:1;font-weight:700;font-variant-numeric:tabular-nums;}" +
      ".hr-board-kpi span{order:1;display:block;margin:0;font-size:16px;font-weight:650;line-height:1.3;opacity:1;}" +
      ".hr-recruit-kpis .hr-board-kpi b{font-size:18px;font-weight:650;}" +
      ".hr-recruit-kpis .hr-board-kpi span{font-size:22px;font-weight:700;line-height:1.25;}" +
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
      ".hr-day-cols{display:flex;align-items:flex-end;gap:8px;height:148px;padding-top:8px;}" +
      ".hr-dept-cols{height:188px;overflow-x:auto;}" +
      ".hr-dept-cols .hr-day-col{min-width:46px;}" +
      ".hr-dept-cols .hr-day-col span:last-child{width:100%;max-height:2.6em;overflow:hidden;line-height:1.25;text-align:center;word-break:break-all;}" +
      ".hr-day-col{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:6px;min-width:0;height:100%;}" +
      ".hr-day-col b{font-size:12px;color:var(--xm-ink);font-variant-numeric:tabular-nums;}" +
      ".hr-day-fill{width:100%;max-width:28px;border-radius:8px 8px 4px 4px;background:linear-gradient(180deg,#8d7cff,#3a63f5);min-height:4px;}" +
      ".hr-day-col span{color:var(--xm-muted);font-size:11px;}" +
      ".hr-team{display:flex;flex-direction:column;gap:12px;}" +
      ".hr-team + .hr-team{margin-top:8px;padding-top:16px;border-top:1px solid var(--xm-line);}" +
      ".hr-team-title{margin:0;font-size:16px;font-weight:700;color:var(--xm-ink);}" +
      ".hr-board-sub{margin:4px 0 0;font-size:14px;font-weight:650;color:var(--xm-ink);}" +
      ".hr-home{display:flex;flex-direction:column;gap:12px;}" +
      ".hr-home-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;}" +
      ".hr-home-head h2{margin:0;font-size:22px;font-weight:700;}" +
      ".hr-home-head p{margin:6px 0 0;color:var(--xm-muted);font-size:13px;}" +
      ".hr-range{display:flex;align-items:center;gap:8px;height:36px;padding:0 10px;border:1px solid var(--xm-line);border-radius:10px;background:var(--xm-card);color:var(--xm-muted);font-size:13px;white-space:nowrap;}" +
      ".hr-range select{border:0;background:transparent;color:var(--xm-ink);font:inherit;font-weight:650;}" +
      ".hr-home-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;}" +
      ".hr-home-kpi{display:flex;align-items:center;gap:10px;padding:14px;border:1px solid var(--xm-line);border-radius:16px;background:var(--xm-card);box-shadow:var(--xm-shadow);min-width:0;}" +
      ".hr-home-icon{flex:none;width:42px;height:42px;border-radius:14px;display:flex;align-items:center;justify-content:center;}" +
      ".hr-home-icon svg{width:22px;height:22px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;}" +
      ".hr-home-kpi-main{min-width:0;flex:1;}" +
      ".hr-home-kpi-main span{display:block;color:var(--xm-muted);font-size:13px;}" +
      ".hr-home-kpi-main b{display:block;margin-top:2px;font-size:26px;line-height:1.1;font-variant-numeric:tabular-nums;}" +
      ".hr-home-kpi-main b small{font-size:13px;font-weight:650;margin-left:2px;}" +
      ".hr-home-kpi-main em{display:block;margin-top:4px;font-style:normal;font-size:12px;color:var(--xm-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
      ".hr-home-kpi-main em.is-up{color:#12b36a;}" +
      ".hr-home-kpi-main em.is-down{color:#f04438;}" +
      ".hr-spark{width:72px;height:32px;flex:none;}" +
      ".hr-home-row{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(220px,.8fr) minmax(220px,.75fr);gap:12px;}" +
      ".hr-home-card{padding:14px 16px 16px;min-width:0;}" +
      ".hr-home-card h3{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:0 0 12px;font-size:15px;font-weight:700;}" +
      ".hr-seg{display:flex;gap:4px;flex-wrap:wrap;}" +
      ".hr-seg button{border:0;background:transparent;color:var(--xm-muted);font:inherit;font-size:12px;padding:4px 8px;border-radius:8px;cursor:pointer;}" +
      ".hr-seg button[aria-selected='true']{background:color-mix(in srgb,var(--xm-primary) 12%,var(--xm-card));color:var(--xm-primary);font-weight:650;}" +
      ".hr-line{width:100%;height:210px;display:block;}" +
      ".hr-home-quad{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;}" +
      ".hr-home-split{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(280px,.8fr);gap:12px;}" +
      ".hr-legend{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px;font-size:13px;}" +
      ".hr-legend li{display:flex;align-items:center;gap:8px;}" +
      ".hr-dot{width:8px;height:8px;border-radius:99px;flex:none;}" +
      ".hr-legend b{margin-left:auto;font-variant-numeric:tabular-nums;}" +
      ".hr-donut-wrap{display:flex;align-items:center;gap:12px;}" +
      ".hr-donut{width:132px;height:132px;flex:none;}" +
      ".hr-todo{display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--xm-line);}" +
      ".hr-todo i{width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex:none;color:#fff;font-style:normal;font-weight:700;}" +
      ".hr-todo b{display:block;font-size:13px;font-weight:650;}" +
      ".hr-todo span{color:var(--xm-muted);font-size:12px;}" +
      ".hr-bar-row{display:grid;grid-template-columns:78px minmax(0,1fr) 42px;gap:8px;align-items:center;margin:8px 0;font-size:12px;}" +
      ".hr-bar{height:8px;border-radius:99px;background:color-mix(in srgb,var(--xm-ink) 8%,var(--xm-card));overflow:hidden;}" +
      ".hr-bar i{display:block;height:100%;border-radius:99px;}" +
      ".hr-rank{margin:10px 0;font-size:13px;}" +
      ".hr-rank-top{display:flex;justify-content:space-between;gap:8px;}" +
      ".hr-rank-bar{height:8px;border-radius:99px;background:linear-gradient(90deg,#8eb6ff,#3b82f6);margin-top:6px;}" +
      ".hr-funnel{display:flex;gap:8px;}" +
      ".hr-funnel div{flex:1;background:color-mix(in srgb,var(--xm-primary) 8%,var(--xm-card));border-radius:12px;padding:10px 6px;text-align:center;}" +
      ".hr-funnel b{display:block;font-size:18px;}" +
      ".hr-funnel span{color:var(--xm-muted);font-size:12px;}" +
      ".hr-meter{height:8px;border-radius:99px;background:color-mix(in srgb,var(--xm-primary) 12%,var(--xm-card));overflow:hidden;margin:10px 0;}" +
      ".hr-meter i{display:block;height:100%;background:linear-gradient(90deg,#7cb0ff,#3b82f6);}" +
      ".hr-pill{border-radius:99px;padding:2px 8px;font-size:12px;white-space:nowrap;}" +
      ".hr-pill-try{color:#d48806;background:#fff7e6;}" +
      ".hr-pill-ok{color:#0f9f6e;background:#e8fff3;}" +
      ".hr-pill-off{color:#8c8c8c;background:#f5f5f5;}" +
      ".hr-linkish{border:0;background:transparent;color:var(--xm-primary);font:inherit;font-size:12px;cursor:pointer;}" +
      "@media (max-width:1100px){.hr-home-kpis{grid-template-columns:repeat(2,minmax(0,1fr));}.hr-home-row,.hr-home-quad,.hr-home-split{grid-template-columns:1fr;}}" +
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

  function paint(root, tab, month, today) {
    var hint = "钉钉是来源，这里只显示已经拉下来的记录。没有就空着。";
    var monthBar = '<div class="hr-toolbar"><span>' + esc(hint) + '</span><label class="hr-month">月份<input type="month" data-month value="' + esc(month) + '" /></label></div>';
    var html = "";
    if (tab === "attendance") {
      html = '<section class="hr-home" data-home>' +
        '<header class="hr-home-head"><div><h2 data-hello>上午好</h2><p>这里是智能人事管理中心，助力团队高效协同与人才发展</p></div>' +
        '<label class="hr-range"><select data-range>' +
        '<option value="7">近7天</option><option value="30" selected>近30天</option><option value="month">本月</option><option value="year">今年</option>' +
        '</select><span data-range-text></span></label></header>' +
        '<div class="hr-home-kpis" data-home-kpis></div>' +
        '<div class="hr-home-row"><section class="hr-card hr-home-card" data-trend-card></section>' +
        '<section class="hr-card hr-home-card" data-structure></section>' +
        '<section class="hr-card hr-home-card" data-todos></section></div>' +
        '<div class="hr-home-quad"><section class="hr-card hr-home-card" data-teams></section>' +
        '<section class="hr-card hr-home-card" data-gender></section>' +
        '<section class="hr-card hr-home-card" data-age></section>' +
        '<section class="hr-card hr-home-card" data-tenure></section></div>' +
        '<div class="hr-home-split"><section class="hr-card hr-home-card" data-moves></section>' +
        '<section class="hr-card hr-home-card" data-recruit-progress></section></div>' +
        '<p class="hr-msg" data-msg></p></section>';
      void today;
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
      html = '<section class="hr-panel"><div class="hr-toolbar"><span>按月统计待入职。点登记后进入员工管理的在职人员，记录在服务器上。</span>' +
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
    } else if (tab === "clock") {
      html = '<section class="hr-panel"><div class="hr-toolbar"><span>当天已经留档的打卡、迟到和请假。</span>' +
        '<label class="hr-month">日期<input type="date" data-clock-day value="' + esc(today) + '" /></label></div>' +
        '<div class="hr-stats" data-clock-kpis></div>' +
        '<p class="hr-msg" data-msg></p>' +
        table(["姓名", "部门", "工号", "上班", "下班", "状态"], emptyRow(6, "这一天还没有打卡")) + "</section>";
    } else if (tab === "pay") {
      html = '<section class="hr-panel"><div class="hr-toolbar"><span>薪酬金额还没有录入，这里不显示工资。绩效先用本月已留档的奋斗时长。</span>' +
        '<label class="hr-month">月份<input type="month" data-month value="' + esc(month) + '" /></label></div>' +
        '<div class="hr-stats" data-pay-kpis></div>' +
        '<section class="hr-card hr-board-card" data-pay-teams></section>' +
        '<p class="hr-msg" data-msg></p></section>';
    } else if (tab === "train") {
      html = '<section class="hr-panel"><div class="hr-card hr-board-card"><h3>培训发展</h3><div class="hr-empty">培训记录还没有录入。</div></div></section>';
    } else if (tab === "org") {
      html = '<section class="hr-panel"><div class="hr-toolbar"><span>按员工管理里的部门列出来。</span></div>' +
        '<div class="hr-org" data-org></div><p class="hr-msg" data-msg></p></section>';
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
        field("生日", '<input name="birthday" type="date" />') +
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
        table(["姓名", "性别", "工号", "部门", "岗位", "联系电话", "入职日期", "生日", "离职日期", "状态", "籍贯", "学历", "紧急联系人", "紧急电话", "备注", ""], emptyRow(16, "还没有花名册")) +
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

  function homeIcon(kind) {
    var paths = {
      staff: '<circle cx="8" cy="5" r="2.2"/><path d="M3.2 13c.5-2.2 2.2-3.3 4.8-3.3s4.3 1.1 4.8 3.3"/>',
      hired: '<path d="M8 3.2v6.2"/><path d="M5.6 7.2L8 9.6l2.4-2.4"/><path d="M3.4 12.8h9.2"/>',
      left: '<path d="M8 9.6V3.4"/><path d="M5.6 5.6L8 3.2l2.4 2.4"/><path d="M3.4 12.8h9.2"/>',
      lunch: '<path d="M3.6 7.2h8.8v1.6a4.4 4.4 0 0 1-8.8 0z"/><path d="M6 4.4V7.2"/><path d="M8 3.6V7.2"/><path d="M10 4.4V7.2"/>',
      cake: '<path d="M3.4 12.8h9.2V8H3.4z"/><path d="M8 3.6v4.4"/><path d="M6.4 4.6c.4.9 2.8.9 3.2 0"/><path d="M3.4 10.4h9.2"/>'
    };
    return '<svg viewBox="0 0 16 16" aria-hidden="true">' + (paths[kind] || paths.staff) + "</svg>";
  }

  function signed(value) {
    var num = Number(value) || 0;
    return (num > 0 ? "+" : "") + num;
  }

  function sparkLine(values, color) {
    var nums = (values || []).map(function (item) { return Number(item) || 0; });
    if (!nums.length) nums = [0];
    var max = Math.max.apply(null, nums.concat([1]));
    var min = Math.min.apply(null, nums);
    var span = max - min || 1;
    var width = 88;
    var height = 36;
    var points = nums.map(function (num, index) {
      var x = nums.length === 1 ? width : (index / (nums.length - 1)) * width;
      var y = height - ((num - min) / span) * (height - 6) - 3;
      return x.toFixed(1) + "," + y.toFixed(1);
    }).join(" ");
    return '<svg class="hr-spark" viewBox="0 0 ' + width + " " + height + '" aria-hidden="true"><polyline points="' + points + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function homeKpi(card) {
    var tone = card.good == null ? "" : card.good ? " is-up" : " is-down";
    return '<article class="hr-home-kpi"><i class="hr-home-icon" style="background:' + card.bg + ";color:" + card.color + '">' + homeIcon(card.icon) + "</i>" +
      '<div class="hr-home-kpi-main"><span>' + esc(card.label) + "</span><b>" + esc(card.value) + " <small>" + esc(card.unit || "") + "</small></b>" +
      '<em class="' + tone.trim() + '">' + esc(card.hint) + "</em></div>" + sparkLine(card.spark, card.color) + "</article>";
  }

  function lineChart(series, key) {
    var rows = series || [];
    if (!rows.length) return '<div class="hr-empty">这个范围还没有数据</div>';
    var values = rows.map(function (row) { return Number(row[key]) || 0; });
    var max = Math.max.apply(null, values.concat([1]));
    var width = 640;
    var height = 210;
    var pad = 28;
    var points = values.map(function (num, index) {
      var x = values.length === 1 ? pad : pad + (index / (values.length - 1)) * (width - pad * 2);
      var y = height - pad - (num / max) * (height - pad * 2);
      return [x, y];
    });
    var line = points.map(function (point) { return point[0].toFixed(1) + "," + point[1].toFixed(1); }).join(" ");
    var last = points[points.length - 1];
    var lastRow = rows[rows.length - 1];
    var label = (key === "rate" ? lastRow.rate + "%" : String(lastRow[key] || 0));
    var area = line + " " + last[0].toFixed(1) + "," + (height - pad) + " " + points[0][0].toFixed(1) + "," + (height - pad);
    return '<svg class="hr-line" viewBox="0 0 ' + width + " " + height + '" role="img"><polygon points="' + area + '" fill="rgba(59,130,246,.14)"/>' +
      '<polyline points="' + line + '" fill="none" stroke="#3b82f6" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<circle cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="4" fill="#3b82f6"/>' +
      '<text x="' + Math.max(8, last[0] - 78).toFixed(1) + '" y="' + Math.max(16, last[1] - 10).toFixed(1) + '" font-size="12" fill="#3b82f6">' +
      esc(String(lastRow.date || "").slice(5)) + " " + esc(label) + "</text></svg>";
  }

  var HOME_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899", "#94a3b8"];

  function donut(parts, center) {
    var total = parts.reduce(function (sum, part) { return sum + (Number(part.count) || 0); }, 0) || 1;
    var radius = 42;
    var circ = 2 * Math.PI * radius;
    var offset = 0;
    var rings = parts.map(function (part, index) {
      var len = ((Number(part.count) || 0) / total) * circ;
      var node = '<circle cx="60" cy="60" r="' + radius + '" fill="none" stroke="' + HOME_COLORS[index % HOME_COLORS.length] + '" stroke-width="14" stroke-dasharray="' +
        len.toFixed(2) + " " + (circ - len).toFixed(2) + '" stroke-dashoffset="' + (-offset).toFixed(2) + '" transform="rotate(-90 60 60)"/>';
      offset += len;
      return node;
    }).join("");
    return '<svg class="hr-donut" viewBox="0 0 120 120">' + rings +
      '<text x="60" y="56" text-anchor="middle" font-size="12" fill="currentColor" opacity="0.65">' + esc(center.label) + "</text>" +
      '<text x="60" y="76" text-anchor="middle" font-size="20" font-weight="700" fill="currentColor">' + esc(center.value) + "</text></svg>";
  }

  function legend(parts) {
    var total = parts.reduce(function (sum, part) { return sum + (Number(part.count) || 0); }, 0) || 1;
    return '<ul class="hr-legend">' + parts.map(function (part, index) {
      var ratio = part.ratio != null ? part.ratio : Math.round((Number(part.count) || 0) / total * 1000) / 10;
      return "<li><i class=\"hr-dot\" style=\"background:" + HOME_COLORS[index % HOME_COLORS.length] + "\"></i><span>" + esc(part.name || part.label) +
        "</span><b>" + esc(part.count || 0) + " · " + esc(ratio) + "%</b></li>";
    }).join("") + "</ul>";
  }

  function bars(parts) {
    var max = parts.reduce(function (peak, part) { return Math.max(peak, Number(part.ratio) || 0); }, 0) || 1;
    return parts.map(function (part, index) {
      var width = Math.max(2, Math.round(((Number(part.ratio) || 0) / max) * 100));
      return '<div class="hr-bar-row"><span>' + esc(part.label) + '</span><span class="hr-bar"><i style="width:' + width + "%;background:" +
        HOME_COLORS[index % HOME_COLORS.length] + '"></i></span><b>' + esc(part.ratio || 0) + "%</b></div>";
    }).join("");
  }

  function fillHome(root, pack) {
    var data = pack || {};
    var kpis = data.kpis || {};
    var active = kpis.active || {};
    var hired = kpis.hired || {};
    var left = kpis.left || {};
    var lunch = kpis.lunch || {};
    var birthday = kpis.birthday || {};
    var hello = root.querySelector("[data-hello]");
    if (hello) hello.textContent = (data.hello || "上午好") + (data.viewer ? "，" + data.viewer : "");
    var range = data.range || {};
    var rangeText = root.querySelector("[data-range-text]");
    if (rangeText) rangeText.textContent = (range.start || "") + " 至 " + (range.end || "");
    var select = root.querySelector("[data-range]");
    if (select && range.key) select.value = range.key;
    var kpiBox = root.querySelector("[data-home-kpis]");
    if (kpiBox) {
      var birthdayHint = birthday.next ? "最近 " + birthday.next.name + " " + birthday.next.date : "本月没有即将到来的生日";
      kpiBox.innerHTML = [
        homeKpi({ icon: "staff", label: "在职人数", value: active.value || 0, unit: "人", hint: "较上月 " + signed(active.delta) + " 人 " + (Number(active.delta) >= 0 ? "↑ " : "↓ ") + Math.abs(Number(active.percent) || 0) + "%", good: Number(active.delta) >= 0, spark: active.spark, bg: "#e8f1ff", color: "#3b82f6" }),
        homeKpi({ icon: "hired", label: "本月入职", value: hired.value || 0, unit: "人", hint: "较上月 " + signed(hired.delta) + " 人 " + (Number(hired.delta) >= 0 ? "↑ " : "↓ ") + Math.abs(Number(hired.percent) || 0) + "%", good: Number(hired.delta) >= 0, spark: hired.spark, bg: "#e9fbf1", color: "#12b36a" }),
        homeKpi({ icon: "left", label: "本月离职", value: left.value || 0, unit: "人", hint: "离职率 " + (left.rate || 0) + "% " + (Number(left.rateDelta) <= 0 ? "↓ " : "↑ ") + Math.abs(Number(left.rateDelta) || 0) + "pct", good: Number(left.rateDelta) <= 0, spark: left.spark, bg: "#fff1f0", color: "#f04438" }),
        homeKpi({ icon: "lunch", label: "今天午餐人数", value: lunch.value || 0, unit: "人", hint: "较昨日 " + signed(lunch.delta) + " 人", good: null, spark: lunch.spark, bg: "#fff6e8", color: "#f59e0b" }),
        homeKpi({ icon: "cake", label: "本月生日", value: birthday.value || 0, unit: "人", hint: birthdayHint, good: null, spark: birthday.spark, bg: "#f3e8ff", color: "#8b5cf6" })
      ].join("");
    }
    var metric = root.getAttribute("data-trend") || "active";
    var metricNames = { active: "在职人数", hired: "入职人数", left: "离职人数", rate: "离职率" };
    var trend = root.querySelector("[data-trend-card]");
    if (trend) {
      trend.innerHTML = "<h3>人员情况趋势<span class=\"hr-seg\">" + ["7", "30", "month", "year"].map(function (key) {
        var label = { "7": "近7天", "30": "近30天", month: "本月", year: "今年" }[key];
        return '<button type="button" data-range-pick="' + key + '" aria-selected="' + (range.key === key ? "true" : "false") + '">' + label + "</button>";
      }).join("") + "</span></h3><div class=\"hr-seg\">" + ["active", "hired", "left", "rate"].map(function (key) {
        return '<button type="button" data-trend="' + key + '" aria-selected="' + (metric === key ? "true" : "false") + '">' + metricNames[key] + "</button>";
      }).join("") + "</div>" + lineChart(data.series, metric);
    }
    var structure = root.querySelector("[data-structure]");
    var departments = data.departments || [];
    if (structure) {
      structure.innerHTML = "<h3>人员结构分布</h3>" + (departments.length ? '<div class="hr-donut-wrap">' + donut(departments, { label: "在职人数", value: active.value || 0 }) + legend(departments.map(function (row) {
        return { name: row.name, count: row.count, ratio: row.ratio };
      })) + "</div>" : '<div class="hr-empty">还没有在职人员</div>');
    }
    var todos = data.todos || [];
    var openTodo = root.getAttribute("data-todo") || "";
    var todoBox = root.querySelector("[data-todos]");
    if (todoBox) {
      var todoColors = { probation: "#f59e0b", late: "#3b82f6", recruit: "#8b5cf6" };
      todoBox.innerHTML = '<h3>待办事项 (' + todos.length + ')<button type="button" class="hr-linkish" data-act="todo-all">' + (openTodo === "all" ? "收起" : "查看全部") + "</button></h3>" +
        (todos.length ? todos.map(function (item) {
          var names = openTodo === "all" && item.names && item.names.length ? '<div class="hr-todo"><span>' + esc(item.names.join("、")) + "</span></div>" : "";
          return '<div class="hr-todo"><i style="background:' + (todoColors[item.kind] || "#94a3b8") + '">!</i><div><b>' + esc(item.title) + "</b><span>" + esc(item.when) + "</span></div></div>" + names;
        }).join("") : '<div class="hr-empty">暂无待办</div>');
    }
    var teamBox = root.querySelector("[data-teams]");
    var teams = data.teams || [];
    var teamMax = teams.reduce(function (peak, team) { return Math.max(peak, Number(team.value) || 0); }, 0) || 1;
    if (teamBox) {
      teamBox.innerHTML = "<h3>团队人效TOP5</h3><p class=\"hr-msg\">" + esc(data.teamMetric || "") + "</p>" + (teams.length ? teams.map(function (team, index) {
        var width = Math.max(8, Math.round(((Number(team.value) || 0) / teamMax) * 100));
        return '<div class="hr-rank"><div class="hr-rank-top"><span>' + (index + 1) + " " + esc(team.name) + "</span><b>" + esc(team.value) + esc(team.unit || "") +
          '</b></div><div class="hr-rank-bar" style="width:' + width + '%"></div></div>';
      }).join("") : '<div class="hr-empty">还没有团队数据</div>');
    }
    var gender = data.gender || { male: 0, female: 0 };
    var genderBox = root.querySelector("[data-gender]");
    if (genderBox) {
      var genderParts = [{ name: "男", count: gender.male || 0 }, { name: "女", count: gender.female || 0 }].filter(function (part) { return part.count; });
      genderBox.innerHTML = "<h3>性别结构</h3>" + (genderParts.length ? '<div class="hr-donut-wrap">' + donut(genderParts, { label: "在职", value: (gender.male || 0) + (gender.female || 0) }) + legend(genderParts) + "</div>" : '<div class="hr-empty">还没有填写性别</div>');
    }
    var ageBox = root.querySelector("[data-age]");
    if (ageBox) ageBox.innerHTML = "<h3>年龄结构</h3>" + (data.ageReady ? bars(data.ages || []) : '<div class="hr-empty">花名册还没填生日</div>');
    var tenureBox = root.querySelector("[data-tenure]");
    if (tenureBox) tenureBox.innerHTML = "<h3>司龄结构</h3>" + (data.tenureReady ? bars(data.tenures || []) : '<div class="hr-empty">还没有入职日期</div>');
    var moveKey = root.getAttribute("data-move") || "hired";
    var moveBox = root.querySelector("[data-moves]");
    var hiredRows = data.hiredRows || [];
    var leftRows = data.leftRows || [];
    var moveRows = moveKey === "left" ? leftRows : hiredRows;
    if (moveBox) {
      var body = moveRows.length ? moveRows.map(function (row) {
        var pill = row.status === "试用中" ? "hr-pill hr-pill-try" : row.status === "已离职" ? "hr-pill hr-pill-off" : "hr-pill hr-pill-ok";
        return "<tr><td>" + esc(row.name) + "</td><td>" + esc(row.department) + "</td><td>" + esc(row.position) + "</td><td>" + esc(row.date) +
          "</td><td>" + esc(row.probation) + '</td><td><span class="' + pill + '">' + esc(row.status) + "</span></td></tr>";
      }).join("") : emptyRow(6, moveKey === "left" ? "这个范围没有离职" : "这个范围没有入职");
      moveBox.innerHTML = '<h3>入离职明细<span class="hr-seg"><button type="button" data-move="hired" aria-selected="' + (moveKey !== "left") + '">新入职 (' + hiredRows.length +
        ')</button><button type="button" data-move="left" aria-selected="' + (moveKey === "left") + '">已离职 (' + leftRows.length + ")</button></span></h3>" +
        table(["姓名", "部门", "岗位", moveKey === "left" ? "离职日期" : "入职日期", "试用期", "状态"], body).replace("hr-card ", "");
    }
    var recruit = data.recruit || { steps: [], registered: 0, done: 0, rate: 0 };
    var recruitBox = root.querySelector("[data-recruit-progress]");
    if (recruitBox) {
      recruitBox.innerHTML = '<h3>招聘进度</h3><p>本月登记 ' + esc(recruit.registered || 0) + " 人，已录用 " + esc(recruit.done || 0) + " 人，录用率 " + esc(recruit.rate || 0) +
        '%</p><div class="hr-meter"><i style="width:' + Math.max(0, Math.min(100, Number(recruit.rate) || 0)) + '%"></i></div><div class="hr-funnel">' +
        (recruit.steps || []).map(function (step) {
          return "<div><b>" + esc(step.count || 0) + "</b><span>" + esc(step.label) + "</span></div>";
        }).join("") + "</div>";
    }
    setMsg(root, "", false);
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
    if (!pack.saved) setMsg(root, "这个月还没留档。每天 10 点留档昨天，每月 1 号覆盖上个月。", false);
    else if (pack.updatedAt) setMsg(root, "更新于 " + pack.updatedAt, false);
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
      birthday: row.birthday || "",
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
      "</td><td>" + staffBox(row, "joinedOn", "date", 10) + "</td><td>" + staffBox(row, "birthday", "date", 10) + "</td><td>" + staffBox(row, "leftOn", "date", 10) + "</td><td>" +
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
    var headers = ["姓名", "性别", "工号", "部门", "岗位", "联系电话", "入职日期", "生日", "离职日期", "状态", "籍贯", "学历", "紧急联系人", "紧急电话", "备注", ""];
    var body = rows.length ? rows.map(function (row) {
      return "<tr>" + staffCells(row) + "<td>" +
        '<button type="button" class="hr-mini" data-act="staff-edit" data-id="' + esc(row.id) + '">修改</button> ' +
        removeBtn("staff", row.id) + "</td></tr>";
    }).join("") : emptyRow(16, query ? "没有匹配的人" : picked === "离职" ? "没有离职人员" : picked === "在职" ? "没有在职人员" : "还没有花名册");
    setList(root, headers, body);
  }

  function monthQuery(root) {
    var input = root.querySelector("[data-month]");
    return input && input.value ? "?month=" + encodeURIComponent(input.value) : "";
  }

  function clockPack(pack) {
    var boards = (pack && pack.boards) || [];
    var total = boards.filter(function (item) { return item.id === "total"; })[0];
    if (total) return total;
    return { board: (pack && pack.board) || {}, punches: (pack && pack.punches) || [], roster: (pack && pack.roster) || [] };
  }

  function clockRows(punches) {
    var groups = {};
    (punches || []).forEach(function (row) {
      var key = (row.dingtalkUserId || row.userName || "") + "|" + row.workDate;
      if (!groups[key]) groups[key] = { userName: row.userName || "", department: row.department || "", jobNumber: row.jobNumber || "", on: "", off: "", label: "" };
      if (row.department) groups[key].department = row.department;
      if (row.checkType === "OffDuty") groups[key].off = row.checkAt || "";
      else groups[key].on = row.checkAt || "";
      if (row.label) groups[key].label = row.label;
    });
    return Object.keys(groups).map(function (key) { return groups[key]; }).sort(function (a, b) {
      return String(a.department).localeCompare(String(b.department), "zh") || String(a.userName).localeCompare(String(b.userName), "zh");
    });
  }

  function fillClock(root, pack) {
    var view = clockPack(pack);
    var board = view.board || {};
    var box = root.querySelector("[data-clock-kpis]");
    if (box) {
      box.innerHTML = [
        { label: "员工人数", value: board.staff || 0 },
        { label: "应到人数", value: board.expected || 0 },
        { label: "打卡人数", value: board.punched || 0 },
        { label: "迟到人数", value: board.late || 0 },
        { label: "请假人数", value: board.leave || 0 }
      ].map(function (item) {
        return '<div class="hr-kpi"><b>' + esc(item.value) + "</b><span>" + esc(item.label) + "</span></div>";
      }).join("");
    }
    var rows = clockRows(view.punches);
    var body = rows.length ? rows.map(function (row) {
      return "<tr><td>" + esc(row.userName || "未命名") + "</td><td>" + esc(row.department) + "</td><td>" + esc(row.jobNumber) +
        "</td><td>" + esc(String(row.on).slice(11)) + "</td><td>" + esc(String(row.off).slice(11)) + "</td><td>" + esc(row.label || (row.on || row.off ? "上班" : "未打卡")) + "</td></tr>";
    }).join("") : emptyRow(6, "这一天还没有打卡");
    setList(root, ["姓名", "部门", "工号", "上班", "下班", "状态"], body);
    setUpdated(root, pack && pack.updatedAt);
    setMsg(root, pack && pack.saved === false ? "这一天还没留档。" : "", false);
  }

  function fillPay(root, pack) {
    var box = root.querySelector("[data-pay-kpis]");
    if (box) {
      box.innerHTML = [
        { label: "薪酬", value: "未录入" },
        { label: "本月人均时长", value: pack.average || 0 },
        { label: "参与人数", value: pack.participants || 0 }
      ].map(function (item) {
        return '<div class="hr-kpi"><b>' + esc(item.value) + "</b><span>" + esc(item.label) + "</span></div>";
      }).join("");
    }
    var teams = pack.teams || [];
    var card = root.querySelector("[data-pay-teams]");
    if (card) {
      card.innerHTML = "<h3>各部门人均时长</h3>" + (teams.length ? teams.map(function (team) {
        return '<div class="hr-rank"><div class="hr-rank-top"><span>' + esc(team.name) + "</span><b>" + esc(team.average || 0) + "小时</b></div></div>";
      }).join("") : '<div class="hr-empty">这个月还没留档奋斗时长。</div>');
    }
    if (!pack.saved) setMsg(root, "这个月的绩效还没留档。薪酬金额仍然不在这里。", false);
    else setMsg(root, "", false);
  }

  function fillOrg(root, pack) {
    var box = root.querySelector("[data-org]");
    if (!box) return;
    var people = (pack.staff || []).filter(function (row) { return row.status !== "离职"; });
    var groups = {};
    people.forEach(function (row) {
      var name = row.department || "未分部门";
      if (!groups[name]) groups[name] = [];
      groups[name].push(row);
    });
    var names = Object.keys(groups).sort(function (a, b) { return groups[b].length - groups[a].length || a.localeCompare(b, "zh"); });
    box.innerHTML = names.length ? names.map(function (name) {
      return '<section class="hr-card hr-org-card"><h3>' + esc(name) + " · " + groups[name].length + "人</h3><ul>" +
        groups[name].sort(function (a, b) { return String(a.name).localeCompare(String(b.name), "zh"); }).map(function (row) {
          return "<li>" + esc(row.name) + (row.position ? " · " + esc(row.position) : "") + "</li>";
        }).join("") + "</ul></section>";
    }).join("") : '<div class="hr-empty">员工管理里还没有在职人员。</div>';
  }

  function loadTab(root, state) {
    var ticket = ++state.ticket;
    var tab = state.tab;
    if (tab === "attendance") {
      var rangeInput = root.querySelector("[data-range]");
      var range = rangeInput && rangeInput.value ? rangeInput.value : "30";
      state.home = state.home || {};
      var homeReq = state.home[range]
        ? Promise.resolve(state.home[range])
        : api("/api/hr/home?range=" + encodeURIComponent(range)).then(function (data) {
          state.home[range] = data;
          return data;
        });
      homeReq.then(function (view) {
        if (!state.alive || ticket !== state.ticket || state.tab !== tab) return;
        state.view = view;
        fillHome(root, view);
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
    if (tab === "overtime") {
      var effortInput = root.querySelector("[data-month]");
      var effortMonth = effortInput && effortInput.value ? effortInput.value : shanghaiToday().slice(0, 7);
      state.effort = state.effort || {};
      var effortReq = state.effort[effortMonth]
        ? Promise.resolve(state.effort[effortMonth])
        : api("/api/hr/effort?month=" + encodeURIComponent(effortMonth)).then(function (data) {
          state.effort[effortMonth] = data;
          return data;
        });
      effortReq.then(function (view) {
        if (!state.alive || ticket !== state.ticket || state.tab !== tab) return;
        state.view = view;
        fillEffort(root, view);
      }).catch(function (err) {
        if (!state.alive || ticket !== state.ticket) return;
        setMsg(root, err.message || "读取失败", true);
      });
      return;
    }
    if (tab === "clock") {
      var clockInput = root.querySelector("[data-clock-day]");
      var clockDay = clockInput && clockInput.value ? clockInput.value : shanghaiToday();
      state.clocks = state.clocks || {};
      var clockReq = state.clocks[clockDay]
        ? Promise.resolve(state.clocks[clockDay])
        : api("/api/hr/board?date=" + encodeURIComponent(clockDay)).then(function (data) {
          state.clocks[clockDay] = data;
          return data;
        });
      clockReq.then(function (view) {
        if (!state.alive || ticket !== state.ticket || state.tab !== tab) return;
        state.view = view;
        fillClock(root, view);
      }).catch(function (err) {
        if (!state.alive || ticket !== state.ticket) return;
        setMsg(root, err.message || "读取失败", true);
      });
      return;
    }
    if (tab === "pay") {
      var payInput = root.querySelector("[data-month]");
      var payMonth = payInput && payInput.value ? payInput.value : shanghaiToday().slice(0, 7);
      state.effort = state.effort || {};
      var payReq = state.effort[payMonth]
        ? Promise.resolve(state.effort[payMonth])
        : api("/api/hr/effort?month=" + encodeURIComponent(payMonth)).then(function (data) {
          state.effort[payMonth] = data;
          return data;
        });
      payReq.then(function (view) {
        if (!state.alive || ticket !== state.ticket || state.tab !== tab) return;
        state.view = view;
        fillPay(root, view);
      }).catch(function (err) {
        if (!state.alive || ticket !== state.ticket) return;
        setMsg(root, err.message || "读取失败", true);
      });
      return;
    }
    if (tab === "train") return;
    if (!state.people) {
      state.people = api("/api/people").then(safePeople).catch(function () { return []; });
    }
    if (!state.status) {
      state.status = api("/api/hr/status").catch(function () { return { configured: false }; });
    }
    var peopleReq = state.people;
    var statusReq = state.status;
    var dataReq;
    if (tab === "staff" || tab === "org") {
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
      if (tab === "attendance") fillHome(root, view);
      else if (tab === "overtime") fillEffort(root, view);
      else if (tab === "staff") fillStaff(root, view);
      else if (tab === "org") fillOrg(root, view);
      else if (tab === "recruit") fillRecruit(root, view);
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
    paint(root, id, shanghaiToday().slice(0, 7), shanghaiToday());
    loadTab(root, state);
  }

  function formValue(form, name) {
    var el = form.elements[name];
    return el ? String(el.value || "").trim() : "";
  }

  var STAFF_HEADERS = ["姓名", "性别", "工号", "部门", "岗位", "联系电话", "入职日期", "生日", "离职日期", "状态", "籍贯", "学历", "紧急联系人", "紧急电话", "备注"];
  var STAFF_KEYS = {
    "姓名": "name",
    "性别": "gender",
    "工号": "jobNumber",
    "部门": "department",
    "岗位": "position",
    "联系电话": "phone",
    "电话": "phone",
    "入职日期": "joinedOn",
    "生日": "birthday",
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
    ["name", "gender", "jobNumber", "department", "position", "phone", "joinedOn", "birthday", "leftOn", "status", "hometown", "education", "emergencyName", "emergencyPhone", "note"].forEach(function (key) {
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
    paint(root, state.tab, shanghaiToday().slice(0, 7), shanghaiToday());

    function onClick(event) {
      var trend = event.target.closest("[data-trend]");
      if (trend && root.contains(trend) && state.view) {
        event.preventDefault();
        root.setAttribute("data-trend", trend.getAttribute("data-trend"));
        fillHome(root, state.view);
        return;
      }
      var move = event.target.closest("[data-move]");
      if (move && root.contains(move) && state.view) {
        event.preventDefault();
        root.setAttribute("data-move", move.getAttribute("data-move"));
        fillHome(root, state.view);
        return;
      }
      var rangePick = event.target.closest("[data-range-pick]");
      if (rangePick && root.contains(rangePick)) {
        event.preventDefault();
        var rangeSelect = root.querySelector("[data-range]");
        if (rangeSelect) rangeSelect.value = rangePick.getAttribute("data-range-pick");
        loadTab(root, state);
        return;
      }
      var todoAll = event.target.closest("[data-act='todo-all']");
      if (todoAll && root.contains(todoAll) && state.view) {
        event.preventDefault();
        root.setAttribute("data-todo", root.getAttribute("data-todo") === "all" ? "" : "all");
        fillHome(root, state.view);
        return;
      }
      var refresh = event.target.closest("[data-act='refresh-board']");
      if (refresh && root.contains(refresh)) {
        event.preventDefault();
        if (refresh.disabled) return;
        var day = shanghaiToday();
        refresh.disabled = true;
        refresh.textContent = "正在拉取";
        api("/api/hr/sync", { method: "POST", body: { date: day } })
          .then(function (data) {
            setUpdated(root, data.updatedAt);
            state.home = {};
            state.clocks = {};
            state.effort = {};
            if (state.tab === "attendance" || state.tab === "clock" || state.tab === "pay" || state.tab === "overtime") loadTab(root, state);
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
          .then(function () { state.effort = {}; loadTab(root, state); })
          .catch(function (err) { setMsg(root, err.message, true); });
        return;
      }
      var unbind = event.target.closest("[data-act='unbind']");
      if (unbind && root.contains(unbind)) {
        event.preventDefault();
        api("/api/hr/links/" + encodeURIComponent(unbind.getAttribute("data-person")), { method: "DELETE" })
          .then(function () { state.effort = {}; loadTab(root, state); })
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
            setMsg(root, data.already ? "已经登记过入职" : "已登记入职，已写入员工管理的在职人员", false);
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
        birthday: formValue(form, "birthday"),
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
      if (target.matches("[data-month], [data-range], [data-join-month], [data-clock-day]")) {
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
