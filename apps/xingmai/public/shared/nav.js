/* xm-shell-perf 0.1.44 */
(function () {
  const items = [
    { href: "/", label: "首页" },
    { href: "/data", label: "数据中心" },
    { href: "/shen", label: "沈子晗运营中心" },
    { href: "/han", label: "韩梦凯运营中心" },
    { href: "/people", label: "人员管理" },
    { href: "/releases", label: "版本发布中心" },
    { href: "/me", label: "个人中心" }
  ];

  const path = (window.location.pathname.replace(/\/+$/, "") || "/").toLowerCase();
  if (path === "/login" || path === "/login.html") {
    return;
  }
  if (document.body && document.body.classList.contains("login-page")) {
    return;
  }

  (function wrapHanFetch() {
    if (window.__xmFetchWrap) {
      return;
    }
    window.__xmFetchWrap = true;
    const orig = window.fetch.bind(window);
    const inflight = new Map();
    const memo = new Map();
    const MEMO_MS = 2500;
    const memoPaths = { "/api/han/tasks": true, "/api/han/brief": true };
    function infoOf(input, init) {
      const raw = typeof input === "string" ? input : (input && input.url) || "";
      const method = String((init && init.method) || (input && input.method) || "GET").toUpperCase();
      let dest = raw;
      try {
        dest = new URL(raw, window.location.origin).pathname.replace(/\/+$/, "") || "/";
      } catch (_err) {}
      return { method: method, dest: dest, key: method + " " + dest };
    }
    window.fetch = function (input, init) {
      const info = infoOf(input, init);
      if (info.method !== "GET" && info.method !== "HEAD") {
        if (info.dest.indexOf("/api/han/") === 0) {
          memo.clear();
        }
        return orig(input, init);
      }
      if (memoPaths[info.dest]) {
        const hit = memo.get(info.key);
        if (hit && Date.now() - hit.at < MEMO_MS) {
          return Promise.resolve(hit.res.clone());
        }
      }
      if (inflight.has(info.key)) {
        return inflight.get(info.key).then(function (res) {
          return res.clone();
        });
      }
      const pending = orig(input, init)
        .then(function (res) {
          inflight.delete(info.key);
          if (memoPaths[info.dest] && res.ok) {
            memo.set(info.key, { at: Date.now(), res: res.clone() });
          }
          return res;
        })
        .catch(function (err) {
          inflight.delete(info.key);
          throw err;
        });
      inflight.set(info.key, pending);
      return pending.then(function (res) {
        return res.clone();
      });
    };
  })();

  let current = window.location.pathname.replace(/\/+$/, "") || "/";
  const htmlLoads = new Map();
  let navGen = 0;
  let navAbort = null;
  let warmBusy = true;
  const THEME_KEY = "xm-theme";
  const cnFmt = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });

  function currentTheme() {
    try {
      return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
    } catch (_err) {
      return "light";
    }
  }

  function applyTheme(theme) {
    const next = theme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    document.documentElement.style.colorScheme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (_err) {}
    const btn = document.getElementById("xm-theme");
    if (btn) {
      btn.textContent = next === "dark" ? "浅色" : "暗色";
      btn.setAttribute("aria-label", next === "dark" ? "切换到浅色" : "切换到暗色");
      btn.setAttribute("aria-pressed", next === "dark" ? "true" : "false");
    }
  }

  applyTheme(currentTheme());

  function formatChinaTime(value) {
    if (value == null || value === "") {
      return "—";
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "—";
    }
    const parts = cnFmt.formatToParts(date);
    const pick = function (type) {
      return (parts.find(function (part) { return part.type === type; }) || {}).value || "00";
    };
    return (
      pick("year") +
      "-" +
      pick("month") +
      "-" +
      pick("day") +
      " " +
      pick("hour") +
      ":" +
      pick("minute") +
      ":" +
      pick("second")
    );
  }

  function rewriteUtcStamp(text) {
    return String(text).replace(
      /(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(?:\.\d+)?(?:Z|\s*UTC)/g,
      function (_all, day, time) {
        return formatChinaTime(day + "T" + time + "Z");
      }
    );
  }

  function rewriteTimeNodes(root) {
    if (!root) {
      return;
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      nodes.push(walker.currentNode);
    }
    nodes.forEach(function (node) {
      const text = node.nodeValue;
      if (!text || !/\d{4}-\d{2}-\d{2}[T ]/.test(text)) {
        return;
      }
      const next = rewriteUtcStamp(text);
      if (next !== text) {
        node.nodeValue = next;
      }
    });
  }

  function watchStampRewrites() {
    const root = document.querySelector(".xm-content") || document.body;
    if (!root) {
      return;
    }
    if (!window.__xmStampObs) {
      let timer = 0;
      window.__xmStampObs = new MutationObserver(function () {
        clearTimeout(timer);
        timer = setTimeout(function () {
          rewriteTimeNodes(document.querySelector(".xm-content") || document.body);
        }, 160);
      });
    }
    window.__xmStampObs.disconnect();
    window.__xmStampObs.observe(root, { childList: true, subtree: true });
  }

  function tickChinaClocks() {
    const stamp = formatChinaTime(new Date());
    const bar = document.getElementById("xm-clock");
    if (bar) {
      bar.textContent = stamp;
      bar.title = "北京时间";
    }
    const pageClock = document.getElementById("clock");
    if (pageClock) {
      pageClock.textContent = stamp;
      pageClock.title = "北京时间";
    }
  }

  function startClock() {
    tickChinaClocks();
    if (!window.__xmChinaClock) {
      window.__xmChinaClock = setInterval(tickChinaClocks, 1000);
    }
  }

  if (!document.querySelector('link[href*="/shared/layout.css"]')) {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "/shared/layout.css?v=0.1.44";
    document.head.appendChild(css);
  }

  function pageLabel(href) {
    const key = href.replace(/\/+$/, "") || "/";
    return (
      items.find(function (item) {
        return (item.href.replace(/\/+$/, "") || "/") === key;
      }) || items[0]
    ).label;
  }

  function isActive(href) {
    return current === (href.replace(/\/+$/, "") || "/");
  }

  function menuHtml() {
    return items
      .map(function (item) {
        const cls = "xm-menu-item" + (isActive(item.href) ? " is-active" : "");
        const cur = isActive(item.href) ? ' aria-current="page"' : "";
        const extra = isActive(item.href) ? ' data-self="1"' : "";
        return (
          '<a class="' +
          cls +
          '" href="' +
          item.href +
          '"' +
          cur +
          extra +
          "><span>" +
          item.label +
          "</span></a>"
        );
      })
      .join("");
  }

  function highlight(nextPath) {
    current = nextPath.replace(/\/+$/, "") || "/";
    document.querySelectorAll(".xm-menu-item").forEach(function (a) {
      const href = a.getAttribute("href") || "";
      const on = isActive(href);
      a.classList.toggle("is-active", on);
      if (on) {
        a.setAttribute("aria-current", "page");
        a.setAttribute("data-self", "1");
      } else {
        a.removeAttribute("aria-current");
        a.removeAttribute("data-self");
      }
    });
    const tab = document.querySelector(".xm-tab");
    if (tab) {
      tab.textContent = pageLabel(current);
    }
    document.title = pageLabel(current) + " · 星脉";
  }

  function stripInnerChrome(root) {
    if (!root) {
      return;
    }
    root
      .querySelectorAll(
        ".site-header, .site-sidebar, aside.sidebar, aside.site-sidebar, #site-nav, .ant-layout-sider, .ant-pro-sider, .oc-top"
      )
      .forEach(function (el) {
        el.remove();
      });
    root.querySelectorAll(".app-shell").forEach(function (shell) {
      const parent = shell.parentNode;
      while (shell.firstChild) {
        parent.insertBefore(shell.firstChild, shell);
      }
      shell.remove();
    });
  }

  function applyUserLabel(userLabel) {
    const nameEl = document.getElementById("xm-username");
    if (nameEl && userLabel) {
      nameEl.textContent = userLabel;
    }
  }

  function bindChrome(userLabel) {
    document.documentElement.classList.remove("xm-collapsed");
    applyUserLabel(userLabel);
    const themeBtn = document.getElementById("xm-theme");
    if (themeBtn && !themeBtn.dataset.bound) {
      themeBtn.dataset.bound = "1";
      themeBtn.addEventListener("click", function () {
        applyTheme(currentTheme() === "dark" ? "light" : "dark");
      });
    }
    applyTheme(currentTheme());
    const logoutBtn = document.getElementById("xm-logout");
    if (logoutBtn && !logoutBtn.dataset.bound) {
      logoutBtn.dataset.bound = "1";
      logoutBtn.addEventListener("click", function () {
        fetch("/api/auth/logout", {
          method: "POST",
          credentials: "same-origin",
          headers: { Accept: "application/json" }
        }).finally(function () {
          window.location.replace("/login");
        });
      });
    }
  }

  function appPath(href) {
    try {
      const url = new URL(href, window.location.origin);
      if (url.origin !== window.location.origin) {
        return "";
      }
      const p = (url.pathname.replace(/\/+$/, "") || "/").toLowerCase();
      if (p === "/login" || p === "/login.html") {
        return "";
      }
      return url.pathname.replace(/\/+$/, "") || "/";
    } catch (_err) {
      return "";
    }
  }

  function loadHtml(dest, signal) {
    const hit = htmlLoads.get(dest);
    if (hit) {
      return hit;
    }
    const pending = fetch(dest, {
      credentials: "same-origin",
      headers: { Accept: "text/html" },
      signal: signal
    }).then(function (res) {
      if (res.status === 401 || /\/login(?:\.html)?$/i.test(res.url)) {
        window.location.replace("/login");
        throw new Error("login");
      }
      if (!res.ok) {
        throw new Error("nav " + res.status);
      }
      return res.text();
    }).catch(function (err) {
      htmlLoads.delete(dest);
      throw err;
    });
    htmlLoads.set(dest, pending);
    setTimeout(function () {
      htmlLoads.delete(dest);
    }, 60000);
    return pending;
  }

  function mergeSheets(doc) {
    doc.querySelectorAll('link[rel="stylesheet"]').forEach(function (link) {
      const href = link.getAttribute("href");
      if (!href || href.indexOf("/shared/layout.css") !== -1) {
        return;
      }
      if (document.querySelector('link[rel="stylesheet"][href="' + href + '"]')) {
        return;
      }
      const next = document.createElement("link");
      next.rel = "stylesheet";
      next.href = href;
      document.head.appendChild(next);
    });
  }

  function activateScripts(root) {
    root.querySelectorAll("script").forEach(function (old) {
      const src = old.getAttribute("src") || "";
      if (src.indexOf("/shared/nav.js") !== -1) {
        old.remove();
        return;
      }
      const script = document.createElement("script");
      Array.prototype.slice.call(old.attributes).forEach(function (attr) {
        script.setAttribute(attr.name, attr.value);
      });
      if (!src) {
        script.textContent = "(function(){\n" + old.textContent + "\n})();";
      }
      old.replaceWith(script);
    });
  }

  function trackPageTimers(run) {
    const si = window.setInterval;
    const st = window.setTimeout;
    function wrap(fn) {
      return function (handler, delay) {
        const id = fn(handler, delay);
        if (!window.__xmPageTimers) {
          window.__xmPageTimers = [];
        }
        window.__xmPageTimers.push(id);
        return id;
      };
    }
    window.setInterval = wrap(si);
    window.setTimeout = wrap(st);
    try {
      run();
    } finally {
      window.setInterval = si;
      window.setTimeout = st;
    }
  }

  function wipePageTimers() {
    if (window.__xmChinaClock) {
      clearInterval(window.__xmChinaClock);
      window.__xmChinaClock = null;
    }
    const extra = window.__xmPageTimers;
    if (Array.isArray(extra)) {
      extra.forEach(function (id) {
        clearInterval(id);
        clearTimeout(id);
      });
      window.__xmPageTimers = [];
    }
  }

  function applyHtml(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    if (doc.body && doc.body.classList.contains("login-page")) {
      window.location.replace("/login");
      return;
    }
    mergeSheets(doc);
    if (window.__xmStampObs) {
      window.__xmStampObs.disconnect();
    }
    wipePageTimers();
    const staleMask = document.getElementById("upgrade-mask");
    if (staleMask) {
      staleMask.remove();
    }
    const content = document.getElementById("xm-content");
    if (!content) {
      window.location.reload();
      return;
    }
    const incoming = doc.querySelector("#xm-content");
    const source = incoming || doc.body;
    content.innerHTML = "";
    Array.prototype.slice.call(source.childNodes).forEach(function (node) {
      if (node.tagName === "SCRIPT" && /\/shared\/nav\.js/.test(String(node.getAttribute && node.getAttribute("src") || ""))) {
        return;
      }
      if (node.classList && node.classList.contains("xm-shell")) {
        const inner = node.querySelector("#xm-content");
        if (inner) {
          Array.prototype.slice.call(inner.childNodes).forEach(function (child) {
            content.appendChild(document.importNode(child, true));
          });
        }
        return;
      }
      content.appendChild(document.importNode(node, true));
    });
    stripInnerChrome(content);
    const movedMask = content.querySelector("#upgrade-mask");
    if (movedMask) {
      document.body.appendChild(movedMask);
    }
    trackPageTimers(function () {
      activateScripts(content);
    });
    rewriteTimeNodes(content);
    watchStampRewrites();
    startClock();
  }

  function setPending(on) {
    const shell = document.querySelector(".xm-shell");
    if (shell) {
      shell.classList.toggle("is-pending", on);
    }
  }

  function navigate(dest, push) {
    const next = appPath(dest);
    if (!next) {
      return;
    }
    if (next === current && push) {
      return;
    }
    navGen += 1;
    const gen = navGen;
    highlight(next);
    setPending(true);
    if (navAbort) {
      try {
        navAbort.abort();
      } catch (_err) {}
    }
    navAbort = new AbortController();
    const signal = htmlLoads.has(next) ? undefined : navAbort.signal;
    loadHtml(next, signal)
      .then(function (html) {
        if (gen !== navGen) {
          return;
        }
        applyHtml(html);
        if (push) {
          history.pushState({ xm: true, path: next }, "", next);
        }
        setPending(false);
      })
      .catch(function (err) {
        if (gen !== navGen) {
          return;
        }
        setPending(false);
        if (err && (err.message === "login" || err.name === "AbortError")) {
          return;
        }
        window.location.assign(next);
      });
  }

  function isAppDest(dest) {
    return items.some(function (item) {
      return (item.href.replace(/\/+$/, "") || "/") === dest;
    });
  }

  function bindSpa() {
    if (window.__xmSpaBound) {
      return;
    }
    window.__xmSpaBound = true;
    document.addEventListener("click", function (event) {
      const a = event.target.closest("a[href]");
      if (!a || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      if (a.target === "_blank" || a.hasAttribute("download")) {
        return;
      }
      const dest = appPath(a.href);
      if (!dest || !isAppDest(dest)) {
        return;
      }
      event.preventDefault();
      navigate(dest, true);
    });
    document.addEventListener(
      "pointerenter",
      function (event) {
        const a = event.target.closest && event.target.closest("a[href]");
        if (!a) {
          return;
        }
        if (warmBusy) {
          return;
        }
        const dest = appPath(a.href);
        if (dest && dest !== current && isAppDest(dest)) {
          loadHtml(dest);
        }
      },
      true
    );
    window.addEventListener("popstate", function () {
      navigate(window.location.pathname, false);
    });
  }

  function warmAppPages() {
    if (window.__xmWarmPages) {
      return;
    }
    window.__xmWarmPages = true;
    const hrefs = items
      .map(function (item) {
        return item.href;
      })
      .filter(function (href) {
        return href !== "/releases";
      })
      .concat(["/releases"]);
    let i = 0;
    function next() {
      if (i >= hrefs.length) {
        warmBusy = false;
        return;
      }
      const dest = appPath(hrefs[i]);
      i += 1;
      if (dest && dest !== current) {
        loadHtml(dest);
      }
      setTimeout(next, 400);
    }
    setTimeout(next, 800);
  }

  function warmUpstream() {
    if (window.__xmUpstreamPing) {
      return;
    }
    window.__xmUpstreamPing = setInterval(function () {
      fetch("/api/health", { credentials: "same-origin", cache: "no-store" }).catch(function () {});
    }, 25000);
  }

  function mountShell(userLabel) {
    if (document.querySelector(".xm-shell")) {
      stripInnerChrome(document.querySelector(".xm-content") || document.body);
      bindChrome(userLabel);
      bindSpa();
      rewriteTimeNodes(document.querySelector(".xm-content"));
      watchStampRewrites();
      startClock();
      warmAppPages();
      warmUpstream();
      return;
    }

    const shell = document.createElement("div");
    shell.className = "xm-shell";
    shell.innerHTML =
      '<aside class="xm-sider" aria-label="侧栏导航">' +
      '<a class="xm-logo" href="/"><span class="xm-logo-mark">星</span><span class="xm-logo-text">星脉</span></a>' +
      '<nav class="xm-menu">' +
      menuHtml() +
      "</nav></aside>" +
      '<div class="xm-main">' +
      '<header class="xm-topbar">' +
      '<div class="xm-tabs" aria-label="页签"><span class="xm-tab is-active">' +
      pageLabel(current) +
      "</span></div>" +
      '<div class="xm-user">' +
      '<span class="xm-clock" id="xm-clock" title="北京时间">—</span>' +
      '<span class="xm-username" id="xm-username">' +
      userLabel +
      "</span>" +
      '<button type="button" class="xm-theme" id="xm-theme" aria-pressed="false">暗色</button>' +
      '<button type="button" class="xm-logout" id="xm-logout">退出</button>' +
      "</div></header>" +
      '<div class="xm-content" id="xm-content"></div></div>';

    const content = shell.querySelector("#xm-content");
    const leftovers = [];
    Array.prototype.slice.call(document.body.childNodes).forEach(function (node) {
      if (node === shell) {
        return;
      }
      if (node.id === "upgrade-mask") {
        return;
      }
      if (node.id === "site-nav" || (node.classList && (node.classList.contains("xm-sider") || node.classList.contains("sidebar") || node.classList.contains("site-sidebar")))) {
        return;
      }
      if (node.tagName === "SCRIPT") {
        return;
      }
      leftovers.push(node);
    });
    leftovers.forEach(function (node) {
      if (node.id === "upgrade-mask") {
        return;
      }
      content.appendChild(node);
    });
    const upgradeMask = document.getElementById("upgrade-mask");
    if (upgradeMask && upgradeMask.parentNode !== document.body) {
      document.body.appendChild(upgradeMask);
    }
    const mount = document.getElementById("site-nav");
    if (mount) {
      mount.remove();
    }
    stripInnerChrome(content);
    document.body.insertBefore(shell, document.body.firstChild);
    document.body.classList.add("xm-app");
    bindChrome(userLabel);
    bindSpa();
    rewriteTimeNodes(document.querySelector(".xm-content"));
    watchStampRewrites();
    startClock();
    warmAppPages();
    warmUpstream();
  }

  function start(userLabel) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        mountShell(userLabel);
      });
    } else {
      mountShell(userLabel);
    }
  }

  function paintMe(payload) {
    const name = (payload && (payload.displayName || payload.username)) || "用户";
    applyUserLabel(name);
  }

  start("…");
  bindSpa();

  try {
    const cached = sessionStorage.getItem("xm-me");
    if (cached) {
      paintMe(JSON.parse(cached));
    }
  } catch (_err) {}

  if (!window.__xmMeOnce) {
    window.__xmMeOnce = true;
    fetch("/api/auth/me", { credentials: "same-origin", headers: { Accept: "application/json" } })
      .then(function (res) {
        if (res.status === 401) {
          window.location.replace("/login");
          return null;
        }
        if (!res.ok) {
          return { displayName: "用户" };
        }
        return res.json();
      })
      .then(function (payload) {
        if (!payload) {
          return;
        }
        try {
          sessionStorage.setItem("xm-me", JSON.stringify(payload));
        } catch (_err) {}
        paintMe(payload);
      })
      .catch(function () {});
  }
})();
