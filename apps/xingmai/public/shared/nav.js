/* xm-shell-modules 0.1.67 */
(function () {
  const items = [
    { href: "/", label: "首页", module: "home" },
    { href: "/data", label: "数据中心", module: "data" },
    { href: "/shen", label: "沈子晗运营中心", module: "shen" },
    { href: "/han", label: "韩梦凯运营中心", module: "han" },
    { href: "/people", label: "人员管理", module: "people" },
    { href: "/releases", label: "版本发布中心", module: "releases" },
    { href: "/me", label: "个人中心", module: "me" }
  ];
  const MODULE_VER = "0.1.67";
  const MODULE_SRC = {};
  items.forEach(function (item) {
    MODULE_SRC[item.href] = "/shared/modules/" + item.module + ".js?v=" + MODULE_VER;
  });

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
  let currentUnmount = null;
  let navGen = 0;
  const moduleLoads = {};
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
    css.href = "/shared/layout.css?v=0.1.67";
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
        logoutBtn.disabled = true;
        try {
          sessionStorage.removeItem("xm-me");
        } catch (_err) {}
        var left = false;
        function goLogin() {
          if (left) {
            return;
          }
          left = true;
          window.location.replace("/login?out=1");
        }
        fetch("/api/auth/logout", {
          method: "POST",
          credentials: "same-origin",
          headers: { Accept: "application/json" },
          keepalive: true
        }).then(goLogin, goLogin);
        setTimeout(goLogin, 1500);
      });
    }
  }

  function pinUpgradeMask() {
    const mask = document.getElementById("upgrade-mask");
    if (mask && mask.parentNode !== document.documentElement) {
      document.documentElement.appendChild(mask);
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

  function loadModule(dest) {
    const hit = window.XmModules && window.XmModules[dest];
    if (hit && typeof hit.mount === "function") {
      return Promise.resolve(hit);
    }
    if (moduleLoads[dest]) {
      return moduleLoads[dest];
    }
    moduleLoads[dest] = new Promise(function (resolve, reject) {
      const src = MODULE_SRC[dest];
      if (!src) {
        reject(new Error("no module"));
        return;
      }
      function done() {
        const mod = window.XmModules && window.XmModules[dest];
        if (mod && typeof mod.mount === "function") {
          resolve(mod);
          return;
        }
        reject(new Error("module " + dest));
      }
      let existing = document.querySelector('script[data-xm-mod="' + dest + '"]');
      if (!existing) {
        existing = document.querySelector('script[src="' + src + '"]');
      }
      if (existing) {
        if (window.XmModules && window.XmModules[dest]) {
          resolve(window.XmModules[dest]);
          return;
        }
        if (existing.readyState === "complete" || existing.dataset.loaded === "1") {
          done();
          return;
        }
        existing.addEventListener("load", done);
        existing.addEventListener("error", function () {
          reject(new Error("module " + dest));
        });
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.dataset.xmMod = dest;
      script.onload = function () {
        script.dataset.loaded = "1";
        done();
      };
      script.onerror = function () {
        reject(new Error("module " + dest));
      };
      document.head.appendChild(script);
    });
    return moduleLoads[dest];
  }

  function warmModules() {
    if (window.__xmWarmMods) {
      return;
    }
    window.__xmWarmMods = true;
    items.forEach(function (item, idx) {
      setTimeout(function () {
        loadModule(item.href);
      }, 40 + idx * 40);
    });
    if (!document.querySelector('link[href*="/releases.css"]')) {
      const css = document.createElement("link");
      css.rel = "preload";
      css.as = "style";
      css.href = "/releases.css?v=" + MODULE_VER;
      document.head.appendChild(css);
    }
  }

  function activate(dest, push) {
    const next = appPath(dest) || dest;
    if (!MODULE_SRC[next]) {
      return;
    }
    if (next === current && push) {
      return;
    }
    navGen += 1;
    const gen = navGen;
    highlight(next);
    const content = document.getElementById("xm-content");
    if (!content) {
      window.location.assign(next);
      return;
    }
    loadModule(next)
      .then(function (mod) {
        if (gen !== navGen) {
          return;
        }
        if (typeof currentUnmount === "function") {
          try {
            currentUnmount();
          } catch (_err) {}
          currentUnmount = null;
        }
        content.innerHTML = "";
        if (!mod || typeof mod.mount !== "function") {
          content.innerHTML = '<main class="page"><p class="empty">模块未注册</p></main>';
          return;
        }
        currentUnmount = mod.mount(content) || null;
        pinUpgradeMask();
        if (push) {
          history.pushState({ xmModule: next }, "", next);
        }
        rewriteTimeNodes(content);
      })
      .catch(function () {
        if (gen !== navGen) {
          return;
        }
        window.location.assign(next);
      });
  }

  function bindModules() {
    if (window.__xmModBound) {
      return;
    }
    window.__xmModBound = true;
    document.addEventListener("click", function (event) {
      const a = event.target.closest && event.target.closest("a[href]");
      if (!a || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      if (a.target === "_blank" || a.hasAttribute("download")) {
        return;
      }
      const dest = appPath(a.href);
      if (!dest || !MODULE_SRC[dest]) {
        return;
      }
      event.preventDefault();
      activate(dest, true);
    });
    window.addEventListener("popstate", function () {
      activate(window.location.pathname, false);
    });
    document.addEventListener(
      "pointerenter",
      function (event) {
        const a = event.target.closest && event.target.closest("a[href]");
        if (!a) {
          return;
        }
        const dest = appPath(a.href);
        if (dest && MODULE_SRC[dest]) {
          loadModule(dest);
        }
      },
      true
    );
  }

  function mountShell(userLabel) {
    if (document.querySelector(".xm-shell")) {
      stripInnerChrome(document.querySelector(".xm-content") || document.body);
      pinUpgradeMask();
      bindChrome(userLabel);
      bindModules();
      rewriteTimeNodes(document.querySelector(".xm-content"));
      watchStampRewrites();
      startClock();
      activate(current, false);
      warmModules();
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
      node.parentNode && node.parentNode.removeChild(node);
    });
    pinUpgradeMask();
    const mount = document.getElementById("site-nav");
    if (mount) {
      mount.remove();
    }
    document.body.insertBefore(shell, document.body.firstChild);
    document.body.classList.add("xm-app");
    bindChrome(userLabel);
    bindModules();
    watchStampRewrites();
    startClock();
    activate(current, false);
    warmModules();
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

  try {
    if (window.__xmBootUser) {
      paintMe(window.__xmBootUser);
    } else {
      const cached = sessionStorage.getItem("xm-me");
      if (cached) {
        paintMe(JSON.parse(cached));
      }
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
