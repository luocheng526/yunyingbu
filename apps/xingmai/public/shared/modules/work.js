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
  badges: { todo: 0, mine: 0, review: 0 },
  openTask: "",
  badgeTimer: 0,
  duty: null,
  diarySettings: null,
  meta: null,
  report: null,
  settings: null,
  msg: "",
  error: false,
  saving: false,
  compose: false
 };

 function esc(value) {
  return String(value == null ? "" : value)
   .replace(/&/g, "&amp;")
   .replace(/</g, "&lt;")
   .replace(/>/g, "&gt;")
   .replace(/"/g, "&quot;");
 }

 function xm() {
  return window.XmUI;
 }

 function uiButton(label, attrs, options) {
  var item = { label: label, size: "small", type: "button" };
  if (options) {
   Object.keys(options).forEach(function (key) {
    item[key] = options[key];
   });
  }
  var html = xm().button(item);
  return attrs ? html.replace("<button ", "<button " + attrs + " ") : html;
 }

 function uiCard(title, content, description) {
  return xm().ContentCard({ title: title || "", description: description || "", content: content || "" });
 }

 function uiEmpty(title, description) {
  return xm().EmptyState({ title: title || "暂无数据", description: description || "" });
 }

 function uiBadge(label, tone) {
  return xm().StatusBadge({ label: label, tone: tone || "neutral" });
 }

 function statusTone(status) {
  if (status === "已报" || status === "已完成" || status === "已提交" || status === "已交") return "success";
  if (status === "未报" || status === "已退回") return "danger";
  if (status === "待检查" || status === "待核对" || status === "进行中") return "warning";
  if (status === "免报" || status === "自愿" || status === "自愿填报") return "purple";
  return "blue";
 }

 function uiTab(id, label, active, extra) {
  var token = id === "" || id == null ? "all" : String(id);
  var bar = xm().FilterToolbar({
   tabs: [{ label: label, value: token, active: Boolean(active) }],
   search: false
  });
  var button = (bar.match(/<button class="xm-ui-tab[\s\S]*?<\/button>/) || [""])[0];
  return button.replace('data-xm-ui-tab="' + token + '"', 'data-xm-ui-tab="' + esc(token) + '" ' + (extra || ""));
 }

 function uiTabs(buttons) {
  return '<div class="xm-ui-filter-toolbar"><div class="xm-ui-tabs" role="tablist">' + buttons + "</div></div>";
 }

 function ensureStyle() {
  var style = document.getElementById("work-page-style");
  if (style && style.getAttribute("data-rev") === "xmui1") {
   return;
  }
  if (!style) {
   style = document.createElement("style");
   style.id = "work-page-style";
   document.head.appendChild(style);
  }
  style.setAttribute("data-rev", "xmui1");
  style.textContent =
   ".work-page.xm-ui-scope{padding:24px 28px 32px;min-height:100%}.work-page .xm-ui-filter-toolbar,.work-page .xm-ui-stat-grid{margin-bottom:16px}.work-page .work-stack{display:grid;gap:16px}.work-page .work-form,.work-page .work-tools,.work-page .work-filters,.work-page .work-checks{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end}.work-page .work-field{display:flex;flex-direction:column;gap:4px;min-width:140px;color:var(--xm-ui-text-secondary);font-size:12px}.work-page .work-field input,.work-page .work-field select,.work-page .work-field textarea{border:1px solid var(--xm-ui-border-strong);border-radius:8px;background:var(--xm-ui-surface);color:var(--xm-ui-text);font:inherit}.work-page .work-field input,.work-page .work-field select{height:34px;padding:0 10px}.work-page .work-field textarea,.work-page .xm-ui-table textarea{min-height:72px;width:100%;padding:8px 10px;box-sizing:border-box}.work-page .work-field.is-grow{flex:1;min-width:200px}.work-page .work-msg{min-height:18px;margin:0 0 12px;color:var(--xm-ui-text-secondary);font-size:13px}.work-page .work-msg.is-error{color:var(--xm-ui-red)}.work-page .work-lead,.work-page .work-muted,.work-page .work-sub{color:var(--xm-ui-text-muted);font-size:12px}.work-page .work-filler strong{margin-left:4px;color:var(--xm-ui-text)}.work-page .work-context{display:flex;align-items:center;flex-wrap:wrap;gap:10px 22px}.work-page .work-context .work-field{flex-direction:row;align-items:center}.work-page .xm-ui-tab{position:relative}.work-page .xm-ui-tab [data-work-count]{margin-left:6px}.work-page .work-sheet{min-width:0}.work-page .work-storebar,.work-page .work-storetitle,.work-page .work-storeactions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.work-page .work-storebar{justify-content:space-between;margin-bottom:12px}.work-page .work-groups{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px}.work-page .work-lanes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.work-page .work-lanes.is-single{grid-template-columns:minmax(0,1fr)}.work-page .work-item-line{min-height:52px;display:grid;align-items:center;column-gap:8px;grid-template-columns:minmax(0,1fr) minmax(62px,92px) auto}.work-page .work-metric-num{display:flex;align-items:center;gap:6px}.work-page .work-metric-num input{width:72px;height:34px;border:1px solid var(--xm-ui-border-strong);border-radius:8px;padding:0 8px;font:inherit}.work-page .work-diary-more{display:grid;gap:10px;margin:0 0 12px}.work-page .work-diary-more[hidden]{display:none}.work-page .work-orders{display:grid;grid-template-columns:minmax(200px,.8fr) minmax(0,1.2fr);gap:16px}.work-page .work-shot{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.work-page .work-shot img{max-width:148px;max-height:72px;object-fit:cover;border-radius:8px}.work-page .work-submitbar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:12px}.work-page .work-guide{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.work-page .work-guide b,.work-page .work-guide small{display:block}.work-page .work-guide small{color:var(--xm-ui-text-muted)}.work-page .work-modal{position:fixed;inset:0;z-index:40;display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;overflow:auto;background:rgba(16,24,40,.36)}.work-page .work-dialog{width:min(920px,100%)}.work-page .work-sum-split{display:grid;grid-template-columns:minmax(180px,.7fr) minmax(280px,1.6fr);gap:16px}.work-page .work-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.work-page .work-row .work-main{flex:1;min-width:180px;color:var(--xm-ui-text-secondary)}@media(max-width:980px){.work-page .work-lanes,.work-page .work-orders,.work-page .work-sum-split,.work-page .work-guide{grid-template-columns:1fr}}.xm-work-badge{position:absolute;top:2px;right:8px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:#e23b3b;color:#fff;font:700 11px/16px inherit;text-align:center}.work-page .work-check{display:flex;align-items:center;gap:6px;height:34px;margin:0;color:var(--xm-ui-text);font-size:13px;white-space:nowrap}.work-page .work-check input{width:16px;height:16px;margin:0}";
 }

 function oops(root) {
  return function (err) {
   setMsg(err.message, true);
   paint(root);
  };
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
  return uiTab(String(value), label, current === value, attr + '="' + esc(value) + '"');
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

 function rosterSeatParts(person) {
  return String((person && person.seat) || "")
   .split("、")
   .map(function (item) {
    return item.trim();
   })
   .filter(Boolean);
 }

 function rosterDefaultSeat(person) {
  var parts = rosterSeatParts(person);
  return parts.indexOf("运营") >= 0 || parts.indexOf("助理") >= 0;
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
   return uiCard("", uiEmpty("没有待办", "今天的日报已经提交，或今天不用交。"));
  }
  return uiCard(
   "待办事项",
   '<div class="work-row"><strong>日报</strong>' + uiBadge("今天", "danger") + '<span class="work-main">今天的日报还没提交</span>' + uiButton("去填写", "data-todo-go") + "</div>"
  );
 }

 function kpi(index, value, label) {
  var tones = ["blue", "green", "orange", "purple", "blue", "orange"];
  var icons = ["users", "check", "file", "award", "chart", "file"];
  return xm().StatCard({
   label: label,
   value: String(value),
   icon: icons[index] || "chart",
   tone: tones[index] || "blue"
  });
 }

 function renderFillTable(row, editable) {
  if (!row || !(row.items || []).length) {
   return uiEmpty("今天没有需要填的事项。", "还没有事项，请罗成在部门设置里配模板。");
  }
  return xm().DataTable({
   columns: [
    { key: "label", label: "工作事项" },
    {
     key: "content",
     label: "今日工作",
     render: function (value, item) {
      if (!editable) return esc(value || "—");
      return '<textarea data-item-key="' + esc(item.key) + '" placeholder="写今天这项做了什么">' + esc(value) + "</textarea>";
     }
    }
   ],
   rows: row.items
  });
 }

 function renderAdminTable(date) {
  var rows = (state.report && state.report.rows) || [];
  if (!rows.length) {
   return uiCard("", uiEmpty("这一天还没有人需要汇报。"));
  }
  var visible = reportRows();
  if (!visible.length) {
   return uiCard("", uiEmpty("没有符合筛选的人。"));
  }
  var flat = [];
  visible.forEach(function (row) {
   (row.items || [{ label: "—", content: "" }]).forEach(function (item) {
    flat.push({
     name: row.person.name,
     dept: row.deptName,
     role: row.person.role,
     center: row.person.center,
     duty: boardDuty(row.person),
     item: item.label,
     content: item.content || "—",
     status: row.status,
     note: row.statusNote || ""
    });
   });
  });
  return uiCard(
   "当天汇报",
   xm().DataTable({
    columns: [
     { key: "name", label: "姓名" },
     { key: "dept", label: "部门" },
     { key: "role", label: "岗位" },
     { key: "center", label: "所属中心" },
     { key: "duty", label: "责权" },
     { key: "item", label: "工作事项" },
     { key: "content", label: dateLabel(date) },
     {
      key: "status",
      label: "状态",
      render: function (value, row) {
       return uiBadge(value, statusTone(value)) + (row.note ? '<span class="work-sub">' + esc(row.note) + "</span>" : "");
      }
     }
    ],
    rows: flat
   })
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
      uiButton("查看截图 · " + (image.name || ""), 'data-preview-image="' + esc(image.id) + '"', { variant: "secondary" }) +
      uiButton("移除", 'data-remove-image="' + esc(image.id) + '"', { variant: "secondary" })
     );
    })
    .join("") +
   '<label class="xm-ui-button xm-ui-button--secondary xm-ui-button--small">添加截图<input data-diary-file type="file" accept="image/png,image/jpeg,image/webp" hidden></label></div>'
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
  return uiCard(
   "店铺日报",
   '<div class="work-sheet"><div class="work-storebar"><div class="work-storetitle"><div><small>填写店铺</small>' +
   shopTitle +
   "</div>" +
   (draft ? uiBadge(draft.status || "未填报", statusTone(draft.status || "未填报")) : "") +
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
    ? uiButton("移出", 'data-remove-shop="' + esc(state.diaryShop) + '"', { variant: "secondary" })
    : "") +
   "</div></div>" +
   uiTabs(
    sections
     .map(function (section) {
      return uiTab(section.id, section.name, section.id === state.diaryGroup, 'data-diary-group="' + esc(section.id) + '" aria-pressed="' + (section.id === state.diaryGroup) + '"');
     })
     .join("")
   ) +
   '<div class="work-section"><div class="work-lanes' +
   (lanes.length === 1 ? " is-single" : "") +
   '">' +
   fields +
   "</div></div>" +
   '<footer class="work-submitbar"><strong>本次填报：' +
   state.diaryOpen.length +
   ' 家店</strong><div class="work-filters">' + uiButton("保存草稿", 'data-diary-save="草稿"', { variant: "secondary" }) + uiButton("提交日报", 'data-diary-save="已提交"') + "</div></footer></div>"
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
     uiButton("查看截图 · " + (image.name || ""), 'data-preview-image="' + esc(image.id) + '"', { variant: "secondary" })
    );
   })
   .join("");
 }

 function summaryTable(headers, rows) {
  return (
   '<div class="xm-ui-table-wrap"><table class="xm-ui-table"><thead><tr>' +
   headers.map(function (header) { return "<th>" + esc(header) + "</th>"; }).join("") +
   "</tr></thead><tbody>" +
   (rows || '<tr><td colspan="' + headers.length + '">暂无明细</td></tr>') +
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
     : "<p>暂无明细</p>") +
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
   '<div class="work-modal"><div class="work-dialog" role="dialog">' +
   uiCard(title, body + uiButton("关闭", "data-summary-close", { variant: "secondary" })) +
   "</div></div>"
  );
 }

 function renderSummary() {
  var data = state.summary;
  if (!data) {
   return uiCard("", uiEmpty("正在读取工作汇总"));
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
  function bars(groups) {
   if (!groups.length) {
    return uiEmpty("暂无明细");
   }
   return groups
    .map(function (group) {
     return uiCard(group.name, '<div class="work-row">' + uiBadge("日报 " + group.rows.length, "blue") + '<span class="work-main">' + esc(bits(group)) + "</span></div>");
    })
    .join("");
  }
  var cards = metrics
   .map(function (metric) {
    var total = rows.length ? metricTotal(rows, metric.id) : "—";
    return xm().StatCard({ label: metric.name, value: String(total), icon: "chart", tone: "blue" }).replace(
     "</article>",
     uiButton("查看", 'data-summary-metric="' + esc(metric.id) + '"', { variant: "secondary" }) + "</article>"
    );
   })
   .join("");
  var diaries = rows
   .map(function (row, index) {
    return uiCard(
     row.day,
     '<div class="work-row"><span class="work-main">' + esc(row.personName) + " · " + esc(row.shopName) + "</span>" + uiButton("查看详情", 'data-summary-report="' + index + '"', { variant: "secondary" }) + "</div>"
    );
   })
   .join("");
  return (
   '<div class="work-stack">' +
   uiCard(
    "汇总筛选",
    uiTabs(
     uiTab("今天", "今天", false, 'data-summary-period="今天"') +
      uiTab("昨天", "昨天", false, 'data-summary-period="昨天"') +
      uiTab("近7天", "近7天", false, 'data-summary-period="近7天"') +
      uiTab("本月", "本月", false, 'data-summary-period="本月"')
    ) +
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
     '"></label>' +
     uiButton("查询", "data-summary-query") +
     "</div>"
   ) +
   '<div class="xm-ui-stat-grid">' +
   kpi(0, rows.length, "已交日报") +
   kpi(1, Object.keys(peopleCount).length, "已报人数") +
   kpi(4, Object.keys(shopCount).length, "店铺数") +
   "</div>" +
   '<div class="xm-ui-stat-grid">' +
   cards +
   "</div>" +
   uiCard("按人员汇总", bars(groupSummary(rows, "personId"))) +
   uiCard("按店铺汇总", bars(groupSummary(rows, "shopId"))) +
   uiCard("已提交日报", diaries || uiEmpty("这段时间还没有已提交的店铺日报。")) +
   renderSummaryDialog(rows, metrics) +
   "</div>"
  );
 }

 function renderDuty() {
  var data = state.duty;
  if (!data) {
   return uiCard("", uiEmpty("正在读取提交情况"));
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
      ? uiButton(restLabel, 'data-rest="' + esc(row.personId) + '" data-rest-on="' + restOn + '"', { variant: "secondary" })
      : "";
    return uiCard(
     row.name,
     '<div class="work-row">' +
      uiBadge(row.status, statusTone(row.status)) +
      '<span class="work-main">' +
      esc(row.role || "—") +
      " · " +
      esc(row.deptName || "—") +
      " · 部门事项 " +
      esc(row.template) +
      " · 店铺日报 " +
      esc(row.diary) +
      " · 已交店 " +
      esc(row.shops) +
      (row.note ? '<span class="work-sub">' + esc(row.note) + "</span>" : "") +
      "</span>" +
      rest +
      "</div>"
    );
   })
   .join("");
  return (
   '<div class="work-stack"><div class="xm-ui-stat-grid">' +
   kpi(0, sum.should || 0, "应报人数") +
   kpi(1, sum.done || 0, "已报人数") +
   kpi(5, sum.miss || 0, "未报人数") +
   kpi(2, sum.exempt || 0, "免报") +
   kpi(4, sum.shops || 0, "已交店铺数") +
   "</div>" +
   (sum.pending ? '<p class="work-lead">考勤待核对 ' + esc(sum.pending) + " 人，未计入未报。</p>" : "") +
   (rows || uiEmpty("这一天没有需要汇报的人")) +
   "</div>"
  );
 }

 function renderDiarySettings() {
  var data = state.diarySettings;
  if (!data) {
   return uiCard("", uiEmpty("正在读取日报设置"));
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
   '<div class="work-stack">' +
   uiCard("必须提交店铺日报的岗位", '<div class="work-checks">' + positions + "</div>" + uiButton("保存岗位设置", "data-save-positions"), "勾选岗位，并且已排进运营部、人事部或技术部、名下有店的人，当天要交店铺日报。登记休息后免报。") +
   uiCard("钉钉考勤与人员绑定", '<p class="work-lead">' +
   dingLead +
   (link.app && !link.agent ? " 待配置工作通知 AgentId。" : "") +
   '</p><div class="work-checks"><label><input type="checkbox" data-delivery="useSchedule"' +
   (delivery.useSchedule ? " checked" : "") +
   '> 按钉钉排班识别休息日</label><label><input type="checkbox" data-delivery="useLeave"' +
   (delivery.useLeave ? " checked" : "") +
   '> 按钉钉请假记录识别已批休假</label></div><label class="work-field">排班查询人<select data-ding-operator><option value="">请选择</option>' +
   operatorOptions +
   '</select></label>' + uiButton("保存考勤设置", "data-save-delivery") +
   (link.app
    ? '<div class="xm-ui-table-wrap"><table class="xm-ui-table"><thead><tr><th>姓名</th><th>工号</th><th>钉钉 userId</th><th>核对</th></tr></thead><tbody>' +
     (bindRows || '<tr><td colspan="4">没有在职人员</td></tr>') +
     "</tbody></table></div>" + uiButton("从钉钉核对员工", "data-ding-sync", { variant: "secondary" }) + uiButton("保存员工绑定", "data-ding-save")
    : "")
   ) +
   uiCard("填报项目", '<div class="xm-ui-table-wrap"><table class="xm-ui-table"><thead><tr><th>栏目</th><th>名称</th><th>单位</th><th>启用</th></tr></thead><tbody>' + nodes + "</tbody></table></div>" + uiButton("保存填报内容", "data-save-catalog"), "停用后，已经提交的记录仍可在工作汇总里看。") +
   "</div>"
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

 function rateText(part, whole) {
  var n = Number(whole) ? Math.round((Number(part) / Number(whole)) * 1000) / 10 : 0;
  return String(n).replace(/\.0$/, "") + "%";
 }

 function renderPulse() {
  var sum = (state.report && state.report.summary) || {};
  var should = sum.should || 0;
  var done = sum.done || 0;
  var miss = sum.miss || 0;
  var mine = myRow();
  var mineText = !mine ? "不用交" : mine.status === "已报" ? "已提交" : mine.status === "未报" ? "待提交" : mine.status === "免报" ? "免报" : mine.status === "待核对" ? "待核对" : "自愿填报";
  return (
   '<section class="xm-ui-stat-grid">' +
   xm().StatCard({ label: "今日应提交", value: String(should), unit: "人", icon: "users", tone: "blue" }) +
   xm().StatCard({ label: "已提交", value: String(done), unit: "人", note: "提交率 " + rateText(done, should), trend: "up", icon: "check", tone: "green" }) +
   xm().StatCard({ label: "待提交", value: String(miss), unit: "人", note: rateText(miss, should), icon: "file", tone: "orange" }) +
   xm().StatCard({ label: "我的汇报", value: mineText, note: mine ? dutyBadge() : "", icon: "award", tone: "purple" }) +
   xm().StatCard({ label: "今日提交率", value: rateText(done, should), note: "按今日应交", icon: "chart", tone: "blue" }) +
   "</section>"
  );
 }

 function renderFilterBar() {
  var date = state.date || todayIso();
  var max = (state.meta && state.meta.today) || todayIso();
  var chips = "";
  if (isAdmin()) {
   var depts = ((state.meta && state.meta.depts) || [])
    .map(function (item) {
     return uiTab(item.code, item.name, state.dept === item.code, 'data-dept-filter="' + esc(item.code) + '"');
    })
    .join("");
   chips =
    uiCard(
     "部门",
     uiTabs(uiTab("", "全部", !state.dept, 'data-dept-filter=""') + depts) +
      '<div class="work-form"><label class="work-field is-grow">找人<input data-board-q data-keep-focus="board" value="' +
      esc(state.boardQuery) +
      '" placeholder="姓名、工号、事项关键词"></label><span class="work-muted" data-board-count' +
      (state.boardQuery ? "" : " hidden") +
      ">显示 " +
      reportRows().length +
      " / " +
      ((state.report && state.report.rows) || []).length +
      "</span></div>"
    );
  }
  return (
   '<div class="work-context"><label class="work-field">工作日期<input type="date" data-work-date min="2020-01-01" max="' +
   esc(max) +
   '" value="' +
   esc(date) +
   '"></label>' +
   uiButton("今天", "data-today", { variant: "secondary" }) +
   '<span class="work-filler">填报人 <strong>' +
   esc(fillerName()) +
   "</strong></span></div>" +
   chips
  );
 }

 function renderBlank(text, offer) {
  return uiCard("", uiEmpty(text) + (offer ? uiButton("立即填写日报", "data-write") : ""));
 }

 function renderGuide() {
  return uiCard(
   "日报填写说明",
   '<div class="work-guide"><div><b>填写内容</b><small>总结当日工作、完成情况、问题与计划</small></div><div><b>提交当天</b><small>部门事项和店铺日报交上后记入汇总</small></div><div><b>汇总查看</b><small>在工作汇总中查看团队日报与统计</small></div></div>'
  );
 }

 function renderToday() {
  var date = state.date || todayIso();
  var mine = myRow();
  var canFill = Boolean(mine);
  var hasShops = Boolean(state.diary && state.diary.shops && state.diary.shops.length);
  var rows = ((state.report && state.report.rows) || []).length;
  var skip = state.report && state.report.needReport === false && !isAdmin() && !hasShops;
  var showForm = !skip && (state.compose || canFill || hasShops || (isAdmin() && rows));
  var fillBlock = "";
  var diary = "";
  if (!showForm) {
   fillBlock = renderBlank(skip ? "你所在部门不需要工作汇报。" : "这一天还没有人需要汇报。", !skip);
  } else {
   if (canFill) {
    fillBlock = uiCard(
     dateLabel(date) + (mine.deptName ? " · " + mine.deptName : ""),
     renderFillTable(mine, true) + uiButton("保存这一天", "data-save-mine"),
     "按罗成配好的模板填，一天一张表。"
    );
   } else if (!hasShops && !rows) {
    fillBlock = uiCard("", uiEmpty("今天没有需要填的事项。"));
   }
   if (isAdmin() && rows) {
    fillBlock += renderAdminTable(date);
   }
   diary = renderDiaryFill();
  }
  return '<div class="work-stack">' + renderPulse() + renderFilterBar() + fillBlock + diary + renderGuide() + "</div>";
 }

 function renderTemplateEditor(items, personMode) {
  var rows = (items || []).map(function (item, index) {
   return { index: index, key: item.key || "", label: item.label };
  });
  var table = rows.length
   ? xm().DataTable({
      columns: [
       { key: "index", label: "#", render: function (value) { return String(value + 1); } },
       {
        key: "label",
        label: "事项名称",
        render: function (value, item) {
         return '<input data-tpl-key="' + esc(item.key) + '" data-tpl-label="' + item.index + '" value="' + esc(value) + '">';
        }
       },
       {
        key: "index",
        label: "操作",
        render: function (value) {
         return uiButton("删除", 'data-tpl-del="' + value + '"', { variant: "secondary" });
        }
       }
      ],
      rows: rows
     })
   : uiEmpty("还没有事项");
  return uiCard(
   personMode ? "个人工作事项" : "部门默认事项",
   table +
    '<div class="work-form"><label class="work-field">新增事项<input data-tpl-new placeholder="例如：店铺运营"></label>' +
    uiButton("添加", "data-tpl-add", { variant: "secondary" }) +
    uiButton("保存模板", "data-tpl-save") +
    (personMode ? uiButton("改回部门模板", "data-tpl-reset", { variant: "secondary" }) : "") +
    "</div>",
   personMode && !personTemplate(state.personId).length
    ? "这个人还没有个人模板，下面是部门事项。保存后只给这个人用。"
    : "他们打开工作汇报时，按这个表格填每天事项。"
  );
 }

 function renderPeopleTable() {
  var all = (state.settings && state.settings.people) || [];
  var people = rosterPeople();
  var boards = [{ code: "", name: "全部组织部门" }].concat(orgBoards()).concat([{ code: "none", name: "未分部门" }]);
  var table = people.length
   ? xm().DataTable({
      columns: [
       {
        key: "id",
        label: "汇报",
        render: function (_value, person) {
         return '<input type="checkbox" data-assign="' + esc(person.id) + '"' + (person.deptCode === state.settingsDept ? " checked" : "") + ">";
        }
       },
       { key: "name", label: "姓名" },
       { key: "role", label: "岗位" },
       { key: "center", label: "所属中心" },
       {
        key: "org",
        label: "组织部门",
        render: function (_value, person) {
         return esc(person.orgBoardName || person.orgBoard || "未分部门");
        }
       },
       {
        key: "seat",
        label: "席位",
        render: function (value) {
         return esc(value || "—");
        }
       },
       {
        key: "duty",
        label: "责权",
        render: function (_value, person) {
         return rosterDuty(person);
        }
       },
       {
        key: "deptName",
        label: "当前汇报",
        render: function (value) {
         return esc(value || "不汇报");
        }
       }
      ],
      rows: people
     })
   : uiEmpty(all.length ? "没有符合筛选的人" : "组织中心还没有人");
  var targets = people.filter(rosterDefaultSeat);
  var picked = targets.filter(function (person) {
   return person.deptCode === state.settingsDept;
  }).length;
  var allOn = targets.length > 0 && picked === targets.length;
  var selectAll =
   '<label class="work-check"><input type="checkbox" data-assign-defaults' +
   (allOn ? " checked" : "") +
   (targets.length ? "" : " disabled") +
   ">全选</label>";
  return uiCard(
   "按责权加人",
   '<div class="work-form">' +
    selectAll +
    '<label class="work-field is-grow">搜索<input data-roster-q data-keep-focus="roster" value="' +
    esc(state.rosterQuery) +
    '" placeholder="姓名、中心、店铺、主管"></label><span class="work-muted" data-roster-count>显示 ' +
    people.length +
    " / " +
    all.length +
    "</span></div>" +
    uiTabs(
     chip("data-roster-scope", "all", "全部", state.rosterScope) +
      chip("data-roster-scope", "open", "未排", state.rosterScope) +
      chip("data-roster-scope", "here", "本部门", state.rosterScope) +
      chip("data-roster-scope", "other", "其他汇报部门", state.rosterScope)
    ) +
    uiTabs(
     boards
      .map(function (item) {
       return chip("data-org-board", item.code, item.name, state.orgBoard);
      })
      .join("")
    ) +
    table,
   "名单来自组织中心在职人员。全选勾上当前名单里席位为运营、助理的人，勾上的人按当前部门模板填报。"
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
  return uiCard("", '<div class="work-form"><label class="work-field">给谁配事项<select data-person-tpl>' + options + "</select></label></div>");
 }

 function renderSettings() {
  var depts = ((state.meta && state.meta.depts) || [])
   .map(function (item) {
    return uiTab(item.code, item.name + " · " + countDept(item.code) + " 人", state.settingsDept === item.code, 'data-settings-dept="' + esc(item.code) + '"');
   })
   .join("");
  var items = Number(state.personId)
   ? personTemplate(state.personId).length
    ? personTemplate(state.personId)
    : deptTemplate(state.settingsDept)
   : deptTemplate(state.settingsDept);
  return (
   '<div class="work-stack">' +
   uiTabs(depts) +
   renderPeopleTable() +
   renderPersonPicker() +
   renderTemplateEditor(items, Boolean(Number(state.personId))) +
   "</div>"
  );
 }

 function dot(count) {
  var n = Number(count) || 0;
  if (n < 1) return "";
  return '<i class="work-dot">' + (n > 99 ? "99" : n) + "</i>";
 }

 function paint(root) {
  ensureStyle();
  var admin = isAdmin();
  var leader = Boolean(state.diary && state.diary.leader);
  function tabBtn(id, label, count) {
   var button = uiTab(id, label, state.tab === id, 'data-tab="' + id + '" aria-selected="' + (state.tab === id) + '"');
   var n = Number(count) || 0;
   if (n > 0) {
    button = button.replace("</button>", '<span data-work-count>' + uiBadge(String(n > 99 ? 99 : n), "danger") + "</span></button>");
   }
   return button;
  }
  var tabs = uiTabs(
   tabBtn("today", "填写日报") +
    tabBtn("summary", "工作汇总") +
    (leader ? tabBtn("duty", "提交情况") : "") +
    (admin ? tabBtn("settings", "部门设置") + tabBtn("diarySettings", "日报设置") : "") +
    tabBtn("todo", "待办事项", state.badges.todo) +
    tabBtn("taskPublish", "发布任务") +
    tabBtn("taskMine", "我的任务", state.badges.mine) +
    tabBtn("taskReview", "待检查任务", state.badges.review)
  );
  var taskTab = state.tab === "taskPublish" || state.tab === "taskMine" || state.tab === "taskReview";
  var body =
   taskTab
    ? '<div data-task-host></div>'
    : state.tab === "settings" && admin
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
  var date = state.date || todayIso();
  var dateTools =
   state.tab === "duty"
    ? '<div class="work-tools"><label class="work-field">日期<input type="date" data-work-date min="2020-01-01" max="2099-12-31" value="' +
     esc(date) +
     '"></label>' +
     uiButton("今天", "data-today", { variant: "secondary" }) +
     '<span class="work-lead">人数按人计，店铺按店计。</span></div>'
    : "";
  var header = xm().PageContentHeader({
   title: "工作汇报",
   description: "员工日常工作汇报、任务进展与成果沉淀"
  }).replace(
   "</header>",
   '<div class="xm-ui-page-actions">' + uiButton("汇报统计", 'data-tab="summary"', { variant: "secondary" }) + uiButton("写日报", 'data-write="today"') + "</div></header>"
  );
  root.innerHTML =
   '<main class="xm-ui-scope work-page">' +
   header +
   tabs +
   '<p class="work-msg' +
   (state.error ? " is-error" : "") +
   '">' +
   esc(state.msg) +
   "</p>" +
   dateTools +
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
  paintNavBadge();
  if (taskTab) mountTasks(root, state.tab);
 }

 function mountTasks(root, tab) {
  var host = root.querySelector("[data-task-host]");
  if (!host) return;
  function run() {
   if (!host.isConnected || state.tab !== tab || !window.XmWorkTasks) return;
   var openId = state.openTask;
   state.openTask = "";
   window.XmWorkTasks.mount(host, tab, openId);
  }
  if (window.XmWorkTasks) {
   run();
   return;
  }
  var existing = document.querySelector("script[data-work-tasks]");
  if (existing) {
   existing.addEventListener("load", run);
   return;
  }
  var script = document.createElement("script");
  script.src = "/shared/modules/work-tasks.js";
  script.setAttribute("data-work-tasks", "");
  script.onload = run;
  script.onerror = function () {
   if (host.isConnected) host.innerHTML = uiCard("", uiEmpty("任务页面没有载入"));
  };
  document.head.appendChild(script);
 }

 function paintNavBadge() {
  var link = document.querySelector('a.xm-menu-item[href="/work"]');
  if (!link) return;
  var badge = link.querySelector("[data-work-nav-badge]");
  if (!state.todoOpen) {
   if (badge) badge.remove();
   return;
  }
  if (!badge) {
   badge = document.createElement("i");
   badge.className = "xm-work-badge";
   badge.setAttribute("data-work-nav-badge", "");
   link.appendChild(badge);
  }
  badge.textContent = "1";
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
  var badgeData = await api("/api/work/badges").catch(function () { return null; });
  if (badgeData) {
   state.badges = {
    todo: Number(badgeData.todo) || 0,
    mine: Number(badgeData.mine) || 0,
    review: Number(badgeData.review) || 0
   };
   state.todoOpen = state.badges.todo > 0;
  } else {
   state.todoOpen = Boolean(mine && mine.status === "未报");
   state.badges.todo = state.todoOpen ? 1 : 0;
  }
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
   var write = event.target.closest("[data-write]");
   if (write) {
    state.compose = true;
    state.tab = "today";
    if (write.getAttribute("data-write") === "today") {
     state.date = (state.meta && state.meta.today) || todayIso();
    }
    setMsg("");
    reload(root).catch(oops(root));
    return;
   }
   var todoGo = event.target.closest("[data-todo-go]");
   if (todoGo) {
    state.tab = "today";
    state.date = (state.meta && state.meta.today) || todayIso();
    setMsg("");
    reload(root).catch(oops(root));
    return;
   }
   var tab = event.target.closest("[data-tab]");
   if (tab) {
    state.tab = tab.getAttribute("data-tab") || "today";
    setMsg("");
    reload(root).catch(oops(root));
    return;
   }
   var summaryPeriod = event.target.closest("[data-summary-period]");
   if (summaryPeriod) {
    readSummaryForm(root);
    var summaryToday = (state.meta && state.meta.today) || todayIso();
    var period = summaryPeriod.getAttribute("data-summary-period");
    state.summaryTo = period === "昨天" ? shiftIso(summaryToday, -1) : summaryToday;
    state.summaryFrom = period === "今天" ? summaryToday : period === "昨天" ? state.summaryTo : period === "本月" ? summaryToday.slice(0, 7) + "-01" : shiftIso(summaryToday, -6);
    reload(root).catch(oops(root));
    return;
   }
   var summaryQuery = event.target.closest("[data-summary-query]");
   if (summaryQuery) {
    readSummaryForm(root);
    reload(root).catch(oops(root));
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
    reload(root).catch(oops(root));
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
     .catch(oops(root));
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
     .catch(oops(root));
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
     .catch(oops(root));
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
     .catch(oops(root));
    return;
   }
   var saveDelivery = event.target.closest("[data-save-delivery]");
   if (saveDelivery) {
    var delivery = Object.assign({}, state.diarySettings.policy.delivery);
    [].slice.call(root.querySelectorAll("[data-delivery]")).forEach(function (box) {
     delivery[box.getAttribute("data-delivery")] = box.checked;
    });
    delivery.operatorPersonId = Number((root.querySelector("[data-ding-operator]") || {}).value) || 0;
    api("/api/work/diary/settings", {
     method: "PUT",
     body: { delivery: delivery }
    })
     .then(function (data) {
      state.diarySettings = data;
      var ready = data.policy && data.policy.integration && data.policy.integration.app;
      setMsg(ready ? "考勤设置已保存" : "已保存。企业应用未配置，暂不查询钉钉。");
      paint(root);
     })
     .catch(oops(root));
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
     .catch(oops(root));
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
     .catch(oops(root));
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
     .catch(oops(root));
    return;
   }
   var deptFilter = event.target.closest("[data-dept-filter]");
   if (deptFilter) {
    state.dept = deptFilter.getAttribute("data-dept-filter") || "";
    reload(root).catch(oops(root));
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
     .catch(oops(root));
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
     .catch(oops(root));
   }
  });
  root.addEventListener("change", function (event) {
   var date = event.target.closest("[data-work-date]");
   if (date) {
    state.date = date.value || todayIso();
    reload(root).catch(oops(root));
    return;
   }
   var person = event.target.closest("[data-person-tpl]");
   if (person) {
    state.personId = Number(person.value || 0);
    paint(root);
    return;
   }
   var defaults = event.target.closest("[data-assign-defaults]");
   if (defaults) {
    var on = defaults.checked;
    var chosen = rosterPeople().filter(rosterDefaultSeat).filter(function (person) {
     var here = person.deptCode === state.settingsDept;
     return on ? !here : here;
    });
    if (!chosen.length) {
     setMsg(on ? "席位为运营、助理的人已经在这个部门" : "当前名单里没有要取消的运营、助理");
     paint(root);
     return;
    }
    api("/api/work/settings/members", {
     method: "PUT",
     body: {
      members: chosen.map(function (person) {
       return { personId: Number(person.id), deptCode: on ? state.settingsDept : "" };
      })
     }
    })
     .then(function (data) {
      state.settings = data;
      setMsg((on ? "已加入" + (deptLabel(state.settingsDept) || "当前部门") + " " : "已移出 ") + chosen.length + " 人");
      paint(root);
     })
     .catch(function (err) {
      setMsg(err.message, true);
      defaults.checked = !on;
     });
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
     .catch(oops(root));
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
    state.keepFocus = "roster";
    state.keepCaret = roster.selectionStart;
    paint(root);
    return;
   }
   var boardQuery = event.target.closest("[data-board-q]");
   if (boardQuery) {
    state.boardQuery = boardQuery.value || "";
    state.keepFocus = "board";
    state.keepCaret = boardQuery.selectionStart;
    paint(root);
   }
  });
 }

 function readDeepLink() {
  var params;
  try {
   params = new URLSearchParams(window.location.search);
  } catch (err) {
   return;
  }
  var tab = params.get("tab") || "";
  if (tab === "todo" || tab === "taskPublish" || tab === "taskMine" || tab === "taskReview" || tab === "today") {
   state.tab = tab;
  }
  state.openTask = params.get("task") || "";
 }

 function refreshBadges(root) {
  return api("/api/work/badges").then(function (data) {
   state.badges = {
    todo: Number(data.todo) || 0,
    mine: Number(data.mine) || 0,
    review: Number(data.review) || 0
   };
   state.todoOpen = state.badges.todo > 0;
   var map = { todo: state.badges.todo, taskMine: state.badges.mine, taskReview: state.badges.review };
   Object.keys(map).forEach(function (id) {
    var btn = root.querySelector('.xm-ui-tab[data-tab="' + id + '"]');
    if (!btn) return;
    var mark = btn.querySelector("[data-work-count]");
    if (!map[id]) {
     if (mark) mark.remove();
     return;
    }
    if (!mark) {
     mark = document.createElement("span");
     mark.setAttribute("data-work-count", "");
     btn.appendChild(mark);
    }
    mark.innerHTML = uiBadge(String(map[id] > 99 ? 99 : map[id]), "danger");
   });
   paintNavBadge();
  }).catch(function () {});
 }

 window.XmModules = window.XmModules || {};
 window.XmWorkLegacy = {
  mount: function (root, initialTab) {
   ensureStyle();
   state.tab = "today";
   readDeepLink();
   if (initialTab) state.tab = initialTab;
   state.date = "";
   state.dept = "";
   state.settingsDept = "ops";
   state.personId = 0;
   state.rosterQuery = "";
   state.rosterScope = "all";
   state.orgBoard = "";
   state.boardQuery = "";
   state.compose = false;
   state.keepFocus = "";
   state.msg = "";
   state.error = false;
   root.innerHTML = '<main class="xm-ui-scope work-page">' + (window.XmUI ? window.XmUI.EmptyState({ title: "正在打开工作汇报" }) : "") + "</main>";
   if (!root.dataset.workBound) {
    root.dataset.workBound = "1";
    bind(root);
   }
   reload(root).catch(oops(root));
   if (state.badgeTimer) clearInterval(state.badgeTimer);
   state.badgeTimer = setInterval(function () {
    if (!root.isConnected) return;
    refreshBadges(root);
   }, 10000);
   return function unmount() {
    clearInterval(state.badgeTimer);
    state.badgeTimer = 0;
    root.innerHTML = "";
   };
  }
 };
 window.XmModules['/work'] = {
  permissionVersion: 'catalog-2',
  mount: function(root) {
    var stopped=false, cleanup=null;
    if (!document.getElementById('work-center-css')) {
      var css=document.createElement('link'); css.id='work-center-css';css.rel='stylesheet';css.href='/shared/modules/work-center.css?v=20261125-work-settings';document.head.appendChild(css);
    }
    function run(){
      function mount(){if(!stopped){window.XmWorkRich.style();cleanup=window.XmWorkCenter.mount(root);}}
      if(window.XmWorkRich?.version==='chat-input-1'){mount();return;}
      var editor=document.createElement('script');editor.src='/shared/modules/work-tasks.js';editor.onload=mount;
      editor.onerror=function(){if(!stopped)root.innerHTML='输入组件加载失败，请刷新重试。';};document.head.appendChild(editor);
    }
    if(window.XmWorkCenter?.permissionVersion==='catalog-2')run();
    else {
      root.innerHTML='<div style="padding:32px">正在打开工作中心…</div>';
      var script=document.createElement('script');script.src='/shared/modules/work-center.js?v=20261125-work-settings';script.onload=run;
      script.onerror=function(){if(!stopped)root.innerHTML='<div style="padding:32px">工作中心加载失败，请刷新页面重试。</div>';};
      document.head.appendChild(script);
    }
    return function(){stopped=true;if(cleanup)cleanup();root.innerHTML='';};
  }
 };
})();
