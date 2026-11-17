/* 工作汇报里的发布任务、我的任务、待检查任务。 */
(function () {
  var queues = { taskPublish: "publish", taskMine: "mine", taskReview: "review" };
  var labels = { start: "开始执行", submit: "提交检查", approve: "检查通过", return: "退回修改" };

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function ensureStyle() {
    if (document.getElementById("work-task-style")) return;
    var style = document.createElement("style");
    style.id = "work-task-style";
    style.textContent =
      ".wt-nav{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px}.wt-badge{border-radius:8px;padding:2px 8px;background:#eef3ff;color:#2f6bff;font-weight:650}.wt-badge[data-status='已完成']{background:#e8f8ee;color:#1faa5a}.wt-badge[data-status='已退回']{background:#ffecec;color:#cf1322}.wt-badge[data-status='待检查']{background:#fff3e6;color:#f08a1e}.wt-overdue{color:#cf1322;font-weight:650}.wt-log{margin:8px 0 0;padding:0;list-style:none}.wt-log li{padding:8px 0;border-top:1px solid var(--l,#e8eef8)}.wt-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.wt-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.wt-layout{display:grid;grid-template-columns:minmax(0,1fr) 240px;gap:12px}@media(max-width:980px){.wt-grid,.wt-layout{grid-template-columns:1fr}}";
    document.head.appendChild(style);
  }

  function api(path, options) {
    var init = options || {};
    var headers = { Accept: "application/json" };
    if (init.json) headers["Content-Type"] = "application/json";
    return fetch("/api/work/" + path, {
      method: init.method || "GET",
      credentials: "same-origin",
      headers: headers,
      body: init.json ? JSON.stringify(init.json) : init.body
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok || data.ok === false) throw new Error((data && data.error) || "读取失败");
        return data;
      });
    });
  }

  function stamp(value) {
    return esc(String(value || "").slice(0, 16).replace("T", " "));
  }

  function overdue(task, now) {
    return ["待执行", "进行中", "已退回"].indexOf(task.status) >= 0 && Date.parse(task.due_at + "+08:00") < now;
  }

  function mount(host, tab, openId) {
    ensureStyle();
    var queue = queues[tab] || "mine";
    var mode = queue === "publish" ? "发布任务" : queue === "review" ? "待检查" : "全部任务";
    var filter = "";
    var items = [];
    var ctx = { me: "", people: [], today: "" };
    var formKey = "";
    host.innerHTML = '<div class="work-empty">正在读取任务…</div>';

    function name(id) {
      var hit = ctx.people.find(function (person) { return person.id === id; });
      return hit ? hit.name : id;
    }

    function matches(task, chosen, now) {
      if (queue === "publish" || chosen === "全部任务") return true;
      if (chosen === "已逾期") return overdue(task, now);
      if (chosen === "已处理") {
        return task.status !== "待检查" && (task.events || []).some(function (event) {
          return event.actor === ctx.me && (event.action === "检查通过" || event.action === "退回修改");
        });
      }
      return task.status === chosen;
    }

    function options(selected) {
      return '<option value="">请选择</option>' + ctx.people.map(function (person) {
        return '<option value="' + esc(person.id) + '"' + (person.id === selected ? " selected" : "") + ">" + esc(person.name) + "</option>";
      }).join("");
    }

    function draw() {
      if (!host.isConnected) return;
      var now = Date.now();
      var nav = queue === "publish" ? ["发布任务", "已发布任务"] : queue === "review" ? ["待检查", "已处理"] : ["全部任务", "已逾期", "待执行", "进行中", "待检查", "已退回", "已完成"];
      var chips = nav.map(function (item) {
        var count = items.filter(function (task) { return matches(task, item, now); }).length;
        var showCount = queue === "mine" && item !== "全部任务" && item !== "已完成" || (queue === "review" && item === "待检查");
        return '<button type="button" class="work-chip' + (item === mode ? " is-on" : "") + '" data-task-tab="' + esc(item) + '">' + esc(item) + (showCount ? " " + count : "") + "</button>";
      }).join("");
      var body = mode === "发布任务" ? compose() : list(now);
      var priority = "";
      if (queue === "mine") {
        var urgent = items.filter(function (task) { return task.status === "已退回" || task.status === "待检查"; });
        priority = '<aside class="work-card"><h2>优先跟进</h2>' + (urgent.length ? urgent.map(function (task) {
          return '<button type="button" class="work-link" data-task-open="' + esc(task.id) + '">' + esc(task.status) + " " + esc(task.title) + "</button>";
        }).join("") : '<p class="work-lead">暂无已退回或待检查的任务</p>') + "</aside>";
      }
      host.innerHTML = '<div class="wt-nav">' + chips + '</div><p class="work-msg" data-task-msg></p>' + (priority ? '<div class="wt-layout">' + body + priority + "</div>" : body);
    }

    function compose() {
      if (!formKey) formKey = ("task" + Date.now().toString(16) + Math.random().toString(16).slice(2)).slice(0, 64);
      var nowDate = new Date();
      var pad = function (n) { return String(n).padStart(2, "0"); };
      var start = nowDate.getFullYear() + "-" + pad(nowDate.getMonth() + 1) + "-" + pad(nowDate.getDate()) + "T" + pad(nowDate.getHours()) + ":" + pad(nowDate.getMinutes());
      return '<form data-task-form="publish" class="work-card"><h2>发布任务</h2><div class="wt-grid"><label class="work-field">任务标题<input name="title" required maxlength="200" placeholder="请输入任务标题"></label><label class="work-field">执行人<select name="assignee">' + options("") + '</select></label><label class="work-field">检查人<select name="reviewer">' + options("") + '</select></label><label class="work-field">计划开始<input name="start_at" type="datetime-local" required value="' + esc(start) + '"></label><label class="work-field">截止时间<input name="due_at" type="datetime-local" required value="' + esc(ctx.today) + 'T23:59"></label></div><label class="work-field">任务说明<textarea name="description" maxlength="4000"></textarea></label><label class="work-field">完成要求<textarea name="criteria" maxlength="2000"></textarea></label><label class="work-field">任务附件<input name="files" type="file" multiple><span>最多 3 个文件，合计 3 MB</span></label><button type="submit" class="work-primary">发布任务</button></form>';
    }

    function list(now) {
      var shown = items.filter(function (task) {
        if (!matches(task, mode, now)) return false;
        var blob = [task.title, name(task.assignee), name(task.reviewer)].join(" ");
        return !filter || blob.indexOf(filter) >= 0;
      });
      var rows = shown.map(function (task) {
        var late = overdue(task, now) ? ' <span class="wt-overdue">已逾期</span>' : "";
        return "<tr><td>" + esc(task.title) + "</td><td>" + esc(name(task.assignee)) + "</td><td>" + esc(name(task.reviewer)) + "</td><td>" + stamp(task.due_at) + late + '</td><td><span class="wt-badge" data-status="' + esc(task.status) + '">' + esc(task.status) + '</span></td><td><button type="button" class="work-mini" data-task-open="' + esc(task.id) + '">查看任务</button></td></tr>';
      }).join("");
      return '<section class="work-card"><div class="work-cardhead"><h2>' + (queue === "review" ? "检查清单" : "任务清单") + '</h2><label class="work-search">找任务<input data-task-q value="' + esc(filter) + '" placeholder="搜索任务标题或人员"></label></div><div class="work-table-wrap"><table class="work-table"><thead><tr><th>任务标题</th><th>执行人</th><th>检查人</th><th>截止时间</th><th>状态</th><th>操作</th></tr></thead><tbody>' + (rows || '<tr><td colspan="6" class="work-empty">暂无记录</td></tr>') + "</tbody></table></div></section>";
    }

    function say(text, error) {
      var node = host.querySelector("[data-task-msg]");
      if (!node) return;
      node.textContent = text || "";
      node.className = "work-msg" + (error ? " is-error" : "");
    }

    function checkFiles(input) {
      var files = [].slice.call((input && input.files) || []);
      if (files.length > 3 || files.reduce(function (sum, file) { return sum + file.size; }, 0) > 3 * 1024 * 1024) {
        throw new Error("最多上传 3 个附件，合计 3 MB");
      }
      if (files.some(function (file) { return !file.size; })) throw new Error("请移除空文件");
      return files;
    }

    function postForm(path, fields, input) {
      return Promise.resolve().then(function () {
        var files = checkFiles(input);
        var body = new FormData();
        Object.keys(fields).forEach(function (key) { body.append(key, fields[key] == null ? "" : fields[key]); });
        files.forEach(function (file) { body.append("files", file, file.name); });
        return api(path, { method: "POST", body: body });
      });
    }

    function openTask(id) {
      var task = items.find(function (item) { return item.id === id; });
      if (!task) {
        say("没有这条任务，或当前账号不能处理", true);
        return;
      }
      var actions = [];
      if (task.assignee === ctx.me && task.status === "待执行") actions.push("start");
      if (task.assignee === ctx.me && ["待执行", "进行中", "已退回"].indexOf(task.status) >= 0) actions.push("submit");
      if (task.reviewer === ctx.me && task.status === "待检查") actions.push("approve", "return");
      var files = (task.files || []).map(function (file) {
        return '<button type="button" class="work-mini" data-task-file="' + esc(file.id) + '">' + esc(file.name) + "</button>";
      }).join(" ");
      var log = (task.events || []).map(function (event) {
        var eventFiles = (event.files || []).map(function (file) {
          return '<button type="button" class="work-mini" data-task-file="' + esc(file.id) + '">' + esc(file.name) + "</button>";
        }).join(" ");
        return "<li><strong>" + esc(event.action) + "</strong> · " + esc(name(event.actor)) + " <small>" + stamp(event.at) + "</small>" + (event.note ? "<p>" + esc(event.note) + "</p>" : "") + eventFiles + "</li>";
      }).join("");
      var tools = actions.length
        ? '<label class="work-field">' + (actions.indexOf("submit") >= 0 ? "执行结果" : "检查意见") + '<textarea name="note" maxlength="2000"></textarea></label>' +
          (actions.indexOf("submit") >= 0 ? '<label class="work-field">执行结果附件<input name="files" type="file" multiple></label>' : "") +
          '<div class="wt-actions">' + actions.map(function (action) {
            return '<button type="button" class="' + (action === "return" ? "work-mini" : "work-primary") + '" data-task-do="' + action + '">' + labels[action] + "</button>";
          }).join("") + "</div>"
        : "";
      var old = host.querySelector(".work-modal");
      if (old) old.remove();
      host.insertAdjacentHTML("beforeend", '<div class="work-modal"><div class="work-dialog"><div class="work-dialog-head"><h2>' + esc(task.title) + '</h2><button type="button" class="work-mini" data-task-close>关闭</button></div><span class="wt-badge" data-status="' + esc(task.status) + '">' + esc(task.status) + "</span><p>执行人 " + esc(name(task.assignee)) + "　检查人 " + esc(name(task.reviewer)) + "</p><p>计划 " + stamp(task.start_at) + " 至 " + stamp(task.due_at) + "</p><h3>任务说明</h3><p>" + esc(task.description || "—") + "</p><h3>完成要求</h3><p>" + esc(task.criteria || "—") + "</p>" + files + '<ol class="wt-log">' + log + "</ol>" + tools + "</div></div>");
      var box = host.querySelector(".work-modal");
      box.addEventListener("click", function (event) {
        if (event.target === box || event.target.closest("[data-task-close]")) box.remove();
        var file = event.target.closest("[data-task-file]");
        if (file) download(file.getAttribute("data-task-file"));
        var action = event.target.closest("[data-task-do]");
        if (!action || action.disabled) return;
        action.disabled = true;
        var note = (box.querySelector("[name=note]") || {}).value || "";
        var fileInput = box.querySelector("[name=files]");
        postForm("tasks/action", { id: task.id, revision: task.revision, action: action.getAttribute("data-task-do"), note: note }, fileInput).then(function () {
          box.remove();
          return reload("任务状态已更新");
        }).catch(function (err) {
          action.disabled = false;
          say(err.message, true);
        });
      });
    }

    function download(id) {
      api("tasks/file?id=" + encodeURIComponent(id)).then(function (file) {
        var bytes = Uint8Array.from(atob(file.data || ""), function (ch) { return ch.charCodeAt(0); });
        var link = document.createElement("a");
        var url = URL.createObjectURL(new Blob([bytes]));
        link.href = url;
        link.download = file.name || "附件";
        link.click();
        setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
      }).catch(function (err) { say(err.message, true); });
    }

    function reload(message) {
      if (mode === "发布任务") {
        draw();
        if (message) say(message, false);
        return Promise.resolve();
      }
      var queueName = queue === "publish" ? "published" : queue;
      return api("tasks?queue=" + queueName).then(function (data) {
        items = data.rows || [];
        draw();
        if (message) say(message, false);
      });
    }

    host.addEventListener("click", function (event) {
      var chip = event.target.closest("[data-task-tab]");
      if (chip) {
        mode = chip.getAttribute("data-task-tab");
        reload().catch(function (err) { say(err.message, true); });
        return;
      }
      var open = event.target.closest("[data-task-open]");
      if (open) openTask(open.getAttribute("data-task-open"));
    });
    host.addEventListener("input", function (event) {
      if (!event.target.matches("[data-task-q]")) return;
      filter = event.target.value.trim();
      draw();
      var box = host.querySelector("[data-task-q]");
      if (box) {
        box.focus();
        box.setSelectionRange(filter.length, filter.length);
      }
    });
    host.addEventListener("submit", function (event) {
      var form = event.target.closest("[data-task-form]");
      if (!form) return;
      event.preventDefault();
      var button = form.querySelector("[type=submit]");
      if (button) button.disabled = true;
      var data = {
        id: formKey,
        title: form.elements.title.value,
        description: form.elements.description.value,
        criteria: form.elements.criteria.value,
        assignee: form.elements.assignee.value,
        reviewer: form.elements.reviewer.value,
        start_at: form.elements.start_at.value,
        due_at: form.elements.due_at.value
      };
      if (!data.assignee || !data.reviewer) {
        if (button) button.disabled = false;
        say("请选择执行人和检查人", true);
        return;
      }
      if (data.assignee === data.reviewer) {
        if (button) button.disabled = false;
        say("检查人和执行人必须为不同人员", true);
        return;
      }
      if (data.due_at < data.start_at) {
        if (button) button.disabled = false;
        say("截止时间不能早于开始时间", true);
        return;
      }
      postForm("tasks/publish", data, form.elements.files).then(function () {
        mode = "已发布任务";
        return reload("任务已发布");
      }).then(function () {
        formKey = "";
      }).catch(function (err) {
        if (button) button.disabled = false;
        say(err.message, true);
      });
    });

    api("tasks/context").then(function (data) {
      ctx = data;
      if (!ctx.me) {
        host.innerHTML = '<div class="work-card"><div class="work-empty">对不上组织中心的人，还不能收发任务。</div></div>';
        return;
      }
      return reload().then(function () {
        if (openId) openTask(openId);
      });
    }).catch(function (err) {
      host.innerHTML = '<div class="work-card"><div class="work-empty">' + esc(err.message) + "</div></div>";
    });
  }

  window.XmWorkTasks = { mount: mount };
})();
