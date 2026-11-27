!function(){var t=[{id:"attendance",label: "数据看板"},{id:"overtime",label: "奋斗时长"},{id:"recruit",label: "招聘管理"},{id:"staff",label: "员工管理"},{id:"clock",label: "考勤管理"},{id:"pay",label: "薪酬绩效"},{id:"train",label: "培训发展"},{id:"org",label: "组织架构"}],e=["男","女"];function a(t){return String(null==t?"":t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function r(){var t=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Shanghai",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date),e={};return t.forEach((function(t){e[t.type]=t.value})),e.year+"-"+e.month+"-"+e.day}function n(t,e){return t.map((function(t){return'<option value="'+a(t)+'"'+(t===e?"selected":"")+">"+a(t)+"</option>"})).join("")}function o(t,e){var a=e||{},r={Accept:"application/json"};return a.body&&(r["Content-Type"]="application/json"),fetch(t,{method:a.method||"GET",credentials:"same-origin",headers:r,body:a.body?JSON.stringify(a.body):void 0}).then((function(t){return t.json().catch((function(){return{}})).then((function(e){if(!t.ok||!1===e.ok){var a=new Error(e&&e.error||"读取失败");throw a.status=t.status,a}return e||{}}))}))}function l(t,e){return'<div class="hr-card hr-table-wrap" data-list><table class="hr-table"><thead><tr>'+t.map((function(t){return"<th>"+a(t)+"</th>"})).join("")+"</tr></thead><tbody>"+e+"</tbody></table></div>"}function d(t,e){return'<tr><td colspan="'+t+'"><div class="hr-empty">'+a(e)+"</div></td></tr>"}function s(t,e,r){return'<label class="hr-field '+(r||"")+'">'+a(t)+e+"</label>"}function c(t,e,a){var r=t.querySelector("[data-list]");r&&(r.outerHTML=l(e,a))}function u(t,e,a){if(!a&&(e==="已保存"||e==="已调整部门")&&window.XmSaveFeedback)window.XmSaveFeedback.saved();var r=t.querySelector("[data-msg]");r&&(r.textContent=e||"",r.classList.toggle("is-error",!!a))}function p(t,r,o,i){stopOrgConnections(t);var c;a("钉钉是来源，这里只显示已经拉下来的记录。没有就空着。"),a(o),c="attendance"===r?dashboardMarkup():"overtime"===r?'<section class="hr-panel hr-effort"><div class="hr-toolbar"><span>运营部门，18:00 之后的下班打卡。角色从组织中心对齐。</span><span class="hr-link"><button type="button" class="hr-mini" data-act="download">下载表格</button><label class="hr-month">月份<input type="month" data-month value="'+a(o)+'" /></label></span></div><div class="hr-board-kpis" data-effort-kpis></div><section class="hr-card hr-board-card" data-teams></section><div class="hr-rank-grid" data-ranks></div><section class="hr-card hr-watch" data-watch></section><p class="hr-msg" data-msg></p>'+l(["姓名","部门","角色","组织","月累计"],d(5,"这个月还没有 18 点后的下班打卡"))+"</section>":"recruit"===r?'<section class="hr-panel hr-home hr-recruit hr-recruit-kpis"><div class="hr-home-head"><div><h2>招聘管理</h2><p>看本月登记、面试和入职。职位发布、初筛、Offer、年龄和招聘周期还没有录入。</p></div><span class="hr-link"><label class="hr-month">月份<input type="month" data-join-month value="'+a(String(i).slice(0,7))+'" /></label><select disabled><option>甄选</option></select><button type="button" class="hr-primary" data-act="recruit-new">登记待入职</button></span></div><div data-recruit></div><form class="hr-form hr-card" data-form="recruit" hidden>'+s("姓名",'<input name="name" required maxlength="64" autocomplete="off" />')+s("性别",'<select name="gender"><option value="">请选择</option>'+n(e,"")+"</select>")+s("应聘岗位",'<input name="position" maxlength="64" autocomplete="off" />')+s("预计入职时间",'<input name="expectedJoin" type="date" />')+s("联系电话",'<input name="phone" maxlength="32" autocomplete="off" />')+s("籍贯",'<input name="hometown" maxlength="64" autocomplete="off" />')+s("渠道",'<input name="channel" maxlength="64" autocomplete="off" />')+s("邀约人",'<input name="inviter" maxlength="64" autocomplete="off" />')+s("备注",'<input name="note" maxlength="500" autocomplete="off" />',"hr-field-grow")+s("情况说明",'<textarea name="detail" maxlength="1000" rows="3"></textarea>',"hr-field-wide")+'<button class="hr-primary" type="submit">登记待入职</button></form><form class="hr-form hr-card" data-form="onboard" hidden>'+s("姓名",'<input name="name" required maxlength="64" autocomplete="off" />')+s("性别",'<select name="gender"><option value="">请选择</option>'+n(e,"")+"</select>")+s("入职部门",'<input name="department" maxlength="64" autocomplete="off" />')+s("岗位",'<input name="position" maxlength="64" autocomplete="off" />')+s("入职日期",'<input name="joinedOn" type="date" />')+s("联系电话",'<input name="phone" maxlength="32" autocomplete="off" />')+s("籍贯",'<input name="hometown" maxlength="64" autocomplete="off" />')+s("渠道",'<input name="channel" maxlength="64" autocomplete="off" />')+s("邀约人",'<input name="inviter" maxlength="64" autocomplete="off" />')+s("备注",'<input name="note" maxlength="500" autocomplete="off" />',"hr-field-grow")+s("情况说明",'<textarea name="detail" maxlength="1000" rows="3"></textarea>',"hr-field-wide")+'<button class="hr-primary" type="submit">登记入职情况</button></form><p class="hr-msg" data-msg></p></section>':"clock"===r?'<section class="hr-panel hr-home hr-clock"><div class="hr-home-head"><div><h2>考勤管理</h2><p>看已经留档的打卡、迟到和请假。班次、出差、排班和补卡还没有录入。</p></div><span class="hr-link hr-clock-head"><label class="hr-month">月份<input type="month" data-month value="'+a(o)+'" /></label><select disabled><option>甄选</option></select><button type="button" class="hr-primary" data-act="clock-export">导出报表</button></span></div><div data-clock></div><p class="hr-msg" data-msg></p></section>':"pay"===r?'<section class="hr-panel"><div class="hr-toolbar"><span>薪酬金额还没有录入，这里不显示工资。绩效先用本月已留档的奋斗时长。</span><label class="hr-month">月份<input type="month" data-month value="'+a(o)+'" /></label></div><div class="hr-stats" data-pay-kpis></div><section class="hr-card hr-board-card" data-pay-teams></section><p class="hr-msg" data-msg></p></section>':"train"===r?'<section class="hr-panel"><div class="hr-card hr-board-card"><h3>培训发展</h3><div class="hr-empty">培训记录还没有录入。</div></div></section>':"org"===r?'<section class="hr-panel hr-home"><div class="hr-home-head"><div><h2>组织架构</h2><p>罗成管理运营部、技术部、人事部。其他部门在甄选打卡。编制和职级还没有录入。</p></div><span class="hr-link"><button type="button" class="hr-mini" data-act="staff-pick">导入</button><input type="file" accept=".csv,text/csv" data-staff-file hidden /><button type="button" class="hr-mini" data-act="org-export">导出</button><button type="button" class="hr-primary" data-act="org-new">新建部门</button></span></div><div data-org></div><p class="hr-msg" data-msg></p></section>':'<section class="hr-panel hr-home hr-staff"><div class="hr-home-head"><div><h2>员工管理</h2><p>管理入职、在职和离职。</p></div><span class="hr-link"><button type="button" class="hr-mini" data-act="staff-pick">批量导入</button><input type="file" accept=".xlsx,.csv" data-staff-file hidden /><button type="button" class="hr-mini" data-act="staff-template">下载模板</button><button type="button" class="hr-mini" data-act="staff-sync">从打卡带入</button><button type="button" class="hr-primary" data-act="staff-new">新增员工</button></span></div><div data-staff></div>'+staffFormMarkup()+'<p class="hr-msg" data-msg></p></section>',t.querySelector(".hr-body").innerHTML=c}function f(t){var e={staff:'<circle cx="8" cy="5.2" r="2.1"/><path d="M3.2 13.2c.6-2.3 2.4-3.4 4.8-3.4s4.2 1.1 4.8 3.4"/>',hired:'<path d="M8 3.2v6M5.6 7.2 8 9.6l2.4-2.4M3.4 12.8h9.2"/>',left:'<path d="M8 9.6V3.6M5.6 5.6 8 3.2l2.4 2.4M3.4 12.8h9.2"/>',lunch:'<path d="M3.8 7.2h8.4v1.3a4.2 4.2 0 0 1-8.4 0zM6.2 4.6V7M8 3.8V7M9.8 4.6V7"/>',cake:'<path d="M3.5 12.6h9V8h-9zM8 4.2v3.6M6.6 5.1c.4.7 2.4.7 2.8 0"/>'};return'<svg viewBox="0 0 16 16" aria-hidden="true">'+(e[t]||e.staff)+"</svg>"}function h(t){var e=Number(t)||0;return(e>0?"+":"")+e}function m(t){var n=window.XmUI,o={staff:"users",hired:"check",left:"close",lunch:"file",cake:"award"},i={staff:"blue",hired:"green",left:"orange",lunch:"orange",cake:"purple"};return n.StatCard({label:t.label,value:String(null==t.value?0:t.value),unit:t.unit||"",note:t.hint||"",trend:t.good?"up":"",tone:t.tone||i[t.icon]||"blue",icon:o[t.icon]||"chart"})}function g(t,e){var r=t||[];if(!r.length)return'<div class="hr-empty">这个范围还没有数据</div>';var n=r.map((function(t){return Number(t[e])||0})),o=Math.max.apply(null,n.concat([1])),i=n.map((function(t,e){return[1===n.length?32:32+e/(n.length-1)*600,198-t/o*182]})),l=i.map((function(t){return t[0].toFixed(1)+","+t[1].toFixed(1)})).join(" "),d=i[i.length-1],s=r[r.length-1],c="rate"===e?s.rate+"%":String(s[e]||0),u=i[0][0].toFixed(1)+",198 "+l+" "+d[0].toFixed(1)+",198",p=[0,.5,1].map((function(t){var e=(198-182*t).toFixed(1),a=0===t?"0":1===t?String(Math.round(o)):"";return'<line x1="32" y1="'+e+'" x2="632" y2="'+e+'" stroke="#eef2f6"/>'+(a?'<text x="2" y="'+(Number(e)+4)+'" font-size="11" fill="#98a2b3">'+a+"</text>":"")})).join(""),f=Math.max(32,Math.min(540,d[0]-48)),h=Math.max(2,d[1]-40);return'<svg class="hr-line" viewBox="0 0 640 220" role="img">'+p+'<polygon points="'+u+'" fill="rgba(47,107,255,.14)"/><polyline points="'+l+'" fill="none" stroke="#2f6bff" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="'+d[0].toFixed(1)+'" cy="'+d[1].toFixed(1)+'" r="4" fill="#fff" stroke="#2f6bff" stroke-width="2"/><rect x="'+f.toFixed(1)+'" y="'+h.toFixed(1)+'" width="92" height="30" rx="8" fill="#fff" stroke="#e7edf5"/><text x="'+(f+8).toFixed(1)+'" y="'+(h+13).toFixed(1)+'" font-size="11" fill="#98a2b3">'+a(String(s.date||"").slice(5))+'</text><text x="'+(f+8).toFixed(1)+'" y="'+(h+25).toFixed(1)+'" font-size="12" font-weight="700" fill="#2f6bff">'+a(c)+'</text><text x="32" y="216" font-size="11" fill="#98a2b3">'+a(String(r[0].date||"").slice(5))+'</text><text x="632" y="216" text-anchor="end" font-size="11" fill="#98a2b3">'+a(String(s.date||"").slice(5))+"</text></svg>"}var b=["#2f6bff","#22c55e","#f5a524","#8b5cf6","#22c3ee","#f43f8a","#94a3b8"];function v(t,e){var r=t.reduce((function(t,e){return t+(Number(e.count)||0)}),0)||1,n=2*Math.PI*52,o=0;return'<svg class="hr-donut" viewBox="0 0 140 140">'+t.map((function(t,e){var a=(Number(t.count)||0)/r*n,i='<circle cx="70" cy="70" r="52" fill="none" stroke="'+(t.color||b[e%b.length])+'" stroke-width="16" stroke-linecap="butt" stroke-dasharray="'+a.toFixed(2)+" "+(n-a).toFixed(2)+'" stroke-dashoffset="'+(-o).toFixed(2)+'" transform="rotate(-90 70 70)"/>';return o+=a,i})).join("")+'<text x="70" y="66" text-anchor="middle" font-size="12" fill="#98a2b3">'+a(e.label)+'</text><text x="70" y="90" text-anchor="middle" font-size="26" font-weight="700" fill="#1d2939">'+a(e.value)+"</text></svg>"}function x(t){var e=t.reduce((function(t,e){return t+(Number(e.count)||0)}),0)||1;return'<ul class="hr-legend">'+t.map((function(t,r){var n=null!=t.ratio?t.ratio:Math.round((Number(t.count)||0)/e*1e3)/10;return'<li><i class="hr-dot" style="background:'+(t.color||b[r%b.length])+'"></i><span>'+a(t.name||t.label)+"</span><b>"+a(t.count||0)+"</b><em>"+a(n)+"%</em></li>"})).join("")+"</ul>"}
  function dashboardMarkup() {
    return `
      <section class="hr-dashboard" data-home>
        <header class="hr-dashboard-head">
          <div class="hr-dashboard-title">
            <span class="hr-dashboard-eyebrow">WORKFORCE OVERVIEW</span>
            <h1>人事数据看板</h1>
            <p class="hr-dashboard-subtitle">管理招聘、员工档案和考勤，查看奋斗时长、薪酬绩效、培训发展及组织架构</p>
          </div>
          <p class="hr-msg" data-msg role="status"></p>
          <label class="hr-dashboard-range">
            <span class="xm-ui-sr-only">看板日期范围</span>
            <select data-range>
              <option value="7">近7天</option>
              <option value="30" selected>近30天</option>
              <option value="month">本月</option>
              <option value="year">今年</option>
            </select>
            <span data-range-text></span>
          </label>
        </header>
        <div class="hr-dashboard-context">
          <div class="hr-dashboard-context-copy">
            <span class="hr-dashboard-context-label">当前视角</span>
            <strong data-context-title>全员概览</strong>
            <span data-context-meta>覆盖全部在职人员</span>
          </div>
          <div class="hr-dashboard-filters" role="group" aria-label="部门筛选">
            <span>部门</span>
            <div data-dept-filters></div>
            <button type="button" class="hr-dashboard-reset" data-dashboard-reset hidden>清除筛选</button>
          </div>
        </div>
        <div class="hr-dashboard-kpis" data-home-kpis></div>
        <div class="hr-dashboard-grid">
          <div class="hr-dashboard-slot" data-trend-card></div>
          <div class="hr-dashboard-slot" data-structure></div>
          <div class="hr-dashboard-slot" data-todos></div>
          <div class="hr-dashboard-slot" data-teams></div>
          <div class="hr-dashboard-slot" data-demographics></div>
          <div class="hr-dashboard-slot" data-moves></div>
          <div class="hr-dashboard-slot" data-recruit-progress></div>
        </div>
        <dialog class="hr-dashboard-dialog" aria-labelledby="hr-dashboard-dialog-title">
          <header>
            <h2 id="hr-dashboard-dialog-title"></h2>
            <form method="dialog"><button type="submit" aria-label="关闭">×</button></form>
          </header>
          <div data-dashboard-dialog-body></div>
        </dialog>
      </section>`;
  }

  const dashboardTrends = { active: "在职人数", hired: "入职人数", left: "离职人数", rate: "离职率" };
  const dashboardColors = ["#3478f6", "#19a77c", "#e69327", "#8a65e5", "#23a8cb", "#e96698", "#8b9bb2"];

  function dashboardChart(series, metric) {
    if (!series.length) return '<p class="hr-dashboard-empty">这个范围还没有数据</p>';
    const values = series.map((row) => Number(row[metric]) || 0);
    const maximum = Math.max(1, ...values);
    const scale = 10 ** Math.floor(Math.log10(maximum));
    const step = Math.max(1, Math.ceil(maximum / 2 / scale) * scale);
    const ceiling = step * 2;
    const unit = metric === "rate" ? "%" : "";
    const tickIndices = [...new Set([0, Math.floor((series.length - 1) / 3), Math.floor((series.length - 1) * 2 / 3), series.length - 1])];
    const points = values.map((value, index) => {
      const x = values.length === 1 ? 500 : index / (values.length - 1) * 1000;
      return x.toFixed(2) + "," + (100 - value / ceiling * 100).toFixed(2);
    }).join(" ");
    const latest = values[values.length - 1];
    return `
      <div class="hr-dashboard-chart" role="img" aria-label="${a(dashboardTrends[metric])}，最新值 ${latest}${unit}">
        <div class="hr-chart-y" aria-hidden="true"><span>${ceiling}${unit}</span><span>${step}${unit}</span><span>0${unit}</span></div>
        <div class="hr-chart-plot" aria-hidden="true">
          <svg viewBox="0 0 1000 100" preserveAspectRatio="none">
            <path class="hr-chart-lines" d="M0 0H1000 M0 50H1000 M0 100H1000" vector-effect="non-scaling-stroke"/>
            ${values.length > 1 ? '<polygon points="0,100 ' + points + ' 1000,100"/>' : ""}
            <polyline points="${points}" vector-effect="non-scaling-stroke"/>
            <g class="hr-chart-points">${values.map((value, index) => {
              const x = values.length === 1 ? 500 : index / (values.length - 1) * 1000;
              const y = 100 - value / ceiling * 100;
              return '<circle cx="' + x.toFixed(2) + '" cy="' + y.toFixed(2) + '" r="7"><title>' + a(String(series[index].date || "").slice(5)) + ' · ' + a(value + unit) + '</title></circle>';
            }).join("")}</g>
          </svg>
          <i class="hr-chart-point" style="--point-x:${values.length === 1 ? 50 : 100}%;--point-y:${100 - latest / ceiling * 100}%"></i>
        </div>
        <div class="hr-chart-x" aria-hidden="true">${tickIndices.map((index) => "<span>" + a(String(series[index].date || "").slice(5)) + "</span>").join("")}</div>
      </div>`;
  }

  function dashboardDemographic(label, bands, emptyText) {
    const legend = bands.map((band, index) => {
      const percent = Math.max(0, Math.min(100, Number(band.ratio) || 0));
      const count = band.count == null ? "" : " " + a(band.count) + "人 ·";
      return '<span style="--band-color:' + dashboardColors[index] + '">' + a(band.label) + count + ' <b>' + percent + '%</b></span>';
    }).join("");
    const bar = bands.map((band, index) => {
      const weight = Math.max(0, Number(band.ratio) || 0);
      return '<i style="flex-grow:' + weight + ';background:' + dashboardColors[index] + '"></i>';
    }).join("");
    return '<div class="hr-demographic"><h3>' + label + '</h3>' +
      (bands.length ? '<div class="hr-demographic-bar" aria-hidden="true">' + bar + '</div><div class="hr-demographic-legend">' + legend + '</div>'
        : '<span class="hr-demographic-empty">' + emptyText + '</span>') + '</div>';
  }

  function dashboardMovementTable(rows, leaving, compact) {
    const columns = [
      { key: "name", label: "姓名" },
      { key: "department", label: "部门" },
      { key: "date", label: leaving ? "离职日期" : "入职日期" }
    ];
    if (!compact) {
      columns.splice(2, 0, { key: "position", label: "岗位" });
      columns.push({ key: "probation", label: "试用期" }, { key: "status", label: "状态", type: "status" });
    }
    return window.XmUI.DataTable({
      columns,
      rows: rows.map((row) => ({
        ...row,
        status: { label: row.status || "", tone: row.status === "试用中" ? "warning" : row.status === "已离职" ? "danger" : "success" }
      }))
    });
  }

  function openDashboardDetail(root, view, target) {
    const dialog = root.querySelector(".hr-dashboard-dialog");
    const title = dialog.querySelector("h2");
    const body = dialog.querySelector("[data-dashboard-dialog-body]");
    if (target === "moves") {
      const leaving = root.getAttribute("data-move") === "left";
      const department = root.getAttribute("data-dept") || "";
      title.textContent = leaving ? "离职明细" : "入职明细";
      const rows = (leaving ? view.leftRows : view.hiredRows) || [];
      body.innerHTML = dashboardMovementTable(department ? rows.filter((row) => row.department === department) : rows, leaving, false);
    } else {
      const todo = (view.todos || [])[Number(target)];
      if (!todo) return;
      title.textContent = todo.title;
      body.innerHTML = '<p>' + a(todo.when) + '</p><ul class="hr-dashboard-names">' +
        (todo.names || []).map((name) => "<li>" + a(name) + "</li>").join("") + "</ul>";
    }
    dialog.showModal();
  }

  function y(root, view) {
    const board = root.querySelector("[data-home]");
    if (!board) return;

    const ui = window.XmUI;
    const card = (slot, title, content) => {
      board.querySelector(slot).innerHTML = ui.ContentCard({ title, content });
    };
    const empty = (title) => ui.EmptyState({ title });
    const range = view.range || {};
    board.querySelector("[data-range-text]").textContent = range.start && range.end ? range.start + " 至 " + range.end : "";
    const selectedDepartment = root.getAttribute("data-dept") || "";
    const departments = (view.departments || []).map((dept, index) => ({ ...dept, color: dashboardColors[index] }));
    const filterableDepartments = departments.filter((dept) => !["其他", "未分部门"].includes(dept.name));
    const selectedDeptRow = departments.find((dept) => dept.name === selectedDepartment);
    board.querySelector("[data-context-title]").textContent = selectedDepartment || "全员概览";
    board.querySelector("[data-context-meta]").textContent = selectedDeptRow
      ? "聚焦 " + selectedDeptRow.count + " 名在职人员 · 点击部门可切换"
      : "覆盖全部在职人员 · 点击部门可切换";
    const filters = board.querySelector("[data-dept-filters]");
    filters.closest(".hr-dashboard-filters").hidden = filterableDepartments.length <= 1;
    filters.innerHTML = ['<button type="button" data-dept-filter="" aria-pressed="' + (!selectedDepartment) + '">全部</button>']
      .concat(filterableDepartments.map((dept) => '<button type="button" data-dept-filter="' + a(dept.name) + '" aria-pressed="' + (dept.name === selectedDepartment) + '">' + a(dept.name) + '</button>'))
      .join("");
    const reset = board.querySelector("[data-dashboard-reset]");
    reset.hidden = !selectedDepartment;

    const { active = {}, hired = {}, left = {}, lunch = {}, birthday = {} } = view.kpis || {};
    const monthlyChange = (entry) => "较上月 " + h(entry.delta) + " 人 · " + h(entry.percent) + "%";
    board.querySelector("[data-home-kpis]").innerHTML = [
      { icon: "staff", label: "在职人数", value: active.value, hint: monthlyChange(active), good: active.delta > 0 },
      { icon: "hired", label: "本月入职", value: hired.value, hint: monthlyChange(hired), good: hired.delta > 0 },
      { icon: "left", label: "本月离职", value: left.value, hint: "离职率 " + (left.rate || 0) + "% · 较上月 " + h(left.rateDelta) + " 个百分点", good: left.rateDelta < 0 },
      { icon: "lunch", label: "今天午餐人数", value: lunch.value, hint: "较昨日 " + h(lunch.delta) + " 人" },
      { icon: "cake", label: "本月生日", value: birthday.value, hint: birthday.next ? "最近 " + birthday.next.name + " " + birthday.next.date : "暂无即将到来的生日" }
    ].map((item) => m({ ...item, unit: "人" })).join("");

    const metric = root.getAttribute("data-trend") || "active";
    const series = view.series || [];
    const latest = series[series.length - 1];
    const trendButtons = Object.entries(dashboardTrends).map(([key, label]) =>
      '<button type="button" data-trend="' + key + '" aria-pressed="' + (metric === key) + '">' + label + '</button>'
    ).join("");
    card("[data-trend-card]", "人员情况趋势",
      '<div class="hr-dashboard-chart-head"><div class="hr-dashboard-segment" role="group" aria-label="趋势指标">' + trendButtons + '</div>' +
      (latest ? '<span class="hr-chart-latest">' + a(latest.date) + ' <b>' + a(latest[metric] || 0) + (metric === "rate" ? "%" : "") + '</b></span>' : "") +
      '</div>' + dashboardChart(series, metric));

    const departmentLegend = departments.map((dept) => filterableDepartments.includes(dept) ? '<button type="button" data-dept-filter="' + a(dept.name) + '" aria-pressed="' + (dept.name === selectedDepartment) + '"><i class="hr-dept-dot" style="background:' + dept.color + '"></i><span>' + a(dept.name) + '</span><b>' + a(dept.count) + '</b><em>' + a(dept.ratio) + '%</em></button>' : '<div class="hr-dept-static"><i class="hr-dept-dot" style="background:' + dept.color + '"></i><span>' + a(dept.name) + '</span><b>' + a(dept.count) + '</b><em>' + a(dept.ratio) + '%</em></div>').join("");
    const departmentDonut = selectedDeptRow ? [selectedDeptRow] : departments;
    card("[data-structure]", "部门人员分布", departments.length ?
      '<div class="hr-donut-wrap">' + v(departmentDonut, { label: selectedDeptRow ? selectedDeptRow.name : "在职人数", value: selectedDeptRow ? selectedDeptRow.count : active.value || 0 }) + '<div class="hr-dept-legend">' + departmentLegend + '</div></div>'
      : empty("还没有在职人员"));

    const todos = view.todos || [];
    card("[data-todos]", "待办事项（" + todos.length + "）", todos.length ?
      '<div class="hr-dashboard-todos">' + todos.map((todo, index) =>
        '<button type="button" data-dashboard-detail="' + index + '"><strong>' + a(todo.title) + '</strong><span>' + a(todo.when) + ' · 查看名单 ›</span></button>'
      ).join("") + '</div>' : empty("暂无待办"));

    const teams = view.teams || [];
    const teamMax = Math.max(1, ...teams.map((team) => Number(team.value) || 0));
    card("[data-teams]", view.teamMetric === "在职人数" ? "团队在职人数" : "团队奋斗平均时长", teams.length ?
      '<ol class="hr-dashboard-ranks">' + teams.map((team, index) =>
        '<li><span class="hr-dashboard-rank-number">' + (index + 1) + '</span><div><span title="' + a(team.name) + '">' + a(team.name) +
        '</span><div class="hr-rank-track"><i style="width:' + Math.max(0, (Number(team.value) || 0) / teamMax * 100) + '%"></i></div></div><b>' +
        a(team.value) + ' <small>' + a(team.unit || "") + '</small></b></li>'
      ).join("") + '</ol>' : empty("还没有团队数据"));

    const { male = 0, female = 0 } = view.gender || {};
    const genderTotal = Number(male) + Number(female);
    const genderBands = genderTotal ? [
      { label: "男", count: male, ratio: Math.round(male / genderTotal * 1000) / 10 },
      { label: "女", count: female, ratio: Math.round(female / genderTotal * 1000) / 10 }
    ] : [];
    card("[data-demographics]", "员工画像",
      '<div class="hr-demographics">' +
      dashboardDemographic("性别结构", genderBands, "花名册未填写性别") +
      dashboardDemographic("年龄结构", view.ageReady ? view.ages || [] : [], "花名册未填写生日") +
      dashboardDemographic("司龄结构", view.tenureReady ? view.tenures || [] : [], "花名册未填写入职日期") + '</div>');

    const leaving = root.getAttribute("data-move") === "left";
    const hiredRows = view.hiredRows || [];
    const leftRows = view.leftRows || [];
    const filterRows = (rows) => selectedDepartment ? rows.filter((row) => row.department === selectedDepartment) : rows;
    const filteredHiredRows = filterRows(hiredRows);
    const filteredLeftRows = filterRows(leftRows);
    const moves = leaving ? filteredLeftRows : filteredHiredRows;
    card("[data-moves]", "入离职明细",
      '<div class="hr-dashboard-move-head"><div class="hr-dashboard-segment" role="group" aria-label="人员变动类型">' +
      '<button type="button" data-move="hired" aria-pressed="' + !leaving + '">入职 ' + filteredHiredRows.length + '</button>' +
      '<button type="button" data-move="left" aria-pressed="' + leaving + '">离职 ' + filteredLeftRows.length + '</button></div>' +
      (moves.length ? '<button class="hr-dashboard-detail-link" type="button" data-dashboard-detail="moves">查看明细 ›</button>' : "") + '</div>' +
      (moves.length ? dashboardMovementTable(moves.slice(0, 3), leaving, true) : empty(leaving ? "这个范围没有离职" : "这个范围没有入职")));

    const recruit = view.recruit || {};
    const rate = Math.max(0, Math.min(100, Number(recruit.rate) || 0));
    card("[data-recruit-progress]", "招聘进度",
      '<div class="hr-dashboard-recruit"><div class="hr-dashboard-recruit-kpis">' +
      [["本月登记", recruit.registered || 0], ["已录用", recruit.done || 0], ["录用率", rate + "%"]].map(([label, value]) =>
        '<div><span>' + label + '</span><b>' + a(value) + '</b></div>'
      ).join("") + '</div><div class="hr-dashboard-meter" aria-hidden="true"><i style="width:' + rate + '%"></i></div>' +
      '<ol class="hr-dashboard-funnel">' + (recruit.steps || []).map((stage) =>
        '<li><span>' + a(stage.label) + '</span><b>' + a(stage.count || 0) + '</b></li>'
      ).join("") + '</ol></div>');
    u(root, "", false);
  }
  function handleDashboardAction(root, view, target) {
    const button = target.closest('[data-home] button');
    if (!button || !root.contains(button)) return false;
    for (const key of ['data-trend', 'data-move']) {
      if (!button.hasAttribute(key)) continue;
      const value = button.getAttribute(key);
      const restoreFocus = document.activeElement === button;
      root.setAttribute(key, value);
      y(root, view);
      if (restoreFocus) root.querySelector('button[' + key + '="' + value + '"]').focus({ preventScroll: true });
      return true;
    }
    if (button.hasAttribute('data-dept-filter')) {
      root.setAttribute('data-dept', button.getAttribute('data-dept-filter') || '');
      y(root, view);
      return true;
    }
    if (button.hasAttribute('data-dashboard-reset')) {
      root.removeAttribute('data-dept');
      y(root, view);
      return true;
    }
    if (button.hasAttribute('data-dashboard-detail')) {
      openDashboardDetail(root, view, button.getAttribute('data-dashboard-detail'));
      return true;
    }
    return false;
  }
function k(t){return(t.days||[]).map((function(t){return"<tr><td>"+a(t.date)+"</td><td>"+a(String(t.offAt||"").slice(11,16))+"</td><td>"+a(t.hours)+"</td></tr>"})).join("")}function w(t,e){var r=[{tone:"staff",label: "参与总人数",value:e.participants||0},{tone:"due",label: "在册人数",value:e.roster||0},{tone:"punch",label: "本月总时长",value:e.hours||0},{tone:"late",label: "人均时长",value:e.average||0},{tone:"leave",label: "未对齐",value:e.unmatched||0}],n=t.querySelector("[data-effort-kpis]");n&&(n.innerHTML=r.map((function(t){return'<article class="hr-board-kpi hr-tone-'+t.tone+'"><b>'+a(t.value)+"</b><span>"+a(t.label)+"</span></article>"})).join(""));var o=e.teams||[],i=t.querySelector("[data-teams]");if(i){var l=o.length?o.map((function(t){return"<tr><td>"+a(t.name)+"</td><td>"+a(t.roster)+"</td><td>"+a(t.participants)+"</td><td>"+a(t.hours)+"</td><td>"+a(t.average)+"</td></tr>"})).join(""):d(5,"还没有运营团队");i.innerHTML='<h3>各团队平均时长</h3><div class="hr-table-wrap"><table class="hr-table"><thead><tr><th>团队</th><th>在册</th><th>参与</th><th>总时长</th><th>平均时长</th></tr></thead><tbody>'+l+"</tbody></table></div>"}var s=t.getAttribute("data-open")||"",p=t.querySelector("[data-ranks]");p&&(p.innerHTML=(e.ranks||[]).map((function(t){var e=(t.rows||[]).length?t.rows.map((function(t,e){var r=s===t.userId,n=r?'<div class="hr-table-wrap"><table class="hr-table"><thead><tr><th>日期</th><th>下班</th><th>时长</th></tr></thead><tbody>'+(k(t)||d(3,"这个月没有 18 点后的下班"))+"</tbody></table></div>":"";return'<li data-effort="'+a(t.userId)+'" aria-expanded="'+(r?"true":"false")+'"><span>'+(e+1)+". "+a(t.name||"未命名")+(t.department?" · "+a(t.department):"")+"</span><b>"+a(t.hours)+"</b>"+n+"</li>"})).join(""):'<li class="hr-empty">这个角色还没有对上的人</li>';return'<section class="hr-card hr-board-card"><h3>'+a(t.title)+'</h3><ul class="hr-rank-list">'+e+"</ul></section>"})).join(""));var f=e.watch||{},h=t.querySelector("[data-watch]"),m=t.getAttribute("data-watch")||"";if(h){var g="";if("人员对不上"===m)g=(f.dingMiss||[]).length?(f.dingMiss||[]).map((function(t){return'<div class="hr-link" data-link><span>'+a(t.name)+" · "+a(t.department)+" · 工号 "+a(t.jobNumber||"空")+'</span><select data-pick-person><option value="">选择组织里的人</option>'+function(t){return((t.choices||{}).people||[]).map((function(t){return'<option value="'+a(t.id)+'">'+a(t.name)+" · "+a(t.role||"未标角色")+" · "+a(t.department)+"</option>"})).join("")}(e)+'</select><button type="button" class="hr-mini" data-act="bind" data-user="'+a(t.userId)+'">保存对齐</button></div>'})).join(""):'<div class="hr-empty">没有对不上的钉钉人员。</div>';else if("组织对不上"===m)g=(f.orgMiss||[]).length?(f.orgMiss||[]).map((function(t){return'<div class="hr-link" data-link><span>'+a(t.name)+" · "+a(t.role)+" · "+a(t.department)+'</span><select data-pick-user><option value="">选择钉钉里的人</option>'+function(t){return((t.choices||{}).users||[]).map((function(t){return'<option value="'+a(t.userId)+'">'+a(t.name)+" · "+a(t.department)+"</option>"})).join("")}(e)+'</select><button type="button" class="hr-mini" data-act="bind" data-person="'+a(t.personId)+'">保存对齐</button></div>'})).join(""):'<div class="hr-empty">没有对不上的组织人员。</div>';else if("已对齐"===m){var b={manual:"手工",job_number:"工号",name:"姓名"};g=(f.pairs||[]).length?(f.pairs||[]).map((function(t){return'<div class="hr-link" data-link><span>'+a(t.name)+" → "+a(t.orgName)+" · "+a(t.role)+" · "+a(b[t.matchBy]||t.matchBy)+'</span><button type="button" class="hr-mini" data-act="unbind" data-person="'+a(t.personId)+'">解除</button></div>'})).join(""):'<div class="hr-empty">还没有对齐上的人。</div>'}h.innerHTML='<div class="hr-watch-banner'+(f.conflict?" is-conflict":"")+'"><span>钉钉运营人数 / 组织运营人数。点数字看对不上的人，改完保存。</span><strong>'+(f.conflict?"存在冲突":"暂无冲突")+'</strong></div><div class="hr-watch-kpis"><article class="hr-watch-kpi"><b>'+a(f.compared||"0/0")+'</b><span>钉钉运营/组织运营</span></article><button type="button" class="hr-watch-kpi'+("人员对不上"===m?" is-on":"")+'" data-watch-open="人员对不上"><b>'+a((f.dingMiss||[]).length)+'</b><span>人员对不上</span></button><button type="button" class="hr-watch-kpi'+("组织对不上"===m?" is-on":"")+'" data-watch-open="组织对不上"><b>'+a((f.orgMiss||[]).length)+'</b><span>组织对不上</span></button><button type="button" class="hr-watch-kpi'+("已对齐"===m?" is-on":"")+'" data-watch-open="已对齐"><b>'+a((f.pairs||[]).length)+"</b><span>已对齐</span></button></div>"+(g?'<div class="hr-watch-issues">'+g+"</div>":"")}var v=e.people||[];c(t,["姓名","部门","角色","组织","月累计"],v.length?v.map((function(t){var e=s===t.userId,r='<tr class="hr-person" data-effort="'+a(t.userId)+'" aria-expanded="'+(e?"true":"false")+'"><td>'+a(t.name||"未命名")+"</td><td>"+a(t.department)+"</td><td>"+a(t.role)+"</td><td>"+a(t.orgName)+"</td><td>"+a(t.hours)+"</td></tr>";return e?r+'<tr class="hr-detail"><td colspan="5"><table class="hr-table"><thead><tr><th>日期</th><th>下班</th><th>时长</th></tr></thead><tbody>'+(k(t)||d(3,"这个月没有 18 点后的下班"))+"</tbody></table></td></tr>":r})).join(""):d(5,"这个月还没有运营部门的人")),e.saved?e.updatedAt?u(t,"更新于 "+e.updatedAt,!1):u(t,"",!1):u(t,"这个月还没留档。每天 10 点留档昨天，每月 1 号覆盖上个月。",!1)}function j(t){var e=String(null==t?"":t);return/[",\n]/.test(e)?'"'+e.replace(/"/g,'""')+'"':e}function A(t,e){return'<button type="button" class="hr-mini" data-act="delete" data-kind="'+t+'" data-id="'+a(e)+'">删除</button>'}
const staffRosterColumns = [
  ["rosterNumber", "序号", "text", 32], ["name", "姓名", "text", 64], ["gender", "性别", "gender"],
  ["department", "部门", "text", 64], ["group", "分组（主管）", "text", 64], ["position", "岗位", "text", 64],
  ["joinedOn", "入职时间", "date"], ["status", "在职状态", "status"],
  ["contractSigned", "是否签订合同", "text", 16], ["regularizedOn", "实际转正日期", "date"],
  ["tenureMonths", "入司工龄", "tenure"], ["birthday", "出生日期", "date"], ["age", "年龄", "age"],
  ["idNumber", "身份证号", "text", 32], ["phone", "联系方式", "tel", 32],
  ["emergencyName", "紧急联系人", "text", 64], ["emergencyRelation", "关系", "text", 32],
  ["emergencyPhone", "紧急联系人电话", "tel", 32], ["bankName", "开户行", "text", 120],
  ["salary", "薪资（试用/转正）", "text", 120], ["laborContractSigned", "是否签订劳动合同", "text", 16],
  ["socialInsurancePaid", "是否缴纳社保", "text", 32],
  ["jobNumber", "工号", "text", 64], ["jobLevel", "职级", "text", 64], ["contractEndsOn", "合同到期日", "date"]
];
const staffProfileFields = [
  ["maritalStatus", "婚姻状况", "text", 32], ["ethnicity", "民族", "text", 32],
  ["politicalStatus", "政治面貌", "text", 32], ["education", "最高学历", "text", 32],
  ["school", "毕业院校", "text", 120], ["major", "专业", "text", 120], ["graduatedOn", "毕业时间", "text", 10],
  ["householdType", "户口类型", "text", 32], ["hometown", "籍贯", "text", 64],
  ["householdAddress", "户口所在地址", "text", 255], ["residentialAddress", "现居住地址", "text", 255],
  ["tianjinSocialInsurance", "是否天津缴纳过社保", "text", 64], ["note", "备注", "text", 500]
];
const staffDepartureField = ["leftOn", "离职日期", "date"];
const staffFields = [...staffRosterColumns, staffDepartureField, ...staffProfileFields];
const staffStatusOptions = ["在职", "试用期", "待转正", "转正", "离职"];
const staffFieldByKey = new Map(staffFields.map((field) => [field[0], field]));

function staffFormMarkup() {
  const render = ([key, label, type, max]) => {
    if (type === "gender" || type === "status") {
      const options = type === "gender" ? ["", "男", "女"] : staffStatusOptions;
      return s(label, '<select name="' + key + '">' + n(options, "") + "</select>");
    }
    const numeric = type === "age" || type === "tenure";
    const inputType = numeric ? "number" : type;
    const rules = numeric ? ' min="0" max="' + (type === "age" ? 150 : 1200) + '" step="1"' :
      max ? ' maxlength="' + max + '"' : "";
    const required = key === "name" ? " required" : "";
    const placeholder = key === "graduatedOn" ? ' placeholder="YYYY-MM-DD"' : "";
    return s(label + (type === "tenure" ? "（月）" : ""), '<input name="' + key + '" type="' +
      inputType + '"' + rules + required + placeholder + ' autocomplete="off" />');
  };
  return '<form class="hr-form hr-staff-form" data-form="staff" hidden>' +
    '<fieldset><legend>花名册信息</legend><div>' + [...staffRosterColumns, staffDepartureField].map(render).join("") + '</div></fieldset>' +
    '<fieldset><legend>档案详细信息</legend><div>' + staffProfileFields.map(render).join("") + '</div></fieldset>' +
    '<label data-staff-enroll hidden><input type="checkbox" name="syncOrganization" /> 确认身份后同步到组织中心</label> ' +
    '<button class="hr-primary" type="submit">登记</button> <button type="button" class="hr-mini" data-act="staff-cancel">取消</button></form>';
}

function staffEditValue(person, field) {
  return field === "status" ? person.employmentStage || person.status : person[field];
}

function staffFormBody(form, person) {
  const body = { clearFields: [] };
  for (const [field] of staffFields) {
    const value = L(form, field);
    if (!person || value !== String(staffEditValue(person, field) ?? "")) {
      if (value) body[field] = value;
      else if (person) body.clearFields.push(field);
    }
  }
  if (person?.needsOrganization && form.elements.syncOrganization?.checked) body.syncOrganization = true;
  if (body.status && body.status !== "离职" && !body.leftOn) body.clearFields.push("leftOn");
  return body;
}

function staffAge(person, today) {
  if (person.age != null) return person.age;
  if (!person.birthday || person.birthday > today) return null;
  return Number(today.slice(0, 4)) - Number(person.birthday.slice(0, 4)) -
    (today.slice(5) < person.birthday.slice(5) ? 1 : 0);
}

function staffProfile(person, people) {
  const selector = '<label class="hr-field">员工<select data-staff-profile><option value="">请选择员工</option>' +
    people.slice().sort((left, right) => left.name.localeCompare(right.name, "zh")).map((entry) =>
      '<option value="' + a(entry.id) + '"' + (entry.id === person?.id ? " selected" : "") + ">" +
      a([entry.name, entry.department, entry.jobNumber].filter(Boolean).join(" · ")) + "</option>").join("") +
    "</select></label>";
  if (!person) return selector;
  const fields = staffProfileFields.map(([field, label]) =>
    '<div><dt>' + a(label) + '</dt><dd>' + a(person[field] || "—") + "</dd></div>").join("");
  return '<div class="hr-staff-profile-head">' + selector +
    '<button type="button" class="hr-mini" data-act="staff-edit" data-id="' + a(person.id) + '">编辑档案</button></div>' +
    '<h3>档案详细信息</h3><dl class="hr-staff-profile">' + fields + "</dl>";
}

function staffLeaveControls() {
  return '<div class="hr-staff-leave-tools"><button type="button" class="hr-mini" data-act="staff-leave-pick">批量导入离职花名册</button>' +
    '<input type="file" accept=".xlsx,.csv" data-staff-leave-file hidden />' +
    '<button type="button" class="hr-mini" data-act="staff-leave-template">下载离职模板</button></div>';
}

function handleStaffTemplateAction(root, event) {
  const button = event.target.closest("[data-act='staff-template'],[data-act='staff-leave-template'],[data-act='staff-leave-pick'],[data-act='staff-cancel']");
  if (!button || !root.contains(button)) return false;
  event.preventDefault();
  switch (button.getAttribute("data-act")) {
    case "staff-leave-pick":
      root.querySelector("[data-staff-leave-file]")?.click();
      break;
    case "staff-cancel":
      button.closest("form").hidden = true;
      break;
    default: {
      const link = document.createElement("a");
      link.href = "/api/hr/staff/template" + (button.getAttribute("data-act") === "staff-leave-template" ? "?kind=leave" : "");
      link.download = "";
      link.click();
    }
  }
  return true;
}

function mountStaffRosterStyles() {
  if (document.getElementById("hr-roster-style")) return;
  const style = document.createElement("style");
  style.id = "hr-roster-style";
  style.textContent = `
    .hr-staff-table { max-width: 100%; overflow-x: auto; }
    .hr-staff-table .hr-table {
      width: max-content; min-width: 100%; table-layout: auto;
      border-collapse: separate; border-spacing: 0;
    }
    .hr-staff-table .hr-table th, .hr-staff-table .hr-table td {
      padding: 8px 10px; white-space: nowrap; word-break: normal; overflow-wrap: normal;
    }
    .hr-staff-table [data-staff-inline] { cursor: text; }
    .hr-staff-table .hr-roster-name, .hr-staff-table .hr-roster-actions {
      position: sticky; z-index: 1; background: var(--xm-card);
    }
    .hr-staff-table .hr-roster-name { left: 0; box-shadow: 1px 0 var(--xm-line); }
    .hr-staff-table .hr-roster-actions { right: 0; box-shadow: -1px 0 var(--xm-line); }
    .hr-staff-table .hr-roster-person {
      display: flex; align-items: center; gap: 8px;
      min-width: 96px; max-width: clamp(96px, 24vw, 180px);
    }
    .hr-staff-table .hr-roster-person .hr-org-av { flex: none; margin: 0; }
    .hr-staff-table .hr-roster-person span { overflow: hidden; text-overflow: ellipsis; }
    .hr-staff-table .hr-roster-actions > div { display: flex; align-items: center; gap: 6px; }
    .hr-staff-table .hr-roster-actions button {
      display: inline-flex; align-items: center; justify-content: center;
      box-sizing: border-box; height: 26px; flex: none; white-space: nowrap; padding-inline: 6px;
    }
    .hr-staff-profile-head, .hr-staff-leave-tools {
      display: flex; align-items: end; gap: 10px; flex-wrap: wrap; margin: 12px 0 16px;
    }
    .hr-staff-profile { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0 20px; margin: 0; }
    .hr-staff-profile > div { padding: 10px 0; border-bottom: 1px solid var(--xm-line); }
    .hr-staff-profile dt { font-size: 12px; }
    .hr-staff-profile dd { margin: 4px 0 0; overflow-wrap: anywhere; }
    .hr-staff-form:not([hidden]) { display: block; padding: 16px; }
    .hr-staff-form[hidden] { display: none; }
    .hr-staff-form fieldset { min-width: 0; border: 1px solid var(--xm-line); border-radius: 8px; padding: 10px; margin: 0 0 12px; }
    .hr-staff-form fieldset > div { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 8px; }
    .hr-staff-form fieldset input, .hr-staff-form fieldset select { width: 100%; box-sizing: border-box; }
  `;
  document.head.appendChild(style);
}

function staffRosterTable(people, today, { offset, emptyMessage, departures, statusFor, tenureFor }) {
  const departureIndex = staffRosterColumns.findIndex(([key]) => key === "tenureMonths");
  const columns = departures ? [
    ...staffRosterColumns.slice(0, departureIndex), staffDepartureField,
    ...staffRosterColumns.slice(departureIndex, staffRosterColumns.findIndex(([key]) => key === "bankName")),
    ...staffRosterColumns.filter(([key]) => ["socialInsurancePaid", "jobNumber", "jobLevel", "contractEndsOn"].includes(key))
  ] : staffRosterColumns;
  const colors = [["#e8f1ff", "#2f6bff"], ["#e9fbf1", "#16a34a"], ["#fff6e8", "#f5a524"], ["#f3e8ff", "#8b5cf6"]];
  const rows = people.map((person, index) => {
    const [background, color] = colors[index % colors.length];
    const status = statusFor(person, today);
    const statusLabel = status === "在职" && person.employmentStage === "转正" ? "转正" : status;
    const pill = { 离职: "off", 待转正: "try", 试用期: "leave" }[status] || "ok";
    const values = {
      rosterNumber: a(person.rosterNumber || offset + index + 1),
      name: '<div class="hr-roster-person"><i class="hr-org-av" aria-hidden="true" style="background:' + background +
        ";color:" + color + '">' + a(String(person.name || "").slice(0, 1)) + '</i><span title="' +
        a(person.name) + '">' + a(person.name) + "</span></div>",
      status: '<span class="hr-pill hr-pill-' + pill + '">' + a(statusLabel) + "</span>",
      tenureMonths: a(tenureFor(person, today)), age: a(staffAge(person, today) ?? "—")
    };
    const cells = columns.map(([field, label]) =>
      '<td' + (field === "name" ? ' class="hr-roster-name"' : "") +
      ' data-staff-inline="' + field + '" data-staff-label="' + a(label) + '" data-staff-id="' + a(person.id) +
      '" title="双击编辑' + a(label) + '">' + (values[field] ?? a(person[field] || "—")) + "</td>").join("");
    return "<tr>" + cells + '<td class="hr-roster-actions"><div><button type="button" class="hr-linkish" data-staff-open="' + a(person.id) +
      '">查看</button> <button type="button" class="hr-linkish" data-act="staff-edit" data-id="' + a(person.id) +
      '">编辑</button> ' + A(person.needsOrganization ? "staff-local" : "staff", person.id) + "</div></td></tr>";
  }).join("");
  const heads = columns.map(([field, label]) => '<th' + (field === "name" ? ' class="hr-roster-name"' : "") + '>' +
    a(departures && field === "tenureMonths" ? "在司工龄" : label) + "</th>").join("");
  return '<div class="hr-table-wrap hr-staff-table" data-list tabindex="0" role="region" aria-label="' +
    (departures ? "离职花名册" : "员工花名册") + '"><table class="hr-table"><thead><tr>' +
    heads + '<th class="hr-roster-actions">操作</th></tr></thead><tbody>' +
    (rows || d(columns.length + 1, emptyMessage)) + "</tbody></table></div>";
}

const staffImportFields = new Map(staffFields.map(([field, label, type]) => [label, { field, type }]));
for (const [label, field] of Object.entries({
  所属部门: "department", "部门(分组)": "department", "部门（分组）": "department",
  分组: "group", 主管: "group", 职务: "position",
  入职日期: "joinedOn", 状态: "status", 员工状态: "status", 生日: "birthday",
  在司工龄: "tenureMonths", 司龄: "tenureMonths", "司龄（月）": "tenureMonths",
  "入司工龄（月）": "tenureMonths", "薪资(试用/转正)": "salary", 联系电话: "phone",
  电话: "phone", 手机号: "phone", 学历: "education", 紧急电话: "emergencyPhone"
})) staffImportFields.set(label, { field, type: staffFieldByKey.get(field)[2] });

function parseStaffCsv(text) {
  const rows = [];
  let row = [], value = "", quoted = false;
  const endRow = () => { row.push(value); rows.push(row); row = []; value = ""; };
  const source = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') { value += '"'; index++; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value); value = "";
    } else if (char === "\n" && !quoted) {
      endRow();
    } else value += char;
  }
  if (quoted) throw new Error("CSV 中有未闭合的引号");
  endRow();
  return rows.map((values, index) => ({ values, number: index + 1 }));
}

function staffImportValue(value, column, label, date1904) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (column.type === "date" || column.field === "graduatedOn") {
    const parts = /^(\d{4})[-/.年](\d{1,2})(?:[-/.月](\d{1,2})日?)?$/.exec(text);
    if (parts) return [parts[1], parts[2].padStart(2, "0"), parts[3]?.padStart(2, "0")].filter(Boolean).join("-");
    const serial = Number(text);
    if (/^\d{1,6}(?:\.\d+)?$/.test(text) && serial >= 0 && serial <= 999999 &&
        !(column.field === "graduatedOn" && /^\d{4}$/.test(text) && serial >= 1900 && serial <= 2100)) {
      const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, serial < 60 ? 31 : 30);
      return new Date(epoch + Math.floor(serial) * 86400000).toISOString().slice(0, 10);
    }
  }
  if (column.type === "tenure") {
    const yearsMonths = /^(?:(\d+(?:\.\d+)?)\s*年)?\s*(?:(\d+)\s*个?月)?$/.exec(text);
    if (yearsMonths) return String(Math.round(Number(yearsMonths[1] || 0) * 12) + Number(yearsMonths[2] || 0));
    if (/^\d+(?:\.\d+)?$/.test(text) && ["入司工龄", "在司工龄"].includes(label)) {
      return String(Math.round(Number(text) * 12));
    }
  }
  if (column.type === "age") return text.replace(/\s*岁$/, "");
  return text;
}

function staffImportRows({ name, rows, date1904 }) {
  const headerIndex = rows.findIndex(({ values }) => values.some((item) => String(item).trim() === "姓名"));
  if (headerIndex === -1) return null;
  const labels = rows[headerIndex].values.map((item) => String(item ?? "").trim());
  const columns = labels.map((label) => staffImportFields.get(label));
  const nameIndex = labels.indexOf("姓名");
  return rows.slice(headerIndex + 1).filter(({ values }) => String(values[nameIndex] ?? "").trim()).map(({ values, number }) => {
    const row = { sourceRow: name + "第 " + number + " 行" };
    columns.forEach((column, index) => {
      if (!column) return;
      const value = staffImportValue(values[index], column, labels[index], date1904);
      if (value !== "") row[column.field] = value;
    });
    return row;
  });
}

// XLSX stores the workbook, shared strings, and worksheets as XML entries in a ZIP.
function staffZipEntries(buffer) {
  const data = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const invalid = () => new Error("无法读取 Excel 文件，请用 Excel 或 WPS 另存为 .xlsx 后重试");
  let end = bytes.length - 22;
  const start = Math.max(0, end - 65535);
  while (end >= start && (data.getUint32(end, true) !== 0x06054b50 ||
      end + 22 + data.getUint16(end + 20, true) !== bytes.length)) end--;
  if (end < start) throw invalid();
  const count = data.getUint16(end + 10, true);
  let offset = data.getUint32(end + 16, true);
  const entries = new Map();
  const decoder = new TextDecoder();
  for (let index = 0; index < count; index++) {
    if (offset + 46 > end || data.getUint32(offset, true) !== 0x02014b50) throw invalid();
    const nameLength = data.getUint16(offset + 28, true);
    const next = offset + 46 + nameLength + data.getUint16(offset + 30, true) + data.getUint16(offset + 32, true);
    if (next > end) throw invalid();
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    entries.set(name, {
      method: data.getUint16(offset + 10, true), compressed: data.getUint32(offset + 20, true),
      size: data.getUint32(offset + 24, true), local: data.getUint32(offset + 42, true)
    });
    offset = next;
  }
  return async (path, optional = false) => {
    const entry = entries.get(path);
    if (!entry && optional) return null;
    if (!entry || entry.local + 30 > end || data.getUint32(entry.local, true) !== 0x04034b50) throw invalid();
    const begin = entry.local + 30 + data.getUint16(entry.local + 26, true) + data.getUint16(entry.local + 28, true);
    if (entry.size > 12 * 1024 * 1024 || begin + entry.compressed > end) throw invalid();
    const content = bytes.subarray(begin, begin + entry.compressed);
    let xml;
    if (entry.method === 0) xml = decoder.decode(content);
    else if (entry.method === 8) {
      if (typeof DecompressionStream !== "function") throw new Error("请使用新版 Chrome 或 Edge 导入 .xlsx");
      const stream = new Blob([content]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      const reader = stream.getReader();
      const output = new Uint8Array(entry.size);
      let written = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (written + value.length > output.length) { await reader.cancel(); throw invalid(); }
        output.set(value, written);
        written += value.length;
      }
      if (written !== entry.size) throw invalid();
      xml = decoder.decode(output);
    } else throw invalid();
    const document = new DOMParser().parseFromString(xml, "application/xml");
    if (document.querySelector("parsererror")) throw invalid();
    return document;
  };
}

async function readStaffWorkbook(file, departures) {
  if (file.size > 10 * 1024 * 1024) throw new Error("花名册文件不能超过 10 MB");
  const read = staffZipEntries(await file.arrayBuffer());
  const [workbook, relations, shared] = await Promise.all([
    read("xl/workbook.xml"), read("xl/_rels/workbook.xml.rels"), read("xl/sharedStrings.xml", true)
  ]);
  const elements = (node, name) => Array.from(node?.getElementsByTagNameNS("*", name) || []);
  const richText = (cell) => elements(cell, "t").filter((node) => node.parentElement.localName !== "rPh")
    .map((node) => node.textContent).join("");
  const strings = elements(shared, "si").map(richText);
  const dates = elements(workbook, "workbookPr")[0]?.getAttribute("date1904");
  const date1904 = dates === "1" || dates === "true";
  const byId = new Map(elements(relations, "Relationship").filter((item) => /\/worksheet$/.test(item.getAttribute("Type")))
    .map((item) => [item.getAttribute("Id"), item.getAttribute("Target")]));
  const sheets = elements(workbook, "sheet").map((sheet) => ({
    name: sheet.getAttribute("name"),
    target: byId.get(Array.from(sheet.attributes).find((attribute) => attribute.localName === "id")?.value)
  })).filter((sheet) => sheet.target);
  const expected = departures ? "甄选13楼离职花名册" : "甄选";
  const roster = sheets.find(({ name }) => name === expected) ||
    (sheets.length === 1 && sheets[0].name.includes("离职") === departures ? sheets[0] : null);
  if (!roster) throw new Error("Excel 中缺少「" + expected + "」工作表");
  const { name, target } = roster;
  const path = new URL(target, "https://workbook.invalid/xl/").pathname.slice(1);
  const sheet = await read(path);
  const rows = elements(sheet, "row").map((row, index) => {
    const values = [];
    let column = 0;
    for (const cell of elements(row, "c")) {
      const ref = /^[A-Z]{1,3}/.exec(cell.getAttribute("r") || "");
      if (ref) column = [...ref[0]].reduce((number, letter) => number * 26 + letter.charCodeAt(0) - 64, 0) - 1;
      const type = cell.getAttribute("t");
      const raw = elements(cell, "v")[0]?.textContent;
      const value = type === "s" && raw != null ? strings[Number(raw)] :
        type === "inlineStr" ? richText(cell) : type === "e" ? "" : raw;
      values[column++] = value ?? "";
    }
    return { values, number: row.getAttribute("r") || index + 1 };
  });
  return { name, rows, date1904 };
}

async function importStaffFile(root, state, file, departures) {
  const button = root.querySelector(departures ? "[data-act='staff-leave-pick']" : "[data-act='staff-pick']");
  if (button?.disabled) return;
  if (button) button.disabled = true;
  try {
    const sheet = /\.xlsx$/i.test(file.name) ? await readStaffWorkbook(file, departures) :
      { name: "CSV ", rows: parseStaffCsv(await file.text()) };
    const rows = staffImportRows(sheet) || [];
    if (!rows.length) throw new Error("表格需要有姓名这一列，并且至少一行人员");
    if (rows.length > 400) throw new Error("一次最多导入 400 人，请分批导入");
    const result = await o("/api/hr/staff/import", { method: "POST", body: { rows, departures } });
    u(root, "已导入，新增 " + result.added + " 人，更新 " + result.updated + " 人", false);
    D(root, state);
  } catch (error) {
    u(root, error.message || "导入失败", true);
  } finally {
    if (button) button.disabled = false;
  }
}

// Staff cells use the same inline save interaction as the organization directory.
function staffTenureMonths(person, today) {
  if (person.tenureMonths != null) return person.tenureMonths;
  if (!person.joinedOn || person.joinedOn.length < 10) return null;
  var start = person.joinedOn.split("-").map(Number), end = today.split("-").map(Number);
  return 12 * (end[0] - start[0]) + end[1] - start[1] - (end[2] < start[2] ? 1 : 0);
}
function bindStaffInline(root, state) {
  var active = null;
  root.addEventListener("dblclick", function (event) {
    if (event.target.closest("input,select,button,a")) return;
    var cell = event.target.closest("[data-staff-inline]");
    if (active && !active.disabled && !root.contains(active)) active = null;
    if (!cell || !root.contains(cell) || active || !state.view || state.alive === false) return;
    var id = cell.getAttribute("data-staff-id"), field = cell.getAttribute("data-staff-inline");
    var person = (state.view.staff || []).find(function (row) { return String(row.id) === id; });
    if (!person) return;
    event.preventDefault();
    var original = String(staffEditValue(person, field) ?? ""), html = cell.innerHTML;
    var [, , type, max] = staffFieldByKey.get(field);
    var input = document.createElement(type === "status" || type === "gender" ? "select" : "input");
    if (type === "status") input.innerHTML = n(staffStatusOptions, original);
    else if (type === "gender") input.innerHTML = n(["", "男", "女"], original);
    else if (field === "tenureMonths") {
      input.type = "number"; input.min = "0"; input.max = "1200"; input.step = "1";
      var automatic = staffTenureMonths({ joinedOn: person.joinedOn }, r());
      input.placeholder = automatic == null || automatic < 0 ? "月数（留空自动）" : "自动：" + automatic + "个月";
    } else if (type === "age") {
      input.type = "number"; input.min = "0"; input.max = "150"; input.step = "1";
    } else {
      input.type = type;
      if (max) input.maxLength = max;
    }
    input.value = original;
    input.setAttribute("aria-label", field === "tenureMonths" ? "司龄（月数，留空按入职日期计算）" : cell.getAttribute("data-staff-label"));
    input.style.cssText = "box-sizing:border-box;width:100%;min-width:100px;padding:6px;border:1px solid var(--xm-primary,#1677ff);border-radius:4px;background:var(--xm-ui-surface,#fff);color:inherit";
    cell.innerHTML = ""; cell.appendChild(input); active = input;
    var pending = false, closed = false;
    function cancel() { if (closed || pending) return; closed = true; cell.innerHTML = html; active = null; }
    function save() {
      if (closed || pending) return;
      if (!input.checkValidity()) { input.reportValidity(); input.focus(); return; }
      var value = input.value.trim();
      if ((type === "tenure" || type === "age") && value !== "") value = String(Number(value));
      if (value === original) return cancel();
      if (field === "name" && !value) { u(root, "姓名不能为空", true); input.focus(); return; }
      var body = { replace: false }; body[field] = value;
      if (!value && field !== "name") body.clearFields = [field];
      // Returning to work must clear the departure date used by status statistics.
      if (field === "status" && value !== "离职") body.clearFields = ["leftOn"];
      pending = true; input.disabled = true;
      o("/api/hr/staff/" + encodeURIComponent(id), { method: "PUT", body: body }).then(function (result) {
        if (!result.staff || String(staffEditValue(result.staff, field) ?? "") !== value) throw new Error("保存未确认，请重试");
        if (!value && !Object.hasOwn(result.staff, field)) delete person[field];
        if (field === "status" && !result.staff.employmentStage) delete person.employmentStage;
        Object.assign(person, result.staff); closed = true;
        if (active === input) active = null;
        if (state.alive === false) return;
        if (state.tab === "staff" || root.contains(cell)) {
          var current = (state.view.staff || []).find(function (row) { return String(row.id) === id; });
          if (current && current !== person) Object.assign(current, person);
          if (!active) S(root, state.view);
          u(root, "已保存", false);
        }
      }).catch(function (error) {
        pending = false; input.disabled = false; u(root, error.message || "保存失败，请重试", true);
        if (root.contains(input)) input.focus(); else if (active === input) active = null;
      });
    }
    input.addEventListener("blur", save);
    input.addEventListener("keydown", function (event) {
      if (event.isComposing) return;
      if (event.key === "Escape") { event.preventDefault(); cancel(); }
      if (event.key === "Enter") { event.preventDefault(); save(); }
    });
    input.focus(); if (input.type === "text") input.select();
  });
}
function staffLevelOptions(staff, selected) {
  var levels = new Set(staff.map(function (person) { return person.jobLevel; }).filter(Boolean));
  if (selected) levels.add(selected);
  return n(Array.from(levels).sort(function (left, right) { return left.localeCompare(right, "zh"); }), selected);
}
function markStaffInline(container) {
  var fields = [
    ["name", "姓名"], ["jobNumber", "工号"], ["department", "所属部门"], ["position", "岗位"],
    ["jobLevel", "职级"], ["joinedOn", "入职日期"], ["tenureMonths", "司龄"],
    ["status", "员工状态"], ["contractEndsOn", "合同到期日"]
  ];
  container.querySelectorAll("[data-act='staff-edit']").forEach(function (button) {
    var row = button.closest("tr");
    if (!row || row.closest(".hr-staff-table")) return;
    fields.forEach(function (field, index) {
      var cell = row.cells[index];
      cell.setAttribute("data-staff-inline", field[0]); cell.setAttribute("data-staff-label", field[1]);
      cell.setAttribute("data-staff-id", button.getAttribute("data-id"));
      cell.title = "双击编辑" + field[1] + "，回车或点击外部保存，Esc 取消";
      cell.style.cursor = "text";
    });
  });
}
function S(t,e){var n=t.querySelector("[data-staff]");if(n){for(var o=r(),i=o.slice(0,7),s=(e.staff||[]).filter(person=>!person.needsOrganization),pending=(e.staff||[]).filter(person=>person.needsOrganization),c=dt(i+"-01",-1),u=c.slice(0,7),p=dt(u+"-01",-1),f=s.filter((function(t){return st(t,o)})),g=ft(s,(function(t){return st(t,c)})),y=ft(s,(function(t){return(t.joinedOn||"").slice(0,7)===i})),k=ft(s,(function(t){return(t.joinedOn||"").slice(0,7)===u})),w=ft(s,(function(t){return(t.leftOn||"").slice(0,7)===i})),j=ft(s,(function(t){return(t.leftOn||"").slice(0,7)===u})),S=ft(s,(function(t){return st(t,p)})),M=g?Math.round(w/g*1e3)/10:0,z=S?Math.round(j/S*1e3)/10:0,N=[],q=f.filter((function(t){var e=ut(t,o);return"试用期"===e||"待转正"===e})).length,O=6;O>=0;O--)N.push(dt(o,-O));var E=[ht("在职人数",f.length,"人","较上月 "+h(f.length-g),f.length>=g,"#e8f1ff","#2f6bff","staff",st,N,s),ht("本月入职",y,"人","较上月 "+h(y-k),y>=k,"#e9fbf1","#16a34a","hired",(function(t,e){return t.joinedOn===e}),N,s),ht("本月离职",w,"人","较上月 "+h(w-j),w<=j,"#fff1f0","#f04438","left",(function(t,e){return t.leftOn===e}),N,s),ht("员工流失率",g?M:"—",g?"%":"",g?"较上月 "+h(Math.round(10*(M-z))/10)+"pct":"上月还没有在职人数",M<=z,"#f3e8ff","#8b5cf6","lunch",(function(t,e){return t.leftOn===e}),N,s),ht("试用期人数",q,"人","占比 "+(f.length?Math.round(q/f.length*1e3)/10:0)+"%",!0,"#fff6e8","#f5a524","cake",(function(t,e){return st(t,e)&&t.joinedOn&&dt(t.joinedOn,90)>=e}),N,s)].join(""),C={};f.forEach((function(t){var e=t.department||"未分部门";C[e]=(C[e]||0)+1}));var T=Object.keys(C).map((function(t){return{name:t,count:C[t]}})).sort((function(t,e){return e.count-t.count||t.name.localeCompare(e.name,"zh")})),D=T.slice(0,5),I=T.slice(5).reduce((function(t,e){return t+e.count}),0);I&&D.push({name:"其他",count:I});var L=D.map((function(t,e){return{name:t.name,count:t.count,color:b[e%b.length]}})),U=f.filter((function(t){return null!=staffTenureMonths(t,o)})),R=1,H=[["<3个月",0,3],["3-6个月",3,6],["6-12个月",6,12],["1-2年",12,24],["2-3年",24,36],[">3年",36,Infinity]].map((function(t){var e=U.filter((function(e){var a=staffTenureMonths(e,o);return a>=t[1]&&a<t[2]})).length;return e>R&&(R=e),{label:t[0],count:e}})),P=["在职","试用期","待转正"].map((function(t,e){return{name:t,count:f.filter((function(e){return ut(e,o)===t})).length,color:["#2f6bff","#16a34a","#f5a524"][e]}})).filter((function(t){return t.count})),F='<div class="hr-clock-grid"><section class="hr-card hr-home-card"><h3>员工结构（按部门）</h3>'+(L.length?'<div class="hr-donut-wrap">'+v(L,{label: "在职人数",value:f.length})+x(L)+"</div>":'<div class="hr-empty">还没有在职人员</div>')+'</section><section class="hr-card hr-home-card"><h3>员工司龄分布</h3>'+(U.length?'<div class="hr-cols">'+H.map((function(t){return'<div class="hr-col"><b>'+t.count+'人</b><i style="height:'+Math.max(8,Math.round(100*t.count/R))+'%"></i><span>'+a(t.label)+"</span></div>"})).join("")+"</div>":'<div class="hr-empty">还没有入职日期</div>')+'</section><section class="hr-card hr-home-card"><h3>员工状态分布</h3>'+(P.length?'<div class="hr-donut-wrap">'+v(P,{label: "在职人数",value:f.length})+x(P)+"</div>":'<div class="hr-empty">还没有在职人员</div>')+'<div class="hr-empty">即将离职还没有录入。</div></section></div>',V=t.getAttribute("data-staff-view")||"list",B=null==t.getAttribute("data-staff-state")?"在职":t.getAttribute("data-staff-state"),Y=t.getAttribute("data-staff-dept")||"",selectedLevel=t.getAttribute("data-staff-level")||"",X=t.getAttribute("data-staff-from")||"",J=t.getAttribute("data-staff-to")||"",Q=t.querySelector("[data-staff-search]"),G=document.activeElement&&document.activeElement.hasAttribute&&document.activeElement.hasAttribute("data-staff-search"),Z=Q?String(Q.value||"").replace(/\s+/g,"").toLowerCase():"",$={};if(V==="pending"&&!pending.length){V="list";t.removeAttribute("data-staff-view")}s.forEach((function(t){t.department&&($[t.department]=1)}));var _=(V==="pending"?pending:s).filter((function(t){var e=ut(t,o);return V==="pending"?true:"contract"===V?Boolean(t.contractEndsOn):"join"===V?(t.joinedOn||"").slice(0,7)===i:"regular"===V?"试用期"===e||"待转正"===e:"leave"===V?"离职"===e:!("在职"===B&&"离职"===e)&&!(B&&"在职"!==B&&(B==="转正"?e!=="在职"||t.employmentStage!=="转正":e!==B))&&(!Y||(t.department||"")===Y)&&(!selectedLevel||t.jobLevel===selectedLevel)&&(!(X||J)||t.joinedOn)&&(!X||t.joinedOn>=X)&&(!J||t.joinedOn<=J)&&(!Z||(t.name+t.jobNumber+t.phone+t.department).replace(/\s+/g,"").toLowerCase().indexOf(Z)>=0)})).sort((function(t,e){return String(t.name).localeCompare(String(e.name),"zh")})),K='<div class="hr-clock-tabs">'+[["list","员工列表"],["file","员工档案"],["join","入职管理"],["regular","转正管理"],["move","异动管理"],["leave","离职管理"],["contract","合同管理"]].concat(pending.length?[["pending","待同步 "+pending.length+" 人"]]:[]).map((function(t){return'<button type="button" data-staff-view="'+t[0]+'" aria-selected="'+(V===t[0])+'">'+t[1]+"</button>"})).join("")+"</div>",W="join"===V?'<div class="hr-empty">待入职登记在招聘管理。</div>':"regular"===V?'<div class="hr-empty">转正记录还没有录入。下面是入职未满 90 天的人。</div>':"",tt="";if("file"===V){var profiles=s.concat(pending),et=profiles.filter((function(e){return String(e.id)===String(t.getAttribute("data-staff-open")||"")}))[0];tt=staffProfile(et,profiles)}else if("move"===V)tt='<div class="hr-empty">异动还没有录入。</div>';else{var at=Math.max(1,Math.ceil(_.length/20)),rt=Math.min(Math.max(1,+t.getAttribute("data-staff-page")||1),at),nt=_.slice(20*(rt-1),20*rt),ot=["#e8f1ff","#e9fbf1","#fff6e8","#f3e8ff"],it=["#2f6bff","#16a34a","#f5a524","#8b5cf6"];tt=W+("leave"===V?staffLeaveControls():"")+("list"===V?'<h3>甄选员工详细名单</h3><p class="hr-lead">左右滚动查看全部列。双击单元格可编辑，回车或点击外部保存，Esc 取消。工龄按月编辑。</p><div class="hr-clock-filters"><input data-staff-search placeholder="搜索员工姓名 / 工号 / 手机号" value="'+a(Z)+'" /><select data-staff-dept><option value="">所属部门：全部</option>'+Object.keys($).sort((function(t,e){return t.localeCompare(e,"zh")})).map((function(t){return'<option value="'+a(t)+'"'+(Y===t?" selected":"")+">"+a(t)+"</option>"})).join("")+'</select><select data-staff-state><option value="在职"'+("在职"===B?" selected":"")+'>员工状态：在职</option><option value="试用期"'+("试用期"===B?" selected":"")+'>员工状态：试用期</option><option value="待转正"'+("待转正"===B?" selected":"")+'>员工状态：待转正</option><option value="转正"'+("转正"===B?" selected":"")+'>员工状态：转正</option><option value="离职"'+("离职"===B?" selected":"")+'>员工状态：离职</option><option value=""'+(""===B?" selected":"")+'>员工状态：全部</option></select><select data-staff-level><option value="">职级：全部</option>'+staffLevelOptions(s,selectedLevel)+'</select><input type="date" data-staff-from value="'+a(X)+'" /><input type="date" data-staff-to value="'+a(J)+'" /><button type="button" data-act="staff-reset">重置</button></div>':"")+("list"===V||"leave"===V||"pending"===V?staffRosterTable(nt,o,{offset:20*(rt-1),emptyMessage:Z?"没有匹配的人":V==="leave"?"还没有离职记录":"还没有花名册",departures:V==="leave",statusFor:ut,tenureFor:pt}):l(["姓名","工号","所属部门","岗位","职级","入职日期","司龄","员工状态","合同到期日","操作"],nt.length?nt.map((function(t,e){var r=ut(t,o),n="离职"===r?"hr-pill hr-pill-off":"待转正"===r?"hr-pill hr-pill-try":"试用期"===r?"hr-pill hr-pill-leave":"hr-pill hr-pill-ok";return'<tr><td><i class="hr-org-av" style="background:'+ot[e%4]+";color:"+it[e%4]+'">'+a(String(t.name||"").slice(0,1))+"</i>"+a(t.name||"未命名")+"</td><td>"+a(t.jobNumber)+"</td><td>"+a(t.department)+"</td><td>"+a(t.position)+"</td><td>"+a(t.jobLevel||"—")+"</td><td>"+a(t.joinedOn)+"</td><td>"+a(pt(t,o))+'</td><td><span class="'+n+'">'+a(r)+'</span></td><td>'+a(t.contractEndsOn||'—')+'</td><td><button type="button" class="hr-linkish" data-staff-open="'+a(t.id)+'">查看</button> <button type="button" class="hr-linkish" data-act="staff-edit" data-id="'+a(t.id)+'">编辑</button> '+A("staff",t.id)+"</td></tr>"})).join(""):d(10,"contract"===V?"请在员工列表填写合同到期日。":Z?"没有匹配的人":"还没有花名册")).replace("hr-card ",""))+'<div class="hr-clock-bar"><span>共 '+_.length+' 条记录</span><span><button type="button" data-staff-page="'+(rt-1)+'"'+(rt<=1?" disabled":"")+">上一页</button> "+rt+" / "+at+' <button type="button" data-staff-page="'+(rt+1)+'"'+(rt>=at?" disabled":"")+">下一页</button></span></div>"}if(n.innerHTML='<div class="hr-home-kpis">'+E+"</div>"+F+'<section class="hr-card hr-home-card">'+K+tt+"</section>",markStaffInline(n),G){var lt=n.querySelector("[data-staff-search]");lt&&(lt.focus(),lt.setSelectionRange&&lt.setSelectionRange(lt.value.length,lt.value.length))}}function dt(t,e){var a=String(t||"").split("-"),r=new Date(Date.UTC(+a[0],a[1]-1,+a[2]+e)),n=r.getUTCMonth()+1,o=r.getUTCDate();return r.getUTCFullYear()+"-"+(n<10?"0":"")+n+"-"+(o<10?"0":"")+o}function st(t,e){if(t?.orgPersonId&&e===r())return t.status==="在职";return!(!t||"离职"===t.status||t.leftOn&&t.leftOn<=e||t.joinedOn&&t.joinedOn>e)}function ut(t,e){if(!st(t,e))return"离职";var a=t.joinedOn&&dt(t.joinedOn,90);return t.employmentStage==="转正"?"在职":t.employmentStage||(!a||a<e?"在职":a<=dt(e,7)?"待转正":"试用期")}function pt(t,e){var a=staffTenureMonths(t,e);if(null==a||a<0)return"—";var r=a/12|0;return r?r+"年"+a%12+"个月":a+"个月"}function ft(t,e){return t.filter(e).length}function ht(t,e,a,r,n,o,i,l,d,s,c){return m({label:t,value:e,unit:a,hint:r,good:n,bg:o,color:i,icon:l,spark:s.map((function(t){return ft(c,(function(e){return d(e,t)}))}))})}}function M(t,e){var a=String(t.startAt||"").slice(0,10),r=String(t.endAt||"").slice(0,10)||a;return!!(a&&a<=e&&e<=r)}function z(t,e){var a,n,o=r(),i=e&&e.month||o.slice(0,7),l=function(t,e){for(var a=Number(t.slice(0,4)),r=Number(t.slice(5,7)),n=new Date(a,r,0).getDate(),o=t===e.slice(0,7)?e:t+"-"+(n<10?"0":"")+n,i=[],l=1;l<=n;l++){var d=t+"-"+(l<10?"0":"")+l;d<=o&&i.push(d)}return i}(i,o),d=(a=e&&e.punches,n={},(a||[]).forEach((function(t){var e=t.dingtalkUserId||t.userName||"",a=e+"|"+(t.workDate||""),r=n[a];r||(r=n[a]={id:e,name:t.userName||"",dept:t.department||"",job:t.jobNumber||"",date:t.workDate||"",on:"",off:"",label: "",late:0,result:""}),t.userName&&(r.name=t.userName),t.department&&(r.dept=t.department),t.jobNumber&&(r.job=t.jobNumber),"OffDuty"===t.checkType?r.off=t.checkAt||r.off:t.checkAt&&(r.on=t.checkAt),t.label&&(r.label=t.label),t.lateMinutes&&(r.late=t.lateMinutes),t.timeResult&&(r.result=t.timeResult)})),n),s=(e&&e.staff||[]).filter((function(t){return t&&"离职"!==t.status})),c={};s.forEach((function(t){t.dingtalkUserId&&(c[t.dingtalkUserId]=t),t.name&&(c[t.name]=t),null!=t.id&&(c[t.id]=t)}));var u={};(e&&e.leaves||[]).forEach((function(t){var e=c[t.dingtalkUserId]||c[t.personId]||{},a=[t.dingtalkUserId,t.personId,e.dingtalkUserId,e.name];l.forEach((function(e){M(t,e)&&a.forEach((function(a){a&&(u[a+"|"+e]=t.leaveName||"请假")}))}))}));var p={},f={};Object.keys(d).forEach((function(t){var e=d[t];e.date&&(f[e.date]=1,p[e.date+"|"+e.id]=1,e.name&&(p[e.date+"|"+e.name]=1))}));var h=Object.keys(d).map((function(t){return d[t]}));Object.keys(f).forEach((function(t){s.forEach((function(e){var a=e.dingtalkUserId||e.name||"";p[t+"|"+a]||p[t+"|"+(e.name||"")]||h.push({id:a,name:e.name||"",dept:e.department||"",job:e.jobNumber||"",date:t,on:"",off:"",label: "",late:0,result:""})}))})),h.forEach((function(t){var e=u[t.id+"|"+t.date]||u[t.name+"|"+t.date];e||/请假|调休/.test(t.label||"")?t.status="请假":"迟到"===t.label||"Late"===t.result||t.late>0?t.status="迟到":t.on||t.off?t.status="正常":t.status="缺勤",t.leaveName=e||(/请假|调休/.test(t.label||"")?t.label: ""),t.hours=function(t,e){if(!t||!e)return"";var a=Date.parse(String(t).replace(" ","T")),r=Date.parse(String(e).replace(" ","T"));return!a||!r||r<=a?"":((r-a)/36e5).toFixed(1)}(t.on,t.off)}));var m=l.filter((function(t){return f[t]})).pop()||l[l.length-1]||"",g=h.filter((function(t){return t.date===m}));function b(t){return g.filter((function(e){return e.status===t})).length}var v=b("正常")+b("迟到"),x=s.length>0,y=l.map((function(t){var e={},a=0;return Object.keys(d).forEach((function(r){var n=d[r];n.date!==t||e[n.id]||(e[n.id]=1,a+=1)})),{date:t,active:a}})),k=(e&&e.overtime||[]).filter((function(t){return 0===String(t.workDate||"").indexOf(i)})),w=k.filter((function(t){return t.workDate===m})),j={};w.forEach((function(t){j[t.personId]=1}));var A=Math.round(10*w.reduce((function(t,e){return t+(Number(e.hours)||0)}),0))/10,S=t.getAttribute("data-clock-from")||"",z=t.getAttribute("data-clock-to")||"";S.slice(0,7)!==i&&(S=l[0]||""),z.slice(0,7)!==i&&(z=l[l.length-1]||"");var N=t.getAttribute("data-clock-dept")||"",q=t.getAttribute("data-clock-status")||"",O=t.getAttribute("data-clock-q")||"",E=Number(t.getAttribute("data-clock-page")||"1")||1,C=h.filter((function(t){return!(S&&t.date<S||z&&t.date>z||N&&t.dept!==N||q&&t.status!==q||O&&(t.name+t.job).indexOf(O)<0)})).sort((function(t,e){return String(e.date).localeCompare(String(t.date))||String(t.name).localeCompare(String(e.name),"zh")})),T={};return h.forEach((function(t){t.dept&&(T[t.dept]=1)})),{month:i,ref:m,know:x,expected:x?s.length:v,came:v,absent:x?b("缺勤"):0,late:b("迟到"),leave:b("请假"),rate:function(t){return x?Math.round(t/s.length*1e3)/10:0},series:y,rows:C,ot:k,otCount:Object.keys(j).length,otHours:A,depts:Object.keys(T).sort((function(t,e){return t.localeCompare(e,"zh")})),roster:s,byId:c,leaves:e&&e.leaves||[],days:l,from:S,to:z,dept:N,status:q,q:O,page:E,view:t.getAttribute("data-clock-view")||"detail"}}function N(t,e,a,r,n,o,i){return'<article class="hr-home-kpi"><i class="hr-home-icon" style="background:'+n+";color:"+o+'">'+i+'</i><div class="hr-home-kpi-main"><span>'+t+"</span><b>"+e+"<small>"+a+"</small></b><em>"+r+"</em></div></article>"}function q(t,e){var r=t.querySelector("[data-clock]");if(r&&e){var n=z(t,e),o=document.activeElement&&document.activeElement.hasAttribute&&document.activeElement.hasAttribute("data-clock-q"),i=n.ref?n.ref.slice(5):"还没有留档",s=[N("应出勤人数",n.know?n.expected:n.came,"人",n.know?i:"按打卡人数","#e8f1ff","#2f6bff",f("staff")),N("实际出勤人数",n.came,"人",n.know?"出勤率 "+n.rate(n.came)+"%":i,"#e9fbf1","#16a34a",f("hired")),N("缺勤人数",n.know?n.absent:"—",n.know?"人":"",n.know?"缺勤率 "+n.rate(n.absent)+"%":"花名册还没有人","#fff1f0","#f04438",f("left")),N("迟到人数",n.late,"人",n.know?"迟到率 "+n.rate(n.late)+"%":i,"#fff6e8","#f5a524",f("lunch")),N("请假人数",n.leave,"人",n.know?"请假率 "+n.rate(n.leave)+"%":i,"#f3e8ff","#8b5cf6",f("cake")),N("加班人数",n.otCount,"人","加班工时 "+n.otHours+" h","#e7f8fb","#0891b2",O("bag"))].join(""),c=[{name:"正常",count:Math.max(0,n.came-n.late),color:"#2f6bff"},{name:"迟到",count:n.late,color:"#f5a524"},{name:"缺勤",count:n.know?n.absent:0,color:"#f04438"},{name:"请假",count:n.leave,color:"#8b5cf6"}].filter((function(t){return t.count})),p='<section class="hr-card hr-home-card"><h3>出勤趋势</h3><p class="hr-lead">出勤人数</p>'+(n.series.length?g(n.series,"active"):'<div class="hr-empty">这个月还没有打卡</div>')+"</section>",h='<section class="hr-card hr-home-card"><h3>考勤结果分布</h3>'+(c.length?'<div class="hr-donut-wrap">'+v(c,{label: "应出勤",value:n.expected||n.came})+x(c)+"</div>":'<div class="hr-empty">这一天还没有留档</div>')+"</section>",m=[[n.late,"人迟到"],[n.know?n.absent:0,"人缺勤"],[n.leave,"人请假"],[n.otCount,"人 18:00 后下班"]],b='<section class="hr-card hr-home-card"><h3>待处理事项 ('+m.filter((function(t){return t[0]})).length+")</h3>"+m.map((function(t){return'<div class="hr-todo"><div><b>'+t[0]+" "+t[1]+"</b></div><span>"+a(i)+"</span></div>"})).join("")+'<div class="hr-empty">出差、排班和补卡还没有录入。</div></section>',y='<div class="hr-clock-tabs">'+[["detail","考勤明细"],["leave","请假记录"],["ot","加班记录"],["trip","出差记录"],["shift","排班管理"],["rule","考勤规则"]].map((function(t){return'<button type="button" data-clock-view="'+t[0]+'" aria-selected="'+(n.view===t[0])+'">'+t[1]+"</button>"})).join("")+"</div>",k="";if("leave"===n.view){var w=n.leaves.filter((function(t){return n.days.some((function(e){return M(t,e)}))}));k=l(["姓名","假种","开始","结束","时长"],q=w.length?w.map((function(t){return"<tr><td>"+a((n.byId[t.dingtalkUserId]||n.byId[t.personId]||{}).name||t.dingtalkUserId||"")+"</td><td>"+a(t.leaveName||"")+"</td><td>"+a(t.startAt||"")+"</td><td>"+a(t.endAt||"")+"</td><td>"+a(t.duration||"")+"</td></tr>"})).join(""):d(5,"这个月还没有请假记录")).replace("hr-card ","")}else if("ot"===n.view)k=l(["姓名","日期","工时"],q=n.ot.length?n.ot.map((function(t){return"<tr><td>"+a((n.roster.filter((function(e){return Number(e.id)===Number(t.personId)}))[0]||{}).name||"")+"</td><td>"+a(t.workDate||"")+"</td><td>"+a(t.hours||0)+"</td></tr>"})).join(""):d(3,"这个月还没有 18:00 后的下班")).replace("hr-card ","");else if("trip"===n.view)k='<div class="hr-empty">出差还没有录入。</div>';else if("shift"===n.view)k='<div class="hr-empty">排班还没有录入。</div>';else if("rule"===n.view)k='<div class="hr-empty">考勤规则还没有录入。</div>';else{var j=Math.max(1,Math.ceil(n.rows.length/20)),A=Math.min(Math.max(1,n.page),j),S=n.rows.slice(20*(A-1),20*A),q=S.length?S.map((function(t,e){var r=["#e8f1ff","#e9fbf1","#fff6e8","#f3e8ff"][e%4],n=["#2f6bff","#16a34a","#f5a524","#8b5cf6"][e%4],o="正常"===t.status?"hr-pill hr-pill-ok":"迟到"===t.status?"hr-pill hr-pill-try":"请假"===t.status?"hr-pill hr-pill-leave":"hr-pill hr-pill-off",i="迟到"===t.status?t.late?"迟到 "+t.late+" 分钟":"迟到":"缺勤"===t.status?"未打卡":"请假"===t.status?t.leaveName||"请假":"—";return'<tr><td><i class="hr-org-av" style="background:'+r+";color:"+n+'">'+a(String(t.name||"").slice(0,1))+"</i>"+a(t.name||"未命名")+"</td><td>"+a(t.job)+"</td><td>"+a(t.dept)+"</td><td>"+a(t.date)+"</td><td>"+a(String(t.on||"").slice(11,16))+"</td><td>"+a(String(t.off||"").slice(11,16))+"</td><td>"+a(t.hours||"—")+'</td><td><span class="'+o+'">'+a(t.status)+"</span></td><td>"+a(i)+"</td></tr>"})).join(""):d(9,"这个范围还没有打卡");k='<div class="hr-clock-filters"><input data-clock-q placeholder="搜索员工姓名 / 工号" value="'+a(n.q)+'" /><select data-clock-dept><option value="">所属部门：全部</option>'+n.depts.map((function(t){return'<option value="'+a(t)+'"'+(n.dept===t?" selected":"")+">"+a(t)+"</option>"})).join("")+'</select><select data-clock-status><option value="">考勤状态：全部</option>'+["正常","迟到","缺勤","请假"].map((function(t){return'<option value="'+t+'"'+(n.status===t?" selected":"")+">"+t+"</option>"})).join("")+'</select><input type="date" data-clock-from value="'+a(n.from)+'" /><input type="date" data-clock-to value="'+a(n.to)+'" /><button type="button" data-act="clock-query">查询</button><button type="button" data-act="clock-reset">重置</button></div>'+l(["姓名","工号","所属部门","考勤日期","上班","下班","时长","考勤状态","异常"],q).replace("hr-card ","")+'<div class="hr-clock-bar"><span>共 '+n.rows.length+' 条记录</span><span><button type="button" data-clock-page="'+(A-1)+'"'+(A<=1?" disabled":"")+">上一页</button> "+A+" / "+j+' <button type="button" data-clock-page="'+(A+1)+'"'+(A>=j?" disabled":"")+">下一页</button></span></div>"}if(r.innerHTML='<div class="hr-home-kpis">'+s+'</div><div class="hr-clock-grid">'+p+h+b+'</div><section class="hr-card hr-home-card">'+y+k+"</section>",o){var E=r.querySelector("[data-clock-q]");if(E){E.focus();var C=E.value.length;E.setSelectionRange&&E.setSelectionRange(C,C)}}u(t,n.ref?"":"这个月还没有留档的打卡。",!1)}}function O(t){var e={people:'<circle cx="8" cy="5" r="2"/><path d="M3.4 13c.5-2 2.2-3 4.6-3s4.1 1 4.6 3"/>',dept:'<path d="M3 13V6l5-3 5 3v7"/><path d="M7 13V9h2v4"/>',bag:'<rect x="3" y="5" width="10" height="8" rx="1.4"/><path d="M6 5V4a2 2 0 0 1 4 0v1"/>',stack:'<path d="M3 6.5 8 4l5 2.5L8 9zM3 9.5 8 12l5-2.5"/>',gap:'<circle cx="8" cy="6" r="2"/><path d="M4 13c.4-2 1.8-3 4-3s3.6 1 4 3"/>'};return'<svg viewBox="0 0 16 16" aria-hidden="true">'+(e[t]||e.people)+"</svg>"}function E(t,e){
const staff = (e?.staff || []).filter(person => !person.needsOrganization && person.name !== "管理员");
const pick = t.getAttribute("data-org-dept") || "", personQ = t.getAttribute("data-org-person") || "";
const status = t.getAttribute("data-org-status") ?? "在职", pos = t.getAttribute("data-org-pos") || "";
const view = t.getAttribute("data-org-view") || "chart";
const by = Object.create(null), order = [];
for (const person of staff) {
 const key = person.id;
 by[key] = { ...person, role: person.position, supervisor: person.group, board: person.board || "" };
 order.push(key);
}
const supportDepartments = { hr: "人事部", tech: "技术部" };
function supportDepartmentOf(person) {
 const board = person.board;
 if (board === "hr" || board === "tech") return board;
 const label = String(person.department || "").split(/[（(]/, 1)[0].trim();
 if (["人事", "人事部", "人事部门"].includes(label)) return "hr";
 if (["技术", "技术部", "技术部门"].includes(label)) return "tech";
 return "";
}
function operationsManagerOf(person) {
 if (supportDepartmentOf(person)) return "";
 const managers = ["韩梦凯", "沈子晗"];
 return managers.includes(person.name) ? person.name : managers.includes(person.lineManager) ? person.lineManager : "";
}
function reportsToDirector(person) {
 return operationsManagerOf(person) || supportDepartmentOf(person) || person.lineManager === "罗成" || person.board === "hrTech";
}
function supportSummary(department) {
 const members = order.map(name => by[name]).filter(person => person.status !== "离职" && supportDepartmentOf(person) === department);
 const supervisors = members.filter(person => person.role === "主管").map(person => person.name);
 return supervisors.length ? "主管 " + supervisors.join("、") + " · " + members.length + " 人" : "在职 " + members.length + " 人";
}
function blank(v){return!v||"无"===v||"—"===v}function members(manager,group){return order.filter(function(n){var p=by[n];return p.status!=="离职"&&operationsManagerOf(p)===manager&&p.name!==manager&&("direct"===group?blank(p.supervisor)||p.supervisor===manager:p.supervisor===group)}).map(function(n){return by[n]})}function groups(manager){var seen=Object.create(null);return order.forEach(function(n){var p=by[n];p.status!=="离职"&&operationsManagerOf(p)===manager&&p.supervisor&&p.supervisor!==manager&&"无"!==p.supervisor&&(seen[p.supervisor]=1)}),Object.keys(seen).sort(function(a,b){return members(manager,b).length-members(manager,a).length||a.localeCompare(b,"zh")})}
function node(title, sub, key, children, tone) {
 const button = '<button type="button" class="hr-org-node' + (children ? ' hr-org-branch' : '') +
  '" data-org-dept="' + a(key) + '" aria-selected="' + (pick === key) + '">' +
  '<i style="background:' + tone[0] + ';color:' + tone[1] + '">' + O(children ? "dept" : "people") +
  '</i><div><b>' + a(title) + '</b><span>' + a(sub) + '</span></div></button>';
 if (!children) return button;
 const isDirector = key === "luo";
 const branchClass = isDirector ? ' hr-org-chart--director' : '';
 const groupClass = isDirector ? ' hr-org-direct-reports' : '';
 const groupAttributes = isDirector ? ' role="group" aria-label="' + a(title + '直属部门') + '"' : '';
 return '<div class="hr-org-chart' + branchClass + '">' + button +
  '<div class="hr-org-kids' + groupClass + '"' + groupAttributes + '>' + children + '</div></div>';
}
function zoneNodes(manager){var direct=members(manager,"direct"),keys=groups(manager),html=node("直属小组","在职 "+(direct.length+1),"g:"+manager,"",tones[0]);return keys.forEach(function(k,i){html+=node(k,"在职 "+members(manager,k).length,"g:"+k,"",tones[(i+1)%tones.length])}),html}function unit(manager){return order.filter(function(n){var p=by[n];return p.status!=="离职"&&operationsManagerOf(p)===manager}).length}var activeStaff = staff.filter(person => person.status !== "离职"); var tones=[["#e8f1ff","#2f6bff"],["#e9fbf1","#16a34a"],["#f3e8ff","#8b5cf6"],["#e7f8fb","#0891b2"],["#fff6e8","#f5a524"]],opsN=unit("韩梦凯")+unit("沈子晗"),chart='<div class="hr-org-chart"><button type="button" class="hr-org-co" data-org-dept="" aria-selected="'+(pick?"false":"true")+'"><i style="background:#2f6bff;color:#fff">'+O("people")+'</i><div><b>甄选</b><span>在职 '+activeStaff.length+'</span></div></button><div class="hr-org-kids">'+node("罗成","总监","luo",node(supportDepartments.tech,supportSummary("tech"),"tech","",tones[2])+node("运营部","在职 "+opsN,"ops",node("运营一区","韩梦凯","han",zoneNodes("韩梦凯"),tones[0])+node("运营二区","沈子晗","shen",zoneNodes("沈子晗"),tones[1]),tones[0])+node(supportDepartments.hr,supportSummary("hr"),"hr","",tones[3]),tones[4])+"</div></div>",main="quota"===view?'<div class="hr-empty">编制还没有录入。</div>':chart;
function pathOf(person) {
 const department = supportDepartmentOf(person);
 if (department) return supportDepartments[department];
 const manager = operationsManagerOf(person);
 if (manager) {
  const zone = manager === "韩梦凯" ? "运营一区" : "运营二区";
  const direct = person.name === manager || blank(person.supervisor) || person.supervisor === manager;
  return zone + " · " + (direct ? "直属" : person.supervisor);
 }
 return person.board === "hrTech" ? "待确认部门" : "其他部门";
}
function picked(person) {
 if (!pick) return true;
 if (pick === "luo") return reportsToDirector(person);
 if (pick === "tech" || pick === "hr") return supportDepartmentOf(person) === pick;
 const manager = operationsManagerOf(person);
 if (pick === "ops") return Boolean(manager);
 if (pick === "han") return manager === "韩梦凯";
 if (pick === "shen") return manager === "沈子晗";
 if (pick === "other") return !reportsToDirector(person);
 if (!pick.startsWith("g:")) return true;
 if (!manager) return false;
 const group = pick.slice(2);
 return group === "韩梦凯" || group === "沈子晗"
  ? manager === group && person.name !== group && (blank(person.supervisor) || person.supervisor === group)
  : person.name === group || person.supervisor === group;
}
var q=personQ.replace(/\s+/g,""),rows=order.map(function(n){return by[n]}).filter(function(p){return!("在职"===status&&"离职"===p.status)&&!("离职"===status&&"离职"!==p.status)&&(!pos||p.role===pos)&&(!q||(p.name+p.jobNumber).indexOf(q)>=0)&&picked(p)}).map(function(p){return{id:p.id,name:p.name,jobNumber:p.jobNumber||"",position:p.role||"—",department:pathOf(p),joinedOn:p.joinedOn||"",status:p.status||"在职"}}).sort(function(x,y){return x.department.localeCompare(y.department,"zh")||x.name.localeCompare(y.name,"zh")});return{active:activeStaff,total:activeStaff.length,rows:rows,posNames:[...new Set(staff.map(person => person.position).filter(Boolean))].sort((left,right) => left.localeCompare(right, "zh")),view:view,personQ:personQ,status:status,pos:pos,main:main,label:{"luo":"罗成","ops":"运营部","han":"运营一区","shen":"运营二区","tech":"技术部","hr":"人事部","other":"其他部门"}[pick]||(0===pick.indexOf("g:")?pick.slice(2)+" 组":"全部")}}const orgConnectionObservers = new WeakMap();
function stopOrgConnections(root) {
 orgConnectionObservers.get(root)?.disconnect();
 orgConnectionObservers.delete(root);
}
function mountOrgConnections(root, chart) {
 stopOrgConnections(root);
 if (!chart) return;

 const overlay = document.createElement("div");
 overlay.className = "hr-org-connections";
 overlay.setAttribute("aria-hidden", "true");
 chart.prepend(overlay);

 const groups = Array.from(chart.querySelectorAll(".hr-org-kids"), group => ({
  group,
  parent: group.previousElementSibling,
  children: [...group.querySelectorAll(":scope > .hr-org-node, :scope > .hr-org-chart > .hr-org-node")]
 }));
 const middleX = rect => rect.left + rect.width / 2;
 const draw = () => {
  const origin = chart.getBoundingClientRect();
  if (!origin.width || !origin.height) return;
  const segments = document.createDocumentFragment();
  function addLine(x1, y1, x2, y2) {
   const length = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
   if (length < 0.5) return;
   const horizontal = y1 === y2;
   const segment = document.createElement("span");
   segment.style.left = Math.min(x1, x2) - origin.left - (horizontal ? 0 : 1) + "px";
   segment.style.top = Math.min(y1, y2) - origin.top - (horizontal ? 1 : 0) + "px";
   segment.style.width = (horizontal ? length : 2) + "px";
   segment.style.height = (horizontal ? 2 : length) + "px";
   segments.append(segment);
  }

  for (const {group, parent, children} of groups) {
   if (!children.length) continue;
   const parentRect = parent.getBoundingClientRect();
   const parentX = middleX(parentRect);
   const rows = [];
   const cards = children.map(child => child.getBoundingClientRect()).sort((first, second) => first.top - second.top);
   for (const card of cards) {
    const last = rows.at(-1);
    if (last && Math.abs(last.top - card.top) < 1) last.cards.push(card);
    else rows.push({top:card.top, cards:[card]});
   }

   const railY = row => row.top - 18;
   const firstRail = railY(rows[0]);
   const lastRail = railY(rows.at(-1));
   let spineX = parentX;
   if (rows.length > 1) {
    const bounds = group.getBoundingClientRect();
    // Use opposite sides for wrapped branches and their member groups.
    const hasBranches = children.some(child => child.classList.contains("hr-org-branch"));
    spineX = hasBranches ? bounds.right + 4 : bounds.left - 4;
   }
   addLine(parentX, parentRect.bottom, parentX, firstRail);
   addLine(spineX, firstRail, spineX, lastRail);
   rows.forEach((row, index) => {
    const y = railY(row);
    const points = [spineX, ...row.cards.map(middleX)];
    if (index === 0) points.push(parentX);
    addLine(Math.min(...points), y, Math.max(...points), y);
    for (const card of row.cards) {
     const x = middleX(card);
     addLine(x, y, x, card.top);
    }
   });
  }
  overlay.replaceChildren(segments);
 };

 draw();
 const observer = new ResizeObserver(draw);
 observer.observe(chart);
 for (const {parent, children} of groups) {
  observer.observe(parent);
  for (const child of children) observer.observe(child);
 }
 orgConnectionObservers.set(root, observer);
}

function C(t,e){var n=t.querySelector("[data-org]");if(!n)return;var o=E(t,e),i="";document.activeElement&&document.activeElement.hasAttribute&&document.activeElement.hasAttribute("data-org-person")&&(i="data-org-person");var s=r().slice(0,7),c=o.active.filter(function(t){return 0===String(t.joinedOn||"").indexOf(s)}).length,u=[["#e8f1ff","#2f6bff","people"],["#e9fbf1","#16a34a","dept"],["#f3e8ff","#8b5cf6","bag"],["#fff6e8","#f5a524","stack"],["#fff1f0","#f04438","gap"]],p=[["在职人数",o.total+" 人","本月入职 "+c+" 人"],["部门数量","3","运营部、技术部、人事部"],["岗位数量",String(o.posNames.length),o.posNames.join("、")],["编制总数","未录入","还没有编制"],["缺编岗位","未录入","还没有编制"]],m=["#2f6bff","#16a34a","#8b5cf6","#0891b2","#f5a524"],x=o.rows.length?o.rows.map(function(t,e){var r="离职"===t.status?"hr-pill hr-pill-off":"hr-pill hr-pill-ok";return'<tr><td><i class="hr-org-av" style="background:'+u[e%u.length][0]+";color:"+m[e%m.length]+'">'+a(String(t.name||"").slice(0,1))+"</i>"+a(t.name)+"</td><td>"+a(t.jobNumber)+"</td><td>"+a(t.position)+"</td><td>"+a(t.department)+"</td><td>"+a(t.joinedOn)+'</td><td><span class="'+r+'">'+a(t.status)+'</span></td></tr>'}).join(""):d(6,"没有匹配的人员");if(n.innerHTML='<div class="hr-org-box"><div class="hr-home-kpis">'+p.map(function(t,e){var r=u[e],n=String(t[1]),o=/^(\d+) 人$/.test(n)?n.replace(" 人","<small>人</small>"):a(n);return'<article class="hr-home-kpi"><i class="hr-home-icon" style="background:'+r[0]+";color:"+r[1]+'">'+O(r[2])+'</i><div class="hr-home-kpi-main"><span>'+t[0]+"</span><b>"+o+"</b><em>"+a(t[2])+"</em></div></article>"}).join("")+'</div><div class="hr-org-main"><div class="hr-org-tabs">'+[["chart","组织架构图"],["info","组织信息"],["quota","编制分析"],["report","汇报关系"]].map(function(t){return'<button type="button" data-org-view="'+t[0]+'" aria-selected="'+(o.view===t[0])+'">'+t[1]+"</button>"}).join("")+'</div>'+o.main+'</div><section class="hr-org-members"><div class="hr-org-member-head"><h3>部门成员（'+a(o.label)+'）</h3><button type="button" class="hr-primary" data-act="org-add">添加成员</button></div><div class="hr-org-filters"><input data-org-person placeholder="搜索员工姓名 / 工号" value="'+a(o.personQ)+'" /><select data-org-status><option value="在职"'+( "在职"===o.status?" selected":"")+'>在职状态：在职</option><option value="离职"'+( "离职"===o.status?" selected":"")+'>在职状态：离职</option><option value=""'+( ""===o.status?" selected":"")+'>在职状态：全部</option></select><select data-org-pos><option value="">岗位：全部</option>'+o.posNames.map(function(t){return'<option value="'+t+'"'+(o.pos===t?" selected":"")+">"+t+"</option>"}).join("")+"</select></div>"+l(["姓名","工号","岗位","所属部门","入职日期","状态"],x).replace("hr-card ","")+"</section></div>",mountOrgConnections(t,n.querySelector(".hr-org-main > .hr-org-chart")),i){var y=n.querySelector("["+i+"]");y&&(y.focus(),y.setSelectionRange&&y.setSelectionRange(y.value.length,y.value.length))}}var recruitPending=null,recruitFill=function(t,e){recruitPending=[t,e]},T=recruitFill;(function(){try{var e=Uint8Array.from(atob("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"),function(c){return c.charCodeAt(0)});new Response(new Blob([e]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text().then(function(n){recruitFill=T=new Function("r","m","h","a","g","l","d","A","return "+n)(r,m,h,a,g,l,d,A);recruitPending&&recruitFill(recruitPending[0],recruitPending[1])})}catch(e){}})();function D(t,state){var e=++state.ticket,n=state.tab;if("attendance"===n){var l=t.querySelector("[data-range]"),d=l&&l.value?l.value:"30";return state.home=state.home||{},void(state.home[d]?Promise.resolve(state.home[d]):o("/api/hr/home?range="+encodeURIComponent(d)).then((function(t){return state.home[d]=t,t}))).then((function(a){state.alive&&e===state.ticket&&state.tab===n&&(state.view=a,y(t,a))})).catch((function(a){if(state.alive&&e===state.ticket){if(403===a.status){var r=document.querySelector('a[href="/hr"]');return r&&r.remove(),void(t.innerHTML='<div class="xm-page hr-page xm-ui-scope"><p class="hr-msg is-error">没有智能人事权限</p></div>')}u(t,a.message||"读取失败",!0)}}))}if("overtime"===n){var s=t.querySelector("[data-month]"),c=s&&s.value?s.value:r().slice(0,7);return state.effort=state.effort||{},void(state.effort[c]?Promise.resolve(state.effort[c]):o("/api/hr/effort?month="+encodeURIComponent(c)).then((function(t){return state.effort[c]=t,t}))).then((function(a){state.alive&&e===state.ticket&&state.tab===n&&(state.view=a,w(t,a))})).catch((function(a){state.alive&&e===state.ticket&&u(t,a.message||"读取失败",!0)}))}if("clock"===n){var p=t.querySelector("[data-month]"),f=p&&p.value?p.value:r().slice(0,7);return state.clocks=state.clocks||{},void(state.clocks[f]?Promise.resolve(state.clocks[f]):Promise.all([o("/api/hr/attendance?month="+encodeURIComponent(f)),o("/api/hr/overtime?month="+encodeURIComponent(f)).catch((function(){return{overtime:[]}})),o("/api/hr/timeoff").catch((function(){return{leaves:[]}})),o("/api/hr/staff").catch((function(){return{staff:[]}}))]).then((function(t){var e={month:f,punches:t[0]&&t[0].punches||[],overtime:t[1]&&t[1].overtime||[],leaves:t[2]&&t[2].leaves||[],staff:t[3]&&t[3].staff||[]};return state.clocks[f]=e,e}))).then((function(a){state.alive&&e===state.ticket&&state.tab===n&&(state.view=a,q(t,a))})).catch((function(a){state.alive&&e===state.ticket&&u(t,a.message||"读取失败",!0)}))}if("pay"===n){var h=t.querySelector("[data-month]"),m=h&&h.value?h.value:r().slice(0,7);return state.effort=state.effort||{},void(state.effort[m]?Promise.resolve(state.effort[m]):o("/api/hr/effort?month="+encodeURIComponent(m)).then((function(t){return state.effort[m]=t,t}))).then((function(r){state.alive&&e===state.ticket&&state.tab===n&&(state.view=r,function(t,e){var r=t.querySelector("[data-pay-kpis]");r&&(r.innerHTML=[{label: "薪酬",value:"未录入"},{label: "本月人均时长",value:e.average||0},{label: "参与人数",value:e.participants||0}].map((function(t){return'<div class="hr-kpi"><b>'+a(t.value)+"</b><span>"+a(t.label)+"</span></div>"})).join(""));var n=e.teams||[],o=t.querySelector("[data-pay-teams]");o&&(o.innerHTML="<h3>各部门人均时长</h3>"+(n.length?n.map((function(t){return'<div class="hr-rank"><div class="hr-rank-top"><span>'+a(t.name)+"</span><b>"+a(t.average||0)+"小时</b></div></div>"})).join(""):'<div class="hr-empty">这个月还没留档奋斗时长。</div>')),e.saved?u(t,"",!1):u(t,"这个月的绩效还没留档。薪酬金额仍然不在这里。",!1)}(t,r))})).catch((function(a){state.alive&&e===state.ticket&&u(t,a.message||"读取失败",!0)}))}if("train"!==n){
state.status ||= o("/api/hr/status").catch(() => ({ configured: false }));
var g,v=state.status;if("staff"===n||"org"===n)g=o("/api/hr/staff");else{var x=t.querySelector("[data-join-month]");x&&x.value?x.value:r().slice(0,7),g=Promise.all([o("/api/hr/recruits"),o("/api/hr/onboards"),o("/api/hr/interviews").catch((function(){return{interviews:[]}})),o("/api/hr/talents").catch((function(){return{talents:[]}}))]).then((function(t){return{recruits:t[0].recruits||[],onboards:t[1].onboards||[],interviews:t[2].interviews||[],talents:t[3].talents||[]}}))}Promise.all([v,g]).then((function(a){if(state.alive&&e===state.ticket&&state.tab===n){var r=Object.assign({configured:a[0].configured},a[1]);state.view=r,"attendance"===n?y(t,r):"overtime"===n?w(t,r):"staff"===n?S(t,r):"org"===n?C(t,r):"recruit"===n&&T(t,r)}})).catch((function(a){if(state.alive&&e===state.ticket){if(403===a.status){var r=document.querySelector('a[href="/hr"]');return r&&r.remove(),void(t.innerHTML='<div class="xm-page hr-page xm-ui-scope"><p class="hr-msg is-error">没有智能人事权限</p></div>')}u(t,a.message||"读取失败",!0)}}))}}function I(e,state,a){t.some((function(t){return t.id===a}))&&(state.tab=a,Array.prototype.forEach.call(e.querySelectorAll(".hr-tab"),(function(t){var e=t.getAttribute("data-tab")===a;t.setAttribute("aria-selected",e?"true":"false"),t.tabIndex=e?0:-1})),p(e,a,r().slice(0,7),r()),D(e,state))}function L(t,e){var a=t.elements[e];return a?String(a.value||"").trim():""}function H(t,e){var a=new Blob(["\ufeff"+e],{type:"text/csv;charset=utf-8"}),r=document.createElement("a");r.href=URL.createObjectURL(a),r.download=t,r.click(),URL.revokeObjectURL(r.href)}function P(form,person){form.querySelector("[data-staff-enroll]").hidden=!person?.needsOrganization;form.elements.syncOrganization.checked=false;staffFields.forEach(([key])=>{form.elements[key].value=person?(staffEditValue(person,key)??""):key==="status"?"在职":""});var button=form.querySelector("button[type=submit]");if(person?.id)form.setAttribute("data-staff-id",String(person.id));else form.removeAttribute("data-staff-id");button.textContent=person?"保存修改":"登记"}var F="undefined"==typeof window?null:window;F&&(F.XmModules=F.XmModules||{},F.XmModules["/hr"]={mount:function(e){!function(){if(!document.getElementById("hr-page-style")){var t=document.createElement("style");t.id="hr-page-style",t.textContent=".hr-page{color:var(--xm-ink)}html[data-theme='dark'] .hr-msg.is-error{color:#ff7875}.hr-board-kpi b{order:2}.hr-board-kpi i{order:3;display:flex;width:52px}.hr-board-kpi span{order:1}",(function(){try{var e=Uint8Array.from(atob("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"),function(c){return c.charCodeAt(0)});new Response(new Blob([e]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text().then(function(a){t.textContent=a+".hr-todo{align-items:flex-start}.hr-todo .hr-todo-names{display:block;margin-top:4px;line-height:1.55;white-space:normal}button.hr-org-co{font:inherit;cursor:pointer}.hr-org-branch:after{content:'';position:absolute;left:50%;bottom:-18px;width:2px;height:18px;background:#8eb6ff}.hr-org-kids{align-items:flex-start}[data-staff]{display:flex;flex-direction:column;gap:16px}.hr-staff .hr-home-kpis,.hr-staff .hr-clock-grid{gap:16px}"})}catch(a){}})(),document.head.appendChild(t)}}();
  mountStaffRosterStyles();
  if (!document.getElementById("xm-hr-org-chart-style")) {
    const orgChartStyle = document.createElement("style");
    orgChartStyle.id = "xm-hr-org-chart-style";
    orgChartStyle.textContent = `
.hr-org-chart.hr-org-chart--director { width: 100%; }
.hr-org-kids.hr-org-direct-reports {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-template-areas: "tech ops hr" "zones zones zones";
  position: relative;
  align-items: stretch;
  justify-items: center;
  gap: 18px 0;
  border-top: 0;
  padding-top: 18px;
}
.hr-org-direct-reports > .hr-org-chart {
  display: contents;
}
.hr-org-direct-reports > [data-org-dept="tech"] { grid-area: tech; }
.hr-org-direct-reports > [data-org-dept="hr"] { grid-area: hr; }
.hr-org-direct-reports > .hr-org-chart > [data-org-dept="ops"] { grid-area: ops; }
.hr-org-direct-reports > .hr-org-chart > .hr-org-kids {
  grid-area: zones;
  margin-top: 0;
}
.hr-org-direct-reports > .hr-org-node,
.hr-org-direct-reports > .hr-org-chart > .hr-org-node {
  min-width: 0;
  width: min(188px, calc(100% - 8px));
}
.hr-org-main > .hr-org-chart { position: relative; }
.hr-org-chart > .hr-org-kids {
  border-top-color: transparent;
  row-gap: 24px;
}
.hr-org-main .hr-org-co::after,
.hr-org-main .hr-org-node::before,
.hr-org-main .hr-org-branch::after { content: none; }
.hr-org-connections {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.hr-org-connections > span {
  position: absolute;
  background: #8eb6ff;
}
@media (max-width: 600px) {
  .hr-org-direct-reports > .hr-org-node,
  .hr-org-direct-reports > .hr-org-chart > .hr-org-node {
    padding: 8px;
  }
  .hr-org-direct-reports > .hr-org-node > i,
  .hr-org-direct-reports > .hr-org-chart > .hr-org-node > i {
    display: none;
  }
}
    `;
    document.head.appendChild(orgChartStyle);
  }
  if (!document.getElementById("xm-hr-dashboard-style")) {
    const dashboardStyle = document.createElement("style");
    dashboardStyle.id = "xm-hr-dashboard-style";
    dashboardStyle.textContent = `
.hr-page:has(.hr-dashboard) {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    container: hr-page / inline-size;
  }
  .hr-page:has(.hr-dashboard) > .hr-top { flex: 0 0 auto; }
  .hr-page:has(.hr-dashboard) > .hr-body {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
  }
  .hr-dashboard {
    --hr-primary: var(--xm-primary, var(--xm-ui-primary));
    --hr-surface: var(--xm-card, var(--xm-ui-surface));
    --hr-ink: var(--xm-ui-text);
    --hr-muted: var(--xm-ui-text-secondary);
    --hr-line: var(--xm-ui-border);
    --hr-tint: color-mix(in srgb, var(--hr-primary) 8%, var(--hr-surface));
    container: hr-board / inline-size;
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
    min-height: 0;
    padding: 10px 4px 4px;
    color: var(--hr-ink);
    font-variant-numeric: tabular-nums;
  }
  html[data-theme="dark"] .hr-dashboard {
    --hr-ink: var(--xm-ink);
    --hr-muted: #b9bdc9;
    --hr-line: color-mix(in srgb, var(--hr-ink) 16%, var(--hr-surface));
  }
  .hr-dashboard-head { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 16px; min-width: 0; }
  .hr-dashboard-title { display: grid; gap: 1px; min-width: 0; }
  .hr-dashboard-eyebrow { color: var(--hr-primary); font-size: 10px; font-weight: 750; letter-spacing: .13em; line-height: 1; }
  .hr-dashboard-head h1 { margin: 0; font-size: 23px; font-weight: 750; letter-spacing: .015em; line-height: 1.2; }
  .hr-dashboard-subtitle { margin: 0; color: var(--hr-muted); font-size: 11px; }
  .hr-dashboard-head .hr-msg { margin: 0; overflow-wrap: anywhere; }
  .hr-dashboard-head .hr-msg:empty { display: none; }
  .hr-dashboard-range {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0 10px;
    margin-left: auto;
    padding: 3px 10px;
    border: 1px solid var(--hr-line);
    border-radius: 8px;
    background: var(--hr-surface);
    color: var(--hr-muted);
    font-size: 12px;
  }
  .hr-dashboard-range select {
    max-width: 100%;
    padding: 4px 3px;
    color: var(--hr-ink);
    background: var(--hr-surface);
    border: 0;
    font: inherit;
    font-weight: 650;
    cursor: pointer;
  }
  .hr-dashboard-context { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-width: 0; padding: 7px 10px; border: 1px solid var(--hr-line); border-radius: 9px; background: color-mix(in srgb, var(--hr-primary) 3%, var(--hr-surface)); }
  .hr-dashboard-context-copy { display: flex; align-items: baseline; gap: 8px; min-width: 0; white-space: nowrap; }
  .hr-dashboard-context-label { color: var(--hr-muted); font-size: 11px; }
  .hr-dashboard-context-copy strong { color: var(--hr-ink); font-size: 13px; }
  .hr-dashboard-context-copy span:last-child { overflow: hidden; color: var(--hr-muted); font-size: 11px; text-overflow: ellipsis; }
  .hr-dashboard-filters { display: flex; align-items: center; justify-content: flex-end; gap: 5px; min-width: 0; }
  .hr-dashboard-filters > span { color: var(--hr-muted); font-size: 11px; }
  .hr-dashboard-filters [data-dept-filters] { display: flex; gap: 4px; min-width: 0; overflow: hidden; }
  .hr-dashboard-filters button { flex: 0 0 auto; padding: 3px 8px; border: 1px solid transparent; border-radius: 999px; background: transparent; color: var(--hr-muted); font-size: 11px; line-height: 1.3; }
  .hr-dashboard-filters button:hover { border-color: var(--hr-line); color: var(--hr-primary); }
  .hr-dashboard-filters button[aria-pressed="true"] { border-color: color-mix(in srgb, var(--hr-primary) 25%, transparent); background: var(--hr-primary); color: white; font-weight: 650; }
  .hr-dashboard-reset { color: var(--hr-primary) !important; }
  .hr-dashboard-kpis, .hr-dashboard-grid { display: grid; gap: 10px; min-width: 0; }
  .hr-dashboard-kpis { grid-template-columns: repeat(5, minmax(0, 1fr)); }
  .hr-dashboard-grid {
    flex: 1;
    min-height: 0;
    grid-template-columns: repeat(24, minmax(0, 1fr));
    grid-template-rows: minmax(215px, 1.08fr) minmax(228px, 1fr);
  }
  .hr-dashboard-slot { display: flex; flex-direction: column; grid-column: span 6; min-width: 0; min-height: 0; }
  .hr-dashboard [data-trend-card] { grid-column: span 11; }
  .hr-dashboard [data-structure] { grid-column: span 8; }
  .hr-dashboard [data-todos] { grid-column: span 5; }
  .hr-dashboard [data-moves] { grid-column: span 7; }
  .hr-dashboard [data-recruit-progress] { grid-column: span 5; }
  .xm-ui-scope .hr-dashboard .xm-ui-stat-card,
  .xm-ui-scope .hr-dashboard .xm-ui-card {
    border: 1px solid var(--hr-line);
    border-radius: 10px;
    background: var(--hr-surface);
    box-shadow: 0 2px 6px rgb(18 52 100 / 4%);
  }
  .xm-ui-scope .hr-dashboard .xm-ui-stat-card {
    min-height: 79px;
    gap: clamp(8px, 1vw, 16px);
    padding: 9px clamp(9px, 1vw, 17px);
  }
  .xm-ui-scope .hr-dashboard .xm-ui-stat-card:hover { transform: none; box-shadow: none; }
  .xm-ui-scope .hr-dashboard .xm-ui-stat-card__icon { width: 36px; height: 36px; flex: 0 0 36px; border-radius: 9px; }
  .xm-ui-scope .hr-dashboard .xm-ui-stat-card__icon .xm-ui-icon { width: 19px; height: 19px; }
  .xm-ui-scope .hr-dashboard .xm-ui-stat-card__label { color: var(--hr-muted); font-size: 12px; }
  .xm-ui-scope .hr-dashboard .xm-ui-stat-card__value { margin-top: 0; color: var(--hr-ink); font-size: 25px; line-height: 1.15; }
  .xm-ui-scope .hr-dashboard .xm-ui-stat-card__value small { color: var(--hr-muted); font-size: 11px; }
  .xm-ui-scope .hr-dashboard .xm-ui-stat-card__note { margin-top: 3px; color: var(--hr-muted); font-size: 11px; line-height: 1.3; overflow-wrap: anywhere; }
  .xm-ui-scope .hr-dashboard .xm-ui-stat-card__note.is-positive { color: #087e52; }
  html[data-theme="dark"] .hr-dashboard .xm-ui-stat-card__note.is-positive { color: #55d8a5; }

  .xm-ui-scope .hr-dashboard-slot > .xm-ui-card { display: flex; flex: 1; flex-direction: column; min-height: 0; overflow: visible; }
  .xm-ui-scope .hr-dashboard-slot .xm-ui-section-title { padding: 8px 12px 6px 20px; min-height: 36px; }
  .xm-ui-scope .hr-dashboard-slot .xm-ui-section-title::before {
    inset: 11px auto 10px 11px;
    width: 3px;
    background: var(--hr-primary);
  }
  .xm-ui-scope .hr-dashboard-slot .xm-ui-section-title h2 { margin: 0; color: var(--hr-ink); font-size: 14px; line-height: 1.35; }
  .xm-ui-scope .hr-dashboard-slot .xm-ui-card__body { display: flex; flex: 1; flex-direction: column; min-height: 0; padding: 0 12px 11px; }
  .xm-ui-scope .hr-dashboard-slot .xm-ui-empty-state {
    flex: 1;
    min-height: 0;
    min-width: 0;
    padding: 10px 0;
  }
  .xm-ui-scope .hr-dashboard-slot .xm-ui-empty-state h3 { margin: 7px 0 0; color: var(--hr-muted); font-size: 12px; font-weight: 500; }
  .xm-ui-scope .hr-dashboard-slot .xm-ui-empty-state__icon { width: 38px; height: 38px; background: var(--hr-tint); color: var(--hr-primary); }
  .xm-ui-scope .hr-dashboard-slot .xm-ui-empty-state__icon .xm-ui-icon { width: 19px; height: 19px; }
  .hr-dashboard-empty { margin: auto; color: var(--hr-muted); font-size: 12px; }

  .hr-dashboard-chart-head, .hr-dashboard-move-head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 5px; }
  .hr-dashboard-segment { display: inline-flex; flex-wrap: wrap; gap: 2px; padding: 2px; border-radius: 7px; background: var(--hr-tint); }
  .hr-dashboard button { font-family: inherit; cursor: pointer; }
  .hr-dashboard-segment button {
    border: 0;
    border-radius: 5px;
    background: transparent;
    color: var(--hr-muted);
    font-size: 11px;
    padding: 4px 7px;
    line-height: 1.35;
  }
  .hr-dashboard-segment button[aria-pressed="true"] { background: var(--hr-primary); color: white; font-weight: 650; }
  .hr-chart-latest { color: var(--hr-muted); font-size: 11px; white-space: nowrap; }
  .hr-chart-latest b { color: var(--hr-primary); margin-left: 5px; font-size: 14px; }
  .hr-dashboard-chart {
    display: grid;
    grid-template-columns: minmax(15px, max-content) minmax(0, 1fr);
    grid-template-rows: minmax(75px, 1fr) auto;
    gap: 7px 9px;
    flex: 1;
    margin: 16px 5px 0 0;
  }
  .hr-chart-y { display: flex; flex-direction: column; justify-content: space-between; margin: -7px 0; text-align: right; }
  .hr-chart-x { grid-column: 2; display: flex; justify-content: space-between; }
  .hr-chart-x, .hr-chart-y { color: var(--hr-muted); font-size: 11px; }
  .hr-chart-plot { position: relative; }
  .hr-chart-plot svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
  .hr-chart-plot .hr-chart-lines { fill: none; stroke: var(--hr-line); }
  .hr-chart-plot polygon { fill: var(--hr-tint); }
  .hr-chart-plot polyline { fill: none; stroke: var(--hr-primary); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
  .hr-chart-point {
    position: absolute;
    top: var(--point-y);
    left: var(--point-x);
    width: 8px;
    height: 8px;
    transform: translate(-50%, -50%);
    border: 2px solid var(--hr-primary);
    border-radius: 50%;
    background: var(--hr-surface);
  }
  .hr-chart-points circle { fill: transparent; stroke: transparent; cursor: pointer; }
  .hr-chart-points circle:hover { fill: var(--hr-surface); stroke: var(--hr-primary); stroke-width: 2; }

  .hr-dashboard .hr-donut-wrap { display: flex; flex: 1; align-items: center; gap: 10px; min-width: 0; }
  .hr-dashboard .hr-donut { flex: 0 1 136px; width: min(34%, 136px); height: auto; aspect-ratio: 1; }
  .hr-dashboard .hr-donut text:first-of-type { fill: var(--hr-muted); }
  .hr-dashboard .hr-donut text:last-of-type { fill: var(--hr-ink); }
  .hr-dashboard .hr-legend { display: grid; flex: 1; align-content: center; gap: 3px; min-width: 0; margin: 0; padding: 0; color: var(--hr-muted); }
  .hr-dashboard .hr-legend li { display: grid; grid-template-columns: 8px minmax(0, 1fr) max-content minmax(34px, max-content); gap: 5px; font-size: 11px; }
  .hr-dashboard .hr-legend li span, .hr-dashboard-ranks li div > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .hr-dashboard .hr-legend b, .hr-dashboard .hr-legend em { color: var(--hr-ink); }
  .hr-dashboard .hr-legend em { color: var(--hr-muted); }
  .hr-dept-legend { display: grid; flex: 1; align-content: center; gap: 2px; min-width: 0; }
  .hr-dept-legend button { display: grid; grid-template-columns: 8px minmax(0, 1fr) max-content minmax(30px, max-content); align-items: center; gap: 5px; min-width: 0; padding: 2px 4px; border: 0; border-radius: 5px; background: transparent; color: var(--hr-muted); font-size: 11px; text-align: left; }
  .hr-dept-legend button:hover, .hr-dept-legend button[aria-pressed="true"] { background: var(--hr-tint); color: var(--hr-ink); }
  .hr-dept-legend button[aria-pressed="true"] { outline: 1px solid color-mix(in srgb, var(--hr-primary) 24%, transparent); }
  .hr-dept-legend button span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .hr-dept-legend button b { color: var(--hr-ink); }
  .hr-dept-legend button em { color: var(--hr-muted); font-style: normal; }
  .hr-dept-static { display: grid; grid-template-columns: 8px minmax(0, 1fr) max-content minmax(30px, max-content); align-items: center; gap: 5px; min-width: 0; padding: 2px 4px; color: var(--hr-muted); font-size: 11px; }
  .hr-dept-static span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .hr-dept-static b { color: var(--hr-ink); }
  .hr-dept-static em { color: var(--hr-muted); font-style: normal; }
  .hr-dept-dot { width: 7px; height: 7px; border-radius: 50%; }

  .hr-dashboard-todos, .hr-dashboard-ranks, .hr-demographics { display: grid; align-content: space-evenly; flex: 1; min-width: 0; margin: 0; padding: 0; }
  .hr-dashboard-todos { align-content: start; gap: 6px; }
  .hr-dashboard-todos button {
    display: grid;
    gap: 1px;
    min-width: 0;
    padding: 5px 7px;
    text-align: left;
    border: 1px solid var(--hr-line);
    border-radius: 6px;
    background: var(--hr-tint);
    color: var(--hr-ink);
    font-size: 11px;
  }
  .hr-dashboard-todos button span { color: var(--hr-muted); }
  .hr-dashboard-ranks li { display: grid; grid-template-columns: 20px minmax(0, 1fr) max-content; align-items: center; gap: 7px; font-size: 12px; }
  .hr-dashboard-ranks li div > span { display: block; color: var(--hr-muted); }
  .hr-dashboard-rank-number { display: grid; width: 18px; height: 18px; place-items: center; border-radius: 5px; background: var(--hr-tint); color: var(--hr-primary); font-size: 11px; font-weight: 700; }
  .hr-dashboard-ranks small { color: var(--hr-muted); font-size: 10px; font-weight: 400; }
  .hr-dashboard-ranks .hr-rank-track { height: 4px; margin: 3px 0 0; background: var(--hr-line); }
  .hr-dashboard-ranks .hr-rank-track i { background: var(--hr-primary); }

  .hr-demographics { gap: 3px; }
  .hr-demographic { display: grid; gap: 3px; padding: 3px 0; }
  .hr-demographic + .hr-demographic { border-top: 1px solid var(--hr-line); }
  .hr-demographic h3 { margin: 0; color: var(--hr-ink); font-size: 12px; }
  .hr-demographic-empty { color: var(--hr-muted); font-size: 11px; }
  .hr-demographic-bar { display: flex; height: 5px; overflow: hidden; border-radius: 3px; background: var(--hr-line); }
  .hr-demographic-bar i { flex-basis: 0; }
  .hr-demographic-legend { display: flex; flex-wrap: wrap; gap: 0 8px; color: var(--hr-muted); font-size: 10px; }
  .hr-demographic-legend span { white-space: nowrap; }
  .hr-demographic-legend span::before { content: ""; display: inline-block; width: 5px; height: 5px; vertical-align: 1px; margin-right: 3px; border-radius: 50%; background: var(--band-color); }
  .hr-demographic-legend b { color: var(--hr-ink); font-weight: 650; }

  .hr-dashboard-detail-link { border: 0; background: transparent; color: var(--hr-primary); font-size: 11px; padding: 4px 0; }
  .hr-dashboard [data-moves] .xm-ui-table-wrap { margin-top: 6px; }
  .hr-dashboard [data-moves] .xm-ui-table { table-layout: fixed; min-width: 0; font-size: 11px; }
  .xm-ui-scope .hr-dashboard [data-moves] .xm-ui-table :is(th, td) { height: 28px; padding: 4px 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; }
  .hr-dashboard [data-moves] .xm-ui-table :is(th, td):last-child { width: 85px; white-space: nowrap; }

  .hr-dashboard-recruit { display: flex; flex: 1; flex-direction: column; justify-content: center; gap: 7px; }
  .hr-dashboard-recruit-kpis { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; text-align: center; }
  .hr-dashboard-recruit-kpis > div, .hr-dashboard-funnel li { display: grid; gap: 1px; padding: 4px 1px; border-radius: 6px; background: var(--hr-tint); }
  .hr-dashboard-recruit-kpis span, .hr-dashboard-funnel span { color: var(--hr-muted); font-size: 11px; }
  .hr-dashboard-recruit-kpis b { font-size: 19px; line-height: 1.25; }
  .hr-dashboard-meter { height: 4px; border-radius: 3px; overflow: hidden; background: var(--hr-line); }
  .hr-dashboard-meter i { display: block; height: 100%; background: var(--hr-primary); }
  .hr-dashboard-funnel { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5px; list-style: none; margin: 0; padding: 0; }
  .hr-dashboard-funnel li { display: flex; align-items: center; justify-content: space-between; gap: 4px; padding: 5px 7px; }
  .hr-dashboard-funnel b { color: var(--hr-primary); }

  .hr-dashboard-dialog {
    width: min(850px, 92vw);
    max-height: 85dvh;
    margin: auto;
    padding: 0;
    border: 1px solid var(--hr-line);
    border-radius: 12px;
    background: var(--hr-surface);
    color: var(--hr-ink);
  }
  .hr-dashboard-dialog::backdrop { background: rgb(13 25 45 / 45%); }
  .hr-dashboard-dialog > header { position: sticky; z-index: 1; top: 0; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 16px; background: var(--hr-surface); border-bottom: 1px solid var(--hr-line); }
  .hr-dashboard-dialog h2 { margin: 0; font-size: 17px; }
  .hr-dashboard-dialog header button { width: 30px; height: 30px; border: 0; border-radius: 6px; background: var(--hr-tint); color: var(--hr-ink); font-size: 19px; }
  .hr-dashboard-dialog [data-dashboard-dialog-body] { padding: 12px 16px 16px; }
  .hr-dashboard-names { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; padding: 0; list-style: none; }
  .hr-dashboard-names li { padding: 4px 9px; border-radius: 5px; background: var(--hr-tint); }
  html[data-theme="dark"] .hr-dashboard .xm-ui-table th,
  html[data-theme="dark"] .hr-dashboard .xm-ui-table td { background: var(--hr-surface); border-color: var(--hr-line); color: var(--hr-ink); }

  @media (max-height: 800px) {
    .hr-dashboard { gap: 8px; padding-top: 6px; }
    .hr-dashboard-context { padding-block: 5px; }
    .hr-dashboard-head h1 { font-size: 20px; }
    .xm-ui-scope .hr-dashboard .xm-ui-stat-card { min-height: 65px; padding-block: 6px; }
    .xm-ui-scope .hr-dashboard .xm-ui-stat-card__value { font-size: 22px; }
    .hr-dashboard-grid { grid-template-rows: minmax(155px, 1.08fr) minmax(170px, 1fr); gap: 8px; }
    .xm-ui-scope .hr-dashboard-slot .xm-ui-section-title { min-height: 32px; padding-block: 6px; }
    .xm-ui-scope .hr-dashboard-slot .xm-ui-section-title::before { inset-block: 8px; }
    .xm-ui-scope .hr-dashboard-slot .xm-ui-card__body { padding-bottom: 7px; }
    .hr-dashboard .hr-legend { gap: 1px; }
    .hr-dashboard .hr-donut { max-width: 106px; }
    .hr-dashboard-chart { margin-top: 10px; grid-template-rows: minmax(59px, 1fr) auto; }
    .hr-demographic { gap: 2px; padding-block: 2px; }
    .xm-ui-scope .hr-dashboard [data-moves] .xm-ui-table :is(th, td) { height: 23px; padding-block: 2px; }
  }

  @media (max-height: 700px) {
    .hr-page:has(.hr-dashboard) { padding-block: 4px 8px; }
    .hr-page:has(.hr-dashboard) .hr-top { margin-bottom: 3px; }
    .hr-page:has(.hr-dashboard) .hr-tab { padding-inline: 9px; font-size: 12px; }
    .hr-page:has(.hr-dashboard) .hr-refresh { padding-bottom: 4px; }
    .hr-page:has(.hr-dashboard) .hr-updated { font-size: 11px; }
    .hr-dashboard { gap: 6px; padding-top: 4px; }
    .hr-dashboard-range { padding-block: 0; }
    .xm-ui-scope .hr-dashboard .xm-ui-stat-card { padding-block: 5px; }
    .xm-ui-scope .hr-dashboard .xm-ui-stat-card__label { line-height: 1.25; }
    .xm-ui-scope .hr-dashboard .xm-ui-stat-card__note { line-height: 1.2; }
    .hr-dashboard-grid { grid-template-rows: minmax(145px, 1.05fr) minmax(172px, 1fr); }
    .hr-dashboard-todos { gap: 4px; }
    .hr-dashboard-todos button { padding-block: 4px; line-height: 1.25; }
    .hr-demographics { gap: 1px; }
    .hr-demographic { gap: 2px; padding-block: 1px; }
    .hr-demographic h3 { line-height: 14px; }
    .hr-demographic-bar { height: 4px; }
    .hr-demographic-legend { line-height: 12px; }
  }

  @container hr-page (max-width: 1120px) {
    .hr-page:has(.hr-dashboard) .hr-top { gap: 6px; }
    .hr-page:has(.hr-dashboard) .hr-tab { padding-inline: 7px; font-size: 12px; }
    .hr-page:has(.hr-dashboard) .hr-refresh { flex: 0 1 auto; min-width: 0; gap: 6px; }
    .hr-page:has(.hr-dashboard) .hr-updated[data-usage] { white-space: normal; line-height: 1.25; }
  }
  @container hr-page (max-width: 850px) {
    .hr-page:has(.hr-dashboard) .hr-top { flex-wrap: wrap; }
    .hr-page:has(.hr-dashboard) .hr-tabs { width: 100%; }
    .hr-page:has(.hr-dashboard) .hr-refresh { flex-wrap: wrap; }
  }
  @container hr-page (max-width: 720px) {
    .hr-dashboard-context { align-items: flex-start; flex-direction: column; }
    .hr-dashboard-filters { width: 100%; justify-content: flex-start; }
    .hr-dashboard-filters [data-dept-filters] { overflow-x: auto; padding-bottom: 1px; }
  }
  @container hr-board (max-width: 998px) {
    .hr-dashboard-grid { flex: 0 0 auto; grid-template-columns: repeat(12, minmax(0, 1fr)); grid-template-rows: none; grid-auto-rows: minmax(210px, auto); }
    .hr-dashboard-grid .hr-dashboard-slot { grid-column: span 6; }
    .hr-dashboard-grid [data-trend-card] { grid-column: span 12; }
  }
  @container hr-board (max-width: 650px) {
    .hr-dashboard-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .hr-dashboard-grid .hr-dashboard-slot { grid-column: span 12; }
    .hr-dashboard-range { margin-left: 0; }
  }
  @container hr-board (max-width: 360px) {
    .hr-dashboard-kpis { grid-template-columns: minmax(0, 1fr); }
    .hr-dashboard .hr-donut { flex-basis: 28%; width: 28%; }
    .hr-dashboard-chart { margin-top: 13px; }
  }
    `;
    document.head.appendChild(dashboardStyle);
  }
var state={tab:"attendance",ticket:0,alive:!0};function n(t){if(state.alive&&t.target&&t.target.closest){var a=t.target.closest(".hr-tab");if(!a&&"xm-notice-mask"===t.target.id)for(var r=e.querySelectorAll(".hr-tab"),n=0;n<r.length;n++){var o=r[n].getBoundingClientRect();t.clientX>=o.left&&t.clientX<=o.right&&t.clientY>=o.top&&t.clientY<=o.bottom&&(a=r[n])}a&&e.contains(a)&&I(e,state,a.getAttribute("data-tab"))}}return e.innerHTML='<div class="xm-page hr-page xm-ui-scope"><div class="hr-top"><div class="hr-tabs" role="tablist" aria-label="智能人事">'+t.map((function(t,e){var r=0===e;return'<button type="button" class="hr-tab" role="tab" data-tab="'+t.id+'" aria-selected="'+(r?"true":"false")+'" tabindex="'+(r?"0":"-1")+'">'+a(t.label)+"</button>"})).join("")+'</div><div class="hr-refresh"><span class="hr-updated" data-usage>本月用量读取中</span><span class="hr-updated" data-updated>尚未更新</span><button type="button" class="hr-primary" data-act="refresh-board">刷新数据</button></div></div><div class="hr-body" role="tabpanel"></div></div>',p(e,state.tab,r().slice(0,7),r()),window.addEventListener("click",n,!0),e.addEventListener("click",(function(t){if(state.tab==="attendance"&&state.view&&handleDashboardAction(e,state.view,t.target))return;var a=t.target.closest("button[data-recruit-view],button[data-recruit-page],button[data-act='recruit-new'],button[data-act='onboard-new'],button[data-act='recruit-reset']");if(a&&e.contains(a)&&"recruit"===state.tab){if(t.preventDefault(),a.hasAttribute("data-recruit-view")&&(e.setAttribute("data-recruit-view",a.getAttribute("data-recruit-view")||"list"),e.setAttribute("data-recruit-page","1")),a.hasAttribute("data-recruit-page")){var n=Number(a.getAttribute("data-recruit-page"));n>=1&&e.setAttribute("data-recruit-page",String(n))}if("recruit-reset"===a.getAttribute("data-act")){["data-recruit-position","data-recruit-channel","data-recruit-stage","data-recruit-page"].forEach((function(t){e.removeAttribute(t)}));var i=e.querySelector("[data-recruit-q]");i&&(i.value="")}if("recruit-new"===a.getAttribute("data-act")||"onboard-new"===a.getAttribute("data-act")){var l=e.querySelector("form[data-form='"+("onboard-new"===a.getAttribute("data-act")?"onboard":"recruit")+"']");l&&(l.hidden=!1,l.scrollIntoView&&l.scrollIntoView())}state.view&&recruitFill(e,state.view)}else{var d=t.target.closest("button[data-staff-view],button[data-staff-page],button[data-staff-open],button[data-act='staff-new'],button[data-act='staff-reset'],button[data-act='staff-query']");if(d&&e.contains(d)&&"staff"===state.tab){if(t.preventDefault(),d.hasAttribute("data-staff-view")&&(e.setAttribute("data-staff-view",d.getAttribute("data-staff-view")||"list"),e.setAttribute("data-staff-page","1")),d.hasAttribute("data-staff-open")&&(e.setAttribute("data-staff-open",d.getAttribute("data-staff-open")||""),e.setAttribute("data-staff-view","file")),d.hasAttribute("data-staff-page")){var s=Number(d.getAttribute("data-staff-page"));s>=1&&e.setAttribute("data-staff-page",String(s))}if("staff-reset"===d.getAttribute("data-act")){["data-staff-dept","data-staff-state","data-staff-level","data-staff-from","data-staff-to","data-staff-page"].forEach((function(t){e.removeAttribute(t)}));var c=e.querySelector("[data-staff-search]");c&&(c.value="")}if("staff-new"===d.getAttribute("data-act")){var p=e.querySelector("form[data-form='staff']");p&&(p.hidden=!1,P(p,null),p.scrollIntoView&&p.scrollIntoView())}state.view&&S(e,state.view)}else{var f=t.target.closest("button[data-clock-view],button[data-clock-page],button[data-act='clock-reset'],button[data-act='clock-query'],button[data-act='clock-export']");if(f&&e.contains(f)&&state.view&&"clock"===state.tab){if(t.preventDefault(),f.hasAttribute("data-clock-view")&&(e.setAttribute("data-clock-view",f.getAttribute("data-clock-view")||"detail"),e.setAttribute("data-clock-page","1")),f.hasAttribute("data-clock-page")){var h=Number(f.getAttribute("data-clock-page"));h>=1&&e.setAttribute("data-clock-page",String(h))}if("clock-reset"===f.getAttribute("data-act")&&["data-clock-q","data-clock-dept","data-clock-status","data-clock-from","data-clock-to","data-clock-page"].forEach((function(t){e.removeAttribute(t)})),"clock-export"===f.getAttribute("data-act")){var m=z(e,state.view).rows.map((function(t){return[t.name,t.job,t.dept,t.date,String(t.on||"").slice(11,16),String(t.off||"").slice(11,16),t.hours,t.status].map(j).join(",")}));return void H("考勤明细.csv",["姓名","工号","部门","日期","上班","下班","时长","状态"].join(",")+"\n"+m.join("\n"))}q(e,state.view)}else{var g=t.target.closest("[data-org-dept],[data-org-view],[data-org-fold],[data-org-zoom]");if(g&&e.contains(g)&&state.view&&"org"===state.tab){if(t.preventDefault(),g.hasAttribute("data-org-zoom")){var b=g.getAttribute("data-org-zoom"),v=Number(e.getAttribute("data-org-zoom")||"100"),x="in"===b?Math.min(140,v+20):Math.max(60,v-20);e.setAttribute("data-org-zoom",String(x))}return["data-org-dept","data-org-view","data-org-fold"].forEach((function(t){g.hasAttribute(t)&&e.setAttribute(t,g.getAttribute(t)||"")})),void C(e,state.view)}var k=t.target.closest("[data-act='org-new']");if(k&&e.contains(k))return t.preventDefault(),void u(e,"部门来自花名册。在员工管理里填写部门，这里就会多出一个部门。",!1);var A=t.target.closest("[data-act='org-add']");if(A&&e.contains(A))return t.preventDefault(),void I(e,state,"staff");var M=t.target.closest("[data-act='org-export']");if(M&&e.contains(M)&&state.view)t.preventDefault(),m=E(e,state.view).rows.map((function(t){return[t.name,t.jobNumber,t.position,t.department,t.joinedOn,t.status].map(j).join(",")})),H("组织架构.csv",["姓名","工号","岗位","部门","入职日期","状态"].join(",")+"\n"+m.join("\n"));else{var F=t.target.closest("[data-act='refresh-board']");if(F&&e.contains(F)){if(t.preventDefault(),F.disabled)return;var V=r();return F.disabled=!0,F.textContent="正在拉取",void o("/api/hr/sync",{method:"POST",body:{date:V}}).then((function(t){!function(t,e){var a=t.querySelector("[data-updated]");a&&e&&(a.textContent=String(e).replace("T"," ").slice(0,16))}(e,t.updatedAt),state.home={},state.clocks={},state.effort={},"attendance"!==state.tab&&"clock"!==state.tab&&"pay"!==state.tab&&"overtime"!==state.tab||D(e,state),u(e,t.paused?"钉钉调用已暂停，先看已留档的数据":!1===t.configured?"钉钉还没配置":"已刷新 "+V,!1)})).catch((function(t){u(e,t.message,!0)})).then((function(){F.disabled=!1,F.textContent="刷新数据"}))}var B=t.target.closest("[data-act='download']");if(B&&e.contains(B))return t.preventDefault(),void(state.view&&function(t){var e=["姓名,部门,工号,角色,组织姓名,月累计"];(t.people||[]).forEach((function(t){e.push([t.name,t.department,t.jobNumber,t.role,t.orgName,t.hours].map(j).join(","))})),e.push(""),e.push("姓名,日期,下班,时长"),(t.people||[]).forEach((function(t){(t.days||[]).forEach((function(a){e.push([t.name,a.date,String(a.offAt||"").slice(11,16),a.hours].map(j).join(","))}))}));var a=new Blob(["\ufeff"+e.join("\n")],{type:"text/csv;charset=utf-8"}),r=document.createElement("a");r.href=URL.createObjectURL(a),r.download="奋斗时长-"+(t.month||"全部")+".csv",document.body.appendChild(r),r.click(),r.remove(),setTimeout((function(){URL.revokeObjectURL(r.href)}),1e3)}(state.view));var Y=t.target.closest("[data-act='bind']");if(Y&&e.contains(Y)){t.preventDefault();var X=Y.closest("[data-link]"),J=X&&X.querySelector("[data-pick-person]"),Q=X&&X.querySelector("[data-pick-user]"),G=Y.getAttribute("data-person")||(J?J.value:""),Z=Y.getAttribute("data-user")||(Q?Q.value:"");o("/api/hr/links",{method:"POST",body:{personId:Number(G),dingtalkUserId:Z}}).then((function(){state.effort={},D(e,state)})).catch((function(t){u(e,t.message,!0)}))}else{var $=t.target.closest("[data-act='unbind']");if($&&e.contains($))return t.preventDefault(),void o("/api/hr/links/"+encodeURIComponent($.getAttribute("data-person")),{method:"DELETE"}).then((function(){state.effort={},D(e,state)})).catch((function(t){u(e,t.message,!0)}));var _=t.target.closest("[data-watch-open]");if(_&&e.contains(_)){t.preventDefault();var K=_.getAttribute("data-watch-open");return e.setAttribute("data-watch",e.getAttribute("data-watch")===K?"":K),void(state.view&&w(e,state.view))}if((dt=t.target.closest("[data-effort]"))&&e.contains(dt)){t.preventDefault();var W=dt.getAttribute("data-effort");return e.setAttribute("data-open",e.getAttribute("data-open")===W?"":W),void(state.view&&w(e,state.view))}if(handleStaffTemplateAction(e,t))return;if((at=t.target.closest("[data-act='staff-pick']"))&&e.contains(at)){t.preventDefault();var et=e.querySelector("[data-staff-file]");et&&et.click()}else{var at;if((at=t.target.closest("[data-staff-pick]"))&&e.contains(at)){t.preventDefault();var rt=at.getAttribute("data-staff-pick");return e.setAttribute("data-staff-pick",e.getAttribute("data-staff-pick")===rt?"":rt),void(state.view&&S(e,state.view))}var nt=t.target.closest("[data-act='staff-sync']");if(nt&&e.contains(nt))return t.preventDefault(),nt.disabled=!0,void o("/api/hr/staff/sync",{method:"POST",body:{}}).then((function(t){u(e,t.added?"已从打卡带入 "+t.added+" 人，请在待同步中核对":"打卡里的运营人员都已经在花名册里",!1),D(e,state)})).catch((function(t){u(e,t.message,!0)})).then((function(){nt.disabled=!1}));var ot=t.target.closest("[data-act='join']");if(ot&&e.contains(ot))return t.preventDefault(),ot.disabled=!0,void o("/api/hr/recruits/"+encodeURIComponent(ot.getAttribute("data-id"))+"/join",{method:"POST",body:{}}).then((function(t){u(e,t.already?"已经登记过入职":"已登记入职，已写入员工管理的在职人员",!1),D(e,state)})).catch((function(t){u(e,t.message,!0),ot.disabled=!1}));var it=t.target.closest("[data-act='staff-edit']");if(it&&e.contains(it)){t.preventDefault();var lt=Number(it.getAttribute("data-id")),dt=(state.view&&state.view.staff||[]).filter((function(t){return Number(t.id)===lt}))[0],st=e.querySelector("form[data-form='staff']");dt&&st&&(st.hidden=!1,P(st,dt),st.scrollIntoView&&st.scrollIntoView())}else{var ct=t.target.closest("[data-act='delete']");if(ct&&e.contains(ct)&&window.confirm(ct.getAttribute("data-kind")==="staff"?"从组织中心和智能人事员工名单删除？办理离职请编辑在职状态。":"删除这条记录？")){var ut=ct.getAttribute("data-kind");o("/api/hr"+("onboard"===ut?"/onboards/":ut.startsWith("staff")?"/staff/":"/recruits/")+ct.getAttribute("data-id"),{method:"DELETE"}).then((function(){D(e,state)})).catch((function(t){u(e,t.message,!0)}))}}}}}}}}})),bindStaffInline(e,state),e.addEventListener("submit",(function(t){var a=t.target.closest("form[data-form]");if(a&&e.contains(a)){t.preventDefault();var n=a.getAttribute("data-form"),i=e.querySelector("[data-join-month]"),l=i&&i.value?i.value:r().slice(0,7),d=r(),s=a.getAttribute("data-staff-id"),c="staff"===n?staffFormBody(a,(state.view?.staff||[]).find(person=>String(person.id)===s)):"onboard"===n?{name:L(a,"name"),gender:L(a,"gender"),department:L(a,"department"),position:L(a,"position"),joinedOn:L(a,"joinedOn"),phone:L(a,"phone"),hometown:L(a,"hometown"),channel:L(a,"channel"),inviter:L(a,"inviter"),note:L(a,"note"),detail:L(a,"detail")}:{name:L(a,"name"),gender:L(a,"gender"),position:L(a,"position"),expectedJoin:L(a,"expectedJoin"),phone:L(a,"phone"),hometown:L(a,"hometown"),channel:L(a,"channel"),inviter:L(a,"inviter"),note:L(a,"note"),detail:L(a,"detail"),recordDate:d.slice(0,7)===l?d:l+"-01"},p=a.querySelector("button[type='submit']");p&&(p.disabled=!0),o("/api/hr"+("staff"===n?s?"/staff/"+encodeURIComponent(s):"/staff":"onboard"===n?"/onboards":"/recruits"),{method:"staff"===n&&s?"PUT":"POST",body:c}).then((function(){a.reset(),"staff"===n&&(a.hidden=!0,P(a,null)),("recruit"===n||"onboard"===n)&&(a.hidden=!0),u(e,"已保存",!1),D(e,state)})).catch((function(t){u(e,t.message,!0)})).then((function(){p&&(p.disabled=!1)}))}})),e.addEventListener("input",(function(t){t.target&&state.view&&(t.target.matches("[data-staff-search]")&&S(e,state.view),t.target.matches("[data-recruit-q]")&&(e.setAttribute("data-recruit-page","1"),T(e,state.view)),t.target.matches("[data-org-q]")&&(e.setAttribute("data-org-q",t.target.value),C(e,state.view)),t.target.matches("[data-org-person]")&&(e.setAttribute("data-org-person",t.target.value),C(e,state.view)),t.target.matches("[data-clock-q]")&&(e.setAttribute("data-clock-q",t.target.value),e.setAttribute("data-clock-page","1"),q(e,state.view)))})),e.addEventListener("change",(function(t){var a=t.target;if(a&&e.contains(a))if(a.matches("[data-month], [data-range], [data-join-month], [data-clock-day]"))D(e,state);else{if(a.matches("[data-recruit-position],[data-recruit-channel],[data-recruit-stage]"))return e.setAttribute(a.hasAttribute("data-recruit-position")?"data-recruit-position":a.hasAttribute("data-recruit-channel")?"data-recruit-channel":"data-recruit-stage",a.value),e.setAttribute("data-recruit-page","1"),void(state.view&&"recruit"===state.tab&&T(e,state.view));if(a.matches("[data-staff-dept],[data-staff-state],[data-staff-level],[data-staff-from],[data-staff-to]"))return e.setAttribute(a.hasAttribute("data-staff-dept")?"data-staff-dept":a.hasAttribute("data-staff-state")?"data-staff-state":a.hasAttribute("data-staff-level")?"data-staff-level":a.hasAttribute("data-staff-from")?"data-staff-from":"data-staff-to",a.value),e.setAttribute("data-staff-page","1"),void(state.view&&"staff"===state.tab&&S(e,state.view));if(a.matches("[data-clock-dept],[data-clock-status],[data-clock-from],[data-clock-to]"))return e.setAttribute(a.hasAttribute("data-clock-dept")?"data-clock-dept":a.hasAttribute("data-clock-status")?"data-clock-status":a.hasAttribute("data-clock-from")?"data-clock-from":"data-clock-to",a.value),e.setAttribute("data-clock-page","1"),void(state.view&&"clock"===state.tab&&q(e,state.view));if(a.matches("[data-org-status]"))return e.setAttribute("data-org-status",a.value),void(state.view&&C(e,state.view));if(a.matches("[data-org-pos]"))return e.setAttribute("data-org-pos",a.value),void(state.view&&C(e,state.view));if(a.matches("[data-org-move]")){var r=Number(a.getAttribute("data-org-move")),n=a.value;if(!r||!n||!state.view)return;o("/api/hr/staff/"+encodeURIComponent(r),{method:"PUT",body:{department:n,replace:!1}}).then((function(t){var a=(state.view.staff||[]).filter((function(t){return Number(t.id)===r}))[0];a&&(a.department=t.staff&&t.staff.department||n),u(e,"已调整部门",!1),C(e,state.view)})).catch((function(t){u(e,t.message,!0),D(e,state)}))}else if(a.matches("[data-staff-profile]")){e.setAttribute("data-staff-open",a.value);if(state.view)S(e,state.view)}else{if(a.matches("[data-staff-file],[data-staff-leave-file]")){var f=a.files&&a.files[0];a.value="";if(f)importStaffFile(e,state,f,a.hasAttribute("data-staff-leave-file"))}else a.matches("[data-staff-status]")&&o("/api/hr/staff/"+encodeURIComponent(a.getAttribute("data-id")),{method:"PUT",body:{status:a.value,replace:!1}}).then((function(){u(e,"已保存",!1);D(e,state)})).catch((function(t){u(e,t.message,!0)}))}}})),o("/api/hr/status").then((function(status){var slot=e.querySelector("[data-usage]");if(!slot||!status||!status.usage)return;var usage=status.usage,text=(usage.months||[]).map((function(row){return row.month+" "+row.total+"/"+row.cap})).join("，");slot.textContent=(text||"本月还没有用量")+(usage.paused?"，调用已暂停":"")+"。每月到 "+(usage.stopAt||9000)+" 自动停，避免超过 "+(usage.cap||10000)})).catch((function(){})),D(e,state),function(){state.alive=!1,stopOrgConnections(e),window.removeEventListener("click",n,!0),e.innerHTML=""}},unmount:function(){}})}();
