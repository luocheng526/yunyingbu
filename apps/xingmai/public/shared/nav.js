/* xm-shell-spa 0.1.25 */
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

  let current = window.location.pathname.replace(/\/+$/, "") || "/";
  const htmlLoads = new Map();
  let navGen = 0;

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
      const next = rewriteUtcStamp(node.nodeValue);
      if (next !== node.nodeValue) {
        node.nodeValue = next;
      }
    });
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

  if (!document.querySelector('link[href="/shared/layout.css"]')) {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "/shared/layout.css";
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

  function loadHtml(dest) {
    const hit = htmlLoads.get(dest);
    if (hit) {
      return hit;
    }
    const pending = fetch(dest, {
      credentials: "same-origin",
      headers: { Accept: "text/html" }
    }).then(function (res) {
      if (res.status === 401 || /\/login(?:\.html)?$/i.test(res.url)) {
        window.location.replace("/login");
        throw new Error("login");
      }
      if (!res.ok) {
        throw new Error("nav " + res.status);
      }
      return res.text();
    });
    htmlLoads.set(dest, pending);
    setTimeout(function () {
      htmlLoads.delete(dest);
    }, 20000);
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
        script.textContent = old.textContent;
      }
      old.replaceWith(script);
    });
  }

  function wipePageTimers() {
    const dummy = setInterval(function () {}, 1e9);
    const max = Math.min(dummy, 100000);
    for (let i = 1; i <= max; i += 1) {
      clearInterval(i);
      clearTimeout(i);
    }
    window.__xmChinaClock = null;
  }

  function applyHtml(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    if (doc.body && doc.body.classList.contains("login-page")) {
      window.location.replace("/login");
      return;
    }
    mergeSheets(doc);
    wipePageTimers();
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
    activateScripts(content);
    rewriteTimeNodes(content);
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
    loadHtml(next)
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
        if (err && err.message === "login") {
          return;
        }
        window.location.assign(next);
      });
  }

  function bindSpa() {
    if (window.__xmSpaBound) {
      return;
    }
    window.__xmSpaBound = true;
    document.addEventListener("click", function (event) {
      const a = event.target.closest("a.xm-menu-item, a.xm-logo");
      if (!a || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      if (a.target === "_blank") {
        return;
      }
      const dest = appPath(a.href);
      if (!dest) {
        return;
      }
      event.preventDefault();
      navigate(dest, true);
    });
    document.addEventListener(
      "pointerenter",
      function (event) {
        const a = event.target.closest && event.target.closest("a.xm-menu-item, a.xm-logo");
        if (!a) {
          return;
        }
        const dest = appPath(a.href);
        if (dest && dest !== current) {
          loadHtml(dest);
        }
      },
      true
    );
    window.addEventListener("popstate", function () {
      navigate(window.location.pathname, false);
    });
  }

  function mountShell(userLabel) {
    if (document.querySelector(".xm-shell")) {
      stripInnerChrome(document.querySelector(".xm-content") || document.body);
      bindChrome(userLabel);
      bindSpa();
      rewriteTimeNodes(document.querySelector(".xm-content"));
      startClock();
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
      '<button type="button" class="xm-logout" id="xm-logout">退出</button>' +
      "</div></header>" +
      '<div class="xm-content" id="xm-content"></div></div>';

    const content = shell.querySelector("#xm-content");
    const leftovers = [];
    Array.prototype.slice.call(document.body.childNodes).forEach(function (node) {
      if (node === shell) {
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
      content.appendChild(node);
    });
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
    startClock();
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
