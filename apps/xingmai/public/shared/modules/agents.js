/* xm-module-agents 0.1.151 */
(function () {
  var SCENES = [
    { id: "qa", title: "电商知识问答", text: "运营问题、平台规则、玩法策略 SOP流程即时解答", prompt: "电商运营里，选品和平台规则日常要注意什么？", icon: "file", tone: "blue" },
    { id: "create", title: "创作与运营执行", text: "主图/详情图/海报/标题/卖点 文案、上新、优化等日常工作", prompt: "怎么做主图、详情和标题？日常做店怎么排？", icon: "play", tone: "purple" },
    { id: "diag", title: "店铺分析与诊断", text: "店铺健康度、流量/转化/利润 问题定位与优化建议", prompt: "店铺健康一般看哪些指标？本店近30天如果没有接口请直接说还没有。", icon: "users", tone: "green" },
    { id: "market", title: "行业大盘分析", text: "行业趋势、竞争格局、热销商品 价格带、机会赛道分析", prompt: "行业大盘和竞品分析一般怎么做？没有外数就说还没有。", icon: "chart", tone: "orange" },
    { id: "watch", title: "数据异常监控", text: "公司/店铺经营数据实时监控 异常预警、原因分析与处置建议", prompt: "数据异常监控需要哪些只读接口？现在缺什么？", icon: "award", tone: "orange" }
  ];

  var TOOLS = [
    { name: "主图生成", prompt: "帮我规划一组商品主图：构图、卖点和测图顺序。" },
    { name: "详情图生成", prompt: "按转化路径拆一套详情页模块和文案。" },
    { name: "标题优化", prompt: "写三个高转化商品标题，并说明关键词怎么放。" },
    { name: "卖点提炼", prompt: "从人群和场景出发，提炼五条商品卖点。" },
    { name: "文案生成", prompt: "写一段主图短文案和一段详情页长文案。" },
    { name: "评价回复", prompt: "给好评、中评、差评各写一条客服回复口径。" },
    { name: "关键词拓展", prompt: "围绕这个品拓展搜索词和标题词，不要编本店成交。" },
    { name: "竞品分析", prompt: "没有外数时，竞品分析应看哪些公开信息和本站缺口？" },
    { name: "活动方案", prompt: "给一场店铺活动写节奏：预热、爆发、收尾。" }
  ];

  var CHIPS = [
    { label: "帮我诊断店铺流量下滑原因", prompt: "店铺流量下滑一般查哪些环节？本店近30天没有接口就说明还没有。" },
    { label: "生成一组主图和详情图", prompt: "按人群和卖点，生成一组主图和详情图的制作清单。" },
    { label: "分析行业大盘与机会类目", prompt: "行业大盘和机会类目怎么分析？没有外数就说还没有。" },
    { label: "监控昨日数据异常", prompt: "昨日经营异常监控需要哪些只读数据？现在缺什么？" },
    { label: "写一个高转化的商品标题", prompt: "写三个高转化商品标题，并说明为什么这样写。" }
  ];

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function ensureCss() {
    if (document.querySelector('link[href*="agents.css"]')) {
      return;
    }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/agents.css?v=0.1.151";
    document.head.appendChild(link);
  }

  function withAttr(html, attr) {
    return String(html).replace("<button ", "<button " + attr + " ");
  }

  function withActionId(html, id) {
    return String(html).replace('class="xm-ui-text-action"', 'class="xm-ui-text-action" id="' + id + '"');
  }

  function tableWithRowIds(html, rows) {
    var i = 0;
    return String(html).replace(/<tbody>([\s\S]*?)<\/tbody>/, function (_, body) {
      return (
        "<tbody>" +
        body.replace(/<tr>/g, function () {
          var row = rows[i++];
          return row && row.id != null ? '<tr data-session="' + escapeHtml(row.id) + '">' : "<tr>";
        }) +
        "</tbody>"
      );
    });
  }

  function api(path, options) {
    return fetch(path, Object.assign({ credentials: "same-origin", headers: { Accept: "application/json" } }, options)).then(
      function (res) {
        return res.json().catch(function () {
          return {};
        }).then(function (data) {
          if (!res.ok) {
            throw new Error(data.error || "接口 " + res.status);
          }
          return data;
        });
      }
    );
  }

  function chartSvg(trend) {
    const rows = Array.isArray(trend) ? trend : [];
    const w = 420;
    const h = 168;
    const left = 28;
    const right = 28;
    const top = 12;
    const bottom = 24;
    const maxTasks = Math.max(1, ...rows.map(function (item) { return Number(item.tasks) || 0; }));
    const maxHours = Math.max(1, ...rows.map(function (item) { return Number(item.hours) || 0; }));
    function xAt(i) {
      return rows.length < 2 ? w / 2 : left + (i / (rows.length - 1)) * (w - left - right);
    }
    function yAt(value, max) {
      return top + (1 - (Number(value) || 0) / max) * (h - top - bottom);
    }
    function pts(key, max) {
      return rows
        .map(function (item, i) {
          return xAt(i).toFixed(1) + "," + yAt(item[key], max).toFixed(1);
        })
        .join(" ");
    }
    const grid = [0, 0.25, 0.5, 0.75, 1]
      .map(function (ratio) {
        const y = (top + ratio * (h - top - bottom)).toFixed(1);
        return '<line class="xm-ui-chart-grid-line" x1="' + left + '" x2="' + (w - right) + '" y1="' + y + '" y2="' + y + '" />';
      })
      .join("");
    const taskPts = pts("tasks", maxTasks);
    const hourPts = pts("hours", maxHours);
    const last = rows[rows.length - 1] || { tasks: 0, hours: 0 };
    const firstX = xAt(0).toFixed(1);
    const lastX = xAt(Math.max(0, rows.length - 1)).toFixed(1);
    const labels = rows
      .map(function (item, i) {
        if (i % 2 !== 0 && i !== rows.length - 1) {
          return "";
        }
        return (
          '<text class="xm-ui-chart-axis-label" x="' +
          xAt(i).toFixed(1) +
          '" y="' +
          (h - 6) +
          '" text-anchor="middle">' +
          escapeHtml(item.date) +
          "</text>"
        );
      })
      .join("");
    return (
      '<svg viewBox="0 0 ' +
      w +
      " " +
      h +
      '" role="img" aria-label="本模块任务与工时趋势">' +
      grid +
      '<polygon fill="#1677ff" fill-opacity=".12" points="' +
      taskPts +
      " " +
      lastX +
      "," +
      (h - bottom) +
      " " +
      firstX +
      "," +
      (h - bottom) +
      '"/>' +
      '<polyline class="xm-ui-chart-line" points="' +
      taskPts +
      '"/>' +
      '<polyline fill="none" stroke="#12b76a" stroke-width="3" stroke-linejoin="round" points="' +
      hourPts +
      '"/>' +
      '<circle cx="' +
      lastX +
      '" cy="' +
      yAt(last.tasks, maxTasks).toFixed(1) +
      '" r="3.5" fill="#1677ff"/>' +
      '<circle cx="' +
      lastX +
      '" cy="' +
      yAt(last.hours, maxHours).toFixed(1) +
      '" r="3.5" fill="#12b76a"/>' +
      labels +
      "</svg>"
    );
  }

  window.XmModules = window.XmModules || {};
  window.XmModules["/agents"] = {
    mount: function (root) {
      ensureCss();
      const ui = window.XmUI;
      if (!ui) {
        root.innerHTML = '<div class="xm-ui-scope"><p>界面组件未加载。</p></div>';
        return function unmount() {
          root.innerHTML = "";
        };
      }

      root.innerHTML =
        '<main class="xm-ui-scope agents-page is-home">' +
        '<section class="agents-home" aria-label="甄选智能体工作台">' +
        ui.PageContentHeader({
          eyebrow: "甄选智能体",
          title: "电商运营智能体",
          description: "你的 AI 电商运营团队：问答、创作、诊断、分析、监控，提升运营效率与经营结果。本店近30天、商学院、外数没有接口就不编。改价、退款、发版不会做。"
        }) +
        '<div class="xm-ui-stat-grid" id="agents-kpis"></div>' +
        '<div class="agents-scene-grid" id="agents-scenes">' +
        SCENES.map(function (item) {
          return (
            '<div class="agents-scene-hit" data-prompt="' +
            escapeHtml(item.prompt) +
            '">' +
            ui.ContentCard({
              title: item.title,
              description: item.text,
              content: withAttr(ui.button({ label: "立即使用", size: "small", icon: "arrow" }), 'data-prompt="' + escapeHtml(item.prompt) + '"')
            }) +
            "</div>"
          );
        }).join("") +
        "</div>" +
        '<div class="agents-mid">' +
        '<div id="agents-ask-card">' +
        ui.ContentCard({
          title: "嗨！我是甄选智能体",
          description: "我可以帮你解决电商运营中的各种问题，支持问答、创作、分析、诊断和数据监控。",
          content:
            '<div class="agents-chips" id="agents-chips">' +
            CHIPS.map(function (item) {
              return withAttr(
                ui.button({ label: item.label, variant: "secondary", size: "small" }),
                'data-prompt="' + escapeHtml(item.prompt) + '"'
              );
            }).join("") +
            "</div>" +
            '<form class="agents-home-form" id="agents-home-form">' +
            '<textarea id="agents-home-text" maxlength="2000" placeholder="请输入你的问题或任务，例如：帮我分析店铺 ROI 下降的原因"></textarea>' +
            '<div class="agents-home-bar">' +
            withAttr(ui.button({ label: "+ 上传", variant: "secondary", size: "small", id: "agents-home-pick" }), "") +
            '<input type="file" id="agents-home-file" class="xm-ui-sr-only" />' +
            '<span class="grow"></span>' +
            '<label class="agents-toggle"><input type="checkbox" id="agents-deep" /> 深度分析</label>' +
            ui.button({ label: "发送", type: "submit" }) +
            "</div></form>" +
            '<p class="agents-status" id="agents-home-status" role="status"></p>'
        }) +
        "</div>" +
        '<div id="agents-tools-card">' +
        withActionId(
          ui.ContentCard({
            title: "常用工具",
            action: "全部工具",
            content:
              '<div class="agents-tool-grid" id="agents-tools">' +
              TOOLS.map(function (item) {
                return withAttr(ui.button({ label: item.name, variant: "secondary", size: "small" }), 'data-prompt="' + escapeHtml(item.prompt) + '"');
              }).join("") +
              "</div>"
          }),
          "agents-all-tools"
        ) +
        "</div>" +
        '<div id="agents-alerts-card">' +
        withActionId(
          ui.ContentCard({
            title: "数据异常预警",
            action: "全部预警",
            content: '<div id="agents-alerts"></div>'
          }),
          "agents-all-alerts"
        ) +
        "</div></div>" +
        '<div class="agents-low">' +
        '<div id="agents-recent-card">' +
        withActionId(
          ui.ContentCard({
            title: "智能体任务运行中",
            action: "查看全部",
            content: '<div id="agents-recent"></div>'
          }),
          "agents-open-chat"
        ) +
        "</div>" +
        '<div id="agents-month-card">' +
        ui.ContentCard({
          title: "本月智能体使用数据",
          description: "只统计本模块对话，不是店铺成交。",
          content: '<div class="xm-ui-stat-grid" id="agents-month"></div>'
        }) +
        "</div>" +
        ui.ChartCard({
          title: "智能体价值趋势",
          legend: [
            { label: "任务数", color: "#1677ff" },
            { label: "节省工时(h)", color: "#12b76a" }
          ],
          content: '<div id="agents-trend"></div>'
        }) +
        "</div></section>" +
        '<div class="agents-workbench">' +
        '<aside class="agents-rail" aria-label="历史会话">' +
        ui.ContentCard({
          title: "历史会话",
          content:
            ui.button({ label: "工作台", variant: "secondary", size: "small", id: "agents-back" }) +
            ui.button({ label: "新会话", id: "agents-new" }) +
            '<ul class="agents-threads" id="agents-sessions"></ul>'
        }) +
        "</aside>" +
        '<section class="agents-chat" aria-label="主脑问答台">' +
        ui.ContentCard({
          title: "主脑问答台",
          description: "选品、做店、日常可聊；花名册三件事仍走本站。模型在后台，下拉只选 modelId。",
          content:
            '<div class="xm-ui-filter-toolbar__controls">' +
            '<label class="agents-model">模型<select class="xm-ui-select" id="agents-model"></select></label></div>' +
            '<details class="agents-connect" id="agents-connect"><summary>接入 GPT（密钥只留在服务器）</summary>' +
            '<p class="xm-ui-page-description" id="agents-connect-note">下拉里灰色的 GPT 是还没接入。官方 OpenAI 填密钥即可；中转再填接口地址和模型名。</p>' +
            '<form id="agents-connect-form">' +
            '<label class="xm-ui-field"><span>密钥</span><input type="password" id="agents-key" name="apiKey" autocomplete="off" placeholder="只提交到本站后台，不会出现在模型列表" /></label>' +
            '<label class="xm-ui-field"><span>接口地址</span><input type="url" id="agents-base" name="apiBase" placeholder="官方可留空，中转填 …/v1" /></label>' +
            '<label class="xm-ui-field"><span>模型名单</span><input type="text" id="agents-models-text" name="modelsText" placeholder="可留空，默认 GPT-4o mini / GPT-4o" /></label>' +
            '<div class="agents-connect-actions">' +
            ui.button({ label: "保存接入", type: "submit", id: "agents-connect-save" }) +
            ui.button({ label: "清除接入", variant: "secondary", id: "agents-connect-clear" }) +
            "</div></form></details>" +
            '<div class="agents-log" id="agents-log"></div>' +
            '<p class="agents-status" id="agents-status" role="status"></p>' +
            '<div class="agents-files" id="agents-files"></div>' +
            '<form class="agents-composer" id="agents-form">' +
            withAttr(ui.button({ label: "上传", variant: "secondary", size: "small", id: "agents-pick" }), "") +
            '<input type="file" id="agents-file" class="xm-ui-sr-only" />' +
            '<textarea id="agents-text" name="text" rows="2" maxlength="2000" placeholder="像问主脑一样提问，回车发送，Shift+回车换行"></textarea>' +
            ui.button({ label: "发送", type: "submit", id: "agents-send" }) +
            "</form>"
        }) +
        "</section></div></main>";

      const pageEl = root.querySelector(".agents-page");
      const sessionsEl = root.querySelector("#agents-sessions");
      const logEl = root.querySelector("#agents-log");
      const statusEl = root.querySelector("#agents-status");
      const homeStatusEl = root.querySelector("#agents-home-status");
      const filesEl = root.querySelector("#agents-files");
      const formEl = root.querySelector("#agents-form");
      const textEl = root.querySelector("#agents-text");
      const sendEl = root.querySelector("#agents-send");
      const newEl = root.querySelector("#agents-new");
      const modelEl = root.querySelector("#agents-model");
      const fileEl = root.querySelector("#agents-file");
      const homeFileEl = root.querySelector("#agents-home-file");
      const homeFormEl = root.querySelector("#agents-home-form");
      const homeTextEl = root.querySelector("#agents-home-text");
      const deepEl = root.querySelector("#agents-deep");
      const connectNoteEl = root.querySelector("#agents-connect-note");
      const connectFormEl = root.querySelector("#agents-connect-form");
      const connectKeyEl = root.querySelector("#agents-key");
      const connectClearEl = root.querySelector("#agents-connect-clear");
      const chatTitleEl = root.querySelector(".agents-chat .xm-ui-section-title h2");
      const chatLeadEl = root.querySelector(".agents-chat .xm-ui-section-title p");
      let dead = false;
      let models = [];
      let preferredModelId = "";
      let sessions = [];
      let current = null;
      let messages = [];
      let pendingFiles = [];
      let overview = null;

      function setStatus(message, isError, home) {
        const el = home ? homeStatusEl : statusEl;
        el.textContent = message || "";
        el.className = "agents-status" + (isError ? " is-error" : "");
      }

      function modelId() {
        return modelEl.value || "desk";
      }

      function showHome() {
        pageEl.classList.remove("is-chat");
        pageEl.classList.add("is-home");
      }

      function showChat() {
        pageEl.classList.remove("is-home");
        pageEl.classList.add("is-chat");
      }

      function withDeep(text) {
        const raw = String(text || "").trim();
        if (!raw) {
          return "";
        }
        return deepEl && deepEl.checked ? "请做深度分析，分步骤给出可执行清单。\n" + raw : raw;
      }

      function renderConnect(info) {
        if (!connectNoteEl || !info) {
          return;
        }
        if (info.locked) {
          connectNoteEl.textContent = "服务环境已接入，下拉可选 GPT。本页不能覆盖服务环境。";
          return;
        }
        if (info.configured) {
          connectNoteEl.textContent = "已接入，下拉可选 GPT。再保存会覆盖本站保存的密钥，不会回显旧密钥。";
          return;
        }
        connectNoteEl.textContent = "下拉里灰色的 GPT 是还没接入。官方 OpenAI 填密钥即可；中转再填接口地址和模型名。";
      }

      function renderModels() {
        const currentId = modelEl.value;
        modelEl.innerHTML = models
          .map(function (item) {
            return (
              '<option value="' +
              escapeHtml(item.id) +
              '"' +
              (item.available ? "" : " disabled") +
              ">" +
              escapeHtml(item.label + (item.available ? "" : "（不可用）")) +
              "</option>"
            );
          })
          .join("");
        if (models.some(function (item) { return item.id === currentId && item.available; })) {
          modelEl.value = currentId;
        } else {
          const prefer = models.find(function (item) { return item.id === preferredModelId && item.available; });
          const first = models.find(function (item) { return item.available; });
          modelEl.value = (prefer || first || { id: "desk" }).id;
        }
      }

      function renderSessions() {
        if (!sessions.length) {
          sessionsEl.innerHTML = "<li>" + ui.EmptyState({ title: "还没有会话", description: "点新会话，或从工作台提问。" }) + "</li>";
          return;
        }
        sessionsEl.innerHTML = sessions
          .map(function (item) {
            const active = current && Number(current.id) === Number(item.id);
            return (
              "<li>" +
              withAttr(
                ui.button({
                  label: item.title,
                  variant: active ? undefined : "secondary",
                  size: "small"
                }),
                'data-session="' + escapeHtml(item.id) + '"'
              ) +
              (item.preview
                ? '<p class="xm-ui-page-description">' + escapeHtml(item.preview) + "</p>"
                : "") +
              "</li>"
            );
          })
          .join("");
      }

      function renderFiles() {
        if (!pendingFiles.length) {
          filesEl.innerHTML = "";
          return;
        }
        filesEl.innerHTML = pendingFiles
          .map(function (item) {
            return ui.StatusBadge({ label: "#" + item.id + " " + item.filename, tone: "blue", dot: false });
          })
          .join("");
      }

      function renderMessages() {
        if (chatTitleEl) {
          chatTitleEl.textContent = current ? current.title || "主脑问答台" : "主脑问答台";
        }
        if (chatLeadEl) {
          chatLeadEl.textContent = current
            ? "后台模型聊运营；本店数字没有接口就不编。答案可引用文件 id。"
            : "选品、做店、日常可聊；花名册三件事仍走本站。";
        }
        if (!current) {
          logEl.innerHTML = ui.EmptyState({ title: "点左侧新会话，或直接提问。", action: "新会话" });
          return;
        }
        if (!messages.length) {
          logEl.innerHTML = ui.EmptyState({ title: "开始提问。" });
          return;
        }
        logEl.innerHTML = messages
          .map(function (item) {
            const who = item.role === "user" ? "is-user" : "is-assistant";
            const cite =
              item.role === "assistant" && item.sources && item.sources.length
                ? '<div class="agents-cite">依据 ' + escapeHtml(item.sources.join("、")) + "</div>"
                : "";
            const files =
              item.fileIds && item.fileIds.length
                ? '<div class="agents-cite">文件 ' +
                  escapeHtml(item.fileIds.map(function (id) { return "#" + id; }).join(" ")) +
                  "</div>"
                : "";
            return '<div class="agents-bubble ' + who + '">' + escapeHtml(item.text) + files + cite + "</div>";
          })
          .join("");
        logEl.scrollTop = logEl.scrollHeight;
      }

      function deltaNote(value) {
        if (value == null) {
          return "暂无上月对照";
        }
        const up = Number(value) >= 0;
        return (up ? "↑ " : "↓ ") + Math.abs(Number(value)) + "%";
      }

      function renderOverview(data) {
        overview = data || overview;
        if (!overview) {
          return;
        }
        const gpt = overview.gpt || {};
        root.querySelector("#agents-kpis").innerHTML =
          ui.StatCard({ label: "今日任务", value: String(overview.today.tasks), icon: "file", tone: "blue", note: overview.today.note }) +
          ui.StatCard({ label: "成功率", value: String(overview.today.successRate), unit: "%", icon: "award", tone: "green" }) +
          ui.StatCard({ label: "节省工时", value: String(overview.today.savedHours), unit: "h", icon: "chart", tone: "orange" }) +
          ui.StatCard({
            label: "智能体运行状态",
            value: gpt.configured ? "运行正常" : "待接入 GPT",
            icon: "play",
            tone: gpt.configured ? "green" : "orange"
          });
        renderConnect(gpt);
        const alerts = root.querySelector("#agents-alerts");
        const items = overview.alerts.available ? overview.alerts.items || [] : [];
        const alertBadge = items.length
          ? '<div id="agents-alert-count">' + ui.StatusBadge({ label: String(items.length), tone: "warning" }) + "</div>"
          : '<div id="agents-alert-count" hidden>0</div>';
        if (!overview.alerts.available) {
          alerts.innerHTML =
            alertBadge +
            ui.EmptyState({
              title: "还没有经营数字接口",
              description: "不会编推广费、转化率或退货异常。向数据中心开口后才能做实时预警。"
            }) +
            ui.DataTable({
              columns: [{ key: "gap", label: "缺口" }],
              rows: (overview.alerts.gaps || []).slice(0, 3).map(function (gap) {
                return { gap: gap };
              })
            });
        } else if (!items.length) {
          alerts.innerHTML = alertBadge + ui.EmptyState({ title: "暂无预警。" });
        } else {
          alerts.innerHTML =
            alertBadge +
            ui.DataTable({
              columns: [
                { key: "title", label: "预警" },
                { key: "status", label: "状态", type: "status" }
              ],
              rows: items.map(function (item) {
                return {
                  title: item.title || item.text || item.message || "预警",
                  status: { label: item.status || "待处理", tone: "warning" }
                };
              })
            });
        }
        const month = overview.month || {};
        const delta = month.delta || {};
        root.querySelector("#agents-month").innerHTML =
          ui.StatCard({
            label: "执行任务数",
            value: String(month.tasks),
            icon: "file",
            tone: "blue",
            note: deltaNote(delta.tasks),
            trend: delta.tasks != null && Number(delta.tasks) >= 0 ? "up" : ""
          }) +
          ui.StatCard({
            label: "处理工时",
            value: String(month.hours),
            unit: "h",
            icon: "chart",
            tone: "green",
            note: deltaNote(delta.hours),
            trend: delta.hours != null && Number(delta.hours) >= 0 ? "up" : ""
          }) +
          ui.StatCard({
            label: "生成素材数",
            value: String(month.files),
            icon: "play",
            tone: "purple",
            note: deltaNote(delta.files)
          }) +
          ui.StatCard({
            label: "会话数",
            value: String(month.sessions),
            icon: "users",
            tone: "orange",
            note: deltaNote(delta.sessions),
            trend: delta.sessions != null && Number(delta.sessions) >= 0 ? "up" : ""
          });
        const recent = overview.recent || [];
        const recentRows = recent.map(function (item) {
          return {
            id: item.id,
            title: item.title,
            status: {
              label: item.status === "进行中" ? "进行中" : "已完成",
              tone: item.status === "进行中" ? "warning" : "success"
            }
          };
        });
        root.querySelector("#agents-recent").innerHTML = recent.length
          ? tableWithRowIds(
              ui.DataTable({
                columns: [
                  { key: "title", label: "任务" },
                  { key: "status", label: "状态", type: "status" }
                ],
                rows: recentRows
              }),
              recentRows
            )
          : ui.EmptyState({ title: "还没有任务。", description: "点上方场景或直接提问。" });
        root.querySelector("#agents-trend").innerHTML = chartSvg(overview.trend);
      }

      function paint() {
        renderModels();
        renderSessions();
        renderFiles();
        renderMessages();
      }

      function loadList() {
        return Promise.all([
          api("/api/agents/models"),
          api("/api/agents/sessions"),
          api("/api/agents/settings"),
          api("/api/agents/overview")
        ]).then(function (pair) {
          if (dead) {
            return;
          }
          models = pair[0].models || [];
          preferredModelId = pair[0].defaultModelId || "";
          sessions = pair[1].sessions || [];
          renderConnect(pair[2]);
          renderOverview(pair[3]);
          paint();
        });
      }

      function openSession(id) {
        setStatus("正在打开…");
        return api("/api/agents/sessions/" + id).then(function (data) {
          if (dead) {
            return;
          }
          current = data.session;
          messages = data.messages || [];
          if (current && current.modelId) {
            modelEl.value = current.modelId;
          }
          setStatus("");
          paint();
        });
      }

      function startSession() {
        setStatus("正在开会话…");
        pendingFiles = [];
        return api("/api/agents/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ modelId: modelId() })
        }).then(function (data) {
          if (dead) {
            return;
          }
          current = data.session;
          messages = data.messages || [];
          setStatus("");
          return loadList();
        });
      }

      function sendChat(text) {
        const payload = {
          sessionId: current ? current.id : undefined,
          modelId: modelId(),
          text: text,
          fileIds: pendingFiles.map(function (item) { return item.id; })
        };
        sendEl.disabled = true;
        setStatus("正在发送…");
        return api("/api/agents/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload)
        })
          .then(function (data) {
            if (dead) {
              return;
            }
            textEl.value = "";
            homeTextEl.value = "";
            pendingFiles = [];
            current = data.session;
            if (data.message && data.reply) {
              const already = messages.some(function (item) { return Number(item.id) === Number(data.message.id); });
              if (!already) {
                messages = messages.concat([data.message, data.reply]);
              }
            }
            setStatus("");
            return loadList();
          })
          .catch(function (err) {
            if (!dead) {
              setStatus(err.message || "发送失败", true);
            }
          })
          .then(function () {
            if (!dead) {
              sendEl.disabled = false;
              textEl.focus();
              paint();
            }
          });
      }

      function ask(text) {
        const q = withDeep(text);
        if (!q) {
          setStatus("请输入内容", true, true);
          return Promise.resolve();
        }
        showChat();
        textEl.value = q;
        const ready = current ? Promise.resolve() : startSession();
        return ready.then(function () {
          return sendChat(q);
        });
      }

      function uploadFile(file, home) {
        if (!file) {
          return;
        }
        setStatus("正在上传…", false, home);
        const body = new FormData();
        body.append("file", file, file.name);
        fetch("/api/agents/uploads", { method: "POST", credentials: "same-origin", body: body })
          .then(function (res) {
            return res.json().catch(function () { return {}; }).then(function (data) {
              if (!res.ok) {
                throw new Error(data.error || "上传失败");
              }
              return data;
            });
          })
          .then(function (data) {
            if (dead) {
              return;
            }
            if (data.file) {
              pendingFiles.push(data.file);
            }
            setStatus("已上传 #" + data.file.id, false, home);
            renderFiles();
          })
          .catch(function (err) {
            if (!dead) {
              setStatus(err.message || "上传失败", true, home);
            }
          });
      }

      if (connectFormEl) {
        connectFormEl.addEventListener("submit", function (event) {
          event.preventDefault();
          const key = connectKeyEl.value.trim();
          if (!key) {
            setStatus("请填写密钥", true);
            return;
          }
          setStatus("正在接入…");
          api("/api/agents/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({
              apiKey: key,
              apiBase: root.querySelector("#agents-base").value.trim(),
              modelsText: root.querySelector("#agents-models-text").value.trim()
            })
          })
            .then(function (data) {
              if (dead) {
                return;
              }
              connectKeyEl.value = "";
              models = data.models || models;
              preferredModelId = data.defaultModelId || preferredModelId;
              renderConnect(data);
              paint();
              setStatus("已接入，下拉可选 GPT");
            })
            .catch(function (err) {
              if (!dead) {
                setStatus(err.message || "接入失败", true);
              }
            });
        });
      }

      if (connectClearEl) {
        connectClearEl.addEventListener("click", function () {
          setStatus("正在清除接入…");
          fetch("/api/agents/settings", { method: "DELETE", credentials: "same-origin", headers: { Accept: "application/json" } })
            .then(function (res) {
              return res.json().catch(function () { return {}; }).then(function (data) {
                if (!res.ok) {
                  throw new Error(data.error || "清除失败");
                }
                return data;
              });
            })
            .then(function (data) {
              if (dead) {
                return;
              }
              models = data.models || models;
              preferredModelId = data.defaultModelId || "desk";
              renderConnect(data);
              paint();
              setStatus("已清除接入");
            })
            .catch(function (err) {
              if (!dead) {
                setStatus(err.message || "清除失败", true);
              }
            });
        });
      }

      function onClick(selector, handler) {
        const el = root.querySelector(selector);
        if (el) {
          el.addEventListener("click", handler);
        }
      }
      onClick("#agents-back", function () {
        showHome();
        loadList().catch(function () {});
      });
      onClick("#agents-all-tools", function () {
        homeTextEl.focus();
      });
      onClick("#agents-all-alerts", function () {
        ask("数据异常监控需要哪些只读接口？现在缺什么？");
      });
      onClick("#agents-open-chat", function () {
        showChat();
        if (!current && sessions.length) {
          openSession(sessions[0].id).catch(function (err) {
            setStatus(err.message || "无法打开", true);
          });
        }
      });
      root.addEventListener("click", function (event) {
        if (event.target.closest("#agents-log .xm-ui-button")) {
          startSession().catch(function (err) {
            setStatus(err.message || "无法开会话", true);
          });
          return;
        }
        const promptBtn = event.target.closest("[data-prompt]");
        if (promptBtn && root.contains(promptBtn)) {
          ask(promptBtn.getAttribute("data-prompt"));
          return;
        }
        const task = event.target.closest("#agents-recent [data-session]");
        if (task) {
          showChat();
          openSession(task.getAttribute("data-session")).catch(function (err) {
            setStatus(err.message || "无法打开", true);
          });
        }
      });

      newEl.addEventListener("click", function () {
        startSession().catch(function (err) {
          if (!dead) {
            setStatus(err.message || "无法开会话", true);
          }
        });
      });

      sessionsEl.addEventListener("click", function (event) {
        const button = event.target.closest("[data-session]");
        if (!button) {
          return;
        }
        openSession(button.getAttribute("data-session")).catch(function (err) {
          if (!dead) {
            setStatus(err.message || "无法打开", true);
          }
        });
      });

      function bindPick(buttonId, inputEl, home) {
        const btn = root.querySelector(buttonId);
        if (!btn) {
          return;
        }
        btn.addEventListener("click", function () {
          inputEl.click();
        });
        inputEl.addEventListener("change", function () {
          const file = inputEl.files && inputEl.files[0];
          inputEl.value = "";
          uploadFile(file, home);
        });
      }
      bindPick("#agents-pick", fileEl, false);
      bindPick("#agents-home-pick", homeFileEl, true);

      formEl.addEventListener("submit", function (event) {
        event.preventDefault();
        const text = textEl.value.trim();
        if (!text) {
          setStatus("请输入内容", true);
          return;
        }
        sendChat(text);
      });

      homeFormEl.addEventListener("submit", function (event) {
        event.preventDefault();
        ask(homeTextEl.value);
      });

      textEl.addEventListener("keydown", function (event) {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          formEl.requestSubmit();
        }
      });
      homeTextEl.addEventListener("keydown", function (event) {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          homeFormEl.requestSubmit();
        }
      });

      loadList().catch(function (err) {
        if (!dead) {
          setStatus(err.message || "无法加载问答台", true, true);
        }
      });

      return function unmount() {
        dead = true;
        root.innerHTML = "";
      };
    }
  };
})();
