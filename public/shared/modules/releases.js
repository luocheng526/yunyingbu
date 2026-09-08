/* xm-module-releases 0.1.89-board-paths */
/* xm-china-time 0.1.27 */
/* xm-upgrade-mask 0.1.45 */
(function () {
  const STYLE_ID = "xm-mod-releases-style";
  const CSS = `
      #upgrade-mask {
        display: none;
        position: fixed;
        inset: 0;
        z-index: 2147483000;
        background: rgba(20, 18, 11, 0.45);
        align-items: center;
        justify-content: center;
        padding: 1.25rem;
      }
      html[data-theme="dark"] #upgrade-mask { background: rgba(0, 0, 0, 0.55); }
      #upgrade-mask.show,
      html > #upgrade-mask.show,
      body > #upgrade-mask.show {
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
      }
      html:has(.oc-wrap) .xm-shell.is-pending .xm-content {
        pointer-events: auto !important;
        opacity: 1 !important;
      }
      .upgrade-card {
        position: relative;
        width: min(36rem, 100%);
        background: var(--xm-card, #fff);
        color: var(--xm-ink, #14120b);
        border: 1px solid var(--xm-line, #e4e2da);
        border-radius: 10px;
        padding: 1.4rem 3.4rem 1.3rem 1.5rem;
        box-shadow: var(--xm-shadow, 0 20px 50px rgba(0, 0, 0, 0.25));
      }
      .upgrade-card h2 { margin: 0 0 0.85rem; font-size: 1.2rem; padding-right: 0.5rem; }
      .upgrade-card ol { margin: 0 0 1rem; padding-left: 1.2rem; }
      .upgrade-card li { margin: 0.35rem 0; color: var(--xm-muted, #6f6e69); }
      .upgrade-card li.on { color: var(--xm-ink, #14120b); font-weight: 650; }
      .upgrade-card li.ok { color: var(--xm-ok, #15803d); }
      .upgrade-card li.bad { color: var(--xm-danger, #be123c); }
      .upgrade-bar {
        height: 0.45rem;
        background: var(--xm-primary-soft, #eceae3);
        border-radius: 999px;
        overflow: hidden;
      }
      .upgrade-bar i {
        display: block;
        height: 100%;
        width: 8%;
        background: var(--xm-ink, #14120b);
        border-radius: 999px;
        transition: width 0.25s ease;
      }
      .upgrade-log {
        margin: 0.85rem 0 0;
        color: var(--xm-danger, #9f1239);
        font-size: 0.88rem;
        white-space: pre-wrap;
        max-height: 10rem;
        overflow: auto;
      }
      #upgrade-dismiss {
        display: none;
        position: absolute;
        top: 12px;
        right: 12px;
        margin: 0;
        z-index: 1;
      }
      #upgrade-mask.can-close #upgrade-dismiss { display: inline-block; }
      .pane, .xm-content .pane { display: none !important; }
      .pane.on, .xm-content .pane.on { display: block !important; }
      html, html body, html body.xm-app, html body.xm-app-shell {
        height: 100% !important; max-height: 100dvh !important; overflow: hidden !important;
      }
      .xm-shell {
        display: flex !important; height: 100dvh !important; max-height: 100dvh !important; min-height: 0 !important; overflow: hidden !important;
      }
      .xm-shell .xm-main {
        display: flex !important; flex-direction: column !important; flex: 1 1 0% !important; min-height: 0 !important; overflow: hidden !important;
      }
      .xm-content, .xm-shell .xm-content {
        flex: 1 1 auto !important; height: auto !important; min-height: 0 !important; overflow-y: auto !important; touch-action: pan-y;
      }
      html:has(.oc-wrap), html:has(.oc-wrap) body, html:has(.oc-wrap) body.xm-app, html:has(.oc-wrap) body.xm-app-shell {
        height: 100% !important; max-height: 100dvh !important; overflow: hidden !important;
      }
      .xm-shell:has(.oc-wrap) {
        display: flex !important; height: 100dvh !important; max-height: 100dvh !important; min-height: 0 !important; overflow: hidden !important;
      }
      .xm-shell:has(.oc-wrap) .xm-main {
        display: flex !important; flex-direction: column !important; flex: 1 1 0% !important; min-height: 0 !important; overflow: hidden !important;
      }
      .xm-content:has(.oc-wrap), .xm-shell:has(.oc-wrap) .xm-content {
        flex: 1 1 auto !important; height: auto !important; min-height: 0 !important; overflow-y: auto !important; touch-action: pan-y;
      }
      #history-view, #logs-view {
        max-height: calc(100dvh - 15rem); overflow-y: scroll !important; touch-action: pan-y;
      }
      .oc-wrap.page, .oc-wrap.xm-page { max-width: none !important; width: 100%; margin: 0 !important; background: var(--xm-card, #fff); border: 0 !important; border-radius: 0; padding: 10px 16px 16px; }
      html:has(.oc-wrap) .xm-content, .xm-content:has(.oc-wrap) { padding: 0 !important; }
      .oc-hero-card { background: transparent; border: 0; box-shadow: none; padding: 0 0 10px; margin: 0 0 12px; }
      .oc-tabs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0; }
      .oc-tab, button.oc-tab { background: transparent !important; outline: none !important; -webkit-tap-highlight-color: transparent; }
      .oc-tab:hover, .oc-tab:focus, .oc-tab:focus-visible, .oc-tab:active, .oc-tab.active,
      button.oc-tab:hover, button.oc-tab:focus, button.oc-tab:focus-visible, button.oc-tab:active, button.oc-tab.active {
        background: transparent !important; background-color: transparent !important; outline: none !important;
      }
      .oc-tab-num { display: block; margin: 0.25rem 0 0.1rem; font-size: 1.35rem; font-weight: 750; }
      .oc-tab.active .oc-tab-num { color: inherit; }
      .oc-tab p { display: block; margin: 0; font-size: 12px; }
      .sc-table tr.ticket { border: 0; box-shadow: none; padding: 0; background: transparent; }
      .sc-ver { font-weight: 650; color: #2563eb; }
    `;
  const HTML = `<div class="oc-wrap page xm-page">
      <section class="oc-hero-card">
        <section class="oc-hero">
          <div>
            <p class="kicker oc-kicker">RELEASE GATE</p>
            <h1>版本发布中心</h1>
            <p class="oc-path">待上线 · 版本记录 · 运行日志</p>
          </div>
          <div class="oc-run">
            <span class="pill run">运行 <span class="ver" id="app-version">读取版本中</span></span>
            <button type="button" class="act secondary" id="refresh-btn">刷新</button>
          </div>
        </section>
        <nav class="oc-tabs" aria-label="版本发布中心页签">
          <button type="button" class="oc-tab active" data-tab="queue">
            <h2>待上线</h2>
            <strong class="oc-tab-num" id="tab-queue-count">—</strong>
            <p id="tab-queue-sub">待审批</p>
          </button>
          <button type="button" class="oc-tab" data-tab="history">
            <h2>版本记录</h2>
            <strong class="oc-tab-num" id="tab-history-count">—</strong>
            <p id="tab-history-sub">个正式版</p>
          </button>
          <button type="button" class="oc-tab" data-tab="logs">
            <h2>运行日志</h2>
            <strong class="oc-tab-num oc-tab-num-text">流水</strong>
            <p id="tab-logs-sub">发版流水</p>
          </button>
        </nav>
      </section>

      <div id="flash" class="flash" role="status"></div>
      <section class="oc-card panel">
        <div class="pane on" id="pane-queue">
          <h3>待上线</h3>
          <p class="hint lead">这是版本发布中心。交单后按提交时间排队，先交先发，不能上移、下移或插队。闸门只允许「通过」第 1 位，避免叠发把进程打崩。版本号由本闸门统一发放，全站一条号 0.1.N-说明，各模块不得自领；同一号段不能跨模块再用。只改页面或测试文件时不重启进程，正在使用的人不会掉线；改到 src 或依赖才会重启。通过后先拍快照再本机落地。站点恢复后就地刷新并关升级遮罩，不再整页跳转。有新单据约 15 秒内自动提示，不会自动点通过。待上线、版本记录、运行日志都分页，每页 20 条。版本记录和运行日志按页向服务器取，刷新只读当前页，不再一次拉全表。</p>
          <div class="caps" id="stat-caps"></div>
          <div class="note banner">发布纪律：本页是唯一发版闸门。只执行交来的单据 + 本页「通过」。按提交时间点第 1 位；一把锁，禁止抢发；下一条不会自动发。「帮我上线」无效。新文件只放源目录，不要先拷到线上；点通过才落地。闸门不读 git，也不拉 Cloud 工作区，交单只登记路径。可带 contents（路径→正文）或 ref（分支/提交），闸门会先写入源目录。源目录与线上相同会失败。</div>
          <div id="lock-view" class="lock-box idle">当前空闲，没有发布任务。</div>
          <div id="queue-view" class="tickets"></div>
        </div>
        <div class="pane" id="pane-history">
          <h3>版本记录</h3>
          <p class="hint">各模块当前版本来自最近一次成功发布。下一号由本闸门发放。版本记录只记每次升级的简要内容，从最新到最老，每页 20 条，按页向服务器取。上方统计已成功落地的版本数，含已回滚。详细流水在「运行日志」。有升级前快照的单据可以回滚；回滚占用发布锁，不会自动发下一单。</p>
          <div id="history-stats" class="history-stats">已上线发布 <b>0</b> 个版本</div>
          <div id="current-versions" class="caps"></div>
          <div id="history-view"></div>
        </div>
        <div class="pane" id="pane-logs">
          <h3>运行日志</h3>
          <p class="hint">每张单上的发版流水 log。按页向服务器取，每页 20 条，刷新只读当前页。</p>
          <div id="logs-view" class="log-list"></div>
        </div>
      </section>
    </div>

    <div id="upgrade-mask" aria-live="assertive" aria-modal="true" role="dialog">
      <div class="upgrade-card">
        <h2 id="upgrade-title">正在升级，请勿关闭</h2>
        <button type="button" class="act" id="upgrade-dismiss">关闭</button>
        <ol id="upgrade-steps"></ol>
        <div class="upgrade-bar"><i id="upgrade-bar"></i></div>
        <p class="upgrade-log" id="upgrade-log" hidden></p>
      </div>
    </div>`;

  function ensureCss() {
    if (!document.getElementById(STYLE_ID)) {
      const styleEl = document.createElement("style");
      styleEl.id = STYLE_ID;
      styleEl.textContent = CSS;
      document.head.appendChild(styleEl);
    }
    if (!document.querySelector('link[rel="stylesheet"][href*="/releases.css"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/releases.css?v=sc-ui-9";
      document.head.appendChild(link);
    }
  }

  window.XmModules = window.XmModules || {};
  window.XmModules["/releases"] = {
    mount: function (root) {
      ensureCss();
      root.innerHTML = HTML;
      const mask = root.querySelector("#upgrade-mask");
      if (mask && mask.parentNode !== document.documentElement) {
        document.documentElement.appendChild(mask);
      }
      const timers = [];
      const listeners = [];
      const realSetInterval = window.setInterval;
      const realSetTimeout = window.setTimeout;
      function hookEvents(target) {
        const orig = target.addEventListener;
        target.addEventListener = function (type, fn, opts) {
          orig.call(target, type, fn, opts);
          listeners.push({ target: target, type: type, fn: fn, opts: opts });
        };
        return function () {
          target.addEventListener = orig;
        };
      }
      const restoreBodyEvents = hookEvents(document.body);
      const restoreDocEvents = hookEvents(document);
      window.setInterval = function (fn, ms) {
        const id = realSetInterval(fn, ms);
        timers.push({ kind: "interval", id: id });
        return id;
      };
      window.setTimeout = function (fn, ms) {
        const id = realSetTimeout(fn, ms);
        timers.push({ kind: "timeout", id: id });
        return id;
      };
      try {

      const flashEl = document.getElementById("flash");
      const crumb = document.querySelector(".oc-crumb");
      const tabTitles = {
        queue: "版本发布中心 / 待上线",
        history: "版本发布中心 / 版本记录",
        logs: "版本发布中心 / 运行日志"
      };
      const WATCH_MS = 15000;
      const PAGE_SIZE = 20;
      const UPGRADE_PENDING_KEY = "oc-after-upgrade";
      let knownQueueIds = null;
      let lastLock = { locked: false };
      const listPages = { queue: 1, history: 1, logs: 1 };

      function setText(idOrEl, text) {
        const el = typeof idOrEl === "string" ? document.getElementById(idOrEl) : idOrEl;
        if (!el) {
          return;
        }
        el.textContent = text;
      }
      function flash(message, isError) {
        if (!flashEl) {
          return;
        }
        flashEl.textContent = message;
        flashEl.className = "flash show" + (isError ? " err" : "");
      }
      function goLogin() {
        window.location.replace("/login");
      }
      async function api(path, options) {
        const opts = options || {};
        const skipLoginRedirect = Boolean(opts.skipLoginRedirect);
        const fetchOpts = Object.assign({}, opts);
        delete fetchOpts.skipLoginRedirect;
        const ac = new AbortController();
        const timer = setTimeout(function () { ac.abort(); }, 60000);
        let res;
        try {
          res = await fetch(path, {
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            signal: ac.signal,
            ...fetchOpts
          });
        } catch (err) {
          if (err && err.name === "AbortError") {
            const timeoutErr = new Error("请求超时");
            timeoutErr.status = 408;
            throw timeoutErr;
          }
          throw err;
        } finally {
          clearTimeout(timer);
        }
        if (res.status === 401) {
          if (!skipLoginRedirect) {
            goLogin();
          }
          const err = new Error("未登录");
          err.status = 401;
          throw err;
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const err = new Error(data.error || "请求失败");
          err.status = res.status;
          err.body = data;
          throw err;
        }
        return data;
      }
      function formatChinaTime(value) {
        if (value == null || value === "") {
          return "—";
        }
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) {
          return "—";
        }
        const parts = new Intl.DateTimeFormat("zh-CN", {
          timeZone: "Asia/Shanghai",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false
        }).formatToParts(date);
        const pick = function (type) {
          return (parts.find(function (part) { return part.type === type; }) || {}).value || "00";
        };
        return pick("year") + "-" + pick("month") + "-" + pick("day") + " " + pick("hour") + ":" + pick("minute") + ":" + pick("second");
      }
      function fmt(ts) {
        return ts ? formatChinaTime(ts) : "—";
      }
      function esc(value) {
        return String(value == null ? "" : value)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;");
      }
      function demoBadge(item) {
        return item.demo ? '<span class="badge">演示</span>' : "";
      }
      function fileList(item) {
        const files = item.files || [];
        if (!files.length) {
          return '<span class="oc-crumb">（无文件列表）</span>';
        }
        return "<ul class=\"files\">" + files.map(function (file) {
          return "<li>" + esc(file) + "</li>";
        }).join("") + "</ul>";
      }
      function countBy(items, status) {
        return items.filter(function (item) { return item.status === status; }).length;
      }
      let upgradeEscapeTimer = 0;
      function maskEl() {
        return document.getElementById("upgrade-mask");
      }
      function maskPart(id) {
        const root = maskEl();
        return root ? root.querySelector("#" + id) : document.getElementById(id);
      }
      const STEP_LABELS = {
        agree: "已同意",
        sync: "正在同步代码",
        restart: "正在重启服务",
        health: "等待健康检查",
        reload: "正在刷新界面",
        done: "完成"
      };

      function stepKeys(needRestart) {
        return needRestart
          ? ["agree", "sync", "restart", "health", "reload", "done"]
          : ["agree", "sync", "health", "reload", "done"];
      }

      function renderUpgradeSteps(keys, active, terminal) {
        const upgradeSteps = maskPart("upgrade-steps");
        const upgradeBar = maskPart("upgrade-bar");
        if (!upgradeSteps || !upgradeBar) {
          return;
        }
        upgradeSteps.innerHTML = keys.map(function (key) {
          let cls = "";
          const idx = keys.indexOf(key);
          const cur = keys.indexOf(active);
          if (key === "done" && terminal === "bad") cls = "bad";
          else if (idx < cur || (key === active && terminal === "ok")) cls = "ok";
          else if (key === active) cls = "on";
          const label = key === "done" && terminal === "bad" ? "失败" : STEP_LABELS[key];
          return "<li class=\"" + cls + "\" data-step=\"" + key + "\">" + label + "</li>";
        }).join("");
        const cur = Math.max(0, keys.indexOf(active));
        const width = terminal === "ok" ? 100 : Math.round(((cur + (terminal === "bad" ? 1 : 0.35)) / keys.length) * 100);
        upgradeBar.style.width = width + "%";
      }

      function pinUpgradeMask() {
        const el = maskEl();
        if (!el) {
          return null;
        }
        if (el.parentNode !== document.documentElement) {
          document.documentElement.appendChild(el);
        }
        return el;
      }

      function clearShellPending() {
        const shell = document.querySelector(".xm-shell");
        if (shell) {
          shell.classList.remove("is-pending");
        }
      }

      function setUpgradeTitle(text) {
        const upgradeTitle = maskPart("upgrade-title");
        if (upgradeTitle) {
          upgradeTitle.textContent = text;
        }
      }

      function paintMask(el, canClose) {
        if (!el) {
          return;
        }
        el.classList.add("show");
        if (canClose) {
          el.classList.add("can-close");
        } else {
          el.classList.remove("can-close");
        }
        el.style.display = "flex";
        el.style.visibility = "visible";
        el.style.opacity = "1";
        el.style.zIndex = "2147483000";
      }

      function showUpgrade(keys, active) {
        const el = pinUpgradeMask();
        clearShellPending();
        paintMask(el, false);
        setUpgradeTitle("正在升级，请勿关闭");
        const upgradeLog = maskPart("upgrade-log");
        if (upgradeLog) {
          upgradeLog.hidden = true;
          upgradeLog.textContent = "";
        }
        renderUpgradeSteps(keys, active, "");
        if (upgradeEscapeTimer) {
          clearTimeout(upgradeEscapeTimer);
        }
        upgradeEscapeTimer = setTimeout(function () {
          const live = pinUpgradeMask();
          if (live && live.classList.contains("show") && !live.classList.contains("can-close")) {
            setUpgradeTitle("仍在处理，可关闭此层");
            paintMask(live, true);
          }
        }, 8000);
      }

      function hideUpgrade() {
        if (upgradeEscapeTimer) {
          clearTimeout(upgradeEscapeTimer);
          upgradeEscapeTimer = 0;
        }
        const el = maskEl();
        if (el) {
          el.classList.remove("show");
          el.classList.remove("can-close");
          el.style.display = "none";
        }
        setUpgradeTitle("正在升级，请勿关闭");
      }

      function failUpgrade(keys, message) {
        const el = pinUpgradeMask();
        clearShellPending();
        if (upgradeEscapeTimer) {
          clearTimeout(upgradeEscapeTimer);
          upgradeEscapeTimer = 0;
        }
        setUpgradeTitle("升级未完成");
        renderUpgradeSteps(keys, "done", "bad");
        const upgradeLog = maskPart("upgrade-log");
        if (upgradeLog) {
          upgradeLog.hidden = false;
          upgradeLog.textContent = message;
        }
        paintMask(el, true);
      }

      function finishUpgrade(keys, message) {
        const el = pinUpgradeMask();
        clearShellPending();
        if (upgradeEscapeTimer) {
          clearTimeout(upgradeEscapeTimer);
          upgradeEscapeTimer = 0;
        }
        setUpgradeTitle("升级完成");
        renderUpgradeSteps(keys, "done", "ok");
        const upgradeLog = maskPart("upgrade-log");
        if (upgradeLog && message) {
          upgradeLog.hidden = false;
          upgradeLog.textContent = message;
        }
        paintMask(el, true);
      }

      function readPendingUpgrade() {
        try {
          const raw = sessionStorage.getItem(UPGRADE_PENDING_KEY);
          if (!raw) return null;
          const data = JSON.parse(raw);
          return data && data.version ? data : null;
        } catch {
          return null;
        }
      }

      function consumePendingUpgrade() {
        const data = readPendingUpgrade();
        sessionStorage.removeItem(UPGRADE_PENDING_KEY);
        return data;
      }

      async function sleep(ms) {
        return new Promise(function (resolve) { setTimeout(resolve, ms); });
      }

      async function probeHealth() {
        const ac = new AbortController();
        const timer = setTimeout(function () { ac.abort(); }, 8000);
        try {
          const res = await fetch("/api/health", { credentials: "same-origin", cache: "no-store", signal: ac.signal });
          return res.status === 200;
        } catch {
          return false;
        } finally {
          clearTimeout(timer);
        }
      }

      async function probePage() {
        const ac = new AbortController();
        const timer = setTimeout(function () { ac.abort(); }, 8000);
        try {
          const res = await fetch("/releases?probe=" + Date.now(), {
            credentials: "same-origin",
            cache: "no-store",
            headers: { Accept: "text/html" },
            signal: ac.signal
          });
          if (res.status !== 200) {
            return false;
          }
          const text = await res.text();
          return text.indexOf("releases.js") !== -1 || text.indexOf("xm-releases-boot") !== -1 || text.indexOf("upgrade-mask") !== -1;
        } catch {
          return false;
        } finally {
          clearTimeout(timer);
        }
      }

      async function waitUntilSiteReady(needRestart) {
        if (!needRestart) {
          return probeHealth();
        }
        let okStreak = 0;
        for (let i = 0; i < 40; i += 1) {
          const healthy = await probeHealth();
          const pageOk = healthy ? await probePage() : false;
          if (healthy && pageOk) {
            okStreak += 1;
            if (okStreak >= 2) {
              return true;
            }
          } else {
            okStreak = 0;
          }
          await sleep(700);
        }
        return false;
      }

      async function finishUpgradeInPlace(version) {
        clearShellPending();
        renderUpgradeSteps(["reload", "done"], "done", "ok");
        setUpgradeTitle("升级完成");
        try {
          await refresh({ skipLoginRedirect: true });
        } catch (err) {
          flash((err && err.message) || "刷新失败", true);
        }
        flash("发布成功 · " + (version || ""));
        hideUpgrade();
        consumePendingUpgrade();
      }

      async function loadTicket(id) {
        const all = await api("/api/releases", { skipLoginRedirect: true });
        return (all.items || []).find(function (item) { return item.id === id; }) || null;
      }

      async function runPass(id, needRestart, version) {
        const keys = stepKeys(needRestart);
        showUpgrade(keys, "agree");
        let confirmErr = null;
        let confirmBody = null;
        api("/api/releases/" + id + "/confirm", {
          method: "POST",
          body: "{}"
        }).then(function (body) {
          confirmBody = body;
        }).catch(function (err) {
          confirmErr = err;
        });
        renderUpgradeSteps(keys, "sync");
        const deadline = Date.now() + 120000;
        let lastHealth = "尚未返回 200";
        let ticket = null;
        while (Date.now() < deadline) {
          pinUpgradeMask();
          if (confirmErr && confirmErr.status && confirmErr.status !== 502 && confirmErr.status !== 503 && confirmErr.status < 500) {
            const msg = (confirmErr.status || "") + " " + (confirmErr.message || "通过失败");
            failUpgrade(keys, msg);
            flash(msg, true);
            return "failed";
          }
          try {
            ticket = await loadTicket(id);
          } catch (err) {
            lastHealth = err.message || "读取单据中断（可能正在重启）";
          }
          if (ticket && ticket.status === "failed") {
            failUpgrade(keys, ticket.log || "发版失败");
            flash(ticket.log || "发版失败", true);
            return "failed";
          }
          if (ticket && ticket.status === "publishing") {
            renderUpgradeSteps(keys, needRestart ? "restart" : "sync");
          }
          if (ticket && ticket.status === "success") {
            renderUpgradeSteps(keys, "health");
            try {
              if (await probeHealth()) {
                renderUpgradeSteps(keys, "reload");
                sessionStorage.setItem(UPGRADE_PENDING_KEY, JSON.stringify({
                  version: version || ticket.version,
                  id: id
                }));
                await waitUntilSiteReady(needRestart);
                await finishUpgradeInPlace(version || ticket.version);
                return "landed";
              }
              lastHealth = "健康检查尚未 200";
            } catch (err) {
              lastHealth = err.message || "健康检查请求中断（可能正在重启）";
            }
          }
          await sleep(1500);
        }
        const timeoutMsg = ticket && ticket.status === "success"
          ? "通过已落地，但健康检查超时：" + lastHealth + "。站点可能起不来，请看进程日志，不要再点通过。"
          : ((ticket && ticket.log) ? ticket.log + "\n" : "") + "健康检查超时：" + lastHealth;
        failUpgrade(keys, timeoutMsg);
        flash("升级未完成：" + lastHealth, true);
        return "failed";
      }

      function tickClock() {
        const stamp = formatChinaTime(new Date());
        document.querySelectorAll("#clock, .oc-clock").forEach(function (el) {
          el.textContent = stamp;
          el.title = "北京时间";
        });
      }

      function activeTabName() {
        const tab = document.querySelector(".oc-tab.active");
        return (tab && tab.getAttribute("data-tab")) || "queue";
      }

      function countsFromBoard(payload) {
        if (payload && typeof payload.queued === "number") {
          return payload;
        }
        const items = (payload && payload.items) || [];
        const summary = { queued: 0, approved: 0, publishing: 0, failed: 0, success: 0, logs: 0, rolledBack: 0 };
        items.forEach(function (item) {
          if (item.status === "queued") summary.queued += 1;
          else if (item.status === "approved") summary.approved += 1;
          else if (item.status === "publishing") summary.publishing += 1;
          else if (item.status === "failed") summary.failed += 1;
          else if (item.status === "success") {
            summary.success += 1;
            if (item.rolledBack) summary.rolledBack += 1;
          }
          if (item.log) summary.logs += 1;
        });
        return summary;
      }

      function renderStats(summary, ready) {
        const caps = document.getElementById("stat-caps");
        const counts = countsFromBoard(summary);
        const queued = Number(counts && counts.queued) || 0;
        const approved = Number(counts && counts.approved) || 0;
        const publishing = Number(counts && counts.publishing) || 0;
        const failed = Number(counts && counts.failed) || 0;
        const success = Number(counts && counts.success) || 0;
        const runVer = ready && ready.version ? String(ready.version) : "";
        if (caps) {
          caps.innerHTML =
            '<span class="cap wait"><b>' + queued + "</b>待主脑</span>" +
            '<span class="cap ok"><b>' + approved + "</b>已同意</span>" +
            '<span class="cap busy"><b>' + publishing + "</b>发布中</span>" +
            '<span class="cap fail"><b>' + failed + "</b>失败</span>" +
            '<span class="cap done"><b>' + success + "</b>近已上线</span>" +
            (runVer ? '<span class="cap done"><b>' + esc(runVer) + "</b>运行版本</span>" : "");
        }
        setText("tab-queue-count", String(queued));
        setText("tab-queue-sub", queued + " 待审批");
        setText("tab-history-count", String(success));
        setText("tab-history-sub", success + " 个正式版");
        setText("tab-logs-sub", "发版流水");
      }

      function successReleases(items) {
        return (items || []).filter(function (item) { return item.status === "success"; });
      }

      function renderHistoryStats(summary) {
        const el = document.getElementById("history-stats");
        if (!el) {
          return;
        }
        const counts = countsFromBoard(summary);
        const success = Number(counts && counts.success) || 0;
        const rolled = Number(counts && counts.rolledBack) || 0;
        el.innerHTML = "已上线发布 <b>" + success + "</b> 个版本" +
          (rolled ? "（其中 " + rolled + " 个已回滚）" : "");
      }

      function renderLock(lock, ready) {
        const el = document.getElementById("lock-view");
        if (!el) {
          return;
        }
        if (!lock.locked) {
          el.className = "lock-box idle";
          el.textContent = "确认发布后先启动新版本，健康检查通过再切换。当前空闲。一把锁，点一单才发一单。";
        } else {
          const cur = lock.current || {};
          el.className = "lock-box";
          el.innerHTML =
            "<div>锁已被占用，禁止第二下发布。</div>" +
            "<div>版本号：" + esc(cur.version || "—") + "</div>" +
            "<div>开始时间：" + esc(fmt(cur.startedAt)) + "</div>";
        }
        if (ready && ready.version) {
          setText("app-version", "mengkai " + ready.version + (ready.release_mode ? " · " + ready.release_mode : ""));
        } else {
          setText("app-version", "环境未返回版本号");
        }
      }

      function renderCurrentVersions(versions) {
        const el = document.getElementById("current-versions");
        if (!el) {
          return;
        }
        const current = (versions && versions.current) || [];
        const next = versions && versions.next ? versions.next : null;
        const nextCap = next
          ? '<span class="cap wait"><b>' + esc(next.version) + "</b>闸门下一号</span>"
          : "";
        el.innerHTML = nextCap + current.map(function (row) {
          return '<span class="cap done"><b>' + esc(row.version) + "</b>" + esc(row.module) +
            (row.rolledBack ? " · 已回滚" : "") + "</span>";
        }).join("");
      }

      function paginate(list, key) {
        const total = list.length;
        const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE) || 1);
        if (listPages[key] > pageCount) {
          listPages[key] = pageCount;
        }
        if (listPages[key] < 1) {
          listPages[key] = 1;
        }
        const page = listPages[key];
        const start = (page - 1) * PAGE_SIZE;
        return {
          slice: list.slice(start, start + PAGE_SIZE),
          page,
          pageCount,
          total,
          from: total ? start + 1 : 0,
          to: Math.min(start + PAGE_SIZE, total)
        };
      }

      function renderPager(key, info) {
        if (!info.total) {
          return "";
        }
        if (info.total <= PAGE_SIZE) {
          return '<div class="oc-pager"><span>共 ' + info.total + " 条</span></div>";
        }
        return (
          '<div class="oc-pager" data-pager="' + key + '">' +
          '<button type="button" class="act secondary" data-page="1"' + (info.page <= 1 ? " disabled" : "") + ">首页</button>" +
          '<button type="button" class="act secondary" data-page="' + (info.page - 1) + '"' + (info.page <= 1 ? " disabled" : "") + ">上一页</button>" +
          "<span>第 " + info.page + " / " + info.pageCount + " 页 · 第 " + info.from + "–" + info.to + " 条 · 共 " + info.total + " 条</span>" +
          '<button type="button" class="act secondary" data-page="' + (info.page + 1) + '"' + (info.page >= info.pageCount ? " disabled" : "") + ">下一页</button>" +
          '<button type="button" class="act secondary" data-page="' + info.pageCount + '"' + (info.page >= info.pageCount ? " disabled" : "") + ">末页</button>" +
          "</div>"
        );
      }

      function renderQueue(items, locked, versions) {
        const el = document.getElementById("queue-view");
        if (!el) {
          return;
        }
        if (!items.length) {
          const current = ((versions && versions.current) || []).map(function (row) {
            return esc(row.module) + " " + esc(row.version);
          }).join(" · ");
          el.innerHTML =
            '<div class="empty">' +
            "<div>待上线是空的，没有等待通过的单据</div>" +
            "<div>已成功发布的请点上面「版本记录」" +
            (current ? "。当前：" + current : "") +
            "</div></div>";
          return;
        }
        const paged = paginate(items, "queue");
        el.innerHTML =
          "<table class=\"sc-table\"><thead><tr><th>位次</th><th>模块</th><th>改动</th><th>版本</th><th>状态</th><th>操作</th></tr></thead><tbody>" +
          paged.slice.map(function (item, index) {
          const seq = item.queueIndex || (paged.from + index);
          const isHead = Number(seq) === 1;
          let confirmBtn;
          if (locked) {
            confirmBtn = "<button class=\"act\" disabled>有发布正在进行，请等待</button>";
          } else if (!isHead) {
            confirmBtn = "<button class=\"act\" disabled>须先通过第 1 位</button>";
          } else {
            confirmBtn = "<button class=\"act\" data-act=\"pass\">通过</button>";
          }
          return (
            "<tr class=\"ticket\" data-id=\"" + esc(item.id) + "\" data-restart=\"" + (item.restart ? "1" : "0") + "\" data-version=\"" + esc(item.version) + "\">" +
            "<td class=\"sc-seq\">第 " + seq + " 位</td>" +
            "<td>" + esc(item.module) + "</td>" +
            "<td class=\"sc-change\">" +
            "<div class=\"sc-sum\">" + esc(item.summary) + demoBadge(item) + "</div>" +
            "<div class=\"sc-meta\">来自对话 · " + esc(item.source || item.applicant || "—") + "</div>" +
            fileList(item) +
            (item.gitRef ? "<div class=\"sc-meta\">git ref · " + esc(item.gitRef) + "</div>" : "") +
            "<div class=\"sc-meta\">验收 · " + esc(item.acceptance || "—") + "</div>" +
            "<div class=\"sc-meta\">排队序号 · " + seq + "</div>" +
            "</td>" +
            "<td><div class=\"sc-ver\">" + esc(item.version) + "</div>" +
            "<div class=\"sc-meta\">" + (item.restart ? "含后端" : "仅页面") + "</div></td>" +
            "<td>" + (isHead ? "待上线·发布包已就绪<br>请先点" : "待上线·排队中") + "</td>" +
            "<td><div class=\"row\">" +
            confirmBtn +
            "<button class=\"act danger\" data-act=\"reject\">驳回</button>" +
            "</div></td></tr>"
          );
        }).join("") +
          "</tbody></table>" + renderPager("queue", paged);
      }

      function newestFirst(a, b) {
        return String(b.publishFinishedAt || b.reviewedAt || b.submittedAt || "").localeCompare(
          String(a.publishFinishedAt || a.reviewedAt || a.submittedAt || "")
        );
      }

      function pageInfoFromBoard(result, key) {
        if (result && result.total != null) {
          const total = Number(result.total) || 0;
          const pageCount = Math.max(1, Number(result.pageCount) || 1);
          const page = Math.min(Math.max(1, Number(result.page) || listPages[key] || 1), pageCount);
          listPages[key] = page;
          const start = (page - 1) * PAGE_SIZE;
          const slice = result.items || [];
          return {
            slice: slice,
            page,
            pageCount,
            total,
            from: total ? start + 1 : 0,
            to: Math.min(start + slice.length, total)
          };
        }
        const raw = (result && result.items) || [];
        const list = key === "history"
          ? raw.filter(function (item) { return item.status === "success"; }).sort(newestFirst)
          : raw.filter(function (item) { return item.log; }).sort(newestFirst);
        return paginate(list, key);
      }

      function renderHistory(result, locked) {
        const el = document.getElementById("history-view");
        if (!el) {
          return;
        }
        const paged = pageInfoFromBoard(result, "history");
        if (!paged.total) {
          el.innerHTML = '<div class="empty">还没有成功发布的版本记录</div>';
          return;
        }
        el.innerHTML =
          "<table><thead><tr><th>版本</th><th>模块</th><th>摘要</th><th>时间</th><th>回滚</th></tr></thead><tbody>" +
          paged.slice.map(function (item) {
            let rollbackBtn = "<span class=\"oc-crumb\">无快照</span>";
            if (item.snapshotDir) {
              rollbackBtn = locked
                ? "<button class=\"act\" disabled>有发布正在进行</button>"
                : "<button class=\"act secondary\" data-act=\"rollback\">回滚到升级前</button>";
            }
            return (
              "<tr data-id=\"" + esc(item.id) + "\"><td>" + esc(item.version) + demoBadge(item) +
              (item.rolledBack ? '<span class="badge">已回滚</span>' : "") + "</td>" +
              "<td>" + esc(item.module) + "</td>" +
              "<td>" + esc(item.summary || "—") + "</td>" +
              "<td>" + esc(fmt(item.publishFinishedAt || item.reviewedAt)) + "</td>" +
              "<td>" + rollbackBtn + "</td></tr>"
            );
          }).join("") +
          "</tbody></table>" + renderPager("history", paged);
      }

      function renderLogs(result) {
        const el = document.getElementById("logs-view");
        if (!el) {
          return;
        }
        const paged = pageInfoFromBoard(result, "logs");
        if (!paged.total) {
          el.innerHTML = '<div class="empty">暂无发版流水</div>';
          return;
        }
        el.innerHTML = paged.slice.map(function (item) {
          return (
            "<article class=\"log-item\">" +
            "<div><b>" + esc(item.version) + "</b> · " + esc(item.status) + " · " + esc(item.module) + "</div>" +
            "<div>" + esc(item.log) + "</div>" +
            "<div class=\"oc-crumb\">" + esc(fmt(item.publishFinishedAt || item.reviewedAt || item.submittedAt)) + "</div>" +
            "</article>"
          );
        }).join("") + renderPager("logs", paged);
      }

      async function refreshHistory(apiOpts, locked) {
        const el = document.getElementById("history-view");
        if (el) {
          el.innerHTML = '<div class="empty">正在读取本页版本记录…</div>';
        }
        const result = await api("/api/releases/history?page=" + listPages.history + "&limit=" + PAGE_SIZE, apiOpts);
        renderHistory(result, locked);
      }

      async function refreshLogs(apiOpts) {
        const el = document.getElementById("logs-view");
        if (el) {
          el.innerHTML = '<div class="empty">正在读取本页运行日志…</div>';
        }
        const result = await api("/api/releases/logs?page=" + listPages.logs + "&limit=" + PAGE_SIZE, apiOpts);
        renderLogs(result);
      }

      async function refresh(opts) {
        const apiOpts = opts && opts.skipLoginRedirect ? { skipLoginRedirect: true } : {};
        const tab = (opts && opts.tab) || activeTabName();
        clearShellPending();
        const [queue, lock, ready, me, summary, versions] = await Promise.all([
          api("/api/releases/queue", apiOpts),
          api("/api/releases/lock", apiOpts),
          api("/api/releases/readyz", apiOpts),
          api("/api/auth/me", apiOpts),
          api("/api/releases/summary", apiOpts),
          api("/api/releases/versions", apiOpts)
        ]);
        lastLock = lock;
        setText("who", me.displayName || me.username || "罗成");
        renderLock(lock, ready);
        renderStats(summary, ready);
        renderHistoryStats(summary);
        renderCurrentVersions(versions);
        const queued = queue.items || [];
        knownQueueIds = queued.map(function (item) { return item.id; });
        renderQueue(queued, lock.locked, versions);
        try {
          if (tab === "history") {
            await refreshHistory(apiOpts, lock.locked);
          } else if (tab === "logs") {
            await refreshLogs(apiOpts);
          }
        } catch (err) {
          flash(err.message, true);
        }
        return lock;
      }

      async function watchIncoming() {
        const live = maskEl();
        if (live && live.classList.contains("show")) {
          return;
        }
        try {
          const queue = await api("/api/releases/queue");
          const items = queue.items || [];
          const ids = items.map(function (item) { return item.id; });
          if (!knownQueueIds) {
            knownQueueIds = ids;
            return;
          }
          const fresh = items.filter(function (item) {
            return knownQueueIds.indexOf(item.id) < 0;
          });
          if (!fresh.length) {
            return;
          }
          await refresh();
          flash("有新的待上线：" + fresh.map(function (item) {
            return item.module + " " + item.version;
          }).join("、") + "。不会自动通过。");
        } catch (err) {
          if (err.status === 401) {
            goLogin();
          }
        }
      }

      document.querySelectorAll(".oc-tab").forEach(function (tab) {
        tab.addEventListener("click", function () {
          const name = tab.getAttribute("data-tab");
          document.querySelectorAll(".oc-tab").forEach(function (node) {
            node.classList.toggle("active", node === tab);
          });
          document.querySelectorAll(".pane").forEach(function (pane) {
            pane.classList.toggle("on", pane.id === "pane-" + name);
          });
          if (tabTitles[name]) {
            document.title = "版本发布中心 · " + (name === "queue" ? "待上线" : name === "history" ? "版本记录" : "运行日志");
          }
          if (name === "history" || name === "logs") {
            refresh({ tab: name }).catch(function (err) {
              flash(err.message, true);
            });
          }
          if (typeof tab.blur === "function") {
            tab.blur();
          }
        });
      });

      tickClock();
      window.__xmPageTimers = window.__xmPageTimers || [];
      window.__xmPageTimers.push(setInterval(tickClock, 1000));

      document.body.addEventListener("click", async function (event) {
        const pagerBtn = event.target.closest(".oc-pager [data-page]");
        if (pagerBtn && !pagerBtn.disabled) {
          const box = pagerBtn.closest(".oc-pager");
          const key = box && box.getAttribute("data-pager");
          const page = Number(pagerBtn.getAttribute("data-page"));
          if (key && page >= 1) {
            listPages[key] = page;
            try {
              await refresh();
            } catch (err) {
              flash(err.message, true);
            }
            const scroller = document.querySelector(".xm-content") || window;
            if (scroller === window) {
              window.scrollTo(0, 0);
            } else {
              scroller.scrollTop = 0;
            }
          }
          return;
        }
        const btn = event.target.closest("button[data-act]");
        if (!btn) return;
        const card = btn.closest("[data-id]");
        const id = card && card.getAttribute("data-id");
        if (!id) return;
        const act = btn.getAttribute("data-act");
        if (act === "pass") {
          showUpgrade(stepKeys(card.getAttribute("data-restart") === "1"), "agree");
        }
        btn.disabled = true;
        try {
          if (act === "reject") {
            const reason = window.prompt("请填写驳回原因（必填）");
            if (!reason || !reason.trim()) {
              flash("驳回已取消：必须填写原因。", true);
              btn.disabled = false;
              return;
            }
            await api("/api/releases/" + id + "/reject", {
              method: "POST",
              body: JSON.stringify({ reason: reason.trim() })
            });
            flash("已驳回，该单不可发布。");
          } else if (act === "pass") {
            const needRestart = card.getAttribute("data-restart") === "1";
            const version = card.getAttribute("data-version") || "";
            const passResult = await runPass(id, needRestart, version);
            if (passResult === "reloading" || passResult === "landed") return;
            if (passResult === "failed") {
              btn.disabled = false;
            }
          } else if (act === "rollback") {
            if (!window.confirm("确认按升级前快照回滚该版本的文件？不会自动发下一单。")) {
              btn.disabled = false;
              return;
            }
            await api("/api/releases/" + id + "/rollback", {
              method: "POST",
              body: "{}"
            });
            flash("已回滚到升级前快照。下一条不会自动发布。");
          }
          await refresh();
        } catch (err) {
          failUpgrade(stepKeys(true), (err.status || "") + " " + (err.message || "操作失败"));
          flash((err.status || "") + " " + err.message, true);
          await refresh();
        }
      });

      const refreshBtn = document.getElementById("refresh-btn");
      if (refreshBtn) refreshBtn.addEventListener("click", async function () {
        try {
          await refresh();
          flash("已刷新队列。");
        } catch (err) {
          flash(err.message, true);
        }
      });

      (async function bootReleases() {
        pinUpgradeMask();
        clearShellPending();
        const pending = consumePendingUpgrade();
        try {
          await refresh();
          if (pending) {
            finishUpgrade(["reload", "done"], "发布成功 · " + pending.version);
            flash("发布成功 · " + pending.version);
          } else if (maskEl() && maskEl().classList.contains("show")) {
            hideUpgrade();
          }
        } catch (err) {
          if (pending) {
            finishUpgrade(["reload", "done"], "发布已提交 · " + pending.version + "。页面刷新失败：" + (err.message || ""));
          } else {
            hideUpgrade();
          }
          flash(err.message, true);
        }
      })();
      window.__xmPageTimers = window.__xmPageTimers || [];
      window.__xmPageTimers.push(setInterval(function () { watchIncoming(); }, WATCH_MS));
      window.__xmPageTimers.push(setInterval(function () {
        const live = maskEl();
        if (live && live.classList.contains("show")) {
          pinUpgradeMask();
        }
      }, 400));
      document.addEventListener("click", function (event) {
        const live = maskEl();
        if (!live || !live.classList.contains("show")) {
          return;
        }
        if (event.target.closest && event.target.closest("#upgrade-dismiss")) {
          event.preventDefault();
          event.stopPropagation();
          hideUpgrade();
          return;
        }
        if (event.target === live && live.classList.contains("can-close")) {
          hideUpgrade();
        }
      });
    
      } finally {
        window.setInterval = realSetInterval;
        window.setTimeout = realSetTimeout;
        restoreBodyEvents();
        restoreDocEvents();
      }
      return function unmount() {
        timers.forEach(function (item) {
          if (item.kind === "interval") {
            clearInterval(item.id);
          } else {
            clearTimeout(item.id);
          }
        });
        listeners.forEach(function (item) {
          item.target.removeEventListener(item.type, item.fn, item.opts);
        });
        if (mask && mask.parentNode) {
          mask.remove();
        }
        root.innerHTML = "";
      };
    }
  };

  function autoMountReleases() {
    const root = document.getElementById("xm-content") || document.querySelector(".xm-content");
    const mod = window.XmModules && window.XmModules["/releases"];
    if (!root || !mod || typeof mod.mount !== "function") {
      return false;
    }
    if (root.getAttribute("data-xm-rel-mounted") === "1") {
      return true;
    }
    root.setAttribute("data-xm-rel-mounted", "1");
    mod.mount(root);
    return true;
  }
  (function bootMount() {
    let tries = 0;
    function tick() {
      if (autoMountReleases()) {
        return;
      }
      tries += 1;
      if (tries < 40) {
        setTimeout(tick, 50);
      }
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", tick);
    }
    tick();
  })();
})();
