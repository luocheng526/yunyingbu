/* xm-module-agents 0.1.148 */
(function () {
  var SPARK =
    '<svg class="agents-spark" viewBox="0 0 28 28" aria-hidden="true">' +
    '<path fill="#2f7bff" d="M9 1.2l2.4 6.4 6.4 2.4-6.4 2.4L9 18.8 6.6 12.4 0.2 10l6.4-2.4z"/>' +
    '<path fill="#7cb6ff" d="M22 11l1.3 3.2L26.5 15.5 23.3 16.8 22 20l-1.3-3.2L17.5 15.5 20.7 14.2z"/>' +
    "</svg>";

  var BOT =
    '<svg class="agents-bot" viewBox="0 0 180 168" aria-hidden="true">' +
    '<defs><linearGradient id="agbot" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#7db7ff"/><stop offset="1" stop-color="#2f7bff"/></linearGradient></defs>' +
    '<ellipse cx="90" cy="154" rx="46" ry="8" fill="#d7e8ff"/>' +
    '<rect x="74" y="18" width="8" height="22" rx="4" fill="#93c5fd"/>' +
    '<circle cx="78" cy="16" r="8" fill="#60a5fa"/><circle cx="78" cy="16" r="3.5" fill="#fbbf24"/>' +
    '<rect x="42" y="46" width="96" height="82" rx="36" fill="url(#agbot)"/>' +
    '<circle cx="68" cy="82" r="13" fill="#fff"/><circle cx="112" cy="82" r="13" fill="#fff"/>' +
    '<circle cx="71" cy="84" r="6" fill="#163a8a"/><circle cx="115" cy="84" r="6" fill="#163a8a"/>' +
    '<circle cx="62" cy="102" r="5" fill="#93c5fd" opacity=".7"/><circle cx="118" cy="102" r="5" fill="#93c5fd" opacity=".7"/>' +
    '<rect x="78" y="104" width="24" height="7" rx="3.5" fill="#dbeafe"/>' +
    "</svg>";

  var MINI_BOT =
    '<svg class="agents-mini-bot" viewBox="0 0 80 80" aria-hidden="true">' +
    '<rect x="14" y="18" width="52" height="48" rx="20" fill="#2f7bff"/>' +
    '<circle cx="32" cy="40" r="7" fill="#fff"/><circle cx="48" cy="40" r="7" fill="#fff"/>' +
    '<circle cx="33" cy="41" r="3.2" fill="#163a8a"/><circle cx="49" cy="41" r="3.2" fill="#163a8a"/>' +
    '<rect x="34" y="52" width="12" height="4" rx="2" fill="#dbeafe"/>' +
    "</svg>";

  function icon(path, color) {
    return (
      '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="' +
      color +
      '" d="' +
      path +
      '"/></svg>'
    );
  }

  var SCENES = [
    {
      id: "qa",
      title: "电商知识问答",
      text: "运营问题、平台规则、玩法策略、SOP 流程即时解答",
      prompt: "电商运营里，选品和平台规则日常要注意什么？",
      ico: icon("M4 4h12a2 2 0 012 2v7a2 2 0 01-2 2H9l-5 5V6a2 2 0 012-2zm14 4h2a2 2 0 012 2v7l-4 4v-3h-2", "#2f7bff")
    },
    {
      id: "create",
      title: "创作与运营执行",
      text: "主图 / 详情图 / 海报 / 标题 / 卖点文案、上新、优化等日常工作",
      prompt: "怎么做主图、详情和标题？日常做店怎么排？",
      ico: icon("M4 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2zm3 12h10v2H7zM8 8l2.5 3 2-2.5L16 13H8z", "#7c3aed")
    },
    {
      id: "diag",
      title: "店铺分析与诊断",
      text: "店铺健康度、流量 / 转化 / 利润问题定位与优化建议",
      prompt: "店铺健康一般看哪些指标？本店近30天如果没有接口请直接说还没有。",
      ico: icon("M3 21V8h6v13H3zm6 0V3h6v18H9zm6 0v-8h6v8h-6z", "#16a34a")
    },
    {
      id: "market",
      title: "行业大盘分析",
      text: "行业趋势、竞争格局、热销商品、价格带、机会赛道分析",
      prompt: "行业大盘和竞品分析一般怎么做？没有外数就说还没有。",
      ico: icon("M4 19h16v2H4zM7 10h3v7H7zm5-5h3v12h-3zm5 8h3v4h-3z", "#f59e0b")
    },
    {
      id: "watch",
      title: "数据异常监控",
      text: "公司 / 店铺经营数据实时监控，异常预警、原因分析与处置建议",
      prompt: "数据异常监控需要哪些只读接口？现在缺什么？",
      ico: icon("M12 3a6 6 0 016 6v3.5l2 2.5H4l2-2.5V9a6 6 0 016-6zm-2 16a2 2 0 004 0z", "#ef4444")
    }
  ];

  var TOOLS = [
    { tone: "sky", ico: icon("M4 5h16v10H4zm2 12h12v2H6zM8 8l2.2 2.8L13 8.5 16 13H8z", "#2f7bff"), name: "主图生成", prompt: "帮我规划一组商品主图：构图、卖点和测图顺序。" },
    { tone: "lilac", ico: icon("M5 4h10l4 4v12H5zM15 4v4h4", "#7c3aed"), name: "详情图生成", prompt: "按转化路径拆一套详情页模块和文案。" },
    { tone: "sand", ico: icon("M5 4h14v3H5zm0 5h14v11H5zm3 3h8v2H8z", "#d97706"), name: "标题优化", prompt: "写三个高转化商品标题，并说明关键词怎么放。" },
    { tone: "mint", ico: icon("M9 21h6v-2H9zM12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z", "#16a34a"), name: "卖点提炼", prompt: "从人群和场景出发，提炼五条商品卖点。" },
    { tone: "rose", ico: icon("M4 20l3.5-9L12 16l4.5-8L20 20z", "#db2777"), name: "文案生成", prompt: "写一段主图短文案和一段详情页长文案。" },
    { tone: "sky", ico: icon("M4 5h11a2 2 0 012 2v7H8l-4 4z", "#2563eb"), name: "评价回复", prompt: "给好评、中评、差评各写一条客服回复口径。" },
    { tone: "sand", ico: icon("M7 14a5 5 0 117.07-7.07L17 10a5 5 0 11-7.07 7.07z", "#d97706"), name: "关键词拓展", prompt: "围绕这个品拓展搜索词和标题词，不要编本店成交。" },
    { tone: "lilac", ico: icon("M4 19h16v2H4zM6 10h3v7H6zm5-6h3v13h-3zm5 8h3v5h-3z", "#7c3aed"), name: "竞品分析", prompt: "没有外数时，竞品分析应看哪些公开信息和本站缺口？" },
    { tone: "mint", ico: icon("M12 3l3 6 7 .8-5 4.4L18.5 21 12 17.8 5.5 21 7 14.2 2 9.8 9 9z", "#16a34a"), name: "活动方案", prompt: "给一场店铺活动写节奏：预热、爆发、收尾。" }
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
    link.href = "/agents.css";
    document.head.appendChild(link);
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
        return '<line x1="' + left + '" x2="' + (w - right) + '" y1="' + y + '" y2="' + y + '" stroke="currentColor" stroke-opacity=".12"/>';
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
          '<text x="' +
          xAt(i).toFixed(1) +
          '" y="' +
          (h - 6) +
          '" text-anchor="middle" font-size="9" fill="currentColor">' +
          escapeHtml(item.date) +
          "</text>"
        );
      })
      .join("");
    return (
      '<svg class="agents-chart" viewBox="0 0 ' +
      w +
      " " +
      h +
      '" role="img" aria-label="本模块任务与工时趋势">' +
      grid +
      '<polygon fill="#2f7bff" fill-opacity=".12" points="' +
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
      '<polyline fill="none" stroke="#2f7bff" stroke-width="2.4" stroke-linejoin="round" points="' +
      taskPts +
      '"/>' +
      '<polyline fill="none" stroke="#22c55e" stroke-width="2.4" stroke-linejoin="round" points="' +
      hourPts +
      '"/>' +
      '<circle cx="' +
      lastX +
      '" cy="' +
      yAt(last.tasks, maxTasks).toFixed(1) +
      '" r="3.5" fill="#2f7bff"/>' +
      '<circle cx="' +
      lastX +
      '" cy="' +
      yAt(last.hours, maxHours).toFixed(1) +
      '" r="3.5" fill="#22c55e"/>' +
      labels +
      "</svg>"
    );
  }

  window.XmModules = window.XmModules || {};
  window.XmModules["/agents"] = {
    mount: function (root) {
      ensureCss();
      root.innerHTML =
        '<main class="page agents-page is-home">' +
        '<section class="agents-home" aria-label="甄选智能体工作台">' +
        '<header class="agents-hero">' +
        "<div><p class=\"kicker\">甄选智能体</p><h1>电商运营智能体 " +
        SPARK +
        "</h1>" +
        "<p class=\"lead\">你的 AI 电商运营团队：问答、创作、诊断、分析、监控，提升运营效率与经营结果。本店近30天、商学院、外数没有接口就不编。改价、退款、发版不会做。</p></div>" +
        '<div class="agents-bot-wrap">' +
        BOT +
        "</div>" +
        '<div class="agents-status-card"><div class="row"><span>智能体运行状态</span><span class="agents-pill" id="agents-run">检测中</span></div>' +
        '<div class="agents-kpis">' +
        '<div><span>今日任务</span><b id="kpi-tasks">0</b></div>' +
        '<div><span>成功率</span><b id="kpi-rate">0%</b></div>' +
        '<div><span>节省工时</span><b id="kpi-hours">0 h</b></div>' +
        "</div><p class=\"agents-note\" id=\"kpi-note\"></p></div></header>" +
        '<div class="agents-scenes" id="agents-scenes">' +
        SCENES.map(function (item) {
          return (
            '<button type="button" class="agents-scene ' +
            item.id +
            '" data-prompt="' +
            escapeHtml(item.prompt) +
            '"><span class="ico">' +
            item.ico +
            "</span><strong>" +
            escapeHtml(item.title) +
            "</strong><p>" +
            escapeHtml(item.text) +
            '</p><span class="go">立即使用 →</span></button>'
          );
        }).join("") +
        "</div>" +
        '<div class="agents-mid">' +
        '<div class="agents-panel agents-ask"><div class="agents-ask-head">' +
        '<div class="agents-mini-wrap"><span class="agents-hi">Hi</span>' +
        MINI_BOT +
        "</div>" +
        "<div><h2>嗨！我是甄选智能体</h2><p>我可以帮你解决电商运营中的各种问题，支持问答、创作、分析、诊断和数据监控。</p></div></div>" +
        '<div class="agents-chips" id="agents-chips">' +
        CHIPS.map(function (item) {
          return '<button type="button" class="agents-chip-btn" data-prompt="' + escapeHtml(item.prompt) + '">' + escapeHtml(item.label) + "</button>";
        }).join("") +
        "</div>" +
        '<form class="agents-home-form" id="agents-home-form">' +
        '<textarea id="agents-home-text" maxlength="2000" placeholder="请输入你的问题或任务，例如：帮我分析店铺 ROI 下降的原因"></textarea>' +
        '<div class="agents-home-bar"><label class="agents-upload">+ 上传<input type="file" id="agents-home-file" /></label>' +
        '<span class="grow"></span><label class="agents-toggle"><input type="checkbox" id="agents-deep" /> 深度分析</label>' +
        '<button type="submit">发送</button></div></form>' +
        '<p class="agents-status" id="agents-home-status" role="status"></p></div>' +
        '<div class="agents-panel"><div class="agents-panel-head"><h2>常用工具</h2><button type="button" id="agents-all-tools">全部工具</button></div>' +
        '<div class="agents-tools" id="agents-tools">' +
        TOOLS.map(function (item) {
          return (
            '<button type="button" class="agents-tool" data-prompt="' +
            escapeHtml(item.prompt) +
            '"><span class="tool-ico ' +
            item.tone +
            '">' +
            item.ico +
            "</span>" +
            escapeHtml(item.name) +
            "</button>"
          );
        }).join("") +
        "</div></div>" +
        '<div class="agents-panel"><div class="agents-panel-head"><h2>数据异常预警 <span class="agents-badge" id="agents-alert-count">0</span></h2><button type="button" class="agents-link" id="agents-all-alerts">全部预警</button></div>' +
        '<div class="agents-alerts" id="agents-alerts"><p class="agents-empty">正在读取…</p></div></div></div>' +
        '<div class="agents-low">' +
        '<div class="agents-panel"><div class="agents-panel-head"><h2>智能体任务运行中</h2><button type="button" id="agents-open-chat">查看全部</button></div>' +
        '<div id="agents-recent"></div></div>' +
        '<div class="agents-panel"><h2>本月智能体使用数据</h2><p class="agents-note">只统计本模块对话，不是店铺成交。</p>' +
        '<div class="agents-month" id="agents-month"></div></div>' +
        '<div class="agents-panel"><div class="agents-panel-head"><h2>智能体价值趋势</h2><div class="agents-legend"><span class="is-tasks">任务数</span><span class="is-hours">节省工时(h)</span></div></div>' +
        '<div id="agents-trend"></div></div></div></section>' +
        '<div class="agents-workbench">' +
        '<aside class="agents-rail" aria-label="历史会话">' +
        '<button type="button" class="agents-back" id="agents-back">← 工作台</button>' +
        "<h2>历史会话</h2>" +
        '<button type="button" class="agents-new" id="agents-new">新会话</button>' +
        '<ul class="agents-threads" id="agents-sessions"></ul></aside>' +
        '<section class="agents-chat" aria-label="主脑问答台">' +
        '<div class="agents-chat-head"><div><h2 id="agents-chat-title">主脑问答台</h2>' +
        '<p id="agents-chat-lead">选品、做店、日常可聊；花名册三件事仍走本站。模型在后台，下拉只选 modelId。</p></div>' +
        '<label class="agents-model">模型<select id="agents-model"></select></label></div>' +
        '<details class="agents-connect" id="agents-connect"><summary>接入 GPT（密钥只留在服务器）</summary>' +
        '<p class="agents-connect-note" id="agents-connect-note">下拉里灰色的 GPT 是还没接入。官方 OpenAI 填密钥即可；中转再填接口地址和模型名。</p>' +
        '<form id="agents-connect-form">' +
        '<label>密钥<input type="password" id="agents-key" name="apiKey" autocomplete="off" placeholder="只提交到本站后台，不会出现在模型列表" /></label>' +
        '<label>接口地址<input type="url" id="agents-base" name="apiBase" placeholder="官方可留空，中转填 …/v1" /></label>' +
        '<label>模型名单<input type="text" id="agents-models-text" name="modelsText" placeholder="可留空，默认 GPT-4o mini / GPT-4o" /></label>' +
        '<div class="agents-connect-actions"><button type="submit" id="agents-connect-save">保存接入</button>' +
        '<button type="button" class="agents-connect-clear" id="agents-connect-clear">清除接入</button></div></form></details>' +
        '<div class="agents-log" id="agents-log"><p class="agents-empty">正在打开会话…</p></div>' +
        '<p class="agents-status" id="agents-status" role="status"></p>' +
        '<div class="agents-files" id="agents-files"></div>' +
        '<form class="agents-composer" id="agents-form">' +
        '<label class="agents-upload">上传<input type="file" id="agents-file" /></label>' +
        '<textarea id="agents-text" name="text" rows="2" maxlength="2000" placeholder="像问主脑一样提问，回车发送，Shift+回车换行"></textarea>' +
        '<button type="submit" id="agents-send">发送</button></form></section></div></main>';

      const pageEl = root.querySelector(".agents-page");
      const sessionsEl = root.querySelector("#agents-sessions");
      const titleEl = root.querySelector("#agents-chat-title");
      const leadEl = root.querySelector("#agents-chat-lead");
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
        const pill = root.querySelector("#agents-run");
        if (pill) {
          pill.textContent = info.configured ? "运行正常" : "待接入 GPT";
          pill.className = "agents-pill" + (info.configured ? "" : " is-off");
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
          sessionsEl.innerHTML = '<li class="agents-empty">还没有会话</li>';
          return;
        }
        sessionsEl.innerHTML = sessions
          .map(function (item) {
            const on = current && Number(current.id) === Number(item.id) ? " is-active" : "";
            return (
              '<li><button type="button" class="agents-thread' +
              on +
              '" data-session="' +
              escapeHtml(item.id) +
              '"><span class="name">' +
              escapeHtml(item.title) +
              '</span><span class="meta">' +
              escapeHtml(item.preview || item.updatedAt || "") +
              "</span></button></li>"
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
            return (
              '<span class="agents-chip">#' +
              escapeHtml(item.id) +
              " " +
              escapeHtml(item.filename) +
              "</span>"
            );
          })
          .join("");
      }

      function renderMessages() {
        if (!current) {
          titleEl.textContent = "主脑问答台";
          leadEl.textContent = "选品、做店、日常可聊；花名册三件事仍走本站。";
          logEl.innerHTML = '<p class="agents-empty">点左侧新会话，或直接提问。</p>';
          return;
        }
        titleEl.textContent = current.title || "主脑问答台";
        leadEl.textContent = "后台模型聊运营；本店数字没有接口就不编。答案可引用文件 id。";
        if (!messages.length) {
          logEl.innerHTML = '<p class="agents-empty">开始提问。</p>';
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

      function deltaHtml(value) {
        if (value == null) {
          return '<span class="delta is-flat">暂无上月对照</span>';
        }
        const up = Number(value) >= 0;
        return (
          '<span class="delta ' +
          (up ? "is-up" : "is-down") +
          '">' +
          (up ? "↑" : "↓") +
          " " +
          Math.abs(Number(value)) +
          "%</span>"
        );
      }

      function renderOverview(data) {
        overview = data || overview;
        if (!overview) {
          return;
        }
        root.querySelector("#kpi-tasks").textContent = String(overview.today.tasks);
        root.querySelector("#kpi-rate").textContent = overview.today.successRate + "%";
        root.querySelector("#kpi-hours").textContent = overview.today.savedHours + " h";
        root.querySelector("#kpi-note").textContent = overview.today.note || "";
        renderConnect(overview.gpt);
        const alerts = root.querySelector("#agents-alerts");
        const countEl = root.querySelector("#agents-alert-count");
        const items = overview.alerts.available ? overview.alerts.items || [] : [];
        countEl.textContent = String(items.length);
        countEl.hidden = items.length === 0;
        if (!overview.alerts.available) {
          alerts.innerHTML =
            '<div class="agents-alert is-gap"><strong>还没有经营数字接口</strong><p>不会编推广费、转化率或退货异常。向数据中心开口后才能做实时预警。</p></div>' +
            (overview.alerts.gaps || [])
              .slice(0, 3)
              .map(function (item) {
                return '<div class="agents-alert"><strong>缺口</strong><p>' + escapeHtml(item) + "</p></div>";
              })
              .join("");
        } else if (!items.length) {
          alerts.innerHTML = '<p class="agents-empty">暂无预警。</p>';
        }
        const month = overview.month || {};
        const delta = month.delta || {};
        root.querySelector("#agents-month").innerHTML =
          "<div><span>执行任务数</span><b>" +
          escapeHtml(month.tasks) +
          "</b>" +
          deltaHtml(delta.tasks) +
          "</div><div><span>处理工时</span><b>" +
          escapeHtml(month.hours) +
          " h</b>" +
          deltaHtml(delta.hours) +
          "</div><div><span>生成素材数</span><b>" +
          escapeHtml(month.files) +
          "</b>" +
          deltaHtml(delta.files) +
          "</div><div><span>会话数</span><b>" +
          escapeHtml(month.sessions) +
          "</b>" +
          deltaHtml(delta.sessions) +
          "</div>";
        const recent = overview.recent || [];
        root.querySelector("#agents-recent").innerHTML = recent.length
          ? recent
              .map(function (item) {
                const running = item.status === "进行中";
                const pct = running ? 60 : 100;
                return (
                  '<button type="button" class="agents-task" data-session="' +
                  escapeHtml(item.id) +
                  '"><span class="task-ico">' +
                  (running ? "◌" : "✓") +
                  '</span><div class="task-body"><div class="name">' +
                  escapeHtml(item.title) +
                  '</div><div class="bar"><i style="width:' +
                  pct +
                  '%"></i></div></div><span class="task-pct">' +
                  (running ? "进行中" : "已完成") +
                  "</span></button>"
                );
              })
              .join("")
          : '<p class="agents-empty">还没有任务。点上方场景或直接提问。</p>';
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

      root.querySelector("#agents-back").addEventListener("click", function () {
        showHome();
        loadList().catch(function () {});
      });
      root.querySelector("#agents-open-chat").addEventListener("click", function () {
        showChat();
        if (!current && sessions.length) {
          openSession(sessions[0].id).catch(function (err) {
            setStatus(err.message || "无法打开", true);
          });
        }
      });
      root.querySelector("#agents-all-tools").addEventListener("click", function () {
        homeTextEl.focus();
      });
      root.querySelector("#agents-all-alerts").addEventListener("click", function () {
        ask("数据异常监控需要哪些只读接口？现在缺什么？");
      });
      root.addEventListener("click", function (event) {
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

      fileEl.addEventListener("change", function () {
        const file = fileEl.files && fileEl.files[0];
        fileEl.value = "";
        uploadFile(file, false);
      });
      homeFileEl.addEventListener("change", function () {
        const file = homeFileEl.files && homeFileEl.files[0];
        homeFileEl.value = "";
        uploadFile(file, true);
      });

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
